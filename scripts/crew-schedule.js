// ══════════════════════════════
// CREW DEPLOYMENT
// ══════════════════════════════
let crewDeploymentRefreshTimer = null;
let crewDeploymentView = 'upcoming';
const crewDeploymentSelectedDates = { upcoming: '', past: '' };
const crewAttendanceRealtimeIgnoreIds = new Set();
const crewAttendanceRealtimeIgnoreTimers = new Map();
const crewAttendanceSavingIds = new Set();

function clearCrewAttendanceRealtimeIgnore(signupId) {
  crewAttendanceRealtimeIgnoreIds.delete(signupId);
  const timer = crewAttendanceRealtimeIgnoreTimers.get(signupId);
  if (timer) clearTimeout(timer);
  crewAttendanceRealtimeIgnoreTimers.delete(signupId);
}

function shouldIgnoreCrewAttendanceRealtime(payload) {
  const signupId = String(payload?.new?.id || payload?.old?.id || '');
  if (!signupId || !crewAttendanceRealtimeIgnoreIds.has(signupId)) return false;
  clearCrewAttendanceRealtimeIgnore(signupId);
  return true;
}

window.shouldIgnoreCrewAttendanceRealtime = shouldIgnoreCrewAttendanceRealtime;

function deploymentLocation(event) {
  const location = String(event.loc || 'TBC').trim();
  const normalized = location.toLowerCase().replace(/\s+/g, ' ');
  if (/court\s*[123]/.test(normalized)) return { key: 'indoor-courts', label: 'Indoor Courts', order: 0 };
  if (normalized.includes('lower field')) return { key: 'lower-field', label: 'Lower Field', order: 1 };
  if (normalized.includes('upper field')) return { key: 'upper-field', label: 'Upper Field', order: 2 };
  if (normalized.includes('auditorium')) return { key: 'auditorium', label: 'Auditorium', order: 3 };
  if (normalized.includes('stroth')) return { key: 'stroth-center', label: 'Stroth Center', order: 4 };
  return { key: normalized || 'tbc', label: location || 'TBC', order: 10 };
}

function deploymentGameBlocks(event) {
  const games = [
    ['game_1', 'Game 1', event.game1Start, event.game1End],
    ['game_2', 'Game 2', event.game2Start, event.game2End],
    ['game_3', 'Game 3', event.game3Start, event.game3End],
    ['game_4', 'Game 4', event.game4Start, event.game4End],
  ].filter(([, , start, end]) => start && end);
  if ((event.isSports || event.isIsst) && games.length) {
    return games.map(([key, label, start, end]) => ({ key, label, start, end, startMs: timeValue(event.date, start), endMs: timeValue(event.date, end) }));
  }
  const start = event.time || '00:00';
  const endMs = eventEndTimestamp(event) || timeValue(event.date, '23:59');
  return [{ key: 'event', label: 'Event crew', start, end: berlinTimeLabel(endMs), startMs: timeValue(event.date, start), endMs }];
}

function signupCoversDeploymentBlock(signup, block) {
  if (!signup.attendanceStart || !signup.attendanceEnd) return true;
  return new Date(signup.attendanceStart).getTime() < block.endMs && new Date(signup.attendanceEnd).getTime() > block.startMs;
}

function deploymentCoverageState(signup, block) {
  if (!signup.attendanceStart || !signup.attendanceEnd) return { kind: 'full' };
  const startMs = new Date(signup.attendanceStart).getTime();
  const endMs = new Date(signup.attendanceEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return { kind: 'full' };
  if (startMs <= block.startMs && endMs >= block.endMs) return { kind: 'full' };
  if (startMs > block.startMs && endMs >= block.endMs) return { kind: 'joins', time: startMs };
  if (startMs <= block.startMs && endMs < block.endMs) return { kind: 'leaves', time: endMs };
  return { kind: 'partial', start: startMs, end: endMs };
}

function deploymentCoverageLabel(signup, block) {
  const coverage = deploymentCoverageState(signup, block);
  if (coverage.kind === 'full') return `Stays for full ${block.key === 'event' ? 'event' : block.label}`;
  if (coverage.kind === 'joins') return `Joins at ${berlinTimeLabel(coverage.time)}`;
  if (coverage.kind === 'leaves') return `Leaves at ${berlinTimeLabel(coverage.time)}`;
  return `On duty ${berlinTimeLabel(coverage.start)}–${berlinTimeLabel(coverage.end)}`;
}

function nextCrewAssignment(events, event, signup) {
  const assignmentStart = (candidateEvent, candidateSignup) => candidateSignup.attendanceStart
    ? new Date(candidateSignup.attendanceStart).getTime()
    : timeValue(candidateEvent.date, candidateEvent.game1Start || candidateEvent.time || '00:00');
  const currentStart = assignmentStart(event, signup);
  return events.flatMap(candidate => candidate.signups.map(candidateSignup => ({ event: candidate, signup: candidateSignup })))
    .filter(candidate => candidate.signup.id !== signup.id && candidate.signup.memberId === signup.memberId && assignmentStart(candidate.event, candidate.signup) > currentStart)
    .sort((a, b) => assignmentStart(a.event, a.signup) - assignmentStart(b.event, b.signup))[0] || null;
}

function attendanceOption(status, value, label) {
  return `<option value="${value}"${status === value ? ' selected' : ''}>${label}</option>`;
}

function crewAttendanceWindow(event, now = Date.now()) {
  const startsAt = timeValue(event.date, event.game1Start || event.time || '00:00');
  const endsAt = eventEndTimestamp(event) || startsAt;
  const opensAt = startsAt - 10 * 60 * 1000;
  const closesAt = endsAt + 24 * 60 * 60 * 1000;
  return { startsAt, endsAt, opensAt, closesAt, isOpen: now >= opensAt && now <= closesAt };
}

function crewDeploymentDates(view = crewDeploymentView, now = Date.now()) {
  return [...new Set(state.events
    .filter(event => view === 'past' ? isPastEvent(event, now) : !isPastEvent(event, now))
    .map(event => event.date))]
    .sort();
}

function defaultCrewDeploymentDate(dates, view = crewDeploymentView) {
  return view === 'past' ? dates.at(-1) || '' : dates[0] || '';
}

function updateCrewDeploymentControls(dates, selectedDate) {
  const select = document.getElementById('crew-deployment-date');
  const previous = document.getElementById('crew-deployment-date-previous');
  const next = document.getElementById('crew-deployment-date-next');
  const upcoming = document.getElementById('crew-deployment-upcoming');
  const past = document.getElementById('crew-deployment-past');
  const help = document.getElementById('crew-deployment-date-help');
  const index = dates.indexOf(selectedDate);
  if (select) select.disabled = !dates.length;
  if (previous) previous.disabled = index <= 0;
  if (next) next.disabled = index < 0 || index >= dates.length - 1;
  [upcoming, past].forEach((button, buttonIndex) => {
    if (!button) return;
    const active = crewDeploymentView === (buttonIndex === 0 ? 'upcoming' : 'past');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (help) help.textContent = crewDeploymentView === 'past'
    ? 'Completed productions remain editable until 24 hours after their end time; the newest log opens first.'
    : 'The nearest unfinished production is selected automatically.';
}

function initCrewDeployment() {
  if (!canAccessCrewSchedule()) return;
  const select = document.getElementById('crew-deployment-date');
  if (!select) return;
  const dates = crewDeploymentDates();
  const previous = crewDeploymentSelectedDates[crewDeploymentView] || select.value;
  select.innerHTML = dates.map(date => `<option value="${date}">${formatBerlinCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</option>`).join('');
  if (!dates.length) select.innerHTML = `<option value="">${crewDeploymentView === 'past' ? 'No past production logs' : 'No active or upcoming productions'}</option>`;
  select.value = dates.includes(previous) ? previous : defaultCrewDeploymentDate(dates);
  crewDeploymentSelectedDates[crewDeploymentView] = select.value;
  updateCrewDeploymentControls(dates, select.value);
  renderCrewDeployment();
}

function openCrewDeployment() {
  crewDeploymentView = 'upcoming';
  initCrewDeployment();
}

function setCrewDeploymentView(view) {
  if (!['upcoming', 'past'].includes(view) || crewDeploymentView === view) return;
  crewDeploymentView = view;
  initCrewDeployment();
}

function selectCrewDeploymentDate() {
  const select = document.getElementById('crew-deployment-date');
  if (!select) return;
  crewDeploymentSelectedDates[crewDeploymentView] = select.value;
  updateCrewDeploymentControls(crewDeploymentDates(), select.value);
  renderCrewDeployment();
}

function stepCrewDeploymentDate(direction) {
  const select = document.getElementById('crew-deployment-date');
  const dates = crewDeploymentDates();
  const currentIndex = dates.indexOf(select?.value || '');
  const nextIndex = Math.max(0, Math.min(dates.length - 1, currentIndex + direction));
  if (!select || currentIndex < 0 || nextIndex === currentIndex) return;
  select.value = dates[nextIndex];
  selectCrewDeploymentDate();
}

function attendanceStatusLabel(status) {
  return ({ not_taken: 'Not taken', present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' })[status] || 'Not taken';
}

function deploymentAttendanceAudit(signup) {
  if (signup.attendanceStatus === 'not_taken') return '<span class="deployment-attendance-audit missing">Attendance was not recorded</span>';
  const storedName = String(signup.attendanceMarkedByName || '').trim();
  const recorder = storedName && !storedName.includes('@') ? storedName : storedName ? 'Auth Admin' : '';
  const markedAt = signup.attendanceMarkedAt
    ? formatBerlinDateTime(signup.attendanceMarkedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  return `<span class="deployment-attendance-audit">${recorder ? `Recorded by ${escapeHtml(recorder)}` : 'Recorder unavailable'}${markedAt ? ` · ${escapeHtml(markedAt)}` : ''}</span>`;
}

function deploymentAttendanceControl(event, signup, attendanceOpen) {
  if (!attendanceOpen) {
    return `<div class="deployment-attendance-log"><span class="deployment-attendance-result status-${signup.attendanceStatus}">${escapeHtml(attendanceStatusLabel(signup.attendanceStatus))}</span>${deploymentAttendanceAudit(signup)}</div>`;
  }
  return `<select class="form-select deployment-attendance-select status-${signup.attendanceStatus}" data-event-id="${event.id}" data-signup-id="${signup.id}" aria-label="Attendance for ${escapeHtml(signup.name)}" ${attendanceOpen ? '' : 'disabled'} onchange="markCrewAttendance('${event.id}', '${signup.id}', this.value)">${attendanceOption(signup.attendanceStatus, 'not_taken', 'Not taken')}${attendanceOption(signup.attendanceStatus, 'present', 'Present')}${attendanceOption(signup.attendanceStatus, 'late', 'Late')}${attendanceOption(signup.attendanceStatus, 'absent', 'Absent')}${attendanceOption(signup.attendanceStatus, 'excused', 'Excused')}</select>`;
}

function deploymentAttendanceState(event, pastLog, now = Date.now()) {
  const attendanceWindow = crewAttendanceWindow(event, now);
  const attendanceTaken = event.signups.filter(signup => signup.attendanceStatus !== 'not_taken').length;
  const text = attendanceWindow.isOpen
    ? `${pastLog ? 'Edit until' : 'Attendance'} ${pastLog ? formatBerlinDateTime(attendanceWindow.closesAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : `${attendanceTaken}/${event.signups.length}`}`
    : now < attendanceWindow.opensAt
      ? `Opens ${berlinTimeLabel(attendanceWindow.opensAt)}`
      : `Closed · Logged ${attendanceTaken}/${event.signups.length}`;
  return { text, isOpen: attendanceWindow.isOpen };
}

function updateCrewAttendanceControl(control, status, saving) {
  ['not_taken', 'present', 'late', 'absent', 'excused'].forEach(value => control.classList.remove(`status-${value}`));
  control.classList.add(`status-${status}`);
  control.classList.toggle('is-saving', saving);
  control.value = status;
  control.disabled = saving;
  control.setAttribute('aria-busy', String(saving));
}

function updateCrewAttendanceUi(eventId, signupId, status, saving = false) {
  [...document.querySelectorAll('.deployment-attendance-select')]
    .filter(control => control.dataset.signupId === signupId)
    .forEach(control => updateCrewAttendanceControl(control, status, saving));

  const date = document.getElementById('crew-deployment-date')?.value;
  const pastLog = crewDeploymentView === 'past';
  const visibleEvents = state.events.filter(event => event.date === date && (pastLog ? isPastEvent(event) : !isPastEvent(event)));
  const attendanceCount = pastLog
    ? visibleEvents.reduce((total, event) => total + event.signups.filter(signup => signup.attendanceStatus === 'not_taken').length, 0)
    : visibleEvents.filter(event => crewAttendanceWindow(event).isOpen)
      .reduce((total, event) => total + event.signups.filter(signup => signup.attendanceStatus === 'not_taken').length, 0);
  const summary = document.querySelector('[data-deployment-attendance-summary]');
  if (summary) summary.innerHTML = `<strong>${attendanceCount}</strong> ${pastLog ? 'not recorded' : 'attendance pending'}`;

  const event = state.events.find(item => item.id === eventId);
  const indicator = [...document.querySelectorAll('[data-deployment-attendance-state]')]
    .find(item => item.dataset.deploymentAttendanceState === eventId);
  if (event && indicator) {
    const attendanceState = deploymentAttendanceState(event, pastLog);
    indicator.textContent = attendanceState.text;
    indicator.classList.toggle('open', attendanceState.isOpen);
    indicator.classList.toggle('logged', pastLog && !attendanceState.isOpen);
  }
}

function renderCrewDeployment() {
  if (!canAccessCrewSchedule()) return;
  if (crewDeploymentRefreshTimer) clearTimeout(crewDeploymentRefreshTimer);
  crewDeploymentRefreshTimer = setTimeout(() => {
    if (document.querySelector('.page.active')?.id === 'page-crew-deployment') initCrewDeployment();
  }, 30000);
  const date = document.getElementById('crew-deployment-date')?.value;
  const pastLog = crewDeploymentView === 'past';
  const events = state.events
    .filter(event => event.date === date && (pastLog ? isPastEvent(event) : !isPastEvent(event)))
    .sort((a, b) => timeValue(a.date, a.game1Start || a.time || '00:00') - timeValue(b.date, b.game1Start || b.time || '00:00'));
  const grid = document.getElementById('crew-deployment-grid');
  const summary = document.getElementById('crew-deployment-summary');
  if (!grid || !summary) return;
  const locations = new Map();
  events.forEach(event => {
    const group = deploymentLocation(event);
    if (!locations.has(group.key)) locations.set(group.key, { ...group, events: [] });
    locations.get(group.key).events.push(event);
  });
  const uniqueCrew = new Set(events.flatMap(event => event.signups.map(signup => signup.memberId))).size;
  const openAttendance = events.filter(event => crewAttendanceWindow(event).isOpen);
  const attendanceOutstanding = openAttendance.reduce((total, event) => total + event.signups.filter(signup => signup.attendanceStatus === 'not_taken').length, 0);
  const attendanceNotRecorded = events.reduce((total, event) => total + event.signups.filter(signup => signup.attendanceStatus === 'not_taken').length, 0);
  summary.innerHTML = `<span class="deployment-stat"><strong>${events.length}</strong> events</span><span class="deployment-stat"><strong>${locations.size}</strong> locations</span><span class="deployment-stat"><strong>${uniqueCrew}</strong> crew</span><span class="deployment-stat" data-deployment-attendance-summary><strong>${pastLog ? attendanceNotRecorded : attendanceOutstanding}</strong> ${pastLog ? 'not recorded' : 'attendance pending'}</span>`;
  if (!events.length) {
    const hasPastLogs = crewDeploymentDates('past').length > 0;
    grid.innerHTML = `<div class="empty-state deployment-empty-state"><p>${pastLog ? 'No completed production logs are available yet.' : 'No active or upcoming productions are scheduled.'}</p>${!pastLog && hasPastLogs ? '<button class="btn btn-ghost btn-sm" type="button" onclick="setCrewDeploymentView(\'past\')">Open past logs</button>' : ''}</div>`;
    return;
  }

  grid.innerHTML = [...locations.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)).map(location => `
    <section class="deployment-location">
      <div class="deployment-location-head"><div class="deployment-location-title">${escapeHtml(location.label)}</div><span class="badge badge-gray">${location.events.length} ${location.events.length === 1 ? 'event' : 'events'}</span></div>
      ${location.events.map(event => {
        const blocks = deploymentGameBlocks(event);
        const attendanceState = deploymentAttendanceState(event, pastLog);
        const attendanceOpen = attendanceState.isOpen;
        return `<article class="deployment-event${pastLog ? ' past-log' : ''}">
          <div class="deployment-event-head"><div><div class="deployment-event-title">${escapeHtml(event.title)}</div><div class="text-muted">${escapeHtml(event.loc)} · ${escapeHtml(eventScheduleTimeLabel(event))}</div></div><span class="deployment-attendance-state${attendanceOpen ? ' open' : ''}${pastLog && !attendanceOpen ? ' logged' : ''}" data-deployment-attendance-state="${event.id}">${escapeHtml(attendanceState.text)}</span></div>
          ${blocks.map(block => {
            const crew = event.signups.filter(signup => signupCoversDeploymentBlock(signup, block));
            return `<div class="deployment-game"><div class="deployment-game-head"><span>${block.label}</span><span>${block.start}–${block.end}</span></div>${crew.length ? crew.map(signup => {
              const firstCoveredBlock = blocks.find(candidate => signupCoversDeploymentBlock(signup, candidate));
              const next = firstCoveredBlock?.key === block.key ? nextCrewAssignment(events, event, signup) : null;
              const nextStart = next ? new Date(next.signup.attendanceStart || timeValue(next.event.date, next.event.game1Start || next.event.time || '00:00')).getTime() : null;
              const nextLabel = next ? `${next.event.loc || deploymentLocation(next.event).label} · ${berlinTimeLabel(nextStart)}` : '';
              const coverage = deploymentCoverageState(signup, block);
              return `<div class="deployment-person"><div><div class="deployment-person-name">${escapeHtml(signup.name)}${nextLabel ? `<span class="deployment-next">Next: ${escapeHtml(nextLabel)}</span>` : ''}</div><div class="deployment-person-role">${escapeHtml(signup.role || 'No production role')}</div><span class="deployment-coverage coverage-${coverage.kind}">${escapeHtml(deploymentCoverageLabel(signup, block))}</span></div>${deploymentAttendanceControl(event, signup, attendanceOpen)}</div>`;
            }).join('') : '<div class="deployment-empty-role">No crew assigned for this game.</div>'}</div>`;
          }).join('')}
        </article>`;
      }).join('')}
    </section>`).join('');
}

async function markCrewAttendance(eventId, signupId, status) {
  if (!canAccessCrewSchedule() || crewAttendanceSavingIds.has(signupId)) return;
  const event = state.events.find(item => item.id === eventId);
  const signup = event?.signups.find(item => item.id === signupId);
  if (!signup) return;
  const previous = {
    status: signup.attendanceStatus,
    markedAt: signup.attendanceMarkedAt,
    markedByName: signup.attendanceMarkedByName,
  };
  const markerName = currentMemberRecord()?.name || state.currentUser.name || '';
  clearCrewAttendanceRealtimeIgnore(signupId);
  crewAttendanceSavingIds.add(signupId);
  crewAttendanceRealtimeIgnoreIds.add(signupId);
  signup.attendanceStatus = status;
  signup.attendanceMarkedAt = status === 'not_taken' ? '' : new Date().toISOString();
  signup.attendanceMarkedByName = status === 'not_taken' ? '' : markerName;
  updateCrewAttendanceUi(eventId, signupId, status, true);
  const { data: updated, error } = await supabaseClient.rpc('mark_signup_attendance', { p_signup_id: signupId, p_attendance_status: status });
  crewAttendanceSavingIds.delete(signupId);
  if (error || !updated) {
    clearCrewAttendanceRealtimeIgnore(signupId);
    signup.attendanceStatus = previous.status;
    signup.attendanceMarkedAt = previous.markedAt;
    signup.attendanceMarkedByName = previous.markedByName;
    updateCrewAttendanceUi(eventId, signupId, previous.status, false);
    showToast(error?.message || "Couldn't update attendance.", 'error', 6000);
    return;
  }
  updateCrewAttendanceUi(eventId, signupId, status, false);
  if (crewAttendanceRealtimeIgnoreIds.has(signupId)) {
    crewAttendanceRealtimeIgnoreTimers.set(signupId, setTimeout(() => clearCrewAttendanceRealtimeIgnore(signupId), 5000));
  }
}
