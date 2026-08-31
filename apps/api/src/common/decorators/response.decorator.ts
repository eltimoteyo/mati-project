import { SetMetadata } from '@nestjs/common';

import { METADATA_KEYS } from '../constants/app.constants';

/**
 * Define el mensaje de exito que devolvera la envoltura de respuesta.
 * Sin este decorador se usa `DEFAULT_SUCCESS_MESSAGE`.
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(METADATA_KEYS.responseMessage, message);

/**
 * Desactiva la envoltura `{ success, message, data }` para un endpoint.
 *
 * Se usa unicamente en contratos publicos con forma fija, como
 * `GET /health`, que deben responder exactamente `{ "status": "ok" }`
 * para ser compatibles con orquestadores y balanceadores.
 */
export const RawResponse = () => SetMetadata(METADATA_KEYS.rawResponse, true);
