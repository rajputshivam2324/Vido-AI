import app from './app.js';
import { config, validateEnv } from './config/env.js';
import { initDatabase, closeDatabase } from './db/postgres.client.js';

// Validate environment variables
validateEnv();

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize database (skip if no DATABASE_URL)
    if (config.databaseUrl) {
      await initDatabase();
    } else {
      console.warn('Warning: DATABASE_URL not set. Chat history will not be persisted.');
    }

    // Start listening
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

startServer();