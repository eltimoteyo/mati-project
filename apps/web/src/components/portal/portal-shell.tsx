'use client';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, getInitials } from '@conit/ui';
import { ArrowLeftIcon, HomeIcon, LogOutIcon, TicketIcon, UserIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useLogout } from '@/hooks/use-logout';
import { usePortalProfile } from '@/hooks/use-portal';
import { resolveAvatarUrl } from '@/lib/env';

const LINKS = [
  { href: '/portal', label: 'Inicio', icon: HomeIcon, exact: true },
  { href: '/portal/incidencias', label: 'Mis incidencias', icon: TicketIcon, exact: false },
  { href: '/portal/perfil', label: 'Mi perfil', icon: UserIcon, exact: true },
] as const;

/**
 * Estructura del portal del cliente.
 *
 * Deliberadamente mas simple que el panel: una barra superior y el contenido.
 * Un cliente entra a cosas puntuales —abrir una incidencia, ver como va— y una
 * barra lateral con secciones daria a entender que hay mucho mas que explorar.
 *
 * Usa las superficies semanticas del sistema para conservar la misma jerarquia
 * y contraste en claro y oscuro.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const logout = useLogout();
  const profile = usePortalProfile();

  const person = profile.data?.user;
  const company = profile.data?.client;

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 right-[-12rem] -z-10 size-[34rem] rounded-full bg-primary/[0.055] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[34rem] left-[-14rem] -z-10 size-[30rem] rounded-full bg-gold-500/[0.045] blur-3xl"
      />

      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/88 shadow-subtle backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/portal" className="flex items-center gap-2.5 rounded-lg">
            <Image
              src="/brand/conit-mark.png"
              alt=""
              width={32}
              height={32}
              priority
              className="shrink-0 object-contain"
            />
            <span className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-[0.09em] text-foreground">CONIT</span>
              <span className="mt-1 text-[0.5rem] font-semibold tracking-[0.2em] text-gold-700 uppercase dark:text-gold-400">
                Portal de cliente
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/">
                <ArrowLeftIcon />
                <span className="hidden sm:inline">Volver a la web</span>
                <span className="sr-only sm:hidden">Volver a la web</span>
              </Link>
            </Button>

            {/* El nombre de la empresa confirma de un vistazo con que cuenta se
                ha entrado, algo util cuando alguien gestiona varias. */}
            {company ? (
              <span className="hidden max-w-[13rem] truncate border-l border-border pl-3 text-sm text-muted-foreground lg:block">
                {company.name}
              </span>
            ) : null}

            <ThemeToggle />

            {person ? (
              <Link
                href="/portal/perfil"
                className="rounded-full transition-transform outline-none hover:scale-[1.04] focus-visible:ring-[3px] focus-visible:ring-ring/25"
                aria-label={`Abrir el perfil de ${person.name}`}
              >
                <Avatar className="size-8 border-primary/20 shadow-subtle">
                  {person.avatar ? (
                    <AvatarImage src={resolveAvatarUrl(person.avatar)} alt="" />
                  ) : null}
                  <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                </Avatar>
              </Link>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              loading={logout.isPending}
              onClick={() => logout.mutate()}
              aria-label="Cerrar sesion"
            >
              <LogOutIcon />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>

        <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-5 pb-2 sm:px-8">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>

      <footer className="border-t border-border/80 bg-card/45 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} CONIT. Soporte tecnico corporativo.
        </div>
      </footer>
    </div>
  );
}
