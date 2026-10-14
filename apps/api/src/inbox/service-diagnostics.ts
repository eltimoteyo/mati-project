import { lookup as dnsLookup, type LookupAddress, promises as dns } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import tls from 'node:tls';

/**
 * Comprobaciones automaticas de los servicios de un cliente.
 *
 * Antes de que la IA conteste a un "mi web no carga", el sistema mira por si
 * mismo si la web responde, si el certificado sigue vigente y si el dominio
 * resuelve y tiene correo. Con eso la IA puede decir que esta pasando en lugar
 * de suponerlo, y el ticket llega al equipo con el diagnostico hecho.
 *
 * Las direcciones pueden venir del propio chat, asi que todo pasa por
 * `safeLookup`: solo se conecta a direcciones publicas de internet. Sin esa
 * barrera, cualquiera podria escribir `http://localhost:5432` por WhatsApp y
 * usar el servidor para sondear la red interna.
 */

/** Tiempo maximo por comprobacion: el cliente esta esperando la respuesta. */
const CHECK_TIMEOUT_MS = 6_000;

/** Redirecciones que se siguen antes de dar por buena la respuesta. */
const MAX_REDIRECTS = 3;

/** Dias de margen a partir de los cuales un certificado se marca como proximo a vencer. */
const CERT_WARNING_DAYS = 15;

/**
 * Dominios de proveedores de correo y redes. Un correo `@gmail.com` en la
 * ficha o un enlace a Facebook en el chat no dicen nada de los servicios del
 * cliente, y comprobarlos solo anadiria ruido.
 */
const IGNORED_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'facebook.com',
  'instagram.com',
  'whatsapp.com',
  'wa.me',
  'youtube.com',
  'tiktok.com',
  'google.com',
]);

export interface DiagnosticTarget {
  /** Como se nombra en el resultado (servicio de la ficha o "mencionado en el chat"). */
  label: string;
  /** Direccion web a comprobar. */
  url?: string;
  /** Dominio cuyo DNS y correo se comprueban. */
  domain?: string;
}

/* -----------------------------------------------------------------------------
 * Objetivos
 * -------------------------------------------------------------------------- */

/** Dominio de una direccion, sin `www.`. `null` si no es una direccion valida. */
export function domainOf(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);

    return url.hostname.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Dominio de un correo electronico, salvo proveedores genericos. */
export function mailDomainOf(email: string | null | undefined): string | null {
  const domain = email?.split('@')[1]?.trim().toLowerCase();

  return domain && !IGNORED_DOMAINS.has(domain) ? domain : null;
}

/**
 * Direcciones y dominios que el cliente escribe en el chat (`www.conit.pe`,
 * `https://...`). Se ignoran los correos electronicos y los dominios genericos.
 */
export function extractMentionedHosts(text: string): string[] {
  const withoutEmails = text.replace(/\S+@\S+/g, ' ');
  const pattern = /\b(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})\b/gi;
  const hosts = new Set<string>();

  for (const match of withoutEmails.matchAll(pattern)) {
    const host = match[1]?.toLowerCase();
    const domain = host ? domainOf(host) : null;

    if (host && domain && !IGNORED_DOMAINS.has(domain)) hosts.add(host);
  }

  return [...hosts];
}

/* -----------------------------------------------------------------------------
 * Ejecucion
 * -------------------------------------------------------------------------- */

/** Ejecuta las comprobaciones en paralelo y devuelve una linea legible por cada una. */
export async function runDiagnostics(targets: DiagnosticTarget[]): Promise<string[]> {
  const checks: Array<Promise<string>> = [];

  for (const target of targets) {
    if (target.url) {
      checks.push(checkWebsite(target.label, target.url));

      const parsed = safeUrl(target.url);

      if (parsed?.protocol === 'https:') checks.push(checkCertificate(parsed.hostname));
    }

    if (target.domain) checks.push(checkDomain(target.label, target.domain));
  }

  const results = await Promise.allSettled(checks);

  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : 'Una comprobacion no se pudo completar.',
  );
}

async function checkWebsite(label: string, rawUrl: string): Promise<string> {
  let url = safeUrl(rawUrl);

  if (!url) return `${label} (${rawUrl}): la direccion no es valida.`;

  const started = Date.now();

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await request(url);

      if (response.status >= 300 && response.status < 400 && response.location) {
        const next = safeUrl(new URL(response.location, url).toString());

        if (!next) break;

        url = next;
        continue;
      }

      const elapsed = Date.now() - started;
      const verdict =
        response.status < 400
          ? `responde correctamente (HTTP ${response.status})`
          : response.status >= 500
            ? `responde con un error del servidor (HTTP ${response.status})`
            : `responde con un error (HTTP ${response.status})`;

      return `${label} (${url.toString()}): ${verdict} en ${elapsed} ms.`;
    }

    return `${label} (${rawUrl}): demasiadas redirecciones.`;
  } catch (error) {
    return `${label} (${rawUrl}): no responde: ${describeNetworkError(error)}.`;
  }
}

async function checkCertificate(hostname: string): Promise<string> {
  try {
    const { validTo, authorized, reason } = await readCertificate(hostname);
    const days = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
    const date = validTo.toISOString().slice(0, 10);

    if (days < 0) return `Certificado SSL de ${hostname}: VENCIDO desde ${date}.`;

    if (!authorized) {
      return `Certificado SSL de ${hostname}: no es valido para los navegadores (${reason ?? 'motivo desconocido'}).`;
    }

    return days <= CERT_WARNING_DAYS
      ? `Certificado SSL de ${hostname}: vence pronto, el ${date} (${days} dias).`
      : `Certificado SSL de ${hostname}: valido hasta el ${date} (${days} dias).`;
  } catch (error) {
    return `Certificado SSL de ${hostname}: no se pudo comprobar: ${describeNetworkError(error)}.`;
  }
}

async function checkDomain(label: string, domain: string): Promise<string> {
  const [web, mail] = await Promise.allSettled([
    resolveDns((resolver) => resolver.resolve4(domain)),
    resolveDns((resolver) => resolver.resolveMx(domain)),
  ]);

  const webText =
    web.status === 'fulfilled' && web.value.length > 0
      ? 'resuelve a una direccion web'
      : 'NO resuelve a ninguna direccion web';

  const exchanges =
    mail.status === 'fulfilled'
      ? [...mail.value].sort((a, b) => a.priority - b.priority).map((record) => record.exchange)
      : [];

  // Un MX vacio ("MX nulo") es la forma explicita de decir que el dominio no
  // recibe correo: no es lo mismo que no tener registros.
  const mailText =
    exchanges.length === 0
      ? 'NO tiene registros de correo (MX)'
      : exchanges.every((exchange) => exchange === '')
        ? 'no recibe correo (MX nulo)'
        : `correo (MX): ${exchanges.filter(Boolean).slice(0, 2).join(', ')}`;

  const missing =
    web.status === 'rejected' &&
    mail.status === 'rejected' &&
    ['ENOTFOUND', 'ESERVFAIL'].includes((web.reason as NodeJS.ErrnoException)?.code ?? '');

  return missing
    ? `Dominio ${domain} (${label}): no existe o no resuelve en DNS (puede estar vencido o mal configurado).`
    : `Dominio ${domain} (${label}): ${webText}; ${mailText}.`;
}

/* -----------------------------------------------------------------------------
 * Red
 * -------------------------------------------------------------------------- */

interface DnsQueries {
  resolve4(hostname: string): Promise<string[]>;
  resolveMx(hostname: string): Promise<Array<{ exchange: string; priority: number }>>;
}

/**
 * Resolutores publicos para las comprobaciones de dominio.
 *
 * El DNS del sistema no siempre es fiable: hay proveedores de internet que
 * contestan con datos inventados (un MX "errdomain" para cualquier dominio,
 * por ejemplo), y el diagnostico diria que el correo del cliente esta mal
 * configurado cuando no lo esta.
 */
const publicResolver = new dns.Resolver({ timeout: 3_000, tries: 1 });

publicResolver.setServers(['1.1.1.1', '8.8.8.8']);

/**
 * Consulta los resolutores publicos y, si no responden, el del sistema. Una
 * respuesta real ("no existe", "sin registros") se da por buena: solo se
 * reintenta cuando no hubo respuesta, por ejemplo si la red bloquea el DNS
 * externo.
 */
async function resolveDns<T>(query: (resolver: DnsQueries) => Promise<T>): Promise<T> {
  try {
    return await query(publicResolver);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code ?? '';

    if (['ENOTFOUND', 'ENODATA', 'ENOTIMP'].includes(code)) throw error;

    return query(dns);
  }
}

/** Solo http(s) a puertos estandar. */
function safeUrl(value: string): URL | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);

    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.port && !['80', '443'].includes(url.port)) return null;
    if (url.username || url.password) return null;

    return url;
  } catch {
    return null;
  }
}

/**
 * Resolucion de nombres que rechaza direcciones privadas o reservadas.
 *
 * Se aplica en el momento de conectar, no antes: comprobar y conectar por
 * separado permitiria que el DNS cambiase entre medias.
 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '', 4);

      return;
    }

    const list = addresses as unknown as LookupAddress[];

    if (list.length === 0 || list.some((entry) => !isPublicAddress(entry.address))) {
      callback(Object.assign(new Error('direccion no publica'), { code: 'EPRIVATE' }), '', 4);

      return;
    }

    if (options.all) {
      callback(null, list);
    } else {
      const first = list[0] as LookupAddress;

      callback(null, first.address, first.family);
    }
  });
};

/** `true` si la direccion es de internet publico. */
export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  const ip = mapped?.[1] ?? address;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a = 0, b = 0] = ip.split('.').map(Number);

    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  const lower = ip.toLowerCase();

  return !(
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    /^fe[89ab]/.test(lower) ||
    lower.startsWith('ff') ||
    lower.startsWith('2001:db8')
  );
}

interface HttpResult {
  status: number;
  location?: string;
}

/** Peticion GET que solo lee la cabecera de la respuesta. */
function request(url: URL): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup,
        timeout: CHECK_TIMEOUT_MS,
        // El certificado se valora aparte: aqui solo importa si el servidor contesta.
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'CONIT-Support-Diagnostico/1.0', Accept: 'text/html,*/*' },
      },
      (res) => {
        const location = res.headers.location;

        resolve({ status: res.statusCode ?? 0, ...(location ? { location } : {}) });
        res.destroy();
      },
    );

    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end();
  });
}

function readCertificate(
  hostname: string,
): Promise<{ validTo: Date; authorized: boolean; reason?: string }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      lookup: safeLookup,
      rejectUnauthorized: false,
      timeout: CHECK_TIMEOUT_MS,
    });

    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate();
      const reason = socket.authorizationError ? String(socket.authorizationError) : undefined;

      resolve({
        validTo: new Date(certificate.valid_to),
        authorized: socket.authorized,
        ...(reason ? { reason } : {}),
      });
      socket.end();
    });
    socket.once('timeout', () =>
      socket.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })),
    );
    socket.once('error', reject);
  });
}

function describeNetworkError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException)?.code;

  switch (code) {
    case 'ENOTFOUND':
      return 'el dominio no existe o no resuelve en DNS';
    case 'ECONNREFUSED':
      return 'el servidor rechaza la conexion';
    case 'ETIMEDOUT':
      return `no contesta (tiempo agotado tras ${CHECK_TIMEOUT_MS / 1000} s)`;
    case 'ECONNRESET':
      return 'la conexion se corto';
    case 'EPRIVATE':
      return 'apunta a una direccion interna y no se comprueba';
    default:
      return error instanceof Error ? error.message : 'error desconocido';
  }
}
