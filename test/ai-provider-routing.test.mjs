import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { sanitizeHostedContext } from '../api/coach.js';

const envKeys = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY'];
const originalEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
const originalFetch = global.fetch;

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function createRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k,v){this.headers[k]=v;},
    status(n){this.statusCode=n;return this;},
    json(v){this.body=v;return this;}
  };
}
async function call(body) {
  const res=createRes();
  await handler({method:'POST',headers:{authorization:'Bearer test-session','content-length':'100'},body},res);
  return res;
}
test('AI coach requires explicit consent and rejects unsupported provider', async t => {
  process.env.SUPABASE_URL='https://supabase.test';
  process.env.SUPABASE_ANON_KEY='anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service';
  process.env.GEMINI_API_KEY='platform-gemini';
  global.fetch=async url => String(url).endsWith('/auth/v1/user') ? response(200,{id:'user-1'}) : response(200,{});
  t.after(()=>{global.fetch=originalFetch;for(const k of envKeys){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}});
  const noConsent=await call({task:'career_review',context:{role:'developer'},consent:false});
  assert.equal(noConsent.statusCode,400);
  const badProvider=await call({task:'career_review',context:{role:'developer'},consent:true,provider:'not-allowed'});
  assert.equal(badProvider.statusCode,400);
});

test('BYOK provider request does not consume CareerOS daily quota and never returns the key', async t => {
  process.env.SUPABASE_URL='https://supabase.test';
  process.env.SUPABASE_ANON_KEY='anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service';
  process.env.GEMINI_API_KEY='platform-gemini';
  const calls=[];
  global.fetch=async (url,options={}) => {
    calls.push({url:String(url),headers:options.headers||{},body:options.body});
    if(String(url).endsWith('/auth/v1/user')) return response(200,{id:'user-1'});
    if(String(url)==='https://api.openai.com/v1/chat/completions') return response(200,{choices:[{message:{content:JSON.stringify({summary:'Good evidence',next_actions:['Add a measurable result'],caveats:[]})}}]});
    throw new Error('Unexpected external request: '+url);
  };
  t.after(()=>{global.fetch=originalFetch;for(const k of envKeys){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}});
  const res=await call({task:'career_review',context:{role:'developer'},consent:true,ageConfirmed:true,provider:'openai',model:'gpt-4o-mini',apiKey:'user-secret-key'});
  assert.equal(res.statusCode,200);
  assert.equal(res.body.provider,'openai');
  assert.equal(res.body.model,'gpt-4o-mini');
  assert.equal(res.body.quota.mode,'byok');
  assert.ok(!JSON.stringify(res.body).includes('user-secret-key'));
  assert.equal(calls.length,2,'only auth and provider calls should happen');
  assert.equal(calls[1].headers.Authorization,'Bearer user-secret-key');
  assert.ok(!calls.some(c=>c.url.includes('/rpc/reserve_careeros_ai_quota')));
});

test('CareerOS free tier reserves two analyses per day and returns valid feedback', async t => {
  process.env.SUPABASE_URL='https://supabase.test';
  process.env.SUPABASE_ANON_KEY='anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service';
  process.env.GEMINI_API_KEY='platform-gemini';
  let quotaBody;
  global.fetch=async (url,options={}) => {
    const target=String(url);
    if(target.endsWith('/auth/v1/user')) return response(200,{id:'user-2'});
    if(target.endsWith('/rpc/reserve_careeros_ai_quota')) {quotaBody=JSON.parse(options.body);return response(200,'2026-11-02');}
    if(target.includes('generativelanguage.googleapis.com')) return response(200,{candidates:[{content:{parts:[{text:JSON.stringify({summary:'Useful review',next_actions:['Practice'],caveats:[]})}]}}]});
    throw new Error('Unexpected request '+target);
  };
  t.after(()=>{global.fetch=originalFetch;for(const k of envKeys){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}});
  const res=await call({task:'career_review',context:{role:'developer'},consent:true,ageConfirmed:true,provider:'gemini',freeTierDataAcknowledged:true});
  assert.equal(res.statusCode,200);
  assert.equal(quotaBody.p_daily_limit,2);
  assert.equal(res.body.quota.dailyLimit,2);
  assert.equal(res.body.result.summary,'Useful review');
});

test('hosted free tier requires data acknowledgement and sanitizes identifiers', async t => {
  process.env.SUPABASE_URL='https://supabase.test';
  process.env.SUPABASE_ANON_KEY='anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service';
  process.env.GEMINI_API_KEY='platform-gemini';
  global.fetch=async url => String(url).endsWith('/auth/v1/user') ? response(200,{id:'user-3'}) : response(200,true);
  t.after(()=>{global.fetch=originalFetch;for(const k of envKeys){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}});
  const missingAck=await call({task:'career_review',context:{role:'developer'},consent:true,ageConfirmed:true,freeTierDataAcknowledged:false,provider:'gemini'});
  assert.equal(missingAck.statusCode,400);
  const safe=sanitizeHostedContext({profile:{role:'developer',email:'person@example.com',phone:'+91 98765 43210'},note:'Contact at user@example.org https://linkedin.com/in/name'});
  assert.equal(safe.profile.email,'[redacted]');
  assert.equal(safe.profile.phone,'[redacted]');
  assert.ok(!JSON.stringify(safe).includes('example.com'));
  assert.ok(!JSON.stringify(safe).includes('linkedin.com'));
});
