import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { SHAPContribution } from '../../api/predictions';

interface Props {
  fleteEstimado: number;
  ic95Min: number;
  ic95Max: number;
  mape: number;
  shap: SHAPContribution[];
}

type Level = 'Baja' | 'Media' | 'Alta';

const LEVEL_STYLES: Record<Level, { badge: string; bar: string; marker: string; text: string }> = {
  Baja:  { badge: 'bg-green-100 text-green-700 border-green-200', bar: 'bg-green-100', marker: 'bg-green-500', text: 'text-green-600' },
  Media: { badge: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-100', marker: 'bg-amber-500', text: 'text-amber-600' },
  Alta:  { badge: 'bg-red-100 text-red-700 border-red-200',       bar: 'bg-red-100',   marker: 'bg-red-500',   text: 'text-red-600' },
};

function dispersionLevel(relPct: number): Level {
  if (relPct < 20) return 'Baja';
  if (relPct <= 40) return 'Media';
  return 'Alta';
}

// Estilos de la confianza: mismas etiquetas que Level, pero el color va en
// sentido INVERSO (confianza Alta = verde = bueno; dispersión Alta = rojo =
// malo), así que no se reutiliza LEVEL_STYLES para no invertir su semántica.
const CONFIANZA_STYLES: Record<Level, string> = {
  Alta:  'bg-green-100 text-green-700 border-green-200',
  Media: 'bg-amber-100 text-amber-700 border-amber-200',
  Baja:  'bg-red-100 text-red-700 border-red-200',
};
const CONFIANZA_BAR: Record<Level, string> = {
  Alta: 'bg-green-500', Media: 'bg-amber-500', Baja: 'bg-red-500',
};

function confianzaNivel(pct: number): Level {
  if (pct >= 60) return 'Alta';
  if (pct >= 35) return 'Media';
  return 'Baja';
}

const usd = (n: number, dec = 0) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

/**
 * Panel de análisis para el analista: nivel de dispersión (IC95),
 * variables SHAP en barras y un indicador de confianza del modelo.
 * Se calcula todo a partir de los datos guardados de la predicción.
 */
export default function PredictionInsights({ fleteEstimado, ic95Min, ic95Max, mape, shap }: Props) {
  const amplitud = Math.max(ic95Max - ic95Min, 0);
  const margen = amplitud / 2;
  const relPct = fleteEstimado > 0 ? (margen / fleteEstimado) * 100 : 0;
  const level = dispersionLevel(relPct);
  const styles = LEVEL_STYLES[level];

  // Posición del estimado dentro del rango [min, max] (≈50% por simetría)
  const estPos = amplitud > 0 ? ((fleteEstimado - ic95Min) / amplitud) * 100 : 50;

  // Confianza del modelo: decae con la dispersión relativa, pero NO como
  // "100 - relPct". Esa resta lineal toca 0% exacto en cuanto la dispersión
  // supera el 100% del estimado — algo frecuente en cotizaciones extrapoladas
  // (ver auditoría de modelo: el ancho del IC llega a medir hasta 5.5x el
  // valor estimado) — y un "0%" en pantalla se lee como "la herramienta está
  // rota", no como "hay poca confianza". Esta curva es una asíntota: nunca
  // llega a 0 exacto y decae más suavemente, así que sigue leyéndose como un
  // número bajo y honesto sin parecer un error.
  const confianza = 100 / (1 + relPct / 60);
  const nivelConfianza = confianzaNivel(confianza);

  const maxAbs = Math.max(...shap.map(s => Math.abs(s.aporte)), 1);

  return (
    <div className="space-y-6">
      {/* ── Nivel de dispersión (IC95) ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={13} className="text-slate-400" /> Nivel de Dispersión
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
            {level} · ±{relPct.toFixed(0)}%
          </span>
        </div>

        {/* Barra de rango: min — estimado — max */}
        <div className={`relative h-2.5 rounded-full ${styles.bar}`}>
          <div
            className={`absolute -top-1 w-1.5 h-[18px] rounded ${styles.marker}`}
            style={{ left: `calc(${estPos}% - 3px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
          <span>{usd(ic95Min)}</span>
          <span className={`font-semibold ${styles.text}`}>Estimado {usd(fleteEstimado)}</span>
          <span>{usd(ic95Max)}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Amplitud IC 95%: {usd(amplitud)} (±{usd(margen)}). Mayor dispersión = mayor incertidumbre.
          {ic95Min <= 0 && (
            // El $0 de arriba es el piso FÍSICO del intervalo (un flete no
            // puede ser negativo), no una predicción de flete gratuito. Sin
            // esta aclaración, el número solo se lee como un error de cálculo.
            ' El límite inferior de $0 es ese piso físico, no una estimación de flete cercano a cero.'
          )}
        </p>
      </div>

      {/* ── Indicador de confianza ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-slate-400" /> Confianza del Modelo
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CONFIANZA_STYLES[nivelConfianza]}`}>
            {nivelConfianza} · {confianza.toFixed(0)}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${CONFIANZA_BAR[nivelConfianza]}`}
            style={{ width: `${Math.max(confianza, 4)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Basado en el MAPE del modelo ({mape.toFixed(1)}%) y la amplitud del intervalo respecto al estimado.
        </p>
      </div>

      {/* ── Variables SHAP en barras ───────────────────────────────────── */}
      {shap.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Top Variables Influyentes
          </p>
          <ul className="space-y-2.5">
            {shap.map((c, i) => {
              const abs = Math.abs(c.aporte);
              const positive = c.direction === 'positive';
              return (
                <li key={i}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium text-slate-700">{i + 1}. {c.variable}</span>
                    <span className={`font-semibold ${positive ? 'text-red-600' : 'text-green-600'}`}>
                      {positive ? '↑' : '↓'} {usd(abs)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${positive ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{ width: `${(abs / maxAbs) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-400 mt-2">
            <span className="text-red-500 font-medium">↑ Rojo</span> encarece el flete ·{' '}
            <span className="text-green-600 font-medium">↓ Verde</span> lo abarata.
          </p>
        </div>
      )}
    </div>
  );
}
