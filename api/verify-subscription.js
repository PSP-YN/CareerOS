import { createHmac, timingSafeEqual } from 'node:crypto';
async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
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
  if (!user?.id) return res.status(401).json({ error: 'Sign in again to verify payment.' });
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification data is incomplete.' });
  }
  const expected = createHmac('sha256', secret).update(razorpay_payment_id + '|' + razorpay_subscription_id).digest();
  const supplied = Buffer.from(razorpay_signature, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }
  // The signed webhook is the sole authority for subscription activation and entitlements.
  return res.status(200).json({
    verified: true,
    status: 'webhook_pending',
    message: 'Payment signature verified. Your plan activates after the signed Razorpay webhook confirms it.'
  });
}