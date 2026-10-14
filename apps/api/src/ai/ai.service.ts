import {
  AI_REPLY_TONES,
  type AiClassification,
  type AiReplyTone,
  type AiStatus,
  type AiSuggestion,
  type AiSummary,
  type AiTicketDraft,
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

/** Criterio de prioridad comun a clasificar un ticket y a proponerlo desde un chat. */
const PRIORITY_CRITERIA = [
  'Criterio de prioridad:',
  '- CRITICAL: servicio caido o datos en riesgo; afecta a todos los usuarios.',
  '- HIGH: funcion importante rota, con impacto en el trabajo diario.',
  '- MEDIUM: problema acotado o con solucion alternativa.',
  '- LOW: consulta, mejora o incidencia cosmetica.',
];

/**
 * Escapa los saltos de linea y tabuladores que aparecen literales dentro de
 * las cadenas de un JSON.
 *
 * Al escribir un mensaje de varias lineas —una lista de pasos, por ejemplo—
 * los modelos suelen meter el salto tal cual en lugar de `\n`, y `JSON.parse`
 * rechaza la respuesta entera aunque todo lo demas este bien.
 */
function escapeControlCharacters(json: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (const char of json) {
    if (!inString) {
      if (char === '"') inString = true;
      result += char;
    } else if (escaped) {
      escaped = false;
      result += char;
    } else if (char === '\\') {
      escaped = true;
      result += char;
    } else if (char === '"') {
      inString = false;
      result += char;
    } else if (char === '\n') {
      result += '\\n';
    } else if (char === '\t') {
      result += '\\t';
    } else if (char !== '\r') {
      result += char;
    }
  }

  return result;
}

/** Categoria tal como se le ofrece al modelo. */
interface CatalogueCategory {
  id: string;
  name: string;
  description: string | null;
}

/** Texto automatico y si lo escribio la IA o es la plantilla de reserva. */
export interface AutomaticText {
  text: string;
  byAi: boolean;
}

/** Lo que necesita la IA para atender un WhatsApp, ya formateado como texto. */
export interface WhatsappReplyContext {
  /** Nombre del cliente y numero, o solo el numero si es desconocido. */
  contact: string;
  /** Servicios contratados por el cliente, uno por linea. */
  services: string;
  /** Resultado de las comprobaciones automaticas, una por linea. */
  diagnostics: string;
  /** Tickets abiertos del cliente, uno por linea. */
  openTickets: string;
  /**
   * Seguimiento: la conversacion ya se derivo y espera al equipo. Describe el
   * ticket abierto (o que se paso al equipo sin ticket). Vacio si no aplica.
   */
  followUp: string;
  /** Intentos de diagnostico ya hechos sobre el problema actual. */
  troubleshootAttempts: number;
  maxTroubleshootAttempts: number;
  /** Articulos de la base de conocimiento relacionados. */
  knowledge: string;
  /** Conversacion reciente, de la mas antigua a la mas reciente. */
  transcript: string;
}

export type WhatsappAiAction = 'reply' | 'troubleshoot' | 'escalate';

export interface WhatsappReplyDecision {
  action: WhatsappAiAction;
  /**
   * Texto para el cliente. Al derivar es la explicacion de lo que podria
   * estar pasando; el codigo del ticket lo anade quien llama.
   */
  message: string;
  /** Datos del ticket, propuestos al diagnosticar o derivar. */
  draft: AiTicketDraft | null;
  reasoning: string;
  model: string;
}

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

  /** Hay proveedor configurado. Sin el, lo automatico usa textos de plantilla. */
  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  /* ---------------------------------------------------------------------------
   * Respuestas automaticas
   * ------------------------------------------------------------------------ */

  /**
   * Respuesta automatica a lo que el cliente escribe en el portal.
   *
   * Devuelve tambien si la escribio la IA, para que el mensaje se marque como
   * tal y no se confunda con una respuesta de una persona de soporte.
   */
  async portalReply(subject: string, description: string, conversation = ''): Promise<AutomaticText> {
    const fallback =
      'Hemos recibido tu consulta y la hemos enviado al equipo de sistemas. ' +
      'La revisaremos dentro de este ticket y te informaremos por aquí cuando esté resuelta.';

    if (!this.provider.isAvailable()) return { text: fallback, byAi: false };

    try {
      const completion = await this.provider.complete(
        [
          {
            role: 'system',
            content: [
              'Eres la IA de soporte de CONIT.',
              'Responde en español, de forma clara, breve y profesional.',
              'Responde la consulta del cliente sin inventar soluciones ni plazos.',
              'Indica que la solicitud queda registrada para el equipo de sistemas.',
              'Devuelve únicamente el texto que verá el cliente.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `Asunto: ${subject}\n\nConsulta: ${description}\n\nHistorial: ${conversation || 'Sin mensajes previos.'}`,
          },
        ],
        { temperature: 0.25, maxTokens: 350 },
      );

      const text = completion.content.trim();

      return text ? { text, byAi: true } : { text: fallback, byAi: false };
    } catch (error) {
      this.logger.warn(`Respuesta automática no disponible: ${this.reason(error)}`);

      return { text: fallback, byAi: false };
    }
  }

  /** Version que solo devuelve el texto, para quien no necesita saber el origen. */
  async generatePortalReply(subject: string, description: string, conversation = ''): Promise<string> {
    return (await this.portalReply(subject, description, conversation)).text;
  }

  /** Mensaje al cliente al resolverse su ticket. */
  async resolutionReply(subject: string, description: string): Promise<AutomaticText> {
    const fallback = `Ya está resuelto: hemos atendido tu solicitud sobre «${subject}». Si vuelve a ocurrir, puedes escribirnos en este mismo ticket.`;

    if (!this.provider.isAvailable()) return { text: fallback, byAi: false };

    try {
      const completion = await this.provider.complete(
        [
          {
            role: 'system',
            content:
              'Escribe un mensaje breve en español confirmando al cliente que su solicitud ya está resuelta. Devuelve solo el mensaje.',
          },
          { role: 'user', content: `Asunto: ${subject}\nDescripción: ${description}` },
        ],
        { temperature: 0.2, maxTokens: 180 },
      );

      const text = completion.content.trim();

      return text ? { text, byAi: true } : { text: fallback, byAi: false };
    } catch {
      return { text: fallback, byAi: false };
    }
  }

  /**
   * Articulo de la base de conocimiento a partir de un ticket resuelto.
   *
   * Devuelve `null` si no lo escribio la IA: un articulo de plantilla con el
   * asunto y la descripcion copiados no aporta nada a quien lo busque.
   */
  async generateKnowledgeArticle(
    subject: string,
    description: string,
    solution: string,
  ): Promise<{ title: string; summary: string; content: string } | null> {
    if (!this.provider.isAvailable()) return null;

    try {
      const completion = await this.provider.complete(
        [
          {
            role: 'system',
            content: [
              'Genera un artículo breve de base de conocimiento para soporte técnico.',
              'Responde únicamente con JSON válido: {"title":"...","summary":"...","content":"..."}.',
              'Escribe en español y no inventes pasos que no estén en la información recibida.',
              'El artículo debe servir para cualquier cliente: no incluyas nombres de clientes,',
              'personas, dominios ni datos de contacto, ni en el título ni en el contenido.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `Incidencia: ${subject}\nDescripción: ${description}\nSolución: ${solution}`,
          },
        ],
        { temperature: 0.2, maxTokens: 700, validate: (content) => this.parseJson(content) !== null },
      );

      const parsed = this.parseJson<{ title?: unknown; summary?: unknown; content?: unknown }>(
        completion.content,
      );

      if (
        typeof parsed?.title === 'string' &&
        typeof parsed.summary === 'string' &&
        typeof parsed.content === 'string'
      ) {
        return {
          title: parsed.title.trim(),
          summary: parsed.summary.trim(),
          content: parsed.content.trim(),
        };
      }
    } catch (error) {
      this.logger.warn(`Artículo automático no disponible: ${this.reason(error)}`);
    }

    return null;
  }

  /**
   * Decide como atender un mensaje de WhatsApp: contestarlo o derivarlo.
   *
   * Contesta solo lo que puede resolver con la informacion que recibe; todo lo
   * que necesita al equipo tecnico lo deriva con los datos del ticket ya
   * propuestos. Lanza si el proveedor no responde o la respuesta no se
   * entiende: quien llama trata ese caso como una derivacion.
   */
  async decideWhatsappReply(
    context: WhatsappReplyContext,
    options: { requireTroubleshoot?: boolean } = {},
  ): Promise<WhatsappReplyDecision> {
    const categories = await this.activeCategories();
    const attemptsLeft = Math.max(context.maxTroubleshootAttempts - context.troubleshootAttempts, 0);

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: [
          'Eres el asistente virtual de CONIT y atiendes a sus clientes por WhatsApp.',
          'CONIT desarrolla y mantiene sitios web, sistemas web, aulas virtuales, hosting,',
          'dominios, correo corporativo y bases de datos.',
          '',
          'Tu objetivo es resolver la consulta o dejarla bien encaminada antes de pasarla al',
          'equipo tecnico. Elige una accion:',
          '- "reply": saludos, dudas generales, el estado de un ticket, o una pregunta para',
          '  obtener un dato imprescindible.',
          '- "troubleshoot": hay un problema. Explica en lenguaje sencillo que podria estar',
          '  pasando (2 o 3 causas probables) y da de 2 a 4 pasos concretos que el cliente puede',
          '  probar por su cuenta. Apoyate en la base de conocimiento, en sus servicios y en las',
          '  comprobaciones automaticas. Termina pidiendole que te diga si se soluciono.',
          '- "escalate": hace falta el equipo tecnico.',
          '',
          'Elige "escalate" cuando:',
          '- el cliente ya probo los pasos y el problema sigue;',
          '- no quedan intentos de diagnostico (te lo indico abajo);',
          '- hace falta acceso que solo tiene CONIT: servidor, hosting, DNS, base de datos o la',
          '  configuracion del sistema;',
          '- es critico: el servicio esta caido para todos, hay datos en riesgo o un problema de',
          '  seguridad;',
          '- las comprobaciones automaticas muestran un fallo del lado de CONIT: la web no',
          '  responde o da error del servidor, el certificado vencio, el dominio no resuelve;',
          '- el cliente pide hablar con una persona o insiste en que lo atiendan.',
          '',
          'Reglas para "message":',
          '- Espanol, cordial y breve, como un WhatsApp. Sin Markdown ni titulos; si das pasos,',
          '  usa una lista corta con guiones.',
          '- No saludes otra vez si en la conversacion ya hubo saludo.',
          '- No inventes datos, plazos ni soluciones que no esten en la informacion recibida.',
          '- Si el cliente ya describio un problema concreto ("el correo no envia", "la web no',
          '  carga"), elige "troubleshoot" aunque falten detalles: en ese mismo mensaje da las causas',
          '  probables y los pasos, y anade al final las preguntas que necesites. No respondas solo',
          '  con preguntas.',
          '- Si no sabes ni cual es el problema, pide todo lo que necesites en un solo mensaje y',
          '  solo una vez. Si ya preguntaste, da causas probables y pasos con lo que tengas.',
          '- Los adjuntos aparecen como [Audio], [Imagen]...: no puedes verlos; pide que lo',
          '  describan por escrito.',
          '- Si eliges "escalate", explica en una o dos frases que podria estar pasando segun lo',
          '  que sabes. El sistema anade despues el codigo del ticket.',
          '- Si la conversacion esta en seguimiento (ya derivada), no repitas el diagnostico ni',
          '  abras otro caso: informa el estado real del ticket y que el equipo lo esta atendiendo.',
          '  Si el cliente aporta informacion nueva, agradecela y dile que el equipo la vera.',
          '',
          'Para "troubleshoot" y "escalate" rellena tambien el ticket: subject, description (que',
          'ocurre, desde cuando, a que servicio afecta, que probo el cliente y que mostraron las',
          'comprobaciones), category y priority.',
          '',
          'Responde EXCLUSIVAMENTE con un objeto JSON, sin texto alrededor ni bloques de codigo:',
          '{"action": "reply|troubleshoot|escalate", "message": "<texto para el cliente>", "subject": "<asunto>", "description": "<detalle>", "category": "<nombre exacto de la lista o null>", "priority": "<LOW|MEDIUM|HIGH|CRITICAL>", "reasoning": "<una frase>"}',
          '',
          ...PRIORITY_CRITERIA,
          '',
          this.catalogue(categories),
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Contacto: ${context.contact}`,
          '',
          'Servicios contratados:',
          context.services || '(no constan servicios)',
          '',
          'Comprobaciones automaticas hechas ahora mismo por CONIT:',
          context.diagnostics || '(no se hicieron comprobaciones)',
          '',
          'Tickets abiertos del cliente:',
          context.openTickets || '(ninguno)',
          '',
          `Seguimiento: ${context.followUp || 'no; la conversacion no se ha derivado todavia.'}`,
          '',
          `Intentos de diagnostico ya hechos: ${context.troubleshootAttempts} de ${context.maxTroubleshootAttempts}` +
            (attemptsLeft === 0 ? ' (no quedan: si el problema sigue, deriva).' : '.'),
          '',
          'Base de conocimiento relacionada:',
          context.knowledge || '(sin articulos relacionados)',
          '',
          'Conversacion, de la mas antigua a la mas reciente:',
          context.transcript,
          ...(options.requireTroubleshoot
            ? [
                '',
                'IMPORTANTE: el cliente describio un problema y todavia no se ha intentado ningun',
                'diagnostico. Responde con action "troubleshoot": explica las causas probables y da',
                'pasos concretos para probar; al final anade las preguntas que necesites.',
              ]
            : []),
        ].join('\n'),
      },
    ];

    const completion = await this.provider.complete(messages, {
      temperature: 0.2,
      maxTokens: 1200,
      validate: (content) => this.parseJson(content) !== null,
    });

    const parsed = this.parseJson<{
      action?: unknown;
      message?: unknown;
      subject?: unknown;
      description?: unknown;
      category?: unknown;
      priority?: unknown;
      reasoning?: unknown;
    }>(completion.content);

    const reasoning =
      typeof parsed?.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : 'El modelo no incluyo una justificacion.';

    const message = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
    const requested = parsed?.action;

    // Una respuesta sin texto no sirve para contestar: se trata como derivacion.
    const action: WhatsappAiAction =
      (requested === 'reply' || requested === 'troubleshoot') && message
        ? requested
        : 'escalate';

    const subject = typeof parsed?.subject === 'string' ? parsed.subject.trim() : '';
    const description = typeof parsed?.description === 'string' ? parsed.description.trim() : '';
    const matched = this.matchCategory(categories, parsed?.category);

    return {
      action,
      message,
      reasoning,
      model: completion.model,
      draft:
        action === 'reply' && !subject && !description
          ? null
          : {
              subject,
              description,
              priority: this.toPriority(parsed?.priority),
              categoryId: matched?.id ?? null,
              categoryName: matched?.name ?? null,
              reasoning,
              model: completion.model,
            },
    };
  }

  /* ---------------------------------------------------------------------------
   * Redactar una respuesta desde un ticket
   * ------------------------------------------------------------------------ */

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
      this.activeCategories(),
    ]);

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: [
          'Clasificas incidencias de soporte tecnico para CONIT.',
          '',
          'Responde EXCLUSIVAMENTE con un objeto JSON, sin texto alrededor ni bloques de codigo:',
          '{"category": "<nombre exacto de la lista o null>", "priority": "<LOW|MEDIUM|HIGH|CRITICAL>", "reasoning": "<una frase>"}',
          '',
          ...PRIORITY_CRITERIA,
          '',
          this.catalogue(categories),
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

    const matched = this.matchCategory(categories, parsed?.category);

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
   * Proponer un ticket desde un chat
   * ------------------------------------------------------------------------ */

  /**
   * Propone asunto, descripcion, prioridad y categoria a partir de una
   * conversacion de WhatsApp.
   *
   * Igual que al clasificar, la categoria se elige del catalogo real y se
   * valida contra el: un nombre inventado se descarta en lugar de colarse.
   * Los limites de longitud del ticket los aplica quien llama.
   */
  async draftTicketFromChat(contact: string, transcript: string): Promise<AiTicketDraft> {
    const categories = await this.activeCategories();

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: [
          'Conviertes conversaciones de WhatsApp con clientes de CONIT en tickets de soporte tecnico.',
          'CONIT desarrolla y mantiene sitios web, sistemas web, aulas virtuales, hosting, dominios,',
          'correo corporativo y bases de datos.',
          '',
          'Responde EXCLUSIVAMENTE con un objeto JSON, sin texto alrededor ni bloques de codigo:',
          '{"subject": "<asunto breve, maximo 120 caracteres>", "description": "<detalle para el equipo tecnico>", "category": "<nombre exacto de la lista o null>", "priority": "<LOW|MEDIUM|HIGH|CRITICAL>", "reasoning": "<una frase>"}',
          '',
          'La descripcion debe decir que ocurre, desde cuando, a que servicio afecta y que ha probado',
          'el cliente, solo con lo que aparezca en la conversacion. No inventes datos. Escribe en espanol.',
          '',
          ...PRIORITY_CRITERIA,
          '',
          this.catalogue(categories),
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Contacto: ${contact}\n\nConversacion:\n${transcript}`,
      },
    ];

    const completion = await this.provider.complete(messages, {
      temperature: 0.2,
      maxTokens: 700,
      validate: (content) => this.parseJson(content) !== null,
    });

    const parsed = this.parseJson<{
      subject?: unknown;
      description?: unknown;
      category?: unknown;
      priority?: unknown;
      reasoning?: unknown;
    }>(completion.content);

    const matched = this.matchCategory(categories, parsed?.category);

    return {
      subject: typeof parsed?.subject === 'string' ? parsed.subject.trim() : '',
      description: typeof parsed?.description === 'string' ? parsed.description.trim() : '',
      priority: this.toPriority(parsed?.priority),
      categoryId: matched?.id ?? null,
      categoryName: matched?.name ?? null,
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

    const candidate = content.slice(start, end + 1);

    // Primero tal cual; si falla, con los saltos de linea de los textos
    // escapados, que es el error mas habitual de los modelos.
    for (const attempt of [candidate, escapeControlCharacters(candidate)]) {
      try {
        return JSON.parse(attempt) as T;
      } catch {
        // Se prueba la siguiente variante.
      }
    }

    this.logger.warn('El modelo devolvio un JSON que no se pudo interpretar');

    return null;
  }

  /** Motivo legible de un fallo, para el registro. */
  private reason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /** Categorias que el modelo puede proponer. */
  private activeCategories(): Promise<CatalogueCategory[]> {
    return this.prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Catalogo de categorias tal como se le presenta al modelo. */
  private catalogue(categories: CatalogueCategory[]): string {
    if (categories.length === 0) {
      return 'No hay categorias disponibles: devuelve null en "category".';
    }

    const lines = categories.map(
      (category) => `- ${category.name}${category.description ? `: ${category.description}` : ''}`,
    );

    return `Categorias disponibles (usa el nombre exacto):\n${lines.join('\n')}`;
  }

  /**
   * Categoria propuesta, solo si existe de verdad.
   *
   * Un modelo puede inventarse un nombre plausible que no corresponda a
   * ninguna fila; en ese caso se devuelve `undefined` en lugar de colarlo.
   */
  private matchCategory(
    categories: CatalogueCategory[],
    proposed: unknown,
  ): CatalogueCategory | undefined {
    if (typeof proposed !== 'string') return undefined;

    const name = proposed.trim().toLowerCase();

    return categories.find((category) => category.name.toLowerCase() === name);
  }

  /** Prioridad valida; ante cualquier otra cosa, la neutra. */
  private toPriority(value: unknown): TicketPriority {
    const candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';

    return Object.values(TICKET_PRIORITIES).includes(candidate as TicketPriority)
      ? (candidate as TicketPriority)
      : TICKET_PRIORITIES.MEDIUM;
  }
}
