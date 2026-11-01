# Project overview
CareerOS: Evidence-backed career intelligence, pivot planning, interview lab, and resume workspace.

- **Stack:** Node.js (ESM), Vanilla JS/HTML/CSS (Vercel Serverless + static frontend in `website/`), Supabase (PostgreSQL with RLS), Razorpay (billing webhooks), Google Gemini (AI coaching).
- **Package manager:** npm
- **Entry points:** `website/index.html` (marketing landing), `website/app.html` (interactive workspace), `api/*.js` (serverless functions)

## Commands
- `npm test`: Runs verification script (`scripts/verify.mjs`) and automated test suite (`node --test test/*.test.mjs`).
- `npm run check`: Verification and automated tests.

## Structure
- `website/`: Static frontend pages (`index.html`, `app.html`, `admin.html`), assets, data (`career-content.js`), and scripts (`app.js`, `auth.js`, `ai.js`, `billing.js`).
- `api/`: Vercel serverless API handlers (`coach.js`, `config.js`, `create-subscription.js`, `verify-subscription.js`, `cancel-subscription.js`, `delete-account.js`, `razorpay-webhook.js`, `questions.js`, `admin-questions.js`).
- `supabase/`: Schema migrations, stored procedures, RLS policies (`schema.sql`).
- `test/`: Automated test suite covering API routes, security posture, headers, and core logic.
- `scripts/`: Verification scripts (`verify.mjs`).

## Conventions and constraints
- Static files must never leak server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `GEMINI_API_KEY`).
- Serverless routes validate authentication and enforce timing-safe cryptographic verification on all signatures.
- Supabase stored procedures must pin `search_path` and use `security definer` with permissions granted strictly to `service_role`.
