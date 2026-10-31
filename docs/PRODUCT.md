# CareerOS product scope

## Problem
People changing careers often face an unclear path between their current capabilities and the requirements of a target role. Generic learning lists do not connect skills, evidence, practice, and applications.

## Product
CareerOS is a local-first career pivot coach. It gives a candidate a structured workspace to:
- define a target role, experience level, and timeline;
- assess role-related skills against configurable targets;
- extract skill keywords from a job description supplied by the user;
- prioritize an 11-step learning and evidence roadmap;
- practice behavioral, technical, and HR interview questions;
- track job applications and outcomes.

## Differentiation
The product emphasizes explainability and evidence. Its readiness score is a directional diagnostic based on self-reported skill levels, project evidence, and practice sessions. It is not an offer probability, employer assessment, or validated psychometric instrument.

## Current constraints
- Data is stored in browser localStorage; there is no authentication or cloud synchronization.
- Job-description analysis is local keyword extraction, not live job-board scraping or labour-market analytics.
- Interview feedback is a transparent heuristic. Optional Gemini feedback requires an owner-configured server-side API key and explicit per-answer opt-in.
- No hiring outcome is guaranteed.
