import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tutorialSource = readFileSync(new URL('../tutorial.js', import.meta.url), 'utf8');
const tutorialStyles = readFileSync(new URL('../tutorial.css', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');
const policiesSql = readFileSync(new URL('../supabase-auth-policies.sql', import.meta.url), 'utf8');

test('tutorial module is self-hosted and launches from Settings', () => {
  assert.match(appSource, /<link rel="stylesheet" href="tutorial\.css">/);
  assert.match(appSource, /<script src="tutorial\.js"><\/script>/);
  assert.match(appSource, /data-settings-section="tutorials"/);
  assert.match(appSource, /id="tutorial-launch-button"/);
  assert.doesNotMatch(tutorialSource, /document\.querySelector\('\.sidebar-footer'\)/);
  assert.doesNotMatch(tutorialSource, /\.topbar/);
});

test('tutorial covers every routable member page and filters restricted guides', () => {
  for (const page of [
    'home', 'events', 'signup', 'members', 'gallery', 'equipment', 'role-guide',
    'crew-deployment', 'equipment-status', 'about', 'join', 'profile', 'admin',
  ]) {
    assert.match(tutorialSource, new RegExp(`['"]${page.replace('-', '\\-')}['"]`), `Expected a ${page} tutorial`);
  }
  assert.match(tutorialSource, /FULL_TOUR_ORDER\.filter\(id => id === 'profile' \|\| sidebarPageAvailable\(id\)\)/);
  assert.match(tutorialSource, /navigate\(step\.page, navItemForPage\(step\.page\)\)/);
});

test('tutorial motion and controls remain accessible', () => {
  assert.match(tutorialStyles, /transition: left 360ms/);
  assert.match(tutorialStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(tutorialStyles, /@media \(max-width: 700px\)/);
  assert.match(tutorialStyles, /\.tutorial-running \.main \{ margin-right: 386px/);
  assert.match(tutorialStyles, /padding-bottom: var\(--tutorial-sheet-space/);
  assert.match(tutorialSource, /aria-modal="true"/);
  assert.match(tutorialSource, /event\.key === 'Escape'/);
  assert.match(tutorialSource, /event\.key === 'ArrowRight'/);
  assert.match(tutorialSource, /trapFocus/);
  assert.match(tutorialSource, /window\.scrollBy\(\{ top: scrollDelta, behavior: reduceMotion\.matches \? 'auto' : 'smooth'/);
  assert.match(tutorialSource, /revealTargetWithoutCardOverlap/);
});

test('tutorial progress is account-synced through an owner-only RPC', () => {
  assert.match(schemaSql, /tutorial_progress jsonb not null default/);
  assert.match(policiesSql, /create or replace function public\.update_own_tutorial_progress\(p_progress jsonb\)/);
  assert.match(policiesSql, /auth\.uid\(\) is null or public\.is_visitor_session\(\)/);
  assert.match(policiesSql, /where lower\(email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(policiesSql, /revoke all on function public\.update_own_tutorial_progress\(jsonb\) from public/);
  assert.match(policiesSql, /grant execute on function public\.update_own_tutorial_progress\(jsonb\) to authenticated/);
  assert.match(tutorialSource, /supabaseClient\.rpc\('update_own_tutorial_progress'/);
});

test('tutorial never invokes operational write actions', () => {
  for (const action of ['addSignupRow', 'submitJoin', 'postAnnouncement', 'saveProfilePhoto', 'mark_equipment_reservation_returned']) {
    assert.doesNotMatch(tutorialSource, new RegExp(`${action}\\s*\\(`));
  }
});
