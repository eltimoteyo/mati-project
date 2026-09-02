import type { CategoryRef } from './category';
import type { UserRef } from './user';

/**
 * Articulo de la base de conocimiento.
 *
 * Guias tecnicas, soluciones y procedimientos frecuentes. Un articulo
 * publicado es visible para consulta; uno en borrador solo lo ve quien lo
 * edita, de modo que se puede escribir sin publicar a medias.
 */
export interface Article extends ArticleListItem {
  /** Cuerpo completo en Markdown. */
  content: string;
}

/**
 * Articulo sin el cuerpo, para listados.
 *
 * El contenido puede llegar a 50 000 caracteres: enviarlo en cada fila de una
 * tabla multiplicaria por mil el tamano de la respuesta sin que se muestre.
 */
export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: CategoryRef | null;
  author: UserRef | null;
  isPublished: boolean;
  viewsCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArticleSummary {
  total: number;
  published: number;
  drafts: number;
  totalViews: number;
  /** Etiquetas mas usadas, de mayor a menor. */
  topTags: ArticleTagCount[];
}

export interface ArticleTagCount {
  tag: string;
  count: number;
}

export interface ArticleFilters {
  search?: string;
  categoryId?: string;
  isPublished?: boolean;
  tag?: string;
  page?: number;
  pageSize?: number;
  sortBy?: ArticleSortField;
  sortOrder?: 'asc' | 'desc';
}

export const ARTICLE_SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'viewsCount'] as const;

export type ArticleSortField = (typeof ARTICLE_SORT_FIELDS)[number];

export interface CreateArticleInput {
  title: string;
  /** Si se omite, se deriva del titulo. */
  slug?: string;
  summary?: string | null;
  content: string;
  categoryId?: string | null;
  isPublished?: boolean;
  tags?: string[];
}

export type UpdateArticleInput = Partial<CreateArticleInput>;
