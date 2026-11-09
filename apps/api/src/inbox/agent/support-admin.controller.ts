import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RawResponse } from '../../common/decorators/response.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';
import { normalizePhone } from '../../whatsapp/phone';
import { WhatsappMediaService } from '../../whatsapp/whatsapp-media.service';
import { SupportKnowledgeService } from './support-knowledge.service';

class LinkClientDto {
  @IsOptional() @IsUUID('4') clientId?: string | null;
  @IsBoolean() verified!: boolean;
}

class AssignmentDto {
  @IsOptional() @IsUUID('4') assigneeId?: string | null;
}
class TechnicalDto {
  @IsOptional() @IsString() @MaxLength(150) hostingProvider?: string;
  @IsOptional() @IsIP() expectedIp?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { each: true })
  expectedNameservers?: string[];
  @IsOptional() @IsString() @Matches(/^[a-z0-9_-]{1,63}$/i) dkimSelector?: string;
}
class FeedbackDto {
  @IsInt() @IsIn([-1, 1]) value!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
class ContactDto {
  @IsString() @MaxLength(120) name!: string;
  // Se normaliza antes de validar: "+51 987 654 321" y "987654321" quedan como
  // 51987654321, que es como Meta identifica el numero.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value,
  )
  @IsString()
  @Matches(/^\d{8,15}$/)
  phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(100) role?: string;
  @IsBoolean() verified!: boolean;
}

@ApiTags('Support operations')
@ApiCookieAuth('conit_at')
@Roles('ADMIN')
@Controller()
export class SupportAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WhatsappMediaService,
    private readonly knowledge: SupportKnowledgeService,
  ) {}

  @Patch('inbox/conversations/:id/client')
  async link(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkClientDto,
    @CurrentUser('id') actorId: string,
  ) {
    if (
      dto.clientId &&
      !(await this.prisma.client.findFirst({ where: { id: dto.clientId, status: 'ACTIVE' } }))
    )
      throw new NotFoundException('Cliente activo no encontrado');
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.whatsappConversation.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Conversación no encontrada');
      const now = new Date();
      await tx.identityChallenge.updateMany({
        where: { conversationId: id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (previous.clientId !== dto.clientId || !dto.verified)
        await tx.supportCase.updateMany({
          where: { conversationId: id, closedAt: null },
          data: { stage: 'ABANDONED', closedAt: now },
        });
      const identityStatus = dto.clientId ? (dto.verified ? 'VERIFIED' : 'CLAIMED') : 'UNKNOWN';
      const result = await tx.whatsappConversation.update({
        where: { id },
        data: {
          clientId: dto.clientId ?? null,
          identityStatus,
          identifiedBy: dto.clientId ? 'AGENT' : null,
          identifiedAt: dto.clientId ? now : null,
          aiPausedUntil: new Date(Date.now() + 86_400_000),
        },
      });
      if (dto.clientId && dto.verified)
        await tx.clientContact.upsert({
          where: { clientId_phone: { clientId: dto.clientId, phone: previous.phone } },
          create: {
            clientId: dto.clientId,
            phone: previous.phone,
            name: previous.profileName ?? 'Contacto de WhatsApp',
            verifiedAt: now,
          },
          update: { verifiedAt: now, deletedAt: null },
        });
      await tx.appSetting.upsert({
        where: { key: `identity-audit-${id}-${now.getTime()}` },
        create: {
          key: `identity-audit-${id}-${now.getTime()}`,
          value: {
            actorId,
            fromClientId: previous.clientId,
            toClientId: dto.clientId ?? null,
            identityStatus,
          },
        },
        update: {},
      });
      return { id: result.id, identityStatus: result.identityStatus };
    });
  }

  @Post('inbox/conversations/:id/messages/:messageId/feedback')
  async feedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: FeedbackDto,
  ) {
    const { count } = await this.prisma.whatsappMessage.updateMany({
      where: { id: messageId, conversationId: id, aiGenerated: true },
      data: { feedback: dto.value, feedbackReason: dto.reason ?? null },
    });
    if (!count) throw new NotFoundException('Respuesta de IA no encontrada');
    return { saved: true };
  }

  @Get('inbox/conversations/:id/messages/:messageId/media')
  @RawResponse()
  async attachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      !(await this.prisma.whatsappMessage.findFirst({
        where: { id: messageId, conversationId: id },
      }))
    )
      throw new NotFoundException('Mensaje no encontrado');
    const file = await this.media.get(messageId);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file.data);
  }

  @Get('clients/:id/contacts')
  contacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.clientContact.findMany({
      where: { clientId: id, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  @Post('clients/:id/contacts')
  async contact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ContactDto) {
    if (!(await this.prisma.client.findUnique({ where: { id } })))
      throw new NotFoundException('Cliente no encontrado');
    if (
      dto.verified &&
      (await this.prisma.clientContact.findFirst({
        where: { phone: dto.phone, clientId: { not: id }, verifiedAt: { not: null } },
      }))
    )
      throw new BadRequestException('El teléfono ya está verificado para otra empresa');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.clientContact.upsert({
        where: { clientId_phone: { clientId: id, phone: dto.phone } },
        create: {
          clientId: id,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          role: dto.role,
          verifiedAt: dto.verified ? new Date() : null,
        },
        update: {
          name: dto.name,
          email: dto.email ?? null,
          role: dto.role ?? null,
          verifiedAt: dto.verified ? new Date() : null,
          deletedAt: null,
        },
      });
      if (!dto.verified)
        await tx.supportCase.updateMany({
          where: { conversation: { clientId: id, phone: dto.phone }, closedAt: null },
          data: { stage: 'ABANDONED', closedAt: new Date() },
        });
      if (!dto.verified)
        await tx.whatsappConversation.updateMany({
          where: { clientId: id, phone: dto.phone },
          data: {
            identityStatus: 'UNKNOWN',
            clientId: null,
            identifiedBy: null,
            identifiedAt: null,
          },
        });
      return result;
    });
  }

  @Patch('clients/:id/contacts/:contactId')
  async updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: ContactDto,
  ) {
    const current = await this.prisma.clientContact.findFirst({
      where: { id: contactId, clientId: id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Contacto no encontrado');
    if (
      await this.prisma.clientContact.findFirst({
        where: {
          phone: dto.phone,
          id: { not: contactId },
          OR: [{ clientId: id }, { verifiedAt: { not: null } }],
        },
      })
    )
      throw new BadRequestException('El teléfono ya está registrado');
    return this.prisma.$transaction(async (tx) => {
      if (current.phone !== dto.phone || !dto.verified)
        await tx.supportCase.updateMany({
          where: { conversation: { clientId: id, phone: current.phone }, closedAt: null },
          data: { stage: 'ABANDONED', closedAt: new Date() },
        });
      if (current.phone !== dto.phone || !dto.verified)
        await tx.whatsappConversation.updateMany({
          where: { clientId: id, phone: current.phone },
          data: {
            clientId: null,
            identityStatus: 'UNKNOWN',
            identifiedBy: null,
            identifiedAt: null,
          },
        });
      const result = await tx.clientContact.update({
        where: { id: contactId },
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email ?? null,
          role: dto.role ?? null,
          verifiedAt: dto.verified ? new Date() : null,
        },
      });
      if (current.phone !== dto.phone)
        await tx.clientContact.upsert({
          where: { clientId_phone: { clientId: id, phone: current.phone } },
          create: { clientId: id, phone: current.phone, name: current.name, deletedAt: new Date() },
          update: { deletedAt: new Date(), verifiedAt: null },
        });
      return result;
    });
  }

  @Delete('clients/:id/contacts/:contactId')
  async removeContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    const contact = await this.prisma.clientContact.findFirst({
      where: { id: contactId, clientId: id },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    await this.prisma.$transaction([
      this.prisma.clientContact.update({
        where: { id: contactId },
        data: { deletedAt: new Date(), verifiedAt: null },
      }),
      this.prisma.supportCase.updateMany({
        where: { conversation: { clientId: id, phone: contact.phone }, closedAt: null },
        data: { stage: 'ABANDONED', closedAt: new Date() },
      }),
      this.prisma.whatsappConversation.updateMany({
        where: { clientId: id, phone: contact.phone },
        data: { clientId: null, identityStatus: 'UNKNOWN', identifiedAt: null, identifiedBy: null },
      }),
    ]);
    return { removed: true };
  }

  @Post('support/knowledge/index')
  index() {
    return this.knowledge.index();
  }

  @Get('support/categories/assignments')
  assignments() {
    return this.prisma.category.findMany({
      select: { id: true, name: true, defaultAssigneeId: true },
      orderBy: { name: 'asc' },
    });
  }

  @Patch('support/categories/:id/assignment')
  async assignment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignmentDto) {
    if (
      dto.assigneeId &&
      !(await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, role: 'ADMIN', status: 'ACTIVE' },
      }))
    )
      throw new BadRequestException('Selecciona un responsable activo');
    return this.prisma.category.update({
      where: { id },
      data: { defaultAssigneeId: dto.assigneeId ?? null },
      select: { id: true, defaultAssigneeId: true },
    });
  }

  @Get('support/projects/:id/technical')
  async technical(@Param('id', ParseUUIDPipe) id: string) {
    return (
      await this.prisma.project.findUniqueOrThrow({ where: { id }, select: { technical: true } })
    ).technical;
  }

  @Patch('support/projects/:id/technical')
  async setTechnical(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TechnicalDto) {
    return this.prisma.project.update({
      where: { id },
      data: { technical: { ...dto } },
      select: { id: true, technical: true },
    });
  }

  @Get('support/metrics')
  async metrics() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [stages, usage, feedback, ratings, daily, recent, firstResponse, resolvedWithoutTicket] =
      await Promise.all([
        this.prisma.supportCase.groupBy({
          by: ['stage'],
          where: { startedAt: { gte: since } },
          _count: true,
          _avg: { attempts: true },
        }),
        this.prisma.aiTurn.aggregate({
          where: { createdAt: { gte: since } },
          _count: true,
          _sum: { inputTokens: true, outputTokens: true, cost: true },
          _avg: { latencyMs: true },
        }),
        this.prisma.whatsappMessage.groupBy({
          by: ['feedback'],
          where: { feedback: { not: null }, createdAt: { gte: since } },
          _count: true,
        }),
        this.prisma.ticket.aggregate({
          where: { satisfaction: { not: null }, updatedAt: { gte: since } },
          _avg: { satisfaction: true },
          _count: true,
        }),
        this.prisma.$queryRaw<
          Array<{ day: string; turns: number; cost: number | null; errors: number }>
        >`SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS turns, sum(cost) AS cost, count(*) FILTER (WHERE error IS NOT NULL)::int AS errors FROM ai_turns WHERE created_at >= ${since} GROUP BY day ORDER BY day`,
        this.prisma.aiTurn.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            conversationId: true,
            model: true,
            action: true,
            latencyMs: true,
            cost: true,
            error: true,
            tools: true,
            createdAt: true,
          },
        }),
        this.prisma.$queryRaw<
          Array<{ milliseconds: number | null }>
        >`SELECT avg(extract(epoch FROM (m.first_reply - c.started_at)) * 1000)::float AS milliseconds FROM support_cases c JOIN LATERAL (SELECT min(created_at) AS first_reply FROM whatsapp_messages WHERE conversation_id = c.conversation_id AND ai_generated = true AND created_at >= c.started_at) m ON true WHERE c.started_at >= ${since}`,
        this.prisma.supportCase.count({
          where: { startedAt: { gte: since }, stage: 'RESOLVED', ticketId: null },
        }),
      ]);
    return {
      stages,
      usage,
      feedback,
      satisfaction: ratings._avg.satisfaction,
      ratings: ratings._count,
      daily,
      recent,
      resolvedWithoutTicket,
      firstResponseMs: firstResponse[0]?.milliseconds ?? null,
    };
  }
}
