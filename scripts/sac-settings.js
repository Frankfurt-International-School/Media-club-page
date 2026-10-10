// SAC display choices are per account on this browser; membership remains server-managed.
const sacInterfaceModes = ['athletics', 'classic'];
const sacInterfaceSessionChoices = new Map();

function sacInterfacePreferenceKey() {
  const accountId = window.CREW_CENTER_AUTH_USER?.id || currentMemberRecord()?.id;
  return accountId ? `crew-center-sac-interface:${accountId}` : null;
}

function sacInterfacePreference() {
  const key = sacInterfacePreferenceKey();
  if (!key) return { mode: 'athletics', persisted: false };
  if (sacInterfaceSessionChoices.has(key)) return sacInterfaceSessionChoices.get(key);
  try {
    const saved = localStorage.getItem(key);
    return { mode: sacInterfaceModes.includes(saved) ? saved : 'athletics', persisted: true };
  } catch (_error) { return { mode: 'athletics', persisted: false }; }
}

function applySacInterfacePreference() {
  const isSac = currentCrewCenterWorkspace() === 'sac' && canAccessSacWorkspace();
  const group = document.getElementById('sac-interface-settings');
  if (group) group.hidden = !isSac;
  if (!isSac) {
    delete document.documentElement.dataset.sacInterface;
    return;
  }
  const preference = sacInterfacePreference();
  document.documentElement.dataset.sacInterface = preference.mode;
  sacInterfaceModes.forEach(mode => {
    const button = document.getElementById(`sac-interface-${mode}`);
    button?.classList.toggle('active', preference.mode === mode);
    button?.setAttribute('aria-pressed', String(preference.mode === mode));
  });
  const status = document.getElementById('sac-interface-status');
  const label = preference.mode === 'athletics' ? 'Athletics' : 'Classic';
  if (status) status.textContent = `${label} interface selected. ${preference.persisted ? 'Remembered for your account on this browser.' : 'Applied for this session; browser storage is unavailable.'}`;
}
window.applySacInterfacePreference = applySacInterfacePreference;

function setSacInterface(mode) {
  if (!sacInterfaceModes.includes(mode) || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace() || isVisitorSession()) return;
  const key = sacInterfacePreferenceKey();
  if (!key) return;
  let persisted = true;
  try { localStorage.setItem(key, mode); } catch (_error) { persisted = false; }
  sacInterfaceSessionChoices.set(key, { mode, persisted });
  applySacInterfacePreference();
}

window.addEventListener('storage', event => {
  const key = sacInterfacePreferenceKey();
  if (event.key !== null && event.key !== key) return;
  if (event.key === null) sacInterfaceSessionChoices.clear();
  else sacInterfaceSessionChoices.delete(key);
  applySacInterfacePreference();
});

function sacDashboardPreferenceKey() {
  const accountId = window.CREW_CENTER_AUTH_USER?.id || currentMemberRecord()?.id;
  return accountId ? `crew-center-sac-dashboard:${accountId}` : null;
}

function sacDashboardPreferences() {
  const defaults = { showName: true, showActivities: true };
  try {
    const key = sacDashboardPreferenceKey();
    const saved = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return {
      showName: typeof saved?.showName === 'boolean' ? saved.showName : defaults.showName,
      showActivities: typeof saved?.showActivities === 'boolean' ? saved.showActivities : defaults.showActivities,
    };
  } catch (_error) { return defaults; }
}

function renderProfileWorkspace() {
  const isSac = currentCrewCenterWorkspace() === 'sac' && canAccessSacWorkspace();
  applySacInterfacePreference();
  const title = document.getElementById('profile-title');
  const subtitle = document.getElementById('profile-subtitle');
  if (title) title.textContent = isSac ? 'SAC settings' : 'Settings';
  if (subtitle) subtitle.textContent = isSac
    ? 'Your SAC profile, appearance, and personal dashboard.'
    : 'Manage your account, appearance, navigation, and notifications.';
  const summary = document.getElementById('sac-settings-summary');
  if (summary) summary.hidden = !isSac;
  const member = currentMemberRecord();
  const tagged = Boolean(member?.teamKeys?.includes('sac'));
  const accountRole = state.currentUser.isVisitor ? 'Visitor' : state.currentUser.isAdmin ? 'Admin' : 'Member';
  const role = document.getElementById('profile-preview-role');
  if (role) role.textContent = isSac && tagged ? `${accountRole} · ${sacTitleLabel(member.sacTitle) || 'SAC Member'}` : accountRole;
  if (isSac && summary) {
    document.getElementById('sac-settings-name').textContent = member?.name || state.currentUser.name;
    document.getElementById('sac-settings-membership').textContent = tagged ? sacTitleLabel(member.sacTitle) || 'SAC Member' : 'Workspace preview · SAC membership required to book shifts';
    document.getElementById('sac-settings-grade').textContent = member?.gradeLevel || 'Grade not listed';
    document.getElementById('sac-settings-shifts-link').hidden = !tagged;
    document.getElementById('sac-settings-request-link').hidden = tagged;
  }
  const description = document.getElementById('dashboard-preferences-description');
  if (description) description.textContent = isSac
    ? 'Choose what appears on your SAC dashboard. Saved for your account on this browser.'
    : 'Choose and order the information shown on your dashboard. These preferences follow your account across devices.';
  const mediaPreferences = document.getElementById('media-dashboard-preferences');
  const sacPreferences = document.getElementById('sac-dashboard-preferences');
  if (mediaPreferences) mediaPreferences.hidden = isSac;
  if (sacPreferences) sacPreferences.hidden = !isSac;
  if (document.getElementById('page-profile')?.classList.contains('active')) {
    const label = isSac ? 'SAC settings' : 'Settings';
    document.getElementById('topbar-title').textContent = label;
    document.getElementById('route-announcer').textContent = `${label} page`;
  }
}

function renderSacDashboardSettings() {
  const preferences = sacDashboardPreferences();
  document.getElementById('sac-setting-show-name')?.setAttribute('aria-checked', String(preferences.showName));
  document.getElementById('sac-setting-show-activities')?.setAttribute('aria-checked', String(preferences.showActivities));
  const status = document.getElementById('sac-settings-save-status');
  if (status) status.textContent = '';
}

function saveSacDashboardPreferences() {
  if (currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace() || isVisitorSession() || !currentMemberRecord()?.id) return;
  const key = sacDashboardPreferenceKey();
  if (!key) return;
  const status = document.getElementById('sac-settings-save-status');
  try {
    localStorage.setItem(key, JSON.stringify({
      showName: document.getElementById('sac-setting-show-name').getAttribute('aria-checked') === 'true',
      showActivities: document.getElementById('sac-setting-show-activities').getAttribute('aria-checked') === 'true',
    }));
    status.textContent = 'SAC dashboard preferences saved on this browser.';
    updateDashboardGreeting();
    const panel = document.getElementById('sac-dashboard-upcoming-panel');
    if (panel) panel.hidden = !sacDashboardPreferences().showActivities;
  } catch (_error) {
    status.textContent = 'Could not save preferences. Browser storage is unavailable; please try again.';
  }
}

document.addEventListener('click', event => {
  const interfaceChoice = event.target.closest?.('[data-sac-interface-choice]');
  if (interfaceChoice) setSacInterface(interfaceChoice.dataset.sacInterfaceChoice);
  const toggle = event.target.closest?.('[data-sac-preference-toggle]');
  if (toggle && currentCrewCenterWorkspace() === 'sac' && canAccessSacWorkspace() && currentMemberRecord()?.id && !isVisitorSession()) {
    toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
    document.getElementById('sac-settings-save-status').textContent = 'Unsaved changes';
  }
  if (event.target.closest?.('[data-sac-preferences-save]')) saveSacDashboardPreferences();
});
