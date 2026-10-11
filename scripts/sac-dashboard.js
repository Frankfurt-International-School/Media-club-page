// Personal summaries use the existing SAC permissions and only the current member's bookings.
const sacDashboardState = { request: 0 };

function resetSacDashboardState() {
  sacDashboardState.request += 1;
  for (const id of ['sac-home-next-shift', 'sac-home-upcoming']) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = '';
  }
  const count = document.getElementById('sac-home-shift-count');
  if (count) count.textContent = '—';
  const label = document.getElementById('sac-home-member-label');
  if (label) label.textContent = '';
  const greeting = document.getElementById('sac-home-greeting');
  if (greeting) greeting.textContent = 'Your SAC dashboard';
}

window.resetSacDashboardState = resetSacDashboardState;

function sacDashboardNotice(message, failed = false) {
  return `<div class="sac-dashboard-notice" role="${failed ? 'alert' : 'status'}"><p>${escapeHtml(message)}</p>${failed ? '<button class="btn btn-ghost btn-sm" type="button" data-sac-dashboard-retry>Try again</button>' : ''}</div>`;
}

async function renderSacPersonalDashboard() {
  window.syncPersonalWeekButtons?.();
  const next = document.getElementById('sac-home-next-shift');
  const upcoming = document.getElementById('sac-home-upcoming');
  const count = document.getElementById('sac-home-shift-count');
  if (!next || !upcoming || !count || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  const request = ++sacDashboardState.request;
  const member = currentMemberRecord();
  const ownId = member?.id;
  const isSacMember = Boolean(ownId && member.teamKeys?.includes('sac'));
  const showActivities = typeof sacDashboardPreferences !== 'function' || sacDashboardPreferences().showActivities;
  const activitiesPanel = document.getElementById('sac-dashboard-upcoming-panel');
  if (activitiesPanel) activitiesPanel.hidden = !showActivities;
  document.getElementById('sac-home-member-label').textContent = isSacMember
    ? sacTitleLabel(member.sacTitle) || 'SAC Member'
    : 'SAC preview · Membership required to book shifts';
  count.textContent = '—';
  next.innerHTML = isSacMember
    ? sacDashboardNotice('Loading your next shift…')
    : '<div class="sac-dashboard-notice"><h3>SAC membership required</h3><p>You can explore events and meetings. Scoreboard bookings are available to current SAC members.</p><a class="btn btn-ghost btn-sm" href="https://info.fismediaclub.org/#join">Request SAC access</a></div>';
  upcoming.innerHTML = sacDashboardNotice('Loading events and meetings…');
  if (!supabaseClient) {
    if (isSacMember) next.innerHTML = sacDashboardNotice('Your shifts could not load. Please try again.', true);
    upcoming.innerHTML = sacDashboardNotice('Events and meetings could not load. Please try again.', true);
    return;
  }
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const results = await Promise.allSettled([
    showActivities ? supabaseClient.from('sac_events').select('id,title,location,starts_at,ends_at').gt('ends_at', timestamp).order('starts_at', { ascending: true }).limit(3) : Promise.resolve({ data: [], error: null }),
    showActivities ? supabaseClient.from('sac_meetings').select('id,title,location,starts_at,ends_at').gt('ends_at', timestamp).order('starts_at', { ascending: true }).limit(3) : Promise.resolve({ data: [], error: null }),
    isSacMember
      ? supabaseClient.from('sac_slot_signups').select('id,event_id,member_id,slot_start,slot_end,spot_number,cancelled_at,sac_events(id,title,location)')
        .eq('member_id', ownId).is('cancelled_at', null).gt('slot_end', timestamp).order('slot_start', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (request !== sacDashboardState.request || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()
    || currentMemberRecord()?.id !== ownId || Boolean(currentMemberRecord()?.teamKeys?.includes('sac')) !== isSacMember) return;
  const loaded = result => result.status === 'fulfilled' && !result.value.error;
  if (isSacMember) {
    if (!loaded(results[2])) {
      next.innerHTML = sacDashboardNotice('Your shifts could not load. Please try again.', true);
    } else {
      const shifts = sacUpcomingOwnShifts(results[2].value.data || [], ownId, Date.now());
      count.textContent = String(shifts.length);
      const shift = shifts[0];
      if (!shift) {
        next.innerHTML = '<div class="sac-dashboard-notice"><h3>No upcoming shifts</h3><p>Find a time that works for you. Your booking will appear here as soon as it is saved.</p><a class="btn btn-accent btn-sm" href="/sac/signups">Find a shift →</a></div>';
      } else {
        const event = shift.sac_events;
        next.innerHTML = `<div class="sac-dashboard-shift"><div><span class="badge badge-sac">${Date.parse(shift.slot_start) <= Date.now() ? 'On now' : 'Booked'}</span><h3>${escapeHtml(event?.title || 'SAC event')}</h3><p>${escapeHtml(formatBerlinDateTime(shift.slot_start, { weekday: 'long', day: 'numeric', month: 'long' }))}</p><p>${escapeHtml(sacSignupTimeRange({ start: shift.slot_start, end: shift.slot_end }))} Berlin time · Scoreboard spot ${escapeHtml(String(shift.spot_number))}</p>${event?.location ? `<p>${escapeHtml(event.location)}</p>` : ''}</div><a class="btn btn-accent btn-sm" href="${escapeHtml(sacSignupUrl(shift.event_id))}">View your shift →</a></div>`;
      }
    }
  }
  const activities = results.slice(0, 2).flatMap((result, index) => loaded(result)
    ? (result.value.data || []).filter(item => Date.parse(item.ends_at) > Date.now()).map(item => ({ ...item, kind: index === 0 ? 'event' : 'meeting' })) : [])
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, 3);
  const errors = results.slice(0, 2).flatMap((result, index) => loaded(result) ? [] : [index === 0 ? 'Events' : 'Meetings']);
  upcoming.innerHTML = activities.map(item => `<a class="sac-dashboard-activity" href="${escapeHtml(pageUrl(item.kind === 'event' ? 'sac-events' : 'sac-meetings', item.kind === 'event' ? { event: item.id } : { meeting: item.id }))}"><span class="page-kicker">${item.kind === 'event' ? 'Athletic event' : 'Council meeting'}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(formatBerlinDateTime(item.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · Berlin time</p>${item.location ? `<p>${escapeHtml(item.location)}</p>` : ''}<span class="sac-dashboard-activity-link">View ${item.kind} →</span></a>`).join('')
    || (errors.length ? '' : sacDashboardNotice('No upcoming events or meetings yet. Check back soon.'));
  if (errors.length) upcoming.innerHTML += sacDashboardNotice(`${errors.join(' and ')} could not load. Please try again.`, true);
}

document.addEventListener('click', event => {
  if (event.target.closest?.('[data-sac-dashboard-retry]')) renderSacDashboard();
});
