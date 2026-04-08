// ============================================================
//   GestionVendedores.js — RIFAS JORDYN
//
//   NUEVA ESTRUCTURA:
//   - La pantalla principal muestra las CATEGORÍAS como cards.
//   - Dentro de cada card se listan los vendedores asignados.
//   - Botón "Gestionar vendedores" abre el modal de detalle de categoría.
//   - Botón "Nuevo vendedor" en el header abre el panel lateral de vendedores.
//   - PARCIAL: cada número solo puede estar en 1 vendedor.
//   - SIMULTÁNEA: Serie A (1er vendedor) → Serie B (2do) → conflicto (3ro+).
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ─── Helpers ─── */
const pad3 = (n) => String(n).padStart(3, '0');
const NUM_RE = /^\d{3}$/;

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
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
  },
  modal: (maxW = 740) => ({
    width: '100%', maxWidth: maxW, maxHeight: '94vh',
    background: '#fff', borderRadius: 18, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 32px 80px rgba(10,191,188,0.25)'
  }),
  header: (bg = 'var(--jordyn-primary)') => ({
    background: bg, color: '#fff',
    padding: '1rem 1.5rem', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
  }),
  body: { flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' },
  badge: (color = 'var(--jordyn-primary)') => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: `${color}18`, border: `1.5px solid ${color}40`,
    color, borderRadius: 20, padding: '2px 10px',
    fontSize: '0.7rem', fontWeight: 700
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
      : { background: '#f0f5ff', border: '1.5px solid #4361ee40', color: '#4361ee' })
  }),
  closeBtn: {
    background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
    borderRadius: 8, padding: '6px 12px', cursor: 'pointer'
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
        <div style={S.header(esEditar
          ? 'linear-gradient(135deg,#1a7a40,#2ecc71)'
          : 'linear-gradient(135deg,#0a3d62,#0abfbc)')}>
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
                {
                  key: 'parcial', icon: '🎯', label: 'Parcial',
                  desc: 'Pool único 000–999. Cada número pertenece a un solo vendedor en esta categoría.',
                  accent: '#4361ee',
                },
                {
                  key: 'simultanea', icon: '⚡', label: 'Simultánea',
                  desc: 'Dos series A y B (000–999 cada una). Un número puede tenerlo máx. 2 vendedores.',
                  accent: '#e91e8c',
                },
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
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 4, color: form.tipo === key ? accent : 'var(--jordyn-text)' }}>
                    {label}
                  </div>
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
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 20px' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL — GESTIONAR VENDEDORES DE UNA CATEGORÍA
══════════════════════════════════════════════════════════════ */
function ModalGestionarCategoria({ categoria, todosVendedores, onClose, onSaved }) {
  const [asignaciones,   setAsignaciones]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [vendedorSel,    setVendedorSel]    = useState('');
  const [preview,        setPreview]        = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [busqVend,       setBusqVend]       = useState('');
  const [confirmQuitar,  setConfirmQuitar]  = useState(null);

  const esSim      = categoria.tipo === 'simultanea';
  const accentColor = esSim ? '#e91e8c' : '#4361ee';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/categorias-globales/${categoria.id}/vendedores`);
      setAsignaciones(res.data);
    } catch { toast.error('Error cargando asignaciones'); }
    finally   { setLoading(false); }
  }, [categoria.id]);

  useEffect(() => { cargar(); }, [cargar]);

  /* Preview al seleccionar vendedor */
  const cargarPreview = async (vid) => {
    if (!vid) { setPreview(null); return; }
    setLoadingPreview(true);
    try {
      const res = await API.get(`/categorias-globales/${categoria.id}/preview/${vid}`);
      setPreview(res.data);
    } catch { toast.error('Error cargando preview'); setPreview(null); }
    finally   { setLoadingPreview(false); }
  };

  const onSelectVendedor = (vid) => {
    setVendedorSel(vid);
    cargarPreview(vid);
  };

  /* Agregar vendedor */
  const agregar = async () => {
    if (!vendedorSel) return toast.error('Selecciona un vendedor');
    if (preview && !preview.puedeAgregar) return toast.error('No hay números disponibles para asignar');
    setSaving(true);
    try {
      const res = await API.post(`/categorias-globales/${categoria.id}/vendedores`, {
        vendedor_id: vendedorSel,
      });
      const { message, colisiones } = res.data;
      colisiones?.length > 0 ? toast.warning(message) : toast.success(message);
      setVendedorSel(''); setPreview(null);
      await cargar();
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error asignando');
    } finally { setSaving(false); }
  };

  /* Quitar vendedor completo */
  const quitarVendedor = async (vendedor_id) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor_id}`);
      toast.info('Vendedor removido de la categoría');
      setConfirmQuitar(null);
      await cargar();
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  /* Quitar número individual */
  const quitarNumero = async (asigId) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/asignaciones/${asigId}`);
      toast.info('Número removido');
      await cargar();
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  /* Agrupar asignaciones por vendedor */
  const porVendedor = {};
  const asigFiltradas = asignaciones.filter(a =>
    !busqVend || a.vendedor_nombre.toLowerCase().includes(busqVend.toLowerCase())
  );
  asigFiltradas.forEach(a => {
    if (!porVendedor[a.vendedor_id])
      porVendedor[a.vendedor_id] = { nombre: a.vendedor_nombre, numeros: [] };
    porVendedor[a.vendedor_id].numeros.push({ numero: a.numero, serie: a.serie, id: a.id });
  });

  /* Vendedores disponibles para agregar */
  const vendedoresEnCat = [...new Set(asignaciones.map(a => a.vendedor_id))];
  const vendedoresDisp  = todosVendedores.filter(v => {
    if (esSim) {
      const series = asignaciones.filter(a => a.vendedor_id === v.id).map(a => a.serie);
      return !(series.includes('A') && series.includes('B'));
    }
    return !vendedoresEnCat.includes(v.id);
  });

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10100 }}>
      <div style={S.modal(900)}>

        {/* Header */}
        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.tipoBadge(categoria.tipo)}>{esSim ? '⚡ Simultánea' : '🎯 Parcial'}</span>
              {categoria.nombre}
              {categoria.monto && <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>· {categoria.monto}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 4 }}>
              {Object.keys(porVendedor).length} vendedor(es) · {asignaciones.length} asignación(es)
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>

          {/* Info */}
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Al agregar un vendedor, sus números se asignan automáticamente a Serie A primero, luego a Serie B. Máximo 2 vendedores por número (uno por serie).</>
              : <><strong>Parcial:</strong> Al agregar un vendedor, sus números se importan automáticamente. Si un número ya lo tiene otro vendedor en esta categoría, se reporta como conflicto.</>
            }
          </div>

          {/* Formulario agregar vendedor */}
          <div style={{
            background: 'var(--jordyn-bg2)', border: `2px solid ${accentColor}30`,
            borderRadius: 14, padding: '1.1rem', marginBottom: '1.1rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: accentColor, marginBottom: '0.75rem' }}>
              <i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor a esta categoría
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label className="jd-label" style={{ fontSize: '0.62rem' }}>VENDEDOR *</label>
                <select className="jd-input" value={vendedorSel} onChange={e => onSelectVendedor(e.target.value)}>
                  <option value="">— Seleccionar vendedor —</option>
                  {vendedoresDisp.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} ({v.numeros_count || 0} números)
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn-jordyn"
                onClick={agregar}
                disabled={saving || !vendedorSel || loadingPreview || (preview && !preview.puedeAgregar)}
                style={{
                  height: 44, padding: '0 22px', flexShrink: 0, fontSize: '0.85rem',
                  background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`,
                }}>
                {saving
                  ? <span className="jd-spinner" style={{ width: 16, height: 16 }}></span>
                  : <><i className="bi bi-plus-lg me-1"></i>Agregar</>
                }
              </button>
            </div>

            {/* Preview cargando */}
            {loadingPreview && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}>
                <span className="jd-spinner" style={{ width: 14, height: 14 }}></span>
                Verificando números del vendedor...
              </div>
            )}

            {/* Preview resultado */}
            {preview && !loadingPreview && (
              <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

                {/* Sin números */}
                {preview.sinNumeros && (
                  <div style={{ background: '#fff8e1', border: '1.5px solid #ffd166', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#7a5c00' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>{preview.vendedor_nombre}</strong> no tiene números asignados.
                    Asígnale números desde la sección de vendedores primero.
                  </div>
                )}

                {/* Ya en ambas series */}
                {preview.yaEnAmbas && (
                  <div style={{ background: '#fff0f5', border: '1.5px solid #e91e8c40', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#7b0050' }}>
                    <i className="bi bi-x-circle-fill me-2"></i>
                    <strong>{preview.vendedor_nombre}</strong> ya está en Serie A y Serie B. No puede agregarse más.
                  </div>
                )}

                {!preview.sinNumeros && !preview.yaEnAmbas && (
                  <>
                    {/* Números libres */}
                    {preview.libres.length > 0 && (
                      <div style={{ background: '#f0fff8', border: '1.5px solid #2ecc7140', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1a7a40', marginBottom: 6 }}>
                          <i className="bi bi-check-circle-fill me-1"></i>
                          {preview.libres.length} número(s) se asignarán
                          {esSim && ` → ${[...new Set(preview.libres.map(l => `Serie ${l.serie}`))].join(', ')}`}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {preview.libres.slice(0, 30).map(l => (
                            <span key={l.numero} style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800,
                              background: esSim ? (l.serie === 'A' ? '#f0f5ff' : '#fff0f5') : 'rgba(10,191,188,0.1)',
                              color: esSim ? (l.serie === 'A' ? '#4361ee' : '#e91e8c') : 'var(--jordyn-primary)',
                              border: `1px solid ${esSim ? (l.serie === 'A' ? '#4361ee40' : '#e91e8c40') : 'rgba(10,191,188,0.3)'}`,
                            }}>
                              {l.numero}{esSim ? `-${l.serie}` : ''}
                            </span>
                          ))}
                          {preview.libres.length > 30 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)', alignSelf: 'center' }}>
                              +{preview.libres.length - 30} más
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Colisiones */}
                    {preview.colisiones.length > 0 && (
                      <div style={{ background: '#fff5f5', border: '1.5px solid #ffaaaa', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c0392b', marginBottom: 6 }}>
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          {preview.colisiones.length} número(s) con conflicto — NO se asignarán
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {preview.colisiones.slice(0, 20).map(c => (
                            <span key={c.numero} title={`Conflicto con: ${c.dueno}`} style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800,
                              background: '#fff0f0', border: '1px solid #ffcccc', color: '#c0392b',
                            }}>
                              {c.numero}
                            </span>
                          ))}
                          {preview.colisiones.length > 20 && (
                            <span style={{ fontSize: '0.68rem', color: '#c0392b', alignSelf: 'center' }}>
                              +{preview.colisiones.length - 20} más
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#c0392b', lineHeight: 1.5 }}>
                          {preview.colisiones.slice(0, 5).map(c => (
                            <div key={c.numero}>• {c.numero}: ocupado por <strong>{c.dueno}</strong></div>
                          ))}
                          {preview.colisiones.length > 5 && <div>• ...</div>}
                        </div>
                      </div>
                    )}

                    {/* Todos en conflicto */}
                    {preview.libres.length === 0 && preview.colisiones.length > 0 && (
                      <div style={{ background: '#fff5f5', border: '1.5px solid #e63946', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#c0392b', fontWeight: 700, textAlign: 'center' }}>
                        <i className="bi bi-x-circle-fill me-2"></i>
                        Todos los números de este vendedor tienen conflictos. No se puede agregar.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Buscador en vendedores asignados */}
          <div style={{ marginBottom: '0.85rem' }}>
            <input className="jd-input" value={busqVend} onChange={e => setBusqVend(e.target.value)}
              placeholder="🔍 Buscar vendedor asignado..." />
          </div>

          {/* Lista de vendedores asignados */}
          {loading ? (
            <div className="d-flex justify-content-center py-4">
              <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
            </div>
          ) : asignaciones.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center' }}>
              <i className="bi bi-people-fill" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>
              Sin vendedores asignados. Usa el selector de arriba para agregar el primero.
            </div>
          ) : Object.keys(porVendedor).length === 0 ? (
            <div className="jd-alert jd-alert-info" style={{ fontSize: '0.82rem' }}>Sin resultados para la búsqueda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(porVendedor).map(([vid, vdata]) => {
                const numsA = vdata.numeros.filter(n => n.serie === 'A');
                const numsB = vdata.numeros.filter(n => n.serie === 'B');

                return (
                  <div key={vid} style={{ border: `2px solid ${accentColor}25`, borderRadius: 12, overflow: 'hidden' }}>
                    {/* Cabecera vendedor */}
                    <div style={{
                      background: 'var(--jordyn-bg2)', padding: '0.7rem 1rem',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid var(--jordyn-border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: accentColor, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
                        }}>
                          {vdata.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{vdata.nombre}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)' }}>
                            {vdata.numeros.length} número(s)
                            {esSim && [
                              numsA.length > 0 && `Serie A: ${numsA.length}`,
                              numsB.length > 0 && `Serie B: ${numsB.length}`,
                            ].filter(Boolean).map(t => ` · ${t}`).join('')}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmQuitar({ vendedor_id: vid, nombre: vdata.nombre })}
                        style={{
                          background: '#fff5f5', border: '1px solid #ffcccc',
                          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                          fontSize: '0.75rem', color: '#e63946', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        <i className="bi bi-person-dash-fill"></i> Quitar
                      </button>
                    </div>

                    {/* Números */}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      {esSim ? (
                        ['A', 'B'].map(serie => {
                          const nums = vdata.numeros.filter(n => n.serie === serie);
                          if (!nums.length) return null;
                          return (
                            <div key={serie} style={{ marginBottom: '0.5rem' }}>
                              <div style={{
                                fontSize: '0.62rem', fontWeight: 700, marginBottom: 5,
                                color: serie === 'A' ? '#4361ee' : '#e91e8c',
                                textTransform: 'uppercase', letterSpacing: '0.6px',
                              }}>
                                ● Serie {serie} ({nums.length} números)
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {nums.sort((a, b) => a.numero.localeCompare(b.numero)).map(n => (
                                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <span style={{
                                      padding: '3px 9px', borderRadius: 7, fontWeight: 800, fontSize: '0.72rem',
                                      background: serie === 'A' ? '#f0f5ff' : '#fff0f5',
                                      border: `1.5px solid ${serie === 'A' ? '#4361ee40' : '#e91e8c40'}`,
                                      color: serie === 'A' ? '#4361ee' : '#e91e8c',
                                    }}>{n.numero}</span>
                                    <button onClick={() => quitarNumero(n.id)} title="Quitar este número"
                                      style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', padding: '0 1px', fontSize: '0.6rem', lineHeight: 1 }}>
                                      <i className="bi bi-x-circle"></i>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {vdata.numeros.sort((a, b) => a.numero.localeCompare(b.numero)).map(n => (
                            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span style={{
                                padding: '3px 9px', borderRadius: 7, fontWeight: 800, fontSize: '0.72rem',
                                background: 'rgba(10,191,188,0.1)',
                                border: '1.5px solid rgba(10,191,188,0.35)',
                                color: 'var(--jordyn-primary)',
                              }}>{n.numero}</span>
                              <button onClick={() => quitarNumero(n.id)} title="Quitar este número"
                                style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', padding: '0 1px', fontSize: '0.6rem', lineHeight: 1 }}>
                                <i className="bi bi-x-circle"></i>
                              </button>
                            </div>
                          ))}
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

      {/* Confirm quitar vendedor */}
      {confirmQuitar && (
        <div onClick={e => e.target === e.currentTarget && setConfirmQuitar(null)}
          style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#b37700,#f0a500)')}>
              <div style={{ fontWeight: 800 }}>⚠️ Quitar vendedor de categoría</div>
              <button onClick={() => setConfirmQuitar(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                ¿Quitar a <strong>"{confirmQuitar.nombre}"</strong> de la categoría <strong>"{categoria.nombre}"</strong>?
                Se eliminarán todos sus números asignados en esta categoría.
              </p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn w-100"
                  onClick={() => quitarVendedor(confirmQuitar.vendedor_id)}
                  style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}>
                  <i className="bi bi-person-dash-fill me-1"></i>Quitar vendedor
                </button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmQuitar(null)}
                  style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL — NÚMEROS GLOBALES DEL VENDEDOR
══════════════════════════════════════════════════════════════ */
function ModalNumerosVendedor({ vendedor, onClose, onSaved }) {
  const [asignados,  setAsignados]  = useState([]);
  const [numInput,   setNumInput]   = useState('');
  const [rangoIni,   setRangoIni]   = useState('');
  const [rangoFin,   setRangoFin]   = useState('');
  const [cantidad,   setCantidad]   = useState(10);
  const [loadingAl,  setLoadingAl]  = useState(false);
  const [loadingIni, setLoadingIni] = useState(true);
  const [tab,        setTab]        = useState('manual');

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get(`/vendedores/${vendedor.id}`);
        const nums = (res.data.numeros_asignados || [])
          .map(n => typeof n === 'object' ? n.numero : n).filter(Boolean);
        setAsignados([...new Set(nums)].sort());
      } catch { toast.error('Error cargando números'); }
      finally   { setLoadingIni(false); }
    })();
  }, [vendedor.id]);

  const agregar = async (nums) => {
    const sinDuplicados = nums.filter(n => NUM_RE.test(n) && !asignados.includes(n));
    const yaPropio      = nums.filter(n => asignados.includes(n));
    if (yaPropio.length) toast.info(`Ya los tenías: ${yaPropio.slice(0, 5).join(', ')}`);
    if (!sinDuplicados.length) return;
    try {
      await API.post('/numeros/asignar', { vendedor_id: vendedor.id, numeros: sinDuplicados });
      setAsignados(p => [...new Set([...p, ...sinDuplicados])].sort());
      toast.success(`${sinDuplicados.length} número(s) asignados`);
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error asignando'); }
  };

  const quitar = async (num) => {
    try {
      await API.delete('/numeros/asignar', { data: { vendedor_id: vendedor.id, numeros: [num] } });
      setAsignados(p => p.filter(n => n !== num));
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'No se puede quitar'); }
  };

  const agregarManual = () => {
    const num = pad3(parseInt(numInput) || 0);
    if (!NUM_RE.test(num)) { toast.error('Número inválido (000–999)'); return; }
    agregar([num]); setNumInput('');
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) {
      toast.error('Rango inválido (0–999)'); return;
    }
    const nums = []; for (let i = ini; i <= fin; i++) nums.push(pad3(i));
    agregar(nums);
  };

  const agregarAleatorios = async () => {
    setLoadingAl(true);
    try {
      const res = await API.get(`/vendedores/${vendedor.id}/numeros-aleatorios`, {
        params: { cantidad, excluir: asignados.join(',') },
      });
      const nums = res.data.numeros_sugeridos || [];
      if (!nums.length) { toast.warning('No hay sugerencias disponibles'); return; }
      await agregar(nums);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoadingAl(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10200 }}>
      <div style={S.modal(700)}>
        <div style={S.header()}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              🔢 NÚMEROS GLOBALES — {vendedor.nombre}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {asignados.length} asignados · Cualquier número de 000–999 está disponible
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem' }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            Estos son los números fijos del vendedor. <strong>Varios vendedores pueden tener los mismos números</strong> — la validación de exclusividad ocurre al asignarlos a una categoría.
          </div>

          {/* Barra progreso */}
          <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem', border: '1px solid var(--jordyn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 600, marginBottom: 6 }}>
              <span>NÚMEROS ASIGNADOS A ESTE VENDEDOR</span>
              <span>{asignados.length} / 1000</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, var(--jordyn-primary), var(--jordyn-green))',
                width: `${(asignados.length / 1000) * 100}%`, transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)', marginBottom: '1rem' }}>
            {[['manual', 'Manual'], ['rango', 'Rango'], ['aleatorio', 'Aleatorios']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600,
                background: tab === k ? 'var(--jordyn-primary)' : 'transparent',
                color: tab === k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: k !== 'aleatorio' ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {/* Tab: manual */}
          {tab === 'manual' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input className="jd-input" value={numInput} onChange={e => setNumInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarManual()}
                placeholder="000–999" style={{ maxWidth: 120 }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarManual}>
                <i className="bi bi-plus-lg me-1"></i>Agregar
              </button>
            </div>
          )}

          {/* Tab: rango */}
          {tab === 'rango' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value)}
                placeholder="Desde" style={{ maxWidth: 90 }} maxLength={3} />
              <span style={{ color: 'var(--jordyn-muted)' }}>—</span>
              <input className="jd-input" value={rangoFin} onChange={e => setRangoFin(e.target.value)}
                placeholder="Hasta" style={{ maxWidth: 90 }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarRango}>
                <i className="bi bi-plus-lg me-1"></i>Agregar rango
              </button>
            </div>
          )}

          {/* Tab: aleatorios */}
          {tab === 'aleatorio' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input type="number" className="jd-input" value={cantidad}
                onChange={e => setCantidad(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ maxWidth: 80 }} min={1} max={200} />
              <span style={{ fontSize: '0.8rem', color: 'var(--jordyn-muted)' }}>números aleatorios</span>
              <button className="btn-jordyn" onClick={agregarAleatorios} disabled={loadingAl}>
                {loadingAl
                  ? <span className="jd-spinner" style={{ width: 16, height: 16 }}></span>
                  : <><i className="bi bi-shuffle me-1"></i>Generar</>
                }
              </button>
            </div>
          )}

          {/* Números asignados */}
          {loadingIni ? (
            <div className="d-flex justify-content-center py-3">
              <div className="jd-spinner" style={{ width: 32, height: 32 }}></div>
            </div>
          ) : asignados.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ fontSize: '0.82rem' }}>
              Sin números asignados. Usa las opciones de arriba para agregar.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                NÚMEROS ASIGNADOS ({asignados.length}) · Click para quitar
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {asignados.map(n => (
                  <div key={n} onClick={() => quitar(n)} title="Click para quitar" style={{
                    padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: '0.75rem',
                    background: 'rgba(10,191,188,0.1)', border: '1.5px solid rgba(10,191,188,0.4)',
                    color: 'var(--jordyn-primary)', cursor: 'pointer', transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#e63946'; e.currentTarget.style.color = '#e63946'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,191,188,0.1)'; e.currentTarget.style.borderColor = 'rgba(10,191,188,0.4)'; e.currentTarget.style.color = 'var(--jordyn-primary)'; }}
                  >{n}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CARD DE CATEGORÍA  (usada en el grid principal)
══════════════════════════════════════════════════════════════ */
function CategoriaCard({ cat, vendedoresActivos, onEdit, onDelete, onSaved }) {
  const [verModal, setVerModal] = useState(false);

  const esSim   = cat.tipo === 'simultanea';
  const accent  = esSim ? '#e91e8c' : '#4361ee';

  return (
    <>
      <div
        style={{
          border: `2px solid ${accent}25`, borderRadius: 14, overflow: 'hidden',
          background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          transition: 'box-shadow .2s, border-color .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 24px ${accent}22`; e.currentTarget.style.borderColor = `${accent}55`; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = `${accent}25`; }}
      >
        {/* Barra de color superior */}
        <div style={{ height: 4, background: `linear-gradient(90deg,${accent},${accent}88)` }} />

        <div style={{ padding: '1rem 1rem 0.85rem' }}>

          {/* Header card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.nombre}
              </div>
              {cat.monto && (
                <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>
                  💰 {cat.monto}
                </div>
              )}
              <span style={S.tipoBadge(cat.tipo)}>{esSim ? '⚡ Simultánea' : '🎯 Parcial'}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button onClick={() => onEdit(cat)} title="Editar categoría"
                style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}>
                <i className="bi bi-pencil-fill"></i>
              </button>
              <button onClick={() => onDelete(cat)} title="Eliminar categoría"
                style={{ background: '#fff5f5', border: '1px solid #ffcccc', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: '#e63946' }}>
                <i className="bi bi-trash3-fill"></i>
              </button>
            </div>
          </div>

          {/* Estadísticas */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            <span style={S.badge('var(--jordyn-primary)')}>
              <i className="bi bi-people-fill"></i>{cat.total_vendedores || 0} vendedores
            </span>
            <span style={S.badge('#2ecc71')}>
              <i className="bi bi-hash"></i>{cat.total_numeros || 0} números
            </span>
            {esSim && (
              <>
                <span style={S.badge('#4361ee')}>A: {cat.numeros_serie_a || 0}</span>
                <span style={S.badge('#e91e8c')}>B: {cat.numeros_serie_b || 0}</span>
              </>
            )}
          </div>

          {/* Progreso series (solo simultánea) */}
          {esSim && (
            <div style={{ marginBottom: '0.8rem' }}>
              {[{ label: 'A', val: cat.numeros_serie_a || 0, color: '#4361ee' }, { label: 'B', val: cat.numeros_serie_b || 0, color: '#e91e8c' }].map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--jordyn-muted)', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color }}>Serie {label}</span>
                    <span>{val} / 1000</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 4, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.min((val / 1000) * 100, 100)}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Descripción */}
          {cat.descripcion && (
            <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: '0.8rem', fontStyle: 'italic', lineHeight: 1.5 }}>
              {cat.descripcion}
            </div>
          )}

          {/* Botón principal */}
          <button
            className="btn-jordyn w-100"
            onClick={() => setVerModal(true)}
            style={{ fontSize: '0.8rem', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
            <i className="bi bi-people-fill me-1"></i>
            Gestionar vendedores {cat.total_vendedores > 0 ? `(${cat.total_vendedores})` : ''}
          </button>
        </div>
      </div>

      {verModal && (
        <ModalGestionarCategoria
          categoria={cat}
          todosVendedores={vendedoresActivos}
          onClose={() => setVerModal(false)}
          onSaved={() => { onSaved(); }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PANEL LATERAL — GESTIÓN DE VENDEDORES
   (slide-in desde la derecha, se superpone al contenido)
══════════════════════════════════════════════════════════════ */
function PanelVendedores({ vendedores, loading, onClose, onCreated, onUpdated, onDeleted, onNums }) {
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState({ nombre: '', cedula: '' });
  const [editando,      setEditando]      = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [creds,         setCreds]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busq,          setBusq]          = useState('');
  const [filtroActivo,  setFiltroActivo]  = useState('todos');

  const emptyForm = { nombre: '', cedula: '' };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre?.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      if (editando) {
        await API.put(`/vendedores/${editando}`, form);
        toast.success('Vendedor actualizado');
        setEditando(null); setShowForm(false); setForm(emptyForm);
        onUpdated && onUpdated();
      } else {
        const cred = generarCredenciales(form.nombre);
        const res  = await API.post('/auth/register', { ...form, rol: 'vendedor', ...cred });
        setCreds({ ...cred, nombre: form.nombre, id: res.data?.id });
        toast.success('Vendedor creado');
        setShowForm(false); setForm(emptyForm);
        onCreated && onCreated();
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando'); }
    finally { setSaving(false); }
  };

  const abrirEditar = (v) => {
    setEditando(v.id);
    setForm({ nombre: v.nombre, cedula: v.cedula || '', activo: v.activo });
    setShowForm(true);
  };

  const confirmarEliminacion = async () => {
    try {
      await API.delete(`/vendedores/${confirmDelete.id}`);
      toast.success('Vendedor eliminado');
      setConfirmDelete(null);
      onDeleted && onDeleted();
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('ventas')) setConfirmDelete(p => ({ ...p, tieneVentas: true }));
      else toast.error(msg || 'Error eliminando');
    }
  };

  const confirmarDesactivar = async () => {
    try {
      await API.put(`/vendedores/${confirmDelete.id}`, { activo: false });
      toast.info('Vendedor desactivado');
      setConfirmDelete(null);
      onUpdated && onUpdated();
    } catch { toast.error('Error desactivando'); }
  };

  const filtrados = vendedores.filter(v => {
    const okBusq   = !busq || v.nombre.toLowerCase().includes(busq.toLowerCase()) || v.usuario?.toLowerCase().includes(busq.toLowerCase());
    const okActivo = filtroActivo === 'todos' || (filtroActivo === 'activos' ? v.activo : !v.activo);
    return okBusq && okActivo;
  });
  const activos   = filtrados.filter(v =>  v.activo);
  const inactivos = filtrados.filter(v => !v.activo);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(8,22,22,0.5)', backdropFilter: 'blur(4px)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9001,
        width: '100%', maxWidth: 480,
        background: 'var(--jordyn-bg, #f4f7f6)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header panel */}
        <div style={{ background: 'linear-gradient(135deg,#0a1628,#1a3a5c)', color: '#fff', padding: '1rem 1.25rem', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi bi-people-fill" style={{ color: '#0abfbc' }}></i>
              Vendedores
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {vendedores.length} registrado(s)
            </div>
          </div>
          <div className="d-flex gap-2">
            <button onClick={() => { setShowForm(p => !p); setEditando(null); setForm(emptyForm); }}
              style={{ background: '#0abfbc', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
              <i className={`bi bi-${showForm && !editando ? 'dash' : 'plus'}-lg me-1`}></i>
              {showForm && !editando ? 'Cancelar' : 'Nuevo'}
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>

          {/* Formulario crear/editar */}
          {showForm && (
            <div className="jd-card jd-card-primary mb-3 fade-in" style={{ padding: '1.1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--jordyn-primary)', marginBottom: '0.8rem' }}>
                {editando ? '✏️ Editar vendedor' : '➕ Nuevo vendedor'}
              </div>
              <form onSubmit={guardar}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label className="jd-label">NOMBRE COMPLETO *</label>
                    <input className="jd-input" value={form.nombre}
                      onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: Juan Pérez" autoFocus required />
                  </div>
                  <div>
                    <label className="jd-label">CÉDULA</label>
                    <input className="jd-input" value={form.cedula || ''}
                      onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))}
                      placeholder="123456789" />
                  </div>
                  {editando && (
                    <div>
                      <label className="jd-label">NUEVA CONTRASEÑA</label>
                      <input className="jd-input" type="password" value={form.password || ''}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        placeholder="Vacío = sin cambios" />
                    </div>
                  )}
                </div>
                {!editando && (
                  <div className="jd-alert jd-alert-info" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                    <i className="bi bi-info-circle-fill me-1"></i>
                    Las credenciales se generan automáticamente desde el nombre.
                  </div>
                )}
                <div className="d-flex gap-2">
                  <button type="submit" className="btn-jordyn" disabled={saving}>
                    {saving
                      ? 'Guardando...'
                      : <><i className="bi bi-floppy-fill me-1"></i>{editando ? 'Actualizar' : 'Crear vendedor'}</>
                    }
                  </button>
                  <button type="button" className="btn-jordyn-outline"
                    onClick={() => { setShowForm(false); setEditando(null); setForm(emptyForm); }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Credenciales generadas */}
          {creds && (
            <div style={{ background: 'linear-gradient(135deg,#0a3d62,#0abfbc)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1rem', color: '#fff' }}>
              <div style={{ fontWeight: 800, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>✅ Vendedor creado: {creds.nombre}</span>
                <button onClick={() => setCreds(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                <span>👤 <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{creds.usuario}</strong></span>
                <span>🔑 <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{creds.password}</strong></span>
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: 6 }}>⚠️ Copia las credenciales ahora. No se mostrarán de nuevo.</div>
            </div>
          )}

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="jd-input" style={{ flex: '1 1 160px' }}
              value={busq} onChange={e => setBusq(e.target.value)}
              placeholder="🔍 Buscar..." />
            <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)' }}>
              {[['todos', 'Todos'], ['activos', 'Activos'], ['inactivos', 'Inactivos']].map(([k, l]) => (
                <button key={k} onClick={() => setFiltroActivo(k)} style={S.pill(filtroActivo === k)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Lista de vendedores */}
          {loading ? (
            <div className="d-flex justify-content-center mt-4">
              <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
            </div>
          ) : (
            <>
              {activos.length > 0 && (
                <div style={{ marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--jordyn-green)', display: 'inline-block' }}></span>
                    Activos ({activos.length})
                  </div>
                  {activos.map(v => (
                    <VendedorRow key={v.id} v={v}
                      onEdit={abrirEditar}
                      onNums={onNums}
                      onDelete={() => setConfirmDelete({ ...v, tieneVentas: (v.total_ventas || 0) > 0 })} />
                  ))}
                </div>
              )}
              {inactivos.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ccc', display: 'inline-block' }}></span>
                    Inactivos ({inactivos.length})
                  </div>
                  {inactivos.map(v => (
                    <VendedorRow key={v.id} v={v}
                      onEdit={abrirEditar}
                      onNums={onNums}
                      onDelete={() => setConfirmDelete({ ...v, tieneVentas: (v.total_ventas || 0) > 0 })} />
                  ))}
                </div>
              )}
              {filtrados.length === 0 && (
                <div className="jd-alert jd-alert-warning">
                  {vendedores.length === 0 ? 'Sin vendedores registrados' : 'Sin resultados para la búsqueda'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}
          style={{ ...S.overlay, zIndex: 10000 }}>
          <div style={S.modal(440)}>
            <div style={S.header(confirmDelete.tieneVentas ? 'linear-gradient(135deg,#b37700,#f0a500)' : 'linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>{confirmDelete.tieneVentas ? '⚠️' : '🗑️'}</span>
                <div>
                  <div style={{ fontWeight: 800 }}>{confirmDelete.tieneVentas ? 'Vendedor con ventas' : 'Eliminar vendedor'}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{confirmDelete.nombre}</div>
                </div>
              </div>
              <button onClick={() => setConfirmDelete(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              {confirmDelete.tieneVentas ? (
                <>
                  <div style={{ background: '#fff8e1', border: '1.5px solid #ffd166', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#7a5c00', lineHeight: 1.6 }}>
                    <strong>No es posible eliminar</strong> — tiene <strong>{confirmDelete.total_ventas || 0} venta(s)</strong> registradas.
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Puedes <strong>desactivarlo</strong> para que no pueda iniciar sesión, conservando su historial.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn w-100" onClick={confirmarDesactivar}
                      style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}>
                      <i className="bi bi-pause-circle me-1"></i>Desactivar vendedor
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)}
                      style={{ flexShrink: 0, padding: '10px 16px' }}>Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                    ¿Eliminar definitivamente a <strong>"{confirmDelete.nombre}"</strong>? Sus números quedarán libres.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn-danger w-100" onClick={confirmarEliminacion} style={{ fontSize: '0.88rem' }}>
                      <i className="bi bi-trash3-fill me-1"></i>Eliminar definitivamente
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)}
                      style={{ flexShrink: 0, padding: '10px 16px' }}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Fila de vendedor dentro del panel */
function VendedorRow({ v, onEdit, onNums, onDelete }) {
  return (
    <div style={{
      border: '1.5px solid var(--jordyn-border)', borderRadius: 12, marginBottom: '0.6rem',
      background: v.activo ? '#fff' : 'var(--jordyn-bg2)', opacity: v.activo ? 1 : 0.75,
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)', transition: 'box-shadow .2s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,191,188,0.13)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.04)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 0.9rem', flexWrap: 'wrap' }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: v.activo ? 'var(--jordyn-primary)' : '#ccc',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.95rem',
        }}>
          {v.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {v.nombre}
            {!v.activo && <span style={{ background: '#eee', color: '#999', fontSize: '0.6rem', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>INACTIVO</span>}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
            @{v.usuario}{v.cedula ? ` · CC ${v.cedula}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={S.badge('var(--jordyn-primary)')}>
              <i className="bi bi-hash"></i>{v.numeros_count || 0} núm.
            </span>
            <span style={S.badge('#2ecc71')}>
              <i className="bi bi-receipt"></i>{v.total_ventas || 0} ventas
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onNums(v)} title="Gestionar números"
            style={{ background: 'rgba(10,191,188,0.1)', border: '1px solid rgba(10,191,188,0.3)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-primary)' }}>
            <i className="bi bi-hash"></i>
          </button>
          <button onClick={() => onEdit(v)} title="Editar"
            style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}>
            <i className="bi bi-pencil-fill"></i>
          </button>
          <button onClick={onDelete} title="Eliminar"
            style={{ background: '#fff5f5', border: '1px solid #ffcccc', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#e63946' }}>
            <i className="bi bi-trash3-fill"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — GestionVendedores
   La pantalla muestra las categorías como cards en un grid.
   El panel de vendedores se abre como slide-in lateral.
══════════════════════════════════════════════════════════════ */
export default function GestionVendedores() {
  const [vendedores,  setVendedores]  = useState([]);
  const [categorias,  setCategorias]  = useState([]);
  const [loadingV,    setLoadingV]    = useState(true);
  const [loadingC,    setLoadingC]    = useState(true);
  const [panelVendedores, setPanelVendedores] = useState(false);
  const [modalNums,   setModalNums]   = useState(null);    // { vendedor }
  const [modalCrearCat, setModalCrearCat] = useState(false);
  const [editCat,     setEditCat]     = useState(null);
  const [confirmDelCat, setConfirmDelCat] = useState(null);
  const [filtroTipo,  setFiltroTipo]  = useState('todos');
  const [busqCat,     setBusqCat]     = useState('');

  /* ── Cargar datos ── */
  const cargarVendedores = useCallback(async () => {
    setLoadingV(true);
    try {
      const res = await API.get('/vendedores');
      setVendedores(res.data);
    } catch { toast.error('Error cargando vendedores'); }
    finally   { setLoadingV(false); }
  }, []);

  const cargarCategorias = useCallback(async () => {
    setLoadingC(true);
    try {
      const res = await API.get('/categorias-globales');
      setCategorias(res.data);
    } catch { toast.error('Error cargando categorías'); }
    finally   { setLoadingC(false); }
  }, []);

  useEffect(() => {
    cargarVendedores();
    cargarCategorias();
  }, [cargarVendedores, cargarCategorias]);

  /* ── Eliminar categoría ── */
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

  /* ── Filtrar categorías ── */
  const categoriasFiltradas = categorias.filter(c => {
    const okTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;
    const okBusq = !busqCat  || c.nombre.toLowerCase().includes(busqCat.toLowerCase());
    return okTipo && okBusq;
  });

  const vendedoresActivos = vendedores.filter(v => v.activo);

  return (
    <Layout>
      {/* ── Header página ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-tags-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            Categorías y Vendedores
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: '2px 0 0' }}>
            {categorias.length} categoría(s) · {vendedores.length} vendedor(es)
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn-jordyn-outline" onClick={() => setPanelVendedores(true)}
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-people-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            Vendedores ({vendedores.length})
          </button>
          <button className="btn-jordyn" onClick={() => setModalCrearCat(true)}
            style={{ fontSize: '0.82rem' }}>
            <i className="bi bi-plus-lg me-1"></i>Nueva categoría
          </button>
        </div>
      </div>

      {/* ── Filtros de categorías ── */}
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

      {/* ── Grid de categorías ── */}
      {loadingC ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width: 44, height: 44 }}></div>
        </div>
      ) : categoriasFiltradas.length === 0 ? (
        <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '2.5rem' }}>
          {categorias.length === 0
            ? <>
                <i className="bi bi-tags" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, opacity: 0.4 }}></i>
                Sin categorías. Crea la primera con el botón <strong>"Nueva categoría"</strong>.
              </>
            : 'Sin resultados para los filtros aplicados.'
          }
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {categoriasFiltradas.map(cat => (
            <CategoriaCard
              key={cat.id}
              cat={cat}
              vendedoresActivos={vendedoresActivos}
              onEdit={c => setEditCat(c)}
              onDelete={c => setConfirmDelCat(c)}
              onSaved={cargarCategorias}
            />
          ))}
        </div>
      )}

      {/* ── Panel lateral de vendedores ── */}
      {panelVendedores && (
        <PanelVendedores
          vendedores={vendedores}
          loading={loadingV}
          onClose={() => setPanelVendedores(false)}
          onCreated={cargarVendedores}
          onUpdated={cargarVendedores}
          onDeleted={cargarVendedores}
          onNums={v => setModalNums({ vendedor: v })}
        />
      )}

      {/* ── Modal números del vendedor ── */}
      {modalNums && (
        <ModalNumerosVendedor
          vendedor={modalNums.vendedor}
          onClose={() => setModalNums(null)}
          onSaved={cargarVendedores}
        />
      )}

      {/* ── Modal crear categoría ── */}
      {modalCrearCat && (
        <ModalCrearCategoria
          onClose={() => setModalCrearCat(false)}
          onSaved={cargarCategorias}
        />
      )}

      {/* ── Modal editar categoría ── */}
      {editCat && (
        <ModalCrearCategoria
          categoria={editCat}
          onClose={() => setEditCat(null)}
          onSaved={cargarCategorias}
        />
      )}

      {/* ── Confirm eliminar categoría ── */}
      {confirmDelCat && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelCat(null)}
          style={S.overlay}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ fontWeight: 800 }}>🗑️ Eliminar categoría</div>
              <button onClick={() => setConfirmDelCat(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                ¿Eliminar la categoría <strong>"{confirmDelCat.nombre}"</strong>?
                Se eliminarán todas las asignaciones de vendedores en esta categoría.
              </p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn-danger w-100" onClick={() => eliminarCategoria(confirmDelCat)}>
                  <i className="bi bi-trash3-fill me-1"></i>Eliminar
                </button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmDelCat(null)}
                  style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}