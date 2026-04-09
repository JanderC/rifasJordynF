// GestionVendedores.js -- RIFAS JORDYN (v3 final)
// Vendedores con CRUD completo dentro de cada categoria.
// Sin panel global. Todo se gestiona adentro de cada categoria.
import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const pad3  = (n) => String(n).padStart(3, '0');
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
    background: bg, color: '#fff', padding: '1rem 1.5rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
  }),
  body: { flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' },
  badge: (color = 'var(--jordyn-primary)') => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: `${color}18`, border: `1.5px solid ${color}40`,
    color, borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700,
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
  // boton pequeno reutilizable: btnSm(fondo, color texto, color borde)
  btnSm: (bg, color, border) => ({
    background: bg, border: `1px solid ${border}`, borderRadius: 8,
    padding: '5px 9px', cursor: 'pointer', fontSize: '0.74rem',
    color, display: 'flex', alignItems: 'center', gap: 4,
  }),
};

/* ---------------------------------------------------------------
   MODAL CREAR / EDITAR CATEGORIA
--------------------------------------------------------------- */
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
      esEditar
        ? await API.put(`/categorias-globales/${categoria.id}`, form)
        : await API.post('/categorias-globales', form);
      toast.success(esEditar ? 'Categoria actualizada' : 'Categoria creada');
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
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>{esEditar ? 'Editar Categoria' : 'Nueva Categoria'}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {esEditar ? categoria.nombre : 'Parcial o Simultanea con Series A y B'}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">NOMBRE *</label>
            <input className="jd-input" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Premio $1000, VIP..." autoFocus />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">MONTO / REFERENCIA</label>
            <input className="jd-input" value={form.monto}
              onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
              placeholder="Ej: $1,000" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">TIPO *</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {[
                { key: 'parcial',    icon: 'bi-bullseye',       label: 'Parcial',    accent: '#4361ee', desc: 'Serie unica 000-999. Un numero por vendedor.' },
                { key: 'simultanea', icon: 'bi-lightning-fill', label: 'Simultanea', accent: '#e91e8c', desc: 'Series A y B (000-999). Un numero puede tenerlo max. 2 vendedores.' },
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
                  <i className={`bi ${icon}`} style={{ fontSize: '1.3rem', color: form.tipo === key ? accent : 'var(--jordyn-muted)', display: 'block', marginBottom: 6 }}></i>
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
            <label className="jd-label">NOTAS</label>
            <textarea className="jd-input" rows={2} value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Notas adicionales..." style={{ resize: 'none' }} />
          </div>
          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>
              {saving
                ? <><span className="jd-spinner" style={{ width: 16, height: 16 }}></span> Guardando...</>
                : <><i className="bi bi-floppy-fill me-1"></i>{esEditar ? 'Actualizar' : 'Crear categoria'}</>
              }
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 20px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MODAL EDITAR VENDEDOR (nombre, cedula, contrasena)
   Se abre desde la card del vendedor dentro de la categoria.
--------------------------------------------------------------- */
function ModalEditarVendedor({ vendedor, onClose, onSaved }) {
  const [form,   setForm]   = useState({ nombre: vendedor.nombre || '', cedula: vendedor.cedula || '', password: '' });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (form.password && form.password.length < 6) return toast.error('La contrasena debe tener al menos 6 caracteres');
    setSaving(true);
    try {
      const payload = { nombre: form.nombre.trim(), cedula: form.cedula || null };
      if (form.password) payload.password = form.password;
      await API.put(`/vendedores/${vendedor.id}`, payload);
      toast.success('Vendedor actualizado');
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Error actualizando'); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10400 }}>
      <div style={S.modal(460)}>
        <div style={S.header('linear-gradient(135deg,#1a3a5c,#0abfbc)')}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              <i className="bi bi-pencil-fill me-2"></i>Editar vendedor
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>{vendedor.nombre}</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div>
              <label className="jd-label">NOMBRE COMPLETO *</label>
              <input className="jd-input" value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre del vendedor" autoFocus />
            </div>
            <div>
              <label className="jd-label">CEDULA</label>
              <input className="jd-input" value={form.cedula}
                onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))}
                placeholder="Opcional" />
            </div>
            <div>
              <label className="jd-label">NUEVA CONTRASENA</label>
              <input className="jd-input" type="password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Dejar vacio = sin cambios (min. 6 caracteres)" />
            </div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>
              {saving
                ? <><span className="jd-spinner" style={{ width: 15, height: 15 }}></span> Guardando...</>
                : <><i className="bi bi-floppy-fill me-1"></i>Guardar cambios</>
              }
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MODAL NUMEROS DE UN VENDEDOR EN LA CATEGORIA
--------------------------------------------------------------- */
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
      } else { setNumerosPool([]); setAsignados([]); }
    } catch { toast.error('Error cargando numeros'); }
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
    if (numerosPool.length > 0) cargarPreview(); else setPreview(null);
  }, [numerosPool.length, cargarPreview]);

  const agregarAlPool = async (nums) => {
    const validos = nums.filter(n => NUM_RE.test(n));
    if (!validos.length) return toast.error('Sin numeros validos (000-999)');
    setSaving(true);
    try {
      const res = await API.post(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`, { numeros: validos });
      toast.success(res.data.message);
      if (res.data.ya_existian?.length) toast.info(`Ya existian: ${res.data.ya_existian.slice(0, 5).join(', ')}`);
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const quitarDelPool = async (numero) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`, { data: { numeros: [numero] } });
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error quitando'); }
  };

  const liberarSerie = async (asignacion_id) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/asignaciones/${asignacion_id}`);
      toast.info('Serie liberada. El numero sigue en el pool.');
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const asignarNumeros = async () => {
    setAsignando(true);
    try {
      const res = await API.post(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/asignar`);
      const { message, info_adicional, colisiones } = res.data;
      colisiones?.length > 0 ? toast.warning(message) : toast.success(message);
      info_adicional?.forEach(i => toast.info(i.mensaje, { autoClose: 6000 }));
      await cargar(); onSaved && onSaved();
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.error || 'Error asignando');
      d?.colisiones?.forEach(c => toast.warning(`Conflicto ${c.numero}: ${c.dueno_b ? `A:${c.dueno_a}/B:${c.dueno_b}` : `ocupado por ${c.dueno_a}`}`, { autoClose: 8000 }));
    } finally { setAsignando(false); }
  };

  const agregarManual = () => {
    const num = pad3(parseInt(numInput) || 0);
    if (!NUM_RE.test(num)) { toast.error('Numero invalido (000-999)'); return; }
    agregarAlPool([num]); setNumInput('');
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) { toast.error('Rango invalido'); return; }
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
            <div style={{ fontWeight: 800, fontSize: '1rem' }}><i className="bi bi-hash me-1"></i>{vendedor.nombre}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {categoria.nombre} - {numerosPool.length} en pool - {asignados.length} asignados - {sinAsignar.length} pendientes
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultanea:</strong> Agrega numeros al pool y luego "Asignar series". Se intentara Serie A; si esta ocupada, pasara a Serie B.</>
              : <><strong>Parcial:</strong> Agrega numeros al pool y luego "Asignar series". Solo un vendedor por numero.</>
            }
          </div>

          {/* Barra progreso */}
          <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', border: '1px solid var(--jordyn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 600, marginBottom: 5 }}>
              <span>POOL EN ESTA CATEGORIA</span>
              <span>{numerosPool.length} definidos - {asignados.length} con serie - {sinAsignar.length} pendientes</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 8, background: `linear-gradient(90deg,${accent},${accent}88)`, width: `${(numerosPool.length / 1000) * 100}%`, transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)', marginBottom: '0.85rem' }}>
            {[['manual', 'Manual'], ['rango', 'Rango']].map(([k, l], i) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                background: tab === k ? accent : 'transparent', color: tab === k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: i === 0 ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {tab === 'manual' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input className="jd-input" value={numInput} onChange={e => setNumInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarManual()} placeholder="000-999" style={{ maxWidth: 120 }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarManual} disabled={saving} style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                <i className="bi bi-plus-lg me-1"></i>Agregar
              </button>
            </div>
          )}

          {tab === 'rango' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value)} placeholder="Desde" style={{ maxWidth: 90 }} maxLength={3} />
              <span style={{ color: 'var(--jordyn-muted)' }}>-</span>
              <input className="jd-input" value={rangoFin} onChange={e => setRangoFin(e.target.value)} placeholder="Hasta" style={{ maxWidth: 90 }} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarRango} disabled={saving} style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                <i className="bi bi-plus-lg me-1"></i>Agregar rango
              </button>
            </div>
          )}

          {loading ? (
            <div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{ width: 36, height: 36 }}></div></div>
          ) : (
            <>
              {/* Asignar series + preview */}
              {sinAsignar.length > 0 && (
                <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}30`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? '0.75rem' : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: accent }}>
                      <i className="bi bi-lightning-fill me-1"></i>{sinAsignar.length} numero(s) sin serie
                    </div>
                    <button className="btn-jordyn" onClick={asignarNumeros} disabled={asignando || loadingPrev}
                      style={{ height: 36, padding: '0 16px', fontSize: '0.8rem', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                      {asignando ? <span className="jd-spinner" style={{ width: 14, height: 14 }}></span> : <><i className="bi bi-send-fill me-1"></i>Asignar series</>}
                    </button>
                  </div>
                  {loadingPrev && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><span className="jd-spinner" style={{ width: 12, height: 12 }}></span> Calculando...</div>}
                  {preview && !loadingPrev && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {preview.libres?.filter(l => l.serie === 'A').length > 0 && (
                        <div style={{ background: '#f0fff8', border: '1.5px solid #2ecc7140', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1a7a40', marginBottom: 5 }}>
                            <i className="bi bi-check-circle-fill me-1"></i>Serie A: {preview.libres.filter(l => l.serie === 'A').length} numero(s)
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {preview.libres.filter(l => l.serie === 'A').slice(0, 30).map(l => (
                              <span key={l.numero} style={{ padding: '2px 7px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, background: '#f0f5ff', border: '1px solid #4361ee40', color: '#4361ee' }}>{l.numero}</span>
                            ))}
                            {preview.libres.filter(l => l.serie === 'A').length > 30 && <span style={{ fontSize: '0.64rem', color: '#1a7a40', alignSelf: 'center' }}>+{preview.libres.filter(l => l.serie === 'A').length - 30} mas</span>}
                          </div>
                        </div>
                      )}
                      {esSim && preview.info_adicional?.length > 0 && (
                        <div style={{ background: '#fff0f5', border: '1.5px solid #e91e8c40', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e91e8c', marginBottom: 5 }}>
                            <i className="bi bi-arrow-right-circle-fill me-1"></i>Serie A ocupada, pasan a Serie B: {preview.info_adicional.length}
                          </div>
                          {preview.info_adicional.slice(0, 5).map(i => (
                            <div key={i.numero} style={{ fontSize: '0.68rem', color: '#7b0050', marginBottom: 2 }}>- <strong>{i.numero}</strong>: A tiene <strong>{i.serie_a_dueno}</strong></div>
                          ))}
                          {preview.info_adicional.length > 5 && <div style={{ fontSize: '0.66rem', color: '#7b0050' }}>+{preview.info_adicional.length - 5} mas</div>}
                        </div>
                      )}
                      {preview.colisiones?.length > 0 && (
                        <div style={{ background: '#fff5f5', border: '1.5px solid #ffaaaa', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c0392b', marginBottom: 5 }}>
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>{esSim ? 'A y B ocupadas' : 'Conflicto'} - NO se asignaran: {preview.colisiones.length}
                          </div>
                          {preview.colisiones.slice(0, 5).map(c => (
                            <div key={c.numero} style={{ fontSize: '0.68rem', color: '#c0392b', marginBottom: 2 }}>
                              - <strong>{c.numero}</strong>: {esSim ? `A:${c.dueno_a} / B:${c.dueno_b}` : `ocupado por ${c.dueno_a}`}
                            </div>
                          ))}
                          {preview.colisiones.length > 5 && <div style={{ fontSize: '0.66rem', color: '#c0392b' }}>+{preview.colisiones.length - 5} mas</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Numeros con serie */}
              {asignados.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                    Con serie ({asignados.length}) - x libera serie, papelera quita del pool
                  </div>
                  {esSim
                    ? ['A', 'B'].map(serie => {
                        const nums = asignados.filter(a => a.serie === serie);
                        if (!nums.length) return null;
                        const color = serie === 'A' ? '#4361ee' : '#e91e8c';
                        return (
                          <div key={serie} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color, marginBottom: 4, textTransform: 'uppercase' }}>Serie {serie} ({nums.length})</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {nums.sort((a, b) => a.numero.localeCompare(b.numero)).map(n => (
                                <div key={n.numero} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: serie === 'A' ? '#f0f5ff' : '#fff0f5', border: `1.5px solid ${color}40`, color }}>{n.numero}</span>
                                  <button onClick={() => liberarSerie(n.asignacion_id)} title="Liberar serie" style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 0, fontSize: '0.8rem', fontWeight: 700 }}>x</button>
                                  <button onClick={() => quitarDelPool(n.numero)} title="Quitar del pool" style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', padding: 0, fontSize: '0.65rem' }}><i className="bi bi-trash3"></i></button>
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
                            <button onClick={() => liberarSerie(n.asignacion_id)} title="Liberar" style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 0, fontSize: '0.8rem', fontWeight: 700 }}>x</button>
                            <button onClick={() => quitarDelPool(n.numero)} title="Quitar" style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', padding: 0, fontSize: '0.65rem' }}><i className="bi bi-trash3"></i></button>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              )}

              {/* Sin serie */}
              {sinAsignar.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f0a500', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Sin serie ({sinAsignar.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sinAsignar.map(n => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: '#f9f9f9', border: '1.5px solid #ddd', color: '#999' }}>{n}</span>
                        <button onClick={() => quitarDelPool(n)} title="Quitar" style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', padding: 0, fontSize: '0.65rem' }}><i className="bi bi-trash3"></i></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {numerosPool.length === 0 && (
                <div className="jd-alert jd-alert-warning" style={{ fontSize: '0.82rem' }}>Sin numeros en el pool. Usa las opciones de arriba para agregar.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MODAL GESTIONAR CATEGORIA
   CRUD completo: crear, editar, eliminar/desactivar, quitar de cat.
--------------------------------------------------------------- */
function ModalGestionarCategoria({ categoria, onClose, onSaved }) {
  const [resumen,       setResumen]       = useState({ vendedores: [] });
  const [todosVend,     setTodosVend]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalNums,     setModalNums]     = useState(null);   // { id, nombre }
  const [modalEditar,   setModalEditar]   = useState(null);   // { id, nombre, cedula }
  const [confirmQuitar, setConfirmQuitar] = useState(null);   // quitar de cat
  const [confirmDelete, setConfirmDelete] = useState(null);   // eliminar del sistema
  const [busq,          setBusq]          = useState('');

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
      setTodosVend(vendR.data);
    } catch { toast.error('Error cargando categoria'); }
    finally { setLoading(false); }
  }, [categoria.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const idsEnCat = new Set(resumen.vendedores.map(v => String(v.vendedor_id)));
  const vendDisp = todosVend.filter(v => v.activo && !idsEnCat.has(String(v.id)));

  // --- Agregar existente ---
  const agregarExistente = () => {
    if (!vendedorSel) return toast.error('Selecciona un vendedor');
    const vend = todosVend.find(v => String(v.id) === String(vendedorSel));
    if (!vend) return;
    setModoAgregar(false); setVendedorSel('');
    setModalNums({ id: vend.id, nombre: vend.nombre });
  };

  // --- Crear nuevo ---
  const crearNuevo = async () => {
    if (!formNuevo.nombre.trim()) return toast.error('El nombre es requerido');
    setSavingVend(true);
    const nombreGuardado = formNuevo.nombre.trim();
    try {
      const cred = generarCredenciales(nombreGuardado);
      const res  = await API.post('/auth/register', { ...formNuevo, rol: 'vendedor', ...cred });
      const nuevoId = res.data?.id || res.data?.vendedor?.id;
      setCredsNuevo({ ...cred, nombre: nombreGuardado });
      setFormNuevo({ nombre: '', cedula: '' });
      setModoAgregar(false);
      await cargar();
      if (nuevoId) setModalNums({ id: nuevoId, nombre: nombreGuardado });
      toast.success('Vendedor creado');
    } catch (err) { toast.error(err.response?.data?.error || 'Error creando'); }
    finally { setSavingVend(false); }
  };

  // --- Quitar de categoria (no elimina del sistema) ---
  const quitarDeCategoria = async (vendedor_id) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor_id}`);
      toast.info('Vendedor removido de esta categoria');
      setConfirmQuitar(null);
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // --- Eliminar del sistema ---
  const eliminarDelSistema = async () => {
    try {
      await API.delete(`/vendedores/${confirmDelete.id}`);
      toast.success('Vendedor eliminado del sistema');
      setConfirmDelete(null);
      await cargar(); onSaved && onSaved();
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.toLowerCase().includes('ventas')) setConfirmDelete(p => ({ ...p, tieneVentas: true }));
      else toast.error(msg || 'Error eliminando');
    }
  };

  // --- Desactivar (tiene ventas, no se puede eliminar) ---
  const desactivarVendedor = async () => {
    try {
      await API.put(`/vendedores/${confirmDelete.id}`, { activo: false });
      toast.info('Vendedor desactivado');
      setConfirmDelete(null);
      await cargar(); onSaved && onSaved();
    } catch { toast.error('Error desactivando'); }
  };

  const vendFiltrados = resumen.vendedores.filter(v =>
    !busq || v.vendedor_nombre.toLowerCase().includes(busq.toLowerCase())
  );

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10100 }}>
      <div style={S.modal(980)}>

        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.tipoBadge(categoria.tipo)}>{esSim ? 'Simultanea' : 'Parcial'}</span>
              {categoria.nombre}
              {categoria.monto && <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>- {categoria.monto}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 4 }}>
              {resumen.vendedores.length} vendedor(es) en esta categoria
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>

          {/* Credenciales vendedor recien creado */}
          {credsNuevo && (
            <div style={{ background: 'linear-gradient(135deg,#0a3d62,#0abfbc)', borderRadius: 12, padding: '0.9rem 1.1rem', marginBottom: '1rem', color: '#fff' }}>
              <div style={{ fontWeight: 800, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Vendedor creado: {credsNuevo.nombre}</span>
                <button onClick={() => setCredsNuevo(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}><i className="bi bi-x-lg"></i></button>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                <span>Usuario: <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{credsNuevo.usuario}</strong></span>
                <span>Clave: <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{credsNuevo.password}</strong></span>
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: 5 }}>Copia las credenciales ahora. No se mostraran de nuevo.</div>
            </div>
          )}

          {/* Panel agregar vendedor */}
          <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}30`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: modoAgregar ? '0.85rem' : 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: accent }}>
                <i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor a esta categoria
              </div>
              {!modoAgregar ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setModoAgregar('existente')}
                    style={{ background: `${accent}15`, border: `1.5px solid ${accent}40`, color: accent, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                    <i className="bi bi-person-check-fill me-1"></i>Existente
                  </button>
                  <button onClick={() => setModoAgregar('nuevo')}
                    style={{ background: accent, border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                    <i className="bi bi-person-plus-fill me-1"></i>Crear nuevo
                  </button>
                </div>
              ) : (
                <button onClick={() => { setModoAgregar(false); setVendedorSel(''); setFormNuevo({ nombre: '', cedula: '' }); }}
                  style={{ background: 'none', border: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <i className="bi bi-x-lg"></i> Cancelar
                </button>
              )}
            </div>

            {modoAgregar === 'existente' && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>VENDEDOR *</label>
                  <select className="jd-input" value={vendedorSel} onChange={e => setVendedorSel(e.target.value)}>
                    <option value="">- Seleccionar -</option>
                    {vendDisp.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                  </select>
                  {vendDisp.length === 0 && <div style={{ fontSize: '0.7rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>Todos los vendedores activos ya estan en esta categoria.</div>}
                </div>
                <button className="btn-jordyn" onClick={agregarExistente} disabled={!vendedorSel}
                  style={{ height: 44, padding: '0 20px', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                  <i className="bi bi-arrow-right-circle-fill me-1"></i>Agregar y asignar numeros
                </button>
              </div>
            )}

            {modoAgregar === 'nuevo' && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>NOMBRE COMPLETO *</label>
                  <input className="jd-input" value={formNuevo.nombre}
                    onChange={e => setFormNuevo(p => ({ ...p, nombre: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && crearNuevo()} placeholder="Ej: Juan Perez" autoFocus />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <label className="jd-label" style={{ fontSize: '0.62rem' }}>CEDULA</label>
                  <input className="jd-input" value={formNuevo.cedula}
                    onChange={e => setFormNuevo(p => ({ ...p, cedula: e.target.value }))} placeholder="Opcional" />
                </div>
                <button className="btn-jordyn" onClick={crearNuevo} disabled={savingVend || !formNuevo.nombre.trim()}
                  style={{ height: 44, padding: '0 20px', background: `linear-gradient(135deg,${accent},${accent}cc)`, flexShrink: 0 }}>
                  {savingVend ? <span className="jd-spinner" style={{ width: 15, height: 15 }}></span> : <><i className="bi bi-person-plus-fill me-1"></i>Crear</>}
                </button>
              </div>
            )}
          </div>

          {/* Info tipo */}
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultanea:</strong> Serie A primero. Si el numero ya esta en A, pasa automaticamente a B. Si A y B estan ocupadas, muestra el conflicto.</>
              : <><strong>Parcial:</strong> Un numero solo puede pertenecer a un vendedor en esta categoria.</>
            }
          </div>

          {/* Buscador */}
          <div style={{ marginBottom: '0.85rem' }}>
            <input className="jd-input" value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar vendedor en esta categoria..." />
          </div>

          {/* Lista de vendedores con CRUD */}
          {loading ? (
            <div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{ width: 36, height: 36 }}></div></div>
          ) : resumen.vendedores.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <i className="bi bi-people-fill" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>
              Sin vendedores. Usa los botones de arriba para agregar el primero.
            </div>
          ) : vendFiltrados.length === 0 ? (
            <div className="jd-alert jd-alert-info" style={{ fontSize: '0.82rem' }}>Sin resultados para la busqueda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {vendFiltrados.map(vdata => {
                const sinSerie = vdata.total_numeros - vdata.total_asignados;
                return (
                  <div key={vdata.vendedor_id} style={{ border: `2px solid ${accent}25`, borderRadius: 12, overflow: 'hidden' }}>

                    {/* Cabecera con CRUD completo */}
                    <div style={{ background: 'var(--jordyn-bg2)', padding: '0.65rem 1rem', borderBottom: '1px solid var(--jordyn-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                          {vdata.vendedor_nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{vdata.vendedor_nombre}</div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--jordyn-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                            <span>{vdata.total_numeros} en pool</span>
                            {esSim && vdata.serie_a > 0 && <span style={{ color: '#4361ee' }}>A:{vdata.serie_a}</span>}
                            {esSim && vdata.serie_b > 0 && <span style={{ color: '#e91e8c' }}>B:{vdata.serie_b}</span>}
                            {!esSim && vdata.total_asignados > 0 && <span style={{ color: '#4361ee' }}>Asig:{vdata.total_asignados}</span>}
                            {sinSerie > 0 && <span style={{ color: '#f0a500' }}>Pend:{sinSerie}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Botones CRUD */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setModalNums({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })}
                          style={S.btnSm(`${accent}15`, accent, `${accent}40`)} title="Gestionar numeros">
                          <i className="bi bi-hash"></i> Numeros
                        </button>
                        <button
                          onClick={() => setModalEditar({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre, cedula: vdata.cedula || '' })}
                          style={S.btnSm('var(--jordyn-bg2)', 'var(--jordyn-muted)', 'var(--jordyn-border)')} title="Editar nombre, cedula y contrasena">
                          <i className="bi bi-pencil-fill"></i> Editar
                        </button>
                        <button
                          onClick={() => setConfirmQuitar({ vendedor_id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })}
                          style={S.btnSm('#fff8e1', '#b37700', '#ffd16640')} title="Quitar de esta categoria (no elimina al vendedor del sistema)">
                          <i className="bi bi-person-dash-fill"></i> Quitar
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })}
                          style={S.btnSm('#fff5f5', '#e63946', '#ffcccc')} title="Eliminar vendedor del sistema definitivamente">
                          <i className="bi bi-trash3-fill"></i>
                        </button>
                      </div>
                    </div>

                    {/* Numeros resumidos */}
                    <div style={{ padding: '0.65rem 1rem' }}>
                      {!vdata.numeros || vdata.numeros.length === 0 ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontStyle: 'italic' }}>Sin numeros. Haz clic en "Numeros" para agregar.</div>
                      ) : esSim ? (
                        [null, 'A', 'B'].map(serie => {
                          const nums = vdata.numeros.filter(n => n.serie === serie);
                          if (!nums.length) return null;
                          const label = serie ? `Serie ${serie}` : 'Sin serie';
                          const color = serie === 'A' ? '#4361ee' : serie === 'B' ? '#e91e8c' : '#aaa';
                          return (
                            <div key={String(serie)} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color, textTransform: 'uppercase', flexShrink: 0, paddingTop: 2 }}>{label} ({nums.length})</span>
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

      {/* Modal numeros */}
      {modalNums && (
        <ModalNumerosEnCategoria categoria={categoria} vendedor={modalNums}
          onClose={() => setModalNums(null)}
          onSaved={() => { cargar(); onSaved && onSaved(); }}
        />
      )}

      {/* Modal editar datos del vendedor */}
      {modalEditar && (
        <ModalEditarVendedor vendedor={modalEditar}
          onClose={() => setModalEditar(null)}
          onSaved={() => { setModalEditar(null); cargar(); onSaved && onSaved(); }}
        />
      )}

      {/* Confirm quitar de categoria */}
      {confirmQuitar && (
        <div onClick={e => e.target === e.currentTarget && setConfirmQuitar(null)} style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(440)}>
            <div style={S.header('linear-gradient(135deg,#b37700,#f0a500)')}>
              <div style={{ fontWeight: 800 }}>Quitar de esta categoria</div>
              <button onClick={() => setConfirmQuitar(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                Quitar a <strong>"{confirmQuitar.nombre}"</strong> de <strong>"{categoria.nombre}"</strong>.
                Se eliminan sus numeros y series en esta categoria.{' '}
                <strong>El vendedor NO se elimina del sistema</strong> y sigue en otras categorias.
              </p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn w-100" onClick={() => quitarDeCategoria(confirmQuitar.vendedor_id)}
                  style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}>
                  <i className="bi bi-person-dash-fill me-1"></i>Quitar de esta categoria
                </button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmQuitar(null)} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm eliminar del sistema */}
      {confirmDelete && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelete(null)} style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(440)}>
            <div style={S.header(confirmDelete.tieneVentas ? 'linear-gradient(135deg,#b37700,#f0a500)' : 'linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ fontWeight: 800 }}>{confirmDelete.tieneVentas ? 'Vendedor con ventas' : 'Eliminar vendedor del sistema'}</div>
              <button onClick={() => setConfirmDelete(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              {confirmDelete.tieneVentas ? (
                <>
                  <div style={{ background: '#fff8e1', border: '1.5px solid #ffd166', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#7a5c00', lineHeight: 1.6 }}>
                    <strong>No se puede eliminar</strong> porque tiene ventas registradas en el sistema.
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Puedes <strong>desactivarlo</strong> para que no pueda iniciar sesion, conservando su historial.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn w-100" onClick={desactivarVendedor}
                      style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}>
                      <i className="bi bi-pause-circle me-1"></i>Desactivar vendedor
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)} style={{ flexShrink: 0, padding: '0 16px' }}>Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                    Eliminar definitivamente a <strong>"{confirmDelete.nombre}"</strong> del sistema.
                    Se borraran todos sus datos en <strong>todas las categorias</strong>. Esta accion no se puede deshacer.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn-danger w-100" onClick={eliminarDelSistema} style={{ fontSize: '0.88rem' }}>
                      <i className="bi bi-trash3-fill me-1"></i>Eliminar definitivamente
                    </button>
                    <button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)} style={{ flexShrink: 0, padding: '0 16px' }}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   CARD DE CATEGORIA
--------------------------------------------------------------- */
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.nombre}</div>
              {cat.monto && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>{cat.monto}</div>}
              <span style={S.tipoBadge(cat.tipo)}>{esSim ? 'Simultanea' : 'Parcial'}</span>
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
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            <span style={S.badge('var(--jordyn-primary)')}><i className="bi bi-people-fill"></i>{cat.total_vendedores || 0} vendedores</span>
            <span style={S.badge('#2ecc71')}><i className="bi bi-hash"></i>{cat.total_numeros_definidos || 0} numeros</span>
            {esSim && <>
              <span style={S.badge('#4361ee')}>A:{cat.numeros_serie_a || 0}</span>
              <span style={S.badge('#e91e8c')}>B:{cat.numeros_serie_b || 0}</span>
            </>}
          </div>
          {esSim && (
            <div style={{ marginBottom: '0.8rem' }}>
              {[{ label: 'A', val: cat.numeros_serie_a || 0, color: '#4361ee' }, { label: 'B', val: cat.numeros_serie_b || 0, color: '#e91e8c' }].map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--jordyn-muted)', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color }}>Serie {label}</span><span>{val}/1000</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 4, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.min((val / 1000) * 100, 100)}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {cat.descripcion && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: '0.8rem', fontStyle: 'italic', lineHeight: 1.5 }}>{cat.descripcion}</div>}
          <button className="btn-jordyn w-100" onClick={() => setVerModal(true)} style={{ fontSize: '0.8rem', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
            <i className="bi bi-people-fill me-1"></i>
            Gestionar vendedores {cat.total_vendedores > 0 ? `(${cat.total_vendedores})` : ''}
          </button>
        </div>
      </div>
      {verModal && <ModalGestionarCategoria categoria={cat} onClose={() => setVerModal(false)} onSaved={onSaved} />}
    </>
  );
}

/* ---------------------------------------------------------------
   COMPONENTE PRINCIPAL
   Solo categorias. Sin panel global de vendedores.
--------------------------------------------------------------- */
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
    } catch { toast.error('Error cargando categorias'); }
    finally { setLoadingC(false); }
  }, []);

  useEffect(() => { cargarCategorias(); }, [cargarCategorias]);

  const eliminarCategoria = async (cat) => {
    try {
      await API.delete(`/categorias-globales/${cat.id}`);
      toast.success('Categoria eliminada');
      setConfirmDelCat(null); cargarCategorias();
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-tags-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            Categorias
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: '2px 0 0' }}>
            {categorias.length} categoria(s) - Vendedores y numeros gestionados dentro de cada categoria
          </p>
        </div>
        <button className="btn-jordyn" onClick={() => setModalCrearCat(true)} style={{ fontSize: '0.82rem' }}>
          <i className="bi bi-plus-lg me-1"></i>Nueva categoria
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)' }}>
          {[['todos', 'Todas'], ['parcial', 'Parcial'], ['simultanea', 'Simultanea']].map(([k, l]) => (
            <button key={k} onClick={() => setFiltroTipo(k)} style={S.pill(filtroTipo === k)}>{l}</button>
          ))}
        </div>
        <input className="jd-input" style={{ flex: '1 1 200px', maxWidth: 320 }}
          value={busqCat} onChange={e => setBusqCat(e.target.value)} placeholder="Buscar categoria..." />
      </div>

      {loadingC ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 44, height: 44 }}></div></div>
      ) : categoriasFiltradas.length === 0 ? (
        <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '2.5rem' }}>
          {categorias.length === 0
            ? <><i className="bi bi-tags" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, opacity: 0.4 }}></i>Sin categorias. Crea la primera con <strong>"Nueva categoria"</strong>.</>
            : 'Sin resultados para los filtros aplicados.'
          }
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {categoriasFiltradas.map(cat => (
            <CategoriaCard key={cat.id} cat={cat}
              onEdit={c => setEditCat(c)} onDelete={c => setConfirmDelCat(c)} onSaved={cargarCategorias}
            />
          ))}
        </div>
      )}

      {modalCrearCat && <ModalCrearCategoria onClose={() => setModalCrearCat(false)} onSaved={cargarCategorias} />}
      {editCat       && <ModalCrearCategoria categoria={editCat} onClose={() => setEditCat(null)} onSaved={cargarCategorias} />}

      {confirmDelCat && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelCat(null)} style={S.overlay}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#c0303a,#e63946)')}>
              <div style={{ fontWeight: 800 }}>Eliminar categoria</div>
              <button onClick={() => setConfirmDelCat(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>
                Eliminar <strong>"{confirmDelCat.nombre}"</strong>. Se eliminaran todos los vendedores y numeros de esta categoria.
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