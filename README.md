# Cinema

Filmlar va seriallar katalogi — Express backend, JWT autentifikatsiya, admin panel, haqiqiy to'lov (karta-ga-karta) va animatsiyali frontend.

## Ishga tushirish (lokal)

```bash
npm install
npm start
```

Brauzerda: **http://localhost:3000** · Admin: `admin@cinema.uz` / `Admin123!`

## To'lov — pul kartangizga tushadi

Pullik kinolar narxi **13 000 so'm**:

1. Foydalanuvchi pullik kinoni ochadi → unga sizning karta raqamingiz va summa ko'rsatiladi.
2. U Click/Payme/bank ilovasi orqali pul o'tkazib, «To'lov qildim» tugmasini bosadi.
3. Admin paneldagi **To'lovlar** bo'limida so'rov chiqadi — pulni tekshirib **Tasdiqlash** bosasiz.
4. Kino foydalanuvchiga ochiladi.

Karta raqami admin panelda yoki `PAYMENT_CARD_NUMBER`/`PAYMENT_CARD_OWNER` env orqali sozlanadi — kodda saqlanmaydi.

## Deploy (Render.com — bepul)

1. [render.com](https://render.com) da GitHub bilan ro'yxatdan o'ting.
2. **New + → Blueprint** → `davronumrzoqov/Cinema` repo'sini tanlang (`render.yaml` avtomatik o'qiladi).
3. Env qiymatlarini kiriting: `ADMIN_PASSWORD` (kuchli parol!), `PAYMENT_CARD_NUMBER`, `PAYMENT_CARD_OWNER`.
4. **Apply** — 2-3 daqiqada sayt `https://cinema-XXXX.onrender.com` da jonli bo'ladi.

> Bepul tarifda: 15 daqiqa harakatsizlikdan keyin server uxlaydi (birinchi ochilish ~30s),
> `db.json` qayta deploy'da tozalanadi. Doimiy saqlash: Render Starter + Persistent Disk yoki Railway.

## Muhit o'zgaruvchilari

`PORT`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PAYMENT_CARD_NUMBER`, `PAYMENT_CARD_OWNER`, `GOOGLE_CLIENT_ID` (ixtiyoriy — Google login).
