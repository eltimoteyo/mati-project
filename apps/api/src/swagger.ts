import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { COOKIE_NAMES } from './common/constants/app.constants';
import { ApiErrorDto, ApiSuccessDto } from './common/dto/api-response.dto';
import type { AppConfig } from './config/configuration';

const DESCRIPTION = `
API REST del sistema de soporte tecnico de CONIT.

## Autenticacion

Los tokens **no viajan en el cuerpo de la respuesta**: se emiten como cookies
\`httpOnly\` (\`${COOKIE_NAMES.accessToken}\` y \`${COOKIE_NAMES.refreshToken}\`).
Al probar los endpoints desde esta pagina, el navegador las envia
automaticamente tras un \`POST /auth/login\` correcto.

## Formato de respuesta

Exito:

\`\`\`json
{ "success": true, "message": "Operacion realizada correctamente", "data": {} }
\`\`\`

Error:

\`\`\`json
{ "success": false, "message": "Credenciales incorrectas", "error": "UNAUTHORIZED" }
\`\`\`

La unica excepcion es \`GET /health\`, cuyo contrato es fijo para poder ser
consumido por orquestadores y balanceadores.
`.trim();

/**
 * Configura Swagger / OpenAPI.
 *
 * @returns La ruta publica de la documentacion, o `null` si esta desactivada.
 */
export function setupSwagger(
  app: INestApplication,
  configService: ConfigService<AppConfig, true>,
): string | null {
  const swagger = configService.get('swagger', { infer: true });

  if (!swagger.enabled) {
    return null;
  }

  const config = new DocumentBuilder()
    .setTitle('CONIT Support API')
    .setDescription(DESCRIPTION)
    .setVersion('0.1.0')
    .addCookieAuth(
      COOKIE_NAMES.accessToken,
      { type: 'apiKey', in: 'cookie', name: COOKIE_NAMES.accessToken },
      COOKIE_NAMES.accessToken,
    )
    .addCookieAuth(
      COOKIE_NAMES.refreshToken,
      { type: 'apiKey', in: 'cookie', name: COOKIE_NAMES.refreshToken },
      COOKIE_NAMES.refreshToken,
    )
    .addTag('Auth', 'Inicio de sesion, renovacion y cierre de sesion')
    .addTag('Users', 'Consulta del perfil autenticado')
    .addTag('Health', 'Estado del servicio y de sus dependencias')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiSuccessDto, ApiErrorDto],
  });

  SwaggerModule.setup(swagger.path, app, document, {
    customSiteTitle: 'CONIT Support API',
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
    },
  });

  return swagger.path;
}
