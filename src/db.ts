import pkg from 'pg';
const { Pool } = pkg;
import { config } from './config.js';

export const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
});

// Test connection
pool.on('connect', () => {
  console.info('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development') {
      console.info('📊 Query executed', { text, duration, rows: result.rowCount });
    }
    return result.rows as T[];
  } catch (error) {
    console.error('❌ Query error:', { text, error });
    throw error;
  }
}

export async function getClient() {
  return await pool.connect();
}

export async function close() {
  await pool.end();
  console.info('🔌 Database connection closed');
}
