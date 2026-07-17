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

  // Eski sxemadagi db.json (poster/trailer maydonlari yo'q) yangi katalog bilan almashtiriladi
  const outdated = db.movies.length > 0 && (!db.movies[0].poster || db.movies[0].trailer === undefined);
  if (db.movies.length === 0 || outdated) {
    db.movies = seedMovies;
    db.bookmarks = db.bookmarks.filter(b => typeof b.movieId === 'number');
  }

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
    const owned = db.purchases.some(p => p.userId === req.user.id && p.movieId === id);
    if (!owned) {
      return res.status(402).json({ error: 'Bu kino pullik — avval sotib oling', price: movie.price });
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
// Purchases API — karta bilan to'lov (demo shlyuz: Luhn + muddat tekshiradi,
// haqiqiy pul yechilmaydi; real provayder ulash uchun shu joyga Stripe/Payme/
// Click SDK chaqiruvi qo'yiladi)
// ---------------------------------------------------------------------------

function luhnValid(number) {
  const digits = number.split('').reverse().map(Number);
  const sum = digits.reduce((acc, d, i) => {
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    return acc + d;
  }, 0);
  return sum % 10 === 0;
}

function cardBrand(number) {
  if (/^8600/.test(number)) return 'UzCard';
  if (/^9860/.test(number)) return 'Humo';
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  return 'Karta';
}

function validateCard(card) {
  const number = String(card?.number || '').replace(/[\s-]/g, '');
  const expiry = String(card?.expiry || '').trim();
  const cvc = String(card?.cvc || '').trim();
  const holder = String(card?.holder || '').trim();

  if (!/^\d{16}$/.test(number)) return { error: 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak' };
  if (!luhnValid(number)) return { error: 'Karta raqami noto\'g\'ri (tekshiruvdan o\'tmadi)' };

  const m = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return { error: 'Amal qilish muddati MM/YY ko\'rinishida bo\'lishi kerak' };
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return { error: 'Oy 01–12 oralig\'ida bo\'lishi kerak' };
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return { error: 'Kartaning amal qilish muddati tugagan' };
  }

  if (!/^\d{3,4}$/.test(cvc)) return { error: 'CVC 3–4 raqamdan iborat bo\'lishi kerak' };
  if (holder.length < 3) return { error: 'Karta egasining ismini kiriting' };

  return { number, brand: cardBrand(number), last4: number.slice(-4) };
}

app.get('/api/purchases', auth, (req, res) => {
  const db = readDB();
  res.json(db.purchases.filter(p => p.userId === req.user.id).map(p => p.movieId));
});

app.get('/api/purchases/history', auth, (req, res) => {
  const db = readDB();
  const list = db.purchases
    .filter(p => p.userId === req.user.id)
    .map(p => {
      const movie = db.movies.find(m => m.id === p.movieId);
      return { receiptId: p.receiptId, movie: movie?.name || '—', price: p.price, brand: p.brand, last4: p.last4, date: p.date };
    });
  res.json(list);
});

app.post('/api/purchases/:movieId', auth, wrap(async (req, res) => {
  const movieId = Number(req.params.movieId);
  const db = readDB();
  const movie = db.movies.find(m => m.id === movieId);
  if (!movie) return res.status(404).json({ error: 'Kino topilmadi' });
  if (!movie.price) return res.status(400).json({ error: 'Bu kino bepul — sotib olish shart emas' });

  if (db.purchases.some(p => p.userId === req.user.id && p.movieId === movieId)) {
    return res.status(409).json({ error: 'Bu kino allaqachon sotib olingan' });
  }

  const card = validateCard(req.body?.card);
  if (card.error) return res.status(400).json({ error: card.error });

  // To'lov shlyuzi simulyatsiyasi: qayta ishlash kechikishi + standart rad karta
  await new Promise(r => setTimeout(r, 600));
  if (card.number === '4000000000000002') {
    return res.status(402).json({ error: 'To\'lov rad etildi — kartada mablag\' yetarli emas' });
  }

  const receiptId = `CHK-${Date.now()}-${movieId}`;
  const purchase = {
    userId: req.user.id,
    movieId,
    price: movie.price,
    brand: card.brand,
    last4: card.last4,
    receiptId,
    date: new Date().toISOString()
  };
  db.purchases.push(purchase);
  writeDB(db);

  res.status(201).json({
    ok: true,
    receipt: { receiptId, movie: movie.name, price: movie.price, brand: card.brand, last4: card.last4, date: purchase.date }
  });
}));

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
