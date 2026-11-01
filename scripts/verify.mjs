import { readFileSync as read, existsSync as exists, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const required = [
  'website/index.html','website/app.html','website/admin.html','website/about.html',
  'website/career-pivot-guide.html','website/pricing.html','website/privacy.html','website/terms.html',
  'website/assets/styles.css','website/assets/favicon.svg','website/assets/logo.svg',
  'website/assets/manifest.webmanifest','website/assets/admin.css',
  'website/js/app.js','website/js/auth.js','website/js/ai.js','website/js/admin.js',
  'website/js/ads.js','website/js/interview-engine.js','website/js/decision-studio.js','website/data/career-content.js',
  'website/data/extended-questions.js','website/data/full-scale-questions.js','api/coach.js','api/config.js','api/questions.js',
  'api/admin-questions.js','api/delete-account.js',
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
const extended=JSON.parse(extendedMatch[1].replace(/(^|\n)\s*([a-z_]+)\s*:/g,'$1"$2":'));
const fullScaleSource=readText('website/data/full-scale-questions.js');
const fullScaleMatch=fullScaleSource.match(/window\.CareerOSFullScaleQuestions\s*=\s*(\{[\s\S]*?\});/);
if(!fullScaleMatch) throw Error('Full-scale interview question bank is missing.');
const fullScale=JSON.parse(fullScaleMatch[1]);

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
for(const round of ['aptitude','coding','technical','system_design','case_study','behavioral','hr'])
  if(!Array.isArray(fullScale[round])||fullScale[round].length<20) throw Error('Full-scale question pool missing: '+round);
if(!appHtml.includes('/data/full-scale-questions.js')||!appHtml.includes('/js/interview-engine.js')||!appHtml.includes('/js/decision-studio.js'))
  throw Error('Full-scale interview and decision studio scripts must be loaded by the workspace.');
if(!appHtml.includes('data-tab="decisions"')||!appHtml.includes('id="decisions"')||!appHtml.includes('id="startFullMock"'))
  throw Error('Decision Studio and full mock interview controls are required.');
const authSource=readText('website/js/auth.js');
if(!authSource.includes('decisions: unique(')||!authSource.includes('mockInterviewHistory: unique('))
  throw Error('Decision Studio and mock interview history must merge across devices.');
if(appHtml.includes('PS 05')||appHtml.includes('Career Pivot Coach'))
  throw Error('Hackathon problem-statement branding must not appear in the product workspace.');
if(Object.keys(content.roles).length<7) throw Error('Career-role templates are missing.');

const ids=[...appHtml.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length) throw Error('Duplicate IDs in workspace HTML.');
if(!appHtml.includes('href="#mainContent"') || !appHtml.includes('<main id="mainContent" tabindex="-1">') || !appHtml.includes('id="feedback" role="status" aria-live="polite"'))
  throw Error('Workspace needs a skip link, main landmark and live interview feedback.');
if(!readText('website/admin.html').includes('href="#adminMain"') || !readText('website/admin.html').includes('id="adminMain" tabindex="-1"'))
  throw Error('Admin page needs a keyboard-accessible skip link and main landmark.');
if(!readText('website/assets/styles.css').includes('.skip-link:focus'))
  throw Error('Skip links must become visible when keyboard-focused.');
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

const jsFiles=[...staticFiles.filter(x=>x.endsWith('.js')),...['api/coach.js','api/config.js','api/questions.js','api/admin-questions.js','api/delete-account.js']];
for(const file of jsFiles){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)throw Error(file+': '+result.stderr);}
const schema=readText('supabase/schema.sql'),auth=readText('website/js/auth.js'),coach=readText('api/coach.js'),admin=readText('api/admin-questions.js');
if(!schema.includes('revoke all on public.subscriptions from anon;'))
  throw Error('Anonymous role must not have direct subscription table privileges.');
for(const marker of ['enable row level security','user_workspaces','interview_questions','consume_careeros_ai_quota','service_role'])
  if(!schema.includes(marker))throw Error('Supabase schema missing '+marker);
for(const marker of ['persistSession: true','autoRefreshToken: true','window.localStorage','syncWorkspace'])
  if(!auth.includes(marker))throw Error('Persistent auth/sync control missing: '+marker);
if(!schema.includes('as $$\ndeclare') || !schema.includes('\nend;\n$$;') || schema.includes('as $\ndeclare'))
  throw Error('Subscription SQL function must use a valid dollar-quoted body.');
if(!app.includes('if(roleChanged){S.skills=[];P.splice(0,P.length);S.done=[];S.answers=[];S.sessions=0;'))
  throw Error('Changing the target role must reset role-specific assessments, milestones and interview history.');
if(!auth.includes('const answers = roleChanged') || !auth.includes('sessions: roleChanged ?'))
  throw Error('Cloud role changes must not merge interview history from the previous target role.');
if(!app.includes("}loadq();fetch('/api/questions'"))
  throw Error('Built-in interview questions must load even when the custom question API is unavailable.');
if(app.includes("push([item.question,item.rubric])}loadq()})"))
  throw Error('Late custom-question responses must not clear an in-progress interview answer.');
if(auth.includes("storageKey: 'careeros-auth-v1'") || readText('website/js/admin.js').includes("storageKey:'careeros-auth-v1'"))
  throw Error('Use the existing Supabase auth storage key to preserve returning sessions.');
if((schema.match(/set search_path = pg_catalog, public, pg_temp/g)||[]).length!==2)
  throw Error('SECURITY DEFINER functions must pin pg_temp last in search_path.');



