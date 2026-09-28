import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const auth = readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');
const policies = readFileSync(new URL('../supabase-auth-policies.sql', import.meta.url), 'utf8');
const terms = readFileSync(new URL('../terms.html', import.meta.url), 'utf8');
const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

test('agreement is account bound, versioned, and required before dashboard reveal', () => {
  const versions = auth.match(/const legalDocumentVersions = Object\.freeze\(\{ terms: "([^"]+)", privacy: "([^"]+)" \}\);/);
  assert.ok(versions, 'Expected explicit Terms and Privacy versions');
  assert.match(terms, /Last updated: 28 September 2026/);
  assert.match(privacy, /Last updated: 28 September 2026/);
  assert.equal(versions[1], `2026-09-28-${createHash('sha256').update(terms).digest('hex').slice(0, 12)}`);
  assert.equal(versions[2], `2026-09-28-${createHash('sha256').update(privacy).digest('hex').slice(0, 12)}`);

  const decision = auth.match(/function needsLegalAgreement\(record\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(decision, 'Expected an independently testable version check');
  const needsLegalAgreement = vm.runInNewContext(
    `(() => { const legalDocumentVersions = { terms: ${JSON.stringify(versions[1])}, privacy: ${JSON.stringify(versions[2])} }; ${decision}; return needsLegalAgreement; })()`
  );
  assert.equal(needsLegalAgreement(null), true);
  assert.equal(needsLegalAgreement({ terms_version: versions[1], privacy_version: versions[2] }), false);
  assert.equal(needsLegalAgreement({ terms_version: 'old', privacy_version: versions[2] }), true);
  assert.equal(needsLegalAgreement({ terms_version: versions[1], privacy_version: 'old' }), true);

  const activation = auth.slice(auth.indexOf('async function activateCrewCenterUser('), auth.indexOf('\nasync function signOutCrewCenterSession()'));
  assert.match(activation, /await allowCrewCenterUser\(user\)/);
  assert.match(activation, /requirePasswordSetup\) showPasswordSetup[\s\S]*?await checkLegalAgreement\(user/);
  assert.match(activation, /await checkLegalAgreement\(user[\s\S]*?revealDashboard\(user\)/);
  assert.match(auth, /\.from\("user_legal_agreements"\)\.select\("terms_version, privacy_version"\)/);
  assert.match(auth, /\.from\("user_legal_agreements"\)\.insert\(/);
});

test('agreement record is minimal and protected to its signed-in owner', () => {
  assert.match(schema, /create table if not exists public\.user_legal_agreements \([\s\S]*?auth_user_id uuid not null references auth\.users\(id\) on delete cascade[\s\S]*?terms_version text not null[\s\S]*?privacy_version text not null[\s\S]*?accepted_at timestamptz not null default now\(\)/);
  assert.match(schema, /primary key \(auth_user_id, terms_version, privacy_version\)/);
  assert.match(policies, /alter table public\.user_legal_agreements enable row level security/);
  assert.match(policies, /revoke all on table public\.user_legal_agreements from anon, authenticated/);
  assert.match(policies, /grant select on table public\.user_legal_agreements to authenticated/);
  assert.match(policies, /grant insert \(auth_user_id, terms_version, privacy_version\) on table public\.user_legal_agreements to authenticated/);
  assert.match(policies, /on public\.user_legal_agreements for select[\s\S]*?using \(\(select auth\.uid\(\)\) = auth_user_id\)/);
  assert.match(policies, /on public\.user_legal_agreements for insert[\s\S]*?with check \(\(select auth\.uid\(\)\) = auth_user_id\)/);
  assert.doesNotMatch(policies, /on public\.user_legal_agreements for update/);
  assert.doesNotMatch(schema, /user_legal_agreements[\s\S]*?ip_address/);
});

test('the agreement has accessible document links, explicit action, retry, and sign out', () => {
  assert.match(auth, /id="auth-legal-agreement"[\s\S]*?href="\/terms"[\s\S]*?href="\/privacy"/);
  assert.match(auth, /id="auth-legal-accept"[^>]*>Agree &amp; continue/);
  assert.match(auth, /id="auth-legal-retry"/);
  assert.match(auth, /id="auth-legal-signout"/);
  const agreementMarkup = auth.slice(auth.indexOf('id="auth-legal-agreement"'), auth.indexOf('id="auth-password-setup-form"'));
  assert.doesNotMatch(agreementMarkup, /<input[^>]*type="checkbox"/);
});
