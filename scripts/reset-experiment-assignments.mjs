import fs from 'node:fs';
import pg from 'pg';

const { Pool } = pg;
const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const pool = new Pool({ connectionString: env.DATABASE_URL });
await pool.query('DELETE FROM experiment_assignments WHERE experiment_key = $1', ['okr_create_entry_v1']);
const result = await pool.query('SELECT COUNT(*)::int AS c FROM experiment_assignments WHERE experiment_key = $1', ['okr_create_entry_v1']);
console.log(result.rows[0]);
await pool.end();
