// ============================================================
//   GestionRifas.js — RIFAS JORDYN
//   CAMBIOS v3:
//   - SelectorCategoria con selección individual de vendedores.
//   - Checkboxes por vendedor: se puede incluir/excluir de la rifa.
//   - checkbox maestro con estado indeterminado.
//   - El payload solo incluye los vendedores seleccionados.
//   - Series A y B mostradas por separado en rifas simultáneas.
//   - Monto pendiente calculado solo para vendedores seleccionados.
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, printTickets } from '../components/Ticket';
import { useAuth } from '../context/AuthContext';

/* ─── Loterías ─── */
const LOTERIAS = [
  { grupo: 'Colombia', items: [
    'Baloto','Revancha Baloto','Lotería de Bogotá','Lotería del Tolima',
    'Lotería de Cundinamarca','Lotería de Boyacá','Lotería del Huila',
    'Lotería de Caldas','Lotería del Quindío','Lotería de Risaralda',
    'Lotería del Meta','Lotería de Santander','Lotería del Valle',
    'Lotería del Cauca','Lotería de Manizales','Lotería de Armenia',
    'Chance Codechocó','La Greca','Dorado','Culona','Paisita',
    'Pijao de Oro','Cafeterito','Super Astro Sol','Super Astro Luna',
  ]},
  { grupo: 'Venezuela', items: [
    'Lotería del Táchira','Lotería de Mérida','Lotería del Zulia',
    'Lotería de Caracas','Lottery Venezuela','Animalitos','Tripleta',
    'La Greca Venezuela','El Kino','Chance Venezuela',
  ]},
  { grupo: 'Otra', items: ['Otra lotería / referencia propia'] },
];

const emptyForm = {
  nombre: '', descripcion: '', premio: '', precio: '', precio_display: '',
  fecha_sorteo: '', loteria_ref: '', tipo: 'sencilla', imagen_base64: '',
  ofertas: [],
  categoria_seleccionada_id: null,
};

const fmtCOP = v =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const parseCOP = str => parseInt(str.replace(/\D/g, '') || '0');
const fileToBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

const parseFecha = (f) => {
  if (!f) return null;
  const d = new Date(String(f).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmtF = f => {
  const d = parseFecha(f);
  if (!d) return 'Sin fecha';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Caracas' });
};
const fmtHora = f => {
  const d = parseFecha(f);
  if (!d) return null;
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Caracas' });
};

/* ─── Estados del grid ─── */
const ESTADO_GRID = {
  libre:           { color: '#059669', bg: 'rgba(6,214,160,0.10)',  border: 'rgba(6,214,160,0.25)',  icon: '✓', label: 'LIBRE' },
  parcial_vendido: { color: '#b37700', bg: 'rgba(240,165,0,0.12)',  border: 'rgba(240,165,0,0.28)',  icon: '½', label: '1 VENTA' },
  parcial_agotado: { color: '#c0303a', bg: 'rgba(230,57,70,0.12)',  border: 'rgba(230,57,70,0.30)',  icon: '⚡', label: 'SEMI AGOT.' },
  agotado_total:   { color: '#e63946', bg: 'rgba(230,57,70,0.22)',  border: 'rgba(230,57,70,0.45)',  icon: '✗', label: 'AGOTADO' },
  sin_asignar:     { color: '#6b9090', bg: 'rgba(10,191,188,0.06)', border: 'rgba(10,191,188,0.18)', icon: '·', label: 'SIN ASIGNAR' },
  reservado:       { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', icon: '🔒', label: 'RESERVADO' },
};
const EST_RIFA_MODAL = {
  disponible: { color: '#059669', icon: '✓', label: 'DISPONIBLE' },
  vendido_1:  { color: '#b37700', icon: '½', label: '1 DE 2 VENDIDO' },
  agotado:    { color: '#e63946', icon: '✗', label: 'AGOTADO' },
};

/* ════════════════════════════════════════════════════════════
   EDITOR DE OFERTAS
════════════════════════════════════════════════════════════ */
function EditorOfertas({ ofertas = [], onChange, precioBase = 0 }) {
  const [nuevaCant,   setNuevaCant]   = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevaEtiq,   setNuevaEtiq]   = useState('');
  const [error,       setError]       = useState('');

  const agregarOferta = () => {
    setError('');
    const cant   = parseInt(nuevaCant);
    const precio = parseCOP(nuevoPrecio);
    if (!cant || cant < 2)      { setError('La cantidad mínima es 2'); return; }
    if (!precio || precio <= 0) { setError('El precio debe ser mayor a 0'); return; }
    if (precio >= precioBase * cant && precioBase > 0) {
      setError(`El precio de oferta (${fmtCOP(precio)}) debe ser menor que el precio normal (${fmtCOP(precioBase * cant)})`);
      return;
    }
    if (ofertas.find(o => o.cantidad === cant)) { setError(`Ya existe una oferta para ${cant} números`); return; }
    onChange([...ofertas, { cantidad: cant, precio_total: precio, etiqueta: nuevaEtiq.trim() || `Pack ${cant}` }].sort((a, b) => a.cantidad - b.cantidad));
    setNuevaCant(''); setNuevoPrecio(''); setNuevaEtiq('');
  };

  const eliminarOferta = (cant) => onChange(ofertas.filter(o => o.cantidad !== cant));
  const editarEtiqueta = (cant, val) => onChange(ofertas.map(o => o.cantidad === cant ? { ...o, etiqueta: val } : o));
  const descuento = (o) => {
    if (!precioBase) return null;
    const normal = precioBase * o.cantidad;
    return { pct: Math.round((1 - o.precio_total / normal) * 100), ahorras: normal - o.precio_total };
  };

  return (
    <div style={{ marginTop: 4 }}>
      {ofertas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px', background: 'var(--jordyn-bg2)', borderRadius: 10, border: '1px dashed var(--jordyn-border)', color: 'var(--jordyn-muted)', fontSize: '.78rem', marginBottom: 12 }}>
          Sin ofertas configuradas — los clientes pagarán el precio unitario siempre.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {ofertas.map(o => {
            const desc = descuento(o);
            return (
              <div key={o.cantidad} style={{ background: 'rgba(10,191,188,.05)', border: '1.5px solid rgba(10,191,188,.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--jordyn-primary)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 900, fontSize: '.85rem', flexShrink: 0 }}>×{o.cantidad}</div>
                <input value={o.etiqueta} onChange={e => editarEtiqueta(o.cantidad, e.target.value)}
                  style={{ flex: '1 1 110px', minWidth: 80, border: '1px solid var(--jordyn-border)', borderRadius: 7, padding: '5px 9px', fontSize: '.8rem', fontFamily: 'var(--jordyn-font)', color: 'var(--jordyn-text)', background: '#fff' }}
                  placeholder="Nombre de la oferta" />
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: 'var(--jordyn-primary)', fontSize: '.88rem' }}>{fmtCOP(o.precio_total)}</div>
                  {desc && <div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)' }}>Ahorra {fmtCOP(desc.ahorras)} · <span style={{ color: '#059669', fontWeight: 700 }}>−{desc.pct}%</span></div>}
                  {precioBase > 0 && <div style={{ fontSize: '.58rem', color: 'var(--jordyn-muted)', textDecoration: 'line-through' }}>Normal: {fmtCOP(precioBase * o.cantidad)}</div>}
                </div>
                <button onClick={() => eliminarOferta(o.cantidad)} style={{ background: 'rgba(230,57,70,.08)', border: '1px solid rgba(230,57,70,.3)', color: '#e63946', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem', flexShrink: 0 }}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ background: 'var(--jordyn-bg2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--jordyn-border)' }}>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
          <i className="bi bi-plus-circle-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>Agregar oferta
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <label className="jd-label" style={{ fontSize: '.6rem' }}>CANT. MÍNIMA</label>
            <input className="jd-input" type="number" min="2" max="50" value={nuevaCant} onChange={e => setNuevaCant(e.target.value)} placeholder="3" style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem' }} />
          </div>
          <div>
            <label className="jd-label" style={{ fontSize: '.6rem' }}>PRECIO TOTAL</label>
            <input className="jd-input" value={nuevoPrecio} onChange={e => setNuevoPrecio(e.target.value)}
              onFocus={() => setNuevoPrecio(nuevoPrecio.replace(/\D/g, ''))}
              onBlur={() => nuevoPrecio && setNuevoPrecio(fmtCOP(parseCOP(nuevoPrecio)))}
              placeholder="$25.000" style={{ fontWeight: 700 }} />
          </div>
          <div>
            <label className="jd-label" style={{ fontSize: '.6rem' }}>NOMBRE (opc.)</label>
            <input className="jd-input" value={nuevaEtiq} onChange={e => setNuevaEtiq(e.target.value)} placeholder="Pack Ahorro" />
          </div>
          <button onClick={agregarOferta} className="btn-jordyn" style={{ padding: '10px 14px', fontSize: '.8rem', height: 44, alignSelf: 'end' }}>
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>
        {nuevaCant && nuevoPrecio && precioBase > 0 && (() => {
          const cant = parseInt(nuevaCant), prec = parseCOP(nuevoPrecio);
          if (!cant || !prec) return null;
          const normal = precioBase * cant, pct = Math.round((1 - prec / normal) * 100), ahorras = normal - prec;
          return (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(6,214,160,.08)', border: '1px solid rgba(6,214,160,.2)', fontSize: '.72rem', color: '#059669', fontWeight: 600 }}>
              {pct > 0 ? `✅ El cliente ahorra ${fmtCOP(ahorras)} (${pct}% descuento) comprando ${cant} números` : pct === 0 ? '⚠️ El precio es igual al precio normal — no hay descuento' : '❌ El precio de oferta es mayor al precio normal'}
            </div>
          );
        })()}
        {error && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(230,57,70,.08)', border: '1px solid rgba(230,57,70,.25)', fontSize: '.72rem', color: '#e63946', fontWeight: 600 }}>⚠️ {error}</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SELECTOR DE CATEGORÍA
   Flujo:
   1. Se elige una categoría → GET /categorias-globales/:id/para-rifa
   2. Se listan todos los vendedores con sus números y series (A/B)
   3. Cada vendedor tiene un checkbox para incluirlo o no en la rifa
   4. El padre recibe vendedoresCargados (todos) y selectedIds (los marcados)
   5. Para rifas simultáneas se muestran las series A y B por separado
   6. El monto pendiente se calcula en tiempo real con el precio de la rifa
════════════════════════════════════════════════════════════ */
function SelectorCategoria({
  precioRifa,
  categoriaId,
  onCategoriaChange,
  vendedoresCargados,
  onVendedoresCargados,
  selectedVendedorIds,
  onSelectionChange,
}) {
  const [categorias, setCategorias] = useState([]);
  const [cargando,   setCargando]   = useState(false);

  useEffect(() => {
    API.get('/categorias-globales').then(r => setCategorias(r.data || [])).catch(() => {});
  }, []);

  const handleSeleccionar = async (catId) => {
    if (!catId) {
      onCategoriaChange(null);
      onVendedoresCargados([]);
      onSelectionChange([]);
      return;
    }
    onCategoriaChange(catId);
    onVendedoresCargados([]);
    onSelectionChange([]);
    setCargando(true);
    try {
      const r = await API.get(`/categorias-globales/${catId}/para-rifa`);
      const vends = r.data.vendedores || [];
      onVendedoresCargados(vends);
      // Por defecto todos quedan seleccionados
      onSelectionChange(vends.map(v => v.vendedor_id));
    } catch {
      toast.error('Error cargando vendedores de la categoría');
    } finally {
      setCargando(false);
    }
  };

  const toggleVendedor = (vendedorId) => {
    if (selectedVendedorIds.includes(vendedorId)) {
      onSelectionChange(selectedVendedorIds.filter(id => id !== vendedorId));
    } else {
      onSelectionChange([...selectedVendedorIds, vendedorId]);
    }
  };

  const toggleTodos = () => {
    if (selectedVendedorIds.length === vendedoresCargados.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(vendedoresCargados.map(v => v.vendedor_id));
    }
  };

  const catActual  = categorias.find(c => String(c.id) === String(categoriaId));
  const esSim      = catActual?.tipo === 'simultanea';
  const todosSelec = vendedoresCargados.length > 0 && selectedVendedorIds.length === vendedoresCargados.length;
  const algunoSel  = selectedVendedorIds.length > 0 && !todosSelec;

  const totalPendiente = vendedoresCargados
    .filter(v => selectedVendedorIds.includes(v.vendedor_id))
    .reduce((acc, v) => acc + v.total_numeros * (precioRifa || 0), 0);

  return (
    <div>
      {/* Select de categoría */}
      <select
        className="jd-select"
        value={categoriaId || ''}
        onChange={e => handleSeleccionar(e.target.value || null)}
        style={{ marginBottom: 12 }}
      >
        <option value="">— Seleccionar categoría —</option>
        {categorias.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} · {c.tipo === 'simultanea' ? '⚡ Simultánea' : '🎯 Parcial'}
          </option>
        ))}
      </select>

      {/* Badge tipo + spinner */}
      {catActual && (
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '3px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800,
            background: esSim ? '#fff0f5' : '#f0f5ff',
            border: `1.5px solid ${esSim ? '#e91e8c40' : '#4361ee40'}`,
            color: esSim ? '#e91e8c' : '#4361ee',
          }}>
            {esSim ? '⚡ Simultánea — 2 series (A+B)' : '🎯 Parcial — 1 serie'}
          </span>
          {cargando && (
            <span style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
              Cargando vendedores...
            </span>
          )}
        </div>
      )}

      {/* Aviso precio */}
      {catActual && !precioRifa && vendedoresCargados.length > 0 && (
        <div style={{ marginBottom: 10, padding: '7px 12px', background: 'rgba(240,165,0,0.07)', border: '1px dashed rgba(240,165,0,0.4)', borderRadius: 8, fontSize: '.72rem', color: 'var(--jordyn-gold)', fontWeight: 600 }}>
          <i className="bi bi-info-circle me-1"></i>
          Ingresa el precio de la rifa para ver el monto pendiente por vendedor.
        </div>
      )}

      {/* Tabla de vendedores con selección */}
      {vendedoresCargados.length > 0 && (
        <div style={{ background: 'rgba(124,58,237,0.04)', border: '1.5px solid rgba(124,58,237,0.2)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Cabecera con checkbox "seleccionar todos" */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 8,
            padding: '8px 14px', background: 'rgba(124,58,237,0.1)',
            fontSize: '.62rem', fontWeight: 800, color: '#7c3aed',
            textTransform: 'uppercase', letterSpacing: '.8px',
            alignItems: 'center',
          }}>
            <input
              type="checkbox"
              checked={todosSelec}
              ref={el => { if (el) el.indeterminate = algunoSel; }}
              onChange={toggleTodos}
              style={{ cursor: 'pointer', accentColor: '#7c3aed', width: 14, height: 14 }}
              title="Seleccionar / deseleccionar todos"
            />
            <span>Vendedor</span>
            <span style={{ textAlign: 'center' }}>Números{esSim ? ' (A / B)' : ''}</span>
            <span style={{ textAlign: 'right' }}>Pendiente caja</span>
          </div>

          {/* Filas */}
          {vendedoresCargados.map(v => {
            const seleccionado = selectedVendedorIds.includes(v.vendedor_id);
            const monto        = v.total_numeros * (precioRifa || 0);
            const nums         = v.asignaciones || [];

            return (
              <div
                key={v.vendedor_id}
                onClick={() => toggleVendedor(v.vendedor_id)}
                style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 8,
                  padding: '10px 14px', borderBottom: '1px solid rgba(124,58,237,0.1)',
                  fontSize: '.8rem', alignItems: 'center',
                  background: seleccionado ? 'rgba(124,58,237,0.04)' : 'rgba(0,0,0,0.01)',
                  opacity: seleccionado ? 1 : 0.45,
                  cursor: 'pointer',
                  transition: 'opacity .15s, background .15s',
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={seleccionado}
                  onChange={() => toggleVendedor(v.vendedor_id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'pointer', accentColor: '#7c3aed', width: 14, height: 14 }}
                />

                {/* Nombre + cédula */}
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--jordyn-text)' }}>{v.vendedor_nombre}</div>
                  {v.cedula && <div style={{ fontSize: '.65rem', color: 'var(--jordyn-muted)' }}>CC {v.cedula}</div>}
                </div>

                {/* Números con series */}
                <div style={{ textAlign: 'center', maxWidth: 220 }}>
                  {esSim ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                      {['A', 'B'].map(serie => {
                        const ns = nums.filter(a => a.serie === serie).map(a => String(a.numero).padStart(3, '0'));
                        if (!ns.length) return null;
                        return (
                          <div key={serie} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <span style={{
                              background: serie === 'A' ? '#f0f5ff' : '#fff0f5',
                              border: `1px solid ${serie === 'A' ? '#4361ee30' : '#e91e8c30'}`,
                              color: serie === 'A' ? '#4361ee' : '#e91e8c',
                              borderRadius: 4, padding: '1px 6px', fontSize: '.62rem', fontWeight: 800, flexShrink: 0,
                            }}>{serie}</span>
                            <span style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', lineHeight: 1.5 }}>
                              {ns.join(', ')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '.7rem', color: 'var(--jordyn-muted)', lineHeight: 1.6 }}>
                      {nums.map(a => String(a.numero).padStart(3, '0')).join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>
                    {v.total_numeros} {esSim ? 'serie(s)' : 'núm.'}
                  </div>
                </div>

                {/* Monto */}
                <div style={{ textAlign: 'right' }}>
                  {precioRifa > 0 ? (
                    <div style={{ fontWeight: 800, color: seleccionado ? '#059669' : 'var(--jordyn-muted)', fontSize: '.85rem' }}>
                      {fmtCOP(monto)}
                    </div>
                  ) : (
                    <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', fontStyle: 'italic' }}>—</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pie: seleccionados + total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: 'rgba(5,150,105,0.07)',
            borderTop: '1.5px solid rgba(5,150,105,0.2)',
            flexWrap: 'wrap', gap: 6,
          }}>
            <span style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)' }}>
              <i className="bi bi-people-fill me-1" style={{ color: '#7c3aed' }}></i>
              {selectedVendedorIds.length} de {vendedoresCargados.length} vendedor(es) seleccionados
            </span>
            {precioRifa > 0 && (
              <span style={{ fontWeight: 900, fontSize: '1rem', color: '#059669' }}>
                <i className="bi bi-cash-stack me-1"></i>
                {fmtCOP(totalPendiente)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sin vendedores */}
      {categoriaId && !cargando && vendedoresCargados.length === 0 && (
        <div style={{ padding: '14px', textAlign: 'center', fontSize: '.78rem', color: 'var(--jordyn-muted)', background: 'var(--jordyn-bg2)', borderRadius: 10, border: '1px dashed var(--jordyn-border)' }}>
          <i className="bi bi-exclamation-circle me-1"></i>
          Esta categoría no tiene vendedores con números asignados.
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   WhatsApp helper
════════════════════════════════════════════════════════════ */
function buildWhatsAppVentaDirecta({ numero, rifa, comprador, vendedor }) {
  const hora = fmtHora(rifa?.fecha_sorteo);
  const msg =
    `🎰 *RIFAS JORDYN* — Confirmación de compra\n\n` +
    `Hola *${comprador?.nombre || comprador}* 👋 tu número fue registrado exitosamente:\n\n` +
    `🎟 Número: *${numero}*\n` +
    `🏆 Premio: ${rifa?.premio || ''}\n` +
    `🎪 Rifa: ${rifa?.rifa_nombre || rifa?.nombre || ''}\n` +
    (rifa?.loteria_ref ? `🎲 Lotería: ${rifa.loteria_ref}\n` : '') +
    `📅 Sorteo: ${fmtF(rifa?.fecha_sorteo)}\n` +
    (hora ? `🕐 Hora del sorteo: ${hora}\n` : '') +
    `💰 Precio pagado: ${fmtCOP(rifa?.precio || 0)}\n` +
    `👤 Atendido por: ${vendedor || 'Admin'}\n\n` +
    `✅ _Tu número está confirmado. ¡Mucha suerte!_\n` +
    `🌐 rifasjordyn.com`;
  const num = comprador?.telefono?.replace(/\D/g, '') || '';
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/* ════════════════════════════════════════════════════════════
   MODAL DETALLE DE NÚMERO
════════════════════════════════════════════════════════════ */
function NumeroDetalleModal({ numero, data, onClose, onRefresh, user }) {
  const [tab,          setTab]          = useState('info');
  const [rifaSel,      setRifaSel]      = useState(null);
  const [form,         setForm]         = useState({ nombre: '', cedula: '', correo: '', telefono: '' });
  const [selling,      setSelling]      = useState(false);
  const [ventaExitosa, setVentaExitosa] = useState(false);

  const rifas       = data?.rifas || [];
  const disponibles = rifas.filter(r => r.disponible);

  useEffect(() => { if (disponibles.length === 1) setRifaSel(disponibles[0]); }, [disponibles.length]);
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const fmt = p => p ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p) : '$0';

  const handleVender = async () => {
    if (!rifaSel)            return toast.error('Selecciona una rifa');
    if (!form.nombre.trim()) return toast.error('El nombre del comprador es requerido');
    if (!form.cedula.trim()) return toast.error('La cédula del comprador es obligatoria');
    setSelling(true);
    try {
      await API.post('/numeros/vender', {
        rifa_id:          rifaSel.rifa_id,
        numero,
        nombre_comprador: form.nombre.trim(),
        cedula:           form.cedula.trim(),
        correo:           form.correo.trim() || undefined,
        telefono:         form.telefono.trim(),
      });
      toast.success(`✅ ¡Número ${numero} vendido en ${rifaSel.rifa_nombre}!`);
      setVentaExitosa(true);
      setTab('ticket');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Error al registrar venta');
    } finally { setSelling(false); }
  };

  const handlePrint     = () => { if (!rifaSel) return; printTickets([rifaSel], numero, form, user?.nombre); };
  const handleTabChange = (t) => { if (t !== 'ticket') setVentaExitosa(false); setTab(t); };

  const tabs = [
    { id: 'info',   icon: 'bi-info-circle-fill',       label: 'DETALLE' },
    ...(disponibles.length > 0 ? [{ id: 'vender', icon: 'bi-cart-plus-fill', label: 'VENDER' }] : []),
    { id: 'ticket', icon: 'bi-ticket-perforated-fill', label: 'BOLETO' },
  ];

  const estadoGlobal = rifas.every(r => r.estado === 'agotado') ? 'agotado_total'
    : rifas.some(r => r.estado === 'agotado') ? 'parcial_agotado'
    : rifas.some(r => r.estado === 'vendido_1') ? 'parcial_vendido' : 'libre';
  const ecfg = ESTADO_GRID[estadoGlobal] || ESTADO_GRID.libre;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 10100, background: 'rgba(10,30,30,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 680, maxHeight: '88vh', background: '#fff', border: '1px solid var(--jordyn-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(10,191,188,0.25)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 900, fontSize: '3rem', color: '#fff', letterSpacing: '10px', lineHeight: 1, paddingLeft: '6px', textShadow: '0 0 24px rgba(255,255,255,0.3)', flexShrink: 0 }}>{numero}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.58rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '3px', marginBottom: 5, fontWeight: 600 }}>NÚMERO SELECCIONADO</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '.6rem', fontWeight: 700 }}>{ecfg.icon} {ecfg.label}</span>
              {rifas.map(r => { const rcfg = EST_RIFA_MODAL[r.estado] || EST_RIFA_MODAL.disponible; return (
                <span key={r.rifa_id} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '.58rem', fontWeight: 600 }}>{r.rifa_nombre}: {rcfg.label}</span>
              ); })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--jordyn-border)', flexShrink: 0, background: 'var(--jordyn-bg2)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              style={{ flex: 1, padding: '10px 8px', background: tab === t.id ? '#fff' : 'transparent', border: 'none', borderBottom: tab === t.id ? '2px solid var(--jordyn-primary)' : '2px solid transparent', color: tab === t.id ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', cursor: 'pointer', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: '.76rem', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s' }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>

          {/* TAB INFO */}
          {tab === 'info' && (
            <div>
              {rifas.map((r, ri) => {
                const rcfg = EST_RIFA_MODAL[r.estado] || EST_RIFA_MODAL.disponible;
                const accentColor = ri === 0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)';
                return (
                  <div key={r.rifa_id} style={{ background: 'var(--jordyn-bg2)', border: `1px solid ${rcfg.color}30`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                    <div style={{ background: `linear-gradient(90deg,${accentColor}0d,transparent)`, padding: '10px 14px', borderBottom: '1px solid var(--jordyn-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: accentColor }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>🏆 {r.premio} · {fmt(r.precio)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ background: `${rcfg.color}15`, border: `1px solid ${rcfg.color}35`, color: rcfg.color, borderRadius: 20, padding: '2px 12px', fontSize: '.6rem', fontWeight: 700 }}>{rcfg.icon} {rcfg.label}</div>
                        <div style={{ fontSize: '.58rem', color: 'var(--jordyn-muted)', marginTop: 3 }}>{r.veces_vendido} / 2 vendidos</div>
                      </div>
                    </div>
                    {r.compras?.length > 0 && (
                      <div style={{ padding: '8px 14px' }}>
                        {r.compras.map((c, ci) => (
                          <div key={ci} style={{ padding: '4px 0', borderBottom: '1px solid var(--jordyn-border)', fontSize: '.72rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--jordyn-text)', fontWeight: 600 }}>{c.nombre_comprador}</span>
                            <span style={{ color: 'var(--jordyn-muted)' }}>{c.cedula}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {disponibles.length > 0 && (
                <button onClick={() => handleTabChange('vender')} className="btn-jordyn w-100" style={{ marginTop: 6, fontSize: '0.92rem', padding: '.68rem' }}>
                  <i className="bi bi-cart-plus-fill me-2"></i>VENDER ESTE NÚMERO
                </button>
              )}
            </div>
          )}

          {/* TAB VENDER */}
          {tab === 'vender' && (
            <div>
              {disponibles.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--jordyn-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>SELECCIONA LA RIFA</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {disponibles.map(r => (
                      <button key={r.rifa_id} onClick={() => setRifaSel(r)}
                        style={{ flex: 1, padding: '10px 12px', textAlign: 'left', background: rifaSel?.rifa_id === r.rifa_id ? 'rgba(10,191,188,0.10)' : 'var(--jordyn-bg2)', border: `2px solid ${rifaSel?.rifa_id === r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all .15s' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: rifaSel?.rifa_id === r.rifa_id ? 'var(--jordyn-primary)' : 'var(--jordyn-text)' }}>{r.rifa_nombre}</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>{r.premio}</div>
                        <div style={{ fontSize: '.66rem', color: 'var(--jordyn-green)', marginTop: 3, fontWeight: 700 }}>
                          {fmt(r.precio)}{r.veces_vendido === 1 && <span style={{ color: 'var(--jordyn-gold)', marginLeft: 6 }}>· ya tiene 1 venta</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label className="jd-label">NOMBRE DEL COMPRADOR *</label>
                <input className="jd-input" placeholder="Nombre completo" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label className="jd-label">CÉDULA * <span style={{ marginLeft: 4, background: 'rgba(230,57,70,0.12)', color: 'var(--jordyn-red)', fontSize: '.52rem', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>OBLIGATORIO</span></label>
                  <input className="jd-input" placeholder="Ej: 12345678" value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value.replace(/\D/g, '').slice(0, 15) }))} type="tel" inputMode="numeric" />
                </div>
                <div>
                  <label className="jd-label">CORREO <span style={{ fontSize: '.58rem', color: 'var(--jordyn-muted)', fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
                  <input className="jd-input" placeholder="correo@email.com" value={form.correo} onChange={e => setForm(p => ({ ...p, correo: e.target.value.trim() }))} type="email" />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="jd-label">TELÉFONO (con código de país)</label>
                <input className="jd-input" placeholder="+58..." value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
                <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 4 }}>
                  <i className="bi bi-info-circle me-1"></i>Incluye el código de país para habilitar WhatsApp (ej: +584141234567)
                </div>
              </div>
              <button className="btn-jordyn w-100" onClick={handleVender} disabled={selling}>
                {selling ? <><span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Registrando...</> : <><i className="bi bi-check2-circle me-2"></i>REGISTRAR VENTA</>}
              </button>
            </div>
          )}

          {/* TAB TICKET */}
          {tab === 'ticket' && rifaSel && (
            <div>
              {ventaExitosa && (
                <div style={{ background: 'linear-gradient(135deg,#0a3320,#0d4228)', border: '1.5px solid rgba(37,211,102,.45)', borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(37,211,102,.2)', border: '1.5px solid rgba(37,211,102,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>✅</div>
                    <div>
                      <div style={{ fontSize: '.6rem', color: 'rgba(37,211,102,.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Venta registrada</div>
                      <div style={{ fontSize: '.95rem', color: '#fff', fontWeight: 800 }}>¡Número {numero} vendido!</div>
                    </div>
                  </div>
                  <a href={buildWhatsAppVentaDirecta({ numero, rifa: rifaSel, comprador: form, vendedor: user?.nombre })}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', borderRadius: 12, padding: '13px 20px', fontFamily: 'var(--jordyn-font)', fontWeight: 700, fontSize: '.92rem', textDecoration: 'none', width: '100%', boxShadow: '0 6px 20px rgba(37,211,102,.35)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {form.telefono ? `Enviar comprobante a ${form.nombre.split(' ')[0]}` : 'Compartir comprobante por WhatsApp'}
                  </a>
                </div>
              )}
              <TicketPreview rifa={rifaSel} numero={numero} comprador={form} vendedor={user?.nombre} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button className="btn-jordyn w-100" onClick={handlePrint}><i className="bi bi-printer-fill me-2"></i>IMPRIMIR BOLETO</button>
              </div>
            </div>
          )}
          {tab === 'ticket' && !rifaSel && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--jordyn-muted)', fontSize: '.85rem' }}>Selecciona una rifa para ver el boleto</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL DE NÚMEROS DE LA RIFA
════════════════════════════════════════════════════════════ */
function ModalNumeros({ rifa, onClose, user }) {
  const [numeros,      setNumeros]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtro,       setFiltro]       = useState('todos');
  const [busqueda,     setBusqueda]     = useState('');
  const [modalNumero,  setModalNumero]  = useState(null);
  const [modalData,    setModalData]    = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);

  const loadNumeros = useCallback(async () => {
    setLoading(true);
    try {
      const [globalRes, asignadosRes] = await Promise.all([
        API.get('/numeros/estado-global'),
        API.get('/numeros/vendedor/mis-numeros'),
      ]);
      const asignadosMap = {};
      asignadosRes.data.forEach(a => {
        if (!asignadosMap[a.rifa_id]) asignadosMap[a.rifa_id] = new Set();
        asignadosMap[a.rifa_id].add(a.numero);
      });
      const conAsignacion = globalRes.data.map(n => ({
        ...n,
        es_sin_asignar: n.estado_global === 'libre' && Object.values(asignadosMap).every(s => !s.has(n.numero)),
        estado_display: n.estado_global === 'libre' && Object.values(asignadosMap).every(s => !s.has(n.numero)) ? 'sin_asignar' : n.estado_global,
      }));
      setNumeros(conAsignacion);
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNumeros(); }, [loadNumeros]);

  const handleClickNumero = async (n) => {
    if (modalNumero === n.numero) { setModalNumero(null); setModalData(null); return; }
    setModalNumero(n.numero); setModalData(null); setLoadingModal(true);
    try {
      const r = await API.get(`/numeros/verificar/${n.numero}`);
      setModalData(r.data);
    } catch { toast.error('Error cargando detalle'); }
    finally { setLoadingModal(false); }
  };

  const conteos = { todos: 0, libre: 0, parcial_vendido: 0, parcial_agotado: 0, agotado_total: 0, sin_asignar: 0, reservado: 0 };
  numeros.forEach(n => { conteos.todos++; conteos[n.estado_display] = (conteos[n.estado_display] || 0) + 1; });

  const filtered = numeros.filter(n => {
    if (busqueda) return n.numero.includes(busqueda.padStart(3, '0').slice(-3));
    if (filtro === 'sin_asignar') return n.es_sin_asignar;
    if (filtro !== 'todos' && n.estado_global !== filtro) return false;
    return true;
  });

  const total  = numeros.length || 1;
  const pctPV  = (conteos.parcial_vendido / total * 100).toFixed(1);
  const pctPA  = (conteos.parcial_agotado / total * 100).toFixed(1);
  const pctAT  = (conteos.agotado_total   / total * 100).toFixed(1);
  const pctTot = ((conteos.parcial_vendido + conteos.parcial_agotado + conteos.agotado_total) / total * 100).toFixed(0);

  const FILTROS = [
    { key: 'todos',           label: 'Todos',        count: conteos.todos,           color: 'var(--jordyn-text)' },
    { key: 'libre',           label: 'Libres',       count: conteos.libre,           color: '#059669' },
    { key: 'parcial_vendido', label: '1 venta',      count: conteos.parcial_vendido, color: '#b37700' },
    { key: 'parcial_agotado', label: 'Semi agotado', count: conteos.parcial_agotado, color: '#c0303a' },
    { key: 'agotado_total',   label: 'Agotado',      count: conteos.agotado_total,   color: 'var(--jordyn-red)' },
    { key: 'sin_asignar',     label: 'Sin asignar',  count: conteos.sin_asignar,     color: 'var(--jordyn-muted)' },
  ];

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && !modalNumero && onClose()}
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,30,30,0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: 860, maxHeight: '93vh', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 72px rgba(10,191,188,0.22)' }}>

          <div style={{ background: 'linear-gradient(135deg, var(--jordyn-primary), var(--jordyn-primary-d))', color: '#fff', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}><i className="bi bi-grid-3x3-gap me-2"></i>NÚMEROS — {rifa.nombre}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: 3 }}>{conteos.libre} libres · {conteos.parcial_vendido} con 1 venta · {conteos.agotado_total} agotados · {pctTot}% vendido</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '1rem' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--jordyn-border)', flexShrink: 0, background: 'var(--jordyn-bg2)' }}>
            <div style={{ height: 8, background: '#e9ecef', borderRadius: 8, overflow: 'hidden', display: 'flex', gap: 1 }}>
              <div style={{ width: `${pctPV}%`, background: 'linear-gradient(90deg,#d49000,#f0a500)', transition: 'width .8s ease' }}></div>
              <div style={{ width: `${pctPA}%`, background: 'linear-gradient(90deg,#a02020,#e63946)', transition: 'width .8s ease' }}></div>
              <div style={{ width: `${pctAT}%`, background: 'var(--jordyn-red)', transition: 'width .8s ease' }}></div>
            </div>
          </div>

          <div style={{ padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--jordyn-border)', display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center', background: '#fff' }}>
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                style={{ background: filtro === f.key ? f.color : '#fff', border: `1.5px solid ${filtro === f.key ? f.color : 'var(--jordyn-border)'}`, color: filtro === f.key ? '#fff' : 'var(--jordyn-muted)', borderRadius: 20, padding: '3px 11px', fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>
                {f.label} <span style={{ opacity: .75 }}>({f.count})</span>
              </button>
            ))}
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
              <input className="jd-input" style={{ maxWidth: 90, textAlign: 'center', fontWeight: 800, letterSpacing: 5, fontSize: '1rem', padding: '.3rem .5rem' }} placeholder="000" value={busqueda} onChange={e => setBusqueda(e.target.value.replace(/\D/g, '').slice(0, 3))} maxLength={3} />
              <button className="btn-jordyn-outline" onClick={loadNumeros} style={{ padding: '5px 10px' }}><i className="bi bi-arrow-clockwise"></i></button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem 1.25rem' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
            ) : (
              <>
                <div className="numero-grid">
                  {filtered.map(n => {
                    const cfg      = ESTADO_GRID[n.estado_display] || ESTADO_GRID.libre;
                    const isActive = modalNumero === n.numero;
                    return (
                      <div key={n.numero} onClick={() => handleClickNumero(n)} title={n.numero}
                        style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.68rem', borderRadius: 6, cursor: 'pointer', transition: 'all .12s', border: `1.5px ${n.estado_display === 'sin_asignar' ? 'dashed' : 'solid'} ${isActive ? 'var(--jordyn-primary)' : cfg.border}`, background: isActive ? 'rgba(10,191,188,0.18)' : cfg.bg, color: isActive ? 'var(--jordyn-primary)' : cfg.color, transform: isActive ? 'scale(1.2)' : undefined, zIndex: isActive ? 5 : undefined, position: isActive ? 'relative' : undefined, boxShadow: isActive ? '0 0 12px rgba(10,191,188,0.4)' : undefined, userSelect: 'none' }}>
                        {loadingModal && isActive ? '⟳' : n.numero}
                      </div>
                    );
                  })}
                </div>
                {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--jordyn-muted)', fontSize: '.85rem' }}>Sin resultados para este filtro</div>}
              </>
            )}
          </div>
        </div>
      </div>
      {modalNumero && modalData && (
        <NumeroDetalleModal numero={modalNumero} data={modalData} onClose={() => { setModalNumero(null); setModalData(null); }} onRefresh={loadNumeros} user={user} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL — GestionRifas
════════════════════════════════════════════════════════════ */
export default function GestionRifas() {
  const { user } = useAuth();
  const [rifas,           setRifas]           = useState([]);
  const [rifasArchivadas, setRifasArchivadas] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [form,            setForm]            = useState(emptyForm);
  const [editId,          setEditId]          = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [showForm,        setShowForm]        = useState(false);
  const [showArchivadas,  setShowArchivadas]  = useState(false);
  const [modalNums,       setModalNums]       = useState(null);
  const [tasaValor,       setTasaValor]       = useState('');
  const [tasaBase,        setTasaBase]        = useState('');
  const [tasaResultado,   setTasaResultado]   = useState(null);
  const [showTasaPanel,   setShowTasaPanel]   = useState(false);
  // Vendedores cargados desde la categoría seleccionada
  const [vendedoresCat,      setVendedoresCat]      = useState([]);
  const [selectedVendorIds,  setSelectedVendorIds]  = useState([]);
  const fileRef = useRef();

  const load = useCallback(async () => {
    try {
      const rifasRes = await API.get('/rifas');
      setRifas(rifasRes.data.filter(r => r.estado !== 'archivada'));
      setRifasArchivadas(rifasRes.data.filter(r => r.estado === 'archivada'));
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePrecioChange = (val) => {
    const num = parseCOP(val);
    setForm(p => ({ ...p, precio: num, precio_display: num ? fmtCOP(num) : '' }));
  };

  const handleImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagen demasiado grande (máx 2MB)'); return; }
    setForm(p => ({ ...p, imagen_base64: '' }));
    const b64 = await fileToBase64(file);
    setForm(p => ({ ...p, imagen_base64: b64 }));
  };

  const handleNueva = () => {
    setForm(emptyForm);
    setEditId(null);
    setVendedoresCat([]);
    setSelectedVendorIds([]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (r) => {
    setForm({
      nombre:                  r.nombre       || '',
      descripcion:             r.descripcion  || '',
      premio:                  r.premio       || '',
      precio:                  r.precio       || '',
      precio_display:          r.precio       ? fmtCOP(r.precio) : '',
      fecha_sorteo:            r.fecha_sorteo ? r.fecha_sorteo.split('T')[0] : '',
      loteria_ref:             r.loteria_ref  || '',
      tipo:                    r.tipo         || 'sencilla',
      imagen_base64:           r.imagen_url   || '',
      ofertas:                 Array.isArray(r.ofertas) ? r.ofertas : [],
      categoria_seleccionada_id: null,
    });
    setVendedoresCat([]);
    setSelectedVendorIds([]);
    setEditId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.premio || !form.precio) { toast.error('Nombre, premio y precio son requeridos'); return; }
    setSaving(true);
    try {
      // Solo los vendedores marcados con checkbox
      const vendedoresSeleccionados = vendedoresCat
        .filter(v => selectedVendorIds.includes(v.vendedor_id))
        .map(v => ({ vendedor_id: v.vendedor_id, categoria_id: form.categoria_seleccionada_id }));

      const payload = {
        nombre:                form.nombre,
        descripcion:           form.descripcion,
        premio:                form.premio,
        precio:                form.precio,
        fecha_sorteo:          form.fecha_sorteo || null,
        loteria_ref:           form.loteria_ref  || null,
        tipo:                  form.tipo,
        imagen_url:            form.imagen_base64 || null,
        ofertas:               form.ofertas || [],
        vendedores_categorias: vendedoresSeleccionados,
        categoria_id:          form.categoria_seleccionada_id || null,
      };
      if (editId) {
        await API.put(`/rifas/${editId}`, payload);
        toast.success('Rifa actualizada');
      } else {
        await API.post('/rifas', payload);
        toast.success('Rifa creada — lotes de caja generados automáticamente');
      }
      setShowForm(false); setForm(emptyForm); setEditId(null); setVendedoresCat([]); setSelectedVendorIds([]); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando rifa'); }
    finally { setSaving(false); }
  };

  const handleToggle   = async (r) => { try { await API.put(`/rifas/${r.id}`, { activa: !r.activa }); toast.success(r.activa ? 'Rifa desactivada' : 'Rifa activada'); load(); } catch { toast.error('Error'); } };
  const handleArchivar = async (r) => { try { await API.put(`/rifas/${r.id}`, { activa: false, estado: 'archivada' }); toast.success('Rifa archivada'); load(); } catch (err) { toast.error(err.response?.data?.error || 'Error archivando rifa'); } };
  const handleDelete   = async (r) => {
    if (!window.confirm(`¿Eliminar definitivamente "${r.nombre}"?`)) return;
    try { await API.delete(`/rifas/${r.id}`); toast.success('Rifa eliminada'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error eliminando rifa'); }
  };

  const rifasActivas = rifas.filter(r => r.activa);

  /* ── Tarjeta de rifa ── */
  const RifaCard = ({ r, archivada = false }) => {
    const ofertas   = Array.isArray(r.ofertas) ? r.ofertas : [];
    const vends     = Array.isArray(r.vendedores) ? r.vendedores : [];
    const totalNums = vends.reduce((acc, v) => acc + (v.numeros_count || 0), 0);

    return (
      <div className={`jd-card ${r.activa ? 'jd-card-primary' : ''} fade-in`} style={{ opacity: r.activa ? 1 : 0.72, height: '100%' }}>

        {r.imagen_url && (
          <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--jordyn-bg2)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <img src={r.imagen_url} alt="Premio" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
          <div style={{ minWidth: 0 }}>
            <h5 style={{ fontWeight: 800, fontSize: '1.05rem', color: r.activa ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</h5>
            <div style={{ fontSize: '0.75rem', color: 'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
          </div>
          <div className="d-flex flex-column align-items-end gap-1" style={{ flexShrink: 0 }}>
            <span className={r.activa ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize: '0.68rem' }}>{archivada ? 'ARCHIVADA' : r.activa ? 'ACTIVA' : 'INACTIVA'}</span>
            {r.tipo && <span className={r.tipo === 'simultanea' ? 'badge-simultanea' : 'badge-sencilla'} style={{ fontSize: '0.64rem' }}>{r.tipo === 'simultanea' ? '⚡ SIMULTÁNEA' : '🎯 SENCILLA'}</span>}
          </div>
        </div>

        <div className="row g-2 mb-3" style={{ fontSize: '0.78rem' }}>
          <div className="col-6">
            <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRECIO</div>
            <div style={{ fontWeight: 700, color: 'var(--jordyn-gold)', fontSize: '0.9rem' }}>{fmtCOP(r.precio)}</div>
          </div>
          <div className="col-6">
            <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>SORTEO</div>
            <div style={{ fontWeight: 600 }}>{fmtF(r.fecha_sorteo)}</div>
          </div>
          <div className="col-6">
            <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>VENTAS</div>
            <div style={{ fontWeight: 700, color: 'var(--jordyn-primary)' }}>{r.total_ventas || 0}</div>
          </div>
          <div className="col-6">
            <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>RECAUDADO</div>
            <div style={{ fontWeight: 700, color: 'var(--jordyn-green)' }}>{fmtCOP(r.ingresos_totales)}</div>
          </div>
        </div>

        {/* Vendedores */}
        {vends.length > 0 && (
          <div style={{ marginBottom: '0.75rem', padding: '10px 12px', background: 'rgba(124,58,237,0.05)', border: '1.5px solid rgba(124,58,237,0.18)', borderRadius: 10 }}>
            <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="bi bi-people-fill me-1"></i>{vends.length} VENDEDOR(ES) · {totalNums} NÚM. RESERVADOS</span>
              <span style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 6, padding: '1px 7px' }}>🔒 reservados</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {vends.map(v => (
                <span key={v.id} style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: '.65rem', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', fontWeight: 900 }}>
                    {v.nombre.charAt(0).toUpperCase()}
                  </span>
                  {v.nombre.split(' ')[0]}
                  <span style={{ background: 'rgba(124,58,237,0.15)', borderRadius: 4, padding: '0 4px', fontSize: '.58rem' }}>{v.numeros_count || 0}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {vends.length === 0 && !archivada && r.activa && (
          <div style={{ marginBottom: '0.75rem', padding: '8px 12px', background: 'rgba(240,165,0,0.06)', border: '1px dashed rgba(240,165,0,0.35)', borderRadius: 8 }}>
            <div style={{ fontSize: '.68rem', color: 'var(--jordyn-gold)', fontWeight: 600 }}>
              <i className="bi bi-exclamation-triangle me-1"></i>
              Sin vendedores — todos los números son públicos
            </div>
          </div>
        )}

        {/* Ofertas */}
        {ofertas.length > 0 && (
          <div style={{ marginBottom: '0.75rem', padding: '8px 10px', background: 'rgba(10,191,188,.05)', border: '1px solid rgba(10,191,188,.2)', borderRadius: 8 }}>
            <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>
              <i className="bi bi-tag-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>{ofertas.length} oferta{ofertas.length > 1 ? 's' : ''} activa{ofertas.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ofertas.map(o => {
                const desc = r.precio > 0 ? Math.round((1 - o.precio_total / (r.precio * o.cantidad)) * 100) : 0;
                return (
                  <span key={o.cantidad} style={{ background: 'rgba(10,191,188,.12)', color: 'var(--jordyn-primary)', border: '1px solid rgba(10,191,188,.3)', borderRadius: 20, padding: '2px 8px', fontSize: '.65rem', fontWeight: 700 }}>
                    ×{o.cantidad} → {fmtCOP(o.precio_total)} {desc > 0 && <span style={{ color: '#059669' }}>−{desc}%</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {(r.total_ventas || 0) > 0 && (
          <div className="mb-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--jordyn-muted)', marginBottom: 3 }}>
              <span>Progreso</span><span>{Math.min(100, Math.round((r.total_ventas / 1000) * 100))}%</span>
            </div>
            <div className="jd-progress"><div className="jd-progress-bar jd-progress-bar-primary" style={{ width: `${Math.min(100, (r.total_ventas / 1000) * 100)}%` }}></div></div>
          </div>
        )}

        {!archivada && (
          <div className="d-flex flex-wrap gap-2">
            <button className="btn-jordyn-outline" onClick={() => handleEdit(r)} style={{ fontSize: '0.75rem', padding: '4px 10px' }}><i className="bi bi-pencil-fill me-1"></i>Editar</button>
            <button onClick={() => setModalNums(r)} style={{ background: 'rgba(10,191,188,0.08)', border: '1.5px solid rgba(10,191,188,0.3)', color: 'var(--jordyn-primary)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="bi bi-grid-3x3-gap"></i> Números</button>
            <a href={`/diseno-ticket?rifa=${r.id}`} style={{ background: 'rgba(240,165,0,0.08)', border: '1.5px solid rgba(240,165,0,0.3)', color: 'var(--jordyn-gold)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}><i className="bi bi-ticket-perforated"></i> Boleto</a>
            <button onClick={() => handleToggle(r)} style={{ background: 'transparent', border: `1.5px solid ${r.activa ? 'rgba(230,57,70,0.4)' : 'rgba(6,214,160,0.4)'}`, color: r.activa ? 'var(--jordyn-red)' : 'var(--jordyn-green)', borderRadius: 8, padding: '4px 10px', fontFamily: 'var(--jordyn-font)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>{r.activa ? 'Desactivar' : 'Activar'}</button>
            <button onClick={() => handleArchivar(r)} title="Archivar" style={{ background: 'transparent', border: '1.5px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', marginLeft: 'auto' }}><i className="bi bi-archive"></i></button>
          </div>
        )}
        {archivada && (
          <div className="d-flex gap-2">
            <button className="btn-jordyn-danger" onClick={() => handleDelete(r)} style={{ fontSize: '0.75rem', padding: '4px 10px' }}><i className="bi bi-trash3"></i> Eliminar</button>
            <button onClick={() => handleToggle({ ...r, activa: false })} style={{ background: 'rgba(6,214,160,0.08)', border: '1.5px solid rgba(6,214,160,0.35)', color: 'var(--jordyn-green)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar</button>
          </div>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <Layout title="GESTIÓN DE RIFAS">

      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <p style={{ fontFamily: 'var(--jordyn-font)', fontSize: '0.8rem', color: 'var(--jordyn-muted)', margin: 0 }}>
          <i className="bi bi-info-circle me-1"></i>{rifasActivas.length} rifa{rifasActivas.length !== 1 ? 's' : ''} activa{rifasActivas.length !== 1 ? 's' : ''}
        </p>
        <button className="btn-jordyn" onClick={handleNueva}><i className="bi bi-plus-lg me-1"></i>NUEVA RIFA</button>
      </div>

      {/* ═══ PANEL TASA DE CAMBIO ═══ */}
      <div className="jd-card mb-4 fade-in" style={{ borderLeft: '3px solid var(--jordyn-gold)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onClick={() => setShowTasaPanel(p => !p)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.25rem' }}>💱</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '.88rem', color: 'var(--jordyn-gold)' }}>CALCULADORA DE TASA DE CAMBIO</div>
              <div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)', marginTop: 1 }}>Convierte montos de Bolívares a Pesos Colombianos o USD</div>
            </div>
          </div>
          <i className={`bi bi-chevron-${showTasaPanel ? 'up' : 'down'}`} style={{ color: 'var(--jordyn-muted)', fontSize: '1rem' }}></i>
        </div>

        {showTasaPanel && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--jordyn-border)', paddingTop: 18 }}>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-4">
                <label className="jd-label">TASA (1 USD = ? Bs.)</label>
                <input className="jd-input" type="number" min="1" step="0.01" placeholder="Ej: 45.50" value={tasaValor} onChange={e => { setTasaValor(e.target.value); setTasaResultado(null); }} style={{ fontWeight: 800, fontSize: '1rem' }} />
              </div>
              <div className="col-12 col-md-4">
                <label className="jd-label">MONTO EN BOLÍVARES (Bs.)</label>
                <input className="jd-input" type="number" min="0" step="0.01" placeholder="Ej: 1000" value={tasaBase} onChange={e => { setTasaBase(e.target.value); setTasaResultado(null); }} style={{ fontWeight: 800, fontSize: '1rem' }} />
              </div>
              <div className="col-12 col-md-4">
                <button className="btn-jordyn w-100" style={{ fontSize: '.88rem' }} onClick={() => {
                  const tasa = parseFloat(tasaValor), monto = parseFloat(tasaBase);
                  if (!tasa || tasa <= 0) { toast.error('Ingresa una tasa válida'); return; }
                  if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
                  setTasaResultado({ monto, tasa, usd: monto / tasa, cop: (monto / tasa) * 4200 });
                }}>
                  <i className="bi bi-calculator-fill me-1"></i> Calcular
                </button>
              </div>
            </div>
            {tasaResultado && (
              <div className="fade-in" style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(240,165,0,.07)', border: '1.5px solid rgba(240,165,0,.3)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                <div><div style={{ fontSize: '.55rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>Monto ingresado</div><div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--jordyn-text)' }}>Bs. {tasaResultado.monto.toFixed(2)}</div></div>
                <div style={{ color: 'var(--jordyn-gold)', fontSize: '1.3rem', fontWeight: 900 }}>→</div>
                <div><div style={{ fontSize: '.55rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>Equivale en USD</div><div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--jordyn-primary)' }}>$ {tasaResultado.usd.toFixed(2)} USD</div></div>
                <div style={{ color: 'var(--jordyn-gold)', fontSize: '1.3rem', fontWeight: 900 }}>→</div>
                <div><div style={{ fontSize: '.55rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>Ref. en Pesos (COP)</div><div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--jordyn-gold)' }}>{fmtCOP(tasaResultado.cop)}</div></div>
                <div style={{ flexShrink: 0, marginLeft: 'auto', fontSize: '.62rem', color: 'var(--jordyn-muted)', lineHeight: 1.6, textAlign: 'right' }}>
                  <i className="bi bi-info-circle me-1"></i>Tasa: 1 USD = Bs. {tasaResultado.tasa}<br />Ref. COP/USD: ~4,200
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ FORMULARIO CREAR / EDITAR ═══ */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-4 fade-in">
          <h5 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--jordyn-primary)', marginBottom: '1.5rem' }}>
            {editId ? '✏️ Editar rifa' : '➕ Nueva rifa'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Imagen */}
              <div className="col-12">
                <label className="jd-label">FOTO DEL PREMIO</label>
                {form.imagen_base64 ? (
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--jordyn-bg2)', borderRadius: 10, border: '2px solid var(--jordyn-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={form.imagen_base64} alt="Premio" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
                    </div>
                    <button type="button" onClick={() => setForm(p => ({ ...p, imagen_base64: '' }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(230,57,70,0.85)', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
                  </div>
                ) : (
                  <div className="rifa-imagen-upload" onClick={() => fileRef.current?.click()}>
                    <i className="bi bi-image" style={{ fontSize: '2rem', color: 'var(--jordyn-primary)', display: 'block', marginBottom: 6 }}></i>
                    <div style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', fontWeight: 500 }}>Click para subir foto del premio (máx 2MB)</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagen} />
              </div>

              {/* Nombre */}
              <div className="col-12 col-md-6">
                <label className="jd-label">NOMBRE DE LA RIFA *</label>
                <input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="RIFA JORDYN #1" />
              </div>

              {/* Premio */}
              <div className="col-12 col-md-6">
                <label className="jd-label">DESCRIPCIÓN DEL PREMIO *</label>
                <input className="jd-input" value={form.premio} onChange={e => setForm(p => ({ ...p, premio: e.target.value }))} placeholder="Moto, TV 65, Viaje, etc." />
              </div>

              {/* Precio */}
              <div className="col-12 col-md-4">
                <label className="jd-label">PRECIO POR NÚMERO (COP) *</label>
                <input className="jd-input" value={form.precio_display}
                  onChange={e => handlePrecioChange(e.target.value)}
                  onBlur={() => form.precio && setForm(p => ({ ...p, precio_display: fmtCOP(p.precio) }))}
                  onFocus={() => setForm(p => ({ ...p, precio_display: p.precio ? String(p.precio) : '' }))}
                  placeholder="$10.000" style={{ fontWeight: 700, fontSize: '1rem' }} />
                {form.precio > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-primary)', marginTop: 3, fontWeight: 600 }}>= {fmtCOP(form.precio)} por boleto</div>}
              </div>

              {/* Fecha */}
              <div className="col-12 col-md-4">
                <label className="jd-label">FECHA DE SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha_sorteo} onChange={e => setForm(p => ({ ...p, fecha_sorteo: e.target.value }))} />
              </div>

              {/* Tipo */}
              <div className="col-12 col-md-4">
                <label className="jd-label">TIPO DE RIFA</label>
                <select className="jd-select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="sencilla">🎯 Sencilla (1 número ganador)</option>
                  <option value="simultanea">⚡ Simultánea (2 rifas paralelas)</option>
                </select>
              </div>

              {/* Lotería */}
              <div className="col-12">
                <label className="jd-label">LOTERÍA DE REFERENCIA</label>
                <select className="jd-select" value={form.loteria_ref} onChange={e => setForm(p => ({ ...p, loteria_ref: e.target.value }))}>
                  <option value="">— Sin referencia —</option>
                  {LOTERIAS.map(grupo => (
                    <optgroup key={grupo.grupo} label={`─── ${grupo.grupo} ───`}>
                      {grupo.items.map(l => <option key={l} value={l}>{l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label className="jd-label">DESCRIPCIÓN ADICIONAL</label>
                <textarea className="jd-input" rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Detalles del premio, condiciones, etc." style={{ resize: 'vertical' }} />
              </div>

              {/* ══ CATEGORÍA DE VENDEDORES ══ */}
              <div className="col-12">
                <div style={{ borderTop: '1px solid var(--jordyn-border)', paddingTop: '1.25rem' }}>
                  <label className="jd-label" style={{ fontSize: '.7rem' }}>
                    <i className="bi bi-people-fill me-1" style={{ color: '#7c3aed' }}></i>
                    CATEGORÍA DE VENDEDORES
                  </label>
                  <p style={{ fontSize: '.75rem', color: 'var(--jordyn-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    Selecciona la categoría. Sus vendedores y números fijos quedarán <strong>reservados automáticamente</strong>
                    {' '}y se crearán lotes en <strong>Caja</strong> con el monto pendiente por cada vendedor.
                  </p>
                  <SelectorCategoria
                    precioRifa={form.precio}
                    categoriaId={form.categoria_seleccionada_id}
                    onCategoriaChange={catId => {
                      setForm(p => ({ ...p, categoria_seleccionada_id: catId }));
                      setVendedoresCat([]);
                      setSelectedVendorIds([]);
                    }}
                    vendedoresCargados={vendedoresCat}
                    onVendedoresCargados={vends => setVendedoresCat(vends)}
                    selectedVendedorIds={selectedVendorIds}
                    onSelectionChange={ids => setSelectedVendorIds(ids)}
                  />
                </div>
              </div>

              {/* ══ OFERTAS POR CANTIDAD ══ */}
              <div className="col-12">
                <div style={{ borderTop: '1px solid var(--jordyn-border)', paddingTop: '1.25rem' }}>
                  <label className="jd-label" style={{ fontSize: '.7rem' }}>
                    <i className="bi bi-tag-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>
                    OFERTAS POR CANTIDAD (opcional)
                  </label>
                  <p style={{ fontSize: '.75rem', color: 'var(--jordyn-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    Define precios especiales cuando el cliente compra cierta cantidad de números.
                  </p>
                  <EditorOfertas
                    ofertas={form.ofertas}
                    onChange={nuevas => setForm(p => ({ ...p, ofertas: nuevas }))}
                    precioBase={form.precio}
                  />
                </div>
              </div>

            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving ? <><span className="jd-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Guardando...</> : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Actualizar' : 'Crear rifa'}</>}
              </button>
              <button type="button" className="btn-jordyn-outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); setVendedoresCat([]); setSelectedVendorIds([]); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ LISTA DE RIFAS ═══ */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            {rifas.length === 0 && (
              <div className="col-12"><div className="jd-alert jd-alert-warning"><i className="bi bi-exclamation-triangle-fill"></i>No hay rifas creadas. ¡Crea la primera!</div></div>
            )}
            {rifas.map(r => <div key={r.id} className="col-12 col-md-6"><RifaCard r={r} /></div>)}
          </div>

          {rifasArchivadas.length > 0 && (
            <div>
              <button onClick={() => setShowArchivadas(!showArchivadas)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--jordyn-bg2)', border: '1px solid var(--jordyn-border)', borderRadius: 10, padding: '0.8rem 1.25rem', cursor: 'pointer', color: 'var(--jordyn-muted)', fontWeight: 700, fontSize: '0.85rem', marginBottom: showArchivadas ? '1rem' : 0 }}>
                <span><i className="bi bi-archive me-2"></i>RIFAS ARCHIVADAS ({rifasArchivadas.length})</span>
                <i className={`bi bi-chevron-${showArchivadas ? 'up' : 'down'}`}></i>
              </button>
              {showArchivadas && (
                <div className="row g-3 fade-in">
                  {rifasArchivadas.map(r => <div key={r.id} className="col-12 col-md-6"><RifaCard r={r} archivada /></div>)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modalNums && <ModalNumeros rifa={modalNums} onClose={() => setModalNums(null)} user={user} />}
    </Layout>
  );
}