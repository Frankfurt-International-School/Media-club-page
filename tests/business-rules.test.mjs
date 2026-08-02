import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const appSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const policiesSql = readFileSync(new URL('../supabase-auth-policies.sql', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Expected ${name} in index.html`);
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === '{') depth += 1;
    if (appSource[index] === '}') depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Could not find the end of ${name}`);
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
    '({ admin: canAccessAdminPanel(), addMembers: canAddMembers(), equipment: canManageCrewOperations(), equipmentStatus: canAccessEquipmentStatus(), schedule: canAccessCrewSchedule() })',
  )));

  assert.deepEqual(capabilities({ authAdmin: true }), { admin: true, addMembers: true, equipment: true, equipmentStatus: true, schedule: true });
  assert.deepEqual(capabilities({ role: 'Faculty' }), { admin: true, addMembers: false, equipment: true, equipmentStatus: true, schedule: true });
  assert.deepEqual(capabilities({ role: 'Leader' }), { admin: false, addMembers: false, equipment: true, equipmentStatus: true, schedule: true });
  assert.deepEqual(capabilities({ role: 'Co Leader' }), { admin: false, addMembers: false, equipment: true, equipmentStatus: true, schedule: true });
  assert.deepEqual(capabilities({ role: 'Moderator' }), { admin: false, addMembers: false, equipment: true, equipmentStatus: true, schedule: false });
  assert.deepEqual(capabilities({ role: 'Moderator', equipmentStatusAccess: false }), { admin: false, addMembers: false, equipment: true, equipmentStatus: false, schedule: false });
  assert.deepEqual(capabilities({ role: 'Member' }), { admin: false, addMembers: false, equipment: false, equipmentStatus: false, schedule: false });
});

test('Equipment Status restrictions are enforced in the UI and server workflows', () => {
  assert.match(schemaSql, /equipment_status_access boolean not null default true/);
  assert.match(policiesSql, /create or replace function public\.can_access_equipment_status\(\)/);
  assert.match(policiesSql, /member\.equipment_status_access/);
  assert.match(policiesSql, /create or replace function public\.set_equipment_operational_status/);
  assert.match(policiesSql, /create or replace function public\.mark_equipment_reservation_returned[\s\S]*?if not public\.can_access_equipment_status\(\)/);
  assert.match(appSource, /if \(page === 'equipment-status' && !canAccessEquipmentStatus\(\)\)/);
  assert.match(appSource, /supabaseClient\.rpc\('set_equipment_operational_status'/);
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
    ['memberGradeNumber', 'canReserveOutsideEvent'],
    {},
    `canReserveOutsideEvent(${JSON.stringify({ category })}, ${JSON.stringify({ gradeLevel })})`,
  );

  assert.equal(allowed('Camera', 'Grade 11'), true);
  assert.equal(allowed('Recording Cameras', '12'), true);
  assert.equal(allowed('Camera', 'Grade 10'), false);
  assert.equal(allowed('Audio', 'Grade 9'), true);
});

test('reservation policies require approved ownership and limit cancellation', () => {
  assert.match(policiesSql, /create or replace function public\.can_create_equipment_reservation/);
  assert.match(policiesSql, /lower\(member\.email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(policiesSql, /create policy "Users can cancel equipment reservations"[\s\S]*?reservation_status = 'scheduled'[\s\S]*?starts_at > now\(\)[\s\S]*?public\.is_auth_admin\(\)/);
  assert.match(policiesSql, /public\.is_auth_admin\(\)[\s\S]*?member\.id = equipment_reservations\.member_id/);
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

test('dashboard widget visibility follows public, member, operations, and admin access', () => {
  const available = ({ access, visitor = false, member = true, operations = false, admin = false }) => runFunctions(
    ['dashboardPreferenceAvailable'],
    {
      state: { currentUser: { isVisitor: visitor } },
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
    ['splitName', 'updateDashboardGreeting'],
    {
      state: { currentUser: { name: 'js12345', isVisitor: false } },
      currentMemberRecord: () => ({ name: 'Jana Stein' }),
      document: { getElementById: id => id === 'dashboard-greeting' ? greeting : null },
    },
    'updateDashboardGreeting()',
  );
  assert.match(greeting.textContent, /^Good (morning|afternoon|evening), Jana$/);
  assert.doesNotMatch(greeting.textContent, /js12345/);
});

test('dashboard greeting does not expose an email alias while the member record loads', () => {
  const greeting = { textContent: '' };
  runFunctions(
    ['splitName', 'updateDashboardGreeting'],
    {
      state: { currentUser: { name: 'js12345', isVisitor: false } },
      currentMemberRecord: () => null,
      document: { getElementById: id => id === 'dashboard-greeting' ? greeting : null },
    },
    'updateDashboardGreeting()',
  );
  assert.match(greeting.textContent, /^Good (morning|afternoon|evening)$/);
  assert.doesNotMatch(greeting.textContent, /js12345/);
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

test('phone-width tables and dashboard equipment bars retain responsive affordances', () => {
  assert.match(appSource, /class="sheet-table responsive-sheet-table" id="sheet-table"/);
  assert.match(appSource, /class="sheet-table responsive-sheet-table" id="equipment-register-table"/);
  assert.match(appSource, /@keyframes dashboardEquipmentFill/);
  assert.match(appSource, /prefers-reduced-motion: reduce/);
  assert.match(appSource, /aria-label="\$\{escapeHtml\(label\)\}: \$\{counts\[key\]\} of \$\{state\.equipment\.length\}"/);
});
