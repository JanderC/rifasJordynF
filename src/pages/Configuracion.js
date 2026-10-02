// ============================================================
//   Configuracion.js — RESUELVE TU SEMANA
//   ✅ Ganadores — foto + datos de cada ganador; salen en la
//      página pública del cliente como galería
//   ✅ Las fotos se guardan en Cloudinary
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const VACIO = { nombre: '', premio: '', numero: '', rifa: '', ciudad: '', fecha: '', visible: true };
const MAX_MB = 10;

const fmtFecha = (f) => {
  if (!f) return null;
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
};

const miniatura = (url) => (url && url.includes('/upload/') ? url.replace('/upload/', '/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_500/') : url);

export default function Configuracion() {
  const [ganadores, setGanadores] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState(VACIO);
  const [editando,  setEditando]  = useState(null);   // ganador en edición (null = nuevo)
  const [archivo,   setArchivo]   = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [ocupado,   setOcupado]   = useState(null);   // id con una acción en curso
  const fileRef = useRef();
  const formRef = useRef();

  const load = useCallback(async () => {
    try {
      const res = await API.get('/ganadores/admin');
      setGanadores(res.data);
    } catch { toast.error('Error cargando los ganadores'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Liberar la vista previa local al cambiarla
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const elegirArchivo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('El archivo debe ser una imagen'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`La imagen pesa más de ${MAX_MB}MB`); return; }
    setArchivo(file);
    setPreview(URL.createObjectURL(file));
  };

  const limpiar = () => {
    setForm(VACIO); setEditando(null); setArchivo(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const editar = (g) => {
    setEditando(g);
    setForm({ nombre: g.nombre || '', premio: g.premio || '', numero: g.numero || '', rifa: g.rifa || '', ciudad: g.ciudad || '', fecha: g.fecha || '', visible: g.visible });
    setArchivo(null); setPreview(g.imagen_url);
    if (fileRef.current) fileRef.current.value = '';
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('Escribe el nombre del ganador'); return; }
    if (!editando && !archivo) { toast.error('Sube la foto del ganador'); return; }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (archivo) fd.append('imagen', archivo);

    setSaving(true);
    try {
      if (editando) await API.put(`/ganadores/${editando.id}`, fd);
      else          await API.post('/ganadores', fd);
      toast.success(editando ? '✅ Ganador actualizado' : '🏆 Ganador publicado');
      limpiar();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const cambiarVisible = async (g) => {
    setOcupado(g.id);
    try {
      await API.patch(`/ganadores/${g.id}/visible`, { visible: !g.visible });
      setGanadores((l) => l.map((x) => (x.id === g.id ? { ...x, visible: !g.visible } : x)));
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo cambiar');
    } finally { setOcupado(null); }
  };

  const eliminar = async (g) => {
    if (!window.confirm(`¿Eliminar a ${g.nombre} de los ganadores? Se borra también su foto.`)) return;
    setOcupado(g.id);
    try {
      await API.delete(`/ganadores/${g.id}`);
      setGanadores((l) => l.filter((x) => x.id !== g.id));
      if (editando?.id === g.id) limpiar();
      toast.success('Ganador eliminado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo eliminar');
    } finally { setOcupado(null); }
  };

  const visibles = ganadores.filter((g) => g.visible).length;

  return (
    <Layout title="CONFIGURACIÓN">

      {/* Descripción */}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:'.82rem', color:'var(--jordyn-muted)', margin:0, lineHeight:1.6 }}>
          <i className="bi bi-info-circle me-1"></i>
          Sube aquí los <strong>ganadores</strong> de tus sorteos. Aparecen en la página principal donde los clientes
          compran sus números, como una galería. El más reciente (por fecha del sorteo) sale destacado en grande.
        </p>
      </div>

      {/* ─── Formulario ─── */}
      <form ref={formRef} onSubmit={guardar} className="jd-card jd-card-gold fade-in" style={{ marginBottom:24, scrollMarginTop:80 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{
            width:48, height:48, borderRadius:12, flexShrink:0,
            background:'rgba(240,165,0,.12)', border:'2px solid rgba(240,165,0,.3)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem',
          }}>🏆</div>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--jordyn-gold2)' }}>
              {editando ? `Editando a ${editando.nombre}` : 'Nuevo ganador'}
            </div>
            <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginTop:2 }}>
              Solo el nombre y la foto son obligatorios.
            </div>
          </div>
        </div>

        <div className="row g-3">
          {/* Foto */}
          <div className="col-12 col-md-4">
            <label className="jd-label">FOTO DEL GANADOR</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); elegirArchivo(e.dataTransfer.files?.[0]); }}
              style={{
                position:'relative', cursor:'pointer', borderRadius:12, overflow:'hidden',
                aspectRatio:'4 / 5', maxHeight:340, width:'100%',
                background:'var(--jordyn-bg2)', border:'2px dashed var(--jordyn-border2)',
                display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center',
              }}
            >
              {preview ? (
                <img src={preview} alt="Vista previa" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                <div style={{ padding:16, color:'var(--jordyn-muted)' }}>
                  <i className="bi bi-cloud-arrow-up-fill" style={{ fontSize:'2rem', color:'var(--jordyn-primary)' }}></i>
                  <div style={{ fontSize:'.8rem', fontWeight:700, marginTop:6 }}>Toca para subir la foto</div>
                  <div style={{ fontSize:'.66rem', marginTop:2 }}>JPG, PNG o WEBP · máx {MAX_MB}MB</div>
                </div>
              )}
              {preview && (
                <span style={{
                  position:'absolute', bottom:8, left:8, right:8, padding:'6px 8px', borderRadius:8,
                  background:'rgba(0,0,0,.6)', color:'#fff', fontSize:'.68rem', fontWeight:700,
                }}>
                  <i className="bi bi-arrow-repeat me-1"></i>Cambiar foto
                </span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => elegirArchivo(e.target.files?.[0])} />
          </div>

          {/* Datos */}
          <div className="col-12 col-md-8">
            <div className="row g-3">
              <div className="col-12 col-md-7">
                <label className="jd-label">NOMBRE DEL GANADOR *</label>
                <input className="jd-input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: María Pérez" maxLength={200} />
              </div>
              <div className="col-12 col-md-5">
                <label className="jd-label">NÚMERO GANADOR</label>
                <input className="jd-input" value={form.numero} onChange={(e) => set('numero', e.target.value)} placeholder="Ej: 045" maxLength={10} inputMode="numeric" />
              </div>
              <div className="col-12">
                <label className="jd-label">PREMIO</label>
                <input className="jd-input" value={form.premio} onChange={(e) => set('premio', e.target.value)} placeholder="Ej: Moto Bera SBR 2026" maxLength={200} />
              </div>
              <div className="col-12 col-md-6">
                <label className="jd-label">RIFA / SORTEO</label>
                <input className="jd-input" value={form.rifa} onChange={(e) => set('rifa', e.target.value)} placeholder="Ej: Rifa del miércoles" maxLength={200} />
              </div>
              <div className="col-12 col-md-6">
                <label className="jd-label">CIUDAD</label>
                <input className="jd-input" value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} placeholder="Ej: San Cristóbal" maxLength={200} />
              </div>
              <div className="col-12 col-md-6">
                <label className="jd-label">FECHA DEL SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
              </div>
              <div className="col-12 col-md-6" style={{ display:'flex', alignItems:'flex-end' }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer', paddingBottom:10 }}>
                  <input type="checkbox" checked={form.visible} onChange={(e) => set('visible', e.target.checked)} style={{ width:18, height:18, accentColor:'var(--jordyn-primary)' }} />
                  Mostrar en la página pública
                </label>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:20 }}>
              <button type="submit" className="btn-jordyn" disabled={saving} style={{ fontSize:'.85rem' }}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Subiendo...</>
                  : editando
                    ? <><i className="bi bi-floppy-fill me-1"></i>Guardar cambios</>
                    : <><i className="bi bi-trophy-fill me-1"></i>Publicar ganador</>
                }
              </button>
              {(editando || archivo || form.nombre) && (
                <button type="button" className="btn-jordyn-outline" onClick={limpiar} disabled={saving} style={{ fontSize:'.85rem' }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ─── Lista ─── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:'.95rem', color:'var(--jordyn-text)' }}>
          Ganadores cargados
          <span style={{ fontWeight:600, fontSize:'.75rem', color:'var(--jordyn-muted)', marginLeft:8 }}>
            {ganadores.length} en total · {visibles} visible{visibles === 1 ? '' : 's'} en la página
          </span>
        </div>
        <a href="/#ganadores-sec" target="_blank" rel="noreferrer" className="btn-jordyn-outline" style={{ fontSize:'.75rem', textDecoration:'none' }}>
          <i className="bi bi-box-arrow-up-right me-1"></i>Ver en la página
        </a>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : ganadores.length === 0 ? (
        <div className="jd-alert jd-alert-info">
          <i className="bi bi-trophy"></i>
          Todavía no hay ganadores. Sube el primero con el formulario de arriba y aparecerá en la página del cliente.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:16 }}>
          {ganadores.map((g) => (
            <div key={g.id} className="jd-card fade-in" style={{ padding:0, overflow:'hidden', opacity: g.visible ? 1 : 0.6 }}>
              <div style={{ position:'relative', aspectRatio:'4 / 5', background:'var(--jordyn-bg2)' }}>
                <img src={miniatura(g.imagen_url)} alt={g.nombre} loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                {g.numero && (
                  <span style={{
                    position:'absolute', top:8, right:8, padding:'3px 10px', borderRadius:20,
                    background:'var(--jordyn-gold)', color:'#3a2400', fontSize:'.78rem', fontWeight:900,
                  }}>{g.numero}</span>
                )}
                {!g.visible && (
                  <span style={{
                    position:'absolute', top:8, left:8, padding:'3px 10px', borderRadius:20,
                    background:'rgba(0,0,0,.7)', color:'#fff', fontSize:'.65rem', fontWeight:700,
                  }}><i className="bi bi-eye-slash-fill me-1"></i>Oculto</span>
                )}
              </div>
              <div style={{ padding:'12px 14px' }}>
                <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.nombre}</div>
                <div style={{ fontSize:'.74rem', color:'var(--jordyn-gold2)', fontWeight:700, minHeight:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.premio || '—'}</div>
                <div style={{ fontSize:'.66rem', color:'var(--jordyn-muted)', marginTop:2, minHeight:16 }}>
                  {[g.ciudad, fmtFecha(g.fecha)].filter(Boolean).join(' · ')}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:10 }}>
                  <button className="btn-jordyn-outline" onClick={() => editar(g)} disabled={ocupado === g.id}
                    style={{ flex:1, fontSize:'.72rem', padding:'6px 8px' }} title="Editar">
                    <i className="bi bi-pencil-fill me-1"></i>Editar
                  </button>
                  <button className="btn-jordyn-outline" onClick={() => cambiarVisible(g)} disabled={ocupado === g.id}
                    style={{ fontSize:'.72rem', padding:'6px 10px' }} title={g.visible ? 'Ocultar de la página' : 'Mostrar en la página'}
                    aria-label={g.visible ? 'Ocultar de la página' : 'Mostrar en la página'}>
                    <i className={`bi ${g.visible ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                  </button>
                  <button className="btn-jordyn-danger" onClick={() => eliminar(g)} disabled={ocupado === g.id}
                    style={{ fontSize:'.72rem', padding:'6px 10px' }} title="Eliminar" aria-label="Eliminar">
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
