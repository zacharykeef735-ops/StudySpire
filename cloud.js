/* Study Summit Cloud bridge v3.77. Requires cloud-config.js, Supabase JS v2, supabase.sql, and username-login-migration.sql for no-email accounts.
   No service_role keys; authorization for roles/bans is always checked by SQL on the server. */
(()=>{'use strict';
const cfg=window.STUDY_SUMMIT_CLOUD||{};
const ready=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(cfg.url||'').trim())&&String(cfg.publishableKey||'').trim().length>=20;
const $=id=>document.getElementById(id);
const STORE=['studydock-suite-v1','ss-study-lab-v374','studydock-simple-v1','studydock-mini-notes-v1','studysync-mini-notes-v1','study-summit-personalization-v1','sd-mini-notes-v1','studydock-mini-v1','studydock-ai-v1'];
let client=null,person=null,profile=null,remote=null,cloudId='',syncTimer=0,syncing=false,live=false,lastSnapshot='',role='student';
const escapeHTML=str=>String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const prefix=()=>`sd-account-${cloudId}::`;
const localKey=k=>prefix()+k;
const banned=p=>Boolean(p?.banned&&(!p.banned_until||new Date(p.banned_until).getTime()>Date.now()));
const cloudNotice=msg=>{const el=$('ssCloudNotice');if(el)el.textContent=msg};
const download=(name,data)=>{const href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),2000)};
function studyItems(){const o={};for(const k of STORE){const val=localStorage.getItem(localKey(k));if(val!==null)o[k]=val}
  // Only per-account study data; never auth tokens, account hashes, moderation, bans or roles.
  const pref=prefix();for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(pref))continue;const name=k.slice(pref.length);
    if(!/^(?:studydock|studysync|study-summit|ss-)/.test(name)||!/(?:chat|doc|flash|note|card|agenda|learning|skill|task|progress|study|personalization)/i.test(name)||/(?:auth|password|credential|token|admin|ban|moderat|role|account)/i.test(name))continue;
    o[name]=localStorage.getItem(k)
  }return o;}
function setStudy(items){syncing=true;try{if(!items||typeof items!=='object'||Array.isArray(items))return;
    for(const [k,v] of Object.entries(items)){if(typeof v!=='string'||v.length>1000000)continue;
      if(STORE.includes(k)||(/^(?:studydock|studysync|study-summit|ss-)/.test(k)&&/(?:chat|doc|flash|note|card|agenda|learning|skill|task|progress|study|personalization)/i.test(k)&&!/(?:auth|password|credential|token|admin|ban|moderat|role|account)/i.test(k)))
        localStorage.setItem(localKey(k),v);
    }
  }finally{syncing=false}}
/* Username accounts are the primary option. Legacy Supabase email accounts are
   still supported, including existing Owners, until migrated intentionally. */
let authMethod='username',sessionMethod='email';
function showGate(kind='login'){
 let gate=$('ssCloudGate');if(!gate){gate=document.createElement('section');gate.id='ssCloudGate';document.body.append(gate)}
 gate.hidden=false;gate.innerHTML=`<div class="ssc-shell"><div class="ssc-mark">✦</div><div class="ssc-title-row"><div class="ssc-heading">Study Summit <span>Cloud</span></div><button id="ssc-close" type="button" class="ssc-light" hidden aria-label="Close account menu">✕ Close</button></div>
 <p id="ssCloudNotice" class="ssc-muted" role="status" aria-live="polite">Your study space, on any device.</p>
 <div id="ssc-loginArea">
  <div class="ssc-methods" role="group" aria-label="Sign-in method"><button type="button" id="ssc-usernameMethod" class="ssc-method">Username + password</button><button type="button" id="ssc-emailMethod" class="ssc-method ssc-light">Older email account</button></div>
  <div id="ssc-userRow"><label for="ssc-user">Username</label><input id="ssc-user" autocomplete="username" placeholder="Your username" maxlength="32" spellcheck="false" autocapitalize="none"/></div>
  <div id="ssc-emailRow" hidden><label for="ssc-email">Email address</label><input type="email" id="ssc-email" autocomplete="email" placeholder="you@example.com" maxlength="150"/></div>
  <label for="ssc-pass">Password</label><input id="ssc-pass" type="password" autocomplete="current-password" placeholder="At least 10 characters for new accounts" minlength="8"/><button id="ssc-showpass" type="button" class="ssc-light ssc-password-toggle" aria-pressed="false" aria-controls="ssc-pass">Show password</button>
  <div id="ssc-nameRow" hidden><label for="ssc-name">Username for older email account</label><input id="ssc-name" placeholder="Choose a username" maxlength="32" autocomplete="username"/></div>
  <div class="ssc-row"><button id="ssc-login" type="button">Sign in</button><button id="ssc-register" type="button" class="ssc-light">Create account</button></div>
  <p id="ssc-recoveryInfo" class="ssc-caption">No email needed for new username accounts. Save your password: self-service password recovery isn't available yet. Owner-assisted recovery is not implemented.</p>
  <p class="ssc-caption">Older Supabase email/Owner accounts remain available via “Older email account.” Browser-only accounts are separate.</p>
 </div>
 <div id="ssc-bannedArea" hidden><h1 class="ssc-banned">YOU ARE BANNED</h1><p id="ssc-banReason" class="ssc-muted"></p>
 <div class="ssc-row"><button id="ssc-flash" type="button">Export flashcards</button><button id="ssc-chats" type="button" class="ssc-light">Export saved chats</button></div>
 <div class="ssc-row"><button id="ssc-all" type="button" class="ssc-light">Export all study data</button><button id="ssc-check" type="button" class="ssc-light">Check ban status</button></div>
 <p class="ssc-caption">Downloads are available for the account owner. A ban doesn't delete your notes.</p></div>
 <div class="ssc-row"><button id="ssc-logout" class="ssc-light" type="button">Sign out</button></div></div>`;
 const setMethod=(method)=>{
   authMethod=method;const email=method==='email';
   $('ssc-userRow').hidden=email;$('ssc-emailRow').hidden=!email;
   $('ssc-nameRow').hidden=true;$('ssc-register').textContent='Create account';
   $('ssc-usernameMethod').classList.toggle('ssc-selected',!email);
   $('ssc-emailMethod').classList.toggle('ssc-selected',email);
   $('ssc-recoveryInfo').textContent=email?'Older email accounts use Supabase email/password. New registrations may require confirmation depending on your Supabase settings.':'No email needed. Use a strong password and keep it safe; password recovery is not available yet.';
   $('ssc-pass').value='';$('ssc-pass').type='password';$('ssc-showpass').textContent='Show password';$('ssc-showpass').setAttribute('aria-pressed','false');
 };
 $('ssc-usernameMethod').onclick=()=>setMethod('username');
 $('ssc-emailMethod').onclick=()=>setMethod('email');
 $('ssc-showpass').onclick=()=>{const password=$('ssc-pass');const reveal=password.type==='password';password.type=reveal?'text':'password';$('ssc-showpass').textContent=reveal?'Hide password':'Show password';$('ssc-showpass').setAttribute('aria-pressed',String(reveal));};
 $('ssc-close').onclick=()=>{if(person&&!banned(profile))gate.hidden=true;};
 gate.onkeydown=e=>{if(e.key==='Escape'&&person&&!banned(profile))gate.hidden=true;};
 $('ssc-register').onclick=async()=>{
   const password=$('ssc-pass').value;
   if(authMethod==='username'){
     const chosen_username=$('ssc-user').value.trim().toLowerCase();
     if(!/^[a-z0-9_-]{3,32}$/.test(chosen_username)||/^(admin|owner|moderator|support|staff|official)$/.test(chosen_username))return cloudNotice('Choose a username using 3–32 letters, numbers, _ or -.');
     if(password.length<10||new TextEncoder().encode(password).length>72)return cloudNotice('Use a password of at least 10 characters and no more than 72 bytes.');
     if(!confirm('Username accounts have no email recovery. Have you saved your password?'))return;
     cloudNotice('Creating your username account…');
     let phase='starting a secure session';try{await ensureAnonymous();phase='creating your username account';const {error}=await client.rpc('ss_username_register',{chosen_username,chosen_password:password});
       if(error)throw Error(error.message);cloudNotice('Account created. Loading Study Summit…');await boot();
     }catch(err){cloudNotice('Could not create account ('+phase+'): '+(err.message||err));}
     return;
   }
   const row=$('ssc-nameRow');if(row.hidden){row.hidden=false;$('ssc-register').textContent='Finish registration';cloudNotice('Choose a username, then press Finish registration.');return}
   const username=$('ssc-name').value.trim().toLowerCase(),email=$('ssc-email').value.trim();
   if(!/^[a-z0-9_-]{3,32}$/.test(username)||/^(admin|owner|moderator|support|staff|official)$/.test(username))return cloudNotice('Choose a username using 3–32 letters, numbers, _ or -.');
   if(password.length<8)return cloudNotice('Choose a password at least 8 characters long.');
   cloudNotice('Creating older-style account…');const {data,error}=await client.auth.signUp({email,password,options:{data:{username},emailRedirectTo:location.origin+location.pathname}});
   if(error)return cloudNotice(error.message);if(data.session){cloudNotice('Account created. Signing in…');await boot()}else cloudNotice('Check your email to confirm the account, then return here and sign in.');
 };
 $('ssc-login').onclick=async()=>{
   const password=$('ssc-pass').value;
   if(authMethod==='username'){
     const chosen_username=$('ssc-user').value.trim().toLowerCase();
     if(!chosen_username||!password)return cloudNotice('Enter your username and password.');
     cloudNotice('Signing in…');
     let phase='starting a secure session';try{await ensureAnonymous();phase='checking your credentials';const {data,error}=await client.rpc('ss_username_login',{chosen_username,chosen_password:password});
       if(error)throw Error(error.message);
       if(data!==true){cloudNotice('Incorrect username or password, or account temporarily locked.');return}
       cloudNotice('Signed in. Loading Study Summit…');await boot();
     }catch(err){cloudNotice('Could not sign in ('+phase+'): '+(err.message||err));}
     return;
   }
   const email=$('ssc-email').value.trim();if(!email||!password)return cloudNotice('Enter your email and password.');
   cloudNotice('Signing in to older account…');const {error}=await client.auth.signInWithPassword({email,password});if(error)return cloudNotice(error.message);await boot();
 };
 $('ssc-pass').onkeydown=e=>{if(e.key==='Enter')$('ssc-login').click()};
 $('ssc-logout').onclick=signOutCloud;
 $('ssc-check').onclick=async()=>{const ok=await refreshProfile();if(ok&&!banned(profile))location.reload();else cloudNotice('This ban is still active. Your data export options are available below.')};
 $('ssc-flash').onclick=()=>exportMine('flash');$('ssc-chats').onclick=()=>exportMine('chats');$('ssc-all').onclick=()=>exportMine('all');
 setMethod(authMethod);
 if(kind==='loading'){$('ssc-loginArea').hidden=true;$('ssc-logout').parentElement.hidden=true;cloudNotice('Checking your account and syncing study data…')}
 $('ssc-close').hidden=!(person&&kind==='account'&&!banned(profile));
 if(kind==='banned')showBanned();
 return gate;
}
async function ensureAnonymous(){
 // A missing Supabase session is the NORMAL state for a first-time signup.
 // Only a real session can be reused; otherwise create an anonymous one.
 const isMissing=e=>e?.name==='AuthSessionMissingError'||/auth session missing/i.test(String(e?.message||e||''));
 let session=null;
 try{
   const {data,error}=await client.auth.getSession();
   if(error && !isMissing(error))throw Error('Checking session: '+error.message);
   session=data?.session||null;
 }catch(e){if(!isMissing(e))throw e;}
 if(session?.user?.is_anonymous)return;
 if(session){
   const {error:logoutErr}=await client.auth.signOut({scope:'local'});
   if(logoutErr&&!isMissing(logoutErr))throw Error('Switching accounts: '+logoutErr.message);
 }
 let response;
 try{response=await client.auth.signInAnonymously();}
 catch(e){throw Error('Starting anonymous sign-in: '+(e?.message||e));}
 if(response?.error)throw Error('Starting anonymous sign-in: '+response.error.message);
 if(!response?.data?.session)throw Error('Anonymous sign-in returned no session. Check Supabase Authentication → Anonymous Sign-Ins.');
}
let signingOut=false;
async function signOutCloud(){
 if(signingOut||!client)return;
 signingOut=true;
 const logoutButtons=[$('ssc-logout'),$('sdAccountLogout')].filter(Boolean);
 for(const button of logoutButtons){button.disabled=true;button.textContent='Signing out…'}
 cloudNotice('Signing out of Study Summit…');
 try{
  // A PostgREST rpc() builder is Promise-like, not a Promise with .catch().
  // Session-map cleanup must not block the actual auth sign-out.
  if(sessionMethod==='username'){
   try{
    const {error}=await client.rpc('ss_username_logout');
    if(error)console.warn('Username session cleanup:',error.message);
   }catch(error){console.warn('Username session cleanup:',error)}
  }
  const {error}=await client.auth.signOut({scope:'local'});
  if(error)throw error;
  clearTimeout(syncTimer);
  live=false;person=null;profile=null;cloudId='';remote=null;
  sessionStorage.removeItem('ss-cloud-display-name');
  sessionStorage.removeItem('studydoc-active-account');
  sessionStorage.removeItem('ssCloudApplied');
  const staff=$('ssCloudStaffDialog');if(staff)staff.hidden=true;
  location.reload();
 }catch(error){
  cloudNotice('Could not sign out: '+(error?.message||error)+'. Please retry.');
  console.error('Study Summit cloud sign-out failed:',error);
 }finally{
  signingOut=false;
  for(const button of logoutButtons){button.disabled=false;button.textContent='Sign out'}
 }
}
function showBanned(){const gate=$('ssCloudGate')||showGate();gate.hidden=false;if($('ssc-close'))$('ssc-close').hidden=true;$('ssc-loginArea').hidden=true;$('ssc-bannedArea').hidden=false;$('ssc-logout').parentElement.hidden=false;
 const until=profile.banned_until?'until '+new Date(profile.banned_until).toLocaleString():'permanently';$('ssc-banReason').textContent=`Account @${profile.username} banned ${until}. Reason: ${profile.ban_reason||'Admin decision'}`;cloudNotice('You can still export your own flashcards and saved chats.')}
function exportMine(kind){const items=remote?.data||studyItems();const result={kind:'study-summit-cloud-export',account:profile?.username,exportedAt:new Date().toISOString(),data:{}};
 for(const [k,v] of Object.entries(items)){if(typeof v!=='string')continue;if(kind==='flash'&&!/(?:suite|card|flash|lab)/i.test(k))continue;if(kind==='chats'&&!/(?:chat|tutor|mini|suite|notes)/i.test(k))continue;
 try{const obj=JSON.parse(v);if(kind==='flash'&&k==='studydock-suite-v1')result.data[k]={cards:obj.cards||[]};else if(kind==='chats'&&k==='studydock-suite-v1')result.data[k]={chats:obj.chats||[]};else result.data[k]=obj}catch{result.data[k]=v}}
 download('study-summit-'+kind+'-'+Date.now()+'.json',result)}
async function refreshProfile(){if(!person)return false;const {data,error}=await client.from('ss_profiles').select('id,username,role,banned,banned_until,ban_reason').eq('id',person.id).single();
 if(error){cloudNotice('Account status unavailable: '+error.message);return false}profile=data;role=profile.role||'student';
 try{sessionStorage.setItem('ss-cloud-display-name',profile.username)}catch(_){}if(banned(profile)){live=false;showBanned()}else{const gate=$('ssCloudGate');if(gate&&!gate.hidden&&$('ssc-bannedArea')&&!$('ssc-bannedArea').hidden){gate.hidden=true;}updateHeader()}return true}
async function getRemote(){const {data,error}=await client.from('ss_study_data').select('data,updated_at').eq('user_id',person.id).maybeSingle();if(error)throw Error(error.message);return data}
function updateHeader(){const summary=$('sdAccountSummary');if(summary)summary.textContent=`@${profile.username} · Cloud ${role} · study data synced`;const topLabel=$('sdTopAccountLabel');if(topLabel)topLabel.textContent='@'+profile.username;const currentProfile=$('ssCurrentProfile');if(currentProfile)currentProfile.textContent='@'+profile.username;const toggle=$('sdAccountOpen');if(toggle)toggle.textContent='@'+profile.username;const log=$('sdAccountLogout');if(log){log.textContent='Sign out';log.style.display='inline-flex';log.hidden=false;}
 const owner=role==='owner',staff=owner||role==='admin'||role==='moderator';
 for(const id of ['ssCloudStaffBtn','ssCloudOwnerTop','ssCloudOwnerNav','ssCloudOwnerQuick']){const btn=$(id);if(!btn)continue;btn.hidden=!staff;if(id!=='ssCloudOwnerNav'&&id!=='ssCloudOwnerQuick')btn.textContent=owner?'👑 Owner Dashboard':'⚑ Staff Dashboard';if(id==='ssCloudOwnerNav'){const name=btn.querySelector('.sd-navtext');if(name)name.textContent=owner?'👑 Owner Dashboard':'⚑ Staff Dashboard'}}
 if(!staff&&$('ssCloudStaffDialog'))$('ssCloudStaffDialog').hidden=true;
}
function installOwnerNavigation(){
 // Show only the cloud-verified Owner/Admin/Moderator dashboard, never the local-only demo.
 const openDashboard=()=>openStaff();
 if(!$('ssCloudOwnerTop')){
  const top=$('sdTopAccount');
  if(top?.parentElement){const btn=document.createElement('button');btn.id='ssCloudOwnerTop';btn.type='button';btn.className='btn secondary small';btn.textContent='👑 Owner Dashboard';btn.onclick=openDashboard;btn.hidden=true;top.parentElement.insertBefore(btn,top);}
 }
 if(!$('ssCloudOwnerNav')){
  const old=$('ssAdminSidebar');
  if(old?.parentElement){const btn=document.createElement('button');btn.id='ssCloudOwnerNav';btn.type='button';btn.hidden=true;btn.innerHTML='<span class="navicon">⚑</span><span class="sd-navtext">👑 Owner Dashboard</span>';btn.onclick=openDashboard;old.parentElement.insertBefore(btn,old.nextSibling);}
 }
 if(!$('ssCloudOwnerQuick')){
  const quick=document.querySelector('.sd-dashboard-actions');
  if(quick){const btn=document.createElement('button');btn.id='ssCloudOwnerQuick';btn.hidden=true;btn.type='button';btn.innerHTML='<span>👑</span> Owner Dashboard';btn.onclick=openDashboard;quick.append(btn);}
 }
}
function installButtons(){document.documentElement.classList.add('ss-cloud-active');
 const localShade=$('sdAuthShade');if(localShade)localShade.style.display='none';
 const open=$('sdAccountOpen');if(open)open.onclick=()=>{showGate('account');cloudNotice(`Signed in as @${profile?.username||'…'}. Sign out below to switch accounts.`);$('ssc-loginArea').hidden=true;$('ssc-logout').parentElement.hidden=false};
 const logout=$('sdAccountLogout');if(logout){logout.style.display='inline-flex';logout.hidden=false;logout.onclick=signOutCloud;}
 const actions=document.querySelector('.sd-profile-actions')||document.querySelector('.sd-profile-side')||document.body;
 if(!$('ssCloudAccountBtn')){const button=document.createElement('button');button.id='ssCloudAccountBtn';button.type='button';button.className='btn secondary small';button.textContent='☁ Cloud account';button.onclick=()=>open?.click();actions.append(button)}
 if(!$('ssCloudImportBtn')){const button=document.createElement('button');button.id='ssCloudImportBtn';button.type='button';button.className='btn secondary small';button.textContent='Import old backup';button.onclick=importLegacy;actions.append(button)}
 if(!$('ssCloudStaffBtn')){const button=document.createElement('button');button.id='ssCloudStaffBtn';button.type='button';button.className='btn secondary small';button.textContent='⚑ Cloud staff';button.onclick=()=>openStaff();actions.append(button)}
 if(!$('ssCloudReportBtn')){const button=document.createElement('button');button.id='ssCloudReportBtn';button.type='button';button.className='btn secondary small';button.textContent='Report an issue';button.onclick=sendReport;actions.append(button)}
 const disabled=['ssAdminSidebar','ssAdminSuiteTab','ssLabRolesTab'];for(const name of disabled){const el=$(name);if(el)el.hidden=true}
 // Legacy local social activity cannot be represented as global messaging.
 for(const name of ['sdFriendFind','sdSendMessage','sdShareDeck']){const el=$(name);if(el){el.disabled=true;el.title='Local-only social features are disabled in Cloud mode.'}}
 const feed=$('sdFriendStatus');if(feed)feed.textContent='Shared messaging is not yet available in Cloud mode. Your private study notes still sync.';
 // Keep legacy admin and local role panels hidden even if their own render methods later unhide them.
 const style=document.createElement('style');style.textContent='.ss-cloud-active #ssAdminSidebar,.ss-cloud-active #ssAdminSuiteTab,.ss-cloud-active #ssLabRolesTab,.ss-cloud-active #ssAdminPane,.ss-cloud-active #sdAuthShade,.ss-cloud-active #sdFriendFind,.ss-cloud-active #sdSendMessage,.ss-cloud-active #sdShareDeck{display:none!important}';document.head.append(style);
 installOwnerNavigation();
 updateHeader();
}
let lastUpload=Promise.resolve();
function scheduleSync(){if(!live||syncing||banned(profile)||!person)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>{uploadSnapshot().catch(e=>cloudNotice('Sync issue: '+e.message))},1800)}
async function uploadSnapshot(){if(!live||syncing||banned(profile))return;const contents=studyItems(),snapshot=JSON.stringify(contents);if(snapshot===lastSnapshot)return;
 if(snapshot.length>1400000){cloudNotice('Cloud storage limit reached. Export a backup and remove some large study documents.');return}
 lastUpload=lastUpload.then(async()=>{const {data,error}=await client.from('ss_study_data').upsert({user_id:person.id,data:contents,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('updated_at').single();
   if(error)throw Error(error.message);remote={data:contents,updated_at:data.updated_at};lastSnapshot=snapshot}).catch(err=>{cloudNotice('Cloud sync failed: '+err.message)});
 await lastUpload;
}
const nativeSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){const out=nativeSet.call(this,key,value);if(ready&&this===localStorage&&cloudId&&String(key).startsWith(prefix())&&!syncing)scheduleSync();return out};
async function boot(){
 showGate('loading');if(!client)return cloudNotice('Supabase library did not load. Check your connection.');
 try{
 const {data:{user},error}=await client.auth.getUser();if(error||!user){person=null;profile=null;sessionStorage.removeItem('studydoc-active-account');showGate();return}
 if(user.is_anonymous){
   sessionMethod='username';
   const {data:account,error:lookupError}=await client.rpc('ss_username_me');
   if(lookupError){person=null;showGate();cloudNotice('Username accounts need the SQL migration in Supabase. Enable Anonymous Sign-Ins in Authentication settings. Your older email account is available under Older email account.');return}
   const row=Array.isArray(account)?account[0]:account;
   if(!row?.id){person=null;showGate();return}
   person={...user,id:row.id};
 } else {sessionMethod='email';person=user}
 cloudId='cloud'+person.id.replace(/-/g,'');const logged=sessionStorage.getItem('studydoc-active-account');
 if(logged!==cloudId){sessionStorage.setItem('studydoc-active-account',cloudId);sessionStorage.removeItem('ssCloudApplied');location.reload();return}
 if(!await refreshProfile())return;
 remote=await getRemote();
 if(!remote){remote={data:{},updated_at:'new'};}
 if(banned(profile)){showBanned();return}
 const tag=person.id+'|'+remote.updated_at;
 if(remote.updated_at!=='new'&&sessionStorage.getItem('ssCloudApplied')!==tag){setStudy(remote.data);sessionStorage.setItem('ssCloudApplied',tag);location.reload();return}
 if(remote.updated_at==='new')sessionStorage.setItem('ssCloudApplied',tag);
 lastSnapshot=remote.updated_at==='new'?'':JSON.stringify(studyItems());live=true;installButtons();$('ssCloudGate').hidden=true;
 if(remote.updated_at==='new'&&Object.keys(studyItems()).length)scheduleSync();
 window.addEventListener('beforeunload',()=>{if(live)uploadSnapshot().catch(()=>{})});
 window.addEventListener('focus',()=>refreshProfile());
 setInterval(async()=>{if(!person)return;const ok=await refreshProfile();if(!ok)return;if(banned(profile)){live=false;return}if(live){const nowRemote=await getRemote().catch(()=>null);if(nowRemote&&nowRemote.updated_at!==remote?.updated_at){const local=JSON.stringify(studyItems());if(local===lastSnapshot){remote=nowRemote;setStudy(nowRemote.data);lastSnapshot=JSON.stringify(studyItems());cloudNotice('New cloud updates received. Reload this page to view them.')}else cloudNotice('This account changed on another device. Export a backup before reloading.')}}},45000);
 }catch(err){showGate();cloudNotice('Could not open Study Summit Cloud: '+(err.message||err))}
}
async function importLegacy(){if(!person||banned(profile))return;const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.onchange=async()=>{const file=picker.files?.[0];if(!file)return;try{if(file.size>10000000)throw Error('Backups must be smaller than 10 MB.');const obj=JSON.parse(await file.text());const isLocalBackup=obj.kind==='study-summit-personal-backup'&&obj.items&&typeof obj.items==='object';
 const isCloudExport=obj.kind==='study-summit-cloud-export'&&obj.data&&typeof obj.data==='object';
 if(!isLocalBackup&&!isCloudExport)throw Error('Select a Study Lab personal backup or cloud study export JSON file.');
 const raw=isLocalBackup?obj.items:obj.data;
 const allowed=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]).filter(([k,v])=>typeof v==='string'&&v.length<1000000&&(STORE.includes(k)||(/^(studydock|studysync|study-summit|ss-)/.test(k)&&/(chat|doc|flash|note|card|agenda|learning|skill|task|progress|study|personalization)/i.test(k)&&!/(auth|password|credential|token|admin|ban|moderat|role|account)/i.test(k)))).slice(0,100));
 if(!Object.keys(allowed).length)throw Error('No study data found in that backup.');if(!confirm('Import '+Object.keys(allowed).length+' study sections into this cloud account? This replaces the matching sections already here.'))return;setStudy(allowed);await uploadSnapshot();alert('Study backup imported. Reloading Study Summit…');location.reload()}catch(e){alert('Import failed: '+e.message)}};picker.click()}
async function sendReport(){if(!person||banned(profile))return;const about=prompt('Username involved (optional):','');if(about===null)return;
 const message=prompt('Describe what happened (at least 10 characters):');if(message===null)return;
 const {error}=await client.rpc('ss_report_issue',{about_name:about,complaint:message});alert(error?'Could not send report: '+error.message:'Report received. Staff can review it in Cloud staff.')}
async function rpc(name,args){const {data,error}=await client.rpc(name,args||{});if(error)throw Error(error.message);return data}
async function openStaff(){if(!person||!['owner','admin','moderator'].includes(role)||banned(profile))return;
 if(!await refreshProfile()||!['owner','admin','moderator'].includes(role)||banned(profile))return;
 let modal=$('ssCloudStaffDialog');if(!modal){modal=document.createElement('div');modal.id='ssCloudStaffDialog';document.body.append(modal)}
 modal.hidden=false;modal.innerHTML='<div class="ssc-staffbox" role="dialog" aria-modal="true" aria-labelledby="ssCloudAdminTitle" tabindex="-1"><div class="ssc-title-row"><h2 id="ssCloudAdminTitle">'+(role==='owner'?'👑 Owner Dashboard':'⚑ Staff Dashboard')+'</h2><button id="ssCloudStaffClose" class="ssc-light" type="button">✕ Close</button></div><p class="ssc-muted">Manage real cloud accounts across devices. Role changes, bans, and reports are checked by Supabase.</p><div id="ssCloudAdminSummary" class="ssc-admin-summary"></div><div id="ssCloudStaffMsg" role="status" aria-live="polite"></div><section class="ssc-admin-section"><h3>Account management &amp; roles</h3><div class="ssc-admin-tools"><input id="ssCloudAccountSearch" type="search" placeholder="Search users or roles…" aria-label="Search accounts"/><select id="ssCloudAccountFilter" aria-label="Filter accounts"><option value="all">All accounts</option><option value="active">Active</option><option value="banned">Banned</option><option value="staff">Staff</option></select><button id="ssCloudRefresh" class="ssc-light" type="button">↻ Refresh</button></div><div id="ssCloudStaffUsers"></div></section><section class="ssc-admin-section"><div class="ssc-title-row"><h3>Reports</h3><button class="ssc-light" id="ssCloudExportReports" type="button">↓ Export reports</button></div><div class="ssc-admin-tools"><select id="ssCloudReportFilter" aria-label="Filter reports"><option value="open">Open reports</option><option value="all">All reports</option><option value="reviewed">Reviewed reports</option></select><input id="ssCloudReportSearch" type="search" placeholder="Search reports…" aria-label="Search reports"/></div><div id="ssCloudStaffReports"></div></section><section class="ssc-admin-section"><div class="ssc-title-row"><h3>Recent admin actions</h3><button class="ssc-light" id="ssCloudExportAudit" type="button">↓ Export history</button></div><div id="ssCloudStaffAudit"></div></section></div>';
 $('ssCloudStaffClose').onclick=()=>modal.hidden=true;
 modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
 modal.onkeydown=e=>{if(e.key==='Escape')modal.hidden=true};
 for(const name of ['ssCloudAccountSearch','ssCloudReportSearch'])$(name).oninput=applyStaffFilters;
 for(const name of ['ssCloudAccountFilter','ssCloudReportFilter'])$(name).onchange=applyStaffFilters;
 $('ssCloudRefresh').onclick=()=>renderStaff().catch(e=>staffMsg(e.message));
 $('ssCloudExportReports').onclick=()=>download('study-summit-reports-'+Date.now()+'.json',{exported:new Date().toISOString(),reports:staffData.reports});
 $('ssCloudExportAudit').onclick=()=>download('study-summit-admin-audit-'+Date.now()+'.json',{exported:new Date().toISOString(),actions:staffData.audit});
 modal.querySelector('.ssc-staffbox').focus();
 renderStaff().catch(e=>staffMsg(e.message));}
let staffData={users:[],reports:[],audit:[]};
function staffMsg(message){if($('ssCloudStaffMsg'))$('ssCloudStaffMsg').textContent=message}
function applyStaffFilters(){
 const s=($('ssCloudAccountSearch')?.value||'').toLowerCase().trim(),filter=$('ssCloudAccountFilter')?.value||'all';
 $('ssCloudStaffUsers')?.querySelectorAll('[data-staff-user]').forEach(row=>{const hit=row.dataset.staffUser.includes(s),ban=row.dataset.banned==='true',staff=row.dataset.staffRole!=='student';row.hidden=!(hit&&(filter==='all'||filter==='active'&&!ban||filter==='banned'&&ban||filter==='staff'&&staff))});
 const rs=($('ssCloudReportSearch')?.value||'').toLowerCase().trim(),rf=$('ssCloudReportFilter')?.value||'open';
 $('ssCloudStaffReports')?.querySelectorAll('[data-report]').forEach(row=>{row.hidden=!(row.dataset.report.includes(rs)&&(rf==='all'||row.dataset.status===rf))});
}

async function renderStaff(){staffMsg('Loading accounts, reports, and audit history…');const [users,reports,audit]=await Promise.all([rpc('ss_staff_profiles'),rpc('ss_staff_reports'),rpc('ss_staff_audit')]);
 staffData={users,reports,audit};const summary=$('ssCloudAdminSummary');if(summary)summary.textContent=users.length+' accounts · '+reports.filter(r=>r.status==='open').length+' open reports · '+users.filter(u=>u.banned&&(!u.banned_until||Date.parse(u.banned_until)>Date.now())).length+' active bans · '+users.filter(u=>u.role!=='student').length+' staff';
 const box=$('ssCloudStaffUsers');if(!box)return;box.replaceChildren();const h=document.createElement('h3');h.textContent='Accounts ('+users.length+')';box.append(h);
 for(const u of users){const row=document.createElement('div');row.className='ssc-user';row.dataset.staffUser=(u.username+' '+u.role).toLowerCase();row.dataset.staffRole=u.role;row.dataset.banned=String(Boolean(u.banned&&(!u.banned_until||Date.parse(u.banned_until)>Date.now())));const left=document.createElement('div');const tag=document.createElement('strong');tag.textContent='@'+u.username+' · '+u.role;left.append(tag);
 const note=document.createElement('small');note.textContent=u.banned&&(!u.banned_until||new Date(u.banned_until)>new Date())?'BANNED · '+(u.ban_reason||'No reason'):u.banned?'Ban expired':'Active';left.append(note);row.append(left);
 if(role==='owner'&&u.role!=='owner'){const sel=document.createElement('select');['student','moderator','admin'].forEach(r=>sel.add(new Option(r,r)));sel.value=u.role;sel.setAttribute('aria-label','Role for '+u.username);sel.onchange=async()=>{if(!confirm('Set @'+u.username+' to '+sel.value+'?'))return;try{await rpc('ss_change_role',{target_user:u.id,new_role:sel.value});staffMsg('Role updated.');await renderStaff()}catch(e){staffMsg(e.message)}};row.append(sel)}
 if(['owner','admin'].includes(role)&&u.role!=='owner'&&u.id!==person.id&&(role==='owner'||u.role!=='admin')){
 const activeBan=u.banned&&(!u.banned_until||new Date(u.banned_until)>new Date());const ban=document.createElement('button');ban.textContent=activeBan?'Lift ban early':'Ban';ban.className='ssc-light';ban.onclick=async()=>{try{if(activeBan){if(!confirm('Unban @'+u.username+' right now?'))return;await rpc('ss_change_ban',{target_user:u.id,ban_hours:0,reason:'Ban lifted early',lift:true})}
 else{const why=prompt('Reason for banning @'+u.username+' (required):');if(!why?.trim())return;const duration=prompt('Hours: 24 = 1 day, 168 = 7 days, 720 = 30 days, 0 = permanent','24');if(!['0','24','168','720'].includes(duration))return alert('Choose 0, 24, 168 or 720.');if(!confirm('Confirm ban for @'+u.username+'?'))return;await rpc('ss_change_ban',{target_user:u.id,ban_hours:Number(duration),reason:why,lift:false})}
 staffMsg('Ban action saved.');await renderStaff()}catch(e){staffMsg(e.message)}};row.append(ban)}box.append(row)}
 const reportsBox=$('ssCloudStaffReports');reportsBox.replaceChildren();for(const r of reports){const item=document.createElement('div');item.className='ssc-user';item.dataset.report=(r.about_username+' '+r.reporter_name+' '+r.reason).toLowerCase();item.dataset.status=r.status;const text=document.createElement('div');const line=document.createElement('strong');line.textContent=(r.status==='open'?'OPEN · ':'REVIEWED · ')+(r.about_username||'General report');const detail=document.createElement('small');detail.textContent='From @'+r.reporter_name+' · '+r.reason; text.append(line,detail);item.append(text);
 if(r.status==='open'){const review=document.createElement('button');review.className='ssc-light';review.textContent='Mark reviewed';review.onclick=async()=>{try{await rpc('ss_review_report',{report_id:r.id});await renderStaff()}catch(e){staffMsg(e.message)}};item.append(review)}reportsBox.append(item)}if(!reports.length)reportsBox.textContent='No reports.';
 const auditBox=$('ssCloudStaffAudit');auditBox.replaceChildren();for(const a of audit){const item=document.createElement('div');item.className='ssc-audit';item.textContent=`${new Date(a.created_at).toLocaleString()} · @${a.actor_name} · ${a.action} · @${a.target_name} · ${a.details}`;auditBox.append(item)}if(!audit.length)auditBox.textContent='No admin actions yet.';
 applyStaffFilters();staffMsg('Cloud dashboard refreshed.');
}
function addStyling(){const style=document.createElement('style');style.textContent=`
#ssCloudGate[hidden],#ssCloudStaffDialog[hidden]{display:none!important}
#ssCloudGate,#ssCloudStaffDialog{position:fixed;inset:0;background:#080e19f4;color:#e8efff;z-index:99999;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:6vh 15px 40px;font:14px/1.6 system-ui,sans-serif}
.ssc-shell,.ssc-staffbox{background:#141f32;border:1px solid #344561;box-shadow:0 18px 80px #0008;padding:28px;border-radius:18px;width:min(100%,480px)}
.ssc-staffbox{width:min(100%,850px)}.ssc-mark{font-size:31px;color:#b4adff}.ssc-heading{font-size:25px;font-weight:800;letter-spacing:-.6px}.ssc-heading span{color:#aaa7ff}
.ssc-muted,.ssc-caption{color:#a6b7d2}.ssc-caption{font-size:12px}.ssc-shell label{display:block;font-weight:700;font-size:12px;margin-top:14px;margin-bottom:5px}
.ssc-shell input,.ssc-user select{width:100%;box-sizing:border-box;border:1px solid #486080;border-radius:9px;padding:11px;background:#0c1524;color:#fff;font:inherit}
 .ssc-shell .ssc-title-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ssc-shell .ssc-title-row button{white-space:nowrap;font-size:12px;padding:7px 10px}.ssc-shell button[hidden]{display:none!important}.ssc-shell .ssc-password-toggle{display:block;margin:8px 0 0 auto;font-size:12px;padding:6px 11px}
.ssc-row{display:flex;gap:10px;margin-top:15px;flex-wrap:wrap}.ssc-row>button{flex:1}.ssc-shell button,.ssc-staffbox button{cursor:pointer;border:1px solid #8a89d8;background:#7978d6;color:#fff;border-radius:9px;padding:9px 13px;font-weight:720;font:inherit}
.ssc-methods{display:flex;gap:8px;margin:16px 0}.ssc-methods button{flex:1;font-size:12px;padding:9px 6px}.ssc-methods .ssc-selected{background:#7978d6!important;border-color:#9c9bfd!important;color:#fff!important}.ssc-shell button.ssc-light,.ssc-staffbox button.ssc-light{background:#25324c;border-color:#49607d}.ssc-shell button:hover,.ssc-staffbox button:hover{filter:brightness(1.2)}
.ssc-banned{color:#ff657b;font-weight:950;font-size:35px;letter-spacing:1px;text-align:center;margin:18px 0 8px}.ssc-user{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #33425c;padding:12px 0}
.ssc-user>div{flex:1;min-width:190px}.ssc-user small{display:block;color:#a8b5cb;overflow-wrap:anywhere}.ssc-user select{width:150px}.ssc-title-row{display:flex;justify-content:space-between;gap:15px}.ssc-staffbox h3{margin:24px 0 3px}.ssc-audit{padding:7px 0;border-bottom:1px solid #2e3a52;font-size:12px;color:#b5c3dd}

 #ssCloudOwnerTop[hidden],#ssCloudOwnerNav[hidden],#ssCloudOwnerQuick[hidden],#ssCloudStaffBtn[hidden]{display:none!important}
 #ssCloudOwnerNav{color:#e4d9ff}#ssCloudOwnerTop{white-space:nowrap}#ssCloudOwnerQuick{border-color:#9d85e9}
 #ssCloudStaffDialog .ssc-staffbox{width:min(100%,1010px);outline:0}
 #ssCloudStaffDialog .ssc-admin-summary{margin:15px 0;padding:12px;background:#1b2a43;border-radius:10px;border:1px solid #354867;font-size:13px;color:#d3e3ff}
 #ssCloudStaffDialog .ssc-admin-section{margin:16px 0 22px;border-top:1px solid #34435c;padding-top:10px}
 #ssCloudStaffDialog .ssc-admin-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
 #ssCloudStaffDialog .ssc-admin-tools input,#ssCloudStaffDialog .ssc-admin-tools select{min-width:150px;flex:1;background:#0c1524;color:#fff;border:1px solid #486080;border-radius:9px;padding:10px;font:inherit}
 #ssCloudStaffDialog .ssc-user[hidden]{display:none!important}#ssCloudStaffDialog .ssc-title-row{align-items:center}
 @media(max-width:720px){#ssCloudStaffDialog .ssc-user{align-items:flex-start}#ssCloudStaffDialog .ssc-user select{max-width:100%}}
`;document.head.append(style)}
addStyling();
if(!ready){
 // GitHub-only version works normally, but stays local; make this crystal clear.
 const banner=document.createElement('div');banner.id='ssCloudSetupBanner';banner.setAttribute('role','status');banner.textContent='☁ GitHub-only mode: accounts, bans and study saves stay in this browser. Set up Supabase and edit cloud-config.js for cross-device accounts.';
 banner.style.cssText='position:relative;z-index:3;background:#1c2940;border:1px solid #405277;color:#dbe6ff;padding:9px 14px;font:12px/1.6 system-ui,sans-serif;text-align:center';document.body.prepend(banner);return;
}
showGate('loading');
function startCloud(){if(!window.supabase?.createClient){cloudNotice('Cloud library failed to load. Reload with an internet connection.');return}
 client=window.supabase.createClient(cfg.url.trim().replace(/\/$/,''),cfg.publishableKey.trim());boot()}
if(window.supabase?.createClient)startCloud();
else {const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.onload=startCloud;
 script.onerror=()=>cloudNotice('Could not load the Cloud library. Check your internet connection or browser extensions.');document.head.append(script)}
})();
