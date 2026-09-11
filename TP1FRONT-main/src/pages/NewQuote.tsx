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
import { getPorts, getAppConfig, getImportadores, Port, Importador } from '../api/catalogs';
import { useAuthStore } from '../store/authStore';
import { usePredictionStatusStore } from '../store/predictionStatusStore';
import PredictionInsights from '../components/quotation/PredictionInsights';
import WeekPicker from '../components/shared/WeekPicker';
import { mensajeDeError } from '../lib/apiError';
import { parseSemanaISO, semanaISOToFecha } from '../lib/semanaISO';

// El modelo trabaja en kg; la interfaz captura el peso en toneladas.
const KG_PER_TON = 1000;

// Horizonte cotizable. TERCERA AUDITORÍA: estos límites estaban hardcodeados
// aquí Y en app/schemas/prediction.py. Al reentrenar con datos de otro periodo
// se habrían desincronizado, dejando la UI ofreciendo fechas que el backend
// rechaza. Ahora el backend los DERIVA del artifact y los publica en
// /api/catalogs/app-config; estos valores son solo el estado inicial mientras
// llega la respuesta. No los edites a mano: cambia el artifact.
const LIMITES_INICIALES = { fechaMin: '2021-04-01', fechaMax: '2030-12-31' };

/** 'YYYY-MM-DD' -> 'YYYY-MM' para los input[type=month]. */
const aMes = (d: string) => d.slice(0, 7);

/** Años completos cotizables: el 1 de enero debe caer dentro del rango, porque
 *  es la fecha que `buildFechaEmbarque` envía para el periodo anual. */
function aniosValidos(fechaMin: string, fechaMax: string): number[] {
  const desde = fechaMin.slice(5) === '01-01'
    ? Number(fechaMin.slice(0, 4))
    : Number(fechaMin.slice(0, 4)) + 1;
  const hasta = Number(fechaMax.slice(0, 4));
  return Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, i) => desde + i);
}

type PeriodoTipo = 'semanal' | 'mensual' | 'anual';

const PERIODOS: { key: PeriodoTipo; label: string }[] = [
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'anual', label: 'Anual' },
];

/**
 * Convierte la selección de periodo (semana/mes/año) a una fecha representativa
 * YYYY-MM-DD que el backend usa para derivar mes, trimestre y semana del año.
 */
function buildFechaEmbarque(tipo: PeriodoTipo, valor: string): string | undefined {
  if (!valor) return undefined;
  if (tipo === 'mensual') {
    // "2026-06" → primer día del mes
    return `${valor}-01`;
  }
  if (tipo === 'anual') {
    // "2026" → primer día del año
    return `${valor}-01-01`;
  }
  // semanal: "2026-W26" → lunes de esa semana ISO
  const [anio, semana] = parseSemanaISO(valor);
  return anio ? semanaISOToFecha(anio, semana) : undefined;
}

export default function NewQuote() {
  const { accessToken } = useAuthStore();
  const setPredictionStatus = usePredictionStatusStore(s => s.setStatus);
  const clearPredictionStatus = usePredictionStatusStore(s => s.clearStatus);

  // Catálogos
  const [ports, setPorts] = useState<Port[]>([]);
  const [importadores, setImportadores] = useState<Importador[]>([]);
  const [destinationPort, setDestinationPort] = useState('');
  const [catalogError, setCatalogError] = useState(false);

  // Form
  const [origen, setOrigen] = useState('');
  const [importador, setImportador] = useState('');
  const [limites, setLimites] = useState(LIMITES_INICIALES);
  const [peso, setPeso] = useState<number | ''>('');          // en toneladas
  const [unidades, setUnidades] = useState<number | ''>('');
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('mensual');
  const [periodoValor, setPeriodoValor] = useState('');
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
      getImportadores().then(data => setImportadores(data)),
      getAppConfig().then(cfg => {
        setDestinationPort(cfg.destination_port);
        // Los límites los DERIVA el backend del artifact; nunca se recalculan aquí.
        if (cfg.fecha_min && cfg.fecha_max) {
          setLimites({ fechaMin: cfg.fecha_min, fechaMax: cfg.fecha_max });
        }
      }),
    ]).catch(() => {
      setCatalogError(true);
      toast.error('No se pudo conectar con el servidor. Verifique que el backend esté activo.');
    });
  };

  useEffect(() => {
    loadCatalogs();
    // El badge de estado en el header global pertenece a ESTA pantalla: al
    // salir de "Nueva Cotización" no debe seguir mostrando el MAPE de una
    // predicción que ya no está a la vista.
    return () => clearPredictionStatus();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!origen) errs.origen = 'Seleccione un puerto de embarque';
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
        importador: importador || undefined,
        peso_kg: Number(peso) * KG_PER_TON,
        unidades: unidades ? Number(unidades) : undefined,
        fecha_embarque: buildFechaEmbarque(periodoTipo, periodoValor),
        periodo: periodoValor ? periodoTipo : undefined,
      });
      setResult(data);
      // Los badges de estado (MAPE, tiempo, calibración del IC) viven en el
      // header global — ver store/predictionStatusStore.ts — para que nunca
      // puedan quedar visualmente pegados a la barra superior de la página.
      setPredictionStatus({
        mape: data.mape_modelo,
        mapeRegimen: data.mape_regimen ?? 'historico',
        tiempoMs: data.tiempo_ms,
        ic95Calibrado: data.ic95_calibrado ?? true,
        horizonteCalibradoMeses: data.ic95_horizonte_calibrado_meses ?? null,
      });
    } catch (err: unknown) {
      // H-33: el `detail` de un 422 es un array de objetos; pintarlo tal cual
      // rompe el render de React. `mensajeDeError` lo normaliza a texto.
      setApiError(mensajeDeError(err, 'El servicio de pronóstico está temporalmente no disponible.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      // Se envían SOLO los inputs: el backend recalcula la estimación con el
      // modelo y guarda su propio resultado, de modo que una cotización guardada
      // es siempre prueba de lo que el modelo dijo para esos inputs.
      const q = await createQuotation({
        puerto_origen: origen,
        importador: importador || undefined,
        peso_kg: Number(peso) * KG_PER_TON,
        unidades: unidades ? Number(unidades) : undefined,
        fecha_embarque: buildFechaEmbarque(periodoTipo, periodoValor),
        periodo: periodoValor ? periodoTipo : undefined,
        comentario: comentario || undefined,
      });
      setSavedId(q.id);
      toast.success('Cotización guardada exitosamente');
    } catch (err: unknown) {
      toast.error(mensajeDeError(err, 'No se pudo guardar la cotización. Intente de nuevo.'));
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
      .then(async r => {
        // H-17: sin comprobar `r.ok`, un 403 o un 500 se convertia en blob y se
        // descargaba como "cotizacion_X.pdf" — un fichero de 20 bytes con el
        // texto "Internal Server Error" dentro.
        if (!r.ok) {
          let detalle = '';
          try {
            const cuerpo = await r.json();
            detalle = typeof cuerpo?.detail === 'string' ? cuerpo.detail : '';
          } catch { /* la respuesta no era JSON */ }
          throw new Error(detalle || `El servidor respondio ${r.status}.`);
        }
        return r.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch((e: Error) => toast.error(e.message || 'No se pudo generar el PDF.'));
  };

  const resetForm = () => {
    setResult(null);
    setSavedId(null);
    setApiError('');
    setComentario('');
    setOrigen('');
    setImportador('');
    setPeso('');
    setUnidades('');
    setPeriodoTipo('mensual');
    setPeriodoValor('');
    setErrors({});
    clearPredictionStatus();
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
              <p className="text-xs mt-1">No se pudieron cargar los catálogos de puertos. Asegúrese de que el backend esté activo.</p>
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

              {/* Puerto de embarque */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Puerto de Embarque <span className="text-red-500">*</span>
                </label>
                <select
                  value={origen}
                  onChange={e => { setOrigen(e.target.value); setErrors(p => ({ ...p, origen: '' })); }}
                  className={`w-full text-sm border ${errors.origen ? 'border-red-500 bg-red-50' : 'border-slate-300'} rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors`}
                >
                  <option value="">Seleccione puerto de embarque</option>
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

              {/* Importador (opcional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Importador <span className="text-slate-400 font-normal normal-case">— opcional</span>
                </label>
                <select
                  value={importador}
                  onChange={e => setImportador(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors"
                >
                  <option value="">No especificado</option>
                  {importadores.map(i => (
                    <option key={i.key} value={i.key}>{i.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                  Si se conoce, mejora la precisión usando el historial real de esa empresa.
                </p>
              </div>

              {/* Peso neto (en toneladas) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Peso Neto (toneladas) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input type="number" value={peso} step="0.001" min="0.001"
                    onChange={e => { setPeso(e.target.value ? Number(e.target.value) : ''); setErrors(p => ({ ...p, peso: '' })); }}
                    className={`w-full text-sm border ${errors.peso ? 'border-red-500 bg-red-50' : 'border-slate-300'} rounded-lg p-3 pr-10 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors`}
                    placeholder="Ej: 24" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">t</span>
                </div>
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
                  // Densidad en kg por unidad (el peso se ingresa en toneladas).
                  // El umbral superior de 50 NO es arbitrario: es el punto en que
                  // el modelo SATURA. Medido en modelo_meta.json ->
                  // diagnostico_saturacion_densidad, para densidad_carga >= 50 el
                  // modelo devuelve exactamente el mismo valor para 50, 500 o
                  // 50000, asi que un error de tipeo en 'unidades' no movería la
                  // estimación y el usuario no lo notaría. Este aviso es la única
                  // mitigación que existe para esa saturación.
                  const densidad = (Number(peso) * KG_PER_TON) / Number(unidades);
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

              {/* Periodo de embarque (opcional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Periodo de Embarque <span className="text-slate-400 font-normal normal-case">— opcional</span>
                </label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {PERIODOS.map(({ key, label }) => (
                    <button key={key} type="button"
                      onClick={() => { setPeriodoTipo(key); setPeriodoValor(''); }}
                      className={`py-2.5 px-3 border rounded-lg text-sm font-semibold transition-all ${
                        periodoTipo === key
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                      }`}
                    >{label}</button>
                  ))}
                </div>

                {periodoTipo === 'mensual' && (
                  <input type="month" value={periodoValor}
                    min={aMes(limites.fechaMin)} max={aMes(limites.fechaMax)}
                    onChange={e => setPeriodoValor(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors" />
                )}
                {periodoTipo === 'semanal' && (
                  <WeekPicker value={periodoValor} onChange={setPeriodoValor}
                    fechaMin={limites.fechaMin} fechaMax={limites.fechaMax} />
                )}
                {periodoTipo === 'anual' && (
                  <select value={periodoValor}
                    onChange={e => setPeriodoValor(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-accent outline-none bg-white transition-colors">
                    <option value="">Seleccione año</option>
                    {aniosValidos(limites.fechaMin, limites.fechaMax).map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                )}
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

              {/* Header con precio.
                  El MAPE, el tiempo de respuesta y el estado de calibración del
                  IC ya no se muestran aquí: viven como badges en el header
                  GLOBAL de la aplicación (ver store/predictionStatusStore.ts),
                  para que nunca puedan quedar visualmente pegados a la barra
                  superior sticky de la página. */}
              <div className="bg-primary p-6 text-white text-center relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-sm text-white/70 mb-1">Precio Estimado por Tonelada (USD/t)</p>
                  <h2 className="text-5xl font-bold tracking-tight">
                    ${(peso && Number(peso) > 0
                        ? result!.flete_estimado_usd / Number(peso)
                        : 0
                      ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <p className="text-sm text-white/80 mt-2">
                    Flete total: <span className="font-semibold">${result!.flete_estimado_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {result!.ic95_calibrado === false ? 'Intervalo (95% NO garantizado)' : 'IC 95%'}: $
                    {result!.ic95_min.toLocaleString('en-US', { maximumFractionDigits: 0 })} — ${result!.ic95_max.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    {result!.ic95_calibrado === false ? (
                      <span className="text-amber-300"> · fuera del horizonte calibrado
                        {result!.ic95_horizonte_calibrado_meses ? ` (${result!.ic95_horizonte_calibrado_meses} meses)` : ''}</span>
                    ) : result!.mape_regimen === 'extrapolado' ? (
                      <span className="text-amber-300/70"> · calibrado para mercado congelado</span>
                    ) : null}
                  </p>
                  {result!.ic95_min <= 0 && (
                    // El $0 es un límite FÍSICO (un flete no puede ser negativo),
                    // no una predicción de que el flete valga cero. Sin esta nota
                    // el número solo, sin contexto, se lee como un error de cálculo.
                    <p className="text-[10px] text-white/35 mt-0.5">
                      El $0 es el piso físico del intervalo, no una estimación de flete gratuito.
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 mt-1 font-mono">
                    Mercado observado hasta {result!.mercado_vigente_hasta}
                    {result!.meses_extrapolados > 0 && ` · proyectado ${result!.meses_extrapolados} mes(es)`}
                  </p>
                </div>
                <div className="absolute -right-8 -bottom-16 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
              </div>

              <div className="p-6 flex-1 flex flex-col text-sm">

                {/* Vigencia de los datos de mercado: las 3 variables de mercado
                    pesan ~89% del modelo, así que una cotización lejos del último
                    mes observado debe advertirse en vez de presentarse sin más. */}
                {result!.advertencia && (
                  <div className="mb-5 flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <AlertTriangle className="h-4 w-4 flex-none text-amber-600 mt-0.5" />
                    <p className="text-xs leading-relaxed text-amber-900">{result!.advertencia}</p>
                  </div>
                )}

                {/* Insights: dispersión IC95 + confianza + variables SHAP */}
                <div className="mb-6">
                  <PredictionInsights
                    fleteEstimado={result!.flete_estimado_usd}
                    ic95Min={result!.ic95_min}
                    ic95Max={result!.ic95_max}
                    mape={result!.mape_modelo}
                    shap={result!.shap_contribuciones}
                  />
                </div>

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
