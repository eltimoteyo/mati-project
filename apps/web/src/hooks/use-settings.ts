'use client';

import type { UpdateAutomationSettingsInput } from '@conit/types';
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
