require('dotenv/config');
const { hash, Algorithm } = require('@node-rs/argon2');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, UserStatus, UserRole } = require('../dist/generated/prisma/client');

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

async function run() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const adminPass = 'Conit.Dev.2026';
    const adminHash = await hash(adminPass, {
      algorithm: Algorithm.Argon2id,
      ...ARGON2_OPTIONS,
    });

    const clientPass = 'Cliente.Demo.2026';
    const clientHash = await hash(clientPass, {
      algorithm: Algorithm.Argon2id,
      ...ARGON2_OPTIONS,
    });

    const admin = await prisma.user.upsert({
      where: { email: 'admin@conit.com' },
      update: {
        name: 'Administrador CONIT',
        passwordHash: adminHash,
        status: UserStatus.ACTIVE,
        role: UserRole.ADMIN,
      },
      create: {
        name: 'Administrador CONIT',
        email: 'admin@conit.com',
        passwordHash: adminHash,
        status: UserStatus.ACTIVE,
        role: UserRole.ADMIN,
      },
    });
    console.log(`ADMIN actualizado: ${admin.email} -> password restablecida a "${adminPass}"`);

    const client = await prisma.user.upsert({
      where: { email: 'cliente@conit.com' },
      update: {
        name: 'Cliente Demo',
        passwordHash: clientHash,
        status: UserStatus.ACTIVE,
        role: UserRole.CLIENT,
      },
      create: {
        name: 'Cliente Demo',
        email: 'cliente@conit.com',
        passwordHash: clientHash,
        status: UserStatus.ACTIVE,
        role: UserRole.CLIENT,
      },
    });
    console.log(`CLIENT actualizado: ${client.email} -> password restablecida a "${clientPass}"`);

    // Asegurar que el cliente tenga ficha vinculada
    let profile = await prisma.client.findFirst({ where: { userId: client.id } });
    if (!profile) {
      profile = await prisma.client.create({
        data: {
          name: 'Cliente Demo',
          contactName: 'Cliente Demo',
          email: 'cliente@conit.com',
          userId: client.id,
        },
      });
      console.log(`Ficha de cliente vinculada a ${client.email}`);
    }
  } catch (err) {
    console.error('Error al resetear contraseñas:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
