import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = [...indexHtml.matchAll(/<script src="(scripts\/[^"]+)"><\/script>/g)]
  .map(match => readFileSync(new URL(`../${match[1]}`, import.meta.url), 'utf8'))
  .join('\n');
const uiSource = readFileSync(new URL('../scripts/ui.js', import.meta.url), 'utf8');
const meetingsSource = readFileSync(new URL('../scripts/meetings.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const appStyles = readFileSync(new URL('../crew-center.css', import.meta.url), 'utf8');
const policiesSql = readFileSync(new URL('../supabase-auth-policies.sql', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Expected ${name} in the Crew Center scripts`);
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === '{') depth += 1;
    if (appSource[index] === '}') depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Could not find the end of ${name}`);
}

function extractSqlFunction(name) {
  const start = policiesSql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `Expected ${name} in supabase-auth-policies.sql`);
  const end = policiesSql.indexOf('\n$$;', start);
  assert.ok(end > start, `Could not find the end of ${name}`);
  return policiesSql.slice(start, end + 4);
}

function runFunctions(names, context, expression) {
  const source = names.map(extractFunction).join('\n');
  return vm.runInNewContext(`${source}\n${expression}`, context);
}

test('authority tiers preserve the Auth Admin and faculty distinction', () => {
  const functions = [
    'normalizeRoleName',
    'currentMemberRecord',
    'canAccessAdminPanel',
    'canAddMembers',
    'canManageCrewOperations',
    'canCreateMeetings',
    'meetingCreationNeedsFacultyConfirmation',
    'canSignupForOtherMembers',
    'canAccessEquipmentStatus',
    'canAccessCrewSchedule',
  ];

  const capabilities = ({ role = 'Member', authAdmin = false, equipmentStatusAccess = true }) => JSON.parse(JSON.stringify(runFunctions(
    functions,
    {
      state: {
        currentUser: { email: 'test@fis.edu', name: 'Test Member', role, isAdmin: false },
        members: [{ email: 'test@fis.edu', name: 'Test Member', role, equipmentStatusAccess }],
      },
      window: { CREW_CENTER_AUTH_USER: { email: 'test@fis.edu' }, CREW_CENTER_IS_ADMIN: authAdmin },
    },
    '({ admin: canAccessAdminPanel(), addMembers: canAddMembers(), equipment: canManageCrewOperations(), createMeetings: canCreateMeetings(), facultyConfirmation: meetingCreationNeedsFacultyConfirmation(), otherSignups: canSignupForOtherMembers(), equipmentStatus: canAccessEquipmentStatus(), schedule: canAccessCrewSchedule() })',
  )));

  assert.deepEqual(capabilities({ authAdmin: true }), { admin: true, addMembers: true, equipment: true, createMeetings: false, facultyConfirmation: false, otherSignups: true, equipmentStatus: true, schedule: true });
  assert.deepEqual(capabilities({ role: 'Faculty' }), { admin: true, addMembers: false, equipment: true, createMeetings: true, facultyConfirmation: false, otherSignups: true, equipmentStatus: false, schedule: false });
  assert.deepEqual(capabilities({ role: 'Leader' }), { admin: false, addMembers: false, equipment: true, createMeetings: true, facultyConfirmation: true, otherSignups: false, equipmentStatus: false, schedule: false });
  assert.deepEqual(capabilities({ role: 'Co Leader' }), { admin: false, addMembers: false, equipment: true, createMeetings: true, facultyConfirmation: true, otherSignups: false, equipmentStatus: false, schedule: false });
  assert.deepEqual(capabilities({ role: 'Moderator' }), { admin: false, addMembers: false, equipment: true, createMeetings: false, facultyConfirmation: false, otherSignups: false, equipmentStatus: false, schedule: false });
  assert.deepEqual(capabilities({ role: 'Moderator', equipmentStatusAccess: false }), { admin: false, addMembers: false, equipment: true, createMeetings: false, facultyConfirmation: false, otherSignups: false, equipmentStatus: false, schedule: false });
  assert.deepEqual(capabilities({ role: 'Member' }), { admin: false, addMembers: false, equipment: false, createMeetings: false, facultyConfirmation: false, otherSignups: false, equipmentStatus: false, schedule: false });
});

test('News Team is a canonical secondary member tag before specialisations', () => {
  const tags = JSON.parse(JSON.stringify(runFunctions(
    ['memberDirectoryTags'],
    {},
    "memberDirectoryTags('Photography, student NEWS team, Video, News Team')",
  )));

  assert.deepEqual(tags, {
    hasNewsTeam: true,
    specialisations: ['Photography', 'Video'],
  });
  assert.match(appSource, /hasNewsTeam \? '<span class="badge badge-teal">News Team<\/span>'/);
  assert.match(appSource, /badge-\$\{memberRoleColor\(m\.role\)\}[\s\S]*?\$\{tags\}/);
});

test('Meeting visibility and RSVP both follow the selected audience', () => {
  const meetingReadAccess = extractSqlFunction('can_read_meeting');
  const meetingRsvpAccess = extractSqlFunction('can_rsvp_meeting');
  assert.match(schemaSql, /create table if not exists public\.member_team_memberships/);
  assert.match(schemaSql, /team_key text not null check \(team_key in \('news_team'\)\)/);
  assert.match(schemaSql, /insert into public\.member_team_memberships[\s\S]*?student\[\[:space:\]\]\+\)\?news/);
  assert.match(schemaSql, /create table if not exists public\.meetings[\s\S]*?audience in \('general', 'news_team', 'leadership'\)/);
  assert.match(schemaSql, /create table if not exists public\.meeting_attendees[\s\S]*?unique \(meeting_id, member_id\)/);
  assert.match(meetingReadAccess, /not public\.is_approved_member\(\)/);
  assert.match(meetingReadAccess, /target_audience = 'general'/);
  assert.match(meetingReadAccess, /target_audience = 'news_team' then return public\.is_member_of_team\('news_team'\)/);
  assert.match(meetingReadAccess, /target_audience = 'leadership' and public\.is_crew_operations_user\(\)/);
  assert.match(meetingRsvpAccess, /target_audience = 'general'/);
  assert.match(meetingRsvpAccess, /target_audience = 'news_team' then return public\.is_member_of_team\('news_team'\)/);
  assert.match(meetingRsvpAccess, /target_audience = 'leadership' and public\.is_crew_operations_user\(\)/);
  assert.doesNotMatch(meetingRsvpAccess, /if public\.is_crew_operations_user\(\) then return true/);
  assert.doesNotMatch(meetingRsvpAccess, /members\.status|member\.status/);
  assert.match(policiesSql, /create policy "Approved members can read meetings"[\s\S]*?public\.can_read_meeting\(id\)/);
  assert.match(policiesSql, /create policy "Approved members can read meeting attendees"[\s\S]*?public\.can_read_meeting\(meeting_id\)/);
  assert.match(appSource, /members: \(\) => supabaseClient\.rpc\('get_member_directory'\)/);
  assert.match(appSource, /Array\.isArray\(member\.team_keys\)/);

  const frontendAudienceAllowed = (functionName, audience, role = 'Member', teamKeys = [], isAdmin = false) => runFunctions(
    ['normalizeRoleName', 'currentMemberRecord', 'canAccessAdminPanel', 'isVisitorSession', 'canManageCrewOperations', 'canViewMeeting', 'canRsvpMeeting'],
    {
      state: { currentUser: { email: 'test@fis.edu', role, isAdmin, isVisitor: false }, members: [{ id: 'member-1', email: 'test@fis.edu', role, teamKeys }] },
      window: { CREW_CENTER_AUTH_USER: { email: 'test@fis.edu' }, CREW_CENTER_IS_ADMIN: isAdmin, CREW_CENTER_IS_VISITOR: false },
    },
    `${functionName}({ audience: ${JSON.stringify(audience)}, archivedAt: '' })`,
  );
  const frontendVisible = (audience, role = 'Member', teamKeys = [], isAdmin = false) => frontendAudienceAllowed('canViewMeeting', audience, role, teamKeys, isAdmin);
  const frontendRsvpAllowed = (audience, role = 'Member', teamKeys = [], isAdmin = false) => frontendAudienceAllowed('canRsvpMeeting', audience, role, teamKeys, isAdmin);
  assert.equal(frontendVisible('general'), true);
  assert.equal(frontendVisible('news_team'), false);
  assert.equal(frontendVisible('news_team', 'Member', ['news_team']), true);
  assert.equal(frontendVisible('news_team', 'Member', [], true), false, 'Auth Admin status alone must not expose a News Team meeting');
  assert.equal(frontendVisible('leadership'), false);
  assert.equal(frontendVisible('leadership', 'Leader'), true);
  assert.equal(frontendVisible('leadership', 'Member', [], true), true);
  assert.equal(frontendRsvpAllowed('general'), true);
  assert.equal(frontendRsvpAllowed('news_team'), false);
  assert.equal(frontendRsvpAllowed('news_team', 'Member', ['news_team']), true);
  assert.equal(frontendRsvpAllowed('news_team', 'Leader'), false, 'leadership alone must not grant a News Team invitation');
  assert.equal(frontendRsvpAllowed('news_team', 'Leader', ['news_team']), true);
  assert.equal(frontendRsvpAllowed('leadership'), false);
  assert.equal(frontendRsvpAllowed('leadership', 'Leader'), true);
  assert.match(meetingsSource, /const visibleMeetings = state\.meetings\.filter\(canViewMeeting\)/);
  assert.match(meetingsSource, /const visibleArchivedMeetings = state\.archivedMeetings\.filter\(canViewMeeting\)/);
  assert.doesNotMatch(meetingsSource, /visible to every approved member|other approved members may view/i);
  assert.match(meetingsSource, /news_team: \{ label: 'News Team',[^\n]*description: 'Visible only to current News Team members'/);
  assert.match(indexHtml, /value="news_team">News Team only<\/option>/);
});

test('News Team meeting invitations are generated only for current team memberships', () => {
  const start = schemaSql.indexOf('create or replace function public.sync_news_team_meeting_notifications()');
  const end = schemaSql.indexOf('\n$$;', start);
  const meetingNotificationSync = schemaSql.slice(start, end + 4);
  const membershipStart = schemaSql.indexOf('create or replace function public.sync_news_team_membership_notifications()');
  const membershipEnd = schemaSql.indexOf('\n$$;', membershipStart);
  const membershipNotificationSync = schemaSql.slice(membershipStart, membershipEnd + 4);

  assert.ok(start >= 0 && end > start, 'meeting notification trigger function must exist');
  assert.ok(membershipStart >= 0 && membershipEnd > membershipStart, 'team membership notification sync must exist');
  assert.match(schemaSql, /notification_type text not null check \(notification_type in \('event_created', 'meeting_invite'\)\)/);
  assert.match(schemaSql, /related_meeting_id uuid references public\.meetings\(id\) on delete cascade/);
  assert.match(schemaSql, /create unique index if not exists notifications_member_meeting_invite_idx/);
  assert.match(meetingNotificationSync, /from public\.member_team_memberships membership[\s\S]*?membership\.team_key = 'news_team'/);
  assert.doesNotMatch(meetingNotificationSync, /member\.role|member\.status|is_crew_operations_user|leader|moderator/);
  assert.match(meetingNotificationSync, /new\.audience <> 'news_team'/);
  assert.match(meetingNotificationSync, /new\.archived_at is not null/);
  assert.match(meetingNotificationSync, /'meetings',[\s\S]*?new\.id/);
  assert.match(schemaSql, /create trigger meetings_sync_news_team_notifications[\s\S]*?after insert or update of audience, title, starts_at, ends_at, location, archived_at/);
  assert.match(membershipNotificationSync, /tg_op = 'DELETE'[\s\S]*?notification\.notification_type = 'meeting_invite'/);
  assert.match(membershipNotificationSync, /meeting\.audience = 'news_team'[\s\S]*?meeting\.ends_at > now\(\)/);
  assert.match(membershipNotificationSync, /tg_op = 'UPDATE'[\s\S]*?old\.member_id <> new\.member_id/);
  assert.match(schemaSql, /create trigger news_team_memberships_sync_notifications[\s\S]*?after insert or update or delete on public\.member_team_memberships/);
  assert.match(schemaSql, /insert into public\.notifications[\s\S]*?join public\.member_team_memberships membership on membership\.team_key = 'news_team'[\s\S]*?meeting\.ends_at > now\(\)/);
  assert.match(uiSource, /state\.notifications\.filter\(item => item\.notification_type === 'meeting_invite' \|\| preferences\.event_created\)/);
  assert.match(policiesSql, /create policy "Members can read own notifications"[\s\S]*?notifications\.member_id = public\.current_member_id\(\)/);
  assert.doesNotMatch(policiesSql, /create policy "Members can read own notifications"[\s\S]{0,240}?member\.email/);
});

test('Meeting operations use guarded RPCs and RSVP writes remain owner-only', () => {
  for (const name of ['create_meeting', 'update_meeting', 'set_meeting_archived', 'get_meeting_delete_impact', 'permanently_delete_meeting']) {
    assert.match(policiesSql, new RegExp(`create or replace function public\\.${name}\\(`));
  }
  const meetingCreation = extractSqlFunction('create_meeting');
  assert.match(extractSqlFunction('can_create_meetings'), /'faculty', 'leader', 'co-leader'/);
  assert.doesNotMatch(extractSqlFunction('can_create_meetings'), /moderator|is_auth_admin/);
  assert.match(meetingCreation, /if not public\.can_create_meetings\(\)/);
  assert.match(meetingCreation, /organizer_role in \('leader', 'co-leader'\) and not coalesce\(p_faculty_authorized, false\)/);
  assert.match(meetingCreation, /faculty_authorization_confirmed/);
  assert.match(extractSqlFunction('update_meeting'), /if not public\.is_crew_operations_user\(\)/);
  assert.match(extractSqlFunction('permanently_delete_meeting'), /if not public\.is_auth_admin\(\)/);
  assert.match(policiesSql, /create policy "Members can add own meeting RSVP"[\s\S]*?member_id = public\.current_member_id\(\)[\s\S]*?meeting\.ends_at > now\(\)/);
  assert.match(policiesSql, /create policy "Members can update own meeting RSVP"[\s\S]*?member_id = public\.current_member_id\(\)/);
  assert.match(policiesSql, /create policy "Members can remove own meeting RSVP"[\s\S]*?member_id = public\.current_member_id\(\)/);
  assert.equal((policiesSql.match(/public\.can_rsvp_meeting\(meeting_id\)/g) || []).length, 4);
  assert.match(appSource, /supabaseClient\.rpc\('create_meeting',[\s\S]*?p_faculty_authorized: facultyAuthorized/);
  assert.match(indexHtml, /id="meeting-faculty-authorization"[\s\S]*?id="meeting-faculty-authorization-confirmed"/);
  assert.match(appSource, /Confirm that a Faculty member authorized this meeting before scheduling it/);
  assert.match(schemaSql, /faculty_authorization_confirmed boolean not null default false/);
  assert.match(appSource, /supabaseClient\.rpc\('update_meeting'/);
  assert.match(appSource, /from\('meeting_attendees'\)\.upsert\([\s\S]*?onConflict: 'meeting_id,member_id'/);
  assert.match(appSource, /from\('meeting_attendees'\)\.delete\(\)\.eq\('meeting_id', id\)\.eq\('member_id', member\.id\)/);
  assert.doesNotMatch(meetingsSource, /class="meeting-rsvp locked"|RSVP is reserved for the/);
  assert.match(meetingsSource, /if \(!canRsvpMeeting\(meeting\)\) \{ showToast\('This meeting is not available to your audience\.'/);
});

test('sidebar identity omits Auth Admin and Member account labels', () => {
  assert.doesNotMatch(indexHtml, /id="sidebar-user-role"/);
  assert.doesNotMatch(uiSource, /sidebar-user-role/);
  assert.doesNotMatch(authSource, /sidebar-user-role/);
});

test('member directory email access is limited to Auth Admin and Faculty server-side', () => {
  const memberDirectory = extractSqlFunction('get_member_directory');
  const ownMemberId = extractSqlFunction('get_own_member_id');
  const currentMember = extractFunction('currentMemberRecord');
  const normalize = extractFunction('normalizeMember');

  assert.match(memberDirectory, /case when public\.is_admin_panel_user\(\) then member\.email else null end/);
  assert.match(memberDirectory, /lower\(member\.email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(memberDirectory, /member\.notification_preferences else null end/);
  assert.match(memberDirectory, /member\.personal_equipment_preferences else null end/);
  assert.match(memberDirectory, /select array_agg\(membership\.team_key order by membership\.team_key\)/);
  assert.match(policiesSql, /revoke select on table public\.members from anon, authenticated/);
  const safeColumnGrant = policiesSql.match(/grant select \(([^)]+)\) on table public\.members to authenticated/)?.[1] || '';
  assert.ok(safeColumnGrant, 'authenticated members must receive an explicit safe-column grant');
  assert.doesNotMatch(safeColumnGrant, /\bemail\b|sidebar|notification|dashboard|tutorial|equipment/i);
  assert.match(policiesSql, /alter publication supabase_realtime drop table public\.members/);
  assert.match(policiesSql, /grant execute on function public\.get_member_directory\(\) to authenticated/);
  assert.match(ownMemberId, /where lower\(member\.email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(authSource, /crewCenterSupabase\.rpc\("get_own_member_id"\)/);
  assert.doesNotMatch(authSource, /\.from\("members"\)[\s\S]{0,180}\.ilike\("email"/);
  assert.match(appSource, /members: \(\) => supabaseClient\.rpc\('get_member_directory'\)/);
  assert.match(currentMember, /state\.members\.find\(member => member\.isCurrentUser\)/);
  assert.match(normalize, /isCurrentUser: Boolean\(member\.is_current_user\)/);
  assert.match(appSource, /const profileDetails = \[canAccessAdminPanel\(\) \? m\.email : '', m\.gradeLevel\]/);
  assert.doesNotMatch(appSource, /<div class="member-role">\$\{escapeHtml\(m\.email\)\}/);

  const renderDirectory = privileged => runFunctions(
    ['normalizeRoleName', 'memberRankPriority', 'memberRoleColor', 'memberDirectoryTags', 'renderMembers'],
    {
      state: { members: [{ id: 'member-1', fname: 'Test', lname: 'Student', name: 'Test Student', email: 'ts1234@fis.edu', gradeLevel: 'Grade 11', role: 'Member', spec: 'Photography', color: '#fff', avatarUrl: '', joined_date: '2026-01-01' }] },
      canAccessAdminPanel: () => privileged,
      memberColor: () => ['#fff', '#111'],
      safeExternalUrl: () => '',
      escapeHtml: value => String(value),
      initials: () => 'TS',
      document: {
        nodes: {
          'member-search': { value: '' },
          'member-role-filter': { value: '' },
          'members-grid': { innerHTML: '' },
          'members-count': { textContent: '' },
        },
        getElementById(id) { return this.nodes[id]; },
      },
    },
    "renderMembers(); document.nodes['members-grid'].innerHTML",
  );
  const ordinaryHtml = renderDirectory(false);
  const privilegedHtml = renderDirectory(true);
  assert.match(ordinaryHtml, /Test Student/);
  assert.match(ordinaryHtml, /Grade 11/);
  assert.doesNotMatch(ordinaryHtml, /ts1234@fis\.edu/);
  assert.match(privilegedHtml, /ts1234@fis\.edu/);
});

test('Meetings remain a private deep-linked page with a themed watermark hero', () => {
  assert.match(indexHtml, /href="\/meetings" class="nav-item" data-page="meetings"/);
  assert.match(indexHtml, /id="page-meetings" class="page meetings-page"/);
  assert.match(appSource, /meetings: '\/meetings'/);
  assert.match(appSource, /if \(page === 'meetings' && isVisitorSession\(\)\)/);
  assert.match(appStyles, /\.meetings-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.doesNotMatch(appStyles, /\.meetings-hero::after/);
  assert.match(appStyles, /\.meetings-hero \{[\s\S]*?rgba\(164,1,52,\.14\)/);
  assert.match(appStyles, /\.meetings-hero \.page-kicker \{ color: #A40134; \}/);
  assert.match(appStyles, /--meeting-accent: var\(--teal\)/);
  assert.match(appStyles, /@media \(max-width: 768px\)[\s\S]*?\.meeting-card \{ grid-template-columns: 54px minmax\(0, 1fr\)/);
  assert.match(schemaSql, /sidebar_items text\[\] not null default array\[[^\]]*'events','meetings','signup'[^\]]*\]::text\[\]/);
  assert.match(policiesSql, /where item = any\(array\[[^\]]*'events','meetings','signup'[^\]]*\]::text\[\]\)/);
  assert.match(appSource, /meeting_attendees\(id, member_id, response, responded_at, members\(name, role, avatar_url\)\)/);
  assert.doesNotMatch(meetingsSource, /attendee\.email|organizer.*email|auth.*email/i);
  assert.match(meetingsSource, /safeExternalUrl\(meeting\.meetingLink\)/);
});

test('only Auth Admin and Faculty can create event signups for another member', () => {
  assert.match(appSource, /function canSignupForOtherMembers\(\) \{\s*return canAccessAdminPanel\(\);\s*\}/);
  assert.equal((appSource.match(/const canChooseMember = canSignupForOtherMembers\(\);/g) || []).length, 2);
  assert.match(policiesSql, /create policy "Signed-in users can add signups"[\s\S]*?and \(\s*public\.is_admin_panel_user\(\)\s*or signups\.member_id = public\.current_member_id\(\)/);
});

test('Equipment Status restrictions are enforced in the UI and server workflows', () => {
  const equipmentStatusAccess = extractSqlFunction('can_access_equipment_status');
  assert.match(schemaSql, /equipment_status_access boolean not null default true/);
  assert.match(appSource, /function canAccessEquipmentStatus\(\) \{\s*return canAddMembers\(\);\s*\}/);
  assert.match(equipmentStatusAccess, /select public\.is_auth_admin\(\)/);
  assert.doesNotMatch(equipmentStatusAccess, /is_crew_operations_user|equipment_status_access|is_admin_panel_user/);
  assert.match(policiesSql, /create or replace function public\.set_equipment_operational_status/);
  assert.match(policiesSql, /create or replace function public\.mark_equipment_reservation_returned[\s\S]*?if not public\.can_access_equipment_status\(\)/);
  assert.match(appSource, /if \(page === 'equipment-status' && !canAccessEquipmentStatus\(\)\)/);
  assert.match(appSource, /supabaseClient\.rpc\('set_equipment_operational_status'/);
});

test('camera and lens visuals are lightweight, model-matched, and isolated to the ordinary Equipment page', () => {
  const profiles = JSON.parse(JSON.stringify(runFunctions(
    ['equipmentDeviceVisual'],
    {},
    `[
      { name: 'Canon EOS R6' },
      { name: 'Canon 700D camera' },
      { name: 'Canon 70D #2' },
      { name: 'Canon 600d' },
      { name: 'EOS 450 D' },
      { name: 'Panasonic Lumix GH6' },
      { name: 'Camera body', detail: 'Canon EOS R6' },
      { name: 'General camera', detail: 'Canon 70D and Canon 700D' },
      { name: 'Sony PXW' },
    ].map(item => {
      const device = equipmentDeviceVisual(item);
      return device ? { slug: device.slug, brand: device.brand, model: device.model, src: device.src } : null;
    })`,
  )));

  assert.deepEqual(profiles.map(profile => profile?.slug || null), [
    'canon-r6',
    'canon-700d',
    'canon-70d',
    'canon-600d',
    'canon-450d',
    'lumix-gh6',
    'canon-r6',
    null,
    null,
  ]);

  const lensProfiles = JSON.parse(JSON.stringify(runFunctions(
    ['equipmentDeviceVisual'],
    {},
    `[
      { name: 'Canon EF-S 18–135mm f/3.5–5.6 IS USM' },
      { name: 'Canon EF-S 18–55mm f/3.5–5.6 IS II' },
      { name: 'Canon EF-S 24mm f/2.8 STM' },
      { name: 'Canon EF-S 50mm f/1.8 STM' },
      { name: 'Canon EF-S 55–250mm f/4–5.6 IS STM' },
      { name: 'Canon EF-S 55–250mm f/4–5.6 IS STM · Unit 2' },
      { name: 'Sigma 24–70mm f/2.8 DG DN Art' },
      { name: 'Leica DG Vario-Elmarit 12–60mm f/2.8–4' },
      { name: 'Olympus M.Zuiko Digital ED 40–150mm f/2.8 PRO' },
    ].map(item => {
      const device = equipmentDeviceVisual(item);
      return device ? { slug: device.slug, kind: device.kind, src: device.src } : null;
    })`,
  )));
  assert.deepEqual(lensProfiles.map(profile => profile?.slug || null), [
    'canon-ef-s-18-135', 'canon-ef-s-18-55', 'canon-ef-s-24', 'canon-ef-50',
    'canon-ef-s-55-250', 'canon-ef-s-55-250', 'sigma-24-70', 'leica-dg-12-60', 'olympus-40-150',
  ]);
  assert.ok(lensProfiles.every(profile => profile?.kind === 'lens'));

  const assetNames = ['canon-r6.webp', 'canon-70d.webp', 'canon-700d.webp', 'canon-600d.webp', 'canon-450d.webp', 'lumix-gh6.webp'];
  for (const assetName of assetNames) {
    const asset = readFileSync(new URL(`../assets/equipment/${assetName}`, import.meta.url));
    assert.equal(asset.subarray(0, 4).toString(), 'RIFF', `${assetName} must use a WebP RIFF container`);
    assert.equal(asset.subarray(8, 12).toString(), 'WEBP', `${assetName} must be a WebP image`);
    assert.ok(asset.length <= 160 * 1024, `${assetName} must remain at or below 160 KB`);
  }

  const lensAssetNames = [
    'canon-ef-s-18-135.webp', 'canon-ef-s-18-55.webp', 'canon-ef-s-24.webp', 'canon-ef-50.webp',
    'canon-ef-s-55-250.webp', 'sigma-24-70.webp', 'leica-dg-12-60.webp', 'olympus-40-150.webp',
  ];
  let totalLensBytes = 0;
  for (const assetName of lensAssetNames) {
    const asset = readFileSync(new URL(`../assets/equipment/lenses/${assetName}`, import.meta.url));
    totalLensBytes += asset.length;
    assert.equal(asset.subarray(0, 4).toString(), 'RIFF', `${assetName} must use a WebP RIFF container`);
    assert.equal(asset.subarray(8, 12).toString(), 'WEBP', `${assetName} must be a WebP image`);
    assert.equal(asset.subarray(12, 16).toString(), 'VP8X', `${assetName} must use extended WebP for transparency`);
    assert.ok(asset[20] & 0x10, `${assetName} must include a transparent alpha channel`);
    assert.ok(asset.length <= 80 * 1024, `${assetName} must remain at or below 80 KB`);
  }
  assert.ok(totalLensBytes <= 240 * 1024, 'the complete lens image set must remain lightweight');

  const ordinaryEquipment = appSource.slice(appSource.indexOf('function renderEquipment()'), appSource.indexOf('function renderEquipmentStatus()'));
  const equipmentStatus = appSource.slice(appSource.indexOf('function renderEquipmentStatus()'), appSource.indexOf('function requestCancelEquipmentReservation('));
  assert.match(ordinaryEquipment, /class="equipment-device-visual brand-\$\{device\.brandKey\}\$\{device\.kind === 'lens'/);
  assert.match(ordinaryEquipment, /loading="lazy" decoding="async"/);
  assert.match(ordinaryEquipment, /openEquipmentDeviceView/);
  assert.doesNotMatch(equipmentStatus, /equipmentDeviceVisual|equipment-device-visual|openEquipmentDeviceView/);
  assert.match(indexHtml, /id="equipment-device-modal"[\s\S]*?id="equipment-device-image"[\s\S]*?id="equipment-device-reserve"/);
  assert.doesNotMatch(indexHtml, /id="equipment-device-image"[^>]*\ssrc=/, 'the hidden console must not eagerly download a camera image');
  assert.match(appStyles, /\.equipment-device-modal[\s\S]*?#equipment-device-modal\[data-brand="lumix"\]/);
  assert.match(appStyles, /#equipment-device-modal\[data-brand="sigma"\][\s\S]*?#equipment-device-modal\[data-brand="olympus"\]/);
  assert.match(appStyles, /@media \(max-width: 768px\)[\s\S]*?\.equipment-device-modal \{ grid-template-columns: 1fr/);
});

test('Crew Schedule and attendance are Auth Admin-only in the UI and database', () => {
  const crewScheduleAccess = extractSqlFunction('is_crew_schedule_user');
  assert.match(appSource, /function canAccessCrewSchedule\(\) \{\s*return canAddMembers\(\);\s*\}/);
  assert.match(crewScheduleAccess, /select public\.is_auth_admin\(\)/);
  assert.doesNotMatch(crewScheduleAccess, /is_admin_panel_user|leader|co-leader|faculty/);
  assert.match(policiesSql, /create or replace function public\.mark_signup_attendance[\s\S]*?if not public\.is_crew_schedule_user\(\)[\s\S]*?Auth Admin access is required\./);
  assert.match(appSource, /if \(page === 'crew-deployment' && !canAccessCrewSchedule\(\)\)/);
});

test('signup windows use half-open boundaries', () => {
  const overlap = (a, b) => runFunctions(['signupWindowsOverlap'], {}, `signupWindowsOverlap(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
  const first = { attendanceStart: '2026-08-01T08:00:00Z', attendanceEnd: '2026-08-01T10:00:00Z' };

  assert.equal(overlap(first, { attendanceStart: '2026-08-01T09:59:00Z', attendanceEnd: '2026-08-01T11:00:00Z' }), true);
  assert.equal(overlap(first, { attendanceStart: '2026-08-01T10:00:00Z', attendanceEnd: '2026-08-01T11:00:00Z' }), false);
  assert.equal(overlap(first, { attendanceStart: null, attendanceEnd: null }), true, 'unknown attendance remains conservatively conflicting');

  const halfOpenSignupRanges = schemaSql.match(/tstzrange\(attendance_start, attendance_end, '\[\)'\) with &&/g) || [];
  assert.ok(halfOpenSignupRanges.length >= 3, 'database signup exclusions must use the same [start, end) boundary');
});

test('all event categories require and display an approximate end time', () => {
  const boundarySync = extractFunction('syncEventBoundaryFields');
  const structuredBoundaries = extractFunction('eventStructuredBoundaryTimes');
  const addEvent = extractFunction('addEvent');
  const attendanceWindow = extractFunction('selectedAttendanceWindow');

  assert.match(indexHtml, /id="ev-time" type="time" required/);
  assert.match(indexHtml, /Approximate end time \*[\s\S]*?id="ev-end-time" type="time" required/);
  assert.match(boundarySync, /Start and approximate end are synchronized/);
  assert.match(boundarySync, /input\.readOnly = true/);
  assert.match(structuredBoundaries, /ev-takedown-end/);
  assert.match(structuredBoundaries, /ev-game4-end[\s\S]*?ev-game3-end/);
  assert.match(structuredBoundaries, /ev-game2-end/);
  assert.match(addEvent, /!hasStructuredSchedule && \(!startTime \|\| !approximateEndTime\)/);
  assert.match(addEvent, /approximateEndTime <= startTime/);
  assert.match(addEvent, /ends_at: new Date\(eventEnd\)\.toISOString\(\)/);
  assert.match(appSource, /endTime: event\.ends_at \? berlinTimeLabel\(event\.ends_at\) : ''/);
  assert.match(attendanceWindow, /ev\.game1End \|\| ev\.endTime \|\| '23:59'/);
  assert.match(schemaSql, /alter table public\.events add column if not exists ends_at timestamptz/);
  assert.match(schemaSql, /set ends_at = date \+ interval '1 hour'[\s\S]*?where ends_at <= date/);
  assert.match(schemaSql, /alter table public\.events alter column ends_at set not null/);
  assert.match(schemaSql, /events_end_window_check check \(ends_at > date\)/);

  const label = event => runFunctions(['eventApproximateEndMessage', 'eventScheduleTimeLabel'], {}, `eventScheduleTimeLabel(${JSON.stringify(event)})`);
  assert.equal(label({ cat: 'Recording (live cut)', time: '15:30', endTime: '18:00' }), '15:30 · Approximate end time: 18:00');
  assert.equal(label({ cat: 'Recording (live cut)', time: '15:30', endTime: '23:59' }), '15:30');
  assert.equal(label({ cat: 'Event', time: '15:30', endTime: '18:00' }), '15:30 · Approximate end time: 18:00');
  assert.equal(label({ cat: 'Livestream', time: '09:00', endTime: '16:30', isSports: true }), '09:00 · Approximate end time: 16:30');
});

test('Event and live-cut role matrices enforce presets and independent Photographer capacity', () => {
  const allRoles = ['Adult Supervisor', 'Student Supervisor', 'MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless', 'Photographer'];
  const roleConfig = event => JSON.parse(JSON.stringify(runFunctions(
    ['eventCategorySupportsRoleSetup', 'eventOpenRoleLabels', 'eventRoleCapacity'],
    { configurableSignupCategories: ['Event', 'Recording (live cut)'], signupRoleDisplayOrder: allRoles, signupRoleLabels: { photographer: 'Photographer' } },
    `({ roles: eventOpenRoleLabels(${JSON.stringify(event)}), photographerSlots: eventRoleCapacity(${JSON.stringify(event)}, 'Photographer'), obsSlots: eventRoleCapacity(${JSON.stringify(event)}, 'OBS') })`,
  )));
  const preset = name => JSON.parse(JSON.stringify(runFunctions(
    ['eventRolePresetRoles'],
    { signupRoleDisplayOrder: allRoles, signupRoleLabels: { adult_supervisor: 'Adult Supervisor', photographer: 'Photographer', wireless: 'Wireless' } },
    `eventRolePresetRoles('${name}')`,
  )));

  assert.deepEqual(roleConfig({ cat: 'Event', openSignupRoles: ['Photographer'], photographerSlotLimit: 4 }), { roles: ['Photographer'], photographerSlots: 4, obsSlots: 0 });
  assert.deepEqual(roleConfig({ cat: 'Recording (live cut)', openSignupRoles: ['OBS', 'Photographer'], photographerSlotLimit: 8 }), { roles: ['OBS', 'Photographer'], photographerSlots: 8, obsSlots: 1 });
  assert.deepEqual(roleConfig({ cat: 'Event', openSignupRoles: ['OBS'], singleRoleSlotLimit: 3 }), { roles: ['OBS'], photographerSlots: 0, obsSlots: 3 });
  assert.deepEqual(roleConfig({ cat: 'Livestream', openSignupRoles: ['Photographer'], photographerSlotLimit: 8 }), { roles: allRoles, photographerSlots: 1, obsSlots: 1 });
  assert.deepEqual(preset('standard'), allRoles.filter(role => role !== 'Wireless'));
  assert.deepEqual(preset('photography'), ['Adult Supervisor', 'Photographer']);
  assert.deepEqual(preset('full'), allRoles);

  assert.match(indexHtml, /id="ev-role-setup" hidden[\s\S]*?data-event-role-preset="standard"[\s\S]*?data-event-role-preset="photography"[\s\S]*?data-event-role-preset="full"[\s\S]*?id="ev-open-role-grid"/);
  assert.match(indexHtml, /id="ev-photographer-slots" hidden[\s\S]*?id="ev-photographer-slot-limit"[\s\S]*?id="ev-single-role-slot-limit"/);
  assert.match(appSource, /for="ev-open-role-\$\{index \+ 1\}"[\s\S]*?id="ev-open-role-\$\{index \+ 1\}"/);
  assert.match(appSource, /open_signup_roles: openSignupRoles/);
  assert.match(appSource, /single_role_slot_limit: singleRoleSlotLimit/);
  assert.match(appSource, /photographer_slot_limit: photographerSlotLimit/);
  assert.match(appSource, /setEventSignupRoles\(event\.openSignupRoles\)/);
  assert.match(appSource, /overlappingRoleSignups\.length >= roleCapacity/);
  assert.match(schemaSql, /open_signup_roles text\[\] not null default/);
  assert.match(schemaSql, /single_role_slot_limit smallint not null default 1/);
  assert.match(schemaSql, /photographer_slot_limit smallint not null default 1/);
  assert.match(schemaSql, /role_slot smallint not null default 1/);
  assert.match(schemaSql, /create or replace function public\.assign_signup_role_slot\(\)[\s\S]*?for update[\s\S]*?new\.signup_role = 'Photographer'[\s\S]*?target_event\.photographer_slot_limit[\s\S]*?No signup slots are available/);
  assert.match(schemaSql, /signup_role with =,\s*role_slot with =,\s*tstzrange\(attendance_start, attendance_end, '\[\)'\) with &&/);
  const validSignup = extractSqlFunction('is_valid_event_signup');
  assert.match(validSignup, /event\.category not in \('Event', 'Recording \(live cut\)'\)[\s\S]*?p_signup_role = any\(event\.open_signup_roles\)/);
  const validReserveRoles = extractSqlFunction('are_event_reserve_roles_open');
  assert.match(validReserveRoles, /p_signup_role is distinct from 'Student Supervisor'[\s\S]*?p_reserve_role_1 = any\(event\.open_signup_roles\)[\s\S]*?p_reserve_role_2 = any\(event\.open_signup_roles\)/);
  assert.match(policiesSql, /public\.are_event_reserve_roles_open\(event_id, signup_role, reserve_role_1, reserve_role_2\)/);
  assert.match(policiesSql, /grant execute on function public\.are_event_reserve_roles_open\(uuid, text, text, text\) to authenticated/);
  assert.match(appSource, /filter\(role => role && openRoles\.includes\(role\)\)/);
  const updateGrant = policiesSql.match(/grant update \(([\s\S]*?)\) on table public\.events to authenticated/)?.[1] || '';
  assert.match(updateGrant, /open_signup_roles/);
  assert.match(updateGrant, /single_role_slot_limit/);
  assert.match(updateGrant, /photographer_slot_limit/);
});

test('production staff can edit events without replacing linked records or lifecycle fields', () => {
  const openEditor = extractFunction('openEventEditor');
  const saveEvent = extractFunction('addEvent');
  const updateGrant = policiesSql.match(/grant update \(([\s\S]*?)\) on table public\.events to authenticated/)?.[1] || '';
  const renderEventCard = canManage => runFunctions(
    ['renderEvents'],
    {
      state: {
        eventFilter: 'all',
        showPastEvents: false,
        events: [{ id: 'event-1', title: 'Test event', date: '2026-09-18', time: '17:30', loc: 'Studio', cat: 'Event', signups: [], slots: 0 }],
      },
      renderArchivedEvents() {},
      isPastEvent: () => false,
      fmtMonth: () => 'SEP',
      fmtDay: () => '18',
      eventScheduleTimeLabel: () => '17:30',
      escapeHtml: value => String(value),
      pageUrl: () => '/signup?event=event-1',
      catColor: () => 'purple',
      sportsScheduleCaption: () => '',
      isstScheduleCaption: () => '',
      festivalScheduleCaption: () => '',
      livestreamSetupCaption: () => '',
      eventRoleSetupCaption: () => '',
      isVisitorSession: () => false,
      canManageCrewOperations: () => canManage,
      canAddMembers: () => false,
      document: {
        nodes: {
          'past-events-toggle': { textContent: '', classList: { toggle() {} }, setAttribute() {} },
          'events-list': { innerHTML: '' },
        },
        getElementById(id) { return this.nodes[id]; },
      },
    },
    "renderEvents(); document.nodes['events-list'].innerHTML",
  );

  assert.match(indexHtml, /onclick="openEventEditor\(\)"[\s\S]*?Add event/);
  assert.match(appSource, /onclick="openEventEditor\('\$\{ev\.id\}'\)"[^>]*>Edit event<\/button>/);
  assert.match(renderEventCard(true), /Edit event/);
  assert.doesNotMatch(renderEventCard(false), /Edit event/);
  assert.match(openEditor, /if \(!canManageCrewOperations\(\)\)/);
  assert.match(openEditor, /document\.getElementById\('ev-title'\)\.value = event\.title/);
  assert.match(openEditor, /document\.getElementById\('ev-date'\)\.value = event\.date/);
  assert.match(openEditor, /document\.getElementById\('ev-cat'\)\.value = event\.cat/);
  assert.match(saveEvent, /supabaseClient\.from\('events'\)\.update\(payload\)\.eq\('id', editingEvent\.id\)/);
  assert.match(saveEvent, /state\.events = state\.events\.map\(event => event\.id === ev\.id \? ev : event\)/);
  assert.match(indexHtml, /Existing signups and equipment reservations remain on this event/);
  assert.match(authSource, /openEventEditor: "manage events"/);
  assert.match(policiesSql, /create policy "Production staff can update events"[\s\S]*?using \(public\.is_crew_operations_user\(\)\)[\s\S]*?with check \(public\.is_crew_operations_user\(\)\)/);
  assert.match(policiesSql, /revoke update on table public\.events from anon, authenticated/);
  assert.match(updateGrant, /title/);
  assert.match(updateGrant, /ends_at/);
  assert.doesNotMatch(updateGrant, /archived|created_at/);
  assert.doesNotMatch(policiesSql, /create policy "Admins can update events"/);
});

test('equipment reservations use half-open boundaries and lifecycle states', () => {
  const overlaps = (start, end, otherStart, otherEnd) => runFunctions(
    ['reservationOverlaps'],
    {},
    `reservationOverlaps(${start}, ${end}, ${JSON.stringify(otherStart)}, ${JSON.stringify(otherEnd)})`,
  );
  const start = Date.parse('2026-08-01T08:00:00Z');
  const end = Date.parse('2026-08-01T10:00:00Z');
  assert.equal(overlaps(start, end, '2026-08-01T09:59:00Z', '2026-08-01T11:00:00Z'), true);
  assert.equal(overlaps(start, end, '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z'), false);

  const status = (reservation, now) => runFunctions(
    ['reservationLifecycleStatus'],
    {},
    `reservationLifecycleStatus(${JSON.stringify(reservation)}, ${now})`,
  );
  assert.equal(status({ status: 'returned', startsAt: '2026-08-01T08:00:00Z', endsAt: '2026-08-01T10:00:00Z' }, start), 'returned');
  assert.equal(status({ status: 'scheduled', startsAt: '2026-08-01T08:00:00Z', endsAt: '2026-08-01T10:00:00Z' }, start - 1), 'scheduled');
  assert.equal(status({ status: 'scheduled', startsAt: '2026-08-01T08:00:00Z', endsAt: '2026-08-01T10:00:00Z' }, start), 'checked_out');
  assert.equal(status({ status: 'scheduled', startsAt: '2026-08-01T08:00:00Z', endsAt: '2026-08-01T10:00:00Z' }, end + 15 * 60 * 1000), 'auto_released');

  assert.match(schemaSql, /tstzrange\(starts_at, ends_at, '\[\)'\) with &&/);
});

test('outside-event camera eligibility remains Grade 11 or 12 only', () => {
  const allowed = (category, gradeLevel) => runFunctions(
    ['isCameraEquipment', 'memberGradeNumber', 'canReserveOutsideEvent'],
    {},
    `canReserveOutsideEvent(${JSON.stringify({ category })}, ${JSON.stringify({ gradeLevel })})`,
  );

  assert.equal(allowed('Camera', 'Grade 11'), true);
  assert.equal(allowed('Recording Cameras', '12'), true);
  assert.equal(allowed('Camera', 'Grade 10'), false);
  assert.equal(allowed('Audio', 'Grade 9'), true);
});

test('reservation policies require approved ownership and keep camera-lens kits atomic', () => {
  const kitReservation = extractSqlFunction('create_camera_kit_reservation');
  const groupCancellation = extractSqlFunction('cancel_equipment_reservation_group');
  assert.match(policiesSql, /create or replace function public\.can_create_equipment_reservation/);
  assert.match(policiesSql, /lower\(member\.email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(policiesSql, /item\.category not in \('Camera', 'Recording Cameras', 'Lens'\)/);
  assert.match(kitReservation, /camera_item\.category not in \('Camera', 'Recording Cameras'\)/);
  assert.match(policiesSql, /create or replace function public\.is_faculty\(\)[\s\S]*?replace\(lower\(member\.role\), ' ', '-'\) = 'faculty'/);
  assert.match(kitReservation, /if not public\.is_faculty\(\)[\s\S]*?A compatible lens is required/);
  assert.match(appSource, /function canReserveCameraWithoutLens\(\)[\s\S]*?=== 'faculty'/);
  assert.match(appSource, /FACULTY EXCEPTION/);
  assert.doesNotMatch(appSource, /AUTH ADMIN EXCEPTION/);
  assert.match(kitReservation, /lens_item\.compatibility_group is distinct from camera_item\.compatibility_group/);
  assert.match(kitReservation, /reservation_group_id, equipment_id[\s\S]*?kit_group_id, camera_item\.id[\s\S]*?kit_group_id, lens_item\.id/);
  assert.match(groupCancellation, /public\.is_auth_admin\(\)[\s\S]*?public\.current_member_id\(\)/);
  assert.match(groupCancellation, /reservation\.reservation_group_id = target_reservation\.reservation_group_id/);
  assert.match(policiesSql, /revoke delete on table public\.equipment_reservations from anon, authenticated/);
  assert.doesNotMatch(policiesSql, /create policy "Users can cancel equipment reservations"/);
  assert.match(appSource, /supabaseClient\.rpc\('create_camera_kit_reservation'/);
  assert.match(appSource, /supabaseClient\.rpc\('cancel_equipment_reservation_group'/);
  assert.match(indexHtml, /id="reserve-lens-system" hidden[\s\S]*?id="reserve-lens-grid"/);
  assert.match(schemaSql, /compatibility_group in \('canon-r6', 'lumix-gh6', 'canon-aps-c'\)/);
  assert.match(schemaSql, /'Sigma 24–70mm f\/2\.8 DG DN Art', 'canon-r6'/);
  assert.match(schemaSql, /'Leica DG Vario-Elmarit 12–60mm f\/2\.8–4', 'lumix-gh6'/);
  assert.match(schemaSql, /'Canon EF-S 55–250mm f\/4–5\.6 IS STM', 'canon-aps-c'/);
  assert.match(schemaSql, /'Canon EF-S 55–250mm f\/4–5\.6 IS STM · Unit 2', 'canon-aps-c'/);
});

test('dashboard preferences are owner-scoped and bounded', () => {
  assert.match(schemaSql, /dashboard_preferences jsonb not null default/);
  assert.match(policiesSql, /create or replace function public\.update_own_dashboard_preferences\(p_preferences jsonb\)/);
  assert.match(policiesSql, /auth\.uid\(\) is null or public\.is_visitor_session\(\)/);
  assert.match(policiesSql, /cardinality\(clean_stats\) < 2 or cardinality\(clean_stats\) > 4/);
  assert.match(policiesSql, /cardinality\(clean_sections\) < 1 or cardinality\(clean_sections\) > 3/);
  assert.match(policiesSql, /where lower\(email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(policiesSql, /revoke all on function public\.update_own_dashboard_preferences\(jsonb\) from public/);
  assert.match(policiesSql, /grant execute on function public\.update_own_dashboard_preferences\(jsonb\) to authenticated/);
});

test('personal cameras are owner-scoped and snapshotted only for Photographer signups', () => {
  const updatePreferences = extractSqlFunction('update_own_personal_equipment_preferences');
  const cameraPermission = extractSqlFunction('can_use_personal_camera');
  assert.match(schemaSql, /personal_equipment_preferences jsonb not null default '\{"camera_name":"","auto_use_camera":false\}'::jsonb/);
  assert.match(schemaSql, /equipment_source text not null default 'club'/);
  assert.match(schemaSql, /signups_photographer_equipment_check[\s\S]*?equipment_source = 'own'[\s\S]*?signup_role = 'Photographer'[\s\S]*?char_length\(own_camera_name\) between 1 and 80/);
  assert.match(updatePreferences, /auth\.uid\(\) is null or public\.is_visitor_session\(\)/);
  assert.match(updatePreferences, /char_length\(clean_camera_name\) > 80/);
  assert.match(updatePreferences, /where lower\(email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(policiesSql, /revoke all on function public\.update_own_personal_equipment_preferences\(jsonb\) from public/);
  assert.match(policiesSql, /grant execute on function public\.update_own_personal_equipment_preferences\(jsonb\) to authenticated/);
  assert.match(cameraPermission, /p_member_id = public\.current_member_id\(\)[\s\S]*?or public\.is_admin_panel_user\(\)/);
  assert.match(cameraPermission, /member\.personal_equipment_preferences ->> 'camera_name'/);
  assert.match(policiesSql, /equipment_source = 'own'[\s\S]*?public\.can_use_personal_camera\(signups\.member_id, own_camera_name\)/);
  assert.match(indexHtml, /href="\/profile\?tab=personalisation" id="settings-tab-personalisation"/);
  assert.match(indexHtml, /id="settings-panel-personalisation"[\s\S]*?id="personal-camera-name"[\s\S]*?id="personal-camera-auto-use"/);
  assert.match(indexHtml, /id="signup-camera-source"[\s\S]*?id="signup-camera-source-select"/);
  assert.match(appSource, /function renderSignupCameraSource\(\)/);
  assert.match(appSource, /cameraName && preference\.autoUseCamera \? 'own' : 'club'/);
  assert.match(appSource, /equipment_source: equipmentSource/);
  assert.match(appSource, /own_camera_name: equipmentSource === 'own' \? personalCameraName : null/);
  assert.match(appSource, /Own camera · \$\{escapeHtml\(signup\.ownCameraName\)\}/);
  assert.match(appStyles, /\.personal-kit-console/);
  assert.match(appStyles, /\.signup-camera-source\[hidden\]/);
});

test('dashboard widget visibility follows public, member, operations, and admin access', () => {
  const available = ({ access, visitor = false, member = true, operations = false, admin = false }) => runFunctions(
    ['isVisitorSession', 'dashboardPreferenceAvailable'],
    {
      state: { currentUser: { isVisitor: visitor } },
      window: { CREW_CENTER_IS_VISITOR: visitor },
      currentMemberRecord: () => member ? ({ id: 'member-1' }) : null,
      canManageCrewOperations: () => operations,
      canAccessAdminPanel: () => admin,
    },
    `dashboardPreferenceAvailable(${JSON.stringify({ access })})`,
  );

  assert.equal(available({ access: 'public', visitor: true, member: false }), true);
  assert.equal(available({ access: 'member', visitor: true, member: false }), false);
  assert.equal(available({ access: 'member' }), true);
  assert.equal(available({ access: 'operations', operations: false }), false);
  assert.equal(available({ access: 'operations', operations: true }), true);
  assert.equal(available({ access: 'admin', admin: false }), false);
  assert.equal(available({ access: 'admin', admin: true }), true);
});

test('dashboard greeting uses the public.members name rather than an email alias', () => {
  const greeting = { textContent: '' };
  runFunctions(
    ['splitName', 'isVisitorSession', 'updateDashboardGreeting'],
    {
      state: { currentUser: { name: 'js12345', isVisitor: false } },
      window: { CREW_CENTER_IS_VISITOR: false },
      currentMemberRecord: () => ({ name: 'Jana Stein' }),
      document: { getElementById: id => id === 'dashboard-greeting' ? greeting : null },
    },
    'updateDashboardGreeting()',
  );
  assert.match(greeting.textContent, /^Good (morning|afternoon|evening), Jana$/);
  assert.doesNotMatch(greeting.textContent, /js12345/);
});

test('dashboard greeting is defined before cached auth can update user surfaces', () => {
  const greetingDefinition = uiSource.indexOf('function updateDashboardGreeting()');
  const userSurfaceDefinition = uiSource.indexOf('function updateUserSurfaces()');
  assert.ok(greetingDefinition >= 0);
  assert.ok(greetingDefinition < userSurfaceDefinition);
});

test('dashboard greeting does not expose an email alias while the member record loads', () => {
  const greeting = { textContent: '' };
  runFunctions(
    ['splitName', 'isVisitorSession', 'updateDashboardGreeting'],
    {
      state: { currentUser: { name: 'js12345', isVisitor: false } },
      window: { CREW_CENTER_IS_VISITOR: false },
      currentMemberRecord: () => null,
      document: { getElementById: id => id === 'dashboard-greeting' ? greeting : null },
    },
    'updateDashboardGreeting()',
  );
  assert.match(greeting.textContent, /^Good (morning|afternoon|evening)$/);
  assert.doesNotMatch(greeting.textContent, /js12345/);
});

test('auth refreshes never replace the approved sidebar name with an email alias', () => {
  assert.doesNotMatch(uiSource, /email\?\.split\('@'\)\[0\]/);
  assert.doesNotMatch(authSource, /email\?\.split\("@"\)\[0\]/);
  assert.match(uiSource, /state\.currentUser\.name = member\?\.name \|\| \(isVisitor \? 'Visitor' : 'Media Club member'\)/);
  assert.match(authSource, /const name = memberRecord\?\.name \|\| \(isVisitor \? "Visitor" : "Media Club member"\)/);
  assert.doesNotMatch(authSource, /document\.addEventListener\("click",[\s\S]*?applySignedInUser/);
});

test('signup removals use the shared in-app confirmation before deletion', () => {
  assert.match(appSource, /function requestRemoveSignup\(eventId, signupId, expired = false\)/);
  assert.match(appSource, /You are removing another member's signup as an Auth Admin/);
  assert.match(appSource, /confirmLabel: 'Remove signup'/);
  assert.match(appSource, /onclick="requestRemoveSignup\('\$\{ev\.id\}','\$\{s\.id\}'\)"/);
  assert.match(appSource, /onclick="requestRemoveSignup\('\$\{ev\.id\}','\$\{s\.id\}',true\)"/);
  assert.doesNotMatch(appSource, /onclick="removeSignup\('/);
  assert.doesNotMatch(appSource, /onclick="removeExpiredSignup\('/);
});

test('active student supervisor reserves preserve the supervisor label and show the current role', () => {
  assert.match(appSource, /const activeReserveRole = reserveAssignments\.get\(s\.id\)/);
  assert.match(appSource, /<strong>Current role:<\/strong> \$\{escapeHtml\(activeReserveRole\)\}/);
  assert.match(appSource, /<td>\$\{s\.role \? escapeHtml\(s\.role\)/);
  assert.doesNotMatch(appSource, /<td>\$\{displayRole \? escapeHtml\(displayRole\)/);
});

test('Student Supervisor reserve priorities exclude Photographer in the UI and database', () => {
  assert.match(appSource, /\['adult_supervisor', 'student_supervisor', 'photographer'\]\.includes\(key\)/);
  assert.match(appSource, /Student Supervisors cannot use Photographer as a reserve role\./);
  assert.match(indexHtml, /Photography is excluded because the supervisor must remain in the stream area\./);

  const reserveConstraintStart = schemaSql.indexOf('add constraint signups_student_supervisor_reserves_check');
  const reserveConstraint = schemaSql.slice(reserveConstraintStart, schemaSql.indexOf('do $$', reserveConstraintStart));
  assert.doesNotMatch(reserveConstraint, /Photographer/);
  assert.match(reserveConstraint, /\) not valid;/);
  assert.match(schemaSql, /where signup_role = 'Student Supervisor'[\s\S]*?reserve_role_1 = 'Photographer' or reserve_role_2 = 'Photographer'[\s\S]*?validate constraint signups_student_supervisor_reserves_check/);

  const signupPolicy = policiesSql.slice(
    policiesSql.indexOf('create policy "Signed-in users can add signups"'),
    policiesSql.indexOf('create policy "Users can delete own signups and Auth Admins any"'),
  );
  assert.match(signupPolicy, /reserve_role_1 in \('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 \(optional\)', 'Wireless'\)/);
  assert.match(signupPolicy, /reserve_role_2 in \('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 \(optional\)', 'Wireless'\)/);
});

test('Crew Schedule defaults to unfinished productions and keeps completed events in read-only past logs', () => {
  const dates = ['2026-08-18', '2026-08-21', '2026-09-02'];
  assert.equal(runFunctions(['defaultCrewDeploymentDate'], {}, `defaultCrewDeploymentDate(${JSON.stringify(dates)}, 'upcoming')`), '2026-08-18');
  assert.equal(runFunctions(['defaultCrewDeploymentDate'], {}, `defaultCrewDeploymentDate(${JSON.stringify(dates)}, 'past')`), '2026-09-02');
  assert.match(appSource, /view === 'past' \? isPastEvent\(event, now\) : !isPastEvent\(event, now\)/);
  assert.match(appSource, /crewDeploymentView = 'upcoming'/);
  assert.match(appSource, /function openCrewDeployment\(\) \{\s*crewDeploymentView = 'upcoming';\s*initCrewDeployment\(\);\s*\}/);
  assert.match(appSource, /if \(page === 'crew-deployment'\) openCrewDeployment\(\)/);
  assert.match(appSource, /if \(pastLog\) \{[\s\S]*?deployment-attendance-log/);
  assert.match(appSource, /Recorded by \$\{escapeHtml\(recorder\)\}/);
  assert.match(appSource, /Completed productions are read-only and the newest log opens first\./);
});

test('Crew Schedule explains whether each member covers the full game, joins, or leaves', () => {
  const block = { startMs: 100, endMs: 200 };
  const coverage = signup => JSON.parse(JSON.stringify(runFunctions(
    ['deploymentCoverageState'],
    {},
    `deploymentCoverageState(${JSON.stringify(signup)}, ${JSON.stringify(block)})`,
  )));
  assert.deepEqual(coverage({ attendanceStart: '', attendanceEnd: '' }), { kind: 'full' });
  assert.deepEqual(coverage({ attendanceStart: new Date(100).toISOString(), attendanceEnd: new Date(200).toISOString() }), { kind: 'full' });
  assert.deepEqual(coverage({ attendanceStart: new Date(125).toISOString(), attendanceEnd: new Date(200).toISOString() }), { kind: 'joins', time: 125 });
  assert.deepEqual(coverage({ attendanceStart: new Date(100).toISOString(), attendanceEnd: new Date(175).toISOString() }), { kind: 'leaves', time: 175 });
  assert.deepEqual(coverage({ attendanceStart: new Date(125).toISOString(), attendanceEnd: new Date(175).toISOString() }), { kind: 'partial', start: 125, end: 175 });
  assert.match(appSource, /Stays for full \$\{block\.key === 'event' \? 'event' : block\.label\}/);
});

test('Crew Schedule date controls are branded, navigable, and mobile-safe', () => {
  assert.match(indexHtml, /id="crew-deployment-upcoming"[\s\S]*?id="crew-deployment-past"/);
  assert.match(indexHtml, /id="crew-deployment-date-previous"[\s\S]*?id="crew-deployment-date"[\s\S]*?id="crew-deployment-date-next"/);
  assert.match(appStyles, /\.deployment-date-select-shell/);
  assert.match(appStyles, /\.form-input\[type="date"\]/);
  assert.match(appStyles, /@media \(max-width: 620px\)[\s\S]*?\.deployment-person \{ grid-template-columns: 1fr/);
});

test('phone-width tables and dashboard equipment bars retain responsive affordances', () => {
  assert.match(indexHtml, /class="sheet-table responsive-sheet-table" id="sheet-table"/);
  assert.match(indexHtml, /class="sheet-table responsive-sheet-table" id="equipment-register-table"/);
  assert.match(appStyles, /@keyframes dashboardEquipmentFill/);
  assert.match(appStyles, /prefers-reduced-motion: reduce/);
  assert.match(appSource, /aria-label="\$\{escapeHtml\(label\)\}: \$\{counts\[key\]\} of \$\{state\.equipment\.length\}"/);
});

test('default sidebar includes About Media Club while customized choices remain authoritative', () => {
  const functions = ['isVisitorSession', 'sidebarPageAvailable', 'availableSidebarPages', 'currentSidebarPreferences'];
  const sidebarCategories = {
    main: { pages: ['home', 'events', 'meetings', 'signup', 'members'] },
    content: { pages: ['gallery', 'equipment', 'role-guide'] },
    club: { pages: ['crew-deployment', 'equipment-status', 'join', 'about', 'admin'] },
  };
  const preferences = member => JSON.parse(JSON.stringify(runFunctions(
    functions,
    {
      sidebarCategories,
      currentMemberRecord: () => member,
      canAccessAdminPanel: () => false,
      canAccessCrewSchedule: () => false,
      canAccessEquipmentStatus: () => false,
      state: { currentUser: { isVisitor: false } },
      window: { CREW_CENTER_IS_VISITOR: false },
    },
    'currentSidebarPreferences()',
  )));

  const oldDefault = preferences({ sidebarCustomized: false, sidebarItems: ['home', 'gallery', 'join'] });
  assert.equal(oldDefault.customized, false);
  assert.equal(oldDefault.items.includes('about'), true, 'About should appear on the default sidebar');
  assert.equal(oldDefault.items.includes('meetings'), true, 'Meetings should appear on the default member sidebar');

  const manuallyHidden = preferences({ sidebarCustomized: true, sidebarItems: ['home', 'gallery', 'join'] });
  assert.equal(manuallyHidden.customized, true);
  assert.equal(manuallyHidden.items.includes('about'), false, 'a customized sidebar may deliberately hide About');

  const storedRestrictedPages = preferences({ sidebarCustomized: true, sidebarItems: ['home', 'crew-deployment', 'equipment-status', 'gallery', 'join'] });
  assert.equal(storedRestrictedPages.items.includes('crew-deployment'), false, 'stored Crew Schedule preferences must not reveal the restricted page');
  assert.equal(storedRestrictedPages.items.includes('equipment-status'), false, 'stored Equipment Status preferences must not reveal the restricted page');
});

test('visitor reads use narrow RPCs and direct operational table reads stay blocked', () => {
  const publicEvents = extractSqlFunction('get_public_events');
  const publicGallery = extractSqlFunction('get_public_gallery');
  const publicEquipment = extractSqlFunction('get_public_equipment');
  const publicAnnouncements = extractSqlFunction('get_public_announcements');

  assert.doesNotMatch(publicEvents, /archived_by|signups|member_id|livestream_setup_date|game_[1-4]_|shift_[12]_|takedown_|setup_start/);
  assert.doesNotMatch(publicGallery, /member_id|storage_path|members\.name/);
  assert.doesNotMatch(publicEquipment, /assigned_to|notes|equipment_reservations|member_id/);
  assert.doesNotMatch(publicAnnouncements, /member_id|email/);
  assert.match(policiesSql, /drop function if exists public\.get_public_member_directory\(\)/);
  assert.doesNotMatch(appSource, /get_public_member_directory/);
  for (const rpc of ['get_public_events', 'get_public_gallery', 'get_public_equipment', 'get_public_announcements']) {
    assert.match(appSource, new RegExp(`['"]${rpc}['"]`));
    assert.match(policiesSql, new RegExp(`grant execute on function public\\.${rpc}\\(\\) to authenticated`));
  }
  assert.match(policiesSql, /create policy "Signed-in users can read events"[\s\S]*?not public\.is_visitor_session\(\)/);
  assert.match(policiesSql, /create policy "Signed-in users can read equipment"[\s\S]*?not public\.is_visitor_session\(\)/);
  assert.match(policiesSql, /create policy "Signed-in users can read gallery"[\s\S]*?using \(not public\.is_visitor_session\(\)\)/);
  assert.match(policiesSql, /create policy "Signed-in users can read announcements"[\s\S]*?using \(not public\.is_visitor_session\(\)\)/);
});

test('realtime changes refresh only affected datasets and coalesce bursts', () => {
  const queue = extractFunction('queueRealtimeDataLoad');
  const subscribe = extractFunction('subscribeToCrewCenterChanges');
  const stop = extractFunction('stopCrewCenterLiveUpdates');
  assert.match(queue, /pendingRealtimeDatasets\.add/);
  assert.match(queue, /setTimeout\([\s\S]*?250\)/);
  assert.match(queue, /loadCrewCenterData\(\{ datasets: pending, silent: true \}\)/);
  assert.doesNotMatch(subscribe, /\n\s*members:\s*\[/);
  assert.match(subscribe, /member_team_memberships: \['members', 'meetings'\]/);
  assert.match(subscribe, /signups: \['events'\]/);
  assert.match(subscribe, /equipment_reservations: \['equipment'\]/);
  assert.match(subscribe, /if \(mode === 'visitor'\) return/);
  assert.doesNotMatch(subscribe, /loadCrewCenterData\)\s*\.on/);
  assert.match(stop, /removeChannel\(window\.CREW_CENTER_REALTIME_CHANNEL\)/);
  assert.match(stop, /queuedDatasets\.clear\(\)/);
  assert.match(stop, /pendingRealtimeDatasets\.clear\(\)/);
});

test('visitor dashboard avoids member metrics and loading failures remain retryable', () => {
  assert.match(appSource, /event_categories: \{ label: 'Event types'/);
  assert.match(appSource, /stats: \['upcoming_events', 'available_equipment', 'projects', 'event_categories'\]/);
  assert.match(appSource, /Explore upcoming events, published projects, and Media Club resources\./);
  assert.match(indexHtml, /id="data-status-banner" role="status" aria-live="polite"/);
  assert.match(appSource, /function retryDataset\(dataset\)/);
  assert.match(appSource, /function retryFailedDatasets\(\)/);
  assert.match(appSource, /state\.dataLoaded\[dataset\]/);
  assert.match(appSource, /Other information remains usable/);
});
