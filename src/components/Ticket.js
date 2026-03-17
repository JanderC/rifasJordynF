// ============================================================
//   RIFAS JORDYN — Componente Ticket
//   ✅ Diseño usando el CSS real del sistema (Poppins, --jordyn-*)
//   ✅ Persistencia en BD via GET /api/ticket-design
//   ✅ Sin localStorage, sin fuentes externas adicionales
//   ✅ parseFecha + extraerHora sin desfase UTC
// ============================================================
import React, { useState, useEffect } from 'react';
import API from '../services/api';

// ── DEFAULT_DESIGN ────────────────────────────────────────
export const DEFAULT_DESIGN = {
  brandText:    'RIFAS JORDYN',
  footerText:   'Conserve este boleto · Válido solo con número legible',
  accentColor:  '#0abfbc',   // --jordyn-primary
  accentColor2: '#f0a500',   // --jordyn-gold
  bgDark:       '#1a2e2e',   // --jordyn-text (fondo boleto oscuro)
  watermarkText:'JORDYN',
  horaSort:     '',
};

// ── Helpers fecha ─────────────────────────────────────────
const parseFechaTicket = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFecha = (f) => {
  const d = parseFechaTicket(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Caracas',
  });
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
const fmtMoney = (p) => p
  ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p)
  : '$0';
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
//   buildTicketHTML — HTML para impresión
//   Fuente: Poppins (ya cargada por el sistema)
//   Colores: del design guardado en BD
// ─────────────────────────────────────────────────────────────
export function buildTicketHTML(d, r, numero, comprador, vendedor, copia) {
  const nombre  = r?.rifa_nombre || r?.nombre || 'RIFA';
  const premio  = r?.premio      || '—';
  const loteria = r?.loteria_ref || '';
  const valor   = fmtMoney(r?.precio);
  const fecha   = fmtFecha(r?.fecha_sorteo);
  const hora    = extraerHora(r?.fecha_sorteo, d.horaSort);
  const serial  = mkSerial(numero);
  const hoy     = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Caracas' });
  const nom     = comprador?.nombre   || '';
  const tel     = comprador?.telefono || '';
  const ced     = comprador?.cedula   || '';
  const isOrig  = copia === 1;

  const ac  = d.accentColor  || '#0abfbc';
  const ac2 = d.accentColor2 || '#f0a500';
  const bg  = d.bgDark       || '#1a2e2e';

  const cell = (label, value) => !value ? '' : `
    <div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07);">
      <div style="font-size:.5rem;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.35);text-transform:uppercase;margin-bottom:2px;">${label}</div>
      <div style="font-size:.82rem;font-weight:600;color:#f0f4f4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${value}</div>
    </div>`;

  const cellLight = (label, value) => !value ? '' : `
    <div>
      <div style="font-size:.48rem;font-weight:700;letter-spacing:2px;color:#aaa;text-transform:uppercase;margin-bottom:2px;">${label}</div>
      <div style="font-size:.75rem;font-weight:700;color:#1a2e2e;border-bottom:1.5px solid #d0ecec;padding-bottom:2px;min-height:18px;">${value}</div>
    </div>`;

  return `
<div style="width:660px;margin:10px auto;font-family:'Poppins',sans-serif;page-break-inside:avoid;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25);">

  <!-- BOLETO PRINCIPAL -->
  <div style="background:${bg};position:relative;overflow:hidden;">

    <!-- Watermark sutil -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);
      font-family:'Poppins',sans-serif;font-size:5rem;font-weight:900;
      color:rgba(255,255,255,.018);white-space:nowrap;pointer-events:none;letter-spacing:20px;">
      ${d.watermarkText || 'JORDYN'}
    </div>

    <!-- Franja top -->
    <div style="height:4px;background:linear-gradient(90deg,${ac},${ac2},${ac});"></div>

    <div style="display:flex;min-height:200px;">

      <!-- Columna número -->
      <div style="width:190px;flex-shrink:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:20px 14px;
        border-right:1px dashed rgba(255,255,255,.1);position:relative;">

        <!-- Círculo glow de fondo -->
        <div style="position:absolute;width:120px;height:120px;border-radius:50%;
          background:radial-gradient(circle,${ac}20 0%,transparent 65%);"></div>

        <div style="font-size:.48rem;font-weight:700;letter-spacing:4px;
          color:${ac}99;text-transform:uppercase;margin-bottom:6px;">Nº de la suerte</div>

        <div style="font-family:'Poppins',sans-serif;font-weight:900;font-size:4.5rem;
          color:${ac};line-height:1;letter-spacing:10px;padding-left:10px;
          text-shadow:0 0 28px ${ac}55;position:relative;z-index:1;">${numero || '000'}</div>

        <div style="margin-top:10px;font-size:.48rem;font-weight:600;letter-spacing:2px;
          color:rgba(255,255,255,.3);text-align:center;max-width:155px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>

        <!-- Badge ORIGINAL/COPIA -->
        <div style="position:absolute;top:10px;right:10px;font-size:.38rem;font-weight:700;
          letter-spacing:2px;color:${isOrig ? ac+'cc' : 'rgba(255,255,255,.25)'};
          border:1px solid ${isOrig ? ac+'44' : 'rgba(255,255,255,.1)'};
          padding:2px 7px;border-radius:3px;">${isOrig ? 'ORIGINAL' : 'COPIA'}</div>
      </div>

      <!-- Columna datos -->
      <div style="flex:1;padding:16px 20px;display:flex;flex-direction:column;">

        <!-- Marca + serial -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.07);">
          <div>
            <div style="font-size:.95rem;font-weight:800;color:${ac};letter-spacing:1px;">${d.brandText || 'RIFAS JORDYN'}</div>
            ${loteria ? `<div style="font-size:.45rem;font-weight:600;color:rgba(255,255,255,.35);letter-spacing:1px;margin-top:2px;">🎲 ${loteria}</div>` : ''}
          </div>
          <div style="text-align:right;font-size:.4rem;color:rgba(255,255,255,.28);line-height:1.9;">
            <div style="color:${ac2};font-size:.48rem;font-weight:800;letter-spacing:1px;">${serial}</div>
            <div>${hoy}</div>
          </div>
        </div>

        <!-- Premio -->
        <div style="margin-bottom:12px;padding:8px 12px;
          background:rgba(255,255,255,.04);border-radius:8px;
          border-left:3px solid ${ac2};">
          <div style="font-size:.44rem;font-weight:700;letter-spacing:3px;color:${ac2}88;
            text-transform:uppercase;margin-bottom:3px;">🏆 Primer Premio</div>
          <div style="font-size:1.1rem;font-weight:800;color:#fff;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${premio}</div>
        </div>

        <!-- Grid datos -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px;flex:1;">
          ${cell('Sorteo', fecha + (hora ? ` · ${hora}` : ''))}
          ${cell('Valor',  valor)}
          ${cell('Comprador', nom)}
          ${cell('C.I.', ced)}
          ${cell('Teléfono', tel)}
          ${cell('Vendedor', vendedor || '')}
        </div>

        <!-- Footer boleto -->
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.05);
          font-size:.38rem;font-weight:500;color:rgba(255,255,255,.18);letter-spacing:1px;">
          ${d.footerText || ''}
        </div>
      </div>
    </div>

    <!-- Franja bottom -->
    <div style="height:3px;background:linear-gradient(90deg,${ac2},${ac},${ac2});"></div>
  </div>

  <!-- TALÓN -->
  <div style="background:#f5fffe;border:1px solid #d0ecec;border-top:none;">

    <!-- Línea de corte -->
    <div style="display:flex;align-items:center;height:18px;padding:0 14px;border-top:2px dashed #b5dede;">
      <div style="flex:1;"></div>
      <div style="font-size:.38rem;font-weight:600;color:#aecece;letter-spacing:3px;white-space:nowrap;">
        ✂ &nbsp; TALÓN — QUEDA CON EL VENDEDOR &nbsp; ✂
      </div>
      <div style="flex:1;"></div>
    </div>

    <!-- Contenido talón -->
    <div style="display:flex;align-items:center;padding:10px 14px;gap:14px;">

      <!-- Mini número -->
      <div style="background:${bg};border-radius:10px;padding:8px 14px;text-align:center;flex-shrink:0;min-width:80px;">
        <div style="font-size:.38rem;font-weight:700;letter-spacing:3px;color:${ac}88;margin-bottom:2px;">N°</div>
        <div style="font-family:'Poppins',sans-serif;font-weight:900;font-size:1.9rem;
          color:${ac};letter-spacing:6px;">${numero || '000'}</div>
      </div>

      <!-- Datos talón -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 14px;flex:1;">
        ${cellLight('Nombre',   nom)}
        ${cellLight('Cédula',   ced)}
        ${cellLight('Teléfono', tel)}
        ${cellLight('Sorteo',   fecha + (hora ? ` · ${hora}` : ''))}
        ${cellLight('Premio',   premio)}
        <div style="text-align:right;align-self:end;">
          <div style="font-size:.34rem;font-weight:600;color:#aaa;letter-spacing:1px;">${serial}</div>
          <div style="font-size:.78rem;font-weight:800;color:${bg};">${valor}</div>
        </div>
      </div>
    </div>
  </div>

</div>`;
}

// ─────────────────────────────────────────────────────────────
//   TicketPreview — React inline
// ─────────────────────────────────────────────────────────────
export function TicketPreview({ r, rifa, numero, comprador, vendedor, design: dProp }) {
  const rifaData = r || rifa || {};
  const d        = { ...DEFAULT_DESIGN, ...(dProp || {}) };

  const nombre  = rifaData?.rifa_nombre || rifaData?.nombre || 'RIFA';
  const premio  = rifaData?.premio      || '—';
  const loteria = rifaData?.loteria_ref || '';
  const valor   = fmtMoney(rifaData?.precio || 0);
  const fecha   = fmtFecha(rifaData?.fecha_sorteo);
  const hora    = extraerHora(rifaData?.fecha_sorteo, d.horaSort);
  const serial  = mkSerial(numero);
  const nom     = comprador?.nombre   || '';
  const tel     = comprador?.telefono || '';
  const ced     = comprador?.cedula   || '';

  const ac  = d.accentColor  || '#0abfbc';
  const ac2 = d.accentColor2 || '#f0a500';
  const bg  = d.bgDark       || '#1a2e2e';

  /* Estilos tipografía — todo Poppins del sistema */
  const TXT = { fontFamily:"'Poppins',sans-serif" };

  const DataCell = ({ label, value }) => !value ? null : (
    <div style={{ padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ ...TXT, fontSize:'.5rem', fontWeight:700, letterSpacing:2, color:'rgba(255,255,255,.35)', textTransform:'uppercase', marginBottom:2 }}>{label}</div>
      <div style={{ ...TXT, fontSize:'.82rem', fontWeight:600, color:'#f0f4f4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
    </div>
  );

  const DataCellLight = ({ label, value }) => !value ? null : (
    <div>
      <div style={{ ...TXT, fontSize:'.48rem', fontWeight:700, letterSpacing:2, color:'#aaa', textTransform:'uppercase', marginBottom:2 }}>{label}</div>
      <div style={{ ...TXT, fontSize:'.75rem', fontWeight:700, color:'#1a2e2e', borderBottom:'1.5px solid #d0ecec', paddingBottom:2, minHeight:18 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ width:'100%', maxWidth:660, margin:'0 auto', ...TXT, borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.18)' }}>

      {/* BOLETO */}
      <div style={{ background:bg, position:'relative', overflow:'hidden' }}>

        {/* Watermark */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-25deg)', ...TXT, fontSize:'5rem', fontWeight:900, color:'rgba(255,255,255,.018)', whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none', letterSpacing:20 }}>
          {d.watermarkText || 'JORDYN'}
        </div>

        {/* Franja top */}
        <div style={{ height:4, background:`linear-gradient(90deg,${ac},${ac2},${ac})` }}></div>

        <div style={{ display:'flex', minHeight:200 }}>

          {/* Columna número */}
          <div style={{ width:190, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 14px', borderRight:'1px dashed rgba(255,255,255,.1)', position:'relative' }}>
            <div style={{ position:'absolute', width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle,${ac}20 0%,transparent 65%)` }}></div>

            <div style={{ ...TXT, fontSize:'.48rem', fontWeight:700, letterSpacing:4, color:`${ac}99`, textTransform:'uppercase', marginBottom:6 }}>Nº de la suerte</div>
            <div style={{ ...TXT, fontWeight:900, fontSize:'4.5rem', color:ac, lineHeight:1, letterSpacing:10, paddingLeft:10, textShadow:`0 0 28px ${ac}55`, position:'relative', zIndex:1 }}>{numero || '000'}</div>
            <div style={{ marginTop:10, ...TXT, fontSize:'.48rem', fontWeight:600, letterSpacing:2, color:'rgba(255,255,255,.3)', textAlign:'center', maxWidth:155, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</div>

            <div style={{ position:'absolute', top:10, right:10, ...TXT, fontSize:'.38rem', fontWeight:700, letterSpacing:2, color:`${ac}cc`, border:`1px solid ${ac}44`, padding:'2px 7px', borderRadius:3 }}>ORIGINAL</div>
          </div>

          {/* Columna datos */}
          <div style={{ flex:1, padding:'16px 20px', display:'flex', flexDirection:'column' }}>

            {/* Marca + serial */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, paddingBottom:10, borderBottom:'1px solid rgba(255,255,255,.07)' }}>
              <div>
                <div style={{ ...TXT, fontSize:'.95rem', fontWeight:800, color:ac, letterSpacing:1 }}>{d.brandText || 'RIFAS JORDYN'}</div>
                {loteria && <div style={{ ...TXT, fontSize:'.45rem', fontWeight:600, color:'rgba(255,255,255,.35)', letterSpacing:1, marginTop:2 }}>🎲 {loteria}</div>}
              </div>
              <div style={{ textAlign:'right', ...TXT, fontSize:'.4rem', color:'rgba(255,255,255,.28)', lineHeight:1.9 }}>
                <div style={{ color:ac2, fontSize:'.48rem', fontWeight:800, letterSpacing:1 }}>{serial}</div>
                <div>{new Date().toLocaleDateString('es-CO', { timeZone:'America/Caracas' })}</div>
              </div>
            </div>

            {/* Premio */}
            <div style={{ marginBottom:12, padding:'8px 12px', background:'rgba(255,255,255,.04)', borderRadius:8, borderLeft:`3px solid ${ac2}` }}>
              <div style={{ ...TXT, fontSize:'.44rem', fontWeight:700, letterSpacing:3, color:`${ac2}88`, textTransform:'uppercase', marginBottom:3 }}>🏆 Primer Premio</div>
              <div style={{ ...TXT, fontSize:'1.1rem', fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{premio}</div>
            </div>

            {/* Grid datos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px', flex:1 }}>
              <DataCell label="Sorteo"    value={fecha + (hora ? ` · ${hora}` : '')} />
              <DataCell label="Valor"     value={valor} />
              <DataCell label="Comprador" value={nom} />
              <DataCell label="C.I."      value={ced} />
              <DataCell label="Teléfono"  value={tel} />
              <DataCell label="Vendedor"  value={vendedor || ''} />
            </div>

            {/* Footer */}
            <div style={{ marginTop:8, paddingTop:6, borderTop:'1px solid rgba(255,255,255,.05)', ...TXT, fontSize:'.38rem', fontWeight:500, color:'rgba(255,255,255,.18)', letterSpacing:1 }}>
              {d.footerText || ''}
            </div>
          </div>
        </div>

        {/* Franja bottom */}
        <div style={{ height:3, background:`linear-gradient(90deg,${ac2},${ac},${ac2})` }}></div>
      </div>

      {/* TALÓN */}
      <div style={{ background:'#f5fffe', border:'1px solid #d0ecec', borderTop:'none' }}>
        <div style={{ display:'flex', alignItems:'center', height:18, padding:'0 14px', borderTop:'2px dashed #b5dede' }}>
          <div style={{ flex:1 }}></div>
          <div style={{ ...TXT, fontSize:'.38rem', fontWeight:600, color:'#aecece', letterSpacing:3, whiteSpace:'nowrap' }}>✂ &nbsp; TALÓN — QUEDA CON EL VENDEDOR &nbsp; ✂</div>
          <div style={{ flex:1 }}></div>
        </div>

        <div style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:14 }}>
          <div style={{ background:bg, borderRadius:10, padding:'8px 14px', textAlign:'center', flexShrink:0, minWidth:80 }}>
            <div style={{ ...TXT, fontSize:'.38rem', fontWeight:700, letterSpacing:3, color:`${ac}88`, marginBottom:2 }}>N°</div>
            <div style={{ ...TXT, fontWeight:900, fontSize:'1.9rem', color:ac, letterSpacing:6 }}>{numero || '000'}</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px 14px', flex:1 }}>
            <DataCellLight label="Nombre"   value={nom} />
            <DataCellLight label="Cédula"   value={ced} />
            <DataCellLight label="Teléfono" value={tel} />
            <DataCellLight label="Sorteo"   value={fecha + (hora ? ` · ${hora}` : '')} />
            <DataCellLight label="Premio"   value={premio} />
            <div style={{ textAlign:'right', alignSelf:'flex-end' }}>
              <div style={{ ...TXT, fontSize:'.34rem', fontWeight:600, color:'#aaa', letterSpacing:1 }}>{serial}</div>
              <div style={{ ...TXT, fontSize:'.78rem', fontWeight:800, color:bg }}>{valor}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//   printTickets
// ─────────────────────────────────────────────────────────────
export function printTickets(rifasArr, numero, comprador, vendedor, design) {
  const d = { ...DEFAULT_DESIGN, ...(design || {}) };

  const STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#1a2e2e;display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px;font-family:'Poppins',sans-serif;}
    @media print{body{background:#fff;padding:4px;gap:8px;}@page{size:landscape;margin:5mm;}}
  `;

  const html = rifasArr.flatMap(r => [1, 2].map(c =>
    buildTicketHTML(d, r, numero, comprador, vendedor, c)
  )).join('\n');

  const win = window.open('', '_blank', 'width=780,height=650');
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
//   generarImagenTicket — exporta el ticket como PNG base64
//   Usa html2canvas si está disponible, sino devuelve null.
//   El llamador (GestionReservas) lo descarga y el admin lo
//   adjunta manualmente en WhatsApp.
// ─────────────────────────────────────────────────────────────
export async function generarImagenTicket({ r, numero, comprador, vendedor, design }) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const d = { ...DEFAULT_DESIGN, ...(design || {}) };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;padding:16px;background:#f0fafa;display:inline-block;';
    document.body.appendChild(wrapper);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(wrapper);
    const { createElement } = await import('react');

    await new Promise(resolve => {
      root.render(createElement(TicketPreview, { r, numero, comprador, vendedor, design: d }));
      setTimeout(resolve, 400);
    });

    const canvas = await html2canvas(wrapper, {
      scale: 2, useCORS: true, backgroundColor: '#f0fafa',
    });

    root.unmount();
    document.body.removeChild(wrapper);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//   Ticket — default export (carga diseño desde BD)
// ─────────────────────────────────────────────────────────────
export default function Ticket({ rifa, numero, comprador, vendedor, onClose }) {
  const rifasArr   = Array.isArray(rifa) ? rifa.filter(r => r.disponible !== false) : rifa ? [rifa] : [];
  const { design } = useTicketDesign();

  const efectivo = rifasArr[0]?.ticket_design
    ? { ...DEFAULT_DESIGN, ...rifasArr[0].ticket_design }
    : design;

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:18, justifyContent:'center', marginBottom:20 }}>
        {rifasArr.map(r => (
          <TicketPreview
            key={r.rifa_id || r.id || Math.random()}
            r={r} numero={numero}
            comprador={comprador} vendedor={vendedor}
            design={efectivo}
          />
        ))}
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn-jordyn"
          onClick={() => printTickets(rifasArr, numero, comprador, vendedor, efectivo)}
          style={{ fontSize:'1rem', padding:'.72rem 2rem' }}>
          <i className="bi bi-printer-fill me-2"></i>
          IMPRIMIR {rifasArr.length > 1 ? 'BOLETOS' : 'BOLETO'} (2 COPIAS)
        </button>
        {onClose && (
          <button className="btn-jordyn-outline" onClick={onClose} style={{ padding:'.72rem 1.5rem' }}>
            <i className="bi bi-x-lg me-1"></i>CERRAR
          </button>
        )}
      </div>
    </div>
  );
}