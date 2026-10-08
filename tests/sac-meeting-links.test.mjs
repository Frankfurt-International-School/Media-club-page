import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/sac-meetings.js', import.meta.url), 'utf8');
function harness({ id = 'past', access = true } = {}) {
  const frames = []; let workspace = 'sac'; let active = true; let queries = 0; let focused = 0; let scrolled = 0;
  const card = { focus() { focused++; }, scrollIntoView() { scrolled++; } };
  const context = vm.createContext({
    window: { location: { search: `?meeting=${id}` }, matchMedia: () => ({ matches: true }) },
    document: { getElementById: value => value === 'sac-meetings-list' ? { innerHTML: '', addEventListener() {} } : value === 'sac-meeting-past' ? card : value === 'page-sac-meetings' ? { classList: { contains: () => active } } : null, addEventListener() {} },
    URLSearchParams, currentCrewCenterWorkspace: () => workspace, canAccessSacWorkspace: () => access,
    requestAnimationFrame: callback => frames.push(callback),
    supabaseClient: { from() { queries++; return { select() { return { order: async () => ({ data: [{ id: 'past', ends_at: '2000-01-01T13:00:00Z' }], error: null }) }; } }; } },
  });
  vm.runInContext(source, context);
  context.paintSacMeetings = () => {};
  return { context, frames, workspace(value) { workspace = value; }, active(value) { active = value; }, counts: () => ({ queries, focused, scrolled }) };
}

test('a past SAC meeting deep link reveals and focuses the requested meeting', async () => {
  const h = harness(); await h.context.renderSacMeetings();
  assert.equal(vm.runInContext('sacMeetingsState.showPast', h.context), true);
  assert.equal(h.frames.length, 1); h.frames[0]();
  assert.deepEqual(h.counts(), { queries: 1, focused: 1, scrolled: 1 });
});

test('meeting focus is cancelled when the workspace or requested meeting changes', async () => {
  const h = harness(); await h.context.renderSacMeetings();
  h.workspace('media'); h.frames.forEach(callback => callback());
  assert.equal(h.counts().focused, 0);
  const changed = harness(); await changed.context.renderSacMeetings();
  changed.context.window.location.search = '?meeting=another';
  changed.frames.forEach(callback => callback());
  assert.equal(changed.counts().focused, 0);
  const hidden = harness(); await hidden.context.renderSacMeetings();
  hidden.active(false); hidden.frames.forEach(callback => callback());
  assert.equal(hidden.counts().focused, 0);
});

test('unknown meeting links keep the current list and denied access makes no query', async () => {
  const unknown = harness({ id: 'unknown' }); await unknown.context.renderSacMeetings();
  assert.equal(unknown.frames.length, 0);
  assert.equal(vm.runInContext('sacMeetingsState.showPast', unknown.context), false);
  const denied = harness({ access: false }); await denied.context.renderSacMeetings();
  assert.equal(denied.counts().queries, 0);
});
