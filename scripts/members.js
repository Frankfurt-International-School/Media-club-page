// ══════════════════════════════
// MEMBERS
// ══════════════════════════════
function memberRankPriority(role = '') {
  const normalized = role.toLowerCase().replace(/\s+/g, '-');
  return { faculty: 0, leader: 1, 'co-leader': 2, moderator: 3, member: 4 }[normalized] ?? 5;
}

function memberRoleColor(role = '') {
  const normalized = normalizeRoleName(role);
  return {
    leader: 'coral',
    faculty: 'blue',
    'co-leader': 'coral',
    moderator: 'amber',
    member: 'purple',
    trainee: 'purple',
  }[normalized] || 'gray';
}

function memberDirectoryTags(specialisation = '', teamKeys = []) {
  const tags = String(specialisation).split(',').map(tag => tag.trim()).filter(Boolean);
  const isNewsTeam = tag => ['news team', 'student news team'].includes(tag.toLowerCase());
  const isAthletics = tag => ['athletics', 'athletics department'].includes(tag.toLowerCase());
  const isCas = tag => tag.toLowerCase() === 'cas';
  const hasSac = teamKeys.includes('sac');
  return {
    hasMediaClub: teamKeys.includes('media_club') || !hasSac,
    hasSac,
    hasNewsTeam: teamKeys.includes('news_team') || tags.some(isNewsTeam),
    hasAthletics: teamKeys.includes('athletics') || tags.some(isAthletics),
    hasCas: tags.some(isCas),
    specialisations: tags.filter(tag => !isNewsTeam(tag) && !isAthletics(tag) && !isCas(tag)),
  };
}

const sacTitleLabels = Object.freeze({
  president: 'SAC President',
  vice_president: 'SAC Vice President',
  media_manager: 'SAC Media Manager',
  attendance_manager: 'SAC Attendance Manager',
  club_manager: 'SAC Club Manager',
});

function sacTitleLabel(title = '') {
  return sacTitleLabels[normalizeSacTitle(title)] || '';
}

function sacGradeEligible(gradeLevel = '') {
  return ['grade 9', 'grade 10', 'grade 11', 'grade 12'].includes(String(gradeLevel).trim().toLowerCase());
}

function memberDirectoryGroupRole(member) {
  if (normalizeSacTitle(member?.sacTitle) === 'president') return 'Leader';
  const { hasMediaClub } = memberDirectoryTags(member?.spec, member?.teamKeys);
  return hasMediaClub ? (member?.role || 'Other') : 'SAC Member';
}

function memberLeaderOrderPriority(member) {
  return normalizeSacTitle(member?.sacTitle) === 'president' ? 1 : 0;
}

function sacDirectoryMembers() {
  const titleOrder = { president: 0, vice_president: 1, media_manager: 2, attendance_manager: 3, club_manager: 4 };
  return state.members.filter(member => member.teamKeys?.includes('sac')).sort((a, b) => {
    const rank = (titleOrder[normalizeSacTitle(a.sacTitle)] ?? 5) - (titleOrder[normalizeSacTitle(b.sacTitle)] ?? 5);
    return rank || a.name.localeCompare(b.name);
  });
}

function renderSacMembers() {
  const grid = document.getElementById('sac-members-grid');
  const count = document.getElementById('sac-members-count');
  if (!grid || currentCrewCenterWorkspace() !== 'sac' || !canAccessSacWorkspace()) return;
  const all = sacDirectoryMembers();
  const query = document.getElementById('sac-member-search')?.value.trim().toLowerCase() || '';
  const visible = all.filter(member => `${member.name} ${sacTitleLabel(member.sacTitle)} ${member.gradeLevel}`.toLowerCase().includes(query));
  count.textContent = `${all.length} current member${all.length === 1 ? '' : 's'}`;
  if (!state.dataLoaded.members) {
    grid.innerHTML = '<div class="empty-state" role="status"><p>Loading SAC members…</p></div>';
    return;
  }
  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state" role="status"><p>${all.length ? 'No SAC members match your search.' : 'No SAC members have been added yet.'}</p></div>`;
    return;
  }
  grid.innerHTML = visible.map(member => {
    const [bg, fg] = memberColor(member.color);
    const avatarUrl = safeExternalUrl(member.avatarUrl);
    const avatarStyle = avatarUrl
      ? `background:url(&quot;${escapeHtml(avatarUrl)}&quot;) center/cover;color:transparent;`
      : `background:${bg};color:${fg};`;
    const title = sacTitleLabel(member.sacTitle);
    const dual = member.teamKeys.includes('media_club');
    return `<article class="sac-directory-card">
      <div class="member-avatar" style="${avatarStyle}">${avatarUrl ? '' : escapeHtml(initials(member.fname, member.lname))}</div>
      <div class="sac-directory-body"><h2>${escapeHtml(member.name)}</h2><p>${escapeHtml(member.gradeLevel || 'Grade not listed')}</p>
        <div class="member-tags"><span class="badge badge-sac">SAC Member</span>${title ? `<span class="badge badge-sac-title">${escapeHtml(title)}</span>` : ''}${dual ? '<span class="badge badge-gray">Also Media Club</span>' : ''}</div>
      </div>
      ${canManageSacMemberships() ? `<button class="btn btn-ghost btn-sm sac-member-manage" type="button" onclick="openSacMembershipModal('${escapeHtml(member.id)}')">Manage SAC</button>` : ''}
    </article>`;
  }).join('');
}

function renderMembers() {
  const q = (document.getElementById('member-search').value || '').toLowerCase();
  const rf = document.getElementById('member-role-filter').value;
  const list = state.members.filter(m => {
    const name = (m.fname + ' ' + m.lname).toLowerCase();
    const sacTitle = sacTitleLabel(m.sacTitle).toLowerCase();
    return (!q || name.includes(q) || m.spec.toLowerCase().includes(q) || m.gradeLevel.toLowerCase().includes(q) || sacTitle.includes(q))
      && (!rf || memberDirectoryGroupRole(m) === rf);
  });
  const grid = document.getElementById('members-grid');
  if (!list.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>No members found.</p></div>'; return; }
  const memberCard = m => {
    const [bg, fg] = memberColor(m.color);
    const { hasMediaClub, hasSac, hasNewsTeam, hasAthletics, hasCas, specialisations } = memberDirectoryTags(m.spec, m.teamKeys);
    const titleLabel = hasSac ? sacTitleLabel(m.sacTitle) : '';
    const mediaRoleLabel = hasMediaClub ? (normalizeRoleName(m.role) === 'member' && hasSac ? 'Media Club Member' : m.role) : '';
    const visibleSpecialisations = hasMediaClub ? specialisations : [];
    const tags = `${mediaRoleLabel ? `<span class="badge badge-${memberRoleColor(m.role)}">${escapeHtml(mediaRoleLabel)}</span>` : ''}${hasSac ? '<span class="badge badge-sac">SAC</span>' : ''}${titleLabel ? `<span class="badge badge-sac-title">${escapeHtml(titleLabel)}</span>` : ''}${hasCas ? '<span class="badge badge-cas">CAS</span>' : ''}${hasNewsTeam ? '<span class="badge badge-teal">News Team</span>' : ''}${hasAthletics ? '<span class="badge badge-athletics">Athletics</span>' : ''}${visibleSpecialisations.map(tag => `<span class="badge badge-gray">${escapeHtml(tag)}</span>`).join('')}`;
    const profileDetails = [canAccessAdminPanel() ? m.email : '', m.gradeLevel].filter(Boolean).map(value => escapeHtml(value)).join(' · ');
    const safeAvatarUrl = safeExternalUrl(m.avatarUrl);
    const avatarStyle = safeAvatarUrl
      ? `background:url(&quot;${escapeHtml(safeAvatarUrl)}&quot;) center/cover;color:transparent;`
      : `background:${bg};color:${fg};`;
    return `
      <div class="member-card${normalizeSacTitle(m.sacTitle) === 'president' ? ' sac-president-card' : ''}">
        <div class="member-avatar" style="${avatarStyle}">${safeAvatarUrl ? '' : escapeHtml(initials(m.fname, m.lname))}</div>
        <div class="member-card-body">
          <div class="member-name">${escapeHtml(m.fname)} ${escapeHtml(m.lname)}</div>
          ${profileDetails ? `<div class="member-role">${profileDetails}</div>` : ''}
          <div class="member-tags">${tags}</div>
        </div>
        ${(canManageSacMemberships() || canAccessAdminPanel()) ? `<div class="member-card-actions">${canManageSacMemberships() ? `<button class="btn btn-ghost btn-sm sac-member-manage" onclick="openSacMembershipModal('${m.id}')">Manage SAC</button>` : ''}${canAccessAdminPanel() ? `<button class="btn btn-danger btn-sm" onclick="openRemoveMemberModal('${m.id}')">Remove</button>` : ''}</div>` : ''}
      </div>`;
  };
  const groups = new Map();
  list.forEach(member => {
    const role = memberDirectoryGroupRole(member);
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(member);
  });
  const orderedGroups = [...groups.entries()].sort(([roleA], [roleB]) => memberRankPriority(roleA) - memberRankPriority(roleB) || roleA.localeCompare(roleB));
  grid.innerHTML = orderedGroups.map(([role, members]) => {
    const orderedMembers = [...members].sort((a, b) => {
      if (normalizeRoleName(role) === 'leader') {
        const sacOrder = memberLeaderOrderPriority(a) - memberLeaderOrderPriority(b);
        if (sacOrder) return sacOrder;
        const joinedA = a.joined_date ? new Date(`${a.joined_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        const joinedB = b.joined_date ? new Date(`${b.joined_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        if (joinedA !== joinedB) return joinedA - joinedB;
      }
      return a.name.localeCompare(b.name);
    });
    return `<section class="member-role-section">
      <div class="member-section-head"><span class="member-section-title">${escapeHtml(role)}</span><span class="badge badge-${memberRoleColor(role)}">${members.length}</span><span class="member-section-line"></span></div>
      <div class="member-section-grid">${orderedMembers.map(memberCard).join('')}</div>
    </section>`;
  }).join('');
  document.getElementById('members-count').textContent = `Showing ${list.length} of ${state.members.length} members`;
}

async function addMember() {
  if (!canAddMembers()) { showToast('Only an Auth Admin can add members.', 'error'); return; }
  const fname = document.getElementById('mem-fname').value.trim();
  const lname = document.getElementById('mem-lname').value.trim();
  const email = document.getElementById('mem-email').value.trim().toLowerCase();
  const role = document.getElementById('mem-role').value;
  const specialisation = document.getElementById('mem-spec').value || 'active';
  if (!fname || !lname) { showToast('Please fill in first and last name.', 'error'); return; }
  if (normalizeRoleName(role) === 'faculty' ? !window.isFisSchoolEmail(email) : !window.isFisAliasEmail(email)) {
    showToast(normalizeRoleName(role) === 'faculty' ? 'Faculty accounts must use an @fis.edu email address.' : window.FIS_ALIAS_EMAIL_MESSAGE, 'error', 7000);
    return;
  }
  const { data, error } = await supabaseClient
    .from('members')
    .insert({
      name: `${fname} ${lname}`,
      email,
      grade_level: document.getElementById('mem-grade').value || null,
      role,
      status: specialisation,
    })
    .select('id')
    .single();
  if (error) { showToast("Couldn't add member.", 'error'); return; }
  const directoryTags = memberDirectoryTags(specialisation);
  const teamKeys = ['media_club', directoryTags.hasNewsTeam ? 'news_team' : '', directoryTags.hasAthletics ? 'athletics' : '', directoryTags.hasCas ? 'cas' : ''].filter(Boolean);
  let teamSyncError = null;
  if (teamKeys.length) {
    const { error: membershipError } = await supabaseClient
      .from('member_team_memberships')
      .insert(teamKeys.map(teamKey => ({ member_id: data.id, team_key: teamKey })));
    teamSyncError = membershipError;
  }
  await loadCrewCenterData({ datasets: ['members'], silent: true });
  closeModal('member-modal');
  ['mem-fname','mem-lname','mem-email','mem-spec'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mem-grade').value = '';
  if (teamSyncError) {
    console.error("Couldn't add secondary team memberships.", teamSyncError);
    showToast(`${fname} ${lname} was added, but team access was not fully synced. Run the latest Supabase SQL.`, 'error', 8000);
  } else {
    showToast(`${fname} ${lname} added!`);
  }
  renderMembers();
  renderDashboard();
}

let managingSacMemberId = null;

function syncSacMembershipEditor() {
  const enabled = document.getElementById('sac-membership-enabled').checked;
  const member = state.members.find(item => item.id === managingSacMemberId);
  const eligible = sacGradeEligible(member?.gradeLevel);
  document.getElementById('sac-membership-title').disabled = !enabled;
  const overrideWrap = document.getElementById('sac-grade-override-wrap');
  overrideWrap.hidden = !enabled || eligible || !canAddMembers();
  if (overrideWrap.hidden) document.getElementById('sac-grade-override').checked = false;
  const warning = document.getElementById('sac-membership-warning');
  warning.hidden = !enabled || eligible;
  warning.textContent = canAddMembers()
    ? 'This member is outside Grade 9–12. Saving requires the explicit Auth Admin override below.'
    : 'Only Grade 9–12 members may receive SAC membership. Ask an Auth Admin if an exception is required.';
}

function sacAuditDescription(entry) {
  if (entry.action === 'membership_added') return `Added to SAC${entry.new_title ? ` as ${sacTitleLabel(entry.new_title)}` : ''}`;
  if (entry.action === 'membership_removed') return `Removed from SAC${entry.previous_title ? ` (was ${sacTitleLabel(entry.previous_title)})` : ''}`;
  return `Changed title from ${sacTitleLabel(entry.previous_title) || 'SAC Member'} to ${sacTitleLabel(entry.new_title) || 'SAC Member'}`;
}

async function renderSacMembershipAudit(memberId) {
  const list = document.getElementById('sac-membership-audit');
  list.innerHTML = '<div class="text-muted">Loading change history…</div>';
  const { data, error } = await supabaseClient.rpc('get_sac_membership_audit', { p_member_id: memberId });
  if (managingSacMemberId !== memberId) return;
  if (error) {
    list.innerHTML = '<div class="text-muted">Change history becomes available after the SAC foundation SQL is applied.</div>';
    return;
  }
  list.innerHTML = data?.length
    ? data.map(entry => `<div class="sac-audit-row"><strong>${escapeHtml(sacAuditDescription(entry))}</strong><span>${escapeHtml(entry.changed_by_name)} · ${escapeHtml(new Date(entry.changed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}</span></div>`).join('')
    : '<div class="text-muted">No SAC membership changes recorded yet.</div>';
}

function openSacMembershipModal(id) {
  if (!canManageSacMemberships()) { showToast('Only the SAC President, SAC Vice President, or an Auth Admin can manage SAC membership.', 'error'); return; }
  const member = state.members.find(item => item.id === id);
  if (!member) return;
  managingSacMemberId = id;
  const { hasSac } = memberDirectoryTags(member.spec, member.teamKeys);
  document.getElementById('sac-membership-member').textContent = `${member.name} · ${member.gradeLevel || 'No grade recorded'}`;
  document.getElementById('sac-membership-enabled').checked = hasSac;
  document.getElementById('sac-membership-title').value = hasSac ? normalizeSacTitle(member.sacTitle) : '';
  document.getElementById('sac-grade-override').checked = false;
  syncSacMembershipEditor();
  openModal('sac-membership-modal');
  renderSacMembershipAudit(id);
}

function closeSacMembershipModal() {
  managingSacMemberId = null;
  closeModal('sac-membership-modal');
}

async function saveSacMembership() {
  if (!canManageSacMemberships()) { closeSacMembershipModal(); showToast('SAC membership management access is required.', 'error'); return; }
  const member = state.members.find(item => item.id === managingSacMemberId);
  if (!member) { closeSacMembershipModal(); return; }
  const enabled = document.getElementById('sac-membership-enabled').checked;
  const title = enabled ? document.getElementById('sac-membership-title').value || null : null;
  const overrideGrade = enabled && document.getElementById('sac-grade-override').checked;
  if (enabled && !sacGradeEligible(member.gradeLevel) && !overrideGrade) {
    showToast('SAC membership is limited to Grade 9–12 unless an Auth Admin explicitly overrides it.', 'error', 7000);
    return;
  }
  const button = document.getElementById('sac-membership-save');
  button.disabled = true;
  button.textContent = 'Saving…';
  const { error } = await supabaseClient.rpc('set_sac_membership', {
    p_member_id: member.id,
    p_enabled: enabled,
    p_title: title,
    p_override_grade: overrideGrade,
  });
  button.disabled = false;
  button.textContent = 'Save SAC membership';
  if (error) { showToast(error.message || "Couldn't update SAC membership.", 'error', 7000); return; }
  await loadCrewCenterData({ datasets: ['members'], silent: true });
  closeSacMembershipModal();
  renderMembers();
  if (currentCrewCenterWorkspace() === 'sac') renderSacMembers();
  showToast(enabled ? `${member.name}'s SAC membership was saved.` : `${member.name} was removed from SAC. Their history was preserved.`);
}

let removingMemberId = null;

function openRemoveMemberModal(id) {
  if (!canAccessAdminPanel()) { showToast('Only Auth Admin and Faculty accounts can remove members.', 'error'); return; }
  const member = state.members.find(item => item.id === id);
  if (!member) return;
  removingMemberId = id;
  document.getElementById('remove-member-name').textContent = `Remove ${member.name} from the member directory?`;
  openModal('remove-member-modal');
}

function closeRemoveMemberModal() {
  removingMemberId = null;
  closeModal('remove-member-modal');
}

async function submitMemberRemoval() {
  if (!canAccessAdminPanel()) { closeRemoveMemberModal(); showToast('Only Auth Admin and Faculty accounts can remove members.', 'error'); return; }
  const id = removingMemberId;
  const member = state.members.find(item => item.id === id);
  if (!member) { closeRemoveMemberModal(); return; }
  const button = document.getElementById('remove-member-submit');
  button.disabled = true;
  button.textContent = 'Removing...';
  const { error } = await supabaseClient.from('members').delete().eq('id', id);
  button.disabled = false;
  button.textContent = 'Remove member';
  if (error) { showToast("Couldn't remove member.", 'error'); return; }
  state.members = state.members.filter(m => m.id !== id);
  closeRemoveMemberModal();
  renderMembers();
  renderDashboard();
  showToast(`${member.name} removed from the member directory.`, 'error');
}
