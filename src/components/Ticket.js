import React, { useState, useEffect } from 'react';
import API from '../services/api';

// ── DEFAULT_DESIGN ────────────────────────────────────────
export const DEFAULT_DESIGN = {
  // ── Marca / textos generales ────────────────────────────
  brandText:        'GRAN RIFA',
  sloganTop:        'RESUELVE DE INICIO DE SEMANA',
  fechaPrefix:      'Juega El',
  premioLabel:      'Premio',
  subPremioPrefix:  'ó',
  subPremioMoneda:  'Pesos',
  caducaText:       'Caduca a los 8 días',
  loteriaText:      'Triple Táchira "A" 10:10 Pm',
  motivacionalText: 'Prueba Tu Suerte y Ganate Este Fabuloso Premio!',
  boletoLabel:      'BOLETO',
  valorSufijo:      'PESOS',
  talonText:        'BOLETO SIN CANCELAR NO JUEGA',
  footerText:       'Conserve este boleto · Válido solo con número legible',

  // ── Colores ─────────────────────────────────────────────
  colorSlogan:    '#d92626',
  colorFecha:     '#1a3a8a',
  colorPremio1:   '#f5c518',
  colorPremio2:   '#1565d8',
  colorDolares:   '#d92626',
  colorSubPremio: '#c41e7a',
  colorPesosSub:  '#2e8b3e',
  colorBoleto:    '#1565d8',
  colorValor:     '#d92626',
  colorPesos:     '#2e8b3e',
  colorMotivac:   '#1a1a1a',
  colorTalon:     '#1565d8',
  colorCaduca:    '#1a1a1a',
  colorLoteria:   '#1a1a1a',
  colorBorde:     '#000000',
  bgPaper:        '#f5f5f0',

  // ── Tamaños de fuente (pt) ───────────────────────────────
  sizeBrand:       22,
  sizeNumTalon:    20,
  sizeNumDer:      20,
  sizeNombre:      10,
  sizeTalonText:    8,
  sizeSlogan:      18,
  sizeFecha:       16,
  sizePremioLabel: 18,
  sizePremioNum:   78,
  sizePremioTxt:   26,
  sizeSubPremio:   24,
  sizeSubMoneda:   20,
  sizeCaduca:      11,
  sizeLoteria:     11,
  sizeMotivac:     11,
  sizeBoleto:      20,
  sizeValor:       32,
  sizePesos:       16,
  sizeFooter:       7,
  ticketWidth:    780,
  ticketHeight:   340,

  // ═══════════════════════════════════════════════════════
  //   NUEVO — Sistema de capas decorativas
  // ═══════════════════════════════════════════════════════

  // Marco decorativo del ticket
  // none | classic | ornate | doubleline | dashed | rounded | corners | greca
  frameStyle:     'classic',
  frameColor:     '#000000',
  frameWidth:     2.5,

  // Watermark / marca de agua central
  watermarkEnabled: false,
  watermarkText:    'JORDYN',
  watermarkColor:   '#000000',
  watermarkOpacity: 0.06,
  watermarkSize:    100,    // pt
  watermarkRotation:-20,    // grados

  // Textura de papel
  // none | dots | lines | grid | noise | aged
  paperTexture:    'none',
  paperTextureOpacity: 0.08,

  // Brillo del fondo (radial gradient sutil)
  paperGlow:       false,
  paperGlowColor:  '#fff8d0',

  // ── Capas dinámicas (arrays) ────────────────────────────
  customTexts:    [],   // [{ id, value, x, y, fontSize, fontWeight, color, fontStyle, fontFamily, rotation,
                        //    textStroke?: {width, color}, textGlow?: {blur, color}, textShadow3D?: {color, depth},
                        //    gradient?: {from, to, direction} }]
  customShapes:   [],   // [{ id, type, x, y, width, height, rotation, color, color2?, strokeColor?, strokeWidth?,
                        //    opacity?, ...propsEspecíficas }]
                        // types: arrow, star, circle, ring, rect, line, polygon, ribbon, stamp, lightning,
                        //        burst, heart, diamond, triangle, banner, sparkle
  customImages:   [],   // [{ id, src, x, y, width, height, rotation, opacity, blendMode, borderRadius,
                        //    grayscale, sepia, blur, brightness }]
  positions:      {},
  hiddenFields:   [],
  globalSizeFactor: 1.0,

  // ── Compatibilidad ──────────────────────────────────────
  accentColor:  '#0abfbc',
  accentColor2: '#f0a500',
  bgDark:       '#1a2e2e',
  horaSort:     '',
};

// ── Conversión pt → px ──────────────────────────────────
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);

// ── Normalizador legacy ─────────────────────────────────
const normalizaDesign = (d) => {
  if (!d) return d;
  const out = { ...d };
  if (out.sizePremioNum && out.sizePremioNum > 50) {
    [
      'sizeBrand','sizeNumTalon','sizeNumDer','sizeNombre','sizeTalonText',
      'sizeSlogan','sizeFecha','sizePremioLabel','sizePremioNum','sizePremioTxt',
      'sizeSubPremio','sizeSubMoneda','sizeCaduca','sizeLoteria','sizeMotivac',
      'sizeBoleto','sizeValor','sizePesos','sizeFooter',
    ].forEach(k => {
      if (out[k] != null) out[k] = Math.max(6, Math.round(out[k] / PT_TO_PX));
    });
  }
  return out;
};

// ── Helpers fecha ─────────────────────────────────────────
const parseFechaTicket = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};

const fmtFechaLoteria = (f) => {
  const d = parseFechaTicket(f);
  if (!d) return 'Por definir';
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dia = d.getUTCDate();
  const mes = MESES[d.getUTCMonth()];
  const ano = d.getUTCFullYear();
  return `${dia} ${mes} - ${ano}`;
};

const fmtHora12 = (horaStr) => {
  if (!horaStr) return '';
  const m = String(horaStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = parseInt(m[1]), mn = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mn} ${ampm}`;
};

const extraerHora = (fechaSorteo, horaDesign, horaRifa) => {
  if (horaDesign && horaDesign.trim()) return horaDesign.trim();
  if (horaRifa) {
    const formateada = fmtHora12(horaRifa);
    if (formateada) return formateada;
  }
  const d = parseFechaTicket(fechaSorteo);
  if (!d) return '';
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return '';
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Caracas',
  });
};

const fmtMilesPunto = (n) => {
  if (n == null || n === '') return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  return num.toLocaleString('de-DE');
};

const fmtValorBoleto = (n) => {
  if (n == null) return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + ' Millón';
  if (num >= 1000)    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + ' Mil';
  return String(num);
};

const splitPremio = (premio) => {
  if (!premio) return { numero: '', texto: '' };
  const s = String(premio).trim();
  const m = s.match(/^([\d.,]+)\s*(.*)$/);
  if (m) return { numero: m[1], texto: m[2] || '' };
  return { numero: '', texto: s };
};

// ════════════════════════════════════════════════════════════
//   SISTEMA DE CAPAS DECORATIVAS
// ════════════════════════════════════════════════════════════

// ── Estilo de texto extendido (stroke, glow, shadow3D, gradient) ──
// Devuelve un objeto CSS-in-JS listo para aplicar.
export function buildTextStyle(base, extra = {}) {
  const out = { ...base };
  // Contorno / margen de letra
  if (extra.textStroke && extra.textStroke.width > 0) {
    out.WebkitTextStroke = `${extra.textStroke.width}px ${extra.textStroke.color || '#000'}`;
    out.textStroke       = `${extra.textStroke.width}px ${extra.textStroke.color || '#000'}`;
  }
  // Combina text-shadow: glow + shadow3D + cualquier sombra base
  const shadows = [];
  if (base.textShadow) shadows.push(base.textShadow);
  if (extra.textGlow && extra.textGlow.blur > 0) {
    const c = extra.textGlow.color || '#fff';
    const b = extra.textGlow.blur;
    // Triple capa para glow más intenso
    shadows.push(`0 0 ${b * 0.5}px ${c}`, `0 0 ${b}px ${c}`, `0 0 ${b * 1.5}px ${c}`);
  }
  if (extra.textShadow3D && extra.textShadow3D.depth > 0) {
    const c = extra.textShadow3D.color || '#000';
    const d = extra.textShadow3D.depth;
    // Múltiples capas para efecto 3D extruido
    const layers = [];
    for (let i = 1; i <= d; i++) layers.push(`${i}px ${i}px 0 ${c}`);
    shadows.push(...layers);
  }
  if (shadows.length > 0) out.textShadow = shadows.join(', ');

  // Gradiente de texto (usa background-clip)
  if (extra.gradient && extra.gradient.from && extra.gradient.to) {
    const dir = extra.gradient.direction || '180deg';
    out.backgroundImage      = `linear-gradient(${dir}, ${extra.gradient.from}, ${extra.gradient.to})`;
    out.WebkitBackgroundClip = 'text';
    out.backgroundClip       = 'text';
    out.WebkitTextFillColor  = 'transparent';
    out.color                = 'transparent';
  }
  return out;
}

// ── Renderiza una forma SVG en HTML (string) ──
// Se inserta como un <div> absoluto con un <svg> dentro.
export function buildShapeHTML(s) {
  if (!s) return '';
  const op       = s.opacity != null ? s.opacity : 1;
  const rot      = s.rotation || 0;
  const w        = s.width  || 80;
  const h        = s.height || 80;
  const color    = s.color || '#000';
  const color2   = s.color2 || color;
  const stroke   = s.strokeColor || 'none';
  const strokeW  = s.strokeWidth != null ? s.strokeWidth : 0;
  const wrap = (inner) => `<div style="position:absolute;left:${s.x}px;top:${s.y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg);transform-origin:center;opacity:${op};pointer-events:none;">${inner}</div>`;
  const gradId   = `g_${s.id || Math.random().toString(36).slice(2,8)}`;
  const grad = `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs>`;
  const fill = color !== color2 ? `url(#${gradId})` : color;

  switch (s.type) {
    case 'arrow': {
      // Flecha horizontal apuntando a la derecha
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${grad}
        <polygon points="0,30 60,30 60,10 100,50 60,90 60,70 0,70" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'star': {
      const points = s.points || 5;
      const outer  = 50, inner = 22;
      const cx = 50, cy = 50;
      const pts = [];
      for (let i = 0; i < points * 2; i++) {
        const r   = i % 2 === 0 ? outer : inner;
        const ang = (i * Math.PI) / points - Math.PI / 2;
        pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
      }
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'circle': {
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <circle cx="50" cy="50" r="48" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      </svg>`);
    }
    case 'ring': {
      const innerR = s.innerRadius || 32;
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <path d="M50 2 A48 48 0 1 1 49.99 2 Z M50 ${50-innerR} A${innerR} ${innerR} 0 1 0 50.01 ${50-innerR} Z" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="${strokeW}"/>
      </svg>`);
    }
    case 'rect': {
      const r = s.borderRadius != null ? s.borderRadius : 0;
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${grad}
        <rect x="0" y="0" width="100" height="100" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      </svg>`);
    }
    case 'line': {
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke="${color}" stroke-width="${strokeW > 0 ? strokeW : 4}" stroke-linecap="round" stroke-dasharray="${s.dashed ? '6,4' : 'none'}"/>
      </svg>`);
    }
    case 'triangle': {
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${grad}
        <polygon points="50,5 95,90 5,90" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'diamond': {
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${grad}
        <polygon points="50,2 98,50 50,98 2,50" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'heart': {
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <path d="M50 88 C50 88 5 60 5 32 C5 18 16 8 28 8 C38 8 46 14 50 22 C54 14 62 8 72 8 C84 8 95 18 95 32 C95 60 50 88 50 88 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'lightning': {
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <polygon points="55,2 25,55 48,55 35,98 78,40 55,40 70,2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'burst': {
      // Explosión/estallido tipo cómic - 12 picos
      const spikes = 12;
      const pts = [];
      for (let i = 0; i < spikes * 2; i++) {
        const r   = i % 2 === 0 ? 48 : 28;
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        pts.push(`${50 + r * Math.cos(ang)},${50 + r * Math.sin(ang)}`);
      }
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'sparkle': {
      // 4 puntas tipo destello
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <polygon points="50,5 56,44 95,50 56,56 50,95 44,56 5,50 44,44" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'ribbon': {
      // Listón con cola en V
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${grad}
        <polygon points="0,15 100,15 100,75 80,75 100,95 60,75 40,75 0,95 20,75 0,75" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    case 'banner': {
      // Banner clásico con dobleces
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${grad}
        <polygon points="5,20 95,20 95,75 88,75 95,90 50,80 5,90 12,75 5,75" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
        <polygon points="0,30 5,20 5,75 0,75" fill="${color2}" opacity="0.6"/>
        <polygon points="100,30 95,20 95,75 100,75" fill="${color2}" opacity="0.6"/>
      </svg>`);
    }
    case 'stamp': {
      // Sello tipo "APROBADO" con borde dentado
      const teeth = 24;
      const pts = [];
      for (let i = 0; i < teeth; i++) {
        const ang = (i * 2 * Math.PI) / teeth - Math.PI / 2;
        const r = i % 2 === 0 ? 48 : 42;
        pts.push(`${50 + r * Math.cos(ang)},${50 + r * Math.sin(ang)}`);
      }
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <polygon points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="3"/>
        <circle cx="50" cy="50" r="34" fill="none" stroke="${color}" stroke-width="2"/>
        ${s.label ? `<text x="50" y="56" text-anchor="middle" font-family="Arial Black" font-size="14" font-weight="900" fill="${color}">${s.label}</text>` : ''}
      </svg>`);
    }
    case 'polygon': {
      const sides = s.sides || 6;
      const pts = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i * 2 * Math.PI) / sides - Math.PI / 2;
        pts.push(`${50 + 48 * Math.cos(ang)},${50 + 48 * Math.sin(ang)}`);
      }
      return wrap(`<svg width="${w}" height="${h}" viewBox="0 0 100 100">${grad}
        <polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      </svg>`);
    }
    default:
      return '';
  }
}

// ── Renderiza una imagen custom en HTML (string) ──
export function buildImageHTML(img) {
  if (!img || !img.src) return '';
  const filters = [];
  if (img.grayscale)  filters.push(`grayscale(${img.grayscale})`);
  if (img.sepia)      filters.push(`sepia(${img.sepia})`);
  if (img.blur)       filters.push(`blur(${img.blur}px)`);
  if (img.brightness) filters.push(`brightness(${img.brightness})`);
  const filterStr = filters.length ? `filter:${filters.join(' ')};` : '';
  return `<img src="${img.src}" alt="" crossorigin="anonymous" style="
    position:absolute;left:${img.x}px;top:${img.y}px;
    width:${img.width}px;height:${img.height}px;
    transform:rotate(${img.rotation || 0}deg);transform-origin:center;
    opacity:${img.opacity != null ? img.opacity : 1};
    mix-blend-mode:${img.blendMode || 'normal'};
    border-radius:${img.borderRadius || 0}px;
    ${filterStr}
    pointer-events:none;object-fit:${img.objectFit || 'cover'};"/>`;
}

// ── Watermark (texto rotado, semitransparente, centrado) ──
export function buildWatermarkHTML(D) {
  if (!D.watermarkEnabled || !D.watermarkText) return '';
  return `<div style="position:absolute;left:50%;top:50%;
    transform:translate(-50%,-50%) rotate(${D.watermarkRotation || -20}deg);
    font-family:'Arial Black','Poppins',sans-serif;font-weight:900;
    font-size:${px(D.watermarkSize || 100)}px;
    color:${D.watermarkColor || '#000'};
    opacity:${D.watermarkOpacity != null ? D.watermarkOpacity : 0.06};
    letter-spacing:8px;white-space:nowrap;pointer-events:none;
    user-select:none;">${D.watermarkText}</div>`;
}

// ── Textura de papel (SVG pattern como background) ──
export function buildPaperTextureCSS(D) {
  if (!D.paperTexture || D.paperTexture === 'none') return '';
  const op = D.paperTextureOpacity != null ? D.paperTextureOpacity : 0.08;
  let svg = '';
  switch (D.paperTexture) {
    case 'dots':
      svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='1' fill='%23000' fill-opacity='${op}'/></svg>`;
      break;
    case 'lines':
      svg = `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><path d='M0 15 L30 15' stroke='%23000' stroke-opacity='${op}' stroke-width='.5'/></svg>`;
      break;
    case 'grid':
      svg = `<svg xmlns='http://www.w3.org/2000/svg' width='25' height='25'><path d='M0 0L25 0M0 0L0 25' stroke='%23000' stroke-opacity='${op}' stroke-width='.5' fill='none'/></svg>`;
      break;
    case 'noise':
      svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100' height='100' filter='url(%23n)' opacity='${op}'/></svg>`;
      break;
    case 'aged':
      svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><filter id='a'><feTurbulence baseFrequency='0.05' numOctaves='2'/><feColorMatrix values='0 0 0 0 .55  0 0 0 0 .42  0 0 0 0 .2  0 0 0 ${op * 1.5} 0'/></filter></defs><rect width='200' height='200' filter='url(%23a)'/></svg>`;
      break;
    default:
      return '';
  }
  return `background-image:url("data:image/svg+xml;utf8,${svg.replace(/#/g, '%23').replace(/"/g, "'")}");background-repeat:repeat;`;
}

// ── Marco decorativo (overlay sobre el ticket) ──
// Devuelve HTML que se monta como hijo absoluto del ticket.
export function buildFrameHTML(D) {
  const fc = D.frameColor || D.colorBorde || '#000';
  const fw = D.frameWidth || 2.5;
  switch (D.frameStyle) {
    case 'doubleline':
      return `<div style="position:absolute;inset:6px;border:${fw * 0.6}px solid ${fc};pointer-events:none;"></div>`;
    case 'dashed':
      return `<div style="position:absolute;inset:4px;border:${fw}px dashed ${fc};pointer-events:none;"></div>`;
    case 'rounded':
      // Esquinas redondeadas (overlay con border-radius)
      return `<div style="position:absolute;inset:0;border:${fw}px solid ${fc};border-radius:14px;pointer-events:none;"></div>`;
    case 'corners': {
      // 4 esquinas decorativas tipo "fotocopiadora"
      const sz = 28;
      const corner = (pos) => `<div style="position:absolute;${pos};width:${sz}px;height:${sz}px;border:${fw + 1}px solid ${fc};pointer-events:none;"></div>`;
      return [
        corner(`left:6px;top:6px;border-right:none;border-bottom:none`),
        corner(`right:6px;top:6px;border-left:none;border-bottom:none`),
        corner(`left:6px;bottom:6px;border-right:none;border-top:none`),
        corner(`right:6px;bottom:6px;border-left:none;border-top:none`),
      ].join('');
    }
    case 'ornate': {
      // Marco doble con esquinas decorativas
      const inner = `<div style="position:absolute;inset:8px;border:${fw}px solid ${fc};pointer-events:none;"></div>`;
      const dots = `<svg xmlns='http://www.w3.org/2000/svg' style='position:absolute;inset:0;width:100%;height:100%;pointer-events:none' viewBox='0 0 100 100' preserveAspectRatio='none'>
        <circle cx='4' cy='4' r='3' fill='${fc}'/>
        <circle cx='96' cy='4' r='3' fill='${fc}'/>
        <circle cx='4' cy='96' r='3' fill='${fc}'/>
        <circle cx='96' cy='96' r='3' fill='${fc}'/>
      </svg>`;
      return inner + dots;
    }
    case 'greca': {
      // Patrón de greca/cenefa con SVG repetido en los bordes
      const greca = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'><path d='M0 8 L4 8 L4 2 L8 2 L8 8 L12 8 L12 2 L16 2 L16 8 L20 8' stroke='${fc}' stroke-width='1.2' fill='none'/></svg>`;
      const dataUrl = `data:image/svg+xml;utf8,${greca.replace(/#/g,'%23').replace(/"/g,"'")}`;
      return `
        <div style="position:absolute;top:0;left:0;right:0;height:12px;background:url('${dataUrl}') repeat-x;pointer-events:none;"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:12px;background:url('${dataUrl}') repeat-x;transform:scaleY(-1);pointer-events:none;"></div>
        <div style="position:absolute;inset:14px;border:1.5px solid ${fc};pointer-events:none;"></div>`;
    }
    case 'none':
      return '';
    case 'classic':
    default:
      return '';
  }
}


const mkSerial = (numero) =>
  `JDY-${numero || '000'}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

// ── Hook: carga diseño global ──
export function useTicketDesign() {
  const [design,  setDesign]  = useState(DEFAULT_DESIGN);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    API.get('/ticket-templates')
      .then(r => {
        const def = (r.data || []).find(t => t.is_default);
        if (def?.design) {
          setDesign({ ...DEFAULT_DESIGN, ...normalizaDesign(def.design) });
        } else {
          return API.get('/ticket-design').then(r2 => {
            if (r2.data?.design) setDesign({ ...DEFAULT_DESIGN, ...normalizaDesign(r2.data.design) });
          });
        }
      })
      .catch(() => {
        API.get('/ticket-design')
          .then(r => { if (r.data?.design) setDesign({ ...DEFAULT_DESIGN, ...normalizaDesign(r.data.design) }); })
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);
  return { design, loading, reload };
}

// ── Hook: carga UNA plantilla específica ──
export function useTicketTemplate(templateId) {
  const [design,  setDesign]  = useState(DEFAULT_DESIGN);
  const [loading, setLoading] = useState(true);
  const [nombre,  setNombre]  = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const cargarDefault = () => API.get('/ticket-templates')
      .then(r => {
        if (cancelled) return;
        const def = (r.data || []).find(t => t.is_default);
        if (def?.design) {
          setDesign({ ...DEFAULT_DESIGN, ...normalizaDesign(def.design) });
          setNombre(def.nombre);
        }
      })
      .catch(() => {});

    if (templateId) {
      API.get(`/ticket-templates/${templateId}`)
        .then(r => {
          if (cancelled) return;
          if (r.data?.design) {
            setDesign({ ...DEFAULT_DESIGN, ...normalizaDesign(r.data.design) });
            setNombre(r.data.nombre);
          }
        })
        .catch(() => cargarDefault())
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      cargarDefault().finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [templateId]);

  return { design, loading, nombre };
}

// ════════════════════════════════════════════════════════════
//   buildTicketHTML — versión MONSTRUOSA
// ════════════════════════════════════════════════════════════
export function buildTicketHTML(d, r, numero, comprador, vendedor, copia) {
  const D = { ...DEFAULT_DESIGN, ...(d || {}) };

  const premioRaw = r?.premio || '';
  const { numero: premioNum, texto: premioTxt } = splitPremio(premioRaw);
  const fecha    = fmtFechaLoteria(r?.fecha_sorteo);
  const hora     = extraerHora(r?.fecha_sorteo, D.horaSort, r?.hora_sorteo);
  const valorTxt = fmtValorBoleto(r?.precio);
  const subPremio= r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const isOrig   = copia === 1;
  const nom      = comprador?.nombre || '';
  const num      = numero || '000';

  const loteriaCompleta = r?.loteria_ref
    ? `${r.loteria_ref}${hora ? ` ${hora}` : ''}`
    : D.loteriaText;

  // ── Capas decorativas (orden: imágenes fondo → shapes → watermark → contenido → frame) ──
  const customShapes = Array.isArray(D.customShapes) ? D.customShapes : [];
  const customImages = Array.isArray(D.customImages) ? D.customImages : [];

  // Imágenes con z-index bajo (fondo) y alto (frente) según prop layer
  const imagesBg    = customImages.filter(im => (im.layer || 'back') === 'back').map(buildImageHTML).join('');
  const imagesFg    = customImages.filter(im => im.layer === 'front').map(buildImageHTML).join('');
  const shapesBg    = customShapes.filter(sh => (sh.layer || 'back') === 'back').map(buildShapeHTML).join('');
  const shapesFg    = customShapes.filter(sh => sh.layer === 'front').map(buildShapeHTML).join('');
  const watermark   = buildWatermarkHTML(D);
  const frame       = buildFrameHTML(D);
  const paperTex    = buildPaperTextureCSS(D);

  // Glow del papel (gradient radial sutil)
  const paperBg = D.paperGlow
    ? `background:radial-gradient(ellipse at center, ${D.paperGlowColor || '#fff8d0'} 0%, ${D.bgPaper} 75%);`
    : `background:${D.bgPaper};`;

  return `
<div style="width:${D.ticketWidth}px;margin:14px auto;font-family:'Poppins','Arial Black',sans-serif;
  page-break-inside:avoid;${paperBg}${paperTex}border:${D.frameWidth || 2.5}px solid ${D.frameColor || D.colorBorde};
  display:flex;min-height:${D.ticketHeight}px;position:relative;overflow:hidden;">

  <!-- ═══ CAPA 0: Imágenes de fondo ═══ -->
  ${imagesBg}

  <!-- ═══ CAPA 1: Formas decorativas de fondo ═══ -->
  ${shapesBg}

  <!-- ═══ CAPA 2: Watermark ═══ -->
  ${watermark}

  <!-- ═══ TALÓN VERTICAL IZQUIERDO ═══ -->
  <div style="width:115px;flex-shrink:0;border-right:2px dashed ${D.colorBorde};
    display:flex;flex-direction:column;align-items:center;padding:10px 6px;position:relative;z-index:2;">

    <div style="border:2px solid ${D.colorBorde};padding:6px 12px;
      font-size:${px(D.sizeNumTalon)}px;font-weight:900;color:${D.colorTalon};
      letter-spacing:2px;background:#fff;margin-bottom:14px;">
      ${num}
    </div>

    <div style="font-size:${px(D.sizeNombre)}px;font-weight:700;color:#000;
      align-self:flex-start;margin-left:2px;margin-top:6px;">
      NOMBRE: ${isOrig ? '' : `<span style="font-weight:500;font-size:${px(Math.max(6, D.sizeNombre - 2))}px;">(copia)</span>`}
    </div>
    <div style="font-size:${px(Math.max(6, D.sizeNombre - 2))}px;color:#666;align-self:flex-start;
      margin-left:2px;margin-top:auto;margin-bottom:4px;letter-spacing:.5px;">
      Tel:
    </div>

    <div style="position:absolute;right:-2px;top:50%;
      transform:translateY(-50%) rotate(-90deg);transform-origin:center;
      font-size:${px(D.sizeBrand)}px;font-weight:900;color:${D.colorTalon};
      letter-spacing:4px;white-space:nowrap;font-style:italic;">
      ${D.brandText}
    </div>
  </div>

  <!-- Tira vertical "BOLETO SIN CANCELAR..." -->
  <div style="width:22px;flex-shrink:0;border-right:1px solid ${D.colorBorde};
    display:flex;align-items:center;justify-content:center;position:relative;z-index:2;">
    <div style="transform:rotate(-90deg);white-space:nowrap;
      font-size:${px(D.sizeTalonText)}px;font-weight:800;color:#000;letter-spacing:2px;">
      ${D.talonText}
    </div>
  </div>

  <!-- ═══ CUERPO PRINCIPAL ═══ -->
  <div style="flex:1;padding:8px 10px 8px 14px;position:relative;display:flex;flex-direction:column;z-index:2;">

    <!-- Cabecera -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="flex:1;">
        <div style="font-size:${px(D.sizeSlogan)}px;font-weight:900;color:${D.colorSlogan};
          letter-spacing:1px;text-transform:uppercase;line-height:1;
          -webkit-text-stroke:.5px ${D.colorBorde};text-shadow:1px 1px 0 rgba(0,0,0,.15);">
          ${D.sloganTop}
        </div>
        <div style="font-size:${px(D.sizeFecha)}px;font-weight:800;color:${D.colorFecha};
          font-style:italic;letter-spacing:.5px;margin-top:2px;line-height:1;">
          ${D.fechaPrefix} ${fecha}
        </div>
      </div>

      <div style="border:2px solid ${D.colorBorde};padding:6px 14px;
        font-size:${px(D.sizeNumDer)}px;font-weight:900;color:${D.colorTalon};
        letter-spacing:2px;background:#fff;margin-left:8px;flex-shrink:0;">
        ${num}
      </div>
    </div>

    <!-- Bloque del PREMIO -->
    <div style="display:flex;flex:1;align-items:center;margin-top:4px;position:relative;">

      <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;padding-left:10px;">
        <div style="font-size:${px(D.sizePremioLabel)}px;font-weight:800;font-style:italic;
          color:${D.colorPremio1};letter-spacing:.5px;line-height:1;
          text-shadow:2px 2px 0 ${D.colorBorde};margin-left:30px;">
          ${D.premioLabel}
        </div>

        <div style="font-family:'Arial Black','Poppins',sans-serif;font-weight:900;
          font-size:${px(D.sizePremioNum)}px;line-height:.85;letter-spacing:2px;
          background:linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%);
          -webkit-background-clip:text;background-clip:text;
          -webkit-text-fill-color:transparent;
          -webkit-text-stroke:2.5px ${D.colorPremioStroke || D.colorBorde};
          filter:drop-shadow(3px 3px 0 ${D.colorBorde}30);">
          ${premioNum || '500'}
        </div>

        ${premioTxt ? `
        <div style="font-family:'Brush Script MT','Lucida Handwriting',cursive;
          font-size:${px(D.sizePremioTxt)}px;font-weight:700;color:${D.colorDolares};font-style:italic;
          line-height:1;margin-top:-12px;margin-left:auto;margin-right:80px;
          text-shadow:2px 2px 0 ${D.colorBorde}40;">
          ${premioTxt}
        </div>` : ''}

        ${subPremio ? `
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:6px;margin-left:10px;">
          <span style="font-size:${px(D.sizeSubPremio)}px;font-weight:900;color:${D.colorSubPremio};
            font-style:italic;text-shadow:1.5px 1.5px 0 ${D.colorBorde}40;">
            ${D.subPremioPrefix} ${subPremio}
          </span>
          <span style="font-family:'Brush Script MT','Lucida Handwriting',cursive;
            font-size:${px(D.sizeSubMoneda)}px;font-weight:700;color:${D.colorPesosSub};font-style:italic;
            text-shadow:1px 1px 0 ${D.colorBorde}40;">
            ${D.subPremioMoneda}
          </span>
        </div>` : ''}
      </div>

      <div style="width:160px;flex-shrink:0;display:flex;flex-direction:column;
        justify-content:space-between;align-items:flex-end;padding:6px 4px;height:100%;">

        <div style="writing-mode:vertical-rl;
          font-size:${px(D.sizeCaduca)}px;font-weight:700;color:${D.colorCaduca};
          letter-spacing:.5px;align-self:flex-end;font-style:italic;">
          ${D.caducaText}
        </div>

        <div style="text-align:right;font-size:${px(D.sizeLoteria)}px;font-weight:700;
          color:${D.colorLoteria};line-height:1.15;font-style:italic;margin-top:auto;">
          ${loteriaCompleta}
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;
      margin-top:6px;padding-top:6px;border-top:1px dashed ${D.colorBorde}40;">

      <div style="flex:1;font-size:${px(D.sizeMotivac)}px;font-weight:600;color:${D.colorMotivac};
        font-style:italic;line-height:1.2;padding-right:10px;max-width:55%;">
        ${D.motivacionalText}
      </div>

      <div style="text-align:right;line-height:1;">
        <div style="font-size:${px(D.sizeBoleto)}px;font-weight:900;color:${D.colorBoleto};
          letter-spacing:1px;text-shadow:1.5px 1.5px 0 ${D.colorBorde}40;">
          ${D.boletoLabel}
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;justify-content:flex-end;">
          <span style="font-size:${px(D.sizeValor)}px;font-weight:900;color:${D.colorValor};
            font-style:italic;line-height:1;text-shadow:2px 2px 0 ${D.colorBorde}40;">
            ${valorTxt}
          </span>
          <span style="font-size:${px(D.sizePesos)}px;font-weight:900;color:${D.colorPesos};
            letter-spacing:.5px;text-shadow:1.5px 1.5px 0 ${D.colorBorde}40;">
            ${D.valorSufijo}
          </span>
        </div>
      </div>
    </div>

    ${D.footerText ? `
    <div style="font-size:${px(D.sizeFooter)}px;color:#999;text-align:center;margin-top:4px;letter-spacing:.5px;">
      ${D.footerText}${nom ? ` · ${nom}` : ''}${vendedor ? ` · Vend: ${vendedor}` : ''}
    </div>` : ''}
  </div>

  <!-- ═══ CAPA TOP: Formas decorativas al frente ═══ -->
  ${shapesFg}

  <!-- ═══ CAPA TOP: Imágenes al frente ═══ -->
  ${imagesFg}

  <!-- ═══ MARCO DECORATIVO ═══ -->
  ${frame}
</div>`;
}

// ════════════════════════════════════════════════════════════
//   COMPONENTES REACT — Renderizado de capas decorativas
// ════════════════════════════════════════════════════════════

// ── Forma SVG como componente React ──
export function DecorativeShape({ shape, scale = 1, selected, onSelect, draggable, onMove }) {
  if (!shape) return null;
  const op       = shape.opacity != null ? shape.opacity : 1;
  const rot      = shape.rotation || 0;
  const w        = shape.width  || 80;
  const h        = shape.height || 80;
  const color    = shape.color || '#000';
  const color2   = shape.color2 || color;
  const stroke   = shape.strokeColor || 'none';
  const strokeW  = shape.strokeWidth != null ? shape.strokeWidth : 0;
  const gradId   = `g_${shape.id}`;
  const fill     = color !== color2 ? `url(#${gradId})` : color;

  const wrapperStyle = {
    position: 'absolute',
    left: shape.x,
    top: shape.y,
    width: w,
    height: h,
    transform: `rotate(${rot}deg)`,
    transformOrigin: 'center',
    opacity: op,
    pointerEvents: draggable ? 'auto' : 'none',
    outline: selected ? '2px solid #0abfbc' : 'none',
    outlineOffset: 3,
    cursor: draggable ? 'grab' : 'default',
    zIndex: shape.layer === 'front' ? 50 : 0,
  };

  const renderSVG = () => {
    const defs = (
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
    );

    switch (shape.type) {
      case 'arrow':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            {defs}
            <polygon points="0,30 60,30 60,10 100,50 60,90 60,70 0,70"
              fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'star': {
        const points = shape.points || 5;
        const outer = 50, inner = 22;
        const cx = 50, cy = 50;
        const pts = [];
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? outer : inner;
          const ang = (i * Math.PI) / points - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
        }
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      }
      case 'circle':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <circle cx="50" cy="50" r="48" fill={fill} stroke={stroke} strokeWidth={strokeW} />
          </svg>
        );
      case 'ring': {
        const innerR = shape.innerRadius || 32;
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <path d={`M50 2 A48 48 0 1 1 49.99 2 Z M50 ${50 - innerR} A${innerR} ${innerR} 0 1 0 50.01 ${50 - innerR} Z`}
              fill={fill} fillRule="evenodd" stroke={stroke} strokeWidth={strokeW} />
          </svg>
        );
      }
      case 'rect': {
        const rad = shape.borderRadius != null ? shape.borderRadius : 0;
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            {defs}
            <rect x="0" y="0" width="100" height="100" rx={rad} ry={rad}
              fill={fill} stroke={stroke} strokeWidth={strokeW} />
          </svg>
        );
      }
      case 'line':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="50" x2="100" y2="50"
              stroke={color} strokeWidth={strokeW > 0 ? strokeW : 4}
              strokeLinecap="round" strokeDasharray={shape.dashed ? '6,4' : 'none'} />
          </svg>
        );
      case 'triangle':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            {defs}
            <polygon points="50,5 95,90 5,90" fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'diamond':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            {defs}
            <polygon points="50,2 98,50 50,98 2,50" fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'heart':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <path d="M50 88 C50 88 5 60 5 32 C5 18 16 8 28 8 C38 8 46 14 50 22 C54 14 62 8 72 8 C84 8 95 18 95 32 C95 60 50 88 50 88 Z"
              fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'lightning':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <polygon points="55,2 25,55 48,55 35,98 78,40 55,40 70,2"
              fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'burst': {
        const spikes = 12;
        const pts = [];
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? 48 : 28;
          const ang = (i * Math.PI) / spikes - Math.PI / 2;
          pts.push(`${50 + r * Math.cos(ang)},${50 + r * Math.sin(ang)}`);
        }
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      }
      case 'sparkle':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <polygon points="50,5 56,44 95,50 56,56 50,95 44,56 5,50 44,44"
              fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'ribbon':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            {defs}
            <polygon points="0,15 100,15 100,75 80,75 100,95 60,75 40,75 0,95 20,75 0,75"
              fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      case 'banner':
        return (
          <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
            {defs}
            <polygon points="5,20 95,20 95,75 88,75 95,90 50,80 5,90 12,75 5,75"
              fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
            <polygon points="0,30 5,20 5,75 0,75" fill={color2} opacity="0.6" />
            <polygon points="100,30 95,20 95,75 100,75" fill={color2} opacity="0.6" />
          </svg>
        );
      case 'stamp': {
        const teeth = 24;
        const pts = [];
        for (let i = 0; i < teeth; i++) {
          const ang = (i * 2 * Math.PI) / teeth - Math.PI / 2;
          const r = i % 2 === 0 ? 48 : 42;
          pts.push(`${50 + r * Math.cos(ang)},${50 + r * Math.sin(ang)}`);
        }
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <polygon points={pts.join(' ')} fill="none" stroke={color} strokeWidth="3" />
            <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeWidth="2" />
            {shape.label && (
              <text x="50" y="56" textAnchor="middle" fontFamily="Arial Black"
                fontSize="14" fontWeight="900" fill={color}>
                {shape.label}
              </text>
            )}
          </svg>
        );
      }
      case 'polygon': {
        const sides = shape.sides || 6;
        const pts = [];
        for (let i = 0; i < sides; i++) {
          const ang = (i * 2 * Math.PI) / sides - Math.PI / 2;
          pts.push(`${50 + 48 * Math.cos(ang)},${50 + 48 * Math.sin(ang)}`);
        }
        return (
          <svg width={w} height={h} viewBox="0 0 100 100">
            {defs}
            <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </svg>
        );
      }
      default:
        return null;
    }
  };

  const inner = renderSVG();
  if (!draggable) {
    return <div style={wrapperStyle}>{inner}</div>;
  }

  // Modo editable: añade handlers de drag
  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.type === 'mousedown' && e.button !== 0) return;
    const point = e.touches ? e.touches[0] : e;
    const startX = point.clientX;
    const startY = point.clientY;
    const startPosX = shape.x;
    const startPosY = shape.y;
    let started = false;
    const move = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      if (!started && Math.hypot(dx, dy) < 5) return;
      started = true;
      if (ev.cancelable) ev.preventDefault();
      const s = scale || 1;
      onMove && onMove(shape.id, {
        x: Math.round(startPosX + dx / s),
        y: Math.round(startPosY + dy / s),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      onSelect && onSelect(shape.id);
    };
    if (e.touches) {
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);
    } else {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
  };

  return (
    <div style={wrapperStyle}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      title="Click: seleccionar · Arrastra: mover">
      {inner}
    </div>
  );
}

// ── Imagen decorativa como componente React ──
export function DecorativeImage({ image, scale = 1, selected, onSelect, draggable, onMove }) {
  if (!image || !image.src) return null;
  const filters = [];
  if (image.grayscale)  filters.push(`grayscale(${image.grayscale})`);
  if (image.sepia)      filters.push(`sepia(${image.sepia})`);
  if (image.blur)       filters.push(`blur(${image.blur}px)`);
  if (image.brightness) filters.push(`brightness(${image.brightness})`);

  const style = {
    position: 'absolute',
    left: image.x,
    top: image.y,
    width: image.width,
    height: image.height,
    transform: `rotate(${image.rotation || 0}deg)`,
    transformOrigin: 'center',
    opacity: image.opacity != null ? image.opacity : 1,
    mixBlendMode: image.blendMode || 'normal',
    borderRadius: image.borderRadius || 0,
    filter: filters.length ? filters.join(' ') : 'none',
    pointerEvents: draggable ? 'auto' : 'none',
    objectFit: image.objectFit || 'cover',
    outline: selected ? '2px solid #0abfbc' : 'none',
    outlineOffset: 3,
    cursor: draggable ? 'grab' : 'default',
    zIndex: image.layer === 'front' ? 50 : 0,
    userSelect: 'none',
  };

  if (!draggable) {
    return <img src={image.src} alt="" crossOrigin="anonymous" style={style} draggable={false} />;
  }

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    const startX = point.clientX, startY = point.clientY;
    const startPosX = image.x, startPosY = image.y;
    let started = false;
    const move = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      if (!started && Math.hypot(dx, dy) < 5) return;
      started = true;
      if (ev.cancelable) ev.preventDefault();
      const s = scale || 1;
      onMove && onMove(image.id, {
        x: Math.round(startPosX + dx / s),
        y: Math.round(startPosY + dy / s),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      onSelect && onSelect(image.id);
    };
    if (e.touches) {
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);
    } else {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
  };

  return (
    <img src={image.src} alt="" crossOrigin="anonymous" style={style}
      draggable={false}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      title="Click: seleccionar · Arrastra: mover" />
  );
}

// ── Watermark React ──
export function WatermarkLayer({ design: D }) {
  if (!D.watermarkEnabled || !D.watermarkText) return null;
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: `translate(-50%, -50%) rotate(${D.watermarkRotation || -20}deg)`,
      fontFamily: "'Arial Black','Poppins',sans-serif", fontWeight: 900,
      fontSize: px(D.watermarkSize || 100),
      color: D.watermarkColor || '#000',
      opacity: D.watermarkOpacity != null ? D.watermarkOpacity : 0.06,
      letterSpacing: 8, whiteSpace: 'nowrap',
      pointerEvents: 'none', userSelect: 'none', zIndex: 1,
    }}>{D.watermarkText}</div>
  );
}

// ── Marco decorativo React ──
export function FrameLayer({ design: D }) {
  const fc = D.frameColor || D.colorBorde || '#000';
  const fw = D.frameWidth || 2.5;
  switch (D.frameStyle) {
    case 'doubleline':
      return <div style={{ position: 'absolute', inset: 6, border: `${fw * 0.6}px solid ${fc}`, pointerEvents: 'none', zIndex: 100 }} />;
    case 'dashed':
      return <div style={{ position: 'absolute', inset: 4, border: `${fw}px dashed ${fc}`, pointerEvents: 'none', zIndex: 100 }} />;
    case 'rounded':
      return <div style={{ position: 'absolute', inset: 0, border: `${fw}px solid ${fc}`, borderRadius: 14, pointerEvents: 'none', zIndex: 100 }} />;
    case 'corners': {
      const sz = 28;
      const cornerStyle = (base) => ({
        position: 'absolute', width: sz, height: sz,
        border: `${fw + 1}px solid ${fc}`, pointerEvents: 'none', zIndex: 100,
        ...base,
      });
      return (
        <>
          <div style={cornerStyle({ left: 6, top: 6, borderRight: 'none', borderBottom: 'none' })} />
          <div style={cornerStyle({ right: 6, top: 6, borderLeft: 'none', borderBottom: 'none' })} />
          <div style={cornerStyle({ left: 6, bottom: 6, borderRight: 'none', borderTop: 'none' })} />
          <div style={cornerStyle({ right: 6, bottom: 6, borderLeft: 'none', borderTop: 'none' })} />
        </>
      );
    }
    case 'ornate':
      return (
        <>
          <div style={{ position: 'absolute', inset: 8, border: `${fw}px solid ${fc}`, pointerEvents: 'none', zIndex: 100 }} />
          {[[4,4],[96,4],[4,96],[96,96]].map(([x,y],i) => (
            <div key={i} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: 6, height: 6, marginLeft: -3, marginTop: -3,
              background: fc, borderRadius: '50%',
              pointerEvents: 'none', zIndex: 101,
            }} />
          ))}
        </>
      );
    case 'greca': {
      const grecaSVG = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'><path d='M0 8 L4 8 L4 2 L8 2 L8 8 L12 8 L12 2 L16 2 L16 8 L20 8' stroke='${fc}' stroke-width='1.2' fill='none'/></svg>`
      );
      const dataUrl = `url("data:image/svg+xml;utf8,${grecaSVG}")`;
      return (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12,
            backgroundImage: dataUrl, backgroundRepeat: 'repeat-x',
            pointerEvents: 'none', zIndex: 100 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12,
            backgroundImage: dataUrl, backgroundRepeat: 'repeat-x',
            transform: 'scaleY(-1)', pointerEvents: 'none', zIndex: 100 }} />
          <div style={{ position: 'absolute', inset: 14, border: `1.5px solid ${fc}`,
            pointerEvents: 'none', zIndex: 100 }} />
        </>
      );
    }
    default:
      return null;
  }
}

// ── CSS background del papel (calculado para React) ──
export function getPaperBgStyle(D) {
  let bg = {};
  if (D.paperGlow) {
    bg.background = #ffffff;
  } else {
    bg.background = D.bgPaper;
  }
  // Textura como pseudo-elemento no es trivial inline; usamos backgroundImage encima
  if (D.paperTexture && D.paperTexture !== 'none') {
    const op = D.paperTextureOpacity != null ? D.paperTextureOpacity : 0.08;
    let svg = '';
    switch (D.paperTexture) {
      case 'dots':
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='1' fill='black' fill-opacity='${op}'/></svg>`;
        break;
      case 'lines':
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><path d='M0 15 L30 15' stroke='black' stroke-opacity='${op}' stroke-width='.5'/></svg>`;
        break;
      case 'grid':
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='25' height='25'><path d='M0 0L25 0M0 0L0 25' stroke='black' stroke-opacity='${op}' stroke-width='.5' fill='none'/></svg>`;
        break;
      case 'noise':
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100' height='100' filter='url(%23n)' opacity='${op}'/></svg>`;
        break;
      case 'aged':
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><filter id='a'><feTurbulence baseFrequency='0.05' numOctaves='2'/><feColorMatrix values='0 0 0 0 .55  0 0 0 0 .42  0 0 0 0 .2  0 0 0 ${op * 1.5} 0'/></filter></defs><rect width='200' height='200' filter='url(%23a)'/></svg>`;
        break;
    }
    if (svg) {
      const dataUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
      bg.backgroundImage = `${dataUrl}, ${bg.background}`;
      bg.backgroundRepeat = 'repeat, no-repeat';
      delete bg.background;
    }
  }
  return bg;
}


// ════════════════════════════════════════════════════════════
//   TicketPreview — versión React inline (con capas)
// ════════════════════════════════════════════════════════════
export function TicketPreview({ r, rifa, numero, comprador, vendedor, design: dProp }) {
  const rifaData = r || rifa || {};
  const D        = { ...DEFAULT_DESIGN, ...(dProp || {}) };

  const premioRaw = rifaData?.premio || '';
  const { numero: premioNum, texto: premioTxt } = splitPremio(premioRaw);
  const fecha     = fmtFechaLoteria(rifaData?.fecha_sorteo);
  const hora      = extraerHora(rifaData?.fecha_sorteo, D.horaSort, rifaData?.hora_sorteo);
  const valorTxt  = fmtValorBoleto(rifaData?.precio || 0);
  const subPremio = rifaData?.premio_secundario ? fmtMilesPunto(rifaData.premio_secundario) : '';
  const nom       = comprador?.nombre || '';
  const num       = numero || '000';

  const loteriaCompleta = rifaData?.loteria_ref
    ? `${rifaData.loteria_ref}${hora ? ` ${hora}` : ''}`
    : D.loteriaText;

  const STROKE = D.colorBorde;

  // Capas
  const customShapes = Array.isArray(D.customShapes) ? D.customShapes : [];
  const customImages = Array.isArray(D.customImages) ? D.customImages : [];

  const paperBg = getPaperBgStyle(D);

  return (
    <div style={{
      width:'100%', maxWidth:D.ticketWidth, margin:'0 auto',
      fontFamily:"'Poppins','Arial Black',sans-serif",
      ...paperBg,
      border:`${D.frameWidth || 2.5}px solid ${D.frameColor || STROKE}`,
      display:'flex', minHeight:D.ticketHeight, position:'relative',
      overflow:'hidden',
    }}>

      {/* ── Imágenes fondo ── */}
      {customImages.filter(im => (im.layer || 'back') === 'back').map(im => (
        <DecorativeImage key={im.id} image={im} />
      ))}

      {/* ── Formas fondo ── */}
      {customShapes.filter(sh => (sh.layer || 'back') === 'back').map(sh => (
        <DecorativeShape key={sh.id} shape={sh} />
      ))}

      {/* ── Watermark ── */}
      <WatermarkLayer design={D} />

      {/* ── Talón vertical izquierdo ── */}
      <div style={{
        width:115, flexShrink:0, borderRight:`2px dashed ${STROKE}`,
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'10px 6px', position:'relative', zIndex:2,
      }}>
        <div style={{
          border:`2px solid ${STROKE}`, padding:'6px 12px',
          fontSize:px(D.sizeNumTalon), fontWeight:900, color:D.colorTalon,
          letterSpacing:2, background:'#fff', marginBottom:14,
        }}>{num}</div>

        <div style={{
          fontSize:px(D.sizeNombre), fontWeight:700, color:'#000',
          alignSelf:'flex-start', marginLeft:2, marginTop:6,
        }}>NOMBRE:</div>

        <div style={{ flex:1, width:'100%' }}></div>

        <div style={{
          fontSize:px(Math.max(6, D.sizeNombre - 2)), color:'#666', alignSelf:'flex-start',
          marginLeft:2, marginBottom:4, letterSpacing:.5,
        }}>Tel:</div>

        <div style={{
          position:'absolute', right:-2, top:'50%',
          transform:'translateY(-50%) rotate(-90deg)', transformOrigin:'center',
          fontSize:px(D.sizeBrand), fontWeight:900, color:D.colorTalon,
          letterSpacing:4, whiteSpace:'nowrap', fontStyle:'italic',
        }}>{D.brandText}</div>
      </div>

      {/* ── Tira vertical ── */}
      <div style={{
        width:22, flexShrink:0, borderRight:`1px solid ${STROKE}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', zIndex:2,
      }}>
        <div style={{
          transform:'rotate(-90deg)', whiteSpace:'nowrap',
          fontSize:px(D.sizeTalonText), fontWeight:800, color:'#000', letterSpacing:2,
        }}>{D.talonText}</div>
      </div>

      {/* ── Cuerpo principal ── */}
      <div style={{
        flex:1, padding:'8px 10px 8px 14px',
        display:'flex', flexDirection:'column', position:'relative', zIndex:2,
      }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{
              fontSize:px(D.sizeSlogan), fontWeight:900, color:D.colorSlogan,
              letterSpacing:1, textTransform:'uppercase', lineHeight:1,
              WebkitTextStroke:`.5px ${STROKE}`,
              textShadow:'1px 1px 0 rgba(0,0,0,.15)',
            }}>{D.sloganTop}</div>
            <div style={{
              fontSize:px(D.sizeFecha), fontWeight:800, color:D.colorFecha,
              fontStyle:'italic', letterSpacing:.5, marginTop:2, lineHeight:1,
            }}>{D.fechaPrefix} {fecha}</div>
          </div>
          <div style={{
            border:`2px solid ${STROKE}`, padding:'6px 14px',
            fontSize:px(D.sizeNumDer), fontWeight:900, color:D.colorTalon,
            letterSpacing:2, background:'#fff', marginLeft:8, flexShrink:0,
          }}>{num}</div>
        </div>

        <div style={{ display:'flex', flex:1, alignItems:'center', marginTop:4 }}>

          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            alignItems:'flex-start', paddingLeft:10,
          }}>
            <div style={{
              fontSize:px(D.sizePremioLabel), fontWeight:800, fontStyle:'italic',
              color:D.colorPremio1, letterSpacing:.5, lineHeight:1,
              textShadow:`2px 2px 0 ${STROKE}`, marginLeft:30,
            }}>{D.premioLabel}</div>

            <div style={{
              fontFamily:"'Arial Black','Poppins',sans-serif", fontWeight:900,
              fontSize:px(D.sizePremioNum), lineHeight:.85, letterSpacing:2,
              background:`linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
              WebkitBackgroundClip:'text', backgroundClip:'text',
              WebkitTextFillColor:'transparent',
              WebkitTextStroke:`2.5px ${D.colorPremioStroke || STROKE}`,
              filter:`drop-shadow(3px 3px 0 ${STROKE}30)`,
            }}>{premioNum || '500'}</div>

            {premioTxt && (
              <div style={{
                fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                fontSize:px(D.sizePremioTxt), fontWeight:700, color:D.colorDolares,
                fontStyle:'italic', lineHeight:1, marginTop:-12,
                marginLeft:'auto', marginRight:80,
                textShadow:`2px 2px 0 ${STROKE}40`,
              }}>{premioTxt}</div>
            )}

            {subPremio && (
              <div style={{
                display:'flex', alignItems:'baseline', gap:8,
                marginTop:6, marginLeft:10,
              }}>
                <span style={{
                  fontSize:px(D.sizeSubPremio), fontWeight:900, color:D.colorSubPremio,
                  fontStyle:'italic', textShadow:`1.5px 1.5px 0 ${STROKE}40`,
                }}>{D.subPremioPrefix} {subPremio}</span>
                <span style={{
                  fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                  fontSize:px(D.sizeSubMoneda), fontWeight:700, color:D.colorPesosSub,
                  fontStyle:'italic', textShadow:`1px 1px 0 ${STROKE}40`,
                }}>{D.subPremioMoneda}</span>
              </div>
            )}
          </div>

          <div style={{
            width:160, flexShrink:0, display:'flex', flexDirection:'column',
            justifyContent:'space-between', alignItems:'flex-end',
            padding:'6px 4px', alignSelf:'stretch',
          }}>
            <div style={{
              writingMode:'vertical-rl',
              fontSize:px(D.sizeCaduca), fontWeight:700, color:D.colorCaduca,
              letterSpacing:.5, alignSelf:'flex-end', fontStyle:'italic',
            }}>{D.caducaText}</div>

            <div style={{
              textAlign:'right', fontSize:px(D.sizeLoteria), fontWeight:700,
              color:D.colorLoteria, lineHeight:1.15, fontStyle:'italic',
              marginTop:'auto',
            }}>{loteriaCompleta}</div>
          </div>
        </div>

        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          marginTop:6, paddingTop:6, borderTop:`1px dashed ${STROKE}40`,
        }}>
          <div style={{
            flex:1, fontSize:px(D.sizeMotivac), fontWeight:600, color:D.colorMotivac,
            fontStyle:'italic', lineHeight:1.2, paddingRight:10, maxWidth:'55%',
          }}>{D.motivacionalText}</div>

          <div style={{ textAlign:'right', lineHeight:1 }}>
            <div style={{
              fontSize:px(D.sizeBoleto), fontWeight:900, color:D.colorBoleto,
              letterSpacing:1, textShadow:`1.5px 1.5px 0 ${STROKE}40`,
            }}>{D.boletoLabel}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, justifyContent:'flex-end' }}>
              <span style={{
                fontSize:px(D.sizeValor), fontWeight:900, color:D.colorValor,
                fontStyle:'italic', lineHeight:1,
                textShadow:`2px 2px 0 ${STROKE}40`,
              }}>{valorTxt}</span>
              <span style={{
                fontSize:px(D.sizePesos), fontWeight:900, color:D.colorPesos,
                letterSpacing:.5, textShadow:`1.5px 1.5px 0 ${STROKE}40`,
              }}>{D.valorSufijo}</span>
            </div>
          </div>
        </div>

        {D.footerText && (
          <div style={{
            fontSize:px(D.sizeFooter), color:'#999', textAlign:'center',
            marginTop:4, letterSpacing:.5,
          }}>
            {D.footerText}
            {nom && ` · ${nom}`}
            {vendedor && ` · Vend: ${vendedor}`}
          </div>
        )}
      </div>

      {/* ── Capas FRONT (sobre el contenido) ── */}
      {customShapes.filter(sh => sh.layer === 'front').map(sh => (
        <DecorativeShape key={sh.id} shape={sh} />
      ))}
      {customImages.filter(im => im.layer === 'front').map(im => (
        <DecorativeImage key={im.id} image={im} />
      ))}

      {/* ── Marco decorativo ── */}
      <FrameLayer design={D} />
    </div>
  );
}


// ════════════════════════════════════════════════════════════
//   printTickets — abre ventana de impresión
// ════════════════════════════════════════════════════════════
export function printTickets(rifasArr, numero, comprador, vendedor, design) {
  const d = { ...DEFAULT_DESIGN, ...(design || {}) };

  const STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#e8e8e0;display:flex;flex-direction:column;align-items:center;
      gap:18px;padding:18px;font-family:'Poppins','Arial Black',sans-serif;}
    @media print{
      body{background:#fff;padding:4px;gap:10px;}
      @page{size:landscape;margin:5mm;}
    }
  `;

  const html = rifasArr.flatMap(r => [1, 2].map(c =>
    buildTicketHTML(d, r, numero, comprador, vendedor, c)
  )).join('\n');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Boleto #${numero} — ${d.brandText}</title>
    <style>${STYLE}</style>
  </head><body>${html}
    <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},500);};<\/script>
  </body></html>`);
  win.document.close();
}

// ════════════════════════════════════════════════════════════
//   generarImagenTicket — exporta el ticket como PNG
// ════════════════════════════════════════════════════════════
export async function generarImagenTicket({ r, numero, comprador, vendedor, design }) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const d = { ...DEFAULT_DESIGN, ...(design || {}) };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;padding:20px;background:#e8e8e0;display:inline-block;';
    document.body.appendChild(wrapper);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(wrapper);
    const { createElement } = await import('react');

    await new Promise(resolve => {
      root.render(createElement(TicketPreview, { r, numero, comprador, vendedor, design: d }));
      // Más tiempo para que cargue imágenes externas
      setTimeout(resolve, 800);
    });

    const canvas = await html2canvas(wrapper, {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#e8e8e0',
    });

    root.unmount();
    document.body.removeChild(wrapper);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
//   Ticket — default export
// ════════════════════════════════════════════════════════════
export default function Ticket({ rifa, numero, comprador, vendedor, onClose }) {
  const rifasArr = Array.isArray(rifa) ? rifa.filter(r => r.disponible !== false) : rifa ? [rifa] : [];

  const primeraRifa = rifasArr[0];
  const templateId  = primeraRifa?.ticket_template_id || null;

  const { design: designGlobal } = useTicketDesign();
  const { design: designTpl }    = useTicketTemplate(templateId);

  const efectivo = primeraRifa?.ticket_design
    ? { ...DEFAULT_DESIGN, ...primeraRifa.ticket_design }
    : (templateId ? designTpl : designGlobal);

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:20, justifyContent:'center', marginBottom:22 }}>
        {rifasArr.map(r => (
          <TicketPreview
            key={r.rifa_id || r.id || Math.random()}
            r={r} numero={numero}
            comprador={comprador} vendedor={vendedor}
            design={efectivo}
          />
        ))}
      </div>
      <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn-jordyn"
          onClick={() => printTickets(rifasArr, numero, comprador, vendedor, efectivo)}
          style={{ fontSize:'1rem', padding:'.75rem 2.2rem' }}>
          <i className="bi bi-printer-fill me-2"></i>
          IMPRIMIR {rifasArr.length > 1 ? 'BOLETOS' : 'BOLETO'} (2 COPIAS)
        </button>
        {onClose && (
          <button className="btn-jordyn-outline" onClick={onClose} style={{ padding:'.75rem 1.6rem' }}>
            <i className="bi bi-x-lg me-1"></i>CERRAR
          </button>
        )}
      </div>
    </div>
  );
}