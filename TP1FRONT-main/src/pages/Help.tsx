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
              Ve a "Nueva Cotización". Elige el <b>Puerto de Embarque</b> e ingresa el <b>Peso Neto (toneladas)</b>, que son
              obligatorios; si los conoces, añade el <b>Importador</b>, la <b>Cantidad de Unidades</b> y el <b>Periodo de
              Embarque</b> (semanal, mensual o anual). El destino siempre es Callao (PE). Pulsa "Estimar Flete" para ver el
              flete estimado con su intervalo predictivo 95% y las variables que más influyeron.
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Para conservarla, escribe un comentario opcional y pulsa "Guardar Cotización": el sistema le asigna un código
              JPS-AAAAMMDD-XXXX. El PDF para el cliente se descarga con "PDF Oficial" una vez guardada.
            </p>
          </div>
          
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center mb-2">
              <Info size={16} className="text-accent mr-2" />
              ¿Qué hago si falla la predicción?
            </h3>
            <p className="text-sm text-slate-600">
              Si aparece el recuadro "Error de Predicción", espera unos instantes y vuelve a pulsar "Estimar Flete": puede
              deberse a una demora del modelo o a un mantenimiento en curso. Si el problema persiste, avisa al administrador.
              Revisa también los avisos en ámbar junto al resultado: indican cuando la estimación es solo orientativa (por
              ejemplo, una fecha que va más allá del último mercado observado).
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center mb-2">
              <PlayCircle size={16} className="text-accent mr-2" />
              ¿Puedo modificar una cotización posterior?
            </h3>
            <p className="text-sm text-slate-600">
              El importe estimado de una cotización guardada no se modifica. En "Historial", el Analista y el Administrador
              pueden registrar el costo real con "Ingresar Costo" para cerrarla; el sistema calcula entonces el error de la
              estimación. El Operador ve solo sus propias cotizaciones, y el comentario se añade antes de guardarla.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
