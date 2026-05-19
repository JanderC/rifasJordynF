import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import API from '../services/api';

// ─────────────────────────────────────────────
//  Sub-componentes
// ─────────────────────────────────────────────

/* ── Badge de tipo de mensaje ── */
const TipoBadge = ({ tipo }) => {
  const map = {
    text:       { label: 'Texto',         color: '#0abed4' },
    image:      { label: 'Imagen',        color: '#a855f7' },
    video:      { label: 'Video',         color: '#ef4444' },
    image_text: { label: 'Imagen+Texto',  color: '#f59e0b' },
    button:     { label: 'Botones',       color: '#22c55e' },
  };
  const { label, color } = map[tipo] || { label: tipo, color: '#6b7280' };
  return (
    <span style={{
      background: `${color}22`,
      color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: '2px 8px',
      fontSize: '0.62rem', fontWeight: 800, letterSpacing: 1,
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
};

/* ── Tabs de navegación interna ── */
const Tabs = ({ tabs, activo, onChange }) => (
  <div style={{
    display: 'flex', gap: 4,
    borderBottom: '1px solid var(--jordyn-border)',
    marginBottom: '1.5rem',
  }}>
    {tabs.map(t => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.7rem 1.1rem', fontFamily: 'inherit',
          fontSize: '0.8rem', fontWeight: 700,
          color: activo === t.key ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)',
          borderBottom: activo === t.key ? '2px solid var(--jordyn-primary)' : '2px solid transparent',
          transition: 'all .15s',
        }}
      >
        <i className={`bi ${t.icon} me-1`}></i>{t.label}
      </button>
    ))}
  </div>
);

/* ── Modal genérico ── */
const Modal = ({ title, children, onClose, size = '600px' }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1050,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      background: 'var(--jordyn-surface)',
      border: '1px solid var(--jordyn-border)',
      borderRadius: 14, padding: '1.5rem',
      width: '100%', maxWidth: size,
      maxHeight: '90vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1rem', color: 'var(--jordyn-text)' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>
      {children}
    </div>
  </div>
);

/* ── Input base ── */
const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: '1rem' }}>
    {label && <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--jordyn-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>}
    <input className="form-control-jordyn" style={{ width: '100%', boxSizing: 'border-box' }} {...props} />
  </div>
);

const Textarea = ({ label, rows = 4, ...props }) => (
  <div style={{ marginBottom: '1rem' }}>
    {label && <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--jordyn-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>}
    <textarea className="form-control-jordyn" rows={rows} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} {...props} />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div style={{ marginBottom: '1rem' }}>
    {label && <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--jordyn-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>}
    <select className="form-control-jordyn" style={{ width: '100%', boxSizing: 'border-box' }} {...props}>{children}</select>
  </div>
);

// ─────────────────────────────────────────────
//  TAB 1 — Configuración de credenciales Meta
// ─────────────────────────────────────────────
function TabConfigCredenciales() {
  const [config, setConfig]     = useState(null);
  const [form, setForm]         = useState({ nombre: '', phone_number_id: '', waba_id: '', access_token: '', verify_token: '', webhook_url: '' });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    API.get('/whatsapp/config').then(r => {
      setConfig(r.data);
      if (r.data) {
        setForm({ ...r.data, access_token: '', verify_token: r.data.verify_token });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.phone_number_id || !form.waba_id || !form.access_token || !form.verify_token) {
      return toast.error('Completa todos los campos obligatorios');
    }
    setSaving(true);
    try {
      await API.post('/whatsapp/config', form);
      toast.success('✅ Credenciales guardadas correctamente');
      setEditMode(false);
      const r = await API.get('/whatsapp/config');
      setConfig(r.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await API.post('/whatsapp/config/test');
      setTestResult(r.data);
      if (r.data.ok) toast.success(`✅ Conexión OK — ${r.data.telefono}`);
      else toast.error(`❌ Error: ${r.data.error}`);
    } catch {
      toast.error('No se pudo probar la conexión');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--jordyn-muted)', padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

  return (
    <div>
      {/* Info panel */}
      <div style={{
        background: 'rgba(10,191,188,0.07)',
        border: '1px solid rgba(10,191,188,0.2)',
        borderRadius: 12, padding: '1rem 1.2rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--jordyn-primary)', marginBottom: 6 }}>
          <i className="bi bi-info-circle me-2"></i>¿Cómo configurar?
        </div>
        <ol style={{ margin: 0, padding: '0 0 0 1.2rem', fontSize: '0.78rem', color: 'var(--jordyn-muted)', lineHeight: 1.8 }}>
          <li>Ve a <strong>Meta for Developers</strong> → Tu App → WhatsApp → Configuración de la API</li>
          <li>Copia el <strong>Phone Number ID</strong> y el <strong>WhatsApp Business Account ID</strong></li>
          <li>Genera un <strong>Token de acceso permanente</strong> en el panel de seguridad</li>
          <li>En <strong>Webhook</strong>, usa la URL: <code style={{ color: 'var(--jordyn-primary)' }}>{form.webhook_url || 'https://tu-backend.com/api/whatsapp/webhook'}</code></li>
          <li>Como <strong>Verify Token</strong> usa cualquier texto secreto (el mismo que pongas aquí)</li>
          <li>Suscríbete al campo <code style={{ color: 'var(--jordyn-primary)' }}>messages</code></li>
        </ol>
      </div>

      {config && !editMode ? (
        /* Vista de config actual */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {[
              { label: 'Nombre', value: config.nombre },
              { label: 'Phone Number ID', value: config.phone_number_id },
              { label: 'WABA ID', value: config.waba_id },
              { label: 'Access Token', value: config.access_token_preview },
              { label: 'Verify Token', value: config.verify_token },
              { label: 'Webhook URL', value: config.webhook_url || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--jordyn-bg)', borderRadius: 8, padding: '0.7rem 1rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--jordyn-text)', wordBreak: 'break-all' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-jordyn" onClick={() => setEditMode(true)}>
              <i className="bi bi-pencil me-1"></i>Editar credenciales
            </button>
            <button className="btn-jordyn-outline" onClick={handleTest} disabled={testing}>
              {testing ? <><span className="jd-spinner-sm me-1"></span>Probando...</> : <><i className="bi bi-wifi me-1"></i>Probar conexión</>}
            </button>
          </div>
          {testResult && (
            <div style={{
              marginTop: '1rem', padding: '0.8rem 1rem', borderRadius: 8,
              background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${testResult.ok ? '#22c55e44' : '#ef444444'}`,
              fontSize: '0.82rem', color: testResult.ok ? '#22c55e' : '#ef4444',
            }}>
              {testResult.ok
                ? `✅ Conectado — ${testResult.nombre} (${testResult.telefono})`
                : `❌ Error: ${testResult.error}`}
            </div>
          )}
        </div>
      ) : (
        /* Formulario */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Input label="Nombre de la configuración" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Principal" />
            <Input label="Phone Number ID *" value={form.phone_number_id} onChange={e => setForm({ ...form, phone_number_id: e.target.value })} placeholder="123456789012345" />
            <Input label="WhatsApp Business Account ID *" value={form.waba_id} onChange={e => setForm({ ...form, waba_id: e.target.value })} placeholder="123456789012345" />
            <Input label="Verify Token *" value={form.verify_token} onChange={e => setForm({ ...form, verify_token: e.target.value })} placeholder="mi_token_secreto_2024" />
          </div>
          <Input label="Access Token (token permanente de Meta) *" value={form.access_token} onChange={e => setForm({ ...form, access_token: e.target.value })} placeholder="EAABsbCS..." type="password" />
          <Input label="Webhook URL (tu URL pública)" value={form.webhook_url} onChange={e => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://tu-backend.com/api/whatsapp/webhook" />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : <><i className="bi bi-check-lg me-1"></i>Guardar credenciales</>}
            </button>
            {config && <button className="btn-jordyn-outline" onClick={() => setEditMode(false)}>Cancelar</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB 2 — Biblioteca de Medios
// ─────────────────────────────────────────────
function TabMediaLibrary({ onSelectMedia }) {
  const [medias, setMedias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', url_publica: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const load = useCallback(() => {
    setLoading(true);
    API.get('/whatsapp/media').then(r => setMedias(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.nombre) return toast.error('Escribe un nombre');
    if (!file && !form.url_publica) return toast.error('Sube un archivo o ingresa una URL pública');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('nombre', form.nombre);
      if (form.url_publica) fd.append('url_publica', form.url_publica);
      if (file) fd.append('archivo', file);
      await API.post('/whatsapp/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('✅ Medio guardado');
      setShowForm(false);
      setForm({ nombre: '', url_publica: '' });
      setFile(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      await API.delete(`/whatsapp/media/${id}`);
      toast.success('Eliminado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--jordyn-muted)' }}>{medias.length} archivos en la biblioteca</div>
        <button className="btn-jordyn" onClick={() => setShowForm(true)}>
          <i className="bi bi-plus-lg me-1"></i>Agregar medio
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '2rem' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {medias.map(m => (
            <div key={m.id} style={{
              background: 'var(--jordyn-bg)',
              border: '1px solid var(--jordyn-border)',
              borderRadius: 10, overflow: 'hidden',
              cursor: onSelectMedia ? 'pointer' : 'default',
              transition: 'border-color .15s',
            }}
              onClick={() => onSelectMedia && onSelectMedia(m)}
              onMouseEnter={e => { if (onSelectMedia) e.currentTarget.style.borderColor = 'var(--jordyn-primary)'; }}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--jordyn-border)'}
            >
              {/* Preview */}
              <div style={{ height: 110, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {m.tipo === 'image' ? (
                  <img src={m.url_publica} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                ) : m.tipo === 'video' ? (
                  <i className="bi bi-play-circle-fill" style={{ fontSize: '2.5rem', color: '#ef4444' }}></i>
                ) : (
                  <i className="bi bi-file-earmark" style={{ fontSize: '2.5rem', color: 'var(--jordyn-muted)' }}></i>
                )}
              </div>
              <div style={{ padding: '0.6rem 0.8rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--jordyn-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <TipoBadge tipo={m.tipo} />
                  {!onSelectMedia && (
                    <button onClick={() => handleDelete(m.id, m.nombre)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef444488', fontSize: '0.8rem', padding: 2 }}>
                      <i className="bi bi-trash"></i>
                    </button>
                  )}
                </div>
                {m.tamanio_kb && <div style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>{m.tamanio_kb} KB</div>}
              </div>
            </div>
          ))}
          {!medias.length && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--jordyn-muted)', padding: '3rem' }}>
              <i className="bi bi-images" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
              <div style={{ marginTop: 8, fontSize: '0.85rem' }}>No hay medios aún</div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <Modal title="Agregar medio" onClose={() => setShowForm(false)}>
          <Input label="Nombre descriptivo *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: banner_rifa_julio" />
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--jordyn-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Subir archivo (imagen/video)</label>
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: '2px dashed var(--jordyn-border)',
                borderRadius: 10, padding: '1.5rem',
                textAlign: 'center', cursor: 'pointer',
                color: 'var(--jordyn-muted)', fontSize: '0.82rem',
                transition: 'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--jordyn-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--jordyn-border)'}
            >
              {file ? <><i className="bi bi-check-circle-fill me-1" style={{ color: '#22c55e' }}></i>{file.name}</> : <><i className="bi bi-cloud-upload me-2"></i>Click para seleccionar (jpg, png, webp, mp4 — máx 16MB)</>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,application/pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </div>
          <Input label="— O —  URL pública del medio" value={form.url_publica} onChange={e => setForm({ ...form, url_publica: e.target.value })} placeholder="https://cdn.ejemplo.com/imagen.jpg" />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-jordyn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn-jordyn" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando...' : <><i className="bi bi-check-lg me-1"></i>Guardar medio</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB 3 — Plantillas de mensajes
// ─────────────────────────────────────────────
function TabPlantillas() {
  const [plantillas, setPlantillas] = useState([]);
  const [medias, setMedias]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // null | 'crear' | 'editar'
  const [editObj, setEditObj]       = useState(null);
  const [saving, setSaving]         = useState(false);

  const emptyForm = { nombre: '', tipo: 'text', cuerpo: '', pie: '', media_id: '', botones: [{ id: '', titulo: '' }] };
  const [form, setForm] = useState(emptyForm);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      API.get('/whatsapp/plantillas'),
      API.get('/whatsapp/media'),
    ]).then(([p, m]) => {
      setPlantillas(p.data);
      setMedias(m.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCrear = () => { setForm(emptyForm); setModal('crear'); setEditObj(null); };
  const openEditar = (p) => {
    setForm({
      nombre:   p.nombre,
      tipo:     p.tipo,
      cuerpo:   p.cuerpo || '',
      pie:      p.pie || '',
      media_id: p.media_id || '',
      botones:  typeof p.botones === 'string' ? JSON.parse(p.botones) : (p.botones || []),
    });
    setEditObj(p);
    setModal('editar');
  };

  const handleSave = async () => {
    if (!form.nombre || !form.tipo) return toast.error('Nombre y tipo son requeridos');
    const botonesFiltrados = form.botones.filter(b => b.id && b.titulo);
    setSaving(true);
    try {
      const body = { ...form, botones: JSON.stringify(botonesFiltrados), media_id: form.media_id || null };
      if (modal === 'crear') await API.post('/whatsapp/plantillas', body);
      else await API.put(`/whatsapp/plantillas/${editObj.id}`, body);
      toast.success(modal === 'crear' ? '✅ Plantilla creada' : '✅ Plantilla actualizada');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    try {
      await API.delete(`/whatsapp/plantillas/${p.id}`);
      toast.success('Eliminada');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const addBoton = () => {
    if (form.botones.length >= 3) return toast.warn('Máximo 3 botones');
    setForm(f => ({ ...f, botones: [...f.botones, { id: '', titulo: '' }] }));
  };
  const removeBoton = (i) => setForm(f => ({ ...f, botones: f.botones.filter((_, idx) => idx !== i) }));
  const updateBoton = (i, key, val) => setForm(f => {
    const arr = [...f.botones];
    arr[i] = { ...arr[i], [key]: val };
    return { ...f, botones: arr };
  });

  const needsMedia = ['image', 'video', 'image_text'].includes(form.tipo);
  const needsBotones = form.tipo === 'button';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-jordyn" onClick={openCrear}><i className="bi bi-plus-lg me-1"></i>Nueva plantilla</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '2rem' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {plantillas.map(p => (
            <div key={p.id} style={{
              background: 'var(--jordyn-bg)',
              border: '1px solid var(--jordyn-border)',
              borderRadius: 10, padding: '0.9rem 1.1rem',
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
            }}>
              {p.media_url && (
                <img src={p.media_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  onError={e => e.target.style.display = 'none'} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--jordyn-text)' }}>{p.nombre}</span>
                  <TipoBadge tipo={p.tipo} />
                  {!p.activa && <span style={{ background: '#ef444422', color: '#ef4444', borderRadius: 4, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 700 }}>INACTIVA</span>}
                </div>
                {p.cuerpo && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--jordyn-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.cuerpo.substring(0, 120)}
                  </div>
                )}
                {(() => {
                  const bots = typeof p.botones === 'string' ? JSON.parse(p.botones) : (p.botones || []);
                  return bots.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {bots.map(b => (
                        <span key={b.id} style={{ background: 'rgba(10,191,188,0.1)', color: 'var(--jordyn-primary)', borderRadius: 5, padding: '1px 7px', fontSize: '0.65rem', fontWeight: 700 }}>
                          {b.titulo}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn-jordyn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => openEditar(p)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button onClick={() => handleDelete(p)} style={{ background: 'none', border: '1px solid #ef444433', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem' }}>
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          ))}
          {!plantillas.length && (
            <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '3rem' }}>
              <i className="bi bi-chat-square-dots" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
              <div style={{ marginTop: 8, fontSize: '0.85rem' }}>No hay plantillas aún</div>
            </div>
          )}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <Modal title={modal === 'crear' ? 'Nueva plantilla' : `Editar: ${editObj?.nombre}`} onClose={() => setModal(null)} size="680px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Input label="Nombre interno *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="bienvenida" />
            <Select label="Tipo de mensaje *" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, media_id: '', botones: [{ id: '', titulo: '' }] })}>
              <option value="text">📝 Texto</option>
              <option value="image">🖼️ Imagen</option>
              <option value="video">🎬 Video</option>
              <option value="image_text">🖼️📝 Imagen + Texto</option>
              <option value="button">🔘 Botones</option>
            </Select>
          </div>

          {needsMedia && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--jordyn-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Medio (imagen/video) *</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'var(--jordyn-bg)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '0.5rem 0.8rem', fontSize: '0.8rem', color: form.media_id ? 'var(--jordyn-text)' : 'var(--jordyn-muted)' }}>
                  {form.media_id ? (medias.find(m => m.id == form.media_id)?.nombre || `ID: ${form.media_id}`) : 'Ningún medio seleccionado'}
                </div>
                <button className="btn-jordyn-outline" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setShowMediaPicker(true)}>
                  <i className="bi bi-images me-1"></i>Elegir
                </button>
                {form.media_id && <button onClick={() => setForm(f => ({ ...f, media_id: '' }))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>}
              </div>
            </div>
          )}

          <Textarea label="Cuerpo del mensaje" value={form.cuerpo} onChange={e => setForm({ ...form, cuerpo: e.target.value })}
            placeholder="Usa {{nombre_cliente}}, {{numero}}, {{rifa_nombre}}, {{precio}}, {{premio}}, {{fecha_sorteo}}, {{rifas_lista}}" rows={5} />

          <Input label="Pie de mensaje (footer opcional)" value={form.pie} onChange={e => setForm({ ...form, pie: e.target.value })} placeholder="Escribe MENU para volver al inicio" />

          {needsBotones && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Botones (máx. 3)</label>
                <button className="btn-jordyn-outline" style={{ fontSize: '0.72rem', padding: '3px 9px' }} onClick={addBoton}>+ Botón</button>
              </div>
              {form.botones.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input className="form-control-jordyn" style={{ flex: 1 }} placeholder="ID único (ej: btn_ver_rifas)" value={b.id} onChange={e => updateBoton(i, 'id', e.target.value)} />
                  <input className="form-control-jordyn" style={{ flex: 2 }} placeholder="Texto del botón (máx 20 chars)" maxLength={20} value={b.titulo} onChange={e => updateBoton(i, 'titulo', e.target.value)} />
                  <button onClick={() => removeBoton(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}><i className="bi bi-x-circle"></i></button>
                </div>
              ))}
            </div>
          )}

          <div style={{
            background: 'rgba(10,191,188,0.06)', border: '1px solid rgba(10,191,188,0.15)',
            borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1rem',
            fontSize: '0.72rem', color: 'var(--jordyn-muted)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--jordyn-primary)' }}>Variables disponibles:</strong>{' '}
            <code>{'{{nombre_cliente}}'}</code> <code>{'{{numero}}'}</code> <code>{'{{rifa_nombre}}'}</code>{' '}
            <code>{'{{precio}}'}</code> <code>{'{{premio}}'}</code> <code>{'{{fecha_sorteo}}'}</code>{' '}
            <code>{'{{rifas_lista}}'}</code>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-jordyn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : <><i className="bi bi-check-lg me-1"></i>Guardar plantilla</>}
            </button>
          </div>
        </Modal>
      )}

      {showMediaPicker && (
        <Modal title="Seleccionar medio" onClose={() => setShowMediaPicker(false)} size="800px">
          <TabMediaLibrary onSelectMedia={(m) => { setForm(f => ({ ...f, media_id: m.id })); setShowMediaPicker(false); }} />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB 4 — Guión / Flujo del bot
// ─────────────────────────────────────────────
function TabFlujo() {
  const [nodos, setNodos]           = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [editObj, setEditObj]       = useState(null);
  const [saving, setSaving]         = useState(false);

  const emptyForm = { nombre: '', descripcion: '', es_inicio: false, plantilla_id: '', accion: '', orden: 0, activo: true };
  const [form, setForm] = useState(emptyForm);

  // Transición modal
  const [transModal, setTransModal] = useState(null); // { nodoId }
  const [transForm, setTransForm]   = useState({ nodo_origen_id: '', nodo_destino_id: '', trigger_texto: '', trigger_payload: '', orden: 0 });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([API.get('/whatsapp/flujo'), API.get('/whatsapp/plantillas')]).then(([f, p]) => {
      setNodos(f.data);
      setPlantillas(p.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCrear = () => { setForm(emptyForm); setModal('crear'); setEditObj(null); };
  const openEditar = (n) => {
    setForm({ nombre: n.nombre, descripcion: n.descripcion || '', es_inicio: n.es_inicio, plantilla_id: n.plantilla_id || '', accion: n.accion || '', orden: n.orden, activo: n.activo });
    setEditObj(n); setModal('editar');
  };

  const handleSave = async () => {
    if (!form.nombre) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      const body = { ...form, plantilla_id: form.plantilla_id || null, accion: form.accion || null };
      if (modal === 'crear') await API.post('/whatsapp/flujo/nodos', body);
      else await API.put(`/whatsapp/flujo/nodos/${editObj.id}`, body);
      toast.success(modal === 'crear' ? '✅ Nodo creado' : '✅ Nodo actualizado');
      setModal(null); load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally { setSaving(false); }
  };

  const handleDeleteNodo = async (n) => {
    if (!window.confirm(`¿Eliminar nodo "${n.nombre}"?`)) return;
    try {
      await API.delete(`/whatsapp/flujo/nodos/${n.id}`);
      toast.success('Nodo eliminado'); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleAddTrans = async () => {
    try {
      await API.post('/whatsapp/flujo/transiciones', transForm);
      toast.success('✅ Transición creada'); setTransModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleDeleteTrans = async (id) => {
    try {
      await API.delete(`/whatsapp/flujo/transiciones/${id}`);
      toast.success('Transición eliminada'); load();
    } catch { toast.error('Error al eliminar'); }
  };

  const accionOptions = [
    { value: '', label: '— Sin acción especial —' },
    { value: 'mostrar_rifas',    label: '🏆 Mostrar rifas activas' },
    { value: 'consultar_numero', label: '🔢 Consultar número de boleto' },
    { value: 'capturar_nombre',  label: '👤 Capturar nombre del cliente' },
    { value: 'capturar_cedula',  label: '🪪 Capturar cédula / documento' },
    { value: 'confirmar_reserva',label: '✅ Crear reserva automática' },
    { value: 'finalizar',        label: '👋 Finalizar conversación' },
  ];

  return (
    <div>
      <div style={{
        background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1.2rem',
        fontSize: '0.78rem', color: '#92400e',
      }}>
        <i className="bi bi-diagram-3 me-2"></i>
        <strong>Cómo funciona el guión:</strong> Cada nodo es un paso del bot. Las <em>transiciones</em> definen qué respuesta del usuario lleva a qué siguiente nodo. El nodo marcado como <strong>Inicio</strong> se envía al primer mensaje del cliente.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-jordyn" onClick={openCrear}><i className="bi bi-plus-lg me-1"></i>Nuevo nodo</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '2rem' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {nodos.map(n => (
            <div key={n.id} style={{
              background: 'var(--jordyn-bg)', border: `1px solid ${n.es_inicio ? 'rgba(10,191,188,0.4)' : 'var(--jordyn-border)'}`,
              borderRadius: 12, padding: '1rem 1.2rem',
              boxShadow: n.es_inicio ? '0 0 0 2px rgba(10,191,188,0.1)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {n.es_inicio && <span style={{ background: 'var(--jordyn-primary)', color: '#000', borderRadius: 5, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 800 }}>INICIO</span>}
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--jordyn-text)' }}>{n.nombre}</span>
                    {n.accion && (
                      <span style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 5, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 700 }}>
                        {accionOptions.find(a => a.value === n.accion)?.label || n.accion}
                      </span>
                    )}
                    {!n.activo && <span style={{ background: '#ef444422', color: '#ef4444', borderRadius: 5, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 700 }}>INACTIVO</span>}
                  </div>
                  {n.descripcion && <div style={{ fontSize: '0.77rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>{n.descripcion}</div>}
                  {n.plantilla_nombre && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--jordyn-muted)' }}>
                      <i className="bi bi-chat-square-text me-1"></i>Plantilla: <strong style={{ color: 'var(--jordyn-text)' }}>{n.plantilla_nombre}</strong>
                      {n.plantilla_tipo && <TipoBadge tipo={n.plantilla_tipo} />}
                    </div>
                  )}

                  {/* Transiciones */}
                  {n.transiciones?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        <i className="bi bi-arrow-right-circle me-1"></i>Transiciones:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {n.transiciones.map(t => (
                          <div key={t.id} style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--jordyn-border)',
                            borderRadius: 6, padding: '3px 8px', fontSize: '0.7rem',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            <span style={{ color: 'var(--jordyn-muted)' }}>
                              {t.trigger_texto ? `"${t.trigger_texto}"` : t.trigger_payload ? `[${t.trigger_payload}]` : '(cualquier respuesta)'}
                            </span>
                            <i className="bi bi-arrow-right" style={{ color: 'var(--jordyn-primary)', fontSize: '0.65rem' }}></i>
                            <span style={{ color: 'var(--jordyn-text)', fontWeight: 700 }}>{t.destino_nombre}</span>
                            <button onClick={() => handleDeleteTrans(t.id)} style={{ background: 'none', border: 'none', color: '#ef444488', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>
                              <i className="bi bi-x"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: '1rem' }}>
                  <button className="btn-jordyn-outline" style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                    onClick={() => { setTransForm({ nodo_origen_id: n.id, nodo_destino_id: '', trigger_texto: '', trigger_payload: '', orden: 0 }); setTransModal({ nodoId: n.id, nodoNombre: n.nombre }); }}>
                    <i className="bi bi-arrow-right-circle me-1"></i>Transición
                  </button>
                  <button className="btn-jordyn-outline" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => openEditar(n)}>
                    <i className="bi bi-pencil"></i>
                  </button>
                  {!n.es_inicio && (
                    <button onClick={() => handleDeleteNodo(n)} style={{ background: 'none', border: '1px solid #ef444433', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.72rem' }}>
                      <i className="bi bi-trash"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nodo */}
      {modal && (
        <Modal title={modal === 'crear' ? 'Nuevo nodo' : `Editar: ${editObj?.nombre}`} onClose={() => setModal(null)}>
          <Input label="Nombre del nodo *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <Textarea label="Descripción (interna)" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} />
          <Select label="Plantilla de mensaje" value={form.plantilla_id} onChange={e => setForm({ ...form, plantilla_id: e.target.value })}>
            <option value="">— Sin plantilla —</option>
            {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
          </Select>
          <Select label="Acción especial del bot" value={form.accion} onChange={e => setForm({ ...form, accion: e.target.value })}>
            {accionOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Input label="Orden" type="number" value={form.orden} onChange={e => setForm({ ...form, orden: parseInt(e.target.value) || 0 })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '1.4rem' }}>
              <input type="checkbox" id="esInicio" checked={form.es_inicio} onChange={e => setForm({ ...form, es_inicio: e.target.checked })} />
              <label htmlFor="esInicio" style={{ fontSize: '0.8rem', color: 'var(--jordyn-text)', cursor: 'pointer' }}>Nodo de inicio (primer mensaje)</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-jordyn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : <><i className="bi bi-check-lg me-1"></i>Guardar nodo</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal transición */}
      {transModal && (
        <Modal title={`Nueva transición desde: ${transModal.nodoNombre}`} onClose={() => setTransModal(null)}>
          <Select label="Nodo destino *" value={transForm.nodo_destino_id} onChange={e => setTransForm({ ...transForm, nodo_destino_id: e.target.value })}>
            <option value="">Selecciona un nodo</option>
            {nodos.filter(n => n.id !== transModal.nodoId).map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </Select>
          <Input label="Trigger por texto (ej: RESERVAR)" value={transForm.trigger_texto} onChange={e => setTransForm({ ...transForm, trigger_texto: e.target.value })} placeholder="Deja vacío para capturar cualquier respuesta" />
          <Input label="Trigger por payload de botón (ej: btn_ver_rifas)" value={transForm.trigger_payload} onChange={e => setTransForm({ ...transForm, trigger_payload: e.target.value })} />
          <div style={{ background: 'rgba(10,191,188,0.06)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--jordyn-muted)' }}>
            <strong>Nota:</strong> Si dejas vacíos ambos triggers, esta transición se activará con cualquier respuesta del usuario (transición por defecto).
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-jordyn-outline" onClick={() => setTransModal(null)}>Cancelar</button>
            <button className="btn-jordyn" onClick={handleAddTrans} disabled={!transForm.nodo_destino_id}>
              <i className="bi bi-check-lg me-1"></i>Crear transición
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB 5 — Conversaciones / Logs
// ─────────────────────────────────────────────
function TabConversaciones() {
  const [sesiones, setSesiones] = useState([]);
  const [logs, setLogs]         = useState([]);
  const [selectedNum, setSelectedNum] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    API.get('/whatsapp/flujo/sesiones').then(r => setSesiones(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadLogs = (numero) => {
    setSelectedNum(numero);
    API.get(`/whatsapp/flujo/logs?numero=${encodeURIComponent(numero)}`).then(r => setLogs(r.data)).catch(() => {});
  };

  const estadoColor = { activo: '#22c55e', completado: '#0abed4', expirado: '#6b7280', cancelado: '#ef4444' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedNum ? '280px 1fr' : '1fr', gap: '1rem', height: '60vh' }}>
      {/* Lista de sesiones */}
      <div style={{ overflowY: 'auto', borderRight: selectedNum ? '1px solid var(--jordyn-border)' : 'none', paddingRight: selectedNum ? '1rem' : 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '2rem' }}>Cargando...</div>
        ) : !sesiones.length ? (
          <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '3rem' }}>
            <i className="bi bi-chat-dots" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
            <div style={{ marginTop: 8, fontSize: '0.85rem' }}>Sin conversaciones aún</div>
          </div>
        ) : sesiones.map(s => (
          <div key={s.id}
            onClick={() => loadLogs(s.wa_numero)}
            style={{
              padding: '0.8rem', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
              background: selectedNum === s.wa_numero ? 'rgba(10,191,188,0.08)' : 'var(--jordyn-bg)',
              border: `1px solid ${selectedNum === s.wa_numero ? 'rgba(10,191,188,0.3)' : 'var(--jordyn-border)'}`,
              transition: 'all .15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--jordyn-text)' }}>{s.wa_numero}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: estadoColor[s.estado] || '#6b7280' }}></span>
            </div>
            {s.nombre_cliente && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>{s.nombre_cliente}</div>}
            {s.nodo_nombre && <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-primary)' }}>📍 {s.nodo_nombre}</div>}
            <div style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
              {new Date(s.ultimo_mensaje).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        ))}
      </div>

      {/* Chat log */}
      {selectedNum && (
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--jordyn-text)', paddingBottom: 8, borderBottom: '1px solid var(--jordyn-border)', marginBottom: 4 }}>
            <i className="bi bi-whatsapp me-2" style={{ color: '#25D366' }}></i>{selectedNum}
          </div>
          {logs.map(l => (
            <div key={l.id} style={{
              display: 'flex', justifyContent: l.direccion === 'saliente' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '70%', padding: '0.6rem 0.9rem', borderRadius: 10,
                background: l.direccion === 'saliente' ? 'rgba(10,191,188,0.15)' : 'var(--jordyn-bg)',
                border: `1px solid ${l.direccion === 'saliente' ? 'rgba(10,191,188,0.25)' : 'var(--jordyn-border)'}`,
                fontSize: '0.78rem', color: 'var(--jordyn-text)',
              }}>
                {l.contenido}
                <div style={{ fontSize: '0.6rem', color: 'var(--jordyn-muted)', marginTop: 2, textAlign: 'right' }}>
                  {new Date(l.created_at).toLocaleTimeString('es-VE', { timeStyle: 'short' })}
                  {l.direccion === 'saliente' && <i className={`bi bi-check${l.estado_envio === 'leido' ? '2-all' : l.estado_envio === 'entregado' ? '2' : ''} ms-1`}></i>}
                </div>
              </div>
            </div>
          ))}
          {!logs.length && <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '2rem', fontSize: '0.82rem' }}>Sin mensajes registrados</div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  PÁGINA PRINCIPAL — WhatsApp
// ─────────────────────────────────────────────
export default function WhatsApp() {
  const [tab, setTab] = useState('config');

  const tabs = [
    { key: 'config',          label: 'Credenciales',  icon: 'bi-key-fill' },
    { key: 'media',           label: 'Medios',         icon: 'bi-images' },
    { key: 'plantillas',      label: 'Plantillas',     icon: 'bi-chat-square-text-fill' },
    { key: 'flujo',           label: 'Guión / Flujo',  icon: 'bi-diagram-3-fill' },
    { key: 'conversaciones',  label: 'Conversaciones', icon: 'bi-whatsapp' },
  ];

  return (
    <div className="jd-main-content">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: '#25D36622', border: '1.5px solid #25D36644',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="bi bi-whatsapp" style={{ fontSize: '1.3rem', color: '#25D366' }}></i>
          </div>
          <div>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: 'var(--jordyn-text)' }}>
              WhatsApp Business
            </h2>
            <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>
              Bot automático · Guión configurable · API de Meta
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activo={tab} onChange={setTab} />

      {/* Contenido */}
      <div>
        {tab === 'config'         && <TabConfigCredenciales />}
        {tab === 'media'          && <TabMediaLibrary />}
        {tab === 'plantillas'     && <TabPlantillas />}
        {tab === 'flujo'          && <TabFlujo />}
        {tab === 'conversaciones' && <TabConversaciones />}
      </div>
    </div>
  );
}
