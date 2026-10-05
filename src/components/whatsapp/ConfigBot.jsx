/**
 * ConfigBot.jsx — Configuración del bot vendedor de WhatsApp
 *  - Elegir la IA (Gemini, Claude, OpenAI, Groq, OpenRouter, DeepSeek)
 *  - Clave, modelo (cargados en vivo) y prueba de conexión
 *  - Personalidad, datos de pago, horario y protección anti-bloqueo
 *  - Simulador: conversa con el bot como si fueras un cliente
 */
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import API from '../../services/api';
import './ConfigBot.css';

const DIAS = [['1', 'L'], ['2', 'M'], ['3', 'Mi'], ['4', 'J'], ['5', 'V'], ['6', 'S'], ['0', 'D']];

const ANTIBAN = [
  ['max_por_minuto', 'Mensajes por minuto', 'Tope de mensajes salientes por minuto en todo el número. Si se llena, los siguientes esperan.'],
  ['max_por_dia', 'Mensajes por día', 'Tope diario de mensajes salientes.'],
  ['max_chats_nuevos_dia', 'Chats nuevos por día', 'Escribirle primero a números que nunca te escribieron es lo que más dispara bloqueos.'],
  ['agrupar_ms', 'Espera para agrupar (ms)', 'Si el cliente manda varios mensajes seguidos, se responden todos juntos en uno.'],
  ['espera_min_ms', 'Pausa mínima entre envíos (ms)', 'Pausa aleatoria entre un mensaje y otro.'],
  ['espera_max_ms', 'Pausa máxima entre envíos (ms)', ''],
  ['escribiendo_cps', 'Velocidad al escribir (letras/seg)', 'El bot muestra "escribiendo…" el tiempo que tardaría una persona.'],
  ['ignorar_viejos_min', 'No responder mensajes de más de (min)', 'Al reconectar no contesta en ráfaga lo viejo: lo marca para que lo atiendas tú.'],
  ['max_respuestas_5min', 'Máx. respuestas a un chat en 5 min', 'Si se supera (p. ej. otro bot contestando), el bot se pausa en ese chat.'],
  ['frio_espera_min_seg', 'Tickets a desconocidos: pausa mínima (seg)', 'Clientes de la página que nunca escribieron: sus tickets salen espaciados.'],
  ['frio_espera_max_seg', 'Tickets a desconocidos: pausa máxima (seg)', ''],
];

const SUGERENCIAS_SIM = ['hola, qué rifas tienen?', 'está disponible el 7?', 'quiero 3 números que terminen en 5', 'quiero el 087, soy Ana Pérez V-12345678, pago por pago móvil'];

// Reconoce de qué proveedor es una clave por su prefijo
function proveedorDeClave(k) {
  const c = String(k || '').trim();
  if (c.startsWith('gsk_')) return 'groq';
  if (c.startsWith('AIza')) return 'gemini';
  if (c.startsWith('sk-ant-')) return 'anthropic';
  if (c.startsWith('sk-or-')) return 'openrouter';
  if (c.startsWith('sk-proj-')) return 'openai';
  return null;
}

function Toggle({ on, onClick, title }) {
  return <button type="button" className={`wcb-toggle${on ? ' on' : ''}`} onClick={onClick} title={title} aria-pressed={on} />;
}

export default function ConfigBot() {
  const [cfg, setCfg] = useState(null);
  const [original, setOriginal] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [claveNueva, setClaveNueva] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [prueba, setPrueba] = useState(null);       // { ok, texto }
  const [probando, setProbando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Simulador
  const [sim, setSim] = useState([]);               // [{ role, content, llamadas? }]
  const [simTexto, setSimTexto] = useState('');
  const [simPensando, setSimPensando] = useState(false);
  const [simEstado, setSimEstado] = useState(null);  // compra en curso de la simulación
  const [pagos, setPagos] = useState(null);           // { metodos, tasas } — mismos datos de la pantalla del cliente
  const simRef = useRef(null);

  useEffect(() => {
    Promise.all([API.get('/wa-chat/bot/config'), API.get('/wa-chat/bot/proveedores')])
      .then(([c, p]) => { setCfg(c.data); setOriginal(JSON.stringify(c.data)); setProveedores(p.data); })
      .catch(() => toast.error('No se pudo cargar la configuración del bot'));
    API.get('/publico/metodos-pago').then((r) => setPagos(r.data)).catch(() => {});
  }, []);
  useEffect(() => { simRef.current?.scrollTo({ top: simRef.current.scrollHeight, behavior: 'smooth' }); }, [sim, simPensando]);

  if (!cfg) return <div className="d-flex justify-content-center mt-4"><div className="jd-spinner" style={{ width: 36, height: 36 }} /></div>;

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const setSub = (grupo, k, v) => setCfg((c) => ({ ...c, [grupo]: { ...c[grupo], [k]: v } }));
  const prov = proveedores.find((p) => p.id === cfg.proveedor);
  const claveGuardada = cfg.api_keys?.[cfg.proveedor];
  const hayCambios = JSON.stringify(cfg) !== original || !!claveNueva;
  const cuerpoPrueba = () => ({ proveedor: cfg.proveedor, modelo: cfg.modelo, api_key: claveNueva || undefined });

  const elegirProveedor = (id) => {
    if (id === cfg.proveedor) return;
    setCfg((c) => ({ ...c, proveedor: id, modelo: '' }));
    setClaveNueva(''); setModelos([]); setPrueba(null);
  };

  const cargarModelos = async () => {
    setCargandoModelos(true);
    try {
      const r = await API.post('/wa-chat/bot/modelos', cuerpoPrueba());
      setModelos(r.data);
      if (!r.data.length) toast.info('El proveedor no devolvió modelos');
      else toast.success(`${r.data.length} modelos disponibles`);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudieron cargar los modelos'); }
    finally { setCargandoModelos(false); }
  };

  const probarConexion = async () => {
    setProbando(true); setPrueba(null);
    try {
      const r = await API.post('/wa-chat/bot/probar-proveedor', cuerpoPrueba());
      setPrueba({
        ok: true,
        texto: `Funciona en ${(r.data.ms / 1000).toFixed(1)} s · ${r.data.usoHerramienta ? 'usa herramientas ✅ (puede consultar números)' : '⚠️ no usó herramientas: elige otro modelo'}\n"${r.data.respuesta}"`,
      });
    } catch (e) { setPrueba({ ok: false, texto: e.response?.data?.error || e.message }); }
    finally { setProbando(false); }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const body = { ...cfg, api_keys: claveNueva ? { [cfg.proveedor]: claveNueva } : {} };
      const r = await API.put('/wa-chat/bot/config', body);
      setCfg(r.data); setOriginal(JSON.stringify(r.data)); setClaveNueva('');
      toast.success('Configuración del bot guardada');
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  const borrarClave = async () => {
    if (!window.confirm(`¿Borrar la API key guardada de ${prov?.nombre}?`)) return;
    try {
      const r = await API.put('/wa-chat/bot/config', { api_keys: { [cfg.proveedor]: null } });
      setCfg((c) => ({ ...c, api_keys: r.data.api_keys })); setOriginal((o) => JSON.stringify({ ...JSON.parse(o), api_keys: r.data.api_keys }));
      toast.success('Clave borrada');
    } catch (_) { toast.error('No se pudo borrar'); }
  };

  const enviarSim = async (textoForzado) => {
    const t = (textoForzado ?? simTexto).trim();
    if (!t || simPensando) return;
    if (hayCambios) toast.info('El simulador usa la configuración GUARDADA', { toastId: 'sim-guardada' });
    const nuevo = [...sim, { role: 'user', content: t }];
    setSim(nuevo); setSimTexto(''); setSimPensando(true);
    try {
      const r = await API.post('/wa-chat/bot/probar-conversacion', { mensajes: nuevo.map(({ role, content }) => ({ role, content })), estado_compra: simEstado });
      setSimEstado(r.data.estado_compra || null);
      const partes = r.data.partes?.length ? r.data.partes : [r.data.respuesta || '(sin respuesta)'];
      setSim([...nuevo, ...partes.map((p, i) => ({ role: 'assistant', content: p, llamadas: i === 0 ? r.data.llamadas : [] }))]);
    } catch (e) {
      setSim([...nuevo, { role: 'assistant', content: `⚠️ ${e.response?.data?.error || 'Error'}`, error: true }]);
    } finally { setSimPensando(false); }
  };

  const resumenTool = (l) => {
    if (l.nombre === 'consultar_numeros') return (l.resultado?.numeros || []).map((n) => `${n.numero} ${n.disponible ? '✓' : '✗'}`).join(' ') || 'consultar números';
    if (l.nombre === 'numeros_disponibles') return `sugeridos: ${(l.resultado?.sugeridos || []).slice(0, 5).join(', ')}`;
    if (l.nombre === 'ver_rifas') return `${l.resultado?.rifas?.length ?? 0} rifas`;
    return l.nombre.replace(/_/g, ' ');
  };

  return (
    <>
      <div className="wcb">
        <div className="wcb-col">

          {/* Estado */}
          <div className="wcb-card">
            <div className="wcb-hero">
              <div className={`icono ${cfg.activo ? 'on' : 'off'}`}><i className="bi bi-robot" /></div>
              <div>
                <b>{cfg.activo ? 'El bot está atendiendo a los clientes' : 'El bot está apagado'}</b>
                <span>{cfg.activo ? 'Responde, verifica números, recibe comprobantes y crea las reservas.' : 'Nadie responde automáticamente: atiendes tú desde Chats.'}</span>
              </div>
              <Toggle on={cfg.activo} onClick={() => set('activo', !cfg.activo)} title="Encender / apagar el bot" />
            </div>
          </div>

          {/* IA */}
          <div className="wcb-card">
            <h4><i className="bi bi-stars" />Inteligencia artificial</h4>
            <div className="desc">Elige qué IA conversa con tus clientes. Todas pueden consultar la disponibilidad real de los números con herramientas.</div>
            <div className="wcb-proveedores">
              {proveedores.map((p) => (
                <button key={p.id} type="button" className={`wcb-prov${cfg.proveedor === p.id ? ' activo' : ''}`} onClick={() => elegirProveedor(p.id)}>
                  {(cfg.api_keys?.[p.id] || p.claveEnServidor) ? <span className="marca ok">Con clave</span> : p.id === 'gemini' ? <span className="marca rec">Gratis</span> : null}
                  <b>{p.nombre}</b><span>{p.nota}</span>
                </button>
              ))}
            </div>

            <label className="wcb-label">API key de {prov?.nombre}</label>
            <div className="wcb-fila">
              <div style={{ position: 'relative' }}>
                <input className="jd-input" type={verClave ? 'text' : 'password'} autoComplete="off"
                  placeholder={claveGuardada ? `Guardada: ${claveGuardada} — escribe para reemplazarla` : prov?.claveEnServidor ? 'Usando la clave del servidor (.env)' : 'Pega aquí tu API key'}
                  value={claveNueva} style={{ paddingRight: 38 }}
                  onChange={(e) => {
                    const v = e.target.value;
                    const detectado = proveedorDeClave(v);
                    // Evita el error de pegar una clave de Groq con Gemini seleccionado (y viceversa)
                    if (detectado && detectado !== cfg.proveedor) {
                      setCfg((c) => ({ ...c, proveedor: detectado, modelo: '' }));
                      setModelos([]); setPrueba(null);
                      toast.info(`Esa clave es de ${proveedores.find((p) => p.id === detectado)?.nombre || detectado}: lo seleccioné por ti`);
                    }
                    setClaveNueva(v);
                  }} />
                <button type="button" onClick={() => setVerClave((v) => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--jordyn-muted)', cursor: 'pointer' }}>
                  <i className={`bi ${verClave ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
              {claveGuardada && <button type="button" className="btn-jordyn-outline" style={{ flex: '0 0 auto' }} onClick={borrarClave} title="Borrar clave guardada"><i className="bi bi-trash" /></button>}
            </div>
            {prov?.urlClave && <div className="wcb-ayuda">¿No tienes? <a href={prov.urlClave} target="_blank" rel="noreferrer">Obtén tu API key de {prov.nombre} <i className="bi bi-box-arrow-up-right" /></a>. Se guarda en la base de datos, no en el código.</div>}

            <label className="wcb-label">Modelo</label>
            <div className="wcb-fila">
              <input className="jd-input" list="wcb-modelos" value={cfg.modelo || ''} onChange={(e) => set('modelo', e.target.value)}
                placeholder={prov?.modeloDefecto ? `Por defecto: ${prov.modeloDefecto}` : 'Carga los modelos y elige uno'} />
              <datalist id="wcb-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
              <button type="button" className="btn-jordyn-outline" style={{ flex: '0 0 auto' }} onClick={cargarModelos} disabled={cargandoModelos}>
                {cargandoModelos ? 'Cargando…' : <><i className="bi bi-cloud-download me-1" />Cargar modelos</>}
              </button>
            </div>
            <div className="wcb-ayuda">La lista viene en vivo del proveedor, así solo eliges modelos que existen hoy.</div>

            <button type="button" className="btn-jordyn" style={{ marginTop: 14 }} onClick={probarConexion} disabled={probando}>
              {probando ? 'Probando…' : <><i className="bi bi-lightning-charge me-1" />Probar conexión</>}
            </button>
            {prueba && <div className={`wcb-resultado ${prueba.ok ? 'ok' : 'error'}`} style={{ whiteSpace: 'pre-wrap' }}>{prueba.ok ? '✅ ' : '❌ '}{prueba.texto}</div>}
          </div>

          {/* Personalidad */}
          <div className="wcb-card">
            <h4><i className="bi bi-person-heart" />Personalidad y negocio</h4>
            <div className="desc">Cómo habla el bot y qué sabe de tu negocio. Los precios, rifas y números los consulta solo en el sistema.</div>
            <div className="wcb-fila">
              <div><label className="wcb-label">Nombre del negocio</label><input className="jd-input" value={cfg.nombre_negocio} onChange={(e) => set('nombre_negocio', e.target.value)} /></div>
              <div><label className="wcb-label">Nombre de quien atiende (opcional)</label><input className="jd-input" value={cfg.nombre_asistente} onChange={(e) => set('nombre_asistente', e.target.value)} placeholder="Ej. Jordyn" /></div>
              <div style={{ flex: '0 0 150px' }}><label className="wcb-label">Moneda de los precios</label><input className="jd-input" value={cfg.moneda || ''} onChange={(e) => set('moneda', e.target.value)} placeholder="pesos" /></div>
            </div>
            <label className="wcb-label">Forma de hablar</label>
            <textarea className="jd-input" rows={6} value={cfg.personalidad} onChange={(e) => set('personalidad', e.target.value)} />
            <label className="wcb-label">Información extra (horarios, redes, página web, preguntas frecuentes)</label>
            <textarea className="jd-input" rows={4} value={cfg.info_extra} onChange={(e) => set('info_extra', e.target.value)}
              placeholder={'Los sorteos se transmiten en vivo por Instagram @…\nPágina para comprar: https://…'} />

            <div style={{ marginTop: 10 }}>
              <div className="wcb-opcion"><div><b>Pedir cédula</b><span>Obligatoria para apartar, igual que en la página.</span></div><Toggle on={cfg.pedir_cedula} onClick={() => set('pedir_cedula', !cfg.pedir_cedula)} /></div>
              <div className="wcb-opcion"><div><b>Leer los comprobantes con IA</b><span>Extrae monto, banco y referencia de la captura para que los revises más rápido.</span></div><Toggle on={cfg.leer_comprobantes} onClick={() => set('leer_comprobantes', !cfg.leer_comprobantes)} /></div>
              <div className="wcb-opcion"><div><b>Avisar si rechazas un pago</b><span>Le escribe al cliente con amabilidad cuando rechazas su reserva en Reservas.</span></div><Toggle on={cfg.avisar_rechazo} onClick={() => set('avisar_rechazo', !cfg.avisar_rechazo)} /></div>
              <div className="wcb-opcion"><div><b>Recordar el pago de números apartados</b><span>En rifas donde se puede apartar sin pagar: le escribe al cliente la víspera, el día del sorteo y antes de que venza el plazo.</span></div><Toggle on={cfg.recordatorios_apartado?.activo !== false} onClick={() => setSub('recordatorios_apartado', 'activo', cfg.recordatorios_apartado?.activo === false)} /></div>
            </div>
            <label className="wcb-label">Mensaje si la IA falla</label>
            <input className="jd-input" value={cfg.mensaje_sin_ia} onChange={(e) => set('mensaje_sin_ia', e.target.value)} />
            <div className="wcb-ayuda">Se envía una sola vez y el chat queda marcado para que lo atiendas tú.</div>
          </div>

          {/* Dueño */}
          <div className="wcb-card">
            <h4><i className="bi bi-person-badge" />Dueño y avisos por WhatsApp</h4>
            <div className="desc">
              Cuando un cliente necesite una persona, el bot te escribe a tu WhatsApp contándote quién es y qué quiere.
              Le respondes ahí mismo: <b>1</b> lo atiendes tú, <b>2</b> sigue el bot, o le escribes qué decirle y él se lo pasa al cliente.
              También puedes escribirle <b>cola</b> para ver quién espera.
            </div>
            <div className="wcb-opcion" style={{ borderTop: 'none', paddingTop: 0 }}>
              <div><b>Avisarme cuando un cliente me necesite</b><span>Y recordarme los pendientes.</span></div>
              <Toggle on={cfg.dueno?.notificar} onClick={() => setSub('dueno', 'notificar', !cfg.dueno?.notificar)} />
            </div>
            <div className="wcb-fila">
              <div><label className="wcb-label">Nombre</label><input className="jd-input" value={cfg.dueno?.nombre || ''} onChange={(e) => setSub('dueno', 'nombre', e.target.value)} /></div>
              <div><label className="wcb-label">WhatsApp del dueño</label><input className="jd-input" inputMode="tel" value={cfg.dueno?.telefono || ''} onChange={(e) => setSub('dueno', 'telefono', e.target.value)} placeholder="584121234567" /></div>
            </div>
            <div className="wcb-fila">
              <div><label className="wcb-label">Recordar pendientes cada (min)</label><input type="number" min={0} className="jd-input" value={cfg.dueno?.resumen_cada_min ?? 60} onChange={(e) => setSub('dueno', 'resumen_cada_min', Math.max(0, Number(e.target.value) || 0))} /></div>
              <div><label className="wcb-label">Sin avisos desde</label><input type="time" className="jd-input" value={cfg.dueno?.silencio_desde || ''} onChange={(e) => setSub('dueno', 'silencio_desde', e.target.value)} /></div>
              <div><label className="wcb-label">hasta</label><input type="time" className="jd-input" value={cfg.dueno?.silencio_hasta || ''} onChange={(e) => setSub('dueno', 'silencio_hasta', e.target.value)} /></div>
            </div>
            <div className="wcb-ayuda">0 = sin recordatorios. De noche no te escribe: lo pendiente te llega en el primer resumen de la mañana.</div>
            <label className="wcb-label">Temas que atiendes tú (el bot te avisa en vez de responder)</label>
            <textarea className="jd-input" rows={3} value={cfg.temas_dueno || ''} onChange={(e) => set('temas_dueno', e.target.value)}
              placeholder={'- Quiere ser vendedor o pregunta cómo puede vender números.\n- Quiere cobrar un premio.'} />
            <div className="wcb-ayuda">
              Uno por línea. Cuando un cliente pregunte por algo de esta lista, el bot le dice que ya te avisa y te escribe con sus datos.
              Además, tu número tiene <b>modo dueño</b>: pregúntale por WhatsApp cómo va una rifa, quién tiene un número, busca un cliente o dile qué número cayó.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn-jordyn-outline" disabled={hayCambios} title={hayCambios ? 'Guarda primero los cambios' : ''}
                onClick={() => API.post('/wa-chat/dueno/probar').then(() => toast.success('Mensaje de prueba enviado a tu WhatsApp')).catch((e) => toast.error(e.response?.data?.error || 'No se pudo enviar'))}>
                <i className="bi bi-send me-1" />Enviarme un mensaje de prueba
              </button>
              <button type="button" className="btn-jordyn-outline" disabled={hayCambios}
                onClick={() => API.post('/wa-chat/dueno/resumen').then(() => toast.success('Resumen enviado a tu WhatsApp')).catch((e) => toast.error(e.response?.data?.error || 'No se pudo enviar'))}>
                <i className="bi bi-list-check me-1" />Mandarme los pendientes ahora
              </button>
            </div>
          </div>

          {/* Pagos y apartado */}
          <div className="wcb-card">
            <h4><i className="bi bi-wallet2" />Pagos y apartado de números</h4>
            <div className="desc">
              El bot usa los mismos datos de pago de la pantalla del cliente y calcula el monto en la moneda de cada método con la tasa del día.
              Los datos y el monto los envía el sistema tal cual: la IA nunca los escribe.
            </div>
            {pagos ? (
              <>
                <div className="wcb-metodos">
                  {Object.entries(pagos.metodos).map(([nombre, m]) => (
                    <div key={nombre} className="wcb-metodo">
                      <b>{m.icono} {nombre}</b>
                      {m.campos.map((c) => <span key={c.label}>{c.label}: {c.valor}</span>)}
                      {m.presencial && <em>Lo coordina una persona</em>}
                    </div>
                  ))}
                </div>
                <div className="wcb-ayuda">
                  Tasas de hoy: 1 USD = {Number(pagos.tasas.copUsd).toLocaleString('es-CO')} pesos · 1 USD = Bs. {Number(pagos.tasas.bsdUsd).toLocaleString('es-VE', { minimumFractionDigits: 2 })}.
                  Se cambian en <b>Tasas</b>.
                </div>
              </>
            ) : <div className="wcb-ayuda">Cargando métodos de pago…</div>}
            <div className="wcb-fila" style={{ marginTop: 6 }}>
              <div style={{ flex: '0 0 220px' }}>
                {/* Se escribe en horas; se guarda en minutos (apartado_minutos), que es lo que usa el bot */}
                <label className="wcb-label">Horas que se aparta un número</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  className="jd-input"
                  value={Math.round(((cfg.apartado_minutos ?? 45) / 60) * 100) / 100}
                  onChange={(e) => set('apartado_minutos', Math.max(5, Math.round((Number(e.target.value) || 0.75) * 60)))}
                />
              </div>
              <div className="wcb-ayuda" style={{ alignSelf: 'center' }}>
                Mientras el cliente paga, sus números quedan bloqueados (nadie más puede tomarlos, ni por la página). Si no manda la captura a tiempo, se liberan solos y se le avisa.
              </div>
            </div>
          </div>

          {/* Horario */}
          <div className="wcb-card">
            <h4><i className="bi bi-clock" />Horario de atención</h4>
            <div className="wcb-opcion" style={{ borderTop: 'none' }}>
              <div><b>Responder solo en horario</b><span>Fuera de horario manda un aviso (una vez cada 6 h por cliente) y no vende.</span></div>
              <Toggle on={cfg.horario.activo} onClick={() => setSub('horario', 'activo', !cfg.horario.activo)} />
            </div>
            {cfg.horario.activo && (
              <>
                <div className="wcb-fila">
                  <div><label className="wcb-label">Desde</label><input type="time" className="jd-input" value={cfg.horario.desde} onChange={(e) => setSub('horario', 'desde', e.target.value)} /></div>
                  <div><label className="wcb-label">Hasta</label><input type="time" className="jd-input" value={cfg.horario.hasta} onChange={(e) => setSub('horario', 'hasta', e.target.value)} /></div>
                </div>
                <label className="wcb-label">Días</label>
                <div className="wcb-dias">
                  {DIAS.map(([n, t]) => {
                    const d = Number(n);
                    const on = cfg.horario.dias.includes(d);
                    return <button key={n} type="button" className={`wcb-dia${on ? ' activo' : ''}`}
                      onClick={() => setSub('horario', 'dias', on ? cfg.horario.dias.filter((x) => x !== d) : [...cfg.horario.dias, d])}>{t}</button>;
                  })}
                </div>
                <label className="wcb-label">Mensaje fuera de horario</label>
                <input className="jd-input" value={cfg.horario.mensaje_fuera} onChange={(e) => setSub('horario', 'mensaje_fuera', e.target.value)} />
              </>
            )}
          </div>

          {/* Anti-bloqueo */}
          <div className="wcb-card">
            <h4><i className="bi bi-shield-check" />Protección anti-bloqueo</h4>
            <div className="desc">Límites para que el número se comporte como una persona y no como un sistema de envíos masivos. Los valores por defecto son seguros.</div>
            <div className="wcb-ab">
              {ANTIBAN.map(([k, t, ayuda]) => (
                <div key={k}>
                  <label className="wcb-label" style={{ marginTop: 0 }}>{t}</label>
                  <input type="number" min={0} className="jd-input" value={cfg.antiban[k]} onChange={(e) => setSub('antiban', k, Math.max(0, Number(e.target.value) || 0))} />
                  {ayuda && <div className="wcb-ayuda">{ayuda}</div>}
                </div>
              ))}
            </div>
            <div className="wcb-fila" style={{ marginTop: 12 }}>
              <div style={{ flex: '0 0 170px' }}><label className="wcb-label">Tickets a desconocidos desde</label><input type="time" className="jd-input" value={cfg.antiban.frio_desde || '08:00'} onChange={(e) => setSub('antiban', 'frio_desde', e.target.value)} /></div>
              <div style={{ flex: '0 0 170px' }}><label className="wcb-label">hasta</label><input type="time" className="jd-input" value={cfg.antiban.frio_hasta || '20:30'} onChange={(e) => setSub('antiban', 'frio_hasta', e.target.value)} /></div>
              <div className="wcb-ayuda" style={{ alignSelf: 'center' }}>De noche no se le escribe a quien nunca escribió; esos tickets salen en la mañana (o al instante si el cliente escribe).</div>
            </div>
            <div className="wcb-consejos">
              <b style={{ fontSize: '.78rem' }}>Buenas prácticas para no ser bloqueado</b>
              <ul>
                <li>Usa un número con historial (no uno recién activado) y con foto y nombre de perfil.</li>
                <li>Deja que el cliente escriba primero; evita escribirle a quien nunca te escribió.</li>
                <li>Nunca envíes publicidad masiva ni el mismo mensaje a muchas personas.</li>
                <li>Si varios clientes te reportan o bloquean, WhatsApp restringe el número: responde rápido y con amabilidad.</li>
                <li>Mantén el teléfono con internet y abre WhatsApp en él de vez en cuando.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Simulador */}
        <div className="wcb-col">
          <div className="wcb-sim">
            <div className="wcb-sim-pantalla">
              <div className="wcb-sim-cab">
                <div className="av"><i className="bi bi-shop" /></div>
                <div style={{ flex: 1 }}><b>{cfg.nombre_negocio || 'Tu negocio'}</b><span>{simPensando ? 'escribiendo…' : 'Simulador · no envía nada por WhatsApp'}</span></div>
                {sim.length > 0 && <button type="button" onClick={() => { setSim([]); setSimEstado(null); }} title="Reiniciar" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><i className="bi bi-arrow-counterclockwise" /></button>}
              </div>
              <div className="wcb-sim-msgs" ref={simRef}>
                {sim.length === 0 && (
                  <div className="wcb-sim-vacio">
                    Escribe como si fueras un cliente para ver cómo responde el bot con la configuración guardada.
                    <div className="wcb-sim-sugerencias">
                      {SUGERENCIAS_SIM.map((s) => <button key={s} type="button" onClick={() => enviarSim(s)}>{s}</button>)}
                    </div>
                  </div>
                )}
                {sim.map((m, i) => (
                  <React.Fragment key={i}>
                    {m.llamadas?.length > 0 && (
                      <div className="wcb-sim-tools">
                        {m.llamadas.map((l, j) => <span key={j} className="wcb-sim-tool" title={JSON.stringify(l.args)}>🔧 {resumenTool(l)}</span>)}
                      </div>
                    )}
                    <div className={`wcb-sim-fila ${m.role === 'user' ? 'yo' : 'bot'}`}>
                      <div className="wcb-sim-burbuja" style={m.error ? { background: '#fdecec', color: '#9f1d27' } : undefined}>{m.content}</div>
                    </div>
                  </React.Fragment>
                ))}
                {simPensando && <div className="wcb-sim-escribiendo">escribiendo…</div>}
              </div>
              <div className="wcb-sim-pie">
                <input value={simTexto} onChange={(e) => setSimTexto(e.target.value)} placeholder="Escribe como cliente…"
                  onKeyDown={(e) => e.key === 'Enter' && enviarSim()} />
                <button type="button" onClick={() => enviarSim()} disabled={!simTexto.trim() || simPensando}><i className="bi bi-send-fill" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="wcb-guardar">
        {hayCambios && <span className="aviso"><i className="bi bi-exclamation-circle" />Tienes cambios sin guardar</span>}
        <button type="button" className="btn-jordyn" onClick={guardar} disabled={guardando || !hayCambios}>
          {guardando ? 'Guardando…' : <><i className="bi bi-check2 me-1" />Guardar configuración</>}
        </button>
      </div>
    </>
  );
}
