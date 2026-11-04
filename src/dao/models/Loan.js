import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.SchemaTypes.ObjectId, ref: 'Users', required: true },
  book: { type: mongoose.SchemaTypes.ObjectId, ref: 'Books', required: true },
  returned: { type: Boolean, default: false },
  dueDate: Date,
  returnedAt: Date,
}, { timestamps: true });

export default mongoose.model('Loans', schema);
