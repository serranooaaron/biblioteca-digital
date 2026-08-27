import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { booksService } from '../src/services/index.js';

const { expect } = chai;
const requester = supertest(app);

describe('Books router integration tests', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  it('GET /api/books returns the digital catalog', async function () {
    await booksService.create({ title: 'Clean Code', author: 'Robert C. Martin', publishedYear: 2008 });
    const response = await requester.get('/api/books');
    expect(response.status).to.equal(200);
    expect(response.body.payload).to.have.length(1);
    expect(response.body.payload[0].title).to.equal('Clean Code');
  });

  it('POST /api/books creates a book', async function () {
    const response = await requester.post('/api/books').send({ title: 'Dune', author: 'Frank Herbert', publishedYear: 1965 });
    expect(response.status).to.equal(200);
    expect(response.body.payload).to.include({ title: 'Dune', author: 'Frank Herbert', available: true });
  });

  it('POST /api/books rejects incomplete data', async function () {
    const response = await requester.post('/api/books').send({ title: 'Dune' });
    expect(response.status).to.equal(400);
    expect(response.body.error).to.equal('Incomplete values');
  });

  it('PUT and DELETE /api/books/:bid manage a book', async function () {
    const book = await booksService.create({ title: 'Old title', author: 'Author', publishedYear: 2000 });
    const update = await requester.put(`/api/books/${book._id}`).send({ title: 'New title' });
    const remove = await requester.delete(`/api/books/${book._id}`);
    expect(update.status).to.equal(200);
    expect(remove.status).to.equal(200);
  });
});
