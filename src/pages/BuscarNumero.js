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

  const [numero,      setNumero]      = useState('');
  const [resultado,   setResultado]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [vendiendo,   setVendiendo]   = useState(false);
  const [rifaSelec,   setRifaSelec]   = useState(null);  // rifa seleccionada para vender
  const [comprador,   setComprador]   = useState({ nombre: '', telefono: '' });
  const [ticketData,  setTicketData]  = useState(null);  // después de vender
  const [step,        setStep]        = useState('buscar'); // buscar | confirmar | ticket

  const inputRef = useRef();

  // Normalizar número a 3 dígitos
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
        rifa_id: rifaSelec.rifa_id,
        numero: num,
        nombre_comprador: comprador.nombre,
        telefono: comprador.telefono,
      });
      toast.success(`✅ Número ${num} vendido exitosamente`);
      setTicketData({
        rifa: resultado.rifas,
        comprador,
        rifaVendida: rifaSelec,
      });
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

  return (
    <Layout title="VENDER NÚMERO">
      <div style={{ maxWidth: '800px' }}>

        {/* ── PASO 1: Buscar ─────────────────────────────── */}
        <div className="jd-card jd-card-gold mb-4">
          <form onSubmit={handleBuscar}>
            <label className="jd-label mb-2">BUSCAR NÚMERO (000 – 999)</label>
            <div className="d-flex gap-2">
              <input
                ref={inputRef}
                className="jd-input"
                style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', maxWidth: '160px' }}
                value={numero}
                onChange={e => setNumero(normalizar(e.target.value))}
                placeholder="000"
                maxLength={3}
                autoFocus
              />
              <button type="submit" className="btn-jordyn" disabled={loading} style={{ flex: 1, fontSize: '1rem' }}>
                {loading
                  ? <><span className="jd-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> BUSCANDO...</>
                  : <><i className="bi bi-search me-2"></i>VERIFICAR</>
                }
              </button>
              {(resultado || ticketData) && (
                <button type="button" className="btn-jordyn-outline" onClick={handleReset}>
                  <i className="bi bi-arrow-counterclockwise"></i>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── PASO 2: Resultado de búsqueda ──────────────── */}
        {resultado && step === 'buscar' && (
          <div className="fade-in">
            <h5 style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '2px', marginBottom: '1rem', color: 'var(--jordyn-muted)', fontSize: '1rem' }}>
              NÚMERO <span style={{ color: 'var(--jordyn-gold)', fontSize: '1.4rem' }}>{num3}</span> EN LAS RIFAS:
            </h5>
            <div className="row g-3">
              {resultado.rifas.map((r) => {
                const estado = ESTADOS[r.estado] || ESTADOS.disponible;
                return (
                  <div key={r.rifa_id} className="col-12 col-md-6">
                    <div
                      className={`jd-card ${r.disponible ? '' : 'opacity-75'}`}
                      style={{
                        border: `1px solid ${r.disponible ? 'rgba(6,214,160,0.3)' : 'rgba(230,57,70,0.3)'}`,
                        cursor: r.disponible ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => r.disponible && handleSeleccionarRifa(r)}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1rem', letterSpacing: '2px', color: 'var(--jordyn-text)' }}>
                            {r.rifa_nombre}
                          </div>
                          <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
                        </div>
                        <span className={estado.cls} style={{ fontSize: '0.7rem' }}>
                          <i className={`bi ${estado.icon} me-1`}></i>{estado.label}
                        </span>
                      </div>

                      {/* Compradores previos */}
                      {r.compradores?.map((c, i) => (
                        <div key={i} style={{ background: '#1a1a1a', borderRadius: '4px', padding: '6px 10px', marginBottom: '4px', fontSize: '0.8rem' }}>
                          <i className="bi bi-person-fill me-1" style={{ color: 'var(--jordyn-muted)' }}></i>
                          {c.comprador}
                          <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.65rem', color: 'var(--jordyn-muted)', marginLeft: '8px' }}>
                            venta #{i + 1}
                          </span>
                        </div>
                      ))}

                      {r.disponible && (
                        <div className="mt-2 text-center">
                          <span style={{ fontFamily: 'var(--jordyn-display)', fontSize: '0.9rem', color: 'var(--jordyn-green)', letterSpacing: '2px' }}>
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

        {/* ── PASO 3: Confirmar datos del comprador ──────── */}
        {step === 'confirmar' && rifaSelec && (
          <div className="jd-card jd-card-green fade-in">
            <h5 style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.2rem', letterSpacing: '2px', color: 'var(--jordyn-green)', marginBottom: '1.5rem' }}>
              <i className="bi bi-person-plus-fill me-2"></i>DATOS DEL COMPRADOR
            </h5>

            {/* Info de lo que se va a vender */}
            <div style={{ background: '#1a1a1a', borderRadius: '6px', padding: '0.8rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '2rem', fontWeight: 900, color: 'var(--jordyn-gold)', letterSpacing: '6px' }}>{num3}</div>
              <div>
                <div style={{ fontFamily: 'var(--jordyn-display)', letterSpacing: '1px' }}>{rifaSelec.rifa_nombre}</div>
                <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)' }}>
                  {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(rifaSelec.precio)}
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
              <button className="btn-jordyn" onClick={handleVender} disabled={vendiendo} style={{ flex: 1, fontSize: '1rem' }}>
                {vendiendo
                  ? <><span className="jd-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> REGISTRANDO...</>
                  : <><i className="bi bi-check2-circle me-2"></i>CONFIRMAR VENTA</>
                }
              </button>
              <button className="btn-jordyn-outline" onClick={() => setStep('buscar')}>
                <i className="bi bi-arrow-left"></i> VOLVER
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4: Boleto listo para imprimir ─────────── */}
        {step === 'ticket' && ticketData && (
          <div className="fade-in">
            <div className="jd-alert jd-alert-success mb-4">
              <i className="bi bi-check-circle-fill"></i>
              Venta registrada exitosamente · Número <strong>{num3}</strong>
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