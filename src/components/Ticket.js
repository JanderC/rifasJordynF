// ============================================================
//   components/Ticket.jsx  — RIFAS JORDYN
//   ✅ Diseño responsivo, sin overflow, fuentes relativas
//   ✅ Genera imagen PNG para adjuntar en WhatsApp
//   ✅ printTickets imprime 2 copias por página
// ============================================================
import React, { useRef } from 'react';
import { fmtFecha } from '../utils/dates';

/* ── helper COP ── */
const fmtCOP = v =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v || 0);

/* ════════════════════════════════════════════════════════════
   TicketPreview
   Props:
     r         → objeto rifa  { rifa_nombre, premio, precio, fecha_sorteo, loteria_ref }
     numero    → string '000'–'999'
     comprador → { nombre, telefono }
     vendedor  → string nombre del vendedor
     size      → 'normal' | 'small'  (default 'normal')
════════════════════════════════════════════════════════════ */
export function TicketPreview({ r, numero, comprador, vendedor, size = 'normal' }) {
  const s = size === 'small';

  const W   = s ? 260  : 320;
  const PAD = s ? 14   : 20;
  const F0  = s ? 8    : 10;   // tiny label
  const F1  = s ? 11   : 14;   // body
  const F2  = s ? 28   : 38;   // número grande
  const F3  = s ? 13   : 16;   // subtítulo

  const rNombre = r?.rifa_nombre || r?.nombre || '—';
  const fecha   = fmtFecha(r?.fecha_sorteo);

  return (
    <div style={{
      width:        W,
      fontFamily:   "'Poppins', 'Segoe UI', sans-serif",
      background:   '#fff',
      borderRadius: 16,
      overflow:     'hidden',
      boxShadow:    '0 8px 32px rgba(10,100,100,.18)',
      flexShrink:   0,
    }}>
      {/* Cabecera degradado */}
      <div style={{
        background:   'linear-gradient(135deg, #0abfbc, #00d4d0)',
        padding:      `${PAD}px ${PAD}px ${PAD * 0.8}px`,
        textAlign:    'center',
        position:     'relative',
        overflow:     'hidden',
      }}>
        {/* círculos decorativos */}
        <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.1)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-30, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.07)', pointerEvents:'none' }}/>

        <div style={{ fontSize: F0, color:'rgba(255,255,255,.8)', letterSpacing:'3px', textTransform:'uppercase', marginBottom:4 }}>RIFAS JORDYN</div>
        <div style={{ fontSize: F3, color:'#fff', fontWeight:700, marginBottom: PAD * 0.4, lineHeight:1.2,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {rNombre}
        </div>
        {/* Número en círculo */}
        <div style={{
          width:  F2 * 2.2, height: F2 * 2.2,
          borderRadius:'50%',
          background:   'rgba(255,255,255,.22)',
          border:       '3px solid rgba(255,255,255,.5)',
          display:      'flex', flexDirection:'column',
          alignItems:   'center', justifyContent:'center',
          margin:       '0 auto',
          boxShadow:    '0 4px 16px rgba(0,0,0,.15)',
        }}>
          <div style={{ fontSize: F0, color:'rgba(255,255,255,.8)', letterSpacing:'2px' }}>Nº</div>
          <div style={{ fontSize: F2, color:'#fff', fontWeight:900, lineHeight:1, letterSpacing: s?4:6 }}>{numero || '---'}</div>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ padding: `${PAD * 0.9}px ${PAD}px ${PAD}px` }}>

        {/* Premio */}
        <div style={{
          background:   'linear-gradient(135deg,rgba(10,191,188,.07),rgba(10,191,188,.03))',
          border:       '1px solid rgba(10,191,188,.2)',
          borderRadius: 10, padding:`${PAD * 0.5}px ${PAD * 0.6}px`,
          marginBottom: PAD * 0.6, textAlign:'center',
        }}>
          <div style={{ fontSize: F0, color:'#7a9a9a', letterSpacing:'2px', textTransform:'uppercase', marginBottom:2 }}>PREMIO</div>
          <div style={{ fontSize: F1, fontWeight:700, color:'#1a2e2e',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            maxWidth:'100%' }}>
            🏆 {r?.premio || '—'}
          </div>
        </div>

        {/* Datos grilla */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: PAD * 0.4, marginBottom: PAD * 0.6 }}>
          {[
            { l:'Comprador',  v: comprador?.nombre   || '—' },
            { l:'Teléfono',   v: comprador?.telefono || '—' },
            { l:'Valor',      v: fmtCOP(r?.precio),           accent:true },
            { l:'Sorteo',     v: fecha },
          ].map(({ l, v, accent }) => (
            <div key={l} style={{
              background:   'var(--jordyn-bg2, #f8fdfd)',
              borderRadius: 8,
              padding:      `${PAD * 0.4}px ${PAD * 0.5}px`,
              border:       '1px solid rgba(10,191,188,.12)',
              overflow:     'hidden',
            }}>
              <div style={{ fontSize: F0, color:'#7a9a9a', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:2 }}>{l}</div>
              <div style={{ fontSize: F1 - 1, fontWeight:600, color: accent ? '#059669' : '#1a2e2e',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {v}
              </div>
            </div>
          ))}
        </div>

        {/* Lotería */}
        {r?.loteria_ref && (
          <div style={{ textAlign:'center', fontSize: F0, color:'#7a9a9a', marginBottom: PAD * 0.5 }}>
            🎲 {r.loteria_ref}
          </div>
        )}

        {/* Separador dashed */}
        <div style={{ borderTop:`2px dashed rgba(10,191,188,.25)`, margin:`${PAD * 0.5}px 0` }}/>

        {/* Vendedor + marca agua */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {vendedor && (
            <div style={{ fontSize: F0, color:'#7a9a9a' }}>
              <i style={{ marginRight:3 }}>👤</i>{vendedor}
            </div>
          )}
          <div style={{ fontSize: F0, color:'rgba(10,191,188,.5)', fontWeight:700, letterSpacing:'1.5px', marginLeft:'auto' }}>
            rifasjordyn.com
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TicketConImagen
   Renderiza el ticket dentro de un canvas y exporta como
   data URL (PNG) para adjuntar en WhatsApp o descargar.
   
   Uso:
     const dataUrl = await generarImagenTicket({ r, numero, comprador, vendedor });
════════════════════════════════════════════════════════════ */
export async function generarImagenTicket({ r, numero, comprador, vendedor }) {
  // Usar html2canvas si está disponible, sino fallback a texto
  try {
    const { default: html2canvas } = await import('html2canvas');

    // Crear contenedor temporal fuera de pantalla
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
    document.body.appendChild(wrapper);

    // Renderizar el TicketPreview en el wrapper via React
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(wrapper);

    await new Promise(resolve => {
      root.render(
        React.createElement('div', { style:{ padding:16, background:'#f0fafa', display:'inline-block' } },
          React.createElement(TicketPreview, { r, numero, comprador, vendedor })
        )
      );
      setTimeout(resolve, 300); // esperar render
    });

    const canvas = await html2canvas(wrapper.firstChild, {
      scale:       2,
      useCORS:     true,
      backgroundColor: '#f0fafa',
    });

    root.unmount();
    document.body.removeChild(wrapper);

    return canvas.toDataURL('image/png');
  } catch {
    // Fallback: devolver null, el llamador manejará solo el texto
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   printTickets  — imprime 2 copias por página en hoja A4
════════════════════════════════════════════════════════════ */
export function printTickets(rifas, numero, comprador, vendedor) {
  const fecha = fmtFecha(rifas[0]?.fecha_sorteo);

  const ticketHTML = (r) => `
    <div class="ticket">
      <div class="ticket-header">
        <div class="ticket-brand">RIFAS JORDYN</div>
        <div class="ticket-rifa">${r?.rifa_nombre || r?.nombre || ''}</div>
        <div class="ticket-numero-wrap">
          <div class="ticket-numero-label">Nº</div>
          <div class="ticket-numero">${numero || '---'}</div>
        </div>
      </div>
      <div class="ticket-body">
        <div class="ticket-premio">
          <div class="lbl">PREMIO</div>
          <div class="val">🏆 ${r?.premio || '—'}</div>
        </div>
        <div class="ticket-grid">
          <div class="cell"><div class="lbl">COMPRADOR</div><div class="val">${comprador?.nombre || '—'}</div></div>
          <div class="cell"><div class="lbl">TELÉFONO</div><div class="val">${comprador?.telefono || '—'}</div></div>
          <div class="cell"><div class="lbl">VALOR</div><div class="val green">${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(r?.precio||0)}</div></div>
          <div class="cell"><div class="lbl">SORTEO</div><div class="val">${fecha}</div></div>
        </div>
        ${r?.loteria_ref ? `<div class="ticket-loteria">🎲 ${r.loteria_ref}</div>` : ''}
        <div class="ticket-sep"></div>
        <div class="ticket-footer">
          ${vendedor ? `<span>👤 ${vendedor}</span>` : ''}
          <span class="brand-mark">rifasjordyn.com</span>
        </div>
      </div>
    </div>
  `;

  const allTickets = (rifas.length > 0 ? rifas : [rifas[0]])
    .map(r => `
      <div class="copy-pair">
        ${ticketHTML(r)}
        <div class="divider">✂ ─────────────── ✂</div>
        ${ticketHTML(r)}
      </div>
    `).join('');

  const win = window.open('', '_blank', 'width=800,height=700');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Boleto Rifas Jordyn</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#fff; font-family:'Poppins',sans-serif; }
        @page { size:A4; margin:15mm; }
        @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }

        .copy-pair { page-break-inside:avoid; margin-bottom:24px; }
        .divider { text-align:center; color:#ccc; font-size:11px; letter-spacing:2px; margin:12px 0; }

        .ticket {
          width:320px; margin:0 auto;
          border-radius:14px; overflow:hidden;
          box-shadow:0 4px 20px rgba(10,100,100,.15);
          font-family:'Poppins',sans-serif;
        }
        .ticket-header {
          background:linear-gradient(135deg,#0abfbc,#00d4d0);
          padding:20px; text-align:center;
        }
        .ticket-brand { font-size:9px; color:rgba(255,255,255,.8); letter-spacing:3px; text-transform:uppercase; margin-bottom:4px; }
        .ticket-rifa  { font-size:14px; color:#fff; font-weight:700; margin-bottom:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ticket-numero-wrap {
          width:84px; height:84px; border-radius:50%;
          background:rgba(255,255,255,.22); border:3px solid rgba(255,255,255,.5);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          margin:0 auto;
        }
        .ticket-numero-label { font-size:8px; color:rgba(255,255,255,.8); letter-spacing:2px; }
        .ticket-numero { font-size:36px; color:#fff; font-weight:900; line-height:1; letter-spacing:6px; }

        .ticket-body { background:#fff; padding:16px 20px 18px; }
        .ticket-premio {
          background:rgba(10,191,188,.07); border:1px solid rgba(10,191,188,.2);
          border-radius:10px; padding:8px 12px; text-align:center; margin-bottom:10px;
        }
        .ticket-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; }
        .cell { background:#f8fdfd; border-radius:8px; padding:7px 10px; border:1px solid rgba(10,191,188,.12); overflow:hidden; }
        .lbl  { font-size:7px; color:#7a9a9a; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px; }
        .val  { font-size:11px; font-weight:600; color:#1a2e2e; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .val.green { color:#059669; }
        .ticket-loteria { text-align:center; font-size:9px; color:#7a9a9a; margin-bottom:8px; }
        .ticket-sep { border-top:2px dashed rgba(10,191,188,.25); margin:8px 0; }
        .ticket-footer { display:flex; justify-content:space-between; align-items:center; }
        .ticket-footer span { font-size:8px; color:#7a9a9a; }
        .brand-mark { color:rgba(10,191,188,.5) !important; font-weight:700; letter-spacing:1.5px; margin-left:auto; }
      </style>
    </head>
    <body onload="window.print()">
      ${allTickets}
    </body>
    </html>
  `);
  win.document.close();
}