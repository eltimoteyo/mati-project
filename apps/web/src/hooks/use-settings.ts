'use client';

import type { UpdateAiLimitsSettingsInput, UpdateAutomationSettingsInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { settingsService } from '@/services/settings.service';

export function useAutomationSettings() {
  return useQuery({
    queryKey: queryKeys.settings.automation(),
    queryFn: () => settingsService.automation(),
  });
}

export function useUpdateAutomationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAutomationSettingsInput) => settingsService.updateAutomation(input),
    onSuccess: (settings) => {
      // El servidor devuelve el juego completo: se siembra sin volver a pedirlo.
      queryClient.setQueryData(queryKeys.settings.automation(), settings);
      notify.success(
        settings.whatsappAutoReply
          ? 'Respuesta automatica activada'
          : 'Respuesta automatica desactivada',
      );
    },
    onError: (error) => notify.fromError(error, 'No se pudo guardar el ajuste.'),
  });
}

export function useAiLimits() {
  return useQuery({
    queryKey: queryKeys.settings.aiLimits(),
    queryFn: () => settingsService.aiLimits(),
  });
}

/** Los errores se dejan al formulario, que sabe marcarlos en cada campo. */
export function useUpdateAiLimits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAiLimitsSettingsInput) => settingsService.updateAiLimits(input),
    onSuccess: (limits) => {
      queryClient.setQueryData(queryKeys.settings.aiLimits(), limits);
      notify.success('Limites de la IA guardados');
    },
  });
}
