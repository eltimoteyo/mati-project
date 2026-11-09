import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';

export function chunkArticle(content: string): string[] {
  return content
    .split(/(?=^#{1,3}\s)/m)
    .flatMap((section) => {
      const chunks: string[] = [];
      for (let i = 0; i < section.length; i += 1800) chunks.push(section.slice(i, i + 2000));
      return chunks;
    })
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  return denominator ? a.reduce((sum, value, i) => sum + value * b[i]!, 0) / denominator : 0;
}

@Injectable()
export class SupportKnowledgeService {
  private readonly config: AppConfig['ai'];
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.config = config.get('ai', { infer: true });
  }

  async embed(input: string[], signal?: AbortSignal): Promise<number[][]> {
    if (!this.config.embeddingModel || !this.config.openrouterKey) return [];
    const response = await fetch(`${this.config.openrouterBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input,
        provider: { data_collection: 'deny' },
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Embeddings no disponibles (HTTP ${response.status})`);
    const result = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    const vectors = result.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
    if (
      vectors.length !== input.length ||
      vectors.some((vector) => !vector.length || vector.some((n) => !Number.isFinite(n)))
    )
      throw new Error('Embeddings inválidos');
    return vectors;
  }

  /** Reindexación explícita: los cambios de contenido nunca reutilizan un vector viejo. */
  async index(articleId?: string) {
    const articles = await this.prisma.article.findMany({
      where: { ...(articleId ? { id: articleId } : {}), isPublished: true },
    });
    let count = 0;
    for (const article of articles) {
      const chunks = chunkArticle(`${article.title}\n${article.summary ?? ''}\n${article.content}`);
      const previous = await this.prisma.articleChunk.findMany({
        where: { articleId: article.id },
        orderBy: { position: 'asc' },
      });
      for (const [position, content] of chunks.entries()) {
        const old = previous[position];
        if (old?.content === content && old.model === (this.config.embeddingModel ?? null))
          continue;
        const [embedding] = await this.embed([content]);
        await this.prisma.articleChunk.upsert({
          where: { articleId_position: { articleId: article.id, position } },
          create: {
            articleId: article.id,
            position,
            content,
            ...(embedding ? { embedding, model: this.config.embeddingModel } : {}),
          },
          update: {
            content,
            embedding: embedding ?? null,
            model: this.config.embeddingModel ?? null,
          },
        });
        count++;
      }
      await this.prisma.articleChunk.deleteMany({
        where: { articleId: article.id, position: { gte: chunks.length } },
      });
    }
    return { indexed: count };
  }

  async search(query: string, signal?: AbortSignal) {
    const terms = [
      ...new Set(
        query
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .match(/[a-z0-9]{3,}/g) ?? [],
      ),
    ].slice(0, 20);
    if (!terms.length) return [];
    let vectorMatches: Array<{
      id: string;
      position: number;
      title: string;
      content: string;
      guidance: unknown;
    }> = [];
    if (this.config.vectorEnabled && this.config.embeddingModel) {
      try {
        const [queryVector] = await this.embed([query.slice(0, 3000)], signal);
        if (queryVector) {
          // La extensión es opcional; el modo portable de abajo no la necesita.
          vectorMatches = await this.prisma.$queryRaw<
            Array<{
              id: string;
              position: number;
              title: string;
              content: string;
              guidance: unknown;
            }>
          >`
          SELECT a.id, c.position, a.title, c.content, a.guidance FROM article_chunks c JOIN articles a ON a.id = c.article_id
          WHERE a.is_published = true AND c.model = ${this.config.embeddingModel} AND c.embedding IS NOT NULL
            AND strpos(a.title || E'\n' || coalesce(a.summary, '') || E'\n' || a.content, c.content) > 0
          ORDER BY (c.embedding::text)::vector <=> ${JSON.stringify(queryVector)}::vector LIMIT 5
        `;
        }
      } catch {
        /* Sin extensión o servicio de embeddings se conserva la búsqueda de texto. */
      }
    }
    const lexical = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string | null;
        content: string;
        guidance: unknown;
        rank: number;
      }>
    >`
      SELECT id, title, summary, content, guidance, ts_rank(to_tsvector('spanish', translate(lower(title || ' ' || coalesce(summary, '') || ' ' || content), 'áéíóúüñ', 'aeiouun')), to_tsquery('spanish', ${terms.join(' | ')})) AS rank
      FROM articles WHERE is_published = true
      ORDER BY rank DESC LIMIT 10
    `;
    const chunks = vectorMatches.length
      ? []
      : await this.prisma.articleChunk.findMany({
          where: {
            article: { isPublished: true },
            model: this.config.embeddingModel ?? '__disabled__',
            embedding: { not: Prisma.DbNull },
          },
          include: {
            article: { select: { title: true, content: true, summary: true, guidance: true } },
          },
          take: 2000,
        });
    let vector: number[] | undefined;
    if (chunks.length) {
      try {
        [vector] = await this.embed([query.slice(0, 3000)], signal);
      } catch {
        /* La búsqueda léxica sigue disponible. */
      }
    }
    const ranked = new Map<
      string,
      { title: string; content: string; guidance: unknown; score: number }
    >();
    for (const [index, article] of lexical.filter((item) => item.rank > 0).entries()) {
      for (const [i, content] of chunkArticle(
        `${article.title}\n${article.summary ?? ''}\n${article.content}`,
      ).entries())
        ranked.set(`${article.id}:${i}`, {
          title: article.title,
          content,
          guidance: article.guidance,
          score: 1 / (60 + index),
        });
    }
    for (const [index, chunk] of vectorMatches.entries()) {
      const key = `${chunk.id}:${chunk.position}`;
      ranked.set(key, {
        title: chunk.title,
        content: chunk.content,
        guidance: chunk.guidance,
        score: (ranked.get(key)?.score ?? 0) + 1 / (60 + index),
      });
    }
    if (vector) {
      const semantic = chunks
        .filter(
          (chunk) =>
            chunkArticle(
              `${chunk.article.title}\n${chunk.article.summary ?? ''}\n${chunk.article.content}`,
            )[chunk.position] === chunk.content,
        )
        .map((chunk) => ({ chunk, similarity: cosine(vector!, chunk.embedding as number[]) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);
      for (const [index, { chunk }] of semantic.entries()) {
        const key = `${chunk.articleId}:${chunk.position}`;
        ranked.set(key, {
          title: chunk.article.title,
          content: chunk.content,
          guidance: chunk.article.guidance,
          score: (ranked.get(key)?.score ?? 0) + 1 / (60 + index),
        });
      }
    }
    return [...ranked.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ title, content, guidance }) => ({ title, content, guidance }));
  }
}
