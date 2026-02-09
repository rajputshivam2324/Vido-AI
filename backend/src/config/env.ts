import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory (handles both src/ and dist/ execution)
const envPath1 = join(__dirname, '../.env');
const envPath2 = join(__dirname, '../../.env');
const envPath = existsSync(envPath1) ? envPath1 : envPath2;
dotenv.config({ path: envPath });

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3005', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Google AI
    googleApiKey: process.env.GOOGLE_API_KEY || '',

    // Pinecone (Vector Database)
    pineconeApiKey: process.env.PINECONE_API_KEY || '',
    pineconeIndexName: process.env.PINECONE_INDEX_NAME || '',
    pineconeEnvironment: process.env.PINECONE_ENVIRONMENT || '',

    // PostgreSQL (Neon)
    databaseUrl: process.env.DATABASE_URL || '',
};

// Validate required environment variables
export function validateEnv(): void {
    const required = [
        'GOOGLE_API_KEY',
        'PINECONE_API_KEY',
        'PINECONE_INDEX_NAME',
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    }
}
