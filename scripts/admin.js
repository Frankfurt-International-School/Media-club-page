// ══════════════════════════════
// JOIN
// ══════════════════════════════
async function submitJoin() {
  const fname = document.getElementById('join-fname').value.trim();
  const lname = document.getElementById('join-lname').value.trim();
  const email = document.getElementById('join-email').value.trim().toLowerCase();
  const why = document.getElementById('join-why').value.trim();
  if (!fname || !lname || !email || !why) { showToast('Please fill in all required fields.', 'error'); return; }
  if (!window.isFisAliasEmail(email)) { showToast(window.FIS_ALIAS_EMAIL_MESSAGE, 'error', 7000); return; }
  const interests = [...document.querySelectorAll('#interest-group .checked input')].map(i => i.value);
  const { error } = await supabaseClient
    .from('join_applications')
    .insert({
      name: `${fname} ${lname}`,
      email,
      year_group: document.getElementById('join-year').value,
      experience_level: document.getElementById('join-exp').value,
      interests,
      why,
      work_link: document.getElementById('join-link').value.trim() || null,
    });
  if (error) {
    const duplicatePending = error.code === '23505';
    showToast(duplicatePending ? 'An application with this email is already awaiting review.' : "Couldn't submit application.", 'error', 6000);
    return;
  }
  document.getElementById('join-form-card').style.display = 'none';
  document.getElementById('join-success').style.display = 'block';
  showToast('Application submitted!');
}

// ══════════════════════════════
// ADMIN
// ══════════════════════════════
function updateAdminPendingIndicator() {
  const pendingCount = state.applications.filter(application => application.status === 'pending').length;
  const adminDot = document.querySelector('.nav-item[data-page="admin"] .notif-dot');
  if (adminDot) adminDot.style.display = canAccessAdminPanel() && pendingCount > 0 ? 'inline-block' : 'none';
  const pendingBadge = document.getElementById('pending-count');
  if (pendingBadge) pendingBadge.textContent = pendingCount;
}

function renderAdmin() {
  if (!canAccessAdminPanel()) {
    navigate('home');
    return;
  }
  updateAdminPendingIndicator();
  renderPending();
  renderManageEvents();
  renderAdminAnn();
  showAdminTab(tabValueFromUrl(['pending', 'manage-events', 'announcements'], 'pending'));
}

function renderPending() {
  const list = state.applications.filter(a => a.status === 'pending');
  const el = document.getElementById('pending-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg><p>No pending applications.</p></div>'; return; }
  el.innerHTML = list.map(a => `
    <div class="admin-row">
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text);">${escapeHtml(a.fname)} ${escapeHtml(a.lname)}</div>
        <div style="font-size:12px;color:var(--text3);">${escapeHtml(a.email)} · ${escapeHtml(a.year)} · ${escapeHtml(a.exp)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;max-width:500px;">${escapeHtml(a.why)}</div>
        ${a.interests.length ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${a.interests.map(i => `<span class="badge badge-gray">${escapeHtml(i)}</span>`).join('')}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-accent btn-sm" id="approve-app-${a.id}" onclick="approveApp('${a.id}')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="openRejectApplicationModal('${a.id}')">Reject</button>
      </div>
    </div>`).join('');
}

async function edgeFunctionErrorMessage(error, fallback) {
  try {
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      const body = await response.clone().json();
      if (body?.error) return body.error;
    }
  } catch (_) {
    // Keep the useful fallback when the response body is unavailable.
  }
  return error?.message || fallback;
}

async function approveApp(id) {
  const app = state.applications.find(a => a.id === id);
  if (!app) return;
  const button = document.getElementById(`approve-app-${id}`);
  if (button) { button.disabled = true; button.textContent = 'Approving...'; }
  const { error } = await supabaseClient.functions.invoke('review-application', {
    body: { applicationId: id, decision: 'approve' },
  });
  if (error) {
    if (button) { button.disabled = false; button.textContent = 'Approve'; }
    showToast(await edgeFunctionErrorMessage(error, "Couldn't approve application."), 'error');
    return;
  }
  showToast(`${app.fname} ${app.lname} approved. Invitation email sent.`);
  await loadCrewCenterData();
  renderAdmin();
}

let rejectingApplicationId = null;

function openRejectApplicationModal(id) {
  const app = state.applications.find(a => a.id === id);
  if (!app) return;
  rejectingApplicationId = id;
  document.getElementById('reject-application-name').textContent = `Send a decision email to ${app.fname} ${app.lname}.`;
  document.getElementById('reject-application-reason').value = '';
  openModal('reject-application-modal');
}

function closeRejectApplicationModal() {
  rejectingApplicationId = null;
  closeModal('reject-application-modal');
}

async function submitApplicationRejection() {
  const id = rejectingApplicationId;
  const reason = document.getElementById('reject-application-reason').value.trim();
  if (!id || !reason) { showToast('Enter a reason for the applicant.', 'error'); return; }
  const button = document.getElementById('reject-application-submit');
  button.disabled = true;
  button.textContent = 'Rejecting...';
  const { data, error } = await supabaseClient.functions.invoke('review-application', {
    body: { applicationId: id, decision: 'reject', reason },
  });
  button.disabled = false;
  button.textContent = 'Reject application';
  if (error) { showToast(await edgeFunctionErrorMessage(error, "Couldn't reject application."), 'error'); return; }
  closeRejectApplicationModal();
  showToast(`Application rejected. Please email ${data?.applicantEmail || 'the applicant'} and inform them that their application was unsuccessful.`, 'error', 10000);
  await loadCrewCenterData();
  renderAdmin();
}

function renderManageEvents() {
  const activeRows = state.events.map(ev => `
    <div class="admin-row">
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text);">${escapeHtml(ev.title)}</div>
        <div style="font-size:12px;color:var(--text3);">${escapeHtml(fmtDate(ev.date))} · ${escapeHtml(ev.loc)} · <span class="badge badge-${catColor(ev.cat)}">${escapeHtml(ev.cat)}</span></div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px;">${ev.signups.length} signed up${ev.slots ? ' / ' + ev.slots : ''}</div>
      </div>
      <div class="archived-row-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick="requestArchiveEvent('${ev.id}')">Archive</button>
        ${canAddMembers() ? `<button type="button" class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEvent('${ev.id}')">Delete everything</button>` : ''}
      </div>
    </div>`).join('');
  const archivedRows = canManageCrewOperations() && state.archivedEvents.length
    ? `<section class="archived-panel"><div><div class="section-head" style="margin:0;">Archived events</div><div class="text-muted">Hidden from schedules and signup sheets, with related history preserved.</div></div>${state.archivedEvents.map(ev => `
      <div class="archived-row">
        <div><strong>${escapeHtml(ev.title)}</strong><div class="text-muted">${escapeHtml(fmtDate(ev.date))} · ${ev.signups.length + (ev.expiredSignups?.length || 0)} preserved signup record(s)</div></div>
        <div class="archived-row-actions">
          <button type="button" class="btn btn-ghost btn-sm" onclick="restoreArchivedEvent('${ev.id}')">Restore</button>
          ${canAddMembers() ? `<button type="button" class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEvent('${ev.id}')">Delete everything</button>` : ''}
        </div>
      </div>`).join('')}</section>`
    : '';
  document.getElementById('manage-events-list').innerHTML = `${activeRows || '<div class="empty-state"><p>No active events.</p></div>'}${archivedRows}`;
}

function renderAdminAnn() {
  document.getElementById('admin-ann-list').innerHTML = state.announcements.map(a => `
    <div class="admin-row">
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text);">${escapeHtml(a.title)}</div>
        <div style="font-size:12px;color:var(--text2);">${escapeHtml(a.body)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">${escapeHtml(a.date)}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="requestDeleteAnnouncement('${a.id}')">Delete</button>
    </div>`).join('');
}

async function postAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  if (!title || !body) { showToast('Please fill in both fields.', 'error'); return; }
  const { data, error } = await supabaseClient
    .from('announcements')
    .insert({ title, body })
    .select('*')
    .single();
  if (error) { showToast("Couldn't publish announcement. Run the announcements SQL first.", 'error'); return; }
  state.announcements.unshift(normalizeAnnouncement(data));
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-body').value = '';
  showToast('Announcement published!');
  renderAdminAnn();
  renderDashboard();
}

function requestDeleteAnnouncement(id) {
  const announcement = state.announcements.find(item => item.id === id);
  if (!announcement || !canAccessAdminPanel()) return;
  openActionConfirmation({
    kind: 'delete-announcement',
    title: `Delete “${announcement.title}”?`,
    copy: 'The announcement will be removed from the dashboard for everyone. This cannot be undone.',
    danger: true,
    confirmLabel: 'Delete announcement',
    busyLabel: 'Deleting...',
    execute: () => deleteAnn(id),
  });
}

async function deleteAnn(id) {
  const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
  if (error) { showToast("Couldn't delete announcement.", 'error'); return false; }
  state.announcements = state.announcements.filter(a => a.id !== id);
  renderAdminAnn();
  renderDashboard();
  showToast('Announcement deleted.', 'error');
  return true;
}

function showAdminTab(name) {
  const el = document.querySelector(`#page-admin [data-admin-tab="${name}"]`)
    || document.querySelector('#page-admin [data-admin-tab="pending"]');
  name = el.dataset.adminTab;
  document.querySelectorAll('#page-admin .tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.tabIndex = -1;
  });
  document.querySelectorAll('#page-admin .tab-content').forEach(t => {
    t.classList.remove('active');
    t.hidden = true;
  });
  el.classList.add('active');
  el.setAttribute('aria-selected', 'true');
  el.tabIndex = 0;
  updateSlidingTab(el.closest('.tab-row'));
  const panel = document.getElementById('admin-tab-' + name);
  panel.classList.add('active');
  panel.hidden = false;
}

function updateBerlinClock() {
  const el = document.getElementById('berlin-clock-time');
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function startBerlinClock() {
  updateBerlinClock();
  updateDashboardGreeting();
  setInterval(() => {
    updateBerlinClock();
    updateDashboardGreeting();
  }, 1000);
}

function startWaveAnimation() {
  const hand = document.getElementById('wave-hand');
  if (!hand) return;
  const wave = () => {
    hand.classList.remove('wave-now');
    void hand.offsetWidth;
    hand.classList.add('wave-now');
  };
  wave();
  setInterval(wave, 10000);
}
