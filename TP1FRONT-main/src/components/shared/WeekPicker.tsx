import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fechaASemanaISO,
  nombreMes,
  parseSemanaISO,
  rangoSemanaTexto,
  semanaEnRango,
  semanaISOToFecha,
  semanasDelMesVisible,
} from '../../lib/semanaISO';

type PosicionPanel =
  | { left: number; width: number; top: number; bottom?: undefined }
  | { left: number; width: number; bottom: number; top?: undefined };

interface Props {
  /** 'YYYY-Www' o ''. */
  value: string;
  onChange: (v: string) => void;
  /** 'YYYY-MM-DD', límites cotizables (derivados del artifact por el backend). */
  fechaMin: string;
  fechaMax: string;
}

/**
 * Selector de semana ISO, propio (no `<input type="week">`).
 *
 * `<input type="week">` no es viable multi-navegador: Firefox y Safari lo
 * ignoran por completo (degrada a texto libre, `min`/`max` quedan
 * decorativos), y en Chromium (reportado en Opera) el calendario nativo
 * resalta a la vez la semana de "hoy" y la celda bajo el cursor, que un
 * usuario lee como dos semanas seleccionadas. Este componente reproduce el
 * mismo campo compacto con ícono de calendario, pero el calendario que abre
 * es 100% nuestro: mismo comportamiento en cualquier navegador, y separa
 * explícitamente "hoy" (una etiqueta) de "seleccionada" (el resaltado).
 *
 * EL PANEL SE MONTA CON `createPortal` EN `document.body`, no como hijo
 * normal del campo. `NewQuote.tsx` envuelve el formulario en una tarjeta con
 * `overflow-hidden` (para que las esquinas redondeadas recorten el header y
 * el footer de color que van de borde a borde) — cualquier panel `absolute`
 * anidado ahí queda cortado por ese `overflow-hidden` en cuanto crece más
 * allá del borde de la tarjeta, sin importar cuánto se ajuste su tamaño o
 * z-index: el recorte lo aplica el ANCESTRO, no el panel. Sacarlo del árbol
 * del formulario con un portal, posicionado en `fixed` a partir de las
 * coordenadas reales del campo (`getBoundingClientRect`), es la única forma
 * de que nunca vuelva a quedar cortado, sea cual sea el contenedor donde este
 * componente se use en el futuro.
 */
export default function WeekPicker({ value, onChange, fechaMin, fechaMax }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PosicionPanel | null>(null);
  const [anioSel, semSel] = value ? parseSemanaISO(value) : [0, 0];
  const [hoyAnio, hoySemana] = fechaASemanaISO(new Date().toISOString().slice(0, 10));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mes que muestra el calendario. Al abrir, se ubica en el mes de la semana
  // elegida; si no hay ninguna, en el mes de hoy, recortado al rango cotizable.
  const mesInicial = (() => {
    const base = new Date(
      (value ? semanaISOToFecha(anioSel, semSel) : new Date().toISOString().slice(0, 10))
      + 'T00:00:00Z'
    );
    const min = new Date(fechaMin + 'T00:00:00Z');
    const max = new Date(fechaMax + 'T00:00:00Z');
    const clamped = base < min ? min : base > max ? max : base;
    return { anio: clamped.getUTCFullYear(), mes: clamped.getUTCMonth() };
  })();
  const [visible, setVisible] = useState(mesInicial);

  useLayoutEffect(() => {
    if (!open) return;
    setVisible(mesInicial);

    // Alto estimado del panel (header + hasta 6 semanas + acciones). Si no
    // entra debajo del campo pero sí arriba, se abre hacia arriba — evita que
    // el calendario quede fuera de la pantalla en campos cerca del borde
    // inferior, sin esperar a medir el panel ya renderizado.
    const ALTO_ESTIMADO = 320;
    const actualizarPos = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const espacioAbajo = window.innerHeight - r.bottom;
      const abrirArriba = espacioAbajo < ALTO_ESTIMADO && r.top > espacioAbajo;
      setPos(
        abrirArriba
          ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 }
          : { left: r.left, width: r.width, top: r.bottom + 6 }
      );
    };
    actualizarPos();

    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    // capture:true para enterarse también de scrolls DENTRO de contenedores
    // internos (no solo de la ventana), y que el panel siga al campo.
    window.addEventListener('scroll', actualizarPos, true);
    window.addEventListener('resize', actualizarPos);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('scroll', actualizarPos, true);
      window.removeEventListener('resize', actualizarPos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Límite de navegación: no tiene sentido dejar avanzar/retroceder el
  // calendario más allá del mes de fechaMin/fechaMax, donde ya no hay
  // ninguna semana habilitable — el usuario podría quedar clickeando
  // "siguiente" indefinidamente sin ver nunca una semana seleccionable.
  const minMes = new Date(fechaMin + 'T00:00:00Z');
  const maxMes = new Date(fechaMax + 'T00:00:00Z');
  const primerDiaVisible = new Date(Date.UTC(visible.anio, visible.mes, 1));
  const prevDeshabilitado = primerDiaVisible <= new Date(Date.UTC(minMes.getUTCFullYear(), minMes.getUTCMonth(), 1));
  const nextDeshabilitado = primerDiaVisible >= new Date(Date.UTC(maxMes.getUTCFullYear(), maxMes.getUTCMonth(), 1));

  const cambiarMes = (delta: number) => {
    if ((delta < 0 && prevDeshabilitado) || (delta > 0 && nextDeshabilitado)) return;
    setVisible(v => {
      const d = new Date(Date.UTC(v.anio, v.mes + delta, 1));
      return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
    });
  };

  const semanas = semanasDelMesVisible(visible.anio, visible.mes);
  const hoyEnRango = semanaEnRango(hoyAnio, hoySemana, fechaMin, fechaMax);

  const etiqueta = value
    ? `Semana ${semSel}, ${anioSel}`
    : 'Seleccione semana';

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between text-sm border rounded-lg p-3 outline-none transition-colors ${
          open ? 'border-accent ring-2 ring-accent' : 'border-slate-300 hover:border-slate-400'
        } bg-white`}>
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>{etiqueta}</span>
        <Calendar size={16} className="text-slate-400 shrink-0" />
      </button>

      {open && pos && createPortal(
        <div ref={panelRef}
          style={{
            position: 'fixed',
            left: pos.left,
            width: Math.max(pos.width, 280),
            ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
          }}
          className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          {/* Header: mes visible + navegación */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => cambiarMes(-1)} disabled={prevDeshabilitado}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 capitalize">
              {nombreMes(visible.mes)} de {visible.anio}
            </span>
            <button type="button" onClick={() => cambiarMes(1)} disabled={nextDeshabilitado}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Semanas del mes visible */}
          <ul className="space-y-1">
            {semanas.map(({ anio, semana, lunes }) => {
              const seleccionada = anio === anioSel && semana === semSel;
              const esHoy = anio === hoyAnio && semana === hoySemana;
              const habilitada = semanaEnRango(anio, semana, fechaMin, fechaMax);
              return (
                <li key={`${anio}-${semana}`}>
                  <button type="button" disabled={!habilitada}
                    onClick={() => { onChange(`${anio}-W${String(semana).padStart(2, '0')}`); setOpen(false); }}
                    title={habilitada ? undefined : 'Fuera del rango cotizable'}
                    className={`w-full flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-md transition-colors ${
                      !habilitada
                        ? 'text-slate-300 cursor-not-allowed'
                        : seleccionada
                          ? 'bg-primary text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                    <span>Semana {semana} · {rangoSemanaTexto(lunes)}</span>
                    {esHoy && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        seleccionada ? 'bg-white/20 text-white' : 'bg-accent/10 text-accent'
                      }`}>
                        Hoy
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Acciones */}
          <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}
              className="text-slate-500 hover:text-slate-700 font-medium">
              Borrar
            </button>
            <button type="button" disabled={!hoyEnRango}
              onClick={() => {
                onChange(`${hoyAnio}-W${String(hoySemana).padStart(2, '0')}`);
                setVisible({ anio: hoyAnio, mes: new Date(semanaISOToFecha(hoyAnio, hoySemana) + 'T00:00:00Z').getUTCMonth() });
                setOpen(false);
              }}
              className={`font-medium ${hoyEnRango ? 'text-accent hover:text-accent/80' : 'text-slate-300 cursor-not-allowed'}`}>
              Esta semana
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
