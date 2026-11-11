import { Router } from 'express';
import mongoose from 'mongoose';
import { booksService, loansService, usersService } from '../services/index.js';
import { getReviewsOf, hasBorrowed, toPublicReview } from '../controllers/reviews.controller.js';
import { COMMENT_MAX } from '../dao/models/Review.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import UserDTO from '../dto/User.dto.js';
import BookDTO from '../dto/Book.dto.js';
import asyncHandler from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/index.js';
import { LOAN_DAYS, loanStatus } from '../utils/loans.js';

const router = Router();

// Datos comunes a todas las vistas: ruta actual (para marcar el menú) y préstamos vencidos del lector.
router.use(asyncHandler(async (req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.overdueCount = 0;
  if (req.user) {
    const active = await loansService.getAll({ user: req.user.id, returned: false }).select('dueDate createdAt returned').lean();
    res.locals.overdueCount = active.filter((loan) => loanStatus(loan).overdue).length;
  }
  next();
}));

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

router.get('/libros/:bid', asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.bid)) return next();
  const book = await booksService.getBy({ _id: req.params.bid }).lean();
  if (!book) return next();

  const reviews = (await getReviewsOf(book._id)).map((review) => toPublicReview(review, req.user?.id));
  const myReview = reviews.find((review) => review.mine) || null;
  const canReview = req.user ? Boolean(myReview) || (await hasBorrowed(req.user.id, book._id)) : false;
  const counts = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((review) => review.rating === stars).length;
    return { stars, count, percent: reviews.length ? Math.round((count / reviews.length) * 100) : 0 };
  });

  res.render('book', {
    title: book.title,
    book: BookDTO.getPublicFrom(book),
    reviews,
    myReview,
    canReview,
    counts,
    commentMax: COMMENT_MAX,
    loginNext: encodeURIComponent(req.originalUrl),
  });
}));

// Los que vencen antes van primero: lo más urgente queda arriba.
const byDueDate = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);

router.get('/mis-prestamos', requireAuth, asyncHandler(async (req, res) => {
  const loans = await loansService.getAll({ user: req.user.id }).sort({ createdAt: -1 }).populate('book').lean();
  const withBook = loans
    .filter((loan) => loan.book)
    .map((loan) => ({ ...loan, ...loanStatus(loan), book: BookDTO.getPublicFrom(loan.book) }));
  res.render('loans', {
    title: 'Mis préstamos',
    active: withBook.filter((loan) => !loan.returned).sort(byDueDate),
    history: withBook.filter((loan) => loan.returned),
    loanDays: LOAN_DAYS,
  });
}));

const ADMIN_TABS = ['libros', 'prestamos', 'usuarios'];

router.get('/admin', requireAdmin, asyncHandler(async (req, res) => {
  const tab = ADMIN_TABS.includes(req.query.tab) ? req.query.tab : 'libros';
  const [books, activeLoans, users] = await Promise.all([
    booksService.getAll({}).sort({ title: 1 }).lean(),
    loansService.getAll({ returned: false }).sort({ createdAt: -1 }).populate('user', 'first_name last_name email').populate('book', 'title author').lean(),
    usersService.getAll({}).sort({ last_name: 1, first_name: 1 }).lean(),
  ]);

  const currentLoans = activeLoans
    .filter((loan) => loan.user && loan.book)
    .map((loan) => ({ ...loan, ...loanStatus(loan) }))
    .sort(byDueDate);

  res.render('admin', {
    title: 'Administración',
    tab,
    isBooks: tab === 'libros',
    isLoans: tab === 'prestamos',
    isUsers: tab === 'usuarios',
    books: books.map(BookDTO.getPublicFrom),
    availableBooks: books.filter((book) => book.available),
    activeLoans: currentLoans,
    users: users.map((user) => ({ ...UserDTO.getPublicFrom(user), isMe: String(user._id) === req.user.id })),
    stats: {
      books: books.length,
      loaned: books.filter((book) => !book.available).length,
      overdue: currentLoans.filter((loan) => loan.overdue).length,
      users: users.length,
    },
  });
}));

// Solo se aceptan rutas internas como destino tras el login (evita redirecciones abiertas a otros sitios).
const safeNext = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/catalogo';

const authPage = (view, title) => (req, res) => {
  const next = safeNext(req.query.next);
  if (req.user) return res.redirect(next);
  return res.render(view, { title, next });
};

router.get('/login', authPage('login', 'Ingresar'));
router.get('/register', authPage('register', 'Crear cuenta'));

export default router;
