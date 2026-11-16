import { Router } from 'express';
import reservationsController from '../controllers/reservations.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// La lista de espera es de cada lector: todas las rutas piden sesión.
router.use(requireAuth);

router.get('/mine', asyncHandler(reservationsController.getMyReservations));
router.post('/:bid', asyncHandler(reservationsController.reserveBook));
router.delete('/:bid', asyncHandler(reservationsController.cancelReservation));

export default router;
