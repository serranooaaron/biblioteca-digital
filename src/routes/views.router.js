import { Router } from 'express';
import { booksService, usersService } from '../services/index.js';
import BookDTO from '../dto/Book.dto.js';
import asyncHandler from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/index.js';

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

const SORTS = {
  title: { title: 1 },
  author: { author: 1, title: 1 },
  newest: { publishedYear: -1 },
  oldest: { publishedYear: 1 },
};

router.get('/catalogo', asyncHandler(async (req, res) => {
  const q = req.query.q ? String(req.query.q).trim().slice(0, 80) : '';
  const status = ['available', 'loaned'].includes(req.query.status) ? req.query.status : '';
  const sort = SORTS[req.query.sort] ? req.query.sort : 'title';

  const filter = {};
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ title: pattern }, { author: pattern }];
  }
  if (status) filter.available = status === 'available';

  const books = await booksService.getAll(filter).sort(SORTS[sort]).lean();
  const myBookIds = new Set();
  if (req.user) {
    const me = await usersService.getUserById(req.user.id);
    me?.books.forEach((entry) => myBookIds.add(String(entry._id)));
  }

  res.render('catalog', {
    title: 'Catálogo',
    books: books.map((book) => ({ ...BookDTO.getPublicFrom(book), mine: myBookIds.has(String(book._id)) })),
    q,
    status,
    sort,
    hasFilters: Boolean(q || status || sort !== 'title'),
    loansLeft: req.user ? Math.max(0, 3 - myBookIds.size) : null,
  });
}));

export default router;
