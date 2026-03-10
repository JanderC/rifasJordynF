import React, { useState, useRef } from 'react';
import Layout from '../components/Layout';
import Ticket from '../components/Ticket';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const ESTADOS = {
  disponible: { label: 'DISPONIBLE',   cls: 'badge-disponible', icon: 'bi-check-circle-fill' },
  vendido_1:  { label: '1 VENTA',      cls: 'badge-vendido1',   icon: 'bi-exclamation-circle-fill' },
  agotado:    { label: 'AGOTADO',      cls: 'badge-agotado',    icon: 'bi-x-circle-fill' },
};

export default function BuscarNumero() {
  const { user } = useAuth();

  const [numero,     setNumero]     = useState('');
  const [resultado,  setResultado]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [vendiendo,  setVendiendo]  = useState(false);
  const [rifaSelec,  setRifaSelec]  = useState(null);
  const [comprador,  setComprador]  = useState({ nombre: '', telefono: '' });
  const [ticketData, setTicketData] = useState(null);
  const [step,       setStep]       = useState('buscar'); // buscar | confirmar | ticket

  const inputRef = useRef();

  const normalizar = (val) => val.replace(/\D/g, '').slice(0, 3);

  const handleBuscar = async (e) => {
    e?.preventDefault();
    const num = numero.padStart(3, '0');
    if (num.length !== 3 || isNaN(num)) { toast.error('Ingresa un número entre 000 y 999'); return; }

    setLoading(true);
    setResultado(null);
    setRifaSelec(null);
    setTicketData(null);
    setStep('buscar');

    try {
      const res = await API.get(`/numeros/verificar/${num}`);
      setResultado(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al verificar número');
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccionarRifa = (rifa) => {
    if (!rifa.disponible) { toast.error(`⛔ El número ${numero.padStart(3,'0')} está AGOTADO en ${rifa.rifa_nombre}`); return; }
    setRifaSelec(rifa);
    setStep('confirmar');
  };

  const handleVender = async () => {
    if (!comprador.nombre.trim()) { toast.error('El nombre del comprador es requerido'); return; }
    setVendiendo(true);
    const num = numero.padStart(3, '0');
    try {
      await API.post('/numeros/vender', {
        rifa_id:          rifaSelec.rifa_id,
        numero:           num,
        nombre_comprador: comprador.nombre,
        telefono:         comprador.telefono,
      });
      toast.success(`✅ Número ${num} vendido exitosamente`);
      setTicketData({ rifa: resultado.rifas, comprador, rifaVendida: rifaSelec });
      setStep('ticket');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta';
      if (err.response?.data?.error === 'NUMERO_AGOTADO') {
        toast.error(`⛔ ${msg}`);
        handleBuscar();
      } else {
        toast.error(msg);
      }
    } finally {
      setVendiendo(false);
    }
  };

  const handleReset = () => {
    setNumero('');
    setResultado(null);
    setRifaSelec(null);
    setComprador({ nombre: '', telefono: '' });
    setTicketData(null);
    setStep('buscar');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const num3 = numero.padStart(3, '0');

  const fmtCOP = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <Layout title="VENDER NÚMERO">
      <div style={{ maxWidth: '820px' }}>

        {/* ── PASO 1: Buscar ── */}
        <div className="jd-card jd-card-primary mb-4">
          <form onSubmit={handleBuscar}>
            <label className="jd-label mb-2">BUSCAR NÚMERO (000 – 999)</label>
            <div className="d-flex gap-2">
              <input
                ref={inputRef}
                className="jd-input"
                style={{
                  fontWeight: 900, fontSize: '2.2rem', textAlign: 'center',
                  letterSpacing: '10px', maxWidth: '170px',
                  color: 'var(--jordyn-primary)', border: '2px solid var(--jordyn-primary)',
                }}
                value={numero}
                onChange={e => setNumero(normalizar(e.target.value))}
                placeholder="000"
                maxLength={3}
                autoFocus
              />
              <button type="submit" className="btn-jordyn" disabled={loading} style={{ flex: 1, fontSize: '0.95rem' }}>
                {loading
                  ? <><span className="jd-spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor:'#fff' }}></span> Buscando...</>
                  : <><i className="bi bi-search me-2"></i>VERIFICAR</>
                }
              </button>
              {(resultado || ticketData) && (
                <button type="button" className="btn-jordyn-outline" onClick={handleReset} title="Nueva búsqueda">
                  <i className="bi bi-arrow-counterclockwise"></i>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── PASO 2: Resultado ── */}
        {resultado && step === 'buscar' && (
          <div className="fade-in">
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--jordyn-muted)', marginBottom: '1rem' }}>
              NÚMERO{' '}
              <span style={{ color: 'var(--jordyn-primary)', fontSize: '1.4rem', fontWeight: 900 }}>{num3}</span>
              {' '}EN LAS RIFAS:
            </div>
            <div className="row g-3">
              {resultado.rifas.map((r) => {
                const estado = ESTADOS[r.estado] || ESTADOS.disponible;
                return (
                  <div key={r.rifa_id} className="col-12 col-md-6">
                    <div
                      className="jd-card"
                      style={{
                        border: `2px solid ${r.disponible ? 'rgba(6,214,160,0.35)' : 'rgba(230,57,70,0.25)'}`,
                        cursor: r.disponible ? 'pointer' : 'not-allowed',
                        opacity: r.disponible ? 1 : 0.7,
                        transition: 'all 0.2s',
                        background: r.disponible ? 'linear-gradient(135deg,#fff 80%,rgba(6,214,160,0.04))' : '#fff',
                      }}
                      onClick={() => r.disponible && handleSeleccionarRifa(r)}
                      onMouseEnter={e => r.disponible && (e.currentTarget.style.boxShadow = '0 4px 20px rgba(6,214,160,0.2)')}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--jordyn-text)' }}>
                            {r.rifa_nombre}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--jordyn-primary)', marginTop: 2 }}>
                            {fmtCOP(r.precio)}
                          </div>
                        </div>
                        <span className={estado.cls} style={{ fontSize: '0.68rem' }}>
                          <i className={`bi ${estado.icon} me-1`}></i>{estado.label}
                        </span>
                      </div>

                      {r.compradores?.map((c, i) => (
                        <div key={i} style={{
                          background: 'var(--jordyn-bg2)', borderRadius: 6,
                          padding: '5px 10px', marginBottom: 4, fontSize: '0.8rem',
                          border: '1px solid var(--jordyn-border)',
                        }}>
                          <i className="bi bi-person-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>
                          {c.comprador}
                          <span style={{ fontSize: '0.65rem', color: 'var(--jordyn-muted)', marginLeft: 8 }}>
                            venta #{i + 1}
                          </span>
                        </div>
                      ))}

                      {r.disponible && (
                        <div className="mt-2 text-center">
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--jordyn-primary)' }}>
                            <i className="bi bi-cursor-fill me-1"></i>CLICK PARA VENDER
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PASO 3: Datos del comprador ── */}
        {step === 'confirmar' && rifaSelec && (
          <div className="jd-card jd-card-green fade-in">
            <h5 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--jordyn-green)', marginBottom: '1.25rem' }}>
              <i className="bi bi-person-plus-fill me-2"></i>DATOS DEL COMPRADOR
            </h5>

            <div style={{
              background: 'var(--jordyn-bg2)', borderRadius: 10,
              padding: '0.85rem 1.1rem', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
              border: '1.5px solid var(--jordyn-border)',
            }}>
              <div style={{ fontWeight: 900, fontSize: '2rem', color: 'var(--jordyn-primary)', letterSpacing: '6px' }}>
                {num3}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{rifaSelec.rifa_nombre}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--jordyn-muted)' }}>🏆 {rifaSelec.premio}</div>
                <div style={{ fontWeight: 700, color: 'var(--jordyn-green)', fontSize: '0.9rem' }}>
                  {fmtCOP(rifaSelec.precio)}
                </div>
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12">
                <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                <input
                  className="jd-input"
                  value={comprador.nombre}
                  onChange={e => setComprador(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  autoFocus
                />
              </div>
              <div className="col-12">
                <label className="jd-label">TELÉFONO (opcional)</label>
                <input
                  className="jd-input"
                  value={comprador.telefono}
                  onChange={e => setComprador(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="300 000 0000"
                  type="tel"
                />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn-jordyn" onClick={handleVender} disabled={vendiendo} style={{ flex: 1 }}>
                {vendiendo
                  ? <><span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor:'#fff' }}></span> Registrando...</>
                  : <><i className="bi bi-check2-circle me-2"></i>CONFIRMAR VENTA</>
                }
              </button>
              <button className="btn-jordyn-outline" onClick={() => setStep('buscar')}>
                <i className="bi bi-arrow-left me-1"></i> Volver
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4: Ticket ── */}
        {step === 'ticket' && ticketData && (
          <div className="fade-in">
            <div className="jd-alert jd-alert-success mb-4">
              <i className="bi bi-check-circle-fill"></i>
              Venta registrada · Número <strong>{num3}</strong>
            </div>
            <Ticket
              rifa={ticketData.rifa.filter(r => r.rifa_id === rifaSelec?.rifa_id || !rifaSelec)}
              numero={num3}
              comprador={ticketData.comprador}
              vendedor={user?.nombre}
              onClose={handleReset}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}