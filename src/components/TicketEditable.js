// ════════════════════════════════════════════════════════════════
//   components/TicketEditable.js
//   RIFAS JORDYN — Ticket con edición in-place
//
//   Es una versión del TicketPreview que envuelve cada texto editable
//   en un componente <EditableText> que detecta click → input.
//
//   Uso:
//     <TicketEditable
//       r={rifaData}
//       numero="023"
//       design={design}
//       onUpdate={(campo, valor) => setDesign(d => ({...d, [campo]: valor}))}
//     />
//
//   Los datos que vienen de la rifa (premio, fecha, precio, lotería)
//   NO son editables — son auto-llenados al imprimir. Solo se editan
//   los textos de la plantilla (slogan, "GRAN RIFA", "Premio", etc.).
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_DESIGN } from './Ticket';

// pt → px (igual que en Ticket.js)
const PT_TO_PX = 96 / 72;
const px = (pt) => Math.round((Number(pt) || 0) * PT_TO_PX);

// Helpers locales (duplicados para no acoplar)
const parseFecha = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFechaLoteria = (f) => {
  const d = parseFecha(f);
  if (!d) return 'Por definir';
  const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
  if (!p) return { numero:'', texto:'' };
  const m = String(p).trim().match(/^([\d.,]+)\s*(.*)$/);
  return m ? { numero:m[1], texto:m[2] || '' } : { numero:'', texto:String(p) };
};
const fmtMilesPunto = (n) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(num) ? '' : num.toLocaleString('de-DE');
};
const fmtValorBoleto = (n) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + ' Millón';
  if (num >= 1000)    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + ' Mil';
  return String(num);
};

/* ════════════════════════════════════════════════
   <EditableText> — click para editar
═════════════════════════════════════════════════ */
function EditableText({
  value, onChange, style, multiline=false,
  placeholder='(vacío)', title, dataField,
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);

  // Auto-focus al abrir
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
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        style={{
          ...style,
          background:'rgba(10,191,188,.12)',
          outline:'2px solid #0abfbc',
          border:'none',
          padding:'2px 4px',
          borderRadius:3,
          minWidth:40,
          fontFamily:style?.fontFamily || 'inherit',
        }}
        rows={multiline ? 2 : undefined}
      />
    );
  }

  // Display mode (con hover sutil)
  const display = value || placeholder;
  return (
    <span
      title={title || 'Click para editar'}
      data-field={dataField}
      onClick={() => setEditing(true)}
      onMouseEnter={e => { e.currentTarget.style.outline = '1px dashed rgba(10,191,188,.7)'; }}
      onMouseLeave={e => { e.currentTarget.style.outline = 'none'; }}
      style={{
        ...style,
        cursor:'text', outlineOffset:2, borderRadius:2,
        transition:'outline .1s',
      }}>
      {display}
    </span>
  );
}

/* ════════════════════════════════════════════════
   <ReadOnlyText> — viene de la rifa, no se edita
═════════════════════════════════════════════════ */
function ReadOnlyText({ children, style, title }) {
  return (
    <span
      title={title || 'Este dato viene de la rifa al imprimir el boleto'}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,165,0,.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      style={{ ...style, borderRadius:2, transition:'background .15s', cursor:'help' }}>
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════
   <TicketEditable> — el ticket completo
═════════════════════════════════════════════════ */
export default function TicketEditable({ r, numero, design, onUpdate }) {
  const D = { ...DEFAULT_DESIGN, ...(design || {}) };

  const { numero: premioNum, texto: premioTxt } = splitPremio(r?.premio);
  const fecha     = fmtFechaLoteria(r?.fecha_sorteo);
  const hora      = D.horaSort?.trim() || fmtHora12(r?.hora_sorteo) || '';
  const valorTxt  = fmtValorBoleto(r?.precio);
  const subPremio = r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const num       = numero || '000';
  const loteria   = r?.loteria_ref
    ? `${r.loteria_ref}${hora ? ` ${hora}` : ''}`
    : D.loteriaText;

  const STROKE = D.colorBorde;

  return (
    <div style={{
      width:'100%', maxWidth:D.ticketWidth, margin:'0 auto',
      fontFamily:"'Poppins','Arial Black',sans-serif",
      background:D.bgPaper, border:`2.5px solid ${STROKE}`,
      display:'flex', minHeight:D.ticketHeight, position:'relative',
    }}>

      {/* ── Talón izquierdo ── */}
      <div style={{
        width:115, flexShrink:0, borderRight:`2px dashed ${STROKE}`,
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'10px 6px', position:'relative',
      }}>
        <ReadOnlyText style={{
          border:`2px solid ${STROKE}`, padding:'6px 12px',
          fontSize:px(D.sizeNumTalon), fontWeight:900, color:D.colorTalon,
          letterSpacing:2, background:'#fff', marginBottom:14,
        }} title="Número del boleto · viene del sistema al imprimir">{num}</ReadOnlyText>

        <span style={{
          fontSize:px(D.sizeNombre), fontWeight:700, color:'#000',
          alignSelf:'flex-start', marginLeft:2, marginTop:6,
        }}>NOMBRE:</span>

        <div style={{ flex:1, width:'100%' }}></div>

        <span style={{
          fontSize:Math.max(8, px(D.sizeNombre) - 4), color:'#666',
          alignSelf:'flex-start', marginLeft:2, marginBottom:4, letterSpacing:.5,
        }}>Tel:</span>

        {/* "GRAN RIFA" vertical — EDITABLE */}
        <div style={{
          position:'absolute', right:-2, top:'50%',
          transform:'translateY(-50%) rotate(-90deg)', transformOrigin:'center',
          whiteSpace:'nowrap',
        }}>
          <EditableText
            value={D.brandText}
            onChange={v => onUpdate('brandText', v)}
            dataField="brandText"
            style={{
              fontSize:px(D.sizeBrand), fontWeight:900, color:D.colorTalon,
              letterSpacing:4, fontStyle:'italic', display:'inline-block',
            }}
          />
        </div>
      </div>

      {/* ── Tira vertical "BOLETO SIN CANCELAR..." ── */}
      <div style={{
        width:22, flexShrink:0, borderRight:`1px solid ${STROKE}`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{ transform:'rotate(-90deg)', whiteSpace:'nowrap' }}>
          <EditableText
            value={D.talonText}
            onChange={v => onUpdate('talonText', v)}
            dataField="talonText"
            style={{
              fontSize:px(D.sizeTalonText), fontWeight:800, color:'#000',
              letterSpacing:2, display:'inline-block',
            }}
          />
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{
        flex:1, padding:'8px 10px 8px 14px',
        display:'flex', flexDirection:'column',
      }}>

        {/* Cabecera: slogan + número derecho */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            {/* Slogan rojo — EDITABLE */}
            <div style={{ lineHeight:1 }}>
              <EditableText
                value={D.sloganTop}
                onChange={v => onUpdate('sloganTop', v)}
                dataField="sloganTop"
                style={{
                  fontSize:px(D.sizeSlogan), fontWeight:900, color:D.colorSlogan,
                  letterSpacing:1, textTransform:'uppercase',
                  WebkitTextStroke:`.5px ${STROKE}`,
                  textShadow:'1px 1px 0 rgba(0,0,0,.15)',
                  display:'inline-block',
                }}
              />
            </div>

            {/* Fecha azul — el prefijo EDITABLE, la fecha ReadOnly */}
            <div style={{ marginTop:2, lineHeight:1 }}>
              <EditableText
                value={D.fechaPrefix}
                onChange={v => onUpdate('fechaPrefix', v)}
                dataField="fechaPrefix"
                style={{
                  fontSize:px(D.sizeFecha), fontWeight:800, color:D.colorFecha,
                  fontStyle:'italic', letterSpacing:.5,
                }}
              />
              {' '}
              <ReadOnlyText
                style={{
                  fontSize:px(D.sizeFecha), fontWeight:800, color:D.colorFecha,
                  fontStyle:'italic', letterSpacing:.5,
                }}
                title="Fecha del sorteo · viene de rifa.fecha_sorteo">
                {fecha}
              </ReadOnlyText>
            </div>
          </div>

          {/* Número arriba derecha */}
          <ReadOnlyText
            style={{
              border:`2px solid ${STROKE}`, padding:'6px 14px',
              fontSize:px(D.sizeNumDer), fontWeight:900, color:D.colorTalon,
              letterSpacing:2, background:'#fff', marginLeft:8, flexShrink:0,
            }}
            title="Número del boleto">{num}</ReadOnlyText>
        </div>

        {/* Premio gigante */}
        <div style={{ display:'flex', flex:1, alignItems:'center', marginTop:4 }}>

          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            alignItems:'flex-start', paddingLeft:10,
          }}>
            {/* "Premio" cursiva — EDITABLE */}
            <div style={{ marginLeft:30 }}>
              <EditableText
                value={D.premioLabel}
                onChange={v => onUpdate('premioLabel', v)}
                dataField="premioLabel"
                style={{
                  fontSize:px(D.sizePremioLabel), fontWeight:800,
                  fontStyle:'italic', color:D.colorPremio1,
                  letterSpacing:.5, lineHeight:1,
                  textShadow:`2px 2px 0 ${STROKE}`,
                  display:'inline-block',
                }}
              />
            </div>

            {/* Número GIGANTE — viene de la rifa */}
            <ReadOnlyText
              style={{
                fontFamily:"'Arial Black','Poppins',sans-serif", fontWeight:900,
                fontSize:px(D.sizePremioNum), lineHeight:.85, letterSpacing:2,
                background:`linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
                WebkitBackgroundClip:'text', backgroundClip:'text',
                WebkitTextFillColor:'transparent',
                WebkitTextStroke:`2.5px ${STROKE}`,
                filter:`drop-shadow(3px 3px 0 ${STROKE}30)`,
                display:'inline-block',
              }}
              title="Número del premio · viene de rifa.premio">
              {premioNum || '500'}
            </ReadOnlyText>

            {/* Texto del premio ("Dólares") — viene de rifa.premio */}
            {premioTxt && (
              <ReadOnlyText
                style={{
                  fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                  fontSize:px(D.sizePremioTxt), fontWeight:700, color:D.colorDolares,
                  fontStyle:'italic', lineHeight:1, marginTop:-12,
                  marginLeft:'auto', marginRight:80,
                  textShadow:`2px 2px 0 ${STROKE}40`,
                  display:'inline-block', alignSelf:'flex-end',
                }}
                title="Tipo del premio · viene de rifa.premio">
                {premioTxt}
              </ReadOnlyText>
            )}

            {/* Sub-premio en pesos */}
            {subPremio && (
              <div style={{
                display:'flex', alignItems:'baseline', gap:8,
                marginTop:6, marginLeft:10,
              }}>
                <span style={{
                  fontSize:px(D.sizeSubPremio), fontWeight:900, color:D.colorSubPremio,
                  fontStyle:'italic', textShadow:`1.5px 1.5px 0 ${STROKE}40`,
                }}>
                  <EditableText
                    value={D.subPremioPrefix}
                    onChange={v => onUpdate('subPremioPrefix', v)}
                    dataField="subPremioPrefix"
                    style={{ display:'inline' }}
                  />
                  {' '}
                  <ReadOnlyText title="Sub-premio en pesos · viene de rifa.premio_secundario">
                    {subPremio}
                  </ReadOnlyText>
                </span>
                <span style={{
                  fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                  fontSize:px(D.sizeSubMoneda), fontWeight:700, color:D.colorPesosSub,
                  fontStyle:'italic', textShadow:`1px 1px 0 ${STROKE}40`,
                }}>
                  <EditableText
                    value={D.subPremioMoneda}
                    onChange={v => onUpdate('subPremioMoneda', v)}
                    dataField="subPremioMoneda"
                    style={{ display:'inline' }}
                  />
                </span>
              </div>
            )}
          </div>

          {/* Caduca + lotería */}
          <div style={{
            width:160, flexShrink:0, display:'flex', flexDirection:'column',
            justifyContent:'space-between', alignItems:'flex-end',
            padding:'6px 4px', alignSelf:'stretch',
          }}>
            <div style={{
              writingMode:'vertical-rl', alignSelf:'flex-end',
            }}>
              <EditableText
                value={D.caducaText}
                onChange={v => onUpdate('caducaText', v)}
                dataField="caducaText"
                style={{
                  fontSize:px(D.sizeCaduca), fontWeight:700, color:D.colorCaduca,
                  letterSpacing:.5, fontStyle:'italic', display:'inline-block',
                }}
              />
            </div>
            <ReadOnlyText
              style={{
                textAlign:'right', fontSize:px(D.sizeLoteria), fontWeight:700,
                color:D.colorLoteria, lineHeight:1.15, fontStyle:'italic',
                marginTop:'auto',
              }}
              title="Lotería + hora · viene de la rifa (loteria_ref + hora_sorteo)">
              {loteria}
            </ReadOnlyText>
          </div>
        </div>

        {/* Línea inferior: motivacional + valor */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          marginTop:6, paddingTop:6, borderTop:`1px dashed ${STROKE}40`,
        }}>
          <div style={{ flex:1, paddingRight:10, maxWidth:'55%' }}>
            <EditableText
              value={D.motivacionalText}
              onChange={v => onUpdate('motivacionalText', v)}
              dataField="motivacionalText"
              multiline
              style={{
                fontSize:px(D.sizeMotivac), fontWeight:600, color:D.colorMotivac,
                fontStyle:'italic', lineHeight:1.2,
                display:'inline-block', width:'100%',
              }}
            />
          </div>

          <div style={{ textAlign:'right', lineHeight:1 }}>
            <div>
              <EditableText
                value={D.boletoLabel}
                onChange={v => onUpdate('boletoLabel', v)}
                dataField="boletoLabel"
                style={{
                  fontSize:px(D.sizeBoleto), fontWeight:900, color:D.colorBoleto,
                  letterSpacing:1, textShadow:`1.5px 1.5px 0 ${STROKE}40`,
                  display:'inline-block',
                }}
              />
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, justifyContent:'flex-end' }}>
              <ReadOnlyText
                style={{
                  fontSize:px(D.sizeValor), fontWeight:900, color:D.colorValor,
                  fontStyle:'italic', lineHeight:1,
                  textShadow:`2px 2px 0 ${STROKE}40`,
                }}
                title="Valor del boleto · viene de rifa.precio">{valorTxt}</ReadOnlyText>
              <EditableText
                value={D.valorSufijo}
                onChange={v => onUpdate('valorSufijo', v)}
                dataField="valorSufijo"
                style={{
                  fontSize:px(D.sizePesos), fontWeight:900, color:D.colorPesos,
                  letterSpacing:.5, textShadow:`1.5px 1.5px 0 ${STROKE}40`,
                  display:'inline-block',
                }}
              />
            </div>
          </div>
        </div>

        {D.footerText && (
          <div style={{ marginTop:4, textAlign:'center' }}>
            <EditableText
              value={D.footerText}
              onChange={v => onUpdate('footerText', v)}
              dataField="footerText"
              style={{
                fontSize:px(D.sizeFooter), color:'#999',
                letterSpacing:.5, display:'inline-block',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
