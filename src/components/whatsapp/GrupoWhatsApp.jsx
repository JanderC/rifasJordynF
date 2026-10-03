// ============================================================
//  GrupoWhatsApp.jsx — El bot en el grupo de WhatsApp del negocio
//   • Qué grupo es (se detecta por el enlace de la página o se elige)
//   • Avisos automáticos: resultado, foto del ganador, antes del sorteo, rifa nueva
//   • Respuestas en el grupo solo cuando mencionan al bot
//   • Mensaje manual al grupo (texto y/o imagen)
//   • Historial de lo que el bot ha publicado
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import API from '../../services/api';
import './ConfigBot.css';

const TIPOS = {
  resultado: { nombre: 'Resultado',     icono: 'bi-trophy-fill',  color: '#d49000' },
  ganador:   { nombre: 'Ganador',       icono: 'bi-image-fill',   color: '#d49000' },
  previo:    { nombre: 'Recordatorio',  icono: 'bi-alarm-fill',   color: '#118ab2' },
  nueva:     { nombre: 'Rifa nueva',    icono: 'bi-megaphone-fill', color: '#7c3aed' },
  manual:    { nombre: 'Manual',        icono: 'bi-pencil-fill',  color: '#089b98' },
};

const fmtFecha = f =>
  f ? new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }) : '';

function Toggle({ on, onClick, title }) {
  return <button type="button" className={`wcb-toggle${on ? ' on' : ''}`} onClick={onClick} title={title} aria-pressed={on} />;
}

export default function GrupoWhatsApp() {
  const [datos,    setDatos]    = useState(null);   // { config, conectado, grupos, historial }
  const [cfg,      setCfg]      = useState(null);
  const [original, setOriginal] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [texto,    setTexto]    = useState('');
  const [archivo,  setArchivo]  = useState(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef();

  const aplicar = (d) => { setDatos(d); setCfg(d.config); setOriginal(JSON.stringify(d.config)); };
  const load = useCallback(async () => {
    try { aplicar((await API.get('/wa-chat/grupo')).data); }
    catch { toast.error('No se pudo cargar la configuración del grupo'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!cfg) return <div className="d-flex justify-content-center mt-4"><div className="jd-spinner" style={{ width: 36, height: 36 }} /></div>;

  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(cfg) !== original;
  const elegido = datos.grupos.find((g) => g.jid === cfg.jid);
  const listo = datos.conectado && !!cfg.jid;

  const guardar = async () => {
    setSaving(true);
    try {
      aplicar((await API.put('/wa-chat/grupo', cfg)).data);
      toast.success('✅ Guardado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const elegirGrupo = (jid) => {
    const g = datos.grupos.find((x) => x.jid === jid);
    setCfg((p) => ({ ...p, jid, nombre: g?.nombre || '' }));
  };

  const enviar = async () => {
    if (!texto.trim() && !archivo) { toast.error('Escribe el mensaje o adjunta una imagen'); return; }
    if (!window.confirm(`¿Enviar este mensaje al grupo "${cfg.nombre || 'del negocio'}"? Lo verán todos los miembros.`)) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('texto', texto.trim());
      if (archivo) fd.append('imagen', archivo);
      await API.post('/wa-chat/grupo/enviar', fd);
      toast.success('📣 Mensaje enviado al grupo');
      setTexto(''); setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo enviar');
    } finally { setEnviando(false); }
  };

  const Opcion = ({ campo, titulo, children }) => (
    <div className="wcb-opcion">
      <div><b>{titulo}</b><span>{children}</span></div>
      <Toggle on={!!cfg[campo]} onClick={() => set(campo, !cfg[campo])} />
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Estado */}
      <div className="wcb-card">
        <div className="wcb-hero">
          <div className={`icono ${cfg.activo && listo ? 'on' : 'off'}`}><i className="bi bi-people-fill" /></div>
          <div style={{ minWidth: 0 }}>
            <b>{cfg.nombre || 'Grupo sin elegir'}</b>
            <span>
              {!datos.conectado ? 'WhatsApp no está conectado: conéctalo en la pestaña Conexión.'
                : !cfg.jid ? 'El bot no encontró el grupo. Elígelo abajo (el número del bot debe ser miembro).'
                : !cfg.activo ? 'El bot está apagado en el grupo.'
                : elegido ? `${elegido.participantes} miembros · el bot publica avisos y responde si lo mencionan.`
                : 'El bot ya no aparece como miembro de este grupo.'}
            </span>
          </div>
          <Toggle on={!!cfg.activo} onClick={() => set('activo', !cfg.activo)} title="Prender o apagar el bot en el grupo" />
        </div>

        {elegido && !elegido.puede_escribir && (
          <div className="jd-alert jd-alert-warning" style={{ marginTop: 14 }}>
            <i className="bi bi-exclamation-triangle-fill"></i>
            En este grupo solo escriben los administradores. Haz administrador al número del bot para que pueda publicar.
          </div>
        )}

        <label className="wcb-label">Grupo</label>
        <select className="jd-select" value={cfg.jid || ''} onChange={(e) => elegirGrupo(e.target.value)} disabled={!datos.conectado}>
          <option value="">— Elige el grupo —</option>
          {cfg.jid && !elegido && <option value={cfg.jid}>{cfg.nombre || cfg.jid}</option>}
          {datos.grupos.map((g) => <option key={g.jid} value={g.jid}>{g.nombre} · {g.participantes} miembros</option>)}
        </select>
        <div className="wcb-ayuda">
          Solo salen los grupos donde está el número del bot. Si no lo eliges, se usa el del enlace que pusiste en Configuración → Página del cliente.
        </div>
      </div>

      {/* Avisos automáticos */}
      <div className="wcb-card">
        <h4><i className="bi bi-megaphone-fill" />Avisos automáticos</h4>
        <div className="desc">El bot los publica solo en el grupo y cada aviso sale una sola vez. El resultado y la foto del ganador salen apenas los cargas; el recordatorio y la rifa nueva nunca de noche (10 p. m. a 7 a. m.).</div>

        <Opcion campo="avisar_resultado" titulo="Resultado del sorteo">
          Al cargar el número ganador (en Resultados o diciéndoselo al bot), lo publica a los 2 minutos. Si la foto del ganador ya está, sale con ella.
        </Opcion>
        <Opcion campo="avisar_ganador" titulo="Foto del ganador">
          Al subir un ganador en Configuración con su sorteo elegido, publica la foto con el nombre y el premio.
        </Opcion>
        <Opcion campo="avisar_antes_sorteo" titulo="Recordatorio antes del sorteo">
          Avisa que hoy se sortea y cuántos números quedan, con el enlace para comprar. Solo en rifas con hora de sorteo.
        </Opcion>
        {cfg.avisar_antes_sorteo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 10px', fontSize: '.82rem' }}>
            Avisar
            <input type="number" min={1} max={24} className="jd-input" style={{ width: 80 }} value={cfg.horas_antes ?? 2}
              onChange={(e) => set('horas_antes', Math.min(24, Math.max(1, Number(e.target.value) || 1)))} aria-label="Horas antes del sorteo" />
            hora{Number(cfg.horas_antes) === 1 ? '' : 's'} antes del sorteo
          </div>
        )}
        <Opcion campo="avisar_rifa_nueva" titulo="Rifa nueva">
          Unos 10 minutos después de crear una rifa, la anuncia con su premio, precio, ofertas, fecha e imagen.
        </Opcion>

        <label className="wcb-label">Página donde compran (sale en los avisos)</label>
        <input className="jd-input" value={cfg.url_pagina || ''} onChange={(e) => set('url_pagina', e.target.value)} placeholder="https://www.resuelvetusemana.com" inputMode="url" />
      </div>

      {/* Respuestas */}
      <div className="wcb-card">
        <h4><i className="bi bi-chat-quote-fill" />Respuestas en el grupo</h4>
        <div className="desc">El bot nunca contesta todos los mensajes del grupo.</div>
        <Opcion campo="responder_menciones" titulo="Responder cuando lo mencionan">
          Solo si alguien lo menciona (@) o le responde a un mensaje suyo. Contesta corto y con información pública (rifas, precios, números libres,
          resultados). Para comprar le pide al cliente que le escriba por privado: en el grupo no pide datos ni da cuentas.
        </Opcion>
        <div className="wcb-ayuda">Máximo {cfg.max_respuestas_10min || 6} respuestas cada 10 minutos en el grupo, para no llenarlo ni arriesgar el número.</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        <button className="btn-jordyn" onClick={guardar} disabled={saving || !dirty} style={{ fontSize: '.85rem' }}>
          {saving
            ? <><span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Guardando...</>
            : dirty ? <><i className="bi bi-floppy-fill me-1"></i>Guardar cambios</> : <><i className="bi bi-check2 me-1"></i>Guardado</>}
        </button>
      </div>

      {/* Mensaje manual */}
      <div className="wcb-card">
        <h4><i className="bi bi-send-fill" />Enviar un mensaje al grupo</h4>
        <div className="desc">Lo publica el bot ahora mismo. Usa *asteriscos* para negrita.</div>
        <textarea className="jd-input" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={3000}
          placeholder="Ej: 🔥 Hoy se sortea la moto. Quedan pocos números, no te quedes por fuera." style={{ resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" className="btn-jordyn-outline" style={{ fontSize: '.78rem' }} onClick={() => fileRef.current?.click()}>
            <i className="bi bi-image me-1"></i>{archivo ? 'Cambiar imagen' : 'Adjuntar imagen'}
          </button>
          {archivo && (
            <span style={{ fontSize: '.74rem', color: 'var(--jordyn-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {archivo.name}
              <button type="button" onClick={() => { setArchivo(null); if (fileRef.current) fileRef.current.value = ''; }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--jordyn-red)' }} aria-label="Quitar imagen">✕</button>
            </span>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
          <button className="btn-jordyn" style={{ fontSize: '.85rem', marginLeft: 'auto' }} onClick={enviar} disabled={enviando || !listo}>
            {enviando
              ? <><span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Enviando...</>
              : <><i className="bi bi-send-fill me-1"></i>Enviar al grupo</>}
          </button>
        </div>
        {!listo && <div className="wcb-ayuda">Para enviar, WhatsApp debe estar conectado y el grupo elegido.</div>}
      </div>

      {/* Historial */}
      <div className="wcb-card">
        <h4><i className="bi bi-clock-history" />Lo último que publicó el bot</h4>
        {datos.historial.length === 0 ? (
          <div className="desc" style={{ marginBottom: 0 }}>Todavía no ha publicado nada en el grupo.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {datos.historial.map((h) => {
              const tp = TIPOS[h.tipo] || TIPOS.manual;
              return (
                <div key={h.id} style={{ border: '1px solid var(--jordyn-border)', borderRadius: 10, padding: '9px 12px', background: 'var(--jordyn-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: '.64rem', fontWeight: 800, color: tp.color }}><i className={`bi ${tp.icono} me-1`}></i>{tp.nombre.toUpperCase()}</span>
                    {h.imagen_url && <span style={{ fontSize: '.64rem', color: 'var(--jordyn-muted)' }}><i className="bi bi-image me-1"></i>con imagen</span>}
                    {h.estado === 'error' && <span style={{ fontSize: '.64rem', fontWeight: 800, color: 'var(--jordyn-red)' }} title={h.error || ''}>NO SE ENVIÓ</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '.64rem', color: 'var(--jordyn-muted)' }}>{fmtFecha(h.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '.78rem', color: 'var(--jordyn-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{h.texto}</div>
                  {h.estado === 'error' && h.error && <div style={{ fontSize: '.68rem', color: 'var(--jordyn-red)', marginTop: 4 }}>{h.error}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
