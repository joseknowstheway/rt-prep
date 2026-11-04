/* RT Registry Prep — offline-first study app with optional Firebase sync. */
"use strict";
const QDATA = window.QDATA || [];
const SECTIONS = [
  {k:"pc", name:"Patient Care"},
  {k:"pr", name:"Physics & Radiobiology"},
  {k:"pq", name:"Protection & QA"},
  {k:"tp", name:"Planning & Dosimetry"},
  {k:"td", name:"Delivery & Oncology"}
];
const SECNAME = Object.fromEntries(SECTIONS.map(s=>[s.k,s.name]));
const QBY = {}; QDATA.forEach(q=>QBY[q.id]=q);
const L = "ABCD";
const PASS = 75;
// ARRT 2026 Primary Eligibility Pathway Handbook, Radiation Therapy: 230 items (200 scored + 30 pilot)
// in a 230-minute test time. Timed practice exams get one clock at that pace, scaled to their length.
const OFFICIAL = {items:230, minutes:230};
const examLimitSec = n=>Math.round(n*OFFICIAL.minutes*60/OFFICIAL.items);

/* ---------- utils ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle = a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const permStr = ()=>shuffle([0,1,2,3]).join("");
const now = ()=>Date.now();
const fmtDT = t=>new Date(t).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const fmtDur = s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(x).padStart(2,"0")};
const fmtMin = s=>{const m=Math.round(s/60),h=Math.floor(m/60);return h?`${h} h${m%60?" "+m%60+" min":""}`:m+" min"};
const pct = (a,b)=>b?Math.round(100*a/b):0;
const clone = o=>o==null?o:JSON.parse(JSON.stringify(o));
const uuid = ()=>{ if(crypto.randomUUID) return crypto.randomUUID(); const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=b[6]&15|64; b[8]=b[8]&63|128; const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join(""); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const parseTs = s=>Date.parse(String(s).replace(/(\.\d{3})\d+/,"$1"));
const ICON = {
  study:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/></svg>',
  exams:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
  history:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  skip:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6l7 6-7 6M13 6l7 6-7 6"/></svg>',
  flag:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>'
};

/* =====================================================================
   LOCAL DATA (always the source the UI reads)
   ===================================================================== */
const LS = {
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast("This device's storage is full. Export a backup in Settings.")}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
// attempts: {id, qid, t (ms), r (0 incorrect, 1 correct, 2 skipped), c (canonical option index or -1), src ("s" study, "x" exam)}
const D = {
  attempts: LS.get("rt.attempts",[]),
  exams:    LS.get("rt.exams",{}),
  active:   LS.get("rt.active",null),
  outbox:   LS.get("rt.outbox",[]),
  meta:     LS.get("rt.meta",{since:null,lastSync:null})
};
const save = (...keys)=>keys.forEach(k=>LS.set("rt."+k,D[k]));
let byQ=null;
function index(){ if(!byQ){byQ={}; for(const a of D.attempts)(byQ[a.qid]||(byQ[a.qid]=[])).push(a); for(const k in byQ) byQ[k].sort((x,y)=>x.t-y.t);} return byQ; }
function attempts(qid){ return (index()[qid]||[]).map(a=>[Math.round(a.t/1000),a.r,a.c,a.src]); }
function addAttempts(list){
  for(const it of list){
    const rec={id:uuid(), qid:it.qid, t:it.t||now(), r:it.r, c:it.c, src:it.src};
    D.attempts.push(rec); D.outbox.push({k:"a",row:rec});
  }
  byQ=null; save("attempts","outbox"); scheduleFlush(1200);
}
function setActive(obj){
  D.active = obj ? Object.assign(obj,{updatedAt:now()}) : null;
  D.outbox = D.outbox.filter(o=>!(o.k==="s"&&o.key==="active_exam"));
  D.outbox.push({k:"s",key:"active_exam",data:D.active,at:now()});
  save("active","outbox"); scheduleFlush(1500);
}
function addExam(res){ D.exams[res.id]=res; D.outbox.push({k:"x",row:res}); save("exams","outbox"); scheduleFlush(800); }

/* =====================================================================
   FIREBASE SYNC (Auth + Firestore REST over fetch; no SDK)
   ===================================================================== */
const CFG = window.RT_CONFIG||{};
const FB_KEY = String(CFG.firebaseApiKey||"");
const FB_PROJECT = String(CFG.firebaseProjectId||"");
const SYNC_READY = FB_KEY.length>20 && !/^YOUR-/.test(FB_KEY) && /^[a-z0-9-]+$/.test(FB_PROJECT);
const FS_DB = `projects/${FB_PROJECT}/databases/(default)/documents`;
const FS_URL = "https://firestore.googleapis.com/v1/"+FS_DB;
// Both member accounts share one data space. The members list (spaces/main.members, a list of
// auth uids) is managed with admin access only; firestore.rules deny every other account.
const SPACE = "/spaces/main";
const AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts:";
const AUTH_ERR = {
  EMAIL_EXISTS:"An account with that email already exists. Sign in instead.",
  EMAIL_NOT_FOUND:"Email or password is incorrect.", INVALID_PASSWORD:"Email or password is incorrect.", INVALID_LOGIN_CREDENTIALS:"Email or password is incorrect.",
  INVALID_EMAIL:"That email address isn't valid.", WEAK_PASSWORD:"Use a password of at least 6 characters.",
  USER_DISABLED:"This account has been disabled.", TOO_MANY_ATTEMPTS_TRY_LATER:"Too many attempts. Wait a few minutes and try again.",
  OPERATION_NOT_ALLOWED:"Email sign-in isn't enabled for this Firebase project.", ADMIN_ONLY_OPERATION:"New sign-ups are turned off for this app."
};
let session = LS.get("rt.session",null);
let syncing=false, syncAgain=false, flushTimer=null, lastErr=null, refreshing=null;

// Accepts both sign-in responses (idToken, localId…) and token-refresh responses (id_token, user_id…).
function setSession(d){
  session={access_token:d.idToken||d.id_token, refresh_token:d.refreshToken||d.refresh_token,
    expires_at: Math.floor(now()/1000)+(+(d.expiresIn||d.expires_in)||3600),
    user:{id:d.localId||d.user_id, email:d.email||(session&&session.user.email)}};
  LS.set("rt.session",session);
}
function clearSession(){ session=null; LS.del("rt.session"); }
async function authPost(url,body,form){
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":form?"application/x-www-form-urlencoded":"application/json"},body:form?new URLSearchParams(body):JSON.stringify(body)});
  let j={}; try{j=await r.json()}catch(e){}
  if(!r.ok){ const m=String((j.error&&j.error.message)||""); const err=new Error(AUTH_ERR[m.split(/[ :]/)[0]]||m||("Request failed ("+r.status+")")); err.status=r.status; throw err; }
  return j;
}
async function refreshSession(){
  if(!session) return false;
  if(refreshing) return refreshing;
  refreshing=(async()=>{
    try{ setSession(await authPost("https://securetoken.googleapis.com/v1/token?key="+FB_KEY,{grant_type:"refresh_token",refresh_token:session.refresh_token},true)); return true; }
    catch(e){ if(e.status>=400&&e.status<500){ clearSession(); lastErr="Signed out. Sign in again in Settings."; return false; } throw e; }
    finally{ refreshing=null; }
  })();
  return refreshing;
}
async function api(path,opts={},retry=true){
  if(!session) throw new Error("Not signed in");
  if(session.expires_at-60 < now()/1000){ if(!(await refreshSession())) throw new Error("Not signed in"); }
  const r=await fetch(FS_URL+path,Object.assign({},opts,{headers:Object.assign({Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},opts.headers||{})}));
  if(r.status===401&&retry){ if(await refreshSession()) return api(path,opts,false); throw new Error("Not signed in"); }
  if(!r.ok&&!(r.status===404&&opts.allow404)){ let t=""; try{t=(await r.json()).error.message||""}catch(e){} const err=new Error(r.status===403?"This account doesn't have access to the shared study data.":t||("Server error "+r.status)); err.status=r.status; throw err; }
  return r;
}
async function signIn(email,password){ setSession(await authPost(AUTH_URL+"signInWithPassword?key="+FB_KEY,{email,password,returnSecureToken:true})); lastErr=null; D.meta.since=D.meta.xsince=null; save("meta"); await syncNow(true); }
async function signUp(email,password){
  setSession(await authPost(AUTH_URL+"signUp?key="+FB_KEY,{email,password,returnSecureToken:true}));
  lastErr=null; D.meta.since=D.meta.xsince=null; save("meta"); await syncNow(true);
  return "Account created and signed in.";
}
async function signOut(){ clearSession(); updateSyncPill(); }

/* ---------- Firestore value encoding ---------- */
const fsVal = v=>v===null?{nullValue:null}:typeof v==="boolean"?{booleanValue:v}:Number.isInteger(v)?{integerValue:String(v)}:typeof v==="number"?{doubleValue:v}:v instanceof Date?{timestampValue:v.toISOString()}:{stringValue:String(v)};
const fsFields = o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,fsVal(v)]));
const fsGet = (doc,k)=>{ const v=doc.fields&&doc.fields[k]; if(!v) return undefined; if("integerValue" in v) return +v.integerValue; if("doubleValue" in v) return v.doubleValue; if("booleanValue" in v) return v.booleanValue; if("timestampValue" in v) return v.timestampValue; return v.stringValue; };
const docId = name=>name.slice(name.lastIndexOf("/")+1);
const runQuery = async q=>(await (await api(SPACE+":runQuery",{method:"POST",body:JSON.stringify({structuredQuery:q})})).json()).filter(x=>x.document).map(x=>x.document);
// Calls each(doc) for every doc in a collection created after `since` (server created_at, with a
// 5-minute overlap), paging by (created_at, name). Returns the newest created_at seen.
async function pullSince(coll,since,each){
  const where = since ? {fieldFilter:{field:{fieldPath:"created_at"},op:"GREATER_THAN",value:{timestampValue:new Date(parseTs(since)-300000).toISOString()}}} : null;
  let after=null, maxC=since;
  for(;;){
    const q={from:[{collectionId:coll}],orderBy:[{field:{fieldPath:"created_at"},direction:"ASCENDING"},{field:{fieldPath:"__name__"},direction:"ASCENDING"}],limit:1000};
    if(where) q.where=where;
    if(after) q.startAt={values:after,before:false};
    const docs=await runQuery(q);
    for(const d of docs){ const c=fsGet(d,"created_at"); if(!maxC||parseTs(c)>parseTs(maxC)) maxC=c; each(d); }
    if(docs.length<1000) return maxC;
    const last=docs[docs.length-1]; after=[last.fields.created_at,{referenceValue:last.name}];
  }
}

function scheduleFlush(ms){ clearTimeout(flushTimer); updateSyncPill(); flushTimer=setTimeout(()=>syncNow(false),ms||1000); }
async function syncNow(pull){
  if(!SYNC_READY||!session||!navigator.onLine){ updateSyncPill(); return; }
  if(syncing){ syncAgain=true; return; }
  syncing=true; updateSyncPill();
  let changed=false;
  try{ await flush(); if(pull) changed=await pull_(); D.meta.lastSync=now(); lastErr=null; save("meta"); }
  catch(e){ lastErr=e&&e.message?e.message:String(e); }
  syncing=false; updateSyncPill();
  if(changed) onData(false);
  if(syncAgain){ syncAgain=false; syncNow(false); }
}
async function flush(){
  const base=FS_DB+SPACE;
  let guard=0;
  while(D.outbox.length && guard++<200){
    const op=D.outbox[0];
    if(op.k==="a"){
      // Attempts are create-only. A commit is atomic, so when one was already uploaded
      // the server answers 409 naming it: drop that one and retry the rest.
      let batch=D.outbox.filter(o=>o.k==="a").slice(0,500);
      while(batch.length){
        try{
          await api(":commit",{method:"POST",body:JSON.stringify({writes:batch.map(o=>({
            update:{name:`${base}/attempts/${o.row.id}`,fields:fsFields({qid:o.row.qid,answered_at:new Date(o.row.t),result:o.row.r,choice:o.row.c,source:o.row.src})},
            updateTransforms:[{fieldPath:"created_at",setToServerValue:"REQUEST_TIME"}],
            currentDocument:{exists:false}}))})});
          break;
        }catch(e){
          const dup=e.status===409&&batch.find(o=>e.message.endsWith("/attempts/"+o.row.id)); if(!dup) throw e;
          batch=batch.filter(o=>o!==dup); D.outbox=D.outbox.filter(o=>o!==dup);
        }
      }
      const sent=new Set(batch); D.outbox=D.outbox.filter(o=>!sent.has(o));
    }else if(op.k==="x"){
      const r=op.row;
      await api(":commit",{method:"POST",body:JSON.stringify({writes:[{
        update:{name:`${base}/exams/${r.id}`,fields:fsFields({started_at:new Date(r.startedAt),ended_at:new Date(r.endedAt),timed:!!r.timed,n:r.n,correct:r.correct,data:JSON.stringify(r)})},
        updateTransforms:[{fieldPath:"created_at",setToServerValue:"REQUEST_TIME"}]}]})});
      D.outbox=D.outbox.filter(o=>o!==op);
    }else if(op.k==="s"){
      const path=`${SPACE}/app_state/${encodeURIComponent(op.key)}`;
      if(op.data) await api(path,{method:"PATCH",body:JSON.stringify({fields:fsFields({data:JSON.stringify(op.data),updated_at:new Date(op.at)})})});
      else await api(path,{method:"DELETE"});
      D.outbox=D.outbox.filter(o=>o!==op);
    }else{ D.outbox.shift(); }
    save("outbox"); updateSyncPill();
  }
}
async function pull_(){
  let changed=false;
  // attempts: dedupe by id
  const have=new Set(D.attempts.map(a=>a.id)); let na=0;
  D.meta.since=await pullSince("attempts",D.meta.since,d=>{
    const id=docId(d.name); if(have.has(id)) return; have.add(id);
    D.attempts.push({id,qid:fsGet(d,"qid"),t:parseTs(fsGet(d,"answered_at")),r:fsGet(d,"result"),c:fsGet(d,"choice"),src:fsGet(d,"source")}); na++;
  });
  if(na){ byQ=null; save("attempts"); changed=true; }
  // finished exams this device hasn't seen
  let nx=0;
  D.meta.xsince=await pullSince("exams",D.meta.xsince,d=>{
    let x=null; try{x=JSON.parse(fsGet(d,"data"))}catch(e){}
    if(x&&x.id&&!D.exams[x.id]){ D.exams[x.id]=x; nx++; }
  });
  if(nx){ save("exams"); changed=true; }
  // exam in progress: newest version wins unless this device has an unsent change
  if(!D.outbox.some(o=>o.k==="s")){
    const r=await api(SPACE+"/app_state/active_exam?mask.fieldPaths=data",{allow404:true});
    let next=D.active;
    if(r.status!==404){ let rd=null; try{rd=JSON.parse(fsGet(await r.json(),"data"))}catch(e){} if(rd&&(!D.active||(rd.updatedAt||0)>(D.active.updatedAt||0))) next=rd; }
    else next=null;
    if(next&&D.exams[next.id]) next=null;
    if(JSON.stringify(next)!==JSON.stringify(D.active)){ D.active=next; save("active"); changed=true; }
  }
  return changed;
}
function syncLabel(){
  const n=D.outbox.length;
  if(!SYNC_READY) return ["local","This device only"];
  if(!session) return ["local","Not signed in"];
  if(!navigator.onLine) return ["saving",n?`Offline · ${n} waiting`:"Offline"];
  if(syncing) return ["saving","Syncing…"];
  if(lastErr) return ["err","Sync error"];
  if(n) return ["saving",`${n} waiting`];
  return ["ok","Synced"];
}
function updateSyncPill(){ const [s,t]=syncLabel(); const el=$("#sync"); if(!el) return; el.dataset.s=s; el.querySelector("span").textContent=t; if(S.tab==="settings"&&!document.activeElement.matches("input")) refreshSettingsStatus(); }

/* ---------- history model ---------- */
function status(qid){
  const a=attempts(qid); if(!a.length) return "u";
  if(a.length>=3&&a.slice(-3).every(x=>x[1]===1)) return "mastered";
  return ["i","c","s"][a[a.length-1][1]];
}
const STATUS_LABEL={mastered:"Mastered",c:"Correct last",i:"Missed last",s:"Skipped last",u:"Unseen"};
function secStats(sec){
  const qs=QDATA.filter(q=>sec==="all"||q.s===sec);
  const o={total:qs.length,mastered:0,c:0,i:0,s:0,u:0,att:0,cor:0};
  qs.forEach(q=>{o[status(q.id)]++;attempts(q.id).forEach(a=>{if(a[1]!==2){o.att++;if(a[1]===1)o.cor++}})});
  return o;
}

/* =====================================================================
   APP SHELL
   ===================================================================== */
const S = {
  tab:"study",
  study:{view:"setup", sec:"all", pool:"all", len:"all", sess:null},
  exams:{view:"home", resultId:null, len:200, timed:true, filter:"all"},
  hist:{sec:"all", st:"all", q:"", sel:null},
  auth:{mode:"in", msg:null, busy:false}
};
const TABS=[["study","Study"],["exams","Exams"],["history","History"],["settings","Account"]];
{ const t=LS.get("rt.tab","study"); if(TABS.some(x=>x[0]===t)) S.tab=t; }
function setTab(t){S.tab=t;LS.set("rt.tab",t);renderNav();render(true)}
function renderNav(){
  const html=TABS.map(([k,l])=>`<button class="tab" data-tab="${k}" ${S.tab===k?'aria-current="page"':''}>${ICON[k]}<span>${l}</span>${k==="exams"&&D.active?'<i class="badge" title="Exam in progress"></i>':''}${k==="settings"&&SYNC_READY&&!session?'<i class="badge" title="Not signed in"></i>':''}</button>`).join("");
  $("#tabbar").innerHTML=html;
  $("#rail").innerHTML=html+`<div class="rail-foot">${QDATA.length} questions across 5 ARRT content areas. Independent study aid.</div>`;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-tab]");if(t)setTab(t.dataset.tab)});
function render(scrollTop){
  const m=$("#main");
  if(S.tab==="study") m.innerHTML=renderStudy();
  else if(S.tab==="exams") m.innerHTML=renderExams();
  else if(S.tab==="history") m.innerHTML=renderHistory();
  else m.innerHTML=renderSettings();
  if(scrollTop) m.scrollTop=0;
  if(S.tab==="history") renderHistList();
  if(S.tab==="exams"&&S.exams.view==="run") tickTimer();
}
function onData(){
  renderNav();
  const busy=(S.tab==="study"&&S.study.view==="card")||(S.tab==="exams"&&S.exams.view==="run"&&D.active);
  if(busy) return;
  const ae=document.activeElement;
  if(ae&&ae.matches&&ae.matches("input")){ if(S.tab==="history") renderHistList(); return; }
  const m=$("#main"), st=m.scrollTop; render(false); m.scrollTop=st;
}
let toastT;
function toast(msg){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.appendChild(t)}t.textContent=msg;clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),3400)}
function modal(html){ $("#layer").innerHTML=`<div class="scrim" data-close><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; const f=$("#layer .sheet button");f&&f.focus(); }
function closeModal(){$("#layer").innerHTML=""}
document.addEventListener("click",e=>{if(e.target.matches("[data-close]"))closeModal()});

/* =====================================================================
   STUDY
   ===================================================================== */
function poolIds(sec,pool){
  return QDATA.filter(q=>sec==="all"||q.s===sec).filter(q=>{
    const a=attempts(q.id);
    if(pool==="unseen") return a.length===0;
    if(pool==="last") return a.length>0 && a[a.length-1][1]!==1;
    if(pool==="ever") return a.some(x=>x[1]!==1);
    return true;
  }).map(q=>q.id);
}
function renderStudy(){
  const st=S.study;
  if(st.view==="card"&&st.sess) return renderCard();
  if(st.view==="done"&&st.sess) return renderStudyDone();
  const counts=Object.fromEntries(["all",...SECTIONS.map(s=>s.k)].map(k=>[k,poolIds(k,st.pool).length]));
  const n=poolIds(st.sec,st.pool).length;
  const pools=[["all","All questions","Shuffle the whole set"],["last","Missed or skipped","Your most recent attempt was wrong or skipped"],["ever","Ever missed or skipped","Wrong or skipped at least once"],["unseen","Not yet seen","Never attempted"]];
  const pc=Object.fromEntries(pools.map(p=>[p[0],poolIds(st.sec,p[0]).length]));
  const lens=[["10","10"],["25","25"],["50","50"],["all","All"]];
  const willDo = st.len==="all"?n:Math.min(n,+st.len);
  return `<div class="wrap">
    <div class="stack" style="gap:6px"><div class="eyebrow">Study</div><h1 class="h1">Flashcards</h1>
    <p class="sub">Answer each card, see the rationale, and every attempt is logged to your history.</p></div>
    <section class="panel stack" aria-labelledby="l-sec"><div class="lab" id="l-sec">Content area</div>
      <div class="chips">${[["all","All areas"],...SECTIONS.map(s=>[s.k,s.name])].map(([k,l])=>`<button class="chip" data-act="st-sec" data-v="${k}" aria-pressed="${st.sec===k}">${esc(l)}<span class="n">${counts[k]}</span></button>`).join("")}</div>
    </section>
    <section class="panel stack" aria-labelledby="l-pool"><div class="lab" id="l-pool">Which questions</div>
      <div class="choices two">${pools.map(([k,l,d])=>`<button class="choice" data-act="st-pool" data-v="${k}" aria-pressed="${st.pool===k}" ${pc[k]===0&&st.pool!==k?"disabled":""}><span><b>${l}</b><br><span style="font-size:13px;color:var(--muted)">${d}</span></span><span class="n">${pc[k]}</span></button>`).join("")}</div>
    </section>
    <section class="panel stack" aria-labelledby="l-len"><div class="lab" id="l-len">Session length</div>
      <div class="chips">${lens.map(([k,l])=>`<button class="chip" data-act="st-len" data-v="${k}" aria-pressed="${st.len===k}">${l}</button>`).join("")}</div>
    </section>
    <button class="btn primary wide" data-act="st-start" ${willDo?"":"disabled"} style="min-height:54px;font-size:17px">${willDo?`Start ${willDo} card${willDo>1?"s":""}`:"No questions match"}</button>
    ${masteryPanel()}
  </div>`;
}
function masteryPanel(){
  const rows=SECTIONS.map(s=>{const o=secStats(s.k);
    const seg=(v,c)=>v?`<span style="width:${100*v/o.total}%;background:${c}"></span>`:"";
    return `<div class="secrow"><span class="nm">${esc(s.name)}</span><span class="st">${o.mastered}/${o.total} mastered · ${o.att?pct(o.cor,o.att)+"%":"—"}</span>
    <div class="bar" aria-hidden="true">${seg(o.mastered,"var(--ok)")}${seg(o.c,"var(--iso-cold)")}${seg(o.i,"var(--bad)")}${seg(o.s,"var(--iso-warm)")}</div></div>`}).join("");
  return `<section class="panel stack"><h2 class="h2">Coverage by area</h2>
    <div class="secs">${rows}</div>
    <div class="legend"><span><i style="background:var(--ok)"></i>Mastered (last 3 correct)</span><span><i style="background:var(--iso-cold)"></i>Correct last</span><span><i style="background:var(--bad)"></i>Missed last</span><span><i style="background:var(--iso-warm)"></i>Skipped last</span><span><i style="background:var(--sunk)"></i>Unseen</span></div></section>`;
}
function startStudy(ids){
  if(!ids.length){toast("No questions match those filters.");return}
  const deck=shuffle(ids);
  S.study.sess={deck, i:0, e:{}};
  deck.forEach(id=>S.study.sess.e[id]={perm:permStr(),chosen:null,res:null,flipped:false});
  S.study.view="card"; render(true);
}
function curCard(){const s=S.study.sess;return {s,id:s.deck[s.i],e:s.e[s.deck[s.i]]}}
function renderCard(){
  const {s,id,e}=curCard(); const q=QBY[id]; const perm=[...e.perm].map(Number);
  const tally={c:0,i:0,s:0}; Object.values(s.e).forEach(x=>{if(x.res)tally[x.res]++});
  const answered=e.res==="c"||e.res==="i";
  const opts=perm.map((oi,pos)=>{
    let cls=""; if(answered){ if(oi===q.a) cls="correct"; else if(oi===e.chosen) cls="wrong"; else cls="dim"; }
    return `<li><button class="opt ${cls}" data-act="st-ans" data-v="${oi}" ${answered?"disabled":""}><span class="k">${L[pos]}</span><span>${esc(q.o[oi])}</span></button></li>`}).join("");
  const posOf=oi=>L[perm.indexOf(oi)];
  const dots=attempts(id).slice(-12).map(x=>`<span class="dot ${["i","c","s"][x[1]]}" title="${["Incorrect","Correct","Skipped"][x[1]]} · ${fmtDT(x[0]*1000)}"></span>`).join("");
  const verdict = e.res==="c"?["c","Correct",ICON.check]:["i","Incorrect",ICON.x];
  const back = answered?`
    <div class="verdict ${verdict[0]}"><span class="ic">${verdict[2]}</span><h3>${verdict[1]}</h3></div>
    ${e.res==="i"?`<div class="ansline bad"><span class="k">${posOf(e.chosen)}</span><span><small>Your answer</small>${esc(q.o[e.chosen])}</span></div>`:""}
    <div class="ansline ok"><span class="k">${posOf(q.a)}</span><span><small>Correct answer</small>${esc(q.o[q.a])}</span></div>
    <div class="rat">${esc(q.r)}</div>
    <div class="row" style="justify-content:space-between"><div class="dots" aria-label="Your recent attempts on this question">${dots}</div>
    <button class="btn ghost" data-act="st-flip" style="min-height:40px;padding:8px 10px">Show question</button></div>`:"";
  const last = s.i===s.deck.length-1;
  return `<div class="wrap">
    <div class="studyhead">
      <button class="btn ghost back-link" data-act="st-end" style="padding:8px 4px;min-height:40px">‹ End session</button>
      <div class="tally" aria-label="Session tally"><span class="c">✓ ${tally.c}</span><span class="i">✕ ${tally.i}</span><span class="s">» ${tally.s}</span></div>
    </div>
    <div class="row" style="gap:12px"><span class="mono" style="font-size:13px;color:var(--muted)">${s.i+1} / ${s.deck.length}</span><div class="progress"><span style="width:${100*(s.i+1)/s.deck.length}%"></span></div></div>
    <div class="scene"><article class="card ${answered&&e.flipped?"flipped":""}" id="card">
      <div class="face front" aria-hidden="${answered&&e.flipped}">
        <div class="cardmeta"><span class="sectag">${esc(SECNAME[q.s])}</span><span class="qid">${id.toUpperCase()}</span></div>
        <h2 class="stem">${esc(q.q)}</h2>
        ${e.res==="s"?`<div class="note skip">You skipped this one. Answer it now or move on.</div>`:""}
        <ol class="opts grid2">${opts}</ol>
        ${answered?`<button class="btn ghost" data-act="st-flip" style="align-self:flex-end;min-height:40px;padding:8px 10px">Show answer ›</button>`:""}
      </div>
      <div class="face back" aria-hidden="${!(answered&&e.flipped)}">${back}</div>
    </article></div>
    <div class="controls">
      <button class="btn" data-act="st-back" ${s.i===0?"disabled":""}>‹ Back</button>
      ${answered?`<button class="btn primary" data-act="st-next">${last?"Finish":"Next ›"}</button>`:`<button class="btn" data-act="st-skip">Skip ${ICON.skip}</button>`}
    </div>
    <div class="kbd">Keys: A–D or 1–4 answer · S skip · ← back · → next · Space flip</div>
  </div>`;
}
function studyAnswer(oi){
  const {id,e}=curCard(); if(e.res==="c"||e.res==="i") return;
  const q=QBY[id]; e.chosen=oi; e.res=(oi===q.a)?"c":"i";
  addAttempts([{qid:id,r:e.res==="c"?1:0,c:oi,src:"s"}]);
  render(false); flash(e.res);
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(()=>{ if(S.study.view==="card"&&curCard().id===id){ e.flipped=true; const c=$("#card"); if(c){c.classList.add("flipped"); c.querySelector(".front").setAttribute("aria-hidden","true"); c.querySelector(".back").setAttribute("aria-hidden","false");} } }, reduce?650:820);
}
function flash(kind){
  const d=document.createElement("div"); d.className="flash "+kind; d.setAttribute("aria-hidden","true");
  d.innerHTML=`<div>${kind==="c"?'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'}</div>`;
  document.body.appendChild(d); setTimeout(()=>d.remove(),800);
  let live=$("#sr"); if(!live){live=document.createElement("div");live.id="sr";live.setAttribute("role","status");live.style.cssText="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";document.body.appendChild(live)}
  live.textContent=kind==="c"?"Correct":"Incorrect";
}
function studySkip(){
  const {id,e}=curCard();
  if(e.res!=="c"&&e.res!=="i"){ if(e.res!=="s") addAttempts([{qid:id,r:2,c:-1,src:"s"}]); e.res="s"; }
  studyNext();
}
function studyNext(){const s=S.study.sess; if(s.i<s.deck.length-1){s.i++;render(true)} else {S.study.view="done";render(true)}}
function studyBack(){const s=S.study.sess; if(s.i>0){s.i--;render(true)}}
function studyFlip(){const {e}=curCard(); if(e.res!=="c"&&e.res!=="i")return; e.flipped=!e.flipped; const c=$("#card"); if(c){c.classList.toggle("flipped",e.flipped);c.querySelector(".front").setAttribute("aria-hidden",String(e.flipped));c.querySelector(".back").setAttribute("aria-hidden",String(!e.flipped))}}
function renderStudyDone(){
  const s=S.study.sess; const t={c:0,i:0,s:0}; Object.values(s.e).forEach(x=>{if(x.res)t[x.res]++});
  const unseen=s.deck.length-t.c-t.i-t.s;
  const miss=s.deck.filter(id=>s.e[id].res==="i"||s.e[id].res==="s");
  return `<div class="wrap">
    <div class="stack" style="gap:6px"><div class="eyebrow">Session complete</div><h1 class="h1">${pct(t.c,t.c+t.i)}% correct</h1>
    <p class="sub">${t.c} correct, ${t.i} incorrect, ${t.s} skipped${unseen?`, ${unseen} not reached`:""} out of ${s.deck.length} cards.</p></div>
    <div class="stats"><div class="stat"><b style="color:var(--ok)">${t.c}</b><span>Correct</span></div><div class="stat"><b style="color:var(--bad)">${t.i}</b><span>Incorrect</span></div><div class="stat"><b style="color:var(--skip)">${t.s}</b><span>Skipped</span></div><div class="stat"><b>${s.deck.length}</b><span>Cards</span></div></div>
    <div class="row">
      ${miss.length?`<button class="btn primary" data-act="st-redo">Retry ${miss.length} missed or skipped</button>`:""}
      <button class="btn" data-act="st-review">Review this session</button>
      <button class="btn" data-act="st-new">New session</button>
    </div>
    ${masteryPanel()}
  </div>`;
}

/* =====================================================================
   EXAMS
   ===================================================================== */
function examComposition(n){
  const tot=QDATA.length; const cnt={}; SECTIONS.forEach(s=>cnt[s.k]=QDATA.filter(q=>q.s===s.k).length);
  const raw=SECTIONS.map(s=>({k:s.k,v:n*cnt[s.k]/tot})); const out={}; let used=0;
  raw.forEach(r=>{out[r.k]=Math.floor(r.v);used+=out[r.k]});
  raw.sort((a,b)=>(b.v%1)-(a.v%1)).slice(0,n-used).forEach(r=>out[r.k]++);
  return out;
}
function startExam(){
  if(D.active) return;
  const n=S.exams.len, comp=examComposition(n);
  let ids=[]; SECTIONS.forEach(s=>{ids=ids.concat(shuffle(QDATA.filter(q=>q.s===s.k).map(q=>q.id)).slice(0,comp[s.k]))});
  ids=shuffle(ids);
  const perm={}; ids.forEach(id=>perm[id]=permStr());
  setActive({id:"x"+now(),startedAt:now(),timed:S.exams.timed,limitSec:examLimitSec(n),n,ids,perm,ans:{},flags:[],cur:0});
  S.exams.view="run"; renderNav(); render(true);
}
const ex=()=>D.active;
function exMut(fn){ if(!D.active) return; const a=clone(D.active); fn(a); setActive(a); }
const remaining=a=>a.timed?(a.startedAt+a.limitSec*1000-now())/1000:null;
function checkExamExpiry(){const a=ex(); if(a&&a.timed&&remaining(a)<=0) submitExam(true)}
setInterval(()=>{ if(S.tab==="exams"&&S.exams.view==="run") tickTimer(); else checkExamExpiry(); },1000);
function tickTimer(){
  const a=ex(); const el=$("#timer"); if(!a||!el) return;
  if(a.timed){const r=remaining(a); if(r<=0){submitExam(true);return} el.textContent=fmtDur(r); el.classList.toggle("low",r<600)}
  else el.textContent=fmtDur((now()-a.startedAt)/1000);
}
function examResults(){ return Object.values(D.exams).filter(r=>r&&r.endedAt).sort((x,y)=>y.endedAt-x.endedAt); }
function renderExams(){
  const v=S.exams.view;
  if(v==="run"&&ex()) return renderExamRun();
  if(v==="result"&&D.exams[S.exams.resultId]) return renderResult(D.exams[S.exams.resultId]);
  S.exams.view="home";
  const a=ex(), results=examResults();
  const lens=[[200,"Full length","200 questions"],[100,"Half","100 questions"],[50,"Quick","50 questions"]];
  const comp=examComposition(S.exams.len);
  return `<div class="wrap">
    <div class="stack" style="gap:6px"><div class="eyebrow">Practice exams</div><h1 class="h1">Exam simulator</h1>
    <p class="sub">Questions are drawn from all five areas in proportion to the bank, shuffled, and graded when you submit. Aim for ${PASS}% or better.</p></div>
    ${a?`<section class="panel stack" style="border-color:var(--accent)"><div class="row" style="justify-content:space-between"><h2 class="h2">Exam in progress</h2><span class="mono" style="font-size:13px;color:var(--muted)">${Object.keys(a.ans).length}/${a.n} answered</span></div>
      <p class="sub" style="margin:0">Started ${fmtDT(a.startedAt)} · ${a.timed?`${fmtDur(Math.max(0,remaining(a)))} left. The clock keeps running while you're away.`:"Untimed"}</p>
      <div class="row"><button class="btn primary" data-act="ex-resume">Resume exam</button><button class="btn danger" data-act="ex-discard">Discard</button></div></section>`:`
    <section class="panel stack"><div class="lab">Length</div>
      <div class="choices">${lens.map(([n,l,d])=>`<button class="choice" data-act="ex-len" data-v="${n}" aria-pressed="${S.exams.len===n}"><span><b>${l}</b><br><span style="font-size:13px;color:var(--muted)">${d}</span></span><span class="n">${S.exams.timed?fmtMin(examLimitSec(n)):"no limit"}</span></button>`).join("")}</div>
      <div class="lab" style="margin-top:6px">Timing</div>
      <div class="chips"><button class="chip" data-act="ex-timed" data-v="1" aria-pressed="${S.exams.timed}">Timed · one clock for the whole exam</button><button class="chip" data-act="ex-timed" data-v="0" aria-pressed="${!S.exams.timed}">Untimed</button></div>
      ${S.exams.timed?`<p style="font-size:13px;color:var(--muted);margin:0">${fmtMin(examLimitSec(S.exams.len))} for all ${S.exams.len} questions, at the official ARRT pace of ${OFFICIAL.minutes} minutes for ${OFFICIAL.items} questions. Spend it however you like. When time runs out, the exam is submitted and anything unanswered is scored as incorrect.</p>`:""}
      <p style="font-size:13px;color:var(--muted);margin:0">Mix: ${SECTIONS.map(s=>`${esc(s.name)} ${comp[s.k]}`).join(" · ")}</p>
      <button class="btn primary wide" data-act="ex-start" style="min-height:54px;font-size:17px">Start ${S.exams.len}-question exam</button>
    </section>`}
    ${progressPanel(results)}
  </div>`;
}
function progressPanel(results){
  if(!results.length) return `<section class="panel stack"><h2 class="h2">Your progress</h2><div class="empty">Finished exams appear here with a score trend. Take your first one above.</div></section>`;
  const asc=results.slice().reverse(); const scores=asc.map(r=>pct(r.correct,r.n));
  const best=Math.max(...scores), avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length), latest=scores[scores.length-1];
  return `<section class="panel stack"><h2 class="h2">Your progress</h2>
    <div class="stats"><div class="stat"><b>${latest}%</b><span>Latest</span></div><div class="stat"><b>${best}%</b><span>Best</span></div><div class="stat"><b>${avg}%</b><span>Average</span></div><div class="stat"><b>${results.length}</b><span>Exams taken</span></div></div>
    ${chartSVG(asc)}
    <ul class="xlist">${results.map(r=>{const p=pct(r.correct,r.n);return `<li><button class="xitem" data-act="ex-open" data-v="${esc(r.id)}"><span class="pct" style="color:${p>=PASS?"var(--ok)":"var(--bad)"}">${p}%</span><span><b style="font-weight:600">${r.n} questions · ${r.timed?"Timed":"Untimed"}</b><br><span class="meta">${fmtDT(r.endedAt)} · ${fmtDur((r.endedAt-r.startedAt)/1000)}${r.auto?' · <span style="color:var(--bad);font-weight:600">Time ran out</span>':""}</span></span><span aria-hidden="true" style="color:var(--muted)">›</span></button></li>`}).join("")}</ul>
  </section>`;
}
function chartSVG(asc){
  const W=640,H=220,pl=40,pr=16,pt=14,pb=28; const n=asc.length;
  const x=i=>n===1?pl+(W-pl-pr)/2:pl+i*(W-pl-pr)/(n-1); const y=v=>pt+(100-v)*(H-pt-pb)/100;
  const pts=asc.map((r,i)=>[x(i),y(pct(r.correct,r.n))]);
  const grid=[0,25,50,75,100].map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="${v===PASS?"var(--ok)":"var(--line)"}" ${v===PASS?'stroke-dasharray="5 4"':""}/><text x="${pl-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("");
  const path=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area=n>1?`<path d="${path} L${pts[n-1][0]} ${y(0)} L${pts[0][0]} ${y(0)} Z" fill="var(--accent)" opacity=".1"/>`:"";
  const step=Math.ceil(n/8);
  const xl=asc.map((r,i)=>(i%step===0||i===n-1)?`<text x="${x(i)}" y="${H-8}" text-anchor="middle">${i+1}</text>`:"").join("");
  const dots=pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===n-1?5.5:3.5}" fill="${pct(asc[i].correct,asc[i].n)>=PASS?"var(--ok)":"var(--bad)"}" stroke="var(--surface)" stroke-width="2"><title>Exam ${i+1}: ${pct(asc[i].correct,asc[i].n)}%</title></circle>`).join("");
  return `<div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Exam scores over time">${grid}${area}${n>1?`<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`:""}${dots}${xl}<text x="${W-pr}" y="${y(PASS)-6}" text-anchor="end" style="fill:var(--ok)">${PASS}% target</text></svg></div>`;
}
function renderExamRun(){
  const a=ex(); const id=a.ids[a.cur]; const q=QBY[id]; const perm=[...a.perm[id]].map(Number);
  const chosen=a.ans[id]; const flagged=a.flags.includes(id);
  const opts=perm.map((oi,pos)=>`<li><button class="opt ${chosen===oi?"sel":""}" data-act="ex-ans" data-v="${oi}" aria-pressed="${chosen===oi}"><span class="k">${L[pos]}</span><span>${esc(q.o[oi])}</span></button></li>`).join("");
  return `<div class="wrap">
    <div class="examtop">
      <span style="font-size:13px;color:var(--muted)">${a.timed?"Time left":"Elapsed"}</span><span class="timer" id="timer" role="timer" aria-label="${a.timed?"Time left for the whole exam":"Time elapsed"}">--:--</span>
      <span class="mono" style="font-size:13px;color:var(--muted)">${Object.keys(a.ans).length}/${a.n} answered</span>
      <span style="flex:1"></span>
      <button class="btn navbtn-mobile" data-act="ex-grid" style="min-height:40px;padding:8px 12px">All questions</button>
      <button class="btn primary" data-act="ex-submit" style="min-height:40px;padding:8px 14px">Submit</button>
    </div>
    <div class="examgrid">
      <div class="stack" style="gap:16px">
        <div class="face" style="box-shadow:var(--shadow)">
          <div class="cardmeta"><span class="mono" style="font-size:13px;font-weight:500">Question ${a.cur+1} of ${a.n}</span>
            <button class="btn flagbtn" data-act="ex-flag" aria-pressed="${flagged}" style="min-height:36px;padding:6px 12px;font-size:14px">${ICON.flag} ${flagged?"Flagged":"Flag"}</button></div>
          <h2 class="stem">${esc(q.q)}</h2>
          <ol class="opts grid2">${opts}</ol>
        </div>
        <div class="examnav"><button class="btn" data-act="ex-prev" ${a.cur===0?"disabled":""}>‹ Previous</button><button class="btn ${a.cur===a.n-1?"primary":""}" data-act="${a.cur===a.n-1?"ex-submit":"ex-next"}">${a.cur===a.n-1?"Review & submit":"Next ›"}</button></div>
        <div class="row" style="justify-content:space-between"><button class="btn ghost" data-act="ex-leave" style="padding:8px 4px">‹ Exam menu</button><span class="kbd">A–D answer · ← → move · F flag</span></div>
      </div>
      <aside class="navpane panel stack" aria-label="Question navigator">${navGrid(a)}</aside>
    </div>
  </div>`;
}
function navGrid(a){
  return `<div class="row" style="justify-content:space-between"><b>Questions</b><span class="legend" style="gap:10px"><span><i style="background:var(--accent-soft);border:1px solid var(--accent)"></i>Answered</span><span><i style="background:var(--iso-warm);border-radius:50%"></i>Flagged</span></span></div>
  <div class="qgrid">${a.ids.map((id,i)=>`<button class="qn ${a.ans[id]!==undefined?"a":""} ${a.flags.includes(id)?"f":""} ${i===a.cur?"cur":""}" data-act="ex-go" data-v="${i}" aria-label="Question ${i+1}${a.ans[id]!==undefined?", answered":""}${a.flags.includes(id)?", flagged":""}">${i+1}</button>`).join("")}</div>`;
}
function submitPrompt(){
  const a=ex(); const un=a.n-Object.keys(a.ans).length; const fl=a.flags.length;
  modal(`<h2 class="h2">Submit exam?</h2><p class="sub" style="margin:0">${un?`${un} question${un>1?"s are":" is"} unanswered and will be scored as incorrect and recorded as missed in your history.`:"Every question is answered."}${fl?` ${fl} flagged for review.`:""}</p>
  <div class="row"><button class="btn primary" data-act="ex-confirm">Submit and grade</button><button class="btn" data-close>Keep working</button></div>`);
}
function submitExam(auto){
  const a=ex(); if(!a) return;
  const end=auto&&a.timed?Math.min(now(),a.startedAt+a.limitSec*1000):now();
  const sec={}; SECTIONS.forEach(s=>sec[s.k]=[0,0]); let correct=0; const items=[], recs=[];
  a.ids.forEach(id=>{const q=QBY[id]; if(!q) return; const c=a.ans[id]; const ok=c===q.a; sec[q.s][1]++; if(ok){sec[q.s][0]++;correct++}
    items.push([id,a.perm[id],c===undefined?-1:c,a.flags.includes(id)?1:0]);
    // unanswered questions are logged as incorrect, whether submitted by hand or when time ran out
    recs.push({qid:id,r:ok?1:0,c:c===undefined?-1:c,src:"x",t:end});});
  addExam({id:a.id,startedAt:a.startedAt,endedAt:end,timed:a.timed,limitSec:a.limitSec,n:a.n,correct,sec,items,auto:!!auto});
  setActive(null); addAttempts(recs);
  closeModal(); S.exams.view="result"; S.exams.resultId=a.id; S.exams.filter="all";
  if(S.tab!=="exams"&&auto) toast("Time ran out. Your exam was submitted and graded.");
  renderNav(); if(S.tab==="exams") render(true);
}
function renderResult(r){
  const p=pct(r.correct,r.n); const passed=p>=PASS; const f=S.exams.filter;
  const items=r.items.map((it,i)=>({i,id:it[0],perm:it[1],c:it[2],flag:it[3],auto:r.auto})).filter(it=>{const q=QBY[it.id]; if(!q) return false; const ok=it.c===q.a;
    return f==="all"||(f==="wrong"&&!ok)||(f==="right"&&ok)||(f==="blank"&&it.c===-1)||(f==="flag"&&it.flag)});
  const wrong=r.items.filter(it=>QBY[it[0]]&&it[2]!==QBY[it[0]].a).length;
  const counts={wrong,blank:r.items.filter(it=>it[2]===-1).length,flag:r.items.filter(it=>it[3]).length};
  const secRows=SECTIONS.map(s=>{const [c,n]=(r.sec&&r.sec[s.k])||[0,0]; if(!n) return ""; const sp=pct(c,n);
    return `<div class="secrow"><span class="nm">${esc(s.name)}</span><span class="st">${c}/${n} · ${sp}%</span><div class="bar"><span style="width:${sp}%;background:${sp>=PASS?"var(--ok)":"var(--bad)"}"></span></div></div>`}).join("");
  const filters=[["all","All",r.n],["wrong","Incorrect",counts.wrong],["right","Correct",r.n-counts.wrong],["blank",r.auto?"Ran out of time":"Unanswered",counts.blank],["flag","Flagged",counts.flag]];
  return `<div class="wrap">
    <button class="btn ghost back-link" data-act="ex-home" style="padding:8px 4px;min-height:40px">‹ All exams</button>
    <div class="stack" style="gap:8px"><div class="eyebrow">${fmtDT(r.endedAt)} · ${r.n} questions · ${r.timed?"Timed":"Untimed"}${r.auto?" · time ran out":""}</div>
      <div class="score"><b style="color:${passed?"var(--ok)":"var(--bad)"}">${p}%</b><span class="passbadge ${passed?"p":"f"}">${passed?"At or above "+PASS+"%":"Below "+PASS+"%"}</span></div>
      <p class="sub" style="margin:0">${r.correct} of ${r.n} correct in ${fmtDur((r.endedAt-r.startedAt)/1000)}.</p>
      ${r.auto?`<div class="form-msg err" role="status">Time ran out after ${fmtMin(r.limitSec)}. ${counts.blank?`The ${counts.blank} unanswered question${counts.blank>1?"s are":" is"} scored as incorrect and recorded as missed in your history.`:"Every question was answered."}</div>`:""}</div>
    <section class="panel stack"><h2 class="h2">By content area</h2><div class="secs">${secRows}</div></section>
    <section class="stack"><h2 class="h2">Answer key and rationales</h2>
      <div class="chips">${filters.map(([k,l,n])=>`<button class="chip" data-act="ex-filter" data-v="${k}" aria-pressed="${f===k}">${l}<span class="n">${n}</span></button>`).join("")}</div>
      <div class="review stack" style="gap:8px">${items.length?items.map(reviewItem).join(""):`<div class="empty">Nothing in this filter.</div>`}</div>
    </section>
    <div class="row"><button class="btn primary" data-act="ex-studymissed" ${counts.wrong?"":"disabled"}>Study the ${counts.wrong} you missed</button><button class="btn" data-act="ex-home">Back to exams</button></div>
  </div>`;
}
function reviewItem(it){
  const q=QBY[it.id]; const perm=[...it.perm].map(Number); const ok=it.c===q.a; const blank=it.c===-1;
  const mark=blank?`<span class="pill i">${it.auto?"Time ran out":"Unanswered"}</span>`:ok?`<span class="pill c">Correct</span>`:`<span class="pill i">Incorrect</span>`;
  const opts=perm.map((oi,pos)=>{const cls=oi===q.a?"correct":(oi===it.c?"wrong":"dim");return `<li><div class="opt ${cls}"><span class="k">${L[pos]}</span><span>${esc(q.o[oi])}${oi===it.c?' <span style="font-size:12px;color:var(--muted)">(your answer)</span>':""}</span></div></li>`}).join("");
  return `<details><summary><span class="mono" style="font-size:13px;color:var(--muted);min-width:30px">${it.i+1}</span><span class="t">${esc(q.q)}</span>${mark}</summary>
    <div class="body"><span class="sectag" style="align-self:flex-start">${esc(SECNAME[q.s])}</span><ol class="opts">${opts}</ol><div class="rat">${esc(q.r)}</div></div></details>`;
}

/* =====================================================================
   HISTORY
   ===================================================================== */
function renderHistory(){
  const h=S.hist; const o=secStats("all"); const sel=h.sel&&QBY[h.sel]?h.sel:null;
  const stChips=[["all","All"],["mastered","Mastered"],["i","Missed last"],["s","Skipped last"],["c","Correct last"],["u","Unseen"]];
  return `<div class="wrap" style="max-width:${sel?"1240px":"900px"}">
    <div class="stack" style="gap:6px"><div class="eyebrow">History</div><h1 class="h1">Every attempt</h1>
    <p class="sub">Check that you get each question right consistently. Mastered means your last three attempts were all correct.</p></div>
    <div class="stats"><div class="stat"><b>${QDATA.length-o.u}<span style="font-size:16px;color:var(--muted)">/${QDATA.length}</span></b><span>Questions seen</span></div>
      <div class="stat"><b>${o.att?pct(o.cor,o.att)+"%":"—"}</b><span>Answer accuracy</span></div>
      <div class="stat"><b style="color:var(--ok)">${o.mastered}</b><span>Mastered</span></div>
      <div class="stat"><b style="color:var(--bad)">${o.i+o.s}</b><span>Need work</span></div></div>
    <div class="hsplit ${sel?"has-sel":""}">
      <div class="stack">
        <input class="search" id="hsearch" type="search" placeholder="Search question text" value="${esc(h.q)}" aria-label="Search questions" autocomplete="off">
        <div class="chips" role="group" aria-label="Area"><button class="chip" data-act="h-sec" data-v="all" aria-pressed="${h.sec==="all"}">All areas</button>${SECTIONS.map(s=>`<button class="chip" data-act="h-sec" data-v="${s.k}" aria-pressed="${h.sec===s.k}">${esc(s.name)}</button>`).join("")}</div>
        <div class="chips" role="group" aria-label="Status">${stChips.map(([k,l])=>`<button class="chip" data-act="h-st" data-v="${k}" aria-pressed="${h.st===k}">${l}</button>`).join("")}</div>
        <div class="row" style="justify-content:space-between"><span id="hcount" class="mono" style="font-size:13px;color:var(--muted)"></span><button class="btn" id="hstudy" data-act="h-study" style="min-height:40px;padding:8px 14px">Study this list</button></div>
        <ul class="hlist" id="hlist"></ul>
      </div>
      ${sel?`<div class="detail-pane">${renderDetail(sel)}</div>`:""}
    </div>
  </div>`;
}
function histFiltered(){
  const h=S.hist; const term=h.q.trim().toLowerCase();
  return QDATA.filter(q=>(h.sec==="all"||q.s===h.sec)&&(h.st==="all"||status(q.id)===h.st)&&(!term||q.q.toLowerCase().includes(term)||q.r.toLowerCase().includes(term)));
}
function renderHistList(){
  const list=$("#hlist"); if(!list) return;
  const qs=histFiltered(); $("#hcount").textContent=`${qs.length} question${qs.length===1?"":"s"}`; $("#hstudy").disabled=!qs.length;
  const order={i:0,s:1,c:2,mastered:3,u:4}; const st={}; qs.forEach(q=>st[q.id]=status(q.id));
  qs.sort((a,b)=>order[st[a.id]]-order[st[b.id]]);
  list.innerHTML=qs.length?qs.map(q=>{const a=attempts(q.id); const cor=a.filter(x=>x[1]===1).length;
    return `<li><button class="hitem" data-act="h-open" data-v="${q.id}" aria-current="${S.hist.sel===q.id}"><span class="t">${esc(q.q)}</span><span class="pill ${st[q.id]}">${STATUS_LABEL[st[q.id]]}</span>
    <span class="dots">${a.slice(-16).map(x=>`<span class="dot ${["i","c","s"][x[1]]}"></span>`).join("")}${a.length?`<span class="mono" style="font-size:12px;color:var(--muted);margin-left:6px">${cor}/${a.length} correct</span>`:`<span style="font-size:12px;color:var(--muted)">No attempts yet</span>`}</span></button></li>`}).join(""):`<li class="empty">No questions match.</li>`;
}
function renderDetail(id){
  const q=QBY[id]; const a=attempts(id).slice().reverse(); const st=status(id);
  const opts=q.o.map((t,i)=>`<li><div class="opt ${i===q.a?"correct":"dim"}"><span class="k">${L[i]}</span><span>${esc(t)}</span></div></li>`).join("");
  const rows=a.map(x=>`<tr><td class="mono" style="white-space:nowrap">${fmtDT(x[0]*1000)}</td><td>${x[3]==="x"?"Exam":"Study"}</td><td><span class="pill ${["i","c","s"][x[1]]}">${["Incorrect","Correct","Skipped"][x[1]]}</span></td><td>${x[2]>=0?`${L[x[2]]}. ${esc(q.o[x[2]])}`:"—"}</td></tr>`).join("");
  return `<section class="panel stack">
    <div class="row" style="justify-content:space-between"><button class="btn ghost" data-act="h-close" style="padding:6px 4px;min-height:36px">‹ Close</button><span class="pill ${st}">${STATUS_LABEL[st]}</span></div>
    <div class="cardmeta"><span class="sectag">${esc(SECNAME[q.s])}</span><span class="qid">${id.toUpperCase()}</span></div>
    <h2 class="stem">${esc(q.q)}</h2><ol class="opts">${opts}</ol><div class="rat">${esc(q.r)}</div>
    <h3 class="h2" style="font-size:18px;margin-top:6px">Attempts (${a.length})</h3>
    ${a.length?`<div class="tablewrap"><table class="att"><thead><tr><th>When</th><th>Mode</th><th>Result</th><th>Your choice</th></tr></thead><tbody>${rows}</tbody></table></div><p style="font-size:12.5px;color:var(--muted);margin:0">Letters follow the order shown here. Answer choices are shuffled each time you see a question.</p>`:`<div class="empty" style="padding:12px">You haven't attempted this question yet.</div>`}
    <button class="btn" data-act="h-studyone" data-v="${id}">Study this question</button>
  </section>`;
}
function openDetail(id){
  S.hist.sel=id;
  if(innerWidth>=1100) render(false);
  else { modal(`<div style="margin:-6px -4px">${renderDetail(id).replace('data-act="h-close"','data-close')}</div>`); renderHistList(); }
}

/* =====================================================================
   ACCOUNT / SETTINGS
   ===================================================================== */
function renderSettings(){
  const au=S.auth;
  let acct;
  if(!SYNC_READY){
    acct=`<p class="sub" style="margin:0">Sync isn't set up yet, so everything is saved on this device only. Add your Firebase API key and project ID to <span class="mono">config.js</span> (see the README), then redeploy.</p>`;
  }else if(!session){
    acct=`<p class="sub" style="margin:0">Sign in to share one study history, exam list and exam in progress across both accounts and all your devices. Anything you do before signing in uploads once you sign in.</p>
    <form id="authform" class="stack" novalidate>
      <div class="field"><label for="au-email">Email</label><input class="input" id="au-email" type="email" autocomplete="email" autocapitalize="off" required></div>
      <div class="field"><label for="au-pass">Password</label><input class="input" id="au-pass" type="password" autocomplete="${au.mode==="up"?"new-password":"current-password"}" minlength="6" required></div>
      ${au.msg?`<div class="form-msg ${au.msg[0]}" role="status">${esc(au.msg[1])}</div>`:""}
      <button class="btn primary wide" type="submit" ${au.busy?"disabled":""}>${au.busy?"Working…":au.mode==="up"?"Create account":"Sign in"}</button>
      <button class="btn ghost" type="button" data-act="au-mode">${au.mode==="up"?"I already have an account":"Create an account"}</button>
    </form>`;
  }else{
    acct=`<dl class="kv"><dt>Signed in as</dt><dd>${esc(session.user.email||"")}</dd><dt>Status</dt><dd id="st-status"></dd><dt>Last synced</dt><dd id="st-last"></dd><dt>Waiting to upload</dt><dd id="st-wait"></dd></dl>
    <div id="st-err"></div>
    <div class="row"><button class="btn primary" data-act="sync-now">Sync now</button><button class="btn" data-act="sign-out">Sign out</button></div>`;
  }
  const exN=Object.keys(D.exams).length;
  const html=`<div class="wrap">
    <div class="stack" style="gap:6px"><div class="eyebrow">Account</div><h1 class="h1">Sync and your data</h1>
    <p class="sub">Your answers live on this device first and sync to your own Firebase project when you're signed in, so the app keeps working offline.</p></div>
    <section class="panel stack"><h2 class="h2">Sync</h2>${acct}</section>
    <section class="panel stack"><h2 class="h2">Backups</h2>
      <p class="sub" style="margin:0">This device holds ${D.attempts.length.toLocaleString()} attempts and ${exN} finished exam${exN===1?"":"s"}. Export a copy anytime; importing merges a backup without duplicating anything.</p>
      <div class="row"><button class="btn" data-act="export-json">Export backup (JSON)</button><button class="btn" data-act="export-csv">Export attempts (CSV)</button>
      <label class="btn filepick">Import backup<input type="file" id="importfile" accept="application/json,.json"></label></div>
    </section>
    <section class="panel stack"><h2 class="h2">About</h2>
      <p class="sub" style="margin:0">${QDATA.length} questions · ARRT Radiation Therapy content areas. Independent study aid, not an ARRT product. Verify figures against your program's current texts.</p></section>
  </div>`;
  setTimeout(refreshSettingsStatus,0);
  return html;
}
function refreshSettingsStatus(){
  const s=$("#st-status"); if(!s) return;
  s.textContent=syncLabel()[1];
  $("#st-last").textContent=D.meta.lastSync?fmtDT(D.meta.lastSync):"Not yet";
  $("#st-wait").textContent=String(D.outbox.length);
  $("#st-err").innerHTML=lastErr?`<div class="form-msg err">${esc(lastErr)}</div>`:"";
}
document.addEventListener("submit",async e=>{
  if(e.target.id!=="authform") return; e.preventDefault();
  const email=$("#au-email").value.trim(), pw=$("#au-pass").value;
  if(!email||pw.length<6){ S.auth.msg=["err","Enter your email and a password of at least 6 characters."]; render(false); $("#au-email").value=email; return; }
  if(!navigator.onLine){ S.auth.msg=["err","You're offline. Connect to the internet to sign in."]; render(false); return; }
  S.auth.busy=true; S.auth.msg=null; render(false); $("#au-email").value=email;
  try{
    if(S.auth.mode==="up"){ const m=await signUp(email,pw); S.auth.msg=["ok",m]; if(!session) S.auth.mode="in"; }
    else { await signIn(email,pw); S.auth.msg=null; toast("Signed in. Your progress is syncing."); }
  }catch(err){ S.auth.msg=["err",err.message||"Sign-in failed."]; }
  S.auth.busy=false; renderNav(); render(false); const em=$("#au-email"); if(em) em.value=email;
});
function download(name,text,type){
  const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
}
function exportJSON(){
  const day=new Date().toISOString().slice(0,10);
  download(`rt-prep-backup-${day}.json`,JSON.stringify({app:"rt-registry-prep",version:1,exportedAt:new Date().toISOString(),attempts:D.attempts,exams:Object.values(D.exams),activeExam:D.active}),"application/json");
}
function exportCSV(){
  const q=s=>`"${String(s).replace(/"/g,'""')}"`;
  const rows=[["answered_at","question_id","area","result","choice","correct_answer","mode","question"].join(",")];
  D.attempts.slice().sort((a,b)=>a.t-b.t).forEach(a=>{const Q=QBY[a.qid];
    rows.push([new Date(a.t).toISOString(),a.qid,Q?q(SECNAME[Q.s]):"",["incorrect","correct","skipped"][a.r],a.c>=0&&Q?q(Q.o[a.c]):"",Q?q(Q.o[Q.a]):"",a.src==="x"?"exam":"study",Q?q(Q.q):""].join(","))});
  download(`rt-prep-attempts-${new Date().toISOString().slice(0,10)}.csv`,rows.join("\n"),"text/csv");
}
document.addEventListener("change",e=>{
  if(e.target.id!=="importfile"||!e.target.files[0]) return;
  const f=e.target.files[0]; const rd=new FileReader();
  rd.onload=()=>{
    try{
      const j=JSON.parse(rd.result); if(j.app!=="rt-registry-prep") throw new Error("That file isn't an RT Registry Prep backup.");
      const have=new Set(D.attempts.map(a=>a.id)); let na=0, nx=0;
      (j.attempts||[]).forEach(a=>{ if(!a||!a.qid||typeof a.t!=="number"||![0,1,2].includes(a.r)) return; const id=a.id||uuid(); if(have.has(id)) return; have.add(id);
        const rec={id,qid:a.qid,t:a.t,r:a.r,c:Number.isInteger(a.c)?a.c:-1,src:a.src==="x"?"x":"s"}; D.attempts.push(rec); D.outbox.push({k:"a",row:rec}); na++; });
      (j.exams||[]).forEach(x=>{ if(!x||!x.id||D.exams[x.id]) return; D.exams[x.id]=x; D.outbox.push({k:"x",row:x}); nx++; });
      byQ=null; save("attempts","exams","outbox"); scheduleFlush(500);
      toast(`Imported ${na} attempts and ${nx} exams.`); renderNav(); render(false);
    }catch(err){ toast(err.message||"Couldn't read that file."); }
  };
  rd.readAsText(f); e.target.value="";
});

/* ---------- actions ---------- */
document.addEventListener("input",e=>{ if(e.target.id==="hsearch"){S.hist.q=e.target.value;renderHistList()} });
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]"); if(!b||b.disabled) return; const v=b.dataset.v;
  switch(b.dataset.act){
    case "st-sec": S.study.sec=v; render(false); break;
    case "st-pool": S.study.pool=v; render(false); break;
    case "st-len": S.study.len=v; render(false); break;
    case "st-start": { let ids=shuffle(poolIds(S.study.sec,S.study.pool)); if(S.study.len!=="all") ids=ids.slice(0,+S.study.len); startStudy(ids); break; }
    case "st-ans": studyAnswer(+v); break;
    case "st-skip": studySkip(); break;
    case "st-next": studyNext(); break;
    case "st-back": studyBack(); break;
    case "st-flip": studyFlip(); break;
    case "st-end": { const s=S.study.sess; const any=s&&Object.values(s.e).some(x=>x.res); S.study.view=any?"done":"setup"; if(!any)S.study.sess=null; render(true); break; }
    case "st-redo": { const s=S.study.sess; startStudy(s.deck.filter(id=>s.e[id].res==="i"||s.e[id].res==="s")); break; }
    case "st-review": S.study.sess.i=0; S.study.view="card"; render(true); break;
    case "st-new": S.study.sess=null; S.study.view="setup"; render(true); break;
    case "ex-len": S.exams.len=+v; render(false); break;
    case "ex-timed": S.exams.timed=v==="1"; render(false); break;
    case "ex-start": startExam(); break;
    case "ex-resume": S.exams.view="run"; render(true); break;
    case "ex-discard": modal(`<h2 class="h2">Discard this exam?</h2><p class="sub" style="margin:0">Your answers so far will be deleted and nothing is graded.</p><div class="row"><button class="btn danger" data-act="ex-discard-yes">Discard exam</button><button class="btn" data-close>Keep it</button></div>`); break;
    case "ex-discard-yes": setActive(null); closeModal(); S.exams.view="home"; renderNav(); render(true); break;
    case "ex-ans": exMut(a=>{const id=a.ids[a.cur]; if(a.ans[id]===+v) delete a.ans[id]; else a.ans[id]=+v}); render(false); break;
    case "ex-flag": exMut(a=>{const id=a.ids[a.cur]; const i=a.flags.indexOf(id); i>=0?a.flags.splice(i,1):a.flags.push(id)}); render(false); break;
    case "ex-prev": exMut(a=>{if(a.cur>0)a.cur--}); render(true); break;
    case "ex-next": exMut(a=>{if(a.cur<a.n-1)a.cur++}); render(true); break;
    case "ex-go": exMut(a=>{a.cur=+v}); closeModal(); render(true); break;
    case "ex-grid": modal(`<div class="stack">${navGrid(ex())}<button class="btn" data-close>Close</button></div>`); break;
    case "ex-submit": submitPrompt(); break;
    case "ex-confirm": submitExam(false); break;
    case "ex-leave": S.exams.view="home"; render(true); break;
    case "ex-open": S.exams.view="result"; S.exams.resultId=v; S.exams.filter="all"; render(true); break;
    case "ex-home": S.exams.view="home"; render(true); break;
    case "ex-filter": S.exams.filter=v; render(false); break;
    case "ex-studymissed": { const r=D.exams[S.exams.resultId]; const ids=r.items.filter(it=>QBY[it[0]]&&it[2]!==QBY[it[0]].a).map(it=>it[0]); S.tab="study"; LS.set("rt.tab","study"); renderNav(); startStudy(ids); break; }
    case "h-sec": S.hist.sec=v; render(false); break;
    case "h-st": S.hist.st=v; render(false); break;
    case "h-open": openDetail(v); break;
    case "h-close": S.hist.sel=null; render(false); break;
    case "h-study": { const ids=histFiltered().map(q=>q.id); S.tab="study"; renderNav(); startStudy(ids); break; }
    case "h-studyone": closeModal(); S.tab="study"; renderNav(); startStudy([v]); break;
    case "au-mode": S.auth.mode=S.auth.mode==="up"?"in":"up"; S.auth.msg=null; render(false); break;
    case "sync-now": syncNow(true).then(()=>{ toast(lastErr?"Sync failed: "+lastErr:"Synced."); onData(); }); break;
    case "sign-out": modal(`<h2 class="h2">Sign out?</h2><p class="sub" style="margin:0">Your data stays on this device and in your database. ${D.outbox.length?`${D.outbox.length} change${D.outbox.length>1?"s haven't":" hasn't"} uploaded yet and will upload next time you sign in.`:""}</p><div class="row"><button class="btn danger" data-act="sign-out-yes">Sign out</button><button class="btn" data-close>Cancel</button></div>`); break;
    case "sign-out-yes": closeModal(); signOut().then(()=>{renderNav();render(false)}); break;
    case "export-json": exportJSON(); break;
    case "export-csv": exportCSV(); break;
  }
});
document.addEventListener("keydown",e=>{
  if(e.target.matches("input,textarea,select")||e.metaKey||e.ctrlKey||e.altKey) return;
  if($("#layer .scrim")){ if(e.key==="Escape") closeModal(); return; }
  const k=e.key.toLowerCase(); const idx="abcd".indexOf(k)>=0?"abcd".indexOf(k):"1234".indexOf(k);
  if(S.tab==="study"&&S.study.view==="card"){
    const {e:en}=curCard(); const answered=en.res==="c"||en.res==="i";
    if(idx>=0&&!answered){studyAnswer([...en.perm].map(Number)[idx]);e.preventDefault()}
    else if(k==="s"&&!answered) studySkip();
    else if(k==="arrowright") answered?studyNext():studySkip();
    else if(k==="arrowleft") studyBack();
    else if(k===" "&&answered){studyFlip();e.preventDefault()}
  } else if(S.tab==="exams"&&S.exams.view==="run"&&ex()){
    const a=ex();
    if(idx>=0){ const oi=[...a.perm[a.ids[a.cur]]].map(Number)[idx]; exMut(x=>{x.ans[x.ids[x.cur]]=oi}); render(false); }
    else if(k==="arrowright"&&a.cur<a.n-1){exMut(x=>x.cur++);render(true)}
    else if(k==="arrowleft"&&a.cur>0){exMut(x=>x.cur--);render(true)}
    else if(k==="f"){exMut(x=>{const id=x.ids[x.cur];const i=x.flags.indexOf(id);i>=0?x.flags.splice(i,1):x.flags.push(id)});render(false)}
  }
});
let rsT; addEventListener("resize",()=>{clearTimeout(rsT);rsT=setTimeout(()=>{ if(S.tab==="history"&&S.hist.sel&&innerWidth<1100&&!$("#layer .scrim")){S.hist.sel=null;render(false)} },200)});

/* ---------- lifecycle ---------- */
document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ checkExamExpiry(); syncNow(true); } });
addEventListener("online",()=>syncNow(true));
addEventListener("offline",updateSyncPill);
setInterval(()=>{ if(!document.hidden&&session) syncNow(true); },60000);
if("serviceWorker" in navigator && location.protocol==="https:"){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
  let reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(reloaded) return; reloaded=true;
    const busy=(S.study.view==="card")||(S.exams.view==="run");
    if(busy) toast("An update is ready. It applies next time you open the app."); else location.reload(); });
}
checkExamExpiry(); renderNav(); render(true); updateSyncPill(); syncNow(true);
