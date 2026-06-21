/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  MoreVertical, 
  Shield, 
  Clock, 
  Trash2, 
  UserCheck, 
  UserMinus,
  Edit2
} from 'lucide-react';
import { MOCK_USERS } from '../lib/constants';
import { Role, User } from '../types';

export default function UserMgmt() {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleUserStatus = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/50 outline-none shadow-sm transition-all"
          />
        </div>
        <button 
          onClick={() => alert('Toast: Modal para crear nuevo usuario abierto.')}
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-accent text-white rounded-xl font-bold shadow-lg hover:bg-accent/90 transition-all active:scale-95"
        >
          <UserPlus size={18} />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Rol de Acceso</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        user.role === Role.ADMIN ? 'bg-primary text-white border-primary' : 
                        user.role === Role.OPERADOR ? 'bg-accent/10 text-accent border-accent/20' : 
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        <Shield size={10} className="mr-1" />
                        {user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleUserStatus(user.id)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        user.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {user.active ? <UserCheck size={12} className="mr-1" /> : <UserMinus size={12} className="mr-1" />}
                      {user.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end space-x-3">
                      <button className="p-2 text-slate-300 hover:text-primary transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="text-slate-400" size={18} />
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Registro de Actividad Reciente</h4>
        </div>
        <div className="space-y-3">
          {[
            { action: 'Usuario admin@jpslogistic.com inició sesión', time: 'Hace 5 minutos' },
            { action: 'Se generó cotización JPS-20260501-1244', time: 'Hace 12 minutos' },
            { action: 'El analista exportó reporte de comparación (Excel)', time: 'Hace 1 hora' },
            { action: 'Cambio de contraseña para operador@jpslogistic.com', time: 'Hace 3 horas' }
          ].map((log, i) => (
            <div key={i} className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-2">
              <span className="text-slate-700 font-medium">{log.action}</span>
              <span className="text-slate-400 italic">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
