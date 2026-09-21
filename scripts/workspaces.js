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

function memberCanAccessSacWorkspace(member, isAdmin = false, isVisitor = false) {
  if (isVisitor) return false;
  if (isAdmin) return true;
  if (!member) return false;
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

function resolvedWorkspaceForHostname(hostname, sacAccess) {
  return workspaceFromHostname(hostname) === 'sac' && sacAccess ? 'sac' : 'media';
}

function resolveWorkspaceSelection(workspace, sacAccess) {
  return workspace === 'sac' && sacAccess ? 'sac' : 'media';
}

function currentCrewCenterWorkspace() {
  return activeCrewCenterWorkspace;
}

function workspacePageFor(page, workspace = activeCrewCenterWorkspace) {
  if (!page) return page;
  if (workspace === 'sac') return ['sac-home', 'profile'].includes(page) ? page : 'sac-home';
  return page === 'sac-home' ? 'home' : page;
}

function closeWorkspaceMenu({ returnFocus = false } = {}) {
  const menu = document.getElementById('workspace-menu');
  const button = document.getElementById('workspace-switcher-button');
  if (menu) menu.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
  if (returnFocus) button?.focus();
}

function toggleWorkspaceMenu(event) {
  event?.stopPropagation();
  const button = document.getElementById('workspace-switcher-button');
  const menu = document.getElementById('workspace-menu');
  if (!button || !menu || button.disabled) return;
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) menu.querySelector('[aria-checked="true"]')?.focus();
}

function applyWorkspacePresentation() {
  const sacAccess = canAccessSacWorkspace();
  const isSac = activeCrewCenterWorkspace === 'sac';
  document.documentElement.dataset.workspace = activeCrewCenterWorkspace;
  document.title = isSac ? 'FIS Student Athletic Council' : 'FIS Media Club';

  const name = document.getElementById('workspace-name');
  const subtitle = document.getElementById('workspace-subtitle');
  const motto = document.querySelector('.topbar-motto');
  if (name) name.textContent = isSac ? 'SAC' : 'Media Club';
  if (subtitle) subtitle.textContent = isSac ? 'Student Athletic Council' : 'FIS Student Media Club';
  if (motto) motto.textContent = isSac ? 'Students supporting athletics' : 'Vox Populi, Vox Media';

  const button = document.getElementById('workspace-switcher-button');
  if (button) {
    button.disabled = !sacAccess;
    button.classList.toggle('available', sacAccess);
    button.setAttribute('aria-label', sacAccess
      ? `Current workspace: ${isSac ? 'Student Athletic Council' : 'Media Club'}. Switch workspace.`
      : 'Current workspace: Media Club.');
    button.title = sacAccess ? 'Switch workspace' : 'Media Club workspace';
  }

  document.querySelectorAll('[data-workspace-choice]').forEach(choice => {
    const selected = choice.dataset.workspaceChoice === activeCrewCenterWorkspace;
    choice.setAttribute('aria-checked', String(selected));
    choice.classList.toggle('active', selected);
    if (choice.dataset.workspaceChoice === 'sac') choice.disabled = !sacAccess;
  });
  closeWorkspaceMenu();
  window.applySidebarPreferences?.();
}

function setCrewCenterWorkspace(workspace, options = {}) {
  const sacAccess = canAccessSacWorkspace();
  const requestedSac = workspace === 'sac';
  activeCrewCenterWorkspace = resolveWorkspaceSelection(workspace, sacAccess);
  applyWorkspacePresentation();
  if (requestedSac && !sacAccess && options.announce !== false) {
    showToast('This account is not eligible for the SAC workspace.', 'error', 5000);
  }
  if (options.navigate !== false && typeof navigate === 'function') {
    navigate('home', navItemForPage(workspacePageFor('home')));
  }
  return activeCrewCenterWorkspace;
}

function selectCrewCenterWorkspace(workspace) {
  closeWorkspaceMenu();
  setCrewCenterWorkspace(workspace);
}

function initializeCrewCenterWorkspace() {
  const workspace = resolvedWorkspaceForHostname(window.location.hostname, canAccessSacWorkspace());
  setCrewCenterWorkspace(workspace, { navigate: false, announce: false });
  if (typeof pageFromPath !== 'function' || typeof navigate !== 'function') return workspace;
  const requestedPage = pageFromPath();
  const resolvedPage = workspacePageFor(requestedPage);
  if (resolvedPage !== requestedPage) {
    history.replaceState({ page: resolvedPage }, '', pageUrl(resolvedPage));
  }
  navigate(resolvedPage, navItemForPage(resolvedPage), { skipUrl: true, preserveFocus: true });
  return workspace;
}

function resetCrewCenterWorkspace() {
  activeCrewCenterWorkspace = 'media';
  applyWorkspacePresentation();
}

document.addEventListener('click', event => {
  if (!event.target.closest?.('.sidebar-logo')) closeWorkspaceMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('workspace-menu')?.hidden) {
    closeWorkspaceMenu({ returnFocus: true });
  }
});

window.canAccessSacWorkspace = canAccessSacWorkspace;
window.currentCrewCenterWorkspace = currentCrewCenterWorkspace;
window.initializeCrewCenterWorkspace = initializeCrewCenterWorkspace;
window.resetCrewCenterWorkspace = resetCrewCenterWorkspace;
window.selectCrewCenterWorkspace = selectCrewCenterWorkspace;
