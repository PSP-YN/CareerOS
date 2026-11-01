# Security and administration

## Trust boundaries

- Browser code receives only the Supabase project URL and publishable/legacy anon key.
- `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and Razorpay secrets belong only in Vercel server-side environment variables.
- Gemini is called through `/api/coach`. The route validates the Supabase bearer token, allowlists tasks, bounds request context, checks webhook-confirmed entitlements, consumes an atomic database quota and sends the API key through Google's `x-goog-api-key` header.
- User workspace access is protected by owner-based Supabase RLS.
- Interview questions are readable through a narrow public endpoint; direct client table privileges are denied. Admin writes require a verified Supabase user with `app_metadata.role === "admin"`.
- Never use editable `user_metadata` for authorization. Never log secrets, bearer tokens, full resumes or interview answers.

## Configure Gemini

1. Create or select a Gemini API key in Google AI Studio.
2. Add it to Vercel as `GEMINI_API_KEY`, marked Sensitive, for each environment that should use AI (Production, Preview and Development as appropriate).
3. Redeploy after changing environment variables.
4. Sign in to CareerOS, select an AI review, read the consent text and explicitly opt in.
5. Check the function logs for provider status and quota errors without logging request bodies or secrets.

The application uses the Gemini `generateContent` REST endpoint and the `gemini-2.5-flash` model. A configured environment variable does not prove the key is valid or that the Google project has available quota; complete a real signed-in review to verify provider access.

## Grant administrator access

1. Sign in once with the Google account that should administer CareerOS.
2. In Supabase Dashboard → Authentication → Users, locate that account and copy its user UUID.
3. Use the Supabase Admin API or another trusted server-side admin operation to set `app_metadata` to include `{"role":"admin"}`.
4. Sign out and sign in again so the access token contains the updated app metadata.
5. Open `/admin`. The server checks the role on every request; hiding the admin link is only a convenience, not the security boundary.

Never set administrator permissions through the user's editable metadata or from browser JavaScript.

## Question content

- Default career-role templates and built-in interview questions are version-controlled product content in `website/data/`; they are not prefilled user profiles.
- Custom questions are stored in Supabase `interview_questions` and administered through `/admin`.
- Run the supplied Supabase schema in the project before using custom question administration.
- The public API returns only active questions and bounded fields. The database denies direct `anon` and `authenticated` table access.

## Performance and caching

- Static pages and assets are served from the Vercel output directory `website/`.
- Root-level `api/` contains serverless functions and must remain outside the static website folder.
- The browser recovers its persisted Supabase session locally; initial cloud reconciliation runs in the background.
- Workspace writes are debounced and unchanged initial payloads are not written again.
- Public Supabase configuration contains no server secrets and can be cached briefly. User-specific and AI API responses use no-store caching.

## Supabase dashboard hardening

- Enable leaked-password protection under Authentication → Security and password settings.
- Restrict Google OAuth scopes to the minimum required: `openid`, email and profile.
- Keep administrator permissions in `app_metadata`.
- Review Supabase Security and Performance Advisors after schema changes.
- Consider a branded Supabase custom auth domain if the Google authorization flow still displays the project hostname; this is a paid add-on. Google OAuth branding verification is configured separately.

## Release gate

Static checks do not replace live testing. Before describing CareerOS as production-ready, verify: new and returning Google accounts; two-account RLS isolation; concurrent and cross-device workspace updates; Gemini success, quota exhaustion and provider failures; resume PDF output; all seven interview rounds; application CRUD; account deletion; Razorpay test checkout and webhooks; Android workflows; keyboard, screen-reader and contrast behavior.
