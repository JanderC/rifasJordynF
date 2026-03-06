import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function Historial() {
  const { user } = useAuth();
  const [ventas,   setVentas]   = useState([]);
  const [rifas,    setRifas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtroR,  setFiltroR]  = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [page,     setPage]     = useState(1);

  const formatPrecio = (p) =>
    new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p||0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, rRes] = await Promise.all([
        API.get('/numeros/ventas/historial', { params: { rifa_id: filtroR || undefined, page, limit: 100 } }),
        API.get('/rifas'),
      ]);
      setVentas(vRes.data.ventas);
      setRifas(rRes.data);
    } catch { toast.error('Error cargando historial'); }
    finally { setLoading(false); }
  }, [filtroR, page]);

  useEffect(() => { load(); }, [load]);

  const handleAnular = async (v) => {
    if (!window.confirm(`¿Anular la venta del número ${v.numero} a ${v.nombre_comprador}?`)) return;
    try {
      await API.delete(`/numeros/venta/${v.id}`);
      toast.success(`Venta del número ${v.numero} anulada`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error anulando venta'); }
  };

  const ventasFiltradas = ventas.filter(v => {
    if (!busqueda) return true;
    const b = busqueda.toLowerCase();
    return (
      v.numero.includes(b) ||
      v.nombre_comprador.toLowerCase().includes(b) ||
      v.vendedor_nombre?.toLowerCase().includes(b)
    );
  });

  const totalIngresos = ventasFiltradas.reduce((acc, v) => acc + parseFloat(v.precio_venta || 0), 0);

  return (
    <Layout title={user?.rol === 'dueno' ? 'HISTORIAL DE VENTAS' : 'MIS VENTAS'}>

      {/* Filtros */}
      <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
        <select className="jd-select" style={{ maxWidth: '220px' }} value={filtroR} onChange={e => { setFiltroR(e.target.value); setPage(1); }}>
          <option value="">Todas las rifas</option>
          {rifas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <input
          className="jd-input"
          style={{ maxWidth: '220px' }}
          placeholder="Buscar número o comprador..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <button className="btn-jordyn-outline" onClick={load} style={{ padding: '6px 14px', fontSize: '0.9rem' }}>
          <i className="bi bi-arrow-clockwise"></i>
        </button>
        <div className="ms-auto" style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.75rem', color: 'var(--jordyn-muted)' }}>
          {ventasFiltradas.length} ventas ·{' '}
          <span style={{ color: 'var(--jordyn-green)' }}>{formatPrecio(totalIngresos)}</span>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
      ) : (
        <div className="jd-card table-responsive-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="jd-table">
              <thead>
                <tr>
                  <th>NÚMERO</th>
                  <th>COMPRADOR</th>
                  <th className="hide-mobile">RIFA</th>
                  {user?.rol === 'dueno' && <th>VENDEDOR</th>}
                  <th>PRECIO</th>
                  <th className="hide-mobile">FECHA</th>
                  {user?.rol === 'dueno' && <th>ACCIÓN</th>}
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--jordyn-muted)', fontFamily: 'var(--jordyn-mono)', padding: '2rem' }}>
                      Sin ventas registradas
                    </td>
                  </tr>
                )}
                {ventasFiltradas.map(v => (
                  <tr key={v.id}>
                    <td>
                      <span style={{
                        fontFamily: 'var(--jordyn-mono)', fontSize: '1.1rem', fontWeight: 700,
                        background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)',
                        padding: '2px 8px', borderRadius: '4px', color: 'var(--jordyn-gold)'
                      }}>{v.numero}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.nombre_comprador}</div>
                      {v.telefono && <div style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.7rem', color: 'var(--jordyn-muted)' }}>{v.telefono}</div>}
                    </td>
                    <td style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.8rem', color: 'var(--jordyn-muted)' }}>{v.rifa_nombre}</td>
                    {user?.rol === 'dueno' && (
                      <td style={{ fontSize: '0.85rem' }}>{v.vendedor_nombre}</td>
                    )}
                    <td style={{ fontFamily: 'var(--jordyn-mono)', color: 'var(--jordyn-green)' }}>{formatPrecio(v.precio_venta)}</td>
                    <td style={{ fontFamily: 'var(--jordyn-mono)', fontSize: '0.75rem', color: 'var(--jordyn-muted)' }}>
                      {new Date(v.created_at).toLocaleDateString('es-CO')}{' '}
                      <span style={{ color: '#444' }}>{new Date(v.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    {user?.rol === 'dueno' && (
                      <td>
                        <button
                          onClick={() => handleAnular(v)}
                          title="Anular venta"
                          style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', color: 'var(--jordyn-red)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          <i className="bi bi-trash3"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}