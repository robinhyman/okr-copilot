import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/pool.js';

async function main() {
  const result = await runMigrations();
  console.log('[migrations]', { applied: result.applied, count: result.applied.length });
}

main()
  .catch((error) => {
    console.error('[migrations.error]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
