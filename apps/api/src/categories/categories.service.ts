import type { CategoryWithCounts, PaginatedData } from '@conit/types';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import {
  paginate,
  type PaginationQueryDto,
  searchFilter,
  toSkipTake,
} from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/slug.util';
import { PrismaService } from '../database/prisma.service';
import { toCategoryWithCounts } from './categories.mapper';
import type { CategoryQueryDto } from './dto/category-query.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

/** Incluye siempre el recuento de tickets: el listado lo muestra en columna. */
const WITH_COUNTS = { _count: { select: { tickets: true } } } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CategoryQueryDto): Promise<PaginatedData<CategoryWithCounts>> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...searchFilter(query.search, ['name', 'description']),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: WITH_COUNTS,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginate(items.map(toCategoryWithCounts), total, query as PaginationQueryDto);
  }

  async findOne(id: string): Promise<CategoryWithCounts> {
    const category = await this.prisma.category.findUnique({ where: { id }, include: WITH_COUNTS });

    if (!category) {
      throw new NotFoundException('La categoria no existe');
    }

    return toCategoryWithCounts(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryWithCounts> {
    const slug = slugify(dto.name);

    await this.assertNameAvailable(dto.name, slug);

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        ...(dto.color ? { color: dto.color } : {}),
        responseTimeMinutes: dto.responseTimeMinutes ?? null,
        resolutionTimeMinutes: dto.resolutionTimeMinutes ?? null,
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: WITH_COUNTS,
    });

    return toCategoryWithCounts(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryWithCounts> {
    await this.findOne(id);

    // El slug acompana al nombre: si cambia uno, cambia el otro.
    const slug = dto.name ? slugify(dto.name) : undefined;

    if (dto.name && slug) {
      await this.assertNameAvailable(dto.name, slug, id);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name, slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.color ? { color: dto.color } : {}),
        ...(dto.responseTimeMinutes !== undefined
          ? { responseTimeMinutes: dto.responseTimeMinutes }
          : {}),
        ...(dto.resolutionTimeMinutes !== undefined
          ? { resolutionTimeMinutes: dto.resolutionTimeMinutes }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: WITH_COUNTS,
    });

    return toCategoryWithCounts(category);
  }

  /**
   * Elimina la categoria.
   *
   * Se bloquea si tiene tickets: aunque la relacion es `SetNull` y borrarla no
   * romperia nada, los tickets perderian su clasificacion en silencio. Para
   * retirarla de circulacion conservando el historial esta el estado INACTIVE.
   */
  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    if (category.counts.tickets > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${category.counts.tickets} ticket(s) en esta categoria. ` +
          'Cambia su estado a inactiva para dejar de usarla.',
      );
    }

    await this.prisma.category.delete({ where: { id } });
  }

  /** El nombre y el slug son unicos; se comprueba antes para dar un 409 claro. */
  private async assertNameAvailable(name: string, slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ya existe una categoria con ese nombre');
    }
  }
}
