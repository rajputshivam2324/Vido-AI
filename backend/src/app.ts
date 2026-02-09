import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { ErrorResponse } from './types/chat.types.js';

// Create Express app
const app: Express = express();

// Middleware
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Mount routes
app.use('/', routes);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);

    const errorResponse: ErrorResponse = {
        error: 'Internal server error',
        message: err.message,
    };

    res.status(500).json(errorResponse);
});

export default app;
