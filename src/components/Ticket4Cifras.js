// ══════════════════════════════════════════════════════════════
//   components/Ticket4Cifras.js
//   Boleto de las rifas de CUATRO CIFRAS (0000–9999)
//
//   Es un modelo aparte del boleto clásico: no usa sus posiciones, capas ni
//   colores. Tiene su propio diseño (plantillas con design.modelo = 'cuatro')
//   y su propio editor (pages/DisenoTicket4.js).
//
//   El número va en cuatro fichas, una por cifra, en el cuerpo y en el talón.
//   Se dibuja en una mesa fija de 780 × 340 y se escala al tamaño que pida
//   quien lo use, así sirve igual en pantalla, en la imagen que se manda por
//   WhatsApp y en la hoja de impresión.
// ══════════════════════════════════════════════════════════════
import React from 'react';

export const ANCHO_4 = 780;
export const ALTO_4  = 340;

// Temas listos. "papel" es claro, pensado para imprimir gastando poca tinta.
export const TEMAS_4 = {
  esmeralda: {
    nombre: 'Esmeralda', fondo1: '#06302d', fondo2: '#0c6f66', talon1: '#041f1d', talon2: '#08443f',
    acento: '#f6c71e', sobreAcento: '#1a1300', texto: '#ffffff', suave: 'rgba(255,255,255,.74)',
    ficha1: '#ffffff', ficha2: '#dcecea', fichaTexto: '#06302d', banda: 'rgba(0,0,0,.30)', brillo: 'rgba(255,255,255,.07)',
  },
  noche: {
    nombre: 'Noche dorada', fondo1: '#0a0a0e', fondo2: '#2a2a34', talon1: '#000000', talon2: '#18181e',
    acento: '#e9bb2a', sobreAcento: '#141000', texto: '#ffffff', suave: 'rgba(255,255,255,.70)',
    ficha1: '#fbeeb4', ficha2: '#e2ae1c', fichaTexto: '#151005', banda: 'rgba(255,255,255,.07)', brillo: 'rgba(233,187,42,.10)',
  },
  rubi: {
    nombre: 'Rubí', fondo1: '#5a0912', fondo2: '#b8212f', talon1: '#3b050b', talon2: '#7d1421',
    acento: '#ffd24a', sobreAcento: '#3b050b', texto: '#ffffff', suave: 'rgba(255,255,255,.78)',
    ficha1: '#ffffff', ficha2: '#ffe4e7', fichaTexto: '#5a0912', banda: 'rgba(0,0,0,.28)', brillo: 'rgba(255,255,255,.08)',
  },
  real: {
    nombre: 'Azul real', fondo1: '#0a1c56', fondo2: '#2459cf', talon1: '#06123b', talon2: '#123282',
    acento: '#ffd24a', sobreAcento: '#06123b', texto: '#ffffff', suave: 'rgba(255,255,255,.78)',
    ficha1: '#ffffff', ficha2: '#dfe8ff', fichaTexto: '#0a1c56', banda: 'rgba(0,0,0,.28)', brillo: 'rgba(255,255,255,.08)',
  },
  papel: {
    nombre: 'Papel (ahorra tinta)', fondo1: '#ffffff', fondo2: '#f5f0df', talon1: '#f3eedc', talon2: '#e9e2c9',
    acento: '#a8760a', sobreAcento: '#ffffff', texto: '#1b1b1b', suave: 'rgba(0,0,0,.62)',
    ficha1: '#232323', ficha2: '#3d3d3d', fichaTexto: '#ffffff', banda: 'rgba(0,0,0,.055)', brillo: 'rgba(168,118,10,.07)',
  },
};

export const DEFAULT_DESIGN_4 = {
  modelo: 'cuatro',
  ticketWidth: ANCHO_4,
  ticketHeight: ALTO_4,
  tema: 'esmeralda',
  colores: {},                     // cambios puntuales sobre el tema: { fondo1, fondo2, acento }
  estiloDigitos: 'fichas',         // 'fichas' (tarjetas) | 'bolas' (bolas de lotería)
  logo: null,                      // URL de la imagen del negocio (opcional)
  brandText: 'GRAN RIFA',
  sloganTop: 'RESUELVE TU SEMANA',
  premioLabel: 'PREMIO MAYOR',
  fechaPrefix: 'JUEGA EL',
  loteriaText: '',                 // se usa si la rifa no tiene lotería cargada
  valorSufijo: 'PESOS',
  motivacionalText: '¡Cuatro cifras, un solo ganador!',
  caducaText: 'Caduca a los 8 días',
  footerText: 'Conserve este boleto · Válido solo con número legible',
  talonText: 'BOLETO SIN CANCELAR NO JUEGA',
  mostrarTalon: true,
  mostrarValor: true,
  mostrarPremiosExtra: true,       // 2.º y 3.er premio de la rifa
  mostrarPosiciones: true,         // "millar · centena · decena · unidad" bajo las fichas
};

// ¿Este boleto es del modelo de cuatro cifras? (por la plantilla, por la rifa o por el número)
export const esBoleto4 = (r, numero, design) =>
  design?.modelo === 'cuatro' || Number(r?.cifras) === 4 || /^\d{4}$/.test(String(numero ?? '').trim());

// Diseño final: lo de la plantilla solo cuenta si es una plantilla de cuatro cifras
export const disenoCuatro = (design) => ({ ...DEFAULT_DESIGN_4, ...(design?.modelo === 'cuatro' ? design : {}), modelo: 'cuatro' });

const TITULOS = "'Bebas Neue', 'Anton', Impact, 'Arial Narrow Bold', sans-serif";
const TEXTOS  = "'Poppins', 'Segoe UI', Arial, sans-serif";
const MESES   = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS    = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const POSICIONES = ['MILLAR', 'CENTENA', 'DECENA', 'UNIDAD'];

const cuatroCifras = (n) => String(n ?? '').replace(/\D/g, '').padStart(4, '0').slice(-4);
const miles = (n) => (Number(n) > 0 ? Math.round(Number(n)).toLocaleString('es-CO') : '');
const con = (color, alfa) => {   // #rrggbb → rgba()
  const m = /^#?([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!m) return color;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alfa})`;
};
function partesFecha(f) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { dia: m[3], mes: MESES[d.getMonth()], anio: m[1], semana: DIAS[d.getDay()] };
}
function hora12(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  if (!m) return '';
  const hh = Number(m[1]);
  return `${((hh + 11) % 12) + 1}:${m[2]} ${hh < 12 ? 'AM' : 'PM'}`;
}

// Una cifra del número
function Ficha({ cifra, T, estilo, chica = false }) {
  if (estilo === 'bolas') {
    const d = chica ? 30 : 72;
    return (
      <div style={{
        width: d, height: d, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${T.ficha1} 34%, ${T.ficha2} 100%)`,
        border: `${chica ? 1.5 : 3}px solid ${T.acento}`, boxShadow: chica ? 'none' : '0 6px 10px rgba(0,0,0,.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: TITULOS, fontSize: chica ? 21 : 50, lineHeight: 1, color: T.fichaTexto, paddingTop: chica ? 2 : 4, boxSizing: 'border-box',
      }}>{cifra}</div>
    );
  }
  const w = chica ? 30 : 62, h = chica ? 40 : 86;
  return (
    <div style={{
      width: w, height: h, borderRadius: chica ? 6 : 11, flexShrink: 0, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      background: `linear-gradient(180deg, ${T.ficha1} 0%, ${T.ficha1} 49%, ${T.ficha2} 51%, ${T.ficha2} 100%)`,
      border: `${chica ? 1.5 : 2.5}px solid ${T.acento}`, boxShadow: chica ? 'none' : '0 7px 0 rgba(0,0,0,.26)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: TITULOS, fontSize: chica ? 30 : 74, lineHeight: 1, color: T.fichaTexto, paddingTop: chica ? 3 : 6,
    }}>
      {cifra}
      {/* corte del medio, como las fichas de un marcador */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(0,0,0,.16)' }} />
    </div>
  );
}

export default function Ticket4Cifras({ r, numero, design }) {
  const D = disenoCuatro(design);
  const T = { ...(TEMAS_4[D.tema] || TEMAS_4.esmeralda), ...(D.colores || {}) };

  // Tamaño que espera quien lo dibuja; la mesa de 780 × 340 se escala para caber
  const W = Number(design?.ticketWidth) || ANCHO_4;
  const H = Number(design?.ticketHeight) || ALTO_4;
  const escala = Math.min(W / ANCHO_4, H / ALTO_4);

  const cifras = cuatroCifras(design?.numBoleto ?? numero).split('');
  const premio = String(r?.premio || 'PREMIO').trim().toUpperCase();
  const extras = [];
  if (D.mostrarPremiosExtra) {
    if (r?.premio_segundo) extras.push(`2.º PREMIO: ${String(r.premio_segundo).toUpperCase()}`);
    if (r?.premio_tercero) extras.push(`3.º: ${String(r.premio_tercero).toUpperCase()}`);
    if (!extras.length && Number(r?.premio_secundario) > 0) extras.push(`Ó ${miles(r.premio_secundario)} ${D.valorSufijo}`);
  }
  // Un premio largo va en dos líneas en vez de achicarse hasta no leerse
  const premioLargo = premio.length > 26;
  const tamPremio = premio.length <= 12 ? 56 : premio.length <= 18 ? 48 : !premioLargo ? 38 : extras.length ? 27 : 33;
  const fecha = partesFecha(r?.fecha_sorteo);
  const hora = hora12(r?.hora_sorteo);
  const loteria = String(r?.loteria_ref || D.loteriaText || '').trim();
  const valor = miles(r?.precio);

  const TW = D.mostrarTalon === false ? 0 : 168;   // ancho del talón
  const etiqueta = { fontFamily: TEXTOS, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.2, color: T.suave, textTransform: 'uppercase' };
  const tarjeta = { width: 118, flexShrink: 0, background: T.banda, borderRadius: 10, padding: '9px 8px', textAlign: 'center', boxSizing: 'border-box' };

  return (
    <div data-ticket-canvas="true" data-modelo="cuatro"
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: T.fondo1 }}>
      <div style={{
        position: 'absolute', left: (W - ANCHO_4 * escala) / 2, top: (H - ALTO_4 * escala) / 2, width: ANCHO_4, height: ALTO_4,
        transform: `scale(${escala})`, transformOrigin: 'top left', fontFamily: TEXTOS, color: T.texto, overflow: 'hidden',
      }}>

        {/* ═══ TALÓN (lo que se queda el vendedor) ═══ */}
        {TW > 0 && (
          <div style={{
            position: 'absolute', left: 0, top: 0, width: TW, height: ALTO_4, boxSizing: 'border-box',
            background: `linear-gradient(180deg, ${T.talon1}, ${T.talon2})`, borderRight: `2px dashed ${con(T.acento, 0.85)}`,
          }}>
            <div style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: TITULOS, fontSize: 17, letterSpacing: 6, color: T.acento, lineHeight: 1 }}>TALÓN</div>
              <div style={{ ...etiqueta, fontSize: 6, letterSpacing: 1.6, marginTop: 3 }}>{D.brandText}</div>
            </div>
            <div style={{ position: 'absolute', top: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
              {cifras.map((c, i) => <Ficha key={i} cifra={c} T={T} estilo={D.estiloDigitos} chica />)}
            </div>
            <div style={{ position: 'absolute', top: 104, left: 14, right: 14 }}>
              {['Nombre', 'Teléfono', 'Vendedor'].map((campo) => (
                <div key={campo} style={{ marginBottom: 9 }}>
                  <div style={{ ...etiqueta, fontSize: 6, letterSpacing: 1.4 }}>{campo}</div>
                  <div style={{ height: 15, borderBottom: `1px solid ${T.suave}` }} />
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', top: 204, left: 14, right: 14, fontSize: 7.5, fontWeight: 700, lineHeight: 1.55, color: T.texto }}>
              {fecha && <div>JUEGA: {fecha.dia} {fecha.mes} {fecha.anio}{hora ? ` · ${hora}` : ''}</div>}
              {valor && D.mostrarValor !== false && <div>VALOR: {valor} {D.valorSufijo}</div>}
            </div>
            <div style={{ position: 'absolute', bottom: 14, left: 12, right: 12, textAlign: 'center', fontSize: 7, fontWeight: 800, letterSpacing: 0.8, lineHeight: 1.3, color: T.acento }}>
              {D.talonText}
            </div>
          </div>
        )}

        {/* ═══ CUERPO ═══ */}
        <div style={{ position: 'absolute', left: TW, top: 0, width: ANCHO_4 - TW, height: ALTO_4, overflow: 'hidden', background: `linear-gradient(135deg, ${T.fondo1} 0%, ${T.fondo2} 100%)` }}>
          {/* brillos de fondo */}
          <div style={{ position: 'absolute', right: -70, top: -110, width: 300, height: 300, borderRadius: '50%', background: T.brillo }} />
          <div style={{ position: 'absolute', left: -110, bottom: -150, width: 280, height: 280, borderRadius: '50%', border: `30px solid ${T.brillo}`, boxSizing: 'border-box' }} />
          {/* marco */}
          <div style={{ position: 'absolute', left: 7, top: 7, right: 7, bottom: 7, border: `1.5px solid ${con(T.acento, 0.6)}`, borderRadius: 10 }} />

          {/* cabecera: marca y valor */}
          <div style={{ position: 'absolute', top: 17, left: 22, right: 22, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              {D.logo && <img src={D.logo} alt="" crossOrigin="anonymous" style={{ height: 34, maxWidth: 92, objectFit: 'contain', flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: TITULOS, fontSize: 30, letterSpacing: 2.5, lineHeight: '28px', color: T.acento, whiteSpace: 'nowrap' }}>{D.brandText}</div>
                {D.sloganTop && <div style={{ ...etiqueta, letterSpacing: 2.6, marginTop: 1, whiteSpace: 'nowrap' }}>{D.sloganTop}</div>}
              </div>
            </div>
            {valor && D.mostrarValor !== false && (
              <div style={{ background: T.acento, color: T.sobreAcento, borderRadius: 8, padding: '3px 12px 2px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: 2.2, lineHeight: 1.2 }}>VALOR DEL BOLETO</div>
                <div style={{ fontFamily: TITULOS, fontSize: 21, letterSpacing: 1, lineHeight: '21px' }}>{valor} {D.valorSufijo}</div>
              </div>
            )}
          </div>

          {/* premio */}
          <div style={{ position: 'absolute', top: 60, left: 22, right: 22, textAlign: 'center' }}>
            <div style={{ ...etiqueta, letterSpacing: 4.5 }}>★ {D.premioLabel} ★</div>
            <div style={{ fontFamily: TITULOS, fontSize: tamPremio, lineHeight: 1.02, letterSpacing: 1.5, color: T.texto, whiteSpace: premioLargo ? 'normal' : 'nowrap', overflow: 'hidden', maxHeight: premioLargo ? tamPremio * 2.1 : undefined, textShadow: '0 2px 0 rgba(0,0,0,.28)' }}>{premio}</div>
            {extras.length > 0 && (
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: T.acento, whiteSpace: 'nowrap', overflow: 'hidden' }}>{extras.join('   ·   ')}</div>
            )}
          </div>

          {/* fecha · LAS CUATRO CIFRAS · lotería */}
          <div style={{ position: 'absolute', top: 150, left: 22, right: 22, height: 112, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={tarjeta}>
              <div style={etiqueta}>{D.fechaPrefix}</div>
              {fecha ? (
                <>
                  <div style={{ fontFamily: TITULOS, fontSize: 42, lineHeight: '40px', color: T.acento }}>{fecha.dia}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6 }}>{fecha.mes} {fecha.anio}</div>
                  <div style={{ fontSize: 7.5, fontWeight: 700, color: T.suave, letterSpacing: 0.8 }}>{fecha.semana}</div>
                </>
              ) : <div style={{ fontSize: 10, fontWeight: 700, marginTop: 14 }}>POR DEFINIR</div>}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ ...etiqueta, letterSpacing: 4, marginBottom: 5 }}>TU NÚMERO DE LA SUERTE</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {cifras.map((c, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <Ficha cifra={c} T={T} estilo={D.estiloDigitos} />
                    {D.mostrarPosiciones !== false && (
                      <div style={{ fontSize: 5.6, fontWeight: 800, letterSpacing: 1, color: T.suave, marginTop: D.estiloDigitos === 'bolas' ? 6 : 10 }}>{POSICIONES[i]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={tarjeta}>
              <div style={etiqueta}>LOTERÍA</div>
              <div style={{ fontSize: loteria.length > 22 ? 9.5 : 11.5, fontWeight: 800, lineHeight: 1.2, margin: '6px 0 5px', minHeight: 28 }}>{loteria || 'POR DEFINIR'}</div>
              {hora && <div style={{ display: 'inline-block', background: T.acento, color: T.sobreAcento, borderRadius: 20, padding: '2px 10px', fontFamily: TITULOS, fontSize: 15, letterSpacing: 1, lineHeight: '17px' }}>{hora}</div>}
            </div>
          </div>

          {/* pie */}
          <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 40, background: T.banda, borderRadius: '0 0 9px 9px', borderTop: `1px dashed ${con(T.acento, 0.55)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', boxSizing: 'border-box', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.6, whiteSpace: 'nowrap' }}>{D.caducaText}</div>
              <div style={{ fontSize: 6.3, fontWeight: 600, color: T.suave, whiteSpace: 'nowrap', overflow: 'hidden' }}>{D.footerText}</div>
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 700, fontStyle: 'italic', color: T.acento, textAlign: 'center', flex: 1.1, lineHeight: 1.25 }}>{D.motivacionalText}</div>
            <div style={{ flex: 1, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: 2, color: T.suave, marginRight: 6 }}>BOLETO N.º</span>
              <span style={{ fontFamily: TITULOS, fontSize: 25, letterSpacing: 4, lineHeight: '25px', verticalAlign: 'middle' }}>{cifras.join('')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
