// ══════════════════════════════
// MODAL
// ══════════════════════════════
const modalStack = [];
const modalBackgroundInert = new Map();

function topModal() {
  return modalStack.at(-1)?.backdrop || null;
}

function modalFocusableElements(modal) {
  return [...modal.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]')]
    .filter(element => !element.disabled && element.getAttribute('tabindex') !== '-1'
      && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'
      && !element.closest('[inert]'));
}

function syncModalLayers() {
  const top = topModal();
  if (top) {
    for (const element of document.body.children) {
      if (['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName) || element.classList.contains('toast-container')) continue;
      if (!modalBackgroundInert.has(element)) modalBackgroundInert.set(element, element.inert);
      element.inert = element !== top;
    }
  } else {
    modalBackgroundInert.forEach((wasInert, element) => { element.inert = wasInert; });
    modalBackgroundInert.clear();
  }
  document.body.classList.toggle('modal-open', Boolean(top));
  modalStack.forEach(({ backdrop }, index) => {
    backdrop.style.zIndex = String(200 + index);
    if (backdrop === top) backdrop.setAttribute('aria-modal', 'true');
    else backdrop.removeAttribute('aria-modal');
  });
}

function focusModal(modal) {
  const focusable = modalFocusableElements(modal);
  (focusable.find(element => element.hasAttribute('autofocus')) || focusable[0] || modal).focus();
}

function openModal(id) {
  window.closeCrewDatePicker?.({ immediate: true, returnFocus: false });
  if (id === 'gallery-modal') {
    renderGalleryAuthorField();
    const galleryScope = document.getElementById('gal-scope');
    if (galleryScope) galleryScope.value = state.galleryView === 'athletics' ? 'athletics' : 'showcase';
    updateGalleryScopeHelp();
  }
  const backdrop = document.getElementById(id);
  if (!backdrop) return;
  if (!modalStack.some(entry => entry.backdrop === backdrop)) {
    modalStack.push({ backdrop, returnFocus: document.activeElement });
  }
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('tabindex', '-1');
  const title = backdrop.querySelector('.modal-title');
  if (title && !backdrop.hasAttribute('aria-labelledby') && !backdrop.hasAttribute('aria-label')) {
    if (!title.id) title.id = `${id}-title`;
    backdrop.setAttribute('aria-labelledby', title.id);
  }
  backdrop.classList.add('open');
  syncModalLayers();
  requestAnimationFrame(() => {
    if (topModal() === backdrop && backdrop.classList.contains('open')) focusModal(backdrop);
  });
}
function closeModal(id) {
  window.closeCrewDatePicker?.({ immediate: true, returnFocus: false });
  const backdrop = document.getElementById(id);
  if (!backdrop) return;
  const index = modalStack.findIndex(entry => entry.backdrop === backdrop);
  const wasTop = backdrop === topModal();
  const entry = index >= 0 ? modalStack.splice(index, 1)[0] : null;
  if (id === 'action-confirmation-modal') actionConfirmation = null;
  if (id === 'announcement-reader-modal') window.announcementReaderClosed?.();
  backdrop.classList.remove('open');
  backdrop.removeAttribute('aria-modal');
  backdrop.style.zIndex = '';
  syncModalLayers();
  if (!wasTop) return;
  let target = entry?.returnFocus;
  if (id === 'announcement-reader-modal' && (!target?.isConnected || !target.getClientRects().length || target.closest('[inert]'))) {
    target = window.announcementReaderReturnFocus?.(target) || target;
  }
  const top = topModal();
  if (target instanceof HTMLElement && target.isConnected && target.getClientRects().length
    && !target.closest('[inert]') && (!top || top.contains(target))) target.focus();
  else if (top) focusModal(top);
}

window.closeCrewCenterModals = function() {
  window.closeCrewDatePicker?.({ immediate: true, returnFocus: false });
  while (topModal()) closeModal(topModal().id);
};

document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m && topModal() === m) closeModal(m.id); });
});

document.addEventListener('keydown', event => {
  const modal = topModal();
  if (!modal) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (modal.id === 'action-confirmation-modal') closeActionConfirmation();
    else closeModal(modal.id);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = modalFocusableElements(modal);
  if (!focusable.length) { event.preventDefault(); modal.focus(); return; }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
});

let actionConfirmation = null;

function openActionConfirmation(config) {
  actionConfirmation = { stage: 1, ...config };
  const modal = document.getElementById('action-confirmation-modal');
  document.getElementById('action-confirmation-title').textContent = config.title;
  document.getElementById('action-confirmation-copy').textContent = config.copy || '';
  const impact = document.getElementById('action-confirmation-impact');
  impact.replaceChildren();
  (config.impact || []).forEach(line => {
    const row = document.createElement('div');
    row.textContent = line;
    impact.appendChild(row);
  });
  impact.hidden = !(config.impact || []).length;
  impact.classList.toggle('danger', Boolean(config.danger));
  const acknowledgementWrap = document.getElementById('action-confirmation-ack-wrap');
  const acknowledgement = document.getElementById('action-confirmation-ack');
  acknowledgement.checked = false;
  acknowledgementWrap.hidden = !config.requiresAcknowledgement;
  document.getElementById('action-confirmation-ack-copy').textContent = config.acknowledgementCopy || 'I understand this action cannot be undone.';
  const nameWrap = document.getElementById('action-confirmation-name-wrap');
  const nameInput = document.getElementById('action-confirmation-name');
  nameInput.value = '';
  nameWrap.hidden = !config.expectedName;
  document.getElementById('action-confirmation-name-help').textContent = config.expectedName ? `Type “${config.expectedName}” exactly.` : '';
  document.getElementById('action-confirmation-final-warning').hidden = true;
  document.getElementById('action-confirmation-dismiss').textContent = config.cancelLabel || 'Cancel';
  const submit = document.getElementById('action-confirmation-submit');
  submit.textContent = config.multipleWarnings ? 'Continue to final warning' : config.confirmLabel || 'Confirm';
  submit.className = `btn ${config.danger ? 'btn-danger' : 'btn-accent'}`;
  submit.disabled = false;
  modal.dataset.mode = config.kind || '';
  openModal('action-confirmation-modal');
  syncActionConfirmationButton();
}

function syncActionConfirmationButton() {
  if (!actionConfirmation) return;
  const acknowledged = !actionConfirmation.requiresAcknowledgement || document.getElementById('action-confirmation-ack').checked;
  const nameMatches = !actionConfirmation.expectedName || document.getElementById('action-confirmation-name').value === actionConfirmation.expectedName;
  document.getElementById('action-confirmation-submit').disabled = Boolean(actionConfirmation.busy) || !(acknowledged && nameMatches);
}

function closeActionConfirmation() {
  actionConfirmation = null;
  closeModal('action-confirmation-modal');
}

async function submitActionConfirmation() {
  if (!actionConfirmation) return;
  const confirmation = actionConfirmation;
  const submit = document.getElementById('action-confirmation-submit');
  syncActionConfirmationButton();
  if (submit.disabled) return;
  if (actionConfirmation.multipleWarnings && actionConfirmation.stage === 1) {
    actionConfirmation.stage = 2;
    document.getElementById('action-confirmation-title').textContent = 'Final permanent-deletion warning';
    document.getElementById('action-confirmation-copy').textContent = 'This is the final step. Selecting the button below immediately erases the record and every related row.';
    document.getElementById('action-confirmation-final-warning').hidden = false;
    submit.textContent = actionConfirmation.confirmLabel || 'Permanently delete everything';
    submit.focus();
    return;
  }
  confirmation.busy = true;
  submit.disabled = true;
  const previousLabel = submit.textContent;
  submit.textContent = actionConfirmation.busyLabel || 'Working...';
  try {
    const completed = await confirmation.execute();
    if (completed !== false && actionConfirmation === confirmation) closeActionConfirmation();
  } catch (error) {
    showToast(error?.message || "Couldn't complete the action.", 'error', 7000);
  } finally {
    if (actionConfirmation === confirmation) {
      confirmation.busy = false;
      submit.disabled = false;
      submit.textContent = previousLabel;
      syncActionConfirmationButton();
    }
  }
}

// ══════════════════════════════
// TOAST
// ══════════════════════════════
function showToast(msg, type = 'success', duration = 3500) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.setAttribute('aria-atomic', 'true');
  const icon = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  t.innerHTML = icon;
  const message = document.createElement('span');
  message.textContent = String(msg ?? '');
  t.appendChild(message);
  c.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ══════════════════════════════
// HELPERS
// ══════════════════════════════
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function fmtDate(d) {
  const [year, month, day] = String(d || '').split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TIME_ZONE, day: 'numeric', month: 'short' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function fmtMonth(d) {
  const [year, month, day] = String(d || '').split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TIME_ZONE, month: 'short' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function fmtDay(d) { return Number(String(d || '').split('-')[2]) || ''; }
function catColor(cat) {
  return { Livestream: 'coral', 'Recording (live cut)': 'teal', Event: 'green', Other: 'gray' }[cat] || 'gray';
}

function formatEventDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: BERLIN_TIME_ZONE })
    .format(new Date(`${date}T00:00:00Z`));
}

function livestreamSetupCaption(ev) {
  if (ev.cat !== 'Livestream' || !ev.livestreamSetupDate) return '';
  return `Setup occurs on ${formatEventDate(ev.livestreamSetupDate)} at 15:15.`;
}

function sportsScheduleCaption(ev) {
  if (!ev.isSports) return '';
  return `Game 1: ${ev.game1Start}–${ev.game1End} · Game 2: ${ev.game2Start}–${ev.game2End}`;
}
function isstScheduleCaption(ev) {
  if (!ev.isIsst) return '';
  const games = [
    `Game 1: ${ev.game1Start}–${ev.game1End}`,
    `Game 2: ${ev.game2Start}–${ev.game2End}`,
    `Game 3: ${ev.game3Start}–${ev.game3End}`,
  ];
  if (ev.game4Start && ev.game4End) games.push(`Game 4: ${ev.game4Start}–${ev.game4End}`);
  return games.join(' · ');
}
function festivalScheduleCaption(ev) {
  if (!ev.isFestival) return '';
  return `Setup ${ev.setupStart}–${ev.setupEnd} · Shift 1 ${ev.shift1Start}–${ev.shift1End} · Shift 2 ${ev.shift2Start}–${ev.shift2End} · Takedown ${ev.takedownStart}–${ev.takedownEnd}`;
}
function eventScheduleSegments(ev) {
  if (ev?.isFestival) {
    return [
      { key: 'setup', label: 'Setup', start: ev.setupStart, end: ev.setupEnd },
      { key: 'shift_1', label: 'Shift 1', start: ev.shift1Start, end: ev.shift1End },
      { key: 'shift_2', label: 'Shift 2', start: ev.shift2Start, end: ev.shift2End },
      { key: 'takedown', label: 'Takedown', start: ev.takedownStart, end: ev.takedownEnd },
    ].filter(segment => segment.start && segment.end);
  }
  if (ev?.isIsst) {
    return [1, 2, 3, 4].map(number => ({
      key: `game_${number}`,
      label: `Game ${number}`,
      start: ev[`game${number}Start`],
      end: ev[`game${number}End`],
    })).filter(segment => segment.start && segment.end);
  }
  if (ev?.isSports) {
    return [1, 2].map(number => ({
      key: `game_${number}`,
      label: `Game ${number}`,
      start: ev[`game${number}Start`],
      end: ev[`game${number}End`],
    })).filter(segment => segment.start && segment.end);
  }
  return [];
}
function memberColor(c) {
  const map = { green: ['var(--accent-dim)', 'var(--accent)'], purple: ['var(--purple-dim)', 'var(--purple)'], coral: ['var(--coral-dim)', 'var(--coral)'], amber: ['var(--amber-dim)', 'var(--amber)'], teal: ['var(--teal-dim)', 'var(--teal)'], blue: ['var(--blue-dim)', 'var(--blue)'] };
  return map[c] || map.purple;
}
function initials(f = '', l = '') { return ((f[0] || '') + (l[0] || f[1] || '')).toUpperCase(); }
function toggleCheck(eventOrEl, maybeEl) {
  const event = maybeEl ? eventOrEl : null;
  const el = maybeEl || eventOrEl;
  if (event) event.preventDefault();
  el.classList.toggle('checked');
  el.querySelector('input').checked = el.classList.contains('checked');
}

function applyCheckedState(input, checked) {
  input.checked = checked;
  input.closest('.checkbox-label').classList.toggle('checked', checked);
}

function updateDashboardGreeting() {
  const elements = ['dashboard-greeting', 'sac-home-greeting'].map(id => document.getElementById(id)).filter(Boolean);
  if (!elements.length) return;
  const berlinHour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()));
  const greeting = berlinHour >= 18 || berlinHour < 5
    ? 'Good evening'
      : berlinHour >= 12
        ? 'Good afternoon'
        : 'Good morning';
  const firstName = isVisitorSession()
    ? 'Visitor'
    : splitName(currentMemberRecord()?.name || '').fname;
  const sacGreeting = document.getElementById('sac-home-greeting');
  const showSacName = typeof sacDashboardPreferences !== 'function' || sacDashboardPreferences().showName;
  elements.forEach(el => { el.textContent = firstName && (el !== sacGreeting || showSacName) ? `${greeting}, ${firstName}` : greeting; });
}

function updateUserSurfaces() {
  const user = state.currentUser;
  const [bg, fg] = memberColor(user.color);
  const avatarUrl = user.avatarUrl || '';
  const accountRole = user.isVisitor ? 'Visitor' : user.isAdmin ? 'Admin' : 'Member';
  document.getElementById('sidebar-user-name').textContent = user.name;
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  sidebarAvatar.textContent = avatarUrl ? '' : user.initials;
  sidebarAvatar.style.background = avatarUrl ? `url("${avatarUrl}") center/cover` : bg;
  sidebarAvatar.style.color = fg;
  const previewAvatar = document.getElementById('profile-preview-avatar');
  if (previewAvatar) {
    previewAvatar.textContent = avatarUrl ? '' : user.initials;
    previewAvatar.style.background = avatarUrl ? `url("${avatarUrl}") center/cover` : bg;
    previewAvatar.style.color = fg;
    document.getElementById('profile-preview-name').textContent = user.name;
    document.getElementById('profile-preview-role').textContent = accountRole;
    document.getElementById('profile-preview-email').textContent = '';
  }
  updateDashboardGreeting();
  renderProfileWorkspace();
}

function syncCurrentUserWithMemberRecord() {
  if (isVisitorSession()) return;
  const member = currentMemberRecord();
  if (!member) return;
  state.currentUser.name = member.name;
  state.currentUser.initials = initials(member.fname, member.lname);
  state.currentUser.avatarUrl = member.avatarUrl || '';
  state.currentUser.avatarPath = member.avatarPath || '';
  updateUserSurfaces();
}

window.applyCrewCenterAuthUser = function(user) {
  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};
  const isVisitor = Boolean(user.is_anonymous) || (appMetadata.role || metadata.role || '').toLowerCase() === 'visitor';
  state.currentUser.email = user.email || '';
  const member = currentMemberRecord();
  state.currentUser.name = member?.name || (isVisitor ? 'Visitor' : 'Media Club member');
  state.currentUser.role = isVisitor ? 'Visitor' : appMetadata.role || metadata.role || 'Member';
  state.currentUser.isAdmin = (appMetadata.role || '').toLowerCase() === 'admin';
  state.currentUser.isVisitor = isVisitor;
  state.currentUser.initials = member ? initials(member.fname, member.lname) : isVisitor ? 'V' : 'MC';
  state.currentUser.avatarUrl = member?.avatarUrl || '';
  state.currentUser.avatarPath = member?.avatarPath || '';
  updateUserSurfaces();
  renderSignupRoleOptions(state.events.find(event => event.id === document.getElementById('sheet-event-select')?.value));
  renderSignupNameField();
};

function renderProfile() {
  updateUserSurfaces();
  updateThemeChoices();
  renderProfileWorkspace();
  const isSac = currentCrewCenterWorkspace() === 'sac';
  const memberSettingsAvailable = !isVisitorSession() && (!state.dataLoaded.members || Boolean(currentMemberRecord()));
  [
    ['settings-tab-personalisation', 'settings-panel-personalisation'],
    ['dashboard-settings-tab', 'dashboard-preferences-panel'],
    ['settings-tab-sidebar', 'sidebar-preferences-panel'],
    ['settings-tab-notifications', 'notification-preferences-panel'],
    ['tutorial-settings-tab', 'tutorial-settings-panel'],
  ].forEach(([tabId, panelId]) => {
    const tab = document.getElementById(tabId);
    const panel = document.getElementById(panelId);
    const available = memberSettingsAvailable && (!isSac || tabId === 'dashboard-settings-tab');
    if (tab) tab.style.display = available ? '' : 'none';
    if (panel) panel.style.display = available ? '' : 'none';
  });
  if (isSac) renderSacDashboardSettings();
  else {
    renderDashboardSettings();
    renderSidebarSettings();
    renderNotificationSettings();
    renderPersonalEquipmentSettings();
  }
  document.getElementById('profile-photo-remove').style.display = state.currentUser.avatarUrl ? '' : 'none';
  showSettingsSection(tabValueFromUrl(['profile', 'appearance', 'personalisation', 'dashboard', 'sidebar', 'notifications', 'tutorials'], 'profile'));
}

function showSettingsSection(section) {
  let button = document.querySelector(`.settings-nav [data-settings-tab="${section}"]`);
  if (!button || button.hidden || getComputedStyle(button).display === 'none') {
    section = 'profile';
    button = document.querySelector('.settings-nav [data-settings-tab="profile"]');
  }
  document.querySelectorAll('.settings-content [data-settings-section]').forEach(panel => {
    const active = panel.dataset.settingsSection === section;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  document.querySelectorAll('.settings-nav [role="tab"]').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  });
}

function currentNotificationPreferences() {
  return currentMemberRecord()?.notificationPreferences || { event_created: true, event_reminders: true, maybe_reminders: true, email_event_updates: false, email_meeting_updates: false };
}

function renderNotificationSettings() {
  const preferences = currentNotificationPreferences();
  const mapping = {
    'notify-event-created': 'event_created',
    'notify-event-reminders': 'event_reminders',
    'notify-maybe-reminders': 'maybe_reminders',
    'notify-email-event-updates': 'email_event_updates',
    'notify-email-meeting-updates': 'email_meeting_updates',
  };
  Object.entries(mapping).forEach(([id, key]) => { const input = document.getElementById(id); if (input) input.checked = preferences[key]; });
}

function currentPersonalEquipmentPreferences() {
  return currentMemberRecord()?.personalEquipmentPreferences || { cameraName: '', autoUseCamera: false };
}

function renderPersonalEquipmentSettings() {
  const cameraInput = document.getElementById('personal-camera-name');
  const autoUseInput = document.getElementById('personal-camera-auto-use');
  if (!cameraInput || !autoUseInput) return;
  const preferences = currentPersonalEquipmentPreferences();
  cameraInput.value = preferences.cameraName || '';
  autoUseInput.checked = Boolean(preferences.autoUseCamera && preferences.cameraName);
  updatePersonalEquipmentPreview();
}

function updatePersonalEquipmentPreview() {
  const cameraInput = document.getElementById('personal-camera-name');
  const autoUseInput = document.getElementById('personal-camera-auto-use');
  const preview = document.getElementById('personal-kit-preview');
  if (!cameraInput || !autoUseInput || !preview) return;
  const cameraName = cameraInput.value.trim();
  autoUseInput.disabled = !cameraName;
  if (!cameraName) autoUseInput.checked = false;
  preview.classList.toggle('configured', Boolean(cameraName));
  preview.innerHTML = cameraName
    ? `<span class="personal-kit-preview-dot"></span><div><small>PHOTOGRAPHER LOADOUT</small><strong>${escapeHtml(cameraName)}</strong><span>${autoUseInput.checked ? 'Auto-select is armed' : 'Available when you choose My camera'}</span></div>`
    : '<span class="personal-kit-preview-dot idle"></span><div><small>NO PERSONAL CAMERA</small><strong>Club equipment stays default</strong><span>Add a camera model to activate your personal loadout.</span></div>';
}

function clearPersonalEquipmentForm() {
  const cameraInput = document.getElementById('personal-camera-name');
  const autoUseInput = document.getElementById('personal-camera-auto-use');
  if (!cameraInput || !autoUseInput) return;
  cameraInput.value = '';
  autoUseInput.checked = false;
  updatePersonalEquipmentPreview();
  showToast('Personal camera cleared in this form. Save to sync the change.');
}

async function savePersonalEquipmentPreferences() {
  const cameraInput = document.getElementById('personal-camera-name');
  const autoUseInput = document.getElementById('personal-camera-auto-use');
  const cameraName = cameraInput?.value.trim() || '';
  const autoUseCamera = Boolean(cameraName && autoUseInput?.checked);
  if (cameraName.length > 80) {
    showToast('Keep the camera name within 80 characters.', 'error');
    return;
  }
  const button = document.getElementById('personal-equipment-save');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  const preferences = { camera_name: cameraName, auto_use_camera: autoUseCamera };
  const { data, error } = await supabaseClient.rpc('update_own_personal_equipment_preferences', { p_preferences: preferences });
  if (button) { button.disabled = false; button.textContent = 'Save personal kit'; }
  if (error || !data) {
    showToast("Couldn't save your personal kit. Run the latest Supabase SQL files first.", 'error');
    return;
  }
  const member = currentMemberRecord();
  if (member) member.personalEquipmentPreferences = { cameraName, autoUseCamera };
  updatePersonalEquipmentPreview();
  renderSignupCameraSource();
  showToast(cameraName ? 'Personal camera synced to your account.' : 'Personal camera removed from your account.');
}

async function saveNotificationPreferences() {
  const preferences = {
    event_created: Boolean(document.getElementById('notify-event-created')?.checked),
    event_reminders: Boolean(document.getElementById('notify-event-reminders')?.checked),
    maybe_reminders: Boolean(document.getElementById('notify-maybe-reminders')?.checked),
    email_event_updates: Boolean(document.getElementById('notify-email-event-updates')?.checked),
    email_meeting_updates: Boolean(document.getElementById('notify-email-meeting-updates')?.checked),
  };
  const button = document.getElementById('notification-preference-save');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  const { data, error } = await supabaseClient.rpc('update_own_notification_preferences', { p_preferences: preferences });
  if (button) { button.disabled = false; button.textContent = 'Save notifications'; }
  if (error || !data) { showToast("Couldn't save notification settings. Run the latest Supabase SQL files first.", 'error'); return; }
  const member = currentMemberRecord();
  if (member) member.notificationPreferences = preferences;
  renderNotificationCenter();
  showToast('Notification settings saved.');
}

function ownUpcomingSignups() {
  const memberId = currentMemberRecord()?.id;
  if (!memberId) return [];
  return state.events.flatMap(event => event.signups.filter(signup => signup.memberId === memberId).map(signup => ({ event, signup })));
}

const notificationReminderReadStoragePrefix = 'crew-center-read-notification-reminders:';
const notificationReminderReadFallback = new Map();

function notificationReminderReadKey(type, event, signup) {
  const revision = type === 'maybe'
    ? signup.confirmationDeadline || ''
    : String(timeValue(event.date, event.setupStart || event.game1Start || event.time || '00:00') || '');
  return `${type}:${event.id}:${signup.id}:${revision}`;
}

function notificationReminderStorageKey() {
  const memberId = currentMemberRecord()?.id;
  return memberId ? `${notificationReminderReadStoragePrefix}${memberId}` : '';
}

function notificationReminderReadKeys() {
  const storageKey = notificationReminderStorageKey();
  if (!storageKey) return new Set();
  const readKeys = new Set(notificationReminderReadFallback.get(storageKey) || []);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) saved.filter(value => typeof value === 'string').forEach(value => readKeys.add(value));
  } catch {
    // Keep the acknowledgement for this page session when browser storage is unavailable.
  }
  return readKeys;
}

function markNotificationRemindersRead(keys) {
  const storageKey = notificationReminderStorageKey();
  if (!storageKey || !keys.length) return;
  const readKeys = notificationReminderReadKeys();
  keys.forEach(key => readKeys.add(key));
  notificationReminderReadFallback.set(storageKey, readKeys);
  try {
    localStorage.setItem(storageKey, JSON.stringify([...readKeys].slice(-100)));
  } catch {
    // The in-memory acknowledgement still makes the button work for this page session.
  }
}

function currentGeneratedNotificationItems(now = Date.now()) {
  const preferences = currentNotificationPreferences();
  const ownSignups = ownUpcomingSignups();
  const maybeItems = preferences.maybe_reminders ? ownSignups.filter(({ signup }) => signup.confirmationStatus === 'maybe' && new Date(signup.confirmationDeadline).getTime() > now) : [];
  const upcomingItems = preferences.event_reminders ? ownSignups.filter(({ event, signup }) => {
    const startsAt = timeValue(event.date, event.setupStart || event.game1Start || event.time || '00:00');
    return signup.confirmationStatus === 'confirmed' && startsAt > now && startsAt - now <= 24 * 60 * 60 * 1000;
  }) : [];
  return {
    maybeItems: maybeItems.map(item => ({ ...item, readKey: notificationReminderReadKey('maybe', item.event, item.signup) })),
    upcomingItems: upcomingItems.map(item => ({ ...item, readKey: notificationReminderReadKey('upcoming', item.event, item.signup) })),
  };
}

let notificationReadRequest = null;
let notificationInboxFilter = 'all';
let notificationInboxActor = '';
let notificationInboxAnimation = null;
const notificationItemRequests = new Map();

function notificationReadActor() {
  const user = window.CREW_CENTER_AUTH_USER;
  const member = currentMemberRecord();
  if (isVisitorSession() || !user?.id || !user.email || !member?.id
    || String(member.email || '').toLowerCase() !== user.email.toLowerCase()) return '';
  return `${user.id}:${Number(window.CREW_CENTER_AUTH_EPOCH || 0)}:${member.id}`;
}

function notificationInboxItems(now = Date.now()) {
  const preferences = currentNotificationPreferences();
  const { maybeItems, upcomingItems } = currentGeneratedNotificationItems(now);
  const readKeys = notificationReminderReadKeys();
  const memberId = currentMemberRecord()?.id;
  const stored = state.notifications.filter(item => item.member_id === memberId
    && (['meeting_invite', 'application_approved', 'announcement'].includes(item.notification_type) || preferences.event_created)
    && window.announcementNotificationVisible?.(item) !== false)
    .map(item => ({ kind: item.notification_type, stored: item, read: Boolean(item.read_at),
      date: Number.isFinite(Date.parse(item.created_at)) ? Date.parse(item.created_at) : now }));
  return [...maybeItems.map(item => ({ ...item, kind: 'maybe', read: readKeys.has(item.readKey), date: now })),
    ...upcomingItems.map(item => ({ ...item, kind: 'upcoming', read: readKeys.has(item.readKey), date: now })), ...stored]
    .sort((a, b) => b.date - a.date || Number(b.kind === 'maybe') - Number(a.kind === 'maybe'));
}

function notificationInboxGroups(items, now = Date.now()) {
  const today = berlinDateKey(now);
  const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const groups = new Map();
  items.forEach(item => {
    const day = berlinDateKey(item.date);
    if (!groups.has(day)) groups.set(day, { day, label: day === today ? 'Today' : day === yesterday.toISOString().slice(0, 10)
      ? 'Yesterday' : formatBerlinDateTime(item.date, { day: 'numeric', month: 'short', year: 'numeric' }), items: [] });
    groups.get(day).items.push(item);
  });
  return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day));
}

function notificationInboxIcon(kind) {
  const path = kind === 'announcement' ? '<path d="m3 11 13-5v12L3 13zM7 14l2 6h3l-2-5M20 9v6"/>'
    : kind === 'meeting_invite' ? '<circle cx="8" cy="8" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 5 5"/>'
    : kind === 'application_approved' ? '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
    : kind === 'maybe' ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    : '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>';
  return `<span class="notification-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${path}</svg></span>`;
}

function notificationInboxRow(item) {
  const icon = notificationInboxIcon(item.kind);
  const unread = item.read ? '' : ' unread';
  if (item.kind === 'maybe') {
    const { event, signup } = item;
    return `<div class="notification-item action${unread}" data-notification-reminder="${escapeHtml(item.readKey)}">${icon}<div class="notification-item-content"><div class="notification-item-title">Confirm ${escapeHtml(event.title)}</div><div class="notification-item-copy">Your ${escapeHtml(signup.role || 'event')} signup is marked Maybe. Confirm within ${escapeHtml(confirmationCountdown(signup.confirmationDeadline))} or the position becomes vacant.</div><div class="notification-actions"><button class="btn btn-accent btn-sm" onclick="confirmMaybeSignup('${event.id}','${signup.id}')">Confirm attendance</button><button class="btn btn-danger btn-sm" onclick="requestRemoveSignup('${event.id}','${signup.id}')">Remove</button></div></div></div>`;
  }
  if (item.kind === 'upcoming') {
    const href = typeof personalDestinationUrl === 'function' ? personalDestinationUrl('signup', 'media', { event: item.event.id }) : pageUrl('signup', { event: item.event.id });
    return `<a class="notification-item action${unread}" href="${escapeHtml(href)}" data-personal-destination="media" data-notification-reminder="${escapeHtml(item.readKey)}">${icon}<span class="notification-item-content"><span class="notification-item-title">${escapeHtml(item.event.title)} is coming up</span><span class="notification-item-copy">You are confirmed for ${escapeHtml(fmtDate(item.event.date))} at ${escapeHtml(eventScheduleTimeLabel(item.event))}.</span><span class="notification-item-meta">Upcoming event</span></span></a>`;
  }
  const notice = item.stored;
  const content = `${icon}<span class="notification-item-content"><span class="notification-item-title">${escapeHtml(notice.title)}</span><span class="notification-item-copy">${escapeHtml(notice.message)}</span><span class="notification-item-meta">${item.kind === 'announcement' ? 'Announcement · ' : item.kind === 'meeting_invite' ? 'Meeting · ' : ''}${escapeHtml(formatBerlinDateTime(item.date, { dateStyle: 'medium', timeStyle: 'short' }))}</span></span>`;
  if (item.kind === 'announcement' && notice.related_announcement_id) return `<button type="button" class="notification-item announcement-notification${unread}" data-announcement-open="${escapeHtml(notice.related_announcement_id)}">${content}</button>`;
  const page = Object.values(sidebarCategories).some(category => category.pages.includes(notice.page)) ? notice.page : 'events';
  const params = {};
  if (notice.related_event_id && state.events.some(event => event.id === notice.related_event_id)) params.event = notice.related_event_id;
  if (notice.related_meeting_id && page === 'meetings') params.meeting = notice.related_meeting_id;
  const workspace = item.kind === 'application_approved' && ['home', 'profile'].includes(page) && typeof currentCrewCenterWorkspace === 'function'
    ? currentCrewCenterWorkspace() : page.startsWith('sac-') ? 'sac' : 'media';
  const href = typeof personalDestinationUrl === 'function' ? personalDestinationUrl(page, workspace, params) : pageUrl(page, params);
  return `<a class="notification-item${unread}" href="${escapeHtml(href)}" data-personal-destination="${workspace}" data-notification-id="${escapeHtml(notice.id)}">${content}</a>`;
}

function renderNotificationCenter(animate = false) {
  const list = document.getElementById('notification-list');
  const badge = document.getElementById('notification-count');
  if (!list || !badge) return;
  const actor = notificationReadActor();
  const actorChanged = notificationInboxActor !== actor;
  const transition = animate && !actorChanged && actor && typeof list.animate === 'function'
    && document.getElementById('notification-panel')?.classList.contains('open')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const previousHeight = transition ? list.getBoundingClientRect().height : 0;
  notificationInboxAnimation?.cancel(); notificationInboxAnimation = null;
  if (actorChanged) { notificationInboxActor = actor; notificationInboxFilter = 'all'; }
  document.querySelectorAll?.('[data-notification-filter]').forEach(button => {
    const selected = button.dataset.notificationFilter === notificationInboxFilter;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('active', selected);
  });
  if (typeof updateSlidingTab === 'function') updateSlidingTab(document.querySelector('.notification-inbox-filters'));
  const markReadButton = document.getElementById('notification-mark-read');
  const pending = Boolean(actor && notificationReadRequest?.actor === actor);
  if (markReadButton) {
    markReadButton.textContent = pending ? 'Marking…' : 'Mark all read';
    markReadButton.setAttribute('aria-busy', String(pending));
  }
  if (!actor) {
    list.innerHTML = '<div class="empty-state" style="padding:24px 12px;"><p>Sign in with a linked member account to view notifications.</p></div>';
    badge.classList.remove('visible');
    if (markReadButton) markReadButton.disabled = true;
    return;
  }
  const items = notificationInboxItems();
  const unread = items.filter(item => !item.read).length;
  badge.textContent = unread > 99 ? '99+' : unread;
  badge.classList.toggle('visible', unread > 0);
  if (markReadButton) markReadButton.disabled = pending || unread === 0;
  const visible = notificationInboxFilter === 'unread' ? items.filter(item => !item.read) : items;
  list.innerHTML = notificationInboxGroups(visible).map(group => `<section class="notification-group"><h3>${escapeHtml(group.label)}</h3>${group.items.map(notificationInboxRow).join('')}</section>`).join('')
    || `<div class="empty-state" style="padding:28px 12px;"><p>${notificationInboxFilter === 'unread' ? 'No unread notifications. You’re all caught up.' : 'You’re all caught up.'}</p></div>`;
  if (transition) notificationInboxAnimation = list.animate([
    { height: `${previousHeight}px`, opacity: .35, transform: 'translateY(4px)' },
    { height: `${list.getBoundingClientRect().height}px`, opacity: 1, transform: 'translateY(0)' },
  ], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
}

window.resetNotificationInbox = function() {
  notificationInboxAnimation?.cancel(); notificationInboxAnimation = null;
  notificationInboxActor = ''; notificationInboxFilter = 'all';
  const list = document.getElementById('notification-list');
  if (list) list.innerHTML = '';
  closeNotificationPanel();
};

async function markNotificationRead(id) {
  const actor = notificationReadActor();
  const item = state.notifications.find(notice => notice.id === id && notice.member_id === currentMemberRecord()?.id);
  if (!actor || !item || item.read_at || !supabaseClient) return;
  const key = `${actor}:${id}`;
  if (notificationItemRequests.has(key)) return;
  notificationItemRequests.set(key, true);
  const request = (async () => {
    try {
      const { data, error } = await withCrewCenterDataTimeout(supabaseClient.rpc('mark_own_notification_read', { p_notification_id: id }), 'notifications');
      if (error || data !== true) throw error || new Error('Notification could not be acknowledged.');
      if (notificationReadActor() !== actor) return;
      const current = state.notifications.find(notice => notice.id === id && notice.member_id === currentMemberRecord()?.id);
      if (current) current.read_at = current.read_at || new Date().toISOString();
    } catch (_error) {
      if (notificationReadActor() === actor) showToast("Opened the update, but couldn't save its read status. Try again when connected.", 'error');
    } finally {
      notificationItemRequests.delete(key);
      renderNotificationCenter();
    }
  })();
  await request;
}

document.getElementById('notification-panel')?.addEventListener?.('click', event => {
  const filter = event.target.closest?.('[data-notification-filter]');
  if (filter) {
    const next = filter.dataset.notificationFilter === 'unread' ? 'unread' : 'all';
    if (next !== notificationInboxFilter) { notificationInboxFilter = next; renderNotificationCenter(true); }
    return;
  }
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const notice = event.target.closest?.('[data-notification-id]');
  if (notice) markNotificationRead(notice.dataset.notificationId);
  const reminder = event.target.closest?.('[data-notification-reminder]');
  if (reminder && notificationReadActor()) {
    markNotificationRemindersRead([reminder.dataset.notificationReminder]);
    renderNotificationCenter();
  }
});

function toggleNotificationPanel(event) {
  event?.stopPropagation();
  const panel = document.getElementById('notification-panel');
  const open = panel.classList.toggle('open');
  document.getElementById('notification-button')?.classList.toggle('active', open);
  document.getElementById('notification-button')?.setAttribute('aria-expanded', String(open));
  if (open) renderNotificationCenter();
}

function closeNotificationPanel() {
  document.getElementById('notification-panel')?.classList.remove('open');
  document.getElementById('notification-button')?.classList.remove('active');
  document.getElementById('notification-button')?.setAttribute('aria-expanded', 'false');
}

async function markNotificationsRead() {
  const actor = notificationReadActor();
  if (!actor || notificationReadRequest?.actor === actor) return;
  const request = { actor };
  notificationReadRequest = request;
  const { maybeItems, upcomingItems } = currentGeneratedNotificationItems();
  const memberId = currentMemberRecord().id;
  const unreadIds = new Set(state.notifications.filter(item => item.member_id === memberId && !item.read_at).map(item => item.id));
  renderNotificationCenter();
  try {
    if (unreadIds.size) {
      if (!supabaseClient) throw new Error('Notifications are unavailable.');
      const { error } = await withCrewCenterDataTimeout(supabaseClient.rpc('mark_own_notifications_read'), 'notifications');
      if (error) throw error;
    }
    if (notificationReadActor() !== actor) return;
    markNotificationRemindersRead([...maybeItems, ...upcomingItems].map(item => item.readKey));
    const readAt = new Date().toISOString();
    state.notifications.forEach(item => {
      if (unreadIds.has(item.id)) item.read_at = item.read_at || readAt;
    });
    showToast('Notifications marked as read.');
  } catch (_error) {
    if (notificationReadActor() === actor) showToast("Couldn't mark notifications as read. Check your connection and try again.", 'error');
  } finally {
    if (notificationReadRequest === request) notificationReadRequest = null;
    renderNotificationCenter();
  }
}

const PROFILE_MAX_FILE_SIZE = 15 * 1024 * 1024;
const PROFILE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const profileCrop = { image: null, url: '', zoom: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };

function profileCropScale() {
  if (!profileCrop.image) return 1;
  return Math.max(280 / profileCrop.image.naturalWidth, 280 / profileCrop.image.naturalHeight) * profileCrop.zoom;
}
function constrainProfileCrop() {
  if (!profileCrop.image) return;
  const scale = profileCropScale();
  const maxX = Math.max(0, (profileCrop.image.naturalWidth * scale - 280) / 2);
  const maxY = Math.max(0, (profileCrop.image.naturalHeight * scale - 280) / 2);
  profileCrop.x = Math.max(-maxX, Math.min(maxX, profileCrop.x));
  profileCrop.y = Math.max(-maxY, Math.min(maxY, profileCrop.y));
}
function renderProfileCrop() {
  if (!profileCrop.image) return;
  constrainProfileCrop();
  const scale = profileCropScale();
  profileCrop.image.style.width = `${profileCrop.image.naturalWidth * scale}px`;
  profileCrop.image.style.height = `${profileCrop.image.naturalHeight * scale}px`;
  profileCrop.image.style.transform = `translate(calc(-50% + ${profileCrop.x}px), calc(-50% + ${profileCrop.y}px))`;
}
function loadProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!PROFILE_ALLOWED_TYPES.has(file.type)) { event.target.value = ''; showToast('Choose a JPG, PNG, or WebP image.', 'error'); return; }
  if (file.size > PROFILE_MAX_FILE_SIZE) { event.target.value = ''; showToast('Profile pictures must be 15 MB or smaller.', 'error'); return; }
  if (profileCrop.url) URL.revokeObjectURL(profileCrop.url);
  profileCrop.url = URL.createObjectURL(file);
  const image = document.getElementById('profile-crop-image');
  image.onload = () => {
    profileCrop.image = image; profileCrop.zoom = 1; profileCrop.x = 0; profileCrop.y = 0;
    document.getElementById('profile-zoom-range').value = '1';
    image.style.display = 'block';
    document.getElementById('profile-crop-empty').style.display = 'none';
    document.getElementById('profile-zoom').classList.add('visible');
    document.getElementById('profile-photo-save').disabled = false;
    renderProfileCrop();
  };
  image.src = profileCrop.url;
}
function setProfileCropZoom(value) { profileCrop.zoom = Number(value); renderProfileCrop(); }
function initializeProfileCropDrag() {
  const frame = document.getElementById('profile-crop-frame');
  if (!frame || frame.dataset.dragReady) return;
  frame.dataset.dragReady = 'true';
  frame.addEventListener('pointerdown', event => {
    if (!profileCrop.image) return;
    profileCrop.dragging = true; profileCrop.lastX = event.clientX; profileCrop.lastY = event.clientY;
    frame.classList.add('dragging'); frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', event => {
    if (!profileCrop.dragging) return;
    profileCrop.x += event.clientX - profileCrop.lastX; profileCrop.y += event.clientY - profileCrop.lastY;
    profileCrop.lastX = event.clientX; profileCrop.lastY = event.clientY; renderProfileCrop();
  });
  const stop = () => { profileCrop.dragging = false; frame.classList.remove('dragging'); };
  frame.addEventListener('pointerup', stop); frame.addEventListener('pointercancel', stop);
}
async function croppedProfileBlob() {
  const image = profileCrop.image;
  const scale = profileCropScale();
  const sourceSize = 280 / scale;
  const sx = (image.naturalWidth - sourceSize) / 2 - profileCrop.x / scale;
  const sy = (image.naturalHeight - sourceSize) / 2 - profileCrop.y / scale;
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
  canvas.getContext('2d').drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, 640, 640);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .88));
}
async function saveProfilePhoto() {
  if (!profileCrop.image) return;
  const button = document.getElementById('profile-photo-save'); button.disabled = true; button.textContent = 'Saving...';
  const blob = await croppedProfileBlob();
  const { data: authData } = await supabaseClient.auth.getUser();
  const user = authData?.user;
  if (!user || !blob) { button.disabled = false; button.textContent = 'Save profile picture'; showToast('Could not prepare the profile picture.', 'error'); return; }
  const path = `${user.id}/avatar.webp`;
  const { error: uploadError } = await supabaseClient.storage.from('profile-pictures').upload(path, blob, { contentType: 'image/webp', cacheControl: '3600', upsert: true });
  if (uploadError) {
    console.error('Profile picture upload failed:', uploadError);
    button.disabled = false; button.textContent = 'Save profile picture';
    showToast(`Couldn't upload the profile picture: ${uploadError.message || 'Storage rejected the upload.'}`, 'error', 8000);
    return;
  }
  const publicUrl = supabaseClient.storage.from('profile-pictures').getPublicUrl(path).data.publicUrl;
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;
  const { data: memberAvatarUpdated, error: memberError } = await supabaseClient.rpc('update_own_member_avatar', {
    p_avatar_url: versionedUrl,
    p_avatar_path: path,
  });
  if (memberError || !memberAvatarUpdated) {
    button.disabled = false; button.textContent = 'Save profile picture';
    showToast("Picture uploaded, but the Members profile couldn't be updated. Run the latest schema and policy SQL.", 'error');
    return;
  }
  const { error: metadataError } = await supabaseClient.auth.updateUser({ data: { avatar_url: versionedUrl, avatar_path: path } });
  button.disabled = false; button.textContent = 'Save profile picture';
  state.currentUser.avatarUrl = versionedUrl; state.currentUser.avatarPath = path;
  const member = currentMemberRecord();
  if (member) { member.avatarUrl = versionedUrl; member.avatarPath = path; }
  updateUserSurfaces(); renderMembers();
  document.getElementById('profile-photo-remove').style.display = '';
  if (metadataError) showToast('Picture saved to your Members profile, but Auth metadata could not be updated.', 'error');
  else showToast('Profile picture saved.');
}
async function removeProfilePhoto() {
  const path = state.currentUser.avatarPath;
  const { data: memberAvatarUpdated, error: memberError } = await supabaseClient.rpc('update_own_member_avatar', {
    p_avatar_url: null,
    p_avatar_path: null,
  });
  if (memberError || !memberAvatarUpdated) {
    showToast("Couldn't update the Members profile. Run the latest schema and policy SQL.", 'error');
    return;
  }
  if (path) {
    const { error: removeError } = await supabaseClient.storage.from('profile-pictures').remove([path]);
    if (removeError) showToast("Profile was cleared, but the old picture file couldn't be deleted.", 'error');
  }
  const { error } = await supabaseClient.auth.updateUser({ data: { avatar_url: null, avatar_path: null } });
  state.currentUser.avatarUrl = ''; state.currentUser.avatarPath = '';
  const member = currentMemberRecord();
  if (member) { member.avatarUrl = ''; member.avatarPath = ''; }
  updateUserSurfaces(); renderMembers();
  document.getElementById('profile-photo-remove').style.display = 'none';
  if (error) showToast('Picture removed from the Members profile, but Auth metadata could not be updated.', 'error');
  else showToast('Profile picture removed.');
}
initializeProfileCropDrag();
updateThemeChoices();
