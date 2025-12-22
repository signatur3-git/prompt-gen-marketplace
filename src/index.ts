import app from './app.js';
import { config } from './config.js';
import { pool, close as closeDb } from './db.js';
import { connectRedis, closeRedis } from './redis.js';
import { initializeStorage, getStorageInfo } from './services/storage.service.js';

async function start() {
  try {
    // Connect to Redis
    await connectRedis();

    // Test database connection
    await pool.query('SELECT NOW()');
    console.info('✅ Database connected');

    // Initialize storage
    await initializeStorage();
    const storageInfo = getStorageInfo();
    console.info(
      `✅ Storage initialized: ${storageInfo.type}`,
      storageInfo.type === 'S3' ? storageInfo.bucket : storageInfo.path
    );

    // Start server
    const server = app.listen(config.port, config.host, () => {
      console.info(`
🚀 Prompt Gen Marketplace Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${config.env}
🌐 Server:      http://${config.host}:${config.port}
📚 API:         http://${config.host}:${config.port}/api/v1
🏥 Health:      http://${config.host}:${config.port}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.info('\n🛑 Shutting down gracefully...');

      server.close(() => {
        console.info('✅ HTTP server closed');
      });

      await closeRedis();
      await closeDb();

      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown());
    process.on('SIGINT', () => void shutdown());
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

void start();
