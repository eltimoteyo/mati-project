import { Module } from '@nestjs/common';

import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';

/**
 * Primitivas de seguridad compartidas.
 *
 * Viven en su propio modulo porque las necesitan tanto `AuthModule` como
 * `UsersModule`: dar de alta a un agente exige cifrar su contrasena, y
 * desactivarlo exige revocar sus sesiones. Sin esta separacion, `UsersModule`
 * tendria que importar `AuthModule` —que a su vez importa `UsersModule`— y la
 * dependencia seria circular.
 *
 * Ninguno de los dos servicios depende de nada mas que de Prisma, asi que
 * extraerlos no arrastra el resto del modulo de autenticacion.
 */
@Module({
  providers: [PasswordService, SessionService],
  exports: [PasswordService, SessionService],
})
export class SecurityModule {}
