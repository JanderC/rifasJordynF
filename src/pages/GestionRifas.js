import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, printTickets } from '../components/Ticket';
import { useAuth } from '../context/AuthContext';

/* ─── Loterías Colombia + Venezuela ─── */
const LOTERIAS = [
  { grupo: 'Colombia', items: [
    'Baloto', 'Revancha Baloto', 'Lotería de Bogotá', 'Lotería del Tolima',
    'Lotería de Cundinamarca', 'Lotería de Boyacá', 'Lotería del Huila',
    'Lotería de Caldas', 'Lotería del Quindío', 'Lotería de Risaralda',
    'Lotería del Meta', 'Lotería de Santander', 'Lotería del Valle',
    'Lotería del Cauca', 'Lotería de Manizales', 'Lotería de Armenia',
    'Chance Codechocó', 'La Greca', 'Dorado', 'Culona', 'Paisita',
    'Pijao de Oro', 'Cafeterito', 'Super Astro Sol', 'Super Astro Luna',
  ]},
  { grupo: 'Venezuela', items: [
    'Lotería del Táchira', 'Lotería de Mérida', 'Lotería del Zulia',
    'Lotería de Caracas', 'Lottery Venezuela', 'Animalitos', 'Tripleta',
    'La Greca Venezuela', 'El Kino', 'Chance Venezuela',
  ]},
  { grupo: 'Otra', items: ['Otra lotería / referencia propia'] },
];

const emptyForm = {
  nombre: '', descripcion: '', premio: '', precio: '', precio_display: '',
  fecha_sorteo: '', loteria_ref: '', tipo: 'sencilla', imagen_base64: '',
};

/* ─── Formateo COP ─── */
const fmtCOP = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const parseCOP = (str) => parseInt(str.replace(/\D/g, '') || '0');

/* ─── Imagen a base64 ─── */
const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload  = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

/* ═══════════════════════════════════════════════════
   ESTADOS del grid de números
═══════════════════════════════════════════════════ */
const ESTADO_GRID = {
  libre:           { color:'#059669', bg:'rgba(6,214,160,0.10)',   border:'rgba(6,214,160,0.25)',  icon:'✓', label:'LIBRE' },
  parcial_vendido: { color:'#b37700', bg:'rgba(240,165,0,0.12)',   border:'rgba(240,165,0,0.28)',  icon:'½', label:'1 VENTA' },
  parcial_agotado: { color:'#c0303a', bg:'rgba(230,57,70,0.12)',   border:'rgba(230,57,70,0.30)',  icon:'⚡', label:'SEMI AGOT.' },
  agotado_total:   { color:'#e63946', bg:'rgba(230,57,70,0.22)',   border:'rgba(230,57,70,0.45)',  icon:'✗', label:'AGOTADO' },
  sin_asignar:     { color:'#6b9090', bg:'rgba(10,191,188,0.06)',  border:'rgba(10,191,188,0.18)', icon:'·', label:'SIN ASIGNAR' },
};
const EST_RIFA_MODAL = {
  disponible: { color:'#059669', icon:'✓', label:'DISPONIBLE' },
  vendido_1:  { color:'#b37700', icon:'½', label:'1 DE 2 VENDIDO' },
  agotado:    { color:'#e63946', icon:'✗', label:'AGOTADO' },
};

/* ═══════════════════════════════════════════════════
   MODAL DETALLE DE NÚMERO (dentro de la rifa)
═══════════════════════════════════════════════════ */
function NumeroDetalleModal({ numero, data, onClose, onRefresh, user }) {
  const [tab,     setTab]     = useState('info');
  const [rifaSel, setRifaSel] = useState(null);
  const [form,    setForm]    = useState({ nombre:'', telefono:'' });
  const [selling, setSelling] = useState(false);

  const rifas       = data?.rifas || [];
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
        rifa_id:          rifaSel.rifa_id,
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
  const ecfg = ESTADO_GRID[estadoGlobal] || ESTADO_GRID.libre;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:10100,
        background:'rgba(10,30,30,0.6)',
        backdropFilter:'blur(4px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'1rem',
      }}
    >
      <div style={{
        width:'100%', maxWidth:680,
        maxHeight:'88vh',
        background:'#fff',
        border:'1px solid var(--jordyn-border)',
        borderRadius:14,
        overflow:'hidden',
        display:'flex', flexDirection:'column',
        boxShadow:'0 32px 80px rgba(10,191,188,0.25)',
      }}>
        {/* HEADER */}
        <div style={{
          background:'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))',
          padding:'14px 18px',
          display:'flex', alignItems:'center', gap:'14px',
          flexShrink:0,
        }}>
          <div style={{
            fontFamily:"'Poppins',sans-serif", fontWeight:900,
            fontSize:'3rem', color:'#fff',
            letterSpacing:'10px', lineHeight:1,
            paddingLeft:'6px',
            textShadow:'0 0 24px rgba(255,255,255,0.3)',
            flexShrink:0,
          }}>{numero}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'.58rem', color:'rgba(255,255,255,0.7)', letterSpacing:'3px', marginBottom:5, fontWeight:600 }}>NÚMERO SELECCIONADO</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              <span style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:'.6rem', fontWeight:700 }}>
                {ecfg.icon} {ecfg.label}
              </span>
              {rifas.map(r => {
                const rcfg = EST_RIFA_MODAL[r.estado] || EST_RIFA_MODAL.disponible;
                return (
                  <span key={r.rifa_id} style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:'.58rem', fontWeight:600 }}>
                    {r.rifa_nombre}: {rcfg.label}
                  </span>
                );
              })}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'6px 11px', cursor:'pointer', fontSize:'1rem', flexShrink:0 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* TABS */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--jordyn-border)', flexShrink:0, background:'var(--jordyn-bg2)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'10px 8px',
              background: tab===t.id ? '#fff' : 'transparent',
              border:'none',
              borderBottom: tab===t.id ? '2px solid var(--jordyn-primary)' : '2px solid transparent',
              color: tab===t.id ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)',
              cursor:'pointer',
              fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:'.76rem', letterSpacing:'0.5px',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              transition:'all .15s',
            }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* CUERPO */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px' }}>

          {/* TAB: DETALLE */}
          {tab === 'info' && (
            <div>
              {rifas.map((r, ri) => {
                const rcfg = EST_RIFA_MODAL[r.estado] || EST_RIFA_MODAL.disponible;
                const accentColor = ri === 0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)';
                return (
                  <div key={r.rifa_id} style={{ background:'var(--jordyn-bg2)', border:`1px solid ${rcfg.color}30`, borderRadius:10, marginBottom:10, overflow:'hidden' }}>
                    <div style={{ background:`linear-gradient(90deg,${accentColor}0d,transparent)`, padding:'10px 14px', borderBottom:'1px solid var(--jordyn-border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'0.95rem', color:accentColor }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>🏆 {r.premio} · {fmt(r.precio)}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ background:`${rcfg.color}15`, border:`1px solid ${rcfg.color}35`, color:rcfg.color, borderRadius:20, padding:'2px 12px', fontSize:'.6rem', fontWeight:700 }}>
                          {rcfg.icon} {rcfg.label}
                        </div>
                        <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:3 }}>{r.veces_vendido} / 2 vendidos</div>
                      </div>
                    </div>
                    <div style={{ padding:'10px 14px' }}>
                      {r.compradores?.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'8px 0', fontSize:'.7rem', color:'var(--jordyn-muted)' }}>— Sin ventas en esta rifa —</div>
                      ) : r.compradores.map((c, ci) => (
                        <div key={ci} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom: ci < r.compradores.length-1 ? '1px solid var(--jordyn-border)' : 'none' }}>
                          <div style={{ width:30, height:30, borderRadius:'50%', background: ci===0 ? 'rgba(10,191,188,0.12)' : 'rgba(240,165,0,0.12)', border:`1.5px solid ${ci===0 ? 'rgba(10,191,188,0.3)' : 'rgba(240,165,0,0.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontWeight:900, color: ci===0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)', fontSize:'0.9rem' }}>{ci+1}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {c.nombre_comprador || c.comprador}
                            </div>
                            <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:1 }}>
                              Por <span style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>{c.nombre_vendedor}</span>
                              {c.created_at && <span style={{ marginLeft:6 }}>{new Date(c.created_at).toLocaleDateString('es-CO')}</span>}
                            </div>
                          </div>
                          <button onClick={() => { setRifaSel(r); setForm({ nombre:c.nombre_comprador||'', telefono:c.telefono||'' }); setTab('ticket'); }}
                            style={{ background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.25)', color:'var(--jordyn-primary)', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:'.68rem', fontWeight:600, flexShrink:0 }}
                            title="Ver ticket">
                            <i className="bi bi-ticket-perforated"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                    {(r.fecha_sorteo || r.loteria_ref) && (
                      <div style={{ borderTop:'1px solid var(--jordyn-border)', padding:'6px 14px', display:'flex', gap:16, flexWrap:'wrap', fontSize:'.58rem', color:'var(--jordyn-muted)' }}>
                        {r.fecha_sorteo && <span>📅 {fmtF(r.fecha_sorteo)}</span>}
                        {r.loteria_ref  && <span>🎲 {r.loteria_ref}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {disponibles.length > 0 && (
                <button onClick={() => setTab('vender')} className="btn-jordyn w-100" style={{ marginTop:6, fontSize:'0.92rem', padding:'.68rem' }}>
                  <i className="bi bi-cart-plus-fill me-2"></i>VENDER ESTE NÚMERO
                </button>
              )}
            </div>
          )}

          {/* TAB: VENDER */}
          {tab === 'vender' && (
            <div>
              {disponibles.length > 1 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>SELECCIONA LA RIFA</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {disponibles.map(r => (
                      <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{
                        flex:1, padding:'10px 12px', textAlign:'left',
                        background: rifaSel?.rifa_id===r.rifa_id ? 'rgba(10,191,188,0.10)' : 'var(--jordyn-bg2)',
                        border:`2px solid ${rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
                        borderRadius:10, cursor:'pointer', transition:'all .15s',
                      }}>
                        <div style={{ fontWeight:800, fontSize:'0.88rem', color: rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-text)' }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>{r.premio}</div>
                        <div style={{ fontSize:'.66rem', color:'var(--jordyn-green)', marginTop:3, fontWeight:700 }}>
                          {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(r.precio)}
                          {r.veces_vendido===1 && <span style={{ color:'var(--jordyn-gold)', marginLeft:6 }}>· ya tiene 1 venta</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:18, flexWrap:'wrap', alignItems:'flex-start' }}>
                <div style={{ flex:'1 1 200px', minWidth:0 }}>
                  <div style={{ marginBottom:14 }}>
                    <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                    <input className="jd-input" placeholder="Nombre completo"
                      value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))} autoFocus />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label className="jd-label">TELÉFONO (opcional)</label>
                    <input className="jd-input" placeholder="300 000 0000" type="tel"
                      value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono:e.target.value }))} />
                  </div>
                  {rifaSel && (
                    <div style={{ background:'rgba(10,191,188,0.07)', border:'1.5px solid rgba(10,191,188,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
                      <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', marginBottom:4 }}>RESUMEN</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:800, fontSize:'1.05rem', color:'var(--jordyn-primary)' }}>#{numero} — {rifaSel.rifa_nombre}</span>
                        <span style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-green)' }}>
                          {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(rifaSel.precio)}
                        </span>
                      </div>
                    </div>
                  )}
                  <button className="btn-jordyn w-100" onClick={handleVender} disabled={selling || !rifaSel} style={{ fontSize:'0.95rem', padding:'.72rem' }}>
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
            <div>
              {!rifaSel ? (
                rifas.filter(r => r.veces_vendido > 0).length > 0 ? (
                  <>
                    <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>¿DE QUÉ RIFA IMPRIMIR EL BOLETO?</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
                      {rifas.filter(r => r.veces_vendido > 0).map(r => (
                        <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{
                          flex:1, minWidth:'140px', padding:'10px 12px', textAlign:'left',
                          background:'var(--jordyn-bg2)', border:'2px solid var(--jordyn-border)',
                          borderRadius:10, cursor:'pointer', transition:'all .15s', fontWeight:700,
                        }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--jordyn-primary)'}
                          onMouseLeave={e=>e.currentTarget.style.borderColor='var(--jordyn-border)'}
                        >
                          <div style={{ color:'var(--jordyn-text)', fontSize:'0.88rem' }}>{r.rifa_nombre}</div>
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
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
                    <TicketPreview r={rifaSel} numero={numero} comprador={form} vendedor={user?.nombre} />
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                    <button className="btn-jordyn" onClick={handlePrint} style={{ fontSize:'0.88rem', padding:'.68rem 1.8rem' }}>
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Cuadrícula completa de números de una rifa
═══════════════════════════════════════════════════ */
function ModalNumeros({ rifa, onClose, user }) {
  const [numeros,          setNumeros]          = useState([]);
  const [asignados,        setAsignados]        = useState(new Set());
  const [loading,          setLoading]          = useState(true);
  const [filtro,           setFiltro]           = useState('todos');
  const [busqueda,         setBusqueda]         = useState('');
  const [mostrarSinAsignar,setMostrarSinAsignar]= useState(false);

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

      // Filtrar solo los de esta rifa si el endpoint devuelve multi-rifa
      // El endpoint devuelve el estado global cruzando todas las rifas activas;
      // para la vista por rifa usamos los datos de esta rifa específica.
      setNumeros(gridRes.data);

      // Set de números asignados a algún vendedor en ESTA rifa
      const asigSet = new Set();
      if (Array.isArray(vendRes.data)) {
        await Promise.all(vendRes.data.slice(0, 20).map(async (v) => {
          try {
            const r = await API.get(`/vendedores/${v.id}`);
            (r.data.numeros_asignados || [])
              .filter(n => !n.rifa_id || n.rifa_id === rifa.id)
              .forEach(n => asigSet.add(n.numero));
          } catch {}
        }));
      }
      setAsignados(asigSet);
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  }, [rifa.id]);

  useEffect(() => { loadNumeros(); }, [loadNumeros]);

  // Cerrar con Escape (pero solo este modal — el de detalle tiene su propio handler)
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && !modalNumero) onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose, modalNumero]);

  const handleClickNumero = async (n) => {
    setModalNumero(n.numero);
    setModalData(null);
    setLoadingModal(true);
    try {
      const res = await API.get(`/numeros/verificar/${n.numero}`);
      setModalData(res.data);
    } catch { toast.error('Error cargando detalle'); setModalNumero(null); }
    finally { setLoadingModal(false); }
  };

  const closeDetalleModal = () => { setModalNumero(null); setModalData(null); };

  /* Enriquecer con sin_asignar */
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
    { key:'todos',           label:'Todos',        count:conteos.todos,           color:'var(--jordyn-text)' },
    { key:'libre',           label:'Libres',        count:conteos.libre,           color:'#059669' },
    { key:'parcial_vendido', label:'1 venta',       count:conteos.parcial_vendido, color:'#b37700' },
    { key:'parcial_agotado', label:'Semi agotado',  count:conteos.parcial_agotado, color:'#c0303a' },
    { key:'agotado_total',   label:'Agotado',       count:conteos.agotado_total,   color:'var(--jordyn-red)' },
    { key:'sin_asignar',     label:'Sin asignar',   count:conteos.sin_asignar,     color:'var(--jordyn-muted)' },
  ];

  return (
    <>
      <div
        onClick={e => e.target === e.currentTarget && !modalNumero && onClose()}
        style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(10,30,30,0.55)',
          backdropFilter:'blur(5px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'1rem',
        }}
      >
        <div style={{
          width:'100%', maxWidth:860,
          maxHeight:'93vh',
          background:'#fff',
          borderRadius:14,
          overflow:'hidden',
          display:'flex', flexDirection:'column',
          boxShadow:'0 24px 72px rgba(10,191,188,0.22)',
        }}>

          {/* HEADER */}
          <div style={{ background:'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))', color:'#fff', padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'1.05rem' }}>
                <i className="bi bi-grid-3x3-gap me-2"></i>NÚMEROS — {rifa.nombre}
              </div>
              <div style={{ fontSize:'0.7rem', opacity:0.85, marginTop:3 }}>
                {conteos.libre} libres · {conteos.parcial_vendido} con 1 venta · {conteos.agotado_total} agotados · {pctTot}% vendido
              </div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'1rem' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* BARRA DE PROGRESO */}
          <div style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--jordyn-border)', flexShrink:0, background:'var(--jordyn-bg2)' }}>
            <div style={{ height:8, background:'#e9ecef', borderRadius:8, overflow:'hidden', display:'flex', gap:1 }}>
              <div style={{ width:`${pctPV}%`, background:'linear-gradient(90deg,#d49000,#f0a500)', transition:'width .8s ease' }}></div>
              <div style={{ width:`${pctPA}%`, background:'linear-gradient(90deg,#a02020,#e63946)', transition:'width .8s ease' }}></div>
              <div style={{ width:`${pctAT}%`, background:'var(--jordyn-red)', transition:'width .8s ease' }}></div>
            </div>
          </div>

          {/* FILTROS + BÚSQUEDA */}
          <div style={{ padding:'0.6rem 1.25rem', borderBottom:'1px solid var(--jordyn-border)', display:'flex', gap:'6px', flexWrap:'wrap', flexShrink:0, alignItems:'center', background:'#fff' }}>
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)} style={{
                background: filtro===f.key ? f.color : '#fff',
                border:`1.5px solid ${filtro===f.key ? f.color : 'var(--jordyn-border)'}`,
                color: filtro===f.key ? '#fff' : 'var(--jordyn-muted)',
                borderRadius:20, padding:'3px 11px',
                fontSize:'.68rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                transition:'all .15s',
              }}>
                {f.label} <span style={{ opacity:.75 }}>({f.count})</span>
              </button>
            ))}

            <button onClick={() => setMostrarSinAsignar(!mostrarSinAsignar)} style={{
              background: mostrarSinAsignar ? 'rgba(10,191,188,0.10)' : '#fff',
              border:`1.5px solid ${mostrarSinAsignar ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
              color: mostrarSinAsignar ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)',
              borderRadius:20, padding:'3px 11px', fontSize:'.66rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
            }}>
              <i className={`bi bi-eye${mostrarSinAsignar?'':'-slash'} me-1`}></i>Sin asignar
            </button>

            <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
              <input
                className="jd-input"
                style={{ maxWidth:90, textAlign:'center', fontWeight:800, letterSpacing:5, fontSize:'1rem', padding:'.3rem .5rem' }}
                placeholder="000"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value.replace(/\D/g,'').slice(0,3))}
                maxLength={3}
              />
              <button className="btn-jordyn-outline" onClick={loadNumeros} style={{ padding:'5px 10px' }} title="Actualizar">
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>

          {/* LEYENDA */}
          <div style={{ padding:'0.4rem 1.25rem', display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', borderBottom:'1px solid var(--jordyn-border)', flexShrink:0, background:'#fff' }}>
            {[
              { color:'rgba(6,214,160,0.6)',   label:'Libre' },
              { color:'rgba(240,165,0,0.65)',  label:'1 venta' },
              { color:'rgba(230,57,70,0.55)',  label:'Semi agotado' },
              { color:'rgba(230,57,70,0.85)',  label:'Agotado' },
              { color:'rgba(10,191,188,0.25)', label:'Sin asignar', dashed:true },
            ].map(l => (
              <span key={l.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.6rem', color:'var(--jordyn-muted)', fontWeight:600 }}>
                <span style={{ width:9, height:9, background:l.color, borderRadius:3, display:'inline-block', border: l.dashed ? '1.5px dashed rgba(10,191,188,0.5)' : 'none' }}></span>
                {l.label}
              </span>
            ))}
            <span style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginLeft:'auto' }}>
              <i className="bi bi-hand-index me-1"></i>Toca para ver detalle o vender
            </span>
          </div>

          {/* GRID */}
          <div style={{ flex:1, overflowY:'auto', padding:'0.9rem 1.25rem' }}>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
                <div className="jd-spinner" style={{ width:40, height:40 }}></div>
              </div>
            ) : (
              <>
                <div className="numero-grid">
                  {filtered.map(n => {
                    const cfg    = ESTADO_GRID[n.estado_display] || ESTADO_GRID.libre;
                    const isActive = modalNumero === n.numero;
                    return (
                      <div
                        key={n.numero}
                        onClick={() => handleClickNumero(n)}
                        title={`${n.numero} · R1:${n.rifa1_estado} · R2:${n.rifa2_estado}`}
                        style={{
                          aspectRatio:'1',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontWeight:700, fontSize:'.68rem',
                          borderRadius:6, cursor:'pointer', transition:'all .12s',
                          border:`1.5px ${n.estado_display==='sin_asignar' ? 'dashed' : 'solid'} ${isActive ? 'var(--jordyn-primary)' : cfg.border}`,
                          background: isActive ? 'rgba(10,191,188,0.18)' : cfg.bg,
                          color: isActive ? 'var(--jordyn-primary)' : cfg.color,
                          transform: isActive ? 'scale(1.2)' : undefined,
                          zIndex: isActive ? 5 : undefined,
                          position: isActive ? 'relative' : undefined,
                          boxShadow: isActive ? '0 0 12px rgba(10,191,188,0.4)' : undefined,
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
              </>
            )}
          </div>

          {/* Loading overlay detalle */}
          {loadingModal && !modalData && (
            <div style={{ position:'absolute', inset:0, background:'rgba(10,30,30,0.45)', zIndex:10050, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, backdropFilter:'blur(3px)' }}>
              <div className="jd-spinner" style={{ width:44, height:44 }}></div>
              <div style={{ color:'var(--jordyn-primary)', fontSize:'.72rem', fontWeight:700, letterSpacing:3 }}>CARGANDO #{modalNumero}</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle del número (encima del modal de la rifa) */}
      {modalNumero && modalData && (
        <NumeroDetalleModal
          numero={modalNumero}
          data={modalData}
          onClose={closeDetalleModal}
          onRefresh={loadNumeros}
          user={user}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════ */
export default function GestionRifas() {
  const { user } = useAuth();
  const [rifas,          setRifas]          = useState([]);
  const [rifasArchivadas,setRifasArchivadas] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [form,           setForm]           = useState(emptyForm);
  const [editId,         setEditId]         = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [modalNums,      setModalNums]      = useState(null); // rifa para modal números
  const fileRef = useRef();

  const load = useCallback(async () => {
    try {
      const res = await API.get('/rifas');
      setRifas(res.data.filter(r => r.estado !== 'archivada'));
      setRifasArchivadas(res.data.filter(r => r.estado === 'archivada'));
    } catch { toast.error('Error cargando rifas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Precio con formato ── */
  const handlePrecioChange = (val) => {
    const num = parseCOP(val);
    setForm(p => ({ ...p, precio: num, precio_display: num ? fmtCOP(num) : '' }));
  };

  /* ── Imagen ── */
  const handleImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagen demasiado grande (máx 2MB)'); return; }
    const b64 = await fileToBase64(file);
    setForm(p => ({ ...p, imagen_base64: b64 }));
  };

  /* ── Editar ── */
  const handleEdit = (r) => {
    setForm({
      nombre:         r.nombre        || '',
      descripcion:    r.descripcion   || '',
      premio:         r.premio        || '',
      precio:         r.precio        || '',
      precio_display: r.precio        ? fmtCOP(r.precio) : '',
      fecha_sorteo:   r.fecha_sorteo  ? r.fecha_sorteo.split('T')[0] : '',
      loteria_ref:    r.loteria_ref   || '',
      tipo:           r.tipo          || 'sencilla',
      imagen_base64:  r.imagen_url    || '',
    });
    setEditId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNueva = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.premio || !form.precio) {
      toast.error('Nombre, premio y precio son requeridos');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre:       form.nombre,
        descripcion:  form.descripcion,
        premio:       form.premio,
        precio:       form.precio,
        fecha_sorteo: form.fecha_sorteo || null,
        loteria_ref:  form.loteria_ref  || null,
        tipo:         form.tipo,
        imagen_url:   form.imagen_base64 || null,
      };
      if (editId) {
        await API.put(`/rifas/${editId}`, payload);
        toast.success('Rifa actualizada');
      } else {
        await API.post('/rifas', payload);
        toast.success('Rifa creada');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando rifa');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r) => {
    try {
      await API.put(`/rifas/${r.id}`, { activa: !r.activa });
      toast.info(`Rifa ${!r.activa ? 'activada' : 'desactivada'}`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleArchivar = async (r) => {
    if (!window.confirm(`¿Archivar la rifa "${r.nombre}"? Se conservará el historial.`)) return;
    try {
      await API.put(`/rifas/${r.id}`, { activa: false, estado: 'archivada' });
      toast.success('Rifa archivada');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error archivando rifa'); }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`¿Eliminar definitivamente "${r.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await API.delete(`/rifas/${r.id}`);
      toast.success('Rifa eliminada');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error eliminando rifa'); }
  };

  const rifasActivas = rifas.filter(r => r.activa);

  /* ── Tarjeta de rifa ── */
  const RifaCard = ({ r, archivada = false }) => (
    <div className={`jd-card ${r.activa ? 'jd-card-primary' : ''} fade-in`}
      style={{ opacity: r.activa ? 1 : 0.72, height: '100%' }}>

      {/* Imagen del premio */}
      {r.imagen_url && (
        <img
          src={r.imagen_url}
          alt="Premio"
          className="rifa-imagen-preview"
          style={{ width:'100%', maxHeight:180, objectFit:'cover', borderRadius:8, marginBottom:'0.75rem' }}
        />
      )}

      {/* Cabecera */}
      <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
        <div style={{ minWidth:0 }}>
          <h5 style={{ fontWeight:800, fontSize:'1.05rem', color: r.activa ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.nombre}
          </h5>
          <div style={{ fontSize:'0.75rem', color:'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
        </div>
        <div className="d-flex flex-column align-items-end gap-1" style={{ flexShrink:0 }}>
          <span className={r.activa ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize:'0.68rem' }}>
            {archivada ? 'ARCHIVADA' : r.activa ? 'ACTIVA' : 'INACTIVA'}
          </span>
          {r.tipo && (
            <span className={r.tipo === 'simultanea' ? 'badge-simultanea' : 'badge-sencilla'} style={{ fontSize:'0.64rem' }}>
              {r.tipo === 'simultanea' ? '⚡ SIMULTÁNEA' : '🎯 SENCILLA'}
            </span>
          )}
        </div>
      </div>

      {/* Datos */}
      <div className="row g-2 mb-3" style={{ fontSize:'0.78rem' }}>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>PRECIO</div>
          <div style={{ fontWeight:700, color:'var(--jordyn-gold)', fontSize:'0.9rem' }}>{fmtCOP(r.precio)}</div>
        </div>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>SORTEO</div>
          <div style={{ fontWeight:600 }}>{r.fecha_sorteo ? new Date(r.fecha_sorteo).toLocaleDateString('es-CO') : 'Por definir'}</div>
        </div>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>VENTAS</div>
          <div style={{ fontWeight:700, color:'var(--jordyn-primary)' }}>{r.total_ventas || 0}</div>
        </div>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>RECAUDADO</div>
          <div style={{ fontWeight:700, color:'var(--jordyn-green)' }}>{fmtCOP(r.ingresos_totales)}</div>
        </div>
        {r.loteria_ref && (
          <div className="col-12">
            <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>LOTERÍA</div>
            <div style={{ fontWeight:600, fontSize:'0.78rem' }}>🎲 {r.loteria_ref}</div>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      {(r.total_ventas || 0) > 0 && (
        <div className="mb-3">
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem', color:'var(--jordyn-muted)', marginBottom:3 }}>
            <span>Progreso</span>
            <span>{Math.min(100, Math.round((r.total_ventas / 1000) * 100))}%</span>
          </div>
          <div className="jd-progress">
            <div className="jd-progress-bar jd-progress-bar-primary" style={{ width:`${Math.min(100,(r.total_ventas/1000)*100)}%` }}></div>
          </div>
        </div>
      )}

      {/* Botones */}
      {!archivada && (
        <div className="d-flex flex-wrap gap-2">
          <button className="btn-jordyn-outline" onClick={() => handleEdit(r)}
            style={{ fontSize:'0.75rem', padding:'4px 10px' }}>
            <i className="bi bi-pencil-fill me-1"></i>Editar
          </button>

          <button
            onClick={() => setModalNums(r)}
            style={{ background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.3)', color:'var(--jordyn-primary)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
          >
            <i className="bi bi-grid-3x3-gap"></i> Números
          </button>

          <a
            href={`/diseno-ticket?rifa=${r.id}`}
            style={{ background:'rgba(240,165,0,0.08)', border:'1.5px solid rgba(240,165,0,0.3)', color:'var(--jordyn-gold)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4, textDecoration:'none' }}
          >
            <i className="bi bi-ticket-perforated"></i> Boleto
          </a>

          <button
            onClick={() => handleToggle(r)}
            style={{
              background:'transparent',
              border: `1.5px solid ${r.activa ? 'rgba(230,57,70,0.4)' : 'rgba(6,214,160,0.4)'}`,
              color: r.activa ? 'var(--jordyn-red)' : 'var(--jordyn-green)',
              borderRadius:8, padding:'4px 10px',
              fontFamily:'var(--jordyn-font)', fontWeight:600, fontSize:'0.75rem', cursor:'pointer',
            }}
          >
            {r.activa ? 'Desactivar' : 'Activar'}
          </button>

          <button
            onClick={() => handleArchivar(r)}
            title="Archivar (conserva historial)"
            style={{ background:'transparent', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-muted)', borderRadius:8, padding:'4px 8px', cursor:'pointer', marginLeft:'auto' }}
          >
            <i className="bi bi-archive"></i>
          </button>
        </div>
      )}

      {archivada && (
        <div className="d-flex gap-2">
          <button className="btn-jordyn-danger" onClick={() => handleDelete(r)} style={{ fontSize:'0.75rem', padding:'4px 10px' }}>
            <i className="bi bi-trash3"></i> Eliminar
          </button>
          <button
            onClick={() => handleToggle({ ...r, activa: false })}
            style={{ background:'rgba(6,214,160,0.08)', border:'1.5px solid rgba(6,214,160,0.35)', color:'var(--jordyn-green)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Layout title="GESTIÓN DE RIFAS">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <p style={{ fontFamily:'var(--jordyn-font)', fontSize:'0.8rem', color:'var(--jordyn-muted)', margin:0 }}>
          <i className="bi bi-info-circle me-1"></i>
          {rifasActivas.length} rifa{rifasActivas.length !== 1 ? 's' : ''} activa{rifasActivas.length !== 1 ? 's' : ''}
        </p>
        <button className="btn-jordyn" onClick={handleNueva}>
          <i className="bi bi-plus-lg me-1"></i>NUEVA RIFA
        </button>
      </div>

      {/* ═══ FORMULARIO ═══ */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-4 fade-in">
          <h5 style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-primary)', marginBottom:'1.5rem' }}>
            {editId ? '✏️ Editar rifa' : '➕ Nueva rifa'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Imagen del premio */}
              <div className="col-12">
                <label className="jd-label">FOTO DEL PREMIO</label>
                {form.imagen_base64 ? (
                  <div style={{ position:'relative', display:'inline-block', width:'100%' }}>
                    <img src={form.imagen_base64} alt="Premio" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:10, border:'2px solid var(--jordyn-border)' }} />
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, imagen_base64: '' }))}
                      style={{ position:'absolute', top:8, right:8, background:'rgba(230,57,70,0.85)', border:'none', color:'#fff', borderRadius:6, padding:'3px 9px', cursor:'pointer' }}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ) : (
                  <div className="rifa-imagen-upload" onClick={() => fileRef.current?.click()}>
                    <i className="bi bi-image" style={{ fontSize:'2rem', color:'var(--jordyn-primary)', display:'block', marginBottom:6 }}></i>
                    <div style={{ fontSize:'0.82rem', color:'var(--jordyn-muted)', fontWeight:500 }}>Click para subir foto del premio (máx 2MB)</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImagen} />
              </div>

              {/* Nombre */}
              <div className="col-12 col-md-6">
                <label className="jd-label">NOMBRE DE LA RIFA *</label>
                <input className="jd-input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="RIFA JORDYN #1" />
              </div>

              {/* Premio */}
              <div className="col-12 col-md-6">
                <label className="jd-label">DESCRIPCIÓN DEL PREMIO *</label>
                <input className="jd-input" value={form.premio}
                  onChange={e => setForm(p => ({ ...p, premio: e.target.value }))}
                  placeholder="Moto, TV 65, Viaje, etc." />
              </div>

              {/* Precio COP */}
              <div className="col-12 col-md-4">
                <label className="jd-label">PRECIO POR NÚMERO (COP) *</label>
                <input
                  className="jd-input"
                  value={form.precio_display}
                  onChange={e => handlePrecioChange(e.target.value)}
                  onBlur={() => form.precio && setForm(p => ({ ...p, precio_display: fmtCOP(p.precio) }))}
                  onFocus={() => setForm(p => ({ ...p, precio_display: p.precio ? String(p.precio) : '' }))}
                  placeholder="$10.000"
                  style={{ fontWeight:700, fontSize:'1rem' }}
                />
                {form.precio > 0 && (
                  <div style={{ fontSize:'0.72rem', color:'var(--jordyn-primary)', marginTop:3, fontWeight:600 }}>
                    = {fmtCOP(form.precio)} por boleto
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div className="col-12 col-md-4">
                <label className="jd-label">FECHA DE SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha_sorteo}
                  onChange={e => setForm(p => ({ ...p, fecha_sorteo: e.target.value }))} />
              </div>

              {/* Tipo */}
              <div className="col-12 col-md-4">
                <label className="jd-label">TIPO DE RIFA</label>
                <select className="jd-select" value={form.tipo}
                  onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="sencilla">🎯 Sencilla (1 número ganador)</option>
                  <option value="simultanea">⚡ Simultánea (2 rifas paralelas)</option>
                </select>
              </div>

              {/* Lotería SELECT */}
              <div className="col-12">
                <label className="jd-label">LOTERÍA DE REFERENCIA</label>
                <select className="jd-select" value={form.loteria_ref}
                  onChange={e => setForm(p => ({ ...p, loteria_ref: e.target.value }))}>
                  <option value="">— Sin referencia —</option>
                  {LOTERIAS.map(grupo => (
                    <optgroup key={grupo.grupo} label={`─── ${grupo.grupo} ───`}>
                      {grupo.items.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label className="jd-label">DESCRIPCIÓN ADICIONAL</label>
                <textarea className="jd-input" rows={2} value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Detalles del premio, condiciones, etc."
                  style={{ resize:'vertical' }} />
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2 }}></span> Guardando...</>
                  : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Actualizar' : 'Crear rifa'}</>
                }
              </button>
              <button type="button" className="btn-jordyn-outline"
                onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ LISTA DE RIFAS ═══ */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : (
        <>
          {/* Rifas activas/inactivas */}
          <div className="row g-3 mb-4">
            {rifas.length === 0 && (
              <div className="col-12">
                <div className="jd-alert jd-alert-warning">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  No hay rifas creadas. ¡Crea la primera!
                </div>
              </div>
            )}
            {rifas.map(r => (
              <div key={r.id} className="col-12 col-md-6">
                <RifaCard r={r} />
              </div>
            ))}
          </div>

          {/* Rifas archivadas (colapsable) */}
          {rifasArchivadas.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchivadas(!showArchivadas)}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)',
                  borderRadius:10, padding:'0.8rem 1.25rem', cursor:'pointer',
                  color:'var(--jordyn-muted)', fontWeight:700, fontSize:'0.85rem', marginBottom: showArchivadas ? '1rem' : 0,
                }}
              >
                <span><i className="bi bi-archive me-2"></i>RIFAS ARCHIVADAS ({rifasArchivadas.length})</span>
                <i className={`bi bi-chevron-${showArchivadas ? 'up' : 'down'}`}></i>
              </button>

              {showArchivadas && (
                <div className="row g-3 fade-in">
                  {rifasArchivadas.map(r => (
                    <div key={r.id} className="col-12 col-md-6">
                      <RifaCard r={r} archivada />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ MODAL NÚMEROS ═══ */}
      {modalNums && (
        <ModalNumeros rifa={modalNums} onClose={() => setModalNums(null)} user={user} />
      )}
    </Layout>
  );
}