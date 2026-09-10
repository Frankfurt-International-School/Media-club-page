import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('info/index.html');
const script = read('info/info.js');
const config = read('info/config.js');
const styles = read('info/info.css');
const headers = read('info/_headers');
const build = read('tools/build-info.mjs');
const auth = read('supabase-config.js');
const admin = read('scripts/admin.js');
const edgeFunction = read('supabase/functions/submit-application/index.ts');
const functionConfig = read('supabase/config.toml');
const policySource = read('supabase-auth-policies.sql');
const portalMigration = read('supabase-public-portal.sql');
const schema = read('supabase-schema.sql');

test('public portal exposes only About, preview, Join, and member sign in', () => {
  const navigation = html.match(/<nav aria-label="Public site navigation">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.deepEqual([...navigation.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['#about', '#preview', '#join']);
  assert.match(html, /href="https:\/\/fismediaclub\.org\/signin">Member sign in/);
  assert.match(html, /You’re viewing the public Media Club preview/);
  assert.match(html, /Sample dashboard · Preview data only/);
  assert.match(html, /No student, event or equipment records are shown/);
  assert.doesNotMatch(html, /supabase-config\.js|scripts\/core\.js|id="page-members"|Admin Panel/);
});

test('public preview is static, branded, responsive, and honest about locked features', () => {
  assert.match(html, /assets\/about\/tech-show-crew-portrait\.webp/);
  assert.match(html, /assets\/about\/stroth-control-room\.webp/);
  assert.match(html, /assets\/fonts\/fonts\.css/);
  assert.match(html, /Member tools unlock after approval/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /font-family: var\(--head\)/);
});

test('public application form uses Turnstile and the dedicated Edge Function only', () => {
  assert.match(html, /id="join-email" name="email" type="email"/);
  assert.match(html, /option value="Adult">Adult \(write your department or role below\)<\/option>/);
  assert.match(html, /Adults: include your FIS department or school role/);
  assert.match(html, /id="turnstile-widget"/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(config, /functions\/v1\/submit-application/);
  assert.match(config, /__TURNSTILE_SITE_KEY__/);
  assert.match(script, /action: 'join_application'/);
  assert.match(script, /max-width: 360px/);
  assert.match(script, /turnstileToken/);
  assert.match(script, /fetch\(config\.submitApplicationUrl/);
  assert.match(script, /yearGroupInput\.value === 'Adult'/);
  assert.match(script, /studentAliasPattern[\s\S]*?schoolEmailPattern/);
  assert.doesNotMatch(script, /createClient|supabase-js|join_applications/);
});

test('public portal CSP permits Turnstile and the one submission origin without opening private APIs', () => {
  assert.match(headers, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(headers, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(headers, /connect-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/prswuqzzgordywowbwtc\.supabase\.co/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.doesNotMatch(headers, /wss:\/\//);
});

test('public build is isolated from the private Crew Center bundle', () => {
  assert.match(build, /const outputDirectory = 'dist-info'/);
  assert.match(build, /INFO_TURNSTILE_SITE_KEY/);
  assert.doesNotMatch(build, /supabase-config\.js|scripts['"]/);
  assert.match(build, /\['assets\/about', 'assets\/about'\]/);
});

test('application Edge Function validates origin, Turnstile, content, and duplicate pending email', () => {
  assert.match(edgeFunction, /https:\/\/info\.fismediaclub\.org/);
  assert.match(edgeFunction, /if \(!allowedOrigins\.has\(origin\)\)/);
  assert.match(edgeFunction, /TURNSTILE_SECRET_KEY/);
  assert.match(edgeFunction, /turnstile\/v0\/siteverify/);
  assert.match(edgeFunction, /result\.action === "join_application"/);
  assert.match(edgeFunction, /\^\[a-z\]\{2\}\\d\{4,\}@fis\\\.edu\$/i);
  assert.match(edgeFunction, /"Grade 12", "Adult"/);
  assert.match(edgeFunction, /yearGroup === "Adult" \? fisSchoolEmailPattern\.test\(email\) : fisAliasEmailPattern\.test\(email\)/);
  assert.match(schema, /join_applications_fis_email_check[\s\S]*?year_group = 'Adult' and public\.is_fis_school_email\(email\)[\s\S]*?public\.is_fis_alias_email\(email\)/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeFunction, /error\?\.code === "23505"/);
  assert.doesNotMatch(edgeFunction, /Access-Control-Allow-Origin": "\*"/);
  assert.match(functionConfig, /\[functions\.review-application\]\s*verify_jwt = true/);
  assert.match(functionConfig, /\[functions\.submit-application\]\s*verify_jwt = false/);
});

test('Crew Center no longer creates visitors or accepts direct application inserts', () => {
  assert.doesNotMatch(auth, /signInAnonymously|auth-visitor-submit|First time here\?/);
  assert.match(auth, /https:\/\/info\.fismediaclub\.org\//);
  assert.doesNotMatch(admin, /from\('join_applications'\)[\s\S]{0,200}insert/);
  assert.match(admin, /window\.location\.assign\('https:\/\/info\.fismediaclub\.org\/#join'\)/);
  assert.doesNotMatch(policySource, /create policy "Signed-in users can submit join applications"/);
  assert.match(policySource, /revoke insert on table public\.join_applications from anon, authenticated/);
  for (const rpc of ['get_public_events', 'get_public_gallery', 'get_public_equipment', 'get_public_announcements']) {
    assert.match(portalMigration, new RegExp(`revoke execute on function public\\.${rpc}\\(\\) from anon, authenticated`));
  }
});
