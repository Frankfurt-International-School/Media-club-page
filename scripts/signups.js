// ══════════════════════════════
// SIGN-UP SHEETS
// ══════════════════════════════
function initSignupSheet() {
  const sel = document.getElementById('sheet-event-select');
  const previousEventId = sel.value;
  const requestedEventId = new URLSearchParams(window.location.search).get('event') || '';
  const upcomingEvents = state.events.filter(event => !isPastEvent(event));
  sel.innerHTML = upcomingEvents.map(e => `<option value="${e.id}">${escapeHtml(e.title)} — ${escapeHtml(fmtDate(e.date))}</option>`).join('');
  const preferredEventId = requestedEventId || previousEventId;
  if (upcomingEvents.some(event => event.id === preferredEventId)) sel.value = preferredEventId;
  renderSignupSheet();
}

function renderSignupAttendanceOptions(ev) {
  const select = document.getElementById('signup-attendance');
  const previous = select.value;
  select.innerHTML = ev?.isFestival
    ? '<option value="setup">Setup (no role)</option><option value="shift_1">Shift 1</option><option value="shift_2">Shift 2</option><option value="takedown">Takedown (no role)</option><option value="custom">Custom time</option>'
    : ev?.isIsst
      ? `<option value="whole">Whole time (${ev.game4Start ? '4' : '3'} games)</option><option value="game_1">Game 1</option><option value="game_2">Game 2</option><option value="game_3">Game 3</option>${ev.game4Start ? '<option value="game_4">Game 4</option>' : ''}<option value="custom">Part time (choose arrival and leaving time)</option>`
      : ev?.isSports
      ? '<option value="whole">Whole time (2 games)</option><option value="game_1">Half-the-time (Game 1)</option><option value="game_2">Half-the-time (Game 2)</option><option value="custom">Part time (choose arrival and leaving time)</option>'
      : '<option value="whole">Whole time</option><option value="custom">Part time (choose arrival and leaving time)</option>';
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
}

function updateSignupAttendanceFields() {
  const custom = document.getElementById('signup-attendance').value === 'custom';
  document.getElementById('signup-custom-time-fields').style.display = custom ? '' : 'none';
  document.getElementById('signup-attendance-choice').classList.toggle('part-time-selected', custom);
  renderSignupRoleOptionsForCurrentEvent();
}

function attendanceLabel(signup) {
  if (!signup.attendanceStart || !signup.attendanceEnd) return 'Whole time';
  const start = berlinTimeLabel(signup.attendanceStart);
  const end = berlinTimeLabel(signup.attendanceEnd);
  const labels = { whole: 'Whole time', game_1: 'Game 1', game_2: 'Game 2', game_3: 'Game 3', game_4: 'Game 4', setup: 'Setup', shift_1: 'Shift 1', shift_2: 'Shift 2', takedown: 'Takedown', custom: 'Custom' };
  return `${labels[signup.attendanceType] || 'Custom'} · ${start}–${end}`;
}

function signupCameraBadge(signup) {
  if (signup.role !== signupRoleLabels.photographer || signup.equipmentSource !== 'own' || !signup.ownCameraName) return '';
  return `<span class="signup-camera-badge"><span aria-hidden="true"></span>Own camera · ${escapeHtml(signup.ownCameraName)}</span>`;
}

let reserveActivationTimer = null;

function reserveActivationAt(ev) {
  const start = timeValue(ev.date, ev.time);
  return start ? start - 10 * 60 * 1000 : null;
}

function signupWindowsOverlap(a, b) {
  if (!a.attendanceStart || !a.attendanceEnd || !b.attendanceStart || !b.attendanceEnd) return true;
  return new Date(a.attendanceStart).getTime() < new Date(b.attendanceEnd).getTime()
    && new Date(a.attendanceEnd).getTime() > new Date(b.attendanceStart).getTime();
}

function activeSupervisorReserves(ev, now = Date.now()) {
  const assignments = new Map();
  const activationAt = reserveActivationAt(ev);
  if (!activationAt || now < activationAt) return assignments;
  const openRoles = eventOpenRoleLabels(ev);
  const supervisors = ev.signups
    .filter(signup => signup.role === signupRoleLabels.student_supervisor)
    .sort((a, b) => (a.signedUpAt || '').localeCompare(b.signedUpAt || '') || a.id.localeCompare(b.id));
  const claimed = [];
  supervisors.forEach(supervisor => {
    const choices = [supervisor.reserveRole1, supervisor.reserveRole2].filter(role => role && openRoles.includes(role));
    const selected = choices.find(role => {
      const realSignupExists = ev.signups.some(signup => signup.role === role && signupWindowsOverlap(signup, supervisor));
      const reserveAlreadyAssigned = claimed.some(signup => signup.role === role && signupWindowsOverlap(signup, supervisor));
      return !realSignupExists && !reserveAlreadyAssigned;
    });
    if (selected) {
      assignments.set(supervisor.id, selected);
      claimed.push({ role: selected, attendanceStart: supervisor.attendanceStart, attendanceEnd: supervisor.attendanceEnd });
    }
  });
  return assignments;
}

function scheduleReserveActivation(ev) {
  if (reserveActivationTimer) clearTimeout(reserveActivationTimer);
  const activationAt = reserveActivationAt(ev);
  const delay = activationAt ? activationAt - Date.now() : 0;
  if (delay <= 0) return;
  reserveActivationTimer = setTimeout(() => {
    if (document.getElementById('sheet-event-select')?.value === ev.id) renderSignupSheet();
  }, Math.min(delay + 50, 2147483647));
}

function renderSignupSheet() {
  const id = document.getElementById('sheet-event-select').value;
  const ev = state.events.find(e => e.id === id);
  if (!ev) {
    document.getElementById('sheet-table').innerHTML = '<tbody><tr><td>No upcoming events available.</td></tr></tbody>';
    document.getElementById('sheet-event-title').textContent = 'No upcoming events';
    document.getElementById('sheet-event-time').textContent = '—';
    document.getElementById('sheet-event-cap').textContent = '— slots';
    document.getElementById('sheet-cap-badge').innerHTML = '';
    document.getElementById('sheet-progress').style.width = '0%';
    document.getElementById('signup-entry-card').style.display = 'none';
    renderSignupRoleOptions(null);
    return;
  }
  document.getElementById('signup-entry-card').style.display = '';
  renderSignupAttendanceOptions(ev);
  updateSignupAttendanceFields();
  renderSignupRoleOptions(ev);
  renderSignupNameField();
  scheduleReserveActivation(ev);
  const maybeOption = document.querySelector('#signup-confirmation option[value="maybe"]');
  const confirmationHelp = document.getElementById('signup-confirmation-help');
  const maybeDeadline = timeValue(ev.date, ev.setupStart || ev.game1Start || ev.time) - 2 * 60 * 60 * 1000;
  const maybeClosed = maybeDeadline <= Date.now();
  if (maybeOption) maybeOption.disabled = maybeClosed;
  if (maybeClosed && document.getElementById('signup-confirmation')?.value === 'maybe') document.getElementById('signup-confirmation').value = 'confirmed';
  if (confirmationHelp) confirmationHelp.textContent = maybeClosed ? 'The Maybe deadline has passed; new signups must be confirmed.' : `Maybe signups must be confirmed by ${formatBerlinDateTime(maybeDeadline, { dateStyle: 'medium', timeStyle: 'short' })} Berlin time.`;
  document.getElementById('sheet-event-title').textContent = ev.title;
  document.getElementById('sheet-event-time').textContent = `${fmtDate(ev.date)} · ${eventScheduleTimeLabel(ev)} · ${ev.loc || 'TBC'}${sportsScheduleCaption(ev) ? ' · ' + sportsScheduleCaption(ev) : ''}${isstScheduleCaption(ev) ? ' · ' + isstScheduleCaption(ev) : ''}${festivalScheduleCaption(ev) ? ' · ' + festivalScheduleCaption(ev) : ''}`;
  const cap = ev.slots || '∞';
  document.getElementById('sheet-event-cap').textContent = `${ev.signups.length} signed up${ev.slots ? ' · ' + ev.slots + ' max' : ''}`;
  const pct = ev.slots ? Math.min(100, Math.round(ev.signups.length / ev.slots * 100)) : 0;
  document.getElementById('sheet-progress').style.width = ev.slots ? pct + '%' : '0%';
  const isFull = ev.slots && ev.signups.length >= ev.slots;
  document.getElementById('sheet-cap-badge').innerHTML = isFull
    ? '<span class="badge badge-coral">Full</span>'
    : `<span class="badge badge-green">${ev.slots ? ev.slots - ev.signups.length + ' open' : 'Open'}</span>`;

  const currentMemberId = currentMemberRecord()?.id;
  const canRemoveSignup = signup => Boolean(state.currentUser.isAdmin || (currentMemberId && signup.memberId === currentMemberId));
  const expiredSignups = ev.expiredSignups || [];
  const showRemoveColumn = ev.signups.some(canRemoveSignup) || expiredSignups.some(canRemoveSignup);
  const removeHeader = showRemoveColumn ? '<th></th>' : '';
  const reserveAssignments = activeSupervisorReserves(ev);
  const activationAt = reserveActivationAt(ev);
  const reserveIsActive = Boolean(activationAt && Date.now() >= activationAt);
  const orderedSignups = ev.signups
    .map(signup => ({ signup, sortRole: reserveAssignments.get(signup.id) || signup.role }))
    .sort((a, b) => {
      const roleA = signupRoleDisplayOrder.indexOf(a.sortRole);
      const roleB = signupRoleDisplayOrder.indexOf(b.sortRole);
      const roleOrder = (roleA < 0 ? signupRoleDisplayOrder.length : roleA) - (roleB < 0 ? signupRoleDisplayOrder.length : roleB);
      if (roleOrder) return roleOrder;
      const timeOrder = (a.signup.attendanceStart || '').localeCompare(b.signup.attendanceStart || '');
      return timeOrder || a.signup.name.localeCompare(b.signup.name);
    });
  let rows = orderedSignups.map(({ signup: s }, i) => {
    const activeReserveRole = reserveAssignments.get(s.id);
    const supervisorRoleNote = s.role === signupRoleLabels.student_supervisor
      ? activeReserveRole
        ? `<span class="reserve-priority-note"><strong>Current role:</strong> ${escapeHtml(activeReserveRole)}</span>`
        : s.reserveRole1
          ? `<span class="reserve-priority-note">${reserveIsActive ? 'Reserve not needed' : 'Reserve priority'}: ${escapeHtml(s.reserveRole1)} → ${escapeHtml(s.reserveRole2)}</span>`
          : ''
      : '';
    return `
    <tr>
      <td class="row-num">${i + 1}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${s.role ? escapeHtml(s.role) : '<span style="color:var(--text3)">—</span>'}${signupCameraBadge(s)}${s.confirmationStatus === 'maybe' ? `<span class="reserve-role-badge" style="background:var(--amber-dim);color:#9a6510;">Maybe · ${escapeHtml(confirmationCountdown(s.confirmationDeadline))}</span>` : ''}${activeReserveRole ? '<span class="reserve-role-badge">Reserve active</span>' : ''}${supervisorRoleNote}</td>
      <td style="color:var(--text2);font-size:12px;">${escapeHtml(attendanceLabel(s))}</td>
      <td style="color:var(--text3);font-size:12px;">${escapeHtml(s.ts)}</td>
      ${showRemoveColumn ? `<td><div class="flex gap6">${s.confirmationStatus === 'maybe' && s.memberId === currentMemberId ? `<button class="btn btn-accent btn-sm" onclick="confirmMaybeSignup('${ev.id}','${s.id}')">Confirm</button>` : ''}${canRemoveSignup(s) ? `<button class="btn btn-danger btn-sm" onclick="requestRemoveSignup('${ev.id}','${s.id}')">Remove</button>` : ''}</div></td>` : ''}
    </tr>`;
  }).join('');
  if (ev.slots) {
    const empty = Math.min(3, ev.slots - ev.signups.length);
    for (let i = 0; i < empty; i++) {
      rows += `<tr class="empty-row"><td class="row-num">${ev.signups.length + i + 1}</td><td>open slot</td><td>—</td><td>—</td><td>—</td>${showRemoveColumn ? '<td></td>' : ''}</tr>`;
    }
  }
  rows += expiredSignups.map(s => `<tr style="opacity:.62;"><td class="row-num">—</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.role || '—')}${signupCameraBadge(s)} <span class="badge badge-gray">Maybe expired · vacant</span></td><td>${escapeHtml(attendanceLabel(s))}</td><td>${escapeHtml(s.ts)}</td>${showRemoveColumn ? `<td>${canRemoveSignup(s) ? `<button class="btn btn-danger btn-sm" onclick="requestRemoveSignup('${ev.id}','${s.id}',true)">Remove</button>` : ''}</td>` : ''}</tr>`).join('');
  document.getElementById('sheet-table').innerHTML = `
    <thead><tr><th>#</th><th>Name</th><th>Event role</th><th>Staying for</th><th>Signed up</th>${removeHeader}</tr></thead>
    <tbody>${rows}</tbody>`;
}

function confirmationCountdown(deadline) {
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return 'expired';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.ceil((remaining % 3600000) / 60000);
  return hours ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

async function confirmMaybeSignup(eventId, signupId) {
  const { data, error } = await supabaseClient.rpc('confirm_own_maybe_signup', { p_signup_id: signupId });
  if (error || !data) { showToast(error?.message || 'This confirmation deadline has passed.', 'error', 6000); await loadCrewCenterData(); return; }
  const signup = state.events.find(event => event.id === eventId)?.signups.find(item => item.id === signupId);
  if (signup) { signup.confirmationStatus = 'confirmed'; signup.confirmedAt = new Date().toISOString(); }
  showToast('Your attendance is confirmed.');
  renderSignupSheet();
  renderNotificationCenter();
}

async function addSignupRow() {
  if (isVisitorSession()) {
    showToast('Visitors can view events, but cannot sign up for roles.', 'error');
    return;
  }
  const id = document.getElementById('sheet-event-select').value;
  const ev = state.events.find(e => e.id === id);
  const canChooseMember = canSignupForOtherMembers();
  const nameInput = document.getElementById('signup-name');
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  if (!name) {
    setSignupNameHelp('Write your full name as displayed on the Members page.', 'error');
    showToast('Write your full name as displayed on the Members page.', 'error');
    return;
  }
  const matchingMembers = validateSignupNameInput(true);
  if (matchingMembers.length === 0) {
    showToast('Name not found. Check the spelling or copy it from the Members page.', 'error');
    return;
  }
  if (matchingMembers.length > 1) {
    showToast('More than one member has this name. Ask an administrator to make the member records unique.', 'error');
    return;
  }
  const matchedMember = matchingMembers[0];
  if (ev.slots && ev.signups.length >= ev.slots) { showToast('This event is full!', 'error'); return; }
  const role = document.getElementById('signup-role').value;
  if (role && eventRoleCapacity(ev, role) === 0) {
    showToast('That role is not open for this event.', 'error');
    renderSignupSheet();
    return;
  }
  const isStudentSupervisor = role === signupRoleLabels.student_supervisor;
  const reserveRole1 = isStudentSupervisor ? document.getElementById('signup-reserve-role-1').value : null;
  const reserveRole2 = isStudentSupervisor ? document.getElementById('signup-reserve-role-2').value : null;
  const attendance = selectedAttendanceWindow(ev);
  if (!attendance) {
    showToast('Please choose valid arrival and leaving times.', 'error');
    return;
  }
  const roleFreeAttendance = ev.isFestival && ['setup', 'takedown'].includes(attendance.type);
  if (!roleFreeAttendance && !role) { showToast('Please choose an available role.', 'error'); return; }
  if (isStudentSupervisor && (!reserveRole1 || !reserveRole2 || reserveRole1 === reserveRole2)) {
    showToast('Choose two different reserve roles in priority order.', 'error');
    return;
  }
  if (isStudentSupervisor && [reserveRole1, reserveRole2].some(reserveRole => !availableReserveRoleLabels().includes(reserveRole))) {
    showToast('Student Supervisors cannot use Photographer as a reserve role.', 'error', 6000);
    updateReserveRoleFields();
    return;
  }
  const eventStart = timeValue(ev.date, ev.setupStart || ev.game1Start || ev.time);
  const eventEnd = timeValue(ev.date, ev.takedownEnd || ev.game4End || ev.game3End || ev.game2End || ev.game1End || ev.endTime || '23:59');
  if (attendance.type === 'custom' && (attendance.start < eventStart || attendance.end > eventEnd)) {
    showToast('Custom attendance must be within the event times.', 'error');
    return;
  }
  const confirmationStatus = document.getElementById('signup-confirmation')?.value === 'maybe' ? 'maybe' : 'confirmed';
  if (confirmationStatus === 'maybe' && eventStart - Date.now() <= 2 * 60 * 60 * 1000) {
    showToast('Maybe signups close two hours before the event starts. Please confirm now or leave the role open.', 'error', 6000);
    return;
  }
  const overlappingRoleSignups = ev.signups.filter(signup => signup.role === role && signupOverlaps(signup, attendance));
  const roleCapacity = eventRoleCapacity(ev, role);
  if (!roleFreeAttendance && overlappingRoleSignups.length >= roleCapacity) {
    showToast(`${roleCapacity > 1 ? 'All slots are' : 'Slot is'} occupied for ${role} during that time.`, 'error');
    renderSignupSheet();
    return;
  }
  const signedInMember = currentMemberRecord();
  nameInput.value = matchedMember.name;
  const member = canChooseMember ? matchedMember : signedInMember;
  if (!member) {
    showToast("Couldn't match your account to a member record.", 'error');
    return;
  }
  if (!canChooseMember && member.id !== matchedMember.id) {
    showToast('You can only sign up using your own full name.', 'error');
    return;
  }
  const personalCameraName = member.personalEquipmentPreferences?.cameraName?.trim() || '';
  const equipmentSource = role === signupRoleLabels.photographer && document.getElementById('signup-camera-source-select')?.value === 'own' ? 'own' : 'club';
  if (equipmentSource === 'own' && !personalCameraName) {
    showToast('Add a personal camera in Settings before using My camera for a Photographer signup.', 'error', 6000);
    renderSignupCameraSource();
    return;
  }
  if (role !== signupRoleLabels.adult_supervisor) {
    const conflict = state.events.flatMap(candidate => candidate.signups.map(signup => ({ event: candidate, signup })))
      .find(candidate => candidate.event.id !== ev.id && candidate.signup.memberId === member.id && signupOverlaps(candidate.signup, attendance));
    if (conflict) {
      showToast(`${member.name} is already assigned to ${conflict.event.title} during that time.`, 'error', 6000);
      return;
    }
  }
  const { data: signup, error } = await supabaseClient
    .from('signups')
    .insert({
      event_id: ev.id,
      member_id: member.id,
      signup_role: roleFreeAttendance ? null : role,
      reserve_role_1: isStudentSupervisor ? reserveRole1 : null,
      reserve_role_2: isStudentSupervisor ? reserveRole2 : null,
      equipment_source: equipmentSource,
      own_camera_name: equipmentSource === 'own' ? personalCameraName : null,
      attendance_type: attendance.type,
      attendance_start: new Date(attendance.start).toISOString(),
      attendance_end: new Date(attendance.end).toISOString(),
      confirmation_status: confirmationStatus,
    })
    .select('id, member_id, signup_role, role_slot, reserve_role_1, reserve_role_2, equipment_source, own_camera_name, attendance_type, attendance_start, attendance_end, attendance_status, attendance_marked_at, attendance_marked_by, attendance_marked_by_name, confirmation_status, confirmation_deadline, confirmed_at, signed_up_at, members(name, role)')
    .single();
  if (error) {
    if (error.code === '23505' || error.code === '23P01') {
      const crossEventConflict = error.message?.includes('signups_member_cross_event_no_overlap');
      showToast(error.code === '23P01' ? crossEventConflict ? 'You already have another event assignment during that time.' : 'Slot occupied during that time.' : 'You are already signed up for this event.', 'error');
      await loadCrewCenterData();
      return;
    }
    const safeMessage = /role is not open|signup slots are available/i.test(error.message || '') ? error.message : "Couldn't save signup.";
    showToast(safeMessage, 'error', 6000);
    return;
  }
  ev.signups.push({
    id: signup.id,
    memberId: signup.member_id,
    name: signup.members?.name || member.name,
    role: signup.signup_role || '',
    roleSlot: Number(signup.role_slot) || 1,
    reserveRole1: signup.reserve_role_1 || '',
    reserveRole2: signup.reserve_role_2 || '',
    equipmentSource: signup.equipment_source === 'own' ? 'own' : 'club',
    ownCameraName: signup.own_camera_name || '',
    attendanceType: signup.attendance_type || attendance.type,
    attendanceStart: signup.attendance_start,
    attendanceEnd: signup.attendance_end,
    attendanceStatus: signup.attendance_status || 'not_taken',
    attendanceMarkedAt: signup.attendance_marked_at || '',
    attendanceMarkedBy: signup.attendance_marked_by || '',
    attendanceMarkedByName: signup.attendance_marked_by_name || '',
    confirmationStatus: signup.confirmation_status || 'confirmed',
    confirmationDeadline: signup.confirmation_deadline || '',
    confirmedAt: signup.confirmed_at || '',
    ts: formatBerlinDateTime(signup.signed_up_at, { dateStyle: 'medium', timeStyle: 'short' }),
    signedUpAt: signup.signed_up_at || '',
  });
  document.getElementById('signup-name').value = '';
  clearSignupNameValidation();
  document.getElementById('signup-confirmation').value = 'confirmed';
  showToast(confirmationStatus === 'maybe' ? `${member.name} is tentatively signed up. Confirm before the deadline.` : `${member.name} signed up for ${ev.title}!`);
  renderSignupSheet();
}

function requestRemoveSignup(eventId, signupId, expired = false) {
  const event = state.events.find(item => item.id === eventId);
  const collection = expired ? event?.expiredSignups : event?.signups;
  const signup = collection?.find(item => item.id === signupId);
  const currentMemberId = currentMemberRecord()?.id;
  if (!signup || (!state.currentUser.isAdmin && signup.memberId !== currentMemberId)) {
    showToast('You can only remove your own signup.', 'error');
    return;
  }
  const removesAnotherMember = signup.memberId !== currentMemberId;
  openActionConfirmation({
    kind: 'remove-signup',
    title: removesAnotherMember
      ? `Remove ${signup.name} from ${event.title}?`
      : `Remove your signup from ${event.title}?`,
    copy: removesAnotherMember
      ? `You are removing another member's signup as an Auth Admin. Their position will immediately become available.`
      : 'Your position will immediately become available for another member.',
    impact: [
      signup.role || 'No production role',
      attendanceLabel(signup),
      expired ? 'Expired Maybe signup' : 'Active signup',
    ],
    danger: true,
    confirmLabel: 'Remove signup',
    busyLabel: 'Removing...',
    execute: () => removeSignup(eventId, signupId, expired),
  });
}

async function removeSignup(eventId, signupId, expired = false) {
  const event = state.events.find(item => item.id === eventId);
  const collection = expired ? event?.expiredSignups : event?.signups;
  const signup = collection?.find(item => item.id === signupId);
  const currentMemberId = currentMemberRecord()?.id;
  if (!signup || (!state.currentUser.isAdmin && signup.memberId !== currentMemberId)) {
    showToast('This signup can no longer be removed.', 'error');
    return false;
  }
  const { error } = await supabaseClient.from('signups').delete().eq('id', signupId);
  if (error) { showToast(error.message || "Couldn't remove signup.", 'error', 6000); return false; }
  if (expired) event.expiredSignups = event.expiredSignups.filter(item => item.id !== signupId);
  else event.signups = event.signups.filter(item => item.id !== signupId);
  renderSignupSheet();
  renderNotificationCenter();
  renderDashboard();
  showToast(`${signup.name}'s signup removed.`, 'error');
  return true;
}
