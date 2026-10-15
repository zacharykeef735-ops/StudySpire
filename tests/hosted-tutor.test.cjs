'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cloud=read('cloud.js'),html=read('index.html');
const server=read('supabase/functions/studyspire-tutor/index.ts');
const migration=read('studyspire-ai-quota-migration.sql');

test('hosted AI starts first for signed-in users and has browser fallback',()=>{
 assert.match(html,/const hosted=window\.StudySpireHostedAI/);
 assert.match(html,/await hosted\.ask\(messages,maxTokens\)/);
 assert.match(html,/showFreeTutorSetup\(\)/);
 assert.match(html,/StudySpireTutorLastProvider='Browser tutor'/);
 assert.match(html,/state\.lastProvider=window\.StudySpireTutorLastProvider/);
 assert.match(html,/id="ssHostedTutorQuota"/);
 assert.match(html,/cloud\.js\?v=4\.04/);
 assert.doesNotMatch(html,/CLOUDFLARE_AI_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
});

test('server validates JWT and canonical profile before its privileged quota claim',()=>{
 assert.match(cloud,/window\.StudySpireHostedAI=/);
 assert.match(cloud,/client\.functions\.invoke\('studyspire-tutor'/);
 assert.match(server,/auth\/v1\/user/);
 assert.match(server,/rpc\/ss_ai_status/);
 assert.match(server,/rpc\/ss_ai_claim_for/);
 assert.ok(server.indexOf('rpc/ss_ai_status')<server.indexOf('rpc/ss_ai_claim_for'));
 assert.match(server,/STUDENT_LIMIT/);
 assert.match(migration,/SITE_LIMIT/);
 assert.match(migration,/primary key\(profile_id,usage_day\)/);
 assert.match(migration,/grant execute on function public\.ss_ai_claim_for\(uuid\) to service_role/);
 assert.match(migration,/revoke all on function public\.ss_ai_claim_for\(uuid\) from public,anon,authenticated/);
 assert.match(migration,/if mine>=60/);
 assert.match(migration,/if global_count>=400/);
});

test('hosted backend handles provider configuration securely and teaches first',()=>{
 assert.match(server,/Deno\.env\.get\("CLOUDFLARE_AI_TOKEN"\)/);
 assert.match(server,/Deno\.env\.get\("CLOUDFLARE_ACCOUNT_ID"\)/);
 assert.match(server,/TOKEN_MISSING/);
 assert.match(server,/TEXT_ONLY/);
 assert.match(server,/submission-ready answer/);
 assert.match(server,/const model="@cf\/meta\/llama-3\.1-8b-instruct-fp8"/);
 assert.doesNotMatch(cloud,/api\.cloudflare\.com\/client\/v4/);
 assert.doesNotMatch(html,/api\.cloudflare\.com\/client\/v4/);
});

test('a hosted AI failure requires student consent before switching to installed browser AI',()=>{
 assert.match(html,/window\.confirm\('Hosted AI is unavailable or its daily limit is reached/);
 assert.match(html,/You chose to wait and try again later/);
 assert.match(html,/if\(!localEngine\)\{\s*showFreeTutorSetup\(\)/);
 assert.doesNotMatch(html,/console\.warn\('Hosted AI unavailable; using the downloaded browser tutor/);
});

test('Cloudflare diagnostics disclose no credentials and do not consume questions',()=>{
 assert.match(server,/body\?\.action==="diagnose"/);
 assert.match(server,/api\.cloudflare\.com\/client\/v4\/user\/tokens\/verify/);
 assert.match(server,/TOKEN_MISSING/);
 assert.match(server,/ACCOUNT_ID_MISSING/);
 assert.match(server,/ACCOUNT_ID_INVALID/);
 assert.match(server,/TOKEN_INVALID/);
 assert.match(server,/TOKEN_ACTIVE/);
 assert.match(server,/\.trim\(\)/);
 assert.match(cloud,/body:\{action:'diagnose'\}/);
 assert.match(html,/id="ssHostedTutorTest"/);
 assert.match(html,/await bridge\.diagnose\(\)/);
 assert.ok(server.indexOf('body?.action==="diagnose"') < server.indexOf('ss_ai_claim_for'));
 assert.doesNotMatch(html,/api\.cloudflare\.com\/client\/v4/);
});

test('Tutor displays a permanent connection test beside Explain and guide me',async()=>{
 const vm=require('node:vm');
 assert.match(html,/id="askBtn"[^>]*>✦ Explain and guide me<\/button>[\s\S]{0,350}id="ssTutorQuickConnectionTest"/);
 assert.match(html,/id="ssTutorQuickConnectionStatus" role="status"/);
 const block=html.match(/<script id="ss-tutor-connection-test">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(block,'Missing independent Tutor connection test script');
 const button={disabled:false,addEventListener(event,callback){this[event]=callback;}};
 const output={className:'',textContent:''};
 const page={getElementById:id=>id==='ssTutorQuickConnectionTest'?button:id==='ssTutorQuickConnectionStatus'?output:null};
 const win={StudySpireHostedAI:{available:()=>true,diagnose:async()=>({ok:true,ready:false,code:'ACCOUNT_ID_INVALID',message:'Account ID needs checking.'})}};
 vm.runInNewContext(block,{document:page,window:win});
 assert.equal(typeof button.click,'function');
 await button.click();
 assert.equal(button.disabled,false);
 assert.match(output.textContent,/Account ID needs checking/);
 assert.equal(output.className,'status show bad');
 win.StudySpireHostedAI.diagnose=async()=>({ok:true,ready:true,code:'TOKEN_ACTIVE',message:'Token is active.'});
 await button.click();
 assert.match(output.textContent,/Token is active/);
 assert.equal(output.className,'status show good');
 win.StudySpireHostedAI.available=()=>false;
 await button.click();
 assert.match(output.textContent,/Sign in to a StudySpire Cloud account/);
});
