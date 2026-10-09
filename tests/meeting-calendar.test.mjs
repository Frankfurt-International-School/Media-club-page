import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const path=new URL('../scripts/meeting-calendar.js',import.meta.url);
const source=existsSync(path)?readFileSync(path,'utf8'):'';
const sac=readFileSync(new URL('../scripts/sac-signups.js',import.meta.url),'utf8');
const now=Date.parse('2030-10-01T08:00:00Z');
const meeting={id:'meeting',title:'Planning, roles; next steps',location:'Room 12',startsAt:'2030-10-28T11:00:00Z',endsAt:'2030-10-28T12:00:00Z',response:'attending',attendees:[{name:'Private Member',email:'private@example.test'}]};
function harness(){
  const downloads=[];let workspace='media';
  const context=vm.createContext({
    Date:class extends Date{static now(){return now;}},TextEncoder,Blob,
    URL:class extends URL{static createObjectURL(blob){downloads.push(blob);return 'blob:test';}static revokeObjectURL(){}},setTimeout(){},
    window:{CREW_CENTER_AUTH_USER:{id:'account-a',email:'me@example.test'},location:{origin:'https://fismediaclub.org'}},
    document:{getElementById:()=>({addEventListener(){}}),addEventListener(){},createElement:()=>({click(){},remove(){}}),body:{append(){}}},
    state:{meetings:[{...meeting}],dataLoaded:{meetings:true},dataErrors:{}},sacMeetingsState:{meetings:[{id:'sac-meeting',title:'Council planning',location:'Gym',starts_at:meeting.startsAt,ends_at:meeting.endsAt}]},
    currentCrewCenterWorkspace:()=>workspace,currentMemberRecord:()=>({id:'me',email:'me@example.test'}),isVisitorSession:()=>false,
    canAccessMediaWorkspace:()=>true,canAccessSacWorkspace:()=>true,canViewMeeting:()=>true,
    ownMeetingResponse:m=>m.response,meetingById:id=>context.state.meetings.find(m=>m.id===id),
    pageUrl:(page,params={})=>'/' + page + '?' + new URLSearchParams(params),showToast(){},
  });
  vm.runInContext(sac,context);vm.runInContext(source,context);
  return{context,downloads,setWorkspace:value=>{workspace=value;}};
}

test('meeting calendar preserves exact instants, private metadata and stable identity',()=>{
  const h=harness();const url='https://fismediaclub.org/meetings?meeting=meeting';
  const raw=h.context.buildMeetingCalendar(meeting,'media','attending',url,now);
  const flat=raw.replace(/\r\n[ \t]/g,'');
  assert.match(flat,/DTSTART:20301028T110000Z\r\nDTEND:20301028T120000Z/);
  assert.match(flat,/STATUS:CONFIRMED/);assert.match(flat,/CLASS:PRIVATE/);
  assert.match(flat,/UID:media-meeting%3Ameeting@fismediaclub.org/);
  assert.match(flat,/URL:https:\/\/fismediaclub.org\/meetings\?meeting=meeting/);
  assert.doesNotMatch(flat,/Private Member|private@example|ATTENDEE:|ORGANIZER:/);
  assert.match(flat,/does not change your RSVP/);
  assert.match(h.context.buildMeetingCalendar(meeting,'media','maybe',url,now),/STATUS:TENTATIVE/);
  assert.match(h.context.buildMeetingCalendar(meeting,'media','',url,now),/STATUS:TENTATIVE/);
});

test('calendar rejects declined, ended or invalid meetings and safely folds Unicode text',()=>{
  const h=harness();const url='https://fismediaclub.org/meetings';
  assert.equal(h.context.buildMeetingCalendar(meeting,'media','declined',url,now),'');
  assert.equal(h.context.buildMeetingCalendar({...meeting,endsAt:new Date(now).toISOString()},'media','attending',url,now),'');
  assert.equal(h.context.buildMeetingCalendar({...meeting,endsAt:'invalid'},'media','attending',url,now),'');
  assert.equal(h.context.buildMeetingCalendar(meeting,'media','attending','javascript:alert(1)',now),'');
  const raw=h.context.buildMeetingCalendar({...meeting,title:'東京 🏀 '.repeat(30)+'\nATTENDEE:bad'},'media','attending',url,now);
  for(const line of raw.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
  assert.doesNotMatch(raw,/\r\nATTENDEE:/);
});

test('SAC calendar has no RSVP assumption and explicitly leaves attendance separate',()=>{
  const h=harness();const raw=h.context.buildMeetingCalendar(h.context.sacMeetingsState.meetings[0],'sac','','https://sac.fismediaclub.org/sac/meetings?meeting=sac-meeting',now);
  const flat=raw.replace(/\r\n[ \t]/g,'');
  assert.match(flat,/SAC meeting/);assert.match(flat,/does not record attendance/);assert.match(flat,/STATUS:CONFIRMED/);
});

test('downloads recheck audience, data availability, account identity and active workspace',()=>{
  const h=harness();h.context.downloadMeetingCalendar('media','meeting');assert.equal(h.downloads.length,1);
  h.context.canViewMeeting=()=>false;h.context.downloadMeetingCalendar('media','meeting');
  h.context.canViewMeeting=()=>true;h.context.state.dataErrors.meetings='unavailable';h.context.downloadMeetingCalendar('media','meeting');
  h.context.state.dataErrors={};h.context.window.CREW_CENTER_AUTH_USER={id:'account-b',email:'other@example.test'};h.context.downloadMeetingCalendar('media','meeting');
  h.context.window.CREW_CENTER_AUTH_USER={id:'account-a',email:'me@example.test'};h.setWorkspace('sac');h.context.downloadMeetingCalendar('media','meeting');
  h.context.isVisitorSession=()=>true;h.context.downloadMeetingCalendar('sac','sac-meeting');
  assert.equal(h.downloads.length,1);
});

test('an eligible SAC preview member can add a meeting without claiming a signup or recording attendance',async()=>{
  const h=harness();h.setWorkspace('sac');h.context.downloadMeetingCalendar('sac','sac-meeting');
  assert.equal(h.downloads.length,1);assert.match(await h.downloads[0].text(),/SAC meeting/);
  h.context.canAccessSacWorkspace=()=>false;h.context.downloadMeetingCalendar('sac','sac-meeting');assert.equal(h.downloads.length,1);
});
