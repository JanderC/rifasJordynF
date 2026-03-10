import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Adjuntar token en cada request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('jordyn_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Manejar 401 global (token expirado)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jordyn_token');
      localStorage.removeItem('jordyn_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default API;