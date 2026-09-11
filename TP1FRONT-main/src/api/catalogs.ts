import { apiClient } from './client';

export interface Port {
  key: string;
  name: string;
}

export interface Importador {
  key: string;
  name: string;
}

export interface ContainerType {
  id: string;
  code: string;
  name: string;
  volume_cbm: number;
  max_weight_kg: number;
}

export async function getPorts(): Promise<Port[]> {
  const res = await apiClient.get<Port[]>('/api/catalogs/ports');
  return res.data;
}

export async function getImportadores(): Promise<Importador[]> {
  const res = await apiClient.get<Importador[]>('/api/catalogs/importadores');
  return res.data;
}

export async function getContainerTypes(): Promise<ContainerType[]> {
  const res = await apiClient.get<ContainerType[]>('/api/catalogs/container-types');
  return res.data;
}

export interface AppConfig {
  destination_port: string;
  /** Rango cotizable, DERIVADO del artifact en el backend. No duplicar estos
   *  límites en el frontend: al reentrenar con otro periodo se desincronizan
   *  y la UI acaba ofreciendo fechas que el backend rechaza. */
  fecha_min: string;
  fecha_max: string;
  ic95_horizonte_calibrado_meses: number;
}

export async function getAppConfig(): Promise<AppConfig> {
  const res = await apiClient.get<AppConfig>('/api/catalogs/app-config');
  return res.data;
}
