/**
 * Umumiy API klient — barcha sahifalar shu orqali server bilan gaplashadi.
 */
const Api = (() => {
  const TOKEN_KEY = 'cinema_token';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  async function request(path, { method = 'GET', body, authRequired = false } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authRequired || getToken()) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else if (authRequired) throw new ApiError('Avtorizatsiya talab qilinadi', 401);
    }

    let res;
    try {
      res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError('Serverga ulanib bo\'lmadi. Internet yoki server holatini tekshiring.', 0);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fallback = res.status >= 500
        ? `Server xatosi (${res.status}). Birozdan so'ng qayta urinib ko'ring.`
        : `So'rov bajarilmadi (${res.status}). Sahifani yangilab qayta urinib ko'ring.`;
      throw new ApiError(data.error || fallback, res.status);
    }
    return data;
  }

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  return {
    getToken, setToken, clearToken, ApiError,

    signup: (email, password) => request('/api/auth/signup', { method: 'POST', body: { email, password } }),
    login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
    googleConfig: () => request('/api/auth/google/config'),
    googleLogin: (credential) => request('/api/auth/google', { method: 'POST', body: { credential } }),
    me: () => request('/api/auth/me', { authRequired: true }),

    movies: () => request('/api/movies'),
    adminMovies: () => request('/api/admin/movies', { authRequired: true }),
    watch: (id) => request(`/api/movies/${id}/watch`, { authRequired: true }),
    addMovie: (movie) => request('/api/movies', { method: 'POST', body: movie, authRequired: true }),
    updateMovie: (id, movie) => request(`/api/movies/${id}`, { method: 'PUT', body: movie, authRequired: true }),
    deleteMovie: (id) => request(`/api/movies/${id}`, { method: 'DELETE', authRequired: true }),

    bookmarks: () => request('/api/bookmarks', { authRequired: true }),
    toggleBookmark: (movieId) => request(`/api/bookmarks/${movieId}`, { method: 'POST', authRequired: true }),

    purchases: () => request('/api/purchases', { authRequired: true }),
    purchaseHistory: () => request('/api/purchases/history', { authRequired: true }),
    purchase: (movieId, card) => request(`/api/purchases/${movieId}`, { method: 'POST', body: { card }, authRequired: true })
  };
})();

/** Toast xabarnoma — alert() o'rniga chiroyli bildirishnoma. */
function showToast(message, type = 'info') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-out'), 2600);
  setTimeout(() => toast.remove(), 3000);
}
