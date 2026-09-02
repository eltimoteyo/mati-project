/**
 * Borra los tickets de demostracion para que `db:seed` los regenere.
 *
 *   node scripts/reset-demo-tickets.cjs && pnpm db:seed
 *
 * El seed omite los tickets que ya existen, asi que un cambio en sus datos
 * (por ejemplo, los tiempos de primera respuesta) no se aplica sobre lo ya
 * sembrado. Esto los retira para poder volver a generarlos.
 */
require('dotenv/config');

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

/** Los mismos asuntos que declara `DEMO_TICKETS` en prisma/seed.ts. */
const DEMO_SUBJECTS = [
  'Certificado SSL proximo a vencer',
  'Correos corporativos no llegan a Gmail',
  'Error 500 al guardar matriculas',
  'Solicitud de respaldo de base de datos',
  'Renovacion de dominio institucional',
  'Ajuste del formulario de contacto',
  'Lentitud en el catalogo de productos',
  'Alta de nuevos buzones de correo',
  'Restauracion de copia de seguridad',
  'Carga masiva de estudiantes',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no esta definida.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const { count } = await prisma.ticket.deleteMany({
      where: { subject: { in: DEMO_SUBJECTS } },
    });

    console.log(`Tickets de demostracion retirados: ${count}`);
    console.log('Ejecuta "pnpm db:seed" para volver a generarlos.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
