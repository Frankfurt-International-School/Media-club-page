import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../scripts/calendar-subscriptions.js', import.meta.url), 'utf8');
function harness() {
  const nodes = new Map(); const calls = []; const notices = []; const confirmations = []; const copied = [];
  let response = async (_, args) => ({ data: { kind: args.p_kind, active: args.p_action === 'create' || args.p_action === 'replace', created_at: '2030-10-01T12:00:00Z' }, error: null });
  let active = false;
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, value: '', textContent: '', disabled: false, dataset: {}, attrs: {},
      setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
      toggleAttribute(name, value) { value ? this.setAttribute(name, '') : this.removeAttribute(name); },
      classList: { contains: () => active }, focus() { this.focused = true; }, select() { this.selected = true; },
      querySelector(selector) { return element(`${id}:${selector}`); }, querySelectorAll() { return []; } });
    return nodes.get(id);
  };
  const context = vm.createContext({ URL, Uint8Array, TextEncoder, crypto: webcrypto, setTimeout: callback => callback(),
    window: { CREW_CENTER_AUTH_USER: { id: 'account-a' }, CREW_CENTER_AUTH_EPOCH: 1, CREW_CENTER_SUPABASE: { url: 'https://example.supabase.co' },
      crewCenterSupabase: { rpc: async (name, args) => { calls.push({ name, args }); return response(name, args); } } },
    navigator: { clipboard: { writeText: async value => copied.push(value) } },
    currentMemberRecord: () => ({ id: 'member-a', teamKeys: ['media_club'] }), canAccessMyCrewSchedule: () => true,
    currentCrewCenterWorkspace: () => 'media', showToast: (...args) => notices.push(args),
    openActionConfirmation: config => confirmations.push(config),
    document: { getElementById: element, addEventListener() {} } });
  vm.runInContext(source, context);
  context.syncMediaCalendarSubscriptions();
  return { context, calls, notices, confirmations, copied, element, active(value) { active = value; }, response(value) { response = value; },
    get state() { return vm.runInContext('mediaCalendarState', context); } };
}
test('dashboard hint makes no subscription requests; schedules load two owner-bound statuses', async () => {
  const h = harness(); assert.equal(h.calls.length, 0);
  await h.context.loadMediaCalendarSubscriptions();
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls.every(call => call.args.p_expected_user_id === 'account-a' && call.args.p_action === 'status'));
  assert.equal(h.state.loaded, true);
});
test('creation sends only a random secret digest and shows copy/native controls after success', async () => {
  const h = harness(); await h.context.loadMediaCalendarSubscriptions();
  assert.equal(await h.context.updateMediaCalendarSubscription('personal', 'create'), true);
  const url = h.state.feeds.personal.url; const secret = new URL(url).searchParams.get('token');
  assert.match(secret, /^[a-f0-9]{64}$/);
  const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))).toString('hex');
  assert.equal(h.calls.at(-1).args.p_token_hash, hash);
  assert.doesNotMatch(JSON.stringify(h.calls), new RegExp(secret));
  assert.equal(h.element('media-calendar-personal:[data-calendar-links]').hidden, false);
  assert.equal(h.element('media-calendar-personal:[data-calendar-native]').href, url.replace('https:', 'webcal:'));
  await h.context.copyMediaCalendarLink('personal'); assert.equal(h.copied[0], url);
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\./);
});
test('existing links require explicit replacement, revocation is scoped, and reload needs no regeneration', async () => {
  const h = harness();
  h.response(async (_, args) => ({ data: { kind: args.p_kind, active: true, created_at: 'saved' } }));
  await h.context.loadMediaCalendarSubscriptions();
  assert.equal(h.element('media-calendar-personal:[data-calendar-create]').textContent, 'Replace link');
  h.context.requestMediaCalendarChange('personal', 'create');
  assert.equal(h.calls.length, 2); assert.equal(h.confirmations.length, 1);
  assert.match(h.confirmations[0].copy, /old link will stop working/);
  h.context.requestMediaCalendarChange('events', 'revoke');
  h.response(async (_, args) => ({ data: { kind: args.p_kind, active: false } }));
  assert.equal(await h.confirmations[1].execute(), true);
  assert.equal(h.calls.at(-1).args.p_kind, 'events'); assert.equal(h.state.feeds.personal.active, true);
});
test('failed writes do not reveal a usable link, and retry rechecks status instead of claiming success', async () => {
  const h = harness(); await h.context.loadMediaCalendarSubscriptions();
  h.response(async () => { throw new Error('Offline'); });
  assert.equal(await h.context.updateMediaCalendarSubscription('personal', 'create'), false);
  assert.equal(h.state.loaded, false); assert.ok(h.state.error);
  assert.equal(h.state.feeds.personal.url, undefined); assert.equal(h.notices.length, 0);
  assert.equal(h.element('media-calendar-personal:[data-calendar-create]').disabled, true);
  h.response(async (_, args) => ({ data: { kind: args.p_kind, active: true, created_at: 'saved' } }));
  await h.context.loadMediaCalendarSubscriptions();
  assert.equal(h.state.loaded, true); assert.equal(h.state.feeds.personal.active, true);
});
test('auth changes clear secrets and stale status or write responses never affect the next session', async () => {
  for (const phase of ['status', 'create']) {
    const h = harness(); let finish;
    if (phase === 'create') await h.context.loadMediaCalendarSubscriptions();
    const pending = [];
    h.response((_, args) => new Promise(resolve => pending.push(() => resolve({ data: { kind: args.p_kind, active: true, created_at: 'saved' } }))));
    const job = phase === 'status' ? h.context.loadMediaCalendarSubscriptions() : h.context.updateMediaCalendarSubscription('personal', 'create');
    while (!pending.length) await new Promise(resolve => setImmediate(resolve));
    h.context.window.CREW_CENTER_AUTH_EPOCH++;
    h.context.window.resetMediaCalendarSubscriptions();
    pending.forEach(resolve => resolve()); await job;
    assert.equal(h.state.loaded, false); assert.deepEqual(Object.keys(h.state.feeds), []);
    assert.equal(h.notices.length, 0);
  }
});
test('SAC-only and visitor accounts see no feed controls or requests', async () => {
  for (const change of [h => { h.context.currentMemberRecord = () => ({ id: 'sac', teamKeys: ['sac'] }); }, h => { h.context.canAccessMyCrewSchedule = () => false; }]) {
    const h = harness(); change(h); h.context.syncMediaCalendarSubscriptions();
    await h.context.loadMediaCalendarSubscriptions();
    assert.equal(h.calls.length, 0); assert.equal(h.element('media-calendar-subscriptions').hidden, true);
  }
});
