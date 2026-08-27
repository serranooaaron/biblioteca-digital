import BookDTO from '../dto/Book.dto.js';
import { booksService } from '../services/index.js';
import __dirname from '../utils/index.js';

const getAllBooks = async (req, res) => {
  const books = await booksService.getAll();
  res.send({ status: 'success', payload: books });
};

const createBook = async (req, res) => {
  const { title, author, publishedYear } = req.body;
  if (!title || !author || !publishedYear) return res.status(400).send({ status: 'error', error: 'Incomplete values' });
  const result = await booksService.create(BookDTO.getBookInputFrom({ title, author, publishedYear }));
  res.send({ status: 'success', payload: result });
};

const updateBook = async (req, res) => {
  const result = await booksService.update(req.params.bid, req.body);
  if (!result) return res.status(404).send({ status: 'error', error: 'Book not found' });
  res.send({ status: 'success', message: 'Book updated' });
};

const deleteBook = async (req, res) => {
  const result = await booksService.delete(req.params.bid);
  if (!result) return res.status(404).send({ status: 'error', error: 'Book not found' });
  res.send({ status: 'success', message: 'Book deleted' });
};

const createBookWithCover = async (req, res) => {
  const { title, author, publishedYear } = req.body;
  if (!title || !author || !publishedYear || !req.file) return res.status(400).send({ status: 'error', error: 'Incomplete values' });
  const cover = `${__dirname}/../public/img/${req.file.filename}`;
  const result = await booksService.create(BookDTO.getBookInputFrom({ title, author, publishedYear, cover }));
  res.send({ status: 'success', payload: result });
};

export default { getAllBooks, createBook, updateBook, deleteBook, createBookWithCover };
