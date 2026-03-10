import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const emptyForm = { nombre: '', usuario: '', password: '', rol: 'vendedor', cedula: '' };

const fmtCOP = (p) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

/* ─── Generar PDF / ventana de impresión con los números ─── */
function imprimirNumeros(vendedor, rifa, numeros) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Números asignados — ${vendedor.nombre}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Poppins', sans-serif; background: #fff; color: #1a2e2e; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #0abfbc; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 22px; font-weight: 800; color: #0abfbc; }
        .header p  { font-size: 11px; color: #6b9090; margin-top: 3px; }
        .meta { display: flex; gap: 24px; justify-content: center; margin-bottom: 16px; font-size: 11px; color: #6b9090; }
        .meta b { color: #1a2e2e; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 5px; }
        .num { aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
               font-weight: 700; font-size: 11px; border: 1.5px solid #0abfbc;
               border-radius: 6px; color: #0abfbc; background: rgba(10,191,188,0.06); }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px dashed #ddd; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎰 RIFAS JORDYN</h1>
        <p>Números asignados para venta</p>
      </div>
      <div class="meta">
        <span>Vendedor: <b>${vendedor.nombre}</b></span>
        <span>Rifa: <b>${rifa?.nombre || 'N/A'}</b></span>
        <span>Total: <b>${numeros.length} números</b></span>
        <span>Fecha: <b>${new Date().toLocaleDateString('es-CO')}</b></span>
      </div>
      <div class="grid">
        ${numeros.map(n => `<div class="num">${n}</div>`).join('')}
      </div>
      <div class="footer">
        Impreso el ${new Date().toLocaleString('es-CO')} · Sistema RIFAS JORDYN
      </div>
    </body>
    </html>
  `;
  const win = window.open('', '_blank', 'width=700,height=600');
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}

/* ═══════════════════════════════════════════════════
   MODAL ASIGNACIÓN DE NÚMEROS
═══════════════════════════════════════════════════ */
function ModalNumeros({ vendedor, rifas, onClose }) {
  const [rifaId,      setRifaId]      = useState(rifas[0]?.id || '');
  const [asignados,   setAsignados]   = useState([]);
  const [numInput,    setNumInput]    = useState('');
  const [rangoIni,    setRangoIni]    = useState('');
  const [rangoFin,    setRangoFin]    = useState('');
  const [cantidad,    setCantidad]    = useState(10);
  const [loadingAl,   setLoadingAl]   = useState(false);
  const [tab,         setTab]         = useState('manual'); // manual | rango | aleatorio

  const rifaActual = rifas.find(r => r.id === rifaId);

  const cargar = useCallback(async (rId) => {
    if (!rId) return;
    try {
      const res = await API.get(`/vendedores/${vendedor.id}`);
      const nums = (res.data.numeros_asignados || []).filter(n => n.rifa_id === rId).map(n => n.numero);
      setAsignados(nums.sort());
    } catch { toast.error('Error cargando números'); }
  }, [vendedor.id]);

  useEffect(() => { if (rifaId) cargar(rifaId); }, [rifaId, cargar]);

  const agregar = async (nums) => {
    const validos = nums.filter(n => /^\d{3}$/.test(n) && !asignados.includes(n));
    if (!validos.length) { toast.warning('Números inválidos o ya asignados'); return; }
    try {
      await API.post('/numeros/asignar', { vendedor_id: vendedor.id, rifa_id: rifaId, numeros: validos });
      setAsignados(p => [...new Set([...p, ...validos])].sort());
      toast.success(`${validos.length} número(s) asignados`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const quitar = async (num) => {
    try {
      await API.delete('/numeros/asignar', { data: { vendedor_id: vendedor.id, rifa_id: rifaId, numeros: [num] } });
      setAsignados(p => p.filter(n => n !== num));
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const agregarManual = () => {
    const num = numInput.padStart(3, '0');
    if (!/^\d{3}$/.test(num)) { toast.error('Número inválido'); return; }
    agregar([num]);
    setNumInput('');
  };

  const agregarRango = () => {
    const ini = parseInt(rangoIni);
    const fin = parseInt(rangoFin);
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini < 0 || fin > 999) {
      toast.error('Rango inválido (0–999)'); return;
    }
    const nums = [];
    for (let i = ini; i <= fin; i++) nums.push(String(i).padStart(3, '0'));
    agregar(nums);
  };

  const agregarAleatorios = async () => {
    setLoadingAl(true);
    try {
      const res = await API.get(`/vendedores/${vendedor.id}/numeros-aleatorios`, {
        params: { rifa_id: rifaId, cantidad }
      });
      const nums = res.data.numeros_sugeridos || [];
      if (!nums.length) { toast.warning('No hay números disponibles'); return; }
      await API.post('/numeros/asignar', { vendedor_id: vendedor.id, rifa_id: rifaId, numeros: nums });
      setAsignados(p => [...new Set([...p, ...nums])].sort());
      toast.success(`${nums.length} números aleatorios asignados`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoadingAl(false); }
  };

  const quitarTodos = async () => {
    if (!window.confirm('¿Quitar todos los números asignados?')) return;
    try {
      await API.delete('/numeros/asignar', { data: { vendedor_id: vendedor.id, rifa_id: rifaId, numeros: asignados } });
      setAsignados([]);
      toast.info('Todos los números removidos');
    } catch (err) { toast.error('Error'); }
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,30,30,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
    >
      <div style={{ width:'100%', maxWidth:680, maxHeight:'90vh', background:'#fff', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(10,191,188,0.2)' }}>

        {/* Header */}
        <div style={{ background:'var(--jordyn-primary)', color:'#fff', padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem' }}>NÚMEROS — {vendedor.nombre}</div>
            <div style={{ fontSize:'0.72rem', opacity:0.85, marginTop:2 }}>{asignados.length} números asignados</div>
          </div>
          <div className="d-flex gap-2">
            <button
              onClick={() => imprimirNumeros(vendedor, rifaActual, asignados)}
              disabled={!asignados.length}
              style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}
            >
              <i className="bi bi-printer-fill"></i> Imprimir
            </button>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer' }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem' }}>

          {/* Selector rifa */}
          {rifas.length > 1 && (
            <div className="mb-3">
              <label className="jd-label">RIFA</label>
              <select className="jd-select" value={rifaId} onChange={e => setRifaId(e.target.value)}>
                {rifas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Link público */}
          {vendedor.cedula && (
            <div className="jd-alert jd-alert-info mb-3" style={{ fontSize:'0.78rem' }}>
              <i className="bi bi-link-45deg"></i>
              Link del vendedor:{' '}
              <a href={`/vendedor/${vendedor.cedula}`} target="_blank" rel="noreferrer"
                style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>
                /vendedor/{vendedor.cedula}
              </a>
            </div>
          )}

          {/* Tabs de asignación */}
          <div style={{ display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1.5px solid var(--jordyn-border)', marginBottom:'1rem' }}>
            {[['manual','Número manual'],['rango','Rango'],['aleatorio','Aleatorios']].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex:1, padding:'8px 6px', border:'none', cursor:'pointer', fontSize:'0.78rem', fontWeight:600,
                background: tab===k ? 'var(--jordyn-primary)' : 'transparent',
                color: tab===k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: k!=='aleatorio' ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>
                {l}
              </button>
            ))}
          </div>

          {/* Panel manual */}
          {tab === 'manual' && (
            <div className="d-flex gap-2 mb-3">
              <input
                className="jd-input" style={{ maxWidth:100, textAlign:'center', fontWeight:800, letterSpacing:4, fontSize:'1.1rem' }}
                value={numInput}
                onChange={e => setNumInput(e.target.value.replace(/\D/g,'').slice(0,3))}
                onKeyDown={e => e.key === 'Enter' && agregarManual()}
                placeholder="000" maxLength={3}
              />
              <button className="btn-jordyn" onClick={agregarManual}>
                <i className="bi bi-plus-lg me-1"></i>Agregar
              </button>
            </div>
          )}

          {/* Panel rango */}
          {tab === 'rango' && (
            <div className="d-flex gap-2 mb-3 align-items-end flex-wrap">
              <div>
                <label className="jd-label">DESDE</label>
                <input className="jd-input" type="number" min={0} max={999}
                  style={{ maxWidth:90 }} placeholder="001"
                  value={rangoIni} onChange={e => setRangoIni(e.target.value)} />
              </div>
              <div>
                <label className="jd-label">HASTA</label>
                <input className="jd-input" type="number" min={0} max={999}
                  style={{ maxWidth:90 }} placeholder="050"
                  value={rangoFin} onChange={e => setRangoFin(e.target.value)} />
              </div>
              <button className="btn-jordyn" onClick={agregarRango}>
                <i className="bi bi-list-ol me-1"></i>Agregar rango
              </button>
              {rangoIni && rangoFin && parseInt(rangoFin) >= parseInt(rangoIni) && (
                <span style={{ fontSize:'0.72rem', color:'var(--jordyn-muted)', alignSelf:'center' }}>
                  = {parseInt(rangoFin) - parseInt(rangoIni) + 1} números
                </span>
              )}
            </div>
          )}

          {/* Panel aleatorio */}
          {tab === 'aleatorio' && (
            <div className="d-flex gap-2 mb-3 align-items-end flex-wrap">
              <div>
                <label className="jd-label">CANTIDAD</label>
                <input className="jd-input" type="number" min={1} max={200}
                  style={{ maxWidth:90 }} value={cantidad}
                  onChange={e => setCantidad(Number(e.target.value))} />
              </div>
              <button className="btn-jordyn" onClick={agregarAleatorios} disabled={loadingAl}>
                {loadingAl
                  ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Asignando...</>
                  : <><i className="bi bi-shuffle me-1"></i>Asignar aleatorios</>
                }
              </button>
            </div>
          )}

          {/* Números asignados */}
          <div style={{ background:'var(--jordyn-bg2)', borderRadius:10, padding:'0.9rem', border:'1px solid var(--jordyn-border)' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {asignados.length} NÚMEROS ASIGNADOS
              </span>
              {asignados.length > 0 && (
                <button onClick={quitarTodos} style={{ background:'none', border:'none', color:'var(--jordyn-red)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                  <i className="bi bi-trash3 me-1"></i>Quitar todos
                </button>
              )}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, maxHeight:200, overflowY:'auto' }}>
              {asignados.length === 0 && (
                <span style={{ fontSize:'0.82rem', color:'var(--jordyn-muted)' }}>Sin números asignados</span>
              )}
              {asignados.map(n => (
                <span key={n}
                  onClick={() => quitar(n)}
                  title="Click para quitar"
                  style={{
                    background:'rgba(10,191,188,0.10)', border:'1.5px solid rgba(10,191,188,0.30)',
                    color:'var(--jordyn-primary)', borderRadius:6, padding:'3px 9px',
                    fontWeight:700, fontSize:'0.78rem', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:3,
                    transition:'all 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(230,57,70,0.10)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(10,191,188,0.10)'}
                >
                  {n} <i className="bi bi-x" style={{ fontSize:'0.65rem' }}></i>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════ */
export default function GestionVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [modalVend,  setModalVend]  = useState(null);

  const load = useCallback(async () => {
    try {
      const [vRes, rRes] = await Promise.all([API.get('/vendedores'), API.get('/rifas')]);
      setVendedores(vRes.data);
      setRifas(rRes.data.filter(r => r.activa));
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.usuario || (!editId && !form.password)) {
      toast.error('Nombre, usuario y contraseña son requeridos'); return;
    }
    setSaving(true);
    try {
      if (editId) {
        const payload = { nombre: form.nombre, cedula: form.cedula };
        if (form.password) payload.password = form.password;
        await API.put(`/vendedores/${editId}`, payload);
        toast.success('Vendedor actualizado');
      } else {
        await API.post('/auth/register', { ...form, cedula: form.cedula });
        toast.success('Vendedor creado');
      }
      setShowForm(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error guardando vendedor'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (v) => {
    try {
      await API.put(`/vendedores/${v.id}`, { activo: !v.activo });
      toast.info(`Vendedor ${!v.activo ? 'activado' : 'desactivado'}`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const activos   = vendedores.filter(v => v.activo);
  const inactivos = vendedores.filter(v => !v.activo);

  const VendedorRow = ({ v }) => (
    <div className="jd-card" style={{ padding:'1rem 1.25rem', marginBottom:8 }}>
      <div className="d-flex align-items-center gap-3 flex-wrap">
        {/* Avatar */}
        <div style={{
          width:44, height:44, borderRadius:'50%', flexShrink:0,
          background:'rgba(10,191,188,0.12)', border:'2px solid rgba(10,191,188,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'1.1rem', fontWeight:800, color:'var(--jordyn-primary)',
        }}>
          {v.nombre.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--jordyn-text)' }}>{v.nombre}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--jordyn-muted)' }}>
            @{v.usuario}
            {v.cedula && <span style={{ marginLeft:8, color:'var(--jordyn-primary)' }}>· Céd: {v.cedula}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="d-flex gap-3 hide-mobile" style={{ fontSize:'0.78rem' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:800, color:'var(--jordyn-primary)', fontSize:'1.1rem' }}>{v.total_ventas || 0}</div>
            <div style={{ color:'var(--jordyn-muted)', fontSize:'0.62rem', textTransform:'uppercase', fontWeight:600 }}>Ventas</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:800, color:'var(--jordyn-green)', fontSize:'0.88rem' }}>{fmtCOP(v.total_ingresos)}</div>
            <div style={{ color:'var(--jordyn-muted)', fontSize:'0.62rem', textTransform:'uppercase', fontWeight:600 }}>Ingresos</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:800, color:'var(--jordyn-gold)', fontSize:'1.1rem' }}>{v.numeros_asignados || 0}</div>
            <div style={{ color:'var(--jordyn-muted)', fontSize:'0.62rem', textTransform:'uppercase', fontWeight:600 }}>Asignados</div>
          </div>
        </div>

        {/* Badge estado */}
        <span className={v.activo ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize:'0.65rem' }}>
          {v.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>

        {/* Acciones */}
        <div className="d-flex gap-1">
          {/* Números */}
          <button
            onClick={() => setModalVend(v)}
            title="Gestionar números asignados"
            style={{ background:'rgba(10,191,188,0.10)', border:'1.5px solid rgba(10,191,188,0.30)', color:'var(--jordyn-primary)', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:4 }}
          >
            <i className="bi bi-grid-3x3-gap"></i>
            <span className="hide-mobile" style={{ fontSize:'0.72rem', fontWeight:600 }}>Números</span>
          </button>

          {/* Editar */}
          <button
            onClick={() => { setForm({ nombre:v.nombre, usuario:v.usuario, password:'', rol:'vendedor', cedula:v.cedula||'' }); setEditId(v.id); setShowForm(true); }}
            title="Editar"
            style={{ background:'rgba(17,138,178,0.08)', border:'1.5px solid rgba(17,138,178,0.25)', color:'var(--jordyn-blue)', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'0.85rem' }}
          >
            <i className="bi bi-pencil-fill"></i>
          </button>

          {/* Activar/Desactivar */}
          <button
            onClick={() => handleToggle(v)}
            title={v.activo ? 'Desactivar' : 'Activar'}
            style={{
              background: v.activo ? 'rgba(230,57,70,0.08)' : 'rgba(6,214,160,0.08)',
              border: `1.5px solid ${v.activo ? 'rgba(230,57,70,0.25)' : 'rgba(6,214,160,0.25)'}`,
              color: v.activo ? 'var(--jordyn-red)' : 'var(--jordyn-green)',
              borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'0.85rem',
            }}
          >
            <i className={`bi bi-${v.activo ? 'pause-circle' : 'play-circle'}`}></i>
          </button>

          {/* Link público */}
          {v.cedula && (
            <a
              href={`/vendedor/${v.cedula}`} target="_blank" rel="noreferrer"
              title="Ver pantalla pública del vendedor"
              style={{ background:'rgba(240,165,0,0.08)', border:'1.5px solid rgba(240,165,0,0.25)', color:'var(--jordyn-gold)', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center' }}
            >
              <i className="bi bi-box-arrow-up-right"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Layout title="VENDEDORES">

      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div style={{ fontSize:'0.8rem', color:'var(--jordyn-muted)' }}>
          <i className="bi bi-people-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
          {activos.length} activos · {inactivos.length} inactivos
        </div>
        <button className="btn-jordyn" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <i className="bi bi-person-plus-fill me-1"></i>NUEVO VENDEDOR
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-4 fade-in">
          <h5 style={{ fontWeight:800, fontSize:'1.05rem', color:'var(--jordyn-primary)', marginBottom:'1.25rem' }}>
            {editId ? '✏️ Editar vendedor' : '➕ Nuevo vendedor'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-5">
                <label className="jd-label">NOMBRE COMPLETO *</label>
                <input className="jd-input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan Pérez" />
              </div>
              {!editId && (
                <div className="col-12 col-md-4">
                  <label className="jd-label">NOMBRE DE USUARIO *</label>
                  <input className="jd-input" value={form.usuario}
                    onChange={e => setForm(p => ({ ...p, usuario: e.target.value.toLowerCase().replace(/\s/g,'') }))}
                    placeholder="juan_perez" />
                </div>
              )}
              <div className="col-12 col-md-3">
                <label className="jd-label">CÉDULA (para link público)</label>
                <input className="jd-input" value={form.cedula}
                  onChange={e => setForm(p => ({ ...p, cedula: e.target.value.replace(/\D/g,'') }))}
                  placeholder="123456789" type="tel" />
              </div>
              <div className="col-12 col-md-5">
                <label className="jd-label">{editId ? 'NUEVA CONTRASEÑA (vacío = no cambiar)' : 'CONTRASEÑA *'}</label>
                <input className="jd-input" type="password" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mín. 6 caracteres" />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving ? 'Guardando...' : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Actualizar' : 'Crear'}</>}
              </button>
              <button type="button" className="btn-jordyn-outline"
                onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista con scroll */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : (
        <div style={{ maxHeight:'calc(100vh - 260px)', overflowY:'auto', paddingRight:4 }}>
          {vendedores.length === 0 && (
            <div className="jd-alert jd-alert-warning">
              <i className="bi bi-exclamation-triangle-fill"></i>
              Sin vendedores registrados
            </div>
          )}

          {activos.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'0.6rem', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--jordyn-green)', display:'inline-block' }}></span>
                Activos ({activos.length})
              </div>
              {activos.map(v => <VendedorRow key={v.id} v={v} />)}
            </div>
          )}

          {inactivos.length > 0 && (
            <div>
              <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'0.6rem', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#ccc', display:'inline-block' }}></span>
                Inactivos ({inactivos.length})
              </div>
              {inactivos.map(v => <VendedorRow key={v.id} v={v} />)}
            </div>
          )}
        </div>
      )}

      {/* Modal asignación */}
      {modalVend && rifas.length > 0 && (
        <ModalNumeros
          vendedor={modalVend}
          rifas={rifas}
          onClose={() => setModalVend(null)}
        />
      )}
      {modalVend && rifas.length === 0 && (
        <div className="jd-alert jd-alert-warning mt-3">
          <i className="bi bi-exclamation-triangle-fill"></i>
          No hay rifas activas para asignar números
        </div>
      )}
    </Layout>
  );
}