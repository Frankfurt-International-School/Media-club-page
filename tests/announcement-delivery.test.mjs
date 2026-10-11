import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const baseline = JSON.parse(read('supabase/baseline/catalog.json'));
const migration = read('supabase/migrations/20261010225929_announcement_delivery.sql');
const db = new PGlite();
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const ids = Object.fromEntries(['media','sac','dual','preview','faculty'].map((key, index) => [key, `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`]));
const legacyId = randomUUID();

before(async () => {
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    set check_function_bodies = false;`);
  for (const table of baseline.snapshot.tables) {
    const columns = table.columns.map(column => `${quote(column.name)} ${column.type}${column.default ? ` default ${column.default}` : ''}${column.not_null ? ' not null' : ''}`);
    await db.exec(`create table public.${quote(table.name)} (${columns.join(',')}); alter table public.${quote(table.name)} enable row level security;`);
  }
  for (const name of ['members','announcements','notifications']) await db.exec(`alter table public.${name} add primary key (id);`);
  for (const fn of baseline.snapshot.functions) await db.exec(fn.definition + ';');
  for (const policy of baseline.snapshot.policies.filter(item => item.schemaname === 'public')) {
    await db.exec(`create policy ${quote(policy.policyname)} on public.${quote(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${policy.roles.map(role => role === 'public' ? 'public' : quote(role)).join(',')}${policy.qual ? ` using (${policy.qual})` : ''}${policy.with_check ? ` with check (${policy.with_check})` : ''};`);
  }
  await db.exec(`grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on public.announcements,public.notifications to anon,authenticated;`);
  for (const [name,id] of Object.entries(ids)) await db.query('insert into members(id,name,email,role) values ($1,$2,$3,$4)', [id,name,`${name}@example.test`,name === 'faculty' ? 'Faculty' : 'Member']);
  for (const [name,teams] of [['media',['media_club']],['sac',['sac']],['dual',['media_club','sac']],['preview',[]]]) {
    for (const team of teams) await db.query('insert into member_team_memberships(member_id,team_key) values ($1,$2)', [ids[name],team]);
  }
  await db.query('insert into announcements(id,title,body) values ($1,$2,$3)', [legacyId,'Earlier post','Existing Media Club post']);
  await db.exec(migration);
  await db.exec(read('supabase/migrations/20261011170224_notification_inbox_reads.sql'));
});
after(async () => { await db.close(); });

test('single notification acknowledgement is owner-only, idempotent, and leaves other updates unread', async () => {
  await db.exec('reset role');
  const own = randomUUID(); const another = randomUUID(); const foreign = randomUUID();
  for (const [id, member] of [[own,ids.media],[another,ids.media],[foreign,ids.sac]]) {
    await db.query("insert into public.notifications(id,member_id,title,message,notification_type,page) values ($1,$2,'Event update','Details','event_created','events')", [id,member]);
  }
  await actor('media');
  assert.equal((await db.query('select public.mark_own_notification_read($1) as ok', [foreign])).rows[0].ok, false);
  assert.equal((await db.query('select public.mark_own_notification_read($1) as ok', [own])).rows[0].ok, true);
  const before = (await db.query('select read_at from notifications where id=$1', [own])).rows[0].read_at;
  assert.equal((await db.query('select public.mark_own_notification_read($1) as ok', [own])).rows[0].ok, true);
  assert.deepEqual((await db.query('select read_at from notifications where id=$1', [own])).rows[0].read_at, before);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::integer as n from notifications where id=any($1::uuid[]) and read_at is null', [[another,foreign]])).rows[0].n, 2);
  for (const [name, anonymous] of [['media',true], ['unlinked',false]]) {
    await actor(name, { anonymous });
    assert.equal((await db.query('select public.mark_own_notification_read($1) as ok', [another])).rows[0].ok, false);
  }
  await actor('media', { role:'anon' });
  await assert.rejects(db.query('select public.mark_own_notification_read($1)', [another]), /permission denied/);
});

test('single acknowledgement delegates announcement access checks and exposes only an invoker wrapper', async () => {
  const post = await publish('media_club');
  await db.exec('reset role');
  const notice = (await db.query('select id from notifications where related_announcement_id=$1 and member_id=$2', [post,ids.media])).rows[0].id;
  await actor('media');
  assert.equal((await db.query('select public.mark_own_notification_read($1) as ok', [notice])).rows[0].ok, true);
  await db.exec('reset role');
  const fn = (await db.query("select prosecdef from pg_proc where oid='public.mark_own_notification_read(uuid)'::regprocedure")).rows[0];
  assert.equal(fn.prosecdef, false);
  await db.query('update announcements set archived_at=now() where id=$1', [post]);
  await actor('media');
  assert.equal((await db.query('select public.mark_own_notification_read($1) as ok', [notice])).rows[0].ok, false);
});

async function actor(name = 'admin', { anonymous = false, role = 'authenticated' } = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: ids[name] || randomUUID(), email: `${name}@example.test`, is_anonymous: anonymous, app_metadata: { role: name === 'admin' ? 'admin' : '' } })]);
  await db.exec(`set role ${role}`);
}
async function publish(audience, options = {}) {
  await actor();
  const id = randomUUID();
  await db.query('insert into announcements(id,title,body,audience,pinned,expires_at,action_label,action_url) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id,options.title || 'Scoreboard shifts are open',options.body || 'Choose a shift before Friday.',audience,options.pinned || false,options.expires || null,options.label || '',options.url || '']);
  return id;
}
async function recipientIds(id) {
  await db.exec('reset role');
  return (await db.query('select member_id from notifications where related_announcement_id=$1 order by member_id', [id])).rows.map(row => row.member_id);
}

// These execute the real migration and RLS in PostgreSQL; synthetic records only.
test('legacy posts remain Media Club posts without sending historical notifications', async () => {
  await db.exec('reset role');
  const post = (await db.query('select audience,pinned from announcements where id=$1', [legacyId])).rows[0];
  assert.deepEqual(post, { audience: 'media_club', pinned: false });
  assert.deepEqual(await recipientIds(legacyId), []);
});

test('publishing targets current memberships once, including dual members once', async () => {
  for (const [audience, expected] of [['media_club',[ids.media,ids.dual]],['sac',[ids.sac,ids.dual]],['both',[ids.media,ids.sac,ids.dual]]]) {
    const id = await publish(audience);
    assert.deepEqual(await recipientIds(id), expected.sort());
  }
});

test('SAC preview eligibility and the hostname never grant access to club announcements', async () => {
  const media = await publish('media_club'); const sac = await publish('sac'); const both = await publish('both');
  for (const [name,expected] of [['media',[media,both]],['sac',[sac,both]],['dual',[media,sac,both]],['preview',[]]]) {
    await actor(name);
    const rows = await db.query('select id from announcements where id=any($1::uuid[])', [[media,sac,both]]);
    assert.deepEqual(rows.rows.map(row => row.id).sort(),expected.sort());
  }
  for (const options of [{anonymous:true},{role:'anon'}]) {
    await actor('admin', options);
    assert.equal((await db.query('select id from announcements')).rows.length,0);
    await assert.rejects(db.query("insert into announcements(title,body) values ('Unauthorized','Post')"), /row-level security/);
  }
});

test('only existing admin-panel publishers can create, edit or archive a post', async () => {
  const id = await publish('sac');
  for (const name of ['media','sac','dual','preview']) {
    await actor(name);
    await assert.rejects(db.query("insert into announcements(title,body,audience) values ('No','No','both')"), /row-level security/);
    assert.equal((await db.query('update announcements set body=$1 where id=$2 returning id', ['Changed',id])).rows.length,0);
    assert.equal((await db.query('delete from announcements where id=$1 returning id', [id])).rows.length,0);
  }
  await actor('faculty');
  assert.equal((await db.query('update announcements set body=$1 where id=$2 returning id', ['Faculty update',id])).rows.length,1);
});

test('opening acknowledges only the current member and an accessible, active announcement', async () => {
  const id = await publish('both'); const media = await publish('media_club');
  await actor('sac');
  assert.equal((await db.query('select mark_announcement_read($1) as saved', [media])).rows[0].saved,false);
  assert.equal((await db.query('select mark_announcement_read($1) as saved', [id])).rows[0].saved,true);
  await db.exec('reset role');
  const reads = (await db.query('select member_id,read_at from notifications where related_announcement_id=$1', [id])).rows;
  assert.equal(reads.filter(row => row.read_at).length,1); assert.equal(reads.find(row => row.read_at).member_id,ids.sac);
  await actor('sac',{anonymous:true});
  assert.equal((await db.query('select mark_announcement_read($1) as saved', [id])).rows[0].saved,false);
  await actor('sac',{role:'anon'});
  await assert.rejects(db.query('select mark_announcement_read($1)', [id]), /permission denied/);
});

test('edits and pin changes retain read status and do not create duplicate notices', async () => {
  const id = await publish('both');
  await actor('dual'); await db.query('select mark_announcement_read($1)', [id]);
  await db.exec('reset role');
  const before = (await db.query('select id,member_id,read_at from notifications where related_announcement_id=$1 order by member_id', [id])).rows;
  await actor(); await db.query('update announcements set title=$1,body=$2,pinned=true where id=$3', ['Updated title','Corrected spelling',id]);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id,member_id,read_at from notifications where related_announcement_id=$1 order by member_id', [id])).rows,before);
  assert.ok((await db.query('select title from notifications where related_announcement_id=$1', [id])).rows.every(row => row.title === 'Updated title'));
});

test('changing the audience withdraws old recipients and retains existing recipients read status', async () => {
  const id = await publish('media_club');
  await actor('dual'); await db.query('select mark_announcement_read($1)', [id]);
  await actor(); await db.query("update announcements set audience='sac' where id=$1", [id]);
  assert.deepEqual(await recipientIds(id), [ids.sac,ids.dual].sort());
  await actor('media'); assert.equal((await db.query('select id from notifications where related_announcement_id=$1',[id])).rows.length,0);
  await actor('dual'); assert.ok((await db.query('select read_at from notifications where related_announcement_id=$1',[id])).rows[0].read_at);
});

test('pins replace overlapping notices but independent Media and SAC pins can coexist', async () => {
  const media = await publish('media_club',{pinned:true}); const sac = await publish('sac',{pinned:true});
  await db.exec('reset role');
  assert.equal((await db.query('select id from announcements where pinned and id=any($1::uuid[])',[[media,sac]])).rows.length,2);
  const both = await publish('both',{pinned:true});
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id from announcements where pinned')).rows.map(row => row.id),[both]);
  const replacement = await publish('sac',{pinned:true});
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id from announcements where pinned')).rows.map(row => row.id),[replacement]);
});

test('archive and expiry remove notices from member feeds and bells while admins retain history', async () => {
  const archived = await publish('both'); const expired = await publish('both',{expires:new Date(Date.now()+60000).toISOString()});
  await actor(); await db.query('update announcements set archived_at=now() where id=$1',[archived]);
  await db.exec('reset role');
  // Simulate elapsed time without changing the configured expiry (no new notification).
  await db.exec('alter table announcements disable trigger announcement_prepare');
  await db.exec('alter table announcements disable trigger announcement_delivery');
  await db.query("update announcements set expires_at=now()-interval '1 minute' where id=$1",[expired]);
  await db.exec('alter table announcements enable trigger announcement_prepare');
  await db.exec('alter table announcements enable trigger announcement_delivery');
  await actor('dual');
  assert.equal((await db.query('select id from announcements where id=any($1::uuid[])',[[archived,expired]])).rows.length,0);
  assert.equal((await db.query('select id from notifications where related_announcement_id=any($1::uuid[])',[[archived,expired]])).rows.length,0);
  await actor(); assert.equal((await db.query('select id from announcements where id=any($1::uuid[])',[[archived,expired]])).rows.length,2);
});

test('invalid expiry, injected action URLs and ordinary notification writes are rejected', async () => {
  for (const url of ['https://example.test','//example.test','javascript:alert(1)','/dash\nboard','/dashboard#x','/unknown']) {
    await assert.rejects(publish('both',{url,label:'Open'}), /check constraint/);
  }
  await assert.rejects(publish('both',{expires:'2000-01-01T00:00:00Z'}), /expiry time/);
  await actor('media');
  await assert.rejects(db.query("insert into notifications(member_id,notification_type,title,message) values ($1,'event_created','No','No')",[ids.media]), /row-level security/);
  assert.equal((await db.query("update notifications set read_at=now() where member_id=$1 returning id",[ids.media])).rows.length,0);
});

test('announcement trigger functions are private, and the reader RPC has a fixed search path', async () => {
  await db.exec('reset role');
  for (const name of ['prepare_announcement','deliver_announcement','lock_announcements']) {
    assert.equal((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') as allowed",[`crew_private.${name}()`])).rows[0].allowed,false);
  }
  const config = (await db.query("select proconfig from pg_proc where proname='mark_announcement_read'")).rows[0].proconfig;
  assert.ok(config.some(value => value.startsWith('search_path=')));
});
