import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Clock, Edit2, Loader2, RefreshCw, Search, Shield,
  UserCheck, UserMinus, UserPlus, X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  UserItem, createUser, listUsers, toggleUserStatus, updateUser,
} from '../api/users';
import { AuditLogItem, listAuditLog } from '../api/audit';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/shared/Spinner';
import { ROLE_LABELS, UserRole } from '../types';

const ROLES: UserRole[] = ['admin', 'operativo', 'analista'];

/** Mínimo 8 caracteres, una mayúscula y un número. Igual que app/routers/users.py. */
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function errorMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

/** Traduce una acción del audit_log a una frase legible. */
function describirAccion(log: AuditLogItem): string {
  const d = (log.details ?? {}) as Record<string, unknown>;
  switch (log.action) {
    case 'login':
      return 'Inicio de sesión';
    case 'login_failed':
      return `Intento de inicio de sesión fallido${d.attempts ? ` (intento ${d.attempts})` : ''}`;
    case 'cotizacion_creada':
      return `Cotización generada${d.code ? ` ${d.code}` : ''}`;
    case 'costo_real_registrado':
      return `Costo real registrado${d.costo_real_usd ? ` — USD ${Number(d.costo_real_usd).toLocaleString('en-US')}` : ''}`;
    default:
      return log.action;
  }
}

const badgeRol = (rol: string) =>
  rol === 'admin'
    ? 'bg-primary text-white border-primary'
    : rol === 'operativo'
      ? 'bg-accent/10 text-accent border-accent/20'
      : 'bg-slate-100 text-slate-500 border-slate-200';

export default function UserMgmt() {
  const yo = useAuthStore(s => s.user);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [cargandoLogs, setCargandoLogs] = useState(true);

  const [modal, setModal] = useState<'crear' | 'editar' | null>(null);
  const [editando, setEditando] = useState<UserItem | null>(null);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const data = await listUsers();
      setUsers(data.items);
    } catch (e) {
      setErrorCarga(errorMsg(e, 'No se pudo cargar la lista de usuarios.'));
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarLogs = useCallback(async () => {
    setCargandoLogs(true);
    try {
      const data = await listAuditLog({ page_size: 10 });
      setLogs(data.items);
    } catch {
      setLogs([]);
    } finally {
      setCargandoLogs(false);
    }
  }, []);

  useEffect(() => { cargarUsuarios(); cargarLogs(); }, [cargarUsuarios, cargarLogs]);

  const nombrePorId = useMemo(
    () => Object.fromEntries(users.map(u => [u.id, u.name])),
    [users],
  );

  /** Nadie puede desactivarse ni degradarse a sí mismo: dejaría el sistema sin admin. */
  const esYo = (u: UserItem) => u.id === yo?.id;

  const handleToggle = async (u: UserItem) => {
    if (esYo(u)) {
      toast.error('No puedes desactivar tu propia cuenta.');
      return;
    }
    setOcupado(u.id);
    try {
      const actualizado = await toggleUserStatus(u.id);
      setUsers(prev => prev.map(x => (x.id === u.id ? actualizado : x)));
      toast.success(
        actualizado.status === 'active'
          ? `${actualizado.name} reactivado.`
          : `${actualizado.name} desactivado.`,
      );
      cargarLogs();
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo cambiar el estado del usuario.'));
    } finally {
      setOcupado(null);
    }
  };

  const filtrados = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { cargarUsuarios(); cargarLogs(); }}
            disabled={cargando}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
            Refrescar
          </button>
          <button
            onClick={() => { setEditando(null); setModal('crear'); }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold shadow-lg hover:bg-accent/90 transition-all active:scale-95"
          >
            <UserPlus size={18} />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {errorCarga ? (
          <div className="flex items-center gap-2 p-6 text-sm text-red-700 bg-red-50">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorCarga}</span>
          </div>
        ) : cargando ? (
          <div className="flex items-center justify-center gap-3 p-12 text-slate-400 text-sm">
            <Spinner size={20} /> Cargando usuarios…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            {searchTerm ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados.'}
          </div>
        ) : (
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
                {filtrados.map(user => {
                  const activo = user.status === 'active';
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {user.name}
                              {esYo(user) && (
                                <span className="ml-2 text-[10px] font-bold text-accent uppercase">tú</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={`flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeRol(user.role)}`}>
                            <Shield size={10} className="mr-1" />
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggle(user)}
                          disabled={ocupado === user.id || esYo(user)}
                          title={esYo(user) ? 'No puedes desactivar tu propia cuenta' : activo ? 'Desactivar' : 'Reactivar'}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                            activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {ocupado === user.id ? (
                            <Loader2 size={12} className="mr-1 animate-spin" />
                          ) : activo ? (
                            <UserCheck size={12} className="mr-1" />
                          ) : (
                            <UserMinus size={12} className="mr-1" />
                          )}
                          {activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => { setEditando(user); setModal('editar'); }}
                            title="Editar nombre y rol"
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Registro de actividad (audit_log real) ────────────────────────── */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="text-slate-400" size={18} />
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Registro de Actividad Reciente
            </h4>
          </div>
          <button
            onClick={cargarLogs}
            disabled={cargandoLogs}
            className="text-[10px] font-bold text-slate-400 hover:text-accent uppercase tracking-widest disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
        {cargandoLogs ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
            <Spinner size={14} /> Cargando registro…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">Todavía no hay actividad registrada.</p>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs border-b border-slate-200/50 pb-2 last:border-0"
              >
                <span className="text-slate-700 font-medium">
                  {describirAccion(log)}
                  {log.user_id && nombrePorId[log.user_id] && (
                    <span className="text-slate-400"> — {nombrePorId[log.user_id]}</span>
                  )}
                </span>
                <span className="text-slate-400 italic shrink-0">{fmtFecha(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          modo={modal}
          usuario={editando}
          onCerrar={() => { setModal(null); setEditando(null); }}
          onGuardado={(u, creado) => {
            setUsers(prev => (creado ? [...prev, u] : prev.map(x => (x.id === u.id ? u : x))));
            setModal(null);
            setEditando(null);
            cargarLogs();
          }}
          esMiCuenta={editando ? editando.id === yo?.id : false}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function UserModal({
  modo, usuario, onCerrar, onGuardado, esMiCuenta,
}: {
  modo: 'crear' | 'editar';
  usuario: UserItem | null;
  onCerrar: () => void;
  onGuardado: (u: UserItem, creado: boolean) => void;
  esMiCuenta: boolean;
}) {
  const [name, setName] = useState(usuario?.name ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>(usuario?.role ?? 'operativo');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState('');

  const validar = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'El nombre debe tener al menos 2 caracteres.';
    if (modo === 'crear') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Ingresa un correo válido.';
      if (!PASSWORD_RE.test(password)) {
        e.password = 'Mínimo 8 caracteres, una mayúscula y un número.';
      }
    }
    if (modo === 'editar' && esMiCuenta && role !== usuario?.role) {
      e.role = 'No puedes cambiar tu propio rol: podrías perder el acceso de administrador.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    setApiError('');
    if (!validar()) return;
    setGuardando(true);
    try {
      if (modo === 'crear') {
        const u = await createUser({ name: name.trim(), email: email.trim(), password, role });
        toast.success(`Usuario ${u.name} creado.`);
        onGuardado(u, true);
      } else if (usuario) {
        const cambios: { name?: string; role?: string } = {};
        if (name.trim() !== usuario.name) cambios.name = name.trim();
        if (role !== usuario.role) cambios.role = role;
        if (Object.keys(cambios).length === 0) { onCerrar(); return; }
        const u = await updateUser(usuario.id, cambios);
        toast.success(`Usuario ${u.name} actualizado.`);
        onGuardado(u, false);
      }
    } catch (e) {
      setApiError(errorMsg(e, 'No se pudo guardar el usuario. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-primary">
            {modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
          </h3>
          <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {apiError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 ${errores.name ? 'border-red-400' : 'border-slate-200'}`}
            />
            {errores.name && <p className="text-xs text-red-500">{errores.name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo electrónico</label>
            <input
              type="email" value={email} disabled={modo === 'editar'}
              onChange={e => setEmail(e.target.value)}
              placeholder="ejemplo@jpslogistic.com"
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 disabled:text-slate-400 disabled:cursor-not-allowed ${errores.email ? 'border-red-400' : 'border-slate-200'}`}
            />
            {modo === 'editar' && (
              <p className="text-xs text-slate-400">El correo no se puede modificar.</p>
            )}
            {errores.email && <p className="text-xs text-red-500">{errores.email}</p>}
          </div>

          {modo === 'crear' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres, una mayúscula y un número"
                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 ${errores.password ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errores.password && <p className="text-xs text-red-500">{errores.password}</p>}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rol de acceso</label>
            <select
              value={role} onChange={e => setRole(e.target.value)}
              disabled={modo === 'editar' && esMiCuenta}
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 disabled:text-slate-400 disabled:cursor-not-allowed ${errores.role ? 'border-red-400' : 'border-slate-200'}`}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {modo === 'editar' && esMiCuenta && (
              <p className="text-xs text-slate-400">
                No puedes cambiar tu propio rol: perderías el acceso de administrador.
              </p>
            )}
            {errores.role && <p className="text-xs text-red-500">{errores.role}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-slate-100">
          <button
            onClick={onCerrar}
            className="px-5 py-3 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={guardar} disabled={guardando}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold text-sm shadow-lg hover:bg-accent/90 transition-all active:scale-95 disabled:opacity-60"
          >
            {guardando && <Spinner size={16} />}
            {modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
