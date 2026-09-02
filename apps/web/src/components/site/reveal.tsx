'use client';

import { cn } from '@conit/ui';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Animaciones de aparicion al desplazar.
 *
 * Todo el movimiento del sitio pasa por aqui, por dos motivos: para que el
 * ritmo sea el mismo en todas las secciones, y para que la comprobacion de
 * `prefers-reduced-motion` exista en un unico lugar. Cuando esa preferencia
 * esta activa no se atenua la animacion: se elimina, y el contenido aparece ya
 * colocado.
 *
 * La deteccion se hace con un `IntersectionObserver` propio y no con el
 * `whileInView` de la libreria de animacion. El motivo es concreto: al llegar
 * a la pagina por un enlace con ancla (`/servicios#hosting`) o al restaurar el
 * navegador la posicion tras recargar, el contenido que queda por encima nunca
 * llegaba a mostrarse y dejaba huecos en blanco permanentes. Aqui el
 * observador solo se desconecta cuando el elemento ha entrado de verdad.
 */

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none';

/** Desplazamiento inicial de cada direccion, en pixeles. */
const OFFSETS: Record<RevealDirection, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 32, y: 0 },
  right: { x: -32, y: 0 },
  none: { x: 0, y: 0 },
};

/** Curva de salida suave: entra rapido y se asienta despacio. */
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Disponibilidad de `IntersectionObserver`, evaluada una sola vez.
 *
 * En el servidor se asume que si esta: asi el HTML sale con el contenido
 * oculto y la animacion puede ocurrir. En un navegador que no lo soporte el
 * contenido se muestra de inmediato, sin animacion: mas vale verlo quieto que
 * no verlo.
 */
const SUPPORTS_OBSERVER =
  typeof window === 'undefined' || typeof IntersectionObserver !== 'undefined';

/**
 * Indica si el elemento ha llegado a estar a la vista alguna vez.
 *
 * Una vez visible ya no vuelve a ocultarse: repetir la animacion en cada
 * pasada marea y estorba al releer.
 *
 * Si el navegador no soporta `IntersectionObserver`, devuelve `true` de
 * entrada: mas vale mostrar el contenido sin animacion que no mostrarlo.
 */
function useRevealed(ref: React.RefObject<HTMLElement | null>, amount: number): boolean {
  const [revealed, setRevealed] = useState(!SUPPORTS_OBSERVER);

  useEffect(() => {
    const element = ref.current;

    if (!element || !SUPPORTS_OBSERVER) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          setRevealed(true);
          // Solo se deja de observar cuando ya ha entrado, nunca antes.
          observer.disconnect();
        }
      },
      // Un elemento mas alto que la ventana jamas alcanzaria un umbral alto:
      // se acota para que siga siendo alcanzable.
      { threshold: Math.min(amount, 0.5) },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, amount]);

  return revealed;
}

interface RevealProps {
  children: ReactNode;
  /** Direccion desde la que entra el contenido. */
  from?: RevealDirection;
  /** Retardo en segundos, para escalonar elementos hermanos. */
  delay?: number;
  duration?: number;
  className?: string;
  /** Etiqueta HTML resultante. Util para no romper listas ni secciones. */
  as?: ElementType;
  /** Proporcion del elemento que debe verse para disparar la animacion. */
  amount?: number;
}

export function Reveal({
  children,
  from = 'up',
  delay = 0,
  duration = 0.62,
  className,
  as = 'div',
  amount = 0.25,
}: RevealProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(ref, amount);
  const MotionTag = motion[as as 'div'] ?? motion.div;

  if (reduced) {
    const Tag = as;

    return <Tag className={className}>{children}</Tag>;
  }

  const offset = OFFSETS[from];

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={revealed ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/** Variantes para escalonar hijos sin calcular retardos a mano. */
const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

interface StaggerProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * Contenedor que hace aparecer a sus hijos en cascada.
 *
 * Cada hijo debe envolverse en `StaggerItem`. Se prefiere a un `Reveal` con
 * retardo calculado porque el escalonado se mantiene aunque cambie el numero
 * de elementos.
 */
export function Stagger({ children, className, as = 'div' }: StaggerProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(ref, 0.15);
  const MotionTag = motion[as as 'div'] ?? motion.div;

  if (reduced) {
    const Tag = as;

    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={revealed ? 'visible' : 'hidden'}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as as 'div'] ?? motion.div;

  if (reduced) {
    const Tag = as;

    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag className={className} variants={itemVariants}>
      {children}
    </MotionTag>
  );
}

/**
 * Linea que se dibuja al entrar en pantalla.
 *
 * Detalle de acabado que separa secciones sin recurrir a otro borde estatico.
 */
export function RevealRule({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(ref, 0.5);

  if (reduced) {
    return <div className={cn('h-px w-full bg-slate-200', className)} />;
  }

  return (
    <motion.div
      ref={ref}
      className={cn('h-px w-full origin-left bg-slate-200', className)}
      initial={{ scaleX: 0 }}
      animate={revealed ? { scaleX: 1 } : undefined}
      transition={{ duration: 0.9, ease: EASE }}
    />
  );
}
