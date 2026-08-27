import { Router } from 'express';
import booksController from '../controllers/books.controller.js';
import uploader from '../utils/uploader.js';

const router = Router();

router.get('/', booksController.getAllBooks);
router.post('/', booksController.createBook);
router.post('/withcover', uploader.single('cover'), booksController.createBookWithCover);
router.put('/:bid', booksController.updateBook);
router.delete('/:bid', booksController.deleteBook);

export default router;
