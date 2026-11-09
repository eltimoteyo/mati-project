import type { WhatsappMessageStatus } from '@conit/types';
import { Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { SettingsService } from '../settings/settings.service';

/** Espera antes de responder cuando no hay ajustes (pruebas y scripts). */
const DEFAULT_REPLY_DELAY_MS = 6000;

/** Digitos minimos de un telefono de ficha para compararlo con un numero de WhatsApp. */

/**
 * Orden de los estados de entrega.
 *
 * Meta puede entregar los avisos desordenados; un "entregado" que llega
 * despues de un "leido" no debe hacer retroceder al mensaje.
 */
const STATUS_RANK: Record<WhatsappMessageStatus, number> = {
  RECEIVED: 0,
  ACCEPTED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  FAILED: 5,
};

/** Mensaje del contacto, ya interpretado desde el webhook. */
export interface InboundWhatsappMessage {
  /** Identificador de Meta (`wamid`). */
  externalId: string;
  /** Numero del contacto: solo digitos, con codigo de pais. */
  phone: string;
  profileName: string | null;
  type: string;
  body: string;
  sentAt: Date;
  mediaId?: string;
  mimeType?: string;
}

/** Mensaje que Meta ya acepto para enviar. */
export interface OutboundWhatsappMessage {
  phone: string;
  externalId: string | null;
  type: string;
  body: string;
  /** Quien respondio desde la bandeja; se omite en los avisos automaticos. */
  authorId?: string | null;
  /** Lo escribio la respuesta automatica de IA. */
  aiGenerated?: boolean;
  /** Que hizo la IA: reply, troubleshoot, escalate, follow_up o hold. */
  aiAction?: string;
}

/** Cambio de estado de un mensaje enviado, segun Meta. */
export interface WhatsappStatusUpdate {
  externalId: string;
  status: Extract<WhatsappMessageStatus, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>;
  error: string | null;
}

/** Autor incluido al devolver un mensaje registrado. */
export const WHATSAPP_MESSAGE_RELATIONS = {
  author: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

/**
 * Registro de las conversaciones de WhatsApp.
 *
 * Es la unica pieza que escribe en la bandeja, la usen el webhook, las
 * respuestas del equipo o los avisos de tickets: asi una conversacion se ve
 * completa, con todo lo que el contacto recibio y no solo con lo que escribio.
 */
@Injectable()
export class WhatsappConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly settings?: SettingsService,
  ) {}

  /**
   * Registra un mensaje del contacto y devuelve su conversacion.
   *
   * Devuelve `null` si ya estaba registrado: Meta reintenta los webhooks y el
   * mismo mensaje puede llegar varias veces.
   */
  async recordInbound(message: InboundWhatsappMessage): Promise<string | null> {
    const duplicate = await this.prisma.whatsappMessage.findUnique({
      where: { externalId: message.externalId },
      select: { id: true },
    });

    if (duplicate) return null;

    const conversation = await this.ensureConversation(message.phone);
    const delayMs = this.settings
      ? (await this.settings.getAiLimits()).replyDelaySeconds * 1000
      : DEFAULT_REPLY_DELAY_MS;

    // Los webhooks pueden llegar desordenados: la ventana la abre el mensaje
    // mas reciente, no el ultimo en llegar.
    const lastInboundAt =
      conversation.lastInboundAt && conversation.lastInboundAt > message.sentAt
        ? conversation.lastInboundAt
        : message.sentAt;
    const lastMessageAt =
      conversation.lastMessageAt > message.sentAt ? conversation.lastMessageAt : message.sentAt;

    try {
      await this.prisma.$transaction([
        this.prisma.whatsappMessage.create({
          data: {
            conversationId: conversation.id,
            externalId: message.externalId,
            direction: 'INBOUND',
            type: message.type,
            body: message.body,
            status: 'RECEIVED',
            createdAt: message.sentAt,
            mediaId: message.mediaId,
            mimeType: message.mimeType,
            mediaProcessed: !message.mediaId,
          },
        }),
        this.prisma.whatsappConversation.update({
          where: { id: conversation.id },
          data: {
            lastInboundAt,
            lastMessageAt,
            unreadCount: { increment: 1 },
            ...(message.profileName ? { profileName: message.profileName.slice(0, 120) } : {}),
          },
        }),
        this.prisma.autoReplyJob.upsert({
          where: { conversationId: conversation.id },
          create: { conversationId: conversation.id, runAt: new Date(Date.now() + delayMs) },
          update: { runAt: new Date(Date.now() + delayMs), version: { increment: 1 }, attempts: 0 },
        }),
      ]);
    } catch (error) {
      // Dos entregas simultaneas del mismo mensaje: la segunda choca con el
      // indice unico, y eso es justo lo que se queria evitar.
      if (isUniqueViolation(error)) return null;

      throw error;
    }

    return conversation.id;
  }

  /** Registra un mensaje enviado al contacto y lo devuelve con su autor. */
  async recordOutbound(message: OutboundWhatsappMessage) {
    const conversation = await this.ensureConversation(message.phone);
    const now = new Date();

    const [created] = await this.prisma.$transaction([
      this.prisma.whatsappMessage.create({
        data: {
          conversationId: conversation.id,
          externalId: message.externalId,
          direction: 'OUTBOUND',
          type: message.type,
          body: message.body,
          status: 'ACCEPTED',
          authorId: message.authorId ?? null,
          aiGenerated: message.aiGenerated ?? false,
          aiAction: message.aiAction ?? null,
          createdAt: now,
        },
        include: WHATSAPP_MESSAGE_RELATIONS,
      }),
      this.prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: now },
      }),
    ]);

    return created;
  }

  /** Aparta la respuesta automatica de la conversacion hasta la fecha dada; `null` la reanuda. */
  async pauseAi(conversationId: string, until: Date | null): Promise<void> {
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { aiPausedUntil: until },
    });
  }

  /** Aplica un aviso de entrega de Meta a un mensaje enviado desde aqui. */
  async updateStatus(update: WhatsappStatusUpdate): Promise<void> {
    const message = await this.prisma.whatsappMessage.findUnique({
      where: { externalId: update.externalId },
      select: { id: true, status: true },
    });

    // Un aviso de un mensaje que no se envio desde aqui (otra herramienta con
    // el mismo numero) no tiene nada que actualizar.
    if (!message) return;

    if (STATUS_RANK[update.status] <= STATUS_RANK[message.status as WhatsappMessageStatus]) return;

    await this.prisma.whatsappMessage.update({
      where: { id: message.id },
      data: { status: update.status, error: update.error?.slice(0, 500) ?? null },
    });
  }

  /**
   * Conversacion del numero, creandola si es la primera vez.
   *
   * Si el numero era desconocido se vuelve a buscar en las fichas: puede que
   * el cliente se haya registrado despues del primer mensaje.
   */
  private async ensureConversation(phone: string) {
    const existing = await this.prisma.whatsappConversation.findUnique({ where: { phone } });

    if (existing) {
      if (existing.clientId) return existing;

      const clientId = await this.findClientId(phone);

      return clientId
        ? this.prisma.whatsappConversation.update({
            where: { id: existing.id },
            data: {
              clientId,
              identityStatus: 'VERIFIED',
              identifiedBy: 'PHONE',
              identifiedAt: new Date(),
            },
          })
        : existing;
    }

    const clientId = await this.findClientId(phone);

    try {
      return await this.prisma.whatsappConversation.create({
        data: {
          phone,
          clientId,
          ...(clientId
            ? { identityStatus: 'VERIFIED', identifiedBy: 'PHONE', identifiedAt: new Date() }
            : {}),
        },
      });
    } catch (error) {
      // Otro mensaje del mismo numero la creo en paralelo.
      if (isUniqueViolation(error)) {
        return this.prisma.whatsappConversation.findUniqueOrThrow({ where: { phone } });
      }

      throw error;
    }
  }

  /**
   * Cliente al que pertenece un numero.
   *
   * El telefono de la ficha es texto libre: puede estar como `+51 987 654 321`
   * o sin codigo de pais (`987 654 321`). Se compara normalizado igual que en
   * `normalizePhone`: solo digitos y con el 51 delante de un movil peruano de
   * 9 digitos. No hay coincidencias parciales: un numero que encaja con mas de
   * un cliente no identifica a ninguno.
   */
  private async findClientId(phone: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT c.id FROM clients c
      CROSS JOIN LATERAL (
        SELECT REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', '', 'g') AS digits
      ) AS ficha
      LEFT JOIN client_contacts cc ON cc.client_id = c.id AND cc.verified_at IS NOT NULL AND cc.deleted_at IS NULL
      WHERE c.status = 'ACTIVE' AND (
        (CASE
           WHEN ficha.digits ~ '^9[0-9]{8}$' THEN '51' || ficha.digits
           WHEN ficha.digits LIKE '00%' THEN SUBSTRING(ficha.digits FROM 3)
           ELSE ficha.digits
         END = ${phone}
          AND NOT EXISTS (SELECT 1 FROM client_contacts revoked WHERE revoked.client_id = c.id AND revoked.phone = ${phone} AND (revoked.deleted_at IS NOT NULL OR revoked.verified_at IS NULL)))
        OR cc.phone = ${phone}
      ) LIMIT 2
    `;

    return rows.length === 1 ? rows[0]!.id : null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
