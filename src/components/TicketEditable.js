// ════════════════════════════════════════════════════════════════
//   components/TicketEditable.js
//   RIFAS JORDYN — Editor estilo Canva (sistema unificado)
//
//   ▸ Click corto = seleccionar + editar texto · Drag = mover
//   ▸ Shift+drag = snap a grid de 10px
//   ▸ Cualquier elemento seleccionado abre el MISMO panel lateral:
//     color, tamaño, peso, fuente, itálica, rotación
//   ▸ Built-in: las propiedades se guardan en design.colorX, sizeX...
//     Custom: dentro de design.customTexts[i]
//   ▸ Botón "+ Agregar texto" para crear elementos custom
//   ▸ Selector "Tamaño global" (factor que multiplica TODO size*)
//   ▸ Botón "🎨 Paletas" para abrir paletas predefinidas
//   ▸ Botón "↺ Reset posiciones"
//
//   El panel lateral REEMPLAZA las secciones de tipografía/colores
//   del panel padre. Eso lo decides en tu componente contenedor.
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { DEFAULT_DESIGN } from './Ticket';

// ── Constantes ──────────────────────────────────────────
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);
const DRAG_THRESHOLD = 5;
const SNAP_GRID = 10;

const FUENTES = [
  { label: 'Poppins',      val: "'Poppins', sans-serif" },
  { label: 'Arial Black',  val: "'Arial Black', sans-serif" },
  { label: 'Brush Script', val: "'Brush Script MT', cursive" },
  { label: 'Georgia',      val: "'Georgia', serif" },
  { label: 'Courier',      val: "'Courier New', monospace" },
  { label: 'Impact',       val: "'Impact', sans-serif" },
];

const PALETAS = [
  { id: 'tradicional', label: '🇪🇨 Tradicional',
    colors: { colorSlogan:'#d92626', colorFecha:'#1a3a8a', colorPremio1:'#f5c518', colorPremio2:'#1565d8', colorDolares:'#d92626', colorSubPremio:'#c41e7a', colorPesosSub:'#2e8b3e', colorBoleto:'#1565d8', colorValor:'#d92626', colorPesos:'#2e8b3e', colorTalon:'#1565d8' } },
  { id: 'venezolano', label: '🇻🇪 Venezolano',
    colors: { colorSlogan:'#cf142b', colorFecha:'#003893', colorPremio1:'#fcd116', colorPremio2:'#003893', colorDolares:'#cf142b', colorSubPremio:'#003893', colorPesosSub:'#cf142b', colorBoleto:'#003893', colorValor:'#cf142b', colorPesos:'#fcd116', colorTalon:'#003893' } },
  { id: 'colombiano', label: '🇨🇴 Colombiano',
    colors: { colorSlogan:'#ce1126', colorFecha:'#003893', colorPremio1:'#fcd116', colorPremio2:'#003893', colorDolares:'#ce1126', colorSubPremio:'#003893', colorPesosSub:'#ce1126', colorBoleto:'#003893', colorValor:'#ce1126', colorPesos:'#fcd116', colorTalon:'#003893' } },
  { id: 'sobrio', label: '⚫ Sobrio (B/N)',
    colors: { colorSlogan:'#1a1a1a', colorFecha:'#333', colorPremio1:'#1a1a1a', colorPremio2:'#666', colorDolares:'#1a1a1a', colorSubPremio:'#333', colorPesosSub:'#666', colorBoleto:'#1a1a1a', colorValor:'#1a1a1a', colorPesos:'#666', colorTalon:'#1a1a1a' } },
  { id: 'esmeralda', label: '💚 Esmeralda',
    colors: { colorSlogan:'#0d6e3a', colorFecha:'#1a4d2e', colorPremio1:'#d4af37', colorPremio2:'#0d6e3a', colorDolares:'#0d6e3a', colorSubPremio:'#1a4d2e', colorPesosSub:'#d4af37', colorBoleto:'#1a4d2e', colorValor:'#0d6e3a', colorPesos:'#d4af37', colorTalon:'#1a4d2e' } },
];

const TAMANOS_GLOBALES = [
  { label: 'Pequeño', factor: 0.8 },
  { label: 'Normal',  factor: 1.0 },
  { label: 'Grande',  factor: 1.2 },
  { label: 'X-Grande',factor: 1.4 },
];

// ── Posiciones default ──────────────────────────────────
const DEFAULT_POSITIONS = {
  numBoletoIzq:    { x: 18,  y: 12 },
  nombreLabel:     { x: 10,  y: 70 },
  telLabel:        { x: 10,  y: 300 },
  brandText:       { x: 95,  y: 100, rotated: true },
  talonText:       { x: 132, y: 220, rotated: true },

  sloganTop:       { x: 155, y: 14 },
  fechaPrefix:     { x: 155, y: 50 },
  fechaTexto:      { x: 235, y: 50 },
  numBoletoDer:    { x: 685, y: 12 },

  premioLabel:     { x: 250, y: 90 },
  premioNum:       { x: 180, y: 115 },
  premioTexto:     { x: 380, y: 195 },
  subPremioPrefix: { x: 200, y: 230 },
  subPremioNum:    { x: 230, y: 230 },
  subPremioMoneda: { x: 380, y: 232 },

  caducaText:      { x: 730, y: 100, rotated: true },
  loteriaTexto:    { x: 560, y: 200 },

  motivacionalText:{ x: 155, y: 275 },
  boletoLabel:     { x: 600, y: 245 },
  valorTexto:      { x: 560, y: 275 },
  valorSufijo:     { x: 720, y: 295 },

  footerText:      { x: 220, y: 320 },
};

/* ════════════════════════════════════════════════════════════
   FIELD_META — define qué propiedades del design controla
   cada elemento built-in y qué controles mostrar en el panel.
═════════════════════════════════════════════════════════════ */
const FIELD_META = {
  // Talón
  numBoletoIzq: {
    label: 'N° boleto (izquierda)',
    sizeKey: 'sizeNumTalon', colorKey: 'colorTalon',
    valueKey: 'numBoleto', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  nombreLabel: {
    label: 'Etiqueta "NOMBRE:"',
    sizeKey: 'sizeNombre', colorKey: null, // negro fijo
    valueKey: '_label_NOMBRE', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  telLabel: {
    label: 'Etiqueta "Tel:"',
    sizeKey: 'sizeNombre', colorKey: null,
    valueKey: '_label_Tel', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  brandText: {
    label: '"GRAN RIFA" (vertical)',
    sizeKey: 'sizeBrand', colorKey: 'colorTalon',
    valueKey: 'brandText', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  talonText: {
    label: '"BOLETO SIN CANCELAR..."',
    sizeKey: 'sizeTalonText', colorKey: null,
    valueKey: 'talonText', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },

  // Cabecera
  sloganTop: {
    label: 'Slogan superior',
    sizeKey: 'sizeSlogan', colorKey: 'colorSlogan',
    valueKey: 'sloganTop', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  fechaPrefix: {
    label: 'Prefijo de fecha',
    sizeKey: 'sizeFecha', colorKey: 'colorFecha',
    valueKey: 'fechaPrefix', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  fechaTexto: {
    label: 'Fecha',
    sizeKey: 'sizeFecha', colorKey: 'colorFecha',
    valueKey: 'fechaTexto', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  numBoletoDer: {
    label: 'N° boleto (derecha)',
    sizeKey: 'sizeNumDer', colorKey: 'colorTalon',
    valueKey: 'numBoleto', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },

  // Premio
  premioLabel: {
    label: 'Etiqueta "Premio"',
    sizeKey: 'sizePremioLabel', colorKey: 'colorPremio1',
    valueKey: 'premioLabel', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  premioNum: {
    label: 'Número del premio',
    sizeKey: 'sizePremioNum',
    colorKey: 'colorPremio1', colorKey2: 'colorPremio2',  // gradiente
    valueKey: 'premioNum', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  premioTexto: {
    label: 'Tipo del premio ("Dólares")',
    sizeKey: 'sizePremioTxt', colorKey: 'colorDolares',
    valueKey: 'premioTexto', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  subPremioPrefix: {
    label: 'Prefijo sub-premio',
    sizeKey: 'sizeSubPremio', colorKey: 'colorSubPremio',
    valueKey: 'subPremioPrefix', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  subPremioNum: {
    label: 'Monto sub-premio',
    sizeKey: 'sizeSubPremio', colorKey: 'colorSubPremio',
    valueKey: 'subPremioNum', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  subPremioMoneda: {
    label: 'Moneda sub-premio',
    sizeKey: 'sizeSubMoneda', colorKey: 'colorPesosSub',
    valueKey: 'subPremioMoneda', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },

  // Derecha
  caducaText: {
    label: '"Caduca a los X días"',
    sizeKey: 'sizeCaduca', colorKey: 'colorCaduca',
    valueKey: 'caducaText', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  loteriaTexto: {
    label: 'Lotería + hora',
    sizeKey: 'sizeLoteria', colorKey: 'colorLoteria',
    valueKey: 'loteriaTexto', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },

  // Inferior
  motivacionalText: {
    label: 'Frase motivacional',
    sizeKey: 'sizeMotivac', colorKey: 'colorMotivac',
    valueKey: 'motivacionalText', hasFontFamily: false, hasWeight: false, hasItalic: false,
    multiline: true,
  },
  boletoLabel: {
    label: 'Etiqueta "BOLETO"',
    sizeKey: 'sizeBoleto', colorKey: 'colorBoleto',
    valueKey: 'boletoLabel', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  valorTexto: {
    label: 'Valor del boleto',
    sizeKey: 'sizeValor', colorKey: 'colorValor',
    valueKey: 'valorTexto', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  valorSufijo: {
    label: 'Sufijo del valor',
    sizeKey: 'sizePesos', colorKey: 'colorPesos',
    valueKey: 'valorSufijo', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
  footerText: {
    label: 'Pie de página',
    sizeKey: 'sizeFooter', colorKey: null,
    valueKey: 'footerText', hasFontFamily: false, hasWeight: false, hasItalic: false,
  },
};

// ── Helpers ─────────────────────────────────────────────
const parseFecha = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFechaLoteria = (f) => {
  const d = parseFecha(f);
  if (!d) return '';
  const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} - ${d.getUTCFullYear()}`;
};
const fmtHora12 = (h) => {
  if (!h) return '';
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let hh = parseInt(m[1]);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${hh}:${m[2]} ${ampm}`;
};
const splitPremio = (p) => {
  if (!p) return { numero: '', texto: '' };
  const m = String(p).trim().match(/^([\d.,]+)\s*(.*)$/);
  return m ? { numero: m[1], texto: m[2] || '' } : { numero: '', texto: String(p) };
};
const fmtMilesPunto = (n) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(num) ? '' : num.toLocaleString('de-DE');
};
const fmtValorBoleto = (n) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + ' Millón';
  if (num >= 1000)    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + ' Mil';
  return String(num);
};

function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

const resolveValue = (design, campo, fallback) => {
  const v = design?.[campo];
  return v !== undefined && v !== null ? v : (fallback ?? '');
};

const getPos = (positions, campo) => {
  const saved = positions?.[campo];
  const def = DEFAULT_POSITIONS[campo] || { x: 0, y: 0 };
  if (!saved) return def;
  return { ...def, ...saved };
};

/* ════════════════════════════════════════════════════════════
   <DraggableEditable> — átomo arrastrable + editable
═════════════════════════════════════════════════════════════ */
function DraggableEditable({
  id,
  position,
  rotation = 0,
  onMove,
  value,
  onChange,
  textStyle,
  scale = 1,
  multiline = false,
  placeholder = '(click)',
  selected = false,
  onSelect,
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value || '');
  const [hover, setHover]       = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const positionRef = useLatest(position);
  const scaleRef    = useLatest(scale);
  const onMoveRef   = useLatest(onMove);
  const idRef       = useLatest(id);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handlePointerDown = (e) => {
    if (editing) return;
    if (e.type === 'mousedown' && e.button !== 0) return;
    e.stopPropagation();

    const point = e.touches ? e.touches[0] : e;
    const startMouseX = point.clientX;
    const startMouseY = point.clientY;
    const startPosX = positionRef.current.x;
    const startPosY = positionRef.current.y;
    let started = false;

    const handleMove = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = p.clientX - startMouseX;
      const dy = p.clientY - startMouseY;
      const dist = Math.hypot(dx, dy);

      if (!started && dist < DRAG_THRESHOLD) return;
      if (!started) {
        started = true;
        setDragging(true);
      }
      if (ev.cancelable) ev.preventDefault();

      const s = scaleRef.current || 1;
      let newX = startPosX + dx / s;
      let newY = startPosY + dy / s;
      if (ev.shiftKey) {
        newX = Math.round(newX / SNAP_GRID) * SNAP_GRID;
        newY = Math.round(newY / SNAP_GRID) * SNAP_GRID;
      }
      onMoveRef.current(idRef.current, { x: Math.round(newX), y: Math.round(newY) });
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup',   handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend',  handleUp);

      if (onSelect) onSelect(idRef.current);
      if (!started) setEditing(true);
      setDragging(false);
    };

    if (e.touches) {
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend',  handleUp);
    } else {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup',   handleUp);
    }
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value || '');
  };

  const wrapperStyle = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: rotation ? `rotate(${rotation}deg)` : 'none',
    transformOrigin: 'left top',
    cursor: dragging ? 'grabbing' : (editing ? 'text' : 'grab'),
    zIndex: dragging ? 1000 : (selected ? 100 : (hover ? 10 : 1)),
    userSelect: 'none',
    touchAction: 'none',
    transition: dragging ? 'none' : 'box-shadow .15s, outline .12s',
    outline: editing || dragging || selected
      ? '2px solid #0abfbc'
      : hover
        ? '1px dashed rgba(10,191,188,.85)'
        : 'none',
    outlineOffset: 3,
    borderRadius: 3,
    boxShadow: dragging ? '0 8px 20px rgba(10,191,188,.35)' : 'none',
    whiteSpace: 'nowrap',
  };

  if (editing) {
    const Comp = multiline ? 'textarea' : 'input';
    return (
      <div style={wrapperStyle}>
        <Comp
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
            else if (e.key === 'Escape')         { e.preventDefault(); cancel(); }
          }}
          rows={multiline ? 2 : undefined}
          style={{
            ...textStyle,
            background: 'rgba(10,191,188,.14)',
            outline: 'none', border: 'none',
            padding: '2px 4px', borderRadius: 3, minWidth: 60,
            fontFamily: textStyle?.fontFamily || 'inherit',
            resize: multiline ? 'vertical' : 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  const isEmpty = !value;
  return (
    <div
      data-field={id}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click: editar · Arrastra: mover · Shift+arrastra: snap"
      style={wrapperStyle}
    >
      <span style={{
        ...textStyle,
        display: 'inline-block',
        opacity: isEmpty ? 0.45 : 1,
        background: hover && !dragging ? 'rgba(10,191,188,.06)' : 'transparent',
        borderRadius: 2,
        padding: '0 2px',
        pointerEvents: 'none',
      }}>
        {value || placeholder}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <ElementPanel> — panel lateral unificado
   Recibe el "elemento seleccionado" abstracto y muestra los
   controles apropiados. Mismo panel para built-in y custom.
═════════════════════════════════════════════════════════════ */
function ElementPanel({
  selection,         // { kind: 'builtin'|'custom', id, data }
  design,
  onUpdateDesign,    // (key, value)
  onUpdateCustom,    // (id, partialProps)
  onDeleteCustom,    // (id)
  onHideBuiltin,     // (id) — oculta un built-in
  onClose,
}) {
  if (!selection) return null;

  const isCustom = selection.kind === 'custom';
  const meta = !isCustom ? FIELD_META[selection.id] : null;

  // Lee/escribe propiedades en abstracto
  const get = (prop) => {
    if (isCustom) return selection.data[prop];
    switch (prop) {
      case 'color':    return meta.colorKey ? design[meta.colorKey] : '#000000';
      case 'color2':   return meta.colorKey2 ? design[meta.colorKey2] : null;
      case 'fontSize': return design[meta.sizeKey];
      case 'rotation': {
        const pos = design.positions?.[selection.id] || DEFAULT_POSITIONS[selection.id] || {};
        return pos.rotation !== undefined ? pos.rotation : (pos.rotated ? -90 : 0);
      }
      case 'value':    return design[meta.valueKey];
      default: return null;
    }
  };

  const set = (prop, val) => {
    if (isCustom) {
      onUpdateCustom(selection.id, { [prop]: val });
      return;
    }
    switch (prop) {
      case 'color':    if (meta.colorKey)  onUpdateDesign(meta.colorKey, val);  break;
      case 'color2':   if (meta.colorKey2) onUpdateDesign(meta.colorKey2, val); break;
      case 'fontSize': onUpdateDesign(meta.sizeKey, Number(val)); break;
      case 'rotation': {
        const positions = design.positions || {};
        const cur = positions[selection.id] || DEFAULT_POSITIONS[selection.id] || { x:0, y:0 };
        onUpdateDesign('positions', {
          ...positions,
          [selection.id]: { ...cur, rotation: Number(val) },
        });
        break;
      }
      case 'value':    onUpdateDesign(meta.valueKey, val); break;
      default: break;
    }
  };

  // Configuración de qué controles mostrar
  const showColor    = isCustom ? true  : meta.colorKey !== null;
  const showColor2   = !isCustom && meta.colorKey2;
  const showFontFam  = isCustom ? true  : false; // built-in tiene fuentes fijas
  const showWeight   = isCustom ? true  : false;
  const showItalic   = isCustom ? true  : false;
  const isMultiline  = isCustom ? false : meta.multiline;

  const title = isCustom ? 'Texto personalizado' : meta.label;

  // ── Estilos ──
  const labelStyle = {
    display: 'block', fontSize: 11, color: '#666',
    fontWeight: 600, marginBottom: 4, letterSpacing: .3,
    textTransform: 'uppercase',
  };
  const inputStyle = {
    width: '100%', padding: '7px 9px',
    border: '1px solid #ddd', borderRadius: 5,
    fontSize: 13, fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      width: 280,
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
      alignSelf: 'flex-start',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #0abfbc 0%, #089a98 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{isCustom ? '✨' : '🎯'}</span>
          <strong style={{ fontSize: 13, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </strong>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer',
            width: 24, height: 24, borderRadius: 4,
            fontSize: 16, lineHeight: 1, padding: 0,
          }}
          title="Cerrar">×</button>
      </div>

      {/* Body */}
      <div style={{ padding: 14 }}>

        {/* Texto (solo si tiene valueKey o es custom) */}
        {(isCustom || (meta.valueKey && !meta.valueKey.startsWith('_label_'))) && (
          <>
            <label style={labelStyle}>📝 Texto</label>
            {isMultiline ? (
              <textarea
                value={isCustom ? selection.data.value : (get('value') || '')}
                onChange={e => isCustom
                  ? onUpdateCustom(selection.id, { value: e.target.value })
                  : set('value', e.target.value)}
                rows={2}
                style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' }}
              />
            ) : (
              <input
                type="text"
                value={isCustom ? selection.data.value : (get('value') || '')}
                onChange={e => isCustom
                  ? onUpdateCustom(selection.id, { value: e.target.value })
                  : set('value', e.target.value)}
                style={{ ...inputStyle, marginBottom: 12 }}
              />
            )}
          </>
        )}

        {/* Tamaño */}
        <label style={labelStyle}>📏 Tamaño ({isCustom ? selection.data.fontSize : get('fontSize')} pt)</label>
        <input
          type="range" min={6} max={120} step={1}
          value={isCustom ? selection.data.fontSize : get('fontSize')}
          onChange={e => isCustom
            ? onUpdateCustom(selection.id, { fontSize: Number(e.target.value) })
            : set('fontSize', e.target.value)}
          style={{ width: '100%', marginBottom: 4 }}
        />
        <input
          type="number" min={6} max={120}
          value={isCustom ? selection.data.fontSize : get('fontSize')}
          onChange={e => isCustom
            ? onUpdateCustom(selection.id, { fontSize: Number(e.target.value) })
            : set('fontSize', e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        {/* Color */}
        {showColor && (
          <>
            <label style={labelStyle}>
              🎨 {showColor2 ? 'Color superior (gradiente)' : 'Color'}
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: showColor2 ? 8 : 12 }}>
              <input
                type="color"
                value={isCustom ? selection.data.color : (get('color') || '#000')}
                onChange={e => isCustom
                  ? onUpdateCustom(selection.id, { color: e.target.value })
                  : set('color', e.target.value)}
                style={{ width: 44, height: 34, border: '1px solid #ddd',
                  borderRadius: 5, cursor: 'pointer', padding: 2, flexShrink: 0 }}
              />
              <input
                type="text"
                value={isCustom ? selection.data.color : (get('color') || '')}
                onChange={e => isCustom
                  ? onUpdateCustom(selection.id, { color: e.target.value })
                  : set('color', e.target.value)}
                style={{ ...inputStyle }}
              />
            </div>
          </>
        )}

        {/* Color 2 (solo gradiente premioNum) */}
        {showColor2 && (
          <>
            <label style={labelStyle}>🎨 Color inferior (gradiente)</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input
                type="color"
                value={get('color2') || '#000'}
                onChange={e => set('color2', e.target.value)}
                style={{ width: 44, height: 34, border: '1px solid #ddd',
                  borderRadius: 5, cursor: 'pointer', padding: 2, flexShrink: 0 }}
              />
              <input
                type="text"
                value={get('color2') || ''}
                onChange={e => set('color2', e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {/* Peso (solo custom) */}
        {showWeight && (
          <>
            <label style={labelStyle}>💪 Peso</label>
            <select
              value={selection.data.fontWeight}
              onChange={e => onUpdateCustom(selection.id, { fontWeight: Number(e.target.value) })}
              style={{ ...inputStyle, marginBottom: 10 }}
            >
              <option value={300}>Light (300)</option>
              <option value={400}>Normal (400)</option>
              <option value={600}>Semi-Bold (600)</option>
              <option value={700}>Bold (700)</option>
              <option value={900}>Black (900)</option>
            </select>
          </>
        )}

        {/* Itálica + Negrita rápida (solo custom) */}
        {showItalic && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => onUpdateCustom(selection.id, {
                fontWeight: selection.data.fontWeight >= 700 ? 400 : 700
              })}
              style={{
                flex: 1, padding: '8px',
                background: selection.data.fontWeight >= 700 ? '#0abfbc' : '#f5f5f5',
                color: selection.data.fontWeight >= 700 ? '#fff' : '#333',
                border: '1px solid #ddd', borderRadius: 5,
                cursor: 'pointer', fontSize: 14, fontWeight: 900,
                fontFamily: 'inherit',
              }}>B</button>
            <button
              onClick={() => onUpdateCustom(selection.id, {
                fontStyle: selection.data.fontStyle === 'italic' ? 'normal' : 'italic'
              })}
              style={{
                flex: 1, padding: '8px',
                background: selection.data.fontStyle === 'italic' ? '#0abfbc' : '#f5f5f5',
                color: selection.data.fontStyle === 'italic' ? '#fff' : '#333',
                border: '1px solid #ddd', borderRadius: 5,
                cursor: 'pointer', fontSize: 14, fontStyle: 'italic',
                fontFamily: 'Georgia, serif', fontWeight: 700,
              }}>I</button>
          </div>
        )}

        {/* Fuente (solo custom) */}
        {showFontFam && (
          <>
            <label style={labelStyle}>🔤 Fuente</label>
            <select
              value={selection.data.fontFamily}
              onChange={e => onUpdateCustom(selection.id, { fontFamily: e.target.value })}
              style={{ ...inputStyle, marginBottom: 12 }}
            >
              {FUENTES.map(f => (
                <option key={f.val} value={f.val}
                  style={{ fontFamily: f.val }}>{f.label}</option>
              ))}
            </select>
          </>
        )}

        {/* Rotación */}
        <label style={labelStyle}>
          🔄 Rotación: {isCustom ? selection.data.rotation : get('rotation')}°
        </label>
        <input
          type="range" min={-180} max={180} step={5}
          value={isCustom ? selection.data.rotation : get('rotation')}
          onChange={e => isCustom
            ? onUpdateCustom(selection.id, { rotation: Number(e.target.value) })
            : set('rotation', e.target.value)}
          style={{ width: '100%', marginBottom: 6 }}
        />
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[0, -90, 90, 180].map(deg => (
            <button
              key={deg}
              onClick={() => isCustom
                ? onUpdateCustom(selection.id, { rotation: deg })
                : set('rotation', deg)}
              style={{ flex: 1, fontSize: 11, padding: '5px',
                border: '1px solid #ddd', borderRadius: 4,
                background: '#fff', cursor: 'pointer',
                fontFamily: 'inherit' }}>{deg}°</button>
          ))}
        </div>

        {/* Borrar custom / Ocultar built-in */}
        {isCustom ? (
          <button
            onClick={() => onDeleteCustom(selection.id)}
            style={{
              width: '100%', padding: '10px',
              background: '#fff', color: '#d92626',
              border: '1.5px solid #d92626', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', marginTop: 4,
            }}>🗑 Eliminar este texto</button>
        ) : (
          <button
            onClick={() => onHideBuiltin(selection.id)}
            style={{
              width: '100%', padding: '10px',
              background: '#fff', color: '#d92626',
              border: '1.5px solid #d92626', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', marginTop: 4,
            }}
            title="Lo ocultas del ticket. Podrás restaurarlo desde la barra superior."
          >🙈 Ocultar este texto</button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <PaletasPanel> — paletas globales (opcional)
═════════════════════════════════════════════════════════════ */
function PaletasPanel({ design, onApply, onClose }) {
  return (
    <div style={{
      width: 280,
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.10)',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
      alignSelf: 'flex-start',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', padding: '12px 14px',
        background: 'linear-gradient(135deg, #f0a500 0%, #d68f00 100%)',
        color: '#fff',
      }}>
        <strong style={{ fontSize: 13 }}>🎨 Paletas globales</strong>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', cursor: 'pointer', width: 24, height: 24,
            borderRadius: 4, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ padding: 14 }}>
        <p style={{ fontSize: 12, color: '#666', marginTop: 0, marginBottom: 12 }}>
          Aplica un set de colores a TODO el ticket de una vez.
        </p>
        {PALETAS.map(p => (
          <button
            key={p.id}
            onClick={() => onApply(p.colors)}
            style={{
              display: 'flex', width: '100%', alignItems: 'center',
              gap: 10, padding: '8px 10px',
              background: '#fff', border: '1px solid #e0e0e0',
              borderRadius: 6, cursor: 'pointer', marginBottom: 6,
              fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
              transition: 'background .12s, border-color .12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f0fbfb';
              e.currentTarget.style.borderColor = '#0abfbc';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            <div style={{ display: 'flex', gap: 2 }}>
              {[p.colors.colorPremio1, p.colors.colorPremio2, p.colors.colorSlogan].map((c,i) => (
                <div key={i} style={{ width: 14, height: 18,
                  background: c, borderRadius: 2, border: '1px solid rgba(0,0,0,.1)' }} />
              ))}
            </div>
            <span style={{ fontWeight: 600 }}>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <TicketEditable>
═════════════════════════════════════════════════════════════ */
export default function TicketEditable({ r, numero, design, onUpdate }) {
  // Aplica factor global a los tamaños si está activo
  const globalSizeFactor = design?.globalSizeFactor || 1.0;
  const baseDesign = { ...DEFAULT_DESIGN, ...(design || {}) };

  // D contiene tamaños YA escalados por factor global
  const D = { ...baseDesign };
  if (globalSizeFactor !== 1.0) {
    Object.keys(D).forEach(k => {
      if (k.startsWith('size') && typeof D[k] === 'number') {
        D[k] = D[k] * globalSizeFactor;
      }
    });
  }

  const positions = baseDesign.positions || {};
  const customTexts = baseDesign.customTexts || [];
  const hiddenFields = baseDesign.hiddenFields || [];

  // ── Defaults de la rifa ──
  const { numero: premioNumRifa, texto: premioTxtRifa } = splitPremio(r?.premio);
  const fechaRifa     = fmtFechaLoteria(r?.fecha_sorteo);
  const horaRifa      = D.horaSort?.trim() || fmtHora12(r?.hora_sorteo) || '';
  const valorRifa     = fmtValorBoleto(r?.precio);
  const subPremioRifa = r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const numBoletoRifa = numero || '000';
  const loteriaRifa   = r?.loteria_ref
    ? `${r.loteria_ref}${horaRifa ? ` ${horaRifa}` : ''}`
    : D.loteriaText;

  const numBoleto    = resolveValue(D, 'numBoleto',    numBoletoRifa);
  const premioNum    = resolveValue(D, 'premioNum',    premioNumRifa || '500');
  const premioTexto  = resolveValue(D, 'premioTexto',  premioTxtRifa);
  const fechaTexto   = resolveValue(D, 'fechaTexto',   fechaRifa);
  const loteriaTxt   = resolveValue(D, 'loteriaTexto', loteriaRifa);
  const valorTexto   = resolveValue(D, 'valorTexto',   valorRifa);
  const subPremioTxt = resolveValue(D, 'subPremioNum', subPremioRifa);

  // ── Responsive ──
  const [containerRef, containerWidth] = useContainerWidth();
  // El layout entero (ticket + panel) necesita ~640px de ancho.
  // Si el contenedor es más chico, escalamos solo el ticket.
  const PANEL_GAP = 16;
  const PANEL_W   = 280;
  const ticketAvail = containerWidth > (D.ticketWidth + PANEL_W + PANEL_GAP + 32)
    ? D.ticketWidth
    : Math.max(280, containerWidth - PANEL_W - PANEL_GAP - 32);

  // Si no hay espacio para el panel al lado, el panel va abajo
  const panelBelow = containerWidth > 0 && containerWidth < (D.ticketWidth + PANEL_W + PANEL_GAP + 32);
  const ticketScale = panelBelow
    ? Math.min(1, containerWidth / D.ticketWidth)
    : Math.min(1, ticketAvail / D.ticketWidth);

  // ── Selección ──
  // selection = { kind: 'builtin'|'custom', id, data? }
  const [selection, setSelection] = useState(null);
  const [showPaletas, setShowPaletas] = useState(false);
  const [showHiddenMenu, setShowHiddenMenu] = useState(false);

  // ── Recalcula selection.data cuando design cambia (para mantener el panel sincronizado) ──
  useEffect(() => {
    if (selection?.kind === 'custom') {
      const updated = customTexts.find(t => t.id === selection.id);
      if (updated && updated !== selection.data) {
        setSelection({ kind: 'custom', id: selection.id, data: updated });
      } else if (!updated) {
        setSelection(null); // se borró
      }
    }
  }, [customTexts]);

  // ── Mover built-in ──
  const handleMoveBuiltin = useCallback((campo, newPos) => {
    const def = DEFAULT_POSITIONS[campo] || {};
    const cur = positions[campo] || {};
    onUpdate('positions', {
      ...positions,
      [campo]: {
        ...def,    // preserva 'rotated' default
        ...cur,    // preserva 'rotation' custom previo
        x: newPos.x, y: newPos.y,
      },
    });
  }, [positions, onUpdate]);

  // ── Mover custom ──
  const handleMoveCustom = useCallback((id, newPos) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, x: newPos.x, y: newPos.y } : t
    ));
  }, [customTexts, onUpdate]);

  // ── Editar valor de custom ──
  const handleChangeCustomValue = useCallback((id, newValue) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, value: newValue } : t
    ));
  }, [customTexts, onUpdate]);

  // ── Update parcial de custom (desde el panel) ──
  const handleUpdateCustomProps = useCallback((id, partial) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, ...partial } : t
    ));
  }, [customTexts, onUpdate]);

  // ── Agregar texto ──
  const handleAddText = () => {
    const newId = `custom_${Date.now()}`;
    const nuevoTexto = {
      id: newId,
      value: 'Texto nuevo',
      x: Math.round(D.ticketWidth / 2 - 60),
      y: Math.round(D.ticketHeight / 2),
      fontSize: 14,
      fontWeight: 700,
      color: '#000000',
      fontStyle: 'normal',
      fontFamily: "'Poppins', sans-serif",
      rotation: 0,
    };
    onUpdate('customTexts', [...customTexts, nuevoTexto]);
    setSelection({ kind: 'custom', id: newId, data: nuevoTexto });
    setShowPaletas(false);
  };

  // ── Borrar custom ──
  const handleDeleteCustom = (id) => {
    onUpdate('customTexts', customTexts.filter(t => t.id !== id));
    if (selection?.id === id) setSelection(null);
  };

  // ── Ocultar built-in ──
  const handleHideBuiltin = (id) => {
    if (hiddenFields.includes(id)) return;
    onUpdate('hiddenFields', [...hiddenFields, id]);
    if (selection?.id === id) setSelection(null);
  };

  // ── Restaurar built-in oculto ──
  const handleRestoreBuiltin = (id) => {
    onUpdate('hiddenFields', hiddenFields.filter(f => f !== id));
  };

  // ── Restaurar TODOS los ocultos ──
  const handleRestoreAll = () => {
    onUpdate('hiddenFields', []);
  };

  // ── Reset posiciones ──
  const handleResetPositions = () => {
    if (window.confirm('¿Restaurar las posiciones al diseño original? (los textos custom no se borran)')) {
      onUpdate('positions', {});
      setSelection(null);
    }
  };

  // ── Aplicar paleta ──
  const handleApplyPaleta = (colors) => {
    Object.entries(colors).forEach(([k, v]) => onUpdate(k, v));
    setShowPaletas(false);
  };

  // ── Click en canvas vacío: deseleccionar ──
  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      setSelection(null);
      setShowPaletas(false);
      setShowHiddenMenu(false);
    }
  };

  // ── Selección desde un elemento ──
  const handleSelect = useCallback((id) => {
    if (id.startsWith('custom_')) {
      const data = customTexts.find(t => t.id === id);
      if (data) setSelection({ kind: 'custom', id, data });
    } else {
      setSelection({ kind: 'builtin', id });
    }
    setShowPaletas(false);
  }, [customTexts]);

  // ── px helper para tamaños YA escalados por globalSizeFactor ──
  const pxScaled = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);

  // ── Obtener rotación efectiva de un built-in ──
  const getRotation = (campo) => {
    const pos = positions[campo] || DEFAULT_POSITIONS[campo] || {};
    if (pos.rotation !== undefined) return pos.rotation;
    return pos.rotated ? -90 : 0;
  };

  const STROKE = D.colorBorde;

  // Helper para built-in (null si está oculto)
  const F = (campo, value, onChangeKey, textStyle, opts = {}) => {
    if (hiddenFields.includes(campo)) return null;
    return (
      <DraggableEditable
        key={campo}
        id={campo}
        position={getPos(positions, campo)}
        rotation={getRotation(campo)}
        onMove={handleMoveBuiltin}
        value={value}
        onChange={v => onUpdate(onChangeKey, v)}
        textStyle={textStyle}
        scale={ticketScale}
        multiline={opts.multiline}
        placeholder={opts.placeholder}
        selected={selection?.id === campo}
        onSelect={handleSelect}
      />
    );
  };

  return (
    <div style={{ width: '100%' }} ref={containerRef}>

      {/* ═══ Barra superior: Tamaño global + Paletas + Agregar + Reset ═══ */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 14,
        padding: '10px 14px',
        background: '#f8fafa',
        border: '1px solid #e0e8e8',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
      }}>
        <span style={{ fontWeight: 600, color: '#333' }}>Tamaño global:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TAMANOS_GLOBALES.map(t => (
            <button
              key={t.label}
              onClick={() => onUpdate('globalSizeFactor', t.factor)}
              style={{
                padding: '6px 12px',
                background: globalSizeFactor === t.factor ? '#0abfbc' : '#fff',
                color: globalSizeFactor === t.factor ? '#fff' : '#333',
                border: '1px solid ' + (globalSizeFactor === t.factor ? '#0abfbc' : '#ddd'),
                borderRadius: 5, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 12 }} />

        {/* Botón "Ocultos" con dropdown — solo si hay alguno */}
        {hiddenFields.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowHiddenMenu(v => !v)}
              style={{
                padding: '7px 14px',
                background: showHiddenMenu ? '#7c3aed' : '#fff',
                color: showHiddenMenu ? '#fff' : '#7c3aed',
                border: '1.5px solid #7c3aed', borderRadius: 6,
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              title="Elementos ocultos del ticket"
            >
              🙈 Ocultos
              <span style={{
                background: showHiddenMenu ? '#fff' : '#7c3aed',
                color: showHiddenMenu ? '#7c3aed' : '#fff',
                borderRadius: 10, padding: '1px 7px',
                fontSize: 11, fontWeight: 800,
                minWidth: 18, textAlign: 'center',
              }}>{hiddenFields.length}</span>
            </button>

            {showHiddenMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 260,
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                boxShadow: '0 6px 24px rgba(0,0,0,.12)',
                zIndex: 5000,
                padding: 10,
                fontFamily: 'system-ui, sans-serif',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                  paddingBottom: 8, borderBottom: '1px solid #eee',
                }}>
                  <strong style={{ fontSize: 12, color: '#333' }}>
                    Restaurar elementos
                  </strong>
                  <button
                    onClick={() => { handleRestoreAll(); setShowHiddenMenu(false); }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: '#0abfbc', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      fontFamily: 'inherit', padding: 0,
                    }}
                    title="Restaurar todos">Restaurar todos</button>
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {hiddenFields.map(id => {
                    const meta = FIELD_META[id];
                    return (
                      <button
                        key={id}
                        onClick={() => handleRestoreBuiltin(id)}
                        style={{
                          display: 'flex', width: '100%',
                          alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: '#fff', border: '1px solid #eee',
                          borderRadius: 5, marginBottom: 4,
                          cursor: 'pointer', fontSize: 12,
                          fontFamily: 'inherit', textAlign: 'left',
                          color: '#333',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#f0fbfb';
                          e.currentTarget.style.borderColor = '#0abfbc';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.borderColor = '#eee';
                        }}
                      >
                        <span>{meta?.label || id}</span>
                        <span style={{ color: '#0abfbc', fontWeight: 700 }}>↶ Mostrar</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => { setShowPaletas(true); setSelection(null); }}
          style={{
            padding: '7px 14px',
            background: '#fff', color: '#f0a500',
            border: '1.5px solid #f0a500', borderRadius: 6,
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit',
          }}>🎨 Paletas</button>
        <button
          onClick={handleAddText}
          style={{
            padding: '7px 16px',
            background: '#0abfbc', border: '1.5px solid #0abfbc',
            color: '#fff', borderRadius: 6,
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit',
            boxShadow: '0 1px 3px rgba(10,191,188,.3)',
          }}>+ Agregar texto</button>
        <button
          onClick={handleResetPositions}
          style={{
            padding: '7px 14px',
            background: '#fff', color: '#d92626',
            border: '1.5px solid #d92626', borderRadius: 6,
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit',
          }}>↺ Reset posiciones</button>
      </div>

      {/* ═══ Layout principal: ticket + panel ═══ */}
      <div style={{
        display: 'flex',
        gap: PANEL_GAP,
        flexDirection: panelBelow ? 'column' : 'row',
        alignItems: 'flex-start',
      }}>

        {/* ── Wrapper del ticket (responsive) ── */}
        <div style={{
          flex: panelBelow ? 'none' : '0 0 auto',
          width: panelBelow ? '100%' : D.ticketWidth * ticketScale,
          height: D.ticketHeight * ticketScale,
          position: 'relative',
        }}>
          {/* CANVAS */}
          <div
            onMouseDown={handleCanvasMouseDown}
            style={{
              width: D.ticketWidth,
              height: D.ticketHeight,
              fontFamily: "'Poppins','Arial Black',sans-serif",
              background: D.bgPaper,
              border: `2.5px solid ${STROKE}`,
              position: 'relative',
              overflow: 'hidden',
              transform: ticketScale < 1 ? `scale(${ticketScale})` : 'none',
              transformOrigin: 'top left',
              boxSizing: 'border-box',
            }}
          >
            {/* Líneas decorativas fijas */}
            <div style={{ position: 'absolute', left: 115, top: 0, bottom: 0,
              borderLeft: `2px dashed ${STROKE}`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 137, top: 0, bottom: 0,
              borderLeft: `1px solid ${STROKE}`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 145, right: 10,
              bottom: 50, height: 0,
              borderTop: `1px dashed ${STROKE}40`, pointerEvents: 'none' }} />

            {/* Built-in fields */}
            {F('numBoletoIzq', numBoleto, 'numBoleto', {
              border: `2px solid ${STROKE}`, padding: '6px 12px',
              fontSize: pxScaled(D.sizeNumTalon), fontWeight: 900,
              color: D.colorTalon, letterSpacing: 2, background: '#fff',
            })}
            {F('nombreLabel', 'NOMBRE:', '_label_NOMBRE', {
              fontSize: pxScaled(D.sizeNombre), fontWeight: 700, color: '#000',
            })}
            {F('telLabel', 'Tel:', '_label_Tel', {
              fontSize: Math.max(8, pxScaled(D.sizeNombre) - 4),
              color: '#666', letterSpacing: .5,
            })}
            {F('brandText', D.brandText, 'brandText', {
              fontSize: pxScaled(D.sizeBrand), fontWeight: 900,
              color: D.colorTalon, letterSpacing: 4, fontStyle: 'italic',
            })}
            {F('talonText', D.talonText, 'talonText', {
              fontSize: pxScaled(D.sizeTalonText), fontWeight: 800,
              color: '#000', letterSpacing: 2,
            })}

            {F('sloganTop', D.sloganTop, 'sloganTop', {
              fontSize: pxScaled(D.sizeSlogan), fontWeight: 900,
              color: D.colorSlogan, letterSpacing: 1,
              textTransform: 'uppercase',
              WebkitTextStroke: `.5px ${STROKE}`,
              textShadow: '1px 1px 0 rgba(0,0,0,.15)',
              lineHeight: 1,
            })}
            {F('fechaPrefix', D.fechaPrefix, 'fechaPrefix', {
              fontSize: pxScaled(D.sizeFecha), fontWeight: 800,
              color: D.colorFecha, fontStyle: 'italic', letterSpacing: .5,
            })}
            {F('fechaTexto', fechaTexto, 'fechaTexto', {
              fontSize: pxScaled(D.sizeFecha), fontWeight: 800,
              color: D.colorFecha, fontStyle: 'italic', letterSpacing: .5,
            })}
            {F('numBoletoDer', numBoleto, 'numBoleto', {
              border: `2px solid ${STROKE}`, padding: '6px 14px',
              fontSize: pxScaled(D.sizeNumDer), fontWeight: 900,
              color: D.colorTalon, letterSpacing: 2, background: '#fff',
            })}

            {F('premioLabel', D.premioLabel, 'premioLabel', {
              fontSize: pxScaled(D.sizePremioLabel), fontWeight: 800,
              fontStyle: 'italic', color: D.colorPremio1,
              letterSpacing: .5, lineHeight: 1,
              textShadow: `2px 2px 0 ${STROKE}`,
            })}
            {F('premioNum', premioNum, 'premioNum', {
              fontFamily: "'Arial Black','Poppins',sans-serif",
              fontWeight: 900, fontSize: pxScaled(D.sizePremioNum),
              lineHeight: .85, letterSpacing: 2,
              background: `linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              WebkitTextStroke: `2.5px ${STROKE}`,
              filter: `drop-shadow(3px 3px 0 ${STROKE}30)`,
            })}
            {F('premioTexto', premioTexto, 'premioTexto', {
              fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
              fontSize: pxScaled(D.sizePremioTxt), fontWeight: 700,
              color: D.colorDolares, fontStyle: 'italic', lineHeight: 1,
              textShadow: `2px 2px 0 ${STROKE}40`,
            }, { placeholder: '(tipo)' })}
            {F('subPremioPrefix', D.subPremioPrefix, 'subPremioPrefix', {
              fontSize: pxScaled(D.sizeSubPremio), fontWeight: 900,
              color: D.colorSubPremio, fontStyle: 'italic',
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            })}
            {F('subPremioNum', subPremioTxt, 'subPremioNum', {
              fontSize: pxScaled(D.sizeSubPremio), fontWeight: 900,
              color: D.colorSubPremio, fontStyle: 'italic',
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            }, { placeholder: '(monto)' })}
            {F('subPremioMoneda', D.subPremioMoneda, 'subPremioMoneda', {
              fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
              fontSize: pxScaled(D.sizeSubMoneda), fontWeight: 700,
              color: D.colorPesosSub, fontStyle: 'italic',
              textShadow: `1px 1px 0 ${STROKE}40`,
            })}

            {F('caducaText', D.caducaText, 'caducaText', {
              fontSize: pxScaled(D.sizeCaduca), fontWeight: 700,
              color: D.colorCaduca, letterSpacing: .5, fontStyle: 'italic',
            })}
            {F('loteriaTexto', loteriaTxt, 'loteriaTexto', {
              fontSize: pxScaled(D.sizeLoteria), fontWeight: 700,
              color: D.colorLoteria, lineHeight: 1.15, fontStyle: 'italic',
            })}

            {F('motivacionalText', D.motivacionalText, 'motivacionalText', {
              fontSize: pxScaled(D.sizeMotivac), fontWeight: 600,
              color: D.colorMotivac, fontStyle: 'italic',
              lineHeight: 1.2, maxWidth: 380, whiteSpace: 'normal',
            }, { multiline: true })}
            {F('boletoLabel', D.boletoLabel, 'boletoLabel', {
              fontSize: pxScaled(D.sizeBoleto), fontWeight: 900,
              color: D.colorBoleto, letterSpacing: 1,
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            })}
            {F('valorTexto', valorTexto, 'valorTexto', {
              fontSize: pxScaled(D.sizeValor), fontWeight: 900,
              color: D.colorValor, fontStyle: 'italic', lineHeight: 1,
              textShadow: `2px 2px 0 ${STROKE}40`,
            })}
            {F('valorSufijo', D.valorSufijo, 'valorSufijo', {
              fontSize: pxScaled(D.sizePesos), fontWeight: 900,
              color: D.colorPesos, letterSpacing: .5,
              textShadow: `1.5px 1.5px 0 ${STROKE}40`,
            })}

            {D.footerText !== '' && F('footerText', D.footerText, 'footerText', {
              fontSize: pxScaled(D.sizeFooter), color: '#999', letterSpacing: .5,
            })}

            {/* Custom texts */}
            {customTexts.map(t => (
              <DraggableEditable
                key={t.id}
                id={t.id}
                position={{ x: t.x, y: t.y }}
                rotation={t.rotation || 0}
                onMove={handleMoveCustom}
                value={t.value}
                onChange={v => handleChangeCustomValue(t.id, v)}
                textStyle={{
                  fontSize: pxScaled(t.fontSize),
                  fontWeight: t.fontWeight,
                  color: t.color,
                  fontStyle: t.fontStyle,
                  fontFamily: t.fontFamily,
                }}
                scale={ticketScale}
                selected={selection?.id === t.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        {/* ── Panel lateral ── */}
        <div style={{ flex: panelBelow ? 'none' : '0 0 auto', width: panelBelow ? '100%' : PANEL_W }}>
          {showPaletas ? (
            <PaletasPanel
              design={baseDesign}
              onApply={handleApplyPaleta}
              onClose={() => setShowPaletas(false)}
            />
          ) : selection ? (
            <ElementPanel
              selection={selection}
              design={baseDesign}
              onUpdateDesign={onUpdate}
              onUpdateCustom={handleUpdateCustomProps}
              onDeleteCustom={handleDeleteCustom}
              onHideBuiltin={handleHideBuiltin}
              onClose={() => setSelection(null)}
            />
          ) : (
            <div style={{
              padding: '24px 18px',
              background: '#f8fafa',
              border: '1px dashed #c0d0d0',
              borderRadius: 10,
              textAlign: 'center',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 13, color: '#666',
              lineHeight: 1.55,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
              <strong style={{ color: '#333', display: 'block', marginBottom: 6 }}>
                Selecciona un texto
              </strong>
              <p style={{ margin: 0, fontSize: 12 }}>
                Click en cualquier texto del ticket para editarlo<br/>
                <span style={{ color: '#999' }}>Arrastra para moverlo · Shift+arrastra para snap a grid</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}