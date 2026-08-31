// ══════════════════════════════
// MEETINGS
// ══════════════════════════════
const meetingAudienceCatalog = {
  general: { label: 'General', color: 'blue', description: 'All approved Media Club members' },
  news_team: { label: 'News Team', color: 'teal', description: 'Visible only to current News Team members' },
  leadership: { label: 'Leadership', color: 'amber', description: 'Faculty and crew-operations leadership' },
};

const meetingResponseCatalog = {
  attending: { label: 'Attending', short: 'Going', color: 'teal' },
  maybe: { label: 'Maybe', short: 'Maybe', color: 'amber' },
  declined: { label: "Can't attend", short: 'Declined', color: 'coral' },
};

let editingMeetingId = null;

function meetingById(id) {
  return [...state.meetings, ...state.archivedMeetings].find(meeting => meeting.id === id);
}

function meetingIsPast(meeting, now = Date.now()) {
  const end = Date.parse(meeting?.endsAt || '');
  return Number.isFinite(end) && end <= now;
}

function meetingAudience(audience) {
  return meetingAudienceCatalog[audience] || meetingAudienceCatalog.general;
}

function meetingResponse(response) {
  return meetingResponseCatalog[response] || meetingResponseCatalog.maybe;
}

function meetingInputParts(value) {
  const parts = berlinParts(value);
  return {
    date: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
  };
}

function meetingDateLabel(value) {
  return formatBerlinDateTime(value, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function meetingTimeLabel(meeting) {
  const start = formatBerlinDateTime(meeting.startsAt, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const end = formatBerlinDateTime(meeting.endsAt, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${start}–${end}`;
}

function meetingRelatedEvent(meeting) {
  return [...state.events, ...state.archivedEvents].find(event => event.id === meeting.relatedEventId);
}

function ownMeetingResponse(meeting) {
  const memberId = currentMemberRecord()?.id;
  return memberId ? meeting.attendees.find(attendee => attendee.memberId === memberId)?.response || '' : '';
}

function canViewMeeting(meeting) {
  const member = currentMemberRecord();
  if (!meeting || isVisitorSession()) return false;
  if (meeting.audience === 'general') return Boolean(member || canAccessAdminPanel());
  if (meeting.audience === 'news_team') return Boolean(member && (member.teamKeys || []).includes('news_team'));
  return meeting.audience === 'leadership' && canManageCrewOperations();
}

function canRsvpMeeting(meeting) {
  return Boolean(currentMemberRecord()) && canViewMeeting(meeting) && !meeting.archivedAt;
}

function meetingAvatar(attendee) {
  const parts = splitName(attendee.name);
  const avatarUrl = safeExternalUrl(attendee.avatarUrl);
  const label = escapeHtml(attendee.name);
  const style = avatarUrl ? `background-image:url(&quot;${escapeHtml(avatarUrl)}&quot;);` : '';
  return `<span class="meeting-attendee-avatar" style="${style}" title="${label}" aria-label="${label}">${avatarUrl ? '' : escapeHtml(initials(parts.fname, parts.lname))}</span>`;
}

function renderMeetingCommandGrid(meetings) {
  const target = document.getElementById('meeting-command-grid');
  if (!target) return;
  const upcoming = meetings.filter(meeting => !meetingIsPast(meeting)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const ownUpcomingResponses = upcoming.map(ownMeetingResponse);
  const responded = ownUpcomingResponses.filter(Boolean).length;
  const nextResponse = next ? ownMeetingResponse(next) : '';
  const nextSignal = nextResponse ? meetingResponse(nextResponse).label : next ? 'Response needed' : 'Standing by';
  const nextSignalDetail = next ? `For ${escapeHtml(next.title)}` : 'No RSVP is currently required.';
  target.innerHTML = `
    <article class="meeting-command-card">
      <span class="meeting-command-code">NEXT</span>
      <strong>${next ? escapeHtml(next.title) : 'No meeting queued'}</strong>
      <span>${next ? `${escapeHtml(meetingDateLabel(next.startsAt))} · ${escapeHtml(meetingTimeLabel(next))}` : 'Your meeting channel is clear.'}</span>
    </article>
    <article class="meeting-command-card">
      <span class="meeting-command-code">SIGNAL</span>
      <strong>${escapeHtml(nextSignal)}</strong>
      <span>${nextSignalDetail}</span>
    </article>
    <article class="meeting-command-card">
      <span class="meeting-command-code">QUEUE</span>
      <strong>${upcoming.length} upcoming</strong>
      <span>${responded} response${responded === 1 ? '' : 's'} recorded</span>
    </article>`;
}

function renderMeetingRoster(meeting) {
  const active = meeting.attendees.filter(attendee => attendee.response !== 'declined');
  const attending = meeting.attendees.filter(attendee => attendee.response === 'attending').length;
  const maybe = meeting.attendees.filter(attendee => attendee.response === 'maybe').length;
  const declined = meeting.attendees.filter(attendee => attendee.response === 'declined').length;
  return `<div class="meeting-roster">
    <div class="meeting-roster-avatars">${active.slice(0, 7).map(meetingAvatar).join('')}${active.length > 7 ? `<span class="meeting-attendee-more">+${active.length - 7}</span>` : ''}</div>
    <div class="meeting-roster-counts"><span>${attending} going</span><span>${maybe} maybe</span>${declined ? `<span>${declined} declined</span>` : ''}</div>
  </div>`;
}

function renderMeetingRsvp(meeting) {
  if (meetingIsPast(meeting) || !currentMemberRecord()) return '';
  if (!canRsvpMeeting(meeting)) return '';
  const selected = ownMeetingResponse(meeting);
  return `<div class="meeting-rsvp" role="group" aria-label="Your RSVP for ${escapeHtml(meeting.title)}">
    <span class="meeting-rsvp-label">Your response</span>
    <div class="meeting-rsvp-actions">
      ${Object.entries(meetingResponseCatalog).map(([key, definition]) => `<button type="button" class="meeting-rsvp-button ${selected === key ? `active ${key}` : ''}" aria-pressed="${selected === key}" onclick="setMeetingRsvp('${meeting.id}','${key}')">${escapeHtml(definition.short)}</button>`).join('')}
      ${selected ? `<button type="button" class="meeting-rsvp-clear" onclick="clearMeetingRsvp('${meeting.id}')">Clear</button>` : ''}
    </div>
  </div>`;
}

function renderMeetingCard(meeting) {
  const audience = meetingAudience(meeting.audience);
  const relatedEvent = meetingRelatedEvent(meeting);
  const past = meetingIsPast(meeting);
  const link = safeExternalUrl(meeting.meetingLink);
  const month = formatBerlinDateTime(meeting.startsAt, { month: 'short' }).toUpperCase();
  const day = formatBerlinDateTime(meeting.startsAt, { day: '2-digit' });
  return `<article class="meeting-card ${past ? 'past' : ''}">
    <div class="meeting-card-signal" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="meeting-date-node"><span>${escapeHtml(month)}</span><strong>${escapeHtml(day)}</strong></div>
    <div class="meeting-card-body">
      <div class="meeting-card-head">
        <div><div class="meeting-card-kicker">${past ? 'Meeting record' : 'Scheduled transmission'}</div><h2>${escapeHtml(meeting.title)}</h2></div>
        <div class="meeting-card-badges"><span class="badge badge-${audience.color}">${escapeHtml(audience.label)}</span>${past ? '<span class="badge badge-gray">Past</span>' : ''}</div>
      </div>
      <div class="meeting-meta">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${escapeHtml(meetingDateLabel(meeting.startsAt))} · ${escapeHtml(meetingTimeLabel(meeting))}</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1116 0z"/><circle cx="12" cy="10" r="2.5"/></svg>${escapeHtml(meeting.location || 'Location to be confirmed')}</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0114 0"/></svg>Organised by ${escapeHtml(meeting.organizerName)}</span>
      </div>
      <div class="meeting-audience-note"><span class="meeting-audience-pulse"></span>${escapeHtml(audience.description)}</div>
      ${meeting.agenda ? `<section class="meeting-copy-block"><span>Agenda</span><p>${escapeHtml(meeting.agenda)}</p></section>` : '<section class="meeting-copy-block muted"><span>Agenda</span><p>No agenda has been published yet.</p></section>'}
      ${past ? `<section class="meeting-copy-block meeting-minutes ${meeting.notes ? '' : 'muted'}"><span>Minutes and decisions</span><p>${meeting.notes ? escapeHtml(meeting.notes) : 'Minutes have not been published yet.'}</p></section>` : ''}
      <div class="meeting-link-row">
        ${relatedEvent ? `<a class="meeting-context-link" href="${escapeHtml(pageUrl('events'))}"><span>Linked production</span>${escapeHtml(relatedEvent.title)}</a>` : '<span class="meeting-context-empty">Independent meeting</span>'}
        ${link ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open meeting link</a>` : ''}
      </div>
      ${renderMeetingRoster(meeting)}
      ${renderMeetingRsvp(meeting)}
      ${canManageCrewOperations() ? `<div class="meeting-admin-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="openMeetingEditor('${meeting.id}')">${past ? 'Edit minutes' : 'Edit meeting'}</button><button type="button" class="btn btn-ghost btn-sm" onclick="requestArchiveMeeting('${meeting.id}')">Archive</button>${canAddMembers() ? `<button type="button" class="btn btn-danger btn-sm" onclick="requestPermanentDeleteMeeting('${meeting.id}')">Delete everything</button>` : ''}</div>` : ''}
    </div>
  </article>`;
}

function renderArchivedMeetings() {
  const panel = document.getElementById('archived-meetings-panel');
  const list = document.getElementById('archived-meetings-list');
  if (!panel || !list) return;
  const visibleArchivedMeetings = state.archivedMeetings.filter(canViewMeeting);
  panel.hidden = !canManageCrewOperations() || !visibleArchivedMeetings.length;
  if (panel.hidden) { list.innerHTML = ''; return; }
  list.innerHTML = visibleArchivedMeetings.slice().sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map(meeting => `<div class="archived-row">
    <div><strong>${escapeHtml(meeting.title)}</strong><div class="text-muted">${escapeHtml(meetingDateLabel(meeting.startsAt))} · ${meeting.attendees.length} preserved response(s)</div></div>
    <div class="archived-row-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="restoreArchivedMeeting('${meeting.id}')">Restore</button>${canAddMembers() ? `<button type="button" class="btn btn-danger btn-sm" onclick="requestPermanentDeleteMeeting('${meeting.id}')">Delete everything</button>` : ''}</div>
  </div>`).join('');
}

function renderMeetings() {
  if (isVisitorSession()) return;
  const tab = tabValueFromUrl(['upcoming', 'past'], 'upcoming');
  document.querySelectorAll('[data-meeting-tab]').forEach(link => {
    const active = link.dataset.meetingTab === tab;
    link.classList.toggle('active', active);
    link.setAttribute('aria-selected', String(active));
    link.tabIndex = active ? 0 : -1;
  });
  requestAnimationFrame(() => updateSlidingTab(document.querySelector('#page-meetings .tab-row')));
  const visibleMeetings = state.meetings.filter(canViewMeeting);
  renderMeetingCommandGrid(visibleMeetings);
  renderArchivedMeetings();
  const meetings = visibleMeetings.filter(meeting => tab === 'past' ? meetingIsPast(meeting) : !meetingIsPast(meeting));
  meetings.sort((a, b) => tab === 'past' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt));
  const target = document.getElementById('meetings-list');
  if (!meetings.length) {
    target.innerHTML = `<div class="empty-state meeting-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="9" r="1.5"/><circle cx="16" cy="15" r="1.5"/><path d="M10 12h3M14.5 10l-3 1.5M14.5 14l-3-1.5"/></svg><p>${tab === 'past' ? 'No past meeting records are available.' : 'No meetings are currently scheduled.'}</p>${canCreateMeetings() && tab === 'upcoming' ? '<button type="button" class="btn btn-accent btn-sm" onclick="openMeetingEditor()">Schedule the first meeting</button>' : ''}</div>`;
    return;
  }
  target.innerHTML = meetings.map(renderMeetingCard).join('');
}

function renderMeetingEventOptions(selected = '') {
  const select = document.getElementById('meeting-related-event');
  const options = state.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  select.innerHTML = `<option value="">No linked production</option>${options.map(event => `<option value="${event.id}" ${event.id === selected ? 'selected' : ''}>${escapeHtml(formatEventDate(event.date))} · ${escapeHtml(event.title)}</option>`).join('')}`;
}

function setMeetingEditorValues(meeting) {
  const defaultStart = Date.now() + 60 * 60 * 1000;
  const defaultEnd = defaultStart + 60 * 60 * 1000;
  const start = meetingInputParts(meeting?.startsAt || defaultStart);
  const end = meetingInputParts(meeting?.endsAt || defaultEnd);
  document.getElementById('meeting-title').value = meeting?.title || '';
  document.getElementById('meeting-audience').value = meeting?.audience || 'general';
  document.getElementById('meeting-date').value = start.date;
  document.getElementById('meeting-start').value = start.time;
  document.getElementById('meeting-end').value = end.time;
  document.getElementById('meeting-location').value = meeting?.location || '';
  document.getElementById('meeting-link').value = meeting?.meetingLink || '';
  document.getElementById('meeting-agenda').value = meeting?.agenda || '';
  document.getElementById('meeting-notes').value = meeting?.notes || '';
  document.getElementById('meeting-notes-group').hidden = !meeting;
  updateMeetingAudienceHelp();
  renderMeetingEventOptions(meeting?.relatedEventId || '');
}

function updateMeetingAudienceHelp() {
  const audience = document.getElementById('meeting-audience')?.value || 'general';
  const help = document.getElementById('meeting-audience-help');
  if (!help) return;
  help.textContent = {
    general: 'Every approved member is invited and can RSVP.',
    news_team: 'Only current News Team members receive an invitation, see this meeting, and can RSVP.',
    leadership: 'Only Auth Admins, Faculty, Leaders, Co-Leaders, and Moderators see this meeting and can RSVP.',
  }[audience] || '';
}

function openMeetingEditor(id = '') {
  const meeting = id ? meetingById(id) : null;
  if (id && (!meeting || meeting.archivedAt)) return;
  if (!meeting && !canCreateMeetings()) { showToast('Only Faculty, Leaders, and Co-Leaders can schedule meetings.', 'error'); return; }
  if (meeting && !canManageCrewOperations()) { showToast('Production staff access is required to edit meetings.', 'error'); return; }
  editingMeetingId = meeting?.id || null;
  document.getElementById('meeting-modal-title').textContent = meeting ? 'Edit meeting' : 'Schedule meeting';
  document.getElementById('meeting-modal-sub').textContent = meeting ? 'Update the schedule, audience, agenda, or published meeting record.' : 'Choose who needs the meeting, when it happens, and what the crew should prepare.';
  document.getElementById('meeting-save-button').textContent = meeting ? 'Save meeting changes' : 'Schedule meeting';
  const authorizationNotice = document.getElementById('meeting-faculty-authorization');
  const authorizationCheckbox = document.getElementById('meeting-faculty-authorization-confirmed');
  authorizationNotice.hidden = Boolean(meeting) || !meetingCreationNeedsFacultyConfirmation();
  authorizationCheckbox.checked = false;
  setMeetingEditorValues(meeting);
  openModal('meeting-modal');
}

function closeMeetingEditor() {
  editingMeetingId = null;
  closeModal('meeting-modal');
}

async function saveMeeting() {
  const creating = !editingMeetingId;
  if (creating && !canCreateMeetings()) { showToast('Only Faculty, Leaders, and Co-Leaders can schedule meetings.', 'error'); return; }
  if (!creating && !canManageCrewOperations()) { showToast('Production staff access is required to edit meetings.', 'error'); return; }
  const title = document.getElementById('meeting-title').value.trim();
  const date = document.getElementById('meeting-date').value;
  const startTime = document.getElementById('meeting-start').value;
  const endTime = document.getElementById('meeting-end').value;
  const startsAt = berlinTimestamp(date, startTime);
  const endsAt = berlinTimestamp(date, endTime);
  const link = document.getElementById('meeting-link').value.trim();
  const facultyAuthorized = Boolean(document.getElementById('meeting-faculty-authorization-confirmed').checked);
  if (!title || !date || !startTime || !endTime) { showToast('Add a title, date, start time, and end time.', 'error'); return; }
  if (startsAt === null || endsAt === null || endsAt <= startsAt) { showToast('The meeting end must be after its Berlin start time.', 'error'); return; }
  if (link && (!safeExternalUrl(link) || !/^https:\/\//i.test(link))) { showToast('Meeting links must use a valid HTTPS address.', 'error'); return; }
  if (creating && meetingCreationNeedsFacultyConfirmation() && !facultyAuthorized) { showToast('Confirm that a Faculty member authorized this meeting before scheduling it.', 'error', 7000); return; }
  const payload = {
    p_title: title,
    p_agenda: document.getElementById('meeting-agenda').value,
    p_starts_at: new Date(startsAt).toISOString(),
    p_ends_at: new Date(endsAt).toISOString(),
    p_location: document.getElementById('meeting-location').value,
    p_meeting_link: link || null,
    p_audience: document.getElementById('meeting-audience').value,
    p_related_event_id: document.getElementById('meeting-related-event').value || null,
  };
  const button = document.getElementById('meeting-save-button');
  button.disabled = true;
  button.textContent = editingMeetingId ? 'Saving changes…' : 'Scheduling…';
  const request = editingMeetingId
    ? supabaseClient.rpc('update_meeting', { ...payload, p_meeting_id: editingMeetingId, p_notes: document.getElementById('meeting-notes').value })
    : supabaseClient.rpc('create_meeting', { ...payload, p_faculty_authorized: facultyAuthorized });
  const { data, error } = await request;
  button.disabled = false;
  button.textContent = editingMeetingId ? 'Save meeting changes' : 'Schedule meeting';
  if (error || !data) { showToast(error?.message || "Couldn't save the meeting.", 'error', 8000); return; }
  const wasEditing = Boolean(editingMeetingId);
  const savedMeetingId = editingMeetingId || data.id;
  const audience = payload.p_audience;
  const emailDelivery = await sendScheduleEmailNotification('meeting', savedMeetingId, wasEditing ? 'updated' : 'created');
  closeMeetingEditor();
  await loadCrewCenterData({ datasets: ['meetings', 'notifications'], silent: true });
  const savedMessage = audience === 'news_team'
    ? (wasEditing ? 'Meeting updated. News Team invitations refreshed.' : 'News Team meeting scheduled. Invitations sent only to current News Team members.')
    : (wasEditing ? 'Meeting updated.' : 'Meeting scheduled.');
  if (!emailDelivery.ok) {
    showToast(`${savedMessage} Subscriber email delivery needs attention.`, 'error', 8000);
  } else {
    showToast(emailDelivery.sentCount ? `${savedMessage} Emailed ${emailDelivery.sentCount} subscriber${emailDelivery.sentCount === 1 ? '' : 's'}.` : savedMessage);
  }
}

async function setMeetingRsvp(id, response) {
  const meeting = meetingById(id);
  const member = currentMemberRecord();
  if (!meeting || meeting.archivedAt || meetingIsPast(meeting) || !member || !meetingResponseCatalog[response]) return;
  if (!canRsvpMeeting(meeting)) { showToast('This meeting is not available to your audience.', 'error'); return; }
  const { error } = await supabaseClient.from('meeting_attendees').upsert({
    meeting_id: id,
    member_id: member.id,
    response,
    responded_at: new Date().toISOString(),
  }, { onConflict: 'meeting_id,member_id' });
  if (error) { showToast(error.message || "Couldn't save your RSVP.", 'error', 7000); return; }
  await loadCrewCenterData({ datasets: ['meetings'], silent: true });
  showToast(`RSVP saved: ${meetingResponse(response).label}.`);
}

async function clearMeetingRsvp(id) {
  const member = currentMemberRecord();
  const meeting = meetingById(id);
  if (!member || !meeting || meetingIsPast(meeting)) return;
  if (!canRsvpMeeting(meeting)) { showToast('This meeting is not available to your audience.', 'error'); return; }
  const { error } = await supabaseClient.from('meeting_attendees').delete().eq('meeting_id', id).eq('member_id', member.id);
  if (error) { showToast(error.message || "Couldn't clear your RSVP.", 'error', 7000); return; }
  await loadCrewCenterData({ datasets: ['meetings'], silent: true });
  showToast('RSVP cleared.');
}

function requestArchiveMeeting(id) {
  const meeting = meetingById(id);
  if (!meeting || meeting.archivedAt || !canManageCrewOperations()) return;
  openActionConfirmation({
    kind: 'archive-meeting',
    title: `Archive “${meeting.title}”?`,
    copy: 'The meeting will disappear from member calendars. Its agenda, minutes, and RSVP history will be preserved for crew leadership.',
    impact: [`${meeting.attendees.length} RSVP response(s) will be preserved.`],
    confirmLabel: 'Archive meeting',
    busyLabel: 'Archiving…',
    execute: async () => {
      const { data, error } = await supabaseClient.rpc('set_meeting_archived', { p_meeting_id: id, p_archived: true });
      if (error || !data) { showToast(error?.message || "Couldn't archive the meeting.", 'error', 7000); return false; }
      await loadCrewCenterData({ datasets: ['meetings'], silent: true });
      showToast(`“${meeting.title}” archived.`);
      return true;
    },
  });
}

async function restoreArchivedMeeting(id) {
  if (!canManageCrewOperations()) return;
  const meeting = meetingById(id);
  const { data, error } = await supabaseClient.rpc('set_meeting_archived', { p_meeting_id: id, p_archived: false });
  if (error || !data) { showToast(error?.message || "Couldn't restore the meeting.", 'error', 7000); return; }
  await loadCrewCenterData({ datasets: ['meetings'], silent: true });
  showToast(`“${meeting?.title || 'Meeting'}” restored.`);
}

async function requestPermanentDeleteMeeting(id) {
  if (!canAddMembers()) { showToast('Only an Auth Admin can permanently delete meetings.', 'error'); return; }
  const meeting = meetingById(id);
  if (!meeting) return;
  const { data: impact, error } = await supabaseClient.rpc('get_meeting_delete_impact', { p_meeting_id: id });
  if (error || !impact) { showToast(error?.message || "Couldn't calculate the deletion impact.", 'error', 7000); return; }
  openActionConfirmation({
    kind: 'permanent-meeting-delete',
    title: `Permanently delete “${meeting.title}”?`,
    copy: 'Archiving is safer. Permanent deletion is restricted to Auth Admins because it erases the meeting record and every RSVP.',
    impact: [`${impact.responses || 0} RSVP response(s) will be erased.`, 'Agenda, minutes, and decision history will be erased.'],
    danger: true,
    requiresAcknowledgement: true,
    acknowledgementCopy: 'I understand that this permanently erases the meeting and its history.',
    expectedName: meeting.title,
    multipleWarnings: true,
    confirmLabel: 'Permanently delete everything',
    busyLabel: 'Deleting everything…',
    execute: async () => {
      const { data, error: deleteError } = await supabaseClient.rpc('permanently_delete_meeting', { p_meeting_id: id, p_expected_title: meeting.title });
      if (deleteError || !data?.deleted) { showToast(deleteError?.message || "Couldn't permanently delete the meeting.", 'error', 8000); return false; }
      await loadCrewCenterData({ datasets: ['meetings'], silent: true });
      showToast(`“${meeting.title}” and its RSVP history were permanently deleted.`, 'error', 7000);
      return true;
    },
  });
}
