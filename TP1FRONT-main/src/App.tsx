import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Spinner from './components/shared/Spinner';

import LoginPage from './pages/LoginPage';

/**
 * H-28. Todo iba en un unico chunk de 1.08 MB (324 kB comprimidos), incluidos
 * `recharts` —que solo usa el Dashboard— y los paneles de Mantenimiento, que
 * solo ve un administrador. La pantalla de login tenia que descargar la
 * aplicacion entera antes de pintarse.
 *
 * `LoginPage` se mantiene en el chunk principal porque es la primera pantalla
 * de todo usuario no autenticado: cargarla en diferido anadiria un salto de red
 * justo donde mas se nota.
 */
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewQuote = lazy(() => import('./pages/NewQuote'));
const HistoryPage = lazy(() => import('./pages/History'));
const UserMgmt = lazy(() => import('./pages/UserMgmt'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const HelpPage = lazy(() => import('./pages/Help'));

function Cargando() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh] gap-3 text-slate-400 text-sm">
      <Spinner size={20} /> Cargando…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Suspense fallback={<Cargando />}>
      <Routes>
        {/* ── Rutas públicas ──────────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* ── Rutas protegidas (requieren auth) ──────────────────────────── */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['analista', 'admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/cotizaciones/nueva" element={<NewQuote />} />
          <Route path="/historial" element={<HistoryPage />} />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserMgmt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mantenimiento"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Maintenance />
              </ProtectedRoute>
            }
          />
          <Route path="/ayuda" element={<HelpPage />} />
          <Route
            path="/sin-permisos"
            element={
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                <span className="text-6xl">🚫</span>
                <p className="text-xl font-bold text-slate-700">Acceso denegado</p>
                <p className="text-sm">No tienes permisos para ver esta página.</p>
              </div>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/cotizaciones/nueva" replace />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-primary flex items-center justify-center text-white">
              <div className="text-center">
                <p className="text-8xl font-bold">404</p>
                <p className="mt-2 text-white/60">Página no encontrada</p>
              </div>
            </div>
          }
        />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
