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

const API_BASE = process.env.REACT_APP_API_URL || 'https://rifasjordynb-production.up.railway.app';

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

/* ─── Construir mensaje WhatsApp — ahora acepta urlsTicket ─── */
function buildTicketMsg(r, nota, tasas = {}, urlsTicket = []) {
  const id     = r.id?.slice(0,8).toUpperCase() || '-------';
  const numeros= Array.isArray(r._numeros) ? r._numeros : [r.numero];
  const numStr = numeros.map(n => `*${n}*`).join(' · ');
  const total  = (r._total_real || r.precio) * numeros.length;

  const copUsd   = tasas?.COP_POR_USD?.valor || 0;
  const totalUSD = copUsd > 0 ? `$${(total / copUsd).toFixed(2)} USD` : null;

  // Si hay URLs de Cloudinary, las agrega al mensaje
  const lineasTicket = urlsTicket.length > 0
    ? `\n🔗 ${urlsTicket.length === 1 ? 'Tu ticket' : 'Tus tickets'}:\n` +
      urlsTicket.map((u, i) => `  🎟 #${numeros[i] ?? i+1}: ${u}`).join('\n') + '\n'
    : '';

  return (
    `*RIFAS JORDYN* — ✅ PAGO CONFIRMADO\n\n` +
    `Hola *${r.nombre_cliente}* 🎉 ¡Tu${numeros.length>1?'s números fueron aprobados':' número fue aprobado'}!\n\n` +
    `🎟 Número${numeros.length>1?'s':''}: ${numStr}\n` +
    `🏆 Premio: ${r.premio || ''}\n` +
    `🎪 Rifa: ${r.rifa_nombre}\n` +
    `📅 Sorteo: ${fmtFecha(r.fecha_sorteo)}\n` +
    `💰 Total: ${COP(total)}${totalUSD ? ` · ${totalUSD}` : ''}\n` +
    `🔖 ID Reserva: #${id}\n` +
    lineasTicket +
    `\n` +
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
   NUEVO — Sube dataURL a Cloudinary vía backend.
   Endpoint: POST /api/upload/ticket
   Devuelve la URL pública o null si falla silenciosamente.
════════════════════════════════════════════════════════════ */
async function subirTicketACloudinary(dataUrl, nombreArchivo) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const fd   = new FormData();
    fd.append('ticket', blob, nombreArchivo);

    const token = localStorage.getItem('token');
    const res   = await fetch(`${API_BASE}/api/upload/ticket`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.url || null;
  } catch (e) {
    console.warn('[Cloudinary] No se pudo subir ticket:', e.message);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   COMPROBANTE PAGINADO
════════════════════════════════════════════════════════════ */
function ComprobantePaginado({ reserva, hermanas = [] }) {
  const [pagina, setPagina] = React.useState(0);

  const lista = [reserva, ...hermanas]
    .filter(r => r.comprobante_base64)
    .map(r => ({
      numero: r.numero,
      metodo: r.metodo_pago || null,
      src: r.comprobante_base64.startsWith('data:')
        ? r.comprobante_base64
        : `data:image/jpeg;base64,${r.comprobante_base64}`,
    }));

  if (lista.length === 0) return null;

  const total   = lista.length;
  const actual  = lista[pagina] || lista[0];
  const esUnico = total === 1;

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8, flexWrap:'wrap' }}>
        <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', display:'flex', alignItems:'center', gap:6 }}>
          <i className="bi bi-paperclip" style={{ color:'var(--jordyn-primary)' }}></i>
          COMPROBANTE{!esUnico?'S':''} DE PAGO
        </div>
        {!esUnico && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button type="button" onClick={() => setPagina(p => Math.max(0, p-1))} disabled={pagina===0}
              style={{ background:pagina===0?'var(--jordyn-bg2)':'var(--jordyn-primary)', border:'none', color:pagina===0?'var(--jordyn-muted)':'#fff', borderRadius:7, width:28, height:28, cursor:pagina===0?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center', opacity:pagina===0?.45:1, transition:'all .12s' }}>
              <i className="bi bi-chevron-left"></i></button>
            <div style={{ display:'flex', gap:5, alignItems:'center' }}>
              {lista.map((_,i) => (
                <button key={i} type="button" onClick={() => setPagina(i)} title={`Comprobante ${i+1} — #${lista[i].numero}`}
                  style={{ width:pagina===i?22:8, height:8, borderRadius:4, border:'none', background:pagina===i?'var(--jordyn-primary)':'var(--jordyn-border)', cursor:'pointer', padding:0, transition:'all .2s' }} />
              ))}
            </div>
            <button type="button" onClick={() => setPagina(p => Math.min(total-1, p+1))} disabled={pagina===total-1}
              style={{ background:pagina===total-1?'var(--jordyn-bg2)':'var(--jordyn-primary)', border:'none', color:pagina===total-1?'var(--jordyn-muted)':'#fff', borderRadius:7, width:28, height:28, cursor:pagina===total-1?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center', opacity:pagina===total-1?.45:1, transition:'all .12s' }}>
              <i className="bi bi-chevron-right"></i></button>
          </div>
        )}
      </div>
      {!esUnico && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:'.65rem', fontWeight:700, color:'var(--jordyn-muted)' }}>{pagina+1} de {total}</span>
          <span style={{ background:'rgba(124,58,237,.1)', border:'1px solid rgba(124,58,237,.25)', color:'#7c3aed', borderRadius:20, padding:'2px 10px', fontSize:'.7rem', fontWeight:800, letterSpacing:1 }}>🎟 #{actual.numero}</span>
          {actual.metodo && <span style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:20, padding:'2px 8px' }}><i className="bi bi-credit-card me-1"></i>{actual.metodo}</span>}
        </div>
      )}
      <ComprobanteVisor key={`visor-${pagina}`} src={actual.src} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   VISOR DE COMPROBANTE — zoom, pan y pantalla completa
════════════════════════════════════════════════════════════ */
function ComprobanteVisor({ src, label = null }) {
  const [zoom, setZoom]             = React.useState(1);
  const [pan, setPan]               = React.useState({ x:0, y:0 });
  const [dragging, setDragging]     = React.useState(false);
  const [dragStart, setDragStart]   = React.useState({ x:0, y:0 });
  const [fullscreen, setFullscreen] = React.useState(false);
  const containerRef = React.useRef(null);
  const MIN_ZOOM=1, MAX_ZOOM=5, STEP=0.4;

  const clampPan = (px,py,z) => z<=1 ? {x:0,y:0} : {x:px,y:py};
  const changeZoom = delta => setZoom(prev => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev+delta).toFixed(2)));
    if (next===1) setPan({x:0,y:0}); else setPan(p => clampPan(p.x,p.y,next));
    return next;
  });
  const resetView = () => { setZoom(1); setPan({x:0,y:0}); };

  const onMouseDown = e => { if(zoom<=1) return; e.preventDefault(); setDragging(true); setDragStart({x:e.clientX-pan.x,y:e.clientY-pan.y}); };
  const onMouseMove = e => { if(!dragging) return; setPan({x:e.clientX-dragStart.x,y:e.clientY-dragStart.y}); };
  const onMouseUp   = () => setDragging(false);

  const touchRef = React.useRef(null);
  const onTouchStart = e => { if(zoom<=1||e.touches.length!==1) return; touchRef.current={x:e.touches[0].clientX-pan.x,y:e.touches[0].clientY-pan.y}; };
  const onTouchMove  = e => { if(!touchRef.current||e.touches.length!==1) return; e.preventDefault(); setPan({x:e.touches[0].clientX-touchRef.current.x,y:e.touches[0].clientY-touchRef.current.y}); };
  const onTouchEnd   = () => { touchRef.current=null; };
  const onWheel      = e => { e.preventDefault(); changeZoom(e.deltaY<0?STEP:-STEP); };

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive:false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const pct = Math.round(zoom*100);
  const toolbarBtn = (onClick, icon, title, active=false, danger=false) => (
    <button type="button" onClick={onClick} title={title} style={{ background:active?'var(--jordyn-primary)':danger?'rgba(230,57,70,.12)':'rgba(255,255,255,.12)', border:`1px solid ${active?'var(--jordyn-primary)':danger?'rgba(230,57,70,.4)':'rgba(255,255,255,.2)'}`, color:active?'#fff':danger?'#e63946':'#fff', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'.8rem', fontWeight:700, display:'flex', alignItems:'center', gap:4, transition:'all .12s', fontFamily:'inherit' }}>
      <i className={`bi ${icon}`}></i>
      {title && <span style={{ fontSize:'.7rem' }}>{title}</span>}
    </button>
  );

  return (
    <div style={{ marginBottom:0 }}>
      {!label && <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', fontWeight:500, fontStyle:'italic', marginBottom:6, textAlign:'right' }}>Scroll o botones para hacer zoom · Arrastra para mover</div>}
      <div ref={containerRef}
        style={{ position:'relative', border:'2px solid var(--jordyn-border)', borderRadius:10, overflow:'hidden', background:'#111', display:'flex', alignItems:'center', justifyContent:'center', minHeight:fullscreen?'60vh':200, maxHeight:fullscreen?'80vh':320, cursor:zoom>1?(dragging?'grabbing':'grab'):'default' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <img src={src} alt="Comprobante" draggable={false}
          style={{ transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:'center center', transition:dragging?'none':'transform .15s ease', cursor:zoom>1?(dragging?'grabbing':'grab'):'zoom-in', userSelect:'none', display:'block', maxWidth:'100%', maxHeight:fullscreen?'80vh':320, objectFit:'contain' }} />
        <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:5, alignItems:'center', background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)', borderRadius:10, padding:'5px 8px', zIndex:10 }}>
          {toolbarBtn(()=>changeZoom(-STEP),'bi-zoom-out','')}
          <span style={{ color:'#fff', fontSize:'.72rem', fontWeight:800, minWidth:38, textAlign:'center', letterSpacing:.5 }}>{pct}%</span>
          {toolbarBtn(()=>changeZoom(STEP),'bi-zoom-in','')}
          {toolbarBtn(resetView,'bi-arrow-counterclockwise','Reset',false,zoom>1)}
          {toolbarBtn(()=>setFullscreen(f=>!f),fullscreen?'bi-fullscreen-exit':'bi-fullscreen','',fullscreen)}
          <a href={src} download="comprobante.jpg" title="Descargar comprobante"
            style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', borderRadius:7, padding:'5px 10px', fontSize:'.8rem', display:'flex', alignItems:'center', gap:4, textDecoration:'none', transition:'all .12s' }}>
            <i className="bi bi-download"></i>
          </a>
        </div>
        {zoom>1 && <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,.6)', color:'#fff', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', fontWeight:700, letterSpacing:.5, pointerEvents:'none' }}>🔍 {pct}% — arrastra para mover</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   NUEVO — Panel de URLs de ticket generadas (Cloudinary)
   Muestra cada URL con botón "Copiar URL" y "Ver en navegador"
════════════════════════════════════════════════════════════ */
function PanelUrlsTicket({ urls = [] }) {
  const [copiado, setCopiado] = React.useState(null);
  if (urls.length === 0) return null;

  const copiar = async (url, i) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  return (
    <div style={{ marginBottom:'1.25rem', background:'rgba(10,191,188,.05)', border:'1.5px solid rgba(10,191,188,.25)', borderRadius:12, padding:'12px 14px' }}>
      <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
        <i className="bi bi-link-45deg"></i>
        URL{urls.length>1?'S':''} DEL TICKET
        <span style={{ background:'rgba(10,191,188,.15)', borderRadius:20, padding:'1px 8px', fontSize:'.6rem', fontWeight:800 }}>{urls.length}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {urls.map((url, i) => (
          <div key={i} style={{ background:'var(--jordyn-bg,#fff)', border:'1px solid var(--jordyn-border)', borderRadius:8, padding:'8px 10px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {/* URL truncada */}
            <div style={{ flex:1, fontSize:'.72rem', color:'var(--jordyn-muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
              {url}
            </div>
            {/* Botón copiar */}
            <button onClick={() => copiar(url, i)} title="Copiar URL"
              style={{ background:copiado===i?'rgba(6,214,160,.15)':'var(--jordyn-bg2)', border:`1px solid ${copiado===i?'rgba(6,214,160,.4)':'var(--jordyn-border)'}`, color:copiado===i?'#059669':'var(--jordyn-text)', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:'.75rem', fontWeight:700, display:'flex', alignItems:'center', gap:4, flexShrink:0, transition:'all .15s', fontFamily:'inherit' }}>
              <i className={`bi ${copiado===i?'bi-check-lg':'bi-clipboard'}`}></i>
              {copiado===i?'Copiado':'Copiar URL'}
            </button>
            {/* Botón ver en navegador */}
            <a href={url} target="_blank" rel="noreferrer" title="Ver en navegador"
              style={{ background:'rgba(10,191,188,.1)', border:'1px solid rgba(10,191,188,.3)', color:'var(--jordyn-primary)', borderRadius:6, padding:'5px 10px', fontSize:'.75rem', fontWeight:700, display:'flex', alignItems:'center', gap:4, textDecoration:'none', flexShrink:0, transition:'all .15s' }}>
              <i className="bi bi-box-arrow-up-right"></i> Ver
            </a>
          </div>
        ))}
      </div>
      <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:8, fontStyle:'italic' }}>
        💡 Estas URLs se abren en cualquier navegador y puedes compartirlas directamente.
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL DETALLE DE RESERVA
════════════════════════════════════════════════════════════ */
function ModalReserva({ reserva: inicial, hermanas = [], onClose, onAccion, saving, tasas }) {
  const [reserva,         setReserva]        = useState(inicial);
  const [nota,            setNota]           = useState(inicial.nota_admin || '');
  const [generandoWA,     setGenerandoWA]    = useState(false);
  const [mostrandoPreview,setMostrandoPreview] = useState(false);
  const [previewIndex,    setPreviewIndex]   = useState(0);
  const [plantilla,       setPlantilla]      = useState(null);
  const [rifaCompleta,    setRifaCompleta]   = useState(null);
  const [cargandoTpl,     setCargandoTpl]    = useState(false);

  // ── NUEVO ──
  const [urlsTicket,       setUrlsTicket]       = useState([]);
  const [subiendoTicket,   setSubiendoTicket]   = useState(false);
  const [enviandoBaileys,  setEnviandoBaileys]  = useState(false);
  const [baileysStatus,    setBaileysStatus]    = useState(null); // 'ok' | 'error' | null

  const est       = EST[reserva.estado] || EST.pendiente;
  const pendiente = reserva.estado === 'pendiente';
  const todosNumeros = [reserva, ...hermanas].map(r => r.numero);
  const totalPrecio  = reserva.precio * todosNumeros.length;
  const copUsd   = tasas?.COP_POR_USD?.valor || 0;
  const totalUSD = copUsd > 0 ? `$${(totalPrecio / copUsd).toFixed(2)} USD` : null;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargandoTpl(true);
      try {
        const [rifaR] = await Promise.all([
          API.get(`/rifas/${reserva.rifa_id}`).catch(() => ({ data:null })),
        ]);
        if (cancelado) return;
        const rifaData = rifaR.data || { id:reserva.rifa_id, nombre:reserva.rifa_nombre, premio:reserva.premio, precio:reserva.precio, fecha_sorteo:reserva.fecha_sorteo };
        setRifaCompleta(rifaData);
        const tpl = await resolverPlantillaParaRifa(rifaData);
        if (!cancelado) setPlantilla(tpl);
      } catch (e) { console.warn('No se pudo cargar plantilla/rifa:', e); }
      finally { if (!cancelado) setCargandoTpl(false); }
    })();
    return () => { cancelado = true; };
  }, [reserva.rifa_id, reserva.rifa_nombre, reserva.premio, reserva.precio, reserva.fecha_sorteo]);

  const designPreview = React.useMemo(() => {
    const extraido = extraerDesign(plantilla);
    return extraido ? { ...DEFAULT_DESIGN, ...extraido } : { ...DEFAULT_DESIGN };
  }, [plantilla]);

  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') { if (mostrandoPreview) setMostrandoPreview(false); else onClose(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose, mostrandoPreview]);

  const handleAprobarPrevio = () => { setPreviewIndex(0); setMostrandoPreview(true); };

  const handleAccion = async (estado) => {
    const hermanasPendientes = hermanas.filter(h => h.estado === 'pendiente');
    const todasPendientes    = [reserva, ...hermanasPendientes].filter(r => r.estado === 'pendiente');

    // ── Si es rechazo, flujo normal ──────────────────────────────
    if (estado !== 'aprobado') {
      let ok;
      if (todasPendientes.length > 1)
        ok = await onAccion(todasPendientes.map(r => r.id), estado, nota, true);
      else
        ok = await onAccion(reserva.id, estado, nota, false);
      if (ok) { setReserva(p => ({ ...p, estado, nota_admin: nota })); setMostrandoPreview(false); }
      return;
    }

    // ── APROBADO: intentar Baileys primero ───────────────────────
    setEnviandoBaileys(true);
    setBaileysStatus(null);
    try {
      // 1. Generar imágenes de tickets
      const rifaPara = rifaCompleta || {
        id: reserva.rifa_id, nombre: reserva.rifa_nombre, premio: reserva.premio,
        precio: reserva.precio, fecha_sorteo: reserva.fecha_sorteo,
        loteria_ref: reserva.loteria_ref, hora_sorteo: reserva.hora_sorteo,
      };
      const ticketsBase64 = [];
      const urlsCloud     = [];

      for (const num of todosNumeros) {
        const imgDataUrl = await generarImagenTicketTemplate({ rifa: rifaPara, numero: num, plantilla });
        if (imgDataUrl) {
          ticketsBase64.push(imgDataUrl);
          const urlPublica = await subirTicketACloudinary(imgDataUrl, `ticket-${reserva.id?.slice(0,8)}-${num}.png`);
          if (urlPublica) urlsCloud.push(urlPublica);
        }
      }

      if (urlsCloud.length > 0) setUrlsTicket(urlsCloud);

      // 2. Construir mensaje de confirmación
      const msg = buildTicketMsg({ ...reserva, _numeros: todosNumeros }, nota, tasas, urlsCloud);

      // 3. Llamar al endpoint de Baileys que aprueba en BD y envía WA
      const token = localStorage.getItem('token');
      const resp  = await fetch(`${API_BASE}/api/baileys/reservas/${reserva.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nota, ticketsBase64, mensajeTexto: msg }),
      });
      const data = await resp.json();

      if (resp.ok && data.ok) {
        setBaileysStatus('ok');
        setReserva(p => ({ ...p, estado: 'aprobado', nota_admin: nota }));
        setMostrandoPreview(false);
        onAccion && onAccion.__refreshOnly && onAccion.__refreshOnly(); // recargar lista
        if (data.waSent) {
          toast.success(`✅ Aprobada y ticket enviado por WhatsApp (Baileys) 🎉`);
        } else if (data.sinTelefono) {
          toast.success('✅ Aprobada — sin teléfono, no se envió WA');
        } else if (data.waError) {
          toast.warn(`✅ Aprobada en BD, pero error WA: ${data.waError}`);
        }
        // Refrescar lista en el padre
        await onAccion(reserva.id, 'aprobado', nota, false, true /* skipBD */);
      } else {
        throw new Error(data.error || 'Error en Baileys');
      }

    } catch (baileysErr) {
      console.warn('[GestionReservas] Baileys falló, usando flujo legacy:', baileysErr.message);
      setBaileysStatus('error');
      // Fallback: aprobar en BD y abrir WA web manualmente
      let ok;
      if (todasPendientes.length > 1)
        ok = await onAccion(todasPendientes.map(r => r.id), 'aprobado', nota, true);
      else
        ok = await onAccion(reserva.id, 'aprobado', nota, false);
      if (ok) {
        setReserva(p => ({ ...p, estado: 'aprobado', nota_admin: nota }));
        setMostrandoPreview(false);
        toast.warn('Baileys no disponible — se abrirá WhatsApp Web');
        await enviarWAConTicket();
      }
    } finally {
      setEnviandoBaileys(false);
    }
  };

  /* ── NUEVO: Generar imágenes y subirlas a Cloudinary sin enviar WA ── */
  const generarYSubirTickets = async () => {
    const rifaPara = rifaCompleta || {
      id:reserva.rifa_id, nombre:reserva.rifa_nombre, premio:reserva.premio,
      precio:reserva.precio, fecha_sorteo:reserva.fecha_sorteo,
      loteria_ref:reserva.loteria_ref, hora_sorteo:reserva.hora_sorteo,
    };
    setSubiendoTicket(true);
    const urls = [];
    for (let i = 0; i < todosNumeros.length; i++) {
      const num = todosNumeros[i];
      const imgDataUrl = await generarImagenTicketTemplate({ rifa:rifaPara, numero:num, plantilla });
      if (imgDataUrl) {
        const urlPublica = await subirTicketACloudinary(imgDataUrl, `ticket-${reserva.id?.slice(0,8)}-${num}.png`);
        if (urlPublica) urls.push(urlPublica);
      }
    }
    setSubiendoTicket(false);
    setUrlsTicket(urls);
    if (urls.length > 0) {
      toast.success(`🔗 ${urls.length} URL${urls.length>1?'s':''} de ticket lista${urls.length>1?'s':''}`);
    } else {
      toast.error('No se pudo generar la URL. Revisa las variables de Cloudinary.');
    }
  };

  /* ── Enviar WA con imagen del ticket (incluye URLs en el mensaje) ── */
  const enviarWAConTicket = async () => {
    if (!reserva.telefono) {
      abrirWA('', buildTicketMsg({ ...reserva, _numeros:todosNumeros }, nota, tasas));
      return;
    }
    setGenerandoWA(true);
    try {
      const rifaPara = rifaCompleta || {
        id:reserva.rifa_id, nombre:reserva.rifa_nombre, premio:reserva.premio,
        precio:reserva.precio, fecha_sorteo:reserva.fecha_sorteo,
        loteria_ref:reserva.loteria_ref, hora_sorteo:reserva.hora_sorteo,
      };
      const archivos  = [];
      const dataUrls  = [];
      const urlsCloud = [];

      for (let i = 0; i < todosNumeros.length; i++) {
        const num        = todosNumeros[i];
        const imgDataUrl = await generarImagenTicketTemplate({ rifa:rifaPara, numero:num, plantilla });
        if (imgDataUrl) {
          dataUrls.push({ num, url:imgDataUrl });
          try {
            const blob = await (await fetch(imgDataUrl)).blob();
            archivos.push(new File([blob], `ticket-${reserva.id?.slice(0,8)}-${num}.png`, { type:'image/png' }));
          } catch(e) { console.warn('No se pudo convertir imagen a File:', e); }
          const urlPublica = await subirTicketACloudinary(imgDataUrl, `ticket-${reserva.id?.slice(0,8)}-${num}.png`);
          if (urlPublica) urlsCloud.push(urlPublica);
        }
      }

      if (urlsCloud.length > 0) setUrlsTicket(urlsCloud);

      const msg = buildTicketMsg({ ...reserva, _numeros:todosNumeros }, nota, tasas, urlsCloud);

      const puedeCompartirFiles =
        typeof navigator !== 'undefined' &&
        navigator.canShare && archivos.length > 0 && navigator.canShare({ files:archivos });

      if (puedeCompartirFiles) {
        try {
          await navigator.share({ files:archivos, text:msg, title:`Ticket Rifas Jordyn #${reserva.id?.slice(0,8).toUpperCase()}` });
          toast.success('✅ Compartido. El cliente recibirá imagen + texto juntos.');
          return;
        } catch(e) { if (e.name !== 'AbortError') console.warn('share falló, usando fallback:', e); }
      }

      for (let i = 0; i < dataUrls.length; i++) {
        const { num, url } = dataUrls[i];
        const a = document.createElement('a');
        a.href = url; a.download = `ticket-${reserva.id?.slice(0,8)}-${num}.png`; a.click();
        if (i < dataUrls.length-1) await new Promise(r => setTimeout(r, 300));
      }
      if (dataUrls.length > 0) {
        toast.info(`📸 ${dataUrls.length} ticket${dataUrls.length>1?'s':''} descargado${dataUrls.length>1?'s':''} — adjúnta${dataUrls.length>1?'los':'lo'} en WhatsApp`, { autoClose:6000 });
      }
      abrirWA(reserva.telefono, msg);
    } catch(e) {
      console.error('Error enviando WA con ticket:', e);
      abrirWA(reserva.telefono, buildTicketMsg({ ...reserva, _numeros:todosNumeros }, nota, tasas));
    } finally { setGenerandoWA(false); }
  };

  const copiarTexto = async () => {
    await navigator.clipboard.writeText(buildTicketMsg({ ...reserva, _numeros:todosNumeros }, nota, tasas, urlsTicket));
    toast.success('Texto del ticket copiado 📋');
  };

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ position:'relative', width:'100%', maxWidth:640, maxHeight:'92vh', background:'var(--jordyn-bg,#fff)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(10,191,188,.20)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', padding:'1.1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>
              Reserva #{reserva.id?.slice(0,8).toUpperCase()}
              {todosNumeros.length>1 && <span style={{ marginLeft:8, background:'rgba(255,255,255,.25)', borderRadius:20, padding:'2px 10px', fontSize:'.72rem' }}>{todosNumeros.length} números</span>}
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
            {todosNumeros.map((n,i) => (
              <div key={`${n}-${i}`} style={{ background:'linear-gradient(135deg,rgba(10,191,188,.08),rgba(10,191,188,.04))', border:'2px solid rgba(10,191,188,.25)', borderRadius:10, padding:'8px 16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ fontSize:'.55rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:2 }}>Nº</div>
                <div style={{ fontSize:'2rem', fontWeight:900, color:'var(--jordyn-primary)', letterSpacing:'4px', lineHeight:1 }}>{n}</div>
              </div>
            ))}
          </div>

          {/* Datos del cliente */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:'1.25rem' }}>
            {[
              { l:'Cliente',     v:reserva.nombre_cliente, bold:true },
              { l:'Teléfono',    v:reserva.telefono||'—' },
              { l:'Rifa',        v:reserva.rifa_nombre },
              { l:'Valor c/u',   v:COP(reserva.precio), color:'#059669' },
              { l:'Método pago', v:reserva.metodo_pago||'—' },
              { l:'Total',       v:COP(totalPrecio), color:'var(--jordyn-primary)', bold:true },
              { l:'Premio',      v:reserva.premio||'—' },
              { l:'Sorteo',      v:fmtFecha(reserva.fecha_sorteo) },
            ].map(({ l,v,bold,color }) => (
              <div key={l} style={{ background:'var(--jordyn-bg2)', borderRadius:8, padding:'8px 12px', border:'1px solid var(--jordyn-border)' }}>
                <div style={{ fontSize:'.6rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:'.85rem', fontWeight:bold?700:500, color:color||'var(--jordyn-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* USD */}
          {totalUSD && (
            <div style={{ background:'rgba(10,191,188,.06)', border:'1px solid rgba(10,191,188,.2)', borderRadius:10, padding:'8px 14px', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', fontWeight:600 }}>Equivalente en USD <span style={{ fontSize:'.6rem' }}>(tasa: {copUsd.toLocaleString()} COP)</span></div>
              <div style={{ fontWeight:800, color:'var(--jordyn-primary)', fontSize:'.95rem' }}>{totalUSD}</div>
            </div>
          )}

          {/* Preview del ticket */}
          <div style={{ marginBottom:'1.25rem' }}>
            <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span><i className="bi bi-ticket-perforated-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>Vista previa del ticket</span>
              {plantilla && (
                <span style={{ background:'rgba(10,191,188,.1)', color:'var(--jordyn-primary)', border:'1px solid rgba(10,191,188,.25)', borderRadius:4, padding:'1px 8px', fontSize:'.6rem', fontWeight:700, textTransform:'none', letterSpacing:0 }}>
                  📄 {plantilla.nombre}
                </span>
              )}
            </div>
            <div style={{ display:'flex', justifyContent:'center', background:'#fafafa', borderRadius:8, padding:10, border:'1px dashed #d0d0d0', overflow:'hidden' }}>
              {cargandoTpl ? (
                <div style={{ padding:30, color:'#999', fontSize:13 }}>⏳ Cargando plantilla…</div>
              ) : (() => {
                const SCALE=0.55, W=designPreview.ticketWidth||680, H=designPreview.ticketHeight||280;
                return (
                  <div style={{ width:W*SCALE, height:H*SCALE, flexShrink:0, position:'relative', overflow:'visible' }}>
                    <div style={{ position:'absolute', top:0, left:0, transformOrigin:'top left', transform:`scale(${SCALE})` }}>
                      <TicketEditable r={rifaCompleta||reserva} numero={todosNumeros[0]} design={{ ...designPreview, numBoleto:todosNumeros[0] }} printMode={true} />
                    </div>
                  </div>
                );
              })()}
            </div>
            {todosNumeros.length>1 && (
              <div style={{ fontSize:'.7rem', color:'var(--jordyn-muted)', textAlign:'center', marginTop:6, fontStyle:'italic' }}>
                Mostrando el primero de {todosNumeros.length} boletos. Al confirmar se generarán todos.
              </div>
            )}

            {/* ── NUEVO: botón Generar URL del ticket ── */}
            <div style={{ marginTop:10, display:'flex', justifyContent:'center' }}>
              <button
                onClick={generarYSubirTickets}
                disabled={subiendoTicket || cargandoTpl}
                style={{
                  background: subiendoTicket ? 'var(--jordyn-bg2)' : 'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))',
                  border:'none', color: subiendoTicket ? 'var(--jordyn-muted)' : '#fff',
                  borderRadius:8, padding:'8px 18px',
                  cursor: subiendoTicket ? 'not-allowed' : 'pointer',
                  fontSize:'.8rem', fontWeight:700,
                  display:'flex', alignItems:'center', gap:6,
                  fontFamily:'inherit', transition:'all .15s',
                }}
              >
                {subiendoTicket
                  ? <><span className="jd-spinner" style={{ width:12, height:12, borderWidth:2 }}></span> Generando URL…</>
                  : <><i className="bi bi-link-45deg"></i> Generar URL del ticket</>}
              </button>
            </div>
          </div>

          {/* ── NUEVO: Panel de URLs generadas ── */}
          <PanelUrlsTicket urls={urlsTicket} />

          {/* Comprobantes */}
          <ComprobantePaginado reserva={reserva} hermanas={hermanas} />

          {/* Nota admin (solo lectura) */}
          {!pendiente && reserva.nota_admin && (
            <div style={{ background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'10px 14px', marginBottom:'1rem', fontSize:'.82rem' }}>
              <span style={{ fontWeight:700, color:'var(--jordyn-muted)', fontSize:'.65rem', textTransform:'uppercase' }}>Nota: </span>
              {reserva.nota_admin}
            </div>
          )}

          {/* Nota editable */}
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>
              Nota para el cliente (opcional)
            </label>
            <textarea className="jd-input" rows={2} value={nota} onChange={e => setNota(e.target.value)}
              placeholder="Ej: ¡Tu número está confirmado, mucha suerte!"
              style={{ resize:'vertical', fontSize:'.85rem' }} disabled={!pendiente} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--jordyn-border)', background:'var(--jordyn-bg2)', flexShrink:0, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {(reserva.estado==='aprobado' || pendiente) && (
            <>
              <button onClick={copiarTexto}
                style={{ background:'var(--jordyn-bg)', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-text)', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-clipboard"></i> Copiar texto
              </button>
              {reserva.telefono && (
                <button onClick={enviarWAConTicket} disabled={generandoWA}
                  title="Reenviar ticket por WhatsApp Web (fallback)"
                  style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                  {generandoWA
                    ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Generando...</>
                    : <><WaIcon size={15}/> WA Web</>}
                </button>
              )}
              {baileysStatus === 'ok' && (
                <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.78rem', color:'#059669', fontWeight:700, padding:'9px 14px', background:'rgba(6,214,160,.08)', border:'1px solid rgba(6,214,160,.3)', borderRadius:9 }}>
                  <i className="bi bi-send-check-fill"></i> Enviado por Baileys
                </span>
              )}
            </>
          )}
          {pendiente && (
            <>
              <button onClick={() => handleAccion('rechazado')} disabled={saving}
                style={{ background:'rgba(230,57,70,.08)', border:'1.5px solid rgba(230,57,70,.3)', color:'#e63946', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                <i className="bi bi-x-circle-fill"></i> Rechazar
              </button>
              <button onClick={handleAprobarPrevio} disabled={saving||generandoWA||cargandoTpl}
                style={{ background:'linear-gradient(135deg,var(--jordyn-primary),var(--jordyn-primary-d))', border:'none', color:'#fff', borderRadius:9, padding:'9px 20px', cursor:'pointer', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Guardando...</>
                  : <><i className="bi bi-eye-fill"></i> Revisar y aprobar</>}
              </button>
            </>
          )}
        </div>

        {/* ═══ Overlay PREVIEW ═══ */}
        {mostrandoPreview && (
          <div onClick={e => e.target===e.currentTarget && setMostrandoPreview(false)}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, zIndex:10 }}>
            <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,.3)', width:'100%', maxWidth:720, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#f0a500,#d68f00)', padding:'14px 20px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800 }}>🎫 Revisar antes de enviar</div>
                  <div style={{ fontSize:11, opacity:.9, marginTop:2 }}>Verifica que el ticket esté correcto. Luego se enviará al cliente por WhatsApp.</div>
                </div>
                <button onClick={() => setMostrandoPreview(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:18, lineHeight:1, padding:0 }}>×</button>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:20, background:'#f7f7f7' }}>
                {todosNumeros.length > 1 && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:14, fontSize:13 }}>
                    <button onClick={() => setPreviewIndex(i => Math.max(0, i-1))} disabled={previewIndex===0}
                      style={{ background:'#fff', border:'1.5px solid #ddd', borderRadius:6, padding:'6px 12px', cursor:previewIndex===0?'not-allowed':'pointer', opacity:previewIndex===0?.4:1, fontFamily:'inherit' }}>← Anterior</button>
                    <span style={{ fontWeight:700, color:'#333' }}>
                      Boleto {previewIndex+1} de {todosNumeros.length}
                      <span style={{ marginLeft:8, color:'var(--jordyn-primary,#0abfbc)', fontFamily:'monospace', fontSize:16 }}>#{todosNumeros[previewIndex]}</span>
                    </span>
                    <button onClick={() => setPreviewIndex(i => Math.min(todosNumeros.length-1, i+1))} disabled={previewIndex>=todosNumeros.length-1}
                      style={{ background:'#fff', border:'1.5px solid #ddd', borderRadius:6, padding:'6px 12px', cursor:previewIndex>=todosNumeros.length-1?'not-allowed':'pointer', opacity:previewIndex>=todosNumeros.length-1?.4:1, fontFamily:'inherit' }}>Siguiente →</button>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'center', overflowX:'auto' }}>
                  {cargandoTpl ? (
                    <div style={{ padding:60, color:'#999' }}>⏳ Cargando plantilla…</div>
                  ) : (
                    <div style={{ transform:'scale(0.8)', transformOrigin:'top center' }}>
                      <TicketEditable r={rifaCompleta||reserva} numero={todosNumeros[previewIndex]} design={{ ...designPreview, numBoleto:todosNumeros[previewIndex] }} printMode={true} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop:20, padding:14, background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[
                      { l:'Cliente', v:reserva.nombre_cliente },
                      { l:'Teléfono', v:reserva.telefono||'(sin teléfono)', color:reserva.telefono?'#25d366':'#888' },
                      { l:'Números', v:todosNumeros.join(' · '), mono:true },
                      { l:'Total', v:COP(totalPrecio), color:'#059669' },
                    ].map(({ l,v,color,mono }) => (
                      <div key={l}>
                        <div style={{ fontSize:10, color:'#888', fontWeight:700, textTransform:'uppercase' }}>{l}</div>
                        <div style={{ fontWeight:700, color:color||'#333', fontFamily:mono?'monospace':'inherit' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ padding:14, background:'#f0f0f0', borderTop:'1px solid #ddd', display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => setMostrandoPreview(false)} disabled={saving||generandoWA||enviandoBaileys}
                  style={{ padding:'10px 18px', background:'#fff', color:'#666', border:'1.5px solid #ccc', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>← Volver</button>
                <button onClick={() => handleAccion('aprobado')} disabled={saving||generandoWA||enviandoBaileys}
                  style={{ padding:'10px 22px', background:'linear-gradient(135deg,#25d366,#128c7e)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:800, cursor:(saving||generandoWA||enviandoBaileys)?'not-allowed':'pointer', opacity:(saving||generandoWA||enviandoBaileys)?.6:1, fontFamily:'inherit', boxShadow:'0 3px 10px rgba(37,211,102,.4)', display:'flex', alignItems:'center', gap:6 }}>
                  {saving
                    ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Aprobando…</>
                    : enviandoBaileys
                      ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Enviando ticket…</>
                      : generandoWA
                        ? <><span className="jd-spinner" style={{ width:13, height:13, borderWidth:2 }}></span> Generando ticket…</>
                        : <><i className="bi bi-send-fill me-1"></i> Confirmar y enviar ticket</>}
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
  reservas.filter(r => r.estado==='pendiente').forEach(r => {
    if (!grupos[r.numero]) grupos[r.numero]=[];
    grupos[r.numero].push(r);
  });
  const conflictos = Object.entries(grupos).filter(([,rs]) => rs.length > 1);
  if (!conflictos.length) return null;
  return (
    <div className="jd-alert jd-alert-warning" style={{ marginBottom:'1.25rem' }}>
      <div style={{ fontWeight:800, marginBottom:6 }}>
        <i className="bi bi-exclamation-triangle-fill me-1"></i>
        {conflictos.length} número{conflictos.length>1?'s':''} con reservas en conflicto
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {conflictos.map(([num,rs]) => (
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
  const { user } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [todas,    setTodas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('pendiente');
  const [saving,   setSaving]   = useState(false);
  const [selR,     setSelR]     = useState(null);
  const [selHerm,  setSelHerm]  = useState([]);
  const [tasas,    setTasas]    = useState({});

  useEffect(() => { API.get('/tasas').then(r => setTasas(r.data)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filtro==='todos' ? '/publico/admin/reservas' : `/publico/admin/reservas?estado=${filtro}`;
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
      x => x.id !== r.id && x.rifa_id === r.rifa_id && x.estado === r.estado &&
           x.nombre_cliente.trim().toLowerCase() === r.nombre_cliente.trim().toLowerCase()
    );
    setSelR(r); setSelHerm(hermanas);
  };

  const handleAccion = async (idOrIds, estado, nota, bulk = false, skipBD = false) => {
    // skipBD=true cuando Baileys ya aprobó en BD y solo queremos refrescar la lista
    if (skipBD) { load(); loadTodas(); return true; }
    setSaving(true);
    try {
      if (bulk) await API.put('/publico/admin/reservas-bulk', { ids: idOrIds, estado, nota_admin: nota });
      else      await API.put(`/publico/admin/reservas/${idOrIds}`, { estado, nota_admin: nota });
      if (estado !== 'aprobado') toast.success('❌ Rechazada — número liberado');
      load(); loadTodas();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error procesando reserva');
      return false;
    } finally { setSaving(false); }
  };

  const conteos = todas.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado]||0)+1;
    acc.todos = (acc.todos||0)+1;
    return acc;
  }, {});

  const TABS = [
    { key:'pendiente', label:'Pendientes', icon:'bi-hourglass-split',   color:'#b37700',             count:conteos.pendiente||0 },
    { key:'aprobado',  label:'Aprobados',  icon:'bi-check-circle-fill', color:'#059669',             count:conteos.aprobado||0  },
    { key:'rechazado', label:'Rechazados', icon:'bi-x-circle-fill',     color:'#e63946',             count:conteos.rechazado||0 },
    { key:'todos',     label:'Todos',      icon:'bi-list-ul',            color:'var(--jordyn-muted)', count:conteos.todos||0     },
  ];

  const reservasAgrupadas = (() => {
    const grupos = {};
    reservas.forEach(r => {
      const key = `${r.rifa_id}||${r.nombre_cliente.trim().toLowerCase()}||${r.estado}`;
      if (!grupos[key]) grupos[key] = { principal:r, extras:[] };
      else grupos[key].extras.push(r);
    });
    return Object.values(grupos);
  })();

  return (
    <Layout title="RESERVAS DE CLIENTES" vendorName={user?.rol==='vendedor' ? user?.nombre : null}>

      {user?.rol==='vendedor' && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem', padding:'10px 16px', borderRadius:12, background:'rgba(10,191,188,.07)', border:'1px solid rgba(10,191,188,.2)' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,var(--jordyn-primary),#089a97)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:'.9rem' }}>
            {user.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--jordyn-primary)' }}>{user.nombre}</div>
            <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:1 }}>Vendedor activo</div>
          </div>
        </div>
      )}

      <PanelBloqueados reservas={todas} />

      <div style={{ display:'flex', gap:8, marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:20, cursor:'pointer', fontWeight:700, fontSize:'.8rem', transition:'all .15s', border:`1.5px solid ${filtro===t.key?t.color:'var(--jordyn-border)'}`, background:filtro===t.key?`${t.color}14`:'var(--jordyn-bg,#fff)', color:filtro===t.key?t.color:'var(--jordyn-muted)' }}>
            <i className={`bi ${t.icon}`}></i>{t.label}
            {t.count>0 && <span style={{ background:filtro===t.key?t.color:'var(--jordyn-bg2)', color:filtro===t.key?'#fff':'var(--jordyn-muted)', borderRadius:20, padding:'0 7px', fontSize:'.7rem', fontWeight:800 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div className="jd-spinner" style={{ width:44, height:44 }}></div>
        </div>
      ) : reservasAgrupadas.length===0 ? (
        <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'.75rem' }}>📭</div>
          <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-text)', marginBottom:4 }}>Sin reservas</div>
          <div style={{ fontSize:'.82rem', color:'var(--jordyn-muted)' }}>No hay reservas con el filtro seleccionado</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {reservasAgrupadas.map(({ principal:r, extras }) => {
            const est     = EST[r.estado] || EST.pendiente;
            const numeros = [r.numero, ...extras.map(e => e.numero)];
            const esGrupo = numeros.length > 1;
            const totalVal= r.precio * numeros.length;
            return (
              <div key={r.id} onClick={() => abrirModal(r)} className="jd-card"
                style={{ cursor:'pointer', padding:'.9rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', borderLeft:`3px solid ${est.dot}`, transition:'box-shadow .15s, transform .12s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(10,191,188,.12)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform=''; }}>
                <div style={{ minWidth:52, flexShrink:0, background:est.bg, border:`1.5px solid ${est.border}`, borderRadius:10, padding:'6px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <span style={{ fontWeight:900, fontSize:esGrupo?'.9rem':'1.1rem', color:est.color, letterSpacing:2 }}>{numeros[0]}</span>
                  {esGrupo && <span style={{ fontSize:'.58rem', color:est.color, opacity:.75 }}>+{numeros.length-1}</span>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.92rem', color:'var(--jordyn-text)', marginBottom:1, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {r.nombre_cliente}
                    {r.comprobante_base64 && <span style={{ fontSize:'.7rem', color:'var(--jordyn-primary)', fontWeight:600 }}><i className="bi bi-paperclip me-1"></i>Comprobante</span>}
                    {r.origen === 'whatsapp' && <span style={{ fontSize:'.65rem', fontWeight:700, background:'rgba(37,211,102,.12)', color:'#128c7e', border:'1px solid rgba(37,211,102,.3)', borderRadius:20, padding:'1px 8px', display:'inline-flex', alignItems:'center', gap:3 }}><WaIcon size={10}/> WhatsApp</span>}
                    {esGrupo && <span style={{ fontSize:'.68rem', background:'rgba(10,191,188,.1)', color:'var(--jordyn-primary)', border:'1px solid rgba(10,191,188,.25)', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>🎟 {numeros.length} números</span>}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)' }}>
                    {r.rifa_nombre}
                    {r.telefono    && <span style={{ marginLeft:10 }}><i className="bi bi-telephone-fill me-1"></i>{r.telefono}</span>}
                    {r.metodo_pago && <span style={{ marginLeft:10 }}><i className="bi bi-credit-card me-1"></i>{r.metodo_pago}</span>}
                  </div>
                  {esGrupo && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:5 }}>
                      {numeros.map((n,i) => <span key={`${n}-${i}`} style={{ background:est.bg, color:est.color, border:`1px solid ${est.border}`, borderRadius:6, padding:'2px 8px', fontSize:'.72rem', fontWeight:800, letterSpacing:1 }}>{n}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'.92rem', color:'var(--jordyn-green)' }}>{COP(esGrupo?totalVal:r.precio)}</div>
                  {esGrupo && <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)' }}>{COP(r.precio)} c/u</div>}
                  <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:2 }}>{fmtTimestamp(r.created_at)}</div>
                </div>
                <span style={{ background:est.bg, color:est.color, border:`1.5px solid ${est.border}`, borderRadius:20, padding:'3px 12px', fontSize:'.7rem', fontWeight:700, flexShrink:0 }}>{est.label}</span>
                {r.estado==='aprobado' && r.telefono && (
                  <button onClick={e => { e.stopPropagation(); abrirWA(r.telefono, buildTicketMsg({ ...r, _numeros:numeros }, r.nota_admin, tasas)); }}
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