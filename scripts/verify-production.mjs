const base = (process.env.CAREEROS_URL || 'https://careeros-intelligence.vercel.app').replace(/\/$/, '');
const failures = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(path, expected, options = {}) {
  let last;
  for (let attempt = 0; attempt < (options.retry ? 20 : 1); attempt++) {
    try {
      const res = await fetch(base + path, { cache: 'no-store', ...options.fetchOptions });
      if (options.retry && res.status >= 500 && attempt < 19) { last = new Error(path + ' HTTP ' + res.status); await sleep(15000); continue; }
      if (!expected.includes(res.status)) throw new Error(path + ' expected HTTP ' + expected.join('/') + ', got ' + res.status);
      return res;
    } catch (error) {
      last = error;
      if (!options.retry || attempt === 19) break;
      await sleep(15000);
    }
  }
  failures.push(last?.message || ('request failed: ' + path));
}
console.log('CareerOS production smoke tests: ' + base);
const home = await request('/', [200], { retry: true });
if (home) {
  const html = await home.text();
  if (!html.includes('CareerOS') || !html.includes('application/ld+json')) failures.push('Homepage title/structured data missing');
  const headers = home.headers;
  if (!headers.get('content-security-policy')) failures.push('CSP header missing');
  if (!headers.get('strict-transport-security')) failures.push('HSTS header missing');
}
for (const path of ['/about','/pricing','/career-pivot-guide','/app','/robots.txt','/sitemap.xml','/llms.txt']) {
  const res = await request(path, [200]);
  if (res && path === '/app' && !((await res.text()).includes('noindex,nofollow'))) failures.push('/app missing noindex metadata');
}
const configRes = await request('/api/config', [200]);
if (configRes) {
  const config = await configRes.json().catch(() => null);
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) failures.push('/api/config lacks public Supabase configuration');
  if (config?.billingEnabled !== false) failures.push('Billing unexpectedly enabled in pilot');
}
await request('/api/coach', [405]);
await request('/api/admin-questions', [401]);
if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}
console.log('PASS: homepage, marketing routes, workspace, SEO endpoints, config API, expected auth/method guards and security headers.');
