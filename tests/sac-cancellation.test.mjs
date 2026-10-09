import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/sac-signups.js', import.meta.url), 'utf8');

function harness({ admin = false, member = true, error = null, data = true, pending } = {}) {
  const dialogs = []; const writes = []; const notices = [];
  const context = vm.createContext({
    window: { CREW_CENTER_AUTH_USER: { id: 'account-a' }, CREW_CENTER_AUTH_EPOCH: 1 },
    document: { getElementById: () => ({ addEventListener() {} }), querySelector: () => ({ id: 'page-sac-my-shifts' }) },
    state: { members: [{ id: 'me', name: 'Local Member', teamKeys: ['sac'] }] },
    currentCrewCenterWorkspace: () => 'sac', canAccessSacWorkspace: () => true,
    canClaimSacSlot: () => member, canAddMembers: () => admin,
    currentMemberRecord: () => ({ id: 'me', name: 'Local Member', teamKeys: member ? ['sac'] : [] }),
    openActionConfirmation: config => dialogs.push(config), showToast: message => notices.push(message),
    formatBerlinDateTime: () => '28 October 2030', berlinDateKey: () => '2030-10-28', berlinTimeLabel: value => value.includes('11:30') ? '12:30' : '12:00',
    supabaseClient: { rpc: async (name, args) => { writes.push({ name, args }); return pending || { data, error }; } },
  });
  vm.runInContext(source, context);
  vm.runInContext(`sacSignupsState.myShifts = [{ id: 'booking', event_id: 'event', member_id: 'me', slot_start: '2030-10-28T11:00:00Z', slot_end: '2030-10-28T11:30:00Z', spot_number: 1, cancelled_at: null }]; sacSignupsState.myShiftEvents = [{ id: 'event', title: 'Warriors Basketball' }];`, context);
  context.renderSacMyShifts = async () => true; context.renderSacSignups = async () => true;
  const button = { textContent: 'Cancel shift', disabled: false };
  return { context, dialogs, writes, notices, button, change: code => vm.runInContext(code, context) };
}

test('the first SAC cancel action reviews the exact shift without writing', async () => {
  const h = harness(); await h.context.cancelSacSignupSlot('booking', h.button);
  assert.equal(h.writes.length, 0);
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.dialogs[0].cancelLabel, 'Keep shift');
  assert.match(h.dialogs[0].impact.join(' '), /Warriors Basketball.*12:00–12:30.*spot 1/);
  assert.equal(h.button.disabled, false);
  assert.equal(await h.dialogs[0].execute(), true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].args.p_signup_id, 'booking');
});

test('other-member, missing, cancelled and nonmember bookings cannot be cancelled by a member', async () => {
  for (const change of ["sacSignupsState.myShifts[0].member_id='other'", 'sacSignupsState.myShifts=[]', "sacSignupsState.myShifts[0].cancelled_at='2030-10-01'"]) {
    const h = harness(); h.change(change); await h.context.cancelSacSignupSlot('booking', h.button);
    assert.equal(h.dialogs.length, 0); assert.equal(h.writes.length, 0);
  }
  const h = harness({ member: false }); await h.context.cancelSacSignupSlot('booking', h.button);
  assert.equal(h.dialogs.length, 0); assert.equal(h.writes.length, 0);
});

test('Auth Admin reviews another member by name before cancelling', async () => {
  const h = harness({ admin: true });
  h.change("sacSignupsState.myShifts[0].member_id='other'; sacSignupsState.myShifts[0].member_name_snapshot='Another Member'");
  await h.context.cancelSacSignupSlot('booking', h.button);
  assert.match(h.dialogs[0].title, /Another Member/);
  assert.equal(await h.dialogs[0].execute(), true);
});

test('confirmation rechecks the account, workspace, membership and target booking', async () => {
  for (const change of [
    h => { h.context.window.CREW_CENTER_AUTH_USER = { id: 'account-b' }; },
    h => { h.context.window.CREW_CENTER_AUTH_EPOCH = 2; },
    h => { h.context.currentCrewCenterWorkspace = () => 'media'; },
    h => { h.context.canClaimSacSlot = () => false; },
    h => { h.change("sacSignupsState.myShifts[0].slot_end='2030-10-28T12:00:00Z'"); },
  ]) {
    const h = harness(); await h.context.cancelSacSignupSlot('booking', h.button); change(h);
    assert.equal(await h.dialogs[0].execute(), false); assert.equal(h.writes.length, 0);
  }
});

test('a failed cancellation keeps the booking and allows confirmation retry', async () => {
  const h = harness({ error: { message: 'Fixture cancellation failed' } });
  await h.context.cancelSacSignupSlot('booking', h.button);
  assert.equal(await h.dialogs[0].execute(), false);
  assert.equal(h.button.disabled, false); assert.equal(h.button.textContent, 'Cancel shift');
  assert.match(h.notices.at(-1), /Fixture cancellation failed/);
  assert.equal(h.change('sacSignupsState.myShifts[0].cancelled_at'), null);
});

test('sheet cancellation uses the booking event and does not allow a second write after a failed refresh', async () => {
  const h = harness();
  h.change('sacSignupsState.signups=sacSignupsState.myShifts; sacSignupsState.myShifts=[]; sacSignupsState.events=sacSignupsState.myShiftEvents');
  h.context.document.querySelector = () => ({ id: 'page-sac-signups' });
  h.context.renderSacSignups = async () => false;
  h.context.cancelSacSignupSlot('booking', h.button);
  assert.match(h.dialogs[0].impact.join(' '), /Warriors Basketball/);
  assert.equal(await h.dialogs[0].execute(), true);
  assert.match(h.notices.at(-1), /cancelled.*could not refresh/);
  assert.equal(h.button.disabled, true);
  h.context.cancelSacSignupSlot('booking', h.button);
  assert.equal(h.dialogs.length, 1); assert.equal(h.writes.length, 1);
});

test('an already cancelled server booking is reported accurately', async () => {
  const h = harness({ data: false }); h.context.cancelSacSignupSlot('booking', h.button);
  assert.equal(await h.dialogs[0].execute(), true);
  assert.match(h.notices.at(-1), /already cancelled/);
});

test('a cancellation response from a previous account does not update the current account UI', async () => {
  let finish; const h = harness({ pending: new Promise(resolve => { finish = resolve; }) });
  h.context.cancelSacSignupSlot('booking', h.button);
  const request = h.dialogs[0].execute();
  h.context.window.CREW_CENTER_AUTH_USER = { id: 'account-b' };
  h.context.window.CREW_CENTER_AUTH_EPOCH = 2;
  finish({ data: true, error: null });
  assert.equal(await request, true); assert.deepEqual(h.notices, []);
  assert.equal(h.change('sacSignupsState.myShifts[0].cancelled_at'), null);
});

test('double confirmation makes only one cancellation request', async () => {
  let finish;
  const h = harness({ pending: new Promise(resolve => { finish = resolve; }) });
  try {
    h.context.cancelSacSignupSlot('booking', h.button);
    assert.equal(h.dialogs.length, 1);
    const first = h.dialogs[0].execute();
    assert.equal(await h.dialogs[0].execute(), false); assert.equal(h.writes.length, 1);
    finish({ data: true, error: null }); assert.equal(await first, true);
  } finally { finish({ data: true, error: null }); }
});
