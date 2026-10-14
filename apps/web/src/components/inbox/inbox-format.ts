import type { InboxConversation } from '@conit/types';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

/** Numero tal como se muestra: Meta lo entrega sin el `+`. */
export function formatPhone(phone: string): string {
  return `+${phone}`;
}

/**
 * Nombre de la conversacion.
 *
 * Un numero que no pertenece a ningun cliente se muestra solo con el numero:
 * el nombre del perfil de WhatsApp lo elige el contacto y podria hacerse
 * pasar por quien no es.
 */
export function conversationTitle(conversation: Pick<InboxConversation, 'client' | 'phone'>): string {
  return conversation.client?.name ?? formatPhone(conversation.phone);
}

/** Hora si es de hoy; dia y mes si es anterior. */
export function shortTime(iso: string): string {
  const date = new Date(iso);

  return format(date, isToday(date) ? 'HH:mm' : 'd MMM', { locale: es });
}
