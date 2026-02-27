import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function migrationsDir(): string {
  return path.resolve(__dirname, '../../migrations');
}

export async function runMigrations(): Promise<{ applied: string[] }> {
  // Serialize migration runners across concurrent test workers/processes.
  // Use a fixed advisory lock key scoped to this app's migration pipeline.
  const lockKey = 460001;

  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [lockKey]);

    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRes = await lockClient.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    const files = (await fs.readdir(migrationsDir()))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const newlyApplied: string[] = [];

    for (const filename of files) {
      if (applied.has(filename)) continue;
      const sql = await fs.readFile(path.join(migrationsDir(), filename), 'utf8');

      try {
        await lockClient.query('BEGIN');
        await lockClient.query(sql);
        await lockClient.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
        await lockClient.query('COMMIT');
        newlyApplied.push(filename);
      } catch (error) {
        await lockClient.query('ROLLBACK');
        throw error;
      }
    }

    return { applied: newlyApplied };
  } finally {
    try {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } finally {
      lockClient.release();
    }
  }
}
