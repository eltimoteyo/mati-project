import { Button } from '@conit/ui';
import { ArrowRightIcon, MailIcon, TicketIcon, UserPlusIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal, Stagger, StaggerItem } from '@/components/site/reveal';
import { PageHero, SectionHeading } from '@/components/site/site-shell';

export const metadata: Metadata = {
  title: 'Contacto · CONIT',
  description:
    'Registra una incidencia en el area de soporte o escribenos si aun no eres cliente de CONIT.',
  robots: { index: true, follow: true },
};

/**
 * Vias de contacto.
 *
 * Se ordenan por lo que resuelve antes cada caso: quien ya es cliente entra al
 * area de soporte —donde su aviso queda registrado— y quien no lo es todavia
 * escribe por correo. No hay formulario propio porque no habria a donde
 * enviarlo sin duplicar el sistema de tickets que ya existe.
 */
const CHANNELS = [
  {
    icon: TicketIcon,
    title: 'Ya eres cliente',
    description:
      'Entra al area de soporte y registra la incidencia. Recibiras un codigo para seguir su estado, y cada respuesta te llegara tambien por correo.',
    action: { label: 'Ir al area de soporte', href: '/login' },
    featured: true,
  },
  {
    icon: UserPlusIcon,
    title: 'Aun no eres cliente',
    description:
      'Cuentanos que tienes montado y que necesitas resolver. Revisamos tu situacion y te damos una respuesta clara antes de tocar nada.',
    action: { label: 'soporte@conit.com', href: 'mailto:soporte@conit.com' },
    featured: false,
  },
] as const;

/** Que conviene incluir al escribir, para no perder un ciclo de preguntas. */
const WHAT_TO_INCLUDE = [
  'Que servicio esta afectado (web, correo, aula virtual, hosting…)',
  'Que ocurre exactamente y desde cuando',
  'Si afecta a una persona o a toda la organizacion',
  'Cualquier mensaje de error que veas, tal cual aparece',
];

export default function ContactoPage() {
  return (
    <>
      <PageHero
        eyebrow="Contacto"
        title="Cuentanos que necesitas resolver"
        description="Dos vias, segun si ya trabajas con nosotros o es la primera vez. Ambas llegan al mismo equipo."
      />

      {/* Canales ---------------------------------------------------------- */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Stagger as="ul" className="grid gap-6 md:grid-cols-2">
            {CHANNELS.map(({ icon: Icon, title, description, action, featured }) => (
              <StaggerItem
                key={title}
                as="li"
                className={
                  featured
                    ? 'group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[#024A9D]/20 bg-[#024A9D]/[0.04] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#024A9D]/35 hover:shadow-[0_16px_48px_-24px_rgba(2,74,157,0.4)]'
                    : 'group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#024A9D]/25 hover:shadow-[0_16px_48px_-24px_rgba(2,74,157,0.4)]'
                }
              >
                {featured ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[#F9AB38] opacity-25 blur-[60px]"
                  />
                ) : null}

                <span
                  className={
                    featured
                      ? 'relative flex size-11 items-center justify-center rounded-xl bg-[#024A9D] text-white shadow-[0_10px_26px_-14px_rgba(2,74,157,0.9)]'
                      : 'flex size-11 items-center justify-center rounded-xl bg-[#024A9D]/8 text-[#024A9D]'
                  }
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>

                <h2
                  className={
                    featured
                      ? 'relative text-lg font-semibold text-[#02224a]'
                      : 'text-lg font-semibold text-slate-900'
                  }
                >
                  {title}
                </h2>

                <p
                  className={
                    featured
                      ? 'relative text-sm leading-relaxed text-slate-600'
                      : 'text-sm leading-relaxed text-slate-600'
                  }
                >
                  {description}
                </p>

                <div className="relative mt-auto pt-2">
                  {action.href.startsWith('mailto:') ? (
                    <a
                      href={action.href}
                      className="group/link inline-flex items-center gap-2 rounded-sm text-sm font-medium text-[#024A9D] transition-colors hover:text-[#013A7C] focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
                    >
                      <MailIcon className="size-4" aria-hidden="true" />
                      {action.label}
                    </a>
                  ) : (
                    <Button
                      asChild
                      className="group/btn bg-[#024A9D] text-white shadow-[0_10px_28px_-14px_rgba(2,74,157,0.9)] hover:bg-[#02224a]"
                    >
                      <Link href={action.href}>
                        {action.label}
                        <ArrowRightIcon className="transition-transform duration-300 group-hover/btn:translate-x-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Que incluir ------------------------------------------------------ */}
      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="Para ir mas rapido"
              title="Que conviene contarnos"
              description="Con estos datos evitamos una ronda de preguntas y empezamos a mirar antes."
              centered
            />
          </Reveal>

          <Stagger as="ul" className="mt-12 flex flex-col gap-3">
            {WHAT_TO_INCLUDE.map((item, index) => (
              <StaggerItem
                key={item}
                as="li"
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4"
              >
                <span
                  aria-hidden="true"
                  className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#024A9D]/8 text-xs font-bold text-[#024A9D]"
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-700">{item}</span>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal from="up" delay={0.15}>
            <p className="mt-10 text-center text-sm leading-relaxed text-slate-500">
              Si el servicio esta caido o hay datos en riesgo, indicalo al principio del mensaje:
              esas incidencias se tratan con prioridad maxima.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
