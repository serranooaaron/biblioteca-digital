import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { usersService } from '../src/services/index.js';
import passwordResetModel from '../src/dao/models/PasswordReset.js';
import { forgotLimiter } from '../src/controllers/sessions.controller.js';
import { loginLimiter } from '../src/utils/loginLimiter.js';
import { mailer } from '../src/utils/mailer.js';
import { loginAs, randomPassword } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

// Los tests nunca llaman a Brevo: se reemplaza el envío y se guardan los emails.
const originalSend = mailer.send;
let sent;
const waitForEmails = async (count) => {
  for (let i = 0; i < 50 && sent.length < count; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
};
const tokenFrom = (email) => email.text.match(/restablecer\?token=([A-Za-z0-9_-]+)/)[1];

describe('Recuperar contraseña', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => {
    sent = [];
    mailer.send = async (email) => { sent.push(email); };
    forgotLimiter.clear();
    loginLimiter.clear();
    process.env.APP_URL = 'https://biblioteca.example';
  });
  afterEach(async function () {
    mailer.send = originalSend;
    delete process.env.APP_URL;
    await mongoose.connection.dropDatabase();
  });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  const ask = (email) => requester.post('/api/sessions/forgot').send({ email });

  it('responde lo mismo exista o no la cuenta, y solo envía email a la que existe', async function () {
    const { user } = await loginAs(requester, 'user');
    const existing = await ask(user.email.toUpperCase()).expect(200);
    const missing = await ask('nadie@example.com').expect(200);
    await waitForEmails(1);

    expect(existing.body).to.deep.equal(missing.body);
    expect(sent).to.have.length(1);
    expect(sent[0].to).to.equal(user.email);
    // El link usa APP_URL, nunca el Host del pedido.
    expect(sent[0].text).to.include('https://biblioteca.example/restablecer?token=');
    // En la base queda el hash, no el token.
    const stored = await passwordResetModel.findOne({ user: user._id }).lean();
    expect(stored.tokenHash).to.have.length(64);
    expect(stored.tokenHash).to.not.equal(tokenFrom(sent[0]));
  });

  it('un Host falso no cambia el link del email', async function () {
    const { user } = await loginAs(requester, 'user');
    await requester.post('/api/sessions/forgot').set('Host', 'atacante.example').set('X-Forwarded-Host', 'atacante.example').send({ email: user.email }).expect(200);
    await waitForEmails(1);
    expect(sent[0].text).to.not.include('atacante');
  });

  it('valida el email y limita los pedidos', async function () {
    await ask('no-es-un-email').expect(400);
    await requester.post('/api/sessions/forgot').send({ email: { $ne: null } }).expect(400);
    for (let i = 0; i < 3; i += 1) await ask('alguien@example.com').expect(200);
    await ask('alguien@example.com').expect(429);
  });

  it('con el link se crea la contraseña nueva, se cierran las sesiones y el link no sirve dos veces', async function () {
    const { user, cookie, password } = await loginAs(requester, 'user');
    await ask(user.email).expect(200);
    await waitForEmails(1);
    const token = tokenFrom(sent[0]);

    const page = await requester.get(`/restablecer?token=${token}`).expect(200);
    expect(page.text).to.include('data-reset-form');
    expect(page.headers['referrer-policy']).to.equal('no-referrer');

    const newPassword = randomPassword();
    await requester.post('/api/sessions/reset').send({ token, newPassword }).expect(200);

    await requester.get('/api/sessions/current').set('Cookie', cookie).expect(401);
    await requester.post('/api/sessions/login').send({ email: user.email, password }).expect(401);
    await requester.post('/api/sessions/login').send({ email: user.email, password: newPassword }).expect(200);

    const again = await requester.post('/api/sessions/reset').send({ token, newPassword: randomPassword() });
    expect(again.status).to.equal(400);
    expect(again.body.error).to.include('venció o ya se usó');
    expect((await requester.get(`/restablecer?token=${token}`)).text).to.include('Pedir un link nuevo');
  });

  it('pedir otro link anula el anterior', async function () {
    const { user } = await loginAs(requester, 'user');
    await ask(user.email);
    await waitForEmails(1);
    await ask(user.email);
    await waitForEmails(2);
    await requester.post('/api/sessions/reset').send({ token: tokenFrom(sent[0]), newPassword: randomPassword() }).expect(400);
    await requester.post('/api/sessions/reset').send({ token: tokenFrom(sent[1]), newPassword: randomPassword() }).expect(200);
  });

  it('un link vencido no sirve', async function () {
    const { user } = await loginAs(requester, 'user');
    await ask(user.email);
    await waitForEmails(1);
    await passwordResetModel.updateOne({ user: user._id }, { expiresAt: new Date(Date.now() - 1000) });
    await requester.post('/api/sessions/reset').send({ token: tokenFrom(sent[0]), newPassword: randomPassword() }).expect(400);
  });

  it('aplica la regla de contraseñas sin gastar el link', async function () {
    const { user } = await loginAs(requester, 'user');
    await ask(user.email);
    await waitForEmails(1);
    const token = tokenFrom(sent[0]);
    const weak = await requester.post('/api/sessions/reset').send({ token, newPassword: 'corta' });
    expect(weak.status).to.equal(400);
    await requester.post('/api/sessions/reset').send({ token, newPassword: randomPassword() }).expect(200);
  });

  it('rechaza tokens inventados, operadores y usar el mismo link dos veces a la vez', async function () {
    const { user } = await loginAs(requester, 'user');
    for (const token of ['x', { $ne: null }, 'a'.repeat(43)]) {
      await requester.post('/api/sessions/reset').send({ token, newPassword: randomPassword() }).expect(400);
    }
    await ask(user.email);
    await waitForEmails(1);
    const token = tokenFrom(sent[0]);
    const results = await Promise.all([
      requester.post('/api/sessions/reset').send({ token, newPassword: randomPassword() }),
      requester.post('/api/sessions/reset').send({ token, newPassword: randomPassword() }),
    ]);
    expect(results.map((res) => res.status).sort()).to.deep.equal([200, 400]);
    const stored = await usersService.getUserById(user._id);
    expect(stored.sessionVersion).to.equal(1);
  });

  it('el email escapa el nombre de la cuenta', async function () {
    const { user } = await loginAs(requester, 'user');
    await usersService.update(user._id, { first_name: '<b>Ana</b>' });
    await ask(user.email);
    await waitForEmails(1);
    expect(sent[0].html).to.include('&lt;b&gt;Ana&lt;/b&gt;');
  });

  it('el login ofrece recuperar la contraseña', async function () {
    const login = await requester.get('/login').expect(200);
    expect(login.text).to.include('href="/recuperar"');
    await requester.get('/recuperar').expect(200);
  });
});
