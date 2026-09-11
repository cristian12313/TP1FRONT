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
import { usePredictionStatusStore } from '../../store/predictionStatusStore';
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

/** Ancho a partir del cual la barra lateral deja de estorbar (Tailwind `lg`). */
const BREAKPOINT_ESCRITORIO = 1024;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * H-15. La barra lateral era fija de 240 px sin ninguna variante móvil: a
   * 375 px se comía dos tercios de la pantalla y dejaba ~135 px de contenido,
   * con el texto partido en una o dos palabras por línea. Mantenimiento,
   * Usuarios e Historial resultaban inoperables desde un móvil.
   *
   * Por debajo de `lg` la barra pasa a ser un cajón superpuesto que se abre con
   * el botón del header y se cierra al navegar o al tocar el fondo; a partir de
   * `lg` se comporta exactamente como antes (fija y plegable).
   */
  const [esEscritorio, setEsEscritorio] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= BREAKPOINT_ESCRITORIO
  );
  const [cajonAbierto, setCajonAbierto] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${BREAKPOINT_ESCRITORIO}px)`);
    const alCambiar = (e: MediaQueryListEvent | MediaQueryList) => {
      setEsEscritorio(e.matches);
      if (e.matches) setCajonAbierto(false);
    };
    alCambiar(mq);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  // Navegar cierra el cajón: en móvil ocupa toda la pantalla y dejarlo abierto
  // taparía la página recién cargada.
  useEffect(() => { setCajonAbierto(false); }, [location.pathname]);

  // En móvil la barra siempre va expandida: el modo "colapsado" a iconos solo
  // tiene sentido cuando compite por espacio con el contenido.
  const plegada = esEscritorio && collapsed;
  const { mape, mapeRegimen, tiempoMs, ic95Calibrado, horizonteCalibradoMeses } =
    usePredictionStatusStore();

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
      {/* Fondo oscuro del cajón en móvil: cerrar tocando fuera es lo que se
          espera de un cajón, y evita dejarlo abierto tapando la página. */}
      {!esEscritorio && cajonAbierto && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setCajonAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        style={esEscritorio ? { width: collapsed ? 80 : 240 } : undefined}
        className={`bg-primary text-white flex flex-col shrink-0 transition-transform duration-200 ${
          esEscritorio
            ? 'relative z-20 translate-x-0'
            : `fixed inset-y-0 left-0 z-40 w-64 ${cajonAbierto ? 'translate-x-0' : '-translate-x-full'}`
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          {!plegada && (
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
            onClick={() => (esEscritorio ? setCollapsed(!collapsed) : setCajonAbierto(false))}
            aria-label={esEscritorio ? 'Plegar menú' : 'Cerrar menú'}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {esEscritorio && collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
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
                } ${plegada ? 'justify-center border-l-0' : ''}`
              }
            >
              <Icon className="shrink-0" size={18} />
              {!plegada && (
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
              {!plegada && (
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
              {plegada && (
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
              plegada ? 'justify-center' : ''
            }`}
          >
            <LogOut size={18} />
            {!plegada && <span className="ml-3">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ─────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden min-w-0 flex flex-col">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            {/* H-15: única entrada al menú por debajo de `lg`. */}
            <button
              onClick={() => setCajonAbierto(true)}
              aria-label="Abrir menú"
              className="lg:hidden -ml-1 mr-1 p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">
              Modelo: XGBoost v1.0
            </span>

            {/* Estado de la última cotización calculada. Vive aquí (y no en la
                tarjeta de resultado) para que nunca pueda superponerse con el
                contenido de la página — ver store/predictionStatusStore.ts. */}
            {mape !== null && (
              <>
                <span
                  className={`text-[10px] sm:text-xs font-mono px-2 py-1 rounded border ${
                    mapeRegimen === 'extrapolado'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                  title={
                    mapeRegimen === 'extrapolado'
                      ? 'Error esperado con el mercado congelado: la fecha pedida cae fuera del histórico observado.'
                      : 'Error medido sobre el periodo de prueba, con los datos de mercado reales del mes anterior.'
                  }
                >
                  MAPE {mape.toFixed(1)}%{mapeRegimen === 'extrapolado' ? ' · extrapolado' : ''}
                </span>

                {ic95Calibrado === false && (
                  <span
                    className="text-[10px] sm:text-xs font-semibold px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded"
                    title={
                      horizonteCalibradoMeses != null
                        ? `El intervalo de confianza está calibrado hasta ${horizonteCalibradoMeses} meses de extrapolación; esta cotización excede ese horizonte.`
                        : 'Esta cotización excede el horizonte con cobertura garantizada del intervalo de confianza.'
                    }
                  >
                    IC 95% no garantizado
                  </span>
                )}

                {tiempoMs !== null && (
                  <span className="hidden sm:flex items-center gap-1 text-[10px] sm:text-xs font-mono px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {tiempoMs} ms
                  </span>
                )}
              </>
            )}
          </div>
        </header>

        {/* Página activa */}
        <div className="p-4 sm:p-6 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
