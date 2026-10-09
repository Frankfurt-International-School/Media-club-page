// Calendar files contain meeting details and the viewer's RSVP, never a roster.
function buildMeetingCalendar(meeting, workspace, response, url, now = Date.now()) {
  const start = Date.parse(meeting?.startsAt || meeting?.starts_at);
  const end = Date.parse(meeting?.endsAt || meeting?.ends_at);
  if (!meeting?.id || meeting.archivedAt || !['media', 'sac'].includes(workspace) || !Number.isFinite(now)
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= now
    || workspace === 'media' && !['', 'attending', 'maybe'].includes(response)) return '';
  let destination;
  try { destination = new URL(url); } catch (_error) { return ''; }
  if (!['http:', 'https:'].includes(destination.protocol)) return '';
  const timestamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const media = workspace === 'media';
  const description = media
    ? `RSVP: ${response === 'attending' ? 'Going' : response === 'maybe' ? 'Maybe' : 'Not responded'}. Adding this entry does not change your RSVP or record attendance.`
    : 'Scheduled SAC council meeting. Adding this entry does not record attendance.';
  const uid = media ? `media-${encodeURIComponent(`meeting:${meeting.id}`)}@fismediaclub.org` : `sac-meeting-${encodeURIComponent(meeting.id)}@sac.fismediaclub.org`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//FIS ${media ? 'Media Club' : 'SAC'}//Meetings//EN`, 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${timestamp(now)}`, `DTSTART:${timestamp(start)}`, `DTEND:${timestamp(end)}`,
    `STATUS:${!media || response === 'attending' ? 'CONFIRMED' : 'TENTATIVE'}`, 'CLASS:PRIVATE',
    `SUMMARY:${escapeSacCalendarText(`${media ? 'Club meeting' : 'SAC meeting'} — ${meeting.title || 'Meeting'}`)}`,
    `DESCRIPTION:${escapeSacCalendarText(`${description}\nCalendar files are a snapshot. Check Crew Center for updates and update or remove the calendar entry if details change.`)}`,
    `LOCATION:${escapeSacCalendarText(meeting.location || 'Location to be confirmed')}`, `URL:${destination.href}`,
    'END:VEVENT', 'END:VCALENDAR', ''].map(foldSacCalendarLine).join('\r\n');
}

function downloadMeetingCalendar(workspace, meetingId) {
  const user = window.CREW_CENTER_AUTH_USER;
  const member = currentMemberRecord();
  if (!user?.id || isVisitorSession() || currentCrewCenterWorkspace() !== workspace
    || member && user.email && String(member.email || '').toLowerCase() !== user.email.toLowerCase()) return;
  let meeting; let response = '';
  if (workspace === 'media') {
    if (!canAccessMediaWorkspace()) return;
    if (!state.dataLoaded.meetings || state.dataErrors.meetings) {
      showToast('Meeting details could not be refreshed. Reload Meetings before exporting a calendar.', 'error'); return;
    }
    meeting = meetingById(meetingId);
    if (!meeting || !canViewMeeting(meeting)) return;
    response = ownMeetingResponse(meeting);
  } else if (workspace === 'sac') {
    if (!canAccessSacWorkspace()) return;
    meeting = sacMeetingsState.meetings.find(item => item.id === meetingId);
  } else return;
  const destination = new URL(pageUrl(workspace === 'media' ? 'meetings' : 'sac-meetings', { meeting: meetingId }), window.location.origin);
  const calendar = buildMeetingCalendar(meeting, workspace, response, destination.href);
  if (!calendar) { showToast('This meeting is unavailable for calendar export. Refresh Meetings before trying again.', 'error'); return; }
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${workspace}-meeting.ics`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Calendar file downloaded. Open it in your calendar app.');
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-meeting-calendar-id]');
  if (button) downloadMeetingCalendar(button.dataset.meetingCalendarWorkspace, button.dataset.meetingCalendarId);
});
