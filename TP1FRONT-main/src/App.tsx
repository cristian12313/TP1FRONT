import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

import Dashboard from './pages/Dashboard';
import NewQuote from './pages/NewQuote';
import HistoryPage from './pages/History';
import UserMgmt from './pages/UserMgmt';
import Maintenance from './pages/Maintenance';
import HelpPage from './pages/Help';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
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
    </BrowserRouter>
  );
}
