import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, Cpu, Database, Loader2, RefreshCw,
  RotateCcw, Terminal, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../shared/ConfirmDialog';
import {
  ArtifactInfo, RetrainEstado,
  getArtifactInfo, getRetrainEstado, reloadArtifact, rollbackArtifact, runRetrain,
} from '../../api/maintenance';

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function errorMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function RetrainPanel({
  refreshToken, onCambio,
}: { refreshToken: number; onCambio: () => void }) {
  const [artifact, setArtifact] = useState<ArtifactInfo | null>(null);
  const [estado, setEstado] = useState<RetrainEstado | null>(null);
  const [lanzando, setLanzando] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const [verLog, setVerLog] = useState(false);
  // H-30: sustituye a los confirm() nativos. `null` = ningun dialogo abierto.
  const [confirmacion, setConfirmacion] = useState<
    { tipo: 'retrain' } | { tipo: 'rollback'; sello: string } | null
  >(null);

  const cargar = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([getArtifactInfo(), getRetrainEstado()]);
      setArtifact(a);
      setEstado(e);
      return e;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshToken]);

  // El reentrenamiento tarda minutos y el POST responde 202, así que el avance
  // solo puede seguirse sondeando mientras dure.
  const enCurso = estado?.progreso?.en_curso ?? false;
  const eraEnCurso = useRef(false);
  useEffect(() => {
    if (!enCurso) {
      if (eraEnCurso.current) {
        eraEnCurso.current = false;
        onCambio();
      }
      return;
    }
    eraEnCurso.current = true;
    const id = setInterval(cargar, 4000);
    return () => clearInterval(id);
  }, [enCurso, cargar, onCambio]);

  const handleRetrain = async () => {
    setConfirmacion(null);
    setLanzando(true);
    try {
      await runRetrain();
      toast.success('Reentrenamiento iniciado.');
      await cargar();
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo iniciar el reentrenamiento.'));
    } finally {
      setLanzando(false);
    }
  };

  const handleReload = async () => {
    setRecargando(true);
    try {
      const res = await reloadArtifact();
      setArtifact(res.artifact);
      onCambio();
      toast.success('Artefacto recargado desde disco.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo recargar el artefacto.'));
    } finally {
      setRecargando(false);
    }
  };

  const handleRollback = async (sello: string) => {
    setConfirmacion(null);
    try {
      const res = await rollbackArtifact(sello);
      setArtifact(res.artifact);
      await cargar();
      onCambio();
      toast.success('Modelo anterior restaurado.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo revertir el modelo.'));
    }
  };

  const ultimo = estado?.ultimo_resultado;
  const prog = estado?.progreso;
  const pct = prog?.total_pasos ? Math.round((100 * (prog.paso ?? 0)) / prog.total_pasos) : 0;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 bg-accent/10 text-accent rounded-lg flex items-center justify-center">
          <Cpu size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Modelo predictivo (XGBoost)</h2>
          <p className="text-xs text-slate-500">
            Reentrenamiento completo desde el corpus, con respaldo automático y vuelta atrás.
          </p>
        </div>
      </div>

      {artifact && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Última actualización', value: fmtFecha(artifact.entrenado_en) },
            { label: 'MAPE en test', value: `${artifact.mape_test}%` },
            { label: 'Puertos conocidos', value: artifact.n_puertos },
            { label: 'Importadores conocidos', value: artifact.n_importadores },
            { label: 'Features', value: artifact.n_features },
            { label: 'Mercado observado', value: `${artifact.serie_mercado_primer_mes} → ${artifact.serie_mercado_ultimo_mes}` },
            { label: 'Modelo en memoria', value: artifact.cargado ? 'Cargado' : 'No cargado' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Progreso */}
      {enCurso ? (
        <div className="mt-5 border border-accent/30 bg-accent/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Loader2 size={16} className="animate-spin text-accent" />
            Reentrenando… paso {prog?.paso ?? 0} de {prog?.total_pasos ?? 2}
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">{prog?.paso_nombre}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            No cierre el servidor. El modelo anterior sigue atendiendo cotizaciones hasta que termine.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setConfirmacion({ tipo: 'retrain' })}
            disabled={lanzando}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Database size={16} /> Reentrenar modelo
          </button>
          <button
            onClick={handleReload}
            disabled={recargando}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {recargando
              ? <><RefreshCw size={14} className="animate-spin" /> Recargando…</>
              : <><RefreshCw size={14} /> Recargar desde disco</>}
          </button>
        </div>
      )}

      {/* Resultado del último reentrenamiento */}
      {ultimo && !enCurso && (
        <div className={`mt-4 rounded-lg border p-4 ${
          ultimo.exito ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {ultimo.exito
              ? <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-700" />
              : <XCircle size={16} className="shrink-0 mt-0.5 text-red-700" />}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${ultimo.exito ? 'text-emerald-800' : 'text-red-800'}`}>
                {ultimo.exito
                  ? 'Último reentrenamiento completado'
                  : ultimo.revertido
                    ? 'Falló — se restauró el modelo anterior'
                    : 'Falló'}
              </p>
              <p className={`text-xs mt-1 ${ultimo.exito ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtFecha(ultimo.fin)} · {ultimo.duracion_s}s · corpus <code>{ultimo.corpus}</code>
              </p>
              {ultimo.error && <p className="text-xs mt-1 text-red-700">{ultimo.error}</p>}
              {ultimo.aviso && (
                <p className={`text-xs mt-1 font-medium ${
                  (ultimo.delta_mape ?? 0) > 1 ? 'text-amber-800' : 'text-emerald-700'
                }`}>
                  {ultimo.aviso}
                </p>
              )}

              {ultimo.logs && ultimo.logs.length > 0 && (
                <>
                  <button
                    onClick={() => setVerLog(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold mt-2 text-slate-600 hover:text-slate-800"
                  >
                    <Terminal size={12} /> Registro de la ejecución
                    <ChevronDown size={12} className={verLog ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                  {verLog && (
                    <div className="mt-2 space-y-2">
                      {ultimo.logs.map(l => (
                        <div key={l.paso}>
                          <p className="text-[11px] font-mono font-semibold text-slate-600">
                            {l.paso} (código {l.codigo})
                          </p>
                          <pre className="mt-1 max-h-64 overflow-auto bg-slate-900 text-slate-100 text-[10px] leading-relaxed p-3 rounded-lg whitespace-pre-wrap break-words">
                            {l.salida || '(sin salida)'}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Respaldos / rollback */}
      {estado && estado.respaldos.length > 0 && !enCurso && (
        <div className="mt-4">
          <p className="text-[11px] text-slate-500 mb-1.5">
            Modelos respaldados — vuelva a uno si el reentrenamiento no convenció:
          </p>
          <div className="flex flex-wrap gap-2">
            {estado.respaldos.filter(r => r.completo).map(r => (
              <button
                key={r.sello}
                onClick={() => setConfirmacion({ tipo: 'rollback', sello: r.sello })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
              >
                <RotateCcw size={11} />
                <span className="font-mono">{r.sello}</span>
                {r.mape_test !== null && <span className="text-slate-400">MAPE {r.mape_test}%</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      {estado && estado.historial.length > 1 && (
        <div className="mt-4 text-xs divide-y divide-slate-100 border border-slate-100 rounded-lg">
          {estado.historial.slice(0, 6).map((h, i) => (
            <div key={`${h.fin}-${i}`} className="flex items-center gap-3 px-3 py-2">
              <span className="w-40 text-slate-500">{fmtFecha(h.fin)}</span>
              <span className="flex-1 text-slate-600">
                {h.mape_antes ?? '—'}% → {h.mape_despues ?? '—'}%
                {h.delta_mape !== null && h.delta_mape !== undefined && (
                  <span className={h.delta_mape > 0 ? ' text-amber-600' : ' text-emerald-600'}>
                    {' '}({h.delta_mape > 0 ? '+' : ''}{h.delta_mape})
                  </span>
                )}
              </span>
              <span className={h.exito ? 'text-emerald-600' : 'text-red-600'}>
                {h.exito ? 'ok' : h.revertido ? 'revertido' : 'falló'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-slate-400" />
          <div className="space-y-1.5">
            <p>
              El reentrenamiento ejecuta <code>train_model.py</code> y después{' '}
              <code>train_quantile_models.py</code> — el orden lo impone el sistema, porque el
              segundo lee los codificadores que escribe el primero.
            </p>
            <p>
              Un MAPE que empeora <strong>no revierte solo</strong>: un corpus más largo y
              heterogéneo puede subirlo legítimamente. Se avisa y la decisión de volver atrás
              es suya.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        abierto={confirmacion?.tipo === 'retrain'}
        titulo="Reentrenar el modelo"
        mensaje={
          <>
            <p>Se reentrenará el modelo completo desde el corpus activo. Tarda varios minutos.</p>
            <p className="mt-2">
              El artefacto actual se respalda antes de empezar y se restaura solo si algo falla.
              Mientras dure, el modelo anterior sigue atendiendo cotizaciones.
            </p>
          </>
        }
        textoConfirmar="Reentrenar"
        onConfirmar={handleRetrain}
        onCancelar={() => setConfirmacion(null)}
      />

      <ConfirmDialog
        abierto={confirmacion?.tipo === 'rollback'}
        peligroso
        titulo="Volver al modelo anterior"
        mensaje={
          <>
            <p>
              Se restaurará el artefacto respaldado{' '}
              <span className="font-mono text-xs">
                {confirmacion?.tipo === 'rollback' ? confirmacion.sello : ''}
              </span>{' '}
              y se recargará en caliente.
            </p>
            <p className="mt-2">
              El artefacto actual se respalda antes, así que esta acción también se puede deshacer.
            </p>
          </>
        }
        textoConfirmar="Revertir"
        onConfirmar={() =>
          confirmacion?.tipo === 'rollback' && handleRollback(confirmacion.sello)
        }
        onCancelar={() => setConfirmacion(null)}
      />
    </div>
  );
}
