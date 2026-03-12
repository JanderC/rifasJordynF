import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';

const TURQ    = '#0abfbc';
const TURQ2   = '#00d4d0';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';

const fmt  = p => p ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p) : '$0';
const fmtF = f => f ? new Date(f).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Por definir';

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
      { label: 'Número Nequi', valor: '3224012780'   },
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

/* ─── Generar link de WhatsApp ─── */
const buildWhatsAppLink = ({ numero, rifa, nombre, telefono, reservaId }) => {
  const id  = reservaId?.slice(0,8).toUpperCase() || '-------';
  const msg =
    `🎰 *RIFAS JORDYN* — Confirmación de reserva\n\n` +
    `Hola *${nombre}* 👋 tu número quedó bloqueado:\n\n` +
    `🎟 Número: *${numero}*\n` +
    `🏆 Premio: ${rifa?.premio || ''}\n` +
    `🎪 Rifa: ${rifa?.nombre || ''}\n` +
    `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n` +
    `💰 Valor: ${fmt(rifa?.precio)}\n` +
    `🔖 ID Reserva: #${id}\n\n` +
    `⏳ _Pendiente de verificación. El admin revisará tu pago pronto._\n` +
    `🌐 rifasjordyn.com`;
  const num = telefono?.replace(/\D/g,'') || '';
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  return url;
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

    .num-cell {
      width:100%; aspect-ratio:1;
      display:flex; align-items:center; justify-content:center;
      border-radius:8px; cursor:pointer;
      font-family:'Poppins',sans-serif; font-size:.72rem; font-weight:700;
      transition:transform .12s, box-shadow .12s;
      border:2px solid transparent; user-select:none;
    }
    .num-cell:hover { transform:scale(1.15); z-index:2; }
    .num-cell.disponible   { background:#fff; border-color:#d0ecec; color:${DARK}; }
    .num-cell.disponible:hover { border-color:${TURQ}; box-shadow:0 4px 16px ${TURQ}44; background:${TURQ}08; }
    .num-cell.vendido_1    { background:#fff8e0; border-color:#ffd166; color:#b8860b; cursor:not-allowed; }
    .num-cell.agotado      { background:#ffe8e8; border-color:#ffaaaa; color:#c0392b; cursor:not-allowed; }
    .num-cell.reservado    { background:#e8f4ff; border-color:#a0c8ff; color:#2874a6; cursor:not-allowed; }
    .num-cell.seleccionado { background:linear-gradient(135deg,${TURQ},${TURQ2}); border-color:${TURQ_DK}; color:#fff; transform:scale(1.18); box-shadow:0 6px 20px ${TURQ}66; }

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

    @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes pulse-ring {
      0%  {transform:scale(.95);box-shadow:0 0 0 0 ${TURQ}66}
      70% {transform:scale(1);  box-shadow:0 0 0 12px ${TURQ}00}
      100%{transform:scale(.95);box-shadow:0 0 0 0 ${TURQ}00}
    }
    .shimmer {
      background:linear-gradient(90deg,#e8f0f0 25%,#f4fafa 50%,#e8f0f0 75%);
      background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:12px;
    }
    .nav-link { font-family:'Poppins',sans-serif; font-weight:500; color:${DARK}88; text-decoration:none; font-size:.9rem; transition:color .2s; cursor:pointer; }
    .nav-link:hover { color:${TURQ}; }
  `;
  document.head.appendChild(s);
};

/* ═══════════════════════════════════════════════════════════
   CARD DE DATOS DE PAGO (inline al seleccionar método)
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
          <button className="copy-pill" onClick={() => copiar(valor, label)} title="Copiar">
            {copiado === label ? '✅' : '📋'}
          </button>
        </div>
      ))}

      {info.nota && (
        <div style={{ fontSize:'.72rem', fontWeight:600, color: info.colorHex, textAlign:'center', marginTop:6, padding:'6px 10px', background:'rgba(255,255,255,.5)', borderRadius:8 }}>
          {info.nota}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL DE RESERVA
═══════════════════════════════════════════════════════════ */
function ModalReserva({ rifa, numero, onClose, onSuccess }) {
  const [step,      setStep]     = useState(1);
  const [form,      setForm]     = useState({ nombre:'', codPais:'+58', telefono:'', metodo_pago:'' });
  const [imagen,    setImagen]   = useState(null);
  const [imgB64,    setImgB64]   = useState('');
  const [imgNombre, setImgN]     = useState('');
  const [error,     setError]    = useState('');
  const [sending,   setSending]  = useState(false);
  const [reservaId, setReservaId]= useState('');
  const fileRef = useRef();

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const telefonoFull = form.codPais + form.telefono.replace(/\D/g,'');

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
    if (!imgB64)             { setError('El comprobante de pago es obligatorio'); return; }
    setError(''); setSending(true);
    try {
      const r = await API.post('/publico/reservar', {
        rifa_id:            rifa.id,
        numero,
        nombre_cliente:     form.nombre.trim(),
        telefono:           telefonoFull,
        metodo_pago:        form.metodo_pago,
        comprobante_base64: imgB64,
        comprobante_nombre: imgNombre,
      });
      setReservaId(r.data.reserva.id);
      setStep(2);
      onSuccess?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al enviar la reserva, intenta de nuevo');
    } finally { setSending(false); }
  };

  const abrirWA = () => {
    const url = buildWhatsAppLink({ numero, rifa, nombre: form.nombre, telefono: telefonoFull, reservaId });
    window.open(url, '_blank');
  };

  const compartirNativo = async () => {
    const texto =
      `🎰 RIFAS JORDYN\n🎟 Número: ${numero}\n🏆 Premio: ${rifa?.premio}\n` +
      `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n👤 ${form.nombre}\n` +
      `🔖 Reserva: #${reservaId?.slice(0,8).toUpperCase()}\n✅ Número bloqueado pendiente de confirmación.`;
    if (navigator.share) {
      try { await navigator.share({ title:'Tu boleto — Rifas Jordyn', text: texto }); } catch {}
    } else {
      await navigator.clipboard.writeText(texto);
      alert('Texto copiado al portapapeles 📋');
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(10,30,30,.65)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:24, width:'100%', maxWidth:500, maxHeight:'93vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,60,60,.3)', animation:'fadeUp .3s ease' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:'24px 24px 0 0', padding:'22px 26px 18px', position:'relative' }}>
          <button onClick={onClose} style={{ position:'absolute', top:14, right:18, background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          <div style={{ fontSize:'.58rem', color:'rgba(255,255,255,.75)', letterSpacing:'0.5px', marginBottom:4 }}>RESERVAR NÚMERO</div>
          <div style={{ fontSize:'2.6rem', color:'#fff', lineHeight:1, fontWeight:900 }}>{numero}</div>
          <div style={{ fontSize:'.85rem', color:'rgba(255,255,255,.8)', marginTop:3 }}>{rifa.nombre} · {fmt(rifa.precio)}</div>
          <div style={{ display:'flex', gap:6, marginTop:14 }}>
            {[1,2].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:2, background: s <= step ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.25)', transition:'background .3s' }}></div>)}
          </div>
        </div>

        <div style={{ padding:'22px 26px 28px' }}>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={{ animation:'fadeUp .25s ease' }}>

              {/* Número resumen */}
              <div style={{ background:`linear-gradient(135deg,${TURQ}12,${TURQ2}18)`, border:`1.5px solid ${TURQ}33`, borderRadius:14, padding:'12px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'.62rem', color:TURQ_DK, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Número seleccionado</div>
                  <div style={{ fontSize:'2.2rem', color:TURQ, lineHeight:1, fontWeight:900 }}>{numero}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'.65rem', color:`${DARK}66`, marginBottom:2 }}>Valor</div>
                  <div style={{ fontSize:'1.3rem', color:DARK, fontWeight:700 }}>{fmt(rifa.precio)}</div>
                </div>
              </div>

              {/* ① Datos */}
              <div style={{ fontSize:'.78rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>① Tus datos</div>

              <div style={{ marginBottom:14 }}>
                <label className="pub-label">Nombre completo *</label>
                <input className="pub-input" value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="¿Cómo te llamas?" autoFocus />
              </div>

              <div style={{ marginBottom:20 }}>
                <label className="pub-label">WhatsApp / Teléfono</label>
                <div className="phone-row">
                  <select className="phone-select" value={form.codPais} onChange={e => upd('codPais', e.target.value)}>
                    {PAISES.map(p => (
                      <option key={p.code} value={p.code}>{p.flag} {p.code}</option>
                    ))}
                  </select>
                  <input className="pub-input" style={{ borderRadius:12 }} value={form.telefono}
                    onChange={e => upd('telefono', e.target.value.replace(/\D/g,'').slice(0,12))}
                    placeholder="Número sin código" type="tel" />
                </div>
                {form.telefono && (
                  <div style={{ fontSize:'.7rem', color:TURQ_DK, marginTop:5, fontWeight:600 }}>
                    📱 Número completo: <strong>{telefonoFull}</strong>
                  </div>
                )}
              </div>

              {/* ② Método de pago + datos inline */}
              <div style={{ fontSize:'.78rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>② Método de pago</div>

              <div>
                <label className="pub-label">¿Cómo vas a pagar?</label>
                <select className="pub-input" value={form.metodo_pago} onChange={e => upd('metodo_pago', e.target.value)} style={{ cursor:'pointer' }}>
                  <option value="">Selecciona un método...</option>
                  {Object.keys(METODOS_PAGO).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Datos del banco — aparecen al seleccionar */}
              {form.metodo_pago && <PagoInlineCard metodo={form.metodo_pago} />}

              <div style={{ height:20 }}></div>

              {/* ③ Comprobante */}
              <div style={{ fontSize:'.78rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                ③ Comprobante de pago
                <span style={{ background:'#ff6b6b', color:'#fff', fontSize:'.52rem', padding:'2px 7px', borderRadius:4, fontWeight:700 }}>OBLIGATORIO</span>
              </div>
              <div style={{ fontSize:'.82rem', color:`${DARK}66`, marginBottom:12, lineHeight:1.5 }}>
                Realiza el pago con los datos de arriba y sube la captura. El número queda <strong style={{ color:TURQ_DK }}>bloqueado para ti</strong> en cuanto se envíe.
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
                <div style={{ background:'#fff0f0', border:'1px solid #ffcccc', borderRadius:8, padding:'8px 12px', marginTop:10, fontSize:'.78rem', color:'#c0392b', fontWeight:500 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ marginTop:16 }}>
                <button className="pub-btn" onClick={handleEnviar} disabled={sending}
                  style={{ width:'100%', justifyContent:'center', fontSize:'1rem', padding:'16px', borderRadius:14 }}>
                  {sending
                    ? <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⏳</span> Enviando...</>
                    : '🎟 Confirmar reserva y bloquear número'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Confirmado ── */}
          {step === 2 && (
            <div style={{ textAlign:'center', animation:'fadeUp .25s ease', padding:'8px 0' }}>
              <div style={{ width:76, height:76, borderRadius:'50%', background:`linear-gradient(135deg,${TURQ},${TURQ2})`, margin:'0 auto 18px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', animation:'pulse-ring 2s infinite' }}>
                🔒
              </div>
              <div style={{ fontSize:'1.6rem', color:DARK, marginBottom:6, fontWeight:800 }}>¡Número bloqueado!</div>
              <div style={{ fontSize:'.9rem', color:`${DARK}77`, marginBottom:20, lineHeight:1.7 }}>
                El número <strong style={{ color:TURQ, fontSize:'1.4rem' }}>{numero}</strong> está reservado.<br/>
                Nadie más puede tomarlo mientras verifican tu pago.
              </div>

              {/* Resumen */}
              <div style={{ background:`${TURQ}08`, border:`1.5px solid ${TURQ}28`, borderRadius:14, padding:'14px 18px', marginBottom:18, textAlign:'left' }}>
                {[
                  { icon:'🎟', l:'Número',    v: numero,                                             c: TURQ       },
                  { icon:'🏆', l:'Premio',    v: rifa.premio,                                        c: DARK       },
                  { icon:'💰', l:'Valor',     v: fmt(rifa.precio),                                   c: '#3a7d44'  },
                  { icon:'📅', l:'Sorteo',    v: fmtF(rifa.fecha_sorteo),                            c: DARK       },
                  { icon:'⏳', l:'Estado',    v: 'Pendiente de verificación',                        c: '#f5a623'  },
                  { icon:'🔖', l:'ID',        v: '#' + (reservaId?.slice(0,8).toUpperCase() || '---'), c: `${DARK}77` },
                ].map(({ icon, l, v, c }) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:`1px solid ${TURQ}12` }}>
                    <span style={{ fontSize:'.77rem', color:`${DARK}66` }}>{icon} {l}</span>
                    <span style={{ fontSize:'.82rem', color: c, fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:'#fffbf0', border:'1px solid #ffe08a', borderRadius:10, padding:'10px 14px', marginBottom:22, fontSize:'.76rem', color:'#7a6000', lineHeight:1.6 }}>
                📲 Guarda este boleto compartiendo por WhatsApp. El admin confirmará tu pago pronto.
              </div>

              {/* Botones compartir */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button className="pub-btn-wa" onClick={abrirWA} style={{ width:'100%', justifyContent:'center', padding:'15px', borderRadius:14 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Compartir boleto por WhatsApp
                </button>
                <button className="pub-btn" onClick={compartirNativo} style={{ width:'100%', justifyContent:'center', padding:'13px', borderRadius:14, background:`linear-gradient(135deg,${TURQ}cc,${TURQ2}cc)` }}>
                  📤 Copiar / Compartir boleto
                </button>
                <button className="pub-btn-outline" onClick={onClose} style={{ width:'100%', justifyContent:'center', borderRadius:14 }}>
                  Entendido 👍
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
   GRID DE NÚMEROS — solo muestra disponibles al cliente
═══════════════════════════════════════════════════════════ */
function GridNumeros({ rifa, onSelectNumero }) {
  const [todos,        setTodos]        = useState([]);   // los 1000 para contar
  const [loading,      setLoading]      = useState(true);
  const [busqueda,     setBusqueda]     = useState('');
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => {
    setLoading(true);
    API.get(`/publico/rifas/${rifa.id}/numeros-disponibles`)
      .then(r => { setTodos(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rifa.id]);

  // Solo los disponibles aparecen en el grid
  const disponibles = todos.filter(n => n.estado === 'disponible');
  const tomados     = todos.length - disponibles.length; // vendidos + reservados + agotados
  const pct         = todos.length > 0 ? Math.round((tomados / todos.length) * 100) : 0;

  const visible = disponibles.filter(n => {
    if (!busqueda) return true;
    return n.numero.includes(busqueda.padStart(3,'0').slice(-3));
  });

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(42px,1fr))', gap:5, padding:'20px 0' }}>
      {Array.from({length:60}).map((_,i) => <div key={i} className="shimmer" style={{ height:42, borderRadius:8 }}></div>)}
    </div>
  );

  return (
    <div>
      {/* Barra de ocupación */}
      <div style={{ background:`${TURQ}0d`, border:`1.5px solid ${TURQ}28`, borderRadius:14, padding:'14px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:'.72rem', color:`${DARK}77`, fontWeight:600 }}>
              <span style={{ color:TURQ, fontWeight:800, fontSize:'.88rem' }}>{disponibles.length}</span> números disponibles
            </span>
            <span style={{ fontSize:'.72rem', color: pct > 80 ? '#e63946' : pct > 50 ? '#f0a500' : TURQ, fontWeight:700 }}>
              {pct}% ocupado
            </span>
          </div>
          <div style={{ background:'#e0f5f5', borderRadius:6, height:7, overflow:'hidden' }}>
            <div style={{
              width:`${pct}%`, height:'100%', borderRadius:6, transition:'width 1s ease',
              background: pct > 80
                ? 'linear-gradient(90deg,#e63946,#ff6b6b)'
                : pct > 50
                  ? 'linear-gradient(90deg,#f0a500,#ffd166)'
                  : `linear-gradient(90deg,${TURQ},${TURQ2})`,
            }}></div>
          </div>
        </div>
        {disponibles.length === 0 && (
          <span style={{ fontSize:'.72rem', color:'#e63946', fontWeight:700 }}>🔴 Rifa agotada</span>
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

      {/* Grid — solo disponibles */}
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
                className={`num-cell ${n.numero === seleccionado ? 'seleccionado' : 'disponible'}`}
                onClick={() => setSeleccionado(n.numero === seleccionado ? null : n.numero)}
                title={`Número ${n.numero} — disponible`}>
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

      {/* Botón flotante */}
      {seleccionado && (
        <div style={{ position:'sticky', bottom:14, marginTop:18, animation:'fadeUp .2s ease' }}>
          <button className="pub-btn" onClick={() => onSelectNumero(seleccionado)}
            style={{ width:'100%', justifyContent:'center', borderRadius:16, padding:'15px', fontSize:'1rem', boxShadow:`0 12px 32px ${TURQ}55` }}>
            🎟 Reservar número {seleccionado} por {fmt(rifa.precio)}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD DE RIFA — con imagen base64/url robusta
═══════════════════════════════════════════════════════════ */
function RifaCard({ rifa, onSeleccionar }) {
  const [imgError, setImgError] = useState(false);
  const pct = Math.min(100, (rifa.numeros_vendidos / 1000) * 100);
  const tieneImagen = rifa.imagen_url && !imgError;

  return (
    <div style={{ background:'#fff', borderRadius:24, overflow:'hidden', boxShadow:'0 4px 24px rgba(10,100,100,.08)', transition:'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow=`0 16px 48px rgba(10,180,180,.15)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 24px rgba(10,100,100,.08)'; }}>

      {/* Imagen completa de la rifa */}
      {tieneImagen ? (
        <div style={{ width:'100%', background:'#0a0a0a', borderRadius:'24px 24px 0 0', overflow:'hidden', position:'relative' }}>
          <img
            src={rifa.imagen_url}
            alt={rifa.nombre}
            onError={() => setImgError(true)}
            style={{ width:'100%', display:'block', maxHeight:500, objectFit:'contain', background:'#111' }}
          />
          <div style={{ position:'absolute', bottom:12, right:12, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:50, padding:'8px 18px', boxShadow:'0 4px 16px rgba(0,0,0,.4)' }}>
            <span style={{ fontSize:'.85rem', color:'#fff', fontWeight:800 }}>{fmt(rifa.precio)}</span>
          </div>
        </div>
      ) : (
        <div style={{ position:'relative', height:200, overflow:'hidden', background:`linear-gradient(135deg,${TURQ}22,${TURQ2}33)`, borderRadius:'24px 24px 0 0' }}>
          <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:8 }}>🎰</div>
            <div style={{ fontSize:'.75rem', color:TURQ_DK, fontWeight:600 }}>{rifa.premio}</div>
          </div>
          <div style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,.95)', borderRadius:50, padding:'6px 14px', backdropFilter:'blur(8px)', boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
            <span style={{ fontSize:'.72rem', color:TURQ_DK, fontWeight:700 }}>{fmt(rifa.precio)}</span>
          </div>
        </div>
      )}

      <div style={{ padding:'18px 22px 22px' }}>
        <div style={{ fontSize:'.55rem', color:`${TURQ}99`, letterSpacing:'0.5px', marginBottom:5 }}>
          {rifa.loteria_ref || 'SORTEO'} · {fmtF(rifa.fecha_sorteo)}
        </div>
        <div style={{ fontSize:'1.3rem', color:DARK, lineHeight:1.2, marginBottom:7, fontWeight:700 }}>{rifa.nombre}</div>
        <div style={{ fontSize:'.88rem', color:`${DARK}77`, marginBottom:14, display:'flex', alignItems:'center', gap:5 }}>
          🏆 <span style={{ fontWeight:600, color:DARK }}>{rifa.premio}</span>
        </div>

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

/* ═══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function ClientePublico() {
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [rifaSel,    setRifaSel]    = useState(null);
  const [numReserva, setNumReserva] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const gridRef = useRef();

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

  return (
    <div style={{ minHeight:'100vh', background:'#f0fafa' }}>

      {/* NAVBAR */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(240,250,250,.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid #d0ecec', padding:'0 5vw' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>🎰</div>
            <span style={{ fontSize:'1.2rem', fontWeight:700, color:DARK }}>Rifas Jordyn</span>
          </div>
          <div style={{ display:'flex', gap:24 }}>
            <span className="nav-link" onClick={() => document.getElementById('rifas-sec')?.scrollIntoView({behavior:'smooth'})}>Rifas</span>
            <span className="nav-link" onClick={() => document.getElementById('pagos-sec')?.scrollIntoView({behavior:'smooth'})}>Cómo pagar</span>
            <span className="nav-link" onClick={() => document.getElementById('contacto-sec')?.scrollIntoView({behavior:'smooth'})}>Contacto</span>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:`linear-gradient(135deg,${TURQ} 0%,${TURQ2} 40%,#00b8b5 100%)`, padding:'80px 5vw 100px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}></div>
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}></div>
        <div style={{ position:'relative', maxWidth:680, margin:'0 auto' }}>
          <div style={{ fontSize:'.65rem', color:'rgba(255,255,255,.75)', letterSpacing:'2px', marginBottom:16 }}>🎟 TÁCHIRA, VENEZUELA</div>
          <h1 style={{ fontSize:'clamp(2.8rem,7vw,4.5rem)', color:'#fff', lineHeight:1.05, fontWeight:800, marginBottom:20 }}>
            Gana premios<br/>increíbles
          </h1>
          <p style={{ fontSize:'1.1rem', color:'rgba(255,255,255,.85)', lineHeight:1.7, maxWidth:480, margin:'0 auto 36px' }}>
            Escoge tu número de la suerte, realiza el pago y participa en nuestros sorteos semanales.
          </p>
          <button className="pub-btn" onClick={() => document.getElementById('rifas-sec')?.scrollIntoView({behavior:'smooth'})}
            style={{ background:'rgba(255,255,255,.95)', color:TURQ_DK, boxShadow:'0 8px 32px rgba(0,0,0,.15)', fontSize:'1rem', padding:'16px 36px' }}>
            Ver rifas disponibles ↓
          </button>
        </div>
        <svg viewBox="0 0 1440 60" style={{ position:'absolute', bottom:-1, left:0, width:'100%' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" fill="#f0fafa"/>
        </svg>
      </section>

      {/* RIFAS */}
      <section id="rifas-sec" style={{ padding:'80px 5vw', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12, fontWeight:600 }}>PARTICIPAR ES FÁCIL</div>
          <h2 style={{ fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Rifas activas</h2>
          <p style={{ fontSize:'1rem', color:`${DARK}77`, maxWidth:480, margin:'0 auto' }}>
            Elige la rifa que más te guste, selecciona tu número favorito y sigue los pasos.
          </p>
        </div>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:24 }}>
            {[1,2].map(i => <div key={i} className="shimmer" style={{ height:380, borderRadius:24 }}></div>)}
          </div>
        ) : rifas.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', background:'#fff', borderRadius:24 }}>
            <div style={{ fontSize:'3rem', marginBottom:16 }}>🎰</div>
            <div style={{ fontSize:'1.4rem', color:`${DARK}66`, fontWeight:700 }}>No hay rifas activas por ahora</div>
            <div style={{ fontSize:'.9rem', color:`${DARK}44`, marginTop:8 }}>Vuelve pronto para ver nuevos sorteos</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:28 }}>
            {rifas.map(r => <RifaCard key={r.id} rifa={r} onSeleccionar={handleSelRifa} />)}
          </div>
        )}
      </section>

      {/* GRID NÚMEROS */}
      {rifaSel && (
        <section ref={gridRef} style={{ padding:'0 5vw 80px', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ background:'#fff', borderRadius:28, padding:'32px 28px', boxShadow:'0 8px 48px rgba(10,180,180,.1)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:24, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
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
                { n:'1', t:'Selecciona',  d:'Toca un número disponible' },
                { n:'2', t:'Paga',        d:'Usa los datos del método elegido' },
                { n:'3', t:'Confirma',    d:'Sube el comprobante y bloquea tu número' },
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

            <GridNumeros key={`${rifaSel.id}-${refreshKey}`} rifa={rifaSel} onSelectNumero={n => setNumReserva(n)} />
          </div>
        </section>
      )}

      {/* CÓMO PARTICIPAR */}
      <section style={{ background:'#fff', padding:'70px 5vw 0' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12, fontWeight:600 }}>SIN COMPLICACIONES</div>
            <h2 style={{ fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Cómo participar</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:24 }}>
            {[
              { icon:'🔢', titulo:'1. Elige tu número',     desc:'Navega por el grid y selecciona el número de la suerte.' },
              { icon:'💳', titulo:'2. Realiza el pago',     desc:'Los datos del banco aparecen automáticamente al seleccionar el método.' },
              { icon:'📸', titulo:'3. Sube el comprobante',desc:'Adjunta la captura del pago junto con tus datos.' },
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

      {/* MÉTODOS DE PAGO */}
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
                {d.nota && (
                  <div style={{ fontSize:'.72rem', color: d.colorHex, fontWeight:600, textAlign:'center', padding:'7px', background:'rgba(255,255,255,.5)', borderRadius:8, marginTop:4 }}>{d.nota}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contacto-sec" style={{ background:DARK, padding:'60px 5vw 40px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, marginBottom:40 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:38, height:38, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>🎰</div>
                <span style={{ fontSize:'1.2rem', color:'#fff', fontWeight:700 }}>Rifas Jordyn</span>
              </div>
              <p style={{ fontSize:'.88rem', color:'rgba(255,255,255,.5)', lineHeight:1.7 }}>
                Sorteos semanales con premios increíbles.<br/>Táchira, Venezuela.
              </p>
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

      {/* MODAL */}
      {numReserva && rifaSel && (
        <ModalReserva
          rifa={rifaSel}
          numero={numReserva}
          onClose={() => setNumReserva(null)}
          onSuccess={() => { setNumReserva(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}