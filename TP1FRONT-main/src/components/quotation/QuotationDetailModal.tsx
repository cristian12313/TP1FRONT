import React from 'react';
import { X, Ship } from 'lucide-react';
import { QuotationItem } from '../../api/quotations';
import PredictionInsights from './PredictionInsights';

const KG_PER_TON = 1000;

interface Props {
  item: QuotationItem;
  onClose: () => void;
}

const fmtUsd = (v: number, dec = 2) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

/**
 * Modal de solo lectura que muestra los datos guardados de una cotización
 * (los mismos del panel derecho de Nueva Cotización): precio por tonelada,
 * flete total, IC95, dispersión, confianza y variables SHAP.
 */
export default function QuotationDetailModal({ item, onClose }: Props) {
  const toneladas = item.peso_kg / KG_PER_TON;
  const precioTon = toneladas > 0 ? item.flete_estimado_usd / toneladas : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con precio */}
        <div className="bg-primary p-6 text-white relative overflow-hidden rounded-t-xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition-colors z-10"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
          <div className="relative z-10 text-center">
            <p className="font-mono text-xs text-white/60 mb-3">{item.code}</p>
            <p className="text-sm text-white/70 mb-1">Precio Estimado por Tonelada (USD/t)</p>
            <h2 className="text-4xl font-bold tracking-tight">{fmtUsd(precioTon)}</h2>
            <p className="text-sm text-white/80 mt-2">
              Flete total: <span className="font-semibold">{fmtUsd(item.flete_estimado_usd)} USD</span>
            </p>
            <p className="text-xs text-white/50 mt-1">
              IC 95%: {fmtUsd(item.ic95_min, 0)} — {fmtUsd(item.ic95_max, 0)}
            </p>
          </div>
          <Ship className="absolute -right-4 -bottom-6 w-28 h-28 text-white/5" />
        </div>

        <div className="p-6 space-y-6">
          {/* Datos del embarque */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detalle label="Puerto de Embarque" value={item.puerto_origen} />
            <Detalle label="Puerto de Destino" value="Callao (PE)" />
            {item.importador && <Detalle label="Importador" value={item.importador} />}
            <Detalle label="Peso Neto" value={`${toneladas.toLocaleString('en-US', { maximumFractionDigits: 3 })} t`} />
            {item.unidades != null && <Detalle label="Unidades" value={String(item.unidades)} />}
            {item.tipo_contenedor && <Detalle label="Contenedor" value={item.tipo_contenedor} />}
            {item.fecha_embarque && <Detalle label="Fecha embarque" value={item.fecha_embarque} />}
            <Detalle label="Estado" value={item.estado} />
            {item.usuario_nombre && <Detalle label="Operador" value={item.usuario_nombre} />}
          </div>

          <hr className="border-slate-100" />

          {/* Insights (dispersión, confianza, SHAP) */}
          <PredictionInsights
            fleteEstimado={item.flete_estimado_usd}
            ic95Min={item.ic95_min}
            ic95Max={item.ic95_max}
            mape={item.mape_modelo}
            shap={item.shap_contribuciones ?? []}
          />

          {/* Costo real / error si existe */}
          {item.costo_real_usd != null && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Costo Real Registrado</p>
                <p className="text-lg font-bold text-slate-800">{fmtUsd(item.costo_real_usd)}</p>
              </div>
              {item.error_pct != null && (
                <span className="text-sm font-semibold text-slate-600">Error {item.error_pct.toFixed(1)}%</span>
              )}
            </div>
          )}

          {/* Comentario */}
          {item.comentario && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Comentarios</p>
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-wrap">
                {item.comentario}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detalle({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
