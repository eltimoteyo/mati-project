import type {
  Notification,
  NotificationCount,
  NotificationPreference,
  PaginatedData,
} from '@conit/types';
import { USER_ROLES } from '@conit/types';
import {
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
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationCountDto,
  NotificationPreferenceDto,
  NotificationResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

/**
 * Avisos del usuario autenticado.
 *
 * Ninguna ruta admite un identificador de usuario: siempre se opera sobre
 * quien hace la peticion, de modo que no existe forma de leer ni marcar los
 * avisos de otra persona.
 */
@ApiTags('Notifications')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ResponseMessage('Notificaciones obtenidas correctamente')
  @ApiOperation({ summary: 'Listar mis notificaciones' })
  @ApiPaginatedResponse(NotificationResponseDto)
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationQueryDto,
  ): Promise<PaginatedData<Notification>> {
    return this.notificationsService.findAll(userId, query);
  }

  @Get('count')
  @ResponseMessage('Recuento obtenido correctamente')
  @ApiOperation({
    summary: 'Numero de notificaciones sin leer',
    description: 'Alimenta el indicador de la campana; se consulta con frecuencia.',
  })
  @ApiEnvelopeResponse(NotificationCountDto)
  countUnread(@CurrentUser('id') userId: string): Promise<NotificationCount> {
    return this.notificationsService.countUnread(userId);
  }

  @Get('preferences')
  @ResponseMessage('Preferencias obtenidas correctamente')
  @ApiOperation({ summary: 'Mis preferencias de aviso' })
  @ApiEnvelopeResponse(NotificationPreferenceDto, { isArray: true })
  getPreferences(@CurrentUser('id') userId: string): Promise<NotificationPreference[]> {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  @ResponseMessage('Preferencia actualizada correctamente')
  @ApiOperation({ summary: 'Activar o desactivar un tipo de aviso' })
  @ApiEnvelopeResponse(NotificationPreferenceDto, { isArray: true })
  setPreference(
    @CurrentUser('id') userId: string,
    @Body() dto: NotificationPreferenceDto,
  ): Promise<NotificationPreference[]> {
    return this.notificationsService.setPreference(userId, dto.type, dto.enabled);
  }

  @Post('read-all')
  // No crea nada: marca lo existente. El 201 por defecto de `@Post` seria
  // enganoso para quien consuma la API.
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Notificaciones marcadas como leidas')
  @ApiOperation({ summary: 'Marcar todas como leidas' })
  @ApiEnvelopeResponse(NotificationCountDto)
  markAllRead(@CurrentUser('id') userId: string): Promise<NotificationCount> {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  @ResponseMessage('Notificacion marcada como leida')
  @ApiOperation({ summary: 'Marcar una notificacion como leida' })
  @ApiEnvelopeResponse(NotificationResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La notificacion no existe.')
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Notification> {
    return this.notificationsService.markRead(userId, id);
  }

  @Delete(':id')
  @ResponseMessage('Notificacion eliminada correctamente')
  @ApiOperation({ summary: 'Descartar una notificacion' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La notificacion no existe.')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.notificationsService.remove(userId, id);

    return null;
  }
}
