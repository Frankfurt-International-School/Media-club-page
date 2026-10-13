import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const extract = name => source.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`))[0];
function harness() {
  const context = vm.createContext({
    window: { CREW_CENTER_AUTH_USER: { id: 'account-a', email: 'me@example.test' }, CREW_CENTER_AUTH_EPOCH: 3 },
    isVisitorSession: () => false, personDisplayName: name => name, splitName: () => ({ fname: 'Alex', lname: 'P.' }),
    normalizeSacTitle: () => '', colors: ['red'], currentMemberRecord: () => null,
  });
  vm.runInContext(extract('normalizeMember') + '\n' + extract('memberMatchesCurrentSession'), context);
  return context;
}

test('server ownership markers bind private-directory members to the account and auth epoch without exposing email', () => {
  const h = harness();
  const member = h.normalizeMember({ id: 'me', name: 'Alex P.', role: 'Member', email: null, is_current_user: true });
  assert.equal(member.email, ''); assert.equal(member.directoryActor, 'account-a:3');
  assert.equal(h.memberMatchesCurrentSession(member), true);
  h.window.CREW_CENTER_AUTH_EPOCH = 4;
  assert.equal(h.memberMatchesCurrentSession(member), false);
  h.window.CREW_CENTER_AUTH_EPOCH = 3; h.window.CREW_CENTER_AUTH_USER.id = 'account-b';
  assert.equal(h.memberMatchesCurrentSession(member), false);
});

test('non-owner markers, unresolved identities and visitor sessions cannot claim private member features', () => {
  const h = harness();
  for (const raw of [{ id: 'other', name: 'Alex P.', email: null }, { id: 'other', name: 'Alex P.', email: null, is_current_user: false }]) {
    const member = h.normalizeMember(raw);
    assert.equal(member.directoryActor, ''); assert.equal(h.memberMatchesCurrentSession(member), false);
  }
  assert.equal(h.memberMatchesCurrentSession({ id: 'me', isCurrentUser: true, email: '' }), false, 'an unbound cached flag is insufficient');
  const member = h.normalizeMember({ id: 'me', name: 'Alex P.', is_current_user: true });
  h.isVisitorSession = () => true; assert.equal(h.memberMatchesCurrentSession(member), false);
  h.isVisitorSession = () => false; h.window.CREW_CENTER_AUTH_USER = null;
  assert.equal(h.memberMatchesCurrentSession(member), false);
});

test('legacy unmasked directory records still require an exact signed-in email match', () => {
  const h = harness();
  assert.equal(h.memberMatchesCurrentSession({ id: 'me', email: 'ME@example.test' }), true);
  assert.equal(h.memberMatchesCurrentSession({ id: 'other', email: 'other@example.test' }), false);
});

test('late directory responses are discarded before they can bind an old account marker to a new session', async () => {
  for (const change of [h => { h.window.CREW_CENTER_AUTH_USER.id = 'account-b'; }, h => { h.window.CREW_CENTER_AUTH_EPOCH++; }]) {
    const h = harness(); const applied = []; let finish;
    h.withCrewCenterDataTimeout = operation => operation;
    h.crewCenterDatasetRequest = () => new Promise(resolve => { finish = resolve; });
    h.applyCrewCenterDataset = (...args) => applied.push(args);
    vm.runInContext(extract('loadCrewCenterDatasetBatch'), h);
    const pending = h.loadCrewCenterDatasetBatch(['members'], true); change(h);
    finish({ data: [{ id: 'old-member', is_current_user: true, email: null }] }); await pending;
    assert.equal(applied.length, 0);
  }
});
