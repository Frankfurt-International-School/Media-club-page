import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../scripts/${name}.js`, import.meta.url), 'utf8');
const core = read('core'), signups = read('signups'), equipment = read('equipment'), sac = read('sac-events');
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const begin = source.slice(start - 6, start) === 'async ' ? start - 6 : start;
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) return source.slice(begin, index + 1);
  }
  throw new Error(`Unclosed ${name}`);
}
const start = Date.parse('2030-10-28T12:00:00Z'), end = start + 3600000;
const window = { start, end, valid: true };
const booking = (role, from = start, to = end, extra = {}) => ({ role, attendanceStart: new Date(from).toISOString(), attendanceEnd: new Date(to).toISOString(), confirmationStatus: 'confirmed', ...extra });

function crewHarness() {
  const context = vm.createContext({
    signupRoleLabels: { photographer: 'Photographer', obs: 'OBS' },
    eventRoleCapacity: (_, role) => role === 'Photographer' ? 2 : 1,
    eventOpenRoleLabels: () => ['Photographer', 'OBS'], currentUserSignupRoleKeys: () => ['photographer', 'obs'],
    timeValue: (date, time) => Date.parse(`${date}T${time}:00Z`),
    pageUrl: (_, params) => `/signups?${new URLSearchParams(params)}`, URLSearchParams,
  });
  vm.runInContext([extract(core, 'signupOverlaps'), ...['activeCrewSignups', 'crewRoleCoverage', 'signupAttendanceChoices', 'signupChoiceWindow', 'signupRoleAvailability', 'crewEventOpportunity'].map(name => extract(signups, name))].join('\n'), context);
  return context;
}

test('partial and adjacent signups measure confirmed coverage across the entire period', () => {
  const h = crewHarness();
  const event = { signups: [booking('OBS', start, start + 1800000)] };
  assert.equal(h.crewRoleCoverage(event, 'OBS', window, start - 1).confirmed, 0);
  assert.equal(h.crewRoleCoverage(event, 'OBS', window, start - 1).open, 0, 'do not advertise a whole-period slot the booking rules reject');
  event.signups.push(booking('OBS', start + 1800000, end));
  assert.equal(h.crewRoleCoverage(event, 'OBS', window, start - 1).confirmed, 1);
});

test('Maybe holds use capacity but never count as confirmed coverage; expired holds free capacity', () => {
  const h = crewHarness();
  const event = { signups: [booking('Photographer'), booking('Photographer', start, end, { confirmationStatus: 'maybe', confirmationDeadline: new Date(start).toISOString() })] };
  const held = h.crewRoleCoverage(event, 'Photographer', window, start - 1);
  assert.equal(held.open, 0); assert.equal(held.confirmed, 1); assert.equal(held.pending, 1);
  const expired = h.crewRoleCoverage(event, 'Photographer', window, start);
  assert.equal(expired.open, 1); assert.equal(expired.pending, 0);
  h.Date = class extends Date { static now() { return start; } };
  assert.equal(h.signupRoleAvailability(event, window).find(role => role.role === 'Photographer').open, 1, 'the booking form and opening hint agree at the expiry boundary');
});

test('an opening links to an eligible role and the correct game, with separate Maybe counts', () => {
  const h = crewHarness();
  const event = { id: 'game', date: '2030-10-28', time: '12:00', isSports: true, game1Start: '12:00', game1End: '13:00', game2Start: '14:00', game2End: '15:00', signups: [booking('Photographer'), booking('OBS', start, end, { confirmationStatus: 'maybe' })] };
  const opportunity = h.crewEventOpportunity(event, start - 1);
  const params = new URL(opportunity.href, 'https://fixture.test').searchParams;
  assert.equal(opportunity.open, 1); assert.equal(opportunity.confirmed, 1); assert.equal(opportunity.pending, 1);
  assert.equal(params.get('attendance'), 'game_1'); assert.equal(params.get('role'), 'Photographer');
  h.currentUserSignupRoleKeys = () => ['obs'];
  assert.equal(new URL(h.crewEventOpportunity(event, start - 1).href, 'https://fixture.test').searchParams.get('attendance'), 'game_2');
});

test('past periods and closed event roles are never advertised as bookable', () => {
  const h = crewHarness(); h.eventOpenRoleLabels = () => [];
  assert.equal(h.crewEventOpportunity({ date: '2030-10-28', time: '12:00', endTime: '13:00', signups: [] }, end + 1).label, '');
});

test('a stale opening link never silently selects a different role', () => {
  const disclosures = [];
  const nodes = new Map([['signup-attendance', { value: 'game_2', options: [{ value: 'game_1', disabled: true }, { value: 'game_2' }] }], ['signup-role', { value: 'Photographer', options: [{ value: 'OBS', disabled: true }, { value: 'Photographer' }] }], ['signup-role-availability', {}], ['signup-attendance-guidance', {}]]);
  const h = vm.createContext({ URLSearchParams, state: { events: [{ id: 'game' }] }, document: { getElementById: id => nodes.get(id) }, window: { location: { search: '?event=game&attendance=game_1&role=OBS' }, CREW_CENTER_AUTH_USER: { id: 'me' } }, toggleMediaSignupForm: expanded => disclosures.push(expanded), updateSignupAttendanceFields() {}, updateReserveRoleFields() {}, renderSignupBookingSummary() {} });
  vm.runInContext(`let appliedSignupIntent='';\n${extract(signups, 'applySignupIntent')}`, h);
  h.applySignupIntent(); assert.equal(nodes.get('signup-role').value, '');
  assert.match(nodes.get('signup-role-availability').textContent, /opening has changed/);
  assert.match(nodes.get('signup-attendance-guidance').textContent, /no longer available/);
  assert.deepEqual(disclosures, [true], 'opening links reveal the form even when an earlier signup condensed it');
});

test('SAC openings ignore cancelled bookings and count each physical spot once', () => {
  const slots = [{ start: new Date(start).toISOString(), end: new Date(end).toISOString() }];
  const h = vm.createContext({ generateSacSlots: () => slots, sacBookingMatchesSlot: () => true });
  vm.runInContext(extract(sac, 'sacEventOpening'), h);
  const rows = [{ event_id: 'sac', spot_number: 1 }, { event_id: 'sac', spot_number: 1 }, { event_id: 'sac', spot_number: 2, cancelled_at: '2030-10-01' }, { event_id: 'other', spot_number: 2 }];
  assert.equal(h.sacEventOpening({ id: 'sac', scoreboard_spots: 2 }, rows, start).open, 1);
  assert.equal(h.sacEventOpening({ id: 'sac' }, rows, end).slots, 0);
  assert.equal(h.sacEventOpening({ id: 'sac' }, null), null, 'failed availability is not zero bookings');
});

function equipmentHarness() {
  const member = { id: 'me', gradeLevel: 'Grade 11' };
  const h = vm.createContext({
    state: { equipment: [], events: [] }, window: { CREW_CENTER_AUTH_USER: { id: 'account' }, CREW_CENTER_AUTH_EPOCH: 1 },
    currentMemberRecord: () => member, isVisitorSession: () => false, canAccessAdminPanel: () => false,
    signupRoleLabels: { photographer: 'Photographer' }, isPastEvent: () => false,
    pageUrl: (_, params) => `/signups?${new URLSearchParams(params)}`, localTimeFromIso: value => value,
    timeValue: (date, time) => Date.parse(`${date}T${time}:00Z`), URLSearchParams,
  });
  const names = ['equipmentBookingActor', 'reservationLifecycleStatus', 'activeEquipmentReservation', 'equipmentDisplayStatus', 'equipmentStatusLabel', 'reservationOverlaps', 'equipmentWindowAvailability', 'isCameraEquipment', 'activePhotographerSignup', 'cameraReservationEvents', 'memberGradeNumber', 'canReserveOutsideEvent', 'equipmentWindowEligibility'];
  vm.runInContext(names.map(name => extract(equipment, name)).join('\n'), h);
  return { h, member };
}

test('selected time rejects overlapping reservations and allows adjacent reservations', () => {
  const { h } = equipmentHarness();
  const item = { status: 'available', reservations: [{ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), status: 'scheduled' }] };
  assert.equal(h.equipmentWindowAvailability(item, window).available, false);
  assert.equal(h.equipmentWindowAvailability(item, { ...window, start: end, end: end + 3600000 }).available, true);
  item.reservations[0].status = 'returned';
  assert.equal(h.equipmentWindowAvailability(item, window).available, false, 'match the database overlap constraint even for early returns');
});

test('on-loan and unavailable devices remain blocked; incomplete times never report availability', () => {
  const { h } = equipmentHarness();
  assert.equal(h.equipmentWindowAvailability({ status: 'unavailable', reservations: [] }, window).available, false);
  assert.equal(h.equipmentWindowAvailability({ status: 'available', reservations: [] }, { valid: false }).available, false);
  const now = Date.now();
  const loan = { startsAt: new Date(now - 3600000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), status: 'checked_out' };
  assert.equal(h.equipmentWindowAvailability({ status: 'checked_out', reservations: [loan] }, window).available, false);
});

test('camera eligibility links to Photographer signup and enforces its saved attendance window', () => {
  const { h } = equipmentHarness();
  const event = { id: 'game', signups: [] }, camera = { category: 'Camera' };
  assert.equal(h.equipmentWindowEligibility(camera, { ...window, event }).allowed, false);
  assert.match(h.equipmentWindowEligibility(camera, { ...window, event }).href, /event=game/);
  event.signups.push({ ...booking('Photographer'), memberId: 'me' });
  assert.equal(h.equipmentWindowEligibility(camera, { ...window, event }).allowed, true);
  assert.equal(h.equipmentWindowEligibility(camera, { ...window, start: start - 1, event }).allowed, false);
  event.signups.push({ ...booking('Photographer', end + 3600000, end + 7200000), memberId: 'me' });
  assert.equal(h.equipmentWindowEligibility(camera, { ...window, start: end + 3600000, end: end + 7200000, event }).allowed, true, 'any matching Photographer signup may authorize its own period');
  event.signups[0].confirmationStatus = 'expired';
  assert.equal(h.equipmentWindowEligibility(camera, { ...window, event }).allowed, false);
});

test('outside-event camera rules and visitor restrictions apply to browse hints too', () => {
  const { h, member } = equipmentHarness(); const camera = { category: 'Camera' };
  member.gradeLevel = 'Grade 10'; assert.equal(h.equipmentWindowEligibility(camera, window).allowed, false);
  member.gradeLevel = 'Grade 12'; assert.equal(h.equipmentWindowEligibility(camera, window).allowed, true);
  h.isVisitorSession = () => true; assert.equal(h.equipmentWindowEligibility({ category: 'Microphone' }, window).allowed, false);
});

function saveHarness() {
  const { h } = equipmentHarness(); const nodes = new Map(), writes = [], added = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, textContent: '', setAttribute() {} });
    return nodes.get(id);
  };
  let finish;
  const pending = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  h.document = { getElementById: node, querySelector: () => null };
  h.canAccessMediaWorkspace = () => true; h.isVisitorSession = () => false;
  h.renderReservationLensOptions = () => {}; h.closeModal = () => added.push('closed'); h.renderEquipment = () => {};
  h.addEquipmentReservationToState = data => added.push(data.id); h.showToast = () => {};
  h.supabaseClient = { from: () => ({ insert: payload => { writes.push(payload); return { select: () => ({ single: () => pending }) }; } }) };
  h.state.equipment = [{ id: 'mic', category: 'Microphone', status: 'available', reservations: [] }];
  node('reserve-type').value = 'non_event'; node('reserve-date').value = '2030-10-28'; node('reserve-start').value = '12:00'; node('reserve-end').value = '13:00'; node('reserve-purpose').value = 'School recording';
  vm.runInContext(`let reservingEquipmentId='mic'; let equipmentReservationInFlight=false;\n${extract(equipment, 'equipmentReservationFeedback')}\n${extract(equipment, 'reserveEquipment')}`, h);
  return { h, node, writes, added, finish };
}

test('a failed equipment save restores controls, preserves choices, and allows retry without duplicate writes', async () => {
  const s = saveHarness(); const first = s.h.reserveEquipment(); await s.h.reserveEquipment();
  assert.equal(s.writes.length, 1); assert.equal(s.node('equipment-reservation-fields').disabled, true);
  s.finish.reject(new Error('Network dropped')); await first;
  assert.equal(s.node('reserve-equipment-submit').disabled, false); assert.equal(s.node('equipment-reservation-fields').disabled, false);
  assert.equal(s.node('reserve-purpose').value, 'School recording'); assert.match(s.node('reserve-equipment-status').textContent, /choices are kept/i);
  assert.deepEqual(s.added, []);
});

test('delayed equipment save from another account is never displayed in the new account', async () => {
  const s = saveHarness(); const pending = s.h.reserveEquipment(); s.h.window.CREW_CENTER_AUTH_USER.id = 'other';
  s.finish.resolve({ data: { id: 'saved' }, error: null }); await pending;
  assert.deepEqual(s.added, []); assert.equal(s.node('reserve-equipment-submit').disabled, false);
});
