import { Button, ScrollArea } from '@conit/ui';
import { GlobeIcon } from 'lucide-react';
import Link from 'next/link';

import { ConitLogo } from '@/components/brand/conit-logo';
import { siteConfig } from '@/config/site';

import { SidebarNav } from './sidebar-nav';

interface SidebarProps {
  /** Se invoca al navegar; el panel movil lo usa para cerrarse. */
  onNavigate?: () => void;
}

/**
 * Contenido de la barra lateral.
 *
 * Se comparte entre la version fija de escritorio y el panel deslizante
 * movil, de modo que la navegacion no puede divergir entre ambas.
 */
export function SidebarContent({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link
          href={siteConfig.routes.dashboard}
          onClick={onNavigate}
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/30"
          aria-label={`${siteConfig.name} — ir al panel`}
        >
          <ConitLogo size="sm" />
        </Link>
      </div>

      <ScrollArea className="flex-1">
        <SidebarNav onNavigate={onNavigate} />
      </ScrollArea>

      <div className="border-t border-sidebar-border p-4">
        <Button asChild variant="outline" className="w-full justify-start" onClick={onNavigate}>
          <Link href={siteConfig.routes.home}>
            <GlobeIcon />
            <span>Ver sitio web</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Barra lateral fija de escritorio. Oculta por debajo del punto de corte `lg`. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  );
}
