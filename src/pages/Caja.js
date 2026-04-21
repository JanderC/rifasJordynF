// ============================================================
//   RIFAS JORDYN — Caja.js (REFORMA COMPLETA v3)
//   - Vendedores cargados desde la rifa con números fijos
//   - Estado de pago por vendedor (pagado / parcial / pendiente)
//   - Números pendientes (no vendidos) visibles por vendedor
//   - Números vendidos desde pantalla pública del cliente
//   - Toggle rápido Pagado / Pendiente inline
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ─── HELPERS ─── */
const COP = n =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n || 0);

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const parseNums = str => {
  if (!str) return [];
  const nums = new Set();
  String(str).split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = a; i <= b; i++) nums.add(i);
    } else if (part !== '') {
      nums.add(Number(part));
    }
  });
  return [...nums].sort((a, b) => a - b);
};

/* ─── ESTADO CONFIGS ─── */
const ESTADO_CFG = {
  pagado:    { icon: '✅', label: 'PAGADO',    bg: 'rgba(6,214,160,.10)',   color: '#06d6a0', border: '#06d6a030' },
  parcial:   { icon: '⚠️',  label: 'PARCIAL',   bg: 'rgba(255,193,7,.10)',   color: '#ffc107', border: '#ffc10730' },
  pendiente: { icon: '🔴', label: 'PENDIENTE', bg: 'rgba(230,57,70,.10)',   color: '#e63946', border: '#e6394630' },
};

/* ════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function Caja() {
  const [semanas,    setSemanas]    = useState([]);
  const [semanaAct,  setSemanaAct]  = useState(null);
  const [detalle,    setDetalle]    = useState(null);
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [loadDet,    setLoadDet]    = useState(false);

  // modales
  const [modalSemana,    setModalSemana]    = useState(false);
  const [modalLote,      setModalLote]      = useState(null);   // null | 'nuevo' | loteObj
  const [modalAbono,     setModalAbono]     = useState(null);
  const [modalHistorial, setModalHistorial] = useState(null);
  const [modalNums,      setModalNums]      = useState(null);   // ver nums de un vendedor

  // filtros
  const [filtroZona,   setFiltroZona]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [buscar,       setBuscar]       = useState('');
  const [vistaZonas,   setVistaZonas]   = useState(false);
  const [zonas,        setZonas]        = useState([]);

  /* ── cargar semanas y rifas ── */
  const loadSemanas = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, rr] = await Promise.all([
        API.get('/caja/semanas'),
        API.get('/rifas'),
      ]);
      setSemanas(rs.data);
      setRifas(rr.data.filter(r => r.activa));
      if (rs.data.length > 0 && !semanaAct) setSemanaAct(rs.data[0]);
    } catch { toast.error('Error cargando caja'); }
    finally { setLoading(false); }
  }, [semanaAct]);

  useEffect(() => { loadSemanas(); }, []); // eslint-disable-line

  /* ── detalle al cambiar semanaAct ── */
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
      setSemanas(prev => prev.map(s => s.id === rd.data.id ? { ...s, ...rd.data } : s));
    } catch {}
  };

  /* ── filtros ── */
  const lotesFiltrados = (detalle?.lotes || []).filter(l => {
    if (filtroZona   && l.direccion !== filtroZona)                           return false;
    if (filtroEstado && l.estado    !== filtroEstado)                         return false;
    if (buscar       && !l.vendedor_nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const zonasUnicas = [...new Set((detalle?.lotes || []).map(l => l.direccion).filter(Boolean))].sort();

  /* ── toggle pago rápido ── */
  const handleTogglePago = async lote => {
    const nuevoEstado = lote.estado === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await API.put(`/caja/lotes/${lote.id}/estado`, { estado: nuevoEstado });
      reloadDetalle();
      toast.success(nuevoEstado === 'pagado' ? '✅ Marcado como pagado' : '🔴 Marcado como pendiente');
    } catch { toast.error('Error actualizando estado'); }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <Layout title="CAJA">
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)', minHeight: 600, flexWrap: 'wrap' }}>

        {/* ══ SIDEBAR: semanas ══ */}
        <aside style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-jordyn" style={{ width: '100%', fontSize: '.82rem' }}
            onClick={() => setModalSemana(true)}>
            <i className="bi bi-plus-lg me-1"></i>NUEVA SEMANA
          </button>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading && <div className="jd-spinner mx-auto mt-4" />}
            {semanas.map(s => (
              <div key={s.id} onClick={() => setSemanaAct(s)}
                style={{
                  background: semanaAct?.id === s.id ? 'rgba(245,197,24,.1)' : '#111',
                  border: `1px solid ${semanaAct?.id === s.id ? '#f5c518' : '#1e1e1e'}`,
                  borderRadius: 7, padding: '10px 12px', cursor: 'pointer', transition: 'all .15s',
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
        </aside>

        {/* ══ PANEL PRINCIPAL ══ */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

          {!detalle && !loadDet && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#333' }}>
              <i className="bi bi-cash-stack" style={{ fontSize: '3rem' }} />
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', letterSpacing: '3px' }}>
                SELECCIONA O CREA UNA SEMANA
              </div>
            </div>
          )}

          {loadDet && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="jd-spinner" />
            </div>
          )}

          {detalle && !loadDet && (
            <>
              {/* ── Header ── */}
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
                    <i className="bi bi-person-plus me-1" />+ VENDEDOR
                  </button>
                  <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px' }}
                    onClick={() => setVistaZonas(v => !v)}>
                    <i className={`bi ${vistaZonas ? 'bi-list-ul' : 'bi-map'} me-1`} />
                    {vistaZonas ? 'TABLA' : 'POR ZONA'}
                  </button>
                  <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px', borderColor: detalle.estado === 'cerrada' ? '#06d6a0' : '#555', color: detalle.estado === 'cerrada' ? '#06d6a0' : '#555' }}
                    onClick={async () => {
                      const nuevoEstado = detalle.estado === 'cerrada' ? 'abierta' : 'cerrada';
                      await API.put(`/caja/semanas/${detalle.id}`, { estado: nuevoEstado });
                      reloadDetalle(); loadSemanas();
                    }}>
                    <i className={`bi ${detalle.estado === 'cerrada' ? 'bi-unlock' : 'bi-lock'} me-1`} />
                    {detalle.estado === 'cerrada' ? 'ABRIR' : 'CERRAR'}
                  </button>
                </div>
              </div>

              {/* ── Resumen ── */}
              <ResumenCards detalle={detalle} />

              {/* ── Contenido ── */}
              {vistaZonas ? (
                <VistaZonas zonas={zonas} />
              ) : (
                <>
                  {/* Filtros */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="jd-input" placeholder="🔍 Buscar vendedor..."
                      value={buscar} onChange={e => setBuscar(e.target.value)}
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

                  {/* Tabla */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <TablaCaja
                      lotes={lotesFiltrados}
                      semanaCerrada={detalle.estado === 'cerrada'}
                      precioBoleto={detalle.precio_boleto}
                      onAbono={lote => setModalAbono(lote)}
                      onEditar={lote => setModalLote(lote)}
                      onHistorial={lote => setModalHistorial(lote)}
                      onVerNums={lote => setModalNums(lote)}
                      onTogglePago={handleTogglePago}
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
          rifaId={detalle?.rifa_id}
          onClose={() => setModalLote(null)}
          onSave={async data => {
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
          onDeleteAbono={async abonoId => {
            await API.delete(`/caja/abonos/${abonoId}`);
            toast.success('Abono eliminado');
            reloadDetalle();
            const rd = await API.get(`/caja/semanas/${semanaAct.id}`);
            const loteAct = rd.data.lotes.find(l => l.id === modalHistorial.id);
            setModalHistorial(loteAct || null);
            setDetalle(rd.data);
          }}
        />
      )}

      {modalNums && (
        <ModalNumerosPendientes
          lote={modalNums}
          onClose={() => setModalNums(null)}
        />
      )}
    </Layout>
  );
}

/* ═══════════════════════════════════════════
   TARJETAS RESUMEN
═══════════════════════════════════════════ */
function ResumenCards({ detalle: d }) {
  const totalVendedores = d.lotes?.length || 0;
  const pagados  = (d.lotes || []).filter(l => l.estado === 'pagado').length;
  const parciales = (d.lotes || []).filter(l => l.estado === 'parcial').length;
  const pendientes = (d.lotes || []).filter(l => l.estado === 'pendiente').length;

  const cards = [
    { label: 'TOTAL A COBRAR',  value: COP(d.total_por_cobrar),  color: '#f5c518', icon: 'bi-cash' },
    { label: 'YA COBRADO',      value: COP(d.total_cobrado),     color: '#06d6a0', icon: 'bi-check2-circle' },
    { label: 'PENDIENTE',       value: COP(d.total_pendiente),   color: '#e63946', icon: 'bi-exclamation-circle' },
    { label: 'VENDEDORES',      value: `${pagados}/${totalVendedores}`, color: '#aaa', icon: 'bi-people', sub: `${parciales} parcial · ${pendientes} pendiente` },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 9, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: '#555', letterSpacing: '2px' }}>{c.label}</div>
            <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.75rem', opacity: .5 }} />
          </div>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: c.color, letterSpacing: '2px', lineHeight: 1.1, marginTop: 4 }}>{c.value}</div>
          {c.sub && <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.45rem', color: '#444', marginTop: 3 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TABLA DE CAJA (reformada)
═══════════════════════════════════════════ */
function TablaCaja({ lotes, semanaCerrada, precioBoleto, onAbono, onEditar, onHistorial, onEliminar, onTogglePago, onVerNums }) {
  if (lotes.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', padding: '40px 0', letterSpacing: '2px' }}>
        SIN VENDEDORES EN ESTA SEMANA
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lotes.map(lote => <FilaLote key={lote.id} lote={lote} semanaCerrada={semanaCerrada} precioBoleto={precioBoleto} onAbono={onAbono} onEditar={onEditar} onHistorial={onHistorial} onEliminar={onEliminar} onTogglePago={onTogglePago} onVerNums={onVerNums} />)}
    </div>
  );
}

/* ── Fila individual ── */
function FilaLote({ lote, semanaCerrada, precioBoleto, onAbono, onEditar, onHistorial, onEliminar, onTogglePago, onVerNums }) {
  const [expanded, setExpanded] = useState(false);
  const est = ESTADO_CFG[lote.estado] || ESTADO_CFG.pendiente;

  // Números asignados vs vendidos desde pantalla pública
  const numsAsignados   = parseNums(lote.numeros_asignados);
  const numsVendidosPub = lote.numeros_vendidos_publico || [];   // array de números vendidos en pantalla pública
  const numsPendientes  = numsAsignados.filter(n => !numsVendidosPub.includes(n));
  const numsVendidos    = numsAsignados.filter(n => numsVendidosPub.includes(n));

  const progPct = pct(lote.abono || 0, lote.por_pagar || 0);

  return (
    <div style={{ background: '#111', border: `1px solid ${est.border}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color .2s' }}>
      {/* ── Fila principal ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexWrap: 'wrap' }}>

        {/* Toggle pago */}
        <button
          onClick={() => onTogglePago(lote)}
          disabled={semanaCerrada}
          title={lote.estado === 'pagado' ? 'Clic para marcar pendiente' : 'Clic para marcar pagado'}
          style={{
            background: est.bg, border: `1.5px solid ${est.border}`,
            color: est.color, borderRadius: 6, padding: '3px 8px',
            cursor: semanaCerrada ? 'default' : 'pointer',
            fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem',
            letterSpacing: '1px', flexShrink: 0, whiteSpace: 'nowrap',
            transition: 'all .15s', userSelect: 'none',
          }}>
          {est.icon} {est.label}
        </button>

        {/* Nombre */}
        <div style={{ flex: 1, minWidth: 130 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.92rem', color: '#ddd', fontWeight: 600, lineHeight: 1.1 }}>
            {lote.vendedor_nombre}
          </div>
          {lote.direccion && (
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555', marginTop: 1 }}>
              📍 {lote.direccion}
            </div>
          )}
        </div>

        {/* Números fijos badge */}
        {lote.numeros_fijos && (
          <span style={{ background: 'rgba(124,58,237,.12)', border: '1px solid rgba(124,58,237,.3)', color: '#a78bfa', borderRadius: 4, padding: '2px 7px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', letterSpacing: '1px', flexShrink: 0 }}>
            🔒 FIJOS
          </span>
        )}

        {/* Montos */}
        <div style={{ display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
          {[
            ['POR PAGAR', COP(lote.por_pagar), '#ddd'],
            ['COBRADO',   COP(lote.abono),     '#06d6a0'],
            ['DEUDA',     COP(lote.pendiente), lote.pendiente > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: '#444', letterSpacing: '1px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Números resumen rápido */}
        {numsAsignados.length > 0 && (
          <button onClick={() => onVerNums(lote)}
            style={{ background: 'rgba(245,197,24,.06)', border: '1px solid rgba(245,197,24,.2)', color: '#f5c518', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
            🎟 {numsAsignados.length} núm
            {numsVendidos.length > 0 && <span style={{ color: '#06d6a0' }}> · ✓{numsVendidos.length}</span>}
            {numsPendientes.length > 0 && <span style={{ color: '#e63946' }}> · ⏳{numsPendientes.length}</span>}
          </button>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {!semanaCerrada && (
            <button onClick={() => onAbono(lote)} title="Registrar abono"
              style={{ background: 'rgba(6,214,160,.08)', border: '1px solid rgba(6,214,160,.25)', color: '#06d6a0', borderRadius: 5, padding: '4px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
              <i className="bi bi-plus-circle" />
            </button>
          )}
          <button onClick={() => onHistorial(lote)} title="Ver historial"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-clock-history" />
          </button>
          {!semanaCerrada && (
            <>
              <button onClick={() => onEditar(lote)} title="Editar"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                <i className="bi bi-pencil" />
              </button>
              <button onClick={() => onEliminar(lote)} title="Eliminar"
                style={{ background: 'rgba(230,57,70,.06)', border: '1px solid rgba(230,57,70,.2)', color: '#e63946', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                <i className="bi bi-trash3" />
              </button>
            </>
          )}
          <button onClick={() => setExpanded(e => !e)} title="Expandir"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#555', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className={`bi bi-chevron-${expanded ? 'up' : 'down'}`} />
          </button>
        </div>
      </div>

      {/* ── Barra de progreso ── */}
      <div style={{ height: 3, background: '#1a1a1a', margin: '0 14px 0' }}>
        <div style={{ height: '100%', width: `${Math.min(progPct, 100)}%`, background: progPct >= 100 ? '#06d6a0' : '#f5c518', transition: 'width .4s', borderRadius: 2 }} />
      </div>

      {/* ── Panel expandido ── */}
      {expanded && (
        <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Estadísticas */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              ['ENTREGADOS', lote.cant_entregados, '#888'],
              ['VENDIDOS',   lote.cant_vendidos,   '#f5c518'],
              ['BOLETO/c',   COP(precioBoleto),    '#555'],
              ['% COBRADO',  `${progPct}%`,         progPct >= 100 ? '#06d6a0' : '#ffc107'],
            ].map(([k, v, c]) => (
              <div key={k}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: '#444', letterSpacing: '1px' }}>{k}</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.95rem', color: c, letterSpacing: '2px' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Números pendientes */}
          {numsPendientes.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#e63946', letterSpacing: '2px', marginBottom: 6 }}>
                ⏳ NÚMEROS PENDIENTES ({numsPendientes.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {numsPendientes.map(n => (
                  <span key={n} style={{ background: 'rgba(230,57,70,.1)', border: '1px solid rgba(230,57,70,.25)', color: '#e63946', borderRadius: 4, padding: '2px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700 }}>
                    {String(n).padStart(3, '0')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Números vendidos desde pantalla pública */}
          {numsVendidos.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#06d6a0', letterSpacing: '2px', marginBottom: 6 }}>
                ✅ VENDIDOS (pantalla pública: {numsVendidos.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {numsVendidos.map(n => (
                  <span key={n} style={{ background: 'rgba(6,214,160,.1)', border: '1px solid rgba(6,214,160,.25)', color: '#06d6a0', borderRadius: 4, padding: '2px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700 }}>
                    {String(n).padStart(3, '0')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observación */}
          {lote.observacion && (
            <div style={{ background: '#0d0d0d', borderRadius: 6, padding: '8px 12px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#666' }}>
              📝 {lote.observacion}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   VISTA POR ZONAS
═══════════════════════════════════════════ */
function VistaZonas({ zonas }) {
  if (!zonas.length) {
    return (
      <div style={{ textAlign: 'center', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', padding: '40px 0', letterSpacing: '2px' }}>
        SIN ZONAS REGISTRADAS
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {zonas.map(z => {
          const cobPct = pct(Number(z.cobrado), Number(z.por_cobrar));
          return (
            <div key={z.zona} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#f5c518', letterSpacing: '3px', marginBottom: 8 }}>{z.zona}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['Vendedores', z.lotes,               '#aaa'],
                  ['Entregados', z.entregados,           '#888'],
                  ['Vendidos',   z.vendidos,             '#f5c518'],
                  ['Por cobrar', COP(z.por_cobrar),      '#ddd'],
                  ['Cobrado',    COP(z.cobrado),         '#06d6a0'],
                  ['Pendiente',  COP(z.pendiente),       '#e63946'],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#555' }}>{k}</span>
                    <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.8rem', color: c, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, height: 4, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(cobPct, 100)}%`, background: cobPct >= 100 ? '#06d6a0' : '#f5c518', borderRadius: 2, transition: 'width .4s' }} />
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
   MODAL: NÚMEROS PENDIENTES DEL VENDEDOR
═══════════════════════════════════════════ */
function ModalNumerosPendientes({ lote, onClose }) {
  const numsAsignados   = parseNums(lote.numeros_asignados);
  const numsVendidosPub = lote.numeros_vendidos_publico || [];
  const numsPendientes  = numsAsignados.filter(n => !numsVendidosPub.includes(n));
  const numsVendidos    = numsAsignados.filter(n => numsVendidosPub.includes(n));

  return (
    <ModalBase title={`NÚMEROS — ${lote.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Resumen */}
        <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            ['TOTAL ASIGNADOS', numsAsignados.length,   '#ddd'],
            ['VENDIDOS (pub)',  numsVendidos.length,    '#06d6a0'],
            ['PENDIENTES',      numsPendientes.length,  '#e63946'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.45rem', color: '#444', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: c, letterSpacing: '3px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Pendientes */}
        {numsPendientes.length > 0 && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#e63946', letterSpacing: '2px', marginBottom: 8 }}>
              ⏳ NÚMEROS PENDIENTES — NO VENDIDOS AÚN
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {numsPendientes.map(n => (
                <span key={n} style={{ background: 'rgba(230,57,70,.12)', border: '1px solid rgba(230,57,70,.3)', color: '#e63946', borderRadius: 5, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700 }}>
                  {String(n).padStart(3, '0')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Vendidos */}
        {numsVendidos.length > 0 && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#06d6a0', letterSpacing: '2px', marginBottom: 8 }}>
              ✅ VENDIDOS DESDE PANTALLA PÚBLICA
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {numsVendidos.map(n => (
                <span key={n} style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 5, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700 }}>
                  {String(n).padStart(3, '0')}
                </span>
              ))}
            </div>
          </div>
        )}

        {numsAsignados.length === 0 && (
          <div style={{ textAlign: 'center', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', padding: '20px 0' }}>
            Sin números asignados a este vendedor
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CERRAR</button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: NUEVA SEMANA
═══════════════════════════════════════════ */
function ModalSemana({ rifas, onClose, onSave }) {
  const [form, setForm] = useState({ nombre: '', rifa_id: rifas[0]?.id || '', notas: '', cargar_vendedores_rifa: true });
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
          <input className="jd-input" value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Ej: Semana 15 · Junio 2025" autoFocus />
        </div>
        <div>
          <label className="jd-label">RIFA ASOCIADA</label>
          <select className="jd-select" value={form.rifa_id} onChange={e => upd('rifa_id', e.target.value)}>
            <option value="">Seleccionar rifa...</option>
            {rifas.map(r => <option key={r.id} value={r.id}>{r.nombre} — {COP(r.precio)}</option>)}
          </select>
        </div>
        {/* Opción de cargar automáticamente vendedores con números fijos */}
        <div style={{ background: 'rgba(245,197,24,.05)', border: '1px solid rgba(245,197,24,.15)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => upd('cargar_vendedores_rifa', !form.cargar_vendedores_rifa)}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.cargar_vendedores_rifa ? '#f5c518' : '#2a2a2a', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.cargar_vendedores_rifa ? 23 : 3, transition: 'left .2s' }} />
          </button>
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#f5c518', letterSpacing: '1px' }}>AUTO-CARGAR VENDEDORES</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: '#555', marginTop: 2 }}>Importa automáticamente los vendedores con números fijos de la rifa seleccionada</div>
          </div>
        </div>
        <div>
          <label className="jd-label">NOTAS (opcional)</label>
          <textarea className="jd-input" value={form.notas} onChange={e => upd('notas', e.target.value)} rows={2} placeholder="Observaciones generales..." style={{ resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : 'CREAR SEMANA'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: LOTE (nuevo o editar)
═══════════════════════════════════════════ */
function ModalLote({ lote, semanaId, rifaId, onClose, onSave }) {
  const esNuevo = !lote;
  const [form, setForm] = useState({
    vendedor_nombre:   lote?.vendedor_nombre   || '',
    direccion:         lote?.direccion         || '',
    numeros_fijos:     lote?.numeros_fijos     || false,
    cant_entregados:   lote?.cant_entregados   || '',
    cant_vendidos:     lote?.cant_vendidos     || '',
    abono:             lote?.abono             || '',
    numeros_asignados: lote?.numeros_asignados || '',
    observacion:       lote?.observacion       || '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.vendedor_nombre) { toast.error('Nombre del vendedor requerido'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        cant_entregados: Number(form.cant_entregados) || 0,
        cant_vendidos:   Number(form.cant_vendidos)   || 0,
        abono:           Number(form.abono)           || 0,
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
          <button onClick={() => upd('numeros_fijos', !form.numeros_fijos)}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.numeros_fijos ? '#f5c518' : '#2a2a2a', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.numeros_fijos ? 23 : 3, transition: 'left .2s' }} />
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
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#444', marginTop: 3 }}>
            Separados por comas o en rango (001-050)
          </div>
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label className="jd-label">OBSERVACIÓN</label>
          <input className="jd-input" value={form.observacion} onChange={e => upd('observacion', e.target.value)} placeholder="Notas adicionales..." />
        </div>

        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : (esNuevo ? 'AGREGAR' : 'GUARDAR')}
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
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
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
        <div style={{ background: '#0d0d0d', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : 'REGISTRAR ABONO'}
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
        <div style={{ background: '#0d0d0d', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['Por pagar',      COP(lote.por_pagar), '#ddd'],
            ['Total abonado',  COP(lote.abono),     '#06d6a0'],
            ['Pendiente',      COP(lote.pendiente), lote.pendiente > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: '#555', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>

        {abonos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#333', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', padding: '20px 0' }}>Sin abonos registrados</div>
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
                  style={{ background: 'transparent', border: '1px solid rgba(230,57,70,.3)', color: '#e63946', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                  <i className="bi bi-trash" />
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 24, width: '100%', maxWidth: wide ? 660 : 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#f5c518', letterSpacing: '3px' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.1rem' }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}