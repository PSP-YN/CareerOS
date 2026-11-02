import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMockReq, createMockRes, mockFetch } from './helpers.mjs';

import configHandler from '../api/config.js';
import coachHandler from '../api/coach.js';
import deleteAccountHandler from '../api/delete-account.js';
import questionsHandler from '../api/questions.js';
import adminQuestionsHandler from '../api/admin-questions.js';

describe('API: /api/config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('rejects non-GET methods with 405 and Allow header', () => {
    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    configHandler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET');
    assert.deepEqual(res.body, { error: 'Method not allowed' });
  });

  test('sets security headers', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    configHandler(req, res);
    assert.equal(res.headers['cache-control'], 'public, max-age=300, stale-while-revalidate=600');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  test('returns 500 if SUPABASE_URL has invalid hostname or protocol', () => {
    process.env.SUPABASE_URL = 'http://attacker.com';
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    configHandler(req, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Invalid Supabase project URL.');
  });

  test('reports billingEnabled=false when environment credentials are incomplete', () => {
    process.env.SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.RAZORPAY_KEY_SECRET;
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    configHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.billingEnabled, false);
    assert.equal(res.body.supabaseUrl, 'https://valid-project.supabase.co');
  });

  test('keeps billing disabled even if legacy payment variables are present', () => {
    process.env.SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
    process.env.RAZORPAY_KEY_SECRET = 'secret_123';
    process.env.RAZORPAY_PRO_PLAN_ID = 'plan_pro';
    process.env.RAZORPAY_PLUS_PLAN_ID = 'plan_plus';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    configHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.billingEnabled, false);
  });;
});

describe('API: /api/coach', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GEMINI_PAID_DATA_PROCESSING = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) restoreFetch();
  });

  test('rejects non-POST with 405', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 405);
  });

  test('returns 503 if server configuration is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const req = createMockReq({ method: 'POST', headers: { authorization: 'Bearer valid-token' } });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 503);
  });

  test('returns 401 if authorization token is missing', async () => {
    const req = createMockReq({ method: 'POST', headers: {} });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 401);
  });

  test('returns 401 if token is rejected by Supabase', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: false, status: 401 };
      }
      return { ok: true };
    });
    const req = createMockReq({ method: 'POST', headers: { authorization: 'Bearer bad-token' } });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 401);
  });

  test('returns 400 for invalid task or non-object context', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-123' }) };
      }
      return { ok: true };
    });
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
      body: { task: 'unsupported_task', context: {} }
    });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Invalid task or context.');
  });

  test('returns 413 if context exceeds 10000 characters', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-123' }) };
      }
      return { ok: true };
    });
    const hugeText = 'x'.repeat(10050);
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
      body: { task: 'interview_feedback', context: { text: hugeText } }
    });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 413);
  });

  test('rejects Gemini data transfer without explicit consent', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-123' }) };
      }
      return { ok: true };
    });
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
      body: { task: 'interview_feedback', context: { answer: 'A sufficiently detailed interview answer.' } }
    });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /explicit consent/i);
  });

  test('blocks Gemini requests unless billing-backed data processing is explicitly enabled', async () => {
    delete process.env.GEMINI_PAID_DATA_PROCESSING;
    let quotaCalled = false;
    let geminiCalled = false;
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'usr-123' }) };
      if (url.includes('/rpc/consume_careeros_ai_quota')) quotaCalled = true;
      if (url.includes('generativelanguage.googleapis.com')) geminiCalled = true;
      return { ok: true, json: async () => true };
    });
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
      body: { task: 'interview_feedback', context: { answer: 'A sufficiently detailed practice answer.' }, consent: true }
    });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'GEMINI_PAID_PROCESSING_REQUIRED');
    assert.equal(quotaCalled, false);
    assert.equal(geminiCalled, false);
  });

  test('returns 429 when daily quota is exhausted', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-123' }) };
      }
      if (url.includes('/rest/v1/rpc/consume_careeros_ai_quota')) {
        return { ok: true, json: async () => false };
      }
      return { ok: true };
    });
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
      body: { task: 'interview_feedback', context: { answer: 'valid answer' }, consent: true }
    });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 429);
    assert.match(res.body.error, /limit reached/i);
  });

  test('successfully strips markdown fences and returns structured advice', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-123' }) };
      }
      if (url.includes('/rest/v1/rpc/consume_careeros_ai_quota')) {
        return { ok: true, json: async () => true };
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        const payload = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{"summary":"Solid technical answer","next_actions":["Add performance metric"],"caveats":["Advisory only"]}\n```'
                  }
                ]
              }
            }
          ]
        };
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(payload),
          json: async () => payload
        };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
      body: { task: 'interview_feedback', context: { answer: 'I used a hash map to achieve O(N) complexity.' }, consent: true }
    });
    const res = createMockRes();
    await coachHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result.summary, 'Solid technical answer');
    assert.deepEqual(res.body.result.next_actions, ['Add performance metric']);
    assert.deepEqual(res.body.result.caveats, ['Advisory only']);
    assert.equal(res.body.quota.dailyLimit, 10);
  });
});

describe('API: /api/delete-account', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) restoreFetch();
  });

  test('returns 400 when confirmation phrase does not match', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer valid.jwt.token' },
      body: { confirmation: 'WRONG PHRASE' }
    });
    const res = createMockRes();
    await deleteAccountHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'The account deletion confirmation phrase did not match.');
  });

  test('returns 401 when token was issued more than 15 minutes ago', async () => {
    const oldIat = Math.floor(Date.now() / 1000) - (20 * 60); // 20 mins ago
    const payload = Buffer.from(JSON.stringify({ iat: oldIat })).toString('base64url');
    const token = 'header.' + payload + '.signature';

    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-1' }) };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
      body: { confirmation: 'DELETE MY CAREEROS ACCOUNT' }
    });
    const res = createMockRes();
    await deleteAccountHandler(req, res);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /sign out and sign in again/i);
  });

  test('deletes user via admin API when confirmation and fresh token match', async () => {
    const freshIat = Math.floor(Date.now() / 1000) - 30; // 30s ago
    const payload = Buffer.from(JSON.stringify({ iat: freshIat })).toString('base64url');
    const token = 'header.' + payload + '.signature';
    let adminDeleteCalled = false;

    restoreFetch = mockFetch(async (url, options) => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-1' }) };
      }
      if (url.includes('/auth/v1/admin/users/usr-1') && options.method === 'DELETE') {
        adminDeleteCalled = true;
        return { ok: true };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
      body: { confirmation: 'DELETE MY CAREEROS ACCOUNT' }
    });
    const res = createMockRes();
    await deleteAccountHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(adminDeleteCalled, true);
    assert.equal(res.body.deleted, true);
  });
});

describe('API: /api/questions', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) {
      restoreFetch();
      restoreFetch = null;
    }
  });

  test('rejects non-GET methods with 405', async () => {
    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await questionsHandler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET');
    assert.deepEqual(res.body, { error: 'Method not allowed' });
  });

  test('sets nosniff and cache headers', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await questionsHandler(req, res);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(res.headers['cache-control'], /public/);
  });

  test('returns empty array if Supabase is unconfigured', async () => {
    delete process.env.SUPABASE_URL;
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await questionsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { questions: [] });
  });

  test('returns questions from Supabase REST endpoint', async () => {
    const mockList = [
      { round: 'coding', question: 'Solve binary search tree inversion', rubric: 'O(n) time, O(h) space', difficulty: 'intermediate' }
    ];
    restoreFetch = mockFetch(async (url) => {
      assert.match(url, /\/rest\/v1\/interview_questions/);
      return {
        ok: true,
        json: async () => mockList
      };
    });

    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await questionsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { questions: mockList });
  });
});

describe('API: /api/admin-questions', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) {
      restoreFetch();
      restoreFetch = null;
    }
  });

  test('rejects unsupported HTTP methods with 405', async () => {
    const req = createMockReq({ method: 'PUT' });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET, POST, PATCH, DELETE');
  });

  test('returns 401 when Authorization header is missing', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 401);
  });

  test('returns 403 when user is authenticated but not an admin', async () => {
    restoreFetch = mockFetch(async (url) => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'usr-1', app_metadata: { role: 'authenticated' } })
        };
      }
      return { ok: true, json: async () => [] };
    });

    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer user-token' }
    });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Administrator access required.');
  });

  test('GET returns question list when caller has admin role', async () => {
    restoreFetch = mockFetch(async (url) => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'admin-1', app_metadata: { role: 'admin' } })
        };
      }
      if (url.includes('/rest/v1/interview_questions')) {
        return {
          ok: true,
          json: async () => [{ id: 'q-1', question: 'Sample admin question text' }]
        };
      }
      return { ok: false };
    });

    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer admin-token' }
    });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.questions.length, 1);
  });

  test('POST rejects question with invalid round or short text with 400', async () => {
    restoreFetch = mockFetch(async (url) => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'admin-1', app_metadata: { role: 'admin' } })
        };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: {
        round: 'unknown_round',
        question: 'Too short',
        rubric: 'Too short',
        difficulty: 'beginner'
      }
    });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Provide a valid round, question, rubric and difficulty.');
  });

  test('POST successfully creates a valid interview question', async () => {
    let insertedBody = null;
    restoreFetch = mockFetch(async (url, options) => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'admin-1', app_metadata: { role: 'admin' } })
        };
      }
      if (url.includes('/rest/v1/interview_questions') && options.method === 'POST') {
        insertedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => [{ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab', ...insertedBody }]
        };
      }
      return { ok: false };
    });

    const validPayload = {
      round: 'coding',
      question: 'Explain how you design a rate limiter using token bucket algorithm in a distributed system.',
      rubric: 'Evaluate understanding of token replenishment, Redis Lua scripts, and concurrency races.',
      difficulty: 'advanced'
    };

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: validPayload
    });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(insertedBody.round, 'coding');
    assert.equal(insertedBody.created_by, 'admin-1');
  });

  test('DELETE rejects invalid UUID with 400', async () => {
    restoreFetch = mockFetch(async (url) => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'admin-1', app_metadata: { role: 'admin' } })
        };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'DELETE',
      headers: { authorization: 'Bearer admin-token' },
      body: { id: 'invalid-not-a-uuid' }
    });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'A valid question ID is required.');
  });

  test('DELETE successfully removes question when valid UUID provided', async () => {
    let deletedId = null;
    restoreFetch = mockFetch(async (url, options) => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'admin-1', app_metadata: { role: 'admin' } })
        };
      }
      if (options.method === 'DELETE') {
        deletedId = url;
        return { ok: true, json: async () => [] };
      }
      return { ok: false };
    });

    const targetUuid = '123e4567-e89b-12d3-a456-426614174000';
    const req = createMockReq({
      method: 'DELETE',
      headers: { authorization: 'Bearer admin-token' },
      body: { id: targetUuid }
    });
    const res = createMockRes();
    await adminQuestionsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.deleted, true);
    assert.match(deletedId, new RegExp(targetUuid));
  });
});
