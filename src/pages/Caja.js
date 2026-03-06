import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
const COP = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

const ESTADO_CFG = {
  pagado:    { icon: '✅', label: 'PAGADO',    bg: 'rgba(6,214,160,.12)',   color: '#06d6a0', border: '#06d6a044' },
  parcial:   { icon: '⚠️', label: 'PARCIAL',   bg: 'rgba(255,209,102,.1)',  color: '#ffd166', border: '#ffd16644' },
  pendiente: { icon: '🔴', label: 'PENDIENTE', bg: 'rgba(230,57,70,.1)',    color: '#e63946', border: '#e6394644' },
};

/* ═══════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════ */
export default function Caja() {
  const [semanas,    setSemanas]    = useState([]);
  const [semanaAct,  setSemanaAct]  = useState(null);   // semana seleccionada
  const [detalle,    setDetalle]    = useState(null);   // { ...semana, lotes: [] }
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [loadDet,    setLoadDet]    = useState(false);

  // Modales / panels
  const [modalSemana,  setModalSemana]  = useState(false);
  const [modalLote,    setModalLote]    = useState(null);  // null | 'nuevo' | loteObj
  const [modalAbono,   setModalAbono]   = useState(null);  // null | loteObj
  const [modalHistorial, setModalHistorial] = useState(null); // loteObj
  const [filtroZona,   setFiltroZona]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [buscar,       setBuscar]       = useState('');
  const [vistaZonas,   setVistaZonas]   = useState(false);
  const [zonas,        setZonas]        = useState([]);

  /* ── cargar semanas y rifas al montar ── */
  const loadSemanas = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, rr] = await Promise.all([
        API.get('/caja/semanas'),
        API.get('/rifas'),
      ]);
      setSemanas(rs.data);
      setRifas(rr.data.filter(r => r.activa));
      if (rs.data.length > 0 && !semanaAct) {
        setSemanaAct(rs.data[0]);
      }
    } catch { toast.error('Error cargando caja'); }
    finally { setLoading(false); }
  }, [semanaAct]);

  useEffect(() => { loadSemanas(); }, []); // eslint-disable-line

  /* ── cargar detalle cuando cambia semanaAct ── */
  useEffect(() => {
    if (!semanaAct) return;
    const load = async () => {
      setLoadDet(true);
      try {
        const [rd, rz] = await Promise.all([
          API.get(`/caja/semanas/${semanaAct.id}`),
          API.get(`/caja/semanas/${semanaAct.id}/por-zona`),
        ]);
        setDetalle(rd.data);
        setZonas(rz.data);
      } catch { toast.error('Error cargando detalle'); }
      finally { setLoadDet(false); }
    };
    load();
  }, [semanaAct]);

  const reloadDetalle = async () => {
    if (!semanaAct) return;
    try {
      const [rd, rz] = await Promise.all([
        API.get(`/caja/semanas/${semanaAct.id}`),
        API.get(`/caja/semanas/${semanaAct.id}/por-zona`),
      ]);
      setDetalle(rd.data);
      setZonas(rz.data);
      // actualizar resumen en lista
      setSemanas(prev => prev.map(s => s.id === rd.data.id ? { ...s, ...rd.data } : s));
    } catch {}
  };

  /* ── filtros de lotes ── */
  const lotesFiltrados = (detalle?.lotes || []).filter(l => {
    if (filtroZona   && l.direccion !== filtroZona) return false;
    if (filtroEstado && l.estado    !== filtroEstado) return false;
    if (buscar       && !l.vendedor_nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const zonasUnicas = [...new Set((detalle?.lotes || []).map(l => l.direccion).filter(Boolean))].sort();

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <Layout title="CAJA">
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)', minHeight: 600, flexWrap: 'wrap' }}>

        {/* ══ SIDEBAR IZQUIERDO: Lista de semanas ══ */}
        <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-jordyn" style={{ width: '100%', fontSize: '.82rem' }}
            onClick={() => setModalSemana(true)}>
            <i className="bi bi-plus-lg me-1"></i>NUEVA SEMANA
          </button>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading && <div className="jd-spinner mx-auto mt-4"></div>}
            {semanas.map(s => (
              <div key={s.id} onClick={() => setSemanaAct(s)}
                style={{
                  background: semanaAct?.id === s.id ? 'rgba(245,197,24,.1)' : '#111',
                  border: `1px solid ${semanaAct?.id === s.id ? '#f5c518' : '#1e1e1e'}`,
                  borderRadius: 7, padding: '10px 12px', cursor: 'pointer',
                  transition: 'all .15s',
                }}>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.9rem', color: semanaAct?.id === s.id ? '#f5c518' : '#ccc', letterSpacing: '2px', lineHeight: 1.2 }}>{s.nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555', marginTop: 3 }}>{s.rifa_nombre}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, gap: 4 }}>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: s.estado === 'cerrada' ? '#555' : '#f5c518' }}>
                    {s.estado === 'cerrada' ? '🔒 CERRADA' : '🟢 ABIERTA'}
                  </span>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: '#e63946' }}>
                    {COP(s.total_pendiente)}
                  </span>
                </div>
              </div>
            ))}
            {!loading && semanas.length === 0 && (
              <div style={{ textAlign: 'center', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', marginTop: 20 }}>
                Sin semanas aún.<br />Crea la primera arriba.
              </div>
            )}
          </div>
        </div>

        {/* ══ PANEL PRINCIPAL ══ */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

          {!detalle && !loadDet && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#333' }}>
              <i className="bi bi-cash-stack" style={{ fontSize: '3rem' }}></i>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', letterSpacing: '3px' }}>
                SELECCIONA O CREA UNA SEMANA
              </div>
            </div>
          )}

          {loadDet && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="jd-spinner"></div>
            </div>
          )}

          {detalle && !loadDet && (
            <>
              {/* ── Header de la semana ── */}
              <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 9, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.3rem', color: '#f5c518', letterSpacing: '3px', lineHeight: 1 }}>{detalle.nombre}</div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#666', marginTop: 2 }}>
                    {detalle.rifa_nombre} · {COP(detalle.precio_boleto)}/boleto
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-jordyn" style={{ fontSize: '.8rem', padding: '5px 14px' }}
                    onClick={() => setModalLote('nuevo')}>
                    <i className="bi bi-person-plus me-1"></i>+ VENDEDOR
                  </button>
                  <button className={`btn-jordyn-outline`} style={{ fontSize: '.8rem', padding: '5px 12px' }}
                    onClick={() => setVistaZonas(v => !v)}>
                    <i className={`bi ${vistaZonas ? 'bi-list-ul' : 'bi-map'} me-1`}></i>
                    {vistaZonas ? 'TABLA' : 'POR ZONA'}
                  </button>
                  <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px', borderColor: detalle.estado === 'cerrada' ? '#06d6a0' : '#555', color: detalle.estado === 'cerrada' ? '#06d6a0' : '#555' }}
                    onClick={async () => {
                      const nuevoEstado = detalle.estado === 'cerrada' ? 'abierta' : 'cerrada';
                      await API.put(`/caja/semanas/${detalle.id}`, { estado: nuevoEstado });
                      reloadDetalle();
                      loadSemanas();
                    }}>
                    <i className={`bi ${detalle.estado === 'cerrada' ? 'bi-unlock' : 'bi-lock'} me-1`}></i>
                    {detalle.estado === 'cerrada' ? 'ABRIR' : 'CERRAR'}
                  </button>
                </div>
              </div>

              {/* ── Tarjetas resumen ── */}
              <ResumenCards detalle={detalle} />

              {/* ── Vista por zonas o tabla ── */}
              {vistaZonas ? (
                <VistaZonas zonas={zonas} />
              ) : (
                <>
                  {/* Filtros */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="jd-input" placeholder="🔍 Buscar vendedor..." value={buscar} onChange={e => setBuscar(e.target.value)}
                      style={{ maxWidth: 180, fontSize: '.8rem', padding: '.3rem .7rem' }} />
                    <select className="jd-select" value={filtroZona} onChange={e => setFiltroZona(e.target.value)}
                      style={{ maxWidth: 150, fontSize: '.8rem', padding: '.3rem .6rem' }}>
                      <option value="">Todas las zonas</option>
                      {zonasUnicas.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <select className="jd-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                      style={{ maxWidth: 140, fontSize: '.8rem', padding: '.3rem .6rem' }}>
                      <option value="">Todos los estados</option>
                      <option value="pagado">✅ Pagados</option>
                      <option value="parcial">⚠️ Parciales</option>
                      <option value="pendiente">🔴 Pendientes</option>
                    </select>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#555', marginLeft: 'auto' }}>
                      {lotesFiltrados.length} vendedor{lotesFiltrados.length !== 1 ? 'es' : ''}
                    </div>
                  </div>

                  {/* Tabla de lotes */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <TablaCaja
                      lotes={lotesFiltrados}
                      semanaCerrada={detalle.estado === 'cerrada'}
                      precioBoleto={detalle.precio_boleto}
                      onAbono={lote => setModalAbono(lote)}
                      onEditar={lote => setModalLote(lote)}
                      onHistorial={lote => setModalHistorial(lote)}
                      onEliminar={async lote => {
                        if (!window.confirm(`¿Eliminar a ${lote.vendedor_nombre}?`)) return;
                        await API.delete(`/caja/lotes/${lote.id}`);
                        toast.success('Vendedor eliminado');
                        reloadDetalle();
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ MODALES ══ */}
      {modalSemana && (
        <ModalSemana rifas={rifas} onClose={() => setModalSemana(false)}
          onSave={async data => {
            await API.post('/caja/semanas', data);
            toast.success('Semana creada');
            setModalSemana(false);
            loadSemanas();
          }} />
      )}

      {modalLote && (
        <ModalLote
          lote={modalLote === 'nuevo' ? null : modalLote}
          semanaId={detalle?.id}
          semanaNombre={detalle?.nombre}
          onClose={() => setModalLote(null)}
          onSave={async (data) => {
            if (modalLote === 'nuevo') {
              await API.post('/caja/lotes', { ...data, semana_id: detalle.id });
              toast.success('Vendedor agregado');
            } else {
              await API.put(`/caja/lotes/${modalLote.id}`, data);
              toast.success('Actualizado');
            }
            setModalLote(null);
            reloadDetalle();
          }}
        />
      )}

      {modalAbono && (
        <ModalAbono
          lote={modalAbono}
          onClose={() => setModalAbono(null)}
          onSave={async ({ lote_id, monto, nota }) => {
            await API.post('/caja/abonos', { lote_id, monto, nota });
            toast.success(`Abono de ${COP(monto)} registrado`);
            setModalAbono(null);
            reloadDetalle();
          }}
        />
      )}

      {modalHistorial && (
        <ModalHistorial
          lote={modalHistorial}
          onClose={() => setModalHistorial(null)}
          onDeleteAbono={async (abonoId) => {
            await API.delete(`/caja/abonos/${abonoId}`);
            toast.success('Abono eliminado');
            reloadDetalle();
            // refrescar historial
            const rd = await API.get(`/caja/semanas/${semanaAct.id}`);
            const loteActualizado = rd.data.lotes.find(l => l.id === modalHistorial.id);
            setModalHistorial(loteActualizado || null);
            setDetalle(rd.data);
          }}
        />
      )}
    </Layout>
  );
}

/* ═══════════════════════════════════════════
   TARJETAS RESUMEN
═══════════════════════════════════════════ */
function ResumenCards({ detalle: d }) {
  const cards = [
    { label: 'TOTAL A COBRAR', value: COP(d.total_por_cobrar), color: '#f5c518', icon: 'bi-cash' },
    { label: 'YA COBRADO',     value: COP(d.total_cobrado),    color: '#06d6a0', icon: 'bi-check-circle' },
    { label: 'POR COBRAR',     value: COP(d.total_pendiente),  color: '#e63946', icon: 'bi-exclamation-circle' },
    { label: 'VENDEDORES',     value: d.total_lotes || 0,      color: '#a0aeff', icon: 'bi-people' },
  ];
  const cobradoPct = pct(d.total_cobrado, d.total_por_cobrar);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.9rem' }}></i>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: '#555', letterSpacing: '2px' }}>{c.label}</span>
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.3rem', color: c.color, letterSpacing: '2px', lineHeight: 1 }}>{c.value}</div>
          </div>
        ))}
      </div>
      {/* Barra de progreso de cobranza */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '8px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555', letterSpacing: '2px' }}>COBRANZA</span>
          <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.85rem', color: cobradoPct >= 100 ? '#06d6a0' : '#f5c518', letterSpacing: '2px' }}>{cobradoPct}%</span>
        </div>
        <div style={{ height: 6, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(cobradoPct, 100)}%`, background: cobradoPct >= 100 ? '#06d6a0' : `linear-gradient(90deg,#f5c518,#ffd166)`, borderRadius: 3, transition: 'width .4s' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: '#555' }}>
            ✅ {d.lotes_pagados} pagados · ⚠️ {d.lotes_parciales} parciales · 🔴 {d.lotes_pendientes} pendientes
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TABLA DE CAJA
═══════════════════════════════════════════ */
function TablaCaja({ lotes, semanaCerrada, onAbono, onEditar, onHistorial, onEliminar }) {
  if (lotes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem' }}>
        Sin vendedores. Agrega el primero con "+ VENDEDOR".
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Oswald',sans-serif" }}>
        <thead>
          <tr style={{ background: '#0d0d0d', borderBottom: '2px solid #1e1e1e' }}>
            {['', 'VENDEDOR', 'ZONA', 'FIJOS', 'ENTREGADOS', 'VENDIDOS', 'POR PAGAR', 'ABONO', 'PENDIENTE', 'NÚMEROS', ''].map((h, i) => (
              <th key={i} style={{ padding: '8px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: '#555', letterSpacing: '2px', textAlign: i === 0 ? 'center' : i >= 9 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lotes.map(l => {
            const cfg = ESTADO_CFG[l.estado] || ESTADO_CFG.pendiente;
            return (
              <tr key={l.id} style={{ borderBottom: '1px solid #141414', background: 'transparent', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0f0f0f'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                {/* Estado */}
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <div title={cfg.label} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 4, padding: '2px 6px', display: 'inline-block', fontSize: '.75rem' }}>{cfg.icon}</div>
                </td>

                {/* Vendedor */}
                <td style={{ padding: '8px 10px', fontFamily: "'Oswald',sans-serif", fontSize: '.88rem', color: '#ddd', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.vendedor_nombre}</td>

                {/* Zona */}
                <td style={{ padding: '8px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#888' }}>{l.direccion || '—'}</td>

                {/* Fijos */}
                <td style={{ padding: '8px 10px', textAlign: 'left' }}>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: l.numeros_fijos ? '#a0aeff' : '#333' }}>{l.numeros_fijos ? 'SI' : 'NO'}</span>
                </td>

                {/* Entregados */}
                <td style={{ padding: '8px 10px', fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#888', letterSpacing: '2px' }}>{l.cant_entregados || 0}</td>

                {/* Vendidos */}
                <td style={{ padding: '8px 10px', fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#f5c518', letterSpacing: '2px' }}>{l.cant_vendidos || 0}</td>

                {/* Por pagar */}
                <td style={{ padding: '8px 10px', fontFamily: "'Bebas Neue',cursive", fontSize: '.9rem', color: '#ddd', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{COP(l.por_pagar)}</td>

                {/* Abono */}
                <td style={{ padding: '8px 10px', fontFamily: "'Bebas Neue',cursive", fontSize: '.9rem', color: '#06d6a0', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{COP(l.abono)}</td>

                {/* Pendiente */}
                <td style={{ padding: '8px 10px', fontFamily: "'Bebas Neue',cursive", fontSize: '.9rem', color: l.pendiente > 0 ? '#e63946' : '#06d6a0', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{COP(l.pendiente)}</td>

                {/* Números asignados */}
                <td style={{ padding: '8px 10px', maxWidth: 120 }}>
                  {l.numeros_asignados
                    ? <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.numeros_asignados}</span>
                    : <span style={{ color: '#2a2a2a' }}>—</span>}
                </td>

                {/* Acciones */}
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!semanaCerrada && (
                      <button title="Registrar abono" onClick={() => onAbono(l)}
                        style={{ background: 'rgba(6,214,160,.12)', border: '1px solid #06d6a044', color: '#06d6a0', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                        <i className="bi bi-plus-circle"></i>
                      </button>
                    )}
                    <button title="Historial de abonos" onClick={() => onHistorial(l)}
                      style={{ background: 'rgba(160,174,255,.1)', border: '1px solid #a0aeff33', color: '#a0aeff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                      <i className="bi bi-clock-history"></i>
                    </button>
                    {!semanaCerrada && (
                      <button title="Editar" onClick={() => onEditar(l)}
                        style={{ background: 'rgba(245,197,24,.08)', border: '1px solid #f5c51833', color: '#f5c518', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                        <i className="bi bi-pencil"></i>
                      </button>
                    )}
                    {!semanaCerrada && (
                      <button title="Eliminar" onClick={() => onEliminar(l)}
                        style={{ background: 'rgba(230,57,70,.08)', border: '1px solid #e6394633', color: '#e63946', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════
   VISTA POR ZONAS
═══════════════════════════════════════════ */
function VistaZonas({ zonas }) {
  if (!zonas.length) return <div style={{ color: '#333', textAlign: 'center', padding: 40, fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem' }}>Sin datos por zona.</div>;
  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {zonas.map(z => {
          const cobPct = pct(Number(z.cobrado), Number(z.por_cobrar));
          return (
            <div key={z.zona} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#f5c518', letterSpacing: '3px', marginBottom: 8 }}>{z.zona}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['Vendedores', z.lotes, '#aaa'],
                  ['Entregados', z.entregados, '#888'],
                  ['Vendidos',   z.vendidos,   '#f5c518'],
                  ['Por cobrar', COP(z.por_cobrar), '#ddd'],
                  ['Cobrado',    COP(z.cobrado),    '#06d6a0'],
                  ['Pendiente',  COP(z.pendiente),  '#e63946'],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555' }}>{k}</span>
                    <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.8rem', color: c, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, height: 4, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(cobPct, 100)}%`, background: cobPct >= 100 ? '#06d6a0' : '#f5c518', borderRadius: 2, transition: 'width .4s' }}></div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: '#555', marginTop: 4, textAlign: 'right' }}>{cobPct}% cobrado</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: NUEVA SEMANA
═══════════════════════════════════════════ */
function ModalSemana({ rifas, onClose, onSave }) {
  const [form, setForm] = useState({ nombre: '', rifa_id: rifas[0]?.id || '', notas: '' });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre || !form.rifa_id) { toast.error('Nombre y rifa son requeridos'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <ModalBase title="NUEVA SEMANA DE CAJA" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="jd-label">NOMBRE DE LA SEMANA</label>
          <input className="jd-input" value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Ej: Semana 15 · Junio 2025" />
        </div>
        <div>
          <label className="jd-label">RIFA ASOCIADA</label>
          <select className="jd-select" value={form.rifa_id} onChange={e => upd('rifa_id', e.target.value)}>
            <option value="">Seleccionar rifa...</option>
            {rifas.map(r => <option key={r.id} value={r.id}>{r.nombre} — {COP(r.precio)}</option>)}
          </select>
        </div>
        <div>
          <label className="jd-label">NOTAS (opcional)</label>
          <textarea className="jd-input" value={form.notas} onChange={e => upd('notas', e.target.value)} rows={2} placeholder="Observaciones generales..." style={{ resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }}></span> : 'CREAR SEMANA'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: LOTE (nuevo o editar)
═══════════════════════════════════════════ */
function ModalLote({ lote, semanaId, onClose, onSave }) {
  const esNuevo = !lote;
  const [form, setForm] = useState({
    vendedor_nombre:  lote?.vendedor_nombre  || '',
    direccion:        lote?.direccion        || '',
    numeros_fijos:    lote?.numeros_fijos    || false,
    cant_entregados:  lote?.cant_entregados  || '',
    cant_vendidos:    lote?.cant_vendidos    || '',
    abono:            lote?.abono            || '',
    numeros_asignados:lote?.numeros_asignados|| '',
    observacion:      lote?.observacion      || '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.vendedor_nombre) { toast.error('Nombre del vendedor requerido'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        cant_entregados:   Number(form.cant_entregados)  || 0,
        cant_vendidos:     Number(form.cant_vendidos)    || 0,
        abono:             Number(form.abono)            || 0,
        semana_id: semanaId,
      });
    } finally { setSaving(false); }
  };

  const DIRS = ['BARINAS','COLÓN','DELICIAS','LOBATERA','MICHELENA','PALMIRA','RÍO CHIQUITO','RUBIO','SAN CRISTÓBAL','TÁRIBA'];

  return (
    <ModalBase title={esNuevo ? 'NUEVO VENDEDOR' : `EDITAR: ${lote.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        <div style={{ gridColumn: '1/-1' }}>
          <label className="jd-label">NOMBRE DEL VENDEDOR *</label>
          <input className="jd-input" value={form.vendedor_nombre} onChange={e => upd('vendedor_nombre', e.target.value)} placeholder="Nombre completo" autoFocus />
        </div>

        <div>
          <label className="jd-label">DIRECCIÓN / ZONA</label>
          <input className="jd-input" list="dirs-list" value={form.direccion} onChange={e => upd('direccion', e.target.value)} placeholder="Ej: RUBIO" />
          <datalist id="dirs-list">{DIRS.map(d => <option key={d} value={d} />)}</datalist>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
          <label className="jd-label" style={{ marginBottom: 0 }}>NÚMEROS FIJOS</label>
          <button onClick={() => upd('numeros_fijos', !form.numeros_fijos)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.numeros_fijos ? '#f5c518' : '#2a2a2a', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.numeros_fijos ? 23 : 3, transition: 'left .2s' }}></div>
          </button>
        </div>

        <div>
          <label className="jd-label">CANT. ENTREGADOS</label>
          <input className="jd-input" type="number" min="0" value={form.cant_entregados} onChange={e => upd('cant_entregados', e.target.value)} placeholder="0" />
        </div>

        <div>
          <label className="jd-label">CANT. VENDIDOS</label>
          <input className="jd-input" type="number" min="0" value={form.cant_vendidos} onChange={e => upd('cant_vendidos', e.target.value)} placeholder="0" />
        </div>

        {esNuevo && (
          <div>
            <label className="jd-label">ABONO INICIAL</label>
            <input className="jd-input" type="number" min="0" value={form.abono} onChange={e => upd('abono', e.target.value)} placeholder="0" />
          </div>
        )}

        <div style={{ gridColumn: '1/-1' }}>
          <label className="jd-label">NÚMEROS ASIGNADOS</label>
          <input className="jd-input" value={form.numeros_asignados} onChange={e => upd('numeros_asignados', e.target.value)} placeholder="Ej: 001,002,050-060,123" />
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#444', marginTop: 3 }}>Escríbelos separados por comas o en rango (001-050)</div>
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label className="jd-label">OBSERVACIÓN</label>
          <input className="jd-input" value={form.observacion} onChange={e => upd('observacion', e.target.value)} placeholder="Notas adicionales..." />
        </div>

        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }}></span> : (esNuevo ? 'AGREGAR' : 'GUARDAR')}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: ABONO
═══════════════════════════════════════════ */
function ModalAbono({ lote, onClose, onSave }) {
  const [monto, setMonto] = useState('');
  const [nota,  setNota]  = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!monto || Number(monto) <= 0) { toast.error('Ingresa un monto válido'); return; }
    setSaving(true);
    try { await onSave({ lote_id: lote.id, monto: Number(monto), nota }); }
    finally { setSaving(false); }
  };

  return (
    <ModalBase title={`REGISTRAR ABONO — ${lote.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Resumen del lote */}
        <div style={{ background: '#0d0d0d', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16 }}>
          {[
            ['Por pagar', COP(lote.por_pagar), '#ddd'],
            ['Cobrado',   COP(lote.abono),     '#06d6a0'],
            ['Pendiente', COP(lote.pendiente), '#e63946'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: '#555', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>

        <div>
          <label className="jd-label">MONTO DEL ABONO *</label>
          <input className="jd-input" type="number" min="1" value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={`Máx: ${COP(lote.pendiente)}`} autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
          {/* Botones rápidos */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {[lote.pendiente, Math.round(lote.pendiente / 2), Math.round(lote.pendiente / 4)].filter(v => v > 0).map(v => (
              <button key={v} onClick={() => setMonto(String(v))}
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
                {COP(v)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="jd-label">NOTA (opcional)</label>
          <input className="jd-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: Pago en efectivo, transferencia..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }}></span> : 'REGISTRAR ABONO'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: HISTORIAL DE ABONOS
═══════════════════════════════════════════ */
function ModalHistorial({ lote, onClose, onDeleteAbono }) {
  const abonos = lote?.abonos_historial || [];

  return (
    <ModalBase title={`HISTORIAL — ${lote.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Resumen */}
        <div style={{ background: '#0d0d0d', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['Por pagar', COP(lote.por_pagar), '#ddd'],
            ['Total abonado', COP(lote.abono), '#06d6a0'],
            ['Pendiente', COP(lote.pendiente), lote.pendiente > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: '#555', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Lista de abonos */}
        {abonos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', padding: '20px 0' }}>
            Sin abonos registrados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {abonos.map((a, i) => (
              <div key={a.id} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555', minWidth: 20 }}>{i + 1}.</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#06d6a0', letterSpacing: '2px' }}>{COP(a.monto)}</div>
                  {a.nota && <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#666' }}>{a.nota}</div>}
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: '#444', marginTop: 2 }}>
                    {new Date(a.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button onClick={() => { if (window.confirm('¿Eliminar este abono?')) onDeleteAbono(a.id); }}
                  style={{ background: 'transparent', border: '1px solid #e6394644', color: '#e63946', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CERRAR</button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL BASE
═══════════════════════════════════════════ */
function ModalBase({ title, onClose, children, wide }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 24, width: '100%', maxWidth: wide ? 640 : 420, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#f5c518', letterSpacing: '3px' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.1rem' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}