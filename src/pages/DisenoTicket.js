// ============================================================
//   DisenoTicket.js — Editor de Diseño de Ticket
//   RIFAS JORDYN
//   ✅ Guarda en BD via PUT /api/ticket-design
//   ✅ Sin localStorage
//   ✅ Vista previa en tiempo real
// ============================================================
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { TicketPreview, DEFAULT_DESIGN, useTicketDesign } from '../components/Ticket';

/* ── Rifa de demo para la preview ── */
const DEMO_RIFA = {
  rifa_nombre: 'RIFA DEMO',
  premio:      'iPhone 15 Pro Max',
  precio:      10000,
  fecha_sorteo:'2025-07-15T21:00:00',
  loteria_ref: 'Lotería del Táchira',
};
const DEMO_COMPRADOR = {
  nombre:   'María González',
  telefono: '+584141234567',
  cedula:   '12345678',
};

/* ── Campo de color con preview visual ── */
function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>
        {label}
      </label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width:38, height:38, padding:2, border:'1.5px solid var(--jordyn-border)', borderRadius:8, cursor:'pointer', background:'none' }}
        />
        <input
          className="jd-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex:1, fontFamily:'monospace', fontSize:'.85rem', fontWeight:600 }}
          maxLength={7}
        />
      </div>
    </div>
  );
}

/* ── Campo de texto ── */
function TextField({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>
        {label}
      </label>
      <input className="jd-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <div style={{ fontSize:'.64rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function DisenoTicket() {
  const { design: designBD, loading: loadingBD, reload } = useTicketDesign();
  const [design,  setDesign]  = useState(DEFAULT_DESIGN);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  // Cargar diseño de BD cuando esté listo
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
    setDesign(DEFAULT_DESIGN);
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

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:24, alignItems:'start' }}>

        {/* ── Panel de controles ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Cabecera panel */}
          <div className="jd-card jd-card-primary">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--jordyn-primary)' }}>
                  🎨 Editor de diseño
                </div>
                <div style={{ fontSize:'.7rem', color:'var(--jordyn-muted)', marginTop:2 }}>
                  Los cambios se guardan en la base de datos y aplican a todos los tickets.
                </div>
              </div>
              {dirty && (
                <span style={{ background:'rgba(240,165,0,.12)', border:'1px solid rgba(240,165,0,.3)', color:'var(--jordyn-gold)', borderRadius:20, padding:'2px 10px', fontSize:'.62rem', fontWeight:700, flexShrink:0 }}>
                  Sin guardar
                </span>
              )}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-jordyn" onClick={handleSave} disabled={saving || !dirty} style={{ flex:1, fontSize:'.88rem' }}>
                {saving
                  ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando...</>
                  : <><i className="bi bi-floppy-fill me-1"></i>Guardar diseño</>
                }
              </button>
              <button className="btn-jordyn-outline" onClick={handleReset} style={{ padding:'8px 12px' }} title="Restaurar defaults">
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </div>

          {/* Sección: Marca */}
          <div className="jd-card">
            <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
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
                label="Texto del pie de boleto"
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
                label="Hora del sorteo (opcional)"
                value={design.horaSort}
                onChange={v => upd('horaSort', v)}
                placeholder="10:00 PM"
                hint="Deja vacío para usar la hora del campo fecha_sorteo"
              />
            </div>
          </div>

          {/* Sección: Colores */}
          <div className="jd-card">
            <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
              <i className="bi bi-palette-fill me-1"></i>Colores
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ColorField label="Fondo del boleto" value={design.bgColor}      onChange={v => upd('bgColor', v)} />
              <ColorField label="Color acento"     value={design.accentColor}  onChange={v => upd('accentColor', v)} />
              <ColorField label="Acento secundario"value={design.accentColor2} onChange={v => upd('accentColor2', v)} />
              <ColorField label="Texto claro"      value={design.textLight}    onChange={v => upd('textLight', v)} />
              <ColorField label="Fondo del talón"  value={design.talonBg}      onChange={v => upd('talonBg', v)} />
            </div>

            {/* Paletas rápidas */}
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:'.62rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
                Paletas rápidas
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { name:'Dorado oscuro', bg:'#0f1923', ac:'#e8c84a', ac2:'#3ecfcb', txt:'#f5f5f0', tb:'#f8f7f2' },
                  { name:'Azul marino',   bg:'#0a0f1e', ac:'#4da6ff', ac2:'#ff6b9d', txt:'#f0f4ff', tb:'#f0f4ff' },
                  { name:'Esmeralda',     bg:'#071a10', ac:'#3ece8a', ac2:'#f5c518', txt:'#f0fff6', tb:'#f0fff6' },
                  { name:'Vino',          bg:'#1a0810', ac:'#e0427c', ac2:'#f5a623', txt:'#fff0f5', tb:'#fff0f5' },
                  { name:'Carbón',        bg:'#1a1a1a', ac:'#ffffff', ac2:'#aaaaaa', txt:'#ffffff', tb:'#f5f5f5' },
                ].map(p => (
                  <button
                    key={p.name}
                    onClick={() => {
                      upd('bgColor',      p.bg);
                      upd('accentColor',  p.ac);
                      upd('accentColor2', p.ac2);
                      upd('textLight',    p.txt);
                      upd('talonBg',      p.tb);
                    }}
                    title={p.name}
                    style={{
                      width:28, height:28, borderRadius:7, cursor:'pointer',
                      background:`linear-gradient(135deg,${p.bg} 50%,${p.ac} 50%)`,
                      border:'2px solid var(--jordyn-border)',
                      transition:'transform .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform='scale(1.15)'}
                    onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                  />
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Preview en tiempo real ── */}
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>
            <i className="bi bi-eye-fill me-1"></i>Vista previa en tiempo real
          </div>

          <div style={{ background:'#1a1a1a', borderRadius:14, padding:20, boxShadow:'inset 0 2px 12px rgba(0,0,0,.3)' }}>
            <TicketPreview
              r={DEMO_RIFA}
              numero="247"
              comprador={DEMO_COMPRADOR}
              vendedor="Admin"
              design={design}
            />
          </div>

          <div style={{ marginTop:12, background:'rgba(10,191,188,.06)', border:'1px solid rgba(10,191,188,.2)', borderRadius:10, padding:'10px 14px', fontSize:'.72rem', color:'var(--jordyn-muted)', lineHeight:1.6 }}>
            <i className="bi bi-info-circle me-1" style={{ color:'var(--jordyn-primary)' }}></i>
            El diseño guardado aplica a todos los boletos del sistema. Si una rifa tiene diseño propio configurado, ese tiene prioridad sobre este diseño global.
          </div>
        </div>

      </div>

      {/* Responsive: en móvil, preview abajo */}
      <style>{`
        @media (max-width: 900px) {
          .ticket-editor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

    </Layout>
  );
}