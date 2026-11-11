import mongoose from 'mongoose';

export const COMMENT_MAX = 600;

const schema = new mongoose.Schema({
  book: { type: mongoose.SchemaTypes.ObjectId, ref: 'Books', required: true },
  user: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true, maxlength: COMMENT_MAX, default: '' },
}, { timestamps: true });

// Una reseña por lector y libro; la página del libro las lista de la más nueva a la más vieja.
schema.index({ book: 1, user: 1 }, { unique: true });
schema.index({ book: 1, createdAt: -1 });

export default mongoose.model('Reviews', schema);
