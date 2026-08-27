import loanModel from './models/Loan.js';

export default class Loans {
  get = (params) => loanModel.find(params);
  getBy = (params) => loanModel.findOne(params);
  save = (doc) => loanModel.create(doc);
  update = (id, doc) => loanModel.findByIdAndUpdate(id, { $set: doc }, { new: true });
  delete = (id) => loanModel.findByIdAndDelete(id);
}
