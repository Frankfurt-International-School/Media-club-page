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

function signupAttendanceChoices(ev) {
  const whole = {
    type: 'whole',
    label: ev?.isIsst ? `Whole time (${ev.game4Start ? '4' : '3'} games)` : ev?.isSports ? 'Whole time (2 games)' : 'Whole time',
    startTime: ev?.game1Start || ev?.time,
    endTime: ev?.game4End || ev?.game3End || ev?.game2End || ev?.game1End || ev?.endTime || '23:59',
  };
  const custom = { type: 'custom', label: 'Part time (choose arrival and leaving time)', custom: true };
  if (ev?.isFestival) {
    return [
      { type: 'setup', label: 'Setup (no role)', startTime: ev.setupStart, endTime: ev.setupEnd, roleFree: true },
      { type: 'shift_1', label: 'Shift 1', startTime: ev.shift1Start, endTime: ev.shift1End },
      { type: 'shift_2', label: 'Shift 2', startTime: ev.shift2Start, endTime: ev.shift2End },
      { type: 'takedown', label: 'Takedown (no role)', startTime: ev.takedownStart, endTime: ev.takedownEnd, roleFree: true },
      { type: 'custom', label: 'Custom time', custom: true },
    ];
  }
  if (ev?.isIsst) {
    return [whole, 1, 2, 3, 4].flatMap(item => {
      if (typeof item !== 'number') return [item];
      const startTime = ev[`game${item}Start`];
      const endTime = ev[`game${item}End`];
      return startTime && endTime ? [{ type: `game_${item}`, label: `Game ${item}`, startTime, endTime }] : [];
    }).concat(custom);
  }
  if (ev?.isSports) {
    return [
      whole,
      { type: 'game_1', label: 'Game 1', startTime: ev.game1Start, endTime: ev.game1End },
      { type: 'game_2', label: 'Game 2', startTime: ev.game2Start, endTime: ev.game2End },
      custom,
    ];
  }
  return [whole, custom];
}

function signupChoiceWindow(ev, choice) {
  if (!ev || !choice || choice.custom || !choice.startTime || !choice.endTime) return null;
  const start = timeValue(ev.date, choice.startTime);
  const end = timeValue(ev.date, choice.endTime);
  return start && end && end > start ? { type: choice.type, start, end, startTime: choice.startTime, endTime: choice.endTime } : null;
}

function signupRoleAvailability(ev, attendance) {
  if (!ev || !attendance) return [];
  const openRoles = eventOpenRoleLabels(ev);
  return currentUserSignupRoleKeys()
    .map(key => signupRoleLabels[key])
    .filter(role => openRoles.includes(role))
    .map(role => {
      const capacity = eventRoleCapacity(ev, role);
      const occupied = (ev.signups || []).filter(signup => signup.role === role && signupOverlaps(signup, attendance)).length;
      return { role, capacity, occupied, open: Math.max(0, capacity - occupied) };
    });
}

function signupAttendanceAvailability(ev) {
  return signupAttendanceChoices(ev).map(choice => {
    if (choice.custom) return { ...choice, isFull: false, openSlots: null };
    if (choice.roleFree) return { ...choice, isFull: false, openSlots: null };
    const roles = signupRoleAvailability(ev, signupChoiceWindow(ev, choice));
    const openSlots = roles.reduce((sum, role) => sum + role.open, 0);
    return { ...choice, roles, openSlots, isFull: openSlots === 0 };
  });
}

function signupCapacitySummary(ev) {
  const availability = signupAttendanceAvailability(ev);
  const periods = ev?.isFestival
    ? availability.filter(choice => choice.type.startsWith('shift_'))
    : ev?.isSports || ev?.isIsst
      ? availability.filter(choice => choice.type.startsWith('game_'))
      : availability.filter(choice => choice.type === 'whole');
  const totalSlots = periods.reduce((sum, period) => sum + (period.roles || []).reduce((roleSum, role) => roleSum + role.capacity, 0), 0);
  const openSlots = periods.reduce((sum, period) => sum + (period.openSlots || 0), 0);
  return {
    periods: periods.length,
    openPeriods: periods.filter(period => !period.isFull).length,
    totalSlots,
    openSlots,
  };
}

function renderSignupWindowAvailability(ev) {
  const container = document.getElementById('signup-window-picker');
  if (!container) return;
  const selected = document.getElementById('signup-attendance')?.value || '';
  const choices = signupAttendanceAvailability(ev).filter(choice => !choice.custom);
  if (choices.length <= 1) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div class="signup-window-picker-head"><strong>Choose a period</strong><span>Full periods stay visible so you can move to the next opening.</span></div>
    <div class="signup-window-options">${choices.map(choice => `
      <button type="button" class="signup-window-option${choice.type === selected ? ' active' : ''}${choice.isFull ? ' full' : ''}" onclick="selectSignupAttendanceWindow('${choice.type}')" ${choice.isFull ? 'disabled' : ''} aria-pressed="${choice.type === selected}">
        <strong>${escapeHtml(choice.label.replace(/ \(.+\)$/, ''))}</strong>
        <span>${escapeHtml(choice.startTime)}–${escapeHtml(choice.endTime)}</span>
        <small>${choice.roleFree ? 'No role required' : choice.isFull ? 'Fully staffed' : `${choice.openSlots} role ${choice.openSlots === 1 ? 'place' : 'places'} open`}</small>
      </button>`).join('')}</div>`;
}

function selectSignupAttendanceWindow(type) {
  const select = document.getElementById('signup-attendance');
  if (!select || ![...select.options].some(option => option.value === type && !option.disabled)) return;
  select.value = type;
  updateSignupAttendanceFields();
}

function renderSignupAttendanceOptions(ev) {
  const select = document.getElementById('signup-attendance');
  const guidance = document.getElementById('signup-attendance-guidance');
  const previous = select.value;
  const availability = signupAttendanceAvailability(ev);
  select.innerHTML = availability.map(choice => {
    const time = choice.startTime && choice.endTime ? ` · ${choice.startTime}–${choice.endTime}` : '';
    const status = choice.roleFree ? ' · no role required' : choice.isFull ? ' · fully staffed' : choice.openSlots === null ? '' : ` · ${choice.openSlots} open`;
    return `<option value="${choice.type}"${choice.isFull ? ' disabled' : ''}>${escapeHtml(choice.label + time + status)}</option>`;
  }).join('');

  const previousIndex = availability.findIndex(choice => choice.type === previous);
  const previousChoice = availability[previousIndex];
  const nextChoice = previousChoice?.isFull
    ? availability.slice(previousIndex + 1).concat(availability.slice(0, previousIndex)).find(choice => !choice.isFull && !choice.custom)
    : null;
  const selectedChoice = nextChoice
    || availability.find(choice => choice.type === previous && !choice.isFull)
    || availability.find(choice => !choice.isFull && !choice.custom)
    || availability.find(choice => choice.custom);
  if (selectedChoice) select.value = selectedChoice.type;
  if (guidance) {
    guidance.textContent = nextChoice
      ? `${previousChoice.label} is fully staffed, so the form moved to ${nextChoice.label}.`
      : 'Role availability updates for the selected period.';
  }
  renderSignupWindowAvailability(ev);
}

function updateSignupAttendanceFields() {
  const custom = document.getElementById('signup-attendance').value === 'custom';
  document.getElementById('signup-custom-time-fields').style.display = custom ? '' : 'none';
  document.getElementById('signup-attendance-choice').classList.toggle('part-time-selected', custom);
  const ev = state.events.find(event => event.id === document.getElementById('sheet-event-select')?.value);
  renderSignupWindowAvailability(ev);
  renderSignupRoleOptionsForCurrentEvent();
}

function attendanceLabel(signup) {
  if (!signup.attendanceStart || !signup.attendanceEnd) return 'Whole time';
  const start = berlinTimeLabel(signup.attendanceStart);
  const end = berlinTimeLabel(signup.attendanceEnd);
  const labels = { whole: 'Whole time', game_1: 'Game 1', game_2: 'Game 2', game_3: 'Game 3', game_4: 'Game 4', setup: 'Setup', shift_1: 'Shift 1', shift_2: 'Shift 2', takedown: 'Takedown', custom: 'Custom' };
  return `${labels[signup.attendanceType] || 'Custom'} · ${start}–${end}`;
}

function signupClubEquipmentLoadouts(signup, eventId, equipment = state.equipment) {
  if (signup.role !== signupRoleLabels.photographer || !signup.memberId || !eventId) return [];
  const signupStart = new Date(signup.attendanceStart).getTime();
  const signupEnd = new Date(signup.attendanceEnd).getTime();
  if (!Number.isFinite(signupStart) || !Number.isFinite(signupEnd) || signupStart >= signupEnd) return [];

  const grouped = new Map();
  equipment
    .filter(item => ['Camera', 'Recording Cameras', 'Lens'].includes(item.category))
    .forEach(item => item.reservations.forEach(reservation => {
      const reservationStart = new Date(reservation.startsAt).getTime();
      const reservationEnd = new Date(reservation.endsAt).getTime();
      const isActive = ['scheduled', 'checked_out'].includes(reservation.status)
        && !reservation.returnedAt
        && !reservation.autoReleasedAt;
      const matchesSignup = reservation.memberId === signup.memberId
        && reservation.eventId === eventId
        && reservation.type === 'event'
        && Number.isFinite(reservationStart)
        && Number.isFinite(reservationEnd)
        && reservationStart < signupEnd
        && reservationEnd > signupStart;
      if (!isActive || !matchesSignup) return;

      const groupKey = reservation.groupId || `${reservation.memberId}:${reservation.eventId}:${reservation.startsAt}:${reservation.endsAt}`;
      const group = grouped.get(groupKey) || { startsAt: reservationStart, items: new Map() };
      group.startsAt = Math.min(group.startsAt, reservationStart);
      group.items.set(item.id || item.name, { name: item.name, category: item.category });
      grouped.set(groupKey, group);
    }));

  const categoryOrder = category => category === 'Lens' ? 1 : 0;
  return [...grouped.values()]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map(group => [...group.items.values()]
      .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name))
      .map(item => item.name));
}

function signupCameraBadge(signup, eventId) {
  if (signup.role !== signupRoleLabels.photographer) return '';
  const badges = [];
  if (signup.equipmentSource === 'own' && signup.ownCameraName) {
    badges.push(`<span class="signup-camera-badge"><span aria-hidden="true"></span>Own camera · ${escapeHtml(signup.ownCameraName)}</span>`);
  }
  badges.push(...signupClubEquipmentLoadouts(signup, eventId).map(loadout => {
    const label = loadout.length > 1 ? 'Club kit' : 'Club camera';
    return `<span class="signup-camera-badge club-loadout"><span aria-hidden="true"></span>${label} · ${loadout.map(escapeHtml).join(' + ')}</span>`;
  }));
  return badges.join('');
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

function activeReserveAssignments(ev, now = Date.now()) {
  const assignments = new Map();
  const activationAt = reserveActivationAt(ev);
  if (!activationAt || now < activationAt) return assignments;
  const openRoles = eventOpenRoleLabels(ev);
  const claimed = [];
  const mixingReserves = eventAllowsMixingObsReserve(ev)
    ? ev.signups
      .filter(signup => signup.role === signupRoleLabels.mixing && signup.reserveRole1 === signupRoleLabels.obs)
      .sort((a, b) => (a.signedUpAt || '').localeCompare(b.signedUpAt || '') || a.id.localeCompare(b.id))
    : [];
  mixingReserves.forEach(mixer => {
    const realObsSignup = ev.signups.some(signup => signup.role === signupRoleLabels.obs && signupWindowsOverlap(signup, mixer));
    const reserveAlreadyAssigned = claimed.some(signup => signup.role === signupRoleLabels.obs && signupWindowsOverlap(signup, mixer));
    if (!realObsSignup && !reserveAlreadyAssigned) {
      assignments.set(mixer.id, signupRoleLabels.obs);
      claimed.push({ role: signupRoleLabels.obs, attendanceStart: mixer.attendanceStart, attendanceEnd: mixer.attendanceEnd });
    }
  });
  const supervisors = ev.signups
    .filter(signup => signup.role === signupRoleLabels.student_supervisor)
    .sort((a, b) => (a.signedUpAt || '').localeCompare(b.signedUpAt || '') || a.id.localeCompare(b.id));
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

function signupRoleCoverageLabel(signup, activeReserveRole) {
  const coversMixingAndObs = signup.role === signupRoleLabels.mixing
    && signup.reserveRole1 === signupRoleLabels.obs
    && activeReserveRole === signupRoleLabels.obs;
  return coversMixingAndObs ? `${signupRoleLabels.mixing} + ${signupRoleLabels.obs}` : signup.role;
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
  const capacity = signupCapacitySummary(ev);
  document.getElementById('sheet-event-cap').textContent = capacity.totalSlots
    ? `${ev.signups.length} signed up · ${capacity.openSlots} role ${capacity.openSlots === 1 ? 'place' : 'places'} open across ${capacity.openPeriods} ${capacity.openPeriods === 1 ? 'period' : 'periods'}`
    : `${ev.signups.length} signed up · no production roles available to this account`;
  const pct = capacity.totalSlots ? Math.round((capacity.totalSlots - capacity.openSlots) / capacity.totalSlots * 100) : 0;
  document.getElementById('sheet-progress').style.width = `${pct}%`;
  document.getElementById('sheet-cap-badge').innerHTML = capacity.totalSlots && capacity.openSlots === 0
    ? '<span class="badge badge-coral">All periods staffed</span>'
    : `<span class="badge badge-green">${capacity.openPeriods} ${capacity.openPeriods === 1 ? 'period' : 'periods'} open</span>`;

  const currentMemberId = currentMemberRecord()?.id;
  const canRemoveSignup = signup => Boolean(state.currentUser.isAdmin || (currentMemberId && signup.memberId === currentMemberId));
  const expiredSignups = ev.expiredSignups || [];
  const showRemoveColumn = ev.signups.some(canRemoveSignup) || expiredSignups.some(canRemoveSignup);
  const removeHeader = showRemoveColumn ? '<th></th>' : '';
  const reserveAssignments = activeReserveAssignments(ev);
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
    const coversMixingAndObs = s.role === signupRoleLabels.mixing
      && s.reserveRole1 === signupRoleLabels.obs
      && activeReserveRole === signupRoleLabels.obs;
    const roleCoverageLabel = signupRoleCoverageLabel(s, activeReserveRole);
    const reserveRoleNote = s.role === signupRoleLabels.student_supervisor
      ? activeReserveRole
        ? `<span class="reserve-priority-note"><strong>Current role:</strong> ${escapeHtml(activeReserveRole)}</span>`
        : s.reserveRole1
          ? `<span class="reserve-priority-note">${reserveIsActive ? 'Reserve not needed' : 'Reserve priority'}: ${escapeHtml(s.reserveRole1)} → ${escapeHtml(s.reserveRole2)}</span>`
          : ''
      : s.role === signupRoleLabels.mixing && s.reserveRole1 === signupRoleLabels.obs
        ? activeReserveRole
          ? '<span class="reserve-priority-note"><strong>Covering both:</strong> MIXING and OBS for this attendance window</span>'
          : `<span class="reserve-priority-note">${reserveIsActive ? 'OBS already has direct coverage · MIXING remains covered here' : 'OBS backup coverage · if vacant 10 minutes before start, this member covers both roles'}</span>`
        : '';
    return `
    <tr>
      <td class="row-num">${i + 1}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${roleCoverageLabel ? escapeHtml(roleCoverageLabel) : '<span style="color:var(--text3)">—</span>'}${signupCameraBadge(s, ev.id)}${s.confirmationStatus === 'maybe' ? `<span class="reserve-role-badge" style="background:var(--amber-dim);color:#9a6510;">Maybe · ${escapeHtml(confirmationCountdown(s.confirmationDeadline))}</span>` : ''}${activeReserveRole ? `<span class="reserve-role-badge">${coversMixingAndObs ? 'OBS covered' : 'Reserve active'}</span>` : ''}${reserveRoleNote}</td>
      <td style="color:var(--text2);font-size:12px;">${escapeHtml(attendanceLabel(s))}</td>
      <td style="color:var(--text3);font-size:12px;">${escapeHtml(s.ts)}</td>
      ${showRemoveColumn ? `<td><div class="flex gap6">${s.confirmationStatus === 'maybe' && s.memberId === currentMemberId ? `<button class="btn btn-accent btn-sm" onclick="confirmMaybeSignup('${ev.id}','${s.id}')">Confirm</button>` : ''}${canRemoveSignup(s) ? `<button class="btn btn-danger btn-sm" onclick="requestRemoveSignup('${ev.id}','${s.id}')">Remove</button>` : ''}</div></td>` : ''}
    </tr>`;
  }).join('');
  if (!rows && !expiredSignups.length) {
    rows = `<tr class="empty-row"><td colspan="${showRemoveColumn ? 6 : 5}">No one has signed up yet. Choose an open period below to be first.</td></tr>`;
  }
  rows += expiredSignups.map(s => `<tr style="opacity:.62;"><td class="row-num">—</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.role || '—')}${signupCameraBadge(s, ev.id)} <span class="badge badge-gray">Maybe expired · vacant</span></td><td>${escapeHtml(attendanceLabel(s))}</td><td>${escapeHtml(s.ts)}</td>${showRemoveColumn ? `<td>${canRemoveSignup(s) ? `<button class="btn btn-danger btn-sm" onclick="requestRemoveSignup('${ev.id}','${s.id}',true)">Remove</button>` : ''}</td>` : ''}</tr>`).join('');
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
  const role = document.getElementById('signup-role').value;
  if (role && eventRoleCapacity(ev, role) === 0) {
    showToast('That role is not open for this event.', 'error');
    renderSignupSheet();
    return;
  }
  const isStudentSupervisor = role === signupRoleLabels.student_supervisor;
  const isMixingObsReserve = role === signupRoleLabels.mixing
    && eventAllowsMixingObsReserve(ev)
    && document.getElementById('signup-mixer-obs-reserve')?.checked;
  const reserveRole1 = isStudentSupervisor
    ? document.getElementById('signup-reserve-role-1').value
    : isMixingObsReserve ? signupRoleLabels.obs : null;
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
      reserve_role_1: roleFreeAttendance ? null : reserveRole1,
      reserve_role_2: roleFreeAttendance ? null : reserveRole2,
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
