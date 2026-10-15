import {STUDY_GUIDES} from '../../studyspire-guide-catalog.mjs';

// Public, deterministic study material. Never processes or stores student prompts,
// passwords, messages, account IDs, or AI provider credentials.
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':'public, max-age=3600'
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
export default {
  async fetch(request) {
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='GET')return json({error:'GET required'},405);
    const url=new URL(request.url);
    if(url.pathname==='/health')return json({ok:true,service:'studyspire-guides',version:1,aiNeurons:0});
    if(url.pathname==='/v1/topics')return json({topics:Object.keys(STUDY_GUIDES),aiNeurons:0});
    if(url.pathname!=='/v1/guide')return json({error:'Not found'},404);
    const topic=url.searchParams.get('topic')||'';
    if(!/^[a-z-]{2,40}$/.test(topic)||!Object.hasOwn(STUDY_GUIDES,topic)){
      return json({error:'Unknown public study topic'},404);
    }
    return json({
      topic,
      source:'studyspire-reviewed-guide',
      guide:STUDY_GUIDES[topic],
      aiNeurons:0
    });
  }
};
