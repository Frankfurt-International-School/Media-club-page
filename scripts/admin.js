// ══════════════════════════════
// JOIN
// ══════════════════════════════
function submitJoin() {
  window.location.assign('https://info.fismediaclub.org/#join');
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
  renderCasAttendanceTracker();
  renderAdminAnn();
  showAdminTab(tabValueFromUrl(['pending', 'manage-events', 'cas-attendance', 'announcements'], 'pending'));
}

function renderPending() {
  const list = state.applications.filter(a => a.status === 'pending');
  const el = document.getElementById('pending-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg><p>No pending applications.</p></div>'; return; }
  el.innerHTML = list.map(applicationReviewMarkup).join('');
}

function applicationReviewMarkup(a) {
  const targetName = { media_club: 'Media Club', sac: 'SAC', both: 'Media Club + SAC' }[a.target] || 'Unknown';
  return `
    <div class="admin-row">
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text);">${escapeHtml(a.fname)} ${escapeHtml(a.lname)}</div>
        <div style="font-size:12px;color:var(--text3);">${escapeHtml(a.email)} · ${escapeHtml(a.year)} · ${escapeHtml(targetName)}${a.exp ? ` · ${escapeHtml(a.exp)}` : ''}</div>
        ${a.target !== 'media_club' ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;max-width:500px;">Applicant declared current SAC membership${a.existingMember ? ' and an existing Crew Center account' : ''}. Verify SAC membership before approval.</div>` : ''}
        ${a.why ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;max-width:500px;">${escapeHtml(a.why)}</div>` : ''}
        ${a.interests.length ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${a.interests.map(i => `<span class="badge badge-gray">${escapeHtml(i)}</span>`).join('')}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-accent btn-sm" id="approve-app-${a.id}" onclick="approveApp('${a.id}')">Approve</button>
        ${a.target === 'media_club'
          ? `<button class="btn btn-danger btn-sm" onclick="openRejectApplicationModal('${a.id}')">Reject</button>`
          : `<button class="btn btn-danger btn-sm" onclick="requestDeleteSacApplication('${a.id}')">Delete request</button>`}
      </div>
    </div>`;
}

function renderSacApplications() {
  const panel = document.getElementById('sac-review-panel');
  const list = document.getElementById('sac-review-list');
  if (!panel || !list) return;
  panel.hidden = !canReviewSacApplications();
  if (panel.hidden) return;
  const pending = state.applications.filter(a => a.status === 'pending' && a.target === 'sac');
  list.innerHTML = pending.length ? pending.map(applicationReviewMarkup).join('') : '<div class="empty-state"><p>No pending SAC requests.</p></div>';
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
  const { data, error } = await supabaseClient.functions.invoke('review-application', {
    body: { applicationId: id, decision: 'approve' },
  });
  if (error) {
    if (button) { button.disabled = false; button.textContent = 'Approve'; }
    showToast(await edgeFunctionErrorMessage(error, "Couldn't approve application."), 'error');
    return;
  }
  showToast(`${app.fname} ${app.lname} approved.${data?.invitationSent ? ' Invitation email sent.' : data?.approvalEmailSent ? ' Approval email sent to the existing member.' : ' Existing account updated.'}`);
  if (data?.deliveryWarnings?.length) showToast(data.deliveryWarnings.join(' '), 'error', 8000);
  await loadCrewCenterData();
  if (document.getElementById('page-admin')?.classList.contains('active')) renderAdmin();
  else renderSacApplications();
}

async function requestDeleteSacApplication(id) {
  const app = state.applications.find(a => a.id === id && a.status === 'pending' && a.target !== 'media_club');
  if (!app) return;
  if (!window.confirm(`Permanently delete ${app.fname} ${app.lname}'s ${app.target === 'both' ? 'Media Club + SAC' : 'SAC'} request? This cannot be undone, and no decision email will be sent.`)) return;
  const { error } = await supabaseClient.functions.invoke('review-application', {
    body: { applicationId: id, decision: 'delete', confirmDelete: true },
  });
  if (error) { showToast(await edgeFunctionErrorMessage(error, "Couldn't delete the request."), 'error'); return; }
  showToast('Application request permanently deleted. No email was sent.');
  await loadCrewCenterData();
  if (document.getElementById('page-admin')?.classList.contains('active')) renderAdmin();
  else renderSacApplications();
}

let rejectingApplicationId = null;

function openRejectApplicationModal(id) {
  const app = state.applications.find(a => a.id === id);
  if (!app || app.target !== 'media_club') return;
  rejectingApplicationId = id;
  document.getElementById('reject-application-name').textContent = `The Crew Center will automatically send a private decision email to ${app.fname} ${app.lname}.`;
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
  button.textContent = 'Sending email...';
  const { data, error } = await supabaseClient.functions.invoke('review-application', {
    body: { applicationId: id, decision: 'reject', reason },
  });
  button.disabled = false;
  button.textContent = 'Reject and send email automatically';
  if (error) { showToast(await edgeFunctionErrorMessage(error, "Couldn't reject application."), 'error'); return; }
  closeRejectApplicationModal();
  showToast(`Application rejected. The Crew Center sent the decision email to ${data?.applicantEmail || 'the applicant'}.`);
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
