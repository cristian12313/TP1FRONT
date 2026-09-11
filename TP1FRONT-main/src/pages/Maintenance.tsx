import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Bot, CalendarClock, CheckCircle2, ChevronDown,
  Loader2, PlayCircle, RefreshCw, Save, Search, Trash2, TrendingUp, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  IngestaEstado, Importador, MarketRates,
  addImportador, deleteImportador, getIngestaEstado,
  getMarketRates, getPadron, resetMarketRates, runIngesta,
  setImportadorActivo, updateMarketRates, updateProgramacion,
} from '../api/maintenance';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import CorpusPanel from '../components/maintenance/CorpusPanel';
import DriftPanel from '../components/maintenance/DriftPanel';
import RetrainPanel from '../components/maintenance/RetrainPanel';

// El backend almacena los precios en USD/kg; la interfaz trabaja en USD/tonelada.
const KG_PER_TON = 1000;

/**
 * Etiqueta del mes al que corresponde un rezago.
 *
 * H-11. Los tres campos se rotulaban "Promedio Semanal / Mensual / Anual" con
 * las ayudas "Precio de la última semana / del último mes / de los últimos 12
 * meses". Es falso: `mercado_lag1/2/3` son las MEDIAS MENSUALES de los tres
 * meses cerrados anteriores (ver ml/data_pipeline.py, donde se construyen con
 * shift(1..3) sobre la serie mensual). Un administrador que siguiera las
 * etiquetas metería un promedio anual real en lag3 y desplazaría el nivel de
 * mercado del modelo —el bloque de features que concentra ~89% del gain— sin
 * que ninguna validación lo detectara: market_state solo comprueba el rango
 * [0.001, 10] USD/kg.
 *
 * `atras` = 0 para lag1 (el propio mes de vigencia), 1 para lag2, 2 para lag3.
 */
function mesLag(vigenteHasta: string, atras: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(vigenteHasta ?? '');
  if (!m) return `M-${atras + 1}`;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) - atras;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * USD/kg → USD/t redondeado a 2 decimales. Sin el redondeo, 0.164588 * 1000
 * entra en el input como 164.58800000000002 (coma flotante binaria) y el
 * administrador ve un número que no puede haber tecleado nadie.
 */
const aTonelada = (usdKg: number) => Math.round(usdKg * KG_PER_TON * 100) / 100;

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function errorMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function Maintenance() {
  // ── Objetivos de precio (mercado_lag1/2/3) ────────────────────────────────
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [editRates, setEditRates] = useState({ lag1: 0, lag2: 0, lag3: 0, vigente_hasta: '' });
  const [loadingRates, setLoadingRates] = useState(true);
  const [savingRates, setSavingRates] = useState(false);

  // ── Ingesta Aduanet ───────────────────────────────────────────────────────
  const [ingesta, setIngesta] = useState<IngestaEstado | null>(null);
  const [lanzando, setLanzando] = useState(false);

  // ── Padrón ────────────────────────────────────────────────────────────────
  const [padron, setPadron] = useState<Importador[] | null>(null);
  const [padronAbierto, setPadronAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [nuevoRuc, setNuevoRuc] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  // H-30: sustituye al confirm() nativo.
  const [aEliminar, setAEliminar] = useState<Importador | null>(null);

  // Se incrementa tras cualquier accion que cambie el estado del modelo o del
  // corpus, para que el diagnostico de deriva y el panel del modelo se
  // reevaluen sin recargar la pagina.
  const [refreshToken, setRefreshToken] = useState(0);
  const bump = useCallback(() => setRefreshToken(t => t + 1), []);

  const aplicarRates = useCallback((data: MarketRates) => {
    setRates(data);
    setEditRates({
      lag1: aTonelada(data.lag1),
      lag2: aTonelada(data.lag2),
      lag3: aTonelada(data.lag3),
      vigente_hasta: data.vigente_hasta,
    });
  }, []);

  const cargarIngesta = useCallback(async () => {
    try {
      const data = await getIngestaEstado();
      setIngesta(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setLoadingRates(true);
    getMarketRates()
      .then(aplicarRates)
      .catch(() => toast.error('No se pudieron cargar los objetivos de precio.'))
      .finally(() => setLoadingRates(false));
    cargarIngesta();
  }, [aplicarRates, cargarIngesta]);

  // Mientras hay un barrido en curso se refresca el estado cada 3 s. El
  // endpoint /ingesta/run responde 202 y el barrido corre en segundo plano
  // durante varios minutos, así que el avance solo puede verse sondeando.
  const enCurso = ingesta?.progreso?.en_curso ?? false;
  const eraEnCurso = useRef(false);
  useEffect(() => {
    if (!enCurso) {
      if (eraEnCurso.current) {
        eraEnCurso.current = false;
        getMarketRates().then(aplicarRates).catch(() => undefined);
        bump();
        toast.success('Ingesta de Aduanet finalizada.');
      }
      return;
    }
    eraEnCurso.current = true;
    const id = setInterval(cargarIngesta, 3000);
    return () => clearInterval(id);
  }, [enCurso, cargarIngesta, aplicarRates, bump]);

  const handleSaveRates = async () => {
    const { lag1, lag2, lag3, vigente_hasta } = editRates;
    if (lag1 <= 0 || lag2 <= 0 || lag3 <= 0) {
      toast.error('Todos los precios deben ser valores positivos.');
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(vigente_hasta)) {
      toast.error('Indique el mes de vigencia (AAAA-MM) al que corresponde el rezago M-1.');
      return;
    }
    setSavingRates(true);
    try {
      const updated = await updateMarketRates({
        lag1: lag1 / KG_PER_TON,
        lag2: lag2 / KG_PER_TON,
        lag3: lag3 / KG_PER_TON,
        vigente_hasta,
      });
      aplicarRates(updated);
      bump();
      toast.success('Objetivos de precio actualizados. El modelo usará estos valores inmediatamente.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudieron guardar los objetivos. Verifique que sea administrador.'));
    } finally {
      setSavingRates(false);
    }
  };

  const handleResetRates = async () => {
    setSavingRates(true);
    try {
      aplicarRates(await resetMarketRates());
      bump();
      toast.success('Se restauró la serie real del artefacto.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo restaurar la serie del artefacto.'));
    } finally {
      setSavingRates(false);
    }
  };

  const handleRunIngesta = async (aplicar: boolean) => {
    setLanzando(true);
    try {
      await runIngesta({ aplicar });
      toast.success('Barrido de Aduanet iniciado. Puede tardar varios minutos.');
      await cargarIngesta();
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo iniciar el barrido.'));
    } finally {
      setLanzando(false);
    }
  };

  const handleProgramacion = async (cambios: Record<string, unknown>) => {
    try {
      const prog = await updateProgramacion(cambios);
      setIngesta(prev => (prev ? { ...prev, programacion: prog } : prev));
      toast.success('Programación actualizada.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo actualizar la programación.'));
    }
  };

  const abrirPadron = async () => {
    setPadronAbierto(v => !v);
    if (padron === null) {
      try {
        setPadron(await getPadron());
      } catch {
        toast.error('No se pudo cargar el padrón de importadores.');
      }
    }
  };

  const handleAddImportador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{11}$/.test(nuevoRuc)) {
      toast.error('El RUC debe tener exactamente 11 dígitos.');
      return;
    }
    try {
      setPadron(await addImportador(nuevoRuc, nuevoNombre));
      setNuevoRuc('');
      setNuevoNombre('');
      cargarIngesta();
      toast.success('Importador añadido al padrón.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo añadir el importador.'));
    }
  };

  const handleToggleImportador = async (imp: Importador) => {
    try {
      setPadron(await setImportadorActivo(imp.ruc, !imp.activo));
      cargarIngesta();
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo actualizar el importador.'));
    }
  };

  const handleDeleteImportador = async (imp: Importador) => {
    setAEliminar(null);
    try {
      setPadron(await deleteImportador(imp.ruc));
      cargarIngesta();
      toast.success('Importador eliminado del padrón.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo eliminar el importador.'));
    }
  };

  const prog = ingesta?.progreso;
  const pct = prog?.consultas_totales
    ? Math.round((100 * (prog.consultas_hechas ?? 0)) / prog.consultas_totales)
    : 0;
  const rez = ingesta?.rezagos_calculados;
  const serie = ingesta?.serie_mensual ?? [];
  const maxSerie = Math.max(1e-9, ...serie.map(p => p.flete_unit));
  const padronFiltrado = (padron ?? []).filter(i => {
    const q = filtro.trim().toLowerCase();
    return !q || i.nombre.toLowerCase().includes(q) || i.ruc.includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* El diagnostico va primero: es lo que dice si hay que hacer algo. */}
      <DriftPanel refreshToken={refreshToken} />

      {/* ── Panel de Tasas de Mercado ───────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Mercado de referencia: últimos 3 meses</h2>
            <p className="text-xs text-slate-500">
              Flete unitario promedio (USD/t) de los tres meses cerrados anteriores. Alimentan
              <code className="mx-1 text-[11px] bg-slate-100 px-1 rounded">mercado_lag1/2/3</code>
              del modelo.
            </p>
          </div>
        </div>

        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800 mb-5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Estos precios alimentan las features de mercado del modelo XGBoost. Desde que la
            ingesta automática de Aduanet está activa, se actualizan solos cada semana: edite
            aquí solo si necesita forzar un valor.
          </span>
        </div>

        {loadingRates ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <RefreshCw size={16} className="animate-spin" /> Cargando objetivos actuales…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: 'lag1' as const, label: 'Mes M-1', hint: mesLag(editRates.vigente_hasta, 0) },
                { key: 'lag2' as const, label: 'Mes M-2', hint: mesLag(editRates.vigente_hasta, 1) },
                { key: 'lag3' as const, label: 'Mes M-3', hint: mesLag(editRates.vigente_hasta, 2) },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
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

            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Mes de vigencia
              </label>
              <input
                type="month"
                value={editRates.vigente_hasta}
                onChange={e => setEditRates(prev => ({ ...prev, vigente_hasta: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Mes al que corresponde <strong>M-1</strong>; M-2 y M-3 son los dos meses anteriores.
                El sistema lo usa para saber cuántos meses extrapola cada cotización.
              </p>
            </div>

            {rates && (
              <p className="text-xs text-slate-400">
                Valores en uso actualmente: {mesLag(rates.vigente_hasta, 0)}={aTonelada(rates.lag1).toFixed(2)} · {mesLag(rates.vigente_hasta, 1)}={aTonelada(rates.lag2).toFixed(2)} · {mesLag(rates.vigente_hasta, 2)}={aTonelada(rates.lag3).toFixed(2)} USD/t
                {' · '}vigente hasta {rates.vigente_hasta}
                {' · '}origen: {
                  rates.origen === 'ingesta_aduanet' ? 'ingesta automática de Aduanet'
                    : rates.origen === 'manual' ? 'ajuste manual'
                    : 'serie del entrenamiento'
                }
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleResetRates}
                disabled={savingRates}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} /> Restaurar serie original
              </button>
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

      {/* ── Ingesta automática desde Aduanet ────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-accent/10 text-accent rounded-lg flex items-center justify-center">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Actualización automática (SUNAT / Aduanet)</h2>
            <p className="text-xs text-slate-500">
              Un robot consulta las declaraciones de importación publicadas por Aduanet y recalcula
              solo los precios de mercado del modelo.
            </p>
          </div>
        </div>

        {!ingesta ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
            <RefreshCw size={16} className="animate-spin" /> Cargando estado de la ingesta…
          </div>
        ) : (
          <div className="mt-5 space-y-5">

            {/* Programación */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <CalendarClock size={16} className="text-slate-500" />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={ingesta.programacion.activa}
                    onChange={e => handleProgramacion({ activa: e.target.checked })}
                    className="accent-primary"
                  />
                  Barrido semanal automático
                </label>

                <select
                  value={ingesta.programacion.dia_semana}
                  onChange={e => handleProgramacion({ dia_semana: Number(e.target.value) })}
                  className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>

                <select
                  value={ingesta.programacion.hora}
                  onChange={e => handleProgramacion({ hora: Number(e.target.value) })}
                  className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={ingesta.programacion.aplicar_automaticamente}
                    onChange={e => handleProgramacion({ aplicar_automaticamente: e.target.checked })}
                    className="accent-primary"
                  />
                  Aplicar los precios sin confirmación
                </label>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Barre los últimos {ingesta.ventana_dias} días sobre {ingesta.n_importadores_activos} de{' '}
                {ingesta.n_importadores} importadores del padrón, subpartida {ingesta.partidas.join(', ')},
                aduana {ingesta.aduana}. Última ejecución: {fmtFecha(ingesta.ultima_ejecucion)}.
              </p>
            </div>

            {/* Progreso / acciones */}
            {enCurso ? (
              <div className="border border-accent/30 bg-accent/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Loader2 size={16} className="animate-spin text-accent" />
                  Barriendo Aduanet… {prog?.consultas_hechas ?? 0}/{prog?.consultas_totales ?? 0} consultas
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {prog?.importador_actual ? `Consultando: ${prog.importador_actual} · ` : ''}
                  {prog?.declaraciones ?? 0} declaraciones descargadas
                  {prog?.errores ? ` · ${prog.errores} consultas fallidas` : ''}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleRunIngesta(true)}
                  disabled={lanzando}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <PlayCircle size={16} /> Ejecutar barrido ahora
                </button>
                <button
                  onClick={() => handleRunIngesta(false)}
                  disabled={lanzando}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Solo descargar (sin aplicar)
                </button>
                <button
                  onClick={() => cargarIngesta()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw size={14} /> Refrescar
                </button>
              </div>
            )}

            {/* Resultado del último barrido */}
            {ingesta.ultimo_resultado && (
              <div className={`rounded-lg p-4 border text-sm flex items-start gap-2 ${
                ingesta.ultimo_resultado.aplicado
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {ingesta.ultimo_resultado.aplicado
                  ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                <div>
                  <p className="font-semibold">
                    {ingesta.ultimo_resultado.aplicado
                      ? 'Último barrido aplicado al modelo'
                      : 'Último barrido descargado, precios NO aplicados'}
                  </p>
                  <p className="text-xs mt-1">
                    {fmtFecha(ingesta.ultimo_resultado.fin)} ·{' '}
                    {ingesta.ultimo_resultado.declaraciones_nuevas} declaraciones nuevas ·{' '}
                    {ingesta.ultimo_resultado.declaraciones_acumuladas} acumuladas ·{' '}
                    {ingesta.ultimo_resultado.n_errores} consultas fallidas ·{' '}
                    {ingesta.ultimo_resultado.duracion_s}s
                  </p>
                  {ingesta.ultimo_resultado.motivo_no_aplicado && (
                    <p className="text-xs mt-1">{ingesta.ultimo_resultado.motivo_no_aplicado}</p>
                  )}
                </div>
              </div>
            )}

            {/* Serie mensual observada */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Precio de mercado observado en Aduanet
              </h3>
              {serie.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Todavía no hay observaciones descargadas. Ejecute un barrido para empezar a
                  acumular ({ingesta.declaraciones_acumuladas} declaraciones en el archivo).
                </p>
              ) : (
                <div className="space-y-1">
                  {serie.map(p => (
                    <div key={p.mes} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-mono text-slate-500">{p.mes}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded">
                        <div
                          className="h-full bg-primary/70 rounded"
                          style={{ width: `${Math.max(2, (100 * p.flete_unit) / maxSerie)}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono text-slate-700">
                        {aTonelada(p.flete_unit).toFixed(2)} USD/t
                      </span>
                      <span className={`w-24 text-right ${
                        p.declaraciones >= ingesta.min_declaraciones_mes ? 'text-slate-400' : 'text-amber-600'
                      }`}>
                        {p.declaraciones} decl.
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400 pt-2">
                    Un mes solo alimenta al modelo si está cerrado y tiene al menos{' '}
                    {ingesta.min_declaraciones_mes} declaraciones (en ámbar, los que aún no llegan).
                    El flete se estima como CIF − FOB: Aduanet no publica el flete por declaración
                    sin CAPTCHA. Error medido de esa estimación frente a la serie real: 4.9%.
                  </p>
                </div>
              )}
            </div>

            {/* Rezagos calculados */}
            <div className={`rounded-lg border p-4 text-sm ${
              rez?.ok ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {rez?.ok ? (
                <>
                  <p className="font-semibold text-slate-700 mb-1">
                    Precios que la ingesta aplicaría ahora mismo
                  </p>
                  <p className="font-mono text-xs text-slate-600">
                    {rez.meses?.[0]}: {aTonelada(rez.lag1!).toFixed(2)} ·{' '}
                    {rez.meses?.[1]}: {aTonelada(rez.lag2!).toFixed(2)} ·{' '}
                    {rez.meses?.[2]}: {aTonelada(rez.lag3!).toFixed(2)} USD/t
                    {' · '}vigente hasta {rez.vigente_hasta}
                  </p>
                </>
              ) : (
                <p className="text-xs">{rez?.motivo}</p>
              )}
            </div>

            {/* Padrón */}
            <div className="border border-slate-200 rounded-lg">
              <button
                onClick={abrirPadron}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                <span>Padrón de importadores ({ingesta.n_importadores_activos} activos de {ingesta.n_importadores})</span>
                <ChevronDown size={16} className={padronAbierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>

              {padronAbierto && (
                <div className="border-t border-slate-200 p-4 space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Aduanet no permite consultar una subpartida sin RUC, así que esta lista define
                    el alcance real del barrido. Se generó con los importadores del histórico de
                    entrenamiento (95.7% del peso neto importado).
                  </p>

                  <form onSubmit={handleAddImportador} className="flex flex-wrap gap-2">
                    <input
                      value={nuevoRuc}
                      onChange={e => setNuevoRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="RUC (11 dígitos)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono w-44"
                    />
                    <input
                      value={nuevoNombre}
                      onChange={e => setNuevoNombre(e.target.value)}
                      placeholder="Razón social"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg flex-1 min-w-[180px]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90"
                    >
                      Añadir
                    </button>
                  </form>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={filtro}
                      onChange={e => setFiltro(e.target.value)}
                      placeholder="Buscar por nombre o RUC…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                    {padron === null ? (
                      <p className="p-3 text-xs text-slate-500">Cargando padrón…</p>
                    ) : padronFiltrado.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500">Sin coincidencias.</p>
                    ) : padronFiltrado.map(imp => (
                      <div key={imp.ruc} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <button
                          onClick={() => handleToggleImportador(imp)}
                          title={imp.activo ? 'Excluir del barrido' : 'Incluir en el barrido'}
                          className={imp.activo ? 'text-emerald-600' : 'text-slate-300'}
                        >
                          {imp.activo ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        </button>
                        <span className="font-mono text-xs text-slate-500 w-28">{imp.ruc}</span>
                        <span className="flex-1 truncate text-slate-700">{imp.nombre}</span>
                        <button
                          onClick={() => setAEliminar(imp)}
                          className="text-slate-400 hover:text-red-600"
                          title="Quitar del padrón"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Historial */}
            {ingesta.historial.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Historial de ejecuciones</h3>
                <div className="text-xs divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {ingesta.historial.map((h, i) => (
                    <div key={`${h.fin}-${i}`} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-44 text-slate-500">{fmtFecha(h.fin)}</span>
                      <span className="flex-1 text-slate-600">
                        {h.desde} → {h.hasta} · +{h.declaraciones_nuevas} nuevas · {h.n_errores} fallos
                      </span>
                      <span className={h.aplicado ? 'text-emerald-600' : 'text-amber-600'}>
                        {h.aplicado ? 'aplicado' : 'no aplicado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Corpus + reentrenamiento ─────────────────────────────────────── */}
      <CorpusPanel onCambio={bump} />

      <RetrainPanel refreshToken={refreshToken} onCambio={bump} />

      <ConfirmDialog
        abierto={aEliminar !== null}
        peligroso
        titulo="Quitar del padrón de barrido"
        mensaje={
          <p>
            <strong>{aEliminar?.nombre}</strong>{' '}
            <span className="font-mono text-xs">({aEliminar?.ruc})</span> dejará de consultarse en
            los barridos de Aduanet. Las observaciones ya acumuladas se conservan.
          </p>
        }
        textoConfirmar="Quitar"
        onConfirmar={() => aEliminar && handleDeleteImportador(aEliminar)}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  );
}
