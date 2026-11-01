# CareerOS performance, security and question administration

## Current security model
- Supabase publishable/anon key is public by design and is restricted by Row Level Security.
- `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and Razorpay secrets must exist only in Vercel server-side Environment Variables. Never prefix them with `NEXT_PUBLIC_` or place them in browser JavaScript.
- Gemini calls are proxied through `/api/coach`; the browser never receives the Gemini key. The server sends it using Google's `x-goog-api-key` header.
- User workspace rows are protected by RLS and ownership checks.
- Interview question rows have no direct anon/authenticated grants. The public question endpoint exposes only active prompt/rubric data; admin writes are mediated by a server route.
- Admin authorization checks `auth.users.app_metadata.role === "admin"` after Supabase validates the bearer token. Do not use `user_metadata` for authorization; users can edit it themselves.

## Enable administrator access
1. Sign in once using the Google account that should administer CareerOS.
2. In Supabase Dashboard → Authentication → Users, locate that account and copy its user UUID.
3. Use the Supabase Admin API or a trusted server-side admin operation to set `app_metadata` to include `{"role":"admin"}`. Do not set this in the user's editable metadata and do not expose a service-role key in the browser.
4. Sign out and sign in again so the refreshed access token contains the new app metadata.
5. Open `/admin`. The server verifies the role on every request; hiding the admin link is only a UI convenience, not the security boundary.

## Install the question bank
Run the updated `supabase/schema.sql` in Supabase SQL Editor. This adds the `interview_questions` table with RLS enabled and denies direct client access. The admin API uses the server-side service-role key. Existing interview questions remain available as built-in local questions even if the database is unavailable.

## Performance notes
- The browser session uses persistent local storage and is rendered immediately after local session recovery.
- Cloud workspace reconciliation runs in the background and avoids an unnecessary upsert when local and cloud payloads already match.
- Public Supabase configuration is cacheable; it contains only the public URL and publishable/anon key.
- Custom question data is cached briefly and falls back to built-in questions if the database endpoint is unavailable.

## Supabase dashboard settings to complete
- Enable leaked-password protection under Authentication → Security and password settings.
- Keep JWT expiry at the recommended default (typically one hour) unless you have a documented security reason to change it.
- Restrict Google OAuth scopes to `openid`, email and profile unless the product needs more.
- For a branded Google authorization domain instead of the Supabase project hostname, configure a Supabase Custom Domain (paid add-on) and update Google/Supabase OAuth callback and redirect configuration accordingly. Verify Google OAuth branding for the CareerOS name/logo.
- Review Supabase Security and Performance Advisors after applying schema updates.

## Release verification still required
Test real OAuth on a new and returning account, two-account RLS isolation, simultaneous cross-device updates, Gemini quota and provider failures, resume PDF export, every interview round, application CRUD/persistence, account deletion, Razorpay test checkout/webhooks, Android workflow and keyboard/screen-reader/contrast behavior. Automated static checks cannot replace those live integration tests.
