import React from 'react';

export const TICKET_DESIGN_KEY = 'rifas_jordyn_ticket_design';

export const DEFAULT_DESIGN = {
  headerBg:        '#0a0a0a',
  headerBg2:       '#1c1800',
  accentColor:     '#f5c518',
  brandText:       'RESUELVE TU SEMANA',
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
  horaSort:        '',   // Vacío = usar hora de fecha_sorteo si existe
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

/* ─────────────────────────────────────────────────────────────
   FIX PUNTO 3B — parseFecha + fmtFecha con zona horaria
   Problema original: new Date(f) sin normalizar causaba desfase
   en Safari/Firefox y mostraba fecha incorrecta en el ticket.
───────────────────────────────────────────────────────────── */
const parseFechaTicket = (f) => {
  if (!f) return null;
  const iso = String(f).replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const fmtFecha = f => {
  const d = parseFechaTicket(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Caracas',
  });
};

/* ─────────────────────────────────────────────────────────────
   FIX PUNTO 3B — extraerHora
   Extrae la hora de fecha_sorteo si existe y es distinta de
   medianoche. Si el diseño tiene horaSort manual configurado,
   ese tiene prioridad (para compatibilidad con el editor).
───────────────────────────────────────────────────────────── */
const extraerHora = (fechaSorteo, horaDesign) => {
  // Si el admin configuró hora manual en el editor de diseño, usarla
  if (horaDesign && horaDesign.trim()) return horaDesign.trim();
  // Si no, extraer del campo fecha_sorteo
  const d = parseFechaTicket(fechaSorteo);
  if (!d) return '';
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 0 && m === 0) return ''; // Sin hora registrada
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Caracas',
  });
};

/* ═══════════════════════════════════════════════════════════
   buildTicketHTMLCustom — HTML HORIZONTAL (720 × ~380px)
   Layout: columna izquierda (número) + columna derecha (info)
           + talón horizontal debajo
   FIX PUNTO 3B: hora dinámica + fecha sin desfase
═══════════════════════════════════════════════════════════ */
export function buildTicketHTMLCustom(d, r, numero, comprador, vendedor, copia) {
  const nombre     = r.rifa_nombre || r.nombre || '';
  const premio     = r.premio || '—';
  const loteria    = r.loteria_ref || '';
  const valor      = fmtMoney(r.precio);
  const fechaSort  = fmtFecha(r.fecha_sorteo);
  // FIX: hora dinámica — usa fecha_sorteo si no hay hora manual en diseño
  const hora       = extraerHora(r.fecha_sorteo, d.horaSort);
  const serial     = `JDY-${numero}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const hoy        = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Caracas' });
  const ac         = d.accentColor || '#f5c518';
  const brand      = `${d.brandEmoji || '🎰'} ${d.brandText || 'RESUELVE TU SEMANA'}`;
  const compNombre = comprador?.nombre || '';
  const compTel    = comprador?.telefono || '';
  const esOriginal = copia === 1;
  const labelCopia = esOriginal ? 'ORIGINAL' : 'COPIA';

  const numGlowCSS = d.numGlow ? `text-shadow:0 0 40px ${ac}99,0 0 15px ${ac}55;` : '';
  const linesCSS   = d.heroLines
    ? `background-image:repeating-linear-gradient(90deg,transparent,transparent 28px,rgba(245,197,24,.018) 28px,rgba(245,197,24,.018) 29px);`
    : '';

  const imgHeroHTML = d.premioImagen && d.premioImagenPos === 'hero' ? `
    <div style="position:absolute;inset:0;overflow:hidden;">
      <img src="${d.premioImagen}" style="width:100%;height:100%;object-fit:${d.premioImagenFit};display:block;opacity:.35;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.6) 0%,rgba(0,0,0,.1) 100%);"></div>
    </div>` : '';

  const imgInfoHTML = d.premioImagen && d.premioImagenPos === 'info' ? `
    <div style="width:100%;height:80px;overflow:hidden;border-radius:6px;margin-bottom:10px;">
      <img src="${d.premioImagen}" style="width:100%;height:100%;object-fit:${d.premioImagenFit};display:block;">
    </div>` : '';

  const wmHTML = d.watermark ? `
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);
      font-family:'Bebas Neue',cursive;font-size:4.5rem;color:rgba(0,0,0,.018);
      letter-spacing:12px;white-space:nowrap;pointer-events:none;user-select:none;z-index:0;">
      ${d.watermarkText} ${d.watermarkText}
    </div>` : '';

  const perfHTML = d.showPerf ? `
    <div style="position:absolute;top:0;bottom:0;left:290px;border-left:2px dashed rgba(255,255,255,.15);z-index:10;pointer-events:none;"></div>
    <div style="position:absolute;top:-7px;left:283px;width:14px;height:14px;background:#1a1a1a;border-radius:50%;z-index:11;"></div>
    <div style="position:absolute;bottom:-7px;left:283px;width:14px;height:14px;background:#1a1a1a;border-radius:50%;z-index:11;"></div>` : '';

  const dataRow = (label, value) => !value ? '' : `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px dotted rgba(255,255,255,.08);">
      <span style="font-family:'Share Tech Mono',monospace;font-size:.44rem;color:#666;letter-spacing:1px;flex-shrink:0;margin-right:8px;">${label}</span>
      <span style="font-family:'Oswald',sans-serif;font-size:.8rem;color:#f0f0f0;font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:155px;">${value}</span>
    </div>`;

  return `
<div style="width:720px;font-family:'Oswald',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.65);border-radius:12px;overflow:hidden;page-break-inside:avoid;margin:10px auto;">

  <!-- ══ BOLETO PRINCIPAL ══ -->
  <div style="display:flex;flex-direction:row;height:265px;position:relative;
    background:linear-gradient(135deg,${d.headerBg} 0%,${d.headerBg2} 50%,${d.headerBg} 100%);
    border-bottom:3px solid ${ac};">
    ${wmHTML}
    ${perfHTML}

    <!-- Columna izquierda: número -->
    <div style="width:290px;flex-shrink:0;
      background:linear-gradient(160deg,${d.heroBg} 0%,${d.heroBg2} 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      position:relative;overflow:hidden;border-right:1px solid rgba(255,255,255,.06);">
      ${imgHeroHTML}
      <div style="position:absolute;inset:0;${linesCSS}pointer-events:none;"></div>

      <div style="position:absolute;top:10px;right:12px;font-family:'Share Tech Mono',monospace;
        font-size:.42rem;color:rgba(255,255,255,.35);border:1px solid rgba(255,255,255,.15);
        padding:2px 6px;border-radius:2px;letter-spacing:3px;z-index:5;">${labelCopia}</div>

      <div style="position:absolute;top:10px;left:12px;font-family:'Bebas Neue',cursive;
        font-size:.72rem;color:${ac};letter-spacing:3px;opacity:.75;z-index:5;">${brand}</div>

      <div style="position:relative;z-index:5;text-align:center;margin-top:12px;">
        <div style="font-family:'Share Tech Mono',monospace;font-size:.46rem;
          color:rgba(255,255,255,.4);letter-spacing:5px;margin-bottom:5px;">NÚMERO DE LA SUERTE</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:${d.numSize};
          color:${d.numColor};letter-spacing:16px;line-height:.9;padding-left:16px;${numGlowCSS}">${numero}</div>
        ${d.showSubrifa && nombre ? `
        <div style="font-family:'Oswald',sans-serif;font-weight:300;font-size:.56rem;
          color:rgba(255,255,255,.45);letter-spacing:3px;margin-top:8px;">${nombre}</div>` : ''}
      </div>

      <div style="position:absolute;bottom:10px;left:12px;right:12px;text-align:center;z-index:5;">
        <div style="font-family:'Share Tech Mono',monospace;font-size:.4rem;
          color:rgba(255,255,255,.28);letter-spacing:2px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🏆 ${premio}</div>
      </div>
    </div>

    <!-- Columna derecha: info -->
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;padding:16px 20px 12px;position:relative;z-index:2;">

      <!-- Header: brand + serial -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
        margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,.07);padding-bottom:10px;">
        <div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.3rem;color:${ac};letter-spacing:4px;line-height:1;">${brand}</div>
          ${loteria ? `<div style="font-family:'Share Tech Mono',monospace;font-size:.44rem;color:#666;letter-spacing:2px;margin-top:2px;">🎲 ${loteria}</div>` : ''}
        </div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.44rem;color:#555;text-align:right;line-height:2;">
          <div>${serial}</div><div>${hoy}</div>
          <div style="color:${ac};font-size:.42rem;">★ BOLETO OFICIAL</div>
        </div>
      </div>

      ${imgInfoHTML}

      <!-- Premio protagonista -->
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-radius:8px;padding:9px 13px;margin-bottom:11px;
        display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="min-width:0;flex:1;">
          <div style="font-family:'Share Tech Mono',monospace;font-size:.42rem;color:#777;letter-spacing:4px;margin-bottom:3px;">🏆 PRIMER PREMIO</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.5rem;color:${ac};letter-spacing:3px;
            line-height:1;text-shadow:0 0 20px ${ac}44;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${premio}</div>
        </div>
        <div style="text-align:right;border-left:1px solid rgba(255,255,255,.07);padding-left:13px;flex-shrink:0;">
          <div style="font-family:'Share Tech Mono',monospace;font-size:.4rem;color:#777;letter-spacing:2px;margin-bottom:2px;">VALOR</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.2rem;color:#06d6a0;letter-spacing:2px;">${valor}</div>
        </div>
      </div>

      <!-- Grid: fecha + datos -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;flex:1;">

        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
          border-radius:6px;padding:6px 9px;position:relative;">
          <div style="position:absolute;top:-6px;left:8px;background:${d.headerBg};padding:0 4px;
            font-family:'Share Tech Mono',monospace;font-size:.38rem;color:#555;letter-spacing:2px;">FECHA SORTEO</div>
          <div style="font-family:'Oswald',sans-serif;font-size:.9rem;font-weight:700;color:#f0f0f0;margin-top:2px;">${fechaSort}</div>
          ${hora ? `<div style="font-family:'Bebas Neue',cursive;font-size:.78rem;color:${ac};letter-spacing:3px;margin-top:1px;">${hora}</div>` : ''}
        </div>

        <div>
          ${dataRow('Comprador', compNombre || '_______________')}
          ${dataRow('Teléfono', compTel)}
          ${dataRow('Vendedor', vendedor || '_______________')}
          ${dataRow('Lotería', loteria)}
        </div>

      </div>

      <!-- Footer -->
      <div style="border-top:1px solid rgba(255,255,255,.06);margin-top:8px;padding-top:5px;
        display:flex;justify-content:space-between;align-items:center;">
        <div style="font-family:'Bebas Neue',cursive;font-size:.62rem;color:rgba(255,255,255,.18);letter-spacing:3px;">${d.brandText}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.38rem;color:rgba(255,255,255,.18);text-align:right;">
          ${(d.footerText||'').split('·').map(t => `<span>${t.trim()}</span>`).join(' &middot; ')}
        </div>
      </div>
    </div>
  </div>

  <!-- ══ TALÓN HORIZONTAL ══ -->
  <div style="background:linear-gradient(180deg,#f7f7f7,#eeeeee);">

    <!-- Separador de corte -->
    <div style="display:flex;align-items:center;padding:0 14px;
      border-top:2px dashed #c4c4c4;border-bottom:1px dashed #d4d4d4;
      background:#fff;height:22px;">
      <div style="flex:1;"></div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:.4rem;color:#b0b0b0;letter-spacing:3px;white-space:nowrap;">
        ✂&nbsp;&nbsp;TALÓN · QUEDA CON EL VENDEDOR&nbsp;&nbsp;✂
      </div>
      <div style="flex:1;"></div>
    </div>

    <!-- Cuerpo talón -->
    <div style="display:flex;align-items:stretch;height:100px;">

      <!-- Número talón -->
      <div style="width:110px;flex-shrink:0;
        background:linear-gradient(135deg,${d.headerBg},${d.headerBg2});
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        border-right:2px dashed rgba(255,255,255,.12);">
        <div style="font-family:'Share Tech Mono',monospace;font-size:.38rem;color:#888;letter-spacing:4px;margin-bottom:2px;">N°</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:2.4rem;color:${ac};
          letter-spacing:10px;line-height:1;padding-left:10px;
          ${d.numGlow ? `text-shadow:0 0 20px ${ac}88;` : ''}">${numero}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.34rem;color:#666;letter-spacing:1px;
          margin-top:3px;text-align:center;max-width:95px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>
      </div>

      <!-- Datos talón en grid -->
      <div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 22px;padding:8px 18px;align-items:center;">

        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.38rem;color:#b0b0b0;letter-spacing:3px;margin-bottom:3px;">NOMBRE CLIENTE</div>
          <div style="border-bottom:1.5px solid #c8c8c8;padding-bottom:3px;min-height:20px;">
            <span style="font-family:'Oswald',sans-serif;font-size:.82rem;color:#222;font-weight:700;">${compNombre}</span>
          </div>
        </div>

        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.38rem;color:#b0b0b0;letter-spacing:3px;margin-bottom:3px;">CONTACTO / TELÉFONO</div>
          <div style="border-bottom:1.5px solid #c8c8c8;padding-bottom:3px;min-height:20px;">
            <span style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#444;">${compTel}</span>
          </div>
        </div>

        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.38rem;color:#b0b0b0;letter-spacing:3px;margin-bottom:2px;">SORTEO</div>
          <div style="font-family:'Oswald',sans-serif;font-size:.74rem;color:#333;font-weight:600;">${fechaSort}${hora ? ` · ${hora}` : ''}</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="min-width:0;flex:1;">
            <div style="font-family:'Share Tech Mono',monospace;font-size:.38rem;color:#b0b0b0;letter-spacing:2px;margin-bottom:2px;">PREMIO</div>
            <div style="font-family:'Bebas Neue',cursive;font-size:.84rem;color:#333;letter-spacing:2px;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${premio}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Share Tech Mono',monospace;font-size:.34rem;color:#ccc;letter-spacing:1px;">${serial}</div>
            <div style="font-family:'Bebas Neue',cursive;font-size:.68rem;color:${ac};letter-spacing:2px;">${valor}</div>
          </div>
        </div>

      </div>
    </div>
  </div>

</div>`;
}

/* legacy */
export function buildTicketHTML(r, numero, comprador, vendedor, copia) {
  return buildTicketHTMLCustom(DEFAULT_DESIGN, r, numero, comprador, vendedor, copia);
}

/* ═══════════════════════════════════════════════════════════
   TicketPreview — React inline HORIZONTAL completo
   FIX PUNTO 3B:
     - fmtFecha usa parseFechaTicket (sin desfase UTC)
     - hora dinámica con extraerHora(fecha_sorteo, d.horaSort)
     - serial real en lugar de "JDY-000-DEMO"
     - layout alineado: grid-template-columns consistente
═══════════════════════════════════════════════════════════ */
export function TicketPreview({ r, rifa, numero, comprador, vendedor, design: dProp }) {
  // Acepta tanto `r` como `rifa` para compatibilidad con ambos usos
  const rifaData = r || rifa || {};
  const d = { ...DEFAULT_DESIGN, ...(dProp || getTicketDesign()) };

  const nombre     = rifaData?.rifa_nombre || rifaData?.nombre || 'DEMO RIFA';
  const premio     = rifaData?.premio || '—';
  const loteria    = rifaData?.loteria_ref || '';
  const valor      = fmtMoney(rifaData?.precio || 0);
  const fechaSort  = fmtFecha(rifaData?.fecha_sorteo);
  // FIX: hora dinámica — prioriza horaSort del diseño, sino extrae de fecha_sorteo
  const hora       = extraerHora(rifaData?.fecha_sorteo, d.horaSort);
  const ac         = d.accentColor;
  const compNombre = comprador?.nombre || '';
  const compTel    = comprador?.telefono || '';
  // FIX: serial real en lugar de hardcoded "JDY-000-DEMO"
  const serial     = `JDY-${numero||'000'}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

  const B = { fontFamily:"'Bebas Neue', cursive" };
  const M = { fontFamily:"'Share Tech Mono', monospace" };
  const O = { fontFamily:"'Oswald', sans-serif" };
  const numGlow = d.numGlow ? { textShadow:`0 0 40px ${ac}99, 0 0 15px ${ac}55` } : {};

  const hasHeroImg = d.premioImagen && d.premioImagenPos === 'hero';
  const hasInfoImg = d.premioImagen && d.premioImagenPos === 'info';

  const rows = [
    { k:'Comprador', v: compNombre || '_______________' },
    compTel  ? { k:'Teléfono', v: compTel  } : null,
    { k:'Vendedor',  v: vendedor || '_______________' },
    loteria  ? { k:'Lotería',  v: loteria  } : null,
  ].filter(Boolean);

  return (
    <div style={{ width:'100%', maxWidth:720, margin:'0 auto', ...O }}>

      {/* ════ BOLETO HORIZONTAL ════ */}
      <div style={{
        display:'flex', height:265,
        background:`linear-gradient(135deg,${d.headerBg} 0%,${d.headerBg2} 50%,${d.headerBg} 100%)`,
        borderRadius:'12px 12px 0 0', overflow:'hidden', position:'relative',
        boxShadow:'0 20px 60px rgba(0,0,0,.65)', borderBottom:`3px solid ${ac}`,
      }}>

        {/* Watermark */}
        {d.watermark && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-20deg)', ...B, fontSize:'4.5rem', color:'rgba(0,0,0,.018)', letterSpacing:12, whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none', zIndex:0 }}>
            {d.watermarkText} {d.watermarkText}
          </div>
        )}

        {/* Perforación vertical */}
        {d.showPerf && (
          <>
            <div style={{ position:'absolute', top:0, bottom:0, left:290, borderLeft:'2px dashed rgba(255,255,255,.15)', zIndex:10, pointerEvents:'none' }}></div>
            <div style={{ position:'absolute', top:-7, left:283, width:14, height:14, background:d.headerBg, borderRadius:'50%', zIndex:11 }}></div>
            <div style={{ position:'absolute', bottom:-7, left:283, width:14, height:14, background:d.headerBg, borderRadius:'50%', zIndex:11 }}></div>
          </>
        )}

        {/* ── Columna izquierda: número ── */}
        <div style={{
          width:290, flexShrink:0,
          background:`linear-gradient(160deg,${d.heroBg} 0%,${d.heroBg2} 100%)`,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden', borderRight:'1px solid rgba(255,255,255,.06)',
        }}>
          {hasHeroImg && (
            <div style={{ position:'absolute', inset:0 }}>
              <img src={d.premioImagen} alt="Premio" style={{ width:'100%', height:'100%', objectFit:d.premioImagenFit, opacity:.35 }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,rgba(0,0,0,.6) 0%,rgba(0,0,0,.1) 100%)' }}></div>
            </div>
          )}
          {d.heroLines && (
            <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(90deg,transparent,transparent 28px,rgba(245,197,24,.018) 28px,rgba(245,197,24,.018) 29px)', pointerEvents:'none' }}></div>
          )}

          <div style={{ position:'absolute', top:10, right:12, ...M, fontSize:'.42rem', color:'rgba(255,255,255,.35)', border:'1px solid rgba(255,255,255,.15)', padding:'2px 6px', borderRadius:2, letterSpacing:3, zIndex:5 }}>ORIGINAL</div>
          <div style={{ position:'absolute', top:10, left:12, ...B, fontSize:'.72rem', color:ac, letterSpacing:3, opacity:.75, zIndex:5 }}>{d.brandEmoji} {d.brandText}</div>

          <div style={{ position:'relative', zIndex:5, textAlign:'center', marginTop:12 }}>
            <div style={{ ...M, fontSize:'.46rem', color:'rgba(255,255,255,.4)', letterSpacing:5, marginBottom:5 }}>NÚMERO DE LA SUERTE</div>
            <div style={{ ...B, fontSize:`min(${d.numSize}, 4.2rem)`, color:d.numColor, letterSpacing:16, lineHeight:.9, paddingLeft:16, ...numGlow }}>{numero || '000'}</div>
            {d.showSubrifa && nombre && (
              <div style={{ ...O, fontWeight:300, fontSize:'.56rem', color:'rgba(255,255,255,.45)', letterSpacing:3, marginTop:8 }}>{nombre}</div>
            )}
          </div>

          <div style={{ position:'absolute', bottom:10, left:12, right:12, textAlign:'center', zIndex:5 }}>
            <div style={{ ...M, fontSize:'.4rem', color:'rgba(255,255,255,.28)', letterSpacing:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🏆 {premio}</div>
          </div>
        </div>

        {/* ── Columna derecha: info ── */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', padding:'16px 20px 12px', position:'relative', zIndex:2 }}>

          {/* Header brand + serial */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, borderBottom:'1px solid rgba(255,255,255,.07)', paddingBottom:10 }}>
            <div>
              <div style={{ ...B, fontSize:'1.3rem', color:ac, letterSpacing:4, lineHeight:1 }}>{d.brandEmoji} {d.brandText}</div>
              {loteria && <div style={{ ...M, fontSize:'.44rem', color:'#666', letterSpacing:2, marginTop:2 }}>🎲 {loteria}</div>}
            </div>
            <div style={{ ...M, fontSize:'.44rem', color:'#555', textAlign:'right', lineHeight:2 }}>
              <div>{serial}</div>
              <div>{new Date().toLocaleDateString('es-CO', { timeZone:'America/Caracas' })}</div>
              <div style={{ color:ac, fontSize:'.42rem' }}>★ BOLETO OFICIAL</div>
            </div>
          </div>

          {hasInfoImg && (
            <div style={{ width:'100%', height:75, overflow:'hidden', borderRadius:6, marginBottom:10 }}>
              <img src={d.premioImagen} alt="Premio" style={{ width:'100%', height:'100%', objectFit:d.premioImagenFit }} />
            </div>
          )}

          {/* Premio protagonista */}
          <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'9px 13px', marginBottom:11, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ ...M, fontSize:'.42rem', color:'#777', letterSpacing:4, marginBottom:3 }}>🏆 PRIMER PREMIO</div>
              <div style={{ ...B, fontSize:'1.5rem', color:ac, letterSpacing:3, lineHeight:1, textShadow:`0 0 20px ${ac}44`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{premio}</div>
            </div>
            <div style={{ textAlign:'right', borderLeft:'1px solid rgba(255,255,255,.07)', paddingLeft:13, flexShrink:0 }}>
              <div style={{ ...M, fontSize:'.4rem', color:'#777', letterSpacing:2, marginBottom:2 }}>VALOR</div>
              <div style={{ ...B, fontSize:'1.2rem', color:'#06d6a0', letterSpacing:2 }}>{valor}</div>
            </div>
          </div>

          {/* Grid info: fecha + datos comprador */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', flex:1 }}>

            {/* Celda fecha/hora — con borde flotante */}
            <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:6, padding:'6px 9px', position:'relative' }}>
              <div style={{ position:'absolute', top:-6, left:8, background:d.headerBg, padding:'0 4px', ...M, fontSize:'.38rem', color:'#555', letterSpacing:2 }}>FECHA SORTEO</div>
              <div style={{ ...O, fontSize:'.9rem', fontWeight:700, color:'#f0f0f0', marginTop:2 }}>{fechaSort}</div>
              {/* FIX: hora solo si existe */}
              {hora && <div style={{ ...B, fontSize:'.78rem', color:ac, letterSpacing:3, marginTop:1 }}>{hora}</div>}
            </div>

            {/* Columna datos comprador */}
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {rows.map(({ k, v }) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'2px 0', borderBottom:'1px dotted rgba(255,255,255,.08)' }}>
                  <span style={{ ...M, fontSize:'.44rem', color:'#666', letterSpacing:1, flexShrink:0, marginRight:8 }}>{k}</span>
                  <span style={{ ...O, fontSize:'.78rem', color:'#f0f0f0', fontWeight:600, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:145 }}>{v}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Footer */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', marginTop:8, paddingTop:5, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ ...B, fontSize:'.62rem', color:'rgba(255,255,255,.18)', letterSpacing:3 }}>{d.brandText}</div>
            <div style={{ ...M, fontSize:'.38rem', color:'rgba(255,255,255,.18)', textAlign:'right' }}>
              {(d.footerText||'').split('·').map((t,i) => <span key={i}>{i > 0 && ' · '}{t.trim()}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ════ TALÓN HORIZONTAL ════ */}
      <div style={{ background:'linear-gradient(180deg,#f7f7f7,#eeeeee)', borderRadius:'0 0 12px 12px', overflow:'hidden' }}>

        <div style={{ display:'flex', alignItems:'center', padding:'0 14px', borderTop:'2px dashed #c4c4c4', borderBottom:'1px dashed #d4d4d4', background:'#fff', height:22 }}>
          <div style={{ flex:1 }}></div>
          <div style={{ ...M, fontSize:'.4rem', color:'#b0b0b0', letterSpacing:3, whiteSpace:'nowrap' }}>✂&nbsp;&nbsp;TALÓN · QUEDA CON EL VENDEDOR&nbsp;&nbsp;✂</div>
          <div style={{ flex:1 }}></div>
        </div>

        <div style={{ display:'flex', alignItems:'stretch', height:100 }}>

          {/* Número talón */}
          <div style={{ width:110, flexShrink:0, background:`linear-gradient(135deg,${d.headerBg},${d.headerBg2})`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRight:'2px dashed rgba(255,255,255,.12)' }}>
            <div style={{ ...M, fontSize:'.36rem', color:'#888', letterSpacing:4, marginBottom:2 }}>N°</div>
            <div style={{ ...B, fontSize:'2.4rem', color:ac, letterSpacing:10, lineHeight:1, paddingLeft:10, ...(d.numGlow ? { textShadow:`0 0 20px ${ac}88` } : {}) }}>{numero || '000'}</div>
            <div style={{ ...M, fontSize:'.34rem', color:'#666', letterSpacing:1, marginTop:3, textAlign:'center', maxWidth:95, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</div>
          </div>

          {/* Datos talón en grid 2 columnas */}
          <div style={{ flex:1, minWidth:0, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 22px', padding:'8px 18px', alignItems:'center' }}>

            <div>
              <div style={{ ...M, fontSize:'.38rem', color:'#b0b0b0', letterSpacing:3, marginBottom:3 }}>NOMBRE CLIENTE</div>
              <div style={{ borderBottom:'1.5px solid #c8c8c8', paddingBottom:3, minHeight:20 }}>
                <span style={{ ...O, fontSize:'.82rem', color:'#222', fontWeight:700 }}>{compNombre}</span>
              </div>
            </div>

            <div>
              <div style={{ ...M, fontSize:'.38rem', color:'#b0b0b0', letterSpacing:3, marginBottom:3 }}>CONTACTO / TELÉFONO</div>
              <div style={{ borderBottom:'1.5px solid #c8c8c8', paddingBottom:3, minHeight:20 }}>
                <span style={{ ...M, fontSize:'.72rem', color:'#444' }}>{compTel}</span>
              </div>
            </div>

            <div>
              <div style={{ ...M, fontSize:'.38rem', color:'#b0b0b0', letterSpacing:3, marginBottom:2 }}>SORTEO</div>
              {/* FIX: hora condicional en el talón */}
              <div style={{ ...O, fontSize:'.74rem', color:'#333', fontWeight:600 }}>{fechaSort}{hora ? ` · ${hora}` : ''}</div>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ ...M, fontSize:'.38rem', color:'#b0b0b0', letterSpacing:2, marginBottom:2 }}>PREMIO</div>
                <div style={{ ...B, fontSize:'.84rem', color:'#333', letterSpacing:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{premio}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ ...M, fontSize:'.34rem', color:'#ccc', letterSpacing:1 }}>{serial}</div>
                <div style={{ ...B, fontSize:'.68rem', color:ac, letterSpacing:2 }}>{valor}</div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   printTickets — acepta design opcional (diseño de la rifa)
═══════════════════════════════════════════════════════════ */
export function printTickets(rifasArr, numero, comprador, vendedor, design) {
  const d = design
    ? { ...DEFAULT_DESIGN, ...design }
    : (() => {
        try {
          const s = localStorage.getItem(TICKET_DESIGN_KEY);
          return s ? { ...DEFAULT_DESIGN, ...JSON.parse(s) } : { ...DEFAULT_DESIGN };
        } catch { return { ...DEFAULT_DESIGN }; }
      })();

  const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@300;400;600;700&family=Share+Tech+Mono&display=swap');`;
  const html  = rifasArr.flatMap(r => [1,2].map(c =>
    buildTicketHTMLCustom(d, r, numero, comprador, vendedor, c)
  )).join('\n');

  const win = window.open('', '_blank', 'width=800,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <title>Boleto #${numero} — ${d.brandText}</title>
  <style>${FONTS}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#1a1a1a;display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px;font-family:'Oswald',sans-serif;}
    @media print{body{background:#fff;padding:4px;gap:10px;}@page{size:landscape;margin:6mm;}}
  </style>
</head><body>${html}
  <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},400);};<\/script>
</body></html>`);
  win.document.close();
}

/* ═══════════════════════════════════════════════════════════
   Ticket — default export
═══════════════════════════════════════════════════════════ */
export default function Ticket({ rifa, numero, comprador, vendedor, onClose }) {
  const rifasArr = Array.isArray(rifa) ? rifa.filter(r => r.disponible !== false) : rifa ? [rifa] : [];

  const design = (() => {
    try {
      if (rifasArr[0]?.ticket_design) return { ...DEFAULT_DESIGN, ...rifasArr[0].ticket_design };
      const s = localStorage.getItem(TICKET_DESIGN_KEY);
      return s ? { ...DEFAULT_DESIGN, ...JSON.parse(s) } : { ...DEFAULT_DESIGN };
    } catch { return { ...DEFAULT_DESIGN }; }
  })();

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:18, justifyContent:'center', marginBottom:20, width:'100%' }}>
        {rifasArr.map(r => (
          <TicketPreview key={r.rifa_id||r.id||Math.random()} r={r} numero={numero} comprador={comprador} vendedor={vendedor} design={design} />
        ))}
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn-jordyn" onClick={() => printTickets(rifasArr, numero, comprador, vendedor, design)} style={{ fontSize:'1rem', padding:'.72rem 2rem' }}>
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