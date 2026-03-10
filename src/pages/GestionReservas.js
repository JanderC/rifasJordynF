import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const COP = n =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

const fmtFecha = f =>
  new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ── Configuración visual por estado ── */
const EST = {
  pendiente: { bg:'rgba(240,165,0,0.10)',  color:'#b37700',              border:'rgba(240,165,0,0.30)',  label:'⏳ Pendiente',  dot:'#f0a500' },
  aprobado:  { bg:'rgba(6,214,160,0.10)',  color:'#059669',              border:'rgba(6,214,160,0.30)',  label:'✅ Aprobado',   dot:'#06d6a0' },
  rechazado: { bg:'rgba(230,57,70,0.10)',  color:'var(--jordyn-red)',    border:'rgba(230,57,70,0.25)',  label:'❌ Rechazado',  dot:'#e63946' },
};

/* ══════════════════════════════════════════════════
   MODAL DE DETALLE DE RESERVA
══════════════════════════════════════════════════ */
function ModalReserva({ reserva, onClose, onAccion, saving }) {
  const [nota, setNota] = useState(reserva.nota_admin || '');
  const est = EST[reserva.estado] || EST.pendiente;
  const esPendiente = reserva.estado === 'pendiente';

  /* Cerrar con Escape */
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,30,30,0.55)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', animation: 'fadeIn .2s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 620,
        maxHeight: '92vh',
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(10,191,188,0.20)',
        animation: 'popIn .25s cubic-bezier(.175,.885,.32,1.275)',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))',
          padding: '1.1rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>
              Reserva #{reserva.id?.slice(0, 8).toUpperCase()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.7rem', marginTop: 2 }}>
              {fmtFecha(reserva.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 20, padding: '3px 12px', fontSize: '0.72rem', fontWeight: 700,
            }}>
              {est.label}
            </span>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: '#fff', borderRadius: 8, padding: '6px 11px',
              cursor: 'pointer', fontSize: '1rem',
            }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* ── Cuerpo ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* Número grande + datos clave */}
          <div style={{
            display: 'flex', gap: '1rem', alignItems: 'stretch',
            marginBottom: '1.25rem', flexWrap: 'wrap',
          }}>
            {/* Número */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(10,191,188,0.08), rgba(10,191,188,0.04))',
              border: '2px solid rgba(10,191,188,0.25)',
              borderRadius: 12, padding: '1rem 1.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minWidth: 120, flexShrink: 0,
            }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                NÚMERO
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--jordyn-primary)', letterSpacing: '8px', lineHeight: 1 }}>
                {reserva.numero}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--jordyn-muted)', marginTop: 4 }}>
                {reserva.rifa_nombre}
              </div>
            </div>

            {/* Datos del cliente */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 200 }}>
              {[
                { l: 'Cliente',      v: reserva.nombre_cliente, bold: true },
                { l: 'Teléfono',     v: reserva.telefono || '—' },
                { l: 'Rifa',         v: reserva.rifa_nombre },
                { l: 'Valor',        v: COP(reserva.precio), color: 'var(--jordyn-green)' },
                { l: 'Método pago',  v: reserva.metodo_pago || '—' },
                { l: 'Premio',       v: reserva.premio || '—' },
              ].map(({ l, v, bold, color }) => (
                <div key={l} style={{
                  background: 'var(--jordyn-bg2)',
                  borderRadius: 8, padding: '8px 12px',
                  border: '1px solid var(--jordyn-border)',
                }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    {l}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: bold ? 700 : 500, color: color || 'var(--jordyn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comprobante de pago */}
          {reserva.comprobante_base64 ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="bi bi-paperclip" style={{ color: 'var(--jordyn-primary)' }}></i>
                COMPROBANTE DE PAGO
              </div>
              <div style={{ border: '2px solid var(--jordyn-border)', borderRadius: 10, overflow: 'hidden', background: 'var(--jordyn-bg2)' }}>
                <img
                  src={reserva.comprobante_base64}
                  alt="Comprobante"
                  style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }}
                />
              </div>
              {reserva.comprobante_nombre && (
                <div style={{ fontSize: '0.7rem', color: 'var(--jordyn-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="bi bi-file-earmark-image"></i>
                  {reserva.comprobante_nombre}
                </div>
              )}
            </div>
          ) : (
            <div className="jd-alert jd-alert-warning mb-4" style={{ fontSize: '0.8rem' }}>
              <i className="bi bi-exclamation-triangle-fill"></i>
              El cliente no adjuntó comprobante de pago.
            </div>
          )}

          {/* Nota admin existente (si ya fue procesada) */}
          {!esPendiente && reserva.nota_admin && (
            <div style={{
              background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)',
              borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                Nota enviada al cliente
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--jordyn-text)' }}>{reserva.nota_admin}</div>
            </div>
          )}

          {/* ── Acciones (solo pendiente) ── */}
          {esPendiente && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label className="jd-label">NOTA PARA EL CLIENTE (opcional)</label>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  className="jd-input"
                  rows={2}
                  placeholder="Ej: Pago confirmado, gracias. / El comprobante no corresponde al valor."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => onAccion('rechazado', nota)}
                  disabled={saving}
                  style={{
                    flex: 1, background: 'rgba(230,57,70,0.07)',
                    border: '1.5px solid rgba(230,57,70,0.35)',
                    color: 'var(--jordyn-red)',
                    borderRadius: 10, padding: '0.75rem',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(230,57,70,0.14)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(230,57,70,0.07)'}
                >
                  <i className="bi bi-x-circle-fill"></i> RECHAZAR
                </button>
                <button
                  onClick={() => onAccion('aprobado', nota)}
                  disabled={saving}
                  style={{
                    flex: 2,
                    background: 'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))',
                    border: 'none', color: '#fff',
                    borderRadius: 10, padding: '0.75rem',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(10,191,188,0.3)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = '0 6px 20px rgba(10,191,188,0.45)'; }}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(10,191,188,0.3)'}
                >
                  {saving
                    ? <><span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }}></span> Procesando...</>
                    : <><i className="bi bi-check-circle-fill"></i> APROBAR Y REGISTRAR VENTA</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { from{opacity:0;transform:scale(.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PANEL: Números reservados por rifa
══════════════════════════════════════════════════ */
function PanelNumerosReservados({ reservas }) {
  /* Agrupar por rifa */
  const porRifa = reservas.reduce((acc, r) => {
    if (r.estado !== 'pendiente') return acc;
    if (!acc[r.rifa_id]) acc[r.rifa_id] = { nombre: r.rifa_nombre, numeros: [] };
    acc[r.rifa_id].numeros.push({ numero: r.numero, cliente: r.nombre_cliente, id: r.id });
    return acc;
  }, {});

  const rifas = Object.values(porRifa);
  if (!rifas.length) return null;

  return (
    <div className="jd-card jd-card-primary mb-4">
      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--jordyn-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-lock-fill"></i>
        NÚMEROS BLOQUEADOS PENDIENTES DE APROBACIÓN
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rifas.map(rifa => (
          <div key={rifa.nombre}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              {rifa.nombre} — {rifa.numeros.length} bloqueado(s)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rifa.numeros.map(n => (
                <div key={n.id} style={{
                  background: 'rgba(240,165,0,0.10)',
                  border: '1.5px solid rgba(240,165,0,0.35)',
                  borderRadius: 8, padding: '5px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#b37700', letterSpacing: 2 }}>{n.numero}</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--jordyn-muted)', marginTop: 1, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.cliente}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════ */
export default function GestionReservas() {
  const [reservas, setReservas] = useState([]);
  const [todas,    setTodas]    = useState([]);   // siempre todas (para el panel de bloqueados)
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('pendiente');
  const [selR,     setSelR]     = useState(null);
  const [saving,   setSaving]   = useState(false);

  const loadTodas = useCallback(async () => {
    try {
      const r = await API.get('/publico/admin/reservas');
      setTodas(r.data);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filtro === 'todos'
        ? '/publico/admin/reservas'
        : `/publico/admin/reservas?estado=${filtro}`;
      const r = await API.get(url);
      setReservas(r.data);
    } catch { toast.error('Error cargando reservas'); }
    finally { setLoading(false); }
  }, [filtro]);

  useEffect(() => { load(); loadTodas(); }, [load, loadTodas]);

  const handleAccion = async (estado, nota) => {
    if (!selR) return;
    setSaving(true);
    try {
      await API.put(`/publico/admin/reservas/${selR.id}`, { estado, nota_admin: nota });
      toast.success(
        estado === 'aprobado'
          ? '✅ Reserva aprobada — venta registrada automáticamente'
          : '❌ Reserva rechazada — número liberado'
      );
      setSelR(null);
      load();
      loadTodas();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error procesando reserva');
    } finally {
      setSaving(false);
    }
  };

  /* Conteos para las pestañas */
  const conteos = todas.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    acc.todos = (acc.todos || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { key: 'pendiente', label: 'Pendientes', icon: 'bi-hourglass-split',  color: '#b37700',              count: conteos.pendiente || 0 },
    { key: 'aprobado',  label: 'Aprobados',  icon: 'bi-check-circle-fill', color: '#059669',             count: conteos.aprobado  || 0 },
    { key: 'rechazado', label: 'Rechazados', icon: 'bi-x-circle-fill',    color: 'var(--jordyn-red)',    count: conteos.rechazado || 0 },
    { key: 'todos',     label: 'Todos',      icon: 'bi-list-ul',           color: 'var(--jordyn-muted)', count: conteos.todos     || 0 },
  ];

  return (
    <Layout title="RESERVAS DE CLIENTES">

      {/* Panel números bloqueados */}
      <PanelNumerosReservados reservas={todas} />

      {/* Tabs de filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem',
              border: `1.5px solid ${filtro === t.key ? t.color : 'var(--jordyn-border)'}`,
              background: filtro === t.key ? `${t.color}14` : '#fff',
              color: filtro === t.key ? t.color : 'var(--jordyn-muted)',
              transition: 'all 0.15s',
            }}
          >
            <i className={`bi ${t.icon}`}></i>
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: filtro === t.key ? t.color : 'var(--jordyn-bg2)',
                color: filtro === t.key ? '#fff' : 'var(--jordyn-muted)',
                borderRadius: 20, padding: '0px 7px', fontSize: '0.7rem', fontWeight: 800,
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de reservas */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="jd-spinner" style={{ width: 44, height: 44 }}></div>
        </div>
      ) : reservas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📭</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--jordyn-text)', marginBottom: 4 }}>
            Sin reservas
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)' }}>
            No hay reservas con el filtro seleccionado
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reservas.map(r => {
            const est = EST[r.estado] || EST.pendiente;
            return (
              <div
                key={r.id}
                onClick={() => setSelR(r)}
                className="jd-card"
                style={{
                  cursor: 'pointer', padding: '0.9rem 1.25rem',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                  borderLeft: `3px solid ${est.dot}`,
                  transition: 'box-shadow 0.15s, transform 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,191,188,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
              >
                {/* Número */}
                <div style={{
                  width: 54, height: 54, borderRadius: 10, flexShrink: 0,
                  background: est.bg, border: `1.5px solid ${est.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '1.2rem', color: est.color, letterSpacing: 2,
                }}>
                  {r.numero}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--jordyn-text)', marginBottom: 1 }}>
                    {r.nombre_cliente}
                    {r.comprobante_base64 && (
                      <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--jordyn-primary)', fontWeight: 600 }}>
                        <i className="bi bi-paperclip me-1"></i>Comprobante
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>
                    {r.rifa_nombre}
                    {r.telefono && <span style={{ marginLeft: 10 }}><i className="bi bi-telephone-fill me-1"></i>{r.telefono}</span>}
                    {r.metodo_pago && <span style={{ marginLeft: 10 }}><i className="bi bi-credit-card me-1"></i>{r.metodo_pago}</span>}
                  </div>
                </div>

                {/* Valor */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--jordyn-green)' }}>
                    {COP(r.precio)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
                    {fmtFecha(r.created_at)}
                  </div>
                </div>

                {/* Badge estado */}
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    background: est.bg, color: est.color,
                    border: `1.5px solid ${est.border}`,
                    borderRadius: 20, padding: '3px 12px',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {est.label}
                  </span>
                </div>

                {/* Flecha */}
                <i className="bi bi-chevron-right" style={{ color: 'var(--jordyn-muted)', flexShrink: 0 }}></i>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle */}
      {selR && (
        <ModalReserva
          reserva={selR}
          onClose={() => setSelR(null)}
          onAccion={handleAccion}
          saving={saving}
        />
      )}
    </Layout>
  );
}