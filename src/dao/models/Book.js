import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  publishedYear: { type: Number, required: true },
  available: { type: Boolean, default: true },
  borrower: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users' },
  cover: String,
});

export default mongoose.model('Books', schema);
