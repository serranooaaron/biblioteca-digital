import chai from 'chai';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { loginAs, randomPassword } from './helpers/auth.js';

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

  const reader = { first_name: 'Test', last_name: 'User', email: 'reader@example.com', password: randomPassword() };

  it('registers a library user and starts the session', async function () {
    const response = await requester.post('/api/sessions/register').send(reader);
    expect(response.status).to.equal(201);
    expect(response.body.status).to.equal('success');
    expect(response.headers['set-cookie'][0]).to.include('bibliotecaToken=');
  });

  it('rejects short passwords and duplicated emails', async function () {
    const short = await requester.post('/api/sessions/register').send({ ...reader, password: 'a'.repeat(7) });
    await requester.post('/api/sessions/register').send(reader);
    const duplicated = await requester.post('/api/sessions/register').send({ ...reader, email: 'READER@example.com' });
    expect(short.status).to.equal(400);
    expect(duplicated.status).to.equal(409);
  });

  it('logs in with an httpOnly cookie', async function () {
    await requester.post('/api/sessions/register').send(reader);
    const response = await requester.post('/api/sessions/login').send({ email: reader.email, password: reader.password });
    expect(response.status).to.equal(200);
    expect(response.headers['set-cookie'][0]).to.include('bibliotecaToken=');
    expect(response.headers['set-cookie'][0]).to.match(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).to.match(/SameSite=Lax/i);
  });

  it('uses the same error for unknown email and wrong password', async function () {
    await requester.post('/api/sessions/register').send(reader);
    const wrongPassword = await requester.post('/api/sessions/login').send({ email: reader.email, password: randomPassword() });
    const unknown = await requester.post('/api/sessions/login').send({ email: 'nadie@example.com', password: randomPassword() });
    expect(wrongPassword.status).to.equal(401);
    expect(unknown.status).to.equal(401);
    expect(wrongPassword.body.error).to.equal(unknown.body.error);
  });

  it('returns the current user without the password', async function () {
    await requester.post('/api/sessions/register').send(reader);
    const login = await requester.post('/api/sessions/login').send({ email: reader.email, password: reader.password });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const response = await requester.get('/api/sessions/current').set('Cookie', cookie);
    expect(response.status).to.equal(200);
    expect(response.body.payload.email).to.equal(reader.email);
    expect(JSON.stringify(response.body)).to.not.include('password');
  });

  it('answers 401 on /current without a session instead of crashing', async function () {
    const response = await requester.get('/api/sessions/current');
    expect(response.status).to.equal(401);
  });

  it('lets only admins list users, and never exposes passwords', async function () {
    const { cookie: userCookie } = await loginAs(requester, 'user');
    const { cookie: adminCookie } = await loginAs(requester, 'admin');
    const anonymous = await requester.get('/api/users');
    const asUser = await requester.get('/api/users').set('Cookie', userCookie);
    const asAdmin = await requester.get('/api/users').set('Cookie', adminCookie);
    expect(anonymous.status).to.equal(401);
    expect(asUser.status).to.equal(403);
    expect(asAdmin.status).to.equal(200);
    expect(asAdmin.body.payload).to.have.length(2);
    expect(JSON.stringify(asAdmin.body)).to.not.include('password');
  });

  it('does not let a user change their password through PUT /api/users', async function () {
    const { cookie: adminCookie, user: admin, password } = await loginAs(requester, 'admin');
    const response = await requester.put(`/api/users/${admin._id}`).set('Cookie', adminCookie).send({ password: randomPassword(), first_name: 'Nuevo' });
    const login = await requester.post('/api/sessions/login').send({ email: admin.email, password });
    expect(response.status).to.equal(200);
    expect(login.status).to.equal(200);
  });
});
