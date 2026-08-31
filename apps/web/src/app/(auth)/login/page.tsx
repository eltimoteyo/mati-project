import { CheckIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';
import { ConitLogo } from '@/components/brand/conit-logo';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Iniciar sesion',
  description: 'Accede al panel de soporte tecnico de CONIT.',
};

/** Servicios de CONIT mostrados en el panel de marca. */
const SERVICES = [
  'Paginas y sistemas web',
  'Aulas virtuales',
  'Hosting y dominios',
  'Correos corporativos',
  'Bases de datos',
];

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // El destino llega en la URL; `LoginForm` lo depura antes de navegar.
  const { from } = await searchParams;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* ---------------------------------------------------------------- */}
      {/* Panel de marca — solo escritorio                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden="true" className="pattern-grid absolute inset-0 text-white/[0.045]" />

        <ConitLogo size="lg" tone="inverted" className="relative" />

        <div className="relative flex max-w-lg flex-col gap-7">
          <h2 className="text-3xl leading-[1.2] font-semibold tracking-[-0.025em] text-white xl:text-[2.5rem]">
            Soporte tecnico centralizado para toda tu infraestructura.
          </h2>

          <p className="text-[0.9375rem] leading-relaxed text-white/65">
            Registra incidencias, sigue su estado en tiempo real y manten una unica conversacion con
            el equipo tecnico de CONIT.
          </p>

          <ul className="flex flex-col gap-3 pt-1">
            {SERVICES.map((service) => (
              <li key={service} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <CheckIcon className="size-3 text-white" strokeWidth={3} />
                </span>
                {service}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} {siteConfig.company}. Todos los derechos reservados.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Formulario                                                        */}
      {/* ---------------------------------------------------------------- */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-9 flex flex-col gap-6">
            <ConitLogo size="md" priority className="lg:hidden" />

            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">Bienvenido nuevamente</h1>
              <p className="text-sm text-muted-foreground">
                Ingresa tus credenciales para acceder al panel de soporte.
              </p>
            </div>
          </div>

          <LoginForm redirectTo={from} />

          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            El acceso es exclusivo para personal y clientes autorizados de CONIT.
            <br />
            Si no puedes ingresar, contacta con el administrador del sistema.
          </p>
        </div>
      </main>
    </div>
  );
}
