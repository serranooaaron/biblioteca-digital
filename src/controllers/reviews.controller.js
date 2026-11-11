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

export const getReviewsOf = (bookId) =>
  reviewsService.getAll({ book: bookId }).sort({ createdAt: -1 }).populate('user', 'first_name last_name').lean();

const refreshBookRating = async (bookId) => {
  const summary = await reviewsService.summary(bookId);
  await booksService.update(bookId, summary);
  return summary;
};

const findBook = (bid) => (mongoose.isValidObjectId(bid) ? booksService.getBy({ _id: bid }) : null);

const getBookReviews = async (req, res) => {
  const book = await findBook(req.params.bid);
  if (!book) return res.status(404).send({ status: 'error', error: 'Book not found' });
  const reviews = await getReviewsOf(book._id);
  res.send({
    status: 'success',
    payload: {
      ratingAvg: book.ratingAvg,
      ratingCount: book.ratingCount,
      reviews: reviews.map((review) => toPublicReview(review, req.user?.id)),
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

  const review = await reviewsService.upsert(book._id, req.user.id, { rating, comment });
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
