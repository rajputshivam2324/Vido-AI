import { Router } from 'express';
import { handleChatQuestion, healthCheck } from '../controllers/chat.controller.js';
import { getHistory, getSessionDetails } from '../controllers/history.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

const router = Router();

// POST /ytchatbot - Process chat question (with optional auth)
router.post('/ytchatbot', authenticateUser, handleChatQuestion);

// GET /history - Get user's chat history
router.get('/history', authenticateUser, getHistory);

// GET /history/:sessionId - Get specific session details
router.get('/history/:sessionId', authenticateUser, getSessionDetails);

// GET /health - Health check
router.get('/health', healthCheck);

export default router;
