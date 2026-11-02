import { Router } from 'express';
import usersController from '../controllers/users.controller.js';
import { requireAdmin } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// La gestión de usuarios es exclusiva de administradores.
router.use(requireAdmin);

router.get('/', asyncHandler(usersController.getAllUsers));
router.get('/:uid', asyncHandler(usersController.getUser));
router.put('/:uid', asyncHandler(usersController.updateUser));
router.delete('/:uid', asyncHandler(usersController.deleteUser));


export default router;
