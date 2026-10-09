import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const path = new URL('../scripts/my-crew-schedule.js', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
const sac = readFileSync(new URL('../scripts/sac-signups.js', import.meta.url), 'utf8');
const equipment = readFileSync(new URL('../scripts/equipment.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const accessStart = core.indexOf('function canAccessMyCrewSchedule(');
const access = core.slice(accessStart, core.indexOf('\nfunction ', accessStart + 1));
const now = Date.parse('2030-10-01T08:00:00Z');
const signup = { id: 's1', memberId: 'me', role: 'Photographer', attendanceStart: '2030-10-01T12:00:00+02:00', attendanceEnd: '2030-10-01T13:00:00+02:00', confirmationStatus: 'maybe', confirmationDeadline: '2030-10-01T09:00:00Z', equipmentSource: 'own', ownCameraName: 'My camera' };
const event = { id: 'e1', title: 'Basketball <final>', loc: 'Sports hall', date: '2030-10-01', signups: [signup] };
const reservation = { id: 'r1', memberId: 'me', startsAt: '2030-10-01T08:30:00Z', endsAt: '2030-10-01T12:00:00Z', status: 'scheduled' };

function harness() {
  let clock = now;
  const timers = [];
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', hidden: false, disabled: false, dataset: {}, setAttribute() {}, addEventListener() {} });
    return nodes.get(id);
  };
  const downloads = [];
  const context = vm.createContext({
    Date: class extends Date { static now() { return clock; } }, TextEncoder, Blob,
    URL: class extends URL { static createObjectURL(blob) { downloads.push(blob); return 'blob:test'; } static revokeObjectURL() {} },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {}, window: { location: { origin: 'https://fismediaclub.org' }, CREW_CENTER_AUTH_USER: { id: 'account-a', email: 'me@example.test' } },
    document: { getElementById: node, querySelector: () => ({ id: 'page-my-crew-schedule' }), querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ click() {}, remove() {} }), body: { append() {} } },
    state: { events: [{ ...event, signups: [{ ...signup }] }], equipment: [{ id: 'camera', name: 'Camera kit', reservations: [{ ...reservation }] }], dataLoaded: { events: true, equipment: true }, dataErrors: {} },
    currentMemberRecord: () => ({ id: 'me', email: 'me@example.test' }), isVisitorSession: () => false, canAccessMediaWorkspace: () => true,
    currentCrewCenterWorkspace: () => 'media', pageUrl: (page, params = {}) => `/${page === 'signup' ? 'signups' : page}${params.event ? '?event=' + params.event : ''}`,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    formatBerlinDateTime: value => String(value), berlinDateKey: value => String(value).slice(0, 10),
    showToast() {}, loadCrewCenterData: async () => {},
  });
  vm.runInContext(sac, context);
  vm.runInContext(equipment.slice(0, equipment.indexOf('function activeEquipmentReservation')), context);
  vm.runInContext(access, context);
  vm.runInContext(source, context);
  return { context, node, downloads, timers, setClock(value) { clock = value; } };
}

test('personal schedule combines every own active assignment and loan in instant order', () => {
  const h = harness();
  for (let i = 2; i <= 7; i++) h.context.state.events.push({ ...event, id: 'e' + i, signups: [{ ...signup, id: 's' + i }] });
  h.context.state.events[0].signups.push({ ...signup, id: 'other', memberId: 'someone-else' }, { ...signup, id: 'expired', confirmationStatus: 'expired' }, { ...signup, id: 'ended', attendanceEnd: '2030-10-01T07:00:00Z' });
  h.context.state.equipment[0].reservations.push({ ...reservation, id: 'returned', returnedAt: '2030-10-01T07:00:00Z' }, { ...reservation, id: 'other', memberId: 'someone-else' });
  const items = h.context.ownCrewScheduleItems(now);
  assert.equal(items.length, 8);
  assert.equal(items[0].kind, 'equipment');
  assert.equal(items.filter(item => item.kind === 'assignment').length, 7);
  assert.ok(!JSON.stringify(items).includes('someone-else'));
});

test('calendar reflects saved Berlin instants, Maybe status, stable IDs and private metadata', () => {
  const h = harness();
  const item = h.context.ownCrewScheduleItems(now).find(item => item.kind === 'assignment');
  const raw = h.context.buildCrewScheduleCalendar([item], 'https://fismediaclub.org', now);
  const flat = raw.replace(/\r\n[ \t]/g, '');
  assert.match(flat, /DTSTART:20301001T100000Z\r\nDTEND:20301001T110000Z/);
  assert.match(flat, /STATUS:TENTATIVE/);
  assert.match(flat, /CLASS:PRIVATE/);
  assert.match(flat, /confirm by/i);
  assert.match(flat, /My camera/);
  assert.doesNotMatch(flat, /ATTENDEE:|ORGANIZER:|mailto:|memberId/);
  assert.match(flat, /URL:https:\/\/fismediaclub.org\/signups\?event=e1/);
  item.signup.attendanceStart = '2030-10-28T12:00:00+01:00';
  item.start = Date.parse(item.signup.attendanceStart); item.end = Date.parse('2030-10-28T13:00:00+01:00');
  const winter = h.context.buildCrewScheduleCalendar([item], 'https://fismediaclub.org', now).replace(/\r\n[ \t]/g, '');
  assert.match(winter, /DTSTART:20301028T110000Z/);
  assert.equal(flat.match(/UID:.*/)[0], winter.match(/UID:.*/)[0]);
});

test('calendar rejects ended or deadline-passed entries and safely folds Unicode text', () => {
  const h = harness(); const item = h.context.ownCrewScheduleItems(now)[0];
  item.title = '東京 🏀 '.repeat(30) + ', A; B\\C\nATTENDEE:mailto:bad@example.test';
  const raw = h.context.buildCrewScheduleCalendar([item], 'https://fismediaclub.org', now);
  for (const line of raw.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.doesNotMatch(raw, /\r\nATTENDEE:/);
  assert.equal(h.context.buildCrewScheduleCalendar([{ ...item, end: now }], 'https://fismediaclub.org', now), '');
  const assignment = h.context.ownCrewScheduleItems(now).find(entry => entry.kind === 'assignment');
  assignment.signup.confirmationDeadline = '2030-10-01T07:00:00Z';
  assert.equal(h.context.buildCrewScheduleCalendar([assignment], 'https://fismediaclub.org', now), '');
});

test('downloads recheck ownership and access after the page was rendered', () => {
  const h = harness(); h.context.downloadCrewScheduleCalendar('assignment:s1');
  assert.equal(h.downloads.length, 1);
  h.context.currentMemberRecord = () => ({ id: 'someone-else' });
  h.context.downloadCrewScheduleCalendar('assignment:s1');
  h.context.isVisitorSession = () => true; h.context.downloadCrewScheduleCalendar();
  h.context.isVisitorSession = () => false; h.context.currentCrewCenterWorkspace = () => 'sac'; h.context.downloadCrewScheduleCalendar();
  assert.equal(h.downloads.length, 1);
});

test('a changed or signed-out account cannot use a stale linked member record', () => {
  const h = harness();
  h.context.window.CREW_CENTER_AUTH_USER = { id: 'account-b', email: 'other@example.test' };
  assert.equal(h.context.ownCrewScheduleItems(now).length, 0);
  h.context.renderMyCrewSchedule();
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Basketball/);
  h.context.window.CREW_CENTER_AUTH_USER = null;
  h.context.downloadCrewScheduleCalendar();
  assert.equal(h.downloads.length, 0);
});

test('the schedule access check is available before the page scripts and denies unresolved workspace access', () => {
  const h = harness();
  h.context.canAccessMediaWorkspace = undefined;
  assert.equal(h.context.canAccessMyCrewSchedule(), false);
});

test('rendering distinguishes unloaded and failed data from an empty schedule and escapes titles', () => {
  const h = harness(); h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Basketball &lt;final&gt;/);
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Confirm on sheet/);
  h.context.state.dataErrors.events = "Couldn't load the events.";
  h.context.state.dataLoaded.events = false; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Retry/);
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Basketball/);
  h.context.state.dataErrors = {}; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Loading/);
  h.context.state.dataLoaded.events = true; h.context.state.events = []; h.context.state.equipment = []; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /No upcoming/);
  h.context.isVisitorSession = () => true; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /member account/);
});

test('an open schedule refreshes at personal booking and confirmation boundaries', () => {
  const h = harness(); h.context.renderMyCrewSchedule();
  assert.equal(h.timers.at(-1).delay, 30 * 60 * 1000 + 100);
  h.setClock(now + 60 * 60 * 1000 + 100); h.timers.at(-1).callback();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Deadline passed/);
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Confirm on sheet/);
  h.setClock(Date.parse(signup.attendanceEnd) + 100); h.timers.at(-1).callback();
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Basketball/);
});
