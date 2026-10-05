/**
 * ChatsWhatsApp.jsx — Panel de chats en tiempo real estilo WhatsApp Web
 *
 *  - Lista de chats con búsqueda (nombre, teléfono, mensajes) y filtros
 *  - Conversación con fotos, notas de voz, documentos y ✓✓ de lectura
 *  - Escribir como humano (toma el control y pausa el bot en ese chat)
 *  - Panel del cliente: compra en curso, reservas y comprobantes
 *  - Tiempo real por SSE (/api/wa-chat/stream) + sonido y contador en la pestaña
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../../services/api';
import './ChatsWhatsApp.css';

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────
const enc = encodeURIComponent;
const COLORES = ['#00a884', '#0abfbc', '#118ab2', '#6b5b95', '#e76f51', '#f4a261', '#2a9d8f', '#8e44ad', '#d35400', '#16a085'];
const colorDe = (s = '') => COLORES[[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORES.length];

function fmtTelefono(t) {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  if (d.startsWith('58') && d.length === 12) return `+58 ${d.slice(2, 5)}-${d.slice(5, 8)}-${d.slice(8)}`;
  return `+${d}`;
}
const nombreChat = (c) => c?.nombre_guardado || c?.nombre || fmtTelefono(c?.telefono) || (c?.jid || '').split('@')[0];
const iniciales = (c) => {
  const n = c?.nombre_guardado || c?.nombre;
  if (!n) return <i className="bi bi-person-fill" />;
  const palabras = n.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return <i className="bi bi-person-fill" />;
  return palabras.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
};

const aFecha = (v) => (v ? new Date(v) : null);
const mismoDia = (a, b) => a && b && a.toDateString() === b.toDateString();
const hora = (v) => aFecha(v)?.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' }) || '';
function horaLista(v) {
  const d = aFecha(v);
  if (!d) return '';
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, hoy)) return hora(v);
  if (mismoDia(d, ayer)) return 'Ayer';
  if (hoy - d < 6 * 86400000) return d.toLocaleDateString('es-VE', { weekday: 'long' });
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function haceCuanto(v) {
  const d = aFecha(v);
  if (!d) return '';
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}
function etiquetaDia(v) {
  const d = aFecha(v);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, hoy)) return 'Hoy';
  if (mismoDia(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined });
}

// Filtro local (el mismo criterio que el servidor) para eventos en vivo
function cumpleFiltro(c, filtro, q) {
  if (filtro === 'archivados' ? !c.archivado : c.archivado) return false;
  if (filtro === 'no_leidos' && !(c.no_leidos > 0)) return false;
  if (filtro === 'atencion' && !c.necesita_humano) return false;
  if (filtro === 'comprobante' && !['esperando_comprobante', 'esperando_confirmacion'].includes(c.estado_compra?.paso)) return false;
  if (filtro === 'bot' && !c.bot_activo) return false;
  if (filtro === 'humano' && c.bot_activo) return false;
  if (q) {
    const t = q.toLowerCase();
    const campos = [c.nombre_guardado, c.nombre, c.telefono, c.ultimo_mensaje].map((x) => String(x || '').toLowerCase());
    if (!campos.some((x) => x.includes(t))) return false;
  }
  return true;
}
const ordenar = (lista) => [...lista].sort((a, b) => new Date(b.ultimo_at || 0) - new Date(a.ultimo_at || 0));

// Sonido corto de notificación (sin archivos)
function sonar() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.32);
    setTimeout(() => ctx.close(), 500);
  } catch (_) { /* navegador sin audio */ }
}

// Texto con enlaces clicables y coincidencias de búsqueda resaltadas
function TextoRico({ texto, resaltar }) {
  if (!texto) return null;
  const partes = String(texto).split(/(https?:\/\/[^\s]+)/g);
  const marcar = (s, k) => {
    if (!resaltar) return <React.Fragment key={k}>{s}</React.Fragment>;
    const esc = resaltar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      <React.Fragment key={k}>
        {s.split(new RegExp(`(${esc})`, 'gi')).map((x, i) =>
          x.toLowerCase() === resaltar.toLowerCase() ? <mark key={i} className="wac-mark">{x}</mark> : x)}
      </React.Fragment>
    );
  };
  return partes.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: '#027eb5' }}>{p.length > 60 ? p.slice(0, 57) + '…' : p}</a>
    : marcar(p, i)));
}

function Avatar({ chat, chico }) {
  return (
    <div className={`wac-avatar${chico ? ' chico' : ''}`} style={{ background: colorDe(chat?.jid) }}>
      {iniciales(chat)}
      {chat?.bot_activo && <span className="wac-avatar-bot" title="Atiende el bot"><i className="bi bi-robot" /></span>}
    </div>
  );
}

function Ticks({ m }) {
  if (!m.de_mi) return null;
  if (m.estado === 'pendiente') return <i className="bi bi-clock" title="Enviando" />;
  if (m.estado === 'error') return <i className="bi bi-exclamation-circle-fill" title="No se pudo enviar" />;
  if (m.estado === 'leido') return <i className="bi bi-check2-all leido" title="Leído" />;
  if (m.estado === 'entregado') return <i className="bi bi-check2-all" title="Entregado" />;
  if (m.estado === 'enviado') return <i className="bi bi-check2" title="Enviado" />;
  return null;
}

const AUTORES = {
  bot:      { txt: 'Bot', icon: 'bi-robot' },
  humano:   { txt: 'Tú', icon: 'bi-person-fill' },
  telefono: { txt: 'Desde el teléfono', icon: 'bi-phone' },
  sistema:  { txt: 'Sistema', icon: 'bi-receipt' },
};

const EMOJIS = ['😊', '😂', '🙏', '👍', '👌', '🙌', '🎉', '🍀', '✅', '❌', '⏳', '💰', '💸', '🎟️', '🔥', '⭐', '❤️', '😉', '🤞', '😅', '🥳', '📲', '📸', '👋', '🤝', '💪', '😎', '🤗', '👀', '📍', '🕐', '🎯'];

const ETIQUETAS_PASO = {
  esperando_comprobante: 'Números apartados · esperando pago',
  esperando_confirmacion: 'Comprobante recibido · por aprobar',
  comprobante_sin_compra: 'Mandó una foto sin compra',
  apartado_vencido: 'Se le venció el apartado',
};

// ═════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════
export default function ChatsWhatsApp() {
  const navigate = useNavigate();

  // Lista
  const [chats, setChats] = useState([]);
  const [cargandoChats, setCargandoChats] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [resultados, setResultados] = useState([]);
  const [resumen, setResumen] = useState({ no_leidos: 0, atencion: 0, comprobante: 0, total: 0 });
  const [conexion, setConexion] = useState(null);
  const [enVivo, setEnVivo] = useState(false);

  // Conversación
  const [activo, setActivo] = useState(null);           // jid
  const [mensajes, setMensajes] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const [resaltadoId, setResaltadoId] = useState(null);
  const [nuevosAbajo, setNuevosAbajo] = useState(0);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [popover, setPopover] = useState(null);         // 'emojis' | 'rapidas'
  const [adjunto, setAdjunto] = useState(null);         // { file, url, caption }
  const [visor, setVisor] = useState(null);
  const [busquedaChat, setBusquedaChat] = useState(null); // { q, idx }

  // Panel de info
  const [mostrarInfo, setMostrarInfo] = useState(false);
  const [info, setInfo] = useState(null);                // { chat, reservas }
  const [editNombre, setEditNombre] = useState(null);
  const [metodosPago, setMetodosPago] = useState({});   // mismos datos de la pantalla del cliente

  // Cola de atención (clientes esperando a una persona)
  const [cola, setCola] = useState([]);
  const [colaAbierta, setColaAbierta] = useState(true);
  const [instruccion, setInstruccion] = useState({});   // jid → texto para el bot
  const [atendiendo, setAtendiendo] = useState(null);

  const msgsRef = useRef(null);
  const activoRef = useRef(null);
  const filtroRef = useRef({ filtro, q: qDebounced });
  const cercaDelFinal = useRef(true);
  const inputFileRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { activoRef.current = activo; }, [activo]);
  useEffect(() => { filtroRef.current = { filtro, q: qDebounced }; }, [filtro, qDebounced]);

  const chatActivo = useMemo(() => chats.find((c) => c.jid === activo) || info?.chat || null, [chats, activo, info]);

  // ── Carga de datos ─────────────────────────────────────────
  const cargarCola = useCallback(() => {
    API.get('/wa-chat/cola').then((r) => setCola(r.data)).catch(() => {});
  }, []);
  const cargarResumen = useCallback(() => {
    API.get('/wa-chat/resumen').then((r) => setResumen(r.data)).catch(() => {});
    cargarCola();
  }, [cargarCola]);

  // "Que lo atienda el bot" — con instrucción opcional de qué decirle al cliente
  const atenderConBot = async (jid, instruccion = '') => {
    setAtendiendo(jid);
    try {
      const r = await API.post(`/wa-chat/chats/${enc(jid)}/atender-bot`, { instruccion });
      const quien = nombreChat(chats.find((c) => c.jid === jid) || cola.find((c) => c.jid === jid));
      toast.success(r.data.enviados?.length
        ? `🤖 Le respondió a ${quien}: "${r.data.enviados.join(' ').slice(0, 90)}${r.data.enviados.join(' ').length > 90 ? '…' : ''}"`
        : `🤖 El bot vuelve a atender a ${quien}`);
      setInstruccion((p) => ({ ...p, [jid]: '' }));
      cargarResumen();
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo'); }
    finally { setAtendiendo(null); }
  };

  const cargarChats = useCallback(async () => {
    try {
      const r = await API.get('/wa-chat/chats', { params: { filtro, q: qDebounced } });
      setChats(r.data);
    } catch (e) { toast.error('No se pudieron cargar los chats'); }
    finally { setCargandoChats(false); }
  }, [filtro, qDebounced]);

  useEffect(() => { cargarChats(); }, [cargarChats]);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);
  useEffect(() => {
    API.get('/publico/metodos-pago').then((r) => setMetodosPago(r.data?.metodos || {})).catch(() => {});
  }, []);

  // Búsqueda con espera (y búsqueda dentro de las conversaciones)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (qDebounced.length < 2) { setResultados([]); return; }
    API.get('/wa-chat/buscar', { params: { q: qDebounced } }).then((r) => setResultados(r.data)).catch(() => setResultados([]));
  }, [qDebounced]);

  // Contador en el título de la pestaña
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = resumen.no_leidos > 0 ? `(${resumen.no_leidos}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\)\s*/, ''); };
  }, [resumen.no_leidos]);

  const marcarLeido = useCallback((jid) => {
    API.post(`/wa-chat/chats/${enc(jid)}/leer`).then(cargarResumen).catch(() => {});
  }, [cargarResumen]);

  const cargarInfo = useCallback(async (jid) => {
    try { const r = await API.get(`/wa-chat/chats/${enc(jid)}`); if (activoRef.current === jid) setInfo(r.data); }
    catch (_) {}
  }, []);

  // ── Scroll ─────────────────────────────────────────────────
  const irAlFinal = useCallback((suave = false) => {
    const el = msgsRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    setNuevosAbajo(0);
  }, []);

  const irAMensaje = useCallback((id) => {
    const el = msgsRef.current?.querySelector(`[data-id="${id}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); setResaltadoId(id); setTimeout(() => setResaltadoId(null), 1700); }
  }, []);

  // ── Abrir chat ─────────────────────────────────────────────
  const abrirChat = useCallback(async (jid, { alrededor } = {}) => {
    setActivo(jid);
    setInfo(null);
    setMensajes([]);
    setBusquedaChat(null);
    setPopover(null);
    setTexto('');
    setCargandoMsgs(true);
    cercaDelFinal.current = !alrededor;
    try {
      const r = await API.get(`/wa-chat/chats/${enc(jid)}/mensajes`, { params: alrededor ? { alrededor } : {} });
      if (activoRef.current !== jid) return;
      setMensajes(r.data.mensajes);
      setHayMas(r.data.hayMas);
      requestAnimationFrame(() => (alrededor ? irAMensaje(alrededor) : irAlFinal()));
    } catch (_) { toast.error('No se pudieron cargar los mensajes'); }
    finally { setCargandoMsgs(false); }
    marcarLeido(jid);
    setChats((prev) => prev.map((c) => (c.jid === jid ? { ...c, no_leidos: 0 } : c)));
    cargarInfo(jid);
  }, [irAlFinal, irAMensaje, marcarLeido, cargarInfo]);

  const cargarAnteriores = useCallback(async () => {
    if (!activo || !hayMas || cargandoMsgs || !mensajes.length) return;
    const el = msgsRef.current;
    const altoAntes = el.scrollHeight;
    setCargandoMsgs(true);
    try {
      const r = await API.get(`/wa-chat/chats/${enc(activo)}/mensajes`, { params: { antes: mensajes[0].id } });
      setMensajes((prev) => [...r.data.mensajes, ...prev]);
      setHayMas(r.data.hayMas);
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - altoAntes; });
    } finally { setCargandoMsgs(false); }
  }, [activo, hayMas, cargandoMsgs, mensajes]);

  const alHacerScroll = (e) => {
    const el = e.currentTarget;
    cercaDelFinal.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (cercaDelFinal.current && nuevosAbajo) setNuevosAbajo(0);
    if (el.scrollTop < 80) cargarAnteriores();
  };

  // ── Tiempo real (SSE) ──────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('jordyn_token');
    if (!token) return undefined;
    const es = new EventSource(`${API.defaults.baseURL}/wa-chat/stream?token=${enc(token)}`);
    let resumenTimer = null;
    const refrescarResumen = () => { clearTimeout(resumenTimer); resumenTimer = setTimeout(cargarResumen, 400); };

    const upsertChat = (chat) => setChats((prev) => {
      const { filtro: f, q: qq } = filtroRef.current;
      const sinEl = prev.filter((c) => c.jid !== chat.jid);
      const anterior = prev.find((c) => c.jid === chat.jid);
      const nuevo = { ...anterior, ...chat };
      if (chat.jid === activoRef.current) nuevo.no_leidos = 0;
      return cumpleFiltro(nuevo, f, qq) ? ordenar([nuevo, ...sinEl]) : sinEl;
    });

    es.onopen = () => setEnVivo(true);
    es.onerror = () => setEnVivo(false);
    es.addEventListener('conexion', (e) => setConexion(JSON.parse(e.data)));
    es.addEventListener('mensaje', (e) => {
      const { mensaje, chat } = JSON.parse(e.data);
      upsertChat(chat);
      refrescarResumen();
      if (mensaje.jid === activoRef.current) {
        setMensajes((prev) => (prev.some((m) => m.id === mensaje.id) ? prev : [...prev, mensaje]));
        if (cercaDelFinal.current || mensaje.de_mi) requestAnimationFrame(() => irAlFinal(true));
        else if (!mensaje.de_mi) setNuevosAbajo((n) => n + 1);
        if (!mensaje.de_mi && document.visibilityState === 'visible') marcarLeido(mensaje.jid);
      }
      if (!mensaje.de_mi && (mensaje.jid !== activoRef.current || document.visibilityState !== 'visible')) sonar();
    });
    es.addEventListener('estado', (e) => {
      const { id, estado } = JSON.parse(e.data);
      setMensajes((prev) => prev.map((m) => (m.id === id ? { ...m, estado } : m)));
    });
    es.addEventListener('chat', (e) => {
      const chat = JSON.parse(e.data);
      if (!chat?.jid) return;
      upsertChat(chat);
      refrescarResumen();
      if (chat.jid === activoRef.current) setInfo((prev) => (prev ? { ...prev, chat: { ...prev.chat, ...chat } } : prev));
    });
    es.addEventListener('reserva', (e) => {
      const d = JSON.parse(e.data);
      toast.info(`🧾 ${d.nombre} mandó su comprobante · ${d.rifa} · #${(d.numeros || []).join(', #')}`, { autoClose: 7000 });
      sonar();
      if (d.jid === activoRef.current) cargarInfo(d.jid);
    });
    return () => { clearTimeout(resumenTimer); es.close(); };
  }, [cargarResumen, irAlFinal, marcarLeido, cargarInfo]);

  // Al volver a la pestaña, marcar leído el chat abierto
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && activoRef.current) marcarLeido(activoRef.current); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [marcarLeido]);

  // ── Acciones del chat ──────────────────────────────────────
  const actualizarChat = async (cambios, msgOk) => {
    try {
      const r = await API.patch(`/wa-chat/chats/${enc(activo)}`, cambios);
      setChats((prev) => prev.map((c) => (c.jid === activo ? { ...c, ...r.data } : c)));
      setInfo((prev) => (prev ? { ...prev, chat: { ...prev.chat, ...r.data } } : prev));
      if (msgOk) toast.success(msgOk);
      return r.data;
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo actualizar'); return null; }
  };

  // "Este es el comprobante": registra la reserva con esa foto (último paso de la compra)
  const [marcandoComprobante, setMarcandoComprobante] = useState(null);
  const marcarComprobante = async (m) => {
    const ec = chatActivo?.estado_compra;
    const detalle = ec?.numeros?.length ? `\n\n${ec.rifa_nombre} · ${ec.numeros.length > 1 ? 'números' : 'número'} ${ec.numeros.join(', ')}` : '';
    if (!window.confirm(`¿Registrar esta foto como el comprobante de pago de ${nombreChat(chatActivo)}?${detalle}\n\nLa reserva queda pendiente en Reservas y se le avisa al cliente.`)) return;
    setMarcandoComprobante(m.id);
    try {
      const r = await API.post(`/wa-chat/chats/${enc(activo)}/mensajes/${m.id}/es-comprobante`);
      toast.success(`🧾 Reserva registrada: ${r.data.rifa} · #${r.data.numeros.join(', #')}${r.data.conflictos?.length ? ` (se ocuparon: ${r.data.conflictos.join(', ')})` : ''}`);
      cargarInfo(activo);
      cargarResumen();
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo registrar'); }
    finally { setMarcandoComprobante(null); }
  };

  const responderYo = async (jid) => {
    await abrirChat(jid);
    setTimeout(() => textareaRef.current?.focus(), 250);
  };

  const alternarBot = () => {
    const on = !chatActivo?.bot_activo;
    actualizarChat({ bot_activo: on }, on ? '🤖 El bot vuelve a atender este chat' : '👤 Tomaste el control: el bot no responderá en este chat');
  };

  const enviarTexto = async () => {
    const t = texto.trim();
    if (!t || !activo || enviando) return;
    setEnviando(true);
    try {
      // Si el bot estaba atendiendo, al escribir tú tomas el control
      if (chatActivo?.bot_activo) await actualizarChat({ bot_activo: false }, '👤 Tomaste el control de este chat');
      await API.post(`/wa-chat/chats/${enc(activo)}/mensajes`, { texto: t });
      setTexto('');
      setPopover(null);
      requestAnimationFrame(() => { if (textareaRef.current) textareaRef.current.style.height = 'auto'; });
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo enviar'); }
    finally { setEnviando(false); textareaRef.current?.focus(); }
  };

  const enviarAdjunto = async () => {
    if (!adjunto || !activo) return;
    setEnviando(true);
    try {
      if (chatActivo?.bot_activo) await actualizarChat({ bot_activo: false });
      const fd = new FormData();
      fd.append('imagen', adjunto.file);
      fd.append('caption', adjunto.caption || '');
      await API.post(`/wa-chat/chats/${enc(activo)}/imagen`, fd);
      URL.revokeObjectURL(adjunto.url);
      setAdjunto(null);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo enviar la imagen'); }
    finally { setEnviando(false); }
  };

  const alElegirArchivo = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.warning('Solo se pueden enviar imágenes'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.warning('La imagen debe pesar menos de 10 MB'); return; }
    setAdjunto({ file: f, url: URL.createObjectURL(f), caption: '' });
  };

  const autoAltura = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; };

  const RAPIDAS = useMemo(() => [
    ...Object.entries(metodosPago).filter(([, m]) => !m.presencial).map(([nombre, m]) => ({
      t: `Datos de ${nombre}`,
      v: [`${m.icono} *${nombre}*`, ...m.campos.map((c) => `${c.label}: ${c.valor}`), ...(m.nota ? [m.nota] : [])].join('\n'),
    })),
    { t: 'Pago verificado', v: '¡Listo! Tu pago fue verificado ✅ ya te envío tu ticket 🎟️' },
    { t: 'Pedir comprobante', v: 'Cuando hagas el pago me mandas la captura del comprobante por aquí 📸' },
    { t: 'Número ocupado', v: 'Ese número ya está ocupado 😕 ¿quieres que te busque otro parecido?' },
    { t: 'Saludo', v: '¡Hola! ¿En qué te puedo ayudar? 😊' },
    { t: 'Gracias', v: '¡Gracias por tu compra y mucha suerte! 🍀' },
  ], [metodosPago]);

  // ── Búsqueda dentro del chat ───────────────────────────────
  const coincidencias = useMemo(() => {
    const t = busquedaChat?.q?.trim().toLowerCase();
    if (!t || t.length < 2) return [];
    return mensajes.filter((m) => (m.texto || '').toLowerCase().includes(t)).map((m) => m.id);
  }, [busquedaChat?.q, mensajes]);
  useEffect(() => {
    if (!coincidencias.length || !busquedaChat) return;
    const idx = Math.min(busquedaChat.idx, coincidencias.length - 1);
    irAMensaje(coincidencias[coincidencias.length - 1 - idx]);
  }, [coincidencias, busquedaChat?.idx]);

  // ── Render de mensajes ─────────────────────────────────────
  const renderMensajes = () => {
    const out = [];
    let diaPrevio = null;
    mensajes.forEach((m, i) => {
      const d = aFecha(m.created_at);
      if (!mismoDia(d, diaPrevio)) {
        out.push(<div key={`d-${m.id}`} className="wac-dia"><span>{etiquetaDia(m.created_at)}</span></div>);
        diaPrevio = d;
      }
      // Nota interna del sistema (no se le envió al cliente)
      if (m.autor === 'sistema' && !m.wa_id) {
        out.push(<div key={m.id} data-id={m.id} className="wac-nota"><span>{m.texto}</span></div>);
        return;
      }
      const prev = mensajes[i - 1];
      const inicioGrupo = !prev || prev.de_mi !== m.de_mi || prev.autor !== m.autor
        || (d - aFecha(prev.created_at)) > 5 * 60000 || (prev.autor === 'sistema' && !prev.wa_id);
      const autor = m.de_mi ? AUTORES[m.autor] : null;
      const resaltarTxt = busquedaChat?.q?.trim().length >= 2 ? busquedaChat.q.trim() : null;
      out.push(
        <div key={m.id} data-id={m.id}
          className={`wac-fila${m.de_mi ? ' mia' : ''}${inicioGrupo ? ' inicio-grupo' : ''}${resaltadoId === m.id ? ' resaltada' : ''}`}>
          <div className={`wac-burbuja ${m.de_mi ? m.autor : ''}`}>
            {autor && inicioGrupo && m.autor !== 'humano' && (
              <div className={`wac-autor ${m.autor}`}><i className={`bi ${autor.icon}`} />{autor.txt}</div>
            )}
            {m.tipo === 'imagen' && (m.media_url
              ? <img className="wac-img" src={m.media_url} alt="Foto" loading="lazy" onClick={() => setVisor(m.media_url)} />
              : <div className="wac-texto" style={{ opacity: 0.7 }}><i className="bi bi-image me-1" />Foto</div>)}
            {m.tipo === 'imagen' && !m.de_mi && m.media_url && (
              (info?.reservas || []).some((r) => r.comprobante_url === m.media_url)
                ? <div className="wac-comprobante-ok"><i className="bi bi-receipt" />Registrado como comprobante</div>
                : (
                  <button className="wac-es-comprobante" disabled={marcandoComprobante === m.id} onClick={() => marcarComprobante(m)}
                    title="Registra la reserva con esta foto como comprobante de pago">
                    {marcandoComprobante === m.id ? 'Registrando…' : <><i className="bi bi-check2-circle" />Este es el comprobante</>}
                  </button>
                )
            )}
            {m.tipo === 'sticker' && m.media_url && <img className="wac-sticker" src={m.media_url} alt="Sticker" loading="lazy" />}
            {m.tipo === 'audio' && (m.media_url
              ? <audio className="wac-audio" controls preload="none" src={m.media_url} />
              : <div className="wac-texto" style={{ opacity: 0.7 }}><i className="bi bi-mic-fill me-1" />Nota de voz</div>)}
            {m.tipo === 'audio' && m.texto && (
              <div style={{ fontSize: '.62rem', fontWeight: 700, opacity: 0.6, marginTop: 4 }}><i className="bi bi-mic-fill me-1" />Transcripción automática</div>
            )}
            {m.tipo === 'documento' && (
              <a className="wac-doc" href={m.media_url || undefined} target="_blank" rel="noreferrer">
                <i className="bi bi-file-earmark-pdf-fill" />
                <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{m.texto || 'Documento'}</span>
              </a>
            )}
            {m.tipo === 'video' && <div className="wac-texto" style={{ opacity: 0.7 }}><i className="bi bi-camera-video-fill me-1" />Video</div>}
            {m.texto && m.tipo !== 'documento' && (
              <span className="wac-texto"><TextoRico texto={m.texto} resaltar={resaltarTxt} /></span>
            )}
            <span className="wac-meta">{hora(m.created_at)} <Ticks m={m} /></span>
          </div>
        </div>,
      );
    });
    return out;
  };

  const contadorFiltro = { no_leidos: resumen.no_leidos, atencion: resumen.atencion, comprobante: resumen.comprobante };
  const FILTROS = [
    ['todos', 'Todos'], ['no_leidos', 'No leídos'], ['atencion', 'Atención'], ['comprobante', 'Comprobantes'],
    ['bot', 'Bot'], ['humano', 'Humano'], ['archivados', 'Archivados'],
  ];
  const conectado = conexion?.status === 'open';
  const ec = info?.chat?.estado_compra || chatActivo?.estado_compra;

  // ═══════════════════════════════════════════
  return (
    <div className={`wac${activo ? ' con-chat' : ''}`}>

      {/* ── LATERAL: lista de chats ───────────────────── */}
      <aside className="wac-lateral">
        <div className="wac-lateral-cab">
          <div className="wac-titulo"><i className="bi bi-whatsapp" style={{ color: '#25d366' }} /> Chats</div>
          <span className={`wac-conexion ${conectado ? 'on' : 'off'}`} title={enVivo ? 'Recibiendo en tiempo real' : 'Reconectando al servidor…'}>
            <span className="punto" />{conectado ? 'En línea' : conexion ? 'Desconectado' : '…'}
          </span>
        </div>

        <div className="wac-buscador">
          <i className="bi bi-search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar chat, teléfono o mensaje" />
          {q && <button className="limpiar" onClick={() => setQ('')}><i className="bi bi-x-lg" /></button>}
        </div>

        <div className="wac-filtros">
          {FILTROS.map(([k, t]) => (
            <button key={k} className={`wac-chip${filtro === k ? ' activo' : ''}${k === 'atencion' ? ' alerta' : ''}`} onClick={() => setFiltro(k)}>
              {t}{contadorFiltro[k] > 0 && <span className="n">{contadorFiltro[k]}</span>}
            </button>
          ))}
        </div>

        <div className="wac-lista">
          {/* ── Cola de atención ── */}
          {filtro === 'todos' && !qDebounced && cola.length > 0 && (
            <div className="wac-cola">
              <button className="wac-cola-cab" onClick={() => setColaAbierta((v) => !v)}>
                <i className="bi bi-bell-fill" />
                <span>Esperando por ti</span>
                <span className="wac-badge" style={{ background: '#e63946' }}>{cola.length}</span>
                <i className={`bi bi-chevron-${colaAbierta ? 'up' : 'down'} ms-auto`} />
              </button>
              {colaAbierta && cola.map((c) => (
                <div key={c.jid} className="wac-cola-item">
                  <div className="wac-cola-fila" onClick={() => abrirChat(c.jid)}>
                    <Avatar chat={c} chico />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="wac-item-fila">
                        <span className="wac-item-nombre">{nombreChat(c)}</span>
                        <span className="wac-cola-tiempo">{haceCuanto(c.esperando_desde || c.ultimo_at)}</span>
                      </div>
                      <div className="wac-cola-motivo">
                        {c.necesita_humano ? (c.motivo_humano || 'Necesita a una persona') : 'Le escribió a una persona y no tiene respuesta'}
                      </div>
                      {c.ultimo_del_cliente && <div className="wac-cola-ultimo">“{c.ultimo_del_cliente}”</div>}
                    </div>
                  </div>
                  <div className="wac-cola-acciones">
                    <button className="principal" onClick={() => responderYo(c.jid)}><i className="bi bi-pencil-fill" />Responder</button>
                    <button onClick={() => atenderConBot(c.jid)} disabled={atendiendo === c.jid}>
                      {atendiendo === c.jid ? <span className="jd-spinner" style={{ width: 12, height: 12, borderWidth: 2, display: 'inline-block' }} /> : <i className="bi bi-robot" />}Que lo atienda el bot
                    </button>
                  </div>
                  <div className="wac-cola-instruccion">
                    <input value={instruccion[c.jid] || ''} placeholder="O dile al bot qué responderle…"
                      onChange={(e) => setInstruccion((p) => ({ ...p, [c.jid]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && instruccion[c.jid]?.trim()) atenderConBot(c.jid, instruccion[c.jid]); }} />
                    <button disabled={!instruccion[c.jid]?.trim() || atendiendo === c.jid} onClick={() => atenderConBot(c.jid, instruccion[c.jid])} title="El bot se lo dice al cliente con sus palabras">
                      <i className="bi bi-send-fill" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {qDebounced && <div className="wac-seccion">Chats</div>}
          {cargandoChats ? (
            <div className="wac-vacio"><span className="jd-spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></div>
          ) : chats.length === 0 ? (
            <div className="wac-vacio">
              <i className="bi bi-chat-square-dots" />
              {qDebounced ? 'Ningún chat coincide' : filtro === 'todos' ? 'Aún no hay conversaciones. Cuando un cliente escriba aparecerá aquí al instante.' : 'Nada por aquí'}
            </div>
          ) : chats.map((c) => {
            const paso = c.estado_compra?.paso;
            return (
              <div key={c.jid} className={`wac-item${c.jid === activo ? ' activo' : ''}${c.no_leidos > 0 ? ' no-leido' : ''}`} onClick={() => abrirChat(c.jid)}>
                <Avatar chat={c} />
                <div className="wac-item-cuerpo">
                  <div className="wac-item-fila">
                    <span className="wac-item-nombre">{nombreChat(c)}</span>
                    <span className="wac-item-hora">{horaLista(c.ultimo_at)}</span>
                  </div>
                  <div className="wac-item-fila" style={{ marginTop: 2 }}>
                    <span className="wac-item-previa">
                      {c.ultimo_de_mi && <i className="bi bi-check2" style={{ color: '#667781' }} />}
                      {c.ultimo_mensaje}
                    </span>
                    {c.no_leidos > 0 && <span className="wac-badge">{c.no_leidos}</span>}
                  </div>
                  {(c.necesita_humano || !c.bot_activo || paso || c.reservas_pendientes > 0) && (
                    <div className="wac-etiquetas">
                      {c.necesita_humano && <span className="wac-etq atencion"><i className="bi bi-exclamation-triangle-fill" />Atención</span>}
                      {!c.bot_activo && <span className="wac-etq humano"><i className="bi bi-person-fill" />Humano</span>}
                      {(paso === 'esperando_comprobante') && <span className="wac-etq comprobante"><i className="bi bi-hourglass-split" />Esperando pago</span>}
                      {c.reservas_pendientes > 0 && <span className="wac-etq comprobante"><i className="bi bi-receipt" />{c.reservas_pendientes} por aprobar</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {resultados.length > 0 && (
            <>
              <div className="wac-seccion">Mensajes</div>
              {resultados.map((r) => (
                <div key={r.id} className="wac-resultado" onClick={() => abrirChat(r.jid, { alrededor: r.id })}>
                  <div className="quien">{r.chat_nombre}<span>{horaLista(r.created_at)}</span></div>
                  <div className="txt">{r.de_mi && <i className="bi bi-check2 me-1" />}<TextoRico texto={r.texto} resaltar={qDebounced} /></div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ── CONVERSACIÓN ──────────────────────────────── */}
      <section className="wac-conversacion">
        {!activo ? (
          <div className="wac-bienvenida">
            <div className="icono"><i className="bi bi-whatsapp" /></div>
            <h3>Chats de WhatsApp</h3>
            <p>
              Aquí ves en tiempo real lo que escriben tus clientes y lo que responde el bot.
              Puedes escribirles tú cuando quieras: al hacerlo tomas el control y el bot se pausa en ese chat.
            </p>
            <div className="wac-stats">
              <div className="wac-stat"><b>{resumen.total}</b><span>Chats</span></div>
              <div className="wac-stat"><b>{resumen.no_leidos}</b><span>Sin leer</span></div>
              <div className="wac-stat"><b style={{ color: resumen.atencion ? '#e63946' : undefined }}>{resumen.atencion}</b><span>Necesitan atención</span></div>
              <div className="wac-stat"><b style={{ color: resumen.comprobante ? '#a36d00' : undefined }}>{resumen.comprobante}</b><span>En compra</span></div>
            </div>
          </div>
        ) : (
          <>
            <header className="wac-conv-cab">
              <button className="wac-icono-btn wac-volver" onClick={() => { setActivo(null); setMostrarInfo(false); }} title="Volver"><i className="bi bi-arrow-left" /></button>
              <Avatar chat={chatActivo} chico />
              <div className="wac-conv-info" onClick={() => setMostrarInfo((v) => !v)}>
                <div className="wac-conv-nombre">{nombreChat(chatActivo)}</div>
                <div className={`wac-conv-sub${chatActivo?.necesita_humano ? ' alerta' : ''}`}>
                  {chatActivo?.necesita_humano
                    ? `⚠️ ${chatActivo.motivo_humano || 'Necesita atención'}`
                    : [fmtTelefono(chatActivo?.telefono), chatActivo?.bot_activo ? '🤖 Atiende el bot' : '👤 Atiendes tú', ec?.paso && ETIQUETAS_PASO[ec.paso]].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className={`wac-switch${chatActivo?.bot_activo ? ' on' : ''}`} onClick={alternarBot} title="Activar o pausar el bot en este chat">
                <span className="riel" /><span className="txt">Bot</span>
              </button>
              <button className={`wac-icono-btn${busquedaChat ? ' activo' : ''}`} title="Buscar en el chat"
                onClick={() => setBusquedaChat((b) => (b ? null : { q: '', idx: 0 }))}><i className="bi bi-search" /></button>
              <button className={`wac-icono-btn${mostrarInfo ? ' activo' : ''}`} title="Info del cliente" onClick={() => setMostrarInfo((v) => !v)}>
                <i className="bi bi-layout-sidebar-reverse" />
              </button>
            </header>

            {busquedaChat && (
              <div className="wac-buscar-en-chat">
                <input autoFocus placeholder="Buscar en esta conversación…" value={busquedaChat.q}
                  onChange={(e) => setBusquedaChat({ q: e.target.value, idx: 0 })}
                  onKeyDown={(e) => { if (e.key === 'Enter') setBusquedaChat((b) => ({ ...b, idx: (b.idx + 1) % Math.max(1, coincidencias.length) })); if (e.key === 'Escape') setBusquedaChat(null); }} />
                <span className="cuenta">{coincidencias.length ? `${Math.min(busquedaChat.idx + 1, coincidencias.length)}/${coincidencias.length}` : '0/0'}</span>
                <button className="wac-icono-btn" title="Anterior" onClick={() => setBusquedaChat((b) => ({ ...b, idx: (b.idx + 1) % Math.max(1, coincidencias.length) }))}><i className="bi bi-chevron-up" /></button>
                <button className="wac-icono-btn" title="Siguiente" onClick={() => setBusquedaChat((b) => ({ ...b, idx: (b.idx - 1 + coincidencias.length) % Math.max(1, coincidencias.length) }))}><i className="bi bi-chevron-down" /></button>
                <button className="wac-icono-btn" onClick={() => setBusquedaChat(null)}><i className="bi bi-x-lg" /></button>
              </div>
            )}

            {(chatActivo?.necesita_humano || !chatActivo?.bot_activo) && (
              <div className={`wac-banner ${chatActivo?.necesita_humano ? 'atencion' : 'bot'}`} style={{ flexWrap: 'wrap' }}>
                <i className={`bi ${chatActivo?.necesita_humano ? 'bi-exclamation-triangle-fill' : 'bi-person-fill'}`} />
                <span style={{ flex: 1, minWidth: 180 }}>
                  {chatActivo?.necesita_humano
                    ? <>Necesita a una persona: <b>{chatActivo.motivo_humano || 'sin detalle'}</b></>
                    : 'Estás atendiendo tú. El bot no responde en este chat.'}
                </span>
                <button onClick={() => atenderConBot(activo)} disabled={atendiendo === activo}>
                  {atendiendo === activo ? '…' : '🤖 Que lo atienda el bot'}
                </button>
                {chatActivo?.necesita_humano && (
                  <button style={{ background: 'transparent', color: 'inherit', border: '1px solid currentColor' }} onClick={() => actualizarChat({ necesita_humano: false }, 'Marcado como atendido')}>Marcar atendido</button>
                )}
                <div className="wac-cola-instruccion" style={{ flexBasis: '100%', padding: 0, marginTop: 6 }}>
                  <input value={instruccion[activo] || ''} placeholder="Dile al bot qué responderle y él se lo escribe con sus palabras…"
                    onChange={(e) => setInstruccion((p) => ({ ...p, [activo]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && instruccion[activo]?.trim()) atenderConBot(activo, instruccion[activo]); }} />
                  <button disabled={!instruccion[activo]?.trim() || atendiendo === activo} onClick={() => atenderConBot(activo, instruccion[activo])}><i className="bi bi-send-fill" /></button>
                </div>
              </div>
            )}

            <div className="wac-mensajes" ref={msgsRef} onScroll={alHacerScroll}>
              {hayMas && (
                <div className="wac-cargar-mas">
                  <button onClick={cargarAnteriores} disabled={cargandoMsgs}>{cargandoMsgs ? 'Cargando…' : 'Ver mensajes anteriores'}</button>
                </div>
              )}
              {cargandoMsgs && !mensajes.length && <div className="wac-vacio"><span className="jd-spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></div>}
              {renderMensajes()}
            </div>

            {nuevosAbajo > 0 && (
              <button className="wac-ir-abajo" onClick={() => irAlFinal(true)} title="Ir a los nuevos">
                <i className="bi bi-chevron-double-down" /><span className="wac-badge n">{nuevosAbajo}</span>
              </button>
            )}

            <footer className="wac-composer">
              {popover === 'emojis' && (
                <div className="wac-popover emojis">
                  {EMOJIS.map((e) => <button key={e} onClick={() => { setTexto((t) => t + e); textareaRef.current?.focus(); }}>{e}</button>)}
                </div>
              )}
              {popover === 'rapidas' && (
                <div className="wac-popover">
                  {RAPIDAS.map((r) => (
                    <button key={r.t} className="wac-rapida" onClick={() => { setTexto(r.v); setPopover(null); requestAnimationFrame(() => { textareaRef.current?.focus(); autoAltura(textareaRef.current); }); }}>
                      <b>{r.t}</b><span>{r.v}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className={`wac-icono-btn${popover === 'emojis' ? ' activo' : ''}`} title="Emojis" onClick={() => setPopover((p) => (p === 'emojis' ? null : 'emojis'))}><i className="bi bi-emoji-smile" /></button>
              <button className={`wac-icono-btn${popover === 'rapidas' ? ' activo' : ''}`} title="Respuestas rápidas" onClick={() => setPopover((p) => (p === 'rapidas' ? null : 'rapidas'))}><i className="bi bi-lightning-charge" /></button>
              <button className="wac-icono-btn" title="Enviar foto" onClick={() => inputFileRef.current?.click()}><i className="bi bi-paperclip" /></button>
              <input ref={inputFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={alElegirArchivo} />
              <textarea
                ref={textareaRef} rows={1} value={texto}
                placeholder={conectado ? 'Escribe un mensaje' : 'WhatsApp desconectado — vincúlalo en la pestaña Conexión'}
                onChange={(e) => { setTexto(e.target.value); autoAltura(e.target); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }}
                onFocus={() => setPopover(null)}
              />
              <button className="wac-enviar" onClick={enviarTexto} disabled={!texto.trim() || enviando} title="Enviar (Enter)">
                {enviando ? <span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2, display: 'inline-block' }} /> : <i className="bi bi-send-fill" />}
              </button>
            </footer>

            {adjunto && (
              <div className="wac-adjunto">
                <div className="wac-conv-cab">
                  <button className="wac-icono-btn" onClick={() => { URL.revokeObjectURL(adjunto.url); setAdjunto(null); }}><i className="bi bi-x-lg" /></button>
                  <div className="wac-conv-nombre">Enviar foto a {nombreChat(chatActivo)}</div>
                </div>
                <div className="previa"><img src={adjunto.url} alt="Vista previa" /></div>
                <div className="pie">
                  <input autoFocus placeholder="Añade un comentario…" value={adjunto.caption}
                    onChange={(e) => setAdjunto((a) => ({ ...a, caption: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && enviarAdjunto()} />
                  <button className="wac-enviar" onClick={enviarAdjunto} disabled={enviando}>
                    {enviando ? <span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2, display: 'inline-block' }} /> : <i className="bi bi-send-fill" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── INFO DEL CLIENTE ──────────────────────────── */}
      {activo && mostrarInfo && (
        <aside className="wac-info">
          <div className="wac-info-cab">
            <button className="wac-icono-btn" onClick={() => setMostrarInfo(false)}><i className="bi bi-x-lg" /></button>
            Info del cliente
          </div>
          <div className="wac-info-cuerpo">
            <div className="wac-info-perfil wac-info-bloque">
              <Avatar chat={chatActivo} />
              {editNombre !== null ? (
                <div className="wac-input-inline" style={{ marginTop: 6 }}>
                  <input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="Nombre para este contacto"
                    onKeyDown={async (e) => { if (e.key === 'Enter') { await actualizarChat({ nombre_guardado: editNombre.trim() || null }, 'Nombre guardado'); setEditNombre(null); } }} />
                  <button className="wac-icono-btn" onClick={async () => { await actualizarChat({ nombre_guardado: editNombre.trim() || null }, 'Nombre guardado'); setEditNombre(null); }}><i className="bi bi-check-lg" /></button>
                </div>
              ) : (
                <div className="nombre">
                  {nombreChat(chatActivo)}{' '}
                  <button className="wac-icono-btn" style={{ width: 28, height: 28, fontSize: '.8rem' }} title="Editar nombre"
                    onClick={() => setEditNombre(chatActivo?.nombre_guardado || chatActivo?.nombre || '')}><i className="bi bi-pencil" /></button>
                </div>
              )}
              <div className="tel">{fmtTelefono(chatActivo?.telefono) || 'Número oculto por WhatsApp'}</div>
              {chatActivo?.nombre && chatActivo?.nombre_guardado && <div className="tel" style={{ fontSize: '.74rem' }}>En WhatsApp: {chatActivo.nombre}</div>}
            </div>

            <div className="wac-info-bloque">
              <h5>Atención</h5>
              <button className="wac-accion" onClick={alternarBot}>
                <i className={`bi ${chatActivo?.bot_activo ? 'bi-person-fill' : 'bi-robot'}`} />
                {chatActivo?.bot_activo ? 'Tomar el control (pausar bot)' : 'Devolver al bot'}
              </button>
              {chatActivo?.necesita_humano && (
                <button className="wac-accion" onClick={() => actualizarChat({ necesita_humano: false }, 'Marcado como atendido')}>
                  <i className="bi bi-check2-circle" />Marcar como atendido
                </button>
              )}
              <button className="wac-accion" onClick={() => actualizarChat({ archivado: !chatActivo?.archivado }, chatActivo?.archivado ? 'Chat desarchivado' : 'Chat archivado')}>
                <i className="bi bi-archive" />{chatActivo?.archivado ? 'Desarchivar chat' : 'Archivar chat'}
              </button>
            </div>

            {ec?.paso && (
              <div className="wac-info-bloque">
                <h5>Compra en curso</h5>
                <div className="wac-dato"><span>Estado</span><span>{ETIQUETAS_PASO[ec.paso] || ec.paso}</span></div>
                {ec.rifa_nombre && <div className="wac-dato"><span>Rifa</span><span>{ec.rifa_nombre}</span></div>}
                {ec.numeros && <div className="wac-dato"><span>Números</span><span>{ec.numeros.join(', ')}</span></div>}
                {ec.nombre && <div className="wac-dato"><span>A nombre de</span><span>{ec.nombre}</span></div>}
                {ec.cedula && <div className="wac-dato"><span>Cédula</span><span>{ec.cedula}</span></div>}
                {ec.total != null && <div className="wac-dato"><span>Total</span><span>{Number(ec.total).toLocaleString('es-CO')} pesos</span></div>}
                {ec.metodo && <div className="wac-dato"><span>Paga por</span><span>{ec.metodo}{ec.monto?.texto ? ` · ${ec.monto.texto}` : ''}</span></div>}
                {ec.paso === 'esperando_comprobante' && ec.apartado_hasta && <div className="wac-dato"><span>Apartado hasta</span><span>{new Date(ec.apartado_hasta).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}</span></div>}
                {ec.comprobante?.url && <img src={ec.comprobante.url} alt="Foto" style={{ width: '100%', borderRadius: 8, marginTop: 8, cursor: 'zoom-in' }} onClick={() => setVisor(ec.comprobante.url)} />}
                <button className="wac-accion peligro" style={{ marginTop: 6 }}
                  onClick={() => { if (window.confirm('¿Reiniciar la compra en curso de este cliente?')) actualizarChat({ estado_compra: null }, 'Compra reiniciada'); }}>
                  <i className="bi bi-arrow-counterclockwise" />Reiniciar compra
                </button>
              </div>
            )}

            <div className="wac-info-bloque">
              <h5>Compras y reservas</h5>
              {!info ? (
                <div style={{ textAlign: 'center', padding: 10 }}><span className="jd-spinner" style={{ width: 22, height: 22, display: 'inline-block' }} /></div>
              ) : info.reservas.length === 0 ? (
                <div style={{ fontSize: '.8rem', color: 'var(--jordyn-muted)' }}>Todavía no tiene compras.</div>
              ) : info.reservas.map((r) => (
                <div key={r.id} className="wac-reserva">
                  {r.comprobante_url
                    ? <img src={r.comprobante_url} alt="Comprobante" onClick={() => setVisor(r.comprobante_url)} />
                    : <i className="bi bi-ticket-perforated" style={{ fontSize: '1.5rem', color: 'var(--jordyn-primary)' }} />}
                  <div style={{ minWidth: 0 }}>
                    <div className="num">#{r.numero}</div>
                    <div className="rifa">{r.rifa_nombre}{r.origen === 'whatsapp' ? ' · WhatsApp' : ' · Web'}</div>
                    {r.comprobante_datos?.referencia && <div className="rifa">Ref. {r.comprobante_datos.referencia}{r.comprobante_datos.monto ? ` · ${r.comprobante_datos.monto} ${r.comprobante_datos.moneda || ''}` : ''}</div>}
                  </div>
                  <span className={`wac-estado ${r.estado}`}>{r.estado}</span>
                </div>
              ))}
              {info?.reservas.some((r) => r.estado === 'pendiente') && (
                <button className="btn-jordyn" style={{ width: '100%', marginTop: 6 }} onClick={() => navigate('/reservas')}>
                  <i className="bi bi-check2-square me-1" />Aprobar en Reservas
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {visor && (
        <div className="wac-visor" onClick={() => setVisor(null)}>
          <div className="wac-visor-cab" onClick={(e) => e.stopPropagation()}>
            <a href={visor} target="_blank" rel="noreferrer" title="Abrir original"><i className="bi bi-box-arrow-up-right" /></a>
            <button onClick={() => setVisor(null)} title="Cerrar"><i className="bi bi-x-lg" /></button>
          </div>
          <div className="wac-visor-img"><img src={visor} alt="Imagen" onClick={(e) => e.stopPropagation()} /></div>
        </div>
      )}
    </div>
  );
}
