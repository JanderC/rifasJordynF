// ============================================================
//   RIFAS JORDYN — Caja.js (v8)
//   - lotes-vendedores devuelve por_pagar ya con el porcentaje
//   - Sin dependencia de cobro-vendedores para el precio
//   - VENTA: registra lo que entregó el vendedor
//   - ABONAR: abona a la deuda mostrando "te debe"
//   - Filtros: TODOS / PRIORITARIOS / CUADRADOS
//   - Checkbox CUADRAR (modal con monto) y PENDIENTE (toggle)
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
  const [rifasDisponibles, setRifasDisponibles] = useState([]);
  const [rifaActiva,       setRifaActiva]       = useState(null);
  const [loadingRifas,     setLoadingRifas]     = useState(true);

  const [vendedores,   setVendedores]   = useState([]);
  const [porcentaje,   setPorcentaje]   = useState(50);
  const [precioPorNum, setPrecioPorNum] = useState(0);
  const [loadingVends, setLoadingVends] = useState(false);
  const [buscar,       setBuscar]       = useState('');
  const [filtro,       setFiltro]       = useState('todos');

  // cuadreLocal: vendedorId → { cuadrado, pendiente_flag, monto_cuadrado }
  const [cuadreLocal,     setCuadreLocal]     = useState({});
  const [guardandoCuadre, setGuardandoCuadre] = useState({});

  const [modalDeudas,       setModalDeudas]       = useState(false);
  const [deudasVencidas,    setDeudasVencidas]    = useState([]);
  const [deudasConfirmadas, setDeudasConfirmadas] = useState(false);
  const [deudasAnteriores,  setDeudasAnteriores]  = useState([]);

  // lotesMap: vendedorId → { lote_id, por_pagar, abono, pendiente }
  // por_pagar ya viene calculado con el porcentaje desde el backend
  const [lotesMap, setLotesMap] = useState({});

  const [modalAbono,   setModalAbono]   = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [modalCuadre,  setModalCuadre]  = useState(null);

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
    cargarTodo(rifaActiva.id, porcentaje);
  }, [rifaActiva?.id]); // eslint-disable-line

  /* ── Carga todo en paralelo — sin race condition ── */
  const cargarTodo = async (rifaId, pct) => {
    setLoadingVends(true);
    try {
      const [bolRes, lotesRes, cuadreRes] = await Promise.all([
        API.get(`/rifas/${rifaId}/boleteria-vendedores`),
        API.get(`/caja/rifas/${rifaId}/lotes-vendedores`).catch(() => null),
        API.get(`/caja/rifas/${rifaId}/cobro-vendedores?porcentaje=${pct}`).catch(() => null),
      ]);

      // El precio con porcentaje viene directo del nuevo endpoint
      const precioEfectivo = lotesRes?.data?.precio_con_pct
        ?? cuadreRes?.data?.precio_boleto_efectivo
        ?? 0;
      const pctActivo = lotesRes?.data?.porcentaje
        ?? cuadreRes?.data?.porcentaje
        ?? pct;
      setPrecioPorNum(precioEfectivo);
      setPorcentaje(pctActivo);

      // Mapa de cuadre — leer siempre desde cobro-vendedores aunque el array esté vacío
      // Si la respuesta llegó (aunque sea con 0 vendedores), actualizar. Si falló, conservar el estado previo.
      if (cuadreRes?.data?.vendedores !== undefined) {
        const cuadreMap = {};
        for (const v of (cuadreRes.data.vendedores || [])) {
          cuadreMap[v.vendedor_id] = {
            cuadrado:        v.cuadrado        || false,
            pendiente_flag:  v.pendiente_flag  || false,
            monto_cuadrado:  v.monto_cuadrado  || null,
            nums_cuadrados:  v.nums_cuadrados  || null,
            monto_entregado: v.monto_entregado || null,
          };
        }
        setCuadreLocal(cuadreMap);
      }
      // Si cuadreRes es null (falló), no tocar cuadreLocal — conservar el último estado conocido

      // Mapa de lotes — por_pagar ya viene con el porcentaje correcto
      const lMap = {};
      for (const l of (lotesRes?.data?.lotes || [])) {
        if (l.vendedor_id) {
          lMap[l.vendedor_id] = {
            lote_id:       l.lote_id,
            por_pagar:     Number(l.por_pagar     || 0),
            abono:         Number(l.abono         || 0),
            pendiente:     Number(l.pendiente     || 0),
            total_numeros: Number(l.total_numeros || 0),
            estado:        l.estado,
          };
        }
      }
      setLotesMap(lMap);

      // Vendedores (solo para contar números y mostrar nombre)
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

  /* ── Refrescar lotes Y cuadre (después de abonar/cuadrar) ── */
  const refrescarLotes = async () => {
    if (!rifaActiva?.id) return;
    try {
      const [lotesRes, cuadreRes] = await Promise.all([
        API.get(`/caja/rifas/${rifaActiva.id}/lotes-vendedores`),
        API.get(`/caja/rifas/${rifaActiva.id}/cobro-vendedores?porcentaje=${porcentaje}`).catch(() => null),
      ]);

      const lMap = {};
      for (const l of (lotesRes.data?.lotes || [])) {
        if (l.vendedor_id) {
          lMap[l.vendedor_id] = {
            lote_id:       l.lote_id,
            por_pagar:     Number(l.por_pagar     || 0),
            abono:         Number(l.abono         || 0),
            pendiente:     Number(l.pendiente     || 0),
            total_numeros: Number(l.total_numeros || 0),
            estado:        l.estado,
          };
        }
      }
      setLotesMap(lMap);
      if (lotesRes.data?.precio_con_pct) setPrecioPorNum(lotesRes.data.precio_con_pct);

      // También actualizar el cuadre si la respuesta llegó
      if (cuadreRes?.data?.vendedores !== undefined) {
        const cuadreMap = {};
        for (const v of (cuadreRes.data.vendedores || [])) {
          cuadreMap[v.vendedor_id] = {
            cuadrado:        v.cuadrado        || false,
            pendiente_flag:  v.pendiente_flag  || false,
            monto_cuadrado:  v.monto_cuadrado  || null,
            nums_cuadrados:  v.nums_cuadrados  || null,
            monto_entregado: v.monto_entregado || null,
          };
        }
        setCuadreLocal(cuadreMap);
      }
    } catch {}
  };

  /* ── Totales de un vendedor ──
     Si está cuadrado, usa los valores del cierre (números realmente vendidos).
     Si no, usa el lote (números asignados).
  */
  const calcularTotalesVendedor = useCallback((vendedor) => {
    const lote   = lotesMap[vendedor.vendedor_id];
    const cuadre = cuadreLocal[vendedor.vendedor_id] || {};

    // Si fue cuadrado (por números o manual), usar los valores del cierre
    if (cuadre.cuadrado && cuadre.monto_cuadrado != null) {
      const cantidad    = cuadre.nums_cuadrados != null ? cuadre.nums_cuadrados : null; // null = cierre manual
      const totalCobrar = Number(cuadre.monto_cuadrado);
      const cobrado     = cuadre.monto_entregado != null ? Number(cuadre.monto_entregado) : (lote?.abono ?? 0);
      const deuda       = Math.max(totalCobrar - cobrado, 0);
      return { cantidad, totalCobrar, cobrado, deuda, manual: cuadre.nums_cuadrados == null };
    }

    // Sin cuadrar: usar el lote (números asignados)
    const cantidad    = (vendedor.numeros || []).length;
    const totalCobrar = lote ? lote.por_pagar : +(precioPorNum * cantidad).toFixed(2);
    const cobrado     = lote ? lote.abono     : 0;
    const deuda       = lote ? lote.pendiente : totalCobrar;
    return { cantidad, totalCobrar, cobrado, deuda, manual: false };
  }, [precioPorNum, lotesMap, cuadreLocal]);

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

  /* ── Cuadre ── */
  const handleGuardarCuadre = async (vendedorId, payload) => {
    if (!rifaActiva?.id) return;
    setCuadreLocal(prev => ({ ...prev, [vendedorId]: { ...(prev[vendedorId] || {}), ...payload } }));
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
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/cobro-vendedores/porcentaje`, { porcentaje: nuevoPct });
    } catch {}
    await cargarTodo(rifaActiva.id, nuevoPct);
  };

  /* ── Guardar abono ── */
  const handleGuardarAbono = async ({ lote_id, monto, nota }) => {
    await API.post('/caja/abonos', { lote_id, monto, nota: nota || 'Abono' });
    toast.success(`Abono de ${COP(monto)} registrado`);
    setModalAbono(null);
    await refrescarLotes();
  };

  /* ── Ordenar y filtrar ──
     Orden: ⚡ prioritarios → sin cuadrar con deuda → cuadrados
  */
  const vendedoresOrdenados = [...vendedores].sort((a, b) => {
    const ca = cuadreLocal[a.vendedor_id] || {};
    const cb = cuadreLocal[b.vendedor_id] || {};
    if (ca.cuadrado && !cb.cuadrado) return 1;
    if (!ca.cuadrado && cb.cuadrado) return -1;
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
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', textAlign: 'center', maxWidth: 380, lineHeight: 1.8 }}>
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
              cuentas={cuentas}
              porcentaje={porcentaje}
              onCambiarPct={handleCambiarPct}
              precioPorNum={precioPorNum}
              rifaPrecio={rifaActiva.precio}
            />

            {/* Toolbar con filtros */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 3, background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: 3 }}>
                {[
                  { key: 'todos',      label: `TODOS (${cuentas.todos})`,                  color: 'var(--jordyn-primary)' },
                  { key: 'pendientes', label: `⚡ PRIOR. (${cuentas.pendientes})`,          color: '#f59e0b' },
                  { key: 'cuadrados',  label: `✅ CUADRADOS (${cuentas.cuadrados})`,        color: '#06d6a0' },
                ].map(f => (
                  <button key={f.key} onClick={() => setFiltro(f.key)}
                    style={{ background: filtro === f.key ? f.color : 'transparent', color: filtro === f.key ? '#fff' : 'var(--jordyn-muted)', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700, transition: 'all .15s', whiteSpace: 'nowrap' }}>
                    {f.label}
                  </button>
                ))}
              </div>

              <input className="jd-input" placeholder="🔍 Buscar vendedor..."
                value={buscar} onChange={e => setBuscar(e.target.value)}
                style={{ maxWidth: 200, fontSize: '.8rem', padding: '.35rem .7rem' }} />

              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', marginLeft: 'auto' }}>
                {vendedoresFiltrados.length} de {vendedores.length}
              </div>
              <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px' }}
                onClick={() => rifaActiva?.id && cargarTodo(rifaActiva.id, porcentaje)}>
                <i className="bi bi-arrow-clockwise me-1" />ACTUALIZAR
              </button>
            </div>

            {/* Lista */}
            {loadingVends ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="jd-spinner" style={{ width: 36, height: 36 }} />
              </div>
            ) : vendedoresFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--jordyn-muted)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', letterSpacing: '2px' }}>
                {vendedores.length === 0 ? 'ESTA RIFA NO TIENE VENDEDORES ASIGNADOS' : 'SIN RESULTADOS'}
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
                    onAbono={() => setModalAbono(v)}
                    onDetalle={() => setModalDetalle(v)}
                    onCuadrar={() => setModalCuadre(v)}
                    onTogglePendiente={async () => {
                      const actual = cuadreLocal[v.vendedor_id] || {};
                      await handleGuardarCuadre(v.vendedor_id, {
                        cuadrado:       actual.cuadrado || false,
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

      {/* MODALES */}
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
          cuadre={cuadreLocal[modalDetalle.vendedor_id] || {}}
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
          precioPorNum={precioPorNum}
          onClose={() => setModalCuadre(null)}
          onRegistrarAbono={async (payload) => {
            await API.post('/caja/abonos', payload);
            await refrescarLotes();
          }}
          onGuardar={async (payload) => {
            await handleGuardarCuadre(modalCuadre.vendedor_id, payload);
            await refrescarLotes();
            setModalCuadre(null);
            toast.success(`✅ ${modalCuadre.vendedor_nombre.split(' ')[0]} cuadrado`);
          }}
        />
      )}
    </Layout>
  );
}

/* ═══════════════════════════════════════════
   TARJETA DE VENDEDOR
   - Sin montos visibles en la tarjeta
   - ABONAR: abonos durante la semana
   - CUADRAR (checkbox): cierra el vendedor con monto final
   - PRIOR. (checkbox): marca como prioritario
═══════════════════════════════════════════ */
function TarjetaVendedor({ vendedor, precioPorNum, lote, cuadre, guardandoCuadre, calcularTotales, onAbono, onDetalle, onCuadrar, onTogglePendiente }) {
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

  const pctCobrado = t.totalCobrar > 0 ? Math.round((t.cobrado / t.totalCobrar) * 100) : 0;

  // Cuadrado con saldo pendiente → amarillo (cerró pero queda debiendo)
  // Cuadrado sin saldo → verde
  const cuadradoConPendiente = cuadrado && t.deuda > 0;
  const estadoColor = cuadrado
    ? (cuadradoConPendiente ? '#f59e0b' : '#06d6a0')
    : pendienteFlag ? '#f59e0b'
    : t.deuda <= 0 ? '#06d6a0'
    : t.cobrado > 0 ? '#f59e0b'
    : '#e63946';
  const estadoLabel = cuadrado
    ? (cuadradoConPendiente ? '⚠ CUADRADO · PENDIENTE' : '✅ CUADRADO')
    : pendienteFlag ? '⚡ PRIORITARIO'
    : t.deuda <= 0 ? 'PAGADO'
    : t.cobrado > 0 ? 'ABONANDO'
    : 'PENDIENTE';

  return (
    <div style={{
      background: 'var(--jordyn-bg2)',
      border: `2px solid ${cuadrado ? (cuadradoConPendiente ? 'rgba(245,158,11,0.5)' : 'rgba(6,214,160,0.45)') : pendienteFlag ? 'rgba(245,158,11,0.45)' : 'rgba(200,200,200,0.2)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s',
    }}>

      {/* Banner cuadrado */}
      {cuadrado && (
        <div style={{ background: cuadradoConPendiente ? 'linear-gradient(90deg,#92400e,#d97706)' : 'linear-gradient(90deg,#064e3b,#059669)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{cuadradoConPendiente ? '⚠️' : '✅'}</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#fff', fontWeight: 700 }}>
            {cuadradoConPendiente
              ? `CUADRADO · PENDIENTE ${COP(t.deuda)}`
              : `CUADRADO · CERRÓ CON ${COP(cuadre.monto_cuadrado ?? t.totalCobrar)}`}
          </span>
        </div>
      )}
      {pendienteFlag && !cuadrado && (
        <div style={{ background: 'linear-gradient(90deg,#92400e,#f59e0b)', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.85rem' }}>⚡</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#fff', fontWeight: 700 }}>PRIORITARIO</span>
        </div>
      )}

      {/* Fila principal */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1rem' }}>
            {(vendedor.vendedor_nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: estadoColor, border: '2px solid var(--jordyn-bg2)' }} />
        </div>

        {/* Nombre + estado */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', color: 'var(--jordyn-text)', fontWeight: 600, lineHeight: 1.1 }}>
            {vendedor.vendedor_nombre}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: `${estadoColor}18`, border: `1px solid ${estadoColor}40`, color: estadoColor, borderRadius: 4, padding: '1px 7px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', fontWeight: 700 }}>
              {estadoLabel}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: 'var(--jordyn-muted)' }}>
              {t.cantidad != null ? `${t.cantidad} números` : 'cierre manual'}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>

          {/* ABONAR */}
          <button onClick={onAbono}
            style={{ background: 'linear-gradient(135deg,#059669,#06d6a0)', border: 'none', color: '#fff', borderRadius: 7, padding: '7px 15px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(6,214,160,0.25)' }}>
            <i className="bi bi-plus-circle" /> ABONAR
          </button>

          {/* Checkboxes CUADRAR / PRIOR. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '5px 10px' }}>

            {/* ✅ CUADRAR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }} onClick={onCuadrar}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: cuadrado ? 'linear-gradient(135deg,#059669,#06d6a0)' : 'var(--jordyn-bg2)', border: `2px solid ${cuadrado ? '#06d6a0' : 'var(--jordyn-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                {cuadrado && <i className="bi bi-check2" style={{ color: '#fff', fontSize: '.7rem' }} />}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: cuadrado ? '#06d6a0' : 'var(--jordyn-muted)', fontWeight: 700 }}>CUADRAR</span>
            </div>

            <div style={{ width: 1, height: 18, background: 'var(--jordyn-border)' }} />

            {/* ⚡ PRIOR. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }} onClick={onTogglePendiente}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: pendienteFlag ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'var(--jordyn-bg2)', border: `2px solid ${pendienteFlag ? '#f59e0b' : 'var(--jordyn-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                {pendienteFlag && <i className="bi bi-lightning-fill" style={{ color: '#fff', fontSize: '.65rem' }} />}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: pendienteFlag ? '#f59e0b' : 'var(--jordyn-muted)', fontWeight: 700 }}>PRIOR.</span>
            </div>
          </div>

          <button onClick={onDetalle} title="Ver detalle"
            style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '6px 9px', cursor: 'pointer', fontSize: '.75rem' }}>
            <i className="bi bi-eye" />
          </button>
        </div>
      </div>

      {/* Barra progreso — solo si tiene abonos */}
      {t.cobrado > 0 && (
        <div style={{ height: 3, background: 'rgba(0,0,0,0.06)' }}>
          <div style={{ height: '100%', width: `${Math.min(pctCobrado, 100)}%`, background: pctCobrado >= 100 ? '#06d6a0' : cuadrado ? '#06d6a0' : pendienteFlag ? '#f59e0b' : 'var(--jordyn-primary)', transition: 'width .4s' }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL: ABONAR
═══════════════════════════════════════════ */
function ModalAbono({ vendedor, lote, onClose, onSave }) {
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
  const [saving, setSaving] = useState(false);

  const totalCobrar = lote?.por_pagar ?? 0;
  const loEntregado = lote?.abono     ?? 0;
  // Calculamos deuda real — nunca bloqueamos el abono aunque la BD diga pendiente=0
  const leFalta     = totalCobrar > 0 ? Math.max(totalCobrar - loEntregado, 0) : 0;

  const handleSave = async () => {
    if (!monto || Number(monto) <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!lote?.lote_id) { toast.error('Error: no se encontró el lote. Pulsa ACTUALIZAR y vuelve a intentar.'); return; }
    setSaving(true);
    try { await onSave({ lote_id: lote.lote_id, monto: Number(monto), nota: nota || 'Abono' }); }
    finally { setSaving(false); }
  };

  return (
    <ModalBase title={`ABONAR — ${vendedor.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Resumen siempre visible */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>TOTAL</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: 'var(--jordyn-text)', letterSpacing: '2px' }}>{COP(totalCobrar)}</div>
          </div>
          <div style={{ background: 'rgba(6,214,160,0.07)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: '#06d6a0', marginBottom: 4 }}>YA PAGÓ</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#06d6a0', letterSpacing: '2px' }}>{COP(loEntregado)}</div>
          </div>
          <div style={{ background: leFalta > 0 ? 'rgba(230,57,70,0.07)' : 'rgba(6,214,160,0.07)', border: `1px solid ${leFalta > 0 ? 'rgba(230,57,70,0.2)' : 'rgba(6,214,160,0.2)'}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: leFalta > 0 ? '#e63946' : '#06d6a0', marginBottom: 4 }}>ME DEBE</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: leFalta > 0 ? '#e63946' : '#06d6a0', letterSpacing: '2px' }}>{COP(leFalta)}</div>
          </div>
        </div>

        {totalCobrar > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>
              <span>Progreso</span>
              <span style={{ color: '#06d6a0', fontWeight: 700 }}>{Math.min(100, Math.round((loEntregado / totalCobrar) * 100))}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--jordyn-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (loEntregado / totalCobrar) * 100)}%`, background: 'linear-gradient(90deg,var(--jordyn-primary),#06d6a0)', borderRadius: 4, transition: 'width .4s' }} />
            </div>
          </div>
        )}

        <div>
          <label className="jd-label">MONTO DEL ABONO *</label>
          <input className="jd-input" type="number" min="1"
            value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={leFalta > 0 ? `Ej: ${COP(leFalta)}` : 'Ingresa el monto'}
            autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          {leFalta > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {[leFalta, Math.round(leFalta / 2), Math.round(leFalta / 4)]
                .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                .map(v => (
                  <button key={v} type="button" onClick={() => setMonto(String(v))}
                    style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem' }}>
                    {COP(v)}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div>
          <label className="jd-label">NOTA (opcional)</label>
          <input className="jd-input" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Efectivo, transferencia..." />
        </div>

        {monto > 0 && (
          <div style={{ background: 'rgba(6,214,160,0.05)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 8, padding: '10px 13px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)' }}>
            Seguirá debiéndome:{' '}
            <strong style={{ color: Math.max(0, leFalta - Number(monto)) > 0 ? '#e63946' : '#06d6a0', fontSize: '.75rem' }}>
              {COP(Math.max(0, leFalta - Number(monto)))}
            </strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-plus-circle me-1" />REGISTRAR ABONO</>}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}


/* ═══════════════════════════════════════════
   MODAL: CUADRAR VENDEDOR
   Flujo:
   1. Input: ¿Cuántos números vendió?
   2. Calcula: total esperado = números × precio ticket
   3. Muestra: total esperado / abonado / diferencia
   4. Botón CERRAR VENTA → marca cuadrado y registra
      abono de la diferencia si la hay
═══════════════════════════════════════════ */
function ModalConfirmarCuadre({ vendedor, lote, cuadreActual, precioPorNum, onClose, onGuardar, onRegistrarAbono }) {
  const yaCuadrado = cuadreActual.cuadrado || false;
  const yaAbonado  = lote?.abono ?? 0;

  // Input: números vendidos (los no vendidos desaparecen)
  const [numVendidos, setNumVendidos] = useState(String(cuadreActual.nums_cuadrados ?? lote?.total_numeros ?? ''));
  // Input: monto que me dio (manual, en dinero) — toma prioridad
  const [montoDado,   setMontoDado]   = useState('');
  const [saving,      setSaving]      = useState(false);

  const vendidos      = Math.max(0, parseInt(numVendidos) || 0);
  const totalEsperado = +(precioPorNum * vendidos).toFixed(2);   // 25 × 2000 = 50000
  const totalPagado   = +(Number(montoDado) || 0).toFixed(2);    // lo que realmente dio (ej: 42000)
  const saldo         = +(Math.max(totalEsperado - totalPagado, 0)).toFixed(2); // pendiente

  // Lo que falta registrar como abono = lo pagado ahora menos lo ya abonado antes
  const abonoNuevo = Math.max(totalPagado - yaAbonado, 0);
  const listoParaCerrar = vendidos > 0 && montoDado !== '';

  const handleConfirmar = async () => {
    if (!vendidos) { toast.error('Ingresa cuántos números vendió'); return; }
    if (montoDado === '') { toast.error('Ingresa cuánto te dio'); return; }
    setSaving(true);
    try {
      if (abonoNuevo > 0 && lote?.lote_id) {
        await onRegistrarAbono({ lote_id: lote.lote_id, monto: abonoNuevo, nota: `Cuadre: ${vendidos} números, dio ${COP(totalPagado)}` });
      }
      await onGuardar({
        cuadrado:        true,
        pendiente_flag:  false,
        monto_cuadrado:  totalEsperado,
        nums_cuadrados:  vendidos,
        monto_entregado: totalPagado,
      });
    } finally { setSaving(false); }
  };

  const handleAbrir = async () => {
    setSaving(true);
    try { await onGuardar({ cuadrado: false, pendiente_flag: cuadreActual.pendiente_flag || false, monto_cuadrado: null }); }
    finally { setSaving(false); }
  };

  // Estilos de inputs grandes
  const inputNum   = { fontSize: '2.6rem', fontFamily: "'Bebas Neue',cursive", letterSpacing: '3px', textAlign: 'center', padding: '12px 16px', maxWidth: 160 };
  const inputMonto = { fontSize: '2.4rem', fontFamily: "'Bebas Neue',cursive", letterSpacing: '2px', textAlign: 'center', padding: '12px 16px', width: '100%' };

  return (
    <ModalBase title={`${yaCuadrado ? 'EDITAR CIERRE' : 'CUADRAR'} — ${vendedor.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ─── Números vendidos ─── */}
        <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '16px' }}>
          <label style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700, display: 'block', marginBottom: 10 }}>
            ¿CUÁNTOS NÚMEROS VENDIÓ?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input className="jd-input" type="number" min="0"
              value={numVendidos} onChange={e => setNumVendidos(e.target.value)}
              placeholder="25" autoFocus style={inputNum} />
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.3rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>
              × {COP(precioPorNum)}
            </div>
            {vendidos > 0 && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>SON</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.9rem', color: 'var(--jordyn-primary)', letterSpacing: '2px', lineHeight: 1 }}>
                  {COP(totalEsperado)}
                </div>
              </div>
            )}
          </div>
          {lote?.total_numeros > 0 && vendidos < lote.total_numeros && vendidos > 0 && (
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 8 }}>
              Tenía {lote.total_numeros} asignados · {lote.total_numeros - vendidos} no se vendieron (no se cobran)
            </div>
          )}
        </div>

        {/* ─── Cuánto me dio (monto manual) ─── */}
        {vendidos > 0 && (
          <div style={{ background: 'rgba(6,214,160,0.04)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 10, padding: '16px' }}>
            <label style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#06d6a0', letterSpacing: '2px', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              ¿CUÁNTO ME DIO?
            </label>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginBottom: 10 }}>
              El monto según el ticket es {COP(totalEsperado)} — escribe lo que entregó
            </div>
            <input className="jd-input" type="number" min="0"
              value={montoDado} onChange={e => setMontoDado(e.target.value)}
              placeholder={`Ej: ${Math.round(totalEsperado)}`}
              style={inputMonto} />
            {/* Atajos */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setMontoDado(String(Math.round(totalEsperado)))}
                style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700 }}>
                Pagó todo ({COP(totalEsperado)})
              </button>
              {[Math.round(totalEsperado / 2)].filter(v => v > 0).map(v => (
                <button key={v} type="button" onClick={() => setMontoDado(String(v))}
                  style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem' }}>
                  Mitad ({COP(v)})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── RESUMEN ─── */}
        {listoParaCerrar && (
          <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
              <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid var(--jordyn-border)' }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginBottom: 6 }}>TOTAL ({vendidos})</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.8rem', color: 'var(--jordyn-primary)', letterSpacing: '2px', lineHeight: 1 }}>{COP(totalEsperado)}</div>
              </div>
              <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid var(--jordyn-border)' }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: '#06d6a0', marginBottom: 6 }}>ME DIO</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.8rem', color: '#06d6a0', letterSpacing: '2px', lineHeight: 1 }}>{COP(totalPagado)}</div>
              </div>
              <div style={{ padding: '16px 12px', textAlign: 'center', background: saldo > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(6,214,160,0.08)' }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: saldo > 0 ? '#f59e0b' : '#06d6a0', marginBottom: 6, fontWeight: 700 }}>
                  {saldo > 0 ? 'PENDIENTE' : '✓ CUADRADO'}
                </div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '2rem', color: saldo > 0 ? '#f59e0b' : '#06d6a0', letterSpacing: '2px', lineHeight: 1 }}>
                  {COP(saldo)}
                </div>
              </div>
            </div>
            <div style={{ padding: '11px 14px', borderTop: '1px solid var(--jordyn-border)', background: 'rgba(0,0,0,0.01)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', lineHeight: 1.8 }}>
              {saldo > 0
                ? <>Queda <strong style={{ color: '#f59e0b' }}>{COP(saldo)} pendiente</strong>. El vendedor queda en amarillo y puedes seguir cobrando.</>
                : <>¡Cuadra perfecto! Se cierra en verde sin pendientes.</>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {yaCuadrado && (
            <button onClick={handleAbrir} disabled={saving}
              style={{ background: 'transparent', border: '1.5px solid rgba(230,57,70,0.4)', color: '#e63946', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', fontWeight: 700 }}>
              ✗ ABRIR VENTA
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
            <button className="btn-jordyn" onClick={handleConfirmar} disabled={saving || !listoParaCerrar}
              style={{ background: saldo > 0 ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'linear-gradient(135deg,#059669,#06d6a0)', minWidth: 140 }}>
              {saving
                ? <span className="jd-spinner" style={{ width: 16, height: 16 }} />
                : saldo > 0
                  ? <><i className="bi bi-check-circle me-1" />CERRAR CON PENDIENTE</>
                  : <><i className="bi bi-check2-circle me-1" />CERRAR VENTA</>}
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

/* ═══════════════════════════════════════════
   MODAL: DETALLE
═══════════════════════════════════════════ */
function ModalDetalleVendedor({ vendedor, lote, cuadre, precioPorNum, calcularTotales, onClose }) {
  const t          = calcularTotales();
  const yaCuadrado = cuadre?.cuadrado || false;

  // calcularTotales ya devuelve los valores correctos (del cuadre si está cuadrado)
  const nums          = t.cantidad;
  const totalEsperado = t.totalCobrar;
  const entregado     = t.cobrado;
  const saldo         = t.deuda;

  return (
    <ModalBase title={`DETALLE — ${vendedor.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Badge de estado */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {yaCuadrado ? (
            <span style={{ background: saldo > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(6,214,160,0.12)', border: `1px solid ${saldo > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(6,214,160,0.3)'}`, color: saldo > 0 ? '#f59e0b' : '#06d6a0', borderRadius: 6, padding: '3px 12px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', fontWeight: 700 }}>
              {saldo > 0 ? '⚠️ CUADRADO CON PENDIENTE' : '✅ CUADRADO'}
            </span>
          ) : (
            <span style={{ background: 'rgba(200,200,200,0.1)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '3px 12px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', fontWeight: 700 }}>
              SIN CUADRAR
            </span>
          )}
        </div>

        {/* Datos del cuadre o del lote */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {[
            ['NÚMEROS VENDIDOS',  nums != null ? nums : '—',     'var(--jordyn-text)'],
            ['PRECIO / TICKET',   COP(precioPorNum),              '#a78bfa'],
            ['TOTAL A COBRAR',    COP(totalEsperado),             'var(--jordyn-primary)'],
            ['ME ENTREGÓ',        COP(entregado),                 '#06d6a0'],
            ['PENDIENTE',         COP(Math.max(saldo, 0)),        saldo > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', marginBottom: 4, letterSpacing: '1px' }}>{k}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.15rem', color: c, letterSpacing: '2px', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Línea de cálculo */}
        <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', lineHeight: 2 }}>
          <strong style={{ color: '#a78bfa' }}>{nums != null ? 'CÁLCULO:' : 'CIERRE MANUAL:'}</strong>{' '}
          {nums != null
            ? <>{nums} núm × {COP(precioPorNum)} = <strong style={{ color: 'var(--jordyn-primary)' }}>{COP(totalEsperado)}</strong></>
            : <>Total cobrado manualmente: <strong style={{ color: 'var(--jordyn-primary)' }}>{COP(totalEsperado)}</strong></>}
          <br />
          <strong style={{ color: '#06d6a0' }}>Entregó:</strong>{' '}{COP(entregado)}{' '}·{' '}
          <strong style={{ color: saldo > 0 ? '#e63946' : '#06d6a0' }}>
            {saldo > 0 ? `Pendiente: ${COP(saldo)}` : 'Saldado ✓'}
          </strong>
          {!yaCuadrado && <><br /><span style={{ color: '#f59e0b' }}>⚠ Aún no cuadrado</span></>}
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
function ResumenGlobal({ totales, cuentas, porcentaje, onCambiarPct, precioPorNum, rifaPrecio }) {
  const [editandoPct, setEditandoPct] = useState(false);
  const [pctInput,    setPctInput]    = useState(String(porcentaje));
  const handleGuardarPct = () => {
    const v = parseInt(pctInput);
    if (!v || v < 1 || v > 100) { toast.error('Porcentaje entre 1 y 100'); return; }
    setEditandoPct(false); onCambiarPct(v);
  };
  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'TOTAL A COBRAR', value: COP(totales.totalCobrar),  color: 'var(--jordyn-primary)', icon: 'bi-cash' },
          { label: 'YA COBRADO',     value: COP(totales.totalCobrado), color: '#06d6a0',               icon: 'bi-check2-circle' },
          { label: 'TOTAL DEUDA',    value: COP(totales.totalDeuda),   color: '#e63946',               icon: 'bi-exclamation-circle' },
          { label: 'SIN CUADRAR',    value: cuentas.sinCuadrar,        color: '#f59e0b',               icon: 'bi-person-exclamation' },
          { label: 'CUADRADOS',      value: cuentas.cuadrados,         color: '#06d6a0',               icon: 'bi-person-check' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{c.label}</div>
              <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.7rem', opacity: .35 }} />
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.35rem', color: c.color, letterSpacing: '2px', marginTop: 4 }}>{c.value}</div>
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
              style={{ width: 60, padding: '4px 8px', border: '1.5px solid #a78bfa', borderRadius: 6, fontFamily: "'Share Tech Mono',monospace", fontSize: '.78rem', textAlign: 'center', background: '#fff' }} autoFocus />
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', color: 'var(--jordyn-muted)' }}>%</span>
            <button onClick={handleGuardarPct} style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}>OK</button>
            <button onClick={() => { setEditandoPct(false); setPctInput(String(porcentaje)); }} style={{ background: 'transparent', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '.72rem' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 5 }}>
            {[25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => onCambiarPct(p)}
                style={{ background: p === porcentaje ? '#7c3aed' : '#fff', border: `1.5px solid ${p === porcentaje ? '#7c3aed' : 'rgba(124,58,237,0.25)'}`, color: p === porcentaje ? '#fff' : '#7c3aed', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', fontWeight: 700 }}>{p}%</button>
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

/* ════════════════════════ COMPONENTES MENORES ════════════════════════ */

function SelectorRifa({ rifas, rifaSeleccionada, loading, onSeleccionar }) {
  const fmtC = f => f ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Caracas' }) : '—';
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10 }}>
      <div className="jd-spinner" style={{ width: 18, height: 18 }} />
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
        {rifas.map(r => {
          const sel = rifaSeleccionada?.id === r.id;
          return (
            <button key={r.id} type="button" onClick={() => onSeleccionar(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: sel ? 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(124,58,237,0.06))' : '#fff', border: `2px solid ${sel ? '#7c3aed' : 'var(--jordyn-border)'}`, borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'inherit' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: sel ? '#7c3aed' : 'var(--jordyn-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', fontWeight: 700, color: sel ? '#7c3aed' : 'var(--jordyn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>🏆 {r.premio} · 📅 {fmtC(r.fecha_sorteo)}</div>
              </div>
              {sel && <div style={{ background: '#7c3aed', color: '#fff', borderRadius: 6, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', fontWeight: 700, flexShrink: 0 }}>✓ ACTIVA</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BannerRifaActiva({ rifa }) {
  const sorteo = rifa.fecha_sorteo ? new Date(rifa.fecha_sorteo) : null;
  const dias   = sorteo ? Math.ceil((sorteo - new Date()) / 86400000) : null;
  return (
    <div style={{ background: 'linear-gradient(135deg,var(--jordyn-bg2),rgba(10,191,188,0.04))', border: '1px solid rgba(10,191,188,0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', letterSpacing: '2px' }}>🟢 EN CURSO</span>
          {dias !== null && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: dias <= 3 ? '#e63946' : 'var(--jordyn-muted)' }}>{dias > 0 ? `${dias} días` : 'SORTEO HOY'}</span>}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.5rem', color: 'var(--jordyn-primary)', letterSpacing: '3px' }}>{rifa.nombre}</div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>
          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(rifa.precio || 0)}/boleto · {fmtFecha(rifa.fecha_sorteo)}
          {fmtHoraSorteo(rifa.hora_sorteo) && ` · 🕐 ${fmtHoraSorteo(rifa.hora_sorteo)}`}
        </div>
      </div>
      {rifa.premio && <div style={{ textAlign: 'right' }}><div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)' }}>PREMIO</div><div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: 'var(--jordyn-text)', letterSpacing: '2px' }}>{rifa.premio}</div></div>}
    </div>
  );
}

function SeccionDeudasAnteriores({ deudas, onSaldar }) {
  const [exp, setExp] = useState(false);
  const total = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);
  return (
    <div style={{ border: '1px solid rgba(230,57,70,.35)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setExp(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(230,57,70,.07)', border: 'none', padding: '12px 16px', cursor: 'pointer' }}>
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
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(230,57,70,.02)' }}>
          {deudas.map(d => (
            <div key={d.lote_id} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}><div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.9rem', fontWeight: 600 }}>{d.vendedor_nombre}</div><div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)' }}>{d.rifa_nombre}</div></div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: '#e63946', letterSpacing: '2px' }}>{COP(d.monto_pendiente)}</div>
              <button onClick={() => onSaldar(d)} style={{ background: 'rgba(6,214,160,.08)', border: '1.5px solid rgba(6,214,160,.35)', color: '#06d6a0', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem' }}>✅ SALDAR</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalDeudasVencidas({ deudas, onConfirmar }) {
  const total = deudas.reduce((s, d) => s + Number(d.monto_pendiente || 0), 0);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--jordyn-bg)', border: '1px solid rgba(230,57,70,.4)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}><div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div><div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '4px' }}>RIFA VENCIDA — DEUDA PENDIENTE</div></div>
        {deudas.map((d, i) => (
          <div key={i} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.88rem', fontWeight: 600 }}>{d.vendedor_nombre}</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.1rem', color: '#e63946', letterSpacing: '2px' }}>{COP(d.monto_pendiente)}</div>
          </div>
        ))}
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.4rem', color: '#e63946', letterSpacing: '3px', textAlign: 'right', marginTop: 12, marginBottom: 20 }}>TOTAL: {COP(total)}</div>
        <button onClick={onConfirmar} className="btn-jordyn" style={{ width: '100%' }}>ENTENDIDO — CONTINUAR</button>
      </div>
    </div>
  );
}

function InfoCard({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: 'var(--jordyn-muted)', letterSpacing: '1.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color, letterSpacing: '2px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.4rem', color: 'var(--jordyn-muted)', marginTop: 3, opacity: .7 }}>{sub}</div>}
    </div>
  );
}

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
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}