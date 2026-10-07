// ============================================================
//   Resultados.js — RESUELVE TU SEMANA
//   ✅ Publicar la imagen del resultado de cada sorteo
//   ✅ Sale en la página del cliente (sección Resultados)
//   ✅ El bot la envía al grupo de WhatsApp
//   ✅ Las imágenes se guardan en Cloudinary
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const VACIO = { titulo: '', descripcion: '', rifa_id: '', fecha: '', visible: true, enviar_grupo: true };
const MAX_MB = 10;

const fmtFecha = (f) => {
  if (!f) return null;
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
};
const fmtCuando = (f) => f ? new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Caracas' }) : null;
const miniatura = (url) => (url && url.includes('/upload/') ? url.replace('/upload/', '/upload/f_auto,q_auto,c_fill,g_auto,w_500,h_500/') : url);

export default function Resultados() {
  const [lista,    setLista]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [archivo,  setArchivo]  = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [ocupado,  setOcupado]  = useState(null);
  const [sorteos,  setSorteos]  = useState([]);
  const fileRef = useRef();
  const formRef = useRef();

  const load = useCallback(async () => {
    try { setLista((await API.get('/resultados/admin')).data); }
    catch { toast.error('Error cargando los resultados'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    API.get('/wa-chat/resultados', { params: { dias: 60 } }).then((r) => setSorteos(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const elegirArchivo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('El archivo debe ser una imagen'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`La imagen pesa más de ${MAX_MB}MB`); return; }
    setArchivo(file);
    setPreview(URL.createObjectURL(file));
  };

  // Al elegir el sorteo se completan el título y la fecha (sin pisar lo escrito)
  const elegirSorteo = (id) => {
    const s = sorteos.find((x) => x.id === id);
    if (!s) { set('rifa_id', ''); return; }
    setForm((p) => ({ ...p, rifa_id: s.id, titulo: p.titulo || `Resultado ${s.nombre}`, fecha: s.fecha_sorteo || p.fecha }));
  };

  const limpiar = () => {
    setForm(VACIO); setEditando(null); setArchivo(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const editar = (r) => {
    setEditando(r);
    setForm({ titulo: r.titulo || '', descripcion: r.descripcion || '', rifa_id: r.rifa_id || '', fecha: r.fecha || '', visible: r.visible, enviar_grupo: false });
    setArchivo(null); setPreview(r.imagen_url);
    if (fileRef.current) fileRef.current.value = '';
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast.error('Escribe el título del resultado'); return; }
    if (!editando && !archivo) { toast.error('Sube la imagen del resultado'); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (archivo) fd.append('imagen', archivo);
    setSaving(true);
    try {
      if (editando) {
        await API.put(`/resultados/${editando.id}`, fd);
        toast.success('✅ Resultado actualizado');
      } else {
        const r = await API.post('/resultados', fd);
        toast.success('📣 Resultado publicado en la página');
        if (r.data.grupo?.ok) toast.success('También se envió al grupo de WhatsApp');
        else if (r.data.grupo) toast.warning(`No se pudo enviar al grupo: ${r.data.grupo.error}. Puedes reintentarlo con el botón de WhatsApp.`, { autoClose: 9000 });
      }
      limpiar(); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const enviarGrupo = async (r) => {
    if (!window.confirm(`¿${r.enviado_grupo ? 'Volver a enviar' : 'Enviar'} "${r.titulo}" al grupo de WhatsApp? Lo verán todos los miembros.`)) return;
    setOcupado(r.id);
    try {
      const res = await API.post(`/resultados/${r.id}/enviar-grupo`);
      setLista((l) => l.map((x) => (x.id === r.id ? res.data : x)));
      toast.success('📣 Enviado al grupo');
    } catch (err) { toast.error(err.response?.data?.error || 'No se pudo enviar al grupo'); }
    finally { setOcupado(null); }
  };

  const cambiarVisible = async (r) => {
    setOcupado(r.id);
    try {
      await API.patch(`/resultados/${r.id}/visible`, { visible: !r.visible });
      setLista((l) => l.map((x) => (x.id === r.id ? { ...x, visible: !r.visible } : x)));
    } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cambiar'); }
    finally { setOcupado(null); }
  };

  const eliminar = async (r) => {
    if (!window.confirm(`¿Eliminar "${r.titulo}"? Se borra también su imagen. (Si ya se envió al grupo, allá no se borra.)`)) return;
    setOcupado(r.id);
    try {
      await API.delete(`/resultados/${r.id}`);
      setLista((l) => l.filter((x) => x.id !== r.id));
      if (editando?.id === r.id) limpiar();
      toast.success('Resultado eliminado');
    } catch (err) { toast.error(err.response?.data?.error || 'No se pudo eliminar'); }
    finally { setOcupado(null); }
  };

  const visibles = lista.filter((r) => r.visible).length;

  return (
    <Layout title="RESULTADOS">

      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:'.82rem', color:'var(--jordyn-muted)', margin:0, lineHeight:1.6 }}>
          <i className="bi bi-info-circle me-1"></i>
          Publica aquí la <strong>imagen del resultado</strong> de cada sorteo. Sale en la página del cliente, en la sección Resultados,
          y el bot la envía al <strong>grupo de WhatsApp</strong>. El número ganador que el bot usa para responder "¿qué cayó?"
          se sigue cargando en <Link to="/whatsapp" style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>WhatsApp → Resultados</Link>.
        </p>
      </div>

      {/* ─── Formulario ─── */}
      <form ref={formRef} onSubmit={guardar} className="jd-card jd-card-primary fade-in" style={{ marginBottom:24, scrollMarginTop:80 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ width:48, height:48, borderRadius:12, flexShrink:0, background:'rgba(10,191,188,.12)', border:'2px solid rgba(10,191,188,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem' }}>📣</div>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--jordyn-primary-d)' }}>{editando ? `Editando: ${editando.titulo}` : 'Nuevo resultado'}</div>
            <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginTop:2 }}>Solo el título y la imagen son obligatorios.</div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="jd-label">IMAGEN DEL RESULTADO</label>
            <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); elegirArchivo(e.dataTransfer.files?.[0]); }}
              style={{ position:'relative', cursor:'pointer', borderRadius:12, overflow:'hidden', aspectRatio:'1 / 1', maxHeight:320, width:'100%', background:'var(--jordyn-bg2)', border:'2px dashed var(--jordyn-border2)', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
              {preview ? (
                <img src={preview} alt="Vista previa" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', background:'#0d1e1e' }} />
              ) : (
                <div style={{ padding:16, color:'var(--jordyn-muted)' }}>
                  <i className="bi bi-cloud-arrow-up-fill" style={{ fontSize:'2rem', color:'var(--jordyn-primary)' }}></i>
                  <div style={{ fontSize:'.8rem', fontWeight:700, marginTop:6 }}>Toca para subir la imagen</div>
                  <div style={{ fontSize:'.66rem', marginTop:2 }}>JPG, PNG o WEBP · máx {MAX_MB}MB</div>
                </div>
              )}
              {preview && (
                <span style={{ position:'absolute', bottom:8, left:8, right:8, padding:'6px 8px', borderRadius:8, background:'rgba(0,0,0,.6)', color:'#fff', fontSize:'.68rem', fontWeight:700 }}>
                  <i className="bi bi-arrow-repeat me-1"></i>Cambiar imagen
                </span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => elegirArchivo(e.target.files?.[0])} />
          </div>

          <div className="col-12 col-md-8">
            <div className="row g-3">
              <div className="col-12">
                <label className="jd-label">SORTEO <span style={{ fontWeight:500, textTransform:'none', letterSpacing:0 }}>(opcional — completa el título y la fecha)</span></label>
                <select className="jd-select" value={form.rifa_id} onChange={(e) => elegirSorteo(e.target.value)}>
                  <option value="">— Sin enlazar a un sorteo —</option>
                  {form.rifa_id && !sorteos.some((s) => s.id === form.rifa_id) && <option value={form.rifa_id}>Sorteo anterior</option>}
                  {sorteos.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre} · {fmtFecha(s.fecha_sorteo)}{s.resultados?.length ? ` · cayó ${s.resultados.map((x) => x.numero).join(', ')}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-8">
                <label className="jd-label">TÍTULO *</label>
                <input className="jd-input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej: Resultado Miércoles de Resuelve" maxLength={160} />
              </div>
              <div className="col-12 col-md-4">
                <label className="jd-label">FECHA DEL SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
              </div>
              <div className="col-12">
                <label className="jd-label">DESCRIPCIÓN (opcional)</label>
                <textarea className="jd-input" rows={2} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} maxLength={600}
                  placeholder="Ej: Cayó el 045 con la Lotería del Táchira. ¡Felicidades al ganador!" style={{ resize:'vertical' }} />
              </div>
              <div className="col-12" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.visible} onChange={(e) => set('visible', e.target.checked)} style={{ width:18, height:18, accentColor:'var(--jordyn-primary)' }} />
                  Mostrar en la página del cliente
                </label>
                {!editando && (
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                    <input type="checkbox" checked={form.enviar_grupo} onChange={(e) => set('enviar_grupo', e.target.checked)} style={{ width:18, height:18, accentColor:'#25D366' }} />
                    <span><i className="bi bi-whatsapp me-1" style={{ color:'#25D366' }}></i>Enviar al grupo de WhatsApp al publicar</span>
                  </label>
                )}
              </div>
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:20 }}>
              <button type="submit" className="btn-jordyn" disabled={saving} style={{ fontSize:'.85rem' }}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Publicando...</>
                  : editando ? <><i className="bi bi-floppy-fill me-1"></i>Guardar cambios</> : <><i className="bi bi-megaphone-fill me-1"></i>Publicar resultado</>}
              </button>
              {(editando || archivo || form.titulo) && (
                <button type="button" className="btn-jordyn-outline" onClick={limpiar} disabled={saving} style={{ fontSize:'.85rem' }}>Cancelar</button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ─── Lista ─── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:'.95rem', color:'var(--jordyn-text)' }}>
          Resultados publicados
          <span style={{ fontWeight:600, fontSize:'.75rem', color:'var(--jordyn-muted)', marginLeft:8 }}>{lista.length} en total · {visibles} visible{visibles === 1 ? '' : 's'} en la página</span>
        </div>
        <a href="/#resultados-sec" target="_blank" rel="noreferrer" className="btn-jordyn-outline" style={{ fontSize:'.75rem', textDecoration:'none' }}>
          <i className="bi bi-box-arrow-up-right me-1"></i>Ver en la página
        </a>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width:40, height:40 }}></div></div>
      ) : lista.length === 0 ? (
        <div className="jd-alert jd-alert-info">
          <i className="bi bi-megaphone"></i>
          Todavía no hay resultados. Sube el primero con el formulario de arriba.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:16 }}>
          {lista.map((r) => (
            <div key={r.id} className="jd-card fade-in" style={{ padding:0, overflow:'hidden', opacity: r.visible ? 1 : 0.6 }}>
              <div style={{ position:'relative', aspectRatio:'1 / 1', background:'#0d1e1e' }}>
                <img src={miniatura(r.imagen_url)} alt={r.titulo} loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                {!r.visible && (
                  <span style={{ position:'absolute', top:8, left:8, padding:'3px 10px', borderRadius:20, background:'rgba(0,0,0,.7)', color:'#fff', fontSize:'.65rem', fontWeight:700 }}><i className="bi bi-eye-slash-fill me-1"></i>Oculto</span>
                )}
                {r.enviado_grupo && (
                  <span title={`Enviado al grupo: ${fmtCuando(r.enviado_grupo)}`} style={{ position:'absolute', top:8, right:8, padding:'3px 9px', borderRadius:20, background:'#25D366', color:'#fff', fontSize:'.65rem', fontWeight:700 }}><i className="bi bi-check2-all me-1"></i>En el grupo</span>
                )}
              </div>
              <div style={{ padding:'12px 14px' }}>
                <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.titulo}</div>
                <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginTop:2, minHeight:16 }}>{fmtFecha(r.fecha) || 'Sin fecha'}</div>
                <div style={{ display:'flex', gap:6, marginTop:10 }}>
                  <button className="btn-jordyn-outline" onClick={() => editar(r)} disabled={ocupado === r.id} style={{ flex:1, fontSize:'.72rem', padding:'6px 8px' }}>
                    <i className="bi bi-pencil-fill me-1"></i>Editar
                  </button>
                  <button onClick={() => enviarGrupo(r)} disabled={ocupado === r.id} title={r.enviado_grupo ? 'Volver a enviar al grupo de WhatsApp' : 'Enviar al grupo de WhatsApp'} aria-label="Enviar al grupo de WhatsApp"
                    style={{ background:'rgba(37,211,102,.1)', border:'1.5px solid rgba(37,211,102,.5)', color:'#128c7e', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:'.78rem' }}>
                    <i className="bi bi-whatsapp"></i>
                  </button>
                  <button className="btn-jordyn-outline" onClick={() => cambiarVisible(r)} disabled={ocupado === r.id} style={{ fontSize:'.72rem', padding:'6px 10px' }}
                    title={r.visible ? 'Ocultar de la página' : 'Mostrar en la página'} aria-label={r.visible ? 'Ocultar de la página' : 'Mostrar en la página'}>
                    <i className={`bi ${r.visible ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                  </button>
                  <button className="btn-jordyn-danger" onClick={() => eliminar(r)} disabled={ocupado === r.id} style={{ fontSize:'.72rem', padding:'6px 10px' }} title="Eliminar" aria-label="Eliminar">
                    <i className="bi bi-trash-fill"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
