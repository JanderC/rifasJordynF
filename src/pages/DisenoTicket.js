// ============================================================
//   DisenoTicket.js — Editor de Diseño de Ticket
//   RIFAS JORDYN
//   RF07: editor para diseño estilo LOTERÍA TRADICIONAL
//   ✅ Secciones colapsables (acordeón) para no abrumar
//   ✅ Editor de TODOS los textos (13) y TODOS los colores (16)
//   ✅ Paletas rápidas (tradicional, moderna, clásica, retro)
//   ✅ Botón "Restaurar diseño tradicional" con un solo click
//   ✅ Guarda en BD via PUT /api/ticket-design (sin localStorage)
//   ✅ Preview en tiempo real con fondo papel
//   ✅ Generador PDF integrado con el nuevo diseño
// ============================================================
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, DEFAULT_DESIGN, useTicketDesign } from '../components/Ticket';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ═══════════════════════════════════════════════════════
   HELPERS FECHA / DINERO (locales al editor)
═══════════════════════════════════════════════════════ */
const parseFechaPDF = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFechaPDF = (f) => {
  const d = parseFechaPDF(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', {
    day:'2-digit', month:'short', year:'numeric', timeZone:'America/Caracas',
  });
};
const fmtMoneyPDF = (p) => p
  ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(p)
  : '$0';

/* ═══════════════════════════════════════════════════════
   MINI TICKET PARA PDF (10 por hoja)
   Versión compacta del Ticket estilo lotería tradicional
═══════════════════════════════════════════════════════ */
const TW = 248; // mini-ticket width
const TH = 152; // mini-ticket height

const splitPremio = (premio) => {
  if (!premio) return { numero:'', texto:'' };
  const m = String(premio).trim().match(/^([\d.,]+)\s*(.*)$/);
  return m ? { numero:m[1], texto:m[2] || '' } : { numero:'', texto:String(premio) };
};
const fmtMilesPunto = (n) => {
  if (n == null || n === '') return '';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '';
  return num.toLocaleString('de-DE');
};
const fmtValorBoleto = (n) => {
  if (n == null) return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + ' Millón';
  if (num >= 1000)    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + ' Mil';
  return String(num);
};
const fmtFechaLoteriaMini = (f) => {
  const d = parseFechaPDF(f);
  if (!d) return 'Por definir';
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} - ${d.getUTCFullYear()}`;
};

function MiniTicketPDF({ rifa, numero, design: d }) {
  const D = { ...DEFAULT_DESIGN, ...(d || {}) };
  const { numero: premioNum, texto: premioTxt } = splitPremio(rifa?.premio);
  const fecha     = fmtFechaLoteriaMini(rifa?.fecha_sorteo);
  const valorTxt  = fmtValorBoleto(rifa?.precio);
  const subPremio = rifa?.premio_secundario ? fmtMilesPunto(rifa.premio_secundario) : '';
  const num       = String(numero).padStart(3, '0');
  const loteria   = rifa?.loteria_ref || D.loteriaText || '';
  const STROKE    = D.colorBorde || '#000';

  return (
    <div style={{
      width:TW, height:TH, background:D.bgPaper, border:`2px solid ${STROKE}`,
      display:'flex', position:'relative', overflow:'hidden',
      fontFamily:"'Poppins','Arial Black',sans-serif", flexShrink:0, boxSizing:'border-box',
    }}>
      {/* Talón vertical */}
      <div style={{
        width:38, flexShrink:0, borderRight:`1.5px dashed ${STROKE}`,
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'4px 2px', position:'relative',
      }}>
        <div style={{
          border:`1.5px solid ${STROKE}`, padding:'2px 5px',
          fontSize:9, fontWeight:900, color:D.colorTalon,
          letterSpacing:1, background:'#fff',
        }}>{num}</div>
        <div style={{
          position:'absolute', left:'50%', top:'58%',
          transform:'translate(-50%,-50%) rotate(-90deg)',
          fontSize:11, fontWeight:900, color:D.colorTalon,
          letterSpacing:2, whiteSpace:'nowrap', fontStyle:'italic',
        }}>{D.brandText}</div>
      </div>

      {/* Tira "BOLETO SIN CANCELAR..." */}
      <div style={{
        width:11, flexShrink:0, borderRight:`1px solid ${STROKE}`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          transform:'rotate(-90deg)', whiteSpace:'nowrap',
          fontSize:5, fontWeight:800, color:'#000', letterSpacing:.8,
        }}>{D.talonText}</div>
      </div>

      {/* Cuerpo */}
      <div style={{ flex:1, padding:'4px 5px', display:'flex', flexDirection:'column' }}>
        {/* Top: slogan + número */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:9, fontWeight:900, color:D.colorSlogan,
              letterSpacing:.3, textTransform:'uppercase', lineHeight:1,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{D.sloganTop}</div>
            <div style={{
              fontSize:8.5, fontWeight:800, color:D.colorFecha,
              fontStyle:'italic', lineHeight:1, marginTop:1,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{D.fechaPrefix} {fecha}</div>
          </div>
          <div style={{
            border:`1.5px solid ${STROKE}`, padding:'2px 5px',
            fontSize:9, fontWeight:900, color:D.colorTalon,
            letterSpacing:1, background:'#fff', marginLeft:3, flexShrink:0,
          }}>{num}</div>
        </div>

        {/* Premio gigante */}
        <div style={{ flex:1, display:'flex', alignItems:'center', marginTop:1 }}>
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
            <div style={{
              fontSize:8, fontWeight:800, fontStyle:'italic',
              color:D.colorPremio1, lineHeight:1, marginLeft:8,
              textShadow:`.7px .7px 0 ${STROKE}`,
            }}>{D.premioLabel}</div>
            <div style={{
              fontFamily:"'Arial Black',sans-serif", fontWeight:900,
              fontSize:34, lineHeight:.85, letterSpacing:.5,
              background:`linear-gradient(180deg,${D.colorPremio1} 0%,${D.colorPremio1} 48%,${D.colorPremio2} 52%,${D.colorPremio2} 100%)`,
              WebkitBackgroundClip:'text', backgroundClip:'text',
              WebkitTextFillColor:'transparent',
              WebkitTextStroke:`1px ${STROKE}`,
            }}>{premioNum || '500'}</div>
            {premioTxt && (
              <div style={{
                fontFamily:"'Brush Script MT','Lucida Handwriting',cursive",
                fontSize:13, fontWeight:700, color:D.colorDolares,
                fontStyle:'italic', lineHeight:1, marginTop:-4,
                marginLeft:'auto', marginRight:18,
                textShadow:`.7px .7px 0 ${STROKE}40`,
              }}>{premioTxt}</div>
            )}
            {subPremio && (
              <div style={{ display:'flex', alignItems:'baseline', gap:3, marginTop:1, marginLeft:3 }}>
                <span style={{
                  fontSize:10, fontWeight:900, color:D.colorSubPremio,
                  fontStyle:'italic',
                }}>{D.subPremioPrefix} {subPremio}</span>
                <span style={{
                  fontFamily:"'Brush Script MT',cursive",
                  fontSize:9, fontWeight:700, color:D.colorPesosSub,
                  fontStyle:'italic',
                }}>{D.subPremioMoneda}</span>
              </div>
            )}
          </div>

          {/* Caduca + lotería */}
          <div style={{
            width:54, flexShrink:0, display:'flex', flexDirection:'column',
            justifyContent:'space-between', alignSelf:'stretch', padding:'2px',
          }}>
            <div style={{
              writingMode:'vertical-rl',
              fontSize:6.5, fontWeight:700, color:D.colorCaduca,
              fontStyle:'italic', alignSelf:'flex-end',
            }}>{D.caducaText}</div>
            <div style={{
              textAlign:'right', fontSize:6.5, fontWeight:700,
              color:D.colorLoteria, lineHeight:1.1, fontStyle:'italic',
              marginTop:'auto',
            }}>{loteria}</div>
          </div>
        </div>

        {/* Bottom: motivacional + valor */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          marginTop:2, paddingTop:2, borderTop:`.7px dashed ${STROKE}40`,
        }}>
          <div style={{
            flex:1, fontSize:6.2, fontWeight:600, color:D.colorMotivac,
            fontStyle:'italic', lineHeight:1.1, paddingRight:3, maxWidth:'55%',
            overflow:'hidden',
          }}>{D.motivacionalText}</div>
          <div style={{ textAlign:'right', lineHeight:1 }}>
            <div style={{
              fontSize:10, fontWeight:900, color:D.colorBoleto, letterSpacing:.3,
            }}>{D.boletoLabel}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:2, justifyContent:'flex-end' }}>
              <span style={{
                fontSize:15, fontWeight:900, color:D.colorValor, fontStyle:'italic',
              }}>{valorTxt}</span>
              <span style={{
                fontSize:8, fontWeight:900, color:D.colorPesos,
              }}>{D.valorSufijo}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hoja PDF: 5×2 = 10 tickets ── */
function HojaPDF({ rifa, numeros, design }) {
  const COLS = 5, ROWS = 2;
  const GAP_X = 14, GAP_Y = 18;
  const PAD_X = 24, PAD_Y = 22;
  const sheetW = PAD_X * 2 + COLS * TW + (COLS - 1) * GAP_X;
  const sheetH = PAD_Y * 2 + ROWS * TH + (ROWS - 1) * GAP_Y;

  return (
    <div style={{
      width:sheetW, height:sheetH, background:'#e8e8e0',
      padding:`${PAD_Y}px ${PAD_X}px`,
      display:'grid',
      gridTemplateColumns:`repeat(${COLS}, ${TW}px)`,
      gridTemplateRows:`repeat(${ROWS}, ${TH}px)`,
      columnGap:GAP_X, rowGap:GAP_Y, boxSizing:'border-box',
    }}>
      {numeros.map((n, i) => (
        <MiniTicketPDF key={i} rifa={rifa} numero={n} design={design} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GENERADOR PDF
═══════════════════════════════════════════════════════ */
function GeneradorPDF({ design, rifas, loadingRifas }) {
  const [rifaId,    setRifaId]    = useState('');
  const [numInicio, setNumInicio] = useState(1);
  const [paginas,   setPaginas]   = useState(1);
  const [generando, setGenerando] = useState(false);
  const [progreso,  setProgreso]  = useState(0);

  const rifaActual   = rifas.find(r => String(r.id) === String(rifaId));
  const totalTickets = paginas * 10;

  const handleGenerar = async () => {
    if (!rifaActual) { toast.warning('Selecciona una rifa primero'); return; }
    setGenerando(true);
    setProgreso(0);

    await document.fonts.load('900 32px Poppins');
    await document.fonts.load('700 10px Poppins');

    const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'letter' });

    for (let pg = 0; pg < paginas; pg++) {
      const nums = Array.from({ length:10 }, (_, i) => numInicio + pg * 10 + i);
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-999;';
      document.body.appendChild(div);

      const { createRoot } = await import('react-dom/client');
      const { createElement } = await import('react');
      const root = createRoot(div);

      await new Promise(resolve => {
        root.render(createElement(HojaPDF, { rifa:rifaActual, numeros:nums, design }));
        setTimeout(resolve, 1200);
      });

      const canvas = await html2canvas(div.firstChild, {
        scale:4, useCORS:true, backgroundColor:'#e8e8e0',
        logging:false, allowTaint:true, imageTimeout:0,
      });

      root.unmount();
      document.body.removeChild(div);

      if (pg > 0) pdf.addPage();
      const imgW = 271, imgH = (canvas.height / canvas.width) * imgW;
      const offY = (208 - imgH) / 2;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 4, Math.max(4, offY), imgW, imgH);
      setProgreso(Math.round(((pg + 1) / paginas) * 100));
    }

    const fn = `tickets_${(rifaActual.nombre||'rifa').replace(/\s+/g,'_')}_${numInicio}-${numInicio + totalTickets - 1}.pdf`;
    pdf.save(fn);
    toast.success(`✅ PDF generado: ${totalTickets} tickets`);
    setGenerando(false);
  };

  const S = {
    card:  { background:'var(--jordyn-card, #12241f)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'18px 20px' },
    label: { fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1.5px', display:'block', marginBottom:5 },
    sel:   { width:'100%', padding:'8px 10px', background:'#0d1a16', border:'1px solid var(--jordyn-border)', borderRadius:6, color:'#d4eeee', fontSize:'.88rem', outline:'none' },
    inp:   { width:'100%', padding:'8px 10px', background:'#0d1a16', border:'1px solid var(--jordyn-border)', borderRadius:6, color:'#d4eeee', fontSize:'.88rem', outline:'none', boxSizing:'border-box' },
    badge: { display:'inline-block', background:'rgba(240,165,0,.15)', border:'1px solid rgba(240,165,0,.35)', color:'var(--jordyn-gold, #f0a500)', fontSize:'.62rem', fontWeight:700, padding:'1px 8px', borderRadius:10, marginLeft:8 },
    prog:  { height:4, background:'var(--jordyn-border)', borderRadius:2, overflow:'hidden', marginTop:8 },
    fill:  { height:'100%', background:'linear-gradient(90deg,#0abfbc,#f0a500)', transition:'width .3s' },
  };

  return (
    <div style={S.card}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'rgba(10,191,188,.15)', border:'1px solid rgba(10,191,188,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🎟</div>
        <div>
          <div style={{ fontSize:'.72rem', fontWeight:800, color:'var(--jordyn-primary, #0abfbc)', textTransform:'uppercase', letterSpacing:'1.5px' }}>
            Generar PDF de Tickets
          </div>
          <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:1 }}>
            10 boletos por hoja con el diseño actual
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>
        <div style={{ gridColumn:'1 / -1' }}>
          <label style={S.label}>Rifa</label>
          {loadingRifas
            ? <div style={{ fontSize:'.8rem', color:'var(--jordyn-muted)' }}>Cargando rifas…</div>
            : (
              <select style={S.sel} value={rifaId} onChange={e => setRifaId(e.target.value)}>
                <option value="">— Selecciona una rifa —</option>
                {rifas.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                    {r.estado === 'activa' ? ' ✅' : ''}
                    {r.fecha_sorteo ? ` · ${fmtFechaPDF(r.fecha_sorteo)}` : ''}
                  </option>
                ))}
              </select>
            )}
        </div>

        {rifaActual && (
          <div style={{ gridColumn:'1 / -1', background:'rgba(10,191,188,0.05)', border:'1px solid rgba(10,191,188,0.15)', borderRadius:7, padding:'9px 13px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px 12px' }}>
            {[
              ['Premio',  rifaActual.premio],
              ['Sorteo',  fmtFechaPDF(rifaActual.fecha_sorteo)],
              ['Precio',  fmtMoneyPDF(rifaActual.precio)],
              ['Lotería', rifaActual.loteria_ref],
            ].filter(([,v]) => v).map(([l, v]) => (
              <div key={l} style={{ padding:'2px 0' }}>
                <div style={{ fontSize:'.55rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
                <div style={{ fontSize:'.75rem', fontWeight:700, color:'#d4eeee', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label style={S.label}>Número inicial</label>
          <input type="number" min={0} max={9990} style={S.inp}
            value={numInicio}
            onChange={e => setNumInicio(Math.max(0, parseInt(e.target.value) || 0))} />
        </div>

        <div>
          <label style={S.label}>
            Hojas <span style={S.badge}>{totalTickets} tickets</span>
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="range" min={1} max={20} step={1}
              value={paginas}
              onChange={e => setPaginas(Number(e.target.value))}
              style={{ flex:1 }} />
            <span style={{ minWidth:22, textAlign:'center', fontWeight:700, color:'var(--jordyn-primary, #0abfbc)', fontSize:'.9rem' }}>{paginas}</span>
          </div>
          <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:3 }}>
            Números {numInicio} → {numInicio + totalTickets - 1}
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <button className="btn-jordyn"
            style={{ width:'100%', fontSize:'.9rem', opacity:(!rifaActual || generando) ? .5 : 1, cursor:(!rifaActual || generando) ? 'not-allowed' : 'pointer' }}
            disabled={!rifaActual || generando}
            onClick={handleGenerar}>
            {generando
              ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span>&nbsp; Generando… {progreso}%</>
              : <><i className="bi bi-file-earmark-pdf-fill me-2"></i>Descargar PDF ({paginas} {paginas === 1 ? 'hoja' : 'hojas'})</>
            }
          </button>
          {generando && (
            <div style={S.prog}><div style={{ ...S.fill, width:`${progreso}%` }} /></div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DATOS DEMO PARA PREVIEW
═══════════════════════════════════════════════════════ */
const DEMO_RIFA = {
  rifa_nombre:       'GRAN RIFA',
  premio:            '500 Dólares',
  premio_secundario: 2000000,
  precio:            6000,
  fecha_sorteo:      '2026-05-18T22:10:00',
  loteria_ref:       'Triple Táchira "A" 10:10 Pm',
};
const DEMO_COMPRADOR = {
  nombre:   'María González',
  telefono: '+584141234567',
  cedula:   '12345678',
};

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTES DE CONTROL
═══════════════════════════════════════════════════════ */
function TextField({ label, hint, value, onChange, placeholder, multiline }) {
  const Comp = multiline ? 'textarea' : 'input';
  return (
    <div>
      <label className="jd-label">{label}</label>
      <Comp
        className="jd-input"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 2 : undefined}
        style={multiline ? { resize:'vertical', minHeight:48, fontFamily:'inherit' } : undefined}
      />
      {hint && <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function ColorField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="jd-label">{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="color" value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{
            width:38, height:38, padding:3,
            border:'1.5px solid var(--jordyn-border)',
            borderRadius:8, cursor:'pointer', background:'none', flexShrink:0,
          }} />
        <input className="jd-input" value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.85rem' }}
          maxLength={7} />
      </div>
      {hint && <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

/* ── SizeField: control de tamaño tipo Word (en puntos) ──
   - Dropdown con tamaños comunes tipo Word: 8, 10, 12, 14, 16, 18, 24, 36, 48, 72
   - Botones − / + para ajustar de 1 en 1
   - Input numérico editable
   - Slider para ajuste fino
   - El valor se interpreta en pt (1pt ≈ 1.333px en pantalla)               */
const TAMANOS_WORD = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 42, 48, 54, 60, 72, 80, 96];

function SizeField({ label, hint, value, onChange, min=6, max=120, step=1 }) {
  const v = Number(value) || 0;
  const dec = () => onChange(Math.max(min, v - step));
  const inc = () => onChange(Math.min(max, v + step));
  const setNum = (n) => {
    const num = parseInt(n) || min;
    onChange(Math.max(min, Math.min(max, num)));
  };

  // Filtrar dropdown según min/max permitidos
  const opciones = TAMANOS_WORD.filter(t => t >= min && t <= max);

  return (
    <div>
      <label className="jd-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>{label}</span>
        <span style={{
          fontSize:Math.min(28, Math.max(11, v * 0.7)),
          fontWeight:900, color:'var(--jordyn-primary)',
          fontFamily:"'Poppins',sans-serif", lineHeight:1,
        }}>Aa</span>
      </label>

      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {/* Botón − */}
        <button onClick={dec} disabled={v <= min} title="Reducir 1pt"
          style={{
            width:30, height:32, flexShrink:0,
            border:'1.5px solid var(--jordyn-border)', borderRadius:6,
            background:'rgba(10,191,188,.08)', color:'var(--jordyn-primary)',
            fontSize:'1.1rem', fontWeight:900,
            cursor: v <= min ? 'not-allowed' : 'pointer',
            opacity: v <= min ? .35 : 1, padding:0, lineHeight:1,
          }}>−</button>

        {/* Dropdown tipo Word (tamaños comunes) */}
        <select value={opciones.includes(v) ? v : ''}
          onChange={e => e.target.value && onChange(Number(e.target.value))}
          title="Tamaños comunes"
          style={{
            height:32, padding:'0 4px',
            background:'#0d1a16',
            border:'1.5px solid var(--jordyn-border)',
            borderRadius:6, color:'var(--jordyn-primary)',
            fontWeight:700, fontSize:'.78rem', cursor:'pointer',
            fontFamily:'monospace',
          }}>
          <option value="" disabled>{v}pt</option>
          {opciones.map(t => (
            <option key={t} value={t}>{t} pt</option>
          ))}
        </select>

        {/* Input numérico manual */}
        <input type="number" value={v} min={min} max={max} step={step}
          onChange={e => setNum(e.target.value)}
          className="jd-input"
          title="Escribe el tamaño manualmente"
          style={{
            width:52, textAlign:'center',
            fontFamily:'monospace', fontWeight:700, fontSize:'.9rem',
            padding:'6px 2px', height:32,
          }} />

        {/* Botón + */}
        <button onClick={inc} disabled={v >= max} title="Aumentar 1pt"
          style={{
            width:30, height:32, flexShrink:0,
            border:'1.5px solid var(--jordyn-border)', borderRadius:6,
            background:'rgba(10,191,188,.08)', color:'var(--jordyn-primary)',
            fontSize:'1.1rem', fontWeight:900,
            cursor: v >= max ? 'not-allowed' : 'pointer',
            opacity: v >= max ? .35 : 1, padding:0, lineHeight:1,
          }}>+</button>
      </div>

      {/* Slider más sutil debajo */}
      <input type="range" value={v} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:'100%', marginTop:6, accentColor:'var(--jordyn-primary)' }} />

      {hint && <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}
function Section({ title, icon, defaultOpen=false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="jd-card" style={{ padding:0, overflow:'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', padding:'12px 16px',
          background:'transparent', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          color:'var(--jordyn-primary)', textAlign:'left',
        }}>
        <span style={{
          fontSize:'.72rem', fontWeight:800,
          textTransform:'uppercase', letterSpacing:1,
          display:'flex', alignItems:'center', gap:8,
        }}>
          {icon && <i className={`bi ${icon}`}></i>}
          {title}
          {badge && (
            <span style={{
              fontSize:'.55rem', background:'rgba(10,191,188,.15)',
              border:'1px solid rgba(10,191,188,.3)', borderRadius:10,
              padding:'1px 7px', letterSpacing:.5,
            }}>{badge}</span>
          )}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'.85rem' }}></i>
      </button>
      {open && (
        <div style={{
          padding:'4px 16px 18px',
          display:'flex', flexDirection:'column', gap:12,
          borderTop:'1px solid var(--jordyn-border)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PALETAS RÁPIDAS (todas con paleta completa)
═══════════════════════════════════════════════════════ */
const PALETAS = [
  {
    name:'Tradicional (referencia)',
    desc:'Estilo boleto físico clásico',
    colors: {
      colorSlogan:'#d92626', colorFecha:'#1a3a8a',
      colorPremio1:'#f5c518', colorPremio2:'#1565d8',
      colorDolares:'#d92626', colorSubPremio:'#c41e7a',
      colorPesosSub:'#2e8b3e', colorBoleto:'#1565d8',
      colorValor:'#d92626', colorPesos:'#2e8b3e',
      colorMotivac:'#1a1a1a', colorTalon:'#1565d8',
      colorCaduca:'#1a1a1a', colorLoteria:'#1a1a1a',
      colorBorde:'#000000', bgPaper:'#f5f5f0',
    },
  },
  {
    name:'Tricolor venezolano',
    desc:'Amarillo, azul y rojo',
    colors: {
      colorSlogan:'#cf142b', colorFecha:'#003893',
      colorPremio1:'#fcd116', colorPremio2:'#003893',
      colorDolares:'#cf142b', colorSubPremio:'#cf142b',
      colorPesosSub:'#003893', colorBoleto:'#003893',
      colorValor:'#cf142b', colorPesos:'#fcd116',
      colorMotivac:'#000', colorTalon:'#003893',
      colorCaduca:'#000', colorLoteria:'#000',
      colorBorde:'#000', bgPaper:'#fffdf2',
    },
  },
  {
    name:'Tricolor colombiano',
    desc:'Amarillo, azul y rojo (Colombia)',
    colors: {
      colorSlogan:'#ce1126', colorFecha:'#003893',
      colorPremio1:'#fcd116', colorPremio2:'#003893',
      colorDolares:'#ce1126', colorSubPremio:'#ce1126',
      colorPesosSub:'#2e8b3e', colorBoleto:'#003893',
      colorValor:'#ce1126', colorPesos:'#2e8b3e',
      colorMotivac:'#000', colorTalon:'#003893',
      colorCaduca:'#000', colorLoteria:'#000',
      colorBorde:'#000', bgPaper:'#fffdf2',
    },
  },
  {
    name:'Sobrio elegante',
    desc:'Tonos serios para impresión B/N',
    colors: {
      colorSlogan:'#5a1a1a', colorFecha:'#1a2a4a',
      colorPremio1:'#a0742a', colorPremio2:'#3a3a3a',
      colorDolares:'#5a1a1a', colorSubPremio:'#5a1a1a',
      colorPesosSub:'#2a4a2a', colorBoleto:'#1a2a4a',
      colorValor:'#5a1a1a', colorPesos:'#2a4a2a',
      colorMotivac:'#333', colorTalon:'#1a2a4a',
      colorCaduca:'#333', colorLoteria:'#333',
      colorBorde:'#1a1a1a', bgPaper:'#f8f5ee',
    },
  },
  {
    name:'Neón retro',
    desc:'Verde, magenta y cian intensos',
    colors: {
      colorSlogan:'#ff006e', colorFecha:'#3a86ff',
      colorPremio1:'#ffbe0b', colorPremio2:'#8338ec',
      colorDolares:'#ff006e', colorSubPremio:'#ff006e',
      colorPesosSub:'#06d6a0', colorBoleto:'#3a86ff',
      colorValor:'#ff006e', colorPesos:'#06d6a0',
      colorMotivac:'#000', colorTalon:'#3a86ff',
      colorCaduca:'#000', colorLoteria:'#000',
      colorBorde:'#000', bgPaper:'#fffce8',
    },
  },
  {
    name:'Esmeralda',
    desc:'Verde y dorado para premios grandes',
    colors: {
      colorSlogan:'#0a7c3e', colorFecha:'#0a4d2e',
      colorPremio1:'#f0c419', colorPremio2:'#0a7c3e',
      colorDolares:'#c0392b', colorSubPremio:'#0a4d2e',
      colorPesosSub:'#c0392b', colorBoleto:'#0a7c3e',
      colorValor:'#c0392b', colorPesos:'#0a4d2e',
      colorMotivac:'#1a1a1a', colorTalon:'#0a7c3e',
      colorCaduca:'#1a1a1a', colorLoteria:'#1a1a1a',
      colorBorde:'#0a2a1a', bgPaper:'#f5f8f2',
    },
  },
];

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function DisenoTicket() {
  const { design: designBD, loading: loadingBD, reload } = useTicketDesign();
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [saving, setSaving] = useState(false);
  const [dirty,  setDirty]  = useState(false);

  const [rifas,        setRifas]        = useState([]);
  const [loadingRifas, setLoadingRifas] = useState(true);

  useEffect(() => {
    API.get('/rifas')
      .then(r => setRifas(r.data || []))
      .catch(() => toast.error('Error cargando rifas'))
      .finally(() => setLoadingRifas(false));
  }, []);

  useEffect(() => {
    if (!loadingBD) {
      setDesign({ ...DEFAULT_DESIGN, ...designBD });
      setDirty(false);
    }
  }, [loadingBD, designBD]);

  const upd = (key, val) => {
    setDesign(p => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const aplicarPaleta = (p) => {
    setDesign(prev => ({ ...prev, ...p.colors }));
    setDirty(true);
    toast.info(`Paleta aplicada: ${p.name}`);
  };

  const aplicarTamanos = (factor, nombre) => {
    // Escala TODOS los tamaños del diseño por un factor (1.0 = normal, en pt)
    const ROUND = (n) => Math.max(6, Math.round(n));
    const escalado = {
      sizeBrand:       ROUND(22 * factor),
      sizeNumTalon:    ROUND(20 * factor),
      sizeNumDer:      ROUND(20 * factor),
      sizeNombre:      ROUND(10 * factor),
      sizeTalonText:   ROUND(8 * factor),
      sizeSlogan:      ROUND(18 * factor),
      sizeFecha:       ROUND(16 * factor),
      sizePremioLabel: ROUND(18 * factor),
      sizePremioNum:   ROUND(78 * factor),
      sizePremioTxt:   ROUND(26 * factor),
      sizeSubPremio:   ROUND(24 * factor),
      sizeSubMoneda:   ROUND(20 * factor),
      sizeCaduca:      ROUND(11 * factor),
      sizeLoteria:     ROUND(11 * factor),
      sizeMotivac:     ROUND(11 * factor),
      sizeBoleto:      ROUND(20 * factor),
      sizeValor:       ROUND(32 * factor),
      sizePesos:       ROUND(16 * factor),
      sizeFooter:      ROUND(7 * factor),
    };
    setDesign(prev => ({ ...prev, ...escalado }));
    setDirty(true);
    toast.info(`Tamaños: ${nombre}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/ticket-design', { design });
      toast.success('✅ Diseño guardado en la base de datos');
      setDirty(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando diseño');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (!window.confirm('¿Restaurar el diseño por defecto? Se perderán los cambios no guardados.')) return;
    setDesign({ ...DEFAULT_DESIGN });
    setDirty(true);
  };

  if (loadingBD) return (
    <Layout title="DISEÑO DEL TICKET">
      <div className="d-flex justify-content-center mt-5">
        <div className="jd-spinner" style={{ width:40, height:40 }}></div>
      </div>
    </Layout>
  );

  return (
    <Layout title="DISEÑO DEL TICKET">

      {/* ── Barra superior: estado + acciones ── */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div style={{ fontSize:'.8rem', color:'var(--jordyn-muted)' }}>
          <i className="bi bi-palette-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
          El diseño se guarda en la base de datos y aplica a todos los boletos.
          {dirty && (
            <span style={{
              marginLeft:10,
              background:'rgba(240,165,0,.12)',
              border:'1px solid rgba(240,165,0,.3)',
              color:'var(--jordyn-gold)',
              borderRadius:20, padding:'1px 10px',
              fontSize:'.65rem', fontWeight:700,
            }}>● Cambios sin guardar</span>
          )}
        </div>
        <div className="d-flex gap-2">
          <button className="btn-jordyn-outline" onClick={handleReset} style={{ fontSize:'.82rem' }}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>Resetear
          </button>
          <button className="btn-jordyn" onClick={handleSave}
            disabled={saving || !dirty} style={{ fontSize:'.88rem' }}>
            {saving
              ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando...</>
              : <><i className="bi bi-floppy-fill me-1"></i>Guardar diseño</>
            }
          </button>
        </div>
      </div>

      <div className="ticket-editor-grid"
        style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:24, alignItems:'start' }}>

        {/* ════════════════════════════════════════════════
            PANEL CONTROLES (acordeón)
        ════════════════════════════════════════════════ */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

          {/* ─── Paletas rápidas (siempre visibles arriba) ─── */}
          <div className="jd-card jd-card-primary">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
              <i className="bi bi-magic me-1"></i>Paletas predefinidas
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {PALETAS.map(p => (
                <button key={p.name}
                  onClick={() => aplicarPaleta(p)}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'7px 10px', background:'transparent',
                    border:'1px solid var(--jordyn-border)', borderRadius:8,
                    cursor:'pointer', textAlign:'left',
                    color:'var(--jordyn-text, #d4eeee)',
                    transition:'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(10,191,188,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{
                    width:38, height:24, borderRadius:4, flexShrink:0,
                    background:`linear-gradient(90deg,${p.colors.colorPremio1} 0%,${p.colors.colorPremio1} 33%,${p.colors.colorPremio2} 33%,${p.colors.colorPremio2} 66%,${p.colors.colorDolares} 66%,${p.colors.colorDolares} 100%)`,
                    border:`1px solid ${p.colors.colorBorde}`,
                  }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.78rem', fontWeight:700, lineHeight:1.1 }}>{p.name}</div>
                    <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:1 }}>{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Tamaños rápidos (siempre visibles) ─── */}
          <div className="jd-card jd-card-primary">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
              <i className="bi bi-fonts me-1"></i>Tamaños de letra
            </div>
            <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginBottom:10 }}>
              Aplica un tamaño general a TODAS las letras del boleto, como zoom de Word
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[
                { label:'Pequeño',     factor:0.75, icon:'A',  fontSize:11 },
                { label:'Normal',      factor:1.00, icon:'A',  fontSize:14 },
                { label:'Grande',      factor:1.20, icon:'A',  fontSize:18 },
                { label:'Extra grande',factor:1.40, icon:'A',  fontSize:22 },
              ].map(p => (
                <button key={p.label}
                  onClick={() => aplicarTamanos(p.factor, p.label)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    padding:'8px 10px', background:'transparent',
                    border:'1px solid var(--jordyn-border)', borderRadius:8,
                    cursor:'pointer', color:'var(--jordyn-text, #d4eeee)',
                    transition:'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(10,191,188,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span style={{
                    fontSize:p.fontSize, fontWeight:900, color:'var(--jordyn-primary)',
                    lineHeight:1, fontFamily:"'Poppins',sans-serif",
                  }}>{p.icon}</span>
                  <span style={{ fontSize:'.75rem', fontWeight:700 }}>{p.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:8, fontStyle:'italic' }}>
              También puedes ajustar cada texto individualmente abajo
            </div>
          </div>
          <Section title="Marca y slogan" icon="bi-tag-fill" defaultOpen badge="6 campos">
            <TextField label='Nombre vertical del talón'
              value={design.brandText} onChange={v => upd('brandText', v)}
              placeholder="GRAN RIFA"
              hint='Texto grande rotado del talón izquierdo' />
            <TextField label='Slogan superior (rojo)'
              value={design.sloganTop} onChange={v => upd('sloganTop', v)}
              placeholder="RESUELVE DE INICIO DE SEMANA" />
            <TextField label='Prefijo de fecha'
              value={design.fechaPrefix} onChange={v => upd('fechaPrefix', v)}
              placeholder="Juega El"
              hint='Antes de la fecha del sorteo' />
            <TextField label='Texto del talón vertical'
              value={design.talonText} onChange={v => upd('talonText', v)}
              placeholder="BOLETO SIN CANCELAR NO JUEGA" />
            <TextField label='Marca de agua (opcional)'
              value={design.watermarkText} onChange={v => upd('watermarkText', v)}
              placeholder="JORDYN" />
            <TextField label='Pie de página pequeño'
              value={design.footerText} onChange={v => upd('footerText', v)}
              placeholder="Conserve este boleto..." />
          </Section>

          {/* ─── Sección 2: Premio principal ─── */}
          <Section title="Premio principal" icon="bi-trophy-fill" badge="2 campos">
            <TextField label='Etiqueta "Premio"'
              value={design.premioLabel} onChange={v => upd('premioLabel', v)}
              placeholder="Premio"
              hint='Texto en cursiva sobre el número grande' />
            <TextField label='Hora del sorteo (anula la BD)'
              value={design.horaSort} onChange={v => upd('horaSort', v)}
              placeholder="10:10 PM"
              hint='Vacío = usa la hora de la fecha del sorteo' />
            <div className="jd-alert jd-alert-info">
              <i className="bi bi-info-circle-fill"></i>
              <span style={{ fontSize:'.7rem' }}>
                El número grande del premio (ej: <b>500</b>) y su texto (<b>Dólares</b>) se toman del campo "Premio" de cada rifa.
              </span>
            </div>
          </Section>

          {/* ─── Sección 3: Sub-premio (pesos) ─── */}
          <Section title="Sub-premio en pesos" icon="bi-cash-stack" badge="2 campos">
            <TextField label='Prefijo del sub-premio'
              value={design.subPremioPrefix} onChange={v => upd('subPremioPrefix', v)}
              placeholder="ó"
              hint='Ej: "ó", "o bien", "/"...' />
            <TextField label='Moneda del sub-premio'
              value={design.subPremioMoneda} onChange={v => upd('subPremioMoneda', v)}
              placeholder="Pesos"
              hint='Ej: "Pesos", "Bolívares", "COP"' />
            <div className="jd-alert jd-alert-info">
              <i className="bi bi-info-circle-fill"></i>
              <span style={{ fontSize:'.7rem' }}>
                El monto del sub-premio (ej: 2.000.000) se toma del campo <b>premio_secundario</b> de cada rifa. Si la rifa no lo tiene, el sub-premio no aparece.
              </span>
            </div>
          </Section>

          {/* ─── Sección 4: Caducidad y lotería ─── */}
          <Section title="Caducidad y lotería" icon="bi-clock-history" badge="2 campos">
            <TextField label='Texto de caducidad (vertical)'
              value={design.caducaText} onChange={v => upd('caducaText', v)}
              placeholder="Caduca a los 8 días" />
            <TextField label='Lotería y hora (por defecto)'
              value={design.loteriaText} onChange={v => upd('loteriaText', v)}
              placeholder='Triple Táchira "A" 10:10 Pm'
              hint='Si la rifa tiene loteria_ref propia, se usa esa' />
          </Section>

          {/* ─── Sección 5: Valor del boleto ─── */}
          <Section title="Etiqueta del valor" icon="bi-ticket-perforated-fill" badge="2 campos">
            <TextField label='Etiqueta "BOLETO"'
              value={design.boletoLabel} onChange={v => upd('boletoLabel', v)}
              placeholder="BOLETO" />
            <TextField label='Sufijo del valor'
              value={design.valorSufijo} onChange={v => upd('valorSufijo', v)}
              placeholder="PESOS"
              hint='Ej: "PESOS", "Bs", "USD"' />
          </Section>

          {/* ─── Sección 6: Frase motivacional ─── */}
          <Section title="Frase motivacional" icon="bi-chat-quote-fill" badge="1 campo">
            <TextField label='Texto motivacional'
              value={design.motivacionalText} onChange={v => upd('motivacionalText', v)}
              placeholder="Prueba Tu Suerte y Ganate Este Fabuloso Premio!"
              multiline />
          </Section>

          {/* ─── Sección 7: Colores principales ─── */}
          <Section title="Colores: textos y premio" icon="bi-palette-fill" badge="8 colores">
            <ColorField label='Slogan superior' value={design.colorSlogan} onChange={v => upd('colorSlogan', v)} />
            <ColorField label='Fecha del sorteo' value={design.colorFecha}  onChange={v => upd('colorFecha', v)} />
            <ColorField label='Premio — color arriba'
              value={design.colorPremio1} onChange={v => upd('colorPremio1', v)}
              hint='Mitad superior del número gigante' />
            <ColorField label='Premio — color abajo'
              value={design.colorPremio2} onChange={v => upd('colorPremio2', v)}
              hint='Mitad inferior del número gigante' />
            <ColorField label='Texto del premio (Dólares)'
              value={design.colorDolares} onChange={v => upd('colorDolares', v)} />
            <ColorField label='Sub-premio (números)'
              value={design.colorSubPremio} onChange={v => upd('colorSubPremio', v)} />
            <ColorField label='Sub-premio (palabra "Pesos")'
              value={design.colorPesosSub} onChange={v => upd('colorPesosSub', v)} />
            <ColorField label='Frase motivacional'
              value={design.colorMotivac} onChange={v => upd('colorMotivac', v)} />
          </Section>

          {/* ─── Sección 8: Colores secundarios ─── */}
          <Section title="Colores: valor y otros" icon="bi-palette" badge="8 colores">
            <ColorField label='Etiqueta "BOLETO"'
              value={design.colorBoleto} onChange={v => upd('colorBoleto', v)} />
            <ColorField label='Valor del boleto (6 Mil)'
              value={design.colorValor} onChange={v => upd('colorValor', v)} />
            <ColorField label='Sufijo "PESOS"'
              value={design.colorPesos} onChange={v => upd('colorPesos', v)} />
            <ColorField label='Número del talón + "GRAN RIFA"'
              value={design.colorTalon} onChange={v => upd('colorTalon', v)} />
            <ColorField label='"Caduca a los 8 días"'
              value={design.colorCaduca} onChange={v => upd('colorCaduca', v)} />
            <ColorField label='Lotería y hora'
              value={design.colorLoteria} onChange={v => upd('colorLoteria', v)} />
            <ColorField label='Borde del boleto'
              value={design.colorBorde} onChange={v => upd('colorBorde', v)}
              hint='También afecta sombras y separadores' />
            <ColorField label='Fondo (color del papel)'
              value={design.bgPaper} onChange={v => upd('bgPaper', v)}
              hint='Usa tonos claros tipo papel' />
          </Section>

          {/* ─── Sección 9: Tamaños — Premio y números grandes ─── */}
          <Section title="Tamaños: premio y números" icon="bi-arrows-fullscreen" badge="6 tamaños">
            <SizeField label='Número GIGANTE del premio (500)'
              value={design.sizePremioNum} onChange={v => upd('sizePremioNum', v)}
              min={24} max={120}
              hint='El número grande con doble color amarillo/azul · default 78pt' />
            <SizeField label='Palabra "Premio" (cursiva)'
              value={design.sizePremioLabel} onChange={v => upd('sizePremioLabel', v)}
              min={8} max={48} />
            <SizeField label='Texto del premio ("Dólares")'
              value={design.sizePremioTxt} onChange={v => upd('sizePremioTxt', v)}
              min={10} max={60} />
            <SizeField label='Sub-premio: número (2.000.000)'
              value={design.sizeSubPremio} onChange={v => upd('sizeSubPremio', v)}
              min={8} max={48} />
            <SizeField label='Sub-premio: "Pesos"'
              value={design.sizeSubMoneda} onChange={v => upd('sizeSubMoneda', v)}
              min={8} max={42} />
            <SizeField label='Valor del boleto ("6 Mil")'
              value={design.sizeValor} onChange={v => upd('sizeValor', v)}
              min={10} max={60} />
          </Section>

          {/* ─── Sección 10: Tamaños — Textos del encabezado ─── */}
          <Section title="Tamaños: encabezado y talón" icon="bi-fonts" badge="7 tamaños">
            <SizeField label='Slogan superior rojo'
              value={design.sizeSlogan} onChange={v => upd('sizeSlogan', v)}
              min={8} max={42} />
            <SizeField label='Fecha del sorteo'
              value={design.sizeFecha} onChange={v => upd('sizeFecha', v)}
              min={8} max={36} />
            <SizeField label='"GRAN RIFA" (vertical del talón)'
              value={design.sizeBrand} onChange={v => upd('sizeBrand', v)}
              min={10} max={54} />
            <SizeField label='Número del talón izquierdo'
              value={design.sizeNumTalon} onChange={v => upd('sizeNumTalon', v)}
              min={10} max={48} />
            <SizeField label='Número derecho (cabecera)'
              value={design.sizeNumDer} onChange={v => upd('sizeNumDer', v)}
              min={10} max={48} />
            <SizeField label='"NOMBRE:" del talón'
              value={design.sizeNombre} onChange={v => upd('sizeNombre', v)}
              min={6} max={22} />
            <SizeField label='Texto vertical del talón'
              value={design.sizeTalonText} onChange={v => upd('sizeTalonText', v)}
              min={6} max={16}
              hint='"BOLETO SIN CANCELAR NO JUEGA"' />
          </Section>

          {/* ─── Sección 11: Tamaños — Pie y otros textos ─── */}
          <Section title="Tamaños: pie y textos secundarios" icon="bi-text-paragraph" badge="6 tamaños">
            <SizeField label='Etiqueta "BOLETO"'
              value={design.sizeBoleto} onChange={v => upd('sizeBoleto', v)}
              min={8} max={42} />
            <SizeField label='Sufijo "PESOS"'
              value={design.sizePesos} onChange={v => upd('sizePesos', v)}
              min={6} max={30} />
            <SizeField label='"Caduca a los 8 días"'
              value={design.sizeCaduca} onChange={v => upd('sizeCaduca', v)}
              min={6} max={24} />
            <SizeField label='Lotería y hora'
              value={design.sizeLoteria} onChange={v => upd('sizeLoteria', v)}
              min={6} max={24} />
            <SizeField label='Frase motivacional'
              value={design.sizeMotivac} onChange={v => upd('sizeMotivac', v)}
              min={6} max={24} />
            <SizeField label='Pie de página pequeño'
              value={design.sizeFooter} onChange={v => upd('sizeFooter', v)}
              min={5} max={14} />
          </Section>

          {/* ─── Sección 12: Tamaño del ticket completo ─── */}
          <Section title="Dimensiones del boleto" icon="bi-aspect-ratio" badge="2 medidas">
            <SizeField label='Ancho del ticket'
              value={design.ticketWidth} onChange={v => upd('ticketWidth', v)}
              min={500} max={1200} step={10}
              hint='Ancho total en píxeles (default: 780)' />
            <SizeField label='Alto mínimo del ticket'
              value={design.ticketHeight} onChange={v => upd('ticketHeight', v)}
              min={200} max={600} step={10}
              hint='Alto mínimo en píxeles (default: 340)' />
          </Section>

          <div className="jd-alert jd-alert-info">
            <i className="bi bi-info-circle-fill"></i>
            <span>
              Si una rifa tiene <b>ticket_design</b> propio configurado individualmente, ese tiene prioridad sobre este diseño global.
            </span>
          </div>

        </div>

        {/* ════════════════════════════════════════════════
            PREVIEW EN VIVO
        ════════════════════════════════════════════════ */}
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
            <i className="bi bi-eye-fill me-1"></i>Vista previa en tiempo real
          </div>

          {/* Fondo claro para que el ticket de papel contraste */}
          <div style={{
            background:'#cfd4d0',
            borderRadius:14,
            padding:24,
            boxShadow:'inset 0 2px 12px rgba(0,0,0,.15)',
          }}>
            <TicketPreview
              r={DEMO_RIFA}
              numero="023"
              comprador={DEMO_COMPRADOR}
              vendedor="Admin"
              design={design}
            />
          </div>

          <div style={{ marginTop:10, fontSize:'.68rem', color:'var(--jordyn-muted)', textAlign:'center' }}>
            Vista de ejemplo con datos ficticios · El boleto real usará los datos de la rifa y comprador
          </div>
        </div>

      </div>

      {/* Responsive: en mobile el preview va debajo */}
      <style>{`
        @media (max-width: 900px) {
          .ticket-editor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ════ GENERADOR PDF ════ */}
      <div style={{ marginTop:32, borderTop:'1px solid var(--jordyn-border)', paddingTop:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <i className="bi bi-file-earmark-pdf-fill" style={{ color:'var(--jordyn-primary)', fontSize:'1.1rem' }}></i>
          <h3 style={{ margin:0, fontSize:'.92rem', fontWeight:800, color:'var(--jordyn-text)', letterSpacing:.5 }}>
            Generar PDF de Boletos
          </h3>
          <span style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginLeft:4 }}>
            — Usa el diseño actual de arriba
          </span>
        </div>
        <GeneradorPDF design={design} rifas={rifas} loadingRifas={loadingRifas} />
      </div>

    </Layout>
  );
}