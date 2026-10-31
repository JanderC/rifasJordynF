/* ============================================================
   imagenVendedor.js — Imagen para WhatsApp con los números disponibles
   de un vendedor: solo la publicidad de la rifa y sus números en cuadritos.
   Se dibuja en un canvas (sin ctx.filter ni ctx.roundRect, que fallan
   en los iPhone más viejos). El alto depende de cuántos números tenga.
   ============================================================ */
const ANCHO    = 1080;
const MARGEN   = 40;
const PADDING  = 34;
const INTERIOR = ANCHO - MARGEN * 2 - PADDING * 2;
const FOTO_MAX = 720;
const GAP      = 10;
const FRANJA   = 84;
const FUENTE   = 'Arial, Helvetica, sans-serif';

const cargar = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload  = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

// La foto ya vista en la tarjeta de la rifa puede venir de la caché sin permisos
// CORS: en ese caso se vuelve a pedir con otra URL
async function cargarFoto(url) {
  if (!url) return null;
  const img = await cargar(url);
  if (img || !/^https?:/.test(url)) return img;
  return cargar(`${url}${url.includes('?') ? '&' : '?'}compartir=1`);
}

function trazar(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fondo: la misma publicidad muy difuminada (se achica y se amplía) y oscurecida
function pintarFondo(ctx, foto, alto) {
  const degradado = ctx.createLinearGradient(0, 0, 0, alto);
  degradado.addColorStop(0, '#0a3d62');
  degradado.addColorStop(1, '#0b6e5f');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, ANCHO, alto);
  if (!foto) return;
  const mini = document.createElement('canvas');
  mini.width = 36;
  mini.height = Math.max(36, Math.round(36 * alto / ANCHO));
  const escala = Math.max(mini.width / foto.width, mini.height / foto.height);
  const w = foto.width * escala;
  const h = foto.height * escala;
  mini.getContext('2d').drawImage(foto, (mini.width - w) / 2, (mini.height - h) / 2, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mini, 0, 0, ANCHO, alto);
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(0, 0, ANCHO, alto);
}

function pintarNumero(ctx, numero, x, y, w, h, fuente) {
  const verde = ctx.createLinearGradient(0, y, 0, y + h);
  verde.addColorStop(0, '#b4e0bc');
  verde.addColorStop(1, '#6fae82');
  trazar(ctx, x, y, w, h, 10);
  ctx.fillStyle = verde;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#10261a';
  ctx.stroke();
  ctx.fillStyle = '#0a1a12';
  ctx.font = `bold ${fuente}px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numero, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

const columnasPara = (total, dig) => {
  const cols = total <= 36 ? 6 : total <= 80 ? 8 : total <= 150 ? 10 : 12;
  return dig >= 4 ? Math.min(cols, 8) : cols;
};

/* numeros: ya ordenados (se pintan tal cual). Devuelve { blob, conFoto }. */
export async function generarImagenVendedor({ numeros, dig, imagen }) {
  const foto = await cargarFoto(imagen);
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  const ctx = canvas.getContext('2d');

  // 1) Medir, porque al cambiar el alto del canvas se borra lo pintado
  const cols  = columnasPara(numeros.length, dig);
  const celda = (INTERIOR - GAP * (cols - 1)) / cols;
  const altoCelda = Math.round(celda * 0.64);
  const fuente = Math.round(celda * (dig >= 4 ? 0.3 : 0.36));
  const filas = Math.ceil(numeros.length / cols);

  const altoFoto = foto ? Math.round(foto.height * Math.min((ANCHO - MARGEN * 2) / foto.width, FOTO_MAX / foto.height)) : 0;
  const altoTarjeta = PADDING + FRANJA + 22 + filas * (altoCelda + GAP) - GAP + PADDING;
  const altoTotal = MARGEN + (foto ? altoFoto + 28 : 0) + altoTarjeta + MARGEN;
  canvas.height = altoTotal;

  // 2) Pintar
  pintarFondo(ctx, foto, altoTotal);
  let y = MARGEN;
  if (foto) {
    const anchoFoto = Math.round(foto.width * altoFoto / foto.height);
    const x = (ANCHO - anchoFoto) / 2;
    ctx.save();
    trazar(ctx, x, y, anchoFoto, altoFoto, 22);
    ctx.clip();
    ctx.drawImage(foto, x, y, anchoFoto, altoFoto);
    ctx.restore();
    y += altoFoto + 28;
  }

  trazar(ctx, MARGEN, y, ANCHO - MARGEN * 2, altoTarjeta, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const x0 = MARGEN + PADDING;
  y += PADDING;
  trazar(ctx, x0, y, INTERIOR, FRANJA, 16);
  ctx.fillStyle = '#0a3d62';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 40px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NÚMEROS DISPONIBLES', ANCHO / 2, y + FRANJA / 2 + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  y += FRANJA + 22;

  numeros.forEach((n, i) => {
    const fila = Math.floor(i / cols);
    pintarNumero(ctx, n, x0 + (i % cols) * (celda + GAP), y + fila * (altoCelda + GAP), celda, altoCelda, fuente);
  });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.92);
  });
  return { blob, conFoto: !!foto };
}
