import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/sac-signups.js', import.meta.url), 'utf8');
const now = Date.parse('2030-10-01T08:00:00Z');
const shift = { id: 'booking-1', event_id: 'game-1', member_id: 'me', slot_start: '2030-10-01T12:00:00+02:00', slot_end: '2030-10-01T12:30:00+02:00', spot_number: 2 };
const event = { id: 'game-1', title: 'Warriors basketball', location: 'Sports hall' };
const signupUrl = 'https://sac.fismediaclub.org/sac/signups?event=game-1';

function context(overrides = {}) {
  const ctx = vm.createContext({
    Date, TextEncoder, URL, Blob, setTimeout: () => {},
    document: { getElementById: () => null }, window: {}, ...overrides,
  });
  vm.runInContext(source, ctx);
  return ctx;
}

function calendar(booking = shift, activity = event) {
  const ctx = context({ booking, activity, signupUrl, now });
  return vm.runInContext('buildSacShiftCalendar(booking, activity, signupUrl, now)', ctx);
}
const unfold = value => value.replace(/\r\n[ \t]/g, '');

test('SAC calendar uses the saved shift interval with correct summer and winter offsets', () => {
  const summer = unfold(calendar());
  assert.match(summer, /DTSTART:20301001T100000Z\r\nDTEND:20301001T103000Z/);
  assert.match(summer, /SUMMARY:SAC Scoreboard shift.*Warriors basketball/);
  assert.match(summer, /spot 2/);
  assert.match(summer, /URL:https:\/\/sac\.fismediaclub\.org\/sac\/signups\?event=game-1/);
  const winter = unfold(calendar({ ...shift, slot_start: '2030-10-28T12:00:00+01:00', slot_end: '2030-10-28T12:30:00+01:00' }));
  assert.match(winter, /DTSTART:20301028T110000Z\r\nDTEND:20301028T113000Z/);
  assert.equal(summer.match(/UID:.*/)[0], winter.match(/UID:.*/)[0]);
  assert.match(summer, /CLASS:PRIVATE/);
  assert.doesNotMatch(summer, /ATTENDEE:|ORGANIZER:|mailto:|member_id/);
});

test('calendar text cannot inject properties and Unicode lines stay within 75 UTF-8 bytes', () => {
  const title = 'Basketball 🏀 東京 '.repeat(12) + ', A; B\\C\r\nATTENDEE:mailto:unwanted@example.com';
  const raw = calendar(shift, { ...event, title, location: 'Hall, east; entrance\\stairs\nFloor 2' });
  const flat = unfold(raw);
  assert.equal(flat.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  assert.ok(flat.includes('\\, A\\; B\\\\C\\nATTENDEE:mailto:unwanted@example.com'));
  assert.ok(flat.includes('LOCATION:Hall\\, east\\; entrance\\\\stairs\\nFloor 2'));
  assert.doesNotMatch(flat, /\r\nATTENDEE:/);
  assert.doesNotMatch(raw, /�/);
  for (const line of raw.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.match(flat, /changes.*calendar/i);
  assert.ok(raw.endsWith('END:VCALENDAR\r\n'));
});

test('invalid cancelled ended and mismatched bookings produce no calendar', () => {
  for (const booking of [
    { ...shift, slot_start: 'invalid' },
    { ...shift, slot_end: shift.slot_start },
    { ...shift, cancelled_at: '2030-09-30T12:00:00Z' },
    { ...shift, slot_start: '2030-09-30T10:00:00Z', slot_end: '2030-09-30T10:30:00Z' },
    { ...shift, id: '' },
    { ...shift, event_id: 'other-event' },
  ]) assert.equal(calendar(booking), '');
});

test('calendar download is limited to this member and current SAC access', () => {
  const downloads = [];
  const anchor = { click() { downloads.push(this.download); }, remove() {} };
  const ctx = context({
    currentCrewCenterWorkspace: () => 'sac', canAccessSacWorkspace: () => true,
    canAddMembers: () => false, currentMemberRecord: () => ({ id: 'me', teamKeys: ['sac'] }),
    window: { location: { origin: 'https://sac.fismediaclub.org' } },
    sacSignupUrl: () => '/sac/signups?event=game-1',
    showToast() {},
    document: { getElementById: () => null, createElement: () => anchor, body: { append() {} } },
    URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} },
    Date: class extends Date { static now() { return now; } }, shift, activity: event,
  });
  vm.runInContext('sacSignupsState.myShifts = [shift]; sacSignupsState.myShiftEvents = [activity]; downloadSacShiftCalendar("booking-1")', ctx);
  assert.equal(downloads.length, 1);
  assert.match(downloads[0], /\.ics$/);
  ctx.currentMemberRecord = () => ({ id: 'other', teamKeys: ['sac'] });
  vm.runInContext('downloadSacShiftCalendar("booking-1")', ctx);
  ctx.currentMemberRecord = () => ({ id: 'me', teamKeys: ['sac'] });
  ctx.canClaimSacSlot = () => false;
  vm.runInContext('downloadSacShiftCalendar("booking-1")', ctx);
  ctx.canClaimSacSlot = () => true;
  ctx.currentCrewCenterWorkspace = () => 'media';
  vm.runInContext('downloadSacShiftCalendar("booking-1")', ctx);
  assert.equal(downloads.length, 1);
  vm.runInContext('resetSacSignupsState()', ctx);
  assert.equal(vm.runInContext('sacSignupsState.myShifts.length + sacSignupsState.myShiftEvents.length', ctx), 0);
});
