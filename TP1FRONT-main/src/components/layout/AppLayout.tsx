import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  History,
  Info,
  Layers,
  LogOut,
  Menu,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

interface NavItem {
  path: string;
  label: string;
  Icon: React.ElementType<{ size?: number; className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',          label: 'Dashboard Estratégico', Icon: BarChart3,   roles: ['admin', 'analista'] },
  { path: '/cotizaciones/nueva', label: 'Nueva Cotización',      Icon: Calculator,  roles: ['admin', 'operativo', 'analista'] },
  { path: '/historial',          label: 'Historial',             Icon: History,     roles: ['admin', 'operativo', 'analista'] },
  { path: '/usuarios',           label: 'Gestión Usuarios',      Icon: Users,       roles: ['admin'] },
  { path: '/mantenimiento',      label: 'Mantenimiento ML',      Icon: Layers,      roles: ['admin'] },
  { path: '/ayuda',              label: 'Ayuda y FAQs',          Icon: Info,        roles: ['admin', 'operativo', 'analista'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cierre por inactividad 30 min (HU-04) ───────────────────────────────────
  const resetTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      toast.error('Sesión cerrada por inactividad.');
      await logout();
    }, INACTIVITY_MS);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  const allowedItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role as UserRole)
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 240 }}
        className="bg-primary text-white flex flex-col relative z-20 shrink-0"
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <Calculator size={20} className="text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">
                  Freight<span className="text-accent">IQ</span>
                </h1>
              </div>
              <span className="text-[10px] text-white/50 mt-1 uppercase tracking-widest font-semibold">
                JPS Logistic S.A.C.
              </span>
            </motion.div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {allowedItems.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `w-full flex items-center px-4 py-2 text-sm cursor-pointer transition-colors border-l-4 ${
                  isActive
                    ? 'text-white bg-white/10 font-medium border-accent'
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent'
                } ${collapsed ? 'justify-center border-l-0' : ''}`
              }
            >
              <Icon className="shrink-0" size={18} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="ml-3 whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Usuario + Logout */}
        <div className="p-4 border-t border-white/10 mt-auto space-y-2">
          {user && (
            <>
              {!collapsed && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-accent flex items-center justify-center font-bold text-xs uppercase text-white shrink-0">
                    {user.name.substring(0, 2)}
                  </div>
                  <div className="flex-1 overflow-hidden text-left">
                    <p className="text-xs font-bold truncate">{user.name}</p>
                    <p className="text-[10px] text-white/40 truncate uppercase font-semibold">
                      {user.role}
                    </p>
                  </div>
                </div>
              )}
              {collapsed && (
                <div className="flex justify-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-accent flex items-center justify-center font-bold text-xs uppercase text-white">
                    {user.name.substring(0, 2)}
                  </div>
                </div>
              )}
            </>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center px-4 py-2 text-sm text-white/60 cursor-pointer hover:bg-white/5 hover:text-white transition-colors rounded ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={18} />
            {!collapsed && <span className="ml-3">Cerrar Sesión</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Contenido principal ─────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden min-w-0 flex flex-col">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">
              Modelo: XGBoost v1.0
            </span>
            <span className="hidden sm:inline text-[10px] sm:text-xs text-slate-400 font-medium">
              MAPE Global: — | R²: —
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Tipo de Cambio</p>
              <p className="text-xs sm:text-sm font-bold text-primary">S/ —</p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Bunker Fuel</p>
              <p className="text-xs sm:text-sm font-bold text-primary">$ —</p>
            </div>
          </div>
        </header>

        {/* Página activa */}
        <div className="p-6 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
