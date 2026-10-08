// SAC display choices are per account on this browser; membership remains server-managed.
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
  const toggle = event.target.closest?.('[data-sac-preference-toggle]');
  if (toggle && currentCrewCenterWorkspace() === 'sac' && canAccessSacWorkspace() && currentMemberRecord()?.id && !isVisitorSession()) {
    toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
    document.getElementById('sac-settings-save-status').textContent = 'Unsaved changes';
  }
  if (event.target.closest?.('[data-sac-preferences-save]')) saveSacDashboardPreferences();
});
