import { promises as fs } from 'fs';
import path from 'path';
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

const migrationsDir = path.resolve(process.cwd(), 'sql', 'migrations');
const migrationsTable = 'schema_migrations';

async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function listMigrationFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
      .map(entry => entry.name)
      .sort();
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function getAppliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(`SELECT name FROM ${migrationsTable}`);
  return new Set(result.rows.map(row => row.name));
}

async function applyMigration(pool: pg.Pool, name: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`LOCK TABLE ${migrationsTable} IN EXCLUSIVE MODE`);

    const exists = await client.query<{ name: string }>(
      `SELECT name FROM ${migrationsTable} WHERE name = $1`,
      [name]
    );

    if (exists.rowCount && exists.rowCount > 0) {
      await client.query('ROLLBACK');
      return;
    }

    await client.query(sql);
    await client.query(`INSERT INTO ${migrationsTable} (name) VALUES ($1)`, [name]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function waitForDatabase(pool: pg.Pool, attempts = 10, delayMs = 3000): Promise<void> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    await waitForDatabase(pool);
    await ensureMigrationsTable(pool);

    const files = await listMigrationFiles();
    if (files.length === 0) {
      console.log('No migrations found.');
      return;
    }

    const applied = await getAppliedMigrations(pool);
    const pending = files.filter(file => !applied.has(file));

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      const trimmed = sql.trim();
      if (!trimmed) {
        console.log(`Skipping empty migration ${file}`);
        continue;
      }
      console.log(`Applying migration ${file}...`);
      await applyMigration(pool, file, sql);
      console.log(`Applied migration ${file}.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
