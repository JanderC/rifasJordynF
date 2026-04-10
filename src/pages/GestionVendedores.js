// GestionVendedores.js -- RIFAS JORDYN (v4)
// ─────────────────────────────────────────────────────────────────────
// CAMBIO CLAVE v4:
//   En categorías SIMULTÁNEAS un vendedor puede agregar el mismo
//   número DOS VECES:
//     - 1ª vez → va a Serie A
//     - 2ª vez → va a Serie B
//   Si otro vendedor tiene ese número:
//     - Si tiene Serie A → el nuevo vendedor agrega 1ª vez y va a Serie B
//     - Si tiene Serie B → va a Serie A
//     - Si tienen A y B → "sin espacio"
//
//   La validación en tiempo real (/validar-numero) muestra exactamente
//   a qué serie irá el número ANTES de agregarlo.
// ─────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  btnSm: (bg, color, border) => ({
    background: bg, border: `1px solid ${border}`, borderRadius: 8,
    padding: '5px 9px', cursor: 'pointer', fontSize: '0.74rem',
    color, display: 'flex', alignItems: 'center', gap: 4,
  }),
};

/* ───────────────────────────────────────────────────────────────────
   BADGE DE SERIE — muestra el destino en tiempo real
─────────────────────────────────────────────────────────────────── */
function SerieBadge({ info, esSim }) {
  if (!info) return null;

  // Sin espacio: ambas ocupadas por otros
  if (!info.disponible || info.sin_espacio) {
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
        background: '#fff5f5', border: '1px solid #ffcccc', color: '#e63946',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <i className="bi bi-x-circle-fill" style={{ fontSize: '0.6rem' }}></i>
        {esSim ? 'A+B ocupadas' : 'ocupado'}
        {info.serie_a?.dueno && <span style={{ opacity: 0.7 }}>· A:{info.serie_a.dueno}</span>}
        {info.serie_b?.dueno && <span style={{ opacity: 0.7 }}>· B:{info.serie_b.dueno}</span>}
      </span>
    );
  }

  // Ya tiene ambas series (slot=1 y slot=2 propios)
  if (info.ya_asignado && !info.slot_a_agregar) {
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
        background: '#f0f0f0', border: '1px solid #ddd', color: '#999',
      }}>
        Ya tienes A+B
      </span>
    );
  }

  // Puede agregar → mostrar a qué serie va
  const destino = info.serie_destino === 'B_via_colision' ? 'B' : info.serie_destino;
  const color   = destino === 'A' ? '#4361ee' : '#e91e8c';
  const esSegundaVez = info.ya_en_pool && info.slot_a_agregar === 2;

  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
      background: `${color}12`, border: `1px solid ${color}40`, color,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <i className="bi bi-arrow-right" style={{ fontSize: '0.6rem' }}></i>
      Serie {destino}
      {esSegundaVez && <span style={{ opacity: 0.7, fontSize: '0.6rem' }}>· 2ª vez</span>}
      {info.serie_a?.dueno && destino === 'B' && (
        <span style={{ opacity: 0.7, fontSize: '0.6rem' }}>· A:{info.serie_a.dueno}</span>
      )}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────
   MODAL CREAR / EDITAR CATEGORÍA
─────────────────────────────────────────────────────────────────── */
function ModalCrearCategoria({ categoria, onClose, onSaved }) {
  const esEditar = !!categoria;
  const [form, setForm] = useState({
    nombre: categoria?.nombre || '', tipo: categoria?.tipo || 'parcial',
    monto: categoria?.monto || '', descripcion: categoria?.descripcion || '',
  });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      esEditar
        ? await API.put(`/categorias-globales/${categoria.id}`, form)
        : await API.post('/categorias-globales', form);
      toast.success(esEditar ? 'Categoría actualizada' : 'Categoría creada');
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando'); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10200 }}>
      <div style={S.modal(560)}>
        <div style={S.header(esEditar ? 'linear-gradient(135deg,#1a7a40,#2ecc71)' : 'linear-gradient(135deg,#0a3d62,#0abfbc)')}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>{esEditar ? 'Editar Categoría' : 'Nueva Categoría'}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {esEditar ? categoria.nombre : 'Parcial o Simultánea con Series A y B'}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">NOMBRE *</label>
            <input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Premio $1000, VIP..." autoFocus />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">MONTO / REFERENCIA</label>
            <input className="jd-input" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="Ej: $1,000" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="jd-label">TIPO *</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {[
                { key: 'parcial',    icon: 'bi-bullseye',       label: 'Parcial',    accent: '#4361ee', desc: 'Serie única 000-999. Un número por vendedor.' },
                { key: 'simultanea', icon: 'bi-lightning-fill', label: 'Simultánea', accent: '#e91e8c', desc: 'Series A y B (000-999). Un número puede tenerlo hasta 2 vendedores.' },
              ].map(({ key, icon, label, desc, accent }) => (
                <div key={key} onClick={() => !esEditar && setForm(p => ({ ...p, tipo: key }))}
                  style={{ flex: 1, padding: '1rem', borderRadius: 12, cursor: esEditar ? 'default' : 'pointer',
                    border: `2px solid ${form.tipo === key ? accent : 'var(--jordyn-border)'}`,
                    background: form.tipo === key ? `${accent}10` : 'var(--jordyn-bg2)', transition: 'all .15s', opacity: esEditar ? 0.7 : 1 }}>
                  <i className={`bi ${icon}`} style={{ fontSize: '1.3rem', color: form.tipo === key ? accent : 'var(--jordyn-muted)', display: 'block', marginBottom: 6 }}></i>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 4, color: form.tipo === key ? accent : 'var(--jordyn-text)' }}>{label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
            {esEditar && <div className="jd-alert jd-alert-warning mt-2" style={{ fontSize: '0.75rem' }}><i className="bi bi-lock-fill me-1"></i>El tipo no se puede cambiar.</div>}
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="jd-label">NOTAS</label>
            <textarea className="jd-input" rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Notas adicionales..." style={{ resize: 'none' }} />
          </div>
          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>
              {saving ? <><span className="jd-spinner" style={{ width: 16, height: 16 }}></span> Guardando...</> : <><i className="bi bi-floppy-fill me-1"></i>{esEditar ? 'Actualizar' : 'Crear categoría'}</>}
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 20px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   MODAL EDITAR VENDEDOR
─────────────────────────────────────────────────────────────────── */
function ModalEditarVendedor({ vendedor, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: vendedor.nombre || '', cedula: vendedor.cedula || '', password: '' });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (form.password && form.password.length < 6) return toast.error('Mínimo 6 caracteres');
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
          <div><div style={{ fontWeight: 800, fontSize: '1rem' }}><i className="bi bi-pencil-fill me-2"></i>Editar vendedor</div><div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>{vendedor.nombre}</div></div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div><label className="jd-label">NOMBRE COMPLETO *</label><input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del vendedor" autoFocus /></div>
            <div><label className="jd-label">CÉDULA</label><input className="jd-input" value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} placeholder="Opcional" /></div>
            <div><label className="jd-label">NUEVA CONTRASEÑA</label><input className="jd-input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Dejar vacío = sin cambios (mín. 6)" /></div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>
              {saving ? <><span className="jd-spinner" style={{ width: 15, height: 15 }}></span> Guardando...</> : <><i className="bi bi-floppy-fill me-1"></i>Guardar cambios</>}
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL NÚMEROS DE UN VENDEDOR EN LA CATEGORÍA
   v4: soporta doble slot (A+B) en simultáneas.
   El campo manual muestra en tiempo real a qué serie va y si ya
   puede agregar la segunda vez (Serie B).
═══════════════════════════════════════════════════════════════════ */
function ModalNumerosEnCategoria({ categoria, vendedor, onClose, onSaved }) {
  const [slots,       setSlots]       = useState([]);   // raw del resumen
  const [numInput,    setNumInput]    = useState('');
  const [rangoIni,    setRangoIni]    = useState('');
  const [rangoFin,    setRangoFin]    = useState('');
  const [tab,         setTab]         = useState('manual');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [asignando,   setAsignando]   = useState(false);
  const [preview,     setPreview]     = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [infoInput,   setInfoInput]   = useState(null);
  const [validando,   setValidando]   = useState(false);
  const debounceRef = useRef(null);

  const esSim  = categoria.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await API.get(`/categorias-globales/${categoria.id}/vendedores-resumen`);
      const vend = res.data.vendedores.find(v => String(v.vendedor_id) === String(vendedor.id));
      setSlots(vend?.numeros || []);
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
    if (slots.length > 0) cargarPreview(); else setPreview(null);
  }, [slots.length, cargarPreview]);

  // Validación en tiempo real
  useEffect(() => {
    if (numInput.length !== 3) { setInfoInput(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setValidando(true);
      try {
        const res = await API.get(`/categorias-globales/${categoria.id}/validar-numero`,
          { params: { numero: numInput, vendedor_id: vendedor.id } });
        setInfoInput(res.data);
      } catch { setInfoInput(null); }
      finally { setValidando(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [numInput, categoria.id, vendedor.id]);

  const agregarAlPool = async (numerosArray) => {
    // numerosArray puede tener duplicados (ej: ['123','123'] para doble slot)
    const validos = numerosArray.filter(n => NUM_RE.test(n));
    if (!validos.length) return toast.error('Sin números válidos (000-999)');
    setSaving(true);
    try {
      const res = await API.post(
        `/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`,
        { numeros: validos }
      );
      toast.success(res.data.message);
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const quitarDelPool = async (numero, slot) => {
    try {
      await API.delete(
        `/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`,
        { data: { numeros: [numero], slot } }
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
      const res = await API.post(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/asignar`);
      toast.success(res.data.message);
      if (res.data.colisiones?.length) {
        res.data.colisiones.forEach(c =>
          toast.warning(`Conflicto ${c.numero}: ${c.dueno_b ? `A:${c.dueno_a} / B:${c.dueno_b}` : c.mensaje || `A:${c.dueno_a}`}`, { autoClose: 8000 })
        );
      }
      await cargar(); onSaved && onSaved();
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.error || 'Error asignando');
    } finally { setAsignando(false); }
  };

  const agregarManual = () => {
    const num = pad3(parseInt(numInput) || 0);
    if (!NUM_RE.test(num)) { toast.error('Número inválido (000-999)'); return; }
    // Si ya puede agregar segunda vez (slot=2), enviamos el número dos veces
    const payload = infoInput?.slot_a_agregar === 2 ? [num, num] : [num];
    agregarAlPool(payload);
    setNumInput(''); setInfoInput(null);
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) { toast.error('Rango inválido'); return; }
    const nums = [];
    for (let i = ini; i <= fin; i++) nums.push(pad3(i));
    agregarAlPool(nums);
  };

  // Procesar slots para mostrar
  const slotsConSerie    = slots.filter(s => s.serie);
  const slotsSinSerie    = slots.filter(s => !s.serie);
  const totalSlots       = slots.length;
  const totalConSerie    = slotsConSerie.length;
  const totalSinSerie    = slotsSinSerie.length;

  // Agrupar para display
  const porNumero = {};
  for (const s of slots) {
    if (!porNumero[s.numero]) porNumero[s.numero] = [];
    porNumero[s.numero].push(s);
  }

  // No disponible = sin_espacio o ya_asignado sin slot libre
  const inputBloqueado = infoInput && !infoInput.disponible && !infoInput.ya_en_pool;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10300 }}>
      <div style={S.modal(700)}>
        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}><i className="bi bi-hash me-1"></i>{vendedor.nombre}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {categoria.nombre} — {totalSlots} slot(s) — {totalConSerie} con serie — {totalSinSerie} pendientes
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          {/* Info */}
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Puedes agregar el mismo número <strong>dos veces</strong>: la 1ª vez va a Serie A, la 2ª a Serie B. Si otro vendedor tiene Serie A, tu 1ª vez va a Serie B directamente.</>
              : <><strong>Parcial:</strong> Un número solo puede pertenecer a un vendedor. Agrega y luego asigna.</>
            }
          </div>

          {/* Barra progreso */}
          <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', border: '1px solid var(--jordyn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 600, marginBottom: 5 }}>
              <span>POOL</span>
              <span>{totalSlots} slot(s) — {totalConSerie} asignados — {totalSinSerie} pendientes</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 8, background: `linear-gradient(90deg,${accent},${accent}88)`, width: `${(totalSlots / (esSim ? 2000 : 1000)) * 100}%`, transition: 'width 0.4s' }} />
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
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <input className="jd-input" value={numInput}
                    onChange={e => setNumInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    onKeyDown={e => e.key === 'Enter' && !inputBloqueado && agregarManual()}
                    placeholder="000-999"
                    style={{ maxWidth: 120, textAlign: 'center', fontWeight: 700, letterSpacing: 2, fontSize: '1rem',
                      borderColor: infoInput ? (!infoInput.disponible && !infoInput.ya_en_pool ? '#ffaaaa' : infoInput.disponible ? `${accent}` : 'var(--jordyn-border)') : undefined }}
                    maxLength={3} />

                  {/* Indicador en tiempo real */}
                  {numInput.length === 3 && (
                    <div style={{ marginTop: 5, minHeight: 24 }}>
                      {validando
                        ? <span className="jd-spinner" style={{ width: 12, height: 12 }}></span>
                        : infoInput && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <SerieBadge info={infoInput} esSim={esSim} />
                            {/* Mensaje explicativo */}
                            {infoInput.disponible && infoInput.ya_en_pool && infoInput.slot_a_agregar === 2 && (
                              <span style={{ fontSize: '0.64rem', color: '#e91e8c' }}>
                                <i className="bi bi-info-circle me-1"></i>
                                Ya tienes Serie A. Agregar agrega la Serie B.
                              </span>
                            )}
                            {(infoInput.sin_espacio || (!infoInput.disponible && !infoInput.ya_en_pool)) && (
                              <span style={{ fontSize: '0.64rem', color: '#e63946' }}>
                                <i className="bi bi-x-circle me-1"></i>
                                {infoInput.mensaje}
                              </span>
                            )}
                            {infoInput.ya_asignado && !infoInput.slot_a_agregar && (
                              <span style={{ fontSize: '0.64rem', color: '#999' }}>
                                <i className="bi bi-check2-all me-1"></i>
                                {infoInput.mensaje}
                              </span>
                            )}
                          </div>
                        )
                      }
                    </div>
                  )}
                </div>

                <button className="btn-jordyn" onClick={agregarManual}
                  disabled={saving || (infoInput && !infoInput.disponible)}
                  style={{ background: `linear-gradient(135deg,${accent},${accent}cc)`, height: 44 }}>
                  <i className="bi bi-plus-lg me-1"></i>
                  {infoInput?.slot_a_agregar === 2 ? 'Agregar (→ B)' : 'Agregar'}
                </button>
              </div>
            </div>
          )}

          {tab === 'rango' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value)} placeholder="Desde" style={{ maxWidth: 90 }} maxLength={3} />
              <span style={{ color: 'var(--jordyn-muted)' }}>-</span>
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
              {/* Botón asignar series */}
              {totalSinSerie > 0 && (
                <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}30`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? '0.75rem' : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: accent }}>
                      <i className="bi bi-lightning-fill me-1"></i>{totalSinSerie} slot(s) sin serie
                    </div>
                    <button className="btn-jordyn" onClick={asignarNumeros} disabled={asignando || loadingPrev}
                      style={{ height: 36, padding: '0 16px', fontSize: '0.8rem', background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                      {asignando ? <span className="jd-spinner" style={{ width: 14, height: 14 }}></span> : <><i className="bi bi-send-fill me-1"></i>Asignar series</>}
                    </button>
                  </div>
                  {loadingPrev && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><span className="jd-spinner" style={{ width: 12, height: 12 }}></span> Calculando...</div>}
                  {preview && !loadingPrev && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {preview.libres?.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {['A', 'B'].map(serie => {
                            const nums = preview.libres.filter(l => l.serie === serie);
                            if (!nums.length) return null;
                            const color = serie === 'A' ? '#4361ee' : '#e91e8c';
                            return (
                              <div key={serie} style={{ flex: 1, minWidth: 120, background: serie === 'A' ? '#f0fff8' : '#fff0f5', border: `1.5px solid ${color}40`, borderRadius: 10, padding: '8px 12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: 5 }}>
                                  <i className="bi bi-check-circle-fill me-1"></i>Serie {serie} ({nums.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {nums.slice(0, 20).map(l => (
                                    <span key={`${l.numero}-${l.slot}`} style={{ padding: '2px 7px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, background: `${color}15`, border: `1px solid ${color}30`, color }}>{l.numero}</span>
                                  ))}
                                  {nums.length > 20 && <span style={{ fontSize: '0.64rem', color, alignSelf: 'center' }}>+{nums.length - 20}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {preview.colisiones?.length > 0 && (
                        <div style={{ background: '#fff5f5', border: '1.5px solid #ffaaaa', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c0392b', marginBottom: 5 }}>
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>Conflictos — Serie ocupada por otro: {preview.colisiones.length}
                          </div>
                          {preview.colisiones.slice(0, 6).map((c, i) => (
                            <div key={i} style={{ fontSize: '0.68rem', color: '#c0392b', marginBottom: 2 }}>
                              - <strong>{c.numero}</strong> Serie {c.serie_intentada}: {c.dueno_serie}
                              {c.dueno_a && c.dueno_b && <span style={{ opacity: 0.7 }}> (A:{c.dueno_a} / B:{c.dueno_b})</span>}
                            </div>
                          ))}
                          {preview.colisiones.length > 6 && <div style={{ fontSize: '0.66rem', color: '#c0392b' }}>+{preview.colisiones.length - 6} más</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de números agrupados por número */}
              {Object.keys(porNumero).length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                    Números ({Object.keys(porNumero).length} únicos / {totalSlots} slots)
                    {esSim && <span style={{ marginLeft: 8, fontWeight: 400 }}>· mismo número dos veces = Serie A + Serie B</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(porNumero).sort(([a], [b]) => a.localeCompare(b)).map(([num, numSlots]) => {
                      // Para cada número, mostrar sus slots ordenados
                      return numSlots.map((s, idx) => {
                        const color = s.serie === 'A' ? '#4361ee' : s.serie === 'B' ? '#e91e8c' : '#aaa';
                        const bgColor = s.serie === 'A' ? '#f0f5ff' : s.serie === 'B' ? '#fff0f5' : '#f5f5f5';
                        const label = s.serie ? `Serie ${s.serie}` : esSim ? `slot ${s.slot}` : 'sin serie';
                        return (
                          <div key={`${num}-${s.slot}`} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <div style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: bgColor, border: `1.5px solid ${color}40`, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{num}</span>
                              <span style={{ fontSize: '0.58rem', opacity: 0.8, fontWeight: 600 }}>{label}</span>
                            </div>
                            {s.serie && (
                              <button onClick={() => liberarSerie(s.asignacion_id)} title="Liberar serie (mantiene en pool)"
                                style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 700 }}>×</button>
                            )}
                            <button onClick={() => quitarDelPool(num, s.slot)} title={`Quitar slot ${s.slot}`}
                              style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', padding: 0, fontSize: '0.65rem' }}>
                              <i className="bi bi-trash3"></i>
                            </button>
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              )}

              {totalSlots === 0 && (
                <div className="jd-alert jd-alert-warning" style={{ fontSize: '0.82rem' }}>Sin números en el pool. Usa las opciones de arriba para agregar.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL CREAR / VINCULAR VENDEDOR EN CATEGORÍA
═══════════════════════════════════════════════════════════════════ */
function ModalCrearVendedorEnCategoria({ categoria, vendedoresDisponibles, onClose, onSaved }) {
  const esSim  = categoria.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  const [modo,        setModo]        = useState('nuevo');
  const [vendedorSel, setVendedorSel] = useState('');
  const [form,        setForm]        = useState({ nombre: '', cedula: '' });
  const [numeros,     setNumeros]     = useState([]);  // [{ numero, slot, infoSerie }]
  const [numInput,    setNumInput]    = useState('');
  const [infoInput,   setInfoInput]   = useState(null);
  const [validando,   setValidando]   = useState(false);
  const [rangoIni,    setRangoIni]    = useState('');
  const [rangoFin,    setRangoFin]    = useState('');
  const [tab,         setTab]         = useState('manual');
  const [saving,      setSaving]      = useState(false);
  const [resultado,   setResultado]   = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (numInput.length !== 3 || modo !== 'existente' || !vendedorSel) { setInfoInput(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setValidando(true);
      try {
        const res = await API.get(`/categorias-globales/${categoria.id}/validar-numero`,
          { params: { numero: numInput, vendedor_id: vendedorSel } });
        setInfoInput(res.data);
      } catch { setInfoInput(null); }
      finally { setValidando(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [numInput, modo, vendedorSel, categoria.id]);

  const agregarNumeroManual = () => {
    const num = pad3(parseInt(numInput) || 0);
    if (!NUM_RE.test(num)) { toast.error('Número inválido'); return; }

    if (esSim) {
      // Contar cuántos slots de este número ya están en la lista local
      const yaEnLista = numeros.filter(n => n.numero === num).length;
      // El slot_a_agregar del backend nos dice si es 1 o 2
      const slotDeseado = infoInput?.slot_a_agregar || (yaEnLista + 1);
      if (yaEnLista >= 2) { toast.warning(`Ya tienes ${num} dos veces (A+B)`); return; }
      if (infoInput && !infoInput.disponible && infoInput.sin_espacio) { toast.error(infoInput.mensaje); return; }
      setNumeros(prev => [...prev, { numero: num, slot: slotDeseado, infoSerie: infoInput }]);
    } else {
      if (numeros.find(n => n.numero === num)) { toast.warning(`${num} ya está en la lista`); return; }
      if (infoInput && !infoInput.disponible) { toast.error(infoInput.mensaje); return; }
      setNumeros(prev => [...prev, { numero: num, slot: 1, infoSerie: infoInput }]);
    }
    setNumInput(''); setInfoInput(null);
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni), fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) { toast.error('Rango inválido'); return; }
    const nuevos = [];
    for (let i = ini; i <= fin; i++) {
      const num = pad3(i);
      if (!numeros.find(n => n.numero === num && n.slot === 1)) nuevos.push({ numero: num, slot: 1, infoSerie: null });
    }
    setNumeros(prev => [...prev, ...nuevos]);
    toast.success(`${nuevos.length} números agregados`);
  };

  const quitarNumero = (num, slot) => setNumeros(prev => prev.filter(n => !(n.numero === num && n.slot === slot)));

  const confirmar = async () => {
    if (modo === 'nuevo' && !form.nombre.trim()) return toast.error('El nombre es requerido');
    if (modo === 'existente' && !vendedorSel) return toast.error('Selecciona un vendedor');
    setSaving(true);
    try {
      const creds = modo === 'nuevo' ? generarCredenciales(form.nombre.trim()) : null;
      // Construir array de números con posibles duplicados para el backend
      const numerosPayload = numeros.map(n => n.numero); // el backend infiere slots por conteo
      const payload = {
        ...(modo === 'existente' ? { vendedor_id: vendedorSel } : {
          nombre: form.nombre.trim(), cedula: form.cedula || undefined, ...(creds || {}),
        }),
        numeros: numerosPayload,
      };
      const res = await API.post(`/categorias-globales/${categoria.id}/vendedores`, payload);
      setResultado(res.data);
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al crear'); }
    finally { setSaving(false); }
  };

  // Pantalla resultado
  if (resultado) {
    const { vendedor, credenciales, asignacion } = resultado;
    return (
      <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10300 }}>
        <div style={S.modal(560)}>
          <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
            <div><div style={{ fontWeight: 800, fontSize: '1rem' }}><i className="bi bi-check-circle-fill me-2"></i>Vendedor creado</div><div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>{vendedor.nombre} — {categoria.nombre}</div></div>
            <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={S.body}>
            {credenciales && (
              <div style={{ background: 'linear-gradient(135deg,#0a3d62,#0abfbc)', borderRadius: 12, padding: '0.9rem 1.1rem', marginBottom: '1rem', color: '#fff' }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Credenciales de acceso</div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  <span>Usuario: <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{credenciales.usuario}</strong></span>
                  <span>Clave: <strong style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>{credenciales.password}</strong></span>
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: 5 }}>Copia las credenciales ahora.</div>
              </div>
            )}
            <div style={{ fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.7 }}>{asignacion.mensaje}</div>
            {asignacion.insertados.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', marginBottom: 5 }}>Asignados ({asignacion.insertados.length})</div>
                {['A','B'].map(serie => {
                  const nums = asignacion.insertados.filter(i => i.serie === serie);
                  if (!nums.length) return null;
                  const color = serie === 'A' ? '#4361ee' : '#e91e8c';
                  return (
                    <div key={serie} style={{ marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color, marginRight: 6 }}>Serie {serie} ({nums.length})</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                        {nums.map(n => <span key={n.numero + n.serie} style={{ padding: '2px 7px', borderRadius: 5, fontSize: '0.66rem', fontWeight: 800, background: serie === 'A' ? '#f0f5ff' : '#fff0f5', border: `1px solid ${color}30`, color }}>{n.numero}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {asignacion.colisiones?.length > 0 && (
              <div style={{ background: '#fff5f5', border: '1.5px solid #ffaaaa', borderRadius: 10, padding: '8px 12px', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c0392b', marginBottom: 4 }}>
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>Serie ocupada por otro — No asignados ({asignacion.colisiones.length})
                </div>
                {asignacion.colisiones.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ fontSize: '0.68rem', color: '#c0392b', marginBottom: 2 }}>
                    - <strong>{c.numero}</strong>: {c.dueno_b ? `A:${c.dueno_a} / B:${c.dueno_b}` : c.mensaje}
                  </div>
                ))}
                {asignacion.colisiones.length > 5 && <div style={{ fontSize: '0.66rem', color: '#c0392b' }}>+{asignacion.colisiones.length - 5} más</div>}
              </div>
            )}
            <button className="btn-jordyn w-100" onClick={onClose} style={{ marginTop: 8 }}><i className="bi bi-check-lg me-1"></i>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...S.overlay, zIndex: 10300 }}>
      <div style={S.modal(640)}>
        <div style={S.header(`linear-gradient(135deg,${esSim ? '#7b0050,#e91e8c' : '#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}><i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}><span style={S.tipoBadge(categoria.tipo)}>{esSim ? 'Simultánea' : 'Parcial'}</span>{' '}{categoria.nombre}</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)', marginBottom: '1rem' }}>
            {[['nuevo', 'Crear nuevo'], ['existente', 'Vendedor existente']].map(([k, l], i) => (
              <button key={k} onClick={() => { setModo(k); setInfoInput(null); setNumInput(''); }} style={{
                flex: 1, padding: '9px 8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: modo === k ? accent : 'transparent', color: modo === k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: i === 0 ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {modo === 'nuevo' ? (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 200px' }}>
                <label className="jd-label">NOMBRE COMPLETO *</label>
                <input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" autoFocus />
                <div style={{ fontSize: '0.67rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>Las credenciales se generan automáticamente</div>
              </div>
              <div style={{ flex: '1 1 130px' }}>
                <label className="jd-label">CÉDULA</label>
                <input className="jd-input" value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <label className="jd-label">VENDEDOR *</label>
              <select className="jd-input" value={vendedorSel} onChange={e => { setVendedorSel(e.target.value); setInfoInput(null); setNumInput(''); }}>
                <option value="">- Seleccionar -</option>
                {vendedoresDisponibles.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
          )}

          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Agrega el mismo número <strong>dos veces</strong> para tener Serie A y Serie B. Si otro tiene Serie A, la 1ª vez va a Serie B.</>
              : <><strong>Parcial:</strong> Un número por vendedor. Si ya está ocupado no se puede agregar.</>
            }
          </div>

          <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}25`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: accent, marginBottom: '0.75rem' }}>
              <i className="bi bi-hash me-1"></i>Números a asignar
            </div>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)', marginBottom: '0.75rem' }}>
              {[['manual', 'Manual'], ['rango', 'Rango']].map(([k, l], i) => (
                <button key={k} onClick={() => setTab(k)} style={{
                  flex: 1, padding: '7px 6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  background: tab === k ? accent : 'transparent', color: tab === k ? '#fff' : 'var(--jordyn-muted)',
                  borderRight: i === 0 ? '1.5px solid var(--jordyn-border)' : 'none',
                }}>{l}</button>
              ))}
            </div>

            {tab === 'manual' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div>
                  <input className="jd-input" value={numInput}
                    onChange={e => setNumInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    onKeyDown={e => e.key === 'Enter' && agregarNumeroManual()}
                    placeholder="000-999" style={{ maxWidth: 110, textAlign: 'center', fontWeight: 700, letterSpacing: 2 }} maxLength={3} />
                  {numInput.length === 3 && (
                    <div style={{ marginTop: 4, minHeight: 22 }}>
                      {validando
                        ? <span className="jd-spinner" style={{ width: 12, height: 12 }}></span>
                        : infoInput ? <SerieBadge info={infoInput} esSim={esSim} />
                          : modo === 'nuevo' ? <span style={{ fontSize: '0.64rem', color: 'var(--jordyn-muted)' }}>Se validará al guardar</span>
                          : null
                      }
                    </div>
                  )}
                </div>
                <button className="btn-jordyn" onClick={agregarNumeroManual}
                  disabled={infoInput && (infoInput.sin_espacio || (!infoInput.disponible && !infoInput.ya_en_pool))}
                  style={{ background: `linear-gradient(135deg,${accent},${accent}cc)`, height: 44 }}>
                  <i className="bi bi-plus-lg me-1"></i>
                  {infoInput?.slot_a_agregar === 2 ? 'Agregar (→ B)' : 'Agregar'}
                </button>
              </div>
            )}

            {tab === 'rango' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="jd-input" value={rangoIni} onChange={e => setRangoIni(e.target.value)} placeholder="Desde" style={{ maxWidth: 80 }} maxLength={3} />
                <span style={{ color: 'var(--jordyn-muted)' }}>—</span>
                <input className="jd-input" value={rangoFin} onChange={e => setRangoFin(e.target.value)} placeholder="Hasta" style={{ maxWidth: 80 }} maxLength={3} />
                <button className="btn-jordyn" onClick={agregarRango} style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
                  <i className="bi bi-plus-lg me-1"></i>Agregar rango
                </button>
              </div>
            )}

            {numeros.length > 0 && (
              <div style={{ marginTop: '0.85rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', marginBottom: 5 }}>
                  Lista ({numeros.length} slot{numeros.length !== 1 ? 's' : ''})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {numeros.map(({ numero, slot, infoSerie }, idx) => {
                    const destino = infoSerie?.serie_destino === 'B_via_colision' ? 'B' : (infoSerie?.serie_destino || (slot === 2 ? 'B' : 'A'));
                    const color = !infoSerie ? 'var(--jordyn-primary)'
                      : (!infoSerie.disponible || infoSerie.sin_espacio) ? '#e63946'
                      : destino === 'A' ? '#4361ee' : '#e91e8c';
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.72rem', background: `${color}12`, border: `1.5px solid ${color}30`, color }}>
                          {numero}
                          <span style={{ marginLeft: 4, fontSize: '0.6rem', opacity: 0.8 }}>→{destino}</span>
                        </span>
                        <button onClick={() => quitarNumero(numero, slot)} style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', padding: 0, fontSize: '0.65rem' }}>
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {numeros.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                Sin números. Puedes crear el vendedor y agregar números después.
              </div>
            )}
          </div>

          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={confirmar} disabled={saving}
              style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}>
              {saving
                ? <><span className="jd-spinner" style={{ width: 15, height: 15 }}></span> Creando...</>
                : <><i className="bi bi-person-check-fill me-1"></i>
                    {modo === 'nuevo' ? 'Crear vendedor' : 'Vincular vendedor'}
                    {numeros.length > 0 ? ` + ${numeros.length} slot${numeros.length !== 1 ? 's' : ''}` : ''}
                  </>
              }
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   MODAL GESTIONAR CATEGORÍA
─────────────────────────────────────────────────────────────────── */
function ModalGestionarCategoria({ categoria, onClose, onSaved }) {
  const [resumen,       setResumen]      = useState({ vendedores: [] });
  const [todosVend,     setTodosVend]    = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [modalNums,     setModalNums]    = useState(null);
  const [modalEditar,   setModalEditar]  = useState(null);
  const [modalAgregar,  setModalAgregar] = useState(false);
  const [confirmQuitar, setConfirmQuitar]= useState(null);
  const [confirmDelete, setConfirmDelete]= useState(null);
  const [busq,          setBusq]         = useState('');

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
    } catch { toast.error('Error cargando categoría'); }
    finally { setLoading(false); }
  }, [categoria.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const idsEnCat = new Set(resumen.vendedores.map(v => String(v.vendedor_id)));
  const vendDisp = todosVend.filter(v => v.activo && !idsEnCat.has(String(v.id)));

  const quitarDeCategoria = async (vendedor_id) => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor_id}`);
      toast.info('Vendedor removido'); setConfirmQuitar(null);
      await cargar(); onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const eliminarDelSistema = async () => {
    try {
      await API.delete(`/vendedores/${confirmDelete.id}`);
      toast.success('Vendedor eliminado'); setConfirmDelete(null);
      await cargar(); onSaved && onSaved();
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.toLowerCase().includes('ventas')) setConfirmDelete(p => ({ ...p, tieneVentas: true }));
      else toast.error(msg || 'Error eliminando');
    }
  };

  const desactivarVendedor = async () => {
    try {
      await API.put(`/vendedores/${confirmDelete.id}`, { activo: false });
      toast.info('Vendedor desactivado'); setConfirmDelete(null);
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
              <span style={S.tipoBadge(categoria.tipo)}>{esSim ? 'Simultánea' : 'Parcial'}</span>
              {categoria.nombre}
              {categoria.monto && <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>— {categoria.monto}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 4 }}>{resumen.vendedores.length} vendedor(es)</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>

        <div style={S.body}>
          <div style={{ background: 'var(--jordyn-bg2)', border: `2px solid ${accent}30`, borderRadius: 14, padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: accent }}>
              <i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor a esta categoría
            </div>
            <button onClick={() => setModalAgregar(true)}
              style={{ background: accent, border: 'none', color: '#fff', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi bi-person-plus-fill"></i>Agregar
            </button>
          </div>

          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ? <><strong>Simultánea:</strong> Cada número puede tener hasta 2 dueños (Serie A y Serie B). El mismo vendedor puede tener un número dos veces (A+B).</>
              : <><strong>Parcial:</strong> Un número solo puede pertenecer a un vendedor en esta categoría.</>
            }
          </div>

          <div style={{ marginBottom: '0.85rem' }}>
            <input className="jd-input" value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar vendedor..." />
          </div>

          {loading ? (
            <div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{ width: 36, height: 36 }}></div></div>
          ) : resumen.vendedores.length === 0 ? (
            <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <i className="bi bi-people-fill" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>
              Sin vendedores. Usa el botón de arriba para agregar el primero.
            </div>
          ) : vendFiltrados.length === 0 ? (
            <div className="jd-alert jd-alert-info" style={{ fontSize: '0.82rem' }}>Sin resultados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {vendFiltrados.map(vdata => {
                const sinSerie = (vdata.total_slots || 0) - (vdata.total_asignados || 0);
                return (
                  <div key={vdata.vendedor_id} style={{ border: `2px solid ${accent}25`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--jordyn-bg2)', padding: '0.65rem 1rem', borderBottom: '1px solid var(--jordyn-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                          {vdata.vendedor_nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{vdata.vendedor_nombre}</div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--jordyn-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                            <span>{vdata.total_numeros_unicos || 0} núm. únicos</span>
                            {esSim && vdata.serie_a > 0 && <span style={{ color: '#4361ee' }}>A:{vdata.serie_a}</span>}
                            {esSim && vdata.serie_b > 0 && <span style={{ color: '#e91e8c' }}>B:{vdata.serie_b}</span>}
                            {!esSim && vdata.total_asignados > 0 && <span style={{ color: '#4361ee' }}>Asig:{vdata.total_asignados}</span>}
                            {sinSerie > 0 && <span style={{ color: '#f0a500' }}>Pend:{sinSerie}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button onClick={() => setModalNums({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })} style={S.btnSm(`${accent}15`, accent, `${accent}40`)}><i className="bi bi-hash"></i> Números</button>
                        <button onClick={() => setModalEditar({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre, cedula: vdata.cedula || '' })} style={S.btnSm('var(--jordyn-bg2)', 'var(--jordyn-muted)', 'var(--jordyn-border)')}><i className="bi bi-pencil-fill"></i> Editar</button>
                        <button onClick={() => setConfirmQuitar({ vendedor_id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })} style={S.btnSm('#fff8e1', '#b37700', '#ffd16640')}><i className="bi bi-person-dash-fill"></i> Quitar</button>
                        <button onClick={() => setConfirmDelete({ id: vdata.vendedor_id, nombre: vdata.vendedor_nombre })} style={S.btnSm('#fff5f5', '#e63946', '#ffcccc')}><i className="bi bi-trash3-fill"></i></button>
                      </div>
                    </div>

                    {/* Números resumidos */}
                    <div style={{ padding: '0.65rem 1rem' }}>
                      {!vdata.numeros || vdata.numeros.length === 0 ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontStyle: 'italic' }}>Sin números.</div>
                      ) : esSim ? (
                        // Agrupar por serie para display
                        [null, 'A', 'B'].map(serie => {
                          const nums = vdata.numeros.filter(n => n.serie === serie);
                          if (!nums.length) return null;
                          const label = serie ? `Serie ${serie}` : 'Sin serie';
                          const color = serie === 'A' ? '#4361ee' : serie === 'B' ? '#e91e8c' : '#aaa';
                          return (
                            <div key={String(serie)} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color, textTransform: 'uppercase', flexShrink: 0, paddingTop: 2 }}>{label} ({nums.length})</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {nums.slice(0, 15).map((n, i) => (
                                  <span key={i} style={{ padding: '1px 6px', borderRadius: 5, fontSize: '0.66rem', fontWeight: 800, background: serie === 'A' ? '#f0f5ff' : serie === 'B' ? '#fff0f5' : '#f5f5f5', border: `1px solid ${color}30`, color }}>{n.numero}</span>
                                ))}
                                {nums.length > 15 && <span style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', alignSelf: 'center' }}>+{nums.length - 15}</span>}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {vdata.numeros.slice(0, 25).map((n, i) => (
                            <span key={i} style={{ padding: '2px 7px', borderRadius: 5, fontSize: '0.67rem', fontWeight: 800, background: n.serie ? 'rgba(10,191,188,0.1)' : '#f5f5f5', border: `1px solid ${n.serie ? 'rgba(10,191,188,0.3)' : '#ddd'}`, color: n.serie ? 'var(--jordyn-primary)' : '#aaa' }}>{n.numero}</span>
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

      {modalAgregar && <ModalCrearVendedorEnCategoria categoria={categoria} vendedoresDisponibles={vendDisp} onClose={() => setModalAgregar(false)} onSaved={() => { cargar(); onSaved && onSaved(); }} />}
      {modalNums && <ModalNumerosEnCategoria categoria={categoria} vendedor={modalNums} onClose={() => setModalNums(null)} onSaved={() => { cargar(); onSaved && onSaved(); }} />}
      {modalEditar && <ModalEditarVendedor vendedor={modalEditar} onClose={() => setModalEditar(null)} onSaved={() => { setModalEditar(null); cargar(); onSaved && onSaved(); }} />}

      {confirmQuitar && (
        <div onClick={e => e.target === e.currentTarget && setConfirmQuitar(null)} style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(440)}>
            <div style={S.header('linear-gradient(135deg,#b37700,#f0a500)')}><div style={{ fontWeight: 800 }}>Quitar de esta categoría</div><button onClick={() => setConfirmQuitar(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button></div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>Quitar a <strong>"{confirmQuitar.nombre}"</strong> de <strong>"{categoria.nombre}"</strong>. Se eliminan sus números y series en esta categoría. <strong>El vendedor NO se elimina del sistema.</strong></p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn w-100" onClick={() => quitarDeCategoria(confirmQuitar.vendedor_id)} style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)' }}><i className="bi bi-person-dash-fill me-1"></i>Quitar de esta categoría</button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmQuitar(null)} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelete(null)} style={{ ...S.overlay, zIndex: 10200 }}>
          <div style={S.modal(440)}>
            <div style={S.header(confirmDelete.tieneVentas ? 'linear-gradient(135deg,#b37700,#f0a500)' : 'linear-gradient(135deg,#c0303a,#e63946)')}><div style={{ fontWeight: 800 }}>{confirmDelete.tieneVentas ? 'Vendedor con ventas' : 'Eliminar vendedor del sistema'}</div><button onClick={() => setConfirmDelete(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button></div>
            <div style={S.body}>
              {confirmDelete.tieneVentas ? (
                <><div style={{ background: '#fff8e1', border: '1.5px solid #ffd166', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#7a5c00', lineHeight: 1.6 }}><strong>No se puede eliminar</strong> porque tiene ventas registradas.</div><p style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', marginBottom: 20, lineHeight: 1.6 }}>Puedes <strong>desactivarlo</strong> para que no pueda iniciar sesión.</p><div className="d-flex gap-2"><button className="btn-jordyn w-100" onClick={desactivarVendedor} style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)' }}><i className="bi bi-pause-circle me-1"></i>Desactivar</button><button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)} style={{ flexShrink: 0, padding: '0 16px' }}>Cancelar</button></div></>
              ) : (
                <><p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>Eliminar definitivamente a <strong>"{confirmDelete.nombre}"</strong>. Se borrarán todos sus datos. Esta acción no se puede deshacer.</p><div className="d-flex gap-2"><button className="btn-jordyn-danger w-100" onClick={eliminarDelSistema}><i className="bi bi-trash3-fill me-1"></i>Eliminar definitivamente</button><button className="btn-jordyn-outline" onClick={() => setConfirmDelete(null)} style={{ flexShrink: 0, padding: '0 16px' }}>Cancelar</button></div></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   CARD DE CATEGORÍA
─────────────────────────────────────────────────────────────────── */
function CategoriaCard({ cat, onEdit, onDelete, onSaved }) {
  const [verModal, setVerModal] = useState(false);
  const esSim  = cat.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  return (
    <>
      <div style={{ border: `2px solid ${accent}25`, borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow .2s, border-color .2s' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 24px ${accent}22`; e.currentTarget.style.borderColor = `${accent}55`; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = `${accent}25`; }}>
        <div style={{ height: 4, background: `linear-gradient(90deg,${accent},${accent}88)` }} />
        <div style={{ padding: '1rem 1rem 0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.nombre}</div>
              {cat.monto && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>{cat.monto}</div>}
              <span style={S.tipoBadge(cat.tipo)}>{esSim ? 'Simultánea' : 'Parcial'}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button onClick={() => onEdit(cat)} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}><i className="bi bi-pencil-fill"></i></button>
              <button onClick={() => onDelete(cat)} style={{ background: '#fff5f5', border: '1px solid #ffcccc', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem', color: '#e63946' }}><i className="bi bi-trash3-fill"></i></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            <span style={S.badge('var(--jordyn-primary)')}><i className="bi bi-people-fill"></i>{cat.total_vendedores || 0} vendedores</span>
            <span style={S.badge('#2ecc71')}><i className="bi bi-hash"></i>{cat.total_numeros_definidos || 0} núm. únicos</span>
            {esSim && <><span style={S.badge('#4361ee')}>A:{cat.numeros_serie_a || 0}</span><span style={S.badge('#e91e8c')}>B:{cat.numeros_serie_b || 0}</span></>}
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
            <i className="bi bi-people-fill me-1"></i>Gestionar vendedores {cat.total_vendedores > 0 ? `(${cat.total_vendedores})` : ''}
          </button>
        </div>
      </div>
      {verModal && <ModalGestionarCategoria categoria={cat} onClose={() => setVerModal(false)} onSaved={onSaved} />}
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
─────────────────────────────────────────────────────────────────── */
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
    try { const res = await API.get('/categorias-globales'); setCategorias(res.data); }
    catch { toast.error('Error cargando categorías'); }
    finally { setLoadingC(false); }
  }, []);

  useEffect(() => { cargarCategorias(); }, [cargarCategorias]);

  const eliminarCategoria = async (cat) => {
    try { await API.delete(`/categorias-globales/${cat.id}`); toast.success('Categoría eliminada'); setConfirmDelCat(null); cargarCategorias(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error eliminando'); setConfirmDelCat(null); }
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
            <i className="bi bi-tags-fill" style={{ color: 'var(--jordyn-primary)' }}></i>Categorías
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: '2px 0 0' }}>
            {categorias.length} categoría(s) — Vendedores y números gestionados dentro de cada categoría
          </p>
        </div>
        <button className="btn-jordyn" onClick={() => setModalCrearCat(true)} style={{ fontSize: '0.82rem' }}>
          <i className="bi bi-plus-lg me-1"></i>Nueva categoría
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--jordyn-border)' }}>
          {[['todos', 'Todas'], ['parcial', 'Parcial'], ['simultanea', 'Simultánea']].map(([k, l]) => (
            <button key={k} onClick={() => setFiltroTipo(k)} style={S.pill(filtroTipo === k)}>{l}</button>
          ))}
        </div>
        <input className="jd-input" style={{ flex: '1 1 200px', maxWidth: 320 }} value={busqCat} onChange={e => setBusqCat(e.target.value)} placeholder="Buscar categoría..." />
      </div>

      {loadingC ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 44, height: 44 }}></div></div>
      ) : categoriasFiltradas.length === 0 ? (
        <div className="jd-alert jd-alert-warning" style={{ textAlign: 'center', padding: '2.5rem' }}>
          {categorias.length === 0
            ? <><i className="bi bi-tags" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, opacity: 0.4 }}></i>Sin categorías. Crea la primera con <strong>"Nueva categoría"</strong>.</>
            : 'Sin resultados para los filtros aplicados.'
          }
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {categoriasFiltradas.map(cat => <CategoriaCard key={cat.id} cat={cat} onEdit={c => setEditCat(c)} onDelete={c => setConfirmDelCat(c)} onSaved={cargarCategorias} />)}
        </div>
      )}

      {modalCrearCat && <ModalCrearCategoria onClose={() => setModalCrearCat(false)} onSaved={cargarCategorias} />}
      {editCat && <ModalCrearCategoria categoria={editCat} onClose={() => setEditCat(null)} onSaved={cargarCategorias} />}

      {confirmDelCat && (
        <div onClick={e => e.target === e.currentTarget && setConfirmDelCat(null)} style={S.overlay}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#c0303a,#e63946)')}><div style={{ fontWeight: 800 }}>Eliminar categoría</div><button onClick={() => setConfirmDelCat(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button></div>
            <div style={S.body}>
              <p style={{ fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.7 }}>Eliminar <strong>"{confirmDelCat.nombre}"</strong>. Se eliminan todos los vendedores y números de esta categoría. <strong>Los vendedores no se eliminan del sistema.</strong></p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn-danger w-100" onClick={() => eliminarCategoria(confirmDelCat)}><i className="bi bi-trash3-fill me-1"></i>Eliminar</button>
                <button className="btn-jordyn-outline" onClick={() => setConfirmDelCat(null)} style={{ flexShrink: 0, padding: '0 18px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}