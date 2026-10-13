// ══════════════════════════════
// WORKSPACES
// ══════════════════════════════
let activeCrewCenterWorkspace = 'media';

function normalizeWorkspaceHostname(hostname = '') {
  return String(hostname).trim().toLowerCase().replace(/\.$/, '');
}

function workspaceFromHostname(hostname = '') {
  return normalizeWorkspaceHostname(hostname) === 'sac.fismediaclub.org' ? 'sac' : 'media';
}

function workspaceFromSearch(search = '') {
  const requested = new URLSearchParams(String(search).replace(/^\?/, '')).get('workspace');
  return ['media', 'sac'].includes(requested) ? requested : null;
}

function updateWorkspaceFavicon(workspace) {
  const favicon = document.getElementById('workspace-favicon');
  if (!favicon) return;
  const isSac = workspace === 'sac';
  favicon.type = isSac ? 'image/svg+xml' : 'image/png';
  favicon.href = isSac ? 'assets/sac-warriors-logo.svg' : 'assets/media-club-logo.png';
}

// Show the requested workspace brand while authentication resolves; access is checked later.
updateWorkspaceFavicon(workspaceFromSearch(window.location.search) || workspaceFromHostname(window.location.hostname));

function resolvedWorkspaceForLocation(hostname, search, sacAccess, mediaAccess = true) {
  const requested = workspaceFromSearch(search) || workspaceFromHostname(hostname);
  return resolveWorkspaceSelection(requested, sacAccess, mediaAccess);
}

function workspaceSearchForSelection(workspace, hostname, search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  if (workspace === workspaceFromHostname(hostname)) params.delete('workspace');
  else params.set('workspace', workspace);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function memberCanAccessSacWorkspace(member, isAdmin = false, isVisitor = false) {
  if (isVisitor) return false;
  if (isAdmin) return true;
  if (!member) return false;
  if (Array.isArray(member.teamKeys) && member.teamKeys.includes('sac')) return true;
  const gradeLevel = String(member.gradeLevel || '').trim().toLowerCase();
  const role = String(member.role || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (gradeLevel === 'adult' || role === 'faculty') return true;
  const grade = Number(gradeLevel.match(/\d+/)?.[0]);
  return Number.isInteger(grade) && grade >= 9 && grade <= 12;
}

function canAccessSacWorkspace() {
  return memberCanAccessSacWorkspace(
    currentMemberRecord(),
    canAccessAdminPanel(),
    isVisitorSession(),
  );
}

function canAccessMediaWorkspace() {
  if (canAccessAdminPanel() || isVisitorSession()) return true;
  const member = currentMemberRecord();
  if (!member) return true;
  const teams = Array.isArray(member.teamKeys) ? member.teamKeys : [];
  return teams.includes('media_club') || !teams.includes('sac');
}

function resolvedWorkspaceForHostname(hostname, sacAccess) {
  return workspaceFromHostname(hostname) === 'sac' && sacAccess ? 'sac' : 'media';
}

function resolveWorkspaceSelection(workspace, sacAccess, mediaAccess = true) {
  if (!mediaAccess && sacAccess) return 'sac';
  return workspace === 'sac' && sacAccess ? 'sac' : 'media';
}

function currentCrewCenterWorkspace() {
  return activeCrewCenterWorkspace;
}

function workspacePageFor(page, workspace = activeCrewCenterWorkspace) {
  if (!page) return page;
  if (workspace === 'sac' && page === 'sac-attendance' && typeof canCreateSacEvents === 'function' && !canCreateSacEvents()) return 'sac-home';
  if (workspace === 'sac') return ['sac-home', 'sac-events', 'sac-signups', 'sac-my-shifts', 'sac-members', 'sac-meetings', 'sac-attendance', 'profile'].includes(page) ? page : 'sac-home';
  return ['sac-home', 'sac-events', 'sac-signups', 'sac-my-shifts', 'sac-members', 'sac-meetings', 'sac-attendance'].includes(page) ? 'home' : page;
}

function workspaceUrlForPage(page, workspace = activeCrewCenterWorkspace, locationLike = window.location) {
  const route = typeof pageUrl === 'function' ? pageUrl(page) : '/dashboard';
  const url = new URL(route, locationLike.origin);
  url.search = workspaceSearchForSelection(workspace, locationLike.hostname, url.search);
  return `${url.pathname}${url.search}${url.hash}`;
}

function workspaceSwitchUrl(workspace, locationLike = window.location) {
  const productionOrigins = {
    media: 'https://fismediaclub.org',
    sac: 'https://sac.fismediaclub.org',
  };
  const isProductionHost = Object.values(productionOrigins).some(origin =>
    new URL(origin).hostname === normalizeWorkspaceHostname(locationLike.hostname));
  // Local and Pages previews must stay on their own deployment.
  if (!isProductionHost) return workspaceUrlForPage('home', workspace, locationLike);
  const destination = new URL(productionOrigins[workspace === 'sac' ? 'sac' : 'media']);
  return `${destination.origin}${workspaceUrlForPage('home', workspace, destination)}`;
}

function setWorkspaceMenuOpen(open, { returnFocus = false } = {}) {
  const menu = document.getElementById('workspace-menu');
  const button = document.getElementById('workspace-switcher-button');
  if (!menu || !button) return;
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menu.toggleAttribute('inert', !open);
  button.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => menu.querySelector('[aria-checked="true"]')?.focus());
  else if (returnFocus) button.focus();
}

function closeWorkspaceMenu({ returnFocus = false } = {}) {
  setWorkspaceMenuOpen(false, { returnFocus });
}

function toggleWorkspaceMenu(event) {
  event?.stopPropagation();
  const button = document.getElementById('workspace-switcher-button');
  const menu = document.getElementById('workspace-menu');
  if (!button || !menu || button.disabled) return;
  setWorkspaceMenuOpen(!menu.classList.contains('open'));
}

function applyWorkspacePresentation({ animate = false } = {}) {
  const sacAccess = canAccessSacWorkspace();
  const mediaAccess = canAccessMediaWorkspace();
  const isSac = activeCrewCenterWorkspace === 'sac';
  document.documentElement.dataset.workspace = activeCrewCenterWorkspace;
  window.applySacInterfacePreference?.();
  document.title = isSac ? 'FIS Student Athletic Council' : 'FIS Media Club';
  updateWorkspaceFavicon(activeCrewCenterWorkspace);

  const name = document.getElementById('workspace-name');
  const subtitle = document.getElementById('workspace-subtitle');
  const motto = document.querySelector('.topbar-motto');
  if (name) name.textContent = isSac ? 'SAC' : 'Media Club';
  if (subtitle) subtitle.textContent = isSac ? 'Student Athletic Council' : 'FIS Student Media Club';
  if (motto) motto.textContent = isSac ? 'Students supporting athletics' : 'Vox Populi, Vox Media';

  const button = document.getElementById('workspace-switcher-button');
  if (button) {
    button.disabled = !sacAccess || !mediaAccess;
    button.classList.toggle('available', sacAccess && mediaAccess);
    button.setAttribute('aria-label', sacAccess && mediaAccess
      ? `Current workspace: ${isSac ? 'Student Athletic Council' : 'Media Club'}. Switch workspace.`
      : `Current workspace: ${isSac ? 'Student Athletic Council' : 'Media Club'}.`);
    button.title = sacAccess && mediaAccess ? 'Switch workspace' : `${isSac ? 'SAC' : 'Media Club'} workspace`;
  }

  document.querySelectorAll('[data-workspace-choice]').forEach(choice => {
    const selected = choice.dataset.workspaceChoice === activeCrewCenterWorkspace;
    choice.setAttribute('aria-checked', String(selected));
    choice.classList.toggle('active', selected);
    if (choice.dataset.workspaceChoice === 'sac') choice.disabled = !sacAccess;
    if (choice.dataset.workspaceChoice === 'media') choice.disabled = !mediaAccess;
  });
  const attendanceManager = isSac && canCreateSacEvents();
  document.querySelector('.nav-item[data-page="sac-attendance"]')?.toggleAttribute('hidden', !attendanceManager);
  document.getElementById('sac-home-attendance-card')?.toggleAttribute('hidden', !attendanceManager);
  closeWorkspaceMenu();
  window.syncPersonalWeekButtons?.();
  window.applySidebarPreferences?.();
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.remove('workspace-changing');
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add('workspace-changing');
    window.setTimeout(() => document.documentElement.classList.remove('workspace-changing'), 320);
  }
}

function setCrewCenterWorkspace(workspace, options = {}) {
  window.resetCrewQuickSearch?.();
  const sacAccess = canAccessSacWorkspace();
  const requestedSac = workspace === 'sac';
  const previousWorkspace = activeCrewCenterWorkspace;
  activeCrewCenterWorkspace = resolveWorkspaceSelection(workspace, sacAccess, canAccessMediaWorkspace());
  applyWorkspacePresentation({ animate: options.animate !== false && previousWorkspace !== activeCrewCenterWorkspace });
  if (requestedSac && !sacAccess && options.announce !== false) {
    showToast('This account is not eligible for the SAC workspace.', 'error', 5000);
  }
  if (options.navigate !== false && typeof navigate === 'function') {
    const page = workspacePageFor('home');
    history.pushState({ page, workspace: activeCrewCenterWorkspace }, '', workspaceUrlForPage(page));
    navigate(page, navItemForPage(page), { skipUrl: true });
  }
  return activeCrewCenterWorkspace;
}

function selectCrewCenterWorkspace(workspace) {
  closeWorkspaceMenu();
  if (workspace === 'media' && !canAccessMediaWorkspace()) {
    showToast('Media Club access requires a Media Club membership.', 'error', 5000);
    return;
  }
  if (workspace === 'sac' && !canAccessSacWorkspace()) {
    setCrewCenterWorkspace(workspace);
    return;
  }
  const destination = new URL(workspaceSwitchUrl(workspace), window.location.origin);
  if (destination.origin !== window.location.origin) {
    // A workspace switch may cross hosts; ordinary page navigation stays relative.
    window.location.assign(destination.href);
    return;
  }
  setCrewCenterWorkspace(workspace);
}

function initializeCrewCenterWorkspace() {
  const workspace = resolvedWorkspaceForLocation(window.location.hostname, window.location.search, canAccessSacWorkspace(), canAccessMediaWorkspace());
  setCrewCenterWorkspace(workspace, { navigate: false, announce: false });
  if (typeof pageFromPath !== 'function' || typeof navigate !== 'function') return workspace;
  const requestedPage = pageFromPath();
  const resolvedPage = workspacePageFor(requestedPage);
  const destination = new URL(workspaceUrlForPage(resolvedPage, workspace), window.location.origin);
  // Preserve tab and record details when membership permits the requested page.
  if (resolvedPage === requestedPage) {
    destination.search = workspaceSearchForSelection(workspace, window.location.hostname, window.location.search);
    destination.hash = window.location.hash;
  }
  const resolvedUrl = `${destination.pathname}${destination.search}${destination.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== resolvedUrl) {
    history.replaceState({ page: resolvedPage, workspace }, '', resolvedUrl);
  }
  navigate(resolvedPage, navItemForPage(resolvedPage), { skipUrl: true, preserveFocus: true });
  return workspace;
}

function syncCrewCenterWorkspaceFromLocation() {
  const workspace = resolvedWorkspaceForLocation(window.location.hostname, window.location.search, canAccessSacWorkspace(), canAccessMediaWorkspace());
  setCrewCenterWorkspace(workspace, { navigate: false, announce: false, animate: true });
  return workspace;
}

function resetCrewCenterWorkspace() {
  window.closeCrewCenterModals?.();
  window.resetMediaCalendarSubscriptions?.();
  window.resetCrewQuickSearch?.();
  window.resetEventBrowseFilters?.();
  window.resetSacDashboardState?.();
  window.resetPersonalWeek?.();
  window.resetAnnouncementState?.();
  window.resetSacEventsState?.();
  window.resetSacMeetingsState?.();
  window.resetSacSignupsState?.();
  window.resetSacAttendanceState?.();
  activeCrewCenterWorkspace = 'media';
  applyWorkspacePresentation();
}

document.addEventListener('click', event => {
  if (!event.target.closest?.('.sidebar-logo')) closeWorkspaceMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('workspace-menu')?.classList.contains('open')) {
    closeWorkspaceMenu({ returnFocus: true });
  }
});

window.canAccessSacWorkspace = canAccessSacWorkspace;
window.canAccessMediaWorkspace = canAccessMediaWorkspace;
window.currentCrewCenterWorkspace = currentCrewCenterWorkspace;
window.initializeCrewCenterWorkspace = initializeCrewCenterWorkspace;
window.resetCrewCenterWorkspace = resetCrewCenterWorkspace;
window.selectCrewCenterWorkspace = selectCrewCenterWorkspace;
window.syncCrewCenterWorkspaceFromLocation = syncCrewCenterWorkspaceFromLocation;
