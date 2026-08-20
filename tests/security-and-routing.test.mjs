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
const headersFile = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
const redirectsFile = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');
const fontsCss = readFileSync(new URL('../assets/fonts/fonts.css', import.meta.url), 'utf8');
const fisLogo = readFileSync(new URL('../assets/fis-logo.png', import.meta.url));
const mediaClubLogo = readFileSync(new URL('../assets/media-club-logo.png', import.meta.url));
const aboutImageNames = [
  'tech-show-crew.webp',
  'stroth-control-room.webp',
  'camera-operator.webp',
  'tech-show-anchors.webp',
  'tech-show-team.webp',
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
    'scripts/router.js',
    'scripts/ui.js',
    'scripts/dashboard.js',
    'scripts/events.js',
    'scripts/signups.js',
    'scripts/crew-schedule.js',
    'scripts/members.js',
    'scripts/gallery.js',
    'scripts/equipment.js',
    'scripts/admin.js',
    'scripts/init.js',
  ]);
  assert.match(indexHtml, /<script src="supabase-config\.js"><\/script>\s*<script src="scripts\/core\.js"><\/script>/);
  assert.match(indexHtml, /<script src="scripts\/init\.js"><\/script>\s*<script src="tutorial\.js"><\/script>/);
  assert.match(redirectsFile, /^\/\*\s+\/index\.html\s+200\s*$/m);
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
  assert.match(authSource, /:root\[data-theme="dark"\] \.auth-visitor-button\s*\{/);
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

  for (const pageId of ['events', 'signup', 'members', 'gallery', 'equipment']) {
    const start = indexHtml.indexOf(`<div id="page-${pageId}" class="page">`);
    const end = indexHtml.indexOf('<!-- ──', start + 1);
    assert.ok(start > -1 && end > start, `Expected ${pageId} page markup`);
    assert.match(indexHtml.slice(start, end), /<section class="page-hero">/);
  }
});

test('About Media Club is a local, privacy-conscious brochure page', () => {
  const start = indexHtml.indexOf('<div id="page-about" class="page">');
  const end = indexHtml.indexOf('<!-- ── DASHBOARD ── -->', start);
  assert.ok(start > -1 && end > start, 'Expected the About Media Club page markup');
  const aboutMarkup = indexHtml.slice(start, end);
  assert.match(aboutMarkup, /Discover Media Club/);
  assert.match(aboutMarkup, /Grades 6–12/);
  assert.match(aboutMarkup, /id="about-recent-projects"/);
  assert.match(aboutMarkup, /href="\/gallery"/);
  assert.match(aboutMarkup, /href="\/join"/);
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
});

test('gallery projects support an optional production date and link guidance', () => {
  assert.match(indexHtml, /id="gal-produced-on" type="date"/);
  assert.match(indexHtml, /Access for FIS members only/);
  assert.match(appSource, /produced_on: producedOn/);
  assert.match(appSource, /producedOn: item\.produced_on \|\| ''/);
  assert.match(appSource, /Produced \$\{escapeHtml\(producedLabel\)\}/);
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

  assert.match(redirectsFile, /^\/\*\s+\/index\.html\s+200\s*$/m);
  assert.match(headersFile, /\/signup\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/signups\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/signin\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(authSource, /window\.location\.pathname !== "\/signin"[\s\S]*?history\.replaceState\(\{ page: "signin" \}, "", "\/signin"\)/);
  assert.match(authSource, /window\.location\.pathname === "\/signin"[\s\S]*?defaultRoute[\s\S]*?history\.replaceState/);
});

test('navigation tabs use native deep links and restore state from the URL', () => {
  const roleTabs = [...indexHtml.matchAll(/<(a|button)\b[^>]*role="tab"[^>]*>/g)].map(match => match[0]);
  assert.equal(roleTabs.length, 14);
  roleTabs.forEach(tab => {
    assert.match(tab, /^<a\b/);
    assert.match(tab, /href="\/(?:gallery|profile|admin)\?tab=[a-z-]+"/);
    assert.match(tab, /aria-selected="(?:true|false)"/);
    assert.match(tab, /aria-controls="[^"]+"/);
    assert.doesNotMatch(tab, /onclick=/);
  });
  assert.doesNotMatch(indexHtml, /<button\b[^>]*role="tab"/);

  const sidebarLinks = [...indexHtml.matchAll(/<a\b[^>]*class="nav-item[^>]*data-page="[^"]+"[^>]*>/g)].map(match => match[0]);
  assert.equal(sidebarLinks.length, 12);
  sidebarLinks.forEach(link => {
    assert.match(link, /href="\/[^"]+"/);
    assert.doesNotMatch(link, /onclick=/);
  });

  assert.match(appSource, /tabValueFromUrl\(Object\.keys\(galleryTabFilters\), 'all'\)/);
  assert.match(appSource, /tabValueFromUrl\(\['profile', 'appearance', 'dashboard', 'sidebar', 'notifications', 'tutorials'\], 'profile'\)/);
  assert.match(appSource, /showAdminTab\(tabValueFromUrl\(\['pending', 'manage-events', 'announcements'\], 'pending'\)\)/);
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
  assert.match(nativeNavigation, /history\.pushState\(\{ page \}, '', `\$\{destination\.pathname\}\$\{destination\.search\}\$\{destination\.hash\}`\)/);
  assert.match(indexHtml, /<html lang="en" class="sidebar-pending">/);
  assert.match(appStyles, /html\.sidebar-pending \.sidebar-nav,[\s\S]*?visibility: hidden/);
  assert.match(appSource, /document\.documentElement\.classList\.remove\('sidebar-pending'\)/);
  assert.match(appSource, /renderDatasetErrors\(\);\s*closeAllPages\(\);\s*closeMobileSidebar\(\);/);
  assert.match(appSource, /!state\.dataLoaded\.members \|\| Boolean\(currentMemberRecord\(\)\)/);
  for (const tabId of ['dashboard-settings-tab', 'settings-tab-sidebar', 'settings-tab-notifications', 'tutorial-settings-tab']) {
    assert.match(appSource, new RegExp(`'${tabId}'`));
  }
});

test('visitor route allowlist exposes only public pages', () => {
  const match = authSource.match(/const visitorAllowedPages = new Set\((\[[^;]+\])\)/);
  assert.ok(match, 'visitor route allowlist must remain explicit');
  const routes = vm.runInNewContext(match[1]);
  assert.deepEqual([...routes], ['about', 'home', 'events', 'gallery', 'equipment', 'role-guide', 'join']);
  for (const privatePage of ['signup', 'members', 'equipment-status', 'crew-deployment', 'profile', 'admin']) {
    assert.equal(routes.includes(privatePage), false, `${privatePage} must remain private`);
  }
  assert.match(authSource, /await revealDashboard\(data\.user\);\s*if \(window\.CREW_CENTER_IS_VISITOR[\s\S]*?window\.navigate\("about"/);
  assert.match(authSource, /const allowedPages = new Set\(\["about", "home", "events", "gallery", "equipment", "role-guide", "join"\]\)/);
  assert.match(authSource, /\.nav-item\[data-page="signup"\]/);
  assert.match(authSource, /\.nav-item\[data-page="members"\]/);
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
  assert.match(authSource, /applySignedInUser\(user\);\s*window\.syncSidebarCollapsePreference\?\.\(\);/);
});
