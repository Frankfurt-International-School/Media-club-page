import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = readFileSync(new URL('../supabase/migrations/20261014201503_previous_day_setup_attendance.sql', import.meta.url), 'utf8');
const ids = { admin: '00000000-0000-0000-0000-000000000001', faculty: '00000000-0000-0000-0000-000000000002', member: '00000000-0000-0000-0000-000000000003', other: '00000000-0000-0000-0000-000000000004', event: '10000000-0000-0000-0000-000000000001', future: '10000000-0000-0000-0000-000000000002' };
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table auth.users(id uuid primary key);
    create table public.members(id uuid primary key,email text,name text,role text,status text);
    create table public.member_team_memberships(member_id uuid,team_key text);
    create table public.events(id uuid primary key,category text,date timestamptz,ends_at timestamptz,livestream_setup_date date,archived_at timestamptz);
    create function public.is_visitor_session() returns boolean language sql stable as $$ select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) $$;
    create function public.is_crew_schedule_user() returns boolean language sql stable as $$ select auth.jwt()->'app_metadata'->>'role'='admin' $$;
    create function public.is_admin_panel_user() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.is_crew_schedule_user(),false) or exists(select 1 from members where email=auth.jwt()->>'email' and role='Faculty') $$;
    create function public.current_member_id() returns uuid language sql stable security definer set search_path=public as $$ select id from members where email=auth.jwt()->>'email' $$;
    insert into auth.users values('${ids.admin}'),('${ids.faculty}'),('${ids.member}'),('${ids.other}');
    insert into members values('${ids.faculty}','faculty@example.test','Faculty Example','Faculty','active'),('${ids.member}','member@example.test','Alex P.','Member','CAS'),('${ids.other}','other@example.test','Sam D.','Member','active');
    insert into member_team_memberships values('${ids.faculty}','media_club'),('${ids.member}','media_club'),('${ids.other}','media_club');
    insert into events values('${ids.event}','Livestream',((now() at time zone 'Europe/Berlin')::date+1+time '12:00') at time zone 'Europe/Berlin',now()+interval '1 day 2 hours',(now() at time zone 'Europe/Berlin')::date,null),('${ids.future}','Livestream',((now() at time zone 'Europe/Berlin')::date+2+time '12:00') at time zone 'Europe/Berlin',now()+interval '2 days 2 hours',(now() at time zone 'Europe/Berlin')::date+1,null);`);
  await db.exec(migration);
  await db.exec(`update events set livestream_setup_start='00:00',livestream_setup_end='23:59'`);
});
after(() => db.close());
async function actor(role = 'admin', anonymous = false) {
  await db.exec('reset role');
  const who = role === 'admin' ? 'admin' : role === 'faculty' ? 'faculty' : role === 'other' ? 'other' : 'member';
  await db.query("select set_config('test.claims',$1,false)", [JSON.stringify({ sub: ids[who], email: `${who}@example.test`, app_metadata: { role: role === 'admin' ? 'admin' : 'member' }, is_anonymous: anonymous })]);
  await db.exec('set role authenticated');
}
async function record(members = [ids.member], status = 'present', event = ids.event) {
  return (await db.query('select public.record_event_setup_attendance($1,$2,$3) as result', [event, members, status])).rows[0].result;
}

test('setup helpers can be logged together without a game signup; repeat submissions stay unique', async () => {
  await actor();
  const rows = await record([ids.member, ids.other]);
  assert.equal(rows.length, 2); assert.ok(rows.every(row => row.attendance_status === 'present'));
  assert.ok(rows.every(row => row.marked_by === ids.admin));
  await record([ids.member, ids.other]);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as count from event_setup_attendance')).rows[0].count, 2);
  assert.equal((await db.query('select count(*)::int as count from crew_private.event_setup_attendance_history')).rows[0].count, 2);
});

test('Faculty can read the roster but existing attendance authority and visitor restrictions are retained', async () => {
  await actor('faculty'); assert.equal((await db.query('select * from event_setup_attendance')).rows.length, 2);
  await assert.rejects(record(), /Auth Admin/);
  await actor('member'); assert.equal((await db.query('select * from event_setup_attendance')).rows.length, 1);
  await assert.rejects(record([ids.other]), /Auth Admin/);
  await actor('admin', true); assert.equal((await db.query('select * from event_setup_attendance')).rows.length, 0);
  await assert.rejects(record(), /Auth Admin/);
  await db.exec('reset role; set role anon'); await assert.rejects(record(), /permission denied/);
});

test('direct writes, audit reads and forged attendance timestamps are denied even to frontend administrators', async () => {
  await actor();
  await assert.rejects(db.query("update event_setup_attendance set attendance_status='absent'"), /permission denied/);
  await assert.rejects(db.query('delete from event_setup_attendance'), /permission denied/);
  await assert.rejects(db.query('select * from crew_private.event_setup_attendance_history'), /permission denied/);
});

test('corrections preserve actual setup times and add an audit entry; clearing a mark removes earned credit', async () => {
  await actor(); const before = (await record())[0];
  const late = (await record([ids.member], 'late'))[0];
  assert.equal(late.setup_starts_at, before.setup_starts_at); assert.equal(late.setup_ends_at, before.setup_ends_at);
  assert.equal((await record([ids.member], 'not_taken'))[0].attendance_status, 'not_taken');
  await db.exec('reset role'); assert.equal((await db.query('select count(*)::int as count from crew_private.event_setup_attendance_history')).rows[0].count, 4);
});

test('invalid status, duplicate names by ID, unknown members and future setup are rejected atomically', async () => {
  await actor();
  await assert.rejects(record([ids.member], 'confirmed'), /Invalid setup/);
  await assert.rejects(record([ids.member, ids.member]), /distinct members/);
  await assert.rejects(record([ids.member, null]), /distinct members/);
  await assert.rejects(record([ids.admin]), /current Media Club/);
  await assert.rejects(record([ids.member], 'present', ids.future), /opens when setup starts/);
  await db.exec('reset role'); await db.exec(`update events set livestream_setup_date=livestream_setup_date+1 where id='${ids.future}'`);
  await actor(); await assert.rejects(record([ids.member], 'present', ids.future), /day before/);
});

test('archived logs remain readable; late corrections are blocked and deleting the production removes its records', async () => {
  await db.exec('reset role'); await db.exec(`update events set archived_at=now() where id='${ids.event}'`);
  await actor(); await assert.rejects(record(), /active Livestream/);
  assert.equal((await db.query('select * from event_setup_attendance')).rows.length, 2);
  await db.exec('reset role'); await db.exec(`update events set archived_at=null where id='${ids.event}'; update event_setup_attendance set setup_starts_at=now()-interval '7 days',setup_ends_at=now()-interval '6 days'`);
  await actor(); await assert.rejects(record(), /120 hours/);
  await db.exec('reset role'); await db.exec(`delete from events where id='${ids.event}'`);
  assert.equal((await db.query('select count(*)::int as count from event_setup_attendance')).rows[0].count, 0);
});
