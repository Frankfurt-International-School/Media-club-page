// One optional personal overview, shared by the existing club workspaces.
const personalWeek = { actor: '', items: [], errors: [], request: 0, loadedAt: 0, pending: null, monday: '' };

function personalWeekActor() {
  const actor = notificationReadActor();
  const teams = currentMemberRecord()?.teamKeys || [];
  return actor && teams.some(team => ['media_club', 'sac'].includes(team)) ? `${actor}:${teams.slice().sort().join(',')}` : '';
}

function personalDateOffset(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function personalWeekMonday(now = Date.now()) {
  const day = berlinDateKey(now);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return personalDateOffset(day, -((weekday + 6) % 7));
}

function personalDestinationUrl(page, workspace, params = {}) {
  const url = new URL(pageUrl(page, params), window.location.origin);
  url.search = workspaceSearchForSelection(workspace, window.location.hostname, url.search);
  return `${url.pathname}${url.search}`;
}

function openPersonalDestination(href, workspace) {
  if (workspace === 'media' ? !canAccessMediaWorkspace() : !canAccessSacWorkspace()) return;
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin || !routePages[url.pathname]) return;
  closeModal('personal-week-modal');
  closeNotificationPanel();
  setCrewCenterWorkspace(workspace, { navigate: false, announce: false });
  history.pushState({ page: routePages[url.pathname] }, '', `${url.pathname}${url.search}`);
  navigate(routePages[url.pathname], null, { skipUrl: true });
}

function normalizePersonalItems(kind, rows, memberId, now = Date.now()) {
  return rows.flatMap(row => {
    if (kind !== 'council' && row.member_id !== memberId) return [];
    let item;
    if (kind === 'assignment') {
      if (row.confirmation_status === 'expired' || !row.events || row.events.archived_at) return [];
      item = { id: `assignment:${row.id}`, workspace: 'media', page: 'signup', params: { event: row.event_id },
        title: row.events.title, detail: row.signup_role || 'Crew assignment', location: row.events.location,
        start: Date.parse(row.attendance_start), end: Date.parse(row.attendance_end), tentative: row.confirmation_status === 'maybe' };
    } else if (kind === 'shift') {
      if (row.cancelled_at || !row.sac_events) return [];
      item = { id: `shift:${row.id}`, workspace: 'sac', page: 'sac-signups', params: { event: row.event_id },
        title: row.sac_events.title, detail: `Scoreboard spot ${row.spot_number}`, location: row.sac_events.location,
        start: Date.parse(row.slot_start), end: Date.parse(row.slot_end) };
    } else if (kind === 'meeting') {
      if (!['attending', 'maybe'].includes(row.response) || !row.meetings || row.meetings.archived_at) return [];
      item = { id: `meeting:${row.meeting_id}`, workspace: 'media', page: 'meetings', params: { meeting: row.meeting_id },
        title: row.meetings.title, detail: row.response === 'maybe' ? 'Meeting · Maybe' : 'Meeting · Going', location: row.meetings.location,
        start: Date.parse(row.meetings.starts_at), end: Date.parse(row.meetings.ends_at), tentative: row.response === 'maybe' };
    } else if (kind === 'council') {
      item = { id: `council:${row.id}`, workspace: 'sac', page: 'sac-meetings', params: { meeting: row.id },
        title: row.title, detail: 'Council meeting', location: row.location, start: Date.parse(row.starts_at), end: Date.parse(row.ends_at) };
    } else return [];
    return Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.end > now
      ? [{ ...item, kind }] : [];
  });
}

async function loadPersonalWeek(force = false) {
  const actor = personalWeekActor();
  if (!actor || !supabaseClient) return false;
  if (personalWeek.actor === actor && personalWeek.pending) return personalWeek.pending;
  if (!force && personalWeek.actor === actor && Date.now() - personalWeek.loadedAt < 30000) return true;
  const request = ++personalWeek.request;
  personalWeek.actor = actor; personalWeek.items = []; personalWeek.errors = []; personalWeek.loadedAt = 0;
  const member = currentMemberRecord(); const now = Date.now(); const timestamp = new Date(now).toISOString();
  const queries = [];
  if (member.teamKeys.includes('media_club')) {
    queries.push(['assignment', 'Media Club assignments', () => supabaseClient.from('signups')
      .select('id,member_id,event_id,signup_role,attendance_start,attendance_end,confirmation_status,events(title,location,archived_at)')
      .eq('member_id', member.id).gt('attendance_end', timestamp)]);
  }
  if (member.teamKeys.includes('media_club')) queries.push(['meeting', 'Meeting RSVPs', () => supabaseClient.from('meeting_attendees')
    .select('member_id,meeting_id,response,meetings(title,location,starts_at,ends_at,archived_at)')
    .eq('member_id', member.id).in('response', ['attending', 'maybe'])]);
  if (member.teamKeys.includes('sac')) {
    queries.push(['shift', 'SAC shifts', () => supabaseClient.from('sac_slot_signups')
      .select('id,member_id,event_id,spot_number,slot_start,slot_end,cancelled_at,sac_events(title,location)')
      .eq('member_id', member.id).is('cancelled_at', null).gt('slot_end', timestamp)]);
    queries.push(['council', 'Council meetings', () => supabaseClient.from('sac_meetings')
      .select('id,title,location,starts_at,ends_at').gt('ends_at', timestamp)]);
  }
  const pending = (async () => {
    const results = await Promise.allSettled(queries.map(([, label, query]) => Promise.resolve().then(() => withCrewCenterDataTimeout(query(), label))));
    if (request !== personalWeek.request || personalWeekActor() !== actor) return false;
    results.forEach((result, index) => {
      if (result.status !== 'fulfilled' || result.value.error) personalWeek.errors.push(queries[index][1]);
      else personalWeek.items.push(...normalizePersonalItems(queries[index][0], result.value.data || [], member.id, Date.now()));
    });
    personalWeek.items.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    personalWeek.loadedAt = Date.now();
    return true;
  })();
  personalWeek.pending = pending;
  try { return await pending; }
  finally { if (personalWeek.pending === pending) personalWeek.pending = null; }
}

function personalConflicts(start, end, ignoreId = '') {
  if (!personalWeekActor() || personalWeek.actor !== personalWeekActor() || !personalWeek.loadedAt) return [];
  return personalWeek.items.filter(item => item.kind !== 'equipment' && item.id !== ignoreId
    && item.end > Date.now() && item.start < end && start < item.end);
}

function personalConflictHtml(start, end, memberId, ignoreId = '') {
  if (memberId !== currentMemberRecord()?.id || !personalWeekActor()) return '';
  if (personalWeek.actor !== personalWeekActor() || !personalWeek.loadedAt) return '<p class="personal-conflict-hint">Checking your other commitments…</p>';
  const conflict = personalConflicts(start, end, ignoreId)[0];
  if (!conflict) return personalWeek.errors.length ? '<p class="personal-conflict-hint">Some commitments could not be checked. Review My week before booking.</p>' : '';
  return `<p class="personal-conflict-hint warning">Overlaps ${escapeHtml(conflict.title)}${conflict.tentative ? ' (Maybe)' : ''}. <button type="button" data-personal-week-open>Review My week</button></p>`;
}

async function refreshPersonalConflictHints() {
  if (!await loadPersonalWeek()) return;
  if (typeof renderSignupBookingSummary === 'function') renderSignupBookingSummary();
  if (typeof paintSacSignupActions === 'function') paintSacSignupActions();
}

function renderPersonalWeek() {
  const list = document.getElementById('personal-week-days');
  const status = document.getElementById('personal-week-status');
  if (!list || !status) return;
  if (!personalWeekActor() || personalWeek.actor !== personalWeekActor()) { list.innerHTML = ''; status.textContent = 'A linked club membership is required.'; return; }
  const monday = personalWeek.monday || personalWeekMonday();
  document.getElementById('personal-week-range').textContent = `${formatBerlinDateTime(`${monday}T12:00:00Z`, { day: 'numeric', month: 'short' })} – ${formatBerlinDateTime(`${personalDateOffset(monday, 6)}T12:00:00Z`, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  document.getElementById('personal-week-previous').disabled = monday <= personalWeekMonday();
  status.textContent = personalWeek.errors.length ? `${personalWeek.errors.join(', ')} could not load. This view may be incomplete.` : personalWeek.loadedAt ? 'Berlin time · Open a commitment to review its details.' : 'Loading your commitments…';
  document.getElementById('personal-week-retry').hidden = !personalWeek.errors.length;
  list.innerHTML = personalWeek.loadedAt ? Array.from({ length: 7 }, (_, index) => {
    const date = personalDateOffset(monday, index);
    const start = berlinTimestamp(date, '00:00'); const end = berlinTimestamp(personalDateOffset(date, 1), '00:00');
    const items = personalWeek.items.filter(item => item.start < end && item.end > start);
    return `<section class="personal-week-day${date === berlinDateKey() ? ' today' : ''}"><h3>${escapeHtml(formatBerlinDateTime(`${date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' }))}</h3><div>${items.map(item => {
      const overlaps = item.kind !== 'equipment' && personalConflicts(item.start, item.end, item.id).length;
      const time = `${formatBerlinDateTime(Math.max(start, item.start), { hour: '2-digit', minute: '2-digit' })} – ${formatBerlinDateTime(Math.min(end, item.end), { hour: '2-digit', minute: '2-digit' })}`;
      return `<a class="personal-week-item${overlaps ? ' overlapping' : ''}" href="${escapeHtml(personalDestinationUrl(item.page, item.workspace, item.params))}" data-personal-destination="${item.workspace}"><span class="personal-week-club">${item.workspace === 'sac' ? 'SAC' : 'Media Club'}</span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(time)}</span><small>${escapeHtml(item.detail)}${item.tentative && item.kind !== 'meeting' ? ' · Maybe' : ''}</small>${item.location ? `<small>${escapeHtml(item.location)}</small>` : ''}${overlaps ? '<small class="personal-week-overlap">Overlapping commitment</small>' : ''}</a>`;
    }).join('') || '<p class="personal-week-free">Nothing upcoming</p>'}</div></section>`;
  }).join('') : '';
}

async function openPersonalWeek() {
  if (!personalWeekActor()) return;
  personalWeek.monday = personalWeekMonday();
  const pending = loadPersonalWeek(true);
  openModal('personal-week-modal'); renderPersonalWeek();
  if (await pending && document.getElementById('personal-week-modal')?.classList.contains('open')) renderPersonalWeek();
}

function resetPersonalWeek() {
  personalWeek.request += 1; personalWeek.actor = ''; personalWeek.items = []; personalWeek.errors = [];
  personalWeek.loadedAt = 0; personalWeek.pending = null;
  const list = document.getElementById('personal-week-days'); if (list) list.innerHTML = '';
  closeModal('personal-week-modal');
}
window.resetPersonalWeek = resetPersonalWeek;
window.personalConflictHtml = personalConflictHtml;
window.refreshPersonalConflictHints = refreshPersonalConflictHints;
window.syncPersonalWeekButtons = () => document.querySelectorAll('[data-personal-week-open]').forEach(button => { button.hidden = !personalWeekActor(); });

document.addEventListener('click', event => {
  const open = event.target.closest?.('[data-personal-week-open]');
  if (open) { openPersonalWeek(); return; }
  const step = event.target.closest?.('[data-personal-week-step]');
  if (step) {
    personalWeek.monday = step.dataset.personalWeekStep === 'today' ? personalWeekMonday() : personalDateOffset(personalWeek.monday, Number(step.dataset.personalWeekStep));
    renderPersonalWeek(); return;
  }
  if (event.target.closest?.('#personal-week-retry')) { openPersonalWeek(); return; }
  const link = event.target.closest?.('[data-personal-destination]');
  if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault(); openPersonalDestination(link.getAttribute('href'), link.dataset.personalDestination);
  }
}, true);
