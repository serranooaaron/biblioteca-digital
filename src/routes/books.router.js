import { Router } from 'express';
import booksController from '../controllers/books.controller.js';
import uploader from '../utils/uploader.js';
import { requireAdmin } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// El catálogo es público; crear, editar y borrar libros es solo para administradores.
router.get('/', asyncHandler(booksController.getAllBooks));
router.post('/', requireAdmin, asyncHandler(booksController.createBook));
router.post('/withcover', requireAdmin, uploader.single('cover'), asyncHandler(booksController.createBookWithCover));
router.put('/:bid', requireAdmin, uploader.single('cover'), asyncHandler(booksController.updateBook));
router.delete('/:bid', requireAdmin, asyncHandler(booksController.deleteBook));

export default router;
