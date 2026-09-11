import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, FileSpreadsheet, History, Loader2, RefreshCw,
  RotateCcw, Upload, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../shared/ConfirmDialog';
import {
  CorpusEstado, ValidacionCorpus,
  getCorpus, incorporarCorpus, restaurarCorpus, validarCorpus,
} from '../../api/maintenance';

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function errorMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function CorpusPanel({ onCambio }: { onCambio: () => void }) {
  const [corpus, setCorpus] = useState<CorpusEstado | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [validacion, setValidacion] = useState<ValidacionCorpus | null>(null);
  const [validando, setValidando] = useState(false);
  const [incorporando, setIncorporando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  // H-30: sustituye al confirm() nativo.
  const [aRestaurar, setARestaurar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCorpus(await getCorpus());
    } catch {
      toast.error('No se pudo cargar el estado del corpus.');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (f: File | null) => {
    setArchivo(f);
    setValidacion(null);
  };

  const handleValidar = async () => {
    if (!archivo) return;
    setValidando(true);
    try {
      const res = await validarCorpus(archivo);
      setValidacion(res.validacion);
      if (!res.validacion.valido) toast.error('El archivo no se puede incorporar. Vea el detalle.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo analizar el archivo.'));
    } finally {
      setValidando(false);
    }
  };

  const handleIncorporar = async () => {
    if (!archivo) return;
    setIncorporando(true);
    try {
      const res = await incorporarCorpus(archivo);
      setCorpus(res.corpus);
      setArchivo(null);
      setValidacion(null);
      onCambio();
      toast.success(
        `Incorporadas ${res.fusion.filas_nuevas ?? 0} filas nuevas. ` +
        'Reentrene para que el modelo las aproveche.',
      );
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo incorporar el archivo.'));
    } finally {
      setIncorporando(false);
    }
  };

  const handleRestaurar = async (nombre: string) => {
    setARestaurar(null);
    try {
      setCorpus(await restaurarCorpus(nombre));
      onCambio();
      toast.success('Corpus restaurado.');
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo restaurar el corpus.'));
    }
  };

  const puedeIncorporar = validacion?.valido && validacion.filas_nuevas > 0;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
          <FileSpreadsheet size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Corpus de entrenamiento</h2>
          <p className="text-xs text-slate-500">
            El CSV detallado de declaraciones de SUNAT. Es la única fuente del puerto de embarque.
          </p>
        </div>
      </div>

      <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>
          El robot de Aduanet mantiene los precios de mercado, pero no puede traer el puerto de
          embarque: está tras un CAPTCHA y tampoco figura en el portal de datos abiertos. Sin él no
          se pueden actualizar <code>puerto_freq</code> ni <code>ruta_directa_por_puerto</code>, así
          que este CSV hay que pedirlo a SUNAT y cargarlo aquí.
        </span>
      </div>

      {/* Estado actual */}
      {corpus && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Filas en alcance', value: corpus.filas_en_alcance.toLocaleString('es-PE') },
            { label: 'Último dato', value: corpus.fecha_max_en_alcance ?? '—' },
            { label: 'Importadores', value: corpus.n_importadores },
            { label: 'Puertos', value: corpus.n_puertos },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}
      {corpus && (
        <p className="text-[11px] text-slate-400 mt-2">
          Origen: <code>{corpus.ruta}</code>
          {corpus.es_corpus_base
            ? ' (corpus base original, aún sin incorporaciones)'
            : ' (corpus acumulativo: base + lo incorporado después)'}
          {corpus.fecha_min && ` · ${corpus.fecha_min} → ${corpus.fecha_max}`}
        </p>
      )}

      {/* Carga */}
      <div className="mt-5 border-2 border-dashed border-slate-300 rounded-xl p-6">
        <div className="flex flex-col items-center text-center">
          <Upload size={32} className="text-slate-400 mb-3" />
          <input
            type="file"
            accept=".csv"
            id="corpus-upload"
            className="hidden"
            onChange={e => elegir(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="corpus-upload"
            className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {archivo ? 'Elegir otro archivo' : 'Seleccionar CSV de SUNAT'}
          </label>
          {archivo && (
            <p className="text-xs text-slate-600 mt-3 font-mono">
              {archivo.name} · {(archivo.size / 1024 / 1024).toFixed(1)} MB
            </p>
          )}

          {archivo && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <button
                onClick={handleValidar}
                disabled={validando || incorporando}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                {validando
                  ? <><Loader2 size={14} className="animate-spin" /> Analizando…</>
                  : <>Analizar sin incorporar</>}
              </button>
              <button
                onClick={handleIncorporar}
                disabled={incorporando || validando || (validacion !== null && !puedeIncorporar)}
                title={
                  validacion && !puedeIncorporar
                    ? 'El análisis indica que este archivo no aporta filas nuevas incorporables.'
                    : undefined
                }
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {incorporando
                  ? <><Loader2 size={14} className="animate-spin" /> Incorporando…</>
                  : <>Incorporar al corpus</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Informe de validación */}
      {validacion && (
        <div className={`mt-4 rounded-lg border p-4 ${
          validacion.valido ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {validacion.valido
              ? <CheckCircle2 size={16} className="text-emerald-600" />
              : <XCircle size={16} className="text-red-600" />}
            <p className="text-sm font-semibold text-slate-700">
              {validacion.valido ? 'El archivo se puede incorporar' : 'El archivo no se puede incorporar'}
            </p>
          </div>

          {validacion.columnas_faltantes.length > 0 && (
            <p className="text-xs text-red-700 mb-2">
              Faltan columnas que el entrenamiento necesita:{' '}
              <code>{validacion.columnas_faltantes.join(', ')}</code>
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['Filas', validacion.filas.toLocaleString('es-PE')],
              ['En alcance', validacion.filas_en_alcance.toLocaleString('es-PE')],
              ['Nuevas', validacion.filas_nuevas.toLocaleString('es-PE')],
              ['Ya presentes', validacion.filas_ya_presentes.toLocaleString('es-PE')],
              ['Rango', validacion.fecha_min ? `${validacion.fecha_min} → ${validacion.fecha_max}` : '—'],
              ['Puertos nuevos', validacion.puertos_nuevos.length],
              ['Importadores nuevos', validacion.importadores_nuevos],
              ['Subpartidas', validacion.subpartidas.join(', ') || '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-white border border-slate-200 rounded p-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{k}</p>
                <p className="font-semibold text-slate-700 mt-0.5 break-words">{v}</p>
              </div>
            ))}
          </div>

          {validacion.avisos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {validacion.avisos.map((a, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" /> {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Historial */}
      {corpus && (corpus.incorporaciones.length > 0 || corpus.respaldos.length > 0) && (
        <div className="mt-5">
          <button
            onClick={() => setVerHistorial(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            <History size={14} /> Historial de incorporaciones ({corpus.incorporaciones.length})
          </button>

          {verHistorial && (
            <div className="mt-3 space-y-2">
              {corpus.incorporaciones.map((inc, i) => (
                <div key={i} className="text-xs border border-slate-100 rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-slate-500 w-40">{fmtFecha(inc.fecha)}</span>
                  <span className="font-mono text-slate-700 flex-1 truncate">{inc.fichero}</span>
                  {inc.filas_nuevas !== undefined && (
                    <span className="text-emerald-600">+{inc.filas_nuevas.toLocaleString('es-PE')} filas</span>
                  )}
                  {inc.filas_corpus_despues !== undefined && (
                    <span className="text-slate-400">→ {inc.filas_corpus_despues.toLocaleString('es-PE')}</span>
                  )}
                </div>
              ))}

              {corpus.respaldos.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Respaldos del corpus (deshacen una incorporación equivocada):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {corpus.respaldos.map(r => (
                      <button
                        key={r}
                        onClick={() => setARestaurar(r)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                      >
                        <RotateCcw size={11} /> {r.replace('corpus_', '').replace('.csv', '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
        >
          <RefreshCw size={12} /> Refrescar
        </button>
      </div>

      <ConfirmDialog
        abierto={aRestaurar !== null}
        peligroso
        titulo="Restaurar un corpus anterior"
        mensaje={
          <>
            <p>
              Se volverá al respaldo{' '}
              <span className="font-mono text-xs">{aRestaurar}</span>.
            </p>
            <p className="mt-2">
              Se deshacen todas las incorporaciones posteriores. El corpus actual se respalda
              antes, así que la operación es reversible. El modelo NO se reentrena.
            </p>
          </>
        }
        textoConfirmar="Restaurar"
        onConfirmar={() => aRestaurar && handleRestaurar(aRestaurar)}
        onCancelar={() => setARestaurar(null)}
      />
    </div>
  );
}
