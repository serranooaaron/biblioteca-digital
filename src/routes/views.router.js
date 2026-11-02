import { Router } from 'express';
import { booksService, loansService, usersService } from '../services/index.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import UserDTO from '../dto/User.dto.js';
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

const DAY_MS = 24 * 60 * 60 * 1000;

router.get('/mis-prestamos', requireAuth, asyncHandler(async (req, res) => {
  const loans = await loansService.getAll({ user: req.user.id }).sort({ createdAt: -1 }).populate('book').lean();
  const withBook = loans
    .filter((loan) => loan.book)
    .map((loan) => ({
      ...loan,
      book: BookDTO.getPublicFrom(loan.book),
      days: Math.max(0, Math.floor((Date.now() - new Date(loan.createdAt)) / DAY_MS)),
    }));
  res.render('loans', {
    title: 'Mis préstamos',
    active: withBook.filter((loan) => !loan.returned),
    history: withBook.filter((loan) => loan.returned),
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

  res.render('admin', {
    title: 'Administración',
    tab,
    isBooks: tab === 'libros',
    isLoans: tab === 'prestamos',
    isUsers: tab === 'usuarios',
    books: books.map(BookDTO.getPublicFrom),
    availableBooks: books.filter((book) => book.available),
    activeLoans: activeLoans.filter((loan) => loan.user && loan.book),
    users: users.map((user) => ({ ...UserDTO.getPublicFrom(user), isMe: String(user._id) === req.user.id })),
    stats: {
      books: books.length,
      loaned: books.filter((book) => !book.available).length,
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
