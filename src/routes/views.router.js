import { Router } from 'express';
import { booksService } from '../services/index.js';
import BookDTO from '../dto/Book.dto.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// Ruta actual disponible en todas las vistas (para marcar el menú).
router.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

router.get('/', asyncHandler(async (req, res) => {
  const books = await booksService.getAll({});
  const catalog = books.map(BookDTO.getPublicFrom);
  res.render('home', {
    title: 'Inicio',
    total: catalog.length,
    available: catalog.filter((book) => book.available).length,
    latest: catalog.slice(-4).reverse(),
  });
}));

export default router;
