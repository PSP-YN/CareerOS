# CareerOS

**CareerOS is a career decision and readiness platform that connects role choices, skill evidence, structured interview practice and job-search execution.**

[Explore CareerOS](https://careeros-intelligence.vercel.app) · [Open the workspace](https://careeros-intelligence.vercel.app/app) · [About the platform](https://careeros-intelligence.vercel.app/about)

## Our purpose

Career preparation is fragmented. People are expected to choose a direction, understand the skills a role requires, decide what to learn, demonstrate their ability, prepare for interviews and manage applications—often across disconnected tools.

CareerOS connects those activities in one workspace. The product thesis is that a candidate should be able to compare options, understand the evidence a role requires, identify skill gaps, rehearse a complete interview loop and learn from application outcomes without losing context between tools.

## The CareerOS experience

- **Decision Studio** — compare two career paths, job offers or learning options with transparent, user-controlled criteria and weights.
- **Skill intelligence** — assess current capabilities, compare them with target levels and identify priorities.
- **Actionable development** — turn a role goal into an editable learning and portfolio roadmap.
- **Resume Studio** — create an evidence-led resume from real experience, education, projects and skills.
- **Interview Lab** — use an expanded question bank across aptitude, coding, technical, system design, case study, behavioral and HR; run a structured 14-question mock across all seven rounds and review a round-level scorecard.
- **Opportunity tracking** — organise applications, stages, dates, notes and follow-ups.
- **Optional AI coaching** — request Gemini-powered career, roadmap and interview feedback when configured and explicitly enabled.
- **Personal workspace** — start in guest mode or sign in for private, account-based cloud synchronisation.

## Product differentiation hypothesis

1. **Decisions connected to execution.** Compare paths, map gaps, practise interviews and track applications in one continuous workflow.
2. **Evidence over assumptions.** A new workspace does not pretend that a user has skills, achievements or completed milestones they have not entered.
3. **Action over generic advice.** Recommendations should lead to a specific skill, milestone, work sample or next step.
4. **Transparency over inflated scores.** Readiness indicators are directional and explain their inputs; they are not hiring predictions.
5. **Privacy and user control.** AI assistance is opt-in, account data is access-controlled, and users remain responsible for the information they submit.

## Built for people at different career stages

CareerOS supports students building their first professional profile, graduates preparing for entry-level roles, professionals changing direction and candidates preparing for a more demanding interview process. Role templates provide a starting point; users can edit their skills, milestones and evidence to reflect their actual goals.

## Trust and product boundaries

CareerOS is a planning and practice platform—not a recruiter, placement agency or employer. It does not guarantee interviews, employment, salary outcomes or certification. Readiness indicators and deterministic interview rubrics are advisory rather than independently validated hiring assessments. Job-description analysis works on text supplied by the user and should be checked against current employer requirements.

Gemini coaching is optional. When a user explicitly requests a review and gives consent, the selected context is sent to Google's Gemini service. The application keeps the Gemini API key on the server; it must never be embedded in the public website.

CareerOS is currently in a free early-access pilot. No payment checkout is enabled. Gemini usage is subject to Google API quotas and the application's per-user daily limit.

## Strategy and launch documents

- [Competitive positioning](docs/COMPETITIVE_POSITIONING.md)
- [Startup launch and fundraising plan](docs/STARTUP_LAUNCH_AND_FUNDRAISING.md)
- [Automated QA and security report](QA_SECURITY_AUDIT_REPORT.md)

## Explore the platform

- [Product overview](https://careeros-intelligence.vercel.app/)
- [About CareerOS](https://careeros-intelligence.vercel.app/about)
- [Career pivot guide](https://careeros-intelligence.vercel.app/career-pivot-guide)
- [Plans and availability](https://careeros-intelligence.vercel.app/pricing)
- [Privacy notice](https://careeros-intelligence.vercel.app/privacy)
- [Terms of use](https://careeros-intelligence.vercel.app/terms)

## Company direction

Our goal is to make career development more structured, practical and accountable: one place to understand the destination, identify the work required, build credible evidence and manage the steps that follow.

**CareerOS — Decide with evidence. Prepare with purpose.**


## Gemini data-processing requirement

CareerOS sends candidate-specific context to Gemini only when `GEMINI_PAID_DATA_PROCESSING=true` is explicitly configured by the operator after confirming that the Google Cloud project has active billing. The server blocks Gemini requests by default. Do not enable this flag for an unpaid Gemini API project: Google's unpaid-service terms permit submitted prompts and responses to be used to improve Google products and allow human review, and instruct developers not to submit personal, sensitive, confidential or proprietary information. See the [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms).
