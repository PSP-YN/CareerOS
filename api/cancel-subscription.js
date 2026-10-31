async function getUser(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + '/auth/v1/user', {
    headers: { apikey: anon, Authorization: 'Bearer ' + token }
  });
  return response.ok ? response.json() : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUser(req).catch(() => null);
  if (!user?.id) return res.status(401).json({ error: 'Sign in again to manage your subscription.' });

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !service || !keyId || !keySecret) {
    return res.status(503).json({ error: 'Subscription management is not configured yet.' });
  }

  try {
    const lookup = await fetch(
      url + '/rest/v1/subscriptions?user_id=eq.' + encodeURIComponent(user.id) +
      '&status=eq.active&cancel_at_cycle_end=eq.false&select=razorpay_subscription_id,current_end,plan&order=updated_at.desc&limit=1',
      { headers: { apikey: service, Authorization: 'Bearer ' + service } }
    );
    if (!lookup.ok) return res.status(503).json({ error: 'Could not retrieve your subscription status.' });
    const rows = await lookup.json();
    const subscription = rows?.[0];
    if (!subscription?.razorpay_subscription_id) {
      return res.status(404).json({ error: 'No active subscription is available to cancel.' });
    }
    if (!subscription.current_end) {
      return res.status(409).json({ error: 'This subscription has no active billing-cycle end date. Contact support to manage it.' });
    }

    const credentials = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const provider = await fetch(
      'https://api.razorpay.com/v1/subscriptions/' +
      encodeURIComponent(subscription.razorpay_subscription_id) + '/cancel',
      {
        method: 'POST',
        headers: { Authorization: 'Basic ' + credentials, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_cycle_end: true })
      }
    );
    const result = await provider.json().catch(() => ({}));
    if (!provider.ok) {
      return res.status(502).json({ error: 'Razorpay could not schedule cancellation. No cancellation was confirmed.' });
    }

    const now = new Date().toISOString();
    const saved = await fetch(
      url + '/rest/v1/subscriptions?razorpay_subscription_id=eq.' +
      encodeURIComponent(subscription.razorpay_subscription_id),
      {
        method: 'PATCH',
        headers: {
          apikey: service,
          Authorization: 'Bearer ' + service,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ cancel_at_cycle_end: true, cancellation_requested_at: now, updated_at: now })
      }
    );
    if (!saved.ok) {
      return res.status(503).json({ error: 'Razorpay accepted the cancellation request, but CareerOS could not save its status. Contact support before retrying.' });
    }
    return res.status(200).json({
      scheduled: true,
      plan: subscription.plan,
      currentEnd: subscription.current_end,
      message: 'Cancellation is scheduled for the end of the current billing cycle. Your current plan remains active until then.'
    });
  } catch {
    return res.status(502).json({ error: 'Subscription cancellation could not be completed. Try again later.' });
  }
}
