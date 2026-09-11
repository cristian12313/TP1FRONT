import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Diálogo de confirmación de la aplicación.
 *
 * H-30. Las cuatro confirmaciones del panel de Mantenimiento usaban el
 * `confirm()` nativo del navegador: rompe la consistencia visual con el resto de
 * la app (que usa `sonner` y modales propios), no permite explicar la acción con
 * formato, y bloquea el hilo de renderizado — durante la auditoría dejó colgado
 * un navegador headless hasta agotar el tiempo de espera.
 */
export interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligroso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligroso = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  // Escape cierra, como en cualquier diálogo modal.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto, onCancelar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                peligroso ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-base font-bold text-primary pt-2">{titulo}</h3>
          </div>
          <button
            onClick={onCancelar}
            aria-label="Cerrar"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-2 text-sm text-slate-600 leading-relaxed">{mensaje}</div>

        <div className="flex justify-end gap-2 p-6 pt-4">
          <button
            onClick={onCancelar}
            className="px-5 py-2.5 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            className={`px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 ${
              peligroso ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-accent/90'
            }`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
