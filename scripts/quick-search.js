// Results stay in the current workspace and use each page's existing audience guards.
const crewQuickSearchState = { request: 0, sacEvents: [], sacMeetings: [], loading: false, errors: [], actor: '', returnFocus: null, selectionApplied: false, recordFocused: false };

function crewQuickSearchActor() {
  return `${window.CREW_CENTER_AUTH_USER?.id || ''}:${Number(window.CREW_CENTER_AUTH_EPOCH || 0)}:${currentCrewCenterWorkspace()}`;
}

function crewQuickSearchAllowed() {
  if (!window.CREW_CENTER_AUTH_USER?.id && !isVisitorSession()) return false;
  const member = currentMemberRecord();
  if (!isVisitorSession() && !member && !canAccessAdminPanel()) return false;
  const email = window.CREW_CENTER_AUTH_USER?.email;
  if (!isVisitorSession() && member && email && String(member.email || '').toLowerCase() !== email.toLowerCase()) return false;
  return currentCrewCenterWorkspace() === 'sac' ? canAccessSacWorkspace() : isVisitorSession() || canAccessMediaWorkspace();
}

function normalizeCrewQuickSearch(value) {
  return String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function crewQuickSearchEntries(query = '') {
  if (!crewQuickSearchAllowed()) return [];
  const sac = currentCrewCenterWorkspace() === 'sac';
  const visitorPages = ['home', 'about', 'events', 'gallery', 'equipment', 'role-guide', 'join'];
  const pages = sac ? ['sac-home', 'sac-events', 'sac-signups', 'sac-my-shifts', 'sac-members', 'sac-meetings', ...(canCreateSacEvents() ? ['sac-attendance'] : []), 'profile']
    : [...Object.values(sidebarCategories).flatMap(group => group.pages).filter(page => sidebarPageAvailable(page) && (!isVisitorSession() || visitorPages.includes(page))), ...(!isVisitorSession() ? ['profile'] : [])];
  const entries = [...new Set(pages)].map(page => ({ kind: 'page', title: pageTitles[page] || page, detail: 'Open page', url: pageUrl(page) }));
  if (sac && crewQuickSearchState.actor === crewQuickSearchActor()) {
    crewQuickSearchState.sacEvents.filter(item => Date.parse(item.ends_at) > Date.now()).forEach(item => entries.push({ kind: 'event', title: item.title, detail: `${formatBerlinDateTime(item.starts_at, { day: 'numeric', month: 'short' })} · ${item.location || 'SAC event'}`, url: sacEventUrl(item.id) }));
    crewQuickSearchState.sacMeetings.filter(item => Date.parse(item.ends_at) > Date.now()).forEach(item => entries.push({ kind: 'meeting', title: item.title, detail: `${formatBerlinDateTime(item.starts_at, { day: 'numeric', month: 'short' })} · ${item.location || 'Council meeting'}`, url: pageUrl('sac-meetings', { meeting: item.id }) }));
  } else if (!sac) {
    if (state.dataLoaded.events && !state.dataErrors.events) state.events.filter(item => !item.archivedAt && !isPastEvent(item)).forEach(item => entries.push({ kind: 'event', title: item.title, detail: `${item.date || ''} · ${item.loc || 'Media Club event'}`, url: pageUrl('events', { event: item.id }) }));
    if (state.dataLoaded.meetings && !state.dataErrors.meetings) state.meetings.filter(item => !item.archivedAt && canViewMeeting(item) && !meetingIsPast(item)).forEach(item => entries.push({ kind: 'meeting', title: item.title, detail: `${formatBerlinDateTime(item.startsAt, { day: 'numeric', month: 'short' })} · ${item.location || 'Club meeting'}`, url: pageUrl('meetings', { meeting: item.id }) }));
    if (state.dataLoaded.equipment && !state.dataErrors.equipment) state.equipment.filter(item => !item.archivedAt).forEach(item => entries.push({ kind: 'equipment', title: item.name, detail: `${item.category || 'Equipment'} · ${item.detail || ''}`, url: pageUrl('equipment', { item: item.id }) }));
  }
  const search = normalizeCrewQuickSearch(query);
  if (!search) return entries.filter(item => item.kind === 'page');
  const words = search.split(' ');
  return entries.filter(item => words.every(word => normalizeCrewQuickSearch(`${item.title} ${item.detail} ${item.kind}`).includes(word)))
    .sort((a, b) => Number(normalizeCrewQuickSearch(b.title).startsWith(search)) - Number(normalizeCrewQuickSearch(a.title).startsWith(search)) || a.title.localeCompare(b.title));
}

function renderCrewQuickSearch(query = '') {
  const list = document.getElementById('all-pages-list');
  if (!list) return;
  const focusedUrl = list.contains(document.activeElement) ? document.activeElement.closest('a[href]')?.getAttribute('href') : null;
  const matches = crewQuickSearchEntries(query);
  list.innerHTML = Object.entries({ page: 'Pages', event: 'Upcoming events', meeting: 'Upcoming meetings', equipment: 'Equipment' }).map(([kind, label]) => {
    const group = matches.filter(item => item.kind === kind);
    return group.length ? `<section class="all-pages-group"><h2 class="all-pages-group-title">${label} · ${group.length}</h2>${group.slice(0, 8).map(item => `<a class="all-pages-link quick-search-result" href="${escapeHtml(item.url)}"><span class="quick-search-result-kind" aria-hidden="true">${{ page: '↗', event: '◷', meeting: '≡', equipment: '◇' }[kind]}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><span class="quick-search-result-arrow" aria-hidden="true">→</span></a>`).join('')}${group.length > 8 ? '<p class="quick-search-more">Showing eight matches. Type more to narrow the results.</p>' : ''}</section>` : '';
  }).join('') || `<div class="empty-state" role="status"><p>${crewQuickSearchState.loading ? 'Searching this workspace…' : 'No matching pages or records. Try a title, location, or equipment name.'}</p></div>`;
  if (focusedUrl) {
    const match = [...list.querySelectorAll('a[href]')].find(link => link.getAttribute('href') === focusedUrl);
    (match || document.getElementById('all-pages-search'))?.focus({ preventScroll: true });
  }
  const status = document.getElementById('quick-search-status');
  if (status) status.textContent = crewQuickSearchState.loading ? 'Loading upcoming records…'
    : crewQuickSearchState.errors.length ? `${crewQuickSearchState.errors.join(' and ')} could not load. Pages and other results remain available.`
      : query.trim() ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} in this workspace` : 'Search upcoming events, meetings, equipment, or pages.';
  const retry = document.getElementById('quick-search-retry');
  if (retry) retry.hidden = !crewQuickSearchState.errors.length;
}

async function refreshCrewQuickSearch() {
  const request = ++crewQuickSearchState.request;
  const actor = crewQuickSearchActor();
  crewQuickSearchState.sacEvents = []; crewQuickSearchState.sacMeetings = [];
  crewQuickSearchState.actor = actor; crewQuickSearchState.errors = [];
  if (!crewQuickSearchAllowed()) { crewQuickSearchState.loading = false; renderCrewQuickSearch(); return; }
  crewQuickSearchState.loading = true;
  const repaint = () => renderCrewQuickSearch(document.getElementById('all-pages-search')?.value || '');
  repaint();
  if (currentCrewCenterWorkspace() === 'sac') {
    const timestamp = new Date().toISOString();
    const results = await Promise.allSettled(['sac_events', 'sac_meetings'].map(table => supabaseClient
      ? supabaseClient.from(table).select('id,title,location,starts_at,ends_at').gt('ends_at', timestamp).order('starts_at', { ascending: true })
      : Promise.reject(new Error('Unavailable'))));
    if (request !== crewQuickSearchState.request || actor !== crewQuickSearchActor() || !crewQuickSearchAllowed()) return;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.error) crewQuickSearchState[index ? 'sacMeetings' : 'sacEvents'] = result.value.data || [];
      else crewQuickSearchState.errors.push(index ? 'Meetings' : 'Events');
    });
  } else {
    const datasets = ['events', ...(!isVisitorSession() ? ['meetings'] : []), 'equipment'];
    const missing = datasets.filter(dataset => !state.dataLoaded[dataset] || state.dataErrors[dataset]);
    if (missing.length) {
      try { await loadCrewCenterData({ datasets: missing, silent: true }); } catch (_error) { /* Report unavailable datasets below. */ }
    }
    if (request !== crewQuickSearchState.request || actor !== crewQuickSearchActor() || !crewQuickSearchAllowed()) return;
    crewQuickSearchState.errors = datasets.filter(dataset => !state.dataLoaded[dataset] || state.dataErrors[dataset]).map(dataset => ({ events: 'Events', meetings: 'Meetings', equipment: 'Equipment' }[dataset]));
  }
  crewQuickSearchState.loading = false; repaint();
}

function toggleCrewQuickSearch(event) {
  event?.stopPropagation();
  if (!crewQuickSearchAllowed() || document.querySelector('.modal-backdrop.open')) return;
  const dialog = document.getElementById('all-pages-popover');
  if (dialog.classList.contains('open')) { closeCrewQuickSearch(); return; }
  crewQuickSearchState.returnFocus = document.activeElement;
  dialog.classList.add('open');
  document.getElementById('quick-search-scrim')?.classList.add('open');
  document.body.classList.add('quick-search-open');
  ['quick-search-button', 'sidebar-all-pages-button'].forEach(id => document.getElementById(id)?.setAttribute('aria-expanded', 'true'));
  const input = document.getElementById('all-pages-search'); input.value = ''; input.focus();
  refreshCrewQuickSearch();
}

function closeCrewQuickSearch(restoreFocus = true) {
  document.getElementById('all-pages-popover')?.classList.remove('open');
  document.getElementById('quick-search-scrim')?.classList.remove('open');
  document.body.classList.remove('quick-search-open');
  ['quick-search-button', 'sidebar-all-pages-button'].forEach(id => document.getElementById(id)?.setAttribute('aria-expanded', 'false'));
  if (restoreFocus && crewQuickSearchState.returnFocus?.isConnected) crewQuickSearchState.returnFocus.focus({ preventScroll: true });
  crewQuickSearchState.returnFocus = null;
}

window.resetCrewQuickSearch = () => {
  crewQuickSearchState.request += 1; crewQuickSearchState.sacEvents = []; crewQuickSearchState.sacMeetings = [];
  crewQuickSearchState.actor = ''; crewQuickSearchState.errors = []; crewQuickSearchState.loading = false;
  closeCrewQuickSearch(false);
  const input = document.getElementById('all-pages-search'); if (input) input.value = '';
  document.getElementById('all-pages-list')?.replaceChildren();
};

window.prepareCrewQuickSearchDestination = () => { crewQuickSearchState.selectionApplied = false; crewQuickSearchState.recordFocused = false; };

function applyCrewQuickSearchDestination(kind) {
  if (currentCrewCenterWorkspace() !== 'media' || !crewQuickSearchAllowed()) return null;
  const id = new URLSearchParams(window.location.search).get({ event: 'event', meeting: 'meeting', equipment: 'item' }[kind]);
  const record = state[{ event: 'events', meeting: 'meetings', equipment: 'equipment' }[kind]].find(item => item.id === id && !item.archivedAt);
  if (!record || kind === 'meeting' && !canViewMeeting(record)) return null;
  if (!crewQuickSearchState.selectionApplied) {
    if (kind === 'event') {
      state.eventFilter = 'all'; state.showPastEvents = isPastEvent(record);
      document.querySelectorAll('#event-filters .filter-chip:not(#past-events-toggle)').forEach(button => {
        const all = button.textContent.trim() === 'All'; button.classList.toggle('active', all); button.setAttribute('aria-pressed', String(all));
      });
    }
    if (kind === 'equipment') {
      const input = document.getElementById('equipment-search'); if (input) input.value = '';
      ['equipment-category-filter', 'equipment-status-filter'].forEach(filter => { const select = document.getElementById(filter); if (select) select.value = 'all'; });
    }
    crewQuickSearchState.selectionApplied = true;
  }
  return record;
}

function focusCrewQuickSearchDestination(kind) {
  if (crewQuickSearchState.recordFocused) return;
  const record = applyCrewQuickSearchDestination(kind);
  const page = { event: 'events', meeting: 'meetings', equipment: 'equipment' }[kind];
  const card = record && document.getElementById(`media-${kind}-${record.id}`);
  if (!card) return;
  const actor = crewQuickSearchActor(); const route = window.location.href;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (actor !== crewQuickSearchActor() || route !== window.location.href || !crewQuickSearchAllowed()
      || !document.getElementById(`page-${page}`)?.classList.contains('active') || !card.isConnected) return;
    crewQuickSearchState.recordFocused = true;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }));
}

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey) {
    if (crewQuickSearchAllowed() && !document.querySelector('.modal-backdrop.open')) { event.preventDefault(); toggleCrewQuickSearch(); }
    return;
  }
  const dialog = document.getElementById('all-pages-popover');
  if (!dialog?.classList.contains('open')) return;
  const input = document.getElementById('all-pages-search');
  const results = [...dialog.querySelectorAll('.all-pages-link')];
  const index = results.indexOf(document.activeElement);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); if (!results.length) return;
    if (event.key === 'ArrowUp' && index === 0) input.focus();
    else results[event.key === 'ArrowDown' ? (index + 1) % results.length : index < 0 ? results.length - 1 : index - 1]?.focus();
  } else if (event.key === 'Enter' && document.activeElement === input && results.length) {
    event.preventDefault(); results[0].click();
  } else if (event.key === 'Tab') {
    const controls = [...dialog.querySelectorAll('button:not([hidden]), input, a[href]')];
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
  }
});

document.getElementById('quick-search-button')?.addEventListener('click', toggleCrewQuickSearch);
document.getElementById('quick-search-scrim')?.addEventListener('click', () => closeCrewQuickSearch());
document.getElementById('quick-search-retry')?.addEventListener('click', refreshCrewQuickSearch);
