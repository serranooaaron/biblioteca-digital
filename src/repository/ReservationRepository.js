import GenericRepository from './GenericRepository.js';

export default class ReservationRepository extends GenericRepository {
  count = (params) => this.dao.count(params);
  deleteMany = (params) => this.dao.deleteMany(params);
  waitingByBook = () => this.dao.waitingByBook();
}
