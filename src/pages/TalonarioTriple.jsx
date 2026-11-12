// ════════════════════════════════════════════════════════════════
//   pages/TalonarioTriple.jsx — Talonario de tickets de 3 números
//
//   Cada ticket lleva 3 números al azar del 000 al 999 y NINGÚN número
//   se repite en la serie (hasta 333 tickets; sobra 1 número).
//   Independiente del resto del sistema: no toca rifas, vendedores,
//   números ni caja. Se guarda en /api/talonarios para reimprimirlo igual.
//
//   - Editor del ticket con vista previa en vivo y temas de color
//   - "Mezcla pareja": los 3 números de cada ticket de centenas distintas
//   - Mapa de los 1000 números + buscador "¿quién tiene el 702?"
//   - Imprimir (6 por hoja carta), hoja de control y CSV
//   - Diseño con "Mi imagen": se sube el ticket ya diseñado y encima solo van
//     los 3 números (y, si se quiere, el vendedor y el N.º), en cajas que se
//     arrastran y se agrandan con el dedo
//   - Vendedores por rango ("del 1 al 30 → María"): sale en el ticket, en la
//     hoja de control y se puede imprimir solo el lote de un vendedor
// ════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const MAX = 333;
const p3 = (n) => String(n).padStart(3, '0');
const pN = (n, total) => String(n).padStart(String(total).length < 3 ? 3 : String(total).length, '0');

const TEMAS = {
  clasico:   { nombre: 'Clásico',   borde: '#3a8fd6', rojo: '#d9534f', azul: '#2b5aa8', verde: '#3aa655', vino: '#8c3a5e', coral: '#e8604c', caja: '#f3ead2', fondo: '#ffffff', texto: '#444' },
  esmeralda: { nombre: 'Esmeralda', borde: '#0f9d77', rojo: '#c0392b', azul: '#0b6e59', verde: '#15a36a', vino: '#0b5345', coral: '#e67e22', caja: '#e3f6ee', fondo: '#ffffff', texto: '#2f3b38' },
  noche:     { nombre: 'Noche',     borde: '#1b2a3a', rojo: '#e74c3c', azul: '#1f3b63', verde: '#16a085', vino: '#1b2a3a', coral: '#d35400', caja: '#e8eef5', fondo: '#ffffff', texto: '#2c3e50' },
  dorado:    { nombre: 'Dorado',    borde: '#c9a227', rojo: '#b03a2e', azul: '#7a5c00', verde: '#9a7d0a', vino: '#6e2c00', coral: '#c0392b', caja: '#fbf3d5', fondo: '#fffdf6', texto: '#4a3b12' },
};

const DISENO_INICIAL = {
  loteria: 'Lotería Triple Táchira "A" 10:10 PM',
  fecha: '',
  etiquetaPremio: 'Premio',
  oportunidades: '3 Oportunidades de Poder Ganar',
  monto: '300',
  unidad: 'Dólares',
  titulo: 'GRAN RIFA',
  responsables: 'Resuelve tu Semana',
  telefonos: '0412 - 928 72 10',
  valorEtiqueta: 'Valor Boleto',
  valor: '10 Mil Pesos',
  lateralIzq: 'Boleto sin cancelar no juega',
  lateralDer: 'Caduca a los 8 días',
  tema: 'clasico',
  modo: 'sistema',     // 'sistema' (el diseño de aquí) | 'imagen' (el ticket de Jordyn con los números encima)
  imagen: '',
  ratio: 1.2,          // ancho ÷ alto de la imagen
  cajas: null,
  colorNumeros: '#222222',
  fondoNumeros: '',    // '' | '#ffffff' | '#f3ead2' — un fondo detrás de los números para que se lean
  numerosEnFila: false,
  verVendedor: true,
  verNumero: true,
};

// Cajas en % de la imagen: { x, y, w, h }
const CAJAS_INICIALES = {
  numeros:  { x: 72, y: 5, w: 24, h: 34 },
  vendedor: { x: 4, y: 88, w: 52, h: 7 },
  numero:   { x: 64, y: 90, w: 32, h: 6 },
};
const cajasDe = (d) => ({ ...CAJAS_INICIALES, ...(d.cajas || {}) });

const fechaLarga = (f) => {
  if (!f) return '';
  const d = new Date(`${f}T12:00:00Z`);
  const mes = d.toLocaleDateString('es-VE', { month: 'long', timeZone: 'UTC' });
  return `Sorteo: ${d.getUTCDate()} - ${mes.charAt(0).toUpperCase()}${mes.slice(1)} - ${d.getUTCFullYear()}`;
};

// ── Azar seguro y combinaciones ─────────────────────────────────
function azar(n) {
  const a = new Uint32Array(1);
  window.crypto.getRandomValues(a);
  return a[0] % n;
}
function barajar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = azar(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const centenasDistintas = (t) => new Set(t.map((n) => Math.floor(n / 100))).size === t.length;

// cantidad tickets × 3 números sin repetir. parejo: cada ticket con números de centenas distintas.
function generar(cantidad, parejo) {
  if (!parejo) {
    const todos = barajar([...Array(1000).keys()]);
    const tickets = [];
    for (let i = 0; i < cantidad; i++) tickets.push(todos.slice(i * 3, i * 3 + 3));
    return { tickets: tickets.map((t) => [...t].sort((x, y) => x - y)), sobran: todos.slice(cantidad * 3).sort((x, y) => x - y) };
  }
  // Pareja: 10 montones (000-099, 100-199…) barajados; cada ticket toma un número de 3 montones
  // distintos, de los que más números les quedan (con algo de azar para que no se vea un patrón).
  // Tomar siempre de los más llenos garantiza que alcance hasta el último ticket.
  for (;;) {
    const montones = Array.from({ length: 10 }, (_, c) => barajar(Array.from({ length: 100 }, (_, k) => c * 100 + k)));
    const tickets = [];
    let ok = true;
    for (let i = 0; i < cantidad; i++) {
      const quedan = montones.map((m) => m.length);
      const holgura = Math.min(...quedan) > 12 ? 6 : 0;   // al final, sin azar: estrictamente los más llenos
      const orden = [...Array(10).keys()].map((c) => [c, quedan[c] + (holgura ? azar(holgura) : Math.random() * 0.5)]).sort((a, b) => b[1] - a[1]);
      const elegidos = orden.slice(0, 3).map(([c]) => c);
      if (elegidos.some((c) => !montones[c].length)) { ok = false; break; }
      tickets.push(elegidos.map((c) => montones[c].pop()).sort((x, y) => x - y));
    }
    if (ok) return { tickets: barajar(tickets), sobran: montones.flat().sort((x, y) => x - y) };
  }
}

// ── El ticket (todo en "em": el mismo dibujo sirve en pantalla y en papel) ──
export function TicketTriple({ d, nums, numero, total, serie, ancho, fuente, vendedor }) {
  const c = TEMAS[d.tema] || TEMAS.clasico;
  const lateral = { writingMode: 'vertical-rl', fontSize: '.62em', color: '#7a7a7a', textAlign: 'center', fontWeight: 600, letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden' };
  return (
    <div style={{ width: ancho, fontSize: fuente, fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box', background: c.fondo,
      border: `.16em solid ${c.borde}`, borderRadius: '.55em', padding: '.4em .35em', display: 'grid', gridTemplateColumns: '1.05em 1fr 1.05em', gap: '.25em',
      breakInside: 'avoid', pageBreakInside: 'avoid', color: c.texto, lineHeight: 1.1 }}>
      <div style={{ ...lateral, transform: 'rotate(180deg)' }}>{d.lateralIzq}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 5.4em', columnGap: '.35em', minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: c.rojo, fontWeight: 700, fontSize: '.92em' }}>{d.loteria}</div>
          <div style={{ color: c.azul, fontWeight: 700, fontSize: '1.02em', marginTop: '.1em' }}>{fechaLarga(d.fecha)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.35em', marginTop: '.2em' }}>
            <span style={{ color: c.verde, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 900, fontSize: '2.05em', lineHeight: 1 }}>{d.etiquetaPremio}</span>
            <span style={{ fontSize: '.78em', fontWeight: 600, lineHeight: 1.05 }}>{d.oportunidades}</span>
          </div>
        </div>
        <div style={{ background: c.caja, borderRadius: '.3em', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '.25em 0' }}>
          {nums.map((n) => <div key={n} style={{ fontSize: '1.95em', lineHeight: 1.08, color: '#333', letterSpacing: '.03em' }}>{p3(n)}</div>)}
        </div>
        <div style={{ gridColumn: '1 / 3', color: c.vino, fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900, fontSize: '6em', lineHeight: .92, letterSpacing: '-.02em', marginTop: '.03em', overflow: 'hidden', whiteSpace: 'nowrap' }}>{d.monto}</div>
        <div style={{ gridColumn: '1 / 3', color: c.coral, fontWeight: 900, fontStyle: 'italic', fontSize: '2.8em', lineHeight: 1 }}>{d.unidad}</div>
        <div style={{ gridColumn: '1 / 3', color: c.azul, fontWeight: 900, fontStyle: 'italic', fontSize: '1.75em', textTransform: 'uppercase', letterSpacing: '.02em', marginTop: '.05em', whiteSpace: 'nowrap', overflow: 'hidden' }}>{d.titulo}</div>
        <div style={{ gridColumn: '1 / 3', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '.4em', marginTop: '.2em' }}>
          <div style={{ fontSize: '.74em', fontWeight: 700, color: '#666', lineHeight: 1.15, minWidth: 0 }}>
            <div>Resp: {d.responsables}</div>
            {String(d.telefonos || '').split('/').map((t) => t.trim()).filter(Boolean).map((t) => <div key={t}>Telf. {t}</div>)}
            {vendedor && <div style={{ color: c.azul, marginTop: '.1em' }}>Vendedor: {vendedor}</div>}
            <div style={{ color: '#999', fontWeight: 600, marginTop: '.15em' }}>N.º {pN(numero, total)}{serie ? ` · Serie ${serie}` : ''}</div>
          </div>
          <div style={{ textAlign: 'right', lineHeight: 1.05, flexShrink: 0 }}>
            <div style={{ color: c.coral, fontSize: '1.35em' }}>{d.valorEtiqueta}</div>
            <div style={{ color: c.azul, fontSize: '1.35em', fontWeight: 700 }}>{d.valor}</div>
          </div>
        </div>
      </div>
      <div style={lateral}>{d.lateralDer}</div>
    </div>
  );
}

// Lo que va dentro de cada caja. 1em = 1% del ancho del ticket; la altura del ticket mide 100/ratio em.
function contenidoCaja(clave, { d, nums, numero, total, serie, vendedor }) {
  const cj = cajasDe(d)[clave];
  const altoEm = (cj.h / 100) * (100 / (Number(d.ratio) || 1.2));
  const base = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    fontFamily: 'Arial, Helvetica, sans-serif', color: d.colorNumeros || '#222', lineHeight: 1, borderRadius: '.4em', boxSizing: 'border-box' };
  if (clave === 'numeros') {
    const enFila = !!d.numerosEnFila;
    const fuente = enFila ? Math.min(altoEm * 0.78, cj.w / 6.2) : Math.min((altoEm / 3) * 0.86, cj.w / 1.95);
    return (
      <div style={{ ...base, flexDirection: enFila ? 'row' : 'column', gap: enFila ? '.35em' : 0, background: d.fondoNumeros || 'transparent', fontSize: `${fuente}em`, fontWeight: 700, letterSpacing: '.03em' }}>
        {nums.map((n) => <span key={n} style={{ lineHeight: 1.08 }}>{p3(n)}</span>)}
      </div>
    );
  }
  const texto = clave === 'vendedor' ? (vendedor ? `Vendedor: ${vendedor}` : '') : `N.º ${pN(numero, total)}${serie ? ` · Serie ${serie}` : ''}`;
  const fuente = Math.min(altoEm * 0.72, cj.w / Math.max(6, texto.length * 0.56));
  return <div style={{ ...base, justifyContent: clave === 'numero' ? 'flex-end' : 'flex-start', fontSize: `${fuente}em`, fontWeight: 700, whiteSpace: 'nowrap' }}>{texto}</div>;
}
const visibles = (d) => ['numeros', ...(d.verVendedor ? ['vendedor'] : []), ...(d.verNumero ? ['numero'] : [])];

// El ticket de Jordyn: su imagen tal cual y encima solo lo que cambia. anchoNum + unidad ('px' | 'mm').
export function TicketImagen({ d, nums, numero, total, serie, vendedor, anchoNum, unidad }) {
  const cj = cajasDe(d);
  return (
    <div style={{ position: 'relative', width: `${anchoNum}${unidad}`, fontSize: `${anchoNum / 100}${unidad}`, aspectRatio: `${Number(d.ratio) || 1.2}`, overflow: 'hidden', breakInside: 'avoid', pageBreakInside: 'avoid', background: '#fff' }}>
      {d.imagen && <img src={d.imagen} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />}
      {visibles(d).map((k) => (
        <div key={k} style={{ position: 'absolute', left: `${cj[k].x}%`, top: `${cj[k].y}%`, width: `${cj[k].w}%`, height: `${cj[k].h}%` }}>
          {contenidoCaja(k, { d, nums, numero, total, serie, vendedor })}
        </div>
      ))}
    </div>
  );
}

// Editor: las cajas se arrastran (mover) y se agrandan desde la esquina (con el dedo o el mouse)
const NOMBRE_CAJA = { numeros: 'Números', vendedor: 'Vendedor', numero: 'N.º' };
function EditorImagen({ d, nums, numero, total, serie, vendedor, anchoNum, onCajas }) {
  const ref = useRef(null);
  const cj = cajasDe(d);
  const empezar = (e, clave, modo) => {
    e.preventDefault(); e.stopPropagation();
    const r = ref.current.getBoundingClientRect();
    const ini = { x: e.clientX, y: e.clientY, caja: { ...cj[clave] } };
    const lim = (v, a, b) => Math.min(b, Math.max(a, v));
    const mover = (ev) => {
      const dx = ((ev.clientX - ini.x) / r.width) * 100;
      const dy = ((ev.clientY - ini.y) / r.height) * 100;
      const k = ini.caja;
      const nueva = modo === 'mover'
        ? { ...k, x: lim(k.x + dx, 0, 100 - k.w), y: lim(k.y + dy, 0, 100 - k.h) }
        : { ...k, w: lim(k.w + dx, 6, 100 - k.x), h: lim(k.h + dy, 3, 100 - k.y) };
      onCajas({ ...cj, [clave]: Object.fromEntries(Object.entries(nueva).map(([a, b]) => [a, Math.round(b * 10) / 10])) });
    };
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };
  return (
    <div ref={ref} style={{ position: 'relative', width: `${anchoNum}px`, fontSize: `${anchoNum / 100}px`, aspectRatio: `${Number(d.ratio) || 1.2}`, background: '#eef2f2', borderRadius: 6, overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
      {d.imagen ? <img src={d.imagen} alt="Tu ticket" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--jordyn-muted)', fontSize: 13 }}>Sube la imagen de tu ticket</div>}
      {visibles(d).map((k) => (
        <div key={k} onPointerDown={(e) => empezar(e, k, 'mover')} role="button" aria-label={`Mover la caja ${NOMBRE_CAJA[k]}`}
          style={{ position: 'absolute', left: `${cj[k].x}%`, top: `${cj[k].y}%`, width: `${cj[k].w}%`, height: `${cj[k].h}%`, outline: '2px dashed #0abfbc', outlineOffset: 1, cursor: 'move' }}>
          {contenidoCaja(k, { d, nums, numero, total, serie, vendedor: vendedor || (k === 'vendedor' ? 'Nombre del vendedor' : '') })}
          <span style={{ position: 'absolute', top: -1, left: -1, transform: 'translateY(-100%)', background: '#0abfbc', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: '4px 4px 0 0', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{NOMBRE_CAJA[k]}</span>
          <span onPointerDown={(e) => empezar(e, k, 'tamano')} role="button" aria-label={`Agrandar la caja ${NOMBRE_CAJA[k]}`}
            style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, borderRadius: '50%', background: '#0abfbc', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)', cursor: 'nwse-resize' }} />
        </div>
      ))}
    </div>
  );
}

// Vista previa que se adapta al ancho disponible
function Vista({ children }) {
  const ref = useRef(null);
  const [w, setW] = useState(380);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.min(460, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} style={{ width: '100%' }}>{children(w)}</div>;
}

// ── Impresión ───────────────────────────────────────────────────
function abrirImpresion(titulo, cuerpo, css) {
  const v = window.open('', '_blank');
  if (!v) { toast.error('Permite las ventanas emergentes para imprimir'); return; }
  v.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>
    @page { size: letter; margin: 7mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: Arial, sans-serif; } ${css}</style></head><body>${cuerpo}
    <script>window.onload = () => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))))
      .then(() => setTimeout(() => window.print(), 350));<\/script></body></html>`);
  v.document.close();
}

export default function TalonarioTriple() {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [id, setId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [d, setD] = useState(DISENO_INICIAL);
  const [serie, setSerie] = useState('A');
  const [cantidad, setCantidad] = useState(MAX);
  const [parejo, setParejo] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [sobran, setSobran] = useState([]);
  const [ver, setVer] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [desde, setDesde] = useState(1);
  const [hasta, setHasta] = useState(MAX);
  const [asignaciones, setAsignaciones] = useState([]);   // [{ desde, hasta, vendedor }]
  const [nombresVendedores, setNombresVendedores] = useState([]);
  const [imprimirDe, setImprimirDe] = useState('');        // '' = por rango; si no, el nombre del vendedor
  const [subiendo, setSubiendo] = useState(false);
  const refArchivo = useRef(null);

  const cargarLista = useCallback(() => API.get('/talonarios').then((r) => setLista(r.data)).catch(() => {}), []);
  useEffect(() => { cargarLista(); }, [cargarLista]);
  // Solo para sugerir nombres al escribir: el talonario guarda el nombre como texto, sin enlazarlo
  useEffect(() => {
    API.get('/vendedores').then((r) => setNombresVendedores([...new Set((r.data || []).filter((v) => v.activo !== false).map((v) => String(v.nombre || '').trim()).filter(Boolean))].sort()))
      .catch(() => {});
  }, []);

  const nuevo = () => {
    setId(null); setNombre(''); setD(DISENO_INICIAL); setSerie('A'); setCantidad(MAX);
    setTickets([]); setSobran([]); setVer(0); setSucio(false); setAsignaciones([]); setImprimirDe('');
  };
  const abrir = async (x) => {
    try {
      const r = (await API.get(`/talonarios/${x.id}`)).data;
      setId(r.id); setNombre(r.nombre); setD({ ...DISENO_INICIAL, ...(r.datos.diseno || {}) });
      setSerie(r.datos.serie || ''); setTickets(r.datos.tickets || []); setCantidad((r.datos.tickets || []).length);
      setSobran(r.datos.sobran || []); setVer(0); setSucio(false); setDesde(1); setHasta((r.datos.tickets || []).length);
      setAsignaciones(Array.isArray(r.datos.asignaciones) ? r.datos.asignaciones : []); setImprimirDe('');
    } catch { toast.error('No se pudo abrir el talonario'); }
  };
  const cambiar = (k, v) => { setD((p) => ({ ...p, [k]: v })); setSucio(true); };

  const barajarTodo = () => {
    if (tickets.length && !window.confirm('Se cambian TODOS los números del talonario. ¿Barajar de nuevo?')) return;
    const n = Math.max(1, Math.min(MAX, Number(cantidad) || MAX));
    const g = generar(n, parejo);
    setTickets(g.tickets); setSobran(g.sobran); setVer(0); setSucio(true); setDesde(1); setHasta(n);
    toast.success(`🎲 ${n} tickets listos, ningún número repetido`);
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Ponle un nombre al talonario (ej. Rifa 300 dólares · 22 nov)'); return; }
    if (!tickets.length) { toast.error('Primero genera los números'); return; }
    setGuardando(true);
    try {
      const body = { nombre: nombre.trim(), datos: { diseno: d, serie, tickets, sobran, asignaciones: asignacionesLimpias } };
      const r = id ? await API.put(`/talonarios/${id}`, body) : await API.post('/talonarios', body);
      setId(r.data.id); setSucio(false); cargarLista();
      toast.success('Talonario guardado');
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };
  const borrar = async () => {
    if (!id || !window.confirm(`¿Borrar el talonario «${nombre}»? No se puede deshacer.`)) return;
    try { await API.delete(`/talonarios/${id}`); toast.success('Talonario borrado'); nuevo(); cargarLista(); }
    catch { toast.error('No se pudo borrar'); }
  };

  // Vendedores por rango. Si dos rangos se pisan, gana el de más abajo.
  const asignacionesLimpias = asignaciones
    .map((a) => ({ desde: Number(a.desde) || 0, hasta: Number(a.hasta) || 0, vendedor: String(a.vendedor || '').trim().slice(0, 60) }))
    .filter((a) => a.vendedor && a.desde >= 1 && a.hasta >= a.desde);
  const vendedorDe = (i) => {
    let v = '';
    for (const a of asignacionesLimpias) if (i + 1 >= a.desde && i + 1 <= a.hasta) v = a.vendedor;
    return v;
  };
  const porVendedor = useMemo(() => {
    const m = new Map();
    tickets.forEach((_, i) => { const v = vendedorDe(i); if (v) m.set(v, [...(m.get(v) || []), i]); });
    return m;
  }, [tickets, asignaciones]); // eslint-disable-line
  const sinVendedor = tickets.length - [...porVendedor.values()].reduce((a, l) => a + l.length, 0);
  const cambiarAsig = (k, campo, val) => { setAsignaciones((l) => l.map((a, j) => (j === k ? { ...a, [campo]: val } : a))); setSucio(true); };
  const agregarAsig = () => {
    const ult = asignacionesLimpias.reduce((m, a) => Math.max(m, a.hasta), 0);
    const ini = Math.min(tickets.length || MAX, ult + 1);
    setAsignaciones((l) => [...l, { desde: ini, hasta: Math.min(tickets.length || MAX, ini + 19), vendedor: '' }]); setSucio(true);
  };

  const subirImagen = async (archivo) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) { toast.error('El archivo debe ser una imagen'); return; }
    if (archivo.size > 8 * 1024 * 1024) { toast.error('La imagen pesa más de 8MB'); return; }
    setSubiendo(true);
    try {
      const fd = new FormData(); fd.append('imagen', archivo);
      const url = (await API.post('/upload/decoracion', fd)).data.url;
      const ratio = await new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth / im.naturalHeight || 1.2); im.onerror = () => res(1.2); im.src = url; });
      setD((p) => ({ ...p, modo: 'imagen', imagen: url, ratio: Math.round(ratio * 1000) / 1000 })); setSucio(true);
      toast.success('Imagen lista: mueve la caja de los números hasta su sitio');
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo subir la imagen'); }
    finally { setSubiendo(false); if (refArchivo.current) refArchivo.current.value = ''; }
  };

  // Un ticket listo para imprimir (ancho en mm)
  const ticketHTML = (i, anchoMm) => renderToStaticMarkup(d.modo === 'imagen'
    ? <TicketImagen d={d} nums={tickets[i]} numero={i + 1} total={tickets.length} serie={serie} vendedor={vendedorDe(i)} anchoNum={anchoMm} unidad="mm" />
    : <TicketTriple d={d} nums={tickets[i]} numero={i + 1} total={tickets.length} serie={serie} vendedor={vendedorDe(i)} ancho={`${anchoMm}mm`} fuente={`${anchoMm / 26.1}mm`} />);
  // Cuántos caben por hoja carta (2 columnas)
  // El ancho (entre 75 y 97 mm) que deja más tickets por hoja; a igual cantidad, el más grande
  const medidaHoja = () => {
    const altoDe = (a) => (d.modo === 'imagen' ? a / (Number(d.ratio) || 1.2) : a * 0.9);
    let mejor = null;
    for (let ancho = 97; ancho >= 40; ancho -= 1) {
      if (altoDe(ancho) > 262) continue;
      const porHoja = Math.max(1, Math.floor((262 + 3) / (altoDe(ancho) + 3))) * 2;
      if (!mejor || porHoja > mejor.porHoja) mejor = { ancho, porHoja };
      if (ancho <= 75 && mejor) break;
    }
    return mejor || { ancho: 40, porHoja: 2 };
  };
  const indicesAImprimir = () => {
    if (imprimirDe) return porVendedor.get(imprimirDe) || [];
    const a = Math.max(1, Number(desde) || 1); const b = Math.min(tickets.length, Number(hasta) || tickets.length);
    return a > b ? [] : Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k);
  };

  // Mapa: número → ticket
  const duenoDe = useMemo(() => {
    const m = new Map();
    tickets.forEach((t, i) => t.forEach((n) => m.set(n, i)));
    return m;
  }, [tickets]);
  const repetidos = tickets.length * 3 - duenoDe.size;
  const buscado = /^\d{1,3}$/.test(buscar.trim()) ? Number(buscar.trim()) : null;
  const hallado = buscado != null ? duenoDe.get(buscado) : undefined;

  const imprimirTickets = () => {
    const lista = indicesAImprimir();
    if (!lista.length) { toast.error(imprimirDe ? 'Ese vendedor no tiene tickets' : 'Revisa el rango a imprimir'); return; }
    if (d.modo === 'imagen' && !d.imagen) { toast.error('Sube primero la imagen de tu ticket'); return; }
    const { ancho, porHoja } = medidaHoja();
    const piezas = lista.map((i) => `<div class="celda">${ticketHTML(i, ancho)}</div>`);
    const hojas = [];
    for (let i = 0; i < piezas.length; i += porHoja) hojas.push(`<div class="hoja">${piezas.slice(i, i + porHoja).join('')}</div>`);
    abrirImpresion(`${nombre || 'Talonario'} · ${imprimirDe || `tickets ${lista[0] + 1}-${lista[lista.length - 1] + 1}`}`, hojas.join(''),
      `.hoja { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 4mm; page-break-after: always; justify-items: center; }
       .hoja:last-child { page-break-after: auto; } .celda { outline: .3mm dashed #bbb; outline-offset: 1.2mm; }`);
  };
  const imprimirControl = () => {
    const esc = (x) => String(x).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const lista = imprimirDe ? (porVendedor.get(imprimirDe) || []) : tickets.map((_, i) => i);
    const filas = lista.map((i) => `<tr><td>${pN(i + 1, tickets.length)}</td><td>${tickets[i].map(p3).join(' · ')}</td><td>${esc(vendedorDe(i))}</td><td></td></tr>`);
    const col = Math.ceil(filas.length / 2);
    const tablas = [0, 1].map((k) => `<table><thead><tr><th>N.º</th><th>Números</th><th>Vendedor</th><th>Cliente</th></tr></thead><tbody>${filas.slice(k * col, (k + 1) * col).join('')}</tbody></table>`).join('');
    abrirImpresion(`${nombre || 'Talonario'} · hoja de control`,
      `<h1>${esc(nombre || 'Talonario')}${serie ? ` · Serie ${esc(serie)}` : ''}${imprimirDe ? ` · ${esc(imprimirDe)}` : ''}</h1><p>${tickets.length} tickets · ${tickets.length * 3} números sin repetir${sobran.length ? ` · sin usar: ${sobran.map(p3).join(', ')}` : ''}</p><div class="cols">${tablas}</div>`,
      `h1 { font-size: 14pt; margin: 0 0 2mm; } p { font-size: 9pt; color: #555; margin: 0 0 3mm; }
       .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; align-items: start; }
       table { border-collapse: collapse; width: 100%; font-size: 8pt; } th, td { border: .2mm solid #bbb; padding: .6mm 1.2mm; text-align: left; }
       th { background: #eef6f6; } td:last-child { width: 30%; }`);
  };
  const descargarCSV = () => {
    const filas = ['ticket;numero_1;numero_2;numero_3;vendedor', ...tickets.map((t, i) => `${i + 1};${t.map(p3).join(';')};${vendedorDe(i).replace(/;/g, ',')}`)];
    const url = URL.createObjectURL(new Blob([`﻿${filas.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${(nombre || 'talonario').replace(/[^\w\- ]+/g, '')}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const caja = { background: 'var(--jordyn-surface)', border: '1px solid var(--jordyn-border)', borderRadius: 14, padding: '1rem', marginBottom: 14 };
  const etiqueta = { fontSize: '.66rem', fontWeight: 800, letterSpacing: '.06em', color: 'var(--jordyn-muted)', textTransform: 'uppercase', marginBottom: 3, display: 'block' };
  const campo = (k, label, extra = {}) => (
    <div style={{ flex: extra.flex || '1 1 200px', minWidth: 0 }}>
      <label style={etiqueta} htmlFor={`tal-${k}`}>{label}</label>
      <input id={`tal-${k}`} className="jd-input" type={extra.type || 'text'} value={d[k]} maxLength={80} onChange={(e) => cambiar(k, e.target.value)} style={{ padding: '7px 10px', fontSize: '.84rem' }} />
    </div>
  );
  const actual = tickets[ver];

  return (
    <Layout title="TALONARIO DE 3 NÚMEROS">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" className="btn-jordyn-outline" onClick={() => navigate('/plantillas')} style={{ fontSize: '.78rem' }}><i className="bi bi-arrow-left me-1"></i>Plantillas</button>
        <div style={{ fontSize: '.78rem', color: 'var(--jordyn-muted)', flex: '1 1 260px' }}>
          Cada ticket lleva 3 números del 000 al 999 y <b>ningún número se repite en la serie</b>. Es aparte de las rifas del sistema: no toca ventas, vendedores ni caja.
        </div>
      </div>

      {/* Talonarios guardados */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" onClick={nuevo} className={id ? 'btn-jordyn-outline' : 'btn-jordyn'} style={{ fontSize: '.76rem', padding: '6px 12px' }}><i className="bi bi-plus-lg me-1"></i>Nuevo talonario</button>
        {lista.map((x) => (
          <button key={x.id} type="button" onClick={() => abrir(x)} aria-pressed={x.id === id}
            style={{ fontSize: '.74rem', fontWeight: 700, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', border: `1.5px solid ${x.id === id ? 'var(--jordyn-primary)' : 'var(--jordyn-border2)'}`, background: x.id === id ? '#0abfbc14' : '#fff', color: 'var(--jordyn-text)' }}>
            {x.nombre} <span style={{ color: 'var(--jordyn-muted)', fontWeight: 600 }}>· {x.tickets} tickets{x.serie ? ` · ${x.serie}` : ''}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* ── Izquierda: datos ── */}
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div style={caja}>
            <label style={etiqueta} htmlFor="tal-nombre">Nombre del talonario</label>
            <input id="tal-nombre" className="jd-input" value={nombre} maxLength={120} onChange={(e) => { setNombre(e.target.value); setSucio(true); }} placeholder="Ej. Gran rifa 300 dólares · 22 nov" style={{ padding: '8px 10px', marginBottom: 12 }} />

            <div style={{ fontWeight: 800, fontSize: '.86rem', marginBottom: 8 }}><i className="bi bi-shuffle me-1" style={{ color: 'var(--jordyn-primary)' }}></i>Números</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={etiqueta} htmlFor="tal-cant">Cuántos tickets (máx. {MAX})</label>
                <input id="tal-cant" className="jd-input" type="number" min="1" max={MAX} value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={{ padding: '7px 10px' }} />
              </div>
              <div style={{ flex: '0 0 90px' }}>
                <label style={etiqueta} htmlFor="tal-serie">Serie</label>
                <input id="tal-serie" className="jd-input" value={serie} maxLength={4} onChange={(e) => { setSerie(e.target.value.toUpperCase()); setSucio(true); }} style={{ padding: '7px 10px' }} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '.78rem', fontWeight: 700, margin: '10px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={parejo} onChange={(e) => setParejo(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--jordyn-primary)', marginTop: 1 }} />
              <span>Mezcla pareja <span style={{ fontWeight: 500, color: 'var(--jordyn-muted)' }}>— los 3 números de cada ticket de centenas distintas (ej. 147 · 702 · 887), nunca 140 · 145 · 199</span></span>
            </label>
            <button type="button" className="btn-jordyn" onClick={barajarTodo} style={{ width: '100%', padding: 11, fontSize: '.88rem' }}>
              <i className="bi bi-dice-5-fill me-2"></i>{tickets.length ? 'Barajar de nuevo' : 'Generar los números'}
            </button>
          </div>

          <div style={caja}>
            <div style={{ fontWeight: 800, fontSize: '.86rem', marginBottom: 8 }}><i className="bi bi-palette-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>Diseño del ticket</div>
            <div role="tablist" style={{ display: 'flex', background: 'var(--jordyn-bg2)', borderRadius: 12, padding: 3, marginBottom: 12 }}>
              {[['imagen', 'bi-image-fill', 'Mi imagen'], ['sistema', 'bi-layout-text-window', 'Diseño de aquí']].map(([k, ic, t]) => (
                <button key={k} type="button" role="tab" aria-selected={d.modo === k} onClick={() => cambiar('modo', k)}
                  style={{ flex: 1, border: 'none', borderRadius: 10, padding: '8px 6px', fontSize: '.8rem', fontWeight: 800, cursor: 'pointer',
                    background: d.modo === k ? '#fff' : 'transparent', color: d.modo === k ? 'var(--jordyn-primary-d)' : 'var(--jordyn-muted)', boxShadow: d.modo === k ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                  <i className={`bi ${ic} me-1`}></i>{t}
                </button>
              ))}
            </div>
            {d.modo === 'imagen' ? <>
              <div style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)', marginBottom: 8, lineHeight: 1.45 }}>
                Sube tu ticket ya diseñado (como el de papel). El sistema solo le pone encima los 3 números de cada ticket. En la vista previa, <b>arrastra cada caja</b> hasta su sitio y <b>agrándala</b> desde el puntico de la esquina.
              </div>
              <input ref={refArchivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => subirImagen(e.target.files?.[0])} />
              <button type="button" className={d.imagen ? 'btn-jordyn-outline' : 'btn-jordyn'} disabled={subiendo} onClick={() => refArchivo.current?.click()} style={{ width: '100%', marginBottom: 10 }}>
                {subiendo ? 'Subiendo…' : <><i className="bi bi-upload me-1"></i>{d.imagen ? 'Cambiar la imagen' : 'Subir la imagen del ticket'}</>}
              </button>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: '.78rem', fontWeight: 700 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Color de los números
                  <input type="color" value={d.colorNumeros || '#222222'} onChange={(e) => cambiar('colorNumeros', e.target.value)} aria-label="Color de los números" style={{ width: 34, height: 26, border: 'none', padding: 0, background: 'none' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Fondo
                  <select className="jd-input" value={d.fondoNumeros || ''} onChange={(e) => cambiar('fondoNumeros', e.target.value)} style={{ padding: '4px 8px', fontSize: '.76rem', width: 'auto' }}>
                    <option value="">Sin fondo</option><option value="#ffffff">Blanco</option><option value="#f3ead2">Crema</option><option value="#fff6cc">Amarillo claro</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '.78rem', fontWeight: 700, marginTop: 8 }}>
                {[['numerosEnFila', 'Números en fila (uno al lado del otro)'], ['verVendedor', 'Poner el vendedor'], ['verNumero', 'Poner el N.º del ticket']].map(([k, t]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!d[k]} onChange={(e) => cambiar(k, e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--jordyn-primary)' }} />{t}
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => cambiar('cajas', null)} style={{ border: 'none', background: 'none', padding: 0, marginTop: 8, color: 'var(--jordyn-primary-d)', fontWeight: 700, fontSize: '.74rem', cursor: 'pointer' }}>Volver a poner las cajas donde estaban</button>
            </> : <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {Object.entries(TEMAS).map(([k, t]) => (
                <button key={k} type="button" onClick={() => cambiar('tema', k)} aria-pressed={d.tema === k}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: '.74rem', fontWeight: 700, cursor: 'pointer', background: '#fff',
                    border: `2px solid ${d.tema === k ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}` }}>
                  <span style={{ display: 'inline-flex' }}>{[t.vino, t.coral, t.azul].map((col) => <span key={col} style={{ width: 10, height: 10, borderRadius: '50%', background: col, marginLeft: -2, border: '1px solid #fff' }} />)}</span>{t.nombre}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {campo('loteria', 'Lotería y hora', { flex: '1 1 100%' })}
              {campo('fecha', 'Fecha del sorteo', { type: 'date' })}
              {campo('etiquetaPremio', 'Palabra grande', { flex: '1 1 120px' })}
              {campo('oportunidades', 'Junto al premio', { flex: '1 1 100%' })}
              {campo('monto', 'Monto del premio', { flex: '1 1 120px' })}
              {campo('unidad', 'Moneda / unidad', { flex: '1 1 120px' })}
              {campo('titulo', 'Título', { flex: '1 1 100%' })}
              {campo('responsables', 'Responsables')}
              {campo('telefonos', 'Teléfonos (separa con /)')}
              {campo('valorEtiqueta', 'Texto del valor', { flex: '1 1 120px' })}
              {campo('valor', 'Valor del boleto', { flex: '1 1 120px' })}
              {campo('lateralIzq', 'Texto lateral izquierdo')}
              {campo('lateralDer', 'Texto lateral derecho')}
            </div>
            </>}
          </div>

          {/* ── Vendedores ── */}
          <div style={caja}>
            <div style={{ fontWeight: 800, fontSize: '.86rem', marginBottom: 4 }}><i className="bi bi-people-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>Vendedores</div>
            <div style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)', marginBottom: 8 }}>A quién le das cada grupo de tickets. Su nombre sale en el ticket y en la hoja de control, y puedes imprimir solo los de uno.</div>
            <datalist id="tal-vendedores">{nombresVendedores.map((n) => <option key={n} value={n} />)}</datalist>
            {asignaciones.map((a, k) => (
              <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--jordyn-muted)' }}>Del</span>
                <input className="jd-input" type="number" min="1" value={a.desde} onChange={(e) => cambiarAsig(k, 'desde', e.target.value)} aria-label="Desde el ticket" style={{ width: 70, padding: '6px 8px' }} />
                <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--jordyn-muted)' }}>al</span>
                <input className="jd-input" type="number" min="1" value={a.hasta} onChange={(e) => cambiarAsig(k, 'hasta', e.target.value)} aria-label="Hasta el ticket" style={{ width: 70, padding: '6px 8px' }} />
                <input className="jd-input" list="tal-vendedores" value={a.vendedor} maxLength={60} onChange={(e) => cambiarAsig(k, 'vendedor', e.target.value)} placeholder="Nombre del vendedor" aria-label="Vendedor" style={{ flex: '1 1 140px', padding: '6px 8px' }} />
                <button type="button" onClick={() => { setAsignaciones((l) => l.filter((_, j) => j !== k)); setSucio(true); }} aria-label="Quitar" style={{ border: 'none', background: 'none', color: '#c0392b', fontSize: '1rem', cursor: 'pointer' }}><i className="bi bi-x-circle"></i></button>
              </div>
            ))}
            <button type="button" className="btn-jordyn-outline" onClick={agregarAsig} style={{ fontSize: '.76rem', padding: '6px 12px' }}><i className="bi bi-plus-lg me-1"></i>Asignar tickets a un vendedor</button>
            {tickets.length > 0 && (porVendedor.size > 0 || asignaciones.length > 0) && (
              <div style={{ fontSize: '.72rem', marginTop: 8, lineHeight: 1.6 }}>
                {[...porVendedor.entries()].map(([v, l]) => <span key={v} style={{ display: 'inline-block', marginRight: 10 }}><b>{v}</b>: {l.length}</span>)}
                <span style={{ color: sinVendedor ? '#a07000' : 'var(--jordyn-muted)' }}>Sin vendedor: {sinVendedor}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Derecha: vista previa, mapa e impresión ── */}
        <div style={{ flex: '1 1 380px', minWidth: 0, position: 'sticky', top: 10 }}>
          <div style={caja}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <b style={{ fontSize: '.86rem' }}>Vista previa</b>
              {tickets.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" className="btn-jordyn-outline" onClick={() => setVer((v) => Math.max(0, v - 1))} disabled={ver === 0} aria-label="Ticket anterior" style={{ padding: '2px 9px' }}>‹</button>
                  <span style={{ fontSize: '.76rem', fontWeight: 700, minWidth: 74, textAlign: 'center' }}>N.º {pN(ver + 1, tickets.length)} de {tickets.length}</span>
                  <button type="button" className="btn-jordyn-outline" onClick={() => setVer((v) => Math.min(tickets.length - 1, v + 1))} disabled={ver >= tickets.length - 1} aria-label="Ticket siguiente" style={{ padding: '2px 9px' }}>›</button>
                </div>
              )}
            </div>
            <Vista>{(w) => (d.modo === 'imagen'
              ? <EditorImagen d={d} nums={actual || [147, 702, 887]} numero={ver + 1} total={tickets.length || MAX} serie={serie} vendedor={vendedorDe(ver)} anchoNum={w} onCajas={(cj) => cambiar('cajas', cj)} />
              : <TicketTriple d={d} nums={actual || [147, 702, 887]} numero={ver + 1} total={tickets.length || MAX} serie={serie} vendedor={vendedorDe(ver)} ancho={`${w}px`} fuente={`${w / 26.1}px`} />)}</Vista>
            {!tickets.length && <div style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)', marginTop: 6, textAlign: 'center' }}>Así se verá. Toca «Generar los números» para crear el talonario.</div>}
          </div>

          {tickets.length > 0 && <>
            <div style={caja}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[[`${tickets.length}`, 'tickets'], [`${duenoDe.size}`, 'números'], [repetidos ? `${repetidos}` : '0 ✓', 'repetidos'], [sobran.length ? sobran.slice(0, 3).map(p3).join(', ') + (sobran.length > 3 ? '…' : '') : '—', `sin usar (${sobran.length})`]].map(([v, t]) => (
                  <div key={t} style={{ flex: '1 1 70px', textAlign: 'center', background: t === 'repetidos' && !repetidos ? '#e8f8ee' : 'var(--jordyn-bg2)', borderRadius: 10, padding: '6px 4px' }}>
                    <div style={{ fontWeight: 900, fontSize: '.95rem', color: t === 'repetidos' && !repetidos ? '#1e9e50' : 'var(--jordyn-text)' }}>{v}</div>
                    <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase' }}>{t}</div>
                  </div>
                ))}
              </div>
              <label style={etiqueta} htmlFor="tal-buscar">¿Quién tiene el número…?</label>
              <input id="tal-buscar" className="jd-input" inputMode="numeric" maxLength={3} value={buscar} onChange={(e) => setBuscar(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 702" style={{ padding: '7px 10px', marginBottom: 6 }} />
              {buscado != null && (
                <div style={{ fontSize: '.8rem', fontWeight: 700, marginBottom: 8 }}>
                  {hallado !== undefined
                    ? <>El <b>{p3(buscado)}</b> está en el ticket <button type="button" onClick={() => setVer(hallado)} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--jordyn-primary-d)', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}>N.º {pN(hallado + 1, tickets.length)}</button> ({tickets[hallado].map(p3).join(' · ')}){vendedorDe(hallado) ? <> · lo tiene <b>{vendedorDe(hallado)}</b></> : ''}</>
                    : <>El <b>{p3(buscado)}</b> no está en ningún ticket (sobra).</>}
                </div>
              )}
              <div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)', marginBottom: 4 }}>Mapa de los 1000 números · toca uno para ver su ticket</div>
              <div role="grid" aria-label="Mapa de los 1000 números" style={{ display: 'grid', gridTemplateColumns: 'repeat(40, 1fr)', gap: 1 }}>
                {Array.from({ length: 1000 }, (_, n) => {
                  const i = duenoDe.get(n);
                  const del = i === ver;
                  const marca = n === buscado;
                  return (
                    <button key={n} type="button" title={i === undefined ? `${p3(n)} · sin usar` : `${p3(n)} · ticket ${i + 1}`} onClick={() => { if (i !== undefined) setVer(i); setBuscar(p3(n)); }}
                      style={{ aspectRatio: '1 / 1', padding: 0, border: 'none', borderRadius: 1, cursor: 'pointer',
                        background: marca ? '#e0a800' : del ? 'var(--jordyn-primary)' : i === undefined ? '#d5dcdc' : '#9fe0c3' }} aria-label={p3(n)} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 5 }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#9fe0c3', marginRight: 3 }} />en un ticket</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--jordyn-primary)', marginRight: 3 }} />ticket en pantalla</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#d5dcdc', marginRight: 3 }} />sin usar</span>
              </div>
            </div>

            <div style={caja}>
              <div style={{ fontWeight: 800, fontSize: '.86rem', marginBottom: 8 }}><i className="bi bi-printer-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>Imprimir</div>
              <label style={etiqueta} htmlFor="tal-imprimir-de">Qué imprimir</label>
              <select id="tal-imprimir-de" className="jd-input" value={imprimirDe} onChange={(e) => setImprimirDe(e.target.value)} style={{ padding: '7px 10px', marginBottom: 8 }}>
                <option value="">Por rango de números de ticket</option>
                {[...porVendedor.entries()].map(([v, l]) => <option key={v} value={v}>Solo los de {v} ({l.length})</option>)}
              </select>
              <div style={{ display: imprimirDe ? 'none' : 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ flex: '1 1 80px' }}><label style={etiqueta} htmlFor="tal-desde">Desde N.º</label><input id="tal-desde" className="jd-input" type="number" min="1" max={tickets.length} value={desde} onChange={(e) => setDesde(e.target.value)} style={{ padding: '7px 10px' }} /></div>
                <div style={{ flex: '1 1 80px' }}><label style={etiqueta} htmlFor="tal-hasta">Hasta N.º</label><input id="tal-hasta" className="jd-input" type="number" min="1" max={tickets.length} value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ padding: '7px 10px' }} /></div>
                <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', flex: '1 1 120px', paddingBottom: 6 }}>
                </div>
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--jordyn-muted)', marginBottom: 8 }}>
                {indicesAImprimir().length} tickets · {Math.ceil(indicesAImprimir().length / medidaHoja().porHoja)} hojas carta ({medidaHoja().porHoja} por hoja)
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-jordyn" onClick={imprimirTickets} style={{ flex: '1 1 160px' }}><i className="bi bi-printer me-1"></i>Imprimir tickets</button>
                <button type="button" className="btn-jordyn-outline" onClick={imprimirControl} style={{ flex: '1 1 160px' }}><i className="bi bi-list-check me-1"></i>Hoja de control</button>
                <button type="button" className="btn-jordyn-outline" onClick={descargarCSV} style={{ flex: '1 1 100px' }}><i className="bi bi-filetype-csv me-1"></i>CSV</button>
              </div>
            </div>
          </>}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-jordyn" onClick={guardar} disabled={guardando} style={{ flex: '1 1 200px', padding: 11 }}>
              {guardando ? 'Guardando…' : <><i className="bi bi-cloud-check-fill me-1"></i>{id ? 'Guardar cambios' : 'Guardar talonario'}</>}
            </button>
            {id && <button type="button" onClick={borrar} style={{ border: 'none', background: 'none', color: '#c0392b', fontWeight: 700, fontSize: '.78rem', cursor: 'pointer' }}>Borrar</button>}
            {sucio && <span style={{ fontSize: '.7rem', color: '#a07000', fontWeight: 700, width: '100%' }}>Hay cambios sin guardar. Guarda antes de imprimir para poder reimprimirlo igual.</span>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
