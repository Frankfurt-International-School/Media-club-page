// SAC meetings are independent of Media Club meetings and do not use RSVPs.
const sacMeetingsState = { meetings: [], showPast: false, editingId: null, request: 0, loaded: false };

function resetSacMeetingsState() {
  sacMeetingsState.request += 1;
  sacMeetingsState.meetings = [];
  sacMeetingsState.showPast = false;
  sacMeetingsState.editingId = null;
  sacMeetingsState.loaded = false;
  const list = document.getElementById('sac-meetings-list');
  if (list) list.textContent = '';
}

window.resetSacMeetingsState = resetSacMeetingsState;

function paintSacMeetings() {
  const list = document.getElementById('sac-meetings-list');
  if (!list) return;
  const manager = canCreateSacEvents();
  document.getElementById('sac-meeting-create').hidden = !manager;
  const toggle = document.getElementById('sac-meetings-past-toggle');
  toggle.textContent = sacMeetingsState.showPast ? 'Hide past meetings' : 'Show past meetings';
  toggle.setAttribute('aria-pressed', String(sacMeetingsState.showPast));
  const visible = sacMeetingsState.meetings.filter(meeting => sacMeetingsState.showPast || Date.parse(meeting.ends_at) >= Date.now());
  if (!visible.length) {
    list.innerHTML = `<div class="empty-state" role="status"><p>${sacMeetingsState.showPast ? 'No SAC meetings yet.' : 'No upcoming SAC meetings yet.'}</p>${manager ? '<button class="btn btn-accent btn-sm" type="button" onclick="openSacMeetingEditor()">Create the first meeting</button>' : ''}</div>`;
    return;
  }
  list.innerHTML = visible.map(meeting => {
    const date = berlinDateKey(meeting.starts_at);
    const sameDay = date === berlinDateKey(meeting.ends_at);
    const end = sameDay ? berlinTimeLabel(meeting.ends_at)
      : formatBerlinDateTime(meeting.ends_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<article class="sac-event-card" id="sac-meeting-${escapeHtml(meeting.id)}" tabindex="-1">
      <div class="sac-event-date" aria-hidden="true"><strong>${escapeHtml(formatBerlinCalendarDate(date, { day: 'numeric' }))}</strong><span>${escapeHtml(formatBerlinCalendarDate(date, { month: 'short' }).toUpperCase())}</span></div>
      <div><div class="page-kicker">${escapeHtml(formatBerlinCalendarDate(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</div><h2>${escapeHtml(meeting.title)}</h2>
        <div class="sac-event-meta"><span>${escapeHtml(berlinTimeLabel(meeting.starts_at))}–${escapeHtml(end)} Berlin time</span>${meeting.location ? `<span>${escapeHtml(meeting.location)}</span>` : ''}</div>
        ${meeting.description ? `<p class="sac-event-description">${escapeHtml(meeting.description)}</p>` : ''}
        <div class="sac-event-actions">${Date.parse(meeting.ends_at) > Date.now() ? `<button class="btn btn-ghost btn-sm" type="button" data-meeting-calendar-id="${escapeHtml(meeting.id)}" data-meeting-calendar-workspace="sac">Add to calendar</button>` : ''}${manager ? `<button class="btn btn-ghost btn-sm" type="button" data-sac-meeting-edit="${escapeHtml(meeting.id)}">Edit meeting</button><a class="btn btn-accent btn-sm" href="${escapeHtml(pageUrl('sac-attendance', { kind: 'meeting', item: meeting.id }))}">Attendance</a>` : ''}</div>
      </div>
    </article>`;
  }).join('');
}

async function renderSacMeetings() {
  const list = document.getElementById('sac-meetings-list');
  if (!list || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  const request = ++sacMeetingsState.request;
  if (!sacMeetingsState.loaded) list.innerHTML = '<div class="empty-state" role="status"><p>Loading SAC meetings…</p></div>';
  if (!supabaseClient) {
    list.innerHTML = '<div class="empty-state" role="alert"><p>SAC meetings cannot load until Supabase is configured.</p></div>';
    return;
  }
  try {
    const { data, error } = await supabaseClient.from('sac_meetings')
      .select('id,title,description,location,starts_at,ends_at').order('starts_at', { ascending: true });
    if (request !== sacMeetingsState.request) return;
    if (error) throw error;
    sacMeetingsState.meetings = data || [];
    sacMeetingsState.loaded = true;
    const requestedMeetingId = new URLSearchParams(window.location.search).get('meeting');
    const requestedMeeting = sacMeetingsState.meetings.find(meeting => meeting.id === requestedMeetingId);
    if (requestedMeeting && Date.parse(requestedMeeting.ends_at) < Date.now()) sacMeetingsState.showPast = true;
    paintSacMeetings();
    if (requestedMeeting) requestAnimationFrame(() => {
      if (request !== sacMeetingsState.request || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()
        || !document.getElementById('page-sac-meetings')?.classList.contains('active')
        || new URLSearchParams(window.location.search).get('meeting') !== requestedMeetingId) return;
      const card = document.getElementById(`sac-meeting-${requestedMeeting.id}`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });
  } catch (_error) {
    if (request === sacMeetingsState.request) list.innerHTML = '<div class="empty-state" role="alert"><p>SAC meetings are unavailable. The local database update may not be applied yet.</p></div>';
  }
}

function togglePastSacMeetings() {
  sacMeetingsState.showPast = !sacMeetingsState.showPast;
  paintSacMeetings();
}

async function openSacMeetingEditor(id = null) {
  if (!canCreateSacEvents() || currentCrewCenterWorkspace() !== 'sac') {
    showToast('Only designated SAC leaders or Auth Admins can edit meetings.', 'error');
    return;
  }
  if (!sacMeetingsState.loaded) await renderSacMeetings();
  if (!sacMeetingsState.loaded) return;
  const meeting = id ? sacMeetingsState.meetings.find(item => item.id === id) : null;
  if (id && !meeting) { showToast('This meeting is no longer available.', 'error'); return; }
  sacMeetingsState.editingId = meeting?.id || null;
  document.getElementById('sac-meeting-form').reset();
  document.getElementById('sac-meeting-modal-title').textContent = meeting ? 'Edit SAC meeting' : 'Create SAC meeting';
  document.getElementById('sac-meeting-save').textContent = meeting ? 'Save changes' : 'Create meeting';
  document.getElementById('sac-meeting-title').value = meeting?.title || '';
  document.getElementById('sac-meeting-date').value = meeting ? berlinDateKey(meeting.starts_at) : berlinDateKey();
  document.getElementById('sac-meeting-start').value = meeting ? berlinTimeLabel(meeting.starts_at) : '';
  document.getElementById('sac-meeting-end').value = meeting ? berlinTimeLabel(meeting.ends_at) : '';
  document.getElementById('sac-meeting-location').value = meeting?.location || '';
  document.getElementById('sac-meeting-description').value = meeting?.description || '';
  openModal('sac-meeting-modal');
}

async function saveSacMeeting(event) {
  event.preventDefault();
  if (!canCreateSacEvents() || currentCrewCenterWorkspace() !== 'sac') return;
  const title = document.getElementById('sac-meeting-title').value.trim();
  const date = document.getElementById('sac-meeting-date').value;
  const start = berlinTimestamp(date, document.getElementById('sac-meeting-start').value);
  const end = berlinTimestamp(date, document.getElementById('sac-meeting-end').value);
  if (!title || title.length > 120 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    showToast('Enter a title and a valid same-day meeting window.', 'error');
    return;
  }
  const payload = {
    title,
    description: document.getElementById('sac-meeting-description').value.trim(),
    location: document.getElementById('sac-meeting-location').value.trim(),
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
  };
  const button = document.getElementById('sac-meeting-save');
  button.disabled = true;
  try {
    const query = sacMeetingsState.editingId
      ? supabaseClient.from('sac_meetings').update(payload).eq('id', sacMeetingsState.editingId)
      : supabaseClient.from('sac_meetings').insert(payload);
    const { data, error } = await query.select('id').single();
    if (error || !data) throw error || new Error('The meeting was not saved.');
    closeModal('sac-meeting-modal');
    showToast(sacMeetingsState.editingId ? 'SAC meeting updated.' : 'SAC meeting created.');
    await renderSacMeetings();
  } catch (error) {
    showToast(error?.message || 'Could not save the SAC meeting.', 'error', 7000);
  } finally {
    button.disabled = false;
  }
}

document.getElementById('sac-meetings-list')?.addEventListener('click', event => {
  const button = event.target.closest('[data-sac-meeting-edit]');
  if (button) openSacMeetingEditor(button.dataset.sacMeetingEdit);
});
