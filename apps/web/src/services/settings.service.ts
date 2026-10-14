import type { AutomationSettings, UpdateAutomationSettingsInput } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Ajustes del sistema editables desde el panel. */
export const settingsService = {
  automation(): Promise<AutomationSettings> {
    return apiClient.get<AutomationSettings>('/settings/automation');
  },

  updateAutomation(input: UpdateAutomationSettingsInput): Promise<AutomationSettings> {
    return apiClient.patch<AutomationSettings>('/settings/automation', input);
  },
};
