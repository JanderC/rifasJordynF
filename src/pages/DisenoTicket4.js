// ══════════════════════════════════════════════════════════════
//   pages/DisenoTicket4.js
//   Editor del BOLETO DE 4 CIFRAS (modelo aparte del boleto clásico)
//
//     /boleto-4-cifras/nueva   → crear una plantilla de 4 cifras
//     /boleto-4-cifras/:id     → editar una existente
//
//   Se guarda como una plantilla más (ticket_templates) con design.modelo = 'cuatro',
//   y solo se ofrece en las rifas de cuatro cifras.
// ══════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { toast } from 'react-toastify';
import Ticket4Cifras, { DEFAULT_DESIGN_4, TEMAS_4, ANCHO_4, ALTO_4 } from '../components/Ticket4Cifras';
import { invalidarCachePlantillas } from '../utils/ticketImageHelper';

const DEMO_RIFA = {
  premio: 'Corsa año 2.001', premio_segundo: '1.000.000 de pesos', premio_tercero: '', precio: 60000,
  fecha_sorteo: '2026-11-14', hora_sorteo: '22:10:00', loteria_ref: 'Lotería del Táchira', cifras: 4,
};

const TEXTOS = [
  ['brandText', 'Título', 'GRAN RIFA', 22],
  ['sloganTop', 'Frase bajo el título', 'RESUELVE TU SEMANA', 34],
  ['premioLabel', 'Rótulo del premio', 'PREMIO MAYOR', 24],
  ['fechaPrefix', 'Rótulo de la fecha', 'JUEGA EL', 14],
  ['valorSufijo', 'Moneda del valor', 'PESOS', 10],
  ['motivacionalText', 'Frase del pie', '¡Cuatro cifras, un solo ganador!', 60],
  ['caducaText', 'Caducidad', 'Caduca a los 8 días', 34],
  ['footerText', 'Letra pequeña', 'Conserve este boleto…', 70],
  ['talonText', 'Texto del talón', 'BOLETO SIN CANCELAR NO JUEGA', 44],
  ['loteriaText', 'Lotería (si la rifa no tiene una cargada)', 'Ej. Lotería del Táchira', 40],
];
const OPCIONES = [
  ['mostrarTalon', 'Talón', 'La parte izquierda que se queda el vendedor, con espacio para nombre y teléfono.'],
  ['mostrarValor', 'Valor del boleto', 'El precio del número.'],
  ['mostrarPremiosExtra', '2.º y 3.er premio', 'Salen bajo el premio mayor si la rifa los tiene.'],
  ['mostrarPosiciones', 'Millar · centena · decena · unidad', 'El nombre de cada cifra bajo su ficha.'],
];
const COLORES = [['acento', 'Color de realce'], ['fondo1', 'Fondo (inicio)'], ['fondo2', 'Fondo (final)']];

function Tarjeta({ titulo, icono, children }) {
  return (
    <div className="jd-card" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ fontWeight: 800, fontSize: '.86rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className={`bi ${icono}`} style={{ color: 'var(--jordyn-primary)' }}></i>{titulo}
      </div>
      {children}
    </div>
  );
}

export default function DisenoTicket4() {
  const { id } = useParams();
  const nav = useNavigate();
  const [nombre, setNombre]           = useState('Boleto 4 cifras');
  const [descripcion, setDescripcion] = useState('');
  const [design, setDesign]           = useState(DEFAULT_DESIGN_4);
  const [numero, setNumero]           = useState('0457');
  const [loading, setLoading]         = useState(!!id);
  const [saving, setSaving]           = useState(false);
  const [ancho, setAncho]             = useState(0);
  const caja = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    API.get(`/ticket-templates/${id}`)
      .then((r) => {
        if (r.data?.design?.modelo !== 'cuatro') { nav(`/plantillas/${id}`, { replace: true }); return; }   // es del modelo clásico
        setNombre(r.data.nombre || ''); setDescripcion(r.data.descripcion || '');
        setDesign({ ...DEFAULT_DESIGN_4, ...r.data.design });
      })
      .catch(() => { toast.error('No se pudo cargar la plantilla'); nav('/plantillas'); })
      .finally(() => setLoading(false));
  }, [id, nav]);

  useEffect(() => {
    if (!caja.current) return undefined;
    const medir = () => setAncho(caja.current?.clientWidth || 0);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, [loading]);

  const set = (k, v) => setDesign((d) => ({ ...d, [k]: v }));
  const tema = TEMAS_4[design.tema] || TEMAS_4.esmeralda;
  const setColor = (k, v) => setDesign((d) => ({ ...d, colores: { ...(d.colores || {}), [k]: v } }));

  const elegirLogo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('El archivo debe ser una imagen'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('La imagen pesa más de 3 MB'); return; }
    const lector = new FileReader();
    lector.onload = () => set('logo', lector.result);   // al guardar, el servidor la sube y deja la URL
    lector.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Ponle un nombre a la plantilla'); return; }
    setSaving(true);
    try {
      const body = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, is_default: false,
        design: { ...design, modelo: 'cuatro', ticketWidth: ANCHO_4, ticketHeight: ALTO_4 } };
      if (id) await API.put(`/ticket-templates/${id}`, body); else await API.post('/ticket-templates', body);
      invalidarCachePlantillas();
      toast.success('✅ Boleto de 4 cifras guardado');
      nav('/plantillas');
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const escala = ancho ? Math.min(1, ancho / ANCHO_4) : 0;

  return (
    <Layout title="BOLETO DE 4 CIFRAS">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <button className="btn-jordyn-outline" onClick={() => nav('/plantillas')} style={{ fontSize: '.8rem' }}>
          <i className="bi bi-arrow-left me-1"></i>Plantillas
        </button>
        <button className="btn-jordyn" onClick={guardar} disabled={saving || loading}>
          {saving ? 'Guardando…' : <><i className="bi bi-floppy-fill me-1"></i>Guardar boleto</>}
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center mt-5"><div className="jd-spinner" style={{ width: 40, height: 40 }}></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Vista previa */}
          <div className="jd-card" style={{ padding: '1rem', position: 'sticky', top: 8, zIndex: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontSize: '.78rem', color: 'var(--jordyn-muted)' }}>
                <i className="bi bi-eye-fill me-1" style={{ color: 'var(--jordyn-primary)' }}></i>
                Así sale el boleto. El premio, la fecha, la lotería y el valor se toman de cada rifa.
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.74rem', fontWeight: 700, color: 'var(--jordyn-muted)', margin: 0 }}>
                Número de ejemplo
                <input className="jd-input" value={numero} maxLength={4} inputMode="numeric"
                  onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{ width: 86, textAlign: 'center', fontWeight: 800, letterSpacing: 3 }} />
              </label>
            </div>
            <div ref={caja} style={{ background: '#cfd4d0', borderRadius: 10, padding: 0, overflow: 'hidden', height: escala ? ALTO_4 * escala : 200, position: 'relative' }}>
              {escala > 0 && (
                <div style={{ position: 'absolute', left: '50%', top: 0, width: ANCHO_4, height: ALTO_4, marginLeft: -(ANCHO_4 * escala) / 2, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
                  <Ticket4Cifras r={DEMO_RIFA} numero={numero || '0'} design={design} />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>

            <Tarjeta titulo="Plantilla" icono="bi-collection-fill">
              <label className="jd-label">NOMBRE *</label>
              <input className="jd-input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Ej. Boleto 4 cifras verde" />
              <label className="jd-label" style={{ marginTop: 10 }}>DESCRIPCIÓN</label>
              <input className="jd-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={160} placeholder="Opcional" />
              <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 8 }}>
                Esta plantilla solo aparece al crear o editar rifas de <b>4 cifras</b>.
              </div>
            </Tarjeta>

            <Tarjeta titulo="Tema de color" icono="bi-palette-fill">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
                {Object.entries(TEMAS_4).map(([k, t]) => {
                  const sel = design.tema === k;
                  return (
                    <button key={k} type="button" aria-pressed={sel} onClick={() => setDesign((d) => ({ ...d, tema: k, colores: {} }))}
                      style={{ border: `2px solid ${sel ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, borderRadius: 10, padding: 6, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ height: 34, borderRadius: 6, background: `linear-gradient(135deg, ${t.fondo1}, ${t.fondo2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, border: '1px solid rgba(0,0,0,.08)' }}>
                        {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 11, height: 16, borderRadius: 3, background: t.ficha1, border: `1.5px solid ${t.acento}` }} />)}
                      </div>
                      <div style={{ fontSize: '.68rem', fontWeight: 700, marginTop: 5, color: 'var(--jordyn-text)' }}>{t.nombre}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                {COLORES.map(([k, etiqueta]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.7rem', fontWeight: 700, color: 'var(--jordyn-muted)', margin: 0 }}>
                    <input type="color" value={design.colores?.[k] || tema[k]} onChange={(e) => setColor(k, e.target.value)}
                      style={{ width: 32, height: 32, padding: 2, border: '1.5px solid var(--jordyn-border)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
                    {etiqueta}
                  </label>
                ))}
                {Object.keys(design.colores || {}).length > 0 && (
                  <button type="button" onClick={() => set('colores', {})} style={{ border: 'none', background: 'none', color: 'var(--jordyn-primary)', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer' }}>
                    <i className="bi bi-arrow-counterclockwise me-1"></i>Volver al tema
                  </button>
                )}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Las cuatro cifras" icono="bi-123">
              <div style={{ display: 'flex', gap: 8 }}>
                {[['fichas', 'Fichas', 'Tarjetas como las de un marcador'], ['bolas', 'Bolas', 'Bolas de lotería']].map(([k, t, d]) => {
                  const sel = (design.estiloDigitos || 'fichas') === k;
                  return (
                    <button key={k} type="button" aria-pressed={sel} onClick={() => set('estiloDigitos', k)}
                      style={{ flex: 1, textAlign: 'left', border: `2px solid ${sel ? 'var(--jordyn-primary)' : 'var(--jordyn-border)'}`, background: sel ? 'rgba(10,191,188,.08)' : '#fff', borderRadius: 10, padding: '9px 11px', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 800, fontSize: '.82rem', color: sel ? 'var(--jordyn-primary)' : 'var(--jordyn-text)' }}>{t}</div>
                      <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)' }}>{d}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 12 }}>
                {OPCIONES.map(([k, t, d]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '6px 0', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={design[k] !== false} onChange={(e) => set(k, e.target.checked)} style={{ width: 17, height: 17, marginTop: 2, accentColor: 'var(--jordyn-primary)' }} />
                    <span><b style={{ fontSize: '.8rem' }}>{t}</b><br /><span style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)' }}>{d}</span></span>
                  </label>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Logo" icono="bi-image-fill">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 110, height: 54, borderRadius: 8, background: `linear-gradient(135deg, ${design.colores?.fondo1 || tema.fondo1}, ${design.colores?.fondo2 || tema.fondo2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--jordyn-border)' }}>
                  {design.logo ? <img src={design.logo} alt="Logo" style={{ maxHeight: 44, maxWidth: 96, objectFit: 'contain' }} /> : <span style={{ fontSize: '.66rem', color: tema.suave }}>Sin logo</span>}
                </div>
                <button type="button" className="btn-jordyn-outline" onClick={() => fileRef.current?.click()} style={{ fontSize: '.78rem' }}>
                  <i className="bi bi-upload me-1"></i>{design.logo ? 'Cambiar' : 'Subir logo'}
                </button>
                {design.logo && (
                  <button type="button" onClick={() => set('logo', null)} style={{ border: 'none', background: 'none', color: 'var(--jordyn-red)', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>
                    <i className="bi bi-trash3 me-1"></i>Quitar
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { elegirLogo(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div style={{ fontSize: '.68rem', color: 'var(--jordyn-muted)', marginTop: 8 }}>Va a la izquierda del título. Mejor una imagen PNG con fondo transparente.</div>
            </Tarjeta>

            <Tarjeta titulo="Textos" icono="bi-fonts">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                {TEXTOS.map(([k, etiqueta, ejemplo, max]) => (
                  <div key={k}>
                    <label className="jd-label">{etiqueta.toUpperCase()}</label>
                    <input className="jd-input" value={design[k] ?? ''} maxLength={max} placeholder={ejemplo} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </Tarjeta>
          </div>
        </div>
      )}
    </Layout>
  );
}
