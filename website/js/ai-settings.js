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

  provider.addEventListener('change', () => {
    storage.setItem('careeros.ai.provider', provider.value);
    model.value = storage.getItem(modelKey(provider.value)) || PROVIDERS[provider.value] || '';
    key.value = storage.getItem(apiKeyName(provider.value)) || '';
    status.textContent = key.value ? 'Loaded the key saved for this provider in this tab.' : 'No key saved for this provider. Add one to use BYOK.';
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
  });
  $('clearAiSettings')?.addEventListener('click', () => {
    storage.removeItem(apiKeyName(provider.value));
    storage.removeItem('careeros.ai.key');
    key.value = '';
    status.textContent = 'Personal API key removed for this provider in this tab.';
  });

  window.CareerOSAISettings = {
    getProvider: () => storage.getItem('careeros.ai.provider') || 'gemini',
    getModel: () => storage.getItem(modelKey(provider.value)) || PROVIDERS[provider.value] || PROVIDERS.gemini,
    getApiKey: () => storage.getItem(apiKeyName(provider.value)) || ''
  };
})();
