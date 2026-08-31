import type { PaginatedData, ProjectRef, ProjectWithClient } from '@conit/types';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import {
  paginate,
  type PaginationQueryDto,
  searchFilter,
  toSkipTake,
} from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ProjectQueryDto } from './dto/project-query.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import { toProjectRef, toProjectWithClient } from './projects.mapper';

const WITH_RELATIONS = {
  client: { select: { id: true, name: true } },
  _count: { select: { tickets: true } },
} as const;

/** Ventana del filtro "proximos a vencer". */
const EXPIRING_SOON_DAYS = 30;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProjectQueryDto): Promise<PaginatedData<ProjectWithClient>> {
    const where = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.expiringSoon ? { expiresAt: this.expiringSoonRange() } : {}),
      ...searchFilter(query.search, ['name', 'url', 'description']),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: WITH_RELATIONS,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.project.count({ where }),
    ]);

    return paginate(items.map(toProjectWithClient), total, query as PaginationQueryDto);
  }

  /**
   * Servicios activos de un cliente, para el selector del formulario de ticket.
   * Requiere el cliente porque un ticket solo puede referirse a un servicio
   * de su propio cliente.
   */
  async findOptionsByClient(clientId: string): Promise<ProjectRef[]> {
    const projects = await this.prisma.project.findMany({
      where: { clientId, status: 'ACTIVE' },
      select: { id: true, name: true, type: true, url: true },
      orderBy: { name: 'asc' },
    });

    return projects.map((project) => toProjectRef(project)!);
  }

  async findOne(id: string): Promise<ProjectWithClient> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });

    if (!project) {
      throw new NotFoundException('El servicio no existe');
    }

    return toProjectWithClient(project);
  }

  async create(dto: CreateProjectDto): Promise<ProjectWithClient> {
    await this.assertClientExists(dto.clientId);
    this.assertDateOrder(dto.startedAt ?? null, dto.expiresAt ?? null);

    const project = await this.prisma.project.create({
      data: {
        clientId: dto.clientId,
        name: dto.name,
        type: dto.type,
        description: dto.description ?? null,
        url: dto.url ?? null,
        ...(dto.status ? { status: dto.status } : {}),
        startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: WITH_RELATIONS,
    });

    return toProjectWithClient(project);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectWithClient> {
    const current = await this.findOne(id);

    // Las fechas se validan contra el estado resultante, no solo contra lo
    // enviado: cambiar solo una de las dos tambien puede invertir el orden.
    this.assertDateOrder(
      dto.startedAt !== undefined ? dto.startedAt : current.startedAt,
      dto.expiresAt !== undefined ? dto.expiresAt : current.expiresAt,
    );

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.startedAt !== undefined
          ? { startedAt: dto.startedAt ? new Date(dto.startedAt) : null }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
      include: WITH_RELATIONS,
    });

    return toProjectWithClient(project);
  }

  /**
   * Elimina el servicio.
   *
   * La relacion con tickets es `SetNull`, asi que borrarlo no rompe nada, pero
   * los tickets perderian la referencia al servicio afectado. Para retirarlo
   * conservando esa informacion esta el estado ARCHIVED.
   */
  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);

    if (project.counts.tickets > 0) {
      throw new ConflictException(
        `No se puede eliminar: el servicio tiene ${project.counts.tickets} ticket(s) asociados. ` +
          'Archivalo para dejar de usarlo sin perder el historial.',
      );
    }

    await this.prisma.project.delete({ where: { id } });
  }

  private expiringSoonRange(): { gte: Date; lte: Date } {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + EXPIRING_SOON_DAYS);

    return { gte: now, lte: limit };
  }

  private async assertClientExists(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('El cliente indicado no existe');
    }
  }

  private assertDateOrder(startedAt: string | null, expiresAt: string | null): void {
    if (startedAt && expiresAt && new Date(startedAt) > new Date(expiresAt)) {
      throw new BadRequestException(
        'La fecha de vencimiento no puede ser anterior a la de inicio.',
      );
    }
  }
}
