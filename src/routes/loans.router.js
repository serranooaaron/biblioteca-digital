import { Router } from 'express';
import loansController from '../controllers/loans.controller.js';

const router = Router();

router.get('/', loansController.getAllLoans);
router.get('/:lid', loansController.getLoan);
router.post('/:uid/:bid', loansController.createLoan);

export default router;
