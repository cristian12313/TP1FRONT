import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Ship, Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api/auth';
import Spinner from '../components/shared/Spinner';

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ new_password }: FormData) => {
    try {
      await authApi.resetPassword(token!, new_password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      toast.error('El enlace es inválido o ha expirado. Solicita uno nuevo.');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <p className="text-red-600 font-medium mb-4">Enlace inválido.</p>
          <Link to="/forgot-password" className="text-accent font-bold hover:underline">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-white rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full m-auto bg-white rounded-2xl shadow-2xl relative z-10"
      >
        <div className="p-8 pb-0 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 text-accent rounded-2xl mb-4">
            <Ship size={32} />
          </div>
          <h1 className="text-2xl font-bold text-primary">Nueva contraseña</h1>
          <p className="text-slate-500 text-sm mt-1">
            Mínimo 8 caracteres, una mayúscula y un número
          </p>
        </div>

        <div className="p-8">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full">
                <CheckCircle size={32} />
              </div>
              <p className="text-slate-700 font-medium">
                ¡Contraseña actualizada! Redirigiendo al login…
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Nueva contraseña */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    {...register('new_password')}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all ${
                      errors.new_password ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="text-xs text-red-500 ml-1">{errors.new_password.message}</p>
                )}
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    {...register('confirm_password')}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all ${
                      errors.confirm_password ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-red-500 ml-1">{errors.confirm_password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <><Spinner size={18} /> Guardando…</> : 'Guardar nueva contraseña'}
              </button>

              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </form>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center rounded-b-2xl">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">
            © 2026 JPS Logistic S.A.C. — FreightIQ v1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}
