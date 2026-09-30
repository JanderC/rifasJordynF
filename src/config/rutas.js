// Ruta del login administrativo. No es pública ni aparece enlazada en el sitio:
// solo la conoce el personal. Se puede cambiar en Vercel con REACT_APP_LOGIN_PATH
// (debe empezar con "/") sin tocar el código.
export const LOGIN_PATH = process.env.REACT_APP_LOGIN_PATH || '/rts-9k4m7q2x';

// Pantalla de inicio del panel según el rol del usuario
export const rutaInicio = (user) => (user?.rol === 'dueno' ? '/rifas' : '/vender');
