// ============================================================
//  RecordatoriosApartados.jsx — Reservas → Apartados sin pagar
//  Por cada rifa con números apartados: el dueño elige el día y
//  la hora en que el bot les recuerda el pago, o lo manda ya, y
//  ve qué salió y a quién no le llegó.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import API from '../services/api';
import { toast } from 'react-toastify';

const TZ = 'America/Caracas';
const fmtMomento = (iso) => new Date(iso).toLocaleString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
// Lo que se escribe en el campo siempre es hora de Venezuela
const veAIso = (v) => new Date(`${v}:00-04:00`).toISOString();
const mananaNueve = () => {
  const d = new Date(Date.now() - 4 * 3600000 + 24 * 3600000);
  return `${d.toISOString().slice(0, 10)}T09:00`;
};

function Fallidos({ lista }) {
  if (!lista.length) return null;
  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: '.68rem', color: '#c0392b' }}>
      {lista.map((f, i) => <li key={i}>{f.nombre}{f.telefono ? ` (${f.telefono})` : ''}: {f.error}</li>)}
    </ul>
  );
}

function FilaMomento({ p, ocupado, onQuitar }) {
  const pasada = new Date(p.momento).getTime() <= Date.now();
  const hubo = p.enviados > 0 || p.fallidos.length > 0;
  const color = !pasada ? 'var(--jordyn-primary-d)' : hubo ? '#128c7e' : 'var(--jordyn-muted)';
  return (
    <div style={{ padding: '6px 0', borderTop: '1px solid var(--jordyn-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '.78rem' }}>
        <b style={{ textTransform: 'capitalize', color: 'var(--jordyn-text)' }}>{fmtMomento(p.momento)}</b>
        <span style={{ color, fontWeight: 700, fontSize: '.7rem' }}>
          {!pasada ? 'Programado'
            : hubo ? `Salieron ${p.enviados}${p.fallidos.length ? `, no llegaron ${p.fallidos.length}` : ''}`
              : 'No salió'}
        </span>
        {!pasada && (
          <button type="button" onClick={onQuitar} disabled={ocupado} style={{ marginLeft: 'auto', border: 'none', background: 'none', padding: 0, color: '#c0392b', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer' }}>Quitar</button>
        )}
      </div>
      <Fallidos lista={p.fallidos} />
    </div>
  );
}

function TarjetaRifa({ r, global, onCambio }) {
  const [fecha, setFecha] = useState(mananaNueve);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const guardar = async (lista, aviso) => {
    setOcupado(true);
    try {
      await API.put(`/publico/admin/recordatorios/${r.rifa_id}/programados`, { programados: lista });
      toast.success(aviso);
      await onCambio();
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setOcupado(false); }
  };

  const actuales = r.programados.map((p) => p.momento);
  const agregar = () => {
    if (!fecha) { toast.error('Elige el día y la hora'); return; }
    const iso = veAIso(fecha);
    if (new Date(iso).getTime() <= Date.now()) { toast.error('Esa hora ya pasó. Para enviarlo ya, usa "Enviar ahora"'); return; }
    guardar([...actuales, iso], `🔔 Programado para ${fmtMomento(iso)}`);
  };

  const enviarAhora = async () => {
    setConfirmar(false);
    setOcupado(true);
    try {
      const x = await API.post(`/publico/admin/recordatorios/${r.rifa_id}/enviar`);
      toast.success(`🔔 Saliendo de a poco a ${x.data.total} persona${x.data.total === 1 ? '' : 's'}`);
      await onCambio();
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo enviar'); }
    finally { setOcupado(false); }
  };

  const minutos = Math.max(1, Math.round((r.nuevos_para_el_bot * 165 + (r.personas - r.nuevos_para_el_bot) * 30) / 60));
  const encurso = r.envio_en_curso;

  return (
    <div className="jd-card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--jordyn-text)' }}>{r.nombre}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--jordyn-muted)' }}>{r.personas} persona{r.personas === 1 ? '' : 's'} · {r.numeros} número{r.numeros === 1 ? '' : 's'} apartado{r.numeros === 1 ? '' : 's'}</div>
        </div>
        <button className="btn-jordyn-outline" disabled={ocupado || !!encurso || !global.conectado} onClick={() => setConfirmar(true)} style={{ fontSize: '.74rem', padding: '6px 11px' }}>
          {encurso ? `Enviando ${encurso.hechos} de ${encurso.total}…` : `Enviar ahora a todos (${r.personas})`}
        </button>
      </div>

      {confirmar && (
        <div style={{ marginTop: 8, padding: '9px 11px', background: '#f0fbf8', borderRadius: 8, fontSize: '.76rem', lineHeight: 1.45 }}>
          <b>¿Enviar el recordatorio ya a {r.personas} persona{r.personas === 1 ? '' : 's'}?</b>
          {r.nuevos_para_el_bot > 0 && <> {r.nuevos_para_el_bot} nunca le {r.nuevos_para_el_bot === 1 ? 'ha' : 'han'} escrito a este WhatsApp: {r.nuevos_para_el_bot === 1 ? 'sale' : 'salen'} con pausas para que no lo bloqueen.</>} Tarda unos {minutos} minutos.
          <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
            <button className="btn-jordyn" onClick={enviarAhora} style={{ fontSize: '.74rem', padding: '6px 12px' }}>Sí, enviar</button>
            <button className="btn-jordyn-outline" onClick={() => setConfirmar(false)} style={{ fontSize: '.74rem', padding: '6px 12px' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 6px' }}>
        <input className="jd-input" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label={`Día y hora del recordatorio de ${r.nombre}`} style={{ flex: '1 1 190px', maxWidth: 240 }} />
        <button className="btn-jordyn" onClick={agregar} disabled={ocupado} style={{ fontSize: '.76rem', padding: '8px 12px' }}>
          <i className="bi bi-bell-fill me-1"></i>Programar
        </button>
      </div>

      {r.programados.length === 0
        ? <div style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)' }}>Sin fechas propias: esta rifa usa los recordatorios generales{global.generales_activos ? '.' : ', que están apagados. Hoy no le saldría ninguno.'}</div>
        : r.programados.map((p) => (
          <FilaMomento key={p.momento} p={p} ocupado={ocupado}
            onQuitar={() => guardar(actuales.filter((m) => m !== p.momento), 'Recordatorio quitado')} />
        ))}

      {(r.otros_enviados > 0 || r.otros_fallidos.length > 0) && (
        <div style={{ paddingTop: 6, borderTop: '1px solid var(--jordyn-border)', fontSize: '.72rem', color: 'var(--jordyn-muted)' }}>
          Otros envíos: salieron {r.otros_enviados}{r.otros_fallidos.length ? `, no llegaron ${r.otros_fallidos.length}` : ''}
          <Fallidos lista={r.otros_fallidos} />
        </div>
      )}
    </div>
  );
}

export default function RecordatoriosApartados() {
  const [datos, setDatos] = useState(null);
  const cargar = useCallback(() => API.get('/publico/admin/recordatorios').then((r) => setDatos(r.data)).catch(() => {}), []);

  useEffect(() => { cargar(); }, [cargar]);
  const enviando = datos?.rifas.some((r) => r.envio_en_curso);
  useEffect(() => {
    if (!enviando) return undefined;
    const reloj = setInterval(cargar, 20000);
    return () => clearInterval(reloj);
  }, [enviando, cargar]);

  if (!datos || !datos.rifas.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--jordyn-text)', marginBottom: 2 }}>
        <i className="bi bi-bell-fill me-1" style={{ color: '#7c3aed' }}></i>Recordatorios de pago
      </div>
      <div style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)', marginBottom: 8, lineHeight: 1.45 }}>
        Elige el día y la hora (de Venezuela) en que el bot les escribe a quienes tienen números apartados sin pagar. A quien ya pagó no le llega.
      </div>
      {(!datos.conectado || !datos.bot_activo) && (
        <div className="jd-alert jd-alert-warning" style={{ marginBottom: 8 }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          {!datos.conectado ? 'WhatsApp no está conectado: mientras tanto no sale ningún recordatorio.' : 'El bot está apagado: mientras tanto no sale ningún recordatorio programado.'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
        {datos.rifas.map((r) => <TarjetaRifa key={r.rifa_id} r={r} global={datos} onCambio={cargar} />)}
      </div>
    </div>
  );
}
