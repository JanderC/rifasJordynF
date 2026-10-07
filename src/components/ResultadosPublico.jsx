// ============================================================
//  ResultadosPublico.jsx — Resultados de los sorteos en la página del cliente
//  Las imágenes las publica el dueño en el panel (módulo Resultados).
//  El más reciente sale en grande; los anteriores en una fila que se desliza.
//  Si no hay resultados visibles, la sección no aparece.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';

const TURQ    = '#0abfbc';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';

const img = (url, t) => (url && url.includes('/upload/') ? url.replace('/upload/', `/upload/${t}/`) : url);
const mediana = (url) => img(url, 'f_auto,q_auto,c_limit,w_900,h_900');
const chica   = (url) => img(url, 'f_auto,q_auto,c_fill,g_auto,w_420,h_420');
const grande  = (url) => img(url, 'f_auto,q_auto,c_limit,w_1600,h_1600');

const fmtFecha = (f) => {
  if (!f) return null;
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Caracas' });
};

const ESTILOS = `
.res-sec { padding:60px 5vw 0; max-width:1100px; margin:0 auto; scroll-margin-top:64px; font-family:'Poppins',sans-serif; }
.res-caja { background:#fff; border-radius:24px; padding:32px 28px; box-shadow:0 4px 32px rgba(10,100,100,.08); }
.res-ultimo { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); gap:26px; align-items:center; }
.res-foto { position:relative; border:none; padding:0; cursor:zoom-in; border-radius:18px; overflow:hidden; background:#0d1e1e; display:block; width:100%;
  box-shadow:0 14px 40px rgba(10,60,60,.2); transition:transform .25s, box-shadow .25s; }
.res-foto:hover { transform:translateY(-4px); box-shadow:0 22px 54px rgba(10,60,60,.28); }
.res-foto img { display:block; width:100%; max-height:520px; object-fit:contain; }
.res-cinta { position:absolute; top:14px; left:14px; padding:6px 14px; border-radius:40px; background:linear-gradient(135deg,${TURQ},${TURQ_DK}); color:#fff;
  font-size:.64rem; font-weight:800; letter-spacing:1.5px; box-shadow:0 6px 18px ${TURQ}66; }
.res-fecha { display:inline-block; font-size:.74rem; font-weight:700; color:${TURQ_DK}; background:${TURQ}14; border-radius:40px; padding:5px 13px; text-transform:capitalize; }
.res-titulo { font-size:clamp(1.4rem,3vw,2rem); font-weight:900; color:${DARK}; line-height:1.15; margin:12px 0 10px; }
.res-desc { font-size:.95rem; color:${DARK}aa; line-height:1.65; white-space:pre-line; }
.res-ver { display:inline-flex; align-items:center; gap:8px; margin-top:18px; border:none; cursor:pointer; font-family:inherit; font-size:.86rem; font-weight:700; color:#fff;
  border-radius:40px; padding:11px 22px; background:linear-gradient(135deg,${TURQ},${TURQ_DK}); box-shadow:0 8px 22px ${TURQ}55; transition:transform .2s; }
.res-ver:hover { transform:translateY(-2px); }
.res-ant-tit { display:flex; align-items:center; gap:12px; margin:30px 0 14px; font-size:.95rem; font-weight:800; color:${DARK}; }
.res-ant-tit::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,${TURQ}66,transparent); }
.res-fila { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(170px,200px); gap:14px; overflow-x:auto; padding:4px 2px 12px; scroll-snap-type:x proximity; }
.res-mini { scroll-snap-align:start; border:none; padding:0; cursor:pointer; text-align:left; background:#f8fdfd; border-radius:16px; overflow:hidden; font-family:inherit;
  border:1px solid #e0f0f0; transition:transform .2s, box-shadow .2s, border-color .2s; }
.res-mini:hover { transform:translateY(-4px); box-shadow:0 12px 28px rgba(10,150,150,.16); border-color:${TURQ}88; }
.res-mini img { display:block; width:100%; aspect-ratio:1/1; object-fit:cover; background:#0d1e1e; }
.res-mini div { padding:9px 11px 11px; }
.res-mini b { display:block; font-size:.8rem; color:${DARK}; line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.res-mini span { font-size:.66rem; color:${DARK}88; text-transform:capitalize; }

.res-visor { position:fixed; inset:0; z-index:2000; background:rgba(3,12,12,.94); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px;
  font-family:'Poppins',sans-serif; animation: resFade .25s both; }
@keyframes resFade { from { opacity:0; } to { opacity:1; } }
.res-visor-caja { max-width:960px; width:100%; max-height:100%; display:flex; flex-direction:column; align-items:center; gap:14px; }
.res-visor img { max-width:100%; max-height:76vh; border-radius:16px; object-fit:contain; box-shadow:0 30px 80px rgba(0,0,0,.6); }
.res-visor h3 { color:#fff; font-size:1.2rem; font-weight:800; margin:0; text-align:center; }
.res-visor small { color:rgba(255,255,255,.65); font-size:.8rem; text-transform:capitalize; }
.res-visor-btn { position:absolute; width:46px; height:46px; border-radius:50%; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.1); color:#fff; font-size:1.4rem;
  cursor:pointer; display:flex; align-items:center; justify-content:center; }
.res-visor-btn:hover { background:${TURQ}66; }

@media (max-width: 760px) {
  .res-sec { padding-top:44px; }
  .res-caja { padding:22px 16px; border-radius:20px; }
  .res-ultimo { grid-template-columns:1fr; gap:16px; }
  .res-fila { grid-auto-columns:minmax(140px,160px); }
}
@media (prefers-reduced-motion: reduce) { .res-foto, .res-mini, .res-ver { transition:none; } .res-visor { animation:none; } }
`;

function Visor({ lista, indice, onCerrar, onMover }) {
  const r = lista[indice];
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
  if (!r) return null;
  return (
    <div className="res-visor" onClick={onCerrar} role="dialog" aria-modal="true" aria-label={r.titulo}>
      <button className="res-visor-btn" style={{ top:18, right:18 }} onClick={onCerrar} aria-label="Cerrar">✕</button>
      {lista.length > 1 && (
        <>
          <button className="res-visor-btn" style={{ left:12, top:'50%', transform:'translateY(-50%)' }} onClick={(e) => { e.stopPropagation(); onMover(-1); }} aria-label="Anterior">‹</button>
          <button className="res-visor-btn" style={{ right:12, top:'50%', transform:'translateY(-50%)' }} onClick={(e) => { e.stopPropagation(); onMover(1); }} aria-label="Siguiente">›</button>
        </>
      )}
      <div className="res-visor-caja" onClick={(e) => e.stopPropagation()}>
        <img src={grande(r.imagen_url)} alt={r.titulo} />
        <h3>{r.titulo}</h3>
        {fmtFecha(r.fecha) && <small>{fmtFecha(r.fecha)}</small>}
      </div>
    </div>
  );
}

export default function ResultadosPublico({ resultados }) {
  const [abierto, setAbierto] = useState(null);
  const cerrar = useCallback(() => setAbierto(null), []);
  const mover  = useCallback((d) => setAbierto((i) => (i == null ? i : (i + d + resultados.length) % resultados.length)), [resultados.length]);

  if (!resultados?.length) return null;
  const [ultimo, ...anteriores] = resultados;

  return (
    <section id="resultados-sec" className="res-sec">
      <style>{ESTILOS}</style>
      <div className="res-caja">
        <div className="pub-titulo" style={{ marginBottom:28 }}>
          <span className="kicker">Sorteos realizados</span>
          <h2>Resultados</h2>
        </div>

        <div className="res-ultimo">
          <button className="res-foto" onClick={() => setAbierto(0)} aria-label={`Ver en grande: ${ultimo.titulo}`}>
            <span className="res-cinta">ÚLTIMO RESULTADO</span>
            <img src={mediana(ultimo.imagen_url)} alt={ultimo.titulo} />
          </button>
          <div>
            {fmtFecha(ultimo.fecha) && <span className="res-fecha">📅 {fmtFecha(ultimo.fecha)}</span>}
            <h3 className="res-titulo">{ultimo.titulo}</h3>
            {ultimo.descripcion && <p className="res-desc">{ultimo.descripcion}</p>}
            <button className="res-ver" onClick={() => setAbierto(0)}>🔍 Ver el resultado en grande</button>
          </div>
        </div>

        {anteriores.length > 0 && (
          <>
            <div className="res-ant-tit">Resultados anteriores</div>
            <div className="res-fila">
              {anteriores.map((r, i) => (
                <button key={r.id} className="res-mini" onClick={() => setAbierto(i + 1)} aria-label={`Ver ${r.titulo}`}>
                  <img src={chica(r.imagen_url)} alt={r.titulo} loading="lazy" />
                  <div>
                    <b>{r.titulo}</b>
                    <span>{fmtFecha(r.fecha) || ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {abierto != null && <Visor lista={resultados} indice={abierto} onCerrar={cerrar} onMover={mover} />}
    </section>
  );
}
