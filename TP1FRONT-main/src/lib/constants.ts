import { User } from '../types';

export const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@jpslogistic.com',     name: 'Admin JPS',          role: 'admin',     status: 'active' },
  { id: '2', email: 'operativo@jpslogistic.com', name: 'Operador Logístico', role: 'operativo', status: 'active' },
  { id: '3', email: 'analista@jpslogistic.com',  name: 'Analista de Datos',  role: 'analista',  status: 'active' },
];
