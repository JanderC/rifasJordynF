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
import TicketEditable from '../components/TicketEditable';
import { DEFAULT_DESIGN } from '../components/Ticket';
import { useAuth } from '../context/AuthContext';

/* ─── Loterías ─── */
const LOTERIAS = [
  { grupo: 'Colombia', items: [
    'Pijao de Oro','Cafeterito','Super Astro Sol','Super Astro Luna',
  ]},
  { grupo: 'Venezuela', items: [
    'Lotería del Táchira','Lotería de Mérida','Lotería del Zulia',
  ]},
  { grupo: 'Otra', items: ['Otra lotería / referencia propia'] },
];

const emptyForm = {
  nombre: '', descripcion: '', premio: '', precio: '', precio_display: '',
  premio_secundario: '', premio_secundario_display: '',
  fecha_sorteo: '', hora_sorteo: '', loteria_ref: '', tipo: 'sencilla', imagen_base64: '',
  ticket_template_id: null,
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
  const s = String(f).replace(' ', 'T');
  // Si viene como "YYYY-MM-DD" puro → construir en hora local
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // mediodía local, sin riesgo
  }
  const d = new Date(s);
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

// Formatea el campo TIME (hora_sorteo) que viene como "22:00:00" → "10:00 PM"
const fmtHoraSorteo = (h) => {
  if (!h) return null;
  const s = String(h).slice(0, 5); // "22:00"
  const [hh, mm] = s.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hh12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(hh12).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${ampm}`;
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
                <button type="button" onClick={() => eliminarOferta(o.cantidad)} style={{ background: 'rgba(230,57,70,.08)', border: '1px solid rgba(230,57,70,.3)', color: '#e63946', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: '.75rem', flexShrink: 0 }}>
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
            <input className="jd-input" type="number" min="2" max="50" value={nuevaCant} onChange={e => setNuevaCant(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarOferta())} placeholder="3" style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem' }} />
          </div>
          <div>
            <label className="jd-label" style={{ fontSize: '.6rem' }}>PRECIO TOTAL</label>
            <input className="jd-input" value={nuevoPrecio} onChange={e => setNuevoPrecio(e.target.value)}
              onFocus={() => setNuevoPrecio(nuevoPrecio.replace(/\D/g, ''))}
              onBlur={() => nuevoPrecio && setNuevoPrecio(fmtCOP(parseCOP(nuevoPrecio)))}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarOferta())}
              placeholder="$25.000" style={{ fontWeight: 700 }} />
          </div>
          <div>
            <label className="jd-label" style={{ fontSize: '.6rem' }}>NOMBRE (opc.)</label>
            <input className="jd-input" value={nuevaEtiq} onChange={e => setNuevaEtiq(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarOferta())} placeholder="Pack Ahorro" />
          </div>
          <button type="button" onClick={agregarOferta} className="btn-jordyn" style={{ padding: '10px 14px', fontSize: '.8rem', height: 44, alignSelf: 'end' }}>
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
  const [categorias,   setCategorias]   = useState([]);
  const [cargando,     setCargando]     = useState(false);
  const [busquedaVend, setBusquedaVend] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const VENDEDORES_POR_PAGINA = 10;

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
    setBusquedaVend('');
    setPaginaActual(1);
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
      {vendedoresCargados.length > 0 && (() => {
        const q = busquedaVend.trim().toLowerCase();
        const vendedoresFiltrados = q
          ? vendedoresCargados.filter(v =>
              v.vendedor_nombre?.toLowerCase().includes(q) ||
              (v.cedula && v.cedula.toLowerCase().includes(q))
            )
          : vendedoresCargados;
        const totalPaginas = Math.ceil(vendedoresFiltrados.length / VENDEDORES_POR_PAGINA);
        const paginaSegura = Math.min(paginaActual, Math.max(1, totalPaginas));
        const inicio = (paginaSegura - 1) * VENDEDORES_POR_PAGINA;
        const vendedoresPagina = vendedoresFiltrados.slice(inicio, inicio + VENDEDORES_POR_PAGINA);
        return (
        <div style={{ background: 'rgba(124,58,237,0.04)', border: '1.5px solid rgba(124,58,237,0.2)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Buscador de vendedor */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(124,58,237,0.12)', background: 'rgba(124,58,237,0.06)' }}>
            <div style={{ position: 'relative' }}>
              <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--jordyn-muted)', fontSize: '.8rem', pointerEvents: 'none' }}></i>
              <input
                className="jd-input"
                value={busquedaVend}
                onChange={e => { setBusquedaVend(e.target.value); setPaginaActual(1); }}
                placeholder="Buscar vendedor por nombre o cédula..."
                style={{ paddingLeft: 32, paddingRight: busquedaVend ? 32 : 12, fontSize: '.8rem' }}
              />
              {busquedaVend && (
                <button type="button" onClick={() => { setBusquedaVend(''); setPaginaActual(1); }}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--jordyn-muted)', fontSize: '.8rem', padding: 2 }}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
            {q && (
              <div style={{ fontSize: '.65rem', color: 'var(--jordyn-muted)', marginTop: 5 }}>
                {vendedoresFiltrados.length} de {vendedoresCargados.length} vendedor(es)
              </div>
            )}
          </div>

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
          {vendedoresPagina.map(v => {
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
                  {v.total_numeros === 0 ? (
                    /* ── Vendedor sin números: badge informativo ── */
                    <div style={{
                      fontSize: '.68rem', color: '#b37700',
                      background: 'rgba(240,165,0,0.10)',
                      border: '1px dashed rgba(240,165,0,0.45)',
                      borderRadius: 8, padding: '4px 10px',
                      fontStyle: 'italic', lineHeight: 1.4,
                    }}>
                      Sin números aún
                      <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', fontStyle: 'normal', marginTop: 1 }}>
                        Agrega extras en boletería
                      </div>
                    </div>
                  ) : esSim ? (
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
                      <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>
                        {v.total_numeros} serie(s)
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '.7rem', color: 'var(--jordyn-muted)', lineHeight: 1.6 }}>
                        {nums.map(a => String(a.numero).padStart(3, '0')).join(', ')}
                      </div>
                      <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>
                        {v.total_numeros} núm.
                      </div>
                    </>
                  )}
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

          {/* Pie: seleccionados + total + paginación */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: 'rgba(5,150,105,0.07)',
            borderTop: '1.5px solid rgba(5,150,105,0.2)',
            flexWrap: 'wrap', gap: 6,
          }}>
            <span style={{ fontSize: '.72rem', color: 'var(--jordyn-muted)' }}>
              <i className="bi bi-people-fill me-1" style={{ color: '#7c3aed' }}></i>
              {selectedVendedorIds.length} de {vendedoresCargados.length} vendedor(es) seleccionados
              {q && vendedoresFiltrados.length !== vendedoresCargados.length && (
                <span style={{ marginLeft: 6, color: '#7c3aed', fontWeight: 700 }}>
                  · {vendedoresFiltrados.length} filtrado(s)
                </span>
              )}
            </span>
            {precioRifa > 0 && (
              <span style={{ fontWeight: 900, fontSize: '1rem', color: '#059669' }}>
                <i className="bi bi-cash-stack me-1"></i>
                {fmtCOP(totalPendiente)}
              </span>
            )}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', background: '#fff', borderTop: '1px solid rgba(124,58,237,0.1)' }}>
              <button type="button"
                onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                disabled={paginaSegura === 1}
                style={{ background: paginaSegura === 1 ? '#f0f0f0' : 'rgba(124,58,237,0.08)', border: '1.5px solid rgba(124,58,237,0.2)', color: paginaSegura === 1 ? '#bbb' : '#7c3aed', borderRadius: 7, padding: '4px 10px', cursor: paginaSegura === 1 ? 'default' : 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
                ‹
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                <button key={p} type="button"
                  onClick={() => setPaginaActual(p)}
                  style={{ background: p === paginaSegura ? '#7c3aed' : '#fff', border: `1.5px solid ${p === paginaSegura ? '#7c3aed' : 'rgba(124,58,237,0.2)'}`, color: p === paginaSegura ? '#fff' : '#7c3aed', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem', minWidth: 32 }}>
                  {p}
                </button>
              ))}
              <button type="button"
                onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura === totalPaginas}
                style={{ background: paginaSegura === totalPaginas ? '#f0f0f0' : 'rgba(124,58,237,0.08)', border: '1.5px solid rgba(124,58,237,0.2)', color: paginaSegura === totalPaginas ? '#bbb' : '#7c3aed', borderRadius: 7, padding: '4px 10px', cursor: paginaSegura === totalPaginas ? 'default' : 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
                ›
              </button>
              <span style={{ fontSize: '.65rem', color: 'var(--jordyn-muted)', marginLeft: 4 }}>
                Página {paginaSegura} de {totalPaginas}
              </span>
            </div>
          )}
        </div>
        );
      })()}

      {/* Sin vendedores */}
      {categoriaId && !cargando && vendedoresCargados.length === 0 && (
        <div style={{ padding: '14px', textAlign: 'center', fontSize: '.78rem', color: 'var(--jordyn-muted)', background: 'var(--jordyn-bg2)', borderRadius: 10, border: '1px dashed var(--jordyn-border)' }}>
          <i className="bi bi-exclamation-circle me-1"></i>
          Esta categoría no tiene vendedores registrados aún.
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
   MODAL BOLETERÍA — Gestión de números por vendedor en una rifa
════════════════════════════════════════════════════════════ */
function ModalBoleteria({ rifa, onClose }) {
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [vendedorAbierto, setVendedorAbierto] = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [busquedaVend,  setBusquedaVend]  = useState('');

  // NUEVO: búsqueda por número
  const [modoBusqueda, setModoBusqueda] = useState('vendedor'); // 'vendedor' | 'numero'
  const [busquedaNum,  setBusquedaNum]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get(`/rifas/${rifa.id}/boleteria-vendedores`);
      setData(r.data);
    } catch { toast.error('Error cargando boletería'); }
    finally { setLoading(false); }
  }, [rifa.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleAsignar = async (vendedorId, numeros, serie) => {
    setSaving(true);
    try {
      const r = await API.post(`/rifas/${rifa.id}/boleteria-vendedores/${vendedorId}`, { numeros, serie });
      const { insertados, colisiones } = r.data;
      if (insertados.length) toast.success(`✅ ${insertados.length} número(s) asignado(s)`);
      if (colisiones.length) toast.warning(`⚠️ ${colisiones.length} sin espacio: ${colisiones.map(c=>c.numero).join(', ')}`);
      await load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error asignando números'); }
    finally { setSaving(false); }
  };

  const handleQuitarNumero = async (vendedorId, numero, serie, origen) => {
    setSaving(true);
    try {
      await API.delete(`/rifas/${rifa.id}/boleteria-vendedores/${vendedorId}/numero`, { data: { numero, serie, origen } });
      toast.success(`Número ${numero}${origen === 'extra' ? ' (extra)' : ''} liberado`);
      await load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error liberando número'); }
    finally { setSaving(false); }
  };

  const esSimultanea = data?.es_simultanea;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,.6)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:900, maxHeight:'93vh', background:'#fff', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 72px rgba(10,191,188,.22)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#7c3aed,#9333ea)', padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1.05rem', display:'flex', alignItems:'center', gap:8 }}>
              <i className="bi bi-ticket-perforated-fill"></i>
              ADMINISTRACION DE TICKETS DE LA RIFA — {rifa.nombre}
            </div>
            <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.7rem', marginTop:2 }}>
              {esSimultanea ? '⚡ Rifa Simultánea · Series A y B' : '🎯 Rifa Parcial · Serie A'}
              {data && ` · ${data.vendedores?.length || 0} vendedor(es)`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'.95rem' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Buscador (vendedor o número) */}
        {!loading && data && data.vendedores.length > 0 && (
          <div style={{ padding:'.75rem 1.25rem', borderBottom:'1px solid var(--jordyn-border)', background:'var(--jordyn-bg2)', flexShrink:0 }}>

            {/* Toggle modo de búsqueda */}
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <button
                type="button"
                onClick={() => { setModoBusqueda('vendedor'); setBusquedaNum(''); }}
                style={{
                  flex:1, padding:'6px 10px',
                  background: modoBusqueda === 'vendedor' ? 'var(--jordyn-primary,#0abfbc)' : '#fff',
                  color:      modoBusqueda === 'vendedor' ? '#fff' : 'var(--jordyn-text)',
                  border: `1.5px solid ${modoBusqueda === 'vendedor' ? 'var(--jordyn-primary,#0abfbc)' : 'var(--jordyn-border)'}`,
                  borderRadius:6, cursor:'pointer',
                  fontSize:'.78rem', fontWeight:700,
                  fontFamily:'inherit',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                <i className="bi bi-person-fill"></i> Por vendedor
              </button>
            </div>

            {/* Input según modo */}
            {modoBusqueda === 'vendedor' ? (
              <div style={{ position:'relative' }}>
                <i className="bi bi-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--jordyn-muted)', fontSize:'.85rem', pointerEvents:'none' }}></i>
                <input
                  className="jd-input"
                  value={busquedaVend}
                  onChange={e => { setBusquedaVend(e.target.value); setVendedorAbierto(null); }}
                  placeholder="Buscar vendedor por nombre o cédula..."
                  style={{ paddingLeft:36, paddingRight: busquedaVend ? 36 : 12 }}
                />
                {busquedaVend && (
                  <button onClick={() => setBusquedaVend('')}
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--jordyn-muted)', fontSize:'.85rem', lineHeight:1, padding:2 }}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ position:'relative' }}>
                <i className="bi bi-hash" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--jordyn-muted)', fontSize:'1rem', pointerEvents:'none' }}></i>
                <input
                  className="jd-input"
                  value={busquedaNum}
                  onChange={e => setBusquedaNum(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Escribe el número (ej. 123) para ver qué vendedor lo tiene…"
                  inputMode="numeric"
                  style={{
                    paddingLeft:36,
                    paddingRight: busquedaNum ? 36 : 12,
                    fontFamily:'monospace',
                    fontSize:'1rem',
                    letterSpacing: '3px',
                    fontWeight: 700,
                  }}
                />
                {busquedaNum && (
                  <button onClick={() => setBusquedaNum('')}
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--jordyn-muted)', fontSize:'.85rem', lineHeight:1, padding:2 }}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            )}

            {modoBusqueda === 'numero' && (
              <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginTop:6, fontStyle:'italic' }}>
                🔍 Solo consulta — no modifica nada
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'1.25rem' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
              <div className="jd-spinner" style={{ width:40, height:40 }}></div>
            </div>
          ) : !data ? null : data.vendedores.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'var(--jordyn-muted)' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>👥</div>
              <div style={{ fontWeight:700, marginBottom:6 }}>Sin vendedores asignados</div>
              <div style={{ fontSize:'.82rem' }}>Esta rifa no tiene vendedores. Edita la rifa para agregar una categoría con vendedores.</div>
            </div>
          ) : modoBusqueda === 'numero' ? (
            <ResultadoBusquedaNumero
              numero={busquedaNum}
              vendedores={data.vendedores}
              esSimultanea={esSimultanea}
              onAbrirVendedor={(vid) => {
                setModoBusqueda('vendedor');
                setBusquedaVend('');
                setVendedorAbierto(vid);
              }}
            />
          ) : (() => {
            const q = busquedaVend.trim().toLowerCase();
            const filtrados = q
              ? data.vendedores.filter(v =>
                  v.vendedor_nombre?.toLowerCase().includes(q) ||
                  (v.cedula && v.cedula.toLowerCase().includes(q))
                )
              : data.vendedores;
            return filtrados.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--jordyn-muted)' }}>
                <div style={{ fontSize:'2rem', marginBottom:10 }}>🔍</div>
                <div style={{ fontWeight:700, marginBottom:4 }}>Sin resultados</div>
                <div style={{ fontSize:'.82rem' }}>No hay vendedores que coincidan con "{busquedaVend}"</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {q && (
                  <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', padding:'4px 2px' }}>
                    {filtrados.length} de {data.vendedores.length} vendedor(es)
                  </div>
                )}
                {filtrados.map(v => (
                  <PanelVendedorBoleteria
                    key={v.vendedor_id}
                    vendedor={v}
                    rifa={rifa}
                    esSimultanea={esSimultanea}
                    disponiblesA={data.disponibles_a || []}
                    disponiblesB={data.disponibles_b || []}
                    abierto={vendedorAbierto === v.vendedor_id}
                    onToggle={() => setVendedorAbierto(prev => prev === v.vendedor_id ? null : v.vendedor_id)}
                    onAsignar={(nums, serie) => handleAsignar(v.vendedor_id, nums, serie)}
                    onQuitar={(num, serie, origen) => handleQuitarNumero(v.vendedor_id, num, serie, origen)}
                    saving={saving}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-componente: resultado de búsqueda de número en boletería ──
   SOLO LECTURA: muestra qué vendedor(es) tienen ese número, en qué
   serie (A/B) y de qué origen (categoría global vs extra de esta rifa).
   No toca la BD, no modifica nada. */
function ResultadoBusquedaNumero({ numero, vendedores, esSimultanea, onAbrirVendedor }) {
  // Sin texto → mensaje guía
  if (!numero || !numero.trim()) {
    return (
      <div style={{ textAlign:'center', padding:'3rem 1rem', color:'var(--jordyn-muted)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔢</div>
        <div style={{ fontWeight:700, marginBottom:6, color:'var(--jordyn-text)' }}>
          Buscar número
        </div>
        <div style={{ fontSize:'.82rem', maxWidth:360, margin:'0 auto' }}>
          Escribe un número arriba para ver qué vendedor(es) lo tienen asignado en esta rifa.
        </div>
      </div>
    );
  }

  // Normalizar el número buscado a 3 dígitos (000–999)
  const numNorm = /^\d+$/.test(numero.trim()) ? numero.trim().padStart(3, '0') : numero.trim();

  // Buscar en todos los vendedores. Cada hit incluye el vendedor + la entrada de numeros_fijos
  const hits = [];
  for (const v of vendedores) {
    for (const n of (v.numeros_fijos || [])) {
      if (String(n.numero).padStart(3, '0') === numNorm) {
        hits.push({ vendedor: v, asignacion: n });
      }
    }
  }

  // Sin resultado
  if (hits.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'2.5rem 1rem', color:'var(--jordyn-muted)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔍</div>
        <div style={{ fontWeight:800, marginBottom:6, color:'var(--jordyn-text)', fontSize:'1rem' }}>
          Número {numNorm} no asignado
        </div>
        <div style={{ fontSize:'.82rem', maxWidth:380, margin:'0 auto' }}>
          Este número no está asignado a ningún vendedor en esta rifa.
          Podría estar disponible o haber sido vendido a un cliente directo.
        </div>
      </div>
    );
  }

  // Estilos de badges
  const badgeSerie = (serie) => ({
    background: serie === 'A' ? '#0abfbc' : '#7c3aed',
    color: '#fff',
    padding: '2px 9px',
    borderRadius: 4,
    fontSize: '.7rem',
    fontWeight: 800,
    letterSpacing: 1,
    fontFamily: 'monospace',
  });

  const badgeOrigen = (origen) => ({
    background: origen === 'extra' ? 'rgba(59,130,246,.12)' : 'rgba(124,58,237,.08)',
    color:      origen === 'extra' ? '#2563eb' : '#7c3aed',
    border:    `1px solid ${origen === 'extra' ? 'rgba(59,130,246,.3)' : 'rgba(124,58,237,.2)'}`,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: '.65rem',
    fontWeight: 700,
    letterSpacing: .5,
    textTransform: 'uppercase',
  });

  return (
    <div>
      {/* Encabezado del resultado */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,.08), rgba(124,58,237,.03))',
        border: '1.5px solid rgba(124,58,237,.25)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          fontSize: '1.8rem',
          fontFamily: 'monospace',
          fontWeight: 900,
          color: '#7c3aed',
          letterSpacing: 4,
          background: '#fff',
          border: '2px solid #7c3aed',
          padding: '4px 14px',
          borderRadius: 8,
          lineHeight: 1,
        }}>
          {numNorm}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.72rem', color: '#7c3aed', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Resultado de búsqueda
          </div>
          <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--jordyn-text)', marginTop: 2 }}>
            {hits.length === 1
              ? `1 asignación encontrada`
              : `${hits.length} asignaciones encontradas`}
            {esSimultanea && hits.length > 1 && <span style={{ color: 'var(--jordyn-muted)', fontWeight: 500 }}> (Series A y B)</span>}
          </div>
        </div>
      </div>

      {/* Cards de cada vendedor que lo tiene */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hits.map(({ vendedor: v, asignacion: a }, idx) => (
          <div key={`${v.vendedor_id}-${a.serie}-${a.origen}-${idx}`} style={{
            background: '#fff',
            border: '1.5px solid var(--jordyn-border)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'box-shadow .15s, border-color .15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#7c3aed';
            e.currentTarget.style.boxShadow = '0 3px 12px rgba(124,58,237,.12)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--jordyn-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}>

            {/* Avatar con inicial */}
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '1.05rem',
              flexShrink: 0,
            }}>
              {v.vendedor_nombre?.charAt(0).toUpperCase() || '?'}
            </div>

            {/* Info del vendedor */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700,
                fontSize: '.92rem',
                color: 'var(--jordyn-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {v.vendedor_nombre}
              </div>
              <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
                {v.cedula ? `C.I: ${v.cedula}` : 'Sin cédula'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {esSimultanea && <span style={badgeSerie(a.serie)}>Serie {a.serie}</span>}
                <span style={badgeOrigen(a.origen)}>
                  {a.origen === 'extra' ? '➕ Extra de esta rifa' : '📂 Categoría global'}
                </span>
              </div>
            </div>

            {/* Botón ver panel completo */}
            <button
              onClick={() => onAbrirVendedor(v.vendedor_id)}
              title="Abrir el panel del vendedor"
              style={{
                background: '#fff',
                border: '1.5px solid #7c3aed',
                color: '#7c3aed',
                borderRadius: 7,
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: '.72rem',
                fontWeight: 700,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff';    e.currentTarget.style.color = '#7c3aed'; }}
            >
              <i className="bi bi-eye"></i> Ver panel
            </button>
          </div>
        ))}
      </div>

      {/* Aviso de solo lectura */}
      <div style={{
        marginTop: 16,
        padding: '8px 12px',
        background: 'rgba(124,58,237,.04)',
        border: '1px dashed rgba(124,58,237,.25)',
        borderRadius: 6,
        fontSize: '.7rem',
        color: 'var(--jordyn-muted)',
        textAlign: 'center',
        fontStyle: 'italic',
      }}>
        ℹ️ Esta es solo una consulta. Para modificar la asignación, abre el panel del vendedor.
      </div>
    </div>
  );
}

/* ── Sub-componente: panel de un vendedor en boletería ──
   Muestra fijos + extras mezclados, con badge azul "EXTRA" para
   los números que solo aplican a esta rifa (no afectan categorías). */
function PanelVendedorBoleteria({ vendedor, rifa, esSimultanea, disponiblesA, disponiblesB, abierto, onToggle, onAsignar, onQuitar, saving }) {
  const [tabSerie,      setTabSerie]      = useState('A'); // tab activa para agregar (A o B)
  const [modoAgregar,   setModoAgregar]   = useState('aleatorio'); // 'aleatorio' | 'manual'
  const [cantAleatorio, setCantAleatorio] = useState('');
  const [seleccionados, setSeleccionados] = useState(new Set());

  // Números que ya tiene este vendedor en esta rifa, agrupados por serie.
  // Cada item conserva `origen` ('fijo' | 'extra') para mostrar el badge.
  const todos = (vendedor.numeros_fijos || []).map(n => ({
    numero: String(n.numero).padStart(3, '0'),
    serie:  n.serie || 'A',
    origen: n.origen || 'fijo',
  }));

  const fijosA      = todos.filter(n => n.serie === 'A');
  const fijosB      = todos.filter(n => n.serie === 'B');
  const totalFijos  = todos.length;
  const totalExtras = todos.filter(n => n.origen === 'extra').length;

  // Para calcular disponibles, comparamos solo por número
  const numsA = fijosA.map(n => n.numero);
  const numsB = fijosB.map(n => n.numero);

  const disponiblesActivos = tabSerie === 'A'
    ? disponiblesA.filter(n => !numsA.includes(String(n).padStart(3, '0')))
    : disponiblesB.filter(n => !numsB.includes(String(n).padStart(3, '0')));

  const toggleSeleccion = (n) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const handleAgregarAleatorio = async () => {
    const cant = parseInt(cantAleatorio);
    if (!cant || cant < 1) { toast.error('Ingresa una cantidad válida'); return; }
    if (cant > disponiblesActivos.length) { toast.error(`Solo hay ${disponiblesActivos.length} disponibles`); return; }
    const arr = [...disponiblesActivos];
    for (let i = 0; i < cant; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const picks = arr.slice(0, cant).map(n => String(n).padStart(3, '0'));
    await onAsignar(picks, tabSerie);
    setCantAleatorio('');
  };

  const handleAgregarManual = async () => {
    if (seleccionados.size === 0) { toast.error('Selecciona al menos un número'); return; }
    const nums = [...seleccionados].map(n => String(n).padStart(3, '0'));
    await onAsignar(nums, tabSerie);
    setSeleccionados(new Set());
  };

  const colorSerie = (s) => s === 'A'
    ? { bg:'#f0f5ff', border:'#4361ee44', color:'#4361ee' }
    : { bg:'#fff0f5', border:'#e91e8c44', color:'#e91e8c' };

  const badgeExtra = {
    background:'#0ea5e9', color:'#fff', fontSize:'.55rem',
    fontWeight:900, letterSpacing:.5, padding:'1px 4px',
    borderRadius:4, lineHeight:1.1, marginLeft:4, textTransform:'uppercase',
  };

  // Render de un chip de número con badge si es extra
  const renderChip = (item, cs) => {
    const esExtra = item.origen === 'extra';
    const stylesChip = esExtra
      ? { bg:'#ecfeff', border:'#0ea5e9', color:'#0369a1' }
      : cs;
    return (
      <div key={`${item.numero}-${item.serie}-${item.origen}`}
        style={{
          display:'flex', alignItems:'center', gap:3,
          background:stylesChip.bg,
          border:`1.5px solid ${stylesChip.border}`,
          borderRadius:8, padding:'3px 8px', position:'relative',
        }}
        title={esExtra ? 'Número extra de esta rifa (no afecta categorías)' : 'Número fijo del vendedor'}>
        <span style={{ fontWeight:900, fontSize:'.82rem', color:stylesChip.color, letterSpacing:1 }}>
          {item.numero}
        </span>
        {esExtra && <span style={badgeExtra}>EXTRA</span>}
        <button onClick={() => onQuitar(item.numero, item.serie, item.origen)} disabled={saving}
          style={{ background:'none', border:'none', color:'#e63946', cursor:'pointer', padding:'0 2px', fontSize:'.7rem', opacity:saving?0.4:0.7, lineHeight:1 }}
          title={`Quitar ${item.numero} ${item.serie}${esExtra ? ' (extra)' : ''}`}>
          ✕
        </button>
      </div>
    );
  };

  return (
    <div style={{ border:'1.5px solid rgba(124,58,237,.2)', borderRadius:12, overflow:'hidden' }}>

      {/* Cabecera del vendedor — clic para abrir/cerrar */}
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background: abierto ? 'rgba(124,58,237,.06)' : '#fff', cursor:'pointer', userSelect:'none' }}>
        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#9333ea)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:'.9rem', flexShrink:0 }}>
          {vendedor.vendedor_nombre?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:'.92rem', color:'var(--jordyn-text)' }}>{vendedor.vendedor_nombre}</div>
          {vendedor.cedula && <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)' }}>CC {vendedor.cedula}</div>}
        </div>

        {/* Resumen de series */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end', alignItems:'center' }}>
          {esSimultanea ? (
            <>
              {fijosA.length > 0 && (
                <span style={{ ...colorSerie('A'), borderRadius:20, padding:'3px 10px', fontSize:'.68rem', fontWeight:800, border:`1px solid ${colorSerie('A').border}`, background:colorSerie('A').bg, color:colorSerie('A').color }}>
                  A: {fijosA.length}
                </span>
              )}
              {fijosB.length > 0 && (
                <span style={{ ...colorSerie('B'), borderRadius:20, padding:'3px 10px', fontSize:'.68rem', fontWeight:800, border:`1px solid ${colorSerie('B').border}`, background:colorSerie('B').bg, color:colorSerie('B').color }}>
                  B: {fijosB.length}
                </span>
              )}
              {totalFijos === 0 && <span style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', fontStyle:'italic' }}>Sin números</span>}
            </>
          ) : (
            <span style={{ background:'rgba(124,58,237,.08)', border:'1px solid rgba(124,58,237,.2)', borderRadius:20, padding:'3px 10px', fontSize:'.68rem', fontWeight:800, color:'#7c3aed' }}>
              {totalFijos} número(s)
            </span>
          )}
          {totalExtras > 0 && (
            <span style={{ background:'#0ea5e9', color:'#fff', borderRadius:20, padding:'3px 10px', fontSize:'.65rem', fontWeight:900, letterSpacing:.5 }}>
              +{totalExtras} EXTRA
            </span>
          )}
        </div>

        <i className={`bi bi-chevron-${abierto ? 'up' : 'down'}`} style={{ color:'var(--jordyn-muted)', flexShrink:0 }}></i>
      </div>

      {/* Panel expandido */}
      {abierto && (
        <div style={{ borderTop:'1px solid rgba(124,58,237,.1)', background:'#fafafa' }}>

          {/* ── Sección: Números actuales (fijos + extras) ── */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(124,58,237,.08)' }}>
            <div style={{ fontSize:'.65rem', fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <i className="bi bi-ticket-perforated-fill"></i> NÚMEROS DEL VENDEDOR EN ESTA RIFA
              <span style={{ background:'rgba(124,58,237,.1)', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>{totalFijos}</span>
              {totalExtras > 0 && (
                <span style={{ background:'#0ea5e9', color:'#fff', borderRadius:20, padding:'1px 8px', fontWeight:800, fontSize:'.6rem' }}>
                  {totalExtras} extra(s)
                </span>
              )}
            </div>

            {/* Leyenda visual cuando hay extras */}
            {totalExtras > 0 && (
              <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginBottom:10, background:'#fff', padding:'6px 10px', borderRadius:8, border:'1px dashed #0ea5e955' }}>
                <i className="bi bi-info-circle" style={{ color:'#0ea5e9', marginRight:4 }}></i>
                Los <strong style={{ color:'#0369a1' }}>números EXTRA</strong> solo aplican a esta rifa y no aparecen en los números fijos del vendedor.
              </div>
            )}

            {totalFijos === 0 ? (
              <div style={{ fontSize:'.78rem', color:'var(--jordyn-muted)', fontStyle:'italic', padding:'8px 0' }}>
                Este vendedor no tiene números en esta rifa todavía.
              </div>
            ) : esSimultanea ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {['A','B'].map(serie => {
                  const items = serie === 'A' ? fijosA : fijosB;
                  if (!items.length) return null;
                  const cs = colorSerie(serie);
                  return (
                    <div key={serie}>
                      <div style={{ fontSize:'.6rem', fontWeight:800, color:cs.color, textTransform:'uppercase', letterSpacing:'1px', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ background:cs.bg, border:`1px solid ${cs.border}`, borderRadius:4, padding:'1px 7px', color:cs.color }}>SERIE {serie}</span>
                        {items.length} números
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {items.map(item => renderChip(item, cs))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {fijosA.map(item => renderChip(item, { bg:'rgba(124,58,237,.07)', border:'rgba(124,58,237,.2)', color:'#7c3aed' }))}
              </div>
            )}
          </div>

          {/* ── Sección: Agregar números ── */}
          <div style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:'.65rem', fontWeight:800, color:'#059669', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <i className="bi bi-plus-circle-fill"></i> AGREGAR NÚMEROS EXTRA A ESTA RIFA
              <span style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', fontWeight:600, letterSpacing:0, textTransform:'none' }}>
                (no se agregan a los fijos del vendedor)
              </span>
            </div>

            {/* Tabs de serie (solo en simultánea) */}
            {esSimultanea && (
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {['A','B'].map(s => {
                  const cs = colorSerie(s);
                  const disp = s === 'A'
                    ? disponiblesA.filter(n => !numsA.includes(String(n).padStart(3,'0'))).length
                    : disponiblesB.filter(n => !numsB.includes(String(n).padStart(3,'0'))).length;
                  return (
                    <button key={s} onClick={() => { setTabSerie(s); setSeleccionados(new Set()); setCantAleatorio(''); }}
                      style={{
                        flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:'.82rem',
                        background: tabSerie===s ? cs.bg : '#fff',
                        border: `1.5px solid ${tabSerie===s ? cs.color : 'var(--jordyn-border)'}`,
                        color: tabSerie===s ? cs.color : 'var(--jordyn-muted)',
                      }}>
                      Serie {s} <span style={{ fontSize:'.7rem', opacity:.8 }}>({disp} disp.)</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tabs modo: aleatorio / manual */}
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {['aleatorio','manual'].map(m => (
                <button key={m} onClick={() => { setModoAgregar(m); setSeleccionados(new Set()); }}
                  style={{
                    flex:1, padding:'7px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'.78rem',
                    background: modoAgregar===m ? 'rgba(5,150,105,.08)' : '#fff',
                    border: `1.5px solid ${modoAgregar===m ? 'rgba(5,150,105,.4)' : 'var(--jordyn-border)'}`,
                    color: modoAgregar===m ? '#059669' : 'var(--jordyn-muted)',
                  }}>
                  {m === 'aleatorio' ? '🎲 Aleatorio' : '☑️ Seleccionar'}
                </button>
              ))}
            </div>

            {disponiblesActivos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'16px', background:'rgba(230,57,70,.05)', border:'1px dashed rgba(230,57,70,.3)', borderRadius:10, fontSize:'.78rem', color:'#e63946' }}>
                {esSimultanea ? `No hay números disponibles para Serie ${tabSerie}` : 'No hay números disponibles para asignar'}
              </div>
            ) : modoAgregar === 'aleatorio' ? (
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'.62rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:5 }}>
                    Cantidad ({disponiblesActivos.length} disponibles{esSimultanea ? ` · Serie ${tabSerie}` : ''})
                  </label>
                  <input className="jd-input" type="number" min="1" max={disponiblesActivos.length}
                    value={cantAleatorio} onChange={e => setCantAleatorio(e.target.value)}
                    placeholder={`1 – ${disponiblesActivos.length}`}
                    style={{ fontWeight:700, fontSize:'1rem', textAlign:'center' }} />
                </div>
                <button onClick={handleAgregarAleatorio} disabled={saving || !cantAleatorio}
                  style={{ background:'linear-gradient(135deg,#059669,#047857)', border:'none', color:'#fff', borderRadius:9, padding:'10px 20px', cursor:saving?'wait':'pointer', fontWeight:700, fontSize:'.85rem', opacity:saving||!cantAleatorio?0.6:1, display:'flex', alignItems:'center', gap:6, height:44 }}>
                  {saving ? <span className="jd-spinner" style={{ width:14,height:14,borderWidth:2 }}></span> : <><i className="bi bi-shuffle"></i> Asignar</>}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:'.65rem', color:'var(--jordyn-muted)', marginBottom:8 }}>
                  Selecciona los números a asignar · {seleccionados.size} marcados
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(52px,1fr))', gap:5, maxHeight:220, overflowY:'auto', padding:'4px', border:'1px solid var(--jordyn-border)', borderRadius:10, background:'#fff', marginBottom:10 }}>
                  {disponiblesActivos.map(n => {
                    const nStr = String(n).padStart(3,'0');
                    const sel  = seleccionados.has(nStr);
                    const cs   = esSimultanea ? colorSerie(tabSerie) : { bg:'rgba(5,150,105,.08)', border:'rgba(5,150,105,.3)', color:'#059669' };
                    return (
                      <div key={nStr} onClick={() => toggleSeleccion(nStr)}
                        style={{ aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, cursor:'pointer', fontWeight:800, fontSize:'.75rem', letterSpacing:1, userSelect:'none', transition:'all .1s',
                          background: sel ? cs.color : '#fff',
                          border: `1.5px solid ${sel ? cs.color : 'var(--jordyn-border)'}`,
                          color: sel ? '#fff' : 'var(--jordyn-text)',
                          transform: sel ? 'scale(1.08)' : 'scale(1)',
                          boxShadow: sel ? `0 3px 10px ${cs.color}44` : 'none',
                        }}>
                        {nStr}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  {seleccionados.size > 0 && (
                    <button onClick={() => setSeleccionados(new Set())}
                      style={{ background:'none', border:'1px solid var(--jordyn-border)', color:'var(--jordyn-muted)', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:'.78rem' }}>
                      Limpiar
                    </button>
                  )}
                  <button onClick={handleAgregarManual} disabled={saving || seleccionados.size===0}
                    style={{ background:'linear-gradient(135deg,#059669,#047857)', border:'none', color:'#fff', borderRadius:9, padding:'8px 20px', cursor:saving||seleccionados.size===0?'not-allowed':'pointer', fontWeight:700, fontSize:'.82rem', opacity:saving||seleccionados.size===0?0.5:1, display:'flex', alignItems:'center', gap:6 }}>
                    {saving ? <span className="jd-spinner" style={{ width:13,height:13,borderWidth:2 }}></span> : <><i className="bi bi-check2-all"></i> Asignar {seleccionados.size > 0 ? seleccionados.size : ''} número(s)</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
/* ════════════════════════════════════════════════════════════
   MODAL — Programar desactivación automática
════════════════════════════════════════════════════════════ */
function ModalProgramarDesactivacion({ rifa, onClose, onSaved }) {
  const pad  = n => String(n).padStart(2, '0');
  const tz   = 'America/Caracas'; // UTC-4 fijo, sin DST

  // Construye el string "YYYY-MM-DDTHH:MM" en hora Caracas
  const toInputVal = (dateObj) => {
    const d = new Date(dateObj.toLocaleString('en-US', { timeZone: tz }));
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Valor inicial: si ya tiene programación → esa fecha; si no → hoy a las 23:59
  const initVal = () => {
    if (rifa.desactivar_en) return toInputVal(new Date(rifa.desactivar_en));
    const hoy = new Date();
    hoy.setHours(23, 59, 0, 0);
    return toInputVal(hoy);
  };

  // Mínimo: 5 minutos desde ahora en Caracas
  const minVal = () => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return toInputVal(d);
  };

  const [fechaHora,  setFechaHora]  = useState(initVal);
  const [saving,     setSaving]     = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const yaProgr = rifa.desactivar_en ? new Date(rifa.desactivar_en) : null;

  // Preview legible del valor seleccionado
  const preview = (() => {
    if (!fechaHora) return null;
    try {
      const [date, time] = fechaHora.split('T');
      const [y, m, d] = date.split('-').map(Number);
      const [hh, mm]  = time.split(':').map(Number);
      // Caracas = UTC-4, convertir a UTC sumando 4 horas
      const utcDate = new Date(Date.UTC(y, m-1, d, hh + 4, mm));
      return utcDate.toLocaleString('es-CO', {
        weekday:'long', day:'2-digit', month:'long',
        year:'numeric', hour:'2-digit', minute:'2-digit',
        hour12:true, timeZone: tz,
      });
    } catch { return null; }
  })();

  // Convierte el valor del input (hora Caracas) a ISO UTC
  const toISO = val => {
    const [date, time] = val.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm]  = time.split(':').map(Number);
    return new Date(Date.UTC(y, m-1, d, hh + 4, mm)).toISOString();
  };

  const handleGuardar = async () => {
    if (!fechaHora) return toast.error('Selecciona una fecha y hora');
    setSaving(true);
    try {
      await API.put(`/rifas/${rifa.id}/programar-desactivacion`, { desactivar_en: toISO(fechaHora) });
      toast.success('✅ Desactivación programada');
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al programar'); }
    finally { setSaving(false); }
  };

  const handleCancelar = async () => {
    setCancelando(true);
    try {
      await API.put(`/rifas/${rifa.id}/programar-desactivacion`, { desactivar_en: null });
      toast.info('Programación cancelada');
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setCancelando(false); }
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed',inset:0,zIndex:10600,background:'rgba(8,22,22,0.8)',backdropFilter:'blur(7px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' }}
    >
      <div style={{ width:'100%',maxWidth:460,background:'var(--jordyn-surface)',border:'1px solid var(--jordyn-border)',borderRadius:18,overflow:'hidden',boxShadow:'0 32px 80px rgba(230,57,70,0.2)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#7c0a14,#e63946)',padding:'1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:800,fontSize:'1rem',color:'#fff',display:'flex',alignItems:'center',gap:8 }}>
              <i className="bi bi-clock-fill"></i>Programar desactivación
            </div>
            <div style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.75)',marginTop:2 }}>{rifa.nombre}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:'0.95rem' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding:'1.5rem' }}>

          {/* Programación vigente */}
          {yaProgr && (
            <div style={{ background:'rgba(240,165,0,0.08)',border:'1px solid rgba(240,165,0,0.3)',borderRadius:10,padding:'0.75rem 1rem',marginBottom:'1.2rem',fontSize:'0.78rem',color:'#b37700',display:'flex',alignItems:'center',gap:10 }}>
              <i className="bi bi-clock-history" style={{ fontSize:'1.1rem',flexShrink:0 }}></i>
              <div>
                <div style={{ fontWeight:700,marginBottom:2 }}>Programación activa</div>
                <div style={{ fontSize:'0.72rem' }}>
                  {yaProgr.toLocaleString('es-CO',{ weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:tz })}
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div style={{ background:'rgba(10,191,188,0.06)',border:'1px solid rgba(10,191,188,0.18)',borderRadius:10,padding:'0.75rem 1rem',marginBottom:'1.25rem',fontSize:'0.76rem',color:'var(--jordyn-muted)',lineHeight:1.65 }}>
            <i className="bi bi-info-circle-fill me-2" style={{ color:'var(--jordyn-primary)' }}></i>
            La rifa se <strong>desactivará automáticamente</strong> en la fecha y hora elegida.
            Quedará inactiva y dejará de mostrarse a los clientes. Puedes volver a activarla manualmente en cualquier momento.
          </div>

          {/* Input */}
          <div style={{ marginBottom:'1.25rem' }}>
            <label style={{ display:'block',fontSize:'0.72rem',fontWeight:700,color:'var(--jordyn-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>
              Fecha y hora de desactivación
            </label>
            <input
              type="datetime-local"
              className="jd-input"
              value={fechaHora}
              min={minVal()}
              onChange={e => setFechaHora(e.target.value)}
              style={{ width:'100%',boxSizing:'border-box',fontWeight:700,fontSize:'1rem' }}
            />
            {preview && (
              <div style={{ marginTop:8,padding:'8px 12px',background:'rgba(230,57,70,0.06)',border:'1px solid rgba(230,57,70,0.2)',borderRadius:8,fontSize:'0.78rem',color:'#c0303a',fontWeight:600,display:'flex',alignItems:'center',gap:8 }}>
                <i className="bi bi-calendar-x-fill" style={{ flexShrink:0 }}></i>
                Se desactivará el <strong style={{ marginLeft:4 }}>{preview}</strong>
              </div>
            )}
          </div>

          {/* Botones */}
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            <button
              className="btn-jordyn"
              onClick={handleGuardar}
              disabled={saving || !fechaHora}
              style={{ background:'linear-gradient(135deg,#7c0a14,#e63946)',fontSize:'0.88rem' }}
            >
              {saving
                ? <><span className="jd-spinner" style={{ width:16,height:16,borderWidth:2 }}></span> Programando...</>
                : <><i className="bi bi-clock-fill me-1"></i>Confirmar programación</>}
            </button>

            {yaProgr && (
              <button
                className="btn-jordyn-outline"
                onClick={handleCancelar}
                disabled={cancelando}
                style={{ fontSize:'0.82rem',color:'#b37700',borderColor:'rgba(240,165,0,0.4)' }}
              >
                {cancelando ? 'Cancelando...' : <><i className="bi bi-x-circle me-1"></i>Cancelar programación</>}
              </button>
            )}

            <button className="btn-jordyn-outline" onClick={onClose} style={{ fontSize:'0.82rem' }}>
              Cerrar sin cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   BUSCADOR DE NÚMERO GANADOR
   Input inline dentro del card de rifa. Al escribir 3 dígitos
   busca entre los vendedores (fijos + extras) y muestra quién
   tiene ese número. Si es simultánea muestra ambas series.
════════════════════════════════════════════════════════════ */
function BuscadorGanador({ rifa, vends, colorVend, onAbrirVendedor }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(async (numero) => {
    if (!/^\d{3}$/.test(numero)) {
      setResultado(null);
      return;
    }
    setBuscando(true);
    try {
      // Llamada al endpoint que ya existe (boleteria-vendedores trae fijos + extras juntos)
      const r = await API.get(`/rifas/${rifa.id}/boleteria-vendedores`);
      const data = r.data;
      const hits = [];
      for (const v of (data.vendedores || [])) {
        for (const nf of (v.numeros_fijos || [])) {
          const nStr = String(nf.numero).padStart(3, '0');
          if (nStr === numero) {
            hits.push({
              vendedor_id:     v.vendedor_id,
              vendedor_nombre: v.vendedor_nombre,
              cedula:          v.cedula,
              serie:           nf.serie,
              origen:          nf.origen,
            });
          }
        }
      }
      setResultado({ numero, hits, esSim: data.es_simultanea });
    } catch (err) {
      toast.error('Error buscando número');
      setResultado(null);
    } finally {
      setBuscando(false);
    }
  }, [rifa.id]);

  const handleChange = (val) => {
    const v = val.replace(/\D/g, '').slice(0, 3);
    setBusqueda(v);
    if (v.length === 3) buscar(v);
    else setResultado(null);
  };

  const limpiar = () => { setBusqueda(''); setResultado(null); };

  return (
    <div style={{
      marginTop: 10, paddingTop: 10,
      borderTop: '1px dashed rgba(124,58,237,0.25)',
    }}>
      <div style={{
        fontSize: '.58rem', fontWeight: 800, color: '#7c3aed',
        textTransform: 'uppercase', letterSpacing: '1px',
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <i className="bi bi-trophy-fill" style={{ color: '#f59e0b' }}></i>
        Buscar número ganador
      </div>

      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)', fontSize: '.85rem',
          color: 'var(--jordyn-muted)', pointerEvents: 'none',
        }}>🔍</span>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={3}
          value={busqueda}
          onChange={e => handleChange(e.target.value)}
          placeholder="Ej: 007"
          style={{
            width: '100%', padding: '8px 32px 8px 36px',
            border: '1.5px solid rgba(124,58,237,0.25)',
            borderRadius: 8, fontFamily: 'var(--jordyn-font)',
            fontSize: '.85rem', fontWeight: 700,
            color: 'var(--jordyn-text)', background: '#fff',
            outline: 'none', letterSpacing: 2,
          }}
          onFocus={e => e.target.style.borderColor = '#7c3aed'}
          onBlur={e => e.target.style.borderColor = 'rgba(124,58,237,0.25)'}
        />
        {busqueda && (
          <button type="button" onClick={limpiar}
            style={{
              position: 'absolute', right: 8, top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: '.8rem',
              color: 'var(--jordyn-muted)', padding: 4,
            }}>✕</button>
        )}
      </div>

      {/* Resultado */}
      {buscando && (
        <div style={{ fontSize: '.7rem', color: 'var(--jordyn-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="jd-spinner" style={{ width: 12, height: 12, borderWidth: 2 }}></span>
          Buscando…
        </div>
      )}

      {!buscando && resultado && (
        <div style={{ marginTop: 8 }}>
          {resultado.hits.length === 0 ? (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(240,165,0,0.08)',
              border: '1px solid rgba(240,165,0,0.3)',
              borderRadius: 8,
              fontSize: '.72rem', color: 'var(--jordyn-gold)',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className="bi bi-info-circle-fill"></i>
              El número <strong style={{ letterSpacing: 1.5 }}>{resultado.numero}</strong> no está asignado a ningún vendedor
              <span style={{ fontSize: '.62rem', fontWeight: 500, color: 'var(--jordyn-muted)', marginLeft: 'auto' }}>(número público)</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '.62rem', color: 'var(--jordyn-muted)', fontWeight: 600 }}>
                🎯 El número <strong style={{ color: '#059669', letterSpacing: 1.5 }}>{resultado.numero}</strong> está en:
              </div>
              {resultado.hits.map((h, i) => {
                const c = colorVend(h.vendedor_nombre || '');
                const esExtra = h.origen === 'extra';
                const vendInList = vends.find(vv => vv.id === h.vendedor_id);
                return (
                  <button
                    key={`${h.vendedor_id}-${h.serie}-${i}`}
                    type="button"
                    onClick={() => vendInList && onAbrirVendedor(vendInList)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px',
                      background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(5,150,105,0.03))',
                      border: '1.5px solid rgba(5,150,105,0.3)',
                      borderRadius: 10,
                      cursor: vendInList ? 'pointer' : 'default',
                      fontFamily: 'var(--jordyn-font)',
                      textAlign: 'left',
                      transition: 'transform .12s, box-shadow .12s',
                    }}
                    onMouseEnter={e => {
                      if (vendInList) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(5,150,105,0.18)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '';
                    }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: c.bg, color: c.text,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '.85rem', fontWeight: 900,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                      flexShrink: 0,
                    }}>
                      {(h.vendedor_nombre || '?').charAt(0).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '.85rem', color: 'var(--jordyn-text)' }}>
                        {h.vendedor_nombre}
                      </div>
                      <div style={{ fontSize: '.65rem', color: 'var(--jordyn-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {h.cedula && <span>CC {h.cedula}</span>}
                        {resultado.esSim && (
                          <span style={{
                            background: h.serie === 'A' ? '#f0f5ff' : '#fff0f5',
                            border: `1px solid ${h.serie === 'A' ? '#4361ee30' : '#e91e8c30'}`,
                            color: h.serie === 'A' ? '#4361ee' : '#e91e8c',
                            borderRadius: 4, padding: '1px 6px',
                            fontSize: '.6rem', fontWeight: 800,
                          }}>Serie {h.serie}</span>
                        )}
                        <span style={{
                          background: esExtra
                            ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                            : 'rgba(124,58,237,0.12)',
                          color: esExtra ? '#fff' : '#7c3aed',
                          borderRadius: 10, padding: '1px 8px',
                          fontSize: '.58rem', fontWeight: 800,
                          letterSpacing: '.5px',
                        }}>
                          {esExtra ? '✨ EXTRA' : '🎯 FIJO'}
                        </span>
                      </div>
                    </div>
                    {vendInList && (
                      <i className="bi bi-chevron-right" style={{ color: '#7c3aed', fontSize: '1rem' }}></i>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL: GESTIÓN DE NÚMEROS EXTRAS DEL VENDEDOR
   Permite agregar/quitar números extras a un vendedor en una
   rifa específica. Usa los endpoints ya existentes:
     GET    /rifas/:id/boleteria-vendedores   → estado actual
     POST   /rifas/:id/boleteria-vendedores/:vendedorId
            { numeros, serie? }                → agregar
     DELETE /rifas/:id/boleteria-vendedores/:vendedorId/numero
            { numero, serie, origen }          → quitar (solo extras)
════════════════════════════════════════════════════════════ */
function ModalNumerosExtrasVendedor({ rifa, vendedor, onClose, onChanged }) {
  const [data,        setData]        = useState(null);   // respuesta de boleteria-vendedores
  const [loading,     setLoading]     = useState(true);
  const [inputNums,   setInputNums]   = useState('');
  const [serieSel,    setSerieSel]    = useState('A');    // solo en simultáneas
  const [serieAuto,   setSerieAuto]   = useState(true);   // serie automática (solo simult.)
  const [enviando,    setEnviando]    = useState(false);
  const [eliminando,  setEliminando]  = useState(null);   // "001-A" del que se está borrando

  const esSim = rifa.tipo === 'simultanea';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get(`/rifas/${rifa.id}/boleteria-vendedores`);
      setData(r.data);
    } catch {
      toast.error('Error cargando información');
    } finally {
      setLoading(false);
    }
  }, [rifa.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Información del vendedor actual dentro de data.vendedores
  const vendData = data?.vendedores?.find(v => v.vendedor_id === vendedor.id) || null;
  const numerosFijos  = (vendData?.numeros_fijos || []).filter(n => n.origen === 'fijo');
  const numerosExtras = (vendData?.numeros_fijos || []).filter(n => n.origen === 'extra');

  // Parsear el input: separar por coma, espacio o salto de línea, validar 3 dígitos
  const parsearInput = (txt) => {
    return txt
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s.padStart(3, '0'))
      .filter(s => /^\d{3}$/.test(s));
  };

  const numerosParsed = parsearInput(inputNums);

  const agregar = async () => {
    if (numerosParsed.length === 0) {
      toast.error('Ingresa al menos un número (3 dígitos)');
      return;
    }
    setEnviando(true);
    try {
      const body = { numeros: numerosParsed };
      if (esSim && !serieAuto) body.serie = serieSel;
      const r = await API.post(`/rifas/${rifa.id}/boleteria-vendedores/${vendedor.id}`, body);
      const ins = r.data.total_insertados || 0;
      const col = (r.data.colisiones || []).length;
      if (ins > 0) toast.success(`${ins} número${ins !== 1 ? 's' : ''} agregado${ins !== 1 ? 's' : ''}`);
      if (col > 0) {
        const detalle = r.data.colisiones.slice(0, 3).map(c => `${c.numero}: ${c.razon}`).join(' · ');
        toast.warn(`${col} número${col !== 1 ? 's' : ''} no se pudo agregar — ${detalle}${col > 3 ? '…' : ''}`);
      }
      setInputNums('');
      await cargar();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error agregando números');
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (numero, serie, origen) => {
    if (origen === 'fijo') {
      toast.warn('Los números fijos no se pueden eliminar desde aquí (vienen de la categoría)');
      return;
    }
    const key = `${numero}-${serie}`;
    setEliminando(key);
    try {
      await API.delete(`/rifas/${rifa.id}/boleteria-vendedores/${vendedor.id}/numero`,
        { data: { numero, serie, origen } });
      toast.success(`Número ${numero}${esSim ? ` (${serie})` : ''} eliminado`);
      await cargar();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando');
    } finally {
      setEliminando(null);
    }
  };

  // Color del avatar (mismo hash que en RifaCard, dejado local para no acoplar)
  const c = (() => {
    const paleta = [
      { bg:'linear-gradient(135deg,#7c3aed,#a855f7)' },
      { bg:'linear-gradient(135deg,#0abfbc,#22d3d0)' },
      { bg:'linear-gradient(135deg,#f59e0b,#fbbf24)' },
      { bg:'linear-gradient(135deg,#06d6a0,#10b981)' },
      { bg:'linear-gradient(135deg,#ec4899,#f472b6)' },
      { bg:'linear-gradient(135deg,#3b82f6,#60a5fa)' },
      { bg:'linear-gradient(135deg,#ef4444,#f87171)' },
      { bg:'linear-gradient(135deg,#14b8a6,#2dd4bf)' },
    ];
    let h = 0;
    const nombre = vendedor.nombre || '';
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
    return paleta[h % paleta.length];
  })();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'var(--jordyn-font)',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 18,
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        animation: 'fadeUp .22s ease',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: '#fff', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: c.bg, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', fontWeight: 900,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            border: '2px solid rgba(255,255,255,0.4)',
          }}>
            {(vendedor.nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.85, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Gestión de extras
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {vendedor.nombre}
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: 2 }}>
              Rifa: {rifa.nombre}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem',
          }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
              <div className="jd-spinner" style={{ width: 36, height: 36 }}></div>
            </div>
          ) : (
            <>
              {/* Resumen actual */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'rgba(124,58,237,0.08)', border: '1.5px solid rgba(124,58,237,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: '.55rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>
                    🎯 Fijos
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>
                    {numerosFijos.length}
                  </div>
                  <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>de la categoría</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.08))', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 10 }}>
                  <div style={{ fontSize: '.55rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>
                    ✨ Extras
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#d97706', lineHeight: 1 }}>
                    {numerosExtras.length}
                  </div>
                  <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>solo esta rifa</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'rgba(5,150,105,0.08)', border: '1.5px solid rgba(5,150,105,0.25)', borderRadius: 10 }}>
                  <div style={{ fontSize: '.55rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>
                    Σ Total
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                    {numerosFijos.length + numerosExtras.length}
                  </div>
                  {rifa.precio > 0 && (
                    <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 2 }}>
                      {fmtCOP((numerosFijos.length + numerosExtras.length) * rifa.precio)}
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de extras actuales */}
              {numerosExtras.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '.62rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                    Extras actuales · click ✕ para quitar
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {numerosExtras.map((n) => {
                      const numStr = String(n.numero).padStart(3, '0');
                      const key = `${numStr}-${n.serie}`;
                      const borrando = eliminando === key;
                      return (
                        <span key={key} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                          border: '1.5px solid #f59e0b',
                          borderRadius: 8, padding: '4px 4px 4px 10px',
                          fontSize: '.78rem', fontWeight: 800, color: '#92400e',
                          fontFamily: 'var(--jordyn-font)', letterSpacing: 1,
                          opacity: borrando ? 0.5 : 1,
                          transition: 'opacity .15s',
                        }}>
                          {numStr}
                          {esSim && (
                            <span style={{
                              background: n.serie === 'A' ? '#4361ee' : '#e91e8c',
                              color: '#fff', borderRadius: 4,
                              padding: '0 5px', fontSize: '.58rem', fontWeight: 900,
                            }}>{n.serie}</span>
                          )}
                          <button type="button" onClick={() => eliminar(numStr, n.serie, 'extra')}
                            disabled={borrando}
                            title="Quitar este número extra"
                            style={{
                              background: 'rgba(146,64,14,0.15)', border: 'none',
                              color: '#92400e', borderRadius: 4,
                              padding: '0 5px', fontSize: '.7rem', fontWeight: 900,
                              cursor: borrando ? 'wait' : 'pointer',
                              fontFamily: 'var(--jordyn-font)', lineHeight: 1,
                            }}>
                            {borrando ? '…' : '✕'}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de fijos (solo lectura) */}
              {numerosFijos.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{
                    cursor: 'pointer', fontSize: '.62rem', fontWeight: 800,
                    color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px',
                    marginBottom: 8,
                  }}>
                    🎯 Ver números fijos de la categoría ({numerosFijos.length}) ▾
                  </summary>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {numerosFijos.map((n, i) => {
                      const numStr = String(n.numero).padStart(3, '0');
                      return (
                        <span key={`${numStr}-${n.serie}-${i}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(124,58,237,0.08)',
                          border: '1px solid rgba(124,58,237,0.18)',
                          borderRadius: 6, padding: '2px 8px',
                          fontSize: '.7rem', fontWeight: 700, color: '#7c3aed',
                          fontFamily: 'var(--jordyn-font)', letterSpacing: 1,
                        }}>
                          {numStr}
                          {esSim && (
                            <span style={{
                              background: n.serie === 'A' ? '#4361ee' : '#e91e8c',
                              color: '#fff', borderRadius: 3,
                              padding: '0 4px', fontSize: '.55rem', fontWeight: 900,
                            }}>{n.serie}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '.6rem', color: 'var(--jordyn-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    Los fijos no se editan aquí — vienen de la categoría asignada a la rifa.
                  </div>
                </details>
              )}

              {/* ── Sección: Agregar números extras ── */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px dashed rgba(245,158,11,0.4)' }}>
                <div style={{ fontSize: '.62rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="bi bi-plus-circle-fill"></i> Agregar números extras
                  <span style={{ fontSize: '.58rem', color: 'var(--jordyn-muted)', fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}>(solo esta rifa)</span>
                </div>

                {esSim && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {['A', 'B'].map(s => (
                      <button key={s} type="button"
                        onClick={() => { setSerieSel(s); setSerieAuto(false); }}
                        style={{
                          flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '.82rem',
                          background: !serieAuto && serieSel === s ? (s === 'A' ? '#f0f5ff' : '#fff0f5') : '#fff',
                          border: `1.5px solid ${!serieAuto && serieSel === s ? (s === 'A' ? '#4361ee' : '#e91e8c') : 'var(--jordyn-border)'}`,
                          color: !serieAuto && serieSel === s ? (s === 'A' ? '#4361ee' : '#e91e8c') : 'var(--jordyn-muted)',
                        }}>
                        Serie {s}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setSerieAuto(true)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '.78rem',
                        background: serieAuto ? 'rgba(5,150,105,0.08)' : '#fff',
                        border: `1.5px solid ${serieAuto ? 'rgba(5,150,105,0.4)' : 'var(--jordyn-border)'}`,
                        color: serieAuto ? '#059669' : 'var(--jordyn-muted)',
                      }}>
                      🤖 Auto
                    </button>
                  </div>
                )}

                <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: '.62rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                    Números (separados por coma, espacio o salto de línea)
                  </label>
                  <textarea
                    className="jd-input"
                    rows={3}
                    value={inputNums}
                    onChange={e => setInputNums(e.target.value)}
                    placeholder="Ej: 001, 045, 123 o uno por línea"
                    style={{ resize: 'vertical', fontFamily: 'monospace', letterSpacing: 2, fontSize: '.9rem', fontWeight: 700 }}
                  />
                  {numerosParsed.length > 0 && (
                    <div style={{ fontSize: '.68rem', color: '#059669', marginTop: 5, fontWeight: 700 }}>
                      ✅ {numerosParsed.length} número(s) válido(s): {numerosParsed.slice(0, 8).join(', ')}{numerosParsed.length > 8 ? '…' : ''}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={agregar}
                  disabled={enviando || numerosParsed.length === 0}
                  style={{
                    width: '100%', background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    border: 'none', color: '#fff', borderRadius: 9,
                    padding: '10px 18px', cursor: enviando || numerosParsed.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '.88rem',
                    opacity: enviando || numerosParsed.length === 0 ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: 'var(--jordyn-font)',
                  }}>
                  {enviando
                    ? <><span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Agregando...</>
                    : <><i className="bi bi-plus-circle-fill"></i> Agregar {numerosParsed.length > 0 ? `${numerosParsed.length} número(s)` : 'extras'}</>
                  }
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--jordyn-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button type="button" onClick={onClose}
            style={{
              padding: '8px 18px',
              background: 'var(--jordyn-bg2)', border: '1.5px solid var(--jordyn-border)',
              color: 'var(--jordyn-text)', borderRadius: 8,
              fontWeight: 700, fontSize: '.82rem', cursor: 'pointer',
              fontFamily: 'var(--jordyn-font)',
            }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [deletingRifa,    setDeletingRifa]    = useState(false);
  const [tasaValor,       setTasaValor]       = useState('');
  const [tasaBase,        setTasaBase]        = useState('');
  const [tasaResultado,   setTasaResultado]   = useState(null);
  const [showTasaPanel,   setShowTasaPanel]   = useState(false);
  // Vendedores cargados desde la categoría seleccionada
  const [vendedoresCat,      setVendedoresCat]      = useState([]);
  const [selectedVendorIds,  setSelectedVendorIds]  = useState([]);
  // Plantillas de ticket disponibles
  const [plantillas, setPlantillas] = useState([]);
  const [modalDesactivar, setModalDesactivar] = useState(null);
  // Modal de gestión de números extras de un vendedor en una rifa
  // { rifa, vendedor }  ó  null
  const [modalNumExtras, setModalNumExtras] = useState(null);
  const fileRef = useRef();

  // Cargar plantillas al montar
  useEffect(() => {
    API.get('/ticket-templates')
      .then(r => setPlantillas(r.data || []))
      .catch(() => { /* silencioso: si no existe la tabla aún, no rompe */ });
  }, []);

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

  const handleSubPremioChange = (val) => {
    const num = parseCOP(val);
    setForm(p => ({ ...p, premio_secundario: num, premio_secundario_display: num ? fmtCOP(num) : '' }));
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

  const handleEdit = async (r) => {
    const catId = r.categoria_seleccionada_id || null;
    setForm({
      nombre:                    r.nombre       || '',
      descripcion:               r.descripcion  || '',
      premio:                    r.premio       || '',
      precio:                    r.precio       || '',
      precio_display:            r.precio       ? fmtCOP(r.precio) : '',
      premio_secundario:         r.premio_secundario || '',
      premio_secundario_display: r.premio_secundario ? fmtCOP(r.premio_secundario) : '',
      fecha_sorteo:              r.fecha_sorteo ? r.fecha_sorteo.split('T')[0] : '',
      hora_sorteo:               r.hora_sorteo  ? String(r.hora_sorteo).slice(0,5) : '',
      loteria_ref:               r.loteria_ref  || '',
      tipo:                      r.tipo         || 'sencilla',
      imagen_base64:             r.imagen_url   || '',
      ticket_template_id:        r.ticket_template_id || null,
      ofertas:                   Array.isArray(r.ofertas) ? r.ofertas : [],
      categoria_seleccionada_id: catId,
    });
    setVendedoresCat([]);
    setSelectedVendorIds([]);
    setEditId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Precargar vendedores de la categoría que ya tiene la rifa
    if (catId) {
      try {
        const res = await API.get(`/categorias-globales/${catId}/para-rifa`);
        const vends = res.data.vendedores || [];
        setVendedoresCat(vends);
        // Marcar como seleccionados los que ya están en la rifa
        const idsEnRifa = (r.vendedores || []).map(v => v.id);
        if (idsEnRifa.length > 0) {
          // Intersección: solo los que vienen de la categoría Y están en la rifa
          const preseleccionados = vends
            .filter(v => idsEnRifa.includes(v.vendedor_id))
            .map(v => v.vendedor_id);
          setSelectedVendorIds(preseleccionados.length > 0 ? preseleccionados : vends.map(v => v.vendedor_id));
        } else {
          setSelectedVendorIds(vends.map(v => v.vendedor_id));
        }
      } catch {
        toast.error('No se pudo cargar la categoría de la rifa');
      }
    }
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
        premio_secundario:     form.premio_secundario || null,
        fecha_sorteo:          form.fecha_sorteo || null,
        hora_sorteo:           form.hora_sorteo  || null,
        loteria_ref:           form.loteria_ref  || null,
        tipo:                  form.tipo,
        imagen_url:            form.imagen_base64 || null,
        ticket_template_id:    form.ticket_template_id || null,
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
  // Paso 1: intentar DELETE sin force. Si el backend devuelve 409 con info,
  // se guarda en confirmDelete para mostrar el modal de advertencia.
  const handleDelete = async (r) => {
    try {
      await API.delete(`/rifas/${r.id}`);
      toast.success('Rifa eliminada');
      load();
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.requiere_fuerza) {
        // Hay ventas → abrir modal de advertencia con la info que devolvió el backend
        setConfirmDelete({ rifa: r, info: data });
      } else {
        toast.error(data?.error || 'Error eliminando rifa');
      }
    }
  };

  // Paso 2: el usuario confirmó en el modal → borrar con force=true
  const handleDeleteForce = async () => {
    if (!confirmDelete) return;
    setDeletingRifa(true);
    try {
      await API.delete(`/rifas/${confirmDelete.rifa.id}?force=true`);
      toast.success(`Rifa "${confirmDelete.rifa.nombre}" eliminada junto con sus ventas`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando rifa');
    } finally {
      setDeletingRifa(false);
    }
  };

  const rifasActivas = rifas.filter(r => r.activa);

  /* ── Tarjeta de rifa ── */
  const RifaCard = ({ r, archivada = false }) => {
    const ofertas   = Array.isArray(r.ofertas) ? r.ofertas : [];
    const vends     = Array.isArray(r.vendedores) ? r.vendedores : [];
    const totalNums = vends.reduce((acc, v) => acc + (v.numeros_count || 0), 0);

    // Color del avatar por vendedor (estable: hash simple por nombre)
    const colorVend = (nombre = '') => {
      const paleta = [
        { bg:'linear-gradient(135deg,#7c3aed,#a855f7)', text:'#fff' },
        { bg:'linear-gradient(135deg,#0abfbc,#22d3d0)', text:'#fff' },
        { bg:'linear-gradient(135deg,#f59e0b,#fbbf24)', text:'#fff' },
        { bg:'linear-gradient(135deg,#06d6a0,#10b981)', text:'#fff' },
        { bg:'linear-gradient(135deg,#ec4899,#f472b6)', text:'#fff' },
        { bg:'linear-gradient(135deg,#3b82f6,#60a5fa)', text:'#fff' },
        { bg:'linear-gradient(135deg,#ef4444,#f87171)', text:'#fff' },
        { bg:'linear-gradient(135deg,#14b8a6,#2dd4bf)', text:'#fff' },
      ];
      let h = 0;
      for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
      return paleta[h % paleta.length];
    };

    return (
      <div className={`jd-card ${r.activa ? 'jd-card-primary' : ''} fade-in`}
           style={{
             opacity: r.activa ? 1 : 0.72,
             height: '100%',
             padding: 0,
             overflow: 'hidden',
             display: 'flex',
             flexDirection: 'column',
             border: r.activa ? '1.5px solid rgba(10,191,188,0.25)' : '1px solid var(--jordyn-border)',
             boxShadow: r.activa ? '0 4px 20px rgba(10,191,188,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
             transition: 'transform .2s, box-shadow .2s',
           }}>

        {/* ══════ BANNER DE IMAGEN — completa, sin recortes ══════ */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          background: r.imagen_url
            ? `linear-gradient(135deg, rgba(10,30,30,0.04), rgba(124,58,237,0.04)), url(${r.imagen_url}) center/cover no-repeat`
            : 'linear-gradient(135deg,#0abfbc22,#7c3aed22)',
          overflow: 'hidden',
        }}>
          {/* Fondo borroso para rellenar (efecto cinema) */}
          {r.imagen_url && (
            <div style={{
              position: 'absolute', inset: 0,
              background: `url(${r.imagen_url}) center/cover no-repeat`,
              filter: 'blur(28px) brightness(0.55)',
              transform: 'scale(1.15)',
            }}></div>
          )}
          {/* Imagen completa por encima del fondo borroso */}
          {r.imagen_url ? (
            <img
              src={r.imagen_url}
              alt={r.premio || r.nombre}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3.5rem', opacity: 0.5,
            }}>🎰</div>
          )}

          {/* Overlay de badges arriba-derecha */}
          <div style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end',
            zIndex: 2,
          }}>
            <span className={r.activa ? 'badge-disponible' : 'badge-agotado'}
                  style={{ fontSize: '0.66rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}>
              {archivada ? 'ARCHIVADA' : r.activa ? '● ACTIVA' : 'INACTIVA'}
            </span>
            {r.tipo && (
              <span className={r.tipo === 'simultanea' ? 'badge-simultanea' : 'badge-sencilla'}
                    style={{ fontSize: '0.62rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}>
                {r.tipo === 'simultanea' ? '⚡ SIMULTÁNEA' : '🎯 SENCILLA'}
              </span>
            )}
            {r.desactivar_en && r.activa && (
              <span title={`Se desactiva: ${new Date(r.desactivar_en).toLocaleString('es-CO',{timeZone:'America/Caracas'})}`}
                    style={{ fontSize:'0.58rem',fontWeight:700,background:'rgba(230,57,70,0.92)',color:'#fff',borderRadius:20,padding:'2px 8px',display:'inline-flex',alignItems:'center',gap:4,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(0,0,0,0.25)' }}>
                <i className="bi bi-clock-fill" style={{ fontSize:'0.55rem' }}></i>
                {new Date(r.desactivar_en).toLocaleString('es-CO',{ day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'America/Caracas' })}
              </span>
            )}
          </div>

          {/* Etiqueta de precio arriba-izquierda */}
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 50,
            padding: '5px 14px',
            fontSize: '0.85rem',
            fontWeight: 800,
            color: 'var(--jordyn-gold)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(8px)',
            zIndex: 2,
          }}>
            💰 {fmtCOP(r.precio)}
          </div>

          {/* Franja inferior con nombre + premio sobre la imagen */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            padding: '40px 14px 12px',
            zIndex: 1,
          }}>
            <h5 style={{
              fontWeight: 800, fontSize: '1.1rem', color: '#fff',
              marginBottom: 3, lineHeight: 1.15,
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{r.nombre}</h5>
            <div style={{
              fontSize: '0.78rem', color: 'rgba(255,255,255,0.92)',
              fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>🏆 {r.premio}</div>
          </div>
        </div>

        {/* ══════ CONTENIDO DEL CARD ══════ */}
        <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Datos clave en grid */}
          <div className="row g-2 mb-3" style={{ fontSize: '0.78rem' }}>
            <div className="col-6">
              <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>📅 SORTEO</div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--jordyn-text)' }}>
                {fmtF(r.fecha_sorteo)}
              </div>
              {fmtHoraSorteo(r.hora_sorteo) && (
                <div style={{ fontSize:'0.7rem', color:'var(--jordyn-primary)', fontWeight:700, marginTop: 1 }}>
                  🕐 {fmtHoraSorteo(r.hora_sorteo)}
                </div>
              )}
            </div>
            <div className="col-3">
              <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>🎟 VENTAS</div>
              <div style={{ fontWeight: 800, color: 'var(--jordyn-primary)', fontSize: '1rem', lineHeight: 1 }}>{r.total_ventas || 0}</div>
            </div>
            <div className="col-3">
              <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>💵 TOTAL</div>
              <div style={{ fontWeight: 800, color: 'var(--jordyn-green)', fontSize: '0.82rem', lineHeight: 1 }}>{fmtCOP(r.ingresos_totales)}</div>
            </div>
          </div>

          {/* Vendedores — diseño mejorado con avatares de colores (ahora son BOTONES) */}
          {vends.length > 0 && (
            <div style={{
              marginBottom: '0.75rem',
              padding: '10px 12px',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.02))',
              border: '1.5px solid rgba(124,58,237,0.22)',
              borderRadius: 12,
            }}>
              <div style={{
                fontSize: '.62rem', fontWeight: 800, color: '#7c3aed',
                textTransform: 'uppercase', letterSpacing: '1px',
                marginBottom: 10, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <i className="bi bi-people-fill"></i>
                  {vends.length} VENDEDOR{vends.length !== 1 ? 'ES' : ''}
                </span>
                <span style={{
                  background: 'rgba(124,58,237,0.15)',
                  borderRadius: 20, padding: '2px 9px',
                  fontSize: '.6rem', fontWeight: 700,
                }}>
                  🔒 {totalNums} reservado{totalNums !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Aviso interactivo */}
              <div style={{
                fontSize: '.6rem', color: 'var(--jordyn-muted)',
                fontStyle: 'italic', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <i className="bi bi-hand-index-thumb"></i>
                Toca un vendedor para asignarle números extras
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {vends.map(v => {
                  const c = colorVend(v.nombre || '');
                  const extras = v.extras_count || 0;
                  const fijos  = v.fijos_count  || 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setModalNumExtras({ rifa: r, vendedor: v })}
                      title={`${v.nombre} · ${v.numeros_count || 0} números (${fijos} fijos${extras ? ` + ${extras} extras` : ''}) — Click para gestionar extras`}
                      style={{
                        background: '#fff',
                        border: '1.5px solid rgba(124,58,237,0.18)',
                        borderRadius: 24,
                        padding: '3px 10px 3px 3px',
                        fontSize: '.7rem',
                        color: 'var(--jordyn-text)',
                        fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 1px 3px rgba(124,58,237,0.08)',
                        cursor: 'pointer',
                        fontFamily: 'var(--jordyn-font)',
                        transition: 'transform .12s, box-shadow .12s, border-color .12s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.25)';
                        e.currentTarget.style.borderColor = 'rgba(124,58,237,0.45)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(124,58,237,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(124,58,237,0.18)';
                      }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: c.bg, color: c.text,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '.68rem', fontWeight: 900,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                        flexShrink: 0,
                      }}>
                        {(v.nombre || '?').charAt(0).toUpperCase()}
                      </span>
                      <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(v.nombre || '').split(' ')[0]}
                      </span>
                      <span style={{
                        background: 'rgba(124,58,237,0.12)',
                        color: '#7c3aed',
                        borderRadius: 10, padding: '1px 7px',
                        fontSize: '.62rem', fontWeight: 800,
                      }}>{v.numeros_count || 0}</span>
                      {extras > 0 && (
                        <span title={`${extras} número${extras !== 1 ? 's' : ''} extra${extras !== 1 ? 's' : ''}`}
                              style={{
                                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                                color: '#fff',
                                borderRadius: 10, padding: '1px 6px',
                                fontSize: '.55rem', fontWeight: 900,
                                boxShadow: '0 2px 4px rgba(245,158,11,0.35)',
                              }}>+{extras}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ─── BUSCADOR DE NÚMERO GANADOR ─── */}
              <BuscadorGanador
                rifa={r}
                vends={vends}
                colorVend={colorVend}
                onAbrirVendedor={(vend) => setModalNumExtras({ rifa: r, vendedor: vend })}
              />
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

          {/* Spacer para empujar botones al final */}
          <div style={{ flex: 1 }}></div>

          {!archivada && (
            <div className="d-flex flex-wrap gap-2">
              <button className="btn-jordyn-outline" onClick={() => handleEdit(r)} style={{ fontSize: '0.75rem', padding: '4px 10px' }}><i className="bi bi-pencil-fill me-1"></i>Editar</button>
              <button onClick={() => setModalNums(r)} style={{ background: 'rgba(124,58,237,0.08)', border: '1.5px solid rgba(124,58,237,0.3)', color: '#7c3aed', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="bi bi-ticket-perforated-fill"></i> Administración de tickets</button>
              <a href={`/imprimir-boletos?rifa=${r.id}`} style={{ background: 'rgba(240,165,0,0.08)', border: '1.5px solid rgba(240,165,0,0.3)', color: 'var(--jordyn-gold)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}><i className="bi bi-ticket-perforated"></i> Boleto</a>
              {/* Activar (si inactiva) — comportamiento directo */}
              {!r.activa && (
                <button onClick={() => handleToggle(r)} style={{ background:'transparent',border:'1.5px solid rgba(6,214,160,0.4)',color:'var(--jordyn-green)',borderRadius:8,padding:'4px 10px',fontFamily:'var(--jordyn-font)',fontWeight:600,fontSize:'0.75rem',cursor:'pointer' }}>Activar</button>
              )}
              {/* Desactivar (si activa) — abre modal de programación */}
              {r.activa && (
                <button onClick={() => setModalDesactivar(r)} style={{ background:'transparent',border:`1.5px solid ${r.desactivar_en?'rgba(230,57,70,0.7)':'rgba(230,57,70,0.4)'}`,color:'var(--jordyn-red)',borderRadius:8,padding:'4px 10px',fontFamily:'var(--jordyn-font)',fontWeight:600,fontSize:'0.75rem',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5 }}>
                  <i className="bi bi-clock-fill" style={{ fontSize:'0.65rem' }}></i>
                  {r.desactivar_en ? 'Reprogramar' : 'Desactivar'}
                </button>
              )}
              <button onClick={() => handleArchivar(r)} title="Archivar" style={{ background: 'transparent', border: '1.5px solid var(--jordyn-border)', color: 'var(--jordyn-muted)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', marginLeft: 'auto' }}><i className="bi bi-archive"></i></button>
              <button className="btn-jordyn-danger" onClick={() => handleDelete(r)} style={{ fontSize: '0.75rem', padding: '4px 10px' }} title="Eliminar rifa"><i className="bi bi-trash3"></i></button>
            </div>
          )}
          {archivada && (
            <div className="d-flex gap-2">
              <button className="btn-jordyn-danger" onClick={() => handleDelete(r)} style={{ fontSize: '0.75rem', padding: '4px 10px' }}><i className="bi bi-trash3"></i> Eliminar</button>
              <button onClick={() => handleToggle({ ...r, activa: false })} style={{ background: 'rgba(6,214,160,0.08)', border: '1.5px solid rgba(6,214,160,0.35)', color: 'var(--jordyn-green)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar</button>
            </div>
          )}
        </div>
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
                <label className="jd-label">
                  DESCRIPCIÓN DEL PREMIO *
                  <span style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', fontWeight:600, marginLeft:6, textTransform:'none', letterSpacing:0 }}>
                    (el número va al ticket en grande)
                  </span>
                </label>
                <input className="jd-input" value={form.premio}
                  onChange={e => setForm(p => ({ ...p, premio: e.target.value }))}
                  placeholder="Ej: 500 Dólares · 1000 USD · Moto · TV 65" />
                <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:3 }}>
                  💡 Si empieza con número (ej: <b>500 Dólares</b>), el "500" aparece gigante con doble color amarillo/azul, y "Dólares" en cursiva al lado.
                </div>
              </div>

              {/* Sub-premio en pesos (opcional) */}
              <div className="col-12 col-md-6">
                <label className="jd-label">
                  SUB-PREMIO EN PESOS
                  <span style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', fontWeight:600, marginLeft:6, textTransform:'none', letterSpacing:0 }}>
                    (opcional, para el ticket)
                  </span>
                </label>
                <input className="jd-input" value={form.premio_secundario_display}
                  onChange={e => handleSubPremioChange(e.target.value)}
                  onBlur={() => form.premio_secundario && setForm(p => ({ ...p, premio_secundario_display: fmtCOP(p.premio_secundario) }))}
                  onFocus={() => setForm(p => ({ ...p, premio_secundario_display: p.premio_secundario ? String(p.premio_secundario) : '' }))}
                  placeholder="Ej: 2.000.000 (aparece como 'ó 2.000.000 Pesos')" />
                {form.premio_secundario > 0 && (
                  <div style={{ fontSize:'.7rem', color:'var(--jordyn-primary)', marginTop:3, fontWeight:600 }}>
                    En el ticket: <b>ó {Number(form.premio_secundario).toLocaleString('de-DE')} Pesos</b>
                  </div>
                )}
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

              {/* Hora del sorteo (opcional) */}
              <div className="col-12 col-md-4">
                <label className="jd-label">
                  HORA DEL SORTEO
                  <span style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', fontWeight:600, marginLeft:6, textTransform:'none', letterSpacing:0 }}>
                    (opcional)
                  </span>
                </label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input
                    className="jd-input"
                    type="time"
                    value={form.hora_sorteo}
                    onChange={e => setForm(p => ({ ...p, hora_sorteo: e.target.value }))}
                    style={{ flex:1 }}
                  />
                  {form.hora_sorteo && (
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, hora_sorteo: '' }))}
                      title="Quitar hora"
                      style={{ background:'none', border:'1px solid var(--jordyn-border)', borderRadius:8, padding:'4px 9px', cursor:'pointer', color:'var(--jordyn-muted)', fontSize:'.85rem' }}>
                      ✕
                    </button>
                  )}
                </div>
                {/* Atajos rápidos: horarios del Táchira */}
                <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                  {[
                    { lbl: '1:00 PM',  val: '13:00' },
                    { lbl: '4:00 PM',  val: '16:00' },
                    { lbl: '10:00 PM', val: '22:00' },
                  ].map(h => (
                    <button key={h.val} type="button"
                      onClick={() => setForm(p => ({ ...p, hora_sorteo: h.val }))}
                      style={{
                        background: form.hora_sorteo === h.val ? 'rgba(124,58,237,.1)' : '#fff',
                        border: `1px solid ${form.hora_sorteo === h.val ? '#7c3aed' : 'var(--jordyn-border)'}`,
                        color:  form.hora_sorteo === h.val ? '#7c3aed' : 'var(--jordyn-muted)',
                        borderRadius:6, padding:'3px 9px', cursor:'pointer',
                        fontSize:'.7rem', fontWeight:600,
                      }}>
                      {h.lbl}
                    </button>
                  ))}
                </div>
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

              {/* ══ PLANTILLA DEL TICKET ══ */}
              <div className="col-12">
                <div style={{
                  background:'rgba(10,191,188,.05)',
                  border:'1px solid rgba(10,191,188,.2)',
                  borderRadius:10, padding:'14px 16px',
                }}>
                  <label className="jd-label" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span>
                      <i className="bi bi-ticket-perforated-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
                      PLANTILLA DEL TICKET
                    </span>
                    <a href="/plantillas" target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize:'.65rem', color:'var(--jordyn-primary)',
                        textDecoration:'none', fontWeight:700, letterSpacing:0,
                        textTransform:'none',
                      }}>
                      <i className="bi bi-pencil-square me-1"></i>Gestionar plantillas
                    </a>
                  </label>

                  {plantillas.length === 0 ? (
                    <div style={{ fontSize:'.78rem', color:'var(--jordyn-muted)', padding:'8px 0' }}>
                      <i className="bi bi-info-circle me-1"></i>
                      No hay plantillas todavía. Crea una desde <a href="/plantillas" target="_blank" rel="noopener noreferrer" style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>Plantillas</a> y vuelve aquí para asignarla.
                    </div>
                  ) : (
                    <MiniaturasPlantillas
                      plantillas={plantillas}
                      seleccionadaId={form.ticket_template_id}
                      onSelect={id => setForm(p => ({ ...p, ticket_template_id: id }))}
                    />
                  )}
                </div>
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

      {modalNums && <ModalBoleteria rifa={modalNums} onClose={() => setModalNums(null)} />}

      {/* ═══ MODAL: GESTIÓN DE NÚMEROS EXTRAS DEL VENDEDOR ═══ */}
      {modalNumExtras && (
        <ModalNumerosExtrasVendedor
          rifa={modalNumExtras.rifa}
          vendedor={modalNumExtras.vendedor}
          onClose={() => setModalNumExtras(null)}
          onChanged={() => load()}
        />
      )}

      {/* ═══ MODAL CONFIRMACIÓN ELIMINAR RIFA CON VENTAS ═══ */}
      {confirmDelete && (
        <div style={{ position:'fixed',inset:0,zIndex:10500,background:'rgba(8,22,22,0.78)',backdropFilter:'blur(7px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' }}>
          <div style={{ width:'100%',maxWidth:500,background:'#fff',borderRadius:18,overflow:'hidden',boxShadow:'0 32px 80px rgba(230,57,70,0.22)' }}>

            {/* Cabecera roja */}
            <div style={{ background:'linear-gradient(135deg,#b91c1c,#e63946)',padding:'1.1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ color:'#fff' }}>
                <div style={{ fontWeight:800,fontSize:'1rem',display:'flex',alignItems:'center',gap:8 }}>
                  <i className="bi bi-exclamation-triangle-fill"></i> Eliminar rifa
                </div>
                <div style={{ fontSize:'0.75rem',opacity:0.88,marginTop:2 }}>{confirmDelete.rifa.nombre}</div>
              </div>
              <button onClick={() => setConfirmDelete(null)} style={{ background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:'0.85rem' }}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Cuerpo */}
            <div style={{ padding:'1.25rem 1.5rem' }}>

              {/* Advertencia activa */}
              {confirmDelete.info?.activa && (
                <div style={{ background:'#fff8e1',border:'1.5px solid #f0a500',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'flex-start',gap:10 }}>
                  <i className="bi bi-broadcast" style={{ color:'#b07800',fontSize:'1.1rem',flexShrink:0,marginTop:1 }}></i>
                  <div style={{ fontSize:'0.82rem',color:'#7a5c00',lineHeight:1.6 }}>
                    <strong>¡Esta rifa está ACTIVA!</strong> Asegúrate de haber terminado el sorteo antes de eliminarla.
                  </div>
                </div>
              )}

              {/* Vendedores involucrados */}
              {confirmDelete.info?.vendedores?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:'0.72rem',fontWeight:700,color:'#7c3aed',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                    <i className="bi bi-people-fill"></i>
                    {confirmDelete.info.vendedores.length} vendedor(es) en esta rifa
                  </div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                    {confirmDelete.info.vendedores.map(v => (
                      <span key={v.id} style={{ background:'rgba(124,58,237,0.08)',border:'1px solid rgba(124,58,237,0.22)',borderRadius:20,padding:'4px 12px',fontSize:'0.72rem',color:'#7c3aed',fontWeight:700,display:'flex',alignItems:'center',gap:5 }}>
                        <span style={{ width:20,height:20,borderRadius:'50%',background:'rgba(124,58,237,0.15)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.62rem',fontWeight:900 }}>
                          {v.nombre.charAt(0).toUpperCase()}
                        </span>
                        {v.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Advertencia ventas */}
              <div style={{ background:'#fff5f5',border:'1.5px solid rgba(230,57,70,0.35)',borderRadius:10,padding:'12px 14px',marginBottom:18 }}>
                <div style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
                  <i className="bi bi-trash3-fill" style={{ color:'#e63946',fontSize:'1.1rem',flexShrink:0,marginTop:1 }}></i>
                  <div style={{ fontSize:'0.82rem',color:'#c0392b',lineHeight:1.6 }}>
                    Se eliminarán permanentemente <strong>{confirmDelete.info?.total_ventas} venta(s)</strong> registradas.
                    Esta acción <strong>no se puede deshacer</strong>.
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deletingRifa}
                  style={{ background:'transparent',border:'1.5px solid var(--jordyn-border)',color:'var(--jordyn-muted)',borderRadius:8,padding:'8px 18px',cursor:'pointer',fontWeight:600,fontSize:'0.82rem' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteForce}
                  disabled={deletingRifa}
                  style={{ background:'linear-gradient(135deg,#b91c1c,#e63946)',border:'none',color:'#fff',borderRadius:8,padding:'8px 20px',cursor:deletingRifa?'wait':'pointer',fontWeight:700,fontSize:'0.82rem',display:'flex',alignItems:'center',gap:8,opacity:deletingRifa?0.7:1 }}>
                  {deletingRifa
                    ? <><span style={{ width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite' }}></span> Eliminando...</>
                    : <><i className="bi bi-trash3-fill"></i> Sí, eliminar todo</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal programar desactivación */}
      {modalDesactivar && (
        <ModalProgramarDesactivacion
          rifa={modalDesactivar}
          onClose={() => setModalDesactivar(null)}
          onSaved={load}
        />
      )}
    </Layout>
  );
}

function MiniaturasPlantillas({ plantillas, seleccionadaId, onSelect }) {
  // Opción "Default automática" + plantillas reales
  const opciones = [
    { id: null, nombre: '⭐ Default (automática)', design: null, isAuto: true },
    ...plantillas.map(p => ({ ...p, isAuto: false })),
  ];

  // Rifa fake para que el preview tenga datos plausibles
  const rifaPreview = {
    premio: '500 Dólares',
    precio: 6000,
    loteria_ref: 'Triple Táchira A',
    hora_sorteo: '20:00',
    fecha_sorteo: new Date().toISOString().split('T')[0],
    premio_secundario: 2000000,
  };

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        marginTop: 8,
      }}>
        {opciones.map(p => {
          const isSelected = String(p.id) === String(seleccionadaId)
            || (p.isAuto && !seleccionadaId);

          return (
            <button
              key={p.id || 'auto'}
              type="button"
              onClick={() => onSelect(p.id)}
              style={{
                position: 'relative',
                background: isSelected ? '#e0f9f8' : '#fff',
                border: `2px solid ${isSelected ? 'var(--jordyn-primary, #0abfbc)' : 'var(--jordyn-border, #e0e0e0)'}`,
                borderRadius: 10,
                padding: 10,
                cursor: 'pointer',
                textAlign: 'center',
                fontFamily: 'inherit',
                transition: 'all .15s',
                boxShadow: isSelected
                  ? '0 4px 14px rgba(10,191,188,.25)'
                  : '0 1px 2px rgba(0,0,0,.04)',
              }}
            >
              {/* Badge "Default" en plantilla real */}
              {p.is_default && !p.isAuto && (
                <span style={{
                  position: 'absolute',
                  top: 6, right: 6,
                  background: 'var(--jordyn-gold, #f0a500)',
                  color: '#fff',
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontWeight: 800,
                  letterSpacing: .5,
                  zIndex: 2,
                }}>⭐ DEFAULT</span>
              )}

              {/* Check de seleccionada */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: 6, left: 6,
                  width: 22, height: 22,
                  background: 'var(--jordyn-primary, #0abfbc)',
                  color: '#fff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 900,
                  zIndex: 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }}>✓</div>
              )}

              {/* Miniatura */}
              <div style={{
                width: '100%',
                height: 110,
                background: '#fafafa',
                border: '1px solid #eee',
                borderRadius: 6,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: 8,
              }}>
                {p.isAuto ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4,
                    color: '#aaa',
                  }}>
                    <div style={{ fontSize: 36, lineHeight: 1 }}>⭐</div>
                    <div style={{ fontSize: 10, fontWeight: 600 }}>
                      Plantilla del sistema
                    </div>
                  </div>
                ) : p.design ? (
                  <div style={{
                    transform: 'scale(0.22)',
                    transformOrigin: 'center center',
                    pointerEvents: 'none',
                    width: 'auto',
                  }}>
                    <TicketEditable
                      r={rifaPreview}
                      numero="000"
                      design={{ ...DEFAULT_DESIGN, ...p.design }}
                      printMode={true}
                    />
                  </div>
                ) : (
                  <div style={{ color: '#aaa', fontSize: 12 }}>(sin preview)</div>
                )}
              </div>

              {/* Nombre */}
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: isSelected ? '#089a98' : 'var(--jordyn-text, #333)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {p.nombre}
              </div>
            </button>
          );
        })}
      </div>

      {/* Ayuda */}
      <div style={{
        fontSize: '.7rem',
        color: 'var(--jordyn-muted, #888)',
        marginTop: 10,
        fontStyle: 'italic',
      }}>
        {seleccionadaId
          ? <>Esta rifa usará: <b style={{ color: 'var(--jordyn-text, #222)' }}>
              {plantillas.find(p => String(p.id) === String(seleccionadaId))?.nombre}
            </b></>
          : <>Sin elegir → al imprimir se usa la marcada como ⭐ default del sistema.</>
        }
      </div>
    </div>
  );
}
//