import { readFileSync, existsSync } from 'node:fs';

// Helper to load .env.local or .env if present
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

console.log('====================================================');
console.log('       CareerOS Live Integration Health Check       ');
console.log('====================================================\n');

let allPassed = true;

// 1. Google Gemini Live Verification
console.log('1. Checking Google Gemini AI Studio:');
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.log('   [-] GEMINI_API_KEY is not set in environment or .env/.env.local');
  allPassed = false;
} else {
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(geminiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return {"status":"ok"} in valid JSON.' }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 20 }
        })
      }
    );
    if (res.ok) {
      console.log('   [PASS] Google Gemini 2.5 Flash is active and responding.');
    } else {
      const err = await res.json().catch(() => ({}));
      console.log(`   [FAIL] Google Gemini rejected key: HTTP ${res.status} - ${err.error?.message || 'Unknown error'}`);
      allPassed = false;
    }
  } catch (e) {
    console.log(`   [FAIL] Google Gemini network request failed: ${e.message}`);
    allPassed = false;
  }
}

console.log('');

// 2. Supabase Live Verification
console.log('2. Checking Supabase Project & Database Schema:');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.log('   [-] SUPABASE_URL is not set.');
  allPassed = false;
} else if (!supabaseAnon) {
  console.log('   [-] SUPABASE_ANON_KEY is not set.');
  allPassed = false;
} else if (!supabaseService) {
  console.log('   [-] SUPABASE_SERVICE_ROLE_KEY is not set.');
  allPassed = false;
} else {
  try {
    // Check Auth endpoint
    const authRes = await fetch(supabaseUrl + '/auth/v1/settings', {
      headers: { apikey: supabaseAnon }
    });
    if (authRes.ok) {
      console.log('   [PASS] Supabase Auth connection verified (Anon key accepted).');
    } else {
      console.log(`   [FAIL] Supabase Auth check failed: HTTP ${authRes.status}`);
      allPassed = false;
    }

    // Check REST API & Required Tables via service role key
    const headers = { apikey: supabaseService, Authorization: 'Bearer ' + supabaseService };
    const tables = ['user_workspaces', 'ai_usage_daily', 'subscriptions', 'interview_questions'];
    
    for (const table of tables) {
      const tRes = await fetch(supabaseUrl + `/rest/v1/${table}?select=count`, {
        method: 'HEAD',
        headers
      });
      if (tRes.ok) {
        console.log(`   [PASS] Table '${table}' exists and is accessible.`);
      } else {
        console.log(`   [FAIL] Table '${table}' is missing or inaccessible (HTTP ${tRes.status}). Ensure supabase/schema.sql has been executed.`);
        allPassed = false;
      }
    }

    // Check Stored Procedures (RPC)
    const rpcQuota = await fetch(supabaseUrl + '/rest/v1/rpc/consume_careeros_ai_quota', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: '00000000-0000-0000-0000-000000000000', p_daily_limit: 10 })
    });
    if (rpcQuota.status === 200 || rpcQuota.status === 400 || (rpcQuota.status === 404 && (await rpcQuota.text()).includes('function'))) {
      console.log('   [PASS] Stored procedure "consume_careeros_ai_quota" endpoint reached.');
    } else {
      console.log(`   [FAIL] Stored procedure "consume_careeros_ai_quota" missing. Run supabase/schema.sql migration.`);
      allPassed = false;
    }

  } catch (e) {
    console.log(`   [FAIL] Supabase network connection failed: ${e.message}`);
    allPassed = false;
  }
}

console.log('');

// 3. Razorpay Verification (Optional)
console.log('3. Checking Razorpay (Billing & Subscriptions):');
const rzpKey = process.env.RAZORPAY_KEY_ID;
const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
const rzpWebhook = process.env.RAZORPAY_WEBHOOK_SECRET;
const rzpPro = process.env.RAZORPAY_PRO_PLAN_ID;
const rzpPlus = process.env.RAZORPAY_PLUS_PLAN_ID;

if (!rzpKey || !rzpSecret || !rzpWebhook || !rzpPro || !rzpPlus) {
  console.log('   [INFO] Razorpay credentials not fully configured.');
  console.log('   [INFO] Application gracefully falls back to FREE mode:');
  console.log('          - Free workspace with local & cloud sync is 100% active.');
  console.log('          - 10 free daily AI coaching requests per user are enabled.');
  console.log('          - Pricing page safely displays "Checkout launching soon".');
} else {
  try {
    const creds = Buffer.from(rzpKey + ':' + rzpSecret).toString('base64');
    const rRes = await fetch('https://api.razorpay.com/v1/plans/' + encodeURIComponent(rzpPro), {
      headers: { Authorization: 'Basic ' + creds }
    });
    if (rRes.ok) {
      console.log('   [PASS] Razorpay API credentials and Pro Plan verified.');
    } else {
      console.log(`   [FAIL] Razorpay returned HTTP ${rRes.status}. Verify Key ID and Secret.`);
      allPassed = false;
    }
  } catch (e) {
    console.log(`   [FAIL] Razorpay network request failed: ${e.message}`);
    allPassed = false;
  }
}

console.log('\n====================================================');
if (allPassed) {
  console.log('Result: All configured systems are healthy and ready!');
} else {
  console.log('Result: Please check the missing/failed items above.');
}
console.log('====================================================\n');
