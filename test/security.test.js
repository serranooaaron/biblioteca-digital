import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { booksService, usersService } from '../src/services/index.js';
import { loginLimiter } from '../src/utils/loginLimiter.js';
import { loginAs } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

describe('Protección de consultas y contraseñas', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => loginLimiter.clear());
  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  it('un operador de MongoDB dentro de un filtro se toma como valor literal', async function () {
    await loginAs(requester, 'user');
    // Sin la protección devolvería el primer usuario; con ella, { $ne: null } no es un email válido.
    const result = await usersService.getBy({ email: { $ne: null } }).then(() => 'devolvió algo', (error) => error.name);
    expect(result).to.equal('CastError');
  });

  it('el login no se puede saltar con operadores en email y contraseña', async function () {
    await loginAs(requester, 'user');
    const response = await requester.post('/api/sessions/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(response.status).to.equal(401);
  });

  it('la búsqueda del catálogo sigue funcionando', async function () {
    await booksService.create({ title: 'Rayuela', author: 'Julio Cortázar', publishedYear: 1963 });
    await booksService.create({ title: 'Dune', author: 'Frank Herbert', publishedYear: 1965 });

    const api = await requester.get('/api/books').query({ q: 'rayu' });
    const page = await requester.get('/catalogo').query({ q: 'CORTÁZAR' });

    expect(api.body.payload.map((book) => book.title)).to.deep.equal(['Rayuela']);
    expect(page.text).to.include('Rayuela');
    expect(page.text).to.not.include('Frank Herbert');
  });

  it('todas las respuestas llevan la política de contenido y las cabeceras de protección', async function () {
    const responses = await Promise.all(['/', '/api/books', '/css/styles.css', '/docs/'].map((url) => requester.get(url)));
    for (const res of responses) {
      expect(res.headers['content-security-policy']).to.include("script-src 'self'").and.to.include("frame-ancestors 'none'");
      expect(res.headers['x-content-type-options']).to.equal('nosniff');
      expect(res.headers['x-frame-options']).to.equal('DENY');
      expect(res.headers['referrer-policy']).to.equal('strict-origin-when-cross-origin');
      expect(res.headers).to.not.have.property('x-powered-by');
    }
  });

  it('HSTS solo se envía en producción', async function () {
    expect((await requester.get('/')).headers).to.not.have.property('strict-transport-security');
    process.env.NODE_ENV = 'production';
    try {
      expect((await requester.get('/')).headers['strict-transport-security']).to.equal('max-age=63072000; includeSubDomains');
    } finally {
      delete process.env.NODE_ENV;
    }
  });

  it('las páginas no llevan scripts escritos dentro del HTML', async function () {
    const book = await booksService.create({ title: 'Rayuela', author: 'Julio Cortázar', publishedYear: 1963 });
    const { cookie } = await loginAs(requester, 'admin');
    for (const url of ['/', '/catalogo', `/libros/${book._id}`, '/mis-prestamos', '/admin', '/login', '/register']) {
      const res = await requester.get(url).set('Cookie', cookie).redirects(1);
      expect(res.text, url).to.not.match(/<script(?![^>]*\ssrc=)[^>]*>/);
      expect(res.text, url).to.not.match(/\son[a-z]+="/);
    }
  });

  it('GET /api/health responde ok sin exponer datos internos', async function () {
    const res = await requester.get('/api/health');
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ status: 'ok' });
  });

  it('las contraseñas nuevas se guardan con bcrypt de costo 12', async function () {
    const { user } = await loginAs(requester, 'user');
    const stored = await usersService.getBy({ _id: user._id });
    expect(stored.password).to.match(/^\$2[aby]\$12\$/);
  });
});
