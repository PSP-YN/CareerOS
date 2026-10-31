import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = [
  'index.html','app.html','styles.css','logo.svg','favicon.svg','auth.js','ai.js','ads.js','billing.js',
  'api/config.js','api/coach.js','api/create-subscription.js','api/verify-subscription.js',
  'api/razorpay-webhook.js','supabase/schema.sql','sitemap.xml','llms.txt','robots.txt','README.md','vercel.json'
];
for (const file of required) if (!existsSync(file)) throw new Error('Missing required file: ' + file);

const app = readFileSync('app.html','utf8');
const ids = [...app.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id,i) => ids.indexOf(id) !== i);
if (duplicates.length) throw new Error('Duplicate app HTML IDs: ' + [...new Set(duplicates)].join(', '));
for (const id of ['overview','profile','skills','roadmap','interview','applications','saveprofile','analyzejd','evaluate','addapp','signinGoogle','signout']) {
  if (!ids.includes(id)) throw new Error('Missing app control: ' + id);
}

const landing = readFileSync('index.html','utf8');
for (const marker of ['rel="canonical"','application/ld+json','FAQPage','/pricing','/career-pivot-guide','/ads.js']) {
  if (!landing.includes(marker)) throw new Error('Missing SEO or navigation marker: ' + marker);
}
const sitemap = readFileSync('sitemap.xml','utf8');
if (!sitemap.includes('careeros-intelligence.vercel.app')) throw new Error('Sitemap is missing canonical domain.');

const temp = mkdtempSync(join(tmpdir(),'careeros-check-'));
try {
  const inline = [...app.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\bsrc\s*=/.test(m[1]) && !/application\/ld\+json/i.test(m[1]) && m[2].trim());
  if (!inline.length) throw new Error('No inline app script found.');
  inline.forEach((m,i) => {
    const file = join(temp,'inline-'+i+'.js');
    writeFileSync(file,m[2]);
    const check = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if (check.status !== 0) throw new Error('Inline app script syntax: '+check.stderr);
  });
} finally { rmSync(temp,{recursive:true,force:true}); }

const jsFiles = [
  'auth.js','ai.js','ads.js','billing.js','api/config.js','api/coach.js',
  'api/create-subscription.js','api/verify-subscription.js','api/razorpay-webhook.js'
];
for (const file of jsFiles) {
  const check = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if (check.status !== 0) throw new Error(file + ': ' + check.stderr);
}
const schema = readFileSync('supabase/schema.sql','utf8');
for (const marker of ['enable row level security','consume_careeros_ai_quota','service_role','subscriptions']) {
  if (!schema.includes(marker)) throw new Error('Missing database security control: '+marker);
}
const coach = readFileSync('api/coach.js','utf8');
if (!coach.includes('GEMINI_API_KEY') || !coach.includes('SUPABASE_SERVICE_ROLE_KEY') || !coach.includes('MAX_CONTEXT_CHARS')) {
  throw new Error('AI API guardrails are incomplete.');
}
console.log('CareerOS checks passed: app controls, SEO, inline/external JS syntax, Supabase RLS, AI quota and payment endpoints.');
