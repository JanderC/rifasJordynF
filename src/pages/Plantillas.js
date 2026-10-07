// ════════════════════════════════════════════════════════════════
//   pages/Plantillas.js
//   RIFAS JORDYN — Lista de plantillas de ticket
//
//   Funcionalidad:
//   - Listar todas las plantillas con miniatura previa
//   - Crear nueva plantilla (abre editor)
//   - Editar plantilla existente (abre editor)
//   - Duplicar plantilla
//   - Eliminar plantilla (excepto la default)
//   - Marcar como "default" (la que se usa si una rifa no elige otra)
// ════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { DEFAULT_DESIGN } from '../components/Ticket';
import TicketEditable from '../components/TicketEditable';

const DEMO_RIFA = {
  premio:            '500 Dólares',
  premio_secundario: 2000000,
  precio:            6000,
  fecha_sorteo:      '2026-05-18',
  hora_sorteo:       '22:10:00',
  loteria_ref:       'Triple Táchira "A"',
};

/* Miniatura del boleto: se dibuja con el MISMO componente del editor (en modo de solo
   lectura) y se encoge para que quepa. Antes usaba el dibujo del boleto antiguo, que
   pintaba su propio diseño encima del de la plantilla ("diseño sobre diseño"). */
function MiniaturaPlantilla({ design }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(0);
  const D = { ...DEFAULT_DESIGN, ...(design || {}) };
  const W = Number(D.ticketWidth) || 780;
  const H = Number(D.ticketHeight) || 340;
  useEffect(() => {
    if (!caja.current) return undefined;
    const medir = () => setAncho(caja.current?.clientWidth || 0);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, []);
  const ALTO_MAX = 170;
  const escala = ancho ? Math.min(ancho / W, ALTO_MAX / H) : 0;
  return (
    <div ref={caja} style={{ background:'#cfd4d0', borderRadius:8, overflow:'hidden', height: escala ? H * escala + 20 : ALTO_MAX, position:'relative' }}>
      {escala > 0 && (
        <div style={{ position:'absolute', top:10, left:'50%', width:W, height:H, marginLeft:-(W / 2),
          transform:`scale(${escala * 0.96})`, transformOrigin:'top center', pointerEvents:'none' }}>
          <TicketEditable r={DEMO_RIFA} numero="023" design={D} printMode={true} />
        </div>
      )}
    </div>
  );
}

export default function Plantillas() {
  const nav = useNavigate();
  const [plantillas, setPlantillas] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState(null); // id en proceso

  const cargar = () => {
    setLoading(true);
    API.get('/ticket-templates')
      .then(r => setPlantillas(r.data || []))
      .catch(() => toast.error('Error cargando plantillas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const handleNueva = () => nav('/plantillas/nueva');
  const handleEditar = (id) => nav(`/plantillas/${id}`);

  const handleDuplicar = async (p) => {
    if (busy) return;
    setBusy(p.id);
    try {
      const r = await API.post(`/ticket-templates/${p.id}/duplicate`);
      toast.success(`✅ Plantilla duplicada: ${r.data.nombre}`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error duplicando');
    } finally { setBusy(null); }
  };

  const handleEliminar = async (p) => {
    if (p.is_default) {
      toast.warning('No puedes eliminar la plantilla por defecto. Marca otra primero.');
      return;
    }
    if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"?\n\nLas rifas que la usen quedarán sin plantilla asignada.`)) return;
    if (busy) return;
    setBusy(p.id);
    try {
      await API.delete(`/ticket-templates/${p.id}`);
      toast.success('Plantilla eliminada');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando');
    } finally { setBusy(null); }
  };

  const handleHacerDefault = async (p) => {
    if (busy) return;
    setBusy(p.id);
    try {
      await API.post(`/ticket-templates/${p.id}/default`);
      toast.success(`"${p.nombre}" es ahora la plantilla por defecto`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally { setBusy(null); }
  };

  return (
    <Layout title="PLANTILLAS DE TICKET">

      {/* Barra superior */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div style={{ fontSize:'.85rem', color:'var(--jordyn-muted)' }}>
          <i className="bi bi-collection-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
          Crea distintos diseños de boletos y asígnalos a cada rifa.
          {' '}<b style={{ color:'var(--jordyn-text)' }}>{plantillas.length}</b> {plantillas.length === 1 ? 'plantilla' : 'plantillas'}.
        </div>
        <button className="btn-jordyn" onClick={handleNueva}>
          <i className="bi bi-plus-lg me-1"></i>Nueva plantilla
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5">
          <div className="jd-spinner" style={{ width:40, height:40 }}></div>
        </div>
      ) : plantillas.length === 0 ? (
        <div className="jd-card" style={{ padding:'40px 24px', textAlign:'center' }}>
          <i className="bi bi-collection" style={{ fontSize:'2.5rem', color:'var(--jordyn-muted)' }}></i>
          <p style={{ marginTop:14, color:'var(--jordyn-muted)' }}>
            No tienes plantillas todavía.
          </p>
          <button className="btn-jordyn" onClick={handleNueva}>
            <i className="bi bi-plus-lg me-1"></i>Crear la primera
          </button>
        </div>
      ) : (
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(420px, 1fr))',
          gap:18,
        }}>
          {plantillas.map(p => (
            <div key={p.id} className="jd-card" style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>

              {/* Cabecera */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <h3 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:'var(--jordyn-text)' }}>
                      {p.nombre}
                    </h3>
                    {p.is_default && (
                      <span style={{
                        fontSize:'.6rem', fontWeight:800,
                        background:'rgba(240,165,0,.18)', color:'var(--jordyn-gold, #f0a500)',
                        border:'1px solid rgba(240,165,0,.35)',
                        padding:'2px 8px', borderRadius:20, letterSpacing:.5,
                      }}>
                        <i className="bi bi-star-fill"></i> DEFAULT
                      </span>
                    )}
                  </div>
                  {p.descripcion && (
                    <div style={{ fontSize:'.72rem', color:'var(--jordyn-muted)', marginTop:3 }}>
                      {p.descripcion}
                    </div>
                  )}
                  <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)', marginTop:4, letterSpacing:.3 }}>
                    Actualizada: {new Date(p.updated_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                  </div>
                </div>
              </div>

              {/* Miniatura del ticket */}
              <MiniaturaPlantilla design={p.design} />

              {/* Acciones */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button className="btn-jordyn"
                  onClick={() => handleEditar(p.id)}
                  style={{ flex:1, fontSize:'.8rem', padding:'7px 10px', minWidth:90 }}>
                  <i className="bi bi-pencil-fill me-1"></i>Editar
                </button>
                <button className="btn-jordyn-outline"
                  onClick={() => handleDuplicar(p)}
                  disabled={busy === p.id}
                  style={{ fontSize:'.8rem', padding:'7px 10px' }}>
                  <i className="bi bi-files me-1"></i>Duplicar
                </button>
                {!p.is_default && (
                  <button className="btn-jordyn-outline"
                    onClick={() => handleHacerDefault(p)}
                    disabled={busy === p.id}
                    style={{ fontSize:'.8rem', padding:'7px 10px' }}
                    title="Marcar como default">
                    <i className="bi bi-star me-1"></i>Default
                  </button>
                )}
                <button className="btn-jordyn-outline"
                  onClick={() => handleEliminar(p)}
                  disabled={busy === p.id || p.is_default}
                  style={{
                    fontSize:'.8rem', padding:'7px 10px',
                    color: p.is_default ? '#666' : '#d92626',
                    borderColor: p.is_default ? undefined : 'rgba(217,38,38,.4)',
                  }}
                  title={p.is_default ? 'No se puede eliminar la default' : 'Eliminar'}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </Layout>
  );
}
