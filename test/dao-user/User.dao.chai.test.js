import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import UserDao from '../../src/dao/Users.dao.js';
import chai from 'chai';

const { expect } = chai;

describe('Testing Users Dao', function () {
  let mongoServer;

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    this.userDao = new UserDao();
  });

  beforeEach(async function () {
    await mongoose.connection.collection('Users').deleteMany({});
  });

  after(async function () {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('El dao debe devolver los usuarios en formato de arreglo.', async function () {
    const users = await this.userDao.get();

    expect(Array.isArray(users)).to.be.equal(true);
    expect(users.length).to.be.equal(0);
    expect(users).to.be.deep.equal([]);
  });

  it('El Dao debe agregar el usuario correctamente a la BD.', async function () {
    const user = {
      first_name: 'Juan',
      last_name: 'Perez',
      email: 'juan.perez@example.com',
      password: '123456',
    };

    const result = await this.userDao.save(user);

    expect(result._id).to.be.ok;
    expect(result.first_name).to.be.equal('Juan');
  });
});

// como ejecutar el test: npx mocha test/dao-user/User.dao.test.js