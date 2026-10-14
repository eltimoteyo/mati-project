/**
 * Seed de CONIT Support.
 *
 * Ejecucion:  pnpm db:seed
 * Es idempotente: puede ejecutarse varias veces sin duplicar nada.
 *
 * Siembra tres cosas:
 *
 *  1. USUARIOS (siempre) — administrador y, opcionalmente, un cliente de
 *     demostracion. Las credenciales vienen del entorno; nunca del codigo.
 *
 *  2. CATEGORIAS (siempre) — catalogo de referencia que el sistema necesita
 *     para clasificar incidencias. No son datos de ejemplo: son configuracion
 *     inicial derivada de los servicios que presta CONIT.
 *
 *  3. DATOS DE DEMOSTRACION (solo con SEED_DEMO_DATA=true) — clientes,
 *     servicios, tickets y articulos ficticios para poder evaluar el panel.
 *     Desactivado por defecto para que nunca acaben en un despliegue real.
 *
 * Variables:
 *   ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD      (obligatorias)
 *   CLIENT_NAME / CLIENT_EMAIL / CLIENT_PASSWORD   (opcionales)
 *   SEED_DEMO_DATA=true                            (opcional)
 */

import 'dotenv/config';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VALIDATION_RULES } from '@conit/validation';
import { Algorithm, hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import {
  type CategoryColor,
  PrismaClient,
  ServiceType,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client';
import { DEMO_ARTICLES } from './seed-articles';

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida. Revisa apps/api/.env.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/* =============================================================================
 * 1. Usuarios
 * ========================================================================== */

interface UserCredentials {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const PLACEHOLDER_PASSWORDS = ['cambia_esta_password', 'change_me', 'password', '12345678'];

/**
 * Lee y valida las credenciales de un usuario desde el entorno.
 * Devuelve `null` si el bloque es opcional y no esta definido.
 */
function readCredentials(
  prefix: string,
  role: UserRole,
  required: boolean,
): UserCredentials | null {
  const name = process.env[`${prefix}_NAME`]?.trim();
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];

  if (!name && !email && !password) {
    if (!required) return null;

    throw new Error(
      `Faltan las variables ${prefix}_NAME, ${prefix}_EMAIL y ${prefix}_PASSWORD.\n` +
        'Definelas en apps/api/.env (puedes partir de apps/api/.env.example).',
    );
  }

  const missing = [
    !name && `${prefix}_NAME`,
    !email && `${prefix}_EMAIL`,
    !password && `${prefix}_PASSWORD`,
  ].filter(Boolean);

  if (missing.length > 0 || !name || !email || !password) {
    throw new Error(`Faltan variables de entorno para el seed: ${missing.join(', ')}.`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${prefix}_EMAIL no es un correo valido: "${email}".`);
  }

  if (password.length < VALIDATION_RULES.password.minLength) {
    throw new Error(
      `${prefix}_PASSWORD debe tener al menos ${VALIDATION_RULES.password.minLength} caracteres.`,
    );
  }

  if (PLACEHOLDER_PASSWORDS.includes(password.toLowerCase())) {
    throw new Error(`${prefix}_PASSWORD contiene un valor de ejemplo. Define una contrasena real.`);
  }

  return { name, email, password, role };
}

async function upsertUser(credentials: UserCredentials): Promise<string> {
  const passwordHash = await hash(credentials.password, {
    algorithm: Algorithm.Argon2id,
    ...ARGON2_OPTIONS,
  });

  const user = await prisma.user.upsert({
    where: { email: credentials.email },
    // Si el usuario ya existe no se reescribe su contrasena: volver a ejecutar
    // el seed no debe revertir un cambio de credenciales.
    update: { name: credentials.name, role: credentials.role, status: UserStatus.ACTIVE },
    create: {
      name: credentials.name,
      email: credentials.email,
      passwordHash,
      role: credentials.role,
      status: UserStatus.ACTIVE,
    },
  });

  const label = credentials.role === UserRole.ADMIN
    ? 'Administrador'
    : credentials.role === UserRole.SYSTEMS
      ? 'Sistemas'
      : 'Cliente';
  console.log(`  OK  ${label}: ${user.name} <${user.email}>  [${user.role}]`);

  return user.id;
}

/**
 * Garantiza que una cuenta CLIENT tenga la ficha que el portal necesita.
 *
 * La cuenta y la ficha son entidades distintas porque no todos los clientes
 * reciben acceso al sistema. Cuando las credenciales CLIENT_* si existen, el
 * seed debe crear tambien el enlace; sembrar solo el usuario deja una cuenta
 * que puede iniciar sesion pero recibe 403 en todo el portal.
 */
async function ensureClientProfile(credentials: UserCredentials, userId: string): Promise<void> {
  const linked = await prisma.client.findUnique({ where: { userId } });

  if (linked) {
    console.log(`  OK  Portal vinculado a la ficha: ${linked.name}`);
    return;
  }

  const existing = await prisma.client.findFirst({
    where: { email: credentials.email, userId: null },
    orderBy: { createdAt: 'asc' },
  });

  const profile = existing
    ? await prisma.client.update({
        where: { id: existing.id },
        data: { userId },
      })
    : await prisma.client.create({
        data: {
          name: credentials.name,
          contactName: credentials.name,
          email: credentials.email,
          userId,
        },
      });

  console.log(`  OK  Portal vinculado a la ficha: ${profile.name}`);
}

/* =============================================================================
 * 2. Categorias de referencia
 * ========================================================================== */

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  color: CategoryColor;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

/**
 * Catalogo inicial derivado de los servicios que presta CONIT.
 * Los tiempos son objetivos de atencion, ajustables despues desde el panel.
 */
const CATEGORIES: CategorySeed[] = [
  {
    name: 'Hosting y dominios',
    slug: 'hosting-y-dominios',
    description: 'Caidas del servidor, certificados SSL, renovaciones y DNS.',
    color: 'BRAND',
    responseTimeMinutes: 30,
    resolutionTimeMinutes: 240,
  },
  {
    name: 'Correo corporativo',
    slug: 'correo-corporativo',
    description: 'Buzones, entrega de mensajes, listas y configuracion de clientes.',
    color: 'INFO',
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 480,
  },
  {
    name: 'Sistema web',
    slug: 'sistema-web',
    description: 'Errores funcionales, rendimiento y ajustes de sistemas a medida.',
    color: 'SUCCESS',
    responseTimeMinutes: 120,
    resolutionTimeMinutes: 1_440,
  },
  {
    name: 'Aula virtual',
    slug: 'aula-virtual',
    description: 'Matriculas, cursos, accesos y contenidos de la plataforma educativa.',
    color: 'WARNING',
    responseTimeMinutes: 120,
    resolutionTimeMinutes: 1_440,
  },
  {
    name: 'Base de datos',
    slug: 'base-de-datos',
    description: 'Respaldos, restauraciones, migraciones y consultas lentas.',
    color: 'DANGER',
    responseTimeMinutes: 30,
    resolutionTimeMinutes: 480,
  },
  {
    name: 'Pagina web',
    slug: 'pagina-web',
    description: 'Contenidos, formularios, diseno y posicionamiento.',
    color: 'NEUTRAL',
    responseTimeMinutes: 240,
    resolutionTimeMinutes: 2_880,
  },
];

async function seedCategories(): Promise<void> {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      // `update` vacio a proposito: un texto o un tiempo ajustado desde el
      // panel no debe revertirse al volver a ejecutar el seed.
      update: {},
      create: category,
    });
  }

  console.log(`  OK  ${CATEGORIES.length} categorias de referencia disponibles`);
}

/* =============================================================================
 * 3. Datos de demostracion (opcionales)
 * ========================================================================== */

const DEMO_CLIENTS = [
  {
    name: 'Distribuidora Andina S.A.C.',
    taxId: '20501234567',
    email: 'sistemas@distribuidoraandina.pe',
    contactName: 'Maria Quispe',
    phone: '+51 987 654 321',
    projects: [
      {
        name: 'Tienda en linea',
        type: ServiceType.WEB_SYSTEM,
        url: 'https://distribuidoraandina.pe',
      },
      { name: 'Hosting corporativo', type: ServiceType.HOSTING, url: null },
    ],
  },
  {
    name: 'Instituto Vallejo',
    taxId: '20512345678',
    email: 'ti@institutovallejo.edu.pe',
    contactName: 'Carlos Mendoza',
    phone: '+51 998 112 233',
    projects: [
      {
        name: 'Aula virtual institucional',
        type: ServiceType.VIRTUAL_CLASSROOM,
        url: 'https://aula.institutovallejo.edu.pe',
      },
      { name: 'Dominio institucional', type: ServiceType.DOMAIN, url: null },
    ],
  },
  {
    name: 'Consultora Sur E.I.R.L.',
    taxId: '20523456789',
    email: 'admin@consultorasur.com',
    contactName: 'Lucia Ramos',
    phone: '+51 976 445 887',
    projects: [
      { name: 'Correo corporativo', type: ServiceType.EMAIL, url: null },
      { name: 'Sitio institucional', type: ServiceType.WEBSITE, url: 'https://consultorasur.com' },
    ],
  },
];

interface DemoTicket {
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  daysAgo: number;
  client: number;
  project: number;
  category: string;
  /**
   * Minutos hasta la primera respuesta.
   *
   * Se declara por ticket, y no como desfase fijo, para que el reporte de
   * cumplimiento tenga algo que medir: unos casos entran dentro del objetivo
   * de su categoria y otros no. Con todos a cero, el indicador saldria plano
   * al 100 % y no diria nada.
   */
  responseMinutes: number;
}

const DEMO_TICKETS: DemoTicket[] = [
  { responseMinutes: 12, subject: 'Certificado SSL proximo a vencer', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.CRITICAL, daysAgo: 0, client: 0, project: 1, category: 'hosting-y-dominios' },
  { responseMinutes: 35, subject: 'Correos corporativos no llegan a Gmail', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, daysAgo: 0, client: 2, project: 0, category: 'correo-corporativo' },
  { responseMinutes: 95, subject: 'Error 500 al guardar matriculas', status: TicketStatus.IN_REVIEW, priority: TicketPriority.HIGH, daysAgo: 1, client: 1, project: 0, category: 'aula-virtual' },
  { responseMinutes: 0, subject: 'Solicitud de respaldo de base de datos', status: TicketStatus.NEW, priority: TicketPriority.MEDIUM, daysAgo: 1, client: 0, project: 0, category: 'base-de-datos' },
  { responseMinutes: 210, subject: 'Renovacion de dominio institucional', status: TicketStatus.RESOLVED, priority: TicketPriority.MEDIUM, daysAgo: 3, client: 1, project: 1, category: 'hosting-y-dominios' },
  { responseMinutes: 480, subject: 'Ajuste del formulario de contacto', status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, daysAgo: 4, client: 2, project: 1, category: 'pagina-web' },
  { responseMinutes: 55, subject: 'Lentitud en el catalogo de productos', status: TicketStatus.RESOLVED, priority: TicketPriority.HIGH, daysAgo: 6, client: 0, project: 0, category: 'sistema-web' },
  { responseMinutes: 720, subject: 'Alta de nuevos buzones de correo', status: TicketStatus.CLOSED, priority: TicketPriority.LOW, daysAgo: 9, client: 2, project: 0, category: 'correo-corporativo' },
  { responseMinutes: 18, subject: 'Restauracion de copia de seguridad', status: TicketStatus.RESOLVED, priority: TicketPriority.CRITICAL, daysAgo: 11, client: 0, project: 1, category: 'base-de-datos' },
  { responseMinutes: 0, subject: 'Carga masiva de estudiantes', status: TicketStatus.NEW, priority: TicketPriority.MEDIUM, daysAgo: 2, client: 1, project: 0, category: 'aula-virtual' },
];

/** Fecha desplazada hacia atras; `days` negativo apunta al futuro. */
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9 + (Math.abs(days) % 8), (Math.abs(days) * 7) % 60, 0, 0);

  return date;
}

async function seedDemoData(adminId: string): Promise<void> {
  const clientIds: string[] = [];
  const projectIds: string[][] = [];

  for (const demo of DEMO_CLIENTS) {
    const client = await prisma.client.upsert({
      where: { taxId: demo.taxId },
      update: {},
      create: {
        name: demo.name,
        taxId: demo.taxId,
        email: demo.email,
        contactName: demo.contactName,
        phone: demo.phone,
      },
    });

    clientIds.push(client.id);

    const ids: string[] = [];

    for (const project of demo.projects) {
      const existing = await prisma.project.findFirst({
        where: { clientId: client.id, name: project.name },
        select: { id: true },
      });

      if (existing) {
        ids.push(existing.id);
        continue;
      }

      const created = await prisma.project.create({
        data: {
          clientId: client.id,
          name: project.name,
          type: project.type,
          url: project.url,
          startedAt: daysAgo(400),
          // Solo hosting y dominios tienen vencimiento; se sitúa a 25 dias
          // vista para que el filtro "proximos a vencer" tenga resultados.
          expiresAt:
            project.type === ServiceType.HOSTING || project.type === ServiceType.DOMAIN
              ? daysAgo(-25)
              : null,
        },
      });

      ids.push(created.id);
    }

    projectIds.push(ids);
  }

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

  let created = 0;

  for (const demo of DEMO_TICKETS) {
    const clientId = clientIds[demo.client];

    if (!clientId) continue;

    const already = await prisma.ticket.findFirst({
      where: { subject: demo.subject, clientId },
      select: { id: true },
    });

    if (already) continue;

    const createdAt = daysAgo(demo.daysAgo);
    const isFinished = demo.status === TicketStatus.RESOLVED || demo.status === TicketStatus.CLOSED;
    const finishedAt = daysAgo(Math.max(0, demo.daysAgo - 1));

    const ticket = await prisma.ticket.create({
      data: {
        subject: demo.subject,
        description:
          `Incidencia reportada por el cliente: ${demo.subject.toLowerCase()}. ` +
          'Descripcion de ejemplo generada por el seed de demostracion.',
        status: demo.status,
        priority: demo.priority,
        clientId,
        projectId: projectIds[demo.client]?.[demo.project] ?? null,
        categoryId: categoryBySlug.get(demo.category) ?? null,
        assigneeId: demo.status === TicketStatus.NEW ? null : adminId,
        createdById: adminId,
        createdAt,
        firstResponseAt:
          demo.status === TicketStatus.NEW
            ? null
            : new Date(createdAt.getTime() + demo.responseMinutes * 60_000),
        resolvedAt: isFinished ? finishedAt : null,
        closedAt: demo.status === TicketStatus.CLOSED ? finishedAt : null,
      },
    });

    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: adminId, type: 'CREATED', createdAt },
    });

    created += 1;
  }

  console.log(`  OK  Demostracion: ${clientIds.length} clientes, ${created} tickets nuevos`);
}

/* =============================================================================
 * Guias de soporte de primer nivel
 * ========================================================================== */

/** Carpeta de las guias; ver `prisma/guides/README.md`. */
const GUIDES_DIR = join(__dirname, 'guides');

interface SupportGuide {
  title: string;
  slug: string;
  summary: string;
  category: string;
  content: string;
}

/** Lee una guia: cabecera `clave: valor` entre `---` y el contenido en Markdown. */
function parseGuide(raw: string, file: string): SupportGuide {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);

  if (!match?.[1] || match[2] === undefined) {
    throw new Error(`La guia ${file} no tiene la cabecera entre lineas ---.`);
  }

  const meta = new Map(
    match[1]
      .split(/\r?\n/)
      .map((line) => /^(\w+):\s*(.*)$/.exec(line))
      .filter((entry): entry is RegExpExecArray => entry !== null)
      .map((entry) => [entry[1], entry[2]?.trim() ?? ''] as const),
  );

  const field = (name: string): string => {
    const value = meta.get(name);

    if (!value) throw new Error(`La guia ${file} no indica "${name}".`);

    return value;
  };

  return {
    title: field('title'),
    slug: field('slug'),
    summary: field('summary'),
    category: field('category'),
    content: match[2].replace(/\r\n/g, '\n').trim(),
  };
}

/**
 * Siembra las guias en todos los entornos, no solo en la demostracion: son el
 * contenido con el que la IA de WhatsApp intenta resolver antes de derivar.
 * Una guia que ya existe no se toca, para no pisar lo editado desde el panel.
 */
async function seedSupportGuides(authorId: string): Promise<void> {
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

  const guides = readdirSync(GUIDES_DIR)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .sort()
    .map((file) => parseGuide(readFileSync(join(GUIDES_DIR, file), 'utf8'), file));

  let created = 0;

  for (const guide of guides) {
    const already = await prisma.article.findUnique({
      where: { slug: guide.slug },
      select: { id: true },
    });

    if (already) continue;

    await prisma.article.create({
      data: {
        title: guide.title,
        slug: guide.slug,
        summary: guide.summary,
        content: guide.content,
        categoryId: categoryBySlug.get(guide.category) ?? null,
        authorId,
        isPublished: true,
      },
    });

    created += 1;
  }

  console.log(`  OK  ${created} guias de soporte nuevas (${guides.length} en total)`);
}

/* =============================================================================
 * Base de conocimiento de demostracion
 * ========================================================================== */

async function seedDemoArticles(authorId: string): Promise<void> {
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

  let created = 0;

  for (const demo of DEMO_ARTICLES) {
    const already = await prisma.article.findUnique({
      where: { slug: demo.slug },
      select: { id: true },
    });

    if (already) continue;

    await prisma.article.create({
      data: {
        title: demo.title,
        slug: demo.slug,
        summary: demo.summary,
        content: demo.content,
        categoryId: categoryBySlug.get(demo.category) ?? null,
         authorId,
         isPublished: demo.isPublished,
       },
    });

    created += 1;
  }

  console.log(`  OK  Demostracion: ${created} articulos nuevos`);
}

/* =============================================================================
 * Ejecucion
 * ========================================================================== */

async function main(): Promise<void> {
  console.log('');
  console.log('  Ejecutando seed de CONIT Support...');
  console.log('');

  const admin = readCredentials('ADMIN', UserRole.ADMIN, true);

  if (!admin) {
    throw new Error('No se pudieron leer las credenciales del administrador.');
  }

  const adminId = await upsertUser(admin);

  const systems = readCredentials('SYSTEMS', UserRole.SYSTEMS, false);

  if (systems) {
    await upsertUser(systems);
  }

  const client = readCredentials('CLIENT', UserRole.CLIENT, false);

  if (client) {
    const clientId = await upsertUser(client);
    await ensureClientProfile(client, clientId);
  }

  await seedCategories();
  await seedSupportGuides(adminId);

  if (process.env['SEED_DEMO_DATA'] === 'true') {
    await seedDemoData(adminId);
    await seedDemoArticles(adminId);
  } else {
    console.log('  --  Datos de demostracion omitidos (SEED_DEMO_DATA no es "true")');
  }

  console.log('');
  console.log('  Seed completado.');
  console.log('  La contrasena solo se establece al crear el usuario.');
  console.log('');
}

main()
  .catch((error: unknown) => {
    console.error('\n  El seed fallo:');
    console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
