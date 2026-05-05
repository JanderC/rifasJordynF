// ============================================================
//   RIFAS JORDYN — GeneradorPDFTickets
//   • Consulta /api/rifas y /api/vendedores
//   • Genera PDF con 10 tickets por hoja (5 cols × 2 rows)
//   • Cada ticket muestra rifa anidada + vendedor
//   • Diseño: Art Déco industrial, dorado + teal oscuro
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import API from '../services/api';

// ─────────────────────────────────────────────────────────────
//  Constants & helpers
// ─────────────────────────────────────────────────────────────
const DEFAULT_DESIGN = {
  brandText:    'RIFAS JORDYN',
  footerText:   'Conserve este boleto · Válido solo con número legible',
  accentColor:  '#0abfbc',
  accentColor2: '#f0a500',
  bgDark:       '#1a2e2e',
  watermarkText:'JORDYN',
};

const parseFecha = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFecha = (f) => {
  const d = parseFecha(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'America/Caracas',
  });
};
const fmtMoney = (p) => p
  ? new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(p)
  : '$0';

// ─────────────────────────────────────────────────────────────
//  Single Ticket Card (usado para previsualización y PDF)
// ─────────────────────────────────────────────────────────────
function TicketCard({ rifa, vendedor, numero, design }) {
  const d   = { ...DEFAULT_DESIGN, ...(design || {}) };
  const ac  = d.accentColor;
  const ac2 = d.accentColor2;
  const bg  = d.bgDark;

  const nombre  = rifa?.nombre || 'RIFA';
  const premio  = rifa?.premio || '—';
  const fecha   = fmtFecha(rifa?.fecha_sorteo);
  const valor   = fmtMoney(rifa?.precio);
  const loteria = rifa?.loteria_ref || '';

  return (
    <div style={{
      width: 210, height: 120,
      background: bg,
      borderRadius: 6,
      overflow: 'hidden',
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
      border: `1.5px solid ${ac}40`,
      flexShrink: 0,
    }}>
      {/* Top accent stripe */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${ac}, ${ac2}, ${ac})`,
      }} />

      {/* Watermark */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%) rotate(-18deg)',
        fontSize: 32, fontWeight: 900,
        color: 'rgba(255,255,255,0.025)',
        whiteSpace: 'nowrap', pointerEvents: 'none',
        letterSpacing: 10,
      }}>
        {d.watermarkText}
      </div>

      <div style={{ display: 'flex', height: 'calc(100% - 3px)' }}>

        {/* Left: número grande */}
        <div style={{
          width: 56, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.18)',
          borderRight: `1px dashed ${ac}33`,
          padding: '6px 4px',
          position: 'relative',
        }}>
          {/* Glow spot */}
          <div style={{
            position: 'absolute', width: 44, height: 44, borderRadius: '50%',
            background: `radial-gradient(circle, ${ac}22 0%, transparent 70%)`,
          }} />
          <div style={{
            fontSize: 6, fontWeight: 800, letterSpacing: 2,
            color: `${ac}80`, textTransform: 'uppercase',
            marginBottom: 2, textAlign: 'center',
          }}>Nº</div>
          <div style={{
            fontSize: 22, fontWeight: 900, color: ac,
            lineHeight: 1, letterSpacing: 3,
            textShadow: `0 0 12px ${ac}50`,
            position: 'relative', zIndex: 1, textAlign: 'center',
          }}>
            {String(numero).padStart(3, '0')}
          </div>
          <div style={{
            fontSize: 5, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
            textAlign: 'center', marginTop: 4, letterSpacing: 1,
            maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}>
            {nombre}
          </div>
        </div>

        {/* Right: datos */}
        <div style={{
          flex: 1, padding: '6px 8px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {/* Brand + fecha */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 4,
            paddingBottom: 4,
            borderBottom: `1px solid rgba(255,255,255,0.07)`,
          }}>
            <div>
              <div style={{
                fontSize: 7.5, fontWeight: 900, color: ac,
                letterSpacing: 0.5,
              }}>
                {d.brandText}
              </div>
              {loteria && (
                <div style={{
                  fontSize: 5.5, color: 'rgba(255,255,255,0.3)',
                  letterSpacing: 0.5, marginTop: 1,
                }}>
                  {loteria}
                </div>
              )}
            </div>
            <div style={{
              fontSize: 5.5, color: 'rgba(255,255,255,0.28)',
              textAlign: 'right', lineHeight: 1.6,
            }}>
              {fecha}
            </div>
          </div>

          {/* Premio */}
          <div style={{ marginBottom: 3 }}>
            <div style={{
              fontSize: 5, fontWeight: 700, letterSpacing: 2,
              color: ac2, textTransform: 'uppercase', marginBottom: 1,
            }}>
              Premio
            </div>
            <div style={{
              fontSize: 7, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {premio}
            </div>
          </div>

          {/* Vendedor + Valor */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', flex: 1,
            paddingTop: 3, borderTop: `1px solid rgba(255,255,255,0.05)`,
          }}>
            <div>
              <div style={{
                fontSize: 5, fontWeight: 700, letterSpacing: 1.5,
                color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
                marginBottom: 1,
              }}>
                Vendedor
              </div>
              <div style={{
                fontSize: 6.5, fontWeight: 700, color: '#cde8e8',
                maxWidth: 90, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {vendedor?.nombre || '—'}
              </div>
            </div>
            <div style={{
              background: `${ac}18`,
              border: `1px solid ${ac}40`,
              borderRadius: 3, padding: '2px 5px', textAlign: 'center',
            }}>
              <div style={{
                fontSize: 5, fontWeight: 700, color: `${ac}90`,
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                Valor
              </div>
              <div style={{
                fontSize: 7, fontWeight: 900, color: ac2,
              }}>
                {valor}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{ height: 2, background: `linear-gradient(90deg,${ac2},${ac},${ac2})` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Hidden grid for PDF rendering (10 tickets, 5×2)
// ─────────────────────────────────────────────────────────────
function PdfSheet({ rifa, vendedor, numeros, design }) {
  return (
    <div style={{
      width: 1240,
      padding: 24,
      background: '#f0f7f7',
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 220px)',
      gridTemplateRows: 'repeat(2, 130px)',
      gap: '16px 12px',
      boxSizing: 'border-box',
    }}>
      {numeros.map((n, i) => (
        <TicketCard key={i} rifa={rifa} vendedor={vendedor} numero={n} design={design} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────
export default function GeneradorPDFTickets() {
  // Data
  const [rifas,      setRifas]      = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [design,     setDesign]     = useState(DEFAULT_DESIGN);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Selección
  const [rifaId,     setRifaId]     = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [numInicio,  setNumInicio]  = useState(1);

  // PDF
  const [generando,  setGenerando]  = useState(false);
  const [progreso,   setProgreso]   = useState(0);
  const [paginas,    setPaginas]    = useState(1);

  const sheetRef = useRef(null);

  // ── Cargar datos al montar ─────────────────────────────────
  useEffect(() => {
    Promise.all([
      API.get('/rifas'),
      API.get('/vendedores'),
      API.get('/ticket-design'),
    ]).then(([rRes, vRes, dRes]) => {
      setRifas(rRes.data || []);
      setVendedores(vRes.data || []);
      if (dRes.data?.design) {
        setDesign({ ...DEFAULT_DESIGN, ...dRes.data.design });
      }
    }).catch(e => {
      setError('Error cargando datos: ' + (e.message || e));
    }).finally(() => setLoading(false));
  }, []);

  // ── Derivados ──────────────────────────────────────────────
  const rifaActual     = rifas.find(r => String(r.id) === String(rifaId));
  const vendedorActual = vendedores.find(v => String(v.id) === String(vendedorId));

  // Vendedores de la rifa seleccionada (si la rifa los trae)
  const vendedoresDeLaRifa = rifaActual?.vendedores?.length
    ? vendedores.filter(v => rifaActual.vendedores.some(rv => rv.id === v.id))
    : vendedores;

  // Números para previsualización (10 tickets en grid)
  const numerosPreview = Array.from({ length: 10 }, (_, i) => numInicio + i);

  // Números totales para el PDF (paginas × 10)
  const numerosTotal = Array.from({ length: paginas * 10 }, (_, i) => numInicio + i);

  // ── Generar PDF ────────────────────────────────────────────
  async function handleGenerarPDF() {
    if (!rifaActual) return;
    setGenerando(true);
    setProgreso(0);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    const SHEET_W = 1240;
    const SHEET_H = 296; // 2 rows × 130px + gaps + padding

    for (let pg = 0; pg < paginas; pg++) {
      const pageNumeros = numerosTotal.slice(pg * 10, pg * 10 + 10);

      // Crear div temporal fuera del viewport
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
      document.body.appendChild(div);

      // Renderizar la hoja con React
      const { createRoot } = await import('react-dom/client');
      const { createElement } = await import('react');
      const root = createRoot(div);

      await new Promise(resolve => {
        root.render(createElement(PdfSheet, {
          rifa: rifaActual,
          vendedor: vendedorActual,
          numeros: pageNumeros,
          design,
        }));
        setTimeout(resolve, 600);
      });

      const canvas = await html2canvas(div.firstChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f0f7f7',
        width: SHEET_W,
        height: SHEET_H,
      });

      root.unmount();
      document.body.removeChild(div);

      if (pg > 0) pdf.addPage();

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 5, 5, 269, 189); // letter landscape ~279×216 mm

      setProgreso(Math.round(((pg + 1) / paginas) * 100));
    }

    const nombreRifa = (rifaActual?.nombre || 'rifa').replace(/\s+/g, '_');
    const nombreVend = (vendedorActual?.nombre || 'vendedor').replace(/\s+/g, '_');
    pdf.save(`tickets_${nombreRifa}_${nombreVend}_${numInicio}-${numInicio + paginas * 10 - 1}.pdf`);

    setGenerando(false);
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading) return (
    <div style={styles.center}>
      <div style={styles.spinner} />
      <p style={{ color: '#0abfbc', marginTop: 12 }}>Cargando datos…</p>
    </div>
  );

  if (error) return (
    <div style={styles.center}>
      <p style={{ color: '#f05a5a' }}>{error}</p>
    </div>
  );

  return (
    <div style={styles.root}>

      {/* ── HEADER ── */}
      <div style={styles.header}>
        <div style={styles.headerAccent} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={styles.logoBox}>
            <span style={{ fontSize: 22 }}>🎟</span>
          </div>
          <div>
            <h1 style={styles.title}>Generador de Tickets PDF</h1>
            <p style={styles.subtitle}>10 boletos por hoja · Anidado a rifa y vendedor</p>
          </div>
        </div>
      </div>

      <div style={styles.body}>

        {/* ── PANEL DE CONFIGURACIÓN ── */}
        <div style={styles.configPanel}>
          <h2 style={styles.sectionTitle}>Configuración</h2>

          {/* Rifa */}
          <div style={styles.field}>
            <label style={styles.label}>Rifa</label>
            <select
              style={styles.select}
              value={rifaId}
              onChange={e => { setRifaId(e.target.value); setVendedorId(''); }}
            >
              <option value="">— Selecciona una rifa —</option>
              {rifas.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nombre} {r.estado === 'activa' ? '✅' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Info rifa */}
          {rifaActual && (
            <div style={styles.rifaInfo}>
              <InfoRow label="Premio" value={rifaActual.premio} />
              <InfoRow label="Sorteo" value={fmtFecha(rifaActual.fecha_sorteo)} />
              <InfoRow label="Precio" value={fmtMoney(rifaActual.precio)} />
              {rifaActual.loteria_ref && <InfoRow label="Lotería" value={rifaActual.loteria_ref} />}
              <InfoRow label="Ventas" value={`${rifaActual.total_ventas || 0} boletos`} />
            </div>
          )}

          {/* Vendedor */}
          <div style={styles.field}>
            <label style={styles.label}>Vendedor</label>
            <select
              style={styles.select}
              value={vendedorId}
              onChange={e => setVendedorId(e.target.value)}
            >
              <option value="">— Selecciona un vendedor —</option>
              {vendedoresDeLaRifa.map(v => (
                <option key={v.id} value={v.id}>
                  {v.nombre} ({v.usuario})
                </option>
              ))}
            </select>
          </div>

          {/* Número de inicio */}
          <div style={styles.field}>
            <label style={styles.label}>Número inicial del lote</label>
            <input
              type="number"
              min={0}
              max={9990}
              style={styles.input}
              value={numInicio}
              onChange={e => setNumInicio(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <p style={styles.hint}>
              El PDF asignará {paginas * 10} números consecutivos desde este valor.
            </p>
          </div>

          {/* Páginas */}
          <div style={styles.field}>
            <label style={styles.label}>
              Páginas en el PDF &nbsp;
              <span style={styles.badge}>{paginas * 10} tickets</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range" min={1} max={20} step={1}
                value={paginas}
                onChange={e => setPaginas(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={styles.rangeVal}>{paginas}</span>
            </div>
          </div>

          {/* Botón generar */}
          <button
            style={{
              ...styles.btn,
              opacity: (!rifaActual || generando) ? 0.5 : 1,
              cursor: (!rifaActual || generando) ? 'not-allowed' : 'pointer',
            }}
            disabled={!rifaActual || generando}
            onClick={handleGenerarPDF}
          >
            {generando
              ? `Generando PDF… ${progreso}%`
              : `⬇ Descargar PDF (${paginas} ${paginas === 1 ? 'hoja' : 'hojas'})`}
          </button>

          {/* Barra de progreso */}
          {generando && (
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progreso}%` }} />
            </div>
          )}
        </div>

        {/* ── PREVISUALIZACIÓN ── */}
        <div style={styles.preview}>
          <h2 style={styles.sectionTitle}>
            Previsualización — 1 hoja (10 tickets)
          </h2>

          {rifaActual ? (
            <div style={styles.previewSheet}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 210px)',
                gridTemplateRows: 'repeat(2, 120px)',
                gap: '14px 10px',
              }}>
                {numerosPreview.map((n, i) => (
                  <TicketCard
                    key={i}
                    rifa={rifaActual}
                    vendedor={vendedorActual}
                    numero={n}
                    design={design}
                  />
                ))}
              </div>

              {/* Leyenda inferior */}
              <div style={styles.legend}>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: '#0abfbc' }} />
                  <span>Rifa: {rifaActual.nombre}</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: '#f0a500' }} />
                  <span>Vendedor: {vendedorActual?.nombre || 'Sin asignar'}</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: '#4a8f8f' }} />
                  <span>Nros. {numInicio}–{numInicio + 9}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎟</div>
              <p style={{ color: '#6ab0a0', fontSize: 14 }}>
                Selecciona una rifa para ver la previsualización
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Subcomponents
// ─────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 11, color: '#6ab0a0', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#e8f4f4', maxWidth: 180,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────
const C = {
  bg:      '#0f2020',
  surface: '#162b2b',
  border:  '#1e3f3f',
  teal:    '#0abfbc',
  gold:    '#f0a500',
  text:    '#d4eeee',
  muted:   '#5a9090',
};

const styles = {
  root: {
    minHeight: '100vh',
    background: C.bg,
    fontFamily: "'Poppins', 'Segoe UI', sans-serif",
    color: C.text,
  },
  header: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: '20px 28px',
    position: 'relative',
    overflow: 'hidden',
  },
  headerAccent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, ${C.teal}, ${C.gold}, ${C.teal})`,
  },
  logoBox: {
    width: 48, height: 48, borderRadius: 10,
    background: `${C.teal}22`,
    border: `1.5px solid ${C.teal}44`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    margin: 0, fontSize: 22, fontWeight: 800,
    color: '#fff', letterSpacing: 0.5,
  },
  subtitle: {
    margin: '2px 0 0', fontSize: 12, color: C.muted, letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    display: 'flex', gap: 0, alignItems: 'flex-start',
  },
  configPanel: {
    width: 300, flexShrink: 0,
    background: C.surface,
    borderRight: `1px solid ${C.border}`,
    padding: '24px 20px',
    minHeight: 'calc(100vh - 90px)',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  sectionTitle: {
    margin: '0 0 4px', fontSize: 13, fontWeight: 700,
    color: C.teal, letterSpacing: 2, textTransform: 'uppercase',
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  label: {
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: 1.5,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  badge: {
    background: `${C.gold}22`, border: `1px solid ${C.gold}44`,
    color: C.gold, fontSize: 10, padding: '1px 6px',
    borderRadius: 3, fontWeight: 700,
  },
  select: {
    width: '100%', padding: '8px 10px',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.text,
    fontSize: 13, outline: 'none',
    cursor: 'pointer',
  },
  input: {
    width: '100%', padding: '8px 10px',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.text,
    fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    margin: 0, fontSize: 10, color: C.muted, lineHeight: 1.5,
  },
  rangeVal: {
    minWidth: 28, textAlign: 'center',
    fontSize: 14, fontWeight: 700, color: C.teal,
  },
  btn: {
    width: '100%', padding: '11px 0',
    background: `linear-gradient(135deg, ${C.teal}, #089a98)`,
    border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 13, fontWeight: 700,
    letterSpacing: 0.5, cursor: 'pointer',
    transition: 'opacity .2s',
  },
  progressBar: {
    height: 4, background: C.border, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: `linear-gradient(90deg, ${C.teal}, ${C.gold})`,
    borderRadius: 2, transition: 'width .3s',
  },
  rifaInfo: {
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  preview: {
    flex: 1, padding: '24px 28px', overflow: 'auto',
  },
  previewSheet: {
    background: '#1a3535',
    borderRadius: 10, padding: 20,
    border: `1px solid ${C.border}`,
    display: 'inline-flex',
    flexDirection: 'column', gap: 16,
  },
  legend: {
    display: 'flex', gap: 16, alignItems: 'center',
    paddingTop: 4,
  },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: C.muted,
  },
  legendDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: 300,
    background: '#162b2b', borderRadius: 12,
    border: `1px dashed ${C.border}`,
  },
  center: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: 300,
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: `3px solid ${C.border}`,
    borderTop: `3px solid ${C.teal}`,
    animation: 'spin 0.8s linear infinite',
  },
};