import { apiClient } from './client';

export interface PredictionRequest {
  /** Puerto de EMBARQUE. El origen siempre es China; Busan, Yokohama o Hong Kong
   *  son puertos de transbordo. El nombre del campo lo fija la API desplegada. */
  puerto_origen: string;
  importador?: string;
  peso_kg: number;
  unidades?: number;
  fecha_embarque?: string;
  periodo?: 'semanal' | 'mensual' | 'anual';
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
  /** MAPE del RÉGIMEN en que se sirvió esta predicción, no siempre el de test.
   *  Una cotización extrapolada arrastra el error del escenario de mercado
   *  congelado (~27.5%), no el medido dentro del histórico (~22.2%). */
  mape_modelo: number;
  /** 'historico' | 'extrapolado'. Dice a qué régimen corresponde `mape_modelo`
   *  y, por tanto, si el intervalo se calibró con la Q histórica o con la
   *  extrapolada (≈1.9× más ancha). */
  mape_regimen?: 'historico' | 'extrapolado';
  /** ¿El IC95 está calibrado para esta petición? La constante conformal del
   *  régimen extrapolado se calibra agrupando sobre horizontes de 1 a
   *  `ic95_horizonte_calibrado_meses`. Más allá el intervalo se devuelve igual
   *  pero su cobertura del 95% NO está garantizada, y la UI debe decirlo. */
  ic95_calibrado?: boolean;
  ic95_horizonte_calibrado_meses?: number;
  tiempo_ms: number;
  shap_contribuciones: SHAPContribution[];
  /** Último mes de mercado observado ('YYYY-MM'). Las variables de mercado
   *  concentran ~89% del peso del modelo, así que su vigencia condiciona la
   *  fiabilidad de la estimación. */
  mercado_vigente_hasta: string;
  /** Meses que la fecha pedida se aleja de ese último mercado observado. */
  meses_extrapolados: number;
  /** Aviso legible cuando la cotización se apoya en datos débiles. */
  advertencia?: string | null;
}

export async function estimateFreight(data: PredictionRequest): Promise<PredictionResponse> {
  const res = await apiClient.post<PredictionResponse>('/api/predictions/estimate', data);
  return res.data;
}
