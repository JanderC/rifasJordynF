// components/ImagenRifa.jsx
// ── Componente para subir/ver/eliminar imagen de una rifa ─
import React, { useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://rifasjordynb-production.up.railway.app';

export default function ImagenRifa({ rifaId, imagenActual, onImagenActualizada }) {
  const [preview, setPreview]     = useState(imagenActual || null);
  const [archivo, setArchivo]     = useState(null);
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState('');

  // ── Previsualizar antes de subir ──────────────────────
  const handleSeleccionar = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes (jpg, png, webp)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB');
      return;
    }

    setError('');
    setArchivo(file);
    setPreview(URL.createObjectURL(file));  // vista previa local
  };

  // ── Subir imagen al backend ───────────────────────────
  const handleSubir = async () => {
    if (!archivo) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('imagen', archivo);  // debe llamarse "imagen"

    setCargando(true);
    setError('');
    try {
      const { data } = await axios.post(
        `${API}/api/upload/rifa/${rifaId}/imagen`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setPreview(data.imagen_url);
      setArchivo(null);
      if (onImagenActualizada) onImagenActualizada(data.imagen_url);
    } catch (err) {
      setError(err.response?.data?.error || 'Error subiendo imagen');
    } finally {
      setCargando(false);
    }
  };

  // ── Eliminar imagen ───────────────────────────────────
  const handleEliminar = async () => {
    if (!window.confirm('¿Eliminar imagen de esta rifa?')) return;

    const token = localStorage.getItem('token');
    setCargando(true);
    try {
      await axios.delete(`${API}/api/upload/rifa/${rifaId}/imagen`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPreview(null);
      setArchivo(null);
      if (onImagenActualizada) onImagenActualizada(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando imagen');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
        Imagen de la Rifa
      </label>

      {/* Previsualización */}
      {preview && (
        <div style={{ marginBottom: 10, position: 'relative', display: 'inline-block' }}>
          <img
            src={preview}
            alt="Imagen rifa"
            style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8, objectFit: 'cover', border: '1px solid #ddd' }}
          />
          <button
            onClick={handleEliminar}
            disabled={cargando}
            style={{
              position: 'absolute', top: 4, right: 4,
              background: 'rgba(220,53,69,0.85)', color: '#fff',
              border: 'none', borderRadius: '50%', width: 28, height: 28,
              cursor: 'pointer', fontWeight: 'bold', fontSize: 16,
            }}
            title="Eliminar imagen"
          >
            ×
          </button>
        </div>
      )}

      {/* Selector de archivo */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleSeleccionar}
          disabled={cargando}
          className="form-control"
          style={{ maxWidth: 300 }}
        />
        {archivo && (
          <button
            onClick={handleSubir}
            disabled={cargando}
            className="btn btn-primary btn-sm"
          >
            {cargando ? 'Subiendo…' : '⬆ Subir imagen'}
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger mt-2 py-1" style={{ fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Mostrar URL pública si ya está guardada */}
      {preview && !archivo && (
        <small className="text-muted d-block mt-1">
          URL pública:{' '}
          <a href={preview} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
            {preview}
          </a>
        </small>
      )}
    </div>
  );
}