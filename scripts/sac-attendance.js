// One mark covers an entire SAC event or meeting. The database builds and
// authorizes each roll; the browser never chooses eligible attendees itself.
const sacAttendanceState = { kind: 'event', itemId: '', events: [], meetings: [], roll: [], request: 0 };
const sacAttendanceMarks = [['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['excused', 'Excused']];

function resetSacAttendanceState() {
  sacAttendanceState.request += 1;
  sacAttendanceState.kind = 'event';
  sacAttendanceState.itemId = '';
  sacAttendanceState.events = [];
  sacAttendanceState.meetings = [];
  sacAttendanceState.roll = [];
  const roll = document.getElementById('sac-attendance-roll');
  if (roll) roll.textContent = '';
}

window.resetSacAttendanceState = resetSacAttendanceState;

function sacAttendanceItems() {
  return sacAttendanceState.kind === 'meeting' ? sacAttendanceState.meetings : sacAttendanceState.events;
}

function paintSacAttendanceRoll() {
  const content = document.getElementById('sac-attendance-roll');
  const help = document.getElementById('sac-attendance-help');
  if (!content || !help) return;
  help.textContent = sacAttendanceState.kind === 'event'
    ? 'The roll includes each member with at least one active Scoreboard booking for this event, once.'
    : 'The roll includes all current SAC-tagged members. A meeting has no RSVP step.';
  if (!sacAttendanceState.itemId) {
    content.innerHTML = '<div class="empty-state" role="status"><p>No SAC activity is available yet.</p></div>';
    return;
  }
  const roll = sacAttendanceState.roll;
  if (!roll.length) {
    content.innerHTML = `<div class="empty-state" role="status"><p>${sacAttendanceState.kind === 'event' ? 'No active Scoreboard bookings for this event.' : 'No current SAC members for this meeting.'}</p></div>`;
    return;
  }
  const counts = Object.fromEntries(sacAttendanceMarks.map(([value]) => [value, roll.filter(person => person.attendance_status === value).length]));
  const marked = Object.values(counts).reduce((total, count) => total + count, 0);
  content.innerHTML = `<div class="sac-attendance-summary">${marked} of ${roll.length} marked · ${counts.present} present · ${counts.late} late · ${counts.absent} absent · ${counts.excused} excused</div>`
    + roll.map(person => `<div class="sac-attendance-row"><div><strong>${escapeHtml(person.member_name)}</strong><small>${person.attendance_status ? `Marked ${escapeHtml(sacAttendanceMarks.find(([value]) => value === person.attendance_status)?.[1] || person.attendance_status)}` : 'Not marked yet'}</small></div>
      <select class="form-select" aria-label="Attendance for ${escapeHtml(person.member_name)}" data-sac-attendance-member="${escapeHtml(person.member_id)}"><option value="" disabled${person.attendance_status ? '' : ' selected'}>Not marked</option>${sacAttendanceMarks.map(([value, label]) => `<option value="${value}"${person.attendance_status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></div>`).join('');
}

async function loadSacAttendanceRoll() {
  const content = document.getElementById('sac-attendance-roll');
  if (!content || !sacAttendanceState.itemId) { paintSacAttendanceRoll(); return; }
  const request = ++sacAttendanceState.request;
  content.innerHTML = '<div class="empty-state" role="status"><p>Loading attendance roll…</p></div>';
  try {
    const { data, error } = await supabaseClient.rpc('get_sac_attendance_roll', {
      p_kind: sacAttendanceState.kind, p_item_id: sacAttendanceState.itemId,
    });
    if (request !== sacAttendanceState.request) return;
    if (error) throw error;
    sacAttendanceState.roll = data || [];
    paintSacAttendanceRoll();
  } catch (_error) {
    if (request === sacAttendanceState.request) content.innerHTML = '<div class="empty-state" role="alert"><p>Attendance is unavailable. Check the database setup and your SAC role.</p></div>';
  }
}

async function renderSacAttendance() {
  const content = document.getElementById('sac-attendance-roll');
  if (!content || currentCrewCenterWorkspace() !== 'sac' || !canCreateSacEvents()) return;
  const request = ++sacAttendanceState.request;
  content.innerHTML = '<div class="empty-state" role="status"><p>Loading SAC events and meetings…</p></div>';
  if (!supabaseClient) {
    content.innerHTML = '<div class="empty-state" role="alert"><p>SAC attendance cannot load until Supabase is configured.</p></div>';
    return;
  }
  try {
    const [eventsResult, meetingsResult] = await Promise.all([
      supabaseClient.from('sac_events').select('id,title,starts_at').order('starts_at', { ascending: false }),
      supabaseClient.from('sac_meetings').select('id,title,starts_at').order('starts_at', { ascending: false }),
    ]);
    if (request !== sacAttendanceState.request) return;
    if (eventsResult.error || meetingsResult.error) throw eventsResult.error || meetingsResult.error;
    sacAttendanceState.events = eventsResult.data || [];
    sacAttendanceState.meetings = meetingsResult.data || [];
    const search = new URLSearchParams(window.location.search);
    sacAttendanceState.kind = search.get('kind') === 'meeting' ? 'meeting' : 'event';
    document.getElementById('sac-attendance-kind').value = sacAttendanceState.kind;
    const requestedId = search.get('item');
    const items = sacAttendanceItems();
    sacAttendanceState.itemId = items.some(item => item.id === requestedId) ? requestedId : items[0]?.id || '';
    const select = document.getElementById('sac-attendance-item');
    select.innerHTML = items.length ? items.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(formatBerlinDateTime(item.starts_at, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${escapeHtml(item.title)}</option>`).join('') : '<option value="">No activities yet</option>';
    select.value = sacAttendanceState.itemId;
    select.disabled = !items.length;
    await loadSacAttendanceRoll();
  } catch (_error) {
    if (request === sacAttendanceState.request) content.innerHTML = '<div class="empty-state" role="alert"><p>SAC attendance cannot load until its database tables and permissions are applied.</p></div>';
  }
}

function selectSacAttendanceKind(kind) {
  if (!canCreateSacEvents()) return;
  sacAttendanceState.kind = kind === 'meeting' ? 'meeting' : 'event';
  history.replaceState({ page: 'sac-attendance' }, '', pageUrl('sac-attendance', { kind: sacAttendanceState.kind }));
  renderSacAttendance();
}

function selectSacAttendanceItem(itemId) {
  if (!canCreateSacEvents() || !sacAttendanceItems().some(item => item.id === itemId)) return;
  sacAttendanceState.itemId = itemId;
  history.replaceState({ page: 'sac-attendance' }, '', pageUrl('sac-attendance', { kind: sacAttendanceState.kind, item: itemId }));
  loadSacAttendanceRoll();
}

document.getElementById('sac-attendance-roll')?.addEventListener('change', async event => {
  const select = event.target.closest('[data-sac-attendance-member]');
  if (!select || !canCreateSacEvents() || !sacAttendanceState.itemId) return;
  const memberId = select.dataset.sacAttendanceMember;
  const previous = sacAttendanceState.roll.find(person => person.member_id === memberId)?.attendance_status || '';
  if (!select.value || select.value === previous) { select.value = previous; return; }
  select.disabled = true;
  try {
    const { error } = await supabaseClient.rpc('mark_sac_attendance', {
      p_kind: sacAttendanceState.kind, p_item_id: sacAttendanceState.itemId,
      p_member_id: memberId, p_status: select.value,
    });
    if (error) throw error;
    showToast('Attendance saved.');
    await loadSacAttendanceRoll();
  } catch (error) {
    showToast(error?.message || 'Could not save attendance.', 'error', 7000);
    select.value = previous;
    select.disabled = false;
    await loadSacAttendanceRoll();
  }
});
