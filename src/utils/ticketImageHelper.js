import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import html2canvas from 'html2canvas';
import API from '../services/api';
import TicketEditable from '../components/TicketEditable';
import { DEFAULT_DESIGN } from '../components/Ticket';

// Cache de plantillas para no repetir GET en cada generación
let _plantillasCache = null;
let _plantillasCacheTime = 0;
const CACHE_TTL = 60_000; // 1 minuto

export async function cargarPlantillas() {
  const ahora = Date.now();
  if (_plantillasCache && (ahora - _plantillasCacheTime) < CACHE_TTL) {
    return _plantillasCache;
  }
  try {
    const r = await API.get('/ticket-templates');
    _plantillasCache = r.data || [];
    _plantillasCacheTime = ahora;
    return _plantillasCache;
  } catch {
    return [];
  }
}

/**
 * Invalida el caché si supiste que cambió algo.
 */
export function invalidarCachePlantillas() {
  _plantillasCache = null;
  _plantillasCacheTime = 0;
}

/**
 * Resuelve la plantilla a usar para una rifa, con la misma
 * prioridad que usa ImprimirBoletos:
 *   1. rifa.ticket_template_id (asignada explícitamente)
 *   2. plantilla marcada como is_default / es_default
 *   3. primera plantilla disponible
 *   4. DEFAULT_DESIGN (fallback)
 */
export async function resolverPlantillaParaRifa(rifa) {
  const todas = await cargarPlantillas();

  let tpl = null;
  if (rifa?.ticket_template_id) {
    tpl = todas.find(p => String(p.id) === String(rifa.ticket_template_id));
  }
  if (!tpl) tpl = todas.find(p => p.es_default || p.is_default);
  if (!tpl && todas.length > 0) tpl = todas[0];

  return tpl;
}

/**
 * Extrae el design de una plantilla con tolerancia a:
 * - design como objeto
 * - design como string JSON
 * - claves alternativas (ticket_design, config, diseno)
 */
export function extraerDesign(plantilla) {
  if (!plantilla) return null;
  const candidatos = [
    plantilla.design,
    plantilla.ticket_design,
    plantilla.config,
    plantilla.diseno,
  ];
  for (const cand of candidatos) {
    if (!cand) continue;
    if (typeof cand === 'string') {
      try {
        const parsed = JSON.parse(cand);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch { /* sigue */ }
    } else if (typeof cand === 'object') {
      return cand;
    }
  }
  return null;
}

/**
 * Genera la imagen PNG (dataURL) del ticket usando TicketEditable
 * con printMode=true, respetando la plantilla del dueño.
 *
 * @param {object} opts
 * @param {object} opts.rifa     — datos de la rifa (premio, fecha_sorteo, hora_sorteo, etc.)
 * @param {string} opts.numero   — número del boleto (ej. "123")
 * @param {object} [opts.plantilla] — plantilla pre-cargada. Si no se pasa, se resuelve via rifa.ticket_template_id
 * @param {object} [opts.designOverride] — design completo para usar directo (omite resolución)
 * @param {number} [opts.scale=3] — calidad de captura (1-4)
 * @returns {Promise<string|null>} dataURL PNG o null si falla
 */
export async function generarImagenTicketTemplate({
  rifa,
  numero,
  plantilla,
  designOverride,
  scale = 3,
}) {
  if (!rifa || !numero) {
    console.warn('[ticketImageHelper] Faltan rifa o numero');
    return null;
  }

  // Resolver el design final
  let design;
  if (designOverride) {
    design = { ...DEFAULT_DESIGN, ...designOverride };
  } else {
    const tpl = plantilla || await resolverPlantillaParaRifa(rifa);
    const extraido = extraerDesign(tpl);
    design = extraido
      ? { ...DEFAULT_DESIGN, ...extraido }
      : { ...DEFAULT_DESIGN };
  }

  // Aseguramos que numBoleto vaya con el número correcto
  design = { ...design, numBoleto: numero };

  // Renderizar TicketEditable en un div oculto
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${design.ticketWidth + 10}px;
    height: ${design.ticketHeight + 10}px;
    z-index: -1;
    background: ${design.bgPaper || '#ffffff'};
  `;
  document.body.appendChild(div);

  const root = createRoot(div);

  try {
    // Render + esperar a que todo se pinte (SVG, fuentes, gradient)
    await new Promise(resolve => {
      root.render(
        createElement(TicketEditable, {
          r: rifa,
          numero,
          design,
          printMode: true,
        })
      );
      setTimeout(resolve, 450);
    });

    // Localizar el canvas real del ticket (no el wrapper externo)
    const canvasNode = div.querySelector('[data-ticket-canvas="true"]') || div.firstChild;

    const canvas = await html2canvas(canvasNode, {
      scale,
      useCORS: true,
      backgroundColor: design.bgPaper || '#ffffff',
      width: design.ticketWidth,
      height: design.ticketHeight,
      windowWidth: design.ticketWidth,
      windowHeight: design.ticketHeight,
      logging: false,
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('[ticketImageHelper] Error generando imagen:', err);
    return null;
  } finally {
    try { root.unmount(); } catch { /* ignore */ }
    try { document.body.removeChild(div); } catch { /* ignore */ }
  }
}
