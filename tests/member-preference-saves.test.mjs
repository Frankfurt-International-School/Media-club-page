import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const ui = readFileSync(new URL('../scripts/ui.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const identity = core.match(/function memberMatchesCurrentSession\([\s\S]*?\n\}/)[0];
const source = ui.slice(ui.indexOf('function currentNotificationPreferences'), ui.indexOf('function ownUpcomingSignups'));
const features = [
  { save: 'saveNotificationPreferences', render: 'renderNotificationSettings', button: 'notification-preference-save', label: 'Save notifications', field: 'notificationPreferences' },
  { save: 'savePersonalEquipmentPreferences', render: 'renderPersonalEquipmentSettings', button: 'personal-equipment-save', label: 'Save personal kit', field: 'personalEquipmentPreferences' },
];

function harness() {
  const elements = new Map(); const calls = []; const notices = []; const renders = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, disabled: false, textContent: '', innerHTML: '', classList: { toggle() {} } });
    return elements.get(id);
  };
  const original = () => ({ notificationPreferences: { event_created: true, email_event_updates: false }, personalEquipmentPreferences: { cameraName: 'Original camera', autoUseCamera: false } });
  let member = { id: 'member-a', isCurrentUser: true, directoryActor: 'account-a:1', email: '', ...original() };
  let response = () => ({ data: true, error: null });
  let deadline = operation => operation;
  const context = vm.createContext({
    window: { CREW_CENTER_AUTH_USER: { id: 'account-a', email: 'ax1234@fis.edu' }, CREW_CENTER_AUTH_EPOCH: 1 },
    document: { getElementById: element }, currentMemberRecord: () => member, isVisitorSession: () => false,
    supabaseClient: { rpc: (name, args) => { calls.push({ name, args }); return response(); } },
    withCrewCenterDataTimeout: (...args) => deadline(...args),
    renderNotificationCenter: () => renders.push('notifications'), renderSignupCameraSource: () => renders.push('camera'),
    showToast: (...args) => notices.push(args), escapeHtml: value => String(value || ''),
  });
  vm.runInContext(identity + '\n' + source, context);
  element('notify-email-event-updates').checked = true;
  element('personal-camera-name').value = 'New camera'; element('personal-camera-auto-use').checked = true;
  return { context, element, calls, notices, renders, member: () => member,
    response: fn => { response = fn; }, deadline: fn => { deadline = fn; },
    switchAccount() { context.window.CREW_CENTER_AUTH_USER = { id: 'account-b', email: 'bx1234@fis.edu' }; member = { id: 'member-b', isCurrentUser: true, directoryActor: 'account-b:1', email: '', ...original() }; },
  };
}

for (const feature of features) {
  test(`${feature.label}: rejected requests recover the button, preserve the draft, and allow retry`, async () => {
    const h = harness(); h.response(() => Promise.reject(new Error('Offline')));
    await assert.doesNotReject(h.context[feature.save]());
    assert.equal(h.element(feature.button).disabled, false); assert.equal(h.element(feature.button).textContent, feature.label);
    assert.match(h.notices.at(-1)[0], /try again/i); assert.equal(h.notices.at(-1)[1], 'error');
    assert.equal(h.element('notify-email-event-updates').checked, true); assert.equal(h.element('personal-camera-name').value, 'New camera');
    assert.equal(h.renders.length, 0);
    h.response(() => ({ data: true, error: null })); await h.context[feature.save]();
    assert.equal(h.calls.length, 2); assert.ok(h.renders.length);
  });

  test(`${feature.label}: late results cannot apply the previous account's preferences or feedback`, async () => {
    for (const change of [h => h.switchAccount(), h => { h.context.window.CREW_CENTER_AUTH_EPOCH++; h.member().directoryActor = 'account-a:2'; }]) {
      const h = harness(); let finish; h.response(() => new Promise(resolve => { finish = resolve; }));
      const pending = h.context[feature.save](); change(h); const before = structuredClone(h.member()[feature.field]);
      finish({ data: true, error: null }); await pending;
      assert.deepEqual(h.member()[feature.field], before); assert.equal(h.notices.length, 0); assert.equal(h.renders.length, 0);
    }
  });

  test(`${feature.label}: duplicate saves send one request and do not clobber a newer account's button`, async () => {
    const h = harness(); const finishes = []; h.response(() => new Promise(resolve => finishes.push(resolve)));
    const first = h.context[feature.save](); const duplicate = h.context[feature.save]();
    assert.equal(h.calls.length, 1); assert.equal(h.element(feature.button).disabled, true);
    h.switchAccount(); h.context[feature.render](); assert.equal(h.element(feature.button).disabled, false);
    const secondAccount = h.context[feature.save](); assert.equal(h.calls.length, 2);
    finishes[0]({ data: true }); await first; await duplicate;
    assert.equal(h.element(feature.button).disabled, true); assert.equal(h.notices.length, 0);
    finishes[1]({ data: true }); await secondAccount;
    assert.equal(h.element(feature.button).disabled, false); assert.equal(h.notices.length, 1);
  });

  test(`${feature.label}: visitors, mismatched members, and signed-out users cannot save`, async () => {
    for (const change of [h => { h.context.isVisitorSession = () => true; }, h => { h.member().directoryActor = 'other-account:1'; }, h => { h.context.window.CREW_CENTER_AUTH_USER = null; }]) {
      const h = harness(); change(h); await h.context[feature.save]();
      assert.equal(h.calls.length, 0); assert.equal(h.notices.length, 0);
    }
  });

  test(`${feature.label}: returned RPC errors and deadlines keep retry available without SQL instructions`, async () => {
    for (const setup of [h => h.response(() => ({ data: null, error: { message: 'Unavailable' } })), h => h.deadline(() => Promise.reject(new Error('Timeout')))]) {
      const h = harness(); setup(h); await assert.doesNotReject(h.context[feature.save]());
      assert.equal(h.element(feature.button).disabled, false); assert.equal(h.renders.length, 0);
      assert.match(h.notices.at(-1)[0], /connection|try again/i); assert.doesNotMatch(h.notices.at(-1)[0], /SQL|Supabase/i);
    }
  });

  test(`${feature.label}: rendering while saving preserves the pending draft and saving indicator`, async () => {
    const h = harness(); let finish; h.response(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.context[feature.save](); h.context[feature.render]();
    assert.equal(h.element('notify-email-event-updates').checked, true); assert.equal(h.element('personal-camera-name').value, 'New camera');
    assert.equal(h.element(feature.button).disabled, true); assert.equal(h.element(feature.button).textContent, 'Saving…');
    finish({ data: true }); await pending;
  });
}
