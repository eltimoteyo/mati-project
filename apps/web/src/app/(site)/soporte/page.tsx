import { Button } from '@conit/ui';
import { AlertTriangleIcon, ArrowRightIcon, CircleDotIcon, FlagIcon, ZapIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal, Stagger, StaggerItem } from '@/components/site/reveal';
import { FAQ, PROCESS } from '@/components/site/site-content';
import { PageHero, SectionHeading } from '@/components/site/site-shell';

export const metadata: Metadata = {
  title: 'Soporte · CONIT',
  description:
    'Como se registra, prioriza y resuelve una incidencia en CONIT: codigo unico, tiempos ' +
    'objetivo por categoria e historial completo de cada cambio.',
  robots: { index: true, follow: true },
};

/**
 * Niveles de prioridad, con el mismo criterio que aplica el sistema interno.
 *
 * Publicarlos es deliberado: el cliente puede comprobar si su incidencia se
 * esta tratando con la prioridad que le corresponde.
 */
const PRIORITIES = [
  {
    icon: AlertTriangleIcon,
    label: 'Critica',
    color: 'text-red-600 bg-red-50 border-red-100',
    description: 'Servicio caido o datos en riesgo. Afecta a todos los usuarios.',
  },
  {
    icon: ZapIcon,
    label: 'Alta',
    color: 'text-orange-600 bg-orange-50 border-orange-100',
    description: 'Una funcion importante esta rota y bloquea el trabajo diario.',
  },
  {
    icon: FlagIcon,
    label: 'Media',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    description: 'Problema acotado, o con una via alternativa mientras se resuelve.',
  },
  {
    icon: CircleDotIcon,
    label: 'Baja',
    color: 'text-slate-600 bg-slate-100 border-slate-200',
    description: 'Consulta, mejora o detalle visual sin impacto en el servicio.',
  },
] as const;

export default function SoportePage() {
  return (
    <>
      <PageHero
        eyebrow="Soporte"
        title="Cada incidencia, con nombre y apellidos"
        description="Un codigo unico, un responsable concreto y un historial que puedes consultar. Asi se atiende en CONIT."
      >
        <Button asChild size="lg" className="group mt-2 bg-[#024A9D] text-white shadow-[0_12px_32px_-14px_rgba(2,74,157,0.9)] hover:bg-[#02224a]">
          <Link href="/login">
            Registrar una incidencia
            <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Button>
      </PageHero>

      {/* Proceso ---------------------------------------------------------- */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="El recorrido"
              title="De la llamada al cierre, sin huecos"
              description="Ningun paso depende de que alguien se acuerde: el sistema lo registra."
            />
          </Reveal>

          <Stagger as="ol" className="mt-14 flex flex-col gap-4">
            {PROCESS.map(({ icon: Icon, title, description }, index) => (
              <StaggerItem
                key={title}
                as="li"
                className="group flex items-start gap-5 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-[#024A9D]/25 hover:shadow-[0_14px_44px_-22px_rgba(2,74,157,0.4)] sm:p-7"
              >
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#024A9D]/8 text-[#024A9D] transition-all duration-300 group-hover:bg-[#024A9D] group-hover:text-white">
                  <Icon className="size-5" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className="tabular absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-[#F9AB38] text-[0.625rem] font-bold text-[#02224a]"
                  >
                    {index + 1}
                  </span>
                </span>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{description}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Prioridades ------------------------------------------------------ */}
      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="Prioridades"
              title="Que se considera urgente, y que no"
              description="Publicamos el criterio para que puedas comprobar si tu incidencia se esta tratando como corresponde."
              centered
            />
          </Reveal>

          <Stagger as="ul" className="mt-14 grid gap-5 sm:grid-cols-2">
            {PRIORITIES.map(({ icon: Icon, label, color, description }) => (
              <StaggerItem
                key={label}
                as="li"
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <span
                  className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${color}`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </span>
                <p className="text-sm leading-relaxed text-slate-600">{description}</p>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal from="up" delay={0.1}>
            <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
              Cada categoria de incidencia lleva asociados sus propios tiempos objetivo de primera
              respuesta y de resolucion. El sistema mide el cumplimiento real frente a ese objetivo,
              no frente a una estimacion.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Preguntas -------------------------------------------------------- */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading eyebrow="Dudas habituales" title="Preguntas frecuentes" centered />
          </Reveal>

          <Stagger as="dl" className="mt-14 flex flex-col gap-4">
            {FAQ.map(({ question, answer }) => (
              <StaggerItem
                key={question}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition-colors duration-300 hover:border-[#024A9D]/25 hover:bg-white"
              >
                <dt className="text-base font-semibold text-slate-900">{question}</dt>
                <dd className="mt-2.5 text-sm leading-relaxed text-slate-600">{answer}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </>
  );
}
