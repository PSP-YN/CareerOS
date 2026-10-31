# CareerOS launch checklist

## Before inviting external users
- [ ] Run supabase/schema.sql in the correct Supabase project.
- [ ] Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel.
- [ ] Configure Google OAuth provider in Supabase and Google Cloud Console.
- [ ] Set Supabase Site URL and allowed redirects to the canonical domain.
- [ ] Test sign-in, sign-out, token refresh and workspace sync.
- [ ] Test RLS with two accounts and verify cross-account reads/writes fail.
- [ ] Set SUPABASE_SERVICE_ROLE_KEY in Vercel only; never expose it to browser code.
- [ ] Set GEMINI_API_KEY and test authenticated AI coaching and daily quota.
- [ ] Test API failures, oversized payloads, expired sessions and quota exhaustion.
- [ ] Complete data export and account deletion workflows before public commercial use.
- [ ] Configure Razorpay test-mode monthly plans and webhook.
- [ ] Test subscription activation, renewal, failed payment, cancellation, refund and webhook retries.
- [ ] Add merchant identity, support contact, final privacy policy, terms and refund/cancellation terms.
- [ ] Obtain AdSense approval and configure CMP/consent before enabling ads.
- [ ] Complete keyboard, screen-reader, mobile, performance and security testing.
- [ ] Verify backup, monitoring, incident response and support process.

## Before taking money
The current Privacy Policy and Terms are drafts. Fill in the legal operator's identity, business address, support contact, governing law, data retention and deletion process, tax treatment, subscription renewal, cancellation and refund terms. Obtain qualified legal/accounting review for the applicable Indian rules.

## Release process
- Merge reviewed changes to main.
- Confirm GitHub Actions passes.
- Wait for Vercel production deployment to become READY.
- Test the canonical domain, auth, API, database and checkout in test mode.
- Keep a rollback target from the previous known-good deployment.
