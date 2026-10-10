import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const outputDirectory = 'dist-info';
const siteKey = String(process.env.INFO_TURNSTILE_SITE_KEY || '').trim();
const files = [
  ['info/index.html', 'index.html'],
  ['info/info.css', 'info.css'],
  ['info/info.js', 'info.js'],
  ['info/typing.js', 'typing.js'],
  ['info/_headers', '_headers'],
  ['info/_redirects', '_redirects'],
  ['assets/media-club-logo.png', 'assets/media-club-logo.png'],
  ['assets/fis-logo.png', 'assets/fis-logo.png'],
];
const directories = [
  ['assets/fonts', 'assets/fonts'],
  ['assets/about', 'assets/about'],
];

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

for (const [source, destination] of files) {
  const outputPath = join(outputDirectory, destination);
  mkdirSync(dirname(outputPath), { recursive: true });
  cpSync(source, outputPath);
}
for (const [source, destination] of directories) {
  cpSync(source, join(outputDirectory, destination), { recursive: true });
}

const configTemplate = readFileSync('info/config.js', 'utf8');
writeFileSync(
  join(outputDirectory, 'config.js'),
  configTemplate.replace('__TURNSTILE_SITE_KEY__', siteKey || '__TURNSTILE_SITE_KEY__'),
);

const html = readFileSync(join(outputDirectory, 'index.html'), 'utf8');
const localAssets = [...html.matchAll(/(?:href|src|srcset)="([^"]+)"/g)]
  .flatMap(match => match[1].split(',').map(entry => entry.trim().split(/\s+/, 1)[0]))
  .map(path => path.split(/[?#]/, 1)[0])
  .filter(path => path && !path.startsWith('#') && !/^(?:https?:|mailto:|data:)/.test(path));

for (const asset of localAssets) {
  const outputPath = join(outputDirectory, asset);
  if (!existsSync(outputPath)) throw new Error(`Public portal build is missing ${asset} referenced by index.html.`);
}

// Version local scripts/styles so a published update replaces cached presentation assets.
const versions = new Map([...new Set(localAssets.filter(asset => /\.(css|js)$/.test(asset)))].map(asset => [
  asset, createHash('sha256').update(readFileSync(join(outputDirectory, asset))).digest('hex').slice(0, 12),
]));
writeFileSync(join(outputDirectory, 'index.html'), html.replace(/((?:href|src)=")([^"]+)(")/g, (match, prefix, reference, suffix) => {
  const version = versions.get(reference.split(/[?#]/, 1)[0]);
  return version ? `${prefix}${reference}${reference.includes('?') ? '&' : '?'}v=${version}${suffix}` : match;
}));

const configurationStatus = siteKey ? 'with its configured Turnstile site key' : 'with a disabled application form until INFO_TURNSTILE_SITE_KEY is set';
console.log(`Built the isolated public portal into ${outputDirectory}/ ${configurationStatus}.`);
