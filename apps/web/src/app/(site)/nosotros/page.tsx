import { Button } from '@conit/ui';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Counter } from '@/components/site/counter';
import { Reveal, Stagger, StaggerItem } from '@/components/site/reveal';
import { DIFFERENTIATORS } from '@/components/site/site-content';
import { PageHero, SectionHeading } from '@/components/site/site-shell';

export const metadata: Metadata = {
  title: 'Nosotros · CONIT',
  description:
    'Quienes somos y como trabajamos en CONIT: el equipo que desarrolla tu tecnologia es el ' +
    'mismo que la mantiene y la atiende.',
  robots: { index: true, follow: true },
};

/** Principios de trabajo. Son compromisos comprobables, no lemas. */
const PRINCIPLES = [
  {
    title: 'Decimos lo que se puede hacer',
    description:
      'Si algo no tiene arreglo razonable, lo decimos antes de facturar horas. Una estimacion honesta vale mas que un si automatico.',
  },
  {
    title: 'Dejamos rastro de todo',
    description:
      'Cada cambio queda registrado con su autor y su fecha. No hay trabajo invisible ni versiones de los hechos.',
  },
  {
    title: 'No creamos dependencia artificial',
    description:
      'Documentamos lo que hacemos y entregamos los accesos. Trabajamos contigo porque quieres, no porque no puedas irte.',
  },
  {
    title: 'Lo urgente se trata como urgente',
    description:
      'Un servicio caido no espera al lunes. La prioridad la marca el impacto real, no el orden de llegada.',
  },
] as const;

export default function NosotrosPage() {
  return (
    <>
      <PageHero
        eyebrow="Nosotros"
        title="Un equipo que se queda despues de la entrega"
        description="CONIT nace de una idea sencilla: quien construye un sistema es quien mejor puede sostenerlo cuando falla."
      />

      {/* Relato ----------------------------------------------------------- */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <Reveal from="right">
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow="Como trabajamos"
                title="Desarrollo y soporte no son dos empresas distintas"
              />

              <div className="flex flex-col gap-4 text-base leading-relaxed text-slate-600">
                <p>
                  Lo habitual en el sector es que una empresa construya el sitio o el sistema y otra
                  distinta —o nadie— se ocupe de mantenerlo. Cuando algo se rompe, el cliente acaba
                  de intermediario entre proveedores que se senalan entre si.
                </p>
                <p>
                  En CONIT las dos cosas son el mismo equipo. Quien programo tu aula virtual es
                  quien atiende el aviso cuando los alumnos no pueden entrar, y ya sabe donde
                  mirar.
                </p>
                <p>
                  Eso no se sostiene solo con buena voluntad: hace falta que cada incidencia quede
                  registrada, priorizada y medida. Por eso construimos nuestro propio sistema de
                  soporte, y por eso puedes consultar en cualquier momento que se hizo con tu aviso.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal from="left" delay={0.15} className="flex justify-center lg:justify-end">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 translate-y-6 rounded-full bg-[#024A9D] opacity-10 blur-[70px]"
              />
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 transition-transform duration-500 hover:scale-[1.02]">
                <Image
                  src="/brand/conit-logo.png"
                  alt="CONIT Support Desk"
                  width={200}
                  height={263}
                  className="h-auto w-40 object-contain sm:w-48"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Cifras ----------------------------------------------------------- */}
      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 sm:grid-cols-3 sm:px-8">
          {[
            { value: 7, suffix: '', label: 'Servicios bajo un mismo equipo' },
            { value: 24, suffix: ' h', label: 'Registro de incidencias disponible' },
            { value: 100, suffix: ' %', label: 'De los cambios quedan en el historial' },
          ].map((stat, index) => (
            <Reveal key={stat.label} from="up" delay={index * 0.1}>
              <div className="flex flex-col items-center gap-2 text-center">
                <Counter
                  to={stat.value}
                  suffix={stat.suffix}
                  className="text-4xl font-bold text-[#024A9D]"
                />
                <span className="max-w-[14rem] text-sm leading-relaxed text-slate-600">
                  {stat.label}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Principios ------------------------------------------------------- */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="Principios"
              title="Compromisos que se pueden comprobar"
              description="No son valores de pared: cada uno se traduce en algo que puedes verificar en tu propio historial."
              centered
            />
          </Reveal>

          <Stagger as="ul" className="mt-14 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map(({ title, description }, index) => (
              <StaggerItem
                key={title}
                as="li"
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#024A9D]/25 hover:shadow-[0_16px_48px_-24px_rgba(2,74,157,0.4)]"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 h-full w-1 origin-top scale-y-0 bg-gradient-to-b from-[#024A9D] to-[#F9AB38] transition-transform duration-500 group-hover:scale-y-100"
                />
                <span
                  aria-hidden="true"
                  className="tabular text-xs font-bold tracking-[0.2em] text-slate-300"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Diferenciales ---------------------------------------------------- */}
      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="En la practica"
              title="Que cambia para ti"
              centered
            />
          </Reveal>

          <Stagger as="ul" className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DIFFERENTIATORS.map(({ icon: Icon, title, description }) => (
              <StaggerItem
                key={title}
                as="li"
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#F9AB38]/12 text-[#B87A14]">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{description}</p>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal from="up" delay={0.15}>
            <div className="mt-14 flex justify-center">
              <Button asChild size="lg" className="group bg-[#024A9D] text-white hover:bg-[#013A7C]">
                <Link href="/contacto">
                  Hablar con nosotros
                  <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
