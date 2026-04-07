// ============================================================
//   GestionVendedores.js — RIFAS JORDYN (NUEVA ARQUITECTURA)
//
//   FLUJO DE CATEGORÍAS GLOBALES:
//   - Las categorías son GLOBALES (no por vendedor), tipo "Premio $1000"
//   - Tipo PARCIAL:  pool único de 000–999.
//       Un número solo puede pertenecer a UN vendedor en esa categoría.
//   - Tipo SIMULTÁNEA: dos series (A: 000–999, B: 000–999).
//       El mismo número puede estar en ambas series (uno por serie).
//       Al asignar, el sistema busca la serie libre automáticamente.
//   - Los vendedores se asignan DENTRO de una categoría con sus números.
//   - Validación de colisión: misma categoría + mismo número + mismo tipo de serie
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ─── Helpers ─── */
const fmtCOP = (p) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

const NUM_RE = /^\d{3}$/;
const pad3   = (n) => String(n).padStart(3, '0');

function generarCredenciales(nombre) {
  const base = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim()
    .split(/\s+/).join('_').slice(0, 20);
  const sufijo = Math.floor(1000 + Math.random() * 9000);
  return { usuario: `${base}_${sufijo}`, password: `${base}${sufijo}` };
}

/* ══════════════════════════════════════════════════════════════
   ESTILOS INLINE COMPARTIDOS
══════════════════════════════════════════════════════════════ */
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
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: `${color}18`, border: `1.5px solid ${color}40`,
    color, borderRadius: 20, padding: '2px 10px',
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.4px'
  }),
  pill: (active) => ({
    padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 700, transition: 'all .15s',
    background: active ? 'var(--jordyn-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--jordyn-muted)',
  }),
  numChip: (estado) => {
    const map = {
      libre:        { bg: '#f0fafa', border: '#0abfbc', color: '#0abfbc' },
      ocupado_otro: { bg: '#fff5f5', border: '#e63946', color: '#e63946' },
      propio:       { bg: '#f0fff4', border: '#2ecc71', color: '#1a7a40' },
      bloqueado:    { bg: '#f5f5f5', border: '#ccc',    color: '#aaa'    },
    };
    const s = map[estado] || map.libre;
    return {
      width: 48, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '0.72rem', border: `1.5px solid ${s.border}`,
      borderRadius: 8, color: s.color, background: s.bg,
      cursor: estado === 'libre' ? 'pointer' : 'default',
      userSelect: 'none', transition: 'transform .1s',
    };
  },
  tipoBadge: (tipo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 800,
    ...(tipo === 'simultanea'
      ? { background: '#fff0f5', border: '1.5px solid #e91e8c40', color: '#e91e8c' }
      : { background: '#f0f5ff', border: '1.5px solid #4361ee40', color: '#4361ee' })
  }),
};

/* ══════════════════════════════════════════════════════════════
   MODAL — CREAR / EDITAR CATEGORÍA GLOBAL
══════════════════════════════════════════════════════════════ */
function ModalCrearCategoria({ categoria, onClose, onSaved }) {
  const esEditar = !!categoria;
  const [form, setForm] = useState({
    nombre:      categoria?.nombre      || '',
    tipo:        categoria?.tipo        || 'parcial',
    descripcion: categoria?.descripcion || '',
    monto:       categoria?.monto       || '',
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
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={S.overlay}>
      <div style={S.modal(560)}>
        <div style={S.header(esEditar ? 'linear-gradient(135deg,#1a7a40,#2ecc71)' : 'linear-gradient(135deg,#0a3d62,#0abfbc)')}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              {esEditar ? '✏️ Editar Categoría' : '🏷️ Nueva Categoría Global'}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {esEditar ? categoria.nombre : 'Las categorías agrupan vendedores con sus números fijos'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div style={S.body}>
          {/* Nombre */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">NOMBRE DE LA CATEGORÍA *</label>
            <input className="jd-input" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Premio $1000, VIP, Básico..." autoFocus />
          </div>

          {/* Monto referencial */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">MONTO / DESCRIPCIÓN REFERENCIAL</label>
            <input className="jd-input" value={form.monto}
              onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
              placeholder="Ej: $1,000 · Premio principal" />
          </div>

          {/* Tipo */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">TIPO DE CATEGORÍA *</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {[
                { key: 'parcial', icon: '🎯', label: 'Parcial', desc: 'Pool único 000–999. Cada número pertenece a un solo vendedor.' },
                { key: 'simultanea', icon: '⚡', label: 'Simultánea', desc: 'Dos series A y B (000–999 cada una). El mismo número puede tenerlo un vendedor por serie.' }
              ].map(({ key, icon, label, desc }) => (
                <div key={key}
                  onClick={() => !esEditar && setForm(p => ({ ...p, tipo: key }))}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: 12, cursor: esEditar ? 'default' : 'pointer',
                    border: `2px solid ${form.tipo === key ? (key === 'simultanea' ? '#e91e8c' : '#4361ee') : 'var(--jordyn-border)'}`,
                    background: form.tipo === key ? (key === 'simultanea' ? '#fff0f580' : '#f0f5ff80') : 'var(--jordyn-bg2)',
                    transition: 'all .15s', opacity: esEditar ? 0.7 : 1
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 4,
                    color: form.tipo === key ? (key === 'simultanea' ? '#e91e8c' : '#4361ee') : 'var(--jordyn-text)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
            {esEditar && (
              <div className="jd-alert jd-alert-warning mt-2" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-lock-fill me-1"></i>El tipo no se puede cambiar una vez creada la categoría.
              </div>
            )}
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="jd-label">NOTAS INTERNAS</label>
            <textarea className="jd-input" rows={2} value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Notas adicionales sobre esta categoría..." style={{ resize: 'none' }} />
          </div>

          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>
              {saving ? <><span className="jd-spinner" style={{ width: 16, height: 16 }}></span> Guardando...</> : <><i className="bi bi-floppy-fill me-1"></i>{esEditar ? 'Actualizar' : 'Crear categoría'}</>}
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
   MODAL — VER CATEGORÍA (vendedores asignados + agregar)
══════════════════════════════════════════════════════════════ */
function ModalVerCategoria({ categoria, todosVendedores, onClose, onSaved }) {
  const [asignaciones, setAsignaciones] = useState([]);  // { vendedor_id, vendedor_nombre, numero, serie }
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [vendedorSel,  setVendedorSel]  = useState('');
  const [numInput,     setNumInput]     = useState('');
  const [serieSel,     setSerieSel]     = useState('A');
  const [saving,       setSaving]       = useState(false);
  const [busqNum,      setBusqNum]      = useState('');
  const [busqVend,     setBusqVend]     = useState('');

  const esSim = categoria.tipo === 'simultanea';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/categorias-globales/${categoria.id}/vendedores`);
      setAsignaciones(res.data);
    } catch { toast.error('Error cargando asignaciones'); }
    finally  { setLoading(false); }
  }, [categoria.id]);

  useEffect(() => { cargar(); }, [cargar]);

  /* Números ya ocupados en esta categoría */
  const getOcupadosPorSerie = (serie) =>
    asignaciones.filter(a => !esSim || a.serie === serie).map(a => a.numero);

  /* Verifica si el vendedor ya tiene ese número en otra categoría para la misma rifa */
  const verificarConflicto = () => {
    const num = pad3(parseInt(numInput) || 0);
    if (!NUM_RE.test(num)) return 'Número inválido (000–999)';
    if (!vendedorSel) return 'Selecciona un vendedor';

    const serie = esSim ? serieSel : 'A';
    const ocupadosEnSerie = getOcupadosPorSerie(serie);

    if (ocupadosEnSerie.includes(num)) {
      const dueno = asignaciones.find(a => a.numero === num && (!esSim || a.serie === serie));
      return `El número ${num}${esSim ? ` (Serie ${serie})` : ''} ya lo tiene ${dueno?.vendedor_nombre || 'otro vendedor'}`;
    }
    return null;
  };

  const agregar = async () => {
    const num  = pad3(parseInt(numInput) || 0);
    const error = verificarConflicto();
    if (error) { toast.warning(error); return; }

    setSaving(true);
    try {
      const payload = {
        vendedor_id: vendedorSel,
        numero:      num,
        ...(esSim ? { serie: serieSel } : {}),
      };
      await API.post(`/categorias-globales/${categoria.id}/vendedores`, payload);
      toast.success(`✅ Número ${num}${esSim ? ` (Serie ${serieSel})` : ''} asignado`);
      setNumInput(''); setShowForm(false);
      await cargar();
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error asignando');
    } finally { setSaving(false); }
  };

  const quitar = async (asignacionId) => {
    if (!window.confirm('¿Quitar esta asignación?')) return;
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${asignacionId}`);
      toast.info('Asignación removida');
      await cargar();
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  /* Filtros */
  const asigFiltradas = asignaciones.filter(a => {
    const okNum  = !busqNum  || a.numero.includes(busqNum.trim());
    const okVend = !busqVend || a.vendedor_nombre.toLowerCase().includes(busqVend.toLowerCase());
    return okNum && okVend;
  });

  /* Agrupar por vendedor para mostrar */
  const porVendedor = {};
  asigFiltradas.forEach(a => {
    if (!porVendedor[a.vendedor_id]) porVendedor[a.vendedor_id] = { nombre: a.vendedor_nombre, numeros: [] };
    porVendedor[a.vendedor_id].numeros.push({ numero: a.numero, serie: a.serie, id: a.id });
  });

  const vendedoresYaEnCat = [...new Set(asignaciones.map(a => a.vendedor_id))];
  const vendedoresDisp    = todosVendedores.filter(v =>
    // En parcial solo puede estar 1 vez; en simultánea puede estar en ambas series
    esSim ? true : !vendedoresYaEnCat.includes(v.id)
  );

  const numEjemplo = numInput ? pad3(parseInt(numInput) || 0) : null;
  const conflicto  = numEjemplo && vendedorSel ? verificarConflicto() : null;
  const serieLibre = esSim && numEjemplo ? (
    !getOcupadosPorSerie('A').includes(numEjemplo) ? 'A' :
    !getOcupadosPorSerie('B').includes(numEjemplo) ? 'B' : null
  ) : null;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={S.overlay}>
      <div style={S.modal(860)}>

        {/* Header */}
        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.tipoBadge(categoria.tipo)}>{esSim ? '⚡ Simultánea' : '🎯 Parcial'}</span>
              {categoria.nombre}
              {categoria.monto && <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>· {categoria.monto}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 4 }}>
              {asignaciones.length} asignación(es) · {Object.keys(porVendedor).length} vendedor(es)
            </div>
          </div>
          <div className="d-flex gap-2">
            <button onClick={() => setShowForm(p => !p)} style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700
            }}>
              <i className={`bi bi-${showForm ? 'dash' : 'plus'}-lg me-1`}></i>
              {showForm ? 'Cancelar' : 'Asignar vendedor'}
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div style={S.body}>

          {/* INFO */}
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Existen dos series (A y B) de 000–999. El mismo número puede pertenecer a un vendedor en Serie A y otro en Serie B. El sistema detecta la serie disponible automáticamente.</>
              : <><strong>Parcial:</strong> Pool único de 000–999. Cada número pertenece exclusivamente a un vendedor en esta categoría.</>
            }
          </div>

          {/* FORM ASIGNAR */}
          {showForm && (
            <div style={{ background: 'var(--jordyn-bg2)', border: '2px solid var(--jordyn-primary)', borderRadius: 14, padding: '1.1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--jordyn-primary)', marginBottom: '0.75rem' }}>
                <i className="bi bi-person-plus-fill me-2"></i>Asignar vendedor + número
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

                {/* Vendedor */}
                <div style={{ flex: '1 1 200px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>VENDEDOR *</label>
                  <select className="jd-input" value={vendedorSel} onChange={e => setVendedorSel(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {vendedoresDisp.map(v => (
                      <option key={v.id} value={v.id}>{v.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Número */}
                <div style={{ flex: '0 0 110px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>NÚMERO (000–999) *</label>
                  <input className="jd-input"
                    value={numInput}
                    onChange={e => setNumInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    onKeyDown={e => e.key === 'Enter' && agregar()}
                    placeholder="000" maxLength={3}
                    style={{ textAlign: 'center', fontWeight: 800, letterSpacing: 4, fontSize: '1.1rem' }}
                  />
                </div>

                {/* Serie (solo simultánea) */}
                {esSim && (
                  <div style={{ flex: '0 0 120px' }}>
                    <label className="jd-label" style={{ fontSize: '0.62rem' }}>SERIE *</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['A', 'B'].map(s => (
                        <button key={s} onClick={() => setSerieSel(s)} style={{
                          flex: 1, height: 44, borderRadius: 8, border: `2px solid ${serieSel === s ? '#e91e8c' : 'var(--jordyn-border)'}`,
                          background: serieSel === s ? '#fff0f5' : '#fff', color: serieSel === s ? '#e91e8c' : 'var(--jordyn-muted)',
                          fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer'
                        }}>
                          Serie {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botón */}
                <button className="btn-jordyn" onClick={agregar} disabled={saving || !vendedorSel || !numInput}
                  style={{ height: 44, padding: '0 20px', flexShrink: 0, fontSize: '0.82rem' }}>
                  {saving ? <span className="jd-spinner" style={{ width: 16, height: 16 }}></span> : <><i className="bi bi-plus-lg me-1"></i>Agregar</>}
                </button>
              </div>

              {/* Feedback en tiempo real */}
              {numEjemplo && vendedorSel && (
                <div style={{ marginTop: '0.75rem' }}>
                  {conflicto ? (
                    <div style={{
                      background: '#fff5f5', border: '1.5px solid #ffaaaa', borderRadius: 10,
                      padding: '8px 14px', fontSize: '0.78rem', color: '#c0392b',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      <i className="bi bi-x-circle-fill"></i>
                      <strong>Conflicto:</strong> {conflicto}
                    </div>
                  ) : (
                    <div style={{
                      background: '#f0fff8', border: '1.5px solid #2ecc7140', borderRadius: 10,
                      padding: '8px 14px', fontSize: '0.78rem', color: '#1a7a40',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      <i className="bi bi-check-circle-fill"></i>
                      Número {numEjemplo}{esSim ? ` Serie ${serieSel}` : ''} disponible ✔
                      {esSim && serieLibre && serieSel !== serieLibre && (
                        <span style={{ marginLeft: 6, color: '#e91e8c' }}>
                          · Serie {serieLibre} también disponible
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FILTROS */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input className="jd-input" style={{ flex: '0 0 100px' }}
              value={busqNum} onChange={e => setBusqNum(e.target.value.replace(/\D/g, ''))}
              placeholder="🔍 Número" maxLength={3} />
            <input className="jd-input" style={{ flex: '1 1 180px' }}
              value={busqVend} onChange={e => setBusqVend(e.target.value)}
              placeholder="🔍 Buscar vendedor..." />
            {(busqNum || busqVend) && (
              <button className="btn-jordyn-outline" onClick={() => { setBusqNum(''); setBusqVend(''); }}
                style={{ padding: '0 14px', fontSize: '0.78rem' }}>
                <i className="bi bi-x-lg"></i> Limpiar
              </button>
            )}
          </div>

          {/* LISTA */}
          {loading ? (
            <div className="d-flex justify-content-center py-4">
              <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
            </div>
          ) : asignaciones.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center' }}>
              <i className="bi bi-people-fill" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>
              Sin vendedores asignados todavía. Usa el botón <strong>Asignar vendedor</strong> para comenzar.
            </div>
          ) : Object.keys(porVendedor).length === 0 ? (
            <div className="jd-alert jd-alert-info" style={{ fontSize: '0.82rem' }}>Sin resultados para los filtros aplicados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(porVendedor).map(([vid, vdata]) => (
                <div key={vid} style={{ border: '2px solid var(--jordyn-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Cabecera vendedor */}
                  <div style={{
                    background: 'var(--jordyn-bg2)', padding: '0.7rem 1rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid var(--jordyn-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'var(--jordyn-primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.85rem', flexShrink: 0
                      }}>
                        {vdata.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--jordyn-text)' }}>{vdata.nombre}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)' }}>
                          {vdata.numeros.length} número(s) asignado(s)
                          {esSim && (() => {
                            const serieA = vdata.numeros.filter(n => n.serie === 'A').length;
                            const serieB = vdata.numeros.filter(n => n.serie === 'B').length;
                            return ` · ${serieA > 0 ? `Serie A: ${serieA}` : ''} ${serieB > 0 ? `Serie B: ${serieB}` : ''}`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {esSim ? (
                        ['A', 'B'].map(s => {
                          const cnt = vdata.numeros.filter(n => n.serie === s).length;
                          return cnt > 0 ? (
                            <span key={s} style={S.badge('#e91e8c')}>Serie {s}: {cnt}</span>
                          ) : null;
                        })
                      ) : (
                        <span style={S.badge('var(--jordyn-primary)')}>{vdata.numeros.length} núms</span>
                      )}
                    </div>
                  </div>

                  {/* Números */}
                  <div style={{ padding: '0.75rem 1rem' }}>
                    {esSim ? (
                      ['A', 'B'].map(serie => {
                        const numsS = vdata.numeros.filter(n => n.serie === serie);
                        if (!numsS.length) return null;
                        return (
                          <div key={serie} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e91e8c', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                              ● Serie {serie}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {numsS.sort((a,b) => a.numero.localeCompare(b.numero)).map(n => (
                                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{
                                    padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: '0.75rem',
                                    background: '#fff0f5', border: '1.5px solid #e91e8c40', color: '#e91e8c'
                                  }}>{n.numero}</span>
                                  <button onClick={() => quitar(n.id)} title="Quitar" style={{
                                    background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '0 2px',
                                    fontSize: '0.65rem', lineHeight: 1
                                  }}><i className="bi bi-x-circle"></i></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {vdata.numeros.sort((a,b) => a.numero.localeCompare(b.numero)).map(n => (
                          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: '0.75rem',
                              background: 'rgba(10,191,188,0.1)', border: '1.5px solid rgba(10,191,188,0.35)', color: 'var(--jordyn-primary)'
                            }}>{n.numero}</span>
                            <button onClick={() => quitar(n.id)} title="Quitar" style={{
                              background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '0 2px',
                              fontSize: '0.65rem', lineHeight: 1
                            }}><i className="bi bi-x-circle"></i></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL — NÚMEROS GLOBALES DEL VENDEDOR (existente mejorado)
══════════════════════════════════════════════════════════════ */
function ModalNumerosVendedor({ vendedor, numerosOcupados, onClose, onSaved }) {
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

  const estaOcupado = (num) => numerosOcupados.includes(num);

  const agregar = async (nums) => {
    const validos     = nums.filter(n => NUM_RE.test(n) && !asignados.includes(n) && !estaOcupado(n));
    const yaOcupados  = nums.filter(n => estaOcupado(n) && !asignados.includes(n));
    if (yaOcupados.length) toast.warning(`${yaOcupados.length} número(s) ya pertenecen a otro vendedor`);
    if (!validos.length) return;
    try {
      await API.post('/numeros/asignar', { vendedor_id: vendedor.id, numeros: validos });
      setAsignados(p => [...new Set([...p, ...validos])].sort());
      toast.success(`${validos.length} número(s) asignados`);
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
    if (!NUM_RE.test(num)) { toast.error('Número inválido'); return; }
    agregar([num]); setNumInput('');
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) { toast.error('Rango inválido'); return; }
    const nums = []; for (let i = ini; i <= fin; i++) nums.push(pad3(i));
    agregar(nums);
  };

  const agregarAleatorios = async () => {
    setLoadingAl(true);
    try {
      const excluir = [...new Set([...numerosOcupados, ...asignados])];
      const res = await API.get(`/vendedores/${vendedor.id}/numeros-aleatorios`, {
        params: { cantidad, excluir: excluir.join(',') }
      });
      const nums = res.data.numeros_sugeridos || [];
      if (!nums.length) { toast.warning('No hay números disponibles'); return; }
      await API.post('/numeros/asignar', { vendedor_id: vendedor.id, numeros: nums });
      setAsignados(p => [...new Set([...p, ...nums])].sort());
      toast.success(`${nums.length} números aleatorios asignados`);
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoadingAl(false); }
  };

  const disponiblesGlobal = 1000 - numerosOcupados.length - asignados.length;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={S.overlay}>
      <div style={S.modal(700)}>
        <div style={S.header()}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>🔢 NÚMEROS GLOBALES — {vendedor.nombre}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {asignados.length} asignados · {disponiblesGlobal} libres del pool de 1,000
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div style={S.body}>
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem' }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            Números fijos de este vendedor. Se usarán al asignarlo en categorías de rifas.
          </div>

          {/* Barra progreso */}
          <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem', border: '1px solid var(--jordyn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 600 }}>
              <span>POOL GLOBAL (0–999)</span>
              <span>{numerosOcupados.length + asignados.length} / 1000 ocupados</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, var(--jordyn-primary), var(--jordyn-green))',
                width: `${((numerosOcupados.length + asignados.length) / 1000) * 100}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.68rem' }}>
              <span style={{ color: 'var(--jordyn-primary)', fontWeight: 700 }}>● Este vendedor: {asignados.length}</span>
              <span style={{ color: 'var(--jordyn-muted)' }}>● Otros: {numerosOcupados.length}</span>
              <span style={{ color: 'var(--jordyn-green)', fontWeight: 700 }}>● Libres: {disponiblesGlobal}</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)', marginBottom: '1rem' }}>
            {[['manual','Manual'],['rango','Rango'],['aleatorio','Aleatorios']].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600,
                background: tab === k ? 'var(--jordyn-primary)' : 'transparent',
                color: tab === k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: k !== 'aleatorio' ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {tab === 'manual' && (
            <div className="d-flex gap-2 mb-3">
              <input className="jd-input" value={numInput}
                onChange={e => setNumInput(e.target.value.replace(/\D/g,'').slice(0,3))}
                onKeyDown={e => e.key === 'Enter' && agregarManual()}
                placeholder="000" maxLength={3}
                style={{ maxWidth: 100, textAlign: 'center', fontWeight: 800, letterSpacing: 4, fontSize: '1.1rem' }} />
              <button className="btn-jordyn" onClick={agregarManual}>
                <i className="bi bi-plus-lg me-1"></i>Agregar
              </button>
            </div>
          )}

          {tab === 'rango' && (
            <div className="d-flex gap-2 mb-3 flex-wrap">
              <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value.replace(/\D/g,''))}
                placeholder="Desde" style={{ maxWidth: 90, textAlign:'center' }} maxLength={3} />
              <span style={{ alignSelf:'center', color:'var(--jordyn-muted)' }}>→</span>
              <input className="jd-input" value={rangoFin} onChange={e => setRangoFin(e.target.value.replace(/\D/g,''))}
                placeholder="Hasta" style={{ maxWidth: 90, textAlign:'center' }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarRango}>
                <i className="bi bi-plus-lg me-1"></i>Agregar rango
              </button>
            </div>
          )}

          {tab === 'aleatorio' && (
            <div className="d-flex gap-2 mb-3 align-items-center">
              <input type="number" className="jd-input" value={cantidad} min={1} max={200}
                onChange={e => setCantidad(Math.min(200, Math.max(1, parseInt(e.target.value)||1)))}
                style={{ maxWidth: 80, textAlign:'center' }} />
              <span style={{ fontSize:'0.82rem', color:'var(--jordyn-muted)' }}>números aleatorios</span>
              <button className="btn-jordyn" onClick={agregarAleatorios} disabled={loadingAl}>
                {loadingAl ? <span className="jd-spinner" style={{width:16,height:16}}></span> : <><i className="bi bi-shuffle me-1"></i>Generar</>}
              </button>
            </div>
          )}

          {/* Números asignados */}
          {loadingIni ? (
            <div className="d-flex justify-content-center py-3"><div className="jd-spinner" style={{width:32,height:32}}></div></div>
          ) : asignados.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{fontSize:'0.82rem'}}>Sin números asignados.</div>
          ) : (
            <div>
              <div style={{fontSize:'0.68rem',fontWeight:700,color:'var(--jordyn-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>
                NÚMEROS ASIGNADOS ({asignados.length})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {asignados.map(n => (
                  <div key={n} onClick={() => quitar(n)} title="Click para quitar" style={{
                    padding:'4px 10px', borderRadius:8, fontWeight:800, fontSize:'0.75rem',
                    background:'rgba(10,191,188,0.1)', border:'1.5px solid rgba(10,191,188,0.4)',
                    color:'var(--jordyn-primary)', cursor:'pointer', transition:'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background='#fff5f5'; e.currentTarget.style.borderColor='#e63946'; e.currentTarget.style.color='#e63946'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(10,191,188,0.1)'; e.currentTarget.style.borderColor='rgba(10,191,188,0.4)'; e.currentTarget.style.color='var(--jordyn-primary)'; }}
                  >{n}</div>
                ))}
              </div>
              <div style={{fontSize:'0.68rem',color:'var(--jordyn-muted)',marginTop:8}}>
                💡 Click en un número para quitarlo
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PANEL — CATEGORÍAS GLOBALES
══════════════════════════════════════════════════════════════ */
function PanelCategorias({ todosVendedores, onClose }) {
  const [categorias,    setCategorias]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalCrear,    setModalCrear]    = useState(false);
  const [editCat,       setEditCat]       = useState(null);
  const [verCat,        setVerCat]        = useState(null);
  const [confirmDel,    setConfirmDel]    = useState(null);
  const [filtroTipo,    setFiltroTipo]    = useState('todos');
  const [busqCat,       setBusqCat]       = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/categorias-globales');
      setCategorias(res.data);
    } catch { toast.error('Error cargando categorías'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (cat) => {
    try {
      await API.delete(`/categorias-globales/${cat.id}`);
      toast.success('Categoría eliminada');
      setConfirmDel(null);
      cargar();
    } catch (err) { toast.error(err.response?.data?.error || 'No se puede eliminar'); setConfirmDel(null); }
  };

  const filtradas = categorias.filter(c => {
    const okTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;
    const okBusq = !busqCat || c.nombre.toLowerCase().includes(busqCat.toLowerCase());
    return okTipo && okBusq;
  });

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={S.overlay}>
      <div style={S.modal(900)}>

        {/* Header */}
        <div style={S.header('linear-gradient(135deg,#0a1628,#1a3a5c)')}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              <i className="bi bi-tags-fill me-2" style={{ color: '#0abfbc' }}></i>
              CATEGORÍAS GLOBALES DE RIFAS
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {categorias.length} categoría(s) · Gestiona premios con vendedores y números asignados
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              onClick={() => setModalCrear(true)}
              style={{ background: '#0abfbc', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
            >
              <i className="bi bi-plus-lg me-1"></i>Nueva categoría
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div style={S.body}>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)' }}>
              {[['todos','Todas'],['parcial','Parcial'],['simultanea','Simultánea']].map(([k,l]) => (
                <button key={k} onClick={() => setFiltroTipo(k)} style={S.pill(filtroTipo===k)}>{l}</button>
              ))}
            </div>
            <input className="jd-input" style={{ flex: '1 1 200px', minWidth: 140 }}
              value={busqCat} onChange={e => setBusqCat(e.target.value)}
              placeholder="🔍 Buscar categoría..." />
          </div>

          {/* Lista */}
          {loading ? (
            <div className="d-flex justify-content-center py-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
          ) : filtradas.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center' }}>
              {categorias.length === 0
                ? <><i className="bi bi-tags" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>Sin categorías. Crea la primera.</>
                : 'Sin categorías para los filtros aplicados.'
              }
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '0.85rem' }}>
              {filtradas.map(cat => {
                const esSim = cat.tipo === 'simultanea';
                const accentColor = esSim ? '#e91e8c' : '#4361ee';
                return (
                  <div key={cat.id} style={{
                    border: `2px solid ${accentColor}30`,
                    borderRadius: 14, overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    transition: 'box-shadow .2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = `0 6px 24px ${accentColor}25`}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                  >
                    {/* Banda de color */}
                    <div style={{ height: 4, background: `linear-gradient(90deg,${accentColor},${accentColor}80)` }} />

                    <div style={{ padding: '0.9rem 1rem' }}>
                      {/* Cabecera */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--jordyn-text)', marginBottom: 3 }}>
                            {cat.nombre}
                          </div>
                          {cat.monto && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>
                              💰 {cat.monto}
                            </div>
                          )}
                          <span style={S.tipoBadge(cat.tipo)}>
                            {esSim ? '⚡ Simultánea' : '🎯 Parcial'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setEditCat(cat)} title="Editar" style={{
                            background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)',
                            borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-muted)'
                          }}><i className="bi bi-pencil-fill"></i></button>
                          <button onClick={() => setConfirmDel(cat)} title="Eliminar" style={{
                            background: '#fff5f5', border: '1px solid #ffcccc',
                            borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: '#e63946'
                          }}><i className="bi bi-trash3-fill"></i></button>
                        </div>
                      </div>

                      {/* Estadísticas */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <span style={S.badge('var(--jordyn-primary)')}>
                          <i className="bi bi-people-fill"></i> {cat.total_vendedores || 0} vendedores
                        </span>
                        <span style={S.badge('#2ecc71')}>
                          <i className="bi bi-hash"></i> {cat.total_numeros || 0} números
                        </span>
                        {esSim && (
                          <>
                            <span style={S.badge('#e91e8c')}>Serie A: {cat.numeros_serie_a || 0}</span>
                            <span style={S.badge('#9b59b6')}>Serie B: {cat.numeros_serie_b || 0}</span>
                          </>
                        )}
                      </div>

                      {cat.descripcion && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                          {cat.descripcion}
                        </div>
                      )}

                      {/* Botón ver */}
                      <button
                        className="btn-jordyn w-100"
                        onClick={() => setVerCat(cat)}
                        style={{ fontSize: '0.8rem', background: `linear-gradient(135deg,${accentColor},${accentColor}cc)` }}
                      >
                        <i className="bi bi-eye-fill me-1"></i>
                        Ver vendedores asignados
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {modalCrear && (
        <ModalCrearCategoria onClose={() => setModalCrear(false)} onSaved={cargar} />
      )}
      {editCat && (
        <ModalCrearCategoria categoria={editCat} onClose={() => setEditCat(null)} onSaved={cargar} />
      )}
      {verCat && (
        <ModalVerCategoria
          categoria={verCat}
          todosVendedores={todosVendedores}
          onClose={() => setVerCat(null)}
          onSaved={cargar}
        />
      )}
      {confirmDel && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDel(null)} style={{ ...S.overlay, zIndex: 10100 }}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ fontWeight: 800 }}>🗑️ Eliminar categoría</div>
              <button onClick={() => setConfirmDel(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                ¿Eliminar la categoría <strong>"{confirmDel.nombre}"</strong>?
                Esto removerá todas las asignaciones de vendedores y números de esta categoría.
              </p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn-danger w-100" onClick={() => eliminar(confirmDel)}>
                  <i className="bi bi-trash3-fill me-1"></i>Eliminar
                </button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmDel(null)} style={{ flexShrink: 0, padding: '0 18px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — GestionVendedores
══════════════════════════════════════════════════════════════ */
const emptyForm = { nombre: '', rol: 'vendedor' };

export default function GestionVendedores() {
  const [vendedores,    setVendedores]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [editando,      setEditando]      = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [creds,         setCreds]         = useState(null);
  const [modalNums,     setModalNums]     = useState(null);   // { vendedor }
  const [modalCats,     setModalCats]     = useState(false);  // panel categorías globales
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busq,          setBusq]          = useState('');
  const [filtroActivo,  setFiltroActivo]  = useState('todos');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/vendedores');
      setVendedores(res.data);
    } catch { toast.error('Error cargando vendedores'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Números ocupados por otros vendedores (para validar asignación global) */
  const getNumerosOcupadosPorOtros = (excluirId) => {
    const ocupados = new Set();
    vendedores.forEach(v => {
      if (v.id === excluirId) return;
      (v.numeros_asignados || []).forEach(n => ocupados.add(typeof n === 'object' ? n.numero : n));
    });
    return [...ocupados];
  };

  /* Guardar vendedor */
  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre?.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      if (editando) {
        await API.put(`/vendedores/${editando}`, form);
        toast.success('Vendedor actualizado');
        setEditando(null); setShowForm(false); setForm(emptyForm);
      } else {
        const cred = generarCredenciales(form.nombre);
        const res  = await API.post('/auth/register', { ...form, ...cred });
        setCreds({ ...cred, nombre: form.nombre, id: res.data?.id });
        toast.success('Vendedor creado');
        setShowForm(false); setForm(emptyForm);
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
  };

  const abrirEditar = (v) => {
    setEditando(v.id);
    setForm({ nombre: v.nombre, rol: 'vendedor', cedula: v.cedula || '', activo: v.activo });
    setShowForm(true);
  };

  const confirmarEliminacion = async () => {
    try {
      await API.delete(`/vendedores/${confirmDelete.id}`);
      toast.success('Vendedor eliminado');
      setConfirmDelete(null); load();
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('ventas')) {
        setConfirmDelete(p => ({ ...p, tieneVentas: true, errorVentas: true }));
      } else {
        toast.error(msg || 'Error eliminando');
      }
    }
  };

  const confirmarDesactivar = async () => {
    try {
      await API.put(`/vendedores/${confirmDelete.id}`, { activo: false });
      toast.info('Vendedor desactivado');
      setConfirmDelete(null); load();
    } catch { toast.error('Error desactivando'); }
  };

  /* Filtros */
  const filtrados = vendedores.filter(v => {
    const okBusq  = !busq || v.nombre.toLowerCase().includes(busq.toLowerCase()) || v.usuario?.toLowerCase().includes(busq.toLowerCase());
    const okActivo = filtroActivo === 'todos' || (filtroActivo === 'activos' ? v.activo : !v.activo);
    return okBusq && okActivo;
  });

  const activos   = filtrados.filter(v =>  v.activo);
  const inactivos = filtrados.filter(v => !v.activo);

  /* ── VendedorRow ── */
  const VendedorRow = ({ v }) => (
    <div style={{
      border: '1.5px solid var(--jordyn-border)', borderRadius: 12,
      marginBottom: '0.6rem', overflow: 'hidden',
      background: v.activo ? '#fff' : 'var(--jordyn-bg2)',
      opacity: v.activo ? 1 : 0.75,
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      transition: 'box-shadow .2s'
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,191,188,0.13)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.04)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', flexWrap: 'wrap' }}>

        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: v.activo ? 'var(--jordyn-primary)' : '#ccc',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.95rem'
        }}>
          {v.nombre.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--jordyn-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {v.nombre}
            {!v.activo && <span style={{ background: '#eee', color: '#999', fontSize: '0.62rem', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>INACTIVO</span>}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
            @{v.usuario} {v.cedula && `· CC ${v.cedula}`}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={S.badge('var(--jordyn-primary)')}>
              <i className="bi bi-hash"></i>{v.numeros_count || 0} números
            </span>
            <span style={S.badge('#2ecc71')}>
              <i className="bi bi-receipt"></i>{v.total_ventas || 0} ventas
            </span>
            {v.total_ingresos > 0 && (
              <span style={S.badge('#f0a500')}>
                {fmtCOP(v.total_ingresos)}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={() => setModalNums({ vendedor: v })} title="Números globales" style={{
            background: 'rgba(10,191,188,0.1)', border: '1px solid rgba(10,191,188,0.3)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-primary)'
          }}>
            <i className="bi bi-hash"></i>
          </button>
          <button onClick={() => abrirEditar(v)} title="Editar" style={{
            background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-muted)'
          }}>
            <i className="bi bi-pencil-fill"></i>
          </button>
          <button onClick={() => setConfirmDelete({ ...v, tieneVentas: (v.total_ventas || 0) > 0 })} title="Eliminar" style={{
            background: '#fff5f5', border: '1px solid #ffcccc',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem', color: '#e63946'
          }}>
            <i className="bi bi-trash3-fill"></i>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      {/* ── Header de página ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--jordyn-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-people-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            Gestión de Vendedores
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: 0, marginTop: 2 }}>
            {vendedores.length} vendedor(es) registrados
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {/* NUEVO: botón categorías globales */}
          <button
            className="btn-jordyn-outline"
            onClick={() => setModalCats(true)}
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="bi bi-tags-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            Categorías de rifas
          </button>
          <button
            className="btn-jordyn"
            onClick={() => { setShowForm(p => !p); setEditando(null); setForm(emptyForm); }}
            style={{ fontSize: '0.82rem' }}
          >
            <i className={`bi bi-${showForm && !editando ? 'dash' : 'plus'}-lg me-1`}></i>
            {showForm && !editando ? 'Cancelar' : 'Nuevo vendedor'}
          </button>
        </div>
      </div>

      {/* ── Formulario nuevo/editar ── */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-3 fade-in" style={{ padding: '1.1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--jordyn-primary)', marginBottom: '0.8rem' }}>
            {editando ? '✏️ Editar vendedor' : '➕ Nuevo vendedor'}
          </div>
          <form onSubmit={guardar}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label className="jd-label">NOMBRE COMPLETO *</label>
                <input className="jd-input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Juan Pérez" autoFocus required />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label className="jd-label">CÉDULA</label>
                <input className="jd-input" value={form.cedula || ''}
                  onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))}
                  placeholder="123456789" />
              </div>
              {editando && (
                <div style={{ flex: '1 1 120px' }}>
                  <label className="jd-label">NUEVA CONTRASEÑA</label>
                  <input className="jd-input" type="password" value={form.password || ''}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Dejar vacío = sin cambios" />
                </div>
              )}
            </div>
            {!editando && (
              <div className="jd-alert jd-alert-info" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                <i className="bi bi-info-circle-fill me-1"></i>
                Las credenciales de acceso se generarán automáticamente desde el nombre.
              </div>
            )}
            <div className="d-flex gap-2">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving ? 'Guardando...' : <><i className="bi bi-floppy-fill me-1"></i>{editando ? 'Actualizar' : 'Crear vendedor'}</>}
              </button>
              <button type="button" className="btn-jordyn-outline" onClick={() => { setShowForm(false); setEditando(null); setForm(emptyForm); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Credenciales generadas ── */}
      {creds && (
        <div style={{
          background: 'linear-gradient(135deg,#0a3d62,#0abfbc)', borderRadius: 12,
          padding: '1rem 1.2rem', marginBottom: '1rem', color: '#fff'
        }}>
          <div style={{ fontWeight: 800, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>✅ Vendedor creado: {creds.nombre}</span>
            <button onClick={() => setCreds(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
            <span>👤 Usuario: <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{creds.usuario}</strong></span>
            <span>🔑 Contraseña: <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{creds.password}</strong></span>
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: 6 }}>⚠️ Copia estas credenciales antes de cerrar. No se volverán a mostrar.</div>
        </div>
      )}

      {/* ── Búsqueda y filtros ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="jd-input" style={{ flex: '1 1 200px' }}
          value={busq} onChange={e => setBusq(e.target.value)}
          placeholder="🔍 Buscar por nombre o usuario..." />
        <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)' }}>
          {[['todos','Todos'],['activos','Activos'],['inactivos','Inactivos']].map(([k,l]) => (
            <button key={k} onClick={() => setFiltroActivo(k)} style={S.pill(filtroActivo===k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4 }}>
          {filtrados.length === 0 && (
            <div className="jd-alert jd-alert-warning">
              <i className="bi bi-exclamation-triangle-fill"></i>{' '}
              {vendedores.length === 0 ? 'Sin vendedores registrados' : 'Sin resultados para la búsqueda'}
            </div>
          )}
          {activos.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--jordyn-green)', display: 'inline-block' }}></span>
                Activos ({activos.length})
              </div>
              {activos.map(v => <VendedorRow key={v.id} v={v} />)}
            </div>
          )}
          {inactivos.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc', display: 'inline-block' }}></span>
                Inactivos ({inactivos.length})
              </div>
              {inactivos.map(v => <VendedorRow key={v.id} v={v} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Panel Categorías Globales ── */}
      {modalCats && (
        <PanelCategorias
          todosVendedores={vendedores.filter(v => v.activo)}
          onClose={() => setModalCats(false)}
        />
      )}

      {/* ── Modal números globales del vendedor ── */}
      {modalNums && (
        <ModalNumerosVendedor
          vendedor={modalNums.vendedor}
          numerosOcupados={getNumerosOcupadosPorOtros(modalNums.vendedor.id)}
          onClose={() => setModalNums(null)}
          onSaved={load}
        />
      )}

      {/* ── Modal confirm delete ── */}
      {confirmDelete && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelete(null)} style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(440)}>
            <div style={S.header(confirmDelete.tieneVentas ? 'linear-gradient(135deg,#b37700,#f0a500)' : 'linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  {confirmDelete.tieneVentas ? '⚠️' : '🗑️'}
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>{confirmDelete.tieneVentas ? 'Vendedor con ventas' : 'Eliminar vendedor'}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{confirmDelete.nombre}</div>
                </div>
              </div>
              <button onClick={() => setConfirmDelete(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div style={S.body}>
              {confirmDelete.tieneVentas ? (
                <>
                  <div style={{ background: '#fff8e1', border: '1.5px solid #ffd166', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#7a5c00', lineHeight: 1.6 }}>
                    <strong>No es posible eliminar</strong> este vendedor porque tiene <strong>{confirmDelete.total_ventas || 0} venta(s)</strong> registradas.
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Puedes <strong>desactivarlo</strong> para que no pueda iniciar sesión ni vender, pero su historial se conserva.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn w-100" onClick={confirmarDesactivar} style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}>
                      <i className="bi bi-pause-circle me-1"></i>Desactivar vendedor
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)} style={{ fontSize: '0.88rem', flexShrink: 0, padding: '10px 16px' }}>Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.88rem', color: 'var(--jordyn-text)', marginBottom: 16, lineHeight: 1.7 }}>
                    ¿Eliminar definitivamente a <strong>"{confirmDelete.nombre}"</strong>? Sus números quedarán libres en el pool.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn-danger w-100" onClick={confirmarEliminacion} style={{ fontSize: '0.88rem' }}>
                      <i className="bi bi-trash3-fill me-1"></i>Eliminar definitivamente
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)} style={{ fontSize: '0.88rem', flexShrink: 0, padding: '10px 16px' }}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
} 