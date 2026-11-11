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

  it('las contraseñas nuevas se guardan con bcrypt de costo 12', async function () {
    const { user } = await loginAs(requester, 'user');
    const stored = await usersService.getBy({ _id: user._id });
    expect(stored.password).to.match(/^\$2[aby]\$12\$/);
  });
});
