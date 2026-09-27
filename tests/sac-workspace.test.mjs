import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const router = read('scripts/router.js');
const workspaces = read('scripts/workspaces.js');
const members = read('scripts/members.js');
const signups = read('scripts/sac-signups.js');
const policies = read('supabase-auth-policies.sql');
const core = read('scripts/core.js');
const schema = read('supabase-schema.sql');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const asyncStart = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(asyncStart, index + 1);
  }
  throw new Error(`${name} has no closing brace`);
}

test('SAC Members and My Shifts have workspace-only deep links', () => {
  for (const [page, route] of [['sac-members', '/sac/members'], ['sac-my-shifts', '/sac/my-shifts']]) {
    assert.ok(new RegExp(`href="${route}"[^>]*data-page="${page}"`).test(html), `${page} has sidebar link`);
    assert.ok(new RegExp(`id="page-${page}"`).test(html), `${page} has a page`);
    assert.ok(router.includes(`'${page}': '${route}'`));
    assert.ok(router.includes(`'${route}': '${page}'`));
    assert.ok(workspaces.includes(`'${page}'`));
  }
});

test('SAC directory shows current tagged members only', () => {
  const context = {
    normalizeSacTitle: title => title || '',
    state: { members: [
      { id: 'sac', teamKeys: ['sac'], name: 'SAC Member' },
      { id: 'dual', teamKeys: ['media_club', 'sac'], name: 'Dual Member' },
      { id: 'media', teamKeys: ['media_club'], name: 'Media Member' },
      { id: 'eligible', teamKeys: [], gradeLevel: 'Grade 11', name: 'Eligible Member' },
    ] },
  };
  const result = vm.runInNewContext(`${functionSource(members, 'sacDirectoryMembers')}\nsacDirectoryMembers().map(member => member.id)`, context);
  assert.deepEqual(Array.from(result), ['dual', 'sac']);
  assert.match(policies, /create or replace function public\.get_member_directory\(\)[\s\S]*?public\.is_approved_member\(\)/);
});

test('SAC dashboard count follows approved SAC tags rather than grade eligibility', () => {
  assert.ok(html.includes('id="sac-home-member-count"'));
  const count = { textContent: '' };
  const context = {
    state: { dataLoaded: { members: true }, members: [
      { teamKeys: ['sac'] }, { teamKeys: ['media_club', 'sac'] }, { teamKeys: ['media_club'], gradeLevel: 'Grade 11' },
    ] },
    document: { getElementById: id => id === 'sac-home-member-count' ? count : null },
    currentCrewCenterWorkspace: () => 'sac',
    canAccessSacWorkspace: () => true,
  };
  vm.runInNewContext(`${functionSource(members, 'renderSacDashboard')}\nrenderSacDashboard()`, context);
  assert.equal(count.textContent, '2');
  assert.match(core, /if \(activePage === 'sac-home'\) \{ renderSacDashboard\(\);/);
  assert.match(router, /if \(page === 'sac-home'\) \{ renderSacDashboard\(\);/);
});

test('SAC meetings and attendance have distinct workspace routes and database boundaries', () => {
  for (const [page, route] of [['sac-meetings', '/sac/meetings'], ['sac-attendance', '/sac/attendance']]) {
    assert.match(html, new RegExp(`href="${route}"[^>]*data-page="${page}"`));
    assert.ok(html.includes(`id="page-${page}"`));
    assert.ok(router.includes(`'${page}': '${route}'`));
    assert.ok(router.includes(`'${route}': '${page}'`));
    assert.ok(workspaces.includes(`'${page}'`));
  }
  assert.match(schema, /create table if not exists public\.sac_meetings/);
  assert.match(schema, /create table if not exists public\.sac_attendance/);
  assert.match(schema, /sac_attendance_one_target_check check \(\(event_id is null\) <> \(meeting_id is null\)\)/);
  assert.match(schema, /sac_attendance_event_member_key unique \(event_id, member_id\)/);
  assert.match(schema, /sac_attendance_meeting_member_key unique \(meeting_id, member_id\)/);
  assert.match(policies, /on public\.sac_meetings for select[\s\S]*?public\.can_view_sac_events\(\)/);
  assert.match(policies, /on public\.sac_meetings for insert[\s\S]*?public\.can_create_sac_events\(\)[\s\S]*?created_by_auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(policies, /on public\.sac_meetings for update[\s\S]*?public\.can_create_sac_events\(\)/);
  assert.match(policies, /on public\.sac_attendance for select[\s\S]*?public\.can_create_sac_events\(\)/);
  assert.match(policies, /revoke all on table public\.sac_attendance from anon, authenticated;\s*grant select on table public\.sac_attendance to authenticated/);
});

test('SAC attendance RPC enforces each whole-event roll and four marks', () => {
  const rpc = policies.match(/create or replace function public\.mark_sac_attendance\([\s\S]*?\n\$\$;/)?.[0];
  assert.ok(rpc);
  assert.match(rpc, /if not public\.can_create_sac_events\(\)/);
  assert.match(rpc, /'present', 'late', 'absent', 'excused'/);
  assert.match(rpc, /public\.sac_slot_signups[\s\S]*?cancelled_at is null/);
  assert.match(rpc, /public\.member_team_memberships[\s\S]*?team_key = 'sac'/);
  const roll = policies.match(/create or replace function public\.get_sac_attendance_roll\([\s\S]*?\n\$\$;/)?.[0];
  assert.ok(roll);
  assert.match(roll, /if not public\.can_create_sac_events\(\)/);
  assert.match(roll, /public\.sac_slot_signups[\s\S]*?signup\.cancelled_at is null/);
  assert.match(roll, /public\.member_team_memberships[\s\S]*?membership\.team_key = 'sac'/);
});

test('nonmanagers cannot open the SAC attendance route', () => {
  const source = functionSource(workspaces, 'workspacePageFor');
  const denied = vm.runInNewContext(`${source}\nworkspacePageFor('sac-attendance', 'sac')`, {
    canCreateSacEvents: () => false,
  });
  const permitted = vm.runInNewContext(`${source}\nworkspacePageFor('sac-attendance', 'sac')`, {
    canCreateSacEvents: () => true,
  });
  assert.equal(denied, 'sac-home');
  assert.equal(permitted, 'sac-attendance');
});

test('My Shifts includes only this member’s active upcoming bookings', () => {
  const source = functionSource(signups, 'sacUpcomingOwnShifts');
  const rows = [
    { member_id: 'me', slot_start: '2026-10-01T10:30:00Z', slot_end: '2026-10-01T11:00:00Z', cancelled_at: null },
    { member_id: 'me', slot_start: '2026-10-01T10:00:00Z', slot_end: '2026-10-01T10:30:00Z', cancelled_at: null },
    { member_id: 'other', slot_start: '2026-10-01T09:00:00Z', slot_end: '2026-10-01T09:30:00Z', cancelled_at: null },
    { member_id: 'me', slot_start: '2026-09-01T10:00:00Z', slot_end: '2026-09-01T10:30:00Z', cancelled_at: null },
    { member_id: 'me', slot_start: '2026-10-01T09:00:00Z', slot_end: '2026-10-01T09:30:00Z', cancelled_at: '2026-09-27T10:00:00Z' },
  ];
  const result = vm.runInNewContext(`${source}\nsacUpcomingOwnShifts(rows, 'me', Date.parse('2026-09-27T10:00:00Z')).map(row => row.slot_start)`, { Date, rows });
  assert.deepEqual(Array.from(result), ['2026-10-01T10:00:00Z', '2026-10-01T10:30:00Z']);
});

test('a stored booking matches its generated slot across timestamp formats', () => {
  const source = functionSource(signups, 'sacBookingMatchesSlot');
  const booking = { slot_start: '2030-10-01T10:00:00+00:00', slot_end: '2030-10-01T10:30:00+00:00' };
  const slot = { start: '2030-10-01T10:00:00.000Z', end: '2030-10-01T10:30:00.000Z' };
  const same = vm.runInNewContext(`${source}\nsacBookingMatchesSlot(booking, slot)`, { Date, booking, slot });
  assert.equal(same, true);
  assert.ok(signups.includes('bookings.filter(booking => sacBookingMatchesSlot(booking, slot))'));
  assert.ok(signups.includes('bookings.filter(booking => !slots.some(slot => sacBookingMatchesSlot(booking, slot)))'));
});

test('claim confirmation waits until the saved booking is visible on the sheet', async () => {
  let finishRefresh;
  const messages = [];
  const context = {
    canClaimSacSlot: () => true,
    sacSignupsState: { selectedEventId: 'event' },
    selectedSacSignupMemberId: () => 'me',
    canAddMembers: () => false,
    supabaseClient: { rpc: async () => ({ data: 'booking-id', error: null }) },
    renderSacSignups: () => new Promise(resolve => { finishRefresh = resolve; }),
    showToast: message => messages.push(message),
    button: { disabled: false },
  };
  const pending = vm.runInNewContext(`${functionSource(signups, 'claimSacSignupSlot')}\nclaimSacSignupSlot('2026-10-01T10:00:00Z', button)`, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(messages, [], 'do not announce success before the booking is rendered');
  finishRefresh(true);
  await pending;
  assert.match(messages[0], /saved|booked/i);
});

test('SAC booking updates refresh active SAC pages through the protected publication', () => {
  assert.ok(policies.includes('alter publication supabase_realtime add table public.sac_slot_signups'));
  assert.ok(policies.includes('using ((select public.can_read_sac_slot_signups()))'));
  assert.ok(core.includes("table: 'sac_slot_signups'"));
  assert.ok(core.includes("if (currentCrewCenterWorkspace() !== 'sac' || !canClaimSacSlot()) return"));
});
