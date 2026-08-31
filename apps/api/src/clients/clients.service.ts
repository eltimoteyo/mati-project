import { type ClientRef, type ClientWithCounts, OPEN_TICKET_STATUSES, type PaginatedData } from '@conit/types';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import {
  paginate,
  type PaginationQueryDto,
  searchFilter,
  toSkipTake,
} from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { CLIENT_COUNTS_SELECT, toClientRef, toClientWithCounts } from './clients.mapper';
import type { ClientQueryDto } from './dto/client-query.dto';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ClientQueryDto): Promise<PaginatedData<ClientWithCounts>> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...searchFilter(query.search, ['name', 'email', 'contactName', 'taxId']),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: CLIENT_COUNTS_SELECT,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.client.count({ where }),
    ]);

    const openCounts = await this.openTicketCounts(items.map((client) => client.id));

    return paginate(
      items.map((client) => toClientWithCounts(client, openCounts.get(client.id) ?? 0)),
      total,
      query as PaginationQueryDto,
    );
  }

  /**
   * Tickets abiertos por cliente.
   *
   * Va en una consulta aparte porque `_count` de Prisma no admite alias: no se
   * pueden pedir dos recuentos de la misma relacion con filtros distintos. Una
   * sola agregacion cubre toda la pagina, asi que no hay consultas N+1.
   */
  private async openTicketCounts(clientIds: string[]): Promise<Map<string, number>> {
    if (clientIds.length === 0) return new Map();

    const rows = await this.prisma.ticket.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds }, status: { in: OPEN_TICKET_STATUSES } },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.clientId, row._count._all]));
  }

  /**
   * Listado ligero para los selectores de formulario.
   * Devuelve solo clientes activos: no tiene sentido registrar una incidencia
   * nueva a nombre de un cliente dado de baja.
   */
  async findOptions(): Promise<ClientRef[]> {
    const clients = await this.prisma.client.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return clients.map(toClientRef);
  }

  async findOne(id: string): Promise<ClientWithCounts> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: CLIENT_COUNTS_SELECT,
    });

    if (!client) {
      throw new NotFoundException('El cliente no existe');
    }

    const openCounts = await this.openTicketCounts([client.id]);

    return toClientWithCounts(client, openCounts.get(client.id) ?? 0);
  }

  async create(dto: CreateClientDto): Promise<ClientWithCounts> {
    await this.assertTaxIdAvailable(dto.taxId ?? null);

    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        email: dto.email,
        taxId: dto.taxId ?? null,
        contactName: dto.contactName ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        notes: dto.notes ?? null,
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: CLIENT_COUNTS_SELECT,
    });

    return toClientWithCounts(client);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientWithCounts> {
    await this.findOne(id);

    if (dto.taxId) {
      await this.assertTaxIdAvailable(dto.taxId, id);
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: CLIENT_COUNTS_SELECT,
    });

    const openCounts = await this.openTicketCounts([client.id]);

    return toClientWithCounts(client, openCounts.get(client.id) ?? 0);
  }

  /**
   * Elimina el cliente.
   *
   * Se bloquea si tiene tickets: su historial de soporte es justamente el
   * valor del sistema. Para retirarlo de circulacion esta el estado INACTIVE,
   * que lo saca de los selectores sin borrar nada.
   */
  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);

    if (client.counts.tickets > 0) {
      throw new ConflictException(
        `No se puede eliminar: el cliente tiene ${client.counts.tickets} ticket(s) registrados. ` +
          'Cambia su estado a inactivo para dejar de usarlo.',
      );
    }

    // Sus proyectos se eliminan en cascada; sin tickets, no hay historial que perder.
    await this.prisma.client.delete({ where: { id } });
  }

  private async assertTaxIdAvailable(taxId: string | null, excludeId?: string): Promise<void> {
    if (!taxId) return;

    const existing = await this.prisma.client.findFirst({
      where: { taxId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ya existe un cliente con ese identificador fiscal');
    }
  }
}
