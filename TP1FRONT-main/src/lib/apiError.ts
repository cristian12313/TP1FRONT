/**
 * Traduce el error de una llamada a la API en un texto mostrable.
 *
 * H-33. Varias pantallas hacían `err?.response?.data?.detail || 'fallback'` y
 * pintaban el resultado directamente en JSX. El `detail` de FastAPI es una
 * cadena en los errores que lanza la aplicación, pero en un 422 de validación
 * es un ARRAY DE OBJETOS: renderizarlo produce "[object Object]" o, con un
 * array, el error de React "Objects are not valid as a React child".
 * `RetrainPanel` ya lo hacía bien con una comprobación de tipo; esto la
 * generaliza y además compone los mensajes de validación, que son los que de
 * verdad ayudan al usuario a corregir el formulario.
 */
interface DetalleValidacion {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

interface ErrorApi {
  response?: { data?: { detail?: unknown }; status?: number };
  code?: string;
  message?: string;
}

/** Nombre legible del campo a partir del `loc` de FastAPI (["body","peso_kg"]). */
function nombreCampo(loc?: (string | number)[]): string {
  if (!loc || loc.length === 0) return '';
  const campo = loc[loc.length - 1];
  return typeof campo === 'string' ? campo : '';
}

export function mensajeDeError(e: unknown, fallback: string): string {
  const err = e as ErrorApi;

  // Sin respuesta: la petición no llegó (backend caído, red, timeout).
  if (err?.response === undefined) {
    if (err?.code === 'ECONNABORTED') {
      return 'La operación tardó demasiado y se canceló. Intenta de nuevo.';
    }
    return 'No se pudo conectar con el servidor. Verifica que el backend esté activo.';
  }

  const detail = err.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const partes = (detail as DetalleValidacion[])
      .map(d => {
        const campo = nombreCampo(d?.loc);
        const msg = (d?.msg ?? '').replace(/^Value error,\s*/, '');
        if (!msg) return '';
        return campo ? `${campo}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (partes.length) return partes.join(' · ');
  }

  if (err.response?.status === 403) return 'No tienes permisos para esta acción.';
  if (err.response?.status === 429) return 'Demasiadas solicitudes. Espera un momento.';

  return fallback;
}
