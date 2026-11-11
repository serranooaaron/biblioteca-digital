import Users from "../dao/Users.dao.js";
import Books from '../dao/Books.dao.js';
import Loans from '../dao/Loan.dao.js';
import Reviews from '../dao/Reviews.dao.js';

import UserRepository from "../repository/UserRepository.js";
import BookRepository from '../repository/BookRepository.js';
import LoanRepository from '../repository/LoanRepository.js';
import ReviewRepository from '../repository/ReviewRepository.js';

export const usersService = new UserRepository(new Users());
export const booksService = new BookRepository(new Books());
export const loansService = new LoanRepository(new Loans());
export const reviewsService = new ReviewRepository(new Reviews());
