// ============================================================
//  ConfigVendedoresRifa.jsx — Rifas → Números por vendedor
//  La publicidad que recibe cada ciudad y el mensaje programado
//  a los vendedores (días, horas, texto con cuentas y tasa).
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { toast } from 'react-toastify';

const DEMAS = '*';
const MAX_MB = 8;
const DIAS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']];
const VARIABLES = [['nombre', 'Nombre'], ['cuando', 'Hoy / Mañana'], ['rifa', 'Rifa'], ['fecha', 'Fecha del sorteo'], ['tasa', 'Tasa Bs'], ['tasa_pesos', 'Tasa pesos'], ['cuentas', 'Cuentas'], ['cantidad', 'Cuántos números']];
const miniatura = (url) => (url && url.includes('/upload/') ? url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_160/') : url);
const hora12 = (h) => new Date(`2026-01-01T${h}:00`).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true });

function FilaCiudad({ etiqueta, ubicacion, url, respaldo, onCambio, onEjemplo, ocupado }) {
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
      onCambio(ubicacion, r.data.url);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo subir la imagen'); }
    finally { setSubiendo(false); if (ref.current) ref.current.value = ''; }
  };
  const vista = url || respaldo;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--jordyn-border)' }}>
      <button type="button" onClick={() => ref.current?.click()} disabled={subiendo} aria-label={`Subir la imagen de ${etiqueta}`}
        style={{ flexShrink: 0, width: 52, height: 64, borderRadius: 7, overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'var(--jordyn-bg2)', border: '1.5px dashed var(--jordyn-border2)', color: 'var(--jordyn-primary)' }}>
        {subiendo ? <span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
          : vista ? <img src={miniatura(vista)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="bi bi-cloud-arrow-up-fill"></i>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '.82rem' }}>{etiqueta}</div>
        <div style={{ fontSize: '.66rem', color: 'var(--jordyn-muted)' }}>{url ? 'Imagen propia' : 'Usa la imagen de la rifa'}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: '.7rem', fontWeight: 700 }}>
          <button type="button" onClick={() => ref.current?.click()} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--jordyn-primary-d)', cursor: 'pointer', fontWeight: 700 }}>{url ? 'Cambiar' : 'Subir'}</button>
          {url && <button type="button" onClick={() => onCambio(ubicacion, '')} style={{ border: 'none', background: 'none', padding: 0, color: '#c0392b', cursor: 'pointer', fontWeight: 700 }}>Quitar</button>}
          <button type="button" onClick={() => onEjemplo(ubicacion)} disabled={ocupado} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--jordyn-primary-d)', cursor: 'pointer', fontWeight: 700 }}>Ver ejemplo</button>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => subir(e.target.files?.[0])} />
    </div>
  );
}

export default function ConfigVendedoresRifa({ rifa, onVolver, onGuardado }) {
  const [p, setP] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [imagenes, setImagenes] = useState([]);
  const [nuevaHora, setNuevaHora] = useState('18:00');
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [ejemplo, setEjemplo] = useState(null);
  const [telefono, setTelefono] = useState('');
  const refTexto = useRef();

  const aplicar = (d) => { setP(d); setCfg(d.config); setImagenes(d.imagenes_ubicacion || []); };
  useEffect(() => {
    API.get(`/rifas/${rifa.id}/vendedores-config`).then((r) => aplicar(r.data)).catch(() => toast.error('No se pudo cargar la configuración'));
  }, [rifa.id]);

  if (!p || !cfg) return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="jd-spinner" style={{ width: 32, height: 32 }}></div></div>;

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const imagenDe = (u) => imagenes.find((x) => x.ubicacion === u)?.imagen || '';
  const cambiarImagen = (u, url) => setImagenes((l) => [...l.filter((x) => x.ubicacion !== u), ...(url ? [{ ubicacion: u, imagen: url }] : [])]);
  const ciudades = [...new Set([...p.ubicaciones, ...imagenes.map((x) => x.ubicacion).filter((u) => u !== DEMAS)])];
  const diaOn = (d) => cfg.dias.includes(d);
  const alternarDia = (d) => set('dias', diaOn(d) ? cfg.dias.filter((x) => x !== d) : [...cfg.dias, d]);
  const agregarHora = () => {
    if (!nuevaHora || cfg.horas.includes(nuevaHora)) return;
    if (cfg.horas.length >= 4) { toast.error('Máximo 4 horas al día'); return; }
    set('horas', [...cfg.horas, nuevaHora].sort());
  };
  const insertar = (k) => {
    const el = refTexto.current;
    const actual = cfg.mensaje || p.mensaje_defecto;
    const i = el?.selectionStart ?? actual.length;
    set('mensaje', `${actual.slice(0, i)}{${k}}${actual.slice(el?.selectionEnd ?? i)}`);
  };

  const guardar = async () => {
    if (cfg.activo && (!cfg.dias.length || !cfg.horas.length)) { toast.error('Elige al menos un día y una hora'); return; }
    setGuardando(true);
    try {
      const r = await API.put(`/rifas/${rifa.id}/vendedores-config`, { config: cfg, imagenes_ubicacion: imagenes });
      aplicar(r.data);
      toast.success(cfg.activo ? '✅ Guardado: el mensaje queda programado' : '✅ Guardado');
      onGuardado();
    } catch (e) { toast.error(e.response?.data?.error || 'Error al guardar'); }
    finally { setGuardando(false); }
  };

  const verEjemplo = async (ubicacion) => {
    setOcupado(true);
    try {
      const r = await API.post(`/rifas/${rifa.id}/vendedores-config/ejemplo`, { config: cfg, imagenes_ubicacion: imagenes, ubicacion });
      setEjemplo(r.data);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo crear el ejemplo'); }
    finally { setOcupado(false); }
  };

  const enviarPrueba = async () => {
    setOcupado(true);
    try {
      await API.post(`/rifas/${rifa.id}/vendedores-config/prueba`, { config: cfg, imagenes_ubicacion: imagenes, telefono, ubicacion: ciudades[0] });
      toast.success('🔔 Prueba en camino a ese WhatsApp');
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo enviar la prueba'); }
    finally { setOcupado(false); }
  };

  const seccion = { background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 };
  const chip = (on) => ({ border: `1.5px solid ${on ? 'var(--jordyn-primary)' : 'var(--jordyn-border2)'}`, background: on ? 'var(--jordyn-primary)' : '#fff', color: on ? '#fff' : 'var(--jordyn-text)', borderRadius: 8, padding: '5px 9px', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' });

  return (
    <div>
      <button type="button" onClick={onVolver} style={{ border: 'none', background: 'none', padding: 0, marginBottom: 8, color: 'var(--jordyn-primary-d)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>
        <i className="bi bi-arrow-left me-1"></i>Volver a los vendedores
      </button>

      <div style={seccion}>
        <div style={{ fontWeight: 800, fontSize: '.88rem' }}>Imagen según la ciudad</div>
        <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginBottom: 6, lineHeight: 1.4 }}>Cada vendedor recibe la imagen de su ciudad con sus números, al compartir, al enviar y en el mensaje programado.</div>
        {ciudades.map((u) => <FilaCiudad key={u} etiqueta={u} ubicacion={u} url={imagenDe(u)} respaldo={p.imagen_rifa} onCambio={cambiarImagen} onEjemplo={verEjemplo} ocupado={ocupado} />)}
        <FilaCiudad etiqueta={ciudades.length ? 'Las demás ciudades' : 'Todos los vendedores'} ubicacion={DEMAS} url={imagenDe(DEMAS)} respaldo={p.imagen_rifa} onCambio={cambiarImagen} onEjemplo={verEjemplo} ocupado={ocupado} />
        {p.sin_ubicacion > 0 && <div style={{ fontSize: '.68rem', color: '#a07000', marginTop: 6 }}>{p.sin_ubicacion} vendedor{p.sin_ubicacion === 1 ? '' : 'es'} de esta rifa sin ciudad: reciben la de «las demás». Se les pone en Vendedores.</div>}
      </div>

      <div style={seccion}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={cfg.activo} onChange={(e) => set('activo', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--jordyn-primary)' }} />
          Mensaje programado a los vendedores
        </label>
        <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', margin: '3px 0 8px', lineHeight: 1.4 }}>Sale esos días hasta el sorteo y se detiene solo. A cada uno le llega su imagen con los números que le quedan libres.</div>

        <label className="jd-label">DÍAS</label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          {DIAS.map(([d, t]) => <button key={d} type="button" onClick={() => alternarDia(d)} aria-pressed={diaOn(d)} style={chip(diaOn(d))}>{t}</button>)}
          <button type="button" onClick={() => set('dias', cfg.dias.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])} style={{ ...chip(false), borderStyle: 'dashed' }}>{cfg.dias.length === 7 ? 'Ninguno' : 'Todos'}</button>
        </div>

        <label className="jd-label">HORAS (VENEZUELA)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {cfg.horas.map((h) => (
            <span key={h} style={{ ...chip(true), cursor: 'default', display: 'inline-flex', gap: 6 }}>{hora12(h)}
              <button type="button" onClick={() => set('horas', cfg.horas.filter((x) => x !== h))} aria-label={`Quitar ${hora12(h)}`} style={{ border: 'none', background: 'none', color: '#fff', padding: 0, cursor: 'pointer' }}>×</button>
            </span>
          ))}
          <input className="jd-input" type="time" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} aria-label="Hora" style={{ width: 130, padding: '6px 10px' }} />
          <button type="button" onClick={agregarHora} className="btn-jordyn-outline" style={{ fontSize: '.74rem', padding: '6px 10px' }}>Agregar</button>
        </div>

        <label className="jd-label">MENSAJE</label>
        <textarea ref={refTexto} className="jd-input" rows={7} maxLength={1500} value={cfg.mensaje} placeholder={p.mensaje_defecto} onChange={(e) => set('mensaje', e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          {VARIABLES.map(([k, t]) => <button key={k} type="button" onClick={() => insertar(k)} style={{ ...chip(false), fontSize: '.66rem', padding: '3px 7px' }}>{t}</button>)}
        </div>

        <div style={{ fontSize: '.7rem', lineHeight: 1.45, marginTop: 8, color: 'var(--jordyn-muted)' }}>
          Le llegaría a <b>{p.con_telefono}</b> vendedor{p.con_telefono === 1 ? '' : 'es'}.
          {p.sin_telefono > 0 && <> {p.sin_telefono} sin teléfono no {p.sin_telefono === 1 ? 'lo recibe' : 'lo reciben'}.</>}
          {p.nuevos > 0 && <> <b>{p.nuevos}</b> nunca le {p.nuevos === 1 ? 'ha' : 'han'} escrito a este WhatsApp: {p.nuevos === 1 ? 'sale' : 'salen'} de a poco y con tope de 30 por día. Si te escriben una vez, les llega al instante y sin tope.</>}
        </div>
        {!p.conectado && <div style={{ fontSize: '.7rem', color: '#c0392b', fontWeight: 700, marginTop: 4 }}>WhatsApp no está conectado: mientras tanto no sale nada.</div>}
        {p.turnos.length > 0 && <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>Últimos: {p.turnos.map((t) => `${t.turno.slice(5).replace('T', ' ')} (${t.enviados})`).join(' · ')}</div>}
      </div>

      <div style={seccion}>
        <div style={{ fontWeight: 800, fontSize: '.8rem', marginBottom: 5 }}>Probar antes</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input className="jd-input" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Tu WhatsApp: 04121234567" aria-label="Teléfono para la prueba" style={{ flex: '1 1 170px', padding: '6px 10px' }} />
          <button type="button" className="btn-jordyn-outline" onClick={enviarPrueba} disabled={ocupado || !telefono.trim()} style={{ fontSize: '.74rem', padding: '6px 10px' }}>Enviarme una prueba</button>
        </div>
      </div>

      <button className="btn-jordyn w-100" onClick={guardar} disabled={guardando} style={{ fontSize: '.85rem' }}>
        {guardando ? 'Guardando...' : <><i className="bi bi-floppy-fill me-1"></i>Guardar</>}
      </button>

      {ejemplo && (
        <div onClick={(e) => e.target === e.currentTarget && setEjemplo(null)} style={{ position: 'fixed', inset: 0, zIndex: 10600, background: 'rgba(8,22,22,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: '.85rem' }}>Ejemplo: {ejemplo.vendedor}</b>
              <button type="button" onClick={() => setEjemplo(null)} aria-label="Cerrar" style={{ border: 'none', background: 'none', fontSize: '1rem', cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <img src={ejemplo.imagen} alt={`Ejemplo de ${ejemplo.vendedor}`} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '.78rem', background: '#e7fbd9', borderRadius: 8, padding: 10, marginTop: 8 }}>{ejemplo.texto}</div>
          </div>
        </div>
      )}
    </div>
  );
}
