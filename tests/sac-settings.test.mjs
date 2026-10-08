import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ui = read('scripts/ui.js');
const settingsPath = new URL('../scripts/sac-settings.js', import.meta.url);
const settings = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : '';
const profileSource = ui.slice(ui.indexOf('function renderProfile('), ui.indexOf('function showSettingsSection('));

function harness() {
  const stored = new Map(); const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, style: {}, classList: { contains: () => false }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; } });
    return elements.get(id);
  };
  let workspace = 'sac'; let member = { id: 'member-a', name: 'Jane Example', teamKeys: ['sac'], gradeLevel: 'Grade 11', sacTitle: 'vice_president' };
  const context = vm.createContext({ window: { CREW_CENTER_AUTH_USER: { id: 'account-a' } },
    document: { getElementById: element, addEventListener() {} }, localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    state: { dataLoaded: { members: true }, currentUser: { name: 'Jane Example', avatarUrl: '', isAdmin: false } },
    currentCrewCenterWorkspace: () => workspace, canAccessSacWorkspace: () => true, isVisitorSession: () => false,
    currentMemberRecord: () => member, sacTitleLabel: () => 'SAC Vice President',
    updateUserSurfaces() {}, updateThemeChoices() {}, renderDashboardSettings() {}, renderSidebarSettings() {}, renderNotificationSettings() {}, renderPersonalEquipmentSettings() {},
    renderProfileWorkspace() {}, renderSacDashboardSettings() {}, updateDashboardGreeting() {}, renderSacPersonalDashboard() {},
    tabValueFromUrl: () => 'profile', showSettingsSection() {},
  });
  vm.runInContext(settings, context);
  return { context, stored, element, workspace(value) { workspace = value; }, member(value) { member = value; } };
}

test('SAC settings keep account controls and hide Media-only settings without changing Media Club tabs', () => {
  const h = harness(); vm.runInContext(profileSource, h.context);
  h.context.renderProfile();
  for (const id of ['settings-tab-personalisation', 'settings-tab-sidebar', 'settings-tab-notifications', 'tutorial-settings-tab']) assert.equal(h.element(id).style.display, 'none', `${id} is Media-only`);
  assert.equal(h.element('dashboard-settings-tab').style.display, '');
  h.workspace('media'); h.context.renderProfile();
  assert.equal(h.element('settings-tab-personalisation').style.display, '');
  assert.equal(h.element('settings-tab-notifications').style.display, '');
});

test('SAC dashboard preferences validate browser data and stay separate for each account', () => {
  const h = harness();
  assert.deepEqual(JSON.parse(JSON.stringify(h.context.sacDashboardPreferences())), { showName: true, showActivities: true });
  const key = h.context.sacDashboardPreferenceKey();
  h.stored.set(key, JSON.stringify({ showName: false, showActivities: 'false' }));
  assert.equal(h.context.sacDashboardPreferences().showName, false);
  assert.equal(h.context.sacDashboardPreferences().showActivities, true);
  h.context.window.CREW_CENTER_AUTH_USER.id = 'account-b';
  assert.equal(h.context.sacDashboardPreferences().showName, true);
  h.stored.set(h.context.sacDashboardPreferenceKey(), '{invalid');
  assert.equal(h.context.sacDashboardPreferences().showName, true);
});

test('saving SAC dashboard controls stores display preferences without a database write', () => {
  const h = harness();
  h.element('sac-setting-show-name').setAttribute('aria-checked', 'false');
  h.element('sac-setting-show-activities').setAttribute('aria-checked', 'true');
  h.context.saveSacDashboardPreferences();
  assert.equal(h.context.sacDashboardPreferences().showName, false);
  assert.match(h.element('sac-settings-save-status').textContent, /saved.*browser/i);
  h.workspace('media'); h.stored.clear(); h.context.saveSacDashboardPreferences();
  assert.equal(h.stored.size, 0);
  h.workspace('sac'); h.member(null); h.context.saveSacDashboardPreferences();
  assert.equal(h.stored.size, 0);
});

test('blocked browser storage reports an error instead of claiming preferences were saved', () => {
  const h = harness();
  h.context.localStorage.setItem = () => { throw new Error('Blocked'); };
  h.context.saveSacDashboardPreferences();
  assert.match(h.element('sac-settings-save-status').textContent, /could not save/i);
  assert.equal(h.stored.size, 0);
});
