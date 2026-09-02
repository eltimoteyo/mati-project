import { Button } from '@conit/ui';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal, Stagger, StaggerItem } from '@/components/site/reveal';
import { SERVICES } from '@/components/site/site-content';
import { PageHero, SectionHeading } from '@/components/site/site-shell';

export const metadata: Metadata = {
  title: 'Servicios · CONIT',
  description:
    'Paginas web, sistemas de gestion, aulas virtuales, hosting, dominios, correo corporativo y ' +
    'bases de datos. Desarrollo y mantenimiento con un unico interlocutor.',
  robots: { index: true, follow: true },
};

export default function ServiciosPage() {
  return (
    <>
      <PageHero
        eyebrow="Servicios"
        title="Desarrollo y mantenimiento, bajo un mismo techo"
        description="Cada servicio incluye su puesta en marcha y su soporte posterior. No entregamos y desaparecemos."
      />

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto flex max-w-5xl flex-col gap-20 px-5 sm:px-8">
          {SERVICES.map(({ slug, icon: Icon, title, summary, includes }, index) => (
            <article
              key={slug}
              id={slug}
              className="scroll-mt-24 border-b border-slate-200 pb-20 last:border-0 last:pb-0"
            >
              <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
                <Reveal from={index % 2 === 0 ? 'right' : 'left'}>
                  <div className="flex flex-col gap-4">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-[#024A9D]/8 text-[#024A9D]">
                      <Icon className="size-5.5" aria-hidden="true" />
                    </span>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {title}
                    </h2>
                    <p className="text-base leading-relaxed text-pretty text-slate-600">
                      {summary}
                    </p>
                  </div>
                </Reveal>

                <Stagger as="ul" className="flex flex-col gap-3.5">
                  {includes.map((item) => (
                    <StaggerItem
                      key={item}
                      as="li"
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4 transition-colors duration-300 hover:border-[#024A9D]/25 hover:bg-white"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#024A9D] text-white">
                        <CheckIcon className="size-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className="text-sm leading-relaxed text-slate-700">{item}</span>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="Siguiente paso"
              title="No sabes por donde empezar?"
              description="Cuentanos que tienes y que te falla. Revisamos tu situacion y te decimos con claridad que conviene hacer."
              centered
            />
          </Reveal>

          <Reveal from="up" delay={0.12}>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="group bg-[#024A9D] text-white hover:bg-[#013A7C]">
                <Link href="/contacto">
                  Hablar con nosotros
                  <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline">
                <Link href="/soporte">Como funciona el soporte</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
