import type {
  AiLimitsSettings,
  AutomationSettings,
  UpdateAiLimitsSettingsInput,
  UpdateAutomationSettingsInput,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Ajustes del sistema editables desde el panel. */
export const settingsService = {
  automation(): Promise<AutomationSettings> {
    return apiClient.get<AutomationSettings>('/settings/automation');
  },

  updateAutomation(input: UpdateAutomationSettingsInput): Promise<AutomationSettings> {
    return apiClient.patch<AutomationSettings>('/settings/automation', input);
  },

  aiLimits(): Promise<AiLimitsSettings> {
    return apiClient.get<AiLimitsSettings>('/settings/ai-limits');
  },

  updateAiLimits(input: UpdateAiLimitsSettingsInput): Promise<AiLimitsSettings> {
    return apiClient.patch<AiLimitsSettings>('/settings/ai-limits', input);
  },
};
