# Tasks (newest first)
Keep at most 15 entries; move older ones to TASKS.archive.md.

## Current goal
- Finish live Gemini, Google OAuth, cross-device and browser acceptance checks. Do not claim full production validation until those pass.

## Log
- 2026-11-01: Merged `fixes-and-testing` as PR #10; GitHub Actions `npm run check` passed (63 tests, 18 suites, 0 failures).
  - Added API, core-logic and security regression tests.
  - Hardened Gemini parsing and provider error handling; moved Gemini key transmission to the `x-goog-api-key` header.
  - Removed the paid-subscription lookup from Gemini coaching. Free signed-in users receive a fixed 10-request daily server-enforced quota.
  - Hardened account-deletion JWT parsing, webhook body size limits, signature input validation and database event ordering.
  - Corrected the QA report to distinguish automated tests from live end-to-end validation.
  - Removed payment checks from the live verification script; billing remains disabled for this prototype.
- 2026-11-01: Earlier release merged as PR #8 and deployed to production with role-specific state reset, interview fallback, SQL hardening and accessibility fixes.
