// ============================================================
//   RIFAS JORDYN — Componente Ticket
//   RF06: Rediseño visual completo — tipografía mejorada,
//         QR/número prominente, layout más legible y profesional
//   ✅ Diseño usando el CSS real del sistema (Poppins, --jordyn-*)
//   ✅ Persistencia en BD via GET /api/ticket-design
//   ✅ parseFecha + extraerHora sin desfase UTC (VET timezone)
// ============================================================
import React, { useState, useEffect } from 'react';
import API from '../services/api';

// ── DEFAULT_DESIGN ────────────────────────────────────────
export const DEFAULT_DESIGN = {
  brandText:    'RIFAS JORDYN',
  footerText:   'Conserve este boleto · Válido solo con número legible',
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
//   buildTicketHTML — RF06: HTML para impresión rediseñado
//   Layout horizontal mejorado, jerarquía tipográfica clara,
//   sección de datos en tabla compacta, talón optimizado.
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

  // Helper: fila de dato con label arriba, valor abajo
  const row = (label, value) => !value ? '' : `
    <div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06);">
      <div style="font-size:.42rem;font-weight:700;letter-spacing:2.5px;color:rgba(255,255,255,.32);
        text-transform:uppercase;margin-bottom:2px;">${label}</div>
      <div style="font-size:.78rem;font-weight:700;color:#eaf4f4;line-height:1.25;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${value}</div>
    </div>`;

  const rowLight = (label, value) => !value ? '' : `
    <div style="padding:4px 0;">
      <div style="font-size:.4rem;font-weight:700;letter-spacing:2px;color:#8ab5b5;
        text-transform:uppercase;margin-bottom:1px;">${label}</div>
      <div style="font-size:.72rem;font-weight:700;color:#1a2e2e;
        border-bottom:1.5px solid #c8e8e8;padding-bottom:2px;min-height:16px;">${value}</div>
    </div>`;

  return `
<div style="width:680px;margin:12px auto;font-family:'Poppins',sans-serif;
  page-break-inside:avoid;border-radius:16px;overflow:hidden;
  box-shadow:0 16px 48px rgba(0,0,0,.30);">

  <!-- ═══ BOLETO PRINCIPAL ═══ -->
  <div style="background:${bg};position:relative;overflow:hidden;">

    <!-- Watermark -->
    <div style="position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%) rotate(-22deg);
      font-size:5.5rem;font-weight:900;color:rgba(255,255,255,.016);
      white-space:nowrap;pointer-events:none;letter-spacing:18px;
      font-family:'Poppins',sans-serif;">
      ${d.watermarkText || 'JORDYN'}
    </div>

    <!-- Franja top decorativa -->
    <div style="height:5px;background:linear-gradient(90deg,${ac},${ac2},${ac});"></div>

    <div style="display:flex;min-height:210px;">

      <!-- ── Columna izquierda: número grande ── -->
      <div style="width:170px;flex-shrink:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:22px 12px;
        border-right:1px dashed rgba(255,255,255,.12);position:relative;background:rgba(0,0,0,.08);">

        <!-- Glow de fondo -->
        <div style="position:absolute;width:130px;height:130px;border-radius:50%;
          background:radial-gradient(circle,${ac}25 0%,transparent 70%);"></div>

        <!-- Etiqueta "N° de la suerte" -->
        <div style="font-size:.42rem;font-weight:800;letter-spacing:4px;
          color:${ac}99;text-transform:uppercase;margin-bottom:8px;text-align:center;">
          Nº de la suerte
        </div>

        <!-- Número -->
        <div style="font-family:'Poppins',sans-serif;font-weight:900;font-size:4.8rem;
          color:${ac};line-height:1;letter-spacing:8px;padding-left:8px;
          text-shadow:0 0 32px ${ac}60;position:relative;z-index:1;text-align:center;">
          ${numero || '000'}
        </div>

        <!-- Nombre de la rifa debajo del número -->
        <div style="margin-top:10px;font-size:.42rem;font-weight:700;letter-spacing:1.5px;
          color:rgba(255,255,255,.28);text-align:center;max-width:148px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;">
          ${nombre}
        </div>

        <!-- Badge ORIGINAL / COPIA -->
        <div style="margin-top:10px;font-size:.38rem;font-weight:800;letter-spacing:2px;
          color:${isOrig ? ac : 'rgba(255,255,255,.22)'};
          border:1.5px solid ${isOrig ? ac+'55' : 'rgba(255,255,255,.12)'};
          padding:3px 9px;border-radius:4px;text-transform:uppercase;">
          ${isOrig ? '✦ ORIGINAL' : 'COPIA'}
        </div>
      </div>

      <!-- ── Columna derecha: info ── -->
      <div style="flex:1;padding:18px 22px;display:flex;flex-direction:column;gap:0;">

        <!-- Cabecera: marca + serial + fecha emisión -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
          margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.08);">
          <div>
            <div style="font-size:1.05rem;font-weight:900;color:${ac};letter-spacing:.5px;
              font-family:'Poppins',sans-serif;">
              ${d.brandText || 'RIFAS JORDYN'}
            </div>
            ${loteria ? `<div style="font-size:.44rem;font-weight:600;color:rgba(255,255,255,.32);
              letter-spacing:1px;margin-top:2px;">🎲 ${loteria}</div>` : ''}
          </div>
          <div style="text-align:right;line-height:1.8;">
            <div style="font-size:.5rem;font-weight:800;color:${ac2};letter-spacing:1px;">
              ${serial}
            </div>
            <div style="font-size:.4rem;color:rgba(255,255,255,.25);">Emitido: ${hoy}</div>
          </div>
        </div>

        <!-- Premio (destacado) -->
        <div style="margin-bottom:14px;padding:10px 14px;
          background:linear-gradient(135deg,rgba(240,165,0,.10),rgba(240,165,0,.04));
          border-radius:10px;border-left:4px solid ${ac2};">
          <div style="font-size:.4rem;font-weight:800;letter-spacing:3px;
            color:${ac2};text-transform:uppercase;margin-bottom:4px;">🏆 Primer Premio</div>
          <div style="font-size:1.05rem;font-weight:900;color:#fff;
            font-family:'Poppins',sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${premio}
          </div>
        </div>

        <!-- Grid 2×3 de datos -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;flex:1;">
          ${row('Fecha sorteo', fecha + (hora ? ' · ' + hora : ''))}
          ${row('Valor boleto', valor)}
          ${row('Comprador',    nom)}
          ${row('Cédula / ID',  ced)}
          ${row('Teléfono',     tel)}
          ${row('Vendedor',     vendedor || '')}
        </div>

        <!-- Footer del boleto -->
        <div style="margin-top:10px;padding-top:7px;border-top:1px solid rgba(255,255,255,.05);
          font-size:.36rem;font-weight:500;color:rgba(255,255,255,.16);letter-spacing:1px;">
          ${d.footerText || ''}
        </div>
      </div>
    </div>

    <!-- Franja bottom -->
    <div style="height:3px;background:linear-gradient(90deg,${ac2},${ac},${ac2});"></div>
  </div>

  <!-- ═══ TALÓN ═══ -->
  <div style="background:#f4fffe;border:1.5px solid #cde8e8;border-top:none;">

    <!-- Línea de corte -->
    <div style="display:flex;align-items:center;padding:0 16px;height:20px;
      border-top:2px dashed #b0d8d8;">
      <div style="flex:1;"></div>
      <div style="font-size:.38rem;font-weight:700;color:#a0c8c8;letter-spacing:3px;
        white-space:nowrap;font-family:'Poppins',sans-serif;">
        ✂ &nbsp; TALÓN — QUEDA CON EL VENDEDOR &nbsp; ✂
      </div>
      <div style="flex:1;"></div>
    </div>

    <!-- Contenido talón -->
    <div style="display:flex;align-items:center;padding:10px 16px;gap:16px;">

      <!-- Mini número en el talón -->
      <div style="background:${bg};border-radius:12px;padding:8px 16px;
        text-align:center;flex-shrink:0;min-width:84px;">
        <div style="font-size:.36rem;font-weight:800;letter-spacing:3px;
          color:${ac}77;margin-bottom:2px;text-transform:uppercase;">N°</div>
        <div style="font-family:'Poppins',sans-serif;font-weight:900;font-size:2rem;
          color:${ac};letter-spacing:5px;line-height:1;">${numero || '000'}</div>
      </div>

      <!-- Datos talón en grid 3 columnas -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 14px;flex:1;">
        ${rowLight('Nombre',   nom)}
        ${rowLight('Cédula',   ced)}
        ${rowLight('Teléfono', tel)}
        ${rowLight('Sorteo',   fecha + (hora ? ' · ' + hora : ''))}
        ${rowLight('Premio',   premio)}
        <div style="text-align:right;align-self:flex-end;padding-top:4px;">
          <div style="font-size:.34rem;font-weight:600;color:#90b8b8;letter-spacing:1px;
            margin-bottom:2px;">${serial}</div>
          <div style="font-size:.82rem;font-weight:900;color:${bg};
            font-family:'Poppins',sans-serif;">${valor}</div>
        </div>
      </div>
    </div>
  </div>

</div>`;
}

// ─────────────────────────────────────────────────────────────
//   TicketPreview — RF06: React inline rediseñado
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
  const TXT = { fontFamily:"'Poppins',sans-serif" };

  const DataCell = ({ label, value }) => !value ? null : (
    <div style={{ padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
      <div style={{ ...TXT, fontSize:'.42rem', fontWeight:700, letterSpacing:2.5,
        color:'rgba(255,255,255,.32)', textTransform:'uppercase', marginBottom:2 }}>
        {label}
      </div>
      <div style={{ ...TXT, fontSize:'.78rem', fontWeight:700, color:'#eaf4f4',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {value}
      </div>
    </div>
  );

  const DataCellLight = ({ label, value }) => !value ? null : (
    <div style={{ paddingTop:4 }}>
      <div style={{ ...TXT, fontSize:'.4rem', fontWeight:700, letterSpacing:2,
        color:'#8ab5b5', textTransform:'uppercase', marginBottom:1 }}>
        {label}
      </div>
      <div style={{ ...TXT, fontSize:'.72rem', fontWeight:700, color:'#1a2e2e',
        borderBottom:'1.5px solid #c8e8e8', paddingBottom:2, minHeight:16 }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{ width:'100%', maxWidth:680, margin:'0 auto', ...TXT,
      borderRadius:16, overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,.22)' }}>

      {/* ── BOLETO ── */}
      <div style={{ background:bg, position:'relative', overflow:'hidden' }}>

        {/* Watermark */}
        <div style={{ position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%) rotate(-22deg)',
          ...TXT, fontSize:'5.5rem', fontWeight:900,
          color:'rgba(255,255,255,.016)', whiteSpace:'nowrap',
          pointerEvents:'none', userSelect:'none', letterSpacing:18 }}>
          {d.watermarkText || 'JORDYN'}
        </div>

        {/* Franja top */}
        <div style={{ height:5, background:`linear-gradient(90deg,${ac},${ac2},${ac})` }}></div>

        <div style={{ display:'flex', minHeight:210 }}>

          {/* Columna número */}
          <div style={{ width:170, flexShrink:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', padding:'22px 12px',
            borderRight:'1px dashed rgba(255,255,255,.12)',
            position:'relative', background:'rgba(0,0,0,.08)' }}>

            <div style={{ position:'absolute', width:130, height:130, borderRadius:'50%',
              background:`radial-gradient(circle,${ac}25 0%,transparent 70%)` }}></div>

            <div style={{ ...TXT, fontSize:'.42rem', fontWeight:800, letterSpacing:4,
              color:`${ac}99`, textTransform:'uppercase', marginBottom:8, textAlign:'center' }}>
              Nº de la suerte
            </div>

            <div style={{ ...TXT, fontWeight:900, fontSize:'4.8rem', color:ac,
              lineHeight:1, letterSpacing:8, paddingLeft:8,
              textShadow:`0 0 32px ${ac}60`, position:'relative', zIndex:1, textAlign:'center' }}>
              {numero || '000'}
            </div>

            <div style={{ marginTop:10, ...TXT, fontSize:'.42rem', fontWeight:700,
              letterSpacing:1.5, color:'rgba(255,255,255,.28)', textAlign:'center',
              maxWidth:148, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              textTransform:'uppercase' }}>
              {nombre}
            </div>

            <div style={{ marginTop:10, ...TXT, fontSize:'.38rem', fontWeight:800,
              letterSpacing:2, color:`${ac}cc`,
              border:`1.5px solid ${ac}55`, padding:'3px 9px', borderRadius:4 }}>
              ✦ ORIGINAL
            </div>
          </div>

          {/* Columna info */}
          <div style={{ flex:1, padding:'18px 22px', display:'flex', flexDirection:'column', gap:0 }}>

            {/* Cabecera marca + serial */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
              marginBottom:14, paddingBottom:10, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
              <div>
                <div style={{ ...TXT, fontSize:'1.05rem', fontWeight:900, color:ac, letterSpacing:.5 }}>
                  {d.brandText || 'RIFAS JORDYN'}
                </div>
                {loteria && (
                  <div style={{ ...TXT, fontSize:'.44rem', fontWeight:600,
                    color:'rgba(255,255,255,.32)', letterSpacing:1, marginTop:2 }}>
                    🎲 {loteria}
                  </div>
                )}
              </div>
              <div style={{ textAlign:'right', lineHeight:1.8 }}>
                <div style={{ ...TXT, fontSize:'.5rem', fontWeight:800, color:ac2, letterSpacing:1 }}>
                  {serial}
                </div>
                <div style={{ ...TXT, fontSize:'.4rem', color:'rgba(255,255,255,.25)' }}>
                  Emitido: {new Date().toLocaleDateString('es-CO', { timeZone:'America/Caracas' })}
                </div>
              </div>
            </div>

            {/* Premio destacado */}
            <div style={{ marginBottom:14, padding:'10px 14px',
              background:`linear-gradient(135deg,rgba(240,165,0,.10),rgba(240,165,0,.04))`,
              borderRadius:10, borderLeft:`4px solid ${ac2}` }}>
              <div style={{ ...TXT, fontSize:'.4rem', fontWeight:800, letterSpacing:3,
                color:ac2, textTransform:'uppercase', marginBottom:4 }}>
                🏆 Primer Premio
              </div>
              <div style={{ ...TXT, fontSize:'1.05rem', fontWeight:900, color:'#fff',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {premio}
              </div>
            </div>

            {/* Grid de datos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 18px', flex:1 }}>
              <DataCell label="Fecha sorteo" value={fecha + (hora ? ` · ${hora}` : '')} />
              <DataCell label="Valor boleto" value={valor} />
              <DataCell label="Comprador"    value={nom} />
              <DataCell label="Cédula / ID"  value={ced} />
              <DataCell label="Teléfono"     value={tel} />
              <DataCell label="Vendedor"     value={vendedor || ''} />
            </div>

            {/* Footer */}
            <div style={{ marginTop:10, paddingTop:7, borderTop:'1px solid rgba(255,255,255,.05)',
              ...TXT, fontSize:'.36rem', fontWeight:500,
              color:'rgba(255,255,255,.16)', letterSpacing:1 }}>
              {d.footerText || ''}
            </div>
          </div>
        </div>

        {/* Franja bottom */}
        <div style={{ height:3, background:`linear-gradient(90deg,${ac2},${ac},${ac2})` }}></div>
      </div>

      {/* ── TALÓN ── */}
      <div style={{ background:'#f4fffe', border:'1.5px solid #cde8e8', borderTop:'none' }}>

        {/* Línea de corte */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 16px', height:20,
          borderTop:'2px dashed #b0d8d8' }}>
          <div style={{ flex:1 }}></div>
          <div style={{ ...TXT, fontSize:'.38rem', fontWeight:700, color:'#a0c8c8',
            letterSpacing:3, whiteSpace:'nowrap' }}>
            ✂ &nbsp; TALÓN — QUEDA CON EL VENDEDOR &nbsp; ✂
          </div>
          <div style={{ flex:1 }}></div>
        </div>

        {/* Contenido talón */}
        <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', gap:16 }}>

          {/* Mini número */}
          <div style={{ background:bg, borderRadius:12, padding:'8px 16px',
            textAlign:'center', flexShrink:0, minWidth:84 }}>
            <div style={{ ...TXT, fontSize:'.36rem', fontWeight:800, letterSpacing:3,
              color:`${ac}77`, marginBottom:2, textTransform:'uppercase' }}>N°</div>
            <div style={{ ...TXT, fontWeight:900, fontSize:'2rem',
              color:ac, letterSpacing:5, lineHeight:1 }}>
              {numero || '000'}
            </div>
          </div>

          {/* Datos talón */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px 14px', flex:1 }}>
            <DataCellLight label="Nombre"   value={nom} />
            <DataCellLight label="Cédula"   value={ced} />
            <DataCellLight label="Teléfono" value={tel} />
            <DataCellLight label="Sorteo"   value={fecha + (hora ? ` · ${hora}` : '')} />
            <DataCellLight label="Premio"   value={premio} />
            <div style={{ textAlign:'right', alignSelf:'flex-end', paddingTop:4 }}>
              <div style={{ ...TXT, fontSize:'.34rem', fontWeight:600,
                color:'#90b8b8', letterSpacing:1, marginBottom:2 }}>
                {serial}
              </div>
              <div style={{ ...TXT, fontSize:'.82rem', fontWeight:900, color:bg }}>
                {valor}
              </div>
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
    body{background:#e8f5f5;display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px;font-family:'Poppins',sans-serif;}
    @media print{body{background:#fff;padding:4px;gap:10px;}@page{size:landscape;margin:4mm;}}
  `;

  const html = rifasArr.flatMap(r => [1, 2].map(c =>
    buildTicketHTML(d, r, numero, comprador, vendedor, c)
  )).join('\n');

  const win = window.open('', '_blank', 'width=800,height=680');
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
//   generarImagenTicket
// ─────────────────────────────────────────────────────────────
export async function generarImagenTicket({ r, numero, comprador, vendedor, design }) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const d = { ...DEFAULT_DESIGN, ...(design || {}) };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;padding:20px;background:#e8f5f5;display:inline-block;';
    document.body.appendChild(wrapper);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(wrapper);
    const { createElement } = await import('react');

    await new Promise(resolve => {
      root.render(createElement(TicketPreview, { r, numero, comprador, vendedor, design: d }));
      setTimeout(resolve, 450);
    });

    const canvas = await html2canvas(wrapper, {
      scale: 2, useCORS: true, backgroundColor: '#e8f5f5',
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