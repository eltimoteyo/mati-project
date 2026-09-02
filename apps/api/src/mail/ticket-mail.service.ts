import {
  formatTicketCode,
  SERVICE_TYPE_LABELS,
  type ServiceType,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { LOGO_CONTENT_ID, MailService, type SendEmailResult } from './mail.service';
import {
  renderTicketEmail,
  renderTicketEmailText,
  type TicketEmailData,
  type TicketEmailRow,
} from './templates/ticket-email.template';

/** Datos del ticket que necesita cualquiera de los correos. */
const TICKET_SELECT = {
  id: true,
  number: true,
  subject: true,
  description: true,
  status: true,
  priority: true,
  createdAt: true,
  resolvedAt: true,
  client: { select: { name: true, email: true } },
  project: { select: { name: true, type: true } },
  category: { select: { name: true } },
  assignee: { select: { name: true } },
} as const;

type TicketForEmail = {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: Date;
  resolvedAt: Date | null;
  client: { name: string; email: string | null };
  project: { name: string; type: string } | null;
  category: { name: string } | null;
  assignee: { name: string } | null;
};

/**
 * Correos que recibe el cliente sobre su ticket.
 *
 * Se envian tres, y solo tres: acuse de recibo, respuesta publica de soporte y
 * aviso de resolucion. Las notas internas nunca salen por correo —el cliente
 * no las ve en el panel, tampoco debe verlas en su bandeja— y los cambios de
 * estado intermedios no generan mensaje para no convertir el buzon del cliente
 * en un registro de auditoria.
 */
@Injectable()
export class TicketMailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /** Acuse de recibo al registrar la incidencia. */
  async sendTicketCreated(ticketId: string): Promise<SendEmailResult> {
    const ticket = await this.load(ticketId);
    const code = formatTicketCode(ticket.number);

    return this.dispatch(ticket, {
      subject: `${code} · Hemos recibido tu incidencia`,
      data: {
        heading: 'Hemos recibido tu incidencia',
        intro:
          `Gracias por avisarnos. Tu solicitud queda registrada con el codigo ${code}; ` +
          'guardalo para futuras referencias. Nuestro equipo la revisara y te escribira por aqui.',
        highlight: { title: 'Lo que nos has contado', body: ticket.description },
        footerNote:
          'Si necesitas anadir informacion, responde a este correo indicando el codigo del ticket.',
      },
    });
  }

  /** Respuesta publica de soporte. Las notas internas no llegan aqui. */
  async sendTicketReply(ticketId: string, body: string, authorName: string | null): Promise<SendEmailResult> {
    const ticket = await this.load(ticketId);
    const code = formatTicketCode(ticket.number);

    return this.dispatch(ticket, {
      subject: `${code} · Nueva respuesta de soporte`,
      data: {
        heading: 'Tienes una respuesta de soporte',
        intro: `${authorName ?? 'El equipo de soporte'} ha respondido a tu incidencia.`,
        highlight: { title: 'Respuesta de soporte', body },
        footerNote: 'Puedes responder a este correo si necesitas aclarar algo.',
      },
    });
  }

  /** Aviso de resolucion. */
  async sendTicketResolved(ticketId: string): Promise<SendEmailResult> {
    const ticket = await this.load(ticketId);
    const code = formatTicketCode(ticket.number);

    return this.dispatch(ticket, {
      subject: `${code} · Tu incidencia esta resuelta`,
      data: {
        heading: 'Tu incidencia esta resuelta',
        intro:
          'Hemos dado por resuelta la incidencia. Si el problema vuelve a aparecer, ' +
          'respondenos a este correo y la reabrimos sin que tengas que empezar de cero.',
        highlight: null,
        footerNote: 'Gracias por tu paciencia mientras lo revisabamos.',
      },
    });
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  private async load(ticketId: string): Promise<TicketForEmail> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: TICKET_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    return ticket as TicketForEmail;
  }

  /**
   * Compone y envia.
   *
   * Un cliente sin correo registrado no es un error: hay clientes que se dan de
   * alta solo con telefono. Se omite el envio y se dice por que.
   */
  private async dispatch(
    ticket: TicketForEmail,
    options: {
      subject: string;
      data: Pick<TicketEmailData, 'heading' | 'intro' | 'highlight' | 'footerNote'>;
    },
  ): Promise<SendEmailResult> {
    if (!ticket.client.email) {
      return { sent: false, reason: 'El cliente no tiene correo registrado' };
    }

    if (!this.mailService.isEnabled()) {
      return { sent: false, reason: 'El envio de correo no esta configurado' };
    }

    const code = formatTicketCode(ticket.number);

    const data: TicketEmailData = {
      ...options.data,
      ticketCode: code,
      subject: ticket.subject,
      statusKey: ticket.status,
      statusLabel: TICKET_STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status,
      priorityKey: ticket.priority,
      priorityLabel: TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority] ?? ticket.priority,
      rows: this.buildRows(ticket),
      // El enlace apunta al panel, que hoy es solo para el equipo. Se incluye
      // unicamente cuando la URL es publica: un `localhost` en el correo de un
      // cliente no lleva a ninguna parte.
      action: this.buildAction(code),
      logoSrc: this.resolveLogoSrc(),
    };

    return this.mailService.send({
      to: ticket.client.email,
      subject: options.subject,
      html: renderTicketEmail(data),
      text: renderTicketEmailText(data),
      // Solo se adjunta cuando la plantilla va a referenciar el `cid`; si hay
      // URL publica configurada, el correo pesa menos sin el adjunto.
      embedLogo: !this.mailService.logoUrl,
    });
  }

  /**
   * Origen del logo.
   *
   * Se prefiere la URL publica si esta configurada, porque evita adjuntar
   * 120 KB en cada correo. Sin ella se incrusta el fichero, que es lo unico
   * que funciona cuando la aplicacion todavia no esta publicada.
   */
  private resolveLogoSrc(): string | undefined {
    if (this.mailService.logoUrl) return this.mailService.logoUrl;

    return this.mailService.canEmbedLogo ? `cid:${LOGO_CONTENT_ID}` : undefined;
  }

  private buildRows(ticket: TicketForEmail): TicketEmailRow[] {
    const rows: TicketEmailRow[] = [
      { label: 'Cliente', value: ticket.client.name },
      { label: 'Registrado el', value: this.formatDate(ticket.createdAt) },
    ];

    if (ticket.project) {
      const type = SERVICE_TYPE_LABELS[ticket.project.type as ServiceType];

      rows.splice(1, 0, {
        label: 'Servicio afectado',
        value: type ? `${ticket.project.name} (${type})` : ticket.project.name,
      });
    }

    if (ticket.category) {
      rows.push({ label: 'Categoria', value: ticket.category.name });
    }

    if (ticket.assignee) {
      rows.push({ label: 'Responsable', value: ticket.assignee.name });
    }

    if (ticket.resolvedAt) {
      rows.push({ label: 'Resuelto el', value: this.formatDate(ticket.resolvedAt) });
    }

    return rows;
  }

  /** Solo se enlaza si la URL es alcanzable desde fuera. */
  private buildAction(code: string): TicketEmailData['action'] {
    const appUrl = this.mailService.appUrl;

    if (!appUrl.startsWith('https://')) return null;

    return { label: 'Ver el ticket', url: `${appUrl}/admin/tickets/${code}` };
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Lima',
    }).format(date);
  }
}
