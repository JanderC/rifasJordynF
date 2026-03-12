import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import API from '../services/api';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [pendientes, setPendientes] = useState(0); // badge reservas

  /* Cerrar al cambiar de ruta */
  useEffect(() => { setOpen(false); }, [location.pathname]);

  /* Bloquear scroll cuando está abierto */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* Cargar conteo de reservas pendientes (solo dueño) */
  useEffect(() => {
    if (user?.rol !== 'dueno') return;
    const fetchPendientes = async () => {
      try {
        const r = await API.get('/publico/admin/reservas?estado=pendiente');
        setPendientes(r.data.length);
      } catch {}
    };
    fetchPendientes();
    const interval = setInterval(fetchPendientes, 60_000); // actualizar cada minuto
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    toast.info('Sesión cerrada');
    navigate('/login');
  };

  const navsDueno = [
    { to: '/dashboard',       icon: 'bi-grid-1x2-fill',          label: 'Dashboard' },
    { to: '/rifas',           icon: 'bi-trophy-fill',            label: 'Rifas' },
    { to: '/vendedores',      icon: 'bi-people-fill',            label: 'Vendedores' },
    { to: '/numeros',         icon: 'bi-grid-3x3-gap-fill',      label: 'Números' },
    { to: '/reservas',        icon: 'bi-bookmark-check-fill',    label: 'Reservas', badge: pendientes },
    { to: '/historial',       icon: 'bi-clock-history',          label: 'Historial' },
    { to: '/diseno-ticket',   icon: 'bi-ticket-perforated-fill', label: 'Diseño boleto' },
    { to: '/caja',            icon: 'bi-cash-coin',              label: 'Caja' },
  ];

  const navsVendedor = [
    { to: '/mi-dashboard', icon: 'bi-grid-1x2-fill', label: 'Mi panel' },
    { to: '/vender',       icon: 'bi-search',        label: 'Vender' },
    { to: '/mis-ventas',   icon: 'bi-receipt',       label: 'Mis ventas' },
  ];

  const navs = user?.rol === 'dueno' ? navsDueno : navsVendedor;
  const currentNav = navs.find(n => location.pathname === n.to);
  const pageTitle  = currentNav?.label || 'RESUELVE TU SEMANA';

  /* Ítem de nav */
  const NavItem = ({ n }) => (
    <NavLink
      key={n.to}
      to={n.to}
      className={({ isActive }) => `jd-nav-item${isActive ? ' active' : ''}`}
      style={{ position: 'relative' }}
    >
      <i className={`bi ${n.icon}`}></i>
      <span style={{ flex: 1 }}>{n.label}</span>
      {n.badge > 0 && (
        <span style={{
          background: 'var(--jordyn-primary)',
          color: '#fff',
          borderRadius: 20,
          padding: '1px 7px',
          fontSize: '0.62rem',
          fontWeight: 800,
          lineHeight: 1.6,
          minWidth: 20,
          textAlign: 'center',
        }}>
          {n.badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <>
      {/* ── Topbar mobile ── */}
      <div className="jd-topbar-mobile">
        <button className="jd-hamburger" onClick={() => setOpen(true)}>
          <i className="bi bi-list"></i>
        </button>
        <div className="jd-topbar-mobile-title">
          🎰 {pageTitle}
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--jordyn-muted)' }}>
          {user?.nombre?.split(' ')[0]}
        </div>
      </div>

      {/* ── Overlay ── */}
      <div className={`jd-overlay${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      {/* ── Sidebar ── */}
      <nav className={`jd-sidebar${open ? ' open' : ''}`}>

        {/* Botón cerrar (solo mobile) */}
        <button
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', borderRadius: 6,
            padding: '4px 9px', cursor: 'pointer', fontSize: '0.9rem',
            display: 'none',
          }}
          id="sidebar-close"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        {/* Brand */}
        <div className="jd-sidebar-brand" style={{ paddingRight: '3rem' }}>
          <h1 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 900, letterSpacing: '1px' }}>
             RESUELVE TU SEMANA
          </h1>
          <small style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
            {user?.rol === 'dueno' ? '◆ Administrador' : '◆ Vendedor'}
          </small>
        </div>

        {/* Links */}
        <div style={{ flex: 1, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
          {/* Separador visual si hay reservas pendientes */}
          {user?.rol === 'dueno' && pendientes > 0 && (
            <div style={{
              margin: '0 12px 6px',
              padding: '6px 10px',
              background: 'rgba(240,165,0,0.10)',
              border: '1px solid rgba(240,165,0,0.25)',
              borderRadius: 8,
              fontSize: '0.68rem', fontWeight: 700,
              color: '#b37700',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className="bi bi-exclamation-circle-fill"></i>
              {pendientes} reserva{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''}
            </div>
          )}

          {navs.map(n => <NavItem key={n.to} n={n} />)}
        </div>

        {/* Separador + usuario + logout */}
        <div style={{ borderTop: '1px solid var(--jordyn-border)', padding: '0.9rem 1.1rem' }}>
          <div style={{ marginBottom: '0.7rem' }}>
            {/* Avatar inicial */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(10,191,188,0.15)',
                border: '2px solid rgba(10,191,188,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.95rem', color: 'var(--jordyn-primary)',
              }}>
                {user?.nombre?.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--jordyn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.nombre}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--jordyn-muted)' }}>@{user?.usuario}</div>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-jordyn-outline w-100"
            style={{ fontSize: '0.78rem', borderRadius: 8 }}>
            <i className="bi bi-box-arrow-left me-1"></i> Cerrar sesión
          </button>
        </div>
      </nav>

      {/* ── Bottom nav mobile ── */}
      <nav className="jd-bottom-nav">
        <div className="jd-bottom-nav-inner">
          {navs.slice(0, 5).map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `jd-bottom-nav-item${isActive ? ' active' : ''}`}
              style={{ position: 'relative' }}
            >
              <i className={`bi ${n.icon}`}></i>
              <span>{n.label.split(' ')[0]}</span>
              {n.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 6,
                  background: 'var(--jordyn-primary)', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: '0.55rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {n.badge > 9 ? '9+' : n.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          #sidebar-close { display: block !important; }
        }
      `}</style>
    </>
  );
}