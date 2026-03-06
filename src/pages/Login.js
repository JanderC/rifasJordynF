import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function Login() {
  const [usuario,  setUsuario]  = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuario || !password) { toast.error('Completa todos los campos'); return; }
    setLoading(true);
    try {
      const user = await login(usuario, password);
      toast.success(`Bienvenido, ${user.nombre}`);
      navigate(user.rol === 'dueno' ? '/dashboard' : '/vender');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--jordyn-black)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `
        radial-gradient(ellipse at 30% 70%, rgba(245,197,24,0.06) 0%, transparent 60%),
        radial-gradient(ellipse at 70% 30%, rgba(6,214,160,0.04) 0%, transparent 50%)
      `
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '1rem' }}>

        {/* Logo */}
        <div className="text-center mb-4">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎰</div>
          <h1 style={{
            fontFamily: 'var(--jordyn-display)',
            fontSize: '3.5rem',
            color: 'var(--jordyn-gold)',
            letterSpacing: '6px',
            lineHeight: 1
          }}>RIFAS</h1>
          <h1 style={{
            fontFamily: 'var(--jordyn-display)',
            fontSize: '3.5rem',
            color: 'var(--jordyn-text)',
            letterSpacing: '6px',
            lineHeight: 1
          }}>JORDYN</h1>
          <p style={{
            fontFamily: 'var(--jordyn-mono)',
            fontSize: '0.7rem',
            color: 'var(--jordyn-muted)',
            letterSpacing: '4px',
            marginTop: '0.5rem'
          }}>SISTEMA DE GESTIÓN</p>
        </div>

        {/* Card */}
        <div className="jd-card" style={{ border: '1px solid #2a2a2a' }}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="jd-label">Usuario</label>
              <input
                className="jd-input"
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                placeholder="tu_usuario"
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="mb-4">
              <label className="jd-label">Contraseña</label>
              <div className="position-relative">
                <input
                  className="jd-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer'
                  }}
                >
                  <i className={`bi bi-eye${showPass ? '-slash' : ''}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-jordyn w-100"
              disabled={loading}
              style={{ fontSize: '1.1rem', padding: '0.75rem' }}
            >
              {loading
                ? <><span className="jd-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> INGRESANDO...</>
                : <><i className="bi bi-door-open-fill me-2"></i>INGRESAR</>
              }
            </button>
          </form>
        </div>

        <p className="text-center mt-3" style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.65rem', color: 'var(--jordyn-muted)' }}>
          RIFAS JORDYN © 2026 — SISTEMA PRIVADO
        </p>
      </div>
    </div>
  );
}