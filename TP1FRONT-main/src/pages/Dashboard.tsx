import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Quote, Target, Zap, TrendingUp, RefreshCw, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { getDashboard, getPrecisionMetrics, DashboardData, PrecisionMetrics } from '../api/dashboard';

const COLORS = ['#0B3D5C', '#F26B1F', '#FACC15', '#4ADE80', '#94A3B8', '#818CF8'];

const KPICard = ({ title, value, subtext, icon: Icon }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start">
    <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mr-4 shrink-0">
      <Icon size={20} />
    </div>
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {subtext && <p className="text-xs text-slate-500 uppercase font-medium mt-1">{subtext}</p>}
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [precision, setPrecision] = useState<PrecisionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dashRes, precRes] = await Promise.all([getDashboard(), getPrecisionMetrics()]);
      setData(dashRes);
      setPrecision(precRes);
    } catch {
      toast.error('No se pudieron cargar los datos del dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Cargando métricas...</p>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, tendencia, por_ruta, distribucion_origen } = data;

  const routeData = por_ruta.map(r => ({ name: r.puerto, flete: r.flete_promedio }));
  const originData = distribucion_origen.map(o => ({ name: o.origen, value: o.cantidad }));
  const trendData = tendencia.map(t => ({ mes: t.mes, estimado: t.estimado, real: t.real }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Vista General Prescriptiva</h2>
          <p className="text-xs text-slate-500">Métricas consolidadas de precisión y rendimiento</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          title="Total Cotizaciones"
          value={kpis.total_cotizaciones.toLocaleString()}
          subtext={`${kpis.cotizaciones_cerradas} cerradas`}
          icon={Quote}
        />
        <KPICard
          title="MAPE Global"
          value={kpis.mape_global != null ? `${kpis.mape_global.toFixed(1)}%` : 'N/A'}
          subtext="error medio absoluto"
          icon={Target}
        />
        <KPICard
          title="R² del Modelo"
          value={kpis.r2_modelo.toFixed(3)}
          subtext="coeficiente determinación"
          icon={Zap}
        />
        <KPICard
          title="Ahorro Promedio"
          value={kpis.ahorro_promedio_pct != null ? `${kpis.ahorro_promedio_pct.toFixed(1)}%` : 'Sin datos'}
          subtext="vs costo real"
          icon={TrendingUp}
        />
      </div>

      {/* Precisión operativa HU-28 */}
      {precision && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Precisión Operativa del Sistema</h3>
              <p className="text-xs text-slate-500 mt-0.5">MAPE calculado sobre cotizaciones con costo real registrado</p>
            </div>
            <Target size={18} className="text-slate-400" />
          </div>

          {/* Aviso de muestra insuficiente */}
          {!precision.significativo && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                Muestra insuficiente — N&nbsp;=&nbsp;{precision.n_cerradas}
                {precision.n_cerradas === 0
                  ? '. Aún sin cotizaciones cerradas con costo real. La métrica estará disponible cuando se registren costos reales.'
                  : ` (mínimo recomendado: 20). Métrica preliminar, interpretar con cautela.`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* MAPE operativo */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">MAPE Operativo</p>
              {precision.mape_operativo !== null ? (
                <>
                  <p className="text-2xl font-bold text-slate-800">{precision.mape_operativo.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500 mt-1">sobre {precision.n_cerradas} cotización{precision.n_cerradas !== 1 ? 'es' : ''} cerrada{precision.n_cerradas !== 1 ? 's' : ''}</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-400">—</p>
                  <p className="text-xs text-slate-400 mt-1">sin datos aún</p>
                </>
              )}
            </div>

            {/* Vs baseline manual */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vs. Método Manual JPS</p>
              {precision.mejora_vs_manual !== null ? (
                <>
                  <div className="flex items-center gap-2">
                    {precision.mejora_vs_manual >= 0 ? (
                      <CheckCircle size={18} className="text-green-500 shrink-0" />
                    ) : (
                      <TrendingDown size={18} className="text-red-500 shrink-0" />
                    )}
                    <p className={`text-2xl font-bold ${precision.mejora_vs_manual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {precision.mejora_vs_manual >= 0 ? '-' : '+'}{Math.abs(precision.mejora_vs_manual).toFixed(1)}pp
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {precision.mejora_vs_manual >= 0
                      ? `Sistema: ${precision.mape_operativo!.toFixed(1)}% vs manual: ${precision.baseline_manual_pct}%`
                      : `Sistema supera al manual (${precision.baseline_manual_pct}%)`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-400">—</p>
                  <p className="text-xs text-slate-500 mt-1">Referencia manual: {precision.baseline_manual_pct}%</p>
                </>
              )}
            </div>

            {/* MAPE modelo (referencia) */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">MAPE Modelo (referencia)</p>
              <p className="text-2xl font-bold text-slate-400">{precision.mape_modelo_referencia.toFixed(1)}%</p>
              <p className="text-xs text-slate-400 mt-1">test histórico de entrenamiento — no es meta operativa</p>
            </div>
          </div>

          {/* Barra de contexto N */}
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <span>{precision.n_total} cotizaciones totales</span>
            <span className="text-slate-300">|</span>
            <span className="text-green-600 font-medium">{precision.n_cerradas} cerradas</span>
            <span className="text-slate-300">|</span>
            <span>{precision.n_pendientes} pendientes (sin costo real)</span>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tendencia mensual */}
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Flete Estimado vs Real (USD promedio mensual)</h3>
          {trendData.some(t => t.estimado > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`} />
                <Legend />
                <Line type="monotone" dataKey="estimado" name="Estimado" stroke="#0B3D5C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="real" name="Real" stroke="#F26B1F" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">Sin cotizaciones aún</div>
          )}
        </div>

        {/* Distribución origen */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Distribución por Origen</h3>
          {originData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={originData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" nameKey="name">
                  {originData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any, name: any) => [v, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* Flete por ruta */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Flete Promedio por Puerto de Origen (USD)</h3>
        {routeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={routeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="flete" name="Flete Promedio" radius={[4, 4, 0, 0]}>
                {routeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin datos suficientes</div>
        )}
      </div>
    </div>
  );
}
