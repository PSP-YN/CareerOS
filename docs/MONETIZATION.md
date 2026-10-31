# CareerOS monetization and launch model

## Positioning
India-first career transition workspace for university students, fresh graduates and early-career professionals changing roles. Sell clarity, execution and evidence management—not guaranteed placement.

## Proposed pricing
- Explore: ₹0, lifetime free. Core profile, skills, roadmap, interview practice and application tracker. Guest data is browser-local. Ads may appear on public educational pages after AdSense approval, not in the signed-in workspace.
- Pro: ₹299/month. Cloud sync, multiple target-role plans, exports and expanded AI allowance.
- Career Plus: ₹699/month. Higher AI allowance, deeper practice and portfolio/resume review workflows.
These are proposed prices and must be validated with user interviews and unit economics before public billing.

## Revenue streams
1. Subscriptions (primary): recurring Pro and Career Plus plans.
2. Contextual display ads (secondary): public learning guides and free public content only, after AdSense approval and required consent configuration.
3. Campus / placement-cell licences (later): cohort dashboards and admin reporting only after privacy, access control and institutional procurement needs are understood.
4. Career services marketplace (later): vetted human resume reviewers or mentors with transparent fees and conflict disclosures.

## Unit economics guardrails
- AI quota is enforced server-side per user/day. Current free quota is 10 requests/day; adjust only after measuring Gemini cost and abuse.
- Pro and Career Plus quota differentiation is planned in the application, but subscription entitlements need to be activated only from verified Razorpay webhooks.
- Do not offer unlimited AI at a fixed low monthly price.
- Track paid conversion, monthly recurring revenue, churn, AI cost per active user, gross margin, refund rate and support time.
- Keep ad impressions away from core task controls; do not trade trust or task completion for ad inventory.

## Payment integration
The repository includes a Razorpay subscription flow. Configure these Vercel environment variables:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_PRO_PLAN_ID
- RAZORPAY_PLUS_PLAN_ID
- RAZORPAY_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY (server-only)
Create two monthly plans in Razorpay with amounts ₹299 and ₹699. Configure webhook URL:
https://careeros-intelligence.vercel.app/api/razorpay-webhook
Subscribe to:
subscription.activated, subscription.charged, subscription.halted, subscription.cancelled, subscription.completed, subscription.paused, subscription.resumed.
Do not enable paid checkout until test-mode orders, signature verification, webhook activation, cancellation and failed-payment flows have been tested. Switch to live keys only after merchant KYC and policy review.

## Advertising
Google AdSense approval and publisher/ad-slot IDs are required. Do not serve ads before approval. After approval:
- add publisher ID and public-page slot IDs to Vercel as ADSENSE_CLIENT_ID, ADSENSE_HOME_SLOT_ID and ADSENSE_GUIDE_SLOT_ID;
- publish the exact ads.txt line provided by AdSense;
- enable Google's consent messaging / certified CMP where required;
- update Privacy Policy and cookie/consent disclosures;
- keep ads on public content pages, not in private career data screens.
No AdSense publisher ID or ad slot has been invented in this repository.

## Launch gates
- Google OAuth tested on production domain.
- Supabase RLS test with two separate accounts.
- Workspace export and account deletion flow.
- Gemini quota and abuse tests.
- Razorpay test-mode checkout, webhooks, cancellations and refunds.
- AdSense approval and consent configuration before ads.
- Final privacy/terms review with the operator's legal identity and contact details.
- Accessibility, mobile, performance and security review.
