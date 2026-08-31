'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Tema claro / oscuro.
 *
 * Usa la estrategia de clase (`.dark` en `<html>`), que es la que consumen
 * los tokens del design system. `next-themes` inyecta un script previo a la
 * hidratacion para aplicar el tema antes del primer pintado y evitar el
 * destello de tema incorrecto.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
