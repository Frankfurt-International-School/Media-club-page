// Personal Media Club assignments and loans. Operational crew attendance stays separate.
let myCrewScheduleFilter = 'all';
let myCrewScheduleRefreshTimer = null;

function ownCrewScheduleItems(now = Date.now()) {
  if (!canAccessMyCrewSchedule()) return [];
  const memberId = currentMemberRecord().id;
  const assignments = state.events.flatMap(event => (event.signups || [])
    .filter(signup => signup.memberId === memberId && signup.confirmationStatus !== 'expired')
    .map(signup => ({ id: `assignment:${signup.id}`, kind: 'assignment', signup,
      title: event.title, location: event.loc || 'Location to be confirmed',
      start: Date.parse(signup.attendanceStart), end: Date.parse(signup.attendanceEnd),
      url: pageUrl('signup', { event: event.id }) })))
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.end > now);
  const loans = state.equipment.flatMap(item => (item.reservations || [])
    .filter(reservation => reservation.memberId === memberId && ['scheduled', 'checked_out'].includes(reservationLifecycleStatus(reservation, now)))
    .map(reservation => ({ id: `equipment:${reservation.id}`, kind: 'equipment', reservation,
      title: item.name, location: 'Media Club equipment',
      start: Date.parse(reservation.startsAt), end: Date.parse(reservation.endsAt), url: pageUrl('equipment') })))
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
  return [...assignments, ...loans].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

function crewScheduleNeedsConfirmation(item, now = Date.now()) {
  return item.kind === 'assignment' && item.signup.confirmationStatus === 'maybe'
    && Date.parse(item.signup.confirmationDeadline) > now;
}

function crewScheduleCalendarEligible(item, now = Date.now()) {
  return Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.end > now
    && (item.kind !== 'assignment' || item.signup.confirmationStatus !== 'maybe' || crewScheduleNeedsConfirmation(item, now));
}

function crewScheduleDetail(item) {
  if (item.kind === 'equipment') return `Return by ${formatBerlinDateTime(item.end, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} Berlin time.`;
  const signup = item.signup;
  const details = [signup.role || (signup.attendanceType === 'setup' ? 'Setup' : signup.attendanceType === 'takedown' ? 'Takedown' : 'Crew assignment')];
  if (signup.reserveRole1) details.push(`Reserve priorities: ${[signup.reserveRole1, signup.reserveRole2].filter(Boolean).join(' → ')}`);
  if (signup.role === 'Photographer') details.push(signup.equipmentSource === 'own' ? `Personal camera: ${signup.ownCameraName}` : 'Club camera: check your equipment booking');
  if (signup.confirmationStatus === 'maybe') details.push(crewScheduleNeedsConfirmation(item)
    ? `Please confirm by ${formatBerlinDateTime(signup.confirmationDeadline, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} Berlin time.`
    : 'The confirmation deadline has passed. Check the sheet for current availability.');
  return details.join(' · ');
}

function buildCrewScheduleCalendar(items, origin, now = Date.now()) {
  if (!Number.isFinite(now)) return '';
  const entries = items.filter(item => crewScheduleCalendarEligible(item, now));
  if (!entries.length) return '';
  const timestamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FIS Media Club//My Crew Schedule//EN', 'CALSCALE:GREGORIAN'];
  entries.forEach(item => {
    const tentative = item.kind === 'assignment' && item.signup.confirmationStatus === 'maybe';
    const description = `${crewScheduleDetail(item)}\nCheck Crew Center for the latest details. If a booking changes or is cancelled, update or remove this entry in your calendar.`;
    lines.push('BEGIN:VEVENT', `UID:media-${encodeURIComponent(item.id)}@fismediaclub.org`,
      `DTSTAMP:${timestamp(now)}`, `DTSTART:${timestamp(item.start)}`, `DTEND:${timestamp(item.end)}`,
      `STATUS:${tentative ? 'TENTATIVE' : 'CONFIRMED'}`, 'CLASS:PRIVATE',
      `SUMMARY:${escapeSacCalendarText(`${item.kind === 'equipment' ? 'Equipment loan' : 'Media crew'} — ${item.title}`)}`,
      `DESCRIPTION:${escapeSacCalendarText(description)}`, `LOCATION:${escapeSacCalendarText(item.location)}`,
      `URL:${new URL(item.url, origin).href}`, 'END:VEVENT');
  });
  return [...lines, 'END:VCALENDAR', ''].map(foldSacCalendarLine).join('\r\n');
}

function downloadCrewScheduleCalendar(itemId = '') {
  if (currentCrewCenterWorkspace() !== 'media' || !canAccessMyCrewSchedule()
    || !state.dataLoaded.events || !state.dataLoaded.equipment || state.dataErrors.events || state.dataErrors.equipment) return;
  const ownItems = ownCrewScheduleItems();
  const selected = itemId ? ownItems.filter(item => item.id === itemId) : ownItems.filter(item => myCrewScheduleFilter === 'all' || item.kind === myCrewScheduleFilter);
  const calendar = buildCrewScheduleCalendar(selected, window.location.origin);
  if (!calendar) { showToast('No current bookings are available to download. Refresh your schedule.', 'error'); return; }
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'media-club-crew-schedule.ics';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Calendar downloaded. Open the file in your calendar app.');
}

function selectMyCrewScheduleFilter(filter) {
  if (!['all', 'assignment', 'equipment'].includes(filter)) return;
  myCrewScheduleFilter = filter;
  renderMyCrewSchedule();
}

async function refreshMyCrewSchedule() {
  if (currentCrewCenterWorkspace() !== 'media' || !canAccessMyCrewSchedule()) return;
  const button = document.getElementById('my-crew-schedule-refresh');
  if (button?.disabled) return;
  if (button) button.disabled = true;
  const actorId = window.CREW_CENTER_AUTH_USER?.id;
  try { await loadCrewCenterData({ datasets: ['events', 'equipment'], silent: true }); }
  finally {
    if (button) button.disabled = false;
    if (actorId === window.CREW_CENTER_AUTH_USER?.id && currentCrewCenterWorkspace() === 'media') renderMyCrewSchedule();
  }
}

function renderMyCrewSchedule() {
  if (myCrewScheduleRefreshTimer) clearTimeout(myCrewScheduleRefreshTimer);
  myCrewScheduleRefreshTimer = null;
  const list = document.getElementById('my-crew-schedule-list');
  if (!list) return;
  const stats = document.getElementById('my-crew-schedule-stats');
  const download = document.getElementById('my-crew-schedule-download');
  stats.innerHTML = ''; download.disabled = true;
  if (currentCrewCenterWorkspace() !== 'media' || !canAccessMyCrewSchedule()) {
    list.innerHTML = '<div class="crew-personal-empty" role="status">A Media Club member account is required to see a personal schedule.</div>';
    return;
  }
  if (state.dataErrors.events || state.dataErrors.equipment) {
    list.innerHTML = '<div class="crew-personal-empty" role="status"><strong>Your schedule could not be refreshed.</strong><p>Retry to load your current assignments and equipment bookings.</p><button class="btn btn-ghost" type="button" onclick="refreshMyCrewSchedule()">Retry</button></div>';
    return;
  }
  if (!state.dataLoaded.events || !state.dataLoaded.equipment) {
    list.innerHTML = '<div class="crew-personal-empty" role="status">Loading your crew schedule…</div>';
    return;
  }
  const now = Date.now();
  const items = ownCrewScheduleItems(now);
  const nextChange = items.flatMap(item => item.kind === 'equipment'
    ? [item.start, item.end, item.end + 15 * 60 * 1000]
    : [item.end, item.signup.confirmationStatus === 'maybe' ? Date.parse(item.signup.confirmationDeadline) : NaN])
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > now).sort((a, b) => a - b)[0];
  if (nextChange) myCrewScheduleRefreshTimer = setTimeout(() => {
    if (document.querySelector('.page.active')?.id === 'page-my-crew-schedule') renderMyCrewSchedule();
  }, Math.min(nextChange - now + 100, 2147483647));
  const assignments = items.filter(item => item.kind === 'assignment');
  const loans = items.filter(item => item.kind === 'equipment');
  const pending = assignments.filter(item => crewScheduleNeedsConfirmation(item, now));
  stats.innerHTML = [[assignments.length, 'Crew assignments'], [loans.length, 'Equipment loans'], [pending.length, 'To confirm']]
    .map(([count, label]) => `<div class="crew-personal-stat"><strong>${count}</strong><span>${label}</span></div>`).join('');
  document.querySelectorAll('[data-crew-schedule-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.crewScheduleFilter === myCrewScheduleFilter)));
  const visible = items.filter(item => myCrewScheduleFilter === 'all' || item.kind === myCrewScheduleFilter);
  download.disabled = !visible.some(item => crewScheduleCalendarEligible(item, now));
  list.innerHTML = visible.length ? visible.map(item => {
    const needsConfirmation = crewScheduleNeedsConfirmation(item, now);
    const maybe = item.kind === 'assignment' && item.signup.confirmationStatus === 'maybe';
    const status = maybe ? needsConfirmation ? 'Needs confirmation' : 'Deadline passed' : item.kind === 'assignment' ? 'Confirmed'
      : item.end <= now ? 'Return due' : reservationLifecycleStatus(item.reservation, now) === 'checked_out' ? 'Checked out' : 'Reserved';
    return `<article class="crew-personal-card${maybe ? ' needs-confirmation' : ''}"><div class="crew-personal-card-head"><span class="page-kicker">${item.kind === 'assignment' ? 'Crew assignment' : 'Equipment loan'}</span><span class="badge badge-${maybe ? 'amber' : item.kind === 'assignment' ? 'green' : 'blue'}">${status}</span></div><h2>${escapeHtml(item.title)}</h2><p class="crew-personal-time">${escapeHtml(formatBerlinDateTime(item.start, { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} – ${escapeHtml(formatBerlinDateTime(item.end, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · Berlin time</p><p>${escapeHtml(item.location)}</p><p class="crew-personal-detail">${escapeHtml(crewScheduleDetail(item))}</p><div class="crew-personal-actions"><a class="btn ${needsConfirmation ? 'btn-accent' : 'btn-ghost'} btn-sm" href="${escapeHtml(item.url)}">${needsConfirmation ? 'Confirm on sheet' : item.kind === 'assignment' ? 'View sheet' : 'View equipment'}</a>${crewScheduleCalendarEligible(item, now) ? `<button class="btn btn-ghost btn-sm" type="button" data-crew-calendar-id="${escapeHtml(item.id)}">Add to calendar</button>` : ''}</div></article>`;
  }).join('') : `<div class="crew-personal-empty" role="status"><strong>No upcoming ${myCrewScheduleFilter === 'all' ? 'assignments or equipment loans' : myCrewScheduleFilter === 'assignment' ? 'crew assignments' : 'equipment loans'}.</strong><p>Choose a production role or reserve equipment when you are ready.</p><a class="btn btn-accent" href="${escapeHtml(pageUrl(myCrewScheduleFilter === 'equipment' ? 'equipment' : 'signup'))}">${myCrewScheduleFilter === 'equipment' ? 'Find equipment' : 'Find a crew role'}</a></div>`;
}

document.getElementById('page-my-crew-schedule')?.addEventListener('click', event => {
  const filter = event.target.closest('[data-crew-schedule-filter]');
  const calendar = event.target.closest('[data-crew-calendar-id]');
  if (filter) selectMyCrewScheduleFilter(filter.dataset.crewScheduleFilter);
  if (calendar) downloadCrewScheduleCalendar(calendar.dataset.crewCalendarId);
});
