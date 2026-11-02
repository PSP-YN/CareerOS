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
} else if (process.env.GEMINI_PAID_DATA_PROCESSING !== 'true') {
  console.log('   [-] Gemini check blocked: CareerOS only sends personal career context through a billing-enabled Gemini project. The unpaid tier may use prompts and responses to improve Google products and may involve human review.');
  allPassed = false;
} else {
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return {"status":"ok"} in valid JSON.' }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 20 }
        })
      }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.candidates) && data.candidates.length > 0) {
      console.log('   [PASS] Google Gemini 3.8 Flash returned a model response.');
    } else {
      console.log(`   [FAIL] Google Gemini check failed: HTTP ${res.status} - ${data.error?.message || 'No candidate response returned'}`);
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
    const tables = ['user_workspaces', 'ai_usage_daily', 'interview_questions'];
    
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

    // Check quota reservation RPC without consuming a real user's allowance.
    const reserveQuota = await fetch(supabaseUrl + '/rest/v1/rpc/reserve_careeros_ai_quota', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: null, p_daily_limit: 2 })
    });
    const reserveResult = await reserveQuota.json().catch(() => 'invalid');
    if (reserveQuota.ok && reserveResult === null) {
      console.log('   [PASS] Hosted AI quota reservation RPC exists and safely rejects a null user.');
    } else {
      console.log(`   [FAIL] Hosted AI quota reservation RPC check failed (HTTP ${reserveQuota.status}). Apply the refundable AI quota migration.`);
      allPassed = false;
    }

  } catch (e) {
    console.log(`   [FAIL] Supabase network connection failed: ${e.message}`);
    allPassed = false;
  }
}

console.log('');

// Payment verification is intentionally excluded from the free prototype.\n\nconsole.log('\n====================================================');
if (allPassed) {
  console.log('Result: All configured systems are healthy and ready!');
} else {
  console.log('Result: Please check the missing/failed items above.');
}
console.log('====================================================\n');
