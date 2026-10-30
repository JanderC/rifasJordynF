/* ============================================================
   imagenVendedor.js — Imagen para WhatsApp con los números de un vendedor:
   la publicidad de la rifa arriba y sus números en cuadritos debajo.
   Se dibuja en un canvas (sin ctx.filter ni ctx.roundRect, que fallan
   en los iPhone más viejos). El alto depende de cuántos números tenga.
   ============================================================ */
const ANCHO    = 1080;
const MARGEN   = 40;
const PADDING  = 34;
const INTERIOR = ANCHO - MARGEN * 2 - PADDING * 2;
const FOTO_MAX = 720;
const GAP      = 10;
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

function partirLineas(ctx, texto, ancho) {
  const lineas = [];
  let actual = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(prueba).width > ancho) { lineas.push(actual); actual = palabra; }
    else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
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
  ctx.textBaseline = 'alphabetic';
}

const columnasPara = (total, dig) => {
  const cols = total <= 36 ? 6 : total <= 80 ? 8 : total <= 150 ? 10 : 12;
  return dig >= 4 ? Math.min(cols, 8) : cols;
};

/* datos: { titulo, detalles: [texto…], vendedor, total, grupos: [{ serie, numeros }],
   esSim, dig, imagen, pie }. Devuelve { blob, conFoto }. */
export async function generarImagenVendedor(datos) {
  const { titulo, detalles, vendedor, total, grupos, esSim, dig, imagen, pie } = datos;
  const foto = await cargarFoto(imagen);
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  const ctx = canvas.getContext('2d');

  // 1) Medir, porque al cambiar el alto del canvas se borra lo pintado
  ctx.font = `bold 46px ${FUENTE}`;
  const lineasTitulo = partirLineas(ctx, titulo, INTERIOR);
  ctx.font = `30px ${FUENTE}`;
  const lineasDetalle = detalles.filter(Boolean).flatMap(d => partirLineas(ctx, d, INTERIOR));

  const cols  = columnasPara(total, dig);
  const celda = (INTERIOR - GAP * (cols - 1)) / cols;
  const altoCelda = Math.round(celda * 0.64);
  const fuente = Math.round(celda * (dig >= 4 ? 0.3 : 0.36));
  const filasDe = (g) => Math.ceil(g.numeros.length / cols);

  const altoFoto = foto ? Math.round(foto.height * Math.min((ANCHO - MARGEN * 2) / foto.width, FOTO_MAX / foto.height)) : 0;
  const altoTarjeta = PADDING
    + lineasTitulo.length * 54 + 8
    + lineasDetalle.length * 40 + 20
    + 84 + 22
    + grupos.reduce((s, g) => s + (esSim ? 44 : 0) + filasDe(g) * (altoCelda + GAP) + 8, 0)
    + PADDING - GAP - 8;
  const altoTotal = MARGEN + (foto ? altoFoto + 28 : 0) + altoTarjeta + 84;
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
  ctx.fillStyle = '#0d1b1b';
  ctx.font = `bold 46px ${FUENTE}`;
  ctx.textBaseline = 'top';
  lineasTitulo.forEach(l => { ctx.fillText(l, x0, y); y += 54; });
  y += 8;
  ctx.fillStyle = '#3c4a4a';
  ctx.font = `30px ${FUENTE}`;
  lineasDetalle.forEach(l => { ctx.fillText(l, x0, y); y += 40; });
  y += 20;

  trazar(ctx, x0, y, INTERIOR, 84, 16);
  ctx.fillStyle = '#0a3d62';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  const cantidad = `${total} número${total === 1 ? '' : 's'}`;
  ctx.font = `30px ${FUENTE}`;
  const anchoCantidad = ctx.measureText(cantidad).width;
  ctx.textAlign = 'right';
  ctx.fillText(cantidad, x0 + INTERIOR - 26, y + 43);
  ctx.textAlign = 'left';
  let nombre = String(vendedor).toUpperCase();
  ctx.font = `bold 38px ${FUENTE}`;
  const anchoNombre = INTERIOR - 26 * 2 - anchoCantidad - 24;
  if (ctx.measureText(nombre).width > anchoNombre) {
    while (nombre.length > 1 && ctx.measureText(`${nombre}…`).width > anchoNombre) nombre = nombre.slice(0, -1);
    nombre = `${nombre.trim()}…`;
  }
  ctx.fillText(nombre, x0 + 26, y + 43);
  ctx.textBaseline = 'top';
  y += 84 + 22;

  grupos.forEach((g) => {
    if (esSim) {
      ctx.fillStyle = '#0a3d62';
      ctx.font = `bold 30px ${FUENTE}`;
      ctx.fillText(`SERIE ${g.serie} · ${g.numeros.length}`, x0, y);
      y += 44;
    }
    g.numeros.forEach((n, i) => {
      const fila = Math.floor(i / cols);
      pintarNumero(ctx, n, x0 + (i % cols) * (celda + GAP), y + fila * (altoCelda + GAP), celda, altoCelda, fuente);
      ctx.textBaseline = 'top';
    });
    y += filasDe(g) * (altoCelda + GAP) + 8;
  });

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 30px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pie || '', ANCHO / 2, altoTotal - 42);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.92);
  });
  return { blob, conFoto: !!foto };
}
