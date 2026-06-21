import React from 'react';
import { HelpCircle, FileText, Info, PlayCircle } from 'lucide-react';

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center">
            <HelpCircle size={20} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Preguntas Frecuentes y Ayuda</h2>
        </div>
        <p className="text-sm text-slate-600 mb-6">Instrucciones básicas sobre cómo utilizar el sistema de cotización predictiva FreightIQ.</p>

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center mb-2">
              <FileText size={16} className="text-accent mr-2" />
              ¿Cómo cotizar un contenedor?
            </h3>
            <p className="text-sm text-slate-600">
              Ve a la vista "Nueva cotización". Selecciona el <b>Puerto Origen</b>, el <b>Tipo de Contenedor</b> y el <b>Peso (kg)</b> estimado.
              El destino siempre será "Callao". Una vez llenados estos datos obligatorios, el sistema validará en tiempo real para no dejar campos vacíos. Luego haz clic en "Estimar con XGBoost".
            </p>
          </div>
          
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center mb-2">
              <Info size={16} className="text-accent mr-2" />
              ¿Qué hago si falla la predicción?
            </h3>
            <p className="text-sm text-slate-600">
              Si el servicio de predicción muestra una alerta asegurando que hay problemas técnicos (HU-14),
              espera unos instantes e inténtalo nuevamente más tarde. Puede deberse a mantenimiento del predictor.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center mb-2">
              <PlayCircle size={16} className="text-accent mr-2" />
              ¿Puedo modificar una cotización posterior?
            </h3>
            <p className="text-sm text-slate-600">
              Los Analistas de Logística pueden editar las cotizaciones que estén pendientes ingresando el "Costo Real" para cerrar cada transacción y poder realizar la comparación predictiva contra la real. Operadores solo pueden agregar notas durante el proceso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
