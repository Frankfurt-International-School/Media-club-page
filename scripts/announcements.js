// Club announcements share one reader and remain separate from personal reminders.
let announcementEditorId = null;
let announcementSaveRequest = null;
let announcementReaderRequest = 0;
const announcementAudiences = { media_club: 'Media Club', sac: 'SAC', both: 'Media Club & SAC' };
const announcementActionPaths = /^\/(dashboard|events|meetings|signups|my-crew-schedule|sac\/(events|meetings|signups|my-shifts))(\?[^#]*)?$/;

function announcementActor() {
  const user = window.CREW_CENTER_AUTH_USER;
  if (!user?.id || isVisitorSession()) return '';
  return `${user.id}:${Number(window.CREW_CENTER_AUTH_EPOCH || 0)}:${currentMemberRecord()?.id || ''}`;
}

function canReadAnnouncement(announcement) {
  if (!announcementActor() || !announcementAudiences[announcement.audience]) return false;
  if (canAccessAdminPanel()) return true;
  const member = currentMemberRecord();
  if (!memberMatchesCurrentSession(member)) return false;
  return (['media_club', 'both'].includes(announcement.audience) && member?.teamKeys?.includes('media_club'))
    || (['sac', 'both'].includes(announcement.audience) && member?.teamKeys?.includes('sac'));
}

function announcementIsActive(announcement, now = Date.now()) {
  const expiry = announcement.expires_at ? Date.parse(announcement.expires_at) : Infinity;
  return !announcement.archived_at && expiry > now;
}

function activeAnnouncements(workspace = currentCrewCenterWorkspace()) {
  const audience = workspace === 'sac' ? 'sac' : 'media_club';
  return state.announcements.filter(item => [audience, 'both'].includes(item.audience) && announcementIsActive(item) && canReadAnnouncement(item))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function safeAnnouncementAction(url) {
  const value = String(url || '').trim();
  return value.length <= 500 && announcementActionPaths.test(value) && !/[\s\u0000-\u001f\u007f]/.test(value) ? value : '';
}

function announcementActionHref(item) {
  const path = safeAnnouncementAction(item.action_url);
  if (!path) return '';
  const url = new URL(path, window.location.origin);
  if (item.audience === 'both') {
    const routes = { '/events': '/sac/events', '/signups': '/sac/signups', '/meetings': '/sac/meetings', '/my-crew-schedule': '/sac/my-shifts' };
    if (currentCrewCenterWorkspace() === 'sac' && routes[url.pathname]) url.pathname = routes[url.pathname];
    if (currentCrewCenterWorkspace() === 'media') {
      const sharedRoute = Object.entries(routes).find(([, sacPath]) => sacPath === url.pathname);
      if (sharedRoute) url.pathname = sharedRoute[0];
    }
  }
  const workspace = url.pathname.startsWith('/sac/') ? 'sac' : url.pathname === '/dashboard' ? currentCrewCenterWorkspace() : 'media';
  url.search = workspaceSearchForSelection(workspace, window.location.hostname, url.search);
  return `${url.pathname}${url.search}`;
}

function announcementIsUnread(id) {
  return state.notifications.some(item => item.member_id === currentMemberRecord()?.id && item.related_announcement_id === id && !item.read_at);
}
window.renderAnnouncementSurfaces = renderAnnouncementSurfaces;
window.announcementNotificationVisible = item => {
  if (item.notification_type !== 'announcement') return true;
  const announcement = state.announcements.find(post => post.id === item.related_announcement_id);
  return announcement ? announcementIsActive(announcement) && canReadAnnouncement(announcement) : !state.dataLoaded.announcements;
};

function announcementRowHtml(item) {
  return `<button type="button" class="announcement-row" data-announcement-open="${escapeHtml(item.id)}"><span class="announcement-row-copy"><span class="announcement-row-meta">${item.pinned ? 'Pinned · ' : ''}${escapeHtml(item.date)}${announcementIsUnread(item.id) ? '<span class="announcement-new">New</span>' : ''}</span><strong>${escapeHtml(item.title)}</strong><span class="announcement-excerpt">${escapeHtml(item.body)}</span></span><span class="announcement-row-arrow" aria-hidden="true">→</span></button>`;
}

function announcementFeedHtml(workspace) {
  if (!announcementActor()) return '<div class="dashboard-empty">Sign in with a club account to view announcements.</div>';
  if (state.dataErrors.announcements) return '<div class="dashboard-empty">Announcements could not load. <button type="button" class="btn btn-ghost btn-sm" data-announcement-retry>Try again</button></div>';
  if (!state.dataLoaded.announcements) return '<div class="dashboard-empty" role="status">Loading announcements…</div>';
  const items = activeAnnouncements(workspace);
  if (!items.length) return '<div class="dashboard-empty">No active announcements.</div>';
  return `<div class="announcement-feed">${items.slice(0, 3).map(announcementRowHtml).join('')}${items.length > 3 ? `<details class="announcement-older"><summary>View all ${items.length} announcements</summary><div>${items.slice(3).map(announcementRowHtml).join('')}</div></details>` : ''}</div>`;
}

function renderAnnouncementSurfaces() {
  for (const workspace of ['media', 'sac']) {
    const pinned = document.getElementById(`${workspace}-pinned-announcement`);
    const item = activeAnnouncements(workspace).find(announcement => announcement.pinned);
    if (pinned) {
      pinned.hidden = !item;
      pinned.innerHTML = item ? `<div class="announcement-pin-label">Pinned announcement</div>${announcementRowHtml(item)}` : '';
    }
  }
  const sacFeed = document.getElementById('sac-announcement-feed');
  if (sacFeed) sacFeed.innerHTML = announcementFeedHtml('sac');
}

function paintAnnouncementReader(item, preview = false) {
  document.getElementById('announcement-reader-title').textContent = item.title;
  document.getElementById('announcement-reader-meta').textContent = `${preview ? 'Preview · ' : ''}${announcementAudiences[item.audience]}${item.pinned ? ' · Pinned' : ''}`;
  document.getElementById('announcement-reader-message').textContent = item.body;
  const action = document.getElementById('announcement-reader-action');
  const href = announcementActionHref(item);
  action.hidden = !href || !item.action_label;
  if (href) action.setAttribute('href', href);
  else action.removeAttribute('href');
  action.textContent = item.action_label || '';
  document.getElementById('announcement-reader-status').textContent = preview ? 'This is a preview. Nothing has been published.' : '';
}

async function openAnnouncement(id) {
  const actor = announcementActor();
  if (!actor || !supabaseClient) return;
  const request = ++announcementReaderRequest;
  document.getElementById('announcement-reader-title').textContent = 'Announcement';
  document.getElementById('announcement-reader-meta').textContent = '';
  document.getElementById('announcement-reader-message').textContent = '';
  document.getElementById('announcement-reader-action').hidden = true;
  document.getElementById('announcement-reader-status').textContent = 'Loading announcement…';
  closeNotificationPanel();
  openModal('announcement-reader-modal');
  try {
    const { data, error } = await withCrewCenterDataTimeout(supabaseClient.from('announcements').select('*').eq('id', id).single(), 'announcements');
    if (actor !== announcementActor() || request !== announcementReaderRequest) return;
    const item = data ? normalizeAnnouncement(data) : null;
    if (error || !item || !announcementIsActive(item) || !canReadAnnouncement(item)) throw new Error('Unavailable');
    paintAnnouncementReader(item);
    const read = await withCrewCenterDataTimeout(supabaseClient.rpc('mark_announcement_read', { p_announcement_id: id }), 'notifications');
    if (actor !== announcementActor() || request !== announcementReaderRequest) return;
    if (read.error || !read.data) {
      document.getElementById('announcement-reader-status').textContent = 'Message opened. Could not save your read status; try again when connected.';
    } else {
      const readAt = new Date().toISOString();
      state.notifications.filter(notification => notification.member_id === currentMemberRecord()?.id && notification.related_announcement_id === id)
        .forEach(notification => { notification.read_at ||= readAt; });
      renderNotificationCenter();
      renderAnnouncementSurfaces();
      if (currentCrewCenterWorkspace() === 'media') renderDashboard();
    }
  } catch (_error) {
    if (actor === announcementActor() && request === announcementReaderRequest) {
      document.getElementById('announcement-reader-status').textContent = 'This announcement is unavailable or could not load. It may have expired or been archived.';
    }
  }
}

window.announcementReaderClosed = () => { announcementReaderRequest += 1; };
window.announcementReaderReturnFocus = previous => {
  if (previous?.classList?.contains('announcement-notification')) return document.getElementById('notification-button');
  const id = previous?.dataset?.announcementOpen;
  return [...document.querySelectorAll('[data-announcement-open]')].find(button => button.dataset.announcementOpen === id && button.getClientRects().length && !button.closest('[inert]'))
    || document.getElementById('notification-button');
};
window.resetAnnouncementState = () => {
  announcementReaderRequest += 1;
  announcementEditorId = null;
  announcementSaveRequest = null;
  state.announcements = [];
  resetAnnouncementEditor();
  document.getElementById('ann-submit').disabled = false;
  document.getElementById('announcement-reader-message').textContent = '';
  closeModal('announcement-reader-modal');
  renderAnnouncementSurfaces();
};

function announcementActionChoices(selected = '') {
  const audience = document.getElementById('ann-audience').value;
  const prefix = audience === 'sac' ? '/sac' : '';
  const options = [['', 'No action button'], ['/dashboard', 'Dashboard'], [`${prefix}/events`, 'Events'], [`${prefix}/signups`, 'Sign-up sheets'], [`${prefix}/meetings`, 'Meetings'], [audience === 'sac' ? '/sac/my-shifts' : '/my-crew-schedule', 'My schedule']];
  if (selected && safeAnnouncementAction(selected) && !options.some(([url]) => url === selected)) options.push([selected, 'Current linked destination']);
  const select = document.getElementById('ann-action-url');
  select.innerHTML = options.map(([url, label]) => `<option value="${escapeHtml(url)}">${label}</option>`).join('');
  select.value = selected;
  document.getElementById('ann-action-label').disabled = !selected;
}

function announcementFormPayload() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  const audience = document.getElementById('ann-audience').value;
  const actionUrl = document.getElementById('ann-action-url').value;
  const actionLabel = actionUrl ? document.getElementById('ann-action-label').value.trim() : '';
  const expires = document.getElementById('ann-expires').value;
  const expiryTimestamp = expires ? berlinTimestamp(...expires.split('T')) : null;
  if (!title || title.length > 120 || !body || body.length > 5000) throw new Error('Add a title of up to 120 characters and a message of up to 5,000 characters.');
  if (!announcementAudiences[audience]) throw new Error('Choose a club audience.');
  if (actionUrl && (!safeAnnouncementAction(actionUrl) || !actionLabel || actionLabel.length > 48)) throw new Error('Add a short label for the action button.');
  const existing = state.announcements.find(item => item.id === announcementEditorId);
  const expiry = expiryTimestamp === null ? null : new Date(expiryTimestamp).toISOString();
  if (expires && (expiryTimestamp === null || (expiryTimestamp <= Date.now() && expiry !== existing?.expires_at))) throw new Error('Choose a valid expiry time in the future (Berlin time).');
  return { title, body, audience, action_label: actionLabel, action_url: actionUrl, pinned: document.getElementById('ann-pinned').checked, expires_at: expiry };
}

function resetAnnouncementEditor() {
  announcementEditorId = null;
  for (const id of ['ann-title', 'ann-body', 'ann-expires', 'ann-action-label']) document.getElementById(id).value = '';
  document.getElementById('ann-audience').value = 'media_club';
  document.getElementById('ann-pinned').checked = false;
  document.getElementById('ann-editor-title').textContent = 'Post new announcement';
  document.getElementById('ann-submit').textContent = 'Publish';
  document.getElementById('ann-edit-cancel').hidden = true;
  document.getElementById('ann-save-status').textContent = '';
  announcementActionChoices();
}

function editAnnouncement(id) {
  if (!announcementActor() || !canAccessAdminPanel() || announcementSaveRequest) return;
  const item = state.announcements.find(announcement => announcement.id === id);
  if (!item || item.archived_at) return;
  announcementEditorId = id;
  document.getElementById('ann-title').value = item.title;
  document.getElementById('ann-body').value = item.body;
  document.getElementById('ann-audience').value = item.audience;
  document.getElementById('ann-expires').value = item.expires_at ? `${berlinDateKey(item.expires_at)}T${berlinTimeLabel(item.expires_at)}` : '';
  document.getElementById('ann-action-label').value = item.action_label;
  document.getElementById('ann-pinned').checked = item.pinned;
  document.getElementById('ann-editor-title').textContent = 'Edit announcement';
  document.getElementById('ann-submit').textContent = 'Save changes';
  document.getElementById('ann-edit-cancel').hidden = false;
  document.getElementById('ann-save-status').textContent = 'Editing keeps existing read status and does not send duplicate notifications.';
  announcementActionChoices(item.action_url);
  document.getElementById('ann-title').focus();
}

function previewAnnouncement() {
  if (!announcementActor() || !canAccessAdminPanel()) return;
  try {
    const item = announcementFormPayload();
    announcementReaderRequest += 1;
    paintAnnouncementReader(item, true);
    openModal('announcement-reader-modal');
  } catch (error) { showToast(error.message, 'error'); }
}

function renderAdminAnn() {
  const list = document.getElementById('admin-ann-list');
  if (!list) return;
  if (!announcementActor() || !canAccessAdminPanel()) { list.innerHTML = ''; return; }
  if (!document.getElementById('ann-action-url').options.length) announcementActionChoices();
  const row = item => `<div class="admin-row announcement-admin-row"><div><div class="announcement-row-meta">${escapeHtml(announcementAudiences[item.audience])} · ${escapeHtml(item.date)}${item.archived_at ? ' · Archived' : !announcementIsActive(item) ? ' · Expired' : item.pinned ? ' · Pinned' : ''}</div><strong>${escapeHtml(item.title)}</strong><p class="announcement-excerpt">${escapeHtml(item.body)}</p>${item.expires_at ? `<small>Expires ${escapeHtml(formatBerlinDateTime(item.expires_at, { dateStyle: 'medium', timeStyle: 'short' }))} · Berlin time</small>` : ''}</div><div class="announcement-admin-actions">${!item.archived_at ? `<button type="button" class="btn btn-ghost btn-sm" data-announcement-edit="${escapeHtml(item.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-announcement-archive="${escapeHtml(item.id)}">Archive</button>` : ''}<button type="button" class="btn btn-danger btn-sm" data-announcement-delete="${escapeHtml(item.id)}">Delete</button></div></div>`;
  const active = state.announcements.filter(item => !item.archived_at && announcementIsActive(item));
  const older = state.announcements.filter(item => item.archived_at || !announcementIsActive(item));
  list.innerHTML = active.map(row).join('') || '<div class="dashboard-empty">No active announcements.</div>';
  if (older.length) list.innerHTML += `<details class="announcement-older"><summary>Archived and expired (${older.length})</summary>${older.map(row).join('')}</details>`;
}

async function postAnnouncement() {
  const actor = announcementActor();
  if (!actor || !canAccessAdminPanel() || !supabaseClient || announcementSaveRequest) return;
  let payload;
  try { payload = announcementFormPayload(); } catch (error) { showToast(error.message, 'error'); return; }
  const request = { actor, id: announcementEditorId };
  announcementSaveRequest = request;
  const button = document.getElementById('ann-submit');
  button.disabled = true; button.textContent = 'Saving…';
  try {
    const query = request.id ? supabaseClient.from('announcements').update(payload).eq('id', request.id) : supabaseClient.from('announcements').insert(payload);
    const { data, error } = await withCrewCenterDataTimeout(query.select('*').single(), 'announcements');
    if (actor !== announcementActor()) return;
    if (error || !data) throw new Error('Could not save the announcement. Check your connection and announcement setup, then try again.');
    const item = normalizeAnnouncement(data);
    // The server may have unpinned another post. Refresh after retaining the successful save.
    state.announcements = [item, ...state.announcements.filter(announcement => announcement.id !== item.id)];
    resetAnnouncementEditor(); renderAdminAnn(); renderAnnouncementSurfaces();
    showToast(request.id ? 'Announcement updated.' : 'Announcement published.');
    await loadCrewCenterData({ datasets: ['announcements', 'notifications'], silent: true });
    if (actor === announcementActor()) { renderAdminAnn(); renderAnnouncementSurfaces(); renderNotificationCenter(); }
  } catch (error) {
    if (actor === announcementActor()) showToast(error.message || 'Could not save the announcement. Please try again.', 'error');
  } finally {
    if (announcementSaveRequest === request) {
      announcementSaveRequest = null;
      button.disabled = false; button.textContent = announcementEditorId ? 'Save changes' : 'Publish';
    }
  }
}

function requestArchiveAnnouncement(id) {
  if (!announcementActor() || !canAccessAdminPanel()) return;
  const item = state.announcements.find(announcement => announcement.id === id);
  if (!item || item.archived_at) return;
  openActionConfirmation({ kind: 'archive-announcement', title: `Archive “${item.title}”?`, copy: 'It will leave the dashboard and notification bell. The post remains in your archive.', confirmLabel: 'Archive announcement', busyLabel: 'Archiving…', execute: () => mutateAnnouncement(id, false) });
}

function requestDeleteAnnouncement(id) {
  if (!announcementActor() || !canAccessAdminPanel()) return;
  const item = state.announcements.find(announcement => announcement.id === id);
  if (!item) return;
  openActionConfirmation({ kind: 'delete-announcement', title: `Delete “${item.title}”?`, copy: 'The announcement and its notifications will be permanently removed. This cannot be undone.', danger: true, confirmLabel: 'Delete announcement', busyLabel: 'Deleting…', execute: () => deleteAnn(id) });
}

async function mutateAnnouncement(id, remove) {
  const actor = announcementActor();
  if (!actor || !canAccessAdminPanel() || !supabaseClient) return false;
  try {
    const query = remove ? supabaseClient.from('announcements').delete() : supabaseClient.from('announcements').update({ archived_at: new Date().toISOString(), pinned: false });
    const { data, error } = await withCrewCenterDataTimeout(query.eq('id', id).select('id').single(), 'announcements');
    if (actor !== announcementActor()) return false;
    if (error || !data) throw new Error('Could not change the announcement. Please try again.');
    if (announcementEditorId === id) resetAnnouncementEditor();
    state.announcements = state.announcements.flatMap(item => item.id !== id ? [item] : remove ? [] : [{ ...item, archived_at: new Date().toISOString(), pinned: false }]);
    state.notifications = state.notifications.filter(item => item.related_announcement_id !== id);
    renderAdminAnn(); renderAnnouncementSurfaces(); renderNotificationCenter();
    showToast(remove ? 'Announcement deleted.' : 'Announcement archived.');
    await loadCrewCenterData({ datasets: ['announcements', 'notifications'], silent: true });
    return true;
  } catch (error) { if (actor === announcementActor()) showToast(error.message, 'error'); return false; }
}

function deleteAnn(id) { return mutateAnnouncement(id, true); }

document.addEventListener('click', event => {
  const open = event.target.closest?.('[data-announcement-open]');
  if (open) openAnnouncement(open.dataset.announcementOpen);
  const edit = event.target.closest?.('[data-announcement-edit]');
  if (edit) editAnnouncement(edit.dataset.announcementEdit);
  const archive = event.target.closest?.('[data-announcement-archive]');
  if (archive) requestArchiveAnnouncement(archive.dataset.announcementArchive);
  const remove = event.target.closest?.('[data-announcement-delete]');
  if (remove) requestDeleteAnnouncement(remove.dataset.announcementDelete);
  if (event.target.closest?.('[data-announcement-preview]')) previewAnnouncement();
  if (event.target.closest?.('[data-announcement-edit-cancel]') && !announcementSaveRequest) resetAnnouncementEditor();
  if (event.target.closest?.('[data-announcement-retry]')) loadCrewCenterData({ datasets: ['announcements'], silent: false });
  if (event.target.closest?.('[data-announcement-action]')) closeModal('announcement-reader-modal');
});
document.getElementById('ann-audience').addEventListener('change', () => announcementActionChoices());
document.getElementById('ann-action-url').addEventListener('change', event => {
  const label = document.getElementById('ann-action-label');
  label.disabled = !event.target.value;
  if (event.target.value && !label.value) label.value = `Open ${event.target.selectedOptions[0].textContent.toLowerCase()}`;
});

// Expiry is evaluated on reads by RLS, and while an already-open page is idle.
let announcementActiveSignature = '';
setInterval(() => {
  if (!announcementActor()) return;
  const signature = state.announcements.filter(item => announcementIsActive(item)).map(item => item.id).join(',');
  if (signature === announcementActiveSignature) return;
  announcementActiveSignature = signature;
  renderAnnouncementSurfaces(); renderNotificationCenter();
  if (document.getElementById('page-home').classList.contains('active')) renderDashboard();
}, 30000);
