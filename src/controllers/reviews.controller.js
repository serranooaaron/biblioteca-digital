import mongoose from 'mongoose';
import { booksService, loansService, reviewsService } from '../services/index.js';
import { COMMENT_MAX } from '../dao/models/Review.js';

// Nombre corto para mostrar junto a la reseña: "Ana G.". Nunca se expone el email.
const authorName = (user) =>
  user?.first_name ? `${user.first_name} ${user.last_name ? `${user.last_name[0]}.` : ''}`.trim() : 'Lector';

export const toPublicReview = (review, viewerId) => {
  const plain = review.toObject ? review.toObject() : review;
  const userId = String(plain.user?._id ?? plain.user);
  return {
    _id: plain._id,
    rating: plain.rating,
    comment: plain.comment,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    author: authorName(plain.user),
    mine: Boolean(viewerId) && userId === String(viewerId),
  };
};

// Solo reseña quien leyó el libro: alcanza con haberlo tenido prestado alguna vez.
export const hasBorrowed = async (userId, bookId) =>
  Boolean(await loansService.getBy({ user: userId, book: bookId }).select('_id').lean());

export const REVIEWS_PER_PAGE = 10;
const MAX_REVIEWS_PER_PAGE = 50;

const toPositiveInt = (value, fallback, max = Infinity) => {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? Math.min(number, max) : fallback;
};

// Una página de reseñas, de la más nueva a la más vieja. Nunca se traen todas de una vez.
export const getReviewsPage = async (bookId, { page, limit } = {}) => {
  const perPage = toPositiveInt(limit, REVIEWS_PER_PAGE, MAX_REVIEWS_PER_PAGE);
  const total = await reviewsService.count({ book: bookId });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = toPositiveInt(page, 1, totalPages);
  const reviews = await reviewsService
    .getAll({ book: bookId })
    .sort({ createdAt: -1, _id: -1 })
    .skip((current - 1) * perPage)
    .limit(perPage)
    .populate('user', 'first_name last_name')
    .lean();
  return { reviews, page: current, totalPages, total };
};

// La reseña del lector logueado, aunque no caiga en la página que se está viendo.
export const getMyReview = (bookId, userId) =>
  reviewsService.getBy({ book: bookId, user: userId }).lean();

const refreshBookRating = async (bookId) => {
  const summary = await reviewsService.summary(bookId);
  await booksService.update(bookId, summary);
  return summary;
};

const findBook = (bid) => (mongoose.isValidObjectId(bid) ? booksService.getBy({ _id: bid }) : null);

const getBookReviews = async (req, res) => {
  const book = await findBook(req.params.bid);
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });
  // ?page= y ?limit= (hasta 50 por página).
  const { reviews, page, totalPages, total } = await getReviewsPage(book._id, req.query);
  res.send({
    status: 'success',
    payload: {
      ratingAvg: book.ratingAvg,
      ratingCount: book.ratingCount,
      reviews: reviews.map((review) => toPublicReview(review, req.user?.id)),
      page,
      totalPages,
      total,
    },
  });
};

// Crea o reemplaza la reseña del lector logueado para ese libro.
const saveMyReview = async (req, res) => {
  const book = await findBook(req.params.bid);
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).send({ status: 'error', error: 'El puntaje va de 1 a 5 estrellas' });
  }
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  if (comment.length > COMMENT_MAX) {
    return res.status(400).send({ status: 'error', error: `El comentario admite hasta ${COMMENT_MAX} caracteres` });
  }
  if (!(await hasBorrowed(req.user.id, book._id))) {
    return res.status(403).send({ status: 'error', error: 'Solo puedes reseñar libros que pediste prestados' });
  }

  // Dos envíos simultáneos del mismo lector chocan en el índice único: el segundo reintenta como edición.
  const save = () => reviewsService.upsert(book._id, req.user.id, { rating, comment });
  const review = await save().catch((error) => (error.code === 11000 ? save() : Promise.reject(error)));
  const summary = await refreshBookRating(book._id);
  res.send({
    status: 'success',
    message: 'Review saved',
    payload: { review: toPublicReview(review, req.user.id), ...summary },
  });
};

// El autor borra su reseña; un administrador puede borrar cualquiera (moderación).
const deleteReview = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bid) || !mongoose.isValidObjectId(req.params.rid)) {
    return res.status(404).send({ status: 'error', error: 'Review not found' });
  }
  const review = await reviewsService.getBy({ _id: req.params.rid, book: req.params.bid });
  if (!review) return res.status(404).send({ status: 'error', error: 'Review not found' });
  if (req.user.role !== 'admin' && String(review.user) !== req.user.id) {
    return res.status(403).send({ status: 'error', error: 'Esta reseña no te pertenece' });
  }
  await reviewsService.delete(review._id);
  const summary = await refreshBookRating(review.book);
  res.send({ status: 'success', message: 'Review deleted', payload: summary });
};

export default { getBookReviews, saveMyReview, deleteReview };
