/** Kirish / Ro'yxatdan o'tish sahifasi mantiqi. */
document.addEventListener('DOMContentLoaded', () => {
  const loginBox = document.getElementById('login-box');
  const signupBox = document.getElementById('signup-box');

  // ------ Google orqali kirish (GOOGLE_CLIENT_ID sozlangan bo'lsa) ------

  async function initGoogle(attempt = 0) {
    let clientId = '';
    try {
      ({ clientId } = await Api.googleConfig());
    } catch { /* server javob bermasa Google tugmasi shunchaki chiqmaydi */ }

    if (!clientId) return; // sozlanmagan — tugma ko'rsatilmaydi

    // GIS skripti hali yuklanmagan bo'lishi mumkin — biroz kutamiz
    if (!window.google?.accounts?.id) {
      if (attempt < 20) setTimeout(() => initGoogle(attempt + 1), 250);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const { token } = await Api.googleLogin(response.credential);
          Api.setToken(token);
          location.href = 'main.html';
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    ['google-btn-login', 'google-btn-signup'].forEach(id => {
      const host = document.getElementById(id);
      if (host) {
        window.google.accounts.id.renderButton(host, {
          theme: 'filled_black', size: 'large', width: 330, text: 'continue_with', locale: 'uz'
        });
        host.closest('.google-slot')?.classList.add('active');
      }
    });
  }

  initGoogle();

  document.getElementById('show-signup').addEventListener('click', () => {
    loginBox.classList.add('hidden');
    signupBox.classList.remove('hidden');
  });
  document.getElementById('show-login').addEventListener('click', () => {
    signupBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
  });

  function setLoading(form, loading) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = loading;
    btn.classList.toggle('btn-loading', loading);
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = document.getElementById('login-error');
    error.textContent = '';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!/^\S+@\S+\.\S+$/.test(email)) { error.textContent = 'Email formati noto\'g\'ri'; return; }
    if (password.length < 6) { error.textContent = 'Parol kamida 6 belgidan iborat'; return; }

    setLoading(e.target, true);
    try {
      const { token } = await Api.login(email, password);
      Api.setToken(token);
      location.href = 'main.html';
    } catch (err) {
      error.textContent = err.message;
    } finally {
      setLoading(e.target, false);
    }
  });

  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = document.getElementById('signup-error');
    error.textContent = '';

    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!/^\S+@\S+\.\S+$/.test(email)) { error.textContent = 'Email formati noto\'g\'ri'; return; }
    if (password.length < 6) { error.textContent = 'Parol kamida 6 belgidan iborat'; return; }
    if (password !== confirm) { error.textContent = 'Parollar mos kelmadi'; return; }

    setLoading(e.target, true);
    try {
      const { token } = await Api.signup(email, password);
      Api.setToken(token);
      location.href = 'main.html';
    } catch (err) {
      error.textContent = err.message;
    } finally {
      setLoading(e.target, false);
    }
  });
});
