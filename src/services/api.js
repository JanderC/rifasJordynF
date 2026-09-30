import axios from 'axios';
import { LOGIN_PATH } from '../config/rutas';

const API = axios.create({
  baseURL: 'https://rifasjordynb-production.up.railway.app/api',
});

// Adjuntar token en cada request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('jordyn_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Manejar 401 global (token expirado). Solo aplica si había una sesión abierta:
// un intento de login fallido no debe recargar la página (se perdería el mensaje de error)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const esLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !esLogin && localStorage.getItem('jordyn_token')) {
      localStorage.removeItem('jordyn_token');
      localStorage.removeItem('jordyn_user');
      window.location.href = LOGIN_PATH;
    }
    return Promise.reject(err);
  }
);

export default API;