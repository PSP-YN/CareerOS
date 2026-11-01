export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!url || !anon || !service || !token) {
    return res.status(503).json({ error: 'Account deletion is not configured. Contact support or try again later.' });
  }

  if (req.body?.confirmation !== 'DELETE MY CAREEROS ACCOUNT') {
    return res.status(400).json({ error: 'The account deletion confirmation phrase did not match.' });
  }

  try {
    const userResponse = await fetch(url + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'Your session is invalid. Sign in again.' });
    const user = await userResponse.json();
    if (!user?.id) return res.status(401).json({ error: 'A valid account is required.' });

    // Require a recently issued, Supabase-validated access token before a destructive action.
    const tokenPayload = token.split('.')[1];
    if (!tokenPayload) return res.status(401).json({ error: 'Please sign in again before deleting your account.' });
    let claims;
    try {
      claims = JSON.parse(Buffer.from(tokenPayload, 'base64url').toString('utf8'));
    } catch {
      return res.status(401).json({ error: 'Please sign in again before deleting your account.' });
    }
    const issuedAt = Number(claims.iat);
    if (!Number.isFinite(issuedAt) || Date.now() / 1000 - issuedAt > 15 * 60 || issuedAt > Date.now() / 1000 + 60) {
      return res.status(401).json({ error: 'For your protection, sign out and sign in again before deleting your account.' });
    }

    const deleted = await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(user.id), {
      method: 'DELETE',
      headers: { apikey: service, Authorization: 'Bearer ' + service }
    });
    if (!deleted.ok) {
      return res.status(502).json({ error: 'Supabase could not delete the account. Your data has not been confirmed deleted.' });
    }
    return res.status(200).json({ deleted: true, message: 'Your CareerOS account and associated workspace data were deleted.' });
  } catch {
    return res.status(502).json({ error: 'Account deletion could not be completed. Try again later.' });
  }
}
