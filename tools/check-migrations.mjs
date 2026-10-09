import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('supabase/baseline/catalog.json', root), 'utf8'));
const files = readdirSync(new URL('supabase/migrations/', root)).filter(file => file.endsWith('.sql')).sort();
assert.equal(baseline.format, 1);
assert.equal(createHash('sha256').update(JSON.stringify(baseline.snapshot)).digest('hex'), baseline.snapshotSha256, 'Captured catalog was modified; inspect and re-capture it before updating the fingerprint.');
assert.equal(files[0], baseline.baselineMigration, 'The existing-database baseline must precede incremental changes.');
assert.equal(new Set(files.map(file => file.slice(0, 14))).size, files.length, 'Duplicate migration versions.');
for (const file of files) {
  assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/, 'Create migration files with the Supabase CLI.');
  const sql = readFileSync(new URL(`supabase/migrations/${file}`, root), 'utf8');
  assert.ok(sql.replace(/--[^\n]*/g, '').trim(), `Empty migration: ${file}`);
}
const guard = readFileSync(new URL(`supabase/migrations/${baseline.baselineMigration}`, root), 'utf8');
const query = readFileSync(new URL('tools/database-catalog.sql', root), 'utf8').replace(/^--[^\n]*\n/, '').trim();
assert.ok(guard.includes(query.replace('select snapshot, md5(snapshot::text) as fingerprint from catalog;', 'select md5(snapshot::text) into current_fingerprint from catalog;')), 'Baseline guard and read-only catalog query differ.');
assert.ok(guard.includes(`is distinct from '${baseline.fingerprint}'`), 'Baseline fingerprint guard is missing.');
console.log(`Verified the captured catalog and ${files.length} tracked migrations locally. No database connection or SQL execution.`);
