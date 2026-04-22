// GestionVendedores.js — RIFAS JORDYN (v7)
// CAMBIOS v7:
// • Modal "Agregar vendedor": usa /buscar-numero (sin vendedor_id) para
//   mostrar estado global del numero en tiempo real.
// • En SIMULTANEA permite agregar el mismo numero dos veces (A y B).
// • POST /numeros ya no lanza error duplicado: [125,125] = A+B.
// • SerieBadge actualizado para mostrar info de buscar-numero.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';

const pad3  = n => String(n).padStart(3, '0');
const NUM_RE = /^\d{3}$/;

function generarCredenciales(nombre) {
  const base = nombre.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim()
    .split(/\s+/).join('_').slice(0, 20);
  const sufijo = Math.floor(1000 + Math.random() * 9000);
  return { usuario: `${base}_${sufijo}`, password: `${base}${sufijo}` };
}

const S = {
  overlay: { position:'fixed',inset:0,zIndex:9999,background:'rgba(8,22,22,0.72)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' },
  modal: (maxW=740) => ({ width:'100%',maxWidth:maxW,maxHeight:'94vh',background:'#fff',borderRadius:18,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(10,191,188,0.25)' }),
  header: (bg='var(--jordyn-primary)') => ({ background:bg,color:'#fff',padding:'1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 }),
  body: { flex:1,overflowY:'auto',padding:'1.25rem 1.5rem' },
  badge: (color='var(--jordyn-primary)') => ({ display:'inline-flex',alignItems:'center',gap:4,background:`${color}18`,border:`1.5px solid ${color}40`,color,borderRadius:20,padding:'2px 10px',fontSize:'0.7rem',fontWeight:700 }),
  pill: active => ({ padding:'5px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:'0.75rem',fontWeight:700,transition:'all .15s',background:active?'var(--jordyn-primary)':'transparent',color:active?'#fff':'var(--jordyn-muted)' }),
  tipoBadge: tipo => ({ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:'0.65rem',fontWeight:800, ...(tipo==='simultanea'?{background:'#fff0f5',border:'1.5px solid #e91e8c40',color:'#e91e8c'}:{background:'#f0f5ff',border:'1.5px solid #4361ee40',color:'#4361ee'}) }),
  closeBtn: { background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',cursor:'pointer' },
  btnSm: (bg,color,border) => ({ background:bg,border:`1px solid ${border}`,borderRadius:8,padding:'5px 9px',cursor:'pointer',fontSize:'0.74rem',color,display:'flex',alignItems:'center',gap:4 }),
};

// ── SerieBadge para vendedor EXISTENTE (usa validar-numero) ──────
function SerieBadge({ info }) {
  if (!info) return null;
  if (!info.disponible) {
    if (info.ya_tiene_a && info.ya_tiene_b) {
      return (
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
          <span style={{padding:'3px 9px',borderRadius:6,fontSize:'0.7rem',fontWeight:700,background:'#fff8e1',border:'1px solid #f0a50060',color:'#b07800',display:'inline-flex',alignItems:'center',gap:5}}>
            <i className="bi bi-check2-all"></i> Ya tienes Serie A y Serie B
          </span>
          <span style={{fontSize:'0.63rem',color:'#b07800'}}>Sin más espacio.</span>
        </div>
      );
    }
    return (
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <span style={{padding:'3px 9px',borderRadius:6,fontSize:'0.7rem',fontWeight:700,background:'#fff5f5',border:'1px solid #ffcccc',color:'#e63946',display:'inline-flex',alignItems:'center',gap:5}}>
          <i className="bi bi-x-circle-fill" style={{fontSize:'0.6rem'}}></i> No disponible
        </span>
        <span style={{fontSize:'0.63rem',color:'#c0392b',lineHeight:1.4}}>{info.mensaje}</span>
        {info.serie_a?.dueno && <span style={{fontSize:'0.61rem',color:'#4361ee',display:'flex',alignItems:'center',gap:4}}><span style={{background:'#f0f5ff',border:'1px solid #4361ee30',borderRadius:4,padding:'1px 5px',fontWeight:700}}>A</span>{info.serie_a.dueno}</span>}
        {info.serie_b?.dueno && <span style={{fontSize:'0.61rem',color:'#e91e8c',display:'flex',alignItems:'center',gap:4}}><span style={{background:'#fff0f5',border:'1px solid #e91e8c30',borderRadius:4,padding:'1px 5px',fontWeight:700}}>B</span>{info.serie_b.dueno}</span>}
      </div>
    );
  }
  const esB = info.serie_destino==='B';
  const esConA = info.ya_tiene_a;
  const color = esB ? '#e91e8c' : '#4361ee';
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <span style={{padding:'3px 9px',borderRadius:6,fontSize:'0.7rem',fontWeight:700,background:esB?'#fff0f5':'#f0f5ff',border:`1px solid ${color}40`,color,display:'inline-flex',alignItems:'center',gap:5}}>
        <i className="bi bi-arrow-right-circle-fill" style={{fontSize:'0.6rem'}}></i>
        {esConA ? 'Ya tienes A → irá a Serie B' : `Disponible → Serie ${info.serie_destino}`}
      </span>
      {esB && info.serie_a?.dueno && !esConA && <span style={{fontSize:'0.61rem',color:'#4361ee',display:'flex',alignItems:'center',gap:4}}><span style={{background:'#f0f5ff',border:'1px solid #4361ee30',borderRadius:4,padding:'1px 5px',fontWeight:700}}>A</span>{info.serie_a.dueno}</span>}
      {esConA && <span style={{fontSize:'0.62rem',color:'#e91e8c',opacity:0.85}}>Segunda serie del mismo número</span>}
    </div>
  );
}

// ── BuscarNumeroBadge para vendedor NUEVO (usa buscar-numero) ────
// Muestra estado global: quien tiene A, quien tiene B, si hay espacio.
function BuscarNumeroBadge({ info, esSim }) {
  if (!info) return null;
  if (!info.hay_espacio) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <span style={{padding:'3px 9px',borderRadius:6,fontSize:'0.7rem',fontWeight:700,background:'#fff5f5',border:'1px solid #ffcccc',color:'#e63946',display:'inline-flex',alignItems:'center',gap:5}}>
          <i className="bi bi-x-circle-fill" style={{fontSize:'0.6rem'}}></i> Sin espacio
        </span>
        {info.serie_a?.vendedor_nombre && <span style={{fontSize:'0.61rem',color:'#4361ee',display:'flex',alignItems:'center',gap:4}}><span style={{background:'#f0f5ff',border:'1px solid #4361ee30',borderRadius:4,padding:'1px 5px',fontWeight:700}}>A</span>{info.serie_a.vendedor_nombre}</span>}
        {info.serie_b?.vendedor_nombre && <span style={{fontSize:'0.61rem',color:'#e91e8c',display:'flex',alignItems:'center',gap:4}}><span style={{background:'#fff0f5',border:'1px solid #e91e8c30',borderRadius:4,padding:'1px 5px',fontWeight:700}}>B</span>{info.serie_b.vendedor_nombre}</span>}
      </div>
    );
  }
  // Hay espacio — mostrar a cual serie irá
  const irA = info.disponible_a;
  const color = irA ? '#4361ee' : '#e91e8c';
  const serie = irA ? 'A' : 'B';
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <span style={{padding:'3px 9px',borderRadius:6,fontSize:'0.7rem',fontWeight:700,background:irA?'#f0f5ff':'#fff0f5',border:`1px solid ${color}40`,color,display:'inline-flex',alignItems:'center',gap:5}}>
        <i className="bi bi-arrow-right-circle-fill" style={{fontSize:'0.6rem'}}></i>
        Irá a Serie {serie}
      </span>
      {!irA && info.serie_a?.vendedor_nombre && <span style={{fontSize:'0.61rem',color:'#4361ee',display:'flex',alignItems:'center',gap:4}}><span style={{background:'#f0f5ff',border:'1px solid #4361ee30',borderRadius:4,padding:'1px 5px',fontWeight:700}}>A</span>{info.serie_a.vendedor_nombre}</span>}
      {esSim && <span style={{fontSize:'0.62rem',color:'var(--jordyn-muted)'}}>
        {info.serie_b?.ocupada ? `B: ${info.serie_b.vendedor_nombre}` : 'B: libre'}
      </span>}
    </div>
  );
}

// ── InlineNotif ──────────────────────────────────────────────────
function InlineNotif({ items, onClear }) {
  if (!items?.length) return null;
  return (
    <div style={{marginBottom:'1rem'}}>
      {items.map((item,i) => (
        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 12px',borderRadius:10,marginBottom:6,fontSize:'0.78rem',lineHeight:1.5,
          background:item.type==='error'?'#fff5f5':item.type==='warning'?'#fff8e1':item.type==='success'?'#f0fff8':'#f0f5ff',
          border:`1.5px solid ${item.type==='error'?'#ffcccc':item.type==='warning'?'#f0d08060':item.type==='success'?'#2ecc7140':'#4361ee40'}`,
          color:item.type==='error'?'#c0392b':item.type==='warning'?'#b07800':item.type==='success'?'#1a7a40':'#4361ee'}}>
          <i className={`bi ${item.type==='error'?'bi-x-circle-fill':item.type==='warning'?'bi-exclamation-triangle-fill':item.type==='success'?'bi-check-circle-fill':'bi-info-circle-fill'}`} style={{marginTop:2,flexShrink:0}}></i>
          <span style={{flex:1}}>{item.text}</span>
        </div>
      ))}
      {onClear && <button onClick={onClear} style={{background:'none',border:'none',color:'var(--jordyn-muted)',fontSize:'0.68rem',cursor:'pointer',padding:'2px 6px'}}><i className="bi bi-x me-1"></i>Limpiar</button>}
    </div>
  );
}

// ── ConflictPanel ────────────────────────────────────────────────
function ConflictPanel({ colisiones, titulo='Sin espacio' }) {
  if (!colisiones?.length) return null;
  return (
    <div style={{background:'#fff5f5',border:'2px solid #ffaaaa',borderRadius:12,padding:'10px 14px',marginBottom:'1rem'}}>
      <div style={{fontSize:'0.75rem',fontWeight:800,color:'#c0392b',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
        <i className="bi bi-exclamation-octagon-fill"></i>{titulo} ({colisiones.length})
      </div>
      {colisiones.map((c,i) => (
        <div key={i} style={{padding:'5px 8px',background:'#fff',borderRadius:8,border:'1px solid #ffcccc',marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
            <span style={{fontWeight:800,fontSize:'0.8rem',background:'#ffe5e5',border:'1px solid #e6394640',borderRadius:6,padding:'1px 7px',color:'#e63946'}}>{c.numero}</span>
            <span style={{fontSize:'0.7rem',color:'#c0392b'}}>{c.mensaje}</span>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {c.dueno_a && <span style={{fontSize:'0.62rem',color:'#4361ee',display:'inline-flex',alignItems:'center',gap:3}}><span style={{background:'#f0f5ff',border:'1px solid #4361ee30',borderRadius:4,padding:'0 4px',fontWeight:700,fontSize:'0.6rem'}}>A</span>{c.dueno_a}</span>}
            {c.dueno_b && <span style={{fontSize:'0.62rem',color:'#e91e8c',display:'inline-flex',alignItems:'center',gap:3}}><span style={{background:'#fff0f5',border:'1px solid #e91e8c30',borderRadius:4,padding:'0 4px',fontWeight:700,fontSize:'0.6rem'}}>B</span>{c.dueno_b}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hook validar numero para vendedor EXISTENTE ──────────────────
function useValidarNumero(categoriaId, vendedorId, numero) {
  const [info,setInfo]           = useState(null);
  const [validando,setValidando] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    setInfo(null);
    if (!NUM_RE.test(numero)||!vendedorId) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setValidando(true);
      try {
        const r = await API.get(`/categorias-globales/${categoriaId}/validar-numero`,{params:{numero,vendedor_id:vendedorId}});
        setInfo(r.data);
      } catch { setInfo(null); }
      finally { setValidando(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [categoriaId,vendedorId,numero]);
  return { info, validando };
}

// ── Hook buscar numero GLOBAL (para nuevo vendedor) ──────────────
function useBuscarNumero(categoriaId, numero, activo) {
  const [info,setInfo]           = useState(null);
  const [buscando,setBuscando]   = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    setInfo(null);
    if (!activo || !NUM_RE.test(numero)) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await API.get(`/categorias-globales/${categoriaId}/buscar-numero`,{params:{numero}});
        setInfo(r.data);
      } catch { setInfo(null); }
      finally { setBuscando(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [categoriaId,numero,activo]);
  return { info, buscando };
}

// ── ModalCrearCategoria ──────────────────────────────────────────
function ModalCrearCategoria({ categoria, onClose, onSaved }) {
  const esEditar = !!categoria;
  const [form,setForm] = useState({nombre:categoria?.nombre||'',tipo:categoria?.tipo||'parcial',monto:categoria?.monto||'',descripcion:categoria?.descripcion||''});
  const [saving,setSaving] = useState(false);
  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      esEditar ? await API.put(`/categorias-globales/${categoria.id}`,form) : await API.post('/categorias-globales',form);
      toast.success(esEditar?'Categoría actualizada':'Categoría creada');
      onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); }
    finally { setSaving(false); }
  };
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{...S.overlay,zIndex:10200}}>
      <div style={S.modal(560)}>
        <div style={S.header(esEditar?'linear-gradient(135deg,#1a7a40,#2ecc71)':'linear-gradient(135deg,#0a3d62,#0abfbc)')}>
          <div><div style={{fontWeight:800,fontSize:'1rem'}}>{esEditar?'Editar Categoría':'Nueva Categoría'}</div><div style={{fontSize:'0.72rem',opacity:0.85,marginTop:2}}>{esEditar?categoria.nombre:'Parcial o Simultánea con Series A y B'}</div></div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{marginBottom:'1rem'}}><label className="jd-label">NOMBRE *</label><input className="jd-input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Premio $1000" autoFocus /></div>
          <div style={{marginBottom:'1rem'}}><label className="jd-label">MONTO</label><input className="jd-input" value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))} placeholder="Ej: $1,000" /></div>
          <div style={{marginBottom:'1rem'}}>
            <label className="jd-label">TIPO *</label>
            <div style={{display:'flex',gap:'1rem',marginTop:'0.5rem'}}>
              {[{key:'parcial',icon:'bi-bullseye',label:'Parcial',accent:'#4361ee',desc:'Serie única. Cada número = un vendedor.'},
                {key:'simultanea',icon:'bi-lightning-fill',label:'Simultánea',accent:'#e91e8c',desc:'Series A y B. El mismo número puede ir en A y B (incluso el mismo vendedor).'}
              ].map(({key,icon,label,desc,accent})=>(
                <div key={key} onClick={()=>!esEditar&&setForm(p=>({...p,tipo:key}))} style={{flex:1,padding:'1rem',borderRadius:12,cursor:esEditar?'default':'pointer',border:`2px solid ${form.tipo===key?accent:'var(--jordyn-border)'}`,background:form.tipo===key?`${accent}10`:'var(--jordyn-bg2)',transition:'all .15s',opacity:esEditar?0.7:1}}>
                  <i className={`bi ${icon}`} style={{fontSize:'1.3rem',color:form.tipo===key?accent:'var(--jordyn-muted)',display:'block',marginBottom:6}}></i>
                  <div style={{fontWeight:800,fontSize:'0.88rem',marginBottom:4,color:form.tipo===key?accent:'var(--jordyn-text)'}}>{label}</div>
                  <div style={{fontSize:'0.72rem',color:'var(--jordyn-muted)',lineHeight:1.5}}>{desc}</div>
                </div>
              ))}
            </div>
            {esEditar&&<div className="jd-alert jd-alert-warning mt-2" style={{fontSize:'0.75rem'}}><i className="bi bi-lock-fill me-1"></i>El tipo no se puede cambiar.</div>}
          </div>
          <div style={{marginBottom:'1.5rem'}}><label className="jd-label">NOTAS</label><textarea className="jd-input" rows={2} value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="Notas..." style={{resize:'none'}} /></div>
          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>{saving?<><span className="jd-spinner" style={{width:16,height:16}}></span> Guardando...</>:<><i className="bi bi-floppy-fill me-1"></i>{esEditar?'Actualizar':'Crear categoría'}</>}</button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{flexShrink:0,padding:'0 20px'}}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModalEditarVendedor ──────────────────────────────────────────
function ModalEditarVendedor({ vendedor, onClose, onSaved }) {
  const [form,setForm] = useState({nombre:vendedor.nombre||'',cedula:vendedor.cedula||'',password:''});
  const [saving,setSaving] = useState(false);
  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (form.password&&form.password.length<6) return toast.error('Mínimo 6 caracteres');
    setSaving(true);
    try {
      const payload={nombre:form.nombre.trim(),cedula:form.cedula||null};
      if (form.password) payload.password=form.password;
      await API.put(`/vendedores/${vendedor.id}`,payload);
      toast.success('Vendedor actualizado'); onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); }
    finally { setSaving(false); }
  };
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{...S.overlay,zIndex:10400}}>
      <div style={S.modal(460)}>
        <div style={S.header('linear-gradient(135deg,#1a3a5c,#0abfbc)')}>
          <div><div style={{fontWeight:800,fontSize:'1rem'}}><i className="bi bi-pencil-fill me-2"></i>Editar vendedor</div><div style={{fontSize:'0.72rem',opacity:0.85,marginTop:2}}>{vendedor.nombre}</div></div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{display:'flex',flexDirection:'column',gap:'0.85rem',marginBottom:'1.25rem'}}>
            <div><label className="jd-label">NOMBRE *</label><input className="jd-input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} autoFocus /></div>
            <div><label className="jd-label">CÉDULA</label><input className="jd-input" value={form.cedula} onChange={e=>setForm(p=>({...p,cedula:e.target.value}))} placeholder="Opcional" /></div>
            <div><label className="jd-label">NUEVA CONTRASEÑA</label><input className="jd-input" type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Dejar vacío = sin cambios" /></div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={guardar} disabled={saving}>{saving?<><span className="jd-spinner" style={{width:15,height:15}}></span> Guardando...</>:<><i className="bi bi-floppy-fill me-1"></i>Guardar</>}</button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{flexShrink:0,padding:'0 18px'}}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModalNumerosEnCategoria ──────────────────────────────────────
function ModalNumerosEnCategoria({ categoria, vendedor, onClose, onSaved }) {
  const [numeros,setNumeros]       = useState([]);
  const [numInput,setNumInput]     = useState('');
  const [rangoIni,setRangoIni]     = useState('');
  const [rangoFin,setRangoFin]     = useState('');
  const [tab,setTab]               = useState('manual');
  const [loading,setLoading]       = useState(true);
  const [saving,setSaving]         = useState(false);
  const [asignando,setAsignando]   = useState(false);
  const [preview,setPreview]       = useState(null);
  const [loadingPrev,setLoadingPrev]=useState(false);
  const [notifs,setNotifs]         = useState([]);

  const esSim  = categoria.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';
  const addNotif = (text, type='info') => setNotifs(p=>[...p,{text,type}]);

  const { info:infoInput, validando } = useValidarNumero(categoria.id, vendedor.id, numInput);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get(`/categorias-globales/${categoria.id}/vendedores-resumen`);
      const v = r.data.vendedores.find(v=>String(v.vendedor_id)===String(vendedor.id));
      setNumeros(v?.numeros||[]);
    } catch { toast.error('Error cargando números'); }
    finally { setLoading(false); }
  },[categoria.id,vendedor.id]);

  const cargarPreview = useCallback(async () => {
    setLoadingPrev(true);
    try {
      const r = await API.get(`/categorias-globales/${categoria.id}/preview/${vendedor.id}`);
      setPreview(r.data);
    } catch { setPreview(null); }
    finally { setLoadingPrev(false); }
  },[categoria.id,vendedor.id]);

  useEffect(()=>{ cargar(); },[cargar]);
  useEffect(()=>{ if(numeros.length>0) cargarPreview(); else setPreview(null); },[numeros.length,cargarPreview]);

  const agregarAlPool = async nums => {
    const validos = nums.filter(n=>NUM_RE.test(n));
    if (!validos.length) return toast.error('Sin números válidos');
    setSaving(true);
    try {
      const r = await API.post(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`,{numeros:validos});
      if (r.data.insertados?.length) {
        const porSerie = {A:[],B:[]};
        r.data.insertados.forEach(x=>{ if(x.serie) porSerie[x.serie].push(x.numero); });
        if (porSerie.A.length) addNotif(`Serie A: ${porSerie.A.join(', ')} ✓`,'success');
        if (porSerie.B.length) addNotif(`Serie B: ${porSerie.B.join(', ')} ✓`,'success');
      }
      r.data.colisiones?.forEach(c=>addNotif(`${c.numero}: ${c.mensaje}`,'error'));
      await cargar(); onSaved?.();
    } catch(err) {
      const msg=err.response?.data?.error||'Error';
      addNotif(msg,'error'); toast.error(msg);
    } finally { setSaving(false); }
  };

  const quitarDelPool = async numero => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/numeros`,{data:{numeros:[numero]}});
      await cargar(); onSaved?.();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); }
  };

  const liberarSerie = async asignacion_id => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/asignaciones/${asignacion_id}`);
      addNotif('Serie liberada.','info');
      await cargar(); onSaved?.();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); }
  };

  const asignarNumeros = async () => {
    setAsignando(true);
    try {
      const r = await API.post(`/categorias-globales/${categoria.id}/vendedores/${vendedor.id}/asignar`);
      addNotif(r.data.message,'success');
      r.data.colisiones?.forEach(c=>addNotif(`${c.numero}: ${c.mensaje}`,'warning'));
      await cargar(); onSaved?.();
    } catch(err) {
      const d=err.response?.data;
      addNotif(d?.error||'Error','error');
      d?.colisiones?.forEach(c=>addNotif(`${c.numero}: ${c.mensaje}`,'warning'));
    } finally { setAsignando(false); }
  };

  const agregarManual = () => {
    const num=pad3(parseInt(numInput)||0);
    if (!NUM_RE.test(num)) { toast.error('Número inválido'); return; }
    if (infoInput&&!infoInput.disponible) { addNotif(`${num}: ${infoInput.mensaje}`,'error'); toast.error(infoInput.mensaje); return; }
    agregarAlPool([num]);
    setNumInput('');
  };

  const agregarRango = () => {
    const ini=parseInt(rangoIni),fin=parseInt(rangoFin);
    if (isNaN(ini)||isNaN(fin)||ini>fin||ini<0||fin>999) { toast.error('Rango inválido'); return; }
    const nums=[];
    for(let i=ini;i<=fin;i++) nums.push(pad3(i));
    agregarAlPool(nums);
  };

  const conSerie   = numeros.filter(n=>n.serie);
  const sinSerie   = numeros.filter(n=>!n.serie);
  const total      = numeros.length;
  const colorSerie = s=>s==='A'?'#4361ee':s==='B'?'#e91e8c':'#aaa';
  const bgSerie    = s=>s==='A'?'#f0f5ff':s==='B'?'#fff0f5':'#f5f5f5';

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{...S.overlay,zIndex:10300}}>
      <div style={S.modal(700)}>
        <div style={S.header(`linear-gradient(135deg,${esSim?'#7b0050,#e91e8c':'#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{fontWeight:800,fontSize:'1rem'}}><i className="bi bi-hash me-1"></i>{vendedor.nombre}</div>
            <div style={{fontSize:'0.72rem',opacity:0.85,marginTop:2}}>{categoria.nombre} — {total} pool — {conSerie.length} asignados — {sinSerie.length} pendientes</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div className="jd-alert jd-alert-info mb-3" style={{fontSize:'0.75rem',lineHeight:1.7}}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim?<><strong>Simultánea:</strong> Puedes agregar el mismo número dos veces para ocupar Serie A y Serie B.</>:<><strong>Parcial:</strong> Un número = un vendedor.</>}
          </div>
          <InlineNotif items={notifs} onClear={()=>setNotifs([])} />
          <div style={{background:'var(--jordyn-bg2)',borderRadius:10,padding:'0.75rem 1rem',marginBottom:'1rem',border:'1px solid var(--jordyn-border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.72rem',color:'var(--jordyn-muted)',fontWeight:600,marginBottom:5}}>
              <span>POOL</span><span>{total} — {conSerie.length} asignados — {sinSerie.length} pendientes</span>
            </div>
            <div style={{height:8,borderRadius:8,background:'var(--jordyn-border)',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:8,background:`linear-gradient(90deg,${accent},${accent}88)`,width:`${(total/1000)*100}%`,transition:'width 0.4s'}} />
            </div>
          </div>
          <div style={{display:'flex',borderRadius:10,overflow:'hidden',border:'1.5px solid var(--jordyn-border)',marginBottom:'0.85rem'}}>
            {[['manual','Manual'],['rango','Rango']].map(([k,l],i)=>(
              <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'8px 6px',border:'none',cursor:'pointer',fontSize:'0.78rem',fontWeight:600,background:tab===k?accent:'transparent',color:tab===k?'#fff':'var(--jordyn-muted)',borderRight:i===0?'1.5px solid var(--jordyn-border)':'none'}}>{l}</button>
            ))}
          </div>
          {tab==='manual'&&(
            <div style={{marginBottom:'1rem'}}>
              <div style={{display:'flex',gap:'0.5rem',alignItems:'flex-start',flexWrap:'wrap'}}>
                <div>
                  <input className="jd-input" value={numInput}
                    onChange={e=>setNumInput(e.target.value.replace(/\D/g,'').slice(0,3))}
                    onKeyDown={e=>e.key==='Enter'&&agregarManual()}
                    placeholder="000-999"
                    style={{maxWidth:110,textAlign:'center',fontWeight:700,letterSpacing:2,fontSize:'1rem',borderColor:infoInput?(infoInput.disponible?accent:'#ffaaaa'):undefined}}
                    maxLength={3} />
                  <div style={{marginTop:5,minHeight:42}}>
                    {validando?<span className="jd-spinner" style={{width:12,height:12}}></span>
                      :numInput.length===3&&infoInput?<SerieBadge info={infoInput} />:null}
                  </div>
                </div>
                <button className="btn-jordyn" onClick={agregarManual} disabled={saving||(infoInput&&!infoInput.disponible)}
                  style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,height:44}}>
                  <i className="bi bi-plus-lg me-1"></i>Agregar
                </button>
              </div>
            </div>
          )}
          {tab==='rango'&&(
            <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap'}}>
              <input className="jd-input" value={rangoIni} onChange={e=>setRangoIni(e.target.value)} placeholder="Desde" style={{maxWidth:90}} maxLength={3} />
              <span style={{color:'var(--jordyn-muted)'}}>—</span>
              <input className="jd-input" value={rangoFin} onChange={e=>setRangoFin(e.target.value)} placeholder="Hasta" style={{maxWidth:90}} maxLength={3} />
              <button className="btn-jordyn" onClick={agregarRango} disabled={saving} style={{background:`linear-gradient(135deg,${accent},${accent}cc)`}}>
                <i className="bi bi-plus-lg me-1"></i>Agregar rango
              </button>
            </div>
          )}
          {loading
            ?<div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{width:36,height:36}}></div></div>
            :(
            <>
              {sinSerie.length>0&&(
                <div style={{background:'var(--jordyn-bg2)',border:`2px solid ${accent}30`,borderRadius:14,padding:'1rem',marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:preview?'0.75rem':0}}>
                    <div style={{fontWeight:700,fontSize:'0.85rem',color:accent}}><i className="bi bi-lightning-fill me-1"></i>{sinSerie.length} pendiente(s)</div>
                    <button className="btn-jordyn" onClick={asignarNumeros} disabled={asignando||loadingPrev}
                      style={{height:36,padding:'0 16px',fontSize:'0.8rem',background:`linear-gradient(135deg,${accent},${accent}cc)`}}>
                      {asignando?<span className="jd-spinner" style={{width:14,height:14}}></span>:<><i className="bi bi-send-fill me-1"></i>Asignar series</>}
                    </button>
                  </div>
                  {loadingPrev&&<div style={{fontSize:'0.72rem',color:'var(--jordyn-muted)',display:'flex',alignItems:'center',gap:6}}><span className="jd-spinner" style={{width:12,height:12}}></span> Calculando...</div>}
                  {preview&&!loadingPrev&&(
                    <div style={{display:'flex',flexDirection:'column',gap:'0.45rem'}}>
                      {['A','B'].map(serie=>{
                        const nums=preview.libres?.filter(l=>l.serie===serie)||[];
                        if(!nums.length) return null;
                        const color=colorSerie(serie);
                        return (
                          <div key={serie} style={{background:serie==='A'?'#f0fff8':'#fff0f5',border:`1.5px solid ${color}40`,borderRadius:10,padding:'8px 12px'}}>
                            <div style={{fontSize:'0.7rem',fontWeight:700,color,marginBottom:5}}><i className="bi bi-check-circle-fill me-1"></i>Serie {serie}: {nums.length}</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                              {nums.slice(0,30).map(l=><span key={l.numero} style={{padding:'2px 7px',borderRadius:6,fontSize:'0.68rem',fontWeight:800,background:bgSerie(serie),border:`1px solid ${color}30`,color}}>{l.numero}</span>)}
                              {nums.length>30&&<span style={{fontSize:'0.64rem',color,alignSelf:'center'}}>+{nums.length-30}</span>}
                            </div>
                          </div>
                        );
                      })}
                      <ConflictPanel colisiones={preview.colisiones} titulo="Sin espacio — NO se asignarán" />
                    </div>
                  )}
                </div>
              )}
              {conSerie.length>0&&(
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={{fontSize:'0.65rem',fontWeight:700,color:'var(--jordyn-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>
                    Con serie ({conSerie.length}) — × libera serie · 🗑 quita del pool
                  </div>
                  {esSim
                    ?['A','B'].map(serie=>{
                        const nums=conSerie.filter(n=>n.serie===serie);
                        if(!nums.length) return null;
                        const color=colorSerie(serie);
                        return (
                          <div key={serie} style={{marginBottom:'0.5rem'}}>
                            <div style={{fontSize:'0.62rem',fontWeight:700,color,marginBottom:4,textTransform:'uppercase'}}>Serie {serie} ({nums.length})</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                              {nums.sort((a,b)=>a.numero.localeCompare(b.numero)).map(n=>(
                                <div key={`${n.numero}-${n.serie}`} style={{display:'flex',alignItems:'center',gap:2}}>
                                  <span style={{padding:'3px 8px',borderRadius:6,fontWeight:800,fontSize:'0.7rem',background:bgSerie(serie),border:`1.5px solid ${color}40`,color}}>{n.numero}</span>
                                  <button onClick={()=>liberarSerie(n.asignacion_id)} title="Liberar serie" style={{background:'none',border:'none',color:'#999',cursor:'pointer',padding:0,fontSize:'0.8rem',fontWeight:700}}>×</button>
                                  <button onClick={()=>quitarDelPool(n.numero)} title="Quitar" style={{background:'none',border:'none',color:'#e63946',cursor:'pointer',padding:0,fontSize:'0.65rem'}}><i className="bi bi-trash3"></i></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    :(
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {conSerie.sort((a,b)=>a.numero.localeCompare(b.numero)).map(n=>(
                          <div key={n.numero} style={{display:'flex',alignItems:'center',gap:2}}>
                            <span style={{padding:'3px 8px',borderRadius:6,fontWeight:800,fontSize:'0.7rem',background:'rgba(10,191,188,0.1)',border:'1.5px solid rgba(10,191,188,0.35)',color:'var(--jordyn-primary)'}}>{n.numero}</span>
                            <button onClick={()=>liberarSerie(n.asignacion_id)} style={{background:'none',border:'none',color:'#999',cursor:'pointer',padding:0,fontSize:'0.8rem',fontWeight:700}}>×</button>
                            <button onClick={()=>quitarDelPool(n.numero)} style={{background:'none',border:'none',color:'#e63946',cursor:'pointer',padding:0,fontSize:'0.65rem'}}><i className="bi bi-trash3"></i></button>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              )}
              {sinSerie.length>0&&(
                <div>
                  <div style={{fontSize:'0.65rem',fontWeight:700,color:'#f0a500',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6}}>Sin serie ({sinSerie.length})</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {sinSerie.map(n=>(
                      <div key={n.numero} style={{display:'flex',alignItems:'center',gap:2}}>
                        <span style={{padding:'3px 8px',borderRadius:6,fontWeight:800,fontSize:'0.7rem',background:'#f9f9f9',border:'1.5px solid #ddd',color:'#999'}}>{n.numero}</span>
                        <button onClick={()=>quitarDelPool(n.numero)} style={{background:'none',border:'none',color:'#e63946',cursor:'pointer',padding:0,fontSize:'0.65rem'}}><i className="bi bi-trash3"></i></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {total===0&&<div className="jd-alert jd-alert-warning" style={{fontSize:'0.82rem'}}>Sin números en el pool.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ModalCrearVendedorEnCategoria (v7) ───────────────────────────
// NUEVO: usa /buscar-numero para modo "nuevo vendedor".
// NUEVO: en simultanea permite numeros[i]===numeros[j] (A y B).
function ModalCrearVendedorEnCategoria({ categoria, vendedoresDisponibles: vendedoresDisponiblesInit, onClose, onSaved }) {
  const esSim  = categoria.tipo === 'simultanea';
  const accent = esSim ? '#e91e8c' : '#4361ee';

  // Congela la lista de disponibles al momento de abrir el modal para que
  // recargas del padre no desmонten/remonten este modal (lo que borraba el resultado).
  const vendedoresDisponiblesRef = useRef(vendedoresDisponiblesInit);
  const vendedoresDisponibles = vendedoresDisponiblesRef.current;

  const [modo,        setModo]        = useState('nuevo');
  const [vendedorSel, setVendedorSel] = useState('');
  const [form,        setForm]        = useState({nombre:'',cedula:''});
  // numeros es array con POSIBLES REPETIDOS en simultanea: ['123','123'] = A y B
  const [numeros,     setNumeros]     = useState([]);
  const [numInput,    setNumInput]    = useState('');
  const [rangoIni,    setRangoIni]    = useState('');
  const [rangoFin,    setRangoFin]    = useState('');
  const [tab,         setTab]         = useState('manual');
  const [saving,      setSaving]      = useState(false);
  const [resultado,   setResultado]   = useState(null);

  // Para modo existente: validar con vendedor_id
  const vendedorIdParaValidar = modo==='existente' ? vendedorSel : null;
  const { info:infoExistente, validando:validandoExistente } = useValidarNumero(categoria.id, vendedorIdParaValidar, numInput);

  // Para modo nuevo: buscar estado global sin vendedor_id
  const { info:infoBuscar, buscando } = useBuscarNumero(categoria.id, numInput, modo==='nuevo' && numInput.length===3);

  // Cuantas veces aparece el numero en la lista actual
  const conteoEnLista = numeros.reduce((acc,n)=>{ acc[n]=(acc[n]||0)+1; return acc; },{});

  // ¿Puede agregar este numero? Depende del modo y del estado
  const puedeAgregarNuevo = () => {
    if (!NUM_RE.test(pad3(parseInt(numInput)||0))) return false;
    const num = pad3(parseInt(numInput)||0);
    const vecesEnLista = conteoEnLista[num]||0;
    if (!esSim) return vecesEnLista === 0; // parcial: solo una vez
    // simultanea: max 2 veces
    if (vecesEnLista >= 2) return false;
    // si ya está una vez, solo puede agregar si la info dice que hay segunda serie disponible
    if (vecesEnLista === 1 && infoBuscar) {
      return infoBuscar.hay_espacio && (infoBuscar.disponible_b || infoBuscar.disponible_a);
    }
    if (vecesEnLista === 0 && infoBuscar) return infoBuscar.hay_espacio;
    return vecesEnLista < 2;
  };

  const puedeAgregarExistente = () => {
    if (!NUM_RE.test(pad3(parseInt(numInput)||0))) return false;
    if (!vendedorSel) return false;
    if (infoExistente && !infoExistente.disponible) return false;
    return true;
  };

  const agregarNumeroManual = () => {
    const num = pad3(parseInt(numInput)||0);
    if (!NUM_RE.test(num)) { toast.error('Número inválido'); return; }

    if (modo==='existente') {
      if (infoExistente&&!infoExistente.disponible) { toast.error(infoExistente.mensaje); return; }
      if (numeros.includes(num)) { toast.warning(`${num} ya está en la lista`); return; }
      setNumeros(p=>[...p,num]);
    } else {
      // modo nuevo
      const vecesEnLista = conteoEnLista[num]||0;
      if (!esSim && vecesEnLista>=1) { toast.warning(`${num} ya está en la lista`); return; }
      if (esSim && vecesEnLista>=2) { toast.warning(`${num} ya tiene Serie A y Serie B en la lista`); return; }
      if (esSim && vecesEnLista===1) {
        // Segundo intento: verificar que hay espacio para segunda serie
        if (infoBuscar && !infoBuscar.hay_espacio) { toast.error(infoBuscar.mensaje); return; }
        // Si el disponible_a ya esta libre significa que la primera entrada va a A,
        // esta segunda va a B (o viceversa). Permitir.
      }
      if (infoBuscar && !infoBuscar.hay_espacio && vecesEnLista===0) { toast.error(infoBuscar.mensaje); return; }
      setNumeros(p=>[...p,num]);
    }
    setNumInput('');
  };

  const agregarRango = () => {
    const ini=parseInt(rangoIni),fin=parseInt(rangoFin);
    if (isNaN(ini)||isNaN(fin)||ini>fin||ini<0||fin>999) { toast.error('Rango inválido'); return; }
    const nuevos=[];
    for (let i=ini;i<=fin;i++) {
      const num=pad3(i);
      if (!numeros.includes(num)) nuevos.push(num);
    }
    setNumeros(p=>[...p,...nuevos]);
    if (nuevos.length) toast.success(`${nuevos.length} números agregados`);
  };

  const confirmar = async () => {
    if (modo==='nuevo'&&!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (modo==='existente'&&!vendedorSel) return toast.error('Selecciona un vendedor');
    setSaving(true);
    try {
      const creds = modo==='nuevo' ? generarCredenciales(form.nombre.trim()) : null;
      const payload = {
        ...(modo==='existente'
          ? {vendedor_id:vendedorSel}
          : {nombre:form.nombre.trim(),cedula:form.cedula||undefined,...creds}),
        numeros, // puede tener repetidos ej: ['123','123']
      };
      const r = await API.post(`/categorias-globales/${categoria.id}/vendedores`,payload);
      setResultado(r.data); onSaved?.();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); }
    finally { setSaving(false); }
  };

  // ── Resultado ──────────────────────────────────────────────────
  if (resultado) {
    const {vendedor,credenciales,asignacion} = resultado;
    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{...S.overlay,zIndex:10300}}>
        <div style={S.modal(560)}>
          <div style={S.header(`linear-gradient(135deg,${esSim?'#7b0050,#e91e8c':'#0a3d62,#0abfbc'})`)}>
            <div><div style={{fontWeight:800,fontSize:'1rem'}}><i className="bi bi-check-circle-fill me-2"></i>Vendedor agregado</div><div style={{fontSize:'0.72rem',opacity:0.85,marginTop:2}}>{vendedor.nombre} — {categoria.nombre}</div></div>
            <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={S.body}>
            {credenciales&&(
              <div style={{background:'linear-gradient(135deg,#0a3d62,#0abfbc)',borderRadius:12,padding:'0.9rem 1.1rem',marginBottom:'1rem',color:'#fff'}}>
                <div style={{fontWeight:800,marginBottom:6}}>Credenciales</div>
                <div style={{display:'flex',gap:'1rem',fontSize:'0.82rem',flexWrap:'wrap'}}>
                  <span>Usuario: <strong style={{background:'rgba(255,255,255,0.2)',padding:'2px 8px',borderRadius:6}}>{credenciales.usuario}</strong></span>
                  <span>Clave: <strong style={{background:'rgba(255,255,255,0.2)',padding:'2px 8px',borderRadius:6}}>{credenciales.password}</strong></span>
                </div>
                <div style={{fontSize:'0.7rem',opacity:0.8,marginTop:5}}>Copia ahora. No se mostrarán de nuevo.</div>
              </div>
            )}
            <div style={{fontSize:'0.82rem',marginBottom:'1rem',lineHeight:1.7}}>{asignacion.mensaje}</div>
            {['A','B'].map(serie=>{
              const nums=asignacion.insertados?.filter(i=>i.serie===serie)||[];
              if(!nums.length) return null;
              const color=serie==='A'?'#4361ee':'#e91e8c';
              return (
                <div key={serie} style={{marginBottom:'0.75rem',background:serie==='A'?'#f0f5ff':'#fff0f5',border:`1.5px solid ${color}30`,borderRadius:10,padding:'10px 14px'}}>
                  <div style={{fontSize:'0.68rem',fontWeight:700,color,textTransform:'uppercase',marginBottom:6}}>Serie {serie} — {nums.length} número(s)</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {nums.map(n=><span key={n.numero} style={{padding:'2px 7px',borderRadius:5,fontSize:'0.66rem',fontWeight:800,background:'#fff',border:`1px solid ${color}30`,color}}>{n.numero}</span>)}
                  </div>
                </div>
              );
            })}
            <ConflictPanel colisiones={asignacion.colisiones?.map(c=>({numero:c.numero,mensaje:c.mensaje,dueno_a:c.ocupadaA?.nombre||null,dueno_b:c.ocupadaB?.nombre||null}))} titulo="Sin espacio — No asignados" />
            <div style={{display:'flex',gap:'0.5rem',marginTop:8}}>
              <button className="btn-jordyn w-100" onClick={()=>{
                setResultado(null);
                setNumeros([]);
                setNumInput('');
                setForm({nombre:'',cedula:''});
                setVendedorSel('');
                setModo('nuevo');
              }} style={{background:`linear-gradient(135deg,${esSim?'#7b0050,#e91e8c':'#0a3d62,#0abfbc'})`}}>
                <i className="bi bi-person-plus-fill me-1"></i>Agregar otro vendedor
              </button>
              <button className="btn-jordyn-outline" onClick={onClose} style={{flexShrink:0,padding:'0 18px'}}><i className="bi bi-check-lg me-1"></i>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario ─────────────────────────────────────────────────
  const num3 = pad3(parseInt(numInput)||0);
  const vecesEnLista = NUM_RE.test(num3) ? (conteoEnLista[num3]||0) : 0;

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{...S.overlay,zIndex:10300}}>
      <div style={S.modal(640)}>
        <div style={S.header(`linear-gradient(135deg,${esSim?'#7b0050,#e91e8c':'#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{fontWeight:800,fontSize:'1rem'}}><i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor</div>
            <div style={{fontSize:'0.72rem',opacity:0.85,marginTop:2}}><span style={S.tipoBadge(categoria.tipo)}>{esSim?'Simultánea':'Parcial'}</span>{' '}{categoria.nombre}</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          {/* Tabs modo */}
          <div style={{display:'flex',borderRadius:10,overflow:'hidden',border:'1.5px solid var(--jordyn-border)',marginBottom:'1rem'}}>
            {[['nuevo','Crear nuevo vendedor'],['existente','Vendedor existente']].map(([k,l],i)=>(
              <button key={k} onClick={()=>{setModo(k);setNumInput('');setNumeros([]);}} style={{flex:1,padding:'9px 8px',border:'none',cursor:'pointer',fontSize:'0.8rem',fontWeight:600,background:modo===k?accent:'transparent',color:modo===k?'#fff':'var(--jordyn-muted)',borderRight:i===0?'1.5px solid var(--jordyn-border)':'none'}}>{l}</button>
            ))}
          </div>

          {/* Datos vendedor */}
          {modo==='nuevo'?(
            <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',flexWrap:'wrap'}}>
              <div style={{flex:'2 1 200px'}}>
                <label className="jd-label">NOMBRE COMPLETO *</label>
                <input className="jd-input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Juan Pérez" autoFocus />
                <div style={{fontSize:'0.67rem',color:'var(--jordyn-muted)',marginTop:3}}>Credenciales se generan automáticamente</div>
              </div>
              <div style={{flex:'1 1 130px'}}>
                <label className="jd-label">CÉDULA</label>
                <input className="jd-input" value={form.cedula} onChange={e=>setForm(p=>({...p,cedula:e.target.value}))} placeholder="Opcional" />
              </div>
            </div>
          ):(
            <div style={{marginBottom:'1rem'}}>
              <label className="jd-label">VENDEDOR *</label>
              <select className="jd-input" value={vendedorSel} onChange={e=>{setVendedorSel(e.target.value);setNumInput('');setNumeros([]);}}>
                <option value="">— Seleccionar —</option>
                {vendedoresDisponibles.map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Info reglas */}
          <div className="jd-alert jd-alert-info mb-3" style={{fontSize:'0.75rem',lineHeight:1.6}}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ?<><strong>Simultánea:</strong> Puedes agregar el mismo número <strong>dos veces</strong> para asignar Serie A y Serie B. Al escribir el número verás quién lo tiene actualmente.</>
              :<><strong>Parcial:</strong> Cada número pertenece a un solo vendedor.</>
            }
          </div>

          {/* Panel números */}
          <div style={{background:'var(--jordyn-bg2)',border:`2px solid ${accent}25`,borderRadius:14,padding:'1rem',marginBottom:'1rem'}}>
            <div style={{fontWeight:700,fontSize:'0.85rem',color:accent,marginBottom:'0.75rem'}}><i className="bi bi-hash me-1"></i>Números a asignar</div>
            <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1.5px solid var(--jordyn-border)',marginBottom:'0.75rem'}}>
              {[['manual','Manual'],['rango','Rango']].map(([k,l],i)=>(
                <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'7px 6px',border:'none',cursor:'pointer',fontSize:'0.75rem',fontWeight:600,background:tab===k?accent:'transparent',color:tab===k?'#fff':'var(--jordyn-muted)',borderRight:i===0?'1.5px solid var(--jordyn-border)':'none'}}>{l}</button>
              ))}
            </div>

            {tab==='manual'&&(
              <div style={{display:'flex',gap:'0.5rem',alignItems:'flex-start',flexWrap:'wrap',marginBottom:'0.5rem'}}>
                <div>
                  <input className="jd-input" value={numInput}
                    onChange={e=>setNumInput(e.target.value.replace(/\D/g,'').slice(0,3))}
                    onKeyDown={e=>e.key==='Enter'&&agregarNumeroManual()}
                    placeholder="000-999"
                    style={{maxWidth:110,textAlign:'center',fontWeight:700,letterSpacing:2,
                      borderColor:numInput.length===3
                        ?(modo==='existente'
                          ?(infoExistente?(infoExistente.disponible?accent:'#ffaaaa'):undefined)
                          :(infoBuscar?(infoBuscar.hay_espacio?accent:(vecesEnLista<2?'#f0a500':'#ffaaaa')):'undefined'))
                        :undefined}}
                    maxLength={3} />
                  {/* Indicador en tiempo real */}
                  <div style={{marginTop:5,minHeight:52}}>
                    {(validandoExistente||buscando)
                      ?<span className="jd-spinner" style={{width:12,height:12}}></span>
                      :numInput.length===3
                        ?(modo==='existente'&&infoExistente
                          ?<SerieBadge info={infoExistente} />
                          :modo==='nuevo'&&infoBuscar
                            ?<div>
                                <BuscarNumeroBadge info={infoBuscar} esSim={esSim} />
                                {esSim&&vecesEnLista===1&&(
                                  <div style={{fontSize:'0.62rem',color:'#e91e8c',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
                                    <i className="bi bi-info-circle"></i>
                                    Ya en lista una vez → esta segunda vez asignará Serie B
                                  </div>
                                )}
                              </div>
                            :modo==='nuevo'
                              ?<span style={{fontSize:'0.63rem',color:'var(--jordyn-muted)'}}>Buscando...</span>
                              :null
                          )
                        :null
                    }
                  </div>
                </div>
                <button className="btn-jordyn" onClick={agregarNumeroManual}
                  disabled={modo==='existente'?(infoExistente&&!infoExistente.disponible)||!NUM_RE.test(pad3(parseInt(numInput)||0)):!NUM_RE.test(pad3(parseInt(numInput)||0))||(vecesEnLista>=2)||(!esSim&&vecesEnLista>=1)}
                  style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,height:44}}>
                  <i className="bi bi-plus-lg me-1"></i>
                  {esSim&&vecesEnLista===1?'Agregar Serie B':'Agregar'}
                </button>
              </div>
            )}

            {tab==='rango'&&(
              <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
                <input className="jd-input" value={rangoIni} onChange={e=>setRangoIni(e.target.value)} placeholder="Desde" style={{maxWidth:80}} maxLength={3} />
                <span style={{color:'var(--jordyn-muted)'}}>—</span>
                <input className="jd-input" value={rangoFin} onChange={e=>setRangoFin(e.target.value)} placeholder="Hasta" style={{maxWidth:80}} maxLength={3} />
                <button className="btn-jordyn" onClick={agregarRango} style={{background:`linear-gradient(135deg,${accent},${accent}cc)`}}>
                  <i className="bi bi-plus-lg me-1"></i>Agregar rango
                </button>
              </div>
            )}

            {/* Lista de numeros con indicador de serie doble */}
            {numeros.length>0&&(
              <div style={{marginTop:'0.85rem'}}>
                <div style={{fontSize:'0.65rem',fontWeight:700,color:'var(--jordyn-muted)',textTransform:'uppercase',marginBottom:5}}>
                  Lista ({numeros.length}{esSim?' — mismo número dos veces = A+B':''})
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {/* Agrupar para mostrar badges A/B */}
                  {Object.entries(
                    numeros.reduce((acc,n,idx)=>{
                      if(!acc[n]) acc[n]={num:n,indices:[]};
                      acc[n].indices.push(idx);
                      return acc;
                    },{})
                  ).map(([num,{indices}])=>(
                    <div key={num} style={{display:'flex',alignItems:'center',gap:2}}>
                      <span style={{padding:'3px 8px',borderRadius:6,fontWeight:800,fontSize:'0.72rem',background:`${accent}12`,border:`1.5px solid ${accent}30`,color:accent}}>{num}</span>
                      {esSim&&indices.length===2&&(
                        <span style={{fontSize:'0.6rem',fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#4361ee,#e91e8c)',borderRadius:4,padding:'1px 5px'}}>A+B</span>
                      )}
                      {esSim&&indices.length===1&&(
                        <span style={{fontSize:'0.6rem',fontWeight:700,color:'#4361ee',background:'#f0f5ff',border:'1px solid #4361ee30',borderRadius:4,padding:'1px 5px'}}>A</span>
                      )}
                      {/* Botón quitar el ultimo de ese numero */}
                      <button onClick={()=>{
                        const lastIdx=numeros.map((n,i)=>n===num?i:-1).filter(i=>i>=0).pop();
                        setNumeros(p=>p.filter((_,i)=>i!==lastIdx));
                      }} style={{background:'none',border:'none',color:'#e63946',cursor:'pointer',padding:0,fontSize:'0.65rem'}}>
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!numeros.length&&<div style={{fontSize:'0.75rem',color:'var(--jordyn-muted)',fontStyle:'italic',marginTop:'0.5rem'}}>Opcional — puedes agregar números después.</div>}
          </div>

          <div className="d-flex gap-2">
            <button className="btn-jordyn w-100" onClick={confirmar} disabled={saving} style={{background:`linear-gradient(135deg,${accent},${accent}cc)`}}>
              {saving?<><span className="jd-spinner" style={{width:15,height:15}}></span> Creando...</>
                :<><i className="bi bi-person-check-fill me-1"></i>
                  {modo==='nuevo'?'Crear vendedor':'Vincular vendedor'}
                  {numeros.length>0?` + ${numeros.length} número${numeros.length!==1?'s':''}`:''}</>
              }
            </button>
            <button className="btn-jordyn-outline" onClick={onClose} style={{flexShrink:0,padding:'0 18px'}}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModalGestionarCategoria ──────────────────────────────────────
function ModalGestionarCategoria({ categoria, onClose, onSaved }) {
  const [resumen,setResumen]         = useState({vendedores:[]});
  const [todosVend,setTodosVend]     = useState([]);
  const [loading,setLoading]         = useState(true);
  const [modalNums,setModalNums]     = useState(null);
  const [modalEditar,setModalEditar] = useState(null);
  const [modalAgregar,setModalAgregar]=useState(false);
  const [confirmQuitar,setConfirmQuitar]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [busq,setBusq]               = useState('');

  const esSim  = categoria.tipo==='simultanea';
  const accent = esSim?'#e91e8c':'#4361ee';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rR,vR] = await Promise.all([
        API.get(`/categorias-globales/${categoria.id}/vendedores-resumen`),
        API.get('/vendedores'),
      ]);
      setResumen(rR.data); setTodosVend(vR.data);
    } catch { toast.error('Error cargando'); }
    finally { setLoading(false); }
  },[categoria.id]);

  useEffect(()=>{ cargar(); },[cargar]);

  const idsEnCat = new Set(resumen.vendedores.map(v=>String(v.vendedor_id)));
  const vendDisp = todosVend.filter(v=>v.activo&&!idsEnCat.has(String(v.id)));

  const quitarDeCategoria = async vendedor_id => {
    try {
      await API.delete(`/categorias-globales/${categoria.id}/vendedores/${vendedor_id}`);
      toast.info('Vendedor removido'); setConfirmQuitar(null); await cargar(); onSaved?.();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); }
  };

  const eliminarDelSistema = async () => {
    try {
      await API.delete(`/vendedores/${confirmDelete.id}`);
      toast.success('Vendedor eliminado'); setConfirmDelete(null); await cargar(); onSaved?.();
    } catch(err) {
      const msg=err.response?.data?.error||'';
      if (msg.toLowerCase().includes('ventas')) setConfirmDelete(p=>({...p,tieneVentas:true}));
      else toast.error(msg||'Error');
    }
  };

  const desactivarVendedor = async () => {
    try {
      await API.put(`/vendedores/${confirmDelete.id}`,{activo:false});
      toast.info('Vendedor desactivado'); setConfirmDelete(null); await cargar(); onSaved?.();
    } catch { toast.error('Error'); }
  };

  const colorSerie=s=>s==='A'?'#4361ee':s==='B'?'#e91e8c':'#aaa';
  const bgSerie=s=>s==='A'?'#f0f5ff':s==='B'?'#fff0f5':'#f5f5f5';
  const vendFiltrados=resumen.vendedores.filter(v=>!busq||v.vendedor_nombre.toLowerCase().includes(busq.toLowerCase()));

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{...S.overlay,zIndex:10100}}>
      <div style={S.modal(980)}>
        <div style={S.header(`linear-gradient(135deg,${esSim?'#7b0050,#e91e8c':'#0a3d62,#0abfbc'})`)}>
          <div>
            <div style={{fontWeight:800,fontSize:'1rem',display:'flex',alignItems:'center',gap:8}}>
              <span style={S.tipoBadge(categoria.tipo)}>{esSim?'Simultánea':'Parcial'}</span>
              {categoria.nombre}
              {categoria.monto&&<span style={{opacity:0.8,fontSize:'0.8rem'}}>— {categoria.monto}</span>}
            </div>
            <div style={{fontSize:'0.72rem',opacity:0.85,marginTop:4}}>{resumen.vendedores.length} vendedor(es)</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><i className="bi bi-x-lg"></i></button>
        </div>
        <div style={S.body}>
          <div style={{background:'var(--jordyn-bg2)',border:`2px solid ${accent}30`,borderRadius:14,padding:'1rem',marginBottom:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:700,fontSize:'0.88rem',color:accent}}><i className="bi bi-person-plus-fill me-2"></i>Agregar vendedor</div>
            <button onClick={()=>setModalAgregar(true)} style={{background:accent,border:'none',color:'#fff',borderRadius:8,padding:'7px 16px',cursor:'pointer',fontSize:'0.8rem',fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
              <i className="bi bi-person-plus-fill"></i>Agregar
            </button>
          </div>
          <div className="jd-alert jd-alert-info mb-3" style={{fontSize:'0.75rem',lineHeight:1.6}}>
            <i className="bi bi-info-circle-fill me-2"></i>
            {esSim
              ?<><strong>Simultánea:</strong> Puedes asignar el mismo número en Serie A y Serie B. El mismo vendedor puede tener ambas series de un número.</>
              :<><strong>Parcial:</strong> Un número = un vendedor.</>
            }
          </div>
          <div style={{marginBottom:'0.85rem'}}>
            <input className="jd-input" value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar vendedor..." />
          </div>
          {loading?(
            <div className="d-flex justify-content-center py-4"><div className="jd-spinner" style={{width:36,height:36}}></div></div>
          ):resumen.vendedores.length===0?(
            <div className="jd-alert jd-alert-warning" style={{textAlign:'center',padding:'1.5rem'}}>
              <i className="bi bi-people-fill" style={{fontSize:'2rem',display:'block',marginBottom:8,opacity:0.4}}></i>
              Sin vendedores. Usa el botón de arriba para agregar el primero.
            </div>
          ):vendFiltrados.length===0?(
            <div className="jd-alert jd-alert-info" style={{fontSize:'0.82rem'}}>Sin resultados.</div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'0.7rem'}}>
              {vendFiltrados.map(vdata=>{
                const sinSerie=vdata.total_numeros-vdata.total_asignados;
                return (
                  <div key={vdata.vendedor_id} style={{border:`2px solid ${accent}25`,borderRadius:12,overflow:'hidden'}}>
                    <div style={{background:'var(--jordyn-bg2)',padding:'0.65rem 1rem',borderBottom:'1px solid var(--jordyn-border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:accent,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'0.9rem',flexShrink:0}}>
                          {vdata.vendedor_nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontWeight:800,fontSize:'0.88rem'}}>{vdata.vendedor_nombre}</div>
                          <div style={{fontSize:'0.67rem',color:'var(--jordyn-muted)',display:'flex',gap:8,flexWrap:'wrap',marginTop:2}}>
                            <span>{vdata.total_numeros} pool</span>
                            {esSim&&vdata.serie_a>0&&<span style={{color:'#4361ee'}}>A:{vdata.serie_a}</span>}
                            {esSim&&vdata.serie_b>0&&<span style={{color:'#e91e8c'}}>B:{vdata.serie_b}</span>}
                            {!esSim&&vdata.total_asignados>0&&<span style={{color:'#4361ee'}}>Asig:{vdata.total_asignados}</span>}
                            {sinSerie>0&&<span style={{color:'#f0a500'}}>Pend:{sinSerie}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        <button onClick={()=>setModalNums({id:vdata.vendedor_id,nombre:vdata.vendedor_nombre})} style={S.btnSm(`${accent}15`,accent,`${accent}40`)}><i className="bi bi-hash"></i> Números</button>
                        <button onClick={()=>setModalEditar({id:vdata.vendedor_id,nombre:vdata.vendedor_nombre,cedula:vdata.cedula||''})} style={S.btnSm('var(--jordyn-bg2)','var(--jordyn-muted)','var(--jordyn-border)')}><i className="bi bi-pencil-fill"></i> Editar</button>
                        <button onClick={()=>setConfirmQuitar({vendedor_id:vdata.vendedor_id,nombre:vdata.vendedor_nombre})} style={S.btnSm('#fff8e1','#b37700','#ffd16640')}><i className="bi bi-person-dash-fill"></i> Quitar</button>
                        <button onClick={()=>setConfirmDelete({id:vdata.vendedor_id,nombre:vdata.vendedor_nombre})} style={S.btnSm('#fff5f5','#e63946','#ffcccc')}><i className="bi bi-trash3-fill"></i></button>
                      </div>
                    </div>
                    <div style={{padding:'0.65rem 1rem'}}>
                      {!vdata.numeros?.length?(
                        <div style={{fontSize:'0.72rem',color:'var(--jordyn-muted)',fontStyle:'italic'}}>Sin números.</div>
                      ):esSim?(
                        [null,'A','B'].map(serie=>{
                          const nums=vdata.numeros.filter(n=>n.serie===serie);
                          if(!nums.length) return null;
                          const label=serie?`Serie ${serie}`:'Sin serie';
                          const color=colorSerie(serie);
                          return (
                            <div key={String(serie)} style={{marginBottom:'0.35rem',display:'flex',alignItems:'flex-start',gap:6,flexWrap:'wrap'}}>
                              <span style={{fontSize:'0.6rem',fontWeight:700,color,textTransform:'uppercase',flexShrink:0,paddingTop:2}}>{label} ({nums.length})</span>
                              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                                {nums.slice(0,15).map(n=><span key={`${n.numero}-${n.serie}`} style={{padding:'1px 6px',borderRadius:5,fontSize:'0.66rem',fontWeight:800,background:bgSerie(serie),border:`1px solid ${color}30`,color}}>{n.numero}</span>)}
                                {nums.length>15&&<span style={{fontSize:'0.62rem',color:'var(--jordyn-muted)',alignSelf:'center'}}>+{nums.length-15}</span>}
                              </div>
                            </div>
                          );
                        })
                      ):(
                        <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                          {vdata.numeros.slice(0,25).map(n=><span key={n.numero} style={{padding:'2px 7px',borderRadius:5,fontSize:'0.67rem',fontWeight:800,background:n.serie?'rgba(10,191,188,0.1)':'#f5f5f5',border:`1px solid ${n.serie?'rgba(10,191,188,0.3)':'#ddd'}`,color:n.serie?'var(--jordyn-primary)':'#aaa'}}>{n.numero}</span>)}
                          {vdata.numeros.length>25&&<span style={{fontSize:'0.62rem',color:'var(--jordyn-muted)',alignSelf:'center'}}>+{vdata.numeros.length-25}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modalAgregar&&<ModalCrearVendedorEnCategoria categoria={categoria} vendedoresDisponibles={vendDisp} onClose={()=>{setModalAgregar(false);}} onSaved={()=>{cargar();onSaved?.();}} />}
      {modalNums&&<ModalNumerosEnCategoria categoria={categoria} vendedor={modalNums} onClose={()=>setModalNums(null)} onSaved={()=>{cargar();onSaved?.();}} />}
      {modalEditar&&<ModalEditarVendedor vendedor={modalEditar} onClose={()=>setModalEditar(null)} onSaved={()=>{setModalEditar(null);cargar();onSaved?.();}} />}

      {confirmQuitar&&(
        <div onClick={e=>e.target===e.currentTarget&&setConfirmQuitar(null)} style={{...S.overlay,zIndex:10200}}>
          <div style={S.modal(440)}>
            <div style={S.header('linear-gradient(135deg,#b37700,#f0a500)')}><div style={{fontWeight:800}}>Quitar de esta categoría</div><button onClick={()=>setConfirmQuitar(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button></div>
            <div style={S.body}>
              <p style={{fontSize:'0.88rem',marginBottom:16,lineHeight:1.7}}>Quitar a <strong>"{confirmQuitar.nombre}"</strong> de <strong>"{categoria.nombre}"</strong>. Se eliminan sus números y series. <strong>El vendedor NO se elimina del sistema.</strong></p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn w-100" onClick={()=>quitarDeCategoria(confirmQuitar.vendedor_id)} style={{background:'linear-gradient(135deg,#b37700,#f0a500)'}}><i className="bi bi-person-dash-fill me-1"></i>Quitar</button>
                <button className="btn-jordyn-outline" onClick={()=>setConfirmQuitar(null)} style={{flexShrink:0,padding:'0 18px'}}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete&&(
        <div onClick={e=>e.target===e.currentTarget&&setConfirmDelete(null)} style={{...S.overlay,zIndex:10200}}>
          <div style={S.modal(440)}>
            <div style={S.header(confirmDelete.tieneVentas?'linear-gradient(135deg,#b37700,#f0a500)':'linear-gradient(135deg,#c0303a,#e63946)')}><div style={{fontWeight:800}}>{confirmDelete.tieneVentas?'Vendedor con ventas':'Eliminar del sistema'}</div><button onClick={()=>setConfirmDelete(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button></div>
            <div style={S.body}>
              {confirmDelete.tieneVentas?(
                <>
                  <div style={{background:'#fff8e1',border:'1.5px solid #ffd166',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:'0.82rem',color:'#7a5c00',lineHeight:1.6}}><strong>No se puede eliminar</strong> — tiene ventas.</div>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn w-100" onClick={desactivarVendedor} style={{background:'linear-gradient(135deg,#b37700,#f0a500)'}}><i className="bi bi-pause-circle me-1"></i>Desactivar</button>
                    <button className="btn-jordyn-outline" onClick={()=>setConfirmDelete(null)} style={{flexShrink:0,padding:'0 16px'}}>Cancelar</button>
                  </div>
                </>
              ):(
                <>
                  <p style={{fontSize:'0.88rem',marginBottom:16,lineHeight:1.7}}>Eliminar definitivamente a <strong>"{confirmDelete.nombre}"</strong>. No se puede deshacer.</p>
                  <div className="d-flex gap-2">
                    <button className="btn-jordyn-danger w-100" onClick={eliminarDelSistema}><i className="bi bi-trash3-fill me-1"></i>Eliminar</button>
                    <button className="btn-jordyn-outline" onClick={()=>setConfirmDelete(null)} style={{flexShrink:0,padding:'0 16px'}}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CategoriaCard ────────────────────────────────────────────────
function CategoriaCard({ cat, onEdit, onDelete, onSaved }) {
  const [verModal,setVerModal]=useState(false);
  const esSim=cat.tipo==='simultanea';
  const accent=esSim?'#e91e8c':'#4361ee';
  return (
    <>
      <div style={{border:`2px solid ${accent}25`,borderRadius:14,overflow:'hidden',background:'#fff',boxShadow:'0 2px 12px rgba(0,0,0,0.06)',transition:'box-shadow .2s,border-color .2s'}}
        onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 6px 24px ${accent}22`;e.currentTarget.style.borderColor=`${accent}55`;}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.06)';e.currentTarget.style.borderColor=`${accent}25`;}}>
        <div style={{height:4,background:`linear-gradient(90deg,${accent},${accent}88)`}} />
        <div style={{padding:'1rem 1rem 0.85rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div style={{flex:1,minWidth:0,paddingRight:8}}>
              <div style={{fontWeight:800,fontSize:'0.95rem',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat.nombre}</div>
              {cat.monto&&<div style={{fontSize:'0.72rem',color:'var(--jordyn-muted)',marginBottom:4}}>{cat.monto}</div>}
              <span style={S.tipoBadge(cat.tipo)}>{esSim?'Simultánea':'Parcial'}</span>
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <button onClick={()=>onEdit(cat)} style={{background:'var(--jordyn-bg2)',border:'1px solid var(--jordyn-border)',borderRadius:8,padding:'5px 9px',cursor:'pointer',fontSize:'0.78rem',color:'var(--jordyn-muted)'}}><i className="bi bi-pencil-fill"></i></button>
              <button onClick={()=>onDelete(cat)} style={{background:'#fff5f5',border:'1px solid #ffcccc',borderRadius:8,padding:'5px 9px',cursor:'pointer',fontSize:'0.78rem',color:'#e63946'}}><i className="bi bi-trash3-fill"></i></button>
            </div>
          </div>
          <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.8rem'}}>
            <span style={S.badge('var(--jordyn-primary)')}><i className="bi bi-people-fill"></i>{cat.total_vendedores||0} vendedores</span>
            <span style={S.badge('#2ecc71')}><i className="bi bi-hash"></i>{cat.total_numeros_definidos||0} números</span>
            {esSim&&<><span style={S.badge('#4361ee')}>A:{cat.numeros_serie_a||0}</span><span style={S.badge('#e91e8c')}>B:{cat.numeros_serie_b||0}</span></>}
          </div>
          {esSim&&(
            <div style={{marginBottom:'0.8rem'}}>
              {[{label:'A',val:cat.numeros_serie_a||0,color:'#4361ee'},{label:'B',val:cat.numeros_serie_b||0,color:'#e91e8c'}].map(({label,val,color})=>(
                <div key={label} style={{marginBottom:4}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.62rem',color:'var(--jordyn-muted)',marginBottom:2}}>
                    <span style={{fontWeight:700,color}}>Serie {label}</span><span>{val}/1000</span>
                  </div>
                  <div style={{height:5,borderRadius:4,background:'var(--jordyn-border)',overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:4,background:color,width:`${Math.min((val/1000)*100,100)}%`,transition:'width 0.4s'}} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {cat.descripcion&&<div style={{fontSize:'0.72rem',color:'var(--jordyn-muted)',marginBottom:'0.8rem',fontStyle:'italic',lineHeight:1.5}}>{cat.descripcion}</div>}
          <button className="btn-jordyn w-100" onClick={()=>setVerModal(true)} style={{fontSize:'0.8rem',background:`linear-gradient(135deg,${accent},${accent}cc)`}}>
            <i className="bi bi-people-fill me-1"></i>Gestionar vendedores{cat.total_vendedores>0?` (${cat.total_vendedores})`:''}
          </button>
        </div>
      </div>
      {verModal&&<ModalGestionarCategoria categoria={cat} onClose={()=>setVerModal(false)} onSaved={onSaved} />}
    </>
  );
}

// ── Componente principal ─────────────────────────────────────────
export default function GestionVendedores() {
  const [categorias,setCategorias]   = useState([]);
  const [loadingC,setLoadingC]       = useState(true);
  const [modalCrearCat,setModalCrearCat]=useState(false);
  const [editCat,setEditCat]         = useState(null);
  const [confirmDelCat,setConfirmDelCat]=useState(null);
  const [filtroTipo,setFiltroTipo]   = useState('todos');
  const [busqCat,setBusqCat]         = useState('');

  const cargarCategorias = useCallback(async () => {
    setLoadingC(true);
    try { const r=await API.get('/categorias-globales'); setCategorias(r.data); }
    catch { toast.error('Error cargando categorías'); }
    finally { setLoadingC(false); }
  },[]);

  useEffect(()=>{ cargarCategorias(); },[cargarCategorias]);

  const eliminarCategoria = async cat => {
    try {
      await API.delete(`/categorias-globales/${cat.id}`);
      toast.success('Categoría eliminada'); setConfirmDelCat(null); cargarCategorias();
    } catch(err) { toast.error(err.response?.data?.error||'Error'); setConfirmDelCat(null); }
  };

  const categoriasFiltradas = categorias.filter(c=>{
    const okTipo=filtroTipo==='todos'||c.tipo===filtroTipo;
    const okBusq=!busqCat||c.nombre.toLowerCase().includes(busqCat.toLowerCase());
    return okTipo&&okBusq;
  });

  return (
    <Layout>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem',flexWrap:'wrap',gap:'0.75rem'}}>
        <div>
          <h1 style={{fontSize:'1.25rem',fontWeight:800,margin:0,display:'flex',alignItems:'center',gap:8}}>
            <i className="bi bi-tags-fill" style={{color:'var(--jordyn-primary)'}}></i>Categorías
          </h1>
          <p style={{fontSize:'0.75rem',color:'var(--jordyn-muted)',margin:'2px 0 0'}}>{categorias.length} categoría(s)</p>
        </div>
        <button className="btn-jordyn" onClick={()=>setModalCrearCat(true)} style={{fontSize:'0.82rem'}}>
          <i className="bi bi-plus-lg me-1"></i>Nueva categoría
        </button>
      </div>

      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.1rem',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',borderRadius:20,overflow:'hidden',border:'1.5px solid var(--jordyn-border)'}}>
          {[['todos','Todas'],['parcial','Parcial'],['simultanea','Simultánea']].map(([k,l])=>(
            <button key={k} onClick={()=>setFiltroTipo(k)} style={S.pill(filtroTipo===k)}>{l}</button>
          ))}
        </div>
        <input className="jd-input" style={{flex:'1 1 200px',maxWidth:320}} value={busqCat} onChange={e=>setBusqCat(e.target.value)} placeholder="Buscar categoría..." />
      </div>

      {loadingC?(
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{width:44,height:44}}></div></div>
      ):categoriasFiltradas.length===0?(
        <div className="jd-alert jd-alert-warning" style={{textAlign:'center',padding:'2.5rem'}}>
          {categorias.length===0
            ?<><i className="bi bi-tags" style={{fontSize:'2.5rem',display:'block',marginBottom:10,opacity:0.4}}></i>Sin categorías. Crea la primera.</>
            :'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))',gap:'1rem'}}>
          {categoriasFiltradas.map(cat=>(
            <CategoriaCard key={cat.id} cat={cat} onEdit={c=>setEditCat(c)} onDelete={c=>setConfirmDelCat(c)} onSaved={cargarCategorias} />
          ))}
        </div>
      )}

      {modalCrearCat&&<ModalCrearCategoria onClose={()=>setModalCrearCat(false)} onSaved={cargarCategorias} />}
      {editCat&&<ModalCrearCategoria categoria={editCat} onClose={()=>setEditCat(null)} onSaved={cargarCategorias} />}

      {confirmDelCat&&(
        <div onClick={e=>e.target===e.currentTarget&&setConfirmDelCat(null)} style={S.overlay}>
          <div style={S.modal(420)}>
            <div style={S.header('linear-gradient(135deg,#c0303a,#e63946)')}><div style={{fontWeight:800}}>Eliminar categoría</div><button onClick={()=>setConfirmDelCat(null)} style={S.closeBtn}><i className="bi bi-x-lg"></i></button></div>
            <div style={S.body}>
              <p style={{fontSize:'0.88rem',marginBottom:16,lineHeight:1.7}}>Eliminar <strong>"{confirmDelCat.nombre}"</strong>. Se eliminarán todos los vendedores y números. <strong>Los vendedores no se eliminan del sistema.</strong></p>
              <div className="d-flex gap-2">
                <button className="btn-jordyn-danger w-100" onClick={()=>eliminarCategoria(confirmDelCat)}><i className="bi bi-trash3-fill me-1"></i>Eliminar</button>
                <button className="btn-jordyn-outline" onClick={()=>setConfirmDelCat(null)} style={{flexShrink:0,padding:'0 18px'}}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}