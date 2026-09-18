import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const indexHtml = read('index.html');
const auth = read('supabase-config.js');
const privacy = read('privacy.html');
const impressum = read('impressum.html');
const legalStyles = read('legal.css');
const redirects = read('_redirects');
const build = read('tools/build-static.mjs');
const publicHtml = read('info/index.html');

test('sign-in, member settings, and public application surface expose legal links', () => {
  for (const source of [auth, indexHtml]) {
    assert.match(source, /href="\/privacy"/);
    assert.match(source, /href="\/impressum"/);
  }
  assert.match(publicHtml, /https:\/\/fismediaclub\.org\/privacy/);
  assert.match(publicHtml, /https:\/\/fismediaclub\.org\/impressum/);
  assert.match(indexHtml, /mailto:shenghan_lang@fis\.edu/);
});

test('privacy notice is dated, contactable, and accurately names the active processors', () => {
  assert.match(privacy, /Last updated: 18 September 2026/);
  assert.match(privacy, /mailto:shenghan_lang@fis\.edu/);
  assert.match(privacy, /Supabase[\s\S]*Cloudflare[\s\S]*Resend/);
  assert.match(privacy, /does not sell personal data/);
  assert.match(privacy, /use AI to make decisions/);
  assert.match(privacy, /There is not yet a fixed automatic deletion schedule/);
  assert.doesNotMatch(privacy, /GDPR compliant/i);
});

test('Impressum states what is known without pretending the missing postal detail is complete', () => {
  assert.match(impressum, /Shenghan Lang/);
  assert.match(impressum, /mailto:shenghan_lang@fis\.edu/);
  assert.match(impressum, /independently developed, non-commercial student project/i);
  assert.match(impressum, /valid postal contact/);
  assert.match(impressum, /should not be treated as the finished Impressum/);
});

test('legal pages are responsive static build assets with clean routes', () => {
  assert.match(legalStyles, /@media \(max-width: 680px\)/);
  assert.match(redirects, /^\/privacy\s+\/privacy\.html\s+200$/m);
  assert.match(redirects, /^\/impressum\s+\/impressum\.html\s+200$/m);
  for (const file of ['privacy.html', 'impressum.html', 'legal.css']) {
    assert.ok(build.includes(`'${file}'`), `${file} must be copied into the production build`);
  }
});
