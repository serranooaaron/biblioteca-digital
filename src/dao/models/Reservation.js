import mongoose from 'mongoose';

// Un lugar en la lista de espera de un libro. El orden de la lista es el orden de llegada (createdAt).
const schema = new mongoose.Schema({
  book: { type: mongoose.SchemaTypes.ObjectId, ref: 'Books', required: true },
  user: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users', required: true },
}, { timestamps: true });

// Un lector no puede anotarse dos veces al mismo libro; la lista de cada libro se lee por orden de llegada.
schema.index({ book: 1, user: 1 }, { unique: true });
schema.index({ book: 1, createdAt: 1 });
schema.index({ user: 1 });

export default mongoose.model('Reservations', schema);
