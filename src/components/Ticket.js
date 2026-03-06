import React from 'react';

/* ═══════════════════════════════════════════════════════
   RIFAS JORDYN — Sistema de Boleto con Talón Desprendible

   Estructura de cada impresión:
   ┌────────────────────────────────────┐
   │         PARTE CLIENTE              │  número grande, premio, sorteo, info
   ├╌╌╌╌╌ ✂ TALÓN VENDEDOR ✂ ╌╌╌╌╌╌╌╌╌┤  línea de corte
   │         TALÓN VENDEDOR             │  número + datos cliente
   └────────────────────────────────────┘
═══════════════════════════════════════════════════════ */

export const TICKET_DESIGN_KEY = 'rifas_jordyn_ticket_design';

export const DEFAULT_DESIGN = {
  headerBg:        '#0a0a0a',
  headerBg2:       '#1c1800',
  accentColor:     '#f5c518',
  brandText:       'RIFAS JORDYN',
  brandEmoji:      '🎰',
  showSubrifa:     true,
  heroBg:          '#080808',
  heroBg2:         '#121000',
  numColor:        '#f5c518',
  numSize:         '5rem',
  numGlow:         true,
  heroLines:       true,
  premioImagen:    '',
  premioImagenPos: 'hero',
  premioImagenFit: 'cover',
  showPremioBox:   true,
  premioBoxBg:     '#fffbe6',
  showPerf:        true,
  footerText:      'Conserve este boleto · Válido con número legible',
  watermark:       true,
  watermarkText:   'JORDYN',
  horaSort:        '10:00 PM',
};

export function getTicketDesign() {
  try {
    const s = localStorage.getItem(TICKET_DESIGN_KEY);
    if (s) return { ...DEFAULT_DESIGN, ...JSON.parse(s) };
  } catch {}
  return { ...DEFAULT_DESIGN };
}

const fmtMoney = p => p
  ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(p)
  : '$0';

const fmtFecha = f => f
  ? new Date(f).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })
  : 'Por definir';

/* ═══════════════════════════════════════════════════════
   buildTicketHTMLCustom — HTML completo boleto + talón
═══════════════════════════════════════════════════════ */
export function buildTicketHTMLCustom(d, r, numero, comprador, vendedor, copia) {
  const nombre    = r.rifa_nombre || r.nombre || '';
  const premio    = r.premio || '—';
  const loteria   = r.loteria_ref || '';
  const valor     = fmtMoney(r.precio);
  const fechaSort = fmtFecha(r.fecha_sorteo);
  const hora      = d.horaSort || '10:00 PM';
  const serial    = `JDY-${numero}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const hoy       = new Date().toLocaleDateString('es-CO');
  const ac        = d.accentColor || '#f5c518';
  const brand     = `${d.brandEmoji || '🎰'} ${d.brandText || 'RIFAS JORDYN'}`;
  const compNombre = comprador?.nombre || '';
  const compTel    = comprador?.telefono || '';

  const numGlowCSS = d.numGlow ? `text-shadow:0 0 40px ${ac}99,0 0 15px ${ac}55;` : '';

  /* ── Zona número hero ── */
  const heroZona = d.premioImagen && d.premioImagenPos === 'hero'
    ? `<div style="position:relative;width:100%;height:130px;overflow:hidden;">
        <img src="${d.premioImagen}" style="width:100%;height:100%;object-fit:${d.premioImagenFit};display:block;">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.1) 55%,transparent 100%);"></div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10px;">
          <div style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.6);letter-spacing:5px;margin-bottom:3px;">NÚMERO DE LA SUERTE</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:${d.numSize};color:${ac};letter-spacing:18px;padding-left:18px;line-height:1;${numGlowCSS}">${numero}</div>
          <div style="font-family:'Oswald',sans-serif;font-size:.62rem;color:rgba(255,255,255,.5);letter-spacing:3px;margin-top:4px;">${nombre}</div>
        </div>
      </div>`
    : `<div style="background:linear-gradient(160deg,${d.heroBg},${d.heroBg2} 55%,${d.heroBg});padding:18px 14px 15px;text-align:center;position:relative;overflow:hidden;">
        ${d.heroLines ? `<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent,transparent 28px,rgba(245,197,24,.018) 28px,rgba(245,197,24,.018) 29px);pointer-events:none;"></div>` : ''}
        <div style="font-family:'Share Tech Mono',monospace;font-size:.52rem;color:#4a4a4a;letter-spacing:5px;margin-bottom:4px;position:relative;">NÚMERO DE LA SUERTE</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:${d.numSize};color:${ac};letter-spacing:18px;line-height:.9;padding-left:18px;position:relative;${numGlowCSS}">${numero}</div>
        <div style="font-family:'Oswald',sans-serif;font-weight:300;font-size:.64rem;color:#4a4a4a;letter-spacing:4px;margin-top:7px;position:relative;">${nombre}</div>
      </div>`;

  /* ── imagen zona info ── */
  const imgInfo = d.premioImagen && d.premioImagenPos === 'info'
    ? `<div style="width:100%;height:100px;overflow:hidden;border-radius:6px;margin-bottom:10px;"><img src="${d.premioImagen}" style="width:100%;height:100%;object-fit:${d.premioImagenFit};display:block;"></div>` : '';

  /* ── watermark ── */
  const wm = d.watermark
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:'Bebas Neue',cursive;font-size:3.5rem;color:rgba(0,0,0,.022);letter-spacing:12px;white-space:nowrap;pointer-events:none;user-select:none;">${d.watermarkText} ${d.watermarkText}</div>` : '';

  /* ── perforación ── */
  const perf = d.showPerf
    ? `<div style="display:flex;align-items:center;background:#fff;overflow:visible;">
        <div style="width:15px;height:15px;background:#0d0d0d;border-radius:50%;margin-left:-7px;flex-shrink:0;"></div>
        <div style="flex:1;border-top:2px dashed #c8c8c8;margin:0 4px;"></div>
        <div style="width:15px;height:15px;background:#0d0d0d;border-radius:50%;margin-right:-7px;flex-shrink:0;"></div>
      </div>` : '';

  const telRow = compTel
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px dotted #e0e0e0;">
        <span style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:#b0b0b0;">Teléfono</span>
        <span style="font-family:'Oswald',sans-serif;font-size:.82rem;color:#111;font-weight:600;">${compTel}</span>
      </div>` : '';

  const lotRow = loteria
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px dotted #e0e0e0;">
        <span style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:#b0b0b0;">Lotería</span>
        <span style="font-family:'Oswald',sans-serif;font-size:.82rem;color:#111;font-weight:600;">${loteria}</span>
      </div>` : '';

  return `
<div style="width:380px;background:#fff;border-radius:9px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:'Oswald',sans-serif;page-break-inside:avoid;">
  ${wm}

  <!-- ▸ ETIQUETA COPIA -->
  <div style="position:absolute;top:11px;right:13px;font-family:'Share Tech Mono',monospace;font-size:.45rem;color:rgba(255,255,255,.45);border:1px solid rgba(255,255,255,.18);padding:2px 6px;border-radius:2px;letter-spacing:3px;z-index:5;">${copia === 1 ? 'ORIGINAL' : 'COPIA'}</div>

  <!-- ▸ HEADER -->
  <div style="background:linear-gradient(135deg,${d.headerBg} 0%,${d.headerBg2} 50%,${d.headerBg} 100%);padding:11px 15px 9px;border-bottom:3px solid ${ac};display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-family:'Bebas Neue',cursive;font-size:1.5rem;color:${ac};letter-spacing:4px;line-height:1;">${brand}</div>
      ${d.showSubrifa && nombre ? `<div style="font-family:'Share Tech Mono',monospace;font-size:.48rem;color:#888;letter-spacing:3px;margin-top:3px;">${nombre}</div>` : ''}
      ${loteria ? `<div style="font-family:'Share Tech Mono',monospace;font-size:.46rem;color:#666;letter-spacing:2px;margin-top:2px;">🎲 ${loteria}</div>` : ''}
    </div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:.46rem;color:#666;text-align:right;line-height:2;">
      <div>${serial}</div><div>${hoy}</div>
      <div style="color:${ac};font-size:.44rem;margin-top:1px;">★ BOLETO OFICIAL</div>
    </div>
  </div>

  <!-- ▸ ZONA NÚMERO HERO -->
  ${heroZona}

  <!-- ▸ PERFORACIÓN INTERNA (cliente/info) -->
  ${perf}

  <!-- ▸ CUERPO CLIENTE -->
  <div style="padding:12px 15px 10px;background:#fff;">
    ${imgInfo}

    <!-- PREMIO = protagonista -->
    <div style="background:linear-gradient(135deg,#0a0a0a 0%,#1c1800 50%,#0a0a0a 100%);border-radius:8px;padding:12px 15px;margin-bottom:12px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(245,197,24,.03) 10px,rgba(245,197,24,.03) 11px);pointer-events:none;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;position:relative;">
        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.46rem;color:#888;letter-spacing:4px;margin-bottom:4px;">🏆 PRIMER PREMIO</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.8rem;color:${ac};letter-spacing:3px;line-height:1;text-shadow:0 0 25px ${ac}66;">${premio}</div>
        </div>
        <div style="text-align:right;border-left:1px solid rgba(255,255,255,.08);padding-left:12px;">
          <div style="font-family:'Share Tech Mono',monospace;font-size:.44rem;color:#888;letter-spacing:2px;margin-bottom:3px;">VALOR</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.25rem;color:#06d6a0;letter-spacing:2px;">${valor}</div>
        </div>
      </div>
    </div>

    <!-- SORTEO — destaca la fecha como variable -->
    <div style="display:flex;gap:8px;margin-bottom:11px;">
      <!-- Fecha -->
      <div style="flex:1;background:#f4f4f4;border:1.5px solid #e0e0e0;border-radius:6px;padding:7px 10px;position:relative;">
        <div style="position:absolute;top:-7px;left:9px;background:#fff;padding:0 5px;font-family:'Share Tech Mono',monospace;font-size:.42rem;color:#aaa;letter-spacing:2px;">FECHA SORTEO</div>
        <div style="font-family:'Oswald',sans-serif;font-size:1rem;font-weight:700;color:#111;margin-top:2px;">${fechaSort}</div>
      </div>
      <!-- Hora fija -->
      <div style="background:linear-gradient(135deg,#0a0a0a,#1c1800);border-radius:6px;padding:7px 14px;text-align:center;flex-shrink:0;">
        <div style="font-family:'Share Tech Mono',monospace;font-size:.42rem;color:#888;letter-spacing:2px;margin-bottom:3px;">HORA</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:1.2rem;color:${ac};letter-spacing:3px;">${hora}</div>
      </div>
    </div>

    <!-- DATOS -->
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px dotted #e0e0e0;">
      <span style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:#b0b0b0;">Comprador</span>
      <span style="font-family:'Oswald',sans-serif;font-size:.85rem;color:#111;font-weight:600;">${compNombre || '_______________'}</span>
    </div>
    ${telRow}
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px dotted #e0e0e0;">
      <span style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:#b0b0b0;">Vendedor</span>
      <span style="font-family:'Oswald',sans-serif;font-size:.85rem;color:#111;font-weight:600;">${vendedor || '_______________'}</span>
    </div>
    ${lotRow}
  </div>

  <!-- ▸ FOOTER CLIENTE -->
  <div style="background:#f6f6f6;border-top:1px solid #e8e8e8;padding:6px 15px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-family:'Bebas Neue',cursive;font-size:.7rem;color:#ccc;letter-spacing:3px;">${d.brandText}</div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:.42rem;color:#ccc;text-align:right;line-height:1.75;">
      ${(d.footerText || 'Conserve este boleto · Válido con número legible').split('·').map(t => `<div>${t.trim()}</div>`).join('')}
    </div>
  </div>

  <!-- ▸▸▸ SEPARADOR DE CORTE ◂◂◂ -->
  <div style="background:#fff;padding:5px 0;border-top:2px dashed #b0b0b0;border-bottom:2px dashed #b0b0b0;margin:0;">
    <div style="display:flex;align-items:center;padding:0 12px;gap:8px;">
      <div style="flex:1;border-top:1px dashed #ddd;"></div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:.44rem;color:#c0c0c0;letter-spacing:3px;white-space:nowrap;">✂  TALÓN · QUEDA CON EL VENDEDOR  ✂</div>
      <div style="flex:1;border-top:1px dashed #ddd;"></div>
    </div>
  </div>

  <!-- ▸▸▸ TALÓN VENDEDOR ◂◂◂ -->
  <div style="background:linear-gradient(180deg,#f7f7f7,#eeeeee);padding:11px 15px 14px;">
    <div style="display:flex;align-items:stretch;gap:13px;">

      <!-- Número prominente en el talón -->
      <div style="background:linear-gradient(135deg,${d.headerBg},${d.headerBg2});border-radius:8px;padding:10px 13px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border:2px solid ${ac}44;min-width:72px;">
        <div style="font-family:'Share Tech Mono',monospace;font-size:.4rem;color:#888;letter-spacing:4px;margin-bottom:3px;">N°</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:2.2rem;color:${ac};letter-spacing:8px;line-height:1;padding-left:8px;${d.numGlow ? `text-shadow:0 0 20px ${ac}88;` : ''}">${numero}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.36rem;color:#777;letter-spacing:1px;margin-top:3px;text-align:center;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>
      </div>

      <!-- Datos del talón -->
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:5px;">
        <div style="font-family:'Bebas Neue',cursive;font-size:.78rem;color:#888;letter-spacing:3px;">${brand}</div>

        <!-- Nombre cliente -->
        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.42rem;color:#bbb;letter-spacing:3px;margin-bottom:2px;">NOMBRE CLIENTE</div>
          <div style="border-bottom:1.5px solid #c8c8c8;padding-bottom:3px;min-height:18px;">
            <span style="font-family:'Oswald',sans-serif;font-size:.82rem;color:#333;font-weight:700;">${compNombre}</span>
          </div>
        </div>

        <!-- Contacto -->
        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.42rem;color:#bbb;letter-spacing:3px;margin-bottom:2px;">CONTACTO / TELÉFONO</div>
          <div style="border-bottom:1.5px solid #c8c8c8;padding-bottom:3px;min-height:18px;">
            <span style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#555;">${compTel}</span>
          </div>
        </div>

        <!-- Serial + sorteo en talón -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-top:2px;">
          <div>
            <div style="font-family:'Share Tech Mono',monospace;font-size:.4rem;color:#bbb;letter-spacing:2px;">SORTEO</div>
            <div style="font-family:'Oswald',sans-serif;font-size:.72rem;color:#555;font-weight:600;">${fechaSort} · ${hora}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'Share Tech Mono',monospace;font-size:.4rem;color:#ccc;letter-spacing:2px;">${serial}</div>
          </div>
        </div>
      </div>

    </div>
  </div>

</div>`;
}

/* legacy — usa diseño default */
export function buildTicketHTML(r, numero, comprador, vendedor, copia) {
  return buildTicketHTMLCustom(DEFAULT_DESIGN, r, numero, comprador, vendedor, copia);
}

/* ═══════════════════════════════════════════════════════
   TicketPreview — React inline completo (cliente + talón)
═══════════════════════════════════════════════════════ */
export function TicketPreview({ r, numero, comprador, vendedor, design: dProp }) {
  const d = { ...DEFAULT_DESIGN, ...(dProp || getTicketDesign()) };

  const nombre    = r?.rifa_nombre || r?.nombre || 'DEMO RIFA';
  const premio    = r?.premio || '—';
  const loteria   = r?.loteria_ref || '';
  const valor     = fmtMoney(r?.precio || 0);
  const fechaSort = fmtFecha(r?.fecha_sorteo);
  const hora      = d.horaSort || '10:00 PM';
  const ac        = d.accentColor;
  const compNombre = comprador?.nombre || '';
  const compTel    = comprador?.telefono || '';

  const B = { fontFamily:"'Bebas Neue', cursive" };
  const M = { fontFamily:"'Share Tech Mono', monospace" };
  const O = { fontFamily:"'Oswald', sans-serif" };

  const numGlow = d.numGlow ? { textShadow:`0 0 40px ${ac}99, 0 0 15px ${ac}55` } : {};

  const rows = [
    { k:'Comprador', v: compNombre || '_______________' },
    compTel ? { k:'Teléfono', v: compTel } : null,
    { k:'Vendedor',  v: vendedor || '_______________' },
    loteria ? { k:'Lotería',  v: loteria } : null,
  ].filter(Boolean);

  return (
    <div style={{ width:'100%', maxWidth:320, background:'#fff', borderRadius:9, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,.75)', position:'relative', flexShrink:0, ...O }}>

      {/* Watermark */}
      {d.watermark && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-35deg)', ...B, fontSize:'2.8rem', color:'rgba(0,0,0,.022)', letterSpacing:'12px', whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none', zIndex:0 }}>
          {d.watermarkText} {d.watermarkText}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background:`linear-gradient(135deg,${d.headerBg} 0%,${d.headerBg2} 50%,${d.headerBg} 100%)`, padding:'10px 13px 8px', borderBottom:`3px solid ${ac}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative', zIndex:1 }}>
        <div>
          <div style={{ ...B, fontSize:'1.3rem', color:ac, letterSpacing:'4px', lineHeight:1 }}>{d.brandEmoji} {d.brandText}</div>
          {d.showSubrifa && nombre && <div style={{ ...M, fontSize:'.46rem', color:'#888', letterSpacing:'3px', marginTop:'2px' }}>{nombre}</div>}
          {loteria && <div style={{ ...M, fontSize:'.44rem', color:'#666', letterSpacing:'2px', marginTop:'1px' }}>🎲 {loteria}</div>}
        </div>
        <div style={{ ...M, fontSize:'.44rem', color:'#666', textAlign:'right', lineHeight:2 }}>
          <div>JDY-{numero||'000'}-XXXX</div>
          <div>{new Date().toLocaleDateString('es-CO')}</div>
          <div style={{ color:ac, fontSize:'.42rem' }}>★ BOLETO OFICIAL</div>
        </div>
      </div>

      {/* ── ZONA NÚMERO HERO ── */}
      {d.premioImagen && d.premioImagenPos === 'hero' ? (
        <div style={{ position:'relative', width:'100%', height:120, overflow:'hidden' }}>
          <img src={d.premioImagen} alt="Premio" style={{ width:'100%', height:'100%', objectFit:d.premioImagenFit }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,.1) 55%,transparent 100%)' }}></div>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', paddingBottom:9 }}>
            <div style={{ ...M, fontSize:'.48rem', color:'rgba(255,255,255,.6)', letterSpacing:'5px', marginBottom:3 }}>NÚMERO DE LA SUERTE</div>
            <div style={{ ...B, fontSize:`min(${d.numSize},3.2rem)`, color:d.numColor, letterSpacing:'14px', lineHeight:1, paddingLeft:'14px', ...numGlow }}>{numero||'000'}</div>
            <div style={{ ...O, fontWeight:300, fontSize:'.6rem', color:'rgba(255,255,255,.5)', letterSpacing:'3px', marginTop:4 }}>{nombre}</div>
          </div>
        </div>
      ) : (
        <div style={{ background:`linear-gradient(160deg,${d.heroBg},${d.heroBg2} 55%,${d.heroBg})`, padding:'15px 12px 13px', textAlign:'center', position:'relative', overflow:'hidden', zIndex:1 }}>
          {d.heroLines && <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(90deg,transparent,transparent 24px,rgba(245,197,24,.018) 24px,rgba(245,197,24,.018) 25px)', pointerEvents:'none' }}></div>}
          <div style={{ ...M, fontSize:'.5rem', color:'#484848', letterSpacing:'5px', marginBottom:3, position:'relative' }}>NÚMERO DE LA SUERTE</div>
          <div style={{ ...B, fontSize:`min(${d.numSize},3.4rem)`, color:d.numColor, letterSpacing:'14px', lineHeight:.9, paddingLeft:'14px', position:'relative', ...numGlow }}>{numero||'000'}</div>
          <div style={{ ...O, fontWeight:300, fontSize:'.62rem', color:'#484848', letterSpacing:'4px', marginTop:6, position:'relative' }}>{nombre}</div>
        </div>
      )}

      {/* ── PERFORACIÓN ── */}
      {d.showPerf && (
        <div style={{ display:'flex', alignItems:'center', background:'#fff', overflow:'visible', position:'relative', zIndex:1 }}>
          <div style={{ width:14, height:14, background:'#0d0d0d', borderRadius:'50%', marginLeft:'-7px', flexShrink:0 }}></div>
          <div style={{ flex:1, borderTop:'2px dashed #c8c8c8', margin:'0 4px' }}></div>
          <div style={{ width:14, height:14, background:'#0d0d0d', borderRadius:'50%', marginRight:'-7px', flexShrink:0 }}></div>
        </div>
      )}

      {/* ── imagen zona info ── */}
      {d.premioImagen && d.premioImagenPos === 'info' && (
        <div style={{ width:'100%', height:90, overflow:'hidden', position:'relative', zIndex:1 }}>
          <img src={d.premioImagen} alt="Premio" style={{ width:'100%', height:'100%', objectFit:d.premioImagenFit }} />
        </div>
      )}

      {/* ── CUERPO CLIENTE ── */}
      <div style={{ padding:'11px 13px 9px', background:'#fff', position:'relative', zIndex:1 }}>

        {/* Premio = PROTAGONISTA */}
        <div style={{ background:`linear-gradient(135deg,${d.headerBg} 0%,${d.headerBg2} 50%,${d.headerBg} 100%)`, borderRadius:8, padding:'11px 13px', marginBottom:11, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(245,197,24,.03) 10px,rgba(245,197,24,.03) 11px)', pointerEvents:'none' }}></div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, position:'relative' }}>
            <div>
              <div style={{ ...M, fontSize:'.44rem', color:'#888', letterSpacing:'4px', marginBottom:3 }}>🏆 PRIMER PREMIO</div>
              <div style={{ ...B, fontSize:'1.6rem', color:ac, letterSpacing:'3px', lineHeight:1, textShadow:`0 0 20px ${ac}55` }}>{premio}</div>
            </div>
            <div style={{ textAlign:'right', borderLeft:'1px solid rgba(255,255,255,.08)', paddingLeft:10 }}>
              <div style={{ ...M, fontSize:'.42rem', color:'#888', letterSpacing:'2px', marginBottom:2 }}>VALOR</div>
              <div style={{ ...B, fontSize:'1.1rem', color:'#06d6a0', letterSpacing:'2px' }}>{valor}</div>
            </div>
          </div>
        </div>

        {/* Sorteo — fecha destacada como variable */}
        <div style={{ display:'flex', gap:7, marginBottom:10 }}>
          <div style={{ flex:1, background:'#f4f4f4', border:'1.5px solid #e0e0e0', borderRadius:6, padding:'6px 9px', position:'relative' }}>
            <div style={{ position:'absolute', top:-7, left:9, background:'#fff', padding:'0 4px', ...M, fontSize:'.4rem', color:'#b0b0b0', letterSpacing:'2px' }}>FECHA SORTEO</div>
            <div style={{ ...O, fontSize:'.92rem', fontWeight:700, color:'#111', marginTop:2 }}>{fechaSort}</div>
          </div>
          <div style={{ background:`linear-gradient(135deg,${d.headerBg},${d.headerBg2})`, borderRadius:6, padding:'6px 12px', textAlign:'center', flexShrink:0 }}>
            <div style={{ ...M, fontSize:'.4rem', color:'#888', letterSpacing:'2px', marginBottom:2 }}>HORA</div>
            <div style={{ ...B, fontSize:'1.05rem', color:ac, letterSpacing:'3px' }}>{hora}</div>
          </div>
        </div>

        {/* Datos comprador */}
        {rows.map(({ k, v }) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'3px 0', borderBottom:'1px dotted #e0e0e0' }}>
            <span style={{ ...M, fontSize:'.48rem', color:'#b0b0b0', letterSpacing:'1px', flexShrink:0, marginRight:8 }}>{k}</span>
            <span style={{ ...O, fontSize:'.8rem', color:'#111', fontWeight:600, textAlign:'right' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* ── FOOTER CLIENTE ── */}
      <div style={{ background:'#f6f6f6', borderTop:'1px solid #e8e8e8', padding:'5px 13px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:1 }}>
        <div style={{ ...B, fontSize:'.68rem', color:'#ccc', letterSpacing:'3px' }}>{d.brandText}</div>
        <div style={{ ...M, fontSize:'.4rem', color:'#ccc', textAlign:'right', lineHeight:1.75 }}>
          {(d.footerText||'Conserve este boleto · Válido con número legible').split('·').map((t,i) => <div key={i}>{t.trim()}</div>)}
        </div>
      </div>

      {/* ▸▸▸ SEPARADOR DE CORTE ◂◂◂ */}
      <div style={{ background:'#fff', borderTop:'2px dashed #b0b0b0', borderBottom:'2px dashed #b0b0b0', padding:'4px 0', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', padding:'0 12px', gap:8 }}>
          <div style={{ flex:1, borderTop:'1px dashed #ddd' }}></div>
          <div style={{ ...M, fontSize:'.4rem', color:'#c0c0c0', letterSpacing:'3px', whiteSpace:'nowrap' }}>✂  TALÓN · QUEDA CON EL VENDEDOR  ✂</div>
          <div style={{ flex:1, borderTop:'1px dashed #ddd' }}></div>
        </div>
      </div>

      {/* ▸▸▸ TALÓN VENDEDOR ◂◂◂ */}
      <div style={{ background:'linear-gradient(180deg,#f7f7f7,#eeeeee)', padding:'10px 13px 13px', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'stretch', gap:11 }}>

          {/* Número prominente */}
          <div style={{ background:`linear-gradient(135deg,${d.headerBg},${d.headerBg2})`, borderRadius:8, padding:'9px 11px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, border:`2px solid ${ac}44`, minWidth:68 }}>
            <div style={{ ...M, fontSize:'.38rem', color:'#888', letterSpacing:'4px', marginBottom:2 }}>N°</div>
            <div style={{ ...B, fontSize:'2rem', color:ac, letterSpacing:'7px', lineHeight:1, paddingLeft:'7px', ...(d.numGlow ? { textShadow:`0 0 18px ${ac}88` } : {}) }}>{numero||'000'}</div>
            <div style={{ ...M, fontSize:'.34rem', color:'#777', letterSpacing:'1px', marginTop:3, textAlign:'center', maxWidth:65, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</div>
          </div>

          {/* Campos del talón */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:5 }}>
            <div style={{ ...B, fontSize:'.72rem', color:'#999', letterSpacing:'3px' }}>{d.brandText}</div>

            {/* Nombre en talón */}
            <div>
              <div style={{ ...M, fontSize:'.4rem', color:'#b8b8b8', letterSpacing:'3px', marginBottom:2 }}>NOMBRE CLIENTE</div>
              <div style={{ borderBottom:'1.5px solid #c4c4c4', paddingBottom:3, minHeight:18 }}>
                <span style={{ ...O, fontSize:'.78rem', color:'#333', fontWeight:700 }}>{compNombre}</span>
              </div>
            </div>

            {/* Contacto en talón */}
            <div>
              <div style={{ ...M, fontSize:'.4rem', color:'#b8b8b8', letterSpacing:'3px', marginBottom:2 }}>CONTACTO / TELÉFONO</div>
              <div style={{ borderBottom:'1.5px solid #c4c4c4', paddingBottom:3, minHeight:18 }}>
                <span style={{ ...M, fontSize:'.68rem', color:'#555' }}>{compTel}</span>
              </div>
            </div>

            {/* Fecha + serial en talón */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:8, marginTop:2 }}>
              <div>
                <div style={{ ...M, fontSize:'.38rem', color:'#bbb', letterSpacing:'2px' }}>SORTEO</div>
                <div style={{ ...O, fontSize:'.68rem', color:'#555', fontWeight:600 }}>{fechaSort} · {hora}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ ...M, fontSize:'.36rem', color:'#ccc', letterSpacing:'1px' }}>JDY-{numero||'000'}-XXXX</div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   printTickets — imprime con diseño personalizado
═══════════════════════════════════════════════════════ */
export function printTickets(rifasArr, numero, comprador, vendedor) {
  const saved = (() => { try { const s = localStorage.getItem(TICKET_DESIGN_KEY); return s ? JSON.parse(s) : null; } catch { return null; } })();
  const d = { ...DEFAULT_DESIGN, ...(saved || {}) };

  const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@300;400;600;700&family=Share+Tech+Mono&display=swap');`;
  const html  = rifasArr.flatMap(r => [1, 2].map(c => buildTicketHTMLCustom(d, r, numero, comprador, vendedor, c))).join('\n');

  const win = window.open('', '_blank', 'width=480,height=920');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Boleto #${numero} — RIFAS JORDYN</title>
<style>${FONTS}*{box-sizing:border-box;margin:0;padding:0;}body{background:#1a1a1a;display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px;font-family:'Oswald',sans-serif;}
@media print{body{background:#fff;padding:6px;gap:12px;}}</style>
</head><body>${html}
<script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},400);};<\/script></body></html>`);
  win.document.close();
}

/* ═══════════════════════════════════════════════════════
   Ticket — default export
═══════════════════════════════════════════════════════ */
export default function Ticket({ rifa, numero, comprador, vendedor, onClose }) {
  const rifasArr = Array.isArray(rifa) ? rifa.filter(r => r.disponible !== false) : rifa ? [rifa] : [];

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'18px', justifyContent:'center', marginBottom:'20px' }}>
        {rifasArr.map(r => (
          <TicketPreview key={r.rifa_id||r.id||Math.random()} r={r} numero={numero} comprador={comprador} vendedor={vendedor} />
        ))}
      </div>
      <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn-jordyn" onClick={() => printTickets(rifasArr, numero, comprador, vendedor)} style={{ fontSize:'1rem', padding:'.72rem 2rem' }}>
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