'use client';

import { useSyncExternalStore } from 'react';

/** El valor nunca cambia tras la hidratacion, asi que no hay a que suscribirse. */
const subscribe = () => () => {};

/**
 * Indica si el componente ya se hidrato en el navegador.
 *
 * Es la alternativa correcta al patron `useState(false)` + `useEffect`: al
 * apoyarse en `useSyncExternalStore`, React sabe que el valor del servidor es
 * `false` y el del cliente `true`, y no se produce ni un render en cascada ni
 * un aviso de desajuste de hidratacion.
 *
 * Se usa en componentes cuyo aspecto depende de informacion que solo existe en
 * el navegador (tema resuelto, preferencias del sistema, `window`).
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
