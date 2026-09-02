/*
 * Inicializacion de produccion sin depender de ts-node ni de la configuracion
 * TypeScript del monorepo. Se ejecuta al arrancar el contenedor y es idempotente.
 */
const { Algorithm, hash } = require('@node-rs/argon2');
const { PrismaPg } = require('@prisma/adapter-pg');
// El contenedor de produccion solo conserva el resultado de Nest en `dist`.
// Usar el cliente compilado evita depender de los fuentes TypeScript.
const { PrismaClient } = require('../dist/generated/prisma/client');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL no esta definida.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const categories = [
  ['Hosting y dominios', 'hosting-y-dominios', 'Caidas del servidor, certificados SSL, renovaciones y DNS.', 'BRAND', 30, 240],
  ['Correo corporativo', 'correo-corporativo', 'Buzones, entrega de mensajes y clientes de correo.', 'INFO', 60, 480],
  ['Sistema web', 'sistema-web', 'Errores funcionales, rendimiento y ajustes de sistemas a medida.', 'SUCCESS', 120, 1440],
  ['Aula virtual', 'aula-virtual', 'Matriculas, cursos, accesos y contenidos de la plataforma educativa.', 'WARNING', 120, 1440],
  ['Base de datos', 'base-de-datos', 'Respaldos, restauraciones, migraciones y consultas lentas.', 'DANGER', 30, 480],
  ['Pagina web', 'pagina-web', 'Contenidos, formularios, diseno y posicionamiento.', 'NEUTRAL', 240, 2880],
];

async function upsertAccount(prefix, role) {
  const name = process.env[`${prefix}_NAME`];
  const email = process.env[`${prefix}_EMAIL`]?.toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  if (!name || !email || !password) throw new Error(`Faltan credenciales ${prefix}_*.`);

  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  return prisma.user.upsert({
    where: { email },
    update: { name, role, status: 'ACTIVE' },
    create: { name, email, passwordHash, role, status: 'ACTIVE' },
  });
}

async function main() {
  const admin = await upsertAccount('ADMIN', 'ADMIN');
  const client = await upsertAccount('CLIENT', 'CLIENT');

  const linkedClient = await prisma.client.findUnique({ where: { userId: client.id } });
  if (!linkedClient) {
    const existingClient = await prisma.client.findFirst({
      where: { email: client.email, userId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (existingClient) {
      await prisma.client.update({ where: { id: existingClient.id }, data: { userId: client.id } });
    } else {
      await prisma.client.create({
        data: { name: client.name, contactName: client.name, email: client.email, userId: client.id },
      });
    }
  }

  for (const [name, slug, description, color, responseTimeMinutes, resolutionTimeMinutes] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug, description, color, responseTimeMinutes, resolutionTimeMinutes },
    });
  }

  console.log(`Inicializacion completada: ${admin.email} y ${client.email}.`);
}

main().finally(() => prisma.$disconnect());
