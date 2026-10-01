/**
 * ResultadosSorteos.jsx — Cargar el número ganador de cada sorteo
 * El bot usa estos resultados para responder "¿qué cayó?" y "¿quién ganó?".
 * También se pueden cargar por WhatsApp: el dueño le escribe al bot
 * "en la del miércoles cayó el 045".
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import API from '../../services/api';

const fmtFecha = (f) => {
  if (!f) return '';
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
};

const card = { background: 'var(--jordyn-card)', border: '1px solid var(--jordyn-border)', borderRadius: 14, padding: '16px 18px', marginBottom: 14 };
const label = { display: 'block', fontSize: '.66rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 };

function FormResultado({ sorteo, onGuardado }) {
  const [numero, setNumero] = useState('');
  const [premio, setPremio] = useState(sorteo.resultados.length ? `${sorteo.resultados.length + 1}º premio` : 'Premio mayor');
  const [ganador, setGanador] = useState('');
  const [quien, setQuien] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cifras = Number(sorteo.cifras) || 3;
  const completo = numero.replace(/\D/g, '').length === cifras;

  // Al escribir el número completo, muestra quién lo tenía antes de guardar
  useEffect(() => {
    setQuien(null);
    if (!completo) return undefined;
    let vivo = true;
    API.get('/wa-chat/resultados/quien', { params: { rifa_id: sorteo.id, numero } })
      .then((r) => { if (vivo) setQuien(r.data); }).catch(() => {});
    return () => { vivo = false; };
  }, [numero, completo, sorteo.id]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await API.post('/wa-chat/resultados', { rifa_id: sorteo.id, numero, premio, ganador: ganador.trim() || null });
      toast.success(`Resultado guardado: ${premio} · ${numero}`);
      setNumero(''); setGanador('');
      onGuardado();
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  const tenencia = quien && (
    quien.compradores_en_linea.length
      ? <>🎉 Lo compró <b>{quien.compradores_en_linea[0].nombre}</b> por {quien.compradores_en_linea[0].canal === 'whatsapp' ? 'WhatsApp' : 'la página'}{quien.compradores_en_linea[0].telefono ? ` · ${quien.compradores_en_linea[0].telefono}` : ''}</>
      : quien.vendedores.length
        ? <>🧑‍💼 Lo tenía {quien.vendedores.length > 1 ? 'los vendedores' : 'el vendedor'} <b>{quien.vendedores.map((v) => v.vendedor + (v.serie ? ` (serie ${v.serie})` : '')).join(' y ')}</b></>
        : <>Nadie tenía ese número</>
  );

  return (
    <div style={{ background: 'var(--jordyn-bg)', borderRadius: 12, padding: 12, marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 120px' }}>
          <label style={label}>Número que salió</label>
          <input className="jd-input" inputMode="numeric" maxLength={cifras} value={numero} placeholder={'0'.repeat(cifras)}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, cifras))}
            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontWeight: 900, fontSize: '1.2rem', letterSpacing: 4 }} />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label style={label}>Premio</label>
          <input className="jd-input" value={premio} onChange={(e) => setPremio(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={label}>Ganador a anunciar (opcional)</label>
          <input className="jd-input" value={ganador} onChange={(e) => setGanador(e.target.value)} placeholder="Se detecta solo si compró en línea" style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
        <button className="btn-jordyn" onClick={guardar} disabled={!completo || guardando}>
          {guardando ? 'Guardando…' : <><i className="bi bi-trophy me-1" />Guardar resultado</>}
        </button>
      </div>
      {tenencia && <div style={{ marginTop: 9, fontSize: '.8rem', color: 'var(--jordyn-text)' }}>{tenencia}</div>}
    </div>
  );
}

export default function ResultadosSorteos() {
  const [sorteos, setSorteos] = useState(null);

  const cargar = useCallback(() => {
    API.get('/wa-chat/resultados').then((r) => setSorteos(r.data)).catch(() => { setSorteos([]); toast.error('No se pudieron cargar los sorteos'); });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const borrar = async (x) => {
    if (!window.confirm(`¿Borrar el resultado "${x.premio}: ${x.numero}"?`)) return;
    try { await API.delete(`/wa-chat/resultados/${x.id}`); cargar(); } catch { toast.error('No se pudo borrar'); }
  };

  if (!sorteos) return <div className="d-flex justify-content-center mt-4"><div className="jd-spinner" style={{ width: 36, height: 36 }} /></div>;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ ...card, background: 'linear-gradient(135deg, rgba(240,165,0,.08), rgba(10,191,188,.06))' }}>
        <div style={{ fontWeight: 800, fontSize: '.95rem', marginBottom: 4 }}><i className="bi bi-trophy-fill me-2" style={{ color: '#f0a500' }} />Resultados de los sorteos</div>
        <div style={{ fontSize: '.8rem', color: 'var(--jordyn-muted)', lineHeight: 1.6 }}>
          Carga aquí el número que salió y el bot se lo dice a los clientes que pregunten qué cayó o quién ganó.
          También puedes escribirle al bot desde tu WhatsApp: <b>“en la del miércoles cayó el 045”</b>.
          Si un cliente pregunta y aún no está cargado, el bot te avisa. No se envía a todos de forma masiva: eso es lo que bloquea WhatsApp.
        </div>
      </div>

      {sorteos.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--jordyn-muted)' }}>No hay sorteos en los últimos días.</div>}

      {sorteos.map((s) => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${s.resultados.length ? '#06d6a0' : s.ya_sorteo ? '#f0a500' : 'var(--jordyn-border)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{s.nombre}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--jordyn-muted)' }}>
                {fmtFecha(s.fecha_sorteo)}{s.hora_sorteo ? ` · ${s.hora_sorteo.slice(0, 5)}` : ''}{s.loteria_ref ? ` · ${s.loteria_ref}` : ''} · Premio: {s.premio}
              </div>
            </div>
            <span style={{
              fontSize: '.68rem', fontWeight: 800, borderRadius: 20, padding: '3px 10px',
              background: s.resultados.length ? 'rgba(6,214,160,.12)' : s.ya_sorteo ? 'rgba(240,165,0,.14)' : 'var(--jordyn-bg2)',
              color: s.resultados.length ? '#047857' : s.ya_sorteo ? '#a36d00' : 'var(--jordyn-muted)',
            }}>
              {s.resultados.length ? '✓ RESULTADO CARGADO' : s.ya_sorteo ? '⏳ FALTA EL RESULTADO' : 'SE SORTEA HOY'}
            </span>
          </div>

          {s.resultados.map((x) => (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '9px 12px', border: '1px solid var(--jordyn-border)', borderRadius: 10 }}>
              <div style={{ background: 'linear-gradient(135deg,#f0a500,#ffd166)', color: '#3d2a00', fontWeight: 900, fontSize: '1.25rem', letterSpacing: 3, borderRadius: 10, padding: '4px 14px' }}>{x.numero}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.84rem' }}>{x.premio}{x.ganador ? <> · ganador: <span style={{ color: '#047857' }}>{x.ganador}</span></> : ''}</div>
                <div style={{ fontSize: '.74rem', color: 'var(--jordyn-muted)' }}>{x.detalle}</div>
              </div>
              <button onClick={() => borrar(x)} title="Borrar resultado" style={{ border: 'none', background: 'none', color: '#e63946', cursor: 'pointer', fontSize: '1rem' }}><i className="bi bi-trash3" /></button>
            </div>
          ))}

          <FormResultado sorteo={s} onGuardado={cargar} />
        </div>
      ))}
    </div>
  );
}
