import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import UserDao from '../../src/dao/Users.dao.js';
import Assert from 'assert';

const assert = Assert.strict;

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
    assert.strictEqual(Array.isArray(users), true);
    assert.deepStrictEqual(users, []);
  });

  it('El Dao debe agregar el usuario correctamente a la BD.', async function () {
    const user = {
      first_name: 'Juan',
      last_name: 'Perez',
      email: 'juan.perez@example.com',
      password: '123456',
    };

    const result = await this.userDao.save(user);

    assert.ok(result._id);
    assert.strictEqual(result.first_name, 'Juan');
  });
});

// como ejecutar el test: npx mocha test/dao-user/User.dao.test.js