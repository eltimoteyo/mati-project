import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../mail/mail.service';

const searchSchema = z
  .object({
    ruc: z.string().max(20).optional(),
    nombre: z.string().min(3).max(160).optional(),
    correo: z.string().email().optional(),
    dominio: z.string().max(250).optional(),
  })
  .strict();

@Injectable()
export class IdentityService {
  private readonly secret: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.secret = config.get('jwt', { infer: true }).accessSecret;
  }

  async search(conversationId: string, input: unknown) {
    const args = searchSchema.parse(input);
    if (!Object.values(args).some(Boolean))
      return { found: false, message: 'Indica RUC, empresa o correo.' };
    const domain = args.dominio?.toLowerCase().replace(/^www\./, '');
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Dominio inválido');
    const candidates = await this.prisma.client.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          ...(args.ruc ? [{ taxId: args.ruc }] : []),
          ...(args.nombre
            ? [{ name: { contains: args.nombre, mode: 'insensitive' as const } }]
            : []),
          ...(args.correo
            ? [
                { email: { equals: args.correo, mode: 'insensitive' as const } },
                {
                  contacts: {
                    some: {
                      email: { equals: args.correo, mode: 'insensitive' as const },
                      verifiedAt: { not: null },
                    },
                  },
                },
              ]
            : []),
          ...(domain
            ? [{ projects: { some: { url: { contains: domain, mode: 'insensitive' as const } } } }]
            : []),
        ],
      },
      take: 3,
      select: {
        id: true,
        name: true,
        email: true,
        contacts: { where: { verifiedAt: { not: null } }, select: { email: true } },
      },
    });
    if (candidates.length !== 1)
      return {
        found: false,
        message: candidates.length
          ? 'Hay varias coincidencias. Indica el RUC o correo exacto.'
          : 'Sin coincidencias. Registra empresa, contacto y necesidad para avisar al equipo comercial.',
      };
    const candidate = candidates[0]!;
    const conversation = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    if (conversation.identityStatus === 'VERIFIED')
      return { found: true, message: 'La conversación ya está verificada.' };
    const claimed =
      args.correo &&
      [candidate.email, ...candidate.contacts.map((item) => item.email)].some(
        (email) => email?.toLowerCase() === args.correo?.toLowerCase(),
      );
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { clientId: candidate.id, identityStatus: claimed ? 'CLAIMED' : 'UNKNOWN' },
    });
    return {
      found: true,
      identityStatus: claimed ? 'CLAIMED' : 'UNKNOWN',
      message:
        'Coincidencia encontrada. Puedes enviar un código al correo registrado, sin mostrarlo en el chat. Aún no puedes ver servicios ni tickets.',
    };
  }

  private hash(id: string, code: string) {
    return createHmac('sha256', this.secret).update(`${id}:${code}`).digest('hex');
  }

  async sendCode(conversationId: string) {
    // Serializar envíos impide eludir el límite con llamadas paralelas.
    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM whatsapp_conversations WHERE id = ${conversationId}::uuid FOR UPDATE`;
      const conversation = await tx.whatsappConversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: { client: true },
      });
      if (!conversation.client || conversation.client.status !== 'ACTIVE')
        throw new Error('Primero identifica la empresa.');
      if (conversation.identityStatus === 'VERIFIED')
        throw new Error('La identidad ya está verificada.');
      const count = await tx.identityChallenge.count({
        where: { conversationId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
      });
      if (count >= 3) throw new Error('Se alcanzó el límite de tres códigos por hora.');
      await tx.identityChallenge.updateMany({
        where: { conversationId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const code = randomInt(100_000, 1_000_000).toString();
      const record = await tx.identityChallenge.create({
        data: {
          conversationId,
          clientId: conversation.client.id,
          codeHash: this.hash(conversationId, code),
          expiresAt: new Date(Date.now() + 600_000),
        },
      });
      return { id: record.id, code, email: conversation.client.email };
    });
    const result = await this.mail.send({
      to: challenge.email,
      subject: 'Código de verificación de CONIT',
      text: `Tu código es ${challenge.code}. Caduca en 10 minutos. Si no lo solicitaste, ignora este correo.`,
      html: `<p>Tu código de verificación de CONIT es <strong>${challenge.code}</strong>.</p><p>Caduca en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
    });
    if (!result.sent) {
      await this.prisma.identityChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new Error(
        'No se pudo enviar el código. El equipo puede verificar la identidad desde la bandeja.',
      );
    }
    return {
      sent: true,
      message: 'Código enviado al correo que ya constaba en la ficha. Caduca en diez minutos.',
    };
  }

  async verify(conversationId: string, code: string) {
    if (!/^\d{6}$/.test(code)) throw new Error('El código debe tener seis dígitos.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM whatsapp_conversations WHERE id = ${conversationId}::uuid FOR UPDATE`;
      const challenge = await tx.identityChallenge.findFirst({
        where: {
          conversationId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!challenge)
        return { verified: false, message: 'Código caducado o agotado. Solicita uno nuevo.' };
      await tx.identityChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      if (
        !timingSafeEqual(
          Buffer.from(challenge.codeHash, 'hex'),
          Buffer.from(this.hash(conversationId, code), 'hex'),
        )
      )
        return { verified: false, message: 'Código incorrecto.' };
      const conversation = await tx.whatsappConversation.findUniqueOrThrow({
        where: { id: conversationId },
      });
      if (conversation.clientId !== challenge.clientId)
        return { verified: false, message: 'La empresa cambió. Solicita un código nuevo.' };
      const now = new Date();
      await tx.identityChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
      await tx.whatsappConversation.update({
        where: { id: conversationId },
        data: { identityStatus: 'VERIFIED', identifiedBy: 'EMAIL_CODE', identifiedAt: now },
      });
      await tx.clientContact.upsert({
        where: { clientId_phone: { clientId: challenge.clientId, phone: conversation.phone } },
        update: { verifiedAt: now, deletedAt: null },
        create: {
          clientId: challenge.clientId,
          phone: conversation.phone,
          name: conversation.profileName ?? 'Contacto de WhatsApp',
          verifiedAt: now,
        },
      });
      return { verified: true };
    });
  }
}
