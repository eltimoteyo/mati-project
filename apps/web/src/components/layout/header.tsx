'use client';

import { Separator } from '@conit/ui';

import { useSession } from '@/hooks/use-session';

import { Breadcrumbs } from './breadcrumbs';
import { MobileNav } from './mobile-nav';
import { NotificationsMenu } from './notifications-menu';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/**
 * Cabecera del panel.
 *
 * Permanece fija al desplazar para que la ubicacion (migas de pan) y las
 * acciones de cuenta esten siempre accesibles en listados largos.
 */
export function Header() {
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <MobileNav />

      <Separator orientation="vertical" className="h-5 lg:hidden" />

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <ThemeToggle />
        <NotificationsMenu />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <UserMenu user={user} />
      </div>
    </header>
  );
}
