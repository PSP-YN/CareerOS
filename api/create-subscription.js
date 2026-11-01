async function getUser(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const response = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
  return response.ok ? response.json() : null;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const user = await getUser(req).catch(() => null);
  if (!user?.id || !user.email) return res.status(401).json({ error: 'Sign in with Google before subscribing.' });
  const plan = req.body?.plan;
  if (!['pro', 'career_plus'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid subscription plan.' });
  }
  const planMap = {
    pro: { id: process.env.RAZORPAY_PRO_PLAN_ID },
    career_plus: { id: process.env.RAZORPAY_PLUS_PLAN_ID }
  };
  const selected = planMap[plan];
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!selected?.id || !keyId || !keySecret) return res.status(503).json({ error: 'Paid checkout is not configured yet.' });
  try {
    const credentials = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const upstream = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + credentials, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: selected.id, total_count: 120, quantity: 1, customer_notify: true,
        notes: { supabase_user_id: user.id, plan, product: 'CareerOS' }
      })
    });
    const data = await upstream.json();
    if (!upstream.ok || !data.id) return res.status(502).json({ error: 'Payment provider could not create the subscription.' });
    return res.status(200).json({ subscriptionId: data.id, keyId, plan, email: user.email, name: user.user_metadata?.full_name || '' });
  } catch { return res.status(502).json({ error: 'Payment provider is temporarily unavailable.' }); }
}