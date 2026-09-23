// SAC sign-ups are time-first. Database RPCs own eligibility, capacity, and overlap checks.
const sacSignupsState = { events: [], signups: [], selectedEventId: null, assignedMemberId: null, request: 0 };

function resetSacSignupsState() {
  sacSignupsState.request += 1;
  sacSignupsState.events = [];
  sacSignupsState.signups = [];
  sacSignupsState.selectedEventId = null;
  sacSignupsState.assignedMemberId = null;
  const select = document.getElementById('sac-signup-event-select');
  const content = document.getElementById('sac-signups-content');
  if (select) select.textContent = '';
  if (content) content.textContent = '';
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

function sacSignupMembers() {
  return state.members.filter(member => Array.isArray(member.teamKeys) && member.teamKeys.includes('sac'));
}

function selectedSacSignupMemberId() {
  return canAddMembers()
    ? sacSignupsState.assignedMemberId || sacSignupMembers()[0]?.id || ''
    : currentMemberRecord()?.id || '';
}

function setSacSignupAssignee(memberId) {
  if (!canAddMembers() || !sacSignupMembers().some(member => member.id === memberId)) return;
  sacSignupsState.assignedMemberId = memberId;
  paintSacSignupSheet();
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
  const selectedMemberId = selectedSacSignupMemberId() || (isAdmin ? (sacSignupMembers()[0]?.id || '') : ownId);
  const bookings = sacSignupsState.signups;
  const slotKeys = new Set(slots.map(slot => `${slot.start}|${slot.end}`));
  const orphaned = canClaim ? bookings.filter(booking => !slotKeys.has(`${booking.slot_start}|${booking.slot_end}`)) : [];
  const members = sacSignupMembers();
  const memberSelect = isAdmin
    ? `<div class="sac-signup-assign"><label class="form-label" for="sac-signup-assign-member">Assign an SAC member</label><select class="form-select" id="sac-signup-assign-member" onchange="setSacSignupAssignee(this.value)">${members.map(member => `<option value="${escapeHtml(member.id)}" ${member.id === selectedMemberId ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}</select><small>Auth Admin can assign any current SAC member. Other SAC members can sign up only themselves.</small></div>`
    : '';
  const intro = `<div class="sac-signup-intro"><div><span class="page-kicker">${escapeHtml(formatBerlinDateTime(event.starts_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(sacEventTimeLabel(event))} Berlin time${event.location ? ` · ${escapeHtml(event.location)}` : ''}</p></div><span class="sac-signup-role">Scoreboard · ${escapeHtml(String(event.scoreboard_spots || 2))} spots / shift</span></div>`;
  const access = canClaim
    ? `<div class="sac-signup-access">${isAdmin ? 'Choose a current SAC member, then assign a time slot.' : 'You may claim more than one shift as long as the times do not overlap. You can cancel your own shifts.'}</div>${memberSelect}`
    : `<div class="sac-signup-locked"><strong>Preview only — SAC membership required</strong><p>Only current SAC-tagged members can claim Scoreboard shifts. If you already belong to SAC, apply using your FIS email and request the SAC option so an Auth Admin can verify your membership.</p><a class="btn btn-accent btn-sm" href="https://info.fismediaclub.org/#join">Request SAC access</a></div>`;
  let lastDay = '';
  const rows = slots.map(slot => {
    const day = berlinDateKey(slot.start);
    const heading = day !== lastDay ? `<h3 class="sac-signup-day">${escapeHtml(formatBerlinDateTime(slot.start, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>` : '';
    lastDay = day;
    const occupants = canClaim ? bookings.filter(booking => booking.slot_start === slot.start && booking.slot_end === slot.end) : [];
    const ownBooking = occupants.find(booking => booking.member_id === selectedMemberId);
    const full = occupants.length >= Number(event.scoreboard_spots || 2);
    const ended = Date.parse(slot.end) <= Date.now();
    const places = canClaim
      ? Array.from({ length: Number(event.scoreboard_spots || 2) }, (_, index) => {
          const booking = occupants.find(item => Number(item.spot_number) === index + 1);
          const cancel = booking && (isAdmin || booking.member_id === ownId)
            ? `<button class="sac-signup-cancel" type="button" data-sac-cancel-id="${escapeHtml(booking.id)}" aria-label="Cancel ${escapeHtml(booking.member_name_snapshot)}'s ${escapeHtml(sacSignupTimeRange(slot))} booking">Cancel</button>` : '';
          return `<span class="sac-signup-place ${booking ? 'filled' : ''}">${booking ? escapeHtml(booking.member_name_snapshot) : `Spot ${index + 1} open`}${cancel}</span>`;
        }).join('')
      : '<span class="sac-signup-place preview">Member details hidden</span>';
    const action = canClaim && !ended && !ownBooking && !full && selectedMemberId
      ? `<button class="btn btn-accent btn-sm" type="button" data-sac-claim-start="${escapeHtml(slot.start)}">${isAdmin ? 'Assign spot' : 'Claim spot'}</button>`
      : canClaim && ownBooking ? '<span class="sac-signup-status">Booked</span>'
        : canClaim && full ? '<span class="sac-signup-status">Full</span>'
          : canClaim && ended ? '<span class="sac-signup-status">Ended</span>' : '';
    return `${heading}<article class="sac-signup-slot"><div class="sac-signup-time"><strong>${escapeHtml(sacSignupTimeRange(slot))}</strong><span>${canClaim ? `${occupants.length}/${escapeHtml(String(event.scoreboard_spots || 2))} filled` : 'Preview'}</span></div><div class="sac-signup-places">${places}</div><div class="sac-signup-action">${action}</div></article>`;
  }).join('');
  const changedSchedule = orphaned.length
    ? `<section class="sac-signup-warning" role="alert"><strong>Event schedule changed — ${orphaned.length} booking${orphaned.length === 1 ? '' : 's'} need review</strong><p>These existing bookings no longer match the current event window. They were kept so members can see and cancel them; choose a new shift after cancelling.</p>${orphaned.map(booking => `<div>${escapeHtml(booking.member_name_snapshot)} · ${escapeHtml(formatBerlinDateTime(booking.slot_start, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} <button class="sac-signup-cancel" type="button" data-sac-cancel-id="${escapeHtml(booking.id)}" ${isAdmin || booking.member_id === ownId ? '' : 'hidden'}>Cancel booking</button></div>`).join('')}</section>`
    : '';
  content.innerHTML = `${intro}${access}${changedSchedule}<div class="sac-signup-grid">${rows}</div>`;
}

async function renderSacSignups() {
  const select = document.getElementById('sac-signup-event-select');
  const content = document.getElementById('sac-signups-content');
  if (!select || !content || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  const request = ++sacSignupsState.request;
  content.innerHTML = '<div class="empty-state" role="status"><p>Loading SAC sign-up sheets…</p></div>';
  if (!supabaseClient) {
    content.innerHTML = '<div class="empty-state" role="alert"><p>Sign-up sheets cannot load until Supabase is configured.</p></div>';
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
      return;
    }
    const { data: signups, error: signupError } = await supabaseClient.from('sac_slot_signups')
      .select('id,member_id,member_name_snapshot,slot_start,slot_end,spot_number')
      .eq('event_id', selected.id).is('cancelled_at', null).order('slot_start', { ascending: true });
    if (request !== sacSignupsState.request) return;
    if (signupError) throw signupError;
    sacSignupsState.signups = signups || [];
    paintSacSignupSheet();
  } catch (error) {
    if (request !== sacSignupsState.request) return;
    content.innerHTML = '<div class="empty-state" role="alert"><p>SAC sign-up sheets are unavailable. The new database schema and permissions may need to be applied.</p></div>';
    showToast(error?.message || 'Could not load SAC sign-up sheets.', 'error', 7000);
  }
}

function selectSacSignupEvent(eventId) {
  if (!sacSignupsState.events.some(item => item.id === eventId)) return;
  sacSignupsState.selectedEventId = eventId;
  history.pushState({ page: 'sac-signups' }, '', pageUrl('sac-signups', { event: eventId }));
  renderSacSignups();
}

async function claimSacSignupSlot(slotStart, button) {
  if (!canClaimSacSlot() || !sacSignupsState.selectedEventId) return;
  const memberId = selectedSacSignupMemberId();
  if (!memberId) { showToast('Choose a current SAC member first.', 'error'); return; }
  button.disabled = true;
  try {
    const { error } = await supabaseClient.rpc('claim_sac_scoreboard_slot', {
      p_event_id: sacSignupsState.selectedEventId,
      p_slot_start: slotStart,
      p_member_id: canAddMembers() ? memberId : null,
    });
    if (error) throw error;
    showToast('Scoreboard spot saved.');
    renderSacSignups();
  } catch (error) {
    button.disabled = false;
    showToast(error?.message || 'Could not claim this spot.', 'error', 7000);
  }
}

async function cancelSacSignupSlot(signupId, button) {
  if (!canClaimSacSlot()) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.rpc('cancel_sac_scoreboard_slot', { p_signup_id: signupId });
    if (error) throw error;
    showToast('Scoreboard spot cancelled.');
    renderSacSignups();
  } catch (error) {
    button.disabled = false;
    showToast(error?.message || 'Could not cancel this spot.', 'error', 7000);
  }
}

document.getElementById('sac-signups-content')?.addEventListener('click', event => {
  const claim = event.target.closest('[data-sac-claim-start]');
  if (claim) { claimSacSignupSlot(claim.dataset.sacClaimStart, claim); return; }
  const cancel = event.target.closest('[data-sac-cancel-id]');
  if (cancel) cancelSacSignupSlot(cancel.dataset.sacCancelId, cancel);
});
