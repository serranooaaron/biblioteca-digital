import chai from 'chai';
import { createHash } from '../../src/utils/index.js';

const expect = chai.expect;


describe('Test de createHash - bcrypt', () => {



    it('Debe retornar un hash distinto al password original', async () => {
        // Given
        const password = '123456';

        // Then
        const hash = await createHash(password);
        // console.log(`Password original: ${password}`);
        // console.log(`Hash generado: ${hash}`);

        // Assert
        expect(hash).to.not.equal(password);
        expect(hash).not.to.be.undefined;
        expect(hash).not.to.be.null;
        expect(hash).to.be.a('string');

    })




})