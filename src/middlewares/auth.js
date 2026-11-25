import userModel from '../dao/models/User.js';
import { COOKIE_NAME, verifyToken } from '../utils/auth.js';

// Lee la cookie en cada request y deja el usuario disponible para rutas y vistas.
// Además de la firma, compara la versión de sesión del token con la del usuario: si la
// contraseña cambió (o la cuenta ya no existe), el token deja de valer aunque no haya vencido.
// Nombre y rol salen de la base, así un cambio se ve al instante en todas las sesiones.
export const attachUser = async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyToken(token);
      const user = await userModel.findById(payload.id).select('first_name last_name email role sessionVersion').lean();
      if (!user || (user.sessionVersion ?? 0) !== (payload.sv ?? 0)) throw new Error('Sesión cerrada');
      req.user = {
        id: user._id.toString(),
        name: `${user.first_name} ${user.last_name}`,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      };
    } catch {
      req.user = undefined;
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
