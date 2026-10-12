import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const core = read('scripts/core.js');
const now = Date.parse('2030-10-01T08:00:00Z');
const mediaEvents = [
  { id: 'later', title: 'Basketball coverage', date: '2030-10-14', time: '17:00', endTime: '18:00', loc: 'Sports hall', cat: 'Livestream', signups: [] },
  { id: 'earlier', title: 'Café interview', date: '2030-10-03', time: '12:00', endTime: '13:00', loc: 'Studio', cat: 'Event', signups: [] },
  { id: 'past', title: 'Basketball practice', date: '2030-09-14', time: '12:00', endTime: '13:00', loc: 'Sports hall', cat: 'Livestream', signups: [] },
];
const sacEvents = [
  { id: 'upcoming', title: 'Volleyball final', location: 'Sports hall', starts_at: '2030-10-02T22:30:00Z', ends_at: '2030-10-03T00:00:00Z' },
  { id: 'past-sac', title: 'Basketball final', location: 'Gym', starts_at: '2030-09-14T12:00:00Z', ends_at: '2030-09-14T13:00:00Z' },
];

function harness() {
  const nodes = new Map();
  let active = null;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', innerHTML: '', hidden: false, dataset: {}, attributes: {},
      classList: { toggle() {}, contains: () => true }, addEventListener() {},
      setAttribute(key, value) { this.attributes[key] = value; if (key === 'hidden') this.hidden = true; },
      focus() { active = id; }, scrollIntoView() {},
    });
    return nodes.get(id);
  };
  const categories = ['all', 'Livestream', 'Event'].map(category => {
    const button = node(`category-${category}`); button.dataset.eventCategory = category; return button;
  });
  const reads = [], frames = [];
  const context = vm.createContext({
    Date: class extends Date { static now() { return now; } }, Intl, URL, URLSearchParams,
    BERLIN_TIME_ZONE: 'Europe/Berlin',
    window: { location: new URL('http://localhost/sac/events'), CREW_CENTER_AUTH_USER: { id: 'account' }, matchMedia: () => ({ matches: true }) },
    document: { getElementById: node, querySelectorAll: () => categories, querySelector: () => null },
    state: { events: structuredClone(mediaEvents), archivedEvents: [], eventFilter: 'all', showPastEvents: false, dataLoaded: { events: true }, dataErrors: {} },
    berlinDateKey: value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(value)),
    berlinTimeLabel: () => '14:00',
    isPastEvent: event => Date.parse(`${event.date}T${event.endTime}:00Z`) <= now,
    fmtMonth: () => 'OCT', fmtDay: date => date.slice(-2),
    eventScheduleTimeLabel: event => event.time, eventScheduleSegments: () => [],
    eventCategorySupportsRoleSetup: () => false, livestreamSetupCaption: () => '',
    canManageCrewOperations: () => false, canAddMembers: () => false, isVisitorSession: () => true,
    catColor: () => 'red', escapeHtml: value => String(value).replace(/[<>&"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]),
    canCreateSacEvents: () => false, canClaimSacSlot: () => false, canAccessSacWorkspace: () => true, canAccessMediaWorkspace: () => false,
    currentCrewCenterWorkspace: () => 'sac', normalizeWorkspaceHostname: value => value,
    workspaceSearchForSelection: (_workspace, _host, query) => `?${query}`,
    requestAnimationFrame: callback => frames.push(callback), showToast() {},
    supabaseClient: { from(table) { reads.push(table); const query = { select() { return query; }, order: async () => ({ data: structuredClone(sacEvents), error: null }) }; return query; } },
  });
  vm.runInContext(core.slice(core.indexOf('function formatBerlinCalendarDate('), core.indexOf('\nfunction eventEndTimestamp(')), context);
  vm.runInContext(`${read('scripts/events.js')}\n${read('scripts/sac-events.js')}`, context);
  return { context, node, reads, frames, active: () => active, run: code => vm.runInContext(code, context) };
}

test('event search matches words across fields, accents, and familiar date formats in Berlin time', () => {
  const h = harness();
  for (const query of ['cafe studio', '  CAFÉ   interview ', '03.10.2030', '3.10.2030', '03/10/2030', '2030-10-03', '3 October 2030']) {
    assert.equal(h.context.eventMatchesSearch(mediaEvents[1], query), true, query);
  }
  assert.equal(h.context.eventMatchesSearch(sacEvents[0], 'volleyball 03.10.2030'), true, 'SAC start is October 3 in Berlin');
  assert.equal(h.context.eventMatchesSearch(mediaEvents[0], 'basketball studio'), false, 'Every word must match');
  const thirteenth = { ...mediaEvents[1], date: '2030-10-13' };
  for (const query of ['3 October', '3.10.2030', '3/10/2030']) assert.equal(h.context.eventMatchesSearch(thirteenth, query), false, query);
});

test('Media category, search and history combine without showing hidden past events or altering source order', () => {
  const h = harness();
  h.node('events-search').value = 'basketball'; h.context.state.eventFilter = 'Livestream';
  h.context.renderEvents();
  assert.match(h.node('events-list').innerHTML, /media-event-later/);
  assert.doesNotMatch(h.node('events-list').innerHTML, /media-event-past|media-event-earlier/);
  assert.equal(h.node('events-status').textContent, '1 of 2 upcoming events');
  assert.equal(h.node('events-reset').hidden, false);
  h.context.togglePastEvents();
  assert.match(h.node('events-list').innerHTML, /media-event-past/);
  assert.equal(h.node('events-status').textContent, '2 of 3 events · including past events');
  assert.deepEqual(h.context.state.events.map(event => event.id), ['later', 'earlier', 'past']);
});

test('reset restores upcoming events, category selection and focus; no-match searches are safe to display', () => {
  const h = harness();
  h.node('events-search').value = '<img src=x onerror=alert(1)>'; h.context.state.eventFilter = 'Other'; h.context.state.showPastEvents = true;
  h.context.renderEvents();
  assert.match(h.node('events-list').innerHTML, /No matching events/);
  assert.doesNotMatch(h.node('events-list').innerHTML, /onerror/);
  h.context.resetEventBrowse('media');
  assert.equal(h.node('events-search').value, ''); assert.equal(h.active(), 'events-search');
  assert.equal(h.context.state.showPastEvents, false); assert.equal(h.context.state.eventFilter, 'all');
  assert.equal(h.node('category-all').attributes['aria-pressed'], 'true');
  assert.equal(h.node('events-reset').hidden, true);
  assert.match(h.node('events-list').innerHTML, /media-event-earlier/);
});

test('filtering cannot turn loading or failed event requests into a false empty state', () => {
  const h = harness(); h.context.state.events = []; h.context.state.dataLoaded.events = false;
  h.node('events-search').value = 'basketball'; h.context.renderEvents();
  assert.equal(h.node('events-status').textContent, 'Loading events…');
  assert.doesNotMatch(h.node('events-list').innerHTML, /No matching events/);
  h.context.state.dataErrors.events = 'Unavailable'; h.context.renderEvents();
  assert.match(h.node('events-status').textContent, /could not load/);
  h.node('sac-events-list').innerHTML = 'Existing request error'; h.node('sac-events-status').textContent = 'Events unavailable.';
  h.node('sac-events-search').value = 'final'; h.context.paintSacEvents();
  assert.equal(h.node('sac-events-list').innerHTML, 'Existing request error');
  assert.equal(h.node('sac-events-status').textContent, 'Events unavailable.');
});

test('SAC deep links clear old filters once, while refreshes preserve a later search and avoid stealing focus', async () => {
  const h = harness(); h.context.window.location.search = '?event=past-sac'; h.node('sac-events-search').value = 'old filter';
  await h.context.renderSacEvents();
  assert.equal(h.node('sac-events-search').value, ''); assert.equal(h.run('sacEventsState.showPast'), true);
  assert.match(h.node('sac-events-list').innerHTML, /sac-event-past-sac/); assert.equal(h.frames.length, 1);
  h.node('sac-events-search').value = 'volleyball'; h.node('sac-events-search').focus(); h.frames[0]();
  assert.equal(h.active(), 'sac-events-search', 'A delayed arrival frame cannot steal focus after typing starts');
  h.node('sac-events-search').value = 'volleyball'; await h.context.renderSacEvents();
  assert.equal(h.node('sac-events-search').value, 'volleyball'); assert.equal(h.frames.length, 1);
  assert.doesNotMatch(h.node('sac-events-list').innerHTML, /sac-event-past-sac/);
  const readCount = h.reads.length; h.context.paintSacEvents(); assert.equal(h.reads.length, readCount, 'Typing filters only loaded records');
  h.context.resetEventBrowse('sac');
  assert.equal(h.node('sac-events-search').value, ''); assert.equal(h.run('sacEventsState.showPast'), false);
  assert.equal(h.active(), 'sac-events-search'); assert.equal(h.node('sac-events-reset').hidden, true);
});

test('account resets clear both workspace searches and the Media category controls', () => {
  const h = harness(); h.node('events-search').value = 'previous user'; h.node('sac-events-search').value = 'another query';
  h.context.state.eventFilter = 'Livestream'; h.context.state.showPastEvents = true;
  const workspaces = read('scripts/workspaces.js'); const start = workspaces.indexOf('function resetCrewCenterWorkspace()');
  h.context.applyWorkspacePresentation = () => {};
  h.run(`${workspaces.slice(start, workspaces.indexOf('\ndocument.addEventListener', start))}\nresetCrewCenterWorkspace();`);
  assert.equal(h.node('events-search').value, ''); assert.equal(h.node('sac-events-search').value, '');
  assert.equal(h.node('events-status').textContent, ''); assert.equal(h.node('category-all').attributes['aria-pressed'], 'true');
  assert.equal(h.context.state.showPastEvents, false);
});

test('typing during a slow SAC arrival request remains intact when the events arrive', async () => {
  const h = harness(); let resolveEvents;
  h.context.supabaseClient.from = () => {
    const query = { select() { return query; }, order: () => new Promise(resolve => { resolveEvents = resolve; }) };
    return query;
  };
  h.context.window.location.search = '?event=past-sac'; h.node('sac-events-search').value = 'previous search';
  const loading = h.context.renderSacEvents();
  assert.equal(h.node('sac-events-search').value, '', 'The previous search clears before the request');
  h.node('sac-events-search').value = 'volleyball'; h.node('sac-events-search').focus();
  resolveEvents({ data: sacEvents, error: null }); await loading;
  assert.equal(h.node('sac-events-search').value, 'volleyball');
  assert.match(h.node('sac-events-list').innerHTML, /sac-event-upcoming/);
  h.frames[0](); assert.equal(h.active(), 'sac-events-search');
});
