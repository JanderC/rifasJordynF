// ════════════════════════════════════════════════════════════════
//   components/TicketEditable.js
//   RIFAS JORDYN — Editor estilo Canva
//
//   ▸ Click corto = editar texto · Drag = mover · Shift+drag = snap a grid
//   ▸ Drag FLUIDO sin soltarse (closure estable via latestRef)
//   ▸ Botón "+ Agregar texto" para crear elementos custom
//   ▸ Panel lateral flotante al seleccionar: color, tamaño, peso,
//     itálica, fuente, rotación, borrar
//   ▸ Todo persiste en design.positions y design.customTexts
//
//   Modelo de datos:
//     design.positions: { campoId: { x, y, rotated? } }
//     design.customTexts: [
//       { id, value, x, y, fontSize(pt), fontWeight, color,
//         fontStyle, fontFamily, rotation }
//     ]
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { DEFAULT_DESIGN } from './Ticket';

// ── Constantes ──────────────────────────────────────────
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);
const DRAG_THRESHOLD = 5;
const SNAP_GRID = 10;

// ── Posiciones default (medidas del layout flex original) ──
const DEFAULT_POSITIONS = {
  // Talón izquierdo (ancho 115px, hasta x=137)
  numBoletoIzq:    { x: 18,  y: 12 },
  nombreLabel:     { x: 10,  y: 70 },
  telLabel:        { x: 10,  y: 300 },
  brandText:       { x: 95,  y: 100, rotated: true },   // vertical
  talonText:       { x: 132, y: 220, rotated: true },   // vertical

  // Cuerpo: cabecera
  sloganTop:       { x: 155, y: 14 },
  fechaPrefix:     { x: 155, y: 50 },
  fechaTexto:      { x: 235, y: 50 },
  numBoletoDer:    { x: 685, y: 12 },

  // Premio
  premioLabel:     { x: 250, y: 90 },
  premioNum:       { x: 180, y: 115 },
  premioTexto:     { x: 380, y: 195 },
  subPremioPrefix: { x: 200, y: 230 },
  subPremioNum:    { x: 230, y: 230 },
  subPremioMoneda: { x: 380, y: 232 },

  // Lateral derecho
  caducaText:      { x: 730, y: 100, rotated: true },
  loteriaTexto:    { x: 560, y: 200 },

  // Fila inferior
  motivacionalText:{ x: 155, y: 275 },
  boletoLabel:     { x: 600, y: 245 },
  valorTexto:      { x: 560, y: 275 },
  valorSufijo:     { x: 720, y: 295 },

  footerText:      { x: 220, y: 320 },
};

// ── Helpers de formateo ─────────────────────────────────
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

// ── Hook: ancho del contenedor ──────────────────────────
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

// ── Hook: mantiene un ref siempre actualizado al último valor ──
// Patrón "latest ref" que permite que un callback estable lea
// valores actualizados sin recrearse.
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
   FIX clave: handlers globales se registran UNA VEZ en mousedown
   y leen position/scale/onMove vía refs latest. No depende del
   useCallback regenerándose, no se suelta a mitad de arrastre.
═════════════════════════════════════════════════════════════ */
function DraggableEditable({
  id,                  // identificador único para selección
  position,            // { x, y, rotated? }
  onMove,              // (id, {x,y}) => void
  value,
  onChange,            // (newValue) => void
  textStyle,
  scale = 1,
  multiline = false,
  placeholder = '(click)',
  selected = false,
  onSelect,            // (id) => void
  onRequestDelete,     // opcional, para textos custom
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value || '');
  const [hover, setHover]       = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // Refs "latest" — leen siempre el valor actual sin invalidar el closure
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

  // ── Drag start: registra listeners globales con closure ESTABLE ──
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

      if (!started) {
        // Click corto: seleccionar + abrir editor
        if (onSelect) onSelect(idRef.current);
        setEditing(true);
      } else {
        // Drag: solo seleccionar (no abre editor)
        if (onSelect) onSelect(idRef.current);
      }
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

  const rotation = position.rotation || (position.rotated ? -90 : 0);

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
    outline: editing || dragging
      ? '2px solid #0abfbc'
      : selected
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
      {/* Botón borrar (solo en custom seleccionado) */}
      {selected && onRequestDelete && !dragging && (
        <button
          onMouseDown={e => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); onRequestDelete(id); }}
          style={{
            position: 'absolute', top: -12, left: -12,
            width: 22, height: 22, borderRadius: '50%',
            background: '#d92626', color: '#fff',
            border: '2px solid #fff', cursor: 'pointer',
            fontSize: 12, lineHeight: '1', padding: 0,
            fontFamily: 'system-ui, sans-serif', fontWeight: 700,
            transform: rotation ? `rotate(${-rotation}deg)` : 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,.2)',
          }}
          title="Eliminar texto">×</button>
      )}
      {hover && !dragging && !selected && (
        <span style={{
          position: 'absolute', top: -10, right: -12,
          background: '#0abfbc', color: '#fff',
          fontSize: 10, lineHeight: 1, padding: '2px 4px',
          borderRadius: 3, pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif', fontWeight: 600,
          whiteSpace: 'nowrap',
          transform: rotation ? `rotate(${-rotation}deg)` : 'none',
        }}>✎ ✥</span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <CustomTextPanel> — panel flotante para editar propiedades
   del texto custom seleccionado. Tipo Canva.
═════════════════════════════════════════════════════════════ */
function CustomTextPanel({ text, onChange, onDelete, onClose }) {
  if (!text) return null;

  const update = (prop) => (e) => {
    const val = e.target ? e.target.value : e;
    onChange({ ...text, [prop]: val });
  };
  const updateNumber = (prop) => (e) => {
    onChange({ ...text, [prop]: Number(e.target.value) });
  };

  const FUENTES = [
    { label: 'Poppins',         val: "'Poppins', sans-serif" },
    { label: 'Arial Black',     val: "'Arial Black', sans-serif" },
    { label: 'Brush Script',    val: "'Brush Script MT', cursive" },
    { label: 'Georgia',         val: "'Georgia', serif" },
    { label: 'Courier',         val: "'Courier New', monospace" },
    { label: 'Impact',          val: "'Impact', sans-serif" },
  ];

  const labelStyle = {
    display: 'block', fontSize: 11, color: '#666',
    fontWeight: 600, marginBottom: 4, letterSpacing: .3,
    textTransform: 'uppercase',
  };
  const inputStyle = {
    width: '100%', padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4,
    fontSize: 13, fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: -260, width: 240,
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      boxShadow: '0 6px 24px rgba(0,0,0,.12)',
      padding: 14,
      fontFamily: 'system-ui, sans-serif',
      zIndex: 2000,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12,
        borderBottom: '1px solid #eee', paddingBottom: 8,
      }}>
        <strong style={{ fontSize: 13, color: '#333' }}>Editar texto</strong>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: 18, color: '#999',
            padding: 0, lineHeight: 1,
          }}
          title="Cerrar panel">×</button>
      </div>

      {/* Texto */}
      <label style={labelStyle}>Texto</label>
      <input
        type="text"
        value={text.value}
        onChange={update('value')}
        style={{ ...inputStyle, marginBottom: 10 }}
      />

      {/* Tamaño + Peso */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Tamaño (pt)</label>
          <input
            type="number" min={6} max={120}
            value={text.fontSize}
            onChange={updateNumber('fontSize')}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Peso</label>
          <select
            value={text.fontWeight}
            onChange={updateNumber('fontWeight')}
            style={inputStyle}
          >
            <option value={300}>Light</option>
            <option value={400}>Normal</option>
            <option value={600}>Semi</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
          </select>
        </div>
      </div>

      {/* Color + Itálica */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="color"
              value={text.color}
              onChange={update('color')}
              style={{
                width: 40, height: 32, border: '1px solid #ddd',
                borderRadius: 4, cursor: 'pointer', padding: 2,
              }}
            />
            <input
              type="text"
              value={text.color}
              onChange={update('color')}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => onChange({ ...text, fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' })}
          style={{
            flex: 1, padding: '6px 10px',
            background: text.fontStyle === 'italic' ? '#0abfbc' : '#f5f5f5',
            color: text.fontStyle === 'italic' ? '#fff' : '#333',
            border: '1px solid #ddd', borderRadius: 4,
            cursor: 'pointer', fontSize: 13, fontStyle: 'italic',
            fontFamily: 'inherit',
          }}>I cursiva</button>
      </div>

      {/* Fuente */}
      <label style={labelStyle}>Fuente</label>
      <select
        value={text.fontFamily}
        onChange={update('fontFamily')}
        style={{ ...inputStyle, marginBottom: 10 }}
      >
        {FUENTES.map(f => (
          <option key={f.val} value={f.val}>{f.label}</option>
        ))}
      </select>

      {/* Rotación */}
      <label style={labelStyle}>Rotación: {text.rotation}°</label>
      <input
        type="range" min={-180} max={180} step={5}
        value={text.rotation}
        onChange={updateNumber('rotation')}
        style={{ width: '100%', marginBottom: 4 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 12 }}>
        <button onClick={() => onChange({ ...text, rotation: 0 })}
          style={{ flex: 1, fontSize: 11, padding: '4px',
            border: '1px solid #ddd', borderRadius: 3,
            background: '#fff', cursor: 'pointer' }}>0°</button>
        <button onClick={() => onChange({ ...text, rotation: -90 })}
          style={{ flex: 1, fontSize: 11, padding: '4px',
            border: '1px solid #ddd', borderRadius: 3,
            background: '#fff', cursor: 'pointer' }}>-90°</button>
        <button onClick={() => onChange({ ...text, rotation: 90 })}
          style={{ flex: 1, fontSize: 11, padding: '4px',
            border: '1px solid #ddd', borderRadius: 3,
            background: '#fff', cursor: 'pointer' }}>+90°</button>
      </div>

      {/* Borrar */}
      <button
        onClick={() => onDelete(text.id)}
        style={{
          width: '100%', padding: '8px',
          background: '#fff', color: '#d92626',
          border: '1.5px solid #d92626', borderRadius: 4,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          fontFamily: 'inherit',
        }}>🗑 Eliminar texto</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   <TicketEditable>
═════════════════════════════════════════════════════════════ */
export default function TicketEditable({ r, numero, design, onUpdate }) {
  const D = { ...DEFAULT_DESIGN, ...(design || {}) };
  const positions = D.positions || {};
  const customTexts = D.customTexts || [];

  // ── Defaults de rifa ──
  const { numero: premioNumRifa, texto: premioTxtRifa } = splitPremio(r?.premio);
  const fechaRifa     = fmtFechaLoteria(r?.fecha_sorteo);
  const horaRifa      = D.horaSort?.trim() || fmtHora12(r?.hora_sorteo) || '';
  const valorRifa     = fmtValorBoleto(r?.precio);
  const subPremioRifa = r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const numBoletoRifa = numero || '000';
  const loteriaRifa   = r?.loteria_ref
    ? `${r.loteria_ref}${horaRifa ? ` ${horaRifa}` : ''}`
    : D.loteriaText;

  // ── Valores ──
  const numBoleto    = resolveValue(D, 'numBoleto',    numBoletoRifa);
  const premioNum    = resolveValue(D, 'premioNum',    premioNumRifa || '500');
  const premioTexto  = resolveValue(D, 'premioTexto',  premioTxtRifa);
  const fechaTexto   = resolveValue(D, 'fechaTexto',   fechaRifa);
  const loteriaTxt   = resolveValue(D, 'loteriaTexto', loteriaRifa);
  const valorTexto   = resolveValue(D, 'valorTexto',   valorRifa);
  const subPremioTxt = resolveValue(D, 'subPremioNum', subPremioRifa);

  // ── Escala responsive ──
  const [containerRef, containerWidth] = useContainerWidth();
  const scale = containerWidth > 0 && containerWidth < D.ticketWidth
    ? containerWidth / D.ticketWidth
    : 1;

  // ── Selección actual ──
  const [selectedId, setSelectedId] = useState(null);

  // ── Mover posición de campo built-in ──
  const handleMoveBuiltin = useCallback((campo, newPos) => {
    const def = DEFAULT_POSITIONS[campo] || {};
    onUpdate('positions', {
      ...positions,
      [campo]: {
        x: newPos.x, y: newPos.y,
        ...(def.rotated ? { rotated: true } : {}),
      },
    });
  }, [positions, onUpdate]);

  // ── Mover custom text ──
  const handleMoveCustom = useCallback((id, newPos) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, x: newPos.x, y: newPos.y } : t
    ));
  }, [customTexts, onUpdate]);

  // ── Editar valor de custom text ──
  const handleChangeCustomValue = useCallback((id, newValue) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === id ? { ...t, value: newValue } : t
    ));
  }, [customTexts, onUpdate]);

  // ── Actualizar propiedades completas de un custom text (desde panel) ──
  const handleUpdateCustom = useCallback((updated) => {
    onUpdate('customTexts', customTexts.map(t =>
      t.id === updated.id ? updated : t
    ));
  }, [customTexts, onUpdate]);

  // ── Agregar texto custom ──
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
    setSelectedId(newId);
  };

  // ── Borrar texto custom ──
  const handleDeleteCustom = (id) => {
    onUpdate('customTexts', customTexts.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Reset posiciones (built-in) ──
  const handleResetPositions = () => {
    if (window.confirm('¿Restaurar todas las posiciones al diseño original? (los textos custom no se borran)')) {
      onUpdate('positions', {});
      setSelectedId(null);
    }
  };

  // ── Click fuera de cualquier texto: deseleccionar ──
  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    }
  };

  const STROKE = D.colorBorde;
  const selectedCustom = customTexts.find(t => t.id === selectedId);

  // ── Helper para built-in ──
  const F = (campo, value, onChangeKey, textStyle, opts = {}) => (
    <DraggableEditable
      key={campo}
      id={campo}
      position={getPos(positions, campo)}
      onMove={handleMoveBuiltin}
      value={value}
      onChange={v => onUpdate(onChangeKey, v)}
      textStyle={textStyle}
      scale={scale}
      multiline={opts.multiline}
      placeholder={opts.placeholder}
      selected={selectedId === campo}
      onSelect={setSelectedId}
    />
  );

  return (
    <div style={{ width: '100%', position: 'relative' }} ref={containerRef}>

      {/* Wrapper que reserva espacio escalado */}
      <div style={{
        width: '100%',
        maxWidth: D.ticketWidth,
        margin: '0 auto',
        height: D.ticketHeight * scale,
        position: 'relative',
      }}>

        {/* ═══ CANVAS DEL TICKET ═══ */}
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
            transform: scale < 1 ? `scale(${scale})` : 'none',
            transformOrigin: 'top left',
            boxSizing: 'border-box',
          }}
        >

          {/* Líneas decorativas (no arrastrables) */}
          <div style={{
            position: 'absolute', left: 115, top: 0, bottom: 0,
            borderLeft: `2px dashed ${STROKE}`, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: 137, top: 0, bottom: 0,
            borderLeft: `1px solid ${STROKE}`, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: 145, right: 10,
            bottom: 50, height: 0,
            borderTop: `1px dashed ${STROKE}40`, pointerEvents: 'none',
          }} />

          {/* ─── Built-in fields ─── */}
          {F('numBoletoIzq', numBoleto, 'numBoleto', {
            border: `2px solid ${STROKE}`, padding: '6px 12px',
            fontSize: px(D.sizeNumTalon), fontWeight: 900,
            color: D.colorTalon, letterSpacing: 2, background: '#fff',
          })}
          {F('nombreLabel', 'NOMBRE:', 'nombreLabel', {
            fontSize: px(D.sizeNombre), fontWeight: 700, color: '#000',
          })}
          {F('telLabel', 'Tel:', 'telLabel', {
            fontSize: Math.max(8, px(D.sizeNombre) - 4),
            color: '#666', letterSpacing: .5,
          })}
          {F('brandText', D.brandText, 'brandText', {
            fontSize: px(D.sizeBrand), fontWeight: 900,
            color: D.colorTalon, letterSpacing: 4, fontStyle: 'italic',
          })}
          {F('talonText', D.talonText, 'talonText', {
            fontSize: px(D.sizeTalonText), fontWeight: 800,
            color: '#000', letterSpacing: 2,
          })}

          {F('sloganTop', D.sloganTop, 'sloganTop', {
            fontSize: px(D.sizeSlogan), fontWeight: 900,
            color: D.colorSlogan, letterSpacing: 1,
            textTransform: 'uppercase',
            WebkitTextStroke: `.5px ${STROKE}`,
            textShadow: '1px 1px 0 rgba(0,0,0,.15)',
            lineHeight: 1,
          })}
          {F('fechaPrefix', D.fechaPrefix, 'fechaPrefix', {
            fontSize: px(D.sizeFecha), fontWeight: 800,
            color: D.colorFecha, fontStyle: 'italic', letterSpacing: .5,
          })}
          {F('fechaTexto', fechaTexto, 'fechaTexto', {
            fontSize: px(D.sizeFecha), fontWeight: 800,
            color: D.colorFecha, fontStyle: 'italic', letterSpacing: .5,
          })}
          {F('numBoletoDer', numBoleto, 'numBoleto', {
            border: `2px solid ${STROKE}`, padding: '6px 14px',
            fontSize: px(D.sizeNumDer), fontWeight: 900,
            color: D.colorTalon, letterSpacing: 2, background: '#fff',
          })}

          {F('premioLabel', D.premioLabel, 'premioLabel', {
            fontSize: px(D.sizePremioLabel), fontWeight: 800,
            fontStyle: 'italic', color: D.colorPremio1,
            letterSpacing: .5, lineHeight: 1,
            textShadow: `2px 2px 0 ${STROKE}`,
          })}
          {F('premioNum', premioNum, 'premioNum', {
            fontFamily: "'Arial Black','Poppins',sans-serif",
            fontWeight: 900, fontSize: px(D.sizePremioNum),
            lineHeight: .85, letterSpacing: 2,
            background: `linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            WebkitTextStroke: `2.5px ${STROKE}`,
            filter: `drop-shadow(3px 3px 0 ${STROKE}30)`,
          })}
          {F('premioTexto', premioTexto, 'premioTexto', {
            fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
            fontSize: px(D.sizePremioTxt), fontWeight: 700,
            color: D.colorDolares, fontStyle: 'italic', lineHeight: 1,
            textShadow: `2px 2px 0 ${STROKE}40`,
          }, { placeholder: '(tipo)' })}
          {F('subPremioPrefix', D.subPremioPrefix, 'subPremioPrefix', {
            fontSize: px(D.sizeSubPremio), fontWeight: 900,
            color: D.colorSubPremio, fontStyle: 'italic',
            textShadow: `1.5px 1.5px 0 ${STROKE}40`,
          })}
          {F('subPremioNum', subPremioTxt, 'subPremioNum', {
            fontSize: px(D.sizeSubPremio), fontWeight: 900,
            color: D.colorSubPremio, fontStyle: 'italic',
            textShadow: `1.5px 1.5px 0 ${STROKE}40`,
          }, { placeholder: '(monto)' })}
          {F('subPremioMoneda', D.subPremioMoneda, 'subPremioMoneda', {
            fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
            fontSize: px(D.sizeSubMoneda), fontWeight: 700,
            color: D.colorPesosSub, fontStyle: 'italic',
            textShadow: `1px 1px 0 ${STROKE}40`,
          })}

          {F('caducaText', D.caducaText, 'caducaText', {
            fontSize: px(D.sizeCaduca), fontWeight: 700,
            color: D.colorCaduca, letterSpacing: .5, fontStyle: 'italic',
          })}
          {F('loteriaTexto', loteriaTxt, 'loteriaTexto', {
            fontSize: px(D.sizeLoteria), fontWeight: 700,
            color: D.colorLoteria, lineHeight: 1.15, fontStyle: 'italic',
          })}

          {F('motivacionalText', D.motivacionalText, 'motivacionalText', {
            fontSize: px(D.sizeMotivac), fontWeight: 600,
            color: D.colorMotivac, fontStyle: 'italic',
            lineHeight: 1.2, maxWidth: 380, whiteSpace: 'normal',
          }, { multiline: true })}
          {F('boletoLabel', D.boletoLabel, 'boletoLabel', {
            fontSize: px(D.sizeBoleto), fontWeight: 900,
            color: D.colorBoleto, letterSpacing: 1,
            textShadow: `1.5px 1.5px 0 ${STROKE}40`,
          })}
          {F('valorTexto', valorTexto, 'valorTexto', {
            fontSize: px(D.sizeValor), fontWeight: 900,
            color: D.colorValor, fontStyle: 'italic', lineHeight: 1,
            textShadow: `2px 2px 0 ${STROKE}40`,
          })}
          {F('valorSufijo', D.valorSufijo, 'valorSufijo', {
            fontSize: px(D.sizePesos), fontWeight: 900,
            color: D.colorPesos, letterSpacing: .5,
            textShadow: `1.5px 1.5px 0 ${STROKE}40`,
          })}

          {D.footerText !== '' && F('footerText', D.footerText, 'footerText', {
            fontSize: px(D.sizeFooter), color: '#999', letterSpacing: .5,
          })}

          {/* ─── Custom texts (los del usuario) ─── */}
          {customTexts.map(t => (
            <DraggableEditable
              key={t.id}
              id={t.id}
              position={{ x: t.x, y: t.y, rotation: t.rotation }}
              onMove={handleMoveCustom}
              value={t.value}
              onChange={v => handleChangeCustomValue(t.id, v)}
              textStyle={{
                fontSize: px(t.fontSize),
                fontWeight: t.fontWeight,
                color: t.color,
                fontStyle: t.fontStyle,
                fontFamily: t.fontFamily,
              }}
              scale={scale}
              selected={selectedId === t.id}
              onSelect={setSelectedId}
              onRequestDelete={handleDeleteCustom}
            />
          ))}
        </div>

        {/* ─── Panel lateral del texto custom seleccionado ─── */}
        {selectedCustom && (
          <CustomTextPanel
            text={selectedCustom}
            onChange={handleUpdateCustom}
            onDelete={handleDeleteCustom}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* ═══ Barra inferior: ayuda + acciones ═══ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        maxWidth: D.ticketWidth,
        margin: '14px auto 0',
        padding: '0 4px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12, color: '#666',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontStyle: 'italic', flex: '1 1 280px' }}>
          💡 <strong>Click</strong> edita · <strong>Arrastra</strong> mueve · <strong>Shift+arrastra</strong> snap
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleAddText}
            style={{
              background: '#0abfbc',
              border: '1.5px solid #0abfbc',
              color: '#fff',
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s',
              boxShadow: '0 1px 3px rgba(10,191,188,.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#089a98'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0abfbc'; }}
          >
            + Agregar texto
          </button>
          <button
            onClick={handleResetPositions}
            style={{
              background: '#fff',
              border: '1.5px solid #d92626',
              color: '#d92626',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ffe8e8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
          >
            ↺ Reset posiciones
          </button>
        </div>
      </div>
    </div>
  );
}