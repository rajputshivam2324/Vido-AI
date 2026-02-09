import { Router } from 'express';
import chatRoutes from './chat.routes.js';

const router = Router();

// Mount chat routes at root level
router.use('/', chatRoutes);

export default router;
