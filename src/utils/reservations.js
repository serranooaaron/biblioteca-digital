import mongoose from 'mongoose';
import { booksService, reservationsService } from '../services/index.js';

export const HOLD_DAYS = 3;
export const MAX_RESERVATIONS = 3;

// El apartado dura hasta el final del día número HOLD_DAYS, igual que el vencimiento de los préstamos.
export const holdUntilFrom = (start = new Date()) => {
  const until = new Date(start);
  until.setDate(until.getDate() + HOLD_DAYS);
  until.setHours(23, 59, 59, 999);
  return until;
};

export const isHeld = (book, now = new Date()) => Boolean(book.heldFor && book.heldUntil && new Date(book.heldUntil) > now);
export const isHeldFor = (book, userId, now = new Date()) => isHeld(book, now) && String(book.heldFor) === String(userId);

// Aparta el libro para el primero de su lista de espera, o lo deja libre si no espera nadie.
export const assignHold = async (bookId) => {
  const next = await reservationsService.getAll({ book: bookId }).sort({ createdAt: 1, _id: 1 }).limit(1).lean();
  const hold = next.length ? { heldFor: next[0].user, heldUntil: holdUntilFrom() } : { heldFor: null, heldUntil: null };
  return booksService.update(bookId, hold);
};

// Apartados que nadie retiró a tiempo: ese lector pierde su lugar y el libro pasa al siguiente de la lista.
export const releaseExpiredHolds = async (now = new Date()) => {
  // Operador puesto por el servidor: se marca como confiable para sanitizeFilter.
  const expired = await booksService.getAll({ heldUntil: mongoose.trusted({ $ne: null, $lt: now }) }).select('heldFor').lean();
  for (const book of expired) {
    await reservationsService.deleteMany({ book: book._id, user: book.heldFor });
    await assignHold(book._id);
  }
  return expired.length;
};

// Lugar de un lector en la lista de un libro (1 = el próximo).
export const positionOf = async (reservation) =>
  (await reservationsService.count({ book: reservation.book, createdAt: mongoose.trusted({ $lt: reservation.createdAt }) })) + 1;

// Reservas de un lector con su lugar en cada lista: Map<bookId, { position, createdAt }>.
export const reservationsOf = async (userId) => {
  const mine = await reservationsService.getAll({ user: userId }).sort({ createdAt: 1 }).lean();
  const entries = await Promise.all(
    mine.map(async (reservation) => [String(reservation.book), { position: await positionOf(reservation), createdAt: reservation.createdAt }])
  );
  return new Map(entries);
};

// Qué puede hacer un lector con un libro: pedirlo, reservarlo, o ver su lugar en la lista.
export const bookState = (book, { userId, myBookIds = new Set(), myReservations = new Map(), waiting = {}, now = new Date() } = {}) => {
  const id = String(book._id);
  const held = isHeld(book, now);
  const heldForMe = Boolean(userId) && held && String(book.heldFor) === String(userId);
  const mine = myBookIds.has(id);
  const canBorrow = Boolean(book.available) && (!held || heldForMe);
  const reservation = myReservations.get(id);
  return {
    mine,
    canBorrow,
    heldForMe,
    heldForOther: Boolean(book.available) && held && !heldForMe,
    heldUntil: held ? book.heldUntil : null,
    reservedByMe: Boolean(reservation) && !heldForMe,
    position: reservation?.position ?? null,
    waiting: waiting[id] || 0,
  };
};
