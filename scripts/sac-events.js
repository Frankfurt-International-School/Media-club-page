// SAC events are independent of Media Club production events. The server owns
// permissions and exposes only limited livestream details for linking.
const sacEventsState = { events: [], livestreams: [], showPast: false, editingId: null, loaded: false, request: 0 };
let mediaSacLinkRequest = 0;

function resetSacEventsState() {
  sacEventsState.request += 1;
  mediaSacLinkRequest += 1;
  sacEventsState.events = [];
  sacEventsState.livestreams = [];
  sacEventsState.showPast = false;
  sacEventsState.editingId = null;
  sacEventsState.loaded = false;
  const list = document.getElementById('sac-events-list');
  if (list) list.textContent = '';
  const mediaCallout = document.getElementById('sheet-sac-linked');
  if (mediaCallout) { mediaCallout.hidden = true; mediaCallout.textContent = ''; }
}

window.resetSacEventsState = resetSacEventsState;

function sacEventLinkable(eventId) {
  return sacEventsState.livestreams.find(event => event.id === eventId);
}

function sacEventTimeLabel(event) {
  const sameDay = berlinDateKey(event.starts_at) === berlinDateKey(event.ends_at);
  const end = sameDay
    ? berlinTimeLabel(event.ends_at)
    : formatBerlinDateTime(event.ends_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${berlinTimeLabel(event.starts_at)}–${end}`;
}

function sacEventMediaSignupUrl(mediaEventId) {
  const productionMediaHost = ['fismediaclub.org', 'sac.fismediaclub.org'].includes(normalizeWorkspaceHostname(window.location.hostname));
  const destination = productionMediaHost ? new URL('https://fismediaclub.org') : window.location;
  const query = new URLSearchParams({ event: mediaEventId });
  const workspaceSearch = workspaceSearchForSelection('media', destination.hostname, query.toString());
  return `${productionMediaHost ? destination.origin : ''}/signups${workspaceSearch}`;
}

function sacEventUrl(eventId) {
  const productionHost = ['fismediaclub.org', 'sac.fismediaclub.org'].includes(normalizeWorkspaceHostname(window.location.hostname));
  const destination = productionHost ? new URL('https://sac.fismediaclub.org') : window.location;
  const query = new URLSearchParams({ event: eventId });
  const workspaceSearch = workspaceSearchForSelection('sac', destination.hostname, query.toString());
  return `${productionHost ? destination.origin : ''}/sac/events${workspaceSearch}`;
}

function sacSignupUrl(eventId) {
  const productionHost = ['fismediaclub.org', 'sac.fismediaclub.org'].includes(normalizeWorkspaceHostname(window.location.hostname));
  const destination = productionHost ? new URL('https://sac.fismediaclub.org') : window.location;
  const query = new URLSearchParams({ event: eventId });
  const workspaceSearch = workspaceSearchForSelection('sac', destination.hostname, query.toString());
  return `${productionHost ? destination.origin : ''}/sac/signups${workspaceSearch}`;
}

async function refreshMediaSignupSacLinks(mediaEventId) {
  const container = document.getElementById('sheet-sac-linked');
  if (!container) return;
  const request = ++mediaSacLinkRequest;
  container.hidden = true;
  container.textContent = '';
  if (!mediaEventId || !canAccessSacWorkspace() || !supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from('sac_events')
      .select('id,title').eq('linked_media_event_id', mediaEventId).order('starts_at', { ascending: true });
    if (request !== mediaSacLinkRequest || document.getElementById('sheet-event-select')?.value !== mediaEventId || error || !data?.length) return;
    container.innerHTML = `<div><strong>Also coordinated by SAC</strong><span>SAC Scoreboard shifts have their own sign-up sheet. Only current SAC members can claim a spot.</span></div><div class="sac-linked-actions">${data.map(item => `<a class="btn btn-ghost btn-sm" href="${escapeHtml(sacSignupUrl(item.id))}">${escapeHtml(item.title)} · SAC shifts →</a>`).join('')}</div>`;
    container.hidden = false;
  } catch (_error) {
    // Older deployments without the SAC event table simply omit the callout.
  }
}

function paintSacEvents() {
  const list = document.getElementById('sac-events-list');
  if (!list) return;
  const now = Date.now();
  const events = sacEventsState.events.filter(event => sacEventsState.showPast || Date.parse(event.ends_at) >= now);
  document.getElementById('sac-event-create').hidden = !canCreateSacEvents();
  const toggle = document.getElementById('sac-events-past-toggle');
  toggle.textContent = sacEventsState.showPast ? 'Hide past events' : 'Show past events';
  toggle.setAttribute('aria-pressed', String(sacEventsState.showPast));
  if (!events.length) {
    list.innerHTML = `<div class="empty-state" role="status"><p>${sacEventsState.showPast ? 'No SAC events yet.' : 'No upcoming SAC events yet.'}</p>${canCreateSacEvents() ? '<button class="btn btn-accent btn-sm" type="button" onclick="openSacEventEditor()">Create the first event</button>' : ''}</div>`;
    return;
  }
  list.innerHTML = events.map(event => {
    const date = berlinDateKey(event.starts_at);
    const linked = event.linked_media_event_id ? sacEventLinkable(event.linked_media_event_id) : null;
    const linkLabel = linked?.title || (event.linked_media_event_id ? 'Linked Media Club livestream' : 'Independent SAC event');
    const mediaUrl = linked && canAccessMediaWorkspace() ? sacEventMediaSignupUrl(linked.id) : '';
    return `<article class="sac-event-card" id="sac-event-${escapeHtml(event.id)}" tabindex="-1">
      <div class="sac-event-date" aria-hidden="true"><strong>${escapeHtml(formatBerlinCalendarDate(date, { day: 'numeric' }))}</strong><span>${escapeHtml(formatBerlinCalendarDate(date, { month: 'short' }).toUpperCase())}</span></div>
      <div><div class="page-kicker">${escapeHtml(formatBerlinCalendarDate(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</div><h2>${escapeHtml(event.title)}</h2>
        <div class="sac-event-meta"><span>${escapeHtml(sacEventTimeLabel(event))} Berlin time</span>${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}</div>
        ${event.description ? `<p class="sac-event-description">${escapeHtml(event.description)}</p>` : ''}
        <div class="sac-event-actions"><span class="sac-event-link-label">${escapeHtml(linkLabel)}</span><a class="btn btn-accent btn-sm" href="${escapeHtml(sacSignupUrl(event.id))}">Scoreboard shifts</a>${mediaUrl ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(mediaUrl)}">Media Club sign-up sheet</a>` : ''}${canCreateSacEvents() ? `<button class="btn btn-ghost btn-sm" type="button" data-sac-edit-id="${escapeHtml(event.id)}">Edit event</button>` : ''}</div>
      </div>
    </article>`;
  }).join('');
}

async function renderSacEvents() {
  const list = document.getElementById('sac-events-list');
  if (!list || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  const request = ++sacEventsState.request;
  if (!sacEventsState.loaded) list.innerHTML = '<div class="empty-state" role="status"><p>Loading SAC events…</p></div>';
  if (!supabaseClient) {
    list.innerHTML = '<div class="empty-state" role="alert"><p>SAC events cannot load until Supabase is configured.</p></div>';
    return;
  }
  let eventResult;
  let linkResult;
  try {
    [eventResult, linkResult] = await Promise.all([
      supabaseClient.from('sac_events').select('id,title,description,location,starts_at,ends_at,slot_interval_minutes,scoreboard_spots,linked_media_event_id').order('starts_at', { ascending: true }),
      canCreateSacEvents() ? supabaseClient.rpc('get_sac_linkable_livestreams') : Promise.resolve({ data: [], error: null }),
    ]);
  } catch (_error) {
    if (request === sacEventsState.request) list.innerHTML = '<div class="empty-state" role="alert"><p>SAC events could not load. Check your connection and try opening Events again.</p></div>';
    return;
  }
  if (request !== sacEventsState.request) return;
  if (eventResult.error) {
    list.innerHTML = '<div class="empty-state" role="alert"><p>SAC events are not available yet. The new database schema and permissions must be applied before this page can load.</p></div>';
    document.getElementById('sac-event-create').hidden = true;
    return;
  }
  sacEventsState.events = eventResult.data || [];
  sacEventsState.livestreams = linkResult.error ? [] : linkResult.data || [];
  sacEventsState.loaded = true;
  const requestedEventId = new URLSearchParams(window.location.search).get('event');
  const requestedEvent = sacEventsState.events.find(event => event.id === requestedEventId);
  if (requestedEvent && Date.parse(requestedEvent.ends_at) < Date.now()) sacEventsState.showPast = true;
  paintSacEvents();
  if (requestedEvent) requestAnimationFrame(() => {
    const card = document.getElementById(`sac-event-${requestedEvent.id}`);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  });
  if (linkResult.error && canCreateSacEvents()) showToast('SAC events loaded, but Media Club livestream linking is unavailable until the database update is applied.', 'error', 7000);
}

function togglePastSacEvents() {
  sacEventsState.showPast = !sacEventsState.showPast;
  paintSacEvents();
}

function syncSacEventLinkFields() {
  const linked = sacEventLinkable(document.getElementById('sac-event-linked').value);
  const inputs = ['sac-event-date', 'sac-event-start', 'sac-event-end'].map(id => document.getElementById(id));
  if (linked) {
    inputs[0].value = berlinDateKey(linked.starts_at);
    inputs[1].value = berlinTimeLabel(linked.starts_at);
    inputs[2].value = berlinTimeLabel(linked.ends_at);
  }
  inputs.forEach(input => { input.disabled = Boolean(linked); });
  document.getElementById('sac-event-link-help').textContent = linked
    ? 'Date and time follow this Media Club livestream automatically. SAC sign-ups remain separate.'
    : 'Set the date and times for an independent SAC event. The end must be later on the same day.';
}

async function openSacEventEditor(id = null) {
  if (!canCreateSacEvents() || currentCrewCenterWorkspace() !== 'sac') {
    showToast('Only designated SAC leaders or Auth Admins can create and edit SAC events.', 'error');
    return;
  }
  if (!sacEventsState.loaded) await renderSacEvents();
  if (!sacEventsState.loaded) return;
  const existing = id ? sacEventsState.events.find(event => event.id === id) : null;
  if (id && !existing) { showToast('This SAC event is no longer available.', 'error'); return; }
  sacEventsState.editingId = existing?.id || null;
  const form = document.getElementById('sac-event-form');
  form.reset();
  document.getElementById('sac-event-modal-title').textContent = existing ? 'Edit SAC event' : 'Create SAC event';
  document.getElementById('sac-event-save').textContent = existing ? 'Save changes' : 'Create event';
  const select = document.getElementById('sac-event-linked');
  select.innerHTML = '<option value="">Independent SAC event</option>' + sacEventsState.livestreams.map(event => `<option value="${escapeHtml(event.id)}">${escapeHtml(formatBerlinDateTime(event.starts_at, { day: 'numeric', month: 'short' }))} · ${escapeHtml(event.title)}</option>`).join('');
  if (existing) {
    document.getElementById('sac-event-title').value = existing.title;
    document.getElementById('sac-event-date').value = berlinDateKey(existing.starts_at);
    document.getElementById('sac-event-start').value = berlinTimeLabel(existing.starts_at);
    document.getElementById('sac-event-end').value = berlinTimeLabel(existing.ends_at);
    document.getElementById('sac-event-location').value = existing.location || '';
    document.getElementById('sac-event-description').value = existing.description || '';
    document.getElementById('sac-event-interval').value = existing.slot_interval_minutes || 30;
    document.getElementById('sac-event-spots').value = existing.scoreboard_spots || 2;
    if (existing.linked_media_event_id && !sacEventLinkable(existing.linked_media_event_id)) {
      select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(existing.linked_media_event_id)}" disabled>Linked livestream unavailable — choose another option</option>`);
    }
    select.value = existing.linked_media_event_id || '';
  } else {
    document.getElementById('sac-event-date').value = berlinDateKey();
  }
  syncSacEventLinkFields();
  openModal('sac-event-modal');
}

async function saveSacEvent(event) {
  event.preventDefault();
  if (!canCreateSacEvents() || currentCrewCenterWorkspace() !== 'sac') {
    showToast('SAC event creation access is required.', 'error');
    return;
  }
  const title = document.getElementById('sac-event-title').value.trim();
  const linkedId = document.getElementById('sac-event-linked').value || null;
  const linked = linkedId ? sacEventLinkable(linkedId) : null;
  if (linkedId && !linked) { showToast('Choose an available livestream or make this an independent event.', 'error'); return; }
  const date = document.getElementById('sac-event-date').value;
  const start = document.getElementById('sac-event-start').value;
  const end = document.getElementById('sac-event-end').value;
  const startTimestamp = linked ? Date.parse(linked.starts_at) : berlinTimestamp(date, start);
  const endTimestamp = linked ? Date.parse(linked.ends_at) : berlinTimestamp(date, end);
  const interval = Number(document.getElementById('sac-event-interval').value);
  const spots = Number(document.getElementById('sac-event-spots').value);
  if (!Number.isInteger(interval) || interval < 15 || interval > 120 || interval % 5 !== 0 || !Number.isInteger(spots) || spots < 2 || spots > 12) {
    showToast('Use 15–120 minutes in five-minute steps and at least two Scoreboard spots.', 'error');
    return;
  }
  if (!title || title.length > 120 || !Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp) {
    showToast('Enter a title and a valid event window. Independent events must end later on the same day.', 'error', 6000);
    return;
  }
  const payload = {
    title,
    description: document.getElementById('sac-event-description').value.trim(),
    location: document.getElementById('sac-event-location').value.trim(),
    starts_at: new Date(startTimestamp).toISOString(),
    ends_at: new Date(endTimestamp).toISOString(),
    slot_interval_minutes: interval,
    scoreboard_spots: spots,
    linked_media_event_id: linkedId,
  };
  const button = document.getElementById('sac-event-save');
  button.disabled = true;
  try {
    const query = sacEventsState.editingId
      ? supabaseClient.from('sac_events').update(payload).eq('id', sacEventsState.editingId)
      : supabaseClient.from('sac_events').insert(payload);
    const { data, error } = await query.select('id').single();
    if (error || !data) throw error || new Error('No SAC event was saved.');
    closeModal('sac-event-modal');
    showToast(sacEventsState.editingId ? 'SAC event updated.' : 'SAC event created.');
    await renderSacEvents();
  } catch (error) {
    showToast(error?.message || 'Could not save the SAC event. Check the database setup and your SAC role.', 'error', 7000);
  } finally {
    button.disabled = false;
  }
}

document.getElementById('sac-events-list')?.addEventListener('click', event => {
  const button = event.target.closest('[data-sac-edit-id]');
  if (button) openSacEventEditor(button.dataset.sacEditId);
});
