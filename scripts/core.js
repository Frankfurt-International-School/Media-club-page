// ══════════════════════════════
// STATE
// ══════════════════════════════
const state = {
  currentUser: {
    name: "Jana Stein",
    email: "j.stein@school.de",
    role: "President",
    initials: "JS",
    color: "green",
    isAdmin: false,
    isVisitor: false,
    preferences: {
      emailUpdates: true,
      eventReminders: true,
      projectAlerts: false,
    },
  },
  events: [],
  archivedEvents: [],
  members: [],
  gallery: [],
  equipment: [],
  archivedEquipment: [],
  announcements: [],
  applications: [],
  notifications: [],
  dataErrors: {},
  dataLoaded: {},
  dataUpdatedAt: {},
  eventFilter: "all",
  showPastEvents: false,
  galleryFilter: "all",
};

const supabaseSettings = window.CREW_CENTER_SUPABASE || {};
const supabaseClient = window.crewCenterSupabase || window.supabase?.createClient(supabaseSettings.url, supabaseSettings.anonKey);
const colors = ['green','purple','amber','coral','teal','blue'];
const signupRoleLabels = {
  adult_supervisor: 'Adult Supervisor',
  student_supervisor: 'Student Supervisor',
  mixing: 'MIXING',
  obs: 'OBS',
  robocam: 'Robocam',
  handheld_1: 'Handheld 1',
  handheld_2: 'Handheld 2',
  handheld_3: 'Handheld 3 (optional)',
  wireless: 'Wireless',
  photographer: 'Photographer',
};
const memberSignupRoles = ['mixing', 'obs', 'robocam', 'handheld_1', 'handheld_2', 'handheld_3', 'photographer'];
const supervisorSignupRoles = ['student_supervisor', ...memberSignupRoles];
const adminSignupRoles = ['adult_supervisor', 'student_supervisor', 'mixing', 'obs', 'robocam', 'handheld_1', 'handheld_2', 'handheld_3', 'wireless', 'photographer'];
const signupRoleDisplayOrder = adminSignupRoles.map(key => signupRoleLabels[key]);

function normalizeRoleName(role = '') {
  return role.toLowerCase().trim().replace(/\s+/g, '-');
}

function currentMemberRecord() {
  const email = (window.CREW_CENTER_AUTH_USER?.email || state.currentUser.email || '').toLowerCase();
  if (email) {
    const byEmail = state.members.find(member => (member.email || '').toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = (state.currentUser.name || '').toLowerCase();
  return state.members.find(member => (member.name || '').toLowerCase() === name) || null;
}

function canAccessAdminPanel() {
  if (window.CREW_CENTER_IS_ADMIN || state.currentUser.isAdmin) return true;
  const role = normalizeRoleName(currentMemberRecord()?.role || '');
  return role === 'faculty';
}

function isVisitorSession() {
  return Boolean(window.CREW_CENTER_IS_VISITOR || state.currentUser.isVisitor);
}

function canAddMembers() {
  return Boolean(window.CREW_CENTER_IS_ADMIN || state.currentUser.isAdmin);
}

window.canAddCrewCenterMembers = canAddMembers;

window.canAccessCrewCenterAdminPanel = canAccessAdminPanel;

function canManageCrewOperations() {
  if (canAccessAdminPanel()) return true;
  const role = normalizeRoleName(currentMemberRecord()?.role || state.currentUser.role || '');
  return ['leader', 'co-leader', 'moderator'].includes(role);
}

window.canManageCrewOperations = canManageCrewOperations;

function canSignupForOtherMembers() {
  return canAccessAdminPanel();
}

function canAccessEquipmentStatus() {
  if (!canManageCrewOperations()) return false;
  return currentMemberRecord()?.equipmentStatusAccess !== false;
}

window.canAccessCrewCenterEquipmentStatus = canAccessEquipmentStatus;

function canAccessCrewSchedule() {
  if (canAccessAdminPanel()) return true;
  const role = normalizeRoleName(currentMemberRecord()?.role || state.currentUser.role || '');
  return ['leader', 'co-leader'].includes(role);
}

window.canAccessCrewSchedule = canAccessCrewSchedule;

function currentUserSignupRoleKeys() {
  if (isVisitorSession()) return [];
  if (canAccessAdminPanel()) return adminSignupRoles;
  const memberRecord = currentMemberRecord();
  const role = normalizeRoleName(memberRecord?.role || state.currentUser.role);
  if (['moderator', 'co-leader', 'leader'].includes(role)) return supervisorSignupRoles;
  return memberSignupRoles;
}

const BERLIN_TIME_ZONE = 'Europe/Berlin';
const berlinPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function berlinParts(value) {
  const parts = Object.fromEntries(berlinPartsFormatter.formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

function berlinDateKey(value = Date.now()) {
  const parts = berlinParts(value);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function berlinTimeLabel(value) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

function berlinTimestamp(date, time) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(time || ''));
  if (!dateMatch || !timeMatch) return null;
  const target = {
    year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]), minute: Number(timeMatch[2]), second: Number(timeMatch[3] || 0),
  };
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = berlinParts(candidate);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    candidate += targetAsUtc - observedAsUtc;
  }
  const verified = berlinParts(candidate);
  return Object.keys(target).every(key => verified[key] === target[key]) ? candidate : null;
}

function timeValue(date, time) {
  return date && time ? berlinTimestamp(date, time) : null;
}

function formatBerlinDateTime(value, options = {}) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TIME_ZONE, ...options }).format(new Date(value));
}

function formatBerlinCalendarDate(date, options = {}) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TIME_ZONE, ...options }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function eventEndTimestamp(event) {
  const explicitEnd = Date.parse(event?.endsAt || '');
  if (Number.isFinite(explicitEnd)) return explicitEnd;
  const fallbackEnd = event?.takedownEnd || event?.game4End || event?.game3End || event?.game2End || event?.game1End || event?.time || '23:59';
  return timeValue(event?.date, fallbackEnd);
}

function isPastEvent(event, now = Date.now()) {
  const end = eventEndTimestamp(event);
  return end !== null && end <= now;
}

let eventVisibilityTimer = null;
function scheduleEventVisibilityRefresh() {
  if (eventVisibilityTimer) clearTimeout(eventVisibilityTimer);
  const now = Date.now();
  const nextEnd = state.events
    .map(eventEndTimestamp)
    .filter(end => end !== null && end > now)
    .sort((a, b) => a - b)[0];
  if (!nextEnd) return;
  eventVisibilityTimer = setTimeout(() => {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage === 'events') renderEvents();
    if (activePage === 'signup') initSignupSheet();
    scheduleEventVisibilityRefresh();
  }, Math.min(nextEnd - now + 250, 2147483647));
}

function selectedAttendanceWindow(ev) {
  if (!ev) return null;
  const type = document.getElementById('signup-attendance')?.value || 'whole';
  const ranges = {
    game_1: [ev.game1Start, ev.game1End],
    game_2: [ev.game2Start, ev.game2End],
    game_3: [ev.game3Start, ev.game3End],
    game_4: [ev.game4Start, ev.game4End],
    setup: [ev.setupStart, ev.setupEnd],
    shift_1: [ev.shift1Start, ev.shift1End],
    shift_2: [ev.shift2Start, ev.shift2End],
    takedown: [ev.takedownStart, ev.takedownEnd],
    whole: [ev.game1Start || ev.time, ev.game4End || ev.game3End || ev.game2End || ev.game1End || '23:59'],
    custom: [document.getElementById('signup-start-time')?.value, document.getElementById('signup-end-time')?.value],
  };
  const [startTime, endTime] = ranges[type] || [];
  const start = timeValue(ev.date, startTime);
  const end = timeValue(ev.date, endTime);
  return start && end && end > start ? { type, start, end, startTime, endTime } : null;
}

function signupOverlaps(signup, window) {
  if (!window || !signup.attendanceStart || !signup.attendanceEnd) return true;
  return new Date(signup.attendanceStart).getTime() < window.end && new Date(signup.attendanceEnd).getTime() > window.start;
}

function renderSignupRoleOptions(ev) {
  const select = document.getElementById('signup-role');
  if (!select) return;
  const attendanceType = document.getElementById('signup-attendance')?.value;
  const roleFreeAttendance = ev?.isFestival && ['setup', 'takedown'].includes(attendanceType);
  document.getElementById('signup-role-group')?.style.setProperty('display', roleFreeAttendance ? 'none' : '');
  document.getElementById('signup-entry-grid')?.classList.toggle('role-free', Boolean(roleFreeAttendance));
  if (roleFreeAttendance) {
    select.innerHTML = '<option value="">No role required</option>';
    return;
  }
  const selected = select.value;
  const attendance = selectedAttendanceWindow(ev);
  select.innerHTML = currentUserSignupRoleKeys().map(key => {
    const label = signupRoleLabels[key];
    const sameRole = (ev?.signups || []).filter(signup => signup.role === label);
    const overlapping = sameRole.filter(signup => signupOverlaps(signup, attendance));
    const occupied = overlapping.length > 0;
    const latestEnd = sameRole.map(signup => signup.attendanceEnd).filter(Boolean).sort().at(-1);
    const occupiedUntil = overlapping.map(signup => signup.attendanceEnd).filter(Boolean).sort().at(-1);
    const disabled = occupied ? ' disabled' : '';
    const suffix = occupied
      ? occupiedUntil
        ? ` - occupied until ${berlinTimeLabel(occupiedUntil)}`
        : ' - slot occupied'
      : latestEnd
        ? ' - available for selected time'
        : '';
    return `<option value="${label}"${disabled}>${label}${suffix}</option>`;
  }).join('');
  if ([...select.options].some(option => option.value === selected && !option.disabled)) {
    select.value = selected;
  }
  updateReserveRoleFields();
}

function availableReserveRoleLabels() {
  return currentUserSignupRoleKeys()
    .filter(key => !['adult_supervisor', 'student_supervisor'].includes(key))
    .map(key => signupRoleLabels[key]);
}

function updateReserveRoleFields() {
  const fields = document.getElementById('signup-reserve-fields');
  const isSupervisor = document.getElementById('signup-role')?.value === signupRoleLabels.student_supervisor;
  fields?.classList.toggle('visible', isSupervisor);
  if (!isSupervisor) return;
  const first = document.getElementById('signup-reserve-role-1');
  const second = document.getElementById('signup-reserve-role-2');
  const roles = availableReserveRoleLabels();
  const previousFirst = first.value;
  const previousSecond = second.value;
  first.innerHTML = roles.map(role => `<option value="${role}">${role}</option>`).join('');
  if (roles.includes(previousFirst)) first.value = previousFirst;
  second.innerHTML = roles.map(role => `<option value="${role}">${role}</option>`).join('');
  if (roles.includes(previousSecond) && previousSecond !== first.value) second.value = previousSecond;
  if (second.value === first.value) second.value = roles.find(role => role !== first.value) || '';
  syncReserveRoleOptions();
}

function syncReserveRoleOptions() {
  const first = document.getElementById('signup-reserve-role-1');
  const second = document.getElementById('signup-reserve-role-2');
  if (!first || !second) return;
  [...first.options].forEach(option => { option.disabled = option.value === second.value; });
  [...second.options].forEach(option => { option.disabled = option.value === first.value; });
  if (first.value === second.value) second.value = [...second.options].find(option => !option.disabled)?.value || '';
}

function renderSignupRoleOptionsForCurrentEvent() {
  const ev = state.events.find(event => event.id === document.getElementById('sheet-event-select')?.value);
  renderSignupRoleOptions(ev);
}

function renderSignupNameField() {
  const input = document.getElementById('signup-name');
  if (!input) return;
  const help = document.getElementById('signup-name-help');
  const canChooseMember = canSignupForOtherMembers();
  input.placeholder = 'Name as shown on the Members page';
  input.readOnly = !canChooseMember;
  if (help) help.hidden = !canChooseMember;
  if (!canChooseMember) {
    const member = currentMemberRecord();
    input.value = member?.name || state.currentUser.name || '';
    input.setAttribute('aria-label', 'Your member name');
  } else {
    input.removeAttribute('aria-label');
  }
}

function normalizedSignupName(value = '') {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function matchingSignupMembers(value) {
  const normalized = normalizedSignupName(value);
  if (!normalized) return [];
  return state.members.filter(member => normalizedSignupName(member.name) === normalized);
}

function setSignupNameHelp(message, status = '') {
  const help = document.getElementById('signup-name-help');
  if (!help) return;
  help.textContent = message;
  help.classList.toggle('error', status === 'error');
  help.classList.toggle('valid', status === 'valid');
}

function clearSignupNameValidation() {
  setSignupNameHelp('Enter the full name exactly as displayed on the Members page. Capitalization does not matter.');
}

function validateSignupNameInput(canonicalize = false) {
  const input = document.getElementById('signup-name');
  const value = input?.value || '';
  if (!value.trim()) {
    setSignupNameHelp('Enter the full name exactly as displayed on the Members page. Capitalization does not matter.');
    return [];
  }
  const matches = matchingSignupMembers(value);
  if (!matches.length) {
    setSignupNameHelp('Name not found. Check the spelling or copy the name from the Members page.', 'error');
    return [];
  }
  if (matches.length > 1) {
    setSignupNameHelp('More than one member has this name. Ask an administrator for help.', 'error');
    return matches;
  }
  if (canonicalize) input.value = matches[0].name;
  setSignupNameHelp(`Matched to ${matches[0].name}.`, 'valid');
  return matches;
}

const datasetLabels = {
  members: 'member directory',
  events: 'events',
  gallery: 'project gallery',
  equipment: 'equipment register',
  announcements: 'announcements',
  applications: 'applications',
  notifications: 'notifications',
};

const datasetErrorTargets = {
  members: ['members-grid'],
  events: ['dashboard-focus', 'events-list'],
  gallery: ['about-recent-projects', 'gallery-grid'],
  equipment: ['equipment-grid'],
  applications: ['pending-list'],
};

function showLoadError(targetId, message = "Couldn't load data.", dataset = '') {
  const target = document.getElementById(targetId);
  if (target) {
    const retry = dataset ? `<div class="load-error-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="retryDataset('${dataset}')">Retry</button></div>` : '';
    target.innerHTML = `<div class="empty-state" style="grid-column:1/-1" role="status"><p>${escapeHtml(message)}</p>${retry}</div>`;
  }
}

function renderDataStatus() {
  const banner = document.getElementById('data-status-banner');
  const message = document.getElementById('data-status-message');
  if (!banner || !message) return;
  const failed = Object.keys(state.dataErrors);
  banner.hidden = failed.length === 0;
  if (!failed.length) {
    message.textContent = '';
    return;
  }
  const labels = failed.map(dataset => datasetLabels[dataset] || dataset);
  message.textContent = `${labels.join(', ')} ${labels.length === 1 ? 'is' : 'are'} temporarily unavailable. Other information remains usable.`;
}

function renderDatasetErrors() {
  Object.entries(state.dataErrors).forEach(([dataset, message]) => {
    if (state.dataLoaded[dataset]) return;
    (datasetErrorTargets[dataset] || []).forEach(targetId => showLoadError(targetId, message, dataset));
  });
  renderDataStatus();
}

function retryDataset(dataset) {
  if (!datasetLabels[dataset]) return;
  loadCrewCenterData({ datasets: [dataset] });
}

function retryFailedDatasets() {
  const datasets = Object.keys(state.dataErrors);
  if (datasets.length) loadCrewCenterData({ datasets });
}

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { fname: parts[0] || '', lname: parts.slice(1).join(' ') || '' };
}

function normalizeMember(member, index = 0) {
  const { fname, lname } = splitName(member.name);
  return {
    id: member.id,
    fname,
    lname,
    name: member.name,
    email: member.email || '',
    gradeLevel: member.grade_level || '',
    role: member.role || 'Member',
    spec: member.status || 'active',
    avatarUrl: member.avatar_url || '',
    avatarPath: member.avatar_path || '',
    sidebarCustomized: Boolean(member.sidebar_customized),
    sidebarItems: Array.isArray(member.sidebar_items) ? member.sidebar_items : [],
    notificationPreferences: {
      event_created: member.notification_preferences?.event_created !== false,
      event_reminders: member.notification_preferences?.event_reminders !== false,
      maybe_reminders: member.notification_preferences?.maybe_reminders !== false,
    },
    dashboardPreferences: {
      stats: Array.isArray(member.dashboard_preferences?.stats) ? member.dashboard_preferences.stats : [],
      sections: Array.isArray(member.dashboard_preferences?.sections) ? member.dashboard_preferences.sections : [],
    },
    equipmentStatusAccess: member.equipment_status_access !== false,
    color: colors[index % colors.length],
    joined_date: member.joined_date,
  };
}

function normalizeSignup(signup) {
  return {
    id: signup.id,
    memberId: signup.member_id,
    name: signup.members?.name || 'Unknown member',
    role: signup.signup_role || '',
    reserveRole1: signup.reserve_role_1 || '',
    reserveRole2: signup.reserve_role_2 || '',
    attendanceType: signup.attendance_type || 'whole',
    attendanceStart: signup.attendance_start || '',
    attendanceEnd: signup.attendance_end || '',
    attendanceStatus: signup.attendance_status || 'not_taken',
    attendanceMarkedAt: signup.attendance_marked_at || '',
    attendanceMarkedBy: signup.attendance_marked_by || '',
    attendanceMarkedByName: signup.attendance_marked_by_name || '',
    confirmationStatus: signup.confirmation_status || 'confirmed',
    confirmationDeadline: signup.confirmation_deadline || '',
    confirmedAt: signup.confirmed_at || '',
    ts: formatBerlinDateTime(signup.signed_up_at, { dateStyle: 'medium', timeStyle: 'short' }),
    signedUpAt: signup.signed_up_at || '',
  };
}

function normalizeEvent(event) {
  const dt = new Date(event.date);
  const legacyCategoryMap = {
    Workshop: 'Event',
    Screening: 'Event',
    Competition: 'Event',
    Recording: 'Recording (live cut)',
    Social: 'Other',
  };
  return {
    id: event.id,
    title: event.title,
    date: berlinDateKey(dt),
    time: berlinTimeLabel(dt),
    loc: event.location || 'TBC',
    cat: legacyCategoryMap[event.category] || event.category || 'Event',
    livestreamSetupDate: event.livestream_setup_date || '',
    isSports: Boolean(event.is_sports),
    game1Start: event.game_1_start?.slice(0, 5) || '',
    game1End: event.game_1_end?.slice(0, 5) || '',
    game2Start: event.game_2_start?.slice(0, 5) || '',
    game2End: event.game_2_end?.slice(0, 5) || '',
    isIsst: Boolean(event.is_isst),
    game3Start: event.game_3_start?.slice(0, 5) || '',
    game3End: event.game_3_end?.slice(0, 5) || '',
    game4Start: event.game_4_start?.slice(0, 5) || '',
    game4End: event.game_4_end?.slice(0, 5) || '',
    isFestival: Boolean(event.is_festival),
    setupStart: event.setup_start?.slice(0, 5) || '',
    setupEnd: event.setup_end?.slice(0, 5) || '',
    shift1Start: event.shift_1_start?.slice(0, 5) || '',
    shift1End: event.shift_1_end?.slice(0, 5) || '',
    shift2Start: event.shift_2_start?.slice(0, 5) || '',
    shift2End: event.shift_2_end?.slice(0, 5) || '',
    takedownStart: event.takedown_start?.slice(0, 5) || '',
    takedownEnd: event.takedown_end?.slice(0, 5) || '',
    endsAt: event.ends_at || '',
    archivedAt: event.archived_at || '',
    archivedByName: event.archived_by_name || '',
    slots: 0,
    desc: event.description || '',
    signups: (event.signups || []).filter(signup => signup.confirmation_status !== 'expired').map(normalizeSignup),
    expiredSignups: (event.signups || []).filter(signup => signup.confirmation_status === 'expired').map(normalizeSignup),
  };
}

function normalizeGallery(item) {
  const directoryMember = state.members.find(member => member.id === item.member_id);
  const visitor = isVisitorSession();
  return {
    id: item.id,
    title: item.project_name,
    type: item.project_type || 'Photo',
    memberId: visitor ? '' : item.member_id || '',
    author: visitor ? 'Media Club' : item.members?.name || directoryMember?.name || 'Media Club member',
    desc: item.description || '',
    link: item.project_url || item.image_url || '#',
    image_url: item.image_url || '',
    storagePath: item.storage_path || '',
    producedOn: item.produced_on || '',
    created_at: item.created_at,
  };
}

function normalizeEquipment(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category || 'Other',
    status: item.status || 'available',
    assignedName: item.members?.name || 'Unassigned',
    detail: item.notes || 'No notes',
    archivedAt: item.archived_at || '',
    archivedByName: item.archived_by_name || '',
    reservations: (item.equipment_reservations || []).map(reservation => ({
      id: reservation.id,
      memberId: reservation.member_id,
      memberName: reservation.members?.name || 'Unknown member',
      eventId: reservation.event_id,
      eventTitle: reservation.events?.title || '',
      type: reservation.reservation_type,
      purpose: reservation.purpose || '',
      startsAt: reservation.starts_at,
      endsAt: reservation.ends_at,
      status: reservation.reservation_status || 'scheduled',
      checkedOutAt: reservation.checked_out_at || '',
      returnedAt: reservation.returned_at || '',
      returnedBy: reservation.returned_by || '',
      returnedByName: reservation.returned_by_name || '',
      autoReleasedAt: reservation.auto_released_at || '',
    })),
  };
}

function normalizeAnnouncement(item) {
  const createdAt = item.created_at ? new Date(item.created_at) : new Date();
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    date: formatBerlinDateTime(createdAt, { day: 'numeric', month: 'short' }),
    created_at: item.created_at,
  };
}

function normalizeApplication(item) {
  const nameParts = splitName(item.name || '');
  return {
    id: item.id,
    fname: nameParts.fname,
    lname: nameParts.lname,
    email: item.email || '',
    why: item.why || '',
    interests: item.interests || [],
    status: item.status || 'pending',
    year: item.year_group || '',
    exp: item.experience_level || '',
    link: item.work_link || '',
    rejectionReason: item.rejection_reason || '',
  };
}

const crewCenterDatasets = ['members', 'events', 'gallery', 'equipment', 'announcements', 'applications', 'notifications'];
const queuedDatasets = new Set();
let dataLoadPromise = null;
let realtimeLoadTimer = null;
const pendingRealtimeDatasets = new Set();

function crewCenterDatasetRequest(dataset, visitor) {
  if (visitor) {
    const publicRpc = {
      events: 'get_public_events',
      gallery: 'get_public_gallery',
      equipment: 'get_public_equipment',
      announcements: 'get_public_announcements',
    }[dataset];
    if (publicRpc) return supabaseClient.rpc(publicRpc);
    return Promise.resolve({ data: [], error: null });
  }
  const requests = {
    members: () => supabaseClient.from('members').select('*').order('name'),
    events: () => supabaseClient.from('events').select('*, signups(id, member_id, signup_role, reserve_role_1, reserve_role_2, attendance_type, attendance_start, attendance_end, attendance_status, attendance_marked_at, attendance_marked_by, attendance_marked_by_name, confirmation_status, confirmation_deadline, confirmed_at, signed_up_at, members(name, role))').order('date', { ascending: true }),
    gallery: () => supabaseClient.from('gallery').select('*, members(name)').order('created_at', { ascending: false }),
    equipment: () => supabaseClient.from('equipment').select('*, members(name), equipment_reservations(id, member_id, event_id, reservation_type, purpose, starts_at, ends_at, reservation_status, checked_out_at, returned_at, returned_by, returned_by_name, auto_released_at, created_at, members(name), events(title))').order('name'),
    announcements: () => supabaseClient.from('announcements').select('*').order('created_at', { ascending: false }).limit(30),
    applications: () => supabaseClient.from('join_applications').select('*').order('created_at', { ascending: false }),
    notifications: () => supabaseClient.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
  };
  return requests[dataset]();
}

function applyCrewCenterDataset(dataset, rows) {
  const data = Array.isArray(rows) ? rows : [];
  if (dataset === 'members') {
    state.members = data.map(normalizeMember);
    syncCurrentUserWithMemberRecord();
  } else if (dataset === 'events') {
    const normalized = data.map(normalizeEvent);
    state.events = normalized.filter(event => !event.archivedAt);
    state.archivedEvents = normalized.filter(event => event.archivedAt);
  } else if (dataset === 'gallery') {
    state.gallery = data.map(normalizeGallery);
  } else if (dataset === 'equipment') {
    const normalized = data.map(normalizeEquipment);
    state.equipment = normalized.filter(item => !item.archivedAt);
    state.archivedEquipment = normalized.filter(item => item.archivedAt);
  } else if (dataset === 'announcements') {
    state.announcements = data.map(normalizeAnnouncement);
  } else if (dataset === 'applications') {
    state.applications = canAccessAdminPanel() ? data.map(normalizeApplication) : [];
  } else if (dataset === 'notifications') {
    state.notifications = data;
  }
}

async function loadCrewCenterDatasetBatch(datasets, silent) {
  const visitor = isVisitorSession();
  const results = await Promise.all(datasets.map(async dataset => {
    try {
      return [dataset, await crewCenterDatasetRequest(dataset, visitor)];
    } catch (error) {
      return [dataset, { data: null, error }];
    }
  }));
  const failed = [];
  results.forEach(([dataset, result]) => {
    if (result?.error) {
      console.error(`Couldn't load ${dataset}.`, result.error);
      state.dataErrors[dataset] = `Couldn't load the ${datasetLabels[dataset] || dataset}.`;
      failed.push(dataset);
      return;
    }
    delete state.dataErrors[dataset];
    state.dataLoaded[dataset] = true;
    state.dataUpdatedAt[dataset] = Date.now();
    applyCrewCenterDataset(dataset, result?.data);
  });

  updateAdminPendingIndicator();
  window.applyCrewCenterAdminControls?.();
  applySidebarPreferences();
  renderNotificationCenter();
  renderGalleryAuthorField();
  window.CREW_CENTER_DATA_LOADED = ['events', 'gallery', 'equipment'].every(dataset => state.dataLoaded[dataset]);
  if (pageFromPath() === 'admin') {
    navigate(canAccessAdminPanel() ? 'admin' : 'home', navItemForPage(canAccessAdminPanel() ? 'admin' : 'home'), { skipUrl: canAccessAdminPanel(), preserveFocus: true });
  } else if (pageFromPath() === 'equipment-status') {
    navigate(canAccessEquipmentStatus() ? 'equipment-status' : 'home', navItemForPage(canAccessEquipmentStatus() ? 'equipment-status' : 'home'), { skipUrl: canAccessEquipmentStatus(), preserveFocus: true });
  } else if (pageFromPath() === 'crew-deployment') {
    navigate(canAccessCrewSchedule() ? 'crew-deployment' : 'home', navItemForPage(canAccessCrewSchedule() ? 'crew-deployment' : 'home'), { skipUrl: canAccessCrewSchedule(), preserveFocus: true });
  }
  renderCurrentPage();
  renderDatasetErrors();
  scheduleEventVisibilityRefresh();
  window.updateCrewCenterEventsBadge?.();
  if (failed.length && !silent) {
    showToast(`Some information could not be refreshed: ${failed.map(dataset => datasetLabels[dataset] || dataset).join(', ')}.`, 'error', 7000);
  }
}

async function loadCrewCenterData(options = {}) {
  if (!supabaseClient || !supabaseSettings.url || supabaseSettings.url.includes('YOUR-PROJECT-REF')) {
    crewCenterDatasets.forEach(dataset => { state.dataErrors[dataset] = `Couldn't load the ${datasetLabels[dataset] || dataset}.`; });
    renderDatasetErrors();
    showToast('Add your Supabase URL and anon key in supabase-config.js.', 'error');
    return;
  }
  const requested = Array.isArray(options.datasets) && options.datasets.length ? options.datasets : crewCenterDatasets;
  requested.filter(dataset => crewCenterDatasets.includes(dataset)).forEach(dataset => queuedDatasets.add(dataset));
  if (dataLoadPromise) return dataLoadPromise;
  dataLoadPromise = (async () => {
    let silent = options.silent === true;
    while (queuedDatasets.size) {
      const batch = [...queuedDatasets];
      queuedDatasets.clear();
      await loadCrewCenterDatasetBatch(batch, silent);
      silent = true;
    }
  })();
  try {
    await dataLoadPromise;
  } finally {
    dataLoadPromise = null;
  }
}

function queueRealtimeDataLoad(...datasets) {
  if (isVisitorSession()) return;
  datasets.forEach(dataset => pendingRealtimeDatasets.add(dataset));
  if (realtimeLoadTimer) clearTimeout(realtimeLoadTimer);
  realtimeLoadTimer = setTimeout(() => {
    const pending = [...pendingRealtimeDatasets];
    pendingRealtimeDatasets.clear();
    loadCrewCenterData({ datasets: pending, silent: true });
  }, 250);
}

function refreshVisitorDataForPage(page) {
  if (!isVisitorSession()) return;
  const pageDatasets = {
    about: ['gallery'],
    home: ['events', 'gallery', 'equipment', 'announcements'],
    events: ['events'],
    gallery: ['gallery'],
    equipment: ['equipment'],
  }[page] || [];
  const stale = pageDatasets.filter(dataset => !state.dataUpdatedAt[dataset] || Date.now() - state.dataUpdatedAt[dataset] > 120000);
  if (stale.length) loadCrewCenterData({ datasets: stale, silent: true });
}

function subscribeToCrewCenterChanges() {
  if (!supabaseClient) return;
  const mode = isVisitorSession() ? 'visitor' : 'member';
  if (window.CREW_CENTER_REALTIME_READY === mode) return;
  if (window.CREW_CENTER_REALTIME_CHANNEL) {
    supabaseClient.removeChannel(window.CREW_CENTER_REALTIME_CHANNEL);
    window.CREW_CENTER_REALTIME_CHANNEL = null;
  }
  window.CREW_CENTER_REALTIME_READY = mode;
  if (mode === 'visitor') return;
  const tableDatasets = {
    members: ['members', 'gallery'],
    events: ['events', 'equipment'],
    signups: ['events'],
    gallery: ['gallery'],
    equipment: ['equipment'],
    equipment_reservations: ['equipment'],
    announcements: ['announcements'],
    join_applications: ['applications'],
    notifications: ['notifications'],
  };
  let channel = supabaseClient.channel('crew-center-live-data');
  Object.entries(tableDatasets).forEach(([table, datasets]) => {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => queueRealtimeDataLoad(...datasets));
  });
  window.CREW_CENTER_REALTIME_CHANNEL = channel.subscribe();
}

function renderCurrentPage() {
  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
  if (activePage === 'about') renderAboutRecentProjects();
  if (activePage === 'home') renderDashboard();
  if (activePage === 'events') renderEvents();
  if (activePage === 'signup') initSignupSheet();
  if (activePage === 'members') renderMembers();
  if (activePage === 'gallery') renderGallery();
  if (activePage === 'equipment') renderEquipment();
  if (activePage === 'equipment-status') renderEquipmentStatus();
  if (activePage === 'crew-deployment') initCrewDeployment();
}

const sidebarCategories = {
  main: { label: 'Main', pages: ['home', 'events', 'signup', 'members'] },
  content: { label: 'Content', pages: ['gallery', 'equipment', 'role-guide'] },
  club: { label: 'Club', pages: ['crew-deployment', 'equipment-status', 'join', 'about', 'admin'] },
};

function sidebarPageAvailable(page) {
  if (page === 'admin') return canAccessAdminPanel();
  if (page === 'crew-deployment') return canAccessCrewSchedule();
  if (page === 'equipment-status') return canAccessEquipmentStatus();
  return true;
}

function availableSidebarPages() {
  return Object.values(sidebarCategories).flatMap(category => category.pages).filter(sidebarPageAvailable);
}

function currentSidebarPreferences() {
  const member = currentMemberRecord();
  const available = availableSidebarPages();
  const customized = Boolean(member?.sidebarCustomized);
  const saved = member?.sidebarItems?.filter(page => available.includes(page)) || [];
  if (customized) {
    Object.values(sidebarCategories).forEach(category => {
      const categoryPages = category.pages.filter(page => available.includes(page));
      if (categoryPages.length && !categoryPages.some(page => saved.includes(page))) saved.push(categoryPages[0]);
    });
  }
  return {
    customized,
    items: customized && saved.length ? saved : available,
  };
}

function applySidebarPreferences() {
  const preferences = currentSidebarPreferences();
  const available = availableSidebarPages();
  const visiblePages = new Set(preferences.items);
  document.querySelectorAll('.sidebar-nav .nav-item[data-page]').forEach(item => {
    item.classList.toggle('sidebar-custom-hidden', !visiblePages.has(item.dataset.page));
  });
  Object.entries(sidebarCategories).forEach(([category, definition]) => {
    const hasVisiblePage = definition.pages.some(page => sidebarPageAvailable(page) && visiblePages.has(page));
    document.querySelector(`[data-nav-category="${category}"]`)?.classList.toggle('sidebar-category-hidden', !hasVisiblePage);
  });
  const hiddenCount = available.filter(page => !visiblePages.has(page)).length;
  document.getElementById('sidebar-all-pages-button')?.classList.toggle('visible', hiddenCount > 0);
  const count = document.getElementById('sidebar-hidden-count');
  if (count) count.textContent = hiddenCount;
  renderAllPagesMenu(document.getElementById('all-pages-search')?.value || '');
  document.documentElement.classList.remove('sidebar-pending');
}

function renderSidebarSettings() {
  const toggle = document.getElementById('sidebar-customize-enabled');
  const groups = document.getElementById('sidebar-choice-groups');
  if (!toggle || !groups) return;
  const preferences = currentSidebarPreferences();
  const selected = new Set(preferences.items);
  toggle.checked = preferences.customized;
  groups.innerHTML = Object.entries(sidebarCategories).map(([category, definition]) => {
    const pages = definition.pages.filter(sidebarPageAvailable);
    return `<div class="sidebar-choice-group"><div class="sidebar-choice-title">${definition.label}</div><div class="sidebar-choice-grid">${pages.map(page => `<label class="sidebar-choice"><input type="checkbox" value="${page}" data-sidebar-category="${category}" ${selected.has(page) ? 'checked' : ''}><span>${pageTitles[page]}</span></label>`).join('')}</div></div>`;
  }).join('');
  toggleSidebarCustomization(preferences.customized, false);
}

function toggleSidebarCustomization(enabled, initializeSelections = true) {
  document.getElementById('sidebar-choice-groups')?.classList.toggle('visible', enabled);
  document.getElementById('sidebar-preference-actions')?.classList.toggle('visible', true);
  if (enabled && initializeSelections) {
    const checked = document.querySelectorAll('#sidebar-choice-groups input:checked');
    if (!checked.length) document.querySelectorAll('#sidebar-choice-groups input').forEach(input => { input.checked = true; });
  }
}

async function saveSidebarPreferences() {
  const customized = Boolean(document.getElementById('sidebar-customize-enabled')?.checked);
  const selected = [...document.querySelectorAll('#sidebar-choice-groups input:checked')].map(input => input.value);
  if (customized) {
    const missingCategory = Object.keys(sidebarCategories).find(category => !selected.some(page => sidebarCategories[category].pages.includes(page)));
    if (missingCategory) {
      showToast(`Choose at least one page from ${sidebarCategories[missingCategory].label}.`, 'error');
      return;
    }
  }
  const button = document.getElementById('sidebar-preference-save');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  const { data, error } = await supabaseClient.rpc('update_own_sidebar_preferences', { p_customized: customized, p_items: selected });
  if (button) { button.disabled = false; button.textContent = 'Save sidebar'; }
  if (error || !data) {
    console.error(error);
    showToast("Couldn't save sidebar preferences. Run the latest Supabase SQL files first.", 'error');
    return;
  }
  const member = currentMemberRecord();
  if (member) { member.sidebarCustomized = customized; member.sidebarItems = selected; }
  applySidebarPreferences();
  showToast('Sidebar preferences saved.');
}

const dashboardStatCatalog = {
  my_assignments: { label: 'My assignments', description: 'Upcoming event roles and confirmations.', access: 'member', tone: 'green' },
  upcoming_events: { label: 'Upcoming events', description: 'Events still ahead in Berlin time.', access: 'public', tone: 'purple' },
  available_equipment: { label: 'Available equipment', description: 'Equipment ready to reserve right now.', access: 'public', tone: 'teal' },
  my_reservations: { label: 'My reservations', description: 'Your scheduled and active equipment loans.', access: 'member', tone: 'blue' },
  projects: { label: 'Projects', description: 'Published Media Club work.', access: 'public', tone: 'coral' },
  event_categories: { label: 'Event types', description: 'The range of upcoming Media Club productions.', access: 'public', tone: 'amber' },
  members: { label: 'Members', description: 'Approved members in the directory.', access: 'member', tone: 'amber' },
  checked_out: { label: 'Checked out', description: 'Equipment currently in active use.', access: 'operations', tone: 'coral' },
  pending_applications: { label: 'Pending applications', description: 'Applications awaiting a decision.', access: 'admin', tone: 'amber' },
};

const dashboardSectionCatalog = {
  my_commitments: { label: 'My commitments', description: 'Your next roles, confirmations, and reservations.', access: 'member' },
  upcoming_events: { label: 'Upcoming events', description: 'A compact view of the next club events.', access: 'public' },
  announcements: { label: 'Announcements', description: 'The latest club-wide updates.', access: 'public' },
  equipment_snapshot: { label: 'Equipment snapshot', description: 'Availability and checkout balance at a glance.', access: 'public' },
};

function dashboardPreferenceAvailable(definition) {
  if (definition.access === 'admin') return canAccessAdminPanel();
  if (definition.access === 'operations') return canManageCrewOperations();
  if (definition.access === 'member') return !isVisitorSession() && Boolean(currentMemberRecord());
  return true;
}

function dashboardPreferenceDefaults() {
  if (isVisitorSession() || !currentMemberRecord()) {
    return { stats: ['upcoming_events', 'available_equipment', 'projects', 'event_categories'], sections: ['upcoming_events', 'announcements', 'equipment_snapshot'] };
  }
  if (canAccessAdminPanel()) {
    return { stats: ['pending_applications', 'upcoming_events', 'checked_out', 'members'], sections: ['upcoming_events', 'equipment_snapshot', 'announcements'] };
  }
  if (canManageCrewOperations()) {
    return { stats: ['my_assignments', 'upcoming_events', 'checked_out', 'available_equipment'], sections: ['my_commitments', 'upcoming_events', 'equipment_snapshot'] };
  }
  return { stats: ['my_assignments', 'upcoming_events', 'available_equipment', 'my_reservations'], sections: ['my_commitments', 'upcoming_events', 'announcements'] };
}

function currentDashboardPreferences() {
  const defaults = dashboardPreferenceDefaults();
  const saved = currentMemberRecord()?.dashboardPreferences;
  const availableStats = new Set(Object.entries(dashboardStatCatalog).filter(([, definition]) => dashboardPreferenceAvailable(definition)).map(([key]) => key));
  const availableSections = new Set(Object.entries(dashboardSectionCatalog).filter(([, definition]) => dashboardPreferenceAvailable(definition)).map(([key]) => key));
  const stats = [...new Set((saved?.stats || []).filter(key => availableStats.has(key)))];
  const sections = [...new Set((saved?.sections || []).filter(key => availableSections.has(key)))];
  return {
    stats: stats.length >= 2 && stats.length <= 4 ? stats : defaults.stats.filter(key => availableStats.has(key)),
    sections: sections.length >= 1 && sections.length <= 3 ? sections : defaults.sections.filter(key => availableSections.has(key)),
  };
}

function renderDashboardPreferenceChoices(kind, selectedKeys) {
  const catalog = kind === 'stats' ? dashboardStatCatalog : dashboardSectionCatalog;
  const container = document.getElementById(kind === 'stats' ? 'dashboard-stat-choices' : 'dashboard-section-choices');
  if (!container) return;
  const availableEntries = Object.entries(catalog).filter(([, definition]) => dashboardPreferenceAvailable(definition));
  const orderedKeys = [...selectedKeys.filter(key => availableEntries.some(([availableKey]) => availableKey === key)), ...availableEntries.map(([key]) => key).filter(key => !selectedKeys.includes(key))];
  container.innerHTML = orderedKeys.map(key => {
    const definition = catalog[key];
    const selected = selectedKeys.includes(key);
    return `<div class="dashboard-widget-choice ${selected ? 'selected' : ''}" data-dashboard-choice="${key}"><input type="checkbox" aria-label="Show ${escapeHtml(definition.label)}" ${selected ? 'checked' : ''} onchange="dashboardChoiceChanged('${kind}', '${key}', this)"><div class="dashboard-widget-copy"><strong>${escapeHtml(definition.label)}</strong><span>${escapeHtml(definition.description)}</span></div><div class="dashboard-order-actions"><button type="button" class="dashboard-order-button" data-direction="up" onclick="moveDashboardPreference('${kind}', '${key}', -1)" aria-label="Move ${escapeHtml(definition.label)} up">↑</button><button type="button" class="dashboard-order-button" data-direction="down" onclick="moveDashboardPreference('${kind}', '${key}', 1)" aria-label="Move ${escapeHtml(definition.label)} down">↓</button></div></div>`;
  }).join('');
  syncDashboardOrderButtons(kind);
}

function renderDashboardSettings(preferences = currentDashboardPreferences()) {
  renderDashboardPreferenceChoices('stats', preferences.stats);
  renderDashboardPreferenceChoices('sections', preferences.sections);
}

function dashboardChoiceChanged(kind, key, input) {
  const container = document.getElementById(kind === 'stats' ? 'dashboard-stat-choices' : 'dashboard-section-choices');
  const maximum = kind === 'stats' ? 4 : 3;
  const selected = [...container.querySelectorAll('input:checked')];
  if (selected.length > maximum) {
    input.checked = false;
    showToast(`Choose no more than ${maximum} ${kind === 'stats' ? 'statistics' : 'sections'}.`, 'error');
  }
  container.querySelector(`[data-dashboard-choice="${key}"]`)?.classList.toggle('selected', input.checked);
  syncDashboardOrderButtons(kind);
}

function syncDashboardOrderButtons(kind) {
  const container = document.getElementById(kind === 'stats' ? 'dashboard-stat-choices' : 'dashboard-section-choices');
  if (!container) return;
  const selectedRows = [...container.querySelectorAll('.dashboard-widget-choice')].filter(row => row.querySelector('input')?.checked);
  container.querySelectorAll('.dashboard-widget-choice').forEach(row => {
    const index = selectedRows.indexOf(row);
    const buttons = row.querySelectorAll('.dashboard-order-button');
    buttons[0].disabled = index <= 0;
    buttons[1].disabled = index < 0 || index === selectedRows.length - 1;
  });
}

function moveDashboardPreference(kind, key, direction) {
  const container = document.getElementById(kind === 'stats' ? 'dashboard-stat-choices' : 'dashboard-section-choices');
  const row = container?.querySelector(`[data-dashboard-choice="${key}"]`);
  if (!row?.querySelector('input')?.checked) return;
  const selectedRows = [...container.querySelectorAll('.dashboard-widget-choice')].filter(item => item.querySelector('input')?.checked);
  const index = selectedRows.indexOf(row);
  const target = selectedRows[index + direction];
  if (!target) return;
  if (direction < 0) container.insertBefore(row, target);
  else container.insertBefore(target, row);
  syncDashboardOrderButtons(kind);
}

function resetDashboardPreferenceForm() {
  renderDashboardSettings(dashboardPreferenceDefaults());
  showToast('Recommended dashboard selected. Save to apply it.');
}

async function saveDashboardPreferences() {
  const stats = [...document.querySelectorAll('#dashboard-stat-choices .dashboard-widget-choice')].filter(row => row.querySelector('input')?.checked).map(row => row.dataset.dashboardChoice);
  const sections = [...document.querySelectorAll('#dashboard-section-choices .dashboard-widget-choice')].filter(row => row.querySelector('input')?.checked).map(row => row.dataset.dashboardChoice);
  if (stats.length < 2 || stats.length > 4) { showToast('Choose between two and four statistics.', 'error'); return; }
  if (sections.length < 1 || sections.length > 3) { showToast('Choose between one and three information sections.', 'error'); return; }
  const button = document.getElementById('dashboard-preference-save');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  const preferences = { stats, sections };
  const { data, error } = await supabaseClient.rpc('update_own_dashboard_preferences', { p_preferences: preferences });
  if (button) { button.disabled = false; button.textContent = 'Save dashboard'; }
  if (error || !data) {
    console.error(error);
    showToast("Couldn't save dashboard preferences. Run the latest Supabase SQL files first.", 'error');
    return;
  }
  const member = currentMemberRecord();
  if (member) member.dashboardPreferences = preferences;
  renderDashboard();
  showToast('Dashboard preferences saved.');
}

function renderAllPagesMenu(query = '') {
  const list = document.getElementById('all-pages-list');
  if (!list) return;
  const search = query.trim().toLowerCase();
  const preferences = currentSidebarPreferences();
  const visible = new Set(preferences.items);
  list.innerHTML = Object.entries(sidebarCategories).map(([category, definition]) => {
    const pages = definition.pages.filter(page => sidebarPageAvailable(page) && (!search || pageTitles[page].toLowerCase().includes(search)));
    if (!pages.length) return '';
    return `<div class="all-pages-group"><div class="all-pages-group-title">${definition.label}</div>${pages.map(page => {
      const icon = document.querySelector(`.sidebar-nav .nav-item[data-page="${page}"] svg`)?.outerHTML || '';
      return `<a class="all-pages-link" href="${escapeHtml(pageUrl(page))}">${icon}<span>${pageTitles[page]}</span>${visible.has(page) ? '' : '<span class="all-pages-hidden-label">Hidden</span>'}</a>`;
    }).join('')}</div>`;
  }).join('') || '<div class="empty-state" style="padding:24px 12px;"><p>No matching pages.</p></div>';
}

function toggleAllPages(event) {
  event?.stopPropagation();
  const popover = document.getElementById('all-pages-popover');
  const open = popover.classList.toggle('open');
  document.getElementById('sidebar-all-pages-button')?.setAttribute('aria-expanded', String(open));
  if (open) {
    const search = document.getElementById('all-pages-search');
    search.value = '';
    renderAllPagesMenu();
    setTimeout(() => search.focus(), 0);
  }
}

function closeAllPages() {
  document.getElementById('all-pages-popover')?.classList.remove('open');
  document.getElementById('sidebar-all-pages-button')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', event => {
  const popover = document.getElementById('all-pages-popover');
  if (popover?.classList.contains('open') && !popover.contains(event.target) && !document.getElementById('sidebar-all-pages-button')?.contains(event.target)) closeAllPages();
  const notificationPanel = document.getElementById('notification-panel');
  if (notificationPanel?.classList.contains('open') && !notificationPanel.contains(event.target) && !document.getElementById('notification-button')?.contains(event.target)) closeNotificationPanel();
});

document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeAllPages(); closeNotificationPanel(); } });
