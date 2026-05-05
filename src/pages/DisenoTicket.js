// ============================================================
//   DisenoTicket.js — Editor de Diseño de Ticket
//   RIFAS JORDYN
//   ✅ Usa clases del CSS real: jd-card, jd-input, btn-jordyn, etc.
//   ✅ Guarda en BD via PUT /api/ticket-design (sin localStorage)
//   ✅ Preview en tiempo real
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, DEFAULT_DESIGN, useTicketDesign } from '../components/Ticket';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ─────────────────────────────────────────────────────────
   HELPERS PDF
───────────────────────────────────────────────────────── */
const parseFechaPDF = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFechaPDF = (f) => {
  const d = parseFechaPDF(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', timeZone:'America/Caracas' });
};
const fmtMoneyPDF = (p) => p
  ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(p)
  : '$0';

// ── Dimensiones del ticket en la hoja ──
// Letra landscape = 279×216 mm → área útil ~269×206 mm
// 5 cols × 2 rows con margen: ticket = 246px ancho × 142px alto (proporciones tarjeta)
const TW = 246; // ticket width px
const TH = 142; // ticket height px

/* ── Ticket horizontal nítido para PDF ── */
function MiniTicketPDF({ rifa, vendedor, numero, design: d }) {
  const ac  = d.accentColor  || '#0abfbc';
  const ac2 = d.accentColor2 || '#f0a500';
  const bg  = d.bgDark       || '#1a2e2e';
  const nombre  = rifa?.nombre || 'RIFA';
  const premio  = rifa?.premio || '—';
  const fecha   = fmtFechaPDF(rifa?.fecha_sorteo);
  const valor   = fmtMoneyPDF(rifa?.precio);
  const loteria = rifa?.loteria_ref || '';
  const numStr  = String(numero).padStart(3, '0');

  return (
    <div style={{
      width:TW, height:TH,
      background:bg,
      borderRadius:8,
      overflow:'hidden',
      fontFamily:"'Poppins','Segoe UI',sans-serif",
      position:'relative',
      border:`1.5px solid ${ac}45`,
      flexShrink:0,
      boxSizing:'border-box',
    }}>
      {/* Top accent stripe */}
      <div style={{ height:4, background:`linear-gradient(90deg,${ac},${ac2},${ac})`, flexShrink:0 }} />

      {/* Watermark */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%) rotate(-15deg)',
        fontSize:52, fontWeight:900,
        color:'rgba(255,255,255,0.028)',
        whiteSpace:'nowrap', pointerEvents:'none', letterSpacing:14,
        userSelect:'none',
      }}>
        {d.watermarkText || 'JORDYN'}
      </div>

      {/* Body */}
      <div style={{ display:'flex', height:`${TH - 4 - 3}px` }}>

        {/* ── Columna izquierda: número ── */}
        <div style={{
          width:72, flexShrink:0,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.22)',
          borderRight:`1px dashed ${ac}30`,
          position:'relative', gap:0,
        }}>
          {/* Glow */}
          <div style={{ position:'absolute', width:60, height:60, borderRadius:'50%', background:`radial-gradient(circle,${ac}22 0%,transparent 70%)` }} />
          <div style={{ fontSize:8, fontWeight:800, letterSpacing:3, color:`${ac}88`, textTransform:'uppercase', marginBottom:4, textAlign:'center', position:'relative', zIndex:1 }}>
            Nº suerte
          </div>
          <div style={{ fontSize:34, fontWeight:900, color:ac, lineHeight:1, letterSpacing:4, position:'relative', zIndex:1, textAlign:'center' }}>
            {numStr}
          </div>
          <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.3)', textAlign:'center', marginTop:6, letterSpacing:1.5, textTransform:'uppercase', maxWidth:68, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', position:'relative', zIndex:1 }}>
            {nombre}
          </div>
        </div>

        {/* ── Columna derecha: datos ── */}
        <div style={{ flex:1, padding:'10px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>

          {/* Header: brand + fecha */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:7, borderBottom:`1px solid rgba(255,255,255,0.08)` }}>
            <div>
              <div style={{ fontSize:10, fontWeight:900, color:ac, letterSpacing:.5, lineHeight:1 }}>{d.brandText || 'RIFAS JORDYN'}</div>
              {loteria && <div style={{ fontSize:7.5, color:'rgba(255,255,255,0.32)', marginTop:2, letterSpacing:.5 }}>{loteria}</div>}
            </div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.28)', textAlign:'right', lineHeight:1.7 }}>{fecha}</div>
          </div>

          {/* Premio */}
          <div>
            <div style={{ fontSize:7, fontWeight:700, letterSpacing:2.5, color:ac2, textTransform:'uppercase', marginBottom:3 }}>🏆 Premio</div>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{premio}</div>
          </div>

          {/* Footer: vendedor + valor */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', paddingTop:7, borderTop:`1px solid rgba(255,255,255,0.06)` }}>
            <div>
              <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:2, marginBottom:2 }}>Vendedor</div>
              <div style={{ fontSize:9, fontWeight:700, color:'#cde8e8', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {vendedor?.nombre || '—'}
              </div>
            </div>
            <div style={{ background:`${ac}18`, border:`1.5px solid ${ac}40`, borderRadius:5, padding:'4px 9px', textAlign:'center' }}>
              <div style={{ fontSize:7, fontWeight:700, color:`${ac}90`, letterSpacing:1.5, textTransform:'uppercase' }}>Valor</div>
              <div style={{ fontSize:10, fontWeight:900, color:ac2, letterSpacing:.5 }}>{valor}</div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom accent stripe */}
      <div style={{ height:3, background:`linear-gradient(90deg,${ac2},${ac},${ac2})` }} />
    </div>
  );
}

/* ── Hoja PDF oculta: 5 cols × 2 filas = 10 tickets ──
   Renderizada a alta resolución off-screen para html2canvas scale:4  */
function HojaPDF({ rifa, vendedor, numeros, design }) {
  // Hoja carta landscape en px @96dpi → 1100×849 aprox.
  // Usamos dimensiones mayores para que scale:4 dé ~300dpi real
  const COLS = 5, ROWS = 2;
  const GAP_X = 18, GAP_Y = 22;
  const PAD_X = 28, PAD_Y = 24;
  const sheetW = PAD_X * 2 + COLS * TW + (COLS - 1) * GAP_X; // ~1354px
  const sheetH = PAD_Y * 2 + ROWS * TH + (ROWS - 1) * GAP_Y; // ~376px

  return (
    <div style={{
      width: sheetW,
      height: sheetH,
      background:'#dff0f0',
      padding:`${PAD_Y}px ${PAD_X}px`,
      display:'grid',
      gridTemplateColumns:`repeat(${COLS}, ${TW}px)`,
      gridTemplateRows:`repeat(${ROWS}, ${TH}px)`,
      columnGap: GAP_X,
      rowGap: GAP_Y,
      boxSizing:'border-box',
    }}>
      {numeros.map((n, i) => (
        <MiniTicketPDF key={i} rifa={rifa} vendedor={vendedor} numero={n} design={design} />
      ))}
    </div>
  );
}

/* ── Panel de generación PDF ── */
function GeneradorPDF({ design, rifas, loadingRifas }) {
  const [rifaId,     setRifaId]     = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [numInicio,  setNumInicio]  = useState(1);
  const [paginas,    setPaginas]    = useState(1);
  const [generando,  setGenerando]  = useState(false);
  const [progreso,   setProgreso]   = useState(0);

  const rifaActual     = rifas.find(r => String(r.id) === String(rifaId));
  const vendedoresRifa = rifaActual?.vendedores || [];
  const vendedorActual = vendedoresRifa.find(v => String(v.id) === String(vendedorId));
  const totalTickets   = paginas * 10;

  const handleGenerar = async () => {
    if (!rifaActual) { toast.warning('Selecciona una rifa primero'); return; }
    setGenerando(true);
    setProgreso(0);

    // Pre-cargar fuente Poppins para que html2canvas la capture nítida
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

      // Esperar fuente Poppins + render completo
      await new Promise(resolve => {
        root.render(createElement(HojaPDF, { rifa:rifaActual, vendedor:vendedorActual, numeros:nums, design }));
        setTimeout(resolve, 1200);
      });

      const canvas = await html2canvas(div.firstChild, {
        scale: 4,           // 4x → ~288dpi real → texto perfectamente nítido
        useCORS: true,
        backgroundColor: '#dff0f0',
        logging: false,
        allowTaint: true,
        imageTimeout: 0,
      });

      root.unmount();
      document.body.removeChild(div);

      if (pg > 0) pdf.addPage();
      // Carta landscape = 279×216mm, margen 4mm → área 271×208mm
      const imgW = 271, imgH = (canvas.height / canvas.width) * imgW;
      const offY = (208 - imgH) / 2; // centrar verticalmente
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 4, Math.max(4, offY), imgW, imgH);
      setProgreso(Math.round(((pg + 1) / paginas) * 100));
    }

    const fn = `tickets_${(rifaActual.nombre||'rifa').replace(/\s+/g,'_')}_${vendedorActual?.nombre?.replace(/\s+/g,'_') || 'todos'}_${numInicio}-${numInicio + totalTickets - 1}.pdf`;
    pdf.save(fn);
    toast.success(`✅ PDF generado: ${totalTickets} tickets`);
    setGenerando(false);
  };

  const S = {
    card:  { background:'var(--jordyn-card, #12241f)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'18px 20px' },
    label: { fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1.5px', display:'block', marginBottom:5 },
    sel:   { width:'100%', padding:'8px 10px', background:'#0d1a16', border:'1px solid var(--jordyn-border)', borderRadius:6, color:'#d4eeee', fontSize:'.88rem', outline:'none', appearance:'auto' },
    inp:   { width:'100%', padding:'8px 10px', background:'#0d1a16', border:'1px solid var(--jordyn-border)', borderRadius:6, color:'#d4eeee', fontSize:'.88rem', outline:'none', boxSizing:'border-box' },
    badge: { display:'inline-block', background:'rgba(240,165,0,.15)', border:'1px solid rgba(240,165,0,.35)', color:'var(--jordyn-gold, #f0a500)', fontSize:'.62rem', fontWeight:700, padding:'1px 8px', borderRadius:10, marginLeft:8 },
    prog:  { height:4, background:'var(--jordyn-border)', borderRadius:2, overflow:'hidden', marginTop:8 },
    fill:  { height:'100%', background:'linear-gradient(90deg,#0abfbc,#f0a500)', transition:'width .3s' },
  };

  return (
    <div style={S.card}>
      {/* Título sección */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'rgba(10,191,188,.15)', border:'1px solid rgba(10,191,188,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
          🎟
        </div>
        <div>
          <div style={{ fontSize:'.72rem', fontWeight:800, color:'var(--jordyn-primary, #0abfbc)', textTransform:'uppercase', letterSpacing:'1.5px' }}>
            Generar PDF de Tickets
          </div>
          <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginTop:1 }}>
            10 boletos por hoja · Anclado a esta rifa y vendedor
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>

        {/* Rifa */}
        <div style={{ gridColumn:'1 / -1' }}>
          <label style={S.label}>Rifa</label>
          {loadingRifas
            ? <div style={{ fontSize:'.8rem', color:'var(--jordyn-muted)' }}>Cargando rifas…</div>
            : (
              <select style={S.sel} value={rifaId} onChange={e => { setRifaId(e.target.value); setVendedorId(''); }}>
                <option value="">— Selecciona una rifa —</option>
                {rifas.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                    {r.estado === 'activa' ? ' ✅' : ''}
                    {r.fecha_sorteo ? ` · ${fmtFechaPDF(r.fecha_sorteo)}` : ''}
                  </option>
                ))}
              </select>
            )
          }
        </div>

        {/* Info rifa seleccionada */}
        {rifaActual && (
          <div style={{ gridColumn:'1 / -1', background:'rgba(10,191,188,0.05)', border:'1px solid rgba(10,191,188,0.15)', borderRadius:7, padding:'9px 13px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px 12px' }}>
            {[
              ['Premio',   rifaActual.premio],
              ['Sorteo',   fmtFechaPDF(rifaActual.fecha_sorteo)],
              ['Precio',   fmtMoneyPDF(rifaActual.precio)],
              ['Lotería',  rifaActual.loteria_ref],
              ['Ventas',   `${rifaActual.total_ventas || 0} boletos`],
              ['Vendedores', `${vendedoresRifa.length} asignados`],
            ].filter(([,v]) => v).map(([l, v]) => (
              <div key={l} style={{ padding:'2px 0' }}>
                <div style={{ fontSize:'.55rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
                <div style={{ fontSize:'.75rem', fontWeight:700, color:'#d4eeee', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Vendedor */}
        <div style={{ gridColumn:'1 / -1' }}>
          <label style={S.label}>Vendedor</label>
          <select style={S.sel} value={vendedorId} onChange={e => setVendedorId(e.target.value)} disabled={!rifaActual}>
            <option value="">— Todos / Sin asignar —</option>
            {vendedoresRifa.map(v => (
              <option key={v.id} value={v.id}>
                {v.nombre} {v.usuario ? `(${v.usuario})` : ''} · {v.numeros_count || 0} números
              </option>
            ))}
          </select>
        </div>

        {/* Número inicio */}
        <div>
          <label style={S.label}>Número inicial</label>
          <input
            type="number" min={0} max={9990} style={S.inp}
            value={numInicio}
            onChange={e => setNumInicio(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>

        {/* Páginas */}
        <div>
          <label style={S.label}>
            Hojas <span style={S.badge}>{totalTickets} tickets</span>
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              type="range" min={1} max={20} step={1}
              value={paginas}
              onChange={e => setPaginas(Number(e.target.value))}
              style={{ flex:1 }}
            />
            <span style={{ minWidth:22, textAlign:'center', fontWeight:700, color:'var(--jordyn-primary, #0abfbc)', fontSize:'.9rem' }}>{paginas}</span>
          </div>
          <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:3 }}>
            Números {numInicio} → {numInicio + totalTickets - 1}
          </div>
        </div>

        {/* Botón */}
        <div style={{ gridColumn:'1 / -1' }}>
          <button
            className="btn-jordyn"
            style={{ width:'100%', fontSize:'.9rem', opacity:(!rifaActual || generando) ? .5 : 1, cursor:(!rifaActual || generando) ? 'not-allowed' : 'pointer' }}
            disabled={!rifaActual || generando}
            onClick={handleGenerar}
          >
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

/* ── Rifa demo para preview ── */
const DEMO_RIFA = {
  rifa_nombre:  'RIFA DEMO',
  premio:       'iPhone 15 Pro Max',
  precio:       10000,
  fecha_sorteo: '2025-07-15T21:00:00',
  loteria_ref:  'Lotería del Táchira',
};
const DEMO_COMPRADOR = {
  nombre:   'María González',
  telefono: '+584141234567',
  cedula:   '12345678',
};

/* ── Sub-componentes de control ─────────────────────────── */
function ColorField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="jd-label">{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width:40, height:40, padding:3,
            border:'1.5px solid var(--jordyn-border)',
            borderRadius:8, cursor:'pointer', background:'none',
            flexShrink:0,
          }}
        />
        <input
          className="jd-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.88rem' }}
          maxLength={7}
        />
      </div>
      {hint && (
        <div style={{ fontSize:'.64rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>
      )}
    </div>
  );
}

function TextField({ label, hint, value, onChange, placeholder }) {
  return (
    <div>
      <label className="jd-label">{label}</label>
      <input
        className="jd-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && (
        <div style={{ fontSize:'.64rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PALETAS RÁPIDAS
───────────────────────────────────────────────────────── */
const PALETAS = [
  { name:'Jordyn (defecto)', ac:'#0abfbc', ac2:'#f0a500', bg:'#1a2e2e' },
  { name:'Dorado oscuro',    ac:'#f5c518', ac2:'#0abfbc', bg:'#0a0a0a' },
  { name:'Azul cobalto',     ac:'#118ab2', ac2:'#06d6a0', bg:'#0a1628' },
  { name:'Vino y oro',       ac:'#e63946', ac2:'#f0a500', bg:'#1a0810' },
  { name:'Verde bosque',     ac:'#06d6a0', ac2:'#ffd166', bg:'#071a10' },
  { name:'Morado real',      ac:'#9b5de5', ac2:'#f15bb5', bg:'#130a1e' },
];

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function DisenoTicket() {
  const { design: designBD, loading: loadingBD, reload } = useTicketDesign();
  const [design,  setDesign]  = useState(DEFAULT_DESIGN);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  // ── Rifas para el generador PDF ──
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
      setDesign(designBD);
      setDirty(false);
    }
  }, [loadingBD, designBD]);

  const upd = (key, val) => {
    setDesign(p => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const aplicarPaleta = (p) => {
    setDesign(prev => ({ ...prev, accentColor: p.ac, accentColor2: p.ac2, bgDark: p.bg }));
    setDirty(true);
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
          El diseño se guarda en la base de datos y aplica a todos los boletos del sistema.
          {dirty && (
            <span style={{
              marginLeft:10,
              background:'rgba(240,165,0,.12)',
              border:'1px solid rgba(240,165,0,.3)',
              color:'var(--jordyn-gold)',
              borderRadius:20, padding:'1px 10px',
              fontSize:'.65rem', fontWeight:700,
            }}>
              ● Cambios sin guardar
            </span>
          )}
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn-jordyn-outline"
            onClick={handleReset}
            style={{ fontSize:'.82rem' }}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>Resetear
          </button>
          <button
            className="btn-jordyn"
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{ fontSize:'.88rem' }}
          >
            {saving
              ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando...</>
              : <><i className="bi bi-floppy-fill me-1"></i>Guardar diseño</>
            }
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:24, alignItems:'start' }}>

        {/* ════ PANEL CONTROLES ════ */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Sección: Marca */}
          <div className="jd-card jd-card-primary">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
              <i className="bi bi-type me-1"></i>Marca y textos
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <TextField
                label="Nombre de la marca"
                value={design.brandText}
                onChange={v => upd('brandText', v)}
                placeholder="RIFAS JORDYN"
              />
              <TextField
                label="Pie de página del boleto"
                value={design.footerText}
                onChange={v => upd('footerText', v)}
                placeholder="Conserve este boleto..."
              />
              <TextField
                label="Marca de agua"
                value={design.watermarkText}
                onChange={v => upd('watermarkText', v)}
                placeholder="JORDYN"
              />
              <TextField
                label="Hora del sorteo"
                value={design.horaSort}
                onChange={v => upd('horaSort', v)}
                placeholder="10:00 PM"
                hint="Vacío = usa la hora registrada en fecha_sorteo"
              />
            </div>
          </div>

          {/* Sección: Colores */}
          <div className="jd-card">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
              <i className="bi bi-palette-fill me-1"></i>Colores
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <ColorField
                label="Color principal (número, marca)"
                value={design.accentColor}
                onChange={v => upd('accentColor', v)}
              />
              <ColorField
                label="Color secundario (premio, serial)"
                value={design.accentColor2}
                onChange={v => upd('accentColor2', v)}
              />
              <ColorField
                label="Fondo del boleto"
                value={design.bgDark}
                onChange={v => upd('bgDark', v)}
                hint="Usa colores oscuros para mejor contraste"
              />
            </div>

            {/* Paletas rápidas */}
            <div style={{ marginTop:16 }}>
              <div className="jd-label" style={{ marginBottom:8 }}>Paletas rápidas</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {PALETAS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => aplicarPaleta(p)}
                    title={p.name}
                    style={{
                      width:32, height:32,
                      borderRadius:8,
                      cursor:'pointer',
                      background:`linear-gradient(135deg, ${p.bg} 50%, ${p.ac} 50%)`,
                      border:'2px solid var(--jordyn-border)',
                      transition:'transform .12s, box-shadow .12s',
                      flexShrink:0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform='scale(1.18)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
                  />
                ))}
              </div>
              <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:6 }}>
                Pasa el cursor para ver el nombre · Click para aplicar
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="jd-alert jd-alert-info">
            <i className="bi bi-info-circle-fill"></i>
            <span>
              Si una rifa tiene diseño propio configurado individualmente, ese tiene prioridad sobre este diseño global.
            </span>
          </div>

        </div>

        {/* ════ PREVIEW ════ */}
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>
            <i className="bi bi-eye-fill me-1"></i>Vista previa en tiempo real
          </div>

          {/* Fondo oscuro para que el ticket contraste */}
          <div style={{
            background:'#2a3a3a',
            borderRadius:14,
            padding:24,
            boxShadow:'inset 0 2px 12px rgba(0,0,0,.25)',
          }}>
            <TicketPreview
              r={DEMO_RIFA}
              numero="247"
              comprador={DEMO_COMPRADOR}
              vendedor="Admin"
              design={design}
            />
          </div>

          <div style={{ marginTop:10, fontSize:'.68rem', color:'var(--jordyn-muted)', textAlign:'center' }}>
            Vista de ejemplo con datos ficticios · El diseño real usará los datos reales del comprador
          </div>
        </div>

      </div>

      {/* Responsive: en mobile, preview va debajo */}
      <style>{`
        @media (max-width: 900px) {
          .ticket-editor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ════ SECCIÓN GENERADOR PDF ════ */}
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