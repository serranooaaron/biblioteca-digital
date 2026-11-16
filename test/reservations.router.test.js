import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { booksService, reservationsService } from '../src/services/index.js';
import { loginLimiter } from '../src/utils/loginLimiter.js';
import { loginAs } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

describe('Reservas y lista de espera', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => loginLimiter.clear());
  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  const createBook = (title = 'Rayuela') => booksService.create({ title, author: 'Julio Cortázar', publishedYear: 1963 });
  const as = (reader) => ({
    borrow: (book) => requester.post(`/api/loans/${book._id}`).set('Cookie', reader.cookie),
    reserve: (book) => requester.post(`/api/reservations/${book._id}`).set('Cookie', reader.cookie),
    cancel: (book) => requester.delete(`/api/reservations/${book._id}`).set('Cookie', reader.cookie),
    mine: () => requester.get('/api/reservations/mine').set('Cookie', reader.cookie),
    returnBook: async () => {
      const [loan] = (await requester.get('/api/loans/mine').set('Cookie', reader.cookie)).body.payload.filter((item) => !item.returned);
      return requester.put(`/api/loans/${loan._id}/return`).set('Cookie', reader.cookie);
    },
  });

  // Un libro prestado a "holder" y dos lectores más para la lista.
  const loanedBook = async () => {
    const book = await createBook();
    const [holder, first, second] = await Promise.all([loginAs(requester), loginAs(requester), loginAs(requester)]);
    await as(holder).borrow(book);
    return { book, holder, first, second };
  };

  it('un lector reserva un libro prestado y ve su lugar en la lista', async function () {
    const { book, first, second } = await loanedBook();

    const one = await as(first).reserve(book);
    const two = await as(second).reserve(book);
    const mine = await as(second).mine();

    expect(one.status).to.equal(201);
    expect(one.body.payload.position).to.equal(1);
    expect(two.body.payload.position).to.equal(2);
    expect(mine.body.payload).to.have.length(1);
    expect(mine.body.payload[0]).to.include({ position: 2, ready: false });
    expect(mine.body.payload[0].book.title).to.equal('Rayuela');
  });

  it('no se reserva un libro disponible, uno que ya tienes, ni dos veces el mismo', async function () {
    const { book, holder, first } = await loanedBook();
    const free = await createBook('Libre');

    expect((await as(first).reserve(free)).status).to.equal(400);
    expect((await as(holder).reserve(book)).status).to.equal(400);
    expect((await as(first).reserve(book)).status).to.equal(201);
    expect((await as(first).reserve(book)).status).to.equal(409);
    expect((await requester.post(`/api/reservations/${book._id}`)).status).to.equal(401);
    expect((await as(first).reserve({ _id: new mongoose.Types.ObjectId() })).status).to.equal(404);
  });

  it('limita a 3 las reservas activas por lector', async function () {
    const holder = await loginAs(requester);
    const reader = await loginAs(requester);
    const books = await Promise.all(['A', 'B', 'C'].map((title) => createBook(`Libro ${title}`)));
    for (const book of books) await as(holder).borrow(book);
    for (const book of books) expect((await as(reader).reserve(book)).status).to.equal(201);

    const other = await loginAs(requester);
    const fourth = await createBook('Libro D');
    await as(other).borrow(fourth);

    expect((await as(reader).reserve(fourth)).status).to.equal(400);
  });

  it('al devolverse, el libro queda apartado 3 días para el primero de la lista', async function () {
    const { book, holder, first, second } = await loanedBook();
    await as(first).reserve(book);
    await as(second).reserve(book);

    await as(holder).returnBook();
    const stored = await booksService.getBy({ _id: book._id });
    const mine = (await as(first).mine()).body.payload[0];
    const days = Math.round((new Date(mine.readyUntil) - Date.now()) / 86400000);

    expect(stored.available).to.equal(true);
    expect(String(stored.heldFor)).to.equal(String(first.user._id));
    expect(mine.ready).to.equal(true);
    expect(days).to.be.within(3, 4);
  });

  it('un libro apartado solo lo retira el lector al que le toca, y sale de la lista', async function () {
    const { book, holder, first, second } = await loanedBook();
    await as(first).reserve(book);
    await as(second).reserve(book);
    await as(holder).returnBook();

    const jumped = await as(second).borrow(book);
    const stranger = await as(holder).borrow(book);
    const rightful = await as(first).borrow(book);
    const stored = await booksService.getBy({ _id: book._id });

    expect(jumped.status).to.equal(409);
    expect(stranger.status).to.equal(409);
    expect(rightful.status).to.equal(200);
    expect(stored.heldFor).to.equal(null);
    expect(await reservationsService.count({ book: book._id })).to.equal(1);
    expect((await as(second).mine()).body.payload[0].position).to.equal(1);
  });

  it('si el apartado vence sin retirarse, pasa al siguiente y el primero pierde su lugar', async function () {
    const { book, holder, first, second } = await loanedBook();
    await as(first).reserve(book);
    await as(second).reserve(book);
    await as(holder).returnBook();
    await mongoose.connection.collection('books').updateOne({ _id: book._id }, { $set: { heldUntil: new Date(Date.now() - 1000) } });

    const late = await as(first).borrow(book);
    const stored = await booksService.getBy({ _id: book._id });

    expect(late.status).to.equal(409);
    expect(String(stored.heldFor)).to.equal(String(second.user._id));
    expect((await as(first).mine()).body.payload).to.have.length(0);
  });

  it('cuando vence el último apartado el libro vuelve a estar disponible para todos', async function () {
    const { book, holder, first } = await loanedBook();
    await as(first).reserve(book);
    await as(holder).returnBook();
    await mongoose.connection.collection('books').updateOne({ _id: book._id }, { $set: { heldUntil: new Date(Date.now() - 1000) } });

    const anyone = await as(holder).borrow(book);

    expect(anyone.status).to.equal(200);
  });

  it('cancelar la reserva libera el lugar y, si el libro estaba apartado, pasa al siguiente', async function () {
    const { book, holder, first, second } = await loanedBook();
    await as(first).reserve(book);
    await as(second).reserve(book);
    await as(holder).returnBook();

    const cancelled = await as(first).cancel(book);
    const again = await as(first).cancel(book);
    const stored = await booksService.getBy({ _id: book._id });

    expect(cancelled.status).to.equal(200);
    expect(again.status).to.equal(404);
    expect(String(stored.heldFor)).to.equal(String(second.user._id));
  });

  it('la API pública no dice para quién está apartado un libro', async function () {
    const { book, holder, first } = await loanedBook();
    await as(first).reserve(book);
    await as(holder).returnBook();

    const [listed] = (await requester.get('/api/books')).body.payload;

    expect(listed.held).to.equal(true);
    expect(listed).to.not.have.property('heldFor');
    expect(JSON.stringify(listed)).to.not.include(String(first.user._id));
  });

  it('borrar un libro o un usuario limpia sus reservas', async function () {
    const { book, holder, first, second } = await loanedBook();
    const { cookie: adminCookie } = await loginAs(requester, 'admin');
    await as(first).reserve(book);
    await as(second).reserve(book);
    await as(holder).returnBook();

    await requester.delete(`/api/users/${first.user._id}`).set('Cookie', adminCookie).expect(200);
    const afterUser = await booksService.getBy({ _id: book._id });
    await requester.delete(`/api/books/${book._id}`).set('Cookie', adminCookie).expect(200);

    expect(String(afterUser.heldFor)).to.equal(String(second.user._id));
    expect(await reservationsService.count({})).to.equal(0);
  });

  it('las páginas muestran el botón que corresponde a cada lector', async function () {
    const { book, holder, first, second } = await loanedBook();
    await as(first).reserve(book);

    const catalogWaiting = await requester.get('/catalogo').set('Cookie', first.cookie);
    const catalogOther = await requester.get('/catalogo').set('Cookie', second.cookie);
    const anonymous = await requester.get(`/libros/${book._id}`);
    await as(holder).returnBook();
    const bookReady = await requester.get(`/libros/${book._id}`).set('Cookie', first.cookie);
    const bookOther = await requester.get(`/libros/${book._id}`).set('Cookie', second.cookie);
    const loansReady = await requester.get('/mis-prestamos').set('Cookie', first.cookie);

    expect(catalogWaiting.text).to.include('data-cancel-reservation');
    expect(catalogWaiting.text).to.include('lugar 1 de 1');
    expect(catalogOther.text).to.include('data-reserve');
    expect(catalogOther.text).to.include('1 lector espera este libro');
    expect(anonymous.text).to.include('>Reservar</a>');
    expect(bookReady.text).to.include('Apartado para ti');
    expect(bookReady.text).to.include('data-borrow');
    expect(bookReady.text).to.include('data-ready-alert');
    expect(bookOther.text).to.include('>Apartado</span>');
    expect(bookOther.text).to.not.include('data-borrow');
    expect(loansReady.text).to.include('Listo para retirar hasta el');
    expect(loansReady.text).to.not.include('data-ready-alert');
  });
});
