import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const source = read('scripts/personal-week.js');
const core = read('scripts/core.js');
const now = Date.parse('2030-10-01T08:00:00Z');
const assignment = { id:'a', member_id:'me', event_id:'media-event', signup_role:'Photographer',
  attendance_start:'2030-10-01T10:00:00Z', attendance_end:'2030-10-01T11:00:00Z', confirmation_status:'confirmed', events:{ title:'Media <match>', location:'Court 1' } };
const shift = { id:'s', member_id:'me', event_id:'sac-event', spot_number:1,
  slot_start:'2030-10-01T10:30:00Z', slot_end:'2030-10-01T11:30:00Z', sac_events:{ title:'Scoreboard', location:'Court 1' } };

function harness(teams = ['media_club','sac']) {
  let member = { id:'me', email:'me@example.test', teamKeys:teams }; let actor = 'account:1:me';
  const nodes = new Map(); const calls = []; const modals = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML:'', textContent:'', hidden:false, disabled:false, classList:{ contains: () => modals.includes(id) } });
    return nodes.get(id);
  };
  let respond = table => ({ data: table === 'signups' ? [assignment] : table === 'sac_slot_signups' ? [shift] : [], error:null });
  const context = vm.createContext({
    Date: class extends Date { static now() { return now; } }, Intl, URL,
    BERLIN_TIME_ZONE:'Europe/Berlin', berlinPartsFormatter:new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }),
    window:{ location:{ origin:'https://fismediaclub.org', hostname:'fismediaclub.org' } },
    document:{ getElementById:node, querySelectorAll: () => [], addEventListener() {} },
    notificationReadActor: () => actor, currentMemberRecord: () => member,
    escapeHtml: value => String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    pageUrl:(page,params) => `/${page}?${new URLSearchParams(params)}`, workspaceSearchForSelection:(_workspace,_hostname,search) => search,
    formatBerlinDateTime:(value,options = {}) => new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Berlin',...options}).format(new Date(value)),
    openModal:id => modals.push(id), closeModal() {}, closeNotificationPanel() {},
    withCrewCenterDataTimeout: operation => operation,
    supabaseClient:{ from:table => {
      const filters=[]; const q={ select:columns => { calls.push({ table,columns,filters }); return q; }, eq:(key,value) => { filters.push([key,value]); return q; }, in:() => q, gt:() => q, is:() => q,
        then:(resolve,reject) => Promise.resolve().then(() => respond(table)).then(resolve,reject) };
      return q;
    } },
  });
  vm.runInContext(core.slice(core.indexOf('function berlinParts('), core.indexOf('function timeValue(')), context);
  vm.runInContext(source, context);
  return { context,node,calls,modals,respond:value => { respond=value; }, actor:value => { actor=value; }, member:value => { member=value; } };
}

test('personal week uses only own member filters and fetches only clubs the member belongs to', async () => {
  for (const teams of [['media_club'],['sac'],['media_club','sac']]) {
    const h=harness(teams); assert.equal(await h.context.loadPersonalWeek(), true);
    for (const call of h.calls.filter(call => call.table !== 'sac_meetings')) assert.deepEqual(call.filters[0], ['member_id','me']);
    assert.equal(h.calls.some(call => call.table === 'signups'), teams.includes('media_club'));
    assert.equal(h.calls.some(call => call.table === 'sac_slot_signups'), teams.includes('sac'));
    assert.ok(h.calls.every(call => !call.columns.includes('email') && !call.columns.includes('snapshot')));
  }
  const h=harness([]); assert.equal(await h.context.loadPersonalWeek(), false); assert.equal(h.calls.length,0);
});

test('personal overview excludes foreign, cancelled, archived, declined and ended records', () => {
  const h=harness();
  for (const row of [{...assignment,member_id:'other'}, {...assignment,confirmation_status:'expired'}, {...assignment,events:{archived_at:'2030-01-01'}}, {...assignment,attendance_end:'2030-10-01T07:00:00Z'}]) {
    assert.equal(h.context.normalizePersonalItems('assignment',[row],'me',now).length,0);
  }
  assert.equal(h.context.normalizePersonalItems('shift',[{...shift,cancelled_at:'2030-10-01'}],'me',now).length,0);
  assert.equal(h.context.normalizePersonalItems('meeting',[{member_id:'me',response:'declined',meetings:{}}],'me',now).length,0);
  assert.equal(h.context.normalizePersonalItems('shift',[shift],'me',now)[0].workspace,'sac');
});

test('cross-club and meeting overlaps are shown, adjacent times and equipment loans are not conflicts', async () => {
  const h=harness(); await h.context.loadPersonalWeek();
  const start=Date.parse(shift.slot_start); const end=Date.parse(shift.slot_end);
  const found=h.context.personalConflicts(start,end,'shift:s');
  assert.deepEqual(Array.from(found,item => item.id), ['assignment:a']);
  assert.equal(h.context.personalConflicts(Date.parse('2030-10-01T11:30:00Z'), Date.parse('2030-10-01T12:00:00Z')).length,0);
  vm.runInContext("personalWeek.items.push({id:'equipment:loan',kind:'equipment',title:'Loan',start:Date.parse('2030-10-01T08:00:00Z'),end:Date.parse('2030-10-02T12:00:00Z')})", h.context);
  assert.equal(h.context.personalConflicts(Date.parse('2030-10-01T12:00:00Z'), Date.parse('2030-10-01T13:00:00Z')).length,0);
  vm.runInContext("personalWeek.items.push({id:'meeting:briefing',kind:'meeting',title:'Briefing',start:Date.parse('2030-10-01T12:00:00Z'),end:Date.parse('2030-10-01T12:30:00Z')})",h.context);
  assert.deepEqual(Array.from(h.context.personalConflicts(Date.parse('2030-10-01T12:15:00Z'),Date.parse('2030-10-01T13:00:00Z')),item=>item.id),['meeting:briefing']);
  assert.match(h.context.personalConflictHtml(start,end,'me','shift:s'), /Media &lt;match&gt;/);
  assert.equal(h.context.personalConflictHtml(start,end,'other'), '');
});

test('date stepping and midnight bounds stay correct through Berlin daylight saving changes', () => {
  const h=harness();
  assert.equal(h.context.personalDateOffset('2030-03-30',1),'2030-03-31');
  assert.equal(h.context.personalDateOffset('2030-10-27',1),'2030-10-28');
  assert.equal(h.context.personalWeekMonday(Date.parse('2030-10-27T23:15:00Z')),'2030-10-28');
  assert.equal((h.context.berlinTimestamp('2030-04-01','00:00') - h.context.berlinTimestamp('2030-03-31','00:00')) / 3600000,23);
  assert.equal((h.context.berlinTimestamp('2030-10-28','00:00') - h.context.berlinTimestamp('2030-10-27','00:00')) / 3600000,25);
});

test('week loads coalesce duplicate requests and discard data after an account or membership change', async () => {
  const h=harness(); let finish;
  const sharedResponse=new Promise(resolve => { finish=resolve; }); h.respond(() => sharedResponse);
  const one=h.context.loadPersonalWeek(); const two=h.context.loadPersonalWeek();
  await new Promise(resolve => setTimeout(resolve,0));
  h.actor('another:2:member');
  h.context.resetPersonalWeek(); finish({data:[assignment],error:null});
  assert.equal(await one,false); assert.equal(await two,false); assert.equal(h.calls.length,4);
  assert.equal(vm.runInContext('personalWeek.items.length',h.context),0);
  const next=harness(['sac']); let settle;
  const pendingResponse=new Promise(resolve => { settle=resolve; }); next.respond(() => pendingResponse);
  const pending=next.context.loadPersonalWeek(); const duplicate=next.context.loadPersonalWeek();
  await new Promise(resolve => setTimeout(resolve,0));
  next.member({id:'me',email:'me@example.test',teamKeys:[]}); settle({data:[shift],error:null});
  assert.equal(await pending,false); assert.equal(await duplicate,false);
  assert.equal(vm.runInContext('personalWeek.items.length',next.context),0);
  assert.equal(next.calls.length,2);
});

test('partial load failures keep available bookings visible and explicitly label incomplete data', async () => {
  const h=harness(); h.respond(table => table === 'sac_slot_signups' ? {error:{message:'Offline'}} : {data:table === 'signups' ? [assignment] : [],error:null});
  await h.context.openPersonalWeek();
  assert.match(h.node('personal-week-days').innerHTML, /Media &lt;match&gt;/);
  assert.match(h.node('personal-week-status').textContent, /SAC shifts could not load/);
  assert.equal(h.node('personal-week-retry').hidden,false);
  assert.match(h.context.personalConflictHtml(Date.parse('2030-10-02T12:00:00Z'),Date.parse('2030-10-02T13:00:00Z'),'me'), /could not be checked/);
});

test('weekly overview is optional and accessible from both dashboards and existing schedule pages', () => {
  const html=read('index.html');
  assert.equal((html.match(/data-personal-week-open hidden/g) || []).length,4);
  assert.match(html,/id="personal-week-modal" role="dialog" aria-labelledby="personal-week-title"/);
  assert.match(read('scripts/workspaces.js'), /window.resetPersonalWeek\?\.\(\)/);
});
