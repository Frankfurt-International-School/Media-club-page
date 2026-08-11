import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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

const html = readFileSync(join(outputDirectory, 'index.html'), 'utf8');
const localAssets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map(match => match[1].split(/[?#]/, 1)[0])
  .filter(path => path && !path.startsWith('/') && !/^(?:https?:|mailto:|data:)/.test(path));

for (const asset of localAssets) {
  const outputPath = join(outputDirectory, asset);
  if (!existsSync(outputPath)) {
    throw new Error(`Production build is missing ${asset} referenced by index.html.`);
  }
}

console.log(`Built static Crew Center into ${outputDirectory}/ and verified ${new Set(localAssets).size} referenced assets.`);
