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

/* ─── Icono WhatsApp SVG ─── */
const WaIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ─── Generar mensaje WhatsApp ─── */
const buildTicketWA = ({ numero, rifa, comprador, vendedor }) => {
  const fmtF = f => f ? new Date(f).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Por definir';
  const COP  = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
  return (
    `*RESUELVE TU SEMANA* — 🎟 Ticket de compra\n\n` +
    `Hola *${comprador.nombre}* 🎉\n\n` +
    `🎟 Número: *${numero}*\n` +
    `🏆 Premio: ${rifa?.premio || ''}\n` +
    `🎪 Rifa: ${rifa?.rifa_nombre || ''}\n` +
    `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n` +
    `💰 Valor: ${COP(rifa?.precio)}\n` +
    `👤 Vendedor: ${vendedor || 'RESUELVE TU SEMANA'}\n\n` +
    `✅ _¡Tu número está registrado! Guarda este mensaje como comprobante._\n` +
    `🌐 rifasjordyn.com`
  );
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
  const [step,       setStep]       = useState('buscar');

  const inputRef = useRef();

  const normalizar = val => val.replace(/\D/g, '').slice(0, 3);
  const num3 = numero.padStart(3, '0');
  const fmtCOP = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

  const handleBuscar = async (e) => {
    e?.preventDefault();
    const num = numero.padStart(3, '0');
    if (num.length !== 3 || isNaN(num)) { toast.error('Ingresa un número entre 000 y 999'); return; }
    setLoading(true); setResultado(null); setRifaSelec(null); setTicketData(null); setStep('buscar');
    try {
      const res = await API.get(`/numeros/verificar/${num}`);
      setResultado(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al verificar número');
    } finally { setLoading(false); }
  };

  const handleSeleccionarRifa = (rifa) => {
    if (!rifa.disponible) { toast.error(`⛔ El número ${num3} está AGOTADO en ${rifa.rifa_nombre}`); return; }
    setRifaSelec(rifa);
    setStep('confirmar');
  };

  const handleVender = async () => {
    if (!comprador.nombre.trim()) { toast.error('El nombre del comprador es requerido'); return; }
    setVendiendo(true);
    try {
      await API.post('/numeros/vender', {
        rifa_id:          rifaSelec.rifa_id,
        numero:           num3,
        nombre_comprador: comprador.nombre,
        telefono:         comprador.telefono,
      });
      toast.success(`✅ Número ${num3} vendido exitosamente`);
      setTicketData({ rifa: resultado.rifas, comprador, rifaVendida: rifaSelec });
      setStep('ticket');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta';
      if (err.response?.data?.error === 'NUMERO_AGOTADO') {
        toast.error(`⛔ ${msg}`); handleBuscar();
      } else {
        toast.error(msg);
      }
    } finally { setVendiendo(false); }
  };

  const handleReset = () => {
    setNumero(''); setResultado(null); setRifaSelec(null);
    setComprador({ nombre: '', telefono: '' }); setTicketData(null); setStep('buscar');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /* ── Compartir ticket vendido por WhatsApp ── */
  const compartirWA = () => {
    const msg = buildTicketWA({
      numero:    num3,
      rifa:      ticketData?.rifaVendida,
      comprador: ticketData?.comprador,
      vendedor:  user?.nombre,
    });
    const tel = ticketData?.comprador?.telefono?.replace(/\D/g,'') || '';
    const url = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const copiarTicket = async () => {
    const msg = buildTicketWA({ numero: num3, rifa: ticketData?.rifaVendida, comprador: ticketData?.comprador, vendedor: user?.nombre });
    await navigator.clipboard.writeText(msg);
    toast.success('Texto del ticket copiado 📋');
  };

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
                style={{ fontWeight:900, fontSize:'2.2rem', textAlign:'center', letterSpacing:'10px', maxWidth:'170px', color:'var(--jordyn-primary)', border:'2px solid var(--jordyn-primary)' }}
                value={numero}
                onChange={e => setNumero(normalizar(e.target.value))}
                placeholder="000"
                maxLength={3}
                autoFocus
              />
              <button type="submit" className="btn-jordyn" disabled={loading} style={{ flex:1, fontSize:'.95rem' }}>
                {loading
                  ? <><span className="jd-spinner" style={{ width:18, height:18, borderWidth:2, borderTopColor:'#fff' }}></span> Buscando...</>
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
            <div style={{ fontWeight:700, fontSize:'.9rem', color:'var(--jordyn-muted)', marginBottom:'1rem' }}>
              NÚMERO{' '}<span style={{ color:'var(--jordyn-primary)', fontSize:'1.4rem', fontWeight:900 }}>{num3}</span>{' '}EN LAS RIFAS:
            </div>
            <div className="row g-3">
              {resultado.rifas.map(r => {
                const estado = ESTADOS[r.estado] || ESTADOS.disponible;
                return (
                  <div key={r.rifa_id} className="col-12 col-md-6">
                    <div className="jd-card"
                      style={{ border:`2px solid ${r.disponible ? 'rgba(6,214,160,0.35)' : 'rgba(230,57,70,0.25)'}`, cursor: r.disponible ? 'pointer' : 'not-allowed', opacity: r.disponible ? 1 : 0.7, transition:'all 0.2s', background: r.disponible ? 'linear-gradient(135deg,#fff 80%,rgba(6,214,160,0.04))' : '#fff' }}
                      onClick={() => r.disponible && handleSeleccionarRifa(r)}
                      onMouseEnter={e => r.disponible && (e.currentTarget.style.boxShadow='0 4px 20px rgba(6,214,160,0.2)')}
                      onMouseLeave={e => e.currentTarget.style.boxShadow=''}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--jordyn-text)' }}>{r.rifa_nombre}</div>
                          <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
                          <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--jordyn-primary)', marginTop:2 }}>{fmtCOP(r.precio)}</div>
                        </div>
                        <span className={estado.cls} style={{ fontSize:'.68rem' }}>
                          <i className={`bi ${estado.icon} me-1`}></i>{estado.label}
                        </span>
                      </div>
                      {r.compradores?.map((c, i) => (
                        <div key={i} style={{ background:'var(--jordyn-bg2)', borderRadius:6, padding:'5px 10px', marginBottom:4, fontSize:'.8rem', border:'1px solid var(--jordyn-border)' }}>
                          <i className="bi bi-person-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
                          {c.comprador}
                          <span style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginLeft:8 }}>venta #{i+1}</span>
                        </div>
                      ))}
                      {r.disponible && (
                        <div className="mt-2 text-center">
                          <span style={{ fontWeight:700, fontSize:'.85rem', color:'var(--jordyn-primary)' }}>
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
            <h5 style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-green)', marginBottom:'1.25rem' }}>
              <i className="bi bi-person-plus-fill me-2"></i>DATOS DEL COMPRADOR
            </h5>
            <div style={{ background:'var(--jordyn-bg2)', borderRadius:10, padding:'.85rem 1.1rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'1rem', border:'1.5px solid var(--jordyn-border)' }}>
              <div style={{ fontWeight:900, fontSize:'2rem', color:'var(--jordyn-primary)', letterSpacing:'6px' }}>{num3}</div>
              <div>
                <div style={{ fontWeight:800, fontSize:'.95rem' }}>{rifaSelec.rifa_nombre}</div>
                <div style={{ fontSize:'.78rem', color:'var(--jordyn-muted)' }}>🏆 {rifaSelec.premio}</div>
                <div style={{ fontWeight:700, color:'var(--jordyn-green)', fontSize:'.9rem' }}>{fmtCOP(rifaSelec.precio)}</div>
              </div>
            </div>
            <div className="row g-3 mb-4">
              <div className="col-12">
                <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                <input className="jd-input" value={comprador.nombre} onChange={e => setComprador(p=>({...p,nombre:e.target.value}))} placeholder="Nombre completo" autoFocus />
              </div>
              <div className="col-12">
                <label className="jd-label">TELÉFONO / WHATSAPP (opcional)</label>
                <input className="jd-input" value={comprador.telefono} onChange={e => setComprador(p=>({...p,telefono:e.target.value}))} placeholder="+58 / +57 ..." type="tel" />
                <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginTop:4 }}>Incluye el código de país para poder enviar el ticket por WhatsApp</div>
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn-jordyn" onClick={handleVender} disabled={vendiendo} style={{ flex:1 }}>
                {vendiendo
                  ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2, borderTopColor:'#fff' }}></span> Registrando...</>
                  : <><i className="bi bi-check2-circle me-2"></i>CONFIRMAR VENTA</>
                }
              </button>
              <button className="btn-jordyn-outline" onClick={() => setStep('buscar')}>
                <i className="bi bi-arrow-left me-1"></i> Volver
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4: Ticket + compartir ── */}
        {step === 'ticket' && ticketData && (
          <div className="fade-in">
            <div className="jd-alert jd-alert-success mb-3">
              <i className="bi bi-check-circle-fill"></i>
              Venta registrada · Número <strong>{num3}</strong>
            </div>

            {/* Botones de compartir */}
            <div style={{ display:'flex', gap:10, marginBottom:'1.25rem', flexWrap:'wrap' }}>
              <button onClick={compartirWA}
                style={{ flex:1, minWidth:180, background:'linear-gradient(135deg,#25d366,#128c7e)', border:'none', color:'#fff', borderRadius:10, padding:'.8rem 1.25rem', cursor:'pointer', fontWeight:700, fontSize:'.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 16px rgba(37,211,102,.35)', transition:'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 6px 24px rgba(37,211,102,.5)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(37,211,102,.35)'}
              >
                <WaIcon size={19}/> Enviar ticket por WhatsApp
              </button>
              <button onClick={copiarTicket}
                style={{ background:'var(--jordyn-bg2)', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-muted)', borderRadius:10, padding:'.8rem 1.1rem', cursor:'pointer', fontWeight:600, fontSize:'.85rem', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <i className="bi bi-clipboard-fill"></i> Copiar
              </button>
              <button onClick={handleReset}
                style={{ background:'var(--jordyn-bg2)', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-primary)', borderRadius:10, padding:'.8rem 1.1rem', cursor:'pointer', fontWeight:600, fontSize:'.85rem', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <i className="bi bi-plus-circle-fill"></i> Nueva venta
              </button>
            </div>

            {ticketData.comprador?.telefono && (
              <div style={{ fontSize:'.7rem', color:'var(--jordyn-muted)', marginBottom:'1rem', display:'flex', alignItems:'center', gap:4 }}>
                <i className="bi bi-telephone-fill" style={{ color:'var(--jordyn-primary)' }}></i>
                Se enviará a: <strong style={{ marginLeft:4, color:'var(--jordyn-text)' }}>{ticketData.comprador.telefono}</strong>
              </div>
            )}

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