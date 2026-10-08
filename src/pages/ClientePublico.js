import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import GanadoresPublico from '../components/GanadoresPublico';
import { TopCompradores, BurbujaGrupo } from '../components/ComunidadPublico';
import ResultadosPublico from '../components/ResultadosPublico';

const TURQ    = '#0abfbc';
const TURQ2   = '#00d4d0';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';
const NARANJA = '#ff6b2b';
const VERDE   = '#22c55e';

const fmt  = p => p ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p) : '$0';

/* ─────────────────────────────────────────────────────────────
   ZONA HORARIA DEL NEGOCIO
   El backend ahora devuelve `datetime_sorteo` como ISO UTC con Z,
   calculado directamente en PostgreSQL con AT TIME ZONE 'America/Caracas'.
   No hay desfase posible: new Date("2026-05-20T04:00:00Z") es exacto.
───────────────────────────────────────────────────────────── */
const TZ_NEGOCIO = 'America/Caracas';

/**
 * Devuelve un Date a partir de datetime_sorteo (ISO con Z) o, como
 * fallback, de fecha_sorteo (solo fecha, se interpreta como medianoche
 * hora Venezuela para no desplazar el día).
 */
const parseSorteo = (rifa) => {
  // Preferir datetime_sorteo (nuevo campo del backend, ya en UTC real)
  if (rifa?.datetime_sorteo) {
    const d = new Date(rifa.datetime_sorteo);
    return isNaN(d.getTime()) ? null : d;
  }
  // Fallback: fecha_sorteo "YYYY-MM-DD" → medianoche Venezuela (UTC-4 = +04:00 UTC)
  if (rifa?.fecha_sorteo) {
    const solo = String(rifa.fecha_sorteo).slice(0, 10);
    const hora = rifa.hora_sorteo ? String(rifa.hora_sorteo).slice(0, 5) : '00:00';
    // Construir como hora local Venezuela explícita
    const d = new Date(`${solo}T${hora}:00-04:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const parseFecha = (f) => {
  if (!f) return null;
  // Para display solo necesitamos la fecha; medianoche Caracas
  const solo = String(f).slice(0, 10);
  const d = new Date(`${solo}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d;
};

const fmtF = f => {
  const d = parseFecha(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: TZ_NEGOCIO,
  });
};

// const fmtHora = (hora) => {
//   if (!hora) return null;
//   const h = String(hora).trim();
//   if (!h || h === '00:00' || h === '00:00:00') return null;
//   const [hh, mm] = h.split(':').map(Number);
//   if (isNaN(hh) || isNaN(mm)) return null;
//   const d = new Date(2000, 0, 1, hh, mm, 0);
//   return d.toLocaleTimeString('es-CO', {
//     hour: '2-digit', minute: '2-digit', hour12: true,
//   });
// };

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
   Datos de pago desde el backend (misma fuente que usa el bot de
   WhatsApp): son las cuentas que el dueño edita en el panel
   (Cuentas bancarias). Si el servidor no responde, se usan las de arriba.
   Manda el servidor: su orden, las cuentas nuevas y las que se quitaron.
   Los colores de aquí se conservan salvo que la cuenta traiga el suyo.
───────────────────────────────────────────────────────────── */
function useMetodosPagoServidor() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    fetch('https://rifasjordynb-production.up.railway.app/api/publico/metodos-pago')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data?.metodos || !Object.keys(data.metodos).length) return;
        const locales = { ...METODOS_PAGO };
        for (const k of Object.keys(METODOS_PAGO)) delete METODOS_PAGO[k];
        for (const [nombre, m] of Object.entries(data.metodos)) {
          METODOS_PAGO[nombre] = {
            colorHex: TURQ_DK, bg: '#f5fffe', border: `${TURQ}55`,
            ...locales[nombre],
            ...(m.color ? { colorHex: m.color, bg: `${m.color}12`, border: `${m.color}55` } : {}),
            icono: m.icono || locales[nombre]?.icono || '💳',
            pais: m.pais || locales[nombre]?.pais || '',
            campos: Array.isArray(m.campos) ? m.campos : [],
            nota: m.nota,
            imagen: m.imagen || null,   // logo subido en el panel (si no hay, se usa el ícono)
          };
          if (m.moneda) METODO_MONEDA[nombre] = m.moneda;
        }
        setVersion(v => v + 1);   // re-render con los datos del servidor
      })
      .catch(() => {});
  }, []);
}

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
    `*RESUELVE TU SEMANA* — Confirmación de reserva\n\n` +
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

    /* ══ Diseño general de la página ══ */
    .pub-pagina { position:relative; z-index:0; min-height:100vh;
      background:linear-gradient(180deg,#e9fafa 0%,#f5fdfd 28%,#eef9f9 100%); }
    .pub-fondo { position:absolute; inset:0; z-index:-1; overflow:hidden; pointer-events:none; }
    .pub-fondo i { position:absolute; border-radius:50%; filter:blur(70px); opacity:.55; }
    .pub-fondo i:nth-child(1) { width:520px; height:520px; top:-160px; left:-140px; background:${TURQ}55; }
    .pub-fondo i:nth-child(2) { width:420px; height:420px; top:120px; right:-160px; background:#ffd16655; }
    .pub-fondo i:nth-child(3) { width:460px; height:460px; top:1100px; left:-200px; background:${TURQ2}33; }
    .pub-fondo i:nth-child(4) { width:380px; height:380px; top:1900px; right:-150px; background:${NARANJA}22; }

    .pub-nav { background:rgba(255,255,255,.82); backdrop-filter:blur(16px) saturate(1.4); border-bottom:1px solid rgba(10,150,150,.12);
      padding:0 5vw; position:sticky; top:0; z-index:100; height:64px; display:flex; align-items:center; justify-content:space-between; gap:12px;
      box-shadow:0 4px 24px rgba(10,100,100,.06); }
    .pub-marca { display:flex; align-items:center; gap:10px; text-decoration:none; min-width:0; }
    .pub-marca-img { height:50px; width:auto; display:block; }
    .pub-marca-logo { width:38px; height:38px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1.15rem;
      background:linear-gradient(135deg,${TURQ},${TURQ_DK}); box-shadow:0 6px 16px ${TURQ}55; }
    .pub-marca-txt { font-size:1.05rem; color:${DARK}; font-weight:800; line-height:1.1; white-space:nowrap; }
    .pub-marca-txt small { display:block; font-size:.55rem; font-weight:600; letter-spacing:1.5px; color:${TURQ_DK}; text-transform:uppercase; }
    .pub-nav-btn { border:none; cursor:pointer; font-family:'Poppins',sans-serif; font-size:.78rem; font-weight:700; color:#fff; border-radius:40px; padding:8px 16px;
      background:linear-gradient(135deg,#7c3aed,#a855f7); box-shadow:0 6px 16px rgba(124,58,237,.3); white-space:nowrap; transition:transform .2s; }
    .pub-nav-btn:hover { transform:translateY(-2px); }

    .pub-intro { text-align:center; padding:44px 5vw 4px; max-width:860px; margin:0 auto; animation:fadeUp .5s ease both; }
    .pub-intro-chip { display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid ${TURQ}44; color:${TURQ_DK}; border-radius:40px;
      padding:6px 16px; font-size:.7rem; font-weight:700; letter-spacing:.5px; box-shadow:0 4px 16px rgba(10,150,150,.1); }
    .pub-intro-chip b { width:8px; height:8px; border-radius:50%; background:${VERDE}; animation:pulse-ring 2s infinite; }
    .pub-intro h1 { font-size:clamp(1.9rem,5.2vw,3.3rem); font-weight:900; color:${DARK}; line-height:1.08; letter-spacing:-1px; margin:16px 0 12px; }
    .pub-intro h1 span { background:linear-gradient(100deg,${TURQ_DK},${TURQ2} 45%,#f5a623); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .pub-intro p { font-size:clamp(.92rem,1.6vw,1.05rem); color:${DARK}99; line-height:1.6; max-width:600px; margin:0 auto; }
    .pub-sellos { display:flex; justify-content:center; gap:8px 10px; flex-wrap:wrap; margin-top:18px; }
    .pub-sello { display:inline-flex; align-items:center; gap:6px; font-size:.74rem; font-weight:600; color:${DARK}cc; background:rgba(255,255,255,.75);
      border:1px solid rgba(10,150,150,.16); border-radius:40px; padding:6px 13px; }
    .pub-sello i { font-style:normal; color:${VERDE}; font-weight:900; }

    .pub-cifras { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
    .pub-cifra { background:#fff; border-radius:20px; padding:18px 16px; display:flex; align-items:center; gap:12px; border:1px solid rgba(10,150,150,.1);
      box-shadow:0 6px 24px rgba(10,100,100,.07); transition:transform .2s, box-shadow .2s; }
    .pub-cifra:hover { transform:translateY(-4px); box-shadow:0 14px 36px rgba(10,150,150,.14); }
    .pub-cifra-ico { width:46px; height:46px; border-radius:14px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1.4rem;
      background:linear-gradient(135deg,${TURQ}1c,${TURQ2}30); }
    .pub-cifra strong { display:block; font-size:1.15rem; font-weight:900; color:${DARK}; line-height:1.15; }
    .pub-cifra span { font-size:.68rem; color:${DARK}88; font-weight:600; }

    .pub-titulo { text-align:center; margin-bottom:40px; }
    .pub-titulo .kicker { display:inline-block; font-size:.64rem; color:${TURQ_DK}; letter-spacing:2px; font-weight:800; text-transform:uppercase;
      background:${TURQ}14; border-radius:40px; padding:5px 14px; margin-bottom:12px; }
    .pub-titulo h2 { font-size:clamp(1.8rem,4vw,2.7rem); color:${DARK}; font-weight:900; letter-spacing:-.5px; line-height:1.15; }
    .pub-titulo h2::after { content:''; display:block; width:64px; height:5px; border-radius:5px; margin:14px auto 0;
      background:linear-gradient(90deg,${TURQ},#f5a623); }
    .pub-titulo .sub { font-size:.86rem; color:${DARK}88; margin-top:12px; }

    .pub-pasos { display:grid; grid-template-columns:repeat(auto-fit,minmax(215px,1fr)); gap:18px; counter-reset:paso; }
    .pub-paso { position:relative; background:linear-gradient(180deg,#fff,#f7fdfd); border:1px solid rgba(10,150,150,.13); border-radius:22px; padding:30px 20px 22px;
      text-align:center; box-shadow:0 6px 24px rgba(10,100,100,.06); transition:transform .25s, box-shadow .25s, border-color .25s; }
    .pub-paso:hover { transform:translateY(-6px); box-shadow:0 18px 44px rgba(10,150,150,.16); border-color:${TURQ}66; }
    .pub-paso::before { counter-increment:paso; content:counter(paso); position:absolute; top:-15px; left:50%; transform:translateX(-50%);
      width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,${TURQ},${TURQ_DK}); color:#fff; font-weight:900; font-size:.9rem;
      display:flex; align-items:center; justify-content:center; box-shadow:0 6px 14px ${TURQ}66; border:3px solid #fff; }
    .pub-paso-ico { width:66px; height:66px; border-radius:20px; margin:0 auto 14px; display:flex; align-items:center; justify-content:center; font-size:1.9rem;
      background:linear-gradient(135deg,${TURQ}18,${TURQ2}2e); }
    .pub-paso h3 { font-size:1.02rem; color:${DARK}; font-weight:800; margin-bottom:7px; }
    .pub-paso p { font-size:.86rem; color:${DARK}88; line-height:1.6; }

    .pago-card { transition:transform .22s, box-shadow .22s; }
    .pago-card:hover { transform:translateY(-5px); box-shadow:0 16px 40px rgba(10,100,100,.13); }

    /* Premios de la rifa (mayor + adicionales) */
    .premios-lista { display:flex; flex-direction:column; gap:6px; }
    .premio-fila { display:flex; align-items:center; gap:10px; border-radius:12px; padding:8px 12px; }
    .premio-fila .pos { width:28px; height:28px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.95rem; }
    .premio-fila b { display:block; font-size:.86rem; font-weight:800; line-height:1.25; }
    .premio-fila small { display:block; font-size:.68rem; font-weight:500; opacity:.75; }

    /* Aviso de apartados */
    .apartado-banner { display:flex; align-items:center; gap:14px; flex-wrap:wrap; border-radius:20px; padding:16px 20px;
      background:linear-gradient(135deg,#f5efff,#fbf7ff); border:1.5px solid rgba(124,58,237,.25); box-shadow:0 6px 24px rgba(124,58,237,.08); }
    .modo-pago { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
    .modo-pago button { border:2px solid #e0f0f0; background:#fff; border-radius:14px; padding:12px 10px; cursor:pointer; text-align:left; font-family:'Poppins',sans-serif;
      transition:border-color .15s, background .15s, box-shadow .15s; }
    .modo-pago button b { display:block; font-size:.88rem; color:${DARK}; }
    .modo-pago button span { display:block; font-size:.68rem; color:${DARK}88; margin-top:2px; line-height:1.35; }
    .modo-pago button.on { border-color:${TURQ}; background:${TURQ}0d; box-shadow:0 0 0 4px ${TURQ}18; }
    .modo-pago button.on.morado { border-color:#7c3aed; background:rgba(124,58,237,.06); box-shadow:0 0 0 4px rgba(124,58,237,.12); }

    @media (max-width: 640px) {
      /* En el teléfono la foto de la rifa ocupa todo el ancho y toma su alto natural
         (antes quedaba encogida dentro de una caja baja, con franjas a los lados) */
      .hero-img-caja.con-imagen { min-height:0 !important; height:auto !important; }
      .hero-img-caja.con-imagen .hero-img { position:relative !important; inset:auto !important; width:100% !important; height:auto !important; max-height:85vh; }
      .hero-img-degradado { display:none; }
      .rifa-card-img-caja.con-imagen { height:auto !important; }
      .rifa-card-img-caja.con-imagen .rifa-card-img { position:relative !important; inset:auto !important; width:100% !important; height:auto !important; max-height:75vh; }
      .nav-solo-escritorio { display:none !important; }
      .pub-marca-img { height:40px; }
      .count-unit { min-width:0; padding:12px 4px 9px; border-radius:14px; }
      .count-sep { font-size:1.4rem; margin-top:12px; }
      .pub-nav-links { gap:14px !important; }
      .pub-nav-links .nav-link { font-size:.8rem; }
      .pub-nav-btn { padding:7px 12px; font-size:.72rem; }
      .pub-marca-txt { font-size:.92rem; }
      .pub-marca-txt small { display:none; }
      .pub-intro { padding-top:30px; }
      .pub-cifras { grid-template-columns:1fr 1fr; gap:10px; }
      .pub-cifra { padding:13px 11px; gap:9px; border-radius:16px; }
      .pub-cifra-ico { width:38px; height:38px; font-size:1.15rem; border-radius:11px; }
      .pub-cifra strong { font-size:.98rem; }
      .modo-pago { grid-template-columns:1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pub-intro, .pub-intro-chip b { animation:none; }
      .pub-cifra, .pub-paso, .pago-card { transition:none; }
    }

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

/* ─────────────────────────────────────────────────────────────
   HOOK: progreso real de una rifa
   Consume el endpoint dedicado /publico/rifas/:id/progreso, que
   devuelve un único objeto con el cálculo correcto (incluye
   ventas + reservas + números en poder de vendedores) según el
   tipo de rifa (sencilla=1000 / simultánea=2000).

   Respuesta del endpoint:
     { total, vendidos, reservados, asignados_vendedor,
       tomados, disponibles, pct }

   Cache en memoria por rifaId (30 s) para no recargar al
   renderizar varias cards a la vez.
───────────────────────────────────────────────────────────── */
const _progresoCache = new Map(); // rifaId -> { ts, data }
const PROGRESO_TTL = 30_000;       // 30 s

function useRifaProgress(rifaId, refreshKey = 0) {
  const [stat, setStat] = useState(() => {
    const c = _progresoCache.get(rifaId);
    if (c && Date.now() - c.ts < PROGRESO_TTL) return { ...c.data, loading:false };
    return { totalNumeros:0, tomados:0, disponibles:0, pct:0, loading:true };
  });

  useEffect(() => {
    if (!rifaId) return;
    const c = _progresoCache.get(rifaId);
    if (c && Date.now() - c.ts < PROGRESO_TTL) {
      setStat({ ...c.data, loading:false });
      return;
    }
    let cancel = false;
    setStat(s => ({ ...s, loading:true }));
    API.get(`/publico/rifas/${rifaId}/progreso`)
      .then(r => {
        if (cancel) return;
        const d = r.data || {};
        const data = {
          totalNumeros: Number(d.total)       || 0,
          tomados:      Number(d.tomados)     || 0,
          disponibles:  Number(d.disponibles) || 0,
          pct:          Number(d.pct)         || 0,
          // Extra opcional por si se quiere desglosar
          vendidos:           Number(d.vendidos)           || 0,
          reservados:         Number(d.reservados)         || 0,
          asignados_vendedor: Number(d.asignados_vendedor) || 0,
        };
        _progresoCache.set(rifaId, { ts: Date.now(), data });
        setStat({ ...data, loading:false });
      })
      .catch(() => { if (!cancel) setStat(s => ({ ...s, loading:false })); });
    return () => { cancel = true; };
  }, [rifaId, refreshKey]);

  return stat;
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
   PREMIOS DE LA RIFA: el premio mayor y los adicionales
   (los adicionales se cargan en el panel, al crear/editar la rifa)
═══════════════════════════════════════════════════════════ */
const MEDALLAS_PREMIO = ['🥇', '🥈', '🥉'];
const hoyCaracas = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ_NEGOCIO });
// Premios especiales que siguen vigentes (sin fecha tope o con la fecha por llegar)
const especialesDe = (rifa) => (Array.isArray(rifa?.premios_extra) ? rifa.premios_extra : [])
  .filter(p => p?.nombre && (!p.fecha_tope || p.fecha_tope >= hoyCaracas()));
// ¿La rifa tiene 2.º/3.er premio o premios especiales que mostrar?
const tienePremiosExtra = (rifa) => !!(rifa?.premio_segundo || rifa?.premio_tercero || especialesDe(rifa).length);

function PremiosRifa({ rifa, oscuro = false }) {
  const especiales = especialesDe(rifa);
  const lista = [
    { nombre: rifa.premio, detalle: 'Premio mayor' },
    rifa.premio_segundo ? { nombre: rifa.premio_segundo, detalle: '2.º premio' } : null,
    rifa.premio_tercero ? { nombre: rifa.premio_tercero, detalle: '3.er premio' } : null,
  ].filter(Boolean);
  if (lista.length < 2 && !especiales.length) return null;
  const titulo = { fontSize:'.58rem', letterSpacing:'2px', textTransform:'uppercase', fontWeight:800, marginBottom:8, color: oscuro ? 'rgba(255,255,255,.55)' : TURQ_DK };
  return (
    <div>
      {lista.length > 1 && <>
      <div style={titulo}>
        🏆 {lista.length} premios en esta rifa
      </div>
      <div className="premios-lista">
        {lista.map((p, i) => (
          <div key={i} className="premio-fila" style={oscuro
            ? { background: i === 0 ? 'rgba(255,201,60,.14)' : 'rgba(255,255,255,.07)', border:`1px solid ${i === 0 ? 'rgba(255,201,60,.4)' : 'rgba(255,255,255,.12)'}`, color:'#fff' }
            : { background: i === 0 ? '#fff8e1' : '#f8fdfd', border:`1px solid ${i === 0 ? '#ffe082' : '#e0f0f0'}`, color: DARK }}>
            <span className="pos" style={{ background: oscuro ? 'rgba(255,255,255,.1)' : '#fff' }}>{MEDALLAS_PREMIO[i] || '🎁'}</span>
            <span style={{ minWidth:0 }}>
              <b>{p.nombre}</b>
              {p.detalle && <small>{p.detalle}</small>}
            </span>
          </div>
        ))}
      </div>
      </>}

      {/* Premios especiales: aparte, con su requisito y su fecha tope */}
      {especiales.length > 0 && (
        <div style={{ marginTop: lista.length > 1 ? 14 : 0 }}>
          <div style={{ ...titulo, color: oscuro ? '#ffd166' : '#b8860b' }}>
            🎁 {especiales.length === 1 ? 'Premio especial' : `${especiales.length} premios especiales`}
          </div>
          <div className="premios-lista">
            {especiales.map((p, i) => (
              <div key={i} className="premio-fila" style={{ alignItems:'flex-start', ...(oscuro
                ? { background:'rgba(255,209,102,.1)', border:'1px dashed rgba(255,209,102,.5)', color:'#fff' }
                : { background:'#fffaf0', border:'1px dashed #f0c35a', color: DARK }) }}>
                <span className="pos" style={{ background: oscuro ? 'rgba(255,255,255,.1)' : '#fff' }}>🎁</span>
                <span style={{ minWidth:0 }}>
                  <b>{p.nombre}</b>
                  {p.detalle && <small>{p.detalle}</small>}
                  {p.requisito && <small style={{ opacity:1, fontWeight:700, color: oscuro ? '#ffd166' : '#b8860b' }}>✔ {p.requisito}</small>}
                  {p.fecha_tope && <small>⏰ Hasta el {fmtF(p.fecha_tope)}</small>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Etiqueta: en esta rifa se puede apartar el número y pagar después */
const EtiquetaApartado = ({ rifa, estilo }) => (rifa.pago_diferido ? (
  <span title={rifa.pago_hasta_texto ? `Puedes pagar hasta el ${rifa.pago_hasta_texto}` : undefined}
    style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', borderRadius:50, padding:'5px 13px', fontSize:'.58rem', fontWeight:800, letterSpacing:'1px', textTransform:'uppercase', boxShadow:'0 4px 16px rgba(124,58,237,.4)', ...estilo }}>
    🔖 Aparta y paga después
  </span>
) : null);

/* ═══════════════════════════════════════════════════════════
   HERO DE LA RIFA PRINCIPAL
   FIX PUNTO 1B: condición !cd.invalid agregada al render del countdown
═══════════════════════════════════════════════════════════ */
function HeroRifaPrincipal({ rifa, onVerNumeros, refreshKey = 0 }) {
  const cd = useCountdown(rifa.datetime_sorteo || rifa.fecha_sorteo);
  const [imgError, setImgError] = useState(false);
  const tieneImagen = rifa.imagen_url && !imgError;
  const tieneOfertas = rifa.ofertas && rifa.ofertas.length > 0;
  const progreso = useRifaProgress(rifa.id, refreshKey);
  const pctHero = Math.min(100, progreso.pct);

  const unidades = [
    { val: String(cd.dias).padStart(2,'0'),     lbl: 'Días'  },
    { val: String(cd.horas).padStart(2,'0'),    lbl: 'Horas' },
    { val: String(cd.minutos).padStart(2,'0'),  lbl: 'Min'   },
    { val: String(cd.segundos).padStart(2,'0'), lbl: 'Seg'   },
  ];

  return (
    <div style={{ borderRadius:28, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,.18)', display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:520, background:DARK }} className="hero-feat-card">
      <div className={`hero-img-caja${tieneImagen ? ' con-imagen' : ''}`} style={{ position:'relative', overflow:'hidden', height:'100%', minHeight:520, background:'#0d1e1e' }}>
        {tieneImagen ? (
          <>
            {/* Fondo borroso por si quedan franjas (efecto cinema) */}
            <div style={{
              position:'absolute', inset:0,
              background:`url(${rifa.imagen_url}) center/cover no-repeat`,
              filter:'blur(40px) brightness(.35)',
              transform:'scale(1.25)',
            }}></div>
            {/* Imagen principal: contain para que se vea COMPLETA sin recortes */}
            <img className="hero-img" src={rifa.imagen_url} alt={rifa.premio} onError={() => setImgError(true)}
              style={{
                position:'absolute', inset:0,
                width:'100%', height:'100%',
                objectFit:'contain',
                objectPosition:'center center',
                display:'block',
              }} />
          </>
        ) : (
          <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,${TURQ_DK}44,${DARK})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:'8rem', opacity:.2, animation:'heroFloat 4s ease-in-out infinite' }}>🎰</div>
          </div>
        )}
        <div className="hero-img-degradado" style={{ position:'absolute', inset:0, background:`linear-gradient(to right, transparent 70%, ${DARK} 100%)`, pointerEvents:'none' }}></div>
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
          <EtiquetaApartado rifa={rifa} />
        </div>

        <h2 style={{ fontSize:'clamp(1.4rem,3vw,2.2rem)', color:'#fff', fontWeight:900, lineHeight:1.15, marginBottom:6, textShadow:'0 2px 16px rgba(0,0,0,.5)', position:'relative' }}>{rifa.nombre}</h2>
        <p style={{ fontSize:'.9rem', color:'rgba(255,255,255,.65)', marginBottom: tienePremiosExtra(rifa) ? 14 : 24, fontWeight:500, position:'relative' }}>🏆 {rifa.premio}</p>
        {tienePremiosExtra(rifa) && (
          <div style={{ marginBottom:20, position:'relative' }}><PremiosRifa rifa={rifa} oscuro /></div>
        )}

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
          {/* ── Progreso real de venta (versión grande) ── */}
          <div style={{
            background:'rgba(255,255,255,.05)',
            border:'1px solid rgba(255,255,255,.1)',
            borderRadius:14,
            padding:'14px 16px',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
              <span style={{ fontSize:'.7rem', color:'rgba(255,255,255,.7)', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:700 }}>
                🎟 Progreso de venta
              </span>
              <span style={{ fontSize:'1.6rem', color:TURQ, fontWeight:900, lineHeight:1, textShadow:`0 0 16px ${TURQ}88` }}>
                {pctHero.toFixed(1)}%
              </span>
            </div>
            <div style={{ background:'rgba(255,255,255,.1)', borderRadius:10, height:16, overflow:'hidden', border:'1px solid rgba(255,255,255,.1)', position:'relative' }}>
              <div style={{
                width:`${pctHero}%`, height:'100%',
                background:`linear-gradient(90deg,${TURQ},${TURQ2})`,
                borderRadius:10, transition:'width 1s ease',
                boxShadow:`0 0 20px ${TURQ}aa`,
              }}></div>
            </div>
            <div style={{ fontSize:'.78rem', color:'rgba(255,255,255,.6)', marginTop:8, fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              {!progreso.loading && progreso.totalNumeros > 0 && (
                <span style={{ fontSize:'.65rem', color:'rgba(255,255,255,.45)' }}>
                  {(progreso.totalNumeros - progreso.tomados).toLocaleString('es-CO')} disponibles
                </span>
              )}
            </div>
          </div>

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
        {info.imagen
          ? <img src={info.imagen} alt="" style={{ width:38, height:38, objectFit:'contain', borderRadius:8, background:'#fff', flexShrink:0 }} />
          : <span style={{ fontSize:'1.6rem' }}>{info.icono}</span>}
        <div>
          <div style={{ fontSize:'.88rem', fontWeight:700, color: info.colorHex }}>{metodo}</div>
          <div style={{ fontSize:'.65rem', color:`${DARK}66` }}>{info.pais}</div>
        </div>
      </div>
      {info.campos.map(({ label, valor }) => (
        <div key={label} className="pago-campo-row">
          <div>
            <div style={{ fontSize:'.6rem', fontWeight:700, color:`${info.colorHex}99`, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:'.9rem', fontWeight:700, color: DARK, overflowWrap:'anywhere' }}>{valor}</div>
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
function ModalReserva({ rifa, numeros: numerosRaw, onClose, onSuccess }) {
  // numerosRaw puede ser array de strings ["007","007"] o array de objetos [{numero:"007",idx:4},{numero:"007",idx:8}]
  // Normalizamos siempre a objetos para poder distinguir duplicados por idx
  const numerosObjs = Array.isArray(numerosRaw)
    ? numerosRaw.map((n, i) => typeof n === 'object' ? n : { numero: n, idx: i })
    : [];
  // Para mostrar y enviar como strings al servidor
  const numeros = numerosObjs.map(n => n.numero);

  const [step,       setStep]     = useState(1);
  const [form,       setForm]     = useState({ nombre:'', cedula:'', correo:'', codPais:'+58', telefono:'', metodo_pago:'' });
  const [imagen,     setImagen]   = useState(null);
  const [imgB64,     setImgB64]   = useState('');
  const [imgNombre,  setImgN]     = useState('');
  const [error,      setError]    = useState('');
  const [sending,    setSending]  = useState(false);
  const [reservaIds, setReservaIds] = useState([]);
  // WhatsApp del negocio (solo si está conectado) para el botón "Recibir mi ticket"
  const [waNegocio, setWaNegocio] = useState(null);
  useEffect(() => {
    fetch('https://rifasjordynb-production.up.railway.app/api/publico/whatsapp-negocio')
      .then(r => (r.ok ? r.json() : null)).then(d => setWaNegocio(d?.numero || null)).catch(() => {});
  }, []);
  const [conflictos, setConflictos] = useState([]);
  const [acepta,     setAcepta]   = useState(false);
  const fileRef = useRef();
  // Rifas con pago diferido: el cliente elige pagar ya o apartar y pagar después
  const puedeApartar = !!rifa.pago_diferido;
  const [modo,     setModo]     = useState('pagar');   // 'pagar' | 'apartar'
  const [apartado, setApartado] = useState(null);      // respuesta del servidor si apartó
  const apartar = puedeApartar && modo === 'apartar';

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
    if (apartar && form.telefono.replace(/\D/g,'').length < 7) { setError('Escribe tu WhatsApp: por ahí te recordamos el pago y te llega tu ticket'); return; }
    if (!apartar && !imgB64) { setError('El comprobante de pago es obligatorio'); return; }
    // Validar correo solo si fue ingresado
    if (form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) {
      setError('El correo electrónico no tiene un formato válido'); return;
    }
    if (!acepta) { setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad'); return; }
    setError(''); setSending(true);
    try {
      const r = await API.post('/publico/reservar', {
        rifa_id:            rifa.id,
        numeros,
        nombre_cliente:     form.nombre.trim(),
        cedula:             form.cedula.trim(),
        correo:             form.correo.trim() || undefined,
        telefono:           telefonoFull,
        ...(apartar
          ? { apartar: true }
          : { metodo_pago: form.metodo_pago, comprobante_base64: imgB64, comprobante_nombre: imgNombre }),
      });
      const ids = (r.data.reservas || [r.data.reserva]).map(rv => rv?.id).filter(Boolean);
      setApartado(r.data.apartado ? r.data : null);
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
      `RESUELVE TU SEMANA\n🎟 Número${numeros.length>1?'s':''}: ${numeros.join(' · ')}\n🏆 Premio: ${rifa?.premio}\n` +
      `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n👤 ${form.nombre}\n` +
      `💰 Total: ${fmt(totalReal)}${ofertaInfo ? ` (ahorraste ${fmt(ofertaInfo.ahorro)})` : ''}\n` +
      `🔖 Reserva: #${reservaIds[0]?.slice(0,8).toUpperCase()}\n✅ Número${numeros.length>1?'s bloqueados':'bloqueado'} pendiente${numeros.length>1?'s':''} de confirmación.`;
    if (navigator.share) {
      try { await navigator.share({ title:'Tu boleto — Resuelve tu Semana', text: texto }); } catch {}
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
            {`${apartar ? 'APARTAR' : 'COMPRAR'} ${numeros.length > 1 ? `${numeros.length} NÚMEROS` : 'NÚMERO'}`}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
            {numerosObjs.map((n, i) => (
              <span key={`${n.idx}-${i}`} style={{ background:'rgba(255,255,255,.22)', border:'1px solid rgba(255,255,255,.4)', color:'#fff', borderRadius:20, padding:'3px 12px', fontFamily:"'Poppins',sans-serif", fontSize:'1rem', fontWeight:900, letterSpacing:2 }}>{n.numero}</span>
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
                  {numerosObjs.map((n, i) => (
                    <span key={`${n.idx}-${i}`} style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, color:'#fff', borderRadius:10, padding:'5px 12px', fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:'1.1rem', letterSpacing:2 }}>{n.numero}</span>
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

              {/* Pagar ahora o apartar (solo en rifas con pago diferido) */}
              {puedeApartar && (
                <div className="modo-pago" role="radiogroup" aria-label="¿Cómo quieres hacerlo?">
                  <button type="button" role="radio" aria-checked={!apartar} className={!apartar ? 'on' : ''} onClick={() => { setModo('pagar'); setError(''); }}>
                    <b>💳 Pagar ahora</b>
                    <span>Subes el comprobante y recibes tu ticket al verificarlo.</span>
                  </button>
                  <button type="button" role="radio" aria-checked={apartar} className={apartar ? 'on morado' : ''} onClick={() => { setModo('apartar'); setError(''); }}>
                    <b>🔖 Apartar y pagar después</b>
                    <span>{rifa.pago_hasta_texto ? `Pagas hasta el ${rifa.pago_hasta_texto}` : 'Pagas antes del sorteo'}</span>
                  </button>
                </div>
              )}

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
                <label className="pub-label">WhatsApp / Teléfono{apartar && ' *'}</label>
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

              {apartar && (
                <div style={{ background:'rgba(124,58,237,.06)', border:'1.5px solid rgba(124,58,237,.25)', borderRadius:14, padding:'14px 16px', marginBottom:4, fontSize:'.84rem', color:DARK, lineHeight:1.6 }}>
                  <div style={{ fontWeight:800, color:'#6d28d9', marginBottom:4 }}>🔖 Así funciona el apartado</div>
                  Tu{numeros.length > 1 ? 's números quedan guardados' : ' número queda guardado'} a tu nombre sin pagar todavía.
                  Tienes hasta el <strong>{rifa.pago_hasta_texto || 'día del sorteo'}</strong> para pagar <strong>{fmt(totalReal)}</strong>.
                  Te lo recordamos por WhatsApp. Si no pagas a tiempo, {numeros.length > 1 ? 'se liberan' : 'se libera'}.
                </div>
              )}

              {!apartar && (<>
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
              </>)}

              <label style={{ display:'flex', gap:10, alignItems:'flex-start', marginTop:16, cursor:'pointer', fontSize:'.78rem', color:`${DARK}aa`, lineHeight:1.5 }}>
                <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)}
                  style={{ marginTop:3, width:16, height:16, accentColor:TURQ_DK, flexShrink:0 }} />
                <span>
                  Soy mayor de 18 años y acepto los{' '}
                  <Link to="/terminos" target="_blank" style={{ color:TURQ_DK, fontWeight:600 }}>Términos y Condiciones</Link>{' '}y la{' '}
                  <Link to="/privacidad" target="_blank" style={{ color:TURQ_DK, fontWeight:600 }}>Política de Privacidad</Link>,
                  incluido el tratamiento de mis datos para gestionar mi compra.
                </span>
              </label>

              {error && (
                <div style={{ background:'#fff0f0', border:'1px solid #ffcccc', borderRadius:8, padding:'8px 12px', marginTop:10, fontSize:'.78rem', color:'#c0392b', fontWeight:500 }}>⚠️ {error}</div>
              )}

              <div style={{ marginTop:16 }}>
                <button className="pub-btn" onClick={handleEnviar} disabled={sending}
                  style={{ width:'100%', justifyContent:'center', fontSize:'1rem', padding:'16px', borderRadius:14 }}>
                  {sending
                    ? <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⏳</span> Enviando...</>
                    : apartar
                      ? `🔖 Apartar ${numeros.length > 1 ? `${numeros.length} números` : 'mi número'} · pagar después`
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
                {apartado ? (numeros.length > 1 ? '¡Números apartados!' : '¡Número apartado!') : '¡Compra realizada con éxito!'}
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
                    {apartado ? (<>
                      Quedó guardado a tu nombre.{' '}
                      <strong style={{ color:TURQ_DK }}>Tienes hasta el {apartado.pago_hasta_texto} para pagar {fmt(totalReal)}.</strong>{' '}
                      Te lo recordaremos por WhatsApp; si no pagas a tiempo se libera.{' '}
                      Cuando pagues, tu ticket te llega por WhatsApp.
                    </>) : (<>
                    Su compra fue realizada con éxito.{' '}
                    <strong style={{ color:TURQ_DK }}>Atento a la aprobación de su número ganador.</strong>{' '}
                    Su ticket le llegará vía WhatsApp durante las próximas horas.{' '}
                    <strong style={{ color:TURQ_DK }}>¡Muchas gracias!</strong>
                    </>)}
                  </p>
                </div>
              </div>

              {/* Números reservados (resumen visual) */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:20 }}>
                {numerosObjs.filter(n => !conflictos.map(c=>c.numero).includes(n.numero)).map((n, i) => (
                  <span key={`${n.idx}-${i}`} style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, color:'#fff', borderRadius:12, padding:'7px 18px', fontWeight:900, fontSize:'1.2rem', letterSpacing:3, boxShadow:`0 4px 16px ${TURQ}44` }}>{n.numero}</span>
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
                {/* Que el cliente nos escriba primero: así su ticket llega al instante
                    y sin riesgo de bloqueo para el WhatsApp del negocio */}
                {waNegocio && (
                  <a href={`https://wa.me/${waNegocio}?text=${encodeURIComponent(
                      `Hola! Soy ${form.nombre.trim()}, reservé ${numerosObjs.filter(n => !conflictos.map(c=>c.numero).includes(n.numero)).map(n => n.numero).join(', ')} en ${rifa.nombre} (reserva #${(reservaIds[0] || '').slice(0,8).toUpperCase()}) 🎟️`
                    )}`}
                    target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', borderRadius:14, padding:'14px', background:'linear-gradient(135deg,#128c7e,#25d366)', color:'#fff', fontWeight:800, fontSize:'1rem', textDecoration:'none', boxShadow:'0 6px 20px rgba(37,211,102,.35)' }}>
                    <span style={{ fontSize:'1.3rem' }}>📲</span> {apartado ? 'Pagar ahora por WhatsApp' : 'Recibir mi ticket por WhatsApp'}
                  </a>
                )}
                {waNegocio && (
                  <div style={{ fontSize:'.74rem', color:'#6b9090', marginTop:-4, lineHeight:1.5 }}>
                    {apartado
                      ? 'Escríbenos con ese mensaje y te pasamos los datos de pago. También puedes pagar luego aquí mismo, en "Mis apartados".'
                      : 'Escríbenos con ese mensaje y tu ticket te llega por ahí apenas verifiquemos el pago.'}
                  </div>
                )}
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
   MIS APARTADOS — pagar los números que se apartaron sin pagar
   1) El cliente se identifica con su WhatsApp y cédula
   2) Ve sus números apartados y hasta cuándo puede pagar
   3) Elige el método, paga y sube el comprobante
═══════════════════════════════════════════════════════════ */
function ModalMisApartados({ onClose, onPagado }) {
  const [paso,     setPaso]     = useState('buscar');   // buscar | lista | pagar | listo
  const [form,     setForm]     = useState({ codPais:'+58', telefono:'', cedula:'' });
  const [grupos,   setGrupos]   = useState([]);
  const [sel,      setSel]      = useState(null);
  const [metodo,   setMetodo]   = useState('');
  const [modoPago, setModoPago] = useState('todo');     // 'todo' = lo que falta | 'abono' = una parte
  const [montoAbono, setMontoAbono] = useState('');
  const [mensajeOk, setMensajeOk] = useState('');
  const [imagen,   setImagen]   = useState(null);
  const [imgB64,   setImgB64]   = useState('');
  const [error,    setError]    = useState('');
  const [cargando, setCargando] = useState(false);
  const fileRef = useRef();
  const tasasHoy = useTasasHoy();
  const telefonoFull = form.codPais + form.telefono.replace(/\D/g,'');
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const buscar = async () => {
    if (form.telefono.replace(/\D/g,'').length < 7 || form.cedula.length < 5) { setError('Escribe el WhatsApp y la cédula con los que apartaste'); return; }
    setError(''); setCargando(true);
    try {
      const r = await API.get('/publico/apartados', { params: { telefono: telefonoFull, cedula: form.cedula } });
      setGrupos(r.data || []);
      setPaso('lista');
    } catch (e) { setError(e.response?.data?.error || 'No se pudo consultar, intenta de nuevo'); }
    finally { setCargando(false); }
  };

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError('La imagen debe ser menor a 8 MB'); return; }
    setError('');
    setImagen(URL.createObjectURL(f));
    const reader = new FileReader();
    reader.onload = ev => setImgB64(ev.target.result);
    reader.readAsDataURL(f);
  };

  // Lo que le falta por pagar (sin contar lo que ya envió y está por confirmarse)
  const faltaDe = (g) => Math.max((g?.saldo ?? g?.total ?? 0) - (g?.por_confirmar || 0), 0);
  const falta = faltaDe(sel);
  const abonoNum = Math.round(Number(String(montoAbono).replace(/\D/g, '')) || 0);
  const montoPago = modoPago === 'abono' ? Math.min(abonoNum, falta) : falta;

  const pagar = async () => {
    if (modoPago === 'abono' && !(abonoNum > 0)) { setError('Escribe cuánto vas a abonar'); return; }
    if (modoPago === 'abono' && abonoNum > falta) { setError(`Solo te faltan ${fmt(falta)}`); return; }
    if (!metodo) { setError('Elige con qué método pagaste'); return; }
    if (!imgB64) { setError('Sube la captura del comprobante'); return; }
    setError(''); setCargando(true);
    try {
      const r = await API.post('/publico/apartados/pagar', { rifa_id: sel.rifa_id, telefono: telefonoFull, cedula: form.cedula, metodo_pago: metodo, comprobante_base64: imgB64, monto: montoPago });
      setMensajeOk(r.data?.mensaje || '');
      setPaso('listo');
      onPagado?.();
    } catch (e) { setError(e.response?.data?.error || 'No se pudo registrar el pago, intenta de nuevo'); }
    finally { setCargando(false); }
  };

  const conv = sel && metodo && montoPago > 0 ? calcularPrecioMetodo(montoPago, metodo, tasasHoy?.bsdUsd ?? 0, tasasHoy?.copUsd ?? 4200) : null;
  const MORADO = '#7c3aed';

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(10,30,30,.65)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div role="dialog" aria-modal="true" aria-label="Mis números apartados"
        style={{ background:'#fff', borderRadius:24, width:'100%', maxWidth:500, maxHeight:'93vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(60,0,90,.3)', animation:'fadeUp .3s ease' }}>
        <div style={{ background:`linear-gradient(135deg,${MORADO},#a855f7)`, borderRadius:'24px 24px 0 0', padding:'22px 26px 20px', position:'relative' }}>
          <button onClick={onClose} aria-label="Cerrar" style={{ position:'absolute', top:14, right:18, background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:'1rem' }}>✕</button>
          <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.8)', letterSpacing:'1.5px', fontWeight:700, marginBottom:4 }}>🔖 MIS APARTADOS</div>
          <div style={{ fontSize:'1.25rem', color:'#fff', fontWeight:800 }}>
            {paso === 'pagar' ? `Pagar ${sel.numeros.length > 1 ? 'mis números' : 'mi número'}` : paso === 'listo' ? '¡Comprobante recibido!' : 'Paga o abona tus números apartados'}
          </div>
        </div>

        <div style={{ padding:'22px 26px 26px' }}>
          {paso === 'buscar' && (
            <div style={{ animation:'fadeUp .25s ease' }}>
              <p style={{ fontSize:'.86rem', color:`${DARK}99`, lineHeight:1.6, marginBottom:18 }}>
                Escribe el WhatsApp y la cédula con los que apartaste y te mostramos tus números.
              </p>
              <div style={{ marginBottom:14 }}>
                <label className="pub-label">WhatsApp</label>
                <div className="phone-row">
                  <select className="phone-select" value={form.codPais} onChange={e => upd('codPais', e.target.value)} aria-label="Código de país">
                    {PAISES.map(p => <option key={p.code} value={p.code}>{p.flag} {p.code}</option>)}
                  </select>
                  <input className="pub-input" value={form.telefono} onChange={e => upd('telefono', e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="Número sin código" type="tel" autoFocus />
                </div>
              </div>
              <div style={{ marginBottom:18 }}>
                <label className="pub-label">Cédula</label>
                <input className="pub-input" value={form.cedula} onChange={e => upd('cedula', e.target.value.replace(/\D/g,'').slice(0,15))} placeholder="Ej: 12345678" type="tel" inputMode="numeric"
                  onKeyDown={e => e.key === 'Enter' && buscar()} />
              </div>
            </div>
          )}

          {paso === 'lista' && (
            <div style={{ animation:'fadeUp .25s ease' }}>
              {grupos.length === 0 ? (
                <div style={{ textAlign:'center', padding:'10px 0 4px' }}>
                  <div style={{ fontSize:'2.4rem', marginBottom:8 }}>🔍</div>
                  <div style={{ fontSize:'1rem', fontWeight:800, color:DARK, marginBottom:6 }}>No tienes números apartados</div>
                  <p style={{ fontSize:'.84rem', color:`${DARK}88`, lineHeight:1.6 }}>
                    Con esos datos no hay apartados sin pagar. Puede que ya estén pagados o que se haya vencido el plazo.
                  </p>
                </div>
              ) : grupos.map(g => (
                <div key={g.rifa_id} style={{ border:'1.5px solid rgba(124,58,237,.25)', background:'rgba(124,58,237,.04)', borderRadius:16, padding:'14px 16px', marginBottom:12 }}>
                  <div style={{ fontSize:'1rem', fontWeight:800, color:DARK }}>{g.rifa}</div>
                  <div style={{ fontSize:'.78rem', color:`${DARK}88`, marginBottom:10 }}>🏆 {g.premio}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                    {g.numeros.map(n => <span key={n} style={{ background:`linear-gradient(135deg,${MORADO},#a855f7)`, color:'#fff', borderRadius:10, padding:'4px 12px', fontWeight:900, fontSize:'1rem', letterSpacing:2 }}>{n}</span>)}
                  </div>
                  {(g.abonado > 0 || g.por_confirmar > 0) && (
                    <div style={{ background:'#fff', border:'1px solid rgba(124,58,237,.18)', borderRadius:10, padding:'8px 12px', marginBottom:10, fontSize:'.78rem', color:`${DARK}cc`, lineHeight:1.7 }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}><span>Total</span><strong>{fmt(g.total)}</strong></div>
                      {g.abonado > 0 && <div style={{ display:'flex', justifyContent:'space-between', color:'#059669' }}><span>✅ Abonado</span><strong>− {fmt(g.abonado)}</strong></div>}
                      {g.por_confirmar > 0 && <div style={{ display:'flex', justifyContent:'space-between', color:'#b37700' }}><span>⏳ Abono por confirmar</span><strong>{fmt(g.por_confirmar)}</strong></div>}
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:'.62rem', fontWeight:700, color:`${DARK}77`, textTransform:'uppercase', letterSpacing:'.06em' }}>{g.abonado > 0 ? 'Te falta' : 'Total'}</div>
                      <div style={{ fontSize:'1.25rem', fontWeight:900, color:MORADO, lineHeight:1.1 }}>{fmt(g.saldo ?? g.total)}</div>
                      <div style={{ fontSize:'.7rem', color:`${DARK}88`, marginTop:2 }}>⏰ Hasta el {g.pago_hasta_texto}</div>
                    </div>
                    {faltaDe(g) > 0 ? (
                      <button className="pub-btn" onClick={() => { setSel(g); setMetodo(''); setModoPago('todo'); setMontoAbono(''); setImagen(null); setImgB64(''); setError(''); setPaso('pagar'); }}
                        style={{ padding:'11px 22px', background:`linear-gradient(135deg,${MORADO},#a855f7)`, boxShadow:'0 8px 20px rgba(124,58,237,.3)' }}>
                        Pagar o abonar
                      </button>
                    ) : (
                      <span style={{ fontSize:'.74rem', fontWeight:700, color:'#b37700', background:'#fff8e1', border:'1px solid #ffe082', borderRadius:20, padding:'6px 12px' }}>⏳ Pago en verificación</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {paso === 'pagar' && sel && (
            <div style={{ animation:'fadeUp .25s ease' }}>
              <div style={{ fontSize:'.84rem', color:`${DARK}99`, marginBottom:14, lineHeight:1.5 }}>
                <strong style={{ color:DARK }}>{sel.rifa}</strong> · número{sel.numeros.length > 1 ? 's' : ''} <strong style={{ color:MORADO }}>{sel.numeros.join(', ')}</strong>
              </div>
              {/* Pagar todo lo que falta o abonar una parte */}
              <div className="modo-pago" role="radiogroup" aria-label="¿Cuánto vas a pagar?">
                <button type="button" role="radio" aria-checked={modoPago === 'todo'} className={modoPago === 'todo' ? 'on morado' : ''} onClick={() => { setModoPago('todo'); setError(''); }}>
                  <b>💳 Pagar todo</b>
                  <span>{sel.abonado > 0 ? `Lo que te falta: ${fmt(falta)}` : fmt(falta)}</span>
                </button>
                <button type="button" role="radio" aria-checked={modoPago === 'abono'} className={modoPago === 'abono' ? 'on morado' : ''} onClick={() => { setModoPago('abono'); setError(''); }}>
                  <b>💵 Abonar una parte</b>
                  <span>Pagas algo ahora y el resto antes del sorteo.</span>
                </button>
              </div>
              {modoPago === 'abono' && (
                <div style={{ marginBottom:14 }}>
                  <label className="pub-label">¿Cuánto vas a abonar? (en pesos)</label>
                  <input className="pub-input" value={montoAbono} inputMode="numeric" type="tel" placeholder={`Ej: ${Math.round(falta / 3 / 1000) * 1000 || 10000}`}
                    onChange={e => setMontoAbono(e.target.value.replace(/\D/g, '').slice(0, 9))} />
                  {abonoNum > 0 && abonoNum < falta && (
                    <div style={{ fontSize:'.74rem', color:MORADO, fontWeight:600, marginTop:5 }}>Después de este abono te quedarían {fmt(falta - abonoNum)}.</div>
                  )}
                </div>
              )}
              <label className="pub-label">¿Cómo vas a pagar?</label>
              <select className="pub-input" value={metodo} onChange={e => setMetodo(e.target.value)} style={{ cursor:'pointer' }}>
                <option value="">Selecciona un método...</option>
                {Object.keys(METODOS_PAGO).map(m => <option key={m}>{m}</option>)}
              </select>
              {metodo && montoPago > 0 && (
                <div style={{ marginTop:12, borderRadius:14, padding:'14px 18px', background:'rgba(124,58,237,.06)', border:'2px solid rgba(124,58,237,.22)' }}>
                  <div style={{ fontSize:'.6rem', fontWeight:700, color:MORADO, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>{modoPago === 'abono' ? 'Tu abono: paga exactamente' : 'Debes pagar exactamente'}</div>
                  <div style={{ fontSize:'1.7rem', fontWeight:900, color:MORADO, lineHeight:1.1 }}>{conv ? conv.texto : fmt(montoPago)}</div>
                  {conv && <div style={{ fontSize:'.7rem', color:`${DARK}77`, marginTop:3 }}>≈ {fmt(montoPago)}</div>}
                </div>
              )}
              {metodo && <PagoInlineCard metodo={metodo} />}

              <div style={{ fontSize:'.78rem', color:MORADO, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', margin:'20px 0 10px' }}>Comprobante de pago</div>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${imgB64 ? MORADO : '#d5c8ee'}`, borderRadius:16, padding:'18px 14px', textAlign:'center', cursor:'pointer', background: imgB64 ? 'rgba(124,58,237,.05)' : '#fbf9ff' }}>
                {imagen ? (
                  <>
                    <img src={imagen} alt="Comprobante" style={{ maxWidth:'100%', maxHeight:170, objectFit:'contain', borderRadius:10, display:'block', margin:'0 auto 8px' }} />
                    <div style={{ fontSize:'.68rem', color:`${DARK}66` }}>Toca para cambiar</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:'2rem', marginBottom:6, opacity:.6 }}>📸</div>
                    <div style={{ fontSize:'.88rem', color:`${DARK}77`, fontWeight:600 }}>Toca aquí para subir el comprobante</div>
                    <div style={{ fontSize:'.7rem', color:'#aaa', marginTop:4 }}>JPG · PNG · WEBP · máx 8 MB</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleFile} style={{ display:'none' }} />
              </div>
            </div>
          )}

          {paso === 'listo' && (
            <div style={{ textAlign:'center', animation:'fadeUp .25s ease' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:`linear-gradient(135deg,${TURQ},${TURQ2})`, margin:'0 auto 18px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.3rem' }}>✅</div>
              <p style={{ fontSize:'.98rem', color:DARK, lineHeight:1.7, marginBottom:6 }}>
                {mensajeOk || <>Recibimos el comprobante de {sel?.numeros.length > 1 ? 'tus números' : 'tu número'} <strong style={{ color:TURQ_DK }}>{sel?.numeros.join(', ')}</strong>.
                Apenas verifiquemos el pago, <strong style={{ color:TURQ_DK }}>tu ticket te llega por WhatsApp</strong>. ¡Mucha suerte! 🍀</>}
              </p>
            </div>
          )}

          {error && (
            <div style={{ background:'#fff0f0', border:'1px solid #ffcccc', borderRadius:8, padding:'8px 12px', marginTop:12, fontSize:'.78rem', color:'#c0392b', fontWeight:500 }}>⚠️ {error}</div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            {(paso === 'lista' || paso === 'pagar') && (
              <button className="pub-btn-outline" onClick={() => { setError(''); setPaso(paso === 'pagar' ? 'lista' : 'buscar'); }} style={{ flex:'0 0 auto', borderRadius:14, padding:'13px 20px' }}>← Volver</button>
            )}
            {paso === 'buscar' && (
              <button className="pub-btn" onClick={buscar} disabled={cargando} style={{ flex:1, justifyContent:'center', borderRadius:14, padding:'15px', background:`linear-gradient(135deg,${MORADO},#a855f7)`, boxShadow:'0 8px 20px rgba(124,58,237,.3)' }}>
                {cargando ? 'Buscando...' : '🔎 Ver mis números'}
              </button>
            )}
            {paso === 'pagar' && (
              <button className="pub-btn" onClick={pagar} disabled={cargando} style={{ flex:1, justifyContent:'center', borderRadius:14, padding:'15px' }}>
                {cargando ? 'Enviando...' : '✅ Enviar comprobante'}
              </button>
            )}
            {(paso === 'listo' || (paso === 'lista' && grupos.length === 0)) && (
              <button className="pub-btn-outline" onClick={onClose} style={{ flex:1, justifyContent:'center', borderRadius:14, padding:'13px' }}>Cerrar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BUSCADOR DE NÚMEROS — Rifas de 4 cifras (0000–9999)
   Sin cuadrícula: el cliente busca un número, ve si está libre
   y lo agrega al carrito. Reutiliza ModalReserva, ofertas y carrito.
═══════════════════════════════════════════════════════════ */
function BuscadorNumeros4({ rifa, onComprar }) {
  const cifras   = Number(rifa.cifras) || 4;
  const ofertas  = rifa.ofertas || [];
  const maxNum   = '9'.repeat(cifras);

  const [valor,    setValor]    = useState('');
  const [cargando, setCargando] = useState(false);
  const [res,      setRes]      = useState(null);   // { numero, estado }
  const [errorMsg, setErrorMsg] = useState('');
  const [sel,      setSel]      = useState([]);     // [{ numero, idx }]
  const idxRef = useRef(1);

  const numNorm  = valor.replace(/\D/g, '').slice(0, cifras);
  const completo = numNorm.length === cifras;

  const buscar = async () => {
    if (!completo) { setErrorMsg(`Escribe los ${cifras} dígitos`); return; }
    setCargando(true); setErrorMsg(''); setRes(null);
    try {
      const { data } = await API.get(`/publico/rifas/${rifa.id}/numero/${numNorm}`);
      setRes(data);
    } catch (e) {
      setErrorMsg(e?.response?.data?.error || 'No se pudo consultar el número');
    } finally { setCargando(false); }
  };

  const agregar = (numero) => {
    if (sel.some(s => s.numero === numero)) return;
    setSel(prev => [...prev, { numero, idx: idxRef.current++ }]);
  };
  const quitar  = (idx) => setSel(prev => prev.filter(s => s.idx !== idx));
  const limpiar = () => setSel([]);

  const yaEnCarrito = res && sel.some(s => s.numero === res.numero);

  const ofertaInfo  = calcularOferta(sel.length, ofertas, rifa.precio);
  const sugerencia  = !ofertaInfo ? siguienteOferta(sel.length, ofertas, rifa.precio) : null;
  const totalNormal = rifa.precio * sel.length;
  const totalReal   = ofertaInfo ? ofertaInfo.totalConOferta : totalNormal;

  const EST = {
    disponible: { txt:'¡Está libre!',   sub:'Este número está disponible para ti',  color:VERDE,     icon:'🎯', puede:true  },
    reservado:  { txt:'Apartado',       sub:'Alguien lo está reservando ahora mismo',color:'#f0a500', icon:'⏳', puede:false },
    vendido_1:  { txt:'Ya tiene dueño', sub:'Este número ya fue vendido',            color:'#e63946', icon:'🔒', puede:false },
    agotado:    { txt:'No disponible',  sub:'Este número ya no está disponible',     color:'#e63946', icon:'🔒', puede:false },
  };
  const info = res ? (EST[res.estado] || EST.agotado) : null;

  return (
    <div>
      <style>{`
        @keyframes b4pulse { 0%,100%{box-shadow:0 0 0 0 ${TURQ}55} 50%{box-shadow:0 0 0 14px ${TURQ}00} }
        @keyframes b4pop   { 0%{transform:scale(.85);opacity:0} 100%{transform:scale(1);opacity:1} }
        .b4-digit-box{width:100%;text-align:center;letter-spacing:.5em;font-family:'Poppins',sans-serif;
          font-weight:900;font-size:2.6rem;color:#fff;background:rgba(255,255,255,.06);
          border:2px solid rgba(255,255,255,.18);border-radius:16px;padding:16px 10px;outline:none;
          transition:all .2s}
        .b4-digit-box:focus{border-color:${TURQ};background:rgba(10,191,188,.12)}
        @media(max-width:640px){.b4-digit-box{font-size:2rem;letter-spacing:.35em}}
      `}</style>

      {ofertas.length > 0 && <BannerOfertas ofertas={ofertas} precioUnitario={rifa.precio} />}

      {/* ── Hero buscador ── */}
      <div style={{
        background:`linear-gradient(135deg,${DARK},#0d2424)`,
        borderRadius:24, padding:'30px 24px', marginBottom:20, position:'relative', overflow:'hidden',
        boxShadow:`0 20px 60px rgba(0,0,0,.25)`,
      }}>
        <div style={{ position:'absolute', top:-50, right:-40, width:160, height:160, borderRadius:'50%', background:`${TURQ}14`, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, left:-30, width:140, height:140, borderRadius:'50%', background:`${NARANJA}10`, pointerEvents:'none' }}/>

        <div style={{ textAlign:'center', marginBottom:20, position:'relative' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TURQ}1f`, border:`1px solid ${TURQ}44`, borderRadius:999, padding:'5px 14px', marginBottom:12 }}>
            <span style={{ fontSize:'.9rem' }}>🍀</span>
            <span style={{ fontSize:'.7rem', color:TURQ2, fontWeight:800, letterSpacing:'1px', textTransform:'uppercase' }}>Rifa de {cifras} cifras · 0000 – {maxNum}</span>
          </div>
          <div style={{ fontSize:'1.5rem', color:'#fff', fontWeight:900, letterSpacing:'.5px', lineHeight:1.2 }}>
            Busca tu número de la suerte
          </div>
          <div style={{ fontSize:'.82rem', color:'rgba(255,255,255,.55)', marginTop:6 }}>
            Escribe el número que quieres y mira si está libre
          </div>
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'stretch', position:'relative', maxWidth:420, margin:'0 auto' }}>
          <input
            inputMode="numeric" value={numNorm} autoFocus
            onChange={e => { setValor(e.target.value); setRes(null); setErrorMsg(''); }}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder={'0'.repeat(cifras)} maxLength={cifras}
            className="b4-digit-box" style={{ flex:1 }}
          />
          <button
            onClick={buscar} disabled={!completo || cargando}
            style={{
              flexShrink:0, padding:'0 22px', borderRadius:16, border:'none',
              fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:'1rem', color:'#fff',
              background: completo ? `linear-gradient(135deg,${TURQ},${TURQ2})` : 'rgba(255,255,255,.1)',
              cursor: completo ? 'pointer' : 'not-allowed',
              boxShadow: completo ? `0 8px 24px ${TURQ}55` : 'none',
              animation: completo && !res ? 'b4pulse 1.6s infinite' : 'none', transition:'all .2s',
            }}>
            {cargando ? '···' : '🔍'}
          </button>
        </div>

        {errorMsg && <div style={{ color:'#ff9b9b', textAlign:'center', marginTop:12, fontSize:'.82rem', fontWeight:600, position:'relative' }}>{errorMsg}</div>}

        {/* ── Resultado ── */}
        {res && info && (
          <div style={{
            marginTop:22, padding:'22px', borderRadius:20, textAlign:'center', position:'relative',
            background:`${info.color}12`, border:`2px solid ${info.color}55`, animation:'b4pop .25s ease',
          }}>
            <div style={{ fontSize:'.62rem', color:'rgba(255,255,255,.5)', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', marginBottom:6 }}>Número</div>
            <div style={{ fontSize:'3.2rem', fontFamily:"'Poppins',sans-serif", fontWeight:900, color:'#fff', letterSpacing:'.12em', lineHeight:1 }}>
              {res.numero}
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12, background:`${info.color}22`, border:`1px solid ${info.color}66`, borderRadius:999, padding:'7px 16px' }}>
              <span style={{ fontSize:'1.1rem' }}>{info.icon}</span>
              <span style={{ color:'#fff', fontWeight:800, fontSize:'.92rem' }}>{info.txt}</span>
            </div>
            <div style={{ fontSize:'.78rem', color:'rgba(255,255,255,.6)', marginTop:8 }}>{info.sub}</div>

            {info.puede && !yaEnCarrito && (
              <button onClick={() => agregar(res.numero)}
                style={{
                  marginTop:18, width:'100%', maxWidth:340, padding:'14px 20px', borderRadius:14, border:'none',
                  background:`linear-gradient(135deg,${VERDE},#16a34a)`, color:'#fff',
                  fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:'1rem', cursor:'pointer',
                  boxShadow:`0 8px 24px ${VERDE}55`, letterSpacing:'.5px',
                }}>
                🎟 ¡Lo quiero! Agregar {res.numero}
              </button>
            )}
            {yaEnCarrito && (
              <div style={{ marginTop:16, color:VERDE, fontWeight:800, fontSize:'.9rem' }}>
                ✓ Ya está en tu carrito
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Chips de selección ── */}
      {sel.length > 0 && (
        <div style={{ background:'#f0fafa', border:`1.5px solid ${TURQ}33`, borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
          <div style={{ fontSize:'.65rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
            Tus números ({sel.length}):
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {sel.map(n => (
              <span key={n.idx} className="num-chip">
                {n.numero}
                <button className="num-chip-remove" onClick={() => quitar(n.idx)} title={`Quitar ${n.numero}`}>✕</button>
              </span>
            ))}
            <button onClick={limpiar}
              style={{ background:'none', border:`1px solid #ffaaaa`, color:'#c0392b', borderRadius:20, padding:'4px 10px', fontSize:'.68rem', fontWeight:600, cursor:'pointer' }}>
              Limpiar todo
            </button>
          </div>
        </div>
      )}

      {/* ── Carrito flotante (idéntico al de la cuadrícula) ── */}
      {sel.length > 0 && (
        <div className="carrito-bar">
          <div style={{
            background:`linear-gradient(135deg,${DARK},#0d2424)`,
            borderRadius:20, padding:'14px 20px',
            boxShadow:`0 -4px 32px rgba(0,0,0,.2), 0 12px 40px ${TURQ}44`,
            border: ofertaInfo ? `1.5px solid ${VERDE}55` : 'none',
          }}>
            {sugerencia && (
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
            {ofertaInfo && (
              <BloqueOfertaAplicada ofertaInfo={ofertaInfo} cantidad={sel.length} precioUnitario={rifa.precio} compact />
            )}
            {ofertaInfo && <div style={{ height:10 }}></div>}

            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'.62rem', color:'rgba(255,255,255,.55)', fontWeight:600, marginBottom:2 }}>
                  {sel.length} número{sel.length>1?'s':''} seleccionado{sel.length>1?'s':''}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {sel.slice(0, 8).map(n => (
                    <span key={n.idx} style={{ background:'rgba(255,255,255,.15)', color:'#fff', borderRadius:6, padding:'2px 7px', fontSize:'.72rem', fontWeight:800, letterSpacing:1 }}>{n.numero}</span>
                  ))}
                  {sel.length > 8 && <span style={{ color:'rgba(255,255,255,.5)', fontSize:'.72rem', alignSelf:'center' }}>+{sel.length-8} más</span>}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'.55rem', color:'rgba(255,255,255,.45)', textTransform:'uppercase', letterSpacing:'1px' }}>Total</div>
                {ofertaInfo && (
                  <div style={{ fontSize:'.68rem', color:'rgba(255,255,255,.3)', textDecoration:'line-through' }}>{fmt(totalNormal)}</div>
                )}
                <div style={{ fontSize:'1.2rem', color: ofertaInfo ? VERDE : '#fff', fontWeight:900 }}>{fmt(totalReal)}</div>
              </div>
              <button className="pub-btn" onClick={() => onComprar(sel)}
                style={{ flexShrink:0, borderRadius:14, padding:'12px 22px', fontSize:'.9rem', boxShadow:`0 8px 24px ${TURQ}55` }}>
                🎟 {sel.length > 1 ? `Comprar ${sel.length} números` : 'Comprar número'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GridNumeros({ rifa, onComprar }) {
  // 2 cifras = terminal (00–99) · 3 cifras = 000–999
  const cifras    = Number(rifa.cifras) || 3;
  const totalNums = 10 ** cifras;
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
  // Contadores: usar números únicos para no doblar el total en simultánea
  const numerosUnicos      = [...new Set(todos.map(n => n.numero))];
  const numerosDisponibles = [...new Set(disponibles.map(n => n.numero))];
  const tomados            = numerosUnicos.length - numerosDisponibles.length;
  const pct                = numerosUnicos.length > 0 ? Math.round((tomados / numerosUnicos.length) * 100) : 0;

  // En búsqueda mostramos todos los estados del número para informar al cliente
  const visible = busqueda
    ? todos.filter(n => n.numero === busqueda.padStart(cifras,'0').slice(-cifras))
    : disponibles;

  // seleccion guarda idx (numero unico por entrada), no el numero en si
  // Asi el 264 duplicado en simultanea puede seleccionarse de forma independiente
  const toggleNumero = (idx) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
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
    const picks = []; // objetos {numero, idx}
    for (let i = 0; i < cant; i++) {
      const j = Math.floor(Math.random() * (arr.length - i)) + i;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      picks.push(arr[i]);
    }

    // Fase 1: animación "rolling" (300ms)
    setQpRolling(true);
    setQpResultado([]);
    setQpVisible(0);

    setTimeout(() => {
      // Fase 2: mostrar números uno a uno
      setQpRolling(false);
      setQpResultado(picks.map(p => p.numero)); // solo el numero para mostrar
      setSeleccion(new Set(picks.map(p => p.idx))); // seleccion por idx

      // Revelar de a uno cada 120ms
      picks.forEach((_, i) => {
        setTimeout(() => setQpVisible(i + 1), i * 120);
      });
    }, 700);
  };

  // selArr: objetos {numero, idx} seleccionados, ordenados por numero
  const selArr = todos.filter(n => seleccion.has(n.idx)).sort((a,b) => a.numero.localeCompare(b.numero));
  // selNums: solo los numeros para enviar al servidor y mostrar
  const selNums = selArr.map(n => n.numero);

  // Cálculo de oferta activa y sugerencia
  const ofertaInfo  = calcularOferta(selArr.length, ofertas, rifa.precio);
  const sugerencia  = !ofertaInfo ? siguienteOferta(selArr.length, ofertas, rifa.precio) : null;
  const totalNormal = rifa.precio * selNums.length;
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
              <span style={{ color:TURQ, fontWeight:800, fontSize:'.88rem' }}>{disponibles.length}</span> disponibles de {totalNums}
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
        <input className="pub-input" value={busqueda} onChange={e => setBusqueda(e.target.value.replace(/\D/,'').slice(0,cifras))}
          placeholder={`Buscar número (ej: ${cifras === 2 ? '07' : '007'})`} style={{ paddingLeft:44 }} maxLength={cifras} />
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
              <span key={n.idx} className="num-chip">
                {n.numero}
                <button className="num-chip-remove" onClick={() => toggleNumero(n.idx)} title={`Quitar ${n.numero}`}>✕</button>
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
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(64px,1fr))', gap:6 }}>
            {visible.map(n => {
              // Estados especiales que solo aparecen en búsqueda
              if (n.estado === 'vendido_serie') {
                return (
                  <div key={n.idx ?? `vs-${n.numero}-${n.serie_vendida}`}
                    className="num-cell vendido"
                    style={{ cursor:'default', pointerEvents:'none', flexDirection:'column', gap:2 }}
                    title={`Número ${n.numero} Serie ${n.serie_vendida} — Vendido`}>
                    <span style={{ fontSize:'.75rem', fontWeight:900 }}>{n.numero}</span>
                    <span style={{ fontSize:'.5rem', fontWeight:700, opacity:.75, letterSpacing:1 }}>SERIE {n.serie_vendida} ✓</span>
                  </div>
                );
              }
              if (n.estado === 'reservado') {
                return (
                  <div key={n.idx ?? `res-${n.numero}`}
                    className="num-cell apartado"
                    style={{ cursor:'default', pointerEvents:'none' }}
                    title={`Número ${n.numero} — Apartado`}>
                    {n.numero}
                  </div>
                );
              }
              if (n.estado === 'agotado') {
                return (
                  <div key={n.idx ?? `ag-${n.numero}`}
                    className="num-cell vendido"
                    style={{ cursor:'default', pointerEvents:'none' }}
                    title={`Número ${n.numero} — Agotado`}>
                    {n.numero}
                  </div>
                );
              }
              // Disponible normal
              return (
                <div key={n.idx}
                  className={`num-cell ${seleccion.has(n.idx) ? 'seleccionado' : 'disponible'}`}
                  onClick={() => toggleNumero(n.idx)}
                  title={seleccion.has(n.idx) ? `Quitar ${n.numero}` : `Seleccionar ${n.numero}`}>
                  {n.numero}
                </div>
              );
            })}
            {visible.length === 0 && busqueda && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:36, color:'#aaa', fontSize:'.88rem' }}>
                El número <strong>{busqueda.padStart(cifras,'0')}</strong> no está disponible en este momento
              </div>
            )}
          </div>
          <div style={{ fontSize:'.65rem', color:`${DARK}44`, textAlign:'center', marginTop:10 }}>
            {busqueda
              ? `Resultado para "${busqueda.padStart(cifras,'0')}"`
              : `Mostrando ${visible.length} número${visible.length !== 1 ? 's' : ''} disponible${visible.length !== 1 ? 's' : ''}`}
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
                    <span key={n.idx} style={{ background:'rgba(255,255,255,.15)', color:'#fff', borderRadius:6, padding:'2px 7px', fontSize:'.72rem', fontWeight:800, letterSpacing:1 }}>{n.numero}</span>
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
   CARD DE RIFA — con badge OFERTA, countdown y barra real
═══════════════════════════════════════════════════════════ */
function RifaCard({ rifa, onSeleccionar, refreshKey = 0 }) {
  const [imgError, setImgError] = useState(false);
  const cd = useCountdown(rifa.datetime_sorteo || rifa.fecha_sorteo);
  const progreso = useRifaProgress(rifa.id, refreshKey);
  const pct = Math.min(100, progreso.pct);
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
    <div style={{ background:'#fff', borderRadius:24, overflow:'hidden', boxShadow:'0 4px 24px rgba(10,100,100,.08)', transition:'transform .2s, box-shadow .2s', position:'relative', display:'flex', flexDirection:'column', height:'100%' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow=`0 16px 48px rgba(10,180,180,.15)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 24px rgba(10,100,100,.08)'; }}>

      <div className={`rifa-card-img-caja${tieneImagen ? ' con-imagen' : ''}`} style={{ position:'relative', height:220, overflow:'hidden', background:`linear-gradient(135deg,${TURQ}22,${TURQ2}33)` }}>
        {tieneImagen ? (
          <>
            {/* Fondo borroso para rellenar (efecto cinema) */}
            <div style={{
              position:'absolute', inset:0,
              background:`url(${rifa.imagen_url}) center/cover no-repeat`,
              filter:'blur(24px) brightness(.7)',
              transform:'scale(1.15)',
            }}></div>
            {/* Imagen completa encima del fondo borroso */}
            <img
              className="rifa-card-img"
              src={rifa.imagen_url}
              alt={rifa.nombre}
              onError={() => setImgError(true)}
              style={{
                position:'absolute', inset:0,
                width:'100%', height:'100%',
                objectFit:'contain',
                display:'block',
              }}
            />
          </>
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:8 }}>🎰</div>
            <div style={{ fontSize:'.75rem', color:TURQ_DK, fontWeight:600 }}>{rifa.premio}</div>
          </div>
        )}

        {/* Badge OFERTA sobre la imagen */}
        {tieneOfertas && (
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6, flexDirection:'column', alignItems:'flex-start', zIndex:2 }}>
            <span className="badge-oferta">🏷️ OFERTA</span>
            {mejorOferta && (
              <span style={{ background:'rgba(0,0,0,.7)', color:'#fff', borderRadius:20, padding:'2px 9px', fontSize:'.55rem', fontWeight:700, backdropFilter:'blur(4px)' }}>
                Hasta -{mejorPct}% en packs
              </span>
            )}
          </div>
        )}

        <div style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,.95)', borderRadius:50, padding:'6px 14px', backdropFilter:'blur(8px)', boxShadow:'0 4px 16px rgba(0,0,0,.1)', zIndex:2 }}>
          <span style={{ fontSize:'.72rem', color:TURQ_DK, fontWeight:700 }}>{fmt(rifa.precio)}</span>
        </div>
      </div>

      <div style={{ padding:'18px 22px 22px', flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:'.55rem', color:`${TURQ}99`, letterSpacing:'0.5px', marginBottom:5 }}>{rifa.loteria_ref || 'SORTEO'} · {fmtF(rifa.fecha_sorteo)}</div>
        <div style={{ fontSize:'1.3rem', color:DARK, lineHeight:1.2, marginBottom:7, fontWeight:700 }}>{rifa.nombre}</div>
        <div style={{ fontSize:'.88rem', color:`${DARK}77`, marginBottom: tieneOfertas ? 10 : 14, display:'flex', alignItems:'center', gap:5 }}>🏆 <span style={{ fontWeight:600, color:DARK }}>{rifa.premio}</span></div>
        {tienePremiosExtra(rifa) && (
          <div style={{ fontSize:'.76rem', color:'#b8860b', fontWeight:700, background:'#fff8e1', border:'1px solid #ffe082', borderRadius:10, padding:'6px 10px', marginTop:-4, marginBottom:12, lineHeight:1.5 }}>
            {rifa.premio_segundo && <div>🥈 {rifa.premio_segundo}</div>}
            {rifa.premio_tercero && <div>🥉 {rifa.premio_tercero}</div>}
            {especialesDe(rifa).length > 0 && <div>🎁 {especialesDe(rifa).map(p => p.nombre).join(' · ')}</div>}
          </div>
        )}
        {rifa.pago_diferido && <div style={{ marginBottom:12 }}><EtiquetaApartado rifa={rifa} estilo={{ display:'inline-block' }} /></div>}

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
          {/* ── Cuenta regresiva en cada rifa secundaria ── */}
          {rifa.fecha_sorteo && !cd.expired && !cd.invalid && (
            <div style={{
              background:`linear-gradient(135deg,${DARK},#0d2424)`,
              borderRadius:10, padding:'8px 10px', marginBottom:10,
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
            }}>
              <span style={{ fontSize:'.5rem', color:'rgba(255,255,255,.55)', letterSpacing:'1.5px', textTransform:'uppercase', fontWeight:700 }}>⏳ Faltan</span>
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                {[
                  { v:cd.dias,    l:'d' },
                  { v:cd.horas,   l:'h' },
                  { v:cd.minutos, l:'m' },
                  { v:cd.segundos,l:'s' },
                ].map((u, i, arr) => (
                  <React.Fragment key={u.l}>
                    <span style={{ display:'inline-flex', alignItems:'baseline', gap:1 }}>
                      <span style={{ fontSize:'.85rem', color:'#fff', fontWeight:900, fontVariantNumeric:'tabular-nums' }}>{String(u.v).padStart(2,'0')}</span>
                      <span style={{ fontSize:'.5rem', color:TURQ, fontWeight:700 }}>{u.l}</span>
                    </span>
                    {i < arr.length - 1 && <span style={{ color:'rgba(255,255,255,.3)', fontSize:'.7rem' }}>·</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          {cd.expired && !cd.invalid && (
            <div style={{ background:'#fff0f0', border:'1px solid #ffcaca', color:'#c0392b', borderRadius:10, padding:'5px 10px', marginBottom:10, fontSize:'.6rem', fontWeight:700, textAlign:'center', letterSpacing:'1px', textTransform:'uppercase' }}>
              🔴 Sorteo finalizado
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
            <span style={{ fontSize:'.62rem', color:`${DARK}88`, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>
              🎟 Progreso
            </span>
            <span style={{ fontSize:'.95rem', color:TURQ_DK, fontWeight:900 }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ background:'#e8f5f5', borderRadius:8, height:10, overflow:'hidden', border:`1px solid ${TURQ}22` }}>
            <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${TURQ},${TURQ2})`, borderRadius:8, transition:'width 1s ease', boxShadow:`0 0 10px ${TURQ}66` }}></div>
          </div>
        </div>
        <button className="pub-btn" onClick={() => onSeleccionar(rifa)} style={{ width:'100%', justifyContent:'center', borderRadius:14, marginTop:'auto' }}>
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
  const [ganadores,  setGanadores]  = useState([]);
  const gridRef = useRef();
  useMetodosPagoServidor();

  /* ── Galería de ganadores (los carga el dueño en Configuración) ── */
  useEffect(() => {
    API.get('/ganadores').then(r => setGanadores(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  /* ── Grupo de WhatsApp y top de compradores (se configuran en el panel) ── */
  const [verApartados, setVerApartados] = useState(false);
  /* ── Resultados publicados (imágenes que sube el dueño en el panel) ── */
  const [resultados, setResultados] = useState([]);
  useEffect(() => {
    API.get('/resultados').then(r => setResultados(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  const [sitio, setSitio] = useState({ grupo_whatsapp: null, top_compradores: [] });
  useEffect(() => {
    API.get('/sitio').then(r => setSitio({ grupo_whatsapp: r.data?.grupo_whatsapp || null, top_compradores: r.data?.top_compradores || [] })).catch(() => {});
  }, [refreshKey]);

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

  /* ─────────────────────────────────────────────────────────────
     ORDENAR RIFAS POR CUENTA REGRESIVA (más próximas primero)
     - Las rifas con fecha de sorteo más cercana al ahora son las
       principales: rifaHero es la más próxima.
     - Las que ya pasaron (sorteo finalizado) van al final.
     - Las que no tienen fecha válida también van al final.
  ───────────────────────────────────────────────────────────── */
  const ahora = Date.now();
  const rifasActivasOrdenadas = [...rifas]
    .filter(r => r.activa)
    .map(r => {
      const d = parseSorteo(r);
      const t = d ? d.getTime() : null;
      return { rifa: r, t, expirada: t != null && t <= ahora };
    })
    .sort((a, b) => {
      // 1) Las activas (no expiradas y con fecha) primero, ordenadas por fecha asc
      // 2) Después las expiradas, ordenadas por fecha desc (más reciente primero)
      // 3) Por último las que no tienen fecha
      if (a.t == null && b.t == null) return 0;
      if (a.t == null) return 1;
      if (b.t == null) return -1;
      if (a.expirada && !b.expirada) return 1;
      if (!a.expirada && b.expirada) return -1;
      if (a.expirada && b.expirada) return b.t - a.t;
      return a.t - b.t; // ambas activas → más próxima primero
    })
    .map(x => x.rifa);

  // Alguna rifa trabaja con apartados: se muestra dónde pagarlos
  const hayApartados     = rifas.some(r => r.rifa_con_apartado);
  const rifaHero         = rifasActivasOrdenadas[0] || null;
  const rifasSecundarias = rifasActivasOrdenadas.slice(1);

  /* ── Scroll al click en el link "Rifas" del nav ── */
  const scrollToRifas = (e) => {
    e.preventDefault();
    // Prioridad: 1) rifa actual (hero) → 2) otras rifas → 3) tope de la página
    const sec = document.getElementById('hero-sec') || document.getElementById('rifas-sec');
    if (sec) sec.scrollIntoView({ behavior:'smooth', block:'start' });
    else window.scrollTo({ top:0, behavior:'smooth' });
  };

  return (
    <div className="pub-pagina">
      {/* Manchas de color de fondo (decorativas) */}
      <div className="pub-fondo" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

      <nav className="pub-nav">
        <a href="#hero-sec" onClick={scrollToRifas} className="pub-marca">
          <img className="pub-marca-img" src={`${process.env.PUBLIC_URL}/logo-resuelve.png`} alt="Resuelve tu Semana" width="640" height="266" />
        </a>
        <div className="pub-nav-links" style={{ display:'flex', gap:22, alignItems:'center' }}>
          <a href="#rifas-sec" onClick={scrollToRifas} className="nav-link nav-solo-escritorio">Rifas</a>
          {resultados.length > 0 && <a href="#resultados-sec" className="nav-link">Resultados</a>}
          {ganadores.length > 0 && <a href="#ganadores-sec" className="nav-link">Ganadores</a>}
          <a href="#pagos-sec" className="nav-link nav-solo-escritorio">Pagos</a>
          <a href="#contacto-sec" className="nav-link nav-solo-escritorio">Contacto</a>
          {hayApartados && <button className="pub-nav-btn" onClick={() => setVerApartados(true)}>🔖 <span className="nav-solo-escritorio">Mis </span>Apartados</button>}
        </div>
      </nav>

      {/* Presentación */}
      <header className="pub-intro">
        <span className="pub-intro-chip"><b></b> {rifasActivasOrdenadas.length > 1 ? `${rifasActivasOrdenadas.length} rifas activas ahora` : 'Sorteos todas las semanas'}</span>
        <h1>Tu número de la suerte <span>te está esperando</span></h1>
        <p>Elige tu número, paga fácil desde tu teléfono y recibe tu ticket por WhatsApp. Así de simple.</p>
        <div className="pub-sellos">
          <span className="pub-sello"><i>✓</i> Sorteos con lotería oficial</span>
          <span className="pub-sello"><i>✓</i> Ticket por WhatsApp</span>
          <span className="pub-sello"><i>✓</i> Pagos verificados</span>
          {hayApartados && <span className="pub-sello"><i>✓</i> Aparta y paga después</span>}
        </div>
      </header>

      {loading ? (
        <div style={{ padding:'5vw', maxWidth:1100, margin:'0 auto' }}>
          <div className="shimmer" style={{ height:520, borderRadius:28 }}></div>
        </div>
      ) : rifaHero ? (
        <section id="hero-sec" style={{ padding:'32px 5vw 0', maxWidth:1100, margin:'0 auto', scrollMarginTop:64 }}>
          <HeroRifaPrincipal rifa={rifaHero} onVerNumeros={handleSelRifa} refreshKey={refreshKey} />
        </section>
      ) : (
        <section style={{ padding:'40px 5vw 0', maxWidth:700, margin:'0 auto', textAlign:'center' }}>
          <div style={{ background:'#fff', borderRadius:24, padding:'40px 24px', boxShadow:'0 6px 28px rgba(10,100,100,.08)' }}>
            <div style={{ fontSize:'3rem', marginBottom:10 }}>🎰</div>
            <div style={{ fontSize:'1.2rem', fontWeight:800, color:DARK, marginBottom:6 }}>Muy pronto, nuevas rifas</div>
            <div style={{ fontSize:'.9rem', color:`${DARK}88` }}>Ahora mismo no hay rifas abiertas. Vuelve pronto o únete al grupo para enterarte primero.</div>
          </div>
        </section>
      )}

      {/* Cifras rápidas */}
      {!loading && rifaHero && (
        <section style={{ padding:'22px 5vw 0', maxWidth:1100, margin:'0 auto' }}>
          <div className="pub-cifras">
            <div className="pub-cifra"><span className="pub-cifra-ico">🎟️</span><div><strong>{rifasActivasOrdenadas.length}</strong><span>{rifasActivasOrdenadas.length === 1 ? 'Rifa activa' : 'Rifas activas'}</span></div></div>
            <div className="pub-cifra"><span className="pub-cifra-ico">💰</span><div><strong>{fmt(Math.min(...rifasActivasOrdenadas.map(r => Number(r.precio) || Infinity)))}</strong><span>Números desde</span></div></div>
            {ganadores.length > 0 && (
              <div className="pub-cifra"><span className="pub-cifra-ico">🏆</span><div><strong>{ganadores.length}</strong><span>{ganadores.length === 1 ? 'Ganador feliz' : 'Ganadores felices'}</span></div></div>
            )}
            <div className="pub-cifra"><span className="pub-cifra-ico">📲</span><div><strong>WhatsApp</strong><span>Ahí te llega tu ticket</span></div></div>
          </div>
        </section>
      )}

      {/* Apartados: pagar lo que se apartó sin pagar */}
      {hayApartados && (
        <section style={{ padding:'22px 5vw 0', maxWidth:1100, margin:'0 auto' }}>
          <div className="apartado-banner">
            <span style={{ fontSize:'1.9rem' }}>🔖</span>
            <div style={{ flex:'1 1 240px', minWidth:0 }}>
              <div style={{ fontSize:'1rem', fontWeight:800, color:'#5b21b6' }}>Aparta tu número hoy y paga después</div>
              <div style={{ fontSize:'.82rem', color:`${DARK}99`, lineHeight:1.5 }}>En las rifas marcadas puedes guardar tu número sin pagar todavía. ¿Ya apartaste? Paga aquí antes del sorteo.</div>
            </div>
            <button className="pub-nav-btn" style={{ padding:'11px 20px', fontSize:'.84rem' }} onClick={() => setVerApartados(true)}>Pagar mis apartados</button>
          </div>
        </section>
      )}

      {rifasSecundarias.length > 0 && (
        <section id="rifas-sec" style={{ padding:'60px 5vw 0', maxWidth:1100, margin:'0 auto' }}>
          <div className="pub-titulo">
            <span className="kicker">Más rifas</span>
            <h2>Otras rifas activas</h2>
            <div className="sub">Ordenadas por proximidad al sorteo</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:24 }}>
            {rifasSecundarias.map(r => <RifaCard key={r.id} rifa={r} onSeleccionar={handleSelRifa} refreshKey={refreshKey} />)}
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
                {rifaSel.pago_diferido && (
                  <div style={{ marginTop:10, fontSize:'.8rem', color:'#5b21b6', fontWeight:600 }}>
                    🔖 Puedes apartar sin pagar: tienes hasta el {rifaSel.pago_hasta_texto}.
                  </div>
                )}
                {tienePremiosExtra(rifaSel) && (
                  <div style={{ marginTop:14, maxWidth:420 }}><PremiosRifa rifa={rifaSel} /></div>
                )}
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

            {Number(rifaSel.cifras) >= 4 ? (
              <BuscadorNumeros4
                key={`${rifaSel.id}-${refreshKey}`}
                rifa={rifaSel}
                onComprar={nums => setNumerosCarrito(nums)}
              />
            ) : (
              <GridNumeros
                key={`${rifaSel.id}-${refreshKey}`}
                rifa={rifaSel}
                onComprar={nums => setNumerosCarrito(nums)}
              />
            )}
          </div>
        </section>
      )}

      <ResultadosPublico resultados={resultados} />

      <TopCompradores top={sitio.top_compradores} grupo={sitio.grupo_whatsapp} />

      <GanadoresPublico ganadores={ganadores} />

      <section style={{ background:'#fff', padding:'70px 5vw 0' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div className="pub-titulo">
            <span className="kicker">Sin complicaciones</span>
            <h2>Cómo participar</h2>
          </div>
          <div className="pub-pasos">
            {[
              { icon:'🔢', titulo:'Elige tus números',   desc:'Toca uno o varios números. Con los packs activas ofertas automáticamente.' },
              hayApartados
                ? { icon:'💳', titulo:'Paga o aparta',        desc:'Paga de una vez, o aparta tu número y paga antes del sorteo.' }
                : { icon:'💳', titulo:'Realiza el pago',      desc:'Los datos del banco aparecen al elegir el método de pago.' },
              { icon:'📸', titulo:'Sube el comprobante', desc:'Adjunta la captura del pago. Un solo comprobante para todos tus números.' },
              { icon:'✅', titulo:'Recibe tu ticket',     desc:'Verificamos el pago y te llega tu ticket por WhatsApp.' },
            ].map(({ icon, titulo, desc }) => (
              <div key={titulo} className="pub-paso">
                <div className="pub-paso-ico">{icon}</div>
                <h3>{titulo}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pagos-sec" style={{ background:'#fff', padding:'70px 5vw 80px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div className="pub-titulo">
            <span className="kicker">Métodos de pago</span>
            <h2>Cuentas bancarias</h2>
            <div className="sub">Paga con el que te quede más fácil</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:20 }}>
            {Object.entries(METODOS_PAGO).map(([nombre, d]) => (
              <div key={nombre} className="pago-card" style={{ background: d.bg, border:`2px solid ${d.border}`, borderRadius:20, padding:'26px 22px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:50, height:50, borderRadius:14, background:'rgba(255,255,255,.8)', border:`1px solid ${d.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', flexShrink:0, overflow:'hidden' }}>
                    {d.imagen ? <img src={d.imagen} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:4, background:'#fff' }} /> : d.icono}
                  </div>
                  <div>
                    <div style={{ fontSize:'1.1rem', color: d.colorHex, fontWeight:700 }}>{nombre}</div>
                    <div style={{ fontSize:'.7rem', color:`${DARK}66` }}>{d.pais}</div>
                  </div>
                </div>
                {d.campos.map(({ label, valor }) => (
                  <div key={label} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'9px 13px', marginBottom:8 }}>
                    <div style={{ fontSize:'.6rem', color:`${d.colorHex}88`, fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
                    <div style={{ fontSize:'.9rem', color:DARK, fontWeight:700, overflowWrap:'anywhere' }}>{valor}</div>
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

      <footer id="contacto-sec" style={{ background:`linear-gradient(180deg,${DARK},#0f1f1f)`, padding:'60px 5vw 40px', borderTop:`4px solid ${TURQ}` }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, marginBottom:40 }}>
            <div>
              <div style={{ display:'inline-block', background:'#fff', borderRadius:16, padding:'10px 16px', marginBottom:14 }}>
                <img src={`${process.env.PUBLIC_URL}/logo-resuelve.png`} alt="Resuelve tu Semana" width="640" height="266" style={{ height:54, width:'auto', display:'block' }} />
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
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', paddingTop:22, textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:'6px 18px', marginBottom:12 }}>
              {[['/terminos','Términos y Condiciones'],['/privacidad','Política de Privacidad'],['/aviso-legal','Aviso Legal']].map(([to, label]) => (
                <Link key={to} to={to} style={{ fontSize:'.78rem', color:'rgba(255,255,255,.6)', textDecoration:'none' }}
                  onMouseEnter={e => e.target.style.color = TURQ} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.6)'}>
                  {label}
                </Link>
              ))}
            </div>
            <span style={{ fontSize:'.56rem', color:'rgba(255,255,255,.25)', letterSpacing:'0.5px' }}>© 2026 RESUELVE TU SEMANA · TODOS LOS DERECHOS RESERVADOS</span>
          </div>
        </div>
      </footer>

      <BurbujaGrupo grupo={sitio.grupo_whatsapp} />

      {verApartados && <ModalMisApartados onClose={() => setVerApartados(false)} onPagado={() => setRefreshKey(k => k + 1)} />}

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