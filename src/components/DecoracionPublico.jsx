// ============================================================
//  DecoracionPublico.jsx — Página del cliente
//  La decoración de la fecha (Navidad, Halloween...): colores,
//  fondo, banner, guirnalda, esquinas y lo que cae por la pantalla.
//  Se arma en el panel (Decoración); sin decoración no se pinta nada.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { CANTIDAD_EFECTO, CLAVE_CACHE, CLAVE_VISTA, cssDecoracion, esquinaSvg, fondoDecoracion, guirnaldaSvg, optimizada } from '../utils/decoracion';

const ESTILOS = `
.deco-fondo { position:fixed; inset:0; z-index:-1; pointer-events:none; }
.deco-superior { position:relative; z-index:1; }
.deco-banner img { display:block; width:100%; height:auto; }
.deco-orla { position:relative; height:0; pointer-events:none; }
.deco-guirnalda { position:absolute; top:0; left:0; right:0; height:46px; background-repeat:repeat-x; background-position:top center; background-size:auto 100%; }
.deco-esquina { position:absolute; top:0; width:clamp(92px,15vw,200px); height:clamp(92px,15vw,200px); background:top left/contain no-repeat; }
.deco-esquina.izq { left:0; }
.deco-esquina.der { right:0; transform:scaleX(-1); }
.deco-superior + .pub-intro .pub-bolas { display:none; }
.deco-superior.con-guirnalda + .pub-intro { padding-top:58px; }
.deco-efecto { position:fixed; inset:0; z-index:90; overflow:hidden; pointer-events:none; }
.deco-efecto i { position:absolute; top:-8vh; display:block; font-style:normal; line-height:1; will-change:transform; animation:decoCae linear infinite; }
.deco-efecto img { display:block; width:100%; height:auto; }
.deco-efecto .deco-confeti { width:.55em; height:.9em; border-radius:2px; }
.deco-efecto .deco-petalo { width:.8em; height:1em; border-radius:80% 0 80% 0; opacity:.8; }
@keyframes decoCae {
  from { transform:translate3d(0,0,0) rotate(0deg); }
  to   { transform:translate3d(var(--deriva),118vh,0) rotate(var(--giro)); }
}
@media (max-width:640px) {
  .deco-guirnalda { height:34px; }
  .deco-superior.con-guirnalda + .pub-intro { padding-top:44px; }
}
`;

const leer = (clave) => {
  try { return JSON.parse(localStorage.getItem(clave)) || null; } catch { return null; }
};

// La decoración que toca: la que manda el servidor, o en la vista previa del
// panel la que se está editando. La última vista evita el parpadeo al entrar.
export function useDecoracion(servidor) {
  const esVista = useMemo(() => new URLSearchParams(window.location.search).has('vista_decoracion'), []);
  const [previa, setPrevia] = useState(() => (esVista ? leer(CLAVE_VISTA) : null));
  const [cache] = useState(() => leer(CLAVE_CACHE));

  useEffect(() => {
    if (!esVista) return undefined;
    const alCambiar = (e) => { if (e.key === CLAVE_VISTA) setPrevia(leer(CLAVE_VISTA)); };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [esVista]);

  useEffect(() => {
    if (esVista || servidor === undefined) return;
    try {
      if (servidor) localStorage.setItem(CLAVE_CACHE, JSON.stringify(servidor));
      else localStorage.removeItem(CLAVE_CACHE);
    } catch {}
  }, [esVista, servidor]);

  if (esVista) return previa;
  return servidor === undefined ? cache : servidor;
}

// Colores y fondo
export function DecoracionFondo({ decoracion: d }) {
  if (!d) return null;
  return (
    <>
      <style>{ESTILOS}{cssDecoracion(d)}</style>
      {d.img_fondo && <div className="deco-fondo" aria-hidden="true" style={{ background: fondoDecoracion(d, optimizada(d.img_fondo, window.innerWidth > 800 ? 1920 : 900)) }} />}
    </>
  );
}

// Banner, guirnalda y adornos de las esquinas
export function DecoracionSuperior({ decoracion: d }) {
  if (!d) return null;
  const banner = d.img_banner_pc || d.img_banner_movil;
  const guirnalda = d.img_guirnalda ? `url("${optimizada(d.img_guirnalda, 1200)}")` : guirnaldaSvg(d);
  const izq = d.img_esquina_izq || d.img_esquina_der;
  const der = d.img_esquina_der || d.img_esquina_izq;
  const esquinaIzq = izq ? `url("${optimizada(izq, 500)}")` : esquinaSvg(d);
  const esquinaDer = der ? `url("${optimizada(der, 500)}")` : esquinaSvg(d);
  if (!banner && !guirnalda && !esquinaIzq) return null;
  return (
    <div className={`deco-superior${guirnalda ? ' con-guirnalda' : ''}`}>
      {banner && (
        <picture className="deco-banner">
          <source media="(max-width:640px)" srcSet={optimizada(d.img_banner_movil || d.img_banner_pc, 1080)} />
          <img src={optimizada(d.img_banner_pc || d.img_banner_movil, 1920)} alt={d.mensaje || d.nombre} />
        </picture>
      )}
      <div className="deco-orla" aria-hidden="true">
        {esquinaIzq && <div className="deco-esquina izq" style={{ backgroundImage: esquinaIzq }} />}
        {esquinaDer && <div className="deco-esquina der" style={{ backgroundImage: esquinaDer }} />}
        {guirnalda && <div className="deco-guirnalda" style={{ backgroundImage: guirnalda }} />}
      </div>
    </div>
  );
}

const azar = (min, max) => min + Math.random() * (max - min);

function pieza(d, i) {
  switch (d.efecto) {
    case 'nieve':       return { clase: 'deco-nieve', txt: '❄︎' };
    case 'estrellas':   return { txt: '✦', color: d.color2 };
    case 'corazones':   return { txt: '❤︎', color: i % 2 ? d.color1 : d.color2 };
    case 'murcielagos': return { txt: '🦇' };
    case 'confeti':     return { clase: 'deco-confeti', fondo: i % 3 === 0 ? d.color1 : i % 3 === 1 ? d.color2 : '#ffffff' };
    case 'petalos':     return { clase: 'deco-petalo', fondo: i % 2 ? d.color1 : d.color2 };
    default:            return {};
  }
}

// Nieve, confeti, murciélagos... o la imagen que suba el dueño
export function EfectoDecoracion({ decoracion: d }) {
  const efecto = d && (d.efecto !== 'imagen' || d.img_efecto) ? d.efecto : 'ninguno';
  const intensidad = d?.intensidad;
  const color1 = d?.color1, color2 = d?.color2, imagen = d?.img_efecto;

  const piezas = useMemo(() => {
    if (efecto === 'ninguno') return [];
    const total = Math.round((CANTIDAD_EFECTO[intensidad] || CANTIDAD_EFECTO.media) * (window.innerWidth < 640 ? 0.6 : 1));
    return Array.from({ length: total }, (_, i) => {
      const duracion = azar(9, 19);
      return {
        i, ...pieza({ efecto, color1, color2 }, i),
        estilo: {
          left: `${azar(0, 100)}%`,
          fontSize: `${azar(13, 26)}px`,
          animationDuration: `${duracion}s`,
          animationDelay: `-${azar(0, duracion)}s`,   // ya vienen cayendo al abrir la página
          '--deriva': `${azar(-70, 70)}px`,
          '--giro': `${azar(-300, 300)}deg`,
        },
      };
    });
  }, [efecto, intensidad, color1, color2]);

  const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!piezas.length || sinMovimiento) return null;
  return (
    <div className="deco-efecto" aria-hidden="true">
      {piezas.map((p) => (
        <i key={p.i} className={p.clase} style={{ ...p.estilo, color: p.color, background: p.fondo, ...(efecto === 'imagen' ? { width: '2.1em' } : {}) }}>
          {efecto === 'imagen' ? <img src={optimizada(imagen, 120)} alt="" /> : p.txt}
        </i>
      ))}
    </div>
  );
}
