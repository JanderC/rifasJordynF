// ============================================================
//   Decoracion.js — RESUELVE TU SEMANA
//   Decora la página del cliente según la fecha: Navidad, Año
//   Nuevo, Semana Santa, Halloween... Cada decoración lleva sus
//   imágenes, colores y efecto, y sale sola en sus fechas o con
//   el botón "Poner ya". Mientras se edita se ve en vivo.
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { CLAVE_VISTA, PLANTILLAS, nuevaDecoracion, optimizada } from '../utils/decoracion';

const MAX_MB = 8;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const CUANDO = [
  ['cada_anio', 'Todos los años en las mismas fechas'],
  ['fijas', 'Solo entre dos fechas'],
  ['semana_santa', 'Semana Santa (el sistema calcula la fecha)'],
  ['carnaval', 'Carnaval (el sistema calcula la fecha)'],
  ['manual', 'Solo cuando yo la ponga'],
];
const EFECTOS = [['ninguno', 'Ninguno'], ['nieve', '❄️ Nieve'], ['confeti', '🎊 Confeti'], ['estrellas', '✨ Estrellas'], ['corazones', '❤️ Corazones'], ['murcielagos', '🦇 Murciélagos'], ['petalos', '🌸 Pétalos'], ['imagen', '🖼️ Mi imagen']];
const INTENSIDADES = [['poca', 'Poco'], ['media', 'Normal'], ['mucha', 'Mucho']];
const GUIRNALDAS = [['ninguna', 'Ninguna'], ['luces', '💡 Luces'], ['banderines', '🚩 Banderines'], ['estrellas', '⭐ Estrellas'], ['murcielagos', '🦇 Murciélagos'], ['corazones', '💕 Corazones'], ['flores', '🌼 Flores'], ['imagen', '🖼️ Mi imagen']];
const ESQUINAS = [['ninguna', 'Ninguno'], ['acebo', '🌿 Acebo'], ['telarana', '🕸️ Telaraña'], ['globos', '🎈 Globos'], ['flores', '🌼 Flores']];

const IMAGENES = [
  ['img_banner_pc', 'Banner en computador', 'Sale de lado a lado arriba. Ideal 1920 × 400.'],
  ['img_banner_movil', 'Banner en teléfono', 'Ideal 1080 × 500. Si no subes esta, se usa la de computador.'],
  ['img_fondo', 'Fondo de la página', 'Una imagen grande, 1920 × 1080. Va detrás de todo.'],
  ['img_logo', 'Logo de temporada', 'Reemplaza el logo de arriba. PNG sin fondo.'],
  ['img_esquina_izq', 'Adorno esquina izquierda', 'PNG sin fondo. Si subes solo una esquina, sale en los dos lados.'],
  ['img_esquina_der', 'Adorno esquina derecha', 'PNG sin fondo.'],
  ['img_guirnalda', 'Guirnalda', 'Tira PNG sin fondo; se repite a lo ancho. Elige "Mi imagen" abajo.'],
  ['img_efecto', 'Imagen que cae', 'PNG pequeño sin fondo (copo, calabaza...). Elige "Mi imagen" en el efecto.'],
];

const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });
const rangoTexto = (r) => (r ? `${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}` : '');

function Opciones({ valor, opciones, onCambio }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opciones.map(([v, etiqueta]) => (
        <button key={v} type="button" onClick={() => onCambio(v)}
          className={valor === v ? 'btn-jordyn' : 'btn-jordyn-outline'}
          style={{ fontSize: '.74rem', padding: '6px 11px' }}>{etiqueta}</button>
      ))}
    </div>
  );
}

function MesDia({ etiqueta, valor, onCambio }) {
  const [mes = '', dia = ''] = String(valor || '').split('-');
  const cambiar = (m, d) => onCambio(`${m || '01'}-${String(d || 1).padStart(2, '0')}`);
  return (
    <div>
      <label className="jd-label">{etiqueta}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="jd-input" type="number" min="1" max="31" inputMode="numeric" value={dia ? Number(dia) : ''} placeholder="Día"
          onChange={(e) => cambiar(mes, Math.min(31, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 76 }} />
        <select className="jd-select" value={mes} onChange={(e) => cambiar(e.target.value, dia)}>
          <option value="">Mes</option>
          {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

// Una imagen: se sube al elegirla, así se ve de una vez en la vista previa
function CampoImagen({ titulo, ayuda, url, onCambio }) {
  const ref = useRef();
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (archivo) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) { toast.error('El archivo debe ser una imagen'); return; }
    if (archivo.size > MAX_MB * 1024 * 1024) { toast.error(`La imagen pesa más de ${MAX_MB}MB`); return; }
    const fd = new FormData();
    fd.append('imagen', archivo);
    setSubiendo(true);
    try {
      const r = await API.post('/upload/decoracion', fd);
      onCambio(r.data.url);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10, padding: 8, minWidth: 0 }}>
      <button type="button" onClick={() => ref.current?.click()} disabled={subiendo} aria-label={`Subir ${titulo}`}
        style={{ flexShrink: 0, width: 62, height: 62, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', padding: 0, background: '#fff', border: '1.5px dashed var(--jordyn-border2)', color: 'var(--jordyn-primary)', fontSize: '1.2rem' }}>
        {subiendo ? <span className="jd-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
          : url ? <img src={optimizada(url, 160)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <i className="bi bi-cloud-arrow-up-fill"></i>}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '.78rem', fontWeight: 800, color: 'var(--jordyn-text)' }}>{titulo}</div>
        <div style={{ fontSize: '.64rem', color: 'var(--jordyn-muted)', lineHeight: 1.35 }}>{ayuda}</div>
        {url && <button type="button" onClick={() => onCambio('')} style={{ border: 'none', background: 'none', padding: 0, marginTop: 2, color: '#c0392b', fontSize: '.66rem', fontWeight: 700, cursor: 'pointer' }}>Quitar</button>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => subir(e.target.files?.[0])} />
    </div>
  );
}

function VistaPrevia() {
  const [modo, setModo] = useState('telefono');
  const caja = useRef();
  const [ancho, setAncho] = useState(360);
  const pantalla = modo === 'telefono' ? { w: 390, h: 760 } : { w: 1280, h: 800 };

  useEffect(() => {
    const medir = () => setAncho(caja.current?.clientWidth || 360);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const escala = Math.min(1, ancho / pantalla.w);
  const alto = Math.min(pantalla.h * escala, modo === 'telefono' ? 640 : 460);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="jd-label" style={{ margin: 0 }}>ASÍ SE VE</span>
        <Opciones valor={modo} onCambio={setModo} opciones={[['telefono', '📱 Teléfono'], ['pc', '💻 Computador']]} />
      </div>
      <div ref={caja} style={{ height: alto, overflow: 'hidden', borderRadius: 14, border: '2px solid var(--jordyn-border2)', background: '#fff' }}>
        <iframe title="Vista previa de la decoración" src={`${process.env.PUBLIC_URL}/?vista_decoracion=1`}
          style={{ width: pantalla.w, height: alto / escala, border: 0, display: 'block', margin: '0 auto', transform: `scale(${escala})`, transformOrigin: 'top left' }} />
      </div>
      <div style={{ fontSize: '.66rem', color: 'var(--jordyn-muted)', marginTop: 6, lineHeight: 1.45 }}>
        Puedes bajar dentro del recuadro. Esta vista solo la ves tú: los clientes no ven nada hasta que guardes y le toque su fecha.
      </div>
    </div>
  );
}

function Editor({ inicial, moviles, onGuardar, onCancelar, guardando }) {
  const [d, setD] = useState(inicial);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    try { localStorage.setItem(CLAVE_VISTA, JSON.stringify(d)); } catch {}
  }, [d]);
  useEffect(() => () => {
    try { localStorage.removeItem(CLAVE_VISTA); } catch {}
  }, []);

  const cambiarCuando = (c) => setD((p) => ({ ...p, cuando: c, desde: '', hasta: '' }));
  const movil = moviles?.[d.cuando];

  const guardar = () => {
    if (!d.nombre.trim()) { toast.error('Ponle un nombre a la decoración'); return; }
    if (['fijas', 'cada_anio'].includes(d.cuando) && (!d.desde || !d.hasta)) { toast.error('Elige las fechas'); return; }
    onGuardar(d);
  };

  return (
    <div className="row g-3 fade-in">
      <div className="col-12 col-xl-5 order-xl-2">
        <div style={{ position: 'sticky', top: 12 }}><VistaPrevia /></div>
      </div>

      <div className="col-12 col-xl-7 order-xl-1">
        <div className="jd-card" style={{ marginBottom: 14 }}>
          <div className="row g-3">
            <div className="col-12">
              <label className="jd-label">NOMBRE</label>
              <input className="jd-input" value={d.nombre} maxLength={60} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Feria de San Sebastián" />
            </div>
            <div className="col-12">
              <label className="jd-label">¿CUÁNDO SALE?</label>
              <select className="jd-select" value={d.cuando} onChange={(e) => cambiarCuando(e.target.value)}>
                {CUANDO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            {d.cuando === 'cada_anio' && <>
              <div className="col-12 col-md-6"><MesDia etiqueta="DESDE" valor={d.desde} onCambio={(v) => set('desde', v)} /></div>
              <div className="col-12 col-md-6"><MesDia etiqueta="HASTA" valor={d.hasta} onCambio={(v) => set('hasta', v)} /></div>
            </>}
            {d.cuando === 'fijas' && <>
              <div className="col-12 col-md-6">
                <label className="jd-label">DESDE</label>
                <input className="jd-input" type="date" value={d.desde} onChange={(e) => set('desde', e.target.value)} />
              </div>
              <div className="col-12 col-md-6">
                <label className="jd-label">HASTA</label>
                <input className="jd-input" type="date" value={d.hasta} onChange={(e) => set('hasta', e.target.value)} />
              </div>
            </>}
            {movil && <div className="col-12" style={{ fontSize: '.74rem', color: 'var(--jordyn-muted)' }}>La próxima vez sale del <b>{rangoTexto(movil)}</b>. Cada año se calcula sola.</div>}
            {d.cuando === 'manual' && <div className="col-12" style={{ fontSize: '.74rem', color: 'var(--jordyn-muted)' }}>Solo sale cuando toques <b>Poner ya</b> en la lista.</div>}
          </div>
        </div>

        <div className="jd-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--jordyn-text)', marginBottom: 4 }}>Tus imágenes</div>
          <div style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)', marginBottom: 12 }}>Todas son opcionales. JPG, PNG, WEBP o GIF, máximo {MAX_MB}MB.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 8 }}>
            {IMAGENES.map(([campo, titulo, ayuda]) => (
              <CampoImagen key={campo} titulo={titulo} ayuda={ayuda} url={d[campo]} onCambio={(v) => set(campo, v)} />
            ))}
          </div>
          {d.img_fondo && (
            <div style={{ marginTop: 14 }}>
              <label className="jd-label">QUÉ TAN SUAVE SE VE EL FONDO: {d.velo}%</label>
              <input type="range" min="0" max="90" step="5" value={d.velo} onChange={(e) => set('velo', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--jordyn-primary)' }} />
              <div style={{ fontSize: '.66rem', color: 'var(--jordyn-muted)' }}>Más alto: el fondo se ve más claro y las letras se leen mejor.</div>
            </div>
          )}
        </div>

        <div className="jd-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--jordyn-text)', marginBottom: 12 }}>Textos</div>
          <div className="row g-3">
            <div className="col-12">
              <label className="jd-label">MENSAJE CORTO</label>
              <input className="jd-input" value={d.mensaje} maxLength={80} onChange={(e) => set('mensaje', e.target.value)} placeholder="Ej: 🎄 ¡Feliz Navidad!" />
            </div>
            <div className="col-12 col-md-6">
              <label className="jd-label">TÍTULO</label>
              <input className="jd-input" value={d.titulo1} maxLength={60} onChange={(e) => set('titulo1', e.target.value)} placeholder="Tu número de la suerte" />
            </div>
            <div className="col-12 col-md-6">
              <label className="jd-label">TÍTULO, PARTE EN COLOR</label>
              <input className="jd-input" value={d.titulo2} maxLength={60} onChange={(e) => set('titulo2', e.target.value)} placeholder="te está esperando" />
            </div>
          </div>
        </div>

        <div className="jd-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--jordyn-text)', marginBottom: 12 }}>Colores y adornos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
            {[['color1', 'Principal'], ['color2', 'Secundario'], ['color_fondo', 'Fondo']].map(([k, t]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>
                <input type="color" value={d[k]} onChange={(e) => set(k, e.target.value)} style={{ width: 38, height: 34, padding: 0, border: '1px solid var(--jordyn-border2)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
                {t}
              </label>
            ))}
          </div>
          <label className="jd-label">LETRAS SOBRE EL FONDO</label>
          <div style={{ marginBottom: 14 }}><Opciones valor={d.tono} onCambio={(v) => set('tono', v)} opciones={[['claro', 'Oscuras (fondo claro)'], ['oscuro', 'Blancas (fondo oscuro)']]} /></div>
          <label className="jd-label">LO QUE CAE POR LA PANTALLA</label>
          <div style={{ marginBottom: 8 }}><Opciones valor={d.efecto} onCambio={(v) => set('efecto', v)} opciones={EFECTOS} /></div>
          {d.efecto !== 'ninguno' && <div style={{ marginBottom: 14 }}><Opciones valor={d.intensidad} onCambio={(v) => set('intensidad', v)} opciones={INTENSIDADES} /></div>}
          <div style={{ fontSize: '.66rem', color: 'var(--jordyn-muted)', margin: '-6px 0 14px' }}>Se detiene solo mientras el cliente elige sus números o paga.</div>
          <label className="jd-label">GUIRNALDA ARRIBA</label>
          <div style={{ marginBottom: 14 }}><Opciones valor={d.guirnalda} onCambio={(v) => set('guirnalda', v)} opciones={GUIRNALDAS} /></div>
          <label className="jd-label">ADORNO DE LAS ESQUINAS</label>
          <Opciones valor={d.esquinas} onCambio={(v) => set('esquinas', v)} opciones={ESQUINAS} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-jordyn" onClick={guardar} disabled={guardando} style={{ fontSize: '.85rem' }}>
            {guardando ? 'Guardando...' : <><i className="bi bi-floppy-fill me-1"></i>Guardar decoración</>}
          </button>
          <button className="btn-jordyn-outline" onClick={onCancelar} disabled={guardando} style={{ fontSize: '.85rem' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ d, cfg, ocupado, onEditar, onPoner, onQuitar, onDuplicar, onActiva, onEliminar }) {
  const plantilla = PLANTILLAS.find((p) => p.id === d.plantilla);
  const seVe = cfg.vigente_id === d.id;
  const forzada = cfg.modo === d.id;
  const rango = cfg.rangos?.[d.id];
  return (
    <div className="jd-card fade-in" style={{ padding: 0, overflow: 'hidden', opacity: d.activa || forzada ? 1 : 0.6 }}>
      <div style={{ position: 'relative', height: 100, background: d.img_banner_pc || d.img_banner_movil
        ? `center/cover url("${optimizada(d.img_banner_pc || d.img_banner_movil, 500)}")`
        : `linear-gradient(120deg,${d.color1},${d.color2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.3rem' }}>
        {!(d.img_banner_pc || d.img_banner_movil) && (plantilla?.emoji || '✨')}
        {seVe && <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 10px', borderRadius: 20, background: '#2f9e44', color: '#fff', fontSize: '.65rem', fontWeight: 800 }}>Se ve hoy</span>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--jordyn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</div>
        <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', minHeight: 18 }}>
          {d.cuando === 'manual' ? 'Solo cuando la pongas' : !rango ? '' : d.activa ? rangoTexto(rango) : 'Pausada'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <button className="btn-jordyn-outline" onClick={onEditar} disabled={ocupado} style={{ flex: 1, fontSize: '.72rem', padding: '6px 8px' }}>
            <i className="bi bi-pencil-fill me-1"></i>Editar
          </button>
          {forzada
            ? <button className="btn-jordyn-outline" onClick={onQuitar} disabled={ocupado} style={{ flex: 1, fontSize: '.72rem', padding: '6px 8px' }}>Quitar</button>
            : <button className="btn-jordyn" onClick={onPoner} disabled={ocupado} style={{ flex: 1, fontSize: '.72rem', padding: '6px 8px' }}>Poner ya</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          {d.cuando !== 'manual' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={d.activa} disabled={ocupado} onChange={onActiva} style={{ width: 16, height: 16, accentColor: 'var(--jordyn-primary)' }} />
              Sale en sus fechas
            </label>
          )}
          <button className="btn-jordyn-outline" onClick={onDuplicar} disabled={ocupado} title="Duplicar" aria-label="Duplicar" style={{ marginLeft: 'auto', fontSize: '.72rem', padding: '5px 9px' }}><i className="bi bi-copy"></i></button>
          <button className="btn-jordyn-danger" onClick={onEliminar} disabled={ocupado} title="Eliminar" aria-label="Eliminar" style={{ fontSize: '.72rem', padding: '5px 9px' }}><i className="bi bi-trash-fill"></i></button>
        </div>
      </div>
    </div>
  );
}

export default function Decoracion() {
  const [cfg, setCfg] = useState(null);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    API.get('/sitio/decoracion').then((r) => setCfg(r.data)).catch(() => toast.error('Error cargando las decoraciones'));
  }, []);

  const guardar = async (modo, lista, aviso) => {
    setGuardando(true);
    try {
      const r = await API.put('/sitio/decoracion', { modo, lista });
      setCfg(r.data);
      setEditando(null);
      if (aviso) toast.success(aviso);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setGuardando(false); }
  };

  const guardarEditada = (d) => {
    const lista = d.id ? cfg.lista.map((x) => (x.id === d.id ? d : x)) : [...cfg.lista, d];
    guardar(cfg.modo, lista, '✅ Decoración guardada');
  };

  const eliminar = (d) => {
    if (!window.confirm(`¿Eliminar la decoración "${d.nombre}"?`)) return;
    guardar(cfg.modo === d.id ? 'auto' : cfg.modo, cfg.lista.filter((x) => x.id !== d.id), 'Decoración eliminada');
  };

  const actual = cfg?.lista.find((d) => d.id === cfg.vigente_id);

  return (
    <Layout title="DECORACIÓN">
      {!cfg ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
      ) : editando ? (
        <>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--jordyn-text)', margin: '0 0 14px' }}>
            {editando.id ? `Editando: ${editando.nombre}` : `Nueva decoración${editando.nombre ? `: ${editando.nombre}` : ''}`}
          </h3>
          <Editor key={editando.id || editando.plantilla} inicial={editando} moviles={cfg.moviles} guardando={guardando}
            onGuardar={guardarEditada} onCancelar={() => setEditando(null)} />
        </>
      ) : (
        <>
          <div className="jd-card jd-card-primary fade-in" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', letterSpacing: '.05em' }}>HOY LA PÁGINA DEL CLIENTE SE VE</div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--jordyn-primary-d)', marginTop: 2 }}>
                  {actual ? `${actual.nombre}${cfg.modo === actual.id ? ' (puesta a mano, sigue hasta que la quites)' : ''}` : cfg.modo === 'apagada' ? 'Normal: decoración apagada' : 'Normal: no hay decoración para hoy'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Opciones valor={cfg.modo === 'apagada' ? 'apagada' : 'auto'} opciones={[['auto', 'Automática por fechas'], ['apagada', 'Apagada']]}
                  onCambio={(m) => guardar(m, cfg.lista, m === 'apagada' ? 'Decoración apagada' : 'Decoración automática por fechas')} />
                <a href="/" target="_blank" rel="noreferrer" className="btn-jordyn-outline" style={{ fontSize: '.74rem', padding: '6px 11px', textDecoration: 'none' }}>
                  <i className="bi bi-box-arrow-up-right me-1"></i>Ver la página
                </a>
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--jordyn-text)', margin: '0 0 4px' }}>Crear una decoración</h3>
          <p style={{ fontSize: '.78rem', color: 'var(--jordyn-muted)', margin: '0 0 12px' }}>Elige la fecha: viene lista para usar y le puedes poner tus imágenes.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(132px,1fr))', gap: 10, marginBottom: 28 }}>
            {PLANTILLAS.map((p) => (
              <button key={p.id} type="button" onClick={() => setEditando(nuevaDecoracion(p))} className="jd-card"
                style={{ cursor: 'pointer', textAlign: 'center', padding: '12px 8px', fontFamily: 'inherit', background: p.datos.color1 ? `linear-gradient(160deg,${p.datos.color1}1f,#fff 70%)` : undefined }}>
                <div style={{ fontSize: '1.7rem', lineHeight: 1.2 }}>{p.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: '.8rem', color: 'var(--jordyn-text)', marginTop: 3 }}>{p.nombre}</div>
                <div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)' }}>{p.fechas}</div>
              </button>
            ))}
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--jordyn-text)', margin: '0 0 12px' }}>Tus decoraciones ({cfg.lista.length})</h3>
          {cfg.lista.length === 0 ? (
            <div className="jd-alert jd-alert-info"><i className="bi bi-stars"></i>Todavía no hay ninguna. La página se ve normal hasta que crees la primera.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
              {cfg.lista.map((d) => (
                <Tarjeta key={d.id} d={d} cfg={cfg} ocupado={guardando}
                  onEditar={() => setEditando(d)}
                  onPoner={() => guardar(d.id, cfg.lista, `${d.nombre} ya se ve en la página`)}
                  onQuitar={() => guardar('auto', cfg.lista, 'Decoración quitada')}
                  onDuplicar={() => setEditando({ ...d, id: '', nombre: `${d.nombre} (copia)` })}
                  onActiva={() => guardar(cfg.modo, cfg.lista.map((x) => (x.id === d.id ? { ...x, activa: !x.activa } : x)))}
                  onEliminar={() => eliminar(d)} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
