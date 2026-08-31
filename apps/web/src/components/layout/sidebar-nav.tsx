'use client';

import { cn } from '@conit/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navigation, type NavItem } from '@/config/navigation';

/** Determina si una entrada corresponde a la ruta actual. */
function isActive(item: NavItem, pathname: string): boolean {
  // `/admin` solo esta activo en coincidencia exacta; de lo contrario quedaria
  // resaltado en todas las subrutas del panel.
  if (item.href === '/admin') return pathname === '/admin';

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface SidebarNavProps {
  /** Se invoca al navegar; el panel movil lo usa para cerrarse. */
  onNavigate?: () => void;
}

/**
 * Navegacion principal del panel.
 *
 * El indicador de seccion activa es un unico elemento compartido
 * (`layoutId`): al cambiar de seccion se desplaza entre entradas en lugar de
 * aparecer y desaparecer, lo que hace legible el cambio de contexto.
 */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegacion principal" className="flex flex-col gap-6 px-3 py-4">
      {navigation.map((section, sectionIndex) => (
        <div key={section.title ?? `section-${sectionIndex}`} className="flex flex-col gap-1">
          {section.title ? (
            <h2 className="px-3 pt-1 pb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
              {section.title}
            </h2>
          ) : null}

          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2',
                      'text-sm font-medium transition-colors duration-200',
                      'outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/30',
                      active
                        ? 'text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active-item"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md bg-sidebar-accent"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}

                    <Icon
                      className={cn(
                        'relative size-4 shrink-0 transition-colors duration-200',
                        active ? 'text-primary' : 'text-muted-foreground/80',
                      )}
                      aria-hidden="true"
                    />
                    <span className="relative truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
