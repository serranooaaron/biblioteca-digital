import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { booksService } from '../src/services/index.js';
import { loginAs } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);
const coverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'files', 'coderDog.jpg');

describe('Books router integration tests', function () {
  let mongoServer;
  let adminCookie;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async function () { ({ cookie: adminCookie } = await loginAs(requester, 'admin')); });
  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  it('GET /api/books returns the digital catalog (public)', async function () {
    await booksService.create({ title: 'Clean Code', author: 'Robert C. Martin', publishedYear: 2008 });
    const response = await requester.get('/api/books');
    expect(response.status).to.equal(200);
    expect(response.body.payload).to.have.length(1);
    expect(response.body.payload[0].title).to.equal('Clean Code');
  });

  it('GET /api/books filters by text and availability, escaping regex input', async function () {
    await booksService.create({ title: 'Clean Code', author: 'Robert C. Martin', publishedYear: 2008 });
    await booksService.create({ title: 'Dune', author: 'Frank Herbert', publishedYear: 1965, available: false });
    const byAuthor = await requester.get('/api/books').query({ q: 'herbert' });
    const available = await requester.get('/api/books').query({ available: 'true' });
    const regex = await requester.get('/api/books').query({ q: '(a+)+$' });
    expect(byAuthor.body.payload.map((b) => b.title)).to.deep.equal(['Dune']);
    expect(available.body.payload.map((b) => b.title)).to.deep.equal(['Clean Code']);
    expect(regex.status).to.equal(200);
    expect(regex.body.payload).to.have.length(0);
  });

  it('POST /api/books creates a book (admin)', async function () {
    const response = await requester.post('/api/books').set('Cookie', adminCookie).send({ title: 'Dune', author: 'Frank Herbert', publishedYear: 1965 });
    expect(response.status).to.equal(200);
    expect(response.body.payload).to.include({ title: 'Dune', author: 'Frank Herbert', available: true });
  });

  it('POST /api/books is forbidden for anonymous users and readers', async function () {
    const { cookie: userCookie } = await loginAs(requester, 'user');
    const anonymous = await requester.post('/api/books').send({ title: 'Dune', author: 'Frank Herbert', publishedYear: 1965 });
    const asUser = await requester.post('/api/books').set('Cookie', userCookie).send({ title: 'Dune', author: 'Frank Herbert', publishedYear: 1965 });
    expect(anonymous.status).to.equal(401);
    expect(asUser.status).to.equal(403);
  });

  it('POST /api/books rejects incomplete data', async function () {
    const response = await requester.post('/api/books').set('Cookie', adminCookie).send({ title: 'Dune' });
    expect(response.status).to.equal(400);
    expect(response.body.error).to.equal('Incomplete values');
  });

  it('POST /api/books/withcover stores a public cover URL', async function () {
    const response = await requester
      .post('/api/books/withcover')
      .set('Cookie', adminCookie)
      .field('title', 'Coder Dog')
      .field('author', 'Coder')
      .field('publishedYear', '2024')
      .attach('cover', coverPath);
    expect(response.status).to.equal(200);
    expect(response.body.payload.cover).to.match(/^\/img\/\d+-[a-f0-9]+\.jpg$/);
    const image = await requester.get(response.body.payload.cover);
    expect(image.status).to.equal(200);
    // Limpia la portada subida por el test.
    await fs.unlink(path.join(path.dirname(coverPath), '..', '..', 'src', 'public', 'img', path.basename(response.body.payload.cover)));
  });

  it('POST /api/books/withcover rejects files that are not images', async function () {
    const response = await requester
      .post('/api/books/withcover')
      .set('Cookie', adminCookie)
      .field('title', 'Malicioso')
      .field('author', 'Nadie')
      .field('publishedYear', '2024')
      .attach('cover', Buffer.from('<script>alert(1)</script>'), { filename: 'tapa.html', contentType: 'text/html' });
    expect(response.status).to.equal(400);
  });

  it('PUT and DELETE /api/books/:bid manage a book', async function () {
    const book = await booksService.create({ title: 'Old title', author: 'Author', publishedYear: 2000 });
    const update = await requester.put(`/api/books/${book._id}`).set('Cookie', adminCookie).send({ title: 'New title', available: false });
    const updated = await booksService.getBy({ _id: book._id });
    const remove = await requester.delete(`/api/books/${book._id}`).set('Cookie', adminCookie);
    expect(update.status).to.equal(200);
    expect(updated.title).to.equal('New title');
    expect(updated.available).to.equal(true);
    expect(remove.status).to.equal(200);
  });

  it('DELETE /api/books/:bid refuses to delete a loaned book', async function () {
    const book = await booksService.create({ title: 'Prestado', author: 'Author', publishedYear: 2000, available: false });
    const response = await requester.delete(`/api/books/${book._id}`).set('Cookie', adminCookie);
    expect(response.status).to.equal(409);
  });

  it('returns 404 for an invalid book id', async function () {
    const response = await requester.delete('/api/books/no-es-un-id').set('Cookie', adminCookie);
    expect(response.status).to.equal(404);
  });
});
