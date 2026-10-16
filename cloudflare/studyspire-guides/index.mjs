import {STUDY_GUIDES} from '../../studyspire-guide-catalog.mjs';

// Public, reviewed guides + an authenticated Workers AI tutor.
// Public guide requests send no student data and consume zero AI neurons.
// Generated tutoring requires a Supabase-authenticated StudySpire account.
const SUPABASE_URL='https://tcmlxpgomlfybgfdjeqj.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_oBcEtziurOtmQJ2fg5a9og_cLtXbyH9';
const MODEL='@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const VISION_MODEL='@cf/meta/llama-3.2-11b-vision-instruct';
const MAX_TUTOR_REQUEST=1000000;
const POLICY=[
  'You are StudySpire, an encouraging, accurate tutor for secondary-school students.',
  'Teach concepts and problem-solving methods. Give a hint first for school assignments rather than a submission-ready answer.',
  'Offer a similar example with different details. Check students\' own work and explain mistakes.',
  'Do not invent facts or sources. Avoid personal identifying information.',
  'Be concise, kind, and age-appropriate.'
].join(' ');
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':'no-store'
};
const publicHeaders={...cors,'Cache-Control':'public, max-age=3600'};
const json=(data,status=200,headers=cors)=>new Response(JSON.stringify(data),{status,headers});
const err=(status,code,message)=>json({ok:false,code,message},status);

async function aiTutor(request, env) {
  if(!env?.AI||typeof env.AI.run!=='function')
    return err(503,'AI_BINDING_MISSING','Workers AI binding is not deployed to this Cloudflare Worker yet.');
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(auth))return err(401,'SIGN_IN','StudySpire Cloud sign-in required.');
  if(Number(request.headers.get('content-length')||0)>MAX_TUTOR_REQUEST)
    return err(413,'TOO_LARGE','Image is too large after compression. Use a smaller worksheet image.');
  const body=await request.json().catch(()=>null);
  if(!body||JSON.stringify(body).length>MAX_TUTOR_REQUEST||!Array.isArray(body.messages)||body.messages.length>14)
    return err(400,'BAD_REQUEST','Provide up to 14 messages and an image under the upload limit.');
  const turns=[];
  let imageData=null;
  for(const item of body.messages){
    if(!item||!['system','developer','user','assistant'].includes(item.role))
      return err(400,'BAD_REQUEST','Invalid message role.');
    // Ignore untrusted system instructions; use only the server policy.
    if(item.role!=='user'&&item.role!=='assistant')continue;
    let content=item.content;
    if(Array.isArray(content)){
      if(item.role!=='user')return err(400,'BAD_REQUEST','Only user messages may include a picture.');
      const parts=[];
      for(const part of content){
        if(part?.type==='text'&&typeof part.text==='string'){parts.push(part.text);continue}
        if(part?.type==='image_url'&&typeof part.image_url?.url==='string'){
          if(imageData)return err(400,'BAD_REQUEST','Attach only one worksheet picture.');
          const url=part.image_url.url;
          if(!/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(url)||url.length>800000)
            return err(413,'TOO_LARGE','Use a compressed PNG, JPG, or WebP under 600 KB.');
          imageData=url;
          continue;
        }
        return err(400,'BAD_REQUEST','Unsupported message attachment.');
      }
      content=parts.join('\n');
    }
    if(typeof content!=='string'||content.length>2500||(!content.trim()&&!imageData))
      return err(400,'BAD_REQUEST','Please enter a shorter study question.');
    turns.push({role:item.role,content:content||'Explain the attached worksheet with hints.'});
  }
  if(!turns.length||turns.at(-1).role!=='user'||
      turns.reduce((total,m)=>total+m.content.length,0)>9000)
    return err(400,'BAD_REQUEST','Please enter a shorter study question.');
  const token=auth.replace(/^Bearer\s+/i,'');
  const headers={apikey:SUPABASE_PUBLIC_KEY,authorization:'Bearer '+token};
  try{
    // Authenticate against Supabase; never trust a username or ID in the body.
    const who=await fetch(SUPABASE_URL+'/auth/v1/user',{
      headers,signal:AbortSignal.timeout(9000)
    });
    const user=who.ok?await who.json().catch(()=>null):null;
    if(!who.ok||!user?.id)return err(401,'SIGN_IN','StudySpire Cloud session is invalid.');
    // The database checks auth.uid() and maps it to the canonical StudySpire profile.
    // Atomic locks enforce per-student and site-wide quotas on every request.
    const claim=await fetch(SUPABASE_URL+'/rest/v1/rpc/ss_ai_claim_mine',{
      method:'POST',headers:{...headers,'content-type':'application/json'},
      body:'{}',signal:AbortSignal.timeout(10000)
    });
    if(!claim.ok)return err(403,'ACCOUNT_UNAVAILABLE','Hosted tutor access is unavailable for this account.');
    const quota=await claim.json().catch(()=>null);
    if(!quota?.ok)return err(429,String(quota?.code||'DAILY_LIMIT'),
      quota?.code==='STUDENT_LIMIT'?'Your hosted questions are used up for today. Choose browser AI or wait.':'The shared hosted allowance is used up. Choose browser AI or wait.');
    const stream=body.stream===true;
    let modelOutput;
    try{
      modelOutput=await env.AI.run(imageData?VISION_MODEL:MODEL,{
        messages:[{role:'system',content:POLICY},...turns.slice(-6)],
        ...(imageData?{image:imageData}:{}),
        max_tokens:Math.min(350,Math.max(90,Number(body.maxTokens)||190)),
        temperature:0.3,
        stream:stream&&!imageData
      });
    }catch(_){
      return err(502,'PROVIDER_UNAVAILABLE',imageData?'Image analysis is unavailable. The vision model may require Meta license acceptance in Cloudflare, or the Workers AI allowance may be exhausted.':'Cloudflare Workers AI is temporarily unavailable or over its free limit. Choose browser AI or wait.');
    }
    if(stream&&!imageData){
      if(!modelOutput||typeof modelOutput.getReader!=='function')
        return err(502,'STREAM_UNAVAILABLE','Cloudflare did not return a streaming tutor response.');
      return new Response(modelOutput,{
        headers:{...cors,'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}
      });
    }
    const answer=modelOutput?.response;
    if(typeof answer!=='string'||!answer.trim())
      return err(502,'EMPTY_RESPONSE','The hosted tutor returned no explanation. Choose browser AI or wait.');
    return json({ok:true,answer:answer.slice(0,9000),provider:'Cloudflare Workers AI binding',remaining:quota.remaining,siteRemaining:quota.site_remaining});
  }catch(_){
    return err(503,'HOSTED_UNAVAILABLE','Could not reach the hosted tutor. Choose browser AI or wait.');
  }
}

export default {
  async fetch(request,env) {
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const url=new URL(request.url);
    if(url.pathname==='/health'&&request.method==='GET')
      return json({ok:true,service:'studyspire-guides',version:2,aiNeurons:0,aiBound:Boolean(env?.AI&&typeof env.AI.run==='function')},200,publicHeaders);
    if(url.pathname==='/v1/topics'&&request.method==='GET')
      return json({topics:Object.keys(STUDY_GUIDES),aiNeurons:0},200,publicHeaders);
    if(url.pathname==='/v1/guide'&&request.method==='GET'){
      const topic=url.searchParams.get('topic')||'';
      if(!/^[a-z-]{2,40}$/.test(topic)||!Object.hasOwn(STUDY_GUIDES,topic))
        return json({error:'Unknown public study topic'},404,publicHeaders);
      return json({topic,source:'studyspire-reviewed-guide',guide:STUDY_GUIDES[topic],aiNeurons:0},200,publicHeaders);
    }
    if(url.pathname==='/v1/tutor'&&request.method==='POST')return aiTutor(request,env);
    if(url.pathname==='/v1/tutor')return err(405,'METHOD','POST required.');
    if(['/health','/v1/topics','/v1/guide'].includes(url.pathname))
      return err(405,'METHOD','GET required.');
    return json({error:'Not found'},404);
  }
};
