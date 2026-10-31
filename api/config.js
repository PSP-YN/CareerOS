export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return res.status(503).json({ error: 'Supabase is not configured.' });
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      return res.status(500).json({ error: 'Invalid Supabase project URL.' });
    }
  } catch { return res.status(500).json({ error: 'Invalid Supabase project URL.' }); }
  const billingEnabled = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_PRO_PLAN_ID && process.env.RAZORPAY_PLUS_PLAN_ID);
  const adsenseClientId = process.env.ADSENSE_CLIENT_ID || '';\n  const adsenseHomeSlotId = process.env.ADSENSE_HOME_SLOT_ID || '';\n  const adsenseGuideSlotId = process.env.ADSENSE_GUIDE_SLOT_ID || '';\n  return res.status(200).json({ supabaseUrl, supabaseAnonKey, billingEnabled, adsenseClientId, adsenseHomeSlotId, adsenseGuideSlotId });
}