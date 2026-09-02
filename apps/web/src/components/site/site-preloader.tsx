'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Tiempo minimo en pantalla, para que la marca no aparezca y desaparezca. */
const MIN_VISIBLE_MS = 1200;

/**
 * Espera maxima antes de rendirse.
 *
 * Si el video no llega —conexion lenta, formato no soportado, ahorro de
 * datos—, la web no puede quedarse bloqueada detras de una animacion. Pasado
 * este tiempo se entra igualmente y la descarga se cancela.
 */
const MAX_WAIT_MS = 8000;

/** Duracion del fundido de salida. Debe coincidir con la transicion del CSS. */
const FADE_MS = 700;

/** Marca de sesion: la presentacion se ve una vez, no en cada navegacion. */
const SEEN_KEY = 'conit:intro-visto';

/** Porcentaje que ocupa la descarga; el resto lo aporta la reproduccion. */
const DOWNLOAD_SHARE = 88;

const VIDEO_URL = '/conit.mp4';

type Phase = 'loading' | 'leaving' | 'done';

/** El valor no cambia durante la vida de la pagina: no hay a que suscribirse. */
const noopSubscribe = () => () => undefined;

/**
 * Decision, calculada una unica vez por carga de pagina.
 *
 * `useSyncExternalStore` exige que `getSnapshot` devuelva un valor estable: si
 * cambia entre renders, React vuelve a renderizar sin parar. Aqui ademas hay un
 * motivo concreto: la marca de sesion se escribe nada mas mostrar la intro, y
 * releer el almacenamiento en cada render haria que la cortina se desmontase a
 * si misma al instante siguiente de aparecer.
 */
let cachedDecision: boolean | null = null;

function computeShouldPlay(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  try {
    return window.sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    // Almacenamiento bloqueado (ventana privada, cookies restringidas): se
    // trata como si fuese la primera visita.
    return true;
  }
}

function readShouldPlay(): boolean {
  cachedDecision ??= computeShouldPlay();

  return cachedDecision;
}

/**
 * Decide si mostrar la presentacion.
 *
 * Se resuelve con `useSyncExternalStore` y no con un efecto porque la
 * respuesta depende de datos que solo existen en el navegador. Devolver
 * `false` como valor de servidor evita tanto la discordancia de hidratacion
 * como un parpadeo de la cortina en quien ya la vio.
 */
function useShouldPlayIntro(): boolean {
  return useSyncExternalStore(noopSubscribe, readShouldPlay, () => false);
}

/**
 * Presentacion de entrada.
 *
 * El video se descarga con `fetch` en lugar de dejarselo al elemento `<video>`
 * porque su atomo de metadatos (`moov`) esta al final del fichero: hasta que no
 * llega el ultimo byte, el navegador no conoce ni la duracion ni puede pintar
 * un fotograma. Descargandolo asi, la barra mide **bytes reales recibidos** —no
 * una animacion decorativa— y la reproduccion arranca ya fluida.
 *
 * Mientras tanto se muestra el logotipo, de modo que nunca hay una pantalla
 * vacia. Se ve una sola vez por sesion, se salta con Escape o con el boton, y
 * no aparece para quien pide movimiento reducido.
 */
export function SitePreloader() {
  const shouldPlay = useShouldPlayIntro();

  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const visible = shouldPlay && phase !== 'done';

  const finish = useCallback(() => {
    // Si se sale antes de tiempo, no tiene sentido seguir descargando.
    abortRef.current?.abort();

    setPhase((current) => {
      if (current !== 'loading') return current;

      // Se completa la barra antes de salir: cortarla al 80 % se lee como un
      // fallo aunque haya terminado bien.
      setProgress(100);

      const elapsed = Date.now() - startedAt.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

      window.setTimeout(() => {
        setPhase('leaving');
        window.setTimeout(() => setPhase('done'), FADE_MS);
      }, remaining);

      return 'loading';
    });
  }, []);

  // Se anota la marca de sesion al mostrarla, no al terminarla: quien recarga a
  // media intro tampoco deberia volver a verla.
  useEffect(() => {
    if (!shouldPlay) return;

    startedAt.current = Date.now();

    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Que no se pueda recordar no es motivo para no mostrarla ahora.
    }
  }, [shouldPlay]);

  /**
   * Descarga del video con progreso real.
   *
   * Se lee el cuerpo por partes para poder contar los bytes recibidos. Si el
   * servidor no declara `Content-Length` no hay total contra el que medir, asi
   * que la barra avanza de forma logaritmica hacia el tope de la descarga: sin
   * inventar un porcentaje exacto, pero sin quedarse clavada en cero.
   */
  useEffect(() => {
    if (!shouldPlay) return;

    const controller = new AbortController();
    abortRef.current = controller;

    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(VIDEO_URL, { signal: controller.signal });

        if (!response.ok || !response.body) throw new Error('respuesta no utilizable');

        const declared = Number(response.headers.get('Content-Length'));
        const total = Number.isFinite(declared) && declared > 0 ? declared : null;

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        for (;;) {
          const { done, value } = await reader.read();

          if (done) break;
          if (!value) continue;

          chunks.push(value);
          received += value.length;

          const ratio = total
            ? received / total
            : // Sin total conocido: se aproxima con una curva que se acerca al
              // tope sin alcanzarlo, tomando 4 MB como referencia.
              1 - Math.exp(-received / 4_000_000);

          setProgress((current) => Math.max(current, Math.min(DOWNLOAD_SHARE, ratio * DOWNLOAD_SHARE)));
        }

        if (cancelled) return;

        // Se unen las partes en un unico buffer contiguo. Ademas de dar a
        // `Blob` un origen de bytes inequivoco, evita retener decenas de
        // fragmentos sueltos en memoria.
        const merged = new Uint8Array(received);
        let offset = 0;

        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        objectUrl = URL.createObjectURL(new Blob([merged], { type: 'video/mp4' }));
        setVideoSrc(objectUrl);
        setProgress((current) => Math.max(current, DOWNLOAD_SHARE));
      } catch {
        // Descarga abortada o fallida: se entra al sitio sin la presentacion.
        if (!cancelled) finish();
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shouldPlay, finish]);

  // Reproduce en cuanto el fichero esta completo.
  useEffect(() => {
    if (!videoSrc) return;

    const video = videoRef.current;

    if (!video) return;

    // `play()` devuelve una promesa que se rechaza si el navegador bloquea la
    // reproduccion; en ese caso se sigue adelante en lugar de esperar en vano.
    void video.play().catch(finish);
  }, [videoSrc, finish]);

  // Salida de emergencia y atajo de teclado.
  useEffect(() => {
    if (!visible || phase !== 'loading') return;

    const timeout = window.setTimeout(finish, MAX_WAIT_MS);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, phase, finish]);

  if (!visible) return null;

  const isLeaving = phase === 'leaving';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando CONIT"
      // Fondo blanco, no azul: el video de marca tiene su propio fondo claro,
      // y sobre el azul corporativo se veria como un recuadro flotando en vez
      // de fundirse con la pantalla.
      className={`fixed inset-0 z-100 flex flex-col items-center justify-center bg-white transition-opacity duration-700 ease-out ${
        isLeaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex h-[46vh] max-h-[24rem] items-center justify-center">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            // `muted` y `playsInline` son imprescindibles: sin ambos, los
            // navegadores bloquean la reproduccion automatica.
            muted
            playsInline
            aria-hidden="true"
            className="max-h-full w-auto max-w-[86vw] object-contain"
            onTimeUpdate={() => {
              const video = videoRef.current;

              if (!video || !Number.isFinite(video.duration) || video.duration === 0) return;

              setProgress((current) =>
                Math.max(
                  current,
                  DOWNLOAD_SHARE + (video.currentTime / video.duration) * (100 - DOWNLOAD_SHARE),
                ),
              );
            }}
            onEnded={finish}
            onError={finish}
          />
        ) : (
          // Marca visible durante la descarga: nunca una pantalla en blanco.
          <Image
            src="/brand/conit-logo.png"
            alt=""
            width={150}
            height={197}
            priority
            className="h-auto w-28 animate-pulse object-contain sm:w-32"
          />
        )}
      </div>

      <div className="mt-10 flex w-64 flex-col items-center gap-3 sm:w-80">
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de carga"
        >
          <div
            className="h-full rounded-full bg-[#024A9D] transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="tabular text-[0.6875rem] font-medium tracking-[0.22em] text-slate-400 uppercase">
          Cargando · {Math.round(progress)}%
        </span>
      </div>

      <button
        type="button"
        onClick={finish}
        className="absolute right-6 bottom-6 rounded-md px-3 py-1.5 text-xs font-medium tracking-wide text-slate-400 transition-colors hover:text-slate-700 focus-visible:ring-[3px] focus-visible:ring-[#024A9D]/25 focus-visible:outline-none"
      >
        Saltar intro
      </button>
    </div>
  );
}
