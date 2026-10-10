import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const script = read('scripts/announcements.js');
const core = read('scripts/core.js');
const normalize = core.slice(core.indexOf('function normalizeAnnouncement('), core.indexOf('function normalizeApplication('));

function harness() {
  const elements = new Map(); const notices = []; const calls = []; const intervals = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent:'', innerHTML:'', value:'', checked:false, hidden:false, disabled:false, options:[], attrs:{},
      classList:{contains:()=>false}, addEventListener(){}, focus(){}, setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];} });
    return elements.get(id);
  };
  element('ann-audience').value = 'media_club';
  let member = {id:'member-a',email:'a@example.test',teamKeys:['media_club','sac']};
  let result = () => ({data:{id:'ann-a',title:'Shifts open',body:'Choose a shift.\nMeet at court 2.',audience:'sac',created_at:'2026-10-10T14:00:00Z',action_label:'Choose a shift',action_url:'/sac/signups'},error:null});
  let rpcResult = () => ({data:true,error:null}); let admin = false; let visitor = false;
  const context = vm.createContext({
    window:{CREW_CENTER_AUTH_USER:{id:'user-a',email:member.email},CREW_CENTER_AUTH_EPOCH:1,location:{origin:'https://fismediaclub.org',hostname:'fismediaclub.org'}},
    document:{getElementById:element,addEventListener(){}}, URL, Date, setInterval:fn=>intervals.push(fn),
    state:{announcements:[],notifications:[{id:'notice-a',member_id:'member-a',notification_type:'announcement',related_announcement_id:'ann-a',read_at:null}],dataLoaded:{announcements:true},dataErrors:{}},
    currentMemberRecord:()=>member,currentCrewCenterWorkspace:()=> 'sac',isVisitorSession:()=>visitor,canAccessAdminPanel:()=>admin,
    escapeHtml:value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    formatBerlinDateTime:()=> '11 Oct',berlinTimestamp:(date,time)=>date&&time ? Date.parse(`${date}T${time}Z`) : null,
    berlinDateKey:value=>new Date(value).toISOString().slice(0,10),berlinTimeLabel:value=>new Date(value).toISOString().slice(11,16),
    workspaceSearchForSelection:workspace=>workspace==='sac'?'?workspace=sac':'',
    supabaseClient:{from:()=>{
      let operation='read';let payload;const query={select(){return query;},eq(){return query;},insert(value){operation='insert';payload=value;return query;},update(value){operation='update';payload=value;return query;},delete(){operation='delete';return query;},single(){calls.push({operation,payload});return result();}};return query;
    },rpc:(name,args)=>{calls.push({rpc:name,args});return rpcResult();}},
    withCrewCenterDataTimeout:operation=>operation,renderNotificationCenter(){},renderDashboard(){},loadCrewCenterData:async()=>{},
    closeNotificationPanel(){},openModal:()=>{element('announcement-reader-modal').open=true;},closeModal:()=>{element('announcement-reader-modal').open=false;context.window.announcementReaderClosed?.();},
    showToast:(...args)=>notices.push(args),openActionConfirmation:options=>{context.confirmation=options;},
  });
  vm.runInContext(normalize+script,context);
  return {context,element,calls,notices,intervals,result:value=>result=value,rpc:value=>rpcResult=value,admin:value=>admin=value,visitor:value=>visitor=value,member:value=>member=value};
}
const post = (id,audience='sac',extra={}) => ({id,title:`Post ${id}`,body:'Full message',audience,date:'11 Oct',created_at:'2026-10-11T00:00:00Z',...extra});

test('feeds enforce real membership, club audience, archive, expiry and pinned order', () => {
  const h=harness();h.context.state.announcements=[post('media','media_club'),post('shared','both'),post('expired','sac',{expires_at:'2000-01-01T00:00:00Z'}),post('archived','sac',{archived_at:'2026-10-10'}),post('pin','sac',{pinned:true})];
  assert.deepEqual(Array.from(h.context.activeAnnouncements('sac'),item=>item.id),['pin','shared']);
  h.member({id:'member-a',email:'a@example.test',teamKeys:['media_club'],gradeLevel:'Grade 11'});
  assert.deepEqual(Array.from(h.context.activeAnnouncements('sac'),item=>item.id),['shared']);
  h.member({id:'member-a',email:'a@example.test',teamKeys:[],gradeLevel:'Grade 11'});
  assert.equal(h.context.activeAnnouncements('sac').length,0);
  h.admin(true);h.visitor(true);assert.equal(h.context.activeAnnouncements('sac').length,0);
});

test('feed escapes messages, keeps older messages available and pins outside dashboard preferences', () => {
  const h=harness();h.context.state.announcements=[post('a','sac',{title:'<script>unsafe</script>',pinned:true}),...['b','c','d','e'].map(id=>post(id))];
  const html=h.context.announcementFeedHtml('sac');
  assert.match(html,/&lt;script>/);assert.doesNotMatch(html,/<script>/);
  assert.match(html,/<details/);assert.match(html,/View all 5/);assert.match(html,/Post e/);
  h.context.renderAnnouncementSurfaces();
  assert.equal(h.element('sac-pinned-announcement').hidden,false);
  assert.equal(h.element('media-pinned-announcement').hidden,true);
  h.context.state.dataErrors.announcements='Offline';assert.match(h.context.announcementFeedHtml('sac'),/Try again/);
});

test('only safe internal destinations become action buttons and SAC destinations select SAC', () => {
  const h=harness();
  for (const value of ['https://evil.test','//evil.test','javascript:alert(1)','/dashboard#bad','/dashboard\nx','/unknown']) assert.equal(h.context.safeAnnouncementAction(value),'');
  assert.equal(h.context.announcementActionHref({action_url:'/sac/signups'}),'/sac/signups?workspace=sac');
  assert.equal(h.context.announcementActionHref({action_url:'/events'}),'/events');
  assert.equal(h.context.announcementActionHref({action_url:'/signups',audience:'both'}),'/sac/signups?workspace=sac');
  h.context.currentCrewCenterWorkspace=()=> 'media';
  assert.equal(h.context.announcementActionHref({action_url:'/sac/signups',audience:'both'}),'/signups');
});

test('reader loads the complete message and persists only its notice read state', async () => {
  const h=harness();h.context.state.notifications.push({id:'other',member_id:'member-a',related_announcement_id:'ann-b',read_at:null});
  await h.context.openAnnouncement('ann-a');
  assert.equal(h.element('announcement-reader-message').textContent,'Choose a shift.\nMeet at court 2.');
  assert.equal(h.element('announcement-reader-action').attrs.href,'/sac/signups?workspace=sac');
  assert.ok(h.context.state.notifications[0].read_at);assert.equal(h.context.state.notifications[1].read_at,null);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.find(call=>call.rpc))),{rpc:'mark_announcement_read',args:{p_announcement_id:'ann-a'}});
});

test('offline read acknowledgement preserves unread status while showing the opened message', async () => {
  const h=harness();h.rpc(()=>({error:{message:'Offline'}}));
  await h.context.openAnnouncement('ann-a');
  assert.equal(h.context.state.notifications[0].read_at,null);assert.match(h.element('announcement-reader-status').textContent,/Could not save/);
  assert.match(h.element('announcement-reader-message').textContent,/Choose a shift/);
});

test('an unavailable message is not acknowledged or shown from a stale cache', async () => {
  const h=harness();h.result(()=>({data:null,error:{message:'Not found'}}));
  await h.context.openAnnouncement('ann-a');
  assert.equal(h.calls.filter(call=>call.rpc).length,0);assert.equal(h.element('announcement-reader-message').textContent,'');
  assert.match(h.element('announcement-reader-status').textContent,/unavailable/);
});

test('account changes, a closed reader and a newer preview discard delayed private messages', async () => {
  for (const change of [h=>{h.context.window.CREW_CENTER_AUTH_EPOCH++;},h=>h.context.window.announcementReaderClosed(),h=>{h.admin(true);h.element('ann-title').value='Preview';h.element('ann-body').value='Draft';h.context.previewAnnouncement();}]) {
    const h=harness();let finish;const data={...post('ann-a'),title:'Previous private message'};
    h.result(()=>new Promise(resolve=>{finish=resolve;}));const pending=h.context.openAnnouncement('ann-a');change(h);
    finish({data,error:null});await pending;
    assert.notEqual(h.element('announcement-reader-title').textContent,'Previous private message');
    assert.equal(h.calls.filter(call=>call.rpc).length,0);
  }
});

test('publishing validates input, suppresses duplicate submissions and retains drafts after failures', async () => {
  const h=harness();h.admin(true);h.element('ann-title').value='Draft';h.element('ann-body').value='Message';
  let finish;h.result(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=h.context.postAnnouncement();await h.context.postAnnouncement();assert.equal(h.calls.length,1);assert.equal(h.element('ann-submit').disabled,true);
  finish({data:null,error:{message:'Offline'}});await pending;
  assert.equal(h.element('ann-title').value,'Draft');assert.equal(h.element('ann-submit').disabled,false);
  h.element('ann-title').value='';await h.context.postAnnouncement();assert.equal(h.calls.length,1);
  h.element('ann-title').value='Draft';h.element('ann-expires').value='2000-01-01T10:00';await h.context.postAnnouncement();assert.equal(h.calls.length,1);
});

test('ordinary members and visitors cannot preview, publish, edit, archive or delete', async () => {
  const h=harness();h.context.state.announcements=[post('ann-a')];
  for (const change of [()=>h.admin(false),()=>{h.admin(true);h.visitor(true);}]) {
    change();h.context.previewAnnouncement();h.context.editAnnouncement('ann-a');h.context.requestArchiveAnnouncement('ann-a');h.context.requestDeleteAnnouncement('ann-a');await h.context.postAnnouncement();
    assert.equal(h.calls.length,0);assert.equal(h.context.confirmation,undefined);
  }
});

test('expiry hides cached notices from the bell and reset clears drafts and pending reader work', () => {
  const h=harness();h.context.state.announcements=[post('ann-a','sac',{expires_at:'2000-01-01T00:00:00Z'})];
  assert.equal(h.context.window.announcementNotificationVisible(h.context.state.notifications[0]),false);
  h.element('ann-title').value='Private draft';h.context.window.resetAnnouncementState();
  assert.equal(h.context.state.announcements.length,0);assert.equal(h.element('ann-title').value,'');assert.equal(h.element('announcement-reader-message').textContent,'');
});
