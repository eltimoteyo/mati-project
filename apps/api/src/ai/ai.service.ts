import {
  AI_REPLY_TONES,
  type AiClassification,
  type AiReplyTone,
  type AiStatus,
  type AiSuggestion,
  type AiSummary,
  formatTicketCode,
  MESSAGE_VISIBILITIES,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import type { SuggestReplyDto } from './dto/ai.dto';
import type { AiMessage } from './interfaces/ai-provider.interface';
import { OpenRouterProvider } from './providers/openrouter.provider';

/** Mensajes de la conversacion que se envian como contexto. */
const CONTEXT_MESSAGE_LIMIT = 20;

/** Recorte del cuerpo de cada mensaje, para acotar el tamano del prompt. */
const MESSAGE_EXCERPT = 600;

const TONE_GUIDANCE: Record<AiReplyTone, string> = {
  NEUTRAL: 'Tono profesional, directo y cortes.',
  EMPATHETIC:
    'Tono cercano: reconoce la molestia que causa la incidencia antes de explicar la solucion.',
  TECHNICAL:
    'Tono tecnico: detalla causa, diagnostico y pasos concretos. Puedes usar terminos precisos.',
};

/** Contexto del ticket que se arma una sola vez y comparten las tres tareas. */
interface TicketContext {
  header: string;
  conversation: string;
}

/**
 * Asistente de soporte.
 *
 * Todo lo que genera es una **propuesta**: nada se publica ni se aplica solo.
 * Una respuesta sugerida llega al editor para que la persona la revise, y una
 * clasificacion propuesta se muestra junto al boton de aplicarla. El modelo
 * ayuda a redactar y a ordenar; la decision sigue siendo de quien atiende.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly config: AppConfig['ai'];

  constructor(
    private readonly provider: OpenRouterProvider,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.config = configService.get('ai', { infer: true });
  }

  getStatus(): AiStatus {
    return {
      enabled: this.provider.isAvailable(),
      model: this.provider.isAvailable() ? this.config.model : null,
    };
  }

  /* ---------------------------------------------------------------------------
   * Redactar una respuesta
   * ------------------------------------------------------------------------ */

  async generatePortalReply(subject: string, description: string, conversation = ''): Promise<string> {
    const fallback =
      'Hemos recibido tu consulta y la hemos enviado al equipo de sistemas. ' +
      'La revisaremos dentro de este ticket y te informaremos por aquí cuando esté resuelta.';

    if (!this.provider.isAvailable()) return fallback;

    try {
      const completion = await this.provider.complete([
        {
          role: 'system',
          content: [
            'Eres la IA de soporte de CONIT.',
            'Responde en español, de forma clara, breve y profesional.',
            'Responde la consulta del cliente sin inventar soluciones ni plazos.',
            'Indica que la solicitud queda registrada para el equipo de sistemas.',
            'Devuelve únicamente el texto que verá el cliente.',
          ].join('\\n'),
        },
        {
          role: 'user',
          content: `Asunto: ${subject}\\n\\nConsulta: ${description}\\n\\nHistorial: ${conversation || 'Sin mensajes previos.'}`,
        },
      ], { temperature: 0.25, maxTokens: 350 });

      return completion.content.trim() || fallback;
    } catch (error) {
      this.logger.warn(`Respuesta automática no disponible: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  async generateResolutionReply(subject: string, description: string): Promise<string> {
    const fallback = `Ya está resuelto: hemos atendido tu solicitud sobre «${subject}». Si vuelve a ocurrir, puedes escribirnos en este mismo ticket.`;

    if (!this.provider.isAvailable()) return fallback;

    try {
      const completion = await this.provider.complete([
        {
          role: 'system',
          content: 'Escribe un mensaje breve en español confirmando al cliente que su solicitud ya está resuelta. Devuelve solo el mensaje.',
        },
        { role: 'user', content: `Asunto: ${subject}\\nDescripción: ${description}` },
      ], { temperature: 0.2, maxTokens: 180 });

      return completion.content.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  async generateKnowledgeArticle(subject: string, description: string, solution: string): Promise<{ title: string; summary: string; content: string }> {
    const fallback = {
      title: `Solución: ${subject}`,
      summary: `Solución aplicada a la incidencia: ${subject}.`,
      content: `Problema:\n${description}\n\nSolución aplicada:\n${solution}`,
    };

    if (!this.provider.isAvailable()) return fallback;

    try {
      const completion = await this.provider.complete([
        {
          role: 'system',
          content: [
            'Genera un artículo breve de base de conocimiento para soporte técnico.',
            'Responde únicamente con JSON válido: {"title":"...","summary":"...","content":"..."}.',
            'Escribe en español y no inventes pasos que no estén en la información recibida.',
          ].join('\\n'),
        },
        { role: 'user', content: `Incidencia: ${subject}\\nDescripción: ${description}\\nSolución: ${solution}` },
      ], { temperature: 0.2, maxTokens: 700, validate: (content) => this.parseJson(content) !== null });
      const parsed = this.parseJson<{ title?: unknown; summary?: unknown; content?: unknown }>(completion.content);
      if (typeof parsed?.title === 'string' && typeof parsed?.summary === 'string' && typeof parsed?.content === 'string') {
        return { title: parsed.title.trim(), summary: parsed.summary.trim(), content: parsed.content.trim() };
      }
    } catch (error) {
      this.logger.warn(`Artículo automático no disponible: ${error instanceof Error ? error.message : String(error)}`);
    }

    return fallback;
  }

  async suggestReply(idOrCode: string, dto: SuggestReplyDto): Promise<AiSuggestion> {
    const context = await this.buildContext(idOrCode);
    const tone = dto.tone ?? AI_REPLY_TONES.NEUTRAL;

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: [
          'Eres agente de soporte tecnico de CONIT, empresa que desarrolla y mantiene sitios web,',
          'sistemas web, aulas virtuales, hosting, dominios, correo corporativo y bases de datos.',
          '',
          'Redacta la respuesta que el agente enviara al cliente. Reglas:',
          '- Escribe en espanol, en segunda persona y sin saludos genericos largos.',
          '- No inventes datos que no aparezcan en el ticket: si falta informacion, pidela.',
          '- No prometas plazos concretos salvo que ya figuren en la conversacion.',
          '- Devuelve solo el cuerpo del mensaje, sin asunto ni firma.',
          `- ${TONE_GUIDANCE[tone]}`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          context.header,
          '',
          'Conversacion hasta ahora:',
          context.conversation,
          '',
          dto.instructions
            ? `Indicaciones del agente para esta respuesta: ${dto.instructions}`
            : 'Sin indicaciones adicionales.',
        ].join('\n'),
      },
    ];

    const completion = await this.provider.complete(messages, { temperature: 0.4 });

    return { content: completion.content, model: completion.model };
  }

  /* ---------------------------------------------------------------------------
   * Clasificar
   * ------------------------------------------------------------------------ */

  /**
   * Propone categoria y prioridad.
   *
   * El modelo elige de entre las categorias que existen de verdad: se le pasa
   * el catalogo y se valida que lo devuelto este en el, porque un modelo puede
   * inventarse un nombre plausible que no corresponda a ninguna fila.
   */
  async classify(idOrCode: string): Promise<AiClassification> {
    const ticketId = await this.ticketsService.resolveId(idOrCode);

    const [ticket, categories] = await Promise.all([
      this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { subject: true, description: true },
      }),
      this.prisma.category.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    const catalogue = categories
      .map((category) => `- ${category.name}${category.description ? `: ${category.description}` : ''}`)
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: [
          'Clasificas incidencias de soporte tecnico para CONIT.',
          '',
          'Responde EXCLUSIVAMENTE con un objeto JSON, sin texto alrededor ni bloques de codigo:',
          '{"category": "<nombre exacto de la lista o null>", "priority": "<LOW|MEDIUM|HIGH|CRITICAL>", "reasoning": "<una frase>"}',
          '',
          'Criterio de prioridad:',
          '- CRITICAL: servicio caido o datos en riesgo; afecta a todos los usuarios.',
          '- HIGH: funcion importante rota, con impacto en el trabajo diario.',
          '- MEDIUM: problema acotado o con solucion alternativa.',
          '- LOW: consulta, mejora o incidencia cosmetica.',
          '',
          categories.length > 0
            ? `Categorias disponibles (usa el nombre exacto):\n${catalogue}`
            : 'No hay categorias disponibles: devuelve null en "category".',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Asunto: ${ticket.subject}\n\nDescripcion:\n${ticket.description}`,
      },
    ];

    const completion = await this.provider.complete(messages, {
      temperature: 0,
      maxTokens: 300,
      // Sin JSON legible la respuesta no sirve: se prueba con otro modelo en
      // lugar de devolver una clasificacion a medias.
      validate: (content) => this.parseJson(content) !== null,
    });

    const parsed = this.parseJson<{ category?: unknown; priority?: unknown; reasoning?: unknown }>(
      completion.content,
    );

    const matched = categories.find(
      (category) =>
        typeof parsed?.category === 'string' &&
        category.name.toLowerCase() === parsed.category.trim().toLowerCase(),
    );

    return {
      categoryId: matched?.id ?? null,
      categoryName: matched?.name ?? null,
      priority: this.toPriority(parsed?.priority),
      reasoning:
        typeof parsed?.reasoning === 'string' && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : 'El modelo no incluyo una justificacion.',
      model: completion.model,
    };
  }

  /* ---------------------------------------------------------------------------
   * Resumir
   * ------------------------------------------------------------------------ */

  async summarize(idOrCode: string): Promise<AiSummary> {
    const context = await this.buildContext(idOrCode);

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: [
          'Resumes incidencias de soporte tecnico para que otro agente pueda retomarlas.',
          '',
          'Responde EXCLUSIVAMENTE con JSON, sin texto alrededor ni bloques de codigo:',
          '{"summary": "<2 o 3 frases>", "nextSteps": ["<paso>", "<paso>"]}',
          '',
          'El resumen debe decir que pasa, que se ha hecho ya y que falta.',
          'Los pasos deben ser accionables. Si no hay nada claro que hacer, devuelve una lista vacia.',
          'No inventes acciones que nadie ha mencionado.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [context.header, '', 'Conversacion:', context.conversation].join('\n'),
      },
    ];

    const completion = await this.provider.complete(messages, {
      temperature: 0.2,
      validate: (content) => this.parseJson(content) !== null,
    });

    const parsed = this.parseJson<{ summary?: unknown; nextSteps?: unknown }>(completion.content);

    return {
      summary:
        typeof parsed?.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : completion.content,
      nextSteps: Array.isArray(parsed?.nextSteps)
        ? parsed.nextSteps.filter((step): step is string => typeof step === 'string' && step.trim() !== '')
        : [],
      model: completion.model,
    };
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /**
   * Arma el contexto del ticket.
   *
   * Se incluyen las notas internas porque el destinatario del resultado es el
   * agente, no el cliente: son justamente donde suele estar el diagnostico.
   */
  private async buildContext(idOrCode: string): Promise<TicketContext> {
    const ticketId = await this.ticketsService.resolveId(idOrCode);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        number: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        client: { select: { name: true } },
        project: { select: { name: true, type: true } },
        category: { select: { name: true } },
        messages: {
          select: {
            body: true,
            visibility: true,
            createdAt: true,
            author: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: CONTEXT_MESSAGE_LIMIT,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    const header = [
      `Ticket ${formatTicketCode(ticket.number)}: ${ticket.subject}`,
      `Cliente: ${ticket.client.name}`,
      ticket.project ? `Servicio: ${ticket.project.name} (${ticket.project.type})` : null,
      ticket.category ? `Categoria: ${ticket.category.name}` : 'Categoria: sin clasificar',
      `Estado: ${TICKET_STATUS_LABELS[ticket.status as TicketStatus]}`,
      `Prioridad: ${TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority]}`,
      '',
      `Descripcion original:\n${ticket.description}`,
    ]
      .filter(Boolean)
      .join('\n');

    const conversation =
      ticket.messages.length === 0
        ? '(Todavia no hay mensajes en la conversacion.)'
        : ticket.messages
            .map((message) => {
              const author = message.author?.name ?? 'Sistema';
              const kind =
                message.visibility === MESSAGE_VISIBILITIES.INTERNAL
                  ? ' [nota interna, el cliente no la ve]'
                  : '';

              return `${author}${kind}: ${message.body.slice(0, MESSAGE_EXCERPT)}`;
            })
            .join('\n\n');

    return { header, conversation };
  }

  /**
   * Extrae el JSON de la respuesta del modelo.
   *
   * Aunque se le pida JSON puro, es habitual que lo envuelva en un bloque de
   * codigo o lo acompane de una frase; se recorta al primer objeto encontrado
   * en lugar de descartar toda la respuesta.
   */
  private parseJson<T>(content: string): T | null {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');

    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(content.slice(start, end + 1)) as T;
    } catch {
      this.logger.warn('El modelo devolvio un JSON que no se pudo interpretar');

      return null;
    }
  }

  /** Prioridad valida; ante cualquier otra cosa, la neutra. */
  private toPriority(value: unknown): TicketPriority {
    const candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';

    return Object.values(TICKET_PRIORITIES).includes(candidate as TicketPriority)
      ? (candidate as TicketPriority)
      : TICKET_PRIORITIES.MEDIUM;
  }
}
