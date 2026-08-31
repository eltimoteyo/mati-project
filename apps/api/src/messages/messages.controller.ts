import type { Message } from '@conit/types';
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
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse, ApiErrorResponse } from '../common/dto/api-response.dto';
import { CreateMessageDto, MessageResponseDto, UpdateMessageDto } from './dto/message.dto';
import { MessagesService } from './messages.service';

const ID_OR_CODE = {
  name: 'idOrCode',
  description: 'UUID del ticket o su codigo visible (por ejemplo `CNT-0042`).',
  example: 'CNT-0042',
};

/**
 * Conversacion de un ticket.
 *
 * Las rutas cuelgan del ticket porque un mensaje no existe por si solo: su
 * contexto es siempre la incidencia a la que pertenece.
 */
@ApiTags('Conversations')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('tickets/:idOrCode/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ResponseMessage('Conversacion obtenida correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({
    summary: 'Listar la conversacion',
    description: 'Mensajes del ticket en orden cronologico, publicos e internos.',
  })
  @ApiEnvelopeResponse(MessageResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  findAll(@Param('idOrCode') idOrCode: string): Promise<Message[]> {
    return this.messagesService.findAll(idOrCode);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Mensaje enviado correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({
    summary: 'Enviar un mensaje',
    description:
      'Un mensaje `PUBLIC` cuenta como primera respuesta de soporte si aun no habia ninguna; ' +
      'una nota `INTERNAL` no, porque el cliente no la ve.',
  })
  @ApiEnvelopeResponse(MessageResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  create(
    @Param('idOrCode') idOrCode: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser('id') authorId: string,
  ): Promise<Message> {
    return this.messagesService.create(idOrCode, dto, authorId);
  }

  @Patch(':messageId')
  @ResponseMessage('Mensaje actualizado correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({
    summary: 'Editar un mensaje propio',
    description: 'Solo el autor puede editarlo. Queda marcado como editado.',
  })
  @ApiEnvelopeResponse(MessageResponseDto)
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'El mensaje es de otro autor.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El mensaje no existe en este ticket.')
  update(
    @Param('idOrCode') idOrCode: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser('id') actorId: string,
  ): Promise<Message> {
    return this.messagesService.update(idOrCode, messageId, dto, actorId);
  }

  @Delete(':messageId')
  @ResponseMessage('Mensaje eliminado correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({ summary: 'Eliminar un mensaje propio' })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'El mensaje es de otro autor.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El mensaje no existe en este ticket.')
  async remove(
    @Param('idOrCode') idOrCode: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<null> {
    await this.messagesService.remove(idOrCode, messageId, actorId);

    return null;
  }
}
