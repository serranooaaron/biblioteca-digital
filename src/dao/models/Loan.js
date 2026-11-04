import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users', required: true },
  book: { type: mongoose.SchemaTypes.ObjectId, ref: 'Books', required: true },
  returned: { type: Boolean, default: false },
  dueDate: Date,
  returnedAt: Date,
}, { timestamps: true });

// Cada página del lector cuenta sus préstamos activos, y el panel lista los activos del más nuevo al más viejo.
schema.index({ user: 1, returned: 1 });
schema.index({ returned: 1, createdAt: -1 });

export default mongoose.model('Loans', schema);
