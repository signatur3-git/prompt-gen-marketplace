import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'),

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/prompt_gen_marketplace',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  oauth: {
    clientId: process.env.OAUTH_CLIENT_ID || 'prompt-gen-web',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback',
    authorizationCodeTTL: 600, // 10 minutes
    accessTokenTTL: 3600, // 1 hour
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET || 'prompt-gen-packages',
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'us-east-1',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'https://prompt-gen-marketplace-production.up.railway.app',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  challengeTTL: 300, // 5 minutes for auth challenges
};
