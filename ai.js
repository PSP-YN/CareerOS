(() => {
  const button = document.getElementById('evaluate');
  const consent = document.getElementById('aiConsent');
  const feedback = document.getElementById('feedback');
  if (!button || !consent || !feedback) return;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  button.addEventListener('click', async () => {
    if (!consent.checked) return;
    const answer = document.getElementById('answer').value.trim();
    if (answer.length < 30) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Asking AI coach…';
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          task: 'interview_feedback',
          context: {
            role: document.getElementById('role').value.trim(),
            question: document.getElementById('question').textContent,
            answer
          }
        })
      });
      if (!response.ok) throw new Error(response.status === 503 ? 'Gemini is not configured on this deployment. The local feedback remains available.' : 'AI feedback is temporarily unavailable.');
      const payload = await response.json();
      const result = payload.result || {};
      const actions = Array.isArray(result.next_actions) ? result.next_actions : [];
      const summary = escapeHTML(result.summary || 'No additional summary returned.');
      feedback.insertAdjacentHTML('beforeend',
        '<div class="notice"><strong>Gemini AI coach · Advisory feedback</strong><p>' + summary + '</p>' +
        (actions.length ? '<ul>' + actions.slice(0, 5).map(x => '<li>' + escapeHTML(x) + '</li>').join('') + '</ul>' : '') +
        '<p>AI feedback may be inaccurate. Verify it against your actual experience.</p></div>');
    } catch (error) {
      feedback.insertAdjacentHTML('beforeend', '<p class="small">' + escapeHTML(error.message || 'AI feedback unavailable.') + '</p>');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
})();