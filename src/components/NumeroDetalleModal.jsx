// ============================================================
//   components/NumeroDetalleModal.jsx — RIFAS JORDYN
//   ✅ Venta interna multi-número en una sola transacción
//   ✅ Fechas sin timezone offset (usa utils/dates)
//   ✅ Corrección lógica rifas simultáneas
// ============================================================
import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, printTickets } from './Ticket';
import { fmtFecha } from '../utils/dates';

const fmtCOP = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const ESTADO_GRID = {
  libre:           { color:'#059669', bg:'rgba(6,214,160,0.10)',  border:'rgba(6,214,160,0.25)',  icon:'✓', label:'LIBRE' },
  parcial_vendido: { color:'#b37700', bg:'rgba(240,165,0,0.12)',  border:'rgba(240,165,0,0.28)',  icon:'½', label:'1 VENTA' },
  parcial_agotado: { color:'#c0303a', bg:'rgba(230,57,70,0.12)',  border:'rgba(230,57,70,0.30)',  icon:'⚡', label:'SEMI AGOT.' },
  agotado_total:   { color:'#e63946', bg:'rgba(230,57,70,0.22)',  border:'rgba(230,57,70,0.45)',  icon:'✗', label:'AGOTADO' },
};
const EST_RIFA_MODAL = {
  disponible: { color:'#059669', icon:'✓', label:'DISPONIBLE' },
  vendido_1:  { color:'#b37700', icon:'½', label:'1 DE 2 VENDIDO' },
  agotado:    { color:'#e63946', icon:'✗', label:'AGOTADO' },
};

/* ════════════════════════════════════════════════════════════
   NumeroDetalleModal
   data.rifas → array de rifas donde existe este número
════════════════════════════════════════════════════════════ */
export function NumeroDetalleModal({ numero, data, onClose, onRefresh, user }) {
  const [tab,     setTab]     = useState('info');
  const [rifaSel, setRifaSel] = useState(null);
  const [form,    setForm]    = useState({ nombre:'', telefono:'' });
  const [selling, setSelling] = useState(false);

  // ── Multi-número: números adicionales seleccionados ──
  const [numerosExtra, setNumerosExtra] = useState([]);   // strings adicionales
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [disponiblesRifa, setDisponiblesRifa] = useState([]); // para el picker

  const rifas       = data?.rifas || [];
  // ── FIX SIMULTANEIDAD: disponible = veces_vendido < 2 (no bloqueamos por otras rifas)
  const disponibles = rifas.filter(r => r.estado !== 'agotado');

  useEffect(() => { if (disponibles.length === 1) setRifaSel(disponibles[0]); }, [disponibles.length]);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // Cargar números disponibles de la rifa seleccionada para el picker multi
  useEffect(() => {
    if (!rifaSel || tab !== 'vender') return;
    setLoadingExtra(true);
    API.get(`/publico/rifas/${rifaSel.rifa_id}/numeros-disponibles`)
      .then(r => setDisponiblesRifa(r.data.filter(n => n.estado === 'disponible' && n.numero !== numero)))
      .catch(() => {})
      .finally(() => setLoadingExtra(false));
  }, [rifaSel, tab, numero]);

  const toggleExtra = (n) => {
    setNumerosExtra(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    );
  };

  // ── Vender uno o varios números ──
  const handleVender = async () => {
    if (!rifaSel)            return toast.error('Selecciona una rifa');
    if (!form.nombre.trim()) return toast.error('El nombre del comprador es requerido');

    const todosNumeros = [numero, ...numerosExtra];
    setSelling(true);
    try {
      if (todosNumeros.length === 1) {
        // Venta individual (endpoint original)
        await API.post('/numeros/vender', {
          rifa_id:          rifaSel.rifa_id,
          numero,
          nombre_comprador: form.nombre.trim(),
          telefono:         form.telefono.trim(),
        });
        toast.success(`✅ Número ${numero} vendido en ${rifaSel.rifa_nombre}`);
      } else {
        // Venta bulk
        const res = await API.post('/numeros/vender-bulk', {
          rifa_id:          rifaSel.rifa_id,
          numeros:          todosNumeros,
          nombre_comprador: form.nombre.trim(),
          telefono:         form.telefono.trim(),
        });
        const { vendidos = [], fallidos = [] } = res.data;
        if (vendidos.length > 0) {
          toast.success(`✅ ${vendidos.length} número(s) vendidos`);
          if (fallidos.length > 0)
            toast.warning(`⚠️ ${fallidos.length} número(s) no pudieron venderse: ${fallidos.map(f=>f.numero).join(', ')}`);
        } else {
          toast.error('No se pudo vender ningún número');
        }
      }
      setTab('ticket');
      setNumerosExtra([]);
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta');
    } finally { setSelling(false); }
  };

  const handlePrint = () => {
    if (!rifaSel) return;
    const todosNumeros = [numero, ...numerosExtra];
    printTickets([rifaSel], todosNumeros.join(' · '), form, user?.nombre);
  };

  const tabs = [
    { id:'info',   icon:'bi-info-circle-fill',       label:'DETALLE' },
    ...(disponibles.length > 0 ? [{ id:'vender', icon:'bi-cart-plus-fill', label:'VENDER' }] : []),
    { id:'ticket', icon:'bi-ticket-perforated-fill', label:'BOLETO' },
  ];

  const estadoGlobal = rifas.every(r => r.estado==='agotado') ? 'agotado_total'
    : rifas.some(r => r.estado==='agotado') ? 'parcial_agotado'
    : rifas.some(r => r.estado==='vendido_1') ? 'parcial_vendido' : 'libre';
  const ecfg = ESTADO_GRID[estadoGlobal] || ESTADO_GRID.libre;

  const todosVenta = [numero, ...numerosExtra];
  const totalVenta = rifaSel ? fmtCOP(rifaSel.precio * todosVenta.length) : '';

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:10100, background:'rgba(10,30,30,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:720, maxHeight:'90vh', background:'#fff', border:'1px solid var(--jordyn-border)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(10,191,188,0.25)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))', padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexShrink:0 }}>
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:'3rem', color:'#fff', letterSpacing:'10px', lineHeight:1, paddingLeft:'6px', textShadow:'0 0 24px rgba(255,255,255,0.3)', flexShrink:0 }}>{numero}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'.58rem', color:'rgba(255,255,255,0.7)', letterSpacing:'3px', marginBottom:5, fontWeight:600 }}>NÚMERO SELECCIONADO</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              <span style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:'.6rem', fontWeight:700 }}>{ecfg.icon} {ecfg.label}</span>
              {rifas.map(r => { const rcfg = EST_RIFA_MODAL[r.estado]||EST_RIFA_MODAL.disponible; return (
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
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'10px 8px', background: tab===t.id ? '#fff' : 'transparent',
              border:'none', borderBottom: tab===t.id ? '2px solid var(--jordyn-primary)' : '2px solid transparent',
              color: tab===t.id ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', cursor:'pointer',
              fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:'.76rem', letterSpacing:'0.5px',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all .15s',
            }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px' }}>

          {/* ── TAB: DETALLE ── */}
          {tab === 'info' && (
            <div>
              {rifas.map((r, ri) => {
                const rcfg = EST_RIFA_MODAL[r.estado] || EST_RIFA_MODAL.disponible;
                const accent = ri === 0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)';
                return (
                  <div key={r.rifa_id} style={{ background:'var(--jordyn-bg2)', border:`1px solid ${rcfg.color}30`, borderRadius:10, marginBottom:10, overflow:'hidden' }}>
                    <div style={{ background:`linear-gradient(90deg,${accent}0d,transparent)`, padding:'10px 14px', borderBottom:'1px solid var(--jordyn-border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'0.95rem', color:accent }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>🏆 {r.premio} · {fmtCOP(r.precio)}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ background:`${rcfg.color}15`, border:`1px solid ${rcfg.color}35`, color:rcfg.color, borderRadius:20, padding:'2px 12px', fontSize:'.6rem', fontWeight:700 }}>{rcfg.icon} {rcfg.label}</div>
                        <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:3 }}>{r.veces_vendido} / 2 vendidos</div>
                      </div>
                    </div>
                    <div style={{ padding:'10px 14px' }}>
                      {r.compradores?.length === 0
                        ? <div style={{ textAlign:'center', padding:'8px 0', fontSize:'.7rem', color:'var(--jordyn-muted)' }}>— Sin ventas —</div>
                        : r.compradores.map((c, ci) => (
                          <div key={ci} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom: ci < r.compradores.length-1 ? '1px solid var(--jordyn-border)' : 'none' }}>
                            <div style={{ width:30, height:30, borderRadius:'50%', background: ci===0 ? 'rgba(10,191,188,0.12)' : 'rgba(240,165,0,0.12)', border:`1.5px solid ${ci===0 ? 'rgba(10,191,188,0.3)' : 'rgba(240,165,0,0.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <span style={{ fontWeight:900, color: ci===0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)', fontSize:'0.9rem' }}>{ci+1}</span>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombre_comprador || c.comprador}</div>
                              <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', marginTop:1 }}>Por <span style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>{c.nombre_vendedor}</span></div>
                            </div>
                            <button onClick={() => { setRifaSel(r); setForm({ nombre:c.nombre_comprador||'', telefono:c.telefono||'' }); setTab('ticket'); }}
                              style={{ background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.25)', color:'var(--jordyn-primary)', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:'.68rem', fontWeight:600, flexShrink:0 }}>
                              <i className="bi bi-ticket-perforated"></i>
                            </button>
                          </div>
                        ))
                      }
                    </div>
                    {/* Fecha corregida */}
                    {(r.fecha_sorteo || r.loteria_ref) && (
                      <div style={{ borderTop:'1px solid var(--jordyn-border)', padding:'6px 14px', display:'flex', gap:16, flexWrap:'wrap', fontSize:'.58rem', color:'var(--jordyn-muted)' }}>
                        {r.fecha_sorteo && <span>📅 {fmtFecha(r.fecha_sorteo)}</span>}
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

          {/* ── TAB: VENDER (multi-número) ── */}
          {tab === 'vender' && (
            <div>
              {/* Selección de rifa */}
              {disponibles.length > 1 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>SELECCIONA LA RIFA</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {disponibles.map(r => (
                      <button key={r.rifa_id} onClick={() => { setRifaSel(r); setNumerosExtra([]); }} style={{
                        flex:1, minWidth:140, padding:'10px 12px', textAlign:'left',
                        background: rifaSel?.rifa_id===r.rifa_id ? 'rgba(10,191,188,0.10)' : 'var(--jordyn-bg2)',
                        border:`2px solid ${rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
                        borderRadius:10, cursor:'pointer', transition:'all .15s',
                      }}>
                        <div style={{ fontWeight:800, fontSize:'0.88rem', color: rifaSel?.rifa_id===r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-text)' }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>{fmtCOP(r.precio)}{r.veces_vendido===1&&<span style={{ color:'var(--jordyn-gold)', marginLeft:6 }}>· ya tiene 1 venta</span>}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Datos del comprador */}
              <div style={{ display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-start', marginBottom:16 }}>
                <div style={{ flex:'1 1 200px', minWidth:0 }}>
                  <div style={{ marginBottom:12 }}>
                    <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                    <input className="jd-input" placeholder="Nombre completo"
                      value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))} autoFocus />
                  </div>
                  <div>
                    <label className="jd-label">TELÉFONO (opcional)</label>
                    <input className="jd-input" placeholder="+58..." type="tel"
                      value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono:e.target.value }))} />
                  </div>
                </div>

                {/* Preview ticket */}
                {rifaSel && (
                  <div style={{ flex:'0 0 auto', display:'flex', justifyContent:'center' }}>
                    <TicketPreview
                      r={rifaSel}
                      numero={todosVenta.join(' · ')}
                      comprador={form}
                      vendedor={user?.nombre}
                      size="small"
                    />
                  </div>
                )}
              </div>

              {/* ── Agregar más números (multi-número) ── */}
              {rifaSel && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>
                    <i className="bi bi-plus-circle me-1" style={{ color:'var(--jordyn-primary)' }}></i>
                    AGREGAR MÁS NÚMEROS (opcional)
                  </div>
                  <p style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginBottom:10 }}>
                    Selecciona números adicionales para registrar en una sola transacción.
                  </p>

                  {/* Números ya en la transacción */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                    <span style={{ background:'var(--jordyn-primary)', color:'#fff', borderRadius:8, padding:'4px 12px', fontWeight:900, fontSize:'.85rem', letterSpacing:2 }}>{numero} ✓</span>
                    {numerosExtra.map(n => (
                      <span key={n} style={{ background:'rgba(10,191,188,.15)', border:'1.5px solid rgba(10,191,188,.4)', color:'var(--jordyn-primary)', borderRadius:8, padding:'4px 10px', fontWeight:800, fontSize:'.85rem', letterSpacing:2, display:'flex', alignItems:'center', gap:5 }}>
                        {n}
                        <button onClick={() => toggleExtra(n)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--jordyn-primary)', fontSize:'.75rem', padding:0, lineHeight:1 }}>✕</button>
                      </span>
                    ))}
                  </div>

                  {/* Mini-grid de disponibles */}
                  {loadingExtra ? (
                    <div style={{ fontSize:'.75rem', color:'var(--jordyn-muted)' }}>Cargando números disponibles...</div>
                  ) : (
                    <div style={{ maxHeight:180, overflowY:'auto', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'8px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(48px,1fr))', gap:4 }}>
                        {disponiblesRifa.slice(0, 200).map(n => (
                          <div key={n.numero}
                            onClick={() => toggleExtra(n.numero)}
                            style={{
                              aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                              borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'.7rem',
                              transition:'all .1s', userSelect:'none',
                              background: numerosExtra.includes(n.numero) ? 'var(--jordyn-primary)' : '#fff',
                              border: `1.5px solid ${numerosExtra.includes(n.numero) ? 'var(--jordyn-primary)' : 'rgba(10,191,188,.25)'}`,
                              color: numerosExtra.includes(n.numero) ? '#fff' : 'var(--jordyn-text)',
                              transform: numerosExtra.includes(n.numero) ? 'scale(1.1)' : 'none',
                            }}>
                            {n.numero}
                          </div>
                        ))}
                        {disponiblesRifa.length === 0 && (
                          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:20, color:'var(--jordyn-muted)', fontSize:'.78rem' }}>
                            No hay más números disponibles
                          </div>
                        )}
                      </div>
                      {disponiblesRifa.length > 200 && (
                        <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', textAlign:'center', marginTop:6 }}>
                          Mostrando los primeros 200. Usa el buscador para encontrar números específicos.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Resumen */}
              {rifaSel && (
                <div style={{ background:'rgba(10,191,188,0.07)', border:'1.5px solid rgba(10,191,188,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', marginBottom:4 }}>RESUMEN DE VENTA</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <span style={{ fontWeight:800, fontSize:'1.05rem', color:'var(--jordyn-primary)' }}>
                        {todosVenta.length > 1
                          ? `${todosVenta.length} números: ${todosVenta.join(', ')}`
                          : `#${numero}`} — {rifaSel.rifa_nombre}
                      </span>
                    </div>
                    <span style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-green)' }}>{totalVenta}</span>
                  </div>
                </div>
              )}

              <button className="btn-jordyn w-100" onClick={handleVender} disabled={selling || !rifaSel} style={{ fontSize:'0.95rem', padding:'.72rem' }}>
                {selling
                  ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2 }}></span> Registrando...</>
                  : <><i className="bi bi-check2-circle me-2"></i>
                    {todosVenta.length > 1 ? `VENDER ${todosVenta.length} NÚMEROS` : 'CONFIRMAR VENTA'}</>
                }
              </button>
            </div>
          )}

          {/* ── TAB: BOLETO ── */}
          {tab === 'ticket' && rifaSel && (
            <div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
                <TicketPreview
                  r={rifaSel}
                  numero={todosVenta.join(' · ')}
                  comprador={form}
                  vendedor={user?.nombre}
                />
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button className="btn-jordyn" onClick={handlePrint} style={{ fontSize:'0.88rem', padding:'.68rem 1.8rem' }}>
                  <i className="bi bi-printer-fill me-2"></i>IMPRIMIR (2 COPIAS)
                </button>
                <button className="btn-jordyn-outline" onClick={() => setRifaSel(null)}>
                  <i className="bi bi-arrow-left me-1"></i>Cambiar rifa
                </button>
                <button className="btn-jordyn-outline" onClick={onClose}>
                  <i className="bi bi-x-lg me-1"></i>Cerrar
                </button>
              </div>
            </div>
          )}
          {tab === 'ticket' && !rifaSel && rifas.filter(r => r.veces_vendido > 0).length > 0 && (
            <div>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>¿DE QUÉ RIFA IMPRIMIR EL BOLETO?</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {rifas.filter(r => r.veces_vendido > 0).map(r => (
                  <button key={r.rifa_id} onClick={() => setRifaSel(r)}
                    style={{ flex:1, minWidth:'140px', padding:'10px 12px', textAlign:'left', background:'var(--jordyn-bg2)', border:'2px solid var(--jordyn-border)', borderRadius:10, cursor:'pointer', transition:'all .15s', fontWeight:700 }}>
                    <div style={{ color:'var(--jordyn-text)', fontSize:'0.88rem' }}>{r.rifa_nombre}</div>
                    <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:2 }}>{r.veces_vendido} venta(s)</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}