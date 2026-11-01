# Platform architecture

CareerOS is a static, browser-first application with serverless API routes and Supabase-backed account data.

## Repository layout

- `website/` — public pages and static delivery output.
  - `assets/` — shared styles, icons, web manifest and page-specific styles.
  - `js/` — browser application, authentication, AI UI, billing and admin UI.
  - `data/` — editable role templates and curated interview content.
- `api/` — Vercel serverless endpoints. Keep this directory at the repository root.
- `supabase/` — database schema and access-control policies.
- `docs/` — product, operations, security and release documentation.
- `scripts/` — automated repository and syntax checks.

## Runtime boundaries

The browser stores guest workspace data locally. Authenticated workspace data is synchronised to a row owned by the signed-in Supabase user. RLS restricts workspace access. The browser receives only the Supabase publishable/anon key.

Gemini requests go through `/api/coach`. The route validates the user's Supabase access token, allowlists supported tasks, bounds request size, checks subscription entitlements, consumes a database-enforced quota and reads `GEMINI_API_KEY` only from the server environment. The browser never receives this secret.

Razorpay and account deletion operations also run through root-level serverless routes. Payment state is derived from verified webhook events, not client-submitted values.

## Content versus user data

Role templates and curated interview questions are product content, not pre-filled user profiles. They live under `website/data/`. New workspaces begin with an empty profile, no assessed skills and no completed milestones. The legacy seed fingerprint in the workspace migration code exists only to clean up old fabricated starter records without deleting user-entered work.

## Deployment

Vercel serves static content from `website/` while discovering serverless functions from the root `api/` directory. Public URLs remain clean through Vercel's `cleanUrls` setting. Do not move `api/` into `website/` or change the Vercel project root without reviewing function discovery.
