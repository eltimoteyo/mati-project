import type {
  PaginatedData,
  PortalProfile,
  PortalTicket,
  PortalTicketDetail,
} from '@conit/types';
import { USER_ROLES } from '@conit/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreatePortalMessageDto, CreatePortalTicketDto } from './dto/portal.dto';
import { PortalTicketQueryDto } from './dto/portal-query.dto';
import {
  PortalProfileDto,
  PortalTicketDetailDto,
  PortalTicketDto,
} from './dto/portal-response.dto';
import { PortalService } from './portal.service';

/**
 * Portal del cliente.
 *
 * Reservado al rol CLIENT. El personal de CONIT usa el panel: dejar entrar
 * tambien a ADMIN obligaria a decidir "que ficha de cliente es la suya", que
 * no tiene respuesta.
 *
 * Ninguna ruta acepta un identificador de cliente. El ambito sale siempre de
 * la sesion, de modo que no existe forma de pedir lo de otro.
 */
@ApiTags('Portal')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.CLIENT)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('profile')
  @ResponseMessage('Perfil obtenido correctamente')
  @ApiOperation({
    summary: 'Mi perfil',
    description: 'Datos de la cuenta, ficha de cliente, servicios contratados y recuentos.',
  })
  @ApiEnvelopeResponse(PortalProfileDto)
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'El usuario no esta vinculado a un cliente.')
  getProfile(@CurrentUser('id') userId: string): Promise<PortalProfile> {
    return this.portalService.getProfile(userId);
  }

  @Get('tickets')
  @ResponseMessage('Incidencias obtenidas correctamente')
  @ApiOperation({ summary: 'Mis incidencias' })
  @ApiPaginatedResponse(PortalTicketDto)
  findTickets(
    @CurrentUser('id') userId: string,
    @Query() query: PortalTicketQueryDto,
  ): Promise<PaginatedData<PortalTicket>> {
    return this.portalService.findTickets(userId, query);
  }

  @Get('tickets/:idOrCode')
  @ResponseMessage('Incidencia obtenida correctamente')
  @ApiOperation({
    summary: 'Detalle y seguimiento de una incidencia',
    description:
      'Incluye la conversacion visible y los cambios de estado. Las notas internas no se devuelven.',
  })
  @ApiEnvelopeResponse(PortalTicketDetailDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La incidencia no existe.')
  findTicket(
    @CurrentUser('id') userId: string,
    @Param('idOrCode') idOrCode: string,
  ): Promise<PortalTicketDetail> {
    return this.portalService.findTicket(userId, idOrCode);
  }

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Incidencia registrada correctamente')
  @ApiOperation({ summary: 'Registrar una incidencia' })
  @ApiEnvelopeResponse(PortalTicketDetailDto, { status: HttpStatus.CREATED })
  createTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePortalTicketDto,
  ): Promise<PortalTicketDetail> {
    return this.portalService.createTicket(userId, dto);
  }

  @Post('tickets/:idOrCode/messages')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Mensaje enviado correctamente')
  @ApiOperation({
    summary: 'Escribir en la conversacion',
    description: 'Si la incidencia estaba resuelta, el mensaje la reabre.',
  })
  @ApiEnvelopeResponse(PortalTicketDetailDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La incidencia no existe.')
  addMessage(
    @CurrentUser('id') userId: string,
    @Param('idOrCode') idOrCode: string,
    @Body() dto: CreatePortalMessageDto,
  ): Promise<PortalTicketDetail> {
    return this.portalService.addMessage(userId, idOrCode, dto);
  }
}
