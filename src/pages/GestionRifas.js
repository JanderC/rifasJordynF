import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const emptyForm = { nombre: '', descripcion: '', premio: '', precio: '', fecha_sorteo: '', loteria_ref: '' };

export default function GestionRifas() {
  const [rifas,    setRifas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState(emptyForm);
  const [editId,   setEditId]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);

  const formatPrecio = (p) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

  const load = useCallback(async () => {
    try {
      const res = await API.get('/rifas');
      setRifas(res.data);
    } catch { toast.error('Error cargando rifas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (r) => {
    setForm({
      nombre: r.nombre || '',
      descripcion: r.descripcion || '',
      premio: r.premio || '',
      precio: r.precio || '',
      fecha_sorteo: r.fecha_sorteo ? r.fecha_sorteo.split('T')[0] : '',
      loteria_ref: r.loteria_ref || '',
    });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleNueva = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.premio || !form.precio) { toast.error('Nombre, premio y precio son requeridos'); return; }
    setSaving(true);
    try {
      if (editId) {
        await API.put(`/rifas/${editId}`, form);
        toast.success('Rifa actualizada');
      } else {
        await API.post('/rifas', form);
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

  const handleDelete = async (r) => {
    if (!window.confirm(`¿Eliminar la rifa "${r.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await API.delete(`/rifas/${r.id}`);
      toast.success('Rifa eliminada');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error eliminando rifa'); }
  };

  return (
    <Layout title="GESTIÓN DE RIFAS">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <p style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.75rem', color: 'var(--jordyn-muted)', margin: 0 }}>
          Máximo 2 rifas activas simultáneas
        </p>
        <button className="btn-jordyn" onClick={handleNueva} disabled={rifas.filter(r => r.activa).length >= 2}>
          <i className="bi bi-plus-lg me-2"></i>NUEVA RIFA
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="jd-card jd-card-gold mb-4 fade-in">
          <h5 style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.2rem', letterSpacing: '2px', color: 'var(--jordyn-gold)', marginBottom: '1.5rem' }}>
            {editId ? '✏️ EDITAR RIFA' : '➕ NUEVA RIFA'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="jd-label">NOMBRE DE LA RIFA *</label>
                <input className="jd-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="RIFA JORDYN #1" />
              </div>
              <div className="col-12 col-md-6">
                <label className="jd-label">PREMIO *</label>
                <input className="jd-input" value={form.premio} onChange={e => setForm(p => ({ ...p, premio: e.target.value }))} placeholder="Descripción del premio" />
              </div>
              <div className="col-12 col-md-4">
                <label className="jd-label">PRECIO POR NÚMERO *</label>
                <input className="jd-input" type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} placeholder="10000" />
              </div>
              <div className="col-12 col-md-4">
                <label className="jd-label">FECHA DE SORTEO</label>
                <input className="jd-input" type="date" value={form.fecha_sorteo} onChange={e => setForm(p => ({ ...p, fecha_sorteo: e.target.value }))} />
              </div>
              <div className="col-12 col-md-4">
                <label className="jd-label">REFERENCIA LOTERÍA</label>
                <input className="jd-input" value={form.loteria_ref} onChange={e => setForm(p => ({ ...p, loteria_ref: e.target.value }))} placeholder="Lotería de Bogotá" />
              </div>
              <div className="col-12">
                <label className="jd-label">DESCRIPCIÓN</label>
                <textarea className="jd-input" rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving ? 'GUARDANDO...' : <><i className="bi bi-floppy-fill me-2"></i>{editId ? 'ACTUALIZAR' : 'CREAR RIFA'}</>}
              </button>
              <button type="button" className="btn-jordyn-outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null); }}>
                CANCELAR
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
      ) : (
        <div className="row g-3">
          {rifas.length === 0 && (
            <div className="col-12"><div className="jd-alert jd-alert-warning"><i className="bi bi-exclamation-triangle-fill"></i>No hay rifas creadas</div></div>
          )}
          {rifas.map((r) => (
            <div key={r.id} className="col-12 col-md-6">
              <div className={`jd-card ${r.activa ? 'jd-card-gold' : ''}`} style={{ opacity: r.activa ? 1 : 0.6 }}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h5 style={{ fontFamily: 'var(--jordyn-display)', fontSize: '1.1rem', letterSpacing: '2px', color: r.activa ? 'var(--jordyn-gold)' : 'var(--jordyn-muted)', marginBottom: '2px' }}>
                      {r.nombre}
                    </h5>
                    <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)' }}>🏆 {r.premio}</div>
                  </div>
                  <span className={r.activa ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize: '0.7rem' }}>
                    {r.activa ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>

                <div className="row g-2 mb-3" style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.72rem' }}>
                  <div className="col-6">
                    <div style={{ color: 'var(--jordyn-muted)' }}>PRECIO</div>
                    <div style={{ color: 'var(--jordyn-gold)' }}>{formatPrecio(r.precio)}</div>
                  </div>
                  <div className="col-6">
                    <div style={{ color: 'var(--jordyn-muted)' }}>SORTEO</div>
                    <div>{r.fecha_sorteo ? new Date(r.fecha_sorteo).toLocaleDateString('es-CO') : 'Por definir'}</div>
                  </div>
                  <div className="col-6">
                    <div style={{ color: 'var(--jordyn-muted)' }}>VENTAS</div>
                    <div style={{ color: 'var(--jordyn-green)' }}>{r.total_ventas || 0}</div>
                  </div>
                  <div className="col-6">
                    <div style={{ color: 'var(--jordyn-muted)' }}>RECAUDADO</div>
                    <div style={{ color: 'var(--jordyn-green)' }}>{formatPrecio(r.ingresos_totales)}</div>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button className="btn-jordyn-outline" onClick={() => handleEdit(r)} style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                    <i className="bi bi-pencil-fill me-1"></i>EDITAR
                  </button>
                  <button
                    onClick={() => handleToggle(r)}
                    style={{
                      background: 'transparent', border: `1px solid ${r.activa ? 'var(--jordyn-red)' : 'var(--jordyn-green)'}`,
                      color: r.activa ? 'var(--jordyn-red)' : 'var(--jordyn-green)',
                      borderRadius: '4px', padding: '4px 12px', fontFamily: 'var(--jordyn-display)',
                      fontSize: '0.8rem', letterSpacing: '1px', cursor: 'pointer'
                    }}
                  >
                    {r.activa ? 'DESACTIVAR' : 'ACTIVAR'}
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    style={{
                      background: 'transparent', border: '1px solid #333',
                      color: 'var(--jordyn-muted)', borderRadius: '4px', padding: '4px 10px',
                      cursor: 'pointer', marginLeft: 'auto'
                    }}
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}