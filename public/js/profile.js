/** Profil sahifasi: shaxsiy ma'lumot, statistika, saqlangan/sotib olingan kinolar, parol. */
document.addEventListener('DOMContentLoaded', async () => {
  const guard = document.getElementById('guard-msg');
  const content = document.getElementById('profile-content');

  if (!Api.getToken()) {
    guard.textContent = 'Profilni ko\'rish uchun avval tizimga kiring. Yo\'naltirilmoqda…';
    setTimeout(() => location.href = 'index.html', 1200);
    return;
  }

  const fmtPrice = (p) => p ? String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so\'m' : '0 so\'m';

  // ------------------------------------------------------------------
  // Profil ma'lumotlari
  // ------------------------------------------------------------------

  let profile;
  try {
    profile = await Api.profile();
  } catch {
    Api.clearToken();
    guard.textContent = 'Sessiya eskirgan. Qaytadan kiring…';
    setTimeout(() => location.href = 'index.html', 1200);
    return;
  }

  content.classList.remove('hidden');

  document.getElementById('p-avatar').textContent = (profile.name || profile.email)[0].toUpperCase();
  document.getElementById('p-email').textContent = profile.name || profile.email;
  document.getElementById('p-provider').textContent =
    (profile.name ? profile.email + ' · ' : '') + (profile.provider === 'google' ? 'Google orqali kirgan' : 'Email orqali kirgan');

  const roleEl = document.getElementById('p-role');
  if (profile.role === 'admin') {
    roleEl.className = 'role-badge role-admin';
    roleEl.textContent = '👑 Admin';
    document.getElementById('p-admin-link').classList.remove('hidden');
  }

  document.getElementById('stat-bookmarks').textContent = profile.bookmarkCount + ' ta';
  document.getElementById('stat-owned').textContent = profile.ownedCount + ' ta';
  document.getElementById('stat-pending').textContent = profile.pendingCount + ' ta';
  document.getElementById('stat-spent').textContent = fmtPrice(profile.totalSpent);

  document.getElementById('logout-btn').addEventListener('click', () => {
    Api.clearToken();
    location.href = 'index.html';
  });

  // ------------------------------------------------------------------
  // Kinolar: saqlanganlar va sotib olinganlar
  // ------------------------------------------------------------------

  const FALLBACK_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#232839"/><text x="50%" y="50%" fill="#5A698F" font-family="sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Rasm yo\'q</text></svg>'
  );

  function movieCard(movie, badgeText, badgeClass) {
    const card = document.createElement('a');
    card.className = 'profile-card';
    card.href = `main.html#movie-${movie.id}`;
    card.setAttribute('aria-label', `${movie.name} — ochish`);

    const wrap = document.createElement('div');
    wrap.className = 'poster-wrap profile-poster';
    const img = document.createElement('img');
    img.src = movie.poster || FALLBACK_POSTER;
    img.alt = movie.name;
    img.loading = 'lazy';
    img.onerror = () => { img.src = FALLBACK_POSTER; };
    wrap.appendChild(img);

    if (badgeText) {
      const badge = document.createElement('span');
      badge.className = `badge ${badgeClass}`;
      badge.textContent = badgeText;
      wrap.appendChild(badge);
    }

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = movie.name;

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.innerHTML = `<span>${movie.year}</span><span class="dot" aria-hidden="true"></span><span>${movie.genre}</span>` +
      (movie.rating ? `<span class="dot" aria-hidden="true"></span><span class="rating-chip">★ ${movie.rating.toFixed(1)}</span>` : '');

    card.appendChild(wrap);
    card.appendChild(title);
    card.appendChild(meta);
    return card;
  }

  function fillGrid(id, items, factory) {
    const grid = document.getElementById(id);
    grid.innerHTML = '';
    if (items.length === 0) {
      grid.innerHTML = '<p class="empty-msg">Hozircha bo\'sh — bosh sahifadan kino tanlang</p>';
      return;
    }
    items.forEach(m => grid.appendChild(factory(m)));
  }

  try {
    const [movies, bookmarks, purchases] = await Promise.all([
      Api.movies(),
      Api.bookmarks().catch(() => []),
      Api.purchases().catch(() => ({ owned: [], pending: [] }))
    ]);
    const byId = new Map(movies.map(m => [m.id, m]));
    const savedSet = new Set(bookmarks);
    const ownedSet = new Set(purchases.owned);
    const pendingSet = new Set(purchases.pending);

    const owned = [...ownedSet, ...pendingSet].map(id => byId.get(id)).filter(Boolean);
    const saved = [...savedSet].map(id => byId.get(id)).filter(Boolean);

    document.getElementById('owned-count').textContent = owned.length;
    document.getElementById('saved-count').textContent = saved.length;

    fillGrid('owned-grid', owned, m => movieCard(
      m,
      pendingSet.has(m.id) ? 'Tekshirilmoqda' : 'Sotib olingan',
      pendingSet.has(m.id) ? 'badge-pending' : 'badge-owned'
    ));
    fillGrid('saved-grid', saved, m => movieCard(m, null, ''));
  } catch (err) {
    showToast(err.message, 'error');
  }

  // ------------------------------------------------------------------
  // Parol o'zgartirish (Google orqali kirganlarga ko'rsatilmaydi)
  // ------------------------------------------------------------------

  if (profile.provider === 'google') {
    document.getElementById('password-panel').classList.add('hidden');
  } else {
    const form = document.getElementById('password-form');
    const errEl = document.getElementById('password-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '';

      const current = document.getElementById('pw-current').value;
      const next = document.getElementById('pw-next').value;
      const confirm = document.getElementById('pw-confirm').value;

      if (next.length < 6) { errEl.textContent = 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak'; return; }
      if (next !== confirm) { errEl.textContent = 'Yangi parollar mos kelmadi'; return; }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.classList.add('btn-loading');
      try {
        await Api.changePassword(current, next);
        form.reset();
        showToast('Parol muvaffaqiyatli yangilandi', 'success');
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.classList.remove('btn-loading');
      }
    });
  }
});
