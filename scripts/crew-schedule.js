// ══════════════════════════════
// CREW DEPLOYMENT
// ══════════════════════════════
let crewDeploymentRefreshTimer = null;

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

function initCrewDeployment() {
  if (!canAccessCrewSchedule()) return;
  const select = document.getElementById('crew-deployment-date');
  if (!select) return;
  const previous = select.value;
  const dates = [...new Set(state.events.map(event => event.date))].sort();
  select.innerHTML = dates.map(date => `<option value="${date}">${formatBerlinCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</option>`).join('');
  const today = berlinDateKey();
  if (dates.includes(previous)) select.value = previous;
  else select.value = dates.find(date => date >= today) || dates.at(-1) || '';
  renderCrewDeployment();
}

function renderCrewDeployment() {
  if (!canAccessCrewSchedule()) return;
  if (crewDeploymentRefreshTimer) clearTimeout(crewDeploymentRefreshTimer);
  crewDeploymentRefreshTimer = setTimeout(() => {
    if (document.querySelector('.page.active')?.id === 'page-crew-deployment') renderCrewDeployment();
  }, 30000);
  const date = document.getElementById('crew-deployment-date')?.value;
  const events = state.events.filter(event => event.date === date).sort((a, b) => timeValue(a.date, a.game1Start || a.time || '00:00') - timeValue(b.date, b.game1Start || b.time || '00:00'));
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
  const openAttendance = events.filter(event => Date.now() >= timeValue(event.date, event.game1Start || event.time || '00:00') - 10 * 60 * 1000);
  const attendanceOutstanding = openAttendance.reduce((total, event) => total + event.signups.filter(signup => signup.attendanceStatus === 'not_taken').length, 0);
  summary.innerHTML = `<span class="deployment-stat"><strong>${events.length}</strong> events</span><span class="deployment-stat"><strong>${locations.size}</strong> locations</span><span class="deployment-stat"><strong>${uniqueCrew}</strong> crew</span><span class="deployment-stat"><strong>${attendanceOutstanding}</strong> attendance pending</span>`;
  if (!events.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>No events are scheduled for this date.</p></div>';
    return;
  }

  grid.innerHTML = [...locations.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)).map(location => `
    <section class="deployment-location">
      <div class="deployment-location-head"><div class="deployment-location-title">${escapeHtml(location.label)}</div><span class="badge badge-gray">${location.events.length} ${location.events.length === 1 ? 'event' : 'events'}</span></div>
      ${location.events.map(event => {
        const eventStart = timeValue(event.date, event.game1Start || event.time || '00:00');
        const attendanceOpen = Date.now() >= eventStart - 10 * 60 * 1000;
        const attendanceTaken = event.signups.filter(signup => signup.attendanceStatus !== 'not_taken').length;
        const blocks = deploymentGameBlocks(event);
        return `<article class="deployment-event">
          <div class="deployment-event-head"><div><div class="deployment-event-title">${escapeHtml(event.title)}</div><div class="text-muted">${escapeHtml(event.loc)} · ${escapeHtml(event.time || 'TBC')}</div></div><span class="deployment-attendance-state${attendanceOpen ? ' open' : ''}">${attendanceOpen ? `Attendance ${attendanceTaken}/${event.signups.length}` : `Opens ${escapeHtml(berlinTimeLabel(eventStart - 10 * 60 * 1000))}`}</span></div>
          ${blocks.map(block => {
            const crew = event.signups.filter(signup => signupCoversDeploymentBlock(signup, block));
            return `<div class="deployment-game"><div class="deployment-game-head"><span>${block.label}</span><span>${block.start}–${block.end}</span></div>${crew.length ? crew.map(signup => {
              const firstCoveredBlock = blocks.find(candidate => signupCoversDeploymentBlock(signup, candidate));
              const next = firstCoveredBlock?.key === block.key ? nextCrewAssignment(events, event, signup) : null;
              const nextStart = next ? new Date(next.signup.attendanceStart || timeValue(next.event.date, next.event.game1Start || next.event.time || '00:00')).getTime() : null;
              const nextLabel = next ? `${next.event.loc || deploymentLocation(next.event).label} · ${berlinTimeLabel(nextStart)}` : '';
              return `<div class="deployment-person"><div><div class="deployment-person-name">${escapeHtml(signup.name)}${nextLabel ? `<span class="deployment-next">Next: ${escapeHtml(nextLabel)}</span>` : ''}</div><div class="deployment-person-role">${escapeHtml(signup.role || 'No production role')} · ${escapeHtml(attendanceLabel(signup))}</div></div><select class="form-select deployment-attendance-select status-${signup.attendanceStatus}" ${attendanceOpen ? '' : 'disabled'} onchange="markCrewAttendance('${event.id}', '${signup.id}', this.value)">${attendanceOption(signup.attendanceStatus, 'not_taken', 'Not taken')}${attendanceOption(signup.attendanceStatus, 'present', 'Present')}${attendanceOption(signup.attendanceStatus, 'late', 'Late')}${attendanceOption(signup.attendanceStatus, 'absent', 'Absent')}${attendanceOption(signup.attendanceStatus, 'excused', 'Excused')}</select></div>`;
            }).join('') : '<div class="deployment-empty-role">No crew assigned for this game.</div>'}</div>`;
          }).join('')}
        </article>`;
      }).join('')}
    </section>`).join('');
}

async function markCrewAttendance(eventId, signupId, status) {
  if (!canAccessCrewSchedule()) return;
  const { data: updated, error } = await supabaseClient.rpc('mark_signup_attendance', { p_signup_id: signupId, p_attendance_status: status });
  if (error || !updated) { showToast(error?.message || "Couldn't update attendance.", 'error', 6000); renderCrewDeployment(); return; }
  const event = state.events.find(item => item.id === eventId);
  const signup = event?.signups.find(item => item.id === signupId);
  if (signup) {
    signup.attendanceStatus = status;
    signup.attendanceMarkedAt = status === 'not_taken' ? '' : new Date().toISOString();
    signup.attendanceMarkedByName = status === 'not_taken' ? '' : currentMemberRecord()?.name || state.currentUser.name || '';
  }
  renderCrewDeployment();
}

