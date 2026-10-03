// ============================================================
//  ComunidadPublico.jsx — Página del cliente
//   • TopCompradores: los 5 que más números han comprado
//   • BurbujaGrupo: botón flotante para unirse al grupo de WhatsApp
//  El enlace del grupo y si se muestran se configuran en el panel
//  (Configuración → Página del cliente).
// ============================================================
import React, { useState } from 'react';

const TURQ    = '#0abfbc';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';
const WA      = '#25D366';
const WA_DK   = '#128C7E';

const MEDALLAS = [
  { emoji: '🥇', color: '#f5b301', fondo: 'linear-gradient(135deg,#fff7d6,#ffe9a3)' },
  { emoji: '🥈', color: '#8d99a6', fondo: 'linear-gradient(135deg,#f4f6f8,#e3e8ed)' },
  { emoji: '🥉', color: '#c77b3c', fondo: 'linear-gradient(135deg,#fdf0e4,#f6dcc4)' },
];

const IconoWhatsApp = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
  </svg>
);

const ESTILOS = `
.top-fila { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:16px; background:#f8fdfd; border:1.5px solid #e0f0f0;
  animation: topEntra .5s both; transition: transform .2s, box-shadow .2s; }
.top-fila:hover { transform: translateX(4px); box-shadow: 0 6px 20px rgba(10,100,100,.10); }
@keyframes topEntra { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
.top-barra { height:8px; border-radius:8px; background:#e0f0f0; overflow:hidden; margin-top:7px; }
.top-barra > div { height:100%; border-radius:8px; animation: topLlena 1s .25s both cubic-bezier(.2,.8,.2,1); transform-origin:left; }
@keyframes topLlena { from { transform:scaleX(0); } to { transform:scaleX(1); } }
.top-cta { display:inline-flex; align-items:center; gap:9px; padding:13px 26px; border-radius:40px; text-decoration:none; font-weight:700; font-size:.92rem;
  background:linear-gradient(135deg,${WA},${WA_DK}); color:#fff; box-shadow:0 10px 28px rgba(37,211,102,.35); transition:transform .2s, box-shadow .2s; }
.top-cta:hover { transform:translateY(-3px); box-shadow:0 16px 36px rgba(37,211,102,.45); color:#fff; }

/* Burbuja flotante del grupo */
.wa-burbuja { position:fixed; right:18px; bottom:18px; z-index:900; display:flex; align-items:center; gap:10px; font-family:'Poppins',sans-serif; }
.wa-burbuja-btn { position:relative; width:58px; height:58px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  background:linear-gradient(135deg,${WA},${WA_DK}); color:#fff; text-decoration:none; box-shadow:0 10px 28px rgba(18,140,126,.45); transition:transform .2s; }
.wa-burbuja-btn:hover { transform:scale(1.08); color:#fff; }
.wa-burbuja-btn::before { content:''; position:absolute; inset:0; border-radius:50%; border:2px solid ${WA}; animation: waOnda 2.2s ease-out infinite; }
@keyframes waOnda { 0% { transform:scale(1); opacity:.8; } 100% { transform:scale(1.7); opacity:0; } }
.wa-burbuja-txt { position:relative; background:#fff; border-radius:16px; padding:10px 34px 10px 14px; box-shadow:0 10px 30px rgba(10,60,60,.18); max-width:210px;
  text-decoration:none; animation: topEntra .5s .8s both; }
.wa-burbuja-txt b { display:block; font-size:.84rem; color:${DARK}; font-weight:700; line-height:1.25; }
.wa-burbuja-txt span { font-size:.7rem; color:${WA_DK}; font-weight:600; }
.wa-burbuja-x { position:absolute; top:4px; right:4px; width:24px; height:24px; border:none; background:transparent; color:#1a2e2e77; cursor:pointer; font-size:.8rem; border-radius:50%; }
.wa-burbuja-x:hover { background:#f0f5f5; color:${DARK}; }
@media (max-width: 520px) {
  .wa-burbuja { right:12px; bottom:12px; }
  .wa-burbuja-btn { width:52px; height:52px; }
  .wa-burbuja-txt { max-width:170px; }
}
@media (prefers-reduced-motion: reduce) {
  .top-fila, .top-barra > div, .wa-burbuja-txt { animation:none; }
  .wa-burbuja-btn::before { display:none; }
}
`;

export function TopCompradores({ top, grupo }) {
  if (!top?.length) return null;
  const maximo = Math.max(...top.map((t) => t.numeros), 1);
  return (
    <section id="top-sec" style={{ padding:'60px 5vw 0', maxWidth:1100, margin:'0 auto', scrollMarginTop:64 }}>
      <style>{ESTILOS}</style>
      <div style={{ background:'#fff', borderRadius:24, padding:'32px 28px', boxShadow:'0 4px 32px rgba(10,100,100,.08)', fontFamily:"'Poppins',sans-serif" }}>
        <div style={{ textAlign:'center', marginBottom:26 }}>
          <div style={{ fontSize:'.62rem', color:TURQ, letterSpacing:'1px', marginBottom:8, fontWeight:600 }}>LOS QUE MÁS PARTICIPAN</div>
          <h2 style={{ fontSize:'clamp(1.7rem,3.5vw,2.3rem)', color:DARK, fontWeight:800, margin:0 }}>🔥 Top compradores</h2>
          <div style={{ fontSize:'.82rem', color:`${DARK}77`, marginTop:6 }}>Quienes más números llevan en las rifas activas. ¿Te animas a subir al podio?</div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:640, margin:'0 auto' }}>
          {top.map((t, i) => {
            const m = MEDALLAS[i];
            return (
              <div key={t.puesto} className="top-fila" style={{ animationDelay:`${i * 90}ms`, ...(m ? { background:m.fondo, borderColor:`${m.color}66` } : {}) }}>
                <div style={{
                  width:46, height:46, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#fff', border:`2px solid ${m ? m.color : '#cfe6e6'}`, fontSize: m ? '1.5rem' : '1rem', fontWeight:800, color:TURQ_DK,
                }}>{m ? m.emoji : t.puesto}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10 }}>
                    <span style={{ fontSize:'1rem', fontWeight:700, color:DARK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.nombre}</span>
                    <span style={{ fontSize:'.86rem', fontWeight:800, color: m ? m.color : TURQ_DK, flexShrink:0 }}>
                      {t.numeros} número{t.numeros === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="top-barra">
                    <div style={{ width:`${Math.max(8, (t.numeros / maximo) * 100)}%`, background:`linear-gradient(90deg,${m ? m.color : TURQ},${m ? m.color : TURQ_DK})` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {grupo && (
          <div style={{ textAlign:'center', marginTop:26 }}>
            <a className="top-cta" href={grupo} target="_blank" rel="noopener noreferrer">
              <IconoWhatsApp size={20} /> Únete al grupo de WhatsApp
            </a>
            <div style={{ fontSize:'.72rem', color:`${DARK}66`, marginTop:8 }}>Resultados, ganadores y rifas nuevas antes que nadie.</div>
          </div>
        )}
      </div>
    </section>
  );
}

export function BurbujaGrupo({ grupo }) {
  const [textoVisible, setTextoVisible] = useState(true);
  if (!grupo) return null;
  return (
    <div className="wa-burbuja">
      <style>{ESTILOS}</style>
      {textoVisible && (
        <div style={{ position:'relative' }}>
          <a className="wa-burbuja-txt" href={grupo} target="_blank" rel="noopener noreferrer" style={{ display:'block' }}>
            <b>Únete a nuestro grupo</b>
            <span>Resultados y rifas nuevas</span>
          </a>
          <button className="wa-burbuja-x" onClick={() => setTextoVisible(false)} aria-label="Cerrar aviso">✕</button>
        </div>
      )}
      <a className="wa-burbuja-btn" href={grupo} target="_blank" rel="noopener noreferrer" aria-label="Unirme al grupo de WhatsApp" title="Unirme al grupo de WhatsApp">
        <IconoWhatsApp size={28} />
      </a>
    </div>
  );
}
