/**
 * Retira los restos que dejan las verificaciones end-to-end.
 *
 *   node scripts/purge-verif.cjs
 *
 * Solo toca registros cuyo nombre delata que los creo una prueba (llevan una
 * marca de tiempo o un prefijo de verificacion). No es un borrado general:
 * nunca elimina datos que no haya generado un script.
 */
require('dotenv/config');

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

/** Nombres que terminan en una marca de tiempo de 13 digitos. */
const STAMPED = /\d{13}$/;

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no esta definida.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const clients = await prisma.client.findMany({ select: { id: true, name: true } });

    for (const client of clients) {
      const isTest =
        STAMPED.test(client.name) ||
        client.name.startsWith('Cliente verificacion') ||
        client.name.startsWith('Cliente portal');

      if (!isTest) continue;

      // El usuario del portal se borra con la ficha: dejarlo suelto seria una
      // cuenta activa sin cliente al que pertenecer.
      const linked = await prisma.client.findUnique({
        where: { id: client.id },
        select: { userId: true },
      });

      // Mensajes, eventos y avisos caen en cascada al borrar el ticket.
      const { count } = await prisma.ticket.deleteMany({ where: { clientId: client.id } });
      await prisma.client.delete({ where: { id: client.id } });

      if (linked?.userId) {
        await prisma.user.delete({ where: { id: linked.userId } });
      }

      console.log(`Cliente retirado: ${client.name} (${count} ticket/s)`);
    }

    const categories = await prisma.category.findMany({ select: { id: true, name: true } });

    for (const category of categories) {
      if (!STAMPED.test(category.name) && !category.name.startsWith('KB verif')) continue;

      await prisma.category.delete({ where: { id: category.id } });
      console.log(`Categoria retirada: ${category.name}`);
    }

    const users = await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { startsWith: 'agente.verif.' } },
          { email: { startsWith: 'portal.a.' } },
          { email: { startsWith: 'cred.' } },
          { email: { startsWith: 'portal.b.' } },
          { email: { startsWith: 'agente17' } },
          { name: { startsWith: 'Agente de verificacion' } },
        ],
      },
    });
    console.log(`Usuarios de verificacion eliminados: ${users.count}`);

    const articles = await prisma.article.deleteMany({
      where: { title: { contains: 'Verificacion automatica' } },
    });
    console.log(`Articulos de verificacion eliminados: ${articles.count}`);

    const [clientCount, ticketCount, userCount, categoryCount] = await Promise.all([
      prisma.client.count(),
      prisma.ticket.count(),
      prisma.user.count(),
      prisma.category.count(),
    ]);

    console.log(
      `\nEstado final -> clientes: ${clientCount}, tickets: ${ticketCount}, ` +
        `usuarios: ${userCount}, categorias: ${categoryCount}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
