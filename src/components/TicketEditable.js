// ════════════════════════════════════════════════════════════════
//   components/TicketEditable.js
//   RIFAS JORDYN — Ticket plantilla 100% editable + ARRASTRABLE
//
//   ▸ TODO campo es editable (click corto) Y arrastrable (drag largo).
//   ▸ Umbral: si el mouse se mueve >5px antes de soltar, es drag.
//     Si suelta sin moverse, abre el input para editar.
//   ▸ Posiciones absolutas {x, y} guardadas en design.positions.
//   ▸ Soporta mouse y touch (tablets).
//   ▸ Tecla Shift mientras arrastras = snap a grid de 10px.
//   ▸ Botón "↺ Reset posiciones" para volver al layout default.
//   ▸ Si containerWidth < ticketWidth, el ticket entero se escala
//     con transform: scale() y los deltas del drag se compensan.
//
//   Uso:
//     <TicketEditable
//       r={rifaData}
//       numero="023"
//       design={design}
//       onUpdate={(campo, valor) => setDesign(d => ({...d, [campo]: valor}))}
//     />
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { DEFAULT_DESIGN } from './Ticket';

// pt → px
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);

// Umbral en píxeles del mouse para distinguir click de drag
const DRAG_THRESHOLD = 5;
// Grid para snap con Shift
const SNAP_GRID = 10;

/* ════════════════════════════════════════════════
   Posiciones default de cada elemento (en px, dentro
   del canvas del ticket de ticketWidth × ticketHeight).
═════════════════════════════════════════════════ */
const DEFAULT_POSITIONS = {
  // Talón izquierdo
  numBoletoIzq:    { x: 18,  y: 14 },
  nombreLabel:     { x: 8,   y: 70 },
  telLabel:        { x: 8,   y: 300 },
  brandText:       { x: 105, y: 180, rotated: true },   // vertical
  talonText:       { x: 135, y: 230, rotated: true },   // vertical

  // Cabecera cuerpo
  sloganTop:       { x: 165, y: 14 },
  fechaPrefix:     { x: 165, y: 48 },
  fechaTexto:      { x: 240, y: 48 },
  numBoletoDer:    { x: 670, y: 14 },

  // Premio
  premioLabel:     { x: 230, y: 80 },
  premioNum:       { x: 175, y: 95 },
  premioTexto:     { x: 360, y: 180 },
  subPremioPrefix: { x: 200, y: 215 },
  subPremioNum:    { x: 230, y: 215 },
  subPremioMoneda: { x: 360, y: 218 },

  // Lateral derecho
  caducaText:      { x: 740, y: 200, rotated: true },   // vertical
  loteriaTexto:    { x: 590, y: 200 },

  // Fila inferior
  motivacionalText:{ x: 170, y: 265 },
  boletoLabel:     { x: 580, y: 248 },
  valorTexto:      { x: 560, y: 275 },
  valorSufijo:     { x: 700, y: 290 },

  footerText:      { x: 240, y: 320 },
};

/* ════════════════════════════════════════════════
   Helpers de formateo (igual que antes)
═════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════
   Hook: detecta ancho del contenedor (escala responsive)
═════════════════════════════════════════════════ */
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

const resolveValue = (design, campo, fallback) => {
  const v = design?.[campo];
  return v !== undefined && v !== null ? v : (fallback ?? '');
};

const getPos = (positions, campo) => {
  const saved = positions?.[campo];
  const def = DEFAULT_POSITIONS[campo] || { x: 0, y: 0 };
  if (!saved) return def;
  // mezclamos para preservar flag 'rotated' del default
  return { ...def, ...saved };
};

/* ════════════════════════════════════════════════
   <DraggableEditable>
   - position: { x, y, rotated? }
   - Click corto (< DRAG_THRESHOLD de movimiento) → editar
   - Drag largo → mover, persistir vía onMove
═════════════════════════════════════════════════ */
function DraggableEditable({
  campo,
  position,
  onMove,
  value,
  onChange,
  multiline = false,
  placeholder = '(click para editar)',
  textStyle,
  scale = 1,
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value || '');
  const [hover, setHover]       = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // Estado del drag en ref para no causar renders durante el arrastre
  const dragRef = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // ── Pointer move global ──
  const handleMove = useCallback((e) => {
    const s = dragRef.current;
    if (!s) return;

    const point = e.touches ? e.touches[0] : e;
    const rawDx = point.clientX - s.mouseX;
    const rawDy = point.clientY - s.mouseY;
    const dist = Math.hypot(rawDx, rawDy);

    if (!s.started && dist < DRAG_THRESHOLD) return;
    if (!s.started) {
      s.started = true;
      setDragging(true);
    }

    if (e.cancelable) e.preventDefault();

    // Compensamos la escala del canvas: el mouse se mueve en píxeles de
    // pantalla, pero queremos coordenadas en el sistema del canvas.
    let newX = s.origX + rawDx / scale;
    let newY = s.origY + rawDy / scale;

    // Snap a grid con Shift
    if (e.shiftKey) {
      newX = Math.round(newX / SNAP_GRID) * SNAP_GRID;
      newY = Math.round(newY / SNAP_GRID) * SNAP_GRID;
    }

    onMove(campo, { x: Math.round(newX), y: Math.round(newY) });
  }, [campo, onMove, scale]);

  // ── Pointer up global ──
  const handleUp = useCallback(() => {
    const s = dragRef.current;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup',   handleUp);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('touchend',  handleUp);

    if (s && !s.started) {
      // No hubo arrastre: abrir input
      setEditing(true);
    }
    dragRef.current = null;
    setDragging(false);
  }, [handleMove]);

  // ── Pointer down (inicio) ──
  const handleDown = useCallback((e) => {
    if (editing) return;
    if (e.type === 'mousedown' && e.button !== 0) return;

    e.stopPropagation();
    const point = e.touches ? e.touches[0] : e;
    dragRef.current = {
      mouseX: point.clientX,
      mouseY: point.clientY,
      origX:  position.x,
      origY:  position.y,
      started: false,
    };

    if (e.touches) {
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend',  handleUp);
    } else {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup',   handleUp);
    }
  }, [editing, position.x, position.y, handleMove, handleUp]);

  // Cleanup si desmonta mid-drag
  useEffect(() => () => {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup',   handleUp);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('touchend',  handleUp);
  }, [handleMove, handleUp]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value || '');
  };

  // Wrapper con posición absoluta + rotación opcional
  const wrapperStyle = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: position.rotated ? 'rotate(-90deg)' : 'none',
    transformOrigin: 'left top',
    cursor: dragging ? 'grabbing' : (editing ? 'text' : 'grab'),
    zIndex: dragging ? 1000 : (hover ? 10 : 1),
    userSelect: 'none',
    touchAction: 'none',
    transition: dragging ? 'none' : 'box-shadow .15s ease, outline .12s ease',
    outline: editing
      ? '2px solid #0abfbc'
      : dragging
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
            outline: 'none',
            border: 'none',
            padding: '2px 4px',
            borderRadius: 3,
            minWidth: 40,
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
      data-field={campo}
      onMouseDown={handleDown}
      onTouchStart={handleDown}
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
        pointerEvents: 'none', // todos los eventos van al wrapper
      }}>
        {value || placeholder}
      </span>
      {hover && !dragging && (
        <span style={{
          position: 'absolute', top: -10, right: -12,
          background: '#0abfbc', color: '#fff',
          fontSize: 10, lineHeight: 1, padding: '2px 4px',
          borderRadius: 3, pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif', fontWeight: 600,
          fontStyle: 'normal', whiteSpace: 'nowrap',
          transform: position.rotated ? 'rotate(90deg)' : 'none',
        }}>✎ ✥</span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   <TicketEditable>
═════════════════════════════════════════════════ */
export default function TicketEditable({ r, numero, design, onUpdate }) {
  const D = { ...DEFAULT_DESIGN, ...(design || {}) };
  const positions = D.positions || {};

  // Defaults de la rifa
  const { numero: premioNumRifa, texto: premioTxtRifa } = splitPremio(r?.premio);
  const fechaRifa     = fmtFechaLoteria(r?.fecha_sorteo);
  const horaRifa      = D.horaSort?.trim() || fmtHora12(r?.hora_sorteo) || '';
  const valorRifa     = fmtValorBoleto(r?.precio);
  const subPremioRifa = r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const numBoletoRifa = numero || '000';
  const loteriaRifa   = r?.loteria_ref
    ? `${r.loteria_ref}${horaRifa ? ` ${horaRifa}` : ''}`
    : D.loteriaText;

  // Valores actuales
  const numBoleto    = resolveValue(D, 'numBoleto',    numBoletoRifa);
  const premioNum    = resolveValue(D, 'premioNum',    premioNumRifa || '500');
  const premioTexto  = resolveValue(D, 'premioTexto',  premioTxtRifa);
  const fechaTexto   = resolveValue(D, 'fechaTexto',   fechaRifa);
  const loteriaTxt   = resolveValue(D, 'loteriaTexto', loteriaRifa);
  const valorTexto   = resolveValue(D, 'valorTexto',   valorRifa);
  const subPremioTxt = resolveValue(D, 'subPremioNum', subPremioRifa);

  // Escala responsive
  const [containerRef, containerWidth] = useContainerWidth();
  const scale = containerWidth > 0 && containerWidth < D.ticketWidth
    ? containerWidth / D.ticketWidth
    : 1;

  // Update de posición (preservando flag rotated si existía)
  const handleMove = useCallback((campo, newPos) => {
    const def = DEFAULT_POSITIONS[campo] || {};
    onUpdate('positions', {
      ...positions,
      [campo]: {
        x: newPos.x,
        y: newPos.y,
        ...(def.rotated ? { rotated: true } : {}),
      },
    });
  }, [positions, onUpdate]);

  // Reset
  const handleReset = () => {
    if (window.confirm('¿Restaurar todas las posiciones al diseño original?')) {
      onUpdate('positions', {});
    }
  };

  const STROKE = D.colorBorde;

  // Helper para reducir repetición
  const F = (campo, value, onChangeKey, textStyle, opts = {}) => (
    <DraggableEditable
      key={campo}
      campo={campo}
      position={getPos(positions, campo)}
      onMove={handleMove}
      value={value}
      onChange={v => onUpdate(onChangeKey, v)}
      textStyle={textStyle}
      scale={scale}
      multiline={opts.multiline}
      placeholder={opts.placeholder}
    />
  );

  return (
    <div style={{ width: '100%', position: 'relative' }} ref={containerRef}>

      {/* Wrapper que reserva el espacio escalado correcto */}
      <div style={{
        width: '100%',
        maxWidth: D.ticketWidth,
        margin: '0 auto',
        height: D.ticketHeight * scale,
        position: 'relative',
      }}>

        {/* ═══ CANVAS DEL TICKET ═══ */}
        <div style={{
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
        }}>

          {/* Líneas decorativas fijas */}
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

          {/* ─── Talón izquierdo ─── */}
          {F('numBoletoIzq', numBoleto, 'numBoleto', {
            border: `2px solid ${STROKE}`,
            padding: '6px 12px',
            fontSize: px(D.sizeNumTalon),
            fontWeight: 900, color: D.colorTalon,
            letterSpacing: 2, background: '#fff',
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
            color: D.colorTalon, letterSpacing: 4,
            fontStyle: 'italic',
          })}
          {F('talonText', D.talonText, 'talonText', {
            fontSize: px(D.sizeTalonText), fontWeight: 800,
            color: '#000', letterSpacing: 2,
          })}

          {/* ─── Cuerpo: cabecera ─── */}
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
            color: D.colorFecha, fontStyle: 'italic',
            letterSpacing: .5,
          })}
          {F('fechaTexto', fechaTexto, 'fechaTexto', {
            fontSize: px(D.sizeFecha), fontWeight: 800,
            color: D.colorFecha, fontStyle: 'italic',
            letterSpacing: .5,
          })}
          {F('numBoletoDer', numBoleto, 'numBoleto', {
            border: `2px solid ${STROKE}`,
            padding: '6px 14px',
            fontSize: px(D.sizeNumDer), fontWeight: 900,
            color: D.colorTalon, letterSpacing: 2, background: '#fff',
          })}

          {/* ─── Premio ─── */}
          {F('premioLabel', D.premioLabel, 'premioLabel', {
            fontSize: px(D.sizePremioLabel), fontWeight: 800,
            fontStyle: 'italic', color: D.colorPremio1,
            letterSpacing: .5, lineHeight: 1,
            textShadow: `2px 2px 0 ${STROKE}`,
          })}
          {F('premioNum', premioNum, 'premioNum', {
            fontFamily: "'Arial Black','Poppins',sans-serif",
            fontWeight: 900,
            fontSize: px(D.sizePremioNum),
            lineHeight: .85, letterSpacing: 2,
            background: `linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            WebkitTextStroke: `2.5px ${STROKE}`,
            filter: `drop-shadow(3px 3px 0 ${STROKE}30)`,
          })}
          {F('premioTexto', premioTexto, 'premioTexto', {
            fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
            fontSize: px(D.sizePremioTxt), fontWeight: 700,
            color: D.colorDolares, fontStyle: 'italic',
            lineHeight: 1,
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

          {/* ─── Lateral derecho ─── */}
          {F('caducaText', D.caducaText, 'caducaText', {
            fontSize: px(D.sizeCaduca), fontWeight: 700,
            color: D.colorCaduca, letterSpacing: .5,
            fontStyle: 'italic',
          })}
          {F('loteriaTexto', loteriaTxt, 'loteriaTexto', {
            fontSize: px(D.sizeLoteria), fontWeight: 700,
            color: D.colorLoteria, lineHeight: 1.15,
            fontStyle: 'italic',
          })}

          {/* ─── Fila inferior ─── */}
          {F('motivacionalText', D.motivacionalText, 'motivacionalText', {
            fontSize: px(D.sizeMotivac), fontWeight: 600,
            color: D.colorMotivac, fontStyle: 'italic',
            lineHeight: 1.2, maxWidth: 380,
            whiteSpace: 'normal',
          }, { multiline: true })}
          {F('boletoLabel', D.boletoLabel, 'boletoLabel', {
            fontSize: px(D.sizeBoleto), fontWeight: 900,
            color: D.colorBoleto, letterSpacing: 1,
            textShadow: `1.5px 1.5px 0 ${STROKE}40`,
          })}
          {F('valorTexto', valorTexto, 'valorTexto', {
            fontSize: px(D.sizeValor), fontWeight: 900,
            color: D.colorValor, fontStyle: 'italic',
            lineHeight: 1,
            textShadow: `2px 2px 0 ${STROKE}40`,
          })}
          {F('valorSufijo', D.valorSufijo, 'valorSufijo', {
            fontSize: px(D.sizePesos), fontWeight: 900,
            color: D.colorPesos, letterSpacing: .5,
            textShadow: `1.5px 1.5px 0 ${STROKE}40`,
          })}

          {/* Footer (solo si tiene texto) */}
          {D.footerText !== '' && F('footerText', D.footerText, 'footerText', {
            fontSize: px(D.sizeFooter), color: '#999',
            letterSpacing: .5,
          })}
        </div>
      </div>

      {/* ═══ Barra inferior: ayuda + reset ═══ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        maxWidth: D.ticketWidth,
        margin: '12px auto 0',
        padding: '0 4px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: '#666',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontStyle: 'italic' }}>
          💡 <strong>Click</strong> edita · <strong>Arrastra</strong> mueve · <strong>Shift+arrastra</strong> hace snap a grid
        </span>
        <button
          onClick={handleReset}
          style={{
            background: '#fff',
            border: '1.5px solid #d92626',
            color: '#d92626',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ffe8e8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          ↺ Reset posiciones
        </button>
      </div>
    </div>
  );
}