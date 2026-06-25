// ============================================================
//   RIFAS JORDYN — Caja.js (v5)
//   - Una sola llamada al backend (/caja/rifas/:id/vendedores)
//   - Deuda prominente en cada tarjeta
//   - Monto del ticket visible en resumen global y modal cuadre
//   - Sin typos de CSS, sin llamadas legacy
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const COP = n =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

const fmtFecha = f => {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
};

const fmtHora = h => {
  if (!h) return null;
  const [hh, mm] = String(h).slice(0, 5).split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12  = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

/* ════════════════════════════════════════════════════════════
   HELPERS DE CÁLCULO
════════════════════════════════════════════════════════════ */
function calcTotal(v)   { return v.cuadrado && v.monto_cuadrado != null ? Number(v.monto_cuadrado) : Number(v.por_pagar || 0); }
function calcCobrado(v) { return v.cuadrado && v.monto_entregado != null ? Number(v.monto_entregado) : Number(v.abono || 0); }
function calcDeuda(v)   { return Math.max(calcTotal(v) - calcCobrado(v), 0); }

/* ════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function Caja() {
  const [rifasDisponibles, setRifasDisponibles] = useState([]);
  const [rifaActiva,       setRifaActiva]       = useState(null);
  const [loadingRifas,     setLoadingRifas]     = useState(true);

  const [datos,        setDatos]        = useState(null);
  const [loadingDatos, setLoadingDatos] = useState(false);

  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('activos');

  const [modalAbono,   setModalAbono]   = useState(null);
  const [modalCuadre,  setModalCuadre]  = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);

  const [modalDeudas,      setModalDeudas]      = useState(false);
  const [deudasVencidas,   setDeudasVencidas]   = useState([]);
  const [deudasAnteriores, setDeudasAnteriores] = useState([]);

  /* ── Carga inicial ── */
  useEffect(() => {
    (async () => {
      setLoadingRifas(true);
      try {
        const [rifasR, deudaR] = await Promise.all([
          API.get('/rifas'),
          API.get('/caja/rifa-activa').catch(() => null),
        ]);
        const activas = (rifasR.data || []).filter(r => r.activa && r.estado !== 'archivada');
        setRifasDisponibles(activas);
        if (deudaR?.data) {
          setDeudasAnteriores(deudaR.data.deudas_anteriores || []);
          if (deudaR.data.deudas_vencidas?.length > 0) {
            setDeudasVencidas(deudaR.data.deudas_vencidas);
            setModalDeudas(true);
          }
        }
        if (activas.length === 1) setRifaActiva(activas[0]);
      } catch { toast.error('Error cargando rifas'); }
      finally { setLoadingRifas(false); }
    })();
  }, []);

  /* ── Cargar datos de la rifa activa ── */
  const cargarDatos = useCallback(async (rifaId) => {
    if (!rifaId) return;
    setLoadingDatos(true);
    try {
      const r = await API.get(`/caja/rifas/${rifaId}/vendedores`);
      setDatos(r.data);
    } catch (e) {
      toast.error('Error cargando vendedores: ' + (e.response?.data?.error || e.message));
    } finally { setLoadingDatos(false); }
  }, []);

  useEffect(() => {
    if (!rifaActiva?.id) return;
    setBuscar(''); setFiltro('activos'); setDatos(null);
    cargarDatos(rifaActiva.id);
  }, [rifaActiva?.id, cargarDatos]);

  /* ── Parche local de un vendedor ── */
  const patchVendedor = useCallback((vendedorId, patch) => {
    setDatos(prev => !prev ? prev : {
      ...prev,
      vendedores: prev.vendedores.map(v => v.vendedor_id === vendedorId ? { ...v, ...patch } : v),
    });
  }, []);

  /* ── Cambiar porcentaje ── */
  const handleCambiarPct = async (pct) => {
    if (!rifaActiva?.id) return;
    try {
      await API.put(`/caja/rifas/${rifaActiva.id}/porcentaje`, { porcentaje: pct });
      await cargarDatos(rifaActiva.id);
    } catch { toast.error('Error cambiando porcentaje'); }
  };

  /* ── Guardar abono ── */
  const handleGuardarAbono = async ({ lote_id, monto, nota }, vendedorId) => {
    const r = await API.post('/caja/abonos', { lote_id, monto, nota: nota || 'Abono' });
    const lote = r.data.lote;
    patchVendedor(vendedorId, {
      abono:       Number(lote.abono     || 0),
      pendiente:   Number(lote.pendiente || 0),
      por_pagar:   Number(lote.por_pagar || 0),
      estado_lote: lote.estado,
    });
    toast.success(`Abono de ${COP(monto)} registrado`);
    setModalAbono(null);
  };

  /* ── Guardar cuadre ── */
  const handleGuardarCuadre = async (vendedorId, payload) => {
    const r = await API.put(`/caja/rifas/${rifaActiva.id}/cuadre/${vendedorId}`, payload);
    const c = r.data.cuadre;
    patchVendedor(vendedorId, {
      cuadrado:        c.cuadrado        || false,
      pendiente_flag:  c.pendiente_flag  || false,
      monto_cuadrado:  c.monto_cuadrado  ?? null,
      nums_cuadrados:  c.nums_cuadrados  ?? null,
      monto_entregado: c.monto_entregado ?? null,
    });
  };

  /* ── Toggle prioritario ── */
  const handleTogglePrioritario = async (v) => {
    try {
      await handleGuardarCuadre(v.vendedor_id, {
        cuadrado:       v.cuadrado || false,
        pendiente_flag: !v.pendiente_flag,
        monto_cuadrado: v.monto_cuadrado || null,
      });
    } catch { toast.error('Error actualizando prioridad'); }
  };

  /* ── Filtrar / ordenar ── */
  const vendedoresFiltrados = useMemo(() => {
    if (!datos?.vendedores) return [];
    const q = buscar.toLowerCase().trim();
    return [...datos.vendedores]
      .filter(v => {
        if (filtro === 'activos'    && v.cuadrado)        return false;
        if (filtro === 'pendientes' && !v.pendiente_flag) return false;
        if (filtro === 'cuadrados'  && !v.cuadrado)       return false;
        if (q && !v.vendedor_nombre.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.cuadrado && !b.cuadrado) return 1;
        if (!a.cuadrado && b.cuadrado) return -1;
        if (a.pendiente_flag && !b.pendiente_flag) return -1;
        if (!a.pendiente_flag && b.pendiente_flag) return 1;
        if (!a.cuadrado && !b.cuadrado) return calcDeuda(b) - calcDeuda(a);
        return a.vendedor_nombre.localeCompare(b.vendedor_nombre);
      });
  }, [datos, buscar, filtro]);

  const totales = useMemo(() => {
    if (!datos?.vendedores) return null;
    return datos.vendedores.reduce((acc, v) => ({
      totalCobrar: acc.totalCobrar + calcTotal(v),
      cobrado:     acc.cobrado     + calcCobrado(v),
      deuda:       acc.deuda       + calcDeuda(v),
    }), { totalCobrar: 0, cobrado: 0, deuda: 0 });
  }, [datos]);

  const cuentas = useMemo(() => {
    if (!datos?.vendedores) return { todos: 0, pendientes: 0, cuadrados: 0, sinCuadrar: 0 };
    const vv = datos.vendedores;
    return {
      todos:      vv.length,
      pendientes: vv.filter(v => v.pendiente_flag).length,
      cuadrados:  vv.filter(v => v.cuadrado).length,
      sinCuadrar: vv.filter(v => !v.cuadrado).length,
    };
  }, [datos]);

  /* ════ RENDER ════ */
  return (
    <Layout title="CAJA">
      {modalDeudas && (
        <ModalDeudasVencidas deudas={deudasVencidas} onConfirmar={() => setModalDeudas(false)} />
      )}

      <div style={S.root}>
        <SelectorRifa rifas={rifasDisponibles} rifaSeleccionada={rifaActiva} loading={loadingRifas} onSeleccionar={r => setRifaActiva(r)} />

        {!loadingRifas && rifasDisponibles.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: '3rem', opacity: .2 }}>🎟</div>
            <div style={S.emptyTitle}>SIN RIFAS ACTIVAS</div>
            <div style={S.emptySub}>Crea o activa una rifa desde Gestión de Rifas.</div>
          </div>
        )}

        {rifaActiva && (
          <>
            <BannerRifa rifa={rifaActiva} />

            {deudasAnteriores.length > 0 && (
              <SeccionDeudasAnteriores
                deudas={deudasAnteriores}
                onSaldar={async d => {
                  if (!window.confirm(`¿Marcar deuda de ${d.vendedor_nombre} como saldada?`)) return;
                  await API.put(`/caja/lotes/${d.lote_id}/saldar-deuda-anterior`);
                  setDeudasAnteriores(prev => prev.filter(x => x.lote_id !== d.lote_id));
                  toast.success(`Deuda de ${d.vendedor_nombre} saldada`);
                }}
              />
            )}

            {totales && datos && (
              <ResumenGlobal
                totales={totales} cuentas={cuentas}
                porcentaje={datos.porcentaje}
                precioPorNum={datos.precio_boleto_efectivo}
                rifaPrecio={rifaActiva.precio}
                onCambiarPct={handleCambiarPct}
              />
            )}

            {datos && (
              <div style={S.toolbar}>
                <div style={S.filtrosBg}>
                  {[
                    { key: 'activos',    label: `POR COBRAR (${cuentas.sinCuadrar})`, color: 'var(--jordyn-primary)' },
                    { key: 'pendientes', label: `⚡ PRIOR. (${cuentas.pendientes})`,   color: '#f59e0b' },
                    { key: 'cuadrados',  label: `✅ CUAD. (${cuentas.cuadrados})`,     color: '#06d6a0' },
                    { key: 'todos',      label: `TODOS (${cuentas.todos})`,            color: 'var(--jordyn-muted)' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setFiltro(f.key)}
                      style={{ ...S.filtroBtn, background: filtro === f.key ? f.color : 'transparent', color: filtro === f.key ? '#fff' : 'var(--jordyn-muted)' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <input className="jd-input" placeholder="🔍 Buscar vendedor..."
                  value={buscar} onChange={e => setBuscar(e.target.value)}
                  style={{ maxWidth: 200, fontSize: '.8rem', padding: '.35rem .7rem' }} />
                <span style={S.countLabel}>{vendedoresFiltrados.length}/{datos.vendedores.length}</span>
                <button className="btn-jordyn-outline" style={{ fontSize: '.8rem', padding: '5px 12px', marginLeft: 'auto' }}
                  onClick={() => cargarDatos(rifaActiva.id)}>
                  <i className="bi bi-arrow-clockwise me-1" />ACTUALIZAR
                </button>
              </div>
            )}

            {loadingDatos ? (
              <div style={S.center}>
                <div className="jd-spinner" style={{ width: 36, height: 36 }} />
                <span style={S.loadingTxt}>CARGANDO VENDEDORES...</span>
              </div>
            ) : datos && vendedoresFiltrados.length === 0 ? (
              <div style={S.center}>
                <div style={{ fontSize: '2rem', opacity: .2 }}>👤</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>
                  {datos.vendedores.length === 0 ? 'ESTA RIFA NO TIENE VENDEDORES ASIGNADOS' : 'SIN RESULTADOS'}
                </div>
              </div>
            ) : datos && (
              <div style={S.lista}>
                {vendedoresFiltrados.map(v => (
                  <TarjetaVendedor
                    key={v.vendedor_id} vendedor={v}
                    precioPorNum={datos.precio_boleto_efectivo}
                    onAbono={() => setModalAbono(v)}
                    onCuadrar={() => setModalCuadre(v)}
                    onDetalle={() => setModalDetalle(v)}
                    onTogglePrioritario={() => handleTogglePrioritario(v)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalAbono && datos && (
        <ModalAbono vendedor={modalAbono} onClose={() => setModalAbono(null)}
          onSave={payload => handleGuardarAbono(payload, modalAbono.vendedor_id)} />
      )}

      {modalCuadre && datos && (
        <ModalCuadre
          vendedor={modalCuadre}
          precioPorNum={datos.precio_boleto_efectivo}
          onClose={() => setModalCuadre(null)}
          onRegistrarAbono={async payload => {
            await API.post('/caja/abonos', payload);
            const r = await API.get(`/caja/rifas/${rifaActiva.id}/vendedores`);
            const vActual = r.data.vendedores.find(v => v.vendedor_id === modalCuadre.vendedor_id);
            if (vActual) patchVendedor(modalCuadre.vendedor_id, vActual);
          }}
          onGuardar={async payload => {
            try {
              await handleGuardarCuadre(modalCuadre.vendedor_id, payload);
              setModalCuadre(null);
              toast.success(`✅ ${modalCuadre.vendedor_nombre.split(' ')[0]} cuadrado`);
            } catch { toast.error('No se pudo guardar el cuadre. Intenta de nuevo.'); }
          }}
          onAbrir={async () => {
            try {
              await handleGuardarCuadre(modalCuadre.vendedor_id, { cuadrado: false, pendiente_flag: modalCuadre.pendiente_flag || false, monto_cuadrado: null });
              setModalCuadre(null);
            } catch { toast.error('Error reabriendo vendedor'); }
          }}
        />
      )}

      {modalDetalle && datos && (
        <ModalDetalle vendedor={modalDetalle} precioPorNum={datos.precio_boleto_efectivo} onClose={() => setModalDetalle(null)} />
      )}
    </Layout>
  );
}

/* ════════════════════════════════════════════════════════════
   TARJETA VENDEDOR
════════════════════════════════════════════════════════════ */
function TarjetaVendedor({ vendedor: v, precioPorNum, onAbono, onCuadrar, onDetalle, onTogglePrioritario }) {
  const total   = calcTotal(v);
  const cobrado = calcCobrado(v);
  const deuda   = calcDeuda(v);
  const pct     = total > 0 ? Math.min(Math.round((cobrado / total) * 100), 100) : 0;

  const cuadradoConPendiente = v.cuadrado && deuda > 0;
  const estadoColor = v.cuadrado
    ? (cuadradoConPendiente ? '#f59e0b' : '#06d6a0')
    : v.pendiente_flag ? '#f59e0b'
    : deuda <= 0  ? '#06d6a0'
    : cobrado > 0 ? '#f59e0b'
    : '#e63946';

  const estadoLabel = v.cuadrado
    ? (cuadradoConPendiente ? '⚠ CUADRADO · DEBE' : '✅ CUADRADO')
    : v.pendiente_flag ? '⚡ PRIORITARIO'
    : deuda <= 0  ? '✓ PAGADO'
    : cobrado > 0 ? 'ABONANDO'
    : 'PENDIENTE';

  const avatarBg = (() => {
    const cols = ['135deg,#7c3aed,#a855f7','135deg,#0abfbc,#22d3d0','135deg,#f59e0b,#fbbf24','135deg,#06d6a0,#10b981','135deg,#ec4899,#f472b6','135deg,#3b82f6,#60a5fa'];
    let h = 0;
    for (let i = 0; i < (v.vendedor_nombre || '').length; i++) h = (h * 31 + v.vendedor_nombre.charCodeAt(i)) >>> 0;
    return `linear-gradient(${cols[h % cols.length]})`;
  })();

  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${v.cuadrado ? (cuadradoConPendiente ? 'rgba(245,158,11,.5)' : 'rgba(6,214,160,.45)') : v.pendiente_flag ? 'rgba(245,158,11,.45)' : 'rgba(200,200,200,.18)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>

      {/* Banner superior */}
      {v.cuadrado && (
        <div style={{ background: cuadradoConPendiente ? 'linear-gradient(90deg,#92400e,#d97706)' : 'linear-gradient(90deg,#064e3b,#059669)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{cuadradoConPendiente ? '⚠️' : '✅'}</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: '#fff', fontWeight: 700 }}>
            {cuadradoConPendiente ? `CUADRADO · AÚN DEBE ${COP(deuda)}` : `CUADRADO · CERRÓ CON ${COP(v.monto_cuadrado ?? total)}`}
          </span>
        </div>
      )}
      {v.pendiente_flag && !v.cuadrado && (
        <div style={{ background: 'linear-gradient(90deg,#92400e,#f59e0b)', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.85rem' }}>⚡</span>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#fff', fontWeight: 700 }}>PRIORITARIO</span>
        </div>
      )}

      {/* Fila principal */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.1rem' }}>
            {(v.vendedor_nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: estadoColor, border: '2px solid var(--jordyn-bg2)' }} />
        </div>

        {/* Nombre + info */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', fontWeight: 600, color: 'var(--jordyn-text)', lineHeight: 1.1 }}>
            {v.vendedor_nombre}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: `${estadoColor}18`, border: `1px solid ${estadoColor}40`, color: estadoColor, borderRadius: 4, padding: '1px 7px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', fontWeight: 700 }}>
              {estadoLabel}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: 'var(--jordyn-muted)' }}>
              {v.total_numeros} núm · {COP(precioPorNum)}/ticket
            </span>
          </div>
        </div>

        {/* DEUDA PROMINENTE */}
        {deuda > 0 ? (
          <div style={{ background: v.cuadrado ? 'rgba(245,158,11,.1)' : 'rgba(230,57,70,.1)', border: `1.5px solid ${v.cuadrado ? 'rgba(245,158,11,.4)' : 'rgba(230,57,70,.4)'}`, borderRadius: 10, padding: '8px 18px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: v.cuadrado ? '#f59e0b' : '#e63946', letterSpacing: '2px', fontWeight: 700 }}>ME DEBE</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.7rem', color: v.cuadrado ? '#f59e0b' : '#e63946', letterSpacing: '2px', lineHeight: 1 }}>{COP(deuda)}</div>
          </div>
        ) : (
          <div style={{ background: 'rgba(6,214,160,.08)', border: '1.5px solid rgba(6,214,160,.3)', borderRadius: 10, padding: '8px 18px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: '#06d6a0', letterSpacing: '2px', fontWeight: 700 }}>SALDADO</div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.7rem', color: '#06d6a0', letterSpacing: '2px', lineHeight: 1 }}>✓ {COP(cobrado)}</div>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <button onClick={onAbono} style={S.btnAbono}><i className="bi bi-plus-circle" /> ABONAR</button>
          <div style={S.checkGroup}>
            <div style={S.checkItem} onClick={onCuadrar}>
              <div style={{ ...S.checkbox, background: v.cuadrado ? 'linear-gradient(135deg,#059669,#06d6a0)' : 'var(--jordyn-bg2)', borderColor: v.cuadrado ? '#06d6a0' : 'var(--jordyn-border)' }}>
                {v.cuadrado && <i className="bi bi-check2" style={{ color: '#fff', fontSize: '.7rem' }} />}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: v.cuadrado ? '#06d6a0' : 'var(--jordyn-muted)', fontWeight: 700 }}>CUADRAR</span>
            </div>
            <div style={S.dividerV} />
            <div style={S.checkItem} onClick={onTogglePrioritario}>
              <div style={{ ...S.checkbox, background: v.pendiente_flag ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'var(--jordyn-bg2)', borderColor: v.pendiente_flag ? '#f59e0b' : 'var(--jordyn-border)' }}>
                {v.pendiente_flag && <i className="bi bi-lightning-fill" style={{ color: '#fff', fontSize: '.65rem' }} />}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: v.pendiente_flag ? '#f59e0b' : 'var(--jordyn-muted)', fontWeight: 700 }}>PRIOR.</span>
            </div>
          </div>
          <button onClick={onDetalle} style={S.btnDetalle} title="Ver detalle"><i className="bi bi-eye" /></button>
        </div>
      </div>

      {cobrado > 0 && (
        <div style={{ height: 4, background: 'rgba(0,0,0,.07)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#06d6a0' : v.cuadrado ? '#06d6a0' : v.pendiente_flag ? '#f59e0b' : 'var(--jordyn-primary)', transition: 'width .4s' }} />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL CUADRAR
════════════════════════════════════════════════════════════ */
function ModalCuadre({ vendedor: v, precioPorNum, onClose, onGuardar, onRegistrarAbono, onAbrir }) {
  const yaCuadrado = v.cuadrado || false;
  const yaAbonado  = Number(v.abono || 0);

  const [numVendidos, setNumVendidos] = useState(String(v.nums_cuadrados ?? v.total_numeros ?? ''));
  const [montoDado,   setMontoDado]   = useState('');
  const [saving,      setSaving]      = useState(false);

  const vendidos      = Math.max(0, parseInt(numVendidos) || 0);
  const totalEsperado = +(precioPorNum * vendidos).toFixed(2);
  const totalPagado   = +(Number(montoDado) || 0).toFixed(2);
  const saldo         = +(Math.max(totalEsperado - totalPagado, 0)).toFixed(2);
  const abonoNuevo    = Math.max(totalPagado - yaAbonado, 0);
  const listo         = vendidos > 0 && montoDado !== '';

  const handleConfirmar = async () => {
    if (!vendidos)        { toast.error('Ingresa cuántos números vendió'); return; }
    if (montoDado === '') { toast.error('Ingresa cuánto te dio');          return; }
    setSaving(true);
    try {
      if (abonoNuevo > 0 && v.lote_id) {
        await onRegistrarAbono({ lote_id: v.lote_id, monto: abonoNuevo, nota: `Cuadre: ${vendidos} números, dio ${COP(totalPagado)}` });
      }
      await onGuardar({ cuadrado: true, pendiente_flag: false, monto_cuadrado: totalEsperado, nums_cuadrados: vendidos, monto_entregado: totalPagado });
    } catch { /* error notificado en onGuardar */ }
    finally { setSaving(false); }
  };

  /* estilo input grande — SIN TYPO */
  const inputGrande = { fontSize: '2.4rem', fontFamily: "'Bebas Neue',cursive", letterSpacing: '3px', textAlign: 'center', padding: '10px 14px' };

  return (
    <ModalBase title={`${yaCuadrado ? 'EDITAR CIERRE' : 'CUADRAR'} — ${v.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Paso 1 — ¿cuántos vendió? */}
        <div style={S.modalSection}>
          <label style={S.modalLabel}>¿CUÁNTOS NÚMEROS VENDIÓ?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input className="jd-input" type="number" min="0"
              value={numVendidos} onChange={e => setNumVendidos(e.target.value)}
              placeholder="25" autoFocus style={{ ...inputGrande, width: 120 }} />
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.2rem', color: 'var(--jordyn-muted)' }}>
              × {COP(precioPorNum)}
            </div>
            {vendidos > 0 && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.48rem', color: 'var(--jordyn-muted)' }}>SON</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.9rem', color: 'var(--jordyn-primary)', letterSpacing: '2px', lineHeight: 1 }}>{COP(totalEsperado)}</div>
              </div>
            )}
          </div>
          {v.total_numeros > 0 && vendidos > 0 && vendidos < v.total_numeros && (
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 6 }}>
              Tenía {v.total_numeros} asignados · {v.total_numeros - vendidos} no vendidos (no se cobran)
            </div>
          )}
        </div>

        {/* Paso 2 — ¿cuánto dio? */}
        {vendidos > 0 && (
          <div style={{ ...S.modalSection, borderColor: 'rgba(6,214,160,.25)', background: 'rgba(6,214,160,.03)' }}>
            <label style={{ ...S.modalLabel, color: '#06d6a0' }}>¿CUÁNTO ME DIO?</label>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginBottom: 8 }}>
              Debería ser {COP(totalEsperado)} — escribe lo que entregó
            </div>
            <input className="jd-input" type="number" min="0"
              value={montoDado} onChange={e => setMontoDado(e.target.value)}
              placeholder={`Ej: ${Math.round(totalEsperado)}`}
              style={{ ...inputGrande, width: '100%' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setMontoDado(String(Math.round(totalEsperado)))} style={S.atajoBtn}>
                Pagó todo ({COP(totalEsperado)})
              </button>
              {[Math.round(totalEsperado * 3 / 4), Math.round(totalEsperado / 2)]
                .filter((vv, i, arr) => vv > 0 && arr.indexOf(vv) === i)
                .map(vv => (
                  <button key={vv} type="button" onClick={() => setMontoDado(String(vv))} style={S.atajoBtn}>{COP(vv)}</button>
                ))}
            </div>
          </div>
        )}

        {/* Paso 3 — resumen */}
        {listo && (
          <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {[
                { label: `TOTAL (${vendidos})`, val: COP(totalEsperado), color: 'var(--jordyn-primary)', bg: '' },
                { label: 'ME DIO',              val: COP(totalPagado),   color: '#06d6a0',              bg: '' },
                { label: saldo > 0 ? 'PENDIENTE' : '✓ CUADRADO', val: COP(saldo), color: saldo > 0 ? '#f59e0b' : '#06d6a0', bg: saldo > 0 ? 'rgba(245,158,11,.08)' : 'rgba(6,214,160,.08)' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '16px 12px', textAlign: 'center', background: item.bg, borderRight: i < 2 ? '1px solid var(--jordyn-border)' : 'none' }}>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: item.color, marginBottom: 6, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.8rem', color: item.color, letterSpacing: '2px', lineHeight: 1 }}>{item.val}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--jordyn-border)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.56rem', color: 'var(--jordyn-muted)', lineHeight: 1.8 }}>
              {saldo > 0
                ? <>Queda <strong style={{ color: '#f59e0b' }}>{COP(saldo)} pendiente</strong>. Quedará en amarillo — puedes seguir cobrando con ABONAR.</>
                : <>¡Cuadra perfecto! Se cierra en verde sin deuda.</>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {yaCuadrado && (
            <button onClick={onAbrir} disabled={saving}
              style={{ background: 'transparent', border: '1.5px solid rgba(230,57,70,.4)', color: '#e63946', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', fontWeight: 700 }}>
              ✗ REABRIR
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
            <button className="btn-jordyn" onClick={handleConfirmar} disabled={saving || !listo}
              style={{ background: saldo > 0 ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'linear-gradient(135deg,#059669,#06d6a0)', minWidth: 150 }}>
              {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} />
                : saldo > 0 ? <><i className="bi bi-check-circle me-1" />CERRAR CON DEUDA</>
                : <><i className="bi bi-check2-circle me-1" />CERRAR VENTA</>}
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL ABONAR
════════════════════════════════════════════════════════════ */
function ModalAbono({ vendedor: v, onClose, onSave }) {
  const [monto,  setMonto]  = useState('');
  const [nota,   setNota]   = useState('');
  const [saving, setSaving] = useState(false);

  const total    = calcTotal(v);
  const entregado = calcCobrado(v);
  const falta    = Math.max(total - entregado, 0);

  const handleSave = async () => {
    if (!monto || Number(monto) <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!v.lote_id) { toast.error('Sin lote — pulsa ACTUALIZAR e intenta de nuevo'); return; }
    setSaving(true);
    try { await onSave({ lote_id: v.lote_id, monto: Number(monto), nota }); }
    finally { setSaving(false); }
  };

  return (
    <ModalBase title={`ABONAR — ${v.vendedor_nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={S.infoCard}>
            <div style={S.infoCardLabel}>TOTAL</div>
            <div style={{ ...S.infoCardVal, color: 'var(--jordyn-primary)' }}>{COP(total)}</div>
          </div>
          <div style={{ ...S.infoCard, background: 'rgba(6,214,160,.07)', border: '1px solid rgba(6,214,160,.25)' }}>
            <div style={{ ...S.infoCardLabel, color: '#06d6a0' }}>YA DIO</div>
            <div style={{ ...S.infoCardVal, color: '#06d6a0' }}>{COP(entregado)}</div>
          </div>
          <div style={{ ...S.infoCard, background: falta > 0 ? 'rgba(230,57,70,.07)' : 'rgba(6,214,160,.07)', border: `1px solid ${falta > 0 ? 'rgba(230,57,70,.25)' : 'rgba(6,214,160,.25)'}` }}>
            <div style={{ ...S.infoCardLabel, color: falta > 0 ? '#e63946' : '#06d6a0' }}>ME DEBE</div>
            <div style={{ ...S.infoCardVal, color: falta > 0 ? '#e63946' : '#06d6a0', fontSize: '1.5rem' }}>{COP(falta)}</div>
          </div>
        </div>

        {total > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Share Tech Mono',monospace", fontSize: '.46rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>
              <span>Progreso</span>
              <span style={{ color: '#06d6a0', fontWeight: 700 }}>{Math.round((entregado / total) * 100)}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--jordyn-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (entregado / total) * 100)}%`, background: 'linear-gradient(90deg,var(--jordyn-primary),#06d6a0)', borderRadius: 4, transition: 'width .4s' }} />
            </div>
          </div>
        )}

        <div>
          <label className="jd-label">MONTO DEL ABONO *</label>
          <input className="jd-input" type="number" min="1" value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={falta > 0 ? `Ej: ${Math.round(falta)}` : 'Monto'}
            autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          {falta > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {[falta, Math.round(falta / 2), Math.round(falta / 4)].filter((vv, i, a) => vv > 0 && a.indexOf(vv) === i).map(vv => (
                <button key={vv} type="button" onClick={() => setMonto(String(vv))} style={S.atajoBtn}>{COP(vv)}</button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="jd-label">NOTA (opcional)</label>
          <input className="jd-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Efectivo, transferencia..." />
        </div>

        {monto > 0 && (
          <div style={{ background: 'rgba(6,214,160,.05)', border: '1px solid rgba(6,214,160,.2)', borderRadius: 8, padding: '10px 13px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)' }}>
            Seguirá debiéndome:{' '}
            <strong style={{ color: Math.max(0, falta - Number(monto)) > 0 ? '#e63946' : '#06d6a0', fontSize: '.75rem' }}>
              {COP(Math.max(0, falta - Number(monto)))}
            </strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CANCELAR</button>
          <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
            {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }} /> : <><i className="bi bi-plus-circle me-1" />REGISTRAR ABONO</>}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL DETALLE
════════════════════════════════════════════════════════════ */
function ModalDetalle({ vendedor: v, precioPorNum, onClose }) {
  const total   = calcTotal(v);
  const cobrado = calcCobrado(v);
  const deuda   = calcDeuda(v);
  return (
    <ModalBase title={`DETALLE — ${v.vendedor_nombre}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ alignSelf: 'flex-start', background: v.cuadrado ? (deuda > 0 ? 'rgba(245,158,11,.12)' : 'rgba(6,214,160,.12)') : 'rgba(200,200,200,.1)', border: `1px solid ${v.cuadrado ? (deuda > 0 ? 'rgba(245,158,11,.3)' : 'rgba(6,214,160,.3)') : 'var(--jordyn-border)'}`, color: v.cuadrado ? (deuda > 0 ? '#f59e0b' : '#06d6a0') : 'var(--jordyn-muted)', borderRadius: 6, padding: '3px 12px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', fontWeight: 700 }}>
          {v.cuadrado ? (deuda > 0 ? '⚠️ CUADRADO CON DEUDA' : '✅ CUADRADO COMPLETO') : 'SIN CUADRAR'}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {[
            ['NÚMEROS',         v.nums_cuadrados != null ? v.nums_cuadrados : (v.total_numeros ?? '—'), 'var(--jordyn-text)'],
            ['PRECIO / TICKET', COP(precioPorNum),    '#a78bfa'],
            ['TOTAL A COBRAR',  COP(total),           'var(--jordyn-primary)'],
            ['ENTREGÓ',         COP(cobrado),         '#06d6a0'],
            ['PENDIENTE',       COP(deuda),           deuda > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, val, color]) => (
            <div key={k} style={S.infoCard}>
              <div style={S.infoCardLabel}>{k}</div>
              <div style={{ ...S.infoCardVal, color }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(124,58,237,.04)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)', lineHeight: 2 }}>
          {v.nums_cuadrados != null && <><strong style={{ color: '#a78bfa' }}>CÁLCULO:</strong> {v.nums_cuadrados} × {COP(precioPorNum)} = <strong style={{ color: 'var(--jordyn-primary)' }}>{COP(total)}</strong><br /></>}
          <strong style={{ color: '#06d6a0' }}>Entregó:</strong> {COP(cobrado)} · <strong style={{ color: deuda > 0 ? '#e63946' : '#06d6a0' }}>{deuda > 0 ? `Debe: ${COP(deuda)}` : 'Saldado ✓'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-jordyn-outline" onClick={onClose}>CERRAR</button>
        </div>
      </div>
    </ModalBase>
  );
}

/* ════════════════════════════════════════════════════════════
   RESUMEN GLOBAL
════════════════════════════════════════════════════════════ */
function ResumenGlobal({ totales, cuentas, porcentaje, precioPorNum, rifaPrecio, onCambiarPct }) {
  const [editPct,  setEditPct]  = useState(false);
  const [pctInput, setPctInput] = useState(String(porcentaje));
  const handleOk = () => {
    const v = parseInt(pctInput);
    if (!v || v < 1 || v > 100) { toast.error('Porcentaje entre 1 y 100'); return; }
    setEditPct(false); onCambiarPct(v);
  };
  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
        {[
          { label: 'TOTAL A COBRAR', val: COP(totales.totalCobrar), color: 'var(--jordyn-primary)', icon: 'bi-cash',               big: false },
          { label: 'YA COBRADO',     val: COP(totales.cobrado),     color: '#06d6a0',               icon: 'bi-check2-circle',       big: false },
          { label: 'TOTAL DEUDA',    val: COP(totales.deuda),       color: '#e63946',               icon: 'bi-exclamation-circle',  big: true  },
          { label: 'SIN CUADRAR',    val: cuentas.sinCuadrar,       color: '#f59e0b',               icon: 'bi-person-exclamation',  big: false },
          { label: 'CUADRADOS',      val: cuentas.cuadrados,        color: '#06d6a0',               icon: 'bi-person-check',        big: false },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--jordyn-bg)', border: `1.5px solid ${c.big ? 'rgba(230,57,70,.3)' : 'var(--jordyn-border)'}`, borderRadius: 9, padding: c.big ? '12px 14px' : '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.44rem', color: c.big ? '#e63946' : 'var(--jordyn-muted)', letterSpacing: '2px' }}>{c.label}</div>
              <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.7rem', opacity: .4 }} />
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: c.big ? '1.8rem' : '1.35rem', color: c.color, letterSpacing: '2px', marginTop: 4, lineHeight: 1 }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: 'rgba(124,58,237,.05)', borderRadius: 8, border: '1px solid rgba(124,58,237,.15)' }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: 'var(--jordyn-muted)', flex: 1 }}>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>% COBRO:</span> <strong style={{ color: 'var(--jordyn-text)' }}>{COP(precioPorNum)}/ticket</strong>
          {rifaPrecio && <span style={{ opacity: .7 }}> ({porcentaje}% de {COP(rifaPrecio)})</span>}
        </div>
        {editPct ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="1" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOk()}
              style={{ width: 60, padding: '4px 8px', border: '1.5px solid #a78bfa', borderRadius: 6, fontFamily: "'Share Tech Mono',monospace", fontSize: '.78rem', textAlign: 'center' }} autoFocus />
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', color: 'var(--jordyn-muted)' }}>%</span>
            <button onClick={handleOk} style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}>OK</button>
            <button onClick={() => { setEditPct(false); setPctInput(String(porcentaje)); }} style={{ background: 'transparent', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '.72rem' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 5 }}>
            {[25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => onCambiarPct(p)}
                style={{ background: p === porcentaje ? '#7c3aed' : '#fff', border: `1.5px solid ${p === porcentaje ? '#7c3aed' : 'rgba(124,58,237,.25)'}`, color: p === porcentaje ? '#fff' : '#7c3aed', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.62rem', fontWeight: 700 }}>{p}%</button>
            ))}
            <button onClick={() => { setEditPct(true); setPctInput(String(porcentaje)); }}
              style={{ background: 'transparent', border: '1px dashed rgba(124,58,237,.3)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '.62rem', fontFamily: "'Share Tech Mono',monospace" }}>
              <i className="bi bi-pencil" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPONENTES MENORES
════════════════════════════════════════════════════════════ */
function SelectorRifa({ rifas, rifaSeleccionada, loading, onSeleccionar }) {
  const fmt = f => f ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Caracas' }) : '—';
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10 }}>
      <div className="jd-spinner" style={{ width: 18, height: 18 }} />
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: 'var(--jordyn-muted)' }}>CARGANDO RIFAS...</span>
    </div>
  );
  if (!rifas.length || rifas.length === 1) return null;
  return (
    <div style={{ background: 'var(--jordyn-bg2)', border: '1.5px solid rgba(124,58,237,.25)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.55rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700, marginBottom: 10 }}>
        <i className="bi bi-collection-fill me-2" />SELECCIONAR RIFA · {rifas.length} activas
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rifas.map(r => {
          const sel = rifaSeleccionada?.id === r.id;
          return (
            <button key={r.id} type="button" onClick={() => onSeleccionar(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: sel ? 'linear-gradient(135deg,rgba(124,58,237,.12),rgba(124,58,237,.06))' : '#fff', border: `2px solid ${sel ? '#7c3aed' : 'var(--jordyn-border)'}`, borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: sel ? '#7c3aed' : 'var(--jordyn-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.95rem', fontWeight: 700, color: sel ? '#7c3aed' : 'var(--jordyn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>🏆 {r.premio} · 📅 {fmt(r.fecha_sorteo)}</div>
              </div>
              {sel && <div style={{ background: '#7c3aed', color: '#fff', borderRadius: 6, padding: '4px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', fontWeight: 700, flexShrink: 0 }}>✓ ACTIVA</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BannerRifa({ rifa }) {
  const dias = rifa.fecha_sorteo ? Math.ceil((new Date(rifa.fecha_sorteo) - new Date()) / 86400000) : null;
  return (
    <div style={{ background: 'linear-gradient(135deg,var(--jordyn-bg2),rgba(10,191,188,.04))', border: '1px solid rgba(10,191,188,.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.3)', color: '#06d6a0', borderRadius: 4, padding: '2px 10px', fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', letterSpacing: '2px' }}>🟢 EN CURSO</span>
          {dias !== null && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.5rem', color: dias <= 3 ? '#e63946' : 'var(--jordyn-muted)' }}>{dias > 0 ? `${dias} días` : 'SORTEO HOY'}</span>}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: '1.5rem', color: 'var(--jordyn-primary)', letterSpacing: '3px' }}>{rifa.nombre}</div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.52rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>
          {COP(rifa.precio)}/boleto · {fmtFecha(rifa.fecha_sorteo)}
          {fmtHora(rifa.hora_sorteo) && ` · 🕐 ${fmtHora(rifa.hora_sorteo)}`}
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
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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

/* ════════════════════════════════════════════════════════════
   ESTILOS
════════════════════════════════════════════════════════════ */
const S = {
  root: { display: 'flex', flexDirection: 'column', gap: 16 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 },
  emptyTitle: { fontFamily: "'Bebas Neue',cursive", fontSize: '1.6rem', color: 'var(--jordyn-muted)', letterSpacing: '4px' },
  emptySub: { fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', textAlign: 'center', maxWidth: 380, lineHeight: 1.8 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 },
  loadingTxt: { fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', color: 'var(--jordyn-muted)', letterSpacing: '3px' },
  toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  filtrosBg: { display: 'flex', gap: 3, background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: 3 },
  filtroBtn: { border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', fontWeight: 700, transition: 'all .15s', whiteSpace: 'nowrap' },
  countLabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: '.58rem', color: 'var(--jordyn-muted)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 10 },
  btnAbono: { background: 'linear-gradient(135deg,#059669,#06d6a0)', border: 'none', color: '#fff', borderRadius: 7, padding: '7px 15px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(6,214,160,.25)' },
  checkGroup: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '5px 10px' },
  checkItem: { display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' },
  checkbox: { width: 20, height: 20, borderRadius: 5, border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 },
  dividerV: { width: 1, height: 18, background: 'var(--jordyn-border)' },
  btnDetalle: { background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '6px 9px', cursor: 'pointer', fontSize: '.75rem' },
  modalSection: { background: 'rgba(124,58,237,.05)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 10, padding: 16 },
  modalLabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700, display: 'block', marginBottom: 10 },
  atajoBtn: { background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: '.6rem' },
  infoCard: { background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '10px 12px' },
  infoCardLabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: '.42rem', color: 'var(--jordyn-muted)', marginBottom: 4, letterSpacing: '1px' },
  infoCardVal: { fontFamily: "'Bebas Neue',cursive", fontSize: '1.15rem', letterSpacing: '2px', lineHeight: 1 },
};