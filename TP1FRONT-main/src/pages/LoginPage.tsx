import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Ship, Lock, Mail, ChevronDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/shared/Spinner';
import type { UserRole } from '../types';

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});
type FormData = z.infer<typeof schema>;

const DEMO_USERS = [
  { name: 'Admin JPS',           email: 'admin@jpslogistic.com',      password: 'Admin123!',      role: 'admin' as UserRole },
  { name: 'Operador Logístico',  email: 'operativo@jpslogistic.com',  password: 'Operativo123!',  role: 'operativo' as UserRole },
  { name: 'Analista de Datos',   email: 'analista@jpslogistic.com',   password: 'Analista123!',   role: 'analista' as UserRole },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  operativo: 'Operador logístico',
  analista: 'Analista',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, password }: FormData) => {
    setApiError('');
    try {
      const user = await login(email, password);
      toast.success(`Bienvenido, ${user.name}`);
      // Redirige según rol
      if (user.role === 'analista') navigate('/dashboard');
      else if (user.role === 'admin') navigate('/usuarios');
      else navigate('/cotizaciones/nueva');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 423) {
          setApiError('Cuenta bloqueada por 15 minutos debido a múltiples intentos fallidos.');
        } else if (status === 401) {
          setApiError('Usuario o contraseña incorrectos.');
        } else if (!err.response) {
          setApiError('No se pudo conectar con el servidor. Asegúrate de que el backend esté corriendo.');
        } else {
          setApiError('Error inesperado. Intenta de nuevo.');
        }
      }
    }
  };

  const selectDemo = (user: typeof DEMO_USERS[0]) => {
    setValue('email', user.email, { shouldValidate: true });
    setValue('password', user.password, { shouldValidate: true });
    setShowDemo(false);
    setApiError('');
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col p-4 relative overflow-y-auto overflow-x-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-white rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full m-auto bg-white rounded-2xl shadow-2xl relative z-10"
      >
        {/* Header */}
        <div className="p-8 pb-0 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 text-accent rounded-2xl mb-4">
            <Ship size={32} />
          </div>
          <h1 className="text-2xl font-bold text-primary">FreightIQ</h1>
          <p className="text-slate-500 text-sm mt-1">Estimador de Flete Marítimo — JPS Logistic</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-5">
          {/* Error de API */}
          {apiError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                {...register('email')}
                type="email"
                placeholder="ejemplo@jpslogistic.com"
                autoComplete="email"
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all ${
                  errors.email ? 'border-red-400' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500 ml-1">{errors.email.message}</p>
            )}
          </div>

          {/* Contraseña */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all ${
                  errors.password ? 'border-red-400' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 ml-1">{errors.password.message}</p>
            )}
          </div>

          {/* Recordarme + ¿Olvidaste? */}
          <div className="flex items-center justify-between">
            <label className="flex items-center text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" className="mr-2 rounded border-slate-300 text-accent focus:ring-accent" />
              Recordarme
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-bold text-accent hover:underline"
            >
              ¿Olvidó su contraseña?
            </Link>
          </div>

          {/* Botón submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner size={18} />
                Iniciando sesión…
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>

          {/* Separador demo */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">Demostración</span>
            </div>
          </div>

          {/* Selector de usuario demo */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDemo(!showDemo)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span>Seleccionar Usuario Demo</span>
              <ChevronDown size={16} className={`transition-transform ${showDemo ? 'rotate-180' : ''}`} />
            </button>
            {showDemo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
              >
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => selectDemo(u)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group border-b border-slate-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-accent transition-colors">
                        {u.name}
                      </p>
                      <p className="text-xs text-slate-500">{ROLE_LABELS[u.role]}</p>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase">
                      {u.role}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </form>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center rounded-b-2xl">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">
            © 2026 JPS Logistic S.A.C. — FreightIQ v1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}
