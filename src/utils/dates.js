// ============================================================
//   utils/dates.js  — RIFAS JORDYN
//   Todas las funciones de formato de fecha del sistema
//   
//   PROBLEMA RAÍZ: new Date('2025-12-15') → interpreta como UTC
//   medianoche, lo que en zonas UTC-5 o UTC-4 (Venezuela/Colombia)
//   produce el día anterior al renderizar con toLocaleDateString.
//   
//   SOLUCIÓN: parsear la parte de fecha sin convertir a UTC.
// ============================================================

/**
 * Parsea un string de fecha (YYYY-MM-DD o ISO) sin desplazamiento UTC.
 * Devuelve un Date cuya fecha local coincide exactamente con lo guardado.
 */
export function parseFecha(f) {
  if (!f) return null;
  // Si es solo fecha (YYYY-MM-DD), construir con año/mes/día explícitos
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (soloFecha) {
    const [y, m, d] = f.split('-').map(Number);
    return new Date(y, m - 1, d);   // constructor local, sin UTC
  }
  // Si tiene hora (ISO string), tomar solo la parte de la fecha
  const parteF = f.split('T')[0];
  const [y, m, d] = parteF.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formatea una fecha como "15 de diciembre de 2025"
 * sin desfase de zona horaria.
 */
export function fmtFecha(f) {
  if (!f) return 'Por definir';
  const d = parseFecha(f);
  if (!d) return 'Por definir';
  return d.toLocaleDateString('es-CO', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  });
}

/**
 * Formatea fecha + hora para timestamps de BD (created_at, updated_at).
 * Estos SÍ traen hora, así que los dejamos pasar normalmente.
 */
export function fmtTimestamp(f) {
  if (!f) return '—';
  return new Date(f).toLocaleString('es-CO', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Obtiene la parte YYYY-MM-DD de un valor de fecha de la BD
 * para usarla en <input type="date">.
 */
export function fechaParaInput(f) {
  if (!f) return '';
  return f.split('T')[0];
}

/**
 * Cuenta regresiva hasta targetDate sin desfase UTC.
 * targetDate: string 'YYYY-MM-DD' o ISO
 */
export function calcCountdown(targetDate) {
  if (!targetDate) return { dias:0, horas:0, minutos:0, segundos:0, expired:true };
  const target = parseFecha(targetDate);
  // Para la cuenta regresiva necesitamos el fin del día objetivo
  target.setHours(23, 59, 59, 999);
  const diff = target - new Date();
  if (diff <= 0) return { dias:0, horas:0, minutos:0, segundos:0, expired:true };
  return {
    dias:     Math.floor(diff / 86400000),
    horas:    Math.floor((diff % 86400000) / 3600000),
    minutos:  Math.floor((diff % 3600000)  / 60000),
    segundos: Math.floor((diff % 60000)    / 1000),
    expired:  false,
  };
}