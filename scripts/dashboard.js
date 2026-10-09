// ══════════════════════════════
// DASHBOARD
// ══════════════════════════════
function dashboardUpcomingEvents() {
  const today = berlinDateKey();
  return state.events.filter(event => event.date >= today).slice().sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

function ownDashboardCommitments() {
  const today = berlinDateKey();
  return ownUpcomingSignups()
    .filter(({ event }) => event.date >= today)
    .sort((a, b) => (a.signup.attendanceStart || `${a.event.date}T${a.event.time}`).localeCompare(b.signup.attendanceStart || `${b.event.date}T${b.event.time}`));
}

function ownDashboardReservations() {
  const memberId = currentMemberRecord()?.id;
  if (!memberId) return [];
  return state.equipment.flatMap(item => item.reservations.map(reservation => ({ item, reservation })))
    .filter(({ reservation }) => reservation.memberId === memberId && ['scheduled', 'checked_out'].includes(reservationLifecycleStatus(reservation)))
    .sort((a, b) => a.reservation.startsAt.localeCompare(b.reservation.startsAt));
}

function dashboardStatValues() {
  const today = berlinDateKey();
  const monthStartKey = `${today.slice(0, 7)}-01`;
  const upcomingEvents = dashboardUpcomingEvents();
  const commitments = ownDashboardCommitments();
  const reservations = ownDashboardReservations();
  const membersThisMonth = state.members.filter(member => member.joined_date && member.joined_date >= monthStartKey).length;
  const projectsThisMonth = state.gallery.filter(project => project.created_at && berlinDateKey(project.created_at) >= monthStartKey).length;
  const availableEquipment = state.equipment.filter(item => equipmentDisplayStatus(item) === 'available').length;
  const checkedOutEquipment = state.equipment.filter(item => equipmentDisplayStatus(item) === 'checked_out').length;
  const eventCategories = new Set(upcomingEvents.map(event => event.cat).filter(Boolean));
  const pendingConfirmations = commitments.filter(({ signup }) => signup.confirmationStatus === 'maybe').length;
  const activeReservations = reservations.filter(({ reservation }) => reservationLifecycleStatus(reservation) === 'checked_out').length;
  const pendingApplications = state.applications.filter(application => application.status === 'pending').length;
  return {
    my_assignments: { value: commitments.length, sub: pendingConfirmations ? `${pendingConfirmations} awaiting confirmation` : commitments.length ? 'All currently confirmed' : 'No upcoming assignments' },
    upcoming_events: { value: upcomingEvents.length, sub: upcomingEvents.length ? `Next ${fmtDate(upcomingEvents[0].date)}` : 'Nothing currently scheduled' },
    available_equipment: { value: availableEquipment, sub: state.equipment.length ? `${state.equipment.length} items in the register` : 'Equipment register is empty' },
    my_reservations: { value: reservations.length, sub: activeReservations ? `${activeReservations} checked out now` : reservations.length ? 'Upcoming loans scheduled' : 'No active reservations' },
    projects: { value: state.gallery.length, sub: projectsThisMonth ? `${projectsThisMonth} added this month` : 'Ready for new submissions' },
    event_categories: { value: eventCategories.size, sub: eventCategories.size ? 'Across upcoming productions' : 'Explore the Media Role Guide' },
    members: { value: state.members.length, sub: `${membersThisMonth} joined this month` },
    checked_out: { value: checkedOutEquipment, sub: checkedOutEquipment ? 'Currently with members' : 'Everything has been returned' },
    pending_applications: { value: pendingApplications, sub: pendingApplications ? 'Waiting for review' : 'Application queue is clear' },
  };
}

function dashboardEventCountdown(event) {
  const startsAt = timeValue(event.date, event.time);
  if (!startsAt) return 'Time to be confirmed';
  const remaining = startsAt - Date.now();
  if (remaining <= 0 && event.date === berlinDateKey()) return 'Happening today';
  if (remaining <= 0) return 'Event started';
  const days = Math.floor(remaining / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} away`;
  const hours = Math.max(1, Math.ceil(remaining / 3600000));
  return `${hours} hour${hours === 1 ? '' : 's'} away`;
}

function renderDashboardFocus(upcomingEvents, commitments) {
  const focus = document.getElementById('dashboard-focus');
  if (!focus) return;
  const ownNext = commitments[0];
  const event = ownNext?.event || upcomingEvents[0];
  if (!event) {
    const title = isVisitorSession() ? 'No upcoming events' : 'Your schedule is clear';
    focus.innerHTML = `<div class="dashboard-hero-copy"><div class="dashboard-eyebrow">Next up</div><div class="dashboard-hero-title">${title}</div><div class="dashboard-hero-meta"><span>No upcoming Media Club events are currently scheduled.</span></div></div><div class="dashboard-hero-action"><a class="btn btn-accent" href="${pageUrl('events')}">Open events</a></div>`;
    return;
  }
  const signup = ownNext?.signup;
  const actionPage = signup ? 'signup' : 'events';
  const actionLabel = signup ? 'Open sign-up sheet' : 'View event';
  const attendance = signup ? attendanceLabel(signup) : '';
  const actionUrl = pageUrl(actionPage, signup ? { event: event.id } : {});
  focus.innerHTML = `<div class="dashboard-hero-copy"><div class="dashboard-eyebrow">${signup ? 'Your next assignment' : 'Next club event'}</div><div class="dashboard-hero-title">${escapeHtml(event.title)}</div><div class="dashboard-hero-meta"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${escapeHtml(formatEventDate(event.date))}</span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>${escapeHtml(eventScheduleTimeLabel(event))}</span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(event.loc || 'TBC')}</span></div><div class="dashboard-hero-status"><span class="badge badge-${catColor(event.cat)}">${escapeHtml(event.cat)}</span><span class="badge badge-gray">${escapeHtml(dashboardEventCountdown(event))}</span>${signup ? `<span class="badge badge-green">${escapeHtml(signup.role || 'Assigned')}</span>${attendance ? `<span class="badge badge-blue">${escapeHtml(attendance)}</span>` : ''}${signup.confirmationStatus === 'maybe' ? `<span class="badge badge-amber">Confirm ${escapeHtml(confirmationCountdown(signup.confirmationDeadline))}</span>` : ''}` : ''}</div></div><div class="dashboard-hero-action"><a class="btn btn-accent" href="${escapeHtml(actionUrl)}">${actionLabel}</a></div>`;
}

function dashboardModuleShell(title, actionLabel, actionPage, body) {
  return `<section class="dashboard-module"><div class="dashboard-module-head"><div class="dashboard-module-title">${escapeHtml(title)}</div>${actionPage ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(pageUrl(actionPage))}">${escapeHtml(actionLabel)}</a>` : ''}</div><div class="dashboard-module-body">${body}</div></section>`;
}

function renderUpcomingEventsModule(upcomingEvents) {
  const body = upcomingEvents.length ? upcomingEvents.slice(0, 4).map(event => `<a class="dashboard-list-row" href="${pageUrl('events')}"><span class="dashboard-list-date"><strong>${fmtDay(event.date)}</strong><span>${fmtMonth(event.date)}</span></span><span><span class="dashboard-list-title">${escapeHtml(event.title)}</span><span class="dashboard-list-sub">${escapeHtml(eventScheduleTimeLabel(event))} · ${escapeHtml(event.loc || 'TBC')}</span></span><span class="badge badge-${catColor(event.cat)}">${escapeHtml(event.cat)}</span></a>`).join('') : '<div class="dashboard-empty">No upcoming events.</div>';
  return dashboardModuleShell('Upcoming events', 'View all', 'events', body);
}

function renderAnnouncementsModule() {
  const body = state.announcements.length ? state.announcements.slice(0, 4).map(announcement => `<div class="dashboard-list-row" style="cursor:default;"><span class="dashboard-list-date"><strong>•</strong><span>${escapeHtml(announcement.date || 'NEW')}</span></span><span><span class="dashboard-list-title">${escapeHtml(announcement.title)}</span><span class="dashboard-list-sub">${escapeHtml(announcement.body)}</span></span><span></span></div>`).join('') : '<div class="dashboard-empty">No announcements yet.</div>';
  return dashboardModuleShell('Announcements', '', '', body);
}

function renderMyCommitmentsModule(commitments, reservations) {
  const items = [
    ...commitments.map(({ event, signup }) => ({ type: 'signup', timestamp: signup.attendanceStart || `${event.date}T${event.time}`, date: event.date, title: event.title, sub: `${signup.role || 'Assignment'} · ${signup.confirmationStatus === 'maybe' ? 'Needs confirmation' : 'Confirmed'}`, page: 'signup', eventId: event.id })),
    ...reservations.map(({ item, reservation }) => ({ type: 'reservation', timestamp: reservation.startsAt, date: berlinDateKey(reservation.startsAt), title: item.name, sub: `${reservationLifecycleStatus(reservation) === 'checked_out' ? 'Checked out' : 'Reserved'} · ${formatBerlinDateTime(reservation.startsAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, page: 'equipment' })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, 5);
  const body = items.length ? items.map(item => `<a class="dashboard-list-row" href="${escapeHtml(pageUrl(item.page, item.eventId ? { event: item.eventId } : {}))}"><span class="dashboard-list-date"><strong>${fmtDay(item.date)}</strong><span>${fmtMonth(item.date)}</span></span><span><span class="dashboard-list-title">${escapeHtml(item.title)}</span><span class="dashboard-list-sub">${escapeHtml(item.sub)}</span></span><span class="badge ${item.type === 'signup' ? 'badge-green' : 'badge-blue'}">${item.type === 'signup' ? 'Role' : 'Gear'}</span></a>`).join('') : '<div class="dashboard-empty">You have no upcoming assignments or reservations.</div>';
  return dashboardModuleShell('My commitments', 'View all', 'my-crew-schedule', body);
}

function renderEquipmentSnapshotModule() {
  const counts = {
    available: state.equipment.filter(item => equipmentDisplayStatus(item) === 'available').length,
    checked_out: state.equipment.filter(item => equipmentDisplayStatus(item) === 'checked_out').length,
    unavailable: state.equipment.filter(item => equipmentDisplayStatus(item) === 'unavailable').length,
  };
  const total = Math.max(state.equipment.length, 1);
  const rows = [['available', 'Available'], ['checked_out', 'Checked out'], ['unavailable', 'Unavailable']];
  const body = state.equipment.length ? `<div class="dashboard-equipment-bars">${rows.map(([key, label], index) => {
    const percentage = Math.round((counts[key] / total) * 100);
    return `<div class="dashboard-equipment-row"><span>${label}</span><span class="dashboard-equipment-track" role="img" aria-label="${escapeHtml(label)}: ${counts[key]} of ${state.equipment.length}"><span class="dashboard-equipment-fill ${key === 'checked_out' ? 'checked' : key}" style="width:${percentage}%;animation-delay:${index * 90}ms"></span></span><strong>${counts[key]}</strong></div>`;
  }).join('')}</div>` : '<div class="dashboard-empty">The equipment register is empty.</div>';
  return dashboardModuleShell('Equipment snapshot', 'Open equipment', 'equipment', body);
}

function renderDashboard() {
  const preferences = currentDashboardPreferences();
  const upcomingEvents = dashboardUpcomingEvents();
  const commitments = ownDashboardCommitments();
  const reservations = ownDashboardReservations();
  const statValues = dashboardStatValues();
  const customize = document.getElementById('dashboard-customize-button');
  const subtitle = document.getElementById('dashboard-subtitle');
  if (customize) customize.hidden = isVisitorSession() || !currentMemberRecord();
  if (subtitle) subtitle.textContent = isVisitorSession() ? 'Explore upcoming events, published projects, and Media Club resources.' : 'Your personal Media Club operations overview.';
  renderDashboardFocus(upcomingEvents, commitments);
  document.getElementById('dashboard-stats').innerHTML = preferences.stats.map(key => {
    const definition = dashboardStatCatalog[key];
    const data = statValues[key];
    return `<article class="dashboard-stat-card ${definition.tone}"><div class="dashboard-stat-label">${escapeHtml(definition.label)}</div><div class="dashboard-stat-value">${escapeHtml(data.value)}</div><div class="dashboard-stat-sub">${escapeHtml(data.sub)}</div></article>`;
  }).join('');
  const modules = {
    upcoming_events: () => renderUpcomingEventsModule(upcomingEvents),
    announcements: renderAnnouncementsModule,
    my_commitments: () => renderMyCommitmentsModule(commitments, reservations),
    equipment_snapshot: renderEquipmentSnapshotModule,
  };
  document.getElementById('dashboard-modules').innerHTML = preferences.sections.map(key => modules[key]()).join('');
  updateDashboardGreeting();
}
