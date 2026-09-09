import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDirectory = 'dist';
const files = [
  'index.html',
  'crew-center.css',
  'tutorial.css',
  'supabase-config.js',
  'tutorial.js',
  '_headers',
  '_redirects',
];
const directories = ['assets', 'scripts'];

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
files.forEach(file => cpSync(file, join(outputDirectory, file)));
directories.forEach(directory => cpSync(directory, join(outputDirectory, directory), { recursive: true }));

let html = readFileSync(join(outputDirectory, 'index.html'), 'utf8');
const localAssets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map(match => match[1].split(/[?#]/, 1)[0])
  .filter(path => path && !path.startsWith('/') && !/^(?:https?:|mailto:|data:)/.test(path));

for (const asset of localAssets) {
  const outputPath = join(outputDirectory, asset);
  if (!existsSync(outputPath)) {
    throw new Error(`Production build is missing ${asset} referenced by index.html.`);
  }
}

const versionedAssets = new Map();
for (const asset of new Set(localAssets.filter(path => /\.(?:css|js)$/.test(path)))) {
  const digest = createHash('sha256')
    .update(readFileSync(join(outputDirectory, asset)))
    .digest('hex')
    .slice(0, 12);
  versionedAssets.set(asset, digest);
}

html = html.replace(/((?:href|src)=")([^"]+)(")/g, (match, prefix, reference, suffix) => {
  const asset = reference.split(/[?#]/, 1)[0];
  const digest = versionedAssets.get(asset);
  if (!digest) return match;
  const separator = reference.includes('?') ? '&' : '?';
  return `${prefix}${reference}${separator}v=${digest}${suffix}`;
});
writeFileSync(join(outputDirectory, 'index.html'), html);

console.log(`Built static Crew Center into ${outputDirectory}/, verified ${new Set(localAssets).size} referenced assets, and versioned ${versionedAssets.size} scripts and stylesheets.`);
