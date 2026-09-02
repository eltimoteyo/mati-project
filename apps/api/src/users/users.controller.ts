import type { PaginatedData, PublicUser, UserRef } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { UserRefDto } from '../tickets/dto/ticket-response.dto';
import { AvatarService, MAX_AVATAR_BYTES, type UploadedImage } from './avatar.service';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/manage-user.dto';
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
    private readonly avatarService: AvatarService,
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

  /* ---------------------------------------------------------------------------
   * Foto de perfil
   * ------------------------------------------------------------------------ */

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Foto de perfil actualizada correctamente')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Subir la foto de perfil',
    description: 'Admite PNG, JPG y WEBP de hasta 2 MB. Sustituye a la anterior.',
  })
  @ApiEnvelopeResponse(UserResponseDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'El fichero no es una imagen valida o pesa demasiado.')
  // El fichero se recibe en memoria y no en disco: se valida su contenido
  // antes de escribirlo, de modo que nada invalido llega a tocar el sistema
  // de ficheros.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<PublicUser> {
    if (!file) {
      throw new BadRequestException('No se recibio ninguna imagen.');
    }

    await this.avatarService.replace(userId, file);

    return this.usersService.getProfile(userId);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Foto de perfil eliminada correctamente')
  @ApiOperation({ summary: 'Quitar la foto de perfil' })
  @ApiEnvelopeResponse(UserResponseDto)
  async removeAvatar(@CurrentUser('id') userId: string): Promise<PublicUser> {
    await this.avatarService.remove(userId);

    return this.usersService.getProfile(userId);
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

  /* ---------------------------------------------------------------------------
   * Gestion del equipo
   * ------------------------------------------------------------------------ */

  @Get()
  @Roles(USER_ROLES.ADMIN)
  @ResponseMessage('Usuarios obtenidos correctamente')
  @ApiOperation({
    summary: 'Listar usuarios',
    description: 'Listado paginado con busqueda por nombre y correo.',
  })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(@Query() query: UserQueryDto): Promise<PaginatedData<PublicUser>> {
    return this.usersService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(USER_ROLES.ADMIN)
  @ResponseMessage('Usuario creado correctamente')
  @ApiOperation({
    summary: 'Dar de alta a un usuario',
    description:
      'La contrasena inicial la fija quien crea la cuenta y no se devuelve en la respuesta.',
  })
  @ApiEnvelopeResponse(UserResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe un usuario con ese correo.')
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(USER_ROLES.ADMIN)
  @ResponseMessage('Usuario actualizado correctamente')
  @ApiOperation({
    summary: 'Actualizar a un usuario',
    description:
      'Desactivar o cambiar de rol revoca las sesiones abiertas del usuario en el acto.',
  })
  @ApiEnvelopeResponse(UserResponseDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'No puedes alterar tu propia cuenta desde aqui.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El usuario no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Es el ultimo administrador activo.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
  ): Promise<PublicUser> {
    return this.usersService.update(id, dto, actorId);
  }

  @Post(':id/password')
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLES.ADMIN)
  @ResponseMessage('Contrasena restablecida correctamente')
  @ApiOperation({
    summary: 'Restablecer la contrasena de un usuario',
    description: 'Cierra todas sus sesiones abiertas; tendra que entrar de nuevo.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El usuario no existe.')
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<null> {
    await this.usersService.resetPassword(id, dto.password);

    return null;
  }
}
