import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { createLoginLimiter, loginLimiter } from '../src/utils/loginLimiter.js';
import { loginAs } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

describe('Límite de intentos de login', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => loginLimiter.clear());
  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { loginLimiter.clear(); await mongoose.disconnect(); await mongoServer.stop(); });

  const tryLogin = (email, password) => requester.post('/api/sessions/login').send({ email, password });

  it('después de 5 contraseñas incorrectas bloquea la cuenta aunque la sexta sea la correcta', async function () {
    const { user, password } = await loginAs(requester, 'user');
    for (let i = 0; i < 5; i++) expect((await tryLogin(user.email, 'incorrecta')).status).to.equal(401);

    const blocked = await tryLogin(user.email, password);

    expect(blocked.status).to.equal(429);
    expect(Number(blocked.headers['retry-after'])).to.be.within(1, 15 * 60);
    expect(blocked.body.error).to.match(/Prueba de nuevo en 15 minutos/);
  });

  it('un login correcto reinicia el contador de la cuenta', async function () {
    const { user, password } = await loginAs(requester, 'user');
    for (let i = 0; i < 4; i++) await tryLogin(user.email, 'incorrecta');
    expect((await tryLogin(user.email, password)).status).to.equal(200);
    for (let i = 0; i < 4; i++) await tryLogin(user.email, 'incorrecta');
    expect((await tryLogin(user.email, password)).status).to.equal(200);
  });

  it('el bloqueo de una cuenta no afecta a otra', async function () {
    const victim = await loginAs(requester, 'user');
    const other = await loginAs(requester, 'user');
    for (let i = 0; i < 5; i++) await tryLogin(victim.user.email, 'incorrecta');

    expect((await tryLogin(other.user.email, other.password)).status).to.equal(200);
  });

  it('frena a una IP que prueba muchas cuentas distintas', async function () {
    for (let i = 0; i < 30; i++) expect((await tryLogin(`nadie${i}@example.com`, 'incorrecta')).status).to.equal(401);
    expect((await tryLogin('una-mas@example.com', 'incorrecta')).status).to.equal(429);
  });

  it('el bloqueo termina al pasar la ventana de tiempo', function () {
    let clock = 0;
    const limiter = createLoginLimiter({ windowMs: 1000, maxPerAccount: 2, now: () => clock });
    const req = { ip: '1.2.3.4', body: { email: 'Ana@Example.com ' } };

    limiter.fail(req);
    limiter.fail(req);
    expect(limiter.retryAfter(req)).to.equal(1);
    expect(limiter.retryAfter({ ip: '1.2.3.4', body: { email: 'ana@example.com' } })).to.equal(1);

    clock = 1000;
    expect(limiter.retryAfter(req)).to.equal(0);
  });
});
