import { readFileSync as read, existsSync as exists, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const required = [
  'website/index.html','website/app.html','website/admin.html','website/about.html',
  'website/career-pivot-guide.html','website/pricing.html','website/privacy.html','website/terms.html',
  'website/assets/styles.css','website/assets/favicon.svg','website/assets/logo.svg',
  'website/assets/manifest.webmanifest','website/assets/admin.css',
  'website/js/app.js','website/js/auth.js','website/js/ai.js','website/js/admin.js',
  'website/js/billing.js','website/js/ads.js','website/data/career-content.js',
  'website/data/extended-questions.js','api/coach.js','api/config.js','api/questions.js',
  'api/admin-questions.js','api/delete-account.js','api/razorpay-webhook.js',
  'supabase/schema.sql','README.md','vercel.json'
];
for (const file of required) if (!exists(file)) throw Error('Missing: '+file);

const readText = path => read(path,'utf8');
const appHtml=readText('website/app.html'), app=readText('website/js/app.js');
const contentSource=readText('website/data/career-content.js');
const contentMatch=contentSource.match(/Object\.freeze\((.*)\);/s);
if(!contentMatch) throw Error('Career content data is not a valid structured object.');
const content=JSON.parse(contentMatch[1]);
const extendedSource=readText('website/data/extended-questions.js');
const extendedMatch=extendedSource.match(/window\.CareerOSQuestionBank\s*=\s*(\{[\s\S]*\});/);
if(!extendedMatch) throw Error('Extended question bank is missing.');
const extended=JSON.parse(extendedMatch[1]);

if(!app.includes('profile:{role:\'\',experience:\'\',timeline:\'\'')||!app.includes('skills:[],done:[]'))
  throw Error('New workspaces must start without fabricated profile, skill or milestone data.');
if(!app.includes('if(!S.profile.role||!S.skills.length||S.skills.some(x=>Number(x.level)===0))return null'))
  throw Error('Readiness must require a target role and completed skill assessments.');
if(!app.includes("P.length?Math.round(n/P.length*100)+'%':'Not started'")||!app.includes('(P.length?n/P.length*100:0)'))
  throw Error('Empty roadmap progress must be represented safely.');
if(!app.includes("if(!Object.values(r).some(value=>String(value||'').trim())&&!skills)"))
  throw Error('Resume preview must not fabricate a sample candidate.');
if(!app.includes('ROLE_TEMPLATES=window.CareerOSContent?.roles||{}')||!app.includes('Q=window.CareerOSContent?.questions||{}'))
  throw Error('Role templates and default questions must be data files, not embedded in application logic.');
for(const round of ['aptitude','coding','technical','system_design','case_study','behavioral','hr'])
  if(!Array.isArray(content.questions[round])||content.questions[round].length<5) throw Error('Question pool too small: '+round);
for(const round of ['aptitude','coding','technical'])
  if(!Array.isArray(extended[round])||extended[round].length<20) throw Error('Expanded question pool missing: '+round);
if(Object.keys(content.roles).length<7) throw Error('Career-role templates are missing.');

const ids=[...appHtml.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length) throw Error('Duplicate IDs in workspace HTML.');
for(const id of ['overview','profile','resume','skills','roadmap','interview','applications','signinGoogle','roleTemplate','applyRoleTemplate','qtype','evaluate','addapp','resumePreview','downloadResume','printResume'])
  if(!ids.includes(id)) throw Error('Missing workspace control: '+id);
if(/<script\b(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(appHtml))
  throw Error('Executable inline JavaScript remains in workspace HTML.');
for(const path of ['website/index.html','website/admin.html','website/pricing.html','website/about.html','website/privacy.html','website/terms.html','website/career-pivot-guide.html'])
  if(!exists(path)) throw Error('Missing public page '+path);
const landing=readText('website/index.html');
if(landing.indexOf('<section class="closing-cta">')>landing.indexOf('<footer class="marketing-footer">'))
  throw Error('Closing call-to-action must appear before the footer.');
for(const marker of ['rel="canonical"','application/ld+json','FAQPage','/assets/styles.css','/js/ads.js'])
  if(!landing.includes(marker)) throw Error('Landing page marker missing: '+marker);

const manifest=JSON.parse(readText('website/assets/manifest.webmanifest'));
if(!exists('website'+manifest.icons[0].src)) throw Error('PWA icon path is invalid.');
const deployment=JSON.parse(readText('vercel.json'));
if(deployment.outputDirectory!=='website'||deployment.cleanUrls!==true) throw Error('Vercel static output must target website/.');
for(const rootFile of ['index.html','app.html','admin.html','styles.css','auth.js','question-bank.js'])
  if(exists(rootFile)) throw Error('Legacy website file remains at repository root: '+rootFile);

const staticFiles=[];
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+item.name;if(item.isDirectory())walk(p);else staticFiles.push(p);}}
walk('website');
for(const path of staticFiles){
  const source=readText(path);
  for(const secret of ['SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','RAZORPAY_KEY_SECRET'])
    if(source.includes(secret)) throw Error('Server secret referenced in public website: '+path);
}
for(const page of ['website/index.html','website/app.html','website/admin.html','website/pricing.html']){
  const html=readText(page);
  for(const [,url] of html.matchAll(/(?:src|href)="(\/(?:assets|js|data)\/[^"?#]+)"/g))
    if(!exists('website'+url)) throw Error('Broken static asset '+url+' referenced by '+page);
}

const jsFiles=[...staticFiles.filter(x=>x.endsWith('.js')),...['api/coach.js','api/config.js','api/questions.js','api/admin-questions.js','api/delete-account.js','api/razorpay-webhook.js','api/create-subscription.js','api/verify-subscription.js','api/cancel-subscription.js']];
for(const file of jsFiles){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)throw Error(file+': '+result.stderr);}
const schema=readText('supabase/schema.sql'),auth=readText('website/js/auth.js'),coach=readText('api/coach.js'),admin=readText('api/admin-questions.js');
for(const marker of ['enable row level security','user_workspaces','interview_questions','consume_careeros_ai_quota','service_role'])
  if(!schema.includes(marker))throw Error('Supabase schema missing '+marker);
for(const marker of ['persistSession:true','autoRefreshToken:true','localStorage','syncWorkspace()'])
  if(!auth.includes(marker))throw Error('Persistent auth/sync control missing: '+marker);
for(const marker of ['GEMINI_API_KEY','x-goog-api-key','gemini-2.5-flash','MAX_CONTEXT_CHARS','AbortController','consume_careeros_ai_quota'])
  if(!coach.includes(marker))throw Error('Gemini server guard missing: '+marker);
if(!admin.includes("user.app_metadata?.role !== 'admin'"))throw Error('Admin role is not checked server-side.');
for(const marker of ['SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','RAZORPAY_KEY_SECRET'])
  if(landing.includes(marker)||appHtml.includes(marker))throw Error('Secret name exposed in HTML.');
const readme=readText('README.md');
for(const marker of ['Our purpose','The CareerOS experience','Trust and product boundaries','CareerOS — Career intelligence'])
  if(!readme.includes(marker))throw Error('Company README section missing: '+marker);
if(readme.includes('npm run check')||readme.includes('Local preview'))throw Error('README is overly developer-oriented.');
console.log('CareerOS verification passed: website structure, content separation, clean workspace state, question coverage, assets, JavaScript syntax, Gemini key boundary, admin authorization and Supabase protections.');
