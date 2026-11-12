import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiService } from '../ai/ai.service';
import { AiGateway } from '../ai/ai-gateway.service';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { WhatsappConversationsService } from '../whatsapp/whatsapp-conversations.service';
import { WhatsappMediaService } from '../whatsapp/whatsapp-media.service';
import { SupportAgentService } from './agent/support-agent.service';
import { SupportCasesService } from './agent/support-cases.service';
import {
  AI_SIGNATURE,
  canTransition,
  confirmsEscalation,
  factsSchema,
  mergeSteps,
  removeUnsafeLinks,
  safeReply,
  stripSignature,
} from './agent/support-policy';
import { SupportToolsService } from './agent/support-tools.service';
import { replyWindowEnd } from './inbox.mapper';
import { domainOf } from './service-diagnostics';

interface ClaimedJob {
  conversation_id: string;
  version: number;
  attempts: number;
}
const HOLD =
  'Recibimos tu mensaje. El asistente no pudo completar la consulta; he avisado al equipo para que te ayude por aquí.';

/**
 * Cola persistente con arrendamiento. Cada mensaje se registra junto con su trabajo.
 *
 * Atiende tantas conversaciones a la vez como indique el panel: con una sola,
 * un turno lento del agente hacia esperar a todos los demas clientes.
 */
@Injectable()
export class InboxAutoReplyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxAutoReplyService.name);
  private timer?: NodeJS.Timeout;
  /** Trabajos en curso en esta instancia. */
  private readonly running = new Set<Promise<void>>();
  /** Evita dos rondas de reclamo solapadas. */
  private filling = false;
  private stopping = false;
  private readonly allowedDomains: string[];
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: SupportAgentService,
    private readonly cases: SupportCasesService,
    private readonly tools: SupportToolsService,
    private readonly settings: SettingsService,
    private readonly cloud: WhatsappCloudService,
    private readonly conversations: WhatsappConversationsService,
    private readonly gateway: AiGateway,
    private readonly ai: AiService,
    private readonly media: WhatsappMediaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.allowedDomains = config.get('ai', { infer: true }).allowedDomains;
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.fill(), 2000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.running]);
  }

  async schedule(conversationId: string) {
    const { replyDelaySeconds } = await this.settings.getAiLimits();
    const runAt = new Date(Date.now() + replyDelaySeconds * 1000);

    await this.prisma.autoReplyJob.upsert({
      where: { conversationId },
      create: { conversationId, runAt },
      update: { runAt, version: { increment: 1 }, attempts: 0 },
    });
  }

  /** Reclama trabajos hasta llenar los huecos libres. */
  private async fill() {
    if (this.filling || this.stopping) return;
    this.filling = true;
    try {
      const { concurrentConversations } = await this.settings.getAiLimits();
      while (!this.stopping && this.running.size < concurrentConversations) {
        const token = randomUUID();
        const job = await this.claim(token);
        if (!job) break;
        const task: Promise<void> = this.process(job, token)
          .catch((error: unknown) =>
            this.logger.error(error instanceof Error ? error.message : 'Fallo de cola'),
          )
          .finally(() => {
            this.running.delete(task);
          });
        this.running.add(task);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Fallo de cola');
    } finally {
      this.filling = false;
    }
  }

  private async claim(token: string): Promise<ClaimedJob | undefined> {
    const [job] = await this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE auto_reply_jobs SET locked_at = NOW(), lock_token = ${token}::uuid
      WHERE conversation_id = (
        SELECT conversation_id FROM auto_reply_jobs
        WHERE run_at <= NOW() AND (locked_at IS NULL OR locked_at < NOW() - interval '2 minutes')
        ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1
      ) RETURNING conversation_id, version, attempts
    `;

    return job;
  }

  private async process(job: ClaimedJob, token: string) {
    const renew = setInterval(() => {
      void this.prisma.autoReplyJob
        .updateMany({
          where: { conversationId: job.conversation_id, lockToken: token },
          data: { lockedAt: new Date() },
        })
        .catch(() => undefined);
    }, 20_000);
    try {
      await this.respond(job.conversation_id, token);
      await this.prisma.autoReplyJob.deleteMany({
        where: { conversationId: job.conversation_id, lockToken: token, version: job.version },
      });
    } catch (error) {
      this.logger.warn(
        `Respuesta pendiente ${job.conversation_id}: ${error instanceof Error ? error.message : 'fallo'}`,
      );
      if (job.attempts >= 2) {
        try {
          await this.hold(job.conversation_id, token);
        } catch {
          /* Mantener el trabajo si Meta sigue caído. */
        }
      }
      await this.prisma.autoReplyJob.updateMany({
        where: { conversationId: job.conversation_id, lockToken: token, version: job.version },
        data: {
          attempts: { increment: 1 },
          runAt: new Date(Date.now() + Math.min(300_000, 10_000 * 2 ** Math.min(job.attempts, 5))),
        },
      });
    } finally {
      clearInterval(renew);
      await this.prisma.autoReplyJob.updateMany({
        where: { conversationId: job.conversation_id, lockToken: token },
        data: { lockedAt: null, lockToken: null },
      });
    }
  }

  private async respond(conversationId: string, token: string) {
    if (!(await this.settings.getAutomation()).whatsappAutoReply || !this.cloud.isEnabled()) return;
    await this.media.processPending(conversationId);
    const conversation = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 3 } },
    });
    const inbound = conversation.messages[0];
    if (
      !inbound ||
      inbound.direction !== 'INBOUND' ||
      (conversation.aiPausedUntil && conversation.aiPausedUntil > new Date())
    )
      return;
    if ((replyWindowEnd(conversation.lastInboundAt)?.getTime() ?? 0) <= Date.now()) return;
    // La cola conserva el turno mientras se procesa el adjunto.
    if (inbound.mediaId && !inbound.mediaProcessed)
      throw new Error('Adjunto pendiente de procesar');
    const rating = /^\s*([1-5])(?:\s*\/\s*5)?\s*$/.exec(inbound.body);
    if (rating && conversation.identityStatus === 'VERIFIED' && conversation.clientId) {
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          clientId: conversation.clientId,
          whatsappConversationId: conversationId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          satisfaction: null,
          updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (ticket) {
        await this.send(
          conversationId,
          inbound.id,
          'Gracias. Hemos registrado tu valoración para mejorar la atención.',
          'reply',
          token,
        );
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { satisfaction: Number(rating[1]) },
        });
        return;
      }
    }
    const supportCase = await this.cases.current(conversation);
    const limits = await this.settings.getAiLimits();
    const replies = await this.prisma.whatsappMessage.count({
      where: {
        conversationId,
        aiGenerated: true,
        createdAt: { gte: new Date(Date.now() - 3_600_000) },
      },
    });
    if (replies >= limits.maxRepliesPerHour) {
      await this.tools.notify(
        'Límite de respuestas automáticas',
        `La conversación ${conversationId} necesita una persona.`,
      );
      return;
    }
    if (!this.gateway.isAvailable()) {
      await this.hold(conversationId, token);
      return;
    }
    const decision = await this.agent.run(
      conversationId,
      supportCase,
      AbortSignal.timeout(limits.turnTimeoutSeconds * 1000),
    );
    const fresh = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    if (
      conversation.identityStatus === 'VERIFIED' &&
      (fresh.clientId !== conversation.clientId || fresh.identityStatus !== 'VERIFIED')
    )
      return;
    if (!(await this.stillPending(conversationId, inbound.id, token))) return;
    const identified = fresh.identityStatus !== 'UNKNOWN';
    const oldFacts = factsSchema.parse(supportCase.facts);
    const { incidentId: _untrustedIncident, ...modelFacts } = decision.facts;
    const facts = { ...oldFacts, ...modelFacts };
    const steps = mergeSteps(supportCase.stepsTried, decision.stepsTried);
    const confirmed =
      !/\bno\b.{0,25}(funciona|solucion|resuelto)/i.test(inbound.body) &&
      /ya (?:funciona|est[aá] (?:bien|resuelto))|se solucion[oó]|problema resuelto|funcion[oó]/i.test(
        inbound.body,
      );
    let action = decision.action;
    if (action === 'resolved' && !confirmed) action = 'reply';
    if (action === 'troubleshoot' && !identified) {
      action = 'reply';
      decision.message =
        'Antes de revisar el problema, indica el RUC o empresa, tu nombre y tu correo para identificarte.';
    }
    if (action === 'troubleshoot' && supportCase.attempts >= 2) action = 'escalate';
    // El cliente confirma el registro que se le ofrecio: se crea aunque el
    // modelo haya contestado otra cosa en este turno.
    const pendingConfirmation = supportCase.stage === 'ESCALATED' && !supportCase.ticketId;
    if (pendingConfirmation && confirmsEscalation(inbound.body, true)) action = 'escalate';
    if (supportCase.ticketId) action = 'follow_up';
    if (supportCase.stage === 'FOLLOW_UP' && !supportCase.ticketId && action !== 'resolved')
      action = 'follow_up';
    const projects =
      fresh.identityStatus === 'VERIFIED' && fresh.clientId
        ? await this.prisma.project.findMany({
            where: { clientId: fresh.clientId },
            select: { url: true },
          })
        : [];
    const allowed = [
      ...this.allowedDomains,
      ...projects.flatMap((project) =>
        project.url
          ? [domainOf(project.url)].filter((domain): domain is string => Boolean(domain))
          : [],
      ),
    ];
    // Lo que escribio la IA solo se descarta si no es seguro enviarlo: un
    // enlace externo se quita con su frase y la firma la pone el servidor.
    decision.message = stripSignature(removeUnsafeLinks(decision.message, allowed));
    const unsafe = !decision.message.trim() || !safeReply(decision.message, allowed);
    if (unsafe) {
      action = 'escalate';
      decision.message = 'El equipo técnico continuará la atención por esta conversación.';
    }
    let stage =
      supportCase.stage === 'IDENTIFYING' && identified ? ('TRIAGE' as const) : supportCase.stage;
    let text = decision.message;
    const next =
      action === 'troubleshoot'
        ? 'TROUBLESHOOTING'
        : action === 'resolved'
          ? 'RESOLVED'
          : action === 'escalate'
            ? 'ESCALATED'
            : action === 'follow_up'
              ? 'FOLLOW_UP'
              : identified && stage === 'IDENTIFYING'
                ? 'TRIAGE'
                : stage;
    if (canTransition(stage, next, identified, confirmed)) stage = next;
    const updated = { ...supportCase, facts, stepsTried: steps, summary: decision.summary };
    if (action === 'escalate') {
      const outcome = await this.tools.escalate(conversationId, updated, decision, inbound.body);
      const answer = unsafe ? '' : decision.message.trim();
      // La respuesta de la IA va primero: suele contestar a lo que pregunto el
      // cliente. Si ya pide la confirmacion, no se repite la del servidor.
      text =
        outcome.kind === 'confirm' && answer.includes('?')
          ? answer
          : [answer, outcome.text].filter(Boolean).join('\n\n');
    }
    // Con ticket abierto la IA sigue contestando lo que se le pregunta; el
    // estado fijo solo se usa si no devolvio nada que enviar.
    if (action === 'follow_up' && supportCase.ticketId && !text.trim()) {
      if (fresh.identityStatus === 'VERIFIED' && fresh.clientId) {
        const ticket = await this.prisma.ticket.findFirst({
          where: { id: supportCase.ticketId, clientId: fresh.clientId },
          select: { number: true, status: true },
        });
        if (ticket) {
          const { formatTicketCode, TICKET_STATUS_LABELS } = await import('@conit/types');
          text = `Tu ticket ${formatTicketCode(ticket.number)} está en estado «${TICKET_STATUS_LABELS[ticket.status]}». La información nueva queda en esta conversación para el equipo.`;
        }
      } else
        text =
          'Tu consulta está con el equipo. Para consultar detalles del ticket, verifica tu identidad con el código enviado al correo registrado.';
    }
    if (action === 'follow_up' && !supportCase.ticketId) {
      const incident = oldFacts.incidentId
        ? await this.prisma.serviceIncident.findUnique({ where: { id: oldFacts.incidentId } })
        : null;
      // El estado de una incidencia general lo conoce el servidor, no la IA.
      if (incident)
        text = incident.closedAt
          ? 'Las últimas comprobaciones indican que el servicio se recuperó. ¿Puedes confirmar si ya funciona para ti?'
          : 'La incidencia del servicio sigue registrada con el equipo. Aún no se ha confirmado su recuperación.';
      else if (!text.trim())
        text =
          'Tu consulta está con el equipo. La información nueva quedará registrada en esta conversación.';
    }
    if (action === 'resolved')
      text += '\n¿Se resolvió tu consulta? Puedes valorar la atención del 1 al 5.';
    if (!(await this.send(conversationId, inbound.id, text, action, token))) return;
    const linked = await this.prisma.supportCase.findUniqueOrThrow({
      where: { id: supportCase.id },
    });
    const linkedFacts = factsSchema.parse(linked.facts);
    await this.prisma.supportCase.update({
      where: { id: supportCase.id },
      data: {
        facts: {
          ...facts,
          ...(linkedFacts.incidentId ? { incidentId: linkedFacts.incidentId } : {}),
        },
        stepsTried: steps,
        summary: decision.summary,
        stage:
          linked.ticketId || (linked.stage === 'FOLLOW_UP' && action !== 'resolved')
            ? 'FOLLOW_UP'
            : stage,
        clientId: fresh.clientId,
        ...(action === 'troubleshoot' ? { attempts: { increment: 1 } } : {}),
        ...(action === 'resolved' ? { solution: decision.solution, closedAt: new Date() } : {}),
      },
    });
    if (action === 'resolved' && decision.solution) {
      const article = await this.ai.generateKnowledgeArticle(
        facts.symptom ?? 'Consulta resuelta',
        decision.summary,
        decision.solution,
      );
      if (article) await this.cases.proposeArticle(supportCase.id, article);
    }
  }

  private async stillPending(conversationId: string, inboundId: string, token: string) {
    const job = await this.prisma.autoReplyJob.findUnique({ where: { conversationId } });
    if (job?.lockToken !== token) return false;
    const conversation = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } },
    });
    return (
      conversation.messages[0]?.id === inboundId &&
      !(conversation.aiPausedUntil && conversation.aiPausedUntil > new Date()) &&
      (replyWindowEnd(conversation.lastInboundAt)?.getTime() ?? 0) > Date.now()
    );
  }

  private async send(
    conversationId: string,
    inboundId: string,
    text: string,
    action: string,
    token: string,
  ) {
    if (!(await this.stillPending(conversationId, inboundId, token))) return false;
    const conversation = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    const body = `${stripSignature(text)}\n\n${AI_SIGNATURE}`;
    const result = await this.cloud.sendText({ to: conversation.phone, body });
    if (!result.sent)
      throw new Error(`Meta no aceptó la respuesta (${result.errorCode ?? 'sin código'})`);
    await this.conversations.recordOutbound({
      phone: conversation.phone,
      externalId: result.id ?? null,
      type: 'text',
      body,
      aiGenerated: true,
      aiAction: action,
    });
    return true;
  }

  private async hold(conversationId: string, token: string) {
    const latest = await this.prisma.whatsappMessage.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!latest || latest.direction !== 'INBOUND') return;
    if (await this.send(conversationId, latest.id, HOLD, 'hold', token))
      await this.tools.notify(
        'WhatsApp necesita atención humana',
        `Conversación ${conversationId}: el asistente no pudo continuar.`,
      );
  }
}
