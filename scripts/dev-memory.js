// Levanta la biblioteca con una base MongoDB en memoria: sirve para desarrollar y probar
// sin tocar la base real de Atlas. Los datos se borran al cerrar el proceso.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Cuentas de prueba: existen solo en la base en memoria, nunca en Atlas.
// La contraseña se genera en cada arranque y se muestra por consola.
const randomPassword = () => crypto.randomBytes(9).toString('base64url');

const DEV_ACCOUNTS = [
  { email: 'admin@biblioteca.test', password: randomPassword(), role: 'admin', first_name: 'Admin', last_name: 'Demo' },
  { email: 'lector@biblioteca.test', password: randomPassword(), role: 'user', first_name: 'Lector', last_name: 'Demo' },
];

// Préstamos de ejemplo del lector, para ver cada estado del vencimiento: vencido, por vencer y al día.
const DEMO_LOANS = [
  { title: 'Rayuela', daysLeft: -3 },
  { title: 'Dune', daysLeft: 2 },
  { title: 'Ficciones', daysLeft: 10 },
];

const mongod = await MongoMemoryServer.create();
process.env.MONGO_URL = mongod.getUri('biblioteca');
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');

// Reseñas de ejemplo de libros que el lector ya devolvió.
const DEMO_REVIEWS = [
  { title: 'Cien años de soledad', rating: 5, comment: 'Lo terminé en una semana. Macondo se queda con uno.' },
  { title: '1984', rating: 4, comment: 'Inquietante y muy actual.' },
];

const { seedBooks, seedLoan, seedReview, seedUser } = await import('../src/data/seeders.js');
await mongoose.connect(process.env.MONGO_URL);
await seedBooks();
const [, reader] = await Promise.all(DEV_ACCOUNTS.map(seedUser));
for (const loan of DEMO_LOANS) await seedLoan({ user: reader, ...loan });
for (const review of DEMO_REVIEWS) await seedReview({ user: reader, ...review });
await mongoose.disconnect();

console.log('🧪 MongoDB en memoria listo. Cuentas de prueba:');
for (const { email, password, role } of DEV_ACCOUNTS) console.log(`   ${role.padEnd(5)}  ${email} / ${password}`);

await import('../src/app.js');

const shutdown = async () => {
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
