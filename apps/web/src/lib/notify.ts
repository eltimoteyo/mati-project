import { toast } from 'sonner';

import { toErrorMessage } from './api-error';

interface NotifyOptions {
  description?: string;
  duration?: number;
}

/**
 * Sistema centralizado de avisos.
 *
 * Toda notificacion al usuario pasa por aqui: garantiza tono, duracion e
 * iconografia consistentes y evita el uso de `alert()` o de llamadas sueltas
 * a `toast` repartidas por los componentes.
 */
export const notify = {
  success(message: string, options?: NotifyOptions) {
    return toast.success(message, options);
  },

  error(message: string, options?: NotifyOptions) {
    return toast.error(message, { duration: 6_000, ...options });
  },

  warning(message: string, options?: NotifyOptions) {
    return toast.warning(message, options);
  },

  info(message: string, options?: NotifyOptions) {
    return toast.info(message, options);
  },

  /** Aviso persistente mientras dura una operacion. Devuelve su identificador. */
  loading(message: string, options?: NotifyOptions) {
    return toast.loading(message, options);
  },

  dismiss(id?: string | number) {
    toast.dismiss(id);
  },

  /**
   * Traduce cualquier excepcion a un aviso de error legible.
   * Se usa en los `onError` de TanStack Query y de los formularios.
   */
  fromError(error: unknown, fallback?: string) {
    return this.error(toErrorMessage(error, fallback));
  },
};
