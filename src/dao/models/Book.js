import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  publishedYear: { type: Number, required: true },
  available: { type: Boolean, default: true },
  borrower: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users' },
  cover: String,
  // Se recalculan con cada reseña, así el catálogo no agrega todas las reseñas en cada listado.
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  // Al devolverse un libro con lista de espera queda apartado para el primero de la lista hasta esta fecha.
  heldFor: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users', default: null },
  heldUntil: { type: Date, default: null },
});

// Para encontrar rápido los apartados vencidos y los que esperan a un lector.
schema.index({ heldUntil: 1 }, { sparse: true });
schema.index({ heldFor: 1 }, { sparse: true });

export default mongoose.model('Books', schema);
