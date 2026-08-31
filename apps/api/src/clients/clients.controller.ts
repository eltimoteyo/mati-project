import type { ClientRef, ClientWithCounts, PaginatedData } from '@conit/types';
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
import { ApiCookieAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { ClientsService } from './clients.service';
import { ClientQueryDto } from './dto/client-query.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

/** Referencia usada por los selectores de formulario. */
export class ClientRefDto implements ClientRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Distribuidora Andina S.A.C.' })
  name!: string;
}

@ApiTags('Clients')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ResponseMessage('Clientes obtenidos correctamente')
  @ApiOperation({
    summary: 'Listar clientes',
    description: 'Listado paginado con busqueda por nombre, correo, contacto e identificador fiscal.',
  })
  @ApiPaginatedResponse(ClientResponseDto)
  findAll(@Query() query: ClientQueryDto): Promise<PaginatedData<ClientWithCounts>> {
    return this.clientsService.findAll(query);
  }

  /**
   * Se declara antes que `:id` a proposito: de lo contrario Nest interpretaria
   * "options" como un UUID y `ParseUUIDPipe` devolveria 400.
   */
  @Get('options')
  @ResponseMessage('Opciones obtenidas correctamente')
  @ApiOperation({
    summary: 'Clientes activos para selectores',
    description: 'Lista ligera (id y nombre) de clientes activos, para formularios y filtros.',
  })
  @ApiEnvelopeResponse(ClientRefDto)
  findOptions(): Promise<ClientRef[]> {
    return this.clientsService.findOptions();
  }

  @Get(':id')
  @ResponseMessage('Cliente obtenido correctamente')
  @ApiOperation({ summary: 'Obtener un cliente' })
  @ApiEnvelopeResponse(ClientResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El cliente no existe.')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClientWithCounts> {
    return this.clientsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Cliente creado correctamente')
  @ApiOperation({ summary: 'Crear un cliente' })
  @ApiEnvelopeResponse(ClientResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe un cliente con ese identificador fiscal.')
  create(@Body() dto: CreateClientDto): Promise<ClientWithCounts> {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Cliente actualizado correctamente')
  @ApiOperation({ summary: 'Actualizar un cliente' })
  @ApiEnvelopeResponse(ClientResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El cliente no existe.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientWithCounts> {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Cliente eliminado correctamente')
  @ApiOperation({
    summary: 'Eliminar un cliente',
    description: 'Solo si no tiene tickets registrados; en caso contrario, desactivalo.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El cliente no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'El cliente tiene tickets registrados.')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.clientsService.remove(id);

    return null;
  }
}
