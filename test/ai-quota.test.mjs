import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveHostedQuota, releaseHostedQuota } from '../api/lib/ai-quota.js';

const base = { supabaseUrl: 'https://example.supabase.co', serviceKey: 'server-only-test-key', userId: '00000000-0000-4000-8000-000000000001' };

test('reserves one of the two daily hosted analyses and returns the database UTC date', async () => {
  let request;
  const usageDate = await reserveHostedQuota({ ...base, fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify('2026-11-02'), { status: 200 });
  }});
  assert.equal(usageDate, '2026-11-02');
  assert.match(request.url, /reserve_careeros_ai_quota$/);
  assert.deepEqual(JSON.parse(request.options.body), { p_user_id: base.userId, p_daily_limit: 2 });
  assert.equal(request.options.headers.Authorization, 'Bearer server-only-test-key');
});

test('returns null when the database denies the daily limit', async () => {
  const result = await reserveHostedQuota({ ...base, fetchImpl: async () => new Response('null', { status: 200 }) });
  assert.equal(result, null);
});

test('fails closed when quota reservation RPC is unavailable', async () => {
  await assert.rejects(() => reserveHostedQuota({ ...base, fetchImpl: async () => new Response('{}', { status: 503 }) }), /HTTP 503/);
});

test('releases exactly one reservation against the database-returned usage date', async () => {
  let request;
  const result = await releaseHostedQuota({ ...base, usageDate: '2026-11-02', fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response('true', { status: 200 });
  }});
  assert.equal(result, true);
  assert.match(request.url, /release_careeros_ai_quota$/);
  assert.deepEqual(JSON.parse(request.options.body), { p_user_id: base.userId, p_usage_date: '2026-11-02' });
});

test('rejects malformed dates and does not issue a release request', async () => {
  let called = false;
  await assert.rejects(() => releaseHostedQuota({ ...base, usageDate: 'tomorrow', fetchImpl: async () => { called = true; } }), /Invalid quota usage date/);
  assert.equal(called, false);
});

test('fails visibly if database cannot confirm quota release', async () => {
  await assert.rejects(() => releaseHostedQuota({ ...base, usageDate: '2026-11-02', fetchImpl: async () => new Response('{}', { status: 500 }) }), /HTTP 500/);
});
