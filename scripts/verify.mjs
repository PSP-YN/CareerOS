import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = ['index.html', 'ai.js', 'api/coach.js', 'vercel.json', 'README.md'];
for (const file of required) {
  if (!existsSync(file)) throw new Error('Missing required file: ' + file);
}

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error('Duplicate HTML IDs: ' + [...new Set(duplicates)].join(', '));

for (const id of ['overview','profile','skills','roadmap','interview','applications','saveprofile','analyzejd','evaluate','addapp']) {
  if (!ids.includes(id)) throw new Error('Missing required UI element: ' + id);
}

const temp = mkdtempSync(join(tmpdir(), 'careeros-check-'));
try {
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
  if (!inlineScripts.length) throw new Error('No inline application script found.');
  inlineScripts.forEach((match, index) => {
    const file = join(temp, 'inline-' + index + '.js');
    writeFileSync(file, match[2]);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Inline script syntax error: ' + result.stderr);
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

for (const file of ['ai.js','api/coach.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(file + ': ' + result.stderr);
}

const api = readFileSync('api/coach.js', 'utf8');
if (!api.includes('GEMINI_API_KEY') || !api.includes('MAX_CONTEXT_CHARS') || !api.includes('AbortController')) {
  throw new Error('Expected server-side secret, payload cap, or timeout protection is missing.');
}
console.log('CareerOS verification passed: required files, unique HTML IDs, inline and external JavaScript syntax, and API guardrails.');
