import {
  formatTicketCode,
  NOTIFICATION_TYPES,
  OPEN_TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from '@conit/types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { AiTool } from '../../ai/interfaces/ai-provider.interface';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import type { SupportCase } from '../../generated/prisma/client';
import { NotificationsService } from '../../notifications/notifications.service';
import { TicketsService } from '../../tickets/tickets.service';
import { domainOf } from '../service-diagnostics';
import { IdentityService } from './identity.service';
import { SupportDiagnosticsService } from './support-diagnostics.service';
import { SupportKnowledgeService } from './support-knowledge.service';
import {
  confirmsEscalation,
  factsSchema,
  permittedTool,
  redactSecrets,
  requireVerified,
  stepsSchema,
  type SupportDecision,
} from './support-policy';

const object = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const string = { type: 'string' };
export const SUPPORT_TOOLS: AiTool[] = [
  {
    name: 'buscar_cliente',
    description:
      'Busca la empresa con los datos aportados. No revela datos privados ni verifica la identidad.',
    parameters: object({ ruc: string, nombre: string, correo: string, dominio: string }),
  },
  {
    name: 'enviar_codigo',
    description: 'Envía un código al correo que consta en la ficha; máximo tres por hora.',
    parameters: object(),
  },
  {
    name: 'verificar_codigo',
    description: 'Comprueba el código de seis dígitos que acaba de enviar el contacto.',
    parameters: object({ codigo: string }, ['codigo']),
  },
  {
    name: 'ver_servicios',
    description: 'Consulta servicios, notas y antecedentes del cliente verificado.',
    parameters: object(),
  },
  {
    name: 'ver_tickets',
    description: 'Consulta tickets abiertos del cliente verificado.',
    parameters: object(),
  },
  {
    name: 'estado_ticket',
    description: 'Consulta un ticket del cliente verificado por código CNT-0000.',
    parameters: object({ codigo: string }, ['codigo']),
  },
  {
    name: 'diagnosticar',
    description:
      'Comprueba web, SSL, DNS y correo de un dominio mencionado por el contacto o de su servicio. Resultados públicos; máximo diez por hora.',
    parameters: object({ dominio: string }, ['dominio']),
  },
  {
    name: 'buscar_conocimiento',
    description: 'Busca las guías publicadas más relevantes por síntoma.',
    parameters: object({ consulta: string }, ['consulta']),
  },
  {
    name: 'guardar_caso',
    description:
      'Consulta la memoria actual. Devuelve facts y stepsTried actualizados en el JSON final para guardarlos.',
    parameters: object(),
  },
  {
    name: 'crear_ticket',
    description:
      'Solicita derivación. Los datos del ticket se validan y crean al finalizar el turno, después de confirmar con el cliente salvo urgencia.',
    parameters: object(),
  },
  {
    name: 'derivar_a_persona',
    description: 'Solicita intervención de soporte o comercial. Finaliza con action escalate.',
    parameters: object(),
  },
];

/**
 * Resultado de derivar. `confirm`: falta que el cliente acepte el registro;
 * `done`: ya se hizo algo (ticket creado, enlazado o aviso al equipo).
 */
export interface EscalationOutcome {
  kind: 'confirm' | 'done';
  text: string;
}

/** "240 minutos" se lee peor que "4 horas". */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.round((minutes / 60) * 10) / 10;

  return hours === 1 ? '1 hora' : `${String(hours).replace('.', ',')} horas`;
}

@Injectable()
export class SupportToolsService {
  private readonly appUrl: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly diagnostics: SupportDiagnosticsService,
    private readonly knowledge: SupportKnowledgeService,
    private readonly tickets: TicketsService,
    private readonly notifications: NotificationsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.appUrl = config.get('cors', { infer: true }).frontendUrl;
  }

  async execute(
    name: string,
    raw: unknown,
    conversationId: string,
    supportCase: SupportCase,
    inbound: string,
    used: string[],
    signal: AbortSignal,
  ) {
    if (signal.aborted) throw new Error('Tiempo del turno agotado');
    const conversation = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    if (
      conversation.clientId &&
      conversation.identityStatus === 'VERIFIED' &&
      !(await this.prisma.client.findFirst({
        where: { id: conversation.clientId, status: 'ACTIVE' },
        select: { id: true },
      }))
    )
      throw new Error('El cliente necesita verificación del equipo.');
    permittedTool(name, conversation.identityStatus, conversation.clientId);
    const empty = z.object({}).strict();
    switch (name) {
      case 'buscar_cliente': {
        if (
          !raw ||
          typeof raw !== 'object' ||
          !Object.values(raw).every(
            (value) =>
              typeof value === 'string' && inbound.toLowerCase().includes(value.toLowerCase()),
          )
        )
          throw new Error('Busca solo con datos que el contacto haya escrito en este turno.');
        return this.identity.search(conversationId, raw);
      }
      case 'enviar_codigo':
        empty.parse(raw);
        return this.identity.sendCode(conversationId);
      case 'verificar_codigo': {
        const { codigo } = z
          .object({ codigo: z.string().regex(/^\d{6}$/) })
          .strict()
          .parse(raw);
        if (!inbound.includes(codigo))
          throw new Error('Usa solo el código que acaba de escribir el contacto.');
        return this.identity.verify(conversationId, codigo);
      }
      case 'ver_servicios': {
        empty.parse(raw);
        const clientId = requireVerified(conversation.identityStatus, conversation.clientId);
        const client = await this.prisma.client.findUniqueOrThrow({
          where: { id: clientId },
          select: {
            notes: true,
            projects: {
              where: { status: { not: 'ARCHIVED' } },
              select: {
                id: true,
                name: true,
                type: true,
                description: true,
                url: true,
                expiresAt: true,
                status: true,
              },
            },
          },
        });
        const recent = await this.prisma.ticket.findMany({
          where: {
            clientId,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
          },
          orderBy: { resolvedAt: 'desc' },
          take: 5,
          select: {
            subject: true,
            messages: {
              where: { visibility: 'PUBLIC', authorId: { not: null } },
              orderBy: { createdAt: 'desc' },
              take: 2,
              select: { body: true },
            },
          },
        });
        return JSON.parse(
          redactSecrets(JSON.stringify({ ...client, antecedentes: recent })),
        ) as unknown;
      }
      case 'ver_tickets':
      case 'estado_ticket': {
        const clientId = requireVerified(conversation.identityStatus, conversation.clientId);
        const code =
          name === 'estado_ticket'
            ? z
                .object({ codigo: z.string().regex(/^CNT-\d{1,10}$/i) })
                .strict()
                .parse(raw).codigo
            : null;
        if (!code) empty.parse(raw);
        const tickets = await this.prisma.ticket.findMany({
          where: {
            clientId,
            ...(code
              ? { number: Number(code.split('-')[1]) }
              : { status: { in: OPEN_TICKET_STATUSES } }),
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: { number: true, subject: true, status: true, updatedAt: true },
        });
        return tickets.map((ticket) => ({
          ...ticket,
          code: formatTicketCode(ticket.number),
          status: TICKET_STATUS_LABELS[ticket.status],
        }));
      }
      case 'diagnosticar': {
        const { dominio } = z
          .object({
            dominio: z
              .string()
              .max(250)
              .transform((s) => s.toLowerCase()),
          })
          .strict()
          .parse(raw);
        const recent = await this.prisma.aiTurn.findMany({
          where: { conversationId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
          select: { tools: true },
        });
        const count =
          recent.reduce(
            (n, turn) =>
              n +
              (Array.isArray(turn.tools)
                ? turn.tools.filter(
                    (tool) =>
                      typeof tool === 'object' && tool && 'name' in tool && tool.name === name,
                  ).length
                : 0),
            0,
          ) + used.filter((tool) => tool === name).length;
        if (count >= 10) throw new Error('Límite de diagnósticos alcanzado.');
        const projects =
          conversation.identityStatus === 'VERIFIED' && conversation.clientId
            ? await this.prisma.project.findMany({
                where: { clientId: conversation.clientId, status: 'ACTIVE' },
              })
            : [];
        const project = projects.find((item) => item.url && domainOf(item.url) === dominio);
        const mentioned = new RegExp(
          `(?:^|[^a-z0-9.-])${dominio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9.-])`,
          'i',
        ).test(inbound);
        if (!project && !mentioned)
          throw new Error('Comprueba solo dominios del cliente o mencionados en este turno.');
        return this.diagnostics.run(
          dominio,
          (project?.technical as Record<string, unknown>) ?? {},
          signal,
        );
      }
      case 'buscar_conocimiento':
        return this.knowledge.search(
          z
            .object({ consulta: z.string().min(3).max(3000) })
            .strict()
            .parse(raw).consulta,
          signal,
        );
      case 'guardar_caso':
        empty.parse(raw);
        return {
          facts: supportCase.facts,
          stepsTried: supportCase.stepsTried,
          summary: supportCase.summary,
        };
      case 'crear_ticket':
      case 'derivar_a_persona':
        empty.parse(raw);
        return {
          requested: true,
          message:
            'Finaliza con action escalate. El servidor verificará identidad, confirmación y duplicados; no afirmes que ya existe ticket.',
        };
      default:
        throw new Error('Herramienta no permitida');
    }
  }

  async notify(title: string, body: string, ticketId?: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    for (const admin of admins)
      await this.notifications.notify({
        userId: admin.id,
        type: NOTIFICATION_TYPES.TICKET_MESSAGE,
        title,
        body: redactSecrets(body).slice(0, 500),
        ...(ticketId ? { ticketId } : {}),
      });
  }

  async escalate(
    conversationId: string,
    supportCase: SupportCase,
    decision: SupportDecision,
    inbound: string,
  ): Promise<EscalationOutcome> {
    const conversation = await this.prisma.whatsappConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    if (!conversation.clientId || conversation.identityStatus === 'UNKNOWN') {
      await this.notify(
        'WhatsApp pendiente de identificación / comercial',
        `${conversation.profileName ?? 'Contacto'}: ${decision.summary}`,
      );
      return {
        kind: 'done',
        text: 'He avisado al equipo para que te contacte y confirme la empresa. Tu consulta queda registrada en esta conversación.',
      };
    }
    const urgent =
      /hacke|seguridad|datos.{0,25}(borrad|perdid|riesgo)|ca[ií]d[ao].{0,25}(todos|general)/i.test(
        inbound,
      );
    const confirmed = confirmsEscalation(inbound, supportCase.stage === 'ESCALATED');
    if (!urgent && !confirmed && !supportCase.ticketId)
      return {
        kind: 'confirm',
        text: '¿Quieres que registre el caso para el equipo técnico? Si es así, indícame también tu horario de contacto y, si puedes, el texto o una captura del error. Nunca envíes contraseñas.',
      };
    if (supportCase.ticketId) {
      const existing = await this.prisma.ticket.findUniqueOrThrow({
        where: { id: supportCase.ticketId },
      });
      return {
        kind: 'done',
        text: `Tu caso ya está registrado con el código ${formatTicketCode(existing.number)}.`,
      };
    }
    const facts = factsSchema.parse(supportCase.facts);
    const projects =
      conversation.identityStatus === 'VERIFIED'
        ? await this.prisma.project.findMany({ where: { clientId: conversation.clientId } })
        : [];
    const project =
      projects.find((item) => item.id === facts.projectId) ??
      projects.find((item) => facts.domain && item.url && domainOf(item.url) === facts.domain);
    const category = decision.categoryId
      ? await this.prisma.category.findFirst({
          where: { id: decision.categoryId, status: 'ACTIVE' },
        })
      : null;
    const host = project?.url ? domainOf(project.url) : null;
    const incident = host
      ? await this.prisma.serviceIncident.findFirst({ where: { host, closedAt: null } })
      : null;
    if (incident) {
      await this.prisma.supportCase.update({
        where: { id: supportCase.id },
        data: { stage: 'FOLLOW_UP', facts: { ...facts, incidentId: incident.id } },
      });
      return {
        kind: 'done',
        text: 'El equipo ya tiene detectada una incidencia en ese servicio. Tu caso quedó asociado para seguimiento y evitamos abrir otra incidencia por el mismo fallo.',
      };
    }
    const duplicate = project
      ? await this.prisma.ticket.findFirst({
          where: {
            clientId: conversation.clientId,
            projectId: project.id,
            status: { in: OPEN_TICKET_STATUSES },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const diagnostic = facts.domain
      ? await this.prisma.diagnosticCache.findFirst({
          where: {
            key: { startsWith: `diagnostic:${facts.domain}:` },
            expiresAt: { gt: new Date() },
          },
        })
      : null;
    const description = redactSecrets(
      `Síntoma: ${facts.symptom ?? decision.summary}\nServicio: ${facts.service ?? 'Por confirmar'}\nDominio: ${facts.domain ?? 'Por confirmar'}\nDesde: ${facts.since ?? 'Por confirmar'}\nImpacto: ${facts.impact ?? 'Por confirmar'}\nError: ${facts.error ?? 'No indicado'}\nHorario: ${facts.contactTime ?? 'Por confirmar'}\nPasos probados: ${JSON.stringify(stepsSchema.parse(supportCase.stepsTried))}\nComprobaciones automáticas: ${diagnostic ? JSON.stringify(diagnostic.result) : 'No disponibles'}\nResumen: ${decision.summary}\nConversación: ${this.appUrl}/admin/bandeja?conversation=${conversationId}`,
    ).slice(0, 15000);
    if (duplicate) {
      await this.prisma.$transaction(async (tx) => {
        const [current] = await tx.$queryRaw<
          Array<{ ticket_id: string | null }>
        >`SELECT ticket_id FROM support_cases WHERE id = ${supportCase.id}::uuid FOR UPDATE`;
        if (current?.ticket_id) return;
        await tx.message.create({
          data: {
            ticketId: duplicate.id,
            body: `Información adicional desde WhatsApp:\n${description}`,
            visibility: 'INTERNAL',
            source: 'AI',
          },
        });
        await tx.supportCase.update({
          where: { id: supportCase.id },
          data: { stage: 'FOLLOW_UP', ticketId: duplicate.id },
        });
      });
      await this.notify(
        'Nueva información en un ticket existente',
        `${formatTicketCode(duplicate.number)}: ${duplicate.subject}`,
        duplicate.id,
      );
      return {
        kind: 'done',
        text: `Añadí la información a tu ticket abierto ${formatTicketCode(duplicate.number)} sobre ese servicio.`,
      };
    }
    const assignee = category?.defaultAssigneeId
      ? await this.prisma.user.findFirst({
          where: { id: category.defaultAssigneeId, role: 'ADMIN', status: 'ACTIVE' },
        })
      : await this.prisma.user.findFirst({
          where: { role: 'ADMIN', status: 'ACTIVE' },
          orderBy: { assignedTickets: { _count: 'asc' } },
        });
    const subject = (facts.symptom ?? decision.summary).trim();
    const ticket = await this.tickets.create(
      {
        clientId: conversation.clientId,
        subject: (subject.length >= 5 ? subject : 'Solicitud de soporte por WhatsApp').slice(
          0,
          200,
        ),
        description,
        priority: decision.priority,
        projectId: project?.id,
        categoryId: category?.id,
        assigneeId: assignee?.id,
      },
      null,
      {
        whatsappConversationId: conversationId,
        supportCaseId: supportCase.id,
        note: 'Creado por el asistente virtual desde el resumen y los pasos del caso.',
      },
    );
    const sla = category?.responseTimeMinutes;
    return {
      kind: 'done',
      text: `He registrado el ticket ${ticket.code}.${sla ? ` El objetivo de primera respuesta es de ${formatDuration(sla)}.` : ' El equipo revisará tu caso.'}`,
    };
  }
}
