import path from 'node:path';

import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad aplicadas a todas las rutas.
 * La API tiene las suyas (Helmet); estas protegen el HTML servido por Next.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Genera un servidor autocontenido para la imagen Docker (en Vercel se usa la integracion nativa).
  output:
    process.env.DOCKER_BUILD === 'true' || process.env.OUTPUT_STANDALONE === 'true'
      ? 'standalone'
      : undefined,
  // En un monorepo, el rastreo de dependencias debe partir de la raiz.
  outputFileTracingRoot: path.join(process.cwd(), '../../'),

  // `@conit/ui` se publica como codigo fuente TypeScript (patron de paquete
  // interno de Turborepo), por lo que Next debe compilarlo.
  transpilePackages: ['@conit/ui', '@conit/types', '@conit/validation'],

  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  async rewrites() {
    // Si se proporciona la URL del backend, Next.js / Vercel redirige internamente
    // las peticiones de `/api/v1` y `/uploads` evitando problemas de CORS y cookies cross-origin.
    const apiTarget = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!apiTarget || !/^https?:\/\//i.test(apiTarget)) {
      return [];
    }

    const apiOrigin = apiTarget.replace(/\/api\/v\d+\/?$/, '');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
