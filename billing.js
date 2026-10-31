import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const status = document.getElementById('billingStatus');
function message(value) { if (status) status.textContent = value; }
let client = null;
let ready = false;
async function loadCheckout() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Supabase configuration is incomplete.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase is not configured.');
    client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    if (!config.billingEnabled) {
      message('Paid checkout is awaiting Razorpay merchant setup and plan configuration. You can still use the free workspace.');
      return;
    }
    ready = true;
    document.querySelectorAll('[data-plan]').forEach(button => { button.disabled = false; button.textContent = 'Choose plan →'; });
    message('Subscriptions are available for signed-in users. Prices are shown in INR.');
  } catch { message('Paid checkout is not configured yet. The free CareerOS workspace remains available.'); }
}
document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', async () => {
  if (!ready || !client) return;
  button.disabled = true;
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { window.location.href = '/app'; return; }
    const created = await fetch('/api/create-subscription', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ plan: button.dataset.plan })
    });
    const payload = await created.json();
    if (!created.ok) throw new Error(payload.error || 'Could not start checkout.');
    await loadCheckout();
    const options = {
      key: payload.keyId, subscription_id: payload.subscriptionId,
      name: 'CareerOS', description: payload.plan === 'career_plus' ? 'CareerOS Career Plus' : 'CareerOS Pro',
      image: window.location.origin + '/logo.svg',
      prefill: { email: payload.email, name: payload.name },
      theme: { color: '#176b52' },
      handler: async response => {
        const verified = await fetch('/api/verify-subscription', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ ...response, plan: payload.plan })
        });
        const result = await verified.json();
        if (!verified.ok) throw new Error(result.error || 'Payment verification failed.');
        message('Payment signature verified. Plan activation is confirmed after the Razorpay subscription webhook.');
      },
      modal: { ondismiss: () => message('Checkout closed. No plan change was confirmed.') }
    };
    const checkout = new window.Razorpay(options);
    checkout.on('payment.failed', event => message(event.error?.description || 'Payment failed. No subscription was activated.'));
    checkout.open();
  } catch (error) { message(error.message || 'Checkout could not start.'); }
  finally { button.disabled = false; }
}));
init();