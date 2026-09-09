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
  return {
    hasNewsTeam: teamKeys.includes('news_team') || tags.some(isNewsTeam),
    hasAthletics: teamKeys.includes('athletics') || tags.some(isAthletics),
    hasCas: tags.some(isCas),
    specialisations: tags.filter(tag => !isNewsTeam(tag) && !isAthletics(tag) && !isCas(tag)),
  };
}

function renderMembers() {
  const q = (document.getElementById('member-search').value || '').toLowerCase();
  const rf = document.getElementById('member-role-filter').value;
  const list = state.members.filter(m => {
    const name = (m.fname + ' ' + m.lname).toLowerCase();
    return (!q || name.includes(q) || m.spec.toLowerCase().includes(q) || m.gradeLevel.toLowerCase().includes(q)) && (!rf || m.role === rf);
  });
  const grid = document.getElementById('members-grid');
  if (!list.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>No members found.</p></div>'; return; }
  const memberCard = m => {
    const [bg, fg] = memberColor(m.color);
    const { hasNewsTeam, hasAthletics, hasCas, specialisations } = memberDirectoryTags(m.spec, m.teamKeys);
    const tags = `${hasCas ? '<span class="badge badge-cas">CAS</span>' : ''}${hasNewsTeam ? '<span class="badge badge-teal">News Team</span>' : ''}${hasAthletics ? '<span class="badge badge-blue">Athletics</span>' : ''}${specialisations.map(tag => `<span class="badge badge-gray">${escapeHtml(tag)}</span>`).join('')}`;
    const profileDetails = [canAccessAdminPanel() ? m.email : '', m.gradeLevel].filter(Boolean).map(value => escapeHtml(value)).join(' · ');
    const safeAvatarUrl = safeExternalUrl(m.avatarUrl);
    const avatarStyle = safeAvatarUrl
      ? `background:url(&quot;${escapeHtml(safeAvatarUrl)}&quot;) center/cover;color:transparent;`
      : `background:${bg};color:${fg};`;
    return `
      <div class="member-card">
        <div class="member-avatar" style="${avatarStyle}">${safeAvatarUrl ? '' : escapeHtml(initials(m.fname, m.lname))}</div>
        <div style="flex:1;">
          <div class="member-name">${escapeHtml(m.fname)} ${escapeHtml(m.lname)}</div>
          ${profileDetails ? `<div class="member-role">${profileDetails}</div>` : ''}
          <div class="member-tags">
            <span class="badge badge-${memberRoleColor(m.role)}">${escapeHtml(m.role)}</span>
            ${tags}
          </div>
        </div>
        ${canAccessAdminPanel() ? `<button class="btn btn-danger btn-sm" onclick="openRemoveMemberModal('${m.id}')">Remove</button>` : ''}
      </div>`;
  };
  const groups = new Map();
  list.forEach(member => {
    const role = member.role || 'Other';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(member);
  });
  const orderedGroups = [...groups.entries()].sort(([roleA], [roleB]) => memberRankPriority(roleA) - memberRankPriority(roleB) || roleA.localeCompare(roleB));
  grid.innerHTML = orderedGroups.map(([role, members]) => {
    const orderedMembers = [...members].sort((a, b) => {
      if (normalizeRoleName(role) === 'leader') {
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
  const teamKeys = [directoryTags.hasNewsTeam ? 'news_team' : '', directoryTags.hasAthletics ? 'athletics' : '', directoryTags.hasCas ? 'cas' : ''].filter(Boolean);
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
