// ============================================================
//   RIFAS JORDYN — Caja.js (v5 — Remodelación completa)
//   - Muestra vendedores de la rifa activa con sus números
//   - Precio al 50% aplicado automáticamente
//   - Números arrancan en VERDE (todos asignados = vendidos por defecto)
//   - Solo se marca ROJO si al cuadrar un número no jugó / no pagaron
//   - Contabilidad en tiempo real: baja al marcar no pagado
//   - Sin zonas, solo vendedores de la rifa
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

const fmtFecha = f => {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas',
  });
};

const fmtHoraSorteo = h => {
  if (!h) return null;
  const s = String(h).slice(0, 5);
  const [hh, mm] = s.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hh12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(hh12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

/* ════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function Caja() {
  const [rifaActiva,   setRifaActiva]   = useState(null);
  const [vendedores,   setVendedores]   = useState([]);
  const [porcentaje,   setPorcentaje]   = useState(50);
  const [precioPorNum, setPrecioPorNum] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [loadingVends, setLoadingVends] = useState(false);
  const [buscar,       setBuscar]       = useState('');
  // Estado local de pagos: { 'vendedorId|numero|serie': true/false }
  const [pagosLocal,   setPagosLocal]   = useState({});
  const [guardando,    setGuardando]    = useState({});
  // cuadreLocal: { vendedorId: true|false } — persiste en BD via PUT /cuadre/:vendedorId
  const [cuadreLocal,  setCuadreLocal]  = useState({});
  const [guardandoCuadre, setGuardandoCuadre] = useState({});
  const [modalDeudas,        setModalDeudas]        = useState(false);
  const [deudasVencidas,     setDeudasVencidas]     = useState([]);
  const [deudasConfirmadas,  setDeudasConfirmadas]  = useState(false);
  const [deudasAnteriores,   setDeudasAnteriores]   = useState([]);
  const [modalAbono,         setModalAbono]         = useState(null);
  const [modalHistorial,     setModalHistorial]     = useState(null);
  const [detalleSemana,      setDetalleSemana]      = useState(null);

  /* ── Carga rifa activa ── */
  const cargarRifa = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get('/caja/rifa-activa');
      setRifaActiva(r.data.rifa || null);
      setDeudasAnteriores(r.data.deudas_anteriores || []);
      if (r.data.deudas_vencidas?.length > 0 && !deudasConfirmadas) {
        setDeudasVencidas(r.data.deudas_vencidas);
        setModalDeudas(true);
      }
      if (r.data.semana) {
        setDetalleSemana(r.data.semana);
      }
      if (r.data.rifa?.id) {
        await cargarVendedores(r.data.rifa.id, 50);
      }
    } catch {
      toast.error('Error cargando caja');
    } finally {
      setLoading(false);
    }
  }, [deudasConfirmadas]); // eslint-disable-line

  const cargarVendedores = async (rifaId, pct) => {
    setLoadingVends(true);
    try {
      const r = await API.get(`/caja/rifas/${rifaId}/cobro-vendedores?porcentaje=${pct}`);
      setVendedores(r.data.vendedores || []);
      setPrecioPorNum(r.data.precio_boleto_efectivo || 0);
      setPorcentaje(r.data.porcentaje || pct);
      // Inicializar estado local:
      // Verde (true) por defecto — todos los números asignados ya están vendidos.
      // Solo quedan rojos los que fueron marcados explícitamente como no pagados (pagado=false en BD).
      const map = {};
      const cuadreMap = {};
      for (const v of (r.data.vendedores || [])) {
        for (const n of (v.numeros || [])) {
          map[`${v.vendedor_id}|${n.numero}|${n.serie}`] = n.pagado !== false;
        }
        // Cargar estado de cuadre desde el servidor
        cuadreMap[v.vendedor_id] = v.cuadrado || false;
      }
      setPagosLocal(map);
      setCuadreLocal(cuadreMap);
    } catch {
      toast.error('Error cargando vendedores');
    } finally {
      setLoadingVends(false);
    }
  };

  useEffect(() => { cargarRifa(); }, []); // eslint-disable-line

  /* ── Toggle número (verde ↔ rojo) ── */
  const handleToggleNumero = async (vendedorId, rifaId, numero, serie, estadoActual) => {
    const key = `${vendedorId}|${numero}|${serie}`;
    const nuevoPagado = !estadoActual;

    // Optimistic update
    setPagosLocal(prev => ({ ...prev, [key]: nuevoPagado }));
    setGuardando(prev => ({ ...prev, [key]: true }));

    try {
      await API.post(`/caja/rifas/${rifaId}/cobro-vendedores/${vendedorId}/pagar-numero`, {
        numero,
        serie,
        pagado: nuevoPagado,
      });
    } catch {
      // Revertir si falla
      setPagosLocal(prev => ({ ...prev, [key]: estadoActual }));
      toast.error('Error actualizando número');
    } finally {
      setGuardando(prev => ({ ...prev, [key]: false }));
    }
  };

  /* ── Toggle cuadre de vendedor (persiste en BD) ── */
  const handleToggleCuadre = async (vendedorId, estadoActual) => {
    if (!rifaActiva?.id) return;
    const nuevo = !estadoActual;
    // Optimistic update
    setCuadreLocal(prev => ({ ...prev, [vendedorId]: nuevo }));
    setGuardandoCuadre(prev => ({ ...prev, [vendedorId]: true }));
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cuadre/${vendedorId}`, { cuadrado: nuevo });
    } catch {
      // Revertir si falla
      setCuadreLocal(prev => ({ ...prev, [vendedorId]: estadoActual }));
      toast.error('Error guardando estado de cuadre');
    } finally {
      setGuardandoCuadre(prev => ({ ...prev, [vendedorId]: false }));
    }
  };

  /* ── Cambiar porcentaje ── */
  const handleCambiarPct = async (nuevoPct) => {
    if (!rifaActiva?.id) return;
    setPorcentaje(nuevoPct);
    await cargarVendedores(rifaActiva.id, nuevoPct);
    // Guardar en backend
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cobro-vendedores/porcentaje`, { porcentaje: nuevoPct });
    } catch {}
  };

  /* ── Calcular totales en tiempo real usando pagosLocal ── */
  const calcularTotalesVendedor = (vendedor) => {
    const nums = vendedor.numeros || [];
    let pagados = 0;
    for (const n of nums) {
      const key = `${vendedor.vendedor_id}|${n.numero}|${n.serie}`;
      if (pagosLocal[key] === true) pagados++;
    }
    const total       = nums.length;
    const noPagados   = total - pagados;
    const deuda       = +(precioPorNum * noPagados).toFixed(2);
    const cobrado     = +(precioPorNum * pagados).toFixed(2);
    const totalCobrar = +(precioPorNum * total).toFixed(2);
    return { total, pagados, noPagados, deuda, cobrado, totalCobrar };
  };

  /* ── Totales globales ── */
  const totalesGlobales = (() => {
    let totalCobrar = 0, totalDeuda = 0, totalCobrado = 0;
    for (const v of vendedores) {
      const t = calcularTotalesVendedor(v);
      totalCobrar  += t.totalCobrar;
      totalDeuda   += t.deuda;
      totalCobrado += t.cobrado;
    }
    return { totalCobrar, totalDeuda, totalCobrado };
  })();

  /* ── Filtro búsqueda ── */
  const vendedoresFiltrados = buscar.trim()
    ? vendedores.filter(v => v.vendedor_nombre?.toLowerCase().includes(buscar.toLowerCase()))
    : vendedores;

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

      {/* ══ MODAL: DEUDAS VENCIDAS ══ */}
      {modalDeudas && (
        <ModalDeudasVencidas
          deudas={deudasVencidas}
          onConfirmar={() => { setModalDeudas(false); setDeudasConfirmadas(true); }}
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
              La caja se activa automáticamente cuando existe una rifa activa.<br />
              Crea o activa una rifa desde <strong>Gestión de Rifas</strong>.
            </div>
          </div>
        )}

        {/* ══ RIFA ACTIVA ══ */}
        {rifaActiva && (
          <>
            {/* Banner rifa */}
            <BannerRifaActiva rifa={rifaActiva} />

            {/* Deudas anteriores */}
            {deudasAnteriores.length > 0 && (
              <SeccionDeudasAnteriores
                deudas={deudasAnteriores}
                onSaldar={async deuda => {
                  if (!window.confirm(`¿Marcar la deuda de ${deuda.vendedor_nombre} como saldada?`)) return;
                  try {
                    await API.put(`/caja/lotes/${deuda.lote_id}/saldar-deuda-anterior`);
                    setDeudasAnteriores(prev => prev.filter(d => d.lote_id !== deuda.lote_id));
                    toast.success(`Deuda de ${deuda.vendedor_nombre} saldada`);
                  } catch { toast.error('Error al saldar deuda'); }
                }}
              />
            )}

            {/* ── Resumen global ── */}
            <ResumenGlobal
              totales={totalesGlobales}
              totalVendedores={vendedores.length}
              porcentaje={porcentaje}
              onCambiarPct={handleCambiarPct}
              precioPorNum={precioPorNum}
              rifaPrecio={rifaActiva.precio}
            />

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="jd-input"
                placeholder="🔍 Buscar vendedor..."
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                style={{ maxWidth: 220, fontSize: '.8rem', padding: '.35rem .7rem' }}
              />
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', marginLeft: 'auto' }}>
                {vendedoresFiltrados.length} de {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''}
              </div>
              <button
                className="btn-jordyn-outline"
                style={{ fontSize: '.8rem', padding: '5px 12px' }}
                onClick={() => cargarVendedores(rifaActiva.id, porcentaje)}
              >
                <i className="bi bi-arrow-clockwise me-1" />ACTUALIZAR
              </button>
            </div>

            {/* ── Lista de vendedores ── */}
            {loadingVends ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="jd-spinner" style={{ width: 36, height: 36 }} />
              </div>
            ) : vendedoresFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', letterSpacing: '2px' }}>
                {vendedores.length === 0
                  ? 'ESTA RIFA NO TIENE VENDEDORES ASIGNADOS'
                  : `SIN RESULTADOS PARA "${buscar}"`}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendedoresFiltrados.map(v => (
                  <TarjetaVendedor
                    key={v.vendedor_id}
                    vendedor={v}
                    rifaId={rifaActiva.id}
                    precioPorNum={precioPorNum}
                    pagosLocal={pagosLocal}
                    guardando={guardando}
                    esSim={rifaActiva.tipo === 'simultanea'}
                    cuadrado={cuadreLocal[v.vendedor_id] || false}
                    guardandoCuadre={guardandoCuadre[v.vendedor_id] || false}
                    calcularTotales={() => calcularTotalesVendedor(v)}
                    onToggleNumero={(numero, serie, estadoActual) =>
                      handleToggleNumero(v.vendedor_id, rifaActiva.id, numero, serie, estadoActual)
                    }
                    onToggleCuadre={() => handleToggleCuadre(v.vendedor_id, cuadreLocal[v.vendedor_id] || false)}
                    onAbono={() => setModalAbono(v)}
                    onHistorial={() => setModalHistorial(v)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ MODALES ══ */}
      {modalAbono && (
        <ModalAbono
          vendedor={modalAbono}
          precioPorNum={precioPorNum}
          calcularTotales={() => calcularTotalesVendedor(modalAbono)}
          detalleSemana={detalleSemana}
          onClose={() => setModalAbono(null)}
          onSave={async ({ lote_id, monto, nota }) => {
            await API.post('/caja/abonos', { lote_id, monto, nota });
            toast.success(`Abono de ${COP(monto)} registrado`);
            setModalAbono(null);
          }}
        />
      )}

      {modalHistorial && (
        <ModalHistorialVendedor
          vendedor={modalHistorial}
          precioPorNum={precioPorNum}
          calcularTotales={() => calcularTotalesVendedor(modalHistorial)}
          onClose={() => setModalHistorial(null)}
        />
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
      background: 'linear-gradient(135deg, var(--jordyn-bg2), rgba(10,191,188,0.04))',
      border: '1px solid rgba(10,191,188,0.2)',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', letterSpacing: '2px' }}>
            🟢 EN CURSO
          </span>
          {rifa.tipo === 'simultanea' && (
            <span style={{ background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.25)', color: '#a78bfa', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', letterSpacing: '1px' }}>
              ⚡ SIMULTÁNEA
            </span>
          )}
          {diasRestantes !== null && (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: diasRestantes <= 3 ? '#e63946' : 'var(--jordyn-muted)', letterSpacing: '1px' }}>
              {diasRestantes > 0 ? `${diasRestantes} días para el sorteo` : 'SORTEO HOY'}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.5rem', color: 'var(--jordyn-primary)', letterSpacing: '3px', lineHeight: 1 }}>
          {rifa.nombre}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>
          {COP(rifa.precio)}/boleto · Sorteo: {fmtFecha(rifa.fecha_sorteo)}
          {fmtHoraSorteo(rifa.hora_sorteo) && ` · 🕐 ${fmtHoraSorteo(rifa.hora_sorteo)}`}
          {rifa.loteria_ref && ` · ${rifa.loteria_ref}`}
        </div>
      </div>
      {rifa.premio && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>PREMIO</div>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: 'var(--jordyn-text)', letterSpacing: '2px' }}>{rifa.premio}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   RESUMEN GLOBAL
═══════════════════════════════════════════ */
function ResumenGlobal({ totales, totalVendedores, porcentaje, onCambiarPct, precioPorNum, rifaPrecio }) {
  const [editandoPct, setEditandoPct] = useState(false);
  const [pctInput,    setPctInput]    = useState(String(porcentaje));

  const handleGuardarPct = () => {
    const v = parseInt(pctInput);
    if (!v || v < 1 || v > 100) { toast.error('Porcentaje entre 1 y 100'); return; }
    setEditandoPct(false);
    onCambiarPct(v);
  };

  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, padding: '14px 18px' }}>
      {/* Cards de totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'TOTAL A COBRAR', value: COP(totales.totalCobrar),  color: 'var(--jordyn-primary)', icon: 'bi-cash' },
          { label: 'YA COBRADO',     value: COP(totales.totalCobrado), color: '#06d6a0',               icon: 'bi-check2-circle' },
          { label: 'PENDIENTE',      value: COP(totales.totalDeuda),   color: '#e63946',               icon: 'bi-exclamation-circle' },
          { label: 'VENDEDORES',     value: totalVendedores,           color: 'var(--jordyn-text)',    icon: 'bi-people' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 9, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{c.label}</div>
              <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.75rem', opacity: .4 }} />
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: c.color, letterSpacing: '2px', lineHeight: 1.1, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Config porcentaje */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: 'rgba(124,58,237,0.05)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.15)' }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: 'var(--jordyn-muted)', letterSpacing: '1px', flex: 1 }}>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>% COBRO:</span> El precio por número es{' '}
          <strong style={{ color: 'var(--jordyn-primary)' }}>{COP(precioPorNum)}</strong>
          {rifaPrecio && <span> ({porcentaje}% de {COP(rifaPrecio)})</span>}
        </div>
        {editandoPct ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number" min="1" max="100"
              value={pctInput}
              onChange={e => setPctInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuardarPct()}
              style={{ width: 60, padding: '4px 8px', border: '1.5px solid #a78bfa', borderRadius: 6, fontFamily: "'Share Tech Mono',monospace", fontSize: '.78rem', fontWeight: 700, textAlign: 'center', color: 'var(--jordyn-text)', background: '#fff' }}
              autoFocus
            />
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', color: 'var(--jordyn-muted)' }}>%</span>
            <button onClick={handleGuardarPct} style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700, fontFamily: 'inherit' }}>OK</button>
            <button onClick={() => { setEditandoPct(false); setPctInput(String(porcentaje)); }} style={{ background: 'transparent', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '.72rem' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => onCambiarPct(p)}
                style={{ background: p === porcentaje ? '#7c3aed' : '#fff', border: `1.5px solid ${p === porcentaje ? '#7c3aed' : 'rgba(124,58,237,0.25)'}`, color: p === porcentaje ? '#fff' : '#7c3aed', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', fontWeight: 700 }}>
                {p}%
              </button>
            ))}
            <button onClick={() => { setEditandoPct(true); setPctInput(String(porcentaje)); }}
              style={{ background: 'transparent', border: '1px dashed rgba(124,58,237,0.3)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '.65rem', fontFamily: "'Share Tech Mono',monospace" }}>
              <i className="bi bi-pencil" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TARJETA DE VENDEDOR — con números interactivos
═══════════════════════════════════════════ */
function TarjetaVendedor({ vendedor, rifaId, precioPorNum, pagosLocal, guardando, esSim, cuadrado: cuadradoProp, guardandoCuadre, calcularTotales, onToggleNumero, onToggleCuadre, onAbono, onHistorial }) {
  const [expandida, setExpandida] = useState(false);
  const t = calcularTotales();

  const numsPorSerie = { A: [], B: [] };
  for (const n of (vendedor.numeros || [])) {
    const serie = n.serie || 'A';
    if (!numsPorSerie[serie]) numsPorSerie[serie] = [];
    numsPorSerie[serie].push(n);
  }

  const pctCobrado = t.totalCobrar > 0 ? Math.round((t.cobrado / t.totalCobrar) * 100) : 0;

  // Color del avatar
  const avatarColor = (() => {
    const paleta = [
      'linear-gradient(135deg,#7c3aed,#a855f7)',
      'linear-gradient(135deg,#0abfbc,#22d3d0)',
      'linear-gradient(135deg,#f59e0b,#fbbf24)',
      'linear-gradient(135deg,#06d6a0,#10b981)',
      'linear-gradient(135deg,#ec4899,#f472b6)',
      'linear-gradient(135deg,#3b82f6,#60a5fa)',
    ];
    let h = 0;
    const s = vendedor.vendedor_nombre || '';
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return paleta[h % paleta.length];
  })();

  const estadoColor = t.deuda === 0 ? '#06d6a0' : t.cobrado > 0 ? '#f59e0b' : '#e63946';
  const estadoLabel = t.deuda === 0 ? 'PAGADO' : t.cobrado > 0 ? 'PARCIAL' : 'PENDIENTE';

  // ── Indicador visual de cuadre ──
  // cuadradoProp = estado guardado en BD (el usuario lo confirmó manualmente)
  // Si fue confirmado en BD → siempre verde aunque quede deuda calculada
  // Si no fue confirmado → se basa en la deuda calculada en tiempo real
  const cuadrado = cuadradoProp;            // ✅ confirmado en BD
  const debiendo = !cuadradoProp && t.deuda > 0;  // 🚨 no confirmado Y tiene deuda

  return (
    <div style={{
      background: 'var(--jordyn-bg2)',
      border: `2px solid ${cuadrado ? 'rgba(6,214,160,0.5)' : t.cobrado > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(230,57,70,0.25)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color .25s, box-shadow .25s',
      boxShadow: cuadrado
        ? '0 0 0 3px rgba(6,214,160,0.10)'
        : debiendo
          ? '0 0 0 3px rgba(230,57,70,0.07)'
          : 'none',
    }}>

      {/* ══ BANNER DE ALERTA — solo visual ══ */}
      {debiendo && (
        <div style={{
          background: 'linear-gradient(90deg, #7c0a14, #e63946)',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          animation: 'none',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#fff', fontWeight: 700, letterSpacing: '1px' }}>
              {vendedor.vendedor_nombre.split(' ')[0].toUpperCase()} NO HA PAGADO COMPLETO
            </span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.95rem', color: '#ffd6d9', letterSpacing: '2px', marginLeft: 10 }}>
              — DEBE {COP(t.deuda)}
            </span>
          </div>
          <span style={{ fontSize: '.85rem', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>⚠</span>
        </div>
      )}

      {/* ══ BANNER CUADRADO ══ */}
      {cuadrado && t.total > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, #064e3b, #059669)',
          padding: '5px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: '.95rem' }}>✅</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#d1fae5', fontWeight: 700, letterSpacing: '1px' }}>
            {vendedor.vendedor_nombre.split(' ')[0].toUpperCase()} — CUADRADO · PAGÓ {COP(t.totalCobrar)}
          </span>
        </div>
      )}

      {/* ── Cabecera ── */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
        onClick={() => setExpandida(e => !e)}>

        {/* Avatar — con ícono de estado encima */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {(vendedor.vendedor_nombre || '?').charAt(0).toUpperCase()}
          </div>
          {/* Indicador de estado en la esquina del avatar */}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 16, height: 16, borderRadius: '50%',
            background: cuadrado ? '#06d6a0' : debiendo ? '#e63946' : '#f59e0b',
            border: '2px solid var(--jordyn-bg2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '.45rem',
          }}>
            {cuadrado ? '✓' : '!'}
          </div>
        </div>

        {/* Nombre + estado */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', color: 'var(--jordyn-text)', fontWeight: 600, lineHeight: 1.1 }}>
            {vendedor.vendedor_nombre}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ background: `${estadoColor}18`, border: `1px solid ${estadoColor}40`, color: estadoColor, borderRadius: 4, padding: '1px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', letterSpacing: '1px', fontWeight: 700 }}>
              {cuadrado ? '✅ CUADRADO' : estadoLabel}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>
              {t.total} número{t.total !== 1 ? 's' : ''} · {t.noPagados} no pagaron
            </span>
          </div>
        </div>

        {/* Montos */}
        <div style={{ display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>TOTAL A COBRAR</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.05rem', color: 'var(--jordyn-text)', letterSpacing: '2px', lineHeight: 1 }}>{COP(t.totalCobrar)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>DEUDA</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: t.deuda > 0 ? '#e63946' : '#06d6a0', letterSpacing: '2px', lineHeight: 1 }}>{COP(t.deuda)}</div>
          </div>
        </div>

        {/* Botones acción */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>

          {/* BOTÓN CONFIRMAR / DESCONFIRMAR CUADRE */}
          <button
            onClick={onToggleCuadre}
            disabled={guardandoCuadre}
            title={cuadrado ? 'Cuadre confirmado — Click para desconfirmar' : 'Confirmar cuadre con este vendedor'}
            style={{
              background: cuadrado
                ? 'linear-gradient(135deg, #059669, #06d6a0)'
                : 'rgba(5,150,105,0.07)',
              border: `1.5px solid ${cuadrado ? 'rgba(6,214,160,0.6)' : 'rgba(5,150,105,0.3)'}`,
              color: cuadrado ? '#fff' : '#059669',
              borderRadius: 6,
              padding: '5px 12px',
              cursor: guardandoCuadre ? 'wait' : 'pointer',
              fontSize: '.72rem',
              fontFamily: "'Share Tech Mono',monospace",
              fontWeight: 700,
              letterSpacing: '.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              opacity: guardandoCuadre ? 0.6 : 1,
              transition: 'all .2s',
              whiteSpace: 'nowrap',
            }}
          >
            {guardandoCuadre
              ? <><span className="jd-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> GUARDANDO</>
              : cuadrado
                ? <><i className="bi bi-check2-circle" /> CUADRADO</>
                : <><i className="bi bi-check-circle" /> CONFIRMAR</>}
          </button>

          <button onClick={onAbono} title="Registrar abono"
            style={{ background: 'rgba(6,214,160,.08)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-plus-circle" />
          </button>
          <button onClick={onHistorial} title="Historial"
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-clock-history" />
          </button>
          <button onClick={() => setExpandida(e => !e)}
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className={`bi bi-chevron-${expandida ? 'up' : 'down'}`} />
          </button>
        </div>
      </div>

      {/* Barra progreso */}
      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', margin: '0 0' }}>
        <div style={{ height: '100%', width: `${Math.min(pctCobrado, 100)}%`, background: pctCobrado >= 100 ? '#06d6a0' : 'var(--jordyn-primary)', transition: 'width .5s', borderRadius: 2 }} />
      </div>

      {/* ── Panel expandido: grid de números ── */}
      {expandida && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--jordyn-border)', background: 'rgba(0,0,0,0.01)' }}>

          {/* Instrucción */}
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: 'rgba(6,214,160,0.12)', border: '1px solid rgba(6,214,160,0.3)', color: '#06d6a0', borderRadius: 4, padding: '1px 8px', fontSize: '.48rem', fontWeight: 700 }}>VERDE = JUGÓ / PAGA</span>
            <span style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', color: '#e63946', borderRadius: 4, padding: '1px 8px', fontSize: '.48rem', fontWeight: 700 }}>ROJO = NO JUGÓ / NO PAGÓ</span>
            <span style={{ opacity: .6 }}>· Toca un número para cambiarlo</span>
          </div>

          {/* Números por serie (en simultáneas se agrupan) */}
          {esSim ? (
            ['A', 'B'].map(serie => {
              const nums = numsPorSerie[serie] || [];
              if (!nums.length) return null;
              return (
                <div key={serie} style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', fontWeight: 800, letterSpacing: '1px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: serie === 'A' ? '#f0f5ff' : '#fff0f5', border: `1px solid ${serie === 'A' ? '#4361ee30' : '#e91e8c30'}`, color: serie === 'A' ? '#4361ee' : '#e91e8c', borderRadius: 4, padding: '2px 9px', fontWeight: 900 }}>SERIE {serie}</span>
                    <span style={{ color: 'var(--jordyn-muted)' }}>{nums.length} número{nums.length !== 1 ? 's' : ''}</span>
                    <span style={{ color: '#06d6a0', marginLeft: 'auto' }}>
                      {nums.filter(n => pagosLocal[`${vendedor.vendedor_id}|${n.numero}|${n.serie}`] !== false).length} jugaron
                    </span>
                  </div>
                  <GridNumeros
                    numeros={nums}
                    vendedorId={vendedor.vendedor_id}
                    pagosLocal={pagosLocal}
                    guardando={guardando}
                    onToggle={(numero, serie, actual) => onToggleNumero(numero, serie, actual)}
                  />
                </div>
              );
            })
          ) : (
            <GridNumeros
              numeros={vendedor.numeros || []}
              vendedorId={vendedor.vendedor_id}
              pagosLocal={pagosLocal}
              guardando={guardando}
              onToggle={(numero, serie, actual) => onToggleNumero(numero, serie, actual)}
            />
          )}

          {/* Resumen contable */}
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--jordyn-bg)', borderRadius: 8, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                ['TOTAL', COP(t.totalCobrar), 'var(--jordyn-text)'],
                ['COBRADO', COP(t.cobrado), '#06d6a0'],
                ['DEUDA', COP(t.deuda), t.deuda > 0 ? '#e63946' : '#06d6a0'],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>{k}</div>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)' }}>
              {pctCobrado}% cobrado
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   GRID DE NÚMEROS INTERACTIVOS
═══════════════════════════════════════════ */
function GridNumeros({ numeros, vendedorId, pagosLocal, guardando, onToggle }) {
  if (!numeros.length) {
    return (
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', fontStyle: 'italic', padding: '8px 0' }}>
        Sin números asignados
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {numeros.map(n => {
        const key    = `${vendedorId}|${n.numero}|${n.serie}`;
        const pagado = pagosLocal[key] === true;
        const saving = guardando[key] === true;
        const esExtra = n.origen === 'extra';

        return (
          <button
            key={`${n.numero}-${n.serie}`}
            type="button"
            onClick={() => !saving && onToggle(n.numero, n.serie, pagado)}
            disabled={saving}
            title={`${n.numero}${n.serie ? ` (${n.serie})` : ''} — ${pagado ? 'JUGÓ / PAGA · Click para marcar que NO pagó' : 'NO PAGÓ · Click para marcar que sí pagó'}`}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              background: saving
                ? 'rgba(180,180,180,0.15)'
                : pagado
                  ? 'linear-gradient(135deg, #06d6a0, #059669)'
                  : 'linear-gradient(135deg, #e63946, #c0303a)',
              border: `2px solid ${saving ? 'rgba(180,180,180,0.3)' : pagado ? 'rgba(6,214,160,0.5)' : 'rgba(230,57,70,0.5)'}`,
              borderRadius: 8,
              padding: '5px 6px',
              cursor: saving ? 'wait' : 'pointer',
              minWidth: 46,
              transition: 'all .15s ease',
              opacity: saving ? 0.6 : 1,
              transform: saving ? 'scale(0.95)' : 'scale(1)',
              boxShadow: pagado && !saving ? '0 2px 8px rgba(6,214,160,0.3)' : !pagado && !saving ? '0 2px 8px rgba(230,57,70,0.2)' : 'none',
              userSelect: 'none',
            }}
          >
            {saving ? (
              <span style={{ fontSize: '.7rem', color: '#aaa' }}>⟳</span>
            ) : (
              <>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontWeight: 900, fontSize: '.78rem', color: '#fff', letterSpacing: 1, lineHeight: 1 }}>
                  {n.numero}
                </span>
                {esExtra && (
                  <span style={{ fontSize: '.45rem', color: 'rgba(255,255,255,0.8)', fontFamily: "'Share Tech Mono',monospace", letterSpacing: 0.5, lineHeight: 1 }}>
                    EXTRA
                  </span>
                )}
                <span style={{ fontSize: '.5rem', color: 'rgba(255,255,255,0.75)', fontFamily: "'Share Tech Mono',monospace", lineHeight: 1 }}>
                  {pagado ? '✓ JUGÓ' : '✗ NO JUGÓ'}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: ABONO
═══════════════════════════════════════════ */
function ModalAbono({ vendedor, precioPorNum, calcularTotales, detalleSemana, onClose, onSave }) {
  const [monto,   setMonto]   = useState('');
  const [nota,    setNota]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [loteId,  setLoteId]  = useState(null);
  const [loadingLote, setLoadingLote] = useState(true);
  const t = calcularTotales();

  useEffect(() => {
    // Buscar el lote_id del vendedor en la semana activa
    if (!detalleSemana?.id || !vendedor?.vendedor_id) { setLoadingLote(false); return; }
    API.get(`/caja/semanas/${detalleSemana.id}`).then(r => {
      const lote = (r.data.lotes || []).find(l => l.vendedor_id === vendedor.vendedor_id);
      setLoteId(lote?.id || null);
    }).catch(() => {}).finally(() => setLoadingLote(false));
  }, [detalleSemana, vendedor]);

  const handleSave = async () => {
    if (!monto || Number(monto) <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!loteId) { toast.error('No se encontró el lote del vendedor'); return; }
    setSaving(true);
    try { await onSave({ lote_id: loteId, monto: Number(monto), nota }); }
    finally { setSaving(false); }
  };

  return (
    <ModalBase title={`REGISTRAR ABONO — ${vendedor.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--jordyn-bg)', borderRadius: 7, padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['Total a cobrar', COP(t.totalCobrar), 'var(--jordyn-text)'],
            ['Cobrado',        COP(t.cobrado),     '#06d6a0'],
            ['Deuda',          COP(t.deuda),       '#e63946'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        {loadingLote ? (
          <div style={{ textAlign: 'center', padding: 16 }}><div className="jd-spinner" style={{ width: 24, height: 24 }} /></div>
        ) : !loteId ? (
          <div style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: '.75rem', color: '#e63946', fontFamily: "'Share Tech Mono',monospace" }}>
            ⚠ Este vendedor no tiene un lote de caja asignado. Los abonos manuales requieren un lote.
          </div>
        ) : (
          <>
            <div>
              <label className="jd-label">MONTO DEL ABONO *</label>
              <input className="jd-input" type="number" min="1" value={monto} onChange={e => setMonto(e.target.value)}
                placeholder={`Deuda: ${COP(t.deuda)}`} autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[t.deuda, Math.round(t.deuda / 2)].filter(v => v > 0).map(v => (
                  <button key={v} onClick={() => setMonto(String(v))}
                    style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
                    {COP(v)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="jd-label">NOTA (opcional)</label>
              <input className="jd-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: Pago en efectivo..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
              <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
                {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : 'REGISTRAR ABONO'}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: HISTORIAL VENDEDOR
═══════════════════════════════════════════ */
function ModalHistorialVendedor({ vendedor, precioPorNum, calcularTotales, onClose }) {
  const t = calcularTotales();

  const numsA  = (vendedor.numeros || []).filter(n => (n.serie || 'A') === 'A');
  const numsB  = (vendedor.numeros || []).filter(n => n.serie === 'B');
  const esSim  = numsB.length > 0;

  return (
    <ModalBase title={`DETALLE — ${vendedor.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Totales */}
        <div style={{ background: 'var(--jordyn-bg)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            ['Total números',  t.total,              'var(--jordyn-text)'],
            ['Jugaron/Pagaron', t.pagados,            '#06d6a0'],
            ['No pagan',       t.noPagados,           '#e63946'],
            ['Total a cobrar', COP(t.totalCobrar),   'var(--jordyn-primary)'],
            ['Cobrado',        COP(t.cobrado),        '#06d6a0'],
            ['Deuda',          COP(t.deuda),          t.deuda > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Listado números */}
        {esSim ? (
          ['A', 'B'].map(serie => {
            const nums = serie === 'A' ? numsA : numsB;
            if (!nums.length) return null;
            return (
              <div key={serie}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', letterSpacing: '2px', marginBottom: 8, color: serie === 'A' ? '#4361ee' : '#e91e8c', fontWeight: 800 }}>
                  SERIE {serie} — {nums.length} NÚMEROS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {nums.map(n => {
                    const pagado = n.pagado;
                    return (
                      <span key={`${n.numero}-${n.serie}`} style={{ background: pagado ? 'rgba(6,214,160,0.12)' : 'rgba(230,57,70,0.1)', border: `1px solid ${pagado ? 'rgba(6,214,160,0.3)' : 'rgba(230,57,70,0.25)'}`, color: pagado ? '#06d6a0' : '#e63946', borderRadius: 5, padding: '3px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', fontWeight: 700 }}>
                        {n.numero} {pagado ? '✓' : '✗'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', letterSpacing: '2px', marginBottom: 8, color: 'var(--jordyn-muted)', fontWeight: 800 }}>
              NÚMEROS ({vendedor.numeros?.length || 0})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {(vendedor.numeros || []).map(n => {
                const pagado = n.pagado;
                return (
                  <span key={`${n.numero}-${n.serie}`} style={{ background: pagado ? 'rgba(6,214,160,0.12)' : 'rgba(230,57,70,0.1)', border: `1px solid ${pagado ? 'rgba(6,214,160,0.3)' : 'rgba(230,57,70,0.25)'}`, color: pagado ? '#06d6a0' : '#e63946', borderRadius: 5, padding: '3px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', fontWeight: 700 }}>
                    {n.numero} {pagado ? '✓' : '✗'}
                  </span>
                );
              })}
            </div>
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
   SECCIÓN: DEUDAS ANTERIORES
═══════════════════════════════════════════ */
function SeccionDeudasAnteriores({ deudas, onSaldar }) {
  const [expandida, setExpandida] = useState(false);
  const totalDeuda = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);

  return (
    <div style={{ border: '1px solid rgba(230,57,70,.35)', borderRadius: 10, overflow: 'hidden', background: 'rgba(230,57,70,.03)' }}>
      <button onClick={() => setExpandida(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(230,57,70,.07)', border: 'none', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#e63946', letterSpacing: '3px', lineHeight: 1 }}>
              DEUDAS ANTERIORES — {deudas.length} VENDEDOR{deudas.length !== 1 ? 'ES' : ''}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
              Total: {COP(totalDeuda)}
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
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.9rem', color: 'var(--jordyn-text)', fontWeight: 600 }}>{d.vendedor_nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>Rifa: {d.rifa_nombre}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: '#e63946', letterSpacing: '2px' }}>{COP(d.monto_pendiente)}</div>
              </div>
              <button onClick={() => onSaldar(d)}
                style={{ background: 'rgba(6,214,160,.08)', border: '1.5px solid rgba(6,214,160,.35)', color: '#06d6a0', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', letterSpacing: '1px' }}>
                ✅ SALDAR
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: DEUDAS VENCIDAS
═══════════════════════════════════════════ */
function ModalDeudasVencidas({ deudas, onConfirmar }) {
  const total = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--jordyn-bg)', border: '1px solid rgba(230,57,70,.4)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '4px' }}>RIFA VENCIDA — DEUDA PENDIENTE</div>
        </div>
        {deudas.map((d, i) => (
          <div key={i} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.88rem', color: 'var(--jordyn-text)', fontWeight: 600 }}>{d.vendedor_nombre}</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#e63946', letterSpacing: '2px' }}>{COP(d.monto_pendiente)}</div>
          </div>
        ))}
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '3px', textAlign: 'right', marginTop: 12, marginBottom: 20 }}>
          TOTAL: {COP(total)}
        </div>
        <button onClick={onConfirmar} className="btn-jordyn" style={{ width: '100%', fontSize: '.82rem' }}>
          ENTENDIDO — CONTINUAR
        </button>
      </div>
    </div>
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