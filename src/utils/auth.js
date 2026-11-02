import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'bibliotecaToken';
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 horas

const isTest = () => process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && isTest()) return 'test-only-jwt-secret';
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
};

// En el token solo viaja lo necesario para autorizar: nunca la contraseña ni su hash.
export const signToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL_SECONDS }
  );

export const verifyToken = (token) => jwt.verify(token, getJwtSecret());

// httpOnly: el JavaScript del navegador no puede leer la cookie (protege ante XSS).
// sameSite lax: no viaja en POST desde otros sitios (protege ante CSRF).
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: TOKEN_TTL_SECONDS * 1000,
});
