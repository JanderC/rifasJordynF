// ============================================================
//  ConfigVendedoresRifa.jsx — Rifas → crear / editar rifa
//  La publicidad de cada ciudad (tres imágenes: "juega el sábado",
//  "juega mañana" y "juega hoy") y el mensaje programado a los
//  vendedores. Se guarda junto con la rifa. El programado manda la
//  publicidad sola (sin números) y una rifa nueva arranca con el último
//  mensaje y horario que se usó.
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { toast } from 'react-toastify';
import { useUbicaciones } from './CampoUbicacion';

const DEMAS = '*';
const MAX_MB = 8;
const DIAS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']];
const VARIABLES = [['nombre', 'Nombre'], ['cuando', 'El sábado / Mañana / Hoy'], ['rifa', 'Rifa'], ['fecha', 'Fecha del sorteo'], ['precio', 'Valor del ticket'], ['tasa', 'Tasa (pesos por Bs)'], ['tasa_pesos', 'Dólar por Zelle (pesos)'], ['tasa_efectivo', 'Dólar en efectivo (automático)'], ['tasa_bcv', 'Dólar BCV'], ['tasa_dolar', 'Bs por dólar'], ['cuentas', 'Cuentas'], ['cantidad', 'Cuántos números le quedan']];
const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const vacio = (c) => !c.activo && !c.mensaje && !c.dias.length && !c.horas.length;
const miniatura = (url) => (url && url.includes('/upload/') ? url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_160/') : url);
const hora12 = (h) => new Date(`2026-01-01T${h}:00`).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true });
export const RECORDATORIO_VENDEDORES_VACIO = { activo: false, dias: [], horas: [], mensaje: '' };

// Las tres imágenes de una ciudad
const momentos = (fecha) => {
  const dia = fecha ? new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-VE', { weekday: 'long', timeZone: 'UTC' }) : null;
  return [['dia', dia ? `Juega el ${dia}` : 'Juega el día…'], ['manana', 'Juega mañana'], ['hoy', 'Juega hoy']];
};

function Imagen({ etiqueta, url, onCambio, onEjemplo }) {
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
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo subir la imagen'); }
    finally { setSubiendo(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
      <button type="button" onClick={() => ref.current?.click()} disabled={subiendo} aria-label={`Subir la imagen "${etiqueta}"`}
        style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: 8, overflow: 'hidden', padding: 0, cursor: 'pointer', background: '#fff', border: `1.5px ${url ? 'solid' : 'dashed'} var(--jordyn-border2)`, color: 'var(--jordyn-primary)', fontSize: '1.2rem' }}>
        {subiendo ? <span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
          : url ? <img src={miniatura(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="bi bi-plus-lg"></i>}
      </button>
      <div style={{ fontSize: '.64rem', fontWeight: 700, marginTop: 3, lineHeight: 1.2 }}>{etiqueta}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: '.62rem', fontWeight: 700 }}>
        {url && <button type="button" onClick={() => onCambio('')} style={{ border: 'none', background: 'none', padding: 0, color: '#c0392b', cursor: 'pointer' }}>Quitar</button>}
        {onEjemplo && <button type="button" onClick={onEjemplo} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--jordyn-primary-d)', cursor: 'pointer' }}>Ver</button>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => subir(e.target.files?.[0])} />
    </div>
  );
}

// value: { imagenes_ubicacion, recordatorio_vendedores } · onChange(cambios) · rifaId: solo al editar
export default function ConfigVendedoresRifa({ value, onChange, rifaId, fechaSorteo }) {
  const imagenes = Array.isArray(value.imagenes_ubicacion) ? value.imagenes_ubicacion : [];
  const cfg = { ...RECORDATORIO_VENDEDORES_VACIO, ...(value.recordatorio_vendedores || {}) };
  const ubicaciones = useUbicaciones();
  const [defecto, setDefecto] = useState('');
  const [ultimo, setUltimo] = useState(null);   // lo de la última rifa configurada
  const [viejos, setViejos] = useState([]);     // plantillas anteriores del sistema
  const [listo, setListo] = useState(false);
  const [stats, setStats] = useState(null);
  const [nuevaHora, setNuevaHora] = useState('18:00');
  const [ocupado, setOcupado] = useState(false);
  const [ejemplo, setEjemplo] = useState(null);
  const [telefono, setTelefono] = useState('');
  const refTexto = useRef();

  useEffect(() => {
    API.get('/rifas/vendedores-config/defecto')
      .then((r) => { setDefecto(r.data.mensaje || ''); setUltimo(r.data.ultimo || null); setViejos(r.data.viejos || []); })
      .catch(() => {}).finally(() => setListo(true));
  }, []);
  // Rifa nueva: arranca con el mensaje y el horario de la última. Si ya estaba encendido
  // sin texto, se muestra el texto que se iba a enviar para poder corregirlo.
  useEffect(() => {
    if (!listo) return;
    if (!rifaId && vacio(cfg) && ultimo) onChange({ recordatorio_vendedores: { ...RECORDATORIO_VENDEDORES_VACIO, ...ultimo, mensaje: ultimo.mensaje || defecto } });
    else if (!rifaId && vacio(cfg) && defecto) onChange({ recordatorio_vendedores: { ...cfg, mensaje: defecto } });
    else if (cfg.activo && !cfg.mensaje && (ultimo?.mensaje || defecto)) onChange({ recordatorio_vendedores: { ...cfg, mensaje: ultimo?.mensaje || defecto } });
    // Quedó guardada una plantilla anterior del sistema: se muestra la de Jordyn
    else if (defecto && viejos.some((v) => v.trim() === String(cfg.mensaje || '').replace(/\r/g, '').trim())) onChange({ recordatorio_vendedores: { ...cfg, mensaje: defecto } });
  }, [listo]);
  useEffect(() => {
    if (!rifaId) return;
    API.get(`/rifas/${rifaId}/vendedores-config`).then((r) => setStats(r.data)).catch(() => {});
  }, [rifaId]);

  const set = (k, v) => onChange({ recordatorio_vendedores: { ...cfg, [k]: v } });
  // Al encender sin horario: el de la última rifa, o todos los días a las 8:00 a. m.
  const encender = (on) => onChange({ recordatorio_vendedores: on ? {
    ...cfg, activo: true,
    dias: cfg.dias.length ? cfg.dias : (ultimo?.dias?.length ? ultimo.dias : TODOS_LOS_DIAS),
    horas: cfg.horas.length ? cfg.horas : (ultimo?.horas?.length ? ultimo.horas : ['08:00']),
    mensaje: cfg.mensaje || ultimo?.mensaje || defecto,
  } : { ...cfg, activo: false } });
  const filaDe = (u) => imagenes.find((x) => x.ubicacion === u) || {};
  const cambiarImagen = (u, momento, url) => {
    const fila = { ...filaDe(u), ubicacion: u, [momento]: url };
    if (!url) delete fila[momento];
    if (fila.imagen && momento === 'dia') delete fila.imagen;   // de cuando había una sola
    onChange({ imagenes_ubicacion: [...imagenes.filter((x) => x.ubicacion !== u), fila] });
  };
  const ciudades = [...new Set([...ubicaciones.map((u) => u.ubicacion), ...(stats?.ubicaciones || []), ...imagenes.map((x) => x.ubicacion).filter((u) => u !== DEMAS)])].sort();
  const diaOn = (d) => cfg.dias.includes(d);
  const alternarDia = (d) => set('dias', diaOn(d) ? cfg.dias.filter((x) => x !== d) : [...cfg.dias, d]);
  const agregarHora = () => {
    if (!nuevaHora || cfg.horas.includes(nuevaHora)) return;
    if (cfg.horas.length >= 4) { toast.error('Máximo 4 horas al día'); return; }
    set('horas', [...cfg.horas, nuevaHora].sort());
  };
  const insertar = (k) => {
    const el = refTexto.current;
    const actual = cfg.mensaje || defecto;
    const i = el?.selectionStart ?? actual.length;
    set('mensaje', `${actual.slice(0, i)}{${k}}${actual.slice(el?.selectionEnd ?? i)}`);
  };
  const datos = (extra) => ({ config: cfg, imagenes_ubicacion: imagenes, ...extra });

  const verEjemplo = async (ubicacion, momento) => {
    setOcupado(true);
    try { setEjemplo((await API.post(`/rifas/${rifaId}/vendedores-config/ejemplo`, datos({ ubicacion, momento }))).data); }
    catch (e) { toast.error(e.response?.data?.error || 'No se pudo crear el ejemplo'); }
    finally { setOcupado(false); }
  };
  const enviarPrueba = async () => {
    setOcupado(true);
    try {
      await API.post(`/rifas/${rifaId}/vendedores-config/prueba`, datos({ telefono, ubicacion: ciudades[0] || DEMAS }));
      toast.success('🔔 Prueba en camino a ese WhatsApp');
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo enviar la prueba'); }
    finally { setOcupado(false); }
  };

  const caja = { background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 };
  const chip = (on) => ({ border: `1.5px solid ${on ? 'var(--jordyn-primary)' : 'var(--jordyn-border2)'}`, background: on ? 'var(--jordyn-primary)' : '#fff', color: on ? '#fff' : 'var(--jordyn-text)', borderRadius: 8, padding: '5px 9px', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' });
  const fila = (u, etiqueta) => (
    <div key={u} style={{ padding: '8px 0', borderTop: '1px solid var(--jordyn-border)' }}>
      <div style={{ fontWeight: 800, fontSize: '.8rem', marginBottom: 6 }}><i className="bi bi-geo-alt-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>{etiqueta}</div>
      <div style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
        {momentos(fechaSorteo).map(([m, t]) => (
          <Imagen key={m} etiqueta={t} url={filaDe(u)[m] || (m === 'dia' ? filaDe(u).imagen : '')} onCambio={(url) => cambiarImagen(u, m, url)}
            onEjemplo={rifaId && !ocupado ? () => verEjemplo(u, m) : null} />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={caja}>
        <div style={{ fontWeight: 800, fontSize: '.86rem' }}>Imágenes por ciudad</div>
        <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginBottom: 4, lineHeight: 1.4 }}>
          A cada vendedor le llega la de su ciudad, sin números (los números se mandan desde «Números por vendedor»). El sistema elige sola la del día: «juega el {momentos(fechaSorteo)[0][1].replace('Juega el ', '')}» hasta dos días antes, «mañana» la víspera y «hoy» el día del sorteo.
        </div>
        {ciudades.map((u) => fila(u, u))}
        {fila(DEMAS, ciudades.length ? 'Las demás ciudades' : 'Todos los vendedores')}
        {!ciudades.length && <div style={{ fontSize: '.68rem', color: '#a07000', marginTop: 4 }}>Para separar por ciudad, ponle la ciudad a cada vendedor en Vendedores.</div>}
        {stats?.sin_ubicacion > 0 && <div style={{ fontSize: '.68rem', color: '#a07000', marginTop: 4 }}>{stats.sin_ubicacion} vendedor{stats.sin_ubicacion === 1 ? '' : 'es'} de esta rifa sin ciudad: reciben la de «las demás».</div>}
      </div>

      <div style={caja}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '.86rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={cfg.activo} onChange={(e) => encender(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--jordyn-primary)' }} />
          Enviarles la publicidad a los vendedores automáticamente
        </label>
        <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', margin: '3px 0 8px', lineHeight: 1.4 }}>Esos días, a esas horas, hasta el sorteo, a cada vendedor de esta rifa le llega la imagen de su ciudad con este mensaje. La próxima rifa que crees arranca con este mismo mensaje y horario.</div>

        {cfg.activo && <>
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
            <button type="button" onClick={agregarHora} className="btn-jordyn-outline" style={{ fontSize: '.74rem', padding: '6px 10px' }}>Agregar hora</button>
          </div>
          {!cfg.horas.length && <div role="alert" style={{ fontSize: '.72rem', color: '#c0392b', fontWeight: 700, margin: '-2px 0 8px' }}>Sin una hora no sale nada: elige la hora y toca «Agregar hora».</div>}
          {!cfg.dias.length && <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', margin: '-2px 0 8px' }}>Sin días marcados sale todos los días.</div>}

          <label className="jd-label">MENSAJE</label>
          <textarea ref={refTexto} className="jd-input" rows={9} maxLength={1500} value={cfg.mensaje} placeholder={defecto} onChange={(e) => set('mensaje', e.target.value)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {VARIABLES.map(([k, t]) => <button key={k} type="button" onClick={() => insertar(k)} style={{ ...chip(false), fontSize: '.66rem', padding: '3px 7px' }}>{t}</button>)}
          </div>
          <div style={{ fontSize: '.66rem', color: 'var(--jordyn-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Escríbelo como lo mandas tú; los botones ponen lo que cambia solo. «El sábado / Mañana / Hoy» se pone según el día. «Tasa» es a cuánto se recibe el bolívar en pesos (ej. 3,19). Entre asteriscos va en negrita: *así*. Si escribes la palabra en MAYÚSCULAS, por ejemplo {'{CUANDO}'}, sale en mayúsculas: «EL SÁBADO».
            {defecto && cfg.mensaje !== defecto && <> <button type="button" onClick={() => set('mensaje', defecto)} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--jordyn-primary-d)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}>Usar la plantilla</button></>}
          </div>
        </>}

        {stats && (
          <div style={{ fontSize: '.7rem', lineHeight: 1.45, marginTop: 8, color: 'var(--jordyn-muted)' }}>
            Le llegaría a <b>{stats.con_telefono}</b> vendedor{stats.con_telefono === 1 ? '' : 'es'}.
            {stats.sin_telefono > 0 && <div style={{ color: stats.con_telefono ? '#a07000' : '#c0392b', fontWeight: 700 }}>{stats.sin_telefono} vendedor{stats.sin_telefono === 1 ? '' : 'es'} sin teléfono no {stats.sin_telefono === 1 ? 'lo recibe' : 'lo reciben'}. Ponles el teléfono en «Números por vendedor» (botón «Agregar teléfono») o en Vendedores.</div>}
            {stats.nuevos > 0 && <> <b>{stats.nuevos}</b> nunca le {stats.nuevos === 1 ? 'ha' : 'han'} escrito a este WhatsApp: {stats.nuevos === 1 ? 'sale' : 'salen'} de a poco y con tope de 30 por día. Si te escriben una vez, les llega al instante.</>}
            {!stats.conectado && <div style={{ color: '#c0392b', fontWeight: 700 }}>WhatsApp no está conectado: mientras tanto no sale nada.</div>}
            {stats.turnos.length > 0 && <div>Últimos envíos: {stats.turnos.map((t) => `${t.turno.slice(5).replace('T', ' ')} (${t.enviados})`).join(' · ')}</div>}
          </div>
        )}
      </div>

      {rifaId ? (
        <div style={caja}>
          <div style={{ fontWeight: 800, fontSize: '.8rem', marginBottom: 5 }}>Probar antes</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input className="jd-input" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Tu WhatsApp: 04121234567" aria-label="Teléfono para la prueba" style={{ flex: '1 1 170px', padding: '6px 10px' }} />
            <button type="button" className="btn-jordyn-outline" onClick={enviarPrueba} disabled={ocupado || !telefono.trim()} style={{ fontSize: '.74rem', padding: '6px 10px' }}>Enviarme una prueba</button>
          </div>
          <div style={{ fontSize: '.64rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>Usa lo que tienes en pantalla, aunque no hayas guardado. Toca «Ver» debajo de una imagen para ver cómo le llega a un vendedor.</div>
        </div>
      ) : (
        <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginBottom: 10 }}>Al guardar la rifa y asignar los vendedores, podrás ver el ejemplo y enviarte una prueba.</div>
      )}

      {ejemplo && (
        <div onClick={(e) => e.target === e.currentTarget && setEjemplo(null)} style={{ position: 'fixed', inset: 0, zIndex: 10600, background: 'rgba(8,22,22,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: '.85rem' }}>Ejemplo: {ejemplo.vendedor}</b>
              <button type="button" onClick={() => setEjemplo(null)} aria-label="Cerrar ejemplo" style={{ border: 'none', background: 'none', fontSize: '1rem', cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
            </div>
            {ejemplo.imagen ? <img src={ejemplo.imagen} alt={`Ejemplo de ${ejemplo.vendedor}`} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
              : <div style={{ fontSize: '.74rem', color: '#a07000' }}>Sin imagen para esa ciudad ni foto de la rifa: sale solo el texto.</div>}
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '.78rem', background: '#e7fbd9', borderRadius: 8, padding: 10, marginTop: 8 }}>{ejemplo.texto}</div>
          </div>
        </div>
      )}
    </div>
  );
}
