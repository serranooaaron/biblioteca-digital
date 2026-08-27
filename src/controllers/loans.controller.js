import { booksService, loansService, usersService } from '../services/index.js';

const getAllLoans = async (req, res) => {
  const result = await loansService.getAll();
  res.send({ status: 'success', payload: result });
};

const getLoan = async (req, res) => {
  const loan = await loansService.getBy({ _id: req.params.lid });
  if (!loan) return res.status(404).send({ status: 'error', error: 'Loan not found' });
  res.send({ status: 'success', payload: loan });
};

const createLoan = async (req, res) => {
  const { uid, bid } = req.params;
  const user = await usersService.getUserById(uid);
  if (!user) return res.status(404).send({ status: 'error', error: 'User not found' });
  const book = await booksService.getBy({ _id: bid });
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });
  if (!book.available) return res.status(400).send({ status: 'error', error: 'Book is already loaned' });

  user.books.push(book._id);
  await usersService.update(user._id, { books: user.books });
  await booksService.update(book._id, { available: false, borrower: user._id });
  await loansService.create({ user: user._id, book: book._id });
  res.send({ status: 'success', message: 'Book loaned' });
};

export default { createLoan, getAllLoans, getLoan };
