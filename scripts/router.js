// ══════════════════════════════
// NAVIGATION
// ══════════════════════════════
const pageTitles = { about: "About Media Club", home: "Dashboard", "my-crew-schedule": "My Crew Schedule", "sac-home": "SAC Dashboard", "sac-events": "SAC Events", "sac-signups": "SAC Sign-up Sheets", "sac-my-shifts": "My SAC Shifts", "sac-members": "SAC Members", "sac-meetings": "SAC Meetings", "sac-attendance": "SAC Attendance", events: "Events", meetings: "Meetings", signup: "Sign-up Sheets", members: "Members", gallery: "Project Gallery", equipment: "Equipment", "equipment-status": "Equipment Status", "crew-deployment": "Crew Schedule", "role-guide": "Media Role Guide", profile: "Settings", join: "Join the Club", admin: "Admin Panel" };
const pageRoutes = {
  about: '/about',
  home: '/dashboard',
  'my-crew-schedule': '/my-crew-schedule',
  'sac-events': '/sac/events',
  'sac-signups': '/sac/signups',
  'sac-my-shifts': '/sac/my-shifts',
  'sac-members': '/sac/members',
  'sac-meetings': '/sac/meetings',
  'sac-attendance': '/sac/attendance',
  events: '/events',
  meetings: '/meetings',
  signup: '/signups',
  members: '/members',
  gallery: '/gallery',
  equipment: '/equipment',
  'equipment-status': '/equipment-status',
  'crew-deployment': '/crew-deployment',
  'role-guide': '/role-guide',
  profile: '/profile',
  join: '/join',
  admin: '/admin',
};
const routePages = {
  '/': 'home',
  '/about': 'about',
  '/dashboard': 'home',
  '/my-crew-schedule': 'my-crew-schedule',
  '/sac/events': 'sac-events',
  '/sac/signups': 'sac-signups',
  '/sac/my-shifts': 'sac-my-shifts',
  '/sac/members': 'sac-members',
  '/sac/meetings': 'sac-meetings',
  '/sac/attendance': 'sac-attendance',
  '/events': 'events',
  '/meetings': 'meetings',
  '/signup': 'signup',
  '/signups': 'signup',
  '/members': 'members',
  '/gallery': 'gallery',
  '/equipment': 'equipment',
  '/equipment-status': 'equipment-status',
  '/crew-deployment': 'crew-deployment',
  '/role-guide': 'role-guide',
  '/profile': 'profile',
  '/join': 'join',
  '/admin': 'admin',
};

function pageFromPath() {
  return routePages[window.location.pathname] || 'home';
}

function pageUrl(page, params = {}) {
  const route = pageRoutes[page] || pageRoutes.home;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  const workspaceReady = Boolean(window.CREW_CENTER_AUTH_USER || window.CREW_CENTER_IS_VISITOR || window.CREW_CENTER_IS_ADMIN);
  if (workspaceReady && typeof currentCrewCenterWorkspace === 'function' && typeof workspaceSearchForSelection === 'function') {
    return `${route}${workspaceSearchForSelection(currentCrewCenterWorkspace(), window.location.hostname, query ? `?${query}` : '')}`;
  }
  return query ? `${route}?${query}` : route;
}

function tabValueFromUrl(allowed, fallback) {
  const requested = new URLSearchParams(window.location.search).get('tab');
  return allowed.includes(requested) ? requested : fallback;
}

function navItemForPage(id) {
  if (id === 'profile') return null;
  return document.querySelector(`.nav-item[data-page="${id}"]`);
}

function navigate(id, el, options = {}) {
  const workspacePage = typeof workspacePageFor === 'function' ? workspacePageFor(id) : id;
  let page = document.getElementById('page-' + workspacePage) ? workspacePage : 'home';
  if (page === 'admin' && !canAccessAdminPanel()) {
    page = 'home';
  }
  if (page === 'my-crew-schedule' && !canAccessMyCrewSchedule()) page = 'home';
  if (page === 'meetings' && isVisitorSession()) {
    page = 'home';
  }
  if (page === 'sac-attendance' && !canCreateSacEvents()) {
    page = 'sac-home';
  }
  if (page === 'equipment-status' && !canAccessEquipmentStatus()) {
    page = 'home';
  }
  if (page === 'crew-deployment' && !canAccessCrewSchedule()) {
    page = 'home';
  }
  window.prepareCrewQuickSearchDestination?.();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  const settingsButton = document.getElementById('sidebar-settings-button');
  settingsButton?.classList.toggle('active', page === 'profile');
  if (page === 'profile') settingsButton?.setAttribute('aria-current', 'page');
  else settingsButton?.removeAttribute('aria-current');
  document.getElementById('page-' + page).classList.add('active');
  const activeNav = el || navItemForPage(page);
  if (activeNav) {
    activeNav.classList.add('active');
    activeNav.setAttribute('aria-current', 'page');
  }
  document.getElementById('topbar-title').textContent = pageTitles[page] || page;
  const pageLabel = pageTitles[page] || page;
  const announcer = document.getElementById('route-announcer');
  if (announcer) announcer.textContent = `${pageLabel} page`;
  requestAnimationFrame(() => updateSlidingTab(document.querySelector(`#page-${page} .tab-row`)));
  document.getElementById('auth-signout')?.classList.toggle('visible', page === 'profile');
  if (!options.skipUrl) {
    const route = pageUrl(page);
    if (`${window.location.pathname}${window.location.search}` !== route) {
      history.pushState({ page }, '', route);
    }
  }
  if (page === 'about') renderAboutRecentProjects();
  if (page === 'home') renderDashboard();
  if (page === 'sac-home') { renderSacDashboard(); renderSacApplications(); }
  if (page === 'sac-events') renderSacEvents();
  if (page === 'sac-signups') renderSacSignups();
  if (page === 'sac-my-shifts') renderSacMyShifts();
  if (page === 'sac-members') renderSacMembers();
  if (page === 'sac-meetings') renderSacMeetings();
  if (page === 'sac-attendance') renderSacAttendance();
  if (page === 'events') renderEvents();
  if (page === 'meetings') renderMeetings();
  if (page === 'signup') initSignupSheet();
  if (page === 'my-crew-schedule') renderMyCrewSchedule();
  if (page === 'members') renderMembers();
  if (page === 'gallery') renderGallery();
  if (page === 'equipment') renderEquipment();
  if (page === 'equipment-status') renderEquipmentStatus();
  if (page === 'crew-deployment') openCrewDeployment();
  if (page === 'profile') renderProfile();
  if (page === 'admin') renderAdmin();
  renderDatasetErrors();
  closeAllPages();
  closeMobileSidebar();
  refreshVisitorDataForPage(page);
  if (!options.preserveFocus) {
    requestAnimationFrame(() => {
      const activePage = document.getElementById('page-' + page);
      const heading = activePage?.querySelector('h1, .page-title');
      if (!heading) return;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: false });
    });
  }
}

function openPageFromUrl() {
  const canSyncWorkspace = Boolean(window.CREW_CENTER_AUTH_USER || window.CREW_CENTER_IS_VISITOR || window.CREW_CENTER_IS_ADMIN);
  // Keep deep links intact until the session and member record establish access.
  // loadCrewCenterInitialData() initializes the workspace after loading members.
  if (!canSyncWorkspace) return;
  const workspace = window.syncCrewCenterWorkspaceFromLocation?.()
    || (typeof currentCrewCenterWorkspace === 'function' ? currentCrewCenterWorkspace() : 'media');
  const requestedPage = pageFromPath();
  const page = typeof workspacePageFor === 'function' ? workspacePageFor(requestedPage) : requestedPage;
  if (page !== requestedPage) {
    history.replaceState({ page, workspace }, '', workspaceUrlForPage(page, workspace));
  } else if (typeof workspaceSearchForSelection === 'function') {
    const canonicalSearch = workspaceSearchForSelection(workspace, window.location.hostname, window.location.search);
    if (canonicalSearch !== window.location.search) {
      history.replaceState({ page, workspace }, '', `${window.location.pathname}${canonicalSearch}${window.location.hash}`);
    }
  }
  navigate(page, navItemForPage(page), { skipUrl: true });
}

window.addEventListener('popstate', openPageFromUrl);

function installNativeLinkNavigation() {
  const visitorPages = new Set(['about', 'home', 'events', 'gallery', 'equipment', 'role-guide', 'join']);
  const pageForDestination = destination => {
    if (destination.origin !== window.location.origin) return;
    const routePage = routePages[destination.pathname];
    const page = typeof workspacePageFor === 'function' ? workspacePageFor(routePage) : routePage;
    if (!page) return;
    if (page === 'admin' && !canAccessAdminPanel()) return;
    if (page === 'equipment-status' && !canAccessEquipmentStatus()) return;
    if (page === 'crew-deployment' && !canAccessCrewSchedule()) return;
    if (isVisitorSession() && !visitorPages.has(page)) return;
    return page;
  };

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const destination = new URL(link.href, window.location.href);
    const requestedWorkspace = workspaceFromSearch(destination.search);
    if (requestedWorkspace && requestedWorkspace !== currentCrewCenterWorkspace()) return;
    const page = pageForDestination(destination);
    if (!page) return;
    event.preventDefault();
    const destinationPage = routePages[destination.pathname];
    const workspaceSearch = typeof workspaceSearchForSelection === 'function'
      ? workspaceSearchForSelection(currentCrewCenterWorkspace(), window.location.hostname, destination.search)
      : destination.search;
    const destinationUrl = page === destinationPage
      ? `${destination.pathname}${workspaceSearch}${destination.hash}`
      : pageUrl(page);
    history.pushState({ page }, '', destinationUrl);
    navigate(page, navItemForPage(page), { skipUrl: true });
  });
}

installNativeLinkNavigation();

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const open = sidebar.classList.toggle('open');
  document.getElementById('sidebar-scrim').classList.toggle('open', open);
  document.getElementById('mobile-menu-button').setAttribute('aria-expanded', String(open));
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-scrim').classList.remove('open');
  document.getElementById('mobile-menu-button')?.setAttribute('aria-expanded', 'false');
}

function setSidebarCollapsed(collapsed, { persist = false } = {}) {
  const shouldCollapse = Boolean(collapsed) && window.innerWidth > 900;
  document.body.classList.toggle('sidebar-collapsed', shouldCollapse);
  const btn = document.getElementById('sidebar-toggle-btn');
  const icon = document.getElementById('sidebar-toggle-icon');
  btn.setAttribute('aria-label', shouldCollapse ? 'Expand sidebar' : 'Condense sidebar');
  btn.setAttribute('title', shouldCollapse ? 'Expand sidebar' : 'Condense sidebar');
  icon.innerHTML = shouldCollapse ? '<polyline points="9 18 15 12 9 6"/>' : '<polyline points="15 18 9 12 15 6"/>';
  if (persist) localStorage.setItem('crew-center-sidebar-compact', String(Boolean(collapsed)));
}

function syncSidebarCollapsePreference() {
  const shouldCollapse = Boolean(window.CREW_CENTER_IS_VISITOR) || localStorage.getItem('crew-center-sidebar-compact') === 'true';
  setSidebarCollapsed(shouldCollapse);
}

function toggleSidebarCollapse() {
  setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'), { persist: !window.CREW_CENTER_IS_VISITOR });
}

syncSidebarCollapsePreference();
window.addEventListener('resize', syncSidebarCollapsePreference);
