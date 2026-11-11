import mongoose from 'mongoose';
import BookDTO from '../dto/Book.dto.js';
import { booksService, reviewsService } from '../services/index.js';
import { escapeRegex } from '../utils/index.js';

const UPDATABLE_FIELDS = ['title', 'author', 'publishedYear'];

// Filtros opcionales: ?q= busca en título o autor, ?available=true|false filtra por disponibilidad.
const getAllBooks = async (req, res) => {
  const filter = {};
  const q = req.query.q ? String(req.query.q).trim().slice(0, 80) : '';
  if (q) {
    // Operador puesto a propósito por el servidor: se marca como confiable para sanitizeFilter.
    const pattern = mongoose.trusted({ $regex: escapeRegex(q), $options: 'i' });
    filter.$or = [{ title: pattern }, { author: pattern }];
  }
  if (req.query.available === 'true' || req.query.available === 'false') {
    filter.available = req.query.available === 'true';
  }
  const books = await booksService.getAll(filter);
  res.send({ status: 'success', payload: books.map(BookDTO.getPublicFrom) });
};

const createBook = async (req, res) => {
  const { title, author, publishedYear } = req.body;
  if (!title || !author || !publishedYear) return res.status(400).send({ status: 'error', error: 'Incomplete values' });
  const result = await booksService.create(BookDTO.getBookInputFrom({ title, author, publishedYear }));
  res.send({ status: 'success', payload: BookDTO.getPublicFrom(result) });
};

// Solo título, autor y año: la disponibilidad la manejan los préstamos, no una edición manual.
const updateBook = async (req, res) => {
  const updateBody = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => UPDATABLE_FIELDS.includes(key))
  );
  if (req.file) updateBody.cover = `/img/${req.file.filename}`;
  const result = await booksService.update(req.params.bid, updateBody);
  if (!result) return res.status(404).send({ status: 'error', error: 'Book not found' });
  res.send({ status: 'success', message: 'Book updated', payload: BookDTO.getPublicFrom(result) });
};

const deleteBook = async (req, res) => {
  const book = await booksService.getBy({ _id: req.params.bid });
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });
  if (!book.available) return res.status(409).send({ status: 'error', error: 'No se puede borrar un libro prestado' });
  await booksService.delete(req.params.bid);
  await reviewsService.deleteMany({ book: book._id });
  res.send({ status: 'success', message: 'Book deleted' });
};

const createBookWithCover = async (req, res) => {
  const { title, author, publishedYear } = req.body;
  if (!title || !author || !publishedYear || !req.file) return res.status(400).send({ status: 'error', error: 'Incomplete values' });
  // Se guarda la URL pública de la portada, no la ruta del disco del servidor.
  const cover = `/img/${req.file.filename}`;
  const result = await booksService.create(BookDTO.getBookInputFrom({ title, author, publishedYear, cover }));
  res.send({ status: 'success', payload: BookDTO.getPublicFrom(result) });
};

export default { getAllBooks, createBook, updateBook, deleteBook, createBookWithCover };
