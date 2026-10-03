/**
 * WhatsApp.js — Panel de WhatsApp
 *
 * Tabs:
 *  1. Chats     — conversaciones en tiempo real (estilo WhatsApp Web)
 *  2. Conexión  — QR / código de vinculación, estado, cerrar sesión, reset
 *  3. Bot e IA  — proveedor de IA, personalidad, datos de pago, anti-bloqueo, simulador
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import ChatsWhatsApp from '../components/whatsapp/ChatsWhatsApp';
import ConfigBot from '../components/whatsapp/ConfigBot';
import GrupoWhatsApp from '../components/whatsapp/GrupoWhatsApp';
import ResultadosSorteos from '../components/whatsapp/ResultadosSorteos';
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

// Llama a la API de Baileys (mismo origen del backend)
function baileys(path, opts = {}) {
  const token = localStorage.getItem('jordyn_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  return fetch(`${API_BASE}/api/baileys${path}`, { headers, ...opts });
}

// ─────────────────────────────────────────────
// TAB 1 — Conexión (QR / código de vinculación + estado)
// ─────────────────────────────────────────────
const fmtCodigo = c => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c || '');

function TabConexion() {
  const [status, setStatus]     = useState(null);
  const [qr, setQr]             = useState(null);
  const [loading, setLoading]   = useState(true);
  const [ocupado, setOcupado]   = useState('');         // acción en curso
  const [metodo, setMetodo]     = useState('qr');       // 'qr' | 'codigo'
  const [numero, setNumero]     = useState('');
  const timerRef = useRef();

  const fetchStatus = useCallback(async () => {
    try {
      const r = await baileys('/status');
      if (r.status === 401 || r.status === 403) {
        setStatus({ status: 'sin_permiso' });
        return;
      }
      const d = await r.json();
      setStatus(d);
      if (d.status !== 'open' && d.hasQR) {
        const q = await baileys('/qr').then(x => x.json()).catch(() => null);
        setQr(q?.qr || null);
      } else {
        setQr(null);
      }
    } catch { /* backend sin conexión */ }
    finally { setLoading(false); }
  }, []);

  const connected = status?.status === 'open';

  // Mientras no esté conectado se consulta seguido: el QR rota cada ~20 s
  useEffect(() => {
    fetchStatus();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchStatus, connected ? 15000 : 3000);
    return () => clearInterval(timerRef.current);
  }, [fetchStatus, connected]);

  const accion = async (nombre, path, confirmar, okMsg) => {
    if (confirmar && !window.confirm(confirmar)) return;
    setOcupado(nombre);
    try {
      const r = await baileys(path, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Error');
      toast.success(okMsg);
      setQr(null);
      setTimeout(fetchStatus, 1500);
    } catch (e) { toast.error(e.message); }
    finally { setOcupado(''); }
  };

  const pedirCodigo = async () => {
    if (numero.replace(/\D/g, '').length < 10) {
      toast.warning('Escribe el número con código de país, ej. 584241234567');
      return;
    }
    setOcupado('codigo');
    try {
      const r = await baileys('/pairing-code', { method: 'POST', body: JSON.stringify({ numero }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo generar el código');
      setStatus(s => ({ ...s, pairingCode: d.code }));
      toast.success('Código generado — ingrésalo en tu teléfono');
    } catch (e) { toast.error(e.message); }
    finally { setOcupado(''); }
  };

  const est = status?.status;
  const esperando = est === 'connecting';
  const badge = connected
    ? { txt: 'Conectado', css: { background: 'rgba(37,211,102,.1)', color: '#25d366', border: '1px solid rgba(37,211,102,.3)' } }
    : esperando
      ? { txt: 'Esperando vinculación…', css: { background: 'rgba(240,180,0,.1)', color: '#f0b400', border: '1px solid rgba(240,180,0,.3)' } }
      : est === 'replaced'
        ? { txt: 'Sesión abierta en otro servidor', css: { background: 'rgba(230,57,70,.08)', color: '#e63946', border: '1px solid rgba(230,57,70,.25)' } }
        : { txt: status?.reintentos ? `Reconectando… (intento ${status.reintentos})` : 'Desconectado',
            css: { background: 'var(--jordyn-bg2)', color: 'var(--jordyn-muted)', border: '1px solid var(--jordyn-border)' } };

  const btn = (color, bg, borde) => ({
    background: bg, border: `1px solid ${borde}`, color, borderRadius: 8, padding: '7px 14px',
    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit',
  });
  const spin = <span className="jd-spinner" style={{ width: 12, height: 12, borderWidth: 2, display: 'inline-block', marginRight: 6 }}></span>;

  if (loading) return (
    <div className="d-flex justify-content-center mt-4">
      <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
    </div>
  );

  if (est === 'sin_permiso') return (
    <Card><div style={{ color: '#e63946', fontWeight: 700 }}>
      <i className="bi bi-shield-lock me-2"></i>Tu sesión no tiene permiso para gestionar WhatsApp. Vuelve a iniciar sesión como dueño.
    </div></Card>
  );

  return (
    <div style={{ maxWidth: 560 }}>

      {/* Estado */}
      <Card>
        <CardTitle icon="bi-wifi">Estado de la conexión</CardTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, ...badge.css }}>
            <StatusDot ok={connected} />
            {badge.txt}
          </span>
          <button className="btn-jordyn-outline" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={fetchStatus}>
            <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
          </button>
        </div>

        {connected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: '1rem' }}>
            {[
              { l: 'Número', v: status.numeroConectado ? `+${status.numeroConectado}` : '—' },
              { l: 'Nombre', v: status.nombreConectado || '—' },
              { l: 'Cola de mensajes', v: status.queueLength ?? 0 },
              { l: 'Enviados este minuto', v: `${status.rateLimitInfo?.sentInLastMinute ?? 0} / ${status.rateLimitInfo?.maxPerMinute ?? 10}` },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                <div style={{ fontWeight: 800, color: 'var(--jordyn-text)', wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {!connected && status?.ultimoError && (
          <div style={{ marginTop: '0.9rem', fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}>
            <i className="bi bi-info-circle me-1"></i>
            Última desconexión: <strong>{status.ultimoError.motivo}</strong>
            {status.ultimoError.code ? ` (código ${status.ultimoError.code})` : ''}
          </div>
        )}
        {est === 'replaced' && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#e63946', lineHeight: 1.5 }}>
            Otro servidor (por ejemplo el backend corriendo en tu PC) abrió esta misma sesión.
            Ciérralo y pulsa <strong>Reconectar</strong>.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: '1rem', flexWrap: 'wrap' }}>
          {!connected && !esperando && (
            <button disabled={!!ocupado} onClick={() => accion('reconectar', '/reconnect', null, 'Reconectando…')}
              style={btn('#1a8f5a', 'rgba(37,211,102,.08)', 'rgba(37,211,102,.3)')}>
              {ocupado === 'reconectar' ? spin : <i className="bi bi-plug me-1"></i>}Reconectar
            </button>
          )}
          {connected && (
            <button disabled={!!ocupado}
              onClick={() => accion('logout', '/logout', '¿Cerrar sesión de WhatsApp? Tendrás que vincular el teléfono de nuevo.', 'Sesión cerrada — ya puedes vincular otro teléfono')}
              style={btn('#e63946', 'rgba(230,57,70,.08)', 'rgba(230,57,70,.25)')}>
              {ocupado === 'logout' ? spin : <i className="bi bi-box-arrow-right me-1"></i>}Cerrar sesión
            </button>
          )}
          <button disabled={!!ocupado}
            onClick={() => accion('reset', '/reset', '¿Forzar reinicio completo? Se borra la sesión guardada y habrá que vincular de nuevo.', 'Reset hecho — espera el nuevo QR')}
            style={{ ...btn('#b37700', 'rgba(240,180,0,.07)', 'rgba(240,180,0,.25)'), opacity: ocupado ? 0.5 : 1 }}>
            {ocupado === 'reset' ? spin : <i className="bi bi-arrow-counterclockwise me-1"></i>}Reset forzado
          </button>
        </div>
      </Card>

      {/* Vinculación */}
      {!connected && (
        <Card>
          <CardTitle icon="bi-phone">Vincular WhatsApp</CardTitle>

          <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
            {[['qr', 'bi-qr-code', 'Escanear QR'], ['codigo', 'bi-123', 'Código de 8 dígitos']].map(([k, ic, t]) => (
              <button key={k} onClick={() => setMetodo(k)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.8rem', fontWeight: 700,
                background: metodo === k ? 'var(--jordyn-primary)' : 'var(--jordyn-bg2)',
                color: metodo === k ? '#fff' : 'var(--jordyn-text)',
                border: `1px solid ${metodo === k ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
              }}>
                <i className={`bi ${ic} me-1`}></i>{t}
              </button>
            ))}
          </div>

          {metodo === 'qr' && (
            <div style={{ textAlign: 'center', padding: '0.25rem 0 0.5rem' }}>
              {qr ? (
                <>
                  <img src={qr} alt="QR WhatsApp" style={{ width: 240, height: 240, maxWidth: '100%', borderRadius: 12, border: '3px solid var(--jordyn-border)', background: '#fff' }} />
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--jordyn-muted)', lineHeight: 1.6 }}>
                    En tu teléfono: WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> y escanea.<br />
                    El QR se actualiza solo cada pocos segundos.
                  </div>
                </>
              ) : (
                <div style={{ padding: '2rem', color: 'var(--jordyn-muted)', fontSize: '0.82rem' }}>
                  <span className="jd-spinner" style={{ width: 28, height: 28, display: 'inline-block', marginBottom: 8 }}></span>
                  <div>Generando QR…</div>
                  {!esperando && <div style={{ marginTop: 6 }}>Si no aparece, pulsa <strong>Reconectar</strong>.</div>}
                </div>
              )}
            </div>
          )}

          {metodo === 'codigo' && (
            <div>
              {status?.pairingCode ? (
                <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                    Tu código para {status.pairingNumero ? `+${status.pairingNumero}` : 'el teléfono'}
                  </div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: 4, fontFamily: 'monospace', color: 'var(--jordyn-text)', userSelect: 'all' }}>
                    {fmtCodigo(status.pairingCode)}
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--jordyn-muted)', lineHeight: 1.6 }}>
                    En tu teléfono: WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> →
                    <strong> Vincular con número de teléfono</strong> e ingresa el código.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--jordyn-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Para vincular sin escanear: escribe el número de WhatsApp que vas a conectar (con código de país)
                  y te daremos un código para ingresar en el teléfono.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="jd-input"
                  inputMode="tel"
                  placeholder="584241234567"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && pedirCodigo()}
                  style={{ flex: 1, boxSizing: 'border-box' }}
                />
                <button className="btn-jordyn" disabled={ocupado === 'codigo'} onClick={pedirCodigo} style={{ whiteSpace: 'nowrap' }}>
                  {ocupado === 'codigo' ? spin : <i className="bi bi-key me-1"></i>}
                  {status?.pairingCode ? 'Nuevo código' : 'Obtener código'}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────
export default function WhatsApp() {
  const [tab, setTab] = useState('chats');

  const tabs = [
    { key: 'chats',    label: 'Chats',     icon: 'bi-chat-dots-fill' },
    { key: 'conexion', label: 'Conexión',  icon: 'bi-wifi' },
    { key: 'resultados', label: 'Resultados', icon: 'bi-trophy' },
    { key: 'grupo',    label: 'Grupo',     icon: 'bi-people-fill' },
    { key: 'bot',      label: 'Bot e IA',  icon: 'bi-robot' },
  ];

  return (
    <Layout title="WHATSAPP">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: '#25D36618', border: '2px solid #25D36630',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="bi bi-whatsapp" style={{ fontSize: '1.5rem', color: '#25D366' }}></i>
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--jordyn-text)' }}>
            WhatsApp · Ventas y atención
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginTop: 1 }}>
            Chats en tiempo real · Bot vendedor con IA · Comprobantes → reservas → ticket
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} activo={tab} onChange={setTab} />

      <div className="fade-in">
        {tab === 'chats'    && <ChatsWhatsApp />}
        {tab === 'conexion' && <TabConexion />}
        {tab === 'resultados' && <ResultadosSorteos />}
        {tab === 'grupo'    && <GrupoWhatsApp />}
        {tab === 'bot'      && <ConfigBot />}
      </div>

    </Layout>
  );
}
