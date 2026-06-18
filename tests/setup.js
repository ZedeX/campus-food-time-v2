// Test setup: initialize D1 database with schema and seed data
import { env } from 'cloudflare:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run schema and seed SQL before all tests
export async function setup() {
  const schemaPath = resolve(process.cwd(), 'worker/src/db/0001_initial_schema.sql');
  const seedPath = resolve(process.cwd(), 'worker/src/db/seed.sql');

  const schema = readFileSync(schemaPath, 'utf-8');
  const seed = readFileSync(seedPath, 'utf-8');

  // Execute schema (split by semicolons, execute each statement)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await env.DB.prepare(stmt).run();
    } catch (err) {
      // Ignore "table already exists" errors
      if (!err.message.includes('already exists')) {
        console.error('Schema error:', err.message, 'in:', stmt.slice(0, 80));
      }
    }
  }

  // Execute seed data
  const seedStatements = seed
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of seedStatements) {
    try {
      await env.DB.prepare(stmt).run();
    } catch (err) {
      if (!err.message.includes('UNIQUE')) {
        console.error('Seed error:', err.message, 'in:', stmt.slice(0, 80));
      }
    }
  }
}
