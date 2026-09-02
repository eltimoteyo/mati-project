'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/** Prefijos de las rutas privadas, donde el tema si es elegible. */
const THEMED_PREFIXES = ['/admin', '/portal', '/login'];

/**
 * Tema claro / oscuro.
 *
 * Usa la estrategia de clase (`.dark` en `<html>`), que es la que consumen
 * los tokens del design system. `next-themes` inyecta un script previo a la
 * hidratacion para aplicar el tema antes del primer pintado y evitar el
 * destello de tema incorrecto.
 *
 * El sitio publico esta disenado en blanco y no ofrece conmutador, asi que
 * solo fuera de las areas privadas se fuerza el tema claro con `forcedTheme`. Se hace aqui, en el
 * unico proveedor, y no anidando otro en el layout del sitio: `next-themes`
 * ignora los proveedores anidados cuando ya existe un contexto, de modo que
 * el anidado no tendria ningun efecto. `forcedTheme` no toca la preferencia
 * guardada: al volver al panel, el tema elegido sigue intacto.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();
  const isThemed = THEMED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...(isThemed ? {} : { forcedTheme: 'light' })}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
