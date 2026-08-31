'use client';

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@conit/ui';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { useIsHydrated } from '@/hooks/use-is-hydrated';

/**
 * Conmutador de tema claro / oscuro.
 *
 * El tema resuelto solo se conoce en el navegador; hasta que el componente se
 * hidrata se reserva el espacio con un boton deshabilitado del mismo tamano,
 * para no provocar un desajuste de hidratacion ni un salto de layout.
 */
export function ThemeToggle() {
  const isHydrated = useIsHydrated();
  const { resolvedTheme, setTheme } = useTheme();

  if (!isHydrated) {
    return <Button variant="ghost" size="icon-sm" disabled aria-hidden="true" />;
  }

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Activar tema claro' : 'Activar tema oscuro';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={label}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
