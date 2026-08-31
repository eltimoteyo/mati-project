/**
 * Elimina los registros que dejan las verificaciones end-to-end.
 * Uso puntual durante el desarrollo:
 *
 *   node scripts/cleanup-test-data.cjs
 */
require('dotenv/config');

const { PrismaPg } = require('@prisma/adapter-pg');

// Se usa el cliente ya compilado: `src/generated` es TypeScript y Node no
// puede requerirlo directamente. Ejecuta `pnpm build` antes si hace falta.
const { PrismaClient } = require('../dist/generated/prisma/client');

const TEST_PROJECT_NAMES = ['Servicio de prueba', 'Fechas invertidas'];
const TEST_CATEGORY_NAMES = ['Categoria de prueba automatizada', 'Tiempos incoherentes'];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no esta definida.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    // Notas y mensajes dejados por las pruebas de interfaz.
    const notes = await prisma.ticketEvent.deleteMany({
      where: { note: { contains: 'verificacion de interfaz' } },
    });
    const messages = await prisma.message.deleteMany({
      where: { body: { contains: 'verificacion' } },
    });

    // Un ticket sin ninguna respuesta publica no debe conservar la marca de
    // primera respuesta que dejo la prueba.
    await prisma.ticket.updateMany({
      where: { messages: { none: { visibility: 'PUBLIC' } } },
      data: { firstResponseAt: null },
    });

    // El orden importa: los tickets referencian a los demas registros.
    const tickets = await prisma.ticket.deleteMany({
      where: { subject: { contains: 'verificacion automatizada' } },
    });
    const projects = await prisma.project.deleteMany({
      where: { name: { in: TEST_PROJECT_NAMES } },
    });
    const clients = await prisma.client.deleteMany({
      where: { name: { contains: 'prueba automatizada' } },
    });
    const categories = await prisma.category.deleteMany({
      where: { name: { in: TEST_CATEGORY_NAMES } },
    });

    console.log(
      `limpieza -> notas: ${notes.count}, mensajes: ${messages.count}, tickets: ${tickets.count}, ` +
        `servicios: ${projects.count}, clientes: ${clients.count}, categorias: ${categories.count}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
