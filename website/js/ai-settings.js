(() => {
  const PROVIDERS = {
    gemini: 'gemini-3.8-flash',
    openai: 'gpt-4.1-mini',
    openrouter: 'openai/gpt-4.1-mini',
    anthropic: 'claude-3-7-sonnet-latest',
    groq: 'llama-3.3-70b-versatile',
    mistral: 'mistral-small-latest'
  };
  const $ = id => document.getElementById(id);
  const provider = $('aiProvider');
  const model = $('aiModel');
  const key = $('aiApiKey');
  const status = $('aiSettingsStatus');
  if (!provider || !model || !key) return;

  const storage = window.sessionStorage;
  provider.value = storage.getItem('careeros.ai.provider') || 'gemini';
  model.value = storage.getItem('careeros.ai.model') || PROVIDERS[provider.value] || PROVIDERS.gemini;
  key.value = storage.getItem('careeros.ai.key') || '';
  status.textContent = key.value ? 'Personal provider key is available in this browser tab.' : 'No personal API key configured. CareerOS free AI is selected.';
  function updateConsentText() {
    const byok = !!storage.getItem('careeros.ai.key');
    const copy = byok
      ? 'I consent to send the selected context to my chosen AI provider using my own API key. Provider data handling, quotas and costs apply.'
      : 'I confirm I removed personal, sensitive, confidential and proprietary details. I consent to send this generalized context to CareerOS hosted Gemini. Google may use unpaid-tier prompts/responses to improve products and human reviewers may process them.';
    ['careerAiConsent','roadmapAiConsent','aiConsent'].forEach(id => {
      const checkbox = $(id);
      const label = checkbox?.closest('label');
      if (!label) return;
      [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
      label.append(document.createTextNode(' ' + copy));
    });
  }
  updateConsentText();

  provider.addEventListener('change', () => {
    const saved = storage.getItem('careeros.ai.model');
    model.value = saved || PROVIDERS[provider.value] || '';
    storage.setItem('careeros.ai.provider', provider.value);
    status.textContent = key.value ? 'Provider changed. Confirm model and key are correct.' : 'Provider changed. Add your API key to use this provider.';
  });
  model.addEventListener('input', () => storage.setItem('careeros.ai.model', model.value.trim()));
  $('saveAiSettings')?.addEventListener('click', () => {
    if (!key.value.trim()) {
      status.textContent = 'Paste your API key first. The key is not uploaded until you request a review.';
      return;
    }
    if (key.value.trim().length > 500 || /[\\r\\n]/.test(key.value)) {
      status.textContent = 'That key format is invalid.';
      return;
    }
    storage.setItem('careeros.ai.provider', provider.value);
    storage.setItem('careeros.ai.model', model.value.trim());
    storage.setItem('careeros.ai.key', key.value.trim());
    status.textContent = 'Personal API key saved for this browser tab only. CareerOS does not store it in your account.';
    updateConsentText();
  });
  $('clearAiSettings')?.addEventListener('click', () => {
    storage.removeItem('careeros.ai.provider');
    storage.removeItem('careeros.ai.model');
    storage.removeItem('careeros.ai.key');
    key.value = '';
    provider.value = 'gemini';
    model.value = PROVIDERS.gemini;
    status.textContent = 'Personal API key removed from this tab.';
    updateConsentText();
  });

  window.CareerOSAISettings = {
    getProvider: () => storage.getItem('careeros.ai.provider') || 'gemini',
    getModel: () => storage.getItem('careeros.ai.model') || PROVIDERS[provider.value] || PROVIDERS.gemini,
    getApiKey: () => storage.getItem('careeros.ai.key') || ''
  };
})();
