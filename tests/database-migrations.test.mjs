import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('supabase/baseline/catalog.json', root), 'utf8'));
const guard = readFileSync(new URL(`supabase/migrations/${baseline.baselineMigration}`, root), 'utf8');
const migration = readFileSync(new URL(`supabase/migrations/${baseline.initialIncrementalMigration}`, root), 'utf8');
const catalogQuery = readFileSync(new URL('tools/database-catalog.sql', root), 'utf8');
const rpcNames = ['update_own_sidebar_preferences', 'update_own_tutorial_progress'];
const db = new PGlite();

before(async () => {
  await db.exec(`
    create schema auth; create schema storage; create schema extensions;
    create role anon; create role authenticated; create role service_role;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table public.members(id uuid primary key, email text, sidebar_customized boolean default false, sidebar_items text[], tutorial_progress jsonb default '{}');
    alter table public.members enable row level security;
    create table storage.buckets(id text, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    insert into public.members(id,email) values ('00000000-0000-0000-0000-000000000001','a@example.test'),('00000000-0000-0000-0000-000000000002','b@example.test');
  `);
  const functions = [...rpcNames, 'is_visitor_session'].map(name => baseline.snapshot.functions.find(fn => fn.name === name));
  for (const fn of functions) await db.exec(fn.definition + ';');
  await db.exec(`revoke all on function public.update_own_sidebar_preferences(boolean,text[]), public.update_own_tutorial_progress(jsonb) from public;
    grant execute on function public.update_own_sidebar_preferences(boolean,text[]), public.update_own_tutorial_progress(jsonb) to anon,authenticated,service_role;`);
});
after(async () => { await db.close(); });

async function actor(email = 'a@example.test', anonymous = false) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: '00000000-0000-0000-0000-000000000001', email, is_anonymous: anonymous })]);
}
const sidebar = () => db.query("select public.update_own_sidebar_preferences(true, array['my-crew-schedule','equipment','about','my-crew-schedule','unapproved-page']) as saved");

test('captured catalog fingerprint matches PostgreSQL JSONB canonicalization', async () => {
  const result = await db.query('select md5(($1::jsonb)::text) as fingerprint', [JSON.stringify(baseline.snapshot)]);
  assert.equal(result.rows[0].fingerprint, baseline.fingerprint);
  assert.equal(baseline.snapshot.tables.length, 22);
  assert.ok(baseline.snapshot.tables.every(table => table.rls));
});

test('baseline registration rejects schema drift and the guard itself changes no schema or rows', async () => {
  await assert.rejects(db.transaction(tx => tx.exec(guard)), /does not match.*baseline/);
  const observed = (await db.query(catalogQuery)).rows[0];
  const localGuard = guard.replace(baseline.fingerprint, observed.fingerprint);
  await db.transaction(tx => tx.exec(localGuard));
  assert.deepEqual((await db.query(catalogQuery)).rows[0], observed);
  assert.equal((await db.query('select count(*)::int as count from members')).rows[0].count, 2);
});

test('the incremental migration admits the new page while retaining owner scope and RPC grants', async () => {
  await actor();
  await assert.rejects(sidebar(), /at least one sidebar page/);
  const grants = await db.query("select proname, proacl::text as acl from pg_proc where proname = any($1::text[]) order by proname", [rpcNames]);
  await db.exec(migration);
  assert.deepEqual((await db.query("select proname, proacl::text as acl from pg_proc where proname = any($1::text[]) order by proname", [rpcNames])).rows, grants.rows);
  assert.equal((await sidebar()).rows[0].saved, true);
  const members = (await db.query('select email,sidebar_customized,sidebar_items from members order by email')).rows;
  assert.deepEqual(members[0].sidebar_items, ['my-crew-schedule', 'equipment', 'about']);
  assert.equal(members[1].sidebar_customized, false);
  await db.query('select public.update_own_tutorial_progress($1::jsonb)', [JSON.stringify({ completed: ['my-crew-schedule', 'unapproved-page'], active_tour: 'my-crew-schedule', active_step: 1 })]);
  const progress = (await db.query("select tutorial_progress from members where email='a@example.test'")).rows[0].tutorial_progress;
  assert.deepEqual(progress.completed, ['my-crew-schedule']);
  assert.equal(progress.active_tour, 'my-crew-schedule');
});

test('anonymous, visitor and unlinked sessions cannot write another member preferences', async () => {
  const before = (await db.query('select * from members order by email')).rows;
  await db.query("select set_config('request.jwt.claims', '{}', false)");
  await assert.rejects(sidebar(), /signed-in member/);
  await actor('a@example.test', true);
  await assert.rejects(sidebar(), /signed-in member/);
  await assert.rejects(db.query("select public.update_own_tutorial_progress('{}')"), /signed-in member/);
  await actor('unlinked@example.test');
  assert.equal((await sidebar()).rows[0].saved, false);
  assert.deepEqual((await db.query('select * from members order by email')).rows, before);
});
