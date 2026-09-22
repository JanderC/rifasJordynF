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
import API from '../services/api';
import TicketEditable from '../components/TicketEditable';
import { DEFAULT_DESIGN } from '../components/Ticket';
import {
  PAPELES,
  calcularLayout,
  celda,
  ajustarEnCelda,
  capturarNodo,
  esperarRecursos,
  crearLienzoOculto,
  destruirLienzoOculto,
  canvasADato,
  marcasDeCorte,
  pxACm,
  cm1,
} from '../utils/printTicket';

// ── Presets de separación entre boletos (mm) ─────────────────
const SEPARACIONES = [
  { label: 'Pegados', mm: 0 },
  { label: 'Justo',   mm: 3 },
  { label: 'Normal',  mm: 6 },
  { label: 'Amplio',  mm: 10 },
  { label: 'Tijera',  mm: 14 },
];

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

  // ── Configuración de impresión ──
  const [papel, setPapel]                   = useState('a4');
  const [orientacion, setOrientacion]       = useState('horizontal'); // 'horizontal' | 'vertical'
  const [ticketAnchoCm, setTicketAnchoCm]   = useState(11);
  const [ticketAltoCm, setTicketAltoCm]     = useState(6.5);
  const [mantenerProporcion, setMantenerProporcion] = useState(true);
  const [modoAjuste, setModoAjuste]         = useState('contener');   // 'contener' | 'estirar'

  // Separación entre boletos (mm) — independiente en cada eje
  const [gapXMm, setGapXMm]                 = useState(6);
  const [gapYMm, setGapYMm]                 = useState(6);
  const [gapLigado, setGapLigado]           = useState(true);         // mover ambos a la vez
  const [margenMm, setMargenMm]             = useState(6);

  // Rejilla: automática (los que quepan) o fijada a mano
  const [rejillaManual, setRejillaManual]   = useState(false);
  const [colsManual, setColsManual]         = useState(2);
  const [rowsManual, setRowsManual]         = useState(3);

  const [dpi, setDpi]                       = useState(300);
  const [formato, setFormato]               = useState('PNG');        // 'PNG' | 'JPEG'
  const [estiloMarcas, setEstiloMarcas]     = useState('esquinas');   // 'esquinas' | 'marco' | 'ninguna'
  const [tamanoTocado, setTamanoTocado]     = useState(false);

  const setGap = (eje, v) => {
    const n = Math.max(0, Math.min(40, Number(v) || 0));
    if (gapLigado) { setGapXMm(n); setGapYMm(n); }
    else if (eje === 'x') setGapXMm(n);
    else setGapYMm(n);
  };

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

  // ── Tamaño real del DISEÑO (px del lienzo → cm a 96 dpi) ──
  // Esta es la proporción que hay que respetar: si el rectángulo del
  // PDF tiene otra proporción, la imagen se estira y "los objetos
  // se mueven" respecto al borde del boleto.
  const disW = Number(design.ticketWidth)  || 760;
  const disH = Number(design.ticketHeight) || 340;
  const aspectoDiseno = disW / disH;
  const disAnchoCm = cm1(pxACm(disW));
  const disAltoCm  = cm1(pxACm(disH));

  // Al cargar / cambiar de plantilla, adoptamos el tamaño del diseño
  // (1:1 exacto) mientras el usuario no lo haya modificado a mano.
  useEffect(() => {
    if (tamanoTocado) return;
    setTicketAnchoCm(disAnchoCm);
    setTicketAltoCm(disAltoCm);
  }, [disAnchoCm, disAltoCm, tamanoTocado]);

  // Cambiar ancho/alto respetando la proporción del diseño
  const cambiarAncho = (v) => {
    setTamanoTocado(true);
    setTicketAnchoCm(v);
    if (mantenerProporcion && v > 0) setTicketAltoCm(cm1(v / aspectoDiseno));
  };
  const cambiarAlto = (v) => {
    setTamanoTocado(true);
    setTicketAltoCm(v);
    if (mantenerProporcion && v > 0) setTicketAnchoCm(cm1(v * aspectoDiseno));
  };

  // ¿La proporción pedida coincide con la del diseño?
  const aspectoImpresion = (ticketAnchoCm || 1) / (ticketAltoCm || 1);
  const proporcionOk = Math.abs(aspectoImpresion - aspectoDiseno) < 0.01;

  // Layout calculado en vivo
  const layout = useMemo(
    () => calcularLayout({
      anchoCm: ticketAnchoCm,
      altoCm: ticketAltoCm,
      papel,
      orientacion,
      gapXMm,
      gapYMm,
      margenMm,
      aspecto: aspectoDiseno,
      modoAjuste,
      cols: rejillaManual ? colsManual : null,
      rows: rejillaManual ? rowsManual : null,
    }),
    [ticketAnchoCm, ticketAltoCm, papel, orientacion, gapXMm, gapYMm,
     margenMm, aspectoDiseno, modoAjuste, rejillaManual, colsManual, rowsManual]
  );

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
      format: PAPELES[papel].jsPdf,
      compress: true,
    });

    // ── Un ÚNICO lienzo oculto y una ÚNICA raíz de React ──
    // (antes se creaba un root por boleto: lento y propenso a
    //  capturar antes de que el DOM estuviera estable)
    const fondo = design.bgPaper || '#ffffff';
    const cont  = crearLienzoOculto(disW + 40, disH + 40, fondo);
    const root  = createRoot(cont);

    try {
      const porPagina  = layout.perPage;
      const totalPag   = Math.ceil(numerosImprimir.length / porPagina);
      let hechos       = 0;

      for (let p = 0; p < totalPag; p++) {
        if (p > 0) pdf.addPage();

        const items = numerosImprimir.slice(p * porPagina, (p + 1) * porPagina);

        // Guías de corte debajo de los boletos
        marcasDeCorte(pdf, layout, items.length, estiloMarcas);

        for (let k = 0; k < items.length; k++) {
          const { numero } = items[k];

          // 1. Renderizar el boleto con su número real
          root.render(
            <TicketEditable
              r={rifa}
              numero={numero}
              design={{ ...design, numBoleto: numero }}
              printMode={true}
            />
          );

          // 2. Esperar fuentes + imágenes (clave para que NADA se mueva)
          await esperarRecursos(cont, 40);

          // 3. Capturar SOLO el lienzo del boleto, a su tamaño real
          const nodo = cont.querySelector('[data-ticket-canvas="true"]');
          if (!nodo) throw new Error('No se encontró el lienzo del boleto');

          const canvas = await capturarNodo(nodo, { dpi, fondo });

          // 4. Colocar en la hoja SIN deformar:
          //    la proporción real capturada manda.
          const c = celda(layout, k);
          const aspecto = canvas.width / canvas.height;
          const r = ajustarEnCelda(aspecto, c.w, c.h, modoAjuste);
          const { data, fmt } = canvasADato(canvas, formato, 0.95);

          pdf.addImage(
            data, fmt,
            +(c.x + r.x).toFixed(2),
            +(c.y + r.y).toFixed(2),
            +r.w.toFixed(2),
            +r.h.toFixed(2),
            undefined,
            'FAST'
          );

          hechos++;
          setProgreso(Math.round((hechos / numerosImprimir.length) * 100));
        }
      }

      const nombreRifa = (rifa?.nombre || 'rifa').replace(/[^\w-]+/g, '_');
      const nombreVend = (vendedorActual?.vendedor_nombre || 'vendedor').replace(/[^\w-]+/g, '_');
      pdf.save(`boletos_${nombreRifa}_${nombreVend}.pdf`);
    } catch (err) {
      console.error('[ImprimirBoletos] Error generando PDF:', err);
      alert('No se pudo generar el PDF: ' + (err.message || err));
    } finally {
      // Desmontar fuera del ciclo de render de React
      setTimeout(() => {
        try { root.unmount(); } catch (_) {}
        destruirLienzoOculto(cont);
      }, 0);
      setGenerando(false);
      setProgreso(0);
    }
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
                    ⚙️ Tamaño y disposición
                  </strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        // Vuelve al tamaño EXACTO del diseño → 1:1 perfecto
                        setTamanoTocado(false);
                        setTicketAnchoCm(disAnchoCm);
                        setTicketAltoCm(disAltoCm);
                        setMantenerProporcion(true);
                      }}
                      style={S.btnAutoFit}
                      title="Usa el tamaño real con el que se diseñó la plantilla"
                    >
                      🎯 Tamaño del diseño
                    </button>
                    <button
                      onClick={() => {
                        // Busca el ancho que más boletos mete por hoja,
                        // SIEMPRE conservando la proporción del diseño.
                        let mejor = null;
                        for (let w = 20; w >= 4; w -= 0.1) {
                          const wr = cm1(w);
                          const hr = cm1(wr / aspectoDiseno);
                          const l = calcularLayout({
                            anchoCm: wr, altoCm: hr, papel, orientacion,
                            gapXMm, gapYMm, margenMm,
                            aspecto: aspectoDiseno, modoAjuste,
                          });
                          if (l.ok && (!mejor || l.perPage > mejor.perPage)) {
                            mejor = { w: wr, h: hr, perPage: l.perPage };
                          }
                        }
                        if (mejor) {
                          setTamanoTocado(true);
                          setMantenerProporcion(true);
                          setTicketAnchoCm(mejor.w);
                          setTicketAltoCm(mejor.h);
                        }
                      }}
                      style={S.btnAutoFit}
                      title="Aprovecha al máximo la hoja sin deformar el diseño"
                    >
                      ✨ Auto-encajar
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {/* Papel */}
                  <div>
                    <div style={S.infoLabel}>Hoja</div>
                    <select
                      value={papel}
                      onChange={e => setPapel(e.target.value)}
                      style={{ ...S.numInput, width: 110, textAlign: 'left' }}
                    >
                      {Object.entries(PAPELES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Orientación */}
                  <div>
                    <div style={S.infoLabel}>Orientación</div>
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

                  {/* Tamaño del boleto */}
                  <div>
                    <div style={S.infoLabel}>Tamaño del boleto (cm)</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <input
                        type="number" step={0.1} min={2} max={35}
                        value={ticketAnchoCm}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) cambiarAncho(v);
                        }}
                        style={{ ...S.numInput, marginTop: 0 }}
                      />
                      <button
                        onClick={() => setMantenerProporcion(v => !v)}
                        title={mantenerProporcion
                          ? 'Proporción del diseño bloqueada (recomendado)'
                          : 'Proporción libre — el diseño puede deformarse'}
                        style={{
                          ...S.btnToggle,
                          padding: '7px 10px',
                          background: mantenerProporcion ? '#e6faf9' : '#fff',
                          borderColor: mantenerProporcion ? '#0abfbc' : '#ddd',
                          color: mantenerProporcion ? '#089a98' : '#999',
                        }}
                      >{mantenerProporcion ? '🔒' : '🔓'}</button>
                      <input
                        type="number" step={0.1} min={2} max={35}
                        value={ticketAltoCm}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) cambiarAlto(v);
                        }}
                        style={{ ...S.numInput, marginTop: 0 }}
                      />
                    </div>
                  </div>

                  {/* Margen de la hoja */}
                  <div>
                    <div style={S.infoLabel}>Margen de hoja (mm)</div>
                    <input
                      type="number" step={1} min={0} max={30}
                      value={margenMm}
                      onChange={e => setMargenMm(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ ...S.numInput, width: 72, marginTop: 4 }}
                    />
                  </div>

                  {/* Resumen del layout en vivo */}
                  <div style={{
                    flex: 1, minWidth: 200,
                    padding: '8px 12px',
                    background: layout.ok ? '#e6faf9' : '#ffe5e5',
                    border: `1px solid ${layout.ok ? '#9ae3e0' : '#f5a5a5'}`,
                    borderRadius: 6,
                  }}>
                    {layout.ok ? (
                      <>
                        <div style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>
                          {PAPELES[papel].label} {orientacion}: {Math.round(layout.pageW)}×{Math.round(layout.pageH)} mm
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: '#0abfbc',
                          marginTop: 2,
                        }}>
                          {layout.cols} × {layout.rows} = <span style={{ fontSize: 18 }}>{layout.perPage}</span> boletos/hoja
                        </div>
                        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                          Boleto impreso: {(layout.ticketW / 10).toFixed(1)}×{(layout.ticketH / 10).toFixed(1)} cm
                          {' '}· separación {layout.gapXMm}/{layout.gapYMm} mm
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#a02020', fontWeight: 600 }}>
                        ⚠️ {layout.error}
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══ Separación entre boletos ═══ */}
                <div style={S.gapBox}>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: 10, flexWrap: 'wrap', marginBottom: 10,
                  }}>
                    <strong style={{ fontSize: 12, color: '#0abfbc',
                      textTransform: 'uppercase', letterSpacing: 1.2 }}>
                      ✂️ Separación entre boletos
                    </strong>
                    <button
                      onClick={() => {
                        const n = !gapLigado;
                        setGapLigado(n);
                        if (n) setGapYMm(gapXMm);
                      }}
                      title={gapLigado
                        ? 'Horizontal y vertical se mueven juntos'
                        : 'Cada eje se ajusta por separado'}
                      style={{
                        ...S.btnToggle,
                        padding: '4px 10px', fontSize: 11,
                        background: gapLigado ? '#e6faf9' : '#fff',
                        borderColor: gapLigado ? '#0abfbc' : '#ddd',
                        color: gapLigado ? '#089a98' : '#888',
                      }}
                    >{gapLigado ? '🔗 Ejes ligados' : '⛓️‍💥 Ejes libres'}</button>

                    <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', flexWrap: 'wrap' }}>
                      {SEPARACIONES.map(p => {
                        const activo = gapXMm === p.mm && gapYMm === p.mm;
                        return (
                          <button key={p.label}
                            onClick={() => { setGapXMm(p.mm); setGapYMm(p.mm); }}
                            title={`${p.mm} mm`}
                            style={{
                              ...S.btnToggle,
                              padding: '4px 9px', fontSize: 11,
                              background: activo ? '#0abfbc' : '#fff',
                              color: activo ? '#fff' : '#666',
                              borderColor: activo ? '#0abfbc' : '#ddd',
                            }}>{p.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sliders por eje */}
                  {[
                    { eje: 'x', label: '↔ Horizontal', val: gapXMm, max: layout.gapMaxX },
                    { eje: 'y', label: '↕ Vertical',   val: gapYMm, max: layout.gapMaxY },
                  ].map(({ eje, label, val, max }) => (
                    <div key={eje} style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#666',
                        width: 88, flexShrink: 0,
                      }}>{label}</span>
                      <input
                        type="range" min={0} max={30} step={0.5}
                        value={val}
                        onChange={e => setGap(eje, e.target.value)}
                        style={{ flex: 1, minWidth: 120, accentColor: '#0abfbc' }}
                      />
                      <input
                        type="number" step={0.5} min={0} max={40}
                        value={val}
                        onChange={e => setGap(eje, e.target.value)}
                        style={{ ...S.numInput, width: 68, marginTop: 0 }}
                      />
                      <span style={{ fontSize: 11, color: '#999', width: 92, flexShrink: 0 }}>
                        mm {isFinite(max) && max > 0 && `· máx ${max.toFixed(1)}`}
                      </span>
                    </div>
                  ))}

                  {/* Rejilla manual */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e0e8e8',
                    flexWrap: 'wrap',
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, color: '#666', cursor: 'pointer',
                    }}>
                      <input type="checkbox" checked={rejillaManual}
                        onChange={e => {
                          setRejillaManual(e.target.checked);
                          if (e.target.checked) {
                            setColsManual(layout.cols || 2);
                            setRowsManual(layout.rows || 3);
                          }
                        }} />
                      Fijar cuántos por hoja
                    </label>
                    {rejillaManual && (
                      <>
                        <span style={{ fontSize: 11, color: '#999' }}>columnas</span>
                        <input type="number" min={1} max={12} value={colsManual}
                          onChange={e => setColsManual(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ ...S.numInput, width: 58, marginTop: 0 }} />
                        <span style={{ fontSize: 11, color: '#999' }}>filas</span>
                        <input type="number" min={1} max={12} value={rowsManual}
                          onChange={e => setRowsManual(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ ...S.numInput, width: 58, marginTop: 0 }} />
                        <span style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>
                          = {colsManual * rowsManual} por hoja
                        </span>
                      </>
                    )}
                    {!rejillaManual && (
                      <span style={{ fontSize: 11, color: '#999' }}>
                        Automático: se acomodan los que quepan ({layout.maxCols || 0}×{layout.maxRows || 0})
                      </span>
                    )}
                  </div>

                  {/* Estado / avisos de la hoja */}
                  <div style={{
                    marginTop: 10,
                    padding: '9px 12px',
                    borderRadius: 6,
                    background: layout.ok ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${layout.ok ? '#bbf7d0' : '#fecaca'}`,
                    fontSize: 11.5,
                    lineHeight: 1.6,
                    color: layout.ok ? '#166534' : '#b91c1c',
                  }}>
                    {layout.ok ? (
                      <>
                        <div style={{ fontWeight: 700 }}>
                          ✅ Cabe en la hoja: {layout.cols}×{layout.rows} = {layout.perPage} boletos
                        </div>
                        <div style={{ color: '#3f7d52' }}>
                          Ocupa {layout.usadoX.toFixed(1)}×{layout.usadoY.toFixed(1)} mm de{' '}
                          {layout.utilW.toFixed(1)}×{layout.utilH.toFixed(1)} mm útiles ·
                          libre {layout.sobraX.toFixed(1)} mm a los lados y{' '}
                          {layout.sobraY.toFixed(1)} mm arriba/abajo.
                        </div>
                        {(layout.avisos || []).map((a, i) => (
                          <div key={i} style={{ color: '#a16207' }}>💡 {a}</div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 800 }}>🚫 SE SALE DE LA HOJA</div>
                        <div>{layout.error}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {layout.cols > 1 && isFinite(layout.gapMaxX) && layout.desbordeX > 0.01 && (
                            <button
                              onClick={() => setGapXMm(Math.floor(layout.gapMaxX * 2) / 2)}
                              style={{ ...S.btnToggle, padding: '5px 10px' }}>
                              ↔ Bajar a {(Math.floor(layout.gapMaxX * 2) / 2).toFixed(1)} mm
                            </button>
                          )}
                          {layout.rows > 1 && isFinite(layout.gapMaxY) && layout.desbordeY > 0.01 && (
                            <button
                              onClick={() => setGapYMm(Math.floor(layout.gapMaxY * 2) / 2)}
                              style={{ ...S.btnToggle, padding: '5px 10px' }}>
                              ↕ Bajar a {(Math.floor(layout.gapMaxY * 2) / 2).toFixed(1)} mm
                            </button>
                          )}
                          {rejillaManual && (
                            <button
                              onClick={() => setRejillaManual(false)}
                              style={{ ...S.btnToggle, padding: '5px 10px' }}>
                              🔄 Volver a automático
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Aviso de proporción */}
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: proporcionOk ? '#f0fdf4' : '#fff7ed',
                  border: `1px solid ${proporcionOk ? '#bbf7d0' : '#fed7aa'}`,
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: proporcionOk ? '#166534' : '#9a3412',
                }}>
                  {proporcionOk ? (
                    <>
                      ✅ <strong>Impresión 1:1.</strong> El diseño mide{' '}
                      {disAnchoCm}×{disAltoCm} cm ({disW}×{disH} px) y se imprime con la
                      misma proporción: nada se estira ni se desplaza.
                    </>
                  ) : (
                    <>
                      ⚠️ <strong>La proporción no coincide.</strong> El diseño es{' '}
                      {disAnchoCm}×{disAltoCm} cm y estás imprimiendo a{' '}
                      {cm1(ticketAnchoCm)}×{cm1(ticketAltoCm)} cm.
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>Qué hacer:</span>
                        <button
                          onClick={() => setModoAjuste('contener')}
                          style={{
                            ...S.btnToggle,
                            padding: '5px 10px',
                            background: modoAjuste === 'contener' ? '#0abfbc' : '#fff',
                            color: modoAjuste === 'contener' ? '#fff' : '#666',
                            borderColor: modoAjuste === 'contener' ? '#0abfbc' : '#ddd',
                          }}
                        >Centrar sin deformar</button>
                        <button
                          onClick={() => setModoAjuste('estirar')}
                          style={{
                            ...S.btnToggle,
                            padding: '5px 10px',
                            background: modoAjuste === 'estirar' ? '#f0a500' : '#fff',
                            color: modoAjuste === 'estirar' ? '#fff' : '#666',
                            borderColor: modoAjuste === 'estirar' ? '#f0a500' : '#ddd',
                          }}
                        >Estirar (deforma)</button>
                        <span style={{ opacity: .8 }}>
                          · o cambia el tamaño del lienzo en el editor de plantillas (📐).
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Calidad */}
                <div style={{
                  display: 'flex', gap: 16, flexWrap: 'wrap',
                  alignItems: 'flex-end', marginTop: 12,
                  paddingTop: 12, borderTop: '1px solid #eee',
                }}>
                  <div>
                    <div style={S.infoLabel}>Resolución</div>
                    <select
                      value={dpi}
                      onChange={e => setDpi(Number(e.target.value))}
                      style={{ ...S.numInput, width: 150, textAlign: 'left' }}
                    >
                      <option value={150}>150 dpi · borrador</option>
                      <option value={220}>220 dpi · normal</option>
                      <option value={300}>300 dpi · imprenta</option>
                      <option value={400}>400 dpi · máxima</option>
                    </select>
                  </div>
                  <div>
                    <div style={S.infoLabel}>Formato interno</div>
                    <select
                      value={formato}
                      onChange={e => setFormato(e.target.value)}
                      style={{ ...S.numInput, width: 170, textAlign: 'left' }}
                    >
                      <option value="PNG">PNG · texto nítido</option>
                      <option value="JPEG">JPEG · archivo liviano</option>
                    </select>
                  </div>
                  <div>
                    <div style={S.infoLabel}>Guías de corte</div>
                    <select
                      value={estiloMarcas}
                      onChange={e => setEstiloMarcas(e.target.value)}
                      style={{ ...S.numInput, width: 190, textAlign: 'left' }}
                    >
                      <option value="esquinas">✂️ Marcas en las esquinas</option>
                      <option value="marco">▭ Recuadro completo</option>
                      <option value="ninguna">∅ Sin guías</option>
                    </select>
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
                      {numero}{serie ? <span style={{ opacity: 0.65, fontSize: 10 }}></span> : null}
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
                      <div>📐 <b>Lienzo:</b> {disW}×{disH} px = {disAnchoCm}×{disAltoCm} cm
                        {' '}(proporción {aspectoDiseno.toFixed(3)})</div>
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
                    Vista a tamaño real del diseño: <strong>{disAnchoCm}×{disAltoCm} cm</strong>
                    {' '}({disW}×{disH} px) · se imprimirá a{' '}
                    <strong>{cm1(ticketAnchoCm)}×{cm1(ticketAltoCm)} cm</strong>.
                    Los demás boletos salen idénticos, cambiando solo el número.
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
  gapBox: {
    marginTop: 12,
    padding: '12px 14px',
    background: '#f8fafa',
    border: '1px solid #e0e8e8',
    borderRadius: 8,
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