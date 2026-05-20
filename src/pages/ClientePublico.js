import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';

const TURQ    = '#0abfbc';
const TURQ2   = '#00d4d0';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';
const NARANJA = '#ff6b2b';
const VERDE   = '#22c55e';
const GRIS    = '#8a9a9a';

const fmt = p => p ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p) : '$0';
const TZ_NEGOCIO = 'America/Caracas';

const parseFecha = (f) => {
  if (!f) return null;
  const solo = String(f).slice(0, 10);
  const d = new Date(`${solo}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d;
};

const fmtF = f => {
  const d = parseFecha(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', timeZone: TZ_NEGOCIO });
};

const fmtHora = (f) => {
  const d = parseFecha(f);
  if (!d) return null;
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return null;
  return d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Caracas' });
};

/* ─── Códigos de país ─── */
const PAISES = [
  { code:'+58', flag:'🇻🇪', name:'Venezuela' },
  { code:'+57', flag:'🇨🇴', name:'Colombia' },
  { code:'+1',  flag:'🇺🇸', name:'USA/Canadá' },
  { code:'+52', flag:'🇲🇽', name:'México' },
  { code:'+51', flag:'🇵🇪', name:'Perú' },
  { code:'+593',flag:'🇪🇨', name:'Ecuador' },
  { code:'+56', flag:'🇨🇱', name:'Chile' },
  { code:'+54', flag:'🇦🇷', name:'Argentina' },
  { code:'+34', flag:'🇪🇸', name:'España' },
  { code:'+55', flag:'🇧🇷', name:'Brasil' },
];

/* ─── Métodos de pago ─── */
const METODOS_PAGO = {
  'Pago Móvil': {
    colorHex: TURQ_DK, bg: '#f0fff8', border: `${TURQ}55`, icono: '📱',
    pais: '🇻🇪 Venezuela · Bolívares',
    campos: [
      { label:'Banco',    valor:'Banco de Venezuela' },
      { label:'Teléfono', valor:'04129287210' },
      { label:'Cédula',   valor:'V-23542583' },
    ],
  },
  'Nequi': {
    colorHex:'#c2007a', bg:'#fdf0f9', border:'#f0c0e8', icono:'💜',
    pais:'🇨🇴 Colombia',
    campos:[{ label:'Número Nequi', valor:'3224012780' },{ label:'Titular', valor:'Carmen Rangel' }],
    nota:'⚠️ Solo de Nequi a Nequi',
  },
  'Bancolombia': {
    colorHex:'#b8860b', bg:'#fff8e1', border:'#ffe082', icono:'🏦',
    pais:'🇨🇴 Colombia',
    campos:[{ label:'Tipo', valor:'Cuenta de Ahorros' },{ label:'Nro de cuenta', valor:'08820968591' },{ label:'Titular', valor:'Jordyn Ramirez' }],
    nota:'⚠️ Solo de Bancolombia a Bancolombia',
  },
  'Zelle': {
    colorHex:'#4a5bbf', bg:'#f0f4ff', border:'#c5d3ff', icono:'💙',
    pais:'🇺🇸 Estados Unidos · USD',
    campos:[{ label:'Correo', valor:'angelespinosag00@gmail.com' },{ label:'Nombre', valor:'Angel Espinosa' },{ label:'Mínimo', valor:'Desde $10 USD' }],
    nota:'⚠️ No colocar descripción ni concepto',
  },
  'Efectivo': {
    colorHex:'#3a7d44', bg:'#f0fff4', border:'#a8d5b5', icono:'💵',
    pais:'📍 Presencial',
    campos:[{ label:'Contacto', valor:'Escríbenos por WhatsApp para coordinar' }],
  },
};

/* ─── Hook tasas ─── */
let _tasasHoyCache = null;
let _tasasHoyTs    = 0;
function useTasasHoy() {
  const [tasas, setTasas] = useState(_tasasHoyCache);
  useEffect(() => {
    if (_tasasHoyCache && Date.now() - _tasasHoyTs < 600_000) { setTasas(_tasasHoyCache); return; }
    fetch('https://rifasjordynb-production.up.railway.app/api/tasas')
      .then(r => r.json())
      .then(data => {
        const t = { copUsd: data?.COP_POR_USD?.valor || 4200, bsdUsd: data?.BSD_POR_USD?.valor || 0 };
        _tasasHoyCache = t; _tasasHoyTs = Date.now(); setTasas(t);
      }).catch(() => {});
  }, []);
  return tasas ?? null;
}

const METODO_MONEDA = { 'Pago Móvil':'VES','Nequi':'COP','Bancolombia':'COP','Zelle':'USD','Efectivo':'COP' };

function calcularPrecioMetodo(precioCOP, metodo, tasaBsUSD, copUsd = 4200) {
  const moneda = METODO_MONEDA[metodo];
  if (!moneda || moneda === 'COP') return null;
  const usd = precioCOP / copUsd;
  if (moneda === 'USD') return { valor:usd, texto:`$${usd.toFixed(2)} USD`, moneda:'USD', icono:'💵' };
  if (moneda === 'VES') {
    if (!tasaBsUSD || tasaBsUSD <= 0) return { valor:0, texto:'Cargando Bs...', moneda:'VES', icono:'🇻🇪', cargando:true };
    const bs = usd * tasaBsUSD;
    return { valor:bs, texto:`Bs. ${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(bs)}`, moneda:'VES', icono:'🇻🇪' };
  }
  return null;
}

/* ─── Lógica ofertas ─── */
function calcularOferta(cantidad, ofertas, precioUnitario) {
  if (!ofertas || ofertas.length === 0 || cantidad === 0) return null;
  let mejor = null, mejorAhorro = -1;
  for (const o of ofertas) {
    if (cantidad >= o.cantidad && cantidad % o.cantidad === 0) {
      const veces = cantidad / o.cantidad;
      const totalConOferta = o.precio_total * veces;
      const totalNormal = precioUnitario * cantidad;
      const ahorro = totalNormal - totalConOferta;
      const pct = Math.round((ahorro / totalNormal) * 100);
      if (ahorro > mejorAhorro) { mejorAhorro = ahorro; mejor = { oferta:o, totalConOferta, ahorro, pct, veces }; }
    }
  }
  return mejor;
}

function siguienteOferta(cantidad, ofertas, precioUnitario) {
  if (!ofertas || ofertas.length === 0) return null;
  let menor = null, menorFaltan = Infinity;
  for (const o of ofertas) {
    const siguiente = Math.ceil((cantidad + 1) / o.cantidad) * o.cantidad;
    const faltan = siguiente - cantidad;
    const ahorro = (precioUnitario * siguiente) - o.precio_total * (siguiente / o.cantidad);
    if (faltan < menorFaltan && ahorro > 0) { menorFaltan = faltan; menor = { oferta:o, faltan, siguiente }; }
  }
  return menor;
}

/* ─── WhatsApp link ─── */
const buildWhatsAppLink = ({ numeros, rifa, nombre, telefono, reservaIds, totalReal }) => {
  const todos = Array.isArray(numeros) ? numeros : [numeros];
  const numStr = todos.map(n => `*${n}*`).join(' · ');
  const id = reservaIds?.[0]?.slice(0,8).toUpperCase() || '-------';
  const total = totalReal ?? (rifa?.precio * todos.length);
  const hora = fmtHora(rifa?.fecha_sorteo);
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
    `⏳ _Pendiente de verificación._\n🌐 rifasjordyn.com`;
  const num = telefono?.replace(/\D/g,'') || '';
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
};

/* ─── useCountdown ─── */
function useCountdown(targetDate) {
  const calc = () => {
    if (!targetDate) return { dias:0, horas:0, minutos:0, segundos:0, expired:true, invalid:true };
    const target = new Date(String(targetDate).replace(' ','T'));
    if (isNaN(target.getTime())) return { dias:0, horas:0, minutos:0, segundos:0, expired:true, invalid:true };
    const diff = target - new Date();
    if (diff <= 0) return { dias:0, horas:0, minutos:0, segundos:0, expired:true, invalid:false };
    return { dias:Math.floor(diff/86400000), horas:Math.floor((diff%86400000)/3600000), minutos:Math.floor((diff%3600000)/60000), segundos:Math.floor((diff%60000)/1000), expired:false, invalid:false };
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

/* ─── injectStyles ─── */
const injectStyles = () => {
  if (document.getElementById('jd-pub-styles')) return;
  const s = document.createElement('style');
  s.id = 'jd-pub-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{background:#f0fafa;font-family:'Poppins',sans-serif;color:#1a2e2e}
    .pub-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#0abfbc,#00d4d0);color:#fff;border:none;border-radius:50px;padding:14px 32px;font-family:'Poppins',sans-serif;font-size:.95rem;font-weight:600;cursor:pointer;box-shadow:0 8px 24px #0abfbc44;transition:transform .2s,box-shadow .2s}
    .pub-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px #0abfbc66}
    .pub-btn:active{transform:translateY(0)}
    .pub-btn:disabled{opacity:.65;cursor:not-allowed;transform:none}
    .pub-btn-outline{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#0abfbc;border:2px solid #0abfbc;border-radius:50px;padding:12px 28px;font-family:'Poppins',sans-serif;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .2s}
    .pub-btn-outline:hover{background:#0abfbc12}
    .pub-btn-wa{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;border-radius:50px;padding:14px 28px;font-family:'Poppins',sans-serif;font-size:.95rem;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(37,211,102,.35);transition:transform .2s,box-shadow .2s}
    .pub-btn-wa:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(37,211,102,.5)}
    .pub-input{width:100%;padding:14px 18px;border:2px solid #e0f0f0;border-radius:12px;font-family:'Poppins',sans-serif;font-size:.95rem;color:#1a2e2e;background:#fff;outline:none;transition:border-color .2s,box-shadow .2s}
    .pub-input:focus{border-color:#0abfbc;box-shadow:0 0 0 4px #0abfbc18}
    .pub-label{display:block;font-size:.72rem;font-weight:600;letter-spacing:.1em;color:#7a9a9a;text-transform:uppercase;margin-bottom:6px;font-family:'Poppins',sans-serif}
    .num-cell{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;font-family:'Poppins',sans-serif;font-size:.72rem;font-weight:700;transition:transform .12s,box-shadow .12s,background .12s;border:2px solid transparent;user-select:none;position:relative}
    .num-cell:hover{transform:scale(1.13);z-index:2}
    .num-cell.disponible{background:#fff;border-color:#d0ecec;color:#1a2e2e}
    .num-cell.disponible:hover{border-color:#0abfbc;box-shadow:0 4px 16px #0abfbc44;background:#0abfbc08}
    .num-cell.vendido{background:#fff8e0;border-color:#ffd166;color:#b8860b;cursor:not-allowed}
    .num-cell.agotado{background:#ffe8e8;border-color:#ffaaaa;color:#c0392b;cursor:not-allowed}
    .num-cell.apartado{background:#e8f4ff;border-color:#a0c8ff;color:#2874a6;cursor:not-allowed}
    .num-cell.seleccionado{background:linear-gradient(135deg,#0abfbc,#00d4d0);border-color:#089a97;color:#fff;transform:scale(1.18);box-shadow:0 6px 20px #0abfbc66}
    .num-cell.seleccionado::after{content:'✓';position:absolute;top:-5px;right:-5px;width:16px;height:16px;background:#fff;color:#089a97;border-radius:50%;font-size:.55rem;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2)}
    .num-cell.solo-vista{background:#f4f8f8;border-color:#c8dede;color:#8a9a9a;cursor:default;pointer-events:none}
    .phone-row{display:flex;gap:8px;align-items:stretch}
    .phone-select{flex-shrink:0;width:116px;border:2px solid #e0f0f0;border-radius:12px;font-family:'Poppins',sans-serif;font-size:.88rem;color:#1a2e2e;background:#fff;cursor:pointer;outline:none;padding:0 12px;transition:border-color .2s}
    .phone-select:focus{border-color:#0abfbc;box-shadow:0 0 0 4px #0abfbc18}
    .pago-inline-card{border-radius:14px;padding:16px 18px;animation:fadeUp .22s ease}
    .pago-campo-row{background:rgba(255,255,255,.75);border-radius:10px;padding:9px 13px;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .copy-pill{background:none;border:none;cursor:pointer;padding:3px 6px;border-radius:6px;font-size:.78rem;opacity:.55;transition:opacity .15s,background .15s}
    .copy-pill:hover{opacity:1;background:rgba(0,0,0,.06)}
    .num-chip{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#0abfbc18,#00d4d022);border:1.5px solid #0abfbc44;border-radius:20px;padding:4px 10px 4px 12px;font-family:'Poppins',sans-serif;font-size:.82rem;font-weight:800;color:#089a97;letter-spacing:.5px}
    .num-chip-remove{background:none;border:none;cursor:pointer;color:#089a97;font-size:.8rem;padding:0;line-height:1;opacity:.7;transition:opacity .15s}
    .num-chip-remove:hover{opacity:1}
    .badge-oferta{background:linear-gradient(135deg,#ff6b2b,#ff8c42);color:#fff;border-radius:20px;padding:3px 10px;font-size:.55rem;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 3px 10px #ff6b2b55;animation:badgePop .4s ease}
    .badge-finalizado{background:linear-gradient(135deg,#4a6080,#2d3e55);color:#fff;border-radius:20px;padding:3px 12px;font-size:.55rem;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 3px 10px rgba(0,0,0,.25);animation:badgePop .4s ease}
    .oferta-activa-bar{background:linear-gradient(135deg,#0d3320,#0a4a28);border:1.5px solid #22c55e55;border-radius:14px;padding:10px 16px;animation:fadeUp .2s ease}
    .oferta-sugerencia{background:linear-gradient(135deg,#2a1a00,#3d2600);border:1.5px solid #ff6b2b55;border-radius:14px;padding:10px 16px;animation:fadeUp .2s ease}
    .pack-card{background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.15);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;transition:transform .15s,background .15s;flex:1;min-width:120px;max-width:200px}
    .pack-card:hover{background:rgba(255,255,255,.13);transform:translateY(-2px)}
    .banner-finalizado{background:linear-gradient(135deg,#1e2d3d,#2d3e55);border:1.5px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 22px;display:flex;align-items:center;gap:16px;margin-bottom:20px;animation:fadeUp .3s ease}
    .count-unit{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.13);border:1.5px solid rgba(255,255,255,.22);border-radius:16px;padding:14px 8px 10px;min-width:68px;flex:1;max-width:90px;backdrop-filter:blur(12px);transition:transform .15s,background .15s}
    .count-unit:hover{background:rgba(255,255,255,.2);transform:translateY(-2px)}
    .count-num{font-size:clamp(2rem,6vw,3.2rem);font-weight:900;color:#fff;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 2px 16px rgba(0,0,0,.35);letter-spacing:-1px}
    .count-lbl{font-size:.48rem;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:2.5px;text-transform:uppercase;margin-top:6px}
    .count-sep{font-size:2rem;font-weight:900;color:rgba(255,255,255,.3);margin-top:14px;line-height:1;flex-shrink:0}
    .hero-feat-card{position:relative;border-radius:28px;overflow:hidden;min-height:520px;box-shadow:0 32px 80px rgba(0,0,0,.25)}
    .carrito-bar{position:sticky;bottom:14px;z-index:50;animation:fadeUp .22s ease}
    .shimmer{background:linear-gradient(90deg,#e8f0f0 25%,#f4fafa 50%,#e8f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:12px}
    .nav-link{font-family:'Poppins',sans-serif;font-weight:500;color:#1a2e2e88;text-decoration:none;font-size:.9rem;transition:color .2s;cursor:pointer}
    .nav-link:hover{color:#0abfbc}
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes pulse-ring{0%{transform:scale(.95);box-shadow:0 0 0 0 #0abfbc66}70%{transform:scale(1);box-shadow:0 0 0 12px #0abfbc00}100%{transform:scale(.95);box-shadow:0 0 0 0 #0abfbc00}}
    @keyframes ofertaPulse{0%,100%{box-shadow:0 0 0 0 #22c55e44}50%{box-shadow:0 0 0 6px #22c55e00}}
    @keyframes badgePop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @keyframes heroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
    @keyframes glowPulse{0%,100%{box-shadow:0 0 30px #0abfbc55,0 8px 32px rgba(0,0,0,.3)}50%{box-shadow:0 0 50px #0abfbc88,0 8px 48px rgba(0,0,0,.4)}}
  `;
  document.head.appendChild(s);
};

/* ═══════════════════════════════════════════════════════════
   BANNER SORTEO FINALIZADO
═══════════════════════════════════════════════════════════ */
function BannerSorteoFinalizado({ porcentaje }) {
  return (
    <div className="banner-finalizado">
      <div style={{ width:52, height:52, borderRadius:14, flexShrink:0, background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem' }}>🏁</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.5)', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', marginBottom:4 }}>Sorteo finalizado</div>
        <div style={{ fontSize:'1rem', color:'#fff', fontWeight:800, lineHeight:1.3, marginBottom:6 }}>Esta rifa ya no acepta compras</div>
        <div style={{ fontSize:'.78rem', color:'rgba(255,255,255,.6)', lineHeight:1.5 }}>El sorteo fue realizado. Puedes ver los números que participaron, pero la compra está cerrada.</div>
        {porcentaje !== undefined && porcentaje !== null && (
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, background:'rgba(255,255,255,.1)', borderRadius:6, height:8, overflow:'hidden' }}>
              <div style={{ width:`${Math.min(100, porcentaje)}%`, height:'100%', borderRadius:6, background:'linear-gradient(90deg,#4a8c7a,#22c55e)', transition:'width 1s ease' }}></div>
            </div>
            <span style={{ fontSize:'.72rem', color:'rgba(255,255,255,.7)', fontWeight:700, flexShrink:0 }}>{porcentaje}% vendido</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BANNER OFERTAS
═══════════════════════════════════════════════════════════ */
function BannerOfertas({ ofertas, precioUnitario }) {
  if (!ofertas || ofertas.length === 0) return null;
  return (
    <div style={{ background:'linear-gradient(135deg,#0d2e1a,#0a3d22)', border:`1.5px solid ${VERDE}44`, borderRadius:18, padding:'18px 22px', marginBottom:20, animation:'fadeUp .3s ease' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontSize:'1.3rem' }}>🎁</span>
        <div>
          <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.5)', letterSpacing:'2px', textTransform:'uppercase', fontWeight:700 }}>Ofertas especiales</div>
          <div style={{ fontSize:'.95rem', color:'#fff', fontWeight:700 }}>¡Compra más y ahorra más!</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {ofertas.map((o, i) => {
          const totalNormal = precioUnitario * o.cantidad;
          const pct = Math.round(((totalNormal - o.precio_total) / totalNormal) * 100);
          return (
            <div key={i} className="pack-card">
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span>🏷️</span>
                <span style={{ fontSize:'.82rem', color:'rgba(255,255,255,.9)', fontWeight:700 }}>{o.etiqueta || `Pack x${o.cantidad}`}</span>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:7, flexWrap:'wrap' }}>
                <span style={{ fontSize:'1.1rem', color:VERDE, fontWeight:900 }}>{fmt(o.precio_total)}</span>
                <span style={{ fontSize:'.72rem', color:'rgba(255,255,255,.4)', textDecoration:'line-through', fontWeight:600 }}>{fmt(totalNormal)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <span style={{ fontSize:'.62rem', color:'rgba(255,255,255,.5)' }}>{o.cantidad} números</span>
                <span style={{ background:`linear-gradient(135deg,${NARANJA},#ff8c42)`, color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:'.55rem', fontWeight:800 }}>-{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BLOQUE OFERTA APLICADA
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
            <div style={{ fontSize:'.6rem', color:`${VERDE}bb`, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>{oferta.etiqueta || `Pack x${oferta.cantidad}`} activado</div>
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
    <div style={{ background:'linear-gradient(135deg,#0a3320,#0d4228)', border:`2px solid ${VERDE}55`, borderRadius:16, padding:'16px 20px', marginBottom:16, animation:'ofertaPulse 2s infinite' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:'1.4rem' }}>🎉</span>
        <div>
          <div style={{ fontSize:'.6rem', color:`${VERDE}bb`, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px' }}>¡Oferta aplicada!</div>
          <div style={{ fontSize:'1rem', color:'#fff', fontWeight:800 }}>{oferta.etiqueta || `Pack x${oferta.cantidad}`}</div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.5)', marginBottom:3 }}>Precio con oferta</div>
          <div style={{ fontSize:'1.8rem', color:VERDE, fontWeight:900, lineHeight:1 }}>{fmt(totalConOferta)}</div>
          <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.35)', textDecoration:'line-through', marginTop:2 }}>Normal: {fmt(totalNormal)}</div>
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
   PAGO INLINE CARD
═══════════════════════════════════════════════════════════ */
function PagoInlineCard({ rifa, numeros, onSuccess, onCancel }) {
  const [step, setStep]           = useState('datos'); // datos | procesando | ok | error
  const [nombre, setNombre]       = useState('');
  const [cedula, setCedula]       = useState('');
  const [telefono, setTelefono]   = useState('');
  const [correo, setCorreo]       = useState('');
  const [comprobante, setComp]    = useState(null);
  const [errMsg, setErrMsg]       = useState('');
  const ofertaInfo = calcularOferta(numeros.length, rifa.ofertas || [], rifa.precio);
  const total = ofertaInfo ? ofertaInfo.totalConOferta : rifa.precio * numeros.length;

  const handleFile = e => {
    const f = e.target.files[0];
    if (f) setComp(f);
  };

  const enviar = async () => {
    if (!nombre.trim()) { setErrMsg('Ingresa tu nombre'); return; }
    if (!cedula.trim())  { setErrMsg('Ingresa tu cédula'); return; }
    if (!telefono.trim()){ setErrMsg('Ingresa tu WhatsApp'); return; }
    setErrMsg('');
    setStep('procesando');
    try {
      const fd = new FormData();
      fd.append('rifa_id',  rifa.id);
      fd.append('numeros',  JSON.stringify(numeros));
      fd.append('nombre',   nombre.trim());
      fd.append('cedula',   cedula.trim());
      fd.append('telefono', telefono.trim());
      if (correo.trim()) fd.append('correo', correo.trim());
      if (comprobante)   fd.append('comprobante', comprobante);
      const res = await API.post('/publico/reservar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.ok) { setStep('ok'); onSuccess && onSuccess(res.data); }
      else              { setErrMsg(res.data?.msg || 'Error al reservar'); setStep('datos'); }
    } catch (e) {
      const msg = e.response?.data?.msg || 'Error de conexión';
      setErrMsg(msg);
      setStep('datos');
    }
  };

  if (step === 'ok') return (
    <div style={{ textAlign:'center', padding:'32px 20px' }}>
      <div style={{ fontSize:'3rem', marginBottom:12 }}>🎉</div>
      <div style={{ fontSize:'1.1rem', color:'#fff', fontWeight:800, marginBottom:8 }}>¡Reserva enviada!</div>
      <div style={{ fontSize:'.82rem', color:'rgba(255,255,255,.6)', marginBottom:24 }}>
        Tus números están pendientes de confirmación de pago.
      </div>
      <button onClick={onCancel} style={{ background:TURQ, color:'#fff', border:'none', borderRadius:12, padding:'12px 28px', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
        Cerrar
      </button>
    </div>
  );

  if (step === 'procesando') return (
    <div style={{ textAlign:'center', padding:'40px 20px' }}>
      <div className="spinner" style={{ width:44, height:44, border:`4px solid ${TURQ}33`, borderTopColor:TURQ, borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }}></div>
      <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.9rem' }}>Enviando reserva…</div>
    </div>
  );

  const inp = (label, val, set, type='text', placeholder='', required=false) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:'.62rem', color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>
        {label}{required && <span style={{ color:NARANJA }}> *</span>}
      </label>
      <input
        type={type} value={val} placeholder={placeholder}
        onChange={e => set(e.target.value)}
        style={{ width:'100%', background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:'.88rem', outline:'none', boxSizing:'border-box' }}
      />
    </div>
  );

  return (
    <div style={{ padding:'8px 4px' }}>
      <div style={{ background:`${TURQ}15`, border:`1px solid ${TURQ}33`, borderRadius:14, padding:'14px 18px', marginBottom:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontSize:'.7rem', color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase' }}>Números seleccionados</span>
          <span style={{ fontSize:'.8rem', color:TURQ, fontWeight:800 }}>{numeros.length} boleto{numeros.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {numeros.map(n => (
            <span key={n} style={{ background:`${TURQ}22`, border:`1px solid ${TURQ}55`, borderRadius:6, padding:'2px 8px', fontSize:'.75rem', color:TURQ, fontWeight:700 }}>
              {String(n).padStart(3,'0')}
            </span>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', marginTop:12, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'.72rem', color:'rgba(255,255,255,.5)' }}>Total a pagar</span>
          <span style={{ fontSize:'1.2rem', color:VERDE, fontWeight:900 }}>{fmt(total)}</span>
        </div>
        {ofertaInfo && (
          <div style={{ marginTop:4, textAlign:'right' }}>
            <span style={{ fontSize:'.62rem', color:VERDE, fontWeight:700 }}>
              🎁 Oferta aplicada — ahorras {fmt(ofertaInfo.ahorro)}
            </span>
          </div>
        )}
      </div>

      {inp('Nombre completo', nombre, setNombre, 'text', 'Tu nombre', true)}
      {inp('Cédula / Identificación', cedula, setCedula, 'text', 'Número de cédula', true)}
      {inp('WhatsApp', telefono, setTelefono, 'tel', '+58 4XX XXXXXXX', true)}
      {inp('Correo electrónico', correo, setCorreo, 'email', 'opcional')}

      <div style={{ marginBottom:18 }}>
        <label style={{ display:'block', fontSize:'.62rem', color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>
          Comprobante de pago <span style={{ color:'rgba(255,255,255,.3)', fontWeight:400 }}>(opcional)</span>
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,.04)', border:`1.5px dashed rgba(255,255,255,.15)`, borderRadius:10, padding:'12px 16px', cursor:'pointer' }}>
          <span style={{ fontSize:'1.2rem' }}>📎</span>
          <span style={{ fontSize:'.82rem', color:'rgba(255,255,255,.55)' }}>
            {comprobante ? comprobante.name : 'Subir imagen o PDF'}
          </span>
          <input type="file" accept="image/*,.pdf" onChange={handleFile} style={{ display:'none' }} />
        </label>
      </div>

      {errMsg && (
        <div style={{ background:'rgba(239,68,68,.15)', border:'1.5px solid rgba(239,68,68,.4)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:'.82rem', color:'#fca5a5' }}>
          ⚠️ {errMsg}
        </div>
      )}

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancel} style={{ flex:1, background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:12, padding:'13px', color:'rgba(255,255,255,.6)', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
          Cancelar
        </button>
        <button onClick={enviar} style={{ flex:2, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, border:'none', borderRadius:12, padding:'13px', color:'#fff', fontWeight:800, cursor:'pointer', fontSize:'.95rem', boxShadow:`0 4px 16px ${TURQ}44` }}>
          Enviar reserva 🚀
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL RESERVA
═══════════════════════════════════════════════════════════ */
function ModalReserva({ rifa, numeros, onClose, onSuccess }) {
  const [tab, setTab] = useState('pago'); // pago | whatsapp

  const waLink = buildWhatsAppLink(rifa, numeros);
  const ofertaInfo = calcularOferta(numeros.length, rifa.ofertas || [], rifa.precio);
  const total = ofertaInfo ? ofertaInfo.totalConOferta : rifa.precio * numeros.length;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#0f1923', borderRadius:'22px 22px 0 0', width:'100%', maxWidth:480, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 -8px 40px rgba(0,0,0,.6)' }}>
        {/* Handle */}
        <div style={{ width:40, height:5, background:'rgba(255,255,255,.15)', borderRadius:3, margin:'12px auto 0' }}></div>

        {/* Header */}
        <div style={{ padding:'18px 22px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>Reservar números</div>
            <div style={{ fontSize:'1.05rem', color:'#fff', fontWeight:800, marginTop:2 }}>{rifa.nombre}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:10, width:36, height:36, cursor:'pointer', color:'rgba(255,255,255,.6)', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* Resumen total */}
        <div style={{ margin:'14px 22px', background:`${TURQ}12`, border:`1px solid ${TURQ}30`, borderRadius:12, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.5)' }}>{numeros.length} número{numeros.length !== 1 ? 's' : ''} seleccionado{numeros.length !== 1 ? 's' : ''}</div>
          <div style={{ fontSize:'1.15rem', color:VERDE, fontWeight:900 }}>{fmt(total)}</div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', margin:'0 22px', gap:8, marginBottom:18 }}>
          {[['pago','📤 Reservar en línea'],['whatsapp','💬 WhatsApp']].map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:'10px 6px', borderRadius:10, border:`1.5px solid ${tab===t ? TURQ : 'rgba(255,255,255,.1)'}`, background: tab===t ? `${TURQ}22` : 'transparent', color: tab===t ? TURQ : 'rgba(255,255,255,.5)', fontWeight:700, fontSize:'.82rem', cursor:'pointer', transition:'all .2s' }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ padding:'0 22px 30px' }}>
          {tab === 'pago' && (
            <PagoInlineCard rifa={rifa} numeros={numeros} onSuccess={onSuccess} onCancel={onClose} />
          )}
          {tab === 'whatsapp' && (
            <div style={{ textAlign:'center', padding:'10px 0 20px' }}>
              <div style={{ fontSize:'3rem', marginBottom:12 }}>💬</div>
              <div style={{ fontSize:'.9rem', color:'rgba(255,255,255,.7)', marginBottom:6, lineHeight:1.6 }}>
                Te abriremos WhatsApp con la información de tu reserva. El administrador confirmará tu pago manualmente.
              </div>
              <div style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:'12px 16px', margin:'16px 0', fontSize:'.78rem', color:'rgba(255,255,255,.5)', textAlign:'left' }}>
                <strong style={{ color:'rgba(255,255,255,.8)' }}>Números:</strong> {numeros.map(n => String(n).padStart(3,'0')).join(', ')}<br/>
                <strong style={{ color:'rgba(255,255,255,.8)' }}>Total:</strong> {fmt(total)}
              </div>
              <a href={waLink} target="_blank" rel="noreferrer"
                style={{ display:'block', background:'linear-gradient(135deg,#25d366,#1ebe5d)', border:'none', borderRadius:14, padding:'15px', color:'#fff', fontWeight:800, fontSize:'1rem', textDecoration:'none', boxShadow:'0 4px 18px rgba(37,211,102,.4)' }}>
                Abrir WhatsApp 📲
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO RIFA PRINCIPAL
═══════════════════════════════════════════════════════════ */
function HeroRifaPrincipal({ rifa, onVerNumeros }) {
  const compraActiva = rifa.compra_activa !== false;
  const pct          = rifa.porcentaje_comprado ?? 0;
  const { dias, horas, minutos, segundos } = useCountdown(rifa.fecha_sorteo);
  const hasPremio = rifa.premio && rifa.premio.trim();
  const hasOfertas = Array.isArray(rifa.ofertas) && rifa.ofertas.length > 0;

  return (
    <div style={{ borderRadius:22, overflow:'hidden', background:'linear-gradient(180deg,#0d1f2d 0%,#0a1520 100%)', border:'1.5px solid rgba(255,255,255,.08)', marginBottom:24, boxShadow:'0 8px 40px rgba(0,0,0,.4)' }}>
      {/* Imagen */}
      <div style={{ position:'relative', height:220, overflow:'hidden' }}>
        {rifa.imagen_url ? (
          <img src={rifa.imagen_url} alt={rifa.nombre}
            style={{ width:'100%', height:'100%', objectFit:'cover',
              filter: compraActiva ? 'none' : 'grayscale(35%) brightness(0.82)',
              transition:'filter .4s ease' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#0d2a3a,#091822)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'4rem', opacity:.3 }}>🎟️</span>
          </div>
        )}
        {/* Overlay oscuro si finalizado */}
        {!compraActiva && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'rgba(0,0,0,.65)', borderRadius:16, padding:'10px 22px', backdropFilter:'blur(4px)' }}>
              <span style={{ fontSize:'1.1rem', color:'rgba(255,255,255,.85)', fontWeight:800, letterSpacing:'1px' }}>🏁 SORTEO REALIZADO</span>
            </div>
          </div>
        )}
        {/* Badge estado */}
        {compraActiva && (
          <div style={{ position:'absolute', top:12, right:12, background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)', borderRadius:20, padding:'4px 12px', border:`1px solid ${VERDE}55` }}>
            <span style={{ fontSize:'.65rem', color:VERDE, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px' }}>● Activa</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'20px 22px 24px' }}>
        <div style={{ fontSize:'1.25rem', color:'#fff', fontWeight:900, marginBottom:4, lineHeight:1.2 }}>{rifa.nombre}</div>
        {hasPremio && (
          <div style={{ fontSize:'.82rem', color:`${TURQ}cc`, fontWeight:600, marginBottom:12 }}>🏆 {rifa.premio}</div>
        )}

        {/* Precio */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ background:`${TURQ}18`, border:`1px solid ${TURQ}44`, borderRadius:10, padding:'6px 14px' }}>
            <span style={{ fontSize:'.6rem', color:`${TURQ}99`, fontWeight:700, textTransform:'uppercase', display:'block' }}>Precio</span>
            <span style={{ fontSize:'1.1rem', color:TURQ, fontWeight:900 }}>{fmt(rifa.precio)}</span>
          </div>
          {rifa.fecha_sorteo && (
            <div style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'6px 14px' }}>
              <span style={{ fontSize:'.6rem', color:'rgba(255,255,255,.45)', fontWeight:700, textTransform:'uppercase', display:'block' }}>Sorteo</span>
              <span style={{ fontSize:'.85rem', color:'rgba(255,255,255,.8)', fontWeight:700 }}>{fmtF(rifa.fecha_sorteo)}</span>
            </div>
          )}
        </div>

        {/* Countdown — solo si compra activa y hay fecha */}
        {compraActiva && rifa.fecha_sorteo && dias !== null && (
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
            {[['dias',dias,'Días'],['horas',horas,'Hrs'],['min',minutos,'Min'],['seg',segundos,'Seg']].map(([k,v,lbl]) => (
              <div key={k} style={{ flex:1, background:'rgba(255,255,255,.05)', borderRadius:10, padding:'8px 4px', textAlign:'center' }}>
                <div style={{ fontSize:'1.3rem', color:TURQ, fontWeight:900, lineHeight:1 }}>{String(v).padStart(2,'0')}</div>
                <div style={{ fontSize:'.52rem', color:'rgba(255,255,255,.4)', fontWeight:700, textTransform:'uppercase', marginTop:2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progreso compra */}
        <div style={{ marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:'.62rem', color:'rgba(255,255,255,.4)', fontWeight:700, textTransform:'uppercase' }}>Números vendidos</span>
            <span style={{ fontSize:'.72rem', color: compraActiva ? TURQ : VERDE, fontWeight:800 }}>{pct}%</span>
          </div>
          <div style={{ height:8, background:'rgba(255,255,255,.08)', borderRadius:6, overflow:'hidden' }}>
            <div style={{ width:`${Math.min(100, pct)}%`, height:'100%', borderRadius:6,
              background: compraActiva
                ? `linear-gradient(90deg,${TURQ},${TURQ2})`
                : 'linear-gradient(90deg,#4a8c7a,#22c55e)',
              transition:'width 1s ease' }}>
            </div>
          </div>
        </div>

        {/* Ofertas preview */}
        {compraActiva && hasOfertas && <BannerOfertas ofertas={rifa.ofertas} precioUnitario={rifa.precio} />}

        {/* Botón acción */}
        <button onClick={onVerNumeros}
          style={{ width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer', fontWeight:800, fontSize:'1rem', letterSpacing:'.5px', transition:'all .2s',
            background: compraActiva
              ? `linear-gradient(135deg,${TURQ},${TURQ2})`
              : 'rgba(255,255,255,.1)',
            color: compraActiva ? '#fff' : 'rgba(255,255,255,.7)',
            boxShadow: compraActiva ? `0 4px 20px ${TURQ}44` : 'none',
          }}>
          {compraActiva ? '🎟️ Seleccionar números' : '👁 Ver números del sorteo'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GRID NUMEROS
═══════════════════════════════════════════════════════════ */
function GridNumeros({ rifa, compraActiva, onReservar }) {
  const [numeros,    setNumeros]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [carrito,    setCarrito]    = useState([]);
  const [busqueda,   setBusqueda]   = useState('');
  const [filtro,     setFiltro]     = useState('todos');
  const [quickPick,  setQuickPick]  = useState('');
  const pct = rifa.porcentaje_comprado ?? 0;

  useEffect(() => {
    if (!rifa?.id) return;
    setLoading(true);
    API.get(`/publico/rifas/${rifa.id}/numeros`)
      .then(r => { setNumeros(r.data || []); setLoading(false); })
      .catch(() => { setError('No se pudieron cargar los números'); setLoading(false); });
  }, [rifa?.id]);

  const toggleNum = (num) => {
    if (!compraActiva) return;
    setCarrito(c => c.includes(num) ? c.filter(x => x !== num) : [...c, num]);
  };

  const handleQuickPick = () => {
    if (!compraActiva) return;
    const cant = parseInt(quickPick, 10);
    if (!cant || cant < 1) return;
    const disponibles = numeros.filter(n => n.estado === 'disponible').map(n => n.numero);
    const shuffled    = [...disponibles].sort(() => Math.random() - .5).slice(0, cant);
    setCarrito(shuffled);
    setQuickPick('');
  };

  // En modo solo-vista todos los números son visibles; en modo activo filtra por estado/búsqueda
  const filtrados = numeros.filter(n => {
    if (busqueda) return String(n.numero).padStart(3,'0').includes(busqueda);
    if (compraActiva && filtro === 'disponibles') return n.estado === 'disponible';
    if (compraActiva && filtro === 'vendidos')    return n.estado !== 'disponible';
    return true;
  });

  const colorNum = (n) => {
    if (carrito.includes(n.numero)) return { bg: TURQ, txt:'#fff', bdr: TURQ };
    if (n.estado === 'vendido')     return { bg:'rgba(239,68,68,.18)',  txt:'rgba(239,68,68,.8)',  bdr:'rgba(239,68,68,.35)' };
    if (n.estado === 'reservado')   return { bg:'rgba(234,179,8,.16)',  txt:'rgba(234,179,8,.85)', bdr:'rgba(234,179,8,.35)' };
    return { bg:'rgba(255,255,255,.04)', txt:'rgba(255,255,255,.75)', bdr:'rgba(255,255,255,.1)' };
  };

  if (loading) return (
    <div style={{ textAlign:'center', padding:'50px 0' }}>
      <div style={{ width:44, height:44, border:`4px solid ${TURQ}33`, borderTopColor:TURQ, borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 14px' }}></div>
      <div style={{ color:'rgba(255,255,255,.5)', fontSize:'.85rem' }}>Cargando números…</div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(239,68,68,.8)', fontSize:'.88rem' }}>⚠️ {error}</div>
  );

  return (
    <div>
      {/* Banner finalizado */}
      {!compraActiva && <BannerSorteoFinalizado porcentaje={pct} />}

      {/* Barra de ocupación */}
      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'12px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:'.62rem', color:'rgba(255,255,255,.4)', fontWeight:700, textTransform:'uppercase' }}>Ocupación</span>
          <span style={{ fontSize:'.75rem', color: compraActiva ? TURQ : VERDE, fontWeight:800 }}>{pct}% vendido</span>
        </div>
        <div style={{ height:7, background:'rgba(255,255,255,.07)', borderRadius:6, overflow:'hidden' }}>
          <div style={{ width:`${Math.min(100,pct)}%`, height:'100%', borderRadius:6,
            background: compraActiva ? `linear-gradient(90deg,${TURQ},${TURQ2})` : 'linear-gradient(90deg,#4a8c7a,#22c55e)',
            transition:'width 1s ease' }}></div>
        </div>
        <div style={{ display:'flex', gap:14, marginTop:10, flexWrap:'wrap' }}>
          {[['rgba(255,255,255,.04)','rgba(255,255,255,.4)','Disponible'],
            ['rgba(234,179,8,.16)', 'rgba(234,179,8,.85)','Reservado'],
            ['rgba(239,68,68,.18)','rgba(239,68,68,.8)','Vendido']].map(([bg,cl,lbl]) => (
            <div key={lbl} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:3, background:bg, border:`1px solid ${cl}` }}></div>
              <span style={{ fontSize:'.62rem', color:'rgba(255,255,255,.45)' }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Búsqueda */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar número…" type="number" min="0" max="999"
          style={{ flex:1, background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.1)', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:'.88rem', outline:'none' }} />
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:10, padding:'10px 14px', color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:'.85rem' }}>✕</button>
        )}
      </div>

      {/* Filtros — solo en modo compra activa */}
      {compraActiva && (
        <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
          {[['todos','Todos'],['disponibles','Disponibles'],['vendidos','No disponibles']].map(([v,lbl]) => (
            <button key={v} onClick={() => setFiltro(v)}
              style={{ padding:'7px 16px', borderRadius:20, border:`1.5px solid ${filtro===v ? TURQ : 'rgba(255,255,255,.12)'}`,
                background: filtro===v ? `${TURQ}22` : 'transparent',
                color: filtro===v ? TURQ : 'rgba(255,255,255,.5)',
                fontWeight:700, fontSize:'.75rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {/* Quick Pick — solo en modo compra activa */}
      {compraActiva && (
        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
          <span style={{ fontSize:'.78rem', color:'rgba(255,255,255,.5)', flexShrink:0 }}>🎲 Quick Pick:</span>
          <input value={quickPick} onChange={e => setQuickPick(e.target.value)}
            type="number" min="1" max="20" placeholder="Cant."
            style={{ width:70, background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.1)', borderRadius:10, padding:'8px 10px', color:'#fff', fontSize:'.85rem', outline:'none', textAlign:'center' }} />
          <button onClick={handleQuickPick}
            style={{ background:`${TURQ}22`, border:`1.5px solid ${TURQ}44`, borderRadius:10, padding:'8px 14px', color:TURQ, fontWeight:700, cursor:'pointer', fontSize:'.8rem' }}>
            Aleatorio
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="num-grid">
        {filtrados.map(n => {
          const { bg, txt, bdr } = colorNum(n);
          const enCarrito = carrito.includes(n.numero);
          const soloVista = !compraActiva;
          return (
            <div key={n.numero}
              className={`num-cell${soloVista ? ' solo-vista' : ''}`}
              onClick={() => toggleNum(n.numero)}
              style={{ background:bg, border:`1.5px solid ${bdr}`, color:txt,
                boxShadow: enCarrito ? `0 0 10px ${TURQ}66` : 'none',
                transform: enCarrito ? 'scale(1.06)' : 'scale(1)',
              }}>
              {String(n.numero).padStart(3,'0')}
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'30px 0', color:'rgba(255,255,255,.3)', fontSize:'.85rem' }}>
            Sin resultados
          </div>
        )}
      </div>

      {/* Carrito flotante — solo en modo compra activa */}
      {compraActiva && carrito.length > 0 && (
        <div style={{ position:'sticky', bottom:16, left:0, right:0, marginTop:20, zIndex:100 }}>
          <div style={{ background:'linear-gradient(135deg,#0d2a3a,#091822)', border:`2px solid ${TURQ}55`, borderRadius:18, padding:'14px 18px', boxShadow:`0 8px 32px rgba(0,0,0,.6), 0 0 20px ${TURQ}22` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:'.6rem', color:`${TURQ}99`, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px' }}>Carrito</div>
                <div style={{ fontSize:'.95rem', color:'#fff', fontWeight:800 }}>
                  {carrito.length} número{carrito.length !== 1?'s':''} · {fmt(calcularOferta(carrito.length, rifa.ofertas||[], rifa.precio)?.totalConOferta ?? rifa.precio * carrito.length)}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setCarrito([])}
                  style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, padding:'8px 12px', color:'rgba(255,255,255,.5)', cursor:'pointer', fontSize:'.8rem' }}>
                  Vaciar
                </button>
                <button onClick={() => onReservar(carrito)}
                  style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, border:'none', borderRadius:10, padding:'8px 18px', color:'#fff', fontWeight:800, cursor:'pointer', fontSize:'.88rem', boxShadow:`0 3px 12px ${TURQ}55` }}>
                  Reservar →
                </button>
              </div>
            </div>
            {/* Oferta aplicada en compacto */}
            <BloqueOfertaAplicada
              ofertaInfo={calcularOferta(carrito.length, rifa.ofertas||[], rifa.precio)}
              cantidad={carrito.length} precioUnitario={rifa.precio} compact />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RIFA CARD (listado)
═══════════════════════════════════════════════════════════ */
function RifaCard({ rifa, onSelect }) {
  const compraActiva = rifa.compra_activa !== false;
  const pct          = rifa.porcentaje_comprado ?? 0;
  const hasOfertas   = Array.isArray(rifa.ofertas) && rifa.ofertas.length > 0;

  return (
    <div className="rifa-card" onClick={onSelect}
      style={{ cursor:'pointer', opacity: compraActiva ? 1 : 0.88 }}>
      {/* Imagen */}
      <div style={{ position:'relative', height:160, borderRadius:'16px 16px 0 0', overflow:'hidden', background:'#0a1820', flexShrink:0 }}>
        {rifa.imagen_url ? (
          <img src={rifa.imagen_url} alt={rifa.nombre}
            style={{ width:'100%', height:'100%', objectFit:'cover',
              filter: compraActiva ? 'none' : 'grayscale(28%) brightness(0.8)',
              transition:'filter .4s ease' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'3.5rem', opacity:.2 }}>🎟️</span>
          </div>
        )}
        {/* Badge estado */}
        <div style={{ position:'absolute', top:10, left:10 }}>
          {compraActiva && hasOfertas && (
            <span style={{ background:`linear-gradient(135deg,${NARANJA},#ff8c42)`, color:'#fff', borderRadius:20, padding:'3px 10px', fontSize:'.6rem', fontWeight:800, boxShadow:'0 2px 8px rgba(0,0,0,.3)' }}>
              🏷️ OFERTA
            </span>
          )}
          {!compraActiva && (
            <span className="badge-finalizado">🏁 FINALIZADO</span>
          )}
        </div>
        {/* Precio badge */}
        <div style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)', borderRadius:10, padding:'4px 10px', border:`1px solid ${TURQ}44` }}>
          <span style={{ fontSize:'.78rem', color:TURQ, fontWeight:800 }}>{fmt(rifa.precio)}</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding:'14px 16px 16px' }}>
        <div style={{ fontSize:'.95rem', color:'#fff', fontWeight:800, marginBottom:4, lineHeight:1.3 }}>{rifa.nombre}</div>
        {rifa.premio && (
          <div style={{ fontSize:'.72rem', color:`${TURQ}bb`, marginBottom:8, fontWeight:600 }}>🏆 {rifa.premio}</div>
        )}
        {rifa.fecha_sorteo && (
          <div style={{ fontSize:'.68rem', color:'rgba(255,255,255,.4)', marginBottom:10 }}>
            📅 {fmtF(rifa.fecha_sorteo)} · {fmtHora(rifa.fecha_sorteo)}
          </div>
        )}
        {/* Barra progreso */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:'.6rem', color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase' }}>Vendido</span>
            <span style={{ fontSize:'.68rem', color: compraActiva ? TURQ : VERDE, fontWeight:800 }}>{pct}%</span>
          </div>
          <div style={{ height:5, background:'rgba(255,255,255,.07)', borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:`${Math.min(100,pct)}%`, height:'100%', borderRadius:4,
              background: compraActiva ? `linear-gradient(90deg,${TURQ},${TURQ2})` : 'linear-gradient(90deg,#4a8c7a,#22c55e)',
              transition:'width 1s ease' }}></div>
          </div>
        </div>
        {/* Botón */}
        <button style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:700, fontSize:'.85rem', transition:'all .2s',
          background: compraActiva ? `linear-gradient(135deg,${TURQ},${TURQ2})` : 'rgba(255,255,255,.08)',
          color: compraActiva ? '#fff' : 'rgba(255,255,255,.6)',
          boxShadow: compraActiva ? `0 3px 14px ${TURQ}44` : 'none' }}>
          {compraActiva ? '🎟️ Ver números' : '👁 Ver números del sorteo'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLIENTE PUBLICO  (export default)
═══════════════════════════════════════════════════════════ */
export default function ClientePublico() {
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [rifaSel,    setRifaSel]    = useState(null);
  const [vistaGrid,  setVistaGrid]  = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [numerosCarrito, setNumerosCarrito] = useState([]);

  // Cargar rifas (backend ya filtra por fecha_eliminacion_pantalla)
  useEffect(() => {
    injectStyles();
    setLoading(true);
    API.get('/publico/rifas')
      .then(r => {
        const data = r.data || [];
        setRifas(data);
        if (data.length === 1) {
          setRifaSel(data[0]);
          setVistaGrid(false);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar las rifas. Intenta de nuevo.');
        setLoading(false);
      });
  }, []);

  const compraActivaSel = rifaSel?.compra_activa !== false;

  const handleSeleccionarRifa = (rifa) => {
    setRifaSel(rifa);
    setVistaGrid(false);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const handleVerNumeros = () => {
    setVistaGrid(true);
    setTimeout(() => {
      document.getElementById('seccion-numeros')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 80);
  };

  const handleReservar = (nums) => {
    if (!compraActivaSel) return;
    setNumerosCarrito(nums);
    setModalOpen(true);
  };

  const handleReservaExitosa = () => {
    setModalOpen(false);
    setNumerosCarrito([]);
    // Refrescar datos
    API.get('/publico/rifas').then(r => setRifas(r.data || [])).catch(() => {});
  };

  // ── LOADING ──
  if (loading) return (
    <div style={{ minHeight:'100vh', background:DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ width:52, height:52, border:`4px solid ${TURQ}33`, borderTopColor:TURQ, borderRadius:'50%', animation:'spin 1s linear infinite' }}></div>
      <div style={{ color:'rgba(255,255,255,.5)', fontSize:'.9rem' }}>Cargando rifas…</div>
    </div>
  );

  // ── ERROR ──
  if (error) return (
    <div style={{ minHeight:'100vh', background:DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:24 }}>
      <span style={{ fontSize:'2.5rem' }}>⚠️</span>
      <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.9rem', textAlign:'center' }}>{error}</div>
      <button onClick={() => window.location.reload()}
        style={{ background:TURQ, border:'none', borderRadius:12, padding:'11px 28px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
        Reintentar
      </button>
    </div>
  );

  // ── SIN RIFAS ──
  if (rifas.length === 0) return (
    <div style={{ minHeight:'100vh', background:DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:24 }}>
      <span style={{ fontSize:'3rem' }}>🎟️</span>
      <div style={{ color:'rgba(255,255,255,.5)', fontSize:'.95rem', textAlign:'center' }}>No hay rifas disponibles en este momento.</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:DARK, color:'#fff', paddingBottom:80 }}>
      {/* ── HEADER ── */}
      <div style={{ background:'linear-gradient(180deg,rgba(10,191,188,.12) 0%,transparent 100%)', borderBottom:'1px solid rgba(255,255,255,.06)', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:200, backdropFilter:'blur(10px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {rifaSel && rifas.length > 1 && (
            <button onClick={() => { setRifaSel(null); setVistaGrid(false); }}
              style={{ background:'rgba(255,255,255,.07)', border:'none', borderRadius:10, padding:'7px 12px', color:'rgba(255,255,255,.7)', cursor:'pointer', fontSize:'.82rem', fontWeight:700 }}>
              ← Rifas
            </button>
          )}
          <div style={{ fontSize:'1rem', color:'#fff', fontWeight:800 }}>
            {rifaSel ? rifaSel.nombre : '🎟️ Rifas Jordyn'}
          </div>
        </div>
        {rifaSel && !compraActivaSel && (
          <span className="badge-finalizado" style={{ fontSize:'.58rem' }}>🏁 Finalizado</span>
        )}
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 16px 0' }}>

        {/* ── LISTADO RIFAS (cuando no hay selección o hay varias) ── */}
        {!rifaSel && (
          <div>
            <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', marginBottom:16 }}>
              Rifas disponibles ({rifas.length})
            </div>
            <div style={{ display:'grid', gap:16 }}>
              {rifas.map(r => (
                <RifaCard key={r.id} rifa={r} onSelect={() => handleSeleccionarRifa(r)} />
              ))}
            </div>
          </div>
        )}

        {/* ── DETALLE RIFA SELECCIONADA ── */}
        {rifaSel && (
          <div>
            {/* Hero */}
            <HeroRifaPrincipal rifa={rifaSel} onVerNumeros={handleVerNumeros} />

            {/* Descripción */}
            {rifaSel.descripcion && (
              <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'16px 18px', marginBottom:20 }}>
                <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:8 }}>Descripción</div>
                <div style={{ fontSize:'.85rem', color:'rgba(255,255,255,.7)', lineHeight:1.7 }}>{rifaSel.descripcion}</div>
              </div>
            )}

            {/* Sección grid números */}
            <div id="seccion-numeros">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase', letterSpacing:'2px' }}>
                  {compraActivaSel ? '🎟️ Escoge tu número' : '🏁 Números del sorteo'}
                </div>
                {!vistaGrid && (
                  <button onClick={handleVerNumeros}
                    style={{ background:`${TURQ}18`, border:`1px solid ${TURQ}44`, borderRadius:10, padding:'6px 14px', color:TURQ, fontWeight:700, cursor:'pointer', fontSize:'.75rem' }}>
                    {compraActivaSel ? 'Ver cuadrícula' : 'Ver números'}
                  </button>
                )}
              </div>

              {vistaGrid && (
                <GridNumeros
                  rifa={rifaSel}
                  compraActiva={compraActivaSel}
                  onReservar={handleReservar}
                />
              )}
            </div>

            {/* Si hay múltiples rifas, botón para volver al listado */}
            {rifas.length > 1 && (
              <div style={{ marginTop:32, textAlign:'center' }}>
                <button onClick={() => { setRifaSel(null); setVistaGrid(false); }}
                  style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:'12px 28px', color:'rgba(255,255,255,.6)', fontWeight:700, cursor:'pointer', fontSize:'.85rem' }}>
                  ← Ver todas las rifas
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL RESERVA ── */}
      {compraActivaSel && modalOpen && numerosCarrito.length > 0 && rifaSel && (
        <ModalReserva
          rifa={rifaSel}
          numeros={numerosCarrito}
          onClose={() => setModalOpen(false)}
          onSuccess={handleReservaExitosa}
        />
      )}
    </div>
  );
}