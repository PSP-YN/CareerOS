# CareerOS Automated QA & Security Hardening Report

**Date:** November 1, 2026  
**Automated CI:** 63 tests passed, 18 suites, 0 failures  
**Release commit:** `b8341a7d4a971292e787fe3bc2d9960cc7c0965f`

---

## 1. Scope and limitations

This release adds automated regression coverage and targeted security hardening. The Node.js test suite exercises API handlers with mocked upstream services, core state logic, and static security/configuration assertions.

**These tests are not a complete end-to-end browser audit.** They do not prove live Google OAuth, multi-device synchronization, actual Gemini provider responses, admin workflows in a browser, account deletion against a real user, or every mobile/accessibility interaction. Those flows still require live validation.

## 2. Included prototype capabilities

- Career profile, skill-gap assessment and roadmap planning.
- Seven interview-practice rounds with local heuristic feedback.
- Resume drafting, TXT export and browser print/PDF.
- Application tracking.
- Optional Gemini career, roadmap and interview reviews for signed-in users.
- Supabase-backed private workspace sync, subject to Google OAuth and database configuration.
- No active checkout or payment flow. Razorpay environment variables are not configured; billing is intentionally outside this prototype.

## 3. Security and reliability changes

- Gemini API key remains server-side and is sent to Google using the `x-goog-api-key` request header, not a URL query parameter.
- Gemini response parsing strips optional Markdown fences, validates object shape, bounds returned fields and reports provider failures with actionable status codes.
- Free Gemini coaching uses a fixed **10-request daily per-user quota** enforced by the existing Postgres RPC. It no longer queries the `subscriptions` table or depends on paid entitlements.
- API handlers distinguish missing authentication from missing server configuration.
- Account deletion safely handles malformed JWT payloads and requires a recently issued access token plus an exact confirmation phrase.
- Razorpay webhook request bodies are capped at 256 KB to limit memory-exhaustion risk. This is hardening of dormant legacy code, not an enabled payment feature.
- Subscription signature inputs are type-checked and constrained to 64 hexadecimal characters before timing-safe comparison.
- Subscription webhook upserts handle same-second provider events without allowing older events to overwrite newer state.
- Client-side sorting and roadmap traversal handle empty or malformed state more safely.
- Supabase SECURITY DEFINER functions use a pinned search path and the AI usage counter is not directly readable or writable by browser roles.

## 4. Automated validation

| Suite | Coverage | Tests |
|---|---|---:|
| API handlers | Method/auth/input validation, quota behavior, Gemini response handling, account deletion and dormant billing-handler edge cases | 32 |
| Core logic | Role templates, skill gaps, readiness, workspace merging and sanitization | 11 |
| Security assertions | Secret exposure, headers, RLS/schema expectations and crawler policy | 20 |
| **Total** | **GitHub Actions: `npm run check` succeeded** | **63 / 63 passed** |

CI run: [GitHub Actions run 41337082452](https://github.com/PSP-YN/CareerOS/actions/runs/41337082452).

## 5. Free-mode configuration

- `/api/config` reports `billingEnabled: false` when payment credentials are absent.
- The application does not require Razorpay credentials for its core workspace or Gemini free quota.
- Gemini requires a valid server-side `GEMINI_API_KEY`; Google AI Studio free-tier availability and rate limits are controlled by Google.
- Cloud workspace sync requires Supabase public configuration, a server-side service-role key for privileged APIs, and a working Google OAuth configuration.
- The Supabase Pro-only leaked-password protection setting remains disabled because it is not available on the current plan. This is documented as a residual platform limitation, not a code-level security fix.

## 6. Live validation still required

1. Sign in with Google and confirm the authenticated workspace state.
2. Run one Gemini review for each task type and confirm real provider feedback is rendered.
3. Save profile, skills and roadmap changes; reopen the same account on another device.
4. Verify role switching does not leak the previous role's assessments or milestones.
5. Test admin access with both admin and non-admin accounts.
6. Test account deletion only with a disposable test account.
7. Complete keyboard-only and narrow-screen browser checks.

Do not describe CareerOS as fully production-validated until these live checks are complete.
