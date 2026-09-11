import { create } from 'zustand';

/**
 * Estado de la última predicción calculada, leído por el header GLOBAL
 * (AppLayout) para mostrar los badges de MAPE / tiempo / calibración del IC.
 *
 * Antes esos badges vivían DENTRO de la tarjeta de resultado (arriba del
 * precio), en el flujo normal del documento. Cuando la tarjeta de resultado
 * queda muy pegada al borde superior de la página (layout de dos columnas,
 * ventana ancha), esos badges terminaban visualmente adosados a la barra
 * superior sticky ("Modelo: XGBoost v1.0"), dando la impresión de una sola
 * franja de header rota en dos mitades con estilos distintos.
 *
 * Moverlos al header global los saca del flujo de la tarjeta: viven en el
 * mismo elemento sticky que el resto del header, así que no pueden quedar
 * separados de él ni superpuestos con nada — no es un ajuste de z-index o
 * márgenes sobre el síntoma, es sacar el elemento del lugar donde el
 * solapamiento podía ocurrir.
 */
interface PredictionStatusState {
  mape: number | null;
  mapeRegimen: 'historico' | 'extrapolado' | null;
  tiempoMs: number | null;
  ic95Calibrado: boolean | null;
  horizonteCalibradoMeses: number | null;
  setStatus: (s: {
    mape: number;
    mapeRegimen: 'historico' | 'extrapolado';
    tiempoMs: number;
    ic95Calibrado: boolean;
    horizonteCalibradoMeses?: number | null;
  }) => void;
  clearStatus: () => void;
}

export const usePredictionStatusStore = create<PredictionStatusState>((set) => ({
  mape: null,
  mapeRegimen: null,
  tiempoMs: null,
  ic95Calibrado: null,
  horizonteCalibradoMeses: null,

  setStatus: (s) =>
    set({
      mape: s.mape,
      mapeRegimen: s.mapeRegimen,
      tiempoMs: s.tiempoMs,
      ic95Calibrado: s.ic95Calibrado,
      horizonteCalibradoMeses: s.horizonteCalibradoMeses ?? null,
    }),

  // Se llama al salir de la página de cotización (o al limpiar el
  // formulario) para que el header no siga mostrando el estado de una
  // predicción de una pantalla que ya no está visible.
  clearStatus: () =>
    set({
      mape: null,
      mapeRegimen: null,
      tiempoMs: null,
      ic95Calibrado: null,
      horizonteCalibradoMeses: null,
    }),
}));
