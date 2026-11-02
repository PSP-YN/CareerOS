(() => {
  const PROVIDERS = {
    gemini: 'gemini-3.8-flash',
    openai: 'gpt-6-luna',
    openrouter: 'openai/gpt-6-luna',
    anthropic: 'claude-sonnet-4-5',
    groq: 'openai/gpt-oss-120b',
    mistral: 'mistral-large-latest'
  };
  const $ = id => document.getElementById(id);
  const provider = $('aiProvider');
  const model = $('aiModel');
  const key = $('aiApiKey');
  const status = $('aiSettingsStatus');
  if (!provider || !model || !key) return;

  const storage = window.sessionStorage;
  const modelKey = id => 'careeros.ai.model.' + id;
  const apiKeyName = id => 'careeros.ai.key.' + id;
  storage.removeItem('careeros.ai.key'); // Do not reuse legacy unscoped credentials.
  provider.value = storage.getItem('careeros.ai.provider') || 'gemini';
  model.value = storage.getItem(modelKey(provider.value)) || PROVIDERS[provider.value] || PROVIDERS.gemini;
  key.value = storage.getItem(apiKeyName(provider.value)) || '';
  status.textContent = key.value ? 'A personal key is available for ' + provider.options[provider.selectedIndex].text + ' in this browser tab.' : 'No personal API key configured. CareerOS free AI is selected.';
  function updateConsentCopy() {
    const hasPersonalKey = !!storage.getItem(apiKeyName(provider.value));
    const copy = hasPersonalKey
      ? 'I consent to send this selected context to my chosen AI provider using my own API key. Provider data handling, quotas and charges apply.'
      : 'I confirm I removed personal, sensitive, confidential and proprietary details. I consent to send generalized context to CareerOS hosted Gemini. Google may use unpaid-tier prompts/responses to improve products and human reviewers may process them.';
    ['careerAiConsent','roadmapAiConsent','aiConsent'].forEach(id => {
      const checkbox = $(id);
      const label = checkbox?.closest('label');
      if (!label) return;
      [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
      label.append(document.createTextNode(' ' + copy));
    });
  }
  updateConsentCopy();

  provider.addEventListener('change', () => {
    storage.setItem('careeros.ai.provider', provider.value);
    model.value = storage.getItem(modelKey(provider.value)) || PROVIDERS[provider.value] || '';
    key.value = storage.getItem(apiKeyName(provider.value)) || '';
    status.textContent = key.value ? 'Loaded the key saved for this provider in this tab.' : 'No key saved for this provider. Add one to use BYOK.';
    updateConsentCopy();
  });
  model.addEventListener('input', () => storage.setItem(modelKey(provider.value), model.value.trim()));
  $('saveAiSettings')?.addEventListener('click', () => {
    if (!key.value.trim()) {
      status.textContent = 'Paste your API key first. The key is not sent until you request a review.';
      return;
    }
    if (key.value.trim().length > 500 || /[\\r\\n]/.test(key.value)) {
      status.textContent = 'That key format is invalid.';
      return;
    }
    storage.setItem('careeros.ai.provider', provider.value);
    storage.setItem(modelKey(provider.value), model.value.trim());
    storage.setItem(apiKeyName(provider.value), key.value.trim());
    status.textContent = 'Personal key saved for ' + provider.options[provider.selectedIndex].text + ' in this tab only. CareerOS does not store it in your account.';
    updateConsentCopy();
  });
  $('clearAiSettings')?.addEventListener('click', () => {
    storage.removeItem(apiKeyName(provider.value));
    storage.removeItem('careeros.ai.key');
    key.value = '';
    status.textContent = 'Personal API key removed for this provider in this tab.';
    updateConsentCopy();
  });

  window.CareerOSAISettings = {
    getProvider: () => storage.getItem('careeros.ai.provider') || 'gemini',
    getModel: () => storage.getItem(modelKey(provider.value)) || PROVIDERS[provider.value] || PROVIDERS.gemini,
    getApiKey: () => storage.getItem(apiKeyName(provider.value)) || ''
  };
})();
