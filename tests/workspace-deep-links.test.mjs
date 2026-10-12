import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const router = readFileSync(new URL('../scripts/router.js', import.meta.url), 'utf8');
const workspaces = readFileSync(new URL('../scripts/workspaces.js', import.meta.url), 'utf8');

function harness(url, options = {}) {
  const replacements = [], navigations = [];
  const context = vm.createContext({
    URL, URLSearchParams,
    window: { location: new URL(url), CREW_CENTER_AUTH_USER: { id: 'test-account' } },
    document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
    canAccessAdminPanel: () => false, canCreateSacEvents: () => Boolean(options.sacLeader),
    isVisitorSession: () => Boolean(options.visitor),
    currentMemberRecord: () => ({ gradeLevel: options.grade || 'Grade 11', role: 'Member', teamKeys: options.teams || ['media_club', 'sac'] }),
    showToast() {},
    history: { replaceState(_state, _title, destination) {
      replacements.push(destination); context.window.location = new URL(destination, context.window.location);
    } },
  });
  vm.runInContext(router.slice(0, router.indexOf('function navigate(')), context);
  vm.runInContext(workspaces, context);
  context.applyWorkspacePresentation = () => {};
  context.navigate = (page, _item, routeOptions) => navigations.push({ page, routeOptions, tab: context.tabValueFromUrl(['profile', 'appearance', 'personalisation', 'dashboard', 'sidebar', 'notifications', 'tutorials'], 'profile') });
  return { context, replacements, navigations, location: () => context.window.location };
}

test('member startup preserves every Settings tab instead of replacing its link with plain /profile', () => {
  for (const tab of ['profile', 'appearance', 'personalisation', 'dashboard', 'sidebar', 'notifications', 'tutorials']) {
    const h = harness(`https://fismediaclub.org/profile?tab=${tab}`);
    h.context.initializeCrewCenterWorkspace();
    assert.equal(h.location().search, `?tab=${tab}`);
    assert.equal(h.navigations[0].page, 'profile'); assert.equal(h.navigations[0].tab, tab);
    assert.deepEqual(h.replacements, [], 'An already canonical link needs no rewrite');
  }
});

test('member startup retains record, filter, time-window and fragment details on allowed pages', () => {
  for (const url of [
    'https://fismediaclub.org/signups?event=event-1&role=Photographer&start=15%3A00&end=16%3A00',
    'https://fismediaclub.org/gallery?tab=photo&view=athletics#project-1',
    'https://fismediaclub.org/equipment?event=event-1&start=15%3A00&end=16%3A00',
    'https://sac.fismediaclub.org/sac/signups?event=game-1#shift-1',
    'https://sac.fismediaclub.org/sac/attendance?kind=meeting&item=meeting-1',
    'https://sac.fismediaclub.org/profile?tab=appearance',
  ]) {
    const h = harness(url, { sacLeader: true }); h.context.initializeCrewCenterWorkspace();
    assert.equal(h.location().href, url);
    assert.deepEqual(h.replacements, []);
    assert.equal(h.navigations[0].routeOptions.skipUrl, true);
  }
});

test('workspace canonicalization changes its marker without losing a shared Settings tab or fragment', () => {
  const h = harness('https://fismediaclub.org/profile?tab=notifications&workspace=media#preferences');
  h.context.initializeCrewCenterWorkspace();
  assert.equal(h.location().href, 'https://fismediaclub.org/profile?tab=notifications#preferences');
  const sacOnly = harness('https://fismediaclub.org/profile?tab=appearance#theme', { teams: ['sac'] });
  sacOnly.context.initializeCrewCenterWorkspace();
  assert.equal(sacOnly.location().href, 'https://fismediaclub.org/profile?tab=appearance&workspace=sac#theme');
});

test('unauthorized workspace pages still fall back without carrying private record parameters', () => {
  for (const options of [{ visitor: true }, { grade: 'Grade 8', teams: ['media_club'] }]) {
    const h = harness('https://sac.fismediaclub.org/sac/signups?event=private-event#private-shift', options);
    h.context.initializeCrewCenterWorkspace();
    assert.equal(h.location().href, 'https://sac.fismediaclub.org/dashboard?workspace=media');
    assert.equal(h.navigations[0].page, 'home');
  }
  const sacOnly = harness('https://fismediaclub.org/events?event=media-only#crew', { teams: ['sac'] });
  sacOnly.context.initializeCrewCenterWorkspace();
  assert.equal(sacOnly.location().href, 'https://fismediaclub.org/dashboard?workspace=sac');
  assert.equal(sacOnly.navigations[0].page, 'sac-home');
});

test('the root route remains canonical while keeping its query and fragment', () => {
  const h = harness('https://fismediaclub.org/?workspace=media#next-up');
  h.context.initializeCrewCenterWorkspace();
  assert.equal(h.location().href, 'https://fismediaclub.org/dashboard#next-up');
});
