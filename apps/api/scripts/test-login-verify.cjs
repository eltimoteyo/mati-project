require('dotenv/config');
const { verify } = require('@node-rs/argon2');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

async function test() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@conit.com' } });
    const ok = await verify(admin.passwordHash, 'Conit.Dev.2026');
    console.log('Verificación ADMIN (admin@conit.com + Conit.Dev.2026):', ok ? 'CORRECTA ✅' : 'FALLÓ ❌');
    
    const client = await prisma.user.findUnique({ where: { email: 'cliente@conit.com' } });
    const clientOk = await verify(client.passwordHash, 'Cliente.Demo.2026');
    console.log('Verificación CLIENTE (cliente@conit.com + Cliente.Demo.2026):', clientOk ? 'CORRECTA ✅' : 'FALLÓ ❌');
  } finally {
    await prisma.$disconnect();
  }
}
test();
