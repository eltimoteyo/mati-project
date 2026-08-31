'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import { findNavItem } from '@/config/navigation';
import { siteConfig } from '@/config/site';

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Migas de pan derivadas de la ruta actual.
 *
 * Se apoyan en la configuracion de navegacion en lugar de reconstruir el
 * texto desde el segmento de la URL: asi la etiqueta visible es siempre la
 * misma en la barra lateral y en la cabecera.
 */
function buildCrumbs(pathname: string): Crumb[] {
  const root: Crumb = { label: 'Panel', href: siteConfig.routes.dashboard };

  if (pathname === siteConfig.routes.dashboard) {
    return [{ label: 'Panel' }];
  }

  const current = findNavItem(pathname);

  return current ? [root, { label: current.label }] : [root];
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Ruta de navegacion" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? (
                <ChevronRightIcon
                  className="size-3.5 shrink-0 text-muted-foreground/50"
                  aria-hidden="true"
                />
              ) : null}

              <li className="min-w-0">
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/22"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="block truncate font-medium text-foreground"
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
