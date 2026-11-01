import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

describe('Security Audit: Secret Exposure & Client Bundle Hygiene', () => {
  const clientFiles = [
    'website/index.html', 'website/app.html', 'website/about.html', 'website/pricing.html', 'website/privacy.html',
    'website/terms.html', 'website/career-pivot-guide.html', 'website/admin.html',
    'website/js/auth.js', 'website/js/ai.js', 'website/js/ads.js', 'website/js/app.js', 'website/js/admin.js',
    'website/assets/styles.css'
  ];

  const serverSecrets = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
  ];

  test('no server secrets or private keys are referenced in any client-facing source file', () => {
    for (const file of clientFiles) {
      assert.ok(existsSync(file), `File ${file} must exist`);
      const content = readFileSync(file, 'utf8');
      for (const secret of serverSecrets) {
        assert.ok(
          !content.includes(secret),
          `Security violation: ${secret} found in client file ${file}`
        );
      }
    }
  });

  test('payment client and API routes are absent during the free pilot', () => {
    for (const file of [
      'website/js/billing.js',
      'api/create-subscription.js',
      'api/verify-subscription.js',
      'api/cancel-subscription.js',
      'api/razorpay-webhook.js'
    ]) assert.equal(existsSync(file), false, file + ' must not ship in the free pilot.');
    const config = readFileSync('api/config.js', 'utf8');
    assert.ok(config.includes('const billingEnabled = false;'));
  });

  test('.env.example contains no hardcoded values', () => {
    const envExample = readFileSync('.env.example', 'utf8');
    const lines = envExample.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const [key, value] = line.split('=');
      assert.equal(
        (value || '').trim(),
        '',
        `Environment example key ${key} must not have committed value`
      );
    }
  });
});

describe('Security Audit: HTTP Security Headers (vercel.json)', () => {
  const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const headers = vercelConfig.headers?.[0]?.headers || [];
  const headerMap = new Map(headers.map(h => [h.key.toLowerCase(), h.value]));

  test('X-Content-Type-Options is nosniff', () => {
    assert.equal(headerMap.get('x-content-type-options'), 'nosniff');
  });

  test('X-Frame-Options is DENY to prevent clickjacking', () => {
    assert.equal(headerMap.get('x-frame-options'), 'DENY');
  });

  test('Strict-Transport-Security enforces HTTPS with includeSubDomains', () => {
    const hsts = headerMap.get('strict-transport-security');
    assert.ok(hsts && hsts.includes('max-age=') && hsts.includes('includeSubDomains'));
  });

  test('Content-Security-Policy enforces strict boundaries', () => {
    const csp = headerMap.get('content-security-policy');
    assert.ok(csp, 'CSP header must be defined');
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP must block frame-ancestors');
    assert.ok(csp.includes("object-src 'none'"), 'CSP must disable object-src plugins');
    assert.ok(csp.includes("base-uri 'self'"), 'CSP must restrict base-uri');
    assert.ok(csp.includes('upgrade-insecure-requests'), 'CSP must upgrade insecure requests');
  });

  test('Permissions-Policy disables camera, microphone and geolocation', () => {
    const perm = headerMap.get('permissions-policy');
    assert.ok(perm && perm.includes('camera=()') && perm.includes('microphone=()') && perm.includes('geolocation=()'));
  });
});

describe('Security Audit: Database RLS & Privileges (supabase/schema.sql)', () => {
  const schema = readFileSync('supabase/schema.sql', 'utf8');

  test('Row Level Security is enabled on all tables', () => {
    assert.ok(schema.includes('alter table public.user_workspaces enable row level security;'));
    assert.ok(schema.includes('alter table public.ai_usage_daily enable row level security;'));
    assert.ok(schema.includes('alter table public.subscriptions enable row level security;'));
  });

  test('user_workspaces isolates records by auth.uid()', () => {
    assert.ok(schema.includes('(select auth.uid()) = user_id'));
    assert.ok(schema.includes('revoke all on public.user_workspaces from anon;'));
  });

  test('ai_usage_daily completely revokes access from client roles', () => {
    assert.ok(schema.includes('revoke all on public.ai_usage_daily from anon, authenticated;'));
    assert.ok(schema.includes('using (false)'));
  });

  test('stored procedures enforce security definer with safe search_path', () => {
    assert.ok(schema.includes('search_path = pg_catalog, public, pg_temp') || schema.includes('search_path = public, pg_temp'));
    assert.ok(schema.includes('grant execute on function public.consume_careeros_ai_quota(uuid, integer) to service_role;'));
    assert.ok(schema.includes('grant execute on function public.upsert_careeros_subscription(uuid,text,text,text,timestamptz,timestamptz,bigint) to service_role;'));
  });
});

describe('Security Audit: Crawlers & Discovery Files', () => {
  test('robots.txt disallows private routes', () => {
    const robots = readFileSync('website/robots.txt', 'utf8');
    assert.ok(robots.includes('Disallow: /api/'));
    assert.ok(robots.includes('Disallow: /app'));
    assert.ok(robots.includes('Sitemap:'));
  });

  test('app.html includes noindex, nofollow metadata', () => {
    const app = readFileSync('website/app.html', 'utf8');
    assert.ok(app.includes('content="noindex,nofollow"'));
  });
});
