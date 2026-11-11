# CareerOS Supabase recovery and redeployment

This repository is the source of truth for CareerOS application code and database schema. The hosted Supabase project is replaceable; do not treat it as the only copy of the schema.

## What is preserved in Git

- `supabase/migrations/`: ordered, replayable SQL migrations.
- `supabase/schema.sql`: readable schema reference snapshot. Migrations are the deployment source of truth.
- `supabase/config.toml`: local Supabase CLI configuration, with no secrets.
- `.env.example`: names of application environment variables only; never put real values here.

## Recreate a fresh Supabase project

1. Create a new project in the required region and securely save its database password.
2. Install the Supabase CLI (this repo's CI pins CLI 3.1.0; update deliberately after reviewing CLI migration notes).
3. Authenticate: `supabase login`.
4. Link the fresh project: `supabase link --project-ref <PROJECT_REF>`. Set `SUPABASE_DB_PASSWORD` in the environment when running non-interactively.
5. Preview pending SQL: `supabase db push --dry-run --remote`.
6. Apply the migration chain: `supabase db push --yes --remote`.
7. Confirm migration history: `supabase migration list --remote`.
8. Run `npm ci` and `npm run verify:live` after setting the required environment variables.

Do not run `supabase db reset --remote` against production. It is destructive. Use it only against an explicitly disposable development project.

## Migration baseline

`20261101000000_initial_schema.sql` is the version-controlled baseline copied from the checked-in `supabase/schema.sql`. The existing refundable quota migration runs after it. Do not edit an already-applied migration; create a new timestamped migration for future schema changes.

## GitHub Actions deployment

The workflow `.github/workflows/supabase-deploy.yml` is manual-only and requires a deliberate checkbox confirmation. Configure these repository Actions secrets:

- `SUPABASE_ACCESS_TOKEN`: Supabase personal access token for the deployment identity.
- `SUPABASE_PROJECT_REF`: target project ref.
- `SUPABASE_DB_PASSWORD`: target database password.

Use a GitHub Environment named `production` with required reviewers before enabling this workflow for a production database. Do not put service-role keys or provider secrets in this workflow; it only applies SQL migrations.

## Application runtime secrets

Configure these in the Vercel project, not in Git:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never a `NEXT_PUBLIC_` variable)
- `GEMINI_API_KEY` (only when using managed AI; server-side only)
- Payment secrets remain disabled during the free pilot. Do not enable billing without a separate security and legal review.

After deployment, verify Auth redirect URLs and email confirmation settings in the Supabase Dashboard. OAuth provider secrets, SMTP credentials, rate limits, CAPTCHA, custom SMTP templates, and production URLs are platform-level settings and must be reconfigured explicitly; the SQL migration cannot recreate those provider credentials.

## Data recovery boundary

The repository contains schema and application code, not user records, uploaded files, Auth users, OAuth credentials, SMTP settings, or provider billing configuration. Before deleting any old project, export and retain data that must be preserved. A fresh project created from migrations is an empty application database; it does not restore old users or workspace payloads.

## Rollback and recovery

- Before each production migration, take a database backup using the Supabase platform backup/export facilities available on the selected plan.
- Prefer forward-only corrective migrations over manually editing migration history.
- Keep a separate staging project for destructive migration tests.
- If a migration fails, inspect the exact SQL error and remote migration list; do not blindly mark it applied.
