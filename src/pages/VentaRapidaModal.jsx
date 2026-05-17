// ============================================================
//   VentaRapidaModal.jsx — RIFAS JORDYN
//
//   Modal "⚡ Vender rápido" para crear ventas directas desde la
//   pantalla de Gestión de Reservas.
//
//   Flujo:
//   1. Elige rifa (solo las activas y creadas)
//   2. Escribe número → busca disponibilidad
//   3. Si está disponible, llena datos del cliente + mensaje
//   4. Confirma → crea reserva APROBADA + descarga ticket + abre WA
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import API from '../services/api';
import { toast } from 'react-toastify';
import { generarImagenTicket } from '../components/Ticket';
import { fmtFecha } from '../utils/dates';

const COP = n =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);

/* ── Mensaje de WhatsApp pre-armado ── */
function buildMensajeWA(reserva, nota, tasas = {}) {
  const id = reserva.id?.slice(0,8).toUpperCase() || '-------';
  const num = reserva.numero;
  const total = reserva.precio;
  const copUsd = tasas?.COP_POR_USD?.valor || 0;
  const totalUSD = copUsd > 0 ? `$${(total / copUsd).toFixed(2)} USD` : null;

  return (
    `*RIFAS JORDYN* — ✅ PAGO CONFIRMADO\n\n` +
    `Hola *${reserva.nombre_cliente}* 🎉 ¡Tu número fue aprobado!\n\n` +
    `🎟 Número: *${num}*\n` +
    `🏆 Premio: ${reserva.premio || ''}\n` +
    `🎪 Rifa: ${reserva.rifa_nombre}\n` +
    `📅 Sorteo: ${fmtFecha(reserva.fecha_sorteo)}\n` +
    `💰 Total: ${COP(total)}${totalUSD ? ` · ${totalUSD}` : ''}\n` +
    `🔖 ID Reserva: #${id}\n\n` +
    (nota ? `📝 Nota: ${nota}\n\n` : '') +
    `🎊 _¡Estás participando! Guarda este mensaje como tu comprobante._\n` +
    `🌐 rifasjordyn.com`
  );
}

const abrirWA = (telefono, texto) => {
  const num = telefono?.replace(/\D/g,'') || '';
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
};

/* ════════════════════════════════════════════════════════════
   <VentaRapidaModal>
═════════════════════════════════════════════════════════════ */
export default function VentaRapidaModal({ open, onClose, onCreada, tasas = {} }) {
  // Listas
  const [rifas, setRifas] = useState([]);
  const [loadingRifas, setLoadingRifas] = useState(false);

  // Selección
  const [rifaId, setRifaId] = useState('');
  const [numero, setNumero] = useState('');

  // Estado de consulta
  const [verificando, setVerificando] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState(null); // null | {disponible, motivo, ...}

  // Datos del cliente
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notaAdmin, setNotaAdmin] = useState('');
  const [serieElegida, setSerieElegida] = useState(null);

  // Estado de envío
  const [enviando, setEnviando] = useState(false);

  // Cargar rifas activas al abrir
  useEffect(() => {
    if (!open) return;
    setLoadingRifas(true);
    API.get('/rifas')
      .then(r => {
        const activas = (r.data || []).filter(
          x => x.activa === true && (x.estado === 'activa' || !x.estado)
        );
        setRifas(activas);
        // Auto-seleccionar la primera si solo hay una
        if (activas.length === 1) setRifaId(activas[0].id);
      })
      .catch(() => toast.error('Error cargando rifas activas'))
      .finally(() => setLoadingRifas(false));
  }, [open]);

  // Resetear al cerrar
  useEffect(() => {
    if (!open) {
      setRifaId('');
      setNumero('');
      setDisponibilidad(null);
      setNombreCliente('');
      setTelefono('');
      setNotaAdmin('');
      setSerieElegida(null);
      setEnviando(false);
    }
  }, [open]);

  // Resetear disponibilidad cuando cambia rifa o número
  useEffect(() => {
    setDisponibilidad(null);
    setSerieElegida(null);
  }, [rifaId, numero]);

  // Esc cierra
  useEffect(() => {
    if (!open) return;
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  const rifa = useMemo(() => rifas.find(r => String(r.id) === String(rifaId)), [rifas, rifaId]);

  // ── Verificar disponibilidad ──
  const handleVerificar = async () => {
    if (!rifaId) return toast.warn('Selecciona una rifa primero');
    if (!numero.trim()) return toast.warn('Escribe un número');

    setVerificando(true);
    setDisponibilidad(null);
    try {
      const numNorm = /^\d+$/.test(numero.trim()) ? numero.trim().padStart(3, '0') : numero.trim();
      const r = await API.get(`/rifas/${rifaId}/numero/${numNorm}/disponibilidad`);
      setDisponibilidad(r.data);
      if (r.data.disponible) {
        // Pre-elegir serie A si disponible, si no B
        if (r.data.disponible_a) setSerieElegida('A');
        else if (r.data.disponible_b) setSerieElegida('B');
      } else {
        toast.warn(`Número ${numNorm} no disponible`);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error verificando disponibilidad');
    } finally {
      setVerificando(false);
    }
  };

  // ── Enviar al cliente (crear venta + WA + imagen) ──
  const handleEnviar = async () => {
    if (!disponibilidad?.disponible) return;
    if (!nombreCliente.trim()) return toast.warn('Nombre del cliente requerido');

    setEnviando(true);
    try {
      // 1. Crear la reserva aprobada en el backend
      const resp = await API.post(`/rifas/${rifaId}/venta-directa`, {
        numero: disponibilidad.numero,
        nombre_cliente: nombreCliente.trim(),
        telefono: telefono.trim() || null,
        nota_admin: notaAdmin.trim() || null,
        metodo_pago: 'venta_directa',
        serie: serieElegida,
      });

      const reserva = resp.data.reserva;
      toast.success(`✅ Número ${reserva.numero} vendido a ${reserva.nombre_cliente}`);

      // 2. Generar imagen del ticket (best-effort)
      try {
        const imgDataUrl = await generarImagenTicket({
          r: {
            ...reserva,
            rifa_nombre: reserva.rifa_nombre || rifa?.nombre,
            premio: reserva.premio || rifa?.premio,
            fecha_sorteo: reserva.fecha_sorteo || rifa?.fecha_sorteo,
          },
          numero: reserva.numero,
          comprador: { nombre: reserva.nombre_cliente, telefono: reserva.telefono },
          vendedor: 'Rifas Jordyn',
        });

        if (imgDataUrl) {
          const a = document.createElement('a');
          a.href = imgDataUrl;
          a.download = `ticket-${reserva.id?.slice(0,8)}-${reserva.numero}.png`;
          a.click();
          toast.info('📸 Ticket descargado — adjúntalo al enviar WhatsApp', { autoClose: 5000 });
        }
      } catch (e) {
        console.warn('No se pudo generar imagen del ticket:', e);
      }

      // 3. Abrir WhatsApp con mensaje pre-armado
      const msg = buildMensajeWA({
        ...reserva,
        rifa_nombre: reserva.rifa_nombre || rifa?.nombre,
        premio: reserva.premio || rifa?.premio,
        fecha_sorteo: reserva.fecha_sorteo || rifa?.fecha_sorteo,
      }, notaAdmin, tasas);
      abrirWA(telefono, msg);

      // 4. Notificar al padre y cerrar
      if (onCreada) onCreada(reserva);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error creando la venta');
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={S.overlay}>
      <div onClick={e => e.stopPropagation()} style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>⚡ Venta rápida por número</h2>
            <p style={S.subtitle}>
              Buscar disponibilidad, generar ticket y enviar al cliente
            </p>
          </div>
          <button onClick={onClose} style={S.btnClose}>×</button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* Paso 1: Seleccionar rifa */}
          <section style={S.section}>
            <label style={S.label}>1️⃣ Rifa activa</label>
            {loadingRifas ? (
              <div style={S.loadingBox}>Cargando rifas…</div>
            ) : rifas.length === 0 ? (
              <div style={S.warningBox}>
                ⚠️ No hay rifas activas. Crea o activa una rifa primero.
              </div>
            ) : (
              <select
                value={rifaId}
                onChange={e => setRifaId(e.target.value)}
                style={S.input}
                disabled={enviando}
              >
                <option value="">— Selecciona una rifa —</option>
                {rifas.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} — {r.premio} ({COP(r.precio)})
                    {r.tipo === 'simultanea' ? ' · Simultánea A/B' : ''}
                  </option>
                ))}
              </select>
            )}
            {rifa && (
              <div style={S.rifaInfo}>
                💰 <b>{COP(rifa.precio)}</b> por número ·
                🏆 {rifa.premio} ·
                📅 {fmtFecha(rifa.fecha_sorteo)}
              </div>
            )}
          </section>

          {/* Paso 2: Buscar número */}
          {rifaId && (
            <section style={S.section}>
              <label style={S.label}>2️⃣ Buscar número</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={numero}
                  onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => { if (e.key === 'Enter') handleVerificar(); }}
                  placeholder="ej. 123"
                  style={{ ...S.input, fontFamily: 'monospace', fontSize: 18,
                    letterSpacing: 4, textAlign: 'center', fontWeight: 700 }}
                  disabled={verificando || enviando}
                  autoFocus
                />
                <button
                  onClick={handleVerificar}
                  disabled={verificando || enviando || !numero.trim()}
                  style={{
                    ...S.btnVerificar,
                    opacity: (verificando || !numero.trim()) ? 0.5 : 1,
                    cursor:  (verificando || !numero.trim()) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {verificando ? '⏳ Buscando…' : '🔍 Buscar'}
                </button>
              </div>

              {/* Resultado */}
              {disponibilidad && (
                <div style={{
                  ...S.resultBox,
                  background: disponibilidad.disponible ? '#e6faf0' : '#ffe5e5',
                  borderColor: disponibilidad.disponible ? '#9ae3b5' : '#f5a5a5',
                }}>
                  {disponibilidad.disponible ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 28 }}>✅</span>
                        <div>
                          <div style={{ fontWeight: 800, color: '#059669', fontSize: 16 }}>
                            Número {disponibilidad.numero} DISPONIBLE
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            Precio: <b>{COP(disponibilidad.rifa.precio)}</b>
                          </div>
                        </div>
                      </div>

                      {/* Selector de serie si es simultánea */}
                      {disponibilidad.es_simultanea && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Serie:</span>
                          {['A', 'B'].map(s => {
                            const disp = (s === 'A' && disponibilidad.disponible_a)
                                      || (s === 'B' && disponibilidad.disponible_b);
                            return (
                              <button
                                key={s}
                                disabled={!disp}
                                onClick={() => setSerieElegida(s)}
                                style={{
                                  padding: '5px 14px',
                                  background: serieElegida === s ? '#059669' : (disp ? '#fff' : '#f5f5f5'),
                                  color: serieElegida === s ? '#fff' : (disp ? '#059669' : '#bbb'),
                                  border: `1.5px solid ${disp ? '#059669' : '#ddd'}`,
                                  borderRadius: 6,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: disp ? 'pointer' : 'not-allowed',
                                  fontFamily: 'inherit',
                                }}
                              >
                                Serie {s} {!disp && '✗'}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 28 }}>❌</span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#a02020', fontSize: 16 }}>
                          Número {disponibilidad.numero} NO disponible
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                          {disponibilidad.detalle?.map((d, i) => (
                            <div key={i}>
                              · Serie {d.serie}: {
                                d.motivo === 'vendido'    ? 'vendido' :
                                d.motivo === 'reservado'  ? 'reservado' :
                                d.motivo === 'asignado_a_categoria' ? 'asignado a categoría global' :
                                d.motivo === 'boleteria_extra'      ? 'asignado a vendedor' :
                                d.motivo
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Paso 3: Datos del cliente — solo si está disponible */}
          {disponibilidad?.disponible && (
            <section style={S.section}>
              <label style={S.label}>3️⃣ Datos del cliente</label>

              <input
                type="text"
                value={nombreCliente}
                onChange={e => setNombreCliente(e.target.value)}
                placeholder="Nombre completo del cliente *"
                style={S.input}
                disabled={enviando}
              />

              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Teléfono (con código país, ej. 573001234567)"
                style={{ ...S.input, marginTop: 8 }}
                disabled={enviando}
              />
              <div style={S.hint}>
                💡 Si dejas el teléfono vacío, abrirá WhatsApp sin destinatario para que elijas.
              </div>

              <textarea
                value={notaAdmin}
                onChange={e => setNotaAdmin(e.target.value)}
                placeholder="Nota adicional para el mensaje (opcional)"
                rows={2}
                style={{ ...S.input, marginTop: 8, resize: 'vertical', fontFamily: 'inherit' }}
                disabled={enviando}
              />

              {/* Preview del mensaje WA */}
              {nombreCliente.trim() && (
                <details style={S.preview}>
                  <summary style={S.previewSummary}>
                    💬 Previsualizar mensaje de WhatsApp
                  </summary>
                  <pre style={S.previewText}>
                    {buildMensajeWA({
                      id: 'PREVIEW',
                      numero: disponibilidad.numero,
                      nombre_cliente: nombreCliente,
                      precio: disponibilidad.rifa.precio,
                      premio: disponibilidad.rifa.premio,
                      rifa_nombre: disponibilidad.rifa.nombre,
                      fecha_sorteo: disponibilidad.rifa.fecha_sorteo,
                    }, notaAdmin, tasas)}
                  </pre>
                </details>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        {disponibilidad?.disponible && (
          <div style={S.footer}>
            <button
              onClick={onClose}
              disabled={enviando}
              style={S.btnCancel}
            >Cancelar</button>
            <button
              onClick={handleEnviar}
              disabled={enviando || !nombreCliente.trim()}
              style={{
                ...S.btnEnviar,
                opacity: (enviando || !nombreCliente.trim()) ? 0.5 : 1,
                cursor:  (enviando || !nombreCliente.trim()) ? 'not-allowed' : 'pointer',
              }}
            >
              {enviando
                ? '⏳ Procesando…'
                : '✅ Vender y enviar WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Estilos ─────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.6)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '40px 20px',
    zIndex: 10000,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 20px 60px rgba(0,0,0,.4)',
    overflow: 'hidden',
    fontFamily: "'Poppins', system-ui, sans-serif",
    maxHeight: 'calc(100vh - 80px)',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    background: 'linear-gradient(135deg, #0abfbc 0%, #089a98 100%)',
    color: '#fff',
    padding: '16px 22px',
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 12,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 800 },
  subtitle: { margin: '4px 0 0', fontSize: 12, opacity: .9 },
  btnClose: {
    background: 'rgba(255,255,255,.18)',
    border: 'none', color: '#fff',
    width: 30, height: 30, borderRadius: 6,
    fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0,
    flexShrink: 0,
  },
  body: {
    padding: 22,
    overflowY: 'auto',
    flex: 1,
  },
  section: { marginBottom: 18 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#0abfbc', letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #ddd',
    borderRadius: 7,
    fontSize: 14,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color .12s',
  },
  rifaInfo: {
    marginTop: 8, padding: '8px 12px',
    background: '#f0fbfb', borderRadius: 6,
    fontSize: 12, color: '#0a8a88',
  },
  loadingBox: {
    padding: 14, textAlign: 'center',
    background: '#fafafa', borderRadius: 6,
    color: '#888', fontSize: 13,
  },
  warningBox: {
    padding: 14, background: '#fff3cd',
    border: '1px solid #f0c674', borderRadius: 6,
    color: '#8a6d00', fontSize: 13,
  },
  btnVerificar: {
    padding: '0 18px',
    background: '#0abfbc', color: '#fff',
    border: 'none', borderRadius: 7,
    fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  resultBox: {
    marginTop: 10,
    padding: 12,
    border: '1.5px solid',
    borderRadius: 8,
  },
  hint: {
    fontSize: 11, color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  preview: {
    marginTop: 10,
    background: '#f8fafa',
    border: '1px solid #d0e8e8',
    borderRadius: 6,
    padding: '8px 12px',
  },
  previewSummary: {
    cursor: 'pointer', fontSize: 12,
    fontWeight: 700, color: '#0a8a88',
  },
  previewText: {
    margin: '8px 0 0',
    fontSize: 11,
    fontFamily: 'monospace',
    background: '#fff',
    padding: 10,
    borderRadius: 4,
    whiteSpace: 'pre-wrap',
    color: '#333',
    border: '1px solid #eee',
  },
  footer: {
    padding: 16,
    background: '#f8fafa',
    borderTop: '1px solid #e0e0e0',
    display: 'flex', gap: 10,
    justifyContent: 'flex-end',
  },
  btnCancel: {
    padding: '10px 18px',
    background: '#fff', color: '#666',
    border: '1.5px solid #ddd', borderRadius: 7,
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnEnviar: {
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #25d366, #128c7e)',
    color: '#fff', border: 'none',
    borderRadius: 7, fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(37,211,102,.35)',
  },
};
