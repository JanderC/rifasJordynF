import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const COP   = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
const fmtTs = f => new Date(f).toLocaleString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const fmtF  = f => f ? new Date(f).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Por definir';

const EST = {
  pendiente: { bg:'rgba(240,165,0,.10)',  color:'#b37700',       border:'rgba(240,165,0,.30)',  label:'⏳ Pendiente', dot:'#f0a500' },
  aprobado:  { bg:'rgba(6,214,160,.10)',  color:'#059669',       border:'rgba(6,214,160,.30)',  label:'✅ Aprobado',  dot:'#06d6a0' },
  rechazado: { bg:'rgba(230,57,70,.10)',  color:'#e63946',       border:'rgba(230,57,70,.25)',  label:'❌ Rechazado', dot:'#e63946' },
};

/* ─── Icono WhatsApp SVG ─── */
const WaIcon = ({ size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ─── Generar mensaje ticket WhatsApp ─── */
const buildTicketMsg = (r, nota) => {
  const id = r.id?.slice(0,8).toUpperCase() || '-------';
  return (
    `*RESUELVE TU SEMANA* — ✅ PAGO CONFIRMADO\n\n` +
    `Hola *${r.nombre_cliente}* 🎉 ¡Tu número fue aprobado!\n\n` +
    `🎟 Número: *${r.numero}*\n` +
    `🏆 Premio: ${r.premio || ''}\n` +
    `🎪 Rifa: ${r.rifa_nombre}\n` +
    `📅 Sorteo: ${fmtF(r.fecha_sorteo)}\n` +
    `💰 Valor: ${COP(r.precio)}\n` +
    `🔖 ID Reserva: #${id}\n\n` +
    (nota ? `📝 Nota: ${nota}\n\n` : '') +
    `🎊 _¡Estás participando! Guarda este mensaje como tu comprobante._\n` +
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

/* ════════════════════════════════════════════════════════
   MODAL DETALLE
════════════════════════════════════════════════════════ */
function ModalReserva({ reserva: inicial, onClose, onAccion, saving }) {
  const [reserva, setReserva] = useState(inicial);
  const [nota,    setNota]    = useState(inicial.nota_admin || '');
  const est      = EST[reserva.estado] || EST.pendiente;
  const pendiente = reserva.estado === 'pendiente';

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleAccion = async (estado) => {
    const ok = await onAccion(reserva.id, estado, nota);
    if (ok) setReserva(p => ({ ...p, estado, nota_admin: nota }));
  };

  const enviarWA = () => abrirWA(reserva.telefono, buildTicketMsg(reserva, nota));

  const copiarTexto = async () => {
    await navigator.clipboard.writeText(buildTicketMsg(reserva, nota));
    toast.success('Texto del ticket copiado 📋');
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:620, maxHeight:'92vh', background:'#fff', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(10,191,188,.20)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', padding:'1.1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>Reserva #{reserva.id?.slice(0,8).toUpperCase()}</div>
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

          {/* Número + datos del cliente */}
          <div style={{ display:'flex', gap:'1rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            <div style={{ background:'linear-gradient(135deg,rgba(10,191,188,.08),rgba(10,191,188,.04))', border:'2px solid rgba(10,191,188,.25)', borderRadius:12, padding:'1rem 1.5rem', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:120, flexShrink:0 }}>
              <div style={{ fontSize:'.62rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>NÚMERO</div>
              <div style={{ fontSize:'3rem', fontWeight:900, color:'var(--jordyn-primary)', letterSpacing:'8px', lineHeight:1 }}>{reserva.numero}</div>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', marginTop:4 }}>{reserva.rifa_nombre}</div>
            </div>
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, minWidth:200 }}>
              {[
                { l:'Cliente',     v: reserva.nombre_cliente, bold:true    },
                { l:'Teléfono',    v: reserva.telefono || '—'              },
                { l:'Rifa',        v: reserva.rifa_nombre                  },
                { l:'Valor',       v: COP(reserva.precio), color:'#059669' },
                { l:'Método pago', v: reserva.metodo_pago || '—'           },
                { l:'Premio',      v: reserva.premio || '—'                },
              ].map(({ l, v, bold, color }) => (
                <div key={l} style={{ background:'var(--jordyn-bg2)', borderRadius:8, padding:'8px 12px', border:'1px solid var(--jordyn-border)' }}>
                  <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:'.85rem', fontWeight: bold?700:500, color: color||'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comprobante */}
          {reserva.comprobante_base64 ? (
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-paperclip" style={{ color:'var(--jordyn-primary)' }}></i>
                COMPROBANTE DE PAGO
              </div>
              <div style={{ border:'2px solid var(--jordyn-border)', borderRadius:10, overflow:'hidden', background:'var(--jordyn-bg2)' }}>
                <img src={reserva.comprobante_base64} alt="Comprobante" style={{ width:'100%', maxHeight:380, objectFit:'contain', display:'block' }} />
              </div>
              {reserva.comprobante_nombre && (
                <div style={{ fontSize:'.7rem', color:'var(--jordyn-muted)', marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                  <i className="bi bi-file-earmark-image"></i>{reserva.comprobante_nombre}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:10, padding:'.85rem 1rem', marginBottom:'1.25rem', fontSize:'.8rem', color:'#b37700', display:'flex', gap:8, alignItems:'center' }}>
              <i className="bi bi-exclamation-triangle-fill"></i>
              El cliente no adjuntó comprobante de pago.
            </div>
          )}

          {/* Aprobado → botones compartir */}
          {reserva.estado === 'aprobado' && (
            <div style={{ background:'rgba(6,214,160,.08)', border:'2px solid rgba(6,214,160,.3)', borderRadius:14, padding:'1.1rem 1.25rem', marginBottom:'1rem' }}>
              <div style={{ fontWeight:800, fontSize:'.9rem', color:'#059669', marginBottom:'.75rem', display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-check-circle-fill"></i> Reserva aprobada — envía el ticket al cliente
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={enviarWA}
                  style={{ flex:1, minWidth:160, background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:10, padding:'.7rem 1rem', cursor:'pointer', fontWeight:700, fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(37,211,102,.3)', transition:'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow='0 6px 20px rgba(37,211,102,.5)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 14px rgba(37,211,102,.3)'}
                >
                  <WaIcon size={18}/> Enviar ticket por WhatsApp
                </button>
                <button onClick={copiarTexto}
                  style={{ background:'var(--jordyn-bg2)', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-muted)', borderRadius:10, padding:'.7rem 1rem', cursor:'pointer', fontWeight:600, fontSize:'.82rem', display:'flex', alignItems:'center', gap:6 }}>
                  <i className="bi bi-clipboard-fill"></i> Copiar texto
                </button>
              </div>
              {reserva.telefono && (
                <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginTop:8, display:'flex', alignItems:'center', gap:4 }}>
                  <i className="bi bi-telephone-fill" style={{ color:'var(--jordyn-primary)' }}></i>
                  Se enviará a: <strong style={{ color:'var(--jordyn-text)', marginLeft:4 }}>{reserva.telefono}</strong>
                </div>
              )}
            </div>
          )}

          {/* Rechazado → nota */}
          {reserva.estado === 'rechazado' && reserva.nota_admin && (
            <div style={{ background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'.85rem 1rem', marginBottom:'1rem' }}>
              <div style={{ fontSize:'.62rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Nota enviada</div>
              <div style={{ fontSize:'.88rem', color:'var(--jordyn-text)' }}>{reserva.nota_admin}</div>
            </div>
          )}

          {/* Pendiente → acciones */}
          {pendiente && (
            <>
              <div style={{ marginBottom:'1rem' }}>
                <label className="jd-label">NOTA PARA EL CLIENTE (opcional)</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} className="jd-input" rows={2}
                  placeholder="Ej: Pago confirmado, gracias. / El monto no corresponde." style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => handleAccion('rechazado')} disabled={saving}
                  style={{ flex:1, background:'rgba(230,57,70,.07)', border:'1.5px solid rgba(230,57,70,.35)', color:'#e63946', borderRadius:10, padding:'.75rem', cursor:'pointer', fontWeight:700, fontSize:'.88rem', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .15s' }}>
                  <i className="bi bi-x-circle-fill"></i> RECHAZAR
                </button>
                <button onClick={() => handleAccion('aprobado')} disabled={saving}
                  style={{ flex:2, background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', border:'none', color:'#fff', borderRadius:10, padding:'.75rem', cursor:'pointer', fontWeight:700, fontSize:'.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(10,191,188,.3)', transition:'all .15s' }}>
                  {saving
                    ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2, borderTopColor:'#fff' }}></span> Procesando...</>
                    : <><i className="bi bi-check-circle-fill"></i> APROBAR Y REGISTRAR VENTA</>
                  }
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PANEL: Números bloqueados pendientes
════════════════════════════════════════════════════════ */
function PanelBloqueados({ reservas }) {
  const porRifa = reservas.reduce((acc, r) => {
    if (r.estado !== 'pendiente') return acc;
    if (!acc[r.rifa_id]) acc[r.rifa_id] = { nombre: r.rifa_nombre, items: [] };
    acc[r.rifa_id].items.push(r);
    return acc;
  }, {});
  const rifas = Object.values(porRifa);
  if (!rifas.length) return null;
  return (
    <div className="jd-card jd-card-primary mb-4">
      <div style={{ fontWeight:800, fontSize:'.88rem', color:'var(--jordyn-primary)', marginBottom:'.85rem', display:'flex', alignItems:'center', gap:6 }}>
        <i className="bi bi-lock-fill"></i> NÚMEROS BLOQUEADOS — ESPERANDO APROBACIÓN
      </div>
      {rifas.map(rifa => (
        <div key={rifa.nombre} style={{ marginBottom:'.75rem' }}>
          <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>
            {rifa.nombre} — {rifa.items.length} bloqueado(s)
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {rifa.items.map(n => (
              <div key={n.id} style={{ background:'rgba(240,165,0,.10)', border:'1.5px solid rgba(240,165,0,.35)', borderRadius:8, padding:'5px 12px', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <span style={{ fontWeight:900, fontSize:'1.05rem', color:'#b37700', letterSpacing:2 }}>{n.numero}</span>
                <span style={{ fontSize:'.58rem', color:'var(--jordyn-muted)', maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.nombre_cliente}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════════════════ */
export default function GestionReservas() {
  const [reservas, setReservas] = useState([]);
  const [todas,    setTodas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('pendiente');
  const [selR,     setSelR]     = useState(null);
  const [saving,   setSaving]   = useState(false);

  const loadTodas = useCallback(async () => {
    try { const r = await API.get('/publico/admin/reservas'); setTodas(r.data); } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filtro === 'todos' ? '/publico/admin/reservas' : `/publico/admin/reservas?estado=${filtro}`;
      const r   = await API.get(url);
      setReservas(r.data);
    } catch { toast.error('Error cargando reservas'); }
    finally { setLoading(false); }
  }, [filtro]);

  useEffect(() => { load(); loadTodas(); }, [load, loadTodas]);

  const handleAccion = async (id, estado, nota) => {
    setSaving(true);
    try {
      await API.put(`/publico/admin/reservas/${id}`, { estado, nota_admin: nota });
      toast.success(
        estado === 'aprobado'
          ? '✅ Aprobada — ahora envía el ticket por WhatsApp'
          : '❌ Rechazada — número liberado'
      );
      load(); loadTodas();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error procesando reserva');
      return false;
    } finally { setSaving(false); }
  };

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
            background: filtro===t.key ? `${t.color}14` : '#fff',
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
      ) : reservas.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'.75rem' }}>📭</div>
          <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-text)', marginBottom:4 }}>Sin reservas</div>
          <div style={{ fontSize:'.82rem', color:'var(--jordyn-muted)' }}>No hay reservas con el filtro seleccionado</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {reservas.map(r => {
            const est = EST[r.estado] || EST.pendiente;
            return (
              <div key={r.id} onClick={() => setSelR(r)} className="jd-card"
                style={{ cursor:'pointer', padding:'.9rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', borderLeft:`3px solid ${est.dot}`, transition:'box-shadow .15s, transform .12s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(10,191,188,.12)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform=''; }}
              >
                <div style={{ width:52, height:52, borderRadius:10, flexShrink:0, background:est.bg, border:`1.5px solid ${est.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'1.15rem', color:est.color, letterSpacing:2 }}>
                  {r.numero}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.92rem', color:'var(--jordyn-text)', marginBottom:1 }}>
                    {r.nombre_cliente}
                    {r.comprobante_base64 && <span style={{ marginLeft:8, fontSize:'.7rem', color:'var(--jordyn-primary)', fontWeight:600 }}><i className="bi bi-paperclip me-1"></i>Comprobante</span>}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)' }}>
                    {r.rifa_nombre}
                    {r.telefono   && <span style={{ marginLeft:10 }}><i className="bi bi-telephone-fill me-1"></i>{r.telefono}</span>}
                    {r.metodo_pago && <span style={{ marginLeft:10 }}><i className="bi bi-credit-card me-1"></i>{r.metodo_pago}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'.92rem', color:'var(--jordyn-green)' }}>{COP(r.precio)}</div>
                  <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:2 }}>{fmtTs(r.created_at)}</div>
                </div>
                <span style={{ background:est.bg, color:est.color, border:`1.5px solid ${est.border}`, borderRadius:20, padding:'3px 12px', fontSize:'.7rem', fontWeight:700, flexShrink:0 }}>
                  {est.label}
                </span>
                {/* Botón rápido WA para aprobadas */}
                {r.estado === 'aprobado' && r.telefono && (
                  <button
                    onClick={e => { e.stopPropagation(); abrirWA(r.telefono, buildTicketMsg(r, r.nota_admin)); }}
                    title="Reenviar ticket por WhatsApp"
                    style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4 }}
                  >
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
          onClose={() => setSelR(null)}
          onAccion={handleAccion}
          saving={saving}
        />
      )}
    </Layout>
  );
}