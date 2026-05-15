// ════════════════════════════════════════════════════════════════
//   pages/DisenoTicket.js
//   RIFAS JORDYN — Editor de UNA plantilla de ticket
//
//   Llegada por URL:
//     /plantillas/nueva   → crear nueva plantilla
//     /plantillas/:id     → editar plantilla existente
//
//   Características:
//   - Layout 2 columnas: preview sticky a la izquierda (siempre visible)
//     + panel derecho con scroll independiente
//   - Edición in-place: click en "500", "Dólares", "GRAN RIFA", etc.
//     → input directo sobre el texto
//   - Acordeón de secciones para textos / colores / tamaños
//   - Paletas y tamaños rápidos preset
// ════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import { DEFAULT_DESIGN } from '../components/Ticket';
import TicketEditable from '../components/TicketEditable';

/* ═══════════════════════════════════════════════════════
   DATOS DEMO PARA PREVIEW
═══════════════════════════════════════════════════════ */
const DEMO_RIFA = {
  premio:            '500 Dólares',
  premio_secundario: 2000000,
  precio:            6000,
  fecha_sorteo:      '2026-05-18',
  hora_sorteo:       '22:10:00',
  loteria_ref:       'Triple Táchira "A"',
};

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTES DE CONTROL
═══════════════════════════════════════════════════════ */
function TextField({ label, hint, value, onChange, placeholder, multiline }) {
  const Comp = multiline ? 'textarea' : 'input';
  return (
    <div>
      <label className="jd-label">{label}</label>
      <Comp
        className="jd-input"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 2 : undefined}
        style={multiline ? { resize:'vertical', minHeight:48, fontFamily:'inherit' } : undefined}
      />
      {hint && <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function ColorField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="jd-label">{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="color" value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{
            width:38, height:38, padding:3,
            border:'1.5px solid var(--jordyn-border)',
            borderRadius:8, cursor:'pointer', background:'none', flexShrink:0,
          }} />
        <input className="jd-input" value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.85rem' }}
          maxLength={7} />
      </div>
      {hint && <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

/* SizeField estilo Word (en pt) */
const TAMANOS_WORD = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 42, 48, 54, 60, 72, 80, 96];

function SizeField({ label, hint, value, onChange, min=6, max=120, step=1 }) {
  const v = Number(value) || 0;
  const opciones = TAMANOS_WORD.filter(t => t >= min && t <= max);
  return (
    <div>
      <label className="jd-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>{label}</span>
        <span style={{
          fontSize:Math.min(28, Math.max(11, v * 0.7)),
          fontWeight:900, color:'var(--jordyn-primary)',
          lineHeight:1,
        }}>Aa</span>
      </label>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <button onClick={() => onChange(Math.max(min, v - step))} disabled={v <= min}
          style={ctrlBtn(v <= min)}>−</button>
        <select value={opciones.includes(v) ? v : ''}
          onChange={e => e.target.value && onChange(Number(e.target.value))}
          style={selectStyle}>
          <option value="" disabled>{v}pt</option>
          {opciones.map(t => <option key={t} value={t}>{t} pt</option>)}
        </select>
        <input type="number" value={v} min={min} max={max} step={step}
          onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          className="jd-input"
          style={{ width:52, textAlign:'center', fontFamily:'monospace', fontWeight:700, fontSize:'.9rem', padding:'6px 2px', height:32 }} />
        <button onClick={() => onChange(Math.min(max, v + step))} disabled={v >= max}
          style={ctrlBtn(v >= max)}>+</button>
      </div>
      <input type="range" value={v} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:'100%', marginTop:6, accentColor:'var(--jordyn-primary)' }} />
      {hint && <div style={{ fontSize:'.62rem', color:'var(--jordyn-muted)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}
const ctrlBtn = (disabled) => ({
  width:30, height:32, flexShrink:0,
  border:'1.5px solid var(--jordyn-border)', borderRadius:6,
  background:'rgba(10,191,188,.08)', color:'var(--jordyn-primary)',
  fontSize:'1.1rem', fontWeight:900,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? .35 : 1, padding:0, lineHeight:1,
});
const selectStyle = {
  height:32, padding:'0 4px',
  background:'#0d1a16',
  border:'1.5px solid var(--jordyn-border)',
  borderRadius:6, color:'var(--jordyn-primary)',
  fontWeight:700, fontSize:'.78rem', cursor:'pointer',
  fontFamily:'monospace',
};

/* Sección acordeón */
function Section({ title, icon, defaultOpen=false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="jd-card" style={{ padding:0, overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', padding:'12px 16px',
          background:'transparent', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          color:'var(--jordyn-primary)', textAlign:'left',
        }}>
        <span style={{
          fontSize:'.72rem', fontWeight:800,
          textTransform:'uppercase', letterSpacing:1,
          display:'flex', alignItems:'center', gap:8,
        }}>
          {icon && <i className={`bi ${icon}`}></i>}
          {title}
          {badge && (
            <span style={{
              fontSize:'.55rem', background:'rgba(10,191,188,.15)',
              border:'1px solid rgba(10,191,188,.3)', borderRadius:10,
              padding:'1px 7px',
            }}>{badge}</span>
          )}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'.85rem' }}></i>
      </button>
      {open && (
        <div style={{
          padding:'4px 16px 18px',
          display:'flex', flexDirection:'column', gap:12,
          borderTop:'1px solid var(--jordyn-border)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PALETAS
═══════════════════════════════════════════════════════ */
const PALETAS = [
  { name:'Tradicional', desc:'Boleto físico clásico', colors:{
    colorSlogan:'#d92626', colorFecha:'#1a3a8a', colorPremio1:'#f5c518', colorPremio2:'#1565d8',
    colorDolares:'#d92626', colorSubPremio:'#c41e7a', colorPesosSub:'#2e8b3e', colorBoleto:'#1565d8',
    colorValor:'#d92626', colorPesos:'#2e8b3e', colorMotivac:'#1a1a1a', colorTalon:'#1565d8',
    colorCaduca:'#1a1a1a', colorLoteria:'#1a1a1a', colorBorde:'#000000', bgPaper:'#f5f5f0',
  }},
  { name:'Venezolano', desc:'Amarillo, azul, rojo', colors:{
    colorSlogan:'#cf142b', colorFecha:'#003893', colorPremio1:'#fcd116', colorPremio2:'#003893',
    colorDolares:'#cf142b', colorSubPremio:'#cf142b', colorPesosSub:'#003893', colorBoleto:'#003893',
    colorValor:'#cf142b', colorPesos:'#fcd116', colorMotivac:'#000', colorTalon:'#003893',
    colorCaduca:'#000', colorLoteria:'#000', colorBorde:'#000', bgPaper:'#fffdf2',
  }},
  { name:'Colombiano', desc:'Amarillo, azul, rojo', colors:{
    colorSlogan:'#ce1126', colorFecha:'#003893', colorPremio1:'#fcd116', colorPremio2:'#003893',
    colorDolares:'#ce1126', colorSubPremio:'#ce1126', colorPesosSub:'#2e8b3e', colorBoleto:'#003893',
    colorValor:'#ce1126', colorPesos:'#2e8b3e', colorMotivac:'#000', colorTalon:'#003893',
    colorCaduca:'#000', colorLoteria:'#000', colorBorde:'#000', bgPaper:'#fffdf2',
  }},
  { name:'Sobrio elegante', desc:'Para impresión B/N', colors:{
    colorSlogan:'#5a1a1a', colorFecha:'#1a2a4a', colorPremio1:'#a0742a', colorPremio2:'#3a3a3a',
    colorDolares:'#5a1a1a', colorSubPremio:'#5a1a1a', colorPesosSub:'#2a4a2a', colorBoleto:'#1a2a4a',
    colorValor:'#5a1a1a', colorPesos:'#2a4a2a', colorMotivac:'#333', colorTalon:'#1a2a4a',
    colorCaduca:'#333', colorLoteria:'#333', colorBorde:'#1a1a1a', bgPaper:'#f8f5ee',
  }},
  { name:'Esmeralda', desc:'Verde y dorado', colors:{
    colorSlogan:'#0a7c3e', colorFecha:'#0a4d2e', colorPremio1:'#f0c419', colorPremio2:'#0a7c3e',
    colorDolares:'#c0392b', colorSubPremio:'#0a4d2e', colorPesosSub:'#c0392b', colorBoleto:'#0a7c3e',
    colorValor:'#c0392b', colorPesos:'#0a4d2e', colorMotivac:'#1a1a1a', colorTalon:'#0a7c3e',
    colorCaduca:'#1a1a1a', colorLoteria:'#1a1a1a', colorBorde:'#0a2a1a', bgPaper:'#f5f8f2',
  }},
];

const ESCALAS = [
  { label:'Pequeño', factor:0.75, fontSize:11 },
  { label:'Normal',  factor:1.00, fontSize:14 },
  { label:'Grande',  factor:1.20, fontSize:18 },
  { label:'X-Grande',factor:1.40, fontSize:22 },
];

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function DisenoTicket() {
  const { id }    = useParams();
  const nav       = useNavigate();
  const esNueva   = !id || id === 'nueva';

  const [loading, setLoading] = useState(!esNueva);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  const [nombre,       setNombre]      = useState('');
  const [descripcion,  setDescripcion] = useState('');
  const [isDefault,    setIsDefault]   = useState(false);
  const [design,       setDesign]      = useState(DEFAULT_DESIGN);

  // ── Cargar plantilla existente ─────────────────────────
  useEffect(() => {
    if (esNueva) {
      setNombre('Nueva plantilla');
      setDescripcion('');
      setIsDefault(false);
      setDesign({ ...DEFAULT_DESIGN });
      setDirty(false);
      return;
    }
    setLoading(true);
    API.get(`/ticket-templates/${id}`)
      .then(r => {
        setNombre(r.data.nombre || '');
        setDescripcion(r.data.descripcion || '');
        setIsDefault(!!r.data.is_default);
        setDesign({ ...DEFAULT_DESIGN, ...(r.data.design || {}) });
        setDirty(false);
      })
      .catch(() => {
        toast.error('Error cargando plantilla');
        nav('/plantillas');
      })
      .finally(() => setLoading(false));
  }, [id, esNueva, nav]);

  // ── Helpers ────────────────────────────────────────────
  const upd = (k, v) => { setDesign(p => ({ ...p, [k]:v })); setDirty(true); };

  const aplicarPaleta = (p) => {
    setDesign(prev => ({ ...prev, ...p.colors }));
    setDirty(true);
    toast.info(`Paleta: ${p.name}`);
  };

  const aplicarTamanos = (factor, nombre) => {
    const R = (n) => Math.max(6, Math.round(n));
    const escalado = {
      sizeBrand:R(22*factor),       sizeNumTalon:R(20*factor),     sizeNumDer:R(20*factor),
      sizeNombre:R(10*factor),      sizeTalonText:R(8*factor),     sizeSlogan:R(18*factor),
      sizeFecha:R(16*factor),       sizePremioLabel:R(18*factor),  sizePremioNum:R(78*factor),
      sizePremioTxt:R(26*factor),   sizeSubPremio:R(24*factor),    sizeSubMoneda:R(20*factor),
      sizeCaduca:R(11*factor),      sizeLoteria:R(11*factor),      sizeMotivac:R(11*factor),
      sizeBoleto:R(20*factor),      sizeValor:R(32*factor),        sizePesos:R(16*factor),
      sizeFooter:R(7*factor),
    };
    setDesign(prev => ({ ...prev, ...escalado }));
    setDirty(true);
    toast.info(`Tamaños: ${nombre}`);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) { toast.warning('Pon un nombre a la plantilla'); return; }
    setSaving(true);
    try {
      const payload = { nombre: nombre.trim(), descripcion: descripcion || null, design, is_default: isDefault };
      if (esNueva) {
        const r = await API.post('/ticket-templates', payload);
        toast.success(`✅ Plantilla "${r.data.nombre}" creada`);
        nav(`/plantillas/${r.data.id}`, { replace:true });
      } else {
        await API.put(`/ticket-templates/${id}`, payload);
        toast.success('✅ Plantilla guardada');
        setDirty(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (!window.confirm('¿Restaurar el diseño por defecto? Los cambios sin guardar se perderán.')) return;
    setDesign({ ...DEFAULT_DESIGN });
    setDirty(true);
  };

  const handleVolver = () => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Volver a la lista de plantillas?')) return;
    nav('/plantillas');
  };

  // ── Handlers de edición in-place desde el preview ──────
  const updateDesignField = (campo, valor) => upd(campo, valor);

  if (loading) return (
    <Layout title="EDITAR PLANTILLA">
      <div className="d-flex justify-content-center mt-5">
        <div className="jd-spinner" style={{ width:40, height:40 }}></div>
      </div>
    </Layout>
  );

  return (
    <Layout title={esNueva ? 'NUEVA PLANTILLA' : `EDITAR: ${nombre}`}>

      {/* ════ Barra superior ════ */}
      <div className="mb-3" style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        flexWrap:'wrap', gap:10,
      }}>
        <button className="btn-jordyn-outline" onClick={handleVolver} style={{ fontSize:'.82rem' }}>
          <i className="bi bi-arrow-left me-1"></i>Volver a plantillas
        </button>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {dirty && (
            <span style={{
              background:'rgba(240,165,0,.12)',
              border:'1px solid rgba(240,165,0,.3)',
              color:'var(--jordyn-gold)', borderRadius:20, padding:'4px 12px',
              fontSize:'.7rem', fontWeight:700,
              display:'flex', alignItems:'center',
            }}>● Sin guardar</span>
          )}
          <button className="btn-jordyn-outline" onClick={handleReset} style={{ fontSize:'.82rem' }}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>Resetear
          </button>
          <button className="btn-jordyn" onClick={handleGuardar}
            disabled={saving} style={{ fontSize:'.88rem', minWidth:130 }}>
            {saving
              ? <><span className="jd-spinner" style={{ width:14, height:14, borderWidth:2 }}></span> Guardando…</>
              : <><i className="bi bi-floppy-fill me-1"></i>{esNueva ? 'Crear plantilla' : 'Guardar'}</>
            }
          </button>
        </div>
      </div>

      {/* ════ Datos de la plantilla ════ */}
      <div className="jd-card mb-3" style={{ padding:'14px 18px' }}>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="jd-label">NOMBRE DE LA PLANTILLA *</label>
            <input className="jd-input" value={nombre}
              onChange={e => { setNombre(e.target.value); setDirty(true); }}
              placeholder="Ej: Boleto Triple Táchira" />
          </div>
          <div className="col-12 col-md-6">
            <label className="jd-label">DESCRIPCIÓN (opcional)</label>
            <input className="jd-input" value={descripcion}
              onChange={e => { setDescripcion(e.target.value); setDirty(true); }}
              placeholder="Para qué la usas..." />
          </div>
          <div className="col-12">
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'.85rem', color:'var(--jordyn-text)' }}>
              <input type="checkbox" checked={isDefault}
                onChange={e => { setIsDefault(e.target.checked); setDirty(true); }}
                style={{ width:18, height:18 }} />
              <i className="bi bi-star-fill" style={{ color:'var(--jordyn-gold)' }}></i>
              <span><b>Plantilla por defecto</b> — se usa cuando una rifa no elige otra</span>
            </label>
          </div>
        </div>
      </div>

      {/* ════ Grid 2 columnas: preview sticky + panel scroll ════ */}
      <div className="diseno-ticket-grid">

        {/* ═══ Columna izquierda: PREVIEW STICKY (siempre visible) ═══ */}
        <div className="diseno-ticket-preview">
          <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
            <i className="bi bi-eye-fill me-1"></i>Vista previa — click en cualquier texto para editarlo
          </div>

          <div style={{
            background:'#cfd4d0', borderRadius:14, padding:14,
            boxShadow:'inset 0 2px 12px rgba(0,0,0,.15)',
            overflow:'auto', maxWidth:'100%',
          }}>
            <TicketEditable
              r={DEMO_RIFA}
              numero="023"
              design={design}
              onUpdate={updateDesignField}
            />
          </div>

          <div style={{ marginTop:8, fontSize:'.65rem', color:'var(--jordyn-muted)', textAlign:'center', fontStyle:'italic' }}>
            💡 Los textos se editan directo. Los datos (premio, fecha, valor) los pone la rifa al imprimir.
          </div>
        </div>

        {/* ═══ Columna derecha: PANEL CON SCROLL PROPIO ═══ */}
        <div className="diseno-ticket-panel">

          {/* Paletas rápidas */}
          <div className="jd-card jd-card-primary">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
              <i className="bi bi-magic me-1"></i>Paletas de colores
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {PALETAS.map(p => (
                <button key={p.name} onClick={() => aplicarPaleta(p)}
                  style={paletaBtn}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(10,191,188,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{
                    width:38, height:24, borderRadius:4, flexShrink:0,
                    background:`linear-gradient(90deg,${p.colors.colorPremio1} 0%,${p.colors.colorPremio1} 33%,${p.colors.colorPremio2} 33%,${p.colors.colorPremio2} 66%,${p.colors.colorDolares} 66%)`,
                    border:`1px solid ${p.colors.colorBorde}`,
                  }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.78rem', fontWeight:700 }}>{p.name}</div>
                    <div style={{ fontSize:'.6rem', color:'var(--jordyn-muted)' }}>{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tamaños rápidos */}
          <div className="jd-card jd-card-primary">
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--jordyn-primary)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
              <i className="bi bi-fonts me-1"></i>Tamaños globales
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {ESCALAS.map(p => (
                <button key={p.label} onClick={() => aplicarTamanos(p.factor, p.label)}
                  style={escalaBtn}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(10,191,188,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize:p.fontSize, fontWeight:900, color:'var(--jordyn-primary)', lineHeight:1 }}>A</span>
                  <span style={{ fontSize:'.75rem', fontWeight:700 }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Secciones de TEXTOS */}
          <Section title="Marca y slogan" icon="bi-tag-fill" badge="6" defaultOpen>
            <TextField label='"GRAN RIFA" (vertical)' value={design.brandText} onChange={v => upd('brandText', v)} />
            <TextField label='Slogan superior (rojo)' value={design.sloganTop} onChange={v => upd('sloganTop', v)} />
            <TextField label='Prefijo de fecha' value={design.fechaPrefix} onChange={v => upd('fechaPrefix', v)} placeholder="Juega El" />
            <TextField label='Texto del talón vertical' value={design.talonText} onChange={v => upd('talonText', v)} />
            <TextField label='Marca de agua' value={design.watermarkText} onChange={v => upd('watermarkText', v)} />
            <TextField label='Pie de página pequeño' value={design.footerText} onChange={v => upd('footerText', v)} />
          </Section>

          <Section title="Premio principal" icon="bi-trophy-fill" badge="2">
            <TextField label='Etiqueta "Premio"' value={design.premioLabel} onChange={v => upd('premioLabel', v)} />
            <TextField label='Hora del sorteo (override)' value={design.horaSort} onChange={v => upd('horaSort', v)} placeholder="10:10 PM" hint='Vacío = usa hora_sorteo de la rifa' />
          </Section>

          <Section title="Sub-premio en pesos" icon="bi-cash-stack" badge="2">
            <TextField label='Prefijo' value={design.subPremioPrefix} onChange={v => upd('subPremioPrefix', v)} placeholder="ó" />
            <TextField label='Moneda' value={design.subPremioMoneda} onChange={v => upd('subPremioMoneda', v)} placeholder="Pesos" />
          </Section>

          <Section title="Caducidad y lotería" icon="bi-clock-history" badge="2">
            <TextField label='Texto de caducidad' value={design.caducaText} onChange={v => upd('caducaText', v)} />
            <TextField label='Lotería por defecto' value={design.loteriaText} onChange={v => upd('loteriaText', v)} hint='La rifa puede sobrescribir esto' />
          </Section>

          <Section title="Etiqueta del valor" icon="bi-ticket-perforated-fill" badge="2">
            <TextField label='Etiqueta "BOLETO"' value={design.boletoLabel} onChange={v => upd('boletoLabel', v)} />
            <TextField label='Sufijo del valor' value={design.valorSufijo} onChange={v => upd('valorSufijo', v)} placeholder="PESOS" />
          </Section>

          <Section title="Frase motivacional" icon="bi-chat-quote-fill" badge="1">
            <TextField label='Texto' value={design.motivacionalText} onChange={v => upd('motivacionalText', v)} multiline />
          </Section>

          {/* Secciones de COLORES */}
          <Section title="Colores: textos y premio" icon="bi-palette-fill" badge="8 colores">
            <ColorField label='Slogan superior'  value={design.colorSlogan}     onChange={v => upd('colorSlogan', v)} />
            <ColorField label='Fecha del sorteo' value={design.colorFecha}      onChange={v => upd('colorFecha', v)} />
            <ColorField label='Premio - color arriba' value={design.colorPremio1} onChange={v => upd('colorPremio1', v)} />
            <ColorField label='Premio - color abajo'  value={design.colorPremio2} onChange={v => upd('colorPremio2', v)} />
            <ColorField label='Texto del premio' value={design.colorDolares}    onChange={v => upd('colorDolares', v)} />
            <ColorField label='Sub-premio número'  value={design.colorSubPremio} onChange={v => upd('colorSubPremio', v)} />
            <ColorField label='Sub-premio "Pesos"' value={design.colorPesosSub}  onChange={v => upd('colorPesosSub', v)} />
            <ColorField label='Frase motivacional' value={design.colorMotivac}   onChange={v => upd('colorMotivac', v)} />
          </Section>

          <Section title="Colores: valor y otros" icon="bi-palette" badge="8 colores">
            <ColorField label='"BOLETO"' value={design.colorBoleto} onChange={v => upd('colorBoleto', v)} />
            <ColorField label='Valor del boleto' value={design.colorValor} onChange={v => upd('colorValor', v)} />
            <ColorField label='Sufijo "PESOS"'   value={design.colorPesos} onChange={v => upd('colorPesos', v)} />
            <ColorField label='Talón + "GRAN RIFA"' value={design.colorTalon} onChange={v => upd('colorTalon', v)} />
            <ColorField label='"Caduca"' value={design.colorCaduca} onChange={v => upd('colorCaduca', v)} />
            <ColorField label='Lotería' value={design.colorLoteria} onChange={v => upd('colorLoteria', v)} />
            <ColorField label='Borde del boleto' value={design.colorBorde} onChange={v => upd('colorBorde', v)} />
            <ColorField label='Fondo (papel)' value={design.bgPaper} onChange={v => upd('bgPaper', v)} />
          </Section>

          {/* Secciones de TAMAÑOS (pt como Word) */}
          <Section title="Tamaños: premio y números" icon="bi-arrows-fullscreen" badge="6 pt">
            <SizeField label='Número GIGANTE del premio' value={design.sizePremioNum} onChange={v => upd('sizePremioNum', v)} min={24} max={120} hint='default 78pt' />
            <SizeField label='Palabra "Premio"' value={design.sizePremioLabel} onChange={v => upd('sizePremioLabel', v)} min={8} max={48} />
            <SizeField label='Texto del premio ("Dólares")' value={design.sizePremioTxt} onChange={v => upd('sizePremioTxt', v)} min={10} max={60} />
            <SizeField label='Sub-premio número' value={design.sizeSubPremio} onChange={v => upd('sizeSubPremio', v)} min={8} max={48} />
            <SizeField label='Sub-premio "Pesos"' value={design.sizeSubMoneda} onChange={v => upd('sizeSubMoneda', v)} min={8} max={42} />
            <SizeField label='Valor del boleto' value={design.sizeValor} onChange={v => upd('sizeValor', v)} min={10} max={60} />
          </Section>

          <Section title="Tamaños: encabezado y talón" icon="bi-fonts" badge="7 pt">
            <SizeField label='Slogan rojo' value={design.sizeSlogan} onChange={v => upd('sizeSlogan', v)} min={8} max={42} />
            <SizeField label='Fecha' value={design.sizeFecha} onChange={v => upd('sizeFecha', v)} min={8} max={36} />
            <SizeField label='"GRAN RIFA"' value={design.sizeBrand} onChange={v => upd('sizeBrand', v)} min={10} max={54} />
            <SizeField label='Número del talón izq' value={design.sizeNumTalon} onChange={v => upd('sizeNumTalon', v)} min={10} max={48} />
            <SizeField label='Número derecho' value={design.sizeNumDer} onChange={v => upd('sizeNumDer', v)} min={10} max={48} />
            <SizeField label='"NOMBRE:"' value={design.sizeNombre} onChange={v => upd('sizeNombre', v)} min={6} max={22} />
            <SizeField label='Texto vertical del talón' value={design.sizeTalonText} onChange={v => upd('sizeTalonText', v)} min={6} max={16} />
          </Section>

          <Section title="Tamaños: pie y secundarios" icon="bi-text-paragraph" badge="6 pt">
            <SizeField label='"BOLETO"' value={design.sizeBoleto} onChange={v => upd('sizeBoleto', v)} min={8} max={42} />
            <SizeField label='Sufijo "PESOS"' value={design.sizePesos} onChange={v => upd('sizePesos', v)} min={6} max={30} />
            <SizeField label='"Caduca"' value={design.sizeCaduca} onChange={v => upd('sizeCaduca', v)} min={6} max={24} />
            <SizeField label='Lotería' value={design.sizeLoteria} onChange={v => upd('sizeLoteria', v)} min={6} max={24} />
            <SizeField label='Frase motivacional' value={design.sizeMotivac} onChange={v => upd('sizeMotivac', v)} min={6} max={24} />
            <SizeField label='Pie de página' value={design.sizeFooter} onChange={v => upd('sizeFooter', v)} min={5} max={14} />
          </Section>

          <Section title="Dimensiones del boleto" icon="bi-aspect-ratio" badge="2 px">
            <SizeField label='Ancho del ticket (px)' value={design.ticketWidth} onChange={v => upd('ticketWidth', v)} min={500} max={1200} step={10} />
            <SizeField label='Alto mínimo (px)' value={design.ticketHeight} onChange={v => upd('ticketHeight', v)} min={200} max={600} step={10} />
          </Section>

        </div>
      </div>

      {/* ════ Estilos del layout responsive ════ */}
      <style>{`
        .diseno-ticket-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 20px;
          align-items: start;
        }

        /* Preview pegado arriba (sticky) — siempre visible mientras se hace
           scroll en el panel derecho                                       */
        .diseno-ticket-preview {
          position: sticky;
          top: 76px;
          align-self: start;
          min-width: 0;
        }

        /* Panel derecho con scroll propio independiente del preview        */
        .diseno-ticket-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: calc(100vh - 96px);
          overflow-y: auto;
          padding-right: 6px;
        }
        .diseno-ticket-panel::-webkit-scrollbar { width: 8px; }
        .diseno-ticket-panel::-webkit-scrollbar-thumb {
          background: var(--jordyn-border);
          border-radius: 4px;
        }
        .diseno-ticket-panel::-webkit-scrollbar-thumb:hover {
          background: var(--jordyn-primary);
        }

        /* En tablet/mobile: una sola columna, preview ARRIBA pegado, panel abajo */
        @media (max-width: 1100px) {
          .diseno-ticket-grid { grid-template-columns: 1fr; }
          .diseno-ticket-preview {
            position: sticky;
            top: 0;
            z-index: 10;
            background: var(--jordyn-bg, #0a1614);
            padding: 8px 0;
            margin: -8px -4px 0;
            border-bottom: 1px solid var(--jordyn-border);
          }
          .diseno-ticket-panel {
            max-height: none;
            overflow-y: visible;
          }
        }
      `}</style>

    </Layout>
  );
}

const paletaBtn = {
  display:'flex', alignItems:'center', gap:10,
  padding:'7px 10px', background:'transparent',
  border:'1px solid var(--jordyn-border)', borderRadius:8,
  cursor:'pointer', textAlign:'left',
  color:'var(--jordyn-text, #d4eeee)',
  transition:'background .15s',
};
const escalaBtn = {
  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
  padding:'8px 10px', background:'transparent',
  border:'1px solid var(--jordyn-border)', borderRadius:8,
  cursor:'pointer', color:'var(--jordyn-text, #d4eeee)',
  transition:'background .15s',
};
