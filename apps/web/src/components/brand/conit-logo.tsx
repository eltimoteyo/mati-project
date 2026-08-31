import { cn } from '@conit/ui';
import Image from 'next/image';

/** Tamanos del isotipo, en pixeles, alineados con la altura de las cabeceras. */
const MARK_PX = {
  sm: 28,
  md: 34,
  lg: 44,
} as const;

const WORDMARK_TEXT = {
  sm: 'text-[0.875rem]',
  md: 'text-[0.9375rem]',
  lg: 'text-lg',
} as const;

const TAGLINE_TEXT = {
  sm: 'text-[0.5rem]',
  md: 'text-[0.5625rem]',
  lg: 'text-[0.625rem]',
} as const;

type LogoSize = keyof typeof MARK_PX;

export interface ConitMarkProps {
  size?: LogoSize;
  className?: string;
  /** Marca la imagen como prioritaria (util en la pantalla de acceso). */
  priority?: boolean;
}

/**
 * Isotipo oficial de CONIT Support Desk.
 *
 * Se usa el archivo de marca real en lugar de una reconstruccion vectorial:
 * la forma tiene solapes y matices que una aproximacion en SVG falsearia.
 * El `alt` esta vacio a proposito, porque el nombre siempre acompana al
 * simbolo en `ConitLogo` y anunciarlo dos veces molesta con lector de pantalla.
 */
export function ConitMark({ size = 'md', className, priority = false }: ConitMarkProps) {
  const px = MARK_PX[size];

  return (
    <Image
      src="/brand/conit-mark.png"
      alt=""
      width={px}
      height={px}
      priority={priority}
      className={cn('shrink-0 object-contain', className)}
      style={{ width: px, height: px }}
    />
  );
}

export interface ConitLogoProps {
  size?: LogoSize;
  /** Oculta el texto y deja solo el isotipo. */
  markOnly?: boolean;
  /** `inverted` para fondos oscuros de marca. */
  tone?: 'default' | 'inverted';
  className?: string;
  priority?: boolean;
}

/**
 * Logotipo completo: isotipo + nombre.
 *
 * El texto se compone en HTML (no como imagen) para que se mantenga nitido en
 * cualquier tamano, se adapte al tema y sea legible por lectores de pantalla.
 * La particion cromatica CON / IT reproduce la del logotipo original.
 */
export function ConitLogo({
  size = 'md',
  markOnly = false,
  tone = 'default',
  className,
  priority = false,
}: ConitLogoProps) {
  const inverted = tone === 'inverted';

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <ConitMark size={size} priority={priority} />

      {markOnly ? (
        <span className="sr-only">CONIT Support Desk</span>
      ) : (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-bold tracking-[-0.005em]',
              WORDMARK_TEXT[size],
              inverted ? 'text-white' : 'text-brand-700 dark:text-brand-300',
            )}
          >
            CON<span className={inverted ? 'text-gold-400' : 'text-gold-600'}>IT</span>
          </span>
          <span
            className={cn(
              'mt-1 font-medium tracking-[0.16em] uppercase',
              TAGLINE_TEXT[size],
              inverted ? 'text-white/55' : 'text-muted-foreground',
            )}
          >
            Support Desk
          </span>
        </span>
      )}
    </span>
  );
}
