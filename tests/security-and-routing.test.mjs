import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const headersFile = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
const redirectsFile = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8');
const fontsCss = readFileSync(new URL('../assets/fonts/fonts.css', import.meta.url), 'utf8');
const fisLogo = readFileSync(new URL('../assets/fis-logo.png', import.meta.url));
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
  assert.equal(bodies.length, 2);
  for (const body of bodies) {
    const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`;
    assert.ok(csp.includes(`'${hash}'`), `Missing CSP hash ${hash}`);
  }
  assert.match(csp, /script-src-attr 'unsafe-inline'/, 'legacy inline UI handlers must remain functional');
  const scriptElementPolicy = csp.split(';').map(part => part.trim()).find(part => part.startsWith('script-src '));
  assert.doesNotMatch(scriptElementPolicy, /'unsafe-inline'/, 'script elements must not allow arbitrary inline code');
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

test('primary content pages share the branded page hero', () => {
  assert.deepEqual([...fisLogo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(fisLogo.length < 150_000, 'decorative FIS logo should remain lightweight');
  assert.match(indexHtml, /\.page-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(indexHtml, /\.dashboard-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(indexHtml, /\.equipment-status-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(indexHtml, /\.deployment-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.match(indexHtml, /\.role-guide-hero::before[\s\S]*?assets\/fis-logo\.png/);
  assert.doesNotMatch(indexHtml, /\.(?:page|dashboard|equipment-status|role-guide)-hero::after\s*\{/);
  assert.doesNotMatch(indexHtml, /\.deployment-hero::after\s*\{/);
  assert.match(indexHtml, /:root\[data-theme="dark"\] \.page-hero::before/);

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
  assert.match(aboutMarkup, /navigate\('gallery'/);
  assert.match(aboutMarkup, /navigate\('join'/);
  assert.doesNotMatch(aboutMarkup, /<script|https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/i);

  for (const file of aboutImageNames) {
    const bytes = readFileSync(new URL(`../assets/about/${file}`, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${file} must be WebP`);
    assert.ok(bytes.length < 200_000, `${file} should remain lightweight`);
    assert.ok(aboutMarkup.includes(`assets/about/${file}`), `${file} must be used on the about page`);
  }

  assert.match(indexHtml, /class="nav-item" data-page="about" data-category="club"/);
  assert.match(indexHtml, /club: \{ label: 'Club', pages: \['crew-deployment', 'equipment-status', 'join', 'about', 'admin'\] \}/);
  assert.match(indexHtml, /items: customized && saved\.length \? saved : available/);
  assert.match(indexHtml, /classList\.toggle\('visible', hiddenCount > 0\)/);
  assert.match(schemaSql, /sidebar_items text\[\] not null default array\[[^\]]*'about'[^\]]*\]::text\[\]/);
  assert.match(indexHtml, /\.about-beginner:hover \.about-beginner-media img[\s\S]*?scale\(1\.04\)/);
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
  assert.match(indexHtml, /produced_on: producedOn/);
  assert.match(indexHtml, /producedOn: item\.produced_on \|\| ''/);
  assert.match(indexHtml, /Produced \$\{escapeHtml\(producedLabel\)\}/);
});

test('canonical routes and aliases survive static-host deep links', () => {
  const start = indexHtml.indexOf('const pageRoutes =');
  const end = indexHtml.indexOf('function navItemForPage', start);
  assert.ok(start > -1 && end > start);
  const context = { window: { location: { pathname: '/' } } };
  vm.runInNewContext(`${indexHtml.slice(start, end)}\nglobalThis.__routing = { pageRoutes, routePages, pageFromPath };`, context);

  for (const [page, route] of Object.entries(context.__routing.pageRoutes)) {
    context.window.location.pathname = route;
    assert.equal(context.__routing.pageFromPath(), page, `${route} should open ${page}`);
  }
  context.window.location.pathname = '/signup';
  assert.equal(context.__routing.pageFromPath(), 'signup');
  context.window.location.pathname = '/not-a-route';
  assert.equal(context.__routing.pageFromPath(), 'home');

  assert.match(redirectsFile, /^\/\*\s+\/index\.html\s+200\s*$/m);
  assert.match(headersFile, /\/signup\n\s+Cache-Control: no-store, max-age=0/);
  assert.match(headersFile, /\/signups\n\s+Cache-Control: no-store, max-age=0/);
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
});
