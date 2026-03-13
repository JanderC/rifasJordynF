// ============================================================
//   GestionRifas.js — RIFAS JORDYN
//   ✅ NUEVO: Editor de Ofertas en el formulario de rifa
//            Muestra las ofertas activas en la tarjeta de rifa
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, printTickets } from '../components/Ticket';
import { useAuth } from '../context/AuthContext';

/* ─── Loterías ─── */
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
  ofertas: [],   // ← nuevo campo
};

const fmtCOP = v =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v || 0);
const parseCOP = str => parseInt(str.replace(/\D/g, '') || '0');
const fileToBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

/* ═══════════════════════════════════════════════════════════
   ESTADOS DEL GRID
═══════════════════════════════════════════════════════════ */
const ESTADO_GRID = {
  libre:           { color:'#059669', bg:'rgba(6,214,160,0.10)',  border:'rgba(6,214,160,0.25)',  icon:'✓', label:'LIBRE' },
  parcial_vendido: { color:'#b37700', bg:'rgba(240,165,0,0.12)',  border:'rgba(240,165,0,0.28)',  icon:'½', label:'1 VENTA' },
  parcial_agotado: { color:'#c0303a', bg:'rgba(230,57,70,0.12)',  border:'rgba(230,57,70,0.30)',  icon:'⚡', label:'SEMI AGOT.' },
  agotado_total:   { color:'#e63946', bg:'rgba(230,57,70,0.22)',  border:'rgba(230,57,70,0.45)',  icon:'✗', label:'AGOTADO' },
  sin_asignar:     { color:'#6b9090', bg:'rgba(10,191,188,0.06)', border:'rgba(10,191,188,0.18)', icon:'·', label:'SIN ASIGNAR' },
};
const EST_RIFA_MODAL = {
  disponible: { color:'#059669', icon:'✓', label:'DISPONIBLE' },
  vendido_1:  { color:'#b37700', icon:'½', label:'1 DE 2 VENDIDO' },
  agotado:    { color:'#e63946', icon:'✗', label:'AGOTADO' },
};

/* ═══════════════════════════════════════════════════════════
   EDITOR DE OFERTAS
   Props:
     ofertas   → array actual  [{ cantidad, precio_total, etiqueta }]
     onChange  → fn(nuevasOfertas)
     precioBase→ precio unitario normal de la rifa
═══════════════════════════════════════════════════════════ */
function EditorOfertas({ ofertas = [], onChange, precioBase = 0 }) {
  const [nuevaCant,   setNuevaCant]   = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevaEtiq,   setNuevaEtiq]   = useState('');
  const [error,       setError]       = useState('');

  const agregarOferta = () => {
    setError('');
    const cant = parseInt(nuevaCant);
    const precio = parseCOP(nuevoPrecio);
    if (!cant || cant < 2)      { setError('La cantidad mínima es 2'); return; }
    if (!precio || precio <= 0) { setError('El precio debe ser mayor a 0'); return; }
    if (precio >= precioBase * cant && precioBase > 0) {
      setError(`El precio de oferta (${fmtCOP(precio)}) debe ser menor que el precio normal (${fmtCOP(precioBase * cant)})`);
      return;
    }
    if (ofertas.find(o => o.cantidad === cant)) {
      setError(`Ya existe una oferta para ${cant} números`);
      return;
    }
    const nueva = {
      cantidad:     cant,
      precio_total: precio,
      etiqueta:     nuevaEtiq.trim() || `Pack ${cant}`,
    };
    onChange([...ofertas, nueva].sort((a, b) => a.cantidad - b.cantidad));
    setNuevaCant(''); setNuevoPrecio(''); setNuevaEtiq('');
  };

  const eliminarOferta = (cant) => onChange(ofertas.filter(o => o.cantidad !== cant));

  const editarEtiqueta = (cant, val) =>
    onChange(ofertas.map(o => o.cantidad === cant ? { ...o, etiqueta: val } : o));

  const descuento = (o) => {
    if (!precioBase) return null;
    const normal  = precioBase * o.cantidad;
    const pct     = Math.round((1 - o.precio_total / normal) * 100);
    const ahorras = normal - o.precio_total;
    return { pct, ahorras };
  };

  return (
    <div style={{ marginTop:4 }}>

      {/* Lista de ofertas configuradas */}
      {ofertas.length === 0 ? (
        <div style={{ textAlign:'center', padding:'16px', background:'var(--jordyn-bg2)', borderRadius:10, border:'1px dashed var(--jordyn-border)', color:'var(--jordyn-muted)', fontSize:'.78rem', marginBottom:12 }}>
          Sin ofertas configuradas — los clientes pagarán el precio unitario siempre.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {ofertas.map(o => {
            const desc = descuento(o);
            return (
              <div key={o.cantidad} style={{
                background:'rgba(10,191,188,.05)', border:'1.5px solid rgba(10,191,188,.25)',
                borderRadius:10, padding:'10px 14px',
                display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
              }}>
                {/* Badge cantidad */}
                <div style={{ background:'var(--jordyn-primary)', color:'#fff', borderRadius:8, padding:'4px 10px', fontWeight:900, fontSize:'.85rem', flexShrink:0 }}>
                  ×{o.cantidad}
                </div>

                {/* Etiqueta editable */}
                <input
                  value={o.etiqueta}
                  onChange={e => editarEtiqueta(o.cantidad, e.target.value)}
                  style={{ flex:'1 1 110px', minWidth:80, border:'1px solid var(--jordyn-border)', borderRadius:7, padding:'5px 9px', fontSize:'.8rem', fontFamily:'var(--jordyn-font)', color:'var(--jordyn-text)', background:'#fff' }}
                  placeholder="Nombre de la oferta"
                />

                {/* Precio */}
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  <div style={{ fontWeight:800, color:'var(--jordyn-primary)', fontSize:'.88rem' }}>{fmtCOP(o.precio_total)}</div>
                  {desc && (
                    <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)' }}>
                      Ahorra {fmtCOP(desc.ahorras)} · <span style={{ color:'#059669', fontWeight:700 }}>−{desc.pct}%</span>
                    </div>
                  )}
                  {precioBase > 0 && (
                    <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', textDecoration:'line-through' }}>
                      Normal: {fmtCOP(precioBase * o.cantidad)}
                    </div>
                  )}
                </div>

                {/* Quitar */}
                <button onClick={() => eliminarOferta(o.cantidad)}
                  style={{ background:'rgba(230,57,70,.08)', border:'1px solid rgba(230,57,70,.3)', color:'#e63946', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:'.75rem', flexShrink:0 }}
                  title="Eliminar oferta">
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulario de nueva oferta */}
      <div style={{ background:'var(--jordyn-bg2)', borderRadius:10, padding:'12px 14px', border:'1px solid var(--jordyn-border)' }}>
        <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>
          <i className="bi bi-plus-circle-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
          Agregar oferta
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr auto', gap:8, alignItems:'end' }}>
          {/* Cantidad */}
          <div>
            <label className="jd-label" style={{ fontSize:'.6rem' }}>CANT. MÍNIMA</label>
            <input className="jd-input" type="number" min="2" max="50" value={nuevaCant}
              onChange={e => setNuevaCant(e.target.value)}
              placeholder="3" style={{ textAlign:'center', fontWeight:800, fontSize:'1rem' }} />
          </div>
          {/* Precio total */}
          <div>
            <label className="jd-label" style={{ fontSize:'.6rem' }}>PRECIO TOTAL</label>
            <input className="jd-input" value={nuevoPrecio}
              onChange={e => setNuevoPrecio(e.target.value)}
              onFocus={() => setNuevoPrecio(nuevoPrecio.replace(/\D/g,''))}
              onBlur={() => nuevoPrecio && setNuevoPrecio(fmtCOP(parseCOP(nuevoPrecio)))}
              placeholder="$25.000" style={{ fontWeight:700 }} />
          </div>
          {/* Etiqueta */}
          <div>
            <label className="jd-label" style={{ fontSize:'.6rem' }}>NOMBRE (opc.)</label>
            <input className="jd-input" value={nuevaEtiq}
              onChange={e => setNuevaEtiq(e.target.value)}
              placeholder="Pack Ahorro" />
          </div>
          {/* Botón */}
          <button onClick={agregarOferta} className="btn-jordyn"
            style={{ padding:'10px 14px', fontSize:'.8rem', height:44, alignSelf:'end' }}>
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>

        {/* Preview del ahorro mientras escribe */}
        {nuevaCant && nuevoPrecio && precioBase > 0 && (() => {
          const cant  = parseInt(nuevaCant);
          const prec  = parseCOP(nuevoPrecio);
          if (!cant || !prec) return null;
          const normal  = precioBase * cant;
          const pct     = Math.round((1 - prec / normal) * 100);
          const ahorras = normal - prec;
          return (
            <div style={{ marginTop:8, padding:'6px 10px', borderRadius:8, background:'rgba(6,214,160,.08)', border:'1px solid rgba(6,214,160,.2)', fontSize:'.72rem', color:'#059669', fontWeight:600 }}>
              {pct > 0
                ? `✅ El cliente ahorra ${fmtCOP(ahorras)} (${pct}% descuento) comprando ${cant} números`
                : pct === 0
                ? '⚠️ El precio es igual al precio normal — no hay descuento'
                : '⚠️ El precio de oferta es mayor al precio normal'}
            </div>
          );
        })()}

        {error && (
          <div style={{ marginTop:8, fontSize:'.72rem', color:'#e63946', fontWeight:600 }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL DETALLE DE NÚMERO  (sin cambios respecto al original)
═══════════════════════════════════════════════════════════ */
function NumeroDetalleModal({ numero, data, onClose, onRefresh, user }) {
  const [tab,     setTab]     = useState('info');
  const [rifaSel, setRifaSel] = useState(null);
  const [form,    setForm]    = useState({ nombre:'', telefono:'' });
  const [selling, setSelling] = useState(false);

  const rifas       = data?.rifas || [];
  const disponibles = rifas.filter(r => r.disponible);

  useEffect(() => { if (disponibles.length === 1) setRifaSel(disponibles[0]); }, [disponibles.length]);
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
      await API.post('/numeros/vender', { rifa_id: rifaSel.rifa_id, numero, nombre_comprador: form.nombre.trim(), telefono: form.telefono.trim() });
      toast.success(`✅ ¡Número ${numero} vendido en ${rifaSel.rifa_nombre}!`);
      setTab('ticket');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta');
    } finally { setSelling(false); }
  };

  const handlePrint = () => { if (!rifaSel) return; printTickets([rifaSel], numero, form, user?.nombre); };

  const tabs = [
    { id:'info',   icon:'bi-info-circle-fill',       label:'DETALLE' },
    ...(disponibles.length > 0 ? [{ id:'vender', icon:'bi-cart-plus-fill', label:'VENDER' }] : []),
    { id:'ticket', icon:'bi-ticket-perforated-fill', label:'BOLETO' },
  ];

  const estadoGlobal = rifas.every(r => r.estado==='agotado') ? 'agotado_total'
    : rifas.some(r => r.estado==='agotado') ? 'parcial_agotado'
    : rifas.some(r => r.estado==='vendido_1') ? 'parcial_vendido' : 'libre';
  const ecfg = ESTADO_GRID[estadoGlobal] || ESTADO_GRID.libre;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:10100, background:'rgba(10,30,30,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:680, maxHeight:'88vh', background:'#fff', border:'1px solid var(--jordyn-border)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(10,191,188,0.25)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))', padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexShrink:0 }}>
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:'3rem', color:'#fff', letterSpacing:'10px', lineHeight:1, paddingLeft:'6px', textShadow:'0 0 24px rgba(255,255,255,0.3)', flexShrink:0 }}>{numero}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'.58rem', color:'rgba(255,255,255,0.7)', letterSpacing:'3px', marginBottom:5, fontWeight:600 }}>NÚMERO SELECCIONADO</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              <span style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:'.6rem', fontWeight:700 }}>{ecfg.icon} {ecfg.label}</span>
              {rifas.map(r => { const rcfg = EST_RIFA_MODAL[r.estado] || EST_RIFA_MODAL.disponible; return (
                <span key={r.rifa_id} style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:'.58rem', fontWeight:600 }}>{r.rifa_nombre}: {rcfg.label}</span>
              ); })}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'6px 11px', cursor:'pointer', fontSize:'1rem', flexShrink:0 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--jordyn-border)', flexShrink:0, background:'var(--jordyn-bg2)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'10px 8px', background: tab===t.id ? '#fff' : 'transparent', border:'none', borderBottom: tab===t.id ? '2px solid var(--jordyn-primary)' : '2px solid transparent', color: tab===t.id ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', cursor:'pointer', fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:'.76rem', letterSpacing:'0.5px', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all .15s' }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* Body — sin cambios, reutiliza el código original */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px' }}>
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
                        <div style={{ background:`${rcfg.color}15`, border:`1px solid ${rcfg.color}35`, color:rcfg.color, borderRadius:20, padding:'2px 12px', fontSize:'.6rem', fontWeight:700 }}>{rcfg.icon} {rcfg.label}</div>
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
                            <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombre_comprador || c.comprador}</div>
                            <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:1 }}>Por <span style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>{c.nombre_vendedor}</span>{c.created_at && <span style={{ marginLeft:6 }}>{new Date(c.created_at).toLocaleDateString('es-CO')}</span>}</div>
                          </div>
                          <button onClick={() => { setRifaSel(r); setForm({ nombre:c.nombre_comprador||'', telefono:c.telefono||'' }); setTab('ticket'); }}
                            style={{ background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.25)', color:'var(--jordyn-primary)', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:'.68rem', fontWeight:600, flexShrink:0 }}>
                            <i className="bi bi-ticket-perforated"></i>
                          </button>
                        </div>
                      ))}
                    </div>
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

          {tab === 'vender' && (
            <div>
              {disponibles.length > 1 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>SELECCIONA LA RIFA</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {disponibles.map(r => (
                      <button key={r.rifa_id} onClick={() => setRifaSel(r)} style={{ flex:1, padding:'10px 12px', textAlign:'left', background: rifaSel?.rifa_id===r.rifa_id ? 'rgba(10,191,188,0.10)' : 'var(--jordyn-bg2)', border:`2px solid ${rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, borderRadius:10, cursor:'pointer', transition:'all .15s' }}>
                        <div style={{ fontWeight:800, fontSize:'0.88rem', color: rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-text)' }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>{r.premio}</div>
                        <div style={{ fontSize:'.66rem', color:'var(--jordyn-green)', marginTop:3, fontWeight:700 }}>
                          {fmt(r.precio)}{r.veces_vendido===1 && <span style={{ color:'var(--jordyn-gold)', marginLeft:6 }}>· ya tiene 1 venta</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom:14 }}>
                <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                <input className="jd-input" placeholder="Nombre completo" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))} autoFocus />
              </div>
              <div style={{ marginBottom:20 }}>
                <label className="jd-label">TELÉFONO</label>
                <input className="jd-input" placeholder="+58..." value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono:e.target.value }))} />
              </div>
              <button className="btn-jordyn w-100" onClick={handleVender} disabled={selling}>
                {selling ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2 }}></span> Registrando...</> : <><i className="bi bi-check2-circle me-2"></i>REGISTRAR VENTA</>}
              </button>
            </div>
          )}

          {tab === 'ticket' && rifaSel && (
            <div>
              <TicketPreview rifa={rifaSel} numero={numero} comprador={form} vendedor={user?.nombre} />
              <button className="btn-jordyn w-100 mt-3" onClick={handlePrint}>
                <i className="bi bi-printer-fill me-2"></i>IMPRIMIR BOLETO
              </button>
            </div>
          )}
          {tab === 'ticket' && !rifaSel && (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--jordyn-muted)', fontSize:'.85rem' }}>Selecciona una rifa para ver el boleto</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL DE NÚMEROS (sin cambios estructurales)
═══════════════════════════════════════════════════════════ */
function ModalNumeros({ rifa, onClose, user }) {
  const [numeros,          setNumeros]         = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [filtro,           setFiltro]          = useState('todos');
  const [busqueda,         setBusqueda]        = useState('');
  const [modalNumero,      setModalNumero]     = useState(null);
  const [modalData,        setModalData]       = useState(null);
  const [loadingModal,     setLoadingModal]    = useState(false);
  const [mostrarSinAsignar,setMostrarSinAsignar] = useState(false);

  const loadNumeros = useCallback(async () => {
    setLoading(true);
    try {
      const [globalRes, asignadosRes] = await Promise.all([
        API.get('/numeros/estado-global'),
        API.get('/numeros/vendedor/mis-numeros'),
      ]);
      const asignadosMap = {};
      asignadosRes.data.forEach(a => { if (!asignadosMap[a.rifa_id]) asignadosMap[a.rifa_id] = new Set(); asignadosMap[a.rifa_id].add(a.numero); });
      const conAsignacion = globalRes.data.map(n => ({
        ...n,
        es_sin_asignar: n.estado_global === 'libre' && Object.values(asignadosMap).every(s => !s.has(n.numero)),
        estado_display: n.estado_global === 'libre' && Object.values(asignadosMap).every(s => !s.has(n.numero)) ? 'sin_asignar' : n.estado_global,
      }));
      setNumeros(conAsignacion);
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNumeros(); }, [loadNumeros]);

  const handleClickNumero = async (n) => {
    if (modalNumero === n.numero) { setModalNumero(null); setModalData(null); return; }
    setModalNumero(n.numero);
    setModalData(null);
    setLoadingModal(true);
    try {
      const r = await API.get(`/numeros/verificar/${n.numero}`);
      setModalData(r.data);
    } catch { toast.error('Error cargando detalle'); }
    finally { setLoadingModal(false); }
  };

  const closeDetalleModal = () => { setModalNumero(null); setModalData(null); };

  const conteos = { todos:0, libre:0, parcial_vendido:0, parcial_agotado:0, agotado_total:0, sin_asignar:0 };
  numeros.forEach(n => { conteos.todos++; conteos[n.estado_display] = (conteos[n.estado_display]||0)+1; });

  const filtered = numeros.filter(n => {
    if (busqueda) return n.numero.includes(busqueda.padStart(3,'0').slice(-3));
    if (filtro === 'sin_asignar') return n.es_sin_asignar;
    if (filtro !== 'todos' && n.estado_global !== filtro) return false;
    return true;
  });

  const total = numeros.length || 1;
  const pctPV  = (conteos.parcial_vendido / total * 100).toFixed(1);
  const pctPA  = (conteos.parcial_agotado / total * 100).toFixed(1);
  const pctAT  = (conteos.agotado_total   / total * 100).toFixed(1);
  const pctTot = ((conteos.parcial_vendido + conteos.parcial_agotado + conteos.agotado_total) / total * 100).toFixed(0);

  const FILTROS = [
    { key:'todos',           label:'Todos',       count:conteos.todos,           color:'var(--jordyn-text)' },
    { key:'libre',           label:'Libres',      count:conteos.libre,           color:'#059669' },
    { key:'parcial_vendido', label:'1 venta',     count:conteos.parcial_vendido, color:'#b37700' },
    { key:'parcial_agotado', label:'Semi agotado',count:conteos.parcial_agotado, color:'#c0303a' },
    { key:'agotado_total',   label:'Agotado',     count:conteos.agotado_total,   color:'var(--jordyn-red)' },
    { key:'sin_asignar',     label:'Sin asignar', count:conteos.sin_asignar,     color:'var(--jordyn-muted)' },
  ];

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && !modalNumero && onClose()}
        style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,0.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
        <div style={{ width:'100%', maxWidth:860, maxHeight:'93vh', background:'#fff', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 72px rgba(10,191,188,0.22)' }}>

          <div style={{ background:'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))', color:'#fff', padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'1.05rem' }}><i className="bi bi-grid-3x3-gap me-2"></i>NÚMEROS — {rifa.nombre}</div>
              <div style={{ fontSize:'0.7rem', opacity:0.85, marginTop:3 }}>{conteos.libre} libres · {conteos.parcial_vendido} con 1 venta · {conteos.agotado_total} agotados · {pctTot}% vendido</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'1rem' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--jordyn-border)', flexShrink:0, background:'var(--jordyn-bg2)' }}>
            <div style={{ height:8, background:'#e9ecef', borderRadius:8, overflow:'hidden', display:'flex', gap:1 }}>
              <div style={{ width:`${pctPV}%`, background:'linear-gradient(90deg,#d49000,#f0a500)', transition:'width .8s ease' }}></div>
              <div style={{ width:`${pctPA}%`, background:'linear-gradient(90deg,#a02020,#e63946)', transition:'width .8s ease' }}></div>
              <div style={{ width:`${pctAT}%`, background:'var(--jordyn-red)', transition:'width .8s ease' }}></div>
            </div>
          </div>

          <div style={{ padding:'0.6rem 1.25rem', borderBottom:'1px solid var(--jordyn-border)', display:'flex', gap:'6px', flexWrap:'wrap', flexShrink:0, alignItems:'center', background:'#fff' }}>
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)} style={{ background: filtro===f.key ? f.color : '#fff', border:`1.5px solid ${filtro===f.key ? f.color : 'var(--jordyn-border)'}`, color: filtro===f.key ? '#fff' : 'var(--jordyn-muted)', borderRadius:20, padding:'3px 11px', fontSize:'.68rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', transition:'all .15s' }}>
                {f.label} <span style={{ opacity:.75 }}>({f.count})</span>
              </button>
            ))}
            <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
              <input className="jd-input" style={{ maxWidth:90, textAlign:'center', fontWeight:800, letterSpacing:5, fontSize:'1rem', padding:'.3rem .5rem' }} placeholder="000" value={busqueda} onChange={e => setBusqueda(e.target.value.replace(/\D/g,'').slice(0,3))} maxLength={3} />
              <button className="btn-jordyn-outline" onClick={loadNumeros} style={{ padding:'5px 10px' }}><i className="bi bi-arrow-clockwise"></i></button>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'0.9rem 1.25rem' }}>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="jd-spinner" style={{ width:40, height:40 }}></div></div>
            ) : (
              <>
                <div className="numero-grid">
                  {filtered.map(n => {
                    const cfg = ESTADO_GRID[n.estado_display] || ESTADO_GRID.libre;
                    const isActive = modalNumero === n.numero;
                    return (
                      <div key={n.numero} onClick={() => handleClickNumero(n)} title={`${n.numero}`}
                        style={{ aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'.68rem', borderRadius:6, cursor:'pointer', transition:'all .12s', border:`1.5px ${n.estado_display==='sin_asignar'?'dashed':'solid'} ${isActive?'var(--jordyn-primary)':cfg.border}`, background: isActive?'rgba(10,191,188,0.18)':cfg.bg, color: isActive?'var(--jordyn-primary)':cfg.color, transform: isActive?'scale(1.2)':undefined, zIndex: isActive?5:undefined, position: isActive?'relative':undefined, boxShadow: isActive?'0 0 12px rgba(10,191,188,0.4)':undefined, userSelect:'none' }}>
                        {loadingModal && isActive ? '⟳' : n.numero}
                      </div>
                    );
                  })}
                </div>
                {filtered.length === 0 && <div style={{ textAlign:'center', padding:'3rem', color:'var(--jordyn-muted)', fontSize:'.85rem' }}>Sin resultados para este filtro</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {modalNumero && modalData && (
        <NumeroDetalleModal numero={modalNumero} data={modalData} onClose={closeDetalleModal} onRefresh={loadNumeros} user={user} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL — GestionRifas
═══════════════════════════════════════════════════════════ */
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
  const [modalNums,      setModalNums]      = useState(null);
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

  const handlePrecioChange = (val) => {
    const num = parseCOP(val);
    setForm(p => ({ ...p, precio: num, precio_display: num ? fmtCOP(num) : '' }));
  };

  const handleImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagen demasiado grande (máx 2MB)'); return; }
    const b64 = await fileToBase64(file);
    setForm(p => ({ ...p, imagen_base64: b64 }));
  };

  const handleEdit = (r) => {
    setForm({
      nombre:         r.nombre       || '',
      descripcion:    r.descripcion  || '',
      premio:         r.premio       || '',
      precio:         r.precio       || '',
      precio_display: r.precio       ? fmtCOP(r.precio) : '',
      fecha_sorteo:   r.fecha_sorteo ? r.fecha_sorteo.split('T')[0] : '',
      loteria_ref:    r.loteria_ref  || '',
      tipo:           r.tipo         || 'sencilla',
      imagen_base64:  r.imagen_url   || '',
      ofertas:        Array.isArray(r.ofertas) ? r.ofertas : [],
    });
    setEditId(r.id);
    setShowForm(true);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const handleNueva = () => { setForm(emptyForm); setEditId(null); setShowForm(true); window.scrollTo({ top:0, behavior:'smooth' }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.premio || !form.precio) { toast.error('Nombre, premio y precio son requeridos'); return; }
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
        ofertas:      form.ofertas || [],
      };
      if (editId) { await API.put(`/rifas/${editId}`, payload); toast.success('Rifa actualizada'); }
      else        { await API.post('/rifas', payload);           toast.success('Rifa creada');     }
      setShowForm(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando rifa'); }
    finally { setSaving(false); }
  };

  const handleToggle  = async (r) => { try { await API.put(`/rifas/${r.id}`, { activa: !r.activa }); toast.success(r.activa ? 'Rifa desactivada' : 'Rifa activada'); load(); } catch { toast.error('Error'); } };
  const handleArchivar = async (r) => { try { await API.put(`/rifas/${r.id}`, { activa: false, estado: 'archivada' }); toast.success('Rifa archivada'); load(); } catch (err) { toast.error(err.response?.data?.error || 'Error archivando rifa'); } };
  const handleDelete  = async (r) => {
    if (!window.confirm(`¿Eliminar definitivamente "${r.nombre}"?`)) return;
    try { await API.delete(`/rifas/${r.id}`); toast.success('Rifa eliminada'); load(); } catch (err) { toast.error(err.response?.data?.error || 'Error eliminando rifa'); }
  };

  const rifasActivas = rifas.filter(r => r.activa);

  /* ── Tarjeta de rifa ── */
  const RifaCard = ({ r, archivada = false }) => {
    const ofertas = Array.isArray(r.ofertas) ? r.ofertas : [];
    return (
      <div className={`jd-card ${r.activa ? 'jd-card-primary' : ''} fade-in`} style={{ opacity: r.activa ? 1 : 0.72, height:'100%' }}>

        {r.imagen_url && (
          <img src={r.imagen_url} alt="Premio" style={{ width:'100%', maxHeight:180, objectFit:'cover', borderRadius:8, marginBottom:'0.75rem' }} />
        )}

        <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
          <div style={{ minWidth:0 }}>
            <h5 style={{ fontWeight:800, fontSize:'1.05rem', color: r.activa ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nombre}</h5>
            <div style={{ fontSize:'0.75rem', color:'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
          </div>
          <div className="d-flex flex-column align-items-end gap-1" style={{ flexShrink:0 }}>
            <span className={r.activa ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize:'0.68rem' }}>{archivada ? 'ARCHIVADA' : r.activa ? 'ACTIVA' : 'INACTIVA'}</span>
            {r.tipo && <span className={r.tipo === 'simultanea' ? 'badge-simultanea' : 'badge-sencilla'} style={{ fontSize:'0.64rem' }}>{r.tipo === 'simultanea' ? '⚡ SIMULTÁNEA' : '🎯 SENCILLA'}</span>}
          </div>
        </div>

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
        </div>

        {/* ── Ofertas activas (resumen) ── */}
        {ofertas.length > 0 && (
          <div style={{ marginBottom:'0.75rem', padding:'8px 10px', background:'rgba(10,191,188,.05)', border:'1px solid rgba(10,191,188,.2)', borderRadius:8 }}>
            <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>
              <i className="bi bi-tag-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
              {ofertas.length} oferta{ofertas.length>1?'s':''} activa{ofertas.length>1?'s':''}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {ofertas.map(o => {
                const desc = r.precio > 0 ? Math.round((1 - o.precio_total / (r.precio * o.cantidad)) * 100) : 0;
                return (
                  <span key={o.cantidad} style={{ background:'rgba(10,191,188,.12)', color:'var(--jordyn-primary)', border:'1px solid rgba(10,191,188,.3)', borderRadius:20, padding:'2px 8px', fontSize:'.65rem', fontWeight:700 }}>
                    ×{o.cantidad} → {fmtCOP(o.precio_total)} {desc>0 && <span style={{ color:'#059669' }}>−{desc}%</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {(r.total_ventas || 0) > 0 && (
          <div className="mb-3">
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem', color:'var(--jordyn-muted)', marginBottom:3 }}>
              <span>Progreso</span><span>{Math.min(100, Math.round((r.total_ventas / 1000) * 100))}%</span>
            </div>
            <div className="jd-progress"><div className="jd-progress-bar jd-progress-bar-primary" style={{ width:`${Math.min(100,(r.total_ventas/1000)*100)}%` }}></div></div>
          </div>
        )}

        {!archivada && (
          <div className="d-flex flex-wrap gap-2">
            <button className="btn-jordyn-outline" onClick={() => handleEdit(r)} style={{ fontSize:'0.75rem', padding:'4px 10px' }}><i className="bi bi-pencil-fill me-1"></i>Editar</button>
            <button onClick={() => setModalNums(r)} style={{ background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.3)', color:'var(--jordyn-primary)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}><i className="bi bi-grid-3x3-gap"></i> Números</button>
            <a href={`/diseno-ticket?rifa=${r.id}`} style={{ background:'rgba(240,165,0,0.08)', border:'1.5px solid rgba(240,165,0,0.3)', color:'var(--jordyn-gold)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4, textDecoration:'none' }}><i className="bi bi-ticket-perforated"></i> Boleto</a>
            <button onClick={() => handleToggle(r)} style={{ background:'transparent', border:`1.5px solid ${r.activa ? 'rgba(230,57,70,0.4)' : 'rgba(6,214,160,0.4)'}`, color: r.activa ? 'var(--jordyn-red)' : 'var(--jordyn-green)', borderRadius:8, padding:'4px 10px', fontFamily:'var(--jordyn-font)', fontWeight:600, fontSize:'0.75rem', cursor:'pointer' }}>{r.activa ? 'Desactivar' : 'Activar'}</button>
            <button onClick={() => handleArchivar(r)} title="Archivar" style={{ background:'transparent', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-muted)', borderRadius:8, padding:'4px 8px', cursor:'pointer', marginLeft:'auto' }}><i className="bi bi-archive"></i></button>
          </div>
        )}
        {archivada && (
          <div className="d-flex gap-2">
            <button className="btn-jordyn-danger" onClick={() => handleDelete(r)} style={{ fontSize:'0.75rem', padding:'4px 10px' }}><i className="bi bi-trash3"></i> Eliminar</button>
            <button onClick={() => handleToggle({ ...r, activa: false })} style={{ background:'rgba(6,214,160,0.08)', border:'1.5px solid rgba(6,214,160,0.35)', color:'var(--jordyn-green)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}><i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout title="GESTIÓN DE RIFAS">

      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <p style={{ fontFamily:'var(--jordyn-font)', fontSize:'0.8rem', color:'var(--jordyn-muted)', margin:0 }}>
          <i className="bi bi-info-circle me-1"></i>{rifasActivas.length} rifa{rifasActivas.length !== 1 ? 's' : ''} activa{rifasActivas.length !== 1 ? 's' : ''}
        </p>
        <button className="btn-jordyn" onClick={handleNueva}><i className="bi bi-plus-lg me-1"></i>NUEVA RIFA</button>
      </div>

      {/* ═══ FORMULARIO ═══ */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-4 fade-in">
          <h5 style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-primary)', marginBottom:'1.5rem' }}>
            {editId ? '✏️ Editar rifa' : '➕ Nueva rifa'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Imagen */}
              <div className="col-12">
                <label className="jd-label">FOTO DEL PREMIO</label>
                {form.imagen_base64 ? (
                  <div style={{ position:'relative', display:'inline-block', width:'100%' }}>
                    <img src={form.imagen_base64} alt="Premio" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:10, border:'2px solid var(--jordyn-border)' }} />
                    <button type="button" onClick={() => setForm(p => ({ ...p, imagen_base64:'' }))} style={{ position:'absolute', top:8, right:8, background:'rgba(230,57,70,0.85)', border:'none', color:'#fff', borderRadius:6, padding:'3px 9px', cursor:'pointer' }}><i className="bi bi-x-lg"></i></button>
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
                <input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="RIFA JORDYN #1" />
              </div>

              {/* Premio */}
              <div className="col-12 col-md-6">
                <label className="jd-label">DESCRIPCIÓN DEL PREMIO *</label>
                <input className="jd-input" value={form.premio} onChange={e => setForm(p => ({ ...p, premio: e.target.value }))} placeholder="Moto, TV 65, Viaje, etc." />
              </div>

              {/* Precio */}
              <div className="col-12 col-md-4">
                <label className="jd-label">PRECIO POR NÚMERO (COP) *</label>
                <input className="jd-input" value={form.precio_display}
                  onChange={e => handlePrecioChange(e.target.value)}
                  onBlur={() => form.precio && setForm(p => ({ ...p, precio_display: fmtCOP(p.precio) }))}
                  onFocus={() => setForm(p => ({ ...p, precio_display: p.precio ? String(p.precio) : '' }))}
                  placeholder="$10.000" style={{ fontWeight:700, fontSize:'1rem' }} />
                {form.precio > 0 && <div style={{ fontSize:'0.72rem', color:'var(--jordyn-primary)', marginTop:3, fontWeight:600 }}>= {fmtCOP(form.precio)} por boleto</div>}
              </div>

              {/* Fecha */}
              <div className="col-12 col-md-4">
                <label className="jd-label">FECHA DE SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha_sorteo} onChange={e => setForm(p => ({ ...p, fecha_sorteo: e.target.value }))} />
              </div>

              {/* Tipo */}
              <div className="col-12 col-md-4">
                <label className="jd-label">TIPO DE RIFA</label>
                <select className="jd-select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="sencilla">🎯 Sencilla (1 número ganador)</option>
                  <option value="simultanea">⚡ Simultánea (2 rifas paralelas)</option>
                </select>
              </div>

              {/* Lotería */}
              <div className="col-12">
                <label className="jd-label">LOTERÍA DE REFERENCIA</label>
                <select className="jd-select" value={form.loteria_ref} onChange={e => setForm(p => ({ ...p, loteria_ref: e.target.value }))}>
                  <option value="">— Sin referencia —</option>
                  {LOTERIAS.map(grupo => (
                    <optgroup key={grupo.grupo} label={`─── ${grupo.grupo} ───`}>
                      {grupo.items.map(l => <option key={l} value={l}>{l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label className="jd-label">DESCRIPCIÓN ADICIONAL</label>
                <textarea className="jd-input" rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Detalles del premio, condiciones, etc." style={{ resize:'vertical' }} />
              </div>

              {/* ══ OFERTAS POR CANTIDAD ══ */}
              <div className="col-12">
                <div style={{ borderTop:'1px solid var(--jordyn-border)', paddingTop:'1.25rem' }}>
                  <label className="jd-label" style={{ fontSize:'.7rem' }}>
                    <i className="bi bi-tag-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
                    OFERTAS POR CANTIDAD (opcional)
                  </label>
                  <p style={{ fontSize:'.75rem', color:'var(--jordyn-muted)', marginBottom:10, lineHeight:1.5 }}>
                    Define precios especiales cuando el cliente compra cierta cantidad de números.
                    Ej: "3 números por $25.000" en lugar de $30.000 (precio normal).
                    Las ofertas se muestran automáticamente en la tienda pública.
                  </p>
                  <EditorOfertas
                    ofertas={form.ofertas}
                    onChange={nuevas => setForm(p => ({ ...p, ofertas: nuevas }))}
                    precioBase={form.precio}
                  />
                </div>
              </div>

            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2 }}></span> Guardando...</> : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Actualizar' : 'Crear rifa'}</>}
              </button>
              <button type="button" className="btn-jordyn-outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ LISTA DE RIFAS ═══ */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width:40, height:40 }}></div></div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            {rifas.length === 0 && (
              <div className="col-12"><div className="jd-alert jd-alert-warning"><i className="bi bi-exclamation-triangle-fill"></i>No hay rifas creadas. ¡Crea la primera!</div></div>
            )}
            {rifas.map(r => <div key={r.id} className="col-12 col-md-6"><RifaCard r={r} /></div>)}
          </div>

          {rifasArchivadas.length > 0 && (
            <div>
              <button onClick={() => setShowArchivadas(!showArchivadas)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'0.8rem 1.25rem', cursor:'pointer', color:'var(--jordyn-muted)', fontWeight:700, fontSize:'0.85rem', marginBottom: showArchivadas ? '1rem' : 0 }}>
                <span><i className="bi bi-archive me-2"></i>RIFAS ARCHIVADAS ({rifasArchivadas.length})</span>
                <i className={`bi bi-chevron-${showArchivadas ? 'up' : 'down'}`}></i>
              </button>
              {showArchivadas && (
                <div className="row g-3 fade-in">
                  {rifasArchivadas.map(r => <div key={r.id} className="col-12 col-md-6"><RifaCard r={r} archivada /></div>)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modalNums && <ModalNumeros rifa={modalNums} onClose={() => setModalNums(null)} user={user} />}
    </Layout>
  );
}