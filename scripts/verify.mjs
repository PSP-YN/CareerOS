import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = [
  'index.html','app.html','admin.html','admin.js','question-bank.js','styles.css','logo.svg','favicon.svg','auth.js','ai.js','ads.js','billing.js',
  'api/config.js','api/coach.js','api/questions.js','api/admin-questions.js','api/create-subscription.js','api/verify-subscription.js',
  'api/razorpay-webhook.js','api/delete-account.js','api/cancel-subscription.js','supabase/schema.sql','sitemap.xml','llms.txt','robots.txt','README.md','vercel.json'
];
for (const file of required) if (!existsSync(file)) throw new Error('Missing required file: ' + file);

const app = readFileSync('app.html','utf8');
if (!app.includes("function fresh(){return{profile:{role:'',experience:'',timeline:''") || !app.includes("skills:[],done:[]")) {
  throw new Error('New workspaces must start without a fabricated role, skill ratings, or completed milestones.');
}
if (app.includes("done:[true,true") || app.includes("D.map(x=>({name:x[0],level:x[1]")) {
  throw new Error('Seeded skill levels or completed roadmap milestones remain in the app initializer.');
}
if (!app.includes('Number(x.level)>0&&x.level<x.required') || !app.includes('if(!S.skills.length||S.skills.some(x=>Number(x.level)===0))return null')) {
  throw new Error('Unassessed skills must not be counted as actual skill gaps or an overall readiness score.');
}
if (app.includes('Data is saved in this browser only. No account or cloud sync is implemented.')) {
  throw new Error('Outdated cloud-sync notice remains in the app.');
}
if (!app.includes('RESUME_FIELDS.forEach(id=>$(id).addEventListener(\'input\'' ) || !app.includes("addEventListener('change',e=>{if(e.target.dataset.skill!==undefined)render()})")) {
  throw new Error('Resume preview or skill slider interaction is not wired for live updates.');
}
const ids = [...app.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id,i) => ids.indexOf(id) !== i);
if (duplicates.length) throw new Error('Duplicate app HTML IDs: ' + [...new Set(duplicates)].join(', '));
for (const id of ['overview','profile','resume','skills','roadmap','interview','applications','saveprofile','analyzejd','evaluate','addapp','signinGoogle','signout','roleTemplate','applyRoleTemplate','qtype','jobUrl','appliedAt','followUp','appSummary','careerAiConsent','careerReview','careerReviewFeedback','roadmapAiConsent','roadmapReview','roadmapReviewFeedback','resumeName','resumeEmail','resumeHeadline','resumeSummary','resumeEducation','resumeExperience','resumeProjects','resumeCertifications','resumeLinks','resumePreview','resumeMatch','saveResume','downloadResume','printResume']) {
  if (!ids.includes(id)) throw new Error('Missing app control: ' + id);
}

if (!app.includes("$('roadpct').textContent=P.length?Math.round(n/P.length*100)+'%':'—'")) {
  throw new Error('An empty roadmap must not display NaN progress.');
}
if (!app.includes('data-remove-skill') || !app.includes('Skill removed from your assessment.')) {
  throw new Error('Skill assessment is missing the remove-skill action.');
}
const interview = ['aptitude','coding','technical','system_design','case_study','behavioral','hr'];
for (const round of interview) if (!app.includes(round + ':') && !app.includes('value="' + round + '"')) {
  throw new Error('Missing interview round: ' + round);
}
for (const role of ['ai_ml','full_stack','backend','frontend','data_analyst','cybersecurity','product']) {
  if (!app.includes('"' + role + '":') && !app.includes('value="' + role + '"')) throw new Error('Missing career path template: ' + role);
}
for (const marker of ['data-status','followUp','cancel_at_cycle_end','resume-document']) {
  const source = marker === 'cancel_at_cycle_end' ? readFileSync('supabase/schema.sql','utf8') : marker === 'resume-document' ? readFileSync('styles.css','utf8') : app;
  if (!source.includes(marker)) throw new Error('Missing application or subscription feature: ' + marker);
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
  'auth.js','ai.js','ads.js','billing.js','admin.js','question-bank.js','api/config.js','api/coach.js','api/questions.js','api/admin-questions.js',
  'api/create-subscription.js','api/verify-subscription.js','api/razorpay-webhook.js','api/delete-account.js','api/cancel-subscription.js'
];
for (const file of jsFiles) {
  const check = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if (check.status !== 0) throw new Error(file + ': ' + check.stderr);
}
const questionBank = readFileSync('question-bank.js','utf8');
for (const round of ['aptitude','coding','technical']) if ((questionBank.match(new RegExp(round + ': \\[','g')) || []).length !== 1) throw new Error('Missing expanded question bank: '+round);
for (const marker of ['interview_questions','app_metadata?.role !== \'admin\'','x-goog-api-key']) {
  const source = marker === 'interview_questions' ? readFileSync('supabase/schema.sql','utf8') : marker === 'x-goog-api-key' ? readFileSync('api/coach.js','utf8') : readFileSync('api/admin-questions.js','utf8');
  if (!source.includes(marker)) throw new Error('Missing admin/security control: '+marker);
}
const schema = readFileSync('supabase/schema.sql','utf8');
for (const marker of ['enable row level security','No direct user access to AI usage counters','consume_careeros_ai_quota','upsert_careeros_subscription','provider_event_created_at','service_role','subscriptions']) {
  if (!schema.includes(marker)) throw new Error('Missing database security control: '+marker);
}
const authSource = readFileSync('auth.js','utf8');
if (!authSource.includes('const roleChanged =') || !authSource.includes('skills: roleChanged ? localSkills') || !authSource.includes('done: roleChanged ? localDone') || !authSource.includes('cloudIsPristineSeed') || !authSource.includes('legacySeededProgress')) {
  throw new Error('Role changes must reset role-specific skill and roadmap progress during cloud merge.');
}
const coach = readFileSync('api/coach.js','utf8');
if (!coach.includes('GEMINI_API_KEY') || !coach.includes('SUPABASE_SERVICE_ROLE_KEY') || !coach.includes('MAX_CONTEXT_CHARS') || !coach.includes('career_review') || !coach.includes('roadmap_review')) {
  throw new Error('AI API guardrails are incomplete.');
}
const frontendFiles = ['index.html','app.html','auth.js','ai.js','billing.js','ads.js'];
for (const file of frontendFiles) {
  const source = readFileSync(file,'utf8');
  for (const secretName of ['SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','RAZORPAY_KEY_SECRET']) {
    if (source.includes(secretName)) throw new Error('Server-only secret referenced in frontend file: ' + file);
  }
}
const deleteApi = readFileSync('api/delete-account.js','utf8');
if (!deleteApi.includes('DELETE MY CAREEROS ACCOUNT') || !deleteApi.includes('claims.iat') || !deleteApi.includes('/auth/v1/admin/users/')) {
  throw new Error('Account deletion safeguards are incomplete.');
}
const cancelApi = readFileSync('api/cancel-subscription.js','utf8');
if (!cancelApi.includes('cancel_at_cycle_end: true') || !cancelApi.includes('SUPABASE_SERVICE_ROLE_KEY')) {
  throw new Error('Subscription cancellation safeguards are incomplete.');
}
const billing = readFileSync('billing.js','utf8');
if (!billing.includes('/api/cancel-subscription') || !billing.includes('cancel_at_cycle_end')) {
  throw new Error('Self-service billing management is incomplete.');
}
console.log('CareerOS checks passed: application controls, role templates, expanded interview bank, admin authorization, SEO, JavaScript syntax, Supabase RLS, AI quotas, account deletion and subscription management.');
