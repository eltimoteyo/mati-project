import { SetMetadata } from '@nestjs/common';

import { METADATA_KEYS } from '../constants/app.constants';

/**
 * Marca un endpoint como publico.
 *
 * `JwtAuthGuard` esta registrado de forma global: por defecto todo requiere
 * sesion y solo lo explicitamente marcado con `@Public()` queda abierto.
 * Este enfoque evita exponer rutas por olvido.
 */
export const Public = () => SetMetadata(METADATA_KEYS.isPublic, true);
