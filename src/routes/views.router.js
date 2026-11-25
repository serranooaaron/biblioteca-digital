import { Router } from 'express';
import mongoose from 'mongoose';
import { booksService, loansService, reservationsService, reviewsService, usersService } from '../services/index.js';
import { getMyReview, getReviewsPage, hasBorrowed, toPublicReview } from '../controllers/reviews.controller.js';
import { COMMENT_MAX } from '../dao/models/Review.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import UserDTO from '../dto/User.dto.js';
import BookDTO from '../dto/Book.dto.js';
import asyncHandler from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/index.js';
import { LOAN_DAYS, loanStatus } from '../utils/loans.js';
import { passwordChecks } from '../public/js/passwordPolicy.js';
import { findValidReset } from '../utils/passwordReset.js';
import { HOLD_DAYS, MAX_RESERVATIONS, bookState, isHeldFor, releaseExpiredHolds, reservationsOf } from '../utils/reservations.js';

const router = Router();

// Datos comunes a todas las vistas: ruta actual (para marcar el menú), préstamos vencidos del lector
// y reservas que ya puede retirar.
router.use(asyncHandler(async (req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.overdueCount = 0;
  res.locals.readyHolds = [];
  await releaseExpiredHolds();
  if (req.user) {
    const [active, ready] = await Promise.all([
      loansService.getAll({ user: req.user.id, returned: false }).select('dueDate createdAt returned').lean(),
      booksService.getAll({ heldFor: req.user.id, available: true }).select('title heldUntil').lean(),
    ]);
    res.locals.overdueCount = active.filter((loan) => loanStatus(loan).overdue).length;
    res.locals.readyHolds = ready;
  }
  next();
}));

// Lo que el lector logueado tiene prestado y reservado, para decidir qué botón mostrar en cada libro.
const readerContext = async (req) => {
  const context = { userId: req.user?.id, myBookIds: new Set(), myReservations: new Map(), waiting: await reservationsService.waitingByBook() };
  if (req.user) {
    const [me, myReservations] = await Promise.all([usersService.getUserById(req.user.id), reservationsOf(req.user.id)]);
    me?.books.forEach((entry) => context.myBookIds.add(String(entry._id)));
    context.myReservations = myReservations;
  }
  return context;
};

// Límites que le quedan al lector: se usan para deshabilitar "Pedir" y "Reservar" con su explicación.
const readerLimits = (req, context) => ({
  loansLeft: req.user ? Math.max(0, 3 - context.myBookIds.size) : null,
  reservationsLeft: req.user ? Math.max(0, MAX_RESERVATIONS - context.myReservations.size) : null,
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
    // Operador puesto a propósito por el servidor: se marca como confiable para sanitizeFilter.
    const pattern = mongoose.trusted({ $regex: escapeRegex(q), $options: 'i' });
    filter.$or = [{ title: pattern }, { author: pattern }];
  }
  if (status) filter.available = status === 'available';

  const [books, context] = await Promise.all([booksService.getAll(filter).sort(SORTS[sort]).lean(), readerContext(req)]);

  res.render('catalog', {
    title: 'Catálogo',
    books: books.map((book) => ({ ...BookDTO.getPublicFrom(book), ...bookState(book, context) })),
    q,
    status,
    sort,
    hasFilters: Boolean(q || status || sort !== 'title'),
    loginNext: encodeURIComponent(req.originalUrl),
    ...readerLimits(req, context),
  });
}));

router.get('/libros/:bid', asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.bid)) return next();
  const book = await booksService.getBy({ _id: req.params.bid }).lean();
  if (!book) return next();

  const [{ reviews, page, totalPages, total }, byRating, mine, context] = await Promise.all([
    getReviewsPage(book._id, { page: req.query.pagina }),
    reviewsService.countByRating(book._id),
    req.user ? getMyReview(book._id, req.user.id) : null,
    readerContext(req),
  ]);
  const myReview = mine ? toPublicReview(mine, req.user.id) : null;
  const canReview = req.user ? Boolean(myReview) || (await hasBorrowed(req.user.id, book._id)) : false;
  const counts = [5, 4, 3, 2, 1].map((stars) => {
    const count = byRating[stars] || 0;
    return { stars, count, percent: total ? Math.round((count / total) * 100) : 0 };
  });
  const pageLink = (number) => `/libros/${book._id}${number > 1 ? `?pagina=${number}` : ''}#reviews-title`;

  res.render('book', {
    title: book.title,
    book: { ...BookDTO.getPublicFrom(book), ...bookState(book, context) },
    ...readerLimits(req, context),
    holdDays: HOLD_DAYS,
    reviews: reviews.map((review) => toPublicReview(review, req.user?.id)),
    totalReviews: total,
    pagination: totalPages > 1 ? {
      page,
      totalPages,
      prev: page > 1 ? pageLink(page - 1) : null,
      next: page < totalPages ? pageLink(page + 1) : null,
    } : null,
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
  const active = withBook.filter((loan) => !loan.returned).sort(byDueDate);

  // Reservas: primero las que ya se pueden retirar, después por lugar en la lista.
  const positions = await reservationsOf(req.user.id);
  const reserved = await reservationsService.getAll({ user: req.user.id }).populate('book').lean();
  const reservations = reserved
    .filter((reservation) => reservation.book)
    .map((reservation) => {
      const ready = isHeldFor(reservation.book, req.user.id);
      return {
        book: BookDTO.getPublicFrom(reservation.book),
        createdAt: reservation.createdAt,
        position: positions.get(String(reservation.book._id))?.position ?? 1,
        ready,
        readyUntil: ready ? reservation.book.heldUntil : null,
      };
    })
    .sort((a, b) => Number(b.ready) - Number(a.ready) || a.position - b.position);

  res.render('loans', {
    title: 'Mis préstamos',
    active,
    reservations,
    history: withBook.filter((loan) => loan.returned),
    loanDays: LOAN_DAYS,
    holdDays: HOLD_DAYS,
    maxReservations: MAX_RESERVATIONS,
    loansLeft: Math.max(0, 3 - active.length),
  });
}));

// Mi perfil: nombre y contraseña. Los datos salen de la sesión, que ya los trae de la base.
router.get('/perfil', requireAuth, (req, res) => {
  res.render('profile', {
    title: 'Mi perfil',
    profile: req.user,
    passwordRules: passwordChecks('').map(({ id, label }) => ({ id, label })),
  });
});

const ADMIN_TABS = ['libros', 'prestamos', 'usuarios'];

router.get('/admin', requireAdmin, asyncHandler(async (req, res) => {
  const tab = ADMIN_TABS.includes(req.query.tab) ? req.query.tab : 'libros';
  const [books, activeLoans, users, waiting] = await Promise.all([
    booksService.getAll({}).sort({ title: 1 }).lean(),
    loansService.getAll({ returned: false }).sort({ createdAt: -1 }).populate('user', 'first_name last_name email').populate('book', 'title author').lean(),
    usersService.getAll({}).sort({ last_name: 1, first_name: 1 }).lean(),
    reservationsService.waitingByBook(),
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
    books: books.map((book) => ({ ...BookDTO.getPublicFrom(book), waiting: waiting[String(book._id)] || 0 })),
    // Los apartados no se ofrecen para prestar a mano: esperan al lector de la lista.
    availableBooks: books.filter((book) => book.available && !BookDTO.getPublicFrom(book).held),
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
  // El registro muestra la lista de requisitos de la contraseña desde el primer momento.
  return res.render(view, { title, next, passwordRules: passwordChecks('').map(({ id, label }) => ({ id, label })) });
};

router.get('/login', authPage('login', 'Ingresar'));
router.get('/register', authPage('register', 'Crear cuenta'));

// Olvidé mi contraseña: pedir el link por email.
router.get('/recuperar', (req, res) => res.render('forgot', { title: 'Recuperar contraseña' }));

// Link del email: si el token sigue vigente, formulario para la contraseña nueva.
// no-referrer: el token está en la URL y no tiene que viajar a ningún otro sitio.
router.get('/restablecer', asyncHandler(async (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const pending = await findValidReset(token);
  const owner = pending ? await usersService.getUserById(pending.user) : null;
  res.render('reset', {
    title: 'Crear contraseña nueva',
    valid: Boolean(owner),
    token,
    person: owner ? { email: owner.email, first_name: owner.first_name, last_name: owner.last_name } : null,
    passwordRules: passwordChecks('').map(({ id, label }) => ({ id, label })),
  });
}));

export default router;
