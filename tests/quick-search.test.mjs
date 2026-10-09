import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const path = new URL('../scripts/quick-search.js', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
function harness() {
  let workspace='media'; const reads=[]; const pending=[];
  const context=vm.createContext({
    window:{CREW_CENTER_AUTH_USER:{id:'account-a'},CREW_CENTER_AUTH_EPOCH:1},
    state:{events:[{id:'event',title:'Basketball finals',loc:'Sports hall'}],meetings:[{id:'meeting',title:'News planning',audience:'news_team',startsAt:'2030-10-28T11:00Z',endsAt:'2030-10-28T12:00Z'}],equipment:[{id:'camera',name:'Canon R6',category:'Camera',detail:'Photo kit'}],dataLoaded:{events:true,meetings:true,equipment:true},dataErrors:{}},
    sidebarCategories:{main:{label:'Main',pages:['home','events','meetings','admin']}},pageTitles:{home:'Dashboard',events:'Events',meetings:'Meetings',admin:'Admin Panel',profile:'Settings','sac-home':'SAC Dashboard','sac-events':'SAC Events','sac-meetings':'SAC Meetings','sac-signups':'SAC Sign-up Sheets'},
    currentCrewCenterWorkspace:()=>workspace,canAccessMediaWorkspace:()=>true,canAccessSacWorkspace:()=>true,canCreateSacEvents:()=>false,
    currentMemberRecord:()=>({id:'me'}),canAccessAdminPanel:()=>false,
    canViewMeeting:meeting=>meeting.audience==='general',isVisitorSession:()=>false,sidebarPageAvailable:page=>page!=='admin',
    isPastEvent:()=>false,meetingIsPast:()=>false,pageUrl:(page,params={})=>'/' + page + '?' + new URLSearchParams(params),
    sacSignupUrl:id=>'/sac/signups?event='+id,sacEventUrl:id=>'/sac/events?event='+id,formatBerlinDateTime:()=> '28 Oct',escapeHtml:String,
    document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null},
    supabaseClient:{from(table){reads.push(table);const q={select(){return q;},gt(){return q;},order(){return new Promise(resolve=>pending.push(resolve));}};return q;}},
  });
  vm.runInContext(source,context);
  return {context,reads,pending,setWorkspace:value=>{workspace=value;},run:code=>vm.runInContext(code,context)};
}

test('quick search finds event and equipment records, not only page names',()=>{
  const h=harness();
  assert.equal(h.context.crewQuickSearchEntries('basketball')[0].kind,'event');
  assert.match(h.context.crewQuickSearchEntries('canon photo')[0].url,/camera/);
  assert.equal(h.context.crewQuickSearchEntries('CANON')[0].title,'Canon R6');
  assert.equal(h.context.crewQuickSearchEntries('missing').length,0);
});

test('search hides unavailable pages, restricted meetings and archived records',()=>{
  const h=harness();
  assert.equal(h.context.crewQuickSearchEntries('admin').length,0);
  assert.equal(h.context.crewQuickSearchEntries('news planning').length,0);
  h.context.state.meetings[0].audience='general';
  assert.equal(h.context.crewQuickSearchEntries('news planning').length,1);
  h.context.state.meetings[0].archivedAt='2030-10-01';
  h.context.state.events[0].archivedAt='2030-10-01';
  h.context.state.equipment[0].archivedAt='2030-10-01';
  assert.equal(h.context.crewQuickSearchEntries('news planning').length,0);
  assert.equal(h.context.crewQuickSearchEntries('basketball').length,0);
  assert.equal(h.context.crewQuickSearchEntries('canon').length,0);
});

test('SAC search uses SAC pages and does not read signups or include Media records',async()=>{
  const h=harness(); h.setWorkspace('sac');
  const request=h.context.refreshCrewQuickSearch();
  assert.deepEqual(h.reads,['sac_events','sac_meetings']);
  h.pending[0]({data:[{id:'sac-event',title:'Warriors final',starts_at:'2030-10-28T11:00Z',ends_at:'2030-10-28T12:00Z'}],error:null});
  h.pending[1]({data:[],error:null}); await request;
  assert.equal(h.context.crewQuickSearchEntries('warriors')[0].kind,'event');
  assert.equal(h.context.crewQuickSearchEntries('canon').length,0);
  assert.equal(h.context.crewQuickSearchEntries('basketball').length,0);
  assert.equal(h.context.crewQuickSearchEntries('attendance').length,0);
});

test('delayed SAC results cannot cross account or workspace boundaries',async()=>{
  for(const change of [h=>h.setWorkspace('media'),h=>{h.context.window.CREW_CENTER_AUTH_EPOCH=2;}]){
    const h=harness(); h.setWorkspace('sac'); const request=h.context.refreshCrewQuickSearch(); change(h);
    for(const resolve of h.pending)resolve({data:[{id:'private',title:'Previous session',ends_at:'2030-10-28T12:00Z'}],error:null});
    await request;h.setWorkspace('sac');
    assert.equal(h.context.crewQuickSearchEntries('Previous session').length,0);
  }
});

test('signed-out or ineligible accounts get no records and make no SAC reads',async()=>{
  const h=harness();h.setWorkspace('sac');h.context.canAccessSacWorkspace=()=>false;
  await h.context.refreshCrewQuickSearch();assert.equal(h.reads.length,0);
  assert.equal(h.context.crewQuickSearchEntries('events').length,0);
  h.context.window.CREW_CENTER_AUTH_USER=null;
  assert.equal(h.context.crewQuickSearchEntries('events').length,0);
});

test('a stale linked member cannot expose the previous account records during sign-in',()=>{
  const h=harness();
  h.context.window.CREW_CENTER_AUTH_USER={id:'account-b',email:'new@example.test'};
  h.context.currentMemberRecord=()=>({id:'old',email:'old@example.test'});
  assert.equal(h.context.crewQuickSearchEntries('basketball').length,0);
  assert.equal(h.context.crewQuickSearchEntries('canon').length,0);
});
