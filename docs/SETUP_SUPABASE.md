# Supabase and Google sign-in setup

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
- Authorized redirect URI: copy the exact Supabase callback URL shown in the Supabase Google provider panel. It normally looks like https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback.

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
