'use client';

import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';

/**
 * Indicador de avance de lectura.
 *
 * Una linea fina en el borde superior que crece con el desplazamiento. En
 * paginas largas da la referencia de cuanto queda; con movimiento reducido no
 * se muestra, porque es puramente decorativa.
 */
export function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // El muelle suaviza el salto que produce el desplazamiento por rueda.
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });

  if (reduced) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-60 h-0.5 origin-left bg-gradient-to-r from-[#024A9D] via-[#3B82F6] to-[#F9AB38]"
    />
  );
}
