// ============================================================
//   RIFAS JORDYN — Componente Ticket
//   RF07: Rediseño estilo LOTERÍA TRADICIONAL latinoamericana
//         (inspirado en boletos físicos: talón vertical izquierdo,
//         premio principal gigante, colores vibrantes editables,
//         slogan superior, sub-premio en pesos, sello de caducidad)
//   ✅ Persistencia en BD via GET/PUT /api/ticket-design
//   ✅ Todos los textos editables desde el panel de diseño
//   ✅ parseFecha + extraerHora sin desfase UTC (VET timezone)
// ============================================================
import React, { useState, useEffect } from 'react';
import API from '../services/api';

// ── DEFAULT_DESIGN ────────────────────────────────────────
// Cada campo es editable desde el panel "Diseño de Ticket".
// Si agregas un campo aquí, agrégalo también en el editor.
export const DEFAULT_DESIGN = {
  // ── Marca / textos generales ────────────────────────────
  brandText:        'GRAN RIFA',                          // texto vertical del talón
  sloganTop:        'RESUELVE DE INICIO DE SEMANA',       // título rojo arriba
  fechaPrefix:      'Juega El',                           // prefijo de la fecha
  premioLabel:      'Premio',                             // palabra "Premio" en cursiva
  subPremioPrefix:  'ó',                                  // "ó 2.000.000 Pesos"
  subPremioMoneda:  'Pesos',                              // sufijo del sub-premio
  caducaText:       'Caduca a los 8 días',                // texto vertical derecho
  loteriaText:      'Triple Táchira "A" 10:10 Pm',        // lotería y hora
  motivacionalText: 'Prueba Tu Suerte y Ganate Este Fabuloso Premio!',
  boletoLabel:      'BOLETO',                             // etiqueta del valor
  valorSufijo:      'PESOS',                              // sufijo del valor
  talonText:        'BOLETO SIN CANCELAR NO JUEGA',       // texto vertical del talón
  footerText:       'Conserve este boleto · Válido solo con número legible',

  // ── Colores (paleta lotería tradicional) ─────────────────
  colorSlogan:    '#d92626', // rojo del slogan superior
  colorFecha:     '#1a3a8a', // azul oscuro de la fecha
  colorPremio1:   '#f5c518', // amarillo del número grande
  colorPremio2:   '#1565d8', // azul del número grande (doble color)
  colorDolares:   '#d92626', // rojo de "Dólares"
  colorSubPremio: '#c41e7a', // magenta del sub-premio en pesos
  colorPesosSub:  '#2e8b3e', // verde de "Pesos" del sub-premio
  colorBoleto:    '#1565d8', // azul de "BOLETO"
  colorValor:     '#d92626', // rojo del valor "6 Mil"
  colorPesos:     '#2e8b3e', // verde del sufijo "PESOS"
  colorMotivac:   '#1a1a1a', // color frase motivacional
  colorTalon:     '#1565d8', // azul del talón vertical
  colorCaduca:    '#1a1a1a', // color "Caduca a los 8 días"
  colorLoteria:   '#1a1a1a', // color lotería + hora
  colorBorde:     '#000000', // borde del boleto
  bgPaper:        '#f5f5f0', // color de fondo (papel)

  // ── Compatibilidad con diseño anterior ──────────────────
  accentColor:  '#0abfbc',
  accentColor2: '#f0a500',
  bgDark:       '#1a2e2e',
  watermarkText:'JORDYN',
  horaSort:     '',
};

// ── Helpers fecha ─────────────────────────────────────────
const parseFechaTicket = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};

// Fecha en formato "18 Mayo - 2026" (estilo lotería)
const fmtFechaLoteria = (f) => {
  const d = parseFechaTicket(f);
  if (!d) return 'Por definir';
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  // Usamos getUTC* para evitar desfase (las fechas vienen en VET)
  const dia = d.getUTCDate();
  const mes = MESES[d.getUTCMonth()];
  const ano = d.getUTCFullYear();
  return `${dia} ${mes} - ${ano}`;
};

const extraerHora = (fechaSorteo, horaDesign) => {
  if (horaDesign && horaDesign.trim()) return horaDesign.trim();
  const d = parseFechaTicket(fechaSorteo);
  if (!d) return '';
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return '';
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Caracas',
  });
};

// Formato dinero con separador de miles tipo "2.000.000"
const fmtMilesPunto = (n) => {
  if (n == null || n === '') return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  return num.toLocaleString('de-DE'); // de-DE usa punto como separador de miles
};

// Formato dinero corto: 6000 -> "6 Mil", 50000 -> "50 Mil"
const fmtValorBoleto = (n) => {
  if (n == null) return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + ' Millón';
  if (num >= 1000)    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + ' Mil';
  return String(num);
};

// Extrae el número grande del premio (p.ej. "500 Dólares" -> {numero:"500", texto:"Dólares"})
const splitPremio = (premio) => {
  if (!premio) return { numero: '', texto: '' };
  const s = String(premio).trim();
  const m = s.match(/^([\d.,]+)\s*(.*)$/);
  if (m) return { numero: m[1], texto: m[2] || '' };
  return { numero: '', texto: s };
};

const mkSerial = (numero) =>
  `JDY-${numero || '000'}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

// ── Hook: carga diseño desde BD ───────────────────────────
export function useTicketDesign() {
  const [design,  setDesign]  = useState(DEFAULT_DESIGN);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    API.get('/ticket-design')
      .then(r => { if (r.data?.design) setDesign({ ...DEFAULT_DESIGN, ...r.data.design }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);
  return { design, loading, reload };
}

// ─────────────────────────────────────────────────────────────
//   buildTicketHTML — RF07: HTML estilo LOTERÍA TRADICIONAL
//   Layout:
//   ┌──────┬─────────────────────────────────────────────┐
//   │ N°   │  SLOGAN ROJO                          N°    │
//   │ ──   │  Juega El [fecha]                           │
//   │ NOM  │   Premio                       Caduca  Cad. │
//   │  G   │   500 DÓLARES                   ───────────│
//   │  R   │   ó 2.000.000 Pesos             Lotería    │
//   │  A   │   ──────────────────────                    │
//   │  N   │   Frase motivacional       BOLETO 6Mil PESOS│
//   └──────┴─────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────
export function buildTicketHTML(d, r, numero, comprador, vendedor, copia) {
  const D = { ...DEFAULT_DESIGN, ...(d || {}) };

  const premioRaw = r?.premio || '';
  const { numero: premioNum, texto: premioTxt } = splitPremio(premioRaw);
  const fecha    = fmtFechaLoteria(r?.fecha_sorteo);
  const hora     = extraerHora(r?.fecha_sorteo, D.horaSort);
  const valorTxt = fmtValorBoleto(r?.precio);
  const subPremio= r?.premio_secundario ? fmtMilesPunto(r.premio_secundario) : '';
  const isOrig   = copia === 1;
  const nom      = comprador?.nombre || '';
  const num      = numero || '000';

  // Lotería con hora: si la rifa trae loteria_ref, la usamos; si no, el design
  const loteriaCompleta = r?.loteria_ref
    ? `${r.loteria_ref}${hora ? ` ${hora}` : ''}`
    : D.loteriaText;

  return `
<div style="width:780px;margin:14px auto;font-family:'Poppins','Arial Black',sans-serif;
  page-break-inside:avoid;background:${D.bgPaper};border:2.5px solid ${D.colorBorde};
  display:flex;min-height:340px;position:relative;">

  <!-- ═══ TALÓN VERTICAL IZQUIERDO ═══ -->
  <div style="width:115px;flex-shrink:0;border-right:2px dashed ${D.colorBorde};
    display:flex;flex-direction:column;align-items:center;padding:10px 6px;position:relative;">

    <!-- Cuadro número arriba -->
    <div style="border:2px solid ${D.colorBorde};padding:6px 12px;
      font-size:1.6rem;font-weight:900;color:${D.colorTalon};
      letter-spacing:2px;background:#fff;margin-bottom:14px;">
      ${num}
    </div>

    <!-- Campo NOMBRE: -->
    <div style="font-size:.78rem;font-weight:700;color:#000;
      align-self:flex-start;margin-left:2px;margin-top:6px;">
      NOMBRE: ${isOrig ? '' : `<span style="font-weight:500;font-size:.65rem;">(copia)</span>`}
    </div>
    <div style="font-size:.6rem;color:#666;align-self:flex-start;
      margin-left:2px;margin-top:auto;margin-bottom:4px;letter-spacing:.5px;">
      Tel:
    </div>

    <!-- Texto vertical "GRAN RIFA" -->
    <div style="position:absolute;right:-2px;top:50%;
      transform:translateY(-50%) rotate(-90deg);transform-origin:center;
      font-size:1.9rem;font-weight:900;color:${D.colorTalon};
      letter-spacing:4px;white-space:nowrap;font-style:italic;">
      ${D.brandText}
    </div>
  </div>

  <!-- ═══ TIRA VERTICAL "BOLETO SIN CANCELAR NO JUEGA" ═══ -->
  <div style="width:22px;flex-shrink:0;border-right:1px solid ${D.colorBorde};
    display:flex;align-items:center;justify-content:center;position:relative;">
    <div style="transform:rotate(-90deg);white-space:nowrap;
      font-size:.7rem;font-weight:800;color:#000;letter-spacing:2px;">
      ${D.talonText}
    </div>
  </div>

  <!-- ═══ CUERPO PRINCIPAL ═══ -->
  <div style="flex:1;padding:8px 10px 8px 14px;position:relative;display:flex;flex-direction:column;">

    <!-- Cabecera: slogan + cuadro número derecho -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="flex:1;">
        <!-- Slogan rojo -->
        <div style="font-size:1.5rem;font-weight:900;color:${D.colorSlogan};
          letter-spacing:1px;text-transform:uppercase;line-height:1;
          -webkit-text-stroke:.5px ${D.colorBorde};text-shadow:1px 1px 0 rgba(0,0,0,.15);">
          ${D.sloganTop}
        </div>
        <!-- Fecha azul -->
        <div style="font-size:1.4rem;font-weight:800;color:${D.colorFecha};
          font-style:italic;letter-spacing:.5px;margin-top:2px;line-height:1;">
          ${D.fechaPrefix} ${fecha}
        </div>
      </div>

      <!-- Cuadro número arriba derecha -->
      <div style="border:2px solid ${D.colorBorde};padding:6px 14px;
        font-size:1.6rem;font-weight:900;color:${D.colorTalon};
        letter-spacing:2px;background:#fff;margin-left:8px;flex-shrink:0;">
        ${num}
      </div>
    </div>

    <!-- Bloque del PREMIO GIGANTE -->
    <div style="display:flex;flex:1;align-items:center;margin-top:4px;position:relative;">

      <!-- Lado izquierdo: premio principal -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;
        padding-left:10px;">

        <!-- "Premio" en cursiva -->
        <div style="font-size:1.5rem;font-weight:800;font-style:italic;
          color:${D.colorPremio1};letter-spacing:.5px;line-height:1;
          text-shadow:2px 2px 0 ${D.colorBorde};margin-left:30px;">
          ${D.premioLabel}
        </div>

        <!-- Número GIGANTE doble color (amarillo arriba, azul abajo) -->
        <div style="font-family:'Arial Black','Poppins',sans-serif;font-weight:900;
          font-size:6.5rem;line-height:.85;letter-spacing:2px;
          background:linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%);
          -webkit-background-clip:text;background-clip:text;
          -webkit-text-fill-color:transparent;
          -webkit-text-stroke:2.5px ${D.colorBorde};
          filter:drop-shadow(3px 3px 0 ${D.colorBorde}30);">
          ${premioNum || '500'}
        </div>

        <!-- Texto del premio (Dólares, etc) -->
        ${premioTxt ? `
        <div style="font-family:'Brush Script MT','Lucida Handwriting',cursive;
          font-size:2.2rem;font-weight:700;color:${D.colorDolares};font-style:italic;
          line-height:1;margin-top:-12px;margin-left:auto;margin-right:80px;
          text-shadow:2px 2px 0 ${D.colorBorde}40;">
          ${premioTxt}
        </div>` : ''}

        <!-- Sub-premio en pesos -->
        ${subPremio ? `
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:6px;margin-left:10px;">
          <span style="font-size:2rem;font-weight:900;color:${D.colorSubPremio};
            font-style:italic;text-shadow:1.5px 1.5px 0 ${D.colorBorde}40;">
            ${D.subPremioPrefix} ${subPremio}
          </span>
          <span style="font-family:'Brush Script MT','Lucida Handwriting',cursive;
            font-size:1.6rem;font-weight:700;color:${D.colorPesosSub};font-style:italic;
            text-shadow:1px 1px 0 ${D.colorBorde}40;">
            ${D.subPremioMoneda}
          </span>
        </div>` : ''}
      </div>

      <!-- Lado derecho: caduca + lotería -->
      <div style="width:160px;flex-shrink:0;display:flex;flex-direction:column;
        justify-content:space-between;align-items:flex-end;padding:6px 4px;height:100%;">

        <!-- Caduca vertical (lee de abajo hacia arriba) -->
        <div style="writing-mode:vertical-rl;
          font-size:.95rem;font-weight:700;color:${D.colorCaduca};
          letter-spacing:.5px;align-self:flex-end;font-style:italic;">
          ${D.caducaText}
        </div>

        <!-- Lotería + hora -->
        <div style="text-align:right;font-size:.95rem;font-weight:700;
          color:${D.colorLoteria};line-height:1.15;font-style:italic;
          margin-top:auto;">
          ${loteriaCompleta}
        </div>
      </div>
    </div>

    <!-- Línea inferior: motivacional + valor del boleto -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;
      margin-top:6px;padding-top:6px;border-top:1px dashed ${D.colorBorde}40;">

      <!-- Frase motivacional -->
      <div style="flex:1;font-size:.95rem;font-weight:600;color:${D.colorMotivac};
        font-style:italic;line-height:1.2;padding-right:10px;max-width:55%;">
        ${D.motivacionalText}
      </div>

      <!-- BOLETO valor -->
      <div style="text-align:right;line-height:1;">
        <div style="font-size:1.6rem;font-weight:900;color:${D.colorBoleto};
          letter-spacing:1px;text-shadow:1.5px 1.5px 0 ${D.colorBorde}40;">
          ${D.boletoLabel}
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;justify-content:flex-end;">
          <span style="font-size:2.6rem;font-weight:900;color:${D.colorValor};
            font-style:italic;line-height:1;
            text-shadow:2px 2px 0 ${D.colorBorde}40;">
            ${valorTxt}
          </span>
          <span style="font-size:1.3rem;font-weight:900;color:${D.colorPesos};
            letter-spacing:.5px;text-shadow:1.5px 1.5px 0 ${D.colorBorde}40;">
            ${D.valorSufijo}
          </span>
        </div>
      </div>
    </div>

    <!-- Footer pequeño -->
    ${D.footerText ? `
    <div style="font-size:.55rem;color:#999;text-align:center;margin-top:4px;
      letter-spacing:.5px;">
      ${D.footerText}${nom ? ` · ${nom}` : ''}${vendedor ? ` · Vend: ${vendedor}` : ''}
    </div>` : ''}
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────
//   TicketPreview — versión React inline para vista previa
// ─────────────────────────────────────────────────────────────
export function TicketPreview({ r, rifa, numero, comprador, vendedor, design: dProp }) {
  const rifaData = r || rifa || {};
  const D        = { ...DEFAULT_DESIGN, ...(dProp || {}) };

  const premioRaw = rifaData?.premio || '';
  const { numero: premioNum, texto: premioTxt } = splitPremio(premioRaw);
  const fecha     = fmtFechaLoteria(rifaData?.fecha_sorteo);
  const hora      = extraerHora(rifaData?.fecha_sorteo, D.horaSort);
  const valorTxt  = fmtValorBoleto(rifaData?.precio || 0);
  const subPremio = rifaData?.premio_secundario ? fmtMilesPunto(rifaData.premio_secundario) : '';
  const nom       = comprador?.nombre || '';
  const num       = numero || '000';

  const loteriaCompleta = rifaData?.loteria_ref
    ? `${rifaData.loteria_ref}${hora ? ` ${hora}` : ''}`
    : D.loteriaText;

  const STROKE = D.colorBorde;

  return (
    <div style={{
      width:'100%', maxWidth:780, margin:'0 auto',
      fontFamily:"'Poppins','Arial Black',sans-serif",
      background:D.bgPaper, border:`2.5px solid ${STROKE}`,
      display:'flex', minHeight:340, position:'relative',
    }}>

      {/* ── Talón vertical izquierdo ── */}
      <div style={{
        width:115, flexShrink:0, borderRight:`2px dashed ${STROKE}`,
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'10px 6px', position:'relative',
      }}>
        <div style={{
          border:`2px solid ${STROKE}`, padding:'6px 12px',
          fontSize:'1.6rem', fontWeight:900, color:D.colorTalon,
          letterSpacing:2, background:'#fff', marginBottom:14,
        }}>{num}</div>

        <div style={{
          fontSize:'.78rem', fontWeight:700, color:'#000',
          alignSelf:'flex-start', marginLeft:2, marginTop:6,
        }}>NOMBRE:</div>

        <div style={{ flex:1, width:'100%' }}></div>

        <div style={{
          fontSize:'.6rem', color:'#666', alignSelf:'flex-start',
          marginLeft:2, marginBottom:4, letterSpacing:.5,
        }}>Tel:</div>

        <div style={{
          position:'absolute', right:-2, top:'50%',
          transform:'translateY(-50%) rotate(-90deg)', transformOrigin:'center',
          fontSize:'1.9rem', fontWeight:900, color:D.colorTalon,
          letterSpacing:4, whiteSpace:'nowrap', fontStyle:'italic',
        }}>{D.brandText}</div>
      </div>

      {/* ── Tira vertical "BOLETO SIN CANCELAR..." ── */}
      <div style={{
        width:22, flexShrink:0, borderRight:`1px solid ${STROKE}`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          transform:'rotate(-90deg)', whiteSpace:'nowrap',
          fontSize:'.7rem', fontWeight:800, color:'#000', letterSpacing:2,
        }}>{D.talonText}</div>
      </div>

      {/* ── Cuerpo principal ── */}
      <div style={{
        flex:1, padding:'8px 10px 8px 14px',
        display:'flex', flexDirection:'column',
      }}>

        {/* Cabecera: slogan + número derecho */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{
              fontSize:'1.5rem', fontWeight:900, color:D.colorSlogan,
              letterSpacing:1, textTransform:'uppercase', lineHeight:1,
              WebkitTextStroke:`.5px ${STROKE}`,
              textShadow:'1px 1px 0 rgba(0,0,0,.15)',
            }}>{D.sloganTop}</div>
            <div style={{
              fontSize:'1.4rem', fontWeight:800, color:D.colorFecha,
              fontStyle:'italic', letterSpacing:.5, marginTop:2, lineHeight:1,
            }}>{D.fechaPrefix} {fecha}</div>
          </div>
          <div style={{
            border:`2px solid ${STROKE}`, padding:'6px 14px',
            fontSize:'1.6rem', fontWeight:900, color:D.colorTalon,
            letterSpacing:2, background:'#fff', marginLeft:8, flexShrink:0,
          }}>{num}</div>
        </div>

        {/* Premio gigante */}
        <div style={{ display:'flex', flex:1, alignItems:'center', marginTop:4 }}>

          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            alignItems:'flex-start', paddingLeft:10,
          }}>
            <div style={{
              fontSize:'1.5rem', fontWeight:800, fontStyle:'italic',
              color:D.colorPremio1, letterSpacing:.5, lineHeight:1,
              textShadow:`2px 2px 0 ${STROKE}`, marginLeft:30,
            }}>{D.premioLabel}</div>

            <div style={{
              fontFamily:"'Arial Black','Poppins',sans-serif", fontWeight:900,
              fontSize:'6.5rem', lineHeight:.85, letterSpacing:2,
              background:`linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
              WebkitBackgroundClip:'text', backgroundClip:'text',
              WebkitTextFillColor:'transparent',
              WebkitTextStroke:`2.5px ${STROKE}`,
              filter:`drop-shadow(3px 3px 0 ${STROKE}30)`,
            }}>{premioNum || '500'}</div>

            {premioTxt && (
              <div style={{
                fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                fontSize:'2.2rem', fontWeight:700, color:D.colorDolares,
                fontStyle:'italic', lineHeight:1, marginTop:-12,
                marginLeft:'auto', marginRight:80,
                textShadow:`2px 2px 0 ${STROKE}40`,
              }}>{premioTxt}</div>
            )}

            {subPremio && (
              <div style={{
                display:'flex', alignItems:'baseline', gap:8,
                marginTop:6, marginLeft:10,
              }}>
                <span style={{
                  fontSize:'2rem', fontWeight:900, color:D.colorSubPremio,
                  fontStyle:'italic', textShadow:`1.5px 1.5px 0 ${STROKE}40`,
                }}>{D.subPremioPrefix} {subPremio}</span>
                <span style={{
                  fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                  fontSize:'1.6rem', fontWeight:700, color:D.colorPesosSub,
                  fontStyle:'italic', textShadow:`1px 1px 0 ${STROKE}40`,
                }}>{D.subPremioMoneda}</span>
              </div>
            )}
          </div>

          {/* Lateral derecho: caduca + lotería */}
          <div style={{
            width:160, flexShrink:0, display:'flex', flexDirection:'column',
            justifyContent:'space-between', alignItems:'flex-end',
            padding:'6px 4px', alignSelf:'stretch',
          }}>
            <div style={{
              writingMode:'vertical-rl',
              fontSize:'.95rem', fontWeight:700, color:D.colorCaduca,
              letterSpacing:.5, alignSelf:'flex-end', fontStyle:'italic',
            }}>{D.caducaText}</div>

            <div style={{
              textAlign:'right', fontSize:'.95rem', fontWeight:700,
              color:D.colorLoteria, lineHeight:1.15, fontStyle:'italic',
              marginTop:'auto',
            }}>{loteriaCompleta}</div>
          </div>
        </div>

        {/* Línea inferior: motivacional + valor */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          marginTop:6, paddingTop:6, borderTop:`1px dashed ${STROKE}40`,
        }}>
          <div style={{
            flex:1, fontSize:'.95rem', fontWeight:600, color:D.colorMotivac,
            fontStyle:'italic', lineHeight:1.2, paddingRight:10, maxWidth:'55%',
          }}>{D.motivacionalText}</div>

          <div style={{ textAlign:'right', lineHeight:1 }}>
            <div style={{
              fontSize:'1.6rem', fontWeight:900, color:D.colorBoleto,
              letterSpacing:1, textShadow:`1.5px 1.5px 0 ${STROKE}40`,
            }}>{D.boletoLabel}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, justifyContent:'flex-end' }}>
              <span style={{
                fontSize:'2.6rem', fontWeight:900, color:D.colorValor,
                fontStyle:'italic', lineHeight:1,
                textShadow:`2px 2px 0 ${STROKE}40`,
              }}>{valorTxt}</span>
              <span style={{
                fontSize:'1.3rem', fontWeight:900, color:D.colorPesos,
                letterSpacing:.5, textShadow:`1.5px 1.5px 0 ${STROKE}40`,
              }}>{D.valorSufijo}</span>
            </div>
          </div>
        </div>

        {D.footerText && (
          <div style={{
            fontSize:'.55rem', color:'#999', textAlign:'center',
            marginTop:4, letterSpacing:.5,
          }}>
            {D.footerText}
            {nom && ` · ${nom}`}
            {vendedor && ` · Vend: ${vendedor}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//   printTickets — abre ventana de impresión con 2 copias
// ─────────────────────────────────────────────────────────────
export function printTickets(rifasArr, numero, comprador, vendedor, design) {
  const d = { ...DEFAULT_DESIGN, ...(design || {}) };

  const STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#e8e8e0;display:flex;flex-direction:column;align-items:center;
      gap:18px;padding:18px;font-family:'Poppins','Arial Black',sans-serif;}
    @media print{
      body{background:#fff;padding:4px;gap:10px;}
      @page{size:landscape;margin:5mm;}
    }
  `;

  const html = rifasArr.flatMap(r => [1, 2].map(c =>
    buildTicketHTML(d, r, numero, comprador, vendedor, c)
  )).join('\n');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Boleto #${numero} — ${d.brandText}</title>
    <style>${STYLE}</style>
  </head><body>${html}
    <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},500);};<\/script>
  </body></html>`);
  win.document.close();
}

// ─────────────────────────────────────────────────────────────
//   generarImagenTicket — exporta el ticket como PNG
// ─────────────────────────────────────────────────────────────
export async function generarImagenTicket({ r, numero, comprador, vendedor, design }) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const d = { ...DEFAULT_DESIGN, ...(design || {}) };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;padding:20px;background:#e8e8e0;display:inline-block;';
    document.body.appendChild(wrapper);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(wrapper);
    const { createElement } = await import('react');

    await new Promise(resolve => {
      root.render(createElement(TicketPreview, { r, numero, comprador, vendedor, design: d }));
      setTimeout(resolve, 450);
    });

    const canvas = await html2canvas(wrapper, {
      scale: 2, useCORS: true, backgroundColor: '#e8e8e0',
    });

    root.unmount();
    document.body.removeChild(wrapper);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//   Ticket — default export
// ─────────────────────────────────────────────────────────────
export default function Ticket({ rifa, numero, comprador, vendedor, onClose }) {
  const rifasArr   = Array.isArray(rifa) ? rifa.filter(r => r.disponible !== false) : rifa ? [rifa] : [];
  const { design } = useTicketDesign();

  const efectivo = rifasArr[0]?.ticket_design
    ? { ...DEFAULT_DESIGN, ...rifasArr[0].ticket_design }
    : design;

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:20, justifyContent:'center', marginBottom:22 }}>
        {rifasArr.map(r => (
          <TicketPreview
            key={r.rifa_id || r.id || Math.random()}
            r={r} numero={numero}
            comprador={comprador} vendedor={vendedor}
            design={efectivo}
          />
        ))}
      </div>
      <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn-jordyn"
          onClick={() => printTickets(rifasArr, numero, comprador, vendedor, efectivo)}
          style={{ fontSize:'1rem', padding:'.75rem 2.2rem' }}>
          <i className="bi bi-printer-fill me-2"></i>
          IMPRIMIR {rifasArr.length > 1 ? 'BOLETOS' : 'BOLETO'} (2 COPIAS)
        </button>
        {onClose && (
          <button className="btn-jordyn-outline" onClick={onClose} style={{ padding:'.75rem 1.6rem' }}>
            <i className="bi bi-x-lg me-1"></i>CERRAR
          </button>
        )}
      </div>
    </div>
  );
}