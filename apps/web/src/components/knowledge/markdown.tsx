import type { ReactNode } from 'react';

/**
 * Renderizador de un subconjunto de Markdown.
 *
 * Devuelve nodos de React en lugar de HTML: no hay ningun
 * `dangerouslySetInnerHTML` en el camino, asi que un articulo no puede
 * inyectar marcado aunque quien lo escriba lo intente. El subconjunto cubre lo
 * que necesita una guia tecnica —titulos, listas, codigo, enlaces, citas— y
 * deja fuera todo lo demas a proposito.
 */

/** `**negrita**`, `*cursiva*`, `` `codigo` `` y `[texto](url)`. */
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Solo http(s) y anclas: `javascript:` nunca llega a un href. */
function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith('#') || href.startsWith('/');
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((part) => part !== '');

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);

    if (link?.[1] !== undefined && link[2] !== undefined) {
      const label = link[1];
      const href = link[2];

      if (!isSafeHref(href)) return <span key={key}>{label}</span>;

      return (
        <a
          key={key}
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="rounded-sm text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/22"
        >
          {label}
        </a>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

interface Block {
  type: 'heading' | 'paragraph' | 'list' | 'ordered' | 'code' | 'quote';
  level?: number;
  lines: string[];
}

/** Agrupa las lineas en bloques antes de renderizar. */
function toBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;
  let inCode = false;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        flush();
        inCode = false;
      } else {
        flush();
        current = { type: 'code', lines: [] };
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      current?.lines.push(line);
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const hashes = heading?.[1];
    const headingText = heading?.[2];

    if (hashes !== undefined && headingText !== undefined) {
      flush();
      blocks.push({ type: 'heading', level: hashes.length, lines: [headingText] });
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)?.[1];

    if (bullet !== undefined) {
      if (current?.type !== 'list') {
        flush();
        current = { type: 'list', lines: [] };
      }
      current.lines.push(bullet);
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)?.[1];

    if (ordered !== undefined) {
      if (current?.type !== 'ordered') {
        flush();
        current = { type: 'ordered', lines: [] };
      }
      current.lines.push(ordered);
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line)?.[1];

    if (quote !== undefined) {
      if (current?.type !== 'quote') {
        flush();
        current = { type: 'quote', lines: [] };
      }
      current.lines.push(quote);
      continue;
    }

    if (current?.type !== 'paragraph') {
      flush();
      current = { type: 'paragraph', lines: [] };
    }
    current.lines.push(line);
  }

  flush();

  return blocks;
}

const HEADING_FALLBACK = 'text-base font-semibold text-foreground mt-6 first:mt-0';

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-xl font-semibold tracking-tight text-foreground mt-8 first:mt-0',
  2: 'text-lg font-semibold tracking-tight text-foreground mt-7 first:mt-0',
  3: HEADING_FALLBACK,
  4: 'text-sm font-semibold text-foreground mt-5 first:mt-0',
};

export function Markdown({ content }: { content: string }) {
  const blocks = toBlocks(content);

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        switch (block.type) {
          case 'heading': {
            const level = block.level ?? 2;
            const Tag = (`h${Math.min(level + 1, 6)}`) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

            return (
              <Tag key={key} className={HEADING_CLASSES[level] ?? HEADING_FALLBACK}>
                {renderInline(block.lines[0] ?? '', key)}
              </Tag>
            );
          }

          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-lg border border-border bg-muted/50 px-4 py-3"
              >
                <code className="font-mono text-xs text-foreground">{block.lines.join('\n')}</code>
              </pre>
            );

          case 'list':
            return (
              <ul key={key} className="ml-5 flex list-disc flex-col gap-1.5 marker:text-primary">
                {block.lines.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );

          case 'ordered':
            return (
              <ol key={key} className="ml-5 flex list-decimal flex-col gap-1.5 marker:text-primary">
                {block.lines.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            );

          case 'quote':
            return (
              <blockquote
                key={key}
                className="border-l-2 border-primary/35 bg-muted/30 py-2 pl-4 text-muted-foreground"
              >
                {renderInline(block.lines.join(' '), key)}
              </blockquote>
            );

          default:
            return <p key={key}>{renderInline(block.lines.join(' '), key)}</p>;
        }
      })}
    </div>
  );
}
