import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { usersService, booksService, loansService } from '../src/services/index.js';

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

  async function createFixture() {
    const user = await usersService.create({ first_name: 'Ana', last_name: 'Pérez', email: `${Date.now()}@example.com`, password: 'hashedpass' });
    const book = await booksService.create({ title: 'The Pragmatic Programmer', author: 'Andrew Hunt', publishedYear: 1999 });
    return { user, book };
  }

  it('GET /api/loans returns all loans', async function () {
    const { user, book } = await createFixture();
    await loansService.create({ user: user._id, book: book._id });
    const response = await requester.get('/api/loans');
    expect(response.status).to.equal(200);
    expect(response.body.payload).to.have.length(1);
  });

  it('GET /api/loans/:lid returns one loan or 404', async function () {
    const { user, book } = await createFixture();
    const loan = await loansService.create({ user: user._id, book: book._id });
    const response = await requester.get(`/api/loans/${loan._id}`);
    const missing = await requester.get(`/api/loans/${new mongoose.Types.ObjectId()}`);
    expect(response.status).to.equal(200);
    expect(response.body.payload._id.toString()).to.equal(loan._id.toString());
    expect(missing.status).to.equal(404);
  });

  it('POST /api/loans/:uid/:bid creates a loan and marks the book unavailable', async function () {
    const { user, book } = await createFixture();
    const response = await requester.post(`/api/loans/${user._id}/${book._id}`);
    const updatedBook = await booksService.getBy({ _id: book._id });
    const updatedUser = await usersService.getUserById(user._id);
    expect(response.status).to.equal(200);
    expect(response.body.message).to.equal('Book loaned');
    expect(updatedBook.available).to.equal(false);
    expect(updatedUser.books).to.have.length(1);
  });

  it('POST /api/loans rejects a second loan of the same book', async function () {
    const { user, book } = await createFixture();
    await requester.post(`/api/loans/${user._id}/${book._id}`);
    const response = await requester.post(`/api/loans/${user._id}/${book._id}`);
    expect(response.status).to.equal(400);
    expect(response.body.error).to.equal('Book is already loaned');
  });
});
