import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import ProgressBar from '../components/ProgressBar';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function DashboardVendedor() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate  = useNavigate();

  const formatPrecio = (p) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, pctRes] = await Promise.all([
        API.get('/reportes/vendedor-dashboard'),
        API.get('/reportes/porcentaje-ventas'),
      ]);
      setData({ ...dashRes.data, rifasDetalle: pctRes.data });
    } catch {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <Layout title="MI PANEL">
      <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
    </Layout>
  );

  return (
    <Layout title="MI PANEL">

      {/* Bienvenida */}
      <div className="jd-card jd-card-gold mb-4">
        <div className="d-flex align-items-center gap-3">
          <div style={{ fontSize: '2.5rem' }}>👋</div>
          <div>
            <h3 style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.5rem', color: 'var(--jordyn-gold)', letterSpacing: '3px', marginBottom: 2 }}>
              HOLA, {user?.nombre?.toUpperCase()}
            </h3>
            <p style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: 0 }}>
              @{user?.usuario} · VENDEDOR
            </p>
          </div>
          <button
            className="btn-jordyn ms-auto"
            onClick={() => navigate('/vender')}
            style={{ fontSize: '0.9rem' }}
          >
            <i className="bi bi-search me-2"></i>VENDER NÚMERO
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'MIS VENTAS TOTALES', value: data?.mis_ventas?.total || 0,        color: 'gold',  icon: 'bi-ticket-perforated-fill', format: 'num' },
          { label: 'VENTAS HOY',         value: data?.mis_ventas?.hoy || 0,           color: 'green', icon: 'bi-calendar-check-fill',    format: 'num' },
          { label: 'INGRESOS TOTALES',   value: data?.mis_ventas?.ingresos || 0,      color: 'blue',  icon: 'bi-cash-stack',             format: 'precio' },
          { label: 'NÚMS. PENDIENTES',   value: data?.numeros_pendientes || 0,        color: 'red',   icon: 'bi-grid-3x3-gap',           format: 'num' },
        ].map((s) => (
          <div key={s.label} className="col-6 col-md-3">
            <div className={`stat-card ${s.color}`}>
              <div className="stat-value" style={{
                color: s.color === 'gold' ? 'var(--jordyn-gold)' :
                       s.color === 'green' ? 'var(--jordyn-green)' :
                       s.color === 'red' ? 'var(--jordyn-red)' : 'var(--jordyn-blue)',
                fontSize: s.format === 'precio' ? '1.3rem' : '2.2rem'
              }}>
                {s.format === 'precio' ? formatPrecio(s.value) : s.value}
              </div>
              <div className="stat-label">{s.label}</div>
              <i className={`bi ${s.icon} stat-icon`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Progress de rifas */}
      <h4 style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '2px', color: 'var(--jordyn-muted)', fontSize: '1rem', marginBottom: '1rem' }}>
        ESTADO DE LAS RIFAS
      </h4>
      <ProgressBar rifas={data?.rifasDetalle || []} />

      {/* CTA */}
      <div className="mt-4 d-flex gap-3">
        <button className="btn-jordyn" onClick={() => navigate('/vender')}>
          <i className="bi bi-search me-2"></i>BUSCAR Y VENDER
        </button>
        <button className="btn-jordyn-outline" onClick={() => navigate('/mis-ventas')}>
          <i className="bi bi-receipt me-2"></i>VER MIS VENTAS
        </button>
      </div>
    </Layout>
  );
}