import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, EyeOff, RefreshCw, XOctagon } from 'lucide-react';
import { DriftDiagnostico, NivelDrift, getDrift } from '../../api/maintenance';

const ESTILO: Record<NivelDrift, { caja: string; texto: string; Icono: typeof CheckCircle2; etiqueta: string }> = {
  ok: {
    caja: 'bg-emerald-50 border-emerald-200',
    texto: 'text-emerald-800',
    Icono: CheckCircle2,
    etiqueta: 'Al día',
  },
  atencion: {
    caja: 'bg-amber-50 border-amber-200',
    texto: 'text-amber-800',
    Icono: AlertTriangle,
    etiqueta: 'Requiere atención',
  },
  critico: {
    caja: 'bg-red-50 border-red-200',
    texto: 'text-red-800',
    Icono: XOctagon,
    etiqueta: 'Reentrenamiento recomendado',
  },
};

export default function DriftPanel({ refreshToken }: { refreshToken: number }) {
  const [d, setD] = useState<DriftDiagnostico | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    getDrift()
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCargando(false));
  }, [refreshToken]);

  if (cargando && !d) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 text-sm text-slate-500">
        <RefreshCw size={16} className="animate-spin" /> Evaluando el estado del modelo…
      </div>
    );
  }
  if (!d) return null;

  const { caja, texto, Icono, etiqueta } = ESTILO[d.nivel];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`p-5 border-b ${caja}`}>
        <div className="flex items-start gap-3">
          <Icono size={22} className={`shrink-0 mt-0.5 ${texto}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base font-bold ${texto}`}>Estado del modelo: {etiqueta}</h2>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${texto} border-current`}>
                {d.nivel}
              </span>
            </div>
            <p className={`text-sm mt-1 ${texto}`}>{d.veredicto}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <Activity size={14} /> Señales medidas
        </div>

        {d.senales.map(s => {
          const e = ESTILO[s.nivel];
          return (
            <div
              key={s.nombre}
              className={`rounded-lg border p-3 ${e.caja} ${
                s.nombre === d.senal_dominante ? 'ring-1 ring-inset ring-current' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className={`text-sm font-semibold ${e.texto}`}>{s.titulo}</p>
                {s.valor !== null && (
                  <span className={`shrink-0 font-mono text-sm font-bold ${e.texto}`}>
                    {s.valor}
                    {s.unidad ? ` ${s.unidad}` : ''}
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 ${e.texto} opacity-90`}>{s.detalle}</p>
            </div>
          );
        })}

        {/* Declarar el punto ciego es parte del diagnóstico: sin esto, un
            veredicto "al día" se leería como "no hay deriva", que es más de lo
            que estas señales pueden afirmar. */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <EyeOff size={14} className="shrink-0 mt-0.5 text-slate-400" />
            <div>
              <p className="text-xs font-semibold text-slate-600">{d.no_observable.titulo}</p>
              <p className="text-[11px] text-slate-500 mt-1">{d.no_observable.detalle}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
