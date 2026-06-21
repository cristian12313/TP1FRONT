import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Ship, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth';
import Spinner from '../components/shared/Spinner';

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormData) => {
    await authApi.forgotPassword(email);
    setSubmitted(true);
  };

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
          <h1 className="text-2xl font-bold text-primary">Recuperar contraseña</h1>
          <p className="text-slate-500 text-sm mt-1">
            Te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        <div className="p-8">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full">
                <CheckCircle size={32} />
              </div>
              <p className="text-slate-700 font-medium">
                Si tu correo está registrado, recibirás las instrucciones en breve.
              </p>
              <p className="text-slate-500 text-sm">
                Revisa tu bandeja de entrada y carpeta de spam.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline"
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all ${
                      errors.email ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 ml-1">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <><Spinner size={18} /> Enviando…</> : 'Enviar instrucciones'}
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
