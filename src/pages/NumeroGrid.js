import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { TicketPreview, printTickets } from '../components/Ticket';
import API from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

/* ═══════════════════════════════════════════
   CONSTANTES DE ESTADO
═══════════════════════════════════════════ */
const ESTADO = {
  libre:           { color:'#06d6a0', bg:'rgba(6,214,160,.12)',   border:'rgba(6,214,160,.3)',  icon:'✓', label:'LIBRE' },
  parcial_vendido: { color:'#ffd166', bg:'rgba(255,209,102,.12)', border:'rgba(255,209,102,.3)',icon:'½', label:'1 VENTA' },
  parcial_agotado: { color:'#e63946', bg:'rgba(230,57,70,.15)',   border:'rgba(230,57,70,.4)', icon:'⚡', label:'SEMI AGOT.' },
  agotado_total:   { color:'#ff2030', bg:'rgba(255,32,48,.2)',    border:'rgba(255,32,48,.5)', icon:'✗', label:'AGOTADO' },
};
const EST_RIFA = {
  disponible: { color:'#06d6a0', icon:'✓', label:'DISPONIBLE' },
  vendido_1:  { color:'#ffd166', icon:'½', label:'1 DE 2 VENDIDO' },
  agotado:    { color:'#e63946', icon:'✗', label:'AGOTADO' },
};

/* ═══════════════════════════════════════════
   MODAL DE DETALLE DEL NÚMERO
═══════════════════════════════════════════ */
function NumeroModal({ numero, data, onClose, onRefresh, user }) {
  const [tab, setTab]       = useState('info');
  const [rifaSel, setRifaSel] = useState(null);
  const [form, setForm]     = useState({ nombre:'', telefono:'' });
  const [selling, setSelling] = useState(false);
  const [sold, setSold]     = useState(false);

  const rifas      = data?.rifas || [];
  const disponibles = rifas.filter(r => r.disponible);
  const esVendedor = user?.rol === 'vendedor';

  // Auto-select si solo hay 1 rifa disponible
  useEffect(() => {
    if (disponibles.length === 1) setRifaSel(disponibles[0]);
  }, [disponibles.length]);

  // Cerrar con Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const fmt = p => p
    ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p) : '$0';
  const fmtF = f => f
    ? new Date(f).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Sin fecha';

  const handleVender = async () => {
    if (!rifaSel)             return toast.error('Selecciona una rifa');
    if (!form.nombre.trim())  return toast.error('El nombre del comprador es requerido');
    setSelling(true);
    try {
      await API.post('/numeros/vender', {
        rifa_id: rifaSel.rifa_id,
        numero,
        nombre_comprador: form.nombre.trim(),
        telefono: form.telefono.trim(),
      });
      toast.success(`✅ ¡Número ${numero} vendido en ${rifaSel.rifa_nombre}!`);
      setSold(true);
      setTab('ticket');
      onRefresh && onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta';
      toast.error(msg);
    } finally {
      setSelling(false);
    }
  };

  const handlePrint = () => {
    if (!rifaSel) return;
    printTickets([rifaSel], numero, form, user?.nombre);
  };

  /* ── Tabs disponibles ── */
  const tabs = [
    { id:'info',   icon:'bi-info-circle-fill',        label:'DETALLE' },
    ...(disponibles.length > 0 ? [{ id:'vender', icon:'bi-cart-plus-fill', label:'VENDER' }] : []),
    { id:'ticket', icon:'bi-ticket-perforated-fill',  label:'BOLETO' },
  ];

  /* ── Estado global del número ── */
  const hayVentas = rifas.some(r => r.veces_vendido > 0);
  const estadoGlobal = rifas.every(r => r.estado === 'agotado')
    ? 'agotado_total'
    : rifas.some(r => r.estado === 'agotado')
    ? 'parcial_agotado'
    : rifas.some(r => r.estado === 'vendido_1')
    ? 'parcial_vendido' : 'libre';

  const ecfg = ESTADO[estadoGlobal] || ESTADO.libre;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(0,0,0,.88)',
        backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'1rem',
        animation:'bgFadeIn .2s ease',
      }}
    >
      <div style={{
        width:'100%', maxWidth:720,
        maxHeight:'92vh',
        background:'#0e0e0e',
        border:'1px solid #252525',
        borderRadius:14,
        overflow:'hidden',
        display:'flex', flexDirection:'column',
        animation:'modalPop .28s cubic-bezier(.175,.885,.32,1.275)',
        boxShadow:'0 32px 80px rgba(0,0,0,.8)',
      }}>

        {/* ────────── HEADER ────────── */}
        <div style={{
          background:'linear-gradient(135deg,#080808,#1c1800,#080808)',
          borderBottom:'2px solid #f5c518',
          padding:'16px 20px',
          display:'flex', alignItems:'center', gap:'16px',
          flexShrink:0,
        }}>
          {/* Número grande */}
          <div style={{
            fontFamily:"'Bebas Neue',cursive",
            fontSize:'4rem', color:'#f5c518',
            letterSpacing:'14px', lineHeight:1,
            paddingLeft:'14px',
            textShadow:'0 0 30px rgba(245,197,24,.45)',
            flexShrink:0,
          }}>{numero}</div>

          {/* Info del número */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem', color:'#555', letterSpacing:'4px', marginBottom:'6px' }}>
              NÚMERO SELECCIONADO
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {/* Badge estado global */}
              <span style={{
                background:ecfg.bg, border:`1px solid ${ecfg.border}`,
                color:ecfg.color, borderRadius:4,
                padding:'2px 10px',
                fontFamily:"'Share Tech Mono',monospace", fontSize:'.62rem', letterSpacing:'1px',
              }}>
                {ecfg.icon} {ecfg.label}
              </span>
              {/* Badge por rifa */}
              {rifas.map(r => {
                const rcfg = EST_RIFA[r.estado] || EST_RIFA.disponible;
                return (
                  <span key={r.rifa_id} style={{
                    background:'rgba(255,255,255,.04)', border:'1px solid #2a2a2a',
                    color:rcfg.color, borderRadius:4,
                    padding:'2px 10px',
                    fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem',
                  }}>
                    {r.rifa_nombre}: {rcfg.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Cerrar */}
          <button onClick={onClose} style={{
            background:'none', border:'1px solid #2a2a2a',
            color:'#666', borderRadius:6, padding:'6px 11px',
            cursor:'pointer', fontSize:'1rem', flexShrink:0,
            transition:'all .15s',
          }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='#555'; e.currentTarget.style.color='#ccc'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#2a2a2a'; e.currentTarget.style.color='#666'; }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* ────────── TABS ────────── */}
        <div style={{ display:'flex', borderBottom:'1px solid #1a1a1a', flexShrink:0, background:'#0a0a0a' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'11px 8px',
              background: tab===t.id ? '#0e0e0e' : 'transparent',
              border:'none',
              borderBottom: tab===t.id ? '2px solid #f5c518' : '2px solid transparent',
              color: tab===t.id ? '#f5c518' : '#555',
              cursor:'pointer',
              fontFamily:"'Bebas Neue',cursive",
              fontSize:'.88rem', letterSpacing:'2px',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
              transition:'all .15s',
            }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* ────────── CUERPO ────────── */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

          {/* ═══ TAB: DETALLE ═══ */}
          {tab === 'info' && (
            <div style={{ animation:'fadeSlide .2s ease' }}>
              {rifas.map((r, ri) => {
                const rcfg = EST_RIFA[r.estado] || EST_RIFA.disponible;
                const accentColor = ri === 0 ? '#f5c518' : '#06d6a0';
                return (
                  <div key={r.rifa_id} style={{
                    background:'#141414', border:`1px solid ${rcfg.color}22`,
                    borderRadius:10, marginBottom:12, overflow:'hidden',
                  }}>
                    {/* Rifa header */}
                    <div style={{
                      background:`linear-gradient(90deg,${accentColor}0a,transparent)`,
                      padding:'12px 16px',
                      borderBottom:'1px solid #1e1e1e',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      flexWrap:'wrap', gap:'8px',
                    }}>
                      <div>
                        <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'1.15rem', color:accentColor, letterSpacing:'2px' }}>
                          {r.rifa_nombre}
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem', color:'#666', marginTop:'2px' }}>
                          🏆 {r.premio} · {fmt(r.precio)} c/u
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{
                          background:`${rcfg.color}18`, border:`1px solid ${rcfg.color}44`,
                          color:rcfg.color, borderRadius:4, padding:'3px 12px',
                          fontFamily:"'Share Tech Mono',monospace", fontSize:'.62rem', letterSpacing:'1px',
                        }}>
                          {rcfg.icon} {rcfg.label}
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#555', marginTop:'4px' }}>
                          {r.veces_vendido} / 2 vendidos
                        </div>
                      </div>
                    </div>

                    {/* Lista de compradores */}
                    <div style={{ padding:'12px 16px' }}>
                      {r.compradores?.length === 0 ? (
                        <div style={{
                          textAlign:'center', padding:'12px 0',
                          fontFamily:"'Share Tech Mono',monospace",
                          fontSize:'.7rem', color:'#333',
                        }}>
                          — Sin ventas en esta rifa —
                        </div>
                      ) : r.compradores.map((c, ci) => (
                        <div key={ci} style={{
                          display:'flex', alignItems:'center', gap:'12px',
                          padding:'8px 0',
                          borderBottom: ci < r.compradores.length-1 ? '1px solid #1e1e1e' : 'none',
                        }}>
                          {/* Avatar número de venta */}
                          <div style={{
                            width:34, height:34,
                            background: ci===0 ? 'rgba(245,197,24,.12)' : 'rgba(6,214,160,.1)',
                            border:`1px solid ${ci===0 ? 'rgba(245,197,24,.3)' : 'rgba(6,214,160,.25)'}`,
                            borderRadius:'50%',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            flexShrink:0,
                          }}>
                            <span style={{ fontFamily:"'Bebas Neue',cursive", color: ci===0 ? '#f5c518' : '#06d6a0', fontSize:'1.1rem' }}>
                              {ci+1}
                            </span>
                          </div>

                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{
                              fontFamily:"'Oswald',sans-serif", fontWeight:600,
                              fontSize:'.92rem', color:'#e8e8e8',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            }}>
                              {c.nombre_comprador || c.comprador}
                            </div>
                            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#555', marginTop:'2px' }}>
                              Vendido por{' '}
                              <span style={{ color:'#f5c518', fontWeight:700 }}>{c.nombre_vendedor}</span>
                              {c.created_at && (
                                <span style={{ color:'#444', marginLeft:'10px' }}>
                                  {new Date(c.created_at).toLocaleDateString('es-CO')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Re-imprimir ticket */}
                          <button
                            onClick={() => {
                              setRifaSel(r);
                              setForm({ nombre: c.nombre_comprador || '', telefono: c.telefono || '' });
                              setTab('ticket');
                            }}
                            style={{
                              background:'rgba(245,197,24,.08)', border:'1px solid rgba(245,197,24,.2)',
                              color:'#f5c518', borderRadius:5, padding:'4px 10px',
                              cursor:'pointer', fontSize:'.7rem', flexShrink:0,
                              fontFamily:"'Share Tech Mono',monospace",
                              transition:'all .15s',
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(245,197,24,.15)'}
                            onMouseLeave={e=>e.currentTarget.style.background='rgba(245,197,24,.08)'}
                            title="Ver ticket"
                          >
                            <i className="bi bi-ticket-perforated"></i>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Info sorteo */}
                    {(r.fecha_sorteo || r.loteria_ref) && (
                      <div style={{
                        borderTop:'1px solid #1a1a1a', padding:'8px 16px',
                        display:'flex', gap:'18px', flexWrap:'wrap',
                        fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#555',
                      }}>
                        {r.fecha_sorteo && (
                          <span>📅 Sorteo: <span style={{ color:'#888' }}>{fmtF(r.fecha_sorteo)}</span></span>
                        )}
                        {r.loteria_ref && (
                          <span>🎲 <span style={{ color:'#888' }}>{r.loteria_ref}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* CTA si hay disponibles */}
              {disponibles.length > 0 && (
                <button
                  onClick={() => setTab('vender')}
                  className="btn-jordyn w-100"
                  style={{ marginTop:'8px', fontSize:'1rem', padding:'.75rem' }}
                >
                  <i className="bi bi-cart-plus-fill me-2"></i>
                  VENDER ESTE NÚMERO
                </button>
              )}
            </div>
          )}

          {/* ═══ TAB: VENDER ═══ */}
          {tab === 'vender' && (
            <div style={{ animation:'fadeSlide .2s ease' }}>

              {/* Selector de rifa */}
              {disponibles.length > 1 && (
                <div style={{ marginBottom:'18px' }}>
                  <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'.82rem', letterSpacing:'3px', color:'#555', marginBottom:'8px' }}>
                    SELECCIONA LA RIFA
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {disponibles.map(r => (
                      <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{
                        flex:1, padding:'10px 14px', textAlign:'left',
                        background: rifaSel?.rifa_id===r.rifa_id ? 'rgba(245,197,24,.1)' : '#141414',
                        border:`2px solid ${rifaSel?.rifa_id===r.rifa_id ? '#f5c518' : '#252525'}`,
                        borderRadius:8, cursor:'pointer', transition:'all .15s',
                      }}>
                        <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'1rem', letterSpacing:'2px', color: rifaSel?.rifa_id===r.rifa_id ? '#f5c518' : '#e8e8e8' }}>
                          {r.rifa_nombre}
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#888', marginTop:'3px' }}>
                          {r.premio}
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.65rem', color:'#06d6a0', marginTop:'4px' }}>
                          {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(r.precio)}
                          {r.veces_vendido===1 && <span style={{ color:'#ffd166', marginLeft:'8px' }}>· ya tiene 1 venta</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Layout: form + preview ticket */}
              <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', alignItems:'flex-start' }}>

                {/* Formulario */}
                <div style={{ flex:'1 1 200px', minWidth:0 }}>
                  <div style={{ marginBottom:'14px' }}>
                    <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                    <input
                      className="jd-input"
                      placeholder="Nombre completo"
                      value={form.nombre}
                      onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom:'18px' }}>
                    <label className="jd-label">TELÉFONO (opcional)</label>
                    <input
                      className="jd-input"
                      placeholder="300 000 0000"
                      type="tel"
                      value={form.telefono}
                      onChange={e => setForm(p => ({ ...p, telefono:e.target.value }))}
                    />
                  </div>

                  {rifaSel && (
                    <div style={{
                      background:'rgba(245,197,24,.06)', border:'1px solid rgba(245,197,24,.15)',
                      borderRadius:8, padding:'10px 14px', marginBottom:'14px',
                    }}>
                      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#888', marginBottom:'4px' }}>RESUMEN DE VENTA</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'1.2rem', color:'#f5c518', letterSpacing:'2px' }}>
                          #{numero} — {rifaSel.rifa_nombre}
                        </span>
                        <span style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'1.4rem', color:'#06d6a0' }}>
                          {fmt(rifaSel.precio)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn-jordyn w-100"
                    onClick={handleVender}
                    disabled={selling || !rifaSel}
                    style={{ fontSize:'1.05rem', padding:'.8rem', position:'relative' }}
                  >
                    {selling ? (
                      <>
                        <span className="jd-spinner" style={{ width:18, height:18, borderWidth:2, marginRight:8 }}></span>
                        REGISTRANDO...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-2"></i>
                        CONFIRMAR VENTA
                      </>
                    )}
                  </button>
                </div>

                {/* Preview LIVE del ticket */}
                {rifaSel && (
                  <div style={{ flex:'0 0 auto', display:'flex', justifyContent:'center' }}>
                    <TicketPreview
                      r={rifaSel}
                      numero={numero}
                      comprador={form}
                      vendedor={user?.nombre}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: BOLETO ═══ */}
          {tab === 'ticket' && (
            <div style={{ animation:'fadeSlide .2s ease' }}>

              {!rifaSel ? (
                <div>
                  {/* Si hay rifas con ventas, mostrar selector */}
                  {rifas.filter(r => r.veces_vendido > 0).length > 0 ? (
                    <>
                      <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'.82rem', letterSpacing:'3px', color:'#555', marginBottom:'10px' }}>
                        ¿DE QUÉ RIFA IMPRIMIR EL BOLETO?
                      </div>
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px' }}>
                        {rifas.filter(r => r.veces_vendido > 0).map(r => (
                          <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{
                            flex:1, minWidth:'140px', padding:'10px 14px', textAlign:'left',
                            background:'#141414', border:'2px solid #252525',
                            borderRadius:8, cursor:'pointer', transition:'all .15s',
                          }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor='#f5c518'}
                            onMouseLeave={e=>e.currentTarget.style.borderColor='#252525'}
                          >
                            <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'1rem', color:'#e8e8e8', letterSpacing:'2px' }}>{r.rifa_nombre}</div>
                            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#888', marginTop:'2px' }}>{r.veces_vendido} venta(s)</div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="jd-alert jd-alert-warning mb-3">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      Primero realiza una venta para generar el boleto.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
                    <TicketPreview
                      r={rifaSel}
                      numero={numero}
                      comprador={form}
                      vendedor={user?.nombre}
                    />
                  </div>
                  <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
                    <button
                      className="btn-jordyn"
                      onClick={handlePrint}
                      style={{ fontSize:'1rem', padding:'.75rem 2rem' }}
                    >
                      <i className="bi bi-printer-fill me-2"></i>
                      IMPRIMIR BOLETO (2 COPIAS)
                    </button>
                    <button
                      className="btn-jordyn-outline"
                      onClick={() => setRifaSel(null)}
                      style={{ padding:'.75rem 1.5rem', fontSize:'.9rem' }}
                    >
                      <i className="bi bi-arrow-left me-1"></i> CAMBIAR RIFA
                    </button>
                    <button
                      className="btn-jordyn-outline"
                      onClick={onClose}
                      style={{ padding:'.75rem 1.5rem', fontSize:'.9rem' }}
                    >
                      <i className="bi bi-x-lg me-1"></i> CERRAR
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes bgFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes modalPop  { from{opacity:0;transform:scale(.94) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PÁGINA PRINCIPAL: NumeroGrid
═══════════════════════════════════════════ */
export default function NumeroGrid() {
  const { user }  = useAuth();
  const [numeros,  setNumeros]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // Modal
  const [modalNumero,   setModalNumero]   = useState(null);
  const [modalData,     setModalData]     = useState(null);
  const [loadingModal,  setLoadingModal]  = useState(false);

  /* ── Carga datos ── */
  const loadNumeros = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/numeros/estado-global');
      setNumeros(res.data);
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNumeros(); }, [loadNumeros]);

  /* ── Click en número ── */
  const handleClick = async (n) => {
    setModalNumero(n.numero);
    setModalData(null);
    setLoadingModal(true);
    try {
      const res = await API.get(`/numeros/verificar/${n.numero}`);
      setModalData(res.data);
    } catch { toast.error('Error cargando detalle'); setModalNumero(null); }
    finally { setLoadingModal(false); }
  };

  const closeModal = () => { setModalNumero(null); setModalData(null); };

  /* ── Conteos ── */
  const conteos = {
    todos:           numeros.length,
    libre:           numeros.filter(n => n.estado_global==='libre').length,
    parcial_vendido: numeros.filter(n => n.estado_global==='parcial_vendido').length,
    parcial_agotado: numeros.filter(n => n.estado_global==='parcial_agotado').length,
    agotado_total:   numeros.filter(n => n.estado_global==='agotado_total').length,
  };

  /* ── Filtrado ── */
  const filtered = numeros.filter(n => {
    if (busqueda) {
      const q = busqueda.padStart(3,'0');
      if (!n.numero.includes(q)) return false;
    }
    if (filtro !== 'todos' && n.estado_global !== filtro) return false;
    return true;
  });

  /* ── Porcentajes para barra ── */
  const total = numeros.length || 1;
  const pctPV  = (conteos.parcial_vendido / total * 100).toFixed(1);
  const pctPA  = (conteos.parcial_agotado / total * 100).toFixed(1);
  const pctAT  = (conteos.agotado_total   / total * 100).toFixed(1);
  const pctTot = ((conteos.parcial_vendido + conteos.parcial_agotado + conteos.agotado_total) / total * 100).toFixed(0);

  const FILTROS = [
    { key:'todos',           label:'TODOS',         count:conteos.todos,           color:'#e8e8e8' },
    { key:'libre',           label:'LIBRES',         count:conteos.libre,           color:'#06d6a0' },
    { key:'parcial_vendido', label:'1 VENTA',        count:conteos.parcial_vendido, color:'#ffd166' },
    { key:'parcial_agotado', label:'SEMI AGOTADO',   count:conteos.parcial_agotado, color:'#e63946' },
    { key:'agotado_total',   label:'AGOTADO',        count:conteos.agotado_total,   color:'#ff2030' },
  ];

  return (
    <Layout title="CUADRÍCULA">

      {/* ═══ BARRA DE PROGRESO GLOBAL ═══ */}
      <div style={{
        background:'#111', border:'1px solid #1e1e1e',
        borderRadius:10, padding:'16px 20px', marginBottom:'16px',
      }}>
        {/* Stats row */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'0', marginBottom:'12px', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
            {[
              { label:'LIBRES',       val:conteos.libre,           color:'#06d6a0' },
              { label:'1 VENTA',      val:conteos.parcial_vendido, color:'#ffd166' },
              { label:'SEMI AGOT.',   val:conteos.parcial_agotado, color:'#e63946' },
              { label:'AGOTADOS',     val:conteos.agotado_total,   color:'#ff2030' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'1.8rem', color:s.color, letterSpacing:'2px', lineHeight:1 }}>{s.val}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.55rem', color:'#555', letterSpacing:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'2.5rem', color:'#f5c518', letterSpacing:'2px', lineHeight:1 }}>{pctTot}%</div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.55rem', color:'#666' }}>CON AL MENOS 1 VENTA</div>
          </div>
        </div>

        {/* Barra segmentada */}
        <div style={{ height:10, background:'#1a1a1a', borderRadius:10, overflow:'hidden', display:'flex', gap:1 }}>
          <div style={{ width:`${pctPV}%`, background:'linear-gradient(90deg,#e6a800,#ffd166)', transition:'width .8s ease', borderRadius:'10px 0 0 10px' }}></div>
          <div style={{ width:`${pctPA}%`, background:'linear-gradient(90deg,#b52d38,#e63946)', transition:'width .8s ease' }}></div>
          <div style={{ width:`${pctAT}%`, background:'#ff2030', transition:'width .8s ease', borderRadius:'0 10px 10px 0' }}></div>
        </div>
      </div>

      {/* ═══ FILTROS + BÚSQUEDA ═══ */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'12px', alignItems:'center' }}>
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{
            background: filtro===f.key ? `${f.color}14` : 'transparent',
            border:`1px solid ${filtro===f.key ? f.color : '#252525'}`,
            color: filtro===f.key ? f.color : '#555',
            borderRadius:6, padding:'5px 12px',
            fontFamily:"'Share Tech Mono',monospace", fontSize:'.68rem',
            cursor:'pointer', letterSpacing:'1px',
            transition:'all .15s', whiteSpace:'nowrap',
          }}>
            {f.label}
            <span style={{ opacity:.65, marginLeft:'5px' }}>({f.count})</span>
          </button>
        ))}

        <div style={{ display:'flex', gap:'8px', marginLeft:'auto', alignItems:'center' }}>
          <input
            className="jd-input"
            style={{ maxWidth:110, fontFamily:"'Share Tech Mono',monospace", textAlign:'center', letterSpacing:'6px', fontSize:'1.1rem', padding:'.4rem .6rem' }}
            placeholder="000"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value.replace(/\D/g,'').slice(0,3))}
            maxLength={3}
          />
          <button className="btn-jordyn-outline" onClick={loadNumeros} style={{ padding:'7px 12px', fontSize:'.9rem' }} title="Actualizar">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {/* ═══ LEYENDA ═══ */}
      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'10px', alignItems:'center' }}>
        {[
          { color:'rgba(6,214,160,.7)',    label:'Libre' },
          { color:'rgba(255,209,102,.75)', label:'1 venta' },
          { color:'rgba(230,57,70,.7)',    label:'Semi agotado' },
          { color:'#ff2030',              label:'Agotado' },
        ].map(l => (
          <span key={l.label} style={{ display:'flex', alignItems:'center', gap:'5px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem', color:'#555' }}>
            <span style={{ width:9, height:9, background:l.color, borderRadius:2, display:'inline-block' }}></span>
            {l.label}
          </span>
        ))}
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#333', marginLeft:'auto' }}>
          <i className="bi bi-hand-index me-1"></i>toca para ver detalle o vender
        </span>
      </div>

      {/* ═══ CUADRÍCULA ═══ */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div className="jd-spinner" style={{ width:44, height:44 }}></div>
        </div>
      ) : (
        <div style={{ background:'#0d0d0d', border:'1px solid #1a1a1a', borderRadius:10, padding:'10px' }}>
          <div className="numero-grid">
            {filtered.map(n => {
              const cfg = ESTADO[n.estado_global] || ESTADO.libre;
              const isActive = modalNumero === n.numero;
              return (
                <div
                  key={n.numero}
                  onClick={() => handleClick(n)}
                  title={`${n.numero} · R1:${n.rifa1_estado} · R2:${n.rifa2_estado}`}
                  style={{
                    aspectRatio:'1',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Share Tech Mono',monospace",
                    fontSize:'.58rem', fontWeight:700,
                    borderRadius:3, cursor:'pointer',
                    transition:'all .12s',
                    border:`1px solid ${isActive ? '#f5c518' : cfg.border}`,
                    background: isActive ? 'rgba(245,197,24,.2)' : cfg.bg,
                    color: isActive ? '#f5c518' : cfg.color,
                    transform: isActive ? 'scale(1.25)' : undefined,
                    zIndex: isActive ? 5 : undefined,
                    position: isActive ? 'relative' : undefined,
                    boxShadow: isActive ? '0 0 14px rgba(245,197,24,.5)' : undefined,
                    userSelect:'none',
                    WebkitTapHighlightColor:'transparent',
                  }}
                >
                  {loadingModal && isActive ? (
                    <span style={{ fontSize:'.5rem', opacity:.8 }}>⟳</span>
                  ) : n.numero}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'3rem', fontFamily:"'Share Tech Mono',monospace", color:'#333', fontSize:'.8rem' }}>
              Sin resultados para este filtro
            </div>
          )}
        </div>
      )}

      {/* ═══ MODAL ═══ */}
      {modalNumero && modalData && (
        <NumeroModal
          numero={modalNumero}
          data={modalData}
          onClose={closeModal}
          onRefresh={loadNumeros}
          user={user}
        />
      )}

      {/* Loading overlay del modal */}
      {loadingModal && !modalData && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.75)',
          zIndex:9999, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'14px',
        }}>
          <div className="jd-spinner" style={{ width:48, height:48 }}></div>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", color:'#f5c518', fontSize:'.72rem', letterSpacing:'4px' }}>
            CARGANDO #{modalNumero}
          </div>
        </div>
      )}
    </Layout>
  );
}