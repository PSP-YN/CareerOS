const ROUNDS = new Set(['aptitude','coding','technical','system_design','case_study','behavioral','hr']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = (key) => ({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' });
async function authenticate(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !anon) return { error: 401 };
  const response = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
  if (!response.ok) return { error: 401 };
  const user = await response.json();
  if (user?.app_metadata?.role !== 'admin') return { error: 403 };
  return { user, url, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
}
function validate(input) {
  const round = String(input?.round || '');
  const question = String(input?.question || '').trim();
  const rubric = String(input?.rubric || '').trim();
  const difficulty = String(input?.difficulty || 'intermediate');
  if (!ROUNDS.has(round) || question.length < 20 || question.length > 2000 || rubric.length < 10 || rubric.length > 2000 || !['beginner','intermediate','advanced'].includes(difficulty)) return null;
  return { round, question, rubric, difficulty, is_active: input?.is_active !== false };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (!['GET','POST','PATCH','DELETE'].includes(req.method)) { res.setHeader('Allow','GET, POST, PATCH, DELETE'); return res.status(405).json({error:'Method not allowed'}); }
  try {
    const auth = await authenticate(req);
    if (auth.error) return res.status(auth.error).json({error:auth.error===403?'Administrator access required.':'Sign in again.'});
    if (!auth.service) return res.status(503).json({error:'Admin API is not configured.'});
    const base = auth.url + '/rest/v1/interview_questions';
    if (req.method === 'GET') {
      const upstream = await fetch(base+'?select=id,round,question,rubric,difficulty,is_active,created_at&order=created_at.desc&limit=500',{headers:headers(auth.service)});
      const data = await upstream.json().catch(()=>[]);
      if (!upstream.ok) return res.status(503).json({error:'Question bank is not installed. Apply the CareerOS schema update.'});
      return res.status(200).json({questions:data});
    }
    const input = req.body && typeof req.body === 'object' ? req.body : {};
    if (req.method === 'POST') {
      const record = validate(input);
      if (!record) return res.status(400).json({error:'Provide a valid round, question, rubric and difficulty.'});
      const upstream = await fetch(base,{method:'POST',headers:{...headers(auth.service),Prefer:'return=representation'},body:JSON.stringify({...record,created_by:auth.user.id})});
      const data = await upstream.json().catch(()=>[]);
      if (!upstream.ok) return res.status(502).json({error:'Could not save the question. Check that the question-bank schema is installed.'});
      return res.status(201).json({question:data[0]});
    }
    if (!UUID.test(String(input.id||''))) return res.status(400).json({error:'A valid question ID is required.'});
    if (req.method === 'DELETE') {
      const upstream = await fetch(base+'?id=eq.'+encodeURIComponent(input.id),{method:'DELETE',headers:headers(auth.service)});
      if (!upstream.ok) return res.status(502).json({error:'Could not delete the question.'});
      return res.status(200).json({deleted:true});
    }
    const patch = {};
    if (input.is_active !== undefined) patch.is_active = !!input.is_active;
    if (input.question !== undefined || input.rubric !== undefined || input.round !== undefined || input.difficulty !== undefined) {
      const checked = validate({...input, round:input.round || 'aptitude', question:input.question || 'Placeholder question text that must be replaced', rubric:input.rubric || 'Placeholder evaluation rubric', difficulty:input.difficulty || 'intermediate'});
      if (!checked) return res.status(400).json({error:'Invalid question update.'});
      for (const key of ['round','question','rubric','difficulty']) if (input[key] !== undefined) patch[key]=checked[key];
    }
    patch.updated_at = new Date().toISOString();
    const upstream = await fetch(base+'?id=eq.'+encodeURIComponent(input.id),{method:'PATCH',headers:{...headers(auth.service),Prefer:'return=representation'},body:JSON.stringify(patch)});
    const data = await upstream.json().catch(()=>[]);
    if (!upstream.ok || !data[0]) return res.status(502).json({error:'Could not update the question.'});
    return res.status(200).json({question:data[0]});
  } catch {
    return res.status(502).json({error:'Question administration is temporarily unavailable.'});
  }
}