import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const required = ['index.html', 'ai.js', 'api/coach.js', 'vercel.json', 'README.md'];
for (const file of required) {
  if (!existsSync(file)) throw new Error('Missing required file: ' + file);
}
const html = readFileSync('index.html', 'utf8');
for (const id of ['overview','profile','skills','roadmap','interview','applications','saveprofile','analyzejd','evaluate','addapp']) {
  if (!html.includes('id="' + id + '"')) throw new Error('Missing UI element: ' + id);
}
for (const file of ['ai.js','api/coach.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(file + ': ' + result.stderr);
}
console.log('CareerOS verification passed: required files, primary views, and JavaScript syntax.');
