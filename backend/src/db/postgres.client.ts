import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
});

// Initialize database tables
export async function initDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        picture TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chat_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        video_id VARCHAR(50) NOT NULL,
        video_url TEXT NOT NULL,
        title VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chat_messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster session lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id)
    `);

    console.log('Database tables initialized successfully');
  } finally {
    client.release();
  }
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await pool.end();
  console.log('Database connection closed');
}
