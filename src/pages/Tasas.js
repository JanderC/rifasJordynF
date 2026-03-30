// ============================================================
//   Tasas.js — RIFAS JORDYN
//   ✅ Tasa COP/USD  — configurable manualmente
//   ✅ Tasa BSD/USD  — bolívares digitales, configurable
//   ✅ Calculadora   — Bs → USD → COP con ambas tasas
//   ✅ Referencia    — dólar paralelo ve.dolarapi.com en vivo
//   ✅ Fechas        — America/Caracas (sin desfase UTC)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ─── Formateadores ─── */
const fmtCOP = v =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const fmtBs = v =>
  `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`;

const fmtFecha = f =>
  f ? new Date(f).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Caracas',
  }) : '—';

/* ─── Config visual de cada tasa ─── */
const TASAS_CONFIG = {
  COP_POR_USD: {
    label:       'Tasa COP / USD',
    descripcion: 'Pesos colombianos equivalentes a 1 dólar. Se usa para Zelle y conversiones generales.',
    icono:       '🇨🇴',
    monedaBase:  'COP',
    monedaRef:   'USD',
    placeholder: '4200',
    step:        '1',
    hint:    v => `1 USD = ${fmtCOP(v)} · 1 COP = $${(1 / v).toFixed(6)} USD`,
    ejemplo: v => `Un boleto de ${fmtCOP(10000)} equivale a $${(10000 / v).toFixed(2)} USD`,
    accentColor: 'var(--jordyn-primary)',
    accentAlpha: 'rgba(10,191,188,',
  },
  BSD_POR_USD: {
    label:       'Tasa BsD / USD',
    descripcion: 'Bolívares digitales equivalentes a 1 dólar. Referencia para Pago Móvil.',
    icono:       '🇻🇪',
    monedaBase:  'BsD',
    monedaRef:   'USD',
    placeholder: '45.00',
    step:        '0.01',
    hint:    v => `1 USD = ${fmtBs(v)} · 1 BsD = $${(1 / v).toFixed(6)} USD`,
    ejemplo: v => `Un boleto de ${fmtCOP(10000)} a COP/USD 4.200 → $2.38 USD → ${fmtBs(2.38 * v)}`,
    accentColor: 'var(--jordyn-gold)',
    accentAlpha: 'rgba(240,165,0,',
  },
};

/* ─── Hook: dólar paralelo Venezuela ─── */
function useDolarParalelo() {
  const [data, setData] = useState({ tasa: null, fuente: null, fecha: null });
  useEffect(() => {
    fetch('https://ve.dolarapi.com/v1/dolares')
      .then(r => r.json())
      .then(arr => {
        const paralelo = arr.find(d => d.fuente === 'paralelo');
        if (paralelo?.promedio) setData({
          tasa:  paralelo.promedio,
          fuente:'paralelo',
          fecha: paralelo.fechaActualizacion || null,
        });
      })
      .catch(() => {});
  }, []);
  return data;
}

/* ═══════════════════════════════════════════════════════════
   CALCULADORA Bs → USD → COP
═══════════════════════════════════════════════════════════ */
function Calculadora({ tasas }) {
  const [montoBS,  setMontoBS]  = useState('');
  const [resultado, setRes]     = useState(null);
  const paralelo = useDolarParalelo();

  const copUsd   = parseFloat(tasas?.COP_POR_USD?.valor || 4200);
  const bsdUsd   = parseFloat(tasas?.BSD_POR_USD?.valor || 0);
  const tasaActiva = bsdUsd > 0 ? bsdUsd : (paralelo.tasa || 0);

  const calcular = () => {
    const bs = parseFloat(montoBS);
    if (!bs || bs <= 0)   { toast.error('Ingresa un monto en bolívares válido'); return; }
    if (!tasaActiva)       { toast.error('No hay tasa BsD/USD disponible. Guárdala primero.'); return; }
    const usd = bs / tasaActiva;
    const cop = usd * copUsd;
    setRes({ bs, tasaUsada: tasaActiva, usd, cop, copUsd,
      fuenteTasa: bsdUsd > 0 ? 'manual' : 'paralelo' });
  };

  return (
    <div className="jd-card fade-in" style={{ borderLeft: '3px solid var(--jordyn-gold)' }}>

      {/* Título */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{
          width:40, height:40, borderRadius:10, flexShrink:0,
          background:'rgba(240,165,0,.12)', border:'2px solid rgba(240,165,0,.3)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem',
        }}>💱</div>
        <div>
          <div style={{ fontWeight:800, fontSize:'.92rem', color:'var(--jordyn-gold)' }}>
            Calculadora Bs → COP
          </div>
          <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:1 }}>
            Convierte bolívares a pesos colombianos usando las tasas configuradas arriba
          </div>
        </div>
      </div>

      <div className="row g-3 align-items-end">

        {/* Input monto */}
        <div className="col-12 col-md-5">
          <label className="jd-label">MONTO EN BOLÍVARES (BsD)</label>
          <div style={{ position:'relative' }}>
            <input
              className="jd-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 500.00"
              value={montoBS}
              onChange={e => { setMontoBS(e.target.value); setRes(null); }}
              style={{ fontWeight:800, fontSize:'1.1rem', paddingRight:52 }}
            />
            <span style={{
              position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
              fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)',
            }}>BsD</span>
          </div>
          {/* Indicador de tasa a usar */}
          <div style={{ fontSize:'.64rem', color:'var(--jordyn-muted)', marginTop:5, lineHeight:1.5 }}>
            {bsdUsd > 0
              ? <><i className="bi bi-check-circle-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
                  Tasa manual: 1 USD = {fmtBs(bsdUsd)}</>
              : paralelo.tasa
                ? <><i className="bi bi-wifi me-1" style={{ color:'var(--jordyn-gold)' }}></i>
                    Sin tasa manual — usando paralelo: 1 USD = {fmtBs(paralelo.tasa)}</>
                : <><i className="bi bi-exclamation-circle me-1" style={{ color:'#e63946' }}></i>
                    Sin tasa BsD configurada ni API disponible</>
            }
          </div>
        </div>

        {/* Tasas activas (referencia visual) */}
        <div className="col-12 col-md-4">
          <div style={{
            background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)',
            borderRadius:10, padding:'10px 14px',
          }}>
            <div style={{ fontSize:'.55rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>
              Tasas activas
            </div>
            <div style={{ fontSize:'.78rem', fontWeight:700, lineHeight:1.9 }}>
              <span style={{ color:'var(--jordyn-gold)' }}>
                1 USD = {tasaActiva ? fmtBs(tasaActiva) : '—'}
              </span>
              <br />
              <span style={{ color:'var(--jordyn-primary)' }}>
                1 USD = {fmtCOP(copUsd)}
              </span>
            </div>
          </div>
        </div>

        {/* Botón */}
        <div className="col-12 col-md-3">
          <button
            className="btn-jordyn w-100"
            onClick={calcular}
            style={{ fontSize:'.88rem' }}
          >
            <i className="bi bi-calculator-fill me-1"></i> Convertir
          </button>
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="fade-in" style={{
          marginTop:18, padding:'16px 20px',
          background:'rgba(240,165,0,.06)', border:'1.5px solid rgba(240,165,0,.25)',
          borderRadius:12,
        }}>
          <div style={{ fontSize:'.56rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>
            Resultado de conversión
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'center' }}>

            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'.5rem', color:'var(--jordyn-muted)', marginBottom:2 }}>Bolívares</div>
              <div style={{ fontSize:'1.1rem', fontWeight:900, color:'var(--jordyn-gold)' }}>
                {fmtBs(resultado.bs)}
              </div>
            </div>

            <div style={{ color:'var(--jordyn-muted)', fontSize:'1.2rem', fontWeight:700 }}>→</div>

            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'.5rem', color:'var(--jordyn-muted)', marginBottom:2 }}>Pesos colombianos</div>
              <div style={{ fontSize:'1.35rem', fontWeight:900, color:'var(--jordyn-primary)' }}>
                {fmtCOP(resultado.cop)}
              </div>
            </div>

            <div style={{ marginLeft:'auto', fontSize:'.62rem', color:'var(--jordyn-muted)', textAlign:'right', lineHeight:1.7, flexShrink:0 }}>
              <i className={`bi bi-${resultado.fuenteTasa === 'manual' ? 'sliders' : 'wifi'} me-1`}></i>
              Bs/USD: {fmtBs(resultado.tasaUsada)} ({resultado.fuenteTasa === 'manual' ? 'manual' : 'paralelo'})
              <br />
              COP/USD: {fmtCOP(resultado.copUsd)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function Tasas() {
  const [tasas,   setTasas]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState('');
  const [edits,   setEdits]   = useState({});
  const paralelo = useDolarParalelo();

  const load = useCallback(async () => {
    try {
      const res = await API.get('/tasas');
      setTasas(res.data);
      const init = {};
      Object.entries(res.data).forEach(([k, v]) => { init[k] = String(v.valor); });
      setEdits(init);
    } catch { toast.error('Error cargando tasas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (clave) => {
    const valorStr = edits[clave];
    const valor    = parseFloat(valorStr?.replace(/[^0-9.]/g, ''));
    if (!valor || valor <= 0) { toast.error('Ingresa un valor válido mayor a cero'); return; }
    setSaving(clave);
    try {
      await API.put(`/tasas/${clave}`, { valor });
      toast.success('✅ Tasa actualizada correctamente');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(''); }
  };

  const cfg = clave => TASAS_CONFIG[clave] || {
    label: clave, descripcion: '', icono: '💱',
    monedaBase: '', monedaRef: '', placeholder: '0', step: '1',
    hint: () => '', ejemplo: () => '',
    accentColor: 'var(--jordyn-primary)',
    accentAlpha: 'rgba(10,191,188,',
  };

  // Orden fijo: COP primero, BSD segundo
  const ORDER  = ['COP_POR_USD', 'BSD_POR_USD'];
  const allKeys = { ...TASAS_CONFIG, ...tasas };
  const claves = [
    ...ORDER.filter(k => k in allKeys),
    ...Object.keys(allKeys).filter(k => !ORDER.includes(k)),
  ];

  return (
    <Layout title="TASAS DE CAMBIO">

      {/* Descripción */}
      <div style={{ marginBottom:28 }}>
        <p style={{ fontSize:'.82rem', color:'var(--jordyn-muted)', margin:0, lineHeight:1.6 }}>
          <i className="bi bi-info-circle me-1"></i>
          Configura aquí las tasas del sistema.
          <strong> COP/USD</strong> se aplica en Zelle y conversiones generales.
          <strong> BsD/USD</strong> es la referencia para Pago Móvil — si no la guardas, el sistema
          usa el dólar paralelo de <code>ve.dolarapi.com</code> en tiempo real como respaldo.
          El cliente nunca ve la tasa, solo el monto convertido.
        </p>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* ─── Card por cada tasa ─── */}
          {claves.map(clave => {
            const c     = cfg(clave);
            const tasa  = tasas[clave];
            const valor = parseFloat(edits[clave] || tasa?.valor || 0);
            const dirty = parseFloat(edits[clave]) !== tasa?.valor;
            const aa    = c.accentAlpha || 'rgba(10,191,188,';

            return (
              <div key={clave} className="jd-card jd-card-primary fade-in">

                {/* Cabecera */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{
                      width:48, height:48, borderRadius:12, flexShrink:0,
                      background:`${aa}0.10)`, border:`2px solid ${aa}0.25)`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem',
                    }}>{c.icono}</div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:'1rem', color:c.accentColor }}>{c.label}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginTop:2 }}>{c.descripcion}</div>
                    </div>
                  </div>
                  {tasa?.updated_at && (
                    <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', textAlign:'right', flexShrink:0 }}>
                      <i className="bi bi-clock me-1"></i>
                      Actualizado: {fmtFecha(tasa.updated_at)}
                    </div>
                  )}
                </div>

                <div className="row g-3 align-items-end">

                  {/* Input */}
                  <div className="col-12 col-md-5">
                    <label className="jd-label">1 {c.monedaRef} = ? {c.monedaBase}</label>
                    <div style={{ position:'relative' }}>
                      <input
                        className="jd-input"
                        type="number"
                        min="0.01"
                        step={c.step}
                        value={edits[clave] ?? ''}
                        onChange={e => setEdits(p => ({ ...p, [clave]: e.target.value }))}
                        placeholder={c.placeholder}
                        style={{ fontWeight:800, fontSize:'1.1rem', paddingRight:56 }}
                      />
                      <span style={{
                        position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                        fontSize:'.72rem', fontWeight:700, color:'var(--jordyn-muted)',
                      }}>{c.monedaBase}</span>
                    </div>
                    {valor > 0 && (
                      <div style={{ fontSize:'.7rem', color:c.accentColor, marginTop:5, fontWeight:600 }}>
                        {c.hint(valor)}
                      </div>
                    )}
                  </div>

                  {/* Ejemplo */}
                  <div className="col-12 col-md-4">
                    {valor > 0 && (
                      <div style={{
                        background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)',
                        borderRadius:10, padding:'10px 14px',
                      }}>
                        <div style={{ fontSize:'.58rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>
                          Ejemplo
                        </div>
                        <div style={{ fontSize:'.78rem', color:'var(--jordyn-text)', fontWeight:600 }}>
                          {c.ejemplo(valor)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botón guardar */}
                  <div className="col-12 col-md-3">
                    <button
                      className="btn-jordyn w-100"
                      onClick={() => handleSave(clave)}
                      disabled={saving === clave || !dirty}
                      style={{ fontSize:'.85rem' }}
                    >
                      {saving === clave
                        ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando...</>
                        : dirty
                          ? <><i className="bi bi-floppy-fill me-1"></i>Guardar</>
                          : <><i className="bi bi-check2 me-1"></i>Guardado</>
                      }
                    </button>
                  </div>
                </div>

                {/* ─── Referencia paralelo (COP y BSD) ─── */}
                {(clave === 'COP_POR_USD' || clave === 'BSD_POR_USD') && (
                  <div style={{
                    marginTop:18, borderTop:'1px solid var(--jordyn-border)',
                    paddingTop:16, display:'flex', flexDirection:'column', gap:10,
                  }}>
                    <div style={{ fontSize:'.66rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px' }}>
                      <i className="bi bi-globe2 me-1"></i>Referencia en tiempo real — Dólar Paralelo Venezuela
                    </div>

                    <div style={{
                      background:`${aa}0.06)`, border:`1px solid ${aa}0.20)`,
                      borderRadius:10, padding:'12px 16px',
                      display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:'1.3rem' }}>🇻🇪</span>
                        <div>
                          <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--jordyn-text)' }}>
                            Dólar Paralelo Venezuela
                          </div>
                          <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)' }}>
                            ve.dolarapi.com · actualización automática
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        {paralelo.tasa ? (
                          <>
                            <div style={{ fontSize:'1.1rem', fontWeight:900, color:c.accentColor }}>
                              {fmtBs(paralelo.tasa)}
                            </div>
                            <div style={{ fontSize:'.58rem', color:'var(--jordyn-muted)' }}>por 1 USD</div>
                            {paralelo.fecha && (
                              <div style={{ fontSize:'.54rem', color:'var(--jordyn-muted)', marginTop:2 }}>
                                {fmtFecha(paralelo.fecha)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize:'.75rem', color:'var(--jordyn-muted)' }}>
                            <span className="jd-spinner" style={{ width:14, height:14, borderWidth:2, display:'inline-block', marginRight:4 }}></span>
                            Cargando...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nota explicativa */}
                    <div style={{
                      background:'rgba(240,165,0,.05)', border:'1px solid rgba(240,165,0,.18)',
                      borderRadius:8, padding:'8px 12px',
                      fontSize:'.7rem', color:'var(--jordyn-muted)', lineHeight:1.55,
                    }}>
                      <i className="bi bi-lightbulb me-1" style={{ color:'var(--jordyn-gold)' }}></i>
                      {clave === 'BSD_POR_USD'
                        ? <>La tasa <strong>BsD/USD</strong> que guardes aquí actúa como <strong>respaldo</strong>.
                            En el módulo del cliente (Pago Móvil), el monto en bolívares se calcula primero
                            con la tasa paralela en tiempo real; si la API no responde, usa esta tasa manual.</>
                        : <>La tasa <strong>COP/USD</strong> la configuras tú manualmente. Se aplica en Zelle
                            y en la calculadora inferior. La referencia venezolana es informativa para que puedas
                            ajustar el valor de forma coherente con el mercado.</>
                      }
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ─── Calculadora Bs → COP ─── */}
          <Calculadora tasas={tasas} />

          {/* Sin tasas en BD */}
          {Object.keys(tasas).length === 0 && (
            <div className="jd-alert jd-alert-warning">
              <i className="bi bi-exclamation-triangle-fill"></i>
              No hay tasas configuradas. Verifica que la migración SQL se ejecutó correctamente.
            </div>
          )}

        </div>
      )}
    </Layout>
  );
}