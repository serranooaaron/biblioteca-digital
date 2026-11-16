import GenericRepository from './GenericRepository.js';

export default class ReviewRepository extends GenericRepository {
  upsert = (book, user, doc) => this.dao.upsert(book, user, doc);
  summary = (book) => this.dao.summary(book);
  countByRating = (book) => this.dao.countByRating(book);
  count = (params) => this.dao.count(params);
  deleteMany = (params) => this.dao.deleteMany(params);
}
