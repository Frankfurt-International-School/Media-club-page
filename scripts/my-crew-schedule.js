// Personal Media Club assignments, meeting RSVPs, and loans. Attendance stays separate.
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
  const meetings = state.meetings.filter(meeting => !meeting.archivedAt && canViewMeeting(meeting))
    .map(meeting => ({ id: `meeting:${meeting.id}`, kind: 'meeting', meeting, response: ownMeetingResponse(meeting),
      title: meeting.title, location: meeting.location || 'Location to be confirmed',
      start: Date.parse(meeting.startsAt), end: Date.parse(meeting.endsAt), url: pageUrl('meetings', { meeting: meeting.id }) }))
    .filter(item => ['attending', 'maybe'].includes(item.response) && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.end > now);
  return [...assignments, ...meetings, ...loans].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
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
  if (item.kind === 'meeting') return `RSVP: ${item.response === 'attending' ? 'Going' : 'Maybe'}. Update your response on the meeting page. A calendar entry does not record attendance.`;
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

function crewScheduleAttention(items, now = Date.now()) {
  return items.flatMap(item => {
    let reason; let deadline;
    if (item.kind === 'assignment' && item.signup.confirmationStatus === 'maybe') {
      reason = crewScheduleNeedsConfirmation(item, now) ? 'confirm' : 'review';
      deadline = Date.parse(item.signup.confirmationDeadline);
    } else if (item.kind === 'meeting' && item.response === 'maybe') {
      reason = 'meeting_maybe'; deadline = item.start;
    } else if (item.kind === 'equipment' && (item.end <= now || berlinDateKey(item.end) === berlinDateKey(now))) {
      reason = item.end <= now ? 'return_due' : 'return_today'; deadline = item.end;
    }
    return reason ? [{ ...item, reason, deadline }] : [];
  }).sort((a, b) => ({ return_due: 0, review: 1, confirm: 2, meeting_maybe: 3, return_today: 4 }[a.reason]
    - { return_due: 0, review: 1, confirm: 2, meeting_maybe: 3, return_today: 4 }[b.reason]) || a.deadline - b.deadline || a.id.localeCompare(b.id));
}

function crewScheduleTomorrowKey(now) {
  const tomorrow = new Date(`${berlinDateKey(now)}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function crewScheduleAgendaGroups(items, now = Date.now()) {
  const today = berlinDateKey(now);
  const tomorrowKey = crewScheduleTomorrowKey(now);
  const groups = new Map();
  items.forEach(item => {
    const key = item.end <= now ? 'earlier' : berlinDateKey(item.start <= now ? now : item.start);
    if (!groups.has(key)) groups.set(key, { key, items: [],
      label: key === 'earlier' ? 'Earlier equipment bookings' : key === today ? 'Today' : key === tomorrowKey ? 'Tomorrow'
        : formatBerlinDateTime(`${key}T12:00:00Z`, { weekday: 'long' }),
      date: key === 'earlier' ? 'Check the saved return time on each booking.'
        : formatBerlinDateTime(`${key}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' }) });
    groups.get(key).items.push(item);
  });
  return [...groups.values()].sort((a, b) => a.key === b.key ? 0 : a.key === 'earlier' ? -1 : b.key === 'earlier' ? 1 : a.key.localeCompare(b.key));
}

function renderCrewScheduleOverview(items, now) {
  if (!items.length) return '';
  const next = items.find(item => crewScheduleCalendarEligible(item, now));
  const attention = crewScheduleAttention(items, now);
  const nextLabel = next && next.start <= now ? next.kind !== 'equipment' ? 'On now' : 'Current booking' : 'Up next';
  const meetingMaybe = next?.kind === 'meeting' && next.response === 'maybe';
  const nextCard = next ? `<span class="page-kicker">${nextLabel}</span><h2>${escapeHtml(next.title)}</h2><p>${escapeHtml(formatBerlinDateTime(next.start, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · Berlin time</p><p>${escapeHtml(next.location)}</p>${meetingMaybe ? '<p class="crew-agenda-tentative">RSVP: Maybe — review your response on the meeting page.</p>' : next.kind === 'assignment' && next.signup.confirmationStatus === 'maybe' ? '<p class="crew-agenda-tentative">Tentative — confirm this booking on its sheet.</p>' : ''}<a class="btn btn-accent btn-sm" href="${escapeHtml(next.url)}">${next.kind === 'meeting' ? 'Open meeting' : 'Open next booking'} →</a>`
    : '<span class="page-kicker">Up next</span><h2>No upcoming booking in this view</h2><p>Review any outstanding items alongside, or choose a new crew role or equipment booking.</p>';
  const actions = attention.map(item => {
    const label = { return_due: 'Return due', return_today: 'Return today', review: 'Confirmation deadline passed', confirm: 'Confirm your place', meeting_maybe: 'Maybe meeting response' }[item.reason];
    const action = item.kind === 'meeting' ? 'Review RSVP' : item.kind === 'equipment' ? 'Open equipment' : item.reason === 'review' ? 'Review sheet' : 'Confirm this booking';
    const detail = item.reason === 'meeting_maybe' ? 'Your response is Maybe. You can update it on the meeting page.' : item.reason === 'review' ? 'Check current availability on the sheet.'
      : `${item.kind === 'equipment' ? 'Return by' : 'Confirm by'} ${formatBerlinDateTime(item.deadline, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} Berlin time.`;
    return `<li class="crew-agenda-attention-item"><div><span>${label}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(detail)}</p></div><a href="${escapeHtml(item.url)}">${action} →</a></li>`;
  }).join('');
  return `<section class="crew-agenda-next" aria-label="Next booking">${nextCard}</section><section class="crew-agenda-attention" aria-label="Booking reminders"><div class="crew-agenda-attention-head"><h2>Needs attention</h2><span class="badge badge-${attention.length ? 'amber' : 'green'}">${attention.length}</span></div>${attention.length ? `<p class="crew-agenda-hint">For the bookings in this view.</p><ul>${actions}</ul>` : '<div class="crew-agenda-clear"><strong>You’re up to date</strong><p>No confirmations or equipment returns need attention in this view.</p></div>'}</section>`;
}

function crewScheduleCard(item, now) {
  const needsConfirmation = crewScheduleNeedsConfirmation(item, now);
  const maybe = item.kind === 'assignment' && item.signup.confirmationStatus === 'maybe' || item.kind === 'meeting' && item.response === 'maybe';
  const returnDue = item.kind === 'equipment' && item.end <= now;
  const status = item.kind === 'meeting' ? item.response === 'maybe' ? 'RSVP: Maybe' : 'RSVP: Going' : maybe ? needsConfirmation ? 'Needs confirmation' : 'Deadline passed'
    : item.kind === 'assignment' ? item.start <= now ? 'On now' : 'Confirmed'
      : returnDue ? 'Return due' : reservationLifecycleStatus(item.reservation, now) === 'checked_out' ? 'Checked out' : 'Reserved';
  return `<article class="crew-personal-card${maybe || returnDue ? ' needs-confirmation' : ''}"><div class="crew-personal-card-head"><span class="page-kicker">${item.kind === 'meeting' ? 'Club meeting' : item.kind === 'assignment' ? 'Crew assignment' : 'Equipment loan'}</span><span class="badge badge-${maybe || returnDue ? 'amber' : item.kind !== 'equipment' ? 'green' : 'blue'}">${status}</span></div><h3>${escapeHtml(item.title)}</h3><p class="crew-personal-time">${escapeHtml(formatBerlinDateTime(item.start, { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} – ${escapeHtml(formatBerlinDateTime(item.end, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · Berlin time</p><p>${escapeHtml(item.location)}</p><p class="crew-personal-detail">${escapeHtml(crewScheduleDetail(item))}</p><div class="crew-personal-actions"><a class="btn ${needsConfirmation ? 'btn-accent' : 'btn-ghost'} btn-sm" href="${escapeHtml(item.url)}">${item.kind === 'meeting' ? 'Review RSVP' : needsConfirmation ? 'Confirm on sheet' : item.kind === 'assignment' ? 'View sheet' : 'View equipment'}</a>${crewScheduleCalendarEligible(item, now) ? `<button class="btn btn-ghost btn-sm" type="button" data-crew-calendar-id="${escapeHtml(item.id)}">Add to calendar</button>` : ''}</div></article>`;
}

function buildCrewScheduleCalendar(items, origin, now = Date.now()) {
  if (!Number.isFinite(now)) return '';
  const entries = items.filter(item => crewScheduleCalendarEligible(item, now));
  if (!entries.length) return '';
  const timestamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FIS Media Club//My Crew Schedule//EN', 'CALSCALE:GREGORIAN'];
  entries.forEach(item => {
    const tentative = item.kind === 'assignment' && item.signup.confirmationStatus === 'maybe' || item.kind === 'meeting' && item.response === 'maybe';
    const description = `${crewScheduleDetail(item)}\nCheck Crew Center for the latest details. If a booking changes or is cancelled, update or remove this entry in your calendar.`;
    lines.push('BEGIN:VEVENT', `UID:media-${encodeURIComponent(item.id)}@fismediaclub.org`,
      `DTSTAMP:${timestamp(now)}`, `DTSTART:${timestamp(item.start)}`, `DTEND:${timestamp(item.end)}`,
      `STATUS:${tentative ? 'TENTATIVE' : 'CONFIRMED'}`, 'CLASS:PRIVATE',
      `SUMMARY:${escapeSacCalendarText(`${item.kind === 'meeting' ? 'Club meeting' : item.kind === 'equipment' ? 'Equipment loan' : 'Media crew'} — ${item.title}`)}`,
      `DESCRIPTION:${escapeSacCalendarText(description)}`, `LOCATION:${escapeSacCalendarText(item.location)}`,
      `URL:${new URL(item.url, origin).href}`, 'END:VEVENT');
  });
  return [...lines, 'END:VCALENDAR', ''].map(foldSacCalendarLine).join('\r\n');
}

function downloadCrewScheduleCalendar(itemId = '') {
  if (currentCrewCenterWorkspace() !== 'media' || !canAccessMyCrewSchedule()
    || !state.dataLoaded.events || !state.dataLoaded.equipment || !state.dataLoaded.meetings
    || state.dataErrors.events || state.dataErrors.equipment || state.dataErrors.meetings) return;
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
  if (!['all', 'assignment', 'equipment', 'meeting'].includes(filter)) return;
  myCrewScheduleFilter = filter;
  renderMyCrewSchedule();
}

async function refreshMyCrewSchedule() {
  if (currentCrewCenterWorkspace() !== 'media' || !canAccessMyCrewSchedule()) return;
  const button = document.getElementById('my-crew-schedule-refresh');
  if (button?.disabled) return;
  if (button) button.disabled = true;
  const actorId = window.CREW_CENTER_AUTH_USER?.id;
  try { await loadCrewCenterData({ datasets: ['events', 'equipment', 'meetings'], silent: true }); }
  finally {
    if (button) button.disabled = false;
    if (actorId === window.CREW_CENTER_AUTH_USER?.id && currentCrewCenterWorkspace() === 'media') renderMyCrewSchedule();
  }
}

function renderMyCrewSchedule() {
  window.syncPersonalWeekButtons?.();
  window.syncMediaCalendarSubscriptions?.();
  if (myCrewScheduleRefreshTimer) clearTimeout(myCrewScheduleRefreshTimer);
  myCrewScheduleRefreshTimer = null;
  const list = document.getElementById('my-crew-schedule-list');
  if (!list) return;
  document.querySelectorAll('[data-crew-schedule-filter]').forEach(button => {
    const selected = button.dataset.crewScheduleFilter === myCrewScheduleFilter;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('active', selected);
  });
  if (typeof updateSlidingTab === 'function') updateSlidingTab(document.querySelector('#page-my-crew-schedule .crew-personal-filters'));
  const stats = document.getElementById('my-crew-schedule-stats');
  const download = document.getElementById('my-crew-schedule-download');
  const calendarStatus = document.getElementById('my-crew-schedule-calendar-status');
  const overview = document.getElementById('my-crew-schedule-overview');
  if (overview) { overview.innerHTML = ''; overview.hidden = true; }
  stats.innerHTML = ''; download.disabled = true;
  calendarStatus.textContent = 'Loading your bookings…';
  if (currentCrewCenterWorkspace() !== 'media' || !canAccessMyCrewSchedule()) {
    calendarStatus.textContent = 'A Media Club member account is required.';
    list.innerHTML = '<div class="crew-personal-empty" role="status">A Media Club member account is required to see a personal schedule.</div>';
    return;
  }
  if (state.dataErrors.events || state.dataErrors.equipment || state.dataErrors.meetings) {
    calendarStatus.textContent = 'Refresh your schedule before downloading.';
    list.innerHTML = '<div class="crew-personal-empty" role="status"><strong>Your schedule could not be refreshed.</strong><p>Retry to load your assignments, meeting responses, and equipment bookings.</p><button class="btn btn-ghost" type="button" onclick="refreshMyCrewSchedule()">Retry</button></div>';
    return;
  }
  if (!state.dataLoaded.events || !state.dataLoaded.equipment || !state.dataLoaded.meetings) {
    list.innerHTML = '<div class="crew-personal-empty" role="status">Loading your crew schedule…</div>';
    return;
  }
  const now = Date.now();
  const items = ownCrewScheduleItems(now);
  const nextChange = [...items.flatMap(item => item.kind === 'equipment'
    ? [item.start, item.end, item.end + 15 * 60 * 1000]
    : item.kind === 'meeting' ? [item.start, item.end] : [item.start, item.end, item.signup.confirmationStatus === 'maybe' ? Date.parse(item.signup.confirmationDeadline) : NaN]),
    ...(items.length ? [berlinTimestamp(crewScheduleTomorrowKey(now), '00:00')] : [])]
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > now).sort((a, b) => a - b)[0];
  if (nextChange) myCrewScheduleRefreshTimer = setTimeout(() => {
    if (document.querySelector('.page.active')?.id === 'page-my-crew-schedule') renderMyCrewSchedule();
  }, Math.min(nextChange - now + 100, 2147483647));
  const assignments = items.filter(item => item.kind === 'assignment');
  const loans = items.filter(item => item.kind === 'equipment');
  const pending = assignments.filter(item => crewScheduleNeedsConfirmation(item, now));
  stats.innerHTML = [[assignments.length, 'Crew assignments'], [loans.length, 'Equipment loans'], [items.filter(item => item.kind === 'meeting').length, 'Club meetings'], [pending.length, 'To confirm']]
    .map(([count, label]) => `<div class="crew-personal-stat"><strong>${count}</strong><span>${label}</span></div>`).join('');
  const visible = items.filter(item => myCrewScheduleFilter === 'all' || item.kind === myCrewScheduleFilter);
  if (overview) { overview.innerHTML = renderCrewScheduleOverview(visible, now); overview.hidden = !visible.length; }
  const calendarItems = visible.filter(item => crewScheduleCalendarEligible(item, now));
  download.disabled = !calendarItems.length;
  calendarStatus.textContent = calendarItems.length
    ? `${calendarItems.length} ${calendarItems.length === 1 ? 'booking' : 'bookings'} in this view · .ics file`
    : items.length ? 'No upcoming bookings in this view to export.' : 'Add a crew role, meeting RSVP, or equipment booking first.';
  list.innerHTML = visible.length ? crewScheduleAgendaGroups(visible, now).map(group => `<section class="crew-agenda-day" aria-label="${escapeHtml(`${group.label} · ${group.date}`)}"><header class="crew-agenda-day-head"><div><h2>${escapeHtml(group.label)}</h2><p>${escapeHtml(group.date)}</p></div><span>${group.items.length} ${group.items.length === 1 ? 'booking' : 'bookings'}</span></header><div class="crew-agenda-cards">${group.items.map(item => crewScheduleCard(item, now)).join('')}</div></section>`).join('')
    : `<div class="crew-personal-empty" role="status"><strong>${myCrewScheduleFilter === 'meeting' ? 'No upcoming meetings you have marked Going or Maybe.' : `No upcoming ${myCrewScheduleFilter === 'all' ? 'assignments, meetings or equipment loans' : myCrewScheduleFilter === 'assignment' ? 'crew assignments' : 'equipment loans'}.`}</strong><p>${myCrewScheduleFilter === 'meeting' ? 'Respond on the Meetings page to add a meeting to your agenda.' : 'Choose a production role, respond to a meeting, or reserve equipment when you are ready.'}</p><a class="btn btn-accent" href="${escapeHtml(pageUrl(myCrewScheduleFilter === 'meeting' ? 'meetings' : myCrewScheduleFilter === 'equipment' ? 'equipment' : 'signup'))}">${myCrewScheduleFilter === 'meeting' ? 'Open meetings' : myCrewScheduleFilter === 'equipment' ? 'Find equipment' : 'Find a crew role'}</a></div>`;
}

document.getElementById('page-my-crew-schedule')?.addEventListener('click', event => {
  const filter = event.target.closest('[data-crew-schedule-filter]');
  const calendar = event.target.closest('[data-crew-calendar-id]');
  if (filter) selectMyCrewScheduleFilter(filter.dataset.crewScheduleFilter);
  if (calendar) downloadCrewScheduleCalendar(calendar.dataset.crewCalendarId);
});
