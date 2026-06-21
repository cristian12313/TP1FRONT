import { apiClient } from './client';
import type { LoginResponse } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/api/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, new_password: string): Promise<void> => {
    await apiClient.post('/api/auth/reset-password', { token, new_password });
  },

  refresh: async (refresh_token: string): Promise<{ access_token: string }> => {
    const { data } = await apiClient.post('/api/auth/refresh', { refresh_token });
    return data;
  },
};
