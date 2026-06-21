// ─── Roles alineados con el backend ──────────────────────────────────────────
export type UserRole = 'admin' | 'operativo' | 'analista';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  operativo: 'Operador logístico',
  analista: 'Analista',
};

// Mantiene compatibilidad con páginas existentes
export enum Role {
  ADMIN = 'admin',
  OPERADOR = 'operativo',
  ANALISTA = 'analista',
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

// ─── Cotizaciones ─────────────────────────────────────────────────────────────
export interface QuoteInput {
  origen: string;
  contenedor: string;
  peso: number;
  volumen?: number;
  fechaEmbarque?: string;
}

export interface SHAPContribution {
  variable: string;
  aporte: number;
  direction?: 'positive' | 'negative';
}

export interface QuoteResult {
  id: string;
  fechaCotizacion: string;
  input: QuoteInput;
  estimado: number;
  ic95Min: number;
  ic95Max: number;
  contribuciones: SHAPContribution[];
  mape: number;
  tiempoMs: number;
  estado: 'Pendiente' | 'Cerrada con Costo Real';
  costoReal?: number;
  comentario?: string;
  operador?: string;
}

export interface ComparisonRecord {
  id: string;
  fecha: string;
  valorReal: number;
  manual: number;
  modelo: number;
}

// Alias para compatibilidad con código existente que usa User
export type User = AuthUser;
