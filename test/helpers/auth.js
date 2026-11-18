import crypto from 'node:crypto';
import { usersService } from '../../src/services/index.js';
import { createHash } from '../../src/utils/index.js';

// Contraseñas generadas en cada corrida: en el código no queda ninguna fija.
// Cumplen la regla (mayúscula, minúscula, número y símbolo) y usan un alfabeto sin vocales
// ni números que se lean como letras: nunca forman por casualidad una palabra débil o un nombre.
const ALPHABET = 'ghjkmnpqrvwxyz2689';
// Nunca repite el carácter anterior: cuatro iguales seguidos cuentan como contraseña débil.
export const randomPassword = () => {
  let tail = '';
  for (const byte of crypto.randomBytes(16)) {
    const options = ALPHABET.replace(tail.at(-1) ?? '', '');
    tail += options[byte % options.length];
  }
  return `Kq9#${tail}`;
};

let counter = 0;

// Crea un usuario con el rol indicado, inicia sesión y devuelve la cookie para usar en los requests.
export const loginAs = async (requester, role = 'user') => {
  counter += 1;
  const password = randomPassword();
  const user = await usersService.create({
    first_name: role === 'admin' ? 'Admin' : 'Lector',
    last_name: 'Test',
    email: `${role}${counter}-${Date.now()}@example.com`,
    password: await createHash(password),
    role,
  });
  const response = await requester.post('/api/sessions/login').send({ email: user.email, password });
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  return { user, cookie, password };
};
