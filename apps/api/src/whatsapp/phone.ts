/**
 * Normalizacion de telefonos para compararlos con los numeros de WhatsApp.
 *
 * Meta identifica a cada contacto con el numero completo, solo digitos y con
 * codigo de pais (`51987654321`). En las fichas el telefono es texto libre y
 * a menudo se guarda sin prefijo (`987 654 321`): sin normalizarlo, ese
 * cliente nunca se reconoceria por su numero.
 */

/** Codigo de pais que se asume para un movil local: CONIT atiende en Peru. */
export const DEFAULT_COUNTRY_CODE = '51';

/**
 * Solo digitos y con codigo de pais.
 *
 * Solo se completa el caso inequivoco: un movil peruano de 9 digitos que
 * empieza por 9. Cualquier otro numero se deja como esta, para no inventar un
 * prefijo que identifique a quien no es.
 */
export function normalizePhone(raw: string | null | undefined): string {
  let digits = (raw ?? '').replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^9\d{8}$/.test(digits)) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;

  return digits;
}
