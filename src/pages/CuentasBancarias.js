// ============================================================
//   CuentasBancarias.js — RESUELVE TU SEMANA
//   ✅ Cuentas / métodos de pago que ve el cliente en la página
//   ✅ Son las mismas que el bot de WhatsApp envía al cobrar
//   ✅ Agregar, editar, ordenar, ocultar y eliminar
//   ✅ Moneda de cobro: el monto se convierte con las Tasas
//   ✅ Logo opcional de la cuenta (Cloudinary); sin logo se usa el ícono
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const MONEDAS = {
  COP: { nombre: 'Pesos colombianos (COP)', corto: 'Pesos',     ayuda: 'El cliente paga el precio de la rifa tal cual, en pesos.' },
  VES: { nombre: 'Bolívares (Bs)',          corto: 'Bolívares', ayuda: 'El monto se convierte a bolívares con las tasas COP/USD y BsD/USD.' },
  USD: { nombre: 'Dólares (USD)',           corto: 'Dólares',   ayuda: 'El monto se convierte a dólares con la tasa COP/USD.' },
};

const COLOR_DEFECTO = '#089a97';
const MAX_MB = 5;
const VACIO = { nombre: '', icono: '🏦', color: '', moneda: 'COP', pais: '', nota: '', presencial: false, pedir_titular: false, activo: true, campos: [{ label: 'Banco', valor: '' }, { label: 'Número de cuenta', valor: '' }, { label: 'Titular', valor: '' }] };
const ICONOS = ['🏦', '📱', '💳', '💜', '💙', '💚', '💛', '💵', '🪙', '🇻🇪', '🇨🇴', '🇺🇸'];

const fmtFecha = f =>
  f ? new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }) : '—';

/* Tarjeta tal como la ve el cliente en la página */
function VistaCliente({ c }) {
  const color = c.color || COLOR_DEFECTO;
  return (
    <div style={{ background: `${color}12`, border: `2px solid ${color}55`, borderRadius: 16, padding: '16px 14px', fontFamily: "'Poppins',sans-serif" }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:'rgba(255,255,255,.8)', border:`1px solid ${color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.35rem', flexShrink:0, overflow:'hidden' }}>
          {c.imagen_url ? <img src={c.imagen_url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:3, background:'#fff' }} /> : (c.icono || '💳')}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:'.98rem', color, fontWeight:700 }}>{c.nombre || 'Nombre de la cuenta'}</div>
          {c.pais && <div style={{ fontSize:'.66rem', color:'#1a2e2e99' }}>{c.pais}</div>}
        </div>
      </div>
      {(c.campos || []).filter(x => x.label || x.valor).map((x, i) => (
        <div key={i} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'7px 11px', marginBottom:6 }}>
          <div style={{ fontSize:'.56rem', color:`${color}aa`, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{x.label || 'Dato'}</div>
          <div style={{ fontSize:'.84rem', color:'#1a2e2e', fontWeight:700, wordBreak:'break-word' }}>{x.valor || '—'}</div>
        </div>
      ))}
      {c.nota && <div style={{ fontSize:'.68rem', color, fontWeight:600, textAlign:'center', padding:'6px', background:'rgba(255,255,255,.5)', borderRadius:8, marginTop:6 }}>{c.nota}</div>}
    </div>
  );
}

export default function CuentasBancarias() {
  const [cuentas,  setCuentas]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState(null);     // null = formulario cerrado
  const [editId,   setEditId]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [ocupado,  setOcupado]  = useState(null);
  const [archivo,  setArchivo]  = useState(null);     // logo nuevo por subir
  const [preview,  setPreview]  = useState(null);     // logo que se ve en el formulario (nuevo o guardado)
  const formRef = useRef();
  const fileRef = useRef();

  // Liberar la vista previa local al cambiarla
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const elegirArchivo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('El archivo debe ser una imagen'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`La imagen pesa más de ${MAX_MB}MB`); return; }
    setArchivo(file);
    setPreview(URL.createObjectURL(file));
  };
  const quitarImagen = () => {
    setArchivo(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const load = useCallback(async () => {
    try {
      const res = await API.get('/metodos-pago');
      setCuentas(Array.isArray(res.data) ? res.data : []);
    } catch { toast.error('Error cargando las cuentas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const abrir = (c = null) => {
    setEditId(c?.id ?? null);
    setForm(c
      ? { nombre: c.nombre, icono: c.icono || '💳', color: c.color || '', moneda: c.moneda, pais: c.pais || '', nota: c.nota || '', presencial: !!c.presencial, pedir_titular: !!c.pedir_titular, activo: !!c.activo, campos: (c.campos || []).map(x => ({ ...x })) }
      : { ...VACIO, campos: VACIO.campos.map(x => ({ ...x })) });
    setArchivo(null); setPreview(c?.imagen_url || null);
    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const cerrar = () => { setForm(null); setEditId(null); setArchivo(null); setPreview(null); };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setCampo = (i, k, v) => setForm(p => ({ ...p, campos: p.campos.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const quitarCampo = (i) => setForm(p => ({ ...p, campos: p.campos.filter((_, j) => j !== i) }));
  const agregarCampo = () => setForm(p => ({ ...p, campos: [...p.campos, { label: '', valor: '' }] }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('Escribe el nombre de la cuenta'); return; }
    const campos = form.campos.filter(c => c.label.trim() && c.valor.trim());
    if (!campos.length) { toast.error('Agrega al menos un dato de la cuenta con su valor'); return; }
    setSaving(true);
    try {
      const body = { ...form, campos, color: form.color || null };
      const res = editId ? await API.put(`/metodos-pago/${editId}`, body) : await API.post('/metodos-pago', body);
      // El logo va aparte: se sube si eligió uno nuevo, se quita si lo borró
      const id = res.data.id;
      try {
        if (archivo) {
          const fd = new FormData();
          fd.append('imagen', archivo);
          await API.post(`/metodos-pago/${id}/imagen`, fd);
        } else if (!preview && res.data.imagen_url) {
          await API.delete(`/metodos-pago/${id}/imagen`);
        }
      } catch (err) {
        toast.error(`La cuenta se guardó, pero la imagen no: ${err.response?.data?.error || 'error al subirla'}`);
      }
      toast.success(editId ? '✅ Cuenta actualizada: ya sale así en la página del cliente' : '✅ Cuenta agregada');
      cerrar();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const cambiarActivo = async (c) => {
    setOcupado(c.id);
    try {
      await API.patch(`/metodos-pago/${c.id}/activo`, { activo: !c.activo });
      setCuentas(l => l.map(x => (x.id === c.id ? { ...x, activo: !c.activo } : x)));
      toast.info(c.activo ? `${c.nombre} ya no se muestra a los clientes` : `${c.nombre} vuelve a mostrarse`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo cambiar');
    } finally { setOcupado(null); }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la cuenta "${c.nombre}"? Dejará de salir en la página y en el bot. Si solo quieres pausarla, usa "Ocultar".`)) return;
    setOcupado(c.id);
    try {
      await API.delete(`/metodos-pago/${c.id}`);
      setCuentas(l => l.filter(x => x.id !== c.id));
      if (editId === c.id) cerrar();
      toast.success('Cuenta eliminada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo eliminar');
    } finally { setOcupado(null); }
  };

  const mover = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= cuentas.length) return;
    const nueva = [...cuentas];
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    setCuentas(nueva);
    try { await API.put('/metodos-pago/orden', { ids: nueva.map(c => c.id) }); }
    catch { toast.error('No se pudo guardar el orden'); load(); }
  };

  const activas = cuentas.filter(c => c.activo).length;

  return (
    <Layout title="CUENTAS BANCARIAS">

      <div style={{ marginBottom:20 }}>
        <p style={{ fontSize:'.82rem', color:'var(--jordyn-muted)', margin:0, lineHeight:1.6 }}>
          <i className="bi bi-info-circle me-1"></i>
          Estas son las cuentas donde te pagan los clientes. Lo que guardes aquí es lo que sale en la <strong>página del cliente</strong> (al
          elegir el método de pago y en la sección "Cuentas bancarias") y lo que el <strong>bot de WhatsApp</strong> envía al cobrar.
          Los cambios se ven al instante; el cliente solo tiene que recargar la página.
        </p>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:'.95rem', color:'var(--jordyn-text)' }}>
          {cuentas.length} cuenta{cuentas.length === 1 ? '' : 's'}
          <span style={{ fontWeight:600, fontSize:'.75rem', color:'var(--jordyn-muted)', marginLeft:8 }}>{activas} visible{activas === 1 ? '' : 's'} para los clientes</span>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <a href="/#pagos-sec" target="_blank" rel="noreferrer" className="btn-jordyn-outline" style={{ fontSize:'.78rem', textDecoration:'none' }}>
            <i className="bi bi-box-arrow-up-right me-1"></i>Ver en la página
          </a>
          {!form && (
            <button className="btn-jordyn" style={{ fontSize:'.82rem' }} onClick={() => abrir()}>
              <i className="bi bi-plus-circle me-1"></i>Agregar cuenta
            </button>
          )}
        </div>
      </div>

      {/* ─── Formulario ─── */}
      {form && (
        <form ref={formRef} onSubmit={guardar} className="jd-card jd-card-primary fade-in" style={{ marginBottom:20, scrollMarginTop:80 }}>
          <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--jordyn-primary-d)', marginBottom:16 }}>
            <i className={`bi ${editId ? 'bi-pencil-fill' : 'bi-plus-circle-fill'} me-2`}></i>
            {editId ? `Editar ${form.nombre || 'cuenta'}` : 'Nueva cuenta'}
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-8">
              <div className="row g-3">
                <div className="col-12 col-md-7">
                  <label className="jd-label">NOMBRE *</label>
                  <input className="jd-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Bancolombia, Nequi, Pago Móvil, Zelle" maxLength={40} autoFocus />
                  <div style={{ fontSize:'.66rem', color:'var(--jordyn-muted)', marginTop:4 }}>Así lo elige el cliente y así lo nombra el bot.</div>
                </div>
                <div className="col-12 col-md-5">
                  <label className="jd-label">SE COBRA EN</label>
                  <select className="jd-select" value={form.moneda} onChange={e => set('moneda', e.target.value)}>
                    {Object.entries(MONEDAS).map(([k, m]) => <option key={k} value={k}>{m.nombre}</option>)}
                  </select>
                  <div style={{ fontSize:'.66rem', color:'var(--jordyn-muted)', marginTop:4 }}>
                    {MONEDAS[form.moneda].ayuda}{form.moneda !== 'COP' && <> <Link to="/tasas" style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>Ver tasas</Link></>}
                  </div>
                </div>

                <div className="col-12 col-md-7">
                  <label className="jd-label">PAÍS / DESCRIPCIÓN</label>
                  <input className="jd-input" value={form.pais} onChange={e => set('pais', e.target.value)} placeholder="Ej: 🇨🇴 Colombia" maxLength={60} />
                </div>
                <div className="col-12 col-md-5">
                  <label className="jd-label">IMAGEN (opcional)</label>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                    <button type="button" onClick={() => fileRef.current?.click()} aria-label={preview ? 'Cambiar imagen' : 'Subir imagen'}
                      style={{ width:56, height:56, flexShrink:0, borderRadius:10, cursor:'pointer', overflow:'hidden', padding:0,
                        background:'#fff', border:'2px dashed var(--jordyn-border2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {preview
                        ? <img src={preview} alt="Logo de la cuenta" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                        : <i className="bi bi-cloud-arrow-up-fill" style={{ fontSize:'1.3rem', color:'var(--jordyn-primary)' }}></i>}
                    </button>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-start' }}>
                      <button type="button" className="btn-jordyn-outline" style={{ fontSize:'.7rem', padding:'5px 10px' }} onClick={() => fileRef.current?.click()}>
                        <i className="bi bi-image me-1"></i>{preview ? 'Cambiar imagen' : 'Subir imagen'}
                      </button>
                      {preview && (
                        <button type="button" className="btn-jordyn-danger" style={{ fontSize:'.7rem', padding:'5px 10px' }} onClick={quitarImagen}>
                          <i className="bi bi-x-lg me-1"></i>Quitar
                        </button>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => elegirArchivo(e.target.files?.[0])} />
                  </div>
                  <div style={{ fontSize:'.66rem', color:'var(--jordyn-muted)', marginBottom:10 }}>
                    El logo del banco o la app (máx {MAX_MB}MB). Si no subes imagen, se muestra el ícono de abajo.
                  </div>
                  <label className="jd-label">ÍCONO Y COLOR</label>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input className="jd-input" value={form.icono} onChange={e => set('icono', e.target.value)} maxLength={8} style={{ width:64, textAlign:'center', fontSize:'1.1rem' }} aria-label="Ícono (emoji)" />
                    <input type="color" value={form.color || COLOR_DEFECTO} onChange={e => set('color', e.target.value)} aria-label="Color de la tarjeta"
                      style={{ width:44, height:40, padding:2, border:'1.5px solid var(--jordyn-border)', borderRadius:8, background:'#fff', cursor:'pointer' }} />
                    {form.color && (
                      <button type="button" className="btn-jordyn-outline" style={{ fontSize:'.68rem', padding:'6px 9px' }} onClick={() => set('color', '')} title="Volver al color automático">Auto</button>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                    {ICONOS.map(ic => (
                      <button key={ic} type="button" onClick={() => set('icono', ic)}
                        style={{ border:`1.5px solid ${form.icono === ic ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, background:'#fff', borderRadius:6, padding:'1px 5px', cursor:'pointer', fontSize:'.95rem' }}>{ic}</button>
                    ))}
                  </div>
                </div>

                {/* Datos de la cuenta */}
                <div className="col-12">
                  <label className="jd-label">DATOS DE LA CUENTA * <span style={{ fontWeight:500, textTransform:'none', letterSpacing:0 }}>(lo que el cliente necesita para pagarte)</span></label>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {form.campos.map((c, i) => (
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <input className="jd-input" value={c.label} onChange={e => setCampo(i, 'label', e.target.value)} placeholder="Dato (Banco, Titular…)" maxLength={40} style={{ flex:'0 0 38%' }} aria-label={`Nombre del dato ${i + 1}`} />
                        <input className="jd-input" value={c.valor} onChange={e => setCampo(i, 'valor', e.target.value)} placeholder="Valor" maxLength={160} style={{ flex:1, fontWeight:700 }} aria-label={`Valor del dato ${i + 1}`} />
                        <button type="button" className="btn-jordyn-danger" onClick={() => quitarCampo(i)} disabled={form.campos.length === 1}
                          style={{ padding:'8px 10px', fontSize:'.75rem' }} title="Quitar este dato" aria-label="Quitar este dato"><i className="bi bi-x-lg"></i></button>
                      </div>
                    ))}
                  </div>
                  {form.campos.length < 10 && (
                    <button type="button" className="btn-jordyn-outline" onClick={agregarCampo} style={{ fontSize:'.74rem', marginTop:8 }}>
                      <i className="bi bi-plus me-1"></i>Agregar dato
                    </button>
                  )}
                </div>

                <div className="col-12">
                  <label className="jd-label">NOTA PARA EL CLIENTE (opcional)</label>
                  <input className="jd-input" value={form.nota} onChange={e => set('nota', e.target.value)} placeholder="Ej: ⚠️ Solo de Nequi a Nequi" maxLength={160} />
                </div>

                <div className="col-12" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                    <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} style={{ width:18, height:18, accentColor:'var(--jordyn-primary)' }} />
                    Mostrar a los clientes
                  </label>
                  <label style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                    <input type="checkbox" checked={form.presencial} onChange={e => set('presencial', e.target.checked)} style={{ width:18, height:18, marginTop:2, accentColor:'var(--jordyn-primary)' }} />
                    <span>Pago en persona (efectivo)
                      <span style={{ display:'block', fontSize:'.68rem', fontWeight:500, color:'var(--jordyn-muted)' }}>El bot no cobra con este método: le avisa a una persona para que lo coordine.</span>
                    </span>
                  </label>
                  <label style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                    <input type="checkbox" checked={!!form.pedir_titular} onChange={e => set('pedir_titular', e.target.checked)} style={{ width:18, height:18, marginTop:2, accentColor:'var(--jordyn-primary)' }} />
                    <span>Pedir el nombre de quien envía el pago
                      <span style={{ display:'block', fontSize:'.68rem', fontWeight:500, color:'var(--jordyn-muted)' }}>Útil en Zelle: el cliente escribe quién hizo la transferencia (en la página y con el bot) y lo ves en Reservas.</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Vista previa */}
            <div className="col-12 col-lg-4">
              <label className="jd-label">ASÍ LO VE EL CLIENTE</label>
              <VistaCliente c={{ ...form, imagen_url: preview }} />
            </div>
          </div>

          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:20 }}>
            <button type="submit" className="btn-jordyn" disabled={saving} style={{ fontSize:'.85rem' }}>
              {saving
                ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando...</>
                : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Guardar cambios' : 'Agregar cuenta'}</>}
            </button>
            <button type="button" className="btn-jordyn-outline" onClick={cerrar} disabled={saving} style={{ fontSize:'.85rem' }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ─── Lista ─── */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : cuentas.length === 0 ? (
        <div className="jd-alert jd-alert-warning">
          <i className="bi bi-exclamation-triangle-fill"></i>
          No hay cuentas cargadas: los clientes no tienen dónde pagar. Agrega la primera con el botón de arriba.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:16 }}>
          {cuentas.map((c, i) => (
            <div key={c.id} className="jd-card fade-in" style={{ padding:12, display:'flex', flexDirection:'column', gap:10, opacity: c.activo ? 1 : 0.6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:'.6rem', fontWeight:800, padding:'2px 8px', borderRadius:20, background:'var(--jordyn-bg2)', color:'var(--jordyn-primary-d)' }}>
                  {MONEDAS[c.moneda]?.corto || c.moneda}
                </span>
                {c.presencial && <span style={{ fontSize:'.6rem', fontWeight:800, padding:'2px 8px', borderRadius:20, background:'rgba(240,165,0,.12)', color:'#a07000' }}>EN PERSONA</span>}
                {c.pedir_titular && <span style={{ fontSize:'.6rem', fontWeight:800, padding:'2px 8px', borderRadius:20, background:'rgba(67,97,238,.1)', color:'#4361ee' }}>PIDE QUIÉN ENVÍA</span>}
                {!c.activo && <span style={{ fontSize:'.6rem', fontWeight:800, padding:'2px 8px', borderRadius:20, background:'rgba(0,0,0,.7)', color:'#fff' }}><i className="bi bi-eye-slash-fill me-1"></i>OCULTA</span>}
                <span style={{ marginLeft:'auto', display:'flex', gap:4 }}>
                  <button className="btn-jordyn-outline" onClick={() => mover(i, -1)} disabled={i === 0} style={{ padding:'3px 8px', fontSize:'.7rem' }} title="Subir" aria-label="Subir"><i className="bi bi-arrow-up"></i></button>
                  <button className="btn-jordyn-outline" onClick={() => mover(i, 1)} disabled={i === cuentas.length - 1} style={{ padding:'3px 8px', fontSize:'.7rem' }} title="Bajar" aria-label="Bajar"><i className="bi bi-arrow-down"></i></button>
                </span>
              </div>

              <VistaCliente c={c} />

              <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)' }}><i className="bi bi-clock me-1"></i>Actualizada: {fmtFecha(c.updated_at)}</div>

              <div style={{ display:'flex', gap:6, marginTop:'auto' }}>
                <button className="btn-jordyn-outline" onClick={() => abrir(c)} disabled={ocupado === c.id} style={{ flex:1, fontSize:'.74rem', padding:'7px 8px' }}>
                  <i className="bi bi-pencil-fill me-1"></i>Editar
                </button>
                <button className="btn-jordyn-outline" onClick={() => cambiarActivo(c)} disabled={ocupado === c.id} style={{ fontSize:'.74rem', padding:'7px 10px' }}
                  title={c.activo ? 'Ocultar a los clientes' : 'Mostrar a los clientes'} aria-label={c.activo ? 'Ocultar a los clientes' : 'Mostrar a los clientes'}>
                  <i className={`bi ${c.activo ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                </button>
                <button className="btn-jordyn-danger" onClick={() => eliminar(c)} disabled={ocupado === c.id} style={{ fontSize:'.74rem', padding:'7px 10px' }} title="Eliminar" aria-label="Eliminar">
                  <i className="bi bi-trash-fill"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
