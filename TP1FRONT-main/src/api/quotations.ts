import { apiClient } from './client';
import { SHAPContribution } from './predictions';

/**
 * Solo los INPUTS del formulario.
 *
 * El backend recalcula la estimación con el modelo y guarda su propio resultado
 * (ver app/services/quotation_service.py). Enviar aquí flete/IC/MAPE dejaba que
 * el cliente fijara el importe de la cotización.
 */
export interface QuotationCreate {
  puerto_origen: string;
  importador?: string;
  peso_kg: number;
  unidades?: number;
  fecha_embarque?: string;
  periodo?: string;
  tipo_contenedor?: string;
  volumen_cbm?: number;
  comentario?: string;
}

export interface QuotationItem {
  id: string;
  code: string;
  puerto_origen: string;
  importador: string | null;
  tipo_contenedor: string | null;
  peso_kg: number;
  unidades: number | null;
  volumen_cbm: number | null;
  fecha_embarque: string | null;
  flete_estimado_usd: number;
  flete_unitario_usd: number | null;
  ic95_min: number;
  ic95_max: number;
  mape_modelo: number;
  /** 'historico' | 'extrapolado'; null en cotizaciones previas a la migración 004. */
  mape_regimen?: string | null;
  tiempo_ms: number;
  shap_contribuciones: SHAPContribution[] | null;
  estado: string;
  costo_real_usd: number | null;
  error_pct: number | null;
  comentario: string | null;
  usuario_nombre: string | null;
  created_at: string;
}

export interface QuotationListResponse {
  items: QuotationItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
  origen?: string;
  date_from?: string;
  date_to?: string;
  estado?: string;
}

export async function createQuotation(data: QuotationCreate): Promise<QuotationItem> {
  const res = await apiClient.post<QuotationItem>('/api/quotations', data);
  return res.data;
}

export async function listQuotations(params: ListParams = {}): Promise<QuotationListResponse> {
  const res = await apiClient.get<QuotationListResponse>('/api/quotations', { params });
  return res.data;
}

export async function updateActualCost(id: string, costo_real_usd: number): Promise<QuotationItem> {
  const res = await apiClient.patch<QuotationItem>(`/api/quotations/${id}/actual-cost`, { costo_real_usd });
  return res.data;
}

export function getPdfUrl(id: string): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
  return `${base}/api/quotations/${id}/pdf`;
}
