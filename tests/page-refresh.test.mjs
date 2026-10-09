import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const core = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const batch = core.slice(core.indexOf('async function loadCrewCenterDatasetBatch('), core.indexOf('\nasync function loadCrewCenterData('));
const render = core.slice(core.indexOf('function renderCurrentPage('), core.indexOf('\nconst sidebarCategories'));

function harness(page = 'signup', request = async () => ({ data: [], error: null })) {
  const renders = []; const applied = [];
  const context = vm.createContext({
    window: { CREW_CENTER_AUTH_EPOCH: 1 }, Date, console: { error() {} },
    state: { dataErrors: {}, dataLoaded: {}, dataUpdatedAt: {} },
    document: { querySelector: () => ({ id: `page-${page}` }) },
    isVisitorSession: () => false, withCrewCenterDataTimeout: operation => operation,
    crewCenterDatasetRequest: request,
    applyCrewCenterDataset: (dataset, rows) => applied.push({ dataset, rows }),
    datasetLabels: {}, pageFromPath: () => page,
    updateAdminPendingIndicator() {}, applySidebarPreferences() {}, renderNotificationCenter() {},
    renderGalleryAuthorField() {}, renderDatasetErrors() {}, scheduleEventVisibilityRefresh() {}, showToast() {},
  });
  for (const name of ['initSignupSheet', 'renderMyCrewSchedule', 'renderDashboard', 'renderSacSignups']) {
    context[name] = () => renders.push(name);
  }
  vm.runInContext(batch + '\n' + render, context);
  return { context, renders, applied };
}

test('unrelated background data updates without rebuilding booking controls', async () => {
  for (const page of ['signup', 'my-crew-schedule']) {
    const h = harness(page);
    await h.context.loadCrewCenterDatasetBatch(['notifications', 'gallery', 'announcements'], true);
    assert.equal(h.applied.length, 3);
    assert.equal(h.context.state.dataLoaded.notifications, true);
    assert.deepEqual(h.renders, [], `${page} should retain its focused controls`);
  }
});

test('event, equipment and member updates still refresh availability and account access', async () => {
  for (const page of ['signup', 'my-crew-schedule']) {
    for (const dataset of ['events', 'equipment', 'members']) {
      const h = harness(page);
      await h.context.loadCrewCenterDatasetBatch([dataset], true);
      assert.equal(h.renders.length, 1);
    }
    const failed = harness(page, async () => ({ error: { message: 'fixture failure' } }));
    await failed.context.loadCrewCenterDatasetBatch(['events'], true);
    assert.ok(failed.context.state.dataErrors.events);
    assert.equal(failed.renders.length, 1, 'Relevant load failures must still reach the page');
  }
});

test('explicit renders and other pages retain their existing refresh behavior', async () => {
  const signup = harness(); signup.context.renderCurrentPage();
  assert.deepEqual(signup.renders, ['initSignupSheet']);
  for (const [page, expected] of [['home', 'renderDashboard'], ['sac-signups', 'renderSacSignups']]) {
    const h = harness(page);
    await h.context.loadCrewCenterDatasetBatch(['notifications'], true);
    assert.deepEqual(h.renders, [expected]);
  }
});

test('a previous authentication session cannot apply an in-flight data refresh', async () => {
  let finish;
  const h = harness('signup', () => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.loadCrewCenterDatasetBatch(['events'], true);
  h.context.window.CREW_CENTER_AUTH_EPOCH = 2;
  finish({ data: [{ id: 'previous-session-event' }], error: null });
  await pending;
  assert.deepEqual(h.applied, []);
  assert.deepEqual(h.renders, []);
});
