import type { ClientPortalAccess, GrantPortalAccessInput } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Acceso de un cliente a su portal, gestionado desde el panel. */
export const portalAccessService = {
  get(clientId: string): Promise<ClientPortalAccess> {
    return apiClient.get<ClientPortalAccess>(`/clients/${clientId}/portal-access`);
  },

  grant(clientId: string, input: GrantPortalAccessInput): Promise<ClientPortalAccess> {
    return apiClient.post<ClientPortalAccess>(`/clients/${clientId}/portal-access`, input);
  },

  /** Genera una contrasena nueva y se la envia al cliente. */
  resend(clientId: string): Promise<ClientPortalAccess> {
    return apiClient.post<ClientPortalAccess>(`/clients/${clientId}/portal-access/resend`, {});
  },

  revoke(clientId: string): Promise<ClientPortalAccess> {
    return apiClient.delete<ClientPortalAccess>(`/clients/${clientId}/portal-access`);
  },
};
