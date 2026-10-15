// StudySpire hosted tutor: optional Cloudflare Workers AI, server-only credentials.
// Legitimate project-level free allowance is shared; StudySpire quotas are per profile.
// No account creation, provider token, or provider credit is issued to students.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const respond=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const fail=(status:number,code:string,message:string)=>respond(status,{ok:false,code,message});
const SYSTEM_POLICY=[
 "You are StudySpire, an accurate, encouraging study tutor for secondary-school students.",
 "Teach concepts and problem-solving methods. For an apparent school assignment, give a useful first hint and ask the student to try the next step rather than providing a submission-ready answer.",
 "Explain a similar worked example with different details when beneficial. Help check attempted work and explain mistakes.",
 "Never fabricate facts, quotations or sources. Never request passwords or private identifying information.",
 "Keep the response helpful, age-appropriate, and concise. Avoid unnecessary personal information."
].join(" ");
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return fail(405,"METHOD","POST required.");
 const url=Deno.env.get("SUPABASE_URL")||"";
 const publishable=Deno.env.get("SUPABASE_ANON_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!publishable||!service)return fail(503,"BACKEND_UNAVAILABLE","Hosted tutor authentication is not configured.");
 const auth=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(auth))return fail(401,"SIGN_IN","Sign in to StudySpire Cloud.");
 const token=auth.replace(/^Bearer\s+/i,"");
 try{
  const userResult=await fetch(url+"/auth/v1/user",{headers:{"apikey":publishable,"Authorization":"Bearer "+token},signal:AbortSignal.timeout(10000)});
  const user=userResult.ok?await userResult.json().catch(()=>null):null;
  if(!userResult.ok||!user?.id)return fail(401,"SIGN_IN","Cloud session expired. Sign in again.");
  const own=await fetch(url+"/rest/v1/rpc/ss_ai_status",{
   method:"POST",headers:{"apikey":publishable,"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:"{}",signal:AbortSignal.timeout(10000)
  });
  if(!own.ok)return fail(403,"ACCOUNT_UNAVAILABLE","This StudySpire account cannot use hosted AI.");
  const status=await own.json().catch(()=>null);
  if(!status?.profile_id)return fail(403,"ACCOUNT_UNAVAILABLE","Account verification failed.");
  const cfToken=Deno.env.get("CLOUDFLARE_AI_TOKEN")||"";
  const cfAccount=Deno.env.get("CLOUDFLARE_ACCOUNT_ID")||"";
  if(!cfToken||!/^[a-f0-9]{32}$/i.test(cfAccount))
   return fail(503,"NOT_CONFIGURED","Hosted AI has not been activated by a project administrator. Browser AI is still free.");
  if(Number(req.headers.get("content-length")||0)>15000)return fail(413,"TOO_LARGE","Please shorten your question.");
  const body=await req.json().catch(()=>null);
  if(!body||!Array.isArray(body.messages)||body.messages.length>14)return fail(400,"BAD_REQUEST","Provide a recent conversation (up to 14 messages).");
  const turns:{role:"user"|"assistant";content:string}[]=[];
  for(const message of body.messages){
   if(!message||!["user","assistant","system","developer"].includes(message.role))return fail(400,"BAD_REQUEST","Invalid conversation role.");
   if(Array.isArray(message.content)){
    if(message.content.some((part:unknown)=>typeof part==="object"&&part!==null&&((part as {type?:string}).type!=="text")))
      return fail(422,"TEXT_ONLY","This hosted model cannot read uploaded images. Type the worksheet question instead.");
    message.content=message.content.map((part:{text?:string})=>String(part?.text||"")).join("\n");
   }
   if(typeof message.content!=="string")return fail(400,"BAD_REQUEST","Question text is required.");
   if(message.role==="user"||message.role==="assistant")
    turns.push({role:message.role,content:message.content.slice(0,2500)});
  }
  if(!turns.length||turns[turns.length-1].role!=="user"||
     turns.some(m=>!m.content.trim())||turns.reduce((n,m)=>n+m.content.length,0)>9000)
   return fail(400,"BAD_REQUEST","Please enter a shorter study question.");
  const claimed=await fetch(url+"/rest/v1/rpc/ss_ai_claim_for",{
   method:"POST",headers:{"apikey":service,"Authorization":"Bearer "+service,"Content-Type":"application/json"},
   body:JSON.stringify({for_profile:status.profile_id}),signal:AbortSignal.timeout(10000)
  });
  if(!claimed.ok)return fail(503,"QUOTA_UNAVAILABLE","Hosted tutor quota check failed.");
  const limit=await claimed.json().catch(()=>null);
  if(!limit?.ok)return fail(429,String(limit?.code||"DAILY_LIMIT"),
    limit?.code==="STUDENT_LIMIT"?"You've used your StudySpire hosted questions today. Try free browser AI.":"The site's free hosted AI allowance is in use. Try free browser AI.");
  const model="@cf/meta/llama-3.1-8b-instruct-fp8";
  const outputTokens=Math.min(450,Math.max(90,Number(body.maxTokens)||220));
  const provider=await fetch("https://api.cloudflare.com/client/v4/accounts/"+cfAccount+"/ai/run/"+model,{
   method:"POST",headers:{"Authorization":"Bearer "+cfToken,"Content-Type":"application/json"},
   body:JSON.stringify({messages:[{role:"system",content:SYSTEM_POLICY},...turns.slice(-8)],max_tokens:outputTokens,temperature:0.35}),
   signal:AbortSignal.timeout(30000)
  });
  if(provider.status===429)return fail(429,"PROVIDER_LIMIT","Cloudflare's free AI allowance or rate limit has been reached. Try free browser AI.");
  if(!provider.ok)return fail(502,"PROVIDER_UNAVAILABLE","Hosted AI is temporarily unavailable. Try free browser AI.");
  const result=await provider.json().catch(()=>null);
  const answer=result?.result?.response;
  if(result?.success!==true||typeof answer!=="string"||!answer.trim())
   return fail(502,"EMPTY_RESPONSE","Hosted AI returned no explanation. Try free browser AI.");
  return respond(200,{ok:true,answer:answer.slice(0,9000),provider:"Cloudflare Workers AI",remaining:limit.remaining,siteRemaining:limit.site_remaining});
 }catch(error){
  if(error instanceof DOMException&&error.name==="TimeoutError")return fail(504,"TIMEOUT","Hosted tutor request timed out. Try free browser AI.");
  return fail(503,"UNAVAILABLE","Hosted tutor unavailable. Try free browser AI.");
 }
});
