// ============================================================
//   RIFAS JORDYN — Componente Ticket
//   ✅ Diseño completamente rediseñado: limpio, profesional
//   ✅ Persistencia en BD via GET/PUT /api/ticket-design
//   ✅ Sin localStorage
//   ✅ Fuentes: DM Serif Display + DM Sans + Space Mono
//   ✅ parseFecha + extraerHora sin desfase UTC
// ============================================================
import React, { useState, useEffect } from 'react';
import API from '../services/api';

const FONT_URL = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap';

// ── DEFAULT_DESIGN — solo los valores que el admin puede cambiar ──
export const DEFAULT_DESIGN = {
  brandText:    'RIFAS JORDYN',
  footerText:   'Conserve este boleto · Válido solo con número legible',
  bgColor:      '#0f1923',
  accentColor:  '#e8c84a',
  accentColor2: '#3ecfcb',
  textLight:    '#f5f5f0',
  talonBg:      '#f8f7f2',
  watermarkText:'JORDYN',
  horaSort:     '',
};

// ── Helpers ───────────────────────────────────────────────────
const parseFechaTicket = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtFecha = (f) => {
  const d = parseFechaTicket(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', timeZone:'America/Caracas' });
};
const extraerHora = (fechaSorteo, horaDesign) => {
  if (horaDesign && horaDesign.trim()) return horaDesign.trim();
  const d = parseFechaTicket(fechaSorteo);
  if (!d) return '';
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return '';
  return d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Caracas' });
};
const fmtMoney = (p) => p
  ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(p)
  : '$0';
const mkSerial = (numero) =>
  `JDY-${numero || '000'}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

// ── Hook: carga diseño desde BD ───────────────────────────────
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
//   buildTicketHTML — HTML para ventana de impresión
// ─────────────────────────────────────────────────────────────
export function buildTicketHTML(d, r, numero, comprador, vendedor, copia) {
  const nombre  = r?.rifa_nombre || r?.nombre || 'RIFA';
  const premio  = r?.premio      || '—';
  const loteria = r?.loteria_ref || '';
  const valor   = fmtMoney(r?.precio);
  const fecha   = fmtFecha(r?.fecha_sorteo);
  const hora    = extraerHora(r?.fecha_sorteo, d.horaSort);
  const serial  = mkSerial(numero);
  const hoy     = new Date().toLocaleDateString('es-CO', { timeZone:'America/Caracas' });
  const nom     = comprador?.nombre   || '';
  const tel     = comprador?.telefono || '';
  const ced     = comprador?.cedula   || '';
  const isOrig  = copia === 1;

  const bg  = d.bgColor      || '#0f1923';
  const ac  = d.accentColor  || '#e8c84a';
  const ac2 = d.accentColor2 || '#3ecfcb';
  const txt = d.textLight    || '#f5f5f0';
  const tb  = d.talonBg      || '#f8f7f2';

  return `
<div style="width:680px;margin:10px auto;font-family:'DM Sans',sans-serif;page-break-inside:avoid;">

  <div style="background:${bg};border-radius:14px 14px 0 0;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.07);">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);
      font-family:'DM Serif Display',serif;font-size:5.5rem;color:rgba(255,255,255,.02);
      white-space:nowrap;pointer-events:none;letter-spacing:22px;">${d.watermarkText || 'JORDYN'}</div>

    <div style="height:4px;background:linear-gradient(90deg,${ac},${ac2},${ac});"></div>

    <div style="display:flex;align-items:stretch;min-height:210px;">

      <!-- NÚMERO -->
      <div style="width:196px;flex-shrink:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:18px 14px;
        border-right:1px dashed rgba(255,255,255,.1);position:relative;">
        <div style="position:absolute;width:130px;height:130px;border-radius:50%;
          background:radial-gradient(circle,${ac}14 0%,transparent 70%);"></div>
        <div style="font-family:'Space Mono',monospace;font-size:.48rem;color:${ac}88;letter-spacing:4px;margin-bottom:5px;">N° DE LA SUERTE</div>
        <div style="font-family:'DM Serif Display',serif;font-size:4.6rem;color:${ac};line-height:1;
          letter-spacing:8px;text-shadow:0 0 28px ${ac}55;position:relative;z-index:1;">${numero || '000'}</div>
        <div style="margin-top:8px;font-family:'Space Mono',monospace;font-size:.43rem;color:rgba(255,255,255,.3);
          letter-spacing:2px;text-align:center;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>
        <div style="position:absolute;top:9px;right:9px;font-family:'Space Mono',monospace;
          font-size:.37rem;color:${isOrig ? ac+'cc' : 'rgba(255,255,255,.25)'};
          border:1px solid ${isOrig ? ac+'44' : 'rgba(255,255,255,.12)'};
          padding:2px 6px;border-radius:2px;letter-spacing:2px;">${isOrig ? 'ORIGINAL' : 'COPIA'}</div>
      </div>

      <!-- DATOS -->
      <div style="flex:1;padding:16px 20px;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.06);">
          <div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.05rem;color:${ac};letter-spacing:2px;">${d.brandText || 'RIFAS JORDYN'}</div>
            ${loteria ? `<div style="font-family:'Space Mono',monospace;font-size:.41rem;color:rgba(255,255,255,.3);letter-spacing:1px;margin-top:3px;">🎲 ${loteria}</div>` : ''}
          </div>
          <div style="text-align:right;font-family:'Space Mono',monospace;font-size:.39rem;color:rgba(255,255,255,.28);line-height:1.8;">
            <div style="color:${ac2};font-size:.45rem;font-weight:700;">${serial}</div>
            <div>${hoy}</div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-family:'Space Mono',monospace;font-size:.41rem;color:${ac2}88;letter-spacing:3px;margin-bottom:3px;">PRIMER PREMIO</div>
          <div style="font-family:'DM Serif Display',serif;font-size:1.28rem;color:${txt};line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${premio}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;flex:1;">
          <div style="border-left:2px solid ${ac}40;padding-left:9px;">
            <div style="font-family:'Space Mono',monospace;font-size:.39rem;color:rgba(255,255,255,.28);letter-spacing:2px;margin-bottom:3px;">SORTEO</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.77rem;font-weight:600;color:${txt};">${fecha}</div>
            ${hora ? `<div style="font-family:'Space Mono',monospace;font-size:.55rem;color:${ac};margin-top:1px;">${hora}</div>` : ''}
          </div>
          <div style="border-left:2px solid ${ac2}40;padding-left:9px;">
            <div style="font-family:'Space Mono',monospace;font-size:.39rem;color:rgba(255,255,255,.28);letter-spacing:2px;margin-bottom:3px;">VALOR</div>
            <div style="font-family:'DM Serif Display',serif;font-size:.88rem;color:${ac2};">${valor}</div>
          </div>
          ${nom ? `<div style="border-left:2px solid rgba(255,255,255,.1);padding-left:9px;">
            <div style="font-family:'Space Mono',monospace;font-size:.39rem;color:rgba(255,255,255,.28);letter-spacing:2px;margin-bottom:3px;">COMPRADOR</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.74rem;font-weight:600;color:${txt};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nom}</div>
            ${ced ? `<div style="font-family:'Space Mono',monospace;font-size:.41rem;color:rgba(255,255,255,.28);">C.I.: ${ced}</div>` : ''}
          </div>` : ''}
          ${tel ? `<div style="border-left:2px solid rgba(255,255,255,.1);padding-left:9px;">
            <div style="font-family:'Space Mono',monospace;font-size:.39rem;color:rgba(255,255,255,.28);letter-spacing:2px;margin-bottom:3px;">TELÉFONO</div>
            <div style="font-family:'Space Mono',monospace;font-size:.69rem;color:${txt};">${tel}</div>
          </div>` : ''}
        </div>

        <div style="margin-top:10px;padding-top:6px;border-top:1px solid rgba(255,255,255,.05);
          font-family:'Space Mono',monospace;font-size:.37rem;color:rgba(255,255,255,.18);letter-spacing:1px;">${d.footerText || ''}</div>
      </div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${ac2},${ac},${ac2});"></div>
  </div>

  <!-- TALÓN -->
  <div style="background:${tb};border-radius:0 0 14px 14px;overflow:hidden;border:1px solid #e0ddd5;border-top:none;">
    <div style="display:flex;align-items:center;height:18px;padding:0 14px;border-top:2px dashed #ccc;">
      <div style="flex:1;"></div>
      <div style="font-family:'Space Mono',monospace;font-size:.37rem;color:#aaa;letter-spacing:3px;padding:0 8px;white-space:nowrap;">
        ✂ &nbsp; TALÓN — QUEDA CON EL VENDEDOR &nbsp; ✂
      </div>
      <div style="flex:1;"></div>
    </div>
    <div style="display:flex;align-items:center;padding:9px 14px;gap:14px;">
      <div style="background:${bg};border-radius:8px;padding:7px 12px;text-align:center;flex-shrink:0;min-width:76px;">
        <div style="font-family:'Space Mono',monospace;font-size:.35rem;color:${ac}80;letter-spacing:3px;margin-bottom:2px;">N°</div>
        <div style="font-family:'DM Serif Display',serif;font-size:1.9rem;color:${ac};letter-spacing:5px;">${numero || '000'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 14px;flex:1;">
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:.35rem;color:#aaa;letter-spacing:2px;margin-bottom:2px;">NOMBRE</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.73rem;font-weight:700;color:#222;border-bottom:1px solid #ccc;padding-bottom:2px;min-height:17px;">${nom}</div>
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:.35rem;color:#aaa;letter-spacing:2px;margin-bottom:2px;">CÉDULA</div>
          <div style="font-family:'Space Mono',monospace;font-size:.64rem;color:#333;border-bottom:1px solid #ccc;padding-bottom:2px;min-height:17px;">${ced}</div>
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:.35rem;color:#aaa;letter-spacing:2px;margin-bottom:2px;">TELÉFONO</div>
          <div style="font-family:'Space Mono',monospace;font-size:.6rem;color:#333;border-bottom:1px solid #ccc;padding-bottom:2px;min-height:17px;">${tel}</div>
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:.35rem;color:#aaa;letter-spacing:2px;margin-bottom:2px;">SORTEO</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.66rem;font-weight:600;color:#333;">${fecha}${hora ? ` · ${hora}` : ''}</div>
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:.35rem;color:#aaa;letter-spacing:2px;margin-bottom:2px;">PREMIO</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.66rem;font-weight:700;color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${premio}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Space Mono',monospace;font-size:.33rem;color:#bbb;letter-spacing:1px;">${serial}</div>
          <div style="font-family:'DM Serif Display',serif;font-size:.78rem;color:#333;">${valor}</div>
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

  const bg  = d.bgColor      || '#0f1923';
  const ac  = d.accentColor  || '#e8c84a';
  const ac2 = d.accentColor2 || '#3ecfcb';
  const txt = d.textLight    || '#f5f5f0';
  const tb  = d.talonBg      || '#f8f7f2';

  useEffect(() => {
    if (!document.getElementById('ticket-fonts-jd')) {
      const l = document.createElement('link');
      l.id   = 'ticket-fonts-jd';
      l.rel  = 'stylesheet';
      l.href = FONT_URL;
      document.head.appendChild(l);
    }
  }, []);

  const SM = { fontFamily:"'Space Mono', monospace" };
  const DS = { fontFamily:"'DM Serif Display', serif" };
  const DM = { fontFamily:"'DM Sans', sans-serif" };

  return (
    <div style={{ width:'100%', maxWidth:680, margin:'0 auto', ...DM }}>

      {/* BOLETO */}
      <div style={{ background:bg, borderRadius:'14px 14px 0 0', overflow:'hidden', position:'relative', border:'1px solid rgba(255,255,255,.07)', boxShadow:'0 16px 48px rgba(0,0,0,.4)' }}>

        {/* Watermark */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-28deg)', ...DS, fontSize:'5.5rem', color:'rgba(255,255,255,.02)', whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none', letterSpacing:22 }}>
          {d.watermarkText || 'JORDYN'}
        </div>

        {/* Franja superior */}
        <div style={{ height:4, background:`linear-gradient(90deg,${ac},${ac2},${ac})` }}></div>

        <div style={{ display:'flex', alignItems:'stretch', minHeight:210 }}>

          {/* Panel número */}
          <div style={{ width:196, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'18px 14px', borderRight:'1px dashed rgba(255,255,255,.1)', position:'relative' }}>
            <div style={{ position:'absolute', width:130, height:130, borderRadius:'50%', background:`radial-gradient(circle,${ac}14 0%,transparent 70%)` }}></div>
            <div style={{ ...SM, fontSize:'.48rem', color:`${ac}88`, letterSpacing:4, marginBottom:5 }}>N° DE LA SUERTE</div>
            <div style={{ ...DS, fontSize:'4.6rem', color:ac, lineHeight:1, letterSpacing:8, textShadow:`0 0 28px ${ac}55`, position:'relative', zIndex:1 }}>{numero || '000'}</div>
            <div style={{ marginTop:8, ...SM, fontSize:'.43rem', color:'rgba(255,255,255,.3)', letterSpacing:2, textAlign:'center', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</div>
            <div style={{ position:'absolute', top:9, right:9, ...SM, fontSize:'.37rem', color:`${ac}cc`, border:`1px solid ${ac}44`, padding:'2px 6px', borderRadius:2, letterSpacing:2 }}>ORIGINAL</div>
          </div>

          {/* Panel datos */}
          <div style={{ flex:1, padding:'16px 20px', display:'flex', flexDirection:'column' }}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, paddingBottom:10, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div>
                <div style={{ ...DS, fontSize:'1.05rem', color:ac, letterSpacing:2 }}>{d.brandText || 'RIFAS JORDYN'}</div>
                {loteria && <div style={{ ...SM, fontSize:'.41rem', color:'rgba(255,255,255,.3)', letterSpacing:1, marginTop:3 }}>🎲 {loteria}</div>}
              </div>
              <div style={{ textAlign:'right', ...SM, fontSize:'.39rem', color:'rgba(255,255,255,.28)', lineHeight:1.8 }}>
                <div style={{ color:ac2, fontSize:'.45rem', fontWeight:700 }}>{serial}</div>
                <div>{new Date().toLocaleDateString('es-CO', { timeZone:'America/Caracas' })}</div>
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ ...SM, fontSize:'.41rem', color:`${ac2}88`, letterSpacing:3, marginBottom:3 }}>PRIMER PREMIO</div>
              <div style={{ ...DS, fontSize:'1.28rem', color:txt, lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{premio}</div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 18px', flex:1 }}>

              <div style={{ borderLeft:`2px solid ${ac}40`, paddingLeft:9 }}>
                <div style={{ ...SM, fontSize:'.39rem', color:'rgba(255,255,255,.28)', letterSpacing:2, marginBottom:3 }}>SORTEO</div>
                <div style={{ ...DM, fontSize:'.77rem', fontWeight:600, color:txt }}>{fecha}</div>
                {hora && <div style={{ ...SM, fontSize:'.55rem', color:ac, marginTop:1 }}>{hora}</div>}
              </div>

              <div style={{ borderLeft:`2px solid ${ac2}40`, paddingLeft:9 }}>
                <div style={{ ...SM, fontSize:'.39rem', color:'rgba(255,255,255,.28)', letterSpacing:2, marginBottom:3 }}>VALOR</div>
                <div style={{ ...DS, fontSize:'.88rem', color:ac2 }}>{valor}</div>
              </div>

              {nom && (
                <div style={{ borderLeft:'2px solid rgba(255,255,255,.1)', paddingLeft:9 }}>
                  <div style={{ ...SM, fontSize:'.39rem', color:'rgba(255,255,255,.28)', letterSpacing:2, marginBottom:3 }}>COMPRADOR</div>
                  <div style={{ ...DM, fontSize:'.74rem', fontWeight:600, color:txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nom}</div>
                  {ced && <div style={{ ...SM, fontSize:'.41rem', color:'rgba(255,255,255,.28)' }}>C.I.: {ced}</div>}
                </div>
              )}

              {tel && (
                <div style={{ borderLeft:'2px solid rgba(255,255,255,.1)', paddingLeft:9 }}>
                  <div style={{ ...SM, fontSize:'.39rem', color:'rgba(255,255,255,.28)', letterSpacing:2, marginBottom:3 }}>TELÉFONO</div>
                  <div style={{ ...SM, fontSize:'.69rem', color:txt }}>{tel}</div>
                </div>
              )}
            </div>

            <div style={{ marginTop:10, paddingTop:6, borderTop:'1px solid rgba(255,255,255,.05)', ...SM, fontSize:'.37rem', color:'rgba(255,255,255,.18)', letterSpacing:1 }}>
              {d.footerText || ''}
            </div>
          </div>
        </div>

        {/* Franja inferior */}
        <div style={{ height:3, background:`linear-gradient(90deg,${ac2},${ac},${ac2})` }}></div>
      </div>

      {/* TALÓN */}
      <div style={{ background:tb, borderRadius:'0 0 14px 14px', overflow:'hidden', border:'1px solid #e0ddd5', borderTop:'none' }}>

        <div style={{ display:'flex', alignItems:'center', height:18, padding:'0 14px', borderTop:'2px dashed #ccc' }}>
          <div style={{ flex:1 }}></div>
          <div style={{ ...SM, fontSize:'.37rem', color:'#aaa', letterSpacing:3, padding:'0 8px', whiteSpace:'nowrap' }}>✂ &nbsp; TALÓN — QUEDA CON EL VENDEDOR &nbsp; ✂</div>
          <div style={{ flex:1 }}></div>
        </div>

        <div style={{ display:'flex', alignItems:'center', padding:'9px 14px', gap:14 }}>

          <div style={{ background:bg, borderRadius:8, padding:'7px 12px', textAlign:'center', flexShrink:0, minWidth:76 }}>
            <div style={{ ...SM, fontSize:'.35rem', color:`${ac}80`, letterSpacing:3, marginBottom:2 }}>N°</div>
            <div style={{ ...DS, fontSize:'1.9rem', color:ac, letterSpacing:5 }}>{numero || '000'}</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'3px 14px', flex:1 }}>
            {[
              { label:'NOMBRE',   val: nom,   font: DM,  sz:'.73rem', fw:700 },
              { label:'CÉDULA',   val: ced,   font: SM,  sz:'.64rem', fw:400 },
              { label:'TELÉFONO', val: tel,   font: SM,  sz:'.6rem',  fw:400 },
              { label:'SORTEO',   val: fecha + (hora ? ` · ${hora}` : ''), font: DM, sz:'.66rem', fw:600 },
              { label:'PREMIO',   val: premio, font: DM,  sz:'.66rem', fw:700 },
            ].map(({ label, val, font, sz, fw }) => (
              <div key={label}>
                <div style={{ ...SM, fontSize:'.35rem', color:'#aaa', letterSpacing:2, marginBottom:2 }}>{label}</div>
                <div style={{ ...font, fontSize:sz, fontWeight:fw, color:'#222', borderBottom:'1px solid #ccc', paddingBottom:2, minHeight:17, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</div>
              </div>
            ))}
            <div style={{ textAlign:'right' }}>
              <div style={{ ...SM, fontSize:'.33rem', color:'#bbb', letterSpacing:1 }}>{serial}</div>
              <div style={{ ...DS, fontSize:'.78rem', color:'#333' }}>{valor}</div>
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
  const FONTS = `@import url('${FONT_URL}');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#1a1a1a;display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px;}
    @media print{body{background:#fff;padding:4px;gap:8px;}@page{size:landscape;margin:5mm;}}`;

  const html = rifasArr.flatMap(r => [1, 2].map(c =>
    buildTicketHTML(d, r, numero, comprador, vendedor, c)
  )).join('\n');

  const win = window.open('', '_blank', 'width=780,height=650');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Boleto #${numero} — ${d.brandText}</title>
    <style>${FONTS}</style>
  </head><body>${html}
    <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},500);};<\/script>
  </body></html>`);
  win.document.close();
}

// ─────────────────────────────────────────────────────────────
//   Ticket — default export (carga diseño desde BD)
// ─────────────────────────────────────────────────────────────
export default function Ticket({ rifa, numero, comprador, vendedor, onClose }) {
  const rifasArr   = Array.isArray(rifa) ? rifa.filter(r => r.disponible !== false) : rifa ? [rifa] : [];
  const { design } = useTicketDesign();

  // ticket_design propio de la rifa tiene prioridad sobre el global
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