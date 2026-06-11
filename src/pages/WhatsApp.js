/**
 * WhatsApp.js — Panel de control del bot Baileys + IA (Groq)
 *
 * Tabs:
 *  1. Conexión    — QR, estado, cerrar sesión, reset
 *  2. Chat directo— Enviar texto/imagen a cualquier número
 *  3. Guión       — Ver y editar los triggers del fallback (hardcoded)
 *  4. Entrenar IA — Editar el system prompt del modelo Groq
 *  5. Conversaciones — Historial de mensajes del bot
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const API_BASE = process.env.REACT_APP_API_URL || 'https://rifasjordynb-production.up.railway.app';

// ─────────────────────────────────────────────
// HELPERS DE ESTILO COMPARTIDOS
// ─────────────────────────────────────────────
const Tabs = ({ tabs, activo, onChange }) => (
  <div style={{
    display: 'flex', gap: 2, flexWrap: 'wrap',
    borderBottom: '1px solid var(--jordyn-border)',
    marginBottom: '1.5rem',
  }}>
    {tabs.map(t => (
      <button key={t.key} onClick={() => onChange(t.key)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0.65rem 1rem', fontFamily: 'inherit',
        fontSize: '0.78rem', fontWeight: 700,
        color: activo === t.key ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)',
        borderBottom: activo === t.key ? '2px solid var(--jordyn-primary)' : '2px solid transparent',
        transition: 'all .15s', whiteSpace: 'nowrap',
      }}>
        <i className={`bi ${t.icon} me-1`}></i>{t.label}
      </button>
    ))}
  </div>
);

const FldLabel = ({ children }) => (
  <label style={{
    display: 'block', fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--jordyn-muted)', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 1,
  }}>{children}</label>
);

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: '1rem' }}>
    {label && <FldLabel>{label}</FldLabel>}
    <input className="jd-input" style={{ width: '100%', boxSizing: 'border-box' }} {...props} />
  </div>
);

const Textarea = ({ label, rows = 4, ...props }) => (
  <div style={{ marginBottom: '1rem' }}>
    {label && <FldLabel>{label}</FldLabel>}
    <textarea className="jd-input" rows={rows}
      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} {...props} />
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--jordyn-surface)',
    border: '1px solid var(--jordyn-border)',
    borderRadius: 12, padding: '1.25rem',
    marginBottom: '1.25rem', ...style,
  }}>{children}</div>
);

const CardTitle = ({ icon, children }) => (
  <div style={{
    fontWeight: 800, fontSize: '0.82rem', color: 'var(--jordyn-muted)',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6,
  }}>
    {icon && <i className={`bi ${icon}`} style={{ color: 'var(--jordyn-primary)' }}></i>}
    {children}
  </div>
);

const StatusDot = ({ ok }) => (
  <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: ok ? '#25d366' : 'var(--jordyn-muted)',
    marginRight: 6, flexShrink: 0,
    boxShadow: ok ? '0 0 6px #25d36688' : 'none',
  }} />
);

const Modal = ({ title, children, onClose, size = '600px' }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1050,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      background: 'var(--jordyn-surface)', border: '1px solid var(--jordyn-border)',
      borderRadius: 14, padding: '1.5rem',
      width: '100%', maxWidth: size, maxHeight: '90vh', overflowY: 'auto',
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

// Llama a la API de Baileys (mismo origen del backend)
function baileys(path, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  return fetch(`${API_BASE}/api/baileys${path}`, { headers, ...opts });
}

// ─────────────────────────────────────────────
// TAB 1 — Conexión (QR + estado)
// ─────────────────────────────────────────────
function TabConexion() {
  const [status, setStatus]   = useState(null);
  const [qr, setQr]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const intervalRef = useRef();

  const fetchStatus = useCallback(async () => {
    try {
      const r = await baileys('/status');
      const d = await r.json();
      setStatus(d);
      if (d.status !== 'open') fetchQR();
      else setQr(null);
    } catch { /* sin conexión */ }
    finally { setLoading(false); }
  }, []);

  const fetchQR = async () => {
    try {
      const r = await baileys('/qr');
      const d = await r.json();
      setQr(d.qr || null);
    } catch { setQr(null); }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 9000);
    return () => clearInterval(intervalRef.current);
  }, [fetchStatus]);

  const doLogout = async () => {
    if (!window.confirm('¿Cerrar sesión de WhatsApp? Tendrás que escanear el QR nuevamente.')) return;
    try {
      await baileys('/logout', { method: 'POST' });
      toast.success('Sesión cerrada');
      fetchStatus();
    } catch { toast.error('Error al cerrar sesión'); }
  };

  const doReset = async () => {
    if (!window.confirm('¿Forzar reinicio completo de la sesión? (borra la sesión guardada)')) return;
    setResetting(true);
    try {
      await baileys('/reset', { method: 'POST' });
      toast.success('Reset iniciado — espera el nuevo QR');
      setTimeout(fetchStatus, 3000);
    } catch { toast.error('Error en reset'); }
    finally { setResetting(false); }
  };

  const connected   = status?.status === 'open';
  const connecting  = status?.status === 'connecting';

  const badgeStyle = connected
    ? { background: 'rgba(37,211,102,.1)', color: '#25d366', border: '1px solid rgba(37,211,102,.3)' }
    : connecting
      ? { background: 'rgba(240,180,0,.1)', color: '#f0b400', border: '1px solid rgba(240,180,0,.3)' }
      : { background: 'var(--jordyn-bg2)', color: 'var(--jordyn-muted)', border: '1px solid var(--jordyn-border)' };

  if (loading) return (
    <div className="d-flex justify-content-center mt-4">
      <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
    </div>
  );

  return (
    <div style={{ maxWidth: 520 }}>

      {/* Estado */}
      <Card>
        <CardTitle icon="bi-wifi">Estado de la conexión</CardTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, ...badgeStyle }}>
            <StatusDot ok={connected} />
            {connected ? 'Conectado' : connecting ? 'Esperando QR…' : 'Desconectado'}
          </span>
          <button className="btn-jordyn-outline" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={fetchStatus}>
            <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
          </button>
        </div>

        {status && connected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: '1rem' }}>
            {[
              { l: 'Cola de mensajes', v: status.queueLength ?? 0 },
              { l: 'Enviados este minuto', v: `${status.rateLimitInfo?.sentInLastMinute ?? 0} / ${status.rateLimitInfo?.maxPerMinute ?? 10}` },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                <div style={{ fontWeight: 800, color: 'var(--jordyn-text)' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: '1rem', flexWrap: 'wrap' }}>
          {connected && (
            <button onClick={doLogout} style={{ background: 'rgba(230,57,70,.08)', border: '1px solid rgba(230,57,70,.25)', color: '#e63946', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit' }}>
              <i className="bi bi-box-arrow-right me-1"></i>Cerrar sesión
            </button>
          )}
          <button onClick={doReset} disabled={resetting} style={{ background: 'rgba(240,180,0,.07)', border: '1px solid rgba(240,180,0,.25)', color: '#b37700', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit', opacity: resetting ? 0.5 : 1 }}>
            {resetting ? <><span className="jd-spinner" style={{ width: 12, height: 12, borderWidth: 2, display: 'inline-block', marginRight: 6 }}></span>Reiniciando…</> : <><i className="bi bi-arrow-counterclockwise me-1"></i>Reset forzado</>}
          </button>
        </div>
      </Card>

      {/* QR */}
      {!connected && (
        <Card>
          <CardTitle icon="bi-qr-code">Código QR</CardTitle>
          <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
            {qr ? (
              <>
                <img src={qr} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 12, border: '3px solid var(--jordyn-border)' }} />
                <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--jordyn-muted)', lineHeight: 1.6 }}>
                  Abre WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong>
                </div>
              </>
            ) : (
              <div style={{ padding: '2rem', color: 'var(--jordyn-muted)', fontSize: '0.82rem' }}>
                <i className="bi bi-hourglass-split" style={{ fontSize: '1.8rem', opacity: 0.4, display: 'block', marginBottom: 8 }}></i>
                QR no disponible aún. Esperando…
              </div>
            )}
          </div>
          <button className="btn-jordyn-outline" style={{ width: '100%' }} onClick={fetchQR}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refrescar QR
          </button>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 2 — Chat directo (enviar texto/imagen)
// ─────────────────────────────────────────────
function TabChat() {
  const [numero,    setNumero]    = useState('');
  const [mensaje,   setMensaje]   = useState('');
  const [caption,   setCaption]   = useState('');
  const [imgFile,   setImgFile]   = useState(null);
  const [imgUrl,    setImgUrl]    = useState('');
  const [imgPreview,setImgPreview]= useState(null);
  const [sending,   setSending]   = useState(false);
  const [localHist, setLocalHist] = useState([]); // mensajes enviados en esta sesión
  const fileRef = useRef();
  const chatEndRef = useRef();

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [localHist]);

  const hhmm = () => {
    const n = new Date();
    return n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  };

  const onFileChange = e => {
    const f = e.target.files[0];
    if (!f) return;
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
    setImgUrl('');
  };

  const clearImg = () => { setImgFile(null); setImgPreview(null); setImgUrl(''); fileRef.current.value = ''; };

  const handleSendText = async () => {
    if (!numero.trim() || !mensaje.trim()) return toast.error('Completa número y mensaje');
    setSending(true);
    try {
      const r = await baileys('/send/text', { method: 'POST', body: JSON.stringify({ numero: numero.trim(), mensaje }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setLocalHist(h => [...h, { tipo: 'text', text: mensaje, time: hhmm() }]);
      setMensaje('');
      toast.success('Enviado ✅');
    } catch (e) { toast.error('Error: ' + e.message); }
    finally { setSending(false); }
  };

  const handleSendImage = async () => {
    if (!numero.trim()) return toast.error('Ingresa el número');
    if (!imgFile && !imgUrl.trim()) return toast.error('Selecciona imagen o pega URL');
    setSending(true);
    try {
      let r;
      if (imgFile) {
        const fd = new FormData();
        fd.append('numero', numero.trim()); fd.append('caption', caption); fd.append('imagen', imgFile);
        const token = localStorage.getItem('token');
        r = await fetch(`${API_BASE}/api/baileys/send/image`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
      } else {
        r = await baileys('/send/image', { method: 'POST', body: JSON.stringify({ numero: numero.trim(), caption, imagenUrl: imgUrl.trim() }) });
      }
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setLocalHist(h => [...h, { tipo: 'image', imgSrc: imgPreview || imgUrl, caption, time: hhmm() }]);
      clearImg(); setCaption('');
      toast.success('Imagen enviada ✅');
    } catch (e) { toast.error('Error: ' + e.message); }
    finally { setSending(false); }
  };

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.25rem', alignItems: 'start' }}>

      {/* Formulario de envío */}
      <div>
        <Card>
          <CardTitle icon="bi-telephone-fill">Número destino</CardTitle>
          <Input
            value={numero} onChange={e => setNumero(e.target.value)}
            placeholder="04241234567 — sin espacios ni guiones"
          />
        </Card>

        <Card>
          <CardTitle icon="bi-chat-text-fill">Enviar texto</CardTitle>
          <Textarea
            rows={3} value={mensaje} onChange={e => setMensaje(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe el mensaje… (Enter para enviar)"
          />
          <button className="btn-jordyn" onClick={handleSendText} disabled={sending} style={{ width: '100%' }}>
            {sending
              ? <><span className="jd-spinner" style={{ width: 13, height: 13, borderWidth: 2, display: 'inline-block', marginRight: 6 }}></span>Enviando…</>
              : <><i className="bi bi-send-fill me-1"></i>Enviar texto</>}
          </button>
        </Card>

        <Card>
          <CardTitle icon="bi-image-fill">Enviar imagen</CardTitle>

          {/* Área de drop / click */}
          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${imgFile ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
              borderRadius: 10, padding: '1rem', textAlign: 'center', cursor: 'pointer',
              marginBottom: '0.75rem', transition: 'border-color .15s', position: 'relative',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--jordyn-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = imgFile ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}
          >
            {imgPreview
              ? <img src={imgPreview} alt="" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0 auto' }} />
              : <><i className="bi bi-cloud-upload" style={{ fontSize: '1.5rem', opacity: 0.4 }}></i><div style={{ fontSize: '0.78rem', color: 'var(--jordyn-muted)', marginTop: 6 }}>Click para seleccionar imagen</div></>}
            {imgFile && (
              <button onClick={e => { e.stopPropagation(); clearImg(); }}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(230,57,70,.15)', border: '1px solid rgba(230,57,70,.3)', color: '#e63946', borderRadius: 6, padding: '2px 7px', cursor: 'pointer', fontSize: '0.75rem' }}>
                ✕
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />

          <FldLabel>— o — URL de imagen</FldLabel>
          <input className="jd-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            value={imgUrl} onChange={e => { setImgUrl(e.target.value); setImgFile(null); setImgPreview(null); }}
            placeholder="https://cdn.ejemplo.com/imagen.jpg" />

          <Input label="Caption (opcional)" value={caption} onChange={e => setCaption(e.target.value)} placeholder="¡Aquí está tu ticket! 🎟️" />

          <button className="btn-jordyn" onClick={handleSendImage} disabled={sending} style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
            {sending
              ? <><span className="jd-spinner" style={{ width: 13, height: 13, borderWidth: 2, display: 'inline-block', marginRight: 6 }}></span>Enviando…</>
              : <><i className="bi bi-image-fill me-1"></i>Enviar imagen</>}
          </button>
        </Card>
      </div>

      {/* Mini historial de esta sesión */}
      <div>
        <Card style={{ position: 'sticky', top: 20 }}>
          <CardTitle icon="bi-clock-history">Enviados en esta sesión</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
            {localHist.length === 0 && (
              <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '2rem 0', opacity: 0.6 }}>
                Los mensajes enviados aparecerán aquí
              </div>
            )}
            {localHist.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(10,191,188,.06)', border: '1px solid rgba(10,191,188,.15)',
                borderRadius: 10, padding: '0.65rem 0.9rem',
              }}>
                {m.tipo === 'image' && m.imgSrc && (
                  <img src={m.imgSrc} alt="" style={{ width: '100%', maxHeight: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 4 }} />
                )}
                {(m.text || m.caption) && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--jordyn-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text || m.caption}
                  </div>
                )}
                <div style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', marginTop: 4, textAlign: 'right' }}>
                  <i className="bi bi-check2-all me-1" style={{ color: 'var(--jordyn-primary)' }}></i>{m.time}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 3 — Guión del bot (fallback triggers)
// ─────────────────────────────────────────────
function TabGuion() {
  const [guion,   setGuion]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | { item } | 'nuevo'
  const [form,    setForm]    = useState({ nombre: '', triggers: '', response: '' });
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testRes, setTestRes] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await baileys('/guion');
      const d = await r.json();
      setGuion(d.guion || []);
    } catch { toast.error('No se pudo cargar el guión'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditar = item => {
    setForm({ nombre: item.nombre, triggers: item.triggers.join(', '), response: item.response });
    setModal({ item });
  };

  const openNuevo = () => {
    setForm({ nombre: '', triggers: '', response: '' });
    setModal('nuevo');
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.triggers.trim() || !form.response.trim())
      return toast.error('Completa todos los campos');
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        triggers: form.triggers.split(',').map(t => t.trim()).filter(Boolean),
        response: form.response,
      };
      const isEdit = modal?.item;
      if (isEdit) {
        await API.put(`/baileys/guion/${modal.item.id}`, body);
        toast.success('✅ Nodo actualizado');
      } else {
        await API.post('/baileys/guion', body);
        toast.success('✅ Nodo creado');
      }
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true); setTestRes(null);
    try {
      const r = await baileys('/guion/test', { method: 'POST', body: JSON.stringify({ mensaje: testMsg }) });
      const d = await r.json();
      setTestRes(d.response || '(sin respuesta)');
    } catch { setTestRes('❌ Error al probar'); }
    finally { setTesting(false); }
  };

  return (
    <div>
      {/* Descripción */}
      <div style={{
        background: 'rgba(10,191,188,.06)', border: '1px solid rgba(10,191,188,.2)',
        borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.25rem',
        fontSize: '0.77rem', color: 'var(--jordyn-muted)', lineHeight: 1.7,
      }}>
        <i className="bi bi-info-circle me-2" style={{ color: 'var(--jordyn-primary)' }}></i>
        El <strong style={{ color: 'var(--jordyn-text)' }}>guión de fallback</strong> se activa cuando la IA (Groq) no está disponible o falla.
        Cada nodo tiene <strong>triggers</strong> (palabras clave) y una <strong>respuesta fija</strong> que envía el bot.
        Los triggers se comparan en texto normalizado (sin tildes, minúsculas).
      </div>

      {/* Tester */}
      <Card>
        <CardTitle icon="bi-bug-fill">Probar respuesta</CardTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="jd-input" style={{ flex: 1 }}
            value={testMsg} onChange={e => setTestMsg(e.target.value)}
            placeholder="Escribe un mensaje para ver qué respondería el bot…"
            onKeyDown={e => e.key === 'Enter' && handleTest()} />
          <button className="btn-jordyn-outline" style={{ flexShrink: 0 }} onClick={handleTest} disabled={testing}>
            {testing ? <span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> : <><i className="bi bi-play-fill me-1"></i>Probar</>}
          </button>
        </div>
        {testRes && (
          <div style={{
            marginTop: '0.75rem', background: 'rgba(10,191,188,.07)',
            border: '1px solid rgba(10,191,188,.2)', borderRadius: 8,
            padding: '0.8rem 1rem', fontSize: '0.82rem', color: 'var(--jordyn-text)',
            whiteSpace: 'pre-wrap', lineHeight: 1.6,
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--jordyn-primary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              <i className="bi bi-robot me-1"></i>Respuesta del bot:
            </div>
            {testRes}
          </div>
        )}
      </Card>

      {/* Lista de nodos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--jordyn-muted)' }}>
          {guion.length} nodo{guion.length !== 1 ? 's' : ''} en el guión
        </span>
        <button className="btn-jordyn" onClick={openNuevo}>
          <i className="bi bi-plus-lg me-1"></i>Nuevo nodo
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-4"><div className="jd-spinner" style={{ width: 36, height: 36 }}></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {guion.map(item => (
            <div key={item.id} className="jd-card" style={{ padding: '0.9rem 1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--jordyn-text)' }}>
                      {item.nombre}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', fontWeight: 600 }}>
                      {item.triggers?.length} trigger{item.triggers?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Triggers */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {(item.triggers || []).map(t => (
                      <span key={t} style={{
                        background: 'rgba(10,191,188,.1)', color: 'var(--jordyn-primary)',
                        border: '1px solid rgba(10,191,188,.25)', borderRadius: 5,
                        padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700,
                      }}>{t}</span>
                    ))}
                  </div>
                  {/* Preview respuesta */}
                  <div style={{
                    fontSize: '0.76rem', color: 'var(--jordyn-muted)',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    background: 'var(--jordyn-bg2)', borderRadius: 6,
                    padding: '6px 10px',
                  }}>
                    {item.responsePreview || item.response?.substring(0, 100) + '…'}
                  </div>
                </div>
                <button className="btn-jordyn-outline" style={{ padding: '5px 11px', fontSize: '0.75rem', flexShrink: 0 }}
                  onClick={() => openEditar(item)}>
                  <i className="bi bi-pencil me-1"></i>Editar
                </button>
              </div>
            </div>
          ))}
          {!guion.length && (
            <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '3rem' }}>
              <i className="bi bi-chat-square-dots" style={{ fontSize: '2rem', opacity: 0.3, display: 'block', marginBottom: 8 }}></i>
              No hay nodos en el guión. El bot usará solo la IA.
            </div>
          )}
        </div>
      )}

      {/* Modal edición / creación */}
      {modal && (
        <Modal title={modal === 'nuevo' ? 'Nuevo nodo' : `Editar: ${modal.item?.nombre}`} onClose={() => setModal(null)}>
          <Input label="Nombre del nodo *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="saludo" />
          <div style={{ marginBottom: '1rem' }}>
            <FldLabel>Triggers (separados por coma) *</FldLabel>
            <input className="jd-input" style={{ width: '100%', boxSizing: 'border-box' }}
              value={form.triggers} onChange={e => setForm({ ...form, triggers: e.target.value })}
              placeholder="hola, buenas, buenos dias, hey, inicio" />
            <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>
              El bot compara el mensaje del cliente con cada trigger (sin tildes, minúsculas).
            </div>
          </div>
          <Textarea label="Respuesta del bot *" rows={6} value={form.response} onChange={e => setForm({ ...form, response: e.target.value })}
            placeholder="¡Hola! 👋 Bienvenido a Rifas Jordyn..." />
          <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Puedes usar <code>*negrita*</code>, saltos de línea y emojis. El bot los envía tal cual.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-jordyn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-jordyn" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : <><i className="bi bi-check-lg me-1"></i>Guardar nodo</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 4 — Entrenar IA (system prompt de Groq)
// ─────────────────────────────────────────────
function TabEntrenarIA() {
  const [prompt,   setPrompt]   = useState('');
  const [original, setOriginal] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState('');
  const [testRes,  setTestRes]  = useState(null);
  const [stats,    setStats]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rPrompt, rStats] = await Promise.all([
        API.get('/baileys/ia/prompt').catch(() => ({ data: null })),
        API.get('/baileys/ia/stats').catch(() => ({ data: null })),
      ]);
      if (rPrompt.data?.prompt) { setPrompt(rPrompt.data.prompt); setOriginal(rPrompt.data.prompt); }
      if (rStats.data) setStats(rStats.data);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!prompt.trim()) return toast.error('El prompt no puede estar vacío');
    setSaving(true);
    try {
      await API.put('/baileys/ia/prompt', { prompt });
      setOriginal(prompt);
      toast.success('✅ System prompt actualizado');
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true); setTestRes(null);
    try {
      const r = await API.post('/baileys/ia/test', { mensaje: testMsg });
      setTestRes(r.data?.respuesta || '(sin respuesta)');
    } catch { setTestRes('❌ Error al probar. Verifica que GROQ_API_KEY esté configurada.'); }
    finally { setTesting(false); }
  };

  const hasChanges = prompt !== original;

  if (loading) return (
    <div className="d-flex justify-content-center mt-4">
      <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
    </div>
  );

  return (
    <div>
      {/* Info banner */}
      <div style={{
        background: 'rgba(168,85,247,.06)', border: '1px solid rgba(168,85,247,.2)',
        borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.25rem',
        fontSize: '0.77rem', color: 'var(--jordyn-muted)', lineHeight: 1.7,
      }}>
        <i className="bi bi-robot me-2" style={{ color: '#a855f7' }}></i>
        El <strong style={{ color: 'var(--jordyn-text)' }}>system prompt</strong> define la personalidad, tono y reglas del bot de IA (Groq / Llama).
        Cambia aquí cómo responde el bot, qué sabe del negocio y cómo trata a los clientes.
        El modelo recibe este prompt + el contexto de rifas activas en cada mensaje.
      </div>

      {/* Stats */}
      {stats && (
        <Card>
          <CardTitle icon="bi-bar-chart-fill">Estado del motor IA</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { l: 'Modelo', v: stats.modelo || 'llama-3.3-70b', icon: 'bi-cpu' },
              { l: 'Conversaciones activas', v: stats.totalUsers ?? 0, icon: 'bi-people-fill' },
              { l: 'API Key', v: stats.apiKeyOk ? '✅ Configurada' : '❌ No configurada', icon: 'bi-key-fill' },
            ].map(({ l, v, icon }) => (
              <div key={l} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className={`bi ${icon}`}></i>{l}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--jordyn-text)' }}>{v}</div>
              </div>
            ))}
          </div>
          <button className="btn-jordyn-outline" style={{ marginTop: '0.75rem', fontSize: '0.78rem', padding: '5px 12px' }}
            onClick={() => API.post('/baileys/ia/clear-history').then(() => { toast.success('Historiales borrados'); load(); }).catch(() => toast.error('Error'))}>
            <i className="bi bi-trash me-1"></i>Borrar todos los historiales de conversación
          </button>
        </Card>
      )}

      {/* Editor del prompt */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <CardTitle icon="bi-pencil-square" style={{ margin: 0 }}>System Prompt</CardTitle>
          {hasChanges && (
            <span style={{ fontSize: '0.7rem', color: '#f0b400', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="bi bi-circle-fill" style={{ fontSize: '0.5rem' }}></i>Sin guardar
            </span>
          )}
        </div>
        <textarea
          className="jd-input"
          rows={18}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.7,
          }}
          placeholder={`Eres una persona real que atiende los clientes de Rifas Jordyn por WhatsApp...\n\nNombre del negocio: Rifas Jordyn\nTono: cercano, natural, como texto de WhatsApp en Venezuela\n\nReglas:\n- No menciones que eres un bot\n- Frases cortas y directas\n- Usa emojis con moderación...`}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)' }}>
            {prompt.length.toLocaleString()} caracteres · ~{Math.round(prompt.length / 4).toLocaleString()} tokens
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasChanges && (
              <button className="btn-jordyn-outline" onClick={() => setPrompt(original)} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>Revertir
              </button>
            )}
            <button className="btn-jordyn" onClick={handleSave} disabled={saving || !hasChanges}>
              {saving
                ? <><span className="jd-spinner" style={{ width: 13, height: 13, borderWidth: 2, display: 'inline-block', marginRight: 6 }}></span>Guardando…</>
                : <><i className="bi bi-floppy-fill me-1"></i>Guardar prompt</>}
            </button>
          </div>
        </div>
      </Card>

      {/* Tester IA */}
      <Card>
        <CardTitle icon="bi-chat-left-dots-fill">Probar con la IA real</CardTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
          <input className="jd-input" style={{ flex: 1 }}
            value={testMsg} onChange={e => setTestMsg(e.target.value)}
            placeholder="Escribe un mensaje de prueba para la IA…"
            onKeyDown={e => e.key === 'Enter' && handleTest()} />
          <button className="btn-jordyn" style={{ flexShrink: 0 }} onClick={handleTest} disabled={testing}>
            {testing
              ? <span className="jd-spinner" style={{ width: 13, height: 13, borderWidth: 2 }}></span>
              : <><i className="bi bi-send-fill me-1"></i>Probar</>}
          </button>
        </div>
        {testRes && (
          <div style={{
            background: 'rgba(168,85,247,.07)', border: '1px solid rgba(168,85,247,.2)',
            borderRadius: 8, padding: '0.85rem 1rem',
            fontSize: '0.82rem', color: 'var(--jordyn-text)', whiteSpace: 'pre-wrap', lineHeight: 1.6,
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a855f7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              <i className="bi bi-robot me-1"></i>Respuesta de Groq:
            </div>
            {testRes}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 5 — Conversaciones (logs del bot)
// ─────────────────────────────────────────────
function TabConversaciones() {
  const [sesiones,     setSesiones]     = useState([]);
  const [logs,         setLogs]         = useState([]);
  const [selectedNum,  setSelectedNum]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [loadingLogs,  setLoadingLogs]  = useState(false);
  const logsEndRef = useRef();

  const loadSesiones = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get('/whatsapp/flujo/sesiones');
      setSesiones(r.data);
    } catch { /* sin historial disponible */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSesiones(); }, [loadSesiones]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const loadLogs = async numero => {
    setSelectedNum(numero);
    setLoadingLogs(true);
    try {
      const r = await API.get(`/whatsapp/flujo/logs?numero=${encodeURIComponent(numero)}`);
      setLogs(r.data);
    } catch { setLogs([]); }
    finally { setLoadingLogs(false); }
  };

  const clearHistorial = async numero => {
    try {
      await API.delete(`/baileys/ia/history/${encodeURIComponent(numero)}`);
      toast.success('Historial de IA borrado');
    } catch { toast.error('Error'); }
  };

  const estadoColor = { activo: '#25d366', completado: 'var(--jordyn-primary)', expirado: 'var(--jordyn-muted)', cancelado: '#e63946' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedNum ? '260px 1fr' : '1fr', gap: '1rem', alignItems: 'start' }}>

      {/* Lista de sesiones */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Conversaciones
        </div>
        {loading ? (
          <div className="d-flex justify-content-center mt-4"><div className="jd-spinner" style={{ width: 32, height: 32 }}></div></div>
        ) : !sesiones.length ? (
          <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', padding: '3rem', background: 'var(--jordyn-bg2)', borderRadius: 10, border: '1px solid var(--jordyn-border)' }}>
            <i className="bi bi-chat-dots" style={{ fontSize: '2rem', opacity: 0.3, display: 'block', marginBottom: 8 }}></i>
            Sin conversaciones aún
          </div>
        ) : sesiones.map(s => (
          <div key={s.id} onClick={() => loadLogs(s.wa_numero)} style={{
            padding: '0.75rem 0.9rem', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
            background: selectedNum === s.wa_numero ? 'rgba(10,191,188,.08)' : 'var(--jordyn-bg2)',
            border: `1px solid ${selectedNum === s.wa_numero ? 'rgba(10,191,188,.3)' : 'var(--jordyn-border)'}`,
            transition: 'all .15s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--jordyn-text)' }}>{s.wa_numero}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: estadoColor[s.estado] || 'var(--jordyn-muted)', display: 'inline-block' }}></span>
            </div>
            {s.nombre_cliente && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>{s.nombre_cliente}</div>}
            {s.nodo_nombre    && <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-primary)' }}>📍 {s.nodo_nombre}</div>}
            <div style={{ fontSize: '0.6rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
              {new Date(s.ultimo_mensaje).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        ))}
      </div>

      {/* Chat log */}
      {selectedNum && (
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, overflow: 'hidden', minHeight: 300 }}>
          <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--jordyn-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--jordyn-surface)', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--jordyn-text)' }}>
              <i className="bi bi-whatsapp me-2" style={{ color: '#25D366' }}></i>{selectedNum}
            </span>
            <button onClick={() => clearHistorial(selectedNum)}
              style={{ background: 'none', border: '1px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit' }}>
              <i className="bi bi-trash me-1"></i>Borrar historial IA
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '56vh', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingLogs ? (
              <div className="d-flex justify-content-center mt-4"><div className="jd-spinner" style={{ width: 28, height: 28 }}></div></div>
            ) : logs.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: l.direccion === 'saliente' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '72%', padding: '0.6rem 0.9rem', borderRadius: 10,
                  background: l.direccion === 'saliente' ? 'rgba(10,191,188,.15)' : 'var(--jordyn-surface)',
                  border: `1px solid ${l.direccion === 'saliente' ? 'rgba(10,191,188,.25)' : 'var(--jordyn-border)'}`,
                  fontSize: '0.78rem', color: 'var(--jordyn-text)',
                }}>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.contenido}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--jordyn-muted)', marginTop: 3, textAlign: 'right' }}>
                    {new Date(l.created_at).toLocaleTimeString('es-VE', { timeStyle: 'short' })}
                    {l.direccion === 'saliente' && (
                      <i className={`bi bi-check${l.estado_envio === 'leido' ? '2-all' : l.estado_envio === 'entregado' ? '2' : ''} ms-1`}
                        style={{ color: l.estado_envio === 'leido' ? '#25D366' : undefined }}></i>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!loadingLogs && !logs.length && (
              <div style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontSize: '0.82rem', marginTop: '2rem' }}>
                Sin mensajes registrados
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PÁGINA PRINCIPAL//
// ─────────────────────────────────────────────
export default function WhatsApp() {
  const [tab, setTab] = useState('conexion');

  const tabs = [
    { key: 'conexion',        label: 'Conexión',      icon: 'bi-wifi' },
    { key: 'chat',            label: 'Chat directo',  icon: 'bi-chat-text-fill' },
    { key: 'guion',           label: 'Guión',         icon: 'bi-list-check' },
    { key: 'ia',              label: 'Entrenar IA',   icon: 'bi-robot' },
    { key: 'conversaciones',  label: 'Conversaciones',icon: 'bi-whatsapp' },
  ];

  return (
    <Layout title="WHATSAPP BOT">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: '#25D36618', border: '2px solid #25D36630',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="bi bi-whatsapp" style={{ fontSize: '1.5rem', color: '#25D366' }}></i>
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--jordyn-text)' }}>
            WhatsApp Bot · Baileys
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginTop: 1 }}>
            Bot IA con Groq · Guión de fallback · Comprobantes automáticos · Reservas vía WhatsApp
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} activo={tab} onChange={setTab} />

      <div className="fade-in">
        {tab === 'conexion'       && <TabConexion />}
        {tab === 'chat'           && <TabChat />}
        {tab === 'guion'          && <TabGuion />}
        {tab === 'ia'             && <TabEntrenarIA />}
        {tab === 'conversaciones' && <TabConversaciones />}
      </div>

    </Layout>
  );
}