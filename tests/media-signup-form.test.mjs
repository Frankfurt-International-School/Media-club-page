import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const core = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const signups = readFileSync(new URL('../scripts/signups.js', import.meta.url), 'utf8');
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const begin = source.slice(start - 6, start) === 'async ' ? start - 6 : start;
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) return source.slice(begin, index + 1);
  }
  throw new Error(`Unclosed ${name}`);
}

function harness({ staff = false, visitor = false, pending, error = null } = {}) {
  const elements = new Map(); const writes = []; const notices = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, dataset: {}, attrs: {}, style: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
      focus() { context.document.activeElement = this; }, scrollIntoView() {},
      contains(target) { return id === 'signup-entry-body' && ['signup-name', 'signup-role', 'signup-submit'].includes(target?.id); },
      querySelector(selector) { return element(`${id}:${selector}`); } });
    return elements.get(id);
  };
  const members = [
    { id: 'me', name: 'Alex Example', email: 'alex.one@example.test', gradeLevel: 'Grade 11', personalEquipmentPreferences: { cameraName: 'Camera One' } },
    { id: 'other', name: 'Alex Example', email: 'alex.two@example.test', gradeLevel: 'Grade 12', personalEquipmentPreferences: { cameraName: 'Camera Two' } },
  ];
  const event = { id: 'game', title: 'Basketball <final>', date: '2030-10-28', time: '12:00', endTime: '14:00', loc: 'Sports Hall', signups: [] };
  let ownMember = members[0];
  const context = vm.createContext({ window: { CREW_CENTER_AUTH_USER: { id: 'account-a' }, matchMedia: () => ({ matches: true }) },
    state: { members, events: [event], currentUser: { name: members[0].name } },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    isVisitorSession: () => visitor, canSignupForOtherMembers: () => staff, currentMemberRecord: () => ownMember,
    setSignupNameHelp: message => { element('signup-name-help').textContent = message; },
    renderSignupCameraSource() {}, paintSignupMemberMatches() {}, renderSignupBookingSummary() {},
    renderSignupSheet() { context.syncMediaSignupDisclosure(event); }, updateReserveRoleFields() {}, loadCrewCenterData: async () => {},
    showToast: message => notices.push(message),
    selectedAttendanceWindow: () => ({ type: 'whole', start: Date.parse('2030-10-28T11:00:00Z'), end: Date.parse('2030-10-28T13:00:00Z'), startTime: '12:00', endTime: '14:00' }),
    timeValue: () => Date.parse('2030-10-28T11:00:00Z'), eventRoleCapacity: () => 2,
    eventAllowsMixingObsReserve: () => false, signupOverlaps: () => true, availableReserveRoleLabels: () => ['CAMERAMAN', 'OBS'],
    signupRoleLabels: { student_supervisor: 'Student Supervisor', mixing: 'MIXING', obs: 'OBS', photographer: 'Photographer', adult_supervisor: 'Adult Supervisor' },
    formatBerlinDateTime: value => String(value),
    fmtDate: value => value, berlinTimeLabel: () => '12:00', attendanceLabel: () => 'Whole time · 12:00–14:00',
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    supabaseClient: { from: () => ({ insert(payload) {
      writes.push(payload);
      return { select: () => ({ single: () => pending || Promise.resolve({ error, data: { ...payload, id: 'saved', signed_up_at: '2030-10-01T10:00:00Z', members: { name: members.find(member => member.id === payload.member_id)?.name } } }) }) };
    } }) },
  });
  const names = ['studentDisplayName', 'personDisplayName', 'snapshotDisplayName', 'normalizedSignupName', 'matchingSignupMembers', 'selectedMediaSignupMember', 'validateSignupNameInput', 'signupMemberForEquipmentPreference', 'clearSignupNameValidation', 'selectMediaSignupMember'];
  const formNames = ['activeCrewSignups', 'syncMediaSignupDisclosure', 'toggleMediaSignupForm', 'showSignupFormError', 'clearSignupFormErrors', 'setMediaSignupBusy', 'renderSignupBookingSummary', 'addSignupRow'];
  vm.runInContext(`let mediaSignupSaveInFlight = false; let mediaSignupDisclosure = { actor: '', eventId: '', signupIds: [], expanded: true };\n${names.map(name => extract(core, name)).join('\n')}\n${formNames.map(name => extract(signups, name)).join('\n')}`, context);
  element('sheet-event-select').value = 'game'; element('signup-name').value = 'Alex Example';
  element('signup-role').value = 'CAMERAMAN'; element('signup-confirmation').value = 'confirmed';
  return { context, element, writes, notices, event, ownMember(value) { ownMember = value; } };
}

test('self-signup uses the linked member ID even when another member has the same name', async () => {
  const h = harness(); await h.context.addSignupRow();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].member_id, 'me');
  assert.equal(h.event.signups[0].memberId, 'me');
});

test('changing a self-signup name or selected ID cannot assign another member', async () => {
  const h = harness(); h.element('signup-name').value = 'Someone else'; h.element('signup-name').dataset.memberId = 'other';
  await h.context.addSignupRow();
  assert.equal(h.writes[0].member_id, 'me');
});

test('an unselected production role cannot create a signup', async () => {
  const h = harness(); h.element('signup-role').value = '';
  await h.context.addSignupRow();
  assert.equal(h.writes.length, 0);
  assert.match(h.element('signup-role-error').textContent, /choose an available role/);
});

test('staff choose duplicate-name members by record ID and equipment follows that member', async () => {
  const h = harness({ staff: true });
  h.context.selectMediaSignupMember('other');
  assert.equal(h.context.signupMemberForEquipmentPreference().personalEquipmentPreferences.cameraName, 'Camera Two');
  await h.context.addSignupRow();
  assert.equal(h.writes[0].member_id, 'other');
});

test('staff cannot submit an unmatched or removed selection, and visitors make no write', async () => {
  const unmatched = harness({ staff: true }); await unmatched.context.addSignupRow();
  assert.equal(unmatched.writes.length, 0);
  const removed = harness({ staff: true });
  removed.element('signup-name').dataset.memberId = 'removed'; await removed.context.addSignupRow();
  assert.equal(removed.writes.length, 0);
  const visitor = harness({ visitor: true }); await visitor.context.addSignupRow();
  assert.equal(visitor.writes.length, 0);
  const missing = harness(); missing.ownMember(null); await missing.context.addSignupRow();
  assert.equal(missing.writes.length, 0);
});

test('a partial name or email search distinguishes the two member records', () => {
  const h = harness({ staff: true });
  assert.equal(h.context.matchingSignupMembers('alex').length, 2);
  assert.equal(h.context.matchingSignupMembers('two@example').length, 1);
});

test('the booking summary escapes the event title and shows time, commitment and the selected camera', () => {
  const h = harness(); h.element('signup-role').value = 'Photographer';
  h.element('signup-camera-source-select').value = 'own'; h.element('signup-confirmation').value = 'maybe';
  h.context.renderSignupBookingSummary();
  const summary = h.element('signup-booking-details').innerHTML;
  assert.match(summary, /Basketball &lt;final&gt;/);
  assert.match(summary, /Whole time · 12:00–14:00/);
  assert.match(summary, /Camera One/);
  assert.match(summary, /Maybe/);
  assert.match(summary, /confirm by/i);
});

test('invalid arrival and leaving times show inline feedback without making a write', async () => {
  const h = harness(); h.context.selectedAttendanceWindow = () => null;
  h.element('signup-attendance').value = 'custom'; await h.context.addSignupRow();
  assert.equal(h.writes.length, 0);
  assert.match(h.element('signup-submit-status').textContent, /arrival and leaving/i);
  assert.equal(h.element('signup-start-time').getAttribute('aria-invalid'), 'true');
});

test('the review switches to Confirmed when the Maybe deadline closes on refresh', () => {
  const h = harness();
  h.element('signup-confirmation').value = 'maybe';
  h.context.timeValue = () => Date.now() + 60 * 60 * 1000;
  Object.assign(h.context, {
    refreshMediaSignupSacLinks() {}, renderSignupAttendanceOptions() {}, updateSignupAttendanceFields() {},
    renderSignupNameField: () => h.context.renderSignupBookingSummary(), scheduleReserveActivation() {},
    eventScheduleTimeLabel: () => '12:00–14:00', sportsScheduleCaption: () => '', isstScheduleCaption: () => '', festivalScheduleCaption: () => '',
    signupSheetPeriods: () => [], selectedSignupSheetPeriod: () => null, renderSignupSheetPeriodPicker() {},
    activeReserveAssignments: () => new Map(), reserveActivationAt: () => null,
  });
  h.context.document.querySelector = () => h.element('maybe-option');
  vm.runInContext(extract(signups, 'renderSignupSheet'), h.context);
  h.context.renderSignupSheet();
  assert.equal(h.element('signup-confirmation').value, 'confirmed');
  assert.equal(h.element('maybe-option').disabled, true);
  assert.doesNotMatch(h.element('signup-booking-details').innerHTML, /Maybe/);
  assert.match(h.element('signup-booking-details').innerHTML, /Confirmed/);
  assert.equal(h.element('signup-submit-label').textContent, 'Confirm signup');
});

test('a pending save disables repeat submission and successful booking restores the button', async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const h = harness({ pending: waiting });
  const first = h.context.addSignupRow(); const second = h.context.addSignupRow();
  try {
    assert.equal(h.writes.length, 1); assert.equal(h.element('signup-submit').disabled, true);
  } finally {
    release({ data: { ...h.writes[0], id: 'saved', signed_up_at: '2030-10-01T10:00:00Z', members: { name: 'Alex Example' } }, error: null });
    await Promise.all([first, second]);
  }
  assert.equal(h.element('signup-submit').disabled, false);
  assert.equal(h.event.signups.length, 1);
});

test('failed saves retain the chosen member and report a safe retry message', async () => {
  const h = harness({ staff: true, error: { code: '42501', message: 'Private database detail' } });
  h.context.selectMediaSignupMember('other'); await h.context.addSignupRow();
  assert.equal(h.element('signup-name').dataset.memberId, 'other');
  assert.match(h.element('signup-submit-status').textContent, /couldn't save/i);
  assert.doesNotMatch(h.element('signup-submit-status').textContent, /Private database detail/);
  assert.equal(h.element('signup-submit').disabled, false);
});

test('only the current member’s active signup condenses the selected event form', () => {
  const h = harness();
  h.event.signups = [{ id: 'other', memberId: 'other' }, { id: 'expired', memberId: 'me', confirmationStatus: 'expired' },
    { id: 'elapsed', memberId: 'me', confirmationStatus: 'maybe', confirmationDeadline: '2000-01-01' }];
  h.context.syncMediaSignupDisclosure(h.event);
  assert.equal(h.element('signup-entry-body').inert, false);
  assert.equal(h.element('signup-form-toggle').hidden, true);
  h.event.signups.push({ id: 'mine', memberId: 'me', role: 'CAMERAMAN', confirmationStatus: 'maybe', confirmationDeadline: '2099-01-01' });
  h.context.syncMediaSignupDisclosure(h.event);
  assert.equal(h.element('signup-entry-body').inert, true);
  assert.equal(h.element('signup-form-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(h.element('signup-entry-title').textContent, 'You’re signed up');
  assert.match(h.element('signup-entry-subtitle').textContent, /CAMERAMAN.*Maybe.*confirm/);
});

test('reopening preserves choices across updates, and closing restores focus outside the inert form', () => {
  const h = harness(); h.event.signups.push({ id: 'mine', memberId: 'me', role: 'CAMERAMAN' });
  h.context.syncMediaSignupDisclosure(h.event); h.context.toggleMediaSignupForm();
  assert.equal(h.element('signup-entry-body').inert, false);
  h.context.syncMediaSignupDisclosure(h.event);
  assert.equal(h.element('signup-form-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(h.element('signup-role').value, 'CAMERAMAN');
  h.context.document.activeElement = h.element('signup-role'); h.context.toggleMediaSignupForm();
  assert.equal(h.context.document.activeElement, h.element('signup-form-toggle'));
  assert.equal(h.element('signup-entry-body').getAttribute('aria-hidden'), 'true');
  h.context.toggleMediaSignupForm(true);
  assert.equal(h.element('signup-entry-body').inert, false);
});

test('removing the last signup opens the form, and event or session changes reset manual disclosure', () => {
  const h = harness(); h.event.signups.push({ id: 'mine', memberId: 'me' });
  h.context.syncMediaSignupDisclosure(h.event); h.context.toggleMediaSignupForm();
  h.context.window.CREW_CENTER_AUTH_EPOCH = 2; h.context.syncMediaSignupDisclosure(h.event);
  assert.equal(h.element('signup-entry-body').inert, true);
  h.element('signup-submit-status').textContent = 'Saved for the previous event';
  h.context.syncMediaSignupDisclosure({ id: 'another', signups: [] });
  assert.equal(h.element('signup-entry-body').inert, false);
  assert.equal(h.element('signup-submit-status').textContent, '');
  h.context.syncMediaSignupDisclosure(h.event);
  assert.equal(h.element('signup-entry-body').inert, true);
  h.event.signups = []; h.context.syncMediaSignupDisclosure(h.event);
  assert.equal(h.element('signup-entry-body').inert, false);
  assert.equal(h.element('signup-form-toggle').hidden, true);
});

test('a successful self-booking condenses the form but keeps saved feedback focusable', async () => {
  const h = harness(); h.context.syncMediaSignupDisclosure(h.event);
  h.context.document.activeElement = h.element('signup-submit');
  await h.context.addSignupRow();
  assert.equal(h.element('signup-entry-body').inert, true);
  assert.equal(h.element('signup-form-toggle').disabled, false);
  assert.equal(h.context.document.activeElement, h.element('signup-submit-status'));
  assert.match(h.element('signup-submit-status').textContent, /saved.*crew sheet/);
});

test('an additional booking failure keeps the reopened form and choices available', async () => {
  const h = harness({ error: { code: '42501' } });
  h.event.signups.push({ id: 'mine', memberId: 'me', role: 'Photographer' });
  h.context.syncMediaSignupDisclosure(h.event); h.context.toggleMediaSignupForm();
  await h.context.addSignupRow();
  assert.equal(h.element('signup-entry-body').inert, false);
  assert.equal(h.element('signup-role').value, 'CAMERAMAN');
  assert.match(h.element('signup-submit-status').textContent, /couldn't save/i);
});
