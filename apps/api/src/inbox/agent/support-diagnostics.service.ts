import { promises as dns } from 'node:dns';
import { connect } from 'node:net';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import {
  isPublicAddress,
  readPublicJson,
  runDiagnostics,
  safeLookup,
} from '../service-diagnostics';

@Injectable()
export class SupportDiagnosticsService {
  private readonly dnsblZones: string[];
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.dnsblZones = config.get('ai', { infer: true }).dnsblZones;
  }

  async run(
    domain: string,
    technical: Record<string, unknown> = {},
    signal: AbortSignal = AbortSignal.timeout(25_000),
  ) {
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain) ||
      /\.(?:local|internal|localhost|test|invalid)$/i.test(domain)
    )
      throw new Error('Dominio público inválido');
    const key = `diagnostic:${domain}:${JSON.stringify(technical)}`.slice(0, 300);
    const cached = await this.prisma.diagnosticCache.findUnique({ where: { key } });
    if (cached && cached.expiresAt > new Date()) return cached.result;
    const resolver = new dns.Resolver({ timeout: 2500, tries: 1 });
    resolver.setServers(['1.1.1.1', '8.8.8.8']);
    const result = await runDiagnostics(
      [{ label: domain, url: `https://${domain}`, domain }],
      signal,
    );
    const checks = await Promise.allSettled([
      resolver.resolveTxt(domain),
      resolver.resolveTxt(`_dmarc.${domain}`),
      resolver.resolveNs(domain),
      resolver.resolve4(domain),
      ...(typeof technical.dkimSelector === 'string' &&
      /^[a-z0-9_-]{1,63}$/i.test(technical.dkimSelector)
        ? [resolver.resolveTxt(`${technical.dkimSelector}._domainkey.${domain}`)]
        : []),
    ]);
    const spf = checks[0];
    const dmarc = checks[1];
    const ns = checks[2];
    const addresses = checks[3];
    const dkim = checks[4];
    result.push(
      spf?.status === 'fulfilled' &&
        (spf.value as string[][]).some((parts) => parts.join('').startsWith('v=spf1'))
        ? 'SPF: configurado; su presencia no garantiza que todos los remitentes estén autorizados.'
        : 'SPF: no se pudo confirmar un registro SPF; puede causar rechazos o spam.',
    );
    result.push(
      dmarc?.status === 'fulfilled' &&
        (dmarc.value as string[][]).some((parts) => parts.join('').startsWith('v=DMARC1'))
        ? 'DMARC: configurado.'
        : 'DMARC: no se pudo confirmar un registro DMARC.',
    );
    if (dkim)
      result.push(
        dkim.status === 'fulfilled'
          ? 'DKIM: el selector configurado tiene registro DNS.'
          : 'DKIM: no se pudo consultar el selector configurado.',
      );
    else result.push('DKIM: sin selector conocido; no se puede comprobar.');
    if (ns?.status === 'fulfilled') {
      result.push(`Servidores DNS: ${(ns.value as string[]).join(', ')}.`);
      if (Array.isArray(technical.expectedNameservers)) {
        const expected = technical.expectedNameservers
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.toLowerCase());
        if (!(ns.value as string[]).every((item) => expected.includes(item.toLowerCase())))
          result.push('Los servidores DNS difieren de los esperados en la ficha.');
      }
    }
    if (
      typeof technical.expectedIp === 'string' &&
      addresses?.status === 'fulfilled' &&
      !(addresses.value as string[]).includes(technical.expectedIp)
    )
      result.push('La IP pública no coincide con la IP esperada en la ficha.');
    try {
      const [mx] = (await resolver.resolveMx(domain)).sort((a, b) => a.priority - b.priority);
      if (mx?.exchange && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(mx.exchange)) {
        const ports = await Promise.allSettled(
          [465, 587, 993].map(
            (port) =>
              new Promise<string>((resolve, reject) => {
                const socket = connect({ host: mx.exchange, port, lookup: safeLookup, signal });
                const timeout = setTimeout(() => socket.destroy(new Error('timeout')), 3000);
                socket.once('connect', () => {
                  clearTimeout(timeout);
                  socket.destroy();
                  resolve(
                    `Correo ${mx.exchange}:${port}: acepta conexiones TCP; esto no verifica autenticación ni entrega.`,
                  );
                });
                socket.once('error', () => {
                  clearTimeout(timeout);
                  reject(new Error(`Correo ${mx.exchange}:${port}: no se pudo conectar.`));
                });
              }),
          ),
        );
        result.push(
          ...ports.map((port) =>
            port.status === 'fulfilled' ? port.value : (port.reason as Error).message,
          ),
        );
        const mailIps = await resolver.resolve4(mx.exchange).catch(() => []);
        for (const zone of this.dnsblZones
          .filter((zone) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(zone))
          .slice(0, 3)) {
          for (const ip of mailIps.filter(isPublicAddress).slice(0, 1)) {
            const listed = await resolver
              .resolve4(`${ip.split('.').reverse().join('.')}.${zone}`)
              .catch(() => []);
            result.push(
              listed.some((entry) => entry.startsWith('127.0.0.') && !entry.endsWith('.255'))
                ? `DNSBL ${zone}: hay una respuesta de listado para la IP de correo; el técnico debe confirmar el motivo con el proveedor.`
                : `DNSBL ${zone}: no se confirmó un listado (no demuestra reputación limpia).`,
            );
          }
        }
      }
    } catch {
      result.push('Puertos de correo: sin MX comprobable.');
    }
    // RDAP es una consulta pública a un host fijo; no se siguen redirecciones arbitrarias.
    try {
      const data = (await readPublicJson(
        `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        signal,
      )) as { events?: Array<{ eventAction: string; eventDate: string }> };
      const expiry = data.events?.find((event) => event.eventAction === 'expiration');
      if (expiry)
        result.push(`Vencimiento del dominio según RDAP: ${expiry.eventDate.slice(0, 10)}.`);
    } catch {
      result.push(
        'Vencimiento RDAP: no disponible; no se puede afirmar que el dominio haya vencido.',
      );
    }
    await this.prisma.diagnosticCache.upsert({
      where: { key },
      create: { key, result, expiresAt: new Date(Date.now() + 300_000) },
      update: { result, expiresAt: new Date(Date.now() + 300_000) },
    });
    return result;
  }
}
