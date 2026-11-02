import { COOKIE_NAME, verifyToken } from '../utils/auth.js';

// Lee la cookie en cada request y deja el usuario disponible para rutas y vistas.
export const attachUser = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      res.clearCookie(COOKIE_NAME);
    }
  }
  res.locals.user = req.user || null;
  res.locals.isAdmin = req.user?.role === 'admin';
  next();
};

const isApi = (req) => req.originalUrl.startsWith('/api/');

export const requireAuth = (req, res, next) => {
  if (req.user) return next();
  if (!isApi(req)) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  return res.status(401).send({ status: 'error', error: 'Debes iniciar sesión' });
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) return requireAuth(req, res, next);
  if (req.user.role === 'admin') return next();
  if (!isApi(req)) return res.status(403).render('error', { code: 403, message: 'No tienes permiso para ver esta página' });
  return res.status(403).send({ status: 'error', error: 'No tienes permiso para esta acción' });
};
