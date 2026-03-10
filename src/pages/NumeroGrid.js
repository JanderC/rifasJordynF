import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { TicketPreview, printTickets } from '../components/Ticket';
import API from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

/* ═══════════════════════════════════════════
   ESTADOS — adaptados al tema claro
═══════════════════════════════════════════ */
const ESTADO = {
  libre:           { color:'#059669', bg:'rgba(6,214,160,0.10)',   border:'rgba(6,214,160,0.25)',  icon:'✓', label:'LIBRE' },
  parcial_vendido: { color:'#b37700', bg:'rgba(240,165,0,0.12)',   border:'rgba(240,165,0,0.28)',  icon:'½', label:'1 VENTA' },
  parcial_agotado: { color:'#c0303a', bg:'rgba(230,57,70,0.12)',   border:'rgba(230,57,70,0.30)',  icon:'⚡', label:'SEMI AGOT.' },
  agotado_total:   { color:'#e63946', bg:'rgba(230,57,70,0.22)',   border:'rgba(230,57,70,0.45)',  icon:'✗', label:'AGOTADO' },
  sin_asignar:     { color:'#6b9090', bg:'rgba(10,191,188,0.06)',  border:'rgba(10,191,188,0.18)', icon:'·', label:'SIN ASIGNAR' },
};
const EST_RIFA = {
  disponible: { color:'#059669', icon:'✓', label:'DISPONIBLE' },
  vendido_1:  { color:'#b37700', icon:'½', label:'1 DE 2 VENDIDO' },
  agotado:    { color:'#e63946', icon:'✗', label:'AGOTADO' },
};

/* ═══════════════════════════════════════════
   MODAL DE DETALLE DEL NÚMERO
═══════════════════════════════════════════ */
function NumeroModal({ numero, data, onClose, onRefresh, user }) {
  const [tab,      setTab]     = useState('info');
  const [rifaSel,  setRifaSel] = useState(null);
  const [form,     setForm]    = useState({ nombre:'', telefono:'' });
  const [selling,  setSelling] = useState(false);

  const rifas      = data?.rifas || [];
  const disponibles = rifas.filter(r => r.disponible);

  useEffect(() => {
    if (disponibles.length === 1) setRifaSel(disponibles[0]);
  }, [disponibles.length]);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const fmt  = p => p ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p) : '$0';
  const fmtF = f => f ? new Date(f).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Sin fecha';

  const handleVender = async () => {
    if (!rifaSel)            return toast.error('Selecciona una rifa');
    if (!form.nombre.trim()) return toast.error('El nombre del comprador es requerido');
    setSelling(true);
    try {
      await API.post('/numeros/vender', {
        rifa_id:         rifaSel.rifa_id,
        numero,
        nombre_comprador: form.nombre.trim(),
        telefono:         form.telefono.trim(),
      });
      toast.success(`✅ ¡Número ${numero} vendido en ${rifaSel.rifa_nombre}!`);
      setTab('ticket');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta');
    } finally {
      setSelling(false);
    }
  };

  const handlePrint = () => {
    if (!rifaSel) return;
    printTickets([rifaSel], numero, form, user?.nombre);
  };

  const tabs = [
    { id:'info',   icon:'bi-info-circle-fill',       label:'DETALLE' },
    ...(disponibles.length > 0 ? [{ id:'vender', icon:'bi-cart-plus-fill', label:'VENDER' }] : []),
    { id:'ticket', icon:'bi-ticket-perforated-fill', label:'BOLETO' },
  ];

  const estadoGlobal = rifas.every(r => r.estado==='agotado')
    ? 'agotado_total'
    : rifas.some(r => r.estado==='agotado')
    ? 'parcial_agotado'
    : rifas.some(r => r.estado==='vendido_1')
    ? 'parcial_vendido' : 'libre';
  const ecfg = ESTADO[estadoGlobal] || ESTADO.libre;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(10,30,30,0.55)',
        backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'1rem',
        animation:'bgFadeIn .2s ease',
      }}
    >
      <div style={{
        width:'100%', maxWidth:700,
        maxHeight:'92vh',
        background:'#fff',
        border:'1px solid var(--jordyn-border)',
        borderRadius:14,
        overflow:'hidden',
        display:'flex', flexDirection:'column',
        animation:'modalPop .28s cubic-bezier(.175,.885,.32,1.275)',
        boxShadow:'0 32px 80px rgba(10,191,188,0.2)',
      }}>

        {/* HEADER */}
        <div style={{
          background:'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))',
          padding:'16px 20px',
          display:'flex', alignItems:'center', gap:'16px',
          flexShrink:0,
        }}>
          <div style={{
            fontFamily:"'Poppins',sans-serif",
            fontWeight:900,
            fontSize:'3.5rem', color:'#fff',
            letterSpacing:'12px', lineHeight:1,
            paddingLeft:'8px',
            textShadow:'0 0 30px rgba(255,255,255,0.3)',
            flexShrink:0,
          }}>{numero}</div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,0.7)', letterSpacing:'3px', marginBottom:6, fontWeight:600 }}>
              NÚMERO SELECCIONADO
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              <span style={{
                background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)',
                color:'#fff', borderRadius:20, padding:'2px 10px',
                fontSize:'.62rem', fontWeight:700,
              }}>
                {ecfg.icon} {ecfg.label}
              </span>
              {rifas.map(r => {
                const rcfg = EST_RIFA[r.estado] || EST_RIFA.disponible;
                return (
                  <span key={r.rifa_id} style={{
                    background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)',
                    color:'#fff', borderRadius:20, padding:'2px 10px',
                    fontSize:'.6rem', fontWeight:600,
                  }}>
                    {r.rifa_nombre}: {rcfg.label}
                  </span>
                );
              })}
            </div>
          </div>

          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)',
            color:'#fff', borderRadius:8, padding:'6px 11px',
            cursor:'pointer', fontSize:'1rem', flexShrink:0,
          }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* TABS */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--jordyn-border)', flexShrink:0, background:'var(--jordyn-bg2)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'11px 8px',
              background: tab===t.id ? '#fff' : 'transparent',
              border:'none',
              borderBottom: tab===t.id ? '2px solid var(--jordyn-primary)' : '2px solid transparent',
              color: tab===t.id ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)',
              cursor:'pointer',
              fontFamily:"'Poppins',sans-serif",
              fontWeight:700, fontSize:'.78rem', letterSpacing:'0.5px',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              transition:'all .15s',
            }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* CUERPO */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

          {/* TAB: DETALLE */}
          {tab === 'info' && (
            <div style={{ animation:'fadeSlide .2s ease' }}>
              {rifas.map((r, ri) => {
                const rcfg = EST_RIFA[r.estado] || EST_RIFA.disponible;
                const accentColor = ri === 0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)';
                return (
                  <div key={r.rifa_id} style={{
                    background:'var(--jordyn-bg2)',
                    border:`1px solid ${rcfg.color}30`,
                    borderRadius:10, marginBottom:12, overflow:'hidden',
                  }}>
                    <div style={{
                      background:`linear-gradient(90deg,${accentColor}0d,transparent)`,
                      padding:'10px 16px',
                      borderBottom:'1px solid var(--jordyn-border)',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      flexWrap:'wrap', gap:8,
                    }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'1rem', color:accentColor }}>
                          {r.rifa_nombre}
                        </div>
                        <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:2 }}>
                          🏆 {r.premio} · {fmt(r.precio)}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{
                          background:`${rcfg.color}15`, border:`1px solid ${rcfg.color}35`,
                          color:rcfg.color, borderRadius:20, padding:'2px 12px',
                          fontSize:'.62rem', fontWeight:700,
                        }}>
                          {rcfg.icon} {rcfg.label}
                        </div>
                        <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:3 }}>
                          {r.veces_vendido} / 2 vendidos
                        </div>
                      </div>
                    </div>

                    <div style={{ padding:'10px 16px' }}>
                      {r.compradores?.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'10px 0', fontSize:'.72rem', color:'var(--jordyn-muted)' }}>
                          — Sin ventas en esta rifa —
                        </div>
                      ) : r.compradores.map((c, ci) => (
                        <div key={ci} style={{
                          display:'flex', alignItems:'center', gap:12, padding:'7px 0',
                          borderBottom: ci < r.compradores.length-1 ? '1px solid var(--jordyn-border)' : 'none',
                        }}>
                          <div style={{
                            width:32, height:32, borderRadius:'50%',
                            background: ci===0 ? 'rgba(10,191,188,0.12)' : 'rgba(240,165,0,0.12)',
                            border:`1.5px solid ${ci===0 ? 'rgba(10,191,188,0.3)' : 'rgba(240,165,0,0.3)'}`,
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          }}>
                            <span style={{ fontWeight:900, color: ci===0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)', fontSize:'1rem' }}>
                              {ci+1}
                            </span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:'.9rem', color:'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {c.nombre_comprador || c.comprador}
                            </div>
                            <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:1 }}>
                              Por{' '}
                              <span style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>{c.nombre_vendedor}</span>
                              {c.created_at && <span style={{ marginLeft:8 }}>{new Date(c.created_at).toLocaleDateString('es-CO')}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => { setRifaSel(r); setForm({ nombre:c.nombre_comprador||'', telefono:c.telefono||'' }); setTab('ticket'); }}
                            style={{
                              background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.25)',
                              color:'var(--jordyn-primary)', borderRadius:6, padding:'4px 10px',
                              cursor:'pointer', fontSize:'.7rem', fontWeight:600, flexShrink:0,
                            }}
                            title="Ver ticket"
                          >
                            <i className="bi bi-ticket-perforated"></i>
                          </button>
                        </div>
                      ))}
                    </div>

                    {(r.fecha_sorteo || r.loteria_ref) && (
                      <div style={{
                        borderTop:'1px solid var(--jordyn-border)', padding:'7px 16px',
                        display:'flex', gap:18, flexWrap:'wrap',
                        fontSize:'.58rem', color:'var(--jordyn-muted)',
                      }}>
                        {r.fecha_sorteo && <span>📅 {fmtF(r.fecha_sorteo)}</span>}
                        {r.loteria_ref  && <span>🎲 {r.loteria_ref}</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {disponibles.length > 0 && (
                <button onClick={() => setTab('vender')} className="btn-jordyn w-100"
                  style={{ marginTop:8, fontSize:'0.95rem', padding:'.72rem' }}>
                  <i className="bi bi-cart-plus-fill me-2"></i>VENDER ESTE NÚMERO
                </button>
              )}
            </div>
          )}

          {/* TAB: VENDER */}
          {tab === 'vender' && (
            <div style={{ animation:'fadeSlide .2s ease' }}>
              {disponibles.length > 1 && (
                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--jordyn-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>
                    SELECCIONA LA RIFA
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    {disponibles.map(r => (
                      <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{
                        flex:1, padding:'10px 14px', textAlign:'left',
                        background: rifaSel?.rifa_id===r.rifa_id ? 'rgba(10,191,188,0.10)' : 'var(--jordyn-bg2)',
                        border:`2px solid ${rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
                        borderRadius:10, cursor:'pointer', transition:'all .15s',
                      }}>
                        <div style={{ fontWeight:800, fontSize:'0.9rem', color: rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-text)' }}>
                          {r.rifa_nombre}
                        </div>
                        <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>{r.premio}</div>
                        <div style={{ fontSize:'.68rem', color:'var(--jordyn-green)', marginTop:3, fontWeight:700 }}>
                          {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(r.precio)}
                          {r.veces_vendido===1 && <span style={{ color:'var(--jordyn-gold)', marginLeft:8 }}>· ya tiene 1 venta</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-start' }}>
                <div style={{ flex:'1 1 200px', minWidth:0 }}>
                  <div style={{ marginBottom:14 }}>
                    <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                    <input className="jd-input" placeholder="Nombre completo"
                      value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))} autoFocus />
                  </div>
                  <div style={{ marginBottom:18 }}>
                    <label className="jd-label">TELÉFONO (opcional)</label>
                    <input className="jd-input" placeholder="300 000 0000" type="tel"
                      value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono:e.target.value }))} />
                  </div>

                  {rifaSel && (
                    <div style={{ background:'rgba(10,191,188,0.07)', border:'1.5px solid rgba(10,191,188,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
                      <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', marginBottom:4 }}>RESUMEN</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-primary)' }}>
                          #{numero} — {rifaSel.rifa_nombre}
                        </span>
                        <span style={{ fontWeight:800, fontSize:'1.2rem', color:'var(--jordyn-green)' }}>
                          {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(rifaSel.precio)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button className="btn-jordyn w-100" onClick={handleVender}
                    disabled={selling || !rifaSel} style={{ fontSize:'1rem', padding:'.75rem' }}>
                    {selling
                      ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2 }}></span> Registrando...</>
                      : <><i className="bi bi-check2-circle me-2"></i>CONFIRMAR VENTA</>
                    }
                  </button>
                </div>

                {rifaSel && (
                  <div style={{ flex:'0 0 auto', display:'flex', justifyContent:'center' }}>
                    <TicketPreview r={rifaSel} numero={numero} comprador={form} vendedor={user?.nombre} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: BOLETO */}
          {tab === 'ticket' && (
            <div style={{ animation:'fadeSlide .2s ease' }}>
              {!rifaSel ? (
                rifas.filter(r => r.veces_vendido > 0).length > 0 ? (
                  <>
                    <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>
                      ¿DE QUÉ RIFA IMPRIMIR EL BOLETO?
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
                      {rifas.filter(r => r.veces_vendido > 0).map(r => (
                        <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{
                          flex:1, minWidth:'140px', padding:'10px 14px', textAlign:'left',
                          background:'var(--jordyn-bg2)', border:'2px solid var(--jordyn-border)',
                          borderRadius:10, cursor:'pointer', transition:'all .15s', fontWeight:700,
                        }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--jordyn-primary)'}
                          onMouseLeave={e=>e.currentTarget.style.borderColor='var(--jordyn-border)'}
                        >
                          <div style={{ color:'var(--jordyn-text)', fontSize:'0.9rem' }}>{r.rifa_nombre}</div>
                          <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>{r.veces_vendido} venta(s)</div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="jd-alert jd-alert-warning mb-3">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    Primero realiza una venta para generar el boleto.
                  </div>
                )
              ) : (
                <div>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
                    <TicketPreview r={rifaSel} numero={numero} comprador={form} vendedor={user?.nombre} />
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                    <button className="btn-jordyn" onClick={handlePrint} style={{ fontSize:'0.9rem', padding:'.72rem 2rem' }}>
                      <i className="bi bi-printer-fill me-2"></i>IMPRIMIR (2 COPIAS)
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setRifaSel(null)}>
                      <i className="bi bi-arrow-left me-1"></i> Cambiar rifa
                    </button>
                    <button className="btn-jordyn-outline" onClick={onClose}>
                      <i className="bi bi-x-lg me-1"></i> Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
  const { user } = useAuth();
  const [numeros,     setNumeros]     = useState([]);
  const [asignados,   setAsignados]   = useState(new Set()); // números asignados a cualquier vendedor
  const [loading,     setLoading]     = useState(true);
  const [filtro,      setFiltro]      = useState('todos');
  const [busqueda,    setBusqueda]    = useState('');
  const [mostrarSinAsignar, setMostrarSinAsignar] = useState(false);

  const [modalNumero,  setModalNumero]  = useState(null);
  const [modalData,    setModalData]    = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);

  const loadNumeros = useCallback(async () => {
    setLoading(true);
    try {
      const [gridRes, vendRes] = await Promise.all([
        API.get('/numeros/estado-global'),
        API.get('/vendedores').catch(() => ({ data: [] })),
      ]);
      setNumeros(gridRes.data);

      // Construir set de números asignados
      const asigSet = new Set();
      if (Array.isArray(vendRes.data)) {
        await Promise.all(vendRes.data.slice(0, 20).map(async (v) => {
          try {
            const r = await API.get(`/vendedores/${v.id}`);
            (r.data.numeros_asignados || []).forEach(n => asigSet.add(n.numero));
          } catch {}
        }));
      }
      setAsignados(asigSet);
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNumeros(); }, [loadNumeros]);

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

  /* ── Enriquecer estado global con "sin_asignar" ── */
  const numerosEnriquecidos = numeros.map(n => ({
    ...n,
    es_sin_asignar: n.estado_global === 'libre' && !asignados.has(n.numero),
    estado_display: (mostrarSinAsignar && n.estado_global === 'libre' && !asignados.has(n.numero))
      ? 'sin_asignar'
      : n.estado_global,
  }));

  const conteos = {
    todos:           numerosEnriquecidos.length,
    libre:           numerosEnriquecidos.filter(n => n.estado_global==='libre').length,
    parcial_vendido: numerosEnriquecidos.filter(n => n.estado_global==='parcial_vendido').length,
    parcial_agotado: numerosEnriquecidos.filter(n => n.estado_global==='parcial_agotado').length,
    agotado_total:   numerosEnriquecidos.filter(n => n.estado_global==='agotado_total').length,
    sin_asignar:     numerosEnriquecidos.filter(n => n.es_sin_asignar).length,
  };

  const filtered = numerosEnriquecidos.filter(n => {
    if (busqueda) {
      const q = busqueda.padStart(3,'0');
      if (!n.numero.includes(q)) return false;
    }
    if (filtro === 'sin_asignar') return n.es_sin_asignar;
    if (filtro !== 'todos' && n.estado_global !== filtro) return false;
    return true;
  });

  const total  = numeros.length || 1;
  const pctPV  = (conteos.parcial_vendido / total * 100).toFixed(1);
  const pctPA  = (conteos.parcial_agotado / total * 100).toFixed(1);
  const pctAT  = (conteos.agotado_total   / total * 100).toFixed(1);
  const pctTot = ((conteos.parcial_vendido + conteos.parcial_agotado + conteos.agotado_total) / total * 100).toFixed(0);

  const FILTROS = [
    { key:'todos',           label:'Todos',         count:conteos.todos,           color:'var(--jordyn-text)' },
    { key:'libre',           label:'Libres',         count:conteos.libre,           color:'#059669' },
    { key:'parcial_vendido', label:'1 venta',        count:conteos.parcial_vendido, color:'#b37700' },
    { key:'parcial_agotado', label:'Semi agotado',   count:conteos.parcial_agotado, color:'#c0303a' },
    { key:'agotado_total',   label:'Agotado',        count:conteos.agotado_total,   color:'var(--jordyn-red)' },
    { key:'sin_asignar',     label:'Sin asignar',    count:conteos.sin_asignar,     color:'var(--jordyn-muted)' },
  ];

  return (
    <Layout title="CUADRÍCULA DE NÚMEROS">

      {/* BARRA DE PROGRESO GLOBAL */}
      <div className="jd-card mb-3" style={{ padding:'1rem 1.25rem' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:0, marginBottom:10, justifyContent:'space-between', alignItems:'flex-end' }}>
          <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
            {[
              { label:'Libres',      val:conteos.libre,           color:'#059669' },
              { label:'1 venta',     val:conteos.parcial_vendido, color:'#b37700' },
              { label:'Semi agot.',  val:conteos.parcial_agotado, color:'#c0303a' },
              { label:'Agotados',    val:conteos.agotado_total,   color:'var(--jordyn-red)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontWeight:800, fontSize:'1.6rem', color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontWeight:900, fontSize:'2.2rem', color:'var(--jordyn-primary)', lineHeight:1 }}>{pctTot}%</div>
            <div style={{ fontSize:'.55rem', color:'var(--jordyn-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>CON AL MENOS 1 VENTA</div>
          </div>
        </div>

        {/* Barra segmentada */}
        <div style={{ height:10, background:'var(--jordyn-bg2)', borderRadius:10, overflow:'hidden', display:'flex', gap:1, border:'1px solid var(--jordyn-border)' }}>
          <div style={{ width:`${pctPV}%`, background:'linear-gradient(90deg,#d49000,#f0a500)', transition:'width .8s ease' }}></div>
          <div style={{ width:`${pctPA}%`, background:'linear-gradient(90deg,#a02020,#e63946)', transition:'width .8s ease' }}></div>
          <div style={{ width:`${pctAT}%`, background:'var(--jordyn-red)', transition:'width .8s ease' }}></div>
        </div>
      </div>

      {/* FILTROS + BÚSQUEDA */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10, alignItems:'center' }}>
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{
            background: filtro===f.key ? f.color : '#fff',
            border:`1.5px solid ${filtro===f.key ? f.color : 'var(--jordyn-border)'}`,
            color: filtro===f.key ? '#fff' : 'var(--jordyn-muted)',
            borderRadius:20, padding:'4px 12px',
            fontSize:'.7rem', fontWeight:600,
            cursor:'pointer', whiteSpace:'nowrap',
            transition:'all .15s',
          }}>
            {f.label} <span style={{ opacity:.75 }}>({f.count})</span>
          </button>
        ))}

        {/* Toggle sin asignar visual */}
        <button
          onClick={() => setMostrarSinAsignar(!mostrarSinAsignar)}
          style={{
            background: mostrarSinAsignar ? 'rgba(10,191,188,0.10)' : '#fff',
            border:`1.5px solid ${mostrarSinAsignar ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
            color: mostrarSinAsignar ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)',
            borderRadius:20, padding:'4px 12px',
            fontSize:'.68rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
          }}
          title="Resaltar números libres sin asignar a ningún vendedor"
        >
          <i className={`bi bi-eye${mostrarSinAsignar?'':'-slash'} me-1`}></i>Sin asignar
        </button>

        <div style={{ display:'flex', gap:8, marginLeft:'auto', alignItems:'center' }}>
          <input
            className="jd-input"
            style={{ maxWidth:100, textAlign:'center', fontWeight:800, letterSpacing:6, fontSize:'1.05rem', padding:'.35rem .6rem' }}
            placeholder="000"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value.replace(/\D/g,'').slice(0,3))}
            maxLength={3}
          />
          <button className="btn-jordyn-outline" onClick={loadNumeros} style={{ padding:'6px 12px' }} title="Actualizar">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {/* LEYENDA */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
        {[
          { color:'rgba(6,214,160,0.6)',   label:'Libre' },
          { color:'rgba(240,165,0,0.65)',  label:'1 venta' },
          { color:'rgba(230,57,70,0.55)',  label:'Semi agotado' },
          { color:'rgba(230,57,70,0.85)',  label:'Agotado' },
          { color:'rgba(10,191,188,0.25)', label:'Sin asignar', dashed:true },
        ].map(l => (
          <span key={l.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.62rem', color:'var(--jordyn-muted)', fontWeight:600 }}>
            <span style={{ width:10, height:10, background:l.color, borderRadius:3, display:'inline-block', border: l.dashed ? '1.5px dashed rgba(10,191,188,0.5)' : 'none' }}></span>
            {l.label}
          </span>
        ))}
        <span style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginLeft:'auto' }}>
          <i className="bi bi-hand-index me-1"></i>Toca para ver detalle o vender
        </span>
      </div>

      {/* CUADRÍCULA */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div className="jd-spinner" style={{ width:44, height:44 }}></div>
        </div>
      ) : (
        <div className="jd-card" style={{ padding:10 }}>
          <div className="numero-grid">
            {filtered.map(n => {
              const displayEstado = n.estado_display;
              const cfg = ESTADO[displayEstado] || ESTADO.libre;
              const isActive = modalNumero === n.numero;
              return (
                <div
                  key={n.numero}
                  onClick={() => handleClick(n)}
                  title={`${n.numero} · R1:${n.rifa1_estado} · R2:${n.rifa2_estado}`}
                  style={{
                    aspectRatio:'1',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:700, fontSize:'.68rem',
                    borderRadius:6, cursor:'pointer',
                    transition:'all .12s',
                    border:`1.5px ${displayEstado==='sin_asignar' ? 'dashed' : 'solid'} ${isActive ? 'var(--jordyn-primary)' : cfg.border}`,
                    background: isActive ? 'rgba(10,191,188,0.18)' : cfg.bg,
                    color: isActive ? 'var(--jordyn-primary)' : cfg.color,
                    transform: isActive ? 'scale(1.25)' : undefined,
                    zIndex: isActive ? 5 : undefined,
                    position: isActive ? 'relative' : undefined,
                    boxShadow: isActive ? '0 0 14px rgba(10,191,188,0.4)' : undefined,
                    userSelect:'none',
                    WebkitTapHighlightColor:'transparent',
                  }}
                >
                  {loadingModal && isActive ? '⟳' : n.numero}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'3rem', color:'var(--jordyn-muted)', fontSize:'.85rem' }}>
              Sin resultados para este filtro
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {modalNumero && modalData && (
        <NumeroModal
          numero={modalNumero}
          data={modalData}
          onClose={closeModal}
          onRefresh={loadNumeros}
          user={user}
        />
      )}

      {/* Loading overlay */}
      {loadingModal && !modalData && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(10,30,30,0.5)',
          zIndex:9999, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:14,
          backdropFilter:'blur(4px)',
        }}>
          <div className="jd-spinner" style={{ width:48, height:48 }}></div>
          <div style={{ color:'var(--jordyn-primary)', fontSize:'.75rem', fontWeight:700, letterSpacing:3 }}>
            CARGANDO #{modalNumero}
          </div>
        </div>
      )}
    </Layout>
  );
}