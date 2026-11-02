import { Router } from 'express';
import loansController from '../controllers/loans.controller.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireAdmin, asyncHandler(loansController.getAllLoans));
router.get('/mine', asyncHandler(loansController.getMyLoans));
router.get('/:lid', asyncHandler(loansController.getLoan));
router.post('/:bid', asyncHandler(loansController.borrowBook));
router.post('/:uid/:bid', requireAdmin, asyncHandler(loansController.createLoan));
router.put('/:lid/return', asyncHandler(loansController.returnLoan));

export default router;
