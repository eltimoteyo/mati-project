import type { PaginatedData, ProjectRef, ProjectWithClient } from '@conit/types';
import { SERVICE_TYPES, type ServiceType,USER_ROLES } from '@conit/types';
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
import {
  ApiCookieAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

/** Referencia usada por los selectores de formulario. */
export class ProjectRefDto implements ProjectRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Portal institucional' })
  name!: string;

  @ApiProperty({ enum: Object.values(SERVICE_TYPES) })
  type!: ServiceType;

  @ApiPropertyOptional({ nullable: true, example: 'https://cliente.com' })
  url!: string | null;
}

@ApiTags('Projects')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ResponseMessage('Servicios obtenidos correctamente')
  @ApiOperation({
    summary: 'Listar proyectos y servicios',
    description: 'Listado paginado con filtros por cliente, tipo, estado y proximidad de vencimiento.',
  })
  @ApiPaginatedResponse(ProjectResponseDto)
  findAll(@Query() query: ProjectQueryDto): Promise<PaginatedData<ProjectWithClient>> {
    return this.projectsService.findAll(query);
  }

  @Get('options/:clientId')
  @ResponseMessage('Opciones obtenidas correctamente')
  @ApiOperation({
    summary: 'Servicios activos de un cliente',
    description:
      'Lista ligera para el selector del formulario de ticket. Se filtra por cliente porque ' +
      'una incidencia solo puede referirse a un servicio del propio cliente.',
  })
  @ApiEnvelopeResponse(ProjectRefDto)
  findOptions(@Param('clientId', ParseUUIDPipe) clientId: string): Promise<ProjectRef[]> {
    return this.projectsService.findOptionsByClient(clientId);
  }

  @Get(':id')
  @ResponseMessage('Servicio obtenido correctamente')
  @ApiOperation({ summary: 'Obtener un servicio' })
  @ApiEnvelopeResponse(ProjectResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El servicio no existe.')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectWithClient> {
    return this.projectsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Servicio creado correctamente')
  @ApiOperation({ summary: 'Registrar un proyecto o servicio' })
  @ApiEnvelopeResponse(ProjectResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El cliente indicado no existe.')
  create(@Body() dto: CreateProjectDto): Promise<ProjectWithClient> {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Servicio actualizado correctamente')
  @ApiOperation({ summary: 'Actualizar un servicio' })
  @ApiEnvelopeResponse(ProjectResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El servicio no existe.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectWithClient> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Servicio eliminado correctamente')
  @ApiOperation({
    summary: 'Eliminar un servicio',
    description: 'Solo si no tiene tickets asociados; en caso contrario, archivalo.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El servicio no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'El servicio tiene tickets asociados.')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.projectsService.remove(id);

    return null;
  }
}
