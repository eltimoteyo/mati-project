'use client';

import { cn } from '@conit/ui';
import {
  LayersIcon,
  LifeBuoyIcon,
  type LucideIcon,
  MailIcon,
  MenuIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SiteUserMenu } from './site-user-menu';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Paginas del sitio publico. El icono ayuda a reconocerlas de un vistazo. */
const LINKS: NavLink[] = [
  { href: '/servicios', label: 'Servicios', icon: LayersIcon },
  { href: '/soporte', label: 'Soporte', icon: LifeBuoyIcon },
  { href: '/nosotros', label: 'Nosotros', icon: UsersIcon },
  { href: '/contacto', label: 'Contacto', icon: MailIcon },
];

/**
 * Cabecera del sitio publico.
 *
 * Barra blanca translucida: el sitio es claro de principio a fin, y una
 * cabecera oscura flotando sobre el contenido partiria esa continuidad. Al
 * desplazarse gana borde y una sombra muy tenue, lo justo para despegarse del
 * contenido sin convertirse en un bloque pesado.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Ajuste de estado durante el render (patron recomendado por React frente a
  // un `useEffect`, que provocaria un render en cascada): al navegar a otra
  // pagina el menu movil se cierra solo.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);

    if (menuOpen) {
      setMenuOpen(false);
    }
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const raised = scrolled || menuOpen;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300',
        raised
          ? 'border-b border-slate-200/80 bg-white/85 shadow-[0_1px_28px_-12px_rgba(2,34,74,0.22)] backdrop-blur-xl'
          : 'border-b border-transparent bg-white/70 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
        >
          <Image
            src="/brand/conit-mark.png"
            alt=""
            width={36}
            height={36}
            priority
            className="shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <span className="flex flex-col leading-none">
            <span className="text-[0.9375rem] font-bold tracking-[0.09em] text-[#02224a]">
              CONIT
            </span>
            <span className="mt-1 text-[0.5rem] font-semibold tracking-[0.22em] text-[#B87A14] uppercase">
              Support Desk
            </span>
          </span>
        </Link>

        <nav aria-label="Paginas" className="hidden items-center gap-0.5 md:flex">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none',
                  active
                    ? 'text-[#024A9D]'
                    : 'text-slate-600 hover:bg-[#024A9D]/[0.05] hover:text-[#02224a]',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-4 transition-colors',
                    active ? 'text-[#F9AB38]' : 'text-slate-400 group-hover:text-[#024A9D]',
                  )}
                />
                {label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#F9AB38]"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <SiteUserMenu />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
          className="rounded-lg p-2 text-[#02224a] transition-colors hover:bg-[#024A9D]/[0.07] focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none md:hidden"
        >
          {menuOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-slate-200/80 bg-white px-5 pb-6 md:hidden">
          <nav aria-label="Paginas" className="flex flex-col py-2">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#024A9D]/[0.06] text-[#024A9D]'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn('size-4', active ? 'text-[#F9AB38]' : 'text-slate-400')}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>

          <SiteUserMenu />
        </div>
      ) : null}
    </header>
  );
}
