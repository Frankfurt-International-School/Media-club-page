// Manual previous-day participation, separate from production bookings.
const setupRoster = { eventId: '', selected: new Set(), busy: false, request: 0, actor: '' };

function setupAttendanceActor() {
  if (isVisitorSession() || !canAccessCrewSchedule() || !window.CREW_CENTER_AUTH_USER?.id) return '';
  return `${window.CREW_CENTER_AUTH_USER.id}:${Number(window.CREW_CENTER_AUTH_EPOCH || 0)}`;
}

function setupEventWindow(event) {
  if (event?.cat !== 'Livestream' || !event.livestreamSetupDate) {
    const record = (state.setupAttendance || []).find(row => row.event_id === event?.id);
    return record ? { start: Date.parse(record.setup_starts_at), end: Date.parse(record.setup_ends_at), validDate: false } : null;
  }
  const start = berlinTimestamp(event.livestreamSetupDate, event.livestreamSetupStart || '15:15');
  const end = berlinTimestamp(event.livestreamSetupDate, event.livestreamSetupEnd || '16:15');
  if (start === null || end === null || end <= start) return null;
  return { start, end, validDate: event.livestreamSetupDate === dateBefore(event.date) };
}

function setupAttendanceEditable(event, row = null, now = Date.now()) {
  const window = row ? { start: Date.parse(row.setup_starts_at), end: Date.parse(row.setup_ends_at), validDate: true } : setupEventWindow(event);
  return Boolean(setupAttendanceActor() && event?.cat === 'Livestream' && !event.archivedAt && window?.validDate && now >= window.start && now <= window.end + 120 * 3600000);
}

function setupRosterButtonHtml(event) {
  if (!setupAttendanceActor() || !setupEventWindow(event)) return '';
  const count = (state.setupAttendance || []).filter(row => row.event_id === event.id && ['present', 'late'].includes(row.attendance_status)).length;
  return `<button type="button" class="btn btn-ghost btn-sm setup-open-button" data-setup-open="${escapeHtml(event.id)}">Setup helpers${count ? ` · ${count} verified` : ''}</button>`;
}

function renderSetupSignupCallout(event) {
  const target = document.getElementById('setup-signup-callout');
  if (!target) return;
  const window = setupEventWindow(event);
  target.hidden = !window || !setupAttendanceActor();
  target.innerHTML = target.hidden ? '' : `<div><span class="setup-kicker">Previous-day setup</span><strong>${escapeHtml(formatBerlinDateTime(window.start, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}–${escapeHtml(berlinTimeLabel(window.end))}</strong><p>Log people who helped, including members without a game signup. Verified setup and game attendance count toward one game day.</p></div>${setupRosterButtonHtml(event)}`;
}

document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="setup-roster-modal" role="dialog" aria-labelledby="setup-roster-title"><div class="modal setup-roster-modal">
  <button class="modal-close" type="button" data-setup-close aria-label="Close setup helpers">×</button>
  <span class="setup-kicker">Previous-day contribution</span><h2 class="modal-title" id="setup-roster-title">Setup helpers</h2>
  <p id="setup-roster-context" class="text-muted"></p><p class="setup-roster-status" id="setup-roster-status" role="status" aria-live="polite"></p>
  <div class="setup-roster-editor" id="setup-roster-editor"><label class="form-label" for="setup-member-search">Find helpers</label><input class="form-input" id="setup-member-search" type="search" autocomplete="off" placeholder="Search by name, grade, or FIS email" aria-controls="setup-member-results">
  <div id="setup-member-selected" class="setup-selected-members" aria-label="Selected helpers"></div><div id="setup-member-results" class="member-picker-results" role="group" aria-label="Choose setup helpers"></div>
  <div class="setup-roster-actions"><label><span class="form-label">Record as</span><select class="form-select" id="setup-bulk-status"><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option><option value="not_taken">Not taken</option></select></label><button type="button" class="btn btn-accent" id="setup-roster-save" data-setup-save>Log helpers</button></div></div>
  <div class="setup-roster-heading"><h3>Recorded helpers</h3><button type="button" class="btn btn-ghost btn-sm" data-setup-refresh>Refresh</button></div><div id="setup-roster-list"></div>
  <p class="setup-credit-help">Present or Late earns the linked game day once. A setup mark does not mark game attendance or book a production role.</p>
</div></div>`);

function setupRosterEvent() {
  return [...state.events, ...state.archivedEvents].find(event => event.id === setupRoster.eventId);
}

function paintSetupMemberPicker() {
  const input = document.getElementById('setup-member-search');
  const target = document.getElementById('setup-member-results');
  const query = normalizedSignupName(input.value);
  const members = state.members.filter(member => member.teamKeys?.includes('media_club') && member.spec?.toLowerCase() !== 'inactive');
  const matches = members.filter(member => !query || normalizedSignupName(`${member.name} ${member.gradeLevel} ${member.email}`).includes(query));
  target.innerHTML = matches.slice(0, 8).map(member => memberPickerRowHtml(member, { attribute: 'data-setup-member', selected: setupRoster.selected.has(member.id) })).join('')
    || '<p class="text-muted">No matching Media Club member. Try another name.</p>';
  document.getElementById('setup-member-selected').innerHTML = [...setupRoster.selected].map(id => {
    const member = state.members.find(item => item.id === id);
    return member ? `<button type="button" class="setup-member-chip" data-setup-member="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(member.name)}">${escapeHtml(member.name)} <span aria-hidden="true">×</span></button>` : '';
  }).join('');
  const button = document.getElementById('setup-roster-save');
  button.disabled = setupRoster.busy || !setupRoster.selected.size || !setupAttendanceEditable(setupRosterEvent()) || Boolean(state.dataErrors.setupAttendance);
  button.textContent = setupRoster.busy ? 'Saving…' : `Log ${setupRoster.selected.size || ''} helper${setupRoster.selected.size === 1 ? '' : 's'}`;
  input.disabled = setupRoster.busy;
  document.getElementById('setup-bulk-status').disabled = setupRoster.busy;
  target.querySelectorAll('button').forEach(button => { button.disabled = setupRoster.busy; });
  document.getElementById('setup-member-selected').querySelectorAll('button').forEach(button => { button.disabled = setupRoster.busy; });
}

function paintSetupRoster() {
  const event = setupRosterEvent();
  const window = setupEventWindow(event);
  if (!event || !window || setupAttendanceActor() !== setupRoster.actor) return;
  document.getElementById('setup-roster-title').textContent = `Setup · ${event.title}`;
  document.getElementById('setup-roster-context').textContent = `${formatBerlinDateTime(window.start, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}–${berlinTimeLabel(window.end)} Berlin time · contribution toward ${formatEventDate(event.date)}`;
  const message = state.dataErrors.setupAttendance ? 'Setup records could not load. Refresh before recording attendance.'
    : !window.validDate ? 'Update the event’s setup date to the day before the game before logging new helpers.'
      : Date.now() < window.start ? 'Logging opens when setup starts. Attendance can be corrected for 120 hours after setup ends.'
        : !setupAttendanceEditable(event) ? 'This setup log is closed. Recorded participation is kept for CAS tracking.'
          : 'Select the people who helped, then log their attendance. You can correct individual marks below.';
  document.getElementById('setup-roster-status').textContent = message;
  document.getElementById('setup-roster-editor').hidden = !setupAttendanceEditable(event) || Boolean(state.dataErrors.setupAttendance);
  const rows = (state.setupAttendance || []).filter(row => row.event_id === event.id);
  document.getElementById('setup-roster-list').innerHTML = rows.map(row => {
    const member = state.members.find(member => member.id === row.member_id);
    const editable = !setupRoster.busy && setupAttendanceEditable(event, row);
    const options = ['not_taken', 'present', 'late', 'absent', 'excused'].map(status => `<option value="${status}"${status === row.attendance_status ? ' selected' : ''}>${attendanceStatusLabel(status)}</option>`).join('');
    const details = [member?.gradeLevel, member?.role, member?.email].filter(Boolean).join(' · ');
    return `<div class="setup-roster-person"><div><strong>${escapeHtml(member?.name || 'Removed member')}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ''}<small>${escapeHtml(formatBerlinDateTime(row.setup_starts_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${['present', 'late'].includes(row.attendance_status) ? 'Setup contribution verified' : 'No contribution recorded'}</small></div><select class="form-select" data-setup-attendance-member="${escapeHtml(row.member_id)}" aria-label="Setup attendance for ${escapeHtml([member?.name || 'member', member?.gradeLevel].filter(Boolean).join(', '))}" ${editable ? '' : 'disabled'}>${options}</select></div>`;
  }).join('') || '<div class="setup-roster-empty">No helpers logged yet.</div>';
  paintSetupMemberPicker();
}

async function openSetupRoster(eventId) {
  const actor = setupAttendanceActor();
  if (!actor) return;
  const event = [...state.events, ...state.archivedEvents].find(item => item.id === eventId);
  if (!setupEventWindow(event)) return;
  setupRoster.eventId = eventId; setupRoster.actor = actor; setupRoster.selected.clear(); setupRoster.busy = false;
  const request = ++setupRoster.request;
  document.getElementById('setup-member-search').value = '';
  document.getElementById('setup-bulk-status').value = 'present';
  document.getElementById('setup-roster-list').innerHTML = '';
  openModal('setup-roster-modal'); paintSetupRoster();
  await loadCrewCenterData({ datasets: ['setupAttendance'], silent: true });
  if (actor !== setupAttendanceActor() || request !== setupRoster.request) return;
  paintSetupRoster();
}

async function saveSetupAttendance(memberIds, status) {
  const actor = setupAttendanceActor();
  if (!actor || actor !== setupRoster.actor || setupRoster.busy || !memberIds.length || memberIds.length > 50) return;
  const event = setupRosterEvent();
  if (!event || !['not_taken', 'present', 'late', 'absent', 'excused'].includes(status)) return;
  if (state.dataErrors.setupAttendance || new Set(memberIds).size !== memberIds.length || !memberIds.every(memberId => {
    const row = (state.setupAttendance || []).find(row => row.event_id === event.id && row.member_id === memberId);
    return setupAttendanceEditable(event, row);
  })) return;
  const request = ++setupRoster.request;
  setupRoster.busy = true; paintSetupRoster();
  try {
    const { data, error } = await withCrewCenterDataTimeout(supabaseClient.rpc('record_event_setup_attendance', { p_event_id: event.id, p_member_ids: memberIds, p_status: status }), 'setupAttendance');
    if (actor !== setupAttendanceActor() || request !== setupRoster.request) return;
    if (error || !Array.isArray(data) || data.length !== memberIds.length || !data.every(row => row.event_id === event.id && memberIds.includes(row.member_id))) throw new Error('Setup attendance could not be saved.');
    state.setupAttendance = (state.setupAttendance || []).filter(row => row.event_id !== event.id || !memberIds.includes(row.member_id)).concat(data);
    setupRoster.selected.clear();
    document.getElementById('setup-member-search').value = '';
    if (typeof renderCasAttendanceTracker === 'function' && canAccessAdminPanel()) renderCasAttendanceTracker();
    renderSetupSignupCallout(event);
    document.getElementById('setup-roster-status').textContent = 'Setup attendance saved.';
  } catch (_error) {
    if (actor === setupAttendanceActor() && request === setupRoster.request) document.getElementById('setup-roster-status').textContent = 'Could not save setup attendance. Your selection is kept; try again.';
  } finally {
    if (actor === setupAttendanceActor() && request === setupRoster.request) {
      const feedback = document.getElementById('setup-roster-status').textContent;
      setupRoster.busy = false; paintSetupRoster(); document.getElementById('setup-roster-status').textContent = feedback;
    }
  }
}

window.resetSetupAttendance = () => {
  setupRoster.request++; setupRoster.selected.clear(); setupRoster.busy = false; setupRoster.actor = ''; setupRoster.eventId = '';
  document.getElementById('setup-roster-list').innerHTML = '';
  document.getElementById('setup-member-results').innerHTML = '';
  document.getElementById('setup-member-selected').innerHTML = '';
  document.getElementById('setup-member-search').value = '';
  closeModal('setup-roster-modal');
};
window.refreshSetupAttendanceSurface = () => {
  if (!setupRoster.busy && document.getElementById('setup-roster-modal').classList.contains('open')) paintSetupRoster();
  renderSetupSignupCallout(state.events.find(event => event.id === document.getElementById('sheet-event-select')?.value));
};
document.addEventListener('click', event => {
  const target = event.target.closest?.('[data-setup-open],[data-setup-member],[data-setup-save],[data-setup-close],[data-setup-refresh]');
  if (!target) return;
  if (target.hasAttribute('data-setup-open')) { openSetupRoster(target.dataset.setupOpen); return; }
  if (target.hasAttribute('data-setup-close')) { window.resetSetupAttendance(); return; }
  if (!setupAttendanceActor() || setupRoster.actor !== setupAttendanceActor() || setupRoster.busy) return;
  if (target.hasAttribute('data-setup-member')) {
    const id = target.dataset.setupMember;
    const member = state.members.find(member => member.id === id && member.teamKeys?.includes('media_club') && member.spec?.toLowerCase() !== 'inactive');
    if (!member) return;
    if (setupRoster.selected.has(id)) setupRoster.selected.delete(id);
    else if (setupRoster.selected.size < 50) setupRoster.selected.add(id);
    paintSetupMemberPicker();
    document.getElementById('setup-member-search').focus();
  } else if (target.hasAttribute('data-setup-save')) saveSetupAttendance([...setupRoster.selected], document.getElementById('setup-bulk-status').value);
  else if (target.hasAttribute('data-setup-refresh')) openSetupRoster(setupRoster.eventId);
});
document.getElementById('setup-member-search').addEventListener('input', paintSetupMemberPicker);
document.getElementById('setup-roster-modal').addEventListener('change', event => {
  const memberId = event.target.dataset.setupAttendanceMember;
  if (memberId) saveSetupAttendance([memberId], event.target.value);
});
