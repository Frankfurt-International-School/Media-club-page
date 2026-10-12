import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { before, after, test } from 'node:test';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const baseline = JSON.parse(read('supabase/baseline/catalog.json'));
const migrationFile = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find(file => file.endsWith('_minimize_student_names.sql'));
const migration = read(`supabase/migrations/${migrationFile}`);
const db = new PGlite();
const ids = ['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
const quote = name => '"' + name.replaceAll('"','""') + '"';

before(async () => {
  await db.exec(`create schema auth; create schema crew_private; create role anon; create role authenticated; create role service_role;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
    create table auth.identities(user_id uuid, identity_data jsonb);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}')$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    set check_function_bodies = false;`);
  for (const table of baseline.snapshot.tables) {
    const columns = table.columns.map(column => `${quote(column.name)} ${column.type}${column.default ? ` default ${column.default}` : ''}${column.not_null ? ' not null' : ''}`);
    await db.exec(`create table public.${quote(table.name)} (${columns.join(',')}); alter table public.${quote(table.name)} enable row level security;`);
  }
  await db.exec('alter table members add primary key(id); alter table announcements add primary key(id); alter table notifications add primary key(id);');
  for (const fn of baseline.snapshot.functions) await db.exec(fn.definition + ';');
  for (const policy of baseline.snapshot.policies.filter(item => item.schemaname === 'public')) {
    await db.exec(`create policy ${quote(policy.policyname)} on public.${quote(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${policy.roles.map(role => role === 'public' ? 'public' : quote(role)).join(',')}${policy.qual ? ` using (${policy.qual})` : ''}${policy.with_check ? ` with check (${policy.with_check})` : ''};`);
  }
  await db.exec(read('supabase/migrations/20261009100231_remove_legacy_public_policies.sql'));
  await db.exec(read('supabase/migrations/20261010225929_announcement_delivery.sql'));
  await db.query(`insert into members(id,name,email,role) values ($1,'Alex PrivateSurname','aa12345@fis.edu','Leader'),($2,'Alex Parker','bb12345@fis.edu','Member'),($3,'Morgan TeacherSurname','teacher@fis.edu','Faculty')`,ids);
  await db.query(`insert into member_team_memberships(member_id,team_key) values ($1,'media_club'),($1,'sac'),($2,'sac'),($3,'media_club')`,ids);
  await db.query(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values ($1,'aa12345@fis.edu','{"full_name":"Alex PrivateSurname","last_name":"PrivateSurname","role":"Faculty","color":"teal"}','{"role":"admin"}'),($2,'teacher@fis.edu','{"full_name":"Morgan TeacherSurname"}','{}')`,[ids[0],ids[2]]);
  await db.query(`insert into auth.identities values ($1,'{"name":"Alex PrivateSurname","family_name":"PrivateSurname","sub":"unchanged"}')`,[ids[0]]);
  await db.exec(`insert into join_applications(name,email,year_group,why) values ('Taylor O’Surname','cc12345@fis.edu','Grade 10','Help Alex PrivateSurname and alex privatesurname.');
    insert into notifications(member_id,notification_type,title,message) values ('${ids[0]}','event_created','Alex PrivateSurname joined','Keep Alex PrivateSurnameExtra intact; welcome alex privatesurname.');
    insert into sac_slot_signups(member_id,member_name_snapshot,event_id,slot_start,slot_end,spot_number) values ('${ids[0]}','Alex PrivateSurname','${ids[1]}','2030-01-01T10:00Z','2030-01-01T10:30Z',1);
    insert into sac_membership_audit(member_id,member_name,action,changed_by_member_id,changed_by_auth_user_id,changed_by_name) values ('${ids[1]}','Alex Parker','membership_added','${ids[0]}','${ids[0]}','Alex PrivateSurname');
    insert into meetings(title,starts_at,ends_at,organizer_member_id,organizer_name,created_by) values ('Planning with Alex PrivateSurname','2030-01-01T10:00Z','2030-01-01T11:00Z','${ids[0]}','Alex PrivateSurname','${ids[0]}');
    insert into equipment(name,archived_by,archived_by_name) values ('Camera','${ids[0]}','Alex PrivateSurname');
    insert into schedule_email_resource_states(resource_type,resource_id,resource_version,resource_snapshot) values ('event','${ids[0]}','2030-01-01T10:00Z','{"title":"Alex PrivateSurname presentation","attendees":["Alex PrivateSurname"],"unchanged":true}');`);
  await db.exec(migration);
});
after(async () => db.close());

test('existing student identities and every snapshot are minimized without merging equal display names', async () => {
  const people = (await db.query('select id,name,email,role from members order by id')).rows;
  assert.deepEqual(people.map(person => person.name),['Alex P.','Alex P.','Morgan TeacherSurname']);
  assert.equal(people[0].id,ids[0]); assert.equal(people[1].id,ids[1]);
  assert.equal(people[0].email,'aa12345@fis.edu'); assert.equal(people[0].role,'Leader');
  for (const [table,column] of [['sac_slot_signups','member_name_snapshot'],['sac_membership_audit','member_name'],['sac_membership_audit','changed_by_name'],['meetings','organizer_name'],['equipment','archived_by_name']]) {
    assert.equal((await db.query(`select ${column} as name from ${table}`)).rows[0].name,'Alex P.');
  }
  assert.equal((await db.query('select name from join_applications')).rows[0].name,'Taylor O.');
});

test('known full-name copies in human-readable text and nested email snapshots are redacted with word boundaries', async () => {
  assert.equal((await db.query('select why from join_applications')).rows[0].why,'Help Alex P. and Alex P..');
  const notice = (await db.query('select title,message from notifications')).rows[0];
  assert.equal(notice.title,'Alex P. joined');
  assert.equal(notice.message,'Keep Alex PrivateSurnameExtra intact; welcome Alex P..');
  assert.deepEqual((await db.query('select resource_snapshot from schedule_email_resource_states')).rows[0].resource_snapshot,
    { title:'Alex P. presentation',attendees:['Alex P.'],unchanged:true });
  assert.equal((await db.query("select to_regclass('pg_temp.student_name_redactions') as dictionary")).rows[0].dictionary,null);
});

test('auth and identity metadata retain IDs and permissions but cannot use a self-declared staff role to preserve surnames', async () => {
  const account = (await db.query('select raw_user_meta_data,raw_app_meta_data from auth.users where id=$1',[ids[0]])).rows[0];
  assert.equal(account.raw_user_meta_data.full_name,'Alex P.');
  assert.equal(account.raw_user_meta_data.last_name,'P');
  assert.equal(account.raw_user_meta_data.color,'teal');
  assert.deepEqual(account.raw_app_meta_data,{role:'admin'});
  const identity = (await db.query('select identity_data from auth.identities')).rows[0].identity_data;
  assert.equal(identity.name,'Alex P.'); assert.equal(identity.family_name,'P'); assert.equal(identity.sub,'unchanged');
  await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"Alex RestoredSurname","family_name":"RestoredSurname","role":"Faculty"}' where id=$1`,[ids[0]]);
  assert.equal((await db.query('select raw_user_meta_data from auth.users where id=$1',[ids[0]])).rows[0].raw_user_meta_data.full_name,'Alex R.');
  assert.equal((await db.query('select raw_user_meta_data from auth.users where id=$1',[ids[2]])).rows[0].raw_user_meta_data.full_name,'Morgan TeacherSurname');
});

test('future direct writes, crafted applications, linked and orphan snapshots are minimized server-side', async () => {
  await db.exec(`insert into join_applications(name,email,year_group,why) values ('Casey StudentSurname','dd12345@fis.edu','Adult','');
    insert into signups(event_id,member_id,attendance_marked_by_name) values ('${ids[1]}','${ids[0]}','Jamie PreviousSurname'),('${ids[1]}','${ids[0]}','personal.name@fis.edu'),('${ids[1]}','${ids[0]}',null);`);
  assert.equal((await db.query("select name from join_applications where email='dd12345@fis.edu'")).rows[0].name,'Casey S.');
  assert.deepEqual((await db.query('select attendance_marked_by_name as name from signups')).rows.map(row=>row.name),['Jamie P.','Club administrator',null]);
  await db.query(`update sac_slot_signups set member_name_snapshot='Forged FullSurname' where member_id=$1`,[ids[0]]);
  assert.equal((await db.query('select member_name_snapshot from sac_slot_signups')).rows[0].member_name_snapshot,'Alex P.');
  await db.query(`update members set name='Alex NewSurname' where id=$1`,[ids[0]]);
  assert.equal((await db.query('select member_name_snapshot from sac_slot_signups')).rows[0].member_name_snapshot,'Alex N.');
});

test('new private helpers and trigger functions cannot be called through anonymous or authenticated RPCs', async () => {
  const functions = (await db.query("select proname,prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon,has_function_privilege('authenticated',oid,'execute') as member from pg_proc where pronamespace='crew_private'::regnamespace and proname in ('student_display_name','identity_display_name','minimize_person_name_fields','minimize_auth_name_metadata','minimize_auth_names','sync_minimized_member_names')")).rows;
  assert.ok(functions.length >= 6);
  for(const fn of functions) { assert.equal(fn.anon,false,fn.proname);assert.equal(fn.member,false,fn.proname);assert.ok(fn.proconfig.includes('search_path=""')); }
  await db.exec('grant usage on schema public,auth to authenticated; grant select on members to authenticated;');
  for(const claims of [{},{email:'unlinked@fis.edu',is_anonymous:false},{email:'aa12345@fis.edu',is_anonymous:true}]) {
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from get_member_directory()')).rows.length,0);
    assert.equal((await db.query('select name from members')).rows.length,0);
    await db.exec('reset role');
  }
});

test('losing verified Faculty status minimizes staff labels already copied to attendance, archives and Auth', async () => {
  await db.query(`insert into signups(event_id,member_id,attendance_marked_by,attendance_marked_by_name) values ($1,$2,$3,'Morgan TeacherSurname')`,[ids[1],ids[0],ids[2]]);
  await db.query(`insert into equipment(name,archived_by,archived_by_name) values ('Staff camera',$1,'Morgan TeacherSurname')`,[ids[2]]);
  await db.query(`update members set role='Member' where id=$1`,[ids[2]]);
  assert.equal((await db.query('select name from members where id=$1',[ids[2]])).rows[0].name,'Morgan T.');
  assert.equal((await db.query('select attendance_marked_by_name as name from signups where attendance_marked_by=$1',[ids[2]])).rows[0].name,'Morgan T.');
  assert.equal((await db.query("select archived_by_name as name from equipment where name='Staff camera'")).rows[0].name,'Morgan T.');
  assert.equal((await db.query('select raw_user_meta_data from auth.users where id=$1',[ids[2]])).rows[0].raw_user_meta_data.full_name,'Morgan T.');
});

test('frontend normalizes legacy student responses before directory, calendar, equipment, application and gallery renderers receive them', () => {
  const core = read('scripts/core.js');
  const context = vm.createContext({state:{members:[],events:[],archivedEvents:[]},colors:['red'],normalizeSacTitle:()=>'',
    formatBerlinDateTime:()=>'',berlinDateKey:()=>'',berlinTimeLabel:()=>'',signupRoleDisplayOrder:[],isVisitorSession:()=>false});
  vm.runInContext(core.slice(core.indexOf('function studentDisplayName'),core.indexOf('const crewCenterDatasets')),context);
  const name = 'Alex PrivateSurname';
  assert.equal(context.normalizeMember({name,role:'Leader'},0).name,'Alex P.');
  assert.equal(context.normalizeMember({name,role:'Faculty'},0).name,name);
  assert.equal(context.normalizeSignup({members:{name}}).name,'Alex P.');
  assert.equal(context.normalizeMeeting({organizer_name:name,meeting_attendees:[{members:{name}}]}).attendees[0].name,'Alex P.');
  assert.equal(context.normalizeEquipment({members:{name},equipment_reservations:[{members:{name},returned_by_name:name}]}).reservations[0].returnedByName,'Alex P.');
  assert.equal(context.normalizeGallery({members:{name}}).author,'Alex P.');
  assert.equal(context.normalizeApplication({name}).lname,'P.');
  for(const [input,expected] of [['  Zoë   Öztürk  ','Zoë Ö.'],['Alex van Dijk','Alex D.'],['李 王','李 王.'],['Alex P.','Alex P.'],['Cher','Cher'],['','']]) {
    assert.equal(context.studentDisplayName(input),expected);
  }
});

test('the public Edge Function minimizes crafted and older form input before handing it to Supabase', async () => {
  const inserts = []; let handler;
  const source = stripTypeScriptTypes(read('supabase/functions/submit-application/index.ts').replace(/^import[^\n]+\n/,''));
  const context = vm.createContext({Request,Response,FormData,URL,AbortSignal,console,
    Deno:{env:{get:key=>({TURNSTILE_SECRET_KEY:'synthetic',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic'})[key]},serve:fn=>{handler=fn;}},
    fetch:async()=>new Response(JSON.stringify({success:true,hostname:'info.fismediaclub.org',action:'join_application'})),
    createClient:()=>({from:()=>({insert:async payload=>{inserts.push(payload);return {error:null};}})}),
  });
  vm.runInContext(source,context);
  for(const [firstName,lastName,expected] of [['Alex','PrivateSurname','Alex P.'],['Zoë','Öztürk','Zoë Ö.'],['Alex AccidentalSurname','Parker','Alex P.']]) {
    const response = await handler(new Request('https://example.test',{method:'POST',headers:{Origin:'https://info.fismediaclub.org','Content-Type':'application/json'},body:JSON.stringify({firstName,lastName,email:'aa12345@fis.edu',yearGroup:'Grade 11',experienceLevel:'Beginner',why:'I would like to help with the club.',turnstileToken:'synthetic'})}));
    assert.equal(response.status,201); assert.equal(inserts.at(-1).name,expected);
    assert.equal(inserts.at(-1).email,'aa12345@fis.edu');
  }
});

test('invitations use the same shortened identity and retain a verified Faculty exception', () => {
  const source = stripTypeScriptTypes(read('supabase/functions/review-application/index.ts').replace(/^import[^\n]+\n/,''));
  const start = source.indexOf('const studentDisplayName');
  const end = source.indexOf('\n};',start)+3;
  const context = vm.createContext({});
  vm.runInContext(source.slice(start,end)+'\nthis.display = studentDisplayName;',context);
  assert.equal(context.display('Alex PrivateSurname'),'Alex P.');
  assert.match(source,/application\.name = studentDisplayName\(application\.name\)/);
  assert.match(source,/full_name: existingMember\?\.role === "Faculty" \? existingMember\.name : studentDisplayName/);
});
