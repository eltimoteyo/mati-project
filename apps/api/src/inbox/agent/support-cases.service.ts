import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { WhatsappConversation } from '../../generated/prisma/client';

@Injectable()
export class SupportCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async current(conversation: WhatsappConversation) {
    return this.prisma.$transaction(async (tx) => {
      // También protege ante trabajadores de otra instancia.
      await tx.$queryRaw`SELECT id FROM whatsapp_conversations WHERE id = ${conversation.id}::uuid FOR UPDATE`;
      const active = await tx.supportCase.findFirst({
        where: { conversationId: conversation.id, closedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      const inbound = conversation.lastInboundAt ?? new Date();
      const identityChanged = active?.clientId && active.clientId !== conversation.clientId;
      if (
        active &&
        !identityChanged &&
        inbound.getTime() - active.lastInboundAt.getTime() < 86_400_000
      ) {
        return tx.supportCase.update({
          where: { id: active.id },
          data: {
            lastInboundAt: inbound,
            clientId: conversation.clientId,
            ...(active.stage === 'IDENTIFYING' && conversation.identityStatus !== 'UNKNOWN'
              ? { stage: 'TRIAGE' }
              : {}),
          },
        });
      }
      if (active)
        await tx.supportCase.update({
          where: { id: active.id },
          data: {
            stage: 'ABANDONED',
            closedAt: identityChanged
              ? new Date()
              : new Date(active.lastInboundAt.getTime() + 86_400_000),
          },
        });
      const [lastClosed, lastOutbound] = await Promise.all([
        tx.supportCase.findFirst({
          where: { conversationId: conversation.id, closedAt: { not: null } },
          orderBy: { closedAt: 'desc' },
          select: { closedAt: true },
        }),
        tx.whatsappMessage.findFirst({
          where: { conversationId: conversation.id, direction: 'OUTBOUND' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);
      const boundary = Math.max(
        lastClosed?.closedAt?.getTime() ?? 0,
        lastOutbound?.createdAt.getTime() ?? 0,
      );
      const firstPending = await tx.whatsappMessage.findFirst({
        where: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          createdAt: { gt: new Date(boundary), lte: inbound },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      return tx.supportCase.create({
        data: {
          conversationId: conversation.id,
          clientId: conversation.clientId,
          stage: conversation.identityStatus === 'UNKNOWN' ? 'IDENTIFYING' : 'TRIAGE',
          lastInboundAt: inbound,
          startedAt: firstPending?.createdAt ?? new Date(Math.max(inbound.getTime(), boundary + 1)),
        },
      });
    });
  }

  async expire() {
    await this.prisma.supportCase.updateMany({
      where: {
        closedAt: null,
        lastInboundAt: { lt: new Date(Date.now() - 86_400_000) },
        stage: { in: ['IDENTIFYING', 'TRIAGE', 'TROUBLESHOOTING'] },
      },
      data: { stage: 'ABANDONED', closedAt: new Date() },
    });
  }

  async proposeArticle(
    caseId: string,
    article: { title: string; summary: string; content: string },
  ) {
    const slug = `caso-${caseId}`;
    await this.prisma.article.upsert({
      where: { slug },
      update: {},
      create: { ...article, slug, isPublished: false },
    });
  }
}
