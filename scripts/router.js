// ══════════════════════════════
// NAVIGATION
// ══════════════════════════════
const pageTitles = { about: "About Media Club", home: "Dashboard", events: "Events", signup: "Sign-up Sheets", members: "Members", gallery: "Project Gallery", equipment: "Equipment", "equipment-status": "Equipment Status", "crew-deployment": "Crew Schedule", "role-guide": "Media Role Guide", profile: "Settings", join: "Join the Club", admin: "Admin Panel" };
const pageRoutes = {
  about: '/about',
  home: '/dashboard',
  events: '/events',
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
  '/events': 'events',
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
  let page = document.getElementById('page-' + id) ? id : 'home';
  if (page === 'admin' && !canAccessAdminPanel()) {
    page = 'home';
  }
  if (page === 'equipment-status' && !canAccessEquipmentStatus()) {
    page = 'home';
  }
  if (page === 'crew-deployment' && !canAccessCrewSchedule()) {
    page = 'home';
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
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
  if (page === 'events') renderEvents();
  if (page === 'signup') initSignupSheet();
  if (page === 'members') renderMembers();
  if (page === 'gallery') renderGallery();
  if (page === 'equipment') renderEquipment();
  if (page === 'equipment-status') renderEquipmentStatus();
  if (page === 'crew-deployment') initCrewDeployment();
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
  navigate(pageFromPath(), navItemForPage(pageFromPath()), { skipUrl: true });
}

window.addEventListener('popstate', openPageFromUrl);

function installNativeLinkNavigation() {
  const visitorPages = new Set(['about', 'home', 'events', 'gallery', 'equipment', 'role-guide', 'join']);
  const pageForDestination = destination => {
    if (destination.origin !== window.location.origin) return;
    const page = routePages[destination.pathname];
    if (!page) return;
    if (page === 'admin' && !canAccessAdminPanel()) return;
    if (page === 'equipment-status' && !canAccessEquipmentStatus()) return;
    if (page === 'crew-deployment' && !canAccessCrewSchedule()) return;
    if (isVisitorSession() && !visitorPages.has(page)) return;
    return page;
  };

  if (window.navigation?.addEventListener) {
    window.navigation.addEventListener('navigate', event => {
      if (!event.canIntercept || event.navigationType !== 'push' || event.hashChange || event.formData || event.downloadRequest) return;
      const page = pageForDestination(new URL(event.destination.url));
      if (!page) return;
      event.intercept({
        focusReset: 'manual',
        handler() {
          navigate(page, navItemForPage(page), { skipUrl: true });
        },
      });
    });
    return;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const destination = new URL(link.href, window.location.href);
    const page = pageForDestination(destination);
    if (!page) return;
    event.preventDefault();
    history.pushState({ page }, '', `${destination.pathname}${destination.search}${destination.hash}`);
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
