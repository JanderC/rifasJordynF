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
// A4: 297×210 mm. Se rota según orientación.
const A4_LARGO_MM = 297;
const A4_CORTO_MM = 210;
// Gaps mínimos entre boletos (mm)
const GAP_MM = 3;

// Calcula layout dado boleto (cm) y orientación.
// Devuelve { pageW, pageH, ticketW, ticketH, cols, rows, perPage, marginX, marginY, ok, error }
function calcularLayout(ticketAnchoCm, ticketAltoCm, orientacion) {
  const pageW = orientacion === 'horizontal' ? A4_LARGO_MM : A4_CORTO_MM;
  const pageH = orientacion === 'horizontal' ? A4_CORTO_MM : A4_LARGO_MM;
  const ticketW = Math.max(1, ticketAnchoCm * 10);
  const ticketH = Math.max(1, ticketAltoCm * 10);

  if (ticketW > pageW || ticketH > pageH) {
    return {
      pageW, pageH, ticketW, ticketH,
      cols: 0, rows: 0, perPage: 0,
      marginX: 0, marginY: 0,
      ok: false,
      error: `El boleto (${ticketAnchoCm}×${ticketAltoCm} cm) es más grande que la hoja A4 ${orientacion}.`,
    };
  }

  // Cuántas columnas/filas caben con gap GAP_MM entre boletos
  // n*W + (n-1)*gap ≤ page → n ≤ (page+gap)/(W+gap)
  const cols = Math.max(1, Math.floor((pageW + GAP_MM) / (ticketW + GAP_MM)));
  const rows = Math.max(1, Math.floor((pageH + GAP_MM) / (ticketH + GAP_MM)));
  const perPage = cols * rows;

  // Márgenes para centrar
  const usadoX = cols * ticketW + (cols - 1) * GAP_MM;
  const usadoY = rows * ticketH + (rows - 1) * GAP_MM;
  const marginX = Math.max(0, (pageW - usadoX) / 2);
  const marginY = Math.max(0, (pageH - usadoY) / 2);

  return {
    pageW, pageH, ticketW, ticketH,
    cols, rows, perPage,
    marginX, marginY,
    ok: true,
    error: null,
  };
}

// ── Normaliza números respetando serie (numero+serie = 1 boleto) ──
// Devuelve array de objetos { numero, serie } sin duplicados exactos.
function dedupNumeros(numerosFijos) {
  if (!Array.isArray(numerosFijos)) return [];
  const seen = new Set();
  const result = [];
  for (const n of numerosFijos) {
    const num   = String(n.numero || n).padStart(3, '0');
    const serie = String(n.serie || '').toUpperCase();
    const key   = `${num}-${serie}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ numero: num, serie });
    }
  }
  // Ordenar por número, luego por serie
  return result.sort((a, b) =>
    a.numero.localeCompare(b.numero) || a.serie.localeCompare(b.serie)
  );
}

// ── Normaliza el design de una plantilla ─────────────────────
// El backend a veces devuelve `design` como string JSON, o lo
// guarda en otras claves. Esta función intenta extraerlo bien.
function extraerDesign(plantilla) {
  if (!plantilla) return null;

  // Candidatos posibles en orden de prioridad
  const candidatos = [
    plantilla.design,
    plantilla.ticket_design,
    plantilla.config,
    plantilla.diseno,
  ];

  for (const cand of candidatos) {
    if (!cand) continue;
    // Si viene como string JSON, parsear
    if (typeof cand === 'string') {
      try {
        const parsed = JSON.parse(cand);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        console.warn('No se pudo parsear design como JSON:', e);
      }
    } else if (typeof cand === 'object') {
      return cand;
    }
  }

  return null;
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
  const [todasPlantillas, setTodasPlantillas] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Selección
  const [vendedorId, setVendedorId]   = useState('');

  // PDF
  const [generando, setGenerando]     = useState(false);
  const [progreso, setProgreso]       = useState(0);

  // Configuración de impresión
  const [orientacion, setOrientacion]       = useState('horizontal'); // 'horizontal' | 'vertical'
  const [ticketAnchoCm, setTicketAnchoCm]   = useState(11);
  const [ticketAltoCm, setTicketAltoCm]     = useState(6.5);

  // Layout calculado en vivo
  const layout = useMemo(
    () => calcularLayout(ticketAnchoCm, ticketAltoCm, orientacion),
    [ticketAnchoCm, ticketAltoCm, orientacion]
  );

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
        setTodasPlantillas(todas);
        console.log('[ImprimirBoletos] Rifa:', rifaData.nombre, 'ticket_template_id:', rifaData.ticket_template_id);
        console.log('[ImprimirBoletos] Plantillas disponibles:', todas.map(p => ({ id: p.id, nombre: p.nombre, is_default: p.is_default || p.es_default })));

        let tpl = null;
        if (rifaData.ticket_template_id) {
          tpl = todas.find(p => String(p.id) === String(rifaData.ticket_template_id));
          if (!tpl) console.warn('[ImprimirBoletos] La rifa tiene ticket_template_id', rifaData.ticket_template_id, 'pero NO se encontró esa plantilla');
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
  // IMPORTANTE: preservamos positions, customTexts, hiddenFields,
  // globalSizeFactor — TODO el contenido de la plantilla.
  const design = useMemo(() => {
    const extraido = extraerDesign(plantilla);
    if (!extraido) return { ...DEFAULT_DESIGN };
    // Log en consola para debugging
    console.log('[ImprimirBoletos] Plantilla cargada:', plantilla?.nombre);
    console.log('[ImprimirBoletos] Design extraído:', extraido);
    console.log('[ImprimirBoletos] Tiene positions:', !!extraido.positions);
    console.log('[ImprimirBoletos] Tiene customTexts:', !!extraido.customTexts, extraido.customTexts?.length);
    console.log('[ImprimirBoletos] Tiene hiddenFields:', extraido.hiddenFields?.length);
    return { ...DEFAULT_DESIGN, ...extraido };
  }, [plantilla]);

  // Total de páginas (depende del layout actual)
  const totalPaginas = layout.ok && layout.perPage > 0
    ? Math.ceil(numerosImprimir.length / layout.perPage)
    : 0;

  // ── Generar PDF ──
  async function handleGenerarPDF() {
    if (!vendedorActual || numerosImprimir.length === 0) return;
    if (!layout.ok) {
      alert(layout.error || 'Configuración de impresión inválida');
      return;
    }

    setGenerando(true);
    setProgreso(0);

    const pdf = new jsPDF({
      orientation: orientacion === 'horizontal' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Vamos número por número. Por cada uno renderizamos un
    // TicketEditable en un div oculto, lo capturamos con html2canvas,
    // y lo pegamos en la posición correcta de la hoja actual.
    const totalNumeros = numerosImprimir.length;

    for (let i = 0; i < totalNumeros; i++) {
      const { numero, serie } = numerosImprimir[i];
      const indexEnPagina = i % layout.perPage;
      const pagina = Math.floor(i / layout.perPage);

      // Si arrancamos una página nueva (excepto la primera)
      if (indexEnPagina === 0 && pagina > 0) {
        pdf.addPage();
      }

      // Renderizar el ticket en un div oculto
      const div = document.createElement('div');
      div.style.cssText = `
        position: fixed; left: -10000px; top: 0;
        width: ${design.ticketWidth + 10}px;
        height: ${design.ticketHeight + 10}px;
        z-index: -1;
        background: ${design.bgPaper || '#ffffff'};
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
        // Damos tiempo a que SVG y fuentes se pinten (más que con CSS plano)
        setTimeout(resolve, 400);
      });

      // Localizar el canvas REAL del ticket (no el wrapper externo).
      // Se identifica por el data-attribute que pusimos en TicketEditable.
      const canvasNode = div.querySelector('[data-ticket-canvas="true"]') || div.firstChild;

      // Capturar con html2canvas
      const canvas = await html2canvas(canvasNode, {
        scale: 3,                  // alta resolución
        useCORS: true,
        backgroundColor: design.bgPaper || '#ffffff',
        width: design.ticketWidth,
        height: design.ticketHeight,
        windowWidth: design.ticketWidth,
        windowHeight: design.ticketHeight,
        logging: false,
      });

      root.unmount();
      document.body.removeChild(div);

      // Calcular posición en la hoja usando el layout dinámico
      const col = indexEnPagina % layout.cols;
      const row = Math.floor(indexEnPagina / layout.cols);
      const x = layout.marginX + col * (layout.ticketW + GAP_MM);
      const y = layout.marginY + row * (layout.ticketH + GAP_MM);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', x, y, layout.ticketW, layout.ticketH);

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
        <a href="/rifas" style={S.linkBack}>← Volver a Gestión de Rifas</a>
      </div>
    </div>
  );

  return (
    <div style={S.root}>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <a href="/rifas" style={S.backBtn}>← Rifas</a>
          <div style={{ flex: 1 }}>
            <h1 style={S.title}>🎟 Imprimir boletos</h1>
            <p style={S.subtitle}>
              {rifa?.nombre} · {plantilla
                ? <>Plantilla: <strong style={{ color:'#0abfbc' }}>{plantilla.nombre}</strong></>
                : <span style={{ color:'#f0a500' }}>Sin plantilla asignada — usando default</span>
              }
            </p>
          </div>

          {/* Selector manual de plantilla */}
          {todasPlantillas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                Cambiar plantilla
              </label>
              <select
                value={plantilla?.id || ''}
                onChange={e => {
                  const id = e.target.value;
                  const sel = todasPlantillas.find(p => String(p.id) === String(id));
                  setPlantilla(sel || null);
                }}
                style={{
                  padding: '7px 10px',
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  minWidth: 220,
                  cursor: 'pointer',
                  background: '#fff',
                }}
              >
                {todasPlantillas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{(p.is_default || p.es_default) ? ' ⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              {/* ═══ Panel de configuración de impresión ═══ */}
              <div style={S.configBox}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 12,
                }}>
                  <strong style={{ fontSize: 12, color: '#0abfbc',
                    textTransform: 'uppercase', letterSpacing: 1.2 }}>
                    ⚙️ Configuración de impresión
                  </strong>
                  <button
                    onClick={() => {
                      // Auto-encajar: prueba reducir tamaño hasta sacar 9, 8 o 12
                      // por hoja según orientación. Mantiene proporción.
                      const propor = ticketAnchoCm / ticketAltoCm;
                      // Para horizontal busca 3×3 = 9; vertical busca 2×4 = 8
                      let mejor = null;
                      for (let w = 13; w >= 6; w -= 0.5) {
                        const h = +(w / propor).toFixed(1);
                        const l = calcularLayout(w, h, orientacion);
                        if (l.ok && (!mejor || l.perPage > mejor.perPage)) {
                          mejor = { w, h, perPage: l.perPage };
                        }
                      }
                      if (mejor) {
                        setTicketAnchoCm(mejor.w);
                        setTicketAltoCm(mejor.h);
                      }
                    }}
                    style={S.btnAutoFit}
                    title="Sugiere el tamaño que aprovecha mejor la hoja manteniendo la proporción"
                  >
                    ✨ Auto-encajar
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {/* Orientación */}
                  <div>
                    <div style={S.infoLabel}>Orientación de hoja</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button
                        onClick={() => setOrientacion('horizontal')}
                        style={{
                          ...S.btnToggle,
                          background: orientacion === 'horizontal' ? '#0abfbc' : '#fff',
                          color: orientacion === 'horizontal' ? '#fff' : '#666',
                          borderColor: orientacion === 'horizontal' ? '#0abfbc' : '#ddd',
                        }}
                      >📄 Horizontal</button>
                      <button
                        onClick={() => setOrientacion('vertical')}
                        style={{
                          ...S.btnToggle,
                          background: orientacion === 'vertical' ? '#0abfbc' : '#fff',
                          color: orientacion === 'vertical' ? '#fff' : '#666',
                          borderColor: orientacion === 'vertical' ? '#0abfbc' : '#ddd',
                        }}
                      >📃 Vertical</button>
                    </div>
                  </div>

                  {/* Ancho */}
                  <div>
                    <div style={S.infoLabel}>Ancho boleto (cm)</div>
                    <input
                      type="number"
                      step={0.1}
                      min={1}
                      max={30}
                      value={ticketAnchoCm}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) setTicketAnchoCm(v);
                      }}
                      style={S.numInput}
                    />
                  </div>

                  {/* Alto */}
                  <div>
                    <div style={S.infoLabel}>Alto boleto (cm)</div>
                    <input
                      type="number"
                      step={0.1}
                      min={1}
                      max={30}
                      value={ticketAltoCm}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) setTicketAltoCm(v);
                      }}
                      style={S.numInput}
                    />
                  </div>

                  {/* Resumen del layout en vivo */}
                  <div style={{
                    flex: 1, minWidth: 180,
                    padding: '8px 12px',
                    background: layout.ok ? '#e6faf9' : '#ffe5e5',
                    border: `1px solid ${layout.ok ? '#9ae3e0' : '#f5a5a5'}`,
                    borderRadius: 6,
                  }}>
                    {layout.ok ? (
                      <>
                        <div style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>
                          Hoja A4 {orientacion}: {layout.pageW}×{layout.pageH} mm
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: '#0abfbc',
                          marginTop: 2,
                        }}>
                          {layout.cols} cols × {layout.rows} filas = <span style={{ fontSize: 18 }}>{layout.perPage}</span> boletos/hoja
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#a02020', fontWeight: 600 }}>
                        ⚠️ {layout.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info bar */}
              <div style={S.infoBar}>
                <div>
                  <div style={S.infoLabel}>Vendedor</div>
                  <div style={S.infoValue}>{vendedorActual.vendedor_nombre}</div>
                </div>
                <div>
                  <div style={S.infoLabel}>Total boletos</div>
                  <div style={S.infoValue}>{numerosImprimir.length}</div>
                </div>
                <div>
                  <div style={S.infoLabel}>Hojas PDF</div>
                  <div style={S.infoValue}>
                    {totalPaginas} ({layout.perPage} por hoja)
                  </div>
                </div>
                <button
                  onClick={handleGenerarPDF}
                  disabled={generando || numerosImprimir.length === 0 || !layout.ok}
                  style={{
                    ...S.btnGenerar,
                    opacity: (generando || numerosImprimir.length === 0 || !layout.ok) ? 0.5 : 1,
                    cursor:  (generando || numerosImprimir.length === 0 || !layout.ok) ? 'not-allowed' : 'pointer',
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
                  📋 Números a imprimir (uno por número+serie):
                </strong>
                <div style={S.numerosLista}>
                  {numerosImprimir.length === 0 ? (
                    <span style={{ color: '#999', fontSize: 12 }}>
                      Este vendedor no tiene números asignados
                    </span>
                  ) : numerosImprimir.map(({ numero, serie }) => (
                    <span key={`${numero}-${serie}`} style={S.numeroChip}>
                      {numero}{serie ? <span style={{ opacity: 0.65, fontSize: 10 }}> {serie}</span> : null}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview del primer boleto */}
              {numerosImprimir.length > 0 && (
                <div style={S.previewBox}>
                  <h3 style={S.sectionTitle}>
                    Vista previa — boleto #{numerosImprimir[0].numero}{numerosImprimir[0].serie ? ` (Serie ${numerosImprimir[0].serie})` : ''}
                  </h3>

                  {/* Panel de diagnóstico de la plantilla */}
                  <details style={{
                    marginBottom: 10,
                    background: '#fffbe6',
                    border: '1px solid #f0d970',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontFamily: 'system-ui, sans-serif',
                  }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#8a6d00' }}>
                      🔍 Diagnóstico de la plantilla cargada
                    </summary>
                    <div style={{ marginTop: 8, color: '#5a4500', lineHeight: 1.6 }}>
                      <div>📄 <b>Plantilla:</b> {plantilla?.nombre || '(ninguna)'}</div>
                      <div>🆔 <b>ID:</b> {plantilla?.id || '—'}</div>
                      <div>📐 <b>Posiciones custom:</b> {Object.keys(design.positions || {}).length} campos</div>
                      <div>✨ <b>Textos custom:</b> {(design.customTexts || []).length}
                        {design.customTexts && design.customTexts.length > 0 && (
                          <span style={{ marginLeft: 8, color: '#8a6d00' }}>
                            ({design.customTexts.map(t => `"${t.value}"`).join(', ')})
                          </span>
                        )}
                      </div>
                      <div>🙈 <b>Campos ocultos:</b> {(design.hiddenFields || []).length}</div>
                      <div>📏 <b>Factor global:</b> {design.globalSizeFactor || 1.0}</div>
                      <div>🎨 <b>colorPremio1/2:</b> {design.colorPremio1} / {design.colorPremio2}</div>
                      <div>📍 <b>Rifa.ticket_template_id:</b> {rifa?.ticket_template_id || '(null)'}</div>
                      {(design.customTexts || []).length === 0 && Object.keys(design.positions || {}).length === 0 && (
                        <div style={{
                          marginTop: 8, padding: '6px 10px',
                          background: '#ffe0e0', borderRadius: 4,
                          color: '#a02020', fontWeight: 700,
                        }}>
                          ⚠️ Esta plantilla NO tiene positions ni customTexts.
                          Probable causa: el backend no los está guardando o devolviendo.
                          Revisa la consola para ver qué llega del API.
                        </div>
                      )}
                    </div>
                  </details>

                  <div style={S.previewWrapper}>
                    <TicketEditable
                      r={rifa}
                      numero={numerosImprimir[0].numero}
                      design={{ ...design, numBoleto: numerosImprimir[0].numero }}
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
  configBox: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '14px 18px',
  },
  btnToggle: {
    padding: '7px 14px',
    border: '1.5px solid #ddd',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all .15s',
  },
  numInput: {
    width: 80,
    padding: '7px 10px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    color: C.text,
    marginTop: 4,
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  btnAutoFit: {
    padding: '5px 12px',
    background: '#fff8e6',
    border: '1.5px solid #f0a500',
    color: '#a87600',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
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