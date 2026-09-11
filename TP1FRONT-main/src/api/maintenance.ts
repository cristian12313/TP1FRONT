import { apiClient } from './client';

export interface MarketRates {
  lag1: number;
  lag2: number;
  lag3: number;
  /**
   * Mes 'YYYY-MM' al que corresponde lag1. El backend lo EXIGE en el PATCH: sin
   * él no puede saber cuántos meses extrapola una cotización. Se omitía en las
   * peticiones y todas las actualizaciones manuales fallaban con 422.
   */
  vigente_hasta: string;
  origen?: 'artifact' | 'manual' | 'ingesta_aduanet';
}

export async function getMarketRates(): Promise<MarketRates> {
  const res = await apiClient.get<MarketRates>('/api/maintenance/market-rates');
  return res.data;
}

export async function updateMarketRates(data: MarketRates): Promise<MarketRates> {
  const res = await apiClient.patch<MarketRates>('/api/maintenance/market-rates', data);
  return res.data;
}

export async function resetMarketRates(): Promise<MarketRates> {
  const res = await apiClient.post<MarketRates>('/api/maintenance/market-rates/reset');
  return res.data;
}

// ── Artifact del modelo ──────────────────────────────────────────────────────

export interface ArtifactInfo {
  entrenado_en: string | null;
  cargado: boolean;
  mape_test: number;
  n_puertos: number;
  n_importadores: number;
  n_features: number;
  serie_mercado_primer_mes: string;
  serie_mercado_ultimo_mes: string;
  archivos: Record<string, string | null>;
}

export async function getArtifactInfo(): Promise<ArtifactInfo> {
  const res = await apiClient.get<ArtifactInfo>('/api/maintenance/model/info');
  return res.data;
}

export async function reloadArtifact(): Promise<{ mensaje: string; artifact: ArtifactInfo }> {
  const res = await apiClient.post('/api/maintenance/model/reload');
  return res.data;
}

// ── Ingesta automática desde Aduanet ─────────────────────────────────────────

export interface Programacion {
  activa: boolean;
  dia_semana: number; // 0 = lunes … 6 = domingo
  hora: number;
  aplicar_automaticamente: boolean;
}

export interface PuntoSerie {
  mes: string;
  flete_unit: number;
  declaraciones: number;
}

export interface Rezagos {
  ok: boolean;
  motivo?: string;
  lag1?: number;
  lag2?: number;
  lag3?: number;
  vigente_hasta?: string;
  meses?: string[];
  declaraciones_por_mes?: Record<string, number>;
}

export interface ProgresoIngesta {
  en_curso: boolean;
  inicio?: string;
  desde?: string;
  hasta?: string;
  consultas_totales?: number;
  consultas_hechas?: number;
  declaraciones?: number;
  importador_actual?: string | null;
  errores?: number;
}

export interface EjecucionResumen {
  fin: string;
  desde: string;
  hasta: string;
  declaraciones_nuevas: number;
  declaraciones_acumuladas: number;
  n_errores: number;
  aplicado: boolean;
  motivo_no_aplicado: string | null;
  duracion_s: number;
}

export interface IngestaEstado {
  programacion: Programacion;
  ventana_dias: number;
  partidas: string[];
  aduana: string;
  min_declaraciones_mes: number;
  n_importadores: number;
  n_importadores_activos: number;
  declaraciones_acumuladas: number;
  serie_mensual: PuntoSerie[];
  rezagos_calculados: Rezagos;
  ultima_ejecucion: string | null;
  ultimo_resultado: (EjecucionResumen & { errores?: unknown[] }) | null;
  historial: EjecucionResumen[];
  progreso: ProgresoIngesta;
  estado_mercado: MarketRates;
  factor_flete: number;
}

export interface Importador {
  ruc: string;
  nombre: string;
  activo: boolean;
}

export async function getIngestaEstado(): Promise<IngestaEstado> {
  const res = await apiClient.get<IngestaEstado>('/api/maintenance/ingesta');
  return res.data;
}

export async function runIngesta(body: {
  desde?: string;
  hasta?: string;
  aplicar: boolean;
}): Promise<{ mensaje: string }> {
  const res = await apiClient.post('/api/maintenance/ingesta/run', body);
  return res.data;
}

export async function getPadron(): Promise<Importador[]> {
  const res = await apiClient.get<{ importadores: Importador[] }>(
    '/api/maintenance/ingesta/padron',
  );
  return res.data.importadores;
}

export async function addImportador(ruc: string, nombre: string): Promise<Importador[]> {
  const res = await apiClient.post<{ importadores: Importador[] }>(
    '/api/maintenance/ingesta/padron',
    { ruc, nombre },
  );
  return res.data.importadores;
}

export async function setImportadorActivo(ruc: string, activo: boolean): Promise<Importador[]> {
  const res = await apiClient.patch<{ importadores: Importador[] }>(
    `/api/maintenance/ingesta/padron/${ruc}`,
    { activo },
  );
  return res.data.importadores;
}

export async function deleteImportador(ruc: string): Promise<Importador[]> {
  const res = await apiClient.delete<{ importadores: Importador[] }>(
    `/api/maintenance/ingesta/padron/${ruc}`,
  );
  return res.data.importadores;
}

export async function updateProgramacion(
  cambios: Partial<Programacion>,
): Promise<Programacion> {
  const res = await apiClient.patch<{ programacion: Programacion }>(
    '/api/maintenance/ingesta/programacion',
    cambios,
  );
  return res.data.programacion;
}

// ── Corpus de entrenamiento (CSV detallado de SUNAT) ─────────────────────────

export interface ValidacionCorpus {
  valido: boolean;
  filas: number;
  columnas_faltantes: string[];
  columnas_extra: string[];
  fecha_min: string | null;
  fecha_max: string | null;
  filas_fecha_invalida: number;
  filas_en_alcance: number;
  filas_nuevas: number;
  filas_ya_presentes: number;
  duplicados_internos: number;
  importadores_nuevos: number;
  puertos_nuevos: string[];
  subpartidas: string[];
  avisos: string[];
}

export interface Incorporacion {
  fecha: string;
  fichero: string;
  usuario?: string;
  filas_nuevas?: number;
  filas_ya_presentes?: number;
  filas_corpus_antes?: number;
  filas_corpus_despues?: number;
  rango?: (string | null)[];
  puertos_nuevos?: string[];
  importadores_nuevos?: number;
  respaldo?: string | null;
}

export interface CorpusEstado {
  ruta: string;
  es_corpus_base: boolean;
  filas: number;
  filas_en_alcance: number;
  fecha_min: string | null;
  fecha_max: string | null;
  fecha_max_en_alcance: string | null;
  n_importadores: number;
  n_puertos: number;
  incorporaciones: Incorporacion[];
  respaldos: string[];
}

/** Las subidas de corpus pueden ser de decenas de MB: el timeout global de 15 s
 *  del cliente las cortaría a mitad. */
const SUBIDA = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000 };

export async function getCorpus(): Promise<CorpusEstado> {
  const res = await apiClient.get<CorpusEstado>('/api/maintenance/corpus');
  return res.data;
}

export async function validarCorpus(file: File): Promise<{ archivo: string; validacion: ValidacionCorpus }> {
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await apiClient.post('/api/maintenance/corpus/validar', fd, SUBIDA);
  return res.data;
}

export async function incorporarCorpus(
  file: File,
): Promise<{ validacion: ValidacionCorpus; fusion: Incorporacion; corpus: CorpusEstado }> {
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await apiClient.post('/api/maintenance/corpus/incorporar', fd, SUBIDA);
  return res.data;
}

export async function restaurarCorpus(nombre: string): Promise<CorpusEstado> {
  const res = await apiClient.post<CorpusEstado>(`/api/maintenance/corpus/restaurar/${nombre}`);
  return res.data;
}

// ── Reentrenamiento orquestado ───────────────────────────────────────────────

export interface ProgresoRetrain {
  en_curso: boolean;
  inicio?: string;
  paso?: number;
  total_pasos?: number;
  paso_nombre?: string;
  corpus?: string;
}

export interface ResultadoRetrain {
  fin: string;
  exito: boolean;
  error: string | null;
  revertido: boolean;
  duracion_s: number;
  mape_antes: number | null;
  mape_despues: number | null;
  delta_mape: number | null;
  aviso?: string | null;
  corpus: string;
  respaldo: string | null;
  logs?: { paso: string; codigo: number; salida: string }[];
}

export interface RespaldoArtifact {
  sello: string;
  mape_test: number | null;
  completo: boolean;
}

export interface RetrainEstado {
  progreso: ProgresoRetrain;
  ultima_ejecucion: string | null;
  ultimo_resultado: ResultadoRetrain | null;
  historial: ResultadoRetrain[];
  respaldos: RespaldoArtifact[];
  pasos: { nombre: string; descripcion: string }[];
}

export async function getRetrainEstado(): Promise<RetrainEstado> {
  const res = await apiClient.get<RetrainEstado>('/api/maintenance/model/retrain');
  return res.data;
}

export async function runRetrain(): Promise<{ mensaje: string }> {
  const res = await apiClient.post('/api/maintenance/model/retrain');
  return res.data;
}

export async function rollbackArtifact(sello: string): Promise<{ mensaje: string; artifact: ArtifactInfo }> {
  const res = await apiClient.post(`/api/maintenance/model/rollback/${sello}`);
  return res.data;
}

// ── Monitor de deriva ────────────────────────────────────────────────────────

export type NivelDrift = 'ok' | 'atencion' | 'critico';

export interface SenalDrift {
  nombre: string;
  nivel: NivelDrift;
  titulo: string;
  detalle: string;
  valor: number | null;
  unidad?: string;
  [k: string]: unknown;
}

export interface DriftDiagnostico {
  fecha: string;
  nivel: NivelDrift;
  veredicto: string;
  senal_dominante: string;
  senales: SenalDrift[];
  no_observable: { titulo: string; detalle: string };
  corpus: CorpusEstado;
}

export async function getDrift(): Promise<DriftDiagnostico> {
  const res = await apiClient.get<DriftDiagnostico>('/api/maintenance/drift');
  return res.data;
}
