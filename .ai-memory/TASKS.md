# Tasks (newest first)
Keep at most 15 entries; move older ones to TASKS.archive.md.

## Current goal
- Production readiness validation and hardening complete.

## Log
- 2026-11-01: Comprehensive QA, security audit, edge-case hardening, and test suite implementation.
  - Hardened `api/coach.js` (unauthenticated vs unconfigured status separation, Gemini code fence stripping, non-object JSON validation).
  - Hardened `api/create-subscription.js` (plan validation prior to service role check).
  - Hardened `api/verify-subscription.js` (strict string format and hex validation for signature).
  - Hardened `api/delete-account.js` (safe JWT parsing).
  - Hardened `api/razorpay-webhook.js` (256KB body payload limit to prevent stream exhaustion DoS).
  - Hardened `supabase/schema.sql` (same-second webhook event status transitions).
  - Hardened `website/js/app.js` (NaN sort prevention, safe array traversal).
  - Created 63 automated tests in `test/` (`api.test.mjs`, `core-logic.test.mjs`, `security-audit.test.mjs`).
  - Verified: `npm test` runs `scripts/verify.mjs` and all 63 unit/integration tests with 0 failures.
