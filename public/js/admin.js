/** Admin panel: kino qo'shish, tahrirlash, o'chirish, qidirish. */
document.addEventListener('DOMContentLoaded', async () => {
  const guard = document.getElementById('guard-msg');
  const content = document.getElementById('admin-content');
  const form = document.getElementById('movie-form');
  const formError = document.getElementById('form-error');
  const listEl = document.getElementById('movie-list');
  const countEl = document.getElementById('movie-count');
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-edit');

  let movies = [];
  let searchQuery = '';

  // -------------------------------------------------------------------
  // Kirish nazorati
  // -------------------------------------------------------------------

  if (!Api.getToken()) {
    guard.textContent = 'Admin panelga kirish uchun avval tizimga kiring. Yo\'naltirilmoqda…';
    setTimeout(() => location.href = 'index.html', 1500);
    return;
  }

  try {
    const me = await Api.me();
    if (me.role !== 'admin') {
      guard.textContent = 'Bu sahifa faqat admin uchun. Yo\'naltirilmoqda…';
      setTimeout(() => location.href = 'main.html', 1500);
      return;
    }
  } catch {
    guard.textContent = 'Sessiya eskirgan. Qaytadan kiring…';
    Api.clearToken();
    setTimeout(() => location.href = 'index.html', 1500);
    return;
  }

  content.classList.remove('hidden');

  const fmtPrice = (p) => p ? String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so\'m' : 'Bepul';

  // -------------------------------------------------------------------
  // To'lovlar navbati
  // -------------------------------------------------------------------

  const paymentsList = document.getElementById('payments-list');
  const pendingCount = document.getElementById('pending-count');

  async function loadPayments() {
    const payments = await Api.adminPurchases();
    pendingCount.textContent = payments.filter(p => p.status === 'pending').length;
    paymentsList.innerHTML = '';

    if (payments.length === 0) {
      paymentsList.innerHTML = '<p class="empty-msg">Hozircha to\'lovlar yo\'q</p>';
      return;
    }

    payments.forEach(p => {
      const row = document.createElement('div');
      row.className = 'movie-row';

      const statusLabel = { pending: '⏳ Kutilmoqda', approved: '✅ Tasdiqlangan', rejected: '❌ Rad etilgan' }[p.status] || p.status;

      const info = document.createElement('div');
      info.className = 'movie-row-info';
      info.innerHTML = `
        <strong>${p.movie} — ${fmtPrice(p.price)}</strong>
        <span>${p.userEmail || 'foydalanuvchi #' + p.userId} · ${new Date(p.date).toLocaleString('uz-UZ')}</span>
        ${p.payerNote ? `<span>Izoh: ${p.payerNote}</span>` : ''}
        <span class="movie-row-tags">${statusLabel}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'movie-row-actions';

      if (p.status === 'pending') {
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn btn-primary btn-sm';
        okBtn.textContent = 'Tasdiqlash';
        okBtn.addEventListener('click', async () => {
          okBtn.disabled = true;
          try {
            await Api.approvePurchase(p.id);
            showToast('To\'lov tasdiqlandi — kino foydalanuvchiga ochildi', 'success');
            loadPayments();
          } catch (err) { showToast(err.message, 'error'); okBtn.disabled = false; }
        });

        const noBtn = document.createElement('button');
        noBtn.type = 'button';
        noBtn.className = 'btn btn-danger btn-sm';
        noBtn.textContent = 'Rad etish';
        noBtn.addEventListener('click', async () => {
          noBtn.disabled = true;
          try {
            await Api.rejectPurchase(p.id);
            showToast('To\'lov rad etildi', 'success');
            loadPayments();
          } catch (err) { showToast(err.message, 'error'); noBtn.disabled = false; }
        });

        actions.appendChild(okBtn);
        actions.appendChild(noBtn);
      }

      row.appendChild(info);
      row.appendChild(actions);
      paymentsList.appendChild(row);
    });
  }

  // Yangi to'lovlar kelganini ko'rish uchun har 15 soniyada yangilab turamiz
  setInterval(() => loadPayments().catch(() => {}), 15000);

  // -------------------------------------------------------------------
  // To'lov kartasi sozlamalari
  // -------------------------------------------------------------------

  const settingsForm = document.getElementById('settings-form');
  const settingsError = document.getElementById('settings-error');
  const cardInput = document.getElementById('s-card');

  cardInput.addEventListener('input', () => {
    const digits = cardInput.value.replace(/\D/g, '').slice(0, 16);
    cardInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  });

  async function loadSettings() {
    try {
      const s = await Api.adminSettings();
      cardInput.value = (s.cardNumber || '').replace(/(\d{4})(?=\d)/g, '$1 ');
      document.getElementById('s-owner').value = s.cardOwner || '';
    } catch { /* sozlamalar hali yo'q bo'lsa jim o'tamiz */ }
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    settingsError.textContent = '';
    const cardNumber = cardInput.value.replace(/\s/g, '');
    if (cardNumber && !/^\d{16}$/.test(cardNumber)) {
      settingsError.textContent = 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak';
      return;
    }
    try {
      await Api.saveSettings({ cardNumber, cardOwner: document.getElementById('s-owner').value.trim() });
      showToast('To\'lov kartasi saqlandi', 'success');
    } catch (err) {
      settingsError.textContent = err.message;
    }
  });

  // -------------------------------------------------------------------
  // Forma holati (qo'shish / tahrirlash)
  // -------------------------------------------------------------------

  function getFormData() {
    return {
      name: document.getElementById('m-name').value.trim(),
      genre: document.getElementById('m-genre').value,
      year: parseInt(document.getElementById('m-year').value, 10),
      limit: document.getElementById('m-limit').value,
      poster: document.getElementById('m-poster').value.trim(),
      trailer: document.getElementById('m-trailer').value.trim(),
      price: parseFloat(document.getElementById('m-price').value) || 0,
      trending: document.getElementById('m-trending').checked,
      top: document.getElementById('m-top').checked,
      popular: document.getElementById('m-popular').checked
    };
  }

  function validate(data) {
    const currentYear = new Date().getFullYear();
    if (!data.name) return 'Kino nomini kiriting';
    if (!Number.isInteger(data.year) || data.year < 1888 || data.year > currentYear + 5) {
      return `Yilni to'g'ri kiriting (1888–${currentYear + 5})`;
    }
    if (!/^https?:\/\/.+/i.test(data.poster)) return 'Poster URL http(s):// bilan boshlanishi kerak';
    if (data.trailer && !/^[\w-]{6,20}$/.test(data.trailer)) {
      return 'Treyler — YouTube video ID bo\'lishi kerak (masalan: YoHD9XEInc0)';
    }
    if (data.price < 0) return 'Narx manfiy bo\'lishi mumkin emas';
    return null;
  }

  function enterEditMode(movie) {
    document.getElementById('m-id').value = movie.id;
    document.getElementById('m-name').value = movie.name;
    document.getElementById('m-genre').value = movie.genre;
    document.getElementById('m-year').value = movie.year;
    document.getElementById('m-limit').value = movie.limit;
    document.getElementById('m-poster').value = movie.poster;
    document.getElementById('m-trailer').value = movie.trailer || '';
    document.getElementById('m-price').value = movie.price;
    document.getElementById('m-trending').checked = movie.trending;
    document.getElementById('m-top').checked = movie.top;
    document.getElementById('m-popular').checked = movie.popular;
    submitBtn.textContent = 'Saqlash';
    cancelBtn.classList.remove('hidden');
    document.getElementById('form-heading').textContent = `Tahrirlash: ${movie.name}`;
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function exitEditMode() {
    form.reset();
    document.getElementById('m-id').value = '';
    document.getElementById('m-price').value = '0';
    submitBtn.textContent = 'Kino qo\'shish';
    cancelBtn.classList.add('hidden');
    document.getElementById('form-heading').textContent = 'Yangi kino qo\'shish';
    formError.textContent = '';
  }

  cancelBtn.addEventListener('click', exitEditMode);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';

    const data = getFormData();
    const validationError = validate(data);
    if (validationError) { formError.textContent = validationError; return; }

    const editingId = document.getElementById('m-id').value;
    submitBtn.disabled = true;
    try {
      if (editingId) {
        await Api.updateMovie(Number(editingId), data);
        showToast('Kino yangilandi', 'success');
      } else {
        await Api.addMovie(data);
        showToast('Kino qo\'shildi', 'success');
      }
      exitEditMode();
      await loadMovies();
    } catch (err) {
      formError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  // -------------------------------------------------------------------
  // Ro'yxat
  // -------------------------------------------------------------------

  document.getElementById('admin-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderList();
  });

  function renderList() {
    const visible = searchQuery
      ? movies.filter(m => m.name.toLowerCase().includes(searchQuery) || String(m.year).includes(searchQuery))
      : movies;

    countEl.textContent = movies.length;
    listEl.innerHTML = '';

    if (visible.length === 0) {
      listEl.innerHTML = '<p class="empty-msg">Hech narsa topilmadi</p>';
      return;
    }

    visible.forEach(movie => {
      const row = document.createElement('div');
      row.className = 'movie-row';

      const img = document.createElement('img');
      img.className = 'movie-row-thumb';
      img.src = movie.poster;
      img.alt = movie.name;
      img.loading = 'lazy';

      const info = document.createElement('div');
      info.className = 'movie-row-info';
      const tags = [movie.trending && 'Trend', movie.top && 'Top', movie.popular && 'Mashhur']
        .filter(Boolean).join(' · ') || '—';
      info.innerHTML = `
        <strong>${movie.name}</strong>
        <span>${movie.year} · ${movie.genre} · ${movie.limit} · ${fmtPrice(movie.price)}</span>
        <span class="movie-row-tags">${tags}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'movie-row-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-ghost btn-sm';
      editBtn.textContent = 'Tahrirlash';
      editBtn.addEventListener('click', () => enterEditMode(movie));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = 'O\'chirish';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`«${movie.name}» o'chirilsinmi?`)) return;
        delBtn.disabled = true;
        try {
          await Api.deleteMovie(movie.id);
          showToast('Kino o\'chirildi', 'success');
          await loadMovies();
        } catch (err) {
          showToast(err.message, 'error');
          delBtn.disabled = false;
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  async function loadMovies() {
    movies = await Api.adminMovies();
    renderList();
  }

  await Promise.all([loadMovies(), loadPayments(), loadSettings()]);
});
