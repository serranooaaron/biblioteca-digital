import reservationModel from './models/Reservation.js';

export default class Reservations {
  get = (params) => reservationModel.find(params);
  getBy = (params) => reservationModel.findOne(params);
  save = (doc) => reservationModel.create(doc);
  update = (id, doc) => reservationModel.findByIdAndUpdate(id, { $set: doc }, { new: true, runValidators: true });
  delete = (id) => reservationModel.findByIdAndDelete(id);
  deleteMany = (params) => reservationModel.deleteMany(params);
  count = (params) => reservationModel.countDocuments(params);

  // Cuántos lectores esperan cada libro: { <bookId>: 2, ... }.
  waitingByBook = async () => {
    const rows = await reservationModel.aggregate([{ $group: { _id: '$book', count: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
  };
}
