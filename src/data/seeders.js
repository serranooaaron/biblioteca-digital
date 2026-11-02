import bookModel from '../dao/models/Book.js';
import userModel from '../dao/models/User.js';
import books from './books.js';
import { createHash } from '../utils/index.js';

// Carga los libros por título y autor (no duplica si se corre varias veces).
export const seedBooks = () =>
  bookModel.bulkWrite(
    books.map((book) => ({
      updateOne: {
        filter: { title: book.title, author: book.author },
        update: { $setOnInsert: { ...book, available: true } },
        upsert: true,
      },
    }))
  );

// Crea un usuario si todavía no existe ese email.
export const seedUser = async ({ email, password, role = 'user', first_name, last_name }) => {
  if (!email || !password) return null;
  const existing = await userModel.findOne({ email: email.toLowerCase() });
  if (existing) return existing;
  return userModel.create({ first_name, last_name, email, password: await createHash(password), role });
};
