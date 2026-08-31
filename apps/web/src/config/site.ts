import { env } from '@/lib/env';

/** Identidad y rutas fijas de la aplicacion. */
export const siteConfig = {
  name: env.appName,
  company: 'CONIT',
  description:
    'Sistema corporativo de soporte tecnico de CONIT: gestion de incidencias, ' +
    'servicios y comunicacion con clientes.',
  routes: {
    home: '/',
    login: '/login',
    dashboard: '/admin',
  },
} as const;
