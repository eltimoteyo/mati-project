require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

(async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    console.log('--- CLIENTES ---');
    for (const c of await prisma.client.findMany({ select: { name: true, email: true } })) {
      console.log(`  ${c.name}  <${c.email}>`);
    }
    console.log('--- USUARIOS ---');
    for (const u of await prisma.user.findMany({ select: { name: true, email: true, role: true, status: true } })) {
      console.log(`  ${u.name}  <${u.email}>  ${u.role}/${u.status}`);
    }
    console.log('--- CATEGORIAS ---');
    for (const c of await prisma.category.findMany({ select: { name: true } })) {
      console.log(`  ${c.name}`);
    }
    console.log('--- SERVICIOS ---');
    for (const p of await prisma.project.findMany({ select: { name: true } })) {
      console.log(`  ${p.name}`);
    }
    console.log('--- PRIMERA RESPUESTA ---');
    const t = await prisma.ticket.findMany({
      where: { firstResponseAt: { not: null } },
      select: { number: true, createdAt: true, firstResponseAt: true },
      orderBy: { number: 'asc' },
    });
    for (const x of t) {
      const mins = Math.round((x.firstResponseAt - x.createdAt) / 60000);
      console.log(`  CNT-${String(x.number).padStart(4,'0')}  ${mins} min`);
    }
    console.log(`  (tickets con primera respuesta: ${t.length})`);
  } finally { await prisma.$disconnect(); }
})();
