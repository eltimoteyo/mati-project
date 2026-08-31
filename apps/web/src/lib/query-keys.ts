/**
 * Fabrica de claves de TanStack Query.
 *
 * Centralizarlas evita cadenas magicas repetidas y permite invalidar de forma
 * jerarquica: invalidar `queryKeys.tickets.all` alcanza tanto a los listados
 * como a los detalles, que es lo que hace falta tras una mutacion.
 *
 * Los filtros entran como objeto dentro de la clave: dos combinaciones de
 * filtros distintas son dos entradas de cache distintas, y TanStack se encarga
 * de comparar en profundidad. El parametro se tipa como `object` y no como
 * `Record<string, unknown>` para poder recibir las interfaces de consulta de
 * cada servicio, que no declaran indice.
 */

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    summary: () => [...queryKeys.dashboard.all, 'summary'] as const,
  },

  clients: {
    all: ['clients'] as const,
    list: (filters: object) =>
      [...queryKeys.clients.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.clients.all, 'detail', id] as const,
    options: () => [...queryKeys.clients.all, 'options'] as const,
  },

  projects: {
    all: ['projects'] as const,
    list: (filters: object) =>
      [...queryKeys.projects.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
    optionsByClient: (clientId: string) =>
      [...queryKeys.projects.all, 'options', clientId] as const,
  },

  categories: {
    all: ['categories'] as const,
    list: (filters: object) =>
      [...queryKeys.categories.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.categories.all, 'detail', id] as const,
  },

  tickets: {
    all: ['tickets'] as const,
    list: (filters: object) =>
      [...queryKeys.tickets.all, 'list', filters] as const,
    detail: (idOrCode: string) => [...queryKeys.tickets.all, 'detail', idOrCode] as const,
  },

  audit: {
    all: ['audit'] as const,
    list: (filters: object) => [...queryKeys.audit.all, 'list', filters] as const,
    summary: (filters: object) => [...queryKeys.audit.all, 'summary', filters] as const,
  },

  users: {
    all: ['users'] as const,
    assignable: () => [...queryKeys.users.all, 'assignable'] as const,
  },
} as const;
