// ════════════════════════════════════════════════════════════════
//   components/TicketEditable.js
//   RIFAS JORDYN — Ticket plantilla 100 % editable
//
//   ▸ TODO campo es editable (incluyendo número, premio, fecha, lotería,
//     valor, etc.). Lo que el usuario escriba SIEMPRE manda al imprimir.
//   ▸ Los datos de la rifa solo se usan como VALOR INICIAL si el design
//     todavía no tiene ese campo. Una vez editado, queda fijo.
//   ▸ Responsive: en pantallas <640px de contenedor, el talón se
//     reorganiza arriba en banda horizontal.
//
//   Uso:
//     <TicketEditable
//       r={rifaData}
//       numero="023"
//       design={design}
//       onUpdate={(campo, valor) => setDesign(d => ({...d, [campo]: valor}))}
//     />
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { DEFAULT_DESIGN } from './Ticket';

// pt → px (1 pt = 1.333… px a 96 dpi)
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);

// Breakpoint del contenedor: bajo este ancho, talón pasa arriba
const MOBILE_BREAKPOINT = 640;

/* ════════════════════════════════════════════════
   Helpers de formateo (defaults iniciales)
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
   Hook: detecta ancho del contenedor (mobile/desktop)
   Usa ResizeObserver — funciona dentro de modales,
   columnas, sidebars, etc. (no depende del viewport).
═════════════════════════════════════════════════ */
function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // medición inicial
    setWidth(el.getBoundingClientRect().width);
    // observador
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/* ════════════════════════════════════════════════
   <EditableText> — click para editar
   - Hover: outline punteado limpio + ícono lápiz flotante
   - Enter confirma, Esc cancela
   - Soporta multiline (textarea)
═════════════════════════════════════════════════ */
function EditableText({
  value, onChange, style, multiline = false,
  placeholder = '(click para editar)', dataField,
}) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value || '');
  };

  if (editing) {
    const Comp = multiline ? 'textarea' : 'input';
    return (
      <Comp
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
          else if (e.key === 'Escape')         { e.preventDefault(); cancel(); }
        }}
        rows={multiline ? 2 : undefined}
        style={{
          ...style,
          background: 'rgba(10,191,188,.14)',
          outline: '2px solid #0abfbc',
          border: 'none',
          padding: '2px 4px',
          borderRadius: 3,
          minWidth: 40,
          maxWidth: '100%',
          fontFamily: style?.fontFamily || 'inherit',
          resize: multiline ? 'vertical' : 'none',
          boxSizing: 'border-box',
        }}
      />
    );
  }

  const isEmpty = !value;
  return (
    <span
      data-field={dataField}
      onClick={() => setEditing(true)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click para editar"
      style={{
        ...style,
        cursor: 'text',
        position: 'relative',
        outline: hover ? '1px dashed rgba(10,191,188,.85)' : 'none',
        outlineOffset: 2,
        borderRadius: 2,
        transition: 'outline .12s ease, background .12s ease',
        background: hover ? 'rgba(10,191,188,.06)' : 'transparent',
        opacity: isEmpty ? 0.45 : 1,
      }}
    >
      {value || placeholder}
      {hover && (
        <span style={{
          position: 'absolute', top: -10, right: -10,
          background: '#0abfbc', color: '#fff',
          fontSize: 10, lineHeight: 1, padding: '2px 4px',
          borderRadius: 3, pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif', fontWeight: 600,
          fontStyle: 'normal',
        }}>✎</span>
      )}
    </span>
  );
}

/* ════════════════════════════════════════════════
   resolveValue — obtiene el valor a mostrar.
   Prioridad: design[campo] (si existe) > valor de rifa.
   Si design[campo] no existe pero hay valor de rifa,
   ese valor se usa como inicial pero NO se persiste
   hasta que el usuario lo edite.
═════════════════════════════════════════════════ */
const resolveValue = (design, campo, fallback) => {
  const v = design?.[campo];
  // string vacío "" cuenta como editado (el usuario quiso vaciarlo)
  return v !== undefined && v !== null ? v : (fallback ?? '');
};

/* ════════════════════════════════════════════════
   <TicketEditable> — ticket completo
═════════════════════════════════════════════════ */
export default function TicketEditable({ r, numero, design, onUpdate }) {
  const D = { ...DEFAULT_DESIGN, ...(design || {}) };

  // ── Defaults derivados de la rifa (solo se usan si design no tiene el campo) ──
  const { numero: premioNumRifa, texto: premioTxtRifa } = splitPremio(r?.premio);
  const fechaRifa     = fmtFechaLoteria(r?.fecha_sorteo);
  const horaRifa      = D.horaSort?.trim() || fmtHora12(r?.hora_sorteo) || '';
  const valorRifa     = fmtValorBoleto(r?.precio);
  const subPremioRifa = r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const numBoletoRifa = numero || '000';
  const loteriaRifa   = r?.loteria_ref
    ? `${r.loteria_ref}${horaRifa ? ` ${horaRifa}` : ''}`
    : D.loteriaText;

  // ── Valores actuales (design tiene prioridad) ──
  const numBoleto    = resolveValue(D, 'numBoleto',    numBoletoRifa);
  const premioNum    = resolveValue(D, 'premioNum',    premioNumRifa || '500');
  const premioTexto  = resolveValue(D, 'premioTexto',  premioTxtRifa);
  const fechaTexto   = resolveValue(D, 'fechaTexto',   fechaRifa);
  const loteriaTxt   = resolveValue(D, 'loteriaTexto', loteriaRifa);
  const valorTexto   = resolveValue(D, 'valorTexto',   valorRifa);
  const subPremioTxt = resolveValue(D, 'subPremioNum', subPremioRifa);

  // ── Detección responsive ──
  const [containerRef, containerWidth] = useContainerWidth();
  const isMobile = containerWidth > 0 && containerWidth < MOBILE_BREAKPOINT;

  // Factor de escala: a partir de containerWidth, calcula cuánto reducir.
  // Si el contenedor es más chico que D.ticketWidth, escalamos las fuentes.
  const scale = containerWidth > 0
    ? Math.min(1, containerWidth / D.ticketWidth)
    : 1;
  const fs = (pt) => Math.max(7, Math.round(px(pt) * scale));

  const STROKE = D.colorBorde;

  // Estilos compartidos
  const numBoxStyle = {
    border: `2px solid ${STROKE}`,
    padding: isMobile ? '4px 9px' : '6px 12px',
    fontSize: fs(D.sizeNumTalon),
    fontWeight: 900,
    color: D.colorTalon,
    letterSpacing: 2,
    background: '#fff',
    display: 'inline-block',
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: D.ticketWidth,
        margin: '0 auto',
        fontFamily: "'Poppins','Arial Black',sans-serif",
        background: D.bgPaper,
        border: `2.5px solid ${STROKE}`,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: isMobile ? 'auto' : D.ticketHeight,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >

      {/* ═══════════════════════════════════════════════════
          TALÓN — izquierdo en desktop, arriba en móvil
      ═══════════════════════════════════════════════════ */}
      {isMobile ? (
        // ── Móvil: banda horizontal arriba ──
        <div style={{
          width: '100%',
          borderBottom: `2px dashed ${STROKE}`,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          background: 'rgba(0,0,0,.02)',
        }}>
          {/* Número del boleto */}
          <EditableText
            value={numBoleto}
            onChange={v => onUpdate('numBoleto', v)}
            dataField="numBoleto"
            style={numBoxStyle}
          />

          {/* "GRAN RIFA" (horizontal en móvil) */}
          <EditableText
            value={D.brandText}
            onChange={v => onUpdate('brandText', v)}
            dataField="brandText"
            style={{
              fontSize: fs(D.sizeBrand),
              fontWeight: 900,
              color: D.colorTalon,
              letterSpacing: 3,
              fontStyle: 'italic',
              display: 'inline-block',
            }}
          />

          {/* Campos NOMBRE / Tel */}
          <div style={{
            display: 'flex', gap: 12,
            fontSize: fs(D.sizeNombre),
            fontWeight: 700, color: '#000',
            flex: '1 0 100%',
            marginTop: 4,
            borderTop: `1px solid ${STROKE}20`,
            paddingTop: 4,
          }}>
            <span>NOMBRE: __________________</span>
            <span style={{ color: '#666' }}>Tel: __________</span>
          </div>

          {/* Tira "BOLETO SIN CANCELAR..." horizontal */}
          <div style={{
            flex: '1 0 100%', textAlign: 'center',
            borderTop: `1px solid ${STROKE}30`,
            paddingTop: 4, marginTop: 2,
          }}>
            <EditableText
              value={D.talonText}
              onChange={v => onUpdate('talonText', v)}
              dataField="talonText"
              style={{
                fontSize: fs(D.sizeTalonText),
                fontWeight: 800, color: '#000',
                letterSpacing: 2,
                display: 'inline-block',
              }}
            />
          </div>
        </div>
      ) : (
        // ── Desktop: talón vertical izquierdo ──
        <>
          <div style={{
            width: 115, flexShrink: 0,
            borderRight: `2px dashed ${STROKE}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 6px',
            position: 'relative',
          }}>
            <div style={{ marginBottom: 14 }}>
              <EditableText
                value={numBoleto}
                onChange={v => onUpdate('numBoleto', v)}
                dataField="numBoleto"
                style={numBoxStyle}
              />
            </div>

            <span style={{
              fontSize: fs(D.sizeNombre), fontWeight: 700, color: '#000',
              alignSelf: 'flex-start', marginLeft: 2, marginTop: 6,
            }}>NOMBRE:</span>

            <div style={{ flex: 1, width: '100%' }} />

            <span style={{
              fontSize: Math.max(8, fs(D.sizeNombre) - 4),
              color: '#666', alignSelf: 'flex-start',
              marginLeft: 2, marginBottom: 4, letterSpacing: .5,
            }}>Tel:</span>

            {/* "GRAN RIFA" vertical */}
            <div style={{
              position: 'absolute', right: -2, top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              transformOrigin: 'center',
              whiteSpace: 'nowrap',
            }}>
              <EditableText
                value={D.brandText}
                onChange={v => onUpdate('brandText', v)}
                dataField="brandText"
                style={{
                  fontSize: fs(D.sizeBrand), fontWeight: 900,
                  color: D.colorTalon, letterSpacing: 4,
                  fontStyle: 'italic', display: 'inline-block',
                }}
              />
            </div>
          </div>

          {/* Tira vertical "BOLETO SIN CANCELAR..." */}
          <div style={{
            width: 22, flexShrink: 0,
            borderRight: `1px solid ${STROKE}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
              <EditableText
                value={D.talonText}
                onChange={v => onUpdate('talonText', v)}
                dataField="talonText"
                style={{
                  fontSize: fs(D.sizeTalonText), fontWeight: 800,
                  color: '#000', letterSpacing: 2,
                  display: 'inline-block',
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════
          CUERPO PRINCIPAL
      ═══════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        padding: isMobile ? '10px 12px' : '8px 10px 8px 14px',
        display: 'flex', flexDirection: 'column',
        minWidth: 0,
      }}>

        {/* ── Cabecera: slogan + fecha + número der ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Slogan rojo */}
            <div style={{ lineHeight: 1 }}>
              <EditableText
                value={D.sloganTop}
                onChange={v => onUpdate('sloganTop', v)}
                dataField="sloganTop"
                style={{
                  fontSize: fs(D.sizeSlogan), fontWeight: 900,
                  color: D.colorSlogan, letterSpacing: 1,
                  textTransform: 'uppercase',
                  WebkitTextStroke: `.5px ${STROKE}`,
                  textShadow: '1px 1px 0 rgba(0,0,0,.15)',
                  display: 'inline-block',
                }}
              />
            </div>

            {/* Fecha: prefijo + fecha (ambos editables) */}
            <div style={{ marginTop: 2, lineHeight: 1 }}>
              <EditableText
                value={D.fechaPrefix}
                onChange={v => onUpdate('fechaPrefix', v)}
                dataField="fechaPrefix"
                style={{
                  fontSize: fs(D.sizeFecha), fontWeight: 800,
                  color: D.colorFecha, fontStyle: 'italic',
                  letterSpacing: .5,
                }}
              />
              {' '}
              <EditableText
                value={fechaTexto}
                onChange={v => onUpdate('fechaTexto', v)}
                dataField="fechaTexto"
                style={{
                  fontSize: fs(D.sizeFecha), fontWeight: 800,
                  color: D.colorFecha, fontStyle: 'italic',
                  letterSpacing: .5,
                }}
              />
            </div>
          </div>

          {/* Número arriba derecha (oculto en móvil — ya está arriba en el talón) */}
          {!isMobile && (
            <EditableText
              value={numBoleto}
              onChange={v => onUpdate('numBoleto', v)}
              dataField="numBoleto"
              style={{
                border: `2px solid ${STROKE}`,
                padding: '6px 14px',
                fontSize: fs(D.sizeNumDer), fontWeight: 900,
                color: D.colorTalon, letterSpacing: 2,
                background: '#fff', flexShrink: 0,
                display: 'inline-block',
              }}
            />
          )}
        </div>

        {/* ── Premio gigante ── */}
        <div style={{
          display: 'flex', flex: 1,
          alignItems: 'center',
          marginTop: 4,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 6 : 0,
        }}>

          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start',
            paddingLeft: isMobile ? 0 : 10,
            width: isMobile ? '100%' : 'auto',
          }}>
            {/* "Premio" en cursiva */}
            <div style={{ marginLeft: isMobile ? 0 : 30 }}>
              <EditableText
                value={D.premioLabel}
                onChange={v => onUpdate('premioLabel', v)}
                dataField="premioLabel"
                style={{
                  fontSize: fs(D.sizePremioLabel), fontWeight: 800,
                  fontStyle: 'italic', color: D.colorPremio1,
                  letterSpacing: .5, lineHeight: 1,
                  textShadow: `2px 2px 0 ${STROKE}`,
                  display: 'inline-block',
                }}
              />
            </div>

            {/* Número GIGANTE — ahora EDITABLE */}
            <EditableText
              value={premioNum}
              onChange={v => onUpdate('premioNum', v)}
              dataField="premioNum"
              style={{
                fontFamily: "'Arial Black','Poppins',sans-serif",
                fontWeight: 900,
                fontSize: fs(D.sizePremioNum),
                lineHeight: .85, letterSpacing: 2,
                background: `linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                WebkitTextStroke: `2.5px ${STROKE}`,
                filter: `drop-shadow(3px 3px 0 ${STROKE}30)`,
                display: 'inline-block',
              }}
            />

            {/* Texto del premio ("Dólares") — EDITABLE (siempre presente) */}
            <EditableText
              value={premioTexto}
              onChange={v => onUpdate('premioTexto', v)}
              dataField="premioTexto"
              placeholder="(tipo de premio)"
              style={{
                fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
                fontSize: fs(D.sizePremioTxt), fontWeight: 700,
                color: D.colorDolares, fontStyle: 'italic',
                lineHeight: 1,
                marginTop: isMobile ? 4 : -12,
                marginLeft: isMobile ? 0 : 'auto',
                marginRight: isMobile ? 0 : 80,
                textShadow: `2px 2px 0 ${STROKE}40`,
                display: 'inline-block',
                alignSelf: isMobile ? 'flex-start' : 'flex-end',
              }}
            />

            {/* Sub-premio en pesos — EDITABLE */}
            <div style={{
              display: 'flex', alignItems: 'baseline',
              gap: 8, marginTop: 6,
              marginLeft: isMobile ? 0 : 10,
              flexWrap: 'wrap',
            }}>
              <EditableText
                value={D.subPremioPrefix}
                onChange={v => onUpdate('subPremioPrefix', v)}
                dataField="subPremioPrefix"
                style={{
                  fontSize: fs(D.sizeSubPremio), fontWeight: 900,
                  color: D.colorSubPremio, fontStyle: 'italic',
                  textShadow: `1.5px 1.5px 0 ${STROKE}40`,
                  display: 'inline-block',
                }}
              />
              <EditableText
                value={subPremioTxt}
                onChange={v => onUpdate('subPremioNum', v)}
                dataField="subPremioNum"
                placeholder="(monto)"
                style={{
                  fontSize: fs(D.sizeSubPremio), fontWeight: 900,
                  color: D.colorSubPremio, fontStyle: 'italic',
                  textShadow: `1.5px 1.5px 0 ${STROKE}40`,
                  display: 'inline-block',
                }}
              />
              <EditableText
                value={D.subPremioMoneda}
                onChange={v => onUpdate('subPremioMoneda', v)}
                dataField="subPremioMoneda"
                style={{
                  fontFamily: "'Brush Script MT','Lucida Handwriting',cursive",
                  fontSize: fs(D.sizeSubMoneda), fontWeight: 700,
                  color: D.colorPesosSub, fontStyle: 'italic',
                  textShadow: `1px 1px 0 ${STROKE}40`,
                  display: 'inline-block',
                }}
              />
            </div>
          </div>

          {/* Caduca + lotería (en móvil: bajan abajo) */}
          <div style={{
            width: isMobile ? '100%' : 160,
            flexShrink: 0,
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'center' : 'flex-end',
            padding: '6px 4px',
            alignSelf: isMobile ? 'stretch' : 'stretch',
            gap: isMobile ? 8 : 0,
            borderTop: isMobile ? `1px dashed ${STROKE}30` : 'none',
            marginTop: isMobile ? 6 : 0,
          }}>
            <div style={{
              writingMode: isMobile ? 'horizontal-tb' : 'vertical-rl',
              alignSelf: isMobile ? 'auto' : 'flex-end',
            }}>
              <EditableText
                value={D.caducaText}
                onChange={v => onUpdate('caducaText', v)}
                dataField="caducaText"
                style={{
                  fontSize: fs(D.sizeCaduca), fontWeight: 700,
                  color: D.colorCaduca, letterSpacing: .5,
                  fontStyle: 'italic', display: 'inline-block',
                }}
              />
            </div>
            <EditableText
              value={loteriaTxt}
              onChange={v => onUpdate('loteriaTexto', v)}
              dataField="loteriaTexto"
              style={{
                textAlign: isMobile ? 'center' : 'right',
                fontSize: fs(D.sizeLoteria), fontWeight: 700,
                color: D.colorLoteria, lineHeight: 1.15,
                fontStyle: 'italic',
                marginTop: isMobile ? 0 : 'auto',
                display: 'inline-block',
              }}
            />
          </div>
        </div>

        {/* ── Línea inferior: motivacional + valor ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 6, paddingTop: 6,
          borderTop: `1px dashed ${STROKE}40`,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 8 : 0,
        }}>
          <div style={{
            flex: 1,
            paddingRight: isMobile ? 0 : 10,
            maxWidth: isMobile ? '100%' : '55%',
            width: isMobile ? '100%' : 'auto',
          }}>
            <EditableText
              value={D.motivacionalText}
              onChange={v => onUpdate('motivacionalText', v)}
              dataField="motivacionalText"
              multiline
              style={{
                fontSize: fs(D.sizeMotivac), fontWeight: 600,
                color: D.colorMotivac, fontStyle: 'italic',
                lineHeight: 1.2,
                display: 'inline-block', width: '100%',
              }}
            />
          </div>

          <div style={{
            textAlign: isMobile ? 'center' : 'right',
            lineHeight: 1,
            width: isMobile ? '100%' : 'auto',
          }}>
            <div>
              <EditableText
                value={D.boletoLabel}
                onChange={v => onUpdate('boletoLabel', v)}
                dataField="boletoLabel"
                style={{
                  fontSize: fs(D.sizeBoleto), fontWeight: 900,
                  color: D.colorBoleto, letterSpacing: 1,
                  textShadow: `1.5px 1.5px 0 ${STROKE}40`,
                  display: 'inline-block',
                }}
              />
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline',
              gap: 6,
              justifyContent: isMobile ? 'center' : 'flex-end',
              flexWrap: 'wrap',
            }}>
              <EditableText
                value={valorTexto}
                onChange={v => onUpdate('valorTexto', v)}
                dataField="valorTexto"
                style={{
                  fontSize: fs(D.sizeValor), fontWeight: 900,
                  color: D.colorValor, fontStyle: 'italic',
                  lineHeight: 1,
                  textShadow: `2px 2px 0 ${STROKE}40`,
                  display: 'inline-block',
                }}
              />
              <EditableText
                value={D.valorSufijo}
                onChange={v => onUpdate('valorSufijo', v)}
                dataField="valorSufijo"
                style={{
                  fontSize: fs(D.sizePesos), fontWeight: 900,
                  color: D.colorPesos, letterSpacing: .5,
                  textShadow: `1.5px 1.5px 0 ${STROKE}40`,
                  display: 'inline-block',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        {D.footerText !== '' && (
          <div style={{ marginTop: 4, textAlign: 'center' }}>
            <EditableText
              value={D.footerText}
              onChange={v => onUpdate('footerText', v)}
              dataField="footerText"
              style={{
                fontSize: fs(D.sizeFooter), color: '#999',
                letterSpacing: .5, display: 'inline-block',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}