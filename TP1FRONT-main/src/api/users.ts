import { apiClient } from './client';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface UserUpdate {
  name?: string;
  role?: string;
}

export async function listUsers(): Promise<{ items: UserItem[]; total: number }> {
  const res = await apiClient.get('/api/users');
  return res.data;
}

export async function createUser(data: UserCreate): Promise<UserItem> {
  const res = await apiClient.post<UserItem>('/api/users', data);
  return res.data;
}

export async function updateUser(id: string, data: UserUpdate): Promise<UserItem> {
  const res = await apiClient.put<UserItem>(`/api/users/${id}`, data);
  return res.data;
}

export async function toggleUserStatus(id: string): Promise<UserItem> {
  const res = await apiClient.patch<UserItem>(`/api/users/${id}/disable`);
  return res.data;
}
