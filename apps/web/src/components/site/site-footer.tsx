import { ArrowUpRightIcon, MailIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { SERVICES } from './site-content';

const PAGES = [
  { href: '/servicios', label: 'Servicios' },
  { href: '/soporte', label: 'Soporte' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contacto' },
] as const;

/**
 * Pie del sitio publico.
 *
 * Sobre un gris muy claro, no sobre blanco puro: es lo unico que separa el pie
 * del final del contenido sin recurrir a un bloque de color que rompa la
 * continuidad clara de todo el sitio. Sin estado propio: se renderiza en el
 * servidor.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-5">
            <Link href="/" className="flex w-fit items-center gap-2.5">
              <Image
                src="/brand/conit-mark.png"
                alt=""
                width={34}
                height={34}
                className="shrink-0 object-contain"
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

            <p className="max-w-sm text-sm leading-relaxed text-slate-600">
              Desarrollamos y mantenemos la tecnologia que sostiene tu organizacion, y la atendemos
              cuando falla.
            </p>

            <a
              href="mailto:soporte@conit.com"
              className="inline-flex w-fit items-center gap-2 rounded-sm text-sm font-medium text-[#02224a] transition-colors hover:text-[#024A9D] focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
            >
              <MailIcon className="size-4 text-[#024A9D]" aria-hidden="true" />
              soporte@conit.com
            </a>
          </div>

          <nav aria-label="Servicios" className="flex flex-col gap-3.5">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
              Servicios
            </h2>
            {SERVICES.map((service) => (
              <Link
                key={service.slug}
                href={`/servicios#${service.slug}`}
                className="w-fit rounded-sm text-sm text-slate-600 transition-colors hover:text-[#024A9D] focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
              >
                {service.title}
              </Link>
            ))}
          </nav>

          <nav aria-label="Paginas" className="flex flex-col gap-3.5">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
              Navegacion
            </h2>
            {PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="w-fit rounded-sm text-sm text-slate-600 transition-colors hover:text-[#024A9D] focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
              >
                {page.label}
              </Link>
            ))}

            <Link
              href="/login"
              className="group mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-semibold text-[#024A9D] transition-colors hover:text-[#02224a] focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
            >
              Area de soporte
              <ArrowUpRightIcon
                className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </Link>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} CONIT. Todos los derechos reservados.
          </p>
          <p className="text-center text-xs text-slate-500">
            Sitios web · Sistemas web · Aulas virtuales · Hosting · Dominios · Correo · Bases de
            datos
          </p>
        </div>
      </div>
    </footer>
  );
}
