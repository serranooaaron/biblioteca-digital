import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';

const { expect } = chai;
const requester = supertest(app);

describe('Digital Library API', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async function () { await mongoose.connection.dropDatabase(); });
  after(async function () { await mongoose.disconnect(); await mongoServer.stop(); });

  it('registers a library user', async function () {
    const response = await requester.post('/api/sessions/register').send({
      first_name: 'Test', last_name: 'User', email: 'reader@example.com', password: 'testpassword'
    });
    expect(response.status).to.equal(200);
    expect(response.body.status).to.equal('success');
  });

  it('logs in a registered user', async function () {
    const user = { first_name: 'Test', last_name: 'User', email: 'reader@example.com', password: 'testpassword' };
    await requester.post('/api/sessions/register').send(user);
    const response = await requester.post('/api/sessions/login').send({ email: user.email, password: user.password });
    expect(response.status).to.equal(200);
    expect(response.headers['set-cookie'][0]).to.include('coderCookie=');
  });

  it('returns the current user from the session cookie', async function () {
    const user = { first_name: 'Test', last_name: 'User', email: 'reader@example.com', password: 'testpassword' };
    await requester.post('/api/sessions/register').send(user);
    const login = await requester.post('/api/sessions/login').send({ email: user.email, password: user.password });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const response = await requester.get('/api/sessions/current').set('Cookie', cookie);
    expect(response.status).to.equal(200);
    expect(response.body.payload.email).to.equal(user.email);
  });
});
