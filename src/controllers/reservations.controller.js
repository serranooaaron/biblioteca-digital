import mongoose from 'mongoose';
import BookDTO from '../dto/Book.dto.js';
import { booksService, reservationsService } from '../services/index.js';
import { MAX_RESERVATIONS, assignHold, isHeldFor, isHeld, positionOf, releaseExpiredHolds } from '../utils/reservations.js';

const BOOK_FIELDS = 'title author publishedYear cover available heldFor heldUntil';

const findBook = (bid) => (mongoose.isValidObjectId(bid) ? booksService.getBy({ _id: bid }) : null);

// Reservas del lector logueado, con su lugar en cada lista y si el libro ya lo espera.
const getMyReservations = async (req, res) => {
  await releaseExpiredHolds();
  const mine = await reservationsService.getAll({ user: req.user.id }).sort({ createdAt: 1 }).populate('book', BOOK_FIELDS).lean();
  const payload = await Promise.all(
    mine.filter((reservation) => reservation.book).map(async (reservation) => {
      const ready = isHeldFor(reservation.book, req.user.id);
      return {
        _id: reservation._id,
        createdAt: reservation.createdAt,
        position: await positionOf({ ...reservation, book: reservation.book._id }),
        ready,
        readyUntil: ready ? reservation.book.heldUntil : null,
        book: BookDTO.getPublicFrom(reservation.book),
      };
    })
  );
  res.send({ status: 'success', payload });
};

// Anotarse en la lista de espera de un libro que ahora no se puede pedir.
const reserveBook = async (req, res) => {
  await releaseExpiredHolds();
  const book = await findBook(req.params.bid);
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });

  if (String(book.borrower) === req.user.id && !book.available) {
    return res.status(400).send({ status: 'error', error: 'Ya tienes este libro prestado' });
  }
  if (book.available && (!isHeld(book) || isHeldFor(book, req.user.id))) {
    return res.status(400).send({ status: 'error', error: 'El libro está disponible: puedes pedirlo ahora' });
  }
  if (await reservationsService.getBy({ book: book._id, user: req.user.id })) {
    return res.status(409).send({ status: 'error', error: 'Ya estás en la lista de espera de este libro' });
  }
  if ((await reservationsService.count({ user: req.user.id })) >= MAX_RESERVATIONS) {
    return res.status(400).send({ status: 'error', error: `Puedes tener hasta ${MAX_RESERVATIONS} reservas a la vez` });
  }

  let reservation;
  try {
    reservation = await reservationsService.create({ book: book._id, user: req.user.id });
  } catch (error) {
    // Dos clics a la vez chocan en el índice único: la reserva ya existe.
    if (error.code === 11000) return res.status(409).send({ status: 'error', error: 'Ya estás en la lista de espera de este libro' });
    throw error;
  }
  res.status(201).send({ status: 'success', message: 'Book reserved', payload: { _id: reservation._id, position: await positionOf(reservation) } });
};

// Salir de la lista. Si el libro estaba apartado para este lector, pasa al siguiente.
const cancelReservation = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bid)) return res.status(404).send({ status: 'error', error: 'Reservation not found' });
  const reservation = await reservationsService.getBy({ book: req.params.bid, user: req.user.id });
  if (!reservation) return res.status(404).send({ status: 'error', error: 'Reservation not found' });

  await reservationsService.delete(reservation._id);
  const book = await booksService.getBy({ _id: reservation.book });
  if (book && String(book.heldFor) === req.user.id) await assignHold(book._id);
  res.send({ status: 'success', message: 'Reservation cancelled' });
};

export default { cancelReservation, getMyReservations, reserveBook };
