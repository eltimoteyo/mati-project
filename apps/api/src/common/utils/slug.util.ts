/**
 * Genera un identificador legible y estable a partir de un texto.
 *
 * Se usa para las categorias, cuyo `slug` aparece en los filtros de la URL.
 * La normalizacion Unicode separa los acentos de su letra base para poder
 * eliminarlos, de modo que "Correo electronico" y "Correo electrónico"
 * producen el mismo resultado.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
