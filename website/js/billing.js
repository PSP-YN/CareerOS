import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const status = document.getElementById('billingStatus');
const management = document.getElementById('subscriptionManagement');
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

function renderSubscription(messageText, row, session) {
  if (!management) return;
  management.replaceChildren();
  const paragraph = document.createElement('p');
  paragraph.className = 'small';
  paragraph.textContent = messageText;
  management.appendChild(paragraph);
  if (!row || !session) return;

  const label = document.createElement('p');
  label.className = 'small';
  const planName = row.plan === 'career_plus' ? 'Career Plus' : 'Pro';
  const endDate = row.current_end ? new Date(row.current_end).toLocaleDateString() : 'not available';
  label.textContent = planName + ' · ' + row.status + (row.current_end ? ' · current cycle ends ' + endDate : '');
  management.appendChild(label);

  if (row.status === 'active' && row.cancel_at_cycle_end) {
    const scheduled = document.createElement('p');
    scheduled.className = 'small';
    scheduled.textContent = 'Cancellation is scheduled. Your current plan remains active until the end of this billing cycle.';
    management.appendChild(scheduled);
  } else if (row.status === 'active' && row.current_end) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = 'Cancel at cycle end';
    cancel.addEventListener('click', async () => {
      if (!window.confirm('Schedule cancellation at the end of your current billing cycle? Your access remains active until then.')) return;
      cancel.disabled = true;
      cancel.textContent = 'Scheduling…';
      try {
        const { data: { session: current } } = await client.auth.getSession();
        if (!current?.access_token) throw new Error('Sign in again to manage your subscription.');
        const response = await fetch('/api/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + current.access_token },
          cache: 'no-store',
          body: JSON.stringify({ cancelAtCycleEnd: true })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Cancellation could not be scheduled.');
        message(result.message || 'Cancellation scheduled.');
        await refreshSubscriptionControls();
      } catch (error) {
        message(error.message || 'Cancellation could not be scheduled.');
        cancel.disabled = false;
        cancel.textContent = 'Cancel at cycle end';
      }
    });
    management.appendChild(cancel);
  }
}

async function refreshSubscriptionControls() {
  if (!client || !management) return;
  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) {
    renderSubscription('Sign in through your CareerOS workspace to view or manage a subscription.', null, null);
    return;
  }
  const { data, error } = await client.from('subscriptions')
    .select('plan,status,current_end,cancel_at_cycle_end')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    renderSubscription('Subscription status could not be loaded. Try again later.', null, session);
    return;
  }
  if (!data) {
    renderSubscription('No CareerOS subscription is linked to this account.', null, session);
    return;
  }
  renderSubscription('Your subscription is managed securely through CareerOS and Razorpay.', data, session);
}

async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Supabase configuration is incomplete.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase is not configured.');
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    await refreshSubscriptionControls();

    if (!config.billingEnabled) {
      message('Paid checkout is awaiting Razorpay merchant setup, plan IDs and server credentials. The free workspace remains available.');
      return;
    }
    ready = true;
    document.querySelectorAll('[data-plan]').forEach(button => {
      button.disabled = false;
      button.textContent = 'Choose plan →';
    });
    message('Subscriptions are available for signed-in users. Prices are shown in INR.');
  } catch {
    message('Paid checkout is not configured yet. The free CareerOS workspace remains available.');
  }
}

document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', async () => {
  if (!ready || !client) return;
  button.disabled = true;
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { window.location.href = '/app'; return; }
    const created = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ plan: button.dataset.plan })
    });
    const payload = await created.json();
    if (!created.ok) throw new Error(payload.error || 'Could not start checkout.');
    await loadCheckout();
    const options = {
      key: payload.keyId,
      subscription_id: payload.subscriptionId,
      name: 'CareerOS',
      description: payload.plan === 'career_plus' ? 'CareerOS Career Plus' : 'CareerOS Pro',
      image: window.location.origin + '/logo.svg',
      prefill: { email: payload.email, name: payload.name },
      theme: { color: '#176b52' },
      handler: async payment => {
        const verified = await fetch('/api/verify-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ ...payment, plan: payload.plan })
        });
        const result = await verified.json();
        if (!verified.ok) throw new Error(result.error || 'Payment verification failed.');
        message('Payment signature verified. Plan activation is confirmed after the Razorpay subscription webhook.');
        await refreshSubscriptionControls();
      },
      modal: { ondismiss: () => message('Checkout closed. No plan change was confirmed.') }
    };
    const checkout = new window.Razorpay(options);
    checkout.on('payment.failed', event => message(event.error?.description || 'Payment failed. No subscription was activated.'));
    checkout.open();
  } catch (error) {
    message(error.message || 'Checkout could not start.');
  } finally {
    button.disabled = false;
  }
}));

init();
