// Carga el catálogo inicial y, si se definen ADMIN_EMAIL y ADMIN_PASSWORD, la cuenta administradora.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { seedBooks, seedUser } from '../src/data/seeders.js';
import { dbOptions } from '../src/utils/db.js';
import { passwordProblem } from '../src/public/js/passwordPolicy.js';

// El .env se busca en la raíz del proyecto, sin importar desde qué carpeta se corra el script.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
dotenv.config({ path: envPath, quiet: true });
mongoose.set('strictQuery', true);

if (!process.env.MONGO_URL) {
  console.error(
    existsSync(envPath)
      ? `Falta MONGO_URL en ${envPath}: agrega la línea MONGO_URL=mongodb+srv://... con la cadena de Atlas.`
      : `No se encontró ${envPath}. Copia .env.example como .env (sin .txt al final) y completa MONGO_URL.`
  );
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URL, dbOptions());
  console.log(`Base: ${mongoose.connection.name}`);
  const result = await seedBooks();
  console.log(`Libros insertados: ${result.upsertedCount}`);

  // El administrador cumple la misma regla que cualquier cuenta.
  const adminProblem = process.env.ADMIN_PASSWORD
    ? passwordProblem(process.env.ADMIN_PASSWORD, { email: process.env.ADMIN_EMAIL, first_name: 'Admin', last_name: 'Biblioteca' })
    : null;
  if (adminProblem) throw new Error(`ADMIN_PASSWORD no es segura: ${adminProblem}. No se creó el administrador`);

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
