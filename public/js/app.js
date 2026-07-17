/** Bosh sahifa: kinolar, qidiruv, filtr, saqlash, ko'rish (treyler) va sotib olish. */
document.addEventListener('DOMContentLoaded', async () => {
  const FALLBACK_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="470" height="230"><rect width="100%" height="100%" fill="#232839"/><text x="50%" y="50%" fill="#5A698F" font-family="sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Rasm yo\'q</text></svg>'
  );

  const state = {
    movies: [],
    bookmarks: new Set(),
    purchases: new Set(),   // tasdiqlangan xaridlar
    pending: new Set(),     // tekshirilayotgan to'lovlar
    query: '',
    filter: 'all', // all | movie | series | bookmarks
    sort: 'new'    // new | old | rating | name
  };

  // 13000 -> "13 000 so'm"
  const fmtPrice = (p) => p ? String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so\'m' : 'Bepul';

  // ---------------------------------------------------------------------
  // Kirish majburiy — token yo'q yoki yaroqsiz bo'lsa, login sahifasiga
  // ---------------------------------------------------------------------

  if (!Api.getToken()) {
    location.replace('index.html');
    return;
  }

  let me;
  try {
    me = await Api.me();
  } catch {
    Api.clearToken();
    location.replace('index.html');
    return;
  }

  if (me.role === 'admin') document.getElementById('admin-link').classList.remove('hidden');

  // Sidebar avatarida email bosh harfi ko'rinadi, bosilsa profilga o'tadi
  document.getElementById('avatar-initial').textContent = (me.email || '?')[0].toUpperCase();

  // ---------------------------------------------------------------------
  // Scroll-reveal animatsiya
  // ---------------------------------------------------------------------

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' })
    : null;

  function observe(el) {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add('in-view');
  }

  // ---------------------------------------------------------------------
  // Ko'rish modali
  // ---------------------------------------------------------------------

  const modal = document.getElementById('watch-modal');
  const modalPlayer = document.getElementById('modal-player');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalActions = document.getElementById('modal-actions');

  function closeModal() {
    modal.classList.add('hidden');
    modalPlayer.innerHTML = ''; // videoni to'xtatish uchun iframe olib tashlanadi
    modalActions.innerHTML = '';
  }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  function showPoster(movie) {
    modalPlayer.innerHTML = '';
    const img = document.createElement('img');
    img.src = movie.poster || FALLBACK_POSTER;
    img.alt = movie.name;
    img.className = 'modal-poster';
    modalPlayer.appendChild(img);
  }

  async function playMovie(movie) {
    try {
      const { trailer } = await Api.watch(movie.id);
      modalActions.innerHTML = '';
      modalPlayer.innerHTML = `
        <iframe
          src="https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&rel=0"
          title="${movie.name} — treyler"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
    } catch (err) {
      if (err.status === 402) {
        renderPurchaseUI(movie);
      } else {
        showToast(err.message, 'error');
      }
    }
  }

  function renderPendingUI(movie) {
    showPoster(movie);
    modalActions.innerHTML = `
      <div class="pending-box">
        <p class="purchase-note">⏳ To'lovingiz tekshirilmoqda. Admin tasdiqlagach «${movie.name}» avtomatik ochiladi — birozdan so'ng qayta urinib ko'ring.</p>
      </div>`;
  }

  async function renderPurchaseUI(movie) {
    showPoster(movie);
    modalActions.innerHTML = '<p class="purchase-note">Yuklanmoqda…</p>';

    // Payme yoqilganmi? (avtomatik to'lov)
    let paymeEnabled = false;
    try { paymeEnabled = (await Api.paymeConfig()).enabled; } catch {}

    let card;
    try {
      card = await Api.paymentCard();
    } catch (err) {
      // Payme bor bo'lsa, karta sozlanmagan bo'lsa ham to'lash mumkin
      if (!paymeEnabled) {
        modalActions.innerHTML = `<p class="form-error">${err.message}</p>`;
        return;
      }
      card = null;
    }

    // --- Payme bloki (avtomatik) ---
    const paymeBlock = paymeEnabled ? `
      <div class="payme-box">
        <p class="purchase-note">Bu kino pullik — narxi <strong>${fmtPrice(movie.price)}</strong>.
        Payme orqali to'lang — to'lov tasdiqlanishi bilan kino <strong>avtomatik</strong> ochiladi:</p>
        <button type="button" class="btn btn-payme btn-block" id="payme-btn">Payme orqali to'lash — ${fmtPrice(movie.price)}</button>
        <p id="payme-error" class="form-error" role="alert"></p>
      </div>` : '';

    // Karta sozlanmagan bo'lsa (faqat Payme) — p2p blokini ko'rsatmaymiz
    if (!card) {
      modalActions.innerHTML = paymeBlock;
      attachPaymeHandler(movie);
      return;
    }

    const orDivider = paymeEnabled ? '<div class="pay-divider"><span>yoki kartaga o\'tkazma</span></div>' : '';
    const prettyCard = card.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
    modalActions.innerHTML = paymeBlock + orDivider + `
      <div class="p2p-box">
        ${paymeEnabled ? '' : `<p class="purchase-note">Bu kino pullik — narxi <strong>${fmtPrice(movie.price)}</strong>.</p>`}
        <p class="purchase-note">Quyidagi kartaga <strong>${fmtPrice(movie.price)}</strong> o'tkazing, so'ng «To'lov qildim» tugmasini bosing:</p>
        <div class="p2p-card">
          <span class="p2p-number" id="p2p-number">${prettyCard}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="copy-card">Nusxa olish</button>
        </div>
        ${card.cardOwner ? `<p class="p2p-owner">Karta egasi: <strong>${card.cardOwner}</strong></p>` : ''}
        <div class="field field-wide">
          <label for="payer-note">Izoh (ixtiyoriy — qaysi raqamdan o'tkazdingiz?)</label>
          <input type="text" id="payer-note" placeholder="Masalan: 90 123 45 67 raqamidan o'tkazdim" maxlength="120">
        </div>
        <p id="checkout-error" class="form-error" role="alert"></p>
        <button type="button" class="btn btn-primary btn-block" id="paid-btn">✓ To'lov qildim — ${fmtPrice(movie.price)}</button>
      </div>`;

    document.getElementById('copy-card').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(card.cardNumber);
        showToast('Karta raqami nusxalandi', 'success');
      } catch {
        showToast('Nusxalab bo\'lmadi — raqamni qo\'lda kiriting', 'error');
      }
    });

    document.getElementById('paid-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add('btn-loading');
      try {
        await Api.purchase(movie.id, document.getElementById('payer-note').value.trim());
        state.pending.add(movie.id);
        showToast('To\'lov qayd etildi — admin tasdiqlagach kino ochiladi', 'success');
        render();
        renderPendingUI(movie);
      } catch (err) {
        document.getElementById('checkout-error').textContent = err.message;
        btn.disabled = false;
        btn.classList.remove('btn-loading');
      }
    });

    attachPaymeHandler(movie);
  }

  // Payme tugmasi: checkout havolasini olib, Payme sahifasiga yo'naltiramiz
  function attachPaymeHandler(movie) {
    const paymeBtn = document.getElementById('payme-btn');
    if (!paymeBtn) return;
    paymeBtn.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add('btn-loading');
      try {
        const { url } = await Api.payWithPayme(movie.id);
        window.location.href = url; // Payme to'lov sahifasiga o'tamiz
      } catch (err) {
        document.getElementById('payme-error').textContent = err.message;
        btn.disabled = false;
        btn.classList.remove('btn-loading');
      }
    });
  }

  function openModal(movie) {
    modalTitle.textContent = movie.name;
    modalMeta.innerHTML = `<span>${movie.year}</span><span class="dot" aria-hidden="true"></span><span>${movie.genre}</span><span class="dot" aria-hidden="true"></span><span>${movie.limit}</span>` +
      (movie.rating ? `<span class="dot" aria-hidden="true"></span><span class="rating-chip">★ ${Number(movie.rating).toFixed(1)}</span>` : '') +
      `<span class="dot" aria-hidden="true"></span><span>${fmtPrice(movie.price)}</span>`;
    modal.classList.remove('hidden');

    if (movie.price > 0 && !state.purchases.has(movie.id)) {
      if (state.pending.has(movie.id)) renderPendingUI(movie);
      else renderPurchaseUI(movie);
    } else {
      showPoster(movie);
      playMovie(movie);
    }
  }

  // ---------------------------------------------------------------------
  // Kartalar
  // ---------------------------------------------------------------------

  function priceBadge(movie) {
    const badge = document.createElement('span');
    if (movie.price && state.purchases.has(movie.id)) {
      badge.className = 'badge badge-owned';
      badge.textContent = 'Sotib olingan';
    } else if (movie.price && state.pending.has(movie.id)) {
      badge.className = 'badge badge-pending';
      badge.textContent = 'Tekshirilmoqda';
    } else if (movie.price) {
      badge.className = 'badge badge-paid';
      badge.textContent = fmtPrice(movie.price);
    } else {
      badge.className = 'badge badge-free';
      badge.textContent = 'Bepul';
    }
    return badge;
  }

  function bookmarkBtn(movie) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bookmark-btn';
    const update = () => {
      const active = state.bookmarks.has(movie.id);
      btn.classList.toggle('active', active);
      btn.title = active ? 'Saqlanganlardan olib tashlash' : 'Saqlash';
      btn.setAttribute('aria-label', btn.title);
      btn.innerHTML = active
        ? '<svg width="12" height="14" viewBox="0 0 12 14" xmlns="http://www.w3.org/2000/svg"><path d="M1 1H11V13L6 9.5L1 13V1Z" fill="white" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>'
        : '<svg width="12" height="14" viewBox="0 0 12 14" xmlns="http://www.w3.org/2000/svg"><path d="M1 1H11V13L6 9.5L1 13V1Z" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    };
    update();
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const { bookmarked } = await Api.toggleBookmark(movie.id);
        if (bookmarked) state.bookmarks.add(movie.id);
        else state.bookmarks.delete(movie.id);
        update();
        if (state.filter === 'bookmarks') render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    return btn;
  }

  function posterImg(movie, wrapClass) {
    const wrap = document.createElement('div');
    wrap.className = `poster-wrap shimmer ${wrapClass || ''}`;
    const img = document.createElement('img');
    img.src = movie.poster || FALLBACK_POSTER;
    img.alt = movie.name;
    img.loading = 'lazy';
    img.onerror = () => { img.src = FALLBACK_POSTER; };
    img.onload = () => wrap.classList.remove('shimmer');
    wrap.appendChild(img);
    return wrap;
  }

  function metaLine(movie) {
    const p = document.createElement('p');
    p.className = 'card-meta';
    p.innerHTML = `<span>${movie.year}</span><span class="dot" aria-hidden="true"></span><span>${movie.genre}</span><span class="dot" aria-hidden="true"></span><span>${movie.limit}</span>` +
      (movie.rating ? `<span class="dot" aria-hidden="true"></span><span class="rating-chip">★ ${Number(movie.rating).toFixed(1)}</span>` : '');
    return p;
  }

  function trendingCard(movie, i) {
    const card = document.createElement('article');
    card.className = 'trending-card reveal';
    card.style.animationDelay = `${(i % 6) * 70}ms`;

    const wrap = posterImg(movie, 'trending-poster');
    wrap.appendChild(priceBadge(movie));
    wrap.appendChild(bookmarkBtn(movie));

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'play-btn';
    play.innerHTML = '<svg width="26" height="26" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 15C0 6.7125 6.7125 0 15 0C23.2875 0 30 6.7125 30 15C30 23.2875 23.2875 30 15 30C6.7125 30 0 23.2875 0 15ZM21 14.5L12 8V21L21 14.5Z" fill="white"/></svg><span>Ko\'rish</span>';
    play.addEventListener('click', () => openModal(movie));
    wrap.appendChild(play);

    const info = document.createElement('div');
    info.className = 'trending-info';
    info.appendChild(metaLine(movie));
    const title = document.createElement('h3');
    title.textContent = movie.name;
    info.appendChild(title);
    wrap.appendChild(info);

    card.appendChild(wrap);
    observe(card);
    return card;
  }

  function gridCard(movie, i) {
    const card = document.createElement('article');
    card.className = 'grid-card reveal';
    card.style.animationDelay = `${(i % 8) * 50}ms`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${movie.name} — ko'rish`);

    const wrap = posterImg(movie, 'grid-poster');
    wrap.appendChild(priceBadge(movie));
    wrap.appendChild(bookmarkBtn(movie));

    const playHint = document.createElement('span');
    playHint.className = 'grid-play-hint';
    playHint.innerHTML = '<svg width="34" height="34" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 15C0 6.7125 6.7125 0 15 0C23.2875 0 30 6.7125 30 15C30 23.2875 23.2875 30 15 30C6.7125 30 0 23.2875 0 15ZM21 14.5L12 8V21L21 14.5Z" fill="white"/></svg>';
    wrap.appendChild(playHint);

    card.appendChild(wrap);
    card.appendChild(metaLine(movie));
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = movie.name;
    card.appendChild(title);

    card.addEventListener('click', () => openModal(movie));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(movie); }
    });

    observe(card);
    return card;
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  function matchesFilter(movie) {
    if (state.filter === 'movie' && movie.genre !== 'Movie') return false;
    if (state.filter === 'series' && movie.genre !== 'TV Series') return false;
    if (state.filter === 'bookmarks' && !state.bookmarks.has(movie.id)) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      return movie.name.toLowerCase().includes(q) || String(movie.year).includes(q);
    }
    return true;
  }

  function fillSection(containerId, items, factory) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-msg">Hech narsa topilmadi</p>';
      return;
    }
    items.forEach((m, i) => container.appendChild(factory(m, i)));
  }

  const SORTERS = {
    new: (a, b) => b.year - a.year || (b.rating || 0) - (a.rating || 0),
    old: (a, b) => a.year - b.year || (b.rating || 0) - (a.rating || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.year - a.year,
    name: (a, b) => a.name.localeCompare(b.name)
  };

  function render() {
    const visible = state.movies.filter(matchesFilter);
    fillSection('trending-row', visible.filter(m => m.trending), trendingCard);
    // Top reyting — reyting bo'yicha, Mashhur — yangilik bo'yicha
    fillSection('top-grid', visible.filter(m => m.top).sort(SORTERS.rating), gridCard);
    fillSection('popular-grid', visible.filter(m => m.popular).sort(SORTERS.new), gridCard);
    // Barcha kinolar — tanlangan saralash bo'yicha (standart: yangi -> eski)
    fillSection('all-grid', [...visible].sort(SORTERS[state.sort] || SORTERS.new), gridCard);
  }

  // ---------------------------------------------------------------------
  // Qidiruv va filtrlar
  // ---------------------------------------------------------------------

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    render();
  });

  const filterButtons = {
    'filter-movies': 'movie',
    'filter-series': 'series',
    'filter-bookmarks': 'bookmarks'
  };
  Object.entries(filterButtons).forEach(([id, filter]) => {
    document.getElementById(id).addEventListener('click', (e) => {
      const alreadyActive = state.filter === filter;
      state.filter = alreadyActive ? 'all' : filter;
      document.querySelectorAll('.sidebar-nav .nav-icon').forEach(el => el.classList.remove('active'));
      if (!alreadyActive) e.currentTarget.classList.add('active');
      else document.querySelector('.sidebar-nav a[href="main.html"]').classList.add('active');
      render();
    });
  });

  // Saralash chiplari ("Barcha kinolar" bo'limi uchun)
  document.querySelectorAll('.sort-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.sort = chip.dataset.sort;
      document.querySelectorAll('.sort-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      render();
    });
  });

  // ---------------------------------------------------------------------
  // Boshlang'ich yuklash
  // ---------------------------------------------------------------------

  try {
    const [movies, bookmarks, purchases] = await Promise.all([
      Api.movies(),
      Api.bookmarks().catch(() => []),
      Api.purchases().catch(() => ({ owned: [], pending: [] }))
    ]);
    state.movies = movies;
    state.bookmarks = new Set(bookmarks);
    state.purchases = new Set(purchases.owned);
    state.pending = new Set(purchases.pending);
    render();

    // Profil sahifasidan "#movie-ID" bilan kelingan bo'lsa — o'sha kinoni ochamiz
    const hashMatch = location.hash.match(/^#movie-(\d+)$/);
    if (hashMatch) {
      const target = state.movies.find(m => m.id === Number(hashMatch[1]));
      history.replaceState(null, '', location.pathname); // hash qayta ochilmasin
      if (target) openModal(target);
    }
  } catch (err) {
    document.getElementById('all-grid').innerHTML =
      `<p class="empty-msg">${err.message}</p>`;
  }
});
