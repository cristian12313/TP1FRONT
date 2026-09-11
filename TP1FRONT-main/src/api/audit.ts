import { apiClient } from './client';

export interface AuditLogItem {
  id: number;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function listAuditLog(params: {
  page?: number;
  page_size?: number;
  action?: string;
  user_id?: string;
} = {}): Promise<AuditLogPage> {
  const res = await apiClient.get<AuditLogPage>('/api/audit', { params });
  return res.data;
}
