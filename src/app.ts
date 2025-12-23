import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.routes.js';
import personaRoutes from './routes/persona.routes.js';
import namespaceRoutes from './routes/namespace.routes.js';
import packageRoutes from './routes/package.routes.js';
import adminRoutes from './routes/admin.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import path from 'path';

const app = express();

// Trust reverse proxy (Railway, etc.) so X-Forwarded-For is handled correctly.
// This is required for express-rate-limit when behind a proxy.
if (config.env === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/personas', personaRoutes);
app.use('/api/v1/namespaces', namespaceRoutes);
app.use('/api/v1/packages', packageRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/oauth', oauthRoutes);

// API root endpoint (kept for debugging / discovery)
app.get('/api', (_req, res) => {
  res.json({
    name: 'Prompt Gen Marketplace',
    version: '0.1.0',
    description: 'Package registry and discovery platform for Prompt Gen ecosystem',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      personas: '/api/v1/personas',
      namespaces: '/api/v1/namespaces',
      packages: '/api/v1/packages',
      admin: '/api/v1/admin',
      oauth: '/api/v1/oauth',
    },
  });
});

// Serve the frontend in production (the Vite build outputs to dist/public)
if (config.env === 'production') {
  const publicDir = path.join(process.cwd(), 'dist', 'public');
  app.use(express.static(publicDir));

  // SPA fallback: let the Vue router handle non-API routes.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Root endpoint
app.get('/', (_req, res) => {
  // In production, the frontend is served as a static SPA from index.html.
  // In development, keep a simple JSON response.
  res.json({
    name: 'Prompt Gen Marketplace',
    version: '0.1.0',
    description: 'Package registry and discovery platform for Prompt Gen ecosystem',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);

    const message = err instanceof Error ? err.message : undefined;

    res.status(500).json({
      error: 'Internal server error',
      message: config.env === 'development' ? message : undefined,
    });
  }
);

export default app;
