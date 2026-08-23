// ══════════════════════════════
// EVENTS
// ══════════════════════════════
function renderEvents(filter) {
  if (filter !== undefined) state.eventFilter = filter;
  renderArchivedEvents();
  const f = state.eventFilter;
  const visibleByDate = state.showPastEvents ? state.events : state.events.filter(event => !isPastEvent(event));
  const list = f === 'all' ? visibleByDate : visibleByDate.filter(e => e.cat === f);
  const pastToggle = document.getElementById('past-events-toggle');
  if (pastToggle) {
    pastToggle.textContent = state.showPastEvents ? 'Hide past events' : 'Show past events';
    pastToggle.classList.toggle('active', state.showPastEvents);
    pastToggle.setAttribute('aria-pressed', String(state.showPastEvents));
  }
  const el = document.getElementById('events-list');
  if (!list.length) { el.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>${state.showPastEvents ? 'No events in this category.' : 'No upcoming events in this category.'}</p></div>`; return; }
  const eventCard = ev => {
    const pct = ev.slots ? Math.round((ev.signups.length / ev.slots) * 100) : 0;
    const past = isPastEvent(ev);
    return `
      <div class="event-card">
        <div class="event-date-box">
          <div class="event-month">${fmtMonth(ev.date)}</div>
          <div class="event-day">${fmtDay(ev.date)}</div>
        </div>
        <div style="flex:1;">
          <div class="flex-between mb8">
            <div class="event-title">${escapeHtml(ev.title)}</div>
            <div style="display:flex;gap:6px;"><span class="badge badge-${catColor(ev.cat)}">${escapeHtml(ev.cat)}</span>${past ? '<span class="badge badge-gray">Past</span>' : ''}</div>
          </div>
          <div class="event-meta">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(eventScheduleTimeLabel(ev))}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(ev.loc || 'TBC')}</span>
            ${ev.slots ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>${ev.signups.length} / ${ev.slots} slots</span>` : ''}
          </div>
          ${ev.desc ? `<div style="font-size:13px;color:var(--text2);margin-bottom:8px;">${escapeHtml(ev.desc)}</div>` : ''}
          ${sportsScheduleCaption(ev) ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${escapeHtml(sportsScheduleCaption(ev))}</div>` : ''}
          ${isstScheduleCaption(ev) ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${escapeHtml(isstScheduleCaption(ev))}</div>` : ''}
          ${festivalScheduleCaption(ev) ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${escapeHtml(festivalScheduleCaption(ev))}</div>` : ''}
          ${livestreamSetupCaption(ev) ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${escapeHtml(livestreamSetupCaption(ev))}</div>` : ''}
          ${ev.slots ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><div class="progress-label">${pct}% full</div>` : ''}
          <div style="margin-top:10px;display:flex;gap:8px;">
            ${past
              ? '<span class="text-muted">This event has ended.</span>'
              : isVisitorSession()
              ? '<span class="text-muted">Visitors can view events only.</span>'
              : `<a class="btn btn-accent btn-sm" href="${escapeHtml(pageUrl('signup', { event: ev.id }))}">Sign up</a>`}
            ${canManageCrewOperations() ? `<button class="btn btn-ghost btn-sm" onclick="requestArchiveEvent('${ev.id}')">Archive</button>` : ''}
            ${canAddMembers() ? `<button class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEvent('${ev.id}')">Delete everything</button>` : ''}
          </div>
        </div>
      </div>`;
  };
  if (f !== 'all') {
    el.innerHTML = list.map(eventCard).join('');
    return;
  }
  const eventCategoryOrder = ['Livestream', 'Recording (live cut)', 'Event', 'Other'];
  const categories = [...new Set(list.map(event => event.cat))].sort((a, b) => {
    const indexA = eventCategoryOrder.indexOf(a);
    const indexB = eventCategoryOrder.indexOf(b);
    return (indexA < 0 ? eventCategoryOrder.length : indexA) - (indexB < 0 ? eventCategoryOrder.length : indexB) || a.localeCompare(b);
  });
  el.innerHTML = categories.map(category => {
    const events = list.filter(event => event.cat === category).sort((a, b) => a.date.localeCompare(b.date));
    return `<section class="catalog-section">
      <div class="catalog-section-head"><span class="catalog-section-title">${escapeHtml(category)}</span><span class="badge badge-${catColor(category)} catalog-section-count">${events.length}</span></div>
      <div class="catalog-event-list">${events.map(eventCard).join('')}</div>
    </section>`;
  }).join('');
}

function filterEvents(f, el) {
  document.querySelectorAll('#event-filters .filter-chip:not(#past-events-toggle)').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
  renderEvents(f);
}

function togglePastEvents() {
  state.showPastEvents = !state.showPastEvents;
  renderEvents();
}

function dateBefore(date) {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function updateLivestreamSetupField() {
  const category = document.getElementById('ev-cat').value;
  const group = document.getElementById('ev-livestream-setup-group');
  const setupDate = document.getElementById('ev-livestream-setup-date');
  const liveCutEndGroup = document.getElementById('ev-live-cut-end-group');
  const liveCutEndTime = document.getElementById('ev-end-time');
  group.style.display = category === 'Livestream' ? '' : 'none';
  liveCutEndGroup.style.display = category === 'Recording (live cut)' ? '' : 'none';
  if (category !== 'Recording (live cut)') liveCutEndTime.value = '';
  document.getElementById('ev-sports-group').style.display = category === 'Livestream' ? '' : 'none';
  document.getElementById('ev-festival-group').style.display = category === 'Event' ? '' : 'none';
  if (category !== 'Livestream') {
    document.getElementById('ev-sports').checked = false;
    document.getElementById('ev-isst').checked = false;
  }
  if (category !== 'Event') document.getElementById('ev-festival').checked = false;
  updateSportsFields();
  updateIsstFields();
  updateFestivalFields();
  if (category === 'Livestream' && !setupDate.value) {
    setupDate.value = dateBefore(document.getElementById('ev-date').value);
  }
}

function updateSportsFields() {
  const selected = document.getElementById('ev-sports').checked;
  if (selected) {
    document.getElementById('ev-isst').checked = false;
    document.getElementById('ev-festival').checked = false;
  }
  document.getElementById('ev-game-times').style.display = selected ? '' : 'none';
  document.getElementById('ev-isst-extra-games').style.display = 'none';
  document.getElementById('ev-sports-label').classList.toggle('sports-selected', selected);
  document.getElementById('ev-isst-label').classList.remove('sports-selected');
  updateFestivalFields();
}

function updateIsstFields() {
  const selected = document.getElementById('ev-isst').checked;
  if (selected) {
    document.getElementById('ev-sports').checked = false;
    document.getElementById('ev-festival').checked = false;
  }
  document.getElementById('ev-game-times').style.display = selected || document.getElementById('ev-sports').checked ? '' : 'none';
  document.getElementById('ev-isst-extra-games').style.display = selected ? '' : 'none';
  document.getElementById('ev-isst-label').classList.toggle('sports-selected', selected);
  if (selected) document.getElementById('ev-sports-label').classList.remove('sports-selected');
  updateFestivalFields();
}

function updateFestivalFields() {
  const selected = document.getElementById('ev-festival').checked;
  if (selected) {
    document.getElementById('ev-sports').checked = false;
    document.getElementById('ev-isst').checked = false;
    document.getElementById('ev-game-times').style.display = 'none';
    document.getElementById('ev-isst-extra-games').style.display = 'none';
    document.getElementById('ev-sports-label').classList.remove('sports-selected');
    document.getElementById('ev-isst-label').classList.remove('sports-selected');
  }
  document.getElementById('ev-festival-times').style.display = selected ? '' : 'none';
  document.getElementById('ev-festival-label').classList.toggle('sports-selected', selected);
}

async function addEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const date = document.getElementById('ev-date').value;
  if (!title || !date) { showToast('Please fill in title and date.', 'error'); return; }
  const category = document.getElementById('ev-cat').value;
  const startTime = document.getElementById('ev-time').value;
  const liveCutEndTime = category === 'Recording (live cut)' ? document.getElementById('ev-end-time').value : '';
  if (liveCutEndTime && !startTime) {
    showToast('Add a start time before setting the live-cut end time.', 'error');
    return;
  }
  if (liveCutEndTime && liveCutEndTime <= startTime) {
    showToast('The live-cut end time must be after its start time.', 'error');
    return;
  }
  const isSports = category === 'Livestream' && document.getElementById('ev-sports').checked;
  const isIsst = category === 'Livestream' && document.getElementById('ev-isst').checked;
  const gameTimes = ['ev-game1-start', 'ev-game1-end', 'ev-game2-start', 'ev-game2-end'].map(id => document.getElementById(id).value);
  const isstTimes = ['ev-game3-start', 'ev-game3-end', 'ev-game4-start', 'ev-game4-end'].map(id => document.getElementById(id).value);
  const isFestival = document.getElementById('ev-festival').checked;
  const festivalTimes = ['ev-setup-start', 'ev-setup-end', 'ev-shift1-start', 'ev-shift1-end', 'ev-shift2-start', 'ev-shift2-end', 'ev-takedown-start', 'ev-takedown-end'].map(id => document.getElementById(id).value);
  if (isSports && gameTimes.some(value => !value)) {
    showToast('Please enter the start and end times for both games.', 'error');
    return;
  }
  if (isSports && !(gameTimes[0] < gameTimes[1] && gameTimes[1] <= gameTimes[2] && gameTimes[2] < gameTimes[3])) {
    showToast('Game times must be in order and cannot overlap.', 'error');
    return;
  }
  if (isIsst && [...gameTimes, ...isstTimes.slice(0, 2)].some(value => !value)) {
    showToast('Please enter the start and end times for Games 1, 2, and 3.', 'error');
    return;
  }
  if (isIsst && Boolean(isstTimes[2]) !== Boolean(isstTimes[3])) {
    showToast('Enter both times for optional Game 4, or leave both blank.', 'error');
    return;
  }
  const isstSchedule = [...gameTimes, ...isstTimes.slice(0, 2), ...(isstTimes[2] ? isstTimes.slice(2) : [])];
  const isstTimesInOrder = isstSchedule.every((value, index) => index === 0 || isstSchedule[index - 1] <= value);
  const isstWindowsValid = Array.from({ length: isstSchedule.length / 2 }, (_, index) => index * 2)
    .every(index => isstSchedule[index] < isstSchedule[index + 1]);
  if (isIsst && (!isstTimesInOrder || !isstWindowsValid)) {
    showToast('ISST game times must be in order and cannot overlap.', 'error');
    return;
  }
  if (isFestival && festivalTimes.some(value => !value)) {
    showToast('Please enter start and end times for Setup, both shifts, and Takedown.', 'error');
    return;
  }
  const festivalTimesInOrder = festivalTimes.every((value, index) => index === 0 || festivalTimes[index - 1] <= value);
  const festivalWindowsValid = [0, 2, 4, 6].every(index => festivalTimes[index] < festivalTimes[index + 1]);
  if (isFestival && (!festivalTimesInOrder || !festivalWindowsValid)) {
    showToast('Festival schedule times must be in order and cannot overlap.', 'error');
    return;
  }
  const eventStartTime = isFestival ? festivalTimes[0] : (isSports || isIsst) ? gameTimes[0] : startTime || '12:00';
  const eventDate = berlinTimestamp(date, eventStartTime);
  const eventEndTime = isFestival
    ? festivalTimes[7]
    : isIsst
      ? isstTimes[3] || isstTimes[1]
      : isSports
        ? gameTimes[3]
        : liveCutEndTime || '23:59';
  const eventEnd = berlinTimestamp(date, eventEndTime);
  if (eventDate === null || eventEnd === null || eventEnd <= eventDate) {
    showToast('This Berlin date/time is invalid. Check the schedule, especially around daylight-saving changes.', 'error', 7000);
    return;
  }
  const { data, error } = await supabaseClient
    .from('events')
    .insert({
      title,
      date: new Date(eventDate).toISOString(),
      location: document.getElementById('ev-loc').value,
      description: document.getElementById('ev-desc').value,
      category,
      livestream_setup_date: category === 'Livestream'
        ? document.getElementById('ev-livestream-setup-date').value || null
        : null,
      is_sports: isSports,
      is_isst: isIsst,
      game_1_start: isSports || isIsst ? gameTimes[0] : null,
      game_1_end: isSports || isIsst ? gameTimes[1] : null,
      game_2_start: isSports || isIsst ? gameTimes[2] : null,
      game_2_end: isSports || isIsst ? gameTimes[3] : null,
      game_3_start: isIsst ? isstTimes[0] : null,
      game_3_end: isIsst ? isstTimes[1] : null,
      game_4_start: isIsst ? isstTimes[2] || null : null,
      game_4_end: isIsst ? isstTimes[3] || null : null,
      is_festival: isFestival,
      setup_start: isFestival ? festivalTimes[0] : null,
      setup_end: isFestival ? festivalTimes[1] : null,
      shift_1_start: isFestival ? festivalTimes[2] : null,
      shift_1_end: isFestival ? festivalTimes[3] : null,
      shift_2_start: isFestival ? festivalTimes[4] : null,
      shift_2_end: isFestival ? festivalTimes[5] : null,
      takedown_start: isFestival ? festivalTimes[6] : null,
      takedown_end: isFestival ? festivalTimes[7] : null,
      ends_at: new Date(eventEnd).toISOString(),
    })
    .select('*, signups(id, member_id, signup_role, reserve_role_1, reserve_role_2, equipment_source, own_camera_name, attendance_type, attendance_start, attendance_end, attendance_status, attendance_marked_at, attendance_marked_by, attendance_marked_by_name, confirmation_status, confirmation_deadline, confirmed_at, signed_up_at, members(name, role))')
    .single();
  if (error) { showToast("Couldn't create event.", 'error'); return; }
  const ev = normalizeEvent(data);
  state.events.push(ev);
  state.events.sort((a, b) => a.date.localeCompare(b.date));
  closeModal('event-modal');
  ['ev-title','ev-date','ev-time','ev-end-time','ev-loc','ev-desc','ev-livestream-setup-date','ev-game1-start','ev-game1-end','ev-game2-start','ev-game2-end','ev-game3-start','ev-game3-end','ev-game4-start','ev-game4-end','ev-setup-start','ev-setup-end','ev-shift1-start','ev-shift1-end','ev-shift2-start','ev-shift2-end','ev-takedown-start','ev-takedown-end'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ev-sports').checked = false;
  document.getElementById('ev-isst').checked = false;
  document.getElementById('ev-festival').checked = false;
  document.getElementById('ev-cat').value = 'Event';
  updateLivestreamSetupField();
  updateFestivalFields();
  showToast(`Event "${ev.title}" created!`);
  renderEvents();
  renderDashboard();
}

function eventById(id) {
  return [...state.events, ...state.archivedEvents].find(event => event.id === id);
}

function renderArchivedEvents() {
  const panel = document.getElementById('archived-events-panel');
  const list = document.getElementById('archived-events-list');
  if (!panel || !list) return;
  panel.hidden = !canManageCrewOperations() || !state.archivedEvents.length;
  if (panel.hidden) { list.innerHTML = ''; return; }
  list.innerHTML = state.archivedEvents
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(event => `<div class="archived-row">
      <div><strong>${escapeHtml(event.title)}</strong><div class="text-muted">${escapeHtml(fmtDate(event.date))} · ${event.signups.length + (event.expiredSignups?.length || 0)} preserved signup record(s)</div></div>
      <div class="archived-row-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick="restoreArchivedEvent('${event.id}')">Restore</button>
        ${canAddMembers() ? `<button type="button" class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEvent('${event.id}')">Delete everything</button>` : ''}
      </div>
    </div>`).join('');
}

function equipmentReservationsForEvent(id) {
  return [...state.equipment, ...state.archivedEquipment].flatMap(item => item.reservations).filter(reservation => reservation.eventId === id);
}

function requestArchiveEvent(id) {
  if (!canManageCrewOperations()) return;
  const event = eventById(id);
  if (!event || event.archivedAt) return;
  const reservations = equipmentReservationsForEvent(id);
  const activeReservations = reservations.filter(reservation => !['returned'].includes(reservationLifecycleStatus(reservation)) && new Date(reservation.endsAt).getTime() > Date.now());
  openActionConfirmation({
    kind: 'archive-event',
    title: `Archive “${event.title}”?`,
    copy: 'The event will disappear from schedules and signup sheets, while its signups and completed reservation history remain recoverable.',
    impact: [
      `${event.signups.length + (event.expiredSignups?.length || 0)} signup record(s) will be preserved.`,
      `${reservations.length} equipment reservation record(s) will be preserved.`,
      activeReservations.length ? `${activeReservations.length} active reservation(s) must be cancelled or completed first.` : 'No active equipment reservations block archiving.',
    ],
    confirmLabel: 'Archive event',
    execute: async () => {
      const { data, error } = await supabaseClient.rpc('set_event_archived', { p_event_id: id, p_archived: true });
      if (error || !data) { showToast(error?.message || "Couldn't archive the event.", 'error', 7000); return false; }
      await loadCrewCenterData();
      showToast(`“${event.title}” archived.`);
      return true;
    },
  });
}

async function restoreArchivedEvent(id) {
  if (!canManageCrewOperations()) return;
  const event = eventById(id);
  const { data, error } = await supabaseClient.rpc('set_event_archived', { p_event_id: id, p_archived: false });
  if (error || !data) { showToast(error?.message || "Couldn't restore the event.", 'error', 7000); return; }
  await loadCrewCenterData();
  showToast(`“${event?.title || 'Event'}” restored.`);
}

async function requestPermanentDeleteEvent(id) {
  if (!canAddMembers()) { showToast('Only an Auth Admin can permanently delete an event.', 'error'); return; }
  const event = eventById(id);
  if (!event) return;
  const { data: impact, error } = await supabaseClient.rpc('get_event_delete_impact', { p_event_id: id });
  if (error || !impact) { showToast(error?.message || "Couldn't calculate the deletion impact.", 'error', 7000); return; }
  openActionConfirmation({
    kind: 'permanent-event-delete',
    title: `Permanently delete “${event.title}”?`,
    copy: 'Archiving is safer. Permanent deletion is restricted to Auth Admins because PostgreSQL will cascade into related records.',
    impact: [
      `${impact.signups || 0} signup record(s) will be erased.`,
      `${impact.reservations || 0} equipment reservation record(s) will be erased.`,
      `${impact.notifications || 0} notification record(s) will be erased.`,
    ],
    danger: true,
    requiresAcknowledgement: true,
    acknowledgementCopy: 'I understand that this permanently erases the event and all related history.',
    expectedName: event.title,
    multipleWarnings: true,
    confirmLabel: 'Permanently delete everything',
    busyLabel: 'Deleting everything...',
    execute: async () => {
      const { data, error: deleteError } = await supabaseClient.rpc('permanently_delete_event', { p_event_id: id, p_expected_title: event.title });
      if (deleteError || !data?.deleted) { showToast(deleteError?.message || "Couldn't permanently delete the event.", 'error', 8000); return false; }
      await loadCrewCenterData();
      showToast(`“${event.title}” and its related records were permanently deleted.`, 'error', 7000);
      return true;
    },
  });
}
