// ============================================================
//   GestionVendedores.js — RIFAS JORDYN  (v3)
//
//   ARQUITECTURA FINAL:
//   ─────────────────────────────────────────────────────────
//   • La pantalla principal SOLO muestra las CATEGORÍAS.
//   • NO hay panel global de vendedores.
//   • Al abrir una categoría → se gestionan sus vendedores
//     internos con sus números propios de esa categoría.
//   • Un vendedor puede existir en varias categorías con
//     distintos números en cada una.
//   • Crear vendedor nuevo se hace DENTRO de la categoría.
//
//   FLUJO COMPLETO:
//   1. Crear categoría (parcial o simultánea).
//   2. Abrir categoría → "Agregar vendedor":
//      a) Seleccionar uno existente O crear uno nuevo.
//      b) Asignarle sus números para esa categoría.
//      c) Hacer clic en "Asignar series".
//   3. PARCIAL: número libre → Serie A. Ocupado → conflicto.
//   4. SIMULTÁNEA: libre → A. A ocupada → avisa + usa B.
//      A y B ocupadas → muestra ambos dueños → no se asigna.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ─── Helpers ─── */
const pad3   = (n) => String(n).padStart(3, '0');
const NUM_RE  = /^\d{3}$/;

function generarCredenciales(nombre) {
  const base = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim()
    .split(/\s+/).join('_').slice(0, 20);
  const sufijo = Math.floor(1000 + Math.random() * 9000);
  return { usuario: `${base}_${sufijo}`, password: `${base}${sufijo}` };
}

/* ─── Estilos compartidos ─── */
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(8,22,22,0.72)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  modal: (maxW = 740) => ({
    width: '100%', maxWidth: maxW, maxHeight: '94vh',
    background: '#fff', borderRadius: 18, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 32px 80px rgba(10,191,188,0.25)',
  }),
  header: (bg = 'var(--jordyn-primary)') => ({
    background: bg, color: '#fff',
    padding: '1rem 1.5rem', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
  }),
  body: { flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' },
  badge: (color = 'var(--jordyn-primary)') => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: `${color}18`, border: `1.5px solid ${color}40`,
    color, borderRadius: 20, padding: '2px 10px',
    fontSize: '0.7rem', fontWeight: 700,
  }),
  pill: (active) => ({
    padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 700, transition: 'all .15s',
    background: active ? 'var(--jordyn-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--jordyn-muted)',
  }),
  tipoBadge: (tipo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 800,
    ...(tipo === 'simultanea'
      ? { background: '#fff0f5', border: '1.5px solid #e91e8c40', color: '#e91e8c' }
      : { background: '#f0f5ff', border: '1.5px solid #4361ee40', color: '#4361ee' }),
  }),
  closeBtn: {
    background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
    borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
  },
};

/* ══════════════════════════════════════════════════════════════
   MODAL — CREAR / EDITAR CATEGORÍA
══════════════════════════════════════════════════════════════ */
function ModalCrearCategoria({ categoria, onClose, onSaved }) {
  const esEditar = !!categoria;
  const [form, setForm] = useState({
    nombre:      categoria?.nombre      || '',
    tipo:        categoria?.tipo        || 'parcial',
    monto:       categoria?.monto       || '',
    descripcion: categoria?.descripcion || '',
  });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      if (esEditar) {
        await API.put(`/categorias-globales/${categoria.id}`, form);
        toast.success('Categoría actualizada');
      } else {
        await API.post('/categorias-globales', form);
        toast.success('Categoría creada');
      }
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10200 }}>
      <div style={S.modal(560)}>
        <div style={S.header(esEditar ? 'linear-gradient(135deg,#1a7a40,#2ecc71)' : 'linear-gradient(135deg,#0a3d62,#0abfbc)')}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              {esEditar ? '✏️ Editar Categoría' : '🏷️ Nueva Categoría'}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {esEditar ? categoria.nombre : 'Parcial o Simultánea con Series A y B'}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">NOMBRE DE LA CATEGORÍA *</label>
            <input className="jd-input" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Premio $1000, VIP, Básico..." autoFocus />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">MONTO / REFERENCIA</label>
            <input className="jd-input" value={form.monto}
              onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
              placeholder="Ej: $1,000 · Premio principal" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">TIPO DE CATEGORÍA *</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {[
                { key: 'parcial',    icon: '🎯', label: 'Parcial',    accent: '#4361ee', desc: 'Serie única 000–999. Cada número pertenece a un solo vendedor.' },
                { key: 'simultanea', icon: '⚡', label: 'Simultánea', accent: '#e91e8c', desc: 'Series A y B (000–999 c/u). Un número puede tenerlo máx. 2 vendedores.' },
              ].map(({ key, icon, label, desc, accent }) => (
                <div key={key}
                  onClick={() => !esEditar && setForm(p => ({ ...p, tipo: key }))}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: 12,
                    cursor: esEditar ? 'default' : 'pointer',
                    border: `2px solid ${form.tipo === key ? accent : 'var(--jordyn-border)'}`,
                    background: form.tipo === key ? `${accent}10` : 'var(--jordyn-bg2)',
                    transition: 'all .15s', opacity: esEditar ? 0.7 : 1,
                  }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 4, color: form.tipo === key ? accent : 'var(--jordyn-text)' }}>{label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
            {esEditar && (
              <div className="jd-alert jd-alert-warning mt-2" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-lock-fill me-1"></i>El tipo no se puede cambiar una vez creada.
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="jd-label">NOTAS INTERNAS</label>
            <textarea className="jd-input" rows={2} value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Notas adicionales..." style={{ resize: 'none' }} />
          </div>

          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>
              {saving
                ? <><span className="jd-spinner" style={{ width: 16, height: 16 }}></span> Guardando...</>
                : <><i className="bi bi-floppy-fill me-1"></i>{esEditar ? 'Actualizar' : 'Crear categoría'}</>
              }
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 20px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL — NÚMEROS DE UN VENDEDOR EN LA CATEGORÍA
   Gestiona el pool de números + asignación de series
══════════════════════════════════════════════════════════════ */
function ModalNumerosEnCategoria({ categoria, vendedor, onClose, onSaved }) {
  const [numerosPool, setNumerosPool] = useState([]);
  const [asignados,   setAsignados]   = useState([]);
  const [numInput,    setNumInput]    = useState('');
  const [rangoIni,    setRangoIni]    = useState('');
  const [rangoFin,    setRangoFin]    = useState('');
  const [tab,         setTab]         = useState('manual');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [asignando,   setAsignando]   = useState(false);
  const [preview,     setPreview]     = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(false);

  const esSim  = categoria.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await API.get(`/categorias-globales/${categoria.id}/vendedores-resumen`);
      const vend = res.data.vendedores.find(v => String(v.vendedor_id) === String(vendedor.id));
      if (vend) {
        setNumerosPool(vend.numeros.map(n => n.numero));
        setAsignados(vend.numeros.filter(n => n.serie).map(n => ({
          numero: n.numero, serie: n.serie, asignacion_id: n.asignacion_id,
        })));
      } else {
        setNumerosPool([]); setAsignados([]);
      }
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  }, [categoria.id, vendedor.id]);

  const cargarPreview = useCallback(async () => {
    setLoadingPrev(true);
    try {
      const res = await API.get(`/categorias-globales/${categoria.id}/preview/${vendedor.id}`);
      setPreview(res.data);
    } catch { setPreview(null); }
    finally { setLoadingPrev(false); }
  }, [categoria.id, vendedor.id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (numerosPool.length > 0) cargarPreview();
    else setPreview(null);
  }, [numerosPool.length, cargarPreview]);

  const agregarAlPool = async (nums) => {
    const validos = nums.filter(n => NUM_RE.test(n));
    if (!validos.length) return toast.error('Sin números válidos (000–999)');
    setSaving(true);
    try {
      const res = await API.post(
        `/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`,
        { numeros: validos }
      );
      toast.success(res.data.message);
      if (res.data.ya_existian?.length) toast.info(`Ya existían: ${res.data.ya_existian.slice(0, 5).join(', ')}`);
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const quitarDelPool = async (numero) => {
    try {
      await API.delete(
        `/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`,
        { data: { numeros: [numero] } }
      );
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error quitando'); }
  };

  const liberarSerie = async (asignacion_id) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/asignaciones/${asignacion_id}`);
      toast.info('Serie liberada. El número sigue en el pool.');
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const asignarNumeros = async () => {
    setAsignando(true);
    try {
      const res = await API.post(
        `/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/asignar`
      );
      const { message, info_adicional, colisiones } = res.data;
      colisiones?.length > 0 ? toast.warning(message) : toast.success(message);
      info_adicional?.forEach(i => toast.info(i.mensaje, { autoClose: 6000 }));
      await cargar(); onSaved && onSaved();
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.error || 'Error asignando');
      d?.colisiones?.forEach(c => {
        const quien = c.dueno_b ? `A: ${c.dueno_a} / B: ${c.dueno_b}` : `Ocupado por: ${c.dueno_a}`;
        toast.warning(`Conflicto ${c.numero}: ${quien}`, { autoClose: 8000 });
      });
    } finally { setAsignando(false); }
  };

  const agregarManual = () => {
    const num = pad3(parseInt(numInput) || 0);
    if (!NUM_RE.test(num)) { toast.error('Número inválido (000–999)'); return; }
    agregarAlPool([num]); setNumInput('');
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) {
      toast.error('Rango inválido (0–999)'); return;
    }
    const nums = []; for (let i = ini; i <= fin; i++) nums.push(pad3(i));
    agregarAlPool(nums);
  };

  const asignadosSet = new Set(asignados.map(a => a.numero));
  const sinAsignar   = numerosPool.filter(n => !asignadosSet.has(n));

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10300 }}>
      <div style={S.modal(700)}>
        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>🔢 {vendedor.nombre}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {categoria.nombre} · {numerosPool.length} en pool · {asignados.length} asignados · {sinAsignar.length} pendientes
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Agrega números al pool → "Asignar series". Se intentará Serie A; si está ocupada, pasará a Serie B automáticamente.</>
              : <><strong>Parcial:</strong> Agrega números al pool → "Asignar series". Solo un vendedor por número en esta categoría.</>
            }
          </div>

          {/* Barra progreso */}
          <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', border: '1px solid var(--jordyn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 600, marginBottom: 5 }}>
              <span>POOL EN ESTA CATEGORÍA</span>
              <span>{numerosPool.length} definidos · {asignados.length} con serie · {sinAsignar.length} pendientes</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 8, background: `linear-gradient(90deg,${accent},${accent}88)`, width: `${(numerosPool.length / 1000) * 100}%`, transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)', marginBottom: '0.85rem' }}>
            {[['manual', 'Manual'], ['rango', 'Rango']].map(([k, l], i) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600,
                background: tab === k ? accent : 'transparent',
                color: tab === k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: i === 0 ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {tab === 'manual' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input className="jd-input" value={numInput} onChange={e => setNumInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarManual()}
                placeholder="000–999" style={{ maxWidth: 120 }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarManual} disabled={saving}
                style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                <i className="bi bi-plus-lg me-1"></i>Agregar
              </button>
            </div>
          )}

          {tab === 'rango' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value)} placeholder="Desde" style={{ maxWidth: 90 }} maxLength={3} />
              <span style={{ color: 'var(--jordyn-muted)' }}>—</span>
              <input className="jd-input" value={rangoFin} onChange={e => setRangoFin(e.target.value)} placeholder="Hasta" style={{ maxWidth: 90 }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarRango} disabled={saving}
                style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                <i className="bi bi-plus-lg me-1"></i>Agregar rango
              </button>
            </div>
          )}

          {loading ? (
            <div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{ width: 36, height: 36 }}></div></div>
          ) : (
            <>
              {/* Botón asignar series + preview */}
              {sinAsignar.length > 0 && (
                <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}30`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? '0.75rem' : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: accent }}>
                      <i className="bi bi-lightning-fill me-1"></i>
                      {sinAsignar.length} número(s) sin serie asignada
                    </div>
                    <button className="btn-jordyn" onClick={asignarNumeros} disabled={asignando || loadingPrev}
                      style={{ height: 36, padding: '0 16px', fontSize: '0.8rem', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                      {asignando
                        ? <span className="jd-spinner" style={{ width: 14, height: 14 }}></span>
                        : <><i className="bi bi-send-fill me-1"></i>Asignar series</>
                      }
                    </button>
                  </div>

                  {loadingPrev && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="jd-spinner" style={{ width: 12, height: 12 }}></span> Calculando vista previa...
                    </div>
                  )}

                  {preview && !loadingPrev && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>

                      {/* Irán a Serie A */}
                      {preview.libres?.filter(l => l.serie === 'A').length > 0 && (
                        <div style={{ background: '#f0fff8', border: '1.5px solid #2ecc7140', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1a7a40', marginBottom: 5 }}>
                            <i className="bi bi-check-circle-fill me-1"></i>
                            Serie A → {preview.libres.filter(l => l.serie === 'A').length} número(s)
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {preview.libres.filter(l => l.serie === 'A').slice(0, 30).map(l => (
                              <span key={l.numero} style={{ padding: '2px 7px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, background: '#f0f5ff', border: '1px solid #4361ee40', color: '#4361ee' }}>{l.numero}</span>
                            ))}
                            {preview.libres.filter(l => l.serie === 'A').length > 30 && (
                              <span style={{ fontSize: '0.64rem', color: '#1a7a40', alignSelf: 'center' }}>+{preview.libres.filter(l => l.serie === 'A').length - 30} más</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pasarán a Serie B */}
                      {esSim && preview.info_adicional?.length > 0 && (
                        <div style={{ background: '#fff0f5', border: '1.5px solid #e91e8c40', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e91e8c', marginBottom: 5 }}>
                            <i className="bi bi-arrow-right-circle-fill me-1"></i>
                            Serie A ocupada → pasarán a Serie B: {preview.info_adicional.length}
                          </div>
                          {preview.info_adicional.slice(0, 5).map(i => (
                            <div key={i.numero} style={{ fontSize: '0.68rem', color: '#7b0050', marginBottom: 2 }}>
                              • <strong>{i.numero}</strong>: Serie A tiene <strong>{i.serie_a_dueno}</strong> → irá a Serie B
                            </div>
                          ))}
                          {preview.info_adicional.length > 5 && (
                            <div style={{ fontSize: '0.66rem', color: '#7b0050' }}>+{preview.info_adicional.length - 5} más...</div>
                          )}
                        </div>
                      )}

                      {/* Conflictos totales */}
                      {preview.colisiones?.length > 0 && (
                        <div style={{ background: '#fff5f5', border: '1.5px solid #ffaaaa', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c0392b', marginBottom: 5 }}>
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            {esSim ? 'Series A y B ocupadas' : 'Conflicto'} — NO se asignarán: {preview.colisiones.length}
                          </div>
                          {preview.colisiones.slice(0, 5).map(c => (
                            <div key={c.numero} style={{ fontSize: '0.68rem', color: '#c0392b', marginBottom: 2 }}>
                              • <strong>{c.numero}</strong>:{esSim
                                ? <> A→<strong>{c.dueno_a}</strong> / B→<strong>{c.dueno_b}</strong></>
                                : <> ocupado por <strong>{c.dueno_a}</strong></>
                              }
                            </div>
                          ))}
                          {preview.colisiones.length > 5 && (
                            <div style={{ fontSize: '0.66rem', color: '#c0392b' }}>+{preview.colisiones.length - 5} más...</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Números con serie asignada */}
              {asignados.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                    CON SERIE ({asignados.length}) — <span style={{ fontWeight: 400 }}>× libera serie · 🗑 quita del pool</span>
                  </div>
                  {esSim
                    ? ['A', 'B'].map(serie => {
                        const nums = asignados.filter(a => a.serie === serie);
                        if (!nums.length) return null;
                        const color = serie === 'A' ? '#4361ee' : '#e91e8c';
                        return (
                          <div key={serie} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color, marginBottom: 4, textTransform: 'uppercase' }}>● Serie {serie} ({nums.length})</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {nums.sort((a, b) => a.numero.localeCompare(b.numero)).map(n => (
                                <div key={n.numero} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: serie === 'A' ? '#f0f5ff' : '#fff0f5', border: `1.5px solid ${color}40`, color }}>{n.numero}</span>
                                  <button onClick={() => liberarSerie(n.asignacion_id)} title="Liberar serie" style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', padding: 0, fontSize: '0.65rem', lineHeight: 1 }}>×</button>
                                  <button onClick={() => quitarDelPool(n.numero)} title="Quitar del pool" style={{ background: 'none', border: 'none', color: '#ffaaaa', cursor: 'pointer', padding: 0, fontSize: '0.65rem', lineHeight: 1 }}>🗑</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {asignados.sort((a, b) => a.numero.localeCompare(b.numero)).map(n => (
                          <div key={n.numero} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: 'rgba(10,191,188,0.1)', border: '1.5px solid rgba(10,191,188,0.35)', color: 'var(--jordyn-primary)' }}>{n.numero}</span>
                            <button onClick={() => liberarSerie(n.asignacion_id)} title="Liberar" style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', padding: 0, fontSize: '0.65rem', lineHeight: 1 }}>×</button>
                            <button onClick={() => quitarDelPool(n.numero)} title="Quitar" style={{ background: 'none', border: 'none', color: '#ffaaaa', cursor: 'pointer', padding: 0, fontSize: '0.65rem', lineHeight: 1 }}>🗑</button>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              )}

              {/* Sin serie todavía */}
              {sinAsignar.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f0a500', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                    ⏳ SIN SERIE ({sinAsignar.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sinAsignar.map(n => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: '#f9f9f9', border: '1.5px solid #ddd', color: '#999' }}>{n}</span>
                        <button onClick={() => quitarDelPool(n)} title="Quitar" style={{ background: 'none', border: 'none', color: '#ffaaaa', cursor: 'pointer', padding: 0, fontSize: '0.65rem', lineHeight: 1 }}>🗑</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {numerosPool.length === 0 && (
                <div className="jd-alert jd-alert-warning" style={{ fontSize: '0.82rem' }}>
                  Sin números en el pool. Usa las opciones de arriba para agregar.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL — GESTIONAR CATEGORÍA
   Aquí se crean/seleccionan vendedores y se les asignan números.
   Vendedores nuevos se crean directamente desde aquí.
══════════════════════════════════════════════════════════════ */
function ModalGestionarCategoria({ categoria, onClose, onSaved }) {
  const [resumen,       setResumen]       = useState({ vendedores: [] });
  const [todosVend,     setTodosVend]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalNums,     setModalNums]     = useState(null);
  const [confirmQuitar, setConfirmQuitar] = useState(null);
  const [busq,          setBusq]          = useState('');

  // Sub-panel agregar
  const [modoAgregar, setModoAgregar] = useState(false); // false | 'existente' | 'nuevo'
  const [vendedorSel, setVendedorSel] = useState('');
  const [formNuevo,   setFormNuevo]   = useState({ nombre: '', cedula: '' });
  const [savingVend,  setSavingVend]  = useState(false);
  const [credsNuevo,  setCredsNuevo]  = useState(null);

  const esSim  = categoria.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resumenR, vendR] = await Promise.all([
        API.get(`/categorias-globales/${categoria.id}/vendedores-resumen`),
        API.get('/vendedores'),
      ]);
      setResumen(resumenR.data);
      setTodosVend(vendR.data.filter(v => v.activo));
    } catch { toast.error('Error cargando categoría'); }
    finally { setLoading(false); }
  }, [categoria.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const idsEnCat  = new Set(resumen.vendedores.map(v => String(v.vendedor_id)));
  const vendDisp  = todosVend.filter(v => !idsEnCat.has(String(v.id)));

  /* Agregar existente → abrir modal de números */
  const agregarExistente = () => {
    if (!vendedorSel) return toast.error('Selecciona un vendedor');
    const vend = todosVend.find(v => String(v.id) === String(vendedorSel));
    if (!vend) return;
    setModoAgregar(false); setVendedorSel('');
    setModalNums({ id: vend.id, nombre: vend.nombre });
  };

  /* Crear nuevo vendedor → abrir modal de números */
  const crearNuevo = async () => {
    if (!formNuevo.nombre.trim()) return toast.error('El nombre es requerido');
    setSavingVend(true);
    try {
      const cred = generarCredenciales(formNuevo.nombre);
      const res  = await API.post('/auth/register', { ...formNuevo, rol: 'vendedor', ...cred });
      const nuevoId = res.data?.id || res.data?.vendedor?.id;
      setCredsNuevo({ ...cred, nombre: formNuevo.nombre });
      setFormNuevo({ nombre: '', cedula: '' });
      setModoAgregar(false);
      await cargar();
      if (nuevoId) setModalNums({ id: nuevoId, nombre: formNuevo.nombre });
      toast.success('Vendedor creado');
    } catch (err) { toast.error(err.response?.data?.error || 'Error creando'); }
    finally { setSavingVend(false); }
  };

  /* Quitar vendedor de la categoría */
  const quitarVendedor = async (vendedor_id) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor_id}`);
      toast.info('Vendedor removido de la categoría');
      setConfirmQuitar(null);
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const vendFiltrados = resumen.vendedores.filter(v =>
    !busq || v.vendedor_nombre.toLowerCase().includes(busq.toLowerCase())
  );

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10100 }}>
      <div style={S.modal(980)}>

        {/* Header */}
        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.tipoBadge(categoria.tipo)}>{esSim ? '⚡ Simultánea' : '🎯 Parcial'}</span>
              {categoria.nombre}
              {categoria.monto && <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>· {categoria.monto}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 4 }}>
              {resumen.vendedores.length} vendedor(es) en esta categoría
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>

          {/* Credenciales nuevo vendedor */}
          {credsNuevo && (
            <div style={{ background: 'linear-gradient(135deg,#0a3d62,#0abfbc)', borderRadius: 12, padding: '0.9rem 1.1rem', marginBottom: '1rem', color: '#fff' }}>
              <div style={{ fontWeight: 800, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>✅ Vendedor creado: {credsNuevo.nombre}</span>
                <button onClick={() => setCredsNuevo(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                <span>👤 <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{credsNuevo.usuario}</strong></span>
                <span>🔑 <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{credsNuevo.password}</strong></span>
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: 5 }}>⚠️ Copia las credenciales ahora. No se mostrarán de nuevo.</div>
            </div>
          )}

          {/* Panel agregar vendedor */}
          <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}30`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: modoAgregar ? '0.85rem' : 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: accent }}>
                <i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor a esta categoría
              </div>
              {!modoAgregar ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setModoAgregar('existente')}
                    style={{ background: `${accent}15`, border: `1.5px solid ${accent}40`, color: accent, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                    <i className="bi bi-person-check-fill me-1"></i>Vendedor existente
                  </button>
                  <button onClick={() => setModoAgregar('nuevo')}
                    style={{ background: accent, border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                    <i className="bi bi-person-plus-fill me-1"></i>Crear nuevo
                  </button>
                </div>
              ) : (
                <button onClick={() => { setModoAgregar(false); setVendedorSel(''); setFormNuevo({ nombre: '', cedula: '' }); }}
                  style={{ background: 'none', border: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <i className="bi bi-x-lg"></i> Cancelar
                </button>
              )}
            </div>

            {/* Seleccionar existente */}
            {modoAgregar === 'existente' && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>VENDEDOR *</label>
                  <select className="jd-input" value={vendedorSel} onChange={e => setVendedorSel(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {vendDisp.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                  </select>
                  {vendDisp.length === 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>
                      Todos los vendedores activos ya están en esta categoría.
                    </div>
                  )}
                </div>
                <button className="btn-jordyn" onClick={agregarExistente} disabled={!vendedorSel}
                  style={{ height: 44, padding: '0 20px', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                  <i className="bi bi-arrow-right-circle-fill me-1"></i>Seleccionar y asignar números
                </button>
              </div>
            )}

            {/* Crear nuevo */}
            {modoAgregar === 'nuevo' && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>NOMBRE COMPLETO *</label>
                  <input className="jd-input" value={formNuevo.nombre}
                    onChange={e => setFormNuevo(p => ({ ...p, nombre: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && crearNuevo()}
                    placeholder="Ej: Juan Pérez" autoFocus />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>CÉDULA</label>
                  <input className="jd-input" value={formNuevo.cedula}
                    onChange={e => setFormNuevo(p => ({ ...p, cedula: e.target.value }))}
                    placeholder="Opcional" />
                </div>
                <button className="btn-jordyn" onClick={crearNuevo} disabled={savingVend || !formNuevo.nombre.trim()}
                  style={{ height: 44, padding: '0 20px', background: `linear-gradient(135deg,${accent},${accent}cc)`, flexShrink: 0 }}>
                  {savingVend
                    ? <span className="jd-spinner" style={{ width: 15, height: 15 }}></span>
                    : <><i className="bi bi-person-plus-fill me-1"></i>Crear y asignar números</>
                  }
                </button>
              </div>
            )}
          </div>

          {/* Info tipo */}
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Serie A se llena primero. Si un número ya está en A, pasa automáticamente a B. Si A y B están ocupadas, muestra el conflicto.</>
              : <><strong>Parcial:</strong> Un número solo puede pertenecer a un vendedor en esta categoría.</>
            }
          </div>

          {/* Buscador */}
          <div style={{ marginBottom: '0.85rem' }}>
            <input className="jd-input" value={busq} onChange={e => setBusq(e.target.value)}
              placeholder="🔍 Buscar vendedor en esta categoría..." />
          </div>

          {/* Lista vendedores de la categoría */}
          {loading ? (
            <div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{ width: 36, height: 36 }}></div></div>
          ) : resumen.vendedores.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <i className="bi bi-people-fill" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>
              Sin vendedores. Usa los botones de arriba para agregar el primero.
            </div>
          ) : vendFiltrados.length === 0 ? (
            <div className="jd-alert jd-alert-info" style={{ fontSize: '0.82rem' }}>Sin resultados para la búsqueda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {vendFiltrados.map(vdata => {
                const sinSerie = vdata.total_numeros - vdata.total_asignados;
                return (
                  <div key={vdata.vendedor_id} style={{ border: `2px solid ${accent}25`, borderRadius: 12, overflow: 'hidden' }}>

                    {/* Cabecera */}
                    <div style={{ background: 'var(--jordyn-bg2)', padding: '0.65rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--jordyn-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.88rem', flexShrink: 0 }}>
                          {vdata.vendedor_nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{vdata.vendedor_nombre}</div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--jordyn-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span>{vdata.total_numeros} en pool</span>
                            {esSim && vdata.serie_a > 0 && <span style={{ color: '#4361ee' }}>· A: {vdata.serie_a}</span>}
                            {esSim && vdata.serie_b > 0 && <span style={{ color: '#e91e8c' }}>· B: {vdata.serie_b}</span>}
                            {!esSim && vdata.total_asignados > 0 && <span style={{ color: '#4361ee' }}>· Asig: {vdata.total_asignados}</span>}
                            {sinSerie > 0 && <span style={{ color: '#f0a500' }}>· Pendientes: {sinSerie}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => setModalNums({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })}
                          style={{ background: `${accent}15`, border: `1px solid ${accent}40`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', color: accent, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-hash"></i> Números
                        </button>
                        <button onClick={() => setConfirmQuitar({ vendedor_id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })}
                          style={{ background: '#fff5f5', border: '1px solid #ffcccc', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#e63946', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-person-dash-fill"></i> Quitar
                        </button>
                      </div>
                    </div>

                    {/* Números resumidos */}
                    <div style={{ padding: '0.65rem 1rem' }}>
                      {!vdata.numeros || vdata.numeros.length === 0 ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontStyle: 'italic' }}>
                          Sin números. Haz clic en "Números" para agregar.
                        </div>
                      ) : esSim ? (
                        [null, 'A', 'B'].map(serie => {
                          const nums = vdata.numeros.filter(n => n.serie === serie);
                          if (!nums.length) return null;
                          const label = serie === 'A' ? 'Serie A' : serie === 'B' ? 'Serie B' : 'Sin serie';
                          const color = serie === 'A' ? '#4361ee' : serie === 'B' ? '#e91e8c' : '#aaa';
                          return (
                            <div key={String(serie)} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color, textTransform: 'uppercase', flexShrink: 0, paddingTop: 2 }}>● {label} ({nums.length})</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {nums.slice(0, 15).map(n => (
                                  <span key={n.numero} style={{ padding: '1px 6px', borderRadius: 5, fontSize: '0.66rem', fontWeight: 800, background: serie === 'A' ? '#f0f5ff' : serie === 'B' ? '#fff0f5' : '#f5f5f5', border: `1px solid ${color}30`, color }}>{n.numero}</span>
                                ))}
                                {nums.length > 15 && <span style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', alignSelf: 'center' }}>+{nums.length - 15}</span>}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {vdata.numeros.slice(0, 25).map(n => (
                            <span key={n.numero} style={{ padding: '2px 7px', borderRadius: 5, fontSize: '0.67rem', fontWeight: 800, background: n.serie ? 'rgba(10,191,188,0.1)' : '#f5f5f5', border: `1px solid ${n.serie ? 'rgba(10,191,188,0.3)' : '#ddd'}`, color: n.serie ? 'var(--jordyn-primary)' : '#aaa' }}>{n.numero}</span>
                          ))}
                          {vdata.numeros.length > 25 && <span style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', alignSelf: 'center' }}>+{vdata.numeros.length - 25}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal números del vendedor en esta categoría */}
      {modalNums && (
        <ModalNumerosEnCategoria
          categoria={categoria}
          vendedor={modalNums}
          onClose={() => setModalNums(null)}
          onSaved={() => { cargar(); onSaved && onSaved(); }}
        />
      )}

      {/* Confirm quitar vendedor */}
      {confirmQuitar && (
        <div onClick={e => e.target === e.currentTarget && setConfirmQuitar(null)} style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#b37700,#f0a500)')}>
              <div style={{ fontWeight: 800 }}>⚠️ Quitar vendedor de categoría</div>
              <button onClick={() => setConfirmQuitar(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                ¿Quitar a <strong>"{confirmQuitar.nombre}"</strong> de <strong>"{categoria.nombre}"</strong>?
                Se eliminan sus números y series en esta categoría. <strong>No afecta otras categorías ni al vendedor.</strong>
              </p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn w-100" onClick={() => quitarVendedor(confirmQuitar.vendedor_id)}
                  style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}>
                  <i className="bi bi-person-dash-fill me-1"></i>Quitar vendedor
                </button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmQuitar(null)} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CARD DE CATEGORÍA
══════════════════════════════════════════════════════════════ */
function CategoriaCard({ cat, onEdit, onDelete, onSaved }) {
  const [verModal, setVerModal] = useState(false);
  const esSim  = cat.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  return (
    <>
      <div
        style={{ border: `2px solid ${accent}25`, borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow .2s, border-color .2s' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 24px ${accent}22`; e.currentTarget.style.borderColor = `${accent}55`; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = `${accent}25`; }}
      >
        <div style={{ height: 4, background: `linear-gradient(90deg,${accent},${accent}88)` }} />
        <div style={{ padding: '1rem 1rem 0.85rem' }}>

          {/* Header card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.nombre}</div>
              {cat.monto && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>💰 {cat.monto}</div>}
              <span style={S.tipoBadge(cat.tipo)}>{esSim ? '⚡ Simultánea' : '🎯 Parcial'}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button onClick={() => onEdit(cat)} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}>
                <i className="bi bi-pencil-fill"></i>
              </button>
              <button onClick={() => onDelete(cat)} style={{ background: '#fff5f5', border: '1px solid #ffcccc', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: '#e63946' }}>
                <i className="bi bi-trash3-fill"></i>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            <span style={S.badge('var(--jordyn-primary)')}><i className="bi bi-people-fill"></i>{cat.total_vendedores || 0} vendedores</span>
            <span style={S.badge('#2ecc71')}><i className="bi bi-hash"></i>{cat.total_numeros_definidos || 0} números</span>
            {esSim && <>
              <span style={S.badge('#4361ee')}>A: {cat.numeros_serie_a || 0}</span>
              <span style={S.badge('#e91e8c')}>B: {cat.numeros_serie_b || 0}</span>
            </>}
          </div>

          {/* Barras progreso simultánea */}
          {esSim && (
            <div style={{ marginBottom: '0.8rem' }}>
              {[{ label: 'A', val: cat.numeros_serie_a || 0, color: '#4361ee' }, { label: 'B', val: cat.numeros_serie_b || 0, color: '#e91e8c' }].map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--jordyn-muted)', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color }}>Serie {label}</span><span>{val} / 1000</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 4, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.min((val / 1000) * 100, 100)}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {cat.descripcion && (
            <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: '0.8rem', fontStyle: 'italic', lineHeight: 1.5 }}>{cat.descripcion}</div>
          )}

          <button className="btn-jordyn w-100" onClick={() => setVerModal(true)}
            style={{ fontSize: '0.8rem', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
            <i className="bi bi-people-fill me-1"></i>
            Gestionar vendedores {cat.total_vendedores > 0 ? `(${cat.total_vendedores})` : ''}
          </button>
        </div>
      </div>

      {verModal && (
        <ModalGestionarCategoria
          categoria={cat}
          onClose={() => setVerModal(false)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   Solo muestra categorías. Sin panel global de vendedores.
══════════════════════════════════════════════════════════════ */
export default function GestionVendedores() {
  const [categorias,    setCategorias]    = useState([]);
  const [loadingC,      setLoadingC]      = useState(true);
  const [modalCrearCat, setModalCrearCat] = useState(false);
  const [editCat,       setEditCat]       = useState(null);
  const [confirmDelCat, setConfirmDelCat] = useState(null);
  const [filtroTipo,    setFiltroTipo]    = useState('todos');
  const [busqCat,       setBusqCat]       = useState('');

  const cargarCategorias = useCallback(async () => {
    setLoadingC(true);
    try {
      const res = await API.get('/categorias-globales');
      setCategorias(res.data);
    } catch { toast.error('Error cargando categorías'); }
    finally { setLoadingC(false); }
  }, []);

  useEffect(() => { cargarCategorias(); }, [cargarCategorias]);

  const eliminarCategoria = async (cat) => {
    try {
      await API.delete(`/categorias-globales/${cat.id}`);
      toast.success('Categoría eliminada');
      setConfirmDelCat(null);
      cargarCategorias();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando');
      setConfirmDelCat(null);
    }
  };

  const categoriasFiltradas = categorias.filter(c => {
    const okTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;
    const okBusq = !busqCat || c.nombre.toLowerCase().includes(busqCat.toLowerCase());
    return okTipo && okBusq;
  });

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-tags-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            Categorías
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: '2px 0 0' }}>
            {categorias.length} categoría(s) · Los vendedores y sus números se gestionan dentro de cada categoría
          </p>
        </div>
        <button className="btn-jordyn" onClick={() => setModalCrearCat(true)} style={{ fontSize: '0.82rem' }}>
          <i className="bi bi-plus-lg me-1"></i>Nueva categoría
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)' }}>
          {[['todos', 'Todas'], ['parcial', 'Parcial'], ['simultanea', 'Simultánea']].map(([k, l]) => (
            <button key={k} onClick={() => setFiltroTipo(k)} style={S.pill(filtroTipo === k)}>{l}</button>
          ))}
        </div>
        <input className="jd-input" style={{ flex: '1 1 200px', maxWidth: 320 }}
          value={busqCat} onChange={e => setBusqCat(e.target.value)}
          placeholder="🔍 Buscar categoría..." />
      </div>

      {/* Grid */}
      {loadingC ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width: 44, height: 44 }}></div>
        </div>
      ) : categoriasFiltradas.length === 0 ? (
        <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '2.5rem' }}>
          {categorias.length === 0
            ? <><i className="bi bi-tags" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, opacity: 0.4 }}></i>Sin categorías. Crea la primera con <strong>"Nueva categoría"</strong>.</>
            : 'Sin resultados para los filtros aplicados.'
          }
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {categoriasFiltradas.map(cat => (
            <CategoriaCard key={cat.id} cat={cat}
              onEdit={c => setEditCat(c)}
              onDelete={c => setConfirmDelCat(c)}
              onSaved={cargarCategorias}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {modalCrearCat && <ModalCrearCategoria onClose={() => setModalCrearCat(false)} onSaved={cargarCategorias} />}
      {editCat       && <ModalCrearCategoria categoria={editCat} onClose={() => setEditCat(null)} onSaved={cargarCategorias} />}

      {/* Confirm eliminar categoría */}
      {confirmDelCat && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelCat(null)} style={S.overlay}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ fontWeight: 800 }}>🗑️ Eliminar categoría</div>
              <button onClick={() => setConfirmDelCat(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                ¿Eliminar <strong>"{confirmDelCat.nombre}"</strong>? Se eliminarán todos los vendedores y números de esta categoría.
                <strong> Los vendedores no se eliminan del sistema.</strong>
              </p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn-danger w-100" onClick={() => eliminarCategoria(confirmDelCat)}>
                  <i className="bi bi-trash3-fill me-1"></i>Eliminar
                </button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmDelCat(null)} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}