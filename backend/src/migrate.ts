import { pool } from './db/postgres.client.js';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        // Add user_id column if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_sessions' AND column_name='user_id') THEN 
                    ALTER TABLE chat_sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE; 
                END IF; 
            END $$;
        `);
        console.log('Added user_id column.');

        // Add title column if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_sessions' AND column_name='title') THEN 
                    ALTER TABLE chat_sessions ADD COLUMN title VARCHAR(255); 
                END IF; 
            END $$;
        `);
        console.log('Added title column.');

        console.log('Migration complete.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
