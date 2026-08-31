import type { PublicUser, UserRef } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse, ApiErrorResponse } from '../common/dto/api-response.dto';
import { UserRefDto } from '../tickets/dto/ticket-response.dto';
import { type SupportTeamResponse,SupportTeamResponseDto } from './dto/support-team.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { SupportTeamService } from './support-team.service';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth('conit_at')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly supportTeamService: SupportTeamService,
  ) {}

  /**
   * Perfil del usuario autenticado.
   * El frontend lo usa como fuente de verdad de la sesion activa.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Perfil obtenido correctamente')
  @ApiOperation({
    summary: 'Perfil del usuario autenticado',
    description: 'Devuelve los datos del usuario asociado al access token de la peticion.',
  })
  @ApiEnvelopeResponse(UserResponseDto, { description: 'Perfil del usuario.' })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Sesion inexistente o expirada.')
  getProfile(@CurrentUser('id') userId: string): Promise<PublicUser> {
    return this.usersService.getProfile(userId);
  }

  /** Edicion del perfil propio. */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Perfil actualizado correctamente')
  @ApiOperation({
    summary: 'Actualizar el perfil propio',
    description: 'El correo y el rol no se editan desde aqui: no son datos de perfil.',
  })
  @ApiEnvelopeResponse(UserResponseDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Datos invalidos.')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return this.usersService.updateProfile(userId, dto.name);
  }

  /**
   * Responsables asignables a un ticket.
   * Se declara despues de `me` porque ambas son rutas literales sin conflicto,
   * pero antes de cualquier parametro dinamico que se anada en el futuro.
   */
  @Get('options')
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLES.ADMIN)
  @ResponseMessage('Opciones obtenidas correctamente')
  @ApiOperation({
    summary: 'Usuarios asignables a un ticket',
    description: 'Administradores activos, que en esta fase son el equipo de soporte.',
  })
  @ApiEnvelopeResponse(UserRefDto, { description: 'Lista de responsables.' })
  findAssignableOptions(): Promise<UserRef[]> {
    return this.usersService.findAssignableOptions();
  }

  /** Equipo de soporte con su carga de trabajo. */
  @Get('team')
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLES.ADMIN)
  @ResponseMessage('Equipo obtenido correctamente')
  @ApiOperation({
    summary: 'Equipo de soporte y su carga',
    description:
      'Administradores con sus tickets abiertos, criticos, resueltos en los ultimos 30 dias ' +
      'y el total historico. Incluye cuantos tickets abiertos siguen sin responsable.',
  })
  @ApiEnvelopeResponse(SupportTeamResponseDto)
  async findTeam(): Promise<SupportTeamResponse> {
    const [agents, unassigned] = await Promise.all([
      this.supportTeamService.findTeam(),
      this.supportTeamService.countUnassigned(),
    ]);

    return { agents, unassigned };
  }
}
