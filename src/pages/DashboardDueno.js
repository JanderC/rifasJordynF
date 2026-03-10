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
    setLoading(true);
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

  const totalVentas   = data?.rifasDetalle?.reduce((a, r) => a + parseInt(r.total_ventas || 0), 0) || 0;
  const totalIngresos = data?.rifasDetalle?.reduce((a, r) => a + parseFloat(r.ingresos_totales || 0), 0) || 0;

  const stats = [
    { label: 'VENTAS HOY',    value: data?.hoy?.ventas || 0,                         icon: 'bi-ticket-perforated-fill', color: 'primary', colorVar:'var(--jordyn-primary)', format: 'num' },
    { label: 'INGRESOS HOY',  value: data?.hoy?.ingresos || 0,                       icon: 'bi-cash-stack',             color: 'green',   colorVar:'var(--jordyn-green)',   format: 'precio' },
    { label: 'VENDEDORES',    value: data?.total_vendedores || 0,                     icon: 'bi-people-fill',            color: 'blue',    colorVar:'var(--jordyn-blue)',    format: 'num' },
    { label: 'RIFAS ACTIVAS', value: data?.rifas?.filter(r => r.activa).length || 0, icon: 'bi-trophy-fill',            color: 'gold',    colorVar:'var(--jordyn-gold)',    format: 'num' },
  ];

  return (
    <Layout title="PANTALLA PRINCIPAL">

      {/* ── Banner global ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--jordyn-primary) 0%, var(--jordyn-primary-d) 100%)',
        borderRadius: '14px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(10,191,188,0.25)',
        color: '#fff',
      }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.8, marginBottom: 4 }}>
            TOTAL RECAUDADO
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '1px', lineHeight: 1 }}>
            {fmt(totalIngresos)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'BOLETOS VENDIDOS', value: totalVentas },
            { label: 'RIFAS ACTIVAS',    value: data?.rifas?.filter(r=>r.activa).length || 0 },
            { label: 'VENDEDORES',       value: data?.total_vendedores || 0 },
          ].map(b => (
            <div key={b.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.7, marginBottom: 2 }}>{b.label}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>{b.value}</div>
            </div>
          ))}
        </div>
        <button
          onClick={loadData}
          style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'#fff', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, marginLeft:'auto', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.3)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'}
        >
          <i className="bi bi-arrow-clockwise"></i>ACTUALIZAR
        </button>
      </div>

      {/* ── Stats del día ── */}
      <div className="row g-3 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="col-6 col-lg-3">
            <div className={`stat-card ${s.color}`} style={{ height: '100%' }}>
              <div className="stat-value" style={{ color: s.colorVar, fontSize: s.format === 'precio' ? '1.35rem' : '2rem' }}>
                {s.format === 'precio' ? fmt(s.value) : s.value}
              </div>
              <div className="stat-label">{s.label}</div>
              <i className={`bi ${s.icon} stat-icon`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progreso rifas ── */}
      <div className="jd-card mb-4">
        <div style={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--jordyn-muted)', marginBottom: '0.85rem' }}>
          % AVANCE DE VENTAS POR RIFA
        </div>
        <ProgressBar rifas={data?.rifasDetalle || []} />
      </div>

      {/* ── Grid inferior 3 columnas ── */}
      <div className="row g-3">

        {/* Top vendedores */}
        <div className="col-12 col-md-4">
          <div className="jd-card jd-card-gold" style={{ height: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--jordyn-gold)', display:'flex', alignItems:'center', gap:6 }}>
              🏅 TOP VENDEDORES DEL MES
            </div>
            {!data?.top_vendedores?.length && (
              <p style={{ color: 'var(--jordyn-muted)', fontSize: '0.8rem' }}>Sin ventas este mes</p>
            )}
            {data?.top_vendedores?.map((v, i) => (
              <div key={v.nombre} className="d-flex align-items-center justify-content-between py-2"
                style={{ borderBottom: '1px solid var(--jordyn-border)' }}>
                <div className="d-flex align-items-center gap-2">
                  <span style={{
                    fontWeight: 900, fontSize: '1.1rem',
                    color: i === 0 ? '#f0a500' : i === 1 ? '#9ca3af' : '#a0522d',
                    minWidth: 22,
                  }}>{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{v.nombre}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)' }}>{v.ventas} ventas</div>
                  </div>
                </div>
                <div style={{ color: 'var(--jordyn-green)', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {fmt(v.ingresos)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas ventas */}
        <div className="col-12 col-md-5">
          <div className="jd-card jd-card-green" style={{ height: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--jordyn-green)', display:'flex', alignItems:'center', gap:6 }}>
              🕐 ÚLTIMAS VENTAS
            </div>
            {!data?.ultimas_ventas?.length && (
              <p style={{ color: 'var(--jordyn-muted)', fontSize: '0.8rem' }}>Sin ventas registradas</p>
            )}
            {data?.ultimas_ventas?.map((v) => (
              <div key={v.id} className="d-flex align-items-center justify-content-between py-2"
                style={{ borderBottom: '1px solid var(--jordyn-border)' }}>
                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    fontWeight: 900, fontSize: '1rem',
                    background: 'rgba(10,191,188,0.12)', border: '1.5px solid rgba(10,191,188,0.3)',
                    padding: '2px 8px', borderRadius: '6px', color: 'var(--jordyn-primary)', whiteSpace: 'nowrap',
                  }}>
                    {v.numero}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.nombre_comprador}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--jordyn-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.rifa_nombre} · {v.vendedor_nombre}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                  {new Date(v.created_at).toLocaleDateString('es-CO')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Números calientes */}
        <div className="col-12 col-md-3">
          <div className="jd-card jd-card-red" style={{ height: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--jordyn-red)', display:'flex', alignItems:'center', gap:6 }}>
              🔥 NÚMEROS CALIENTES
            </div>
            {!data?.numeros_calientes?.length && (
              <p style={{ color: 'var(--jordyn-muted)', fontSize: '0.8rem' }}>Sin ventas aún</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {data?.numeros_calientes?.map((n) => (
                <div key={n.numero} style={{
                  background: n.veces >= 2 ? 'rgba(230,57,70,0.12)' : 'rgba(240,165,0,0.10)',
                  border: `1.5px solid ${n.veces >= 2 ? 'rgba(230,57,70,0.35)' : 'rgba(240,165,0,0.35)'}`,
                  borderRadius: '8px', padding: '5px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 900, fontSize: '0.95rem', color: n.veces >= 2 ? 'var(--jordyn-red)' : 'var(--jordyn-gold)' }}>
                    {n.numero}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'var(--jordyn-muted)', fontWeight: 600 }}>{n.veces}×</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}