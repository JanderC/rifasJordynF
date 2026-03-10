import React, { useState, useEffect, useRef, useCallback } from 'react';
import API from '../services/api';

/* ═══════════════════════════════════════════════════════════
   RIFAS JORDYN — Página Pública de Cliente
   Paleta: blanco + turquesa (#0abfbc / #00d4d0) + acentos coral
   Sin registro · flujo: ver rifas → escoger número → pagar → subir comprobante
═══════════════════════════════════════════════════════════ */

const TURQ    = '#0abfbc';
const TURQ2   = '#00d4d0';
const TURQ_DK = '#089a97';
const CORAL   = '#ff6b6b';
const DARK    = '#1a2e2e';
const FONTS   = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
`;

const fmt = p => p ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(p) : '$0';
const fmtF = f => f ? new Date(f).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) : 'Por definir';

/* ─── Inyectar estilos globales ─────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('jd-pub-styles')) return;
  const s = document.createElement('style');
  s.id = 'jd-pub-styles';
  s.textContent = `
    ${FONTS}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { background: #f0fafa; font-family: 'Poppins', sans-serif; color: ${DARK}; }

    .pub-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, ${TURQ}, ${TURQ2});
      color: #fff; border: none; border-radius: 50px;
      padding: 14px 32px; font-family: 'Poppins', sans-serif;
      font-size: .95rem; font-weight: 600; cursor: pointer;
      box-shadow: 0 8px 24px ${TURQ}44;
      transition: transform .2s, box-shadow .2s;
    }
    .pub-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px ${TURQ}66; }
    .pub-btn:active { transform: translateY(0); }
    .pub-btn-outline {
      display: inline-flex; align-items: center; gap: 8px;
      background: transparent; color: ${TURQ};
      border: 2px solid ${TURQ}; border-radius: 50px;
      padding: 12px 28px; font-family: 'Poppins', sans-serif;
      font-size: .9rem; font-weight: 600; cursor: pointer;
      transition: all .2s;
    }
    .pub-btn-outline:hover { background: ${TURQ}12; }
    .pub-input {
      width: 100%; padding: 14px 18px;
      border: 2px solid #e0f0f0; border-radius: 12px;
      font-family: 'Poppins', sans-serif; font-size: .95rem;
      color: ${DARK}; background: #fff; outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    .pub-input:focus { border-color: ${TURQ}; box-shadow: 0 0 0 4px ${TURQ}18; }
    .pub-label {
      display: block; font-size: .72rem; font-weight: 600;
      letter-spacing: .1em; color: #7a9a9a; text-transform: uppercase;
      margin-bottom: 6px; font-family: 'Poppins', sans-serif;
    }
    .num-cell {
      width: 100%; aspect-ratio: 1;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; cursor: pointer;
      font-family: 'Poppins', sans-serif; font-size: .72rem; font-weight: 700;
      transition: transform .12s, box-shadow .12s;
      border: 2px solid transparent; user-select: none;
    }
    .num-cell:hover { transform: scale(1.15); z-index: 2; }
    .num-cell.disponible { background: #fff; border-color: #d0ecec; color: ${DARK}; }
    .num-cell.disponible:hover { border-color: ${TURQ}; box-shadow: 0 4px 16px ${TURQ}44; background: ${TURQ}08; }
    .num-cell.vendido_1  { background: #fff8e0; border-color: #ffd166; color: #b8860b; cursor: not-allowed; }
    .num-cell.agotado    { background: #ffe8e8; border-color: #ffaaaa; color: #c0392b; cursor: not-allowed; }
    .num-cell.reservado  { background: #e8f4ff; border-color: #a0c8ff; color: #2874a6; cursor: not-allowed; }
    .num-cell.seleccionado { background: linear-gradient(135deg,${TURQ},${TURQ2}); border-color: ${TURQ_DK}; color: #fff; transform: scale(1.18); box-shadow: 0 6px 20px ${TURQ}66; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    .shimmer {
      background: linear-gradient(90deg,#e8f0f0 25%,#f4fafa 50%,#e8f0f0 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
      border-radius: 12px;
    }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse-ring {
      0%   { transform: scale(.95); box-shadow: 0 0 0 0 ${TURQ}66; }
      70%  { transform: scale(1);   box-shadow: 0 0 0 12px ${TURQ}00; }
      100% { transform: scale(.95); box-shadow: 0 0 0 0  ${TURQ}00; }
    }
    .nav-link { font-family:'Poppins', sans-serif; font-weight:500; color:${DARK}88; text-decoration:none; font-size:.9rem; transition:color .2s; cursor:pointer; }
    .nav-link:hover { color:${TURQ}; }
  `;
  document.head.appendChild(s);
};

/* ════════════════════════════════════════════════════════
   MODAL: Reservar número
════════════════════════════════════════════════════════ */
function ModalReserva({ rifa, numero, onClose, onSuccess }) {
  // Flujo unificado: datos + comprobante OBLIGATORIO → número queda ocupado al instante
  const [step, setStep]       = useState(1); // 1=datos+comprobante, 2=confirmado
  const [form, setForm]       = useState({ nombre:'', telefono:'', metodo_pago:'' });
  const [imagen, setImagen]   = useState(null);   // preview local
  const [imgB64, setImgB64]   = useState('');     // base64 completo para enviar
  const [imgNombre, setImgN]  = useState('');
  const [compError, setCompError] = useState(''); // error si no sube comprobante
  const [sending, setSending] = useState(false);
  const [reservaId, setReservaId] = useState('');
  const fileRef = useRef();

  const upd = (k,v) => setForm(p => ({...p,[k]:v}));

  // Convierte el archivo a base64 con FileReader
  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      setCompError('La imagen debe ser menor a 6 MB');
      return;
    }
    setCompError('');
    setImagen(URL.createObjectURL(f));
    setImgN(f.name);
    const reader = new FileReader();
    reader.onload = ev => setImgB64(ev.target.result); // incluye "data:image/...;base64,..."
    reader.readAsDataURL(f);
  };

  const handleEnviar = async () => {
    if (!form.nombre.trim()) { setCompError('Ingresa tu nombre completo'); return; }
    if (!imgB64) { setCompError('El comprobante de pago es obligatorio para reservar el número'); return; }
    setCompError('');
    setSending(true);
    try {
      const r = await API.post('/publico/reservar', {
        rifa_id:              rifa.id,
        numero,
        nombre_cliente:       form.nombre,
        telefono:             form.telefono,
        metodo_pago:          form.metodo_pago,
        comprobante_base64:   imgB64,       // base64 obligatorio
        comprobante_nombre:   imgNombre,
      });
      setReservaId(r.data.reserva.id);
      setStep(2);          // → pantalla de confirmado
      onSuccess && onSuccess(); // refresca el grid → número aparece como reservado
    } catch (e) {
      setCompError(e.response?.data?.error || 'Error al enviar la reserva, intenta de nuevo');
    } finally { setSending(false); }
  };

  const P = { fontFamily:"'Poppins', sans-serif" };
  const M = { fontFamily:"'Poppins', sans-serif" };
  const D = { fontFamily:"'Poppins', sans-serif" };

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(10,30,30,.6)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:24, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,60,60,.25)', animation:'fadeUp .3s ease' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:'24px 24px 0 0', padding:'24px 28px 20px', position:'relative' }}>
          <button onClick={onClose} style={{ position:'absolute', top:16, right:20, background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          <div style={{ ...M, fontSize:'.58rem', color:'rgba(255,255,255,.75)', letterSpacing:'0.5px', marginBottom:6 }}>RESERVAR NÚMERO</div>
          <div style={{ ...P, fontSize:'2.8rem', color:'#fff', lineHeight:1 }}>{numero}</div>
          <div style={{ ...D, fontSize:'.88rem', color:'rgba(255,255,255,.8)', marginTop:4 }}>{rifa.nombre} · {fmt(rifa.precio)}</div>
          {/* Steps */}
          <div style={{ display:'flex', gap:6, marginTop:16 }}>
            {[1,2].map(s => (
              <div key={s} style={{ flex:1, height:3, borderRadius:2, background: s <= step ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.25)', transition:'background .3s' }}></div>
            ))}
          </div>
        </div>

        <div style={{ padding:'24px 28px 28px' }}>

          {/* STEP 1: Datos + Comprobante (todo en uno) */}
          {step === 1 && (
            <div style={{ animation:'fadeUp .25s ease' }}>

              {/* Número seleccionado — destacado */}
              <div style={{ background:`linear-gradient(135deg,${TURQ}12,${TURQ2}18)`, border:`1.5px solid ${TURQ}33`, borderRadius:14, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ ...D, fontSize:'.65rem', color:TURQ_DK, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Número seleccionado</div>
                  <div style={{ ...P, fontSize:'2.2rem', color:TURQ, lineHeight:1, fontWeight:900 }}>{numero}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ ...D, fontSize:'.65rem', color:`${DARK}66`, fontWeight:500, marginBottom:2 }}>Valor</div>
                  <div style={{ ...P, fontSize:'1.3rem', color:DARK, fontWeight:700 }}>{fmt(rifa.precio)}</div>
                </div>
              </div>

              {/* Datos personales */}
              <div style={{ ...D, fontSize:'.8rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>① Tus datos</div>
              <div style={{ marginBottom:12 }}>
                <label className="pub-label">Nombre completo *</label>
                <input className="pub-input" value={form.nombre} onChange={e=>upd('nombre',e.target.value)} placeholder="¿Cómo te llamas?" autoFocus />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                <div>
                  <label className="pub-label">WhatsApp / Teléfono</label>
                  <input className="pub-input" value={form.telefono} onChange={e=>upd('telefono',e.target.value)} placeholder="+58 / +57..." />
                </div>
                <div>
                  <label className="pub-label">Método de pago</label>
                  <select className="pub-input" value={form.metodo_pago} onChange={e=>upd('metodo_pago',e.target.value)} style={{ cursor:'pointer' }}>
                    <option value="">Selecciona...</option>
                    <option>Pago Móvil</option>
                    <option>Nequi</option>
                    <option>Bancolombia</option>
                    <option>Zelle</option>
                    <option>Efectivo</option>
                    <option>Otro</option>
                  </select>
                </div>
              </div>

              {/* Comprobante obligatorio */}
              <div style={{ ...D, fontSize:'.8rem', color:TURQ_DK, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                ② Comprobante de pago
                <span style={{ background:'#ff6b6b', color:'#fff', fontSize:'.55rem', padding:'2px 7px', borderRadius:4, fontWeight:700 }}>OBLIGATORIO</span>
              </div>
              <div style={{ ...D, fontSize:'.82rem', color:`${DARK}66`, marginBottom:12, lineHeight:1.5 }}>
                Realiza el pago y sube la captura del comprobante. El número queda <strong style={{color:TURQ_DK}}>bloqueado para ti</strong> en cuanto se envíe.
              </div>

              {/* Zona de subida */}
              <div onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${imgB64 ? TURQ : compError ? '#ff6b6b' : '#c0dede'}`, borderRadius:16, padding:'20px 16px', textAlign:'center', cursor:'pointer', marginBottom:4, background: imgB64 ? `${TURQ}08` : compError ? '#fff5f5' : '#f8fdfd', transition:'all .2s', minHeight:110, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
                {imagen ? (
                  <div style={{ width:'100%' }}>
                    <img src={imagen} alt="Comprobante" style={{ maxWidth:'100%', maxHeight:180, objectFit:'contain', borderRadius:10, marginBottom:8, display:'block', margin:'0 auto 8px' }} />
                    <div style={{ ...D, fontSize:'.72rem', color:TURQ, fontWeight:600 }}>✓ {imgNombre}</div>
                    <div style={{ ...D, fontSize:'.68rem', color:`${DARK}55`, marginTop:2 }}>Toca para cambiar la imagen</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:'2.2rem', marginBottom:8, opacity:.6 }}>📸</div>
                    <div style={{ ...D, fontSize:'.88rem', color:`${DARK}77`, fontWeight:600 }}>Toca aquí para subir el comprobante</div>
                    <div style={{ ...D, fontSize:'.72rem', color:'#aaa', marginTop:4 }}>JPG · PNG · WEBP · máximo 6 MB</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleFile} style={{ display:'none' }} />
              </div>

              {/* Mensaje de error */}
              {compError && (
                <div style={{ background:'#fff0f0', border:'1px solid #ffcccc', borderRadius:8, padding:'8px 12px', marginBottom:12, marginTop:8, ...D, fontSize:'.78rem', color:'#c0392b', fontWeight:500 }}>
                  ⚠️ {compError}
                </div>
              )}

              <div style={{ marginTop:20 }}>
                <button className="pub-btn" onClick={handleEnviar} disabled={sending}
                  style={{ width:'100%', justifyContent:'center', fontSize:'1rem', padding:'16px', borderRadius:14, opacity: sending ? .7 : 1 }}>
                  {sending
                    ? <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⏳</span> Enviando y bloqueando número...</>
                    : '🎟 Confirmar reserva y bloquear número'}
                </button>
                {!imgB64 && (
                  <div style={{ ...D, fontSize:'.72rem', color:'#aaa', textAlign:'center', marginTop:8 }}>
                    Sube el comprobante para poder enviar
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Número bloqueado — confirmación */}
          {step === 2 && (
            <div style={{ textAlign:'center', animation:'fadeUp .25s ease', padding:'10px 0' }}>
              {/* Ícono animado */}
              <div style={{ width:80, height:80, borderRadius:'50%', background:`linear-gradient(135deg,${TURQ},${TURQ2})`, margin:'0 auto 20px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', animation:'pulse-ring 2s infinite' }}>
                🔒
              </div>
              <div style={{ ...P, fontSize:'1.7rem', color:DARK, marginBottom:6, fontWeight:800 }}>¡Número bloqueado!</div>
              <div style={{ ...D, fontSize:'.9rem', color:`${DARK}77`, marginBottom:20, lineHeight:1.7 }}>
                El número <strong style={{ color:TURQ, fontSize:'1.4rem' }}>{numero}</strong> está reservado a tu nombre.<br/>
                Nadie más puede tomarlo mientras el administrador verifica tu pago.
              </div>

              {/* Estado visual */}
              <div style={{ background:`${TURQ}10`, border:`1.5px solid ${TURQ}30`, borderRadius:14, padding:'16px 18px', marginBottom:16, textAlign:'left' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { icon:'✅', label:'Número bloqueado',     valor: numero,               color: TURQ    },
                    { icon:'⏳', label:'Estado del pago',      valor: 'Pendiente de verificación', color: '#f5a623' },
                    { icon:'📋', label:'ID de reserva',        valor: reservaId?.slice(0,8).toUpperCase() + '...', color: `${DARK}88` },
                  ].map(({icon,label,valor,color}) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ ...D, fontSize:'.8rem', color:`${DARK}66` }}>{icon} {label}</div>
                      <div style={{ ...D, fontSize:'.85rem', color, fontWeight:700 }}>{valor}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso */}
              <div style={{ background:'#fffbf0', border:'1px solid #ffe08a', borderRadius:10, padding:'10px 14px', marginBottom:24, ...D, fontSize:'.78rem', color:'#7a6000', lineHeight:1.6 }}>
                📲 El administrador revisará tu comprobante y confirmará o liberará el número. Te notificaremos pronto.
              </div>

              <button className="pub-btn" onClick={onClose} style={{ width:'100%', justifyContent:'center', fontSize:'1rem', padding:'14px', borderRadius:14 }}>
                Entendido 👍
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SECCIÓN: Grid de números
════════════════════════════════════════════════════════ */
function GridNumeros({ rifa, onSelectNumero }) {
  const [numeros,   setNumeros]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filtro,    setFiltro]    = useState('todos');
  const [busqueda,  setBusqueda]  = useState('');
  const [seleccionado, setSel]    = useState(null);

  const P = { fontFamily:"'Poppins', sans-serif" };
  const M = { fontFamily:"'Poppins', sans-serif" };
  const D = { fontFamily:"'Poppins', sans-serif" };

  useEffect(() => {
    setLoading(true);
    API.get(`/publico/rifas/${rifa.id}/numeros-disponibles`)
      .then(r => { setNumeros(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rifa.id]);

  const estadoColor = { disponible:'#06d6a0', vendido_1:'#ffc107', agotado:'#e63946', reservado:'#3b9ddd' };
  const estadoLabel = { disponible:'Disponibles', vendido_1:'1 venta', agotado:'Agotados', reservado:'Reservados' };

  const totales = numeros.reduce((a,n) => { a[n.estado]=(a[n.estado]||0)+1; return a; }, {});

  const visible = numeros.filter(n => {
    if (filtro !== 'todos' && n.estado !== filtro) return false;
    if (busqueda && !n.numero.includes(busqueda.padStart(3,'0').slice(-3))) return false;
    return true;
  });

  const handleCelda = (n) => {
    if (n.estado !== 'disponible') return;
    setSel(n.numero === seleccionado ? null : n.numero);
  };

  const handleComprar = () => {
    if (!seleccionado) return;
    onSelectNumero(seleccionado);
  };

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(40px,1fr))', gap:5, padding:'20px 0' }}>
      {Array.from({length:100}).map((_,i) => <div key={i} className="shimmer" style={{ height:40, borderRadius:8 }}></div>)}
    </div>
  );

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        {Object.entries(totales).map(([est, n]) => (
          <div key={est} onClick={() => setFiltro(filtro===est?'todos':est)}
            style={{ background: filtro===est ? `${estadoColor[est]}20` : '#fff', border:`2px solid ${filtro===est ? estadoColor[est] : '#e0ecec'}`, borderRadius:50, padding:'6px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .2s' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:estadoColor[est], flexShrink:0 }}></div>
            <span style={{ ...M, fontSize:'.6rem', color: filtro===est ? estadoColor[est] : `${DARK}88` }}>{estadoLabel[est]}: {n}</span>
          </div>
        ))}
        {filtro !== 'todos' && (
          <button onClick={() => setFiltro('todos')} style={{ background:'none', border:'none', ...M, fontSize:'.58rem', color:'#aaa', cursor:'pointer' }}>✕ ver todos</button>
        )}
      </div>

      {/* Buscador */}
      <div style={{ position:'relative', marginBottom:16 }}>
        <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', ...M, fontSize:'.8rem', color:'#aaa' }}>🔍</span>
        <input className="pub-input" value={busqueda} onChange={e=>setBusqueda(e.target.value.replace(/\D/,'').slice(0,3))}
          placeholder="Buscar número (ej: 007)" style={{ paddingLeft:44 }} maxLength={3} />
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(42px,1fr))', gap:5 }}>
        {visible.map(n => (
          <div key={n.numero}
            className={`num-cell ${n.numero === seleccionado ? 'seleccionado' : n.estado}`}
            onClick={() => handleCelda(n)}
            title={n.estado !== 'disponible' ? `${n.numero} — ${estadoLabel[n.estado]}` : `Número ${n.numero}`}>
            {n.numero}
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, ...D, color:'#aaa' }}>
            No hay números que coincidan
          </div>
        )}
      </div>

      {/* Botón flotante cuando hay selección */}
      {seleccionado && (
        <div style={{ position:'sticky', bottom:16, marginTop:20, animation:'fadeUp .2s ease' }}>
          <button className="pub-btn" onClick={handleComprar}
            style={{ width:'100%', justifyContent:'center', borderRadius:16, padding:'16px', fontSize:'1.05rem', boxShadow:`0 12px 32px ${TURQ}55` }}>
            🎟 Reservar número {seleccionado} por {fmt(rifa.precio)}
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   CARD de rifa
════════════════════════════════════════════════════════ */
function RifaCard({ rifa, onSeleccionar }) {
  const P = { fontFamily:"'Poppins', sans-serif" };
  const M = { fontFamily:"'Poppins', sans-serif" };
  const D = { fontFamily:"'Poppins', sans-serif" };

  const pct = Math.min(100, (rifa.numeros_vendidos / 1000) * 100);

  return (
    <div style={{ background:'#fff', borderRadius:24, overflow:'hidden', boxShadow:'0 4px 24px rgba(10,100,100,.08)', transition:'transform .2s, box-shadow .2s' }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-6px)';e.currentTarget.style.boxShadow=`0 16px 48px rgba(10,180,180,.15)`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 4px 24px rgba(10,100,100,.08)';}}>

      {/* Imagen */}
      <div style={{ position:'relative', height:220, overflow:'hidden', background:`linear-gradient(135deg,${TURQ}22,${TURQ2}33)` }}>
        {rifa.imagen_url ? (
          <img src={rifa.imagen_url} alt={rifa.nombre} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:`linear-gradient(135deg,${TURQ}18,${TURQ2}28)` }}>
            <div style={{ ...P, fontSize:'3rem', color:`${TURQ}44` }}>🎰</div>
          </div>
        )}
        {/* Badge precio */}
        <div style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,.95)', borderRadius:50, padding:'6px 14px', backdropFilter:'blur(8px)', boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
          <span style={{ ...M, fontSize:'.72rem', color:TURQ_DK, fontWeight:700 }}>{fmt(rifa.precio)}</span>
        </div>
      </div>

      <div style={{ padding:'20px 22px 22px' }}>
        <div style={{ ...M, fontSize:'.55rem', color:`${TURQ}99`, letterSpacing:'0.5px', marginBottom:6 }}>
          {rifa.loteria_ref || 'SORTEO'} · {fmtF(rifa.fecha_sorteo)}
        </div>
        <div style={{ ...P, fontSize:'1.35rem', color:DARK, lineHeight:1.2, marginBottom:8 }}>{rifa.nombre}</div>
        <div style={{ ...D, fontSize:'.88rem', color:`${DARK}77`, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
          🏆 <span style={{ fontWeight:600, color:DARK }}>{rifa.premio}</span>
        </div>

        {/* Barra de progreso */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ ...M, fontSize:'.56rem', color:`${DARK}66` }}>{rifa.numeros_vendidos} vendidos</span>
            <span style={{ ...M, fontSize:'.56rem', color:TURQ }}>{pct.toFixed(1)}%</span>
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

/* ════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════════════════ */
export default function ClientePublico() {
  const [rifas,    setRifas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [rifaSel,  setRifaSel]  = useState(null);
  const [numReserva, setNumReserva] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const gridRef = useRef();

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    API.get('/publico/rifas')
      .then(r => { setRifas(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  const handleSelRifa = (rifa) => {
    setRifaSel(rifa);
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
  };

  const P = { fontFamily:"'Poppins', sans-serif" };
  const M = { fontFamily:"'Poppins', sans-serif" };
  const D = { fontFamily:"'Poppins', sans-serif" };

  return (
    <div style={{ minHeight:'100vh', background:'#f0fafa' }}>

      {/* NAVBAR */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(240,250,250,.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid #d0ecec', padding:'0 5vw' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>🎰</div>
            <div style={{ ...P, fontSize:'1.3rem', color:DARK }}>Rifas Jordyn</div>
          </div>
          <div style={{ display:'flex', gap:28 }}>
            <span className="nav-link" onClick={() => document.getElementById('rifas-sec')?.scrollIntoView({behavior:'smooth'})}>Rifas</span>
            <span className="nav-link" onClick={() => document.getElementById('pagos-sec')?.scrollIntoView({behavior:'smooth'})}>Cómo pagar</span>
            <span className="nav-link" onClick={() => document.getElementById('contacto-sec')?.scrollIntoView({behavior:'smooth'})}>Contacto</span>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:`linear-gradient(135deg,${TURQ} 0%,${TURQ2} 40%,#00b8b5 100%)`, padding:'80px 5vw 100px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        {/* Formas decorativas */}
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}></div>
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}></div>
        <div style={{ position:'absolute', top:'40%', left:'10%', width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.06)' }}></div>

        <div style={{ position:'relative', maxWidth:680, margin:'0 auto' }}>
          <div style={{ ...M, fontSize:'.65rem', color:'rgba(255,255,255,.75)', letterSpacing:'2px', marginBottom:16 }}>🎟 TÁCHIRA, VENEZUELA</div>
          <h1 style={{ ...P, fontSize:'clamp(2.8rem,7vw,4.5rem)', color:'#fff', lineHeight:1.05, fontWeight:800, marginBottom:20 }}>
            Gana premios<br/>increíbles
          </h1>
          <p style={{ ...D, fontSize:'1.1rem', color:'rgba(255,255,255,.85)', lineHeight:1.7, marginBottom:36, maxWidth:480, margin:'0 auto 36px' }}>
            Escoge tu número de la suerte, realiza el pago y participa en nuestros sorteos semanales.
          </p>
          <button className="pub-btn" onClick={() => document.getElementById('rifas-sec')?.scrollIntoView({behavior:'smooth'})}
            style={{ background:'rgba(255,255,255,.95)', color:TURQ_DK, boxShadow:'0 8px 32px rgba(0,0,0,.15)', fontSize:'1rem', padding:'16px 36px' }}>
            Ver rifas disponibles ↓
          </button>
        </div>

        {/* Ola inferior */}
        <svg viewBox="0 0 1440 60" style={{ position:'absolute', bottom:-1, left:0, width:'100%' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" fill="#f0fafa"/>
        </svg>
      </section>

      {/* RIFAS DISPONIBLES */}
      <section id="rifas-sec" style={{ padding:'80px 5vw', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:50 }}>
          <div style={{ ...M, fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12 }}>PARTICIPAR ES FÁCIL</div>
          <h2 style={{ ...P, fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Rifas activas</h2>
          <p style={{ ...D, fontSize:'1rem', color:`${DARK}77`, maxWidth:480, margin:'0 auto' }}>
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
            <div style={{ ...P, fontSize:'1.4rem', color:`${DARK}66` }}>No hay rifas activas por ahora</div>
            <div style={{ ...D, fontSize:'.9rem', color:`${DARK}44`, marginTop:8 }}>Vuelve pronto para ver nuevos sorteos</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:28 }}>
            {rifas.map(r => <RifaCard key={r.id} rifa={r} onSeleccionar={handleSelRifa} />)}
          </div>
        )}
      </section>

      {/* GRID DE NÚMEROS (aparece al seleccionar rifa) */}
      {rifaSel && (
        <section ref={gridRef} style={{ padding:'0 5vw 80px', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ background:'#fff', borderRadius:28, padding:'36px 32px', boxShadow:'0 8px 48px rgba(10,180,180,.1)' }}>

            {/* Header sección */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:28, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ ...M, fontSize:'.58rem', color:TURQ, letterSpacing:'0.5px', marginBottom:6 }}>ESCOGE TU NÚMERO</div>
                <div style={{ ...P, fontSize:'1.6rem', color:DARK, marginBottom:4 }}>{rifaSel.nombre}</div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  <span style={{ ...D, fontSize:'.85rem', color:`${DARK}77` }}>🏆 {rifaSel.premio}</span>
                  <span style={{ ...D, fontSize:'.85rem', color:`${DARK}77` }}>💰 {fmt(rifaSel.precio)} / número</span>
                  <span style={{ ...D, fontSize:'.85rem', color:`${DARK}77` }}>📅 {fmtF(rifaSel.fecha_sorteo)}</span>
                </div>
              </div>
              <button onClick={() => setRifaSel(null)} className="pub-btn-outline" style={{ padding:'10px 20px', flexShrink:0 }}>
                Cambiar rifa
              </button>
            </div>

            {/* Instrucciones */}
            <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
              {[
                { n:'1', t:'Selecciona', d:'Toca un número disponible' },
                { n:'2', t:'Reserva',    d:'Llena tus datos y sube el comprobante' },
                { n:'3', t:'Confirma',   d:'El admin verifica y confirma tu número' },
              ].map(({n,t,d}) => (
                <div key={n} style={{ flex:'1 1 140px', background:'#f8fdfd', borderRadius:12, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:28, height:28, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ ...M, fontSize:'.6rem', color:'#fff', fontWeight:700 }}>{n}</span>
                  </div>
                  <div>
                    <div style={{ ...D, fontSize:'.82rem', fontWeight:600, color:DARK }}>{t}</div>
                    <div style={{ ...D, fontSize:'.76rem', color:`${DARK}66` }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>

            <GridNumeros
              key={`${rifaSel.id}-${refreshKey}`}
              rifa={rifaSel}
              onSelectNumero={n => setNumReserva(n)}
            />
          </div>
        </section>
      )}

      {/* CÓMO PARTICIPAR */}
      <section style={{ background:'#fff', padding:'70px 5vw 0' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:50 }}>
            <div style={{ ...M, fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12, fontWeight:600 }}>SIN COMPLICACIONES</div>
            <h2 style={{ ...P, fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Cómo participar</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:24 }}>
            {[
              { icon:'🔢', titulo:'1. Elige tu número', desc:'Navega por el grid y selecciona el número de la suerte que más te guste.' },
              { icon:'💳', titulo:'2. Realiza el pago', desc:'Transfiérenos el valor del boleto a cualquiera de nuestros métodos de pago disponibles.' },
              { icon:'📸', titulo:'3. Sube el comprobante', desc:'Adjunta la captura o foto del comprobante junto con tus datos de contacto.' },
              { icon:'✅', titulo:'4. Confirmación', desc:'El administrador verifica el pago y confirma tu número. ¡Ya estás participando!' },
            ].map(({icon,titulo,desc}) => (
              <div key={titulo} style={{ textAlign:'center', padding:'24px 20px' }}>
                <div style={{ width:64, height:64, background:`linear-gradient(135deg,${TURQ}18,${TURQ2}28)`, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:'1.8rem' }}>{icon}</div>
                <div style={{ ...P, fontSize:'1.1rem', color:DARK, fontWeight:700, marginBottom:8 }}>{titulo}</div>
                <div style={{ ...D, fontSize:'.88rem', color:`${DARK}77`, lineHeight:1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CUENTAS BANCARIAS */}
      <section id="pagos-sec" style={{ background:'#fff', padding:'70px 5vw 80px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:50 }}>
            <div style={{ ...M, fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:12, fontWeight:600 }}>MÉTODOS DE PAGO</div>
            <h2 style={{ ...P, fontSize:'clamp(2rem,4vw,2.8rem)', color:DARK, fontWeight:800, marginBottom:14 }}>Cuentas bancarias</h2>
            <p style={{ ...D, fontSize:'1rem', color:`${DARK}77`, maxWidth:480, margin:'0 auto' }}>
              Realiza tu pago a través de cualquiera de estas cuentas y adjunta el comprobante al reservar tu número.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>

            {/* NEQUI */}
            <div style={{ background:'#fdf0f9', border:'2px solid #f0c0e8', borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(225,0,152,.06)' }}></div>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', background:'#fff', border:'1px solid #f0c0e8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:4 }}>
                  {/* ↓ REEMPLAZA "NEQUI_LOGO_URL" CON EL LINK DIRECTO A LA IMAGEN DEL LOGO DE NEQUI */}
                  <img src="https://www.misole.co/wp-content/uploads/2021/08/NEQUI-LOGO.jpg" alt="Nequi"
                    onError={e=>{e.target.style.display="none";e.target.parentNode.style.background="linear-gradient(135deg,#e10098,#c2007a)";e.target.parentNode.innerHTML="<span style=\"color:#fff;font-weight:800;font-size:.8rem;font-family:Poppins,sans-serif\">N</span>";}}
                    style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                </div>
                <div>
                  <div style={{ ...P, fontSize:'1.2rem', color:'#c2007a', fontWeight:700 }}>Nequi</div>
                  <div style={{ ...D, fontSize:'.75rem', color:'#c2007a99', fontWeight:500 }}>Colombia</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {[{l:'Nro de producto',v:'3224012780'},{l:'Titular',v:'Carmen Rangel'}].map(({l,v})=>(
                  <div key={l} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'10px 14px' }}>
                    <div style={{ ...D, fontSize:'.66rem', color:'#c2007a88', fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
                    <div style={{ ...D, fontSize:'.95rem', color:'#7a0050', fontWeight:700 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'rgba(225,0,152,.1)', borderRadius:10, padding:'8px 12px', textAlign:'center' }}>
                <span style={{ ...D, fontSize:'.75rem', color:'#c2007a', fontWeight:600 }}>⚠️ Solo pagos de Nequi a Nequi</span>
              </div>
            </div>

            {/* BANCOLOMBIA */}
            <div style={{ background:'#fff8e1', border:'2px solid #ffe082', borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,160,0,.08)' }}></div>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', background:'#fff', border:'1px solid #ffe082', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:4 }}>
                  {/* ↓ REEMPLAZA "BANCOLOMBIA_LOGO_URL" CON EL LINK DIRECTO A LA IMAGEN DEL LOGO DE BANCOLOMBIA */}
                  <img src="https://wldcol.com/assets/bancolombia.png" alt="Bancolombia"
                    onError={e=>{e.target.style.display="none";e.target.parentNode.style.background="linear-gradient(135deg,#fdb71a,#e6a000)";e.target.parentNode.innerHTML="<span style=\"color:#fff;font-weight:800;font-size:.65rem;font-family:Poppins,sans-serif\">BCO</span>";}}
                    style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                </div>
                <div>
                  <div style={{ ...P, fontSize:'1.2rem', color:'#b8860b', fontWeight:700 }}>Bancolombia</div>
                  <div style={{ ...D, fontSize:'.75rem', color:'#b8860b99', fontWeight:500 }}>Colombia</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {[{l:'Tipo',v:'Cuenta de Ahorros'},{l:'Nro de cuenta',v:'08820968591'},{l:'Titular',v:'Jordyn Ramirez'}].map(({l,v})=>(
                  <div key={l} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'10px 14px' }}>
                    <div style={{ ...D, fontSize:'.66rem', color:'#b8860b88', fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
                    <div style={{ ...D, fontSize:'.95rem', color:'#7a5c00', fontWeight:700 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'rgba(255,160,0,.12)', borderRadius:10, padding:'8px 12px', textAlign:'center' }}>
                <span style={{ ...D, fontSize:'.75rem', color:'#b8860b', fontWeight:600 }}>⚠️ Solo pagos de Bancolombia a Bancolombia</span>
              </div>
            </div>

            {/* ZELLE */}
            <div style={{ background:'#f0f4ff', border:'2px solid #c5d3ff', borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(100,118,255,.06)' }}></div>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', background:'#fff', border:'1px solid #c5d3ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:4 }}>
                  {/* ↓ REEMPLAZA "ZELLE_LOGO_URL" CON EL LINK DIRECTO A LA IMAGEN DEL LOGO DE ZELLE */}
                  <img src="https://colombianabroad.com/wp-content/uploads/services/zelle-logo.png" alt="Zelle"
                    onError={e=>{e.target.style.display="none";e.target.parentNode.style.background="linear-gradient(135deg,#6476ff,#8b4cf7)";e.target.parentNode.innerHTML="<span style=\"color:#fff;font-weight:800;font-size:.8rem;font-family:Poppins,sans-serif\">Z</span>";}}
                    style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                </div>
                <div>
                  <div style={{ ...P, fontSize:'1.2rem', color:'#4a5bbf', fontWeight:700 }}>Zelle</div>
                  <div style={{ ...D, fontSize:'.75rem', color:'#4a5bbf99', fontWeight:500 }}>Estados Unidos · USD</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {[{l:'Correo',v:'angelespinosag00@gmail.com'},{l:'Nombre',v:'Angel Espinosa'},{l:'Tasa de cambio',v:'$1 USD = 3,380'},{l:'Mínimo',v:'Pagos desde $10 USD'}].map(({l,v})=>(
                  <div key={l} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'10px 14px' }}>
                    <div style={{ ...D, fontSize:'.66rem', color:'#4a5bbf88', fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
                    <div style={{ ...D, fontSize:'.95rem', color:'#2a3880', fontWeight:700 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'rgba(100,118,255,.1)', borderRadius:10, padding:'8px 12px', textAlign:'center' }}>
                <span style={{ ...D, fontSize:'.75rem', color:'#4a5bbf', fontWeight:600 }}>⚠️ No colocar descripción ni concepto de pago</span>
              </div>
            </div>

            {/* PAGO MÓVIL */}
            <div style={{ background:'#f0fff8', border:`2px solid ${TURQ}55`, borderRadius:20, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:`rgba(10,191,188,.06)` }}></div>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', background:'#fff', border:`1px solid ${TURQ}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:4 }}>
                  {/* ↓ REEMPLAZA "PAGOMOVIL_LOGO_URL" CON EL LINK DIRECTO A LA IMAGEN DEL LOGO DE BANCO DE VENEZUELA O PAGO MÓVIL */}
                  <img src="PAGOMOVIL_LOGO_URL" alt="Pago Móvil"
                    onError={e=>{e.target.style.display="none";e.target.parentNode.style.background=`linear-gradient(135deg,#0abfbc,#00d4d0)`;e.target.parentNode.innerHTML="<span style=\"color:#fff;font-weight:800;font-size:.55rem;font-family:Poppins,sans-serif;text-align:center;line-height:1.3\">PAGO<br/>MÓVIL</span>";}}
                    style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                </div>
                <div>
                  <div style={{ ...P, fontSize:'1.2rem', color:TURQ_DK, fontWeight:700 }}>Pago Móvil</div>
                  <div style={{ ...D, fontSize:'.75rem', color:`${TURQ_DK}99`, fontWeight:500 }}>Banco de Venezuela</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {[{l:'Banco',v:'Banco de Venezuela'},{l:'Teléfono',v:'04129287210'},{l:'Cédula',v:'V-23542583'}].map(({l,v})=>(
                  <div key={l} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'10px 14px' }}>
                    <div style={{ ...D, fontSize:'.66rem', color:`${TURQ_DK}88`, fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
                    <div style={{ ...D, fontSize:'.95rem', color:DARK, fontWeight:700 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:`rgba(10,191,188,.1)`, borderRadius:10, padding:'8px 12px', textAlign:'center' }}>
                <span style={{ ...D, fontSize:'.75rem', color:TURQ_DK, fontWeight:600 }}>🇻🇪 Venezuela · Bolívares</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER / CONTACTO */}
      <footer id="contacto-sec" style={{ background:DARK, padding:'60px 5vw 40px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, marginBottom:40 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:40, height:40, background:`linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem' }}>🎰</div>
                <div style={{ ...P, fontSize:'1.3rem', color:'#fff' }}>Rifas Jordyn</div>
              </div>
              <p style={{ ...D, fontSize:'.88rem', color:'rgba(255,255,255,.5)', lineHeight:1.7 }}>
                Sorteos semanales con premios increíbles.<br/>Táchira, Venezuela.
              </p>
            </div>
            <div>
              <div style={{ ...M, fontSize:'.62rem', color:TURQ, letterSpacing:'0.5px', marginBottom:16 }}>CONTACTO</div>
              <div style={{ ...D, fontSize:'.9rem', color:'rgba(255,255,255,.7)', lineHeight:2 }}>
                <div>📱 WhatsApp disponible</div>
                <div>📍 Táchira, Venezuela</div>
              </div>
            </div>
            <div>
              <div style={{ ...M, fontSize:'.62rem', color:TURQ, letterSpacing:'0.5px', marginBottom:16 }}>ACCESO ADMINISTRADOR</div>
              <a href="/login" style={{ ...D, fontSize:'.88rem', color:'rgba(255,255,255,.5)', textDecoration:'none', display:'flex', alignItems:'center', gap:6, transition:'color .2s' }}
                onMouseEnter={e=>e.target.style.color=TURQ} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.5)'}>
                🔐 Iniciar sesión
              </a>
            </div>
          </div>
          <div style={{ borderTop:`1px solid rgba(255,255,255,.08)`, paddingTop:24, textAlign:'center' }}>
            <span style={{ ...M, fontSize:'.56rem', color:'rgba(255,255,255,.25)', letterSpacing:'0.5px' }}>© 2025 RIFAS JORDYN · TODOS LOS DERECHOS RESERVADOS</span>
          </div>
        </div>
      </footer>

      {/* MODAL RESERVA */}
      {numReserva && rifaSel && (
        <ModalReserva
          rifa={rifaSel}
          numero={numReserva}
          onClose={() => setNumReserva(null)}
          onSuccess={() => { setNumReserva(null); setRefreshKey(k => k+1); }}
        />
      )}
    </div>
  );
}