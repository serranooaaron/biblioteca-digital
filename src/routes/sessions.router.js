import { Router } from 'express';
import sessionsController from '../controllers/sessions.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

router.post('/register', asyncHandler(sessionsController.register));
router.post('/login', asyncHandler(sessionsController.login));
router.post('/logout', sessionsController.logout);
router.get('/current', requireAuth, sessionsController.current);

export default router;
