# Architecture

## Runtime
- Static responsive frontend: `index.html` (CSS and core UI logic embedded).
- Optional browser enhancement: `ai.js`.
- Serverless endpoint: `api/coach.js` (Vercel Node.js function).
- Hosting configuration: `vercel.json`.

## Data flow
1. Candidate profile, skills, roadmap progress, interview session counts, and application entries are stored in the current browser's localStorage.
2. Job description text is processed locally using a bounded keyword list. The application does not fetch or scrape job sites.
3. Interview answers are evaluated locally by a deterministic rubric by default.
4. If the candidate checks the AI-consent box, the answer and question are sent to `/api/coach`. The serverless function validates task and payload size, reads `GEMINI_API_KEY` from the server environment, calls Gemini, and returns bounded structured feedback.
5. No API key is exposed to browser JavaScript.

## Security controls
- Explicit opt-in before sending interview text to Gemini.
- Server-side secret only; no key in repository or browser.
- Allowlisted task names, object validation, context size cap, output field/type limits, no-store response headers, and request timeout.
- Basic browser security headers configured in Vercel.

## Production gaps
Authentication, multi-device synchronization, durable database storage, abuse/rate limiting, consent/audit records, accessibility audit, and independent security review are not implemented. Do not present this prototype as a fully hardened SaaS.
