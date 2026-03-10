import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const COP = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);

export default function GestionReservas() {
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('pendiente');
  const [selR,     setSelR]     = useState(null);
  const [nota,     setNota]     = useState('');
  const [saving,   setSaving]   = useState(false);

  const B = { fontFamily:"'Bebas Neue',cursive" };
  const M = { fontFamily:"'Share Tech Mono',monospace" };
  const O = { fontFamily:"'Oswald',sans-serif" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get(`/publico/admin/reservas${filtro !== 'todos' ? `?estado=${filtro}` : ''}`);
      setReservas(r.data);
    } catch { toast.error('Error cargando reservas'); }
    finally { setLoading(false); }
  }, [filtro]);

  useEffect(() => { load(); }, [load]);

  const handleAccion = async (estado) => {
    if (!selR) return;
    setSaving(true);
    try {
      await API.put(`/publico/admin/reservas/${selR.id}`, { estado, nota_admin: nota });
      toast.success(estado === 'aprobado' ? '✅ Reserva aprobada — venta registrada' : '❌ Reserva rechazada');
      setSelR(null);
      setNota('');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const estadoStyle = {
    pendiente: { bg:'rgba(245,197,24,.1)', c:'#f5c518', b:'rgba(245,197,24,.2)', label:'⏳ PENDIENTE' },
    aprobado:  { bg:'rgba(6,214,160,.1)',  c:'#06d6a0', b:'rgba(6,214,160,.2)',  label:'✅ APROBADO'  },
    rechazado: { bg:'rgba(230,57,70,.1)',  c:'#e63946', b:'rgba(230,57,70,.2)',  label:'❌ RECHAZADO' },
  };

  return (
    <Layout title="RESERVAS DE CLIENTES">

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {['pendiente','aprobado','rechazado','todos'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...M, fontSize:'.62rem', letterSpacing:'2px', padding:'6px 14px', borderRadius:5, cursor:'pointer', border:'1px solid',
            background: filtro===f ? 'rgba(245,197,24,.1)' : '#111',
            borderColor: filtro===f ? '#f5c518' : '#1e1e1e',
            color: filtro===f ? '#f5c518' : '#555',
          }}>
            {f.toUpperCase()}
          </button>
        ))}
        <div style={{ ...M, fontSize:'.62rem', color:'#444', marginLeft:'auto', alignSelf:'center' }}>
          {reservas.length} resultado(s)
        </div>
      </div>

      {/* Modal detalle */}
      {selR && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setSelR(null)}>
          <div style={{ background:'#111', border:'1px solid #222', borderRadius:12, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ ...B, fontSize:'1.3rem', color:'#f5c518', letterSpacing:'3px' }}>RESERVA #{selR.id?.slice(0,8).toUpperCase()}</div>
              <button onClick={()=>setSelR(null)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { l:'NÚMERO',   v: selR.numero,         big:true  },
                { l:'ESTADO',   v: selR.estado.toUpperCase() },
                { l:'CLIENTE',  v: selR.nombre_cliente        },
                { l:'TELÉFONO', v: selR.telefono || '—'       },
                { l:'RIFA',     v: selR.rifa_nombre           },
                { l:'VALOR',    v: COP(selR.precio)           },
                { l:'MÉTODO',   v: selR.metodo_pago || '—'   },
                { l:'FECHA',    v: new Date(selR.created_at).toLocaleString('es-CO') },
              ].map(({l,v,big}) => (
                <div key={l} style={{ background:'#0d0d0d', borderRadius:7, padding:'10px 12px' }}>
                  <div style={{ ...M, fontSize:'.48rem', color:'#666', letterSpacing:'2px', marginBottom:3 }}>{l}</div>
                  <div style={{ ...O, fontSize: big ? '2rem' : '.88rem', color: big ? '#f5c518' : '#e0e0e0', fontWeight:600, lineHeight:1 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Comprobante */}
            {selR.comprobante_base64 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ ...M, fontSize:'.55rem', color:'#666', letterSpacing:'3px', marginBottom:8 }}>COMPROBANTE DE PAGO</div>
                <img src={selR.comprobante_base64} alt="Comprobante" style={{ width:'100%', maxHeight:350, objectFit:'contain', borderRadius:8, border:'1px solid #222' }} />
              </div>
            )}

            {/* Nota admin */}
            {selR.estado === 'pendiente' && (
              <>
                <div style={{ marginBottom:16 }}>
                  <div style={{ ...M, fontSize:'.55rem', color:'#666', letterSpacing:'2px', marginBottom:6 }}>NOTA PARA EL CLIENTE (opcional)</div>
                  <textarea value={nota} onChange={e=>setNota(e.target.value)}
                    style={{ width:'100%', background:'#0d0d0d', border:'1px solid #222', borderRadius:8, color:'#e0e0e0', padding:'10px 12px', ...O, fontSize:'.88rem', resize:'vertical', minHeight:70, outline:'none' }}
                    placeholder="Ej: Pago confirmado, número asignado..." />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={()=>handleAccion('rechazado')} disabled={saving} style={{ flex:1, background:'rgba(230,57,70,.1)', border:'1px solid rgba(230,57,70,.25)', color:'#e63946', borderRadius:7, padding:'10px', cursor:'pointer', ...B, fontSize:'.85rem', letterSpacing:'2px' }}>
                    ❌ RECHAZAR
                  </button>
                  <button onClick={()=>handleAccion('aprobado')} disabled={saving} style={{ flex:2, background:'linear-gradient(135deg,#06d6a0,#00b89c)', border:'none', color:'#fff', borderRadius:7, padding:'10px', cursor:'pointer', ...B, fontSize:'.9rem', letterSpacing:'2px' }}>
                    {saving ? '...' : '✅ APROBAR Y REGISTRAR VENTA'}
                  </button>
                </div>
              </>
            )}
            {selR.estado !== 'pendiente' && selR.nota_admin && (
              <div style={{ background:'#0d0d0d', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ ...M, fontSize:'.5rem', color:'#666', marginBottom:4 }}>NOTA ADMIN</div>
                <div style={{ ...O, fontSize:'.88rem', color:'#ccc' }}>{selR.nota_admin}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="jd-spinner"></div></div>
      ) : reservas.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#333' }}>
          <div style={{ ...B, fontSize:'2rem', color:'#1e1e1e', letterSpacing:'3px', marginBottom:8 }}>SIN RESERVAS</div>
          <div style={{ ...M, fontSize:'.62rem', color:'#444' }}>No hay reservas con el filtro seleccionado</div>
        </div>
      ) : (
        <div style={{ overflowX:'auto', background:'#0d0d0d', border:'1px solid #1a1a1a', borderRadius:8 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', ...M, fontSize:'.62rem' }}>
            <thead>
              <tr style={{ background:'#111' }}>
                {['ESTADO','NÚMERO','CLIENTE','TELÉFONO','RIFA','VALOR','MÉTODO','FECHA',''].map(h => (
                  <th key={h} style={{ color:'#555', letterSpacing:'2px', padding:'8px 12px', textAlign:'left', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservas.map(r => {
                const est = estadoStyle[r.estado] || estadoStyle.pendiente;
                return (
                  <tr key={r.id} style={{ borderBottom:'1px solid #111', cursor:'pointer' }}
                    onClick={() => { setSelR(r); setNota(r.nota_admin||''); }}
                    onMouseEnter={e=>e.currentTarget.style.background='#111'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'8px 12px' }}>
                      <span style={{ background:est.bg, color:est.c, border:`1px solid ${est.b}`, padding:'2px 7px', borderRadius:3, fontSize:'.55rem', letterSpacing:'2px' }}>{est.label}</span>
                    </td>
                    <td style={{ padding:'8px 12px', color:'#f5c518', ...O, fontWeight:700, fontSize:'1.1rem' }}>{r.numero}</td>
                    <td style={{ padding:'8px 12px', color:'#e0e0e0', ...O, fontWeight:600 }}>{r.nombre_cliente}</td>
                    <td style={{ padding:'8px 12px', color:'#888' }}>{r.telefono || '—'}</td>
                    <td style={{ padding:'8px 12px', color:'#888' }}>{r.rifa_nombre}</td>
                    <td style={{ padding:'8px 12px', color:'#fff' }}>{COP(r.precio)}</td>
                    <td style={{ padding:'8px 12px', color:'#888' }}>{r.metodo_pago || '—'}</td>
                    <td style={{ padding:'8px 12px', color:'#555' }}>{new Date(r.created_at).toLocaleDateString('es-CO')}</td>
                    <td style={{ padding:'8px 12px' }}>
                      {r.comprobante_base64 && <span style={{ color:'#06d6a0' }}>📎</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}