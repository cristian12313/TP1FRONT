import { apiClient } from './client';

export interface TrendPoint {
  mes: string;
  estimado: number;
  real: number | null;
}

export interface RouteBar {
  puerto: string;
  flete_promedio: number;
  cantidad: number;
}

export interface OriginSlice {
  origen: string;
  cantidad: number;
  porcentaje: number;
}

export interface DashboardKPIs {
  total_cotizaciones: number;
  mape_global: number | null;
  r2_modelo: number;
  ahorro_promedio_pct: number | null;
  cotizaciones_cerradas: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  tendencia: TrendPoint[];
  por_ruta: RouteBar[];
  distribucion_origen: OriginSlice[];
}

export interface PrecisionMetrics {
  mape_operativo: number | null;
  n_cerradas: number;
  n_total: number;
  n_pendientes: number;
  baseline_manual_pct: number;
  mejora_vs_manual: number | null;
  significativo: boolean;
  mape_modelo_referencia: number;
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await apiClient.get<DashboardData>('/api/dashboard');
  return res.data;
}

export async function getPrecisionMetrics(): Promise<PrecisionMetrics> {
  const res = await apiClient.get<PrecisionMetrics>('/api/dashboard/precision');
  return res.data;
}
