import type { AutomationSettings, UpdateAutomationSettingsInput } from '@conit/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

const AUTOMATION_KEY = 'automation';

/**
 * Valores por defecto.
 *
 * La respuesta automatica nace apagada: que una IA empiece a contestar a los
 * clientes debe ser una decision de alguien, no un efecto de desplegar.
 */
const DEFAULT_AUTOMATION: AutomationSettings = {
  whatsappAutoReply: false,
};

/**
 * Ajustes que se cambian desde el panel.
 *
 * Se guardan como JSON por clave y se leen siempre a traves de este servicio,
 * que completa lo que falte con los valores por defecto: un ajuste nuevo no
 * necesita migrar las filas existentes.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAutomation(): Promise<AutomationSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: AUTOMATION_KEY } });
    const stored =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {};

    return {
      whatsappAutoReply:
        typeof stored['whatsappAutoReply'] === 'boolean'
          ? stored['whatsappAutoReply']
          : DEFAULT_AUTOMATION.whatsappAutoReply,
    };
  }

  async updateAutomation(input: UpdateAutomationSettingsInput): Promise<AutomationSettings> {
    const next: AutomationSettings = { ...(await this.getAutomation()), ...input };

    await this.prisma.appSetting.upsert({
      where: { key: AUTOMATION_KEY },
      create: { key: AUTOMATION_KEY, value: { ...next } },
      update: { value: { ...next } },
    });

    return next;
  }
}
