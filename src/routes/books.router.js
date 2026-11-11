import { Router } from 'express';
import booksController from '../controllers/books.controller.js';
import uploader from '../utils/uploader.js';
import reviewsController from '../controllers/reviews.controller.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// Las reseñas se leen sin cuenta; para escribir o borrar la propia hay que iniciar sesión.
router.get('/:bid/reviews', asyncHandler(reviewsController.getBookReviews));
router.put('/:bid/reviews', requireAuth, asyncHandler(reviewsController.saveMyReview));
router.delete('/:bid/reviews/:rid', requireAuth, asyncHandler(reviewsController.deleteReview));

// El catálogo es público; crear, editar y borrar libros es solo para administradores.
router.get('/', asyncHandler(booksController.getAllBooks));
router.post('/', requireAdmin, asyncHandler(booksController.createBook));
router.post('/withcover', requireAdmin, uploader.single('cover'), asyncHandler(booksController.createBookWithCover));
router.put('/:bid', requireAdmin, uploader.single('cover'), asyncHandler(booksController.updateBook));
router.delete('/:bid', requireAdmin, asyncHandler(booksController.deleteBook));

export default router;
