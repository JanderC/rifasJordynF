// ============================================================
//   GestionVendedores.js — RIFAS JORDYN
//
//   FLUJO DE NÚMEROS:
//   - Los números (000–999) se asignan GLOBALMENTE al vendedor
//     (no están ligados a ninguna rifa todavía)
//   - Al crear/editar una rifa se hace multiselect de vendedores
//     → sus números quedan reservados automáticamente para esa rifa
//   - Un vendedor puede participar en múltiples rifas con los mismos números
//   - Los números asignados a vendedores NO aparecen en la pantalla pública
//     (solo se muestran los números disponibles / sin vendedor)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const emptyForm = { nombre: '', rol: 'vendedor' };

/* ─── Genera usuario y contraseña automáticos desde el nombre ─── */
function generarCredenciales(nombre) {
  const base = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('_')
    .slice(0, 20);
  const sufijo = Math.floor(1000 + Math.random() * 9000); // 4 dígitos aleatorios
  return {
    usuario: `${base}_${sufijo}`,
    password: `${base}${sufijo}`,
  };
}

const fmtCOP = (p) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p || 0);

/* ─── Pool global: 000 → 999 ─── */
const TOTAL_NUMEROS = 1000;

/* ─── Imprimir números del vendedor ─── */
function imprimirNumeros(vendedor, numeros) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Números — ${vendedor.nombre}</title>
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
        <h1>🎰  RIFAS JORDYN</h1>
        <p>Números asignados para venta</p>
      </div>
      <div class="meta">
        <span>Vendedor: <b>${vendedor.nombre}</b></span>
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
   MODAL ASIGNACIÓN DE NÚMEROS GLOBALES
   ─ Los números aquí son del vendedor en general,
     sin rifa asociada. Se usan en rifas cuando el
     vendedor es seleccionado en la creación de rifa.
═══════════════════════════════════════════════════ */
function ModalNumeros({ vendedor, numerosOcupados, onClose, onSaved }) {
  // numerosOcupados = array de números ya asignados a OTROS vendedores
  const [asignados,  setAsignados]  = useState([]);
  const [numInput,   setNumInput]   = useState('');
  const [rangoIni,   setRangoIni]   = useState('');
  const [rangoFin,   setRangoFin]   = useState('');
  const [cantidad,   setCantidad]   = useState(10);
  const [loadingAl,  setLoadingAl]  = useState(false);
  const [loadingIni, setLoadingIni] = useState(true);
  const [tab,        setTab]        = useState('manual');

  /* Cargar números actuales del vendedor */
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await API.get(`/vendedores/${vendedor.id}`);
        // Números globales del vendedor (sin filtro de rifa)
        const nums = (res.data.numeros_asignados || [])
          .map(n => typeof n === 'object' ? n.numero : n)
          .filter(Boolean);
        setAsignados([...new Set(nums)].sort());
      } catch {
        toast.error('Error cargando números');
      } finally {
        setLoadingIni(false);
      }
    };
    cargar();
  }, [vendedor.id]);

  const estaOcupado = (num) => numerosOcupados.includes(num);

  const agregar = async (nums) => {
    const validos = nums.filter(n => {
      if (!/^\d{3}$/.test(n)) return false;
      if (asignados.includes(n)) return false;
      if (estaOcupado(n)) return false;
      return true;
    });
    const yaOcupados = nums.filter(n => estaOcupado(n) && !asignados.includes(n));
    if (yaOcupados.length) {
      toast.warning(`${yaOcupados.length} número(s) ya pertenecen a otro vendedor`);
    }
    if (!validos.length) return;
    try {
      // Sin rifa_id: asignación global
      await API.post('/numeros/asignar', {
        vendedor_id: vendedor.id,
        numeros: validos
      });
      setAsignados(p => [...new Set([...p, ...validos])].sort());
      toast.success(`${validos.length} número(s) asignados`);
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error asignando');
    }
  };

  const quitar = async (num) => {
    try {
      await API.delete('/numeros/asignar', {
        data: { vendedor_id: vendedor.id, numeros: [num] }
      });
      setAsignados(p => p.filter(n => n !== num));
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se puede quitar: número vendido en una rifa activa');
    }
  };

  const quitarTodos = async () => {
    if (!window.confirm('¿Quitar todos los números asignados?')) return;
    try {
      await API.delete('/numeros/asignar', {
        data: { vendedor_id: vendedor.id, numeros: asignados }
      });
      setAsignados([]);
      onSaved && onSaved();
      toast.info('Todos los números removidos');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const agregarManual = () => {
    const num = numInput.padStart(3, '0');
    if (!/^\d{3}$/.test(num)) { toast.error('Número inválido (000–999)'); return; }
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
      // Solicitar números aleatorios excluyendo los ya ocupados y los del vendedor
      const excluir = [...new Set([...numerosOcupados, ...asignados])];
      const res = await API.get(`/vendedores/${vendedor.id}/numeros-aleatorios`, {
        params: { cantidad, excluir: excluir.join(',') }
      });
      const nums = res.data.numeros_sugeridos || [];
      if (!nums.length) { toast.warning('No hay números disponibles'); return; }
      await API.post('/numeros/asignar', { vendedor_id: vendedor.id, numeros: nums });
      setAsignados(p => [...new Set([...p, ...nums])].sort());
      toast.success(`${nums.length} números aleatorios asignados`);
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setLoadingAl(false);
    }
  };

  const disponiblesGlobal = TOTAL_NUMEROS - numerosOcupados.length - asignados.length;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,30,30,0.55)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}
    >
      <div style={{
        width: '100%', maxWidth: 700, maxHeight: '92vh',
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(10,191,188,0.22)'
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--jordyn-primary)', color: '#fff',
          padding: '1rem 1.5rem', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              NÚMEROS GLOBALES — {vendedor.nombre}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>
              {asignados.length} asignados · {disponiblesGlobal} libres del pool de 1,000
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              onClick={() => imprimirNumeros(vendedor, asignados)}
              disabled={!asignados.length}
              style={{
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff', borderRadius: 8, padding: '6px 12px',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: asignados.length ? 1 : 0.5
              }}
            >
              <i className="bi bi-printer-fill"></i> Imprimir
            </button>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer'
            }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* Aviso informativo del flujo */}
          <div className="jd-alert jd-alert-info mb-3" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            Los números aquí asignados son <strong>fijos de este vendedor</strong>.
            Se reservarán automáticamente en cada rifa donde sea incluido.
          </div>

          {/* Barra de progreso del pool */}
          <div style={{
            background: 'var(--jordyn-bg2)', borderRadius: 10,
            padding: '0.8rem 1rem', marginBottom: '1rem',
            border: '1px solid var(--jordyn-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.72rem', color: 'var(--jordyn-muted)', fontWeight: 600 }}>
              <span>POOL DE NÚMEROS (0–999)</span>
              <span>{numerosOcupados.length + asignados.length} / {TOTAL_NUMEROS} ocupados</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--jordyn-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, var(--jordyn-primary), var(--jordyn-green))',
                width: `${((numerosOcupados.length + asignados.length) / TOTAL_NUMEROS) * 100}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.68rem' }}>
              <span style={{ color: 'var(--jordyn-primary)', fontWeight: 700 }}>● Este vendedor: {asignados.length}</span>
              <span style={{ color: 'var(--jordyn-muted)' }}>● Otros vendedores: {numerosOcupados.length}</span>
              <span style={{ color: 'var(--jordyn-green)', fontWeight: 700 }}>● Libres: {disponiblesGlobal}</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden',
            border: '1.5px solid var(--jordyn-border)', marginBottom: '1rem'
          }}>
            {[['manual', 'Número manual'], ['rango', 'Rango'], ['aleatorio', 'Aleatorios']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600,
                background: tab === k ? 'var(--jordyn-primary)' : 'transparent',
                color: tab === k ? '#fff' : 'var(--jordyn-muted)',
                borderRight: k !== 'aleatorio' ? '1.5px solid var(--jordyn-border)' : 'none',
              }}>
                {l}
              </button>
            ))}
          </div>

          {/* Panel manual */}
          {tab === 'manual' && (
            <div className="d-flex gap-2 mb-3">
              <input
                className="jd-input"
                style={{ maxWidth: 100, textAlign: 'center', fontWeight: 800, letterSpacing: 4, fontSize: '1.1rem' }}
                value={numInput}
                onChange={e => setNumInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onKeyDown={e => e.key === 'Enter' && agregarManual()}
                placeholder="000" maxLength={3}
              />
              <button className="btn-jordyn" onClick={agregarManual}>
                <i className="bi bi-plus-lg me-1"></i>Agregar
              </button>
              {numInput.length === 3 && estaOcupado(numInput.padStart(3, '0')) && (
                <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: 'var(--jordyn-red)', fontWeight: 600 }}>
                  <i className="bi bi-x-circle me-1"></i>Ya asignado a otro vendedor
                </span>
              )}
              {numInput.length === 3 && asignados.includes(numInput.padStart(3, '0')) && (
                <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: 'var(--jordyn-gold)', fontWeight: 600 }}>
                  <i className="bi bi-check-circle me-1"></i>Ya tienes este número
                </span>
              )}
            </div>
          )}

          {/* Panel rango */}
          {tab === 'rango' && (
            <div className="d-flex gap-2 mb-3 align-items-end flex-wrap">
              <div>
                <label className="jd-label">DESDE</label>
                <input className="jd-input" type="number" min={0} max={999}
                  style={{ maxWidth: 90 }} placeholder="001"
                  value={rangoIni} onChange={e => setRangoIni(e.target.value)} />
              </div>
              <div>
                <label className="jd-label">HASTA</label>
                <input className="jd-input" type="number" min={0} max={999}
                  style={{ maxWidth: 90 }} placeholder="050"
                  value={rangoFin} onChange={e => setRangoFin(e.target.value)} />
              </div>
              <button className="btn-jordyn" onClick={agregarRango}>
                <i className="bi bi-list-ol me-1"></i>Agregar rango
              </button>
              {rangoIni && rangoFin && parseInt(rangoFin) >= parseInt(rangoIni) && (
                <span style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)', alignSelf: 'center' }}>
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
                <input className="jd-input" type="number" min={1} max={disponiblesGlobal}
                  style={{ maxWidth: 90 }} value={cantidad}
                  onChange={e => setCantidad(Number(e.target.value))} />
              </div>
              <button className="btn-jordyn" onClick={agregarAleatorios} disabled={loadingAl || disponiblesGlobal === 0}>
                {loadingAl
                  ? <><span className="jd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Asignando...</>
                  : <><i className="bi bi-shuffle me-1"></i>Asignar aleatorios</>
                }
              </button>
              <span style={{ alignSelf: 'center', fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>
                {disponiblesGlobal} disponibles en el pool
              </span>
            </div>
          )}

          {/* Lista de números asignados */}
          <div style={{
            background: 'var(--jordyn-bg2)', borderRadius: 10,
            padding: '0.9rem', border: '1px solid var(--jordyn-border)'
          }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--jordyn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {asignados.length} números asignados a {vendedor.nombre}
              </span>
              {asignados.length > 0 && (
                <button onClick={quitarTodos} style={{ background: 'none', border: 'none', color: 'var(--jordyn-red)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                  <i className="bi bi-trash3 me-1"></i>Quitar todos
                </button>
              )}
            </div>

            {loadingIni ? (
              <div className="d-flex justify-content-center py-3">
                <div className="jd-spinner" style={{ width: 24, height: 24 }}></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                {asignados.length === 0 && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)' }}>Sin números asignados</span>
                )}
                {asignados.map(n => (
                  <span key={n}
                    onClick={() => quitar(n)}
                    title="Click para quitar"
                    style={{
                      background: 'rgba(10,191,188,0.10)', border: '1.5px solid rgba(10,191,188,0.30)',
                      color: 'var(--jordyn-primary)', borderRadius: 6, padding: '3px 9px',
                      fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(230,57,70,0.10)'; e.currentTarget.style.borderColor = 'rgba(230,57,70,0.35)'; e.currentTarget.style.color = 'var(--jordyn-red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,191,188,0.10)'; e.currentTarget.style.borderColor = 'rgba(10,191,188,0.30)'; e.currentTarget.style.color = 'var(--jordyn-primary)'; }}
                  >
                    {n} <i className="bi bi-x" style={{ fontSize: '0.65rem' }}></i>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PÁGINA PRINCIPAL — GESTIÓN DE VENDEDORES
═══════════════════════════════════════════════════ */
export default function GestionVendedores() {
  const [vendedores,     setVendedores]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [form,           setForm]           = useState(emptyForm);
  const [saving,         setSaving]         = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [editId,         setEditId]         = useState(null);
  const [modalVend,      setModalVend]      = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await API.get('/vendedores');
      setVendedores(res.data);
    } catch {
      toast.error('Error cargando vendedores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Números ocupados por OTROS vendedores (para el modal) ── */
  const getNumerosOcupadosPorOtros = (vendedorId) => {
    return vendedores
      .filter(v => v.id !== vendedorId)
      .flatMap(v => {
        const nums = v.numeros_asignados || [];
        return nums.map(n => typeof n === 'object' ? n.numero : n).filter(Boolean);
      });
  };

  /* ── Resumen global del pool ── */
  const totalAsignadosPool = vendedores.reduce((acc, v) => {
    const nums = v.numeros_asignados || [];
    return acc + nums.length;
  }, 0);
  const totalLibresPool = TOTAL_NUMEROS - totalAsignadosPool;

  /* ── CRUD vendedor ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre del vendedor es requerido'); return;
    }
    setSaving(true);
    try {
      if (editId) {
        const payload = { nombre: form.nombre };
        if (form.password) payload.password = form.password;
        await API.put(`/vendedores/${editId}`, payload);
        toast.success('Vendedor actualizado');
      } else {
        const { usuario, password } = generarCredenciales(form.nombre);
        await API.post('/auth/register', { ...form, usuario, password });
        toast.success(`Vendedor creado — usuario: ${usuario} · contraseña: ${password}`);
      }
      setShowForm(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando vendedor');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (v) => {
    try {
      await API.put(`/vendedores/${v.id}`, { activo: !v.activo });
      toast.info(`Vendedor ${!v.activo ? 'activado' : 'desactivado'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEliminar = (v) => {
    const tieneVentas = (v.total_ventas || 0) > 0;
    setConfirmDelete({ id: v.id, nombre: v.nombre, tieneVentas, vendedor: v });
  };

  const confirmarEliminacion = async () => {
    if (!confirmDelete) return;
    try {
      await API.delete(`/vendedores/${confirmDelete.id}`);
      toast.success(`Vendedor "${confirmDelete.nombre}" eliminado`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
      if (err.response?.status === 400) {
        setConfirmDelete(p => ({ ...p, errorVentas: true }));
      }
    }
  };

  const confirmarDesactivar = async () => {
    if (!confirmDelete) return;
    try {
      await API.put(`/vendedores/${confirmDelete.id}`, { activo: false });
      toast.info(`Vendedor "${confirmDelete.nombre}" desactivado`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al desactivar');
    }
  };

  const activos   = vendedores.filter(v => v.activo);
  const inactivos = vendedores.filter(v => !v.activo);

  /* ──────────────────────────────────────────────
     FILA DE VENDEDOR
  ────────────────────────────────────────────── */
  const VendedorRow = ({ v }) => {
    const numerosCount = (v.numeros_asignados || []).length;
    return (
      <div className="jd-card" style={{ padding: '1rem 1.25rem', marginBottom: 8 }}>
        <div className="d-flex align-items-center gap-3 flex-wrap">

          {/* Avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(10,191,188,0.12)', border: '2px solid rgba(10,191,188,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', fontWeight: 800, color: 'var(--jordyn-primary)',
          }}>
            {v.nombre.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--jordyn-text)' }}>{v.nombre}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--jordyn-muted)' }}>
              @{v.usuario}
              {v.cedula && <span style={{ marginLeft: 8, color: 'var(--jordyn-primary)' }}>· Céd: {v.cedula}</span>}
            </div>
          </div>

          {/* Stats */}
          <div className="d-flex gap-3 hide-mobile" style={{ fontSize: '0.78rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--jordyn-primary)', fontSize: '1.1rem' }}>
                {v.total_ventas || 0}
              </div>
              <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 600 }}>
                Ventas
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--jordyn-gold)', fontSize: '1.1rem' }}>
                {numerosCount}
              </div>
              <div style={{ color: 'var(--jordyn-muted)', fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 600 }}>
                Núms. fijos
              </div>
            </div>
          </div>

          {/* Badge estado */}
          <span className={v.activo ? 'badge-disponible' : 'badge-agotado'} style={{ fontSize: '0.65rem' }}>
            {v.activo ? 'ACTIVO' : 'INACTIVO'}
          </span>

          {/* Acciones */}
          <div className="d-flex gap-1">

            {/* Gestionar números globales */}
            <button
              onClick={() => setModalVend(v)}
              title="Gestionar números del vendedor"
              style={{
                background: numerosCount > 0
                  ? 'rgba(10,191,188,0.12)' : 'rgba(240,165,0,0.10)',
                border: `1.5px solid ${numerosCount > 0
                  ? 'rgba(10,191,188,0.35)' : 'rgba(240,165,0,0.35)'}`,
                color: numerosCount > 0 ? 'var(--jordyn-primary)' : 'var(--jordyn-gold)',
                borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
                fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <i className="bi bi-grid-3x3-gap"></i>
              <span className="hide-mobile" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                {numerosCount > 0 ? `${numerosCount} números` : 'Asignar números'}
              </span>
            </button>

            {/* Editar */}
            <button
              onClick={() => {
                setForm({ nombre: v.nombre, password: '', rol: 'vendedor' });
                setEditId(v.id);
                setShowForm(true);
              }}
              title="Editar"
              style={{
                background: 'rgba(17,138,178,0.08)', border: '1.5px solid rgba(17,138,178,0.25)',
                color: 'var(--jordyn-blue)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.85rem'
              }}
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
                borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              <i className={`bi bi-${v.activo ? 'pause-circle' : 'play-circle'}`}></i>
            </button>

            {/* Link público */}
            {v.cedula && (
              <a
                href={`/vendedor/${v.cedula}`} target="_blank" rel="noreferrer"
                title="Ver pantalla pública del vendedor"
                style={{
                  background: 'rgba(240,165,0,0.08)', border: '1.5px solid rgba(240,165,0,0.25)',
                  color: 'var(--jordyn-gold)', borderRadius: 7, padding: '5px 10px',
                  cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center'
                }}
              >
                <i className="bi bi-box-arrow-up-right"></i>
              </a>
            )}

            {/* Eliminar */}
            <button
              onClick={() => handleEliminar(v)}
              title="Eliminar vendedor"
              style={{
                background: 'rgba(230,57,70,0.08)', border: '1.5px solid rgba(230,57,70,0.3)',
                color: 'var(--jordyn-red)', borderRadius: 7, padding: '5px 10px',
                cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              <i className="bi bi-trash3-fill"></i>
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════
     RENDER PRINCIPAL
  ══════════════════════════════════════════════════ */
  return (
    <Layout title="VENDEDORES">

      {/* Header con resumen del pool */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">

        {/* Stats pool global */}
        <div className="d-flex gap-3 flex-wrap" style={{ fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-people-fill" style={{ color: 'var(--jordyn-primary)' }}></i>
            <span style={{ color: 'var(--jordyn-muted)' }}>
              {activos.length} activos · {inactivos.length} inactivos
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(10,191,188,0.08)', borderRadius: 8,
            padding: '4px 10px', border: '1px solid rgba(10,191,188,0.2)'
          }}>
            <i className="bi bi-grid-3x3-gap-fill" style={{ color: 'var(--jordyn-primary)', fontSize: '0.8rem' }}></i>
            <span style={{ fontWeight: 700, color: 'var(--jordyn-primary)' }}>{totalAsignadosPool}</span>
            <span style={{ color: 'var(--jordyn-muted)' }}>/ 1,000 números asignados</span>
            <span style={{ color: 'var(--jordyn-green)', fontWeight: 700, marginLeft: 4 }}>
              · {totalLibresPool} libres
            </span>
          </div>
        </div>

        <button className="btn-jordyn" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <i className="bi bi-person-plus-fill me-1"></i>NUEVO VENDEDOR
        </button>
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <div className="jd-card jd-card-primary mb-4 fade-in">
          <h5 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--jordyn-primary)', marginBottom: '1.25rem' }}>
            {editId ? '✏️ Editar vendedor' : '➕ Nuevo vendedor'}
          </h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-7">
                <label className="jd-label">NOMBRE COMPLETO *</label>
                <input className="jd-input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan Pérez" autoFocus />
              </div>
              {editId && (
                <div className="col-12 col-md-5">
                  <label className="jd-label">NUEVA CONTRASEÑA (vacío = no cambiar)</label>
                  <input className="jd-input" type="password" value={form.password || ''}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Mín. 6 caracteres" />
                </div>
              )}
              {!editId && (
                <div className="col-12">
                  <div className="jd-alert jd-alert-info" style={{ fontSize: '0.78rem', margin: 0 }}>
                    <i className="bi bi-info-circle-fill me-2"></i>
                    El usuario y contraseña se generarán automáticamente a partir del nombre.
                    Los verás en pantalla al crear el vendedor.
                  </div>
                </div>
              )}
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn-jordyn" disabled={saving}>
                {saving
                  ? 'Guardando...'
                  : <><i className="bi bi-floppy-fill me-1"></i>{editId ? 'Actualizar' : 'Crear'}</>
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

      {/* Lista de vendedores */}
      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: 4 }}>

          {vendedores.length === 0 && (
            <div className="jd-alert jd-alert-warning">
              <i className="bi bi-exclamation-triangle-fill"></i>
              Sin vendedores registrados
            </div>
          )}

          {activos.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.7rem', fontWeight: 700, color: 'var(--jordyn-muted)',
                textTransform: 'uppercase', letterSpacing: '0.8px',
                marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--jordyn-green)', display: 'inline-block' }}></span>
                Activos ({activos.length})
              </div>
              {activos.map(v => <VendedorRow key={v.id} v={v} />)}
            </div>
          )}

          {inactivos.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.7rem', fontWeight: 700, color: 'var(--jordyn-muted)',
                textTransform: 'uppercase', letterSpacing: '0.8px',
                marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc', display: 'inline-block' }}></span>
                Inactivos ({inactivos.length})
              </div>
              {inactivos.map(v => <VendedorRow key={v.id} v={v} />)}
            </div>
          )}
        </div>
      )}

      {/* Modal asignación de números globales */}
      {modalVend && (
        <ModalNumeros
          vendedor={modalVend}
          numerosOcupados={getNumerosOcupadosPorOtros(modalVend.id)}
          onClose={() => setModalVend(null)}
          onSaved={load}
        />
      )}

      {/* Modal confirmación de eliminación */}
      {confirmDelete && (
        <div
          onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10200,
            background: 'rgba(10,30,30,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
            boxShadow: '0 24px 64px rgba(0,0,0,.3)', overflow: 'hidden'
          }}>

            {/* Header del modal */}
            <div style={{
              background: confirmDelete.tieneVentas
                ? 'linear-gradient(135deg,#b37700,#f0a500)'
                : 'linear-gradient(135deg,#c0303a,#e63946)',
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,.2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0
              }}>
                {confirmDelete.tieneVentas ? '⚠️' : '🗑️'}
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
                  {confirmDelete.tieneVentas ? 'Vendedor con ventas activas' : 'Eliminar vendedor'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
                  {confirmDelete.nombre}
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {confirmDelete.tieneVentas ? (
                <>
                  <div style={{
                    background: '#fff8e1', border: '1.5px solid #ffd166',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                    fontSize: '0.82rem', color: '#7a5c00', lineHeight: 1.6
                  }}>
                    <strong>No es posible eliminar</strong> este vendedor porque tiene{' '}
                    <strong>{confirmDelete.vendedor?.total_ventas || 0} venta(s)</strong> registradas.
                    Eliminar un vendedor con historial rompería los registros contables.
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--jordyn-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Puedes <strong>desactivarlo</strong> para que no pueda iniciar sesión ni vender,
                    pero su historial se conserva.
                  </p>
                  {confirmDelete.errorVentas && (
                    <div style={{
                      background: '#fff0f0', border: '1px solid #ffaaaa',
                      borderRadius: 8, padding: '8px 12px', marginBottom: 14,
                      fontSize: '0.75rem', color: '#c0392b'
                    }}>
                      El servidor confirmó: no se puede eliminar con ventas asociadas.
                    </div>
                  )}
                  <div className="d-flex gap-2">
                    <button
                      className="btn-jordyn w-100"
                      onClick={confirmarDesactivar}
                      style={{ background: 'linear-gradient(135deg,#b37700,#f0a500)', fontSize: '0.88rem' }}
                    >
                      <i className="bi bi-pause-circle me-1"></i>Desactivar vendedor
                    </button>
                    <button
                      className="btn-jordyn-outline"
                      onClick={() => setConfirmDelete(null)}
                      style={{ fontSize: '0.88rem', flexShrink: 0, padding: '10px 16px' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.88rem', color: 'var(--jordyn-text)', marginBottom: 16, lineHeight: 1.7 }}>
                    ¿Estás seguro de que quieres{' '}
                    <strong style={{ color: 'var(--jordyn-red)' }}>eliminar definitivamente</strong>{' '}
                    al vendedor <strong>"{confirmDelete.nombre}"</strong>?
                  </p>
                  <div style={{
                    background: '#fff5f5', border: '1px solid #ffcccc',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                    fontSize: '0.78rem', color: '#c0392b', lineHeight: 1.5
                  }}>
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    Esta acción es <strong>irreversible</strong>. Se eliminarán también sus números
                    asignados y quedarán libres en el pool.
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn-jordyn-danger w-100"
                      onClick={confirmarEliminacion}
                      style={{ fontSize: '0.88rem' }}
                    >
                      <i className="bi bi-trash3-fill me-1"></i>Eliminar definitivamente
                    </button>
                    <button
                      className="btn-jordyn-outline"
                      onClick={() => setConfirmDelete(null)}
                      style={{ fontSize: '0.88rem', flexShrink: 0, padding: '10px 16px' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}