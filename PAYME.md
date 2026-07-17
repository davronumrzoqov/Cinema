# Payme (avtomatik to'lov) — ulash yo'riqnomasi

Payme ulangach foydalanuvchi to'lovi **avtomatik** tasdiqlanadi — qo'lda "Tasdiqlash" bosish shart emas. Pul kelishi bilan kino o'zi ochiladi.

## 1. Payme kabinetda kassa ochish

1. Biznesingizni Payme'da ro'yxatdan o'tkazing (yakka tadbirkor yoki MChJ kerak): <https://business.payme.uz>
2. Yangi **kassa (merchant)** yarating.
3. Kassadan **2 ta narsani** oling:
   - **Kassa ID** (`PAYME_MERCHANT_ID`)
   - **Kalit (key)** (`PAYME_KEY`) — bu maxfiy, hech kimga bermang.

## 2. Webhook manzilini Payme'ga kiritish

Payme kassa sozlamalarida **"Endpoint URL"** (yoki "To'lovni tekshirish URL manzili") maydoniga saytingiz manzilini + `/api/payme` qo'shib yozing:

```
https://SIZNING-SAYT.onrender.com/api/payme
```

> Payme serverlari shu manzilga so'rov yuboradi, shuning uchun sayt internetda ochiq (HTTPS) bo'lishi shart. Render.com'da deploy qilingan sayt buni qondiradi.

## 3. Sozlamalarni serverga kiritish

### Lokal (kompyuterda sinash uchun)

`.env` fayl yarating yoki terminalda:

```bash
PAYME_MERCHANT_ID=sizning_kassa_id \
PAYME_KEY=sizning_kaliti \
PUBLIC_URL=http://localhost:3000 \
node server.js
```

### Render.com'da

Dashboard → xizmatingiz → **Environment** bo'limiga qo'shing:

| Kalit | Qiymat |
|-------|--------|
| `PAYME_MERCHANT_ID` | Payme kassa ID |
| `PAYME_KEY` | Payme kassa kaliti |
| `PUBLIC_URL` | `https://sizning-sayt.onrender.com` |

## 4. Tekshirish

- Sozlamalar to'g'ri bo'lsa, kino sotib olish oynasida **"Payme orqali to'lash"** tugmasi paydo bo'ladi.
- `PAYME_MERCHANT_ID` yoki `PAYME_KEY` bo'sh bo'lsa — Payme o'chiq bo'ladi, faqat karta-ga-karta usuli ishlaydi.
- Payme'ning o'z **test kassasi** bilan avval sinab ko'ring, keyin ishga (production) o'ting.

## Qanday ishlaydi (texnik)

1. Foydalanuvchi "Payme orqali to'lash" bosadi → server `pending` xarid yaratadi va Payme checkout havolasini beradi.
2. Foydalanuvchi Payme sahifasida to'laydi.
3. Payme serveri `/api/payme` ga JSON-RPC so'rovlar yuboradi:
   `CheckPerformTransaction` → `CreateTransaction` → `PerformTransaction`.
4. `PerformTransaction`da xarid `approved` bo'ladi — **kino avtomatik ochiladi**.

Kodlar: [payme.js](payme.js) (JSON-RPC logikasi), [server.js](server.js) (webhook va checkout).
