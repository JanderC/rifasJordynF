// ============================================================
//   ListaVendedores.js — RESUELVE TU SEMANA
//   Directorio de vendedores (solo consulta):
//   ✅ Datos de cada vendedor (usuario, cédula, estado, ventas)
//   ✅ Sus números fijos por categoría
//   ✅ Las rifas donde participa y los números que tiene en cada una
//   Los números se asignan en "Numeros Fijos" y al crear la rifa.
// ============================================================
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const fmtCOP = v =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const fmtFecha = (f) => {
  if (!f) return null;
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00-04:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
};

const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ["001","002","003","010"] → ["001-003", "010"]
function enRangos(nums) {
  const out = [];
  let ini = null, prev = null;
  for (const n of nums) {
    if (prev != null && Number(n) === Number(prev) + 1) { prev = n; continue; }
    if (ini != null) out.push(ini === prev ? ini : `${ini}-${prev}`);
    ini = prev = n;
  }
  if (ini != null) out.push(ini === prev ? ini : `${ini}-${prev}`);
  return out;
}

const COLOR_SERIE = { A: '#4361ee', B: '#e91e8c' };

/* Números de una categoría o rifa: en rangos, separados por serie si es simultánea */
function Numeros({ series, tipo }) {
  const claves = Object.keys(series || {}).sort();
  if (!claves.length) return <span style={{ fontSize:'.74rem', color:'var(--jordyn-muted)' }}>Sin números asignados</span>;
  const mostrarSerie = tipo === 'simultanea' || claves.length > 1;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {claves.map((s) => {
        const color = mostrarSerie ? (COLOR_SERIE[s] || 'var(--jordyn-primary)') : 'var(--jordyn-primary-d)';
        return (
          <div key={s} style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {mostrarSerie && (
              <span style={{ fontSize:'.62rem', fontWeight:800, color, minWidth:50 }}>Serie {s}</span>
            )}
            {enRangos(series[s]).map((r) => (
              <span key={r} style={{
                padding:'2px 9px', borderRadius:20, fontSize:'.74rem', fontWeight:700,
                background:'var(--jordyn-bg2)', border:'1px solid var(--jordyn-border2)', color,
              }}>{r}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const Titulo = ({ icono, children }) => (
  <div style={{ fontSize:'.62rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
    <i className={`bi ${icono} me-1`}></i>{children}
  </div>
);

function FichaVendedor({ v, abierto, onToggle }) {
  const rifasActivas = v.rifas.filter((r) => r.activa);
  return (
    <div className="jd-card fade-in" style={{ padding:0, overflow:'hidden', opacity: v.activo ? 1 : 0.7 }}>
      {/* Cabecera (clic para abrir) */}
      <button onClick={onToggle} aria-expanded={abierto} style={{
        width:'100%', border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
        padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      }}>
        <div style={{
          width:42, height:42, borderRadius:'50%', flexShrink:0,
          background:'rgba(10,191,188,0.12)', border:'2px solid rgba(10,191,188,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:800, fontSize:'1.05rem', color:'var(--jordyn-primary)',
        }}>{v.nombre?.charAt(0).toUpperCase()}</div>

        <div style={{ flex:'1 1 180px', minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:'.95rem', color:'var(--jordyn-text)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {v.nombre}
            {!v.activo && <span style={{ fontSize:'.58rem', fontWeight:800, padding:'2px 8px', borderRadius:20, background:'rgba(230,57,70,0.09)', color:'#c0303a' }}>INACTIVO</span>}
          </div>
          <div style={{ fontSize:'.7rem', color:'var(--jordyn-muted)', marginTop:1 }}>
            @{v.usuario}{v.cedula ? ` · C.I. ${v.cedula}` : ''}
          </div>
        </div>

        <div style={{ display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
          <Dato valor={v.total_numeros_fijos} etiqueta="Números fijos" color="var(--jordyn-primary)" />
          <Dato valor={rifasActivas.length} etiqueta={rifasActivas.length === 1 ? 'Rifa activa' : 'Rifas activas'} color="var(--jordyn-gold2)" />
          <Dato valor={v.total_ventas} etiqueta="Ventas" color="var(--jordyn-text)" />
          <i className={`bi bi-chevron-${abierto ? 'up' : 'down'}`} style={{ color:'var(--jordyn-muted)' }}></i>
        </div>
      </button>

      {abierto && (
        <div style={{ borderTop:'1px solid var(--jordyn-border)', padding:'16px', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Números fijos por categoría */}
          <div>
            <Titulo icono="bi-pin-angle-fill">Números fijos</Titulo>
            {v.numeros_fijos.length === 0 ? (
              <div style={{ fontSize:'.78rem', color:'var(--jordyn-muted)' }}>
                No tiene números fijos. Se asignan en <Link to="/vendedores" style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>Numeros Fijos</Link>.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {v.numeros_fijos.map((c) => (
                  <div key={c.categoria} style={{ background:'var(--jordyn-bg)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                      <span style={{ fontWeight:800, fontSize:'.84rem', color:'var(--jordyn-text)' }}>{c.categoria}</span>
                      <span style={{ fontSize:'.62rem', fontWeight:700, color:'var(--jordyn-muted)' }}>
                        {c.tipo === 'simultanea' ? 'Simultánea (A y B)' : 'Sencilla'} · {c.cantidad} número{c.cantidad === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Numeros series={c.series} tipo={c.tipo} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rifas donde participa */}
          <div>
            <Titulo icono="bi-trophy-fill">Rifas donde participa</Titulo>
            {v.rifas.length === 0 ? (
              <div style={{ fontSize:'.78rem', color:'var(--jordyn-muted)' }}>No participa en rifas activas ni en las sorteadas el último mes.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {v.rifas.map((r) => (
                  <div key={r.rifa_id} style={{
                    background:'var(--jordyn-bg)', border:'1px solid var(--jordyn-border)', borderRadius:10, padding:'10px 12px',
                    borderLeft:`3px solid ${r.activa ? 'var(--jordyn-green)' : 'var(--jordyn-border2)'}`,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                      <span style={{ fontWeight:800, fontSize:'.84rem', color:'var(--jordyn-text)' }}>{r.rifa}</span>
                      <span style={{
                        fontSize:'.58rem', fontWeight:800, padding:'2px 8px', borderRadius:20,
                        background: r.activa ? 'rgba(6,214,160,0.12)' : 'var(--jordyn-bg2)',
                        color: r.activa ? '#059669' : 'var(--jordyn-muted)',
                      }}>{r.activa ? 'EN VENTA' : 'YA SORTEADA'}</span>
                      <span style={{ fontSize:'.66rem', color:'var(--jordyn-muted)' }}>
                        {[fmtFecha(r.fecha_sorteo) && `Sorteo ${fmtFecha(r.fecha_sorteo)}`, r.categoria && `Categoría ${r.categoria}`].filter(Boolean).join(' · ')}
                      </span>
                      <span style={{ marginLeft:'auto', fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-text)' }}>
                        {r.cantidad} número{r.cantidad === 1 ? '' : 's'}{r.extras ? ` (${r.extras} extra)` : ''} · {r.vendidos} vendido{r.vendidos === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Numeros series={r.series} tipo={r.tipo} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen de ventas */}
          <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
            <span><i className="bi bi-cash-coin me-1"></i>Total vendido: <strong style={{ color:'var(--jordyn-text)' }}>{fmtCOP(v.total_ingresos)}</strong></span>
            <span><i className="bi bi-clock me-1"></i>Última venta: <strong style={{ color:'var(--jordyn-text)' }}>{v.ultima_venta ? fmtFecha(v.ultima_venta) : 'nunca'}</strong></span>
            <span><i className="bi bi-calendar-plus me-1"></i>Registrado: <strong style={{ color:'var(--jordyn-text)' }}>{fmtFecha(v.created_at) || '—'}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

const Dato = ({ valor, etiqueta, color }) => (
  <div style={{ textAlign:'center', minWidth:56 }}>
    <div style={{ fontWeight:900, fontSize:'1.05rem', color, lineHeight:1.1 }}>{valor}</div>
    <div style={{ fontSize:'.56rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'.5px' }}>{etiqueta}</div>
  </div>
);

export default function ListaVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busqueda,   setBusqueda]   = useState('');
  const [rifaSel,    setRifaSel]    = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [abiertos,   setAbiertos]   = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const res = await API.get('/vendedores/directorio');
      setVendedores(Array.isArray(res.data) ? res.data : []);
    } catch { toast.error('Error cargando los vendedores'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Rifas que aparecen en algún vendedor (para el filtro)
  const rifas = useMemo(() => {
    const m = new Map();
    vendedores.forEach((v) => v.rifas.forEach((r) => m.set(r.rifa_id, r)));
    return [...m.values()].sort((a, b) => Number(b.activa) - Number(a.activa) || String(b.fecha_sorteo || '').localeCompare(String(a.fecha_sorteo || '')));
  }, [vendedores]);

  // Busca por nombre, usuario, cédula o por un número que tenga (fijo o en una rifa)
  const filtrados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    const esNumero = /^\d+$/.test(q);
    return vendedores.filter((v) => {
      if (soloActivos && !v.activo) return false;
      if (rifaSel && !v.rifas.some((r) => r.rifa_id === rifaSel)) return false;
      if (!q) return true;
      if (sinTildes(`${v.nombre} ${v.usuario} ${v.cedula || ''}`).includes(q)) return true;
      if (!esNumero) return false;
      const tiene = (series) => Object.values(series).some((ns) => ns.some((n) => Number(n) === Number(q)));
      return v.numeros_fijos.some((c) => tiene(c.series)) || v.rifas.some((r) => tiene(r.series));
    });
  }, [vendedores, busqueda, rifaSel, soloActivos]);

  const toggle = (id) => setAbiertos((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const inactivos = vendedores.filter((v) => !v.activo).length;
  const todosAbiertos = filtrados.length > 0 && filtrados.every((v) => abiertos.has(v.id));

  return (
    <Layout title="VENDEDORES">

      <div style={{ marginBottom:20 }}>
        <p style={{ fontSize:'.82rem', color:'var(--jordyn-muted)', margin:0, lineHeight:1.6 }}>
          <i className="bi bi-info-circle me-1"></i>
          Lista de todos los vendedores con sus <strong>números fijos</strong> y las <strong>rifas donde participan</strong>.
          Es solo de consulta: los números se asignan en <Link to="/vendedores" style={{ color:'var(--jordyn-primary)', fontWeight:700 }}>Numeros Fijos</Link> y
          al crear la rifa. Esta misma información se la puedes preguntar al bot por WhatsApp.
        </p>
      </div>

      {/* Filtros */}
      <div className="jd-card" style={{ marginBottom:18 }}>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-5">
            <label className="jd-label">BUSCAR</label>
            <input className="jd-input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, usuario, cédula o un número (ej: 045)" />
          </div>
          <div className="col-12 col-md-4">
            <label className="jd-label">RIFA</label>
            <select className="jd-select" value={rifaSel} onChange={(e) => setRifaSel(e.target.value)}>
              <option value="">Todas las rifas</option>
              {rifas.map((r) => (
                <option key={r.rifa_id} value={r.rifa_id}>{r.rifa}{r.activa ? '' : ' (ya sorteada)'}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.8rem', fontWeight:600, cursor:'pointer', paddingBottom:10 }}>
              <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} style={{ width:18, height:18, accentColor:'var(--jordyn-primary)' }} />
              Solo activos{inactivos ? ` (${inactivos} inactivo${inactivos === 1 ? '' : 's'})` : ''}
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:12 }}>
            <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--jordyn-text)' }}>
              {filtrados.length} vendedor{filtrados.length === 1 ? '' : 'es'}
              {filtrados.length !== vendedores.length && (
                <span style={{ fontWeight:600, fontSize:'.74rem', color:'var(--jordyn-muted)', marginLeft:6 }}>de {vendedores.length}</span>
              )}
            </div>
            {filtrados.length > 0 && (
              <button className="btn-jordyn-outline" style={{ fontSize:'.74rem' }}
                onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(filtrados.map((v) => v.id)))}>
                <i className={`bi bi-arrows-${todosAbiertos ? 'collapse' : 'expand'} me-1`}></i>
                {todosAbiertos ? 'Cerrar todos' : 'Abrir todos'}
              </button>
            )}
          </div>

          {filtrados.length === 0 ? (
            <div className="jd-alert jd-alert-info">
              <i className="bi bi-people"></i>
              {vendedores.length === 0
                ? 'Todavía no hay vendedores. Se crean en Numeros Fijos.'
                : 'Ningún vendedor coincide con la búsqueda.'}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtrados.map((v) => (
                <FichaVendedor key={v.id} v={v} abierto={abiertos.has(v.id)} onToggle={() => toggle(v.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
