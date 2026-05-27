// ============================================================
//   RIFAS JORDYN — CajaRifa.js
//
//   Ruta: /caja/rifa?rifa=RIFA_ID
//
//   Pantalla de cobro individual por rifa:
//   - Se abre al crear/seleccionar una rifa
//   - Muestra todos los vendedores con sus números (fijos + extras)
//   - Campo de porcentaje configurable (default 50%)
//   - Precio por número calculado = precio_boleto × porcentaje / 100
//   - Cada número en VERDE = pendiente de pago (toca para marcar pagado → ROJO)
//   - La deuda del vendedor baja en tiempo real al marcar números
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota',
  });
};

/* ════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function CajaRifa() {
  const params = new URLSearchParams(window.location.search);
  const rifaId = params.get('rifa');

  const [data,        setData]        = useState(null);   // { rifa, porcentaje, vendedores, ... }
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [porcentaje,  setPorcentaje]  = useState(50);
  const [guardandoPct, setGuardandoPct] = useState(false);
  const [buscar,      setBuscar]      = useState('');
  const [vendedorAbierto, setVendedorAbierto] = useState(null); // id del vendedor expandido

  // Estado local de pagos: { "vendedorId|numero|serie": true|false }
  const [pagosLocal, setPagosLocal] = useState({});

  /* ── Carga ── */
  const cargar = useCallback(async (pct) => {
    if (!rifaId) { setError('Falta el parámetro ?rifa=ID en la URL'); setLoading(false); return; }
    try {
      const r = await API.get(`/caja/rifas/${rifaId}/cobro-vendedores?porcentaje=${pct || porcentaje}`);
      setData(r.data);
      setPorcentaje(r.data.porcentaje);

      // Inicializar pagos locales desde la respuesta
      const map = {};
      for (const v of r.data.vendedores) {
        for (const n of v.numeros) {
          const key = `${v.vendedor_id}|${n.numero}|${n.serie}`;
          map[key] = n.pagado;
        }
      }
      setPagosLocal(map);
    } catch (e) {
      setError('Error cargando datos: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, [rifaId]); // eslint-disable-line

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  /* ── Guardar porcentaje ── */
  const handleGuardarPct = async () => {
    const pct = Math.min(Math.max(Number(porcentaje), 1), 100);
    setGuardandoPct(true);
    try {
      await API.put(`/caja/rifas/${rifaId}/cobro-vendedores/porcentaje`, { porcentaje: pct });
      toast.success(`Porcentaje guardado: ${pct}%`);
      setLoading(true);
      await cargar(pct);
    } catch {
      toast.error('Error guardando porcentaje');
    } finally {
      setGuardandoPct(false);
    }
  };

  /* ── Toggle pago de un número ── */
  const handleToggleNumero = useCallback(async (vendedor, numero, serie, pagadoActual) => {
    const key     = `${vendedor.vendedor_id}|${numero}|${serie}`;
    const nuevoPagado = !pagadoActual;

    // Optimistic update
    setPagosLocal(prev => ({ ...prev, [key]: nuevoPagado }));

    try {
      await API.post(
        `/caja/rifas/${rifaId}/cobro-vendedores/${vendedor.vendedor_id}/pagar-numero`,
        { numero, serie, pagado: nuevoPagado }
      );
    } catch {
      // Revertir
      setPagosLocal(prev => ({ ...prev, [key]: pagadoActual }));
      toast.error('Error actualizando número');
    }
  }, [rifaId]);

  /* ── Calcular totales globales con pagos locales ── */
  const totales = useMemo(() => {
    if (!data) return null;
    let totalCobrar = 0, totalCobrado = 0, totalDeuda = 0, totalPagados = 0, totalNums = 0;
    for (const v of data.vendedores) {
      for (const n of v.numeros) {
        const key    = `${v.vendedor_id}|${n.numero}|${n.serie}`;
        const pagado = pagosLocal[key] ?? n.pagado;
        totalNums++;
        totalCobrar += data.precio_boleto_efectivo;
        if (pagado) {
          totalCobrado += data.precio_boleto_efectivo;
          totalPagados++;
        } else {
          totalDeuda += data.precio_boleto_efectivo;
        }
      }
    }
    return {
      totalCobrar:  +totalCobrar.toFixed(2),
      totalCobrado: +totalCobrado.toFixed(2),
      totalDeuda:   +totalDeuda.toFixed(2),
      totalPagados,
      totalNums,
    };
  }, [data, pagosLocal]);

  /* ── Vendedores filtrados ── */
  const vendedoresFiltrados = useMemo(() => {
    if (!data) return [];
    const q = buscar.toLowerCase();
    return q
      ? data.vendedores.filter(v => v.vendedor_nombre.toLowerCase().includes(q))
      : data.vendedores;
  }, [data, buscar]);

  /* ═══════════ RENDER ═══════════ */
  if (!rifaId) return (
    <Layout title="COBRO RIFA">
      <EstadoVacio mensaje="Falta el parámetro ?rifa=ID en la URL" icono="❌" />
    </Layout>
  );

  if (loading) return (
    <Layout title="COBRO RIFA">
      <div style={S.center}>
        <div className="jd-spinner" style={{ width: 40, height: 40 }} />
        <div style={S.loadingText}>CARGANDO VENDEDORES...</div>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout title="COBRO RIFA">
      <EstadoVacio mensaje={error} icono="⚠️" />
    </Layout>
  );

  const { rifa, precio_boleto_original, precio_boleto_efectivo } = data;

  return (
    <Layout title={`COBRO — ${rifa?.nombre || ''}`}>
      <div style={S.root}>

        {/* ══ HEADER RIFA ══ */}
        <div style={S.rifaBanner}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={S.rifaLabel}>🎟 RIFA EN COBRO</div>
            <div style={S.rifaNombre}>{rifa.nombre}</div>
            <div style={S.rifaMeta}>
              Precio oficial: {COP(precio_boleto_original)} &nbsp;·&nbsp;
              Sorteo: {fmtFecha(rifa.fecha_sorteo)}
              {rifa.loteria_ref ? ` · ${rifa.loteria_ref}` : ''}
            </div>
          </div>

          {/* ── Campo porcentaje ── */}
          <div style={S.pctBox}>
            <div style={S.pctLabel}>% A COBRAR</div>
            <div style={S.pctRow}>
              <input
                type="number"
                min="1"
                max="100"
                value={porcentaje}
                onChange={e => setPorcentaje(e.target.value)}
                style={S.pctInput}
                onKeyDown={e => e.key === 'Enter' && handleGuardarPct()}
              />
              <span style={S.pctSign}>%</span>
              <button
                onClick={handleGuardarPct}
                disabled={guardandoPct}
                style={S.pctBtn}
                title="Aplicar porcentaje"
              >
                {guardandoPct ? '...' : 'APLICAR'}
              </button>
            </div>
            <div style={S.pctResultado}>
              → {COP(precio_boleto_efectivo)} por número
            </div>
            <div style={S.pctAtajos}>
              {[25, 50, 75, 100].map(p => (
                <button
                  key={p}
                  onClick={() => { setPorcentaje(p); }}
                  style={{
                    ...S.pctAtajo,
                    background: Number(porcentaje) === p ? 'var(--jordyn-primary)' : 'var(--jordyn-bg)',
                    color:      Number(porcentaje) === p ? '#000' : 'var(--jordyn-muted)',
                    borderColor: Number(porcentaje) === p ? 'var(--jordyn-primary)' : 'var(--jordyn-border)',
                  }}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RESUMEN GLOBAL ══ */}
        {totales && (
          <div style={S.resumenGrid}>
            {[
              { label: 'TOTAL A COBRAR', value: COP(totales.totalCobrar),  color: 'var(--jordyn-primary)', icon: 'bi-cash-stack' },
              { label: 'YA COBRADO',     value: COP(totales.totalCobrado), color: '#06d6a0',              icon: 'bi-check2-all' },
              { label: 'PENDIENTE',      value: COP(totales.totalDeuda),   color: '#e63946',              icon: 'bi-exclamation-circle' },
              { label: 'NÚMEROS',        value: `${totales.totalPagados}/${totales.totalNums}`, color: 'var(--jordyn-text)', icon: 'bi-grid-3x3',
                sub: `${totales.totalNums - totales.totalPagados} por cobrar` },
            ].map(c => (
              <div key={c.label} style={S.resumenCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={S.resumenCardLabel}>{c.label}</div>
                  <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '.75rem', opacity: .35 }} />
                </div>
                <div style={{ ...S.resumenCardValue, color: c.color }}>{c.value}</div>
                {c.sub && <div style={S.resumenCardSub}>{c.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ══ BUSCADOR ══ */}
        <div style={S.toolbarRow}>
          <input
            className="jd-input"
            placeholder="🔍 Buscar vendedor..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ maxWidth: 240, fontSize: '.8rem', padding: '.3rem .7rem' }}
          />
          <div style={S.countLabel}>
            {vendedoresFiltrados.length} vendedor{vendedoresFiltrados.length !== 1 ? 'es' : ''}
          </div>
          <div style={S.leyendaRow}>
            <span style={S.leyendaVerde}>● Pendiente (toca para cobrar)</span>
            <span style={S.leyendaRojo}>● Cobrado</span>
          </div>
        </div>

        {/* ══ TARJETAS VENDEDORES ══ */}
        {vendedoresFiltrados.length === 0 ? (
          <EstadoVacio mensaje="No hay vendedores con números asignados en esta rifa." icono="👤" />
        ) : (
          <div style={S.vendedoresList}>
            {vendedoresFiltrados.map(v => (
              <TarjetaVendedor
                key={v.vendedor_id}
                vendedor={v}
                pagosLocal={pagosLocal}
                precioPorNum={precio_boleto_efectivo}
                onToggleNumero={handleToggleNumero}
                abierto={vendedorAbierto === v.vendedor_id}
                onToggleAbrir={() =>
                  setVendedorAbierto(prev => prev === v.vendedor_id ? null : v.vendedor_id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

/* ════════════════════════════════════════════════════════════
   TARJETA VENDEDOR
════════════════════════════════════════════════════════════ */
function TarjetaVendedor({ vendedor, pagosLocal, precioPorNum, onToggleNumero, abierto, onToggleAbrir }) {
  // Calcular métricas con estado local
  const { numeros, vendedor_id, vendedor_nombre } = vendedor;

  const { pagados, pendientes, cobrado, deuda, totalCobrar } = useMemo(() => {
    let pag = 0, pend = 0;
    for (const n of numeros) {
      const key = `${vendedor_id}|${n.numero}|${n.serie}`;
      if (pagosLocal[key] ?? n.pagado) pag++; else pend++;
    }
    return {
      pagados:     pag,
      pendientes:  pend,
      cobrado:     +(precioPorNum * pag).toFixed(2),
      deuda:       +(precioPorNum * pend).toFixed(2),
      totalCobrar: +(precioPorNum * numeros.length).toFixed(2),
    };
  }, [numeros, pagosLocal, vendedor_id, precioPorNum]);

  const pct = numeros.length > 0 ? Math.round((pagados / numeros.length) * 100) : 0;
  const estadoColor = pct === 100 ? '#06d6a0' : pct > 0 ? '#ffc107' : '#e63946';
  const estadoLabel = pct === 100 ? '✅ PAGADO' : pct > 0 ? `⚠️ ${pct}%` : '🔴 PENDIENTE';

  return (
    <div style={{ ...S.vendCard, borderColor: pct === 100 ? 'rgba(6,214,160,.35)' : 'var(--jordyn-border)' }}>

      {/* ── Cabecera ── */}
      <div style={S.vendHeader} onClick={onToggleAbrir}>
        {/* Estado pill */}
        <div style={{ ...S.estadoPill, color: estadoColor, borderColor: estadoColor + '50', background: estadoColor + '12' }}>
          {estadoLabel}
        </div>

        {/* Nombre */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={S.vendNombre}>{vendedor_nombre}</div>
          <div style={S.vendMeta}>
            {numeros.length} número{numeros.length !== 1 ? 's' : ''}
            {numeros.some(n => n.origen === 'extra') && (
              <span style={S.extraBadge}>+extras</span>
            )}
          </div>
        </div>

        {/* Montos */}
        <div style={S.vendMontos}>
          {[
            ['TOTAL',    COP(totalCobrar), 'var(--jordyn-text)'],
            ['COBRADO',  COP(cobrado),     '#06d6a0'],
            ['DEUDA',    COP(deuda),       deuda > 0 ? '#e63946' : '#06d6a0'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ textAlign: 'right' }}>
              <div style={S.montoLabel}>{k}</div>
              <div style={{ ...S.montoValor, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Chevron */}
        <i
          className={`bi bi-chevron-${abierto ? 'up' : 'down'}`}
          style={{ color: 'var(--jordyn-muted)', fontSize: '.8rem', flexShrink: 0 }}
        />
      </div>

      {/* Barra progreso */}
      <div style={S.progBarBg}>
        <div style={{ ...S.progBarFill, width: `${pct}%`, background: estadoColor }} />
      </div>

      {/* ── Panel de números ── */}
      {abierto && (
        <div style={S.numsPanel}>
          <div style={S.numsInfo}>
            Toca un número para marcarlo como cobrado.&nbsp;
            <span style={{ color: '#06d6a0' }}>Verde</span> = pendiente,&nbsp;
            <span style={{ color: '#e63946' }}>Rojo</span> = cobrado.
          </div>
          <div style={S.numsGrid}>
            {numeros.map(n => {
              const key    = `${vendedor_id}|${n.numero}|${n.serie}`;
              const pagado = pagosLocal[key] ?? n.pagado;
              return (
                <button
                  key={key}
                  onClick={() => onToggleNumero(vendedor, n.numero, n.serie, pagado)}
                  title={pagado ? `${n.numero}-${n.serie}: COBRADO — toca para revertir` : `${n.numero}-${n.serie}: PENDIENTE — toca para marcar cobrado`}
                  style={{
                    ...S.numChip,
                    background:   pagado ? 'rgba(230,57,70,.15)'  : 'rgba(6,214,160,.12)',
                    borderColor:  pagado ? 'rgba(230,57,70,.45)'  : 'rgba(6,214,160,.45)',
                    color:        pagado ? '#e63946'              : '#06d6a0',
                    textDecoration: pagado ? 'line-through' : 'none',
                    opacity:      pagado ? 0.75 : 1,
                  }}
                >
                  {n.numero}
                  {n.serie && n.serie !== 'A' && (
                    <span style={{ fontSize: '.45rem', marginLeft: 1, opacity: .7 }}>{n.serie}</span>
                  )}
                  {n.origen === 'extra' && (
                    <span style={{ fontSize: '.4rem', marginLeft: 1, color: '#a78bfa' }}>+</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Resumen rápido */}
          <div style={S.numsResumen}>
            <span style={{ color: '#06d6a0' }}>● {pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>
            <span style={{ color: '#e63946', marginLeft: 12 }}>● {pagados} cobrado{pagados !== 1 ? 's' : ''}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--jordyn-muted)' }}>
              Deuda restante: <strong style={{ color: deuda > 0 ? '#e63946' : '#06d6a0' }}>{COP(deuda)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ESTADO VACÍO
════════════════════════════════════════════════════════════ */
function EstadoVacio({ mensaje, icono }) {
  return (
    <div style={S.center}>
      <div style={{ fontSize: '2.5rem', opacity: .3, marginBottom: 12 }}>{icono}</div>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '.7rem', color: 'var(--jordyn-muted)', letterSpacing: '2px', textAlign: 'center', maxWidth: 360, lineHeight: 1.8 }}>
        {mensaje}
      </div>
      <a href="/rifas" style={{ marginTop: 18, color: 'var(--jordyn-primary)', fontFamily: "'Share Tech Mono',monospace", fontSize: '.65rem', letterSpacing: '1px' }}>
        ← VOLVER A RIFAS
      </a>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ESTILOS
════════════════════════════════════════════════════════════ */
const S = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    gap:           14,
  },
  center: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      360,
    gap:            10,
  },
  loadingText: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.7rem',
    color:         'var(--jordyn-muted)',
    letterSpacing: '3px',
  },

  /* Banner rifa */
  rifaBanner: {
    background:    'var(--jordyn-bg2)',
    border:        '1px solid var(--jordyn-border)',
    borderRadius:  10,
    padding:       '16px 20px',
    display:       'flex',
    alignItems:    'flex-start',
    gap:           20,
    flexWrap:      'wrap',
  },
  rifaLabel: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.5rem',
    color:         'var(--jordyn-primary)',
    letterSpacing: '3px',
    marginBottom:  4,
  },
  rifaNombre: {
    fontFamily:    "'Bebas Neue',cursive",
    fontSize:      '1.6rem',
    color:         'var(--jordyn-primary)',
    letterSpacing: '3px',
    lineHeight:    1,
  },
  rifaMeta: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.52rem',
    color:         'var(--jordyn-muted)',
    marginTop:     4,
  },

  /* Porcentaje */
  pctBox: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    flexShrink:    0,
    minWidth:      200,
  },
  pctLabel: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.48rem',
    color:         'var(--jordyn-muted)',
    letterSpacing: '2px',
  },
  pctRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
  },
  pctInput: {
    width:         70,
    padding:       '6px 8px',
    border:        '1.5px solid var(--jordyn-primary)',
    borderRadius:  6,
    background:    'var(--jordyn-bg)',
    color:         'var(--jordyn-text)',
    fontFamily:    "'Bebas Neue',cursive",
    fontSize:      '1.1rem',
    letterSpacing: '2px',
    textAlign:     'center',
    outline:       'none',
  },
  pctSign: {
    fontFamily:    "'Bebas Neue',cursive",
    fontSize:      '1rem',
    color:         'var(--jordyn-primary)',
    letterSpacing: '1px',
  },
  pctBtn: {
    padding:       '6px 14px',
    background:    'var(--jordyn-primary)',
    border:        'none',
    borderRadius:  6,
    color:         '#000',
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.6rem',
    fontWeight:    700,
    letterSpacing: '1px',
    cursor:        'pointer',
  },
  pctResultado: {
    fontFamily:    "'Bebas Neue',cursive",
    fontSize:      '.9rem',
    color:         '#06d6a0',
    letterSpacing: '2px',
  },
  pctAtajos: {
    display: 'flex',
    gap:     5,
  },
  pctAtajo: {
    padding:       '3px 10px',
    border:        '1px solid',
    borderRadius:  4,
    cursor:        'pointer',
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.55rem',
    fontWeight:    700,
    transition:    'all .15s',
  },

  /* Resumen */
  resumenGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
    gap:                 8,
  },
  resumenCard: {
    background:   'var(--jordyn-bg2)',
    border:       '1px solid var(--jordyn-border)',
    borderRadius: 9,
    padding:      '10px 14px',
  },
  resumenCardLabel: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.46rem',
    color:         'var(--jordyn-muted)',
    letterSpacing: '2px',
  },
  resumenCardValue: {
    fontFamily:    "'Bebas Neue',cursive",
    fontSize:      '1.35rem',
    letterSpacing: '2px',
    lineHeight:    1.1,
    marginTop:     3,
  },
  resumenCardSub: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.43rem',
    color:         'var(--jordyn-muted)',
    marginTop:     2,
  },

  /* Toolbar */
  toolbarRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    flexWrap:   'wrap',
  },
  countLabel: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.58rem',
    color:         'var(--jordyn-muted)',
    letterSpacing: '1px',
  },
  leyendaRow: {
    display:    'flex',
    gap:        12,
    marginLeft: 'auto',
    flexWrap:   'wrap',
  },
  leyendaVerde: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.55rem',
    color:         '#06d6a0',
    letterSpacing: '1px',
  },
  leyendaRojo: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.55rem',
    color:         '#e63946',
    letterSpacing: '1px',
  },

  /* Lista vendedores */
  vendedoresList: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },

  /* Tarjeta vendedor */
  vendCard: {
    background:    'var(--jordyn-bg2)',
    border:        '1.5px solid',
    borderRadius:  10,
    overflow:      'hidden',
    transition:    'border-color .2s',
  },
  vendHeader: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    padding:    '11px 14px',
    cursor:     'pointer',
    flexWrap:   'wrap',
    userSelect: 'none',
  },
  estadoPill: {
    borderRadius:  4,
    padding:       '2px 9px',
    border:        '1px solid',
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.5rem',
    letterSpacing: '1px',
    flexShrink:    0,
    whiteSpace:    'nowrap',
  },
  vendNombre: {
    fontFamily:  "'Oswald',sans-serif",
    fontSize:    '.95rem',
    fontWeight:  600,
    color:       'var(--jordyn-text)',
    lineHeight:  1.1,
  },
  vendMeta: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.5rem',
    color:         'var(--jordyn-muted)',
    marginTop:     1,
  },
  extraBadge: {
    marginLeft:    6,
    background:    'rgba(167,139,250,.12)',
    border:        '1px solid rgba(167,139,250,.3)',
    color:         '#a78bfa',
    borderRadius:  3,
    padding:       '0 5px',
    fontSize:      '.44rem',
    letterSpacing: '1px',
  },
  vendMontos: {
    display:    'flex',
    gap:        12,
    flexShrink: 0,
    flexWrap:   'wrap',
    marginLeft: 'auto',
  },
  montoLabel: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.42rem',
    color:         'var(--jordyn-muted)',
    letterSpacing: '1px',
  },
  montoValor: {
    fontFamily:    "'Bebas Neue',cursive",
    fontSize:      '.95rem',
    letterSpacing: '2px',
    lineHeight:    1,
  },

  /* Barra progreso */
  progBarBg: {
    height:     3,
    background: 'var(--jordyn-bg)',
    margin:     '0 14px',
  },
  progBarFill: {
    height:     '100%',
    borderRadius: 2,
    transition: 'width .4s, background .3s',
  },

  /* Panel números */
  numsPanel: {
    padding:       '14px 16px',
    borderTop:     '1px solid var(--jordyn-border)',
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
  },
  numsInfo: {
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.52rem',
    color:         'var(--jordyn-muted)',
    letterSpacing: '1px',
  },
  numsGrid: {
    display:   'flex',
    flexWrap:  'wrap',
    gap:       5,
  },
  numChip: {
    padding:       '5px 10px',
    border:        '1.5px solid',
    borderRadius:  5,
    fontFamily:    "'Share Tech Mono',monospace",
    fontSize:      '.68rem',
    fontWeight:    700,
    cursor:        'pointer',
    transition:    'all .15s',
    userSelect:    'none',
    letterSpacing: '0.5px',
    display:       'flex',
    alignItems:    'center',
    gap:           2,
  },
  numsResumen: {
    display:    'flex',
    alignItems: 'center',
    flexWrap:   'wrap',
    fontFamily: "'Share Tech Mono',monospace",
    fontSize:   '.56rem',
    marginTop:  2,
  },
};
