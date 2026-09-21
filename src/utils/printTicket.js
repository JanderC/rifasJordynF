// ════════════════════════════════════════════════════════════════
//   src/utils/printTicket.js
//   RIFAS JORDYN — Utilidades de impresión / PDF
//
//   Resuelve el problema de "los objetos se mueven y no cuadran
//   con el tamaño del ticket":
//
//   1) Un solo sistema de unidades:  px (pantalla, 96dpi) ⇄ mm (PDF)
//   2) La captura SIEMPRE se hace al tamaño real del nodo
//      (sin width/height/windowWidth manuales que descuadran).
//   3) La imagen se coloca en el PDF respetando su proporción,
//      así nunca se estira ni se desplazan los elementos.
// ════════════════════════════════════════════════════════════════
import html2canvas from 'html2canvas';

// ── Conversión de unidades ──────────────────────────────────────
// El navegador dibuja a 96 CSS px por pulgada → 1 mm = 3.7795 px
export const PX_POR_MM = 96 / 25.4;

export const mmAPx = (mm) => (Number(mm) || 0) * PX_POR_MM;
export const pxAMm = (px) => (Number(px) || 0) / PX_POR_MM;
export const cmAPx = (cm) => mmAPx((Number(cm) || 0) * 10);
export const pxACm = (px) => pxAMm(px) / 10;

// Redondeo bonito para mostrar en inputs (1 decimal)
export const cm1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

// ── Hojas soportadas (medidas en mm, lado largo / lado corto) ───
export const PAPELES = {
  a4:     { label: 'A4',     largo: 297.0, corto: 210.0, jsPdf: 'a4' },
  letter: { label: 'Carta',  largo: 279.4, corto: 215.9, jsPdf: 'letter' },
  legal:  { label: 'Oficio', largo: 355.6, corto: 215.9, jsPdf: 'legal' },
};

export function tamanoHoja(papel = 'a4', orientacion = 'horizontal') {
  const p = PAPELES[papel] || PAPELES.a4;
  return orientacion === 'horizontal'
    ? { pageW: p.largo, pageH: p.corto }
    : { pageW: p.corto, pageH: p.largo };
}

/* ════════════════════════════════════════════════════════════════
   calcularLayout — cuántos boletos caben y dónde va cada uno
   Todo en milímetros.
════════════════════════════════════════════════════════════════ */
export function calcularLayout({
  anchoCm,
  altoCm,
  papel = 'a4',
  orientacion = 'horizontal',
  gapMm = 3,
  margenMm = 5,
}) {
  const { pageW, pageH } = tamanoHoja(papel, orientacion);

  const ticketW = Math.max(1, (Number(anchoCm) || 0) * 10);
  const ticketH = Math.max(1, (Number(altoCm) || 0) * 10);

  // Área útil descontando el margen físico de la impresora
  const utilW = pageW - margenMm * 2;
  const utilH = pageH - margenMm * 2;

  if (ticketW > utilW || ticketH > utilH) {
    return {
      ok: false,
      pageW, pageH, ticketW, ticketH,
      cols: 0, rows: 0, perPage: 0, offsetX: 0, offsetY: 0, gapMm, margenMm,
      error: `El boleto (${cm1(anchoCm)}×${cm1(altoCm)} cm) no cabe en ${PAPELES[papel].label} ${orientacion} `
           + `(área útil ${cm1(utilW / 10)}×${cm1(utilH / 10)} cm). Reduce el tamaño o el margen.`,
    };
  }

  // n·W + (n-1)·gap ≤ util  →  n ≤ (util + gap) / (W + gap)
  const cols = Math.max(1, Math.floor((utilW + gapMm) / (ticketW + gapMm)));
  const rows = Math.max(1, Math.floor((utilH + gapMm) / (ticketH + gapMm)));

  const usadoX = cols * ticketW + (cols - 1) * gapMm;
  const usadoY = rows * ticketH + (rows - 1) * gapMm;

  // Centrado dentro del área útil
  const offsetX = margenMm + Math.max(0, (utilW - usadoX) / 2);
  const offsetY = margenMm + Math.max(0, (utilH - usadoY) / 2);

  return {
    ok: true,
    error: null,
    pageW, pageH,
    ticketW, ticketH,
    cols, rows,
    perPage: cols * rows,
    offsetX, offsetY,
    gapMm, margenMm,
  };
}

// Posición (mm) de la celda `index` dentro de la hoja
export function celda(layout, index) {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return {
    x: layout.offsetX + col * (layout.ticketW + layout.gapMm),
    y: layout.offsetY + row * (layout.ticketH + layout.gapMm),
    w: layout.ticketW,
    h: layout.ticketH,
  };
}

/* ════════════════════════════════════════════════════════════════
   ajustarEnCelda — evita la deformación
   Devuelve el rectángulo (mm) donde hay que pintar la imagen
   dentro de la celda, según el modo:
     • 'contener' → respeta la proporción del diseño y centra
     • 'estirar'  → llena la celda (puede deformar)
════════════════════════════════════════════════════════════════ */
export function ajustarEnCelda(aspectoImagen, celdaW, celdaH, modo = 'contener') {
  if (modo === 'estirar' || !aspectoImagen || !isFinite(aspectoImagen)) {
    return { x: 0, y: 0, w: celdaW, h: celdaH };
  }
  const aspectoCelda = celdaW / celdaH;
  let w = celdaW;
  let h = celdaH;
  if (aspectoImagen > aspectoCelda) {
    h = celdaW / aspectoImagen;          // sobra alto
  } else {
    w = celdaH * aspectoImagen;          // sobra ancho
  }
  return { x: (celdaW - w) / 2, y: (celdaH - h) / 2, w, h };
}

/* ════════════════════════════════════════════════════════════════
   esperarRecursos — el motivo #1 de que "se muevan los objetos"
   es capturar antes de que carguen fuentes e imágenes.
════════════════════════════════════════════════════════════════ */
export function frame() {
  return new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))
  );
}

export async function esperarRecursos(nodo, msExtra = 80) {
  // 1. React ya pintó
  await frame();

  // 2. Fuentes web listas (Poppins, Arial Black, …)
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (_) { /* navegador viejo */ }

  // 3. Todas las <img> decodificadas (logos, PNG sin fondo, etc.)
  if (nodo) {
    const imgs = Array.from(nodo.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((res) => {
        const fin = () => res();
        img.addEventListener('load', fin, { once: true });
        img.addEventListener('error', fin, { once: true });
        setTimeout(fin, 6000);
      });
    }));
  }

  // 4. Un respiro para gradientes / SVG / filtros CSS
  await frame();
  if (msExtra > 0) await new Promise((r) => setTimeout(r, msExtra));
}

/* ════════════════════════════════════════════════════════════════
   crearLienzoOculto — contenedor fuera de vista pero "renderizable"
   OJO: no usamos left:-9999px ni display:none porque html2canvas
   calcula posiciones con getBoundingClientRect y se descuadra.
   Lo dejamos en 0,0 con opacidad casi nula y z-index negativo, y
   en el clon lo devolvemos a opacidad 1.
════════════════════════════════════════════════════════════════ */
export function crearLienzoOculto(anchoPx, altoPx, fondo = '#ffffff') {
  const cont = document.createElement('div');
  cont.setAttribute('data-ticket-capture', 'true');
  cont.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${Math.ceil(anchoPx)}px`,
    `height:${Math.ceil(altoPx)}px`,
    'opacity:0.01',
    'pointer-events:none',
    'z-index:-2147483647',
    'overflow:visible',
    `background:${fondo}`,
    'transform:none',
  ].join(';');
  document.body.appendChild(cont);
  return cont;
}

export function destruirLienzoOculto(cont) {
  if (cont && cont.parentNode) cont.parentNode.removeChild(cont);
}

/* ════════════════════════════════════════════════════════════════
   capturarNodo — html2canvas con opciones "a prueba de descuadre"
   • scale sale del DPI deseado (300dpi ⇒ 3.125)
   • NO se pasan width/height/windowWidth: html2canvas usa el
     tamaño real del elemento y así nada se recorta ni se desplaza.
════════════════════════════════════════════════════════════════ */
export async function capturarNodo(nodo, { dpi = 300, fondo = '#ffffff' } = {}) {
  const escala = Math.min(6, Math.max(1, dpi / 96));

  return html2canvas(nodo, {
    scale: escala,
    useCORS: true,
    allowTaint: false,
    backgroundColor: fondo,
    logging: false,
    imageTimeout: 20000,
    removeContainer: true,
    scrollX: 0,
    scrollY: 0,
    onclone: (doc) => {
      // Devolvemos la opacidad real al clon que html2canvas va a pintar
      doc.querySelectorAll('[data-ticket-capture="true"]').forEach((el) => {
        el.style.opacity = '1';
        el.style.zIndex = '0';
      });
      // Evita que una animación a medias deje un frame raro
      const style = doc.createElement('style');
      style.textContent = '*{animation:none!important;transition:none!important}';
      doc.head.appendChild(style);
    },
  });
}

/* ════════════════════════════════════════════════════════════════
   marcasDeCorte — guías finas en las esquinas de cada boleto
════════════════════════════════════════════════════════════════ */
export function marcasDeCorte(pdf, layout, cantidad) {
  const largo = Math.min(3, layout.gapMm > 0 ? layout.gapMm : 3);
  pdf.setDrawColor(170);
  pdf.setLineWidth(0.08);

  for (let i = 0; i < cantidad; i++) {
    const c = celda(layout, i);
    const esquinas = [
      [c.x, c.y, -1, -1],
      [c.x + c.w, c.y, 1, -1],
      [c.x, c.y + c.h, -1, 1],
      [c.x + c.w, c.y + c.h, 1, 1],
    ];
    esquinas.forEach(([x, y, sx, sy]) => {
      pdf.line(x, y, x + sx * largo, y);
      pdf.line(x, y, x, y + sy * largo);
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   canvasADato — PNG (nítido, ideal para texto) o JPEG (liviano)
════════════════════════════════════════════════════════════════ */
export function canvasADato(canvas, formato = 'PNG', calidad = 0.95) {
  return formato === 'PNG'
    ? { data: canvas.toDataURL('image/png'), fmt: 'PNG' }
    : { data: canvas.toDataURL('image/jpeg', calidad), fmt: 'JPEG' };
}