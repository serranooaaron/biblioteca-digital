import mongoose from 'mongoose';
import reviewModel from './models/Review.js';

export default class Reviews {
  get = (params) => reviewModel.find(params);
  getBy = (params) => reviewModel.findOne(params);
  save = (doc) => reviewModel.create(doc);
  update = (id, doc) => reviewModel.findByIdAndUpdate(id, { $set: doc }, { new: true, runValidators: true });
  delete = (id) => reviewModel.findByIdAndDelete(id);
  deleteMany = (params) => reviewModel.deleteMany(params);

  // Crea la reseña del lector o reemplaza la que ya tenía para ese libro.
  upsert = (book, user, doc) =>
    reviewModel.findOneAndUpdate(
      { book, user },
      { $set: doc },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

  // Promedio y cantidad de reseñas de un libro.
  summary = async (book) => {
    const [result] = await reviewModel.aggregate([
      { $match: { book: new mongoose.Types.ObjectId(String(book)) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    return { ratingAvg: result ? Math.round(result.avg * 10) / 10 : 0, ratingCount: result?.count ?? 0 };
  };
}
