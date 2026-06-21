import { apiClient } from './client';

export interface PredictionRequest {
  puerto_origen: string;
  tipo_contenedor: string;
  peso_kg: number;
  unidades?: number;
  volumen_cbm?: number;
  fecha_embarque?: string;
}

export interface SHAPContribution {
  variable: string;
  aporte: number;
  direction: 'positive' | 'negative';
}

export interface PredictionResponse {
  flete_estimado_usd: number;
  ic95_min: number;
  ic95_max: number;
  mape_modelo: number;
  tiempo_ms: number;
  shap_contribuciones: SHAPContribution[];
}

export async function estimateFreight(data: PredictionRequest): Promise<PredictionResponse> {
  const res = await apiClient.post<PredictionResponse>('/api/predictions/estimate', data);
  return res.data;
}
