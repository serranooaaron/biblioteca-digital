import chai from 'chai';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DEFAULT_DB_NAME, dbOptions } from '../src/utils/db.js';

const { expect } = chai;

describe('Nombre de la base de datos', function () {
  let mongod;
  before(async function () { mongod = await MongoMemoryServer.create(); });
  after(async function () { await mongod.stop(); });
  afterEach(() => { delete process.env.DB_NAME; });

  // Así copia Atlas la cadena: sin nombre de base después del host.
  const connectWith = (uri) => mongoose.createConnection(uri, dbOptions()).asPromise();

  it('con una cadena sin nombre de base usa la de la app y no "test"', async function () {
    const connection = await connectWith(mongod.getUri());
    expect(connection.name).to.equal(DEFAULT_DB_NAME).and.to.equal('biblioteca-digital');
    await connection.close();
  });

  it('DB_NAME permite elegir otra base', async function () {
    process.env.DB_NAME = 'biblioteca-staging';
    const connection = await connectWith(mongod.getUri());
    expect(connection.name).to.equal('biblioteca-staging');
    await connection.close();
  });
});
