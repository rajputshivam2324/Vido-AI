import { Request, Response } from 'express';
import { processQuestion } from '../services/chat.service.js';
import { ChatRequest, ChatResponse, ErrorResponse } from '../types/chat.types.js';
import { config } from '../config/env.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

// POST /ytchatbot - Handle chat questions
export async function handleChatQuestion(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
        const { videoUrl, question, sessionId } = req.body as ChatRequest;
        const userId = authReq.user?.id;

        // Validate required fields
        if (!videoUrl || !question) {
            const errorResponse: ErrorResponse = {
                error: 'Missing required fields: videoUrl and question are required',
            };
            res.status(400).json(errorResponse);
            return;
        }

        console.log('Processing question for video:', videoUrl);

        // Process the question
        const result = await processQuestion(videoUrl, question, sessionId, userId);

        const response: ChatResponse = {
            answer: result.answer,
            sessionId: result.sessionId,
        };

        res.json(response);
    } catch (error: unknown) {
        console.error('Error in chat controller:', error);

        const err = error as Error;
        const errorResponse: ErrorResponse = {
            error: 'Internal server error',
            message: err.message || 'An unexpected error occurred',
            details: config.nodeEnv === 'development' ? err.stack : undefined,
        };

        res.status(500).json(errorResponse);
    }
}

// GET /health - Health check endpoint
export function healthCheck(_req: Request, res: Response): void {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
}
