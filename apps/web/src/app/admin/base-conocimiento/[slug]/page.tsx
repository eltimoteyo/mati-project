import type { Metadata } from 'next';

import { ArticleDetailView } from '@/components/knowledge/article-detail-view';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: decodeURIComponent(slug).replace(/-/g, ' '),
    description: 'Articulo de la base de conocimiento.',
  };
}

export default async function ArticleDetailPage({ params }: ArticlePageProps) {
  const { slug } = await params;

  return <ArticleDetailView slug={decodeURIComponent(slug)} />;
}
