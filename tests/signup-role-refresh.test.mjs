import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const core = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const render = core.slice(core.indexOf('function renderSignupRoleOptions('), core.indexOf('\nfunction availableReserveRoleLabels('));

function harness() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', style: { setProperty() {} }, classList: { toggle() {} } });
    return nodes.get(id);
  };
  const select = node('signup-role'); let html = '';
  select.options = []; select.value = 'OBS';
  Object.defineProperty(select, 'innerHTML', {
    get: () => html,
    set(value) {
      html = value;
      select.options = [...value.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(match => ({ value: match[1], disabled: /\bdisabled\b/.test(match[2]), selected: /\bselected\b/.test(match[2]) }));
      select.value = (select.options.find(option => option.selected) || select.options.find(option => !option.disabled))?.value || '';
    },
  });
  const event = { id: 'event', signups: [], roles: ['MIXING', 'OBS', 'Photographer'] };
  const context = vm.createContext({
    document: { getElementById: node },
    selectedAttendanceWindow: () => ({ start: 10, end: 20 }),
    eventOpenRoleLabels: ev => ev?.roles || [], currentUserSignupRoleKeys: () => ['mixing', 'obs', 'photographer'],
    signupRoleLabels: { mixing: 'MIXING', obs: 'OBS', photographer: 'Photographer' },
    signupOverlaps: signup => signup.start < 20 && signup.end > 10,
    eventRoleCapacity: (_, role) => role === 'Photographer' ? 2 : 1,
    berlinTimeLabel: value => value, renderSignupCameraSource() {}, updateReserveRoleFields() {},
  });
  vm.runInContext(render, context);
  return { context, select, event, node, render: () => context.renderSignupRoleOptions(event) };
}

test('a role taken during refresh requires a new explicit choice and stays unselected', () => {
  const h = harness(); h.event.signups.push({ role: 'OBS', start: 10, end: 20, attendanceEnd: '13:00' });
  h.render();
  assert.equal(h.select.value, '');
  assert.equal(h.select.options.find(option => option.value === 'OBS').disabled, true);
  assert.match(h.node('signup-role-availability').textContent, /OBS.*Choose another role/);
  h.render(); assert.equal(h.select.value, '', 'A later refresh must not choose a replacement');
});

test('an available choice survives refreshes and adjacent bookings do not displace it', () => {
  const h = harness(); h.event.signups.push({ role: 'OBS', start: 20, end: 30 });
  h.render(); assert.equal(h.select.value, 'OBS');
  h.select.value = 'Photographer';
  h.event.signups.push({ role: 'Photographer', start: 10, end: 20 });
  h.render(); assert.equal(h.select.value, 'Photographer');
  assert.equal(h.node('signup-role-availability').textContent, '');
});

test('closed or unauthorized roles are not silently replaced by another open role', () => {
  const h = harness(); h.event.roles = ['MIXING']; h.render();
  assert.equal(h.select.value, '');
  assert.ok(!h.select.options.some(option => option.value === 'OBS'));
  const restricted = harness(); restricted.context.currentUserSignupRoleKeys = () => ['mixing']; restricted.render();
  assert.equal(restricted.select.value, '');
  assert.ok(!restricted.select.options.some(option => option.value === 'OBS'));
});

test('a fully occupied time has no replacement role and explains how to proceed', () => {
  const h = harness(); h.select.value = '';
  h.event.signups = ['MIXING', 'OBS', 'Photographer', 'Photographer'].map(role => ({ role, start: 10, end: 20 }));
  h.render();
  assert.equal(h.select.value, '');
  assert.ok(h.select.options.every(option => option.disabled));
  assert.match(h.node('signup-role-availability').textContent, /All production roles are occupied/);
});

test('a new signup requires a role choice while role-free festival periods remain role-free', () => {
  const h = harness(); h.select.value = ''; h.render();
  assert.equal(h.select.value, '');
  assert.match(h.select.innerHTML, /Choose a production role/);
  h.event.isFestival = true; h.node('signup-attendance').value = 'setup'; h.render();
  assert.equal(h.select.value, '');
  assert.match(h.select.innerHTML, /No role required/);
  assert.equal(h.node('signup-role-availability').textContent, '');
});
