import mongoose from 'mongoose';
import BookDTO from '../dto/Book.dto.js';
import { booksService, loansService, usersService } from '../services/index.js';

const MAX_ACTIVE_LOANS = 3;
const USER_FIELDS = 'first_name last_name email';
const BOOK_FIELDS = 'title author publishedYear cover';

const toPublicLoan = (loan) => {
  const plain = loan.toObject ? loan.toObject() : loan;
  return { ...plain, book: plain.book && plain.book.title ? BookDTO.getPublicFrom(plain.book) : plain.book };
};

const isOwnerOrAdmin = (req, loan) =>
  req.user.role === 'admin' || String(loan.user?._id ?? loan.user) === req.user.id;

// Todos los préstamos (solo administradores). ?active=true muestra solo los no devueltos.
const getAllLoans = async (req, res) => {
  const filter = req.query.active === 'true' ? { returned: false } : {};
  const result = await loansService.getAll(filter).sort({ createdAt: -1 }).populate('user', USER_FIELDS).populate('book', BOOK_FIELDS);
  res.send({ status: 'success', payload: result.map(toPublicLoan) });
};

// Préstamos del usuario logueado.
const getMyLoans = async (req, res) => {
  const result = await loansService.getAll({ user: req.user.id }).sort({ createdAt: -1 }).populate('book', BOOK_FIELDS);
  res.send({ status: 'success', payload: result.map(toPublicLoan) });
};

const getLoan = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.lid)) return res.status(404).send({ status: 'error', error: 'Loan not found' });
  const loan = await loansService.getBy({ _id: req.params.lid });
  if (!loan) return res.status(404).send({ status: 'error', error: 'Loan not found' });
  if (!isOwnerOrAdmin(req, loan)) return res.status(403).send({ status: 'error', error: 'Este préstamo no te pertenece' });
  res.send({ status: 'success', payload: loan });
};

const lendBook = async (res, uid, bid) => {
  if (!mongoose.isValidObjectId(uid)) return res.status(404).send({ status: 'error', error: 'User not found' });
  if (!mongoose.isValidObjectId(bid)) return res.status(404).send({ status: 'error', error: 'Book not found' });
  const user = await usersService.getUserById(uid);
  if (!user) return res.status(404).send({ status: 'error', error: 'User not found' });
  const book = await booksService.getBy({ _id: bid });
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });
  if (!book.available) return res.status(400).send({ status: 'error', error: 'Book is already loaned' });
  if (user.books.length >= MAX_ACTIVE_LOANS) {
    return res.status(400).send({ status: 'error', error: `Puedes tener hasta ${MAX_ACTIVE_LOANS} libros prestados a la vez` });
  }

  user.books.push(book._id);
  await usersService.update(user._id, { books: user.books });
  await booksService.update(book._id, { available: false, borrower: user._id });
  const loan = await loansService.create({ user: user._id, book: book._id });
  res.send({ status: 'success', message: 'Book loaned', payload: loan._id });
};

// Un usuario pide un libro para sí mismo.
const borrowBook = (req, res) => lendBook(res, req.user.id, req.params.bid);

// Un administrador registra un préstamo a nombre de cualquier usuario.
const createLoan = (req, res) => lendBook(res, req.params.uid, req.params.bid);

const returnLoan = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.lid)) return res.status(404).send({ status: 'error', error: 'Loan not found' });
  const loan = await loansService.getBy({ _id: req.params.lid });
  if (!loan) return res.status(404).send({ status: 'error', error: 'Loan not found' });
  if (!isOwnerOrAdmin(req, loan)) return res.status(403).send({ status: 'error', error: 'Este préstamo no te pertenece' });
  if (loan.returned) return res.status(400).send({ status: 'error', error: 'El libro ya fue devuelto' });

  await loansService.update(loan._id, { returned: true, returnedAt: new Date() });
  await booksService.update(loan.book, { available: true, borrower: null });
  const user = await usersService.getUserById(loan.user);
  if (user) {
    const books = user.books.filter((entry) => String(entry._id) !== String(loan.book));
    await usersService.update(user._id, { books });
  }
  res.send({ status: 'success', message: 'Book returned' });
};

export default { borrowBook, createLoan, getAllLoans, getLoan, getMyLoans, returnLoan };
