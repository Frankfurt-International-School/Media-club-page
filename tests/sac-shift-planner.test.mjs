import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/sac-signups.js', import.meta.url), 'utf8');
const slot = { start: '2030-10-28T11:00:00Z', end: '2030-10-28T11:30:00Z' };
const booking = { id: 'own', member_id: 'me', event_id: 'other-event', slot_start: '2030-10-28T11:15:00Z', slot_end: '2030-10-28T11:45:00Z', cancelled_at: null };

function harness() {
  const queries = []; let finish;
  const q = { select() { return q; }, eq(k,v) { queries.push(['eq',k,v]); return q; }, is(k,v) { queries.push(['is',k,v]); return q; },
    lt(k,v) { queries.push(['lt',k,v]); return q; }, gt(k,v) { queries.push(['gt',k,v]); return q; }, order() { return new Promise(resolve => { finish = resolve; }); } };
  const context = vm.createContext({
    Date: class extends Date { static now() { return Date.parse('2030-10-01'); } },
    document: { getElementById: () => ({ addEventListener() {}, querySelectorAll: () => [], getAttribute: () => null }), querySelector: () => null },
    state: { members: [{ id: 'me', teamKeys: ['sac'] }] }, window: { CREW_CENTER_AUTH_USER: { id: 'a' }, CREW_CENTER_AUTH_EPOCH: 1 },
    currentCrewCenterWorkspace: () => 'sac', canAccessSacWorkspace: () => true, canAddMembers: () => false,
    currentMemberRecord: () => ({ id: 'me', teamKeys: ['sac'] }), escapeHtml: String, sacSignupUrl: id => '/sac/signups?event=' + id,
    supabaseClient: { from: () => q }, showToast() {},
  });
  vm.runInContext(source, context);
  vm.runInContext(`sacSignupsState.events=[{id:'event',starts_at:'2030-10-28T11:00:00Z',ends_at:'2030-10-28T13:00:00Z'}]; sacSignupsState.selectedEventId='event'; sacSignupsState.memberBookings=${JSON.stringify([booking])}; sacSignupsState.bookingsMemberId='me'; sacSignupsState.bookingsReady=true;`, context);
  context.paintSacSignupActions = () => {};
  return { context, queries, finish: value => finish(value), run: code => vm.runInContext(code, context) };
}

test('a slot with an existing overlapping SAC booking is explained instead of offered to claim', () => {
  const h = harness();
  const action = h.context.sacSignupAction(slot, [], 'me', 2, false);
  assert.match(action, /Overlaps/);
  assert.doesNotMatch(action, /data-sac-claim-start/);
  assert.match(action, /other-event/);
});

test('half-open time ranges allow adjacent shifts and ignore cancelled or other-member bookings', () => {
  const h = harness();
  assert.equal(h.context.sacSlotAvailability(slot, [], [{ ...booking, slot_start: slot.end }], 'me', 2).bookable, true);
  for (const b of [{ ...booking, cancelled_at: '2030-10-01' }, { ...booking, member_id: 'other' }]) {
    assert.equal(h.context.sacSlotAvailability(slot, [], [b], 'me', 2).bookable, true);
  }
  const own = { ...booking, event_id: 'event', slot_start: slot.start, slot_end: slot.end };
  assert.equal(h.context.sacSlotAvailability(slot, [own], [own], 'me', 2).booked, true);
  assert.equal(h.context.sacSlotAvailability(slot, [own], [own], 'me', 2).bookable, false);
  assert.equal(h.context.sacSlotAvailability(slot, [{member_id:'a'},{member_id:'b'}], [], 'me', 2).bookable, false);
});

test('availability is checked only for the selected member and event window', async () => {
  const h = harness(); const pending = h.context.loadSacSignupAvailability();
  assert.equal(h.run('sacSignupsState.bookingsReady'), false);
  assert.deepEqual(h.queries, [['eq','member_id','me'],['is','cancelled_at',null],['lt','slot_start','2030-10-28T13:00:00Z'],['gt','slot_end','2030-10-28T11:00:00Z']]);
  h.finish({data:[booking],error:null}); await pending;
  assert.equal(h.run('sacSignupsState.bookingsReady'), true);
});

test('account or event changes discard delayed availability results', async () => {
  for (const change of [h => { h.context.window.CREW_CENTER_AUTH_EPOCH=2; }, h => h.run("sacSignupsState.selectedEventId='new-event'")]) {
    const h=harness(); const pending=h.context.loadSacSignupAvailability(); change(h);
    h.finish({data:[booking],error:null}); await pending;
    assert.equal(h.run('sacSignupsState.bookingsReady'), false);
    assert.equal(h.run('sacSignupsState.memberBookings.length'), 0);
  }
});

test('preview accounts make no personal booking read and failures never become bookable', async () => {
  const h=harness(); h.context.currentMemberRecord=()=>({id:'me',teamKeys:[]});
  await h.context.loadSacSignupAvailability(); assert.equal(h.queries.length,0);
  const failed=harness(); const pending=failed.context.loadSacSignupAvailability();
  failed.finish({data:null,error:{message:'local failure'}}); await pending;
  assert.equal(failed.run('sacSignupsState.bookingsReady'),false);
  assert.doesNotMatch(failed.context.sacSignupAction(slot, [], 'me', 2, false), /data-sac-claim-start/);
});
