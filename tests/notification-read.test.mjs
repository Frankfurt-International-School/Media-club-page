import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/ui.js', import.meta.url), 'utf8');

function harness() {
  const elements = new Map(); const saved = new Map(); const notices = []; const calls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', disabled: false,
      classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {} });
    return elements.get(id);
  };
  let member = { id: 'member-a', email: 'a@example.test' }; let response = () => ({ data: 1, error: null });
  const context = vm.createContext({
    window: { CREW_CENTER_AUTH_USER: { id: 'account-a', email: 'a@example.test' }, CREW_CENTER_AUTH_EPOCH: 1 },
    document: { getElementById: element },
    state: { notifications: [{ id: 'first', member_id: 'member-a', notification_type: 'event_created', title: 'First', read_at: null }], events: [] },
    currentMemberRecord: () => member, isVisitorSession: () => false,
    currentNotificationPreferences: () => ({ event_created: true, maybe_reminders: true, event_reminders: true }),
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    supabaseClient: { rpc: async name => { calls.push(name); return response(); } },
    withCrewCenterDataTimeout: operation => operation,
    sidebarCategories: { club: { pages: ['events'] } }, pageUrl: () => '/events', escapeHtml: value => String(value || ''), formatBerlinDateTime: value => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Europe/Berlin' }),
    berlinDateKey: (value = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)),
    showToast: (...args) => notices.push(args),
  });
  vm.runInContext(source.slice(source.indexOf('function ownUpcomingSignups'), source.indexOf('const PROFILE_MAX_FILE_SIZE')), context);
  context.currentGeneratedNotificationItems = () => ({ maybeItems: [], upcomingItems: [{ readKey: 'reminder-a', event: { id: 'event-a', title: 'Upcoming' } }] });
  context.fmtDate = () => 'Today'; context.eventScheduleTimeLabel = () => '12:00';
  return { context, element, saved, notices, calls, response: value => { response = value; }, member: value => { member = value; } };
}

test('a rejected notification request recovers the button and preserves unread items for retry', async () => {
  const h = harness(); h.response(() => { throw new Error('Offline'); });
  await assert.doesNotReject(h.context.markNotificationsRead());
  assert.equal(h.element('notification-mark-read').textContent, 'Mark all read');
  assert.equal(h.element('notification-mark-read').disabled, false);
  assert.equal(h.context.state.notifications[0].read_at, null);
  assert.equal(h.saved.size, 0);
  assert.equal(h.notices.at(-1)[1], 'error');
  h.response(() => ({ data: 1, error: null }));
  await h.context.markNotificationsRead();
  assert.ok(h.context.state.notifications[0].read_at);
  assert.ok(h.saved.size);
});

test('a returned RPC error leaves both generated and stored notifications unread', async () => {
  const h = harness(); h.response(() => ({ error: { message: 'Unavailable' } }));
  await h.context.markNotificationsRead();
  assert.equal(h.saved.size, 0);
  assert.equal(h.context.state.notifications[0].read_at, null);
  assert.equal(h.element('notification-count').textContent, 2);
});

test('new notifications arriving during Mark read stay unread and duplicate clicks do not send another request', async () => {
  const h = harness(); let finish;
  h.response(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.markNotificationsRead();
  h.context.state.notifications.push({ id: 'new', member_id: 'member-a', read_at: null });
  h.context.renderNotificationCenter();
  assert.equal(h.element('notification-mark-read').disabled, true);
  await h.context.markNotificationsRead();
  assert.equal(h.calls.length, 1);
  finish({ data: 1, error: null }); await pending;
  assert.ok(h.context.state.notifications[0].read_at);
  assert.equal(h.context.state.notifications[1].read_at, null);
  assert.equal(h.element('notification-count').textContent, 1);
});

test('delayed notification acknowledgements cannot affect another account or a new auth session', async () => {
  for (const change of [
    h => { h.context.window.CREW_CENTER_AUTH_USER = { id: 'account-b', email: 'b@example.test' }; h.member({ id: 'member-b', email: 'b@example.test' }); },
    h => { h.context.window.CREW_CENTER_AUTH_EPOCH += 1; },
  ]) {
    const h = harness(); let finish;
    h.response(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.context.markNotificationsRead(); change(h);
    h.context.state.notifications = [{ id: 'new-session', read_at: null }];
    finish({ data: 1, error: null }); await pending;
    assert.equal(h.context.state.notifications[0].read_at, null);
    assert.equal(h.saved.size, 0);
    assert.equal(h.notices.length, 0);
    assert.equal(h.element('notification-mark-read').textContent, 'Mark all read');
  }
});

test('visitor, signed-out and mismatched member sessions cannot acknowledge notifications', async () => {
  for (const change of [
    h => { h.context.isVisitorSession = () => true; },
    h => { h.context.window.CREW_CENTER_AUTH_USER = null; },
    h => { h.member({ id: 'old-member', email: 'old@example.test' }); },
  ]) {
    const h = harness(); change(h); await h.context.markNotificationsRead();
    assert.equal(h.calls.length, 0); assert.equal(h.saved.size, 0);
    assert.equal(h.context.state.notifications[0].read_at, null);
    h.context.renderNotificationCenter();
    assert.equal(h.element('notification-mark-read').disabled, true);
  }
});

test('generated-only reminders can be acknowledged without a database request', async () => {
  const h = harness(); h.context.state.notifications = [];
  await h.context.markNotificationsRead();
  assert.equal(h.calls.length, 0); assert.equal(h.element('notification-count').textContent, 0);
  assert.equal(h.element('notification-mark-read').disabled, true);
});

test('notification requests that time out recover for retry without clearing unread state', async () => {
  const h = harness(); h.context.withCrewCenterDataTimeout = async () => { throw new Error('Timed out'); };
  await h.context.markNotificationsRead();
  assert.equal(h.element('notification-mark-read').textContent, 'Mark all read');
  assert.equal(h.element('notification-mark-read').disabled, false);
  assert.equal(h.context.state.notifications[0].read_at, null);
  assert.equal(h.saved.size, 0);
});

test('cached notifications from another member are neither displayed nor acknowledged', async () => {
  const h = harness(); h.context.state.notifications = [{ id: 'other', member_id: 'member-b', title: 'Private other account', read_at: null }];
  h.context.renderNotificationCenter();
  assert.doesNotMatch(h.element('notification-list').innerHTML, /Private other account/);
  await h.context.markNotificationsRead();
  assert.equal(h.calls.length, 0); assert.equal(h.context.state.notifications[0].read_at, null);
});

test('Unread filters read stored updates and acknowledged reminders without changing the total badge', () => {
  const h = harness();
  h.context.state.notifications.push({ id: 'read', member_id: 'member-a', notification_type: 'meeting_invite', title: 'Earlier meeting', read_at: '2030-10-01T10:00:00Z' });
  h.context.renderNotificationCenter();
  assert.match(h.element('notification-list').innerHTML, /Earlier meeting/);
  vm.runInContext("notificationInboxFilter = 'unread'", h.context);
  h.context.renderNotificationCenter();
  assert.doesNotMatch(h.element('notification-list').innerHTML, /Earlier meeting/);
  assert.match(h.element('notification-list').innerHTML, /First/);
  assert.equal(h.element('notification-count').textContent, 2);
  h.context.markNotificationRemindersRead(['reminder-a']);
  h.context.renderNotificationCenter();
  assert.doesNotMatch(h.element('notification-list').innerHTML, /is coming up/);
  assert.equal(h.element('notification-count').textContent, 1);
});

test('inbox date groups respect Berlin midnight and order newest first', () => {
  const h = harness(); const now = Date.parse('2030-10-01T22:30:00Z');
  const groups = h.context.notificationInboxGroups([
    { date: Date.parse('2030-09-30T10:00:00Z') },
    { date: Date.parse('2030-10-01T22:15:00Z') },
    { date: Date.parse('2030-10-01T21:45:00Z') },
  ], now);
  assert.deepEqual(Array.from(groups, group => group.day), ['2030-10-02', '2030-10-01', '2030-09-30']);
  assert.equal(groups[0].label, 'Today'); assert.equal(groups[1].label, 'Yesterday');
});

test('opening one stored notice acknowledges only that notice and preserves newly arriving updates', async () => {
  const h = harness(); let finish;
  h.response(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.markNotificationRead('first');
  await h.context.markNotificationRead('first');
  h.context.state.notifications.push({ id: 'new', member_id: 'member-a', read_at: null });
  finish({ data: true, error: null }); await pending;
  assert.deepEqual(h.calls, ['mark_own_notification_read']);
  assert.ok(h.context.state.notifications[0].read_at);
  assert.equal(h.context.state.notifications[1].read_at, null);
  await h.context.markNotificationRead('first'); assert.equal(h.calls.length, 1);
});

test('individual acknowledgement rejects foreign cached notices and keeps unread status on an RPC failure', async () => {
  const h = harness(); h.response(() => ({ data: false, error: null }));
  await h.context.markNotificationRead('first');
  assert.equal(h.context.state.notifications[0].read_at, null);
  assert.equal(h.notices.at(-1)[1], 'error');
  h.context.state.notifications.push({ id: 'foreign', member_id: 'member-b', read_at: null });
  await h.context.markNotificationRead('foreign'); assert.equal(h.calls.length, 1);
});

test('individual acknowledgement cannot update a replacement account or a newer session', async () => {
  const h = harness(); let finish;
  h.response(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.markNotificationRead('first');
  h.context.window.CREW_CENTER_AUTH_EPOCH += 1;
  h.context.state.notifications = [{ id: 'first', member_id: 'member-a', read_at: null }];
  finish({ data: true, error: null }); await pending;
  assert.equal(h.context.state.notifications[0].read_at, null); assert.equal(h.notices.length, 0);
});

test('membership approval notices open the active workspace dashboard', () => {
  const h = harness(); h.context.currentCrewCenterWorkspace = () => 'sac';
  h.context.sidebarCategories.club.pages.push('home');
  const row = h.context.notificationInboxRow({ kind:'application_approved',date:Date.now(),stored:{id:'approval',page:'home',title:'Approved'} });
  assert.match(row, /data-personal-destination="sac"/);
});
