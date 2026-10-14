import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AiModule } from './ai/ai.module';
import { ArticlesModule } from './articles/articles.module';
import { AuditModule } from './audit/audit.module';
import { AUTH_MESSAGES } from './auth/auth.constants';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CategoriesModule } from './categories/categories.module';
import { ClientsModule } from './clients/clients.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppConfigModule } from './config/config.module';
import type { AppConfig } from './config/configuration';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { InboxModule } from './inbox/inbox.module';
import { MailModule } from './mail/mail.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PortalModule } from './portal/portal.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { WhatsappCloudModule } from './whatsapp/whatsapp-cloud.module';

/**
 * Modulo raiz.
 *
 * Los guards se registran globalmente y en este orden concreto:
 *   1. `ThrottlerGuard`  — descarta el exceso de trafico antes de gastar CPU.
 *   2. `JwtAuthGuard`    — deniega por defecto; `@Public()` es la excepcion.
 *   3. `RolesGuard`      — autoriza por rol una vez conocido el usuario.
 *
 * Todo modulo nuevo se anade a `imports` sin tocar nada mas: nace protegido
 * y con el mismo contrato de respuesta.
 */
@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const throttle = configService.get('throttle', { infer: true });

        return {
          throttlers: [{ ttl: throttle.ttl, limit: throttle.limit }],
          errorMessage: AUTH_MESSAGES.tooManyAttempts,
        };
      },
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,

    // --- Dominio ------------------------------------------------------------
    ClientsModule,
    ProjectsModule,
    CategoriesModule,
    TicketsModule,
    MessagesModule,
    DashboardModule,
    AuditModule,
    ArticlesModule,
    ReportsModule,
    NotificationsModule,
    PortalModule,
    MailModule,
    AiModule,
    WhatsappModule,
    WhatsappCloudModule,
    SettingsModule,
    InboxModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
