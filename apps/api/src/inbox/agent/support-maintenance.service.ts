import { createHash } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { WhatsappMediaService } from '../../whatsapp/whatsapp-media.service';
import { domainOf } from '../service-diagnostics';
import { SupportCasesService } from './support-cases.service';
import { SupportDiagnosticsService } from './support-diagnostics.service';
import { SupportToolsService } from './support-tools.service';

@Injectable()
export class SupportMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportMaintenanceService.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private readonly enabled: boolean;
  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: SupportCasesService,
    private readonly media: WhatsappMediaService,
    private readonly diagnostics: SupportDiagnosticsService,
    private readonly tools: SupportToolsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.enabled = config.get('ai', { infer: true }).monitorEnabled;
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.run()
          .catch((error: unknown) =>
            this.logger.warn(error instanceof Error ? error.message : 'Fallo de mantenimiento'),
          )
          .finally(() => {
            this.active = undefined;
          });
    }, 600_000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  private async run() {
    await this.cases.expire();
    await this.media.purge();
    await this.prisma.diagnosticCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.identityChallenge.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } },
    });
    if (!this.enabled) return;
    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE', url: { not: null } },
      select: { url: true },
    });
    for (const host of new Set(
      projects
        .map((project) => domainOf(project.url!))
        .filter((domain): domain is string => Boolean(domain)),
    )) {
      const lines = await this.diagnostics.run(host);
      const text = JSON.stringify(lines);
      const failed = /HTTP 5\d\d|NO resuelve|VENCIDO|no responde:/i.test(text);
      const active = await this.prisma.serviceIncident.findFirst({
        where: { host, closedAt: null },
      });
      if (failed && !active) {
        const previous = await this.prisma.appSetting.findUnique({
          where: { key: `monitor-${createHash('sha256').update(host).digest('hex')}` },
        });
        if (previous?.value === true) {
          try {
            await this.prisma.serviceIncident.create({
              data: { host, summary: text.slice(0, 2000) },
            });
            await this.tools.notify(
              'Incidencia detectada en un servicio',
              `${host}: revisa las comprobaciones del monitor.`,
            );
          } catch {
            /* El índice parcial impide incidentes simultáneos para el mismo host. */
          }
        }
      } else if (!failed && active)
        await this.prisma.serviceIncident.update({
          where: { id: active.id },
          data: { closedAt: new Date() },
        });
      await this.prisma.appSetting.upsert({
        where: { key: `monitor-${createHash('sha256').update(host).digest('hex')}` },
        create: {
          key: `monitor-${createHash('sha256').update(host).digest('hex')}`,
          value: failed,
        },
        update: { value: failed },
      });
    }
  }
}
