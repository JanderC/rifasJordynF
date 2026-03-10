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
      toast.success(`¡Bienvenido, ${user.nombre}!`);
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
      background: 'var(--jordyn-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundImage: `
        radial-gradient(ellipse at 20% 80%, rgba(10,191,188,0.12) 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, rgba(10,191,188,0.07) 0%, transparent 50%)
      `
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div className="text-center mb-4">
          {/* Ícono circular */}
          <div style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(10,191,188,0.3)',
            fontSize: '2rem',
          }}>
            🎰
          </div>
          <h1 style={{
            fontFamily: 'var(--jordyn-font)',
            fontWeight: 900,
            fontSize: '2.8rem',
            color: 'var(--jordyn-primary)',
            letterSpacing: '2px',
            lineHeight: 1,
            marginBottom: 2,
          }}>RIFAS</h1>
          <h1 style={{
            fontFamily: 'var(--jordyn-font)',
            fontWeight: 900,
            fontSize: '2.8rem',
            color: 'var(--jordyn-text)',
            letterSpacing: '2px',
            lineHeight: 1,
            marginBottom: '0.5rem',
          }}>JORDYN</h1>
          <p style={{
            fontFamily: 'var(--jordyn-font)',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: 'var(--jordyn-muted)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>SISTEMA DE GESTIÓN</p>
        </div>

        {/* Card */}
        <div className="jd-card" style={{ padding: '2rem', boxShadow: '0 8px 32px rgba(10,191,188,0.13)' }}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="jd-label">Usuario</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--jordyn-primary)', fontSize:'1rem', pointerEvents:'none' }}>
                  <i className="bi bi-person-fill"></i>
                </span>
                <input
                  className="jd-input"
                  type="text"
                  value={usuario}
                  onChange={e => setUsuario(e.target.value)}
                  placeholder="tu_usuario"
                  autoFocus
                  autoComplete="username"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="jd-label">Contraseña</label>
              <div className="position-relative">
                <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--jordyn-primary)', fontSize:'1rem', pointerEvents:'none' }}>
                  <i className="bi bi-lock-fill"></i>
                </span>
                <input
                  className="jd-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.8rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: '0.85rem', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'var(--jordyn-muted)', cursor: 'pointer', fontSize:'1rem',
                    padding: 0, lineHeight: 1,
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
              style={{ fontSize: '1rem', padding: '0.8rem', borderRadius: 10 }}
            >
              {loading
                ? <><span className="jd-spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor:'#fff' }}></span> Ingresando...</>
                : <><i className="bi bi-door-open-fill me-2"></i>INGRESAR</>
              }
            </button>
          </form>
        </div>

        <p className="text-center mt-3" style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--jordyn-muted)', letterSpacing: '1px' }}>
          RIFAS JORDYN © 2026 — SISTEMA PRIVADO
        </p>
      </div>
    </div>
  );
}