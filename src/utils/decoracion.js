// ============================================================
//  decoracion.js — Plantillas y dibujos de la decoración por fecha
//  Los usan la página del cliente y el panel (Decoración). Cada
//  plantilla trae colores, efecto y adornos listos; las imágenes
//  propias del dueño reemplazan a los dibujos.
// ============================================================

export const CLAVE_VISTA = 'rts_decoracion_vista';    // lo que se está editando, para la vista previa
export const CLAVE_CACHE = 'rts_decoracion_cache';    // la última vista, para que no parpadee al entrar

const VACIA = {
  id: '', nombre: '', plantilla: 'personalizada', activa: true, cuando: 'manual', desde: '', hasta: '',
  color1: '#0abfbc', color2: '#ffd166', color_fondo: '#e9fafa', tono: 'claro', velo: 70,
  efecto: 'ninguno', intensidad: 'media', guirnalda: 'ninguna', esquinas: 'ninguna',
  mensaje: '', titulo1: '', titulo2: '',
  img_banner_pc: '', img_banner_movil: '', img_fondo: '', img_esquina_izq: '', img_esquina_der: '',
  img_guirnalda: '', img_efecto: '', img_logo: '',
};

export const PLANTILLAS = [
  { id: 'navidad', nombre: 'Navidad', emoji: '🎄', fechas: '15 nov – 26 dic', datos: {
    cuando: 'cada_anio', desde: '11-15', hasta: '12-26', color1: '#c1121f', color2: '#f2b705', color_fondo: '#fff6f0',
    efecto: 'nieve', guirnalda: 'luces', esquinas: 'acebo', mensaje: '🎄 ¡Feliz Navidad!', titulo1: 'Esta Navidad', titulo2: 'tu número te está esperando' } },
  { id: 'anio_nuevo', nombre: 'Año Nuevo', emoji: '🎆', fechas: '27 dic – 2 ene', datos: {
    cuando: 'cada_anio', desde: '12-27', hasta: '01-02', color1: '#d4a017', color2: '#ffe08a', color_fondo: '#10131f', tono: 'oscuro',
    efecto: 'confeti', guirnalda: 'estrellas', esquinas: 'globos', mensaje: '🥂 ¡Feliz Año Nuevo!', titulo1: 'Empieza el año', titulo2: 'con tu número de la suerte' } },
  { id: 'semana_santa', nombre: 'Semana Santa', emoji: '🕊️', fechas: 'Cambia cada año', datos: {
    cuando: 'semana_santa', color1: '#6b3fa0', color2: '#d4af37', color_fondo: '#f8f3ff',
    efecto: 'petalos', intensidad: 'poca', guirnalda: 'flores', esquinas: 'flores', mensaje: '🕊️ Feliz Semana Santa' } },
  { id: 'halloween', nombre: 'Halloween', emoji: '🎃', fechas: '25 oct – 1 nov', datos: {
    cuando: 'cada_anio', desde: '10-25', hasta: '11-01', color1: '#f76707', color2: '#a855f7', color_fondo: '#14101f', tono: 'oscuro',
    efecto: 'murcielagos', intensidad: 'poca', guirnalda: 'murcielagos', esquinas: 'telarana', mensaje: '🎃 ¡Feliz Halloween!', titulo1: 'Tu número de la suerte', titulo2: 'te espera en la oscuridad' } },
  { id: 'carnaval', nombre: 'Carnaval', emoji: '🎭', fechas: 'Cambia cada año', datos: {
    cuando: 'carnaval', color1: '#d6249f', color2: '#ffc300', color_fondo: '#fff8e7',
    efecto: 'confeti', intensidad: 'mucha', guirnalda: 'banderines', esquinas: 'globos', mensaje: '🎭 ¡Felices Carnavales!' } },
  { id: 'patrias', nombre: 'Fiestas patrias', emoji: '🇻🇪', fechas: '3 – 6 jul', datos: {
    cuando: 'cada_anio', desde: '07-03', hasta: '07-06', color1: '#00247d', color2: '#ffcc00', color_fondo: '#f3f7ff',
    efecto: 'estrellas', intensidad: 'poca', guirnalda: 'banderines', esquinas: 'ninguna', mensaje: '🇻🇪 ¡Feliz Día de la Independencia!' } },
  { id: 'madres', nombre: 'Día de las Madres', emoji: '💐', fechas: '6 – 14 may', datos: {
    cuando: 'cada_anio', desde: '05-06', hasta: '05-14', color1: '#e64980', color2: '#ffb3c6', color_fondo: '#fff5f8',
    efecto: 'petalos', guirnalda: 'flores', esquinas: 'flores', mensaje: '💐 ¡Feliz día, mamá!' } },
  { id: 'amor', nombre: 'Amor y Amistad', emoji: '💘', fechas: '10 – 15 feb', datos: {
    cuando: 'cada_anio', desde: '02-10', hasta: '02-15', color1: '#e03131', color2: '#ffa8a8', color_fondo: '#fff5f5',
    efecto: 'corazones', guirnalda: 'corazones', mensaje: '💘 ¡Feliz día del Amor y la Amistad!' } },
  { id: 'personalizada', nombre: 'Otra fecha', emoji: '✨', fechas: 'Tú la armas', datos: {} },
];

export const nuevaDecoracion = (plantilla) => ({
  ...VACIA, ...plantilla.datos, plantilla: plantilla.id,
  nombre: plantilla.id === 'personalizada' ? '' : plantilla.nombre,
});

// ── Colores ────────────────────────────────────────────────
const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function mezclar(hex, con, cuanto) {
  const a = aRgb(hex), b = aRgb(con);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * cuanto).toString(16).padStart(2, '0')).join('')}`;
}

// Letra blanca u oscura según lo claro que sea el color de atrás
export function letraSobre(hex) {
  const [r, g, b] = aRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1a2e2e' : '#ffffff';
}

// Cloudinary entrega la imagen al tamaño justo (los GIF se dejan como vienen)
export function optimizada(url, ancho) {
  if (!url || !url.includes('/upload/') || /\.gif($|\?)/i.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${ancho}/`);
}

// ── Dibujos incluidos ──────────────────────────────────────
const svgUri = (w, h, cuerpo) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${cuerpo}</svg>`)}")`;

const bombillo = (x, y, c) => `<rect x='${x - 3}' y='${y - 7}' width='6' height='6' rx='1' fill='#333'/><path d='M${x - 6} ${y + 3}c0-5 3-5 6-5s6 0 6 5c0 7-4 11-6 11s-6-4-6-11z' fill='${c}'/><ellipse cx='${x - 2}' cy='${y + 3}' rx='1.6' ry='3' fill='#fff' opacity='.6'/>`;

const estrella = (x, y, r, c) => {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, q = i % 2 ? r * 0.45 : r;
    p.push(`${(x + q * Math.cos(a)).toFixed(1)},${(y + q * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points='${p.join(' ')}' fill='${c}'/>`;
};

const corazon = (x, y, s, c) => `<path transform='translate(${x} ${y}) scale(${s})' d='M0 4C-2-3-11-2-11 5c0 6 7 10 11 14 4-4 11-8 11-14C11-2 2-3 0 4z' fill='${c}'/>`;

const flor = (x, y, r, c, centro) => [0, 72, 144, 216, 288].map((g) => `<ellipse cx='${x}' cy='${y - r}' rx='${r * 0.62}' ry='${r}' fill='${c}' transform='rotate(${g} ${x} ${y})'/>`).join('') + `<circle cx='${x}' cy='${y}' r='${r * 0.5}' fill='${centro}'/>`;

const murcielago = (x, y, s, c) => `<path transform='translate(${x} ${y}) scale(${s})' fill='${c}' d='M0-3l2-4 1 3c3-1 5 0 6 1 3-3 8-4 13-3-3 2-4 5-3 8-3-2-5-1-6 1-2-2-4-1-5 2-2-2-3-3-5-2-3 2-2 5-3 7-1-2 0-5-3-7-2-1-3 0-5 2-1-3-3-4-5-2-1-2-3-3-6-1 1-3 0-6-3-8 5-1 10 0 13 3 1-1 3-2 6-1l1-3z'/>`;

const COLORES_PATRIA = ['#ffcc00', '#00247d', '#cf142b'];

export function guirnaldaSvg(d) {
  const { color1: c1, color2: c2 } = d;
  const cuerda = (w, h) => `<path d='M0 3Q${w / 2} ${h} ${w} 3' fill='none' stroke='#444' stroke-width='1.6'/>`;
  switch (d.guirnalda) {
    case 'luces':
      return svgUri(200, 46, cuerda(100, 26).concat(`<path d='M100 3Q150 26 200 3' fill='none' stroke='#444' stroke-width='1.6'/>`)
        + bombillo(26, 16, c1) + bombillo(62, 19, c2) + bombillo(100, 8, '#2f9e44') + bombillo(136, 17, c1) + bombillo(172, 17, '#1c7ed6'));
    case 'banderines': {
      const col = d.plantilla === 'patrias' ? COLORES_PATRIA : [c1, c2, mezclar(c1, '#ffffff', 0.45)];
      const banda = col.map((c, i) => {
        const x = 8 + i * 42;
        return `<path d='M${x} 7L${x + 34} 7L${x + 17} 40z' fill='${c}'/>`;
      }).join('');
      return svgUri(126, 46, `<path d='M0 6H126' stroke='#444' stroke-width='1.6'/>${banda}`);
    }
    case 'estrellas':
      return svgUri(160, 50, `<path d='M30 0V18M84 0V26M132 0V12' stroke='${c2}' stroke-width='1'/>`
        + estrella(30, 26, 10, c1) + estrella(84, 35, 12, c2) + estrella(132, 20, 8, c1));
    case 'murcielagos':
      {
        const base = d.tono === 'oscuro' ? c2 : '#17121f';
        return svgUri(190, 48, murcielago(40, 16, 0.8, base) + murcielago(112, 30, 1, base) + murcielago(164, 12, 0.6, c1));
      }
    case 'corazones':
      return svgUri(150, 48, `<path d='M28 0V14M84 0V22M128 0V10' stroke='${c1}' stroke-width='1'/>`
        + corazon(28, 15, 0.8, c1) + corazon(84, 23, 1, c2) + corazon(128, 11, 0.7, c1));
    case 'flores':
      return svgUri(150, 44, `<path d='M0 4Q75 26 150 4' fill='none' stroke='#5c8d5a' stroke-width='2'/>`
        + flor(30, 15, 8, c1, c2) + flor(75, 19, 10, c2, c1) + flor(120, 15, 8, c1, c2));
    default:
      return '';
  }
}

export function esquinaSvg(d) {
  const { color1: c1, color2: c2 } = d;
  switch (d.esquinas) {
    case 'acebo': {
      const hoja = (g) => `<path transform='rotate(${g} 42 42)' fill='#1f7a3f' stroke='#135c2c' stroke-width='1.5' d='M42 42c10-8 18-8 26-8l-3 6 8 1-4 6 8 3-6 4 5 7-8 0 1 8c-9-2-20-13-27-27z'/>`;
      return svgUri(200, 200, `<g transform='scale(2)'>${hoja(0)}${hoja(70)}${hoja(-70)}<circle cx='38' cy='40' r='7' fill='#c1121f'/><circle cx='50' cy='38' r='7' fill='#e03131'/><circle cx='43' cy='50' r='7' fill='#a30f1a'/><circle cx='36' cy='38' r='2' fill='#fff' opacity='.6'/></g>`);
    }
    case 'telarana': {
      const radios = [0, 18, 36, 54, 72, 90].map((g) => {
        const a = (g * Math.PI) / 180;
        return [Math.cos(a), Math.sin(a)];
      });
      const lineas = radios.map(([x, y]) => `<path d='M0 0L${(x * 172).toFixed(0)} ${(y * 172).toFixed(0)}'/>`).join('');
      const anillos = [50, 90, 130, 170].map((r) => {
        let p = '';
        radios.forEach(([x, y], i) => {
          if (i) {
            const [xa, ya] = radios[i - 1];
            const mx = ((xa + x) / 2) * r * 0.82, my = ((ya + y) / 2) * r * 0.82;
            p += `Q${mx.toFixed(0)} ${my.toFixed(0)} ${(x * r).toFixed(0)} ${(y * r).toFixed(0)}`;
          } else p = `M${(x * r).toFixed(0)} ${(y * r).toFixed(0)}`;
        });
        return `<path d='${p}'/>`;
      }).join('');
      const tono = d.tono === 'oscuro' ? '#f1f3f5' : '#495057';
      return svgUri(200, 200, `<g fill='none' stroke='${tono}' stroke-width='1.5' opacity='.75'>${lineas}${anillos}</g>`);
    }
    case 'globos': {
      const globo = (x, y, c) => `<path d='M${x} ${y + 32}q-6 34 6 66' fill='none' stroke='#868e96' stroke-width='1.3'/><ellipse cx='${x}' cy='${y}' rx='25' ry='31' fill='${c}'/><ellipse cx='${x - 9}' cy='${y - 11}' rx='5' ry='9' fill='#fff' opacity='.45'/>`;
      return svgUri(200, 200, globo(58, 66, c1) + globo(118, 44, c2) + globo(158, 92, mezclar(c1, '#ffffff', 0.4)));
    }
    case 'flores':
      return svgUri(200, 200, `<path d='M0 60Q70 60 120 0' fill='none' stroke='#5c8d5a' stroke-width='3'/>`
        + flor(44, 62, 19, c1, c2) + flor(104, 44, 15, c2, c1) + flor(36, 124, 13, c2, c1));
    default:
      return '';
  }
}

// ── Lo que cae por la pantalla ─────────────────────────────
export const CANTIDAD_EFECTO = { poca: 12, media: 22, mucha: 36 };

const estiloDecoracion = (d) => {
  const c1 = d.color1, c2 = d.color2, fondo = d.color_fondo;
  const oscuro = d.tono === 'oscuro';
  const c1Oscuro = mezclar(c1, '#000000', 0.42);
  const c1Fuerte = oscuro ? mezclar(c1, '#ffffff', 0.25) : mezclar(c1, '#000000', 0.2);
  const velo = `${fondo}${Math.round((d.velo / 100) * 255).toString(16).padStart(2, '0')}`;
  const fondoFin = mezclar(fondo, oscuro ? '#000000' : '#ffffff', 0.45);
  return { c1, c2, fondo, oscuro, c1Oscuro, c1Fuerte, velo, fondoFin };
};

// Toda la apariencia sale de aquí. Los colores y las URL ya vienen validados por el servidor.
export function cssDecoracion(d) {
  const { c1, c2, oscuro, c1Oscuro, c1Fuerte, fondo, fondoFin } = estiloDecoracion(d);
  const letra = letraSobre(c1);
  return `
    .pub-deco { background:linear-gradient(180deg,${fondo},${fondoFin}); }
    .pub-deco .pub-fondo { display:none; }
    .pub-deco .pub-nav { border-bottom:3px solid ${c1}; }
    .pub-deco-oscuro .pub-nav { background:rgba(255,255,255,.96); }
    .pub-deco .pub-cinta { background:linear-gradient(90deg,${c1Oscuro},${mezclar(c1, '#000000', 0.2)} 50%,${c1Oscuro}); border-bottom-color:${c2}; }
    .pub-deco .pub-cinta span b { color:${mezclar(c2, '#ffffff', 0.6)}; }
    .pub-deco .pub-cinta span::after { color:${c2}; }
    .pub-deco .pub-intro-chip { color:${mezclar(c1, '#000000', 0.2)}; border-color:${c1}66; }
    .pub-deco .pub-intro-chip b { background:${c1}; }
    .pub-deco .pub-bolas i { border-color:${c1} !important; }
    .pub-deco .pub-bolas i:nth-child(even) { border-color:${c2} !important; }
    .pub-deco .pub-intro h1 span { background-image:linear-gradient(100deg,${c1Fuerte},${c1} 28%,${c2} 50%,${c1} 72%,${c1Fuerte}); }
    .pub-deco .pub-hero-marco { background-image:linear-gradient(120deg,${c1},${c2},${c1Fuerte},${c2},${c1}); box-shadow:0 26px 70px ${c1}4d; }
    .pub-deco .pub-btn[aria-expanded] { background:linear-gradient(135deg,${c1},${c1Fuerte}) !important; color:${letra}; box-shadow:0 8px 24px ${c1}55; animation:none !important; }
    .pub-deco .pub-titulo .kicker { color:${oscuro ? c2 : c1Fuerte}; background:${c1}1f; }
    .pub-deco .pub-titulo h2::after { background:linear-gradient(90deg,${c1},${c2}); }
    .pub-deco .pub-mini-titulo { color:${mezclar(c1, '#000000', 0.2)}; }
    .pub-deco #contacto-sec { border-top-color:${c1} !important; }
    .pub-deco-oscuro .pub-intro h1, .pub-deco-oscuro .pub-titulo h2, .pub-deco-oscuro .res-ant-tit { color:#fff; }
    .pub-deco-oscuro .pub-intro p, .pub-deco-oscuro .pub-titulo .sub { color:rgba(255,255,255,.75); }
    .pub-deco-oscuro .pub-sello { background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.2); color:#fff; }
    .pub-deco-oscuro .pub-sello i { color:${c2}; }
    .deco-nieve { color:${oscuro ? '#ffffff' : mezclar(c1, '#8ecbf0', 0.8)}; }
  `;
}

export const fondoDecoracion = (d, url) => {
  const { velo } = estiloDecoracion(d);
  return `linear-gradient(${velo},${velo}),url("${url}") center/cover no-repeat`;
};
