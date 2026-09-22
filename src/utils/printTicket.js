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
   calcularLayout — cuántos boletos caben, con qué separación,
   y AVISA si la combinación se sale de la hoja.
   Todo en milímetros.

   • gapXMm / gapYMm → separación entre boletos (columnas / filas)
   • margenMm        → margen de la hoja (zona que no imprime)
   • aspecto         → proporción real del diseño (w/h). Si el modo es
                       'contener' se usa el tamaño EFECTIVO del boleto
                       dibujado, no la caja pedida: así la separación
                       que ves es la separación real entre boletos.
   • cols / rows     → si se pasan, la rejilla es MANUAL y entonces sí
                       puede desbordar (lo reportamos en `error`).
════════════════════════════════════════════════════════════════ */
export function calcularLayout({
  anchoCm,
  altoCm,
  papel = 'a4',
  orientacion = 'horizontal',
  gapXMm = 5,
  gapYMm = 5,
  margenMm = 5,
  repartirSobrante = true,   // el espacio que sobra se pasa a los huecos
  repartoMaxMm = 20,         // tope para que no queden huecos absurdos
  aspecto = null,
  modoAjuste = 'contener',
  cols: colsFijas = null,
  rows: rowsFijas = null,
}) {
  const { pageW, pageH } = tamanoHoja(papel, orientacion);

  const cajaW = Math.max(1, (Number(anchoCm) || 0) * 10);
  const cajaH = Math.max(1, (Number(altoCm) || 0) * 10);

  // Tamaño realmente ocupado por el boleto impreso
  let ticketW = cajaW;
  let ticketH = cajaH;
  if (aspecto && modoAjuste === 'contener') {
    const r = ajustarEnCelda(aspecto, cajaW, cajaH, 'contener');
    ticketW = r.w;
    ticketH = r.h;
  }

  const gx = Math.max(0, Number(gapXMm) || 0);
  const gy = Math.max(0, Number(gapYMm) || 0);
  const mg = Math.max(0, Number(margenMm) || 0);

  const utilW = pageW - mg * 2;
  const utilH = pageH - mg * 2;

  const base = {
    pageW, pageH,
    cajaW, cajaH,
    ticketW, ticketH,
    gapXMm: gx, gapYMm: gy, margenMm: mg,
    gapXReal: gx, gapYReal: gy,
    utilW, utilH,
    aspecto, modoAjuste,
    manual: !!(colsFijas || rowsFijas),
  };

  // ── El boleto por sí solo no cabe ───────────────────────────
  if (ticketW > utilW + 0.01 || ticketH > utilH + 0.01) {
    return {
      ...base,
      ok: false,
      cols: 0, rows: 0, perPage: 0,
      offsetX: 0, offsetY: 0,
      maxCols: 0, maxRows: 0,
      gapMaxX: 0, gapMaxY: 0,
      sobraX: 0, sobraY: 0,
      desbordeX: Math.max(0, ticketW - utilW),
      desbordeY: Math.max(0, ticketH - utilH),
      avisos: [],
      error: `Un solo boleto de ${(ticketW / 10).toFixed(1)}×${(ticketH / 10).toFixed(1)} cm `
           + `no cabe en ${PAPELES[papel].label} ${orientacion} con margen de ${mg} mm `
           + `(área útil ${(utilW / 10).toFixed(1)}×${(utilH / 10).toFixed(1)} cm). `
           + `Reduce el tamaño del boleto o el margen.`,
    };
  }

  // ── Cuántos caben con esta separación ───────────────────────
  // n·W + (n-1)·gap ≤ util  →  n ≤ (util + gap) / (W + gap)
  const maxCols = Math.max(1, Math.floor((utilW + gx) / (ticketW + gx) + 1e-9));
  const maxRows = Math.max(1, Math.floor((utilH + gy) / (ticketH + gy) + 1e-9));

  const cols = colsFijas ? Math.max(1, Math.round(colsFijas)) : maxCols;
  const rows = rowsFijas ? Math.max(1, Math.round(rowsFijas)) : maxRows;

  const usadoX = cols * ticketW + (cols - 1) * gx;
  const usadoY = rows * ticketH + (rows - 1) * gy;

  const desbordeX = Math.max(0, usadoX - utilW);
  const desbordeY = Math.max(0, usadoY - utilH);
  const cabe = desbordeX < 0.01 && desbordeY < 0.01;

  // ── Reparto del espacio sobrante ────────────────────────────
  // Sin esto, TODO lo que sobra se va a los márgenes de la hoja y
  // los boletos quedan pegados entre sí con el hueco mínimo.
  // Con esto, el sobrante se reparte en los huecos y la separación
  // entre boletos es pareja en los dos ejes.
  const libreX = Math.max(0, utilW - usadoX);
  const libreY = Math.max(0, utilH - usadoY);

  let gapXReal = gx;
  let gapYReal = gy;
  if (cabe && repartirSobrante) {
    if (cols > 1 && libreX > 0.01) {
      gapXReal = gx + Math.min(repartoMaxMm, libreX / (cols - 1));
    }
    if (rows > 1 && libreY > 0.01) {
      gapYReal = gy + Math.min(repartoMaxMm, libreY / (rows - 1));
    }
  }

  // Separación MÁXIMA que admite esta rejilla sin desbordar
  const gapMaxX = cols > 1 ? Math.max(0, (utilW - cols * ticketW) / (cols - 1)) : Infinity;
  const gapMaxY = rows > 1 ? Math.max(0, (utilH - rows * ticketH) / (rows - 1)) : Infinity;

  // Ocupación final ya con los huecos reales
  const usadoXReal = cols * ticketW + (cols - 1) * gapXReal;
  const usadoYReal = rows * ticketH + (rows - 1) * gapYReal;

  // Espacio que queda libre en los márgenes
  const sobraX = utilW - usadoXReal;
  const sobraY = utilH - usadoYReal;

  const offsetX = mg + Math.max(0, sobraX / 2);
  const offsetY = mg + Math.max(0, sobraY / 2);

  // ── Avisos (no bloquean, solo informan) ─────────────────────
  const avisos = [];
  if (cabe) {
    // ¿Cuántos caldrían si los pegara más?
    const sinGapCols = Math.max(1, Math.floor(utilW / ticketW + 1e-9));
    const sinGapRows = Math.max(1, Math.floor(utilH / ticketH + 1e-9));
    const perdidos = sinGapCols * sinGapRows - cols * rows;
    if (perdidos > 0 && (gx > 0 || gy > 0)) {
      avisos.push(
        `Con esta separación caben ${cols * rows} por hoja; sin separación cabrían ${sinGapCols * sinGapRows}.`
      );
    }
    if (repartirSobrante && (gapXReal - gx > 0.3 || gapYReal - gy > 0.3)) {
      avisos.push(
        `Se repartió el espacio sobrante: hueco real de ` +
        `${gapXReal.toFixed(1)} mm horizontal y ${gapYReal.toFixed(1)} mm vertical.`
      );
    }
    if (!repartirSobrante && isFinite(gapMaxX) && gapMaxX - gx > 1) {
      avisos.push(`Puedes separar hasta ${gapMaxX.toFixed(1)} mm en horizontal sin perder boletos.`);
    }
    if (!repartirSobrante && isFinite(gapMaxY) && gapMaxY - gy > 1) {
      avisos.push(`Puedes separar hasta ${gapMaxY.toFixed(1)} mm en vertical sin perder boletos.`);
    }
  }

  let error = null;
  if (!cabe) {
    const partes = [];
    if (desbordeX > 0.01) partes.push(`${desbordeX.toFixed(1)} mm de ancho`);
    if (desbordeY > 0.01) partes.push(`${desbordeY.toFixed(1)} mm de alto`);
    error = `La rejilla de ${cols}×${rows} con ${gx}/${gy} mm de separación `
          + `se sale de la hoja por ${partes.join(' y ')}.`;
  }

  return {
    ...base,
    ok: cabe,
    error,
    avisos,
    cols, rows,
    perPage: cols * rows,
    maxCols, maxRows,
    gapMaxX, gapMaxY,
    usadoX: usadoXReal, usadoY: usadoYReal,
    gapXReal, gapYReal,
    repartirSobrante,
    sobraX, sobraY,
    desbordeX, desbordeY,
    offsetX, offsetY,
  };
}

// Posición (mm) de la celda `index` dentro de la hoja
export function celda(layout, index) {
  const col = index % Math.max(1, layout.cols);
  const row = Math.floor(index / Math.max(1, layout.cols));
  return {
    x: layout.offsetX + col * (layout.ticketW + (layout.gapXReal ?? layout.gapXMm)),
    y: layout.offsetY + row * (layout.ticketH + (layout.gapYReal ?? layout.gapYMm)),
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
   marcasDeCorte — guías para tijera/guillotina
   estilo: 'esquinas' (marcas en L) | 'marco' (rectángulo fino)
   Las marcas se separan 0.5 mm del boleto y nunca se tocan entre
   celdas: antes, con 3 mm de separación, las marcas de boletos
   vecinos se unían y parecía que los boletos estaban pegados.
════════════════════════════════════════════════════════════════ */
export function marcasDeCorte(pdf, layout, cantidad, estilo = 'esquinas') {
  if (!cantidad || estilo === 'ninguna') return;

  pdf.setDrawColor(150);
  pdf.setLineWidth(0.08);

  if (estilo === 'marco') {
    for (let i = 0; i < cantidad; i++) {
      const c = celda(layout, i);
      pdf.rect(c.x, c.y, c.w, c.h);
    }
    return;
  }

  const sep = 0.5; // separación entre el boleto y el inicio de la marca
  const gx = Number(layout.gapXReal ?? layout.gapXMm) || 0;
  const gy = Number(layout.gapYReal ?? layout.gapYMm) || 0;
  // Cada lado usa como máximo la mitad del hueco disponible
  const largoX = Math.max(1, Math.min(4, gx / 2 - sep));
  const largoY = Math.max(1, Math.min(4, gy / 2 - sep));

  for (let i = 0; i < cantidad; i++) {
    const c = celda(layout, i);
    const esquinas = [
      [c.x,       c.y,       -1, -1],
      [c.x + c.w, c.y,        1, -1],
      [c.x,       c.y + c.h, -1,  1],
      [c.x + c.w, c.y + c.h,  1,  1],
    ];
    esquinas.forEach(([x, y, sx, sy]) => {
      // marca horizontal (se aleja en X)
      pdf.line(x + sx * sep, y, x + sx * (sep + largoX), y);
      // marca vertical (se aleja en Y)
      pdf.line(x, y + sy * sep, x, y + sy * (sep + largoY));
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