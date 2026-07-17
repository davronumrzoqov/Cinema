/**
 * Payme (Paycom) Merchant API integratsiyasi — JSON-RPC 2.0.
 *
 * Qanday ishlaydi:
 *   1. Foydalanuvchi "Payme orqali to'lash" bosadi → backend checkout havolasini beradi.
 *   2. Foydalanuvchi Payme sahifasida to'laydi.
 *   3. Payme serveri shu yerdagi /api/payme webhook'iga JSON-RPC so'rov yuboradi:
 *      CheckPerformTransaction → CreateTransaction → PerformTransaction.
 *   4. PerformTransaction'da xarid 'approved' bo'ladi va kino avtomatik ochiladi.
 *
 * Kerakli sozlamalar (env orqali):
 *   PAYME_MERCHANT_ID — Payme kabinetdan olinadigan kassa ID.
 *   PAYME_KEY         — kassaning maxfiy kaliti (webhook Basic-auth paroli).
 *
 * Summalar Payme'da TIYIN'da (so'm × 100) yuriladi.
 */

const crypto = require('crypto');

// Payme tranzaksiya holatlari
const STATE = {
  CREATED: 1,       // yaratilgan, to'lov kutilmoqda
  PERFORMED: 2,     // to'langan
  CANCELLED: -1,    // yaratilgandan keyin bekor qilingan
  CANCELLED_AFTER: -2 // to'langandan keyin bekor qilingan
};

// Payme xato kodlari
const ERR = {
  INVALID_AMOUNT: -31001,
  ORDER_NOT_FOUND: -31050,
  CANT_PERFORM: -31008,
  TX_NOT_FOUND: -31003,
  CANT_CANCEL: -31007,
  INVALID_AUTH: -32504,
  METHOD_NOT_FOUND: -32601
};

function rpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message: message || {}, data } };
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

// Ko'p tilli xabar (Payme talabi: ru/uz/en)
function msg(text) {
  return { ru: text, uz: text, en: text };
}

/**
 * Payme webhook'ini yaratadi.
 * @param {object} deps
 * @param {() => object} deps.readDB
 * @param {(db: object) => void} deps.writeDB
 * @param {string} deps.merchantKey  Kassaning maxfiy kaliti
 */
function createPaymeHandler({ readDB, writeDB, merchantKey }) {
  // Basic-auth tekshiruvi: login "Paycom", parol — kassa kaliti
  function checkAuth(req) {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme !== 'Basic' || !encoded) return false;
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const password = decoded.split(':')[1] || '';
    // Vaqt-xavfsiz taqqoslash
    const a = Buffer.from(password);
    const b = Buffer.from(merchantKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // order_id -> xaridni topadi (ac.order_id = purchase.id)
  function findPurchase(db, params) {
    const orderId = Number(params?.account?.order_id);
    if (!orderId) return null;
    return db.purchases.find(p => p.id === orderId) || null;
  }

  // --- JSON-RPC metodlari ---------------------------------------------------

  function checkPerformTransaction(db, params) {
    const purchase = findPurchase(db, params);
    if (!purchase) return { error: [ERR.ORDER_NOT_FOUND, msg('Buyurtma topilmadi'), 'order_id'] };
    if (purchase.status === 'approved') return { error: [ERR.CANT_PERFORM, msg('Bu kino allaqachon sotib olingan')] };
    if (Number(params.amount) !== purchase.price * 100) {
      return { error: [ERR.INVALID_AMOUNT, msg('Summa noto\'g\'ri')] };
    }
    return { result: { allow: true } };
  }

  function createTransaction(db, params) {
    const purchase = findPurchase(db, params);
    if (!purchase) return { error: [ERR.ORDER_NOT_FOUND, msg('Buyurtma topilmadi'), 'order_id'] };
    if (Number(params.amount) !== purchase.price * 100) {
      return { error: [ERR.INVALID_AMOUNT, msg('Summa noto\'g\'ri')] };
    }

    db.paymeTransactions = db.paymeTransactions || [];
    const existing = db.paymeTransactions.find(t => t.paymeId === params.id);
    if (existing) {
      if (existing.state !== STATE.CREATED) {
        return { error: [ERR.CANT_PERFORM, msg('Tranzaksiya holati mos emas')] };
      }
      return { result: { create_time: existing.createTime, transaction: String(existing.id), state: existing.state } };
    }

    // Bir buyurtmaga bir vaqtda bitta faol tranzaksiya
    const active = db.paymeTransactions.find(t => t.orderId === purchase.id && t.state === STATE.CREATED);
    if (active) return { error: [ERR.CANT_PERFORM, msg('Bu buyurtma uchun tranzaksiya allaqachon boshlangan')] };

    const now = Date.now();
    const tx = {
      id: now,
      paymeId: params.id,
      orderId: purchase.id,
      amount: params.amount,
      state: STATE.CREATED,
      createTime: now,
      performTime: 0,
      cancelTime: 0,
      reason: null
    };
    db.paymeTransactions.push(tx);
    return { result: { create_time: tx.createTime, transaction: String(tx.id), state: tx.state } };
  }

  function performTransaction(db, params) {
    db.paymeTransactions = db.paymeTransactions || [];
    const tx = db.paymeTransactions.find(t => t.paymeId === params.id);
    if (!tx) return { error: [ERR.TX_NOT_FOUND, msg('Tranzaksiya topilmadi')] };

    if (tx.state === STATE.PERFORMED) {
      return { result: { transaction: String(tx.id), perform_time: tx.performTime, state: tx.state } };
    }
    if (tx.state !== STATE.CREATED) {
      return { error: [ERR.CANT_PERFORM, msg('Tranzaksiya holati mos emas')] };
    }

    tx.state = STATE.PERFORMED;
    tx.performTime = Date.now();

    // >>> Pul keldi: kinoni avtomatik ochamiz <<<
    const purchase = db.purchases.find(p => p.id === tx.orderId);
    if (purchase) {
      purchase.status = 'approved';
      purchase.approvedAt = new Date().toISOString();
      purchase.method = 'payme';
    }

    return { result: { transaction: String(tx.id), perform_time: tx.performTime, state: tx.state } };
  }

  function cancelTransaction(db, params) {
    db.paymeTransactions = db.paymeTransactions || [];
    const tx = db.paymeTransactions.find(t => t.paymeId === params.id);
    if (!tx) return { error: [ERR.TX_NOT_FOUND, msg('Tranzaksiya topilmadi')] };

    if (tx.state === STATE.CREATED) {
      tx.state = STATE.CANCELLED;
    } else if (tx.state === STATE.PERFORMED) {
      tx.state = STATE.CANCELLED_AFTER;
      // To'langan bo'lsa ham bekor qilinganda kino yopiladi
      const purchase = db.purchases.find(p => p.id === tx.orderId);
      if (purchase && purchase.status === 'approved') purchase.status = 'rejected';
    }
    tx.cancelTime = tx.cancelTime || Date.now();
    tx.reason = params.reason ?? tx.reason;

    return { result: { transaction: String(tx.id), cancel_time: tx.cancelTime, state: tx.state } };
  }

  function checkTransaction(db, params) {
    const tx = (db.paymeTransactions || []).find(t => t.paymeId === params.id);
    if (!tx) return { error: [ERR.TX_NOT_FOUND, msg('Tranzaksiya topilmadi')] };
    return {
      result: {
        create_time: tx.createTime,
        perform_time: tx.performTime,
        cancel_time: tx.cancelTime,
        transaction: String(tx.id),
        state: tx.state,
        reason: tx.reason
      }
    };
  }

  const METHODS = {
    CheckPerformTransaction: checkPerformTransaction,
    CreateTransaction: createTransaction,
    PerformTransaction: performTransaction,
    CancelTransaction: cancelTransaction,
    CheckTransaction: checkTransaction
  };

  // --- Express handler ------------------------------------------------------
  return function handler(req, res) {
    if (!checkAuth(req)) {
      return res.json(rpcError(req.body?.id, ERR.INVALID_AUTH, msg('Ruxsat yo\'q')));
    }

    const { id, method, params } = req.body || {};
    const fn = METHODS[method];
    if (!fn) return res.json(rpcError(id, ERR.METHOD_NOT_FOUND, msg('Metod topilmadi')));

    // DB'ni bir marta o'qib, o'zgarsa yozamiz (webhook'lar ketma-ket keladi)
    const db = readDB();
    const out = fn(db, params || {});
    writeDB(db);

    if (out.error) {
      const [code, message, data] = out.error;
      return res.json(rpcError(id, code, message, data));
    }
    return res.json(rpcResult(id, out.result));
  };
}

/**
 * Foydalanuvchini yo'naltirish uchun Payme checkout havolasini yasaydi.
 * Format: https://checkout.paycom.uz/{base64(m=...;ac.order_id=...;a=...;c=...)}
 */
function buildCheckoutUrl({ merchantId, orderId, amountSom, returnUrl }) {
  const parts = [
    `m=${merchantId}`,
    `ac.order_id=${orderId}`,
    `a=${amountSom * 100}` // tiyin
  ];
  if (returnUrl) parts.push(`c=${returnUrl}`);
  const encoded = Buffer.from(parts.join(';')).toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

module.exports = { createPaymeHandler, buildCheckoutUrl, STATE };
