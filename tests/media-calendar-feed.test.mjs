import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMediaCalendar, createCalendarHandler, sha256 } from '../supabase/functions/media-calendar/calendar.mjs';

const id = '10000000-0000-0000-0000-000000000001';
const entry = { id, title: 'School coverage', location: 'Sports hall', start: '2030-10-27T09:00:00+01:00', end: '2030-10-27T11:00:00+01:00', updated: '2030-10-20T12:00:00Z', role: 'OBS', tentative: true };
const feed = { kind: 'personal', entries: [entry] };
const token = 'e'.repeat(64);
const url = `https://example.test/functions/v1/media-calendar?token=${token}`;

test('subscriptions keep stable IDs, correct UTC times and personal tentative status without identities', () => {
  const calendar = buildMediaCalendar(feed);
  assert.match(calendar, /UID:media-personal-10000000-0000-0000-0000-000000000001@fismediaclub.org/);
  assert.match(calendar, /DTSTART:20301027T080000Z/);
  assert.match(calendar, /DTEND:20301027T100000Z/);
  assert.match(calendar, /Your crew role: OBS/);
  assert.match(calendar, /STATUS:TENTATIVE/);
  assert.match(calendar, /X-WR-TIMEZONE:Europe\/Berlin/);
  assert.doesNotMatch(calendar, /ATTENDEE|ORGANIZER|mailto:|VALARM/);
  const other = buildMediaCalendar({ kind: 'events', entries: [{ ...entry, tentative: false, role: null }] });
  assert.match(other, /UID:media-events-/);
  assert.doesNotMatch(other, /Your crew role|TENTATIVE/);
});
test('calendar text escapes property injection and folds Unicode at 75 octets', () => {
  const calendar = buildMediaCalendar({ ...feed, entries: [{ ...entry, title: '校🎥'.repeat(60) + '\r\nATTENDEE:evil', location: 'Hall;1,2\\3' }] });
  assert.doesNotMatch(calendar, /\r\nATTENDEE:/);
  assert.match(calendar.replace(/\r\n /g, ''), /\\nATTENDEE:evil/);
  assert.match(calendar, /LOCATION:Hall\\;1\\,2\\\\3/);
  assert.ok(calendar.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
});
test('empty subscriptions are valid but invalid or duplicate records fail closed', () => {
  assert.match(buildMediaCalendar({ kind: 'personal', entries: [] }), /BEGIN:VCALENDAR/);
  for (const entries of [[entry, entry], [{ ...entry, id: 'injected\r\nSTATUS:CANCELLED' }], [{ ...entry, end: entry.start }], [{ ...entry, updated: null }]]) {
    assert.throws(() => buildMediaCalendar({ ...feed, entries }));
  }
});
test('HTTP handler hashes secrets and exposes only authenticated calendars with private headers', async () => {
  const hashes = [];
  const handler = createCalendarHandler(async hash => { hashes.push(hash); return hash === await sha256(token) ? feed : null; });
  const response = await handler(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(hashes[0], await sha256(token));
  assert.notEqual(hashes[0], token);
  assert.match(response.headers.get('content-type'), /text\/calendar/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await response.text(), /School coverage/);
  assert.equal((await handler(new Request(url, { method: 'HEAD' }))).status, 200);
  assert.equal(await (await handler(new Request(url, { method: 'HEAD' }))).text(), '');
  const count = hashes.length;
  for (const invalid of ['', '?token=short', `?token=${token}&token=${token}`]) assert.equal((await handler(new Request('https://example.test/' + invalid))).status, 404);
  assert.equal(hashes.length, count);
  assert.equal((await handler(new Request(url, { method: 'POST' }))).status, 405);
});
test('conditional requests still validate revoked access, and edits change the ETag', async () => {
  let current = feed;
  const handler = createCalendarHandler(async () => current);
  const etag = (await handler(new Request(url))).headers.get('etag');
  assert.equal((await handler(new Request(url, { headers: { 'if-none-match': etag } }))).status, 304);
  current = { ...feed, entries: [{ ...entry, start: '2030-10-27T10:00:00+01:00' }] };
  const changed = await handler(new Request(url, { headers: { 'if-none-match': etag } }));
  assert.equal(changed.status, 200); assert.notEqual(changed.headers.get('etag'), etag);
  current = null;
  assert.equal((await handler(new Request(url, { headers: { 'if-none-match': etag } }))).status, 404);
});
test('backend errors return retryable errors, never an empty calendar or secret details', async () => {
  const handler = createCalendarHandler(async () => { throw new Error(token); });
  const response = await handler(new Request(url));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '300');
  assert.doesNotMatch(await response.text(), /BEGIN:VCALENDAR|eeeeeeee/);
});
