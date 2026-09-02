import type { Article, ArticleListItem } from '@conit/types';

import { toCategoryRef } from '../categories/categories.mapper';
import type { Article as ArticleModel, Category, User } from '../generated/prisma/client';
import { toUserRef } from '../tickets/tickets.mapper';

type UserSelection = Pick<User, 'id' | 'name' | 'email' | 'avatar'>;

export const ARTICLE_RELATIONS = {
  category: { select: { id: true, name: true, color: true } },
  author: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

/**
 * Campos del listado.
 *
 * Se enumeran en un `select` en lugar de excluir `content` de un `include`
 * porque Prisma no sabe excluir columnas: pedir todo y descartarlo despues
 * traeria el cuerpo entero por la red igualmente.
 */
export const ARTICLE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  isPublished: true,
  viewsCount: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  ...ARTICLE_RELATIONS,
} as const;

export type ArticleListRecord = Pick<
  ArticleModel,
  'id' | 'title' | 'slug' | 'summary' | 'isPublished' | 'viewsCount' | 'tags' | 'createdAt' | 'updatedAt'
> & {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  author: UserSelection | null;
};

export type ArticleRecord = ArticleListRecord & Pick<ArticleModel, 'content'>;

export function toArticleListItem(article: ArticleListRecord): ArticleListItem {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    category: toCategoryRef(article.category),
    author: toUserRef(article.author),
    isPublished: article.isPublished,
    viewsCount: article.viewsCount,
    tags: article.tags,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

export function toArticle(article: ArticleRecord): Article {
  return { ...toArticleListItem(article), content: article.content };
}
