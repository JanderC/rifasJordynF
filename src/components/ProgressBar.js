import React from 'react';

export default function ProgressBar({ rifas = [] }) {
  const formatPrecio = (p) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

  if (!rifas.length) return null;

  return (
    <div className="row g-3">
      {rifas.map((r, idx) => {
        const pVendido  = parseFloat(r.porcentaje_vendido || r.porcentaje_con_venta || 0);
        const pAgotado  = parseFloat(r.porcentaje_agotado || r.porcentaje_agotados || 0);
        const numVend   = parseInt(r.numeros_vendidos || 0);
        const numAgot   = parseInt(r.numeros_agotados || 0);
        const numDisp   = parseInt(r.numeros_disponibles || (1000 - numVend));
        const colores   = ['gold', 'green'];
        const color     = colores[idx % colores.length];
        const colorHex  = color === 'gold' ? 'var(--jordyn-gold)' : 'var(--jordyn-green)';

        return (
          <div key={r.id} className="col-12 col-md-6">
            <div className={`jd-card jd-card-${color}`}>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.1rem', letterSpacing: '2px', color: colorHex, marginBottom: '2px' }}>
                    {r.nombre}
                  </h5>
                  <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)' }}>
                    🏆 {r.premio}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--jordyn-display)', fontSize: '2rem', color: colorHex, lineHeight: 1 }}>
                  {pVendido}%
                </div>
              </div>

              {/* Barra vendido */}
              <div className="mb-1">
                <div className="d-flex justify-content-between mb-1">
                  <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.68rem', color: 'var(--jordyn-muted)' }}>CON VENTA</span>
                  <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.68rem', color: colorHex }}>{numVend} / 1000</span>
                </div>
                <div className="jd-progress">
                  <div
                    className={`jd-progress-bar jd-progress-bar-${color}`}
                    style={{ width: `${pVendido}%` }}
                  />
                </div>
              </div>

              {/* Barra agotados */}
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.68rem', color: 'var(--jordyn-muted)' }}>AGOTADOS</span>
                  <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.68rem', color: 'var(--jordyn-red)' }}>{numAgot} / 1000</span>
                </div>
                <div className="jd-progress">
                  <div className="jd-progress-bar jd-progress-bar-red" style={{ width: `${pAgotado}%` }} />
                </div>
              </div>

              {/* Stats row */}
              <div className="d-flex gap-3" style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--jordyn-green)' }}>● {numDisp}</div>
                  <div style={{ color: 'var(--jordyn-muted)' }}>DISPONIBLES</div>
                </div>
                <div>
                  <div style={{ color: 'var(--jordyn-yellow)' }}>● {numVend - numAgot > 0 ? numVend - numAgot : 0}</div>
                  <div style={{ color: 'var(--jordyn-muted)' }}>1 VENTA</div>
                </div>
                <div>
                  <div style={{ color: 'var(--jordyn-red)' }}>● {numAgot}</div>
                  <div style={{ color: 'var(--jordyn-muted)' }}>AGOTADOS</div>
                </div>
                <div className="ms-auto text-end">
                  <div style={{ color: colorHex, fontWeight: 700 }}>{formatPrecio(r.ingresos_totales)}</div>
                  <div style={{ color: 'var(--jordyn-muted)' }}>RECAUDADO</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}