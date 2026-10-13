import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const path = new URL('../scripts/my-crew-schedule.js', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
const sac = readFileSync(new URL('../scripts/sac-signups.js', import.meta.url), 'utf8');
const equipment = readFileSync(new URL('../scripts/equipment.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const memberSession = core.match(/function memberMatchesCurrentSession\([\s\S]*?\n\}/)[0];
const meetings = readFileSync(new URL('../scripts/meetings.js', import.meta.url), 'utf8');
const meetingCalendar = readFileSync(new URL('../scripts/meeting-calendar.js', import.meta.url), 'utf8');
const accessStart = core.indexOf('function canAccessMyCrewSchedule(');
const access = core.slice(accessStart, core.indexOf('\nfunction ', accessStart + 1));
const now = Date.parse('2030-10-01T08:00:00Z');
const signup = { id: 's1', memberId: 'me', role: 'Photographer', attendanceStart: '2030-10-01T12:00:00+02:00', attendanceEnd: '2030-10-01T13:00:00+02:00', confirmationStatus: 'maybe', confirmationDeadline: '2030-10-01T09:00:00Z', equipmentSource: 'own', ownCameraName: 'My camera' };
const event = { id: 'e1', title: 'Basketball <final>', loc: 'Sports hall', date: '2030-10-01', signups: [signup] };
const reservation = { id: 'r1', memberId: 'me', startsAt: '2030-10-01T08:30:00Z', endsAt: '2030-10-01T12:00:00Z', status: 'scheduled' };

function harness() {
  let clock = now;
  const timers = [];
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', hidden: false, disabled: false, dataset: {}, setAttribute() {}, addEventListener() {} });
    return nodes.get(id);
  };
  const downloads = [];
  const context = vm.createContext({
    Date: class extends Date { static now() { return clock; } }, TextEncoder, Blob,
    URL: class extends URL { static createObjectURL(blob) { downloads.push(blob); return 'blob:test'; } static revokeObjectURL() {} },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {}, window: { location: { origin: 'https://fismediaclub.org' }, CREW_CENTER_AUTH_USER: { id: 'account-a', email: 'me@example.test' } },
    document: { getElementById: node, querySelector: () => ({ id: 'page-my-crew-schedule' }), querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ click() {}, remove() {} }), body: { append() {} } },
    state: { events: [{ ...event, signups: [{ ...signup }] }], meetings: [], equipment: [{ id: 'camera', name: 'Camera kit', reservations: [{ ...reservation }] }], dataLoaded: { events: true, equipment: true, meetings: true }, dataErrors: {} },
    currentMemberRecord: () => ({ id: 'me', email: 'me@example.test' }), isVisitorSession: () => false, canAccessMediaWorkspace: () => true,
    currentCrewCenterWorkspace: () => 'media', pageUrl: (page, params = {}) => `/${page === 'signup' ? 'signups' : page}${params.event ? '?event=' + params.event : params.meeting ? '?meeting=' + params.meeting : ''}`,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    formatBerlinDateTime: value => String(value), berlinDateKey: value => String(value).slice(0, 10),
    showToast() {}, loadCrewCenterData: async () => {},
    canManageCrewOperations: () => false, canAccessAdminPanel: () => false,
  });
  vm.runInContext(sac, context);
  vm.runInContext(meetingCalendar, context);
  vm.runInContext(equipment.slice(0, equipment.indexOf('function activeEquipmentReservation')), context);
  vm.runInContext(memberSession + '\n' + access, context);
  vm.runInContext(meetings.slice(meetings.indexOf('function ownMeetingResponse('), meetings.indexOf('function canRsvpMeeting(')), context);
  vm.runInContext(core.slice(core.indexOf('const BERLIN_TIME_ZONE'), core.indexOf('function timeValue')), context);
  vm.runInContext(source, context);
  return { context, node, downloads, timers, setClock(value) { clock = value; } };
}

test('schedule filter selection updates the sliding control even when schedule data cannot load',()=>{
  const h=harness();const row={id:'filters'};const updates=[];
  const buttons=['all','assignment','equipment','meeting'].map(filter=>({dataset:{crewScheduleFilter:filter},pressed:null,active:false,
    setAttribute(name,value){if(name==='aria-pressed')this.pressed=value;},classList:{toggle(name,value){buttons.find(button=>button.dataset.crewScheduleFilter===filter).active=value;}}}));
  h.context.document.querySelectorAll=()=>buttons;
  h.context.document.querySelector=selector=>selector.includes('.crew-personal-filters')?row:{id:'page-my-crew-schedule'};
  h.context.updateSlidingTab=target=>updates.push(target);
  h.context.selectMyCrewScheduleFilter('equipment');
  assert.deepEqual(buttons.map(button=>button.pressed),['false','false','true','false']);
  assert.equal(buttons[2].active,true);assert.equal(updates.at(-1),row);
  h.context.state.dataErrors.events='fixture failure';h.context.selectMyCrewScheduleFilter('meeting');
  assert.deepEqual(buttons.map(button=>button.pressed),['false','false','false','true']);
  assert.equal(buttons[2].active,false);assert.equal(buttons[3].active,true);assert.equal(updates.length,2);
});

test('personal schedule combines every own active assignment and loan in instant order', () => {
  const h = harness();
  for (let i = 2; i <= 7; i++) h.context.state.events.push({ ...event, id: 'e' + i, signups: [{ ...signup, id: 's' + i }] });
  h.context.state.events[0].signups.push({ ...signup, id: 'other', memberId: 'someone-else' }, { ...signup, id: 'expired', confirmationStatus: 'expired' }, { ...signup, id: 'ended', attendanceEnd: '2030-10-01T07:00:00Z' });
  h.context.state.equipment[0].reservations.push({ ...reservation, id: 'returned', returnedAt: '2030-10-01T07:00:00Z' }, { ...reservation, id: 'other', memberId: 'someone-else' });
  const items = h.context.ownCrewScheduleItems(now);
  assert.equal(items.length, 8);
  assert.equal(items[0].kind, 'equipment');
  assert.equal(items.filter(item => item.kind === 'assignment').length, 7);
  assert.ok(!JSON.stringify(items).includes('someone-else'));
});

test('calendar reflects saved Berlin instants, Maybe status, stable IDs and private metadata', () => {
  const h = harness();
  const item = h.context.ownCrewScheduleItems(now).find(item => item.kind === 'assignment');
  const raw = h.context.buildCrewScheduleCalendar([item], 'https://fismediaclub.org', now);
  const flat = raw.replace(/\r\n[ \t]/g, '');
  assert.match(flat, /DTSTART:20301001T100000Z\r\nDTEND:20301001T110000Z/);
  assert.match(flat, /STATUS:TENTATIVE/);
  assert.match(flat, /CLASS:PRIVATE/);
  assert.match(flat, /confirm by/i);
  assert.match(flat, /My camera/);
  assert.doesNotMatch(flat, /ATTENDEE:|ORGANIZER:|mailto:|memberId/);
  assert.match(flat, /URL:https:\/\/fismediaclub.org\/signups\?event=e1/);
  item.signup.attendanceStart = '2030-10-28T12:00:00+01:00';
  item.start = Date.parse(item.signup.attendanceStart); item.end = Date.parse('2030-10-28T13:00:00+01:00');
  const winter = h.context.buildCrewScheduleCalendar([item], 'https://fismediaclub.org', now).replace(/\r\n[ \t]/g, '');
  assert.match(winter, /DTSTART:20301028T110000Z/);
  assert.equal(flat.match(/UID:.*/)[0], winter.match(/UID:.*/)[0]);
});

test('calendar rejects ended or deadline-passed entries and safely folds Unicode text', () => {
  const h = harness(); const item = h.context.ownCrewScheduleItems(now)[0];
  item.title = '東京 🏀 '.repeat(30) + ', A; B\\C\nATTENDEE:mailto:bad@example.test';
  const raw = h.context.buildCrewScheduleCalendar([item], 'https://fismediaclub.org', now);
  for (const line of raw.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.doesNotMatch(raw, /\r\nATTENDEE:/);
  assert.equal(h.context.buildCrewScheduleCalendar([{ ...item, end: now }], 'https://fismediaclub.org', now), '');
  const assignment = h.context.ownCrewScheduleItems(now).find(entry => entry.kind === 'assignment');
  assignment.signup.confirmationDeadline = '2030-10-01T07:00:00Z';
  assert.equal(h.context.buildCrewScheduleCalendar([assignment], 'https://fismediaclub.org', now), '');
});

test('downloads recheck ownership and access after the page was rendered', () => {
  const h = harness(); h.context.downloadCrewScheduleCalendar('assignment:s1');
  assert.equal(h.downloads.length, 1);
  h.context.currentMemberRecord = () => ({ id: 'someone-else' });
  h.context.downloadCrewScheduleCalendar('assignment:s1');
  h.context.isVisitorSession = () => true; h.context.downloadCrewScheduleCalendar();
  h.context.isVisitorSession = () => false; h.context.currentCrewCenterWorkspace = () => 'sac'; h.context.downloadCrewScheduleCalendar();
  assert.equal(h.downloads.length, 1);
});

test('a changed or signed-out account cannot use a stale linked member record', () => {
  const h = harness();
  h.context.window.CREW_CENTER_AUTH_USER = { id: 'account-b', email: 'other@example.test' };
  assert.equal(h.context.ownCrewScheduleItems(now).length, 0);
  h.context.renderMyCrewSchedule();
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Basketball/);
  h.context.window.CREW_CENTER_AUTH_USER = null;
  h.context.downloadCrewScheduleCalendar();
  assert.equal(h.downloads.length, 0);
});

test('ordinary members can view and export their own schedule when the directory hides email', () => {
  const h = harness();
  h.context.currentMemberRecord = () => ({ id: 'me', email: '', isCurrentUser: true, directoryActor: 'account-a:0' });
  assert.equal(h.context.canAccessMyCrewSchedule(), true);
  assert.equal(h.context.ownCrewScheduleItems(now).length, 2);
  h.context.downloadCrewScheduleCalendar(); assert.equal(h.downloads.length, 1);
  h.context.window.CREW_CENTER_AUTH_EPOCH = 1;
  assert.equal(h.context.canAccessMyCrewSchedule(), false);
  assert.equal(h.context.ownCrewScheduleItems(now).length, 0);
});

test('the schedule access check is available before the page scripts and denies unresolved workspace access', () => {
  const h = harness();
  h.context.canAccessMediaWorkspace = undefined;
  assert.equal(h.context.canAccessMyCrewSchedule(), false);
});

test('rendering distinguishes unloaded and failed data from an empty schedule and escapes titles', () => {
  const h = harness(); h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Basketball &lt;final&gt;/);
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Confirm on sheet/);
  h.context.state.dataErrors.events = "Couldn't load the events.";
  h.context.state.dataLoaded.events = false; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Retry/);
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Basketball/);
  h.context.state.dataErrors = {}; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Loading/);
  h.context.state.dataLoaded.events = true; h.context.state.events = []; h.context.state.equipment = []; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /No upcoming/);
  h.context.isVisitorSession = () => true; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /member account/);
});

test('calendar export explains its selection and why an empty or unavailable download is disabled', () => {
  const h = harness(); h.context.renderMyCrewSchedule();
  assert.equal(h.node('my-crew-schedule-download').disabled, false);
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /2 bookings.*\.ics/);
  h.context.selectMyCrewScheduleFilter('equipment');
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /1 booking.*\.ics/);
  h.context.state.equipment = []; h.context.renderMyCrewSchedule();
  assert.equal(h.node('my-crew-schedule-download').disabled, true);
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /No upcoming bookings in this view/);
  h.context.state.events = []; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /Add a crew role, meeting RSVP, or equipment booking first/);
  h.context.state.dataErrors.events = 'fixture error'; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /Refresh your schedule/);
  h.context.state.dataErrors = {}; h.context.state.dataLoaded.events = false; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /Loading your bookings/);
  h.context.isVisitorSession = () => true; h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-calendar-status').textContent, /member account/);
});

test('downloads produce calendar files for the current filter and individual own bookings', async () => {
  const h = harness();
  h.context.selectMyCrewScheduleFilter('equipment'); h.context.downloadCrewScheduleCalendar();
  assert.equal(h.downloads[0].type, 'text/calendar;charset=utf-8');
  const loan = await h.downloads[0].text();
  assert.match(loan, /Equipment loan/); assert.doesNotMatch(loan, /Media crew/);
  h.context.selectMyCrewScheduleFilter('assignment'); h.context.downloadCrewScheduleCalendar();
  const assignment = await h.downloads[1].text();
  assert.match(assignment, /Media crew/); assert.doesNotMatch(assignment, /Equipment loan/);
  h.context.downloadCrewScheduleCalendar('equipment:r1');
  assert.match(await h.downloads[2].text(), /Equipment loan/);
});

test('an open schedule refreshes at personal booking and confirmation boundaries', () => {
  const h = harness(); h.context.renderMyCrewSchedule();
  assert.equal(h.timers.at(-1).delay, 30 * 60 * 1000 + 100);
  h.setClock(now + 60 * 60 * 1000 + 100); h.timers.at(-1).callback();
  assert.match(h.node('my-crew-schedule-list').innerHTML, /Deadline passed/);
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Confirm on sheet/);
  h.setClock(Date.parse(signup.attendanceEnd) + 100); h.timers.at(-1).callback();
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML, /Basketball/);
});

test('the agenda updates at an assignment start rather than waiting for its end', () => {
  const h = harness();
  Object.assign(h.context.state.events[0].signups[0], { attendanceStart: new Date(now + 60000).toISOString(), confirmationStatus: 'confirmed' });
  h.context.renderMyCrewSchedule();
  assert.equal(h.timers.at(-1).delay, 60100);
  h.setClock(now + 60100); h.timers.at(-1).callback();
  assert.match(h.node('my-crew-schedule-overview').innerHTML, /On now/);
});

test('agenda days follow Berlin midnight and Tomorrow across the daylight saving transition', () => {
  const h = harness(); const clock = Date.parse('2030-03-30T22:30:00Z');
  const items = ['2030-03-30T22:45:00Z','2030-03-30T23:30:00Z','2030-03-31T22:30:00Z']
    .map((start,index) => ({id:String(index),start:Date.parse(start),end:Date.parse(start)+1800000,kind:'assignment'}));
  const groups = h.context.crewScheduleAgendaGroups(items, clock);
  assert.deepEqual(Array.from(groups, group => group.key), ['2030-03-30','2030-03-31','2030-04-01']);
  assert.equal(groups[0].label,'Today'); assert.equal(groups[1].label,'Tomorrow');
  const ongoing = { ...items[0], start: clock - 86400000, end: clock + 60000 };
  assert.equal(h.context.crewScheduleAgendaGroups([ongoing],clock)[0].key,'2030-03-30');
});

test('attention separates confirmations, missed deadlines and return reminders without extending equipment bookings', () => {
  const h = harness(); const items = h.context.ownCrewScheduleItems(now);
  const assignment = items.find(item => item.kind==='assignment');
  const loan = items.find(item => item.kind==='equipment');
  const missed = { ...assignment, id:'missed', signup:{...assignment.signup,confirmationDeadline:new Date(now-60000).toISOString()} };
  const due = { ...loan, id:'due', start:now-3600000,end:now-60000 };
  const attention = h.context.crewScheduleAttention([assignment,loan,missed,due],now);
  assert.deepEqual(Array.from(attention, item => item.reason), ['return_due','review','confirm','return_today']);
  h.context.state.equipment[0].reservations[0].endsAt = new Date(now-16*60000).toISOString();
  assert.equal(h.context.ownCrewScheduleItems(now).filter(item=>item.kind==='equipment').length,0);
});

test('agenda overview follows the active filter and clears personal content when access or data fails', () => {
  const h = harness(); h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML,/crew-agenda-day/);
  assert.match(h.node('my-crew-schedule-overview').innerHTML,/Needs attention/);
  h.context.selectMyCrewScheduleFilter('equipment');
  assert.match(h.node('my-crew-schedule-overview').innerHTML,/Camera kit/);
  assert.doesNotMatch(h.node('my-crew-schedule-overview').innerHTML,/Basketball/);
  h.context.selectMyCrewScheduleFilter('assignment');
  assert.doesNotMatch(h.node('my-crew-schedule-overview').innerHTML,/Camera kit/);
  h.context.state.dataErrors.events='local failure'; h.context.renderMyCrewSchedule();
  assert.equal(h.node('my-crew-schedule-overview').innerHTML,'');
  h.context.state.dataErrors={}; h.context.window.CREW_CENTER_AUTH_USER=null; h.context.renderMyCrewSchedule();
  assert.equal(h.node('my-crew-schedule-overview').innerHTML,'');
});

test('day headings refresh at Berlin midnight without waiting for the next booking', () => {
  const h = harness(); const clock = Date.parse('2030-03-30T22:50:00Z'); h.setClock(clock);
  h.context.state.equipment = [];
  Object.assign(h.context.state.events[0].signups[0], { attendanceStart:'2030-03-31T10:00:00Z', attendanceEnd:'2030-03-31T11:00:00Z',confirmationStatus:'confirmed' });
  h.context.renderMyCrewSchedule();
  assert.match(h.node('my-crew-schedule-list').innerHTML,/Tomorrow/);
  assert.equal(h.timers.at(-1).delay, 10*60000+100);
  h.setClock(clock+10*60000+100); h.timers.at(-1).callback();
  assert.match(h.node('my-crew-schedule-list').innerHTML,/Today/);
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML,/Tomorrow/);
});

test('personal agenda includes only own Going or Maybe responses for permitted upcoming meetings', () => {
  const h=harness();
  const meeting={id:'m1',title:'Planning meeting',audience:'general',location:'Media room',startsAt:'2030-10-01T12:00:00Z',endsAt:'2030-10-01T13:00:00Z',attendees:[{memberId:'me',response:'attending'}]};
  h.context.state.meetings=[meeting,
    {...meeting,id:'maybe',attendees:[{memberId:'me',response:'maybe'}]},
    {...meeting,id:'other',attendees:[{memberId:'other',response:'attending'}]},
    {...meeting,id:'declined',attendees:[{memberId:'me',response:'declined'}]},
    {...meeting,id:'restricted',audience:'leadership'},
    {...meeting,id:'archived',archivedAt:'2030-10-01'},
    {...meeting,id:'ended',endsAt:'2030-10-01T07:00:00Z'}];
  const own=h.context.ownCrewScheduleItems(now).filter(item=>item.kind==='meeting');
  assert.deepEqual(Array.from(own,item=>item.id),['meeting:m1','meeting:maybe']);
  h.context.selectMyCrewScheduleFilter('meeting');
  assert.match(h.node('my-crew-schedule-list').innerHTML,/Planning meeting/);
  assert.doesNotMatch(h.node('my-crew-schedule-list').innerHTML,/Basketball|Camera kit/);
  const calendar=h.context.buildCrewScheduleCalendar(own,'https://fismediaclub.org',now);
  const direct=h.context.buildMeetingCalendar(own[0].meeting,'media','attending','https://fismediaclub.org/meetings?meeting=m1',now);
  assert.equal(calendar.match(/UID:.*/)[0],direct.match(/UID:.*/)[0],'both exports should use the same meeting identity');
  assert.match(calendar,/Club meeting/);assert.match(calendar,/STATUS:TENTATIVE/);assert.match(calendar,/STATUS:CONFIRMED/);
  assert.match(h.context.crewScheduleDetail(own[1]),/RSVP: Maybe/);
  assert.equal(h.context.crewScheduleAttention(own,now)[0].reason,'meeting_maybe');
});

test('clearing, declining, or losing audience access removes meetings from the agenda', () => {
  const h=harness(); const meeting={id:'m1',title:'Planning meeting',audience:'general',startsAt:'2030-10-01T12:00:00Z',endsAt:'2030-10-01T13:00:00Z',attendees:[{memberId:'me',response:'attending'}]};
  h.context.state.meetings=[meeting];
  assert.equal(h.context.ownCrewScheduleItems(now).filter(item=>item.kind==='meeting').length,1);
  for(const update of [()=>meeting.attendees=[],()=>meeting.attendees=[{memberId:'me',response:'declined'}],()=>{meeting.attendees=[{memberId:'me',response:'attending'}];meeting.audience='news_team';}]){
    update();assert.equal(h.context.ownCrewScheduleItems(now).filter(item=>item.kind==='meeting').length,0);
  }
});
