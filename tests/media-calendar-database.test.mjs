import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
let actorId = '';
const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
const m = '00000000-0000-0000-0000-000000000003';
const n = '00000000-0000-0000-0000-000000000004';
const e = '10000000-0000-0000-0000-000000000001';
const f = '10000000-0000-0000-0000-000000000002';
const hash = 'a'.repeat(64); const eventHash = 'c'.repeat(64);
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub',true),'')::uuid $$;
    grant execute on function auth.uid() to authenticated;
    create table auth.users(id uuid primary key, email text, is_anonymous boolean default false, raw_app_meta_data jsonb default '{}', banned_until timestamptz);
    create table public.members(id uuid primary key, email text, name text);
    create table public.member_team_memberships(member_id uuid, team_key text, primary key(member_id,team_key));
    create table public.events(id uuid primary key, title text, location text, date timestamptz, ends_at timestamptz, updated_at timestamptz default now(), archived_at timestamptz, description text);
    create table public.signups(id uuid primary key, event_id uuid, member_id uuid, attendance_start timestamptz, attendance_end timestamptz, signed_up_at timestamptz default now(), confirmed_at timestamptz, signup_role text, confirmation_status text default 'confirmed', confirmation_deadline timestamptz);
    insert into auth.users(id,email) values ('${a}','a@example.test'),('${b}','b@example.test');
    insert into members values ('${m}','a@example.test','Alex P.'),('${n}','b@example.test','Sam D.');
    insert into member_team_memberships values ('${m}','media_club'),('${n}','media_club');
    insert into events(id,title,location,date,ends_at,description) values
      ('${e}','Joined event','Hall',now()+interval '1 day',now()+interval '1 day 3 hours','Do not export this body'),
      ('${f}','Unjoined event','Field',now()+interval '2 days',now()+interval '2 days 2 hours','Private note');
    insert into signups(id,event_id,member_id,attendance_start,attendance_end,signup_role)
      values ('20000000-0000-0000-0000-000000000001','${e}','${m}',now()+interval '1 day 1 hour',now()+interval '1 day 2 hours','Photographer');`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261013171530_media_calendar_subscriptions.sql', import.meta.url), 'utf8'));
});
after(() => db.close());
async function actor(id, role = 'authenticated') {
  actorId = id;
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function manage(kind, action, token = null) {
  return (await db.query('select public.manage_own_media_calendar_subscription($1,$2,$3,$4) as result', [kind, action, actorId || null, token])).rows[0].result;
}
async function read(token) {
  await actor('', 'service_role');
  return (await db.query('select public.read_media_calendar_feed($1) as result', [token])).rows[0].result;
}
test('only a trusted linked Media member can create owner-scoped subscriptions; secrets never leave the database', async () => {
  await actor(a);
  assert.equal((await manage('personal', 'status')).active, false);
  const result = await manage('personal', 'create', hash);
  assert.equal(result.active, true);
  assert.deepEqual(Object.keys(result).sort(), ['active', 'created_at', 'kind']);
  await assert.rejects(db.query('select * from crew_private.media_calendar_subscriptions'), /permission denied/);
  await assert.rejects(db.query('select public.read_media_calendar_feed($1)', [hash]), /permission denied/);
  await assert.rejects(manage('personal', 'create', 'b'.repeat(64)), /already active/);
  await actor(b); assert.equal((await manage('personal', 'status')).active, false);
  await assert.rejects(db.query('select public.manage_own_media_calendar_subscription($1,$2,$3,$4)', ['events', 'create', a, 'b'.repeat(64)]), /Media Club member/);
  await manage('personal', 'revoke'); assert.equal((await read(hash)).entries.length, 1);
});
test('personal feed includes only joined events at booked times; all-events feed includes unjoined events with no identities', async () => {
  await actor(a); await manage('events', 'create', eventHash);
  const personal = await read(hash); const all = await read(eventHash);
  assert.deepEqual(personal.entries.map(row => row.id), [e]);
  assert.deepEqual(all.entries.map(row => row.id), [e, f]);
  assert.equal(Date.parse(personal.entries[0].start) - Date.parse(all.entries[0].start), 3600000);
  assert.equal(personal.entries[0].role, 'Photographer'); assert.equal(all.entries[0].role, null);
  assert.doesNotMatch(JSON.stringify(all) + JSON.stringify(personal), /Alex|Sam|example.test|Private note|Do not export|attendance_status/);
});
test('signup expiry, cancellation, event edits and archives are reflected on the next request', async () => {
  await db.exec('reset role');
  await db.exec("update signups set confirmation_status='maybe',confirmation_deadline=now()+interval '1 hour'");
  assert.equal((await read(hash)).entries[0].tentative, true);
  await db.exec('reset role'); await db.exec("update signups set confirmation_deadline=now()-interval '1 second'");
  assert.deepEqual((await read(hash)).entries, []);
  await db.exec('reset role'); await db.exec("update signups set confirmation_status='confirmed'; update events set title='Changed title' where id='" + e + "'");
  assert.equal((await read(hash)).entries[0].title, 'Changed title');
  await db.exec('reset role'); await db.exec("update events set archived_at=now() where id='" + e + "'");
  assert.equal((await read(eventHash)).entries.length, 1);
  await db.exec('reset role'); await db.exec("update events set archived_at=null; delete from signups");
  assert.deepEqual((await read(hash)).entries, []);
});
test('replacement and revocation stop old links, while one feed leaves the other intact', async () => {
  await actor(a); const replacement = 'd'.repeat(64);
  await manage('personal', 'replace', replacement);
  assert.equal(await read(hash), null); assert.ok(await read(replacement));
  await actor(a); await manage('personal', 'revoke');
  assert.equal(await read(replacement), null); assert.ok(await read(eventHash));
});
test('anonymous, banned, unlinked, visitor and SAC-only accounts are denied; account removal denies a saved feed', async () => {
  for (const sql of ["is_anonymous=true", "banned_until=now()+interval '1 day'", "email='unlinked@example.test'", "raw_app_meta_data='{\"role\":\"visitor\"}'"]) {
    await db.exec('reset role'); await db.exec(`update auth.users set ${sql} where id='${a}'`);
    await actor(a); await assert.rejects(manage('personal', 'status'), /Media Club member/);
    assert.equal(await read(eventHash), null);
    await db.exec('reset role'); await db.exec(`update auth.users set is_anonymous=false,banned_until=null,email='a@example.test',raw_app_meta_data='{}' where id='${a}'`);
  }
  await actor('', 'anon'); await assert.rejects(manage('personal', 'status'), /permission denied/);
  await db.exec('reset role'); await db.exec(`delete from member_team_memberships where member_id='${m}'`);
  assert.equal(await read(eventHash), null);
  await actor(a); await assert.rejects(manage('personal', 'status'), /Media Club member/);
  await db.exec('reset role'); await db.exec(`insert into member_team_memberships values ('${m}','media_club')`);
  assert.equal(await read(eventHash), null, 'Removed membership permanently revokes previous links');
  await actor(a); await manage('events', 'create', eventHash);
  await db.exec('reset role'); await db.exec(`delete from auth.users where id='${a}'`);
  assert.equal(await read(eventHash), null);
});
