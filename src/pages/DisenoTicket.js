import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import {
  TicketPreview,
  buildTicketHTMLCustom,
  DEFAULT_DESIGN,
  TICKET_DESIGN_KEY,
  getTicketDesign,
} from '../components/Ticket';

export default function DisenoTicket() {
  const [design,  setDesign]  = useState(getTicketDesign);
  const [rifas,   setRifas]   = useState([]);
  const [rifaSel, setRifaSel] = useState(null);
  const [saved,   setSaved]   = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    API.get('/rifas').then(r => {
      const activas = r.data.filter(x => x.activa);
      setRifas(activas);
      if (activas.length > 0) setRifaSel(activas[0]);
    }).catch(() => {});
  }, []);

  const upd = (k, v) => setDesign(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    localStorage.setItem(TICKET_DESIGN_KEY, JSON.stringify(design));
    setSaved(true);
    toast.success('Diseno guardado - activo en todos los boletos');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setDesign({ ...DEFAULT_DESIGN });
    localStorage.removeItem(TICKET_DESIGN_KEY);
    toast.info('Diseno restablecido al original');
  };

  const handleImagen = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('La imagen debe ser menor a 3 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => upd('premioImagen', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePrintTest = () => {
    const r = rifaSel || { rifa_nombre:'DEMO', premio:'Premio Ejemplo', precio:50000, fecha_sorteo:null, loteria_ref:'' };
    const FONTS = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@300;400;600;700&family=Share+Tech+Mono&display=swap');";
    const html = [1,2].map(c => buildTicketHTMLCustom(design, r, '123', { nombre:'Juan Perez', telefono:'300 123 4567' }, 'Maria Garcia', c)).join('\n');
    const win = window.open('','_blank','width=480,height=920');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vista Previa</title><style>${FONTS}*{box-sizing:border-box;margin:0;padding:0;}body{background:#1a1a1a;display:flex;flex-direction:column;align-items:center;gap:22px;padding:22px;}@media print{body{background:#fff;padding:6px;gap:10px;}}</style></head><body>${html}<script>window.onload=()=>{setTimeout(()=>{window.print();},400);};<\/script></body></html>`);
    win.document.close();
  };

  const Section = ({ icon, title, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'.82rem', letterSpacing:'3px', color:'#555', borderBottom:'1px solid #1e1e1e', paddingBottom:6, marginBottom:11, display:'flex', alignItems:'center', gap:6 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, children }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:10 }}>
      <label style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem', color:'#888', letterSpacing:'1px', flexShrink:0, minWidth:110 }}>{label}</label>
      <div style={{ display:'flex', justifyContent:'flex-end', flex:1 }}>{children}</div>
    </div>
  );

  const ColorPick = ({ val, onChange }) => (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <input type="color" value={val} onChange={e => onChange(e.target.value)} style={{ width:32, height:28, border:'1px solid #333', borderRadius:4, padding:2, background:'none', cursor:'pointer' }} />
      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#666' }}>{val}</span>
    </div>
  );

  const Toggle = ({ val, onChange }) => (
    <button onClick={() => onChange(!val)} style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: val ? '#f5c518' : '#2a2a2a', position:'relative', transition:'background .2s', flexShrink:0 }}>
      <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: val ? 23 : 3, transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.4)' }}></div>
    </button>
  );

  const Sel = ({ val, onChange, opts }) => (
    <select className="jd-select" value={val} onChange={e => onChange(e.target.value)} style={{ maxWidth:160, fontSize:'.8rem', padding:'.3rem .6rem' }}>
      {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  const rifaDemo = rifaSel || { rifa_nombre:'RIFA DEMO', premio:'Premio Espectacular', precio:50000, fecha_sorteo:null, loteria_ref:'' };

  return (
    <Layout title="DISENO DE BOLETO">

      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem', color:'#444', flex:1, minWidth:200 }}>
          <i className="bi bi-eye me-1"></i>Vista previa incluye boleto + talon — lo que ves es lo que se imprime
        </div>
        <button className="btn-jordyn-outline" onClick={handlePrintTest} style={{ fontSize:'.82rem', padding:'6px 14px' }}>
          <i className="bi bi-printer me-1"></i>PROBAR IMPRESION
        </button>
        <button onClick={handleReset} style={{ background:'transparent', border:'1px solid #e63946', color:'#e63946', borderRadius:5, padding:'6px 14px', cursor:'pointer', fontFamily:"'Bebas Neue',cursive", fontSize:'.8rem', letterSpacing:'1px' }}>
          <i className="bi bi-arrow-counterclockwise me-1"></i>RESETEAR
        </button>
        <button className="btn-jordyn" onClick={handleSave} style={{ fontSize:'.9rem', padding:'6px 20px' }}>
          <i className={`bi ${saved ? 'bi-check2-circle' : 'bi-floppy'} me-1`}></i>
          {saved ? 'GUARDADO!' : 'GUARDAR DISENO'}
        </button>
      </div>

      <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>

        {/* PANEL CONTROLES */}
        <div style={{ flex:'1 1 270px', maxWidth:350, background:'#111', border:'1px solid #1e1e1e', borderRadius:10, padding:20, maxHeight:'82vh', overflowY:'auto' }}>

          <Section icon="🖼" title="IMAGEN DEL PREMIO">
            <div onClick={() => imgRef.current?.click()} style={{ border:`2px dashed ${design.premioImagen ? '#f5c518' : '#2a2a2a'}`, borderRadius:8, padding:14, textAlign:'center', cursor:'pointer', marginBottom:10, background: design.premioImagen ? 'rgba(245,197,24,.04)' : 'transparent' }}>
              {design.premioImagen ? (
                <div>
                  <img src={design.premioImagen} alt="Premio" style={{ maxWidth:'100%', maxHeight:110, objectFit:'contain', borderRadius:6, marginBottom:6 }} />
                  <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color:'#f5c518' }}>Click para cambiar</div>
                </div>
              ) : (
                <>
                  <i className="bi bi-image" style={{ fontSize:'2.2rem', color:'#333', display:'block', marginBottom:6 }}></i>
                  <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem', color:'#555' }}>Click para subir imagen del premio</div>
                  <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.54rem', color:'#444', marginTop:3 }}>JPG · PNG · WEBP · max 3 MB</div>
                </>
              )}
              <input ref={imgRef} type="file" accept="image/*" onChange={handleImagen} style={{ display:'none' }} />
            </div>
            {design.premioImagen && (
              <>
                <Row label="Posicion"><Sel val={design.premioImagenPos} onChange={v=>upd('premioImagenPos',v)} opts={[['hero','Sobre el numero'],['info','Zona de info'],['none','Ocultar']]} /></Row>
                <Row label="Ajuste"><Sel val={design.premioImagenFit} onChange={v=>upd('premioImagenFit',v)} opts={[['cover','Cubrir'],['contain','Contener']]} /></Row>
                <button onClick={()=>upd('premioImagen','')} style={{ width:'100%', background:'transparent', border:'1px solid #333', color:'#e63946', borderRadius:4, padding:'5px', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'.6rem' }}>Quitar imagen</button>
              </>
            )}
          </Section>

          <Section icon="🏷" title="MARCA Y ENCABEZADO">
            <Row label="Emoji"><input className="jd-input" value={design.brandEmoji} onChange={e=>upd('brandEmoji',e.target.value)} style={{ maxWidth:65, textAlign:'center', fontSize:'1.1rem' }} maxLength={4} /></Row>
            <Row label="Nombre marca"><input className="jd-input" value={design.brandText} onChange={e=>upd('brandText',e.target.value)} style={{ maxWidth:185, fontSize:'.8rem' }} /></Row>
            <Row label="Color acento"><ColorPick val={design.accentColor} onChange={v=>upd('accentColor',v)} /></Row>
            <Row label="Fondo 1"><ColorPick val={design.headerBg} onChange={v=>upd('headerBg',v)} /></Row>
            <Row label="Fondo 2"><ColorPick val={design.headerBg2} onChange={v=>upd('headerBg2',v)} /></Row>
            <Row label="Mostrar rifa"><Toggle val={design.showSubrifa} onChange={v=>upd('showSubrifa',v)} /></Row>
          </Section>

          <Section icon="🔢" title="ZONA DEL NUMERO">
            <Row label="Color numero"><ColorPick val={design.numColor} onChange={v=>upd('numColor',v)} /></Row>
            <Row label="Fondo hero 1"><ColorPick val={design.heroBg} onChange={v=>upd('heroBg',v)} /></Row>
            <Row label="Fondo hero 2"><ColorPick val={design.heroBg2} onChange={v=>upd('heroBg2',v)} /></Row>
            <Row label="Tamano"><Sel val={design.numSize} onChange={v=>upd('numSize',v)} opts={[['4rem','Pequeno'],['5rem','Normal'],['6rem','Grande'],['7rem','Enorme']]} /></Row>
            <Row label="Glow"><Toggle val={design.numGlow} onChange={v=>upd('numGlow',v)} /></Row>
            <Row label="Lineas fondo"><Toggle val={design.heroLines} onChange={v=>upd('heroLines',v)} /></Row>
          </Section>

          <Section icon="📅" title="SORTEO">
            <Row label="Hora sorteo">
              <input className="jd-input" value={design.horaSort} onChange={e=>upd('horaSort',e.target.value)} style={{ maxWidth:120, fontSize:'.9rem', letterSpacing:'2px', textAlign:'center' }} placeholder="10:00 PM" />
            </Row>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.55rem', color:'#555', padding:'6px 0 4px' }}>
              La fecha viene de cada rifa y se resalta como campo variable editable.
            </div>
          </Section>

          <Section icon="✦" title="DETALLES FINALES">
            <Row label="Perforacion"><Toggle val={design.showPerf} onChange={v=>upd('showPerf',v)} /></Row>
            <Row label="Marca de agua"><Toggle val={design.watermark} onChange={v=>upd('watermark',v)} /></Row>
            <Row label="Texto watermark"><input className="jd-input" value={design.watermarkText} onChange={e=>upd('watermarkText',e.target.value)} style={{ maxWidth:150, fontSize:'.8rem' }} /></Row>
            <div style={{ marginBottom:10 }}>
              <label className="jd-label">TEXTO DEL FOOTER</label>
              <input className="jd-input" value={design.footerText} onChange={e=>upd('footerText',e.target.value)} placeholder="Nota 1 · Nota 2" />
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.52rem', color:'#444', marginTop:4 }}>Usa · para dividir en dos lineas</div>
            </div>
          </Section>

        </div>

        {/* PREVIEW */}
        <div style={{ flex:'1 1 300px', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          {rifas.length > 1 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
              {rifas.map(r => (
                <button key={r.id||r.rifa_id} onClick={()=>setRifaSel(r)} style={{ padding:'5px 13px', background: rifaSel?.id===r.id ? 'rgba(245,197,24,.1)' : '#111', border:`1px solid ${rifaSel?.id===r.id ? '#f5c518' : '#252525'}`, color: rifaSel?.id===r.id ? '#f5c518' : '#777', borderRadius:5, cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'.62rem' }}>
                  {r.rifa_nombre || r.nombre}
                </button>
              ))}
            </div>
          )}

          <TicketPreview
            r={rifaDemo}
            numero="123"
            comprador={{ nombre:'Juan Perez', telefono:'300 123 4567' }}
            vendedor="Maria Garcia"
            design={design}
          />

          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.58rem', color: saved ? '#06d6a0' : '#333', transition:'color .3s', display:'flex', alignItems:'center', gap:6 }}>
            <i className={`bi ${saved ? 'bi-check-circle-fill' : 'bi-eye'}`}></i>
            {saved ? 'Diseno activo en todos los boletos' : 'Preview en tiempo real — boleto + talon'}
          </div>
        </div>

      </div>
    </Layout>
  );
}