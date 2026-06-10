// ============================================================
//   RIFAS JORDYN — Caja.js (v7)
//   - Lotes cargados directo por rifa_id — sin race condition
//   - Botón VENTA: monto que entregó el vendedor
//   - Botón ABONAR: descuenta de la deuda
//   - Orden: primero los sin cuadrar, luego pendientes, luego cuadrados
//   - Filtros: TODOS / PENDIENTES / CUADRADOS
//   - Checkbox CUADRAR: confirma con el monto con que cerró
//   - Checkbox PENDIENTE: marca como prioritario y filtra
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
  const [rifasDisponibles, setRifasDisponibles] = useState([]);
  const [rifaActiva,       setRifaActiva]       = useState(null);
  const [loadingRifas,     setLoadingRifas]     = useState(true);

  const [vendedores,   setVendedores]   = useState([]);
  const [porcentaje,   setPorcentaje]   = useState(50);
  const [precioPorNum, setPrecioPorNum] = useState(0);
  const [loadingVends, setLoadingVends] = useState(false);
  const [buscar,       setBuscar]       = useState('');
  const [filtro,       setFiltro]       = useState('todos'); // 'todos' | 'pendientes' | 'cuadrados'

  // cuadreLocal: vendedorId → { cuadrado, pendiente_flag, monto_cuadrado }
  const [cuadreLocal,     setCuadreLocal]     = useState({});
  const [guardandoCuadre, setGuardandoCuadre] = useState({});

  const [modalDeudas,       setModalDeudas]       = useState(false);
  const [deudasVencidas,    setDeudasVencidas]    = useState([]);
  const [deudasConfirmadas, setDeudasConfirmadas] = useState(false);
  const [deudasAnteriores,  setDeudasAnteriores]  = useState([]);

  // lotesMap: vendedorId → { lote_id, por_pagar, abono, pendiente, estado }
  const [lotesMap,    setLotesMap]    = useState({});
  const [semanaId,    setSemanaId]    = useState(null);

  // Modales
  const [modalVenta,   setModalVenta]   = useState(null);
  const [modalAbono,   setModalAbono]   = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [modalCuadre,  setModalCuadre]  = useState(null); // vendedor al confirmar cuadre

  /* ── Carga inicial ── */
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
        } catch {}
        if (activas.length === 1) setRifaActiva(activas[0]);
      } catch {
        toast.error('Error cargando rifas');
      } finally {
        setLoadingRifas(false);
      }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!rifaActiva?.id) return;
    setBuscar('');
    setFiltro('todos');
    setCuadreLocal({});
    setVendedores([]);
    setLotesMap({});
    setSemanaId(null);
    cargarTodo(rifaActiva.id, 50);
  }, [rifaActiva?.id]); // eslint-disable-line

  /* ── Carga todo en un solo ciclo — sin race condition ── */
  const cargarTodo = async (rifaId, pct) => {
    setLoadingVends(true);
    try {
      // 1. Vendedores + precio
      const [bolRes, pagosRes, lotesRes] = await Promise.all([
        API.get(`/rifas/${rifaId}/boleteria-vendedores`),
        API.get(`/caja/rifas/${rifaId}/cobro-vendedores?porcentaje=${pct}`).catch(() => null),
        API.get(`/caja/rifas/${rifaId}/lotes-vendedores`).catch(() => null),
      ]);

      const precioEfectivo = pagosRes?.data?.precio_boleto_efectivo || 0;
      setPrecioPorNum(precioEfectivo);
      setPorcentaje(pagosRes?.data?.porcentaje || pct);

      // Mapa de cuadre desde BD
      const cuadreMap = {};
      for (const v of (pagosRes?.data?.vendedores || [])) {
        cuadreMap[v.vendedor_id] = {
          cuadrado:       v.cuadrado       || false,
          pendiente_flag: v.pendiente_flag || false,
          monto_cuadrado: v.monto_cuadrado || null,
        };
      }
      setCuadreLocal(cuadreMap);

      // Mapa de lotes (deuda real)
      const lMap = {};
      if (lotesRes?.data?.lotes) {
        for (const l of lotesRes.data.lotes) {
          if (l.vendedor_id) {
            lMap[l.vendedor_id] = {
              lote_id:   l.lote_id,
              por_pagar: Number(l.por_pagar || 0),
              abono:     Number(l.abono     || 0),
              pendiente: Number(l.pendiente || 0),
              estado:    l.estado,
            };
          }
        }
        if (lotesRes.data.semana_id) setSemanaId(lotesRes.data.semana_id);
      }
      setLotesMap(lMap);

      // Vendedores
      const vends = (bolRes.data.vendedores || []).map(v => ({
        vendedor_id:     v.vendedor_id,
        vendedor_nombre: v.vendedor_nombre,
        cedula:          v.cedula,
        numeros:         (v.numeros_fijos || []).map(n => ({
          numero: String(n.numero).padStart(3, '0'),
          serie:  n.serie || 'A',
        })),
      }));
      setVendedores(vends);
    } catch (err) {
      toast.error('Error cargando vendedores');
      console.error(err);
    } finally {
      setLoadingVends(false);
    }
  };

  const refrescarLotes = async (rifaId) => {
    try {
      const r = await API.get(`/caja/rifas/${rifaId || rifaActiva?.id}/lotes-vendedores`);
      if (!r.data?.lotes) return;
      const lMap = {};
      for (const l of r.data.lotes) {
        if (l.vendedor_id) {
          lMap[l.vendedor_id] = {
            lote_id:   l.lote_id,
            por_pagar: Number(l.por_pagar || 0),
            abono:     Number(l.abono     || 0),
            pendiente: Number(l.pendiente || 0),
            estado:    l.estado,
          };
        }
      }
      setLotesMap(lMap);
      if (r.data.semana_id) setSemanaId(r.data.semana_id);
    } catch {}
  };

  /* ── Totales de un vendedor ── */
  const calcularTotalesVendedor = useCallback((vendedor, precioOverride) => {
    const precio      = precioOverride ?? precioPorNum;
    const cantidad    = (vendedor.numeros || []).length;
    const totalCobrar = +(precio * cantidad).toFixed(2);
    const lote        = lotesMap[vendedor.vendedor_id];
    const cobrado     = lote ? lote.abono     : 0;
    const deuda       = lote ? lote.pendiente : totalCobrar;
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

  /* ── Guardar cuadre (desde modal de confirmación) ── */
  const handleGuardarCuadre = async (vendedorId, payload) => {
    if (!rifaActiva?.id) return;
    // payload: { cuadrado, pendiente_flag, monto_cuadrado, notas }
    setCuadreLocal(prev => ({ ...prev, [vendedorId]: { ...prev[vendedorId], ...payload } }));
    setGuardandoCuadre(prev => ({ ...prev, [vendedorId]: true }));
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cuadre/${vendedorId}`, payload);
    } catch {
      toast.error('Error guardando cuadre');
    } finally {
      setGuardandoCuadre(prev => ({ ...prev, [vendedorId]: false }));
    }
  };

  /* ── Cambiar porcentaje ── */
  const handleCambiarPct = async (nuevoPct) => {
    if (!rifaActiva?.id) return;
    setPorcentaje(nuevoPct);
    await cargarTodo(rifaActiva.id, nuevoPct);
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cobro-vendedores/porcentaje`, { porcentaje: nuevoPct });
    } catch {}
  };

  /* ── Guardar venta ── */
  const handleGuardarVenta = async ({ lote_id, monto, nota }) => {
    await API.post('/caja/abonos', { lote_id, monto, nota: nota || 'Venta' });
    toast.success(`Venta de ${COP(monto)} registrada`);
    setModalVenta(null);
    await refrescarLotes();
  };

  /* ── Guardar abono ── */
  const handleGuardarAbono = async ({ lote_id, monto, nota }) => {
    await API.post('/caja/abonos', { lote_id, monto, nota: nota || 'Abono' });
    toast.success(`Abono de ${COP(monto)} registrado`);
    setModalAbono(null);
    await refrescarLotes();
  };

  /* ── Ordenar y filtrar vendedores ──
     Orden: pendientes_flag primero, luego sin cuadrar con deuda, luego cuadrados
  */
  const vendedoresOrdenados = [...vendedores].sort((a, b) => {
    const ca = cuadreLocal[a.vendedor_id] || {};
    const cb = cuadreLocal[b.vendedor_id] || {};
    // Cuadrados van al final
    if (ca.cuadrado && !cb.cuadrado) return 1;
    if (!ca.cuadrado && cb.cuadrado) return -1;
    // Pendiente_flag al principio (dentro de los no cuadrados)
    if (ca.pendiente_flag && !cb.pendiente_flag) return -1;
    if (!ca.pendiente_flag && cb.pendiente_flag) return 1;
    return (a.vendedor_nombre || '').localeCompare(b.vendedor_nombre || '');
  });

  const vendedoresFiltrados = vendedoresOrdenados.filter(v => {
    const c = cuadreLocal[v.vendedor_id] || {};
    if (filtro === 'pendientes' && !c.pendiente_flag) return false;
    if (filtro === 'cuadrados'  && !c.cuadrado)       return false;
    if (buscar.trim() && !v.vendedor_nombre?.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const cuentas = {
    todos:      vendedores.length,
    pendientes: vendedores.filter(v => (cuadreLocal[v.vendedor_id] || {}).pendiente_flag).length,
    cuadrados:  vendedores.filter(v => (cuadreLocal[v.vendedor_id] || {}).cuadrado).length,
    sinCuadrar: vendedores.filter(v => !(cuadreLocal[v.vendedor_id] || {}).cuadrado).length,
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <Layout title="CAJA">

      {modalDeudas && (
        <ModalDeudasVencidas
          deudas={deudasVencidas}
          onConfirmar={() => { setModalDeudas(false); setDeudasConfirmadas(true); }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <SelectorRifa
          rifas={rifasDisponibles}
          rifaSeleccionada={rifaActiva}
          loading={loadingRifas}
          onSeleccionar={rifa => setRifaActiva(rifa)}
        />

        {!loadingRifas && rifasDisponibles.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
            <div style={{ fontSize: '3rem', opacity: .25 }}>🎟</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.6rem', color: 'var(--jordyn-muted)', letterSpacing: '4px' }}>SIN RIFAS ACTIVAS</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', letterSpacing: '2px', textAlign: 'center', maxWidth: 380, lineHeight: 1.8 }}>
              Crea o activa una rifa desde <strong>Gestión de Rifas</strong>.
            </div>
          </div>
        )}

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
              cuentas={cuentas}
              porcentaje={porcentaje}
              onCambiarPct={handleCambiarPct}
              precioPorNum={precioPorNum}
              rifaPrecio={rifaActiva.precio}
            />

            {/* ── Toolbar con filtros ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Filtros por estado */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: 3 }}>
                {[
                  { key: 'todos',      label: `TODOS (${cuentas.todos})`,           color: 'var(--jordyn-primary)' },
                  { key: 'pendientes', label: `⚡ PRIORITARIOS (${cuentas.pendientes})`, color: '#f59e0b' },
                  { key: 'cuadrados',  label: `✅ CUADRADOS (${cuentas.cuadrados})`,    color: '#06d6a0' },
                ].map(f => (
                  <button key={f.key} onClick={() => setFiltro(f.key)}
                    style={{ background: filtro === f.key ? f.color : 'transparent', color: filtro === f.key ? '#fff' : 'var(--jordyn-muted)', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700, letterSpacing: '.5px', transition: 'all .15s', whiteSpace: 'nowrap' }}>
                    {f.label}
                  </button>
                ))}
              </div>

              <input
                className="jd-input"
                placeholder="🔍 Buscar vendedor..."
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                style={{ maxWidth: 200, fontSize: '.8rem', padding: '.35rem .7rem' }}
              />
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', marginLeft: 'auto' }}>
                {vendedoresFiltrados.length} de {vendedores.length}
              </div>
              <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px' }}
                onClick={() => rifaActiva?.id && cargarTodo(rifaActiva.id, porcentaje)}>
                <i className="bi bi-arrow-clockwise me-1" />ACTUALIZAR
              </button>
            </div>

            {/* ── Lista ── */}
            {loadingVends ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="jd-spinner" style={{ width: 36, height: 36 }} />
              </div>
            ) : vendedoresFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', letterSpacing: '2px' }}>
                {vendedores.length === 0 ? 'ESTA RIFA NO TIENE VENDEDORES ASIGNADOS' : `SIN RESULTADOS`}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendedoresFiltrados.map(v => (
                  <TarjetaVendedor
                    key={v.vendedor_id}
                    vendedor={v}
                    precioPorNum={precioPorNum}
                    lote={lotesMap[v.vendedor_id] || null}
                    cuadre={cuadreLocal[v.vendedor_id] || {}}
                    guardandoCuadre={guardandoCuadre[v.vendedor_id] || false}
                    calcularTotales={() => calcularTotalesVendedor(v)}
                    onVenta={() => setModalVenta(v)}
                    onAbono={() => setModalAbono(v)}
                    onDetalle={() => setModalDetalle(v)}
                    onCuadrar={() => setModalCuadre(v)}
                    onTogglePendiente={async () => {
                      const actual = cuadreLocal[v.vendedor_id] || {};
                      await handleGuardarCuadre(v.vendedor_id, {
                        cuadrado:       actual.cuadrado       || false,
                        pendiente_flag: !actual.pendiente_flag,
                        monto_cuadrado: actual.monto_cuadrado || null,
                      });
                    }}
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
      {modalCuadre && (
        <ModalConfirmarCuadre
          vendedor={modalCuadre}
          lote={lotesMap[modalCuadre.vendedor_id] || null}
          cuadreActual={cuadreLocal[modalCuadre.vendedor_id] || {}}
          calcularTotales={() => calcularTotalesVendedor(modalCuadre)}
          onClose={() => setModalCuadre(null)}
          onGuardar={async (payload) => {
            await handleGuardarCuadre(modalCuadre.vendedor_id, payload);
            setModalCuadre(null);
          }}
        />
      )}
    </Layout>
  );
}

/* ═══════════════════════════════════════════
   TARJETA DE VENDEDOR
═══════════════════════════════════════════ */
function TarjetaVendedor({ vendedor, precioPorNum, lote, cuadre, guardandoCuadre, calcularTotales, onVenta, onAbono, onDetalle, onCuadrar, onTogglePendiente }) {
  const t = calcularTotales();
  const cuadrado      = cuadre.cuadrado       || false;
  const pendienteFlag = cuadre.pendiente_flag || false;

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
    for (let i = 0; i < (vendedor.vendedor_nombre || '').length; i++)
      h = (h * 31 + vendedor.vendedor_nombre.charCodeAt(i)) >>> 0;
    return paleta[h % paleta.length];
  })();

  const pctCobrado  = t.totalCobrar > 0 ? Math.round((t.cobrado / t.totalCobrar) * 100) : 0;
  const debiendo    = !cuadrado && t.deuda > 0;
  const estadoColor = cuadrado ? '#06d6a0' : pendienteFlag ? '#f59e0b' : t.deuda <= 0 ? '#06d6a0' : t.cobrado > 0 ? '#f59e0b' : '#e63946';
  const estadoLabel = cuadrado ? '✅ CUADRADO' : pendienteFlag ? '⚡ PRIORITARIO' : t.deuda <= 0 ? 'PAGADO' : t.cobrado > 0 ? 'PARCIAL' : 'PENDIENTE';

  return (
    <div style={{
      background: 'var(--jordyn-bg2)',
      border: `2px solid ${cuadrado ? 'rgba(6,214,160,0.5)' : pendienteFlag ? 'rgba(245,158,11,0.5)' : t.cobrado > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(230,57,70,0.2)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color .2s',
      boxShadow: pendienteFlag && !cuadrado ? '0 0 0 3px rgba(245,158,11,0.1)' : 'none',
    }}>

      {/* Banner deudor */}
      {debiendo && !pendienteFlag && (
        <div style={{ background: 'linear-gradient(90deg, #7c0a14, #e63946)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '.9rem', flexShrink: 0 }}>🚨</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#fff', fontWeight: 700 }}>
            {vendedor.vendedor_nombre.split(' ')[0].toUpperCase()} — DEBE <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.9rem', letterSpacing: '2px' }}>{COP(t.deuda)}</span>
          </span>
        </div>
      )}
      {pendienteFlag && !cuadrado && (
        <div style={{ background: 'linear-gradient(90deg, #92400e, #f59e0b)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.9rem' }}>⚡</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#fff', fontWeight: 700 }}>
            PRIORITARIO — PENDIENTE DE CUADRE · DEBE {COP(t.deuda)}
          </span>
        </div>
      )}
      {cuadrado && (
        <div style={{ background: 'linear-gradient(90deg, #064e3b, #059669)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✅</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#d1fae5', fontWeight: 700 }}>
            CUADRADO · CERRÓ CON {COP(cuadre.monto_cuadrado ?? t.totalCobrar)}
          </span>
        </div>
      )}

      {/* Cabecera */}
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.1rem' }}>
            {(vendedor.vendedor_nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: estadoColor, border: '2px solid var(--jordyn-bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.45rem', color: '#fff' }}>
            {cuadrado ? '✓' : '!'}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', color: 'var(--jordyn-text)', fontWeight: 600 }}>
            {vendedor.vendedor_nombre}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: `${estadoColor}18`, border: `1px solid ${estadoColor}40`, color: estadoColor, borderRadius: 4, padding: '1px 8px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', fontWeight: 700 }}>
              {estadoLabel}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>
              {t.cantidad} núm · {COP(precioPorNum)}/c.u.
            </span>
          </div>
        </div>

        {/* Montos */}
        <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>A COBRAR</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: 'var(--jordyn-text)', letterSpacing: '2px' }}>{COP(t.totalCobrar)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>DEUDA</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.15rem', color: t.deuda > 0 ? '#e63946' : '#06d6a0', letterSpacing: '2px' }}>{COP(t.deuda)}</div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>

          {/* VENTA */}
          <button onClick={onVenta} title="Registrar lo que me entregó"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', borderRadius: 7, padding: '6px 13px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
            <i className="bi bi-cash-coin" /> VENTA
          </button>

          {/* ABONAR */}
          <button onClick={onAbono} title="Abonar a la deuda"
            style={{ background: 'linear-gradient(135deg,#059669,#06d6a0)', border: 'none', color: '#fff', borderRadius: 7, padding: '6px 13px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(6,214,160,0.25)' }}>
            <i className="bi bi-plus-circle" /> ABONAR
          </button>

          {/* CHECKBOXES — cuadre y pendiente */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '4px 8px', alignItems: 'center', gap: 10 }}>

            {/* ✅ CUADRAR */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }} title="Confirmar cuadre con este vendedor">
              <div onClick={cuadrado ? onCuadrar : onCuadrar}
                style={{ width: 20, height: 20, borderRadius: 5, background: cuadrado ? 'linear-gradient(135deg,#059669,#06d6a0)' : 'var(--jordyn-bg2)', border: `2px solid ${cuadrado ? '#06d6a0' : 'var(--jordyn-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', cursor: 'pointer', flexShrink: 0 }}>
                {cuadrado && <i className="bi bi-check2" style={{ color: '#fff', fontSize: '.7rem' }} />}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: cuadrado ? '#06d6a0' : 'var(--jordyn-muted)', fontWeight: 700 }}>CUADRAR</span>
            </label>

            <div style={{ width: 1, height: 20, background: 'var(--jordyn-border)' }} />

            {/* ⚡ PENDIENTE */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }} title="Marcar como prioritario">
              <div onClick={onTogglePendiente}
                style={{ width: 20, height: 20, borderRadius: 5, background: pendienteFlag ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'var(--jordyn-bg2)', border: `2px solid ${pendienteFlag ? '#f59e0b' : 'var(--jordyn-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', cursor: 'pointer', flexShrink: 0 }}>
                {pendienteFlag && <i className="bi bi-lightning-fill" style={{ color: '#fff', fontSize: '.65rem' }} />}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: pendienteFlag ? '#f59e0b' : 'var(--jordyn-muted)', fontWeight: 700 }}>PEND.</span>
            </label>
          </div>

          {/* DETALLE */}
          <button onClick={onDetalle} title="Ver detalle"
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '6px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-eye" />
          </button>
        </div>
      </div>

      {/* Barra progreso */}
      <div style={{ height: 5, background: 'rgba(0,0,0,0.06)' }}>
        <div style={{ height: '100%', width: `${Math.min(pctCobrado, 100)}%`, background: pctCobrado >= 100 ? '#06d6a0' : cuadrado ? '#06d6a0' : pendienteFlag ? '#f59e0b' : 'var(--jordyn-primary)', transition: 'width .4s' }} />
      </div>

      {/* Footer contable */}
      <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.01)', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 18 }}>
          {[['TOTAL', COP(t.totalCobrar), 'var(--jordyn-text)'], ['COBRADO', COP(t.cobrado), '#06d6a0'], ['DEUDA', COP(t.deuda), t.deuda > 0 ? '#e63946' : '#06d6a0']].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.4rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '.95rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>{pctCobrado}% cobrado</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: CONFIRMAR CUADRE
   Aparece al hacer click en el checkbox CUADRAR.
   Permite ingresar el monto con que cerró,
   y también desconfirmar un cuadre previo.
═══════════════════════════════════════════ */
function ModalConfirmarCuadre({ vendedor, lote, cuadreActual, calcularTotales, onClose, onGuardar }) {
  const t = calcularTotales();
  const yaCuadrado  = cuadreActual.cuadrado || false;
  const [monto, setMonto] = useState(
    yaCuadrado && cuadreActual.monto_cuadrado
      ? String(cuadreActual.monto_cuadrado)
      : String(lote?.abono || t.totalCobrar || '')
  );
  const [saving, setSaving] = useState(false);

  const handleConfirmar = async () => {
    setSaving(true);
    try {
      await onGuardar({
        cuadrado:       true,
        pendiente_flag: false, // cuadrar quita el flag de pendiente
        monto_cuadrado: Number(monto) || t.totalCobrar,
      });
    } finally { setSaving(false); }
  };

  const handleDesconfirmar = async () => {
    setSaving(true);
    try {
      await onGuardar({
        cuadrado:       false,
        pendiente_flag: cuadreActual.pendiente_flag || false,
        monto_cuadrado: null,
      });
    } finally { setSaving(false); }
  };

  return (
    <ModalBase title={`${yaCuadrado ? 'EDITAR CUADRE' : 'CONFIRMAR CUADRE'} — ${vendedor.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <InfoCard label="A COBRAR"  value={COP(t.totalCobrar)}                       color="var(--jordyn-text)" />
          <InfoCard label="COBRADO"   value={COP(lote?.abono || 0)}                    color="#06d6a0" />
          <InfoCard label="DEUDA"     value={COP(t.deuda)}                              color={t.deuda > 0 ? '#e63946' : '#06d6a0'} />
        </div>

        <div>
          <label className="jd-label">MONTO CON EL QUE CERRÓ *</label>
          <input className="jd-input" type="number" min="0"
            value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={`Ej: ${COP(t.totalCobrar)}`} autoFocus
            onKeyDown={e => e.key === 'Enter' && handleConfirmar()} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {[lote?.abono || t.totalCobrar, t.totalCobrar]
              .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
              .map(v => (
                <button key={v} type="button" onClick={() => setMonto(String(v))}
                  style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
                  {COP(v)}
                </button>
              ))}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 6 }}>
            Este monto queda registrado como el cierre definitivo con el vendedor.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 4 }}>
          {yaCuadrado && (
            <button onClick={handleDesconfirmar} disabled={saving}
              style={{ background: 'transparent', border: '1.5px solid rgba(230,57,70,0.4)', color: '#e63946', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', fontWeight: 700 }}>
              ✗ DESCONFIRMAR CUADRE
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
            <button className="btn-jordyn" onClick={handleConfirmar} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#059669,#06d6a0)', minWidth: 140 }}>
              {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-check2-circle me-1" />CONFIRMAR CUADRE</>}
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: VENTA
═══════════════════════════════════════════ */
function ModalVenta({ vendedor, lote, precioPorNum, onClose, onSave }) {
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
  const [saving, setSaving] = useState(false);

  const totalCobrar = lote ? lote.por_pagar : +(precioPorNum * (vendedor.numeros?.length || 0)).toFixed(2);
  const yaAbonado   = lote?.abono     || 0;
  const pendiente   = lote?.pendiente ?? totalCobrar;

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

        {!lote ? (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '12px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: '#f59e0b' }}>
            ⚠ El lote de este vendedor se está cargando. Intenta de nuevo en un momento o actualiza la página.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <InfoCard label="TOTAL A COBRAR" value={COP(totalCobrar)} color="var(--jordyn-text)" />
              <InfoCard label="YA COBRADO"     value={COP(yaAbonado)}   color="#06d6a0" />
              <InfoCard label="PENDIENTE"      value={COP(pendiente)}   color={pendiente > 0 ? '#e63946' : '#06d6a0'} />
            </div>

            {totalCobrar > 0 && (
              <div style={{ height: 6, background: 'var(--jordyn-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (yaAbonado / totalCobrar) * 100)}%`, background: pendiente <= 0 ? '#06d6a0' : 'linear-gradient(90deg,#7c3aed,#06d6a0)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            )}

            <div>
              <label className="jd-label">MONTO QUE ME ENTREGÓ *</label>
              <input className="jd-input" type="number" min="1"
                value={monto} onChange={e => setMonto(e.target.value)}
                placeholder={`Ej: ${COP(pendiente)}`}
                autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[pendiente, Math.round(pendiente / 2), Math.round(pendiente / 4)]
                  .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
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
                placeholder="Ej: Efectivo, transferencia..." />
            </div>

            {monto > 0 && (
              <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, padding: '9px 13px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)' }}>
                Deuda restante después: <strong style={{ color: Math.max(0, pendiente - Number(monto)) > 0 ? '#e63946' : '#06d6a0', fontSize: '.72rem' }}>{COP(Math.max(0, pendiente - Number(monto)))}</strong>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          {lote && (
            <button className="btn-jordyn" onClick={handleSave} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', minWidth: 140 }}>
              {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-cash-coin me-1" />REGISTRAR VENTA</>}
            </button>
          )}
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: ABONAR
═══════════════════════════════════════════ */
function ModalAbono({ vendedor, lote, onClose, onSave }) {
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
  const [saving, setSaving] = useState(false);

  const totalCobrar = lote?.por_pagar || 0;
  const yaAbonado   = lote?.abono     || 0;
  const pendiente   = lote?.pendiente ?? totalCobrar;

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
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '12px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: '#f59e0b' }}>
            ⚠ El lote de este vendedor se está cargando. Intenta de nuevo en un momento o actualiza la página.
          </div>
        ) : pendiente <= 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#06d6a0', letterSpacing: '3px' }}>DEUDA SALDADA</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 6 }}>
              {vendedor.vendedor_nombre} no tiene deuda pendiente.
            </div>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ marginTop: 16 }}>CERRAR</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <InfoCard label="TOTAL A COBRAR"  value={COP(totalCobrar)} color="var(--jordyn-text)"                         sub="histórico" />
              <InfoCard label="YA ABONADO"      value={COP(yaAbonado)}   color="#06d6a0"                                    sub="acumulado" />
              <InfoCard label="DEUDA PENDIENTE" value={COP(pendiente)}   color={pendiente > 0 ? '#e63946' : '#06d6a0'}     sub="baja con cada abono" />
            </div>

            {totalCobrar > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>
                  <span>Progreso</span>
                  <span style={{ color: '#06d6a0', fontWeight: 700 }}>{Math.min(100, Math.round((yaAbonado / totalCobrar) * 100))}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--jordyn-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (yaAbonado / totalCobrar) * 100)}%`, background: 'linear-gradient(90deg,var(--jordyn-primary),#06d6a0)', borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            )}

            <div>
              <label className="jd-label">MONTO DEL ABONO *</label>
              <input className="jd-input" type="number" min="1" max={pendiente}
                value={monto} onChange={e => setMonto(e.target.value)}
                placeholder={`Máx: ${COP(pendiente)}`}
                autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[pendiente, Math.round(pendiente / 2), Math.round(pendiente / 4)]
                  .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
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
              <div style={{ background: 'rgba(6,214,160,0.05)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 8, padding: '9px 13px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)' }}>
                Deuda restante: <strong style={{ color: Math.max(0, pendiente - Number(monto)) > 0 ? '#e63946' : '#06d6a0', fontSize: '.72rem' }}>{COP(Math.max(0, pendiente - Number(monto)))}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
              <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
                {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-plus-circle me-1" />REGISTRAR ABONO</>}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: DETALLE
═══════════════════════════════════════════ */
function ModalDetalleVendedor({ vendedor, lote, precioPorNum, calcularTotales, onClose }) {
  const t = calcularTotales();
  return (
    <ModalBase title={`DETALLE — ${vendedor.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 8 }}>
          {[
            ['Números', t.cantidad,           'var(--jordyn-text)'],
            ['Precio/núm', COP(precioPorNum), '#a78bfa'],
            ['Total cobrar', COP(t.totalCobrar), 'var(--jordyn-primary)'],
            ['Cobrado', COP(t.cobrado),          '#06d6a0'],
            ['Deuda', COP(t.deuda),              t.deuda > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '8px 10px' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', marginBottom: 3 }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: c, letterSpacing: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', lineHeight: 1.9 }}>
          <strong style={{ color: '#a78bfa' }}>CÁLCULO:</strong> {t.cantidad} × {COP(precioPorNum)} = <strong style={{ color: 'var(--jordyn-primary)' }}>{COP(t.totalCobrar)}</strong>
          {lote && <><br /><strong style={{ color: '#06d6a0' }}>Abonado:</strong> {COP(lote.abono)} · <strong style={{ color: t.deuda > 0 ? '#e63946' : '#06d6a0' }}>Pendiente: {COP(t.deuda)}</strong></>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CERRAR</button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   RESUMEN GLOBAL
═══════════════════════════════════════════ */
function ResumenGlobal({ totales, totalVendedores, cuentas, porcentaje, onCambiarPct, precioPorNum, rifaPrecio }) {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'TOTAL A COBRAR', value: COP(totales.totalCobrar),  color: 'var(--jordyn-primary)', icon: 'bi-cash' },
          { label: 'YA COBRADO',     value: COP(totales.totalCobrado), color: '#06d6a0',               icon: 'bi-check2-circle' },
          { label: 'PENDIENTE',      value: COP(totales.totalDeuda),   color: '#e63946',               icon: 'bi-exclamation-circle' },
          { label: 'SIN CUADRAR',    value: cuentas.sinCuadrar,        color: '#f59e0b',               icon: 'bi-person-exclamation' },
          { label: 'CUADRADOS',      value: cuentas.cuadrados,         color: '#06d6a0',               icon: 'bi-person-check' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{c.label}</div>
              <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.7rem', opacity: .35 }} />
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.35rem', color: c.color, letterSpacing: '2px', lineHeight: 1.1, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: 'rgba(124,58,237,0.05)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.15)' }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: 'var(--jordyn-muted)', flex: 1 }}>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>% COBRO:</span> {COP(precioPorNum)}/número
          {rifaPrecio && <span> ({porcentaje}% de {COP(rifaPrecio)})</span>}
        </div>
        {editandoPct ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="1" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuardarPct()}
              style={{ width: 60, padding: '4px 8px', border: '1.5px solid #a78bfa', borderRadius: 6, fontFamily: "'Share Tech Mono',monospace", fontSize: '.78rem', textAlign: 'center', color: 'var(--jordyn-text)', background: '#fff' }}
              autoFocus />
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', color: 'var(--jordyn-muted)' }}>%</span>
            <button onClick={handleGuardarPct} style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}>OK</button>
            <button onClick={() => { setEditandoPct(false); setPctInput(String(porcentaje)); }} style={{ background: 'transparent', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '.72rem' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {[25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => onCambiarPct(p)}
                style={{ background: p === porcentaje ? '#7c3aed' : '#fff', border: `1.5px solid ${p === porcentaje ? '#7c3aed' : 'rgba(124,58,237,0.25)'}`, color: p === porcentaje ? '#fff' : '#7c3aed', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', fontWeight: 700 }}>
                {p}%
              </button>
            ))}
            <button onClick={() => { setEditandoPct(true); setPctInput(String(porcentaje)); }}
              style={{ background: 'transparent', border: '1px dashed rgba(124,58,237,0.3)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '.62rem', fontFamily: "'Share Tech Mono',monospace" }}>
              <i className="bi bi-pencil" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SELECTOR DE RIFA
═══════════════════════════════════════════ */
function SelectorRifa({ rifas, rifaSeleccionada, loading, onSeleccionar }) {
  const fmtFechaCorta = f => f ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Caracas' }) : '—';
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10 }}>
      <div className="jd-spinner" style={{ width: 18, height: 18, flexShrink: 0 }} />
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>CARGANDO RIFAS...</span>
    </div>
  );
  if (!rifas.length || rifas.length === 1) return null;
  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1.5px solid rgba(124,58,237,0.25)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700, marginBottom: 10 }}>
        <i className="bi bi-collection-fill me-2" />SELECCIONAR RIFA · {rifas.length} activas
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rifas.map(rifa => {
          const sel = rifaSeleccionada?.id === rifa.id;
          return (
            <button key={rifa.id} type="button" onClick={() => onSeleccionar(rifa)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: sel ? 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(124,58,237,0.06))' : '#fff', border: `2px solid ${sel ? '#7c3aed' : 'var(--jordyn-border)'}`, borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', boxShadow: sel ? '0 2px 12px rgba(124,58,237,0.15)' : 'none', fontFamily: 'inherit' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: sel ? '#7c3aed' : 'var(--jordyn-border)', border: `2px solid ${sel ? '#7c3aed' : 'var(--jordyn-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', fontWeight: 700, color: sel ? '#7c3aed' : 'var(--jordyn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rifa.nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                  <span>🏆 {rifa.premio}</span><span>📅 {fmtFechaCorta(rifa.fecha_sorteo)}</span>
                </div>
              </div>
              {sel && <div style={{ background: '#7c3aed', color: '#fff', borderRadius: 6, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', fontWeight: 700, flexShrink: 0 }}>✓ ACTIVA</div>}
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
  const sorteo = rifa.fecha_sorteo ? new Date(rifa.fecha_sorteo) : null;
  const dias   = sorteo ? Math.ceil((sorteo - new Date()) / 86400000) : null;
  return (
    <div style={{ background: 'linear-gradient(135deg,var(--jordyn-bg2),rgba(10,191,188,0.04))', border: '1px solid rgba(10,191,188,0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', letterSpacing: '2px' }}>🟢 EN CURSO</span>
          {dias !== null && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: dias <= 3 ? '#e63946' : 'var(--jordyn-muted)' }}>{dias > 0 ? `${dias} días para el sorteo` : 'SORTEO HOY'}</span>}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.5rem', color: 'var(--jordyn-primary)', letterSpacing: '3px' }}>{rifa.nombre}</div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>
          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(rifa.precio || 0)}/boleto · Sorteo: {fmtFecha(rifa.fecha_sorteo)}
          {fmtHoraSorteo(rifa.hora_sorteo) && ` · 🕐 ${fmtHoraSorteo(rifa.hora_sorteo)}`}
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
   DEUDAS ANTERIORES
═══════════════════════════════════════════ */
function SeccionDeudasAnteriores({ deudas, onSaldar }) {
  const [exp, setExp] = useState(false);
  const total = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);
  return (
    <div style={{ border: '1px solid rgba(230,57,70,.35)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setExp(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(230,57,70,.07)', border: 'none', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚠️</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1rem', color: '#e63946', letterSpacing: '3px' }}>DEUDAS ANTERIORES — {deudas.length} VENDEDOR{deudas.length !== 1 ? 'ES' : ''}</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>Total: {COP(total)}</div>
          </div>
        </div>
        <i className={`bi bi-chevron-${exp ? 'up' : 'down'}`} style={{ color: '#e63946' }} />
      </button>
      {exp && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(230,57,70,.03)' }}>
          {deudas.map(d => (
            <div key={d.lote_id} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.9rem', fontWeight: 600 }}>{d.vendedor_nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>Rifa: {d.rifa_nombre}</div>
              </div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: '#e63946', letterSpacing: '2px' }}>{COP(d.monto_pendiente)}</div>
              <button onClick={() => onSaldar(d)}
                style={{ background: 'rgba(6,214,160,.08)', border: '1.5px solid rgba(6,214,160,.35)', color: '#06d6a0', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem' }}>
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
            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.88rem', fontWeight: 600 }}>{d.vendedor_nombre}</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#e63946', letterSpacing: '2px' }}>{COP(d.monto_pendiente)}</div>
          </div>
        ))}
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '3px', textAlign: 'right', marginTop: 12, marginBottom: 20 }}>TOTAL: {COP(total)}</div>
        <button onClick={onConfirmar} className="btn-jordyn" style={{ width: '100%', fontSize: '.82rem' }}>ENTENDIDO — CONTINUAR</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   INFO CARD
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
   MODAL BASE
═══════════════════════════════════════════ */
function ModalBase({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
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
}