import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { usersService } from '../src/services/index.js';
import { loginLimiter } from '../src/utils/loginLimiter.js';
import { passwordChangeLimiter } from '../src/controllers/sessions.controller.js';
import { getJwtSecret } from '../src/utils/auth.js';
import { loginAs, randomPassword } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

const cookieFrom = (response) => response.headers['set-cookie']?.find((c) => c.startsWith('bibliotecaToken='))?.split(';')[0];
// Inicia otra sesión de la misma cuenta, como si fuera otro dispositivo.
const loginAgain = async (user, password) => cookieFrom(await requester.post('/api/sessions/login').send({ email: user.email, password }).expect(200));

describe('Mi perfil', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => {
    loginLimiter.clear();
    passwordChangeLimiter.clear();
  });
  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  describe('página', function () {
    it('pide sesión y muestra los datos de la cuenta, escapados', async function () {
      const redirect = await requester.get('/perfil').expect(302);
      expect(redirect.headers.location).to.equal('/login?next=%2Fperfil');

      const { user, cookie } = await loginAs(requester, 'user');
      await usersService.update(user._id, { first_name: '<img src=x onerror=alert(1)>' });
      const page = await requester.get('/perfil').set('Cookie', cookie).expect(200);
      expect(page.text).to.include('Mi perfil');
      expect(page.text).to.include(user.email);
      expect(page.text).to.include('data-password-rules');
      expect(page.text).to.not.include('<img src=x');
    });
  });

  describe('datos', function () {
    it('cambia nombre y apellido, y el cambio se ve en la sesión al instante', async function () {
      const { user, cookie } = await loginAs(requester, 'user');
      await requester.put('/api/sessions/profile').set('Cookie', cookie).send({ first_name: '  Ana   María ', last_name: 'Pérez' }).expect(200);

      const stored = await usersService.getUserById(user._id);
      expect(stored.first_name).to.equal('Ana María');
      expect(stored.last_name).to.equal('Pérez');
      const current = await requester.get('/api/sessions/current').set('Cookie', cookie).expect(200);
      expect(current.body.payload.name).to.equal('Ana María Pérez');
    });

    it('no cambia el email, el rol ni la contraseña, y rechaza datos vacíos o largos', async function () {
      const { user, cookie } = await loginAs(requester, 'user');
      await requester
        .put('/api/sessions/profile')
        .set('Cookie', cookie)
        .send({ first_name: 'Ana', last_name: 'Paz', email: 'otro@example.com', role: 'admin', password: 'x' })
        .expect(200);
      const stored = await usersService.getUserById(user._id);
      expect(stored).to.include({ email: user.email, role: 'user', password: user.password });

      for (const body of [{ first_name: ' ', last_name: 'Paz' }, { first_name: { $ne: null }, last_name: 'Paz' }, { first_name: 'a'.repeat(51), last_name: 'Paz' }]) {
        const res = await requester.put('/api/sessions/profile').set('Cookie', cookie).send(body);
        expect(res.status, JSON.stringify(body).slice(0, 40)).to.equal(400);
      }
    });

    it('sin sesión no se puede cambiar nada', async function () {
      await requester.put('/api/sessions/profile').send({ first_name: 'A', last_name: 'B' }).expect(401);
      await requester.put('/api/sessions/password').send({ currentPassword: 'x', newPassword: 'y' }).expect(401);
    });
  });

  describe('contraseña', function () {
    it('cambia la contraseña con la actual y cierra las otras sesiones, no la actual', async function () {
      const { user, cookie, password } = await loginAs(requester, 'user');
      const otherDevice = await loginAgain(user, password);
      const newPassword = randomPassword();

      const res = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: password, newPassword }).expect(200);
      const renewed = cookieFrom(res);

      // La sesión que cambió la contraseña sigue, con un token nuevo.
      await requester.get('/api/sessions/current').set('Cookie', renewed).expect(200);
      // El otro dispositivo y el token viejo de esta misma sesión quedan afuera.
      await requester.get('/api/sessions/current').set('Cookie', otherDevice).expect(401);
      await requester.get('/api/sessions/current').set('Cookie', cookie).expect(401);
      // La contraseña vieja ya no sirve y la nueva sí.
      await requester.post('/api/sessions/login').send({ email: user.email, password }).expect(401);
      await requester.post('/api/sessions/login').send({ email: user.email, password: newPassword }).expect(200);
    });

    it('rechaza una contraseña actual incorrecta y frena después de 5 intentos', async function () {
      const { cookie } = await loginAs(requester, 'user');
      // Otra contraseña generada: nunca coincide con la de la cuenta.
      const wrong = randomPassword();
      for (let i = 0; i < 5; i += 1) {
        const res = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: wrong, newPassword: randomPassword() });
        expect(res.status).to.equal(400);
        expect(res.body.error).to.equal('La contraseña actual no es correcta');
      }
      const blocked = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: wrong, newPassword: randomPassword() });
      expect(blocked.status).to.equal(429);
    });

    it('aplica la misma regla que el registro y no acepta repetir la actual', async function () {
      const { user, cookie, password } = await loginAs(requester, 'user');
      const weak = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: password, newPassword: 'corta' });
      const same = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: password, newPassword: password });
      const withEmail = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: password, newPassword: randomPassword().slice(0, 4) + user.email.split('@')[0] });
      const operators = await requester.put('/api/sessions/password').set('Cookie', cookie).send({ currentPassword: { $ne: null }, newPassword: randomPassword() });

      expect(weak.status).to.equal(400);
      expect(same.body.error).to.include('distinta de la actual');
      expect(withEmail.status).to.equal(400);
      expect(operators.status).to.equal(400);
      // Nada de eso cerró la sesión.
      await requester.get('/api/sessions/current').set('Cookie', cookie).expect(200);
    });
  });

  describe('sesiones', function () {
    it('un token sin versión (de antes de este cambio) sigue valiendo mientras la contraseña no cambie', async function () {
      const { user } = await loginAs(requester, 'user');
      const legacy = jwt.sign({ id: user._id.toString(), name: 'Lector Test', email: user.email, role: 'user' }, getJwtSecret(), { expiresIn: 60 });
      await requester.get('/api/sessions/current').set('Cookie', `bibliotecaToken=${legacy}`).expect(200);
    });

    it('el rol sale de la base: quitarle el rol de administrador corta su acceso al panel al instante', async function () {
      const { user, cookie } = await loginAs(requester, 'admin');
      await requester.get('/admin').set('Cookie', cookie).expect(200);
      await usersService.update(user._id, { role: 'user' });
      await requester.get('/admin').set('Cookie', cookie).expect(403);
    });

    it('si la cuenta se borra, su sesión deja de valer', async function () {
      const { user, cookie } = await loginAs(requester, 'user');
      await usersService.delete(user._id);
      await requester.get('/api/sessions/current').set('Cookie', cookie).expect(401);
    });
  });
});
