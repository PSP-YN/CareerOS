export default async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const url=process.env.SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!service)return res.status(200).json({questions:[]});
  try{
    const upstream=await fetch(url+'/rest/v1/interview_questions?select=round,question,rubric,difficulty&is_active=eq.true&order=created_at.desc&limit=300',{headers:{apikey:service,Authorization:'Bearer '+service}});
    if(!upstream.ok)return res.status(200).json({questions:[]});
    const questions=await upstream.json();
    return res.status(200).json({questions:Array.isArray(questions)?questions:[]});
  }catch{return res.status(200).json({questions:[]});}
}