'use strict';

/* =====================================================================
   DBD BASE 1.5
   Clean final Version-1 architecture

   1. shell/router
   2. canonical Vault data
   3. packet normalization/validation
   4. renderers
   5. session runtime
   6. evidence/history
   7. JSON/DBD Compact transport
   ===================================================================== */

const APP_NAME='DBD Base';
const APP_VERSION='1.5';
const BUILD_ID='base-1.5';
const STORAGE_KEY='dbd_gazali';
const VAULT_FORMAT='dbd-base-vault';
const VAULT_FORMAT_VERSION=1;
const PACKET_FORMAT='dbd-base-packet';
const PACKET_FORMAT_VERSION=1;
const COMPACT_PREFIX='DBDC1';
const COMPACT_ALGO='GZ';

let DATA=null;
let ROUTE='home';
let SELECTED_SUBJECT_ID=null;
let SELECTED_SESSION_ID=null;
let IMPORT_ERROR='';
let HISTORY_MENU_ID=null;
let UI={
  calcOpen:false,
  calcExpression:'',
  calcCursor:0,
  commentOpen:false,
  pauseOpen:false,
  skipNotice:null,
  timerHandle:null,
  lastTick:null
};

/* ---------------- Utilities ---------------- */

function esc(v){
  return String(v??'').replace(/[&<>'"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}
function norm(v){
  return String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
}
function nowISO(){return new Date().toISOString()}
function uid(prefix='id'){
  if(globalThis.crypto?.randomUUID)return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}
function slug(v){
  return String(v||'item').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'item';
}
function localDay(d=new Date()){
  const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
}
function fmtMs(ms){
  if(ms==null||!Number.isFinite(Number(ms)))return '—';
  const sec=Math.max(0,Math.round(Number(ms)/1000)),m=Math.floor(sec/60),s=sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function humanDate(iso){
  if(!iso)return '—';
  const d=new Date(iso); if(Number.isNaN(d.getTime()))return '—';
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
function dateGroupLabel(iso){
  const d=new Date(iso),today=new Date();
  const a=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const b=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const days=Math.round((a-b)/86400000);
  if(days===0)return 'Today';
  if(days===1)return 'Yesterday';
  return d.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
}
function bytesLabel(bytes){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(2)} MB`;
}
function download(filename,text,mime='text/plain'){
  const blob=new Blob([text],{type:mime});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200);
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}catch(e){}
  try{
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    const ok=document.execCommand('copy');ta.remove();return ok;
  }catch(e){return false}
}
function toast(message){
  const root=document.getElementById('toast-root');if(!root)return;
  root.innerHTML=`<div class="toast">${esc(message)}</div>`;
  clearTimeout(toast._t);toast._t=setTimeout(()=>{if(root)root.innerHTML=''},2200);
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function setTheme(theme){
  DATA.settings.appearance=theme==='light'?'light':'dark';save();applyTheme();render();
}
function applyTheme(){
  const mode=DATA?.settings?.appearance==='light'?'light':'dark';
  document.documentElement.setAttribute('data-theme',mode);document.documentElement.style.colorScheme=mode;
}

/* ---------------- Canonical Vault v1 ---------------- */

function newVault(){
  return{
    format:VAULT_FORMAT,
    vaultFormatVersion:VAULT_FORMAT_VERSION,
    appVersion:APP_VERSION,
    build:BUILD_ID,
    profile:{name:'Gazali Darmawan',grade:'Grade 11',className:'Science 2'},
    settings:{appearance:'dark',deviceId:uid('device'),nextGenerationFocus:''},
    subjects:[],
    completedSessions:[],
    activeSessions:[],
    currentActiveId:null,
    pendingPacket:null,
    legacyArchive:{
      sourceSchema:null,
      questionBank:[],
      streamAttempts:[],
      streamPrototypeAttempts:[],
      conceptManifests:[],
      subjectManifests:[],
      bankCollections:[],
      other:{}
    },
    migration:null,
    updatedAt:nowISO()
  };
}

function unwrapVault(raw){
  if(raw?.format==='dbd-vault'&&raw.data)return raw.data;
  if(raw?.format===VAULT_FORMAT&&raw.data)return raw.data;
  return raw;
}

function aliasNorm(v){return norm(v).replace(/[^a-z0-9]+/g,' ')}
function subjectIdFromName(name){return `subject_${slug(name||'subject')}`}

function normalizeSubjectRecord(rec){
  const name=String(rec?.name||rec?.label||'').trim();
  if(!name)return null;
  const aliases=[name,...(Array.isArray(rec.aliases)?rec.aliases:[])].map(x=>String(x||'').trim()).filter(Boolean);
  return{
    id:String(rec.id||subjectIdFromName(name)),
    name,
    aliases:[...new Set(aliases.map(x=>x.trim()))]
  };
}

function subjectMatches(rec,label){
  const n=aliasNorm(label); if(!n)return false;
  return [rec.name,...(rec.aliases||[])].some(a=>aliasNorm(a)===n);
}

function normalizeCompletedSession(s){
  if(!s||typeof s!=='object')return null;
  const attempts=Array.isArray(s.attempts)?s.attempts.map(a=>normalizeAttempt(a)).filter(Boolean):[];
  const total=Number(s.totalQuestions||s.answered||attempts.length||0);
  let correct=Number.isFinite(Number(s.correct))?Number(s.correct):attempts.filter(a=>a.correct===true).length;
  if(correct<0)correct=0;
  return{
    id:String(s.id||uid('session')),
    campaign:String(s.campaign||''),
    subject:String(s.subject||'Unspecified'),
    topic:String(s.topic||'Drill'),
    source:String(s.source||''),
    testType:String(s.testType||s.test_type||'drill'),
    difficulty:String(s.difficulty||'—'),
    feedback:String(s.feedback||'immediate'),
    showTimer:Boolean(s.showTimer),
    completedAt:String(s.completedAt||s.completed_at||nowISO()),
    startedAt:String(s.startedAt||s.started_at||''),
    activeMs:Number.isFinite(Number(s.activeMs))?Number(s.activeMs):Number.isFinite(Number(s.totalTime))?Number(s.totalTime)*1000:null,
    totalQuestions:total,
    correct,
    accuracy:total?correct/total*100:0,
    unanswered:Number.isFinite(Number(s.unanswered))?Number(s.unanswered):attempts.filter(a=>['skipped','unseen'].includes(a.status)).length,
    attempts
  };
}

function normalizeAttempt(a){
  if(!a||typeof a!=='object')return null;
  let choices=null;
  if(a.choices&&typeof a.choices==='object'&&!Array.isArray(a.choices))choices={...a.choices};
  return{
    questionId:String(a.questionId||a.id||uid('q')),
    type:String(a.type||'short'),
    prompt:String(a.prompt||a.question||''),
    stimulus:a.stimulus||null,
    choices,
    selected:Array.isArray(a.selected)?a.selected.slice():a.selected??a.answerGiven??a.userAnswer??null,
    answer:Array.isArray(a.answer)?a.answer.slice():a.answer??a.correctAnswer??null,
    acceptedAnswers:Array.isArray(a.acceptedAnswers)?a.acceptedAnswers.slice():[],
    modelAnswer:String(a.modelAnswer||''),
    rubric:Array.isArray(a.rubric)?a.rubric.slice():[],
    correct:a.correct===true,
    status:String(a.status||'answered'),
    confidence:String(a.confidence||'—'),
    errorCause:String(a.errorCause||a.errorType||''),
    skipReason:String(a.skipReason||''),
    comment:String(a.comment||a.note||''),
    flagged:Boolean(a.flagged),
    elapsedMs:Number.isFinite(Number(a.elapsedMs))?Number(a.elapsedMs):Number.isFinite(Number(a.elapsed))?Number(a.elapsed)*1000:0,
    calculator:normalizeCalculatorEvidence(a.calculator||{
      used:a.calculatorUsed,
      openCount:a.calculatorOpenCount,
      history:a.calculatorHistory
    }),
    tags:Array.isArray(a.tags)?a.tags.map(String):[],
    prerequisites:Array.isArray(a.prerequisites)?a.prerequisites.map(String):[],
    explanation:String(a.explanation||''),
    whyWrong:a.whyWrong&&typeof a.whyWrong==='object'?{...a.whyWrong}:{},
    difficulty:String(a.difficulty||''),
    timeLimitSeconds:Number(a.timeLimitSeconds||0)||0,
    selfAssessment:String(a.selfAssessment||'')
  };
}

function normalizeCalculatorEvidence(c){
  return{
    used:Boolean(c?.used),
    openCount:Number(c?.openCount||0)||0,
    history:Array.isArray(c?.history)?c.history.map(x=>({expression:String(x.expression||''),result:String(x.result??''),at:String(x.at||'')})).filter(x=>x.expression):[]
  };
}

function normalizeActiveSession(a){
  if(!a||typeof a!=='object'||!a.packet)return null;
  let packet;try{packet=normalizePacket(a.packet)}catch(e){return null}
  const responses=packet.questions.map((q,i)=>normalizeResponse(a.responses?.[i],q));
  return{
    id:String(a.id||uid('session')),
    packet,
    responses,
    index:clamp(Number(a.index||0),0,Math.max(0,packet.questions.length-1)),
    startedAt:String(a.startedAt||nowISO()),
    activeMs:Number.isFinite(Number(a.activeMs))?Number(a.activeMs):(a.responses||[]).reduce((n,r)=>n+(Number(r?.elapsed)||0)*1000,0),
    paused:Boolean(a.paused),
    review:Boolean(a.review),
    completedFirstPass:Boolean(a.completedFirstPass),
    sourceName:String(a.sourceName||'Imported packet')
  };
}

function normalizeResponse(r,q){
  const selected=q?.type==='multi_select'
    ?(Array.isArray(r?.selected||r?.answer)?[...(r.selected||r.answer)]:[])
    :(r?.selected??r?.answer??null);
  return{
    selected,
    draft:String(r?.draft??''),
    status:String(r?.status||'unseen'),
    confidence:['sure','unsure','guess'].includes(r?.confidence)?r.confidence:'sure',
    flagged:Boolean(r?.flagged),
    elapsedMs:Number.isFinite(Number(r?.elapsedMs))?Number(r.elapsedMs):(Number.isFinite(Number(r?.elapsed))?Number(r.elapsed)*1000:0),
    locked:Boolean(r?.locked),
    correct:typeof r?.correct==='boolean'?r.correct:null,
    errorCause:String(r?.errorCause||r?.errorType||''),
    skipReason:String(r?.skipReason||''),
    comment:String(r?.comment||r?.note||''),
    timedOut:Boolean(r?.timedOut),
    selfAssessment:String(r?.selfAssessment||''),
    calculator:normalizeCalculatorEvidence(r?.calculator||{
      used:r?.calculatorUsed,openCount:r?.calculatorOpenCount,history:r?.calculatorHistory
    })
  };
}

function migrateLegacy(raw){
  const old=unwrapVault(raw)||{};
  const v=newVault();
  v.profile={...v.profile,...(old.profile||{})};
  v.settings={...v.settings,...(old.settings||{})};
  if(!['dark','light'].includes(v.settings.appearance))v.settings.appearance='dark';
  if(!v.settings.deviceId)v.settings.deviceId=uid('device');

  const subjectMap=new Map();
  const addSubject=(recOrName)=>{
    const rec=typeof recOrName==='string'?normalizeSubjectRecord({name:recOrName}):normalizeSubjectRecord(recOrName);
    if(!rec)return;
    const key=aliasNorm(rec.name);
    const existing=[...subjectMap.values()].find(s=>subjectMatches(s,rec.name));
    if(existing){existing.aliases=[...new Set([...existing.aliases,...rec.aliases])];return}
    subjectMap.set(key,rec);
  };
  (old.subjectRegistry||[]).forEach(addSubject);
  (old.streams||[]).forEach(s=>addSubject({id:s.id,name:s.name,aliases:[]}));

  v.completedSessions=(old.completedSessions||[]).map(normalizeCompletedSession).filter(Boolean);
  v.completedSessions.forEach(s=>addSubject(s.subject));
  v.activeSessions=(old.activeSessions||[]).map(normalizeActiveSession).filter(Boolean);
  v.activeSessions.forEach(s=>addSubject(s.packet.subject));
  if(old.activeSession&&!v.activeSessions.length){const a=normalizeActiveSession(old.activeSession);if(a){v.activeSessions=[a];addSubject(a.packet.subject)}}
  if(old.pendingPacket?.packet){
    try{v.pendingPacket={packet:normalizePacket(old.pendingPacket.packet),sourceName:String(old.pendingPacket.sourceName||'Pending packet'),validation:null};addSubject(v.pendingPacket.packet.subject)}catch(e){}
  }
  v.currentActiveId=v.activeSessions.some(a=>a.id===old.currentActiveId)?old.currentActiveId:(v.activeSessions[0]?.id||null);
  v.subjects=[...subjectMap.values()].sort((a,b)=>a.name.localeCompare(b.name));

  const streamAttempts=[...(old.streamEngine?.attempts||[])];
  const streamPrototypeAttempts=[...(old.streamPrototype?.attempts||[])];
  v.legacyArchive={
    sourceSchema:Number.isFinite(Number(old.schemaVersion))?Number(old.schemaVersion):null,
    questionBank:Array.isArray(old.questionBank)?old.questionBank:[],
    streamAttempts,
    streamPrototypeAttempts,
    conceptManifests:Array.isArray(old.conceptManifests)?old.conceptManifests:[],
    subjectManifests:Array.isArray(old.subjectManifests)?old.subjectManifests:[],
    bankCollections:Array.isArray(old.bankCollections)?old.bankCollections:[],
    other:{
      scheduler:old.scheduler||null,
      conceptEvidence:old.conceptEvidence||null,
      streams:Array.isArray(old.streams)?old.streams:[]
    }
  };
  v.migration={
    sourceFamily:'legacy-dbd',
    sourceVersion:String(old.appVersion||old.baseVersion||'unknown'),
    sourceSchema:v.legacyArchive.sourceSchema,
    migratedAt:nowISO()
  };
  v.updatedAt=nowISO();
  return v;
}

function normalizeVault(raw){
  const x=unwrapVault(raw);
  if(x?.format===VAULT_FORMAT&&Number(x.vaultFormatVersion)===1){
    const v=newVault();
    v.profile={...v.profile,...(x.profile||{})};
    v.settings={...v.settings,...(x.settings||{})};
    if(!['dark','light'].includes(v.settings.appearance))v.settings.appearance='dark';
    if(!v.settings.deviceId)v.settings.deviceId=uid('device');
    v.subjects=(x.subjects||[]).map(normalizeSubjectRecord).filter(Boolean);
    v.completedSessions=(x.completedSessions||[]).map(normalizeCompletedSession).filter(Boolean);
    v.activeSessions=(x.activeSessions||[]).map(normalizeActiveSession).filter(Boolean);
    v.currentActiveId=v.activeSessions.some(a=>a.id===x.currentActiveId)?x.currentActiveId:(v.activeSessions[0]?.id||null);
    if(x.pendingPacket?.packet){try{v.pendingPacket={...x.pendingPacket,packet:normalizePacket(x.pendingPacket.packet)};v.pendingPacket.validation=validatePacket(v.pendingPacket.packet)}catch(e){v.pendingPacket=null}}
    v.legacyArchive={...v.legacyArchive,...(x.legacyArchive||{})};
    v.migration=x.migration||null;v.updatedAt=String(x.updatedAt||nowISO());
    ensureSubjects(v);return v;
  }
  return migrateLegacy(raw);
}

function ensureSubjects(v=DATA){
  const list=Array.isArray(v.subjects)?v.subjects:[];
  const add=(name)=>{
    if(!name)return;
    if(list.some(s=>subjectMatches(s,name)))return;
    list.push(normalizeSubjectRecord({name}));
  };
  (v.completedSessions||[]).forEach(s=>add(s.subject));
  (v.activeSessions||[]).forEach(s=>add(s.packet?.subject));
  if(v.pendingPacket?.packet)add(v.pendingPacket.packet.subject);
  v.subjects=list.filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
}

function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(!raw)return newVault();
    return normalizeVault(raw);
  }catch(e){console.warn('DBD storage load failed',e);return newVault()}
}
function save(){
  if(!DATA)return;
  DATA.format=VAULT_FORMAT;DATA.vaultFormatVersion=VAULT_FORMAT_VERSION;DATA.appVersion=APP_VERSION;DATA.build=BUILD_ID;DATA.updatedAt=nowISO();
  ensureSubjects(DATA);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA));
}

function subjectRecordFor(label){return DATA.subjects.find(s=>subjectMatches(s,label))||null}
function ensureSubject(label){
  let rec=subjectRecordFor(label);if(rec)return rec;
  rec=normalizeSubjectRecord({name:label||'Unspecified'});DATA.subjects.push(rec);DATA.subjects.sort((a,b)=>a.name.localeCompare(b.name));save();return rec;
}
function canonicalSubjectName(label){return subjectRecordFor(label)?.name||String(label||'Unspecified')}

function subjectSummary(rec){
  const sessions=DATA.completedSessions.filter(s=>subjectMatches(rec,s.subject));
  const active=DATA.activeSessions.filter(s=>subjectMatches(rec,s.packet?.subject));
  const answered=sessions.reduce((n,s)=>n+(s.totalQuestions||s.attempts?.length||0),0);
  return{sessions,active,answered,pending:Boolean(DATA.pendingPacket?.packet&&subjectMatches(rec,DATA.pendingPacket.packet.subject))};
}

function legacyCounts(){
  const l=DATA.legacyArchive||{};
  return{
    bank:(l.questionBank||[]).length,
    stream:(l.streamAttempts||[]).length+(l.streamPrototypeAttempts||[]).length,
    manifests:(l.conceptManifests||[]).length+(l.subjectManifests||[]).length
  };
}

/* ---------------- Packet v1 ---------------- */

function normalizeChoices(raw){
  if(!raw)return null;
  if(Array.isArray(raw)){
    const out={};raw.forEach((v,i)=>out[String.fromCharCode(65+i)]=typeof v==='object'?String(v.text||v.label||''):String(v));return out;
  }
  if(typeof raw==='object'){
    const out={};for(const [k,v] of Object.entries(raw))out[String(k).trim().toUpperCase()]=typeof v==='object'?String(v.text||v.label||''):String(v);
    return out;
  }
  return null;
}
function stripChoicePrefix(key,text){
  const k=String(key||'').trim().toUpperCase();
  return String(text||'').replace(new RegExp(`^\\s*${k}\\s*[.):\\-]\\s*`,'i'),'').trim();
}
function normalizeQuestion(q,index=0){
  if(!q||typeof q!=='object')return null;
  let type=String(q.type||'mcq').toLowerCase().trim().replace(/[-\s]+/g,'_');
  if(['multiple_choice','single_select','choice'].includes(type))type='mcq';
  if(['rich_mcq','multi','multiple_select','select_all'].includes(type))type='multi_select';
  if(['text','open','open_answer'].includes(type))type='short';
  if(type==='self_check')type='essay';
  if(!['mcq','multi_select','numeric','short','essay'].includes(type))type='short';

  const choices=normalizeChoices(q.choices||q.options);
  if(choices){for(const k of Object.keys(choices))choices[k]=stripChoicePrefix(k,choices[k]);}
  let answer=q.answer??q.correct_answer??q.correctAnswer??null;
  if(type==='mcq'&&choices){
    const keys=Object.keys(choices);
    if(typeof answer==='number'&&keys[answer])answer=keys[answer];
    const a=String(answer??'').trim();
    const keyMatch=keys.find(k=>norm(k)===norm(a));
    const textMatch=keys.find(k=>norm(stripChoicePrefix(k,choices[k]))===norm(a)||norm(choices[k])===norm(a));
    answer=keyMatch||textMatch||a.toUpperCase();
  }
  if(type==='multi_select'){
    let arr=Array.isArray(answer)?answer:String(answer??'').split(/[,;|]+/).map(x=>x.trim()).filter(Boolean);
    const keys=Object.keys(choices||{});
    arr=arr.map(a=>{
      const direct=keys.find(k=>norm(k)===norm(a));
      const byText=keys.find(k=>norm(stripChoicePrefix(k,choices[k]))===norm(a)||norm(choices[k])===norm(a));
      return direct||byText||String(a).toUpperCase();
    });
    answer=[...new Set(arr)].sort();
  }

  const stimulus=normalizeStimulus(q.stimulus);
  return{
    id:String(q.id||q.question_id||`q${index+1}`),
    type,
    numericMode:String(q.numeric_mode||q.numericMode||''),
    prompt:String(q.prompt||q.question||''),
    choices,
    answer,
    acceptedAnswers:Array.isArray(q.accepted_answers||q.acceptedAnswers)?(q.accepted_answers||q.acceptedAnswers).map(String):[],
    answerRegex:String(q.answer_regex||q.answerRegex||''),
    tolerance:Math.max(0,Number(q.tolerance||0)||0),
    explanation:String(q.explanation||q.overallExplanation||''),
    whyWrong:q.why_wrong&&typeof q.why_wrong==='object'?{...q.why_wrong}:q.whyWrong&&typeof q.whyWrong==='object'?{...q.whyWrong}:{},
    tags:Array.isArray(q.tags)?q.tags.map(String).filter(Boolean):q.topic?[String(q.topic)]:[],
    prerequisites:Array.isArray(q.prerequisites)?q.prerequisites.map(String).filter(Boolean):[],
    difficulty:String(q.difficulty||''),
    paperRequired:Boolean(q.paper_required??q.paperRequired),
    calculatorRequired:Boolean(q.calculator_required??q.calculatorRequired),
    stimulus,
    modelAnswer:String(q.model_answer||q.modelAnswer||''),
    rubric:Array.isArray(q.rubric)?q.rubric.map(String):[],
    timeLimitSeconds:Math.max(0,Number(q.time_limit_seconds||q.timeLimitSeconds||0)||0)
  };
}

function normalizeStimulus(s){
  if(!s)return null;
  if(typeof s==='string')return{type:'text',title:'',text:s,source:'',caption:''};
  const t=String(s.type||'text').toLowerCase();
  if(t==='table'){
    return{
      type:'table',title:String(s.title||''),
      columns:Array.isArray(s.columns)?s.columns.map(x=>String(x??'')):[],
      rows:Array.isArray(s.rows)?s.rows.filter(Array.isArray).map(r=>r.map(x=>String(x??''))):[],
      source:String(s.source||''),caption:String(s.caption||s.note||'')
    };
  }
  if(t==='svg')return{type:'svg',title:String(s.title||''),svg:String(s.svg||s.content||''),source:String(s.source||''),caption:String(s.caption||'')};
  return{type:'text',title:String(s.title||''),text:String(s.text||s.content||''),source:String(s.source||''),caption:String(s.caption||'')};
}

function normalizePacket(parsed){
  const p=Array.isArray(parsed)?{questions:parsed}:parsed;
  if(!p||!Array.isArray(p.questions))throw new Error('The packet has no questions array.');
  const questions=p.questions.map(normalizeQuestion).filter(Boolean);
  if(!questions.length)throw new Error('The packet contains no valid questions.');
  const fb=String(p.feedback||p.feedback_mode||'immediate').toLowerCase();
  const timing=String(p.timing||p.timing_mode||'record').toLowerCase();
  return{
    format:PACKET_FORMAT,
    packetFormatVersion:PACKET_FORMAT_VERSION,
    packetUid:String(p.packet_uid||p.packetUid||uid('packet')),
    dbdVersion:String(p.dbd_version||p.dbdVersion||`DBD Base ${APP_VERSION}`),
    campaign:String(p.campaign||''),
    subject:String(p.subject||'Unspecified'),
    topic:String(p.topic||'Drill'),
    source:String(p.source||''),
    testType:String(p.test_type||p.testType||'drill'),
    workingStyle:String(p.working_style||p.workingStyle||''),
    answerFormat:String(p.answer_format||p.answerFormat||''),
    difficulty:String(p.difficulty||'Adaptive'),
    feedback:['immediate','end'].includes(fb)?fb:'immediate',
    timing:['off','record','ai'].includes(timing)?timing:'record',
    showTimer:Boolean(p.show_timer??p.showTimer),
    questions
  };
}

function validatePacket(p){
  const errors=[],warnings=[],ids=new Set();let mcq=0,multi=0,typed=0;
  p.questions.forEach((q,i)=>{
    const n=i+1;
    if(!q.prompt.trim())errors.push(`Question ${n} has no prompt.`);
    if(ids.has(q.id))warnings.push(`Duplicate question ID: ${q.id}.`);ids.add(q.id);
    if(q.type==='mcq'){
      mcq++;const keys=Object.keys(q.choices||{});
      if(keys.length<2)errors.push(`Question ${n} has fewer than two choices.`);
      if(!keys.includes(String(q.answer||'').toUpperCase()))errors.push(`Question ${n} has an MCQ answer key that is not in its choices.`);
    }else if(q.type==='multi_select'){
      multi++;const keys=Object.keys(q.choices||{}),ans=Array.isArray(q.answer)?q.answer:[];
      if(keys.length<2)errors.push(`Question ${n} has fewer than two choices.`);
      if(!ans.length)errors.push(`Question ${n} has no selected correct answers.`);
      if(ans.some(a=>!keys.includes(String(a).toUpperCase())))errors.push(`Question ${n} has multi-select answer keys outside its choices.`);
    }else{
      typed++;
      if(q.type==='essay'&&!q.modelAnswer)warnings.push(`Essay question ${n} has no model answer.`);
      if(q.type!=='essay'&&(q.answer===null||q.answer==='')&&!q.acceptedAnswers.length)errors.push(`Question ${n} has no expected answer.`);
    }
    if(!q.explanation&&q.type!=='essay')warnings.push(`Question ${n} has no explanation.`);
    if(!q.tags.length)warnings.push(`Question ${n} has no human-facing tags.`);
    if(q.stimulus?.type==='table'){
      if(!q.stimulus.rows.length)warnings.push(`Question ${n} has an empty table stimulus.`);
      const widths=q.stimulus.rows.map(r=>r.length);
      if(widths.length&&new Set(widths).size>1)warnings.push(`Question ${n} has table rows with different column counts.`);
    }
    if(q.stimulus?.type==='svg'&&!q.stimulus.svg.trim())warnings.push(`Question ${n} has an empty SVG stimulus.`);
  });
  return{errors,warnings,mcq,multi,typed};
}

/* ---------------- DBD Compact packet transport ---------------- */

function base64UrlToBytes(text){
  let s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';
  const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
}
function cleanCompactText(raw){
  let s=String(raw||'').trim();const fenced=s.match(/```(?:text|dbd|json)?\s*([\s\S]*?)```/i);if(fenced)s=fenced[1].trim();return s.replace(/\s+/g,'');
}
async function gunzipBytes(bytes){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress DBD Compact packets. Use ordinary JSON instead.');
  const ds=new DecompressionStream('gzip');return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());
}
// Pure-JS SHA-256 so integrity checking still works in standalone file:// contexts.
function sha256Hex(bytes){
  const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  const l=bytes.length,bitLen=l*8,paddedLen=((l+9+63)>>6)<<6,msg=new Uint8Array(paddedLen);msg.set(bytes);msg[l]=0x80;
  const dv=new DataView(msg.buffer);const hi=Math.floor(bitLen/0x100000000),lo=bitLen>>>0;dv.setUint32(paddedLen-8,hi);dv.setUint32(paddedLen-4,lo);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const w=new Uint32Array(64);
  for(let off=0;off<paddedLen;off+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(off+i*4);
    for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^((~e)&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(x=>x.toString(16).padStart(8,'0')).join('');
}
async function decodeCompactPacket(raw){
  const text=cleanCompactText(raw),parts=text.split('.');
  if(parts.length<4||parts[0]!==COMPACT_PREFIX||parts[1]!==COMPACT_ALGO)throw new Error('This is not a DBD Compact v1 packet.');
  const expected=parts[2].toLowerCase();if(!/^[0-9a-f]{64}$/.test(expected))throw new Error('The DBD Compact checksum is invalid.');
  const jsonBytes=await gunzipBytes(base64UrlToBytes(parts.slice(3).join('.')));
  if(sha256Hex(jsonBytes)!==expected)throw new Error('DBD Compact integrity check failed. The copied text may be damaged.');
  let parsed;try{parsed=JSON.parse(new TextDecoder().decode(jsonBytes))}catch(e){throw new Error('The compact payload decompressed, but its JSON is invalid.')}
  return normalizePacket(parsed);
}

/* ---------------- Safe stimuli ---------------- */

function sanitizeSvg(svgText){
  const raw=String(svgText||'').trim();if(!raw||typeof DOMParser==='undefined')return'';
  try{
    const doc=new DOMParser().parseFromString(raw,'image/svg+xml');
    if(doc.querySelector('parsererror'))return'';
    const root=doc.documentElement;if(!root||root.nodeName.toLowerCase()!=='svg')return'';
    const allowedTags=new Set(['svg','g','path','line','polyline','polygon','rect','circle','ellipse','text','tspan','defs','marker','lineargradient','radialgradient','stop','clippath']);
    const allowedAttrs=new Set(['viewbox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','font-size','font-weight','text-anchor','dominant-baseline','transform','opacity','offset','stop-color','stop-opacity','marker-end','marker-start','preserveaspectratio','id','class','clip-path']);
    for(const el of [...root.querySelectorAll('*')]){
      const tag=el.nodeName.toLowerCase();if(!allowedTags.has(tag)){el.remove();continue}
      for(const a of [...el.attributes]){
        const n=a.name.toLowerCase(),v=String(a.value||'');
        if(n.startsWith('on')||!allowedAttrs.has(n)){el.removeAttribute(a.name);continue}
        if(['marker-end','marker-start','clip-path'].includes(n)&&!/^url\(\#[A-Za-z_][A-Za-z0-9_.:-]*\)$/.test(v))el.removeAttribute(a.name);
        if(n==='id'&&!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(v))el.removeAttribute(a.name);
        if(n==='class'){
          const classes=v.split(/\s+/).filter(c=>/^svg-(?:main|accent|muted|secondary|danger|success)-(?:line|label|fill)$/.test(c));
          if(classes.length)el.setAttribute('class',classes.join(' '));else el.removeAttribute('class');
        }
      }
    }
    for(const a of [...root.attributes]){
      const n=a.name.toLowerCase();if(!allowedAttrs.has(n)&&n!=='xmlns')root.removeAttribute(a.name);
    }
    root.setAttribute('xmlns','http://www.w3.org/2000/svg');
    if(!root.getAttribute('viewBox')&&!root.getAttribute('viewbox')){
      const w=parseFloat(root.getAttribute('width')||'0'),h=parseFloat(root.getAttribute('height')||'0');
      if(w>0&&h>0)root.setAttribute('viewBox',`0 0 ${w} ${h}`);
    }
    return new XMLSerializer().serializeToString(root);
  }catch(e){console.warn('SVG rejected',e);return''}
}

function stimulusHTML(s){
  if(!s)return'';
  if(s.type==='table'){
    const colCount=Math.max(s.columns.length,...s.rows.map(r=>r.length),1);
    const head=s.columns.length?`<thead><tr>${Array.from({length:colCount},(_,i)=>`<th>${esc(s.columns[i]??'')}</th>`).join('')}</tr></thead>`:'';
    const body=`<tbody>${s.rows.map(r=>`<tr>${Array.from({length:colCount},(_,i)=>`<td>${esc(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<div class="stimulus stimulus-table">${s.title?`<div class="stimulus-title">${esc(s.title)}</div>`:''}<div class="stimulus-table-wrap"><table>${head}${body}</table></div>${s.caption?`<div class="stimulus-caption">${esc(s.caption)}</div>`:''}${s.source?`<div class="stimulus-source">— ${esc(s.source)}</div>`:''}</div>`;
  }
  if(s.type==='svg'){
    const safe=sanitizeSvg(s.svg);
    return `<div class="stimulus stimulus-svg">${s.title?`<div class="stimulus-title">${esc(s.title)}</div>`:''}${safe?`<div class="stimulus-svg-wrap">${safe}</div>`:`<div class="empty">Diagram unavailable: SVG rejected by the safety filter.</div>`}${s.caption?`<div class="stimulus-caption">${esc(s.caption)}</div>`:''}${s.source?`<div class="stimulus-source">— ${esc(s.source)}</div>`:''}</div>`;
  }
  return `<div class="stimulus stimulus-copy">${s.title?`<div class="stimulus-title">${esc(s.title)}</div>`:''}<div class="stimulus-text">${esc(s.text)}</div>${s.caption?`<div class="stimulus-caption">${esc(s.caption)}</div>`:''}${s.source?`<div class="stimulus-source">— ${esc(s.source)}</div>`:''}</div>`;
}

/* ---------------- Answer matching ---------------- */

function normalizeNumericText(v){return String(v??'').trim().replace(/^\+/,'').replace(',','.').replace(/\s+/g,'')}
function setsEqual(a,b){
  const A=[...(a||[])].map(x=>String(x).toUpperCase()).sort(),B=[...(b||[])].map(x=>String(x).toUpperCase()).sort();
  return A.length===B.length&&A.every((x,i)=>x===B[i]);
}
function objectiveCorrect(q,r){
  if(['skipped','unseen','timeout'].includes(r.status))return false;
  if(q.type==='essay')return r.selfAssessment==='yes';
  if(q.type==='mcq')return norm(r.selected)===norm(q.answer);
  if(q.type==='multi_select')return setsEqual(r.selected,q.answer);
  if(q.type==='numeric'){
    const given=Number(normalizeNumericText(r.selected??r.draft)),expected=Number(normalizeNumericText(q.answer));
    if(Number.isFinite(given)&&Number.isFinite(expected))return Math.abs(given-expected)<=q.tolerance;
  }
  const supplied=String(r.selected??r.draft??'');
  const candidates=[String(q.answer??''),...q.acceptedAnswers].filter(Boolean);
  if(candidates.some(x=>norm(x)===norm(supplied)))return true;
  if(q.answerRegex&&q.answerRegex.length<=300){
    try{return new RegExp(q.answerRegex,'i').test(supplied)}catch(e){}
  }
  return false;
}

/* ---------------- Session runtime ---------------- */

function currentSession(){return DATA.activeSessions.find(s=>s.id===DATA.currentActiveId)||null}
function currentQuestion(){const s=currentSession();return s?.packet?.questions?.[s.index]||null}
function currentResponse(){const s=currentSession();return s?.responses?.[s.index]||null}
function freshResponse(q){return normalizeResponse(null,q)}

function launchPending(){
  const pp=DATA.pendingPacket;if(!pp)return;
  const p=pp.packet;
  ensureSubject(p.subject);
  const s={
    id:uid('session'),packet:p,responses:p.questions.map(freshResponse),index:0,startedAt:nowISO(),activeMs:0,paused:false,review:false,completedFirstPass:false,sourceName:pp.sourceName||'Imported packet'
  };
  DATA.activeSessions.push(s);DATA.currentActiveId=s.id;DATA.pendingPacket=null;save();
  resetEphemeral();route('drill');
}
function resumeSession(id){
  const s=DATA.activeSessions.find(s=>s.id===id);if(!s)return;s.paused=false;DATA.currentActiveId=id;save();resetEphemeral();route('drill');
}
function resetEphemeral(){
  UI.calcOpen=false;UI.calcExpression='';UI.calcCursor=0;UI.commentOpen=false;UI.pauseOpen=false;UI.skipNotice=null;UI.lastTick=performance.now();
}
function accrueNow(){
  const s=currentSession();if(!s||s.paused||s.review||ROUTE!=='drill'||!UI.lastTick)return;
  const t=performance.now(),delta=Math.max(0,t-UI.lastTick);UI.lastTick=t;
  s.activeMs+=delta;const r=currentResponse();if(r)r.elapsedMs+=delta;
}
function startTimer(){
  stopTimer();UI.lastTick=performance.now();
  UI.timerHandle=setInterval(()=>{
    const s=currentSession();if(!s||s.paused||s.review||ROUTE!=='drill'){UI.lastTick=performance.now();return}
    accrueNow();
    const r=currentResponse(),q=currentQuestion();
    if(q?.timeLimitSeconds>0&&r&&!r.locked&&r.elapsedMs>=q.timeLimitSeconds*1000){
      r.status='timeout';r.timedOut=true;r.locked=true;r.correct=false;save();render();
    }else if(Math.floor(s.activeMs/1000)%5===0)save();
    const timerEl=document.getElementById('question-timer');
    if(timerEl&&s.packet.showTimer){
      const limit=q?.timeLimitSeconds||0;
      timerEl.textContent=limit>0?`${fmtMs(r?.elapsedMs||0)} / ${Math.floor(limit/60)}:${String(limit%60).padStart(2,'0')}`:fmtMs(r?.elapsedMs||0);
    }
  },1000);
}
function stopTimer(){if(UI.timerHandle){clearInterval(UI.timerHandle);UI.timerHandle=null}}

function unresolvedIndices(s=currentSession()){
  if(!s)return[];return s.responses.map((r,i)=>['unseen','skipped'].includes(r.status)?i:null).filter(i=>i!==null);
}
function nextUntouchedIndex(s=currentSession(),from=s?.index??0){
  if(!s)return-1;
  for(let i=from+1;i<s.responses.length;i++)if(s.responses[i].status==='unseen')return i;
  for(let i=0;i<=from;i++)if(s.responses[i].status==='unseen')return i;
  return-1;
}
function goNext(){
  const s=currentSession();if(!s)return;
  const next=nextUntouchedIndex(s,s.index);
  if(next>=0){s.index=next;s.review=false;resetQuestionUI();save();render();return}
  s.completedFirstPass=true;s.review=true;save();render();
}
function jumpToQuestion(index){
  const s=currentSession();if(!s)return;s.index=clamp(Number(index),0,s.packet.questions.length-1);s.review=false;resetQuestionUI();save();render();
}
function resetQuestionUI(){UI.calcOpen=false;UI.calcExpression='';UI.calcCursor=0;UI.commentOpen=false;UI.lastTick=performance.now()}

function setConfidence(v){const r=currentResponse();if(!r)return;r.confidence=v;save();render()}
function toggleFlag(){const r=currentResponse();if(!r)return;r.flagged=!r.flagged;save();render()}
function toggleComment(){UI.commentOpen=!UI.commentOpen;render();setTimeout(()=>document.getElementById('comment-box')?.focus(),0)}
function updateComment(v){const r=currentResponse();if(!r)return;r.comment=String(v);save()}
function setErrorCause(v){const r=currentResponse();if(!r)return;r.errorCause=v;save();render()}

function chooseMCQ(key){
  const q=currentQuestion(),r=currentResponse();if(!q||!r||r.locked)return;
  r.selected=String(key).toUpperCase();r.status='answered';r.locked=true;r.correct=objectiveCorrect(q,r);recordCalcSnapshot('answer');save();render();
}
function toggleMulti(key){
  const r=currentResponse();if(!r||r.locked)return;
  const k=String(key).toUpperCase(),set=new Set(Array.isArray(r.selected)?r.selected:[]);set.has(k)?set.delete(k):set.add(k);r.selected=[...set].sort();save();render();
}
function submitMulti(){
  const q=currentQuestion(),r=currentResponse();if(!q||!r||r.locked)return;if(!Array.isArray(r.selected)||!r.selected.length){toast('Select at least one option.');return}
  r.status='answered';r.locked=true;r.correct=objectiveCorrect(q,r);recordCalcSnapshot('answer');save();render();
}
function setDraft(v){const r=currentResponse();if(!r||r.locked)return;r.draft=String(v);save()}
function submitTyped(){
  const q=currentQuestion(),r=currentResponse();if(!q||!r||r.locked)return;
  if(!r.draft.trim()){toast('Enter an answer first.');return}
  r.selected=r.draft;r.status='answered';r.locked=true;r.correct=objectiveCorrect(q,r);recordCalcSnapshot('answer');save();render();
}
function revealEssay(){
  const r=currentResponse();if(!r||r.locked)return;if(!r.draft.trim()){toast('Write your attempt first.');return}
  r.selected=r.draft;r.status='answered';r.locked=true;recordCalcSnapshot('answer');save();render();
}
function selfAssess(v){const q=currentQuestion(),r=currentResponse();if(!q||!r)return;r.selfAssessment=v;r.correct=objectiveCorrect(q,r);save();render()}

function skipCurrent(){
  const s=currentSession(),r=currentResponse();if(!s||!r)return;
  recordCalcSnapshot('skip');
  const skippedIndex=s.index;r.status='skipped';r.locked=false;r.correct=false;r.selected=null;r.draft='';save();
  UI.skipNotice={sessionId:s.id,index:skippedIndex,questionId:s.packet.questions[skippedIndex].id};
  const next=nextUntouchedIndex(s,skippedIndex);
  if(next>=0){s.index=next;resetQuestionUI();save();render()}else{s.completedFirstPass=true;s.review=true;save();render()}
}
function setSkipReason(reason){
  const n=UI.skipNotice;if(!n)return;const s=DATA.activeSessions.find(x=>x.id===n.sessionId);if(!s)return;const r=s.responses[n.index];if(r)r.skipReason=reason;save();UI.skipNotice=null;render();toast('Skip reason saved.');
}

function pauseSession(){const s=currentSession();if(!s)return;accrueNow();s.paused=true;UI.pauseOpen=true;save();render()}
function resumeFromPause(){const s=currentSession();if(!s)return;s.paused=false;UI.pauseOpen=false;UI.lastTick=performance.now();save();render()}
function abandonSession(){const s=currentSession();if(!s)return;if(!confirm('End this ongoing session without adding it to completed History?'))return;DATA.activeSessions=DATA.activeSessions.filter(x=>x.id!==s.id);DATA.currentActiveId=DATA.activeSessions[0]?.id||null;save();resetEphemeral();route('home')}

/* ---------------- Calculator ---------------- */

function calcEval(expr=UI.calcExpression){
  const raw=String(expr||'').trim();if(!raw)return null;
  try{
    const js=raw.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-');
    if(!/^[0-9+\-*/().%\s]+$/.test(js))return null;
    const n=Function(`"use strict";return (${js})`)();
    return typeof n==='number'&&Number.isFinite(n)?n:null;
  }catch(e){return null}
}
function toggleCalculator(){
  const r=currentResponse();if(!r)return;
  if(UI.calcOpen)recordCalcSnapshot('close');
  UI.calcOpen=!UI.calcOpen;
  if(UI.calcOpen){r.calculator.used=true;r.calculator.openCount++;UI.calcCursor=UI.calcExpression.length;save()}
  render();if(UI.calcOpen)restoreCalcCursor();
}
function calcTyped(el){
  UI.calcExpression=el.value;UI.calcCursor=el.selectionStart??el.value.length;render();restoreCalcCursor();
}
function calcInsert(v){
  const s=UI.calcExpression,pos=clamp(UI.calcCursor,0,s.length);UI.calcExpression=s.slice(0,pos)+v+s.slice(pos);UI.calcCursor=pos+String(v).length;render();restoreCalcCursor();
}
function calcBackspace(){
  const s=UI.calcExpression,pos=clamp(UI.calcCursor,0,s.length);if(pos<=0)return;UI.calcExpression=s.slice(0,pos-1)+s.slice(pos);UI.calcCursor=pos-1;render();restoreCalcCursor();
}
function calcClear(){UI.calcExpression='';UI.calcCursor=0;render();restoreCalcCursor()}
function calcMove(delta){UI.calcCursor=clamp(UI.calcCursor+delta,0,UI.calcExpression.length);restoreCalcCursor()}
function calcEquals(){
  const n=calcEval();if(n===null){toast('Calculator expression is invalid.');return}
  recordCalcSnapshot('equals');UI.calcExpression=String(n);UI.calcCursor=UI.calcExpression.length;render();restoreCalcCursor();
}
function calcUseAnswer(){
  const n=calcEval();if(n===null){toast('No valid calculator result to use.');return}
  const r=currentResponse(),q=currentQuestion();if(!r||!q)return;
  if(['numeric','short','essay'].includes(q.type)){recordCalcSnapshot('use-answer');r.draft=String(n);save();render();toast('Calculator result inserted into answer.');setTimeout(()=>document.getElementById('typed-answer')?.focus(),0)}
  else toast('Use Answer is available for typed-answer questions.');
}
function restoreCalcCursor(){
  requestAnimationFrame(()=>{const el=document.getElementById('calc-expression');if(!el)return;el.focus();const p=clamp(UI.calcCursor,0,el.value.length);try{el.setSelectionRange(p,p)}catch(e){}});
}
function recordCalcSnapshot(reason='snapshot'){
  const r=currentResponse();if(!r||!r.calculator.used)return;
  const expression=String(UI.calcExpression||'').trim(),n=calcEval(expression);if(!expression||n===null)return;
  const result=String(n),last=r.calculator.history[r.calculator.history.length-1];
  if(last&&last.expression===expression&&String(last.result)===result)return;
  r.calculator.history.push({expression,result,reason,at:nowISO()});save();
}

/* ---------------- Evidence / completion ---------------- */

function responseToAttempt(q,r){
  const correct=typeof r.correct==='boolean'?r.correct:objectiveCorrect(q,r);
  return{
    questionId:q.id,type:q.type,prompt:q.prompt,stimulus:q.stimulus,
    choices:q.choices?{...q.choices}:null,
    selected:Array.isArray(r.selected)?r.selected.slice():r.selected,
    answer:Array.isArray(q.answer)?q.answer.slice():q.answer,
    acceptedAnswers:q.acceptedAnswers.slice(),modelAnswer:q.modelAnswer,rubric:q.rubric.slice(),
    correct,status:r.status,confidence:r.confidence,errorCause:r.errorCause,skipReason:r.skipReason,
    comment:r.comment,flagged:r.flagged,elapsedMs:Math.round(r.elapsedMs),calculator:normalizeCalculatorEvidence(r.calculator),
    tags:q.tags.slice(),prerequisites:q.prerequisites.slice(),explanation:q.explanation,whyWrong:{...q.whyWrong},difficulty:q.difficulty,timeLimitSeconds:q.timeLimitSeconds,selfAssessment:r.selfAssessment
  };
}
function completeSession(){
  const s=currentSession();if(!s)return;accrueNow();
  const attempts=s.packet.questions.map((q,i)=>responseToAttempt(q,s.responses[i]));
  const total=attempts.length,correct=attempts.filter(a=>a.correct).length,unanswered=attempts.filter(a=>['skipped','unseen'].includes(a.status)).length;
  const completed={
    id:s.id,campaign:s.packet.campaign,subject:canonicalSubjectName(s.packet.subject),topic:s.packet.topic,source:s.packet.source,
    testType:s.packet.testType,difficulty:s.packet.difficulty,feedback:s.packet.feedback,showTimer:s.packet.showTimer,
    startedAt:s.startedAt,completedAt:nowISO(),activeMs:Math.round(s.activeMs),totalQuestions:total,correct,accuracy:total?correct/total*100:0,unanswered,attempts
  };
  DATA.completedSessions=DATA.completedSessions.filter(x=>x.id!==completed.id);DATA.completedSessions.push(completed);
  DATA.activeSessions=DATA.activeSessions.filter(x=>x.id!==s.id);DATA.currentActiveId=DATA.activeSessions[0]?.id||null;ensureSubject(completed.subject);save();
  SELECTED_SESSION_ID=completed.id;stopTimer();resetEphemeral();route('session');
}

function resultsText(s){
  const lines=[];
  lines.push('# DBD Base Results','',`**Subject:** ${s.subject}`,`**Topic:** ${s.topic||'—'}`,`**Source:** ${s.source||'—'}`,`**Drill type:** ${s.testType||'—'}`,`**Difficulty:** ${s.difficulty||'—'}`,`**Questions:** ${s.totalQuestions}`,`**Correct:** ${s.correct}`,`**Raw accuracy:** ${Math.round(s.accuracy||0)}%`,`**Skipped / unanswered:** ${s.unanswered||0}`,`**Active time:** ${fmtMs(s.activeMs)}`,'','> Score is evidence, not diagnosis. Base records what happened; the Subject Chat interprets what it means.','', '## Question evidence','');
  (s.attempts||[]).forEach((a,i)=>{
    lines.push(`### Q${i+1}`,a.prompt,'');
    if(a.choices){
      lines.push('**Choices:**');
      for(const [k,v] of Object.entries(a.choices))lines.push(`- ${k}. ${stripChoicePrefix(k,v)}`);
      lines.push('');
    }
    const selected=Array.isArray(a.selected)?a.selected.join(', '):(a.selected??'—');
    const answer=Array.isArray(a.answer)?a.answer.join(', '):(a.answer??a.modelAnswer??'—');
    lines.push(`- **Your answer:** ${selected||'—'}`,`- **Correct / reference answer:** ${answer||'—'}`,`- **Result:** ${a.correct?'Correct':['skipped','unseen'].includes(a.status)?'Skipped / unanswered':a.status==='timeout'?'Timed out':'Wrong'}`,`- **Confidence:** ${a.confidence||'—'}`,`- **Error cause:** ${a.errorCause||'—'}`,`- **Skip reason:** ${a.skipReason||'—'}`,`- **Response time:** ${fmtMs(a.elapsedMs)}`,`- **Flagged:** ${a.flagged?'Yes':'No'}`,`- **Tags:** ${a.tags?.join(', ')||'—'}`,`- **Prerequisite context:** ${a.prerequisites?.join(', ')||'—'}`,`- **Comment:** ${a.comment||'—'}`,`- **Calculator used:** ${a.calculator?.used?'Yes':'No'}`);
    if(a.calculator?.used){
      lines.push('- **Calculator history:**');
      if(a.calculator.history?.length)a.calculator.history.forEach((h,j)=>lines.push(`  ${j+1}. ${h.expression} = ${h.result}`));else lines.push('  —');
    }
    lines.push(`- **Explanation:** ${a.explanation||a.modelAnswer||'—'}`,'');
  });
  return lines.join('\n');
}
async function copyResults(id,button){
  const s=DATA.completedSessions.find(x=>x.id===id);if(!s)return;
  const text=resultsText(s);
  if(text.length>80000){download(`dbd-results-${slug(s.subject)}-${slug(s.topic)}-${localDay()}.md`,text,'text/markdown');toast('Results were large, so Base downloaded Markdown instead.');return}
  const ok=await copyText(text);if(ok){if(button){const old=button.textContent;button.textContent='COPIED ✓';setTimeout(()=>button.textContent=old,1500)}else toast('Results copied.')}else toast('Could not copy results.');
}

/* ---------------- Vault / archive IO ---------------- */

function exportVault(){
  save();download(`dbd-base-vault-${localDay()}.json`,JSON.stringify(DATA,null,2),'application/json');toast('Vault exported.');
}
function exportLegacyArchive(){
  const payload={format:'dbd-legacy-archive',version:1,exportedAt:nowISO(),migration:DATA.migration,legacyArchive:DATA.legacyArchive};
  download(`dbd-legacy-archive-${localDay()}.json`,JSON.stringify(payload,null,2),'application/json');toast('Legacy archive exported.');
}
function exportSubjectHistory(id){
  const rec=DATA.subjects.find(s=>s.id===id);if(!rec)return;const summary=subjectSummary(rec);
  const payload={format:'dbd-base-subject-history',version:1,appVersion:APP_VERSION,exportedAt:nowISO(),subject:rec,sessions:summary.sessions.slice().sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt))};
  download(`dbd-${slug(rec.name)}-history-${localDay()}.json`,JSON.stringify(payload,null,2),'application/json');
}
function exportSession(id){
  const s=DATA.completedSessions.find(x=>x.id===id);if(!s)return;
  download(`dbd-${slug(s.subject)}-${slug(s.topic)}-${localDay()}.json`,JSON.stringify({format:'dbd-base-session-history',version:1,appVersion:APP_VERSION,exportedAt:nowISO(),session:s},null,2),'application/json');
}
function mergeById(a,b){const m=new Map();[...(a||[]),...(b||[])].forEach(x=>{if(x?.id)m.set(x.id,x)});return [...m.values()]}
function mergeSubjects(a,b){
  const out=(a||[]).map(x=>({...x,aliases:[...(x.aliases||[])]}));
  for(const rec of b||[]){const old=out.find(x=>subjectMatches(x,rec.name)||rec.aliases?.some(alias=>subjectMatches(x,alias)));if(old){old.aliases=[...new Set([...old.aliases,...rec.aliases,rec.name])]}else out.push(rec)}
  return out.sort((x,y)=>x.name.localeCompare(y.name));
}
function mergeVaultObject(incoming){
  const v=normalizeVault(incoming);
  DATA.subjects=mergeSubjects(DATA.subjects,v.subjects);
  DATA.completedSessions=mergeById(DATA.completedSessions,v.completedSessions);
  DATA.activeSessions=mergeById(DATA.activeSessions,v.activeSessions);
  if(!DATA.pendingPacket&&v.pendingPacket)DATA.pendingPacket=v.pendingPacket;
  const l1=DATA.legacyArchive,l2=v.legacyArchive;
  l1.questionBank=mergeById(l1.questionBank,l2.questionBank);
  l1.streamAttempts=mergeById(l1.streamAttempts,l2.streamAttempts);
  l1.streamPrototypeAttempts=mergeById(l1.streamPrototypeAttempts,l2.streamPrototypeAttempts);
  l1.conceptManifests=[...l1.conceptManifests,...l2.conceptManifests];
  l1.subjectManifests=[...l1.subjectManifests,...l2.subjectManifests];
  l1.bankCollections=[...l1.bankCollections,...l2.bankCollections];
  save();
}
function chooseJSONFile(onText){
  const input=document.createElement('input');input.type='file';input.accept='.json,.dbd,application/json';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{onText(await f.text(),f.name)}catch(e){alert(e.message||'Could not read file.')}};input.click();
}
function mergeVault(){
  chooseJSONFile((text)=>{let raw;try{raw=JSON.parse(text)}catch(e){throw new Error('The selected file is not valid JSON.')};mergeVaultObject(raw);render();toast('Vault merged.');});
}
function replaceVault(){
  chooseJSONFile((text)=>{let raw;try{raw=JSON.parse(text)}catch(e){throw new Error('The selected file is not valid JSON.')};if(!confirm('Replace this browser’s DBD data with the selected Vault?'))return;DATA=normalizeVault(raw);save();applyTheme();route('home');toast('Vault restored.');});
}
function resetAll(){
  if(!confirm('Reset all DBD Base data stored in this browser? Export a Vault first if you want a backup.'))return;
  DATA=newVault();save();applyTheme();route('home');
}

/* ---------------- Subject / History management ---------------- */

function renameSubject(id){
  const rec=DATA.subjects.find(s=>s.id===id);if(!rec)return;
  const next=prompt('Rename canonical subject:',rec.name);if(!next?.trim())return;
  const old=rec.name;rec.name=next.trim();rec.aliases=[...new Set([rec.name,old,...rec.aliases])];save();render();
}
function addAlias(id){
  const rec=DATA.subjects.find(s=>s.id===id);if(!rec)return;
  const a=prompt(`Add alias for ${rec.name}:`);if(!a?.trim())return;rec.aliases=[...new Set([...rec.aliases,a.trim()])];save();render();
}
function mergeSubjectsUI(){
  if(DATA.subjects.length<2){toast('Need at least two subjects to merge.');return}
  const from=prompt(`Merge which subject?\n\n${DATA.subjects.map(s=>s.name).join('\n')}`);if(!from)return;
  const source=DATA.subjects.find(s=>subjectMatches(s,from));if(!source){alert('Source subject not found.');return}
  const to=prompt(`Merge ${source.name} into which canonical subject?\n\n${DATA.subjects.filter(s=>s.id!==source.id).map(s=>s.name).join('\n')}`);if(!to)return;
  const target=DATA.subjects.find(s=>s.id!==source.id&&subjectMatches(s,to));if(!target){alert('Target subject not found.');return}
  if(!confirm(`Merge ${source.name} into ${target.name}? Historical session labels will be preserved, while aliases group them under ${target.name}.`))return;
  target.aliases=[...new Set([...target.aliases,source.name,...source.aliases])];
  DATA.subjects=DATA.subjects.filter(s=>s.id!==source.id);save();render();
}
function deleteSubject(id){
  const rec=DATA.subjects.find(s=>s.id===id);if(!rec)return;const summary=subjectSummary(rec);
  if(!confirm(`Delete ${rec.name}?\n\nThis permanently removes ${summary.sessions.length} completed session(s), ${summary.active.length} ongoing session(s), and any pending packet for this subject. Legacy Archive data is not silently destroyed.`))return;
  DATA.completedSessions=DATA.completedSessions.filter(s=>!subjectMatches(rec,s.subject));
  DATA.activeSessions=DATA.activeSessions.filter(s=>!subjectMatches(rec,s.packet?.subject));
  if(DATA.pendingPacket?.packet&&subjectMatches(rec,DATA.pendingPacket.packet.subject))DATA.pendingPacket=null;
  DATA.subjects=DATA.subjects.filter(s=>s.id!==id);if(!DATA.activeSessions.some(s=>s.id===DATA.currentActiveId))DATA.currentActiveId=DATA.activeSessions[0]?.id||null;
  SELECTED_SUBJECT_ID=null;save();render();toast('Subject and Base history deleted.');
}
function deleteSession(id){
  const s=DATA.completedSessions.find(x=>x.id===id);if(!s)return;
  if(!confirm(`Delete this completed session?\n\n${s.subject} · ${s.topic}\n\nThis permanently removes its recorded Base evidence.`))return;
  DATA.completedSessions=DATA.completedSessions.filter(x=>x.id!==id);if(SELECTED_SESSION_ID===id)SELECTED_SESSION_ID=null;HISTORY_MENU_ID=null;save();route('history');
}

/* ---------------- Import flow ---------------- */

function preparePacket(packet,sourceName='Imported packet'){
  const validation=validatePacket(packet);DATA.pendingPacket={packet,sourceName,validation};ensureSubject(packet.subject);save();IMPORT_ERROR='';route('import');
}
function preparePacketFromText(text,sourceName='Pasted JSON'){
  let parsed;try{parsed=JSON.parse(text)}catch(e){throw new Error('The pasted package is not valid JSON.')}
  preparePacket(normalizePacket(parsed),sourceName);
}
async function readCompactFromTextarea(){
  const ta=document.getElementById('compact-packet-input');if(!ta?.value.trim()){toast('Paste compressed JSON first.');return}
  try{preparePacket(await decodeCompactPacket(ta.value),'Pasted compressed packet')}catch(e){IMPORT_ERROR=e.message;render()}
}
function readJSONFromTextarea(){
  const ta=document.getElementById('packet-input');if(!ta?.value.trim()){toast('Paste JSON first.');return}
  try{preparePacketFromText(ta.value,'Pasted JSON')}catch(e){IMPORT_ERROR=e.message;render()}
}
function choosePacketFile(){document.getElementById('packet-file')?.click()}
async function packetFileChanged(input){
  const f=input.files?.[0];if(!f)return;
  try{
    const text=await f.text();
    if(cleanCompactText(text).startsWith(`${COMPACT_PREFIX}.${COMPACT_ALGO}.`))preparePacket(await decodeCompactPacket(text),f.name);
    else preparePacketFromText(text,f.name);
  }catch(e){IMPORT_ERROR=e.message||'Could not read package.';render()}
}
function cancelPending(){DATA.pendingPacket=null;save();route('home')}
function updatePendingFeedback(v){if(DATA.pendingPacket?.packet){DATA.pendingPacket.packet.feedback=v==='end'?'end':'immediate';save();render()}}
function updatePendingTimer(v){if(DATA.pendingPacket?.packet){DATA.pendingPacket.packet.showTimer=Boolean(v);save();render()}}
function updateNextFocus(v){DATA.settings.nextGenerationFocus=String(v);save()}

/* ---------------- Generation prompt ---------------- */

function generationPrompt(){
  const focus=String(DATA.settings.nextGenerationFocus||'').trim();
  return `# DBD Base 1.5 — build me a drill packet

DBD Base is the execution and evidence layer of my learning system. You, the Subject Chat, are the semantic layer.

Your job is to understand the actual material in THIS subject chat, decide what knowledge is worth testing, create a trustworthy drill, choose the clearest representation for each item, and package the result for DBD Base. Base renders the packet, runs the session, and records factual evidence. Base does not decide what I should study and does not diagnose what my score means.

Core doctrine: **score is evidence, not diagnosis.**
${focus?`\nA focus note saved from my previous Base launch is: ${focus}\n`:''}
## Before generation

Inspect the real context available in this subject chat: uploaded files, textbook pages, teacher materials, prior explanations, confirmed scope, mistakes, and assessment context. Do not silently replace those sources with a generic curriculum.

Important: **mentioned is not the same as taught.** Do not test a concept merely because it appeared once in conversation or a source. Prefer concepts that are confirmed as taught, practiced, demonstrated, assigned, or explicitly requested. If scope status is genuinely ambiguous, ask.

Before producing the packet, ask me ONE compact, natural setup question. It should resolve only what is useful now:
- material/scope;
- rough practice purpose (coverage, repair, mastery, exam-like, deep practice, etc.);
- question count;
- immediate feedback vs after-session feedback;
- visible timer or not;
- any additional focus or constraint.

Infer backend details such as answer format, difficulty mix, working style, and representation yourself. Do not make me configure a form of internal variables.

Then wait for my answer.

## Question design doctrine

Every question consumes attention. Do not fill a quota.

A question should test something meaningful:
- a concept or condition I need to retrieve;
- a procedure I need to execute;
- a misconception or trap;
- a choice of method;
- interpretation of information;
- transfer to a slightly different situation;
- an exam-relevant decision.

Avoid decorative wording, repetitive numerical skins, fake breadth, ambiguity, and questions whose difficulty is mainly tedious arithmetic unless arithmetic is itself the target skill.

Use a smooth difficulty ramp when appropriate. A good progression is often:
1. clean mechanism / toy relation;
2. clean school-style question;
3. school-style question with one complication;
4. full mixed or transfer problem.

Do not jump from a tiny toy example directly to an unnecessarily dense full problem unless that jump is explicitly the point.

## Representation doctrine

Choose representation BEFORE wording.

Use **plain text** when prose/equations are clearest.

Use a **native table** when comparison, alignment, repeated givens, datasets, reaction sets, or row/column structure is the information. Chemistry examples include Hess-law reaction sets, ΔHf° datasets, and calorimetry givens. Do not create a fake SVG table.

Table stimulus example:
{
  "type": "table",
  "title": "Data reaksi",
  "columns": ["Reaksi", "ΔH"],
  "rows": [
    ["C(s) + O₂(g) → CO₂(g)", "−400 kJ"],
    ["2H₂(g) + O₂(g) → 2H₂O(l)", "−600 kJ"]
  ]
}

Use **sanitized SVG** when spatial structure is genuinely part of the knowledge:
- mathematics: geometry, circles, graphs, vectors, transformations;
- physics: vectors, free-body diagrams, trajectories, v–t/s–t graphs, circular motion;
- chemistry: skeletal structures, isomers, highlighted bonds, reaction-energy profiles.

SVG is not decoration. Use semantic classes instead of hard-coded colors:
svg-main-line, svg-accent-line, svg-muted-line, svg-secondary-line,
svg-danger-line, svg-success-line, svg-label, svg-accent-label,
svg-secondary-label, svg-danger-label, svg-success-label,
svg-accent-fill, svg-secondary-fill, svg-danger-fill, svg-success-fill.

Keep labels readable on a phone, use generous viewBox margins, keep labels away from line intersections, and place angle values clearly outside/above the relevant rays or arcs. No scripts, event handlers, remote resources, external links, foreignObject, or arbitrary HTML.

## Question types

DBD Base 1.5 supports:
- "mcq" for exactly one correct choice;
- "multi_select" for more than one correct choice;
- "numeric";
- "short";
- "essay" / self-check style.

For MCQ, choices should contain the text only. Do NOT write "A. ..." inside the A value because Base renders the key itself.

Good:
"choices": {"A": "Sistem melepaskan energi", "B": "Sistem menyerap energi"}

Bad:
"choices": {"A": "A. Sistem melepaskan energi", "B": "B. Sistem menyerap energi"}

For multi-select, store the correct set as an array of keys:
"answer": ["A", "C"]

Base 1.5 uses exact-set grading for multi-select. Do not rely on partial credit.

## Answer matching

Do not let equivalent correct answers fail because of superficial formatting.

For numeric questions:
- store a clean numeric canonical answer;
- use tolerance when approximation is legitimate;
- a positive number such as 12.5 should not require the learner to type an explicit + unless the sign notation itself is the tested skill;
- 12.5 and +12.5 should normally represent the same numerical answer.

Use accepted_answers for predictable wording/symbol variants. Use answer_regex only when a safe textual pattern genuinely helps.

## Evidence-aware authoring

Base records more than correctness. Results may contain:
- full answer choices;
- learner answer;
- reference answer;
- raw correctness;
- confidence (Sure / Not sure / Ngasal);
- learner-recorded error cause;
- optional skip reason;
- response time;
- calculator expression/result trail;
- comment and flag;
- human-facing tags;
- optional prerequisite context.

Do not collapse these into an invented mastery diagnosis. The Subject Chat should interpret them after the session.

If a question tests a target concept but depends on another prerequisite, you may add:
"prerequisites": ["Struktur hidrokarbon", "Stoikiometri"]

This is context, not a claim that a future failure was caused by that prerequisite.

## Explanations and tags

Keep the canonical answer and explanation separate. Explanations should usually be concise repair: governing idea + critical step, not a mini textbook chapter.

Tags must be human-facing taught concepts/skills, e.g. "Hukum Hess", "kalorimetri", "sudut pusat", "GLBB". Do not use model-process labels such as "retrieval" or "transfer" unless they are actual taught terms.

## Subject-specific validation

Before export, perform subject-appropriate validity checks in addition to ordinary QA.

For Chemistry, explicitly verify where relevant:
- equations are balanced;
- Hess target reactions are actually constructible from the supplied equations;
- signs are correct;
- units are correct;
- physical states are correct when relevant;
- answer uniqueness/tolerance is valid;
- the intended answer has been independently checked.

For Mathematics/Physics, verify givens, geometry/diagram consistency, units, sign conventions, and the actual solvability of the problem.

## Packet-wide QA

Before exporting, silently audit the COMPLETE packet. Do not show private chain-of-thought.

Check:
- every question tests something worth my attention;
- there are no accidental repeated numerical skins;
- difficulty ramps sensibly;
- no required information is missing;
- answer keys are unique and valid;
- equivalent typed answers are accepted;
- dense comparable data use tables rather than walls of inline text;
- SVG is used only when spatial structure matters and labels are unclipped;
- question content matches taught/requested scope rather than merely mentioned material;
- explanations are concise and correct;
- tags and prerequisites are useful to the future Subject Chat reviewing evidence.

Fix problems before export.

## DBD Base Packet v1 contract

Return valid JSON with fields such as:
{
  "dbd_version": "DBD Base 1.5",
  "campaign": "...",
  "subject": "...",
  "topic": "...",
  "source": "specific material used from this chat",
  "test_type": "coverage|focused|depth|repair|mastery|exam",
  "working_style": "concept|full",
  "answer_format": "mcq|mixed",
  "difficulty": "Easy|Medium|Difficult|Adaptive",
  "feedback": "immediate|end",
  "timing": "off|record|ai",
  "show_timer": false,
  "questions": []
}

Question fields may include:
id, type, numeric_mode, prompt, choices, answer, accepted_answers,
answer_regex, tolerance, explanation, why_wrong, tags, prerequisites,
difficulty, paper_required, calculator_required, stimulus, model_answer,
rubric, time_limit_seconds.

The Base calculator is always available in the quiz UI. calculator_required is metadata only.

## Delivery

Normal valid JSON is the default.

For large packets, DBD Base also accepts **DBD Compact v1** text transport if you have actual code/compression tooling. It is intended for packet transport, not as the normal Vault workflow.

Exact compact format:
1. serialize the complete packet as minified UTF-8 JSON;
2. SHA-256 those original JSON bytes;
3. GZIP-compress those same bytes losslessly;
4. Base64URL-encode the compressed bytes without "=" padding;
5. return:
DBDC1.GZ.<64-character-sha256-hex>.<base64url-payload>

Never imitate/fabricate compressed text. If exact compression tooling is unavailable, use ordinary JSON or attach a .json file.

Do not output Question Banks, scheduler weights, autonomous mastery scores, maintenance priorities, or DBD Plus scheduler architecture. This is a temporary execution packet for DBD Base.`;
}

async function copyGenerationPrompt(button){
  const ok=await copyText(generationPrompt());if(ok){const old=button.textContent;button.textContent='COPIED ✓';setTimeout(()=>button.textContent=old,1400)}else toast('Could not copy prompt.');
}

/* ---------------- View helpers ---------------- */

function navHTML(){
  const active=(name)=>ROUTE===name?'active':'';
  return `<button class="nav-btn ${active('subjects')}" onclick="route('subjects')">Subjects</button><button class="nav-btn ${active('history')}" onclick="route('history')">History</button><button class="nav-btn icon ${active('settings')}" onclick="route('settings')" aria-label="Settings">⚙</button>`;
}
function pageHead(kicker,title,copy=''){return `<div class="page-head"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1>${copy?`<p>${esc(copy)}</p>`:''}</div></div>`}

function homeView(){
  const completed=DATA.completedSessions.length,active=DATA.activeSessions.length,subjects=DATA.subjects.length;
  const ongoing=DATA.activeSessions.slice().sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
  return `<section class="home">
    <div class="hero">
      <div class="eyebrow">DBD Base 1.5</div>
      <h1>Ready to drill.</h1>
      <div class="home-actions">
        <button class="btn primary" onclick="copyGenerationPrompt(this)">COPY PROMPT</button>
        <button class="btn" onclick="route('import')">IMPORT PACKAGE</button>
      </div>
      <div class="stat-strip">
        <div class="stat"><strong>${completed}</strong><span>Completed</span></div>
        <div class="stat"><strong>${active}</strong><span>Ongoing</span></div>
        <div class="stat"><strong>${subjects}</strong><span>Subjects</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Ongoing</div>
      ${ongoing.length?ongoing.map(s=>`<button class="session-row" onclick="resumeSession('${s.id}')"><div><strong>${esc(s.packet.subject)} · ${esc(s.packet.topic)}</strong><small>${esc(s.packet.testType)} · Q${s.index+1}/${s.packet.questions.length} · ${fmtMs(s.activeMs)}</small></div><div class="score"><strong>RESUME</strong><small>SESSION</small></div></button>`).join(''):`<div class="empty">No ongoing sessions.</div>`}
    </div>
  </section>`;
}

function subjectsView(){
  if(SELECTED_SUBJECT_ID){
    const rec=DATA.subjects.find(s=>s.id===SELECTED_SUBJECT_ID);if(!rec){SELECTED_SUBJECT_ID=null;return subjectsView()}
    const x=subjectSummary(rec),recent=x.sessions.slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
    const aliases=(rec.aliases||[]).filter(a=>aliasNorm(a)!==aliasNorm(rec.name));
    return `<section>
      <button class="btn ghost small" onclick="SELECTED_SUBJECT_ID=null;render()">← SUBJECTS</button>
      <div class="hero subject-hero" style="margin-top:10px">
        <div class="eyebrow">Subject record</div>
        <h1>${esc(rec.name)}</h1>
        ${aliases.length?`<div class="aliases">${aliases.map(a=>`<span class="alias">${esc(a)}</span>`).join('')}</div>`:''}
        <div class="subject-meta">${x.sessions.length} completed drills · ${x.answered} historical answers${x.active.length?` · ${x.active.length} ongoing`:''}.</div>
        <div class="subject-actions">
          <button class="btn primary" onclick="exportSubjectHistory('${rec.id}')">DOWNLOAD SUBJECT HISTORY</button>
          <button class="btn small" onclick="renameSubject('${rec.id}')">RENAME</button>
          <button class="btn small" onclick="addAlias('${rec.id}')">ADD ALIAS</button>
          <button class="btn danger small" onclick="deleteSubject('${rec.id}')">DELETE SUBJECT</button>
        </div>
      </div>
      <div class="section"><div class="section-title">Recorded sessions</div>
        ${recent.length?recent.map(s=>`<button class="session-row" onclick="openSession('${s.id}')"><div><strong>${esc(s.topic||'Drill')}</strong><small>${esc(s.subject)} · ${esc(s.testType)} · ${humanDate(s.completedAt)}</small></div><div class="score"><strong>${s.correct}/${s.totalQuestions}</strong><small>DRILL</small></div></button>`).join(''):`<div class="empty">No completed sessions for this subject.</div>`}
      </div>
    </section>`;
  }
  return `<section>${pageHead('Canonical lanes','Subjects','Inspect, export, rename, merge, or delete subject records.')}
    <div class="actions" style="margin-bottom:14px"><button class="btn small" onclick="mergeSubjectsUI()">MERGE SUBJECTS</button></div>
    ${DATA.subjects.length?DATA.subjects.map(rec=>{const x=subjectSummary(rec),aliases=(rec.aliases||[]).filter(a=>aliasNorm(a)!==aliasNorm(rec.name));return `<button class="subject-row" onclick="SELECTED_SUBJECT_ID='${rec.id}';render()"><div><strong>${esc(rec.name)}</strong><small>${x.sessions.length} completed drills · ${x.answered} answers${aliases.length?` · ${aliases.length} aliases`:''}</small></div><div class="score"><strong>${x.sessions.length}</strong><small>DRILLS</small></div></button>`}).join(''):`<div class="empty">No subjects yet. Import your first packet from Home.</div>`}
  </section>`;
}

function historyView(){
  const sessions=DATA.completedSessions.slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  let last='',rows='';
  for(const s of sessions){
    const label=dateGroupLabel(s.completedAt);if(label!==last){rows+=`<div class="date-label">${esc(label)}</div>`;last=label}
    const open=HISTORY_MENU_ID===s.id;
    rows+=`<div class="card history-card" style="margin-bottom:10px;overflow:hidden"><div class="history-row" role="button" tabindex="0" style="margin:0;border:0;border-radius:0" onclick="openSession('${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSession('${s.id}')}"><div><strong>${esc(s.subject)} · ${esc(s.topic||'Drill')}</strong><small>${esc(s.testType)} · ${fmtMs(s.activeMs)}</small></div><div class="history-right"><div class="score"><strong>${s.correct}/${s.totalQuestions}</strong><small>DRILL</small></div><button class="more-btn" onclick="event.stopPropagation();toggleHistoryMenu('${s.id}')" aria-label="Session actions"><span aria-hidden="true">⋯</span></button></div></div>${open?`<div class="more-menu"><button class="btn small" onclick="openSession('${s.id}')">OPEN</button><button class="btn small" onclick="exportSession('${s.id}')">EXPORT JSON</button><button class="btn danger small" onclick="deleteSession('${s.id}')">DELETE</button></div>`:''}</div>`;
  }
  return `<section>${pageHead('Recorded work','History','Only inspectable completed sessions appear here. Legacy scheduler telemetry lives in the Legacy Archive.')}${rows||'<div class="empty">No completed drills yet.</div>'}</section>`;
}
function toggleHistoryMenu(id){HISTORY_MENU_ID=HISTORY_MENU_ID===id?null:id;render()}
function openSession(id){SELECTED_SESSION_ID=id;route('session')}

function settingsView(){
  const lc=legacyCounts(),size=bytesLabel(new Blob([JSON.stringify(DATA)]).size);
  return `<section>${pageHead('DBD Base 1.5','Settings')}
    <div class="settings-shell">
      <div class="settings-card"><h2>Appearance</h2><div class="segmented"><button class="${DATA.settings.appearance==='dark'?'active':''}" onclick="setTheme('dark')">DARK</button><button class="${DATA.settings.appearance==='light'?'active':''}" onclick="setTheme('light')">LIGHT</button></div></div>

      <div class="settings-card"><h2>Data</h2><div class="metric-list"><div class="metric"><span>Local data</span><strong>${size}</strong></div><div class="metric"><span>Subjects</span><strong>${DATA.subjects.length}</strong></div><div class="metric"><span>Completed sessions</span><strong>${DATA.completedSessions.length}</strong></div><div class="metric"><span>Ongoing sessions</span><strong>${DATA.activeSessions.length}</strong></div></div><div class="actions"><button class="btn primary" onclick="exportVault()">EXPORT VAULT</button><button class="btn" onclick="mergeVault()">MERGE VAULT</button></div></div>

      <details class="fold"><summary>Legacy archive</summary><div class="fold-body"><p style="margin-top:0">Old DBD Plus data is preserved for compatibility but does not appear in normal History or normal Base drill counts.</p><div class="metric-list"><div class="metric"><span>Question Bank records</span><strong>${lc.bank}</strong></div><div class="metric"><span>Stream attempts</span><strong>${lc.stream}</strong></div><div class="metric"><span>Legacy manifests</span><strong>${lc.manifests}</strong></div></div><div class="actions"><button class="btn small" onclick="exportLegacyArchive()">EXPORT LEGACY ARCHIVE</button></div></div></details>

      <div class="settings-card"><h2>Links</h2><div class="link-grid"><a class="external-link" href="https://gazalied.github.io/" target="_blank" rel="noopener"><span>Gazali's website</span><span>↗</span></a><a class="external-link" href="https://github.com/gazalied/dbdbase" target="_blank" rel="noopener"><span>View this on GitHub</span><span>↗</span></a></div></div>

      <details class="fold"><summary>Technical details</summary><div class="fold-body"><div class="metric-list"><div class="metric"><span>Product</span><strong>DBD Base ${APP_VERSION}</strong></div><div class="metric"><span>Build</span><strong>${BUILD_ID}</strong></div><div class="metric"><span>Vault format</span><strong>DBD Base Vault v1</strong></div><div class="metric"><span>Packet format</span><strong>DBD Base Packet v1</strong></div><div class="metric"><span>Compact transport</span><strong>DBD Compact v1 · packets</strong></div><div class="metric"><span>Storage key</span><strong>${STORAGE_KEY}</strong></div></div><div class="actions"><button class="btn small" onclick="replaceVault()">RESTORE BACKUP</button></div></div></details>

      <details class="fold"><summary>Danger zone</summary><div class="fold-body"><p style="margin-top:0">Reset deletes local Base data. Export a Vault first if you want a backup.</p><button class="btn danger" onclick="resetAll()">RESET ALL LOCAL DATA</button></div></details>
    </div>
  </section>`;
}

function importView(){
  return `<section>${pageHead('Packet in','Import package','Choose a file, paste normal JSON, or paste a DBD Compact packet. Compact transport is for packets—not the normal Vault workflow.')}
    ${IMPORT_ERROR?`<div class="feedback wrong"><div class="feedback-head">IMPORT ERROR</div><p>${esc(IMPORT_ERROR)}</p></div>`:''}
    <div class="dropzone" id="dropzone" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="packetDropped(event)">
      <strong>SELECT PACKAGE FILE</strong><p>JSON or DBD Compact text. Everything is read locally.</p><input id="packet-file" type="file" accept=".json,.txt,.dbdc,.dbd,application/json,text/plain" hidden onchange="packetFileChanged(this)"><button class="btn primary" onclick="choosePacketFile()">CHOOSE FILE</button>
    </div>
    <div class="paste-grid">
      <details class="fold"><summary>Paste JSON instead</summary><div class="fold-body"><textarea id="packet-input" class="code-input" placeholder="Paste ordinary DBD Base JSON here."></textarea><button class="btn primary block" style="margin-top:9px" onclick="readJSONFromTextarea()">REVIEW PACKET</button></div></details>
      <details class="fold"><summary>Paste compressed JSON instead</summary><div class="fold-body"><textarea id="compact-packet-input" class="code-input" placeholder="Paste DBDC1.GZ.… here."></textarea><button class="btn primary block" style="margin-top:9px" onclick="readCompactFromTextarea()">DECOMPRESS & REVIEW</button></div></details>
    </div><div class="actions"><button class="btn ghost" onclick="route('home')">CANCEL</button></div>
  </section>${DATA.pendingPacket?preflightHTML():''}`;
}
async function packetDropped(event){event.preventDefault();document.getElementById('dropzone')?.classList.remove('drag');const f=event.dataTransfer?.files?.[0];if(!f)return;const fake={files:[f]};await packetFileChanged(fake)}

function preflightHTML(){
  const pp=DATA.pendingPacket;if(!pp)return'';const p=pp.packet,v=pp.validation||validatePacket(p);pp.validation=v;
  return `<div class="preflight-backdrop"><div class="preflight"><div class="eyebrow">Mission briefing</div><h1>READY TO<br>LAUNCH</h1><div class="manifest"><div class="item"><span>Subject</span><strong>${esc(p.subject)}</strong></div><div class="item"><span>Topic</span><strong>${esc(p.topic)}</strong></div><div class="item"><span>Questions</span><strong>${p.questions.length}</strong></div><div class="item"><span>Composition</span><strong>${v.mcq} MCQ · ${v.multi} multi · ${v.typed} typed</strong></div></div>
    <details class="fold launch-settings" open><summary>Launch settings</summary><div class="fold-body"><div class="launch-grid"><div class="field"><label>Feedback</label><select onchange="updatePendingFeedback(this.value)"><option value="immediate" ${p.feedback==='immediate'?'selected':''}>Immediate</option><option value="end" ${p.feedback==='end'?'selected':''}>After session</option></select></div><div class="field"><label>Show timer</label><div class="switch-line"><span>${p.showTimer?'Shown':'Hidden'}</span><input type="checkbox" ${p.showTimer?'checked':''} onchange="updatePendingTimer(this.checked)"></div></div></div><div class="field" style="margin-top:10px"><label>Additional focus for the next generation request</label><textarea oninput="updateNextFocus(this.value)" placeholder="Optional — this does not rewrite the current packet.">${esc(DATA.settings.nextGenerationFocus||'')}</textarea></div></div></details>
    ${v.errors.length?`<div class="validation"><strong class="error">Blocking errors</strong><ul>${v.errors.map(x=>`<li class="error">${esc(x)}</li>`).join('')}</ul></div>`:''}
    <details class="fold validation"><summary>Validation details</summary><div class="fold-body"><ul>${v.warnings.length?v.warnings.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>No structural warnings.</li>'}<li>Base checks packet structure, not subject-semantic truth. Subject Chat remains responsible for balance, constructibility, units, signs, and curriculum validity.</li></ul></div></details>
    <div class="actions"><button class="btn primary" ${v.errors.length?'disabled':''} onclick="launchPending()">START DRILL</button><button class="btn" onclick="cancelPending()">CANCEL</button></div></div></div>`;
}

/* ---------------- Drill renderer ---------------- */

function skipNoticeHTML(){
  const n=UI.skipNotice;if(!n)return'';
  return `<div class="skip-toast"><div class="skip-toast-row"><strong>Previous question skipped.</strong><button class="chip" onclick="UI.skipNotice=null;render()">DISMISS</button></div><div class="skip-reasons"><button class="chip" onclick="setSkipReason('did-not-know')">DON'T KNOW</button><button class="chip" onclick="setSkipReason('time')">TIME</button><button class="chip" onclick="setSkipReason('deliberate')">DELIBERATE</button><button class="chip" onclick="setSkipReason('question-issue')">QUESTION ISSUE</button></div></div>`;
}
function choiceClass(q,r,key){
  const selected=q.type==='multi_select'?(r.selected||[]).includes(key):String(r.selected||'').toUpperCase()===key;
  if(!r.locked)return selected?'selected':'';
  if(currentSession()?.packet.feedback==='end')return selected?'selected':'';
  const correct=q.type==='multi_select'?(q.answer||[]).includes(key):String(q.answer||'').toUpperCase()===key;
  if(correct)return 'correct';if(selected)return 'wrong';return'';
}
function renderChoices(q,r){
  const entries=Object.entries(q.choices||{});
  if(q.type==='multi_select'){
    return `<div class="choices">${entries.map(([k,v])=>`<label class="choice ${choiceClass(q,r,k)}"><input type="checkbox" ${Array.isArray(r.selected)&&r.selected.includes(k)?'checked':''} ${r.locked?'disabled':''} onchange="toggleMulti('${k}')"><span class="choice-text"><strong class="choice-key">${esc(k)}.</strong> ${esc(stripChoicePrefix(k,v))}</span>${r.locked&&currentSession().packet.feedback==='immediate'?(q.answer.includes(k)?'<span class="choice-status">CORRECT</span>':''):''}</label>`).join('')}</div>${r.locked?`<div class="submitted-answer"><div class="value">${esc((r.selected||[]).join(', ')||'—')}</div><button class="next" onclick="goNext()">NEXT →</button></div>`:`<div class="split-submit"><button class="btn primary" onclick="submitMulti()">SUBMIT ANSWER</button><button class="btn" onclick="skipCurrent()">SKIP</button></div>`}`;
  }
  return `<div class="choices">${entries.map(([k,v])=>{const selected=String(r.selected||'').toUpperCase()===k;let status='';if(r.locked&&selected)status='NEXT →';else if(r.locked&&currentSession().packet.feedback==='immediate'&&String(q.answer).toUpperCase()===k)status='CORRECT';return `<button class="choice ${choiceClass(q,r,k)}" onclick="${r.locked&&selected?'goNext()':`chooseMCQ('${k}')`}" ${r.locked&&!selected?'disabled':''}><span class="choice-key">${esc(k)}.</span><span class="choice-text">${esc(stripChoicePrefix(k,v))}</span><span class="choice-status">${status}</span></button>`}).join('')}</div>`;
}
function typedAnswerSurface(q,r){
  if(r.locked){
    return `<div class="submitted-answer"><div class="value">${esc(r.selected??r.draft??'—')}</div><button class="next" onclick="goNext()">NEXT →</button></div>`;
  }
  const inputmode=q.type==='numeric'?'decimal':'text';
  return `<label class="answer-label">Your final answer</label>${q.type==='essay'?`<textarea id="typed-answer" class="essay-input" oninput="setDraft(this.value)" placeholder="Write your answer here.">${esc(r.draft)}</textarea><div class="split-submit"><button class="btn primary" onclick="revealEssay()">CHECK / REVEAL</button><button class="btn" onclick="skipCurrent()">SKIP</button></div>`:`<input id="typed-answer" class="answer-input" inputmode="${inputmode}" value="${esc(r.draft)}" oninput="setDraft(this.value)" placeholder="${q.type==='numeric'?'Type a number':'Type your answer'}"><div class="split-submit"><button class="btn primary" onclick="submitTyped()">SUBMIT ANSWER</button><button class="btn" onclick="skipCurrent()">SKIP</button></div>`}`;
}
function feedbackHTML(q,r){
  const s=currentSession();if(!r.locked||s.packet.feedback==='end')return'';
  if(q.type==='essay'){
    return `<div class="feedback"><div class="feedback-head">MODEL / REFERENCE</div><p>${esc(q.modelAnswer||'No model answer supplied.')}</p>${q.rubric.length?`<p style="margin-top:8px"><strong>Rubric:</strong> ${esc(q.rubric.join(' · '))}</p>`:''}</div>${r.selfAssessment?`<div class="feedback ${r.correct?'correct':'wrong'}"><div class="feedback-head">${r.correct?'SELF-CHECK: MATCHED':'SELF-CHECK: NEEDS REPAIR'}</div></div>`:`<div class="actions"><button class="btn primary" onclick="selfAssess('yes')">MY ANSWER MATCHES</button><button class="btn" onclick="selfAssess('no')">NEEDS REPAIR</button></div>`}`;
  }
  const good=r.correct===true;
  const why=!good&&q.type==='mcq'&&q.whyWrong?.[String(r.selected||'').toUpperCase()]?q.whyWrong[String(r.selected).toUpperCase()]:q.explanation;
  return `<div class="feedback ${good?'correct':'wrong'}"><div class="feedback-head">${good?'CORRECT':'WRONG'}</div><p>${esc(why||q.explanation||'No explanation supplied.')}</p></div>`;
}
function causeHTML(q,r){
  const s=currentSession();if(!r.locked||r.correct||q.type==='essay'||s.packet.feedback==='end')return'';
  const options=[['forgot','Forgot / didn’t know'],['wrong-method','Wrong method'],['careless','Careless / arithmetic'],['prerequisite','Prerequisite missing'],['question-issue','Question issue']];
  return `<div class="cause-wrap"><div class="cause-title">What happened? <span style="font-weight:500;text-transform:none">optional</span></div><div class="chips">${options.map(([id,l])=>`<button class="chip ${r.errorCause===id?'active':''}" onclick="setErrorCause('${id}')">${esc(l)}</button>`).join('')}</div></div>`;
}
function confidenceHTML(r){
  const map=[['sure','Sure'],['unsure','Not sure'],['guess','Ngasal']];
  return `<div class="confidence">${map.map(([id,l])=>`<button class="${r.confidence===id?'active':''}" onclick="setConfidence('${id}')">${l}</button>`).join('')}</div>`;
}
function calculatorHTML(){
  if(!UI.calcOpen)return'';const preview=calcEval();
  const keys=['AC','⌫','(',')','7','8','9','÷','4','5','6','×','1','2','3','−','0','.','%','+'];
  return `<div class="calculator"><div class="calc-display"><input id="calc-expression" class="calc-expression" value="${esc(UI.calcExpression)}" oninput="calcTyped(this)" spellcheck="false" autocomplete="off" aria-label="Calculator expression"><div class="calc-preview">${preview===null?'':'= '+esc(String(preview))}</div></div><div class="calc-edit"><button class="btn" onclick="calcMove(-1)">←</button><button class="btn" onclick="calcMove(1)">→</button></div><div class="calc-grid">${keys.map(k=>`<button class="calc-key" onclick="${k==='AC'?'calcClear()':k==='⌫'?'calcBackspace()':`calcInsert('${k}')`}">${k}</button>`).join('')}<button class="calc-key equals" style="grid-column:span 4" onclick="calcEquals()">=</button></div><button class="btn primary use-answer" onclick="calcUseAnswer()">USE ANSWER</button></div>`;
}
function controlsHTML(r){
  return `<div class="control-rail">${confidenceHTML(r)}<span class="rail-divider"></span><button class="tool calc ${UI.calcOpen?'active':''}" onclick="toggleCalculator()" aria-label="Calculator">🧮</button><button class="tool comment ${UI.commentOpen?'active':''}" onclick="toggleComment()" aria-label="Comment">💬</button><button class="tool flag ${r.flagged?'active':''}" onclick="toggleFlag()" aria-label="Flag">⚑</button></div>${UI.commentOpen?`<div class="comment-box"><textarea id="comment-box" oninput="updateComment(this.value)" placeholder="Comment for the Subject Chat…">${esc(r.comment)}</textarea></div>`:''}${calculatorHTML()}`;
}
function drillView(){
  const s=currentSession();if(!s)return `<div class="empty">No active session.</div>`;
  if(s.review)return reviewBeforeSubmit(s);
  const q=currentQuestion(),r=currentResponse();if(!q||!r)return `<div class="empty">Question unavailable.</div>`;
  const settled=s.responses.filter(x=>x.status!=='unseen').length,left=unresolvedIndices(s).length,progress=Math.round(settled/s.packet.questions.length*100);
  const timerText=q.timeLimitSeconds>0?`${fmtMs(r.elapsedMs)} / ${Math.floor(q.timeLimitSeconds/60)}:${String(q.timeLimitSeconds%60).padStart(2,'0')}`:fmtMs(r.elapsedMs);
  return `<section class="drill-shell"><div class="progress-row"><div class="progress-card"><div class="progress-meta"><span>Q${s.index+1} / ${s.packet.questions.length}</span><span>${left} left${s.packet.showTimer?` · <span id="question-timer">${timerText}</span>`:''}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div><button class="pause-btn" onclick="pauseSession()">Ⅱ</button></div>${skipNoticeHTML()}<div class="question-card">${stimulusHTML(q.stimulus)}<div class="prompt">${esc(q.prompt)}</div>${q.type==='mcq'||q.type==='multi_select'?renderChoices(q,r):typedAnswerSurface(q,r)}${feedbackHTML(q,r)}${causeHTML(q,r)}${controlsHTML(r)}</div>${UI.pauseOpen?pauseHTML():''}</section>`;
}
function pauseHTML(){
  return `<div class="pause-overlay"><div class="pause-card"><div class="eyebrow">Session paused</div><h1>PAUSED</h1><p>Active timer is stopped.</p><div class="actions" style="justify-content:center"><button class="btn primary" onclick="resumeFromPause()">RESUME</button><button class="btn danger" onclick="abandonSession()">END SESSION</button></div></div></div>`;
}

function reviewBeforeSubmit(s){
  const answered=s.responses.filter(r=>['answered','timeout'].includes(r.status)).length,skipped=s.responses.filter(r=>r.status==='skipped').length,unseen=s.responses.filter(r=>r.status==='unseen').length,flagged=s.responses.filter(r=>r.flagged).length;
  return `<section class="drill-shell">${skipNoticeHTML()}<div class="review-card"><div class="eyebrow">Final check</div><h1>Review before submitting.</h1><div class="review-stats"><div class="review-stat"><strong>${answered}</strong><span>Answered</span></div><div class="review-stat"><strong>${skipped}</strong><span>Skipped</span></div><div class="review-stat"><strong>${unseen}</strong><span>Unseen</span></div><div class="review-stat"><strong>${flagged}</strong><span>Flagged</span></div></div><div class="review-grid">${s.responses.map((r,i)=>`<button class="review-q ${r.status==='answered'||r.status==='timeout'?'answered':r.status==='skipped'?'skipped':''} ${r.flagged?'flagged':''}" onclick="jumpToQuestion(${i})">${i+1}</button>`).join('')}</div><div class="actions stack"><button class="btn primary" onclick="completeSession()">SUBMIT SESSION</button><button class="btn" onclick="jumpToQuestion(${Math.max(0,s.responses.findIndex(r=>r.status==='skipped'))})" ${skipped?'':'disabled'}>RETURN TO SKIPPED</button></div></div></section>`;
}

function resultChoiceHTML(a){
  if(!a.choices)return'';const answers=Array.isArray(a.answer)?a.answer.map(x=>String(x).toUpperCase()):[String(a.answer||'').toUpperCase()],selected=Array.isArray(a.selected)?a.selected.map(x=>String(x).toUpperCase()):[String(a.selected||'').toUpperCase()];
  return `<div class="audit-choices">${Object.entries(a.choices).map(([k,v])=>{const correct=answers.includes(k),sel=selected.includes(k);const label=correct&&sel?'CORRECT · YOUR ANSWER':correct?'CORRECT':sel?'YOUR ANSWER':'';return `<div class="audit-choice ${correct?'correct':''} ${sel&&!correct?'selected-wrong':''}"><span><strong>${esc(k)}.</strong> ${esc(stripChoicePrefix(k,v))}</span>${label?`<span class="audit-status ${correct?'good':'bad'}">${label}</span>`:''}</div>`}).join('')}</div>`;
}
function sessionView(){
  const s=DATA.completedSessions.find(x=>x.id===SELECTED_SESSION_ID);if(!s)return `<section>${pageHead('History','Session not found')}<button class="btn" onclick="route('history')">BACK</button></section>`;
  return `<section><button class="btn ghost small" onclick="route('history')">← HISTORY</button><div class="results-hero" style="margin-top:10px"><div class="eyebrow">${esc(s.subject)} · ${esc(s.topic)}</div><div class="results-score">${s.correct}<span> / ${s.totalQuestions}</span></div><div class="results-message">${Math.round(s.accuracy||0)}% raw accuracy · ${fmtMs(s.activeMs)} active time<br><strong>Score is evidence, not diagnosis.</strong></div><div class="result-summary-grid"><div class="result-card"><strong>${s.unanswered||0}</strong><span>Skipped</span></div><div class="result-card"><strong>${s.attempts.filter(a=>a.confidence==='sure').length}</strong><span>Sure</span></div><div class="result-card"><strong>${s.attempts.filter(a=>a.calculator?.used).length}</strong><span>Calc used</span></div></div><div class="actions" style="justify-content:center"><button class="btn primary" onclick="copyResults('${s.id}',this)">COPY RESULTS</button><button class="btn" onclick="exportSession('${s.id}')">EXPORT JSON</button></div></div><div class="section"><div class="section-title">Question review</div>${s.attempts.map((a,i)=>`<details class="review-item"><summary><div><div class="mini-prompt">Q${i+1} · ${esc(a.prompt)}</div><small style="color:var(--muted)">${esc(a.tags?.join(' · ')||'No tags')}</small></div><span class="${a.correct?'status-good':'status-bad'}">${a.correct?'✓':'✕'}</span></summary><div class="review-body">${stimulusHTML(a.stimulus)}${resultChoiceHTML(a)}<div class="audit-line"><strong>Your answer:</strong> ${esc(Array.isArray(a.selected)?a.selected.join(', '):(a.selected??'—'))}</div><div class="audit-line"><strong>Correct / reference:</strong> ${esc(Array.isArray(a.answer)?a.answer.join(', '):(a.answer??a.modelAnswer??'—'))}</div><div class="audit-line"><strong>Confidence:</strong> ${esc(a.confidence||'—')} · <strong>Time:</strong> ${fmtMs(a.elapsedMs)}</div><div class="audit-line"><strong>Error cause:</strong> ${esc(a.errorCause||'—')} · <strong>Skip reason:</strong> ${esc(a.skipReason||'—')}</div><div class="audit-line"><strong>Prerequisites:</strong> ${esc(a.prerequisites?.join(', ')||'—')}</div><div class="audit-line"><strong>Comment:</strong> ${esc(a.comment||'—')} · <strong>Flagged:</strong> ${a.flagged?'Yes':'No'}</div>${a.calculator?.used?`<div class="audit-line"><strong>Calculator history:</strong>${a.calculator.history?.length?`<ol>${a.calculator.history.map(h=>`<li>${esc(h.expression)} = ${esc(h.result)}</li>`).join('')}</ol>`:' —'}</div>`:''}<div class="audit-line"><strong>Explanation:</strong> ${esc(a.explanation||a.modelAnswer||'—')}</div></div></details>`).join('')}</div></section>`;
}


/* ---------------- Shell / router / boot ---------------- */

function route(name){
  const allowed=new Set(['home','subjects','history','settings','import','drill','session']);
  const next=allowed.has(name)?name:'home';
  if(ROUTE==='drill'&&next!=='drill'){accrueNow();stopTimer();save();}
  ROUTE=next;
  if(next!=='subjects')SELECTED_SUBJECT_ID=null;
  if(next!=='history')HISTORY_MENU_ID=null;
  if(next!=='drill'){UI.pauseOpen=false;UI.commentOpen=false;UI.calcOpen=false;}
  render();
  if(next==='drill'){startTimer();}
  requestAnimationFrame(()=>{document.getElementById('app')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});});
}

function render(){
  const nav=document.getElementById('navigation');
  const app=document.getElementById('app');
  if(!nav||!app||!DATA)return;
  nav.innerHTML=ROUTE==='drill'?'':navHTML();
  const views={
    home:homeView,
    subjects:subjectsView,
    history:historyView,
    settings:settingsView,
    import:importView,
    drill:drillView,
    session:sessionView
  };
  const view=views[ROUTE]||homeView;
  app.innerHTML=view();
  applyTheme();
  if(ROUTE==='drill'&&UI.calcOpen)restoreCalcCursor();
}

function boot(){
  DATA=load();
  /* First 1.5 boot migrates legacy/unversioned/Schema 2–7 data into
     the canonical DBD Base Vault v1 model, then persists that model. */
  save();
  applyTheme();
  render();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  console.info(`DBD Base ${APP_VERSION} · ${BUILD_ID} · DBD Base Vault v${VAULT_FORMAT_VERSION}`);
}

window.addEventListener('beforeunload',()=>{stopTimer();save()});
boot();
