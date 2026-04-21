import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401 handler — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isAuthPage = ['/login', '/register', '/accept-invite'].some(p => window.location.pathname.includes(p));
      if (!isAuthPage) {
        localStorage.removeItem('tf_token');
        localStorage.removeItem('tf_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
