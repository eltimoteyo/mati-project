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
import { GrantPortalAccessDto } from './dto/portal-access.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { type PortalAccess, PortalAccessService } from './portal-access.service';

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
  constructor(
    private readonly clientsService: ClientsService,
    private readonly portalAccessService: PortalAccessService,
  ) {}

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

  /* ---------------------------------------------------------------------------
   * Acceso al portal
   * ------------------------------------------------------------------------ */

  @Get(':id/portal-access')
  @ResponseMessage('Acceso al portal obtenido correctamente')
  @ApiOperation({
    summary: 'Estado del acceso al portal',
    description: 'Indica si el cliente tiene cuenta para entrar a ver sus incidencias.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El cliente no existe.')
  getPortalAccess(@Param('id', ParseUUIDPipe) id: string): Promise<PortalAccess> {
    return this.portalAccessService.get(id);
  }

  @Post(':id/portal-access')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Acceso al portal concedido correctamente')
  @ApiOperation({
    summary: 'Conceder acceso al portal',
    description:
      'Crea o reactiva la cuenta del cliente con la contrasena indicada. Comunicasela por un canal seguro: no se envia por correo.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El cliente no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe un usuario con ese correo.')
  grantPortalAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantPortalAccessDto,
  ): Promise<PortalAccess> {
    return this.portalAccessService.grant(id, dto.password, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.sendEmail === undefined ? {} : { sendEmail: dto.sendEmail }),
    });
  }

  @Post(':id/portal-access/resend')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Credenciales enviadas correctamente')
  @ApiOperation({
    summary: 'Restablecer y enviar las credenciales',
    description:
      'Genera una contrasena nueva y se la envia al cliente por correo. La anterior deja de funcionar: la actual no se puede reenviar porque solo se guarda su hash.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Este cliente no tiene acceso al portal.')
  resendPortalCredentials(@Param('id', ParseUUIDPipe) id: string): Promise<PortalAccess> {
    return this.portalAccessService.resetAndSend(id);
  }

  @Delete(':id/portal-access')
  @ResponseMessage('Acceso al portal retirado correctamente')
  @ApiOperation({
    summary: 'Retirar el acceso al portal',
    description: 'Desactiva la cuenta y cierra sus sesiones. No borra lo que haya escrito.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Este cliente no tiene acceso al portal.')
  revokePortalAccess(@Param('id', ParseUUIDPipe) id: string): Promise<PortalAccess> {
    return this.portalAccessService.revoke(id);
  }
}
