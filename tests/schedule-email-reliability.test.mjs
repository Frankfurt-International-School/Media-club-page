import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { eventAvailabilityChanges, eventRoleCapacities, routeEventUpdateRecipients } from '../supabase/functions/send-schedule-notification/routing.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('supabase/functions/send-schedule-notification/index.ts');
const executable = stripTypeScriptTypes(source.replace(/^import [\s\S]*?;\n/gm, ''));
const core = read('scripts/core.js');
const extract = (text, name) => text.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`))[0];
const version = '2026-10-14T10:00:00Z';

function harness({ existing, deliveries = [], failLedger = false, send, user } = {}) {
  const tables = {
    events: [{ id: 'event-a', title: 'Synthetic coverage', date: '2030-10-14T10:00:00Z', ends_at: '2030-10-14T12:00:00Z', updated_at: version }],
    members: ['a', 'b'].map(id => ({ id, name: 'Alex P.', email: `${id}x1234@fis.edu`, role: 'Member', status: 'active', notification_preferences: { email_event_updates: true } })),
    member_team_memberships: ['a', 'b'].map(member_id => ({ member_id, team_key: 'media_club' })),
    schedule_email_dispatches: existing ? [{ id: 'dispatch-a', sent_count: 0, resource_type: 'event', resource_id: 'event-a', action: 'created', resource_version: version, last_attempt_at: '2026-01-01T00:00:00Z', ...existing }] : [],
    schedule_email_deliveries: deliveries.map(row => ({ dispatch_id: 'dispatch-a', status: 'pending', ...row })),
    schedule_email_resource_states: [],
  };
  const requests = []; let sequence = 0; let handler;
  const client = {
    auth: { getUser: async () => ({ data: { user: user || { id: 'staff', email: 'staff@example.test', app_metadata: { role: 'admin' } } } }) },
    from(table) {
      let operation = 'select'; let payload; let options; let single = false; const filters = [];
      const query = {
        select(columns, opts) { options = opts; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        neq(key, value) { filters.push(row => row[key] !== value); return query; },
        ilike(key, value) { filters.push(row => row[key]?.toLowerCase() === value.toLowerCase()); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        order() { return query; },
        insert(value) { operation = 'insert'; payload = value; return query; },
        upsert(value) { operation = 'upsert'; payload = value; return query; },
        update(value) { operation = 'update'; payload = value; return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          try {
            const rows = tables[table] ||= [];
            let selected = rows.filter(row => filters.every(filter => filter(row)));
            if (failLedger && table === 'schedule_email_deliveries' && payload?.status === 'sent') {
              return Promise.resolve({ data: null, error: { message: 'Ledger unavailable' } }).then(resolve, reject);
            }
            if (operation === 'insert' && table === 'schedule_email_dispatches' && rows.length) {
              return Promise.resolve({ data: null, error: { code: '23505' } }).then(resolve, reject);
            }
            if (operation === 'insert' || operation === 'upsert') {
              selected = [];
              for (const item of Array.isArray(payload) ? payload : [payload]) {
                const duplicate = table === 'schedule_email_deliveries' && rows.find(row => row.dispatch_id === item.dispatch_id && row.member_id === item.member_id);
                if (!duplicate) {
                  const row = { id: table === 'schedule_email_dispatches' ? 'dispatch-a' : `row-${++sequence}`, status: 'pending', ...item };
                  rows.push(row); selected.push(row);
                }
              }
            }
            if (operation === 'update') selected.forEach(row => Object.assign(row, payload));
            const data = structuredClone(single ? selected[0] || null : selected);
            return Promise.resolve({ data, error: null, count: options?.count ? selected.length : null }).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      };
      return query;
    },
  };
  vm.runInNewContext(executable, {
    Deno: { env: { get: () => 'synthetic-test-value' }, serve: fn => { handler = fn; } },
    createClient: () => client, eventAvailabilityChanges, eventRoleCapacities, routeEventUpdateRecipients,
    Response, TextEncoder, btoa, AbortSignal, Date,
    setTimeout: fn => { fn(); },
    fetch: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body), options });
      return send ? send(requests.length) : new Response(JSON.stringify({ id: `provider-${requests.length}` }), { status: 200 });
    },
  });
  return { tables, requests, run: () => handler(new Request('https://example.test/email', { method: 'POST', body: JSON.stringify({ resourceType: 'event', resourceId: 'event-a', action: 'created' }) })) };
}

test('a thrown provider request records failure and still attempts the remaining private recipients', async () => {
  const h = harness({ send: count => { if (count === 1) throw new Error('Network interrupted'); return new Response('{"id":"provider-b"}'); } });
  assert.equal((await h.run()).status, 502);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.tables.schedule_email_deliveries.map(row => row.status), ['failed', 'sent']);
  assert.ok(h.requests.every(request => request.options.signal instanceof AbortSignal));
});

test('a provider acceptance whose ledger write failed is never reported as a completed batch', async () => {
  const h = harness({ failLedger: true });
  assert.equal((await h.run()).status, 502);
  assert.equal(h.tables.schedule_email_dispatches[0].status, 'failed');
});

test('retries skip sent recipients and refuse an address that no longer matches the current member', async () => {
  const h = harness({ existing: { status: 'failed' }, deliveries: [
    { id: 'delivery-a', member_id: 'a', recipient_email: 'old@example.test' },
    { id: 'delivery-b', member_id: 'b', recipient_email: 'bx1234@fis.edu', status: 'sent' },
  ] });
  assert.equal((await h.run()).status, 200);
  assert.equal(h.requests.length, 0, 'an old address must not receive private schedule data');
  assert.equal(h.tables.schedule_email_deliveries[0].status, 'failed');
});

test('an active batch remains in progress instead of claiming successful completed delivery', async () => {
  const h = harness({ existing: { status: 'processing', last_attempt_at: new Date().toISOString() } });
  const response = await h.run();
  assert.equal(response.status, 409); assert.equal((await response.json()).inProgress, true);
  assert.equal(h.requests.length, 0); assert.equal(h.tables.schedule_email_dispatches[0].status, 'processing');
});

test('concurrent retries atomically claim a failed batch once', async () => {
  const h = harness({ existing: { status: 'failed' } });
  const responses = await Promise.all([h.run(), h.run()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(h.requests.length, 2, 'one sender handles the two recipients');
  assert.equal(h.tables.schedule_email_dispatches[0].status, 'completed');
});

test('malformed provider success cannot mark a recipient sent', async () => {
  for (const body of ['{}', 'null', '{"id":""}']) {
    const h = harness({ send: () => new Response(body) });
    assert.equal((await h.run()).status, 502);
    assert.ok(h.tables.schedule_email_deliveries.every(row => row.status === 'failed'));
  }
});

test('visitors and ordinary members cannot initiate email batches', async () => {
  for (const [user, expected] of [[{ id: 'visitor', is_anonymous: true }, 401], [{ id: 'member', email: 'ax1234@fis.edu', app_metadata: { role: 'member' } }, 403]]) {
    const h = harness({ user });
    assert.equal((await h.run()).status, expected);
    assert.equal(h.requests.length, 0); assert.equal(h.tables.schedule_email_dispatches.length, 0);
  }
});

test('frontend email errors resolve with failure feedback instead of interrupting a saved item', async () => {
  const h = vm.createContext({ window: {}, setTimeout, clearTimeout, supabaseClient: { functions: { invoke: async () => { throw new Error('Offline'); } } } });
  vm.runInContext(extract(core, 'sendScheduleEmailNotification'), h);
  const result = await h.sendScheduleEmailNotification('event', 'saved-event', 'created');
  assert.equal(result.ok, false); assert.match(result.error, /Offline/);
  h.supabaseClient.functions.invoke = async () => ({ data: null, error: { message: 'Generic HTTP error', context: new Response('{"error":"Provider rate limit"}') } });
  assert.match((await h.sendScheduleEmailNotification('event', 'saved-event', 'created')).error, /Provider rate limit/);
});

test('frontend delivery deadline resolves without waiting indefinitely for an email batch', async () => {
  let expire; let cleared = false;
  const h = vm.createContext({ window: {}, setTimeout: fn => { expire = fn; return 1; }, clearTimeout: () => { cleared = true; }, supabaseClient: { functions: { invoke: () => new Promise(() => {}) } } });
  vm.runInContext(extract(core, 'sendScheduleEmailNotification'), h);
  const pending = h.sendScheduleEmailNotification('event', 'saved-event', 'created');
  expire(); const result = await pending;
  assert.equal(result.ok, false); assert.match(result.error, /still unconfirmed/); assert.equal(cleared, true);
});

test('meeting save refreshes before slow email and preserves any subsequently opened editor', async () => {
  const values = { 'meeting-title': 'Synthetic meeting', 'meeting-date': '2030-10-14', 'meeting-start': '10:00', 'meeting-end': '11:00', 'meeting-audience': 'general' };
  const elements = new Map(); const calls = []; let finishEmail; let open = true;
  const h = vm.createContext({
    window: { CREW_CENTER_AUTH_USER: { id: 'staff' }, CREW_CENTER_AUTH_EPOCH: 1 }, editingMeetingId: 'saved-meeting',
    document: { getElementById: id => {
      if (!elements.has(id)) elements.set(id, { value: values[id] || '', checked: false, disabled: false });
      return elements.get(id);
    } },
    canManageCrewOperations: () => true,
    berlinTimestamp: (date, time) => Date.parse(`${date}T${time}:00Z`),
    showToast: message => calls.push(message),
    supabaseClient: { rpc: async () => ({ data: { id: 'saved-meeting' }, error: null }) },
    closeMeetingEditor: () => { open = false; h.editingMeetingId = null; },
    loadCrewCenterData: async () => calls.push('refreshed'),
    sendScheduleEmailNotification: (...args) => { calls.push(args); return new Promise(resolve => { finishEmail = resolve; }); },
  });
  vm.runInContext(extract(read('scripts/meetings.js'), 'saveMeeting'), h);
  const pending = h.saveMeeting(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(open, false); assert.ok(calls.includes('refreshed'));
  assert.ok(calls.some(call => typeof call === 'string' && call.includes('Meeting updated')));
  open = true; h.editingMeetingId = 'new-meeting';
  finishEmail({ ok: false, sentCount: 0 }); await pending;
  assert.equal(open, true); assert.equal(h.editingMeetingId, 'new-meeting');
  assert.deepEqual(calls.find(Array.isArray), ['meeting', 'saved-meeting', 'updated']);
});
