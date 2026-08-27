import bookModel from './models/Book.js';

export default class Books {
  get = (params) => bookModel.find(params);
  getBy = (params) => bookModel.findOne(params);
  save = (doc) => bookModel.create(doc);
  update = (id, doc) => bookModel.findByIdAndUpdate(id, { $set: doc }, { new: true });
  delete = (id) => bookModel.findByIdAndDelete(id);
}
