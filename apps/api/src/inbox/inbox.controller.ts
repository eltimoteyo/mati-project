import type {
  AiTicketDraft,
  InboxConversation,
  InboxConversationDetail,
  InboxMessage,
  PaginatedData,
  TicketDetail,
} from '@conit/types';
import { USER_ROLES, WHATSAPP_AI_HANDOFF_HOURS } from '@conit/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AiTicketDraftDto } from '../ai/dto/ai.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import { TicketDetailResponseDto } from '../tickets/dto/ticket-response.dto';
import {
  InboxAiPauseDto,
  InboxConversationDetailResponseDto,
  InboxConversationResponseDto,
  InboxMessageResponseDto,
  InboxQueryDto,
  InboxReplyDto,
} from './dto/inbox.dto';
import { InboxService } from './inbox.service';

/**
 * Bandeja de WhatsApp para el equipo.
 *
 * Las conversaciones las crea el webhook de Meta; desde aqui se leen, se
 * responden y, cuando hace falta, se convierten en ticket.
 */
@ApiTags('Inbox')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('inbox/conversations')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ResponseMessage('Conversaciones obtenidas correctamente')
  @ApiOperation({
    summary: 'Listar conversaciones',
    description:
      'Ordenadas por actividad reciente. La busqueda cubre el numero, el nombre del perfil ' +
      'de WhatsApp y el nombre del cliente.',
  })
  @ApiPaginatedResponse(InboxConversationResponseDto)
  findAll(@Query() query: InboxQueryDto): Promise<PaginatedData<InboxConversation>> {
    return this.inboxService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Conversacion obtenida correctamente')
  @ApiOperation({
    summary: 'Abrir una conversacion',
    description: 'Mensajes recientes en orden cronologico y tickets creados desde ella.',
  })
  @ApiEnvelopeResponse(InboxConversationDetailResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La conversacion no existe.')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<InboxConversationDetail> {
    return this.inboxService.findOne(id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Conversacion marcada como leida')
  @ApiOperation({ summary: 'Marcar como leida' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La conversacion no existe.')
  async markRead(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.inboxService.markRead(id);

    return null;
  }

  @Post(':id/ai')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Respuesta automatica actualizada')
  @ApiOperation({
    summary: 'Pausar o reanudar la IA en la conversacion',
    description: `Pausar la aparta ${WHATSAPP_AI_HANDOFF_HOURS} horas; reanudar la reactiva al momento.`,
  })
  @ApiEnvelopeResponse(InboxConversationDetailResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La conversacion no existe.')
  setAiPaused(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InboxAiPauseDto,
  ): Promise<InboxConversationDetail> {
    return this.inboxService.setAiPaused(id, dto.paused);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Mensaje enviado por WhatsApp')
  @ApiOperation({
    summary: 'Responder por WhatsApp',
    description:
      'Solo dentro de las 24 horas siguientes al ultimo mensaje del contacto: fuera de esa ' +
      'ventana Meta no entrega texto libre.',
  })
  @ApiEnvelopeResponse(InboxMessageResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'La ventana de 24 horas esta cerrada.')
  @ApiErrorResponse(HttpStatus.BAD_GATEWAY, 'Meta no acepto el mensaje.')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InboxReplyDto,
    @CurrentUser('id') authorId: string,
  ): Promise<InboxMessage> {
    return this.inboxService.reply(id, dto, authorId);
  }

  @Post(':id/tickets')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Ticket creado desde la conversacion')
  @ApiOperation({
    summary: 'Crear un ticket desde la conversacion',
    description:
      'Mismo alta que el modulo de tickets, enlazada a la conversacion. Si el numero era ' +
      'desconocido, queda asociado al cliente elegido.',
  })
  @ApiEnvelopeResponse(TicketDetailResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La conversacion o alguna entidad referenciada no existe.')
  createTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketDto,
    @CurrentUser('id') actorId: string,
  ): Promise<TicketDetail> {
    return this.inboxService.createTicket(id, dto, actorId);
  }

  @Post(':id/ticket-draft')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Borrador de ticket generado')
  @ApiOperation({
    summary: 'Proponer un ticket con IA',
    description:
      'Analiza lo escrito desde el ultimo ticket de la conversacion y propone asunto, ' +
      'descripcion, prioridad y categoria. No crea nada.',
  })
  @ApiEnvelopeResponse(AiTicketDraftDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'El contacto no ha escrito nada que analizar.')
  @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, 'El asistente no esta disponible.')
  draftTicket(@Param('id', ParseUUIDPipe) id: string): Promise<AiTicketDraft> {
    return this.inboxService.draftTicket(id);
  }
}
