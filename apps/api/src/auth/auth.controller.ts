import type { LoginResponse } from '@conit/types';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { ApiEnvelopeResponse, ApiErrorResponse } from '../common/dto/api-response.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { AUTH_MESSAGES, LOGIN_RATE_LIMIT } from './auth.constants';
import { AuthService, type IssuedSession } from './auth.service';
import { AuthSessionDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshFailureFilter } from './filters/refresh-failure.filter';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CookieService } from './services/cookie.service';
import type { SessionMetadata } from './services/session.service';
import type { RefreshedUser } from './strategies/jwt-refresh.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  /**
   * Inicio de sesion.
   *
   * Devuelve 200 (no 201) porque no crea un recurso direccionable: abre una
   * sesion. Los tokens se emiten como cookies `httpOnly`, nunca en el cuerpo.
   */
  @Public()
  @Throttle({ default: LOGIN_RATE_LIMIT })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.loginSuccess)
  @ApiOperation({
    summary: 'Iniciar sesion',
    description:
      'Valida las credenciales y emite las cookies `conit_at` (access token) y ' +
      '`conit_rt` (refresh token). Limitado a 5 intentos por minuto y direccion IP.',
  })
  @ApiEnvelopeResponse(AuthSessionDto, { description: 'Sesion iniciada correctamente.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Datos de entrada invalidos.')
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Credenciales incorrectas o cuenta inactiva.')
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Demasiados intentos de inicio de sesion.')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const issued = await this.authService.login(dto, this.metadataFrom(request));

    return this.applySession(response, issued);
  }

  /**
   * Renovacion de la sesion.
   *
   * Se autentica con el refresh token, no con el access token, por lo que el
   * guard se aplica de forma explicita en lugar del global.
   */
  @Public()
  @UseGuards(JwtRefreshGuard)
  // Si el refresco falla, el filtro borra las cookies para que el navegador
  // deje de presentar una sesion que ya no existe.
  @UseFilters(RefreshFailureFilter)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.refreshSuccess)
  @ApiCookieAuth('conit_rt')
  @ApiOperation({
    summary: 'Renovar la sesion',
    description:
      'Rota el refresh token y emite un nuevo access token. La caducidad ' +
      'absoluta de la sesion no se prolonga. Detecta reutilizacion de tokens.',
  })
  @ApiEnvelopeResponse(AuthSessionDto, { description: 'Sesion renovada correctamente.' })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Refresh token ausente, expirado o ya rotado.')
  async refresh(
    @CurrentUser() user: RefreshedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const issued = await this.authService.refresh(user, this.metadataFrom(request));

    return this.applySession(response, issued);
  }

  /**
   * Cambio de contrasena del usuario autenticado.
   *
   * Revoca el resto de sesiones al terminar; la actual se conserva para no
   * expulsar a quien acaba de hacer el cambio.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.passwordChanged)
  @ApiCookieAuth('conit_at')
  @ApiOperation({
    summary: 'Cambiar la contrasena',
    description:
      'Exige la contrasena actual. Al completarse revoca las sesiones abiertas en otros ' +
      'dispositivos, pero mantiene la actual.',
  })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'La contrasena actual no es correcta.')
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'La nueva contrasena no cumple los requisitos.')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<null> {
    await this.authService.changePassword(
      user.id,
      user.sessionId,
      dto.currentPassword,
      dto.newPassword,
    );

    return null;
  }

  /** Cierra la sesion actual: revoca la sesion persistida y borra las cookies. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.logoutSuccess)
  @ApiCookieAuth('conit_at')
  @ApiOperation({
    summary: 'Cerrar sesion',
    description:
      'Revoca la sesion en base de datos y elimina las cookies. Las sesiones ' +
      'abiertas en otros dispositivos no se ven afectadas.',
  })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Sesion inexistente o expirada.')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.logout(user.sessionId);
    this.cookieService.clear(response);

    return null;
  }

  /** Escribe las cookies de sesion y devuelve la carga util publica. */
  private applySession(response: Response, issued: IssuedSession): LoginResponse {
    this.cookieService.setAccessToken(response, issued.accessToken, issued.accessMaxAge);
    this.cookieService.setRefreshToken(response, issued.refreshToken, issued.refreshMaxAge);

    return { user: issued.user, expiresIn: issued.expiresIn };
  }

  /** Procedencia de la peticion, almacenada junto a la sesion para auditoria. */
  private metadataFrom(request: Request): SessionMetadata {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }
}
