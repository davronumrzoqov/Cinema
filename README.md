# Cinema

Filmlar va seriallar katalogi — Express backend, JWT autentifikatsiya, admin panel va jonli (animatsiyali) frontend.

## Ishga tushirish

```bash
npm install
npm start
```

Brauzerda: **http://localhost:3000**

## Akkauntlar

| Rol   | Email             | Parol       |
|-------|-------------------|-------------|
| Admin | `admin@cinema.uz` | `Admin123!` |

Oddiy foydalanuvchi — ro'yxatdan o'tish orqali. Tizimda admin qolmasa, keyingi kirgan foydalanuvchi avtomatik admin bo'ladi.

## Imkoniyatlar

- **Katalog** — 50 ta haqiqiy film/serial (TMDB posterlari + rasmiy YouTube treylerlar), Trend / Top reyting / Mashhur bo'limlari
- **Ko'rish** — har bir kino kartasi bosilganda modal oynada rasmiy treyler o'ynaydi (YouTube embed)
- **Pullik/Bepul** — bepul kinolar darhol ko'riladi; pullik kinolar avval "sotib olinadi" (demo to'lov), sotib olingach har doim ochiq
- **Qidiruv va filtr** — nom/yil bo'yicha qidiruv; sidebar orqali Film / Serial / Saqlanganlar filtri
- **Saqlash (bookmark)** — har bir kartada saqlash tugmasi
- **Kirish majburiy** — tizimga kirilmagan bo'lsa asosiy sahifa login sahifasiga yo'naltiradi
- **Admin panel** (`/admin.html`) — kino qo'shish, tahrirlash, o'chirish (treyler ID bilan), ro'yxatdan qidirish
- **Animatsiyalar** — scroll-reveal, shimmer yuklanish, hover effektlar, modal, toast xabarnomalar

## Struktura

```
server.js        — Express server + API (auth, movies, bookmarks)
seed.js          — boshlang'ich 50 ta kino
db.json          — fayl-DB (avtomatik yaratiladi)
public/
  index.html     — kirish / ro'yxatdan o'tish
  main.html      — bosh sahifa
  admin.html     — admin panel
  css/style.css  — dizayn tizimi
  js/api.js      — umumiy API klient + toast
  js/auth.js     — auth sahifasi
  js/app.js      — bosh sahifa mantiqi
  js/admin.js    — admin panel mantiqi
```

## API

| Metod  | Yo'l                      | Kirish | Tavsif                                        |
|--------|---------------------------|--------|-----------------------------------------------|
| POST   | `/api/auth/signup`        | —      | Ro'yxatdan o'tish                             |
| POST   | `/api/auth/login`         | —      | Kirish                                        |
| GET    | `/api/auth/me`            | token  | Joriy foydalanuvchi                           |
| GET    | `/api/movies`             | —      | Barcha kinolar (treyler ID'siz)               |
| GET    | `/api/movies/:id/watch`   | token  | Treyler ID (pullik bo'lsa sotib olish talab)  |
| GET    | `/api/admin/movies`       | admin  | To'liq ro'yxat (treyler bilan)                |
| POST   | `/api/movies`             | admin  | Kino qo'shish                                 |
| PUT    | `/api/movies/:id`         | admin  | Kino tahrirlash                               |
| DELETE | `/api/movies/:id`         | admin  | Kino o'chirish                                |
| GET    | `/api/bookmarks`          | token  | Saqlanganlar ro'yxati                         |
| POST   | `/api/bookmarks/:movieId` | token  | Saqlash / olib tashlash                       |
| GET    | `/api/purchases`          | token  | Sotib olingan kinolar                         |
| POST   | `/api/purchases/:movieId` | token  | Kino sotib olish (demo to'lov)                |

## To'lov (demo shlyuz)

Pullik kino sotib olishda haqiqiy karta formasi ochiladi: raqam (Luhn algoritmi bilan tekshiriladi),
amal muddati, CVC, egasining ismi. Server ham qayta tekshiradi va kvitansiya (chek) qaytaradi.
Haqiqiy pul yechilmaydi — real provayder (Payme/Click/Stripe) ulash uchun `server.js`dagi
purchases bo'limiga merchant kalitlari bilan SDK chaqiruvi qo'yiladi.

Sinov kartalari (Luhn'dan o'tadi):

| Karta                 | Natija                          |
|-----------------------|---------------------------------|
| `4242 4242 4242 4242` | To'lov muvaffaqiyatli (Visa)    |
| `8600 4954 7331 6478` | To'lov muvaffaqiyatli (UzCard)* |
| `4000 0000 0000 0002` | Rad etiladi (mablag' yetarli emas) |

\* istalgan Luhn-to'g'ri 16 xonali raqam qabul qilinadi.

## Google orqali kirish (ixtiyoriy)

1. [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) da **OAuth Client ID** yarating (turi: Web application).
2. **Authorized JavaScript origins** ga `http://localhost:3000` qo'shing.
3. Serverni Client ID bilan ishga tushiring:
   ```bash
   set GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com && npm start
   ```
4. Login sahifasida "Google bilan davom etish" tugmasi paydo bo'ladi.

Client ID sozlanmagan bo'lsa tugma ko'rinmaydi — oddiy email/parol ishlayveradi.

## Muhit o'zgaruvchilari (ixtiyoriy)

- `PORT` — server porti (standart: 3000)
- `JWT_SECRET` — token kaliti (productionda albatta o'zgartiring)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — standart admin akkaunt
- `GOOGLE_CLIENT_ID` — Google orqali kirish uchun OAuth Client ID
