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

  // Genera un servidor autocontenido para la imagen Docker.
  output: 'standalone',
  // En un monorepo, el rastreo de dependencias debe partir de la raiz.
  outputFileTracingRoot: path.join(process.cwd(), '../../'),

  // `@conit/ui` se publica como codigo fuente TypeScript (patron de paquete
  // interno de Turborepo), por lo que Next debe compilarlo.
  transpilePackages: ['@conit/ui'],

  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
