// ============================================================
//  ArchivoComprobantes.jsx — Archivo de comprobantes de pago
//  Todos los comprobantes recibidos (página y WhatsApp, pagos completos y
//  abonos) de los últimos 30 días o más, con los datos leídos por la IA y
//  aviso cuando una referencia se repite.
// ============================================================
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import API from '../services/api';
import { DatosLeidos } from './LecturaComprobante';

const POR_PAGINA = 24;
const ESTADOS = {
  pendiente: ['Por aprobar', '#b37700'], aprobado: ['Aprobado', '#059669'], rechazado: ['Rechazado', '#e63946'],
  apartado: ['Apartado', '#7c3aed'], liberado: ['Liberado', '#6b7280'],
};
const fmtFecha = f => f ? new Date(f).toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/Caracas' }) : '';
const clave = c => `${c.tipo}-${c.id}`;

export default function ArchivoComprobantes() {
  const [lista, setLista]       = useState([]);
  const [puedeLeer, setPuede]   = useState(true);
  const [loading, setLoading]   = useState(true);
  const [dias, setDias]         = useState(30);
  const [q, setQ]               = useState('');
  const [soloRepetidos, setSoloRepetidos] = useState(false);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [leyendo, setLeyendo]   = useState({});     // clave → true
  const [todos, setTodos]       = useState(null);   // progreso de "leer los que faltan": { hechos, total }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get(`/comprobantes?dias=${dias}`);
      setLista(r.data.comprobantes || []); setPuede(r.data.puede_leer !== false);
    } catch { toast.error('No se pudo cargar el archivo de comprobantes'); }
    finally { setLoading(false); }
  }, [dias]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setVisibles(POR_PAGINA); }, [q, dias, soloRepetidos]);

  const leido = c => !!c.datos && (c.datos.leido_en || c.datos.es_comprobante !== undefined);
  const leer = async (c, forzar = false) => {
    setLeyendo(p => ({ ...p, [clave(c)]: true }));
    try {
      const r = await API.post('/comprobantes/leer', { tipo: c.tipo, id: c.id, forzar });
      setLista(l => l.map(x => clave(x) === clave(c) ? { ...x, datos: r.data.datos, repetido: x.repetido || (r.data.repetidos || []).length > 0 } : x));
      return r.data;
    } catch (e) { return { aviso: e.response?.data?.error || 'No se pudo leer' }; }
    finally { setLeyendo(p => ({ ...p, [clave(c)]: false })); }
  };
  const leerUno = async (c, forzar) => {
    const r = await leer(c, forzar);
    if (r.aviso) toast.error(r.aviso); else toast.success('Datos del comprobante leídos');
  };
  const leerFaltantes = async () => {
    const faltan = lista.filter(c => c.url && !leido(c));
    if (!faltan.length) return;
    setTodos({ hechos: 0, total: faltan.length });
    let fallos = 0;
    for (let i = 0; i < faltan.length; i++) {
      const r = await leer(faltan[i]);
      if (r.aviso) { fallos++; if (fallos >= 3 && fallos === i + 1) { toast.error(r.aviso); break; } }
      setTodos({ hechos: i + 1, total: faltan.length });
    }
    setTodos(null);
    load();
  };

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lista.filter(c => (!soloRepetidos || c.repetido) && (!t || [c.nombre, c.telefono, c.rifa, c.datos?.referencia, c.datos?.banco, c.datos?.titular, c.metodo, (c.numeros || []).join(' ')]
      .some(v => String(v || '').toLowerCase().includes(t))));
  }, [lista, q, soloRepetidos]);
  const sinLeer = lista.filter(c => c.url && !leido(c)).length;
  const nRepetidos = lista.filter(c => c.repetido).length;

  return (
    <div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:'1rem' }}>
        <div style={{ position:'relative', flex:'1 1 240px', maxWidth:380 }}>
          <i className="bi bi-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--jordyn-muted)', fontSize:'.85rem' }}></i>
          <input className="jd-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por referencia, nombre, teléfono, número…" style={{ paddingLeft:34 }} aria-label="Buscar comprobante" />
        </div>
        <select className="jd-input" value={dias} onChange={e => setDias(Number(e.target.value))} style={{ width:'auto' }} aria-label="Periodo">
          <option value={30}>Últimos 30 días</option>
          <option value={60}>Últimos 60 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={365}>Último año</option>
        </select>
        {nRepetidos > 0 && (
          <button type="button" onClick={() => setSoloRepetidos(v => !v)} aria-pressed={soloRepetidos}
            style={{ border:'1.5px solid rgba(230,57,70,.45)', background: soloRepetidos ? '#e63946' : 'rgba(230,57,70,.08)', color: soloRepetidos ? '#fff' : '#c62e3a', borderRadius:10, padding:'7px 12px', fontSize:'.78rem', fontWeight:700, cursor:'pointer' }}>
            <i className="bi bi-exclamation-triangle-fill me-1"></i>{nRepetidos} con referencia repetida
          </button>
        )}
        {puedeLeer && sinLeer > 0 && (
          <button type="button" className="btn-jordyn-outline" onClick={leerFaltantes} disabled={!!todos} style={{ fontSize:'.78rem' }}>
            {todos ? <>Leyendo {todos.hechos} de {todos.total}…</> : <><i className="bi bi-stars me-1"></i>Leer los {sinLeer} que faltan</>}
          </button>
        )}
      </div>

      {!puedeLeer && (
        <div className="jd-alert jd-alert-warning" style={{ marginBottom:'1rem', fontSize:'.8rem' }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>La IA que conversa con los clientes no lee imágenes. Para sacar los datos de los comprobantes guarda una API key de Groq o de Google Gemini (gratis) en WhatsApp → Bot: se usa solo para leer las fotos.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="jd-spinner" style={{ width:44, height:44 }}></div></div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3.5rem 1rem', color:'var(--jordyn-muted)' }}>
          <div style={{ fontSize:'2.6rem' }}>🧾</div>
          <div style={{ fontWeight:800, color:'var(--jordyn-text)', marginTop:6 }}>Sin comprobantes</div>
          <div style={{ fontSize:'.85rem' }}>{lista.length ? 'Ninguno coincide con la búsqueda' : 'No se recibieron comprobantes en este periodo'}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginBottom:10 }}>{filtrados.length} comprobante{filtrados.length === 1 ? '' : 's'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
            {filtrados.slice(0, visibles).map(c => {
              const [estado, color] = ESTADOS[c.estado] || [c.estado, 'var(--jordyn-muted)'];
              const ocupado = leyendo[clave(c)];
              return (
                <div key={clave(c)} className="jd-card" style={{ padding:'.8rem', display:'flex', gap:12, borderLeft:`3px solid ${c.repetido ? '#e63946' : color}` }}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" title="Abrir el comprobante" style={{ flexShrink:0 }}>
                      <img src={c.url} alt="Comprobante" loading="lazy" style={{ width:74, height:96, objectFit:'cover', borderRadius:10, border:'1.5px solid var(--jordyn-border2)', display:'block' }} />
                    </a>
                  ) : (
                    <div title="Comprobante antiguo: ábrelo desde la reserva" style={{ width:74, height:96, flexShrink:0, borderRadius:10, background:'var(--jordyn-bg2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--jordyn-muted)', fontSize:'1.4rem' }}>
                      <i className="bi bi-file-earmark-image"></i>
                    </div>
                  )}
                  <div style={{ minWidth:0, flex:1, fontSize:'.76rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:6, alignItems:'baseline' }}>
                      <b style={{ fontSize:'.86rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombre || 'Sin nombre'}</b>
                      <span style={{ color, fontWeight:800, fontSize:'.66rem', flexShrink:0 }}>{c.tipo === 'abono' ? `Abono · ${estado}` : estado}</span>
                    </div>
                    <div style={{ color:'var(--jordyn-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.rifa}{c.numeros?.length ? ` · n.º ${c.numeros.join(', ')}` : ''}</div>
                    <div style={{ color:'var(--jordyn-muted)', fontSize:'.68rem' }}>
                      {fmtFecha(c.fecha)}{c.metodo ? ` · ${c.metodo}` : ''} · {c.origen === 'whatsapp' ? 'WhatsApp' : c.origen === 'panel' ? 'panel' : 'página'}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6, fontSize:'.68rem', alignItems:'center' }}>
                      {ocupado ? <span style={{ color:'var(--jordyn-muted)' }}>leyendo…</span>
                        : leido(c) ? (c.datos.es_comprobante === false
                            ? <span style={{ color:'#c62e3a', fontWeight:700 }}>no parece un comprobante</span>
                            : <DatosLeidos datos={c.datos} />)
                        : c.url && puedeLeer ? (
                            <button type="button" onClick={() => leerUno(c)} style={{ border:'1px solid var(--jordyn-border)', background:'#fff', color:'var(--jordyn-primary)', borderRadius:20, padding:'2px 10px', fontWeight:700, cursor:'pointer', fontSize:'.68rem' }}>
                              <i className="bi bi-stars me-1"></i>Leer datos
                            </button>)
                        : <span style={{ color:'var(--jordyn-muted)' }}>sin leer</span>}
                    </div>
                    {c.repetido && <div style={{ color:'#c62e3a', fontWeight:800, fontSize:'.68rem', marginTop:5 }}><i className="bi bi-exclamation-triangle-fill me-1"></i>Referencia repetida en otro pago</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {visibles < filtrados.length && (
            <div style={{ textAlign:'center', marginTop:'1.1rem' }}>
              <button type="button" className="btn-jordyn-outline" onClick={() => setVisibles(v => v + POR_PAGINA)} style={{ fontSize:'.8rem' }}>
                Ver más ({filtrados.length - visibles} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
