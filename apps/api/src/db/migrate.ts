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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRes = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedRes.rows.map((r) => r.filename));

  const files = (await fs.readdir(migrationsDir()))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const newlyApplied: string[] = [];

  for (const filename of files) {
    if (applied.has(filename)) continue;
    const sql = await fs.readFile(path.join(migrationsDir(), filename), 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      newlyApplied.push(filename);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied: newlyApplied };
}
