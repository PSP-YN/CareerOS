import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/coach.js';

const envKeys = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function setupFetch({ providerStatus = 200, providerStatuses = null, quotaDate = '2026-11-02' } = {}) {
  const calls = [];
  let providerCall = 0;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }), { status: 200 });
    if (String(url).endsWith('/rpc/reserve_careeros_ai_quota')) return new Response(JSON.stringify(quotaDate), { status: 200 });
    if (String(url).endsWith('/rpc/release_careeros_ai_quota')) return new Response('true', { status: 200 });
    if (String(url).includes('generativelanguage.googleapis.com')) {
      const status = providerStatuses ? providerStatuses[providerCall++] ?? 200 : providerStatus;
      if (status !== 200) return new Response(JSON.stringify({ error: { message: 'simulated provider failure' } }), { status });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'A useful review.', next_actions: ['Build one project.'], caveats: [] }) }] } }] }), { status: 200 });
    }
    throw new Error('Unexpected fetch URL: ' + url);
  };
  return calls;
}

async function invoke() {
  const headers = {};
  let statusCode = 200;
  let payload;
  const res = {
    setHeader(name, value) { headers[name] = value; },
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; }
  };
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer test-session-token', 'content-length': '400' },
    body: { task: 'career_review', context: { targetRole: 'Software Engineer' }, consent: true, ageConfirmed: true, freeTierDataAcknowledged: true, provider: 'gemini' }
  }, res);
  return { statusCode, payload, headers };
}

test.beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('successful valid hosted analysis commits exactly one daily reservation', async () => {
  const calls = setupFetch();
  const result = await invoke();
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.result.summary, 'A useful review.');
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/reserve_careeros_ai_quota')).length, 1);
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/release_careeros_ai_quota')).length, 0);
});


test('hosted Gemini 3.8 overload retries once on Gemini 3.6 without consuming a second quota slot', async () => {
  const calls = setupFetch({ providerStatuses: [503, 200] });
  const result = await invoke();
  const providerCalls = calls.filter(x => x.url.includes('generativelanguage.googleapis.com'));
  assert.equal(result.statusCode, 200);
  assert.equal(providerCalls.length, 2);
  assert.match(providerCalls[0].url, /gemini-3\.8-flash/);
  assert.match(providerCalls[1].url, /gemini-3\.6-flash/);
  assert.equal(result.payload.model, 'gemini-3.6-flash');
  assert.equal(result.payload.fallbackFrom, 'gemini-3.8-flash');
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/reserve_careeros_ai_quota')).length, 1);
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/release_careeros_ai_quota')).length, 0);
});

test('Gemini 503 releases the reservation and returns an actionable overload error', async () => {
  const calls = setupFetch({ providerStatus: 503 });
  const result = await invoke();
  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.code, 'PROVIDER_OVERLOADED');
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/release_careeros_ai_quota')).length, 1);
  assert.deepEqual(JSON.parse(calls.find(x => x.url.endsWith('/rpc/release_careeros_ai_quota')).options.body), {
    p_user_id: '00000000-0000-4000-8000-000000000001',
    p_usage_date: '2026-11-02'
  });
});

test('Gemini 429 releases the reservation and remains distinguishable from CareerOS free limit', async () => {
  const calls = setupFetch({ providerStatus: 429 });
  const result = await invoke();
  assert.equal(result.statusCode, 429);
  assert.equal(result.payload.code, 'PROVIDER_LIMIT');
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/release_careeros_ai_quota')).length, 1);
});

test('daily limit denial does not call Gemini or release a nonexistent reservation', async () => {
  const calls = setupFetch({ quotaDate: null });
  const result = await invoke();
  assert.equal(result.statusCode, 429);
  assert.equal(result.payload.code, 'CAREEROS_FREE_LIMIT');
  assert.equal(calls.some(x => x.url.includes('generativelanguage.googleapis.com')), false);
  assert.equal(calls.some(x => x.url.endsWith('/rpc/release_careeros_ai_quota')), false);
});

test('invalid model output releases the reservation rather than charging a free analysis', async () => {
  const calls = setupFetch();
  const geminiCall = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 });
    }
    return geminiCall(url, options);
  };
  const result = await invoke();
  assert.equal(result.statusCode, 502);
  assert.equal(result.payload.code, 'INVALID_AI_RESPONSE');
  assert.equal(calls.filter(x => x.url.endsWith('/rpc/release_careeros_ai_quota')).length, 1);
});
