'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface CounterProps {
  to: number;
  /** Texto que acompana a la cifra, por ejemplo "%" o "h". */
  suffix?: string;
  duration?: number;
  className?: string;
}

/**
 * Cifra que cuenta hasta su valor al entrar en pantalla.
 *
 * El valor real viaja siempre en el `aria-label`, asi que quien use lector de
 * pantalla oye el dato y no una cuenta atras. Con movimiento reducido no se
 * anima nada: la cifra sale directamente en su valor final.
 */
export function Counter({ to, suffix = '', duration = 1.4, className }: CounterProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;

    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      // La actualizacion llega desde la animacion, no del cuerpo del efecto.
      onUpdate: (latest) => setAnimated(Math.round(latest)),
    });

    return () => controls.stop();
  }, [inView, to, duration, reduced]);

  const display = reduced ? to : animated;

  return (
    <span ref={ref} className={className} aria-label={`${to}${suffix}`}>
      <span aria-hidden="true">
        {display}
        {suffix}
      </span>
    </span>
  );
}
