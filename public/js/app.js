/** Bosh sahifa: kinolar, qidiruv, filtr, saqlash, ko'rish (treyler) va sotib olish. */
document.addEventListener('DOMContentLoaded', async () => {
  const FALLBACK_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="470" height="230"><rect width="100%" height="100%" fill="#232839"/><text x="50%" y="50%" fill="#5A698F" font-family="sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Rasm yo\'q</text></svg>'
  );

  const state = {
    movies: [],
    bookmarks: new Set(),
    purchases: new Set(),
    query: '',
    filter: 'all' // all | movie | series | bookmarks
  };

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

  document.getElementById('logout-btn').addEventListener('click', () => {
    Api.clearToken();
    location.href = 'index.html';
  });

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

  function luhnValid(number) {
    const digits = number.split('').reverse().map(Number);
    const sum = digits.reduce((acc, d, i) => {
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      return acc + d;
    }, 0);
    return sum % 10 === 0;
  }

  function renderPurchaseUI(movie) {
    showPoster(movie);
    modalActions.innerHTML = `
      <form id="checkout-form" class="checkout" novalidate>
        <p class="purchase-note">Bu kino pullik — narxi <strong>$${movie.price.toFixed(2)}</strong>. Karta ma'lumotlarini kiriting:</p>
        <div class="checkout-grid">
          <div class="field field-wide">
            <label for="cc-number">Karta raqami</label>
            <input type="text" id="cc-number" inputmode="numeric" placeholder="8600 0000 0000 0000" maxlength="19" autocomplete="cc-number">
          </div>
          <div class="field">
            <label for="cc-expiry">Muddati (MM/YY)</label>
            <input type="text" id="cc-expiry" inputmode="numeric" placeholder="12/27" maxlength="5" autocomplete="cc-exp">
          </div>
          <div class="field">
            <label for="cc-cvc">CVC</label>
            <input type="text" id="cc-cvc" inputmode="numeric" placeholder="123" maxlength="4" autocomplete="cc-csc">
          </div>
          <div class="field field-wide">
            <label for="cc-holder">Karta egasi</label>
            <input type="text" id="cc-holder" placeholder="ISM FAMILIYA" autocomplete="cc-name">
          </div>
        </div>
        <p id="checkout-error" class="form-error" role="alert"></p>
        <button type="submit" class="btn btn-primary btn-block">To'lash — $${movie.price.toFixed(2)}</button>
      </form>`;

    const numberEl = document.getElementById('cc-number');
    const expiryEl = document.getElementById('cc-expiry');
    const form = document.getElementById('checkout-form');
    const errEl = document.getElementById('checkout-error');

    // Karta raqamini 4 talik guruhlarga formatlash
    numberEl.addEventListener('input', () => {
      const digits = numberEl.value.replace(/\D/g, '').slice(0, 16);
      numberEl.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    });

    // MM/YY avtomatik "/" qo'yish
    expiryEl.addEventListener('input', () => {
      let v = expiryEl.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
      expiryEl.value = v;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '';

      const card = {
        number: numberEl.value.replace(/\s/g, ''),
        expiry: expiryEl.value.trim(),
        cvc: document.getElementById('cc-cvc').value.trim(),
        holder: document.getElementById('cc-holder').value.trim()
      };

      if (!/^\d{16}$/.test(card.number)) { errEl.textContent = 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak'; return; }
      if (!luhnValid(card.number)) { errEl.textContent = 'Karta raqami noto\'g\'ri — qayta tekshiring'; return; }
      if (!/^\d{2}\/\d{2}$/.test(card.expiry)) { errEl.textContent = 'Muddat MM/YY ko\'rinishida bo\'lishi kerak'; return; }
      if (!/^\d{3,4}$/.test(card.cvc)) { errEl.textContent = 'CVC 3–4 raqam'; return; }
      if (card.holder.length < 3) { errEl.textContent = 'Karta egasining ismini kiriting'; return; }

      const payBtn = form.querySelector('button[type="submit"]');
      payBtn.disabled = true;
      payBtn.classList.add('btn-loading');
      try {
        const { receipt } = await Api.purchase(movie.id, card);
        state.purchases.add(movie.id);
        showToast(`To'lov qabul qilindi: ${receipt.brand} •••• ${receipt.last4} — $${receipt.price.toFixed(2)} (${receipt.receiptId})`, 'success');
        render();
        await playMovie(movie);
      } catch (err) {
        errEl.textContent = err.message;
        payBtn.disabled = false;
        payBtn.classList.remove('btn-loading');
      }
    });
  }

  function openModal(movie) {
    modalTitle.textContent = movie.name;
    modalMeta.innerHTML = `<span>${movie.year}</span><span class="dot" aria-hidden="true"></span><span>${movie.genre}</span><span class="dot" aria-hidden="true"></span><span>${movie.limit}</span><span class="dot" aria-hidden="true"></span><span>${movie.price ? '$' + movie.price.toFixed(2) : 'Bepul'}</span>`;
    modal.classList.remove('hidden');

    const needsPurchase = movie.price > 0 && !state.purchases.has(movie.id);
    if (needsPurchase) renderPurchaseUI(movie);
    else { showPoster(movie); playMovie(movie); }
  }

  // ---------------------------------------------------------------------
  // Kartalar
  // ---------------------------------------------------------------------

  function priceBadge(movie) {
    const badge = document.createElement('span');
    if (movie.price && state.purchases.has(movie.id)) {
      badge.className = 'badge badge-owned';
      badge.textContent = 'Sotib olingan';
    } else if (movie.price) {
      badge.className = 'badge badge-paid';
      badge.textContent = `$${movie.price.toFixed(2)}`;
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
    p.innerHTML = `<span>${movie.year}</span><span class="dot" aria-hidden="true"></span><span>${movie.genre}</span><span class="dot" aria-hidden="true"></span><span>${movie.limit}</span>`;
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

  function render() {
    const visible = state.movies.filter(matchesFilter);
    fillSection('trending-row', visible.filter(m => m.trending), trendingCard);
    fillSection('top-grid', visible.filter(m => m.top), gridCard);
    fillSection('popular-grid', visible.filter(m => m.popular), gridCard);
    fillSection('all-grid', visible, gridCard);
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

  // ---------------------------------------------------------------------
  // Boshlang'ich yuklash
  // ---------------------------------------------------------------------

  try {
    const [movies, bookmarks, purchases] = await Promise.all([
      Api.movies(),
      Api.bookmarks().catch(() => []),
      Api.purchases().catch(() => [])
    ]);
    state.movies = movies;
    state.bookmarks = new Set(bookmarks);
    state.purchases = new Set(purchases);
    render();
  } catch (err) {
    document.getElementById('all-grid').innerHTML =
      `<p class="empty-msg">${err.message}</p>`;
  }
});
