import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';

const TURQ    = '#0abfbc';
const TURQ2   = '#00d4d0';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';
const NARANJA = '#ff6b2b';
const VERDE   = '#22c55e';

const fmt  = p => p ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p) : '$0';

/* ─────────────────────────────────────────────────────────────
   FIX PUNTO 1A — parseFecha + fmtF con zona horaria explícita
   Problema original: new Date(f) interpretaba la fecha en UTC
   del navegador, causando desfase de horas según el país.
   Solución: normalizar el string ISO y usar timeZone fijo.
───────────────────────────────────────────────────────────── */
const parseFecha = (f) => {
  if (!f) return null;
  // PostgreSQL puede devolver "2025-07-15T04:00:00.000Z" o "2025-07-15 04:00:00"
  // Normalizamos el espacio por T para que todos los navegadores parseen igual
  const iso = String(f).replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const fmtF = f => {
  const d = parseFecha(f);
  if (!d) return 'Por definir';
  // Usa 'America/Caracas' (UTC-4). Cámbialo a 'America/Bogota' (UTC-5) si tu servidor es Colombia.
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Caracas',
  });
};

/* ─── Códigos de país ─── */
const PAISES = [
  { code:'+58',  flag:'🇻🇪', name:'Venezuela'    },
  { code:'+57',  flag:'🇨🇴', name:'Colombia'     },
  { code:'+1',   flag:'🇺🇸', name:'USA/Canadá'   },
  { code:'+52',  flag:'🇲🇽', name:'México'       },
  { code:'+51',  flag:'🇵🇪', name:'Perú'         },
  { code:'+593', flag:'🇪🇨', name:'Ecuador'      },
  { code:'+56',  flag:'🇨🇱', name:'Chile'        },
  { code:'+54',  flag:'🇦🇷', name:'Argentina'    },
  { code:'+34',  flag:'🇪🇸', name:'España'       },
  { code:'+55',  flag:'🇧🇷', name:'Brasil'       },
];

/* ─── Datos de cada método de pago ─── */
const METODOS_PAGO = {
  'Pago Móvil': {
    colorHex: TURQ_DK, bg: '#f0fff8', border: `${TURQ}55`, icono: '📱',
    pais: '🇻🇪 Venezuela · Bolívares',
    campos: [
      { label: 'Banco',    valor: 'Banco de Venezuela' },
      { label: 'Teléfono', valor: '04129287210'        },
      { label: 'Cédula',   valor: 'V-23542583'         },
    ],
  },
  'Nequi': {
    colorHex: '#c2007a', bg: '#fdf0f9', border: '#f0c0e8', icono: '💜',
    pais: '🇨🇴 Colombia',
    campos: [
      { label: 'Número Nequi', valor: '3224012780'    },
      { label: 'Titular',      valor: 'Carmen Rangel' },
    ],
    nota: '⚠️ Solo de Nequi a Nequi',
  },
  'Bancolombia': {
    colorHex: '#b8860b', bg: '#fff8e1', border: '#ffe082', icono: '🏦',
    pais: '🇨🇴 Colombia',
    campos: [
      { label: 'Tipo',          valor: 'Cuenta de Ahorros' },
      { label: 'Nro de cuenta', valor: '08820968591'       },
      { label: 'Titular',       valor: 'Jordyn Ramirez'    },
    ],
    nota: '⚠️ Solo de Bancolombia a Bancolombia',
  },
  'Zelle': {
    colorHex: '#4a5bbf', bg: '#f0f4ff', border: '#c5d3ff', icono: '💙',
    pais: '🇺🇸 Estados Unidos · USD',
    campos: [
      { label: 'Correo',         valor: 'angelespinosag00@gmail.com' },
      { label: 'Nombre',         valor: 'Angel Espinosa'             },
      { label: 'Tasa de cambio', valor: '$1 USD = $3.380'            },
      { label: 'Mínimo',         valor: 'Desde $10 USD'              },
    ],
    nota: '⚠️ No colocar descripción ni concepto',
  },
  'Efectivo': {
    colorHex: '#3a7d44', bg: '#f0fff4', border: '#a8d5b5', icono: '💵',
    pais: '📍 Presencial',
    campos: [
      { label: 'Contacto', valor: 'Escríbenos por WhatsApp para coordinar' },
    ],
  },
};

/* ─────────────────────────────────────────────────────────────
   Hook único: ambas tasas desde /api/tasas/hoy
   Fórmula Bs = precio_COP / COP_POR_USD * BSD_POR_USD
───────────────────────────────────────────────────────────── */
let _tasasHoyCache = null;
let _tasasHoyTs    = 0;

// DESPUÉS
function useTasasHoy() {
  const [tasas, setTasas] = useState(_tasasHoyCache);
  useEffect(() => {
    if (_tasasHoyCache && Date.now() - _tasasHoyTs < 600_000) {
      setTasas(_tasasHoyCache); return;
    }
    // DESPUÉS
      fetch('https://rifasjordynb-production.up.railway.app/api/tasas')
        .then(r => r.json())
        .then(data => {
          const t = {
            copUsd: data?.COP_POR_USD?.valor || 4200,
            bsdUsd: data?.BSD_POR_USD?.valor || 0,
          };
        _tasasHoyCache = t;
        _tasasHoyTs    = Date.now();
        setTasas(t);
      })
      .catch(() => {});
  }, []);
  // null = todavía cargando (distinto de bsdUsd:0 que sería "configurado en cero")
  return tasas ?? null;
}

const METODO_MONEDA = {
  'Pago Móvil':  'VES',
  'Nequi':       'COP',
  'Bancolombia': 'COP',
  'Zelle':       'USD',
  'Efectivo':    'COP',
};

// DESPUÉS
function calcularPrecioMetodo(precioCOP, metodo, tasaBsUSD, copUsd = 4200) {
  const moneda = METODO_MONEDA[metodo];
  if (!moneda || moneda === 'COP') return null;
  const usd = precioCOP / copUsd;
  if (moneda === 'USD') return { valor: usd, texto: `$${usd.toFixed(2)} USD`, moneda: 'USD', icono: '💵' };
  if (moneda === 'VES') {
    // Si la tasa aún no cargó, mostrar "cargando" en lugar de caer a COP
    if (!tasaBsUSD || tasaBsUSD <= 0) {
      return { valor: 0, texto: 'Cargando Bs...', moneda: 'VES', icono: '🇻🇪', cargando: true };
    }
    const bs = usd * tasaBsUSD;
    return { valor: bs, texto: `Bs. ${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(bs)}`, moneda: 'VES', icono: '🇻🇪' };
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   LÓGICA DE OFERTAS
═══════════════════════════════════════════════════════════ */
/**
 * Dada una cantidad seleccionada y el array de ofertas,
 * retorna { oferta, totalConOferta, ahorro, pct } o null.
 *
 * Regla: si la cantidad es múltiplo exacto de la cantidad
 * de la oferta (o igual), se aplica el pack proporcional.
 * Se usa la oferta más beneficiosa (mayor ahorro).
 */
function calcularOferta(cantidad, ofertas, precioUnitario) {
  if (!ofertas || ofertas.length === 0 || cantidad === 0) return null;

  let mejor = null;
  let mejorAhorro = -1;

  for (const o of ofertas) {
    if (cantidad >= o.cantidad && cantidad % o.cantidad === 0) {
      const veces           = cantidad / o.cantidad;
      const totalConOferta  = o.precio_total * veces;
      const totalNormal     = precioUnitario * cantidad;
      const ahorro          = totalNormal - totalConOferta;
      const pct             = Math.round((ahorro / totalNormal) * 100);
      if (ahorro > mejorAhorro) {
        mejorAhorro = ahorro;
        mejor = { oferta: o, totalConOferta, ahorro, pct, veces };
      }
    }
  }
  return mejor;
}

/**
 * Retorna la siguiente oferta más cercana que el cliente
 * podría activar, y cuántos números le faltan.
 */
function siguienteOferta(cantidad, ofertas, precioUnitario) {
  if (!ofertas || ofertas.length === 0) return null;
  let menor = null;
  let menorFaltan = Infinity;
  for (const o of ofertas) {
    // próximo múltiplo de o.cantidad > cantidad
    const siguiente = Math.ceil((cantidad + 1) / o.cantidad) * o.cantidad;
    const faltan    = siguiente - cantidad;
    const totalNormal = precioUnitario * siguiente;
    const ahorro      = totalNormal - o.precio_total * (siguiente / o.cantidad);
    if (faltan < menorFaltan && ahorro > 0) {
      menorFaltan = faltan;
      menor = { oferta: o, faltan, siguiente };
    }
  }
  return menor;
}

/* ─────────────────────────────────────────────────────────────
   FIX PUNTO 2B — fmtHora: extrae la hora del campo fecha_sorteo
   Si la fecha tiene hora distinta de 00:00, la muestra en
   formato 12h (ej: "09:00 PM"). Si es medianoche la omite.
───────────────────────────────────────────────────────────── */
const fmtHora = (f) => {
  const d = parseFecha(f);
  if (!d) return null;
  // Si la hora es exactamente las 00:00:00, probablemente no se cargó hora → omitir
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return null;
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Caracas',
  });
};

/* ─────────────────────────────────────────────────────────────
   FIX PUNTO 2B — buildWhatsAppLink actualizado
   Cambios respecto a la versión anterior:
     • Agrega 🎲 Lotería (rifa.loteria_ref) si está definida
     • Agrega 🕐 Hora del sorteo (extraída de fecha_sorteo)
       si el campo tiene hora registrada
   NOTA adjunto de imagen:
     wa.me solo permite texto plano. Para enviar el ticket
     como imagen se necesita la WhatsApp Business Cloud API.
───────────────────────────────────────────────────────────── */
const buildWhatsAppLink = ({ numeros, rifa, nombre, telefono, reservaIds, totalReal }) => {
  const todos  = Array.isArray(numeros) ? numeros : [numeros];
  const numStr = todos.map(n => `*${n}*`).join(' · ');
  const id     = reservaIds?.[0]?.slice(0,8).toUpperCase() || '-------';
  const total  = totalReal ?? (rifa?.precio * todos.length);
  const hora   = fmtHora(rifa?.fecha_sorteo);

  const msg =
    `🎰 *RIFAS JORDYN* — Confirmación de reserva\n\n` +
    `Hola *${nombre}* 👋 tu${todos.length > 1 ? 's números quedaron bloqueados' : ' número quedó bloqueado'}:\n\n` +
    `🎟 Número${todos.length > 1 ? 's' : ''}: ${numStr}\n` +
    `🏆 Premio: ${rifa?.premio || ''}\n` +
    `🎪 Rifa: ${rifa?.nombre || ''}\n` +
    (rifa?.loteria_ref ? `🎲 Lotería: ${rifa.loteria_ref}\n` : '') +
    `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n` +
    (hora ? `🕐 Hora: ${hora}\n` : '') +
    `💰 Total pagado: ${fmt(total)}\n` +
    `🔖 ID Reserva: #${id}\n\n` +
    `⏳ _Pendiente de verificación. El admin revisará tu pago pronto._\n` +
    `🌐 rifasjordyn.com`;

  const num = telefono?.replace(/\D/g,'') || '';
  return num
    ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
};

/* ─── Inyectar estilos ─── */
const injectStyles = () => {
  if (document.getElementById('jd-pub-styles')) return;
  const s = document.createElement('style');
  s.id = 'jd-pub-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    html { scroll-behavior:smooth; }
    body { background:#f0fafa; font-family:'Poppins',sans-serif; color:${DARK}; }

    .pub-btn {
      display:inline-flex; align-items:center; gap:8px;
      background:linear-gradient(135deg,${TURQ},${TURQ2});
      color:#fff; border:none; border-radius:50px;
      padding:14px 32px; font-family:'Poppins',sans-serif;
      font-size:.95rem; font-weight:600; cursor:pointer;
      box-shadow:0 8px 24px ${TURQ}44; transition:transform .2s, box-shadow .2s;
    }
    .pub-btn:hover  { transform:translateY(-2px); box-shadow:0 12px 32px ${TURQ}66; }
    .pub-btn:active { transform:translateY(0); }
    .pub-btn:disabled { opacity:.65; cursor:not-allowed; transform:none; }

    .pub-btn-outline {
      display:inline-flex; align-items:center; gap:8px;
      background:transparent; color:${TURQ}; border:2px solid ${TURQ};
      border-radius:50px; padding:12px 28px; font-family:'Poppins',sans-serif;
      font-size:.9rem; font-weight:600; cursor:pointer; transition:all .2s;
    }
    .pub-btn-outline:hover { background:${TURQ}12; }

    .pub-btn-wa {
      display:inline-flex; align-items:center; gap:10px;
      background:linear-gradient(135deg,#25d366,#128c7e);
      color:#fff; border:none; border-radius:50px;
      padding:14px 28px; font-family:'Poppins',sans-serif;
      font-size:.95rem; font-weight:700; cursor:pointer;
      box-shadow:0 8px 24px rgba(37,211,102,.35); transition:transform .2s, box-shadow .2s;
    }
    .pub-btn-wa:hover  { transform:translateY(-2px); box-shadow:0 12px 32px rgba(37,211,102,.5); }
    .pub-btn-wa:active { transform:translateY(0); }

    .pub-input {
      width:100%; padding:14px 18px;
      border:2px solid #e0f0f0; border-radius:12px;
      font-family:'Poppins',sans-serif; font-size:.95rem;
      color:${DARK}; background:#fff; outline:none;
      transition:border-color .2s, box-shadow .2s;
    }
    .pub-input:focus { border-color:${TURQ}; box-shadow:0 0 0 4px ${TURQ}18; }

    .pub-label {
      display:block; font-size:.72rem; font-weight:600;
      letter-spacing:.1em; color:#7a9a9a; text-transform:uppercase;
      margin-bottom:6px; font-family:'Poppins',sans-serif;
    }

    /* ── Celda normal ── */
    .num-cell {
      width:100%; aspect-ratio:1;
      display:flex; align-items:center; justify-content:center;
      border-radius:8px; cursor:pointer;
      font-family:'Poppins',sans-serif; font-size:.72rem; font-weight:700;
      transition:transform .12s, box-shadow .12s, background .12s;
      border:2px solid transparent; user-select:none; position:relative;
    }
    .num-cell:hover { transform:scale(1.13); z-index:2; }
    .num-cell.disponible   { background:#fff; border-color:#d0ecec; color:${DARK}; }
    .num-cell.disponible:hover { border-color:${TURQ}; box-shadow:0 4px 16px ${TURQ}44; background:${TURQ}08; }
    .num-cell.vendido_1    { background:#fff8e0; border-color:#ffd166; color:#b8860b; cursor:not-allowed; }
    .num-cell.agotado      { background:#ffe8e8; border-color:#ffaaaa; color:#c0392b; cursor:not-allowed; }
    .num-cell.reservado    { background:#e8f4ff; border-color:#a0c8ff; color:#2874a6; cursor:not-allowed; }
    /* ── Celda seleccionada ── */
    .num-cell.seleccionado {
      background:linear-gradient(135deg,${TURQ},${TURQ2});
      border-color:${TURQ_DK}; color:#fff;
      transform:scale(1.18); box-shadow:0 6px 20px ${TURQ}66;
    }
    .num-cell.seleccionado::after {
      content:'✓';
      position:absolute; top:-5px; right:-5px;
      width:16px; height:16px; background:#fff; color:${TURQ_DK};
      border-radius:50%; font-size:.55rem; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.2);
    }

    .phone-row { display:flex; gap:8px; align-items:stretch; }
    .phone-select {
      flex-shrink:0; width:116px;
      border:2px solid #e0f0f0; border-radius:12px;
      font-family:'Poppins',sans-serif; font-size:.88rem;
      color:${DARK}; background:#fff; cursor:pointer; outline:none;
      padding:0 12px; transition:border-color .2s;
    }
    .phone-select:focus { border-color:${TURQ}; box-shadow:0 0 0 4px ${TURQ}18; }

    .pago-inline-card { border-radius:14px; padding:16px 18px; animation:fadeUp .22s ease; }
    .pago-campo-row {
      background:rgba(255,255,255,.75); border-radius:10px;
      padding:9px 13px; margin-bottom:7px; display:flex;
      align-items:center; justify-content:space-between; gap:8px;
    }
    .copy-pill {
      background:none; border:none; cursor:pointer; padding:3px 6px;
      border-radius:6px; font-size:.78rem; opacity:.55;
      transition:opacity .15s, background .15s;
    }
    .copy-pill:hover { opacity:1; background:rgba(0,0,0,.06); }

    /* ── Chip de número seleccionado ── */
    .num-chip {
      display:inline-flex; align-items:center; gap:5px;
      background:linear-gradient(135deg,${TURQ}18,${TURQ2}22);
      border:1.5px solid ${TURQ}44; border-radius:20px;
      padding:4px 10px 4px 12px;
      font-family:'Poppins',sans-serif; font-size:.82rem;
      font-weight:800; color:${TURQ_DK}; letter-spacing:.5px;
    }
    .num-chip-remove {
      background:none; border:none; cursor:pointer; color:${TURQ_DK};
      font-size:.8rem; padding:0; line-height:1; opacity:.7;
      transition:opacity .15s;
    }
    .num-chip-remove:hover { opacity:1; }

    /* ── Badge OFERTA ── */
    .badge-oferta {
      background:linear-gradient(135deg,${NARANJA},#ff8c42);
      color:#fff; border-radius:20px; padding:3px 10px;
      font-size:.55rem; font-weight:800; letter-spacing:1.5px;
      text-transform:uppercase; box-shadow:0 3px 10px ${NARANJA}55;
      animation:badgePop .4s ease;
    }

    /* ── Banner de oferta activa en carrito ── */
    .oferta-activa-bar {
      background:linear-gradient(135deg,#0d3320,#0a4a28);
      border:1.5px solid ${VERDE}55;
      border-radius:14px; padding:10px 16px;
      animation:fadeUp .2s ease;
    }

    /* ── Sugerencia de oferta próxima ── */
    .oferta-sugerencia {
      background:linear-gradient(135deg,#2a1a00,#3d2600);
      border:1.5px solid ${NARANJA}55;
      border-radius:14px; padding:10px 16px;
      animation:fadeUp .2s ease;
    }

    /* ── Pack card en banner ── */
    .pack-card {
      background:rgba(255,255,255,.07);
      border:1.5px solid rgba(255,255,255,.15);
      border-radius:14px; padding:14px 16px;
      display:flex; flex-direction:column; gap:4px;
      transition:transform .15s, background .15s;
      flex:1; min-width:120px; max-width:200px;
    }
    .pack-card:hover { background:rgba(255,255,255,.13); transform:translateY(-2px); }

    @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes pulse-ring {
      0%  {transform:scale(.95);box-shadow:0 0 0 0 ${TURQ}66}
      70% {transform:scale(1);  box-shadow:0 0 0 12px ${TURQ}00}
      100%{transform:scale(.95);box-shadow:0 0 0 0 ${TURQ}00}
    }
    @keyframes ofertaPulse {
      0%,100%{ box-shadow:0 0 0 0 ${VERDE}44 }
      50%    { box-shadow:0 0 0 6px ${VERDE}00 }
    }
    .shimmer {
      background:linear-gradient(90deg,#e8f0f0 25%,#f4fafa 50%,#e8f0f0 75%);
      background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:12px;
    }
    .nav-link { font-family:'Poppins',sans-serif; font-weight:500; color:${DARK}88; text-decoration:none; font-size:.9rem; transition:color .2s; cursor:pointer; }
    .nav-link:hover { color:${TURQ}; }

    @keyframes heroFloat {
      0%,100%{ transform:translateY(0); }
      50%    { transform:translateY(-10px); }
    }
    @keyframes glowPulse {
      0%,100%{ box-shadow:0 0 30px ${TURQ}55, 0 8px 32px rgba(0,0,0,.3); }
      50%    { box-shadow:0 0 50px ${TURQ}88, 0 8px 48px rgba(0,0,0,.4); }
    }
    @keyframes badgePop {
      0%  { transform:scale(0.8); opacity:0; }
      60% { transform:scale(1.08); }
      100%{ transform:scale(1); opacity:1; }
    }

    .count-unit {
      display:flex; flex-direction:column; align-items:center;
      background:rgba(255,255,255,.13);
      border:1.5px solid rgba(255,255,255,.22);
      border-radius:16px; padding:14px 8px 10px;
      min-width:68px; flex:1; max-width:90px;
      backdrop-filter:blur(12px);
      transition:transform .15s, background .15s;
    }
    .count-unit:hover { background:rgba(255,255,255,.2); transform:translateY(-2px); }
    .count-num {
      font-size:clamp(2rem,6vw,3.2rem); font-weight:900; color:#fff;
      line-height:1; font-variant-numeric:tabular-nums;
      text-shadow:0 2px 16px rgba(0,0,0,.35); letter-spacing:-1px;
    }
    .count-lbl {
      font-size:.48rem; font-weight:700; color:rgba(255,255,255,.6);
      letter-spacing:2.5px; text-transform:uppercase; margin-top:6px;
    }
    .count-sep {
      font-size:2rem; font-weight:900; color:rgba(255,255,255,.3);
      margin-top:14px; line-height:1; flex-shrink:0;
    }

    .hero-feat-card {
      position:relative; border-radius:28px; overflow:hidden;
      min-height:520px; display:flex; align-items:flex-end;
      box-shadow:0 32px 80px rgba(0,0,0,.25);
    }
    .hero-feat-img {
      position:absolute; inset:0;
      object-fit:cover; width:100%; height:100%;
      transition:transform .6s ease;
    }
    .hero-feat-card:hover .hero-feat-img { transform:scale(1.03); }
    .hero-feat-overlay {
      position:absolute; inset:0;
      background:linear-gradient(170deg,rgba(5,15,15,.08) 0%,rgba(5,15,15,.45) 40%,rgba(5,15,15,.93) 100%);
    }
    .hero-feat-content { position:relative; z-index:2; width:100%; padding:28px 32px 32px; }

    /* ── Barra flotante de selección ── */
    .carrito-bar {
      position:sticky; bottom:14px; z-index:50;
      animation:fadeUp .22s ease;
    }
  `;
  document.head.appendChild(s);
};

function useCountdown(targetDate) {
  const calc = () => {
    if (!targetDate) return { dias:0, horas:0, minutos:0, segundos:0, expired:true, invalid:true };

    const iso = String(targetDate).replace(' ', 'T');
    const target = new Date(iso);
    if (isNaN(target.getTime())) {
      return { dias:0, horas:0, minutos:0, segundos:0, expired:true, invalid:true };
    }
    const diff = target - new Date();
    if (diff <= 0) return { dias:0, horas:0, minutos:0, segundos:0, expired:true, invalid:false };
    return {
      dias:     Math.floor(diff / 86400000),
      horas:    Math.floor((diff % 86400000) / 3600000),
      minutos:  Math.floor((diff % 3600000)  / 60000),
      segundos: Math.floor((diff % 60000)    / 1000),
      expired:  false,
      invalid:  false,
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    if (!targetDate) return;
    setTime(calc());
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return time;
}

/* ═══════════════════════════════════════════════════════════
   BANNER DE OFERTAS — encima del grid
═══════════════════════════════════════════════════════════ */
function BannerOfertas({ ofertas, precioUnitario }) {
  if (!ofertas || ofertas.length === 0) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg,#0d2e1a,#0a3d22)',
      border: `1.5px solid ${VERDE}44`,
      borderRadius: 18, padding: '18px 22px',
      marginBottom: 20, animation: 'fadeUp .3s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontSize:'1.3rem' }}>🎁</span>
        <div>
          <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.5)', letterSpacing:'2px', textTransform:'uppercase', fontWeight:700 }}>Ofertas especiales</div>
          <div style={{ fontSize:'.95rem', color:'#fff', fontWeight:700, lineHeight:1.2 }}>¡Compra más y ahorra más!</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {ofertas.map((o, i) => {
          const totalNormal = precioUnitario * o.cantidad;
          const ahorro      = totalNormal - o.precio_total;
          const pct         = Math.round((ahorro / totalNormal) * 100);
          return (
            <div key={i} className="pack-card">
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span style={{ fontSize:'1.1rem' }}>🏷️</span>
                <span style={{ fontSize:'.82rem', color:'rgba(255,255,255,.9)', fontWeight:700 }}>
                  {o.etiqueta || `Pack x${o.cantidad}`}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:7, flexWrap:'wrap' }}>
                <span style={{ fontSize:'1.1rem', color:VERDE, fontWeight:900 }}>{fmt(o.precio_total)}</span>
                <span style={{ fontSize:'.72rem', color:'rgba(255,255,255,.4)', textDecoration:'line-through', fontWeight:600 }}>{fmt(totalNormal)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <span style={{ fontSize:'.62rem', color:'rgba(255,255,255,.5)' }}>{o.cantidad} números</span>
                <span style={{
                  background:`linear-gradient(135deg,${NARANJA},#ff8c42)`,
                  color:'#fff', borderRadius:20, padding:'1px 7px',
                  fontSize:'.55rem', fontWeight:800,
                }}>-{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO DE LA RIFA PRINCIPAL
   FIX PUNTO 1B: condición !cd.invalid agregada al render del countdown
═══════════════════════════════════════════════════════════ */
function HeroRifaPrincipal({ rifa, onVerNumeros }) {
  const cd = useCountdown(rifa.fecha_sorteo);
  const [imgError, setImgError] = useState(false);
  const tieneImagen = rifa.imagen_url && !imgError;
  const tieneOfertas = rifa.ofertas && rifa.ofertas.length > 0;

  const unidades = [
    { val: String(cd.dias).padStart(2,'0'),     lbl: 'Días'  },
    { val: String(cd.horas).padStart(2,'0'),    lbl: 'Horas' },
    { val: String(cd.minutos).padStart(2,'0'),  lbl: 'Min'   },
    { val: String(cd.segundos).padStart(2,'0'), lbl: 'Seg'   },
  ];

  return (
    <div style={{ borderRadius:28, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,.18)', display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:520, background:DARK }} className="hero-feat-card">
      <div style={{ position:'relative', overflow:'hidden', minHeight:340 }}>
        {tieneImagen ? (
          <img src={rifa.imagen_url} alt={rifa.premio} onError={() => setImgError(true)}
            style={{ width:'100%', height:'100%', objectFit:'contain', objectPosition:'center', display:'block', background:'#0d1e1e' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,${TURQ_DK}44,${DARK})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:'8rem', opacity:.2, animation:'heroFloat 4s ease-in-out infinite' }}>🎰</div>
          </div>
        )}
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(to right, transparent 70%, ${DARK} 100%)`, pointerEvents:'none' }}></div>
      </div>

      <div style={{ background:`linear-gradient(160deg,#0d2424 0%,${DARK} 100%)`, padding:'36px 32px 32px', display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:220, height:220, borderRadius:'50%', background:`${TURQ}0a`, pointerEvents:'none' }}></div>
        <div style={{ position:'absolute', bottom:-40, left:-40, width:160, height:160, borderRadius:'50%', background:`${TURQ}07`, pointerEvents:'none' }}></div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18, position:'relative' }}>
          <span style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, color:'#fff', borderRadius:50, padding:'5px 14px', fontSize:'.58rem', fontWeight:800, letterSpacing:'2px', textTransform:'uppercase', boxShadow:`0 4px 16px ${TURQ}55`, animation:'badgePop .5s ease' }}>⭐ Rifa Principal</span>
          {tieneOfertas && (
            <span style={{ background:`linear-gradient(135deg,${NARANJA},#ff8c42)`, color:'#fff', borderRadius:50, padding:'5px 14px', fontSize:'.58rem', fontWeight:800, letterSpacing:'1.5px', textTransform:'uppercase', boxShadow:`0 4px 16px ${NARANJA}55`, animation:'badgePop .6s ease' }}>🎁 OFERTA</span>
          )}
          {rifa.loteria_ref && (
            <span style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', color:'rgba(255,255,255,.85)', borderRadius:50, padding:'5px 12px', fontSize:'.58rem', fontWeight:600, backdropFilter:'blur(8px)' }}>🎲 {rifa.loteria_ref}</span>
          )}
        </div>

        <h2 style={{ fontSize:'clamp(1.4rem,3vw,2.2rem)', color:'#fff', fontWeight:900, lineHeight:1.15, marginBottom:6, textShadow:'0 2px 16px rgba(0,0,0,.5)', position:'relative' }}>{rifa.nombre}</h2>
        <p style={{ fontSize:'.9rem', color:'rgba(255,255,255,.65)', marginBottom:24, fontWeight:500, position:'relative' }}>🏆 {rifa.premio}</p>

        {/* Resumen de packs si hay ofertas */}
        {tieneOfertas && (
          <div style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:'10px 14px', marginBottom:18, position:'relative' }}>
            <div style={{ fontSize:'.55rem', color:'rgba(255,255,255,.45)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:8 }}>🎁 Packs disponibles</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {rifa.ofertas.map((o, i) => {
                const totalNormal = rifa.precio * o.cantidad;
                const pct = Math.round(((totalNormal - o.precio_total) / totalNormal) * 100);
                return (
                  <div key={i} style={{ background:'rgba(255,255,255,.08)', borderRadius:8, padding:'5px 10px', display:'flex', flexDirection:'column', gap:1 }}>
                    <span style={{ fontSize:'.62rem', color:'rgba(255,255,255,.7)', fontWeight:700 }}>{o.etiqueta || `x${o.cantidad}`}</span>
                    <span style={{ fontSize:'.7rem', color:VERDE, fontWeight:900 }}>{fmt(o.precio_total)}</span>
                    <span style={{ fontSize:'.52rem', color:`${NARANJA}`, fontWeight:700 }}>ahorra {pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/*
          FIX PUNTO 1B: se agrega !cd.invalid a la condición.
          Antes: {rifa.fecha_sorteo && !cd.expired && (...)}
          Si fecha_sorteo llegaba con formato "YYYY-MM-DD HH:MM:SS", new Date()
          devolvía NaN → cd.expired era false pero los valores eran NaN → no renderizaba.
          Ahora: si la fecha es inválida, invalid=true y no se muestra el bloque.
        */}
        {rifa.fecha_sorteo && !cd.expired && !cd.invalid && (
          <div style={{ marginBottom:24, position:'relative' }}>
            <div style={{ fontSize:'.55rem', color:'rgba(255,255,255,.45)', letterSpacing:'2.5px', textTransform:'uppercase', fontWeight:700, marginBottom:10 }}>⏳ Tiempo para el sorteo</div>
            <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
              {unidades.map((u, i) => (
                <React.Fragment key={u.lbl}>
                  <div className="count-unit"><span className="count-num">{u.val}</span><span className="count-lbl">{u.lbl}</span></div>
                  {i < 3 && <span className="count-sep">:</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12, position:'relative' }}>
          <div>
            <div style={{ fontSize:'.52rem', color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, marginBottom:2 }}>Por número</div>
            <div style={{ fontSize:'2rem', color:'#fff', fontWeight:900, lineHeight:1, textShadow:`0 0 24px ${TURQ}99` }}>{fmt(rifa.precio)}</div>
          </div>
          <button className="pub-btn" onClick={() => onVerNumeros(rifa)} style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, padding:'15px 28px', borderRadius:50, fontSize:'.95rem', fontWeight:700, width:'100%', justifyContent:'center', animation:'glowPulse 2.5s ease-in-out infinite' }}>
            🎟 Ver números disponibles
          </button>
        </div>
      </div>
      <style>{`@media (max-width: 640px) { .hero-feat-card { grid-template-columns:1fr !important; } .hero-feat-card > div:first-child { min-height:260px !important; } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD DE DATOS DE PAGO
═══════════════════════════════════════════════════════════ */
function PagoInlineCard({ metodo }) {
  const [copiado, setCopiado] = useState('');
  const info = METODOS_PAGO[metodo];
  if (!info) return null;
  const copiar = async (val, key) => {
    try { await navigator.clipboard.writeText(val); setCopiado(key); setTimeout(() => setCopiado(''), 2000); } catch {}
  };
  return (
    <div className="pago-inline-card" style={{ background: info.bg, border: `2px solid ${info.border}`, marginTop: 12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <span style={{ fontSize:'1.6rem' }}>{info.icono}</span>
        <div>
          <div style={{ fontSize:'.88rem', fontWeight:700, color: info.colorHex }}>{metodo}</div>
          <div style={{ fontSize:'.65rem', color:`${DARK}66` }}>{info.pais}</div>
        </div>
      </div>
      {info.campos.map(({ label, valor }) => (
        <div key={label} className="pago-campo-row">
          <div>
            <div style={{ fontSize:'.6rem', fontWeight:700, color:`${info.colorHex}99`, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:'.9rem', fontWeight:700, color: DARK }}>{valor}</div>
          </div>
          <button className="copy-pill" onClick={() => copiar(valor, label)} title="Copiar">{copiado === label ? '✅' : '📋'}</button>
        </div>
      ))}
      {info.nota && <div style={{ fontSize:'.72rem', fontWeight:600, color: info.colorHex, textAlign:'center', marginTop:6, padding:'6px 10px', background:'rgba(255,255,255,.5)', borderRadius:8 }}>{info.nota}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BLOQUE DE OFERTA APLICADA (reutilizable en modal y carrito)
═══════════════════════════════════════════════════════════ */
function BloqueOfertaAplicada({ ofertaInfo, cantidad, precioUnitario, compact = false }) {
  if (!ofertaInfo) return null;
  const { oferta, totalConOferta, ahorro, pct } = ofertaInfo;
  const totalNormal = precioUnitario * cantidad;

  if (compact) {
    return (
      <div className="oferta-activa-bar" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'1.1rem' }}>🎁</span>
          <div>
            <div style={{ fontSize:'.6rem', color:`${VERDE}bb`, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>
              {oferta.etiqueta || `Pack x${oferta.cantidad}`} activado
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'.95rem', color:VERDE, fontWeight:900 }}>{fmt(totalConOferta)}</span>
              <span style={{ fontSize:'.72rem', color:'rgba(255,255,255,.35)', textDecoration:'line-through' }}>{fmt(totalNormal)}</span>
              <span style={{ background:NARANJA, color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:'.55rem', fontWeight:800 }}>-{pct}%</span>
            </div>
          </div>
        </div>
        <div style={{ background:`${VERDE}22`, border:`1px solid ${VERDE}44`, borderRadius:10, padding:'5px 12px', textAlign:'center' }}>
          <div style={{ fontSize:'.52rem', color:`${VERDE}99`, fontWeight:700, textTransform:'uppercase' }}>ahorras</div>
          <div style={{ fontSize:'.95rem', color:VERDE, fontWeight:900 }}>{fmt(ahorro)}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background:'linear-gradient(135deg,#0a3320,#0d4228)',
      border:`2px solid ${VERDE}55`,
      borderRadius:16, padding:'16px 20px',
      marginBottom:16, animation:'ofertaPulse 2s infinite',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:'1.4rem' }}>🎉</span>
        <div>
          <div style={{ fontSize:'.6rem', color:`${VERDE}bb`, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px' }}>
            ¡Oferta aplicada!
          </div>
          <div style={{ fontSize:'1rem', color:'#fff', fontWeight:800 }}>
            {oferta.etiqueta || `Pack x${oferta.cantidad}`}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.5)', marginBottom:3 }}>Precio con oferta</div>
          <div style={{ fontSize:'1.8rem', color:VERDE, fontWeight:900, lineHeight:1 }}>{fmt(totalConOferta)}</div>
          <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.35)', textDecoration:'line-through', marginTop:2 }}>
            Normal: {fmt(totalNormal)}
          </div>
        </div>
        <div style={{ background:`${VERDE}22`, border:`1.5px solid ${VERDE}44`, borderRadius:14, padding:'10px 16px', textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:'.52rem', color:`${VERDE}88`, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>Ahorras</div>
          <div style={{ fontSize:'1.5rem', color:VERDE, fontWeight:900 }}>{fmt(ahorro)}</div>
          <div style={{ background:NARANJA, color:'#fff', borderRadius:20, padding:'2px 9px', fontSize:'.6rem', fontWeight:800, marginTop:4, display:'inline-block' }}>-{pct}%</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL DE RESERVA — con soporte de ofertas
═══════════════════════════════════════════════════════════ */
function ModalReserva({ rifa, numeros, onClose, onSuccess }) {
  const [step,       setStep]     = useState(1);
  const [form,       setForm]     = useState({ nombre:'', cedula:'', correo:'', codPais:'+58', telefono:'', metodo_pago:'' });
  const [imagen,     setImagen]   = useState(null);
  const [imgB64,     setImgB64]   = useState('');
  const [imgNombre,  setImgN]     = useState('');
  const [error,      setError]    = useState('');
  const [sending,    setSending]  = useState(false);
  const [reservaIds, setReservaIds] = useState([]);
  const [conflictos, setConflictos] = useState([]);
  const fileRef = useRef();

  /* ── Tasas desde /api/tasas/hoy ── */
const tasasHoy = useTasasHoy();
const copUsd   = tasasHoy?.copUsd ?? 4200;
const tasaBs   = tasasHoy?.bsdUsd ?? 0;

  const upd          = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const telefonoFull = form.codPais + form.telefono.replace(/\D/g,'');

  // Calcular oferta aplicada
  const ofertas    = rifa.ofertas || [];
  const ofertaInfo = calcularOferta(numeros.length, ofertas, rifa.precio);
  const totalReal  = ofertaInfo ? ofertaInfo.totalConOferta : rifa.precio * numeros.length;
  const totalNormal = rifa.precio * numeros.length;

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError('La imagen debe ser menor a 8 MB'); return; }
    setError('');
    setImagen(URL.createObjectURL(f));
    setImgN(f.name);
    const reader = new FileReader();
    reader.onload = ev => setImgB64(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleEnviar = async () => {
    if (!form.nombre.trim()) { setError('Ingresa tu nombre completo'); return; }
    if (!form.cedula.trim()) { setError('La cédula es obligatoria'); return; }
    if (!imgB64)             { setError('El comprobante de pago es obligatorio'); return; }
    // Validar correo solo si fue ingresado
    if (form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) {
      setError('El correo electrónico no tiene un formato válido'); return;
    }
    setError(''); setSending(true);
    try {
      const r = await API.post('/publico/reservar', {
        rifa_id:            rifa.id,
        numeros,
        nombre_cliente:     form.nombre.trim(),
        cedula:             form.cedula.trim(),
        correo:             form.correo.trim() || undefined,
        telefono:           telefonoFull,
        metodo_pago:        form.metodo_pago,
        comprobante_base64: imgB64,
        comprobante_nombre: imgNombre,
      });
      const ids = (r.data.reservas || [r.data.reserva]).map(rv => rv?.id).filter(Boolean);
      setReservaIds(ids);
      setConflictos(r.data.conflictos || []);
      setStep(2);
      onSuccess?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al enviar la reserva, intenta de nuevo');
    } finally { setSending(false); }
  };

  const abrirWA = () => {
    const url = buildWhatsAppLink({ numeros, rifa, nombre: form.nombre, telefono: telefonoFull, reservaIds, totalReal });
    window.open(url, '_blank');
  };

  const compartirNativo = async () => {
    const texto =
      `🎰 RIFAS JORDYN\n🎟 Número${numeros.length>1?'s':''}: ${numeros.join(' · ')}\n🏆 Premio: ${rifa?.premio}\n` +
      `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n👤 ${form.nombre}\n` +
      `💰 Total: ${fmt(totalReal)}${ofertaInfo ? ` (ahorraste ${fmt(ofertaInfo.ahorro)})` : ''}\n` +
      `🔖 Reserva: #${reservaIds[0]?.slice(0,8).toUpperCase()}\n✅ Número${numeros.length>1?'s bloqueados':'bloqueado'} pendiente${numeros.length>1?'s':''} de confirmación.`;
    if (navigator.share) {
      try { await navigator.share({ title:'Tu boleto — Rifas Jordyn', text: texto }); } catch {}
    } else {
      await navigator.clipboard.writeText(texto);
      alert('Texto copiado al portapapeles 📋');
    }
  };

  /* ── Calcular precio en moneda del método ── */
  const convTotal    = calcularPrecioMetodo(totalReal,   form.metodo_pago, tasaBs, copUsd);
  const convUnitario = calcularPrecioMetodo(rifa.precio, form.metodo_pago, tasaBs, copUsd);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(10,30,30,.65)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:24, width:'100%', maxWidth:520, maxHeight:'93vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,60,60,.3)', animation:'fadeUp .3s ease' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:'24px 24px 0 0', padding:'22px 26px 18px', position:'relative' }}>
          <button onClick={onClose} style={{ position:'absolute', top:14, right:18, background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          <div style={{ fontSize:'.58rem', color:'rgba(255,255,255,.75)', letterSpacing:'0.5px', marginBottom:4 }}>
            {numeros.length > 1 ? `COMPRAR ${numeros.length} NÚMEROS` : 'COMPRAR NÚMERO'}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
            {numeros.map(n => (
              <span key={n} style={{ background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.4)', color:'#fff', borderRadius:20, padding:'3px 12px', fontFamily:"'Poppins',sans-serif", fontSize:'1rem', fontWeight:900, letterSpacing:2 }}>{n}</span>
            ))}
          </div>
          <div style={{ fontSize:'.85rem', color:'rgba(255,255,255,.8)' }}>
            {rifa.nombre} · {numeros.length > 1
              ? ofertaInfo
                ? <><s style={{ opacity:.6 }}>{fmt(totalNormal)}</s> <strong style={{ color:'#b3ffd4' }}>{fmt(totalReal)}</strong></>
                : `${fmt(rifa.precio)} c/u · Total: ${fmt(totalReal)}`
              : fmt(rifa.precio)
            }
          </div>
          <div style={{ display:'flex', gap:6, marginTop:14 }}>
            {[1,2].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:2, background: s <= step ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.25)', transition:'background .3s' }}></div>)}
          </div>
        </div>

        <div style={{ padding:'22px 26px 28px' }}>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={{ animation:'fadeUp .25s ease' }}>

              {/* Bloque de oferta aplicada */}
              {ofertaInfo && (
                <BloqueOfertaAplicada
                  ofertaInfo={ofertaInfo}
                  cantidad={numeros.length}
                  precioUnitario={rifa.precio}
                />
              )}

              {/* Resumen de números */}
              <div style={{ background:`linear-gradient(135deg,${TURQ}12,${TURQ2}18)`, border:`1.5px solid ${TURQ}33`, borderRadius:14, padding:'12px 16px', marginBottom:20 }}>
                <div style={{ fontSize:'.62rem', color:TURQ_DK, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
                  🎟 {numeros.length > 1 ? `Tus ${numeros.length} números` : 'Número seleccionado'}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: numeros.length > 1 ? 10 : 0 }}>
                  {numeros.map(n => (
                    <span key={n} style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, color:'#fff', borderRadius:10, padding:'5px 12px', fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:'1.1rem', letterSpacing:2 }}>{n}</span>
                  ))}
                </div>
                {numeros.length > 1 && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:8, borderTop:`1px solid ${TURQ}22` }}>
                    <span style={{ fontSize:'.7rem', color:`${DARK}66` }}>{fmt(rifa.precio)} × {numeros.length} números</span>
                    <div style={{ textAlign:'right' }}>
                      {ofertaInfo && (
                        <div style={{ fontSize:'.7rem', color:`${DARK}55`, textDecoration:'line-through' }}>{fmt(totalNormal)}</div>
                      )}
                      <span style={{ fontSize:'1.2rem', color: ofertaInfo ? VERDE : TURQ_DK, fontWeight:900 }}>= {fmt(totalReal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ① Datos */}
              <div style={{ fontSize:'.78rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>① Tus datos</div>
              <div style={{ marginBottom:14 }}>
                <label className="pub-label">Nombre completo *</label>
                <input className="pub-input" value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="¿Cómo te llamas?" autoFocus />
              </div>

              {/* NUEVO: Cédula (obligatoria) + Correo (opcional) en la misma fila */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label className="pub-label">
                    Cédula  *
                    <span style={{ marginLeft:5, background:'#ff6b6b', color:'#fff', fontSize:'.48rem', padding:'1px 5px', borderRadius:3, fontWeight:700, verticalAlign:'middle' }}>OBLIGATORIO</span>
                  </label>
                  <input
                    className="pub-input"
                    value={form.cedula}
                    onChange={e => upd('cedula', e.target.value.replace(/\D/g,'').slice(0,15))}
                    placeholder="Ej: 12345678"
                    type="tel"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="pub-label">Correo electrónico <span style={{ fontSize:'.6rem', color:'#aaa', fontWeight:500, textTransform:'none' }}>(opcional)</span></label>
                  <input
                    className="pub-input"
                    value={form.correo}
                    onChange={e => upd('correo', e.target.value.trim())}
                    placeholder="tucorreo@email.com"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                  />
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label className="pub-label">WhatsApp / Teléfono</label>
                <div className="phone-row">
                  <select className="phone-select" value={form.codPais} onChange={e => upd('codPais', e.target.value)}>
                    {PAISES.map(p => <option key={p.code} value={p.code}>{p.flag} {p.code}</option>)}
                  </select>
                  <input className="pub-input" style={{ borderRadius:12 }} value={form.telefono}
                    onChange={e => upd('telefono', e.target.value.replace(/\D/g,'').slice(0,12))}
                    placeholder="Número sin código" type="tel" />
                </div>
                {form.telefono && (
                  <div style={{ fontSize:'.7rem', color:TURQ_DK, marginTop:5, fontWeight:600 }}>📱 Número completo: <strong>{telefonoFull}</strong></div>
                )}
              </div>

              {/* ② Método de pago */}
              <div style={{ fontSize:'.78rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>② Método de pago</div>
              <div>
                <label className="pub-label">¿Cómo vas a pagar?</label>
                <select className="pub-input" value={form.metodo_pago} onChange={e => upd('metodo_pago', e.target.value)} style={{ cursor:'pointer' }}>
                  <option value="">Selecciona un método...</option>
                  {Object.keys(METODOS_PAGO).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Banner precio en moneda local */}
              {form.metodo_pago && (() => {
                const info = METODOS_PAGO[form.metodo_pago];
                if (!convTotal) return (
                  <div style={{ marginTop:12, borderRadius:14, padding:'14px 18px', background:`linear-gradient(135deg,${info.bg},${info.bg})`, border:`2px solid ${info.border}`, animation:'fadeUp .2s ease' }}>
                    <div style={{ fontSize:'.6rem', fontWeight:700, color:`${info.colorHex}99`, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>{info.icono} Valor a pagar</div>
                    <div style={{ fontSize:'1.6rem', fontWeight:900, color: ofertaInfo ? VERDE : info.colorHex, lineHeight:1 }}>{fmt(totalReal)}</div>
                    {ofertaInfo && <div style={{ fontSize:'.65rem', color:'#22c55e', fontWeight:700, marginTop:3 }}>🎁 Ahorraste {fmt(ofertaInfo.ahorro)}</div>}
                    {numeros.length > 1 && !ofertaInfo && <div style={{ fontSize:'.65rem', color:`${DARK}55`, marginTop:3 }}>{fmt(rifa.precio)} × {numeros.length} números · Pesos colombianos</div>}
                  </div>
                );
                const isVes = convTotal?.moneda === 'VES';
                return (
                  <div style={{ marginTop:12, borderRadius:14, padding:'14px 18px', background: isVes ? 'linear-gradient(135deg,#f0fff8,#e8fdf5)' : 'linear-gradient(135deg,#f0f4ff,#e8eeff)', border:`2px solid ${isVes ? TURQ+'55' : '#c5d3ff'}`, animation:'fadeUp .2s ease' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:'.58rem', fontWeight:700, color: isVes ? TURQ_DK : '#4a5bbf', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>
                          {convTotal.icono} Debes pagar exactamente
                        </div>
                        <div style={{ fontSize:'1.9rem', fontWeight:900, color: isVes ? TURQ_DK : '#3a4abf', lineHeight:1, letterSpacing:'-0.5px' }}>
                          {convTotal.texto}
                        </div>
                        {ofertaInfo && (
                          <div style={{ fontSize:'.65rem', color:VERDE, fontWeight:700, marginTop:3 }}>
                            🎁 Precio con oferta ({fmt(totalReal)} COP)
                          </div>
                        )}
                        {!ofertaInfo && numeros.length > 1 && (
                          <div style={{ fontSize:'.65rem', color:`${DARK}55`, marginTop:3 }}>
                            {convUnitario?.texto} × {numeros.length} números
                          </div>
                        )}
                      </div>
                      <div style={{ background: isVes ? `${TURQ}18` : 'rgba(74,91,191,.1)', border:`1px solid ${isVes ? TURQ+'33' : 'rgba(74,91,191,.2)'}`, borderRadius:10, padding:'6px 10px', textAlign:'center' }}>
                        <div style={{ fontSize:'1.4rem' }}>{convTotal.icono}</div>
                        <div style={{ fontSize:'.5rem', fontWeight:700, color:`${DARK}55`, marginTop:2 }}>{convTotal.moneda}</div>
                      </div>
                    </div>
                    <div style={{ background:'rgba(255,255,255,.65)', borderRadius:8, padding:'7px 12px', fontSize:'.7rem', color:`${DARK}66`, display:'flex', alignItems:'center', gap:6 }}>
                      <span>≈ {fmt(totalReal)} · </span>
                      <span style={{ fontWeight:600 }}>
                        {convTotal.moneda === 'VES'
                          ? `1 USD = Bs. ${tasaBs ? new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(tasaBs) : '…'}`
                          : `1 USD = COP ${copUsd.toLocaleString('es-CO')}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {form.metodo_pago && <PagoInlineCard metodo={form.metodo_pago} />}
              <div style={{ height:20 }}></div>

              {/* ③ Comprobante */}
              <div style={{ fontSize:'.78rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                ③ Comprobante de pago
                <span style={{ background:'#ff6b6b', color:'#fff', fontSize:'.52rem', padding:'2px 7px', borderRadius:4, fontWeight:700 }}>OBLIGATORIO</span>
              </div>
              <div style={{ fontSize:'.82rem', color:`${DARK}66`, marginBottom:12, lineHeight:1.5 }}>
                Realiza el pago de <strong style={{ color: ofertaInfo ? VERDE : TURQ_DK }}>{fmt(totalReal)}</strong> y sube la captura.
                {ofertaInfo && <span style={{ color:VERDE, fontWeight:700 }}> (precio con oferta)</span>}
                {numeros.length > 1 && !ofertaInfo && <strong style={{ color:TURQ_DK }}> Un solo comprobante para todos los números.</strong>}
              </div>

              <div onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${imgB64 ? TURQ : error ? '#ff6b6b' : '#c0dede'}`, borderRadius:16, padding:'18px 14px', textAlign:'center', cursor:'pointer', background: imgB64 ? `${TURQ}08` : error ? '#fff5f5' : '#f8fdfd', transition:'all .2s', minHeight:100, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
                {imagen ? (
                  <div style={{ width:'100%' }}>
                    <img src={imagen} alt="Comprobante" style={{ maxWidth:'100%', maxHeight:180, objectFit:'contain', borderRadius:10, display:'block', margin:'0 auto 8px' }} />
                    <div style={{ fontSize:'.72rem', color:TURQ, fontWeight:600 }}>✓ {imgNombre}</div>
                    <div style={{ fontSize:'.65rem', color:`${DARK}55`, marginTop:2 }}>Toca para cambiar</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:'2rem', marginBottom:6, opacity:.6 }}>📸</div>
                    <div style={{ fontSize:'.88rem', color:`${DARK}77`, fontWeight:600 }}>Toca aquí para subir el comprobante</div>
                    <div style={{ fontSize:'.7rem', color:'#aaa', marginTop:4 }}>JPG · PNG · WEBP · máx 8 MB</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleFile} style={{ display:'none' }} />
              </div>

              {error && (
                <div style={{ background:'#fff0f0', border:'1px solid #ffcccc', borderRadius:8, padding:'8px 12px', marginTop:10, fontSize:'.78rem', color:'#c0392b', fontWeight:500 }}>⚠️ {error}</div>
              )}

              <div style={{ marginTop:16 }}>
                <button className="pub-btn" onClick={handleEnviar} disabled={sending}
                  style={{ width:'100%', justifyContent:'center', fontSize:'1rem', padding:'16px', borderRadius:14 }}>
                  {sending
                    ? <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⏳</span> Enviando...</>
                    : numeros.length > 1
                      ? `🎟 Confirmar ${numeros.length} números · ${fmt(totalReal)}`
                      : '🎟 Confirmar reserva y bloquear número'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Confirmado ── */}
          {/* FIX PUNTO 5 — Pantalla de éxito con mensaje exacto solicitado */}
          {step === 2 && (
            <div style={{ textAlign:'center', animation:'fadeUp .25s ease', padding:'8px 0' }}>

              {/* Ícono de éxito */}
              <div style={{ width:88, height:88, borderRadius:'50%', background:`linear-gradient(135deg,${TURQ},${TURQ2})`, margin:'0 auto 22px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.6rem', animation:'pulse-ring 2s infinite', boxShadow:`0 0 0 0 ${TURQ}66` }}>
                ✅
              </div>

              {/* Título */}
              <div style={{ fontSize:'1.5rem', color:DARK, marginBottom:18, fontWeight:900, lineHeight:1.3 }}>
                ¡Compra realizada con éxito!
              </div>

              {/* ── MENSAJE EXACTO SOLICITADO ── */}
              <div style={{
                background:`linear-gradient(135deg,${TURQ}0d,${TURQ2}12)`,
                border:`2px solid ${TURQ}33`,
                borderRadius:18, padding:'22px 24px',
                marginBottom:22, textAlign:'left',
              }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.6rem', flexShrink:0, marginTop:2 }}>🎟</span>
                  <p style={{
                    fontSize:'1rem', color:DARK, lineHeight:1.75,
                    fontWeight:500, margin:0,
                    fontFamily:"'Poppins',sans-serif",
                  }}>
                    Su compra fue realizada con éxito.{' '}
                    <strong style={{ color:TURQ_DK }}>Atento a la aprobación de su número ganador.</strong>{' '}
                    Su ticket le llegará vía WhatsApp durante las próximas horas.{' '}
                    <strong style={{ color:TURQ_DK }}>¡Muchas gracias!</strong>
                  </p>
                </div>
              </div>

              {/* Números reservados (resumen visual) */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:20 }}>
                {numeros.filter(n => !conflictos.map(c=>c.numero).includes(n)).map(n => (
                  <span key={n} style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, color:'#fff', borderRadius:12, padding:'7px 18px', fontWeight:900, fontSize:'1.2rem', letterSpacing:3, boxShadow:`0 4px 16px ${TURQ}44` }}>{n}</span>
                ))}
              </div>

              {/* Bloque de ahorro en paso de confirmación */}
              {ofertaInfo && (
                <div style={{ background:'linear-gradient(135deg,#0a3a1e,#0d4a25)', border:`2px solid ${VERDE}55`, borderRadius:16, padding:'16px 20px', marginBottom:16, textAlign:'left' }}>
                  <div style={{ fontSize:'.6rem', color:`${VERDE}aa`, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', marginBottom:8 }}>🎁 Oferta aplicada</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'1.5rem', color:VERDE, fontWeight:900 }}>{fmt(ofertaInfo.totalConOferta)}</div>
                      <div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.4)', textDecoration:'line-through' }}>{fmt(totalNormal)}</div>
                    </div>
                    <div style={{ background:`${VERDE}22`, border:`1px solid ${VERDE}44`, borderRadius:12, padding:'8px 14px', textAlign:'center' }}>
                      <div style={{ fontSize:'.52rem', color:`${VERDE}88`, fontWeight:700 }}>AHORRASTE</div>
                      <div style={{ fontSize:'1.2rem', color:VERDE, fontWeight:900 }}>{fmt(ofertaInfo.ahorro)}</div>
                      <div style={{ background:NARANJA, color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:'.55rem', fontWeight:800, marginTop:2 }}>-{ofertaInfo.pct}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Aviso de conflictos parciales */}
              {conflictos.length > 0 && (
                <div style={{ background:'#fff8e8', border:'1.5px solid #ffd166', borderRadius:12, padding:'10px 14px', marginBottom:16, textAlign:'left', fontSize:'.78rem', color:'#7a5c00' }}>
                  ⚠️ Los siguientes números no pudieron reservarse porque ya estaban ocupados: <strong>{conflictos.map(c=>c.numero).join(', ')}</strong>
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {/* WhatsApp — opcional, por si el cliente quiere guardar su comprobante */}
                <button className="pub-btn-wa" onClick={abrirWA} style={{ width:'100%', justifyContent:'center', padding:'15px', borderRadius:14 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Guardar comprobante por WhatsApp
                </button>
                <button className="pub-btn-outline" onClick={onClose} style={{ width:'100%', justifyContent:'center', borderRadius:14, padding:'14px' }}>
                  ¡Entendido! 🎉
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GRID DE NÚMEROS — con barra de carrito inteligente
═══════════════════════════════════════════════════════════ */
function GridNumeros({ rifa, onComprar }) {
  const [todos,       setTodos]      = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [busqueda,    setBusqueda]   = useState('');
  const [seleccion,   setSeleccion]  = useState(new Set());
  const [qpCant,    setQpCant]    = useState('');
  const [qpInputVal, setQpInputVal] = useState('');
  const [qpRolling,   setQpRolling]  = useState(false);
  const [qpResultado, setQpResultado]= useState([]);   // números que salieron en el último pick
  const [qpVisible,   setQpVisible]  = useState(0);    // cuántos se muestran ya (animación)

  const ofertas = rifa.ofertas || [];

  useEffect(() => {
    setLoading(true);
    setSeleccion(new Set());
    API.get(`/publico/rifas/${rifa.id}/numeros-disponibles`)
      .then(r => { setTodos(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rifa.id]);

  const disponibles = todos.filter(n => n.estado === 'disponible');
  const tomados     = todos.length - disponibles.length;
  const pct         = todos.length > 0 ? Math.round((tomados / todos.length) * 100) : 0;

  const visible = disponibles.filter(n => {
    if (!busqueda) return true;
    return n.numero.includes(busqueda.padStart(3,'0').slice(-3));
  });

  const toggleNumero = (n) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const limpiar = () => setSeleccion(new Set());

  /* ── Quick Pick: selección aleatoria con animación ── */
  const quickPick = (cantOverride) => {
    const cant = Math.min(parseInt(cantOverride ?? qpCant) || 1, disponibles.length);

    if (cant < 1 || qpRolling) return;

    // Fisher-Yates parcial
    const arr   = [...disponibles];
    const picks = [];
    for (let i = 0; i < cant; i++) {
      const j = Math.floor(Math.random() * (arr.length - i)) + i;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      picks.push(arr[i].numero);
    }

    // Fase 1: animación "rolling" (300ms)
    setQpRolling(true);
    setQpResultado([]);
    setQpVisible(0);

    setTimeout(() => {
      // Fase 2: mostrar números uno a uno
      setQpRolling(false);
      setQpResultado(picks);
      setSeleccion(new Set(picks));

      // Revelar de a uno cada 120ms
      picks.forEach((_, i) => {
        setTimeout(() => setQpVisible(i + 1), i * 120);
      });
    }, 700);
  };

  const selArr  = [...seleccion].sort();

  // Cálculo de oferta activa y sugerencia
  const ofertaInfo  = calcularOferta(selArr.length, ofertas, rifa.precio);
  const sugerencia  = !ofertaInfo ? siguienteOferta(selArr.length, ofertas, rifa.precio) : null;
  const totalNormal = rifa.precio * selArr.length;
  const totalReal   = ofertaInfo ? ofertaInfo.totalConOferta : totalNormal;

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(42px,1fr))', gap:5, padding:'20px 0' }}>
      {Array.from({length:60}).map((_,i) => <div key={i} className="shimmer" style={{ height:42, borderRadius:8 }}></div>)}
    </div>
  );

  return (
    <div>
      {/* Banner de ofertas disponibles */}
      {ofertas.length > 0 && (
        <BannerOfertas ofertas={ofertas} precioUnitario={rifa.precio} />
      )}

      {/* Barra de ocupación */}
      <div style={{ background:`${TURQ}0d`, border:`1.5px solid ${TURQ}28`, borderRadius:14, padding:'14px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:'.72rem', color:`${DARK}77`, fontWeight:600 }}>
              <span style={{ color:TURQ, fontWeight:800, fontSize:'.88rem' }}>{disponibles.length}</span> disponibles de 1000
            </span>
            <span style={{ fontSize:'.72rem', color: pct > 80 ? '#e63946' : pct > 50 ? '#f0a500' : TURQ, fontWeight:700 }}>{pct}% ocupado</span>
          </div>
          <div style={{ background:'#e0f5f5', borderRadius:6, height:7, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', borderRadius:6, transition:'width 1s ease', background: pct > 80 ? 'linear-gradient(90deg,#e63946,#ff6b6b)' : pct > 50 ? 'linear-gradient(90deg,#f0a500,#ffd166)' : `linear-gradient(90deg,${TURQ},${TURQ2})` }}></div>
          </div>
        </div>
        {disponibles.length === 0 && <span style={{ fontSize:'.72rem', color:'#e63946', fontWeight:700 }}>🔴 Rifa agotada</span>}
      </div>

      {/* Instrucción */}
      <div style={{ background:`${TURQ}08`, border:`1px solid ${TURQ}22`, borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:8, fontSize:'.78rem', color:TURQ_DK, fontWeight:600 }}>
        <span style={{ fontSize:'1.1rem' }}>👆</span>
        <span>Puedes seleccionar <strong>uno o varios números</strong>. {ofertas.length > 0 && <span style={{ color:NARANJA }}>¡Activa ofertas al llegar a la cantidad exacta!</span>}</span>
      </div>

      {/* ── Quick Pick: Selección aleatoria ── */}
      <div style={{
        background: 'linear-gradient(135deg,#0d2e1a,#0a1f12)',
        border: `1.5px solid ${VERDE}33`,
        borderRadius: 18, padding: '20px 22px', marginBottom: 18,
        boxShadow: `0 8px 32px rgba(34,197,94,.12)`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', background:`${VERDE}0a`, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-20, left:-20, width:70, height:70, borderRadius:'50%', background:`${TURQ}0a`, pointerEvents:'none' }}/>

        {/* Título */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, position:'relative' }}>
          <div style={{
            width:38, height:38, borderRadius:10, flexShrink:0,
            background:`linear-gradient(135deg,${VERDE}33,${VERDE}18)`,
            border:`1px solid ${VERDE}44`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem',
          }}>🎲</div>
          <div>
            <div style={{ fontSize:'.78rem', color:'#fff', fontWeight:800, letterSpacing:'.5px' }}>Selección Aleatoria</div>
            <div style={{ fontSize:'.62rem', color:`rgba(255,255,255,.45)`, marginTop:1 }}>El sistema elige tus números al azar</div>
          </div>
        </div>

        {/* Botones de cantidad rápida */}
        <div style={{ marginBottom:14, position:'relative' }}>
          <div style={{ fontSize:'.6rem', color:`rgba(255,255,255,.4)`, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:8 }}>
            Elige cuántos números:
          </div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
  {[1,2,3,5,10,20].map(n => {
    const activo = parseInt(qpCant) === n && qpInputVal === '';
    return (
      <button key={n} onClick={() => { setQpCant(String(n)); setQpInputVal(''); }}
        disabled={n > disponibles.length}
        style={{
          background: activo
            ? `linear-gradient(135deg,${VERDE},#16a34a)`
            : 'rgba(255,255,255,.07)',
          border: activo ? `1.5px solid ${VERDE}88` : '1.5px solid rgba(255,255,255,.12)',
          color: activo ? '#fff' : 'rgba(255,255,255,.7)',
          borderRadius:10, padding:'9px 16px',
          fontFamily:"'Poppins',sans-serif", fontWeight:800,
          fontSize:'.88rem', cursor: n > disponibles.length ? 'not-allowed' : 'pointer',
          opacity: n > disponibles.length ? .35 : 1,
          transition:'all .15s',
          letterSpacing: activo ? '.5px' : 0,
          boxShadow: activo ? `0 4px 16px ${VERDE}44` : 'none',
        }}>
        ×{n}
      </button>
    );
  })}
  <input
    type="number" min="1" max={disponibles.length}
    value={qpInputVal}
    onChange={e => {
      const v = e.target.value;
      setQpInputVal(v);
      if (v !== '' && parseInt(v) > 0) setQpCant(v);
      else if (v === '') setQpCant('');
    }}
    placeholder="Otro nro..."
    style={{
      width:90, padding:'9px 12px',
      background: qpInputVal !== '' ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.07)',
      border: qpInputVal !== '' ? `1.5px solid ${VERDE}88` : '1.5px solid rgba(255,255,255,.12)',
      borderRadius:10, color:'#fff',
      fontFamily:"'Poppins',sans-serif", fontSize:'.88rem', fontWeight:700,
      outline:'none', textAlign:'center',
    }}
  />
</div>
        </div>

        {/* Botón principal */}
        <button
          onClick={() => quickPick()}
          disabled={!qpCant || parseInt(qpCant) < 1 || disponibles.length === 0 || qpRolling}
          style={{
            width:'100%',
            background: qpRolling
              ? 'rgba(255,255,255,.08)'
              : `linear-gradient(135deg,${VERDE},#16a34a)`,
            border: `1.5px solid ${qpRolling ? 'rgba(255,255,255,.1)' : VERDE+'66'}`,
            color:'#fff', borderRadius:12,
            padding:'14px 20px', cursor: qpRolling ? 'not-allowed' : 'pointer',
            fontFamily:"'Poppins',sans-serif", fontWeight:800,
            fontSize:'1rem', display:'flex', alignItems:'center',
            justifyContent:'center', gap:10,
            transition:'all .25s', position:'relative',
            boxShadow: qpRolling ? 'none' : `0 6px 24px ${VERDE}44`,
            letterSpacing:'.5px',
          }}>
          {qpRolling ? (
            <>
              <span style={{ display:'inline-block', animation:'spin .6s linear infinite', fontSize:'1.2rem' }}>🎰</span>
              <span>Eligiendo...</span>
            </>
          ) : (
            <>
              <span style={{ fontSize:'1.2rem' }}>🎰</span>
              <span>
                {qpCant && parseInt(qpCant) > 0
                  ? `¡Quiero ${parseInt(qpCant)} número${parseInt(qpCant)>1?'s':''} aleatorio${parseInt(qpCant)>1?'s':''}!`
                  : '¡Elige mis números!'}
              </span>
            </>
          )}
        </button>

        {/* Resultado animado */}
        {qpResultado.length > 0 && !qpRolling && (
          <div style={{ marginTop:16, animation:'fadeUp .3s ease', position:'relative' }}>
            <div style={{ fontSize:'.6rem', color:`${VERDE}aa`, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:10 }}>
              ✨ Números seleccionados:
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {qpResultado.map((n, i) => (
                <div key={n} style={{
                  background: i < qpVisible
                    ? `linear-gradient(135deg,${VERDE},#16a34a)`
                    : 'rgba(255,255,255,.06)',
                  border: i < qpVisible
                    ? `1.5px solid ${VERDE}88`
                    : '1.5px solid rgba(255,255,255,.1)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontFamily: "'Poppins',sans-serif",
                  fontWeight: 900,
                  fontSize: '1rem',
                  color: i < qpVisible ? '#fff' : 'rgba(255,255,255,.2)',
                  letterSpacing: 2,
                  transition: 'all .3s ease',
                  transform: i < qpVisible ? 'scale(1)' : 'scale(.85)',
                  boxShadow: i < qpVisible ? `0 4px 14px ${VERDE}44` : 'none',
                }}>
                  {i < qpVisible ? n : '···'}
                </div>
              ))}
            </div>
            {qpVisible >= qpResultado.length && (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', animation:'fadeUp .25s ease' }}>
                <div style={{ fontSize:'.72rem', color:`rgba(255,255,255,.55)`, flex:1 }}>
                  🎯 {qpResultado.length} número{qpResultado.length>1?'s':''} marcado{qpResultado.length>1?'s':''} en el grid
                </div>
                <button onClick={() => quickPick()}
                  style={{ background:'rgba(255,255,255,.08)', border:'1.5px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.8)', borderRadius:9, padding:'6px 14px', cursor:'pointer', fontSize:'.72rem', fontWeight:700, fontFamily:"'Poppins',sans-serif" }}>
                  🔄 Volver a tirar
                </button>
                <button onClick={() => { limpiar(); setQpResultado([]); setQpVisible(0); }}
                  style={{ background:'rgba(230,57,70,.12)', border:'1.5px solid rgba(230,57,70,.3)', color:'#f87171', borderRadius:9, padding:'6px 14px', cursor:'pointer', fontSize:'.72rem', fontWeight:700, fontFamily:"'Poppins',sans-serif" }}>
                  ✕ Limpiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Nota */}
        {!qpResultado.length && (
          <div style={{ fontSize:'.62rem', color:`rgba(255,255,255,.3)`, marginTop:12, textAlign:'center', position:'relative' }}>
            {disponibles.length} números disponibles
          </div>
        )}
      </div>

      {/* Buscador */}
      <div style={{ position:'relative', marginBottom:14 }}>
        <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:'.8rem', color:'#aaa' }}>🔍</span>
        <input className="pub-input" value={busqueda} onChange={e => setBusqueda(e.target.value.replace(/\D/,'').slice(0,3))}
          placeholder="Buscar número (ej: 007)" style={{ paddingLeft:44 }} maxLength={3} />
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'.8rem', color:'#aaa' }}>✕</button>
        )}
      </div>

      {/* Chips de selección */}
      {selArr.length > 0 && (
        <div style={{ background:'#f0fafa', border:`1.5px solid ${TURQ}33`, borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
          <div style={{ fontSize:'.65rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
            Seleccionados ({selArr.length}):
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {selArr.map(n => (
              <span key={n} className="num-chip">
                {n}
                <button className="num-chip-remove" onClick={() => toggleNumero(n)} title={`Quitar ${n}`}>✕</button>
              </span>
            ))}
            <button onClick={limpiar}
              style={{ background:'none', border:`1px solid #ffaaaa`, color:'#c0392b', borderRadius:20, padding:'4px 10px', fontSize:'.68rem', fontWeight:600, cursor:'pointer' }}>
              Limpiar todo
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {disponibles.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 20px', background:'#fff5f5', borderRadius:16, border:'2px dashed #ffaaaa' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>😔</div>
          <div style={{ fontSize:'1.1rem', color:'#c0392b', fontWeight:700, marginBottom:6 }}>Esta rifa está agotada</div>
          <div style={{ fontSize:'.88rem', color:`${DARK}66` }}>Todos los números han sido vendidos o reservados</div>
        </div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(52px,1fr))', gap:6 }}>
            {visible.map(n => (
              <div key={n.numero}
                className={`num-cell ${seleccion.has(n.numero) ? 'seleccionado' : 'disponible'}`}
                onClick={() => toggleNumero(n.numero)}
                title={seleccion.has(n.numero) ? `Quitar ${n.numero}` : `Seleccionar ${n.numero}`}>
                {n.numero}
              </div>
            ))}
            {visible.length === 0 && busqueda && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:36, color:'#aaa', fontSize:'.88rem' }}>
                El número <strong>{busqueda.padStart(3,'0')}</strong> no está disponible
              </div>
            )}
          </div>
          <div style={{ fontSize:'.65rem', color:`${DARK}44`, textAlign:'center', marginTop:10 }}>
            Mostrando {visible.length} número{visible.length !== 1 ? 's' : ''} disponible{visible.length !== 1 ? 's' : ''}
            {busqueda && ` para "${busqueda.padStart(3,'0')}"`}
          </div>
        </>
      )}

      {/* ── Barra flotante de carrito inteligente ── */}
      {selArr.length > 0 && (
        <div className="carrito-bar">
          <div style={{
            background:`linear-gradient(135deg,${DARK},#0d2424)`,
            borderRadius:20, padding:'14px 20px',
            boxShadow:`0 -4px 32px rgba(0,0,0,.2), 0 12px 40px ${TURQ}44`,
            border: ofertaInfo ? `1.5px solid ${VERDE}55` : 'none',
          }}>

            {/* Sugerencia de oferta próxima */}
            {sugerencia && selArr.length > 0 && (
              <div className="oferta-sugerencia" style={{ marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:'1rem' }}>💡</span>
                  <span style={{ fontSize:'.78rem', color:`${NARANJA}ee`, fontWeight:700 }}>
                    ¡Agrega <strong style={{ color:'#fff', background:NARANJA, borderRadius:4, padding:'0 5px' }}>{sugerencia.faltan}</strong> número{sugerencia.faltan > 1 ? 's' : ''} más y activa{' '}
                    <strong style={{ color:`${NARANJA}ee` }}>{sugerencia.oferta.etiqueta || `Pack x${sugerencia.oferta.cantidad}`}</strong>!
                  </span>
                </div>
              </div>
            )}

            {/* Oferta activa */}
            {ofertaInfo && (
              <BloqueOfertaAplicada
                ofertaInfo={ofertaInfo}
                cantidad={selArr.length}
                precioUnitario={rifa.precio}
                compact
              />
            )}
            {ofertaInfo && <div style={{ height:10 }}></div>}

            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'.62rem', color:'rgba(255,255,255,.55)', fontWeight:600, marginBottom:2 }}>
                  {selArr.length} número{selArr.length>1?'s':''} seleccionado{selArr.length>1?'s':''}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {selArr.slice(0, 8).map(n => (
                    <span key={n} style={{ background:'rgba(255,255,255,.15)', color:'#fff', borderRadius:6, padding:'2px 7px', fontSize:'.72rem', fontWeight:800, letterSpacing:1 }}>{n}</span>
                  ))}
                  {selArr.length > 8 && <span style={{ color:'rgba(255,255,255,.5)', fontSize:'.72rem', alignSelf:'center' }}>+{selArr.length-8} más</span>}
                </div>
              </div>

              {/* Total */}
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'.55rem', color:'rgba(255,255,255,.45)', textTransform:'uppercase', letterSpacing:'1px' }}>Total</div>
                {ofertaInfo && (
                  <div style={{ fontSize:'.68rem', color:'rgba(255,255,255,.3)', textDecoration:'line-through' }}>{fmt(totalNormal)}</div>
                )}
                <div style={{ fontSize:'1.2rem', color: ofertaInfo ? VERDE : '#fff', fontWeight:900 }}>{fmt(totalReal)}</div>
              </div>

              {/* Botón */}
              <button className="pub-btn" onClick={() => onComprar(selArr)}
                style={{ flexShrink:0, borderRadius:14, padding:'12px 22px', fontSize:'.9rem', boxShadow:`0 8px 24px ${TURQ}55` }}>
                🎟 {selArr.length > 1 ? `Comprar ${selArr.length} números` : 'Comprar número'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD DE RIFA — con badge OFERTA
═══════════════════════════════════════════════════════════ */
function RifaCard({ rifa, onSeleccionar }) {
  const [imgError, setImgError] = useState(false);
  const pct = Math.min(100, (rifa.numeros_vendidos / 1000) * 100);
  const tieneImagen  = rifa.imagen_url && !imgError;
  const tieneOfertas = rifa.ofertas && rifa.ofertas.length > 0;

  // Mejor oferta para mostrar en el resumen
  const mejorOferta = tieneOfertas
    ? [...rifa.ofertas].sort((a, b) => {
        const pctA = (rifa.precio * a.cantidad - a.precio_total) / (rifa.precio * a.cantidad);
        const pctB = (rifa.precio * b.cantidad - b.precio_total) / (rifa.precio * b.cantidad);
        return pctB - pctA;
      })[0]
    : null;

  const mejorPct = mejorOferta
    ? Math.round(((rifa.precio * mejorOferta.cantidad - mejorOferta.precio_total) / (rifa.precio * mejorOferta.cantidad)) * 100)
    : 0;

  return (
    <div style={{ background:'#fff', borderRadius:24, overflow:'hidden', boxShadow:'0 4px 24px rgba(10,100,100,.08)', transition:'transform .2s, box-shadow .2s', position:'relative' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow=`0 16px 48px rgba(10,180,180,.15)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 24px rgba(10,100,100,.08)'; }}>

      <div style={{ position:'relative', height:220, overflow:'hidden', background:`linear-gradient(135deg,${TURQ}22,${TURQ2}33)` }}>
        {tieneImagen
          ? <img src={rifa.imagen_url} alt={rifa.nombre} onError={() => setImgError(true)} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}><div style={{ fontSize:'3.5rem', marginBottom:8 }}>🎰</div><div style={{ fontSize:'.75rem', color:TURQ_DK, fontWeight:600 }}>{rifa.premio}</div></div>
        }

        {/* Badge OFERTA sobre la imagen */}
        {tieneOfertas && (
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6, flexDirection:'column', alignItems:'flex-start' }}>
            <span className="badge-oferta">🏷️ OFERTA</span>
            {mejorOferta && (
              <span style={{ background:'rgba(0,0,0,.7)', color:'#fff', borderRadius:20, padding:'2px 9px', fontSize:'.55rem', fontWeight:700, backdropFilter:'blur(4px)' }}>
                Hasta -{mejorPct}% en packs
              </span>
            )}
          </div>
        )}

        <div style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,.95)', borderRadius:50, padding:'6px 14px', backdropFilter:'blur(8px)', boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
          <span style={{ fontSize:'.72rem', color:TURQ_DK, fontWeight:700 }}>{fmt(rifa.precio)}</span>
        </div>
      </div>

      <div style={{ padding:'18px 22px 22px' }}>
        <div style={{ fontSize:'.55rem', color:`${TURQ}99`, letterSpacing:'0.5px', marginBottom:5 }}>{rifa.loteria_ref || 'SORTEO'} · {fmtF(rifa.fecha_sorteo)}</div>
        <div style={{ fontSize:'1.3rem', color:DARK, lineHeight:1.2, marginBottom:7, fontWeight:700 }}>{rifa.nombre}</div>
        <div style={{ fontSize:'.88rem', color:`${DARK}77`, marginBottom: tieneOfertas ? 10 : 14, display:'flex', alignItems:'center', gap:5 }}>🏆 <span style={{ fontWeight:600, color:DARK }}>{rifa.premio}</span></div>

        {/* Resumen de packs */}
        {tieneOfertas && (
          <div style={{ background:`${NARANJA}0d`, border:`1px solid ${NARANJA}33`, borderRadius:10, padding:'8px 12px', marginBottom:12 }}>
            <div style={{ fontSize:'.55rem', color:NARANJA, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>🎁 Packs disponibles</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {rifa.ofertas.map((o, i) => {
                const totalN = rifa.precio * o.cantidad;
                const p = Math.round(((totalN - o.precio_total) / totalN) * 100);
                return (
                  <div key={i} style={{ background:'rgba(255,107,43,.08)', border:`1px solid ${NARANJA}33`, borderRadius:8, padding:'3px 8px', display:'flex', flexDirection:'column', gap:1 }}>
                    <span style={{ fontSize:'.55rem', color:NARANJA, fontWeight:700 }}>{o.etiqueta || `x${o.cantidad}`}</span>
                    <span style={{ fontSize:'.68rem', color:VERDE, fontWeight:900 }}>{fmt(o.precio_total)}</span>
                    <span style={{ fontSize:'.5rem', color:NARANJA, fontWeight:700 }}>-{p}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:'.56rem', color:`${DARK}66` }}>{rifa.numeros_vendidos} vendidos</span>
            <span style={{ fontSize:'.56rem', color:TURQ }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ background:'#e8f5f5', borderRadius:6, height:6, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${TURQ},${TURQ2})`, borderRadius:6, transition:'width 1s ease' }}></div>
          </div>
        </div>
        <button className="pub-btn" onClick={() => onSeleccionar(rifa)} style={{ width:'100%', justifyContent:'center', borderRadius:14 }}>
          Ver números disponibles
        </button>
      </div>
    </div>
  );
}

export default function ClientePublico() {
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [rifaSel,    setRifaSel]    = useState(null);
  const [numerosCarrito, setNumerosCarrito] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const gridRef = useRef();

  /* ── Tasa para mostrar en la tarjeta pública de Pago Móvil ── */
const tasasHoy = useTasasHoy();
const tasaBs   = tasasHoy?.bsdUsd ?? 0;

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    setLoading(true);
    API.get('/publico/rifas')
      .then(r => { setRifas(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  const handleSelRifa = rifa => {
    setRifaSel(rifa);
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
  };

  const rifasActivas     = rifas.filter(r => r.activa);
  const rifaHero         = rifasActivas[0] || null;
  const rifasSecundarias = rifasActivas.slice(1);

  return (
    <div style={{ minHeight:'100vh', background:'#f0fafa' }}>

      <nav style={{ background:'rgba(255,255,255,.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid #e0f0f0', padding:'0 5vw', position:'sticky', top:0, zIndex:100, height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>🎰</div>
          <span style={{ fontSize:'1.15rem', color:DARK, fontWeight:700, fontFamily:"'Poppins',sans-serif" }}>Rifas Jordyn</span>
        </div>
        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          {[['#rifas-sec','Rifas'],['#pagos-sec','Pagos'],['#contacto-sec','Contacto']].map(([href, label]) => (
            <a key={href} href={href} className="nav-link">{label}</a>
          ))}
        </div>
      </nav>

      {loading ? (
        <div style={{ padding:'5vw', maxWidth:1100, margin:'0 auto' }}>
          <div className="shimmer" style={{ height:520, borderRadius:28 }}></div>
        </div>
      ) : rifaHero ? (
        <section style={{ padding:'40px 5vw 0', maxWidth:1100, margin:'0 auto' }}>
          <HeroRifaPrincipal rifa={rifaHero} onVerNumeros={handleSelRifa} />
        </section>
      ) : null}

      {rifasSecundarias.length > 0 && (
        <section id="rifas-sec" style={{ padding:'60px 5vw 0', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:8, fontWeight:600 }}>MÁS RIFAS</div>
            <h2 style={{ fontSize:'clamp(1.8rem,3.5vw,2.4rem)', color:DARK, fontWeight:800 }}>Otras rifas activas</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:24 }}>
            {rifasSecundarias.map(r => <RifaCard key={r.id} rifa={r} onSeleccionar={handleSelRifa} />)}
          </div>
        </section>
      )}

      {rifaSel && (
        <section ref={gridRef} style={{ padding:'60px 5vw 0', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ background:'#fff', borderRadius:24, padding:'28px', boxShadow:'0 4px 32px rgba(10,100,100,.08)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:24, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:'.58rem', color:TURQ, letterSpacing:'0.5px', marginBottom:5, fontWeight:600 }}>ESCOGE TU NÚMERO</div>
                <div style={{ fontSize:'1.5rem', color:DARK, marginBottom:5, fontWeight:700 }}>{rifaSel.nombre}</div>
                <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                  <span style={{ fontSize:'.85rem', color:`${DARK}77` }}>🏆 {rifaSel.premio}</span>
                  <span style={{ fontSize:'.85rem', color:`${DARK}77` }}>💰 {fmt(rifaSel.precio)} / número</span>
                  <span style={{ fontSize:'.85rem', color:`${DARK}77` }}>📅 {fmtF(rifaSel.fecha_sorteo)}</span>
                </div>
              </div>
              <button onClick={() => setRifaSel(null)} className="pub-btn-outline" style={{ padding:'10px 20px', flexShrink:0 }}>
                Cambiar rifa
              </button>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:22, flexWrap:'wrap' }}>
              {[
                { n:'1', t:'Selecciona',  d:'Toca uno o varios números. ¡Activa ofertas con packs!' },
                { n:'2', t:'Paga',        d:'Los datos del banco aparecen al elegir el método' },
                { n:'3', t:'Confirma',    d:'Sube el comprobante y bloquea tus números' },
              ].map(({ n, t, d }) => (
                <div key={n} style={{ flex:'1 1 140px', background:'#f8fdfd', borderRadius:12, padding:'11px 13px', display:'flex', gap:9, alignItems:'flex-start' }}>
                  <div style={{ width:26, height:26, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:'.58rem', color:'#fff', fontWeight:700 }}>{n}</span>
                  </div>
                  <div>
                    <div style={{ fontSize:'.82rem', fontWeight:600, color:DARK }}>{t}</div>
                    <div style={{ fontSize:'.74rem', color:`${DARK}66` }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>

            <GridNumeros
              key={`${rifaSel.id}-${refreshKey}`}
              rifa={rifaSel}
              onComprar={nums => setNumerosCarrito(nums)}
            />
          </div>
        </section>
      )}

      <section style={{ background:'#fff', padding:'70px 5vw 0' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12, fontWeight:600 }}>SIN COMPLICACIONES</div>
            <h2 style={{ fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Cómo participar</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:24 }}>
            {[
              { icon:'🔢', titulo:'1. Elige tus números',   desc:'Toca uno o varios números en el grid. ¡Con packs activas ofertas automáticamente!' },
              { icon:'💳', titulo:'2. Realiza el pago',     desc:'Los datos del banco aparecen al seleccionar el método. Paga el total con oferta.' },
              { icon:'📸', titulo:'3. Sube el comprobante', desc:'Adjunta la captura del pago junto con tus datos. Un comprobante para todos.' },
              { icon:'✅', titulo:'4. Confirmación',         desc:'El admin verifica y te envía tu ticket por WhatsApp.' },
            ].map(({ icon, titulo, desc }) => (
              <div key={titulo} style={{ textAlign:'center', padding:'22px 18px' }}>
                <div style={{ width:62, height:62, background:`linear-gradient(135deg,${TURQ}18,${TURQ2}28)`, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:'1.7rem' }}>{icon}</div>
                <div style={{ fontSize:'1.05rem', color:DARK, fontWeight:700, marginBottom:7 }}>{titulo}</div>
                <div style={{ fontSize:'.88rem', color:`${DARK}77`, lineHeight:1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pagos-sec" style={{ background:'#fff', padding:'70px 5vw 80px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12, fontWeight:600 }}>MÉTODOS DE PAGO</div>
            <h2 style={{ fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Cuentas bancarias</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:20 }}>
            {Object.entries(METODOS_PAGO).map(([nombre, d]) => (
              <div key={nombre} style={{ background: d.bg, border:`2px solid ${d.border}`, borderRadius:20, padding:'26px 22px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:50, height:50, borderRadius:14, background:'rgba(255,255,255,.8)', border:`1px solid ${d.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', flexShrink:0 }}>{d.icono}</div>
                  <div>
                    <div style={{ fontSize:'1.1rem', color: d.colorHex, fontWeight:700 }}>{nombre}</div>
                    <div style={{ fontSize:'.7rem', color:`${DARK}66` }}>{d.pais}</div>
                  </div>
                </div>
                {d.campos.map(({ label, valor }) => (
                  <div key={label} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'9px 13px', marginBottom:8 }}>
                    <div style={{ fontSize:'.6rem', color:`${d.colorHex}88`, fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
                    <div style={{ fontSize:'.9rem', color:DARK, fontWeight:700 }}>{valor}</div>
                  </div>
                ))}
                {nombre === 'Pago Móvil' && tasaBs > 0 && (
                  <div style={{ marginTop:10, background:`${TURQ}12`, border:`1px solid ${TURQ}35`, borderRadius:10, padding:'9px 13px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:'.55rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>Tasa hoy</div>
                      <div style={{ fontSize:'.9rem', color:TURQ_DK, fontWeight:800 }}>1 USD = Bs. {new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(tasaBs)}</div>
                    </div>
                    <span style={{ background:`${TURQ}22`, border:`1px solid ${TURQ}44`, color:TURQ_DK, borderRadius:20, padding:'3px 9px', fontSize:'.55rem', fontWeight:800, letterSpacing:'1px' }}>✅ MANUAL</span>
                  </div>
                )}
                {d.nota && <div style={{ fontSize:'.72rem', color: d.colorHex, fontWeight:600, textAlign:'center', padding:'7px', background:'rgba(255,255,255,.5)', borderRadius:8, marginTop:8 }}>{d.nota}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="contacto-sec" style={{ background:DARK, padding:'60px 5vw 40px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, marginBottom:40 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:38, height:38, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>🎰</div>
                <span style={{ fontSize:'1.2rem', color:'#fff', fontWeight:700 }}>Rifas Jordyn</span>
              </div>
              <p style={{ fontSize:'.88rem', color:'rgba(255,255,255,.5)', lineHeight:1.7 }}>Sorteos semanales con premios increíbles.<br/>Táchira, Venezuela.</p>
            </div>
            <div>
              <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'0.5px', marginBottom:14, fontWeight:600 }}>CONTACTO</div>
              <div style={{ fontSize:'.9rem', color:'rgba(255,255,255,.7)', lineHeight:2 }}>
                <div>📱 WhatsApp disponible</div>
                <div>📍 Táchira, Venezuela</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'0.5px', marginBottom:14, fontWeight:600 }}>ACCESO ADMINISTRADOR</div>
              <a href="/login" style={{ fontSize:'.88rem', color:'rgba(255,255,255,.5)', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}
                onMouseEnter={e => e.target.style.color = TURQ} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.5)'}>
                🔐 Iniciar sesión
              </a>
            </div>
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', paddingTop:22, textAlign:'center' }}>
            <span style={{ fontSize:'.56rem', color:'rgba(255,255,255,.25)', letterSpacing:'0.5px' }}>© 2026 RIFAS JORDYN · TODOS LOS DERECHOS RESERVADOS</span>
          </div>
        </div>
      </footer>

      {numerosCarrito && rifaSel && (
        <ModalReserva
          rifa={rifaSel}
          numeros={numerosCarrito}
          onClose={() => setNumerosCarrito(null)}
          onSuccess={() => { setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}