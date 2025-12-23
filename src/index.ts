import app from './app.js';
import { config } from './config.js';
import { pool, close as closeDb } from './db.js';
import { connectRedis, closeRedis } from './redis.js';
import { initializeStorage, getStorageInfo } from './services/storage.service.js';

function maskUrl(url: string | undefined): string {
  if (!url) return '(missing)';
  try {
    const u = new URL(url);
    // Hide password if present
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    // If it isn't a valid URL, don't log it verbatim.
    return '(set)';
  }
}

function logRuntimeConfig(): void {
  const required = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    REDIS_URL: !!process.env.REDIS_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: !!process.env.JWT_REFRESH_SECRET,
  };

  const railway = {
    RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
    RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN,
    RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
    RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME,
  };

  console.info('\n🧩 Runtime configuration');
  console.info('────────────────────────');
  console.info(`ENV:       ${config.env}`);
  console.info(`HOST:      ${config.host}`);
  console.info(`PORT:      ${config.port}`);
  console.info(`DB URL:    ${maskUrl(process.env.DATABASE_URL)}`);
  console.info(`Redis URL: ${maskUrl(process.env.REDIS_URL)}`);
  console.info(
    `CORS:      ${Array.isArray(config.cors.origin) ? config.cors.origin.join(', ') : config.cors.origin}`
  );
  console.info(
    `Frontend:  ${config.env === 'production' ? 'served from dist/public (if built)' : 'dev via Vite on :5174'}`
  );

  console.info('\nRequired env vars');
  for (const [k, ok] of Object.entries(required)) {
    console.info(`- ${k}: ${ok ? '✅ set' : '❌ missing'}`);
  }

  if (railway.RAILWAY_PUBLIC_DOMAIN || railway.RAILWAY_PRIVATE_DOMAIN) {
    console.info('\nRailway');
    for (const [k, v] of Object.entries(railway)) {
      if (v) console.info(`- ${k}: ${v}`);
    }
  }

  if (!required.DATABASE_URL || !required.REDIS_URL) {
    console.info('\n⚠️  Note: Railway did not provision Postgres/Redis for this service.');
    console.info(
      '   Add a Postgres/Redis plugin in Railway or provide DATABASE_URL / REDIS_URL manually.'
    );
  }
  console.info('────────────────────────\n');
}

async function start() {
  try {
    logRuntimeConfig();

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
    const listenHost = config.env === 'production' ? undefined : config.host;
    const listenTarget = listenHost ? `${listenHost}:${config.port}` : `0.0.0.0:${config.port}`;

    console.info(`🔌 Binding HTTP server on ${listenTarget}`);

    const server = listenHost
      ? app.listen(config.port, listenHost, () => {
          console.info(`
🚀 Prompt Gen Marketplace Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${config.env}
🌐 Server:      http://${config.host}:${config.port}
📚 API:         http://${config.host}:${config.port}/api/v1
🏥 Health:      http://${config.host}:${config.port}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
        })
      : app.listen(config.port, () => {
          console.info(`
🚀 Prompt Gen Marketplace Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${config.env}
🌐 Server:      http://0.0.0.0:${config.port}
📚 API:         http://0.0.0.0:${config.port}/api/v1
🏥 Health:      http://0.0.0.0:${config.port}/health
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
