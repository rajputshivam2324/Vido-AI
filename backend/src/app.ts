import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { ErrorResponse } from './types/chat.types.js';

// Create Express app
const app: Express = express();

// CORS configuration for production and development
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://vidoai.shivamio.in',
];

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins in production for now
        }
    },
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
