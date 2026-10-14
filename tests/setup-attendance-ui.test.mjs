import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const core = read('scripts/core.js');
const cas = read('scripts/cas-attendance.js');
const script = read('scripts/setup-attendance.js');
const extract = (text, name) => text.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`))[0];
const now = Date.parse('2030-10-20T13:30:00Z');
class Clock extends Date { static now() { return now; } }
const event = { id: 'game', title: 'Synthetic game', date: '2030-10-21', cat: 'Livestream', livestreamSetupDate: '2030-10-20', livestreamSetupStart: '15:15', livestreamSetupEnd: '16:15', signups: [] };
const row = (member, status = 'present') => ({ event_id: 'game', member_id: member, attendance_status: status, setup_starts_at: '2030-10-20T13:15:00Z', setup_ends_at: '2030-10-20T14:15:00Z' });
function harness() {
  const elements = new Map(); const writes = []; let allowed = true; let response = args => ({ data: args.p_member_ids.map(id => row(id, args.p_status)), error: null });
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, dataset: {}, classList: { contains: () => true, toggle() {} }, addEventListener() {}, querySelectorAll: () => [], setAttribute() {}, removeAttribute() {} });
    return elements.get(id);
  };
  const members = ['a','b'].map((id, index) => ({ id, name: 'Alex P.', role: 'Member', gradeLevel: `Grade ${11+index}`, email: `${id}x1234@fis.edu`, teamKeys: ['media_club'], spec: 'CAS' }));
  const context = vm.createContext({ window: { CREW_CENTER_AUTH_USER: { id: 'admin' }, CREW_CENTER_AUTH_EPOCH: 1 }, Date: Clock,
    state: { events: [structuredClone(event)], archivedEvents: [], members, setupAttendance: [], dataErrors: {} },
    document: { body: { insertAdjacentHTML() {} }, getElementById: element, addEventListener() {} },
    canAccessCrewSchedule: () => allowed, isVisitorSession: () => false, canAccessAdminPanel: () => allowed,
    normalizedSignupName: value => String(value || '').toLowerCase(), personDisplayName: name => name, splitName: name => ({ fname: name.split(' ')[0], lname: name.split(' ')[1] || '' }),
    escapeHtml: value => String(value || '').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    berlinTimestamp: (date, time) => Date.parse(`${date}T${time}:00+02:00`), dateBefore: () => '2030-10-20',
    formatBerlinDateTime: value => new Date(value).toISOString(), formatEventDate: value => value, berlinTimeLabel: () => '16:15',
    attendanceStatusLabel: value => value, openModal() {}, closeModal() {}, loadCrewCenterData: async () => {}, renderCasAttendanceTracker() {},
    withCrewCenterDataTimeout: operation => operation,
    supabaseClient: { rpc: async (name, args) => { writes.push({ name, args }); return response(args); } },
  });
  vm.runInContext(extract(core,'memberPickerRowHtml') + '\n' + script, context);
  vm.runInContext("setupRoster.eventId='game'; setupRoster.actor=setupAttendanceActor();", context);
  return { context, element, writes, allow: value => { allowed = value; }, response: fn => { response = fn; } };
}

test('setup-only and game-only participation earn one linked game date; both never earn two', () => {
  const h = harness();
  vm.runInContext(['casAttendanceMarks','casAttendanceWasRecorded','casAttendanceEventEligibleForMember','casAttendanceStats'].map(name => extract(cas,name)).join('\n'), h.context);
  h.context.isPastEvent = () => false;
  const stats = () => h.context.casAttendanceStats({ id: 'a' }, h.context.state.events, { start: '2030-10-01', end: '2030-10-31' });
  h.context.state.setupAttendance = [row('a')];
  assert.equal(stats().attendedDays, 1); assert.equal(stats().eventDays, 1);
  h.context.state.events[0].signups = [{ memberId: 'a', attendanceStatus: 'present' }];
  assert.equal(stats().attendedDays, 1);
  h.context.state.setupAttendance = [row('a','absent')]; assert.equal(stats().attendedDays, 1);
  h.context.state.events[0].signups = []; assert.equal(stats().attendedDays, 0);
  h.context.state.setupAttendance = [row('a','not_taken')]; assert.equal(stats().eventDays, 0);
  h.context.state.setupAttendance = [row('b')]; assert.equal(stats().attendedDays, 0); assert.equal(stats().eventDays, 0);
});

test('manual bulk logging identifies duplicate-name helpers by UUID and preserves game bookings', async () => {
  const h = harness(); await h.context.saveSetupAttendance(['a','b'], 'present');
  assert.equal(h.writes.length, 1); assert.deepEqual(Array.from(h.writes[0].args.p_member_ids), ['a','b']);
  assert.equal(h.context.state.setupAttendance.length, 2); assert.equal(h.context.state.events[0].signups.length, 0);
  assert.match(h.element('setup-roster-list').innerHTML, /Grade 11/);
  assert.match(h.element('setup-roster-list').innerHTML, /Grade 12/);
});

test('rejected setup saves retain selected helpers and recover controls for retry', async () => {
  const h = harness(); vm.runInContext("setupRoster.selected.add('a')",h.context);
  h.response(() => { throw new Error('Offline'); });
  await assert.doesNotReject(h.context.saveSetupAttendance(['a'],'present'));
  assert.match(h.element('setup-roster-status').textContent,/selection is kept/);
  assert.equal(h.element('setup-roster-save').disabled,false); assert.equal(h.context.state.setupAttendance.length,0);
});

test('duplicate clicks, account changes and replaced modal sessions cannot apply stale setup results', async () => {
  const h = harness(); let finish; h.response(() => new Promise(resolve => { finish=resolve; }));
  const pending=h.context.saveSetupAttendance(['a'],'present'); await h.context.saveSetupAttendance(['a'],'present'); assert.equal(h.writes.length,1);
  h.context.window.CREW_CENTER_AUTH_EPOCH++; h.context.window.resetSetupAttendance();
  finish({data:[row('a')]}); await pending; assert.equal(h.context.state.setupAttendance.length,0); assert.equal(h.element('setup-roster-list').innerHTML,'');
});

test('ordinary members, visitors, future sessions and incomplete roster loads cannot send attendance writes', async () => {
  for(const change of [h=>h.allow(false),h=>{h.context.isVisitorSession=()=>true;},h=>{h.context.state.events[0].livestreamSetupStart='23:00';h.context.state.events[0].livestreamSetupEnd='23:30';},h=>{h.context.state.dataErrors.setupAttendance='Offline';}]) {
    const h=harness();change(h);await h.context.saveSetupAttendance(['a'],'present');assert.equal(h.writes.length,0);
  }
});

test('modern member rows escape labels and distinguish duplicate names without leaking private emails', () => {
  const h=harness();
  const html=h.context.memberPickerRowHtml({id:'a',name:'<Alex> P.',role:'Member',gradeLevel:'Grade 11',email:''});
  assert.match(html,/member-picker-avatar/);assert.match(html,/&lt;Alex>/);assert.doesNotMatch(html,/<Alex>/);assert.doesNotMatch(html,/@fis/);
  const other=h.context.memberPickerRowHtml(h.context.state.members[1]);assert.match(other,/Grade 12/);assert.match(other,/data-media-signup-member="b"/);
});
