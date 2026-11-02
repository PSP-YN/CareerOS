// Server-only helpers for atomic hosted AI quota reservations.
// The database remains authoritative; clients never call these RPCs directly.
export async function reserveHostedQuota({ supabaseUrl, serviceKey, userId, fetchImpl = fetch }) {
  const response = await fetchImpl(supabaseUrl + '/rest/v1/rpc/reserve_careeros_ai_quota', {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId, p_daily_limit: 2 })
  });
  if (!response.ok) throw new Error('Quota reservation RPC returned HTTP ' + response.status);
  const usageDate = await response.json();
  return typeof usageDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(usageDate) ? usageDate : null;
}

export async function releaseHostedQuota({ supabaseUrl, serviceKey, userId, usageDate, fetchImpl = fetch }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(usageDate || ''))) throw new Error('Invalid quota usage date');
  const response = await fetchImpl(supabaseUrl + '/rest/v1/rpc/release_careeros_ai_quota', {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId, p_usage_date: usageDate })
  });
  if (!response.ok) throw new Error('Quota release RPC returned HTTP ' + response.status);
  return (await response.json()) === true;
}
