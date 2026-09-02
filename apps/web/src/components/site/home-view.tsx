import { Button } from '@conit/ui';
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Counter } from './counter';
import { Reveal, RevealRule, Stagger, StaggerItem } from './reveal';
import { DIFFERENTIATORS, FAQ, PROCESS, SERVICES } from './site-content';
import { SectionHeading } from './site-shell';

/** Cifra del encabezado. El valor numerico se anima al entrar en pantalla. */
function HeroStat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Counter
        to={value}
        {...(suffix ? { suffix } : {})}
        className="text-3xl font-semibold text-[#02224a] sm:text-4xl"
      />
      <span className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Portada del sitio publico.
 *
 * Componente de servidor: solo las piezas que necesitan movimiento o estado
 * (`Reveal`, `Counter`, la cabecera) se marcan como de cliente, de modo que al
 * navegador llega el minimo de JavaScript posible.
 */
export function HomeView() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Encabezado                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-white pt-36 pb-24 sm:pt-44 sm:pb-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-48 left-1/4 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[#024A9D] opacity-[0.08] blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-12rem] bottom-[-14rem] h-[28rem] w-[28rem] rounded-full bg-[#F9AB38] opacity-[0.16] blur-[130px]"
        />
        {/* Retícula tenue: da profundidad sin competir con el texto. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(2,34,74,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(2,34,74,0.045)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_70%)]"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col items-start gap-7">
            <Reveal from="up">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#024A9D]/15 bg-[#024A9D]/[0.05] px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-[#024A9D] uppercase">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#F9AB38]" />
                Soporte tecnico corporativo
              </span>
            </Reveal>

            <Reveal from="up" delay={0.08}>
              <h1 className="text-4xl leading-[1.08] font-bold tracking-tight text-balance text-[#02224a] sm:text-5xl lg:text-[3.5rem]">
                Tu tecnologia, atendida por{' '}
                <span className="relative whitespace-nowrap text-[#024A9D]">
                  quien la construyo
                  {/* Subrayado ambar: el color de marca donde no compromete la lectura. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-1 h-[0.28em] rounded-full bg-[#F9AB38]/45"
                  />
                </span>
              </h1>
            </Reveal>

            <Reveal from="up" delay={0.16}>
              <p className="max-w-xl text-lg leading-relaxed text-pretty text-slate-600">
                Desarrollamos y mantenemos sitios web, sistemas de gestion, aulas virtuales,
                hosting, dominios, correo corporativo y bases de datos. Cuando algo falla, no
                empiezas explicando tu infraestructura: ya la conocemos.
              </p>
            </Reveal>

            <Reveal from="up" delay={0.24}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="group bg-[#024A9D] text-white shadow-[0_12px_32px_-14px_rgba(2,74,157,0.9)] hover:bg-[#02224a]"
                >
                  <Link href="/login">
                    Acceder al area de soporte
                    <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-slate-300 bg-white text-[#02224a] hover:border-[#024A9D]/35 hover:bg-[#024A9D]/[0.04] hover:text-[#024A9D]"
                >
                  <Link href="/servicios">Ver servicios</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal from="up" delay={0.32} className="w-full">
              <dl className="mt-4 flex flex-wrap gap-x-14 gap-y-6 border-t border-slate-200 pt-8">
                <HeroStat value={7} label="Servicios" />
                <HeroStat value={24} suffix=" h" label="Registro de incidencias" />
                <HeroStat value={100} suffix=" %" label="Trazabilidad" />
              </dl>
            </Reveal>
          </div>

          <Reveal from="left" delay={0.2} className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Resplandor detras del logotipo. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full bg-[#F9AB38] opacity-25 blur-[90px]"
              />
              <div className="rounded-3xl border border-slate-200/80 bg-white p-10 shadow-[0_28px_70px_-40px_rgba(2,34,74,0.45)] transition-transform duration-500 hover:scale-[1.02] sm:p-12">
                <Image
                  src="/brand/conit-logo.png"
                  alt="CONIT Support Desk"
                  width={220}
                  height={289}
                  priority
                  className="h-auto w-40 object-contain sm:w-52"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Servicios                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="Que hacemos"
              title="Todo lo que sostiene la presencia digital de tu organizacion"
              description="Un unico interlocutor para el desarrollo y el mantenimiento. Sin derivaciones entre proveedores cuando algo deja de funcionar."
            />
          </Reveal>

          <Stagger
            as="ul"
            className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3"
          >
            {SERVICES.map(({ slug, icon: Icon, title, summary }) => (
              <StaggerItem key={slug} as="li" className="group relative bg-white">
                <Link
                  href={`/servicios#${slug}`}
                  className="flex h-full flex-col gap-3 p-7 transition-colors hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#024A9D]/8 text-[#024A9D] transition-all duration-300 group-hover:scale-110 group-hover:bg-[#024A9D] group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{summary}</p>
                  <ArrowUpRightIcon
                    aria-hidden="true"
                    className="mt-auto size-4 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#024A9D]"
                  />
                </Link>
              </StaggerItem>
            ))}

            <StaggerItem
              as="li"
              className="flex flex-col justify-center gap-3 bg-[#024A9D]/[0.04] p-7"
            >
              <h3 className="text-base font-semibold text-[#02224a]">Tienes una incidencia?</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Registrala y sigue su estado en todo momento.
              </p>
              <Link
                href="/login"
                className="group mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-semibold text-[#024A9D] hover:underline focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
              >
                Ir al area de soporte
                <ArrowRightIcon
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Diferenciales                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Reveal from="right">
              <SectionHeading
                eyebrow="Por que CONIT"
                title="La diferencia entre un proveedor y un equipo"
                description="Mantener lo que uno mismo ha construido cambia por completo el tiempo de respuesta."
              />
            </Reveal>

            <Stagger as="ul" className="grid gap-5 sm:grid-cols-2">
              {DIFFERENTIATORS.map(({ icon: Icon, title, description }) => (
                <StaggerItem
                  key={title}
                  as="li"
                  className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#024A9D]/25 hover:shadow-[0_12px_40px_-16px_rgba(2,74,157,0.35)]"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#F9AB38]/12 text-[#B87A14]">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{description}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Proceso                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading
              eyebrow="Como trabajamos"
              title="Soporte con registro, no con promesas"
              description="Cada incidencia deja rastro: quien la atendio, que se hizo y cuanto se tardo."
              centered
            />
          </Reveal>

          <Stagger as="ol" className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map(({ icon: Icon, title, description }, index) => (
              <StaggerItem
                key={title}
                as="li"
                className="group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_-20px_rgba(15,23,42,0.3)]"
              >
                <span
                  aria-hidden="true"
                  className="tabular absolute top-5 right-6 text-5xl font-bold text-slate-100 transition-colors duration-300 group-hover:text-[#024A9D]/10"
                >
                  {index + 1}
                </span>
                <span className="relative flex size-11 items-center justify-center rounded-xl bg-[#024A9D]/8 text-[#024A9D] transition-all duration-300 group-hover:bg-[#024A9D] group-hover:text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="relative text-base font-semibold text-slate-900">{title}</h3>
                <p className="relative text-sm leading-relaxed text-slate-600">{description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Preguntas frecuentes                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Reveal from="up">
            <SectionHeading eyebrow="Dudas habituales" title="Preguntas frecuentes" centered />
          </Reveal>

          <Stagger as="dl" className="mt-14 flex flex-col gap-4">
            {FAQ.map(({ question, answer }) => (
              <StaggerItem
                key={question}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors duration-300 hover:border-[#024A9D]/25"
              >
                <dt className="flex items-start gap-3 text-base font-semibold text-slate-900">
                  <CheckIcon
                    className="mt-0.5 size-4 shrink-0 text-[#024A9D]"
                    aria-hidden="true"
                  />
                  {question}
                </dt>
                <dd className="mt-2.5 pl-7 text-sm leading-relaxed text-slate-600">{answer}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Cierre                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F9AB38]/60 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[#024A9D] opacity-[0.07] blur-[110px]"
        />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <Reveal from="up">
            <h2 className="text-3xl font-bold tracking-tight text-balance text-[#02224a] sm:text-4xl">
              Empecemos por lo que necesitas resolver
            </h2>
          </Reveal>

          <Reveal from="up" delay={0.1}>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-slate-600">
              Si ya eres cliente, entra al area de soporte y registra tu incidencia. Si aun no lo
              eres, escribenos y estudiamos tu caso.
            </p>
          </Reveal>

          <Reveal from="up" delay={0.18}>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="group bg-[#024A9D] text-white shadow-[0_12px_32px_-14px_rgba(2,74,157,0.9)] hover:bg-[#02224a]"
              >
                <Link href="/login">
                  Area de soporte
                  <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-slate-300 bg-white text-[#02224a] hover:border-[#024A9D]/35 hover:bg-[#024A9D]/[0.04] hover:text-[#024A9D]"
              >
                <Link href="/contacto">Hablar con nosotros</Link>
              </Button>
            </div>
          </Reveal>

          <RevealRule className="mx-auto mt-16 max-w-xs bg-slate-200" />
        </div>
      </section>
    </>
  );
}
