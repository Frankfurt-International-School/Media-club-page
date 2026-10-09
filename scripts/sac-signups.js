// SAC sign-ups are time-first. Database RPCs own eligibility, capacity, and overlap checks.
const sacSignupsState = { events: [], signups: [], myShifts: [], myShiftEvents: [], selectedEventId: null, assignedMemberId: null, memberQuery: '', request: 0, myShiftsRequest: 0, mutationInFlight: false,
  slotFilter: 'all', memberBookings: [], bookingsMemberId: null, bookingsReady: false, bookingError: false, bookingRequest: 0 };

function resetSacSignupsState() {
  sacSignupsState.request += 1;
  sacSignupsState.myShiftsRequest += 1;
  sacSignupsState.events = [];
  sacSignupsState.signups = [];
  sacSignupsState.myShifts = [];
  sacSignupsState.myShiftEvents = [];
  sacSignupsState.selectedEventId = null;
  sacSignupsState.assignedMemberId = null;
  sacSignupsState.memberQuery = '';
  sacSignupsState.mutationInFlight = false;
  sacSignupsState.bookingRequest += 1;
  sacSignupsState.memberBookings = [];
  sacSignupsState.bookingsMemberId = null;
  sacSignupsState.bookingsReady = false;
  sacSignupsState.bookingError = false;
  sacSignupsState.slotFilter = 'all';
  const select = document.getElementById('sac-signup-event-select');
  const content = document.getElementById('sac-signups-content');
  if (select) select.textContent = '';
  if (content) content.textContent = '';
  const myShifts = document.getElementById('sac-my-shifts-content');
  if (myShifts) myShifts.textContent = '';
}

window.resetSacSignupsState = resetSacSignupsState;

function canClaimSacSlot() {
  return canAddMembers() || Boolean(currentMemberRecord()?.teamKeys?.includes('sac'));
}

function generateSacSlots(event) {
  const start = Date.parse(event?.starts_at);
  const end = Date.parse(event?.ends_at);
  const minutes = Number(event?.slot_interval_minutes || 30);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || !Number.isInteger(minutes) || minutes < 15 || minutes > 120 || minutes % 5 !== 0) return [];
  const duration = minutes * 60000;
  const count = Math.ceil((end - start) / duration);
  if (count > 672) return [];
  return Array.from({ length: count }, (_, index) => ({
    start: new Date(start + index * duration).toISOString(),
    end: new Date(Math.min(start + (index + 1) * duration, end)).toISOString(),
  }));
}

function sacSignupTimeRange(slot) {
  const sameDay = berlinDateKey(slot.start) === berlinDateKey(slot.end);
  const end = sameDay ? berlinTimeLabel(slot.end)
    : formatBerlinDateTime(slot.end, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${berlinTimeLabel(slot.start)}–${end}`;
}

function sacBookingMatchesSlot(booking, slot) {
  const bookingStart = Date.parse(booking.slot_start);
  const bookingEnd = Date.parse(booking.slot_end);
  return Number.isFinite(bookingStart) && Number.isFinite(bookingEnd)
    && bookingStart === Date.parse(slot.start) && bookingEnd === Date.parse(slot.end);
}

function sacSignupMembers() {
  return state.members.filter(member => Array.isArray(member.teamKeys) && member.teamKeys.includes('sac'));
}

function normalizeSacSignupSearch(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function sacSignupMatchingMembers(query) {
  const search = normalizeSacSignupSearch(query);
  if (!search) return [];
  return sacSignupMembers().filter(member =>
    normalizeSacSignupSearch(member.name).includes(search)
      || normalizeSacSignupSearch(member.email).includes(search));
}

function selectedSacSignupMemberId() {
  if (!canAddMembers()) return currentMemberRecord()?.id || '';
  return sacSignupMembers().some(member => member.id === sacSignupsState.assignedMemberId)
    ? sacSignupsState.assignedMemberId : '';
}

function setSacSignupAssignee(memberId) {
  const member = canAddMembers() ? sacSignupMembers().find(item => item.id === memberId) : null;
  if (!member) return;
  sacSignupsState.assignedMemberId = memberId;
  sacSignupsState.memberQuery = member.name;
  const input = document.getElementById('sac-signup-assign-member');
  if (input) { input.value = member.name; input.focus(); }
  paintSacSignupMemberMatches();
  loadSacSignupAvailability();
}

function paintSacSignupMemberMatches() {
  const input = document.getElementById('sac-signup-assign-member');
  const results = document.getElementById('sac-signup-member-matches');
  const status = document.getElementById('sac-signup-member-status');
  if (!input || !results || !status || !canAddMembers()) return;
  const selected = sacSignupMembers().find(member => member.id === selectedSacSignupMemberId());
  const query = input.value.trim();
  const matches = selected ? [] : sacSignupMatchingMembers(query);
  if (selected) {
    status.textContent = `Matched ${selected.name}${selected.email ? ` · ${selected.email}` : ''}. Ready to assign a spot.`;
  } else if (!query) {
    status.textContent = 'Type a current SAC member’s name or FIS email, then choose a match.';
  } else if (!matches.length) {
    status.textContent = 'No current SAC member matches. Check the Members page or try their FIS email.';
  } else {
    status.textContent = `${matches.length} matching SAC member${matches.length === 1 ? '' : 's'}.${matches.length > 6 ? ' Showing six; type more to narrow.' : ' Choose the correct person.'}`;
  }
  results.hidden = !matches.length;
  results.innerHTML = matches.slice(0, 6).map(member => `<button class="sac-signup-member-match" type="button" data-sac-member-id="${escapeHtml(member.id)}"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml([member.gradeLevel, member.email].filter(Boolean).join(' · '))}</small></button>`).join('');
}

function sacSlotAvailability(slot, occupants, memberBookings, memberId, spotCount, now = Date.now()) {
  const booked = Boolean(memberId && occupants.some(item => item.member_id === memberId && !item.cancelled_at));
  const conflict = memberId && memberBookings.find(item => item.member_id === memberId && !item.cancelled_at
    && Date.parse(item.slot_start) < Date.parse(slot.end) && Date.parse(item.slot_end) > Date.parse(slot.start));
  const ended = Date.parse(slot.end) <= now;
  const openSpots = Math.max(0, spotCount - occupants.length);
  return { booked, conflict, ended, openSpots, bookable: Boolean(memberId && !booked && !conflict && !ended && openSpots) };
}

function sacSignupAction(slot, occupants, selectedMemberId, spotCount, isAdmin) {
  const availability = sacSlotAvailability(slot, occupants, sacSignupsState.memberBookings, selectedMemberId, spotCount);
  if (availability.booked) return '<span class="sac-signup-status">Booked</span>';
  if (availability.ended) return '<span class="sac-signup-status">Ended</span>';
  if (!selectedMemberId) return '<span class="sac-signup-status">Choose a member</span>';
  if (!sacSignupsState.bookingsReady || sacSignupsState.bookingsMemberId !== selectedMemberId) {
    return `<span class="sac-signup-status">${sacSignupsState.bookingError ? 'Availability unavailable' : 'Checking availability…'}</span>`;
  }
  if (availability.conflict) return `<span class="sac-signup-conflict">Overlaps another booking</span><a class="sac-signup-conflict-link" href="${escapeHtml(sacSignupUrl(availability.conflict.event_id))}">View that sheet →</a>`;
  if (!availability.openSpots) return '<span class="sac-signup-status">Full</span>';
  return `<button class="btn btn-accent btn-sm" type="button" data-sac-claim-start="${escapeHtml(slot.start)}">${isAdmin ? 'Assign spot' : 'Claim spot'}</button>`;
}

async function loadSacSignupAvailability() {
  const request = ++sacSignupsState.bookingRequest;
  sacSignupsState.memberBookings = [];
  sacSignupsState.bookingsReady = false;
  sacSignupsState.bookingError = false;
  const memberId = selectedSacSignupMemberId();
  sacSignupsState.bookingsMemberId = memberId;
  const event = sacSignupsState.events.find(item => item.id === sacSignupsState.selectedEventId);
  const actorId = window.CREW_CENTER_AUTH_USER?.id;
  const authEpoch = Number(window.CREW_CENTER_AUTH_EPOCH || 0);
  paintSacSignupActions();
  if (!memberId || !event || !actorId || !supabaseClient || currentCrewCenterWorkspace() !== 'sac'
    || !canAccessSacWorkspace() || !canClaimSacSlot()) return;
  const current = () => request === sacSignupsState.bookingRequest && actorId === window.CREW_CENTER_AUTH_USER?.id
    && authEpoch === Number(window.CREW_CENTER_AUTH_EPOCH || 0) && event.id === sacSignupsState.selectedEventId
    && memberId === selectedSacSignupMemberId() && currentCrewCenterWorkspace() === 'sac' && canAccessSacWorkspace() && canClaimSacSlot();
  try {
    const { data, error } = await supabaseClient.from('sac_slot_signups')
      .select('id,event_id,member_id,slot_start,slot_end,cancelled_at')
      .eq('member_id', memberId).is('cancelled_at', null)
      .lt('slot_start', event.ends_at).gt('slot_end', event.starts_at).order('slot_start');
    if (!current()) return;
    if (error) throw error;
    sacSignupsState.memberBookings = (data || []).filter(item => item.member_id === memberId && !item.cancelled_at);
    sacSignupsState.bookingsReady = true;
  } catch (_error) {
    if (!current()) return;
    sacSignupsState.bookingError = true;
  }
  if (current()) paintSacSignupActions();
}

function paintSacPlannerControls(slots, availability) {
  const content = document.getElementById('sac-signups-content');
  const summary = document.getElementById('sac-planner-summary');
  const status = document.getElementById('sac-planner-status');
  if (!content || !summary || !status) return;
  const selected = selectedSacSignupMemberId();
  const ready = sacSignupsState.bookingsReady && sacSignupsState.bookingsMemberId === selected;
  const booked = availability.filter(item => item.booked).length;
  const minutes = slots.reduce((sum, slot, index) => sum + (availability[index].booked ? (Date.parse(slot.end) - Date.parse(slot.start)) / 60000 : 0), 0);
  summary.innerHTML = [[ready ? availability.filter(item => item.bookable).length : '—', canAddMembers() ? 'Times member can book' : 'Times you can book'],
    [selected ? booked : '—', 'Booked here'], [selected ? minutes : '—', 'Minutes booked']]
    .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  const visible = availability.map(item => sacSignupsState.slotFilter === 'all'
    || sacSignupsState.slotFilter === 'booked' && item.booked || sacSignupsState.slotFilter === 'available' && ready && item.bookable);
  content.querySelectorAll('[data-sac-slot-index]').forEach(row => {
    const index = Number(row.dataset.sacSlotIndex);
    row.hidden = !visible[index];
    row.classList.toggle('is-booked', availability[index].booked);
    row.classList.toggle('is-conflicting', ready && Boolean(availability[index].conflict) && !availability[index].booked);
  });
  content.querySelectorAll('[data-sac-day]').forEach(heading => {
    heading.hidden = !slots.some((slot, index) => berlinDateKey(slot.start) === heading.dataset.sacDay && visible[index]);
  });
  content.querySelectorAll('[data-sac-slot-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sacSlotFilter === sacSignupsState.slotFilter)));
  status.textContent = !selected ? 'Choose a matched SAC member to check their availability.'
    : sacSignupsState.bookingError ? 'Availability could not be checked. Retry before booking.'
    : !ready ? 'Checking other SAC bookings for overlaps…'
    : `${visible.filter(Boolean).length} of ${slots.length} times shown. Adjacent shifts are allowed; overlapping shifts are not.`;
  const empty = document.getElementById('sac-planner-empty');
  if (empty) { empty.hidden = visible.some(Boolean); empty.textContent = sacSignupsState.slotFilter === 'booked'
    ? 'No bookings in this event for the selected member.' : ready ? 'No bookable times in this event. Try another event or show all times.' : 'Bookable times will appear once availability is checked.'; }
  const retry = document.getElementById('sac-planner-retry');
  if (retry) retry.hidden = !sacSignupsState.bookingError;
}

function paintSacSignupActions() {
  const content = document.getElementById('sac-signups-content');
  if (currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  if (!canClaimSacSlot()) { paintSacSignupSheet(); return; }
  const event = sacSignupsState.events.find(item => item.id === sacSignupsState.selectedEventId);
  if (!content || !event) return;
  const slots = generateSacSlots(event);
  const rows = content.querySelectorAll('.sac-signup-slot .sac-signup-action');
  if (rows.length !== slots.length) return;
  const selectedMemberId = selectedSacSignupMemberId();
  const spotCount = Number(event.scoreboard_spots || 2);
  const availability = slots.map(slot => sacSlotAvailability(slot, sacSignupsState.signups.filter(booking => sacBookingMatchesSlot(booking, slot)), sacSignupsState.memberBookings, selectedMemberId, spotCount));
  rows.forEach((row, index) => {
    const occupants = sacSignupsState.signups.filter(booking => sacBookingMatchesSlot(booking, slots[index]));
    row.innerHTML = sacSignupAction(slots[index], occupants, selectedMemberId, spotCount, canAddMembers());
    if (content.getAttribute('aria-busy') === 'true') row.querySelector('button')?.setAttribute('disabled', '');
  });
  paintSacPlannerControls(slots, availability);
}

function paintSacSignupSheet() {
  const content = document.getElementById('sac-signups-content');
  if (!content) return;
  const event = sacSignupsState.events.find(item => item.id === sacSignupsState.selectedEventId);
  if (!event) {
    content.innerHTML = '<div class="empty-state" role="status"><p>No SAC event is available yet. Check Events again soon.</p></div>';
    return;
  }
  const slots = generateSacSlots(event);
  if (!slots.length) {
    content.innerHTML = '<div class="empty-state" role="alert"><p>This event has no valid time slots. Ask an SAC event creator to check its schedule.</p></div>';
    return;
  }
  const canClaim = canClaimSacSlot();
  const isAdmin = canAddMembers();
  const ownId = currentMemberRecord()?.id;
  const selectedMemberId = selectedSacSignupMemberId();
  const bookings = sacSignupsState.signups;
  const orphaned = canClaim ? bookings.filter(booking => !slots.some(slot => sacBookingMatchesSlot(booking, slot))) : [];
  const members = sacSignupMembers();
  const selectedMember = members.find(member => member.id === selectedMemberId);
  const memberSelect = isAdmin
    ? `<div class="sac-signup-assign"><label class="form-label" for="sac-signup-assign-member">Assign an SAC member</label><div class="sac-signup-search"><input class="form-input" id="sac-signup-assign-member" type="search" autocomplete="off" value="${escapeHtml(selectedMember?.name || sacSignupsState.memberQuery)}" placeholder="Type a member name or FIS email" aria-controls="sac-signup-member-matches" aria-describedby="sac-signup-member-status"><div class="sac-signup-member-matches" id="sac-signup-member-matches" role="group" aria-label="Matching SAC members" hidden></div></div><small id="sac-signup-member-status" role="status" aria-live="polite"></small><small>Auth Admin can assign any current SAC member. Other SAC members can sign up only themselves.</small></div>`
    : '';
  const intro = `<div class="sac-signup-intro"><div><span class="page-kicker">${escapeHtml(formatBerlinDateTime(event.starts_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(sacEventTimeLabel(event))} Berlin time${event.location ? ` · ${escapeHtml(event.location)}` : ''}</p></div><span class="sac-signup-role">Scoreboard · ${escapeHtml(String(event.scoreboard_spots || 2))} spots / shift</span></div>`;
  const access = canClaim
    ? `<div class="sac-signup-access">${isAdmin ? 'Type a current SAC member’s name and choose their match before assigning a slot.' : 'Claiming a spot books it immediately. Your name appears on the sheet and in <a href="/sac/my-shifts">My shifts</a>; there is no pending approval. You may claim non-overlapping shifts and cancel your own bookings.'}</div>${memberSelect}`
    : `<div class="sac-signup-locked"><strong>Preview only — SAC membership required</strong><p>Only current SAC-tagged members can claim Scoreboard shifts. If you already belong to SAC, apply using your FIS email and request the SAC option so an Auth Admin can verify your membership.</p><a class="btn btn-accent btn-sm" href="https://info.fismediaclub.org/#join">Request SAC access</a></div>`;
  let lastDay = '';
  const rows = slots.map((slot, index) => {
    const day = berlinDateKey(slot.start);
    const heading = day !== lastDay ? `<h3 class="sac-signup-day" data-sac-day="${escapeHtml(day)}">${escapeHtml(formatBerlinDateTime(slot.start, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>` : '';
    lastDay = day;
    const occupants = canClaim ? bookings.filter(booking => sacBookingMatchesSlot(booking, slot)) : [];
    const places = canClaim
      ? Array.from({ length: Number(event.scoreboard_spots || 2) }, (_, index) => {
          const booking = occupants.find(item => Number(item.spot_number) === index + 1);
          const cancel = booking && (isAdmin || booking.member_id === ownId)
            ? `<button class="sac-signup-cancel" type="button" data-sac-cancel-id="${escapeHtml(booking.id)}" aria-label="Cancel ${escapeHtml(booking.member_name_snapshot)}'s ${escapeHtml(sacSignupTimeRange(slot))} booking">Cancel</button>` : '';
          return `<span class="sac-signup-place ${booking ? 'filled' : ''}">${booking ? escapeHtml(booking.member_name_snapshot) : `Spot ${index + 1} open`}${cancel}</span>`;
        }).join('')
      : '<span class="sac-signup-place preview">Member details hidden</span>';
    const action = canClaim ? sacSignupAction(slot, occupants, selectedMemberId, Number(event.scoreboard_spots || 2), isAdmin) : '';
    return `${heading}<article class="sac-signup-slot" data-sac-slot-index="${index}"><div class="sac-signup-time"><strong>${escapeHtml(sacSignupTimeRange(slot))}</strong><span>${canClaim ? `${occupants.length}/${escapeHtml(String(event.scoreboard_spots || 2))} filled` : 'Preview'}</span></div><div class="sac-signup-places">${places}</div><div class="sac-signup-action">${action}</div></article>`;
  }).join('');
  const changedSchedule = orphaned.length
    ? `<section class="sac-signup-warning" role="alert"><strong>Event schedule changed — ${orphaned.length} booking${orphaned.length === 1 ? '' : 's'} need review</strong><p>These existing bookings no longer match the current event window. They were kept so members can see and cancel them; choose a new shift after cancelling.</p>${orphaned.map(booking => `<div>${escapeHtml(booking.member_name_snapshot)} · ${escapeHtml(formatBerlinDateTime(booking.slot_start, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} <button class="sac-signup-cancel" type="button" data-sac-cancel-id="${escapeHtml(booking.id)}" ${isAdmin || booking.member_id === ownId ? '' : 'hidden'}>Cancel booking</button></div>`).join('')}</section>`
    : '';
  const planner = canClaim ? `<section class="sac-planner" aria-label="Shift planner"><div class="sac-planner-summary" id="sac-planner-summary"></div><div class="sac-planner-controls"><div class="sac-planner-filters" role="group" aria-label="Filter shift times">${[['all','All times'],['available','Bookable'],['booked',isAdmin ? 'Member bookings' : 'My bookings']].map(([value,label]) => `<button class="btn btn-ghost btn-sm" type="button" data-sac-slot-filter="${value}" aria-pressed="${sacSignupsState.slotFilter === value}">${label}</button>`).join('')}</div><button class="btn btn-ghost btn-sm" id="sac-planner-retry" type="button" data-sac-availability-retry hidden>Retry availability</button></div><p id="sac-planner-status" role="status"></p></section>` : '';
  content.innerHTML = `${intro}${access}${changedSchedule}${planner}<div class="sac-signup-grid">${rows}</div>${canClaim ? '<div class="empty-state" id="sac-planner-empty" role="status" hidden></div>' : ''}`;
  if (isAdmin) paintSacSignupMemberMatches();
  if (canClaim) paintSacSignupActions();
}

async function renderSacSignups(preserveContent = false) {
  const select = document.getElementById('sac-signup-event-select');
  const content = document.getElementById('sac-signups-content');
  if (!select || !content || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  const request = ++sacSignupsState.request;
  if (preserveContent) {
    content.setAttribute('aria-busy', 'true');
    content.querySelectorAll('button[data-sac-claim-start], button[data-sac-cancel-id]').forEach(button => { button.disabled = true; });
  } else {
    content.innerHTML = '<div class="empty-state" role="status"><p>Loading SAC sign-up sheets…</p></div>';
  }
  if (!supabaseClient) {
    content.innerHTML = '<div class="empty-state" role="alert"><p>Sign-up sheets cannot load until Supabase is configured.</p></div>';
    content.removeAttribute('aria-busy');
    return;
  }
  try {
    const { data: events, error: eventError } = await supabaseClient.from('sac_events')
      .select('id,title,location,starts_at,ends_at,slot_interval_minutes,scoreboard_spots')
      .order('starts_at', { ascending: true });
    if (request !== sacSignupsState.request) return;
    if (eventError) throw eventError;
    sacSignupsState.events = events || [];
    const requested = new URLSearchParams(window.location.search).get('event') || sacSignupsState.selectedEventId;
    const upcoming = sacSignupsState.events.find(item => Date.parse(item.ends_at) > Date.now());
    const selected = sacSignupsState.events.find(item => item.id === requested) || upcoming || sacSignupsState.events.at(-1);
    sacSignupsState.selectedEventId = selected?.id || null;
    select.innerHTML = sacSignupsState.events.length
      ? sacSignupsState.events.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(formatBerlinDateTime(item.starts_at, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${escapeHtml(item.title)}</option>`).join('')
      : '<option value="">No SAC events yet</option>';
    select.value = selected?.id || '';
    select.disabled = !selected;
    if (!selected || !canClaimSacSlot()) {
      sacSignupsState.signups = [];
      paintSacSignupSheet();
      return true;
    }
    const { data: signups, error: signupError } = await supabaseClient.from('sac_slot_signups')
      .select('id,event_id,member_id,member_name_snapshot,slot_start,slot_end,spot_number')
      .eq('event_id', selected.id).is('cancelled_at', null).order('slot_start', { ascending: true });
    if (request !== sacSignupsState.request) return;
    if (signupError) throw signupError;
    sacSignupsState.signups = signups || [];
    sacSignupsState.bookingsReady = false;
    paintSacSignupSheet();
    await loadSacSignupAvailability();
    return true;
  } catch (error) {
    if (request !== sacSignupsState.request) return;
    if (!preserveContent) content.innerHTML = '<div class="empty-state" role="alert"><p>SAC sign-up sheets are unavailable. The new database schema and permissions may need to be applied.</p></div>';
    showToast(error?.message || 'Could not load SAC sign-up sheets.', 'error', 7000);
    return false;
  } finally {
    if (request === sacSignupsState.request) {
      content.removeAttribute('aria-busy');
      content.querySelectorAll('button[data-sac-claim-start], button[data-sac-cancel-id]').forEach(button => { button.disabled = false; });
    }
  }
}

function sacUpcomingOwnShifts(signups, memberId, now = Date.now()) {
  return signups.filter(signup => signup.member_id === memberId && !signup.cancelled_at && Date.parse(signup.slot_end) > now)
    .sort((a, b) => Date.parse(a.slot_start) - Date.parse(b.slot_start));
}

function escapeSacCalendarText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function foldSacCalendarLine(value) {
  const encoder = new TextEncoder();
  const lines = [];
  let line = '';
  for (const character of value) {
    if (encoder.encode(line + character).length > 75) {
      lines.push(line);
      line = ' ';
    }
    line += character;
  }
  lines.push(line);
  return lines.join('\r\n');
}

function buildSacShiftCalendar(shift, event, signupUrl, now = Date.now()) {
  const start = Date.parse(shift?.slot_start);
  const end = Date.parse(shift?.slot_end);
  if (!shift?.id || shift.cancelled_at || !event?.id || event.id !== shift.event_id
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= now
    || !Number.isFinite(now)) return '';
  const timestamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const description = `Your SAC Scoreboard shift, spot ${shift.spot_number}.\nCheck the sign-up sheet for the latest details. If your booking changes or is cancelled, update or remove this entry in your calendar.`;
  // UTC preserves the booked instant across Berlin daylight-saving changes.
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FIS SAC//Scoreboard Shifts//EN',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:sac-scoreboard-${encodeURIComponent(shift.id)}@sac.fismediaclub.org`,
    `DTSTAMP:${timestamp(now)}`, `DTSTART:${timestamp(start)}`, `DTEND:${timestamp(end)}`,
    'STATUS:CONFIRMED', 'CLASS:PRIVATE',
    `SUMMARY:${escapeSacCalendarText(`SAC Scoreboard shift — ${event.title || 'SAC event'}`)}`,
    `DESCRIPTION:${escapeSacCalendarText(description)}`,
    `LOCATION:${escapeSacCalendarText(event.location || 'Location to be confirmed')}`,
    `URL:${signupUrl}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldSacCalendarLine).join('\r\n');
}

function downloadSacShiftCalendar(signupId) {
  if (currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace() || !canClaimSacSlot()) return;
  const ownId = currentMemberRecord()?.id;
  const shift = sacUpcomingOwnShifts(sacSignupsState.myShifts, ownId).find(item => item.id === signupId);
  const event = sacSignupsState.myShiftEvents.find(item => item.id === shift?.event_id);
  const signupUrl = shift ? new URL(sacSignupUrl(shift.event_id), window.location.origin).href : '';
  const calendar = buildSacShiftCalendar(shift, event, signupUrl);
  if (!calendar) { showToast('This shift is unavailable. Refresh My shifts before adding it to your calendar.', 'error'); return; }
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `sac-scoreboard-${new Date(shift.slot_start).toISOString().slice(0, 10)}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Calendar file downloaded. Open it in your calendar app.');
}

async function renderSacMyShifts() {
  const content = document.getElementById('sac-my-shifts-content');
  if (!content || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return false;
  const request = ++sacSignupsState.myShiftsRequest;
  sacSignupsState.myShifts = [];
  sacSignupsState.myShiftEvents = [];
  const ownId = currentMemberRecord()?.id;
  if (!canClaimSacSlot()) {
    content.innerHTML = '<div class="sac-signup-locked"><strong>SAC membership required</strong><p>Current SAC members can book Scoreboard shifts. Eligible Crew Center members can preview the <a href="/sac/signups">sign-up sheet</a> and <a href="https://info.fismediaclub.org/#join">request SAC access</a>.</p></div>';
    return true;
  }
  if (!ownId) {
    content.innerHTML = '<div class="empty-state" role="status"><p>No SAC member record is linked to this account.</p></div>';
    return true;
  }
  if (!supabaseClient) {
    content.innerHTML = '<div class="empty-state" role="alert"><p>My shifts cannot load until Supabase is configured.</p></div>';
    return false;
  }
  content.innerHTML = '<div class="empty-state" role="status"><p>Loading your SAC shifts…</p></div>';
  try {
    const { data, error } = await supabaseClient.from('sac_slot_signups')
      .select('id,event_id,member_id,slot_start,slot_end,spot_number,cancelled_at')
      .eq('member_id', ownId).is('cancelled_at', null)
      .gt('slot_end', new Date().toISOString()).order('slot_start', { ascending: true });
    if (request !== sacSignupsState.myShiftsRequest) return false;
    if (error) throw error;
    const shifts = sacUpcomingOwnShifts(data || [], ownId);
    if (!shifts.length) {
      content.innerHTML = '<div class="empty-state" role="status"><p>You have no upcoming SAC shifts yet.</p><a class="btn btn-accent btn-sm" href="/sac/signups">Find a Scoreboard shift</a></div>';
      return true;
    }
    const ids = [...new Set(shifts.map(shift => shift.event_id))];
    const { data: events, error: eventError } = await supabaseClient.from('sac_events')
      .select('id,title,location').in('id', ids);
    if (request !== sacSignupsState.myShiftsRequest) return false;
    if (eventError) throw eventError;
    const eventById = new Map((events || []).map(event => [event.id, event]));
    sacSignupsState.myShifts = shifts;
    sacSignupsState.myShiftEvents = events || [];
    content.innerHTML = `<p class="sac-calendar-note">Add a shift to your calendar with a downloaded calendar file. If you change or cancel a booking, update or remove the calendar entry too.</p><div class="sac-my-shifts-list">${shifts.map(shift => {
      const event = eventById.get(shift.event_id);
      const slot = { start: shift.slot_start, end: shift.slot_end };
      return `<article class="sac-my-shift"><div><span class="page-kicker">${escapeHtml(formatBerlinDateTime(shift.slot_start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span><h2>${escapeHtml(event?.title || 'SAC event')}</h2><p>${escapeHtml(sacSignupTimeRange(slot))} Berlin time · Scoreboard spot ${escapeHtml(String(shift.spot_number))}${event?.location ? ` · ${escapeHtml(event.location)}` : ''}</p><span class="badge badge-sac">Booked</span></div><div class="sac-my-shift-actions">${event ? `<button class="btn btn-ghost btn-sm" type="button" data-sac-calendar-id="${escapeHtml(shift.id)}" aria-label="Add your ${escapeHtml(event.title || 'SAC event')} shift to calendar">Add to calendar</button>` : ''}<a class="btn btn-ghost btn-sm" href="${escapeHtml(sacSignupUrl(shift.event_id))}">View sheet</a><button class="btn btn-ghost btn-sm" type="button" data-sac-cancel-id="${escapeHtml(shift.id)}">Cancel shift</button></div></article>`;
    }).join('')}</div>`;
    return true;
  } catch (error) {
    if (request !== sacSignupsState.myShiftsRequest) return false;
    content.innerHTML = '<div class="empty-state" role="alert"><p>Your SAC shifts are unavailable. Try refreshing this page.</p></div>';
    showToast(error?.message || 'Could not load your SAC shifts.', 'error', 7000);
    return false;
  }
}

function selectSacSignupEvent(eventId) {
  if (!sacSignupsState.events.some(item => item.id === eventId)) return;
  sacSignupsState.selectedEventId = eventId;
  history.pushState({ page: 'sac-signups' }, '', pageUrl('sac-signups', { event: eventId }));
  renderSacSignups();
}

async function claimSacSignupSlot(slotStart, button) {
  if (!canClaimSacSlot() || !sacSignupsState.selectedEventId || sacSignupsState.mutationInFlight) return;
  const memberId = selectedSacSignupMemberId();
  if (!memberId) { showToast('Choose a current SAC member first.', 'error'); return; }
  const event = sacSignupsState.events.find(item => item.id === sacSignupsState.selectedEventId);
  const slot = generateSacSlots(event).find(item => Date.parse(item.start) === Date.parse(slotStart));
  const occupants = slot ? sacSignupsState.signups.filter(item => sacBookingMatchesSlot(item, slot)) : [];
  if (!slot || !sacSignupsState.bookingsReady || sacSignupsState.bookingsMemberId !== memberId
    || !sacSlotAvailability(slot, occupants, sacSignupsState.memberBookings, memberId, Number(event.scoreboard_spots || 2)).bookable) {
    showToast('This time is not bookable. Check the planner or retry availability.', 'error'); return;
  }
  sacSignupsState.mutationInFlight = true;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const { error } = await supabaseClient.rpc('claim_sac_scoreboard_slot', {
      p_event_id: sacSignupsState.selectedEventId,
      p_slot_start: slotStart,
      p_member_id: canAddMembers() ? memberId : null,
    });
    if (error) throw error;
    if (await renderSacSignups(true)) {
      const member = canAddMembers() ? sacSignupMembers().find(item => item.id === memberId) : null;
      showToast(member ? `Booked for ${member.name} — they are on the sheet.` : 'Booked — your name is on the sheet.');
    }
    else showToast('Spot saved, but the sheet could not refresh. Reload to confirm.', 'error', 7000);
  } catch (error) {
    button.disabled = false;
    button.textContent = originalLabel;
    showToast(error?.message || 'Could not claim this spot.', 'error', 7000);
  } finally {
    sacSignupsState.mutationInFlight = false;
  }
}

function sacCancellableBooking(signupId) {
  if (currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace() || !canClaimSacSlot()
    || !window.CREW_CENTER_AUTH_USER?.id || !supabaseClient) return null;
  const collections = document.querySelector('.page.active')?.id === 'page-sac-my-shifts'
    ? [sacSignupsState.myShifts, sacSignupsState.signups] : [sacSignupsState.signups, sacSignupsState.myShifts];
  const booking = collections.flat().find(item => item.id === signupId);
  return booking && !booking.cancelled_at && (canAddMembers() || booking.member_id === currentMemberRecord()?.id)
    ? booking : null;
}

function cancelSacSignupSlot(signupId, button) {
  const booking = sacCancellableBooking(signupId);
  if (!booking || sacSignupsState.mutationInFlight) return;
  const snapshot = { ...booking };
  const actorId = window.CREW_CENTER_AUTH_USER.id;
  const authEpoch = Number(window.CREW_CENTER_AUTH_EPOCH || 0);
  const event = [...sacSignupsState.events, ...sacSignupsState.myShiftEvents].find(item => item.id === booking.event_id);
  const ownBooking = booking.member_id === currentMemberRecord()?.id;
  const memberName = booking.member_name_snapshot || state.members.find(item => item.id === booking.member_id)?.name || 'this member';
  openActionConfirmation({
    kind: 'cancel-sac-shift',
    title: ownBooking ? 'Cancel your Scoreboard shift?' : `Cancel the Scoreboard shift for ${memberName}?`,
    copy: `${ownBooking ? 'Your' : 'Their'} spot will become available for another SAC member. If this shift was added to a calendar, remove that calendar entry too.`,
    impact: [event?.title || 'SAC event',
      formatBerlinDateTime(booking.slot_start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      `${sacSignupTimeRange({ start: booking.slot_start, end: booking.slot_end })} Berlin time · Scoreboard spot ${booking.spot_number}`],
    danger: true, cancelLabel: 'Keep shift', confirmLabel: 'Cancel shift', busyLabel: 'Cancelling…',
    execute: () => performSacSignupCancellation(snapshot, button, actorId, authEpoch),
  });
}

async function performSacSignupCancellation(snapshot, button, actorId, authEpoch) {
  const sameAccount = () => window.CREW_CENTER_AUTH_USER?.id === actorId
    && Number(window.CREW_CENTER_AUTH_EPOCH || 0) === authEpoch;
  const booking = sacCancellableBooking(snapshot.id);
  if (!sameAccount() || !booking || booking.member_id !== snapshot.member_id || booking.event_id !== snapshot.event_id
    || booking.spot_number !== snapshot.spot_number || !sacBookingMatchesSlot(booking, { start: snapshot.slot_start, end: snapshot.slot_end })) {
    showToast('This booking or your access has changed. Close this dialog and refresh before trying again.', 'error', 7000);
    return false;
  }
  if (sacSignupsState.mutationInFlight) return false;
  sacSignupsState.mutationInFlight = true;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Cancelling…';
  let cancelled = false;
  try {
    const { data, error } = await supabaseClient.rpc('cancel_sac_scoreboard_slot', { p_signup_id: snapshot.id });
    if (error) throw error;
    if (typeof data !== 'boolean') throw new Error('Could not confirm the cancellation. Refresh before trying again.');
    cancelled = true;
    if (!sameAccount()) return true;
    // Prevent a second cancellation from stale content if the refresh fails.
    [...sacSignupsState.signups, ...sacSignupsState.myShifts].filter(item => item.id === snapshot.id)
      .forEach(item => { item.cancelled_at = new Date().toISOString(); });
    const refreshed = document.querySelector('.page.active')?.id === 'page-sac-my-shifts'
      ? await renderSacMyShifts() : await renderSacSignups(true);
    if (!sameAccount()) return true;
    if (refreshed) showToast(data ? 'Scoreboard spot cancelled.' : 'This Scoreboard spot was already cancelled.');
    else showToast('Spot cancelled, but this page could not refresh. Reload to confirm.', 'error', 7000);
    return true;
  } catch (error) {
    if (sameAccount()) {
      showToast(cancelled ? 'Spot cancelled, but this page could not refresh. Reload to confirm.'
        : error?.message || 'Could not cancel this spot.', 'error', 7000);
    }
    return cancelled;
  } finally {
    if (sameAccount()) {
      sacSignupsState.mutationInFlight = false;
      button.disabled = cancelled;
      button.textContent = cancelled ? 'Cancelled' : originalLabel;
    }
  }
}

document.getElementById('sac-signups-content')?.addEventListener('click', event => {
  const filter = event.target.closest('[data-sac-slot-filter]');
  if (filter && ['all', 'available', 'booked'].includes(filter.dataset.sacSlotFilter)) {
    sacSignupsState.slotFilter = filter.dataset.sacSlotFilter; paintSacSignupActions(); return;
  }
  if (event.target.closest('[data-sac-availability-retry]')) { loadSacSignupAvailability(); return; }
  const member = event.target.closest('[data-sac-member-id]');
  if (member) { setSacSignupAssignee(member.dataset.sacMemberId); return; }
  const claim = event.target.closest('[data-sac-claim-start]');
  if (claim) { claimSacSignupSlot(claim.dataset.sacClaimStart, claim); return; }
  const cancel = event.target.closest('[data-sac-cancel-id]');
  if (cancel) cancelSacSignupSlot(cancel.dataset.sacCancelId, cancel);
});

document.getElementById('sac-signups-content')?.addEventListener('input', event => {
  if (event.target.id !== 'sac-signup-assign-member' || !canAddMembers()) return;
  sacSignupsState.memberQuery = event.target.value;
  sacSignupsState.assignedMemberId = null;
  paintSacSignupMemberMatches();
  loadSacSignupAvailability();
});

document.getElementById('sac-my-shifts-content')?.addEventListener('click', event => {
  const calendar = event.target.closest('[data-sac-calendar-id]');
  if (calendar) { downloadSacShiftCalendar(calendar.dataset.sacCalendarId); return; }
  const cancel = event.target.closest('[data-sac-cancel-id]');
  if (cancel) cancelSacSignupSlot(cancel.dataset.sacCancelId, cancel);
});
