export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
        return res.status(500).json({ error: 'Invalid Supabase project URL.' });
      }
    } catch { return res.status(500).json({ error: 'Invalid Supabase project URL.' }); }
  }
  // Payments are intentionally disabled during the free early-access pilot.
  const billingEnabled = false;
  const adsenseClientId = process.env.ADSENSE_CLIENT_ID || '';
  const adsenseHomeSlotId = process.env.ADSENSE_HOME_SLOT_ID || '';
  const adsenseGuideSlotId = process.env.ADSENSE_GUIDE_SLOT_ID || '';
  return res.status(200).json({ supabaseUrl, supabaseAnonKey, billingEnabled, adsenseClientId, adsenseHomeSlotId, adsenseGuideSlotId });
}