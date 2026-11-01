import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createMockReq, createMockRes, mockFetch } from './helpers.mjs';

import configHandler from '../api/config.js';
import coachHandler from '../api/coach.js';
import createSubscriptionHandler from '../api/create-subscription.js';
import verifySubscriptionHandler from '../api/verify-subscription.js';
import cancelSubscriptionHandler from '../api/cancel-subscription.js';
import deleteAccountHandler from '../api/delete-account.js';
import razorpayWebhookHandler from '../api/razorpay-webhook.js';
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

  test('reports billingEnabled=true when all Razorpay and Supabase credentials exist', () => {
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
    assert.equal(res.body.billingEnabled, true);
  });
});

describe('API: /api/coach', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.GEMINI_API_KEY = 'gemini-key';
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
      body: { task: 'interview_feedback', context: { answer: 'valid answer' } }
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
      body: { task: 'interview_feedback', context: { answer: 'I used a hash map to achieve O(N) complexity.' } }
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

describe('API: /api/create-subscription', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.RAZORPAY_KEY_ID = 'rzp_id';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_sec';
    process.env.RAZORPAY_PRO_PLAN_ID = 'plan_pro_123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) restoreFetch();
  });

  test('returns 401 if user is not signed in', async () => {
    const req = createMockReq({ method: 'POST', body: { plan: 'pro' } });
    const res = createMockRes();
    await createSubscriptionHandler(req, res);
    assert.equal(res.statusCode, 401);
  });

  test('returns 400 for invalid plan', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-1', email: 'test@example.com' }) };
      }
      return { ok: true };
    });
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: { plan: 'invalid_plan' }
    });
    const res = createMockRes();
    await createSubscriptionHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Invalid subscription plan.');
  });

  test('returns 200 with subscriptionId on valid plan and provider response', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'usr-1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } })
        };
      }
      if (url.includes('api.razorpay.com/v1/subscriptions')) {
        return { ok: true, json: async () => ({ id: 'sub_12345' }) };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: { plan: 'pro' }
    });
    const res = createMockRes();
    await createSubscriptionHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.subscriptionId, 'sub_12345');
    assert.equal(res.body.plan, 'pro');
    assert.equal(res.body.email, 'test@example.com');
  });
});

describe('API: /api/verify-subscription', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) restoreFetch();
  });

  test('returns 400 for incomplete or non-string verification data', async () => {
    restoreFetch = mockFetch(async () => ({ ok: true, json: async () => ({ id: 'usr-1' }) }));
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: { razorpay_payment_id: 1234, razorpay_subscription_id: 'sub_1', razorpay_signature: {} }
    });
    const res = createMockRes();
    await verifySubscriptionHandler(req, res);
    assert.equal(res.statusCode, 400);
  });

  test('rejects tampered signature with 400', async () => {
    restoreFetch = mockFetch(async () => ({ ok: true, json: async () => ({ id: 'usr-1' }) }));
    const fakeSig = 'a'.repeat(64);
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: {
        razorpay_payment_id: 'pay_123',
        razorpay_subscription_id: 'sub_123',
        razorpay_signature: fakeSig
      }
    });
    const res = createMockRes();
    await verifySubscriptionHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Payment signature verification failed.');
  });

  test('accepts valid cryptographic signature and marks webhook_pending', async () => {
    restoreFetch = mockFetch(async () => ({ ok: true, json: async () => ({ id: 'usr-1' }) }));
    const paymentId = 'pay_real_999';
    const subId = 'sub_real_999';
    const validSig = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(paymentId + '|' + subId)
      .digest('hex');

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: subId,
        razorpay_signature: validSig
      }
    });
    const res = createMockRes();
    await verifySubscriptionHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.verified, true);
    assert.equal(res.body.status, 'webhook_pending');
  });
});

describe('API: /api/cancel-subscription', () => {
  const originalEnv = { ...process.env };
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.RAZORPAY_KEY_ID = 'rzp_id';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_sec';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) restoreFetch();
  });

  test('returns 404 when no active subscription is found', async () => {
    restoreFetch = mockFetch(async url => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-1' }) };
      }
      if (url.includes('/rest/v1/subscriptions')) {
        return { ok: true, json: async () => [] };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: {}
    });
    const res = createMockRes();
    await cancelSubscriptionHandler(req, res);
    assert.equal(res.statusCode, 404);
  });

  test('calls Razorpay cancel endpoint and updates Supabase on active subscription', async () => {
    let cancelCalled = false;
    let patchCalled = false;
    restoreFetch = mockFetch(async (url, options) => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'usr-1' }) };
      }
      if (url.includes('/rest/v1/subscriptions') && options.method !== 'PATCH') {
        return {
          ok: true,
          json: async () => [
            { razorpay_subscription_id: 'sub_active', current_end: '2026-12-01T00:00:00Z', plan: 'pro' }
          ]
        };
      }
      if (url.includes('/cancel') && options.method === 'POST') {
        cancelCalled = true;
        return { ok: true, json: async () => ({ id: 'sub_active', status: 'cancelled' }) };
      }
      if (url.includes('/rest/v1/subscriptions') && options.method === 'PATCH') {
        patchCalled = true;
        return { ok: true };
      }
      return { ok: true };
    });

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: {}
    });
    const res = createMockRes();
    await cancelSubscriptionHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(cancelCalled, true);
    assert.equal(patchCalled, true);
    assert.equal(res.body.scheduled, true);
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

describe('API: /api/razorpay-webhook', () => {
  const originalEnv = { ...process.env };
  const secret = 'whsec_test_secret_456';
  let restoreFetch;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (restoreFetch) restoreFetch();
  });

  test('rejects missing or invalid webhook signature with 400', async () => {
    const raw = JSON.stringify({ event: 'subscription.activated' });
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-razorpay-signature': 'bad_sig' },
      streamBody: raw
    });
    const res = createMockRes();
    await razorpayWebhookHandler(req, res);
    assert.equal(res.statusCode, 400);
  });

  test('rejects body exceeding 256KB with 413 Payload Too Large', async () => {
    const largeChunk = Buffer.alloc(300 * 1024, 'a');
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-razorpay-signature': 'any' },
      streamBody: largeChunk
    });
    const res = createMockRes();
    await razorpayWebhookHandler(req, res);
    assert.equal(res.statusCode, 413);
  });

  test('ignores unhandled events or missing user safely with 200', async () => {
    const payload = {
      event: 'payment.captured',
      created_at: 1700000000,
      payload: { subscription: { entity: { id: 'sub_1' } } }
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', secret).update(raw).digest('hex');

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-razorpay-signature': sig },
      streamBody: raw
    });
    const res = createMockRes();
    await razorpayWebhookHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ignored, true);
  });

  test('persists valid subscription event via Supabase RPC', async () => {
    let rpcCalled = false;
    restoreFetch = mockFetch(async (url, options) => {
      if (url.includes('/rest/v1/rpc/upsert_careeros_subscription')) {
        rpcCalled = true;
        const body = JSON.parse(options.body);
        assert.equal(body.p_user_id, 'usr-uuid-123');
        assert.equal(body.p_plan, 'pro');
        assert.equal(body.p_status, 'active');
        return { ok: true, json: async () => true };
      }
      return { ok: true };
    });

    const payload = {
      event: 'subscription.activated',
      created_at: 1700001000,
      payload: {
        subscription: {
          entity: {
            id: 'sub_999',
            current_start: 1700001000,
            current_end: 1702593000,
            notes: {
              supabase_user_id: 'usr-uuid-123',
              plan: 'pro'
            }
          }
        }
      }
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', secret).update(raw).digest('hex');

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-razorpay-signature': sig },
      streamBody: raw
    });
    const res = createMockRes();
    await razorpayWebhookHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(rpcCalled, true);
    assert.equal(res.body.received, true);
    assert.equal(res.body.stale, false);
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
