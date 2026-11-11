# CareerOS Supabase recovery and redeployment

This repository is the source of truth for CareerOS application code and database schema. The hosted Supabase project is replaceable; do not treat it as the only copy of the schema.

## What is preserved in Git

- `supabase/migrations/`: ordered, replayable SQL migrations.
- `supabase/schema.sql`: readable schema reference snapshot. Migrations are the deployment source of truth.
- `supabase/config.toml`: local Supabase CLI configuration, with no secrets.
- `.env.example`: names of application environment variables only; never put real values here.

## Validate the repository before redeployment

Run the same clean-room validation used by GitHub Actions:

```bash
npm run check
supabase start
supabase db reset
supabase migration list
supabase stop --no-backup
```

The workflow `.github/workflows/supabase-validate.yml` runs application checks and rebuilds a fresh local Supabase database from all checked-in migrations. It requires Docker and does not connect to or modify a hosted project.

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

## Vercel application environment

The Supabase project restores the database schema; the CareerOS API routes and frontend are deployed separately to Vercel. Configure the following in the Vercel project after creating the new Supabase project:

| Variable | Where used | Handling |
|---|---|---|
| `SUPABASE_URL` | Frontend config and server API routes | Public project URL; validate HTTPS and project host |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Browser client and server-side user-token validation | Public key only; RLS remains mandatory |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side API routes for privileged operations | Secret; never expose through browser config or `NEXT_PUBLIC_*` |
| `GEMINI_API_KEY` | Managed AI provider | Secret; keep server-side |
| `GEMINI_PAID_DATA_PROCESSING` | Live integration safety gate | Keep `false` until paid-tier status and Google data terms are verified; set `true` only after that review |
| `ADSENSE_CLIENT_ID`, `ADSENSE_HOME_SLOT_ID`, `ADSENSE_GUIDE_SLOT_ID` | Optional ads | Leave empty unless the publisher account and consent requirements are ready |
| `RAZORPAY_*` | Payment integration placeholders | Leave unset while `billingEnabled=false`; do not enable payment collection until checkout, webhook signature verification, idempotency, refunds, tax and legal review are complete |

Use the checked-in `.env.example` as a variable-name reference only. Never copy real credentials into Git, build output, client-side code or issue comments.

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
