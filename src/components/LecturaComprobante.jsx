// ============================================================
//  LecturaComprobante.jsx — Datos de un comprobante leídos con IA
//  Al abrir un comprobante se piden sus datos: si el bot ya los leyó se
//  muestran; si no (compras por la página) se leen en ese momento y quedan
//  guardados. También avisa si la misma referencia ya salió en otro pago.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import API from '../services/api';

const chip = { background:'var(--jordyn-bg2)', borderRadius:20, padding:'2px 9px' };
const fmtDia = f => f ? new Date(f).toLocaleDateString('es-CO', { day:'2-digit', month:'short', timeZone:'America/Caracas' }) : '';

export function DatosLeidos({ datos }) {
  if (!datos || datos.es_comprobante === false || !(datos.monto != null || datos.referencia || datos.banco)) return null;
  return (
    <>
      {datos.monto != null && <span style={{ ...chip, fontWeight:700 }}>{datos.monto} {datos.moneda || ''}</span>}
      {datos.referencia && <span style={chip}>Ref. {datos.referencia}</span>}
      {datos.banco && <span style={chip}>{datos.banco}</span>}
      {datos.fecha && <span style={chip}>{datos.fecha}</span>}
      {datos.titular && <span style={chip}>{datos.titular}</span>}
      {Number(datos.diferencia) < 0 && <span style={{ background:'rgba(230,57,70,.1)', color:'#c62e3a', borderRadius:20, padding:'2px 9px', fontWeight:700 }}>⚠️ Faltan {Math.abs(datos.diferencia)}</span>}
    </>
  );
}

export function AvisoRepetido({ repetidos }) {
  if (!repetidos?.length) return null;
  return (
    <div style={{ background:'rgba(230,57,70,.08)', border:'1.5px solid rgba(230,57,70,.35)', color:'#a11d2a', borderRadius:10, padding:'8px 11px', marginBottom:8, fontSize:'.76rem', lineHeight:1.5 }}>
      <b><i className="bi bi-exclamation-triangle-fill me-1"></i>Esta referencia ya aparece en {repetidos.length === 1 ? 'otro pago' : `otros ${repetidos.length} pagos`}:</b>
      {repetidos.map(r => (
        <div key={`${r.tipo}-${r.id}`}>
          · {r.nombre || 'Sin nombre'} — {r.rifa}{r.numeros?.length ? ` · n.º ${r.numeros.join(', ')}` : ''} · {fmtDia(r.fecha)} · {r.tipo === 'abono' ? `abono ${r.estado}` : r.estado}
        </div>
      ))}
      <div style={{ marginTop:3 }}>Revisa que no sea el mismo comprobante usado dos veces.</div>
    </div>
  );
}

export default function LecturaComprobante({ tipo = 'reserva', id, datos: iniciales = null }) {
  const [datos, setDatos]         = useState(iniciales);
  const [repetidos, setRepetidos] = useState([]);
  const [aviso, setAviso]         = useState(null);
  const [cargando, setCargando]   = useState(false);

  const leer = useCallback(async (forzar = false) => {
    if (!id) return;
    setCargando(true); setAviso(null);
    try {
      const r = await API.post('/comprobantes/leer', { tipo, id, forzar });
      setDatos(r.data.datos || null);
      setRepetidos(r.data.repetidos || []);
      setAviso(r.data.aviso || null);
    } catch (e) { setAviso(e.response?.data?.error || 'No se pudieron leer los datos del comprobante'); }
    finally { setCargando(false); }
  }, [tipo, id]);

  useEffect(() => { leer(false); }, [leer]);

  const hayDatos = datos && datos.es_comprobante !== false && (datos.monto != null || datos.referencia || datos.banco);
  return (
    <>
      <AvisoRepetido repetidos={repetidos} />
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:8, fontSize:'.72rem' }}>
        <span style={{ fontWeight:700, color:'var(--jordyn-muted)' }}><i className="bi bi-stars me-1" style={{ color:'var(--jordyn-primary)' }}></i>Leído por IA:</span>
        {cargando ? <span style={{ color:'var(--jordyn-muted)' }}><span className="jd-spinner" style={{ width:12, height:12, borderWidth:2, display:'inline-block', marginRight:5, verticalAlign:'middle' }}></span>leyendo el comprobante…</span>
          : hayDatos ? <DatosLeidos datos={datos} />
          : datos?.es_comprobante === false ? <span style={{ color:'#c62e3a', fontWeight:700 }}>la imagen no parece un comprobante de pago</span>
          : <span style={{ color:'var(--jordyn-muted)' }}>{aviso || 'sin datos'}</span>}
        {!cargando && (
          <button type="button" onClick={() => leer(true)} title="Volver a leer la imagen con la IA"
            style={{ border:'none', background:'none', color:'var(--jordyn-primary)', cursor:'pointer', fontSize:'.7rem', fontWeight:700, padding:0 }}>
            <i className="bi bi-arrow-clockwise me-1"></i>Leer de nuevo
          </button>
        )}
      </div>
      {!cargando && hayDatos && aviso && <div style={{ fontSize:'.68rem', color:'var(--jordyn-muted)', marginBottom:8 }}>{aviso}</div>}
    </>
  );
}
