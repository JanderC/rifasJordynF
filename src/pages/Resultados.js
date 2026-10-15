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

const VACIO = { titulo: '', descripcion: '', rifa_id: '', fecha: '', visible: true, enviar_grupo: true, numero: '', vendido_por: '', mensaje: '' };
const MAX_MB = 10;

const fmtFecha = (f) => {
  if (!f) return null;
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
};
const fmtCuando = (f) => f ? new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Caracas' }) : null;
// ── Mensaje para el grupo de WhatsApp ──────────────────────────
// Mismo armado que el servidor (routes/resultadosPublicados.js → mensajeResultado)
const DIAS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${DIAS[d.getDay()]} ${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}`;
};
const hora12 = (h) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  if (!m) return '';
  const hh = +m[1];
  return `${((hh + 11) % 12) + 1}:${m[2]} ${hh < 12 ? 'am' : 'pm'}`;
};
function mensajeResultado({ titulo, rifa, fecha, loteria, numero, premio, vendido_por: vendidoPor, descripcion }) {
  const l = [`🎉 *${String(titulo || 'Resultado').toUpperCase()}* 🎉`, ''];
  if (rifa) l.push(`🎟️ Sorteo: *${rifa}*`);
  if (fecha) l.push(`📅 ${fecha}`);
  if (loteria) l.push(`🎰 Lotería: ${loteria}`);
  if (numero) l.push('', `🔢 Número ganador: *${numero}*`);
  if (premio) l.push(`🏆 Premio: ${premio}`);
  if (vendidoPor) l.push(`🤝 Vendido por: *${vendidoPor}*`);
  if (descripcion) l.push('', descripcion);
  l.push('', '¡Felicidades al ganador y gracias a todos por participar! 🍀');
  return l.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Texto con el formato de WhatsApp (*negrita*, _cursiva_) para la vista previa
function TextoWhatsApp({ texto }) {
  return String(texto || '').split('\n').map((linea, i) => (
    <React.Fragment key={i}>
      {linea.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((p, j) => (
        /^\*[^*]+\*$/.test(p) ? <b key={j}>{p.slice(1, -1)}</b>
          : /^_[^_]+_$/.test(p) ? <i key={j}>{p.slice(1, -1)}</i>
          : <React.Fragment key={j}>{p}</React.Fragment>
      ))}
      <br />
    </React.Fragment>
  ));
}

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
  // El mensaje del grupo se arma solo con los datos hasta que el dueño lo edite a mano
  const [mensajeTocado, setMensajeTocado] = useState(false);
  const [vendidoTocado, setVendidoTocado] = useState(false);
  const [sugerencia,    setSugerencia]    = useState(null);   // { numero, vendido_por, opciones, comprador, libre }
  const [buscandoQuien, setBuscandoQuien] = useState(false);
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

  // Sorteo elegido y mensaje armado con todo lo del formulario
  const sorteoSel = sorteos.find((x) => x.id === form.rifa_id) || null;
  // El número con las cifras de la rifa ("5" → "005")
  const cifrasSel = Number(sorteoSel?.cifras) || 0;
  const numeroFmt = form.numero && cifrasSel ? String(form.numero).padStart(cifrasSel, '0').slice(-cifrasSel) : form.numero;
  const mensajeAuto = mensajeResultado({
    titulo: form.titulo, rifa: sorteoSel?.nombre, fecha: fechaLarga(form.fecha),
    loteria: sorteoSel?.loteria_ref ? `${sorteoSel.loteria_ref}${hora12(sorteoSel.hora_sorteo) ? ` · ${hora12(sorteoSel.hora_sorteo)}` : ''}` : null,
    numero: numeroFmt, premio: sorteoSel?.premio, vendido_por: form.vendido_por, descripcion: form.descripcion,
  });
  const mensajeFinal = mensajeTocado ? form.mensaje : mensajeAuto;

  // Con sorteo y número: quién lo vendió (se propone; se puede cambiar)
  useEffect(() => {
    const num = String(form.numero || '').replace(/\D/g, '');
    if (!form.rifa_id || !num) { setSugerencia(null); return undefined; }
    const t = setTimeout(async () => {
      setBuscandoQuien(true);
      try {
        const { data } = await API.get('/resultados/sugerencia', { params: { rifa_id: form.rifa_id, numero: num } });
        setSugerencia(data);
        if (!vendidoTocado && data.vendido_por) setForm((p) => ({ ...p, vendido_por: data.vendido_por }));
      } catch { setSugerencia(null); }
      finally { setBuscandoQuien(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [form.rifa_id, form.numero, vendidoTocado]);

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
    // Si el número ganador ya está cargado en WhatsApp → Resultados, también se toma
    setForm((p) => ({ ...p, rifa_id: s.id, titulo: p.titulo || `Resultado ${s.nombre}`, fecha: s.fecha_sorteo || p.fecha,
      numero: p.numero || s.resultados?.[0]?.numero || '' }));
  };

  const limpiar = () => {
    setForm(VACIO); setEditando(null); setArchivo(null); setPreview(null);
    setMensajeTocado(false); setVendidoTocado(false); setSugerencia(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const editar = (r) => {
    setEditando(r);
    setForm({ titulo: r.titulo || '', descripcion: r.descripcion || '', rifa_id: r.rifa_id || '', fecha: r.fecha || '', visible: r.visible, enviar_grupo: false,
      numero: r.numero || '', vendido_por: r.vendido_por || '', mensaje: r.mensaje || '' });
    setMensajeTocado(!!r.mensaje); setVendidoTocado(!!r.vendido_por);
    setArchivo(null); setPreview(r.imagen_url);
    if (fileRef.current) fileRef.current.value = '';
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast.error('Escribe el título del resultado'); return; }
    if (!editando && !archivo) { toast.error('Sube la imagen del resultado'); return; }
    const fd = new FormData();
    // El mensaje solo se guarda si el dueño lo ajustó; si no, se arma con los datos al enviarlo
    Object.entries({ ...form, numero: numeroFmt, mensaje: mensajeTocado ? form.mensaje : '' }).forEach(([k, v]) => fd.append(k, v));
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
            <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginTop:2 }}>Solo el título y la imagen son obligatorios. Con el sorteo y el número, el mensaje del grupo se arma solo.</div>
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
              <div className="col-12 col-md-4">
                <label className="jd-label">NÚMERO GANADOR</label>
                <input className="jd-input" value={form.numero} inputMode="numeric" maxLength={cifrasSel || 4}
                  onChange={(e) => set('numero', e.target.value.replace(/\D/g, '').slice(0, cifrasSel || 4))}
                  onBlur={() => { if (numeroFmt && numeroFmt !== form.numero) set('numero', numeroFmt); }}
                  placeholder="Ej: 045" style={{ fontWeight:800, letterSpacing:3, fontSize:'1.05rem' }} />
              </div>
              <div className="col-12 col-md-8">
                <label className="jd-label">VENDIDO POR <span style={{ fontWeight:500, textTransform:'none', letterSpacing:0 }}>(promotor o canal)</span></label>
                <input className="jd-input" value={form.vendido_por} maxLength={120}
                  onChange={(e) => { setVendidoTocado(true); set('vendido_por', e.target.value); }}
                  placeholder={form.rifa_id ? 'Se completa solo al poner el número' : 'Ej: Lucero'} />
                <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginTop:5, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {buscandoQuien ? <span>Buscando quién lo tenía…</span>
                    : sugerencia?.opciones?.length ? (
                      <>
                        <span>Lo tenía:</span>
                        {sugerencia.opciones.map((o) => (
                          <button key={o} type="button" onClick={() => { setVendidoTocado(true); set('vendido_por', o); }}
                            style={{ border:`1px solid ${form.vendido_por === o ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, background: form.vendido_por === o ? 'rgba(10,191,188,.1)' : '#fff',
                              color: form.vendido_por === o ? 'var(--jordyn-primary)' : 'var(--jordyn-text)', borderRadius:20, padding:'1px 9px', fontSize:'.68rem', fontWeight:700, cursor:'pointer' }}>{o}</button>
                        ))}
                        {sugerencia.comprador && <span>· comprador: <b>{sugerencia.comprador}</b></span>}
                      </>
                    ) : sugerencia ? <span>{sugerencia.libre ? 'Ese número no estaba vendido ni asignado.' : 'Nadie lo tenía asignado.'}</span>
                    : form.rifa_id ? <span>Pon el número y te digo quién lo vendió.</span> : <span>Elige el sorteo para saber quién lo vendió.</span>}
                </div>
              </div>

              {/* Mensaje que el bot manda al grupo: se arma solo y se puede ajustar */}
              <div className="col-12">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                  <label className="jd-label" style={{ margin:0 }}>
                    <i className="bi bi-whatsapp me-1" style={{ color:'#25D366' }}></i>MENSAJE PARA EL GRUPO
                    <span style={{ fontWeight:500, textTransform:'none', letterSpacing:0, marginLeft:6 }}>
                      {mensajeTocado ? '(ajustado a mano)' : '(se arma solo con los datos; puedes cambiarlo)'}
                    </span>
                  </label>
                  {mensajeTocado && (
                    <button type="button" onClick={() => { setMensajeTocado(false); set('mensaje', ''); }}
                      style={{ border:'none', background:'none', color:'var(--jordyn-primary)', fontSize:'.74rem', fontWeight:700, cursor:'pointer' }}>
                      <i className="bi bi-arrow-counterclockwise me-1"></i>Armarlo de nuevo con los datos
                    </button>
                  )}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:14 }}>
                  <div>
                    <textarea className="jd-input" rows={13} value={mensajeFinal} maxLength={1000}
                      onChange={(e) => { setMensajeTocado(true); set('mensaje', e.target.value); }}
                      style={{ resize:'vertical', fontSize:'.84rem', lineHeight:1.5, fontFamily:'inherit' }} />
                    <div style={{ fontSize:'.66rem', color:'var(--jordyn-muted)', marginTop:4 }}>
                      Usa *asteriscos* para <b>negrita</b> y _guiones bajos_ para <i>cursiva</i>, como en WhatsApp. {mensajeFinal.length}/1000
                    </div>
                  </div>
                  {/* Vista previa: así lo ve el grupo */}
                  <div style={{ borderRadius:14, padding:'14px 12px', background:'#e5ddd5', backgroundImage:'radial-gradient(rgba(0,0,0,.04) 1px, transparent 1px)', backgroundSize:'14px 14px', border:'1px solid #d6cec4' }}>
                    <div style={{ fontSize:'.62rem', fontWeight:800, color:'#54656f', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, textAlign:'center' }}>
                      Así lo verá el grupo
                    </div>
                    <div style={{ background:'#fff', borderRadius:'10px 10px 10px 2px', padding:4, maxWidth:330, boxShadow:'0 1px 1px rgba(0,0,0,.13)' }}>
                      {preview
                        ? <img src={preview} alt="" style={{ display:'block', width:'100%', maxHeight:260, objectFit:'cover', borderRadius:8 }} />
                        : <div style={{ height:120, borderRadius:8, background:'#f0f2f5', display:'flex', alignItems:'center', justifyContent:'center', color:'#8696a0', fontSize:'.74rem' }}>Aquí va la imagen del resultado</div>}
                      <div style={{ padding:'7px 7px 2px', fontSize:'.82rem', color:'#111b21', lineHeight:1.45, wordBreak:'break-word' }}>
                        <TextoWhatsApp texto={mensajeFinal} />
                      </div>
                      <div style={{ textAlign:'right', fontSize:'.6rem', color:'#8696a0', padding:'0 6px 3px' }}>
                        {new Date().toLocaleTimeString('es-VE', { hour:'numeric', minute:'2-digit', hour12:true })}
                      </div>
                    </div>
                  </div>
                </div>
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
                {(r.numero || r.vendido_por) && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
                    {r.numero && <span style={{ background:'rgba(10,191,188,.12)', color:'var(--jordyn-primary)', borderRadius:20, padding:'1px 9px', fontSize:'.7rem', fontWeight:800, letterSpacing:1 }}>🔢 {r.numero}</span>}
                    {r.vendido_por && <span style={{ background:'var(--jordyn-bg2)', color:'var(--jordyn-text)', borderRadius:20, padding:'1px 9px', fontSize:'.68rem', fontWeight:700, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🤝 {r.vendido_por}</span>}
                  </div>
                )}
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
