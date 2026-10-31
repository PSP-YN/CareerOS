# CareerOS — Career intelligence, with a plan

CareerOS is a career pivot coach for PS 05. It connects a target role, self-assessed skills, job-description signals, a prioritized roadmap, interview practice, and an application tracker.

## Features
- Responsive career workspace with profile and skill self-assessment.
- Explainable, directional readiness diagnostic and priority skill gaps.
- Local keyword extraction from job descriptions supplied by the user.
- 11-step career roadmap with completion tracking and gap prioritization.
- Behavioral, technical, and HR interview question sets.
- Deterministic answer feedback with an optional, explicit-consent Gemini enhancement.
- Application tracker.
- Browser-local persistence; no account or cross-device sync.

## Run locally
The frontend has no build dependencies:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173. The optional `/api/coach` function requires Vercel's serverless runtime. Without a configured Gemini key, local feedback still works.

## Deploy
1. Import `PSP-YN/CareerOS` into Vercel.
2. Use the repository root as the project root. No build command or output directory is required.
3. Set `GEMINI_API_KEY` in Vercel Project Settings → Environment Variables only if you want the optional Gemini coach.
4. Redeploy after setting the key.
5. Verify the live site, profile save, JD keyword extraction, roadmap progress, interview rubric, application tracker, and (if configured) the consent-gated AI endpoint.

## Privacy and limitations
Candidate data stays in this browser unless the user explicitly opts to send an interview answer to the AI coach. The AI endpoint forwards the selected context to Google's Gemini API. Do not enter sensitive personal data. No authentication, cloud sync, database, live job-market feed, or hiring prediction is implemented. The readiness score and interview rubric are advisory diagnostics, not validated hiring assessments.

See [product scope](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), and [demo script](docs/DEMO_SCRIPT.md).
