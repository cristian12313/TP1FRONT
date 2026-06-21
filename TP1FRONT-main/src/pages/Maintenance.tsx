import React, { useState, useEffect } from 'react';
import { UploadCloud, Database, AlertCircle, TrendingUp, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getMarketRates, updateMarketRates, MarketRates } from '../api/maintenance';

export default function Maintenance() {
  const [isUploading, setIsUploading] = useState(false);

  // Tasas de mercado
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [editRates, setEditRates] = useState<MarketRates>({ lag1: 0, lag2: 0, lag3: 0 });
  const [loadingRates, setLoadingRates] = useState(true);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    setLoadingRates(true);
    getMarketRates()
      .then(data => {
        setRates(data);
        setEditRates(data);
      })
      .catch(() => toast.error('No se pudieron cargar las tasas de mercado.'))
      .finally(() => setLoadingRates(false));
  }, []);

  const handleSaveRates = async () => {
    if (editRates.lag1 <= 0 || editRates.lag2 <= 0 || editRates.lag3 <= 0) {
      toast.error('Todas las tasas deben ser valores positivos.');
      return;
    }
    setSavingRates(true);
    try {
      const updated = await updateMarketRates(editRates);
      setRates(updated);
      toast.success('Tasas de mercado actualizadas. El modelo usará estos valores inmediatamente.');
    } catch {
      toast.error('No se pudieron guardar las tasas. Verifique que sea administrador.');
    } finally {
      setSavingRates(false);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      alert('Archivo cargado para reentrenamiento.');
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Panel de Tasas de Mercado ───────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Tasas de Mercado de Referencia</h2>
            <p className="text-xs text-slate-500">Flete unitario promedio (USD/kg) de los últimos 3 meses. Actualizar mensualmente.</p>
          </div>
        </div>

        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800 mb-5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>Estos valores son features del modelo XGBoost (lag1, lag2, lag3). Mantenerlos actualizados mejora la precisión de las predicciones.</span>
        </div>

        {loadingRates ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <RefreshCw size={16} className="animate-spin" /> Cargando tasas actuales…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: 'lag1' as const, label: 'Mes actual (lag1)', hint: 'Promedio último mes' },
                { key: 'lag2' as const, label: 'Mes anterior (lag2)', hint: 'Promedio hace 2 meses' },
                { key: 'lag3' as const, label: 'Hace 3 meses (lag3)', hint: 'Promedio hace 3 meses' },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={editRates[key]}
                      onChange={e => setEditRates(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-7 pr-12 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">USD/kg</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
                </div>
              ))}
            </div>

            {rates && (
              <p className="text-xs text-slate-400">
                Valores en uso actualmente: lag1={rates.lag1} · lag2={rates.lag2} · lag3={rates.lag3} USD/kg
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveRates}
                disabled={savingRates}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingRates
                  ? <><RefreshCw size={14} className="animate-spin" /> Guardando…</>
                  : <><Save size={14} /> Actualizar Tasas</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Reentrenamiento del Modelo ──────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
          <Database size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Reentrenamiento del Modelo</h2>
        <p className="text-sm text-slate-500 mb-8 max-w-md">Sube nuevos datos de importaciones de llantas reales en formato CSV para volver a entrenar el modelo predictivo (XGBoost).</p>

        <div className="w-full max-w-md bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-left">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-700">
            <span>Última fecha de actualización:</span>
            <span className="text-primary bg-primary/5 px-2 py-1 rounded">2026-04-18</span>
          </div>
        </div>

        <form onSubmit={handleUpload} className="w-full max-w-md border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 transition-colors">
          <div className="flex flex-col items-center">
            <UploadCloud size={40} className="text-slate-400 mb-4" />
            <p className="text-sm font-semibold text-slate-700 mb-2">Arrastra tu archivo CSV aquí</p>
            <p className="text-xs text-slate-500 mb-6">o haz clic para seleccionar (Max 5MB)</p>
            <input type="file" accept=".csv" className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              Seleccionar archivo
            </label>
            <button
              type="submit"
              disabled={isUploading}
              className="mt-4 w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Procesando modelo...' : 'Cargar y Reentrenar'}
            </button>
          </div>
        </form>

        <div className="mt-8 flex items-start p-4 bg-orange-50 text-orange-800 rounded-lg max-w-md text-left text-sm">
          <AlertCircle size={20} className="mr-3 shrink-0 mt-0.5" />
          <p>La recarga de datos puede tomar varios minutos. No cierres esta ventana durante el proceso.</p>
        </div>
      </div>
    </div>
  );
}
