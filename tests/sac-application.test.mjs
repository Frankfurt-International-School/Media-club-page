import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('info/index.html');
const publicScript = read('info/info.js');
const publicStyles = read('info/info.css');
const submitFunction = read('supabase/functions/submit-application/index.ts');
const reviewFunction = read('supabase/functions/review-application/index.ts');
const schema = read('supabase-schema.sql');
const policies = read('supabase-auth-policies.sql');
const admin = read('scripts/admin.js');
const core = read('scripts/core.js');
const appHtml = read('index.html');
const workspace = read('scripts/workspaces.js');
const storage = read('supabase-storage-policies.sql');
const scheduleEmail = read('supabase/functions/send-schedule-notification/index.ts');

test('public join form presents Media Club, SAC, and both before personal details', () => {
  for (const target of ['media_club', 'sac', 'both']) {
    assert.match(html, new RegExp(`name="applicationTarget" value="${target}"`));
  }
  assert.ok(html.indexOf('name="applicationTarget"') < html.indexOf('name="firstName"'));
  assert.match(html, /current SAC members in Grades 9–12/);
  assert.match(html, /B days at lunch/);
  assert.match(html, /name="currentSacMember" type="checkbox"/);
  assert.match(html, /name="existingMember" type="checkbox"/);
  assert.match(publicStyles, /application-choice-grid/);
  assert.match(publicStyles, /@media \(max-width: 620px\)[\s\S]*application-choice-grid \{ grid-template-columns: 1fr;/);
});

test('SAC-only form is minimal and enforces grade and declaration in the browser', () => {
  assert.match(publicScript, /sacOnly = target === 'sac'/);
  assert.match(publicScript, /currentSacMemberInput\.required = includesSac/);
  assert.match(publicScript, /\^Grade \(9\|10\|11\|12\)\$/);
  assert.match(publicScript, /whyInput\.required = !sacOnly/);
  assert.match(publicScript, /experienceLevel: applicationTarget === 'sac' \? ''/);
  assert.match(publicScript, /interests: applicationTarget === 'sac' \? \[\]/);
  assert.match(publicScript, /applicationTarget,/);
  assert.match(publicScript, /currentSacMember:/);
  assert.match(publicScript, /existingMember:/);
});

test('server validates SAC eligibility and persists the selected target without trusting the hostname', () => {
  assert.match(submitFunction, /applicationTargets = new Set\(\["media_club", "sac", "both"\]\)/);
  assert.match(submitFunction, /sacYearGroups = new Set\(\["Grade 9", "Grade 10", "Grade 11", "Grade 12"\]\)/);
  assert.match(submitFunction, /includesSac && \(!sacYearGroups\.has\(yearGroup\) \|\| !currentSacMember\)/);
  assert.match(submitFunction, /application_target: applicationTarget/);
  assert.match(submitFunction, /current_sac_member: currentSacMember/);
  assert.match(submitFunction, /existing_member: existingMember/);
  assert.match(schema, /join_applications_sac_grade_check[\s\S]*current_sac_member/);
  assert.match(schema, /where not exists \([\s\S]*existing\.team_key = 'sac'/);
});

test('review access is scoped to Media Club, SAC, or combined applications', () => {
  assert.match(policies, /application_target = 'media_club' and public\.is_admin_panel_user\(\)/);
  assert.match(policies, /application_target = 'sac' and public\.can_review_sac_applications\(\)/);
  assert.match(reviewFunction, /target === "media_club" && memberRole === "faculty"/);
  assert.match(reviewFunction, /target === "sac" && sacPresident/);
  assert.match(reviewFunction, /if \(!mayReview\) return json/);
  assert.match(reviewFunction, /includesSac && decision === "reject"/);
  assert.match(reviewFunction, /if \(decision === "delete"\)/);
  assert.match(reviewFunction, /decision === "delete" && confirmDelete !== true/);
  assert.match(admin, /Permanently delete[\s\S]*This cannot be undone, and no decision email will be sent/);
  assert.match(admin, /decision: 'delete', confirmDelete: true/);
  assert.match(appHtml, /id="sac-review-panel"/);
  assert.match(core, /'sac-home': canReviewSacApplications\(\) \? \['applications'\]/);
});

test('approval adds only selected team tags and distinguishes new from existing accounts', () => {
  assert.match(reviewFunction, /listUsers\(\{ page, perPage: 1000 \}\)/);
  assert.match(reviewFunction, /if \(!existingAuthAccount\) \{[\s\S]*inviteUserByEmail/);
  assert.match(reviewFunction, /desiredTeams = \[includesMedia \? "media_club" : "", includesSac \? "sac" : ""\]/);
  assert.match(reviewFunction, /callerClient\.rpc\("set_sac_membership", \{[\s\S]*p_enabled: true/);
  assert.match(reviewFunction, /notification_type: "application_approved"/);
  assert.match(reviewFunction, /if \(existingAuthAccount\) \{[\s\S]*application-approval-\$\{applicationId\}/);
  assert.match(schema, /notification_type in \('event_created', 'meeting_invite', 'application_approved'\)/);
  assert.match(read('scripts/ui.js'), /\['meeting_invite', 'application_approved'\]/);
});

test('SAC-only accounts remain in the directory but cannot use Media Club operations', () => {
  assert.match(policies, /create or replace function public\.can_access_media_club\(\)[\s\S]*membership\.team_key = 'media_club'/);
  assert.match(policies, /create policy "Signed-in users can read members"[\s\S]*?using \(public\.is_approved_member\(\)\)/);
  for (const table of ['events', 'signups', 'equipment', 'equipment_reservations', 'gallery', 'announcements']) {
    const start = policies.indexOf(`on public.${table} for select`);
    assert.ok(start >= 0, `${table} must have a SELECT policy`);
    assert.match(policies.slice(start, start + 450), /public\.can_access_media_club\(\)/, `${table} reads must require Media Club membership`);
  }
  assert.match(policies, /if not public\.can_access_media_club\(\) then return false; end if;[\s\S]*?select meeting\.audience/);
  assert.match(policies, /create or replace function public\.create_camera_kit_reservation[\s\S]*?if not public\.can_access_media_club\(\)/);
  assert.match(storage, /bucket_id = 'gallery-media'\s+and public\.can_access_media_club\(\)/);
  assert.match(storage, /bucket_id = 'gallery-athletics'\s+and public\.can_access_media_club\(\)/);
  assert.match(schema, /create or replace function public\.notify_members_of_new_event\(\)[\s\S]*?membership\.team_key = 'media_club'/);
  assert.match(scheduleEmail, /mediaMemberIds\.has\(member\.id\)/);
  assert.match(workspace, /if \(!mediaAccess && sacAccess\) return 'sac'/);
  assert.match(workspace, /if \(workspace === 'media' && !canAccessMediaWorkspace\(\)\)/);
  const selectionSource = workspace.match(/function resolveWorkspaceSelection\([^]*?\n\}/)?.[0];
  assert.ok(selectionSource);
  const select = vm.runInNewContext(`${selectionSource}\nresolveWorkspaceSelection`);
  assert.equal(select('media', true, false), 'sac');
  assert.equal(select('sac', true, true), 'sac');
  assert.equal(select('media', true, true), 'media');
});
