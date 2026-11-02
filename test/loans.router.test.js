import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { usersService, booksService, loansService } from '../src/services/index.js';
import { loginAs } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

describe('Loans router integration tests', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  const createBook = (title = 'The Pragmatic Programmer') =>
    booksService.create({ title, author: 'Andrew Hunt', publishedYear: 1999 });

  it('GET /api/loans returns all loans (admin only)', async function () {
    const { cookie: adminCookie } = await loginAs(requester, 'admin');
    const { user, cookie: userCookie } = await loginAs(requester, 'user');
    const book = await createBook();
    await loansService.create({ user: user._id, book: book._id });
    const asAdmin = await requester.get('/api/loans').set('Cookie', adminCookie);
    const asUser = await requester.get('/api/loans').set('Cookie', userCookie);
    const anonymous = await requester.get('/api/loans');
    expect(asAdmin.status).to.equal(200);
    expect(asAdmin.body.payload).to.have.length(1);
    expect(asAdmin.body.payload[0].book.title).to.equal('The Pragmatic Programmer');
    expect(JSON.stringify(asAdmin.body)).to.not.include('password');
    expect(asUser.status).to.equal(403);
    expect(anonymous.status).to.equal(401);
  });

  it('GET /api/loans/:lid returns own loan, 403 for others and 404 if missing', async function () {
    const { user, cookie } = await loginAs(requester, 'user');
    const { cookie: otherCookie } = await loginAs(requester, 'user');
    const book = await createBook();
    const loan = await loansService.create({ user: user._id, book: book._id });
    const own = await requester.get(`/api/loans/${loan._id}`).set('Cookie', cookie);
    const other = await requester.get(`/api/loans/${loan._id}`).set('Cookie', otherCookie);
    const missing = await requester.get(`/api/loans/${new mongoose.Types.ObjectId()}`).set('Cookie', cookie);
    expect(own.status).to.equal(200);
    expect(own.body.payload._id.toString()).to.equal(loan._id.toString());
    expect(other.status).to.equal(403);
    expect(missing.status).to.equal(404);
  });

  it('POST /api/loans/:bid lets a reader borrow a book for themselves', async function () {
    const { user, cookie } = await loginAs(requester, 'user');
    const book = await createBook();
    const response = await requester.post(`/api/loans/${book._id}`).set('Cookie', cookie);
    const updatedBook = await booksService.getBy({ _id: book._id });
    const updatedUser = await usersService.getUserById(user._id);
    expect(response.status).to.equal(200);
    expect(response.body.message).to.equal('Book loaned');
    expect(updatedBook.available).to.equal(false);
    expect(updatedUser.books).to.have.length(1);
  });

  it('POST /api/loans/:uid/:bid creates a loan for any user (admin only)', async function () {
    const { cookie: adminCookie } = await loginAs(requester, 'admin');
    const { user, cookie: userCookie } = await loginAs(requester, 'user');
    const book = await createBook();
    const asUser = await requester.post(`/api/loans/${user._id}/${book._id}`).set('Cookie', userCookie);
    const asAdmin = await requester.post(`/api/loans/${user._id}/${book._id}`).set('Cookie', adminCookie);
    expect(asUser.status).to.equal(403);
    expect(asAdmin.status).to.equal(200);
  });

  it('rejects a second loan of the same book', async function () {
    const { cookie } = await loginAs(requester, 'user');
    const book = await createBook();
    await requester.post(`/api/loans/${book._id}`).set('Cookie', cookie);
    const response = await requester.post(`/api/loans/${book._id}`).set('Cookie', cookie);
    expect(response.status).to.equal(400);
    expect(response.body.error).to.equal('Book is already loaned');
  });

  it('limits active loans per reader', async function () {
    const { cookie } = await loginAs(requester, 'user');
    for (let i = 0; i < 3; i++) {
      const book = await createBook(`Libro ${i}`);
      await requester.post(`/api/loans/${book._id}`).set('Cookie', cookie);
    }
    const extra = await createBook('Libro extra');
    const response = await requester.post(`/api/loans/${extra._id}`).set('Cookie', cookie);
    expect(response.status).to.equal(400);
  });

  it('PUT /api/loans/:lid/return gives the book back', async function () {
    const { user, cookie } = await loginAs(requester, 'user');
    const { cookie: otherCookie } = await loginAs(requester, 'user');
    const book = await createBook();
    await requester.post(`/api/loans/${book._id}`).set('Cookie', cookie);
    const [loan] = (await requester.get('/api/loans/mine').set('Cookie', cookie)).body.payload;

    const byOther = await requester.put(`/api/loans/${loan._id}/return`).set('Cookie', otherCookie);
    const response = await requester.put(`/api/loans/${loan._id}/return`).set('Cookie', cookie);
    const again = await requester.put(`/api/loans/${loan._id}/return`).set('Cookie', cookie);
    const updatedBook = await booksService.getBy({ _id: book._id });
    const updatedUser = await usersService.getUserById(user._id);

    expect(byOther.status).to.equal(403);
    expect(response.status).to.equal(200);
    expect(again.status).to.equal(400);
    expect(updatedBook.available).to.equal(true);
    expect(updatedUser.books).to.have.length(0);
  });
});
