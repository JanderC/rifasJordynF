// ============================================================
//   GestionReservas.js — RIFAS JORDYN
//   ✅ Fechas corregidas (sin timezone offset)
//   ✅ Aprobación auto-dispara WhatsApp con ticket adjunto
//   ✅ Tasas de cambio reflejadas en el modal
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview } from '../components/Ticket';
import TicketEditable from '../components/TicketEditable';
import {
  resolverPlantillaParaRifa,
  extraerDesign,
  generarImagenTicketTemplate,
} from '../utils/ticketImageHelper';
import { DEFAULT_DESIGN } from '../components/Ticket';
import { fmtFecha, fmtTimestamp } from '../utils/dates';
import { useAuth } from '../context/AuthContext';

const COP = n =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);

const EST = {
  pendiente: { bg:'rgba(240,165,0,.10)',  color:'#b37700', border:'rgba(240,165,0,.30)',  label:'⏳ Pendiente', dot:'#f0a500' },
  aprobado:  { bg:'rgba(6,214,160,.10)',  color:'#059669', border:'rgba(6,214,160,.30)',  label:'✅ Aprobado',  dot:'#06d6a0' },
  rechazado: { bg:'rgba(230,57,70,.10)',  color:'#e63946', border:'rgba(230,57,70,.25)',  label:'❌ Rechazado', dot:'#e63946' },
};

/* ─── WhatsApp icon ─── */
const WaIcon = ({ size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ─── Construir mensaje ticket WhatsApp con tasas ─── */
function buildTicketMsg(r, nota, tasas = {}) {
  const id     = r.id?.slice(0,8).toUpperCase() || '-------';
  const numeros= Array.isArray(r._numeros) ? r._numeros : [r.numero];
  const numStr = numeros.map(n => `*${n}*`).join(' · ');
  const total  = (r._total_real || r.precio) * numeros.length;

  // Conversión USD si hay tasa
  const copUsd   = tasas?.COP_POR_USD?.valor || 0;
  const totalUSD = copUsd > 0 ? `$${(total / copUsd).toFixed(2)} USD` : null;

  return (
    `*RIFAS JORDYN* — ✅ PAGO CONFIRMADO\n\n` +
    `Hola *${r.nombre_cliente}* 🎉 ¡Tu${numeros.length>1?'s números fueron aprobados':' número fue aprobado'}!\n\n` +
    `🎟 Número${numeros.length>1?'s':''}: ${numStr}\n` +
    `🏆 Premio: ${r.premio || ''}\n` +
    `🎪 Rifa: ${r.rifa_nombre}\n` +
    `📅 Sorteo: ${fmtFecha(r.fecha_sorteo)}\n` +
    `💰 Total: ${COP(total)}${totalUSD ? ` · ${totalUSD}` : ''}\n` +
    `🔖 ID Reserva: #${id}\n\n` +
    (nota ? `📝 Nota: ${nota}\n\n` : '') +
    `🎊 _¡Estás participando! Guarda este mensaje como tu comprobante._\n` +
    `🌐 rifasjordyn.com`
  );
}

const abrirWA = (telefono, texto) => {
  const num = telefono?.replace(/\D/g,'') || '';
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
};

/* ════════════════════════════════════════════════════════════
   MODAL DETALLE DE RESERVA
════════════════════════════════════════════════════════════ */
function ModalReserva({ reserva: inicial, hermanas = [], onClose, onAccion, saving, tasas }) {
  const [reserva,      setReserva]     = useState(inicial);
  const [nota,         setNota]        = useState(inicial.nota_admin || '');
  const [generandoWA,  setGenerandoWA] = useState(false);

  // NUEVO: estados para preview pre-aprobación
  const [mostrandoPreview, setMostrandoPreview] = useState(false);
  const [previewIndex,     setPreviewIndex]     = useState(0);
  const [plantilla,        setPlantilla]        = useState(null);
  const [rifaCompleta,     setRifaCompleta]     = useState(null);
  const [cargandoTpl,      setCargandoTpl]      = useState(false);

  const est     = EST[reserva.estado] || EST.pendiente;
  const pendiente = reserva.estado === 'pendiente';

  // Todos los números del grupo
  const todosNumeros = [reserva, ...hermanas].map(r => r.numero);
  const totalPrecio  = reserva.precio * todosNumeros.length;

  // Conversión de tasas
  const copUsd   = tasas?.COP_POR_USD?.valor || 0;
  const totalUSD = copUsd > 0 ? `$${(totalPrecio / copUsd).toFixed(2)} USD` : null;

  // Cargar rifa completa + plantilla al abrir modal
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargandoTpl(true);
      try {
        const [rifaR] = await Promise.all([
          API.get(`/rifas/${reserva.rifa_id}`).catch(() => ({ data: null })),
        ]);
        if (cancelado) return;
        const rifaData = rifaR.data || {
          // fallback con lo que ya tenemos en la reserva
          id: reserva.rifa_id,
          nombre: reserva.rifa_nombre,
          premio: reserva.premio,
          precio: reserva.precio,
          fecha_sorteo: reserva.fecha_sorteo,
        };
        setRifaCompleta(rifaData);

        const tpl = await resolverPlantillaParaRifa(rifaData);
        if (!cancelado) setPlantilla(tpl);
      } catch (e) {
        console.warn('No se pudo cargar plantilla/rifa:', e);
      } finally {
        if (!cancelado) setCargandoTpl(false);
      }
    })();
    return () => { cancelado = true; };
  }, [reserva.rifa_id, reserva.rifa_nombre, reserva.premio, reserva.precio, reserva.fecha_sorteo]);

  // Design final para el preview
  const designPreview = React.useMemo(() => {
    const extraido = extraerDesign(plantilla);
    return extraido
      ? { ...DEFAULT_DESIGN, ...extraido }
      : { ...DEFAULT_DESIGN };
  }, [plantilla]);

  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') {
        if (mostrandoPreview) setMostrandoPreview(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose, mostrandoPreview]);

  // Cuando el usuario hace click "Aprobar", primero abre el preview.
  // El preview tiene su propio botón "Confirmar y enviar" que llama a esta función.
  const handleAprobarPrevio = () => {
    setPreviewIndex(0);
    setMostrandoPreview(true);
  };

  const handleAccion = async (estado) => {
    // Si hay hermanas pendientes y estamos aprobando/rechazando,
    // procesarlas todas en bulk para evitar conflictos de constraint en simultánea
    const hermanasPendientes = hermanas.filter(h => h.estado === 'pendiente');
    const todasPendientes    = [reserva, ...hermanasPendientes].filter(r => r.estado === 'pendiente');

    let ok;
    if (todasPendientes.length > 1) {
      // Aprobar/rechazar todas juntas (bulk) para que el backend las procese en orden
      ok = await onAccion(todasPendientes.map(r => r.id), estado, nota, true);
    } else {
      ok = await onAccion(reserva.id, estado, nota, false);
    }

    if (ok) {
      setReserva(p => ({ ...p, estado, nota_admin: nota }));
      setMostrandoPreview(false);
      if (estado === 'aprobado') {
        await enviarWAConTicket();
      }
    }
  };

  /* ── Enviar WA con imagen del ticket ──
     Estrategia adaptativa:
     - En MÓVIL con navigator.share + files: dispara el share sheet
       nativo que sí permite mandar IMAGEN + TEXTO juntos a WhatsApp
       en una sola acción.
     - En DESKTOP (sin soporte): descarga las imágenes y abre
       WhatsApp Web con el texto; el usuario adjunta a mano.
  */
  const enviarWAConTicket = async () => {
    if (!reserva.telefono) {
      // Sin teléfono: solo abrir WA con el texto
      abrirWA('', buildTicketMsg({ ...reserva, _numeros: todosNumeros }, nota, tasas));
      return;
    }

    setGenerandoWA(true);
    try {
      // Datos de rifa para el ticket (lo cargado al abrir el modal o fallback)
      const rifaPara = rifaCompleta || {
        id: reserva.rifa_id,
        nombre: reserva.rifa_nombre,
        premio: reserva.premio,
        precio: reserva.precio,
        fecha_sorteo: reserva.fecha_sorteo,
        loteria_ref: reserva.loteria_ref,
        hora_sorteo: reserva.hora_sorteo,
      };

      // 1. Generar TODAS las imágenes en memoria
      const archivos = [];
      const dataUrls = [];
      for (let i = 0; i < todosNumeros.length; i++) {
        const num = todosNumeros[i];
        const imgDataUrl = await generarImagenTicketTemplate({
          rifa:      rifaPara,
          numero:    num,
          plantilla,
        });
        if (imgDataUrl) {
          dataUrls.push({ num, url: imgDataUrl });
          // Convertir dataURL → Blob → File para el share API
          try {
            const blob = await (await fetch(imgDataUrl)).blob();
            const file = new File(
              [blob],
              `ticket-${reserva.id?.slice(0,8)}-${num}.png`,
              { type: 'image/png' }
            );
            archivos.push(file);
          } catch (e) {
            console.warn('No se pudo convertir imagen a File:', e);
          }
        }
      }

      const msg = buildTicketMsg({ ...reserva, _numeros: todosNumeros }, nota, tasas);

      // 2. Detectar si el navegador soporta compartir archivos (típico en móvil)
      const puedeCompartirFiles =
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        archivos.length > 0 &&
        navigator.canShare({ files: archivos });

      if (puedeCompartirFiles) {
        // ✅ MÓVIL: usa el share sheet nativo que sí pasa imagen + texto a WhatsApp
        try {
          await navigator.share({
            files: archivos,
            text: msg,
            title: `Ticket Rifas Jordyn #${reserva.id?.slice(0,8).toUpperCase()}`,
          });
          toast.success('✅ Compartido. El cliente recibirá imagen + texto juntos.');
          return; // ya está, no abrimos WA Web
        } catch (e) {
          // Usuario canceló el share o falló → caemos al modo desktop
          if (e.name !== 'AbortError') {
            console.warn('share falló, usando fallback:', e);
          }
        }
      }

      // ⏬ DESKTOP fallback: descargar las imágenes + abrir WA Web con el texto
      for (let i = 0; i < dataUrls.length; i++) {
        const { num, url } = dataUrls[i];
        const a = document.createElement('a');
        a.href     = url;
        a.download = `ticket-${reserva.id?.slice(0,8)}-${num}.png`;
        a.click();
        if (i < dataUrls.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (dataUrls.length > 0) {
        toast.info(
          `📸 ${dataUrls.length} ticket${dataUrls.length > 1 ? 's' : ''} descargado${dataUrls.length > 1 ? 's' : ''} — adjúnta${dataUrls.length > 1 ? 'los' : 'lo'} en WhatsApp`,
          { autoClose: 6000 }
        );
      }

      abrirWA(reserva.telefono, msg);
    } catch (e) {
      console.error('Error enviando WA con ticket:', e);
      // Fallback final: solo texto
      abrirWA(reserva.telefono, buildTicketMsg({ ...reserva, _numeros: todosNumeros }, nota, tasas));
    } finally {
      setGenerandoWA(false);
    }
  };

  const copiarTexto = async () => {
    await navigator.clipboard.writeText(buildTicketMsg({ ...reserva, _numeros: todosNumeros }, nota, tasas));
    toast.success('Texto del ticket copiado 📋');
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ position:'relative', width:'100%', maxWidth:640, maxHeight:'92vh', background:'var(--jordyn-bg,#fff)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(10,191,188,.20)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', padding:'1.1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>
              Reserva #{reserva.id?.slice(0,8).toUpperCase()}
              {todosNumeros.length > 1 && (
                <span style={{ marginLeft:8, background:'rgba(255,255,255,.25)', borderRadius:20, padding:'2px 10px', fontSize:'.72rem' }}>
                  {todosNumeros.length} números
                </span>
              )}
            </div>
            <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.7rem', marginTop:2 }}>{fmtTimestamp(reserva.created_at)}</div>
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
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:'1rem' }}>
            {todosNumeros.map((n, i) => (
              <div key={`${n}-${i}`} style={{ background:'linear-gradient(135deg,rgba(10,191,188,.08),rgba(10,191,188,.04))', border:'2px solid rgba(10,191,188,.25)', borderRadius:10, padding:'8px 16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ fontSize:'.55rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:2 }}>Nº</div>
                <div style={{ fontSize:'2rem', fontWeight:900, color:'var(--jordyn-primary)', letterSpacing:'4px', lineHeight:1 }}>{n}</div>
              </div>
            ))}
          </div>

          {/* Datos del cliente */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:'1.25rem' }}>
            {[
              { l:'Cliente',     v: reserva.nombre_cliente, bold:true    },
              { l:'Teléfono',    v: reserva.telefono || '—'              },
              { l:'Rifa',        v: reserva.rifa_nombre                  },
              { l:'Valor c/u',   v: COP(reserva.precio), color:'#059669' },
              { l:'Método pago', v: reserva.metodo_pago || '—'           },
              { l:'Total',       v: COP(totalPrecio),   color:'var(--jordyn-primary)', bold:true },
              { l:'Premio',      v: reserva.premio || '—'                },
              { l:'Sorteo',      v: fmtFecha(reserva.fecha_sorteo)       },  // ← CORREGIDO
            ].map(({ l, v, bold, color }) => (
              <div key={l} style={{ background:'var(--jordyn-bg2)', borderRadius:8, padding:'8px 12px', border:'1px solid var(--jordyn-border)' }}>
                <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:'.85rem', fontWeight: bold?700:500, color: color||'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Equivalencia USD si hay tasa */}
          {totalUSD && (
            <div style={{ background:'rgba(10,191,188,.06)', border:'1px solid rgba(10,191,188,.2)', borderRadius:10, padding:'8px 14px', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', fontWeight:600 }}>Equivalente en USD <span style={{ fontSize:'.6rem' }}>(tasa: {copUsd.toLocaleString()} COP)</span></div>
              <div style={{ fontWeight:800, color:'var(--jordyn-primary)', fontSize:'.95rem' }}>{totalUSD}</div>
            </div>
          )}

          {/* Preview del ticket — usa la plantilla asignada a la rifa */}
          <div style={{ marginBottom:'1.25rem' }}>
            <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>
                <i className="bi bi-ticket-perforated-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
                Vista previa del ticket
              </span>
              {plantilla && (
                <span style={{
                  background: 'rgba(10,191,188,.1)',
                  color: 'var(--jordyn-primary)',
                  border: '1px solid rgba(10,191,188,.25)',
                  borderRadius: 4,
                  padding: '1px 8px',
                  fontSize: '.6rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  letterSpacing: 0,
                }}>
                  📄 {plantilla.nombre}
                </span>
              )}
            </div>
            <div style={{
              display:'flex', justifyContent:'center',
              overflow:'hidden',
              background:'#fafafa', borderRadius:8, padding:10,
              border:'1px dashed #d0d0d0',
            }}>
              {cargandoTpl ? (
                <div style={{ padding:30, color:'#999', fontSize:13 }}>
                  ⏳ Cargando plantilla…
                </div>
              ) : (
                <div style={{
                  transform: 'scale(0.55)',
                  transformOrigin: 'center center',
                  width: designPreview.ticketWidth,
                  height: designPreview.ticketHeight * 0.55,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                }}>
                  <TicketEditable
                    r={rifaCompleta || reserva}
                    numero={todosNumeros[0]}
                    design={{ ...designPreview, numBoleto: todosNumeros[0] }}
                    printMode={true}
                  />
                </div>
              )}
            </div>
            {todosNumeros.length > 1 && (
              <div style={{ fontSize:'.7rem', color:'var(--jordyn-muted)', textAlign:'center', marginTop:6, fontStyle:'italic' }}>
                Mostrando el primero de {todosNumeros.length} boletos. Al confirmar se generarán todos.
              </div>
            )}
          </div>

          {/* Comprobante */}
          {reserva.comprobante_base64 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-paperclip" style={{ color:'var(--jordyn-primary)' }}></i>
                COMPROBANTE DE PAGO
              </div>
              <div style={{ border:'2px solid var(--jordyn-border)', borderRadius:10, overflow:'hidden', background:'var(--jordyn-bg2)' }}>
                <img
                  src={reserva.comprobante_base64.startsWith('data:')
                    ? reserva.comprobante_base64
                    : `data:image/jpeg;base64,${reserva.comprobante_base64}`}
                  alt="Comprobante"
                  style={{ width:'100%', maxHeight:300, objectFit:'contain', display:'block' }}
                />
              </div>
            </div>
          )}

          {/* Nota admin */}
          {!pendiente && reserva.nota_admin && (
            <div style={{ background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'10px 14px', marginBottom:'1rem', fontSize:'.82rem' }}>
              <span style={{ fontWeight:700, color:'var(--jordyn-muted)', fontSize:'.65rem', textTransform:'uppercase' }}>Nota: </span>
              {reserva.nota_admin}
            </div>
          )}

          {/* Área nota editable */}
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>
              Nota para el cliente (opcional)
            </label>
            <textarea
              className="jd-input"
              rows={2}
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Ej: ¡Tu número está confirmado, mucha suerte!"
              style={{ resize:'vertical', fontSize:'.85rem' }}
              disabled={!pendiente}
            />
          </div>
        </div>

        {/* Footer con acciones */}
        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--jordyn-border)', background:'var(--jordyn-bg2)', flexShrink:0, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>

          {/* Botones de compartir (aprobado o después de aprobar) */}
          {(reserva.estado === 'aprobado' || pendiente) && (
            <>
              <button onClick={copiarTexto}
                style={{ background:'var(--jordyn-bg)', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-text)', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-clipboard"></i> Copiar texto
              </button>
              {reserva.telefono && (
                <button onClick={enviarWAConTicket} disabled={generandoWA}
                  style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                  {generandoWA
                    ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Generando...</>
                    : <><WaIcon size={15}/> WA + Ticket</>}
                </button>
              )}
            </>
          )}

          {/* Acciones pendiente */}
          {pendiente && (
            <>
              <button onClick={() => handleAccion('rechazado')} disabled={saving}
                style={{ background:'rgba(230,57,70,.08)', border:'1.5px solid rgba(230,57,70,.3)', color:'#e63946', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-x-circle-fill"></i> Rechazar
              </button>
              <button onClick={handleAprobarPrevio} disabled={saving || generandoWA || cargandoTpl}
                style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', border:'none', color:'#fff', borderRadius:9, padding:'9px 20px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Guardando...</>
                  : <><i className="bi bi-eye-fill"></i> Revisar y aprobar</>}
              </button>
            </>
          )}
        </div>

        {/* ═══ Overlay de PREVIEW antes de aprobar ═══ */}
        {mostrandoPreview && (
          <div
            onClick={e => e.target === e.currentTarget && setMostrandoPreview(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,.5)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 10,
            }}
          >
            <div style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,.3)',
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Header del preview */}
              <div style={{
                background: 'linear-gradient(135deg, #f0a500, #d68f00)',
                padding: '14px 20px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    🎫 Revisar antes de enviar
                  </div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>
                    Verifica que el ticket esté correcto. Luego se enviará al cliente por WhatsApp.
                  </div>
                </div>
                <button
                  onClick={() => setMostrandoPreview(false)}
                  style={{
                    background: 'rgba(255,255,255,.2)',
                    border: 'none', color: '#fff',
                    width: 28, height: 28, borderRadius: 6,
                    cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
                  }}
                >×</button>
              </div>

              {/* Body con preview a tamaño grande */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 20,
                background: '#f7f7f7',
              }}>
                {/* Selector de boleto si hay varios */}
                {todosNumeros.length > 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    marginBottom: 14,
                    fontSize: 13,
                  }}>
                    <button
                      onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                      disabled={previewIndex === 0}
                      style={{
                        background: '#fff',
                        border: '1.5px solid #ddd',
                        borderRadius: 6,
                        padding: '6px 12px',
                        cursor: previewIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: previewIndex === 0 ? 0.4 : 1,
                        fontFamily: 'inherit',
                      }}
                    >← Anterior</button>
                    <span style={{ fontWeight: 700, color: '#333' }}>
                      Boleto {previewIndex + 1} de {todosNumeros.length}
                      <span style={{ marginLeft: 8, color: 'var(--jordyn-primary, #0abfbc)', fontFamily: 'monospace', fontSize: 16 }}>
                        #{todosNumeros[previewIndex]}
                      </span>
                    </span>
                    <button
                      onClick={() => setPreviewIndex(i => Math.min(todosNumeros.length - 1, i + 1))}
                      disabled={previewIndex >= todosNumeros.length - 1}
                      style={{
                        background: '#fff',
                        border: '1.5px solid #ddd',
                        borderRadius: 6,
                        padding: '6px 12px',
                        cursor: previewIndex >= todosNumeros.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: previewIndex >= todosNumeros.length - 1 ? 0.4 : 1,
                        fontFamily: 'inherit',
                      }}
                    >Siguiente →</button>
                  </div>
                )}

                {/* Ticket a tamaño completo */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  overflowX: 'auto',
                }}>
                  {cargandoTpl ? (
                    <div style={{ padding: 60, color: '#999' }}>
                      ⏳ Cargando plantilla…
                    </div>
                  ) : (
                    <div style={{
                      transform: 'scale(0.8)',
                      transformOrigin: 'top center',
                    }}>
                      <TicketEditable
                        r={rifaCompleta || reserva}
                        numero={todosNumeros[previewIndex]}
                        design={{ ...designPreview, numBoleto: todosNumeros[previewIndex] }}
                        printMode={true}
                      />
                    </div>
                  )}
                </div>

                {/* Resumen + check antes de confirmar */}
                <div style={{
                  marginTop: 20,
                  padding: 14,
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  fontSize: 13,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Cliente</div>
                      <div style={{ fontWeight: 700 }}>{reserva.nombre_cliente}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Teléfono</div>
                      <div style={{ fontWeight: 700, color: reserva.telefono ? '#25d366' : '#888' }}>
                        {reserva.telefono || '(sin teléfono)'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Números</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{todosNumeros.join(' · ')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontWeight: 700, color: '#059669' }}>{COP(totalPrecio)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer con acciones */}
              <div style={{
                padding: 14,
                background: '#f0f0f0',
                borderTop: '1px solid #ddd',
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => setMostrandoPreview(false)}
                  disabled={saving || generandoWA}
                  style={{
                    padding: '10px 18px',
                    background: '#fff',
                    color: '#666',
                    border: '1.5px solid #ccc',
                    borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >← Volver</button>
                <button
                  onClick={() => handleAccion('aprobado')}
                  disabled={saving || generandoWA}
                  style={{
                    padding: '10px 22px',
                    background: 'linear-gradient(135deg, #25d366, #128c7e)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 800,
                    cursor: (saving || generandoWA) ? 'not-allowed' : 'pointer',
                    opacity: (saving || generandoWA) ? 0.6 : 1,
                    fontFamily: 'inherit',
                    boxShadow: '0 3px 10px rgba(37,211,102,.4)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {saving
                    ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Aprobando…</>
                    : generandoWA
                      ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Generando ticket…</>
                      : <><WaIcon size={14}/> Confirmar y enviar por WhatsApp</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Panel de números bloqueados
════════════════════════════════════════════════════════════ */
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
        {conflictos.length} número{conflictos.length>1?'s':''} con reservas en conflicto
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

/* ════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function GestionReservas() {
  const { user } = useAuth(); // RF04: solo usamos user.nombre, sin mostrar usuario/username
  const [reservas, setReservas] = useState([]);
  const [todas,    setTodas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('pendiente');
  const [saving,   setSaving]   = useState(false);
  const [selR,     setSelR]     = useState(null);
  const [selHerm,  setSelHerm]  = useState([]);
  const [tasas,    setTasas]    = useState({});

  // Cargar tasas para conversión
  useEffect(() => {
    API.get('/tasas').then(r => setTasas(r.data)).catch(() => {});
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

  const loadTodas = useCallback(async () => {
    try { const r = await API.get('/publico/admin/reservas'); setTodas(r.data); } catch {}
  }, []);

  useEffect(() => { load(); loadTodas(); }, [load, loadTodas]);

  const abrirModal = (r) => {
    const hermanas = todas.filter(
      x => x.id !== r.id &&
           x.rifa_id === r.rifa_id &&
           x.nombre_cliente.trim().toLowerCase() === r.nombre_cliente.trim().toLowerCase()
    );
    setSelR(r);
    setSelHerm(hermanas);
  };

  const handleAccion = async (idOrIds, estado, nota, bulk = false) => {
    setSaving(true);
    try {
      if (bulk) {
        await API.put('/publico/admin/reservas-bulk', { ids: idOrIds, estado, nota_admin: nota });
      } else {
        await API.put(`/publico/admin/reservas/${idOrIds}`, { estado, nota_admin: nota });
      }
      toast.success(estado === 'aprobado'
        ? '✅ Aprobada — se abrirá WhatsApp con el ticket'
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

  // Agrupar por cliente+rifa para vista de lista
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
    <Layout title="RESERVAS DE CLIENTES" vendorName={user?.rol === 'vendedor' ? user?.nombre : null}>

      {/* RF04 — Identificación del vendedor: solo nombre completo, sin usuario/username */}
      {user?.rol === 'vendedor' && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem',
          padding:'10px 16px', borderRadius:12,
          background:'rgba(10,191,188,.07)', border:'1px solid rgba(10,191,188,.2)',
        }}>
          <div style={{
            width:36, height:36, borderRadius:'50%', flexShrink:0,
            background:'linear-gradient(135deg,var(--jordyn-primary),#089a97)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontWeight:900, fontSize:'.9rem',
          }}>
            {user.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--jordyn-primary)' }}>
              {user.nombre}
            </div>
            <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:1 }}>
              Vendedor activo
            </div>
          </div>
        </div>
      )}

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
            const est      = EST[r.estado] || EST.pendiente;
            const numeros  = [r.numero, ...extras.map(e => e.numero)];
            const esGrupo  = numeros.length > 1;
            const totalVal = r.precio * numeros.length;
            return (
              <div key={r.id} onClick={() => abrirModal(r)} className="jd-card"
                style={{ cursor:'pointer', padding:'.9rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', borderLeft:`3px solid ${est.dot}`, transition:'box-shadow .15s, transform .12s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(10,191,188,.12)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform=''; }}
              >
                {/* Número(s) */}
                <div style={{ minWidth:52, flexShrink:0, background:est.bg, border:`1.5px solid ${est.border}`, borderRadius:10, padding:'6px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <span style={{ fontWeight:900, fontSize:esGrupo?'.9rem':'1.1rem', color:est.color, letterSpacing:2 }}>{numeros[0]}</span>
                  {esGrupo && <span style={{ fontSize:'.58rem', color:est.color, opacity:.75 }}>+{numeros.length-1}</span>}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.92rem', color:'var(--jordyn-text)', marginBottom:1, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {r.nombre_cliente}
                    {r.comprobante_base64 && <span style={{ fontSize:'.7rem', color:'var(--jordyn-primary)', fontWeight:600 }}><i className="bi bi-paperclip me-1"></i>Comprobante</span>}
                    {esGrupo && <span style={{ fontSize:'.68rem', background:'rgba(10,191,188,.1)', color:'var(--jordyn-primary)', border:'1px solid rgba(10,191,188,.25)', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>🎟 {numeros.length} números</span>}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)' }}>
                    {r.rifa_nombre}
                    {r.telefono    && <span style={{ marginLeft:10 }}><i className="bi bi-telephone-fill me-1"></i>{r.telefono}</span>}
                    {r.metodo_pago && <span style={{ marginLeft:10 }}><i className="bi bi-credit-card me-1"></i>{r.metodo_pago}</span>}
                  </div>
                  {esGrupo && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:5 }}>
                      {numeros.map((n, i) => <span key={`${n}-${i}`} style={{ background:est.bg, color:est.color, border:`1px solid ${est.border}`, borderRadius:6, padding:'2px 8px', fontSize:'.72rem', fontWeight:800, letterSpacing:1 }}>{n}</span>)}
                    </div>
                  )}
                </div>

                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'.92rem', color:'var(--jordyn-green)' }}>{COP(esGrupo ? totalVal : r.precio)}</div>
                  {esGrupo && <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)' }}>{COP(r.precio)} c/u</div>}
                  <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:2 }}>{fmtTimestamp(r.created_at)}</div>
                </div>

                <span style={{ background:est.bg, color:est.color, border:`1.5px solid ${est.border}`, borderRadius:20, padding:'3px 12px', fontSize:'.7rem', fontWeight:700, flexShrink:0 }}>
                  {est.label}
                </span>

                {r.estado === 'aprobado' && r.telefono && (
                  <button onClick={e => { e.stopPropagation(); abrirWA(r.telefono, buildTicketMsg({ ...r, _numeros: numeros }, r.nota_admin, tasas)); }}
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
          tasas={tasas}
        />
      )}
    </Layout>
  );
}