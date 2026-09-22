// ════════════════════════════════════════════════════════════════
//   src/utils/perfilesImpresion.js
//   RIFAS JORDYN — "Medidas guardadas" (perfiles de impresión)
//
//   100% en el navegador: usa localStorage, NO toca la base de
//   datos ni el backend. Los perfiles quedan guardados en la PC /
//   navegador de quien los crea y sobreviven a recargas y cierres.
//
//   Si algún día quieres que viajen entre computadoras, basta con
//   guardar el mismo JSON (exportarPerfiles) en un endpoint.
// ════════════════════════════════════════════════════════════════

const KEY_PERFILES = 'rifasJordyn.perfilesImpresion.v1';
const KEY_DEFAULT  = 'rifasJordyn.perfilImpresionDefault.v1';

// Campos que componen un perfil. Si agregas una opción nueva a la
// pantalla de impresión, añádela aquí y se guardará sola.
export const CAMPOS_PERFIL = [
  'papel',
  'orientacion',
  'anchoCm',
  'altoCm',
  'mantenerProporcion',
  'modoAjuste',
  'gapXMm',
  'gapYMm',
  'gapLigado',
  'margenMm',
  'rejillaManual',
  'colsManual',
  'rowsManual',
  'dpi',
  'formato',
  'estiloMarcas',
];

// ── Acceso seguro a localStorage (modo incógnito, cuotas, etc.) ──
function leerRaw(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    console.warn('[perfilesImpresion] localStorage no disponible:', e);
    return null;
  }
}

function escribirRaw(key, valor) {
  try {
    window.localStorage.setItem(key, valor);
    return true;
  } catch (e) {
    console.warn('[perfilesImpresion] No se pudo guardar:', e);
    return false;
  }
}

export function disponible() {
  try {
    const t = '__test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
}

// ── Normalización ───────────────────────────────────────────────
function limpiarConfig(config = {}) {
  const out = {};
  CAMPOS_PERFIL.forEach((k) => {
    if (config[k] !== undefined) out[k] = config[k];
  });
  return out;
}

function nuevoId() {
  return 'perf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Lectura / escritura de la lista ─────────────────────────────
export function leerPerfiles() {
  const raw = leerRaw(KEY_PERFILES);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(p => p && p.id && p.config);
  } catch (e) {
    console.warn('[perfilesImpresion] JSON inválido, se ignora:', e);
    return [];
  }
}

function escribirPerfiles(perfiles) {
  escribirRaw(KEY_PERFILES, JSON.stringify(perfiles));
  return perfiles;
}

// ── Operaciones ─────────────────────────────────────────────────
// Guarda uno nuevo. Si ya existe uno con el mismo nombre, lo sobreescribe.
export function guardarPerfil(nombre, config, extra = {}) {
  const limpio = (nombre || '').trim() || 'Sin nombre';
  const perfiles = leerPerfiles();
  const existente = perfiles.find(
    p => p.nombre.toLowerCase() === limpio.toLowerCase()
  );

  if (existente) {
    existente.config = limpiarConfig(config);
    existente.nota = extra.nota || existente.nota || '';
    existente.actualizado = new Date().toISOString();
    return escribirPerfiles(perfiles);
  }

  perfiles.push({
    id: nuevoId(),
    nombre: limpio,
    nota: extra.nota || '',
    config: limpiarConfig(config),
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
  });
  return escribirPerfiles(perfiles);
}

// Actualiza la configuración de un perfil existente (botón "sobrescribir")
export function actualizarPerfil(id, config, extra = {}) {
  const perfiles = leerPerfiles();
  const p = perfiles.find(x => x.id === id);
  if (!p) return perfiles;
  p.config = limpiarConfig(config);
  if (extra.nota !== undefined) p.nota = extra.nota;
  p.actualizado = new Date().toISOString();
  return escribirPerfiles(perfiles);
}

export function renombrarPerfil(id, nombre) {
  const perfiles = leerPerfiles();
  const p = perfiles.find(x => x.id === id);
  if (!p) return perfiles;
  p.nombre = (nombre || '').trim() || p.nombre;
  p.actualizado = new Date().toISOString();
  return escribirPerfiles(perfiles);
}

export function borrarPerfil(id) {
  const perfiles = leerPerfiles().filter(p => p.id !== id);
  if (obtenerDefaultId() === id) marcarDefault(null);
  return escribirPerfiles(perfiles);
}

// ── Perfil por defecto (se aplica solo al abrir la pantalla) ─────
export function obtenerDefaultId() {
  return leerRaw(KEY_DEFAULT) || null;
}

export function marcarDefault(id) {
  if (!id) {
    try { window.localStorage.removeItem(KEY_DEFAULT); } catch (e) { /* noop */ }
    return null;
  }
  escribirRaw(KEY_DEFAULT, id);
  return id;
}

export function perfilDefault() {
  const id = obtenerDefaultId();
  if (!id) return null;
  return leerPerfiles().find(p => p.id === id) || null;
}

// ── Respaldo: exportar / importar como archivo .json ─────────────
export function exportarPerfiles() {
  return JSON.stringify(
    { version: 1, exportado: new Date().toISOString(), perfiles: leerPerfiles() },
    null,
    2
  );
}

export function descargarPerfiles(nombreArchivo = 'medidas-boletos.json') {
  const blob = new Blob([exportarPerfiles()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Importa fusionando: los nombres repetidos se renombran "(2)"
export function importarPerfiles(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    throw new Error('El archivo no es un JSON válido');
  }
  const entrantes = Array.isArray(datos) ? datos : datos.perfiles;
  if (!Array.isArray(entrantes)) throw new Error('El archivo no contiene perfiles');

  const perfiles = leerPerfiles();
  let agregados = 0;

  entrantes.forEach((p) => {
    if (!p || !p.config) return;
    let nombre = (p.nombre || 'Importado').trim();
    let n = 2;
    while (perfiles.some(x => x.nombre.toLowerCase() === nombre.toLowerCase())) {
      nombre = `${(p.nombre || 'Importado').trim()} (${n++})`;
    }
    perfiles.push({
      id: nuevoId(),
      nombre,
      nota: p.nota || '',
      config: limpiarConfig(p.config),
      creado: p.creado || new Date().toISOString(),
      actualizado: new Date().toISOString(),
    });
    agregados++;
  });

  escribirPerfiles(perfiles);
  return { perfiles, agregados };
}