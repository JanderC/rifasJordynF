// ============================================================
//   RIFAS JORDYN — Caja.js (v4)
//   - Sin "Nueva Semana" manual: se muestra la rifa activa
//     por rango de fechas (fecha_inicio → fecha_sorteo)
//   - Modal automático al entrar si hay deuda pendiente
//     de rifa vencida hace más de 3 días
//   - Deudas viejas aparecen en la rifa nueva con botón
//     "SALDAR DEUDA ANTERIOR" por vendedor
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
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
      const n = Number(part);
      if (!isNaN(n)) nums.add(n);
    }
  });
  return [...nums].sort((a, b) => a - b);
};

const fmtFecha = f => {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas',
  });
};

/* ─── ESTADO CONFIGS ─── */
const ESTADO_CFG = {
  pagado:    { icon: '✅', label: 'PAGADO',    bg: 'rgba(6,214,160,.10)',  color: '#06d6a0', border: '#06d6a040' },
  parcial:   { icon: '⚠️',  label: 'PARCIAL',   bg: 'rgba(255,193,7,.10)',  color: '#ffc107', border: '#ffc10740' },
  pendiente: { icon: '🔴', label: 'PENDIENTE', bg: 'rgba(230,57,70,.10)',  color: '#e63946', border: '#e6394640' },
};

/* ════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function Caja() {
  const [rifaActiva,        setRifaActiva]        = useState(null);
  const [detalle,           setDetalle]           = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [loadDet,           setLoadDet]           = useState(false);
  const [deudasVencidas,    setDeudasVencidas]    = useState([]);
  const [modalDeudas,       setModalDeudas]       = useState(false);
  const [deudasConfirmadas, setDeudasConfirmadas] = useState(false);
  const [deudasAnteriores,  setDeudasAnteriores]  = useState([]);
  const [filtroZona,        setFiltroZona]        = useState('');
  const [filtroEstado,      setFiltroEstado]      = useState('');
  const [buscar,            setBuscar]            = useState('');
  const [vistaZonas,        setVistaZonas]        = useState(false);
  const [zonas,             setZonas]             = useState([]);
  const [modalLote,         setModalLote]         = useState(null);
  const [modalAbono,        setModalAbono]        = useState(null);
  const [modalHistorial,    setModalHistorial]    = useState(null);
  const [modalNums,         setModalNums]         = useState(null);

  /* ── Carga inicial ── */
  const cargarCaja = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get('/caja/rifa-activa');
      setRifaActiva(r.data.rifa || null);

      if (r.data.deudas_vencidas?.length > 0 && !deudasConfirmadas) {
        setDeudasVencidas(r.data.deudas_vencidas);
        setModalDeudas(true);
      }

      setDeudasAnteriores(r.data.deudas_anteriores || []);

      if (r.data.semana) {
        await cargarDetalle(r.data.semana.id);
      } else {
        setDetalle(null);
      }
    } catch {
      toast.error('Error cargando caja');
    } finally {
      setLoading(false);
    }
  }, [deudasConfirmadas]); // eslint-disable-line

  useEffect(() => { cargarCaja(); }, []); // eslint-disable-line

  const cargarDetalle = async semanaId => {
    setLoadDet(true);
    try {
      const [rd, rz] = await Promise.all([
        API.get(`/caja/semanas/${semanaId}`),
        API.get(`/caja/semanas/${semanaId}/por-zona`),
      ]);
      setDetalle(rd.data);
      setZonas(rz.data);
    } catch { toast.error('Error cargando detalle'); }
    finally { setLoadDet(false); }
  };

  const reloadDetalle = async () => {
    if (!detalle?.id) return;
    try {
      const [rd, rz] = await Promise.all([
        API.get(`/caja/semanas/${detalle.id}`),
        API.get(`/caja/semanas/${detalle.id}/por-zona`),
      ]);
      setDetalle(rd.data);
      setZonas(rz.data);
    } catch {}
  };

  /* ── Filtros ── */
  const lotesFiltrados = (detalle?.lotes || []).filter(l => {
    if (filtroZona   && l.direccion !== filtroZona) return false;
    if (filtroEstado && l.estado    !== filtroEstado) return false;
    if (buscar && !l.vendedor_nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const zonasUnicas = [...new Set((detalle?.lotes || []).map(l => l.direccion).filter(Boolean))].sort();

  /* ── Toggle pago rápido ── */
  const handleTogglePago = async lote => {
    const nuevo = lote.estado === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await API.put(`/caja/lotes/${lote.id}/estado`, { estado: nuevo });
      reloadDetalle();
      toast.success(nuevo === 'pagado' ? '✅ Marcado como pagado' : '🔴 Marcado como pendiente');
    } catch { toast.error('Error actualizando estado'); }
  };

  /* ── Saldar deuda anterior ── */
  const handleSaldarDeudaAnterior = async deuda => {
    if (!window.confirm(
      `¿Marcar la deuda de ${deuda.vendedor_nombre} (${COP(deuda.monto_pendiente)}) como saldada?\n\nEste monto lo manejas tú manualmente — no se suma a ningún registro automático.`
    )) return;
    try {
      await API.put(`/caja/lotes/${deuda.lote_id}/saldar-deuda-anterior`);
      setDeudasAnteriores(prev => prev.filter(d => d.lote_id !== deuda.lote_id));
      toast.success(`Deuda de ${deuda.vendedor_nombre} marcada como saldada`);
    } catch { toast.error('Error al saldar deuda'); }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  if (loading) {
    return (
      <Layout title="CAJA">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
          <div className="jd-spinner" style={{ width: 40, height: 40 }} />
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', color: 'var(--jordyn-muted)', letterSpacing: '3px' }}>CARGANDO CAJA...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="CAJA">

      {/* ══ MODAL: DEUDAS VENCIDAS (automático) ══ */}
      {modalDeudas && (
        <ModalDeudasVencidas
          deudas={deudasVencidas}
          onConfirmar={traspasar => {
            setModalDeudas(false);
            setDeudasConfirmadas(true);
            if (traspasar) toast.info('Las deudas se mostrarán en la siguiente rifa');
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══ SIN RIFA ACTIVA ══ */}
        {!rifaActiva && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
            <div style={{ fontSize: '3rem', opacity: .25 }}>🎟</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.6rem', color: 'var(--jordyn-muted)', letterSpacing: '4px' }}>
              SIN RIFA ACTIVA
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', letterSpacing: '2px', textAlign: 'center', maxWidth: 380, lineHeight: 1.8 }}>
              La caja se activa automáticamente cuando existe una rifa dentro de su rango de fechas.<br />
              Crea o activa una rifa desde <strong>Gestión de Rifas</strong>.
            </div>
          </div>
        )}

        {/* ══ RIFA ACTIVA ══ */}
        {rifaActiva && (
          <>
            <BannerRifaActiva rifa={rifaActiva} />

            {deudasAnteriores.length > 0 && (
              <SeccionDeudasAnteriores
                deudas={deudasAnteriores}
                onSaldar={handleSaldarDeudaAnterior}
              />
            )}

            {loadDet && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div className="jd-spinner" />
              </div>
            )}

            {detalle && !loadDet && (
              <>
                <ResumenCards detalle={detalle} />

                {/* Toolbar */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn-jordyn" style={{ fontSize: '.8rem', padding: '5px 14px' }}
                    onClick={() => setModalLote('nuevo')}>
                    <i className="bi bi-person-plus me-1" />+ VENDEDOR
                  </button>
                  <a
                    href={`/caja/rifa?rifa=${rifaActiva?.id}`}
                    className="btn-jordyn"
                    style={{ fontSize: '.8rem', padding: '5px 14px', background: 'linear-gradient(135deg,#f5c518,#e0a800)', color: '#000', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontFamily: 'inherit', fontWeight: 700, letterSpacing: '.5px' }}
                  >
                    <i className="bi bi-coin" /> 🪙 COBRAR POR NÚMERO
                  </a>
                  <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px' }}
                    onClick={() => setVistaZonas(v => !v)}>
                    <i className={`bi ${vistaZonas ? 'bi-list-ul' : 'bi-map'} me-1`} />
                    {vistaZonas ? 'TABLA' : 'POR ZONA'}
                  </button>
                  <button
                    className="btn-jordyn-outline"
                    style={{ fontSize: '.8rem', padding: '5px 12px', borderColor: detalle.estado === 'cerrada' ? '#06d6a0' : 'var(--jordyn-muted)', color: detalle.estado === 'cerrada' ? '#06d6a0' : 'var(--jordyn-muted)' }}
                    onClick={async () => {
                      const nuevo = detalle.estado === 'cerrada' ? 'abierta' : 'cerrada';
                      await API.put(`/caja/semanas/${detalle.id}`, { estado: nuevo });
                      reloadDetalle();
                    }}>
                    <i className={`bi ${detalle.estado === 'cerrada' ? 'bi-unlock' : 'bi-lock'} me-1`} />
                    {detalle.estado === 'cerrada' ? 'ABRIR' : 'CERRAR'}
                  </button>

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
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', marginLeft: 'auto' }}>
                    {lotesFiltrados.length} vendedor{lotesFiltrados.length !== 1 ? 'es' : ''}
                  </div>
                </div>

                {vistaZonas ? (
                  <VistaZonas zonas={zonas} />
                ) : (
                  <TablaCaja
                    lotes={lotesFiltrados}
                    semanaCerrada={detalle.estado === 'cerrada'}
                    precioBoleto={detalle.precio_boleto}
                    rifaId={rifaActiva?.id}
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
                )}
              </>
            )}

            {!detalle && !loadDet && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', letterSpacing: '2px' }}>
                LA CAJA DE ESTA RIFA AÚN NO TIENE VENDEDORES CARGADOS
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ MODALES ══ */}
      {modalLote && (
        <ModalLote
          lote={modalLote === 'nuevo' ? null : modalLote}
          semanaId={detalle?.id}
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
            const rd = await API.get(`/caja/semanas/${detalle.id}`);
            const loteAct = rd.data.lotes.find(l => l.id === modalHistorial.id);
            setModalHistorial(loteAct || null);
            setDetalle(rd.data);
          }}
        />
      )}

      {modalNums && (
        <ModalNumerosPendientes lote={modalNums} onClose={() => setModalNums(null)} />
      )}
    </Layout>
  );
}

/* ═══════════════════════════════════════════
   BANNER RIFA ACTIVA
═══════════════════════════════════════════ */
function BannerRifaActiva({ rifa }) {
  const hoy    = new Date();
  const sorteo = rifa.fecha_sorteo ? new Date(rifa.fecha_sorteo) : null;
  const diasRestantes = sorteo ? Math.ceil((sorteo - hoy) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div style={{
      background: 'var(--jordyn-bg2)',
      border: '1px solid var(--jordyn-border)',
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 4, padding: '1px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', letterSpacing: '2px' }}>
            🟢 EN CURSO
          </span>
          {diasRestantes !== null && (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: diasRestantes <= 3 ? '#e63946' : 'var(--jordyn-muted)', letterSpacing: '1px' }}>
              {diasRestantes > 0 ? `${diasRestantes} días para el sorteo` : 'SORTEO HOY'}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: 'var(--jordyn-primary)', letterSpacing: '3px', lineHeight: 1 }}>
          {rifa.nombre}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>
          {COP(rifa.precio)}/boleto · Sorteo: {fmtFecha(rifa.fecha_sorteo)}
          {rifa.loteria_ref && ` · ${rifa.loteria_ref}`}
        </div>
      </div>
      {rifa.premio && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>PREMIO</div>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: 'var(--jordyn-text)', letterSpacing: '2px' }}>{rifa.premio}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECCIÓN: DEUDAS ANTERIORES
═══════════════════════════════════════════ */
function SeccionDeudasAnteriores({ deudas, onSaldar }) {
  const [expandida, setExpandida] = useState(true);
  const totalDeuda = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);

  return (
    <div style={{ border: '1px solid rgba(230,57,70,.35)', borderRadius: 10, overflow: 'hidden', background: 'rgba(230,57,70,.03)' }}>
      <button
        onClick={() => setExpandida(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(230,57,70,.07)', border: 'none', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#e63946', letterSpacing: '3px', lineHeight: 1 }}>
              DEUDAS DE RIFA ANTERIOR — {deudas.length} VENDEDOR{deudas.length !== 1 ? 'ES' : ''}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
              Total pendiente: {COP(totalDeuda)} · Este monto lo manejas tú manualmente
            </div>
          </div>
        </div>
        <i className={`bi bi-chevron-${expandida ? 'up' : 'down'}`} style={{ color: '#e63946', fontSize: '.8rem' }} />
      </button>

      {expandida && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deudas.map(d => (
            <div key={d.lote_id} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.9rem', color: 'var(--jordyn-text)', fontWeight: 600 }}>
                  {d.vendedor_nombre}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
                  Rifa: {d.rifa_nombre}{d.direccion ? ` · ${d.direccion}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>DEUDA</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: '#e63946', letterSpacing: '2px', lineHeight: 1 }}>
                  {COP(d.monto_pendiente)}
                </div>
              </div>
              <button
                onClick={() => onSaldar(d)}
                style={{ background: 'rgba(6,214,160,.08)', border: '1.5px solid rgba(6,214,160,.35)', color: '#06d6a0', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', letterSpacing: '1px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                ✅ SALDAR DEUDA ANTERIOR
              </button>
            </div>
          ))}
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'rgba(230,57,70,.45)', textAlign: 'center', marginTop: 4, letterSpacing: '1px' }}>
            ⚠ Los montos de deuda anterior no se suman ni restan a la caja actual — solo son un recordatorio visual
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: DEUDAS VENCIDAS (automático)
═══════════════════════════════════════════ */
function ModalDeudasVencidas({ deudas, onConfirmar }) {
  const total = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--jordyn-bg)', border: '1px solid rgba(230,57,70,.4)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '4px', lineHeight: 1 }}>
            RIFA VENCIDA — DEUDA PENDIENTE
          </div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', marginTop: 8, lineHeight: 1.8 }}>
            Han pasado más de 3 días desde el sorteo y los siguientes vendedores<br />
            tienen montos sin cobrar. ¿Deseas traspasar las deudas a la próxima rifa?
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {deudas.map((d, i) => (
            <div key={i} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.88rem', color: 'var(--jordyn-text)', fontWeight: 600 }}>{d.vendedor_nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>
                  {d.rifa_nombre}{d.direccion ? ` · ${d.direccion}` : ''}
                </div>
              </div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#e63946', letterSpacing: '2px', flexShrink: 0 }}>
                {COP(d.monto_pendiente)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(230,57,70,.08)', border: '1px solid rgba(230,57,70,.2)', borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>TOTAL PENDIENTE</span>
          <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '3px' }}>{COP(total)}</span>
        </div>

        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'rgba(230,57,70,.5)', textAlign: 'center', marginBottom: 18, lineHeight: 1.7 }}>
          ⚠ Este monto lo manejas tú manualmente.<br />
          No se suma ni resta de ningún registro automático.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onConfirmar(false)} className="btn-jordyn-outline" style={{ flex: 1, fontSize: '.78rem' }}>
            NO, IGNORAR
          </button>
          <button onClick={() => onConfirmar(true)} className="btn-jordyn" style={{ flex: 1, fontSize: '.78rem' }}>
            SÍ, TRASPASAR A PRÓXIMA RIFA
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TARJETAS RESUMEN
═══════════════════════════════════════════ */
function ResumenCards({ detalle: d }) {
  const pagados  = (d.lotes || []).filter(l => l.estado === 'pagado').length;
  const total    = d.lotes?.length || 0;
  const parciales  = (d.lotes || []).filter(l => l.estado === 'parcial').length;
  const pendientes = (d.lotes || []).filter(l => l.estado === 'pendiente').length;

  const cards = [
    { label: 'TOTAL A COBRAR', value: COP(d.total_por_cobrar), color: 'var(--jordyn-primary)', icon: 'bi-cash' },
    { label: 'YA COBRADO',     value: COP(d.total_cobrado),    color: '#06d6a0', icon: 'bi-check2-circle' },
    { label: 'PENDIENTE',      value: COP(d.total_pendiente),  color: '#e63946', icon: 'bi-exclamation-circle' },
    { label: 'VENDEDORES',     value: `${pagados}/${total}`,   color: 'var(--jordyn-text)', icon: 'bi-people',
      sub: `${parciales} parcial · ${pendientes} pendiente` },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 9, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{c.label}</div>
            <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.75rem', opacity: .4 }} />
          </div>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: c.color, letterSpacing: '2px', lineHeight: 1.1, marginTop: 4 }}>{c.value}</div>
          {c.sub && <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.45rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TABLA DE CAJA
═══════════════════════════════════════════ */
function TablaCaja({ lotes, semanaCerrada, precioBoleto, rifaId, onAbono, onEditar, onHistorial, onEliminar, onTogglePago, onVerNums }) {
  if (!lotes.length) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', padding: '40px 0', letterSpacing: '2px' }}>
        SIN VENDEDORES EN ESTA SEMANA
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lotes.map(lote => (
        <FilaLote key={lote.id} lote={lote} semanaCerrada={semanaCerrada} precioBoleto={precioBoleto} rifaId={rifaId}
          onAbono={onAbono} onEditar={onEditar} onHistorial={onHistorial}
          onEliminar={onEliminar} onTogglePago={onTogglePago} onVerNums={onVerNums} />
      ))}
    </div>
  );
}

/* ── Fila individual ── */
function FilaLote({ lote, semanaCerrada, precioBoleto, rifaId, onAbono, onEditar, onHistorial, onEliminar, onTogglePago, onVerNums }) {
  const [expanded, setExpanded] = useState(false);
  const est = ESTADO_CFG[lote.estado] || ESTADO_CFG.pendiente;
  const numsAsignados   = parseNums(lote.numeros_asignados);
  const numsVendidosPub = lote.numeros_vendidos_publico || [];
  const numsPendientes  = numsAsignados.filter(n => !numsVendidosPub.includes(n));
  const numsVendidos    = numsAsignados.filter(n => numsVendidosPub.includes(n));
  const progPct = pct(lote.abono || 0, lote.por_pagar || 0);

  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: `1px solid ${est.border}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexWrap: 'wrap' }}>

        {/* Toggle pago */}
        <button
          onClick={() => !semanaCerrada && onTogglePago(lote)}
          disabled={semanaCerrada}
          title={lote.estado === 'pagado' ? 'Clic para marcar pendiente' : 'Clic para marcar pagado'}
          style={{ background: est.bg, border: `1.5px solid ${est.border}`, color: est.color, borderRadius: 6, padding: '3px 8px', cursor: semanaCerrada ? 'default' : 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', letterSpacing: '1px', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all .15s', userSelect: 'none' }}>
          {est.icon} {est.label}
        </button>

        {/* Nombre */}
        <div style={{ flex: 1, minWidth: 130 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.92rem', color: 'var(--jordyn-text)', fontWeight: 600, lineHeight: 1.1 }}>
            {lote.vendedor_nombre}
          </div>
          {lote.direccion && (
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 1 }}>
              📍 {lote.direccion}
            </div>
          )}
        </div>

        {lote.numeros_fijos && (
          <span style={{ background: 'rgba(124,58,237,.12)', border: '1px solid rgba(124,58,237,.3)', color: '#a78bfa', borderRadius: 4, padding: '2px 7px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', letterSpacing: '1px', flexShrink: 0 }}>
            🔒 FIJOS
          </span>
        )}

        {/* Montos */}
        <div style={{ display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
          {[
            ['POR PAGAR', COP(lote.por_pagar), 'var(--jordyn-text)'],
            ['COBRADO',   COP(lote.abono),     '#06d6a0'],
            ['DEUDA',     COP(lote.pendiente), lote.pendiente > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Números */}
        {numsAsignados.length > 0 && (
          <button onClick={() => onVerNums(lote)}
            style={{ background: 'rgba(245,197,24,.06)', border: '1px solid rgba(245,197,24,.2)', color: 'var(--jordyn-primary)', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
            🎟 {numsAsignados.length}
            {numsVendidos.length > 0 && <span style={{ color: '#06d6a0' }}> ✓{numsVendidos.length}</span>}
            {numsPendientes.length > 0 && <span style={{ color: '#e63946' }}> ⏳{numsPendientes.length}</span>}
          </button>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {/* Botón COBRAR — lleva a la pantalla de cobro por número */}
          <a
            href={rifaId ? `/caja/rifa?rifa=${rifaId}` : '#'}
            style={{ background: 'rgba(245,197,24,.08)', border: '1px solid rgba(245,197,24,.3)', color: 'var(--jordyn-primary)', borderRadius: 5, padding: '4px 9px', cursor: 'pointer', fontSize: '.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            title="Ir a cobro por número"
          >
            <i className="bi bi-coin" />
          </a>
          {!semanaCerrada && (
            <button onClick={() => onAbono(lote)} title="Registrar abono"
              style={{ background: 'rgba(6,214,160,.08)', border: '1px solid rgba(6,214,160,.25)', color: '#06d6a0', borderRadius: 5, padding: '4px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
              <i className="bi bi-plus-circle" />
            </button>
          )}
          <button onClick={() => onHistorial(lote)} title="Historial"
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-clock-history" />
          </button>
          {!semanaCerrada && (
            <>
              <button onClick={() => onEditar(lote)} title="Editar"
                style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                <i className="bi bi-pencil" />
              </button>
              <button onClick={() => onEliminar(lote)} title="Eliminar"
                style={{ background: 'rgba(230,57,70,.06)', border: '1px solid rgba(230,57,70,.2)', color: '#e63946', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
                <i className="bi bi-trash3" />
              </button>
            </>
          )}
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className={`bi bi-chevron-${expanded ? 'up' : 'down'}`} />
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ height: 3, background: 'var(--jordyn-bg)', margin: '0 14px' }}>
        <div style={{ height: '100%', width: `${Math.min(progPct, 100)}%`, background: progPct >= 100 ? '#06d6a0' : 'var(--jordyn-primary)', transition: 'width .4s', borderRadius: 2 }} />
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--jordyn-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              ['ENTREGADOS', lote.cant_entregados, 'var(--jordyn-muted)'],
              ['VENDIDOS',   lote.cant_vendidos,   'var(--jordyn-primary)'],
              ['% COBRADO',  `${progPct}%`,         progPct >= 100 ? '#06d6a0' : '#ffc107'],
            ].map(([k, v, c]) => (
              <div key={k}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>{k}</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.95rem', color: c, letterSpacing: '2px' }}>{v}</div>
              </div>
            ))}
          </div>

          {numsPendientes.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#e63946', letterSpacing: '2px', marginBottom: 6 }}>⏳ NÚMEROS PENDIENTES ({numsPendientes.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {numsPendientes.map(n => (
                  <span key={n} style={{ background: 'rgba(230,57,70,.1)', border: '1px solid rgba(230,57,70,.25)', color: '#e63946', borderRadius: 4, padding: '2px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700 }}>
                    {String(n).padStart(3, '0')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {numsVendidos.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#06d6a0', letterSpacing: '2px', marginBottom: 6 }}>✅ VENDIDOS PANTALLA PÚBLICA ({numsVendidos.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {numsVendidos.map(n => (
                  <span key={n} style={{ background: 'rgba(6,214,160,.1)', border: '1px solid rgba(6,214,160,.25)', color: '#06d6a0', borderRadius: 4, padding: '2px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700 }}>
                    {String(n).padStart(3, '0')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lote.observacion && (
            <div style={{ background: 'var(--jordyn-bg)', borderRadius: 6, padding: '8px 12px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)' }}>
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
      <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', padding: '40px 0', letterSpacing: '2px' }}>
        SIN ZONAS REGISTRADAS
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
      {zonas.map(z => {
        const cobPct = pct(Number(z.cobrado), Number(z.por_cobrar));
        return (
          <div key={z.zona} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: 'var(--jordyn-primary)', letterSpacing: '3px', marginBottom: 8 }}>{z.zona}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['Vendedores', z.lotes,          'var(--jordyn-muted)'],
                ['Entregados', z.entregados,      'var(--jordyn-muted)'],
                ['Vendidos',   z.vendidos,        'var(--jordyn-primary)'],
                ['Por cobrar', COP(z.por_cobrar), 'var(--jordyn-text)'],
                ['Cobrado',    COP(z.cobrado),    '#06d6a0'],
                ['Pendiente',  COP(z.pendiente),  '#e63946'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)' }}>{k}</span>
                  <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.8rem', color: c, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, height: 4, background: 'var(--jordyn-bg)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(cobPct, 100)}%`, background: cobPct >= 100 ? '#06d6a0' : 'var(--jordyn-primary)', borderRadius: 2, transition: 'width .4s' }} />
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', marginTop: 4, textAlign: 'right' }}>{cobPct}% cobrado</div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: NÚMEROS PENDIENTES
═══════════════════════════════════════════ */
function ModalNumerosPendientes({ lote, onClose }) {
  const numsAsignados   = parseNums(lote.numeros_asignados);
  const numsVendidosPub = lote.numeros_vendidos_publico || [];
  const numsPendientes  = numsAsignados.filter(n => !numsVendidosPub.includes(n));
  const numsVendidos    = numsAsignados.filter(n => numsVendidosPub.includes(n));

  return (
    <ModalBase title={`NÚMEROS — ${lote.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--jordyn-bg)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            ['TOTAL', numsAsignados.length, 'var(--jordyn-text)'],
            ['VENDIDOS', numsVendidos.length, '#06d6a0'],
            ['PENDIENTES', numsPendientes.length, '#e63946'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.45rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: c, letterSpacing: '3px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>
        {numsPendientes.length > 0 && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#e63946', letterSpacing: '2px', marginBottom: 8 }}>⏳ PENDIENTES — NO VENDIDOS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {numsPendientes.map(n => (
                <span key={n} style={{ background: 'rgba(230,57,70,.12)', border: '1px solid rgba(230,57,70,.3)', color: '#e63946', borderRadius: 5, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700 }}>
                  {String(n).padStart(3, '0')}
                </span>
              ))}
            </div>
          </div>
        )}
        {numsVendidos.length > 0 && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#06d6a0', letterSpacing: '2px', marginBottom: 8 }}>✅ VENDIDOS — PANTALLA PÚBLICA</div>
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
          <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', padding: '20px 0' }}>Sin números asignados</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CERRAR</button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: LOTE
═══════════════════════════════════════════ */
function ModalLote({ lote, semanaId, onClose, onSave }) {
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
      await onSave({ ...form, cant_entregados: Number(form.cant_entregados) || 0, cant_vendidos: Number(form.cant_vendidos) || 0, abono: Number(form.abono) || 0, semana_id: semanaId });
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
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.numeros_fijos ? 'var(--jordyn-primary)' : 'var(--jordyn-border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
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
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>Separados por comas o en rango (001-050)</div>
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
        <div style={{ background: 'var(--jordyn-bg)', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['Por pagar', COP(lote.por_pagar), 'var(--jordyn-text)'],
            ['Cobrado',   COP(lote.abono),     '#06d6a0'],
            ['Pendiente', COP(lote.pendiente), '#e63946'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        <div>
          <label className="jd-label">MONTO DEL ABONO *</label>
          <input className="jd-input" type="number" min="1" value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={`Máx: ${COP(lote.pendiente)}`} autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {[lote.pendiente, Math.round(lote.pendiente / 2), Math.round(lote.pendiente / 4)].filter(v => v > 0).map(v => (
              <button key={v} onClick={() => setMonto(String(v))}
                style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
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
   MODAL: HISTORIAL
═══════════════════════════════════════════ */
function ModalHistorial({ lote, onClose, onDeleteAbono }) {
  const abonos = lote?.abonos_historial || [];
  return (
    <ModalBase title={`HISTORIAL — ${lote.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'var(--jordyn-bg)', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['Por pagar',     COP(lote.por_pagar), 'var(--jordyn-text)'],
            ['Total abonado', COP(lote.abono),     '#06d6a0'],
            ['Pendiente',     COP(lote.pendiente), lote.pendiente > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        {abonos.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', padding: '20px 0' }}>Sin abonos registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {abonos.map((a, i) => (
              <div key={a.id} style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', minWidth: 20 }}>{i + 1}.</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#06d6a0', letterSpacing: '2px' }}>{COP(a.monto)}</div>
                  {a.nota && <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)' }}>{a.nota}</div>}
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 10, padding: 24, width: '100%', maxWidth: wide ? 660 : 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: 'var(--jordyn-primary)', letterSpacing: '3px' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer', fontSize: '1.1rem' }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}