'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

/**
 * Interruptor de activado/desactivado.
 *
 * Se usa para ajustes que se aplican al momento; cuando el cambio necesita
 * confirmarse con un boton de guardar, la casilla de verificacion comunica
 * mejor que la decision aun no ha surtido efecto.
 */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent',
        'transition-colors duration-200 outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/22',
        'data-[state=unchecked]:bg-input data-[state=checked]:bg-primary',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-card shadow-subtle ring-0',
          'transition-transform duration-200',
          'data-[state=unchecked]:translate-x-0.5 data-[state=checked]:translate-x-[1.125rem]',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
