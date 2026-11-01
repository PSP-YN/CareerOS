# CareerOS Automated QA & Product Release Report

**Date:** 2 November 2026  
**Release branch:** `startup-product-evolution` (awaiting CI and production acceptance)  
**Product stage:** free early-access pilot

## 1. Product scope

CareerOS is positioned as a career decision and readiness workspace connecting role choices, skill evidence, structured interview practice and job-search execution.

The workspace includes:
- Career profile and role-specific skill baselines.
- Editable skill gaps and learning roadmaps.
- Resume Studio and exports.
- Application tracking.
- Decision Studio with user-weighted comparison of two roles, offers or learning paths.
- Seven interview categories: aptitude, coding, technical, system design, case study, behavioral and HR.
- 140 additional original practice prompts (20 per round) and a structured 14-question mock interview (two questions per round).
- Optional Gemini career, roadmap and interview feedback, with explicit consent and a server-enforced 10-request daily per-user quota.

## 2. Important scoring limitations

The Decision Studio uses user-entered ratings and fixed default weights. It is a reflection tool, not an objective career recommendation or live job-market forecast.

The current mock interview uses a local keyword/rubric heuristic for answer scoring. It does not measure communication quality, correctness or real hiring probability. Gemini review is optional and separate. The question bank is original practice content, not verified employer interview questions.

## 3. Security and reliability

- Gemini API key remains server-side and is sent using the `x-goog-api-key` request header.
- Gemini requests are rejected server-side without explicit consent.
- Free Gemini coaching does not query subscription entitlements; one atomic server-side quota applies to all users.
- Supabase quota RPC remains restricted to the service role; AI usage records are not directly readable or writable by browser roles.
- Supabase SECURITY DEFINER functions use a pinned search path.
- Workspace records use per-user RLS policies.
- Account deletion validates the access token and exact confirmation phrase.
- Payment UI, payment client code and payment API endpoints have been removed for the free pilot. `/api/config` reports `billingEnabled: false` even if legacy payment variables exist. The legacy subscription table remains dormant and protected by RLS; it is not used by the pilot.
- The Supabase Pro-only leaked-password protection setting remains unavailable on the current plan. It is a documented residual platform limitation.

## 4. Automated checks

GitHub Actions runs `npm run check`, including static verification, JavaScript syntax checks and Node test suites. The release branch adds checks for:
- All seven interview rounds and at least 20 new questions in each full-scale round.
- Loading the question bank and interview/decision modules.
- Decision Studio and full mock interview controls.
- Removal of hackathon problem-statement branding from the app.
- Payment-disabled API configuration.
- Existing API, core-state, workspace merge, sanitization and security regression cases.

The CI run attached to the release pull request is the authoritative test result. Do not copy an earlier main-branch test count as the result for this release.

## 5. Live acceptance tests still required

1. Google OAuth sign-in, returning sessions, sign-out and cross-device sync.
2. Real Gemini response for each of the three supported task types.
3. Complete all 14 questions in a mock and verify the round scorecard and saved history.
4. Compare two options in Decision Studio, save, reload and confirm persistence.
5. Switch target roles and verify no role-specific assessment leaks.
6. Admin question CRUD and non-admin denial.
7. Resume preview, print/PDF and mobile layout.
8. Account deletion using a disposable test account.
9. Keyboard-only navigation and narrow-screen browser testing.
10. Production smoke tests for every API route and security headers.

Do not call CareerOS production-ready until the release CI is green, the live acceptance tests pass, and no unresolved critical/high-severity issue remains.
