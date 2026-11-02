// ============================================================
//  CampoUbicacion.jsx — Ciudad o ubicación del vendedor
//  Se escribe libre y sugiere las que ya existen, para que todos
//  los de Rubio queden juntos aunque lo escriban distinto.
// ============================================================
import React, { useEffect, useId, useState } from 'react';
import API from '../services/api';

export function useUbicaciones() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    API.get('/vendedores/ubicaciones').then((r) => setLista(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  return lista;
}

export default function CampoUbicacion({ valor, onCambio, onSalir, style, etiqueta = 'Ubicación del vendedor' }) {
  const lista = useUbicaciones();
  const idLista = useId();
  return (
    <>
      <input className="jd-input" list={idLista} value={valor} maxLength={80} aria-label={etiqueta} style={style}
        onChange={(e) => onCambio(e.target.value)} onBlur={onSalir} onKeyDown={(e) => { if (onSalir && e.key === 'Enter') e.currentTarget.blur(); }} placeholder="Ej: Rubio" autoComplete="off" />
      <datalist id={idLista}>
        {lista.map((u) => <option key={u.ubicacion} value={u.ubicacion} />)}
      </datalist>
    </>
  );
}
