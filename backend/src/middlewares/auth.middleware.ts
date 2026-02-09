import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/postgres.client.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        picture: string;
    };
}

export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.substring(7).trim(); // More reliable than split

    // Validate token format (should be a JWT)
    if (!token || token.length < 10) {
        console.warn('Invalid token format');
        return next();
    }

    try {
        // Verify Google ID token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            console.warn('Invalid Google ID token: no payload');
            return next();
        }

        const googleId = payload.sub;
        const email = payload.email;
        const name = payload.name || payload.given_name || 'User';
        const picture = payload.picture || '';

        // Upsert user in database
        const userResult = await pool.query(
            'SELECT * FROM users WHERE google_id = $1',
            [googleId]
        );

        let user = userResult.rows[0];

        if (!user) {
            // Create new user
            const newUserResult = await pool.query(
                'INSERT INTO users (email, google_id, name, picture) VALUES ($1, $2, $3, $4) RETURNING *',
                [email, googleId, name, picture]
            );
            user = newUserResult.rows[0];
        } else {
            // Update user info if changed
            if (user.picture !== picture || user.name !== name) {
                await pool.query(
                    'UPDATE users SET name = $1, picture = $2 WHERE id = $3',
                    [name, picture, user.id]
                );
                user.name = name;
                user.picture = picture;
            }
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        next();
    }
};
