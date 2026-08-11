import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceFiles = [
  'supabase-config.js',
  'tutorial.js',
  ...readdirSync('scripts').filter(file => file.endsWith('.js')).map(file => join('scripts', file)),
  ...readdirSync('tools').filter(file => file.endsWith('.mjs')).map(file => join('tools', file)),
];

for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Checked ${sourceFiles.length} JavaScript files.`);
