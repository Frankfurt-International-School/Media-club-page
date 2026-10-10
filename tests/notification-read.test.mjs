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
    sidebarCategories: { club: { pages: ['events'] } }, pageUrl: () => '/events', escapeHtml: value => String(value || ''), formatBerlinDateTime: () => 'Today',
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
  assert.equal(h.element('notification-mark-read').textContent, 'Mark read');
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
    assert.equal(h.element('notification-mark-read').textContent, 'Mark read');
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
  assert.equal(h.element('notification-mark-read').textContent, 'Mark read');
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
