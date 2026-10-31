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
      const token = await window.CareerOSAuth?.getAccessToken();
      if (!token) throw new Error('Sign in with Google to use the optional AI coach.');
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        cache: 'no-store',
        body: JSON.stringify({
          task: 'interview_feedback',
          context: {
            role: document.getElementById('role').value.trim(),
            round: document.getElementById('qtype').value,
            question: document.getElementById('question').textContent,
            answer
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AI feedback is temporarily unavailable.');
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