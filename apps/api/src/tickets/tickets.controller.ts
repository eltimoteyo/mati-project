import type { PaginatedData, Ticket, TicketDetail } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { TicketDetailResponseDto, TicketResponseDto } from './dto/ticket-response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

/** Documenta el parametro que acepta UUID o codigo visible. */
const ID_OR_CODE = {
  name: 'idOrCode',
  description: 'UUID del ticket o su codigo visible (por ejemplo `CNT-0042`).',
  example: 'CNT-0042',
};

@ApiTags('Tickets')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ResponseMessage('Tickets obtenidos correctamente')
  @ApiOperation({
    summary: 'Listar tickets',
    description:
      'Listado paginado con filtros por estado, prioridad, cliente, servicio, categoria y ' +
      'responsable. La busqueda cubre asunto, descripcion y codigo.',
  })
  @ApiPaginatedResponse(TicketResponseDto)
  findAll(@Query() query: TicketQueryDto): Promise<PaginatedData<Ticket>> {
    return this.ticketsService.findAll(query);
  }

  @Get(':idOrCode')
  @ResponseMessage('Ticket obtenido correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({
    summary: 'Obtener un ticket con su historial',
    description: 'Devuelve el ticket y la traza completa de cambios, del mas reciente al mas antiguo.',
  })
  @ApiEnvelopeResponse(TicketDetailResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  findOne(@Param('idOrCode') idOrCode: string): Promise<TicketDetail> {
    return this.ticketsService.findOne(idOrCode);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Ticket creado correctamente')
  @ApiOperation({
    summary: 'Registrar un ticket',
    description: 'El correlativo y el codigo visible los asigna el servidor.',
  })
  @ApiEnvelopeResponse(TicketDetailResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Datos invalidos o relaciones incoherentes.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Alguna entidad referenciada no existe.')
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser('id') actorId: string,
  ): Promise<TicketDetail> {
    return this.ticketsService.create(dto, actorId);
  }

  @Patch(':idOrCode')
  @ResponseMessage('Ticket actualizado correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({
    summary: 'Actualizar un ticket',
    description:
      'Cada cambio queda registrado en el historial. Los cambios de estado deben respetar ' +
      'las transiciones permitidas.',
  })
  @ApiEnvelopeResponse(TicketDetailResponseDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Transicion de estado no permitida o datos invalidos.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  update(
    @Param('idOrCode') idOrCode: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser('id') actorId: string,
  ): Promise<TicketDetail> {
    return this.ticketsService.update(idOrCode, dto, actorId);
  }

  @Delete(':idOrCode')
  @ResponseMessage('Ticket eliminado correctamente')
  @ApiParam(ID_OR_CODE)
  @ApiOperation({
    summary: 'Eliminar un ticket',
    description: 'Solo permitido mientras sigue en estado "Nuevo".',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'El ticket ya fue atendido; cierralo en lugar de borrarlo.')
  async remove(@Param('idOrCode') idOrCode: string): Promise<null> {
    await this.ticketsService.remove(idOrCode);

    return null;
  }
}
