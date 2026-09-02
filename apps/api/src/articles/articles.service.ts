import type {
  Article,
  ArticleListItem,
  ArticleSummary,
  ArticleTagCount,
  PaginatedData,
} from '@conit/types';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { paginate, type PaginationQueryDto, toSkipTake } from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/slug.util';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
  ARTICLE_LIST_SELECT,
  ARTICLE_RELATIONS,
  toArticle,
  toArticleListItem,
} from './articles.mapper';
import type { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import type { ArticleQueryDto } from './dto/article-query.dto';

/** Etiquetas mostradas en el resumen. */
const TOP_TAGS_LIMIT = 8;

/** Fila de la agregacion de etiquetas. */
interface TagCountRow {
  tag: string;
  count: bigint | number;
}

/**
 * Base de conocimiento.
 *
 * Un articulo se identifica por su `slug` ademas de por su UUID, para que los
 * enlaces compartidos sean legibles y sobrevivan a un cambio de titulo: el
 * slug solo cambia si se edita a proposito.
 */
@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ArticleQueryDto): Promise<PaginatedData<ArticleListItem>> {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        select: ARTICLE_LIST_SELECT,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.article.count({ where }),
    ]);

    return paginate(items.map(toArticleListItem), total, query as PaginationQueryDto);
  }

  /** Acepta el UUID o el slug. */
  async findOne(idOrSlug: string): Promise<Article> {
    const article = await this.prisma.article.findFirst({
      where: this.identityFilter(idOrSlug),
      include: ARTICLE_RELATIONS,
    });

    if (!article) {
      throw new NotFoundException('El articulo no existe');
    }

    return toArticle(article);
  }

  /**
   * Registra una lectura y devuelve el articulo.
   *
   * El incremento es atomico (`increment`, no leer-sumar-escribir) para que
   * dos lecturas simultaneas no se pisen y pierdan una visita.
   */
  async view(idOrSlug: string): Promise<Article> {
    const existing = await this.prisma.article.findFirst({
      where: this.identityFilter(idOrSlug),
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('El articulo no existe');
    }

    const article = await this.prisma.article.update({
      where: { id: existing.id },
      data: { viewsCount: { increment: 1 } },
      include: ARTICLE_RELATIONS,
    });

    return toArticle(article);
  }

  async create(dto: CreateArticleDto, authorId: string): Promise<Article> {
    const slug = await this.resolveSlug(dto.slug, dto.title);

    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        slug,
        summary: dto.summary ?? null,
        content: dto.content,
        categoryId: dto.categoryId ?? null,
        isPublished: dto.isPublished ?? true,
        tags: this.normalizeTags(dto.tags),
        authorId,
      },
      include: ARTICLE_RELATIONS,
    });

    return toArticle(article);
  }

  async update(idOrSlug: string, dto: UpdateArticleDto): Promise<Article> {
    const current = await this.prisma.article.findFirst({
      where: this.identityFilter(idOrSlug),
      select: { id: true, slug: true },
    });

    if (!current) {
      throw new NotFoundException('El articulo no existe');
    }

    // El slug solo se recalcula si llega explicitamente: cambiar el titulo no
    // debe romper los enlaces que ya se hayan compartido.
    const slug =
      dto.slug !== undefined && dto.slug !== ''
        ? await this.resolveSlug(dto.slug, dto.slug, current.id)
        : undefined;

    const article = await this.prisma.article.update({
      where: { id: current.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.tags !== undefined ? { tags: this.normalizeTags(dto.tags) } : {}),
      },
      include: ARTICLE_RELATIONS,
    });

    return toArticle(article);
  }

  async remove(idOrSlug: string): Promise<void> {
    const current = await this.prisma.article.findFirst({
      where: this.identityFilter(idOrSlug),
      select: { id: true },
    });

    if (!current) {
      throw new NotFoundException('El articulo no existe');
    }

    await this.prisma.article.delete({ where: { id: current.id } });
  }

  /**
   * Resumen de la base de conocimiento.
   *
   * Las etiquetas se agregan en SQL porque estan en una columna de array:
   * `unnest` las expande a filas para poder contarlas sin traer los articulos.
   */
  async getSummary(): Promise<ArticleSummary> {
    const [total, published, views, tagRows] = await Promise.all([
      this.prisma.article.count(),
      this.prisma.article.count({ where: { isPublished: true } }),
      this.prisma.article.aggregate({ _sum: { viewsCount: true } }),
      this.prisma.$queryRaw<TagCountRow[]>`
        SELECT tag, COUNT(*) AS count
        FROM articles, unnest(tags) AS tag
        GROUP BY tag
        ORDER BY count DESC, tag ASC
        LIMIT ${TOP_TAGS_LIMIT}
      `,
    ]);

    const topTags: ArticleTagCount[] = tagRows.map((row) => ({
      tag: row.tag,
      count: Number(row.count),
    }));

    return {
      total,
      published,
      drafts: total - published,
      totalViews: views._sum.viewsCount ?? 0,
      topTags,
    };
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /** Un UUID mal formado debe dar 404, no reventar la consulta. */
  private identityFilter(idOrSlug: string): Prisma.ArticleWhereInput {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    return isUuid ? { id: idOrSlug } : { slug: idOrSlug };
  }

  /**
   * Deriva y reserva el slug.
   *
   * Se comprueba la disponibilidad antes de escribir para poder devolver un
   * mensaje util; la restriccion `@unique` sigue siendo la garantia real si dos
   * peticiones simultaneas eligen el mismo.
   */
  private async resolveSlug(
    provided: string | undefined,
    fallback: string,
    excludeId?: string,
  ): Promise<string> {
    const slug = slugify(provided && provided !== '' ? provided : fallback);

    if (!slug) {
      throw new ConflictException('El titulo no produce un identificador valido para la URL');
    }

    const clash = await this.prisma.article.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`Ya existe un articulo con el identificador "${slug}"`);
    }

    return slug;
  }

  /** Minusculas, sin duplicados y sin vacios: las etiquetas se usan para filtrar. */
  private normalizeTags(tags: string[] | undefined): string[] {
    if (!tags) return [];

    const seen = new Set<string>();

    for (const tag of tags) {
      const clean = tag.trim().toLowerCase();

      if (clean) seen.add(clean);
    }

    return [...seen];
  }

  private buildWhere(query: ArticleQueryDto): Prisma.ArticleWhereInput {
    const term = query.search?.trim();

    return {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
      // `has` compara contra un elemento del array, no contra la cadena entera.
      ...(query.tag ? { tags: { has: query.tag.trim().toLowerCase() } } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: 'insensitive' as const } },
              { summary: { contains: term, mode: 'insensitive' as const } },
              { content: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }
}
