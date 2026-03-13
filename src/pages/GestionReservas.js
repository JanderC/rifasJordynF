import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const COP   = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
const fmtTs = f => new Date(f).toLocaleString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const fmtF  = f => f ? new Date(f).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Por definir';

const EST = {
  pendiente: { bg:'rgba(240,165,0,.10)',  color:'#b37700',  border:'rgba(240,165,0,.30)',  label:'⏳ Pendiente', dot:'#f0a500' },
  aprobado:  { bg:'rgba(6,214,160,.10)',  color:'#059669',  border:'rgba(6,214,160,.30)',  label:'✅ Aprobado',  dot:'#06d6a0' },
  rechazado: { bg:'rgba(230,57,70,.10)',  color:'#e63946',  border:'rgba(230,57,70,.25)',  label:'❌ Rechazado', dot:'#e63946' },
};

/* ─── WhatsApp ─── */
const WaIcon = ({ size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ─── Ticket WhatsApp — soporta múltiples números ─── */
const buildTicketMsg = (r, nota, numerosExtra = []) => {
  const id       = r.id?.slice(0,8).toUpperCase() || '-------';
  const todos    = [r.numero, ...numerosExtra].filter(Boolean);
  const numStr   = todos.length > 1
    ? todos.map(n => `*${n}*`).join(' · ')
    : `*${r.numero}*`;
  const totalVal = r.precio * todos.length;

  return (
    `*RIFAS JORDYN* — ✅ PAGO CONFIRMADO\n\n` +
    `Hola *${r.nombre_cliente}* 🎉 ¡Tu${todos.length > 1 ? 's números fueron aprobados' : ' número fue aprobado'}!\n\n` +
    `🎟 Número${todos.length > 1 ? 's' : ''}: ${numStr}\n` +
    `🏆 Premio: ${r.premio || ''}\n` +
    `🎪 Rifa: ${r.rifa_nombre}\n` +
    `📅 Sorteo: ${fmtF(r.fecha_sorteo)}\n` +
    `💰 Valor: ${COP(r.precio)} c/u${todos.length > 1 ? ` · Total: ${COP(totalVal)}` : ''}\n` +
    `🔖 ID Reserva: #${id}\n\n` +
    (nota ? `📝 Nota: ${nota}\n\n` : '') +
    `🎊 _¡Estás participando! Guarda este mensaje como comprobante._\n` +
    `🌐 rifasjordyn.com`
  );
};

const abrirWA = (telefono, texto) => {
  const num = telefono?.replace(/\D/g,'') || '';
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
};

/* ────────────────────────────────────────────────────────
   Pill de número(s) — muestra uno o una lista compacta
──────────────────────────────────────────────────────── */
function NumerosPill({ numeros = [], estado = 'pendiente', grande = false }) {
  const est = EST[estado] || EST.pendiente;
  if (!numeros.length) return null;

  if (grande) {
    return (
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {numeros.map(n => (
          <div key={n} style={{
            background: `linear-gradient(135deg,${est.bg},rgba(10,191,188,.04))`,
            border: `2px solid ${est.border}`,
            borderRadius: 10,
            padding: '10px 18px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{ fontSize:'.58rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:2 }}>Nº</span>
            <span style={{ fontSize:'2rem', fontWeight:900, color: est.color, letterSpacing:'4px', lineHeight:1 }}>{n}</span>
          </div>
        ))}
      </div>
    );
  }

  // Modo compacto (lista)
  if (numeros.length === 1) {
    return (
      <div style={{ width:52, height:52, borderRadius:10, flexShrink:0, background:est.bg, border:`1.5px solid ${est.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'1.15rem', color:est.color, letterSpacing:2 }}>
        {numeros[0]}
      </div>
    );
  }

  return (
    <div style={{ minWidth:60, flexShrink:0, background:est.bg, border:`1.5px solid ${est.border}`, borderRadius:10, padding:'6px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <span style={{ fontWeight:900, fontSize:'1rem', color:est.color, letterSpacing:1 }}>{numeros[0]}</span>
      <span style={{ fontSize:'.6rem', fontWeight:700, color:est.color, opacity:.75 }}>+{numeros.length - 1} más</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MODAL DETALLE DE RESERVA INDIVIDUAL
   (o de un grupo de reservas del mismo cliente + rifa)
════════════════════════════════════════════════════════ */
function ModalReserva({ reserva: inicial, hermanas = [], onClose, onAccion, saving }) {
  const [reserva, setReserva] = useState(inicial);
  const [nota,    setNota]    = useState(inicial.nota_admin || '');
  const est      = EST[reserva.estado] || EST.pendiente;
  const pendiente = reserva.estado === 'pendiente';

  // Todos los números de este "grupo" (la reserva + hermanas)
  const todosNumeros = [reserva, ...hermanas].map(r => r.numero);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleAccion = async (estado) => {
    const ok = await onAccion(reserva.id, estado, nota);
    if (ok) setReserva(p => ({ ...p, estado, nota_admin: nota }));
  };

  // Aprobar todas las reservas del grupo a la vez
  const handleAccionTodas = async (estado) => {
    const ids = [reserva.id, ...hermanas.map(h => h.id)];
    const ok  = await onAccion(ids, estado, nota, true /* bulk */);
    if (ok) setReserva(p => ({ ...p, estado, nota_admin: nota }));
  };

  const enviarWA = () =>
    abrirWA(reserva.telefono, buildTicketMsg(reserva, nota, hermanas.map(h => h.numero)));

  const copiarTexto = async () => {
    await navigator.clipboard.writeText(buildTicketMsg(reserva, nota, hermanas.map(h => h.numero)));
    toast.success('Texto del ticket copiado 📋');
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:640, maxHeight:'92vh', background:'var(--jordyn-bg,#fff)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(10,191,188,.20)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', padding:'1.1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>
              Reserva #{reserva.id?.slice(0,8).toUpperCase()}
              {hermanas.length > 0 && (
                <span style={{ marginLeft:8, background:'rgba(255,255,255,.25)', borderRadius:20, padding:'2px 10px', fontSize:'.72rem' }}>
                  {todosNumeros.length} números
                </span>
              )}
            </div>
            <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.7rem', marginTop:2 }}>{fmtTs(reserva.created_at)}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ background:'rgba(255,255,255,.2)', color:'#fff', border:'1px solid rgba(255,255,255,.35)', borderRadius:20, padding:'3px 12px', fontSize:'.72rem', fontWeight:700 }}>
              {EST[reserva.estado]?.label || est.label}
            </span>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:8, padding:'6px 11px', cursor:'pointer', fontSize:'1rem' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem' }}>

          {/* Números */}
          <div style={{ marginBottom:'1.25rem' }}>
            <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>
              <i className="bi bi-ticket-perforated-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
              {todosNumeros.length > 1 ? `${todosNumeros.length} Números reservados` : 'Número reservado'}
            </div>
            <NumerosPill numeros={todosNumeros} estado={reserva.estado} grande />
          </div>

          {/* Datos del cliente */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:'1.25rem' }}>
            {[
              { l:'Cliente',     v: reserva.nombre_cliente, bold:true    },
              { l:'Teléfono',    v: reserva.telefono || '—'              },
              { l:'Rifa',        v: reserva.rifa_nombre                  },
              { l:'Valor c/u',   v: COP(reserva.precio), color:'#059669' },
              { l:'Método pago', v: reserva.metodo_pago || '—'           },
              { l:'Total',       v: COP(reserva.precio * todosNumeros.length), color:'var(--jordyn-primary)', bold:true },
              { l:'Premio',      v: reserva.premio || '—'                },
              { l:'Sorteo',      v: fmtF(reserva.fecha_sorteo)           },
            ].map(({ l, v, bold, color }) => (
              <div key={l} style={{ background:'var(--jordyn-bg2)', borderRadius:8, padding:'8px 12px', border:'1px solid var(--jordyn-border)' }}>
                <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:'.85rem', fontWeight: bold?700:500, color: color||'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Hermanas — lista de reservas del mismo grupo */}
          {hermanas.length > 0 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
                <i className="bi bi-collection me-1"></i>Otras reservas del mismo cliente en esta rifa
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {hermanas.map(h => {
                  const hEst = EST[h.estado] || EST.pendiente;
                  return (
                    <div key={h.id} style={{ background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                      <span style={{ fontWeight:800, color: hEst.color, fontSize:'.95rem', letterSpacing:2 }}>{h.numero}</span>
                      <span style={{ fontSize:'.65rem', color:'var(--jordyn-muted)' }}>#{h.id?.slice(0,8)}</span>
                      <span style={{ background:hEst.bg, color:hEst.color, border:`1px solid ${hEst.border}`, borderRadius:20, padding:'2px 10px', fontSize:'.65rem', fontWeight:700 }}>
                        {hEst.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comprobante */}
          {reserva.comprobante_base64 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-paperclip" style={{ color:'var(--jordyn-primary)' }}></i>
                COMPROBANTE DE PAGO
              </div>
              <div style={{ border:'2px solid var(--jordyn-border)', borderRadius:10, overflow:'hidden', background:'var(--jordyn-bg2)' }}>
                {reserva.comprobante_base64.startsWith('data:image') ||
                 reserva.comprobante_base64.match(/^[A-Za-z0-9+/]/) ? (
                  <img
                    src={reserva.comprobante_base64.startsWith('data:')
                      ? reserva.comprobante_base64
                      : `data:image/jpeg;base64,${reserva.comprobante_base64}`}
                    alt="Comprobante"
                    style={{ width:'100%', maxHeight:300, objectFit:'contain', display:'block' }}
                  />
                ) : (
                  <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--jordyn-muted)', fontSize:'.85rem' }}>
                    <i className="bi bi-file-earmark-check-fill" style={{ fontSize:'2rem', color:'var(--jordyn-primary)', display:'block', marginBottom:8 }}></i>
                    {reserva.comprobante_nombre || 'Comprobante adjunto'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nota */}
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>
              Nota para el cliente (opcional)
            </label>
            <textarea
              className="jd-input"
              rows={2}
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Ej: Tu número está confirmado, ¡mucha suerte!"
              style={{ resize:'vertical', fontSize:'.85rem' }}
              disabled={!pendiente}
            />
          </div>

          {/* Nota admin guardada */}
          {!pendiente && reserva.nota_admin && (
            <div style={{ background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'10px 14px', marginBottom:'1rem', fontSize:'.82rem', color:'var(--jordyn-text)' }}>
              <span style={{ fontWeight:700, color:'var(--jordyn-muted)', fontSize:'.65rem', textTransform:'uppercase' }}>Nota guardada: </span>
              {reserva.nota_admin}
            </div>
          )}
        </div>

        {/* Footer acciones */}
        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--jordyn-border)', background:'var(--jordyn-bg2)', flexShrink:0, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>

          {/* Ticket WA */}
          {(reserva.estado === 'aprobado' || pendiente) && (
            <>
              <button onClick={copiarTexto}
                style={{ background:'var(--jordyn-bg)', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-text)', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-clipboard"></i> Copiar ticket
              </button>
              {reserva.telefono && (
                <button onClick={enviarWA}
                  style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                  <WaIcon size={15}/> WhatsApp
                </button>
              )}
            </>
          )}

          {pendiente && (
            <>
              {/* Botones individuales */}
              <button
                onClick={() => handleAccion('rechazado')}
                disabled={saving}
                style={{ background:'rgba(230,57,70,.08)', border:'1.5px solid rgba(230,57,70,.3)', color:'#e63946', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-x-circle-fill"></i> Rechazar
              </button>
              <button
                onClick={() => handleAccion('aprobado')}
                disabled={saving}
                style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', border:'none', color:'#fff', borderRadius:9, padding:'9px 20px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Guardando...</>
                  : <><i className="bi bi-check-circle-fill"></i> Aprobar</>}
              </button>

              {/* Botón bulk si hay hermanas pendientes */}
              {hermanas.filter(h => h.estado === 'pendiente').length > 0 && (
                <button
                  onClick={() => handleAccionTodas('aprobado')}
                  disabled={saving}
                  style={{ background:'linear-gradient(135deg,#059669,#047857)', border:'none', color:'#fff', borderRadius:9, padding:'9px 20px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                  {saving
                    ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Guardando...</>
                    : <><i className="bi bi-check-all"></i> Aprobar todos ({hermanas.filter(h=>h.estado==='pendiente').length+1})</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Panel de números bloqueados / en conflicto
════════════════════════════════════════════════════════ */
function PanelBloqueados({ reservas }) {
  const grupos = {};
  reservas.filter(r => r.estado === 'pendiente').forEach(r => {
    if (!grupos[r.numero]) grupos[r.numero] = [];
    grupos[r.numero].push(r);
  });
  const conflictos = Object.entries(grupos).filter(([, rs]) => rs.length > 1);
  if (!conflictos.length) return null;

  return (
    <div className="jd-alert jd-alert-warning" style={{ marginBottom:'1.25rem' }}>
      <div style={{ fontWeight:800, marginBottom:6 }}>
        <i className="bi bi-exclamation-triangle-fill me-1"></i>
        {conflictos.length} número{conflictos.length > 1 ? 's' : ''} con reservas en conflicto
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {conflictos.map(([num, rs]) => (
          <span key={num} style={{ fontWeight:700, background:'rgba(240,165,0,.15)', border:'1px solid rgba(240,165,0,.4)', borderRadius:20, padding:'2px 12px', fontSize:'.78rem' }}>
            {num} ({rs.length} reservas)
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════ */
export default function GestionReservas() {
  const [reservas, setReservas] = useState([]);
  const [todas,    setTodas]    = useState([]);
  const [filtro,   setFiltro]   = useState('pendiente');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [selR,     setSelR]     = useState(null);   // reserva principal seleccionada
  const [selHerm,  setSelHerm]  = useState([]);     // hermanas de la seleccionada

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get('/publico/admin/reservas', {
        params: filtro !== 'todos' ? { estado: filtro } : {},
      });
      setReservas(r.data);
    } catch { toast.error('Error cargando reservas'); }
    finally { setLoading(false); }
  }, [filtro]);

  const loadTodas = useCallback(async () => {
    try {
      const r = await API.get('/publico/admin/reservas');
      setTodas(r.data);
    } catch {}
  }, []);

  useEffect(() => { load(); loadTodas(); }, [load, loadTodas]);

  /* ── Abrir modal + calcular hermanas ── */
  const abrirModal = (r) => {
    // Hermanas = misma rifa, mismo cliente, distintas reservas
    const hermanas = todas.filter(
      x => x.id !== r.id &&
           x.rifa_id === r.rifa_id &&
           x.nombre_cliente.trim().toLowerCase() === r.nombre_cliente.trim().toLowerCase()
    );
    setSelR(r);
    setSelHerm(hermanas);
  };

  /* ── Acción individual o bulk ── */
  const handleAccion = async (idOrIds, estado, nota, bulk = false) => {
    setSaving(true);
    try {
      if (bulk) {
        await API.put('/publico/admin/reservas-bulk', {
          ids: idOrIds,
          estado,
          nota_admin: nota,
        });
        toast.success(
          estado === 'aprobado'
            ? `✅ ${idOrIds.length} reservas aprobadas — envía el ticket por WhatsApp`
            : `❌ ${idOrIds.length} reservas rechazadas`
        );
      } else {
        await API.put(`/publico/admin/reservas/${idOrIds}`, { estado, nota_admin: nota });
        toast.success(
          estado === 'aprobado'
            ? '✅ Aprobada — ahora envía el ticket por WhatsApp'
            : '❌ Rechazada — número liberado'
        );
      }
      load(); loadTodas();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error procesando reserva');
      return false;
    } finally { setSaving(false); }
  };

  /* ── Conteos para tabs ── */
  const conteos = todas.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    acc.todos = (acc.todos || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { key:'pendiente', label:'Pendientes', icon:'bi-hourglass-split',   color:'#b37700',             count: conteos.pendiente||0 },
    { key:'aprobado',  label:'Aprobados',  icon:'bi-check-circle-fill', color:'#059669',             count: conteos.aprobado||0  },
    { key:'rechazado', label:'Rechazados', icon:'bi-x-circle-fill',     color:'#e63946',             count: conteos.rechazado||0 },
    { key:'todos',     label:'Todos',      icon:'bi-list-ul',            color:'var(--jordyn-muted)', count: conteos.todos||0     },
  ];

  /* ── Agrupar reservas por cliente+rifa para la vista de lista ── */
  const reservasAgrupadas = (() => {
    const grupos = {};
    reservas.forEach(r => {
      const key = `${r.rifa_id}||${r.nombre_cliente.trim().toLowerCase()}`;
      if (!grupos[key]) grupos[key] = { principal: r, extras: [] };
      else grupos[key].extras.push(r);
    });
    return Object.values(grupos);
  })();

  return (
    <Layout title="RESERVAS DE CLIENTES">
      <PanelBloqueados reservas={todas} />

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)} style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:20, cursor:'pointer',
            fontWeight:700, fontSize:'.8rem', transition:'all .15s',
            border:`1.5px solid ${filtro===t.key ? t.color : 'var(--jordyn-border)'}`,
            background: filtro===t.key ? `${t.color}14` : 'var(--jordyn-bg,#fff)',
            color: filtro===t.key ? t.color : 'var(--jordyn-muted)',
          }}>
            <i className={`bi ${t.icon}`}></i>{t.label}
            {t.count > 0 && (
              <span style={{ background: filtro===t.key ? t.color : 'var(--jordyn-bg2)', color: filtro===t.key ? '#fff' : 'var(--jordyn-muted)', borderRadius:20, padding:'0 7px', fontSize:'.7rem', fontWeight:800 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div className="jd-spinner" style={{ width:44, height:44 }}></div>
        </div>
      ) : reservasAgrupadas.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'.75rem' }}>📭</div>
          <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-text)', marginBottom:4 }}>Sin reservas</div>
          <div style={{ fontSize:'.82rem', color:'var(--jordyn-muted)' }}>No hay reservas con el filtro seleccionado</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {reservasAgrupadas.map(({ principal: r, extras }) => {
            const est       = EST[r.estado] || EST.pendiente;
            const numeros   = [r.numero, ...extras.map(e => e.numero)];
            const totalVal  = r.precio * numeros.length;
            const esGrupo   = numeros.length > 1;

            return (
              <div key={r.id} onClick={() => abrirModal(r)} className="jd-card"
                style={{ cursor:'pointer', padding:'.9rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', borderLeft:`3px solid ${est.dot}`, transition:'box-shadow .15s, transform .12s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(10,191,188,.12)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform=''; }}
              >
                {/* Pill de número(s) */}
                <NumerosPill numeros={numeros} estado={r.estado} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.92rem', color:'var(--jordyn-text)', marginBottom:1, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {r.nombre_cliente}
                    {r.comprobante_base64 && (
                      <span style={{ fontSize:'.7rem', color:'var(--jordyn-primary)', fontWeight:600 }}>
                        <i className="bi bi-paperclip me-1"></i>Comprobante
                      </span>
                    )}
                    {esGrupo && (
                      <span style={{ fontSize:'.68rem', background:'rgba(10,191,188,.1)', color:'var(--jordyn-primary)', border:'1px solid rgba(10,191,188,.25)', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>
                        🎟 {numeros.length} números
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)' }}>
                    {r.rifa_nombre}
                    {r.telefono    && <span style={{ marginLeft:10 }}><i className="bi bi-telephone-fill me-1"></i>{r.telefono}</span>}
                    {r.metodo_pago && <span style={{ marginLeft:10 }}><i className="bi bi-credit-card me-1"></i>{r.metodo_pago}</span>}
                  </div>
                  {/* Números como chips si son varios */}
                  {esGrupo && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                      {numeros.map(n => (
                        <span key={n} style={{ background:est.bg, color:est.color, border:`1px solid ${est.border}`, borderRadius:6, padding:'2px 8px', fontSize:'.72rem', fontWeight:800, letterSpacing:1 }}>
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'.92rem', color:'var(--jordyn-green)' }}>
                    {COP(esGrupo ? totalVal : r.precio)}
                  </div>
                  {esGrupo && (
                    <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)' }}>{COP(r.precio)} c/u</div>
                  )}
                  <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:2 }}>{fmtTs(r.created_at)}</div>
                </div>

                <span style={{ background:est.bg, color:est.color, border:`1.5px solid ${est.border}`, borderRadius:20, padding:'3px 12px', fontSize:'.7rem', fontWeight:700, flexShrink:0 }}>
                  {est.label}
                </span>

                {/* WA rápido para aprobadas */}
                {r.estado === 'aprobado' && r.telefono && (
                  <button
                    onClick={e => { e.stopPropagation(); abrirWA(r.telefono, buildTicketMsg(r, r.nota_admin, extras.map(x=>x.numero))); }}
                    title="Reenviar ticket por WhatsApp"
                    style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4 }}>
                    <WaIcon size={14}/> <span style={{ fontSize:'.72rem', fontWeight:700 }}>WA</span>
                  </button>
                )}

                <i className="bi bi-chevron-right" style={{ color:'var(--jordyn-muted)', flexShrink:0 }}></i>
              </div>
            );
          })}
        </div>
      )}

      {selR && (
        <ModalReserva
          reserva={selR}
          hermanas={selHerm}
          onClose={() => { setSelR(null); setSelHerm([]); }}
          onAccion={handleAccion}
          saving={saving}
        />
      )}
    </Layout>
  );
}