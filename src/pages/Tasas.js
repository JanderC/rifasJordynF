import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const fmtCOP = v =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const fmtFecha = f =>
  f ? new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/* ─── Config de cada tasa conocida ─── */
const TASAS_CONFIG = {
  COP_POR_USD: {
    label:      'Tasa COP / USD',
    descripcion:'Cuántos pesos colombianos equivalen a 1 dólar estadounidense',
    icono:      '🇨🇴',
    monedaBase: 'COP',
    monedaRef:  'USD',
    placeholder:'4200',
    hint:       (v) => `1 USD = ${fmtCOP(v)} · 1 COP = $${(1 / v).toFixed(6)} USD`,
    ejemplo:    (v) => `Un boleto de ${fmtCOP(10000)} equivale a $${(10000 / v).toFixed(2)} USD`,
  },
};

/* ─── Tipos de cambio externos (referencia visual) ─── */
function useDolarParalelo() {
  const [tasa, setTasa] = useState(null);
  useEffect(() => {
    fetch('https://ve.dolarapi.com/v1/dolares')
      .then(r => r.json())
      .then(data => {
        const paralelo = data.find(d => d.fuente === 'paralelo');
        if (paralelo?.promedio) setTasa(paralelo.promedio);
      })
      .catch(() => {});
  }, []);
  return tasa;
}

/* ─── Componente principal ─── */
export default function Tasas() {
  const [tasas,   setTasas]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState('');   // clave de la tasa que se está guardando
  const [edits,   setEdits]   = useState({});   // { COP_POR_USD: '4200' }
  const tasaBsParalelo = useDolarParalelo();

  const load = useCallback(async () => {
    try {
      const res = await API.get('/tasas');
      setTasas(res.data);
      // Inicializar edits con los valores actuales
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

  const cfg = (clave) => TASAS_CONFIG[clave] || {
    label: clave, descripcion: '', icono: '💱',
    monedaBase: '', monedaRef: '',
    placeholder: '0', hint: () => '', ejemplo: () => '',
  };

  return (
    <Layout title="TASAS DE CAMBIO">

      {/* Encabezado */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', margin: 0 }}>
          <i className="bi bi-info-circle me-1"></i>
          Estas tasas se usan para mostrar precios en otras monedas en la tienda pública.
          El cliente solo ve el monto convertido, no la tasa.
        </p>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── Card por cada tasa ─── */}
          {Object.keys({ ...TASAS_CONFIG, ...tasas }).map(clave => {
            const c     = cfg(clave);
            const tasa  = tasas[clave];
            const valor = parseFloat(edits[clave] || tasa?.valor || 0);
            const dirty = parseFloat(edits[clave]) !== tasa?.valor;

            return (
              <div key={clave} className="jd-card jd-card-primary fade-in">
                {/* Cabecera */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: 'rgba(10,191,188,0.1)', border: '2px solid rgba(10,191,188,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem',
                    }}>{c.icono}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--jordyn-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>{c.descripcion}</div>
                    </div>
                  </div>
                  {tasa?.updated_at && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--jordyn-muted)', textAlign: 'right', flexShrink: 0 }}>
                      <i className="bi bi-clock me-1"></i>
                      Actualizado: {fmtFecha(tasa.updated_at)}
                    </div>
                  )}
                </div>

                <div className="row g-3 align-items-end">

                  {/* Input de tasa */}
                  <div className="col-12 col-md-5">
                    <label className="jd-label">
                      1 {c.monedaRef} = ? {c.monedaBase}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="jd-input"
                        type="number"
                        min="1"
                        step="1"
                        value={edits[clave] ?? ''}
                        onChange={e => setEdits(p => ({ ...p, [clave]: e.target.value }))}
                        placeholder={c.placeholder}
                        style={{ fontWeight: 800, fontSize: '1.1rem', paddingRight: '56px' }}
                      />
                      <span style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        fontSize: '0.72rem', fontWeight: 700, color: 'var(--jordyn-muted)',
                      }}>{c.monedaBase}</span>
                    </div>
                    {/* Hint en vivo */}
                    {valor > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--jordyn-primary)', marginTop: 5, fontWeight: 600 }}>
                        {c.hint(valor)}
                      </div>
                    )}
                  </div>

                  {/* Ejemplo de conversión */}
                  <div className="col-12 col-md-4">
                    {valor > 0 && (
                      <div style={{
                        background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)',
                        borderRadius: 10, padding: '10px 14px',
                      }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                          Ejemplo
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--jordyn-text)', fontWeight: 600 }}>
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
                      style={{ fontSize: '0.85rem' }}
                    >
                      {saving === clave
                        ? <><span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Guardando...</>
                        : dirty
                        ? <><i className="bi bi-floppy-fill me-1"></i>Guardar</>
                        : <><i className="bi bi-check2 me-1"></i>Guardado</>
                      }
                    </button>
                  </div>
                </div>

                {/* ─── Referencia externa: dólar paralelo Venezuela ─── */}
                {clave === 'COP_POR_USD' && (
                  <div style={{
                    marginTop: 18,
                    borderTop: '1px solid var(--jordyn-border)',
                    paddingTop: 16,
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      <i className="bi bi-globe2 me-1"></i>Referencia en tiempo real
                    </div>

                    {/* Dólar paralelo Venezuela */}
                    <div style={{
                      background: 'rgba(10,191,188,0.06)', border: '1px solid rgba(10,191,188,0.2)',
                      borderRadius: 10, padding: '12px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.3rem' }}>🇻🇪</span>
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--jordyn-text)' }}>
                            Dólar Paralelo Venezuela
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)' }}>
                            ve.dolarapi.com · actualización automática
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {tasaBsParalelo ? (
                          <>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--jordyn-primary)' }}>
                              Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(tasaBsParalelo)}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--jordyn-muted)' }}>por 1 USD</div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)' }}>
                            <span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 4 }}></span>
                            Cargando...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nota aclaratoria */}
                    <div style={{
                      background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)',
                      borderRadius: 8, padding: '8px 12px',
                      fontSize: '0.7rem', color: 'var(--jordyn-muted)', lineHeight: 1.5,
                    }}>
                      <i className="bi bi-lightbulb me-1" style={{ color: 'var(--jordyn-gold)' }}></i>
                      La tasa de arriba (COP/USD) la configuras tú manualmente. La referencia venezolana
                      se usa internamente para convertir el precio de los boletos a bolívares cuando el
                      cliente elige <strong>Pago Móvil</strong>. El cliente nunca ve la tasa, solo el monto final en Bs.
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Si no hay tasas en BD todavía */}
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