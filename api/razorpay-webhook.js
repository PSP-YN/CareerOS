import { createHmac, timingSafeEqual } from 'node:crypto';
export const config = { api: { bodyParser: false } };
async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end('Method not allowed'); }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL;
  if (!secret || !service || !url) return res.status(503).end('Webhook is not configured');
  try {
    const raw = await readRaw(req);
    const signature = req.headers['x-razorpay-signature'] || '';
    const expected = createHmac('sha256', secret).update(raw).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return res.status(400).end('Invalid signature');
    const event = JSON.parse(raw.toString('utf8'));
    const entity = event.payload?.subscription?.entity;
    if (!entity?.id) return res.status(200).json({ received: true, ignored: true });
    const statusMap = {
      'subscription.activated': 'active', 'subscription.charged': 'active',
      'subscription.halted': 'halted', 'subscription.cancelled': 'cancelled',
      'subscription.completed': 'completed', 'subscription.paused': 'paused',
      'subscription.resumed': 'active'
    };
    const status = statusMap[event.event];
    if (!status) return res.status(200).json({ received: true, ignored: true });
    const userId = entity.notes?.supabase_user_id;
    const plan = entity.notes?.plan;
    if (!userId || !['pro', 'career_plus'].includes(plan)) return res.status(200).json({ received: true, ignored: true });
    const row = {
      user_id: userId, razorpay_subscription_id: entity.id, plan, status,
      current_start: entity.current_start ? new Date(entity.current_start * 1000).toISOString() : null,
      current_end: entity.current_end ? new Date(entity.current_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const saved = await fetch(url + '/rest/v1/subscriptions?on_conflict=razorpay_subscription_id', {
      method: 'POST',
      headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(row)
    });
    if (!saved.ok) return res.status(503).end('Could not persist subscription event');
    return res.status(200).json({ received: true });
  } catch { return res.status(400).end('Invalid webhook payload'); }
}