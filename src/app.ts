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

const app = express();

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
app.get('/health', (req, res) => {
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

// Root endpoint
app.get('/', (_req, res) => {
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.env === 'development' ? err.message : undefined,
  });
});

export default app;
