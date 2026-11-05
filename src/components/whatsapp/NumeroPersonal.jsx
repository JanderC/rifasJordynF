// ============================================================
//  NumeroPersonal.jsx — WhatsApp → Número personal
//  Vincula el WhatsApp personal del dueño SOLO con código (sin QR) y
//  elige si los recordatorios de pago salen por ahí. No muestra chats.
//  El número permitido y los términos vienen del backend
//  (backend/config/numeroPersonal.js).
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import API from '../../services/api';
import { toast } from 'react-toastify';

const ORO = '#c9a227';
const fmtCodigo = (c) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c || '');
const fecha = (d) => (d ? new Date(d).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

function Paso({ n, titulo, children, hecho }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '.8rem',
        background: hecho ? '#25d366' : 'linear-gradient(135deg,#1b2a3a,#2d4256)', color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
        {hecho ? <i className="bi bi-check-lg"></i> : n}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '.84rem' }}>{titulo}</div>
        <div style={{ fontSize: '.76rem', color: 'var(--jordyn-muted)', lineHeight: 1.45, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  );
}

export default function NumeroPersonal() {
  const [d, setD] = useState(null);
  const [acepto, setAcepto] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const [telefono, setTelefono] = useState('');

  const cargar = useCallback(() => API.get('/numero-personal').then((r) => setD(r.data)).catch(() => {}), []);
  useEffect(() => { cargar(); }, [cargar]);
  // Mientras espera el código, se revisa seguido para ver cuándo queda vinculado
  useEffect(() => {
    const ms = d?.estado === 'esperando_codigo' || d?.estado === 'iniciando' ? 3000 : 20000;
    const i = setInterval(cargar, ms);
    return () => clearInterval(i);
  }, [d?.estado, cargar]);

  const accion = async (cual, fn, ok) => {
    setOcupado(cual);
    try { await fn(); if (ok) toast.success(ok); await cargar(); }
    catch (e) { toast.error(e.response?.data?.error || 'No se pudo completar'); }
    finally { setOcupado(''); }
  };
  const pedirCodigo = () => accion('codigo', () => API.post('/numero-personal/codigo', { acepto: true }));
  const desvincular = () => {
    if (!window.confirm(`¿Desvincular ${d.visible}? Los recordatorios volverán a salir por el número del negocio.`)) return;
    accion('desvincular', () => API.post('/numero-personal/desvincular'), 'Número personal desvinculado');
  };
  const cambiarUso = (si) => accion('uso', () => API.put('/numero-personal/uso', { recordatorios: si }),
    si ? 'Los recordatorios saldrán por tu número personal' : 'Los recordatorios saldrán por el número del negocio');
  const prueba = () => accion('prueba', () => API.post('/numero-personal/prueba', { telefono }), 'Prueba en camino');

  if (!d) return <div style={{ padding: 30, textAlign: 'center' }}><span className="jd-spinner"></span></div>;

  const conectado = d.conectado;
  const esperando = d.estado === 'esperando_codigo' && d.codigo;
  const tarjeta = { background: 'var(--jordyn-surface)', border: '1px solid var(--jordyn-border)', borderRadius: 16, padding: '1.25rem', marginBottom: 16 };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* ── Encabezado premium ── */}
      <div style={{ borderRadius: 18, padding: '1.4rem 1.25rem', marginBottom: 16, color: '#fff', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg,#0f1c2b 0%,#1b2f45 55%,#0b4f4a 100%)', boxShadow: '0 10px 30px rgba(11,40,60,.25)' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,211,102,.35),transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.66rem', fontWeight: 800, letterSpacing: 2, color: ORO, textTransform: 'uppercase' }}>
          <i className="bi bi-gem"></i> Módulo premium · Resuelve tu Semana
        </div>
        <div style={{ fontWeight: 900, fontSize: '1.25rem', marginTop: 6 }}>Número personal</div>
        <div style={{ fontSize: '.8rem', opacity: .85, marginTop: 4, maxWidth: 520, lineHeight: 1.45 }}>
          Los recordatorios de pago a tus clientes salen desde tu propio WhatsApp, sin que tengas que escribirlos uno por uno.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {[['bi-shield-lock-fill', 'Conexión cifrada de extremo a extremo'], ['bi-eye-slash-fill', 'No lee tus chats'], ['bi-speedometer2', 'Envío anti-bloqueo']].map(([i, t]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.68rem', fontWeight: 700, padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)' }}>
              <i className={`bi ${i}`} style={{ color: '#25d366' }}></i>{t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Estado ── */}
      <div style={{ ...tarjeta, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: conectado ? '#25d36618' : 'var(--jordyn-bg2)', border: `2px solid ${conectado ? '#25d36655' : 'var(--jordyn-border)'}` }}>
          <i className="bi bi-phone-fill" style={{ fontSize: '1.4rem', color: conectado ? '#25d366' : 'var(--jordyn-muted)' }}></i>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: .5 }}>{d.visible}</div>
          <div style={{ fontSize: '.74rem', fontWeight: 700, color: conectado ? '#1e9e50' : esperando ? '#a07000' : 'var(--jordyn-muted)', marginTop: 2 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6, background: conectado ? '#25d366' : esperando ? ORO : '#b9c4c4' }} />
            {conectado ? `Vinculado${d.conectado_desde ? ` · desde ${fecha(d.conectado_desde)}` : ''}` : esperando ? 'Esperando que metas el código en tu teléfono…' : d.estado === 'iniciando' ? 'Conectando…' : 'Sin vincular'}
          </div>
        </div>
        {conectado && (
          <div style={{ display: 'flex', gap: 18, textAlign: 'center' }}>
            <div><div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{d.enviados_hoy}</div><div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)', fontWeight: 700 }}>ENVIADOS HOY</div></div>
            <div><div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{d.tope_dia}</div><div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)', fontWeight: 700 }}>TOPE DIARIO</div></div>
          </div>
        )}
      </div>
      {d.ultimo_error && !conectado && (
        <div role="alert" style={{ ...tarjeta, padding: '.75rem 1rem', background: '#fff6e5', borderColor: '#f1d39a', fontSize: '.78rem', color: '#7a5600' }}>
          <i className="bi bi-exclamation-triangle-fill me-1"></i>{d.ultimo_error.motivo}
        </div>
      )}

      {/* ── Vincular ── */}
      {!conectado && (
        <div style={tarjeta}>
          {!esperando ? <>
            <div style={{ fontWeight: 900, fontSize: '.95rem', marginBottom: 10 }}>Términos y condiciones</div>
            <div style={{ background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 12, padding: '12px 14px', fontSize: '.78rem', lineHeight: 1.55 }}>
              {d.terminos.map((t, i) => <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>{t}</p>)}
              <p style={{ margin: '10px 0 0', color: '#8a5a00', fontWeight: 600 }}><i className="bi bi-info-circle-fill me-1"></i>{d.aviso}</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--jordyn-primary)' }} />
              Leí y acepto los términos para vincular {d.visible}
            </label>
            <button type="button" className="btn-jordyn" disabled={!acepto || !!ocupado} onClick={pedirCodigo} style={{ marginTop: 14, width: '100%', padding: '12px', fontSize: '.88rem' }}>
              {ocupado === 'codigo' ? <><span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }}></span>Generando código seguro…</> : <><i className="bi bi-key-fill me-2"></i>Generar código de vinculación</>}
            </button>
            <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 8, textAlign: 'center' }}>Solo se puede vincular {d.visible}. Cualquier otro número se rechaza.</div>
          </> : <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: 2, color: 'var(--jordyn-muted)' }}>TU CÓDIGO</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '2.2rem', letterSpacing: 6, margin: '6px 0', color: '#0f1c2b' }}>{fmtCodigo(d.codigo)}</div>
              <button type="button" className="btn-jordyn-outline" onClick={() => { navigator.clipboard?.writeText(d.codigo); toast.success('Código copiado'); }} style={{ fontSize: '.74rem', padding: '5px 12px' }}>
                <i className="bi bi-clipboard me-1"></i>Copiar
              </button>
              {d.codigo_vence && <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 6 }}>Vence a las {new Date(d.codigo_vence).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}</div>}
            </div>
            <Paso n={1} titulo="Abre WhatsApp en el teléfono">En el teléfono con el número {d.visible}.</Paso>
            <Paso n={2} titulo="Ve a Dispositivos vinculados">Menú ⋮ (o Configuración en iPhone) → Dispositivos vinculados → Vincular un dispositivo.</Paso>
            <Paso n={3} titulo="Elige «Vincular con número de teléfono»">Abajo de la cámara, toca «Vincular con el número de teléfono en su lugar».</Paso>
            <Paso n={4} titulo="Escribe el código">Mete el código de arriba. Esta pantalla se actualiza sola cuando quede vinculado.</Paso>
            <button type="button" className="btn-jordyn-outline" disabled={!!ocupado} onClick={pedirCodigo} style={{ width: '100%', fontSize: '.78rem', marginTop: 4 }}>Generar otro código</button>
          </>}
        </div>
      )}

      {/* ── Uso ── */}
      {conectado && <>
        <div style={tarjeta}>
          <div style={{ fontWeight: 900, fontSize: '.95rem', marginBottom: 4 }}>¿Por qué número salen los recordatorios de pago?</div>
          <div style={{ fontSize: '.74rem', color: 'var(--jordyn-muted)', marginBottom: 12 }}>Los clientes con números apartados reciben el recordatorio desde el número que elijas. Si eliges el personal y se desconecta, salen por el del negocio.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[[false, 'bi-shop', 'Número del negocio', 'Como hasta ahora'], [true, 'bi-person-badge-fill', 'Mi número personal', d.visible]].map(([si, icono, titulo, sub]) => {
              const on = d.recordatorios === si;
              return (
                <button key={titulo} type="button" disabled={!!ocupado} onClick={() => !on && cambiarUso(si)} aria-pressed={on}
                  style={{ flex: '1 1 200px', textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: on ? 'default' : 'pointer',
                    border: `2px solid ${on ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, background: on ? '#0abfbc12' : '#fff' }}>
                  <i className={`bi ${icono}`} style={{ fontSize: '1.2rem', color: on ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)' }}></i>
                  <div style={{ fontWeight: 800, fontSize: '.84rem', marginTop: 4 }}>{titulo} {on && <i className="bi bi-check-circle-fill" style={{ color: 'var(--jordyn-primary)' }}></i>}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--jordyn-muted)' }}>{sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={tarjeta}>
          <div style={{ fontWeight: 800, fontSize: '.84rem', marginBottom: 6 }}>Probar el envío</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="jd-input" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Otro WhatsApp: 04141234567" aria-label="Teléfono para la prueba" style={{ flex: '1 1 180px', padding: '8px 10px' }} />
            <button type="button" className="btn-jordyn-outline" disabled={!!ocupado || !telefono.trim()} onClick={prueba} style={{ fontSize: '.78rem' }}>Enviar prueba</button>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button type="button" onClick={desvincular} disabled={!!ocupado} style={{ border: 'none', background: 'none', color: '#c0392b', fontWeight: 700, fontSize: '.76rem', cursor: 'pointer' }}>
            <i className="bi bi-plug me-1"></i>Desvincular número personal
          </button>
        </div>
      </>}
    </div>
  );
}
