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
if (baseline.hostedBaselineRecorded) {
  const receipt = JSON.parse(readFileSync(new URL(`supabase/baseline/${baseline.appliedReceipt}`, root), 'utf8'));
  assert.equal(receipt.format, 1);
  assert.equal(receipt.projectRef, baseline.projectRef);
  assert.equal(receipt.baselineFingerprint, baseline.fingerprint);
  assert.ok(receipt.migrations.some(item => item.file === baseline.baselineMigration));
  assert.equal(new Set(receipt.migrations.map(item => item.version)).size, receipt.migrations.length);
  for (const item of receipt.migrations) {
    assert.equal(item.file, `${item.version}_${item.name}.sql`, 'Hosted and local migration IDs differ.');
    assert.ok(files.includes(item.file), `Applied migration is missing: ${item.file}`);
    const sql = readFileSync(new URL(`supabase/migrations/${item.file}`, root));
    assert.equal(createHash('sha256').update(sql).digest('hex'), item.sqlSha256, `Applied SQL changed: ${item.file}. Create a new migration instead.`);
  }
}
const guard = readFileSync(new URL(`supabase/migrations/${baseline.baselineMigration}`, root), 'utf8');
const query = readFileSync(new URL('tools/database-catalog.sql', root), 'utf8').replace(/^--[^\n]*\n/, '').trim();
assert.ok(guard.includes(query.replace('select snapshot, md5(snapshot::text) as fingerprint from catalog;', 'select md5(snapshot::text) into current_fingerprint from catalog;')), 'Baseline guard and read-only catalog query differ.');
assert.ok(guard.includes(`is distinct from '${baseline.fingerprint}'`), 'Baseline fingerprint guard is missing.');
console.log(`Verified the captured catalog and ${files.length} tracked migrations locally. No database connection or SQL execution.`);
