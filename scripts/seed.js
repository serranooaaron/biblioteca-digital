// Carga el catálogo inicial y, si se definen ADMIN_EMAIL y ADMIN_PASSWORD, la cuenta administradora.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { seedBooks, seedUser } from '../src/data/seeders.js';

dotenv.config({ quiet: true });

try {
  await mongoose.connect(process.env.MONGO_URL);
  const result = await seedBooks();
  console.log(`Libros insertados: ${result.upsertedCount}`);

  const admin = await seedUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    first_name: 'Admin',
    last_name: 'Biblioteca',
  });
  console.log(admin ? `Administrador listo: ${admin.email}` : 'Sin ADMIN_EMAIL/ADMIN_PASSWORD: no se creó administrador');
} catch (error) {
  console.error('Error al ejecutar el seed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
