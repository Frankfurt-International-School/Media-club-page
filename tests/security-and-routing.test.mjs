import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const crewCenterScriptPaths = [...indexHtml.matchAll(/<script src="(scripts\/[^"]+)"><\/script>/g)].map(match => match[1]);
const appSource = crewCenterScriptPaths
  .map(path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
  .join('\n');
const appStyles = readFileSync(new URL('../crew-center.css', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../scripts/core.js', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../scripts/workspaces.js', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../scripts/router.js', import.meta.url), 'utf8');
const initSource = readFileSync(new URL('../scripts/init.js', import.meta.url), 'utf8');
const headersFile = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
const redirectsFile = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');
const fontsCss = readFileSync(new URL('../assets/fonts/fonts.css', import.meta.url), 'utf8');
const fisLogo = readFileSync(new URL('../assets/fis-logo.png', import.meta.url));
const mediaClubLogo = readFileSync(new URL('../assets/media-club-logo.png', import.meta.url));
const sacWarriorsMark = readFileSync(new URL('../assets/sac-warriors-mark.png', import.meta.url));
const buildSource = readFileSync(new URL('../tools/build-static.mjs', import.meta.url), 'utf8');
const aboutImageNames = [
  'tech-show-crew-portrait.webp',
  'tech-show-crew-portrait-mobile.webp',
  'stroth-control-room.webp',
  'tech-show-fieldwork.webp',
  'tech-show-anchors.webp',
  'tech-show-team.webp',
  'crew-center-field-operator.webp',
  'crew-center-field-operator-mobile.webp',
];

function globalHeaders() {
  const lines = headersFile.split(/\r?\n/);
  assert.equal(lines[0], '/*');
  const headers = new Map();
  for (const line of lines.slice(1)) {
    if (!line.startsWith('  ')) break;
    const separator = line.indexOf(':');
    assert.ok(separator > 2, `Malformed header line: ${line}`);
    headers.set(line.slice(2, separator), line.slice(separator + 1).trim());
  }
  return headers;
}

function inlineScriptBodies() {
  return [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
}

function extractWorkspaceFunction(name) {
  const start = workspaceSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Expected ${name} in scripts/workspaces.js`);
  const bodyStart = workspaceSource.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < workspaceSource.length; index += 1) {
    if (workspaceSource[index] === '{') depth += 1;
    if (workspaceSource[index] === '}') depth -= 1;
    if (depth === 0) return workspaceSource.slice(start, index + 1);
  }
  throw new Error(`Could not find the end of ${name}`);
}

test('Cloudflare headers enforce transport, framing, capability, and MIME protections', () => {
  const headers = globalHeaders();
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.match(headers.get('Permissions-Policy'), /camera=\(\)/);
  assert.match(headers.get('Permissions-Policy'), /microphone=\(\)/);

  const csp = headers.get('Content-Security-Policy');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /font-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/prswuqzzgordywowbwtc\.supabase\.co wss:\/\/prswuqzzgordywowbwtc\.supabase\.co/);
  assert.match(csp, /upgrade-insecure-requests/);

  for (const line of headersFile.split(/\r?\n/)) {
    assert.ok(line.length <= 2000, 'Cloudflare Pages ignores individual _headers lines over 2,000 characters');
  }
});

test('every inline script block is hash-pinned by CSP', () => {
  const csp = globalHeaders().get('Content-Security-Policy');
  const bodies = inlineScriptBodies();
  assert.equal(bodies.length, 1);
  for (const body of bodies) {
    const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`;
    assert.ok(csp.includes(`'${hash}'`), `Missing CSP hash ${hash}`);
  }
  assert.match(csp, /script-src-attr 'unsafe-inline'/, 'legacy inline UI handlers must remain functional');
  const scriptElementPolicy = csp.split(';').map(part => part.trim()).find(part => part.startsWith('script-src '));
  assert.doesNotMatch(scriptElementPolicy, /'unsafe-inline'/, 'script elements must not allow arbitrary inline code');
});

test('Crew Center assets stay static-host compatible and load in dependency order', () => {
  assert.match(indexHtml, /<link rel="stylesheet" href="crew-center\.css">/);
  assert.doesNotMatch(indexHtml, /<style>/);
  assert.deepEqual(crewCenterScriptPaths, [
    'scripts/core.js',
    'scripts/workspaces.js',
    'scripts/router.js',
    'scripts/ui.js',
    'scripts/dashboard.js',
    'scripts/events.js',
    'scripts/sac-events.js',
    'scripts/sac-signups.js',
    'scripts/meetings.js',
    'scripts/signups.js',
    'scripts/crew-schedule.js',
    'scripts/members.js',
    'scripts/gallery.js',
    'scripts/equipment.js',
    'scripts/cas-attendance.js',
    'scripts/admin.js',
    'scripts/init.js',
  ]);
  assert.match(indexHtml, /<script src="supabase-config\.js"><\/script>\s*<script src="scripts\/core\.js"><\/script>\s*<script src="scripts\/workspaces\.js"><\/script>/);
  assert.match(indexHtml, /<script src="scripts\/init\.js"><\/script>\s*<script src="tutorial\.js"><\/script>/);
  assert.doesNotMatch(redirectsFile, /^\s*\/\*/m, 'Cloudflare native SPA fallback must not override matching static HTML pages');
});

test('SAC deep-link refreshes resolve shared assets from the deployment root', () => {
  const baseHref = indexHtml.match(/<base href="([^"]+)">/)?.[1];
  assert.equal(baseHref, '/', 'the app is deployed at the root on both hostnames');
  const assets = [
    'crew-center.css',
    'supabase-config.js',
    'scripts/core.js',
    'scripts/sac-events.js',
    'scripts/sac-signups.js',
    'assets/media-club-logo.png',
    'assets/sac-warriors-mark.png',
  ];
  for (const host of ['sac.fismediaclub.org', 'fismediaclub.org']) {
    for (const route of ['/sac/events', '/sac/signups', '/sac/my-shifts', '/sac/members']) {
      const documentUrl = new URL(route, `https://${host}`);
      const baseUrl = new URL(baseHref, documentUrl);
      for (const asset of assets) {
        assert.equal(new URL(asset, baseUrl).pathname, `/${asset}`, `${host}${route} must not request a nested asset`);
      }
    }
  }
});

test('production builds content-version local scripts and stylesheets', () => {
  assert.match(buildSource, /localAssets\.filter\(path => \/\\\.\(\?:css\|js\)\$\//);
  assert.match(buildSource, /createHash\('sha256'\)[\s\S]*?slice\(0, 12\)/);
  assert.match(buildSource, /versionedAssets\.get\(asset\)/);
  assert.match(buildSource, /reference\.includes\('\?'\) \? '&' : '\?'/);
  assert.match(buildSource, /writeFileSync\(join\(outputDirectory, 'index\.html'\), html\)/);
});

test('fonts are self-hosted with licenses and no Google Fonts runtime requests', () => {
  assert.doesNotMatch(indexHtml, /fonts\.(googleapis|gstatic)\.com/);
  assert.doesNotMatch(fontsCss, /https?:\/\//);
  assert.match(indexHtml, /href="assets\/fonts\/fonts\.css"/);

  for (const file of [
    'bebas-neue-latin.woff2',
    'bebas-neue-latin-ext.woff2',
    'space-grotesk-latin.woff2',
    'space-grotesk-latin-ext.woff2',
  ]) {
    const bytes = readFileSync(new URL(`../assets/fonts/${file}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2', `${file} must be a valid WOFF2 file`);
    assert.ok(fontsCss.includes(`./${file}`), `${file} must be referenced by fonts.css`);
  }

  for (const license of ['BEBAS-NEUE-OFL.txt', 'SPACE-GROTESK-OFL.txt']) {
    assert.match(readFileSync(new URL(`../assets/fonts/${license}`, import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});

test('the Media Club logo is a lightweight local raster asset', () => {
  assert.deepEqual([...mediaClubLogo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(mediaClubLogo.length < 50_000, 'the small interface logo should remain below 50 KB');
  assert.match(indexHtml, /assets\/media-club-logo\.png/);
  assert.match(authSource, /assets\/media-club-logo\.png/);
  assert.doesNotMatch(indexHtml, /media-club-logo\.svg/);
  assert.doesNotMatch(authSource, /media-club-logo\.svg/);
});

test('dark mode includes the signed-out authentication surface', () => {
  assert.match(authSource, /:root\[data-theme="dark"\] \.auth-gate\s*\{/);
  assert.match(authSource, /:root\[data-theme="dark"\] \.auth-gate-card\s*\{/);
  assert.match(authSource, /:root\[data-theme="dark"\] \.auth-gate-input\s*\{/);
  assert.match(authSource, /:root\[data-theme="dark"\] \.auth-public-link\s*\{/);
});

test('authentication startup and sign-out remain responsive during upstream stalls', () => {
  assert.match(authSource, /const authStartupTimeoutMs = 8000/);
  assert.match(authSource, /const authOperationTimeoutMs = 8000/);
  assert.match(authSource, /const memberApprovalTimeoutMs = 3000/);
  assert.match(authSource, /auth\.onAuthStateChange\(\(event, session\) => \{\s*setTimeout\(\(\) => \{/);
  assert.match(authSource, /\["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"\]\.includes\(event\)/);
  assert.match(authSource, /auth\.signOut\(\{ scope: "local" \}\)/);
  const signOutStart = authSource.indexOf('async function signOutCrewCenterSession()');
  const signOutEnd = authSource.indexOf('\nauthLookupRetry.addEventListener', signOutStart);
  const signOutSource = authSource.slice(signOutStart, signOutEnd);
  assert.ok(signOutSource.indexOf('showSignIn();') < signOutSource.indexOf('auth.signOut({ scope: "local" })'));
  assert.match(signOutSource, /clearStoredCrewCenterSession\(\)/);
  assert.doesNotMatch(initSource, /loadCrewCenterData\(\)/);
  assert.match(coreSource, /function withCrewCenterDataTimeout\(operation, dataset\)/);
  assert.match(coreSource, /async function loadCrewCenterInitialData\(\)/);
  assert.match(coreSource, /if \(!visitor\) await loadCrewCenterData\(\{ datasets: \['members'\] \}\)/);
  assert.match(coreSource, /setTimeout\(\(\) => loadCrewCenterData\(\{ datasets: backgroundDatasets, silent: true \}\), 0\)/);
  assert.match(authSource, /function finishCrewCenterStartup\(\)/);
  assert.match(authSource, /document\.body\.classList\.contains\("auth-ready"\)[\s\S]*?applySignedInUser\(user\);/);
  assert.match(authSource, /initialDataEpoch !== authEpoch/);
  assert.doesNotMatch(authSource, /setTimeout\(finishCrewCenterStartup, 0\)/);
  assert.match(authSource, /function releasePendingSidebar\(authEpoch\)/);
  assert.match(coreSource, /window\.applySidebarPreferences = applySidebarPreferences/);
  assert.match(authSource, /document\.documentElement\.classList\.remove\("sidebar-pending"\)/);
  assert.match(authSource, /}, 2500\);/);
  assert.match(initSource, /window\.finishCrewCenterStartup\?\.\(\);/);
});

test('password recovery stays locked until the member saves a new password', () => {
  assert.match(authSource, /const pendingPasswordSetupKey = "crew-center-pending-password-setup"/);
  assert.match(authSource, /\["invite", "recovery"\]\.includes/);
  assert.match(authSource, /const authHashParams = new URLSearchParams\(window\.location\.hash\.slice\(1\)\)/);
  assert.match(authSource, /const authSearchParams = new URLSearchParams\(window\.location\.search\)/);
  assert.match(authSource, /authHashParams\.get\("type"\) \|\| authSearchParams\.get\("type"\)/);

  const rememberStart = authSource.indexOf('function rememberPendingPasswordSetup(mode)');
  const rememberEnd = authSource.indexOf('\nfunction clearPendingPasswordSetup()', rememberStart);
  const rememberSource = authSource.slice(rememberStart, rememberEnd);
  assert.match(rememberSource, /sessionStorage\.setItem\(pendingPasswordSetupKey, passwordSetupMode\)/);
  assert.match(rememberSource, /localStorage\.setItem\(pendingPasswordSetupKey, passwordSetupMode\)/);

  const clearStart = rememberEnd + 1;
  const clearEnd = authSource.indexOf('\nfunction passwordSetupSubmitLabel()', clearStart);
  const clearSource = authSource.slice(clearStart, clearEnd);
  assert.match(clearSource, /sessionStorage\.removeItem\(pendingPasswordSetupKey\)/);
  assert.match(clearSource, /localStorage\.removeItem\(pendingPasswordSetupKey\)/);

  const recoveryStart = authSource.indexOf('if (event === "PASSWORD_RECOVERY")');
  const recoveryEnd = authSource.indexOf('\n      if (["INITIAL_SESSION"', recoveryStart);
  const recoverySource = authSource.slice(recoveryStart, recoveryEnd);
  assert.ok(recoveryStart > -1 && recoveryEnd > recoveryStart, 'Expected a dedicated recovery auth-event branch');
  assert.match(recoverySource, /rememberPendingPasswordSetup\("recovery"\)/);
  assert.match(recoverySource, /force: true/);
  assert.match(recoverySource, /requirePasswordSetup: true/);
  assert.match(recoverySource, /passwordSetupMode: "recovery"/);

  const activationStart = authSource.indexOf('async function activateCrewCenterUser(user, options = {})');
  const activationEnd = authSource.indexOf('\nasync function signOutCrewCenterSession()', activationStart);
  const activationSource = authSource.slice(activationStart, activationEnd);
  assert.match(activationSource, /options\.requirePasswordSetup === true \|\| passwordSetupRequired\(\)/);
  assert.match(activationSource, /if \(requirePasswordSetup\) showPasswordSetup\(requestedPasswordSetupMode, user\.email\);\s*else revealDashboard\(user\);/);

  const setupStart = authSource.indexOf('function showPasswordSetup(');
  const setupEnd = authSource.indexOf('\npasswordSetupForm.addEventListener', setupStart);
  const setupSource = authSource.slice(setupStart, setupEnd);
  assert.match(setupSource, /"Reset your password"/);
  assert.match(setupSource, /"Choose a new password for your Media Club account\."/);
  assert.match(authSource, /passwordSetupMode === "recovery" \? "Save new password" : "Set password"/);
  assert.match(setupSource, /You will use this password the next time you sign in\./);

  const submissionStart = setupEnd + 1;
  const submissionEnd = authSource.indexOf('\nauthForm.addEventListener', submissionStart);
  const submissionSource = authSource.slice(submissionStart, submissionEnd);
  const updateIndex = submissionSource.indexOf('auth.updateUser({ password })');
  const completeIndex = submissionSource.indexOf('passwordSetupComplete = true;');
  const clearIndex = submissionSource.indexOf('clearPendingPasswordSetup();');
  const activateIndex = submissionSource.indexOf('await activateCrewCenterUser(data.user, { force: true });');
  assert.ok(updateIndex > -1 && updateIndex < completeIndex && completeIndex < clearIndex && clearIndex < activateIndex,
    'The recovery lock must clear only after the password update succeeds and before the dashboard reopens');

  const signInStart = authSource.indexOf('function showSignIn()');
  const signInEnd = authSource.indexOf('\nasync function activateCrewCenterUser', signInStart);
  const signInSource = authSource.slice(signInStart, signInEnd);
  assert.match(signInSource, /authForm\.style\.display = "block"/);
  assert.match(signInSource, /passwordSetupForm\.style\.display = "none"/);
  assert.match(signInSource, /if \(!passwordSetupRequired\(\) && window\.location\.pathname !== "\/signin"\)/);
  assert.match(authSource, /auth\.signInWithPassword\(\{ email, password \}\)[\s\S]*?if \(error\) throw error;\s*passwordSetupComplete = false;\s*clearPendingPasswordSetup\(\);\s*await activateCrewCenterUser\(data\.user\);/);
  assert.doesNotMatch(authSource, /signInAnonymously|auth-visitor-submit/);
  assert.match(authSource, /href="https:\/\/info\.fismediaclub\.org\/"/);
  assert.doesNotMatch(authSource, /inviteFlow|inviteSetupComplete|showInviteSetup/);
});

test('expired auth links offer a fresh access link instead of trapping users in password setup', () => {
  assert.match(authSource, /const authLinkErrorCode = authHashParams\.get\("error_code"\)/);
  assert.match(authSource, /const authLinkExpired = authLinkErrorCode === "otp_expired"/);
  assert.match(authSource, /const authLinkType = authLinkFailure \? "" : normalizePasswordSetupMode/);
  assert.match(authSource, /if \(authLinkFailure\) \{[\s\S]*?removeItem\(pendingPasswordSetupKey\)[\s\S]*?history\.replaceState\(\{ page: "signin" \}, "", "\/signin"\)/);
  assert.match(authSource, /let pendingAuthLinkFailure = authLinkFailure \? \{ expired: authLinkExpired \} : null/);
  assert.match(authSource, /function applySignInPresentation\(\)[\s\S]*?"Invitation link not working\?"[\s\S]*?authPasswordField\.hidden = recoveringExpiredLink[\s\S]*?authPassword\.disabled = recoveringExpiredLink[\s\S]*?authExpiredActions\.classList\.toggle\("visible", recoveringExpiredLink\)/);
  assert.match(authSource, /\.auth-gate \[hidden\] \{\s*display: none !important/);
  assert.match(authSource, /That invitation or password link expired or was already used\. Request a new password link below\./);
  assert.match(authSource, /You do not need to apply again\./);
  assert.match(authSource, /Check your inbox and spam folder for the reset-password email\. Open only the newest link/);
  assert.match(authSource, /id="auth-expired-resend" type="button">Email me a new password link<\/button>/);
  assert.match(authSource, /id="auth-setup-recovery" type="button">Get another password link<\/button>/);
  assert.match(authSource, /authExpiredResend\.addEventListener\("click", requestPasswordReset\)/);
  assert.match(authSource, /authExpiredBack\.addEventListener\("click", \(\) => \{[\s\S]*?pendingAuthLinkFailure = null/);
  assert.match(authSource, /authForm\.addEventListener\("submit", async event => \{[\s\S]*?if \(pendingAuthLinkFailure\) \{\s*await requestPasswordReset\(\);/);
  assert.match(authSource, /if \(requirePasswordSetup\) showPasswordSetup\(requestedPasswordSetupMode, user\.email\)/);
  assert.match(authSource, /function showMissingPasswordLinkRecovery\(\) \{\s*clearPendingPasswordSetup\(\);\s*pendingAuthLinkFailure = \{ expired: true \};[\s\S]*?showSignIn\(\);/);
  assert.match(authSource, /async function returnToPasswordLinkRecovery\(\) \{[\s\S]*?await signOutCrewCenterSession\(\);[\s\S]*?showMissingPasswordLinkRecovery\(\);/);
  assert.match(authSource, /authSetupRecovery\.addEventListener\("click", returnToPasswordLinkRecovery\)/);
  assert.match(authSource, /if \(isUnusablePasswordLinkError\(error\)\) \{\s*await returnToPasswordLinkRecovery\(\);\s*return;/);
  assert.match(authSource, /const authCallbackHasCredentials = Boolean\([\s\S]*?authHashParams\.get\("access_token"\)[\s\S]*?authSearchParams\.get\("code"\)/);
  assert.match(authSource, /if \(!pendingAuthLinkFailure && passwordSetupRequired\(\) && !authCallbackHasCredentials\) showMissingPasswordLinkRecovery\(\)/);
  const unusableLinkSource = authSource.match(/function isUnusablePasswordLinkError\(error\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(unusableLinkSource, 'Expected a handler for invalid password-setup sessions');
  const isUnusablePasswordLinkError = vm.runInNewContext(`(${unusableLinkSource})`);
  assert.equal(isUnusablePasswordLinkError({ name: 'AuthSessionMissingError' }), true);
  assert.equal(isUnusablePasswordLinkError({ code: 'session_expired' }), true);
  assert.equal(isUnusablePasswordLinkError({ code: 'invite_not_found' }), true);
  assert.equal(isUnusablePasswordLinkError({ code: 'weak_password' }), false);
  assert.equal(isUnusablePasswordLinkError({ code: 'over_email_send_rate_limit' }), false);
});

test('the sign-in gate can request a privacy-safe password reset email', () => {
  assert.match(authSource, /<button class="auth-password-reset" id="auth-password-reset" type="button">Forgot password\?<\/button>/);
  assert.match(authSource, /\.auth-password-reset:focus-visible/);
  assert.match(authSource, /:root\[data-theme="dark"\] \.auth-password-reset/);
  assert.match(authSource, /id="auth-gate-error" role="alert" aria-live="polite"/);
  assert.match(authSource, /authError\.classList\.toggle\("success", type === "success"\)/);
  assert.match(authSource, /authError\.setAttribute\("role", type === "success" \? "status" : "alert"\)/);

  const resetStart = authSource.indexOf('async function requestPasswordReset()');
  const resetEnd = authSource.indexOf('\nauthPasswordReset.addEventListener', resetStart);
  const resetSource = authSource.slice(resetStart, resetEnd);
  assert.ok(resetStart > -1 && resetEnd > resetStart, 'Expected a shared password-reset request handler');
  assert.match(resetSource, /const email = authEmail\.value\.trim\(\)\.toLowerCase\(\)/);
  assert.match(resetSource, /if \(!authEmail\.checkValidity\(\)\) \{\s*authEmail\.reportValidity\(\);\s*return;/);
  assert.match(resetSource, /const redirectTo = new URL\("\/signin", window\.location\.origin\)\.toString\(\)/);
  assert.match(resetSource, /auth\.resetPasswordForEmail\(email, \{ redirectTo \}\)/);
  assert.equal(new URL('/signin', 'https://sac.fismediaclub.org').toString(), 'https://sac.fismediaclub.org/signin');
  assert.match(resetSource, /withCrewCenterTimeout\([\s\S]*?authOperationTimeoutMs/);
  assert.match(resetSource, /If an approved Crew Center account uses that email, a fresh password link has been sent\./);
  assert.match(resetSource, /setAuthMessage\([\s\S]*?"success"/);
  assert.doesNotMatch(resetSource, /functions\.invoke|account does not exist|no account/i);
  assert.match(authSource, /authPasswordReset\.addEventListener\("click", requestPasswordReset\)/);
  assert.match(authSource, /authExpiredResend\.addEventListener\("click", requestPasswordReset\)/);
  assert.match(authSource, /function setAuthBusy\(isBusy\)[\s\S]*?authPasswordReset\.disabled = isBusy/);

  const setupGuide = readFileSync(new URL('../SUPABASE-APPLICATION-SETUP.md', import.meta.url), 'utf8');
  assert.match(setupGuide, /Forgot password\?[\s\S]*?does not require an Edge Function/);
  assert.match(setupGuide, /Authentication > Emails > Templates > Invite user[\s\S]*?Reset password/);
});

test('production identity uses the custom domain across metadata and invitations', () => {
  const setupGuide = readFileSync(new URL('../SUPABASE-APPLICATION-SETUP.md', import.meta.url), 'utf8');
  const reviewApplicationSource = readFileSync(new URL('../supabase/functions/review-application/index.ts', import.meta.url), 'utf8');

  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/fismediaclub\.org\/">/);
  assert.match(indexHtml, /<title>FIS Media Club<\/title>/);
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/fismediaclub\.org\/">/);
  assert.match(indexHtml, /<meta property="og:title" content="FIS Media Club">/);
  assert.match(indexHtml, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(indexHtml, /<meta name="twitter:title" content="FIS Media Club">/);
  assert.match(reviewApplicationSource, /Deno\.env\.get\("SITE_URL"\) \|\| "https:\/\/fismediaclub\.org"/);
  assert.match(setupGuide, /Set \*\*Site URL\*\* to `https:\/\/fismediaclub\.org`/);
  assert.match(setupGuide, /SITE_URL=https:\/\/fismediaclub\.org/);
  assert.match(setupGuide, /no-reply@auth\.fismediaclub\.org/);
});

test('branded auth email templates preserve secure Supabase links and safe email markup', () => {
  const templatePaths = ['invite-user.html', 'reset-password.html'];

  for (const templatePath of templatePaths) {
    const template = readFileSync(new URL(`../email-templates/${templatePath}`, import.meta.url), 'utf8');
    assert.match(template, /href="\{\{ \.ConfirmationURL \}\}"/);
    assert.match(template, /https:\/\/fismediaclub\.org\/assets\/fis-logo\.png/);
    assert.match(template, /font-family:Arial, Helvetica, sans-serif/);
    assert.match(template, /font-size:38px; font-weight:700; line-height:46px/);
    assert.doesNotMatch(template, /@font-face|Bebas Neue|Space Grotesk|Arial Narrow/);
    assert.match(template, /FIS Media Club/);
    assert.match(template, /role="presentation"/);
    assert.doesNotMatch(template, /<script|javascript:|tracking/i);
  }

  const passwordChangedTemplate = readFileSync(new URL('../email-templates/password-changed.html', import.meta.url), 'utf8');
  assert.match(passwordChangedTemplate, /Your password was changed/);
  assert.match(passwordChangedTemplate, /\{\{ \.Email \}\}/);
  assert.match(passwordChangedTemplate, /href="https:\/\/fismediaclub\.org\/signin"/);
  assert.match(passwordChangedTemplate, /https:\/\/fismediaclub\.org\/assets\/fis-logo\.png/);
  assert.match(passwordChangedTemplate, /font-family:Arial, Helvetica, sans-serif/);
  assert.match(passwordChangedTemplate, /font-size:38px; font-weight:700; line-height:46px/);
  assert.doesNotMatch(passwordChangedTemplate, /@font-face|Bebas Neue|Space Grotesk|Arial Narrow/);
  assert.match(passwordChangedTemplate, /role="presentation"/);
  assert.doesNotMatch(passwordChangedTemplate, /\{\{ \.ConfirmationURL \}\}|<script|javascript:|tracking/i);

  const templateGuide = readFileSync(new URL('../email-templates/README.md', import.meta.url), 'utf8');
  assert.match(templateGuide, /Supabase Auth/);
  assert.match(templateGuide, /Creating a template only in the Resend dashboard will not change/);
  assert.match(templateGuide, /Send Email Hook/);
  assert.match(templateGuide, /Password changed/);
  assert.match(templateGuide, /password-changed\.html/);
});

test('route changes, filters, settings tabs, and toasts expose accessible state', () => {
  assert.match(indexHtml, /id="route-announcer" aria-live="polite" aria-atomic="true"/);
  assert.match(appSource, /heading\.focus\(\{ preventScroll: false \}\)/);
  assert.match(appStyles, /\.page :is\(h1, \.page-title\)\[tabindex="-1"\]:focus \{ outline: none; \}/);
  assert.match(appSource, /t\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
  assert.match(indexHtml, /id="event-filters" role="group" aria-label="Filter events"/);
  assert.match(indexHtml, /class="filter-chip active" aria-pressed="true"/);
  assert.match(indexHtml, /class="settings-nav" role="tablist"/);
  assert.match(indexHtml, /data-settings-section="appearance" role="tabpanel"/);
  assert.match(appSource, /item\.setAttribute\('aria-selected', String\(active\)\)/);
});

test('primary content pages share the branded page hero', () => {
  assert.deepEqual([...fisLogo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(fisLogo.length < 150_000, 'decorative FIS logo should remain lightweight');
  assert.match(appStyles, /\.page-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(appStyles, /\.dashboard-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(appStyles, /\.equipment-status-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(appStyles, /\.deployment-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(appStyles, /\.role-guide-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.doesNotMatch(appStyles, /\.(?:page|dashboard|equipment-status|role-guide)-hero::after\s*\{/);
  assert.doesNotMatch(appStyles, /\.deployment-hero::after\s*\{/);
  assert.match(appStyles, /:root\[data-theme="dark"\] \.page-hero::before/);

  for (const pageId of ['events', 'meetings', 'signup', 'members', 'gallery', 'equipment']) {
    const start = indexHtml.indexOf(`<div id="page-${pageId}"`);
    const end = indexHtml.indexOf('<!-- ──', start + 1);
    assert.ok(start > -1 && end > start, `Expected ${pageId} page markup`);
    assert.match(indexHtml.slice(start, end), /<section class="page-hero(?: [^"]+)?">/);
  }
});

test('About Media Club is a local, privacy-conscious brochure page', () => {
  const start = indexHtml.indexOf('<div id="page-about" class="page">');
  const end = indexHtml.indexOf('<!-- ── SAC WORKSPACE ── -->', start);
  assert.ok(start > -1 && end > start, 'Expected the About Media Club page markup');
  const aboutMarkup = indexHtml.slice(start, end);
  assert.match(aboutMarkup, /Discover Media Club/);
  assert.match(aboutMarkup, /Grades 6–12/);
  assert.match(aboutMarkup, /id="about-recent-projects"/);
  assert.match(aboutMarkup, /href="\/gallery"/);
  assert.equal((aboutMarkup.match(/href="\/join"/g) || []).length, 1, 'About should keep only the final visitor application link');
  assert.doesNotMatch(aboutMarkup, />Join the club<\/a>/);
  assert.match(aboutMarkup, /<picture class="about-hero-media">[\s\S]*?tech-show-crew-portrait-mobile\.webp[\s\S]*?tech-show-crew-portrait\.webp/);
  assert.match(aboutMarkup, /tech-show-fieldwork\.webp/);
  assert.match(aboutMarkup, /<picture class="about-platform-media">[\s\S]*?crew-center-field-operator-mobile\.webp[\s\S]*?crew-center-field-operator\.webp/);
  assert.match(aboutMarkup, /first FIS service club to operate through its own fully personalised Crew Center/);
  assert.match(aboutMarkup, /class="about-platform-credit"[\s\S]*?Made by Shenghan Lang/);
  assert.equal((indexHtml.match(/Made by Shenghan Lang/g) || []).length, 1, 'Crew Center creator credit should appear on one page only');
  assert.doesNotMatch(aboutMarkup, /<script|https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/i);

  for (const file of aboutImageNames) {
    const bytes = readFileSync(new URL(`../assets/about/${file}`, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${file} must be WebP`);
    assert.ok(bytes.length < 200_000, `${file} should remain lightweight`);
    assert.ok(aboutMarkup.includes(`assets/about/${file}`), `${file} must be used on the about page`);
  }

  assert.match(indexHtml, /class="nav-item" data-page="about" data-category="club"/);
  assert.match(appSource, /club: \{ label: 'Club', pages: \['crew-deployment', 'equipment-status', 'join', 'about', 'admin'\] \}/);
  assert.match(appSource, /items: customized && saved\.length \? saved : available/);
  assert.match(appSource, /classList\.toggle\('visible', hiddenCount > 0\)/);
  assert.doesNotMatch(appSource, /all-pages-hidden-label|>Hidden<\/span>/);
  assert.doesNotMatch(appStyles, /\.all-pages-hidden-label/);
  assert.match(schemaSql, /sidebar_items text\[\] not null default array\[[^\]]*'about'[^\]]*\]::text\[\]/);
  assert.match(appStyles, /\.about-beginner:hover \.about-beginner-media img[\s\S]*?scale\(1\.04\)/);
});

test('Media Role Guide includes the approved stream expectations', () => {
  const start = indexHtml.indexOf('<section class="stream-expectations"');
  const end = indexHtml.indexOf('<section class="role-guide-section">', start);
  assert.ok(start > -1 && end > start, 'Expected Stream Expectations before the role cards');
  const expectations = indexHtml.slice(start, end);
  assert.equal((expectations.match(/data-expectation=/g) || []).length, 10);
  assert.match(expectations, /Phase 01[\s\S]*?Before live/);
  assert.match(expectations, /Phase 02[\s\S]*?On air/);
  assert.match(expectations, /Phase 03[\s\S]*?After the stream/);
  assert.match(expectations, /class="stream-expectations-callout"[\s\S]*?<strong>10 min<\/strong>/);
  assert.match(expectations, /fully ready at least 10 minutes before the scheduled stream start/);
  assert.match(expectations, /do not have to verbally respond to every instruction/);
  assert.match(expectations, /when their camera is live or is about to go live/);
  assert.match(expectations, /Do not show injuries on stream/);
  assert.match(expectations, /Use a neutral wide shot/);
  const photographerCard = indexHtml.slice(indexHtml.indexOf('<h3>Photographer</h3>'), indexHtml.indexOf('</article>', indexHtml.indexOf('<h3>Photographer</h3>')));
  assert.match(photographerCard, /Media Club loan camera or the personal camera selected in their signup/);
  assert.match(photographerCard, /Personal equipment is optional and is brought and used at the owner’s own risk/);
  assert.match(photographerCard, /Club camera reservations include a compatible lens and the complete kit must be returned after the event/);
});

test('gallery projects support an optional production date and link guidance', () => {
  assert.match(indexHtml, /id="gal-produced-on" type="date"/);
  assert.ok(indexHtml.indexOf('id="gal-link"') < indexHtml.indexOf('id="gal-produced-on"'));
  assert.ok(indexHtml.indexOf('id="gal-produced-on"') < indexHtml.indexOf('id="gal-event"'));
  assert.match(indexHtml, /id="gal-scope"[\s\S]*?value="athletics">Athletics library · restricted/);
  assert.match(appSource, /restrict sharing to the Athletics department or FIS accounts/);
  assert.match(appSource, /Choose the production date first/);
  assert.match(appSource, /No events on this date/);
  assert.match(appSource, /produced_on: producedOn/);
  assert.match(appSource, /project_scope: projectScope/);
  assert.match(appSource, /producedOn: item\.produced_on \|\| ''/);
  assert.match(appSource, /Produced \$\{escapeHtml\(producedLabel\)\}/);
  assert.match(appSource, /Linked event[\s\S]*?escapeHtml\(eventLabel\)/);
});

test('canonical routes and aliases survive static-host deep links', () => {
  const start = appSource.indexOf('const pageRoutes =');
  const end = appSource.indexOf('function navItemForPage', start);
  assert.ok(start > -1 && end > start);
  const context = { URLSearchParams, window: { location: { pathname: '/', search: '' } } };
  vm.runInNewContext(`${appSource.slice(start, end)}\nglobalThis.__routing = { pageRoutes, routePages, pageFromPath, pageUrl, tabValueFromUrl };`, context);

  for (const [page, route] of Object.entries(context.__routing.pageRoutes)) {
    context.window.location.pathname = route;
    assert.equal(context.__routing.pageFromPath(), page, `${route} should open ${page}`);
  }
  context.window.location.pathname = '/signup';
  assert.equal(context.__routing.pageFromPath(), 'signup');
  context.window.location.pathname = '/not-a-route';
  assert.equal(context.__routing.pageFromPath(), 'home');
  assert.equal(context.__routing.pageUrl('gallery', { tab: 'video' }), '/gallery?tab=video');
  context.window.location.search = '?tab=announcements';
  assert.equal(context.__routing.tabValueFromUrl(['pending', 'announcements'], 'pending'), 'announcements');
  context.window.location.search = '?tab=not-a-tab';
  assert.equal(context.__routing.tabValueFromUrl(['pending', 'announcements'], 'pending'), 'pending');

  assert.doesNotMatch(redirectsFile, /^\s*\/\*/m, 'Cloudflare supplies SPA fallback when no top-level 404.html exists');
  assert.doesNotMatch(buildSource, /['"]404\.html['"]/);
  assert.match(headersFile, /\/signup\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/signups\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/meetings\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/signin\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/crew-center\.css\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.match(headersFile, /\/tutorial\.css\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.match(headersFile, /\/assets\/fonts\/fonts\.css\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.match(headersFile, /\/supabase-config\.js\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.match(headersFile, /\/tutorial\.js\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.match(headersFile, /\/scripts\/\*\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.match(authSource, /window\.location\.pathname !== "\/signin"[\s\S]*?history\.replaceState\(\{ page: "signin" \}, "", "\/signin"\)/);
  assert.match(authSource, /window\.location\.pathname === "\/signin"[\s\S]*?defaultRoute[\s\S]*?history\.replaceState/);
});

test('SAC hostname selection remains separate from SAC authorization', () => {
  const functionNames = [
    'normalizeWorkspaceHostname',
    'workspaceFromHostname',
    'workspaceFromSearch',
    'resolvedWorkspaceForLocation',
    'workspaceSearchForSelection',
    'memberCanAccessSacWorkspace',
    'resolvedWorkspaceForHostname',
    'resolveWorkspaceSelection',
    'workspacePageFor',
  ];
  const source = functionNames.map(extractWorkspaceFunction).join('\n');
  const context = { URLSearchParams };
  vm.runInNewContext(`${source}\nglobalThis.__workspace = { workspaceFromHostname, workspaceFromSearch, resolvedWorkspaceForLocation, workspaceSearchForSelection, memberCanAccessSacWorkspace, resolvedWorkspaceForHostname, resolveWorkspaceSelection, workspacePageFor };`, context);
  const logic = context.__workspace;

  assert.equal(logic.workspaceFromHostname('sac.fismediaclub.org'), 'sac');
  assert.equal(logic.workspaceFromHostname('SAC.FISMEDIACLUB.ORG.'), 'sac');
  assert.equal(logic.workspaceFromHostname('fismediaclub.org'), 'media');
  assert.equal(logic.workspaceFromSearch('?workspace=sac'), 'sac');
  assert.equal(logic.workspaceFromSearch('?workspace=media'), 'media');
  assert.equal(logic.workspaceFromSearch('?workspace=anything-else'), null);
  assert.equal(logic.resolvedWorkspaceForHostname('sac.fismediaclub.org', true), 'sac');
  assert.equal(logic.resolvedWorkspaceForHostname('sac.fismediaclub.org', false), 'media', 'hostname alone must never grant SAC access');
  assert.equal(logic.resolvedWorkspaceForHostname('fismediaclub.org', true), 'media');
  assert.equal(logic.resolvedWorkspaceForLocation('fismediaclub.org', '?workspace=sac', true), 'sac');
  assert.equal(logic.resolvedWorkspaceForLocation('sac.fismediaclub.org', '?workspace=media', true), 'media');
  assert.equal(logic.resolvedWorkspaceForLocation('fismediaclub.org', '?workspace=sac', false), 'media');
  assert.equal(logic.workspaceSearchForSelection('sac', 'fismediaclub.org', '?tab=appearance'), '?tab=appearance&workspace=sac');
  assert.equal(logic.workspaceSearchForSelection('media', 'fismediaclub.org', '?tab=appearance&workspace=sac'), '?tab=appearance');
  assert.equal(logic.workspaceSearchForSelection('sac', 'sac.fismediaclub.org', '?workspace=media'), '');

  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: 'Grade 9', role: 'Member' }), true);
  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: 'Grade 12', role: 'Member' }), true);
  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: 'Grade 8', role: 'Member' }), false);
  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: 'Grade 8', role: 'Member', teamKeys: ['sac'] }), true, 'an explicitly approved grade override retains SAC access');
  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: 'Adult', role: 'Member' }), true);
  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: '', role: 'Faculty' }), true);
  assert.equal(logic.memberCanAccessSacWorkspace(null, true), true, 'Auth Admin retains emergency workspace access');
  assert.equal(logic.memberCanAccessSacWorkspace({ gradeLevel: 'Grade 11', role: 'Member' }, false, true), false, 'visitor sessions never gain SAC access');
  assert.equal(logic.resolveWorkspaceSelection('sac', false), 'media');
  assert.equal(logic.resolveWorkspaceSelection('sac', true), 'sac');
  assert.equal(logic.workspacePageFor('events', 'sac'), 'sac-home');
  assert.equal(logic.workspacePageFor('sac-events', 'sac'), 'sac-events');
  assert.equal(logic.workspacePageFor('sac-signups', 'sac'), 'sac-signups');
  assert.equal(logic.workspacePageFor('sac-my-shifts', 'sac'), 'sac-my-shifts');
  assert.equal(logic.workspacePageFor('sac-members', 'sac'), 'sac-members');
  assert.equal(logic.workspacePageFor('sac-events', 'media'), 'home');
  assert.equal(logic.workspacePageFor('sac-signups', 'media'), 'home');
  assert.equal(logic.workspacePageFor('sac-my-shifts', 'media'), 'home');
  assert.equal(logic.workspacePageFor('sac-members', 'media'), 'home');
  assert.equal(logic.workspacePageFor('profile', 'sac'), 'profile');
  assert.equal(logic.workspacePageFor('sac-home', 'media'), 'home');

  assert.match(indexHtml, /id="workspace-switcher-button"[\s\S]*?aria-controls="workspace-menu"/);
  assert.match(indexHtml, /data-workspace-choice="media"[\s\S]*?data-workspace-choice="sac"/);
  assert.match(indexHtml, /workspace-media-symbol[^>]+assets\/media-club-logo\.png/);
  assert.match(indexHtml, /workspace-sac-symbol[^>]+assets\/sac-warriors-mark\.png/);
  assert.match(indexHtml, /workspace-menu-icon media[\s\S]*?assets\/media-club-logo\.png/);
  assert.match(indexHtml, /workspace-menu-icon sac[\s\S]*?assets\/sac-warriors-mark\.png/);
  assert.match(indexHtml, /sac-home-mark[\s\S]*?assets\/sac-warriors-mark\.png/);
  assert.ok(sacWarriorsMark.length > 20_000 && sacWarriorsMark.length < 100_000, 'cropped SAC mark should stay compact');
  assert.equal(sacWarriorsMark.subarray(1, 4).toString(), 'PNG');
  assert.match(appStyles, /\.workspace-menu\.open[\s\S]*?opacity: 1[\s\S]*?visibility: visible/);
  assert.match(appStyles, /\.workspace-menu \{[\s\S]*?left: 12px;[\s\S]*?right: 12px;[\s\S]*?width: auto/);
  assert.match(workspaceSource, /workspaceSearchForSelection\(workspace, hostname, search/);
  assert.match(workspaceSource, /history\.pushState\(\{ page, workspace: activeCrewCenterWorkspace \}, '', workspaceUrlForPage\(page\)\)/);
  assert.match(indexHtml, /id="page-sac-home"/);
  assert.match(coreSource, /await loadCrewCenterData\(\{ datasets: \['members'\] \}\);\s*window\.initializeCrewCenterWorkspace\?\.\(\)/);
  assert.doesNotMatch(extractWorkspaceFunction('workspaceUrlForPage'), /https:\/\/fismediaclub\.org/, 'ordinary page routing must remain same-origin');
});

test('a SAC deep link is preserved until authentication can resolve workspace access', () => {
  const start = routerSource.indexOf('function openPageFromUrl()');
  const end = routerSource.indexOf("\nwindow.addEventListener('popstate'", start);
  assert.ok(start > -1 && end > start);
  for (const [pathname, search, page] of [
    ['/sac/events', '', 'sac-events'],
    ['/sac/signups', '?event=game-1', 'sac-signups'],
    ['/sac/my-shifts', '', 'sac-my-shifts'],
    ['/sac/members', '', 'sac-members'],
  ]) {
    const route = { pathname, search };
    const replacements = [];
    const navigations = [];
    let authorizedWorkspace = 'sac';
    const context = {
      window: {
        location: route,
        syncCrewCenterWorkspaceFromLocation: () => authorizedWorkspace,
        CREW_CENTER_AUTH_USER: null,
        CREW_CENTER_IS_VISITOR: false,
        CREW_CENTER_IS_ADMIN: false,
      },
      history: { replaceState: (_state, _title, url) => {
        replacements.push(url);
        const destination = new URL(url, 'https://sac.fismediaclub.org');
        route.pathname = destination.pathname;
        route.search = destination.search;
      } },
      pageFromPath: () => route.pathname === pathname ? page : 'home',
      workspacePageFor: requestedPage => context.window.CREW_CENTER_AUTH_USER && authorizedWorkspace === 'sac' ? requestedPage : 'home',
      workspaceUrlForPage: requestedPage => requestedPage === page ? `${pathname}${search}` : '/dashboard?workspace=media',
      workspaceSearchForSelection: (_workspace, _hostname, requestedSearch) => requestedSearch,
      currentCrewCenterWorkspace: () => 'media',
      navItemForPage: () => null,
      navigate: requestedPage => navigations.push(requestedPage),
    };
    vm.runInNewContext(`${routerSource.slice(start, end)}\nglobalThis.openRoute = openPageFromUrl;`, context);

    context.openRoute();
    assert.equal(`${route.pathname}${route.search}`, `${pathname}${search}`, 'startup must preserve the deep link before checking the member');
    assert.deepEqual(replacements, []);
    assert.deepEqual(navigations, []);

    context.window.CREW_CENTER_AUTH_USER = { id: 'approved-member' };
    context.openRoute();
    assert.equal(`${route.pathname}${route.search}`, `${pathname}${search}`, 'an eligible member keeps the SAC deep link');
    assert.deepEqual(replacements, []);
    assert.deepEqual(navigations, [page]);

    authorizedWorkspace = 'media';
    context.openRoute();
    assert.equal(route.pathname, '/dashboard', 'an ineligible member still falls back to Media Club');
    assert.deepEqual(replacements, ['/dashboard?workspace=media']);
  }
});

test('workspace choices navigate to the correct production host in both directions', () => {
  const functionNames = [
    'normalizeWorkspaceHostname', 'workspaceFromHostname', 'workspaceSearchForSelection',
    'workspaceUrlForPage', 'workspaceSwitchUrl', 'selectCrewCenterWorkspace',
  ];
  const source = functionNames.map(extractWorkspaceFunction).join('\n');
  const assigned = [];
  const localSelections = [];
  let sacAccess = true;
  let currentRoute = '/dashboard?workspace=sac';
  const context = {
    URL, URLSearchParams,
    window: { location: {} },
    canAccessSacWorkspace: () => sacAccess,
    canAccessMediaWorkspace: () => true,
    closeWorkspaceMenu: () => {},
    setCrewCenterWorkspace: workspace => localSelections.push(workspace),
    pageUrl: () => currentRoute,
  };
  vm.runInNewContext(`${source}\nglobalThis.choose = selectCrewCenterWorkspace; globalThis.switchUrl = workspaceSwitchUrl;`, context);
  const visit = url => {
    context.window.location = Object.assign(new URL(url), { assign: destination => assigned.push(destination) });
    assigned.length = 0;
    localSelections.length = 0;
  };

  visit('https://fismediaclub.org/dashboard?workspace=sac#old-fragment');
  context.choose('sac');
  assert.deepEqual(assigned, ['https://sac.fismediaclub.org/dashboard']);
  assert.deepEqual(localSelections, [], 'do not render a different workspace before leaving the current origin');

  visit('https://sac.fismediaclub.org/dashboard?workspace=media');
  currentRoute = '/dashboard?workspace=media';
  context.choose('media');
  assert.deepEqual(assigned, ['https://fismediaclub.org/dashboard']);
  assert.deepEqual(localSelections, []);

  for (const [host, workspace] of [['fismediaclub.org', 'media'], ['sac.fismediaclub.org', 'sac']]) {
    visit(`https://${host}/dashboard`);
    context.choose(workspace);
    assert.deepEqual(assigned, [], 'reselecting the current workspace should not reload');
    assert.deepEqual(localSelections, [workspace]);
  }

  for (const origin of ['http://localhost:4173', 'http://127.0.0.1:4173', 'https://preview.media-club-page.pages.dev', 'https://sac.fismediaclub.org.example.com']) {
    visit(`${origin}/dashboard`);
    assert.equal(context.switchUrl('sac'), '/dashboard?workspace=sac');
    context.choose('sac');
    assert.deepEqual(assigned, [], 'preview and unrelated hostnames must never jump to production');
    assert.deepEqual(localSelections, ['sac']);
  }

  visit('https://fismediaclub.org/dashboard');
  sacAccess = false;
  context.choose('sac');
  assert.deepEqual(assigned, [], 'SAC eligibility must be checked before leaving the current host');
  assert.deepEqual(localSelections, ['sac'], 'the existing denied-workspace handler displays the eligibility error');

  visit('https://sac.fismediaclub.org/dashboard');
  context.choose('media');
  assert.deepEqual(assigned, ['https://fismediaclub.org/dashboard'], 'returning to Media Club never requires SAC access');
});

test('navigation tabs use native deep links and restore state from the URL', () => {
  const roleTabs = [...indexHtml.matchAll(/<(a|button)\b[^>]*role="tab"[^>]*>/g)].map(match => match[0]);
  assert.equal(roleTabs.length, 20);
  roleTabs.forEach(tab => {
    assert.match(tab, /^<a\b/);
    assert.match(tab, /href="\/(?:meetings|gallery|profile|admin)(?:\?[^\"]+)?"/);
    assert.match(tab, /aria-selected="(?:true|false)"/);
    assert.match(tab, /aria-controls="[^"]+"/);
    assert.doesNotMatch(tab, /onclick=/);
  });
  assert.doesNotMatch(indexHtml, /<button\b[^>]*role="tab"/);

  const sidebarLinks = [...indexHtml.matchAll(/<a\b[^>]*class="nav-item[^>]*data-page="[^"]+"[^>]*>/g)].map(match => match[0]);
  assert.equal(sidebarLinks.length, 18);
  sidebarLinks.forEach(link => {
    assert.match(link, /href="\/[^"]+"/);
    assert.doesNotMatch(link, /onclick=/);
  });

  assert.match(appSource, /tabValueFromUrl\(Object\.keys\(galleryTabFilters\), 'all'\)/);
  assert.match(appSource, /tabValueFromUrl\(\['upcoming', 'past'\], 'upcoming'\)/);
  assert.match(appSource, /tabValueFromUrl\(\['profile', 'appearance', 'personalisation', 'dashboard', 'sidebar', 'notifications', 'tutorials'\], 'profile'\)/);
  assert.match(appSource, /showAdminTab\(tabValueFromUrl\(\['pending', 'manage-events', 'cas-attendance', 'announcements'\], 'pending'\)\)/);
  assert.match(appSource, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
  assert.match(appSource, /tabs\[nextIndex\]\.focus\(\)/);
  assert.doesNotMatch(appSource, /tabs\[nextIndex\]\.click\(\)/);
  assert.match(appSource, /new URLSearchParams\(window\.location\.search\)\.get\('event'\)/);
  const nativeNavigationStart = appSource.indexOf('function installNativeLinkNavigation()');
  const nativeNavigationEnd = appSource.indexOf('installNativeLinkNavigation();', nativeNavigationStart);
  const nativeNavigation = appSource.slice(nativeNavigationStart, nativeNavigationEnd);
  assert.match(nativeNavigation, /destination\.origin !== window\.location\.origin/);
  assert.match(nativeNavigation, /event\.button !== 0 \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/);
  assert.match(nativeNavigation, /event\.preventDefault\(\)/);
  assert.match(nativeNavigation, /const destinationUrl = page === destinationPage/);
  assert.match(nativeNavigation, /history\.pushState\(\{ page \}, '', destinationUrl\)/);
  assert.match(indexHtml, /<html lang="en" class="sidebar-pending" data-workspace="media">/);
  assert.match(appStyles, /html\.sidebar-pending \.sidebar-nav,[\s\S]*?visibility: hidden/);
  assert.match(appSource, /document\.documentElement\.classList\.remove\('sidebar-pending'\)/);
  assert.match(appSource, /renderDatasetErrors\(\);\s*closeAllPages\(\);\s*closeMobileSidebar\(\);/);
  assert.match(appSource, /!state\.dataLoaded\.members \|\| Boolean\(currentMemberRecord\(\)\)/);
  for (const tabId of ['settings-tab-personalisation', 'dashboard-settings-tab', 'settings-tab-sidebar', 'settings-tab-notifications', 'tutorial-settings-tab']) {
    assert.match(appSource, new RegExp(`'${tabId}'`));
  }
});

test('legacy visitor sessions remain contained while new anonymous sign-in is retired', () => {
  const match = authSource.match(/const visitorAllowedPages = new Set\((\[[^;]+\])\)/);
  assert.ok(match, 'visitor route allowlist must remain explicit');
  const routes = vm.runInNewContext(match[1]);
  assert.deepEqual([...routes], ['about', 'home', 'events', 'gallery', 'equipment', 'role-guide', 'join']);
  for (const privatePage of ['meetings', 'signup', 'members', 'equipment-status', 'crew-deployment', 'profile', 'admin']) {
    assert.equal(routes.includes(privatePage), false, `${privatePage} must remain private`);
  }
  assert.doesNotMatch(authSource, /signInAnonymously|auth-visitor-submit/);
  assert.match(authSource, /href="https:\/\/info\.fismediaclub\.org\/"/);
  assert.match(authSource, /const allowedPages = new Set\(\["about", "home", "events", "gallery", "equipment", "role-guide", "join"\]\)/);
  assert.match(authSource, /\.nav-item\[data-page="signup"\]/);
  assert.match(authSource, /\.nav-item\[data-page="members"\]/);
  assert.match(authSource, /\.nav-item\[data-page="meetings"\]/);
  assert.doesNotMatch(authSource, /\.nav-item\[onclick\*="(?:signup|members)"\]/);
});

test('restricted operational pages are revealed only through their Auth Admin capability checks', () => {
  assert.match(authSource, /const hasEquipmentStatusAccess = Boolean\(window\.canAccessCrewCenterEquipmentStatus\?\.\(\)\)/);
  assert.match(authSource, /const hasCrewScheduleAccess = Boolean\(window\.CREW_CENTER_IS_ADMIN \|\| window\.canAccessCrewSchedule\?\.\(\)\)/);
  assert.doesNotMatch(authSource, /hasCrewScheduleAccess = Boolean\(hasAdminPanelAccess/);
  assert.match(authSource, /id === "equipment-status" && !Boolean\(window\.canAccessCrewCenterEquipmentStatus\?\.\(\)\)/);
  assert.match(authSource, /id === "crew-deployment" && !Boolean\(window\.CREW_CENTER_IS_ADMIN \|\| window\.canAccessCrewSchedule\?\.\(\)\)/);
  assert.doesNotMatch(authSource, /toggleEquipmentAvailability/);
});

test('visitor portals default to a compact desktop sidebar without changing member preferences', () => {
  assert.match(appSource, /Boolean\(window\.CREW_CENTER_IS_VISITOR\) \|\| localStorage\.getItem\('crew-center-sidebar-compact'\) === 'true'/);
  assert.match(appSource, /setSidebarCollapsed\(!document\.body\.classList\.contains\('sidebar-collapsed'\), \{ persist: !window\.CREW_CENTER_IS_VISITOR \}\)/);
  assert.match(appSource, /Boolean\(collapsed\) && window\.innerWidth > 900/);
  assert.match(authSource, /applySignedInUser\(user\);[\s\S]*?window\.syncSidebarCollapsePreference\?\.\(\);/);
  assert.match(authSource, /previousUserId !== user\.id[\s\S]*?CREW_CENTER_AUTH_EPOCH \+= 1/);
});
