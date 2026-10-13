// Secrets stay in this tab's memory. Reloading does not stop an existing subscription.
let mediaCalendarState = { actor: '', epoch: 0, loaded: false, loading: false, error: '', feeds: {} };
const mediaCalendarKinds = ['personal', 'events'];
let mediaCalendarAnchorHandled = false;
function mediaCalendarActor() {
  const user = window.CREW_CENTER_AUTH_USER;
  const member = currentMemberRecord();
  return user?.id && member?.teamKeys?.includes('media_club') && canAccessMyCrewSchedule()
    ? `${user.id}:${member.id}:${window.CREW_CENTER_AUTH_EPOCH || 0}` : '';
}
function syncMediaCalendarSubscriptions() {
  const panel = document.getElementById('media-calendar-subscriptions');
  if (!panel) return;
  const actor = mediaCalendarActor();
  panel.hidden = !actor || currentCrewCenterWorkspace() !== 'media';
  document.getElementById('dashboard-calendar-subscribe')?.toggleAttribute('hidden', !actor);
  if (!actor) { window.resetMediaCalendarSubscriptions(); return; }
  if (mediaCalendarState.actor !== actor) {
    mediaCalendarState = { actor, epoch: mediaCalendarState.epoch + 1, loaded: false, loading: false, error: '', feeds: {} };
  }
  renderMediaCalendarSubscriptions();
  const targetAnchor = window.location?.hash === '#media-calendar-subscriptions';
  if (!targetAnchor) mediaCalendarAnchorHandled = false;
  if (targetAnchor && !mediaCalendarAnchorHandled && document.getElementById('page-my-crew-schedule')?.classList.contains('active')) {
    mediaCalendarAnchorHandled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (actor !== mediaCalendarActor() || window.location.hash !== '#media-calendar-subscriptions'
        || !document.getElementById('page-my-crew-schedule')?.classList.contains('active')) return;
      panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      const heading = document.getElementById('media-calendar-title');
      heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
    }));
  }
  if (!mediaCalendarState.loaded && !mediaCalendarState.loading && !mediaCalendarState.error
    && document.getElementById('page-my-crew-schedule')?.classList.contains('active')) void loadMediaCalendarSubscriptions();
}
function renderMediaCalendarSubscriptions() {
  const panel = document.getElementById('media-calendar-subscriptions');
  if (!panel || panel.hidden) return;
  const error = document.getElementById('media-calendar-error');
  error.hidden = !mediaCalendarState.error;
  document.getElementById('media-calendar-error-copy').textContent = mediaCalendarState.error;
  error.querySelector('[data-calendar-retry]').disabled = mediaCalendarState.loading || Object.values(mediaCalendarState.feeds).some(feed => feed.busy);
  for (const kind of mediaCalendarKinds) {
    const feed = mediaCalendarState.feeds[kind] || {};
    const card = document.getElementById(`media-calendar-${kind}`);
    const button = card.querySelector('[data-calendar-create]');
    button.disabled = !mediaCalendarState.loaded || mediaCalendarState.loading || Boolean(feed.busy);
    button.textContent = feed.busy ? 'Updating…' : feed.url ? 'Link ready' : feed.active ? 'Replace link' : 'Create subscription link';
    button.hidden = Boolean(feed.url);
    card.querySelector('[data-calendar-state]').textContent = feed.busy ? 'Updating your link…'
      : !mediaCalendarState.loaded ? mediaCalendarState.error ? 'Unable to check subscriptions' : 'Checking subscriptions…' : feed.active ? 'Private link active' : 'No active link';
    const links = card.querySelector('[data-calendar-links]');
    links.hidden = !feed.url;
    card.querySelector('input').value = feed.url || '';
    card.querySelector('[data-calendar-copy]').disabled = Boolean(feed.busy || feed.copying);
    const nativeLink = card.querySelector('[data-calendar-native]');
    const googleButton = card.querySelector('[data-calendar-google]');
    googleButton.disabled = !feed.url || Boolean(feed.busy || feed.copying);
    googleButton.setAttribute('aria-expanded', String(Boolean(feed.url && feed.googleSetup)));
    card.querySelector('[data-calendar-google-setup]').hidden = !feed.url || !feed.googleSetup;
    card.querySelector('[data-calendar-copy-status]').textContent = feed.copyStatus || 'Copy your private link above, then paste it in Google Calendar.';
    if (feed.url) {
      nativeLink.href = feed.url.replace(/^https:/, 'webcal:');
    } else {
      nativeLink.removeAttribute('href');
    }
    const revoke = card.querySelector('[data-calendar-revoke]');
    revoke.hidden = !feed.active; revoke.disabled = mediaCalendarState.loading || Boolean(feed.busy);
    card.querySelector('[data-calendar-recover]').hidden = !feed.active || Boolean(feed.url);
  }
}
async function loadMediaCalendarSubscriptions() {
  if (!mediaCalendarActor() || mediaCalendarState.loading || Object.values(mediaCalendarState.feeds).some(feed => feed.busy || feed.copying)) return;
  const request = mediaCalendarState;
  request.loading = true; request.error = '';
  renderMediaCalendarSubscriptions();
  try {
    const responses = await Promise.all(mediaCalendarKinds.map(kind => window.crewCenterSupabase.rpc('manage_own_media_calendar_subscription', { p_kind: kind, p_action: 'status', p_expected_user_id: request.actor.split(':')[0] })));
    if (request !== mediaCalendarState || request.actor !== mediaCalendarActor()) return;
    if (responses.some(result => result.error || typeof result.data?.active !== 'boolean')) throw new Error('Unavailable');
    responses.forEach((result, index) => {
      const kind = mediaCalendarKinds[index];
      const previous = request.feeds[kind];
      request.feeds[kind] = { ...request.feeds[kind], ...result.data };
      if (!result.data.active || previous?.created_at !== result.data.created_at) {
        delete request.feeds[kind].url;
        delete request.feeds[kind].googleSetup;
        delete request.feeds[kind].copyStatus;
        delete request.feeds[kind].copying;
      }
    });
    request.loaded = true;
  } catch {
    if (request === mediaCalendarState && request.actor === mediaCalendarActor()) {
      request.error = 'Calendar subscriptions are unavailable right now. Retry in a moment; your existing calendars keep their saved entries.';
    }
  } finally {
    if (request === mediaCalendarState && request.actor === mediaCalendarActor()) { request.loading = false; renderMediaCalendarSubscriptions(); }
  }
}
async function updateMediaCalendarSubscription(kind, action) {
  if (!mediaCalendarKinds.includes(kind) || !['create', 'replace', 'revoke'].includes(action)
    || !mediaCalendarState.loaded || mediaCalendarState.loading || mediaCalendarState.actor !== mediaCalendarActor()) return false;
  const request = mediaCalendarState;
  const feed = request.feeds[kind];
  if (!feed || feed.busy || feed.copying) return false;
  feed.busy = true; request.error = ''; renderMediaCalendarSubscriptions();
  try {
    let secret; let hash;
    if (action !== 'revoke') {
      secret = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    if (request !== mediaCalendarState || request.actor !== mediaCalendarActor()) return false;
    const { data, error } = await window.crewCenterSupabase.rpc('manage_own_media_calendar_subscription', { p_kind: kind, p_action: action, p_expected_user_id: request.actor.split(':')[0], p_token_hash: hash || null });
    if (request !== mediaCalendarState || request.actor !== mediaCalendarActor()) return false;
    if (error || data?.active !== (action !== 'revoke')) throw new Error('Could not save');
    const url = secret ? new URL('/functions/v1/media-calendar', window.CREW_CENTER_SUPABASE.url) : null;
    if (url) url.searchParams.set('token', secret);
    request.feeds[kind] = { ...data, url: url?.href || '' };
    renderMediaCalendarSubscriptions();
    setTimeout(() => {
      if (request === mediaCalendarState && request.actor === mediaCalendarActor()
        && document.getElementById('page-my-crew-schedule')?.classList.contains('active')) {
        document.getElementById(`media-calendar-${kind}`).querySelector(url ? '[data-calendar-copy]' : '[data-calendar-create]').focus();
      }
    }, 0);
    showToast(action === 'revoke' ? 'Calendar link revoked. Remove the subscription from your calendar app too.' : 'Your private link is ready. Add it once in your calendar app.');
    return true;
  } catch {
    if (request === mediaCalendarState && request.actor === mediaCalendarActor()) {
      request.error = 'The link could not be updated. Retry checking its status before trying again.';
      request.loaded = false;
    }
    return false;
  } finally {
    if (request === mediaCalendarState && request.actor === mediaCalendarActor()) { request.feeds[kind].busy = false; renderMediaCalendarSubscriptions(); }
  }
}
function requestMediaCalendarChange(kind, action) {
  if (mediaCalendarState.actor !== mediaCalendarActor() || !mediaCalendarState.loaded) return;
  const feed = mediaCalendarState.feeds[kind];
  if (!feed || feed.busy || feed.copying) return;
  if (action === 'create' && !feed.active) { void updateMediaCalendarSubscription(kind, action); return; }
  if (!feed.active || !['create', 'revoke'].includes(action)) return;
  const actor = mediaCalendarState.actor;
  const revoke = action === 'revoke';
  openActionConfirmation({ title: revoke ? 'Revoke this calendar link?' : 'Replace this calendar link?',
    copy: revoke ? 'This link will stop serving updates.' : 'The old link will stop working. You will need to add the replacement in your calendar app.',
    impact: ['This affects only this calendar feed. Your crew sign-ups stay saved.', 'Calendar apps may retain entries they have already downloaded.'],
    confirmLabel: revoke ? 'Revoke link' : 'Replace link', busyLabel: 'Updating link…', danger: revoke,
    execute: () => actor === mediaCalendarActor() && updateMediaCalendarSubscription(kind, revoke ? 'revoke' : 'replace') });
}
async function copyMediaCalendarLink(kind) {
  const request = mediaCalendarState;
  const feed = request.feeds[kind];
  const url = feed?.url;
  if (!url || feed.busy || feed.copying || request.actor !== mediaCalendarActor()) return false;
  const stillCurrent = () => request === mediaCalendarState && request.actor === mediaCalendarActor()
    && request.feeds[kind] === feed && feed.url === url;
  feed.copying = true; feed.copyStatus = 'Copying your link…'; renderMediaCalendarSubscriptions();
  try {
    await navigator.clipboard.writeText(url);
    if (!stillCurrent()) return false;
    feed.copyStatus = 'Link copied. Paste it into “URL of calendar” in Google Calendar.';
    if (!feed.googleSetup) showToast('Subscription link copied. Choose “From URL” or “Subscribe from web” in your calendar app.');
    return true;
  } catch {
    if (!stillCurrent()) return false;
    feed.copyStatus = 'Copying was blocked. Copy the selected URL above with ⌘C / Ctrl+C, then paste it in Google Calendar.';
    const input = document.getElementById(`media-calendar-${kind}`).querySelector('input');
    input.focus(); input.select();
    if (!feed.googleSetup) showToast('Select and copy the link shown here.');
    return false;
  } finally {
    if (stillCurrent()) { feed.copying = false; renderMediaCalendarSubscriptions(); }
  }
}
function toggleMediaGoogleCalendarSetup(kind) {
  const feed = mediaCalendarState.feeds[kind];
  if (!feed?.url || feed.busy || feed.copying || mediaCalendarState.actor !== mediaCalendarActor()) return;
  feed.googleSetup = !feed.googleSetup;
  renderMediaCalendarSubscriptions();
  if (feed.googleSetup) void copyMediaCalendarLink(kind);
}
window.resetMediaCalendarSubscriptions = function() {
  mediaCalendarAnchorHandled = false;
  mediaCalendarState = { actor: '', epoch: mediaCalendarState.epoch + 1, loaded: false, loading: false, error: '', feeds: {} };
  const panel = document.getElementById('media-calendar-subscriptions');
  if (panel) {
    panel.hidden = true;
    panel.querySelectorAll('input').forEach(input => { input.value = ''; });
    panel.querySelectorAll('[data-calendar-native]').forEach(link => link.removeAttribute('href'));
    panel.querySelectorAll('[data-calendar-google]').forEach(button => { button.disabled = true; button.setAttribute('aria-expanded', 'false'); });
    panel.querySelectorAll('[data-calendar-google-setup]').forEach(setup => { setup.hidden = true; });
    panel.querySelectorAll('[data-calendar-copy-status]').forEach(status => { status.textContent = ''; });
    panel.querySelectorAll('[data-calendar-links]').forEach(links => { links.hidden = true; });
  }
  document.getElementById('dashboard-calendar-subscribe')?.setAttribute('hidden', '');
};
window.syncMediaCalendarSubscriptions = syncMediaCalendarSubscriptions;
document.addEventListener('click', event => {
  const target = event.target.closest?.('[data-calendar-create], [data-calendar-revoke], [data-calendar-copy], [data-calendar-google], [data-calendar-retry]');
  if (!target || target.disabled) return;
  if (target.hasAttribute('data-calendar-retry')) { void loadMediaCalendarSubscriptions(); return; }
  const kind = target.closest('[data-calendar-kind]')?.dataset.calendarKind;
  if (target.hasAttribute('data-calendar-google')) toggleMediaGoogleCalendarSetup(kind);
  else if (target.hasAttribute('data-calendar-copy')) void copyMediaCalendarLink(kind);
  else requestMediaCalendarChange(kind, target.hasAttribute('data-calendar-revoke') ? 'revoke' : 'create');
});
