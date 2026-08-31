/**
 * Serializa filtros a una cadena de consulta.
 *
 * Omite valores vacios, `null` y `undefined`: la API valida con
 * `forbidNonWhitelisted`, y enviar `?status=` (vacio) provocaria un 400 en
 * lugar de "sin filtro", que es lo que espera quien usa la interfaz.
 */
export function toQueryString(params: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params) as Array<[string, unknown]>) {
    if (value === undefined || value === null || value === '') continue;

    if (typeof value === 'boolean') {
      // Solo se envia cuando es `true`: un `false` explicito no aporta nada.
      if (value) search.set(key, 'true');
      continue;
    }

    search.set(key, String(value));
  }

  const query = search.toString();

  return query ? `?${query}` : '';
}
