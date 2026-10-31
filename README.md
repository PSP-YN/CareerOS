# CareerOS

CareerOS is a career planning workspace for students, fresh graduates and early-career professionals. It connects target-role definition, self-assessed skill gaps, learning milestones, interview practice and application tracking.

**Production domain:** https://careeros-intelligence.vercel.app  
**Repository:** https://github.com/PSP-YN/CareerOS

## Product surfaces
- Public marketing website with structured product information and FAQ.
- Private career workspace at /app.
- Pricing and proposed subscription tiers at /pricing.
- Career pivot guide at /career-pivot-guide.
- About, privacy and terms pages.

## Core features
- Career profile and project evidence.
- Skill gap analysis and job-description keyword extraction from user-provided text.
- Application pipeline with editable stages, job links, applied dates and follow-up dates.
- Role-specific learning roadmaps with milestone progress tracking.
- Editable templates for AI/ML, full-stack, backend, frontend, data analyst, cybersecurity and product roles.
- Seven interview rounds: aptitude, coding, technical, system design, case study, behavioral and HR, each with a dedicated question bank and local practice rubric.
- Deterministic interview feedback.
- Optional Gemini coaching with explicit opt-in, authenticated requests and a Postgres-enforced daily quota.
- Guest mode with browser-local storage, JSON export, guest-to-cloud data merge and account deletion endpoint (account deletion requires the server-side service key and recent sign-in).
- Supabase Google OAuth and per-user workspace sync (requires the Google provider to be enabled and environment setup).
- Razorpay subscription integration with signed webhooks, server-side entitlements and self-service end-of-cycle cancellation (requires merchant account, plan IDs, webhook and test-mode verification).
- AdSense slot loader (disabled until publisher approval and IDs are configured).

## Local preview
Run the static frontend:
```bash
python3 -m http.server 4173
```
Open http://localhost:4173. API routes require the Vercel runtime; for full local API testing use Vercel CLI and local environment variables.

## Supabase setup
Follow [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md), then run [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor. The schema enables RLS for per-user workspace data and subscription metadata, plus a server-only daily AI quota RPC.

## Vercel environment variables
Required for Google sign-in and cloud sync:
- SUPABASE_URL
- SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)

Required for authenticated AI coaching:
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- GEMINI_API_KEY (server-only)

Required for Razorpay subscriptions:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET (server-only)
- RAZORPAY_PRO_PLAN_ID
- RAZORPAY_PLUS_PLAN_ID
- RAZORPAY_WEBHOOK_SECRET (server-only)

Optional after AdSense approval:
- ADSENSE_CLIENT_ID
- ADSENSE_HOME_SLOT_ID
- ADSENSE_GUIDE_SLOT_ID

Never commit actual secrets. Never expose the Supabase service-role key or Razorpay secret in client-side code.

## Monetization
See [docs/MONETIZATION.md](docs/MONETIZATION.md). Proposed tiers are Explore (free), Pro (₹299/month) and Career Plus (₹699/month). Paid checkout is not live until all Razorpay configuration and end-to-end tests are complete. Ads remain disabled until AdSense approval and consent configuration.

## Discoverability
See [docs/SEO_AEO_GEO.md](docs/SEO_AEO_GEO.md). SEO/AEO/GEO improve machine-readable information and content quality but do not guarantee search rankings or AI citations.

## Important limitations
- CareerOS does not guarantee jobs, interviews, salary outcomes or placement.
- Readiness scores and interview feedback are advisory, not validated hiring assessments.
- Job description analysis extracts skill signals from user-provided text; it does not scrape job boards or provide live labour-market statistics.
- Legal pages are launch drafts and must be completed with the operator's real legal identity and contact details.
