import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('supabase/baseline/catalog.json', root), 'utf8'));
const cleanup = readFileSync(new URL(`supabase/migrations/${baseline.securityMigration}`, root), 'utf8');
const db = new PGlite();
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const memberA = '00000000-0000-0000-0000-000000000001';
const memberB = '00000000-0000-0000-0000-000000000002';
const faculty = '00000000-0000-0000-0000-000000000003';
const eventId = '00000000-0000-0000-0000-000000000010';

before(async () => {
  await db.exec(`create schema auth; create schema extensions;
    create role anon; create role authenticated; create role service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    set check_function_bodies = false;`);
  for (const table of baseline.snapshot.tables) {
    const columns = table.columns.map(column => `${quote(column.name)} ${column.type}${column.default ? ` default ${column.default}` : ''}${column.not_null ? ' not null' : ''}`);
    await db.exec(`create table public.${quote(table.name)} (${columns.join(',')}); alter table public.${quote(table.name)} enable row level security;`);
  }
  for (const fn of baseline.snapshot.functions) await db.exec(fn.definition + ';');
  for (const name of ['get_public_events', 'get_public_gallery', 'get_public_equipment', 'get_public_announcements']) {
    assert.equal(baseline.snapshot.functions.find(fn => fn.name === name).acl, '{postgres=X/postgres,service_role=X/postgres}');
    await db.exec(`revoke all on function public.${name}() from public; grant execute on function public.${name}() to service_role;`);
  }
  for (const policy of baseline.snapshot.policies.filter(item => item.schemaname === 'public')) {
    const roles = policy.roles.map(role => role === 'public' ? 'public' : quote(role)).join(',');
    await db.exec(`create policy ${quote(policy.policyname)} on public.${quote(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${roles}${policy.qual ? ` using (${policy.qual})` : ''}${policy.with_check ? ` with check (${policy.with_check})` : ''};`);
  }
  await db.exec(`grant usage on schema public,auth to anon,authenticated,service_role;
    grant select,insert on public.signups to anon,authenticated;
    grant select on public.events,public.equipment,public.gallery to anon,authenticated;
    insert into public.members(id,name,email,role) values
      ('${memberA}','Alex A','a@example.test','Member'),('${memberB}','Alex B','b@example.test','Member'),('${faculty}','Test Faculty','faculty@example.test','Faculty');
    insert into public.member_team_memberships(member_id,team_key) values ('${memberA}','media_club'),('${memberB}','media_club'),('${faculty}','media_club');
    insert into public.events(id,title,date,ends_at,category,location) values ('${eventId}','Test production','2030-10-28T11:00:00Z','2030-10-28T13:00:00Z','Livestream','Sports hall');
    insert into public.gallery(project_name,project_scope,member_id) values ('Public showcase','showcase','${memberA}'),('Private athletics project','athletics','${memberB}');
    insert into public.equipment(name) values ('Public equipment summary');
  `);
});
after(async () => { await db.close(); });

async function actor(email = '', { role = 'anon', anonymous = false, admin = false } = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ ...(email ? { sub: memberA } : {}), email, is_anonymous: anonymous, app_metadata: { role: admin ? 'admin' : '' } })]);
  await db.exec(`set role ${role}`);
}
const insertSignup = (memberId = memberB) => db.query(`insert into public.signups(event_id,member_id,signup_role,attendance_type,attendance_start,attendance_end) values ($1,$2,'OBS','whole','2030-10-28T11:00:00Z','2030-10-28T13:00:00Z') returning member_id`, [eventId, memberId]);

test('legacy anonymous signup access is reproduced and rejected by the cleanup migration', async () => {
  await actor();
  await insertSignup();
  assert.equal((await db.query('select id from public.signups')).rows.length, 1);
  assert.equal((await db.query('select id from public.gallery')).rows.length, 2);
  await db.exec('reset role');
  await db.exec(cleanup);
  await actor();
  assert.equal((await db.query('select id from public.signups')).rows.length, 0);
  await assert.rejects(insertSignup(), /row-level security/);
});

test('member self-signup remains allowed while cross-member and visitor signups are denied', async () => {
  await actor('a@example.test', { role: 'authenticated' });
  assert.equal((await insertSignup(memberA)).rows[0].member_id, memberA);
  await assert.rejects(insertSignup(memberB), /row-level security/);
  await db.exec('reset role');
  await db.query("update public.members set role='Leader' where id=$1", [memberA]);
  await actor('a@example.test', { role: 'authenticated' });
  await assert.rejects(insertSignup(memberB), /row-level security/);
  await actor('a@example.test', { role: 'authenticated', anonymous: true });
  await assert.rejects(insertSignup(memberA), /row-level security/);
  assert.equal((await db.query('select id from public.signups')).rows.length, 0);
});

test('Faculty and Auth Admin retain other-member signup access', async () => {
  await actor('faculty@example.test', { role: 'authenticated' });
  assert.equal((await insertSignup(memberB)).rows[0].member_id, memberB);
  await actor('admin@example.test', { role: 'authenticated', admin: true });
  assert.equal((await insertSignup(memberB)).rows[0].member_id, memberB);
});

test('cleanup preserves approved reads and server-only curated RPCs without broad table reads', async () => {
  await db.exec('reset role');
  await db.query("update public.members set role='Member' where id=$1", [memberA]);
  await actor();
  assert.equal((await db.query('select id from public.events')).rows.length, 0);
  assert.equal((await db.query('select id from public.gallery')).rows.length, 0);
  assert.equal((await db.query('select id from public.equipment')).rows.length, 0);
  for (const name of ['get_public_events', 'get_public_gallery', 'get_public_equipment', 'get_public_announcements']) {
    await assert.rejects(db.query(`select * from public.${name}()`), /permission denied/);
  }
  await actor('', { role: 'service_role' });
  assert.equal((await db.query('select * from public.get_public_events()')).rows.length, 1);
  assert.equal((await db.query('select * from public.get_public_gallery()')).rows.length, 1);
  assert.equal((await db.query('select * from public.get_public_equipment()')).rows.length, 1);
  await actor('a@example.test', { role: 'authenticated' });
  await assert.rejects(db.query('select * from public.get_public_events()'), /permission denied/);
  assert.equal((await db.query('select id from public.events')).rows.length, 1);
  assert.equal((await db.query('select id from public.gallery')).rows.length, 1);
  await actor('faculty@example.test', { role: 'authenticated' });
  assert.equal((await db.query('select id from public.gallery')).rows.length, 2);
});
