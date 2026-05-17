// ============================================================
//   RIFAS JORDYN — ImprimirBoletos
//
//   Ruta: /imprimir-boletos?rifa=ID
//
//   Flujo:
//   1. Carga la rifa, sus vendedores y la plantilla asignada.
//   2. Lista los vendedores como cards (con cantidad de números únicos).
//   3. Usuario elige UN vendedor → preview del primer boleto.
//   4. Click "Generar PDF" → renderiza cada boleto del vendedor con
//      su número real y los empaqueta en hojas A4 horizontal con
//      6 boletos cada una (2 columnas × 3 filas), tamaño real
//      11×6.5 cm por boleto.
//
//   Deduplicación clave: si un vendedor tiene 123 en serie A y 123
//   en serie B, se imprime UN SOLO boleto con el número 123.
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import API from '../services/api';
import TicketEditable from '../components/TicketEditable';
import { DEFAULT_DESIGN } from '../components/Ticket';

// ── Dimensiones del PDF ───────────────────────────────────────
const PAGE_W_MM = 297;   // A4 horizontal
const PAGE_H_MM = 210;
const TICKET_W_MM = 110;
const TICKET_H_MM = 65;
const COLS = 2;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
// márgenes calculados para centrar 2 cols × 3 filas con gaps pequeños
const GAP_X_MM = 5;
const GAP_Y_MM = 2;
const MARGIN_X_MM = (PAGE_W_MM - (COLS * TICKET_W_MM + (COLS - 1) * GAP_X_MM)) / 2;
const MARGIN_Y_MM = (PAGE_H_MM - (ROWS * TICKET_H_MM + (ROWS - 1) * GAP_Y_MM)) / 2;

// ── Deduplica números por valor (ignora serie) ───────────────
function dedupNumeros(numerosFijos) {
  if (!Array.isArray(numerosFijos)) return [];
  const seen = new Set();
  const result = [];
  for (const n of numerosFijos) {
    const num = String(n.numero || n).padStart(3, '0');
    if (!seen.has(num)) {
      seen.add(num);
      result.push(num);
    }
  }
  return result.sort((a, b) => a.localeCompare(b));
}

// ─────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────
export default function ImprimirBoletos() {
  // Lee ?rifa=ID de la URL
  const params = new URLSearchParams(window.location.search);
  const rifaId = params.get('rifa');

  // Data
  const [rifa, setRifa]               = useState(null);
  const [vendedores, setVendedores]   = useState([]);
  const [plantilla, setPlantilla]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Selección
  const [vendedorId, setVendedorId]   = useState('');

  // PDF
  const [generando, setGenerando]     = useState(false);
  const [progreso, setProgreso]       = useState(0);

  // ── Carga inicial ──
  useEffect(() => {
    if (!rifaId) {
      setError('Falta el parámetro ?rifa=ID en la URL');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [rifaRes, boleteriaRes, tplRes] = await Promise.all([
          API.get(`/rifas/${rifaId}`),
          API.get(`/rifas/${rifaId}/boleteria-vendedores`),
          API.get('/ticket-templates').catch(() => ({ data: [] })),
        ]);

        const rifaData = rifaRes.data;
        setRifa(rifaData);
        setVendedores(boleteriaRes.data.vendedores || []);

        // Decidir plantilla:
        // 1) Si rifa.ticket_template_id existe → usar esa
        // 2) Si no, usar la plantilla marcada como default
        // 3) Si no hay default, usar la primera
        // 4) Si no hay ninguna, usar DEFAULT_DESIGN
        const todas = tplRes.data || [];
        let tpl = null;
        if (rifaData.ticket_template_id) {
          tpl = todas.find(p => String(p.id) === String(rifaData.ticket_template_id));
        }
        if (!tpl) tpl = todas.find(p => p.es_default || p.is_default);
        if (!tpl && todas.length > 0) tpl = todas[0];
        setPlantilla(tpl);
      } catch (err) {
        console.error(err);
        setError('Error cargando datos: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    })();
  }, [rifaId]);

  // ── Vendedor seleccionado y sus números dedup ──
  const vendedorActual = useMemo(
    () => vendedores.find(v => String(v.vendedor_id) === String(vendedorId)),
    [vendedores, vendedorId]
  );

  const numerosImprimir = useMemo(
    () => vendedorActual ? dedupNumeros(vendedorActual.numeros_fijos) : [],
    [vendedorActual]
  );

  // Design de la plantilla (o default si no hay)
  const design = useMemo(
    () => plantilla?.design ? { ...DEFAULT_DESIGN, ...plantilla.design } : DEFAULT_DESIGN,
    [plantilla]
  );

  // Total de páginas
  const totalPaginas = Math.ceil(numerosImprimir.length / PER_PAGE);

  // ── Generar PDF ──
  async function handleGenerarPDF() {
    if (!vendedorActual || numerosImprimir.length === 0) return;

    setGenerando(true);
    setProgreso(0);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Vamos número por número. Por cada uno renderizamos un
    // TicketEditable en un div oculto, lo capturamos con html2canvas,
    // y lo pegamos en la posición correcta de la hoja actual.
    const totalNumeros = numerosImprimir.length;

    for (let i = 0; i < totalNumeros; i++) {
      const numero = numerosImprimir[i];
      const indexEnPagina = i % PER_PAGE;
      const pagina = Math.floor(i / PER_PAGE);

      // Si arrancamos una página nueva (excepto la primera)
      if (indexEnPagina === 0 && pagina > 0) {
        pdf.addPage();
      }

      // Renderizar el ticket en un div oculto
      const div = document.createElement('div');
      div.style.cssText = `
        position: fixed; left: -10000px; top: 0;
        width: ${design.ticketWidth}px;
        height: ${design.ticketHeight}px;
        z-index: -1;
      `;
      document.body.appendChild(div);

      const root = createRoot(div);

      await new Promise(resolve => {
        root.render(
          <TicketEditable
            r={rifa}
            numero={numero}
            design={{
              ...design,
              // Sobrescribimos numBoleto con el número real de este boleto
              numBoleto: numero,
            }}
            printMode={true}
          />
        );
        // Damos un frame para que se pinte
        setTimeout(resolve, 250);
      });

      // Capturar con html2canvas
      const canvas = await html2canvas(div.firstChild, {
        scale: 3,                  // alta resolución
        useCORS: true,
        backgroundColor: design.bgPaper || '#ffffff',
        width: design.ticketWidth,
        height: design.ticketHeight,
        windowWidth: design.ticketWidth,
        windowHeight: design.ticketHeight,
      });

      root.unmount();
      document.body.removeChild(div);

      // Calcular posición en la hoja
      const col = indexEnPagina % COLS;
      const row = Math.floor(indexEnPagina / COLS);
      const x = MARGIN_X_MM + col * (TICKET_W_MM + GAP_X_MM);
      const y = MARGIN_Y_MM + row * (TICKET_H_MM + GAP_Y_MM);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', x, y, TICKET_W_MM, TICKET_H_MM);

      setProgreso(Math.round(((i + 1) / totalNumeros) * 100));
    }

    const nombreRifa = (rifa?.nombre || 'rifa').replace(/[^\w-]+/g, '_');
    const nombreVend = (vendedorActual?.vendedor_nombre || 'vendedor').replace(/[^\w-]+/g, '_');
    pdf.save(`boletos_${nombreRifa}_${nombreVend}.pdf`);

    setGenerando(false);
    setProgreso(0);
  }

  // ─────────── RENDER ───────────
  if (loading) return (
    <div style={S.centerScreen}>
      <div style={S.spinner} />
      <p style={{ color: '#0abfbc', marginTop: 14, fontFamily: 'system-ui, sans-serif' }}>
        Cargando rifa y vendedores…
      </p>
    </div>
  );

  if (error) return (
    <div style={S.centerScreen}>
      <div style={{ ...S.errorBox, fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ color: '#f05a5a', margin: '0 0 12px' }}>⚠️ Error</h2>
        <p style={{ color: '#666', margin: 0 }}>{error}</p>
        <a href="/gestion-rifas" style={S.linkBack}>← Volver a Gestión de Rifas</a>
      </div>
    </div>
  );

  return (
    <div style={S.root}>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <a href="/gestion-rifas" style={S.backBtn}>← Rifas</a>
          <div style={{ flex: 1 }}>
            <h1 style={S.title}>🎟 Imprimir boletos</h1>
            <p style={S.subtitle}>
              {rifa?.nombre} · {plantilla
                ? <>Plantilla: <strong style={{ color:'#0abfbc' }}>{plantilla.nombre}</strong></>
                : <span style={{ color:'#f0a500' }}>Sin plantilla asignada — usando default</span>
              }
            </p>
          </div>
        </div>
      </header>

      {/* BODY: 2 columnas — vendedores | preview */}
      <div style={S.body}>

        {/* ─── COLUMNA IZQ: Vendedores ─── */}
        <aside style={S.vendedoresCol}>
          <h2 style={S.sectionTitle}>
            Vendedores ({vendedores.length})
          </h2>

          {vendedores.length === 0 ? (
            <div style={S.emptyState}>
              <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                Esta rifa todavía no tiene vendedores con números asignados.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vendedores.map(v => {
                const nums = dedupNumeros(v.numeros_fijos);
                const isSelected = String(v.vendedor_id) === String(vendedorId);
                return (
                  <button
                    key={v.vendedor_id}
                    onClick={() => setVendedorId(v.vendedor_id)}
                    style={{
                      ...S.vendedorCard,
                      background: isSelected ? '#e0f9f8' : '#fff',
                      borderColor: isSelected ? '#0abfbc' : '#e0e0e0',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(10,191,188,.2)'
                        : '0 1px 2px rgba(0,0,0,.04)',
                    }}
                  >
                    <div style={S.vendedorInfo}>
                      <div style={S.vendedorNombre}>
                        {v.vendedor_nombre}
                      </div>
                      {v.cedula && (
                        <div style={S.vendedorCedula}>
                          C.I: {v.cedula}
                        </div>
                      )}
                    </div>
                    <div style={S.vendedorBadge}>
                      <strong>{nums.length}</strong>
                      <span>boletos</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* ─── COLUMNA DER: Preview + acciones ─── */}
        <main style={S.previewCol}>
          {!vendedorActual ? (
            <div style={S.previewEmpty}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>👈</div>
              <h3 style={{ color: '#333', margin: '0 0 6px' }}>Selecciona un vendedor</h3>
              <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                Click sobre un vendedor de la izquierda para ver sus boletos
                y generar el PDF para imprimir.
              </p>
            </div>
          ) : (
            <>
              {/* Info bar */}
              <div style={S.infoBar}>
                <div>
                  <div style={S.infoLabel}>Vendedor</div>
                  <div style={S.infoValue}>{vendedorActual.vendedor_nombre}</div>
                </div>
                <div>
                  <div style={S.infoLabel}>Números únicos</div>
                  <div style={S.infoValue}>{numerosImprimir.length}</div>
                </div>
                <div>
                  <div style={S.infoLabel}>Hojas PDF</div>
                  <div style={S.infoValue}>{totalPaginas} (6 por hoja)</div>
                </div>
                <button
                  onClick={handleGenerarPDF}
                  disabled={generando || numerosImprimir.length === 0}
                  style={{
                    ...S.btnGenerar,
                    opacity: (generando || numerosImprimir.length === 0) ? 0.5 : 1,
                    cursor:  (generando || numerosImprimir.length === 0) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generando
                    ? `Generando… ${progreso}%`
                    : `⬇ Generar PDF (${numerosImprimir.length} boletos)`}
                </button>
              </div>

              {/* Barra de progreso */}
              {generando && (
                <div style={S.progressBar}>
                  <div style={{ ...S.progressFill, width: `${progreso}%` }} />
                </div>
              )}

              {/* Lista de números a imprimir */}
              <div style={S.numerosBox}>
                <strong style={{ fontSize: 12, color: '#666' }}>
                  📋 Números a imprimir (sin duplicar por serie):
                </strong>
                <div style={S.numerosLista}>
                  {numerosImprimir.length === 0 ? (
                    <span style={{ color: '#999', fontSize: 12 }}>
                      Este vendedor no tiene números asignados
                    </span>
                  ) : numerosImprimir.map(n => (
                    <span key={n} style={S.numeroChip}>{n}</span>
                  ))}
                </div>
              </div>

              {/* Preview del primer boleto */}
              {numerosImprimir.length > 0 && (
                <div style={S.previewBox}>
                  <h3 style={S.sectionTitle}>
                    Vista previa — boleto #{numerosImprimir[0]}
                  </h3>
                  <div style={S.previewWrapper}>
                    <TicketEditable
                      r={rifa}
                      numero={numerosImprimir[0]}
                      design={{ ...design, numBoleto: numerosImprimir[0] }}
                      printMode={true}
                    />
                  </div>
                  <p style={S.previewHint}>
                    Todos los demás boletos se generarán igual, cambiando solo el número.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Estilos
// ─────────────────────────────────────────────────────────────
const C = {
  bg: '#f5f7f7',
  surface: '#fff',
  border: '#e0e0e0',
  teal: '#0abfbc',
  tealDark: '#089a98',
  text: '#222',
  muted: '#666',
};

const S = {
  root: {
    minHeight: '100vh',
    background: C.bg,
    fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
    color: C.text,
  },
  header: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    padding: '14px 28px',
    maxWidth: 1400,
    margin: '0 auto',
  },
  backBtn: {
    textDecoration: 'none',
    color: C.teal,
    fontSize: 13,
    fontWeight: 700,
    padding: '8px 14px',
    border: `1px solid ${C.teal}`,
    borderRadius: 6,
    transition: 'background .15s',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: C.text,
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 12,
    color: C.muted,
  },
  body: {
    display: 'flex',
    gap: 20,
    padding: '20px 28px',
    maxWidth: 1400,
    margin: '0 auto',
    alignItems: 'flex-start',
  },
  vendedoresCol: {
    flex: '0 0 320px',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '18px 16px',
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    position: 'sticky',
    top: 80,
  },
  previewCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: 13,
    fontWeight: 700,
    color: C.teal,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  emptyState: {
    padding: 24,
    textAlign: 'center',
    background: '#fafafa',
    borderRadius: 8,
    border: `1px dashed ${C.border}`,
  },
  vendedorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    background: '#fff',
    fontFamily: 'inherit',
    transition: 'all .15s',
    width: '100%',
  },
  vendedorInfo: {
    flex: 1,
    minWidth: 0,
  },
  vendedorNombre: {
    fontSize: 13,
    fontWeight: 700,
    color: C.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  vendedorCedula: {
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },
  vendedorBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#0abfbc15',
    color: C.tealDark,
    padding: '6px 10px',
    borderRadius: 6,
    minWidth: 56,
  },
  previewEmpty: {
    background: C.surface,
    border: `1px dashed ${C.border}`,
    borderRadius: 12,
    padding: 60,
    textAlign: 'center',
  },
  infoBar: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 700,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 800,
    color: C.text,
  },
  btnGenerar: {
    marginLeft: 'auto',
    padding: '10px 22px',
    background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: .3,
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(10,191,188,.3)',
    transition: 'transform .1s',
  },
  progressBar: {
    height: 6,
    background: '#e8e8e8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${C.teal}, #f0a500)`,
    borderRadius: 3,
    transition: 'width .25s',
  },
  numerosBox: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '14px 18px',
  },
  numerosLista: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  numeroChip: {
    background: '#f0fbfb',
    color: C.tealDark,
    border: `1px solid ${C.teal}40`,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  previewBox: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '18px',
  },
  previewWrapper: {
    background: '#fafafa',
    border: `1px dashed ${C.border}`,
    borderRadius: 8,
    padding: 14,
    overflow: 'auto',
  },
  previewHint: {
    margin: '10px 0 0',
    fontSize: 11,
    color: C.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  centerScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: C.bg,
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid #e0e0e0',
    borderTop: `3px solid ${C.teal}`,
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: '#fff',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 32,
    maxWidth: 480,
    textAlign: 'center',
  },
  linkBack: {
    display: 'inline-block',
    marginTop: 18,
    color: C.teal,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
};

// Keyframes para spinner (inyectado una vez)
if (typeof document !== 'undefined' && !document.getElementById('imprimir-boletos-keyframes')) {
  const style = document.createElement('style');
  style.id = 'imprimir-boletos-keyframes';
  style.textContent = `@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`;
  document.head.appendChild(style);
}
