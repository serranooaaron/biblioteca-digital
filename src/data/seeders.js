import bookModel from '../dao/models/Book.js';
import loanModel from '../dao/models/Loan.js';
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

// Registra un préstamo de ejemplo con el vencimiento a tantos días de hoy (negativo = vencido).
export const seedLoan = async ({ user, title, daysLeft }) => {
  const book = await bookModel.findOne({ title });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysLeft);
  dueDate.setHours(23, 59, 59, 999);
  await loanModel.create({ user: user._id, book: book._id, dueDate });
  await bookModel.updateOne({ _id: book._id }, { available: false, borrower: user._id });
  await userModel.updateOne({ _id: user._id }, { $push: { books: { _id: book._id } } });
};

// Crea un usuario si todavía no existe ese email.
export const seedUser = async ({ email, password, role = 'user', first_name, last_name }) => {
  if (!email || !password) return null;
  const existing = await userModel.findOne({ email: email.toLowerCase() });
  if (existing) return existing;
  return userModel.create({ first_name, last_name, email, password: await createHash(password), role });
};
