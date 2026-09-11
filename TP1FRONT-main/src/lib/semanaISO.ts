/**
 * Aritmética de semanas ISO-8601, centralizada aquí porque la necesitan tanto
 * `NewQuote.tsx` (para construir la fecha que se envía al backend) como
 * `WeekPicker.tsx` (para dibujar el calendario). Antes vivía duplicada / a
 * medias en cada lugar; tenerla en un solo archivo evita que las dos copias
 * diverjan silenciosamente.
 *
 * Todo en UTC (`Date.UTC`) para no depender de la zona horaria del navegador.
 */

/** Descompone 'YYYY-Www' en [año, semana]. [0, 0] si no matchea. */
export function parseSemanaISO(v: string): [number, number] {
  const m = v.match(/^(\d{4})-W(\d{2})$/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/** Lunes ('YYYY-MM-DD') de la semana ISO (año, semana). Semana 1 es la que
 *  contiene el primer jueves del año. Es la MISMA fórmula que ya usaba
 *  `buildFechaEmbarque` — se centraliza aquí sin cambiar el resultado. */
export function semanaISOToFecha(anio: number, semana: number): string {
  const simple = new Date(Date.UTC(anio, 0, 1 + (semana - 1) * 7));
  const dow = simple.getUTCDay();
  if (dow <= 4) simple.setUTCDate(simple.getUTCDate() - dow + 1);
  else simple.setUTCDate(simple.getUTCDate() + 8 - dow);
  return simple.toISOString().slice(0, 10);
}

/** [año ISO, semana ISO] de una fecha 'YYYY-MM-DD'. El año ISO de una semana
 *  es el año de SU JUEVES, no necesariamente el de su lunes ni el de su
 *  domingo — así, el 31 de diciembre puede pertenecer a la semana 1 del año
 *  siguiente. Algoritmo estándar ISO-8601 (semana 1 = la del primer jueves). */
export function fechaASemanaISO(fechaISO: string): [number, number] {
  const d = new Date(fechaISO + 'T00:00:00Z');
  const diaLunes0 = (d.getUTCDay() + 6) % 7; // 0=lunes ... 6=domingo
  d.setUTCDate(d.getUTCDate() - diaLunes0 + 3); // jueves de esa semana
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const pDia = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - pDia + 3);
  const semana = 1 + Math.round((d.getTime() - primerJueves.getTime()) / (7 * 86400000));
  return [d.getUTCFullYear(), semana];
}

/** ¿La semana ISO (anio, semana) tiene al menos un día dentro de
 *  [fechaMin, fechaMax]? Se compara por el LUNES de la semana, que es
 *  exactamente la fecha que se envía al backend (ver `buildFechaEmbarque`),
 *  así que esta regla es idéntica a la que el backend aplica. */
export function semanaEnRango(anio: number, semana: number, fechaMin: string, fechaMax: string): boolean {
  const lunes = semanaISOToFecha(anio, semana);
  return lunes >= fechaMin && lunes <= fechaMax;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function nombreMes(mesIndex: number): string {
  return MESES[mesIndex];
}

/** Texto corto de un rango de fechas de una semana, p. ej. "7 – 13 set." o
 *  "28 set. – 4 oct." cuando la semana cruza de mes. */
export function rangoSemanaTexto(lunesISO: string): string {
  const lunes = new Date(lunesISO + 'T00:00:00Z');
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  const dl = lunes.getUTCDate();
  const dd = domingo.getUTCDate();
  const ml = MESES_ABREV[lunes.getUTCMonth()];
  const md = MESES_ABREV[domingo.getUTCMonth()];
  return ml === md ? `${dl} – ${dd} ${ml}.` : `${dl} ${ml}. – ${dd} ${md}.`;
}

/** Todas las semanas ISO cuyo rango (lunes..domingo) toca el mes visible
 *  (anioVisible, mesVisible con mes 0-indexado), en orden cronológico. */
export function semanasDelMesVisible(
  anioVisible: number, mesVisible: number
): { anio: number; semana: number; lunes: string }[] {
  const primerDia = new Date(Date.UTC(anioVisible, mesVisible, 1));
  const ultimoDia = new Date(Date.UTC(anioVisible, mesVisible + 1, 0));
  const diaLunes0 = (primerDia.getUTCDay() + 6) % 7;
  const cursor = new Date(primerDia);
  cursor.setUTCDate(primerDia.getUTCDate() - diaLunes0);

  const semanas: { anio: number; semana: number; lunes: string }[] = [];
  while (cursor <= ultimoDia) {
    const lunesISO = cursor.toISOString().slice(0, 10);
    const [anio, semana] = fechaASemanaISO(lunesISO);
    semanas.push({ anio, semana, lunes: lunesISO });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return semanas;
}
