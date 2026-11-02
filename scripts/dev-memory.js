// Levanta la biblioteca con una base MongoDB en memoria: sirve para desarrollar y probar
// sin tocar la base real de Atlas. Los datos se borran al cerrar el proceso.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Cuentas de prueba: existen solo en la base en memoria, nunca en Atlas.
const DEV_ACCOUNTS = [
  { email: 'admin@biblioteca.test', password: 'admin12345', role: 'admin', first_name: 'Admin', last_name: 'Demo' },
  { email: 'lector@biblioteca.test', password: 'lector12345', role: 'user', first_name: 'Lector', last_name: 'Demo' },
];

const mongod = await MongoMemoryServer.create();
process.env.MONGO_URL = mongod.getUri('biblioteca');
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');

const { seedBooks, seedUser } = await import('../src/data/seeders.js');
await mongoose.connect(process.env.MONGO_URL);
await seedBooks();
for (const account of DEV_ACCOUNTS) await seedUser(account);
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
