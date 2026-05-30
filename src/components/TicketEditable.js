// ════════════════════════════════════════════════════════════════
//   components/TicketEditable.js  (v2 MONSTRUOSO)
//   RIFAS JORDYN — Editor estilo Canva
//
//   NUEVAS CAPACIDADES:
//   ▸ Botón "+ Forma"     → flechas, estrellas, círculos, rayos,
//                            sellos, ribbons, corazones, etc.
//   ▸ Botón "+ Imagen"    → URL de imagen / blend modes / filtros
//   ▸ Botón "🖼 Marco"     → 7 estilos de marco del ticket
//   ▸ Botón "💧 Watermark" → marca de agua central editable
//   ▸ Botón "📜 Textura"   → papel envejecido, dots, lines, grid
//   ▸ Botón "🎭 Presets"   → diseños predefinidos espectaculares
//   ▸ Por texto: textStroke (contorno/margen), textGlow, sombra 3D,
//                gradiente de letra
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  DEFAULT_DESIGN,
  DecorativeShape,
  DecorativeImage,
  WatermarkLayer,
  FrameLayer,
  getPaperBgStyle,
} from './Ticket';

// ── Constantes ──────────────────────────────────────────
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);
const DRAG_THRESHOLD = 5;
const SNAP_GRID = 10;

// ── Subida de imagen desde galería ──────────────────────
// Lee un File (de <input type="file">), lo dibuja en un canvas,
// detecta si tiene transparencia (PNG/WebP sin fondo) y lo devuelve
// como dataURL (base64). Reescala a MAX_DIM para no inflar el JSON.
const MAX_IMG_DIM   = 1000;   // px del lado más largo
const MAX_DATAURL_KB = 2200;  // aviso si pasa de ~2.2 MB

function detectTransparency(ctx, w, h) {
  // Muestrea el canal alfa; si hay píxeles con alfa < 250 => tiene fondo transparente
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    let transparentes = 0;
    const total = w * h;
    // saltamos píxeles para que sea rápido en imágenes grandes
    const paso = Math.max(1, Math.floor(total / 40000));
    let muestreados = 0;
    for (let i = 3; i < data.length; i += 4 * paso) {
      muestreados++;
      if (data[i] < 250) transparentes++;
    }
    // se considera "sin fondo" si al menos ~0.5% de la muestra es transparente
    return muestreados > 0 && transparentes / muestreados > 0.005;
  } catch (e) {
    return false; // canvas "tainted" o error => asumimos sin transparencia
  }
}

function processImageFile(file, { maxDim = MAX_IMG_DIM } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No se recibió archivo'));
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('El archivo no es una imagen'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const imgEl = new Image();
      imgEl.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      imgEl.onload = () => {
        let { naturalWidth: w, naturalHeight: h } = imgEl;
        if (!w || !h) return reject(new Error('Imagen inválida'));

        // reescalado proporcional
        const escala = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * escala));
        const ch = Math.max(1, Math.round(h * escala));

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, cw, ch);

        // ¿PNG / WebP sin fondo? (JPEG nunca tiene alfa)
        const puedeTenerAlfa = /png|webp|gif/i.test(file.type);
        const transparente = puedeTenerAlfa && detectTransparency(ctx, cw, ch);

        // Si es transparente => PNG (conserva el fondo recortado).
        // Si no => JPEG comprimido (mucho más liviano).
        const dataUrl = transparente
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          dataUrl,
          transparente,
          width: cw,
          height: ch,
          aspect: cw / ch,
          sizeKB: Math.round((dataUrl.length * 0.75) / 1024),
        });
      };
      imgEl.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const FUENTES = [
  { label: 'Poppins',      val: "'Poppins', sans-serif" },
  { label: 'Arial Black',  val: "'Arial Black', sans-serif" },
  { label: 'Brush Script', val: "'Brush Script MT', cursive" },
  { label: 'Georgia',      val: "'Georgia', serif" },
  { label: 'Courier',      val: "'Courier New', monospace" },
  { label: 'Impact',       val: "'Impact', sans-serif" },
];

const PALETAS = [
  { id: 'tradicional', label: '🇪🇨 Tradicional',
    colors: { colorSlogan:'#d92626', colorFecha:'#1a3a8a', colorPremio1:'#f5c518', colorPremio2:'#1565d8', colorDolares:'#d92626', colorSubPremio:'#c41e7a', colorPesosSub:'#2e8b3e', colorBoleto:'#1565d8', colorValor:'#d92626', colorPesos:'#2e8b3e', colorTalon:'#1565d8' } },
  { id: 'venezolano', label: '🇻🇪 Venezolano',
    colors: { colorSlogan:'#cf142b', colorFecha:'#003893', colorPremio1:'#fcd116', colorPremio2:'#003893', colorDolares:'#cf142b', colorSubPremio:'#003893', colorPesosSub:'#cf142b', colorBoleto:'#003893', colorValor:'#cf142b', colorPesos:'#fcd116', colorTalon:'#003893' } },
  { id: 'colombiano', label: '🇨🇴 Colombiano',
    colors: { colorSlogan:'#ce1126', colorFecha:'#003893', colorPremio1:'#fcd116', colorPremio2:'#003893', colorDolares:'#ce1126', colorSubPremio:'#003893', colorPesosSub:'#ce1126', colorBoleto:'#003893', colorValor:'#ce1126', colorPesos:'#fcd116', colorTalon:'#003893' } },
  { id: 'sobrio', label: '⚫ Sobrio (B/N)',
    colors: { colorSlogan:'#1a1a1a', colorFecha:'#333', colorPremio1:'#1a1a1a', colorPremio2:'#666', colorDolares:'#1a1a1a', colorSubPremio:'#333', colorPesosSub:'#666', colorBoleto:'#1a1a1a', colorValor:'#1a1a1a', colorPesos:'#666', colorTalon:'#1a1a1a' } },
  { id: 'esmeralda', label: '💚 Esmeralda',
    colors: { colorSlogan:'#0d6e3a', colorFecha:'#1a4d2e', colorPremio1:'#d4af37', colorPremio2:'#0d6e3a', colorDolares:'#0d6e3a', colorSubPremio:'#1a4d2e', colorPesosSub:'#d4af37', colorBoleto:'#1a4d2e', colorValor:'#0d6e3a', colorPesos:'#d4af37', colorTalon:'#1a4d2e' } },
  { id: 'rubi', label: '❤️ Rubí & Oro',
    colors: { colorSlogan:'#8b0000', colorFecha:'#5a0010', colorPremio1:'#ffd700', colorPremio2:'#b8860b', colorDolares:'#8b0000', colorSubPremio:'#5a0010', colorPesosSub:'#ffd700', colorBoleto:'#5a0010', colorValor:'#8b0000', colorPesos:'#ffd700', colorTalon:'#5a0010' } },
  { id: 'neon', label: '⚡ Neón Eléctrico',
    colors: { colorSlogan:'#ff006e', colorFecha:'#3a0ca3', colorPremio1:'#fb5607', colorPremio2:'#3a0ca3', colorDolares:'#ff006e', colorSubPremio:'#3a0ca3', colorPesosSub:'#06ffa5', colorBoleto:'#3a0ca3', colorValor:'#ff006e', colorPesos:'#06ffa5', colorTalon:'#3a0ca3' } },
];

const TAMANOS_GLOBALES = [
  { label: 'Pequeño', factor: 0.8 },
  { label: 'Normal',  factor: 1.0 },
  { label: 'Grande',  factor: 1.2 },
  { label: 'X-Grande',factor: 1.4 },
];

// ── Tipos de forma disponibles ──
const TIPOS_FORMA = [
  { type: 'arrow',    label: 'Flecha',     icon: '➜' },
  { type: 'star',     label: 'Estrella',   icon: '★' },
  { type: 'burst',    label: 'Estallido',  icon: '✺' },
  { type: 'sparkle',  label: 'Destello',   icon: '✦' },
  { type: 'circle',   label: 'Círculo',    icon: '●' },
  { type: 'ring',     label: 'Anillo',     icon: '◯' },
  { type: 'rect',     label: 'Rectángulo', icon: '▭' },
  { type: 'triangle', label: 'Triángulo',  icon: '▲' },
  { type: 'diamond',  label: 'Rombo',      icon: '◆' },
  { type: 'heart',    label: 'Corazón',    icon: '♥' },
  { type: 'lightning',label: 'Rayo',       icon: '⚡' },
  { type: 'polygon',  label: 'Hexágono',   icon: '⬢' },
  { type: 'ribbon',   label: 'Listón',     icon: '🎀' },
  { type: 'banner',   label: 'Banner',     icon: '🏷' },
  { type: 'stamp',    label: 'Sello',      icon: '🔖' },
  { type: 'line',     label: 'Línea',      icon: '━' },
];

// ── Estilos de marco ──
const FRAMES = [
  { id: 'classic',    label: 'Clásico (solo borde)' },
  { id: 'doubleline', label: 'Doble línea' },
  { id: 'dashed',     label: 'Punteado' },
  { id: 'rounded',    label: 'Redondeado' },
  { id: 'corners',    label: 'Esquinas' },
  { id: 'ornate',     label: 'Ornamentado' },
  { id: 'greca',      label: 'Greca / Cenefa' },
  { id: 'none',       label: 'Sin borde' },
];

// ── Texturas de papel ──
const TEXTURAS = [
  { id: 'none',  label: 'Sin textura' },
  { id: 'dots',  label: 'Puntitos' },
  { id: 'lines', label: 'Rayitas' },
  { id: 'grid',  label: 'Cuadrícula' },
  { id: 'noise', label: 'Ruido' },
  { id: 'aged',  label: '📜 Papel envejecido' },
];

// ── Modos de mezcla para imágenes ──
const BLEND_MODES = [
  'normal','multiply','screen','overlay','darken','lighten',
  'color-dodge','color-burn','hard-light','soft-light','difference',
  'exclusion','hue','saturation','color','luminosity',
];

// ── Presets monstruosos ────────────────────────────────────
// Cada preset es un patch sobre el design; se aplica con spread.
const PRESETS = [
  {
    id: 'fuego',
    label: '🔥 Fuego & Llamas',
    patch: {
      bgPaper: '#fff7e6',
      paperGlow: true,
      paperGlowColor: '#ffe4a8',
      paperTexture: 'aged',
      paperTextureOpacity: 0.12,
      frameStyle: 'corners',
      frameColor: '#7a2200',
      frameWidth: 3,
      colorBorde: '#7a2200',
      watermarkEnabled: true,
      watermarkText: 'JACKPOT',
      watermarkColor: '#d92626',
      watermarkOpacity: 0.07,
      watermarkSize: 120,
      watermarkRotation: -18,
      colorSlogan: '#d92626',
      colorPremio1: '#ffb800',
      colorPremio2: '#d92626',
      customShapes: [
        { id: 'p1_burst1', type: 'burst', x: 540, y: 30, width: 90, height: 90, color: '#ffb800', color2: '#d92626', rotation: 15, opacity: 0.85, layer: 'back', strokeColor: '#7a2200', strokeWidth: 1.5 },
        { id: 'p1_star1',  type: 'star',  x: 460, y: 8,  width: 55, height: 55, color: '#ffd700', color2: '#ff8c00', rotation: 0, opacity: 0.9, layer: 'back', strokeColor: '#7a2200', strokeWidth: 1.2, points: 6 },
        { id: 'p1_light1', type: 'lightning', x: 130, y: 245, width: 35, height: 60, color: '#ffb800', color2: '#d92626', rotation: -10, opacity: 0.9, layer: 'front', strokeColor: '#7a2200', strokeWidth: 1.2 },
        { id: 'p1_spark1', type: 'sparkle', x: 695, y: 145, width: 40, height: 40, color: '#ffd700', color2: '#ffd700', rotation: 0, opacity: 0.95, layer: 'front', strokeColor: '#7a2200', strokeWidth: 1 },
        { id: 'p1_arr1',   type: 'arrow', x: 145, y: 305, width: 70, height: 20, color: '#d92626', color2: '#d92626', rotation: 0, opacity: 0.7, layer: 'back' },
      ],
    },
  },
  {
    id: 'oro',
    label: '👑 Oro Real',
    patch: {
      bgPaper: '#fff9e6',
      paperGlow: true,
      paperGlowColor: '#fff2c0',
      paperTexture: 'none',
      frameStyle: 'ornate',
      frameColor: '#8b6914',
      frameWidth: 3,
      colorBorde: '#8b6914',
      watermarkEnabled: true,
      watermarkText: '★ GANA ★',
      watermarkColor: '#b8860b',
      watermarkOpacity: 0.08,
      watermarkSize: 90,
      watermarkRotation: -15,
      colorSlogan: '#8b0000',
      colorPremio1: '#d4af37',
      colorPremio2: '#8b6914',
      colorDolares: '#8b0000',
      customShapes: [
        { id: 'p2_ring1',  type: 'ring', x: 480, y: 30, width: 110, height: 110, color: '#d4af37', color2: '#8b6914', rotation: 0, opacity: 0.18, layer: 'back', innerRadius: 38 },
        { id: 'p2_star1',  type: 'star', x: 360, y: 35, width: 50, height: 50, color: '#d4af37', color2: '#b8860b', rotation: 15, opacity: 0.9, layer: 'front', strokeColor: '#5a4500', strokeWidth: 1.5, points: 5 },
        { id: 'p2_star2',  type: 'star', x: 595, y: 200, width: 38, height: 38, color: '#d4af37', color2: '#b8860b', rotation: -10, opacity: 0.85, layer: 'front', strokeColor: '#5a4500', strokeWidth: 1.2, points: 5 },
        { id: 'p2_diam1',  type: 'diamond', x: 140, y: 12, width: 28, height: 28, color: '#d4af37', color2: '#fff', rotation: 0, opacity: 0.75, layer: 'front', strokeColor: '#8b6914', strokeWidth: 1 },
      ],
    },
  },
  {
    id: 'tropical',
    label: '🌴 Tropical',
    patch: {
      bgPaper: '#e8fdf5',
      paperGlow: true,
      paperGlowColor: '#ffd4a8',
      paperTexture: 'dots',
      paperTextureOpacity: 0.06,
      frameStyle: 'greca',
      frameColor: '#0d6e3a',
      colorBorde: '#0d6e3a',
      watermarkEnabled: false,
      colorSlogan: '#ff6b35',
      colorPremio1: '#ffd700',
      colorPremio2: '#0d6e3a',
      customShapes: [
        { id: 'p3_circ1',  type: 'circle', x: 480, y: -25, width: 110, height: 110, color: '#ffd700', color2: '#ff6b35', rotation: 0, opacity: 0.35, layer: 'back' },
        { id: 'p3_circ2',  type: 'circle', x: 580, y: 250, width: 70, height: 70, color: '#06ffa5', color2: '#0d6e3a', rotation: 0, opacity: 0.3, layer: 'back' },
        { id: 'p3_tri1',   type: 'triangle', x: 670, y: 35, width: 45, height: 45, color: '#ff6b35', color2: '#ff006e', rotation: 25, opacity: 0.85, layer: 'front' },
        { id: 'p3_heart',  type: 'heart', x: 700, y: 150, width: 30, height: 30, color: '#ff006e', color2: '#ff006e', rotation: 0, opacity: 0.9, layer: 'front' },
      ],
    },
  },
  {
    id: 'cyber',
    label: '⚡ Cyberpunk',
    patch: {
      bgPaper: '#0a0a14',
      paperGlow: true,
      paperGlowColor: '#1a0a3a',
      paperTexture: 'grid',
      paperTextureOpacity: 0.15,
      frameStyle: 'corners',
      frameColor: '#06ffa5',
      frameWidth: 3,
      colorBorde: '#06ffa5',
      colorSlogan: '#ff006e',
      colorFecha: '#06ffa5',
      colorPremio1: '#fb5607',
      colorPremio2: '#ff006e',
      colorDolares: '#06ffa5',
      colorBoleto: '#06ffa5',
      colorValor: '#ff006e',
      colorPesos: '#06ffa5',
      colorMotivac: '#06ffa5',
      colorTalon: '#06ffa5',
      colorCaduca: '#fb5607',
      colorLoteria: '#06ffa5',
      watermarkEnabled: true,
      watermarkText: 'CYBER',
      watermarkColor: '#ff006e',
      watermarkOpacity: 0.1,
      watermarkSize: 130,
      customShapes: [
        { id: 'p4_lin1', type: 'line', x: 145, y: 50, width: 580, height: 4, color: '#06ffa5', rotation: 0, opacity: 0.8, layer: 'back', strokeWidth: 2 },
        { id: 'p4_light1', type: 'lightning', x: 600, y: 25, width: 40, height: 70, color: '#fb5607', color2: '#ff006e', rotation: 0, opacity: 0.95, layer: 'front', strokeColor: '#06ffa5', strokeWidth: 1.5 },
        { id: 'p4_light2', type: 'lightning', x: 145, y: 245, width: 30, height: 55, color: '#06ffa5', color2: '#06ffa5', rotation: -15, opacity: 0.9, layer: 'front', strokeColor: '#ff006e', strokeWidth: 1 },
        { id: 'p4_poly1',  type: 'polygon', x: 660, y: 180, width: 70, height: 70, color: '#ff006e', color2: '#3a0ca3', rotation: 0, opacity: 0.4, layer: 'back', sides: 6 },
      ],
    },
  },
  {
    id: 'vintage',
    label: '📜 Vintage Sepia',
    patch: {
      bgPaper: '#f4e8d0',
      paperGlow: false,
      paperTexture: 'aged',
      paperTextureOpacity: 0.18,
      frameStyle: 'ornate',
      frameColor: '#5c3a1e',
      frameWidth: 2.5,
      colorBorde: '#5c3a1e',
      watermarkEnabled: true,
      watermarkText: 'GRAN PREMIO',
      watermarkColor: '#5c3a1e',
      watermarkOpacity: 0.1,
      watermarkSize: 80,
      watermarkRotation: -22,
      colorSlogan: '#8b1a1a',
      colorPremio1: '#b8860b',
      colorPremio2: '#5c3a1e',
      colorDolares: '#8b1a1a',
      colorBoleto: '#5c3a1e',
      colorTalon: '#5c3a1e',
      customShapes: [
        { id: 'p5_stamp1', type: 'stamp', x: 605, y: 170, width: 110, height: 110, color: '#8b1a1a', color2: '#8b1a1a', rotation: -15, opacity: 0.55, layer: 'front', label: 'OFICIAL' },
        { id: 'p5_star1',  type: 'star', x: 470, y: 20, width: 40, height: 40, color: '#b8860b', color2: '#5c3a1e', rotation: 0, opacity: 0.7, layer: 'back', strokeColor: '#5c3a1e', strokeWidth: 1, points: 5 },
      ],
    },
  },
  {
    id: 'pastel',
    label: '🌸 Pastel Suave',
    patch: {
      bgPaper: '#fff5fb',
      paperGlow: true,
      paperGlowColor: '#fce4ec',
      paperTexture: 'dots',
      paperTextureOpacity: 0.05,
      frameStyle: 'rounded',
      frameColor: '#e91e63',
      frameWidth: 2,
      colorBorde: '#e91e63',
      colorSlogan: '#e91e63',
      colorPremio1: '#ffb74d',
      colorPremio2: '#9c27b0',
      colorSubPremio: '#9c27b0',
      colorPesosSub: '#06b6d4',
      colorBoleto: '#9c27b0',
      colorTalon: '#e91e63',
      watermarkEnabled: false,
      customShapes: [
        { id: 'p6_h1', type: 'heart', x: 670, y: 25, width: 35, height: 35, color: '#e91e63', color2: '#ff80ab', rotation: -10, opacity: 0.85, layer: 'front' },
        { id: 'p6_h2', type: 'heart', x: 720, y: 60, width: 22, height: 22, color: '#9c27b0', color2: '#e91e63', rotation: 15, opacity: 0.85, layer: 'front' },
        { id: 'p6_spk', type: 'sparkle', x: 460, y: 25, width: 28, height: 28, color: '#ffb74d', color2: '#ffb74d', rotation: 0, opacity: 0.9, layer: 'front' },
        { id: 'p6_spk2', type: 'sparkle', x: 580, y: 245, width: 22, height: 22, color: '#9c27b0', color2: '#9c27b0', rotation: 20, opacity: 0.85, layer: 'front' },
      ],
    },
  },
];

// ── Posiciones default ──────────────────────────────────
const DEFAULT_POSITIONS = {
  numBoletoIzq:    { x: 18,  y: 12 },
  nombreLabel:     { x: 10,  y: 70 },
  telLabel:        { x: 10,  y: 300 },
  brandText:       { x: 95,  y: 100, rotated: true },
  talonText:       { x: 132, y: 220, rotated: true },

  sloganTop:       { x: 155, y: 14 },
  fechaPrefix:     { x: 155, y: 50 },
  fechaTexto:      { x: 235, y: 50 },
  numBoletoDer:    { x: 685, y: 12 },

  premioLabel:     { x: 250, y: 90 },
  premioNum:       { x: 180, y: 115 },
  premioTexto:     { x: 380, y: 195 },
  subPremioPrefix: { x: 200, y: 230 },
  subPremioNum:    { x: 230, y: 230 },
  subPremioMoneda: { x: 380, y: 232 },

  caducaText:      { x: 730, y: 100, rotated: true },
  loteriaTexto:    { x: 560, y: 200 },

  motivacionalText:{ x: 155, y: 275 },
  boletoLabel:     { x: 600, y: 245 },
  valorTexto:      { x: 560, y: 275 },
  valorSufijo:     { x: 720, y: 295 },

  footerText:      { x: 220, y: 320 },
};

/* ════════════════════════════════════════════════════════════
   FIELD_META — define qué propiedades controla cada built-in
═════════════════════════════════════════════════════════════ */
const FIELD_META = {
  numBoletoIzq: { label: 'N° boleto (izquierda)', sizeKey: 'sizeNumTalon', colorKey: 'colorTalon', valueKey: 'numBoleto' },
  nombreLabel:  { label: 'Etiqueta "NOMBRE:"',    sizeKey: 'sizeNombre',   colorKey: null,         valueKey: '_label_NOMBRE' },
  telLabel:     { label: 'Etiqueta "Tel:"',       sizeKey: 'sizeNombre',   colorKey: null,         valueKey: '_label_Tel' },
  brandText:    { label: '"GRAN RIFA" (vertical)',sizeKey: 'sizeBrand',    colorKey: 'colorTalon', valueKey: 'brandText' },
  talonText:    { label: '"BOLETO SIN CANCELAR..."', sizeKey: 'sizeTalonText', colorKey: null,     valueKey: 'talonText' },
  sloganTop:    { label: 'Slogan superior',       sizeKey: 'sizeSlogan',   colorKey: 'colorSlogan',valueKey: 'sloganTop' },
  fechaPrefix:  { label: 'Prefijo de fecha',      sizeKey: 'sizeFecha',    colorKey: 'colorFecha', valueKey: 'fechaPrefix' },
  fechaTexto:   { label: 'Fecha',                 sizeKey: 'sizeFecha',    colorKey: 'colorFecha', valueKey: 'fechaTexto' },
  numBoletoDer: { label: 'N° boleto (derecha)',   sizeKey: 'sizeNumDer',   colorKey: 'colorTalon', valueKey: 'numBoleto' },
  premioLabel:  { label: 'Etiqueta "Premio"',     sizeKey: 'sizePremioLabel', colorKey: 'colorPremio1', valueKey: 'premioLabel' },
  premioNum:    { label: 'Número del premio',     sizeKey: 'sizePremioNum',
                  colorKey: 'colorPremio1', colorKey2: 'colorPremio2',     valueKey: 'premioNum' },
  premioTexto:  { label: 'Tipo del premio',       sizeKey: 'sizePremioTxt',colorKey: 'colorDolares', valueKey: 'premioTexto' },
  subPremioPrefix: { label: 'Prefijo sub-premio', sizeKey: 'sizeSubPremio',colorKey: 'colorSubPremio', valueKey: 'subPremioPrefix' },
  subPremioNum:    { label: 'Monto sub-premio',   sizeKey: 'sizeSubPremio',colorKey: 'colorSubPremio', valueKey: 'subPremioNum' },
  subPremioMoneda: { label: 'Moneda sub-premio',  sizeKey: 'sizeSubMoneda',colorKey: 'colorPesosSub',  valueKey: 'subPremioMoneda' },
  caducaText:   { label: '"Caduca..."',           sizeKey: 'sizeCaduca',   colorKey: 'colorCaduca',valueKey: 'caducaText' },
  loteriaTexto: { label: 'Lotería + hora',        sizeKey: 'sizeLoteria',  colorKey: 'colorLoteria',valueKey: 'loteriaTexto' },
  motivacionalText: { label: 'Frase motivacional',sizeKey: 'sizeMotivac',  colorKey: 'colorMotivac',valueKey: 'motivacionalText', multiline: true },
  boletoLabel:  { label: 'Etiqueta "BOLETO"',     sizeKey: 'sizeBoleto',   colorKey: 'colorBoleto',valueKey: 'boletoLabel' },
  valorTexto:   { label: 'Valor del boleto',      sizeKey: 'sizeValor',    colorKey: 'colorValor', valueKey: 'valorTexto' },
  valorSufijo:  { label: 'Sufijo del valor',      sizeKey: 'sizePesos',    colorKey: 'colorPesos', valueKey: 'valorSufijo' },
  footerText:   { label: 'Pie de página',         sizeKey: 'sizeFooter',   colorKey: null,         valueKey: 'footerText' },
};

// ── Helpers ─────────────────────────────────────────────
const parseFecha = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFechaLoteria = (f) => {
  const d = parseFecha(f);
  if (!d) return '';
  const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} - ${d.getUTCFullYear()}`;
};
const fmtHora12 = (h) => {
  if (!h) return '';
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let hh = parseInt(m[1]);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${hh}:${m[2]} ${ampm}`;
};
const splitPremio = (p) => {
  if (!p) return { numero: '', texto: '' };
  const m = String(p).trim().match(/^([\d.,]+)\s*(.*)$/);
  return m ? { numero: m[1], texto: m[2] || '' } : { numero: '', texto: String(p) };
};
const fmtMilesPunto = (n) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(num) ? '' : num.toLocaleString('de-DE');
};
const fmtValorBoleto = (n) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + ' Millón';
  if (num >= 1000)    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + ' Mil';
  return String(num);
};

function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

const resolveValue = (design, campo, fallback) => {
  const v = design?.[campo];
  return v !== undefined && v !== null ? v : (fallback ?? '');
};

const getPos = (positions, campo) => {
  const saved = positions?.[campo];
  const def = DEFAULT_POSITIONS[campo] || { x: 0, y: 0 };
  if (!saved) return def;
  return { ...def, ...saved };
};

// Helper: construye textStyle con efectos avanzados (stroke, glow, 3D, gradient)
function applyAdvancedTextEffects(baseStyle, extras = {}) {
  const out = { ...baseStyle };
  if (extras.textStroke && extras.textStroke.width > 0) {
    out.WebkitTextStroke = `${extras.textStroke.width}px ${extras.textStroke.color || '#000'}`;
  }
  const shadows = [];
  if (baseStyle.textShadow) shadows.push(baseStyle.textShadow);
  if (extras.textGlow && extras.textGlow.blur > 0) {
    const c = extras.textGlow.color || '#fff';
    const b = extras.textGlow.blur;
    shadows.push(`0 0 ${b * 0.5}px ${c}`, `0 0 ${b}px ${c}`, `0 0 ${b * 1.5}px ${c}`);
  }
  if (extras.textShadow3D && extras.textShadow3D.depth > 0) {
    const c = extras.textShadow3D.color || '#000';
    const d = Math.min(extras.textShadow3D.depth, 10);
    for (let i = 1; i <= d; i++) shadows.push(`${i}px ${i}px 0 ${c}`);
  }
  if (shadows.length > 0) out.textShadow = shadows.join(', ');
  if (extras.gradient && extras.gradient.from && extras.gradient.to) {
    const dir = extras.gradient.direction || '180deg';
    out.backgroundImage = `linear-gradient(${dir}, ${extras.gradient.from}, ${extras.gradient.to})`;
    out.WebkitBackgroundClip = 'text';
    out.backgroundClip = 'text';
    out.WebkitTextFillColor = 'transparent';
    out.color = 'transparent';
  }
  return out;
}


/* ════════════════════════════════════════════════════════════
   <PremioNumeroSVG> — versión SVG del número grande
═════════════════════════════════════════════════════════════ */
function PremioNumeroSVG({ value, position, rotation, fontSize, color1, color2, stroke, dropShadowColor }) {
  const text = value || '';
  const charW = fontSize * 0.62;
  const w = Math.max(60, text.length * charW + 20);
  const h = Math.max(fontSize * 1.2, 40);
  const gradId = `grad_${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      transform: rotation ? `rotate(${rotation}deg)` : 'none',
      transformOrigin: 'left top',
      pointerEvents: 'none',
    }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color1} />
            <stop offset="48%"  stopColor={color1} />
            <stop offset="52%"  stopColor={color2 || color1} />
            <stop offset="100%" stopColor={color2 || color1} />
          </linearGradient>
        </defs>
        <text x={3} y={fontSize * 0.85 + 3}
          fontFamily="'Arial Black', 'Poppins', sans-serif"
          fontWeight={900} fontSize={fontSize} letterSpacing={2}
          fill={dropShadowColor || 'rgba(0,0,0,.18)'}>
          {text}
        </text>
        <text x={0} y={fontSize * 0.85}
          fontFamily="'Arial Black', 'Poppins', sans-serif"
          fontWeight={900} fontSize={fontSize} letterSpacing={2}
          fill={`url(#${gradId})`} stroke={stroke} strokeWidth={1}
          paintOrder="stroke fill">
          {text}
        </text>
      </svg>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <DraggableEditable> — átomo arrastrable + editable
═════════════════════════════════════════════════════════════ */
function DraggableEditable({
  id, position, rotation = 0, onMove, value, onChange,
  textStyle, scale = 1, multiline = false, placeholder = '(click)',
  selected = false, onSelect, printMode = false,
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value || '');
  const [hover, setHover]       = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const positionRef = useLatest(position);
  const scaleRef    = useLatest(scale);
  const onMoveRef   = useLatest(onMove);
  const idRef       = useLatest(id);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handlePointerDown = (e) => {
    if (editing) return;
    if (e.type === 'mousedown' && e.button !== 0) return;
    e.stopPropagation();

    const point = e.touches ? e.touches[0] : e;
    const startMouseX = point.clientX;
    const startMouseY = point.clientY;
    const startPosX = positionRef.current.x;
    const startPosY = positionRef.current.y;
    let started = false;

    const handleMove = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = p.clientX - startMouseX;
      const dy = p.clientY - startMouseY;
      const dist = Math.hypot(dx, dy);

      if (!started && dist < DRAG_THRESHOLD) return;
      if (!started) {
        started = true;
        setDragging(true);
      }
      if (ev.cancelable) ev.preventDefault();

      const s = scaleRef.current || 1;
      let newX = startPosX + dx / s;
      let newY = startPosY + dy / s;
      if (ev.shiftKey) {
        newX = Math.round(newX / SNAP_GRID) * SNAP_GRID;
        newY = Math.round(newY / SNAP_GRID) * SNAP_GRID;
      }
      onMoveRef.current(idRef.current, { x: Math.round(newX), y: Math.round(newY) });
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup',   handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend',  handleUp);

      if (onSelect) onSelect(idRef.current);
      if (!started) setEditing(true);
      setDragging(false);
    };

    if (e.touches) {
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend',  handleUp);
    } else {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup',   handleUp);
    }
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value || '');
  };

  const wrapperStyle = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: rotation ? `rotate(${rotation}deg)` : 'none',
    transformOrigin: 'left top',
    cursor: printMode ? 'default' : (dragging ? 'grabbing' : (editing ? 'text' : 'grab')),
    zIndex: dragging ? 1000 : (selected ? 100 : (hover ? 10 : 3)),
    userSelect: 'none',
    touchAction: 'none',
    transition: dragging ? 'none' : 'box-shadow .15s, outline .12s',
    outline: printMode ? 'none' : (
      editing || dragging || selected
        ? '2px solid #0abfbc'
        : hover ? '1px dashed rgba(10,191,188,.85)' : 'none'
    ),
    outlineOffset: 3,
    borderRadius: 3,
    boxShadow: dragging ? '0 8px 20px rgba(10,191,188,.35)' : 'none',
    whiteSpace: 'nowrap',
  };

  if (printMode) {
    return (
      <div style={wrapperStyle}>
        <span style={{ ...textStyle, display: 'inline-block' }}>{value || ''}</span>
      </div>
    );
  }

  if (editing) {
    const Comp = multiline ? 'textarea' : 'input';
    return (
      <div style={wrapperStyle}>
        <Comp ref={inputRef} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
            else if (e.key === 'Escape')         { e.preventDefault(); cancel(); }
          }}
          rows={multiline ? 2 : undefined}
          style={{
            ...textStyle, background: 'rgba(10,191,188,.14)',
            outline: 'none', border: 'none',
            padding: '2px 4px', borderRadius: 3, minWidth: 60,
            fontFamily: textStyle?.fontFamily || 'inherit',
            resize: multiline ? 'vertical' : 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  const isEmpty = !value;
  return (
    <div data-field={id}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click: editar · Arrastra: mover · Shift+arrastra: snap"
      style={wrapperStyle}>
      <span style={{
        backgroundColor: hover && !dragging ? 'rgba(10,191,188,.06)' : 'transparent',
        borderRadius: 2, padding: '0 2px',
        ...textStyle,
        display: 'inline-block',
        opacity: isEmpty ? 0.45 : 1,
        pointerEvents: 'none',
      }}>
        {value || placeholder}
      </span>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   Componentes UI auxiliares para los paneles
═════════════════════════════════════════════════════════════ */
const labelStyle = {
  display: 'block', fontSize: 11, color: '#666',
  fontWeight: 600, marginBottom: 4, letterSpacing: .3,
  textTransform: 'uppercase',
};
const inputStyle = {
  width: '100%', padding: '7px 9px',
  border: '1px solid #ddd', borderRadius: 5,
  fontSize: 13, fontFamily: 'system-ui, sans-serif',
  boxSizing: 'border-box',
};
const sectionStyle = {
  borderTop: '1px solid #eee',
  marginTop: 14, paddingTop: 12,
};
const collapsibleHeaderStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', userSelect: 'none', marginBottom: 8,
};

function ColorRow({ value, onChange, label }) {
  return (
    <>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input type="color" value={value || '#000'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 44, height: 34, border: '1px solid #ddd',
            borderRadius: 5, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
        <input type="text" value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={inputStyle} />
      </div>
    </>
  );
}

function NumberSlider({ value, onChange, min, max, step = 1, label, suffix = '' }) {
  return (
    <>
      <label style={labelStyle}>{label} ({value}{suffix})</label>
      <input type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 4 }} />
      <input type="number" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...inputStyle, marginBottom: 10 }} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   <ElementPanel> — panel lateral unificado (built-in + custom + shape + image)
═════════════════════════════════════════════════════════════ */
function ElementPanel({
  selection, design,
  onUpdateDesign, onUpdateCustom, onUpdateShape, onUpdateImage,
  onDeleteCustom, onDeleteShape, onDeleteImage,
  onHideBuiltin, onLayerToggle, onClose,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceErr, setReplaceErr] = useState('');
  const replaceFileRef = useRef(null);
  if (!selection) return null;

  // ── Determinar tipo y meta ──
  const isCustom  = selection.kind === 'custom';
  const isShape   = selection.kind === 'shape';
  const isImage   = selection.kind === 'image';
  const isBuiltin = selection.kind === 'builtin';
  const meta = isBuiltin ? FIELD_META[selection.id] : null;

  // ═══════════════ PANEL DE FORMA ═══════════════
  if (isShape) {
    const shape = selection.data;
    const tipoMeta = TIPOS_FORMA.find(t => t.type === shape.type) || { label: shape.type };
    return (
      <div style={{
        width: 280, background: '#fff',
        border: '1px solid #e0e0e0', borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,.10)',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden', alignSelf: 'flex-start',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{tipoMeta.icon || '◆'}</span>
            <strong style={{ fontSize: 13 }}>Forma: {tipoMeta.label}</strong>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none',
              color: '#fff', cursor: 'pointer', width: 24, height: 24,
              borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
          {/* Color principal */}
          <ColorRow label="🎨 Color principal" value={shape.color}
            onChange={v => onUpdateShape(shape.id, { color: v })} />
          {/* Color 2 (gradiente) */}
          <ColorRow label="🎨 Color secundario (gradiente)"
            value={shape.color2 || shape.color}
            onChange={v => onUpdateShape(shape.id, { color2: v })} />
          {shape.color === shape.color2 && (
            <p style={{ fontSize: 11, color: '#999', margin: '-6px 0 10px' }}>
              Igualados = color sólido. Cámbialos para gradiente.
            </p>
          )}
          {/* Contorno (stroke) */}
          <ColorRow label="✏️ Color del contorno"
            value={shape.strokeColor || '#000000'}
            onChange={v => onUpdateShape(shape.id, { strokeColor: v })} />
          <NumberSlider label="Grosor del contorno" suffix="px"
            min={0} max={10} step={0.5}
            value={shape.strokeWidth || 0}
            onChange={v => onUpdateShape(shape.id, { strokeWidth: v })} />

          {/* Tamaño */}
          <NumberSlider label="↔ Ancho" suffix="px"
            min={10} max={500}
            value={shape.width}
            onChange={v => onUpdateShape(shape.id, { width: v })} />
          <NumberSlider label="↕ Alto" suffix="px"
            min={10} max={500}
            value={shape.height}
            onChange={v => onUpdateShape(shape.id, { height: v })} />

          {/* Rotación */}
          <NumberSlider label="🔄 Rotación" suffix="°"
            min={-180} max={180} step={5}
            value={shape.rotation || 0}
            onChange={v => onUpdateShape(shape.id, { rotation: v })} />

          {/* Opacidad */}
          <NumberSlider label="👻 Opacidad" suffix=""
            min={0.05} max={1} step={0.05}
            value={shape.opacity != null ? shape.opacity : 1}
            onChange={v => onUpdateShape(shape.id, { opacity: v })} />

          {/* Capa */}
          <label style={labelStyle}>🥞 Capa</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['back', 'front'].map(l => (
              <button key={l}
                onClick={() => onUpdateShape(shape.id, { layer: l })}
                style={{
                  flex: 1, padding: '7px',
                  background: (shape.layer || 'back') === l ? '#7c3aed' : '#fff',
                  color: (shape.layer || 'back') === l ? '#fff' : '#666',
                  border: '1px solid ' + ((shape.layer || 'back') === l ? '#7c3aed' : '#ddd'),
                  borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  fontFamily: 'inherit',
                }}>
                {l === 'back' ? '↓ Detrás' : '↑ Encima'}
              </button>
            ))}
          </div>

          {/* Sides para polygon */}
          {shape.type === 'polygon' && (
            <NumberSlider label="Lados" min={3} max={12}
              value={shape.sides || 6}
              onChange={v => onUpdateShape(shape.id, { sides: v })} />
          )}
          {/* Points para star */}
          {shape.type === 'star' && (
            <NumberSlider label="Puntas" min={3} max={12}
              value={shape.points || 5}
              onChange={v => onUpdateShape(shape.id, { points: v })} />
          )}
          {/* InnerRadius para ring */}
          {shape.type === 'ring' && (
            <NumberSlider label="Radio interior" suffix="%" min={5} max={45}
              value={shape.innerRadius || 32}
              onChange={v => onUpdateShape(shape.id, { innerRadius: v })} />
          )}
          {/* BorderRadius para rect */}
          {shape.type === 'rect' && (
            <NumberSlider label="Esquinas redondeadas" suffix="%" min={0} max={50}
              value={shape.borderRadius || 0}
              onChange={v => onUpdateShape(shape.id, { borderRadius: v })} />
          )}
          {/* Label para stamp */}
          {shape.type === 'stamp' && (
            <>
              <label style={labelStyle}>Texto del sello</label>
              <input type="text" value={shape.label || ''}
                onChange={e => onUpdateShape(shape.id, { label: e.target.value })}
                style={{ ...inputStyle, marginBottom: 12 }} />
            </>
          )}
          {/* Dashed para line */}
          {shape.type === 'line' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="checkbox" id="dashed" checked={!!shape.dashed}
                onChange={e => onUpdateShape(shape.id, { dashed: e.target.checked })} />
              <label htmlFor="dashed" style={{ fontSize: 12, color: '#666' }}>
                Línea punteada
              </label>
            </div>
          )}

          <button onClick={() => onDeleteShape(shape.id)}
            style={{
              width: '100%', padding: '10px',
              background: '#fff', color: '#d92626',
              border: '1.5px solid #d92626', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', marginTop: 4,
            }}>🗑 Eliminar forma</button>
        </div>
      </div>
    );
  }

  // ═══════════════ PANEL DE IMAGEN ═══════════════
  if (isImage) {
    const img = selection.data;
    return (
      <div style={{
        width: 280, background: '#fff',
        border: '1px solid #e0e0e0', borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,.10)',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden', alignSelf: 'flex-start',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🖼</span>
            <strong style={{ fontSize: 13 }}>Imagen</strong>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none',
              color: '#fff', cursor: 'pointer', width: 24, height: 24,
              borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
          {/* Reemplazar imagen */}
          <input
            ref={replaceFileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0];
              e.target.value = '';
              if (!file) return;
              setReplaceErr('');
              setReplacing(true);
              try {
                const r = await processImageFile(file);
                if (r.sizeKB > MAX_DATAURL_KB) {
                  setReplaceErr(`Pesa ~${(r.sizeKB / 1024).toFixed(1)} MB; puede tardar en guardar.`);
                }
                onUpdateImage(img.id, {
                  src: r.dataUrl,
                  transparente: r.transparente,
                  objectFit: r.transparente ? 'contain' : (img.objectFit || 'cover'),
                });
              } catch (err) {
                setReplaceErr(err.message || 'No se pudo procesar la imagen');
              } finally {
                setReplacing(false);
              }
            }}
          />
          <button
            onClick={() => replaceFileRef.current && replaceFileRef.current.click()}
            disabled={replacing}
            style={{
              width: '100%', padding: '11px',
              background: replacing ? '#9ad8e3' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: '#fff', border: 'none', borderRadius: 7,
              cursor: replacing ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              marginBottom: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}>
            {replacing ? '⏳ Procesando…' : '📁 Cambiar imagen (galería)'}
          </button>

          {img.transparente && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#ecfeff', border: '1px solid #a5f3fc',
              borderRadius: 6, padding: '6px 8px', marginBottom: 10,
              fontSize: 11, color: '#0e7490', fontWeight: 600,
            }}>
              ✨ PNG sin fondo detectado — se conserva la transparencia
            </div>
          )}

          {replaceErr && (
            <p style={{ fontSize: 11, color: '#d92626', margin: '0 0 10px', fontWeight: 600 }}>
              ⚠️ {replaceErr}
            </p>
          )}

          {/* URL (opcional / avanzado) */}
          <label style={labelStyle}>🔗 …o pega una URL</label>
          <input type="text" value={(img.src || '').startsWith('data:') ? '' : (img.src || '')}
            onChange={e => onUpdateImage(img.id, { src: e.target.value, transparente: false })}
            placeholder={(img.src || '').startsWith('data:') ? 'Imagen subida desde galería' : 'https://...'}
            style={{ ...inputStyle, marginBottom: 12 }} />

          {/* Tamaño */}
          <NumberSlider label="↔ Ancho" suffix="px" min={20} max={600}
            value={img.width}
            onChange={v => onUpdateImage(img.id, { width: v })} />
          <NumberSlider label="↕ Alto" suffix="px" min={20} max={400}
            value={img.height}
            onChange={v => onUpdateImage(img.id, { height: v })} />

          {/* Rotación */}
          <NumberSlider label="🔄 Rotación" suffix="°" min={-180} max={180} step={5}
            value={img.rotation || 0}
            onChange={v => onUpdateImage(img.id, { rotation: v })} />

          {/* Opacidad */}
          <NumberSlider label="👻 Opacidad" min={0.05} max={1} step={0.05}
            value={img.opacity != null ? img.opacity : 1}
            onChange={v => onUpdateImage(img.id, { opacity: v })} />

          {/* Border-radius */}
          <NumberSlider label="◯ Esquinas redondeadas" suffix="px" min={0} max={200}
            value={img.borderRadius || 0}
            onChange={v => onUpdateImage(img.id, { borderRadius: v })} />

          {/* Capa */}
          <label style={labelStyle}>🥞 Capa</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['back', 'front'].map(l => (
              <button key={l}
                onClick={() => onUpdateImage(img.id, { layer: l })}
                style={{
                  flex: 1, padding: '7px',
                  background: (img.layer || 'back') === l ? '#06b6d4' : '#fff',
                  color: (img.layer || 'back') === l ? '#fff' : '#666',
                  border: '1px solid ' + ((img.layer || 'back') === l ? '#06b6d4' : '#ddd'),
                  borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  fontFamily: 'inherit',
                }}>
                {l === 'back' ? '↓ Detrás' : '↑ Encima'}
              </button>
            ))}
          </div>

          {/* Blend mode */}
          <label style={labelStyle}>🎭 Modo de mezcla</label>
          <select value={img.blendMode || 'normal'}
            onChange={e => onUpdateImage(img.id, { blendMode: e.target.value })}
            style={{ ...inputStyle, marginBottom: 12 }}>
            {BLEND_MODES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Object fit */}
          <label style={labelStyle}>🖼 Ajuste</label>
          <select value={img.objectFit || 'cover'}
            onChange={e => onUpdateImage(img.id, { objectFit: e.target.value })}
            style={{ ...inputStyle, marginBottom: 12 }}>
            <option value="cover">Cubrir (cover)</option>
            <option value="contain">Contener (contain)</option>
            <option value="fill">Estirar (fill)</option>
            <option value="none">Original (none)</option>
          </select>

          {/* Filtros */}
          <div style={sectionStyle}>
            <div style={collapsibleHeaderStyle} onClick={() => setShowAdvanced(v => !v)}>
              <strong style={{ fontSize: 12, color: '#333' }}>🎨 Filtros visuales</strong>
              <span style={{ fontSize: 11, color: '#06b6d4' }}>{showAdvanced ? '▼' : '▶'}</span>
            </div>
            {showAdvanced && (
              <>
                <NumberSlider label="Escala de grises" min={0} max={1} step={0.05}
                  value={img.grayscale || 0}
                  onChange={v => onUpdateImage(img.id, { grayscale: v })} />
                <NumberSlider label="Sepia" min={0} max={1} step={0.05}
                  value={img.sepia || 0}
                  onChange={v => onUpdateImage(img.id, { sepia: v })} />
                <NumberSlider label="Desenfoque" suffix="px" min={0} max={20} step={0.5}
                  value={img.blur || 0}
                  onChange={v => onUpdateImage(img.id, { blur: v })} />
                <NumberSlider label="Brillo" min={0.1} max={2} step={0.05}
                  value={img.brightness != null ? img.brightness : 1}
                  onChange={v => onUpdateImage(img.id, { brightness: v })} />
              </>
            )}
          </div>

          <button onClick={() => onDeleteImage(img.id)}
            style={{
              width: '100%', padding: '10px',
              background: '#fff', color: '#d92626',
              border: '1.5px solid #d92626', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', marginTop: 12,
            }}>🗑 Eliminar imagen</button>
        </div>
      </div>
    );
  }

  // ═══════════════ PANEL DE TEXTO (built-in o custom) ═══════════════
  const get = (prop) => {
    if (isCustom) return selection.data[prop];
    switch (prop) {
      case 'color':    return meta.colorKey ? design[meta.colorKey] : '#000000';
      case 'color2':   return meta.colorKey2 ? design[meta.colorKey2] : null;
      case 'fontSize': return design[meta.sizeKey];
      case 'rotation': {
        const pos = design.positions?.[selection.id] || DEFAULT_POSITIONS[selection.id] || {};
        return pos.rotation !== undefined ? pos.rotation : (pos.rotated ? -90 : 0);
      }
      case 'value':    return design[meta.valueKey];
      default: return null;
    }
  };

  const set = (prop, val) => {
    if (isCustom) {
      onUpdateCustom(selection.id, { [prop]: val });
      return;
    }
    switch (prop) {
      case 'color':    if (meta.colorKey)  onUpdateDesign(meta.colorKey, val);  break;
      case 'color2':   if (meta.colorKey2) onUpdateDesign(meta.colorKey2, val); break;
      case 'fontSize': onUpdateDesign(meta.sizeKey, Number(val)); break;
      case 'rotation': {
        const positions = design.positions || {};
        const cur = positions[selection.id] || DEFAULT_POSITIONS[selection.id] || { x:0, y:0 };
        onUpdateDesign('positions', {
          ...positions,
          [selection.id]: { ...cur, rotation: Number(val) },
        });
        break;
      }
      case 'value':    onUpdateDesign(meta.valueKey, val); break;
      default: break;
    }
  };

  // Get/set para efectos avanzados de texto (built-in usa keys textEffects.{fieldId}.{prop})
  const getFx = (prop) => {
    if (isCustom) return selection.data.fx?.[prop];
    return design.textEffects?.[selection.id]?.[prop];
  };
  const setFx = (prop, val) => {
    if (isCustom) {
      const fx = { ...(selection.data.fx || {}) };
      if (val === null || val === undefined) delete fx[prop];
      else fx[prop] = val;
      onUpdateCustom(selection.id, { fx });
    } else {
      const all = { ...(design.textEffects || {}) };
      const cur = { ...(all[selection.id] || {}) };
      if (val === null || val === undefined) delete cur[prop];
      else cur[prop] = val;
      all[selection.id] = cur;
      onUpdateDesign('textEffects', all);
    }
  };

  const showColor    = isCustom ? true  : meta.colorKey !== null;
  const showColor2   = !isCustom && meta.colorKey2;
  const showFontFam  = isCustom;
  const showWeight   = isCustom;
  const showItalic   = isCustom;
  const isMultiline  = isCustom ? false : meta.multiline;

  const title = isCustom ? 'Texto personalizado' : meta.label;

  // Efectos actuales
  const fxStroke = getFx('textStroke');
  const fxGlow   = getFx('textGlow');
  const fx3D     = getFx('textShadow3D');
  const fxGrad   = getFx('gradient');

  return (
    <div style={{
      width: 280, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden', alignSelf: 'flex-start',
      maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #0abfbc 0%, #089a98 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{isCustom ? '✨' : '🎯'}</span>
          <strong style={{ fontSize: 13, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </strong>
        </div>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <div style={{ padding: 14, overflowY: 'auto' }}>

        {/* Texto */}
        {(isCustom || (meta.valueKey && !meta.valueKey.startsWith('_label_'))) && (
          <>
            <label style={labelStyle}>📝 Texto</label>
            {isMultiline ? (
              <textarea value={isCustom ? selection.data.value : (get('value') || '')}
                onChange={e => isCustom
                  ? onUpdateCustom(selection.id, { value: e.target.value })
                  : set('value', e.target.value)}
                rows={2}
                style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' }} />
            ) : (
              <input type="text" value={isCustom ? selection.data.value : (get('value') || '')}
                onChange={e => isCustom
                  ? onUpdateCustom(selection.id, { value: e.target.value })
                  : set('value', e.target.value)}
                style={{ ...inputStyle, marginBottom: 12 }} />
            )}
          </>
        )}

        {/* Tamaño */}
        <NumberSlider label="📏 Tamaño" suffix=" pt"
          min={6} max={120}
          value={isCustom ? selection.data.fontSize : get('fontSize')}
          onChange={v => isCustom
            ? onUpdateCustom(selection.id, { fontSize: v })
            : set('fontSize', v)} />

        {/* Color */}
        {showColor && (
          <ColorRow
            label={`🎨 ${showColor2 ? (get('color') === get('color2') ? 'Color' : 'Color superior') : 'Color'}`}
            value={isCustom ? selection.data.color : (get('color') || '#000')}
            onChange={v => isCustom
              ? onUpdateCustom(selection.id, { color: v })
              : set('color', v)} />
        )}

        {/* Color 2 (gradiente premioNum built-in) */}
        {showColor2 && (
          <>
            {get('color') !== get('color2') && (
              <button onClick={() => set('color2', get('color'))}
                style={{
                  width: '100%', padding: '7px',
                  background: '#f8fafa', color: '#0abfbc',
                  border: '1px dashed #0abfbc', borderRadius: 5,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  fontFamily: 'inherit', marginBottom: 10,
                }}>⬇ Hacer color sólido</button>
            )}
            <ColorRow label="🎨 Color inferior"
              value={get('color2') || '#000'}
              onChange={v => set('color2', v)} />
            <ColorRow label="✏️ Color del contorno"
              value={design.colorPremioStroke || design.colorBorde || '#000000'}
              onChange={v => onUpdateDesign('colorPremioStroke', v)} />
          </>
        )}

        {/* Peso (custom) */}
        {showWeight && (
          <>
            <label style={labelStyle}>💪 Peso</label>
            <select value={selection.data.fontWeight}
              onChange={e => onUpdateCustom(selection.id, { fontWeight: Number(e.target.value) })}
              style={{ ...inputStyle, marginBottom: 10 }}>
              <option value={300}>Light (300)</option>
              <option value={400}>Normal (400)</option>
              <option value={600}>Semi-Bold (600)</option>
              <option value={700}>Bold (700)</option>
              <option value={900}>Black (900)</option>
            </select>
          </>
        )}

        {/* Italic/Bold rápidos (custom) */}
        {showItalic && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button onClick={() => onUpdateCustom(selection.id, {
                fontWeight: selection.data.fontWeight >= 700 ? 400 : 700 })}
              style={{
                flex: 1, padding: '8px',
                background: selection.data.fontWeight >= 700 ? '#0abfbc' : '#f5f5f5',
                color: selection.data.fontWeight >= 700 ? '#fff' : '#333',
                border: '1px solid #ddd', borderRadius: 5,
                cursor: 'pointer', fontSize: 14, fontWeight: 900,
                fontFamily: 'inherit',
              }}>B</button>
            <button onClick={() => onUpdateCustom(selection.id, {
                fontStyle: selection.data.fontStyle === 'italic' ? 'normal' : 'italic' })}
              style={{
                flex: 1, padding: '8px',
                background: selection.data.fontStyle === 'italic' ? '#0abfbc' : '#f5f5f5',
                color: selection.data.fontStyle === 'italic' ? '#fff' : '#333',
                border: '1px solid #ddd', borderRadius: 5,
                cursor: 'pointer', fontSize: 14, fontStyle: 'italic',
                fontFamily: 'Georgia, serif', fontWeight: 700,
              }}>I</button>
          </div>
        )}

        {/* Fuente (custom) */}
        {showFontFam && (
          <>
            <label style={labelStyle}>🔤 Fuente</label>
            <select value={selection.data.fontFamily}
              onChange={e => onUpdateCustom(selection.id, { fontFamily: e.target.value })}
              style={{ ...inputStyle, marginBottom: 12 }}>
              {FUENTES.map(f => (
                <option key={f.val} value={f.val} style={{ fontFamily: f.val }}>{f.label}</option>
              ))}
            </select>
          </>
        )}

        {/* Rotación */}
        <NumberSlider label="🔄 Rotación" suffix="°"
          min={-180} max={180} step={5}
          value={isCustom ? selection.data.rotation : get('rotation')}
          onChange={v => isCustom
            ? onUpdateCustom(selection.id, { rotation: v })
            : set('rotation', v)} />
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[0, -90, 90, 180].map(deg => (
            <button key={deg}
              onClick={() => isCustom
                ? onUpdateCustom(selection.id, { rotation: deg })
                : set('rotation', deg)}
              style={{ flex: 1, fontSize: 11, padding: '5px',
                border: '1px solid #ddd', borderRadius: 4,
                background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {deg}°
            </button>
          ))}
        </div>

        {/* ═══ EFECTOS AVANZADOS ═══ */}
        <div style={sectionStyle}>
          <div style={collapsibleHeaderStyle} onClick={() => setShowAdvanced(v => !v)}>
            <strong style={{ fontSize: 12, color: '#7c3aed' }}>✨ Efectos avanzados</strong>
            <span style={{ fontSize: 11, color: '#7c3aed' }}>{showAdvanced ? '▼' : '▶'}</span>
          </div>

          {showAdvanced && (
            <>
              {/* Contorno (text-stroke) */}
              <div style={{ background: '#faf7ff', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 11, color: '#7c3aed' }}>✏️ Contorno (margen)</strong>
                  <input type="checkbox"
                    checked={!!fxStroke}
                    onChange={e => setFx('textStroke', e.target.checked ? { width: 1.5, color: '#000' } : null)} />
                </div>
                {fxStroke && (
                  <>
                    <NumberSlider label="Grosor" suffix="px" min={0.5} max={6} step={0.5}
                      value={fxStroke.width || 1.5}
                      onChange={v => setFx('textStroke', { ...fxStroke, width: v })} />
                    <ColorRow label="Color"
                      value={fxStroke.color || '#000000'}
                      onChange={v => setFx('textStroke', { ...fxStroke, color: v })} />
                  </>
                )}
              </div>

              {/* Glow */}
              <div style={{ background: '#fff7e6', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 11, color: '#e67e00' }}>🌟 Brillo (glow)</strong>
                  <input type="checkbox"
                    checked={!!fxGlow}
                    onChange={e => setFx('textGlow', e.target.checked ? { blur: 8, color: '#ffd700' } : null)} />
                </div>
                {fxGlow && (
                  <>
                    <NumberSlider label="Intensidad" suffix="px" min={1} max={30}
                      value={fxGlow.blur || 8}
                      onChange={v => setFx('textGlow', { ...fxGlow, blur: v })} />
                    <ColorRow label="Color"
                      value={fxGlow.color || '#ffd700'}
                      onChange={v => setFx('textGlow', { ...fxGlow, color: v })} />
                  </>
                )}
              </div>

              {/* Sombra 3D */}
              <div style={{ background: '#fff0f0', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 11, color: '#d92626' }}>🎲 Sombra 3D</strong>
                  <input type="checkbox"
                    checked={!!fx3D}
                    onChange={e => setFx('textShadow3D', e.target.checked ? { depth: 4, color: '#000' } : null)} />
                </div>
                {fx3D && (
                  <>
                    <NumberSlider label="Profundidad" min={1} max={10}
                      value={fx3D.depth || 4}
                      onChange={v => setFx('textShadow3D', { ...fx3D, depth: v })} />
                    <ColorRow label="Color"
                      value={fx3D.color || '#000000'}
                      onChange={v => setFx('textShadow3D', { ...fx3D, color: v })} />
                  </>
                )}
              </div>

              {/* Gradiente de letra (solo custom, porque built-in tiene color por design key) */}
              {isCustom && (
                <div style={{ background: '#f0fdf4', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong style={{ fontSize: 11, color: '#15803d' }}>🌈 Gradiente</strong>
                    <input type="checkbox"
                      checked={!!fxGrad}
                      onChange={e => setFx('gradient', e.target.checked
                        ? { from: '#ff006e', to: '#3a0ca3', direction: '180deg' } : null)} />
                  </div>
                  {fxGrad && (
                    <>
                      <ColorRow label="Color inicio"
                        value={fxGrad.from || '#ff006e'}
                        onChange={v => setFx('gradient', { ...fxGrad, from: v })} />
                      <ColorRow label="Color final"
                        value={fxGrad.to || '#3a0ca3'}
                        onChange={v => setFx('gradient', { ...fxGrad, to: v })} />
                      <label style={labelStyle}>Dirección</label>
                      <select value={fxGrad.direction || '180deg'}
                        onChange={e => setFx('gradient', { ...fxGrad, direction: e.target.value })}
                        style={{ ...inputStyle, marginBottom: 8 }}>
                        <option value="180deg">↓ Vertical</option>
                        <option value="90deg">→ Horizontal</option>
                        <option value="135deg">↘ Diagonal ↘</option>
                        <option value="45deg">↗ Diagonal ↗</option>
                      </select>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Borrar / Ocultar */}
        {isCustom ? (
          <button onClick={() => onDeleteCustom(selection.id)}
            style={{
              width: '100%', padding: '10px',
              background: '#fff', color: '#d92626',
              border: '1.5px solid #d92626', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', marginTop: 4,
            }}>🗑 Eliminar este texto</button>
        ) : (
          <button onClick={() => onHideBuiltin(selection.id)}
            style={{
              width: '100%', padding: '10px',
              background: '#fff', color: '#d92626',
              border: '1.5px solid #d92626', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', marginTop: 4,
            }}>🙈 Ocultar este texto</button>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   <PaletasPanel>
═════════════════════════════════════════════════════════════ */
function PaletasPanel({ onApply, onClose }) {
  return (
    <div style={{
      width: 280, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden', alignSelf: 'flex-start',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #f0a500 0%, #d68f00 100%)',
        color: '#fff',
      }}>
        <strong style={{ fontSize: 13 }}>🎨 Paletas de colores</strong>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ padding: 14, maxHeight: 400, overflowY: 'auto' }}>
        <p style={{ fontSize: 12, color: '#666', marginTop: 0, marginBottom: 12 }}>
          Aplica un set de colores a TODO el ticket.
        </p>
        {PALETAS.map(p => (
          <button key={p.id} onClick={() => onApply(p.colors)}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: 10,
              padding: '8px 10px', background: '#fff',
              border: '1px solid #e0e0e0', borderRadius: 6,
              cursor: 'pointer', marginBottom: 6,
              fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
            }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {[p.colors.colorPremio1, p.colors.colorPremio2, p.colors.colorSlogan].map((c, i) => (
                <div key={i} style={{ width: 14, height: 18, background: c,
                  borderRadius: 2, border: '1px solid rgba(0,0,0,.1)' }} />
              ))}
            </div>
            <span style={{ fontWeight: 600 }}>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <FormasPanel> — Picker de formas
═════════════════════════════════════════════════════════════ */
function FormasPanel({ onAdd, onClose }) {
  return (
    <div style={{
      width: 280, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden', alignSelf: 'flex-start',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
        color: '#fff',
      }}>
        <strong style={{ fontSize: 13 }}>◆ Agregar forma</strong>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ padding: 14, maxHeight: 420, overflowY: 'auto' }}>
        <p style={{ fontSize: 11, color: '#666', marginTop: 0, marginBottom: 10 }}>
          Click para agregar al centro del ticket. Luego arrastra para mover.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {TIPOS_FORMA.map(t => (
            <button key={t.type} onClick={() => onAdd(t.type)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '10px 6px', background: '#fff',
                border: '1.5px solid #e9d5ff', borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#faf7ff';
                e.currentTarget.style.borderColor = '#7c3aed';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#e9d5ff';
              }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <ImagenPanel> — Agregar/editar URL de imagen
═════════════════════════════════════════════════════════════ */
function ImagenPanel({ onAdd, onClose }) {
  const [url, setUrl] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permite re-subir el mismo archivo
    if (!file) return;
    setError('');
    setCargando(true);
    try {
      const r = await processImageFile(file);
      if (r.sizeKB > MAX_DATAURL_KB) {
        setError(`La imagen pesa ~${(r.sizeKB / 1024).toFixed(1)} MB. Puede tardar en guardar; prueba con una más pequeña.`);
      }
      // onAdd recibe el dataURL + metadatos (transparencia, aspecto)
      onAdd(r.dataUrl, { transparente: r.transparente, aspect: r.aspect });
    } catch (err) {
      setError(err.message || 'No se pudo procesar la imagen');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      width: 280, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden', alignSelf: 'flex-start',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        color: '#fff',
      }}>
        <strong style={{ fontSize: 13 }}>🖼 Agregar imagen</strong>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ padding: 14 }}>
        {/* ── Subir desde galería ── */}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={cargando}
          style={{
            width: '100%', padding: '14px',
            background: cargando ? '#9ad8e3' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: cargando ? 'wait' : 'pointer',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            marginBottom: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}>
          {cargando ? '⏳ Procesando…' : '📁 Subir desde mi galería'}
        </button>
        <p style={{ fontSize: 11, color: '#888', margin: '0 0 6px' }}>
          PNG, JPG o WebP. Si el PNG no tiene fondo, se detecta solo y se
          conserva la transparencia. ✨
        </p>

        {error && (
          <p style={{ fontSize: 11, color: '#d92626', margin: '6px 0 0', fontWeight: 600 }}>
            ⚠️ {error}
          </p>
        )}

        {/* ── Alternativa: URL ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          margin: '14px 0 10px', color: '#bbb', fontSize: 11,
        }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          o pega una URL
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>
        <label style={labelStyle}>🔗 URL pública</label>
        <input type="text" value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://i.imgur.com/..."
          style={{ ...inputStyle, marginBottom: 8 }} />
        <button onClick={() => { if (url.trim()) { onAdd(url.trim()); setUrl(''); } }}
          disabled={!url.trim()}
          style={{
            width: '100%', padding: '9px',
            background: url.trim() ? '#fff' : '#f5f5f5',
            color: url.trim() ? '#06b6d4' : '#bbb',
            border: '1.5px solid ' + (url.trim() ? '#06b6d4' : '#ddd'),
            borderRadius: 6,
            cursor: url.trim() ? 'pointer' : 'not-allowed',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}>+ Agregar desde URL</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <EstiloPanel> — Marco + Watermark + Textura
═════════════════════════════════════════════════════════════ */
function EstiloPanel({ design, onUpdateDesign, onClose }) {
  return (
    <div style={{
      width: 280, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden', alignSelf: 'flex-start',
      maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
        color: '#fff',
      }}>
        <strong style={{ fontSize: 13 }}>🖼 Estilo global del ticket</strong>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ padding: 14, overflowY: 'auto' }}>

        {/* ── MARCO ── */}
        <strong style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 8 }}>
          🖼 Marco del ticket
        </strong>
        <label style={labelStyle}>Estilo</label>
        <select value={design.frameStyle || 'classic'}
          onChange={e => onUpdateDesign('frameStyle', e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}>
          {FRAMES.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <ColorRow label="Color del marco"
          value={design.frameColor || design.colorBorde || '#000'}
          onChange={v => onUpdateDesign('frameColor', v)} />
        <NumberSlider label="Grosor del marco" suffix="px"
          min={1} max={8} step={0.5}
          value={design.frameWidth || 2.5}
          onChange={v => onUpdateDesign('frameWidth', v)} />

        {/* ── WATERMARK ── */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 12, color: '#7c3aed' }}>💧 Marca de agua</strong>
            <input type="checkbox" checked={!!design.watermarkEnabled}
              onChange={e => onUpdateDesign('watermarkEnabled', e.target.checked)} />
          </div>
          {design.watermarkEnabled && (
            <>
              <label style={labelStyle}>Texto</label>
              <input type="text" value={design.watermarkText || ''}
                onChange={e => onUpdateDesign('watermarkText', e.target.value)}
                style={{ ...inputStyle, marginBottom: 10 }} />
              <ColorRow label="Color"
                value={design.watermarkColor || '#000'}
                onChange={v => onUpdateDesign('watermarkColor', v)} />
              <NumberSlider label="Opacidad" min={0.02} max={0.5} step={0.02}
                value={design.watermarkOpacity != null ? design.watermarkOpacity : 0.06}
                onChange={v => onUpdateDesign('watermarkOpacity', v)} />
              <NumberSlider label="Tamaño" suffix=" pt" min={30} max={200}
                value={design.watermarkSize || 100}
                onChange={v => onUpdateDesign('watermarkSize', v)} />
              <NumberSlider label="Rotación" suffix="°" min={-90} max={90} step={5}
                value={design.watermarkRotation != null ? design.watermarkRotation : -20}
                onChange={v => onUpdateDesign('watermarkRotation', v)} />
            </>
          )}
        </div>

        {/* ── TEXTURA ── */}
        <div style={sectionStyle}>
          <strong style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 8 }}>
            📜 Textura del papel
          </strong>
          <label style={labelStyle}>Tipo</label>
          <select value={design.paperTexture || 'none'}
            onChange={e => onUpdateDesign('paperTexture', e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}>
            {TEXTURAS.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {design.paperTexture && design.paperTexture !== 'none' && (
            <NumberSlider label="Intensidad" min={0.02} max={0.5} step={0.02}
              value={design.paperTextureOpacity != null ? design.paperTextureOpacity : 0.08}
              onChange={v => onUpdateDesign('paperTextureOpacity', v)} />
          )}
        </div>

        {/* ── BACKGROUND ── */}
        <div style={sectionStyle}>
          <strong style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 8 }}>
            🎨 Fondo
          </strong>
          <ColorRow label="Color del papel"
            value={design.bgPaper || '#f5f5f0'}
            onChange={v => onUpdateDesign('bgPaper', v)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input type="checkbox" id="paperGlow"
              checked={!!design.paperGlow}
              onChange={e => onUpdateDesign('paperGlow', e.target.checked)} />
            <label htmlFor="paperGlow" style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
              ✨ Resplandor radial
            </label>
          </div>
          {design.paperGlow && (
            <ColorRow label="Color del resplandor"
              value={design.paperGlowColor || '#fff8d0'}
              onChange={v => onUpdateDesign('paperGlowColor', v)} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <PresetsPanel>
═════════════════════════════════════════════════════════════ */
function PresetsPanel({ onApply, onClose }) {
  return (
    <div style={{
      width: 280, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden', alignSelf: 'flex-start',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)',
        color: '#fff',
      }}>
        <strong style={{ fontSize: 13 }}>🎭 Presets espectaculares</strong>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ padding: 14, maxHeight: 440, overflowY: 'auto' }}>
        <p style={{ fontSize: 11, color: '#888', marginTop: 0, marginBottom: 10 }}>
          Aplica un diseño completo con colores, formas, marco y efectos.
        </p>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => onApply(p.patch)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 12px', background: '#fff',
              border: '1.5px solid #fce7f3', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#9d174d',
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fdf2f8';
              e.currentTarget.style.borderColor = '#db2777';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#fce7f3';
            }}>
            {p.label}
          </button>
        ))}
        <p style={{ fontSize: 10, color: '#999', marginTop: 14, fontStyle: 'italic' }}>
          ⚠️ Aplicar un preset reemplaza las formas y colores actuales.
        </p>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   <TicketEditable> — Componente principal
═════════════════════════════════════════════════════════════ */
export default function TicketEditable({ r, numero, design, onUpdate, printMode = false }) {
  if (!onUpdate) onUpdate = () => {};

  const globalSizeFactor = design?.globalSizeFactor || 1.0;
  const baseDesign = { ...DEFAULT_DESIGN, ...(design || {}) };

  const D = { ...baseDesign };
  if (globalSizeFactor !== 1.0) {
    Object.keys(D).forEach(k => {
      if (k.startsWith('size') && typeof D[k] === 'number') {
        D[k] = D[k] * globalSizeFactor;
      }
    });
  }

  const positions    = baseDesign.positions    || {};
  const customTexts  = baseDesign.customTexts  || [];
  const customShapes = baseDesign.customShapes || [];
  const customImages = baseDesign.customImages || [];
  const hiddenFields = baseDesign.hiddenFields || [];

  // Defaults de la rifa
  const { numero: premioNumRifa, texto: premioTxtRifa } = splitPremio(r?.premio);
  const fechaRifa     = fmtFechaLoteria(r?.fecha_sorteo);
  const horaRifa      = D.horaSort?.trim() || fmtHora12(r?.hora_sorteo) || '';
  const valorRifa     = fmtValorBoleto(r?.precio);
  const subPremioRifa = r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const numBoletoRifa = numero || '000';
  const loteriaRifa   = r?.loteria_ref
    ? `${r.loteria_ref}${horaRifa ? ` ${horaRifa}` : ''}`
    : D.loteriaText;

  const numBoleto    = resolveValue(D, 'numBoleto',    numBoletoRifa);
  const premioNum    = resolveValue(D, 'premioNum',    premioNumRifa || '500');
  const premioTexto  = resolveValue(D, 'premioTexto',  premioTxtRifa);
  const fechaTexto   = resolveValue(D, 'fechaTexto',   fechaRifa);
  const loteriaTxt   = resolveValue(D, 'loteriaTexto', loteriaRifa);
  const valorTexto   = resolveValue(D, 'valorTexto',   valorRifa);
  const subPremioTxt = resolveValue(D, 'subPremioNum', subPremioRifa);

  // Responsive
  const [containerRef, containerWidth] = useContainerWidth();
  const PANEL_GAP = 16;
  const PANEL_W   = 280;
  const ticketAvail = containerWidth > (D.ticketWidth + PANEL_W + PANEL_GAP + 32)
    ? D.ticketWidth
    : Math.max(280, containerWidth - PANEL_W - PANEL_GAP - 32);
  const panelBelow = containerWidth > 0 && containerWidth < (D.ticketWidth + PANEL_W + PANEL_GAP + 32);
  const ticketScale = panelBelow
    ? Math.min(1, containerWidth / D.ticketWidth)
    : Math.min(1, ticketAvail / D.ticketWidth);

  // Selección
  const [selection,        setSelection]        = useState(null);
  const [showPaletas,      setShowPaletas]      = useState(false);
  const [showFormas,       setShowFormas]       = useState(false);
  const [showImagen,       setShowImagen]       = useState(false);
  const [showEstilo,       setShowEstilo]       = useState(false);
  const [showPresets,      setShowPresets]      = useState(false);
  const [showHiddenMenu,   setShowHiddenMenu]   = useState(false);

  // Cierra todos los paneles secundarios al abrir uno
  const cerrarTodos = () => {
    setShowPaletas(false); setShowFormas(false); setShowImagen(false);
    setShowEstilo(false);  setShowPresets(false); setShowHiddenMenu(false);
  };

  // Recalcula selection.data cuando design cambia
  useEffect(() => {
    if (selection?.kind === 'custom') {
      const updated = customTexts.find(t => t.id === selection.id);
      if (updated && updated !== selection.data) {
        setSelection({ kind: 'custom', id: selection.id, data: updated });
      } else if (!updated) setSelection(null);
    } else if (selection?.kind === 'shape') {
      const updated = customShapes.find(s => s.id === selection.id);
      if (updated && updated !== selection.data) {
        setSelection({ kind: 'shape', id: selection.id, data: updated });
      } else if (!updated) setSelection(null);
    } else if (selection?.kind === 'image') {
      const updated = customImages.find(i => i.id === selection.id);
      if (updated && updated !== selection.data) {
        setSelection({ kind: 'image', id: selection.id, data: updated });
      } else if (!updated) setSelection(null);
    }
  }, [customTexts, customShapes, customImages]);

  // ── Built-in handlers ──
  const handleMoveBuiltin = useCallback((campo, newPos) => {
    const def = DEFAULT_POSITIONS[campo] || {};
    const cur = positions[campo] || {};
    onUpdate('positions', {
      ...positions,
      [campo]: { ...def, ...cur, x: newPos.x, y: newPos.y },
    });
  }, [positions, onUpdate]);

  // ── Custom text handlers ──
  const handleMoveCustom = useCallback((id, newPos) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, x: newPos.x, y: newPos.y } : t
    ));
  }, [customTexts, onUpdate]);
  const handleChangeCustomValue = useCallback((id, newValue) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, value: newValue } : t
    ));
  }, [customTexts, onUpdate]);
  const handleUpdateCustomProps = useCallback((id, partial) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, ...partial } : t
    ));
  }, [customTexts, onUpdate]);
  const handleDeleteCustom = (id) => {
    onUpdate('customTexts', customTexts.filter(t => t.id !== id));
    if (selection?.id === id) setSelection(null);
  };

  // ── Shape handlers ──
  const handleMoveShape = useCallback((id, newPos) => {
    onUpdate('customShapes', customShapes.map(s =>
      s.id === id ? { ...s, x: newPos.x, y: newPos.y } : s
    ));
  }, [customShapes, onUpdate]);
  const handleUpdateShapeProps = useCallback((id, partial) => {
    onUpdate('customShapes', customShapes.map(s =>
      s.id === id ? { ...s, ...partial } : s
    ));
  }, [customShapes, onUpdate]);
  const handleDeleteShape = (id) => {
    onUpdate('customShapes', customShapes.filter(s => s.id !== id));
    if (selection?.id === id) setSelection(null);
  };

  // ── Image handlers ──
  const handleMoveImage = useCallback((id, newPos) => {
    onUpdate('customImages', customImages.map(i =>
      i.id === id ? { ...i, x: newPos.x, y: newPos.y } : i
    ));
  }, [customImages, onUpdate]);
  const handleUpdateImageProps = useCallback((id, partial) => {
    onUpdate('customImages', customImages.map(i =>
      i.id === id ? { ...i, ...partial } : i
    ));
  }, [customImages, onUpdate]);
  const handleDeleteImage = (id) => {
    onUpdate('customImages', customImages.filter(i => i.id !== id));
    if (selection?.id === id) setSelection(null);
  };

  // ── Agregar texto ──
  const handleAddText = () => {
    const newId = `custom_${Date.now()}`;
    const nuevoTexto = {
      id: newId, value: 'Texto nuevo',
      x: Math.round(D.ticketWidth / 2 - 60),
      y: Math.round(D.ticketHeight / 2),
      fontSize: 14, fontWeight: 700, color: '#000000',
      fontStyle: 'normal', fontFamily: "'Poppins', sans-serif",
      rotation: 0,
    };
    onUpdate('customTexts', [...customTexts, nuevoTexto]);
    setSelection({ kind: 'custom', id: newId, data: nuevoTexto });
    cerrarTodos();
  };

  // ── Agregar shape ──
  const handleAddShape = (type) => {
    const newId = `shape_${Date.now()}`;
    const defaultsByType = {
      arrow:     { width: 80,  height: 30 },
      star:      { width: 60,  height: 60 },
      burst:     { width: 80,  height: 80 },
      sparkle:   { width: 50,  height: 50 },
      circle:    { width: 70,  height: 70 },
      ring:      { width: 80,  height: 80 },
      rect:      { width: 100, height: 60 },
      triangle:  { width: 60,  height: 60 },
      diamond:   { width: 60,  height: 60 },
      heart:     { width: 50,  height: 50 },
      lightning: { width: 40,  height: 70 },
      polygon:   { width: 70,  height: 70 },
      ribbon:    { width: 100, height: 50 },
      banner:    { width: 120, height: 50 },
      stamp:     { width: 100, height: 100 },
      line:      { width: 120, height: 12 },
    };
    const dims = defaultsByType[type] || { width: 60, height: 60 };
    const nuevaForma = {
      id: newId, type,
      x: Math.round(D.ticketWidth / 2 - dims.width / 2),
      y: Math.round(D.ticketHeight / 2 - dims.height / 2),
      ...dims,
      rotation: 0, opacity: 0.85,
      color: '#d92626', color2: '#f5c518',
      strokeColor: '#000000', strokeWidth: 1,
      layer: 'front',
      ...(type === 'stamp'   ? { label: 'OK' } : {}),
      ...(type === 'polygon' ? { sides: 6 } : {}),
      ...(type === 'star'    ? { points: 5 } : {}),
      ...(type === 'ring'    ? { innerRadius: 32 } : {}),
      ...(type === 'rect'    ? { borderRadius: 0 } : {}),
    };
    onUpdate('customShapes', [...customShapes, nuevaForma]);
    setSelection({ kind: 'shape', id: newId, data: nuevaForma });
    cerrarTodos();
  };

  // ── Agregar imagen ──
  // src puede ser una URL o un dataURL (base64) venido de la galería.
  // meta?: { transparente, aspect }
  const handleAddImage = (src, meta = {}) => {
    const newId = `img_${Date.now()}`;
    const transparente = !!meta.transparente;

    // dimensión inicial respetando proporción (máx 200px de lado largo)
    let w = 160, h = 120;
    if (meta.aspect && meta.aspect > 0) {
      if (meta.aspect >= 1) { w = 200; h = Math.round(200 / meta.aspect); }
      else { h = 200; w = Math.round(200 * meta.aspect); }
    }

    const nuevaImg = {
      id: newId, src,
      x: Math.round(D.ticketWidth / 2 - w / 2),
      y: Math.round(D.ticketHeight / 2 - h / 2),
      width: w, height: h,
      rotation: 0, opacity: 1,
      blendMode: 'normal', borderRadius: 0,
      layer: 'back',
      // si no tiene fondo, "contain" evita recortar el recorte transparente
      objectFit: transparente ? 'contain' : 'cover',
      transparente,                 // bandera para mostrarlo en el panel
      grayscale: 0, sepia: 0, blur: 0, brightness: 1,
    };
    onUpdate('customImages', [...customImages, nuevaImg]);
    setSelection({ kind: 'image', id: newId, data: nuevaImg });
    cerrarTodos();
  };

  // ── Hide / restore built-in ──
  const handleHideBuiltin = (id) => {
    if (hiddenFields.includes(id)) return;
    onUpdate('hiddenFields', [...hiddenFields, id]);
    if (selection?.id === id) setSelection(null);
  };
  const handleRestoreBuiltin = (id) => {
    onUpdate('hiddenFields', hiddenFields.filter(f => f !== id));
  };
  const handleRestoreAll = () => {
    onUpdate('hiddenFields', []);
  };

  // ── Reset ──
  const handleResetPositions = () => {
    if (window.confirm('¿Restaurar las posiciones al diseño original? (los textos, formas e imágenes custom no se borran)')) {
      onUpdate('positions', {});
      setSelection(null);
    }
  };
  const handleResetAll = () => {
    if (window.confirm('¿BORRAR todas las formas, imágenes y textos custom?')) {
      onUpdate('customShapes', []);
      onUpdate('customImages', []);
      onUpdate('customTexts',  []);
      setSelection(null);
    }
  };

  // ── Aplicar paleta / preset ──
  const handleApplyPaleta = (colors) => {
    Object.entries(colors).forEach(([k, v]) => onUpdate(k, v));
    cerrarTodos();
  };
  const handleApplyPreset = (patch) => {
    Object.entries(patch).forEach(([k, v]) => onUpdate(k, v));
    cerrarTodos();
    setSelection(null);
  };

  // ── Click canvas vacío ──
  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      setSelection(null);
      cerrarTodos();
    }
  };

  // ── Selección desde cualquier elemento ──
  const handleSelect = useCallback((id) => {
    cerrarTodos();
    if (id.startsWith('custom_')) {
      const data = customTexts.find(t => t.id === id);
      if (data) setSelection({ kind: 'custom', id, data });
    } else if (id.startsWith('shape_')) {
      const data = customShapes.find(s => s.id === id);
      if (data) setSelection({ kind: 'shape', id, data });
    } else if (id.startsWith('img_')) {
      const data = customImages.find(i => i.id === id);
      if (data) setSelection({ kind: 'image', id, data });
    } else {
      setSelection({ kind: 'builtin', id });
    }
  }, [customTexts, customShapes, customImages]);

  const pxScaled = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);

  const getRotation = (campo) => {
    const pos = positions[campo] || DEFAULT_POSITIONS[campo] || {};
    if (pos.rotation !== undefined) return pos.rotation;
    return pos.rotated ? -90 : 0;
  };

  const STROKE = D.colorBorde;

  // Helper built-in con efectos avanzados
  const F = (campo, value, onChangeKey, textStyle, opts = {}) => {
    if (hiddenFields.includes(campo)) return null;
    // Aplica efectos avanzados (textEffects.{campo})
    const fx = D.textEffects?.[campo];
    const finalStyle = fx ? applyAdvancedTextEffects(textStyle, fx) : textStyle;
    return (
      <DraggableEditable
        key={campo} id={campo}
        position={getPos(positions, campo)}
        rotation={getRotation(campo)}
        onMove={handleMoveBuiltin}
        value={value}
        onChange={v => onUpdate(onChangeKey, v)}
        textStyle={finalStyle}
        scale={ticketScale}
        multiline={opts.multiline}
        placeholder={opts.placeholder}
        selected={selection?.id === campo}
        onSelect={handleSelect}
        printMode={printMode} />
    );
  };

  // Paper background
  const paperBg = getPaperBgStyle(D);

  // ── Botón helper para barra superior ──
  const BarButton = ({ active, onClick, bg, color, children, title }) => (
    <button onClick={onClick} title={title}
      style={{
        padding: '7px 14px',
        background: active ? bg : '#fff',
        color: active ? '#fff' : color,
        border: `1.5px solid ${color}`, borderRadius: 6,
        cursor: 'pointer', fontSize: 12, fontWeight: 700,
        fontFamily: 'inherit',
      }}>
      {children}
    </button>
  );

  return (
    <div style={{ width: '100%' }} ref={containerRef}>

      {/* ═══ Barra superior ═══ */}
      {!printMode && <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 14, padding: '10px 14px',
        background: '#f8fafa', border: '1px solid #e0e8e8',
        borderRadius: 8, fontFamily: 'system-ui, sans-serif', fontSize: 12,
      }}>
        <span style={{ fontWeight: 600, color: '#333' }}>Tamaño:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TAMANOS_GLOBALES.map(t => (
            <button key={t.label}
              onClick={() => onUpdate('globalSizeFactor', t.factor)}
              style={{
                padding: '6px 12px',
                background: globalSizeFactor === t.factor ? '#0abfbc' : '#fff',
                color: globalSizeFactor === t.factor ? '#fff' : '#333',
                border: '1px solid ' + (globalSizeFactor === t.factor ? '#0abfbc' : '#ddd'),
                borderRadius: 5, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              }}>{t.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 12 }} />

        {/* Ocultos dropdown */}
        {hiddenFields.length > 0 && (
          <div style={{ position: 'relative' }}>
            <BarButton active={showHiddenMenu}
              onClick={() => { cerrarTodos(); setShowHiddenMenu(v => !v); }}
              bg="#7c3aed" color="#7c3aed"
              title="Elementos ocultos">
              🙈 Ocultos
              <span style={{
                background: showHiddenMenu ? '#fff' : '#7c3aed',
                color: showHiddenMenu ? '#7c3aed' : '#fff',
                borderRadius: 10, padding: '1px 7px',
                fontSize: 11, fontWeight: 800, minWidth: 18, textAlign: 'center',
                marginLeft: 6,
              }}>{hiddenFields.length}</span>
            </BarButton>
            {showHiddenMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 260, background: '#fff',
                border: '1px solid #e0e0e0', borderRadius: 8,
                boxShadow: '0 6px 24px rgba(0,0,0,.12)',
                zIndex: 5000, padding: 10,
                fontFamily: 'system-ui, sans-serif',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                  paddingBottom: 8, borderBottom: '1px solid #eee',
                }}>
                  <strong style={{ fontSize: 12, color: '#333' }}>Restaurar</strong>
                  <button onClick={() => { handleRestoreAll(); setShowHiddenMenu(false); }}
                    style={{ background: 'transparent', border: 'none',
                      color: '#0abfbc', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      fontFamily: 'inherit', padding: 0 }}>Todos</button>
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {hiddenFields.map(id => {
                    const meta = FIELD_META[id];
                    return (
                      <button key={id} onClick={() => handleRestoreBuiltin(id)}
                        style={{
                          display: 'flex', width: '100%',
                          alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 10px', background: '#fff',
                          border: '1px solid #eee', borderRadius: 5,
                          marginBottom: 4, cursor: 'pointer', fontSize: 12,
                          fontFamily: 'inherit', textAlign: 'left', color: '#333',
                        }}>
                        <span>{meta?.label || id}</span>
                        <span style={{ color: '#0abfbc', fontWeight: 700 }}>↶</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <BarButton active={showPresets} bg="#db2777" color="#db2777"
          onClick={() => { cerrarTodos(); setShowPresets(true); setSelection(null); }}>
          🎭 Presets
        </BarButton>
        <BarButton active={showPaletas} bg="#f0a500" color="#f0a500"
          onClick={() => { cerrarTodos(); setShowPaletas(true); setSelection(null); }}>
          🎨 Paletas
        </BarButton>
        <BarButton active={showEstilo} bg="#f97316" color="#f97316"
          onClick={() => { cerrarTodos(); setShowEstilo(true); setSelection(null); }}>
          🖼 Marco
        </BarButton>
        <BarButton active={showFormas} bg="#7c3aed" color="#7c3aed"
          onClick={() => { cerrarTodos(); setShowFormas(true); setSelection(null); }}>
          + Forma
        </BarButton>
        <BarButton active={showImagen} bg="#06b6d4" color="#06b6d4"
          onClick={() => { cerrarTodos(); setShowImagen(true); setSelection(null); }}>
          + Imagen
        </BarButton>
        <button onClick={handleAddText}
          style={{
            padding: '7px 14px',
            background: '#0abfbc', border: '1.5px solid #0abfbc',
            color: '#fff', borderRadius: 6,
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit',
          }}>+ Texto</button>
        <button onClick={handleResetPositions}
          style={{
            padding: '7px 12px', background: '#fff', color: '#d92626',
            border: '1.5px solid #d92626', borderRadius: 6,
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit',
          }} title="Restaurar posiciones originales">↺ Reset</button>
        {(customShapes.length > 0 || customImages.length > 0 || customTexts.length > 0) && (
          <button onClick={handleResetAll}
            style={{
              padding: '7px 12px', background: '#fff', color: '#991b1b',
              border: '1.5px solid #991b1b', borderRadius: 6,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              fontFamily: 'inherit',
            }} title="Borrar TODAS las formas, imágenes y textos custom">🗑 Limpiar</button>
        )}
      </div>}

      {/* ═══ Layout principal: ticket + panel ═══ */}
      <div style={{
        display: 'flex', gap: PANEL_GAP,
        flexDirection: panelBelow ? 'column' : 'row',
        alignItems: 'flex-start',
      }}>

        {/* ── Wrapper del ticket ── */}
        <div style={{
          flex: panelBelow ? 'none' : '0 0 auto',
          width: panelBelow ? '100%' : D.ticketWidth * ticketScale,
          height: D.ticketHeight * ticketScale,
          position: 'relative',
        }}>
          <div data-ticket-canvas="true"
            onMouseDown={handleCanvasMouseDown}
            style={{
              width: D.ticketWidth, height: D.ticketHeight,
              fontFamily: "'Poppins','Arial Black',sans-serif",
              ...paperBg,
              border: `${D.frameWidth || 2.5}px solid ${D.frameColor || STROKE}`,
              position: 'relative', overflow: 'hidden',
              transform: ticketScale < 1 ? `scale(${ticketScale})` : 'none',
              transformOrigin: 'top left',
              boxSizing: 'border-box',
            }}>

            {/* ═══ CAPAS DE FONDO ═══ */}
            {customImages.filter(im => (im.layer || 'back') === 'back').map(im => (
              <DecorativeImage key={im.id} image={im} scale={ticketScale}
                draggable={!printMode}
                selected={selection?.id === im.id}
                onSelect={handleSelect} onMove={handleMoveImage} />
            ))}
            {customShapes.filter(sh => (sh.layer || 'back') === 'back').map(sh => (
              <DecorativeShape key={sh.id} shape={sh} scale={ticketScale}
                draggable={!printMode}
                selected={selection?.id === sh.id}
                onSelect={handleSelect} onMove={handleMoveShape} />
            ))}
            <WatermarkLayer design={D} />

            {/* Líneas decorativas fijas (talón) */}
            <div style={{ position: 'absolute', left: 115, top: 0, bottom: 0,
              borderLeft: `2px dashed ${STROKE}`, pointerEvents: 'none', zIndex: 1 }} />
            <div style={{ position: 'absolute', left: 137, top: 0, bottom: 0,
              borderLeft: `1px solid ${STROKE}`, pointerEvents: 'none', zIndex: 1 }} />
            <div style={{ position: 'absolute', left: 145, right: 10,
              bottom: 50, height: 0,
              borderTop: `1px dashed ${STROKE}40`, pointerEvents: 'none', zIndex: 1 }} />

            {/* ═══ TEXTOS BUILT-IN ═══ */}
            {F('numBoletoIzq', numBoleto, 'numBoleto', {
              border: `2px solid ${STROKE}`, padding: '6px 12px',
              fontSize: pxScaled(D.sizeNumTalon), fontWeight: 900,
              color: D.colorTalon, letterSpacing: 2, background: '#fff',
            })}
            {F('nombreLabel', 'NOMBRE:', '_label_NOMBRE', {
              fontSize: pxScaled(D.sizeNombre), fontWeight: 700, color: '#000',
            })}
            {F('telLabel', 'Tel:', '_label_Tel', {
              fontSize: Math.max(8, pxScaled(D.sizeNombre) - 4),
              color: '#666', letterSpacing: .5,
            })}
            {F('brandText', D.brandText, 'brandText', {
              fontSize: pxScaled(D.sizeBrand), fontWeight: 900,
              color: D.colorTalon, letterSpacing: 4, fontStyle: 'italic',
            })}
            {F('talonText', D.talonText, 'talonText', {
              fontSize: pxScaled(D.sizeTalonText), fontWeight: 800,
              color: '#000', letterSpacing: 2,
            })}

            {F('sloganTop', D.sloganTop, 'sloganTop', {
              fontSize: pxScaled(D.sizeSlogan), fontWeight: 900,
              color: D.colorSlogan, letterSpacing: 1,
              textTransform: 'uppercase',
              WebkitTextStroke: `.5px ${STROKE}`,
              textShadow: '1px 1px 0 rgba(0,0,0,.15)', lineHeight: 1,
            })}
            {F('fechaPrefix', D.fechaPrefix, 'fechaPrefix', {
              fontSize: pxScaled(D.sizeFecha), fontWeight: 800,
              color: D.colorFecha, fontStyle: 'italic', letterSpacing: .5,
            })}
            {F('fechaTexto', fechaTexto, 'fechaTexto', {
              fontSize: pxScaled(D.sizeFecha), fontWeight: 800,
              color: D.colorFecha, fontStyle: 'italic', letterSpacing: .5,
            })}
            {F('numBoletoDer', numBoleto, 'numBoleto', {
              border: `2px solid ${STROKE}`, padding: '6px 14px',
              fontSize: pxScaled(D.sizeNumDer), fontWeight: 900,
              color: D.colorTalon, letterSpacing: 2, background: '#fff',
            })}

            {F('premioLabel', D.premioLabel, 'premioLabel', {
              fontSize: pxScaled(D.sizePremioLabel), fontWeight: 800,
              fontStyle: 'italic', color: D.colorPremio1,
              letterSpacing: .5, lineHeight: 1,
              textShadow: `2px 2px 0 ${STROKE}`,
            })}
            {/* premioNum: SVG en printMode, CSS-clip en edición */}
            {!hiddenFields.includes('premioNum') && printMode ? (
              <PremioNumeroSVG key="premioNum" value={premioNum}
                position={getPos(positions, 'premioNum')}
                rotation={getRotation('premioNum')}
                fontSize={pxScaled(D.sizePremioNum)}
                color1={D.colorPremio1} color2={D.colorPremio2}
                stroke={D.colorPremioStroke || STROKE}
                dropShadowColor={`${STROKE}30`} />
            ) : F('premioNum', premioNum, 'premioNum', {
              fontFamily: "'Arial Black','Poppins',sans-serif",
              fontWeight: 900, fontSize: pxScaled(D.sizePremioNum),
              lineHeight: .85, letterSpacing: 2,
              backgroundImage: `linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2 || D.colorPremio1} 52%,${D.colorPremio2 || D.colorPremio1} 100%)`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: 'transparent',
              WebkitTextStroke: `1px ${D.colorPremioStroke || STROKE}`,
              filter: `drop-shadow(3px 3px 0 ${STROKE}30)`,
            })}
            {F('premioTexto', premioTexto, 'premioTexto', {
              fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
              fontSize: pxScaled(D.sizePremioTxt), fontWeight: 700,
              color: D.colorDolares, fontStyle: 'italic', lineHeight: 1,
              textShadow: `2px 2px 0 ${STROKE}40`,
            }, { placeholder: '(tipo)' })}
            {F('subPremioPrefix', D.subPremioPrefix, 'subPremioPrefix', {
              fontSize: pxScaled(D.sizeSubPremio), fontWeight: 900,
              color: D.colorSubPremio, fontStyle: 'italic',
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            })}
            {F('subPremioNum', subPremioTxt, 'subPremioNum', {
              fontSize: pxScaled(D.sizeSubPremio), fontWeight: 900,
              color: D.colorSubPremio, fontStyle: 'italic',
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            }, { placeholder: '(monto)' })}
            {F('subPremioMoneda', D.subPremioMoneda, 'subPremioMoneda', {
              fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
              fontSize: pxScaled(D.sizeSubMoneda), fontWeight: 700,
              color: D.colorPesosSub, fontStyle: 'italic',
              textShadow: `1px 1px 0 ${STROKE}40`,
            })}

            {F('caducaText', D.caducaText, 'caducaText', {
              fontSize: pxScaled(D.sizeCaduca), fontWeight: 700,
              color: D.colorCaduca, letterSpacing: .5, fontStyle: 'italic',
            })}
            {F('loteriaTexto', loteriaTxt, 'loteriaTexto', {
              fontSize: pxScaled(D.sizeLoteria), fontWeight: 700,
              color: D.colorLoteria, lineHeight: 1.15, fontStyle: 'italic',
            })}

            {F('motivacionalText', D.motivacionalText, 'motivacionalText', {
              fontSize: pxScaled(D.sizeMotivac), fontWeight: 600,
              color: D.colorMotivac, fontStyle: 'italic',
              lineHeight: 1.2, maxWidth: 380, whiteSpace: 'normal',
            }, { multiline: true })}
            {F('boletoLabel', D.boletoLabel, 'boletoLabel', {
              fontSize: pxScaled(D.sizeBoleto), fontWeight: 900,
              color: D.colorBoleto, letterSpacing: 1,
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            })}
            {F('valorTexto', valorTexto, 'valorTexto', {
              fontSize: pxScaled(D.sizeValor), fontWeight: 900,
              color: D.colorValor, fontStyle: 'italic', lineHeight: 1,
              textShadow: `2px 2px 0 ${STROKE}40`,
            })}
            {F('valorSufijo', D.valorSufijo, 'valorSufijo', {
              fontSize: pxScaled(D.sizePesos), fontWeight: 900,
              color: D.colorPesos, letterSpacing: .5,
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            })}

            {D.footerText !== '' && F('footerText', D.footerText, 'footerText', {
              fontSize: pxScaled(D.sizeFooter), color: '#999', letterSpacing: .5,
            })}

            {/* ═══ TEXTOS CUSTOM ═══ */}
            {customTexts.map(t => {
              const baseStyle = {
                fontSize: pxScaled(t.fontSize),
                fontWeight: t.fontWeight,
                color: t.color,
                fontStyle: t.fontStyle,
                fontFamily: t.fontFamily,
              };
              const finalStyle = t.fx ? applyAdvancedTextEffects(baseStyle, t.fx) : baseStyle;
              return (
                <DraggableEditable key={t.id} id={t.id}
                  position={{ x: t.x, y: t.y }}
                  rotation={t.rotation || 0}
                  onMove={handleMoveCustom}
                  value={t.value}
                  onChange={v => handleChangeCustomValue(t.id, v)}
                  textStyle={finalStyle}
                  scale={ticketScale}
                  selected={selection?.id === t.id}
                  onSelect={handleSelect}
                  printMode={printMode} />
              );
            })}

            {/* ═══ CAPAS FRONT (sobre todo) ═══ */}
            {customShapes.filter(sh => sh.layer === 'front').map(sh => (
              <DecorativeShape key={sh.id} shape={sh} scale={ticketScale}
                draggable={!printMode}
                selected={selection?.id === sh.id}
                onSelect={handleSelect} onMove={handleMoveShape} />
            ))}
            {customImages.filter(im => im.layer === 'front').map(im => (
              <DecorativeImage key={im.id} image={im} scale={ticketScale}
                draggable={!printMode}
                selected={selection?.id === im.id}
                onSelect={handleSelect} onMove={handleMoveImage} />
            ))}

            {/* ═══ MARCO DECORATIVO ═══ */}
            <FrameLayer design={D} />
          </div>
        </div>

        {/* ── Panel lateral ── */}
        {!printMode && <div style={{
          flex: panelBelow ? 'none' : '0 0 auto',
          width: panelBelow ? '100%' : PANEL_W,
        }}>
          {showPaletas ? (
            <PaletasPanel onApply={handleApplyPaleta} onClose={() => setShowPaletas(false)} />
          ) : showFormas ? (
            <FormasPanel onAdd={handleAddShape} onClose={() => setShowFormas(false)} />
          ) : showImagen ? (
            <ImagenPanel onAdd={handleAddImage} onClose={() => setShowImagen(false)} />
          ) : showEstilo ? (
            <EstiloPanel design={baseDesign} onUpdateDesign={onUpdate}
              onClose={() => setShowEstilo(false)} />
          ) : showPresets ? (
            <PresetsPanel onApply={handleApplyPreset} onClose={() => setShowPresets(false)} />
          ) : selection ? (
            <ElementPanel selection={selection} design={baseDesign}
              onUpdateDesign={onUpdate}
              onUpdateCustom={handleUpdateCustomProps}
              onUpdateShape={handleUpdateShapeProps}
              onUpdateImage={handleUpdateImageProps}
              onDeleteCustom={handleDeleteCustom}
              onDeleteShape={handleDeleteShape}
              onDeleteImage={handleDeleteImage}
              onHideBuiltin={handleHideBuiltin}
              onClose={() => setSelection(null)} />
          ) : (
            <div style={{
              padding: '24px 18px', background: '#f8fafa',
              border: '1px dashed #c0d0d0', borderRadius: 10,
              textAlign: 'center', fontFamily: 'system-ui, sans-serif',
              fontSize: 13, color: '#666', lineHeight: 1.55,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
              <strong style={{ color: '#333', display: 'block', marginBottom: 6 }}>
                Selecciona un elemento
              </strong>
              <p style={{ margin: 0, fontSize: 12 }}>
                Click en cualquier <strong>texto</strong>, <strong>forma</strong> o <strong>imagen</strong>.<br/>
                <span style={{ color: '#999' }}>
                  Arrastra para mover · Shift+arrastra para snap a grid
                </span>
              </p>
              <p style={{ margin: '12px 0 0', fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
                💡 Prueba los <strong>🎭 Presets</strong> para diseños espectaculares
              </p>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}