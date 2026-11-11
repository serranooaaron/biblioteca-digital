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
});

export default mongoose.model('Books', schema);
