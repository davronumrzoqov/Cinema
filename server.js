/**
 * Cinema — backend server.
 *
 * Texnologiyalar: Express + JSON fayl-DB (db.json).
 * Auth: JWT (7 kun), parollar bcrypt bilan xeshlanadi.
 * Rollar: 'admin' (kino qo'shish/o'chirish/tahrirlash) va 'user'.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { movies: seedMovies } = require('./seed');

// ---------------------------------------------------------------------------
// Konfiguratsiya
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_TTL = '7d';
const DB_FILE = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Google orqali kirish uchun OAuth Client ID (console.cloud.google.com dan olinadi).
// Bo'sh bo'lsa, Google tugmasi frontendda ko'rsatilmaydi.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// To'lov qabul qilinadigan karta (env orqali yoki admin paneldan sozlanadi).
// Karta raqami kodda saqlanmaydi — db.json (gitignore'da) ichida turadi.
const PAYMENT_CARD_NUMBER = process.env.PAYMENT_CARD_NUMBER || '';
const PAYMENT_CARD_OWNER = process.env.PAYMENT_CARD_OWNER || '';

const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@cinema.uz',
  password: process.env.ADMIN_PASSWORD || 'Admin123!'
};

const VALID_GENRES = new Set(['Movie', 'TV Series']);
const VALID_LIMITS = new Set(['G', 'PG', 'PG-13', '18+']);
const MIN_YEAR = 1888;
const MAX_YEAR = new Date().getFullYear() + 5;

// ---------------------------------------------------------------------------
// Fayl-DB
// ---------------------------------------------------------------------------

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return { users: [], movies: [], bookmarks: [], purchases: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function initDB() {
  const db = readDB();
  db.users = db.users || [];
  db.movies = db.movies || [];
  db.bookmarks = db.bookmarks || [];
  db.purchases = db.purchases || [];
  db.settings = db.settings || {};

  // To'lov kartasi: env'da berilgan bo'lsa yangilanadi, bo'lmasa mavjudi qoladi
  if (PAYMENT_CARD_NUMBER) db.settings.cardNumber = PAYMENT_CARD_NUMBER;
  if (PAYMENT_CARD_OWNER) db.settings.cardOwner = PAYMENT_CARD_OWNER;
  db.settings.cardNumber = db.settings.cardNumber || '';
  db.settings.cardOwner = db.settings.cardOwner || '';

  // Eski sxemadagi db.json (poster/trailer maydonlari yo'q) yangi katalog bilan almashtiriladi
  const outdated = db.movies.length > 0 && (!db.movies[0].poster || db.movies[0].trailer === undefined);
  if (db.movies.length === 0 || outdated) {
    db.movies = seedMovies;
    db.bookmarks = db.bookmarks.filter(b => typeof b.movieId === 'number');
  }

  // Eski dollar narxlari (100 dan kichik) so'mga o'tkaziladi
  db.movies.forEach(m => { if (m.price > 0 && m.price < 100) m.price = 13000; });

  // Eski to'lovlar (status maydonisiz) tasdiqlangan deb belgilanadi
  db.purchases.forEach(p => { if (!p.status) p.status = 'approved'; });

  if (!db.users.some(u => u.email === DEFAULT_ADMIN.email)) {
    db.users.push({
      id: Date.now(),
      email: DEFAULT_ADMIN.email,
      password: bcrypt.hashSync(DEFAULT_ADMIN.password, 10),
      role: 'admin'
    });
  }

  writeDB(db);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token yaroqsiz yoki muddati o\'tgan' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu amal faqat admin uchun' });
  }
  next();
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Async routelardagi istalgan xato error-middleware'ga tushishi uchun o'ram
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------------------------------------------------------------------------
// Validatsiya
// ---------------------------------------------------------------------------

function validateMovie(body) {
  const name = String(body.name || '').trim();
  const genre = String(body.genre || '').trim();
  const limit = String(body.limit || '').trim();
  const poster = String(body.poster || '').trim();
  const trailer = String(body.trailer || '').trim();
  const year = Number(body.year);
  const price = body.price === undefined || body.price === '' ? 0 : Number(body.price);

  if (!name) return { error: 'Kino nomi kiritilishi shart' };
  if (!VALID_GENRES.has(genre)) return { error: "Turi 'Movie' yoki 'TV Series' bo'lishi kerak" };
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { error: `Yil ${MIN_YEAR}–${MAX_YEAR} oralig'ida bo'lishi kerak` };
  }
  if (!VALID_LIMITS.has(limit)) return { error: 'Yosh chegarasi noto\'g\'ri (G, PG, PG-13, 18+)' };
  if (!/^https?:\/\/.+/i.test(poster)) return { error: 'Poster URL http(s):// bilan boshlanishi kerak' };
  if (trailer && !/^[\w-]{6,20}$/.test(trailer)) {
    return { error: 'Treyler — YouTube video ID bo\'lishi kerak (masalan: YoHD9XEInc0)' };
  }
  if (!Number.isFinite(price) || price < 0) return { error: 'Narx manfiy bo\'lmagan son bo\'lishi kerak' };

  return {
    movie: {
      name,
      genre,
      year,
      limit,
      poster,
      trailer,
      price: Math.round(price * 100) / 100,
      trending: !!body.trending,
      top: !!body.top,
      popular: !!body.popular
    }
  };
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

app.post('/api/auth/signup', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Email formati noto\'g\'ri' });
  if (password.length < 6) return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' });

  const db = readDB();
  if (db.users.some(u => u.email === email)) {
    return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
  }

  const user = {
    id: Date.now(),
    email,
    password: await bcrypt.hash(password, 10),
    role: db.users.some(u => u.role === 'admin') ? 'user' : 'admin'
  };
  db.users.push(user);
  writeDB(db);

  res.status(201).json({ token: signToken(user), role: user.role });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const db = readDB();
  const user = db.users.find(u => u.email === email);
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
  }

  // Tizim hech qachon adminsiz qolmasin
  if (!db.users.some(u => u.role === 'admin')) {
    user.role = 'admin';
    writeDB(db);
  }

  res.json({ token: signToken(user), role: user.role });
}));

// --- Google orqali kirish -------------------------------------------------

app.get('/api/auth/google/config', (req, res) => {
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

app.post('/api/auth/google', wrap(async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google orqali kirish sozlanmagan (GOOGLE_CLIENT_ID yo\'q)' });
  }
  const credential = String(req.body?.credential || '');
  if (!credential) return res.status(400).json({ error: 'Google credential yuborilmadi' });

  // Google'ning o'zidan token haqiqiyligini tekshiramiz
  const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!gRes.ok) return res.status(401).json({ error: 'Google token yaroqsiz' });
  const info = await gRes.json();

  if (info.aud !== GOOGLE_CLIENT_ID) return res.status(401).json({ error: 'Google token boshqa ilova uchun berilgan' });
  if (info.email_verified !== 'true' && info.email_verified !== true) {
    return res.status(401).json({ error: 'Google email tasdiqlanmagan' });
  }

  const email = String(info.email).toLowerCase();
  const db = readDB();
  let user = db.users.find(u => u.email === email);
  if (!user) {
    user = {
      id: Date.now(),
      email,
      provider: 'google',
      name: info.name || '',
      role: db.users.some(u => u.role === 'admin') ? 'user' : 'admin'
    };
    db.users.push(user);
    writeDB(db);
  }

  res.json({ token: signToken(user), role: user.role });
}));

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

// ---------------------------------------------------------------------------
// Movies API
// ---------------------------------------------------------------------------

// Ro'yxatda treyler ID berilmaydi — u faqat /watch orqali (huquq tekshiruvi bilan) olinadi
app.get('/api/movies', (req, res) => {
  const movies = readDB().movies.map(({ trailer, ...rest }) => ({ ...rest, hasTrailer: !!trailer }));
  res.json(movies);
});

// Admin uchun to'liq ro'yxat (treyler bilan) — tahrirlash formasi uchun
app.get('/api/admin/movies', auth, adminOnly, (req, res) => {
  res.json(readDB().movies);
});

// Ko'rish huquqi: bepul kino — kirgan har kimga; pullik — faqat sotib olganlarga
app.get('/api/movies/:id/watch', auth, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const movie = db.movies.find(m => m.id === id);
  if (!movie) return res.status(404).json({ error: 'Kino topilmadi' });

  if (movie.price > 0) {
    const purchase = db.purchases.find(p => p.userId === req.user.id && p.movieId === id);
    if (!purchase || purchase.status !== 'approved') {
      return res.status(402).json({
        error: purchase?.status === 'pending'
          ? 'To\'lovingiz tekshirilmoqda — admin tasdiqlagach kino ochiladi'
          : 'Bu kino pullik — avval sotib oling',
        price: movie.price,
        pending: purchase?.status === 'pending'
      });
    }
  }

  if (!movie.trailer) return res.status(404).json({ error: 'Bu kino uchun video hali qo\'shilmagan' });
  res.json({ trailer: movie.trailer, name: movie.name });
});

app.post('/api/movies', auth, adminOnly, (req, res) => {
  const { error, movie } = validateMovie(req.body || {});
  if (error) return res.status(400).json({ error });

  const db = readDB();
  if (db.movies.some(m => m.name.toLowerCase() === movie.name.toLowerCase() && m.year === movie.year)) {
    return res.status(409).json({ error: 'Bu kino allaqachon ro\'yxatda bor' });
  }

  movie.id = db.movies.reduce((max, m) => Math.max(max, m.id || 0), 0) + 1;
  db.movies.push(movie);
  writeDB(db);
  res.status(201).json(movie);
});

app.put('/api/movies/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const index = db.movies.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Kino topilmadi' });

  const { error, movie } = validateMovie(req.body || {});
  if (error) return res.status(400).json({ error });

  movie.id = id;
  db.movies[index] = movie;
  writeDB(db);
  res.json(movie);
});

app.delete('/api/movies/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const before = db.movies.length;
  db.movies = db.movies.filter(m => m.id !== id);
  if (db.movies.length === before) return res.status(404).json({ error: 'Kino topilmadi' });
  writeDB(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Bookmarks API
// ---------------------------------------------------------------------------

app.get('/api/bookmarks', auth, (req, res) => {
  const db = readDB();
  res.json(db.bookmarks.filter(b => b.userId === req.user.id).map(b => b.movieId));
});

app.post('/api/bookmarks/:movieId', auth, (req, res) => {
  const movieId = Number(req.params.movieId);
  const db = readDB();
  if (!db.movies.some(m => m.id === movieId)) return res.status(404).json({ error: 'Kino topilmadi' });

  const existing = db.bookmarks.findIndex(b => b.userId === req.user.id && b.movieId === movieId);
  if (existing === -1) {
    db.bookmarks.push({ userId: req.user.id, movieId });
  } else {
    db.bookmarks.splice(existing, 1); // toggle
  }
  writeDB(db);
  res.json({ bookmarked: existing === -1 });
});

// ---------------------------------------------------------------------------
// Purchases API — haqiqiy to'lov: foydalanuvchi ko'rsatilgan kartaga pul
// o'tkazadi (karta-ga-karta), keyin "To'lov qildim" bosadi. Admin panelda
// to'lov tasdiqlanadi — shundan so'ng kino ochiladi.
// ---------------------------------------------------------------------------

// To'lov rekvizitlari — foydalanuvchi pulni shu kartaga o'tkazadi
app.get('/api/payment-card', auth, (req, res) => {
  const { settings } = readDB();
  if (!settings.cardNumber) {
    return res.status(503).json({ error: 'To\'lov kartasi hali sozlanmagan — admin bilan bog\'laning' });
  }
  res.json({ cardNumber: settings.cardNumber, cardOwner: settings.cardOwner });
});

// Foydalanuvchining xaridlari: tasdiqlanganlari va kutilayotganlari
app.get('/api/purchases', auth, (req, res) => {
  const db = readDB();
  const mine = db.purchases.filter(p => p.userId === req.user.id);
  res.json({
    owned: mine.filter(p => p.status === 'approved').map(p => p.movieId),
    pending: mine.filter(p => p.status === 'pending').map(p => p.movieId)
  });
});

// "To'lov qildim" — kutilayotgan to'lov yaratiladi
app.post('/api/purchases/:movieId', auth, (req, res) => {
  const movieId = Number(req.params.movieId);
  const db = readDB();
  const movie = db.movies.find(m => m.id === movieId);
  if (!movie) return res.status(404).json({ error: 'Kino topilmadi' });
  if (!movie.price) return res.status(400).json({ error: 'Bu kino bepul — sotib olish shart emas' });

  const existing = db.purchases.find(p => p.userId === req.user.id && p.movieId === movieId);
  if (existing?.status === 'approved') return res.status(409).json({ error: 'Bu kino allaqachon sotib olingan' });
  if (existing?.status === 'pending') return res.status(409).json({ error: 'To\'lovingiz allaqachon tekshirilmoqda' });

  // Rad etilgan eski yozuv bo'lsa — o'chirib, yangi so'rov ochamiz
  db.purchases = db.purchases.filter(p => !(p.userId === req.user.id && p.movieId === movieId));

  const purchase = {
    id: Date.now(),
    userId: req.user.id,
    userEmail: req.user.email,
    movieId,
    price: movie.price,
    payerNote: String(req.body?.payerNote || '').slice(0, 120),
    status: 'pending',
    date: new Date().toISOString()
  };
  db.purchases.push(purchase);
  writeDB(db);

  res.status(201).json({ ok: true, status: 'pending' });
});

// --- Admin: to'lovlarni boshqarish ----------------------------------------

app.get('/api/admin/purchases', auth, adminOnly, (req, res) => {
  const db = readDB();
  const list = db.purchases.map(p => ({
    ...p,
    movie: db.movies.find(m => m.id === p.movieId)?.name || '—'
  }));
  // Kutilayotganlar birinchi, keyin sanasi bo'yicha yangi->eski
  list.sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || b.date.localeCompare(a.date));
  res.json(list);
});

app.post('/api/admin/purchases/:id/approve', auth, adminOnly, (req, res) => {
  const db = readDB();
  const purchase = db.purchases.find(p => p.id === Number(req.params.id));
  if (!purchase) return res.status(404).json({ error: 'To\'lov topilmadi' });
  purchase.status = 'approved';
  purchase.approvedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/purchases/:id/reject', auth, adminOnly, (req, res) => {
  const db = readDB();
  const purchase = db.purchases.find(p => p.id === Number(req.params.id));
  if (!purchase) return res.status(404).json({ error: 'To\'lov topilmadi' });
  purchase.status = 'rejected';
  writeDB(db);
  res.json({ ok: true });
});

// --- Admin: to'lov kartasi sozlamalari -------------------------------------

app.get('/api/admin/settings', auth, adminOnly, (req, res) => {
  const { settings } = readDB();
  res.json({ cardNumber: settings.cardNumber, cardOwner: settings.cardOwner });
});

app.put('/api/admin/settings', auth, adminOnly, (req, res) => {
  const cardNumber = String(req.body?.cardNumber || '').replace(/\s/g, '');
  const cardOwner = String(req.body?.cardOwner || '').trim();
  if (cardNumber && !/^\d{16}$/.test(cardNumber)) {
    return res.status(400).json({ error: 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak' });
  }
  const db = readDB();
  db.settings.cardNumber = cardNumber;
  db.settings.cardOwner = cardOwner;
  writeDB(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Ishga tushirish
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Noma'lum API yo'llari ham JSON qaytarsin (HTML 404 emas)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Bunday API yo\'li mavjud emas' });
});

// Har qanday kutilmagan xato foydalanuvchiga tushunarli JSON bo'lib boradi
app.use((err, req, res, next) => {
  console.error('[server xatosi]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Serverda kutilmagan xatolik. Birozdan so\'ng qayta urinib ko\'ring.' });
});

initDB();
app.listen(PORT, () => {
  console.log(`Cinema server: http://localhost:${PORT}`);
});
