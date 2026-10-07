import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const path = new URL('../scripts/sac-dashboard.js', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
const now = Date.parse('2030-10-28T10:00:00Z');
const row = (id, memberId = 'me', extra = {}) => ({
  id, member_id: memberId, event_id: 'game', slot_start: '2030-10-28T11:00:00Z',
  slot_end: '2030-10-28T11:30:00Z', spot_number: 1, cancelled_at: null,
  sac_events: { id: 'game', title: 'Basketball <final>', location: 'Sports Hall' }, ...extra,
});

function harness({ tagged = true, access = true, results = {}, pending } = {}) {
  const elements = Object.fromEntries(['sac-home-next-shift', 'sac-home-upcoming', 'sac-home-shift-count', 'sac-home-member-label'].map(id => [id, { innerHTML: '', textContent: '' }]));
  const queries = [];
  let member = { id: 'me', teamKeys: tagged ? ['sac'] : [], sacTitle: 'vice_president' };
  const context = vm.createContext({
    window: {}, document: { getElementById: id => elements[id], addEventListener() {} },
    Date: class extends Date { static now() { return now; } },
    currentCrewCenterWorkspace: () => 'sac', canAccessSacWorkspace: () => access,
    currentMemberRecord: () => member, sacTitleLabel: () => 'SAC Vice President',
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    formatBerlinDateTime: date => date, sacSignupTimeRange: () => '12:00–12:30',
    sacSignupUrl: id => `/sac/signups?event=${id}`, pageUrl: page => page === 'sac-meetings' ? '/sac/meetings' : '/sac/events',
    sacUpcomingOwnShifts: (rows, id, time) => rows.filter(item => item.member_id === id && !item.cancelled_at && Date.parse(item.slot_end) > time).sort((a, b) => Date.parse(a.slot_start) - Date.parse(b.slot_start)),
    supabaseClient: { from(table) {
      const query = { table, filters: [], fields: '' }; queries.push(query);
      const chain = { select(fields) { query.fields = fields; return chain; }, eq(...args) { query.filters.push(['eq', ...args]); return chain; }, is(...args) { query.filters.push(['is', ...args]); return chain; }, gt(...args) { query.filters.push(['gt', ...args]); return chain; }, order() { return chain; }, limit() { return chain; }, then(resolve, reject) { return (pending ? pending(table) : Promise.resolve(results[table] || { data: [], error: null })).then(resolve, reject); } };
      return chain;
    } },
  });
  vm.runInContext(source, context);
  return { context, elements, queries, changeMember(value) { member = value; } };
}

test('personal SAC dashboard queries only active own shifts and escapes their event title', async () => {
  const h = harness({ results: { sac_slot_signups: { data: [row('mine'), row('other', 'other'), row('cancelled', 'me', { cancelled_at: '2030-10-27T09:00:00Z' }), row('past', 'me', { slot_end: '2030-10-27T09:00:00Z' })] } } });
  await h.context.renderSacPersonalDashboard();
  const query = h.queries.find(item => item.table === 'sac_slot_signups');
  assert.ok(query.filters.some(([op, field, value]) => op === 'eq' && field === 'member_id' && value === 'me'));
  assert.ok(query.filters.some(([op, field, value]) => op === 'is' && field === 'cancelled_at' && value === null));
  assert.ok(query.filters.some(([op, field]) => op === 'gt' && field === 'slot_end'));
  assert.equal(h.elements['sac-home-shift-count'].textContent, '1');
  assert.match(h.elements['sac-home-next-shift'].innerHTML, /Basketball &lt;final&gt;/);
  assert.match(h.elements['sac-home-next-shift'].innerHTML, /Booked/);
  assert.match(h.elements['sac-home-next-shift'].innerHTML, /\/sac\/signups\?event=game/);
});

test('eligible non-SAC members get preview activities without a signup query', async () => {
  const h = harness({ tagged: false });
  await h.context.renderSacPersonalDashboard();
  assert.ok(!h.queries.some(item => item.table === 'sac_slot_signups'));
  assert.match(h.elements['sac-home-next-shift'].innerHTML, /SAC membership required/);
  const denied = harness({ access: false });
  await denied.context.renderSacPersonalDashboard();
  assert.equal(denied.queries.length, 0);
});

test('dashboard combines upcoming events and meetings chronologically and keeps partial failures visible', async () => {
  const h = harness({ results: {
    sac_events: { data: [{ id: 'event', title: 'Basketball', starts_at: '2030-10-28T13:00:00Z', ends_at: '2030-10-28T14:00:00Z' }] },
    sac_meetings: { data: [{ id: 'meeting', title: 'Council meeting', starts_at: '2030-10-28T11:00:00Z', ends_at: '2030-10-28T12:00:00Z' }] },
    sac_slot_signups: { error: { message: 'Unavailable' } },
  } });
  await h.context.renderSacPersonalDashboard();
  const output = h.elements['sac-home-upcoming'].innerHTML;
  assert.ok(output.indexOf('Council meeting') < output.indexOf('Basketball'));
  assert.match(h.elements['sac-home-next-shift'].innerHTML, /could not load/i);
  assert.equal(h.elements['sac-home-shift-count'].textContent, '—');
  const empty = harness(); await empty.context.renderSacPersonalDashboard();
  assert.match(empty.elements['sac-home-next-shift'].innerHTML, /No upcoming shifts/);
  assert.match(empty.elements['sac-home-upcoming'].innerHTML, /No upcoming events or meetings/);
});

test('reset and account changes prevent an old dashboard request from painting personal data', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const h = harness({ pending: () => waiting });
  const rendering = h.context.renderSacPersonalDashboard();
  h.context.resetSacDashboardState();
  release({ data: [row('old')], error: null });
  await rendering;
  assert.equal(h.elements['sac-home-next-shift'].innerHTML, '');
  assert.equal(h.elements['sac-home-shift-count'].textContent, '—');
  let releaseChanged;
  const shared = new Promise(resolve => { releaseChanged = resolve; });
  const changed = harness({ pending: () => shared });
  const oldAccount = changed.context.renderSacPersonalDashboard();
  changed.changeMember({ id: 'someone-else', teamKeys: ['sac'] });
  releaseChanged({ data: [row('old')], error: null });
  await oldAccount;
  assert.doesNotMatch(changed.elements['sac-home-next-shift'].innerHTML, /Basketball/);
});

test('SAC and Media Club share the same personal Berlin-time greeting across daylight saving changes', () => {
  const ui = readFileSync(new URL('../scripts/ui.js', import.meta.url), 'utf8');
  const greeting = ui.slice(ui.indexOf('function updateDashboardGreeting('), ui.indexOf('function updateUserSurfaces('));
  for (const [date, expected] of [['2030-10-26T07:00:00Z', 'Good morning, Jane'], ['2030-10-27T11:00:00Z', 'Good afternoon, Jane'], ['2030-10-27T17:00:00Z', 'Good evening, Jane']]) {
    const elements = { 'dashboard-greeting': {}, 'sac-home-greeting': {} };
    const context = { Date: class extends Date { constructor() { super(date); } }, Intl,
      document: { getElementById: id => elements[id] }, isVisitorSession: () => false,
      currentMemberRecord: () => ({ name: 'Jane Example' }), splitName: name => ({ fname: name.split(' ')[0] }) };
    vm.runInNewContext(`${greeting}\nupdateDashboardGreeting()`, context);
    assert.equal(elements['sac-home-greeting'].textContent, expected);
    assert.equal(elements['dashboard-greeting'].textContent, expected);
  }
});
