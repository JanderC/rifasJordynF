// ============================================================
//   DisenoTicket.js — Editor de Diseño de Ticket
//   RIFAS JORDYN
//   ✅ Usa clases del CSS real: jd-card, jd-input, btn-jordyn, etc.
//   ✅ Guarda en BD via PUT /api/ticket-design (sin localStorage)
//   ✅ Preview en tiempo real
// ============================================================
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, DEFAULT_DESIGN, useTicketDesign } from '../components/Ticket';

/* ── Rifa demo para preview ── */
const DEMO_RIFA = {
  rifa_nombre:  'RIFA DEMO',
  premio:       'iPhone 15 Pro Max',
  precio:       10000,
  fecha_sorteo: '2025-07-15T21:00:00',
  loteria_ref:  'Lotería del Táchira',
};
const DEMO_COMPRADOR = {
  nombre:   'María González',
  telefono: '+584141234567',
  cedula:   '12345678',
};

/* ── Sub-componentes de control ─────────────────────────── */
function ColorField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="jd-label">{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width:40, height:40, padding:3,
            border:'1.5px solid var(--jordyn-border)',
            borderRadius:8, cursor:'pointer', background:'none',
            flexShrink:0,
          }}
        />
        <input
          className="jd-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.88rem' }}
          maxLength={7}
        />
      </div>
      {hint && (
        <div style={{ fontSize:'.64rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>
      )}
    </div>
  );
}

function TextField({ label, hint, value, onChange, placeholder }) {
  return (
    <div>
      <label className="jd-label">{label}</label>
      <input
        className="jd-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && (
        <div style={{ fontSize:'.64rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PALETAS RÁPIDAS
───────────────────────────────────────────────────────── */
const PALETAS = [
  { name:'Jordyn (defecto)', ac:'#0abfbc', ac2:'#f0a500', bg:'#1a2e2e' },
  { name:'Dorado oscuro',    ac:'#f5c518', ac2:'#0abfbc', bg:'#0a0a0a' },
  { name:'Azul cobalto',     ac:'#118ab2', ac2:'#06d6a0', bg:'#0a1628' },
  { name:'Vino y oro',       ac:'#e63946', ac2:'#f0a500', bg:'#1a0810' },
  { name:'Verde bosque',     ac:'#06d6a0', ac2:'#ffd166', bg:'#071a10' },
  { name:'Morado real',      ac:'#9b5de5', ac2:'#f15bb5', bg:'#130a1e' },
];

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function DisenoTicket() {
  const { design: designBD, loading: loadingBD, reload } = useTicketDesign();
  const [design,  setDesign]  = useState(DEFAULT_DESIGN);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  useEffect(() => {
    if (!loadingBD) {
      setDesign(designBD);
      setDirty(false);
    }
  }, [loadingBD, designBD]);

  const upd = (key, val) => {
    setDesign(p => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const aplicarPaleta = (p) => {
    setDesign(prev => ({ ...prev, accentColor: p.ac, accentColor2: p.ac2, bgDark: p.bg }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/ticket-design', { design });
      toast.success('✅ Diseño guardado en la base de datos');
      setDirty(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando diseño');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (!window.confirm('¿Restaurar el diseño por defecto? Se perderán los cambios no guardados.')) return;
    setDesign({ ...DEFAULT_DESIGN });
    setDirty(true);
  };

  if (loadingBD) return (
    <Layout title="DISEÑO DEL TICKET">
      <div className="d-flex justify-content-center mt-5">
        <div className="jd-spinner" style={{ width:40, height:40 }}></div>
      </div>
    </Layout>
  );

  return (
    <Layout title="DISEÑO DEL TICKET">

      {/* ── Barra superior: estado + acciones ── */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div style={{ fontSize:'.8rem', color:'var(--jordyn-muted)' }}>
          <i className="bi bi-palette-fill me-1" style={{ color:'var(--jordyn-primary)' }}></i>
          El diseño se guarda en la base de datos y aplica a todos los boletos del sistema.
          {dirty && (
            <span style={{
              marginLeft:10,
              background:'rgba(240,165,0,.12)',
              border:'1px solid rgba(240,165,0,.3)',
              color:'var(--jordyn-gold)',
              borderRadius:20, padding:'1px 10px',
              fontSize:'.65rem', fontWeight:700,
            }}>
              ● Cambios sin guardar
            </span>
          )}
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn-jordyn-outline"
            onClick={handleReset}
            style={{ fontSize:'.82rem' }}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>Resetear
          </button>
          <button
            className="btn-jordyn"
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{ fontSize:'.88rem' }}
          >
            {saving
              ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando...</>
              : <><i className="bi bi-floppy-fill me-1"></i>Guardar diseño</>
            }
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:24, alignItems:'start' }}>

        {/* ════ PANEL CONTROLES ════ */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Sección: Marca */}
          <div className="jd-card jd-card-primary">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
              <i className="bi bi-type me-1"></i>Marca y textos
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <TextField
                label="Nombre de la marca"
                value={design.brandText}
                onChange={v => upd('brandText', v)}
                placeholder="RIFAS JORDYN"
              />
              <TextField
                label="Pie de página del boleto"
                value={design.footerText}
                onChange={v => upd('footerText', v)}
                placeholder="Conserve este boleto..."
              />
              <TextField
                label="Marca de agua"
                value={design.watermarkText}
                onChange={v => upd('watermarkText', v)}
                placeholder="JORDYN"
              />
              <TextField
                label="Hora del sorteo"
                value={design.horaSort}
                onChange={v => upd('horaSort', v)}
                placeholder="10:00 PM"
                hint="Vacío = usa la hora registrada en fecha_sorteo"
              />
            </div>
          </div>

          {/* Sección: Colores */}
          <div className="jd-card">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
              <i className="bi bi-palette-fill me-1"></i>Colores
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <ColorField
                label="Color principal (número, marca)"
                value={design.accentColor}
                onChange={v => upd('accentColor', v)}
              />
              <ColorField
                label="Color secundario (premio, serial)"
                value={design.accentColor2}
                onChange={v => upd('accentColor2', v)}
              />
              <ColorField
                label="Fondo del boleto"
                value={design.bgDark}
                onChange={v => upd('bgDark', v)}
                hint="Usa colores oscuros para mejor contraste"
              />
            </div>

            {/* Paletas rápidas */}
            <div style={{ marginTop:16 }}>
              <div className="jd-label" style={{ marginBottom:8 }}>Paletas rápidas</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {PALETAS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => aplicarPaleta(p)}
                    title={p.name}
                    style={{
                      width:32, height:32,
                      borderRadius:8,
                      cursor:'pointer',
                      background:`linear-gradient(135deg, ${p.bg} 50%, ${p.ac} 50%)`,
                      border:'2px solid var(--jordyn-border)',
                      transition:'transform .12s, box-shadow .12s',
                      flexShrink:0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform='scale(1.18)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
                  />
                ))}
              </div>
              <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:6 }}>
                Pasa el cursor para ver el nombre · Click para aplicar
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="jd-alert jd-alert-info">
            <i className="bi bi-info-circle-fill"></i>
            <span>
              Si una rifa tiene diseño propio configurado individualmente, ese tiene prioridad sobre este diseño global.
            </span>
          </div>

        </div>

        {/* ════ PREVIEW ════ */}
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>
            <i className="bi bi-eye-fill me-1"></i>Vista previa en tiempo real
          </div>

          {/* Fondo oscuro para que el ticket contraste */}
          <div style={{
            background:'#2a3a3a',
            borderRadius:14,
            padding:24,
            boxShadow:'inset 0 2px 12px rgba(0,0,0,.25)',
          }}>
            <TicketPreview
              r={DEMO_RIFA}
              numero="247"
              comprador={DEMO_COMPRADOR}
              vendedor="Admin"
              design={design}
            />
          </div>

          <div style={{ marginTop:10, fontSize:'.68rem', color:'var(--jordyn-muted)', textAlign:'center' }}>
            Vista de ejemplo con datos ficticios · El diseño real usará los datos reales del comprador
          </div>
        </div>

      </div>

      {/* Responsive: en mobile, preview va debajo */}
      <style>{`
        @media (max-width: 900px) {
          .ticket-editor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

    </Layout>
  );
}