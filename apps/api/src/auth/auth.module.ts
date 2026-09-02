import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AUTH_STRATEGIES } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshFailureFilter } from './filters/refresh-failure.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { SecurityModule } from './security.module';
import { CookieService } from './services/cookie.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

/**
 * Modulo de autenticacion.
 *
 * `JwtModule` se registra sin secreto global a proposito: cada token se firma
 * con su propio secreto desde `TokenService`, evitando que un descuido use el
 * secreto de acceso para firmar refresh tokens.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: AUTH_STRATEGIES.jwt, session: false }),
    JwtModule.register({}),
    SecurityModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    CookieService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    RefreshFailureFilter,
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
