import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import ProgressBar from '../components/ProgressBar';
import API from '../services/api';
import { toast } from 'react-toastify';

export default function DashboardDueno() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fmt = (p) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, pctRes] = await Promise.all([
        API.get('/reportes/dashboard'),
        API.get('/reportes/porcentaje-ventas'),
      ]);
      setData({ ...dashRes.data, rifasDetalle: pctRes.data });
    } catch {
      toast.error('Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <Layout title="PANTALLA PRINCIPAL">
      <div className="d-flex justify-content-center mt-5">
        <div className="jd-spinner" style={{ width: 48, height: 48 }}></div>
      </div>
    </Layout>
  );

  const colorMap = {
    gold:  'var(--jordyn-gold)',
    green: 'var(--jordyn-green)',
    red:   'var(--jordyn-red)',
    blue:  'var(--jordyn-blue)',
  };

  const stats = [
    { label: 'VENTAS HOY',    value: data?.hoy?.ventas || 0,                         icon: 'bi-ticket-perforated-fill', color: 'gold',  format: 'num' },
    { label: 'INGRESOS HOY',  value: data?.hoy?.ingresos || 0,                       icon: 'bi-cash-stack',             color: 'green', format: 'precio' },
    { label: 'VENDEDORES',    value: data?.total_vendedores || 0,                     icon: 'bi-people-fill',            color: 'blue',  format: 'num' },
    { label: 'RIFAS ACTIVAS', value: data?.rifas?.filter(r => r.activa).length || 0, icon: 'bi-trophy-fill',            color: 'red',   format: 'num' },
  ];

  const totalVentas   = data?.rifasDetalle?.reduce((a, r) => a + parseInt(r.total_ventas || 0), 0) || 0;
  const totalIngresos = data?.rifasDetalle?.reduce((a, r) => a + parseFloat(r.ingresos_totales || 0), 0) || 0;

  return (
    <Layout title="PANTALLA PRINCIPAL">

      {/* ── Banner global ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1400 0%, #1a1a1a 60%, #001a10 100%)',
        border: '1px solid var(--jordyn-border)',
        borderRadius: '10px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.62rem', color: 'var(--jordyn-muted)', letterSpacing: '3px' }}>TOTAL RECAUDADO</div>
          <div style={{ fontFamily: 'var(--jordyn-display)', fontSize: '2rem', color: 'var(--jordyn-gold)', letterSpacing: '2px', lineHeight: 1.1 }}>
            {fmt(totalIngresos)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'BOLETOS VENDIDOS', value: totalVentas,                                 color: 'var(--jordyn-text)' },
            { label: 'RIFAS ACTIVAS',    value: data?.rifas?.filter(r=>r.activa).length||0, color: 'var(--jordyn-green)' },
            { label: 'VENDEDORES',       value: data?.total_vendedores || 0,                 color: 'var(--jordyn-blue)' },
          ].map(b => (
            <div key={b.label}>
              <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.6rem', color: 'var(--jordyn-muted)', letterSpacing: '2px' }}>{b.label}</div>
              <div style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.5rem', color: b.color, letterSpacing: '2px' }}>{b.value}</div>
            </div>
          ))}
        </div>
        <button className="btn-jordyn-outline" onClick={loadData} style={{ fontSize: '0.8rem', padding: '6px 14px', marginLeft: 'auto' }}>
          <i className="bi bi-arrow-clockwise me-1"></i>ACTUALIZAR
        </button>
      </div>

      {/* ── Stats del día ── */}
      <div className="row g-3 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="col-6 col-lg-3">
            <div className={`stat-card ${s.color}`} style={{ height: '100%' }}>
              <div className="stat-value" style={{ color: colorMap[s.color], fontSize: s.format === 'precio' ? '1.4rem' : '2.2rem' }}>
                {s.format === 'precio' ? fmt(s.value) : s.value}
              </div>
              <div className="stat-label">{s.label}</div>
              <i className={`bi ${s.icon} stat-icon`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progreso rifas ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '3px', color: 'var(--jordyn-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          % AVANCE DE VENTAS POR RIFA
        </div>
        <ProgressBar rifas={data?.rifasDetalle || []} />
      </div>

      {/* ── Grid inferior 3 columnas ── */}
      <div className="row g-3">

        {/* Top vendedores */}
        <div className="col-12 col-md-4">
          <div className="jd-card jd-card-gold" style={{ height: '100%' }}>
            <div style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '2px', fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--jordyn-gold)' }}>
              🏅 TOP VENDEDORES DEL MES
            </div>
            {!data?.top_vendedores?.length && (
              <p style={{ color: 'var(--jordyn-muted)', fontFamily: 'var(--jordyn-mono)', fontSize: '0.78rem' }}>Sin ventas este mes</p>
            )}
            {data?.top_vendedores?.map((v, i) => (
              <div key={v.nombre} className="d-flex align-items-center justify-content-between py-2" style={{ borderBottom: '1px solid var(--jordyn-border)' }}>
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.1rem', color: i === 0 ? 'var(--jordyn-gold)' : i === 1 ? '#aaa' : '#a0522d', minWidth: 22 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '1px', fontSize: '0.92rem' }}>{v.nombre}</div>
                    <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.62rem', color: 'var(--jordyn-muted)' }}>{v.ventas} ventas</div>
                  </div>
                </div>
                <div style={{ color: 'var(--jordyn-green)', fontFamily: 'var(--jordyn-mono)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {fmt(v.ingresos)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas ventas */}
        <div className="col-12 col-md-5">
          <div className="jd-card jd-card-green" style={{ height: '100%' }}>
            <div style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '2px', fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--jordyn-green)' }}>
              🕐 ÚLTIMAS VENTAS
            </div>
            {!data?.ultimas_ventas?.length && (
              <p style={{ color: 'var(--jordyn-muted)', fontFamily: 'var(--jordyn-mono)', fontSize: '0.78rem' }}>Sin ventas registradas</p>
            )}
            {data?.ultimas_ventas?.map((v) => (
              <div key={v.id} className="d-flex align-items-center justify-content-between py-2" style={{ borderBottom: '1px solid var(--jordyn-border)' }}>
                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '1rem', fontWeight: 700, background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)', padding: '1px 7px', borderRadius: '4px', color: 'var(--jordyn-gold)', whiteSpace: 'nowrap' }}>
                    {v.numero}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre_comprador}</div>
                    <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.62rem', color: 'var(--jordyn-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.rifa_nombre} · {v.vendedor_nombre}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.68rem', color: 'var(--jordyn-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                  {new Date(v.created_at).toLocaleDateString('es-CO')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Números calientes */}
        <div className="col-12 col-md-3">
          <div className="jd-card jd-card-red" style={{ height: '100%' }}>
            <div style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '2px', fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--jordyn-red)' }}>
              🔥 NÚMEROS CALIENTES
            </div>
            {!data?.numeros_calientes?.length && (
              <p style={{ color: 'var(--jordyn-muted)', fontFamily: 'var(--jordyn-mono)', fontSize: '0.78rem' }}>Sin ventas aún</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {data?.numeros_calientes?.map((n) => (
                <div key={n.numero} style={{
                  background: n.veces >= 2 ? 'rgba(230,57,70,0.2)' : 'rgba(245,197,24,0.1)',
                  border: `1px solid ${n.veces >= 2 ? 'rgba(230,57,70,0.5)' : 'rgba(245,197,24,0.3)'}`,
                  borderRadius: '6px', padding: '5px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.92rem', fontWeight: 700, color: n.veces >= 2 ? 'var(--jordyn-red)' : 'var(--jordyn-gold)' }}>
                    {n.numero}
                  </div>
                  <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.58rem', color: 'var(--jordyn-muted)' }}>{n.veces}x</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}