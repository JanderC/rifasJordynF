import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const emptyForm = { nombre: '', usuario: '', password: '', rol: 'vendedor' };

export default function GestionVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [rifas,      setRifas]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);

  // Modal asignación de números
  const [modalVend,   setModalVend]   = useState(null);
  const [modalRifa,   setModalRifa]   = useState('');
  const [numerosAsig, setNumerosAsig] = useState([]);
  const [numInput,    setNumInput]    = useState('');
  const [aleatorio,   setAleatorio]   = useState({ cantidad: 5, rifaId: '' });
  const [loadingAl,   setLoadingAl]   = useState(false);

  const formatPrecio = (p) =>
    new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p||0);

  const load = useCallback(async () => {
    try {
      const [vRes, rRes] = await Promise.all([
        API.get('/vendedores'),
        API.get('/rifas'),
      ]);
      setVendedores(vRes.data);
      setRifas(rRes.data.filter(r => r.activa));
      if (rRes.data.filter(r=>r.activa).length > 0) {
        setModalRifa(rRes.data.filter(r=>r.activa)[0].id);
        setAleatorio(p => ({ ...p, rifaId: rRes.data.filter(r=>r.activa)[0].id }));
      }
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.usuario || (!editId && !form.password)) {
      toast.error('Nombre, usuario y contraseña son requeridos');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const payload = { nombre: form.nombre };
        if (form.password) payload.password = form.password;
        await API.put(`/vendedores/${editId}`, payload);
        toast.success('Vendedor actualizado');
      } else {
        await API.post('/auth/register', form);
        toast.success('Vendedor creado');
      }
      setShowForm(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando vendedor');
    } finally { setSaving(false); }
  };

  const handleToggle = async (v) => {
    try {
      await API.put(`/vendedores/${v.id}`, { activo: !v.activo });
      toast.info(`Vendedor ${!v.activo ? 'activado' : 'desactivado'}`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // ── Gestión de números asignados ──────────────────────────
  const abrirModal = async (v) => {
    setModalVend(v);
    await cargarNumerosVendedor(v.id, modalRifa || rifas[0]?.id);
  };

  const cargarNumerosVendedor = async (vendId, rifaId) => {
    if (!vendId || !rifaId) return;
    try {
      const res = await API.get(`/vendedores/${vendId}`);
      const asignados = res.data.numeros_asignados.filter(n => n.rifa_id === rifaId);
      setNumerosAsig(asignados.map(n => n.numero));
    } catch { toast.error('Error cargando números'); }
  };

  const handleAgregarNumero = async () => {
    const num = numInput.padStart(3, '0');
    if (!/^[0-9]{3}$/.test(num)) { toast.error('Número inválido'); return; }
    if (numerosAsig.includes(num)) { toast.warning('Ya está asignado'); return; }
    try {
      await API.post('/numeros/asignar', { vendedor_id: modalVend.id, rifa_id: modalRifa, numeros: [num] });
      setNumerosAsig(p => [...p, num].sort());
      setNumInput('');
      toast.success(`Número ${num} asignado`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleQuitarNumero = async (num) => {
    try {
      await API.delete('/numeros/asignar', { data: { vendedor_id: modalVend.id, rifa_id: modalRifa, numeros: [num] } });
      setNumerosAsig(p => p.filter(n => n !== num));
      toast.info(`Número ${num} removido`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleAleatorios = async () => {
    setLoadingAl(true);
    try {
      const res = await API.get(`/vendedores/${modalVend.id}/numeros-aleatorios`, {
        params: { rifa_id: aleatorio.rifaId, cantidad: aleatorio.cantidad }
      });
      const nums = res.data.numeros_sugeridos;
      if (nums.length === 0) { toast.warning('No hay números disponibles'); return; }
      await API.post('/numeros/asignar', { vendedor_id: modalVend.id, rifa_id: aleatorio.rifaId, numeros: nums });
      setNumerosAsig(p => [...new Set([...p, ...nums])].sort());
      toast.success(`${nums.length} números aleatorios asignados`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoadingAl(false); }
  };

  return (
    <Layout title="VENDEDORES">

      <div className="d-flex justify-content-end mb-4">
        <button className="btn-jordyn" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <i className="bi bi-person-plus-fill me-2"></i>NUEVO VENDEDOR
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="jd-card jd-card-blue mb-4 fade-in">
          <h5 style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.1rem', letterSpacing: '2px', color: 'var(--jordyn-blue)', marginBottom: '1.5rem' }}>
            {editId ? '✏️ EDITAR VENDEDOR' : '➕ NUEVO VENDEDOR'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="jd-label">NOMBRE COMPLETO *</label>
                <input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))} placeholder="Juan Pérez" />
              </div>
              {!editId && (
                <div className="col-12 col-md-6">
                  <label className="jd-label">NOMBRE DE USUARIO *</label>
                  <input className="jd-input" value={form.usuario} onChange={e => setForm(p => ({...p, usuario: e.target.value.toLowerCase().replace(/\s/g,'')}))} placeholder="juan_perez" />
                </div>
              )}
              <div className="col-12 col-md-6">
                <label className="jd-label">{editId ? 'NUEVA CONTRASEÑA (dejar vacío para no cambiar)' : 'CONTRASEÑA *'}</label>
                <input className="jd-input" type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="Min. 6 caracteres" />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving ? 'GUARDANDO...' : <><i className="bi bi-floppy-fill me-2"></i>{editId ? 'ACTUALIZAR' : 'CREAR'}</>}
              </button>
              <button type="button" className="btn-jordyn-outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); }}>
                CANCELAR
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{width:40,height:40}}></div></div>
      ) : (
        <div className="jd-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="jd-table">
            <thead>
              <tr>
                <th>VENDEDOR</th>
                <th>VENTAS</th>
                <th>INGRESOS</th>
                <th>NÚMS. ASIG.</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontFamily: 'var(--jordyn-mono)' }}>Sin vendedores registrados</td></tr>
              )}
              {vendedores.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{v.nombre}</div>
                    <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)' }}>@{v.usuario}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--jordyn-mono)', color: 'var(--jordyn-text)' }}>{v.total_ventas}</td>
                  <td style={{ fontFamily: 'var(--jordyn-mono)', color: 'var(--jordyn-green)' }}>{formatPrecio(v.total_ingresos)}</td>
                  <td style={{ fontFamily: 'var(--jordyn-mono)' }}>{v.numeros_asignados}</td>
                  <td>
                    <span className={v.activo ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize: '0.68rem' }}>
                      {v.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button
                        onClick={() => abrirModal(v)}
                        title="Gestionar números"
                        style={{ background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.3)', color: 'var(--jordyn-gold)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        <i className="bi bi-grid-3x3-gap"></i>
                      </button>
                      <button
                        onClick={() => { setForm({ nombre: v.nombre, usuario: v.usuario, password: '' }); setEditId(v.id); setShowForm(true); }}
                        title="Editar"
                        style={{ background: 'rgba(17,138,178,0.1)', border: '1px solid rgba(17,138,178,0.3)', color: 'var(--jordyn-blue)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        <i className="bi bi-pencil-fill"></i>
                      </button>
                      <button
                        onClick={() => handleToggle(v)}
                        title={v.activo ? 'Desactivar' : 'Activar'}
                        style={{ background: v.activo ? 'rgba(230,57,70,0.1)' : 'rgba(6,214,160,0.1)', border: `1px solid ${v.activo ? 'rgba(230,57,70,0.3)' : 'rgba(6,214,160,0.3)'}`, color: v.activo ? 'var(--jordyn-red)' : 'var(--jordyn-green)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        <i className={`bi bi-${v.activo ? 'pause-circle' : 'play-circle'}`}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Asignación de números */}
      {modalVend && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">NÚMEROS DE {modalVend.nombre.toUpperCase()}</h5>
                <button className="btn-close" onClick={() => setModalVend(null)}></button>
              </div>
              <div className="modal-body">

                {/* Selector de rifa */}
                <div className="mb-3">
                  <label className="jd-label">RIFA</label>
                  <select
                    className="jd-select"
                    value={modalRifa}
                    onChange={e => { setModalRifa(e.target.value); cargarNumerosVendedor(modalVend.id, e.target.value); }}
                  >
                    {rifas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>

                {/* Añadir número manual */}
                <div className="d-flex gap-2 mb-3">
                  <input
                    className="jd-input"
                    style={{ fontFamily: 'var(--jordyn-mono)', textAlign: 'center', letterSpacing: '6px', maxWidth: '120px' }}
                    value={numInput}
                    onChange={e => setNumInput(e.target.value.replace(/\D/g,'').slice(0,3))}
                    placeholder="000"
                    maxLength={3}
                  />
                  <button className="btn-jordyn-outline" onClick={handleAgregarNumero}>
                    <i className="bi bi-plus-lg me-1"></i>AGREGAR
                  </button>
                </div>

                {/* Aleatorios */}
                <div className="d-flex gap-2 align-items-center mb-3" style={{ background: '#1a1a1a', padding: '0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.75rem', color: 'var(--jordyn-muted)' }}>ALEATORIOS:</span>
                  <input
                    className="jd-input"
                    type="number"
                    min={1} max={100}
                    style={{ maxWidth: '80px' }}
                    value={aleatorio.cantidad}
                    onChange={e => setAleatorio(p => ({ ...p, cantidad: e.target.value }))}
                  />
                  <select
                    className="jd-select"
                    style={{ flex: 1 }}
                    value={aleatorio.rifaId}
                    onChange={e => setAleatorio(p => ({ ...p, rifaId: e.target.value }))}
                  >
                    {rifas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                  <button className="btn-jordyn" onClick={handleAleatorios} disabled={loadingAl} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                    {loadingAl ? '...' : <><i className="bi bi-shuffle me-1"></i>ASIGNAR</>}
                  </button>
                </div>

                {/* Lista de números asignados */}
                <div>
                  <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)', marginBottom: '0.5rem' }}>
                    {numerosAsig.length} NÚMEROS ASIGNADOS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {numerosAsig.length === 0 && (
                      <span style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.8rem', color: 'var(--jordyn-muted)' }}>Sin números asignados</span>
                    )}
                    {numerosAsig.map(n => (
                      <span
                        key={n}
                        style={{
                          background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.3)',
                          color: 'var(--jordyn-gold)', borderRadius: '4px', padding: '2px 8px',
                          fontFamily: 'var(--jordyn-mono)', fontSize: '0.85rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="Click para quitar"
                        onClick={() => handleQuitarNumero(n)}
                      >
                        {n} <i className="bi bi-x" style={{ fontSize: '0.7rem' }}></i>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-jordyn-outline" onClick={() => setModalVend(null)}>CERRAR</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}