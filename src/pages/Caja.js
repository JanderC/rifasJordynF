// ============================================================
//   RIFAS JORDYN — Caja.js (v6 — Refactorización: Sin grilla de números)
//   - Los números se usan SOLO para calcular el total a cobrar
//   - Botón VENTA: el dueño ingresa manualmente el monto que recibió
//   - Botón ABONAR: descuenta de la deuda del vendedor
//   - Sin toggle de números individuales — cuadre es por monto, no por número
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
  // ── Selector de rifa ──
  const [rifasDisponibles, setRifasDisponibles] = useState([]);
  const [rifaActiva,       setRifaActiva]       = useState(null);
  const [loadingRifas,     setLoadingRifas]     = useState(true);

  // ── Datos de caja ──
  const [vendedores,   setVendedores]   = useState([]);
  const [porcentaje,   setPorcentaje]   = useState(50);
  const [precioPorNum, setPrecioPorNum] = useState(0);
  const [loadingVends, setLoadingVends] = useState(false);
  const [buscar,       setBuscar]       = useState('');

  // ── Estado de cuadre por vendedor ──
  const [cuadreLocal,     setCuadreLocal]     = useState({});
  const [guardandoCuadre, setGuardandoCuadre] = useState({});

  // ── Deudas / modales ──
  const [modalDeudas,       setModalDeudas]       = useState(false);
  const [deudasVencidas,    setDeudasVencidas]    = useState([]);
  const [deudasConfirmadas, setDeudasConfirmadas] = useState(false);
  const [deudasAnteriores,  setDeudasAnteriores]  = useState([]);
  const [detalleSemana,     setDetalleSemana]     = useState(null);

  // ── Modales de cobro ──
  const [modalVenta,   setModalVenta]   = useState(null); // vendedor para registrar venta
  const [modalAbono,   setModalAbono]   = useState(null); // vendedor para abonar
  const [modalDetalle, setModalDetalle] = useState(null); // historial / detalle

  // ── Mapa de pagos de lotes: vendedorId → { por_pagar, abono, pendiente, lote_id } ──
  const [lotesMap, setLotesMap] = useState({});

  /* ── Carga lista de rifas ── */
  useEffect(() => {
    (async () => {
      setLoadingRifas(true);
      try {
        const r = await API.get('/rifas');
        const activas = (r.data || []).filter(rf => rf.activa && rf.estado !== 'archivada');
        setRifasDisponibles(activas);
        try {
          const ra = await API.get('/caja/rifa-activa');
          setDeudasAnteriores(ra.data.deudas_anteriores || []);
          if (ra.data.deudas_vencidas?.length > 0 && !deudasConfirmadas) {
            setDeudasVencidas(ra.data.deudas_vencidas);
            setModalDeudas(true);
          }
          if (ra.data.semana) setDetalleSemana(ra.data.semana);
        } catch {}
        if (activas.length === 1) setRifaActiva(activas[0]);
      } catch {
        toast.error('Error cargando rifas');
      } finally {
        setLoadingRifas(false);
      }
    })();
  }, []); // eslint-disable-line

  /* ── Al seleccionar una rifa, limpiar y cargar vendedores ── */
  useEffect(() => {
    if (!rifaActiva?.id) return;
    setBuscar('');
    setCuadreLocal({});
    setVendedores([]);
    setLotesMap({});
    cargarVendedores(rifaActiva.id, 50);
  }, [rifaActiva?.id]); // eslint-disable-line

  const cargarVendedores = async (rifaId, pct) => {
    setLoadingVends(true);
    try {
      // 1. Vendedores con sus números (para calcular total a cobrar)
      const bolRes  = await API.get(`/rifas/${rifaId}/boleteria-vendedores`);
      // 2. Precio y cuadre
      const pagosRes = await API.get(`/caja/rifas/${rifaId}/cobro-vendedores?porcentaje=${pct}`).catch(() => null);

      const precioEfectivo = pagosRes?.data?.precio_boleto_efectivo || 0;
      setPrecioPorNum(precioEfectivo);
      setPorcentaje(pagosRes?.data?.porcentaje || pct);

      // Mapa de cuadre
      const cuadreMap = {};
      for (const v of (pagosRes?.data?.vendedores || [])) {
        cuadreMap[v.vendedor_id] = v.cuadrado || false;
      }

      // Construir vendedores — guardamos los números internamente para el cálculo
      const vends = (bolRes.data.vendedores || []).map(v => {
        const numeros = (v.numeros_fijos || []).map(n => ({
          numero: String(n.numero).padStart(3, '0'),
          serie:  n.serie || 'A',
          origen: n.origen || 'fijo',
        }));
        return {
          vendedor_id:     v.vendedor_id,
          vendedor_nombre: v.vendedor_nombre,
          cedula:          v.cedula,
          numeros,        // usados solo para contar
          cuadrado:        cuadreMap[v.vendedor_id] || false,
        };
      });

      setVendedores(vends);
      setCuadreLocal(cuadreMap);

      // 3. Cargar los lotes de la semana para obtener por_pagar / abono / pendiente
      if (detalleSemana?.id) {
        await cargarLotes(detalleSemana.id, vends);
      } else {
        // Intentar obtener la semana
        try {
          const ra = await API.get('/caja/rifa-activa');
          if (ra.data.semana) {
            setDetalleSemana(ra.data.semana);
            await cargarLotes(ra.data.semana.id, vends);
          }
        } catch {}
      }
    } catch (err) {
      toast.error('Error cargando vendedores');
      console.error(err);
    } finally {
      setLoadingVends(false);
    }
  };

  const cargarLotes = async (semanaId, vends) => {
    try {
      const r = await API.get(`/caja/semanas/${semanaId}`);
      const lotes = r.data.lotes || [];
      const map = {};
      for (const lote of lotes) {
        if (lote.vendedor_id) {
          map[lote.vendedor_id] = {
            lote_id:    lote.id,
            por_pagar:  Number(lote.por_pagar  || 0),
            abono:      Number(lote.abono      || 0),
            pendiente:  Number(lote.pendiente  || 0),
            estado:     lote.estado,
          };
        }
      }
      setLotesMap(map);
    } catch {}
  };

  /* ── Calcular totales de un vendedor usando precioPorNum × cantidad ── */
  const calcularTotalesVendedor = useCallback((vendedor, precioOverride) => {
    const precio    = precioOverride ?? precioPorNum;
    const cantidad  = (vendedor.numeros || []).length;
    const totalCobrar = +(precio * cantidad).toFixed(2);

    // Monto cobrado / deuda vienen del lote real (más fidedigno)
    const lote      = lotesMap[vendedor.vendedor_id];
    const cobrado   = lote ? lote.abono      : 0;
    const deuda     = lote ? lote.pendiente  : totalCobrar;

    return { cantidad, totalCobrar, cobrado, deuda };
  }, [precioPorNum, lotesMap]);

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

  /* ── Toggle cuadre ── */
  const handleToggleCuadre = async (vendedorId, estadoActual) => {
    if (!rifaActiva?.id) return;
    const nuevo = !estadoActual;
    setCuadreLocal(prev => ({ ...prev, [vendedorId]: nuevo }));
    setGuardandoCuadre(prev => ({ ...prev, [vendedorId]: true }));
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cuadre/${vendedorId}`, { cuadrado: nuevo });
    } catch {
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
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cobro-vendedores/porcentaje`, { porcentaje: nuevoPct });
    } catch {}
  };

  /* ── Guardar venta (monto recibido del vendedor) ── */
  const handleGuardarVenta = async ({ lote_id, monto, nota }) => {
    await API.post('/caja/abonos', { lote_id, monto, nota: nota || 'Venta' });
    toast.success(`Venta de ${COP(monto)} registrada`);
    setModalVenta(null);
    // Refrescar lotes
    if (detalleSemana?.id) await cargarLotes(detalleSemana.id, vendedores);
  };

  /* ── Guardar abono ── */
  const handleGuardarAbono = async ({ lote_id, monto, nota }) => {
    await API.post('/caja/abonos', { lote_id, monto, nota: nota || 'Abono' });
    toast.success(`Abono de ${COP(monto)} registrado`);
    setModalAbono(null);
    if (detalleSemana?.id) await cargarLotes(detalleSemana.id, vendedores);
  };

  /* ── Filtro búsqueda ── */
  const vendedoresFiltrados = buscar.trim()
    ? vendedores.filter(v => v.vendedor_nombre?.toLowerCase().includes(buscar.toLowerCase()))
    : vendedores;

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
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

        {/* ══ SELECTOR DE RIFA ══ */}
        <SelectorRifa
          rifas={rifasDisponibles}
          rifaSeleccionada={rifaActiva}
          loading={loadingRifas}
          onSeleccionar={rifa => setRifaActiva(rifa)}
        />

        {/* ══ SIN RIFAS ACTIVAS ══ */}
        {!loadingRifas && rifasDisponibles.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
            <div style={{ fontSize: '3rem', opacity: .25 }}>🎟</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.6rem', color: 'var(--jordyn-muted)', letterSpacing: '4px' }}>
              SIN RIFAS ACTIVAS
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', letterSpacing: '2px', textAlign: 'center', maxWidth: 380, lineHeight: 1.8 }}>
              Crea o activa una rifa desde <strong>Gestión de Rifas</strong>.
            </div>
          </div>
        )}

        {/* ══ CONTENIDO DE LA RIFA SELECCIONADA ══ */}
        {rifaActiva && (
          <>
            <BannerRifaActiva rifa={rifaActiva} />

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
                onClick={() => rifaActiva?.id && cargarVendedores(rifaActiva.id, porcentaje)}
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
                    precioPorNum={precioPorNum}
                    lote={lotesMap[v.vendedor_id] || null}
                    cuadrado={cuadreLocal[v.vendedor_id] || false}
                    guardandoCuadre={guardandoCuadre[v.vendedor_id] || false}
                    calcularTotales={() => calcularTotalesVendedor(v)}
                    onToggleCuadre={() => handleToggleCuadre(v.vendedor_id, cuadreLocal[v.vendedor_id] || false)}
                    onVenta={() => setModalVenta(v)}
                    onAbono={() => setModalAbono(v)}
                    onDetalle={() => setModalDetalle(v)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ MODALES ══ */}
      {modalVenta && (
        <ModalVenta
          vendedor={modalVenta}
          lote={lotesMap[modalVenta.vendedor_id] || null}
          precioPorNum={precioPorNum}
          onClose={() => setModalVenta(null)}
          onSave={handleGuardarVenta}
        />
      )}

      {modalAbono && (
        <ModalAbono
          vendedor={modalAbono}
          lote={lotesMap[modalAbono.vendedor_id] || null}
          precioPorNum={precioPorNum}
          onClose={() => setModalAbono(null)}
          onSave={handleGuardarAbono}
        />
      )}

      {modalDetalle && (
        <ModalDetalleVendedor
          vendedor={modalDetalle}
          lote={lotesMap[modalDetalle.vendedor_id] || null}
          precioPorNum={precioPorNum}
          calcularTotales={() => calcularTotalesVendedor(modalDetalle)}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </Layout>
  );
}

/* ═══════════════════════════════════════════
   SELECTOR DE RIFA
═══════════════════════════════════════════ */
function SelectorRifa({ rifas, rifaSeleccionada, loading, onSeleccionar }) {
  const fmtFechaCorta = f => {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', timeZone: 'America/Caracas',
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10 }}>
        <div className="jd-spinner" style={{ width: 18, height: 18, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>
          CARGANDO RIFAS...
        </span>
      </div>
    );
  }

  if (!rifas.length || rifas.length === 1) return null;

  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1.5px solid rgba(124,58,237,0.25)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-collection-fill" />
        SELECCIONAR RIFA A CUADRAR
        <span style={{ color: 'var(--jordyn-muted)', fontWeight: 400, marginLeft: 4 }}>· {rifas.length} rifas activas</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rifas.map(rifa => {
          const seleccionada = rifaSeleccionada?.id === rifa.id;
          return (
            <button key={rifa.id} type="button" onClick={() => onSeleccionar(rifa)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: seleccionada ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.06))' : '#fff', border: `2px solid ${seleccionada ? '#7c3aed' : 'var(--jordyn-border)'}`, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s', boxShadow: seleccionada ? '0 2px 12px rgba(124,58,237,0.15)' : 'none' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: seleccionada ? '#7c3aed' : 'var(--jordyn-border)', border: `2px solid ${seleccionada ? '#7c3aed' : 'var(--jordyn-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {seleccionada && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', fontWeight: 700, color: seleccionada ? '#7c3aed' : 'var(--jordyn-text)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rifa.nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>🏆 {rifa.premio}</span>
                  <span>📅 {fmtFechaCorta(rifa.fecha_sorteo)}</span>
                  {rifa.tipo === 'simultanea' && <span style={{ color: '#a78bfa' }}>⚡ Simultánea</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>PRECIO</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: seleccionada ? '#7c3aed' : 'var(--jordyn-text)', letterSpacing: '2px', lineHeight: 1 }}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(rifa.precio || 0)}
                </div>
              </div>
              {seleccionada && (
                <div style={{ background: '#7c3aed', color: '#fff', borderRadius: 6, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', fontWeight: 700, letterSpacing: '1px', flexShrink: 0 }}>
                  ✓ ACTIVA
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
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
    <div style={{ background: 'linear-gradient(135deg, var(--jordyn-bg2), rgba(10,191,188,0.04))', border: '1px solid rgba(10,191,188,0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', letterSpacing: '2px' }}>🟢 EN CURSO</span>
          {rifa.tipo === 'simultanea' && (
            <span style={{ background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.25)', color: '#a78bfa', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', letterSpacing: '1px' }}>⚡ SIMULTÁNEA</span>
          )}
          {diasRestantes !== null && (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: diasRestantes <= 3 ? '#e63946' : 'var(--jordyn-muted)', letterSpacing: '1px' }}>
              {diasRestantes > 0 ? `${diasRestantes} días para el sorteo` : 'SORTEO HOY'}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.5rem', color: 'var(--jordyn-primary)', letterSpacing: '3px', lineHeight: 1 }}>{rifa.nombre}</div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>
          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(rifa.precio || 0)}/boleto · Sorteo: {fmtFecha(rifa.fecha_sorteo)}
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
            <input type="number" min="1" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuardarPct()}
              style={{ width: 60, padding: '4px 8px', border: '1.5px solid #a78bfa', borderRadius: 6, fontFamily: "'Share Tech Mono',monospace", fontSize: '.78rem', fontWeight: 700, textAlign: 'center', color: 'var(--jordyn-text)', background: '#fff' }}
              autoFocus />
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
   TARJETA DE VENDEDOR — sin grid de números
═══════════════════════════════════════════ */
function TarjetaVendedor({ vendedor, precioPorNum, lote, cuadrado, guardandoCuadre, calcularTotales, onToggleCuadre, onVenta, onAbono, onDetalle }) {
  const t = calcularTotales();

  // Color del avatar por nombre
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

  const pctCobrado = t.totalCobrar > 0 ? Math.round((t.cobrado / t.totalCobrar) * 100) : 0;
  const estadoColor = t.deuda <= 0 ? '#06d6a0' : t.cobrado > 0 ? '#f59e0b' : '#e63946';
  const estadoLabel = t.deuda <= 0 ? 'PAGADO' : t.cobrado > 0 ? 'PARCIAL' : 'PENDIENTE';
  const debiendo    = !cuadrado && t.deuda > 0;

  return (
    <div style={{
      background: 'var(--jordyn-bg2)',
      border: `2px solid ${cuadrado ? 'rgba(6,214,160,0.5)' : t.cobrado > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(230,57,70,0.25)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color .25s, box-shadow .25s',
      boxShadow: cuadrado ? '0 0 0 3px rgba(6,214,160,0.10)' : debiendo ? '0 0 0 3px rgba(230,57,70,0.07)' : 'none',
    }}>

      {/* Banner alerta */}
      {debiendo && (
        <div style={{ background: 'linear-gradient(90deg, #7c0a14, #e63946)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#fff', fontWeight: 700, letterSpacing: '1px' }}>
              {vendedor.vendedor_nombre.split(' ')[0].toUpperCase()} NO HA PAGADO COMPLETO
            </span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.95rem', color: '#ffd6d9', letterSpacing: '2px', marginLeft: 10 }}>
              — DEBE {COP(t.deuda)}
            </span>
          </div>
        </div>
      )}

      {/* Banner cuadrado */}
      {cuadrado && t.cantidad > 0 && (
        <div style={{ background: 'linear-gradient(90deg, #064e3b, #059669)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.95rem' }}>✅</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#d1fae5', fontWeight: 700, letterSpacing: '1px' }}>
            {vendedor.vendedor_nombre.split(' ')[0].toUpperCase()} — CUADRADO · PAGÓ {COP(t.totalCobrar)}
          </span>
        </div>
      )}

      {/* Cabecera */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {(vendedor.vendedor_nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: cuadrado ? '#06d6a0' : debiendo ? '#e63946' : '#f59e0b', border: '2px solid var(--jordyn-bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.45rem' }}>
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
              {t.cantidad} número{t.cantidad !== 1 ? 's' : ''} · {COP(precioPorNum)}/c.u.
            </span>
          </div>
        </div>

        {/* Montos clave */}
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

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>

          {/* BOTÓN VENTA — monto que me entregó */}
          <button onClick={onVenta}
            title="Registrar lo que me entregó el vendedor"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              border: 'none',
              color: '#fff',
              borderRadius: 7,
              padding: '6px 14px',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: '.68rem',
              fontWeight: 700,
              letterSpacing: '.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
            }}>
            <i className="bi bi-cash-coin" /> VENTA
          </button>

          {/* BOTÓN ABONAR — descuenta de la deuda */}
          <button onClick={onAbono}
            title="Registrar abono — descuenta de la deuda"
            style={{
              background: t.deuda > 0 ? 'linear-gradient(135deg, #059669, #06d6a0)' : 'rgba(6,214,160,.08)',
              border: t.deuda > 0 ? 'none' : '1.5px solid rgba(6,214,160,.35)',
              color: '#fff',
              borderRadius: 7,
              padding: '6px 14px',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: '.68rem',
              fontWeight: 700,
              letterSpacing: '.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              boxShadow: t.deuda > 0 ? '0 2px 8px rgba(6,214,160,0.25)' : 'none',
            }}>
            <i className="bi bi-plus-circle" /> ABONAR
          </button>

          {/* CONFIRMAR CUADRE */}
          <button onClick={onToggleCuadre} disabled={guardandoCuadre}
            title={cuadrado ? 'Cuadre confirmado — Click para desconfirmar' : 'Confirmar cuadre con este vendedor'}
            style={{ background: cuadrado ? 'linear-gradient(135deg, #059669, #06d6a0)' : 'rgba(5,150,105,0.07)', border: `1.5px solid ${cuadrado ? 'rgba(6,214,160,0.6)' : 'rgba(5,150,105,0.3)'}`, color: cuadrado ? '#fff' : '#059669', borderRadius: 6, padding: '5px 10px', cursor: guardandoCuadre ? 'wait' : 'pointer', fontSize: '.78rem', fontFamily: "'Share Tech Mono',monospace", fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, opacity: guardandoCuadre ? 0.6 : 1 }}>
            {guardandoCuadre
              ? <span className="jd-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
              : cuadrado ? <i className="bi bi-check2-circle" /> : <i className="bi bi-check-circle" />}
          </button>

          {/* DETALLE */}
          <button onClick={onDetalle} title="Ver detalle"
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-eye" />
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ height: 5, background: 'rgba(0,0,0,0.06)' }}>
        <div style={{ height: '100%', width: `${Math.min(pctCobrado, 100)}%`, background: pctCobrado >= 100 ? '#06d6a0' : 'var(--jordyn-primary)', transition: 'width .5s' }} />
      </div>

      {/* Resumen contable inferior */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--jordyn-border)', background: 'rgba(0,0,0,0.01)', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {[
            ['TOTAL',   COP(t.totalCobrar), 'var(--jordyn-text)'],
            ['COBRADO', COP(t.cobrado),     '#06d6a0'],
            ['DEUDA',   COP(t.deuda),       t.deuda > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)' }}>
          {pctCobrado}% cobrado
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: VENTA
   El dueño ingresa el monto que le entregó el vendedor.
   Se guarda como abono con nota "Venta".
═══════════════════════════════════════════ */
function ModalVenta({ vendedor, lote, precioPorNum, onClose, onSave }) {
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
  const [saving, setSaving] = useState(false);

  const totalCobrar = lote ? lote.por_pagar : +(precioPorNum * (vendedor.numeros?.length || 0)).toFixed(2);
  const yaAbonado   = lote ? lote.abono     : 0;
  const pendiente   = lote ? lote.pendiente : totalCobrar;

  const handleSave = async () => {
    if (!monto || Number(monto) <= 0) { toast.error('Ingresa el monto que te entregó'); return; }
    if (!lote?.lote_id) { toast.error('No se encontró el lote del vendedor'); return; }
    setSaving(true);
    try { await onSave({ lote_id: lote.lote_id, monto: Number(monto), nota: nota || 'Venta' }); }
    finally { setSaving(false); }
  };

  return (
    <ModalBase title={`REGISTRAR VENTA — ${vendedor.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Resumen */}
        <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700 }}>
            💰 COBRO DE ESTA RIFA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <InfoCard label="TOTAL A COBRAR" value={COP(totalCobrar)} color="var(--jordyn-text)" />
            <InfoCard label="YA COBRADO"     value={COP(yaAbonado)}   color="#06d6a0" />
            <InfoCard label="PENDIENTE"      value={COP(pendiente)}   color={pendiente > 0 ? '#e63946' : '#06d6a0'} />
          </div>
          {totalCobrar > 0 && (
            <div>
              <div style={{ height: 6, background: 'var(--jordyn-border)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${Math.min(100, (yaAbonado / totalCobrar) * 100)}%`, background: pendiente <= 0 ? '#06d6a0' : 'linear-gradient(90deg,#7c3aed,#06d6a0)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>
                {Math.min(100, Math.round((yaAbonado / totalCobrar) * 100))}% cobrado de {COP(totalCobrar)}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="jd-label">MONTO QUE ME ENTREGÓ *</label>
          <input className="jd-input" type="number" min="1"
            value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={`Ej: ${COP(pendiente)}`}
            autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          {/* Atajos */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {[pendiente, Math.round(pendiente / 2), Math.round(pendiente / 4)]
              .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
              .map(v => (
                <button key={v} type="button" onClick={() => setMonto(String(v))}
                  style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
                  {COP(v)}
                </button>
              ))}
          </div>
        </div>

        <div>
          <label className="jd-label">NOTA (opcional)</label>
          <input className="jd-input" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ej: Entregó en efectivo, transfirió..." />
        </div>

        {monto > 0 && (
          <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)' }}>
            Después de registrar → Deuda restante: <strong style={{ color: Math.max(0, pendiente - Number(monto)) > 0 ? '#e63946' : '#06d6a0', fontSize: '.75rem' }}>{COP(Math.max(0, pendiente - Number(monto)))}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', minWidth: 140 }}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-cash-coin me-1" />REGISTRAR VENTA</>}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: ABONAR
   Descuenta directamente de la deuda del vendedor.
═══════════════════════════════════════════ */
function ModalAbono({ vendedor, lote, precioPorNum, onClose, onSave }) {
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
  const [saving, setSaving] = useState(false);

  const totalCobrar = lote ? lote.por_pagar : +(precioPorNum * (vendedor.numeros?.length || 0)).toFixed(2);
  const yaAbonado   = lote ? lote.abono     : 0;
  const pendiente   = lote ? lote.pendiente : totalCobrar;

  const handleSave = async () => {
    if (!monto || Number(monto) <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!lote?.lote_id) { toast.error('No se encontró el lote del vendedor'); return; }
    setSaving(true);
    try { await onSave({ lote_id: lote.lote_id, monto: Number(monto), nota: nota || 'Abono' }); }
    finally { setSaving(false); }
  };

  return (
    <ModalBase title={`ABONAR A DEUDA — ${vendedor.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {!lote ? (
          <div style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: '.75rem', color: '#e63946', fontFamily: "'Share Tech Mono',monospace" }}>
            ⚠ Este vendedor no tiene un lote de caja asignado.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <InfoCard label="TOTAL A COBRAR" value={COP(totalCobrar)} color="var(--jordyn-text)" sub="histórico" />
              <InfoCard label="YA ABONADO"     value={COP(yaAbonado)}   color="#06d6a0"            sub="pagos acumulados" />
              <InfoCard label="DEUDA PENDIENTE" value={COP(pendiente)}  color={pendiente > 0 ? '#e63946' : '#06d6a0'} sub={pendiente <= 0 ? '✅ saldado' : 'baja con cada abono'} />
            </div>

            {totalCobrar > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>
                  <span>Progreso de cobro</span>
                  <span style={{ color: '#06d6a0', fontWeight: 700 }}>{Math.min(100, Math.round((yaAbonado / totalCobrar) * 100))}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--jordyn-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (yaAbonado / totalCobrar) * 100)}%`, background: pendiente <= 0 ? '#06d6a0' : 'linear-gradient(90deg,var(--jordyn-primary),#06d6a0)', borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            )}

            {pendiente > 0 ? (
              <>
                <div>
                  <label className="jd-label">MONTO DEL ABONO *</label>
                  <input className="jd-input" type="number" min="1" max={pendiente}
                    value={monto} onChange={e => setMonto(e.target.value)}
                    placeholder={`Máx: ${COP(pendiente)}`}
                    autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {[pendiente, Math.round(pendiente / 2), Math.round(pendiente / 4)]
                      .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                      .map(v => (
                        <button key={v} type="button" onClick={() => setMonto(String(v))}
                          style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
                          {COP(v)}
                        </button>
                      ))}
                  </div>
                </div>
                <div>
                  <label className="jd-label">NOTA (opcional)</label>
                  <input className="jd-input" value={nota} onChange={e => setNota(e.target.value)}
                    placeholder="Ej: Transferencia, efectivo..." />
                </div>

                {monto > 0 && (
                  <div style={{ background: 'rgba(6,214,160,0.05)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)' }}>
                    Después de abonar → Deuda restante: <strong style={{ color: Math.max(0, pendiente - Number(monto)) > 0 ? '#e63946' : '#06d6a0', fontSize: '.75rem' }}>{COP(Math.max(0, pendiente - Number(monto)))}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
                  <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-plus-circle me-1" />REGISTRAR ABONO</>}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>✅</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#06d6a0', letterSpacing: '3px' }}>DEUDA SALDADA</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>
                  Este vendedor no tiene deuda pendiente.
                </div>
                <button className="btn-jordyn-outline" onClick={onClose} style={{ marginTop: 16 }}>CERRAR</button>
              </div>
            )}
          </>
        )}
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: DETALLE VENDEDOR
═══════════════════════════════════════════ */
function ModalDetalleVendedor({ vendedor, lote, precioPorNum, calcularTotales, onClose }) {
  const t = calcularTotales();

  return (
    <ModalBase title={`DETALLE — ${vendedor.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Resumen de números */}
        <div style={{ background: 'var(--jordyn-bg)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700, marginBottom: 10 }}>
            📋 RESUMEN DE COBRO
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 8 }}>
            {[
              ['Números asignados', t.cantidad,          'var(--jordyn-text)'],
              ['Precio por número', COP(precioPorNum),   '#a78bfa'],
              ['Total a cobrar',    COP(t.totalCobrar),  'var(--jordyn-primary)'],
              ['Ya cobrado',        COP(t.cobrado),      '#06d6a0'],
              ['Deuda actual',      COP(t.deuda),        t.deuda > 0 ? '#e63946' : '#06d6a0'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '8px 10px' }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', letterSpacing: '1px', marginBottom: 3 }}>{k}</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cálculo explicado */}
        <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 8, padding: '12px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', lineHeight: 1.8 }}>
          <strong style={{ color: '#a78bfa' }}>CÁLCULO:</strong>{' '}
          {t.cantidad} números × {COP(precioPorNum)} = <strong style={{ color: 'var(--jordyn-primary)' }}>{COP(t.totalCobrar)}</strong>
          {lote && (
            <>
              <br />
              <strong style={{ color: '#06d6a0' }}>Abonado:</strong> {COP(lote.abono)} ·{' '}
              <strong style={{ color: t.deuda > 0 ? '#e63946' : '#06d6a0' }}>Pendiente: {COP(t.deuda)}</strong>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CERRAR</button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   SUBCOMPONENTE: INFO CARD
═══════════════════════════════════════════ */
function InfoCard({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color, letterSpacing: '2px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.4rem', color: 'var(--jordyn-muted)', marginTop: 3, opacity: .7 }}>{sub}</div>}
    </div>
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
      <div style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 10, padding: 24, width: '100%', maxWidth: wide ? 660 : 460, maxHeight: '90vh', overflowY: 'auto' }}>
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
}ue 