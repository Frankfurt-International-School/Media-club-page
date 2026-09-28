// SAC sign-ups are time-first. Database RPCs own eligibility, capacity, and overlap checks.
const sacSignupsState = { events: [], signups: [], selectedEventId: null, assignedMemberId: null, memberQuery: '', request: 0, myShiftsRequest: 0, mutationInFlight: false };

function resetSacSignupsState() {
  sacSignupsState.request += 1;
  sacSignupsState.myShiftsRequest += 1;
  sacSignupsState.events = [];
  sacSignupsState.signups = [];
  sacSignupsState.selectedEventId = null;
  sacSignupsState.assignedMemberId = null;
  sacSignupsState.memberQuery = '';
  sacSignupsState.mutationInFlight = false;
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
  paintSacSignupActions();
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

function sacSignupAction(slot, occupants, selectedMemberId, spotCount, isAdmin) {
  const ownBooking = occupants.some(booking => booking.member_id === selectedMemberId && selectedMemberId);
  const full = occupants.length >= spotCount;
  const ended = Date.parse(slot.end) <= Date.now();
  if (ownBooking) return '<span class="sac-signup-status">Booked</span>';
  if (full) return '<span class="sac-signup-status">Full</span>';
  if (ended) return '<span class="sac-signup-status">Ended</span>';
  return selectedMemberId
    ? `<button class="btn btn-accent btn-sm" type="button" data-sac-claim-start="${escapeHtml(slot.start)}">${isAdmin ? 'Assign spot' : 'Claim spot'}</button>`
    : '';
}

function paintSacSignupActions() {
  const content = document.getElementById('sac-signups-content');
  const event = sacSignupsState.events.find(item => item.id === sacSignupsState.selectedEventId);
  if (!content || !event) return;
  const slots = generateSacSlots(event);
  const rows = content.querySelectorAll('.sac-signup-slot .sac-signup-action');
  if (rows.length !== slots.length) return;
  const selectedMemberId = selectedSacSignupMemberId();
  const spotCount = Number(event.scoreboard_spots || 2);
  rows.forEach((row, index) => {
    const occupants = sacSignupsState.signups.filter(booking => sacBookingMatchesSlot(booking, slots[index]));
    row.innerHTML = sacSignupAction(slots[index], occupants, selectedMemberId, spotCount, canAddMembers());
    if (content.getAttribute('aria-busy') === 'true') row.querySelector('button')?.setAttribute('disabled', '');
  });
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
  const rows = slots.map(slot => {
    const day = berlinDateKey(slot.start);
    const heading = day !== lastDay ? `<h3 class="sac-signup-day">${escapeHtml(formatBerlinDateTime(slot.start, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>` : '';
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
    return `${heading}<article class="sac-signup-slot"><div class="sac-signup-time"><strong>${escapeHtml(sacSignupTimeRange(slot))}</strong><span>${canClaim ? `${occupants.length}/${escapeHtml(String(event.scoreboard_spots || 2))} filled` : 'Preview'}</span></div><div class="sac-signup-places">${places}</div><div class="sac-signup-action">${action}</div></article>`;
  }).join('');
  const changedSchedule = orphaned.length
    ? `<section class="sac-signup-warning" role="alert"><strong>Event schedule changed — ${orphaned.length} booking${orphaned.length === 1 ? '' : 's'} need review</strong><p>These existing bookings no longer match the current event window. They were kept so members can see and cancel them; choose a new shift after cancelling.</p>${orphaned.map(booking => `<div>${escapeHtml(booking.member_name_snapshot)} · ${escapeHtml(formatBerlinDateTime(booking.slot_start, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} <button class="sac-signup-cancel" type="button" data-sac-cancel-id="${escapeHtml(booking.id)}" ${isAdmin || booking.member_id === ownId ? '' : 'hidden'}>Cancel booking</button></div>`).join('')}</section>`
    : '';
  content.innerHTML = `${intro}${access}${changedSchedule}<div class="sac-signup-grid">${rows}</div>`;
  if (isAdmin) paintSacSignupMemberMatches();
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
      .select('id,member_id,member_name_snapshot,slot_start,slot_end,spot_number')
      .eq('event_id', selected.id).is('cancelled_at', null).order('slot_start', { ascending: true });
    if (request !== sacSignupsState.request) return;
    if (signupError) throw signupError;
    sacSignupsState.signups = signups || [];
    paintSacSignupSheet();
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

async function renderSacMyShifts() {
  const content = document.getElementById('sac-my-shifts-content');
  if (!content || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return false;
  const request = ++sacSignupsState.myShiftsRequest;
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
    content.innerHTML = `<div class="sac-my-shifts-list">${shifts.map(shift => {
      const event = eventById.get(shift.event_id);
      const slot = { start: shift.slot_start, end: shift.slot_end };
      return `<article class="sac-my-shift"><div><span class="page-kicker">${escapeHtml(formatBerlinDateTime(shift.slot_start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span><h2>${escapeHtml(event?.title || 'SAC event')}</h2><p>${escapeHtml(sacSignupTimeRange(slot))} Berlin time · Scoreboard spot ${escapeHtml(String(shift.spot_number))}${event?.location ? ` · ${escapeHtml(event.location)}` : ''}</p><span class="badge badge-sac">Booked</span></div><div class="sac-my-shift-actions"><a class="btn btn-ghost btn-sm" href="${escapeHtml(sacSignupUrl(shift.event_id))}">View sheet</a><button class="btn btn-ghost btn-sm" type="button" data-sac-cancel-id="${escapeHtml(shift.id)}">Cancel shift</button></div></article>`;
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

async function cancelSacSignupSlot(signupId, button) {
  if (!canClaimSacSlot() || sacSignupsState.mutationInFlight) return;
  sacSignupsState.mutationInFlight = true;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Cancelling…';
  try {
    const { error } = await supabaseClient.rpc('cancel_sac_scoreboard_slot', { p_signup_id: signupId });
    if (error) throw error;
    const refreshed = document.querySelector('.page.active')?.id === 'page-sac-my-shifts'
      ? await renderSacMyShifts() : await renderSacSignups(true);
    if (refreshed) showToast('Scoreboard spot cancelled.');
    else showToast('Spot cancelled, but this page could not refresh. Reload to confirm.', 'error', 7000);
  } catch (error) {
    button.disabled = false;
    button.textContent = originalLabel;
    showToast(error?.message || 'Could not cancel this spot.', 'error', 7000);
  } finally {
    sacSignupsState.mutationInFlight = false;
  }
}

document.getElementById('sac-signups-content')?.addEventListener('click', event => {
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
  paintSacSignupActions();
});

document.getElementById('sac-my-shifts-content')?.addEventListener('click', event => {
  const cancel = event.target.closest('[data-sac-cancel-id]');
  if (cancel) cancelSacSignupSlot(cancel.dataset.sacCancelId, cancel);
});
