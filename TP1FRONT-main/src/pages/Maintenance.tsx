import React, { useState, useEffect } from 'react';
import { UploadCloud, Database, AlertCircle, TrendingUp, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getMarketRates, updateMarketRates, MarketRates } from '../api/maintenance';

// El backend almacena los precios en USD/kg; la interfaz trabaja en USD/tonelada.
const KG_PER_TON = 1000;

export default function Maintenance() {
  const [isUploading, setIsUploading] = useState(false);

  // Objetivos de precio por tonelada (en USD/t para la UI)
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [editRates, setEditRates] = useState<MarketRates>({ lag1: 0, lag2: 0, lag3: 0 });
  const [loadingRates, setLoadingRates] = useState(true);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    setLoadingRates(true);
    getMarketRates()
      .then(data => {
        setRates(data);
        // Convertir USD/kg → USD/tonelada para edición
        setEditRates({
          lag1: data.lag1 * KG_PER_TON,
          lag2: data.lag2 * KG_PER_TON,
          lag3: data.lag3 * KG_PER_TON,
        });
      })
      .catch(() => toast.error('No se pudieron cargar los objetivos de precio.'))
      .finally(() => setLoadingRates(false));
  }, []);

  const handleSaveRates = async () => {
    if (editRates.lag1 <= 0 || editRates.lag2 <= 0 || editRates.lag3 <= 0) {
      toast.error('Todos los precios deben ser valores positivos.');
      return;
    }
    setSavingRates(true);
    try {
      // Convertir USD/tonelada → USD/kg antes de enviar al backend
      const updated = await updateMarketRates({
        lag1: editRates.lag1 / KG_PER_TON,
        lag2: editRates.lag2 / KG_PER_TON,
        lag3: editRates.lag3 / KG_PER_TON,
      });
      setRates(updated);
      toast.success('Objetivos de precio actualizados. El modelo usará estos valores inmediatamente.');
    } catch {
      toast.error('No se pudieron guardar los objetivos. Verifique que sea administrador.');
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
            <h2 className="text-base font-bold text-slate-800">Objetivos: Precio por Tonelada</h2>
            <p className="text-xs text-slate-500">Precio de referencia por tonelada (USD/t) por horizonte: semanal, mensual y anual.</p>
          </div>
        </div>

        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800 mb-5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>Estos precios alimentan las features de mercado del modelo XGBoost. Mantenerlos actualizados mejora la precisión de las predicciones.</span>
        </div>

        {loadingRates ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <RefreshCw size={16} className="animate-spin" /> Cargando objetivos actuales…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: 'lag1' as const, label: 'Promedio Semanal', hint: 'Precio de la última semana' },
                { key: 'lag2' as const, label: 'Promedio Mensual', hint: 'Precio del último mes' },
                { key: 'lag3' as const, label: 'Promedio Anual', hint: 'Precio de los últimos 12 meses' },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                    <input
                      type="number"
                      step="1"
                      min="0.01"
                      value={editRates[key]}
                      onChange={e => setEditRates(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-7 pr-12 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">USD/t</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
                </div>
              ))}
            </div>

            {rates && (
              <p className="text-xs text-slate-400">
                Valores en uso actualmente: semanal={(rates.lag1 * KG_PER_TON).toFixed(2)} · mensual={(rates.lag2 * KG_PER_TON).toFixed(2)} · anual={(rates.lag3 * KG_PER_TON).toFixed(2)} USD/t
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
