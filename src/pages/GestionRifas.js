import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

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
   MODAL: Vendedores de una rifa (asignación de números fijos)
═══════════════════════════════════════════════════ */
function ModalVendedoresRifa({ rifa, onClose }) {
  const [vendedores,   setVendedores]   = useState([]);   // todos los vendedores del sistema
  const [asignaciones, setAsignaciones] = useState({});   // { vendedor_id: [numeros...] }
  const [selVendedor,  setSelVendedor]  = useState(null); // vendedor con panel expandido
  const [loading,      setLoading]      = useState(true);
  const [savingId,     setSavingId]     = useState(null);

  // Tabs de entrada por vendedor
  const [tab,        setTab]        = useState('manual');
  const [numInput,   setNumInput]   = useState('');
  const [rangoIni,   setRangoIni]   = useState('');
  const [rangoFin,   setRangoFin]   = useState('');
  const [cantidad,   setCantidad]   = useState(10);
  const [loadingAl,  setLoadingAl]  = useState(false);

  /* ── Cargar vendedores + sus asignaciones en esta rifa ── */
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resVend, resAll] = await Promise.all([
        API.get('/vendedores'),
        API.get(`/vendedores`),
      ]);
      const vends = resVend.data.filter(v => v.activo);
      setVendedores(vends);

      // Para cada vendedor, traer sus números en esta rifa
      const mapa = {};
      await Promise.all(vends.map(async (v) => {
        try {
          const r = await API.get(`/vendedores/${v.id}`);
          const nums = (r.data.numeros_asignados || [])
            .filter(n => n.rifa_id === rifa.id)
            .map(n => n.numero);
          mapa[v.id] = nums.sort();
        } catch { mapa[v.id] = []; }
      }));
      setAsignaciones(mapa);
    } catch { toast.error('Error cargando vendedores'); }
    finally { setLoading(false); }
  }, [rifa.id]);

  useEffect(() => { cargar(); }, [cargar]);

  /* ── Helpers ── */
  const numerosAsignadosTotal = Object.values(asignaciones).flat();

  const agregarNums = async (vendedorId, nums) => {
    const validos = nums.filter(n => /^\d{3}$/.test(n) && !(asignaciones[vendedorId] || []).includes(n));
    if (!validos.length) { toast.warning('Números inválidos o ya asignados a este vendedor'); return; }
    setSavingId(vendedorId);
    try {
      await API.post('/numeros/asignar', { vendedor_id: vendedorId, rifa_id: rifa.id, numeros: validos });
      setAsignaciones(p => ({ ...p, [vendedorId]: [...new Set([...(p[vendedorId]||[]), ...validos])].sort() }));
      toast.success(`✅ ${validos.length} número(s) asignados`);
      setNumInput(''); setRangoIni(''); setRangoFin('');
    } catch (err) { toast.error(err.response?.data?.error || 'Error asignando'); }
    finally { setSavingId(null); }
  };

  const quitarNum = async (vendedorId, num) => {
    try {
      await API.delete('/numeros/asignar', { data: { vendedor_id: vendedorId, rifa_id: rifa.id, numeros: [num] } });
      setAsignaciones(p => ({ ...p, [vendedorId]: (p[vendedorId]||[]).filter(n => n !== num) }));
    } catch { toast.error('Error removiendo número'); }
  };

  const quitarTodos = async (vendedorId) => {
    const nums = asignaciones[vendedorId] || [];
    if (!nums.length || !window.confirm(`¿Quitar todos los números de este vendedor en "${rifa.nombre}"?`)) return;
    try {
      await API.delete('/numeros/asignar', { data: { vendedor_id: vendedorId, rifa_id: rifa.id, numeros: nums } });
      setAsignaciones(p => ({ ...p, [vendedorId]: [] }));
      toast.info('Números removidos');
    } catch { toast.error('Error'); }
  };

  const agregarAleatorios = async (vendedorId) => {
    setLoadingAl(true);
    try {
      const res = await API.get(`/vendedores/${vendedorId}/numeros-aleatorios`, {
        params: { rifa_id: rifa.id, cantidad }
      });
      const nums = res.data.numeros_sugeridos || [];
      if (!nums.length) { toast.warning('No hay más números disponibles'); return; }
      await API.post('/numeros/asignar', { vendedor_id: vendedorId, rifa_id: rifa.id, numeros: nums });
      setAsignaciones(p => ({ ...p, [vendedorId]: [...new Set([...(p[vendedorId]||[]), ...nums])].sort() }));
      toast.success(`✅ ${nums.length} números aleatorios asignados`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoadingAl(false); }
  };

  const agregarRango = (vendedorId) => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) {
      toast.error('Rango inválido (0–999)'); return;
    }
    const nums = [];
    for (let i = ini; i <= fin; i++) nums.push(String(i).padStart(3, '0'));
    agregarNums(vendedorId, nums);
  };

  const imprimirNums = (vendedor, nums) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Números — ${vendedor.nombre}</title>
      <style>
        body{font-family:sans-serif;padding:20px;color:#1a2e2e}
        h2{color:#0abfbc;margin-bottom:4px} p{font-size:12px;color:#6b9090;margin-bottom:14px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:5px}
        .num{aspect-ratio:1;display:flex;align-items:center;justify-content:center;
             font-weight:700;font-size:11px;border:1.5px solid #0abfbc;border-radius:6px;
             color:#0abfbc;background:rgba(10,191,188,0.06)}
        .footer{margin-top:18px;font-size:10px;color:#aaa;border-top:1px dashed #ddd;padding-top:8px}
      </style></head><body>
      <h2>🎰  RESUELVE TU SEMANA — Números asignados</h2>
      <p>Vendedor: <b>${vendedor.nombre}</b> · Rifa: <b>${rifa.nombre}</b> · Total: <b>${nums.length}</b></p>
      <div class="grid">${nums.map(n=>`<div class="num">${n}</div>`).join('')}</div>
      <div class="footer">Impreso ${new Date().toLocaleString('es-CO')} · Sistema RESUELVE TU SEMANA</div>
      </body></html>`;
    const win = window.open('', '_blank', 'width=700,height=600');
    win.document.write(html); win.document.close();
    win.onload = () => win.print();
  };

  /* ── Colores badge vendedor ── */
  const COLORS = ['#0abfbc','#f0a500','#06d6a0','#118ab2','#e63946','#9b5de5','#ff6b6b','#3a7d44'];
  const colorFor = (idx) => COLORS[idx % COLORS.length];

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,0.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
    >
      <div style={{ width:'100%', maxWidth:820, maxHeight:'92vh', background:'#fff', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(10,191,188,0.25)' }}>

        {/* ─── Header ─── */}
        <div style={{ background:'linear-gradient(135deg,var(--jordyn-primary),#00d4d0)', color:'#fff', padding:'1.1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'1.05rem' }}>👥 VENDEDORES — {rifa.nombre}</div>
            <div style={{ fontSize:'0.72rem', opacity:0.85, marginTop:2 }}>
              {numerosAsignadosTotal.length} números asignados · {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'1rem' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* ─── Info banner ─── */}
        <div style={{ background:'rgba(240,165,0,0.08)', borderBottom:'1px solid rgba(240,165,0,0.25)', padding:'0.65rem 1.5rem', fontSize:'0.75rem', color:'#7a6000', fontWeight:600, flexShrink:0 }}>
          <i className="bi bi-info-circle-fill me-2"></i>
          Los números asignados a vendedores <strong>NO aparecen en la tienda pública</strong> ni pueden ser vendidos por el administrador. Solo el vendedor asignado los vende.
        </div>

        {/* ─── Contenido ─── */}
        <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
              <div className="jd-spinner" style={{ width:40, height:40 }}></div>
            </div>
          ) : vendedores.length === 0 ? (
            <div className="jd-alert jd-alert-warning">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              No hay vendedores activos. Crea vendedores en la sección "Vendedores".
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {vendedores.map((v, idx) => {
                const numsV   = asignaciones[v.id] || [];
                const abierto = selVendedor === v.id;
                const color   = colorFor(idx);

                return (
                  <div key={v.id} style={{ border:`1.5px solid ${abierto ? color : 'var(--jordyn-border)'}`, borderRadius:12, overflow:'hidden', transition:'border-color .2s' }}>

                    {/* Cabecera del vendedor */}
                    <div
                      onClick={() => setSelVendedor(abierto ? null : v.id)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'0.85rem 1.1rem', cursor:'pointer', background: abierto ? `${color}0d` : '#fff', transition:'background .2s' }}
                    >
                      {/* Avatar */}
                      <div style={{ width:38, height:38, borderRadius:'50%', background:`${color}22`, border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.85rem', fontWeight:800, color }}>
                        {v.nombre.charAt(0).toUpperCase()}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--jordyn-text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre}</div>
                        <div style={{ fontSize:'0.68rem', color:'var(--jordyn-muted)' }}>@{v.usuario}</div>
                      </div>

                      {/* Badge conteo */}
                      <div style={{ background: numsV.length ? `${color}18` : 'var(--jordyn-bg2)', border:`1px solid ${numsV.length ? color+'44' : 'var(--jordyn-border)'}`, borderRadius:20, padding:'3px 12px', fontSize:'0.72rem', fontWeight:700, color: numsV.length ? color : 'var(--jordyn-muted)', flexShrink:0 }}>
                        {numsV.length} números
                      </div>

                      <i className={`bi bi-chevron-${abierto ? 'up' : 'down'}`} style={{ color:'var(--jordyn-muted)', fontSize:'0.8rem', flexShrink:0 }}></i>
                    </div>

                    {/* Panel expandido */}
                    {abierto && (
                      <div style={{ borderTop:`1px solid ${color}22`, background:'#fafefe', padding:'1rem 1.1rem' }}>

                        {/* Tabs de entrada */}
                        <div style={{ display:'flex', gap:6, marginBottom:'0.85rem', flexWrap:'wrap' }}>
                          {['manual','rango','aleatorio'].map(t => (
                            <button key={t} onClick={() => setTab(t)} style={{
                              background: tab === t ? color : '#fff',
                              color: tab === t ? '#fff' : 'var(--jordyn-muted)',
                              border:`1.5px solid ${tab === t ? color : 'var(--jordyn-border)'}`,
                              borderRadius:20, padding:'3px 14px', fontSize:'0.72rem', fontWeight:700, cursor:'pointer'
                            }}>
                              {t === 'manual' ? '✏️ Manual' : t === 'rango' ? '📐 Rango' : '🎲 Aleatorio'}
                            </button>
                          ))}
                        </div>

                        {/* Entrada manual */}
                        {tab === 'manual' && (
                          <div style={{ display:'flex', gap:8, marginBottom:'0.75rem', flexWrap:'wrap' }}>
                            <input
                              className="jd-input"
                              value={numInput}
                              onChange={e => setNumInput(e.target.value.replace(/\D/g,'').slice(0,3))}
                              onKeyDown={e => e.key === 'Enter' && agregarNums(v.id, [numInput.padStart(3,'0')])}
                              placeholder="ej: 007"
                              maxLength={3}
                              style={{ width:110, textAlign:'center', fontWeight:700, fontSize:'1rem' }}
                            />
                            <button className="btn-jordyn" onClick={() => agregarNums(v.id, [numInput.padStart(3,'0')])} disabled={savingId === v.id} style={{ fontSize:'0.8rem', padding:'6px 16px', background:color, border:'none' }}>
                              <i className="bi bi-plus-lg me-1"></i>Agregar
                            </button>
                          </div>
                        )}

                        {/* Rango */}
                        {tab === 'rango' && (
                          <div style={{ display:'flex', gap:8, marginBottom:'0.75rem', flexWrap:'wrap', alignItems:'center' }}>
                            <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value.replace(/\D/g,''))} placeholder="Desde (ej: 0)" style={{ width:110 }} maxLength={3} />
                            <span style={{ color:'var(--jordyn-muted)', fontWeight:700 }}>→</span>
                            <input className="jd-input" value={rangoFin} onChange={e => setRangoFin(e.target.value.replace(/\D/g,''))} placeholder="Hasta (ej: 99)" style={{ width:110 }} maxLength={3} />
                            <button className="btn-jordyn" onClick={() => agregarRango(v.id)} disabled={savingId === v.id} style={{ fontSize:'0.8rem', padding:'6px 16px', background:color, border:'none' }}>
                              <i className="bi bi-plus-lg me-1"></i>Agregar rango
                            </button>
                          </div>
                        )}

                        {/* Aleatorio */}
                        {tab === 'aleatorio' && (
                          <div style={{ display:'flex', gap:8, marginBottom:'0.75rem', flexWrap:'wrap', alignItems:'center' }}>
                            <input className="jd-input" type="number" min={1} max={200} value={cantidad} onChange={e => setCantidad(Math.min(200,Math.max(1,parseInt(e.target.value)||1)))} style={{ width:90 }} />
                            <span style={{ fontSize:'0.8rem', color:'var(--jordyn-muted)' }}>cantidad</span>
                            <button className="btn-jordyn" onClick={() => agregarAleatorios(v.id)} disabled={loadingAl || savingId === v.id} style={{ fontSize:'0.8rem', padding:'6px 16px', background:color, border:'none' }}>
                              {loadingAl
                                ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Generando...</>
                                : <><i className="bi bi-shuffle me-1"></i>Asignar aleatorios</>
                              }
                            </button>
                          </div>
                        )}

                        {/* Grid de números asignados */}
                        {numsV.length > 0 ? (
                          <>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                              <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--jordyn-muted)' }}>
                                {numsV.length} número{numsV.length !== 1 ? 's' : ''} asignado{numsV.length !== 1 ? 's' : ''}
                              </span>
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => imprimirNums(v, numsV)} style={{ background:'none', border:`1px solid ${color}`, color, borderRadius:6, padding:'2px 10px', fontSize:'0.7rem', fontWeight:700, cursor:'pointer' }}>
                                  <i className="bi bi-printer me-1"></i>Imprimir
                                </button>
                                <button onClick={() => quitarTodos(v.id)} style={{ background:'none', border:'1px solid rgba(230,57,70,0.4)', color:'var(--jordyn-red)', borderRadius:6, padding:'2px 10px', fontSize:'0.7rem', fontWeight:700, cursor:'pointer' }}>
                                  <i className="bi bi-trash3 me-1"></i>Quitar todos
                                </button>
                              </div>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(48px,1fr))', gap:4, maxHeight:220, overflowY:'auto', padding:4, background:'#fff', borderRadius:8, border:'1px solid var(--jordyn-border)' }}>
                              {numsV.map(n => (
                                <div key={n} onClick={() => quitarNum(v.id, n)} title={`Quitar ${n}`} style={{
                                  aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                                  borderRadius:6, fontSize:'0.68rem', fontWeight:700, cursor:'pointer',
                                  background:`${color}14`, color, border:`1.5px solid ${color}44`,
                                  position:'relative', transition:'background .15s',
                                }}
                                  onMouseEnter={e => { e.currentTarget.style.background='rgba(230,57,70,0.12)'; e.currentTarget.style.borderColor='rgba(230,57,70,0.5)'; e.currentTarget.style.color='#e63946'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background=`${color}14`; e.currentTarget.style.borderColor=`${color}44`; e.currentTarget.style.color=color; }}
                                >
                                  {n}
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize:'0.62rem', color:'var(--jordyn-muted)', marginTop:5 }}>
                              💡 Haz clic en un número para quitarlo
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign:'center', padding:'1.5rem', background:'rgba(10,191,188,0.04)', borderRadius:10, border:'1px dashed var(--jordyn-border)', color:'var(--jordyn-muted)', fontSize:'0.82rem' }}>
                            Sin números asignados. Usa las opciones de arriba para agregar.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div style={{ borderTop:'1px solid var(--jordyn-border)', padding:'0.85rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--jordyn-bg2)', flexShrink:0 }}>
          <div style={{ fontSize:'0.75rem', color:'var(--jordyn-muted)' }}>
            <i className="bi bi-lock-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
            <strong>{numerosAsignadosTotal.length}</strong> números bloqueados para venta pública
          </div>
          <button className="btn-jordyn-outline" onClick={onClose} style={{ fontSize:'0.82rem' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Números disponibles de una rifa
═══════════════════════════════════════════════════ */
function ModalNumeros({ rifa, onClose }) {
  const [numeros, setNumeros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState('disponible');

  useEffect(() => {
    API.get(`/publico/rifas/${rifa.id}/numeros-disponibles`)
      .then(r => setNumeros(r.data))
      .catch(() => toast.error('Error cargando números'))
      .finally(() => setLoading(false));
  }, [rifa.id]);

  const filtrados = numeros.filter(n => filtro === 'todos' || n.estado === filtro);
  const conteo = {
    disponible: numeros.filter(n => n.estado === 'disponible').length,
    vendido_1:  numeros.filter(n => n.estado === 'vendido_1').length,
    agotado:    numeros.filter(n => n.estado === 'agotado').length,
    reservado:  numeros.filter(n => n.estado === 'reservado').length,
  };

  const colorEstado = {
    disponible: '#059669',
    vendido_1:  '#b37700',
    agotado:    '#e63946',
    reservado:  '#118ab2',
  };
  const bgEstado = {
    disponible: 'rgba(6,214,160,0.10)',
    vendido_1:  'rgba(240,165,0,0.12)',
    agotado:    'rgba(230,57,70,0.13)',
    reservado:  'rgba(17,138,178,0.10)',
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
    >
      <div style={{ width:'100%', maxWidth:720, maxHeight:'90vh', background:'#fff', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(10,191,188,0.2)' }}>
        {/* Header */}
        <div style={{ background:'var(--jordyn-primary)', color:'#fff', padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem' }}>NÚMEROS — {rifa.nombre}</div>
            <div style={{ fontSize:'0.72rem', opacity:0.85, marginTop:2 }}>{conteo.disponible} disponibles de 1000</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'1rem' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Filtros */}
        <div style={{ padding:'0.75rem 1.5rem', borderBottom:'1px solid var(--jordyn-border)', display:'flex', gap:'8px', flexWrap:'wrap', flexShrink:0, background:'var(--jordyn-bg2)' }}>
          {[
            { key:'todos',      label:'Todos',       count: numeros.length },
            { key:'disponible', label:'Disponibles', count: conteo.disponible },
            { key:'vendido_1',  label:'1 venta',     count: conteo.vendido_1  },
            { key:'agotado',    label:'Agotados',    count: conteo.agotado    },
            { key:'reservado',  label:'Reservados',  count: conteo.reservado  },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{
              background: filtro === f.key ? 'var(--jordyn-primary)' : '#fff',
              color: filtro === f.key ? '#fff' : 'var(--jordyn-muted)',
              border: `1.5px solid ${filtro === f.key ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
              borderRadius:20, padding:'3px 12px', fontSize:'0.72rem', fontWeight:600,
              cursor:'pointer', display:'flex', gap:5, alignItems:'center',
            }}>
              {f.label} <span style={{ opacity:0.7 }}>({f.count})</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.5rem' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
              <div className="jd-spinner" style={{ width:40, height:40 }}></div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(52px,1fr))', gap:4 }}>
              {filtrados.map(n => (
                <div key={n.numero} style={{
                  aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:6, fontSize:'0.68rem', fontWeight:700,
                  background: bgEstado[n.estado] || 'rgba(10,191,188,0.06)',
                  color: colorEstado[n.estado] || 'var(--jordyn-muted)',
                  border: `1.5px solid ${colorEstado[n.estado] || 'var(--jordyn-border)'}20`,
                }}>
                  {n.numero}
                </div>
              ))}
              {filtrados.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'2rem', color:'var(--jordyn-muted)', fontSize:'0.85rem' }}>
                  Sin números en este estado
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
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════ */
export default function GestionRifas() {
  const [rifas,          setRifas]          = useState([]);
  const [rifasArchivadas,setRifasArchivadas] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [form,           setForm]           = useState(emptyForm);
  const [editId,         setEditId]         = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [modalNums,      setModalNums]      = useState(null); // rifa para modal números
  const [modalVendedores,setModalVendedores]= useState(null); // rifa para modal vendedores
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

          <button
            onClick={() => setModalVendedores(r)}
            style={{ background:'rgba(17,138,178,0.08)', border:'1.5px solid rgba(17,138,178,0.3)', color:'#118ab2', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
          >
            <i className="bi bi-people-fill"></i> Vendedores
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
          Máximo 2 rifas activas simultáneas — {rifasActivas.length}/2 activas
        </p>
        <button className="btn-jordyn" onClick={handleNueva} disabled={rifasActivas.length >= 2}>
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
        <ModalNumeros rifa={modalNums} onClose={() => setModalNums(null)} />
      )}

      {/* ═══ MODAL VENDEDORES POR RIFA ═══ */}
      {modalVendedores && (
        <ModalVendedoresRifa rifa={modalVendedores} onClose={() => setModalVendedores(null)} />
      )}
    </Layout>
  );
}