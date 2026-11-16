import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { booksService, loansService } from '../src/services/index.js';
import { loginAs } from './helpers/auth.js';

const { expect } = chai;
const requester = supertest(app);

describe('Reseñas de libros', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  const createBook = (title = 'Rayuela') => booksService.create({ title, author: 'Julio Cortázar', publishedYear: 1963 });

  // Lector que ya tuvo el libro prestado y lo devolvió.
  const readerOf = async (book) => {
    const reader = await loginAs(requester, 'user');
    await loansService.create({ user: reader.user._id, book: book._id, returned: true });
    return reader;
  };

  it('un lector que pidió el libro publica su reseña y el libro actualiza su puntaje', async function () {
    const book = await createBook();
    const { cookie } = await readerOf(book);

    const response = await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send({ rating: 4, comment: '  Un clásico  ' });
    const updated = await booksService.getBy({ _id: book._id });

    expect(response.status).to.equal(200);
    expect(response.body.payload.review).to.include({ rating: 4, comment: 'Un clásico', mine: true });
    expect(updated.ratingAvg).to.equal(4);
    expect(updated.ratingCount).to.equal(1);
  });

  it('volver a reseñar reemplaza la reseña anterior en lugar de sumar otra', async function () {
    const book = await createBook();
    const { cookie } = await readerOf(book);

    await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send({ rating: 2 });
    await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send({ rating: 5, comment: 'Lo releí y cambié de idea' });
    const list = await requester.get(`/api/books/${book._id}/reviews`);

    expect(list.body.payload.reviews).to.have.length(1);
    expect(list.body.payload.reviews[0].rating).to.equal(5);
    expect(list.body.payload.ratingAvg).to.equal(5);
  });

  it('promedia los puntajes de varios lectores con un decimal', async function () {
    const book = await createBook();
    for (const rating of [5, 4, 4]) {
      const { cookie } = await readerOf(book);
      await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send({ rating });
    }
    const updated = await booksService.getBy({ _id: book._id });
    expect(updated.ratingAvg).to.equal(4.3);
    expect(updated.ratingCount).to.equal(3);
  });

  it('solo reseña quien tuvo el libro prestado y hay que iniciar sesión', async function () {
    const book = await createBook();
    const { cookie } = await loginAs(requester, 'user');

    const stranger = await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send({ rating: 5 });
    const anonymous = await requester.put(`/api/books/${book._id}/reviews`).send({ rating: 5 });

    expect(stranger.status).to.equal(403);
    expect(anonymous.status).to.equal(401);
  });

  it('rechaza puntajes fuera de 1 a 5, decimales, operadores y comentarios demasiado largos', async function () {
    const book = await createBook();
    const { cookie } = await readerOf(book);
    const send = (body) => requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send(body);

    for (const rating of [0, 6, 3.5, 'cinco', { $gt: 0 }]) {
      expect((await send({ rating })).status, `rating ${JSON.stringify(rating)}`).to.equal(400);
    }
    expect((await send({ rating: 3, comment: 'a'.repeat(601) })).status).to.equal(400);
  });

  it('la lista pública muestra nombre corto del autor y nunca su email', async function () {
    const book = await createBook();
    const { cookie, user } = await readerOf(book);
    await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', cookie).send({ rating: 3 });

    const response = await requester.get(`/api/books/${book._id}/reviews`);

    expect(response.status).to.equal(200);
    expect(response.body.payload.reviews[0].author).to.equal('Lector T.');
    expect(response.body.payload.reviews[0].mine).to.equal(false);
    expect(JSON.stringify(response.body)).to.not.include(user.email);
  });

  it('el autor borra su reseña, otro lector no puede y un administrador sí', async function () {
    const book = await createBook();
    const author = await readerOf(book);
    const other = await readerOf(book);
    const { cookie: adminCookie } = await loginAs(requester, 'admin');

    const first = await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', author.cookie).send({ rating: 1 });
    const second = await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', other.cookie).send({ rating: 5 });
    const firstId = first.body.payload.review._id;
    const secondId = second.body.payload.review._id;

    const byOther = await requester.delete(`/api/books/${book._id}/reviews/${firstId}`).set('Cookie', other.cookie);
    const byAuthor = await requester.delete(`/api/books/${book._id}/reviews/${firstId}`).set('Cookie', author.cookie);
    const byAdmin = await requester.delete(`/api/books/${book._id}/reviews/${secondId}`).set('Cookie', adminCookie);
    const updated = await booksService.getBy({ _id: book._id });

    expect(byOther.status).to.equal(403);
    expect(byAuthor.status).to.equal(200);
    expect(byAdmin.status).to.equal(200);
    expect(updated.ratingCount).to.equal(0);
    expect(updated.ratingAvg).to.equal(0);
  });

  it('responde 404 con libros o reseñas inexistentes', async function () {
    const { cookie } = await loginAs(requester, 'user');
    const missing = new mongoose.Types.ObjectId();
    expect((await requester.get(`/api/books/${missing}/reviews`)).status).to.equal(404);
    expect((await requester.get('/api/books/no-es-un-id/reviews')).status).to.equal(404);
    expect((await requester.delete(`/api/books/${missing}/reviews/${missing}`).set('Cookie', cookie)).status).to.equal(404);
  });

  it('la página del libro muestra las reseñas y el formulario solo a quien puede reseñar', async function () {
    const book = await createBook();
    const reader = await readerOf(book);
    await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', reader.cookie).send({ rating: 4, comment: '<script>alert(1)</script>' });
    const { cookie: strangerCookie } = await loginAs(requester, 'user');

    const asReader = await requester.get(`/libros/${book._id}`).set('Cookie', reader.cookie);
    const asStranger = await requester.get(`/libros/${book._id}`).set('Cookie', strangerCookie);
    const anonymous = await requester.get(`/libros/${book._id}`);
    const missing = await requester.get(`/libros/${new mongoose.Types.ObjectId()}`);

    expect(asReader.status).to.equal(200);
    expect(asReader.text).to.include('data-review-form');
    expect(asReader.text).to.include('Guardar cambios');
    expect(asReader.text).to.include('&lt;script&gt;');
    expect(asReader.text).to.not.include('<script>alert(1)</script>');
    expect(asStranger.text).to.not.include('data-review-form');
    expect(asStranger.text).to.include('después de pedir este libro');
    expect(anonymous.text).to.include('Ingresa</a> para dejar tu reseña');
    expect(missing.status).to.equal(404);
  });

  it('borrar un libro borra también sus reseñas', async function () {
    const book = await createBook();
    const reader = await readerOf(book);
    const { cookie: adminCookie } = await loginAs(requester, 'admin');
    await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', reader.cookie).send({ rating: 4 });

    await requester.delete(`/api/books/${book._id}`).set('Cookie', adminCookie);

    expect(await mongoose.connection.collection('reviews').countDocuments()).to.equal(0);
  });

  describe('Paginación', function () {
    // 23 reseñas de lectores distintos, la n.º 22 es la más nueva; puntajes 5,4,3,2,1 repetidos.
    const seedReviews = async (book) => {
      const now = Date.now();
      await mongoose.connection.collection('reviews').insertMany(
        Array.from({ length: 23 }, (_, i) => ({
          book: book._id,
          user: new mongoose.Types.ObjectId(),
          rating: 5 - (i % 5),
          comment: `Reseña ${i}`,
          createdAt: new Date(now - (22 - i) * 60000),
          updatedAt: new Date(now - (22 - i) * 60000),
        }))
      );
    };

    it('la API devuelve 10 reseñas por página, como máximo 50, de la más nueva a la más vieja', async function () {
      const book = await createBook();
      await seedReviews(book);

      const first = await requester.get(`/api/books/${book._id}/reviews`);
      const third = await requester.get(`/api/books/${book._id}/reviews`).query({ page: 3 });
      const huge = await requester.get(`/api/books/${book._id}/reviews`).query({ limit: 1000 });
      const beyond = await requester.get(`/api/books/${book._id}/reviews`).query({ page: 99 });

      expect(first.body.payload.reviews).to.have.length(10);
      expect(first.body.payload.reviews[0].comment).to.equal('Reseña 22');
      expect(first.body.payload).to.include({ page: 1, totalPages: 3, total: 23 });
      expect(third.body.payload.reviews.map((review) => review.comment)).to.deep.equal(['Reseña 2', 'Reseña 1', 'Reseña 0']);
      expect(huge.body.payload.reviews).to.have.length(23);
      expect(beyond.body.payload.page).to.equal(3);
    });

    it('la página del libro muestra 10 reseñas, la navegación y el reparto de todas', async function () {
      const book = await createBook();
      await seedReviews(book);

      const first = await requester.get(`/libros/${book._id}`);
      const second = await requester.get(`/libros/${book._id}`).query({ pagina: 2 });

      expect(first.text.match(/data-review="/g)).to.have.length(10);
      expect(first.text).to.include('Página 1 de 3');
      // Handlebars escapa "=" como &#x3D; dentro del atributo; el navegador lo lee igual.
      expect(first.text).to.match(new RegExp(`href="/libros/${book._id}\\?pagina(=|&#x3D;)2#reviews-title"`));
      expect(second.text).to.include('Reseña 12');
      expect(second.text).to.not.include('Reseña 22');
      // Reparto sobre las 23, no solo sobre las 10 de la página: 5 de cinco estrellas.
      expect(first.text).to.match(/bars__count">5<span class="sr-only"> reseñas de 5 estrellas/);
    });

    it('el formulario trae la reseña propia aunque no esté en la página que se ve', async function () {
      const book = await createBook();
      const reader = await readerOf(book);
      await requester.put(`/api/books/${book._id}/reviews`).set('Cookie', reader.cookie).send({ rating: 2, comment: 'Mi opinión vieja' });
      await mongoose.connection.collection('reviews').updateOne({ comment: 'Mi opinión vieja' }, { $set: { createdAt: new Date(0) } });
      await seedReviews(book);

      const page = await requester.get(`/libros/${book._id}`).set('Cookie', reader.cookie);

      expect(page.text).to.include('Guardar cambios');
      expect(page.text).to.include('>Mi opinión vieja</textarea>');
    });
  });
});
