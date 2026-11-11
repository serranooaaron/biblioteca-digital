import GenericRepository from './GenericRepository.js';

export default class ReviewRepository extends GenericRepository {
  upsert = (book, user, doc) => this.dao.upsert(book, user, doc);
  summary = (book) => this.dao.summary(book);
  deleteMany = (params) => this.dao.deleteMany(params);
}
