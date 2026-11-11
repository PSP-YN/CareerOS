# Supabase setup and redeployment

CareerOS can be redeployed to a **new Supabase project** without depending on the retired project reference. Keep the GitHub repository; the hosted Supabase project is replaceable infrastructure.

## 1. Create a Supabase project

Create a project in the required organization and region. Record its project reference, database password, Project URL, and publishable key. The project reference is not a secret; database passwords and secret keys are.

## 2. Apply version-controlled migrations

The canonical deployment path is Supabase CLI:

```bash
npm install
npx supabase --version
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The CLI prompts for the database password when required. For a fresh project, migrations under `supabase/migrations/` create the schema. Do not run `schema.sql` as well; it is retained as a readable schema snapshot for review and manual recovery, not as a second migration path.

For a local clean-room check:

```bash
npx supabase start
npx supabase db reset
npx supabase stop
```

Use a current Supabase CLI and Docker-compatible local environment. Verify the CLI's current flags with `npx supabase db push --help` before running in a changed CLI version.

## 3. Configure application environment variables

Set the following in Vercel for Production, Preview, and Development as appropriate:

| Variable | Purpose | Exposure |
|---|---|---|
| `SUPABASE_URL` | New project's HTTPS API URL | Public configuration |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key | Public configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged operations only | Secret |
| `GEMINI_API_KEY` | Optional server-side Gemini coaching | Secret |

Never put a service-role or secret key in browser code, client bundles, a `NEXT_PUBLIC_*` variable, Git, logs, or issue reports. Rotate any key that was exposed.

After configuring the new project URL and publishable key, redeploy the Vercel project.

## 4. Configure authentication providers

In Supabase Authentication:

- Set the Site URL to `https://careeros-intelligence.vercel.app`.
- Add `https://careeros-intelligence.vercel.app/**` and `http://localhost:4173/**` as redirect URLs.
- If enabling Google sign-in, configure the Google OAuth Web Client ID and Client Secret in Supabase only.
- Use the new project's callback URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
- Configure the matching authorised redirect URI in Google Cloud Console.

Do not reuse the old project's callback URL.

## 5. Optional CI deployment

The manual GitHub Actions workflow `.github/workflows/supabase-deploy.yml` deploys committed migrations to the project reference supplied through GitHub Actions secrets. Configure these repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Run it manually only after reviewing the migration diff and selecting the intended target. Use a protected GitHub Environment named `production` with required reviewers for production deployments. Do not place service-role keys in this workflow; migrations use the Supabase CLI and database password.

## 6. Verify after redeployment

1. Confirm all migrations are applied in Supabase.
2. Run Supabase Security and Performance Advisors and resolve relevant findings.
3. Verify RLS is enabled for every exposed table and anonymous access is denied.
4. Sign in with two separate test accounts; verify each account can read/write only its own workspace.
5. Verify AI quota reservation is atomic, server-only, and cannot be bypassed from the client.
6. Verify interview question administration is server-mediated and unauthenticated requests are rejected.
7. Verify Google sign-in, logout, expired sessions, refresh, and redirect allowlists.
8. Verify Vercel production configuration exposes only the publishable key and never a service-role key.
9. Run the production smoke workflow after Vercel is deployed.

## Data and account recovery

Migrations recreate the database schema and database-side functions; they do **not** restore user accounts, workspace records, OAuth provider credentials, secrets, billing provider state, uploaded objects, or historical analytics. Export/restore those separately before retiring an existing project if they must be retained. A redeployed empty database is not a recovery of old customer data.

## Current product boundaries

- Guest mode remains available and stores data in the current browser.
- Signed-in workspaces sync to `public.user_workspaces`.
- Gemini coaching is optional and server-side.
- Payment checkout is disabled in the current free pilot. Do not configure Razorpay until pricing, tax, refund, cancellation, webhook, and consumer disclosures have been reviewed.
