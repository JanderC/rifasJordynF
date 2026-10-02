// ============================================================
//  GanadoresPublico.jsx — Galería de ganadores en la página del cliente
//  Las fotos y datos los carga el dueño en Configuración → Ganadores.
//  Si no hay ganadores visibles, la sección no aparece.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';

const ORO  = '#ffc93c';
const ORO2 = '#ff9f1c';
const TURQ = '#0abfbc';

const PRIMEROS = 8;   // tarjetas del catálogo antes de "Ver todos"

// Cloudinary entrega la foto ya recortada y liviana según dónde se muestre
const img = (url, t) => (url && url.includes('/upload/') ? url.replace('/upload/', `/upload/${t}/`) : url);
const miniatura = (url) => img(url, 'f_auto,q_auto,c_fill,g_auto,w_600,h_750');
const grande    = (url) => img(url, 'f_auto,q_auto,c_limit,w_1400,h_1400');

const fmtFecha = (f) => {
  if (!f) return null;
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Caracas' });
};

const ESTILOS = `
/* Con el enlace "Ganadores" el menú tiene 4 opciones: que quepa en el teléfono */
@media (max-width: 520px) { .pub-nav-links { gap:12px !important; } .pub-nav-links .nav-link { font-size:.78rem; } }

.gan-sec { position:relative; overflow:hidden; margin-top:70px; padding:80px 5vw 90px; scroll-margin-top:64px;
  background: radial-gradient(1200px 500px at 50% -10%, rgba(255,201,60,.22), transparent 60%),
              radial-gradient(700px 400px at 100% 100%, rgba(10,191,188,.25), transparent 60%),
              linear-gradient(160deg,#0b1f1f 0%,#102b2b 55%,#0a1818 100%);
  font-family:'Poppins',sans-serif; }
.gan-wrap { position:relative; z-index:2; max-width:1100px; margin:0 auto; }

/* Confeti cayendo */
.gan-confeti { position:absolute; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.gan-confeti i { position:absolute; top:-20px; width:9px; height:15px; border-radius:2px; opacity:.85;
  animation: ganCae linear infinite; }
@keyframes ganCae { 0% { transform:translateY(-20px) rotate(0deg); } 100% { transform:translateY(1400px) rotate(720deg); } }

/* Encabezado */
.gan-chip { display:inline-flex; align-items:center; gap:8px; padding:7px 16px; border-radius:40px;
  background:rgba(255,201,60,.12); border:1px solid rgba(255,201,60,.45); color:${ORO};
  font-size:.68rem; font-weight:700; letter-spacing:2px; text-transform:uppercase; }
.gan-chip b { width:8px; height:8px; border-radius:50%; background:${ORO}; animation: ganPulso 1.4s ease-in-out infinite; }
@keyframes ganPulso { 0%,100% { box-shadow:0 0 0 0 rgba(255,201,60,.7); } 50% { box-shadow:0 0 0 8px rgba(255,201,60,0); } }
.gan-titulo { margin:18px 0 10px; font-size:clamp(2.3rem,6vw,4rem); font-weight:900; line-height:1.05; letter-spacing:-1px;
  background:linear-gradient(100deg,#fff 0%,${ORO} 30%,#fff7d6 50%,${ORO2} 70%,#fff 100%); background-size:220% 100%;
  -webkit-background-clip:text; background-clip:text; color:transparent; animation: ganBrillo 5s linear infinite; }
@keyframes ganBrillo { to { background-position:-220% 0; } }
.gan-sub { color:rgba(255,255,255,.72); font-size:1rem; max-width:560px; margin:0 auto; line-height:1.6; }
.gan-cifras { display:flex; justify-content:center; gap:14px; flex-wrap:wrap; margin-top:26px; }
.gan-cifra { padding:12px 22px; border-radius:16px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); text-align:center; }
.gan-cifra strong { display:block; font-size:1.7rem; font-weight:900; color:${ORO}; line-height:1.1; }
.gan-cifra span { font-size:.66rem; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,.6); font-weight:600; }

/* Ganador destacado (el más reciente) */
.gan-dest { position:relative; margin:48px auto 0; border-radius:30px; padding:3px; cursor:pointer;
  background:conic-gradient(from var(--gan-ang,0deg), ${ORO}, ${TURQ}, #ff5e7e, ${ORO2}, ${ORO});
  animation: ganGira 6s linear infinite; box-shadow:0 30px 80px rgba(0,0,0,.5), 0 0 60px rgba(255,201,60,.25); }
@property --gan-ang { syntax:'<angle>'; initial-value:0deg; inherits:false; }
@keyframes ganGira { to { --gan-ang:360deg; } }
.gan-dest-in { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); border-radius:27px; overflow:hidden; background:#0d2424; }
.gan-dest-foto { position:relative; min-height:420px; background:#081414; overflow:hidden; }
.gan-dest-foto img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .8s ease; }
.gan-dest:hover .gan-dest-foto img { transform:scale(1.05); }
.gan-cinta { position:absolute; top:18px; left:18px; z-index:2; padding:8px 16px; border-radius:40px;
  background:linear-gradient(135deg,${ORO},${ORO2}); color:#3a2400; font-size:.7rem; font-weight:900; letter-spacing:1.5px;
  box-shadow:0 8px 24px rgba(255,159,28,.5); }
.gan-dest-txt { padding:44px 40px; display:flex; flex-direction:column; justify-content:center; gap:16px; }
.gan-dest-txt .gan-trofeo { font-size:3rem; line-height:1; animation: ganSalta 2.4s ease-in-out infinite; transform-origin:bottom center; display:inline-block; }
@keyframes ganSalta { 0%,100% { transform:translateY(0) rotate(-4deg); } 50% { transform:translateY(-8px) rotate(4deg); } }
.gan-dest-nombre { font-size:clamp(1.7rem,3.4vw,2.6rem); font-weight:900; color:#fff; line-height:1.1; margin:0; }
.gan-dest-premio { font-size:clamp(1.05rem,2vw,1.35rem); font-weight:800; color:${ORO}; }
.gan-datos { display:flex; flex-wrap:wrap; gap:10px; }
.gan-dato { padding:7px 14px; border-radius:12px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.13);
  color:rgba(255,255,255,.85); font-size:.8rem; font-weight:600; }
.gan-bola { display:inline-flex; align-items:center; gap:10px; }
.gan-bola b { display:inline-flex; align-items:center; justify-content:center; min-width:64px; height:64px; padding:0 14px; border-radius:40px;
  background:radial-gradient(circle at 30% 25%, #fff6c9, ${ORO} 45%, ${ORO2}); color:#3a2400; font-size:1.5rem; font-weight:900; letter-spacing:1px;
  box-shadow:0 10px 30px rgba(255,159,28,.45), inset 0 -4px 8px rgba(0,0,0,.15); }
.gan-bola span { font-size:.66rem; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,.6); font-weight:700; }

/* Catálogo */
.gan-cat-tit { display:flex; align-items:center; gap:14px; margin:60px 0 24px; color:#fff; font-size:1.25rem; font-weight:800; }
.gan-cat-tit::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(255,201,60,.6),transparent); }
.gan-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:22px; }
.gan-card { position:relative; border:none; padding:0; text-align:left; cursor:pointer; border-radius:22px; overflow:hidden; aspect-ratio:4/5;
  background:#081414; box-shadow:0 14px 40px rgba(0,0,0,.4); transition:transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s;
  animation: ganEntra .6s both; font-family:inherit; }
@keyframes ganEntra { from { opacity:0; transform:translateY(24px) scale(.96); } to { opacity:1; transform:none; } }
.gan-card:hover { transform:translateY(-8px) rotate(-.6deg); box-shadow:0 26px 60px rgba(0,0,0,.55), 0 0 0 2px ${ORO}, 0 0 40px rgba(255,201,60,.35); }
.gan-card img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .7s ease; }
.gan-card:hover img { transform:scale(1.09); }
.gan-card::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(4,16,16,.55) 62%,rgba(4,16,16,.96) 100%); }
/* Destello que cruza la tarjeta al pasar el cursor */
.gan-card::before { content:''; position:absolute; z-index:2; top:0; left:-80%; width:50%; height:100%; transform:skewX(-20deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent); transition:left .7s ease; }
.gan-card:hover::before { left:130%; }
.gan-card-num { position:absolute; z-index:3; top:14px; right:14px; padding:6px 13px; border-radius:30px;
  background:radial-gradient(circle at 30% 25%, #fff6c9, ${ORO} 50%, ${ORO2}); color:#3a2400; font-size:.95rem; font-weight:900;
  box-shadow:0 6px 18px rgba(255,159,28,.5); }
.gan-card-txt { position:absolute; z-index:3; left:0; right:0; bottom:0; padding:18px; }
.gan-card-nombre { color:#fff; font-size:1.08rem; font-weight:800; line-height:1.2; margin-bottom:5px; }
.gan-card-premio { color:${ORO}; font-size:.86rem; font-weight:700; line-height:1.3; }
.gan-card-meta { color:rgba(255,255,255,.6); font-size:.72rem; margin-top:6px; }

.gan-mas { display:block; margin:36px auto 0; padding:14px 34px; border-radius:40px; border:none; cursor:pointer;
  background:linear-gradient(135deg,${ORO},${ORO2}); color:#3a2400; font-family:inherit; font-size:.95rem; font-weight:800;
  box-shadow:0 12px 34px rgba(255,159,28,.4); transition:transform .2s, box-shadow .2s; }
.gan-mas:hover { transform:translateY(-3px); box-shadow:0 18px 44px rgba(255,159,28,.55); }

/* Visor de la foto en grande */
.gan-visor { position:fixed; inset:0; z-index:2000; background:rgba(3,12,12,.94); backdrop-filter:blur(8px);
  display:flex; align-items:center; justify-content:center; padding:20px; animation: ganFade .25s both; font-family:'Poppins',sans-serif; }
@keyframes ganFade { from { opacity:0; } to { opacity:1; } }
.gan-visor-caja { max-width:920px; width:100%; max-height:100%; display:flex; flex-direction:column; align-items:center; gap:16px; }
.gan-visor img { max-width:100%; max-height:68vh; border-radius:18px; object-fit:contain; box-shadow:0 30px 80px rgba(0,0,0,.6), 0 0 0 2px rgba(255,201,60,.5); }
.gan-visor-txt { text-align:center; color:#fff; }
.gan-visor-txt h3 { font-size:1.5rem; font-weight:900; margin:0 0 4px; }
.gan-visor-txt p { margin:0; color:${ORO}; font-weight:700; }
.gan-visor-txt small { display:block; margin-top:6px; color:rgba(255,255,255,.6); font-size:.8rem; }
.gan-visor-btn { position:absolute; width:48px; height:48px; border-radius:50%; border:1px solid rgba(255,255,255,.25);
  background:rgba(255,255,255,.1); color:#fff; font-size:1.4rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; }
.gan-visor-btn:hover { background:rgba(255,201,60,.35); }
.gan-visor-x { top:18px; right:18px; }
.gan-visor-ant { left:18px; top:50%; transform:translateY(-50%); }
.gan-visor-sig { right:18px; top:50%; transform:translateY(-50%); }

@media (max-width: 760px) {
  .gan-sec { padding:60px 5vw 70px; margin-top:50px; }
  .gan-dest-in { grid-template-columns:1fr; }
  .gan-dest-foto { min-height:340px; }
  .gan-dest-txt { padding:28px 22px 32px; }
  .gan-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .gan-card { border-radius:16px; }
  .gan-card-txt { padding:12px; }
  .gan-card-nombre { font-size:.9rem; }
  .gan-card-premio { font-size:.74rem; }
  .gan-visor-ant { left:8px; } .gan-visor-sig { right:8px; }
}
@media (prefers-reduced-motion: reduce) {
  .gan-confeti { display:none; }
  .gan-titulo, .gan-dest, .gan-card, .gan-chip b, .gan-dest-txt .gan-trofeo { animation:none; }
}
`;

// Confeti fijo (posiciones estables entre renders)
const COLORES = [ORO, ORO2, TURQ, '#ff5e7e', '#ffffff', '#7ee8a2'];
const CONFETI = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  background: COLORES[i % COLORES.length],
  animationDuration: `${7 + (i % 7) * 1.3}s`,
  animationDelay: `${-((i * 1.7) % 9)}s`,
  transform: `scale(${0.6 + (i % 4) * 0.2})`,
}));

function Visor({ lista, indice, onCerrar, onMover }) {
  const g = lista[indice];

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') onMover(1);
      if (e.key === 'ArrowLeft') onMover(-1);
    };
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = ''; };
  }, [onCerrar, onMover]);

  if (!g) return null;
  const meta = [g.rifa, g.ciudad, fmtFecha(g.fecha)].filter(Boolean).join(' · ');
  return (
    <div className="gan-visor" onClick={onCerrar} role="dialog" aria-modal="true" aria-label={`Foto de ${g.nombre}`}>
      <button className="gan-visor-btn gan-visor-x" onClick={onCerrar} aria-label="Cerrar">✕</button>
      {lista.length > 1 && (
        <>
          <button className="gan-visor-btn gan-visor-ant" onClick={(e) => { e.stopPropagation(); onMover(-1); }} aria-label="Anterior">‹</button>
          <button className="gan-visor-btn gan-visor-sig" onClick={(e) => { e.stopPropagation(); onMover(1); }} aria-label="Siguiente">›</button>
        </>
      )}
      <div className="gan-visor-caja" onClick={(e) => e.stopPropagation()}>
        <img src={grande(g.imagen_url)} alt={`${g.nombre}, ganador${g.premio ? ` de ${g.premio}` : ''}`} />
        <div className="gan-visor-txt">
          <h3>🏆 {g.nombre}</h3>
          {g.premio && <p>{g.premio}{g.numero ? ` · Número ${g.numero}` : ''}</p>}
          {!g.premio && g.numero && <p>Número {g.numero}</p>}
          {meta && <small>{meta}</small>}
        </div>
      </div>
    </div>
  );
}

export default function GanadoresPublico({ ganadores }) {
  const [verTodos, setVerTodos] = useState(false);
  const [abierto, setAbierto]   = useState(null);   // índice en `ganadores`

  const cerrar = useCallback(() => setAbierto(null), []);
  const mover  = useCallback((d) => setAbierto((i) => (i == null ? i : (i + d + ganadores.length) % ganadores.length)), [ganadores.length]);

  if (!ganadores?.length) return null;

  const [destacado, ...resto] = ganadores;
  const catalogo = verTodos ? resto : resto.slice(0, PRIMEROS);
  const ciudades = new Set(ganadores.map((g) => g.ciudad).filter(Boolean)).size;

  return (
    <section id="ganadores-sec" className="gan-sec">
      <style>{ESTILOS}</style>
      <div className="gan-confeti" aria-hidden="true">
        {CONFETI.map((c, i) => <i key={i} style={c} />)}
      </div>

      <div className="gan-wrap">
        <div style={{ textAlign: 'center' }}>
          <span className="gan-chip"><b></b> Ganadores reales</span>
          <h2 className="gan-titulo">¡Ellos ya ganaron!</h2>
          <p className="gan-sub">Cada semana entregamos premios de verdad. Mira a quienes ya se llevaron el suyo… el próximo puedes ser tú.</p>
          <div className="gan-cifras">
            <div className="gan-cifra"><strong>{ganadores.length}</strong><span>{ganadores.length === 1 ? 'Ganador' : 'Ganadores'}</span></div>
            {ciudades > 1 && <div className="gan-cifra"><strong>{ciudades}</strong><span>Ciudades</span></div>}
            <div className="gan-cifra"><strong>100%</strong><span>Premios entregados</span></div>
          </div>
        </div>

        {/* El más reciente, en grande */}
        <div className="gan-dest" onClick={() => setAbierto(0)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(0); } }}
          aria-label={`Ver foto de ${destacado.nombre}`}>
          <div className="gan-dest-in">
            <div className="gan-dest-foto">
              <span className="gan-cinta">★ ÚLTIMO GANADOR</span>
              <img src={grande(destacado.imagen_url)} alt={`${destacado.nombre}, ganador${destacado.premio ? ` de ${destacado.premio}` : ''}`} />
            </div>
            <div className="gan-dest-txt">
              <span className="gan-trofeo">🏆</span>
              <h3 className="gan-dest-nombre">{destacado.nombre}</h3>
              {destacado.premio && <div className="gan-dest-premio">Se ganó: {destacado.premio}</div>}
              {destacado.numero && (
                <div className="gan-bola"><b>{destacado.numero}</b><span>Número<br/>ganador</span></div>
              )}
              <div className="gan-datos">
                {destacado.rifa && <span className="gan-dato">🎟 {destacado.rifa}</span>}
                {destacado.ciudad && <span className="gan-dato">📍 {destacado.ciudad}</span>}
                {fmtFecha(destacado.fecha) && <span className="gan-dato">📅 {fmtFecha(destacado.fecha)}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Catálogo con el resto */}
        {resto.length > 0 && (
          <>
            <div className="gan-cat-tit">Galería de ganadores</div>
            <div className="gan-grid">
              {catalogo.map((g, i) => (
                <button key={g.id} className="gan-card" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                  onClick={() => setAbierto(i + 1)} aria-label={`Ver foto de ${g.nombre}`}>
                  <img src={miniatura(g.imagen_url)} alt={`${g.nombre}, ganador${g.premio ? ` de ${g.premio}` : ''}`} loading="lazy" />
                  {g.numero && <span className="gan-card-num">{g.numero}</span>}
                  <div className="gan-card-txt">
                    <div className="gan-card-nombre">{g.nombre}</div>
                    {g.premio && <div className="gan-card-premio">🏆 {g.premio}</div>}
                    {(g.ciudad || g.fecha) && (
                      <div className="gan-card-meta">{[g.ciudad, fmtFecha(g.fecha)].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {!verTodos && resto.length > PRIMEROS && (
              <button className="gan-mas" onClick={() => setVerTodos(true)}>
                Ver los {resto.length - PRIMEROS} ganadores restantes
              </button>
            )}
          </>
        )}
      </div>

      {abierto != null && <Visor lista={ganadores} indice={abierto} onCerrar={cerrar} onMover={mover} />}
    </section>
  );
}
