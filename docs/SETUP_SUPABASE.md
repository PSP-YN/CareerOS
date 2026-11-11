# Supabase and Google sign-in setup

## Rebuild or redeploy the database from Git

The repository now contains a complete baseline migration plus subsequent migrations under `supabase/migrations/`. Treat those migrations as the deployment source of truth; `supabase/schema.sql` remains a readable schema reference and manual bootstrap fallback.

### Automated deployment (recommended)

1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Add these secrets:
   - `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token with access to the target project.
   - `SUPABASE_DB_PASSWORD` — the database password for that target project.
3. Open **Actions → Deploy CareerOS Supabase schema → Run workflow**.
4. Enter the 20-character project reference as both `project_ref` and `confirm_project_ref`. The workflow validates the two values, previews pending migrations, then applies them.
5. Review the workflow run and verify the remote migration history before configuring the app.

The workflow is manual-only and does not run on every push. Use a fresh Supabase project for a clean redeployment. Do not run it against an unrelated project. Existing data is not copied by migrations; export and restore data separately if it must be retained.

### Manual deployment

Install the Supabase CLI, authenticate with `SUPABASE_ACCESS_TOKEN`, then run from the repository root:

```bash
supabase db push --dry-run --remote=<PROJECT_REF>
supabase db push --yes --remote=<PROJECT_REF>
supabase migration list --remote=<PROJECT_REF>
```

The CLI uses `SUPABASE_DB_PASSWORD` for database authentication. The dry run is read-only; the second command applies pending migrations. Never use `supabase db reset --remote` for production redeployment.

## Initial database setup (manual fallback)

## 1. Run the database migration
Open the Supabase project CareerOS → SQL Editor → New query. Paste and run [schema.sql](../supabase/schema.sql).

This creates one private workspace row per authenticated user. Row Level Security is enabled; users can only read or write rows whose user_id equals auth.uid(). The anon role receives no table access.

## 2. Add Vercel environment variables
Vercel → CareerOS project → Settings → Environment Variables. Add these for Production, Preview, and Development as appropriate:

| Name | Value | Visibility |
|---|---|---|
| SUPABASE_URL | Project URL from Supabase → Project Settings → API | Plain configuration |
| SUPABASE_ANON_KEY | Publishable/anon key from Supabase → Project Settings → API | Public key (anon/publishable only) |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service_role key from Project Settings → API; server-only | Sensitive |
| GEMINI_API_KEY | Your Gemini API key from Google AI Studio | Sensitive |

Do not use the Supabase service_role key in the browser or expose it as SUPABASE_ANON_KEY. This app only needs the anon/publishable key in the browser; RLS enforces access.

After adding variables, redeploy the Vercel project.

## 3. Enable Google provider in Supabase
Supabase → Authentication → Sign In / Providers → Google → Enable.
Create a Google OAuth Web application in Google Cloud Console. Google OAuth credentials are separate from `GEMINI_API_KEY` and Supabase service-role credentials.

In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID:
- Authorized JavaScript origin: https://careeros-intelligence.vercel.app
- Authorized redirect URI: https://wjjfnmpkjmaakgnsvxaz.supabase.co/auth/v1/callback.

Paste the Google Client ID and Client Secret into Supabase → Authentication → Sign In / Providers → Google, enable Google, and save. Do not put the Google Client Secret in Vercel or browser code.

## 4. Set Supabase URL configuration
Supabase → Authentication → URL Configuration:
- Site URL: https://careeros-intelligence.vercel.app
- Additional Redirect URLs:
  - https://careeros-intelligence.vercel.app/app
  - https://careeros-intelligence.vercel.app/**
  - http://localhost:4173/**
  - Add a Vercel preview wildcard only if you actively test OAuth on preview deployments.

The Google OAuth callback is the Supabase callback URL, not the Vercel domain. The app's post-login redirect is /app.

## 5. Verify
Open https://careeros-intelligence.vercel.app/app, click Continue with Google, complete consent, and verify the account email appears in the header. Create a skill or milestone, reload, and verify cloud sync persists it. Test with two separate Google accounts to confirm data isolation.

## Current implementation notes
- Guest mode remains available and stores data in this browser.
- Signed-in workspaces are synced to public.user_workspaces.
- The app uses the Supabase anon/publishable key with RLS; never put service_role credentials in Vercel browser-visible configuration.
- Existing local browser data is uploaded for a new account when no remote workspace exists. An existing remote workspace takes precedence after sign-in.
