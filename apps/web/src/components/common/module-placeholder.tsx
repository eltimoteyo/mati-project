import { Badge, Card, cn } from '@conit/ui';
import { ConstructionIcon } from 'lucide-react';

import { findNavItem, type NavItem } from '@/config/navigation';

import { PageHeader } from './page-header';

interface ModulePlaceholderProps {
  /** Ruta del modulo; su etiqueta y descripcion salen de la configuracion. */
  href: string;
  /** Puntos concretos que cubrira el modulo cuando se implemente. */
  scope?: string[];
  className?: string;
}

/**
 * Pagina de un modulo aun no implementado.
 *
 * Declara de forma explicita que la seccion pertenece a una fase posterior.
 * Es deliberado que no muestre tablas, cifras ni graficos de ejemplo: una
 * interfaz simulada dentro del panel real se confunde con funcionalidad
 * existente y genera expectativas equivocadas.
 */
export function ModulePlaceholder({ href, scope, className }: ModulePlaceholderProps) {
  const item: NavItem | undefined = findNavItem(href);
  const Icon = item?.icon ?? ConstructionIcon;

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <PageHeader
        title={item?.label ?? 'Modulo'}
        description={item?.description}
        actions={<Badge variant="neutral">Fase posterior</Badge>}
      />

      <Card className="items-start gap-5 p-6 sm:p-8">
        <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Modulo pendiente de desarrollo</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            La navegacion, los permisos y la estructura de esta seccion ya estan preparados. La
            funcionalidad se incorporara en una fase posterior del proyecto.
          </p>
        </div>

        {scope && scope.length > 0 ? (
          <div className="flex flex-col gap-3 pt-1">
            <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Alcance previsto
            </h3>
            <ul className="flex flex-col gap-2">
              {scope.map((entry) => (
                <li key={entry} className="flex items-start gap-2.5 text-sm text-foreground/85">
                  <span
                    aria-hidden="true"
                    className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-primary/45"
                  />
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
