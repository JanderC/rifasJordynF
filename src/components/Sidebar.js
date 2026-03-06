import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  // Cerrar al cambiar de ruta
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Bloquear scroll cuando está abierto en mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = () => {
    logout();
    toast.info('Sesión cerrada');
    navigate('/login');
  };

  const navsDueno = [
    { to: '/dashboard',  icon: 'bi-grid-1x2-fill',    label: 'DASHBOARD' },
    { to: '/rifas',      icon: 'bi-trophy-fill',       label: 'RIFAS' },
    { to: '/vendedores', icon: 'bi-people-fill',       label: 'VENDEDORES' },
    { to: '/numeros',    icon: 'bi-grid-3x3-gap-fill', label: 'NÚMEROS' },
    { to: '/historial',       icon: 'bi-clock-history',     label: 'HISTORIAL' },
    { to: '/diseno-ticket',   icon: 'bi-ticket-perforated-fill', label: 'DISEÑO BOLETO' },
    {to: '/caja',           icon: 'bi-cash-coin',         label: 'CAJA' },
  ];

  const navsVendedor = [
    { to: '/mi-dashboard', icon: 'bi-grid-1x2-fill', label: 'MI PANEL' },
    { to: '/vender',       icon: 'bi-search',        label: 'VENDER' },
    { to: '/mis-ventas',   icon: 'bi-receipt',       label: 'MIS VENTAS' },
  ];

  const navs = user?.rol === 'dueno' ? navsDueno : navsVendedor;
  const currentNav = navs.find(n => location.pathname === n.to);
  const pageTitle  = currentNav?.label || 'RIFAS JORDYN';

  return (
    <>
      {/* ── Topbar mobile ── */}
      <div className="jd-topbar-mobile">
        <button className="jd-hamburger" onClick={() => setOpen(true)}>
          <i className="bi bi-list"></i>
        </button>
        <div className="jd-topbar-mobile-title">🎰 {pageTitle}</div>
        <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.65rem', color: 'var(--jordyn-muted)' }}>
          {user?.nombre?.split(' ')[0]}
        </div>
      </div>

      {/* ── Overlay ── */}
      <div className={`jd-overlay${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      {/* ── Sidebar ── */}
      <nav className={`jd-sidebar${open ? ' open' : ''}`}>

        {/* Cerrar en mobile */}
        <button
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'none', border: '1px solid var(--jordyn-border)',
            color: 'var(--jordyn-muted)', borderRadius: '4px',
            padding: '3px 8px', cursor: 'pointer', fontSize: '1rem',
            display: 'none',
          }}
          id="sidebar-close"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        {/* Brand */}
        <div className="jd-sidebar-brand" style={{ paddingRight: '3rem' }}>
          <h1>🎰 RIFAS</h1>
          <h1 style={{ color: 'var(--jordyn-text)' }}>JORDYN</h1>
          <small style={{ display: 'block', marginTop: '4px' }}>
            {user?.rol === 'dueno' ? '◆ ADMINISTRADOR' : '◆ VENDEDOR'}
          </small>
        </div>

        {/* Links */}
        <div style={{ flex: 1, paddingTop: '0.5rem' }}>
          {navs.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `jd-nav-item${isActive ? ' active' : ''}`}
            >
              <i className={`bi ${n.icon}`}></i>
              {n.label}
            </NavLink>
          ))}
        </div>

        {/* User / logout */}
        <div style={{ borderTop: '1px solid var(--jordyn-border)', padding: '1rem' }}>
          <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.72rem', color: 'var(--jordyn-muted)', marginBottom: '0.75rem' }}>
            <div style={{ color: 'var(--jordyn-text)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{user?.nombre}</div>
            <div>@{user?.usuario}</div>
          </div>
          <button onClick={handleLogout} className="btn-jordyn-outline w-100" style={{ fontSize: '0.8rem' }}>
            <i className="bi bi-box-arrow-left me-1"></i> SALIR
          </button>
        </div>
      </nav>

      {/* ── Bottom nav mobile ── */}
      <nav className="jd-bottom-nav">
        <div className="jd-bottom-nav-inner">
          {navs.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `jd-bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <i className={`bi ${n.icon}`}></i>
              {n.label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mostrar botón X solo en mobile */}
      <style>{`
        @media (max-width: 768px) {
          #sidebar-close { display: block !important; }
        }
      `}</style>
    </>
  );
}