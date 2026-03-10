import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

/* ─── Loterías Colombia + Venezuela ─── */
const LOTERIAS = [
  { grupo: 'Colombia', items: [
    'Baloto', 'Revancha Baloto', 'Lotería de Bogotá', 'Lotería del Tolima',
    'Lotería de Cundinamarca', 'Lotería de Boyacá', 'Lotería del Huila',
    'Lotería de Caldas', 'Lotería del Quindío', 'Lotería de Risaralda',
    'Lotería del Meta', 'Lotería de Santander', 'Lotería del Valle',
    'Lotería del Cauca', 'Lotería de Manizales', 'Lotería de Armenia',
    'Chance Codechocó', 'La Greca', 'Dorado', 'Culona', 'Paisita',
    'Pijao de Oro', 'Cafeterito', 'Super Astro Sol', 'Super Astro Luna',
  ]},
  { grupo: 'Venezuela', items: [
    'Lotería del Táchira', 'Lotería de Mérida', 'Lotería del Zulia',
    'Lotería de Caracas', 'Lottery Venezuela', 'Animalitos', 'Tripleta',
    'La Greca Venezuela', 'El Kino', 'Chance Venezuela',
  ]},
  { grupo: 'Otra', items: ['Otra lotería / referencia propia'] },
];

const emptyForm = {
  nombre: '', descripcion: '', premio: '', precio: '', precio_display: '',
  fecha_sorteo: '', loteria_ref: '', tipo: 'sencilla', imagen_base64: '',
};

/* ─── Formateo COP ─── */
const fmtCOP = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const parseCOP = (str) => parseInt(str.replace(/\D/g, '') || '0');

/* ─── Imagen a base64 ─── */
const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload  = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

/* ═══════════════════════════════════════════════════
   MODAL: Números disponibles de una rifa
═══════════════════════════════════════════════════ */
function ModalNumeros({ rifa, onClose }) {
  const [numeros, setNumeros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState('disponible');

  useEffect(() => {
    API.get(`/publico/rifas/${rifa.id}/numeros-disponibles`)
      .then(r => setNumeros(r.data))
      .catch(() => toast.error('Error cargando números'))
      .finally(() => setLoading(false));
  }, [rifa.id]);

  const filtrados = numeros.filter(n => filtro === 'todos' || n.estado === filtro);
  const conteo = {
    disponible: numeros.filter(n => n.estado === 'disponible').length,
    vendido_1:  numeros.filter(n => n.estado === 'vendido_1').length,
    agotado:    numeros.filter(n => n.estado === 'agotado').length,
    reservado:  numeros.filter(n => n.estado === 'reservado').length,
  };

  const colorEstado = {
    disponible: '#059669',
    vendido_1:  '#b37700',
    agotado:    '#e63946',
    reservado:  '#118ab2',
  };
  const bgEstado = {
    disponible: 'rgba(6,214,160,0.10)',
    vendido_1:  'rgba(240,165,0,0.12)',
    agotado:    'rgba(230,57,70,0.13)',
    reservado:  'rgba(17,138,178,0.10)',
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
    >
      <div style={{ width:'100%', maxWidth:720, maxHeight:'90vh', background:'#fff', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(10,191,188,0.2)' }}>
        {/* Header */}
        <div style={{ background:'var(--jordyn-primary)', color:'#fff', padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem' }}>NÚMEROS — {rifa.nombre}</div>
            <div style={{ fontSize:'0.72rem', opacity:0.85, marginTop:2 }}>{conteo.disponible} disponibles de 1000</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'1rem' }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Filtros */}
        <div style={{ padding:'0.75rem 1.5rem', borderBottom:'1px solid var(--jordyn-border)', display:'flex', gap:'8px', flexWrap:'wrap', flexShrink:0, background:'var(--jordyn-bg2)' }}>
          {[
            { key:'todos',      label:'Todos',       count: numeros.length },
            { key:'disponible', label:'Disponibles', count: conteo.disponible },
            { key:'vendido_1',  label:'1 venta',     count: conteo.vendido_1  },
            { key:'agotado',    label:'Agotados',    count: conteo.agotado    },
            { key:'reservado',  label:'Reservados',  count: conteo.reservado  },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{
              background: filtro === f.key ? 'var(--jordyn-primary)' : '#fff',
              color: filtro === f.key ? '#fff' : 'var(--jordyn-muted)',
              border: `1.5px solid ${filtro === f.key ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`,
              borderRadius:20, padding:'3px 12px', fontSize:'0.72rem', fontWeight:600,
              cursor:'pointer', display:'flex', gap:5, alignItems:'center',
            }}>
              {f.label} <span style={{ opacity:0.7 }}>({f.count})</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.5rem' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
              <div className="jd-spinner" style={{ width:40, height:40 }}></div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(52px,1fr))', gap:4 }}>
              {filtrados.map(n => (
                <div key={n.numero} style={{
                  aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:6, fontSize:'0.68rem', fontWeight:700,
                  background: bgEstado[n.estado] || 'rgba(10,191,188,0.06)',
                  color: colorEstado[n.estado] || 'var(--jordyn-muted)',
                  border: `1.5px solid ${colorEstado[n.estado] || 'var(--jordyn-border)'}20`,
                }}>
                  {n.numero}
                </div>
              ))}
              {filtrados.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'2rem', color:'var(--jordyn-muted)', fontSize:'0.85rem' }}>
                  Sin números en este estado
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════ */
export default function GestionRifas() {
  const [rifas,          setRifas]          = useState([]);
  const [rifasArchivadas,setRifasArchivadas] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [form,           setForm]           = useState(emptyForm);
  const [editId,         setEditId]         = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [modalNums,      setModalNums]      = useState(null); // rifa para modal números
  const fileRef = useRef();

  const load = useCallback(async () => {
    try {
      const res = await API.get('/rifas');
      setRifas(res.data.filter(r => r.estado !== 'archivada'));
      setRifasArchivadas(res.data.filter(r => r.estado === 'archivada'));
    } catch { toast.error('Error cargando rifas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Precio con formato ── */
  const handlePrecioChange = (val) => {
    const num = parseCOP(val);
    setForm(p => ({ ...p, precio: num, precio_display: num ? fmtCOP(num) : '' }));
  };

  /* ── Imagen ── */
  const handleImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagen demasiado grande (máx 2MB)'); return; }
    const b64 = await fileToBase64(file);
    setForm(p => ({ ...p, imagen_base64: b64 }));
  };

  /* ── Editar ── */
  const handleEdit = (r) => {
    setForm({
      nombre:         r.nombre        || '',
      descripcion:    r.descripcion   || '',
      premio:         r.premio        || '',
      precio:         r.precio        || '',
      precio_display: r.precio        ? fmtCOP(r.precio) : '',
      fecha_sorteo:   r.fecha_sorteo  ? r.fecha_sorteo.split('T')[0] : '',
      loteria_ref:    r.loteria_ref   || '',
      tipo:           r.tipo          || 'sencilla',
      imagen_base64:  r.imagen_url    || '',
    });
    setEditId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNueva = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.premio || !form.precio) {
      toast.error('Nombre, premio y precio son requeridos');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre:       form.nombre,
        descripcion:  form.descripcion,
        premio:       form.premio,
        precio:       form.precio,
        fecha_sorteo: form.fecha_sorteo || null,
        loteria_ref:  form.loteria_ref  || null,
        tipo:         form.tipo,
        imagen_url:   form.imagen_base64 || null,
      };
      if (editId) {
        await API.put(`/rifas/${editId}`, payload);
        toast.success('Rifa actualizada');
      } else {
        await API.post('/rifas', payload);
        toast.success('Rifa creada');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando rifa');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r) => {
    try {
      await API.put(`/rifas/${r.id}`, { activa: !r.activa });
      toast.info(`Rifa ${!r.activa ? 'activada' : 'desactivada'}`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleArchivar = async (r) => {
    if (!window.confirm(`¿Archivar la rifa "${r.nombre}"? Se conservará el historial.`)) return;
    try {
      await API.put(`/rifas/${r.id}`, { activa: false, estado: 'archivada' });
      toast.success('Rifa archivada');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error archivando rifa'); }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`¿Eliminar definitivamente "${r.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await API.delete(`/rifas/${r.id}`);
      toast.success('Rifa eliminada');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error eliminando rifa'); }
  };

  const rifasActivas = rifas.filter(r => r.activa);

  /* ── Tarjeta de rifa ── */
  const RifaCard = ({ r, archivada = false }) => (
    <div className={`jd-card ${r.activa ? 'jd-card-primary' : ''} fade-in`}
      style={{ opacity: r.activa ? 1 : 0.72, height: '100%' }}>

      {/* Imagen del premio */}
      {r.imagen_url && (
        <img
          src={r.imagen_url}
          alt="Premio"
          className="rifa-imagen-preview"
          style={{ width:'100%', maxHeight:180, objectFit:'cover', borderRadius:8, marginBottom:'0.75rem' }}
        />
      )}

      {/* Cabecera */}
      <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
        <div style={{ minWidth:0 }}>
          <h5 style={{ fontWeight:800, fontSize:'1.05rem', color: r.activa ? 'var(--jordyn-primary)' : 'var(--jordyn-muted)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.nombre}
          </h5>
          <div style={{ fontSize:'0.75rem', color:'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
        </div>
        <div className="d-flex flex-column align-items-end gap-1" style={{ flexShrink:0 }}>
          <span className={r.activa ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize:'0.68rem' }}>
            {archivada ? 'ARCHIVADA' : r.activa ? 'ACTIVA' : 'INACTIVA'}
          </span>
          {r.tipo && (
            <span className={r.tipo === 'simultanea' ? 'badge-simultanea' : 'badge-sencilla'} style={{ fontSize:'0.64rem' }}>
              {r.tipo === 'simultanea' ? '⚡ SIMULTÁNEA' : '🎯 SENCILLA'}
            </span>
          )}
        </div>
      </div>

      {/* Datos */}
      <div className="row g-2 mb-3" style={{ fontSize:'0.78rem' }}>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>PRECIO</div>
          <div style={{ fontWeight:700, color:'var(--jordyn-gold)', fontSize:'0.9rem' }}>{fmtCOP(r.precio)}</div>
        </div>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>SORTEO</div>
          <div style={{ fontWeight:600 }}>{r.fecha_sorteo ? new Date(r.fecha_sorteo).toLocaleDateString('es-CO') : 'Por definir'}</div>
        </div>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>VENTAS</div>
          <div style={{ fontWeight:700, color:'var(--jordyn-primary)' }}>{r.total_ventas || 0}</div>
        </div>
        <div className="col-6">
          <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>RECAUDADO</div>
          <div style={{ fontWeight:700, color:'var(--jordyn-green)' }}>{fmtCOP(r.ingresos_totales)}</div>
        </div>
        {r.loteria_ref && (
          <div className="col-12">
            <div style={{ color:'var(--jordyn-muted)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>LOTERÍA</div>
            <div style={{ fontWeight:600, fontSize:'0.78rem' }}>🎲 {r.loteria_ref}</div>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      {(r.total_ventas || 0) > 0 && (
        <div className="mb-3">
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem', color:'var(--jordyn-muted)', marginBottom:3 }}>
            <span>Progreso</span>
            <span>{Math.min(100, Math.round((r.total_ventas / 1000) * 100))}%</span>
          </div>
          <div className="jd-progress">
            <div className="jd-progress-bar jd-progress-bar-primary" style={{ width:`${Math.min(100,(r.total_ventas/1000)*100)}%` }}></div>
          </div>
        </div>
      )}

      {/* Botones */}
      {!archivada && (
        <div className="d-flex flex-wrap gap-2">
          <button className="btn-jordyn-outline" onClick={() => handleEdit(r)}
            style={{ fontSize:'0.75rem', padding:'4px 10px' }}>
            <i className="bi bi-pencil-fill me-1"></i>Editar
          </button>

          <button
            onClick={() => setModalNums(r)}
            style={{ background:'rgba(10,191,188,0.08)', border:'1.5px solid rgba(10,191,188,0.3)', color:'var(--jordyn-primary)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
          >
            <i className="bi bi-grid-3x3-gap"></i> Números
          </button>

          <a
            href={`/diseno-ticket?rifa=${r.id}`}
            style={{ background:'rgba(240,165,0,0.08)', border:'1.5px solid rgba(240,165,0,0.3)', color:'var(--jordyn-gold)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4, textDecoration:'none' }}
          >
            <i className="bi bi-ticket-perforated"></i> Boleto
          </a>

          <button
            onClick={() => handleToggle(r)}
            style={{
              background:'transparent',
              border: `1.5px solid ${r.activa ? 'rgba(230,57,70,0.4)' : 'rgba(6,214,160,0.4)'}`,
              color: r.activa ? 'var(--jordyn-red)' : 'var(--jordyn-green)',
              borderRadius:8, padding:'4px 10px',
              fontFamily:'var(--jordyn-font)', fontWeight:600, fontSize:'0.75rem', cursor:'pointer',
            }}
          >
            {r.activa ? 'Desactivar' : 'Activar'}
          </button>

          <button
            onClick={() => handleArchivar(r)}
            title="Archivar (conserva historial)"
            style={{ background:'transparent', border:'1.5px solid var(--jordyn-border)', color:'var(--jordyn-muted)', borderRadius:8, padding:'4px 8px', cursor:'pointer', marginLeft:'auto' }}
          >
            <i className="bi bi-archive"></i>
          </button>
        </div>
      )}

      {archivada && (
        <div className="d-flex gap-2">
          <button className="btn-jordyn-danger" onClick={() => handleDelete(r)} style={{ fontSize:'0.75rem', padding:'4px 10px' }}>
            <i className="bi bi-trash3"></i> Eliminar
          </button>
          <button
            onClick={() => handleToggle({ ...r, activa: false })}
            style={{ background:'rgba(6,214,160,0.08)', border:'1.5px solid rgba(6,214,160,0.35)', color:'var(--jordyn-green)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Layout title="GESTIÓN DE RIFAS">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <p style={{ fontFamily:'var(--jordyn-font)', fontSize:'0.8rem', color:'var(--jordyn-muted)', margin:0 }}>
          <i className="bi bi-info-circle me-1"></i>
          Máximo 2 rifas activas simultáneas — {rifasActivas.length}/2 activas
        </p>
        <button className="btn-jordyn" onClick={handleNueva} disabled={rifasActivas.length >= 2}>
          <i className="bi bi-plus-lg me-1"></i>NUEVA RIFA
        </button>
      </div>

      {/* ═══ FORMULARIO ═══ */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-4 fade-in">
          <h5 style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--jordyn-primary)', marginBottom:'1.5rem' }}>
            {editId ? '✏️ Editar rifa' : '➕ Nueva rifa'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Imagen del premio */}
              <div className="col-12">
                <label className="jd-label">FOTO DEL PREMIO</label>
                {form.imagen_base64 ? (
                  <div style={{ position:'relative', display:'inline-block', width:'100%' }}>
                    <img src={form.imagen_base64} alt="Premio" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:10, border:'2px solid var(--jordyn-border)' }} />
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, imagen_base64: '' }))}
                      style={{ position:'absolute', top:8, right:8, background:'rgba(230,57,70,0.85)', border:'none', color:'#fff', borderRadius:6, padding:'3px 9px', cursor:'pointer' }}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ) : (
                  <div className="rifa-imagen-upload" onClick={() => fileRef.current?.click()}>
                    <i className="bi bi-image" style={{ fontSize:'2rem', color:'var(--jordyn-primary)', display:'block', marginBottom:6 }}></i>
                    <div style={{ fontSize:'0.82rem', color:'var(--jordyn-muted)', fontWeight:500 }}>Click para subir foto del premio (máx 2MB)</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImagen} />
              </div>

              {/* Nombre */}
              <div className="col-12 col-md-6">
                <label className="jd-label">NOMBRE DE LA RIFA *</label>
                <input className="jd-input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="RIFA JORDYN #1" />
              </div>

              {/* Premio */}
              <div className="col-12 col-md-6">
                <label className="jd-label">DESCRIPCIÓN DEL PREMIO *</label>
                <input className="jd-input" value={form.premio}
                  onChange={e => setForm(p => ({ ...p, premio: e.target.value }))}
                  placeholder="Moto, TV 65, Viaje, etc." />
              </div>

              {/* Precio COP */}
              <div className="col-12 col-md-4">
                <label className="jd-label">PRECIO POR NÚMERO (COP) *</label>
                <input
                  className="jd-input"
                  value={form.precio_display}
                  onChange={e => handlePrecioChange(e.target.value)}
                  onBlur={() => form.precio && setForm(p => ({ ...p, precio_display: fmtCOP(p.precio) }))}
                  onFocus={() => setForm(p => ({ ...p, precio_display: p.precio ? String(p.precio) : '' }))}
                  placeholder="$10.000"
                  style={{ fontWeight:700, fontSize:'1rem' }}
                />
                {form.precio > 0 && (
                  <div style={{ fontSize:'0.72rem', color:'var(--jordyn-primary)', marginTop:3, fontWeight:600 }}>
                    = {fmtCOP(form.precio)} por boleto
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div className="col-12 col-md-4">
                <label className="jd-label">FECHA DE SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha_sorteo}
                  onChange={e => setForm(p => ({ ...p, fecha_sorteo: e.target.value }))} />
              </div>

              {/* Tipo */}
              <div className="col-12 col-md-4">
                <label className="jd-label">TIPO DE RIFA</label>
                <select className="jd-select" value={form.tipo}
                  onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="sencilla">🎯 Sencilla (1 número ganador)</option>
                  <option value="simultanea">⚡ Simultánea (2 rifas paralelas)</option>
                </select>
              </div>

              {/* Lotería SELECT */}
              <div className="col-12">
                <label className="jd-label">LOTERÍA DE REFERENCIA</label>
                <select className="jd-select" value={form.loteria_ref}
                  onChange={e => setForm(p => ({ ...p, loteria_ref: e.target.value }))}>
                  <option value="">— Sin referencia —</option>
                  {LOTERIAS.map(grupo => (
                    <optgroup key={grupo.grupo} label={`─── ${grupo.grupo} ───`}>
                      {grupo.items.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label className="jd-label">DESCRIPCIÓN ADICIONAL</label>
                <textarea className="jd-input" rows={2} value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Detalles del premio, condiciones, etc."
                  style={{ resize:'vertical' }} />
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:16, height:16, borderWidth:2 }}></span> Guardando...</>
                  : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Actualizar' : 'Crear rifa'}</>
                }
              </button>
              <button type="button" className="btn-jordyn-outline"
                onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ LISTA DE RIFAS ═══ */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : (
        <>
          {/* Rifas activas/inactivas */}
          <div className="row g-3 mb-4">
            {rifas.length === 0 && (
              <div className="col-12">
                <div className="jd-alert jd-alert-warning">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  No hay rifas creadas. ¡Crea la primera!
                </div>
              </div>
            )}
            {rifas.map(r => (
              <div key={r.id} className="col-12 col-md-6">
                <RifaCard r={r} />
              </div>
            ))}
          </div>

          {/* Rifas archivadas (colapsable) */}
          {rifasArchivadas.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchivadas(!showArchivadas)}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border)',
                  borderRadius:10, padding:'0.8rem 1.25rem', cursor:'pointer',
                  color:'var(--jordyn-muted)', fontWeight:700, fontSize:'0.85rem', marginBottom: showArchivadas ? '1rem' : 0,
                }}
              >
                <span><i className="bi bi-archive me-2"></i>RIFAS ARCHIVADAS ({rifasArchivadas.length})</span>
                <i className={`bi bi-chevron-${showArchivadas ? 'up' : 'down'}`}></i>
              </button>

              {showArchivadas && (
                <div className="row g-3 fade-in">
                  {rifasArchivadas.map(r => (
                    <div key={r.id} className="col-12 col-md-6">
                      <RifaCard r={r} archivada />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ MODAL NÚMEROS ═══ */}
      {modalNums && (
        <ModalNumeros rifa={modalNums} onClose={() => setModalNums(null)} />
      )}
    </Layout>
  );
}