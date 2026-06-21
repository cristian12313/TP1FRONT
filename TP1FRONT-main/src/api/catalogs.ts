import { apiClient } from './client';

export interface Port {
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

export async function getContainerTypes(): Promise<ContainerType[]> {
  const res = await apiClient.get<ContainerType[]>('/api/catalogs/container-types');
  return res.data;
}

export async function getAppConfig(): Promise<{ destination_port: string }> {
  const res = await apiClient.get<{ destination_port: string }>('/api/catalogs/app-config');
  return res.data;
}
