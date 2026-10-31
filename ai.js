(() => {
  function showFeedback(target, heading, result) {
    target.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'notice';
    const title = document.createElement('strong');
    title.textContent = heading;
    panel.appendChild(title);
    const summary = document.createElement('p');
    summary.textContent = result.summary || 'No summary was returned.';
    panel.appendChild(summary);
    const actions = Array.isArray(result.next_actions) ? result.next_actions : [];
    if (actions.length) {
      const list = document.createElement('ul');
      for (const item of actions.slice(0, 5)) {
        const li = document.createElement('li');
        li.textContent = String(item);
        list.appendChild(li);
      }
      panel.appendChild(list);
    }
    const caveats = Array.isArray(result.caveats) ? result.caveats : [];
    if (caveats.length) {
      const note = document.createElement('p');
      note.className = 'small';
      note.textContent = caveats.slice(0, 4).join(' ');
      panel.appendChild(note);
    }
    const disclaimer = document.createElement('p');
    disclaimer.className = 'small';
    disclaimer.textContent = 'AI output is advisory and may be inaccurate. Verify recommendations against your actual experience and target role.';
    panel.appendChild(disclaimer);
    target.appendChild(panel);
  }

  function attachReview({ buttonId, consentId, feedbackId, task, heading, getContext }) {
    const button = document.getElementById(buttonId);
    const consent = document.getElementById(consentId);
    const feedback = document.getElementById(feedbackId);
    if (!button || !consent || !feedback) return;

    button.addEventListener('click', async () => {
      if (!consent.checked) {
        feedback.textContent = 'Tick the consent box before sending this information to Gemini.';
        return;
      }
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Reviewing…';
      feedback.textContent = '';
      try {
        const token = await window.CareerOSAuth?.getAccessToken();
        if (!token) throw new Error('Sign in with Google to use the optional AI coach.');
        const response = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          cache: 'no-store',
          body: JSON.stringify({ task, context: getContext() })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'AI review is temporarily unavailable.');
        showFeedback(feedback, heading, payload.result || {});
      } catch (error) {
        feedback.textContent = error.message || 'AI review is unavailable.';
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  attachReview({
    buttonId: 'evaluate',
    consentId: 'aiConsent',
    feedbackId: 'feedback',
    task: 'interview_feedback',
    heading: 'Gemini interview feedback',
    getContext: () => ({
      role: document.getElementById('role')?.value.trim() || '',
      round: document.getElementById('qtype')?.value || 'behavioral',
      question: document.getElementById('question')?.textContent || '',
      answer: document.getElementById('answer')?.value.trim() || ''
    })
  });

  attachReview({
    buttonId: 'careerReview',
    consentId: 'careerAiConsent',
    feedbackId: 'careerReviewFeedback',
    task: 'career_review',
    heading: 'Gemini career direction review',
    getContext: () => {
      const state = window.CareerOSState?.get?.() || {};
      return {
        profile: state.profile || {},
        skills: Array.isArray(state.skills) ? state.skills : []
      };
    }
  });

  attachReview({
    buttonId: 'roadmapReview',
    consentId: 'roadmapAiConsent',
    feedbackId: 'roadmapReviewFeedback',
    task: 'roadmap_review',
    heading: 'Gemini roadmap review',
    getContext: () => ({
      profile: window.CareerOSState?.get?.()?.profile || {},
      skills: window.CareerOSState?.get?.()?.skills || [],
      milestones: window.CareerOSState?.getRoadmap?.() || []
    })
  });
})();
