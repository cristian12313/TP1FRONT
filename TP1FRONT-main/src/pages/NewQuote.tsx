import React, { useState, useEffect } from 'react';
import {
  Calculator,
  RotateCcw,
  FileText,
  Save,
  Ship,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { estimateFreight, PredictionResponse } from '../api/predictions';
import { createQuotation, getPdfUrl } from '../api/quotations';
import { getPorts, getContainerTypes, getAppConfig, Port } from '../api/catalogs';
import { useAuthStore } from '../store/authStore';

export default function NewQuote() {
  const { accessToken } = useAuthStore();

  // Catálogos
  const [ports, setPorts] = useState<Port[]>([]);
  const [containerTypes, setContainerTypes] = useState<string[]>([]);
  const [destinationPort, setDestinationPort] = useState('');
  const [catalogError, setCatalogError] = useState(false);

  // Form
  const [origen, setOrigen] = useState('');
  const [contenedor, setContenedor] = useState('');
  const [peso, setPeso] = useState<number | ''>('');
  const [unidades, setUnidades] = useState<number | ''>('');
  const [volumen, setVolumen] = useState<number | ''>('');
  const [fechaEmbarque, setFechaEmbarque] = useState('');
  const [comentario, setComentario] = useState('');

  // Estado
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadCatalogs = () => {
    setCatalogError(false);
    Promise.all([
      getPorts().then(data => setPorts(data)),
      getContainerTypes().then(data => setContainerTypes(data.map(c => c.name))),
      getAppConfig().then(cfg => setDestinationPort(cfg.destination_port)),
    ]).catch(() => {
      setCatalogError(true);
      toast.error('No se pudo conectar con el servidor. Verifique que el backend esté activo.');
    });
  };

  useEffect(() => {
    loadCatalogs();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!origen) errs.origen = 'Seleccione un puerto de origen';
    if (!contenedor) errs.contenedor = 'Seleccione un tipo de contenedor';
    if (!peso || Number(peso) <= 0) errs.peso = 'El peso debe ser mayor a 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setResult(null);
    setSavedId(null);
    setApiError('');

    try {
      const data = await estimateFreight({
        puerto_origen: origen,
        tipo_contenedor: contenedor,
        peso_kg: Number(peso),
        unidades: unidades ? Number(unidades) : undefined,
        volumen_cbm: volumen ? Number(volumen) : undefined,
        fecha_embarque: fechaEmbarque || undefined,
      });
      setResult(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'El servicio de pronóstico está temporalmente no disponible.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const q = await createQuotation({
        puerto_origen: origen,
        tipo_contenedor: contenedor,
        peso_kg: Number(peso),
        unidades: unidades ? Number(unidades) : undefined,
        volumen_cbm: volumen ? Number(volumen) : undefined,
        fecha_embarque: fechaEmbarque || undefined,
        flete_estimado_usd: result.flete_estimado_usd,
        ic95_min: result.ic95_min,
        ic95_max: result.ic95_max,
        mape_modelo: result.mape_modelo,
        tiempo_ms: result.tiempo_ms,
        shap_contribuciones: result.shap_contribuciones,
        comentario: comentario || undefined,
      });
      setSavedId(q.id);
      toast.success('Cotización guardada exitosamente');
    } catch (err: any) {
      toast.error('No se pudo guardar la cotización. Intente de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!savedId) {
      toast.warning('Guarde la cotización primero para descargar el PDF.');
      return;
    }
    const url = getPdfUrl(savedId);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cotizacion_${savedId}.pdf`);
    // Agregar token en header no es posible con <a>, usamos fetch
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => toast.error('No se pudo generar el PDF.'));
  };

  const resetForm = () => {
    setResult(null);
    setSavedId(null);
    setApiError('');
    setComentario('');
    setOrigen('');
    setContenedor('');
    setPeso('');
    setUnidades('');
    setVolumen('');
    setFechaEmbarque('');
    setErrors({});
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* ── Formulario ──────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {catalogError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="font-semibold text-sm">Servidor no disponible</p>
              <p className="text-xs mt-1">No se pudieron cargar los catálogos de puertos y contenedores. Asegúrese de que el backend esté activo.</p>
            </div>
            <button
              type="button"
              onClick={loadCatalogs}
              className="shrink-0 text-xs font-semibold underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}
        {apiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-sm">Error de Predicción</p>
              <p className="text-xs mt-1">{apiError}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 p-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Parámetros del Embarque</h2>
          </div>

          <form onSubmit={handleCalculate} className="flex flex-col">
            <div className="p-6 space-y-5">

              {/* Puerto origen */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Puerto de Origen <span className="text-red-500">*</span>
                </label>
                <select
                  value={origen}
                  onChange={e => { setOrigen(e.target.value); setErrors(p => ({ ...p, origen: '' })); }}
                  className={`w-full text-sm border ${errors.origen ? 'border-red-500 bg-red-50' : 'border-slate-300'} rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors`}
                >
                  <option value="">Seleccione origen</option>
                  {ports.map(p => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
                {errors.origen && <p className="text-xs text-red-500 mt-1.5">{errors.origen}</p>}
              </div>

              {/* Puerto destino (configurado en el servidor) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Puerto de Destino</label>
                <input type="text" value={destinationPort || '—'} disabled
                  className="w-full text-sm border border-slate-200 bg-slate-50 rounded-lg p-3 text-slate-400 cursor-not-allowed" />
              </div>

              {/* Tipo contenedor */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Tipo de Contenedor <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {containerTypes.map(type => (
                    <button key={type} type="button"
                      onClick={() => { setContenedor(type); setErrors(p => ({ ...p, contenedor: '' })); }}
                      className={`py-3 px-3 border rounded-lg text-sm font-semibold transition-all ${
                        contenedor === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                      }`}
                    >{type}</button>
                  ))}
                </div>
                {errors.contenedor && <p className="text-xs text-red-500 mt-1.5">{errors.contenedor}</p>}
              </div>

              {/* Peso neto */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Peso Neto (kg) <span className="text-red-500">*</span>
                </label>
                <input type="number" value={peso}
                  onChange={e => { setPeso(e.target.value ? Number(e.target.value) : ''); setErrors(p => ({ ...p, peso: '' })); }}
                  className={`w-full text-sm border ${errors.peso ? 'border-red-500 bg-red-50' : 'border-slate-300'} rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors`}
                  placeholder="Ej: 440" />
                {errors.peso && <p className="text-xs text-red-500 mt-1.5">{errors.peso}</p>}
              </div>

              {/* Cantidad de unidades (opcional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Cantidad de Unidades (neumáticos) <span className="text-slate-400 font-normal normal-case">— opcional</span>
                </label>
                <input type="number" value={unidades}
                  onChange={e => setUnidades(e.target.value ? Number(e.target.value) : '')}
                  className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors"
                  placeholder="Ej: 40"
                  min={1} step={1} />
                {(() => {
                  if (!peso || !unidades || Number(unidades) <= 0) return null;
                  const densidad = Number(peso) / Number(unidades);
                  if (densidad < 1 || densidad > 50) {
                    return (
                      <div className="flex items-start gap-1.5 mt-1.5 text-amber-600">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        <p className="text-xs">La relación peso/unidades parece inusual ({densidad.toFixed(1)} kg/un.), verifica los datos.</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Volumen (opcional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Volumen (CBM) <span className="text-slate-400 font-normal normal-case">— opcional</span>
                </label>
                <input type="number" value={volumen}
                  onChange={e => setVolumen(e.target.value ? Number(e.target.value) : '')}
                  className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors"
                  placeholder="Ej: 25.5" />
              </div>

              {/* Fecha embarque (opcional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Fecha de Embarque <span className="text-slate-400 font-normal normal-case">— opcional</span>
                </label>
                <input type="date" value={fechaEmbarque}
                  onChange={e => setFechaEmbarque(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors" />
              </div>

            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button type="button" onClick={resetForm}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Limpiar
              </button>
              <button type="submit" disabled={isLoading || catalogError}
                className="px-6 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors">
                {isLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Calculator size={16} />}
                {isLoading ? 'Procesando...' : 'Estimar Flete'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Resultado ───────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {!result && !isLoading ? (
            <motion.div key="placeholder"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4">
                <Calculator size={32} className="text-slate-300" />
              </div>
              <h3 className="font-semibold text-slate-700">Esperando Datos</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-[250px]">Llene los parámetros y calcule para ver el flete estimado.</p>
            </motion.div>
          ) : isLoading ? (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 h-full min-h-[500px] p-8 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-32 h-32 border-8 border-slate-100 rounded-full" />
                <div className="absolute top-0 w-32 h-32 border-8 border-t-accent border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                <Ship className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent w-12 h-12" />
              </div>
              <div className="text-center">
                <h4 className="text-xl font-bold text-slate-800">Procesando Modelo ML</h4>
                <p className="text-sm text-slate-500 mt-2 font-mono">Generando predicción XGBoost...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="result"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">

              {/* Header con precio */}
              <div className="bg-primary p-6 text-white text-center relative overflow-hidden">
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex items-center gap-1 bg-white/10 text-white/80 px-2 py-0.5 rounded text-xs font-mono">
                    MAPE {result!.mape_modelo.toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-1 bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/30 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {result!.tiempo_ms} ms
                  </div>
                </div>
                <div className="relative z-10">
                  <p className="text-sm text-white/70 mb-1">Flete Estimado (USD)</p>
                  <h2 className="text-5xl font-bold tracking-tight">
                    ${result!.flete_estimado_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <p className="text-xs text-white/50 mt-2">
                    IC 95%: ${result!.ic95_min.toLocaleString('en-US', { maximumFractionDigits: 0 })} — ${result!.ic95_max.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="absolute -right-8 -bottom-16 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
              </div>

              <div className="p-6 flex-1 flex flex-col text-sm">

                {/* SHAP top 3 */}
                {result!.shap_contribuciones.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Variables Influyentes</p>
                    <ul className="space-y-2">
                      {result!.shap_contribuciones.map((c, i) => (
                        <li key={i} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="font-medium text-slate-700">{i + 1}. {c.variable}</span>
                          <span className={`font-semibold text-xs px-2 py-0.5 rounded ${
                            c.direction === 'positive'
                              ? 'text-red-600 bg-red-100'
                              : 'text-green-600 bg-green-100'
                          }`}>
                            {c.direction === 'positive' ? '↑' : '↓'} ${Math.abs(c.aporte).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Comentario */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Comentarios <span className="text-slate-400 font-normal normal-case">— opcional (máx. 500)</span>
                  </label>
                  <textarea rows={3} value={comentario}
                    onChange={e => setComentario(e.target.value.slice(0, 500))}
                    placeholder="Detalles de la carga, requerimientos especiales..."
                    className="w-full text-sm border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-accent transition-all resize-none" />
                  <p className="text-xs text-slate-400 text-right mt-1">{comentario.length}/500</p>
                </div>

                {/* Botones */}
                <div className="space-y-3 mt-auto">
                  {savedId && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold border border-green-200">
                      <CheckCircle2 size={16} /> Cotización Guardada
                    </motion.div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={handleDownloadPdf}
                      className="flex-1 flex items-center justify-center p-2.5 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 font-semibold transition-colors">
                      <FileText size={16} className="mr-2" /> PDF Oficial
                    </button>
                    <button onClick={handleSave} disabled={isSaving || !!savedId}
                      className="flex-[2] flex items-center justify-center p-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 shadow-sm transition-colors disabled:opacity-50">
                      {isSaving
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        : <Save size={16} className="mr-2" />}
                      {savedId ? 'Guardada' : isSaving ? 'Guardando...' : 'Guardar Cotización'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
