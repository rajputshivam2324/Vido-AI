import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getUserSessions, getSessionHistory, getSession } from '../services/chat.service.js';
import { ErrorResponse } from '../types/chat.types.js';

// GET /history - Get all chat sessions for the logged-in user
export async function getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const sessions = await getUserSessions(userId);
        res.json({ sessions });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Internal server error' } as ErrorResponse);
    }
}

// GET /history/:sessionId - Get messages for a specific session
export async function getSessionDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { sessionId } = req.params as { sessionId: string };

    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const session = await getSession(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // Check if session belongs to user
        if (session.user_id !== userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const messages = await getSessionHistory(sessionId);
        res.json({ session, messages });
    } catch (error) {
        console.error('Error fetching session details:', error);
        res.status(500).json({ error: 'Internal server error' } as ErrorResponse);
    }
}
