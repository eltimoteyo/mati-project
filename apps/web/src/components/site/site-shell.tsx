import type { ReactNode } from 'react';

import { ScrollProgress } from './scroll-progress';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/**
 * Estructura comun del sitio publico.
 *
 * Cabecera fija, contenido y pie. El indicador de avance vive aqui para que
 * este en todas las paginas sin repetirlo en cada una.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
}

/**
 * Encabezado de las paginas interiores.
 *
 * Fondo blanco con halos muy diluidos de los dos colores de marca. El peso
 * visual lo lleva la tipografia, no un bloque de color: asi el encabezado y el
 * contenido son una sola superficie continua.
 */
export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-white pt-36 pb-20 sm:pt-44 sm:pb-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#024A9D] opacity-[0.07] blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10rem] bottom-[-14rem] h-[24rem] w-[24rem] rounded-full bg-[#F9AB38] opacity-[0.13] blur-[130px]"
      />
      {/* Retícula tenue: da profundidad sin competir con el texto. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(2,34,74,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(2,34,74,0.045)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_68%)]"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-start gap-6 px-5 sm:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#024A9D]/15 bg-[#024A9D]/[0.05] px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-[#024A9D] uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[#F9AB38]" />
          {eyebrow}
        </span>

        <h1 className="text-4xl leading-[1.12] font-bold tracking-tight text-balance text-[#02224a] sm:text-5xl">
          {title}
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-slate-600">
          {description}
        </p>

        {children}
      </div>
    </section>
  );
}

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  /** Centra el bloque; por defecto va alineado a la izquierda. */
  centered?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={centered ? 'mx-auto flex max-w-2xl flex-col gap-4 text-center' : 'flex max-w-2xl flex-col gap-4'}>
      <span className="text-xs font-semibold tracking-[0.16em] text-[#024A9D] uppercase">
        {eyebrow}
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-lg leading-relaxed text-pretty text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
