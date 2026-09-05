const APP_VERSION='DBD Base v1.0';
const BUILD_ID='base-1.0-renderer';
const STORAGE_KEY='dbd_gazali';
const LARGE_PACKET_THRESHOLD=15;
const SUBJECTS=[
  {id:'chemistry',campaign:'School',name:'Kimia'},
  {id:'physics',campaign:'School',name:'Fisika'},
  {id:'matwa',campaign:'School',name:'Matematika Wajib'},
  {id:'matlan',campaign:'School',name:'Matematika Tingkat Lanjut'},
  {id:'indonesian',campaign:'School',name:'Bahasa Indonesia'},
  {id:'sat-math',campaign:'SAT',name:'SAT Math'},
  {id:'sat-rw',campaign:'SAT',name:'SAT Reading & Writing'},
  {id:'osn-geography',campaign:'OSN Geografi',name:'OSN Geografi'},
  {id:'other-school',campaign:'School',name:'Other School Subject'},
  {id:'custom',campaign:'Custom',name:'Custom'}
];
const TEST_TYPES=[
  {id:'coverage',label:'Coverage Scan',description:'Broadly expose what you know, what is shaky, and what is missing.',defaults:{answerFormat:'mcq',workingStyle:'concept',difficulty:'Adaptive',feedback:'immediate',timing:'off'}},
  {id:'focused',label:'Focused Drill',description:'Repeat one narrow skill or procedure using varied questions.',defaults:{answerFormat:'mixed',workingStyle:'full',difficulty:'Medium',feedback:'immediate',timing:'record'}},
  {id:'deep',label:'Deep Practice',description:'Reason, calculate, interpret, and transfer—not just recognize.',defaults:{answerFormat:'mixed',workingStyle:'full',difficulty:'Difficult',feedback:'end',timing:'record'}},
  {id:'repair',label:'Repair Drill',description:'Test old weaknesses using fresh variants and precise feedback.',defaults:{answerFormat:'mixed',workingStyle:'concept',difficulty:'Adaptive',feedback:'immediate',timing:'off'}},
  {id:'mastery',label:'Mastery Check',description:'Perform independently after learning, without answer leakage.',defaults:{answerFormat:'mixed',workingStyle:'full',difficulty:'Adaptive',feedback:'end',timing:'record'}},
  {id:'exam',label:'Exam Simulation',description:'Perform under exam-like structure, pacing, and delayed results.',defaults:{answerFormat:'mixed',workingStyle:'full',difficulty:'Adaptive',feedback:'end',timing:'ai'}}
];
const WORKING_STYLES=[['concept','No pen or paper'],['full','Full problem solving']];
const ANSWER_FORMATS=[['mcq','Multiple choice only'],['mixed','Mixed']];
const DIFFICULTIES=['Easy','Medium','Difficult','Adaptive'];
const COUNT_PRESETS=[5,10,20];
const FEEDBACKS=[['immediate','Immediate'],['end','After session']];
const TIMINGS=[['off','Off'],['record','Record only'],['ai','AI-set limits']];
const CONFIDENCES=[['sure','Sure'],['unsure','Not sure'],['guess','Ngasal']];
const ERROR_TYPES=[['concept','Did not know'],['formula','Forgot rule/formula'],['method','Wrong method'],['execution','Execution/calculation'],['misread','Misread'],['careless','Careless/rushed'],['guess','Guessed'],['focus','Lost focus'],['timeout','Timed out'],['bad-question','Bad question'],['unclassified','Unclassified']];

const DATA_SCHEMA_VERSION=7;
const DATA_SCHEMA_LABEL='Schema 7 Base';
function makeUid(prefix='id'){try{return `${prefix}_${crypto.randomUUID()}`}catch(e){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`}}
function streamIdFromName(name){return String(name||'custom').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'custom'}
function defaultStream(name,campaign='Custom'){return{id:streamIdFromName(name),name:String(name||'Custom'),campaign:String(campaign||'Custom'),active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}

function emptyData(){return{
  appVersion:APP_VERSION,
  schemaVersion:DATA_SCHEMA_VERSION,
  profile:{name:'Gazali Darmawan',grade:'Grade 11',className:'Science 2'},
  setup:{subjectId:'matlan',testType:'coverage',workingStyle:'concept',answerFormat:'mcq',count:5,difficulty:'Adaptive',feedback:'immediate',timing:'off',showTimer:true,focus:''},
  statistics:{answered:0,correct:0,wrong:0},
  completedSessions:[],activeSessions:[],currentActiveId:null,pendingPacket:null,dailyState:{},
  streams:[],questionBank:[],conceptEvidence:{},streamPrototype:{attempts:[],seen:{}},
  vault:{lastMergedAt:null,lastExportedAt:null},
  settings:{persistentStorageGranted:false,deviceId:makeUid('device')}
}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ')}
function fmt(seconds){if(seconds===null||seconds===undefined||!Number.isFinite(Number(seconds)))return'—';const n=Math.max(0,Math.round(Number(seconds))),m=Math.floor(n/60),s=String(n%60).padStart(2,'0');return `${m}:${s}`}
function label(list,id){return list.find(x=>x[0]===id)?.[1]||id||'—'}
function testType(id){return TEST_TYPES.find(x=>x.id===id)||TEST_TYPES[0]}
function subject(id=DATA.setup.subjectId){return SUBJECTS.find(x=>x.id===id)||SUBJECTS[0]}
function errorLabel(id){return ERROR_TYPES.find(x=>x[0]===id)?.[1]||id||'—'}
function localDay(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function deriveLegacyTestType(s){if(s?.testType)return s.testType;if(s?.target==='mistakes')return'repair';if(s?.scope==='broad'&&s?.task==='check')return'coverage';if(s?.scope==='focused'&&s?.task==='apply')return'deep';if(s?.scope==='focused')return'focused';return'mastery'}
function migrateSetup(s){const d=emptyData().setup;if(!s)return{...d};const out={...d,...s};out.testType=deriveLegacyTestType(s);if(out.answerFormat==='typed')out.answerFormat='mixed';if(!['mcq','mixed'].includes(out.answerFormat))out.answerFormat='mixed';if(!out.workingStyle)out.workingStyle='full';if(![5,10,20].includes(Number(out.count)))out.count=Math.max(1,Math.min(100,Number(out.count)||5));return out}
function newResponse(){return{answer:null,draft:'',status:'unseen',confidence:'sure',flagged:false,elapsed:0,locked:false,revealed:false,correct:null,errorType:null,note:'',comment:'',timedOut:false,selfAssessment:null}}

function ensurePacketIdentity(packet){if(!packet)return packet;packet.packetUid=packet.packetUid||makeUid('packet');packet.stream=packet.stream&&typeof packet.stream==='object'?{id:String(packet.stream.id||streamIdFromName(packet.stream.name||packet.subject)),name:String(packet.stream.name||packet.subject||'Custom')}:{id:streamIdFromName(packet.subject),name:String(packet.subject||'Custom')};packet.questions=(packet.questions||[]).map((q,i)=>({...q,uid:q.uid||`${packet.packetUid}:${q.id||i+1}`}));return packet}
function collectStreams(data){const map=new Map();const add=(name,campaign='Custom',candidate=null)=>{if(!name)return;const id=String(candidate?.id||streamIdFromName(name));const prev=map.get(id);map.set(id,{...(prev||defaultStream(name,campaign)),...(candidate||{}),id,name:String(candidate?.name||name),campaign:String(candidate?.campaign||campaign||prev?.campaign||'Custom'),active:candidate?.active!==false,updatedAt:new Date().toISOString()})};(data.streams||[]).forEach(x=>add(x.name,x.campaign,x));(data.completedSessions||[]).forEach(x=>add(x.subject,x.campaign,x.stream));(data.activeSessions||[]).forEach(x=>add(x.packet?.subject,x.packet?.campaign,x.packet?.stream));if(data.pendingPacket?.packet)add(data.pendingPacket.packet.subject,data.pendingPacket.packet.campaign,data.pendingPacket.packet.stream);return [...map.values()]}
function rebuildConceptEvidence(data){const out={};for(const session of data.completedSessions||[]){const streamId=session.stream?.id||streamIdFromName(session.subject);for(const a of session.attempts||[]){for(const rawTag of a.tags||[]){const tag=String(rawTag).trim();if(!tag)continue;const key=`${streamId}::${tag.toLowerCase()}`;const e=out[key]||(out[key]={streamId,streamName:session.stream?.name||session.subject,tag,seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,lastSeenAt:null});e.seen++;if(a.correct)e.correct++;else if(!['skipped','unseen'].includes(a.status))e.wrong++;if(a.correct&&a.confidence==='sure')e.secureCorrect++;if(a.confidence==='unsure')e.unsure++;if(a.confidence==='guess')e.guess++;if(a.status==='dontknow')e.dontKnow++;if(a.status==='skipped')e.skipped++;e.lastSeenAt=session.completedAt||e.lastSeenAt}}}return out}
function normalizeFutureData(data){data.schemaVersion=DATA_SCHEMA_VERSION;data.settings={persistentStorageGranted:false,deviceId:makeUid('device'),...(data.settings||{})};if(!data.settings.deviceId)data.settings.deviceId=makeUid('device');data.vault={lastMergedAt:null,lastExportedAt:null,...(data.vault||{})};data.completedSessions=(data.completedSessions||[]).map(s=>({...s,id:s.id||makeUid('session'),stream:s.stream||{id:streamIdFromName(s.subject),name:String(s.subject||'Custom')}}));data.activeSessions=(data.activeSessions||[]).map(a=>({...a,id:a.id||makeUid('session'),packet:ensurePacketIdentity(a.packet)}));if(data.pendingPacket?.packet)data.pendingPacket.packet=ensurePacketIdentity(data.pendingPacket.packet);data.questionBank=Array.isArray(data.questionBank)?data.questionBank:[];data.streamPrototype=data.streamPrototype&&typeof data.streamPrototype==='object'?data.streamPrototype:{attempts:[],seen:{}};data.streamPrototype.attempts=Array.isArray(data.streamPrototype.attempts)?data.streamPrototype.attempts:[];data.streamPrototype.seen=data.streamPrototype.seen&&typeof data.streamPrototype.seen==='object'?data.streamPrototype.seen:{};data.streams=collectStreams(data);data.conceptEvidence=rebuildConceptEvidence(data);return data}
function recomputeStatistics(data){const attempts=(data.completedSessions||[]).flatMap(s=>s.attempts||[]);const answered=attempts.filter(a=>!['skipped','unseen'].includes(a.status)).length,correct=attempts.filter(a=>a.correct).length;data.statistics={answered,correct,wrong:Math.max(0,answered-correct)};return data}

function migrateLegacyActive(a){if(!a)return null;const qs=a.packet?.questions||[],responses=qs.map(()=>newResponse());(a.attempts||[]).forEach((att,i)=>{if(!responses[i])return;responses[i]={...responses[i],answer:att.selected??null,status:att.timedOut?'timeout':'answered',confidence:'sure',elapsed:att.elapsed||0,locked:a.setupSnapshot?.feedback==='immediate',revealed:a.setupSnapshot?.feedback==='immediate',correct:!!att.correct,errorType:att.errorType||null,note:att.note||'',comment:att.comment||'',timedOut:!!att.timedOut}});const idx=Math.min(a.index||0,Math.max(0,qs.length-1));return{id:a.id||`legacy_${Date.now()}`,packet:a.packet,setupSnapshot:{...migrateSetup(a.setupSnapshot),feedback:a.setupSnapshot?.feedback||'immediate',timing:a.setupSnapshot?.timing||'off'},responses,currentIndex:idx,startedAt:a.startedAt||Date.now(),lastOpenedAt:Date.now(),liveStartedAt:null,paused:false,retryKind:a.retryKind||null}}
function loadData(){try{const d=emptyData(),s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');let active=Array.isArray(s.activeSessions)?s.activeSessions:[];if(!active.length&&s.activeSession){const converted=migrateLegacyActive(s.activeSession);if(converted)active=[converted]}active=active.map(a=>({liveStartedAt:null,paused:false,...a,responses:(Array.isArray(a.responses)?a.responses:(a.packet?.questions||[]).map(()=>newResponse())).map(r=>({comment:'',selfAssessment:null,...r}))}));return normalizeFutureData({...d,...s,appVersion:APP_VERSION,profile:d.profile,setup:migrateSetup(s.setup),statistics:{...d.statistics,...(s.statistics||{})},completedSessions:Array.isArray(s.completedSessions)?s.completedSessions:[],activeSessions:active,currentActiveId:active.some(a=>a.id===s.currentActiveId)?s.currentActiveId:(active[0]?.id||null),pendingPacket:s.pendingPacket||null,dailyState:s.dailyState||{},streams:Array.isArray(s.streams)?s.streams:[],questionBank:Array.isArray(s.questionBank)?s.questionBank:[],conceptEvidence:s.conceptEvidence||{},streamPrototype:s.streamPrototype||{attempts:[],seen:{}},vault:s.vault||{},settings:{...d.settings,...(s.settings||{})}})}catch(e){console.error(e);return emptyData()}}
let DATA=loadData(),view='home',currentSessionId=null,importError='',timerInterval=null,navigatorOpen=false,customizationOpen=false,commentOpenKey=null,historySubjectFilter='all',historySort='newest',streamFeedback=null,selectedSubjectId=null,subjectDetailMode='overview',organizeSubjectsOpen=false,subjectMergeSelection=new Set(),streamDismissed=false;
function save(){DATA.appVersion=APP_VERSION;normalizeFutureData(DATA);localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA))}
function active(){return DATA.activeSessions.find(x=>x.id===DATA.currentActiveId)||null}
function route(v){accrueTime();stopTimer();view=v;navigatorOpen=false;commentOpenKey=null;if(v!=='home')customizationOpen=false;render();window.scrollTo({top:0,behavior:'smooth'})}

function homeFromLogo(){if(view==='drill')return;route('home')}
function renderNav(){const nav=document.getElementById('navigation');if(view==='drill'){nav.innerHTML='';return}const items=[['subjects','Subjects'],['history','History'],['data','Data']];nav.innerHTML=items.map(([id,l])=>`<button class="${view===id?'active':''}" onclick="route('${id}')">${l}</button>`).join('')}
function updateSetup(k,v){if(k==='count')v=Math.max(1,Math.min(100,parseInt(v,10)||5));DATA.setup[k]=v;save();render()}
function selectTestType(id){const t=testType(id);DATA.setup={...DATA.setup,testType:id,...t.defaults};save();render()}
function testTypeInstruction(id){return{
  coverage:'Sample the selected material broadly. Spread questions across distinct concepts. Use concise questions that expose known, shaky, and unknown areas. Avoid repetitive drilling of one detail.',
  focused:'Stay on one narrow skill or procedure. Use varied examples and repeated execution without merely duplicating the same question.',
  deep:'Prioritize reasoning, calculations, interpretation, comparison, multi-step application, and transfer. Avoid shallow recall unless it is needed as a foundation.',
  repair:'Use previous DBD evidence and unresolved mistakes. Test the same weaknesses with fresh wording, values, cases, passages, or distractors. Do not copy the original failed questions.',
  mastery:'Test independent performance after learning. Do not provide hints or answer leakage. Use representative difficulty and enough variation to judge mastery.',
  exam:'Imitate the structure, pacing, difficulty, and answer conditions of the relevant real assessment as closely as the available material supports.'
}[id]}
function workingInstruction(style){return style==='concept'?`This is a no-pen-or-paper conceptual session. For Math, Physics, and Chemistry, test understanding through method selection, error detection, qualitative relationships, prediction, interpretation, classification, comparison, relevant-information recognition, and short mental calculations. Avoid long arithmetic, multi-line algebra, derivations, graph drawing, lengthy equation balancing, or any item that reasonably requires scratch work. Set "paper_required": false for every question.`:`Full written problem solving is allowed. Questions may require scratch work or multi-step calculation. Set paper_required accurately for each question.`}
function answerInstruction(format){return format==='mcq'?'Every question must be multiple choice. Do not generate short-answer, numeric, self-check, or essay questions.':'Use a useful mixture of multiple-choice, short-answer, numeric, self-check, and essay questions when appropriate. For essay questions include model_answer and a concise rubric array. Use self-check only when automatic grading would be dishonest.'}
function timingInstruction(mode){if(mode==='ai')return'Assign a realistic positive time_limit_seconds to every question individually. Limits must reflect the actual work required; do not use one universal limit.';if(mode==='record')return'Time will be recorded without a deadline. time_limit_seconds may be omitted.';return'Timing is disabled. time_limit_seconds may be omitted.'}
function deliveryInstruction(count){return count>LARGE_PACKET_THRESHOLD?`This is a large ${count}-question packet. Create and attach a downloadable .json file. Do not paste the full JSON into the chat. The filename should be short and descriptive.`:`You may return valid JSON directly or attach a downloadable .json file. On mobile, a file is preferred when the response becomes long.`}
function createPrompt(){const s=subject(),x=DATA.setup,t=testType(x.testType);return `I want to prepare a DBD v0.9.8.4.1 packet.

Configuration:
- Subject: ${s.name}
- Campaign: ${s.campaign}
- Test type: ${t.label}
- Working style: ${label(WORKING_STYLES,x.workingStyle)}
- Answer format: ${label(ANSWER_FORMATS,x.answerFormat)}
- Questions: ${x.count}
- Difficulty: ${x.difficulty}
- Feedback in DBD: ${x.feedback==='immediate'?'Immediate':'After session'}
- Timing in DBD: ${label(TIMINGS,x.timing)}
- Additional focus: ${x.focus.trim()||'None'}

Do not generate the packet yet. First inspect the files and conversation in this subject chat. Then ask me exactly one material-selection question. Offer 3–6 concrete scopes grounded in the actual chat, include a custom option, briefly recommend one, and wait for my choice.

After I choose, create exactly ${x.count} questions.

Test-type instruction:
${testTypeInstruction(x.testType)}

Working-style instruction:
${workingInstruction(x.workingStyle)}

Answer-format instruction:
${answerInstruction(x.answerFormat)}

Difficulty:
${x.difficulty==='Adaptive'?'Use a deliberate mixture that locates my current boundary, adjusting the balance using evidence from this chat.':`Use ${x.difficulty.toLowerCase()} difficulty consistently, with defensible traps.`}

Timing:
${timingInstruction(x.timing)}

Output delivery:
${deliveryInstruction(x.count)}

After the material scope is confirmed, return only valid JSON or the requested JSON file. No markdown commentary around the packet.

Schema:
{
  "dbd_version": "0.9.8",
  "campaign": "${s.campaign}",
  "subject": "${s.name}",
  "topic": "selected material scope",
  "source": "exact files, pages, lesson, test, or conversation basis",
  "test_type": "${x.testType}",
  "working_style": "${x.workingStyle}",
  "answer_format": "${x.answerFormat}",
  "difficulty": "${x.difficulty}",
  "questions": [
    {
      "id": "q1",
      "type": "mcq | short | numeric | self_check | essay",
      "time_limit_seconds": 90,
      "paper_required": false,
      "stimulus": {"type":"quote | passage | context","title":"optional","text":"optional","source":"optional"},
      "prompt": "question text",
      "choices": {"A":"...","B":"...","C":"...","D":"..."},
      "answer": "A or expected response",
      "accepted_answers": ["optional valid alternative"],
      "model_answer": "required for essay questions",
      "rubric": ["required essay criterion 1","criterion 2"],
      "tolerance": 0,
      "explanation": "brief post-answer explanation",
      "why_wrong": {"B":"specific misconception or trap"},
      "tags": ["specific skill","specific subtopic"],
      "difficulty": "easy | medium | hard"
    }
  ]
}

Rules:
- Use only the selected material, prior teaching, or explicit exam framework.
- Keep explanations concise.
- Return exactly ${x.count} questions.
- Respect the requested answer format and working style exactly.
- For essay questions, do not pretend there is a single exact string answer; include model_answer and rubric so DBD can run honest self-assessment.
- Do not include raw HTML.
- If timing is AI-set, every question must have a positive time_limit_seconds value.`}
function generatePrompt(){DATA.generatedPrompt=createPrompt();save();route('prompt')}
function createVanillaPrompt(){return `You are preparing a DBD v0.9.8 drill packet for me. DBD is a local static website: there is no direct ChatGPT integration, no Supabase, and no cloud account.

Do not generate JSON immediately. First inspect the files, recent conversation, work already completed, unresolved mistakes, and current assessment context in this chat. Then ask me one compact setup question that lets me choose:

1. the material scope;
2. one test type: Coverage Scan, Focused Drill, Deep Practice, Repair Drill, Mastery Check, or Exam Simulation;
3. No pen or paper, or Full problem solving;
4. Multiple choice only, or Mixed;
5. number of questions;
6. Easy, Medium, Difficult, or Adaptive;
7. Immediate feedback, or After session;
8. timing: Off, Record only, or AI-set question limits;
9. any additional focus.

Recommend sensible defaults using the evidence in this chat, but wait for my choices.

After I answer, create a valid DBD v0.9.8.4.1 packet. For 1–15 questions, you may paste JSON or attach a .json file. For 16 or more questions, create and attach a downloadable .json file and do not paste the full packet into chat.

Every packet must include campaign, subject, topic, source, test_type, working_style, answer_format, difficulty, and questions. It may also include a future-ready stream object such as {"id":"matematika-tingkat-lanjut","name":"Matematika Tingkat Lanjut"}; if omitted, DBD derives it from subject. Every question must include id, type, prompt, explanation, tags, difficulty, paper_required, and choices/answer when it is multiple choice. Essay questions must use type "essay" and include model_answer plus a concise rubric array so DBD can use rubric-based self-assessment rather than fake automatic grading. Include time_limit_seconds on every question when AI-set timing is selected. Do not include raw HTML.`}
function copyVanilla(button){copyText(createVanillaPrompt(),button)}

function simpleHash(s){let h=2166136261;const str=String(s);for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function historicalStreamCandidates(){
  const out=[];
  for(const s of DATA.completedSessions||[]){
    const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));
    for(const a of s.attempts||[]){
      const q=qmap.get(String(a.questionId))||a,choices=q?.choices||a?.choices,correctKey=String(q?.answer??a?.answer??'');
      if(!choices||typeof choices!=='object'||Array.isArray(choices)||!Object.prototype.hasOwnProperty.call(choices,correctKey))continue;
      const keys=Object.keys(choices).filter(k=>String(choices[k]??'').trim());
      if(keys.length<2)continue;
      const wrongKeys=keys.filter(k=>k!==correctKey),cid=`${s.id}:${a.questionId}`,truth=(simpleHash(cid)%2)===0||!wrongKeys.length,proposedKey=truth?correctKey:wrongKeys[simpleHash(cid+'wrong')%wrongKeys.length];
      out.push({id:cid,sessionId:s.id,questionId:a.questionId,subject:s.subject||'Unknown subject',topic:s.topic||'',prompt:q.prompt||a.prompt||'',proposed:String(choices[proposedKey]??proposedKey),truth,proposedKey,correctKey,explanation:q.explanation||a.explanation||'',tags:q.tags||a.tags||[]});
    }
  }
  return out;
}
function getStreamCard(){
  if(streamFeedback?.card)return streamFeedback.card;
  const cards=historicalStreamCandidates();if(!cards.length)return null;
  const seen=DATA.streamPrototype?.seen||{};
  cards.sort((a,b)=>(seen[a.id]||0)-(seen[b.id]||0)||simpleHash(a.id)-simpleHash(b.id));
  return cards[0];
}
function answerStream(value){
  const card=getStreamCard();if(!card||streamFeedback)return;
  const correct=Boolean(value)===Boolean(card.truth);
  DATA.streamPrototype=DATA.streamPrototype||{attempts:[],seen:{}};
  DATA.streamPrototype.seen[card.id]=(DATA.streamPrototype.seen[card.id]||0)+1;
  DATA.streamPrototype.attempts.push({id:makeUid('stream'),cardId:card.id,subject:card.subject,topic:card.topic,questionId:card.questionId,answeredAt:new Date().toISOString(),selected:Boolean(value),correct});
  DATA.streamPrototype.attempts=DATA.streamPrototype.attempts.slice(-1000);
  streamFeedback={card,correct,selected:Boolean(value)};save();render();
  setTimeout(()=>{if(streamFeedback?.card?.id===card.id){streamFeedback=null;render()}},760);
}
function streamHome(){
  const card=getStreamCard();
  if(!card)return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Prototype · historical inventory</span></div><div class="stream-empty">No compatible historical multiple-choice questions were found yet. Complete or import a Session and v0.9.7 will use eligible questions here as a temporary Stream prototype.</div></section>`;
  if(streamFeedback?.card?.id===card.id){const expected=card.truth?'TRUE':'FALSE';return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${esc(card.subject)}</span></div><div class="stream-card"><div class="stream-feedback ${streamFeedback.correct?'good':'bad'}"><div><strong>${streamFeedback.correct?'CORRECT ✓':'NOT QUITE'}</strong><small>Correct response: ${expected}</small></div><div class="stream-next-indicator">Next question…</div></div></div></section>`}
  return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Reusing eligible history · v1 preview</span></div><div class="stream-card"><div class="stream-meta"><div class="stream-subject">${esc(card.subject)}</div><div class="stream-topic">${esc(card.topic||((card.tags||[])[0]||'Historical question'))}</div></div><div class="stream-prompt">${esc(card.prompt)}</div><div class="stream-proposal"><small>Proposed answer</small><strong>${esc(card.proposed)}</strong></div><div class="binary-actions"><button class="binary-button true" onclick="answerStream(true)">TRUE</button><button class="binary-button false" onclick="answerStream(false)">FALSE</button></div></div></section>`;
}
function streamEvidenceState(e){const seen=Math.max(1,Number(e.seen)||1),correct=(Number(e.correct)||0)/seen,secure=(Number(e.secureCorrect)||0)/seen;if((e.dontKnow||0)>0||correct<.6)return'weak';if(secure>=.75&&correct>=.85&&(e.wrong||0)===0)return'secure';return'shaky'}
function subjectSnapshot(stream){
  const sessions=(DATA.completedSessions||[]).filter(s=>(s.stream?.id||streamIdFromName(s.subject))===stream.id),attempts=sessions.flatMap(s=>s.attempts||[]),evidence=Object.values(DATA.conceptEvidence||{}).filter(e=>e.streamId===stream.id),eligible=historicalStreamCandidates().filter(c=>streamIdFromName(c.subject)===stream.id).length,states={secure:0,shaky:0,weak:0};evidence.forEach(e=>states[streamEvidenceState(e)]++);return{sessions,attempts,evidence,eligible,states}
}
function subjectsView(){
  const streams=(DATA.streams||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return `<section class="subjects-page"><div class="eyebrow">Detected from your data</div><h1>Subjects</h1><p class="subjects-intro">These are not hard-coded v1 Streams. v0.9.7 detects them from your existing sessions and evidence so you can preview how subject-level progress will look.</p>${streams.length?`<div class="subject-list">${streams.map(stream=>{const x=subjectSnapshot(stream),ev=x.evidence.slice().sort((a,b)=>{const order={weak:0,shaky:1,secure:2};return order[streamEvidenceState(a)]-order[streamEvidenceState(b)]||(b.seen||0)-(a.seen||0)});return `<details class="subject-card"><summary><div><div class="subject-name">${esc(stream.name)}</div><div class="subject-meta">${x.attempts.length} historical answers · ${x.evidence.length} detected tags · ${x.eligible} Stream-ready cards</div></div><span class="subject-chevron">›</span></summary><div class="subject-body"><div class="subject-metrics"><div class="subject-metric"><strong>${x.states.secure}</strong><span>Secure</span></div><div class="subject-metric"><strong>${x.states.shaky}</strong><span>Shaky</span></div><div class="subject-metric"><strong>${x.states.weak}</strong><span>Weak</span></div></div>${ev.length?`<div class="settings-title">Concept evidence</div><div class="evidence-list">${ev.slice(0,12).map(e=>{const st=streamEvidenceState(e);return `<div class="evidence-row"><div><strong>${esc(e.tag)}</strong><small>${e.correct}/${e.seen} correct · ${e.secureCorrect}/${e.seen} secure</small></div><span class="evidence-state ${st}">${st}</span></div>`}).join('')}</div>`:`<div class="subject-empty">No tagged concept evidence yet.</div>`}<div class="settings-title" style="margin-top:15px">Stream inventory preview</div><p class="note">${x.eligible} historical multiple-choice question${x.eligible===1?'':'s'} can currently be rendered safely in the v0.9.7 True/False prototype. Dedicated v1 bank inventory is still separate.</p></div></details>`}).join('')}</div>`:`<div class="empty">No subjects detected yet. Complete a Session first.</div>`}</section>`;
}

function customizationPanel(){const x=DATA.setup;return `<details class="customization custom-drill" ${customizationOpen?'open':''} ontoggle="customizationOpen=this.open"><summary><strong>CUSTOM DRILL</strong><span class="muted">${esc(subject().name)} · ${esc(testType(x.testType).label)} · ${x.count}Q</span></summary><div class="customization-body"><div class="field" style="margin-top:14px"><label>Subject / campaign</label><select onchange="updateSetup('subjectId',this.value)">${SUBJECTS.map(i=>`<option value="${i.id}" ${i.id===x.subjectId?'selected':''}>${esc(i.campaign)} — ${esc(i.name)}</option>`).join('')}</select></div><div class="field"><label>Test type</label><div class="type-grid">${TEST_TYPES.map(t=>`<button class="type-card ${x.testType===t.id?'active':''}" onclick="selectTestType('${t.id}')"><strong>${esc(t.label)}</strong><span>${esc(t.description)}</span></button>`).join('')}</div></div><div class="setup-grid"><div class="field"><label>Working style</label><div class="choice-row">${WORKING_STYLES.map(([id,l])=>`<button class="chip ${x.workingStyle===id?'active':''}" onclick="updateSetup('workingStyle','${id}')">${esc(l)}</button>`).join('')}</div></div><div class="field"><label>Answer format</label><div class="choice-row">${ANSWER_FORMATS.map(([id,l])=>`<button class="chip ${x.answerFormat===id?'active':''}" onclick="updateSetup('answerFormat','${id}')">${esc(l)}</button>`).join('')}</div></div></div><div class="setup-grid"><div class="field"><label>Number of questions</label><div class="count-row">${COUNT_PRESETS.map(n=>`<button class="chip ${Number(x.count)===n?'active':''}" onclick="updateSetup('count',${n})">${n}</button>`).join('')}<input type="number" min="1" max="100" value="${x.count}" onchange="updateSetup('count',this.value)" aria-label="Custom question count"></div>${x.count>LARGE_PACKET_THRESHOLD?`<div class="large-note"><strong>JSON file delivery:</strong> large packets are requested as a downloadable file.</div>`:''}</div><div class="field"><label>Difficulty</label><div class="choice-row">${DIFFICULTIES.map(d=>`<button class="chip ${x.difficulty===d?'active':''}" onclick="updateSetup('difficulty','${d}')">${d}</button>`).join('')}</div></div></div><div class="setup-grid"><div class="field"><label>Feedback</label><div class="choice-row">${FEEDBACKS.map(([id,l])=>`<button class="chip ${x.feedback===id?'active':''}" onclick="updateSetup('feedback','${id}')">${esc(l)}</button>`).join('')}</div></div><div class="field"><label>Timing</label><div class="choice-row">${TIMINGS.map(([id,l])=>`<button class="chip ${x.timing===id?'active':''}" onclick="updateSetup('timing','${id}')">${esc(l)}</button>`).join('')}</div>${x.timing!=='off'?`<label style="margin-top:11px"><input style="width:auto;margin-right:8px" type="checkbox" ${x.showTimer?'checked':''} onchange="updateSetup('showTimer',this.checked)">Show timer during drill</label>`:''}</div></div><div class="field"><label>Additional focus (optional)</label><textarea placeholder="Examples: cumulative review; conceptual only; prioritize my latest mistakes..." oninput="DATA.setup.focus=this.value;save()">${esc(x.focus)}</textarea></div><button class="button primary custom-generate" onclick="generatePrompt()">GENERATE CHAT REQUEST</button></div></details>`}
function home(){const drills=DATA.completedSessions.length,sessionAnswered=DATA.statistics.answered||DATA.completedSessions.reduce((n,s)=>n+(s.answered||0),0),streamAnswered=(DATA.streamPrototype?.attempts||[]).length,answered=sessionAnswered+streamAnswered;return `${streamHome()}<section class="panel session-zone"><div class="section-kicker"><strong>Session</strong><span>Deliberate drill</span></div><div class="launch-actions"><button class="button primary" onclick="route('import')">IMPORT PACKET</button><button class="button" onclick="copyVanilla(this)">COPY VANILLA INSTRUCTION</button></div>${customizationPanel()}${ongoingSessions(true)}</section><div class="home-stats"><div class="home-stat"><strong>${drills}</strong><span>Total drills</span></div><div class="home-stat"><strong>${answered}</strong><span>Questions answered</span></div></div>`}
function secureAllTime(){const attempts=DATA.completedSessions.flatMap(s=>s.attempts||[]),eligible=attempts.filter(a=>!['skipped','unseen'].includes(a.status));if(!eligible.length)return 0;return Math.round(eligible.filter(a=>a.correct&&a.confidence==='sure').length/eligible.length*100)}
function dailyFlow(){const day=localDay(),today=DATA.completedSessions.filter(s=>localDay(new Date(s.completedAt))===day),quick=today.some(s=>deriveLegacyTestType(s)==='coverage'),main=today.some(s=>deriveLegacyTestType(s)!=='coverage'),closed=!!DATA.dailyState[day]?.closedLoop,total=today.reduce((n,s)=>n+(s.totalQuestions||s.answered||0),0),secure=today.flatMap(s=>s.attempts||[]).filter(a=>a.correct&&a.confidence==='sure').length;return `<section class="panel"><div class="eyebrow">Today’s DBD</div><div class="daily-grid"><div class="daily-card ${quick?'done':''}"><strong>1. Quick Scan</strong><div class="status">${quick?'Completed':'Not completed'}</div>${quick?'':`<button class="button tiny" style="margin-top:10px" onclick="setupDaily('quick')">SET UP 5-Q SCAN</button>`}</div><div class="daily-card ${main?'done':''}"><strong>2. Main Drill</strong><div class="status">${main?'Completed':'Not completed'}</div>${main?'':`<button class="button tiny" style="margin-top:10px" onclick="setupDaily('main')">SET UP MAIN DRILL</button>`}</div><div class="daily-card ${closed?'done':''}"><strong>3. Close the Loop</strong><div class="status">${closed?'Marked complete':'Review mistakes or send the report back'}</div><button class="button tiny" style="margin-top:10px" onclick="toggleCloseLoop()">${closed?'UNDO':'MARK DONE'}</button></div></div><p class="note" style="margin-top:12px">Today: ${total} questions · ${secure} secure correct answers. No punitive streaks.</p></section>`}
function setupDaily(kind){if(kind==='quick'){DATA.setup={...DATA.setup,testType:'coverage',...testType('coverage').defaults,count:5}}else{DATA.setup={...DATA.setup,testType:'focused',...testType('focused').defaults,count:10}}save();render();window.scrollTo({top:0,behavior:'smooth'})}
function toggleCloseLoop(){const day=localDay();DATA.dailyState[day]={...(DATA.dailyState[day]||{}),closedLoop:!DATA.dailyState[day]?.closedLoop};save();render()}
function completedCount(a){return a.responses.filter(r=>['answered','dontknow','timeout'].includes(r.status)).length}
function ongoingSessions(embedded=false){const cards=[];if(DATA.pendingPacket){const pp=DATA.pendingPacket,p=pp.packet;cards.push(`<div class="session pending-session"><span class="pending-badge">Packet waiting for launch</span><div class="session-head"><div><strong>${esc(p.subject)}${p.topic?` · ${esc(p.topic)}`:''}</strong><br><small>${p.questions.length} questions · ${esc(pp.sourceName||'Imported packet')} · ready for preflight</small></div><div class="actions"><button class="button small primary" onclick="reviewPendingPacket()">REVIEW PREFLIGHT</button><button class="button small danger" onclick="discardPending()">DISCARD</button></div></div></div>`)}DATA.activeSessions.forEach(a=>cards.push(`<div class="session"><div class="session-head"><div><strong>${esc(a.packet.subject)}${a.packet.topic?` · ${esc(a.packet.topic)}`:''}</strong><br><small>${esc(testType(a.setupSnapshot.testType).label)} · ${completedCount(a)}/${a.packet.questions.length} completed · last opened ${new Date(a.lastOpenedAt||a.startedAt).toLocaleString()}</small></div><div class="actions"><button class="button small primary" onclick="resumeSession('${a.id}')">RESUME</button><button class="button small" onclick="restartSession('${a.id}')">RESTART</button><button class="button small danger" onclick="deleteActive('${a.id}')">DELETE</button></div></div></div>`));return embedded?`<div class="embedded-ongoing"><div class="eyebrow">Ongoing sessions</div>${cards.length?cards.join(''):`<div class="empty">No unfinished drills or packets waiting.</div>`}</div>`:`<section class="panel"><div class="eyebrow">Ongoing sessions</div>${cards.length?cards.join(''):`<div class="empty">No unfinished drills or packets waiting.</div>`}</section>`}
function discardPending(){if(!DATA.pendingPacket)return;if(confirm('Discard the imported packet waiting for launch?')){DATA.pendingPacket=null;save();render()}}
function resumeSession(id){DATA.currentActiveId=id;const a=active();a.lastOpenedAt=Date.now();a.liveStartedAt=null;save();route('drill')}
function restartSession(id){if(!confirm('Restart this packet from question 1?'))return;const a=DATA.activeSessions.find(x=>x.id===id);a.responses=a.packet.questions.map(()=>newResponse());a.currentIndex=0;a.startedAt=Date.now();a.lastOpenedAt=Date.now();a.liveStartedAt=null;save();render()}
function deleteActive(id){if(!confirm('Delete this unfinished session?'))return;DATA.activeSessions=DATA.activeSessions.filter(x=>x.id!==id);if(DATA.currentActiveId===id)DATA.currentActiveId=DATA.activeSessions[0]?.id||null;save();render()}
function promptView(){const p=DATA.generatedPrompt||createPrompt();return `<section class="panel"><div class="eyebrow">Request out</div><h1 style="font-size:2rem">Ask the subject chat.</h1><div class="message info"><strong>First reply:</strong> the chat should inspect its actual materials, offer concrete scopes, and wait for your material choice before making JSON.</div><div class="code">${esc(p)}</div><div class="actions primary-grid"><button class="button primary" onclick="copyText(DATA.generatedPrompt||createPrompt(),this)">COPY REQUEST</button><button class="button" onclick="route('import')">IMPORT JSON PACKET</button></div><button class="button small" style="margin-top:10px" onclick="route('home')">BACK TO BUILDER</button></section>`}
function importView(){return `<section class="panel"><div class="eyebrow">Packet in</div><h1 style="font-size:2rem">Import the JSON file.</h1>${importError?`<div class="message error">${esc(importError)}</div>`:''}<div id="dropzone" class="dropzone" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropFile(event)"><strong>SELECT JSON FILE</strong><p class="muted">Best for phones and large packets. The file is read locally.</p><input id="json-file" type="file" accept=".json,.txt,application/json,text/plain" onchange="fileChosen(event)" style="display:none"><button class="button primary" onclick="document.getElementById('json-file').click()">CHOOSE FILE</button><div class="file-meta" id="file-meta"></div></div><details class="import-paste"><summary>Paste JSON instead</summary><div><textarea id="packet-input" class="code-input" placeholder="Paste valid DBD JSON here."></textarea><button class="button primary block" onclick="readPastedPacket()">REVIEW PACKET</button></div></details><div class="actions"><button class="button" onclick="route('home')">CANCEL</button></div></section>`}
function dragOver(e){e.preventDefault();document.getElementById('dropzone')?.classList.add('drag')}
function dragLeave(e){e.preventDefault();document.getElementById('dropzone')?.classList.remove('drag')}
function dropFile(e){e.preventDefault();dragLeave(e);const f=e.dataTransfer.files?.[0];if(f)readPacketFile(f)}
function fileChosen(e){const f=e.target.files?.[0];if(f)readPacketFile(f)}
async function readPacketFile(file){try{document.getElementById('file-meta').textContent=`${file.name} · ${Math.round(file.size/1024)} KB`;preparePacket(await file.text(),file.name)}catch(e){importError=e.message||'Could not read file.';render()}}
function readPastedPacket(){preparePacket(document.getElementById('packet-input').value,'Pasted JSON')}
function extractJSON(raw){let text=String(raw||'').trim();const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fenced)text=fenced[1].trim();try{return JSON.parse(text)}catch(e){}const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start>=0&&end>start)return JSON.parse(text.slice(start,end+1));throw new Error('No valid JSON packet could be found.')}
function normalizeStimulus(s){if(!s)return null;if(typeof s==='string')return{type:'context',text:s,title:'',source:''};return{type:['quote','passage','context'].includes(s.type)?s.type:'context',title:String(s.title||''),text:String(s.text||s.content||''),source:String(s.source||'')}}
function normalizeQuestion(raw,i){const prompt=raw.prompt??raw.question??raw.q??raw.text;if(!prompt)return null;let choices=raw.choices??raw.options??null;if(Array.isArray(choices)){const o={};choices.forEach((v,j)=>o[String.fromCharCode(65+j)]=String(v));choices=o}else if(choices&&typeof choices==='object'){const o={};Object.entries(choices).forEach(([k,v])=>o[String(k).toUpperCase()]=String(v));choices=o}let answer=raw.answer??raw.correct??raw.correct_answer??raw.expected_answer??'';if(choices){const match=Object.keys(choices).find(k=>norm(k)===norm(answer))||Object.keys(choices).find(k=>norm(choices[k])===norm(answer));if(match)answer=match}const accepted=Array.isArray(raw.accepted_answers)?raw.accepted_answers.map(String):[];if(answer!==''&&!accepted.some(x=>norm(x)===norm(answer)))accepted.unshift(String(answer));const type=String(raw.type||(choices?'mcq':'short')).toLowerCase();return{id:String(raw.id??`q${i+1}`),uid:String(raw.uid||''),type,prompt:String(prompt),choices,answer:String(answer),acceptedAnswers:accepted,tolerance:Number.isFinite(Number(raw.tolerance))?Number(raw.tolerance):0,explanation:String(raw.explanation??raw.reason??''),whyWrong:raw.why_wrong??raw.whyWrong??{},tags:Array.isArray(raw.tags)?raw.tags.map(String):[],difficulty:String(raw.difficulty||''),timeLimitSeconds:Number.isFinite(Number(raw.time_limit_seconds))?Number(raw.time_limit_seconds):null,paperRequired:raw.paper_required===true,stimulus:normalizeStimulus(raw.stimulus),modelAnswer:String(raw.model_answer??raw.modelAnswer??''),rubric:Array.isArray(raw.rubric)?raw.rubric.map(String):[]}}
function normalizePacket(parsed){const p=Array.isArray(parsed)?{questions:parsed}:parsed;if(!p||!Array.isArray(p.questions))throw new Error('The packet has no questions array.');const questions=p.questions.map(normalizeQuestion).filter(Boolean);if(!questions.length)throw new Error('The packet contains no valid questions.');return ensurePacketIdentity({packetUid:String(p.packet_uid||p.packetUid||''),dbdVersion:String(p.dbd_version||APP_VERSION),campaign:String(p.campaign||subject().campaign),subject:String(p.subject||subject().name),topic:String(p.topic||''),source:String(p.source||''),stream:p.stream&&typeof p.stream==='object'?{id:String(p.stream.id||''),name:String(p.stream.name||'')}:null,testType:String(p.test_type||DATA.setup.testType),workingStyle:String(p.working_style||DATA.setup.workingStyle),answerFormat:String(p.answer_format||DATA.setup.answerFormat),difficulty:String(p.difficulty||DATA.setup.difficulty),questions})}
function syncSetupFromPacket(p){const match=SUBJECTS.find(s=>norm(s.name)===norm(p.subject));if(match)DATA.setup.subjectId=match.id;if(TEST_TYPES.some(t=>t.id===p.testType))DATA.setup.testType=p.testType;if(WORKING_STYLES.some(x=>x[0]===p.workingStyle))DATA.setup.workingStyle=p.workingStyle;if(ANSWER_FORMATS.some(x=>x[0]===p.answerFormat))DATA.setup.answerFormat=p.answerFormat;if(DIFFICULTIES.includes(p.difficulty))DATA.setup.difficulty=p.difficulty;DATA.setup.count=p.questions.length}
function isMCQ(q){return !!(q.choices&&Object.keys(q.choices).length)}
function validatePacket(p){const errors=[],warnings=[],ids=new Set();let mcq=0,typed=0,totalLimit=0,limits=[];p.questions.forEach((q,i)=>{const n=i+1;if(!q.prompt.trim())errors.push(`Question ${n} has no prompt.`);if(ids.has(q.id))warnings.push(`Duplicate question ID: ${q.id}.`);ids.add(q.id);if(isMCQ(q)){mcq++;const keys=Object.keys(q.choices);if(keys.length<2)errors.push(`Question ${n} has fewer than two choices.`);if(!keys.some(k=>norm(k)===norm(q.answer)))errors.push(`Question ${n} has an answer that does not match any choice.`);if(new Set(keys.map(k=>norm(q.choices[k]))).size!==keys.length)warnings.push(`Question ${n} contains duplicate answer choices.`)}else{typed++;if(!['short','numeric','self_check','essay'].includes(q.type))errors.push(`Question ${n} uses unsupported type “${q.type}”.`);if(q.type==='essay'){if(!q.modelAnswer)errors.push(`Essay question ${n} has no model_answer.`);if(!q.rubric.length)errors.push(`Essay question ${n} has no rubric.`)}else if(!q.answer&&!q.acceptedAnswers.length)errors.push(`Question ${n} has no expected answer.`)}if(!q.explanation&&q.type!=='essay')warnings.push(`Question ${n} has no explanation.`);if(!q.tags.length)warnings.push(`Question ${n} has no skill tags.`);if(DATA.setup.answerFormat==='mcq'&&!isMCQ(q))errors.push(`Question ${n} is not multiple choice, but Multiple choice only was requested.`);if(DATA.setup.workingStyle==='concept'&&q.paperRequired)errors.push(`Question ${n} requires paper, but No pen or paper was requested.`);if(DATA.setup.timing==='ai'){if(!(q.timeLimitSeconds>0))errors.push(`Question ${n} has no positive AI-set time limit.`);else{totalLimit+=q.timeLimitSeconds;limits.push(q.timeLimitSeconds)}}});return{errors,warnings,mcq,typed,totalLimit,limits}}
function preparePacket(raw,name){try{const packet=normalizePacket(extractJSON(raw));syncSetupFromPacket(packet);const validation=validatePacket(packet);DATA.pendingPacket={packet,validation,sourceName:name,importedAt:Date.now()};importError='';save();route('preflight')}catch(e){importError=e.message||'Could not load packet.';render()}}
function preflightSettings(){const x=DATA.setup,p=DATA.pendingPacket?.packet;if(!p)return'';return `<details class="preflight-settings"><summary>Launch settings</summary><div class="preflight-settings-body"><div class="preflight-settings-grid"><div class="field"><label>Test type</label><select onchange="updatePreflightSetup('testType',this.value)">${TEST_TYPES.map(t=>`<option value="${t.id}" ${x.testType===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><div class="field"><label>Questions in packet</label><input value="${p.questions.length}" readonly></div><div class="field"><label>Working style</label><select onchange="updatePreflightSetup('workingStyle',this.value)">${WORKING_STYLES.map(([id,l])=>`<option value="${id}" ${x.workingStyle===id?'selected':''}>${esc(l)}</option>`).join('')}</select></div><div class="field"><label>Answer format</label><select onchange="updatePreflightSetup('answerFormat',this.value)">${ANSWER_FORMATS.map(([id,l])=>`<option value="${id}" ${x.answerFormat===id?'selected':''}>${esc(l)}</option>`).join('')}</select></div><div class="field"><label>Difficulty</label><select onchange="updatePreflightSetup('difficulty',this.value)">${DIFFICULTIES.map(d=>`<option value="${d}" ${x.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></div><div class="field"><label>Feedback</label><select onchange="updatePreflightSetup('feedback',this.value)">${FEEDBACKS.map(([id,l])=>`<option value="${id}" ${x.feedback===id?'selected':''}>${esc(l)}</option>`).join('')}</select></div><div class="field"><label>Timing</label><select onchange="updatePreflightSetup('timing',this.value)">${TIMINGS.map(([id,l])=>`<option value="${id}" ${x.timing===id?'selected':''}>${esc(l)}</option>`).join('')}</select></div><div class="field"><label>Show timer</label><select onchange="updatePreflightSetup('showTimer',this.value==='yes')"><option value="yes" ${x.showTimer?'selected':''}>Yes</option><option value="no" ${!x.showTimer?'selected':''}>No</option></select></div></div><div class="field" style="margin-top:11px"><label>Additional focus for the next generated request</label><textarea oninput="updatePreflightFocus(this.value)" placeholder="Optional">${esc(x.focus)}</textarea></div></div></details>`}
function updatePreflightSetup(k,v){if(k==='count')v=Math.max(1,Math.min(100,parseInt(v,10)||5));DATA.setup[k]=v;if(DATA.pendingPacket)DATA.pendingPacket.validation=validatePacket(DATA.pendingPacket.packet);save();render()}
function updatePreflightFocus(v){DATA.setup.focus=v;save()}
function preflight(){const pp=DATA.pendingPacket;if(!pp)return `<div class="empty">No packet is waiting.</div>`;const v=pp.validation,p=pp.packet;return `<div class="preflight-backdrop"><div class="preflight-card"><div class="preflight-kicker">Mission briefing</div><div class="preflight-title"><h1>READY TO<br>LAUNCH</h1><p class="muted">${esc(pp.sourceName)}</p></div><div class="manifest"><div class="manifest-item"><span>Subject</span><strong>${esc(p.subject)}</strong></div><div class="manifest-item"><span>Topic</span><strong>${esc(p.topic||'Unspecified')}</strong></div><div class="manifest-item"><span>Questions</span><strong>${p.questions.length}</strong></div><div class="manifest-item"><span>Composition</span><strong>${v.mcq} MCQ · ${v.typed} typed</strong></div></div>${preflightSettings()}${v.errors.length?`<h3>Blocking errors</h3><ul class="check-list error">${v.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${v.warnings.length?`<details class="validation-details"><summary>Warnings (${v.warnings.length})</summary><div><ul class="check-list warning">${v.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></details>`:''}<details class="validation-details"><summary>Validation details</summary><div><ul class="check-list ok"><li>Packet structure is launchable.</li><li>Answer format matches the launch settings.</li><li>Working-style rules passed.</li>${DATA.setup.timing==='ai'?`<li>${v.limits.length?`AI timing covers ${v.limits.length} questions, estimated ${fmt(v.totalLimit)} total.`:'AI timing has not been supplied.'}</li>`:''}</ul></div></details><div class="preflight-actions"><button class="button primary" ${v.errors.length?'disabled':''} onclick="launchPacket()">START DRILL</button><button class="button ghost" onclick="cancelPending()">CANCEL</button></div></div></div>`}
function reviewPendingPacket(){if(!DATA.pendingPacket)return;DATA.pendingPacket.validation=validatePacket(DATA.pendingPacket.packet);save();route('preflight')}
function cancelPending(){save();route('home')}
function launchPacket(){const pp=DATA.pendingPacket;if(!pp||pp.validation.errors.length)return;const id=makeUid('session'),session={id,packet:pp.packet,setupSnapshot:{...DATA.setup},responses:pp.packet.questions.map(()=>newResponse()),currentIndex:0,startedAt:Date.now(),lastOpenedAt:Date.now(),liveStartedAt:null,paused:false,retryKind:null};DATA.activeSessions.push(session);DATA.currentActiveId=id;DATA.pendingPacket=null;save();route('drill')}
function stimulusHTML(s){if(!s?.text)return'';return `<div class="stimulus ${esc(s.type)}">${s.title?`<div class="stimulus-title">${esc(s.title)}</div>`:''}${esc(s.text)}${s.source?`<div class="stimulus-source">— ${esc(s.source)}</div>`:''}</div>`}
function currentQuestion(){const a=active();return a?.packet.questions[a.currentIndex]||null}
function currentResponse(){const a=active();return a?.responses[a.currentIndex]||null}
function responseEditable(a,r){return a.setupSnapshot.feedback==='end'||!r.locked}
function ensureLiveStart(){const a=active(),r=currentResponse();if(!a||a.paused||!r||r.locked||r.status==='timeout')return;if(a.setupSnapshot.timing!=='off'&&!a.liveStartedAt)a.liveStartedAt=Date.now()}
function accrueTime(){const a=active();if(!a||!a.liveStartedAt||a.paused)return;const r=currentResponse();if(r&&a.setupSnapshot.timing!=='off')r.elapsed+=(Date.now()-a.liveStartedAt)/1000;a.liveStartedAt=null}
function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null}}
function startTimer(){stopTimer();ensureLiveStart();timerInterval=setInterval(updateTimer,300)}
function elapsedCurrent(){const a=active(),r=currentResponse();if(!a||!r)return 0;return r.elapsed+(a.liveStartedAt&&!a.paused?(Date.now()-a.liveStartedAt)/1000:0)}
function updateTimer(){const a=active(),q=currentQuestion(),r=currentResponse();if(!a||view!=='drill'||a.paused||!q||!r)return;const elapsed=elapsedCurrent();const el=document.getElementById('timer');if(el)el.textContent=a.setupSnapshot.timing==='ai'?fmt(Math.max(0,(q.timeLimitSeconds||0)-elapsed)):fmt(elapsed);if(a.setupSnapshot.timing==='ai'&&q.timeLimitSeconds>0&&elapsed>=q.timeLimitSeconds&&!r.locked&&r.status!=='timeout')timeOutQuestion()}
function timeOutQuestion(){const a=active(),r=currentResponse();accrueTime();r.status='timeout';r.timedOut=true;r.answer=null;r.correct=false;r.locked=true;r.revealed=a.setupSnapshot.feedback==='immediate';r.errorType='timeout';save();render()}
function setChoice(k){const a=active(),r=currentResponse();if(!a||!responseEditable(a,r))return;r.answer=k;r.status='selected';r.timedOut=false;save();render()}
function setDraft(v){const r=currentResponse();if(r)r.draft=v;save()}
function setConfidence(v){const r=currentResponse();if(!r||r.locked)return;r.confidence=v;save();render()}
function toggleFlag(){const r=currentResponse();if(!r)return;r.flagged=!r.flagged;save();render()}
function calculateCorrect(q,r){if(r.status==='dontknow'||r.status==='timeout'||r.status==='skipped'||r.status==='unseen')return false;if(q.type==='essay')return r.selfAssessment==='yes';if(isMCQ(q))return norm(r.answer)===norm(q.answer);if(q.type==='numeric'){const given=Number(String(r.answer).replace(',','.')),expected=Number(String(q.answer).replace(',','.'));if(Number.isFinite(given)&&Number.isFinite(expected))return Math.abs(given-expected)<=Math.max(0,q.tolerance||0)}return q.acceptedAnswers.some(x=>norm(x)===norm(r.answer))}
function submitAnswer(){const a=active(),q=currentQuestion(),r=currentResponse();if(!a||!q||!r||r.locked)return;if(!isMCQ(q)){const input=document.getElementById(q.type==='essay'?'essay-answer':'typed-answer');r.answer=(input?.value??r.draft??'').trim();r.draft=r.answer}if(r.answer===null||String(r.answer).trim()==='')return;accrueTime();r.status='answered';if(q.type==='essay'){r.correct=r.selfAssessment==='yes'?true:r.selfAssessment?false:null;r.locked=a.setupSnapshot.feedback==='immediate';r.revealed=a.setupSnapshot.feedback==='immediate';save();if(a.setupSnapshot.feedback==='end')advanceAfterSubmit();else render();return}r.correct=calculateCorrect(q,r);r.errorType=!r.correct&&r.confidence==='guess'?'guess':r.errorType;r.locked=a.setupSnapshot.feedback==='immediate';r.revealed=a.setupSnapshot.feedback==='immediate';save();if(a.setupSnapshot.feedback==='end')advanceAfterSubmit();else render()}
function dontKnow(){const a=active(),r=currentResponse();if(!a||r.locked)return;accrueTime();r.status='dontknow';r.answer=null;r.correct=false;r.confidence='sure';r.errorType='concept';r.locked=a.setupSnapshot.feedback==='immediate';r.revealed=a.setupSnapshot.feedback==='immediate';save();if(a.setupSnapshot.feedback==='end')advanceAfterSubmit();else render()}
function skipQuestion(){const a=active(),r=currentResponse();if(!a||r.locked)return;accrueTime();r.status='skipped';r.answer=null;r.correct=null;r.locked=false;save();advanceAfterSubmit()}
function setEssayAssessment(index,value){const a=active();if(!a||index<0||index>=a.responses.length)return;const q=a.packet.questions[index],r=a.responses[index];if(q.type!=='essay'||!['yes','partly','no'].includes(value))return;r.selfAssessment=value;r.correct=value==='yes';if(value==='partly'&&!r.errorType)r.errorType='concept';if(value==='no'&&!r.errorType)r.errorType='concept';save();render()}
function setErrorType(v){const r=currentResponse();if(r){r.errorType=v;save();render()}}
function setNote(v){const r=currentResponse();if(r){r.note=v;save()}}
function setComment(v){const r=currentResponse();if(r){r.comment=v;save()}}
function toggleCommentBox(){const a=active();if(!a)return;const key=`${a.id}:${a.currentIndex}`;commentOpenKey=commentOpenKey===key?null:key;render()}
function commentIsOpen(){const a=active();return !!a&&commentOpenKey===`${a.id}:${a.currentIndex}`}
function nextUnseenIndex(a,start=a.currentIndex+1){for(let i=start;i<a.responses.length;i++)if(['unseen','selected'].includes(a.responses[i].status))return i;for(let i=0;i<a.responses.length;i++)if(['unseen','selected'].includes(a.responses[i].status))return i;for(let i=0;i<a.responses.length;i++)if(a.responses[i].status==='skipped')return i;return -1}
function advanceAfterSubmit(){const a=active();if(!a)return;const n=nextUnseenIndex(a,a.currentIndex+1);if(n<0){route('review');return}goToQuestion(n)}
function goToQuestion(i){const a=active();if(!a||i<0||i>=a.packet.questions.length)return;accrueTime();a.currentIndex=i;a.lastOpenedAt=Date.now();a.liveStartedAt=null;save();view='drill';navigatorOpen=false;render();window.scrollTo({top:0,behavior:'smooth'})}
function previousQuestion(){const a=active();if(a&&a.currentIndex>0)goToQuestion(a.currentIndex-1)}
function nextQuestion(){const a=active();if(!a)return;if(a.currentIndex<a.packet.questions.length-1)goToQuestion(a.currentIndex+1);else route('review')}
function pause(){const a=active();if(!a)return;accrueTime();a.paused=true;save();render()}
function resume(){const a=active();if(!a)return;a.paused=false;a.liveStartedAt=null;a.lastOpenedAt=Date.now();save();render()}
function exitDrill(){accrueTime();save();route('home')}
function navClass(r,i,current){let c='nav-q';if(i===current)c+=' current';if(r.status==='answered'||r.status==='dontknow'||r.status==='timeout')c+=' answered';if(r.confidence==='unsure'&&r.status==='answered')c+=' unsure';if(r.confidence==='guess'&&r.status==='answered')c+=' guess';if(r.status==='skipped')c+=' skipped';if(r.flagged)c+=' flagged';return c}
function navigatorOverlay(){const a=active();if(!navigatorOpen||!a)return'';const done=a.responses.filter(r=>['answered','dontknow','timeout'].includes(r.status)).length;return `<div class="navigator-overlay" onclick="if(event.target===this){navigatorOpen=false;render()}"><div class="navigator-card"><div class="navigator-header"><div><div class="eyebrow">Question navigator</div><h2>${esc(a.packet.subject)}</h2></div><div class="navigator-progress">${done} / ${a.packet.questions.length} answered</div></div><div class="navigator-grid">${a.responses.map((r,i)=>`<button class="${navClass(r,i,a.currentIndex)}" onclick="goToQuestion(${i})">${i+1}</button>`).join('')}</div><p class="note">Green = answered · blue = not sure · orange = ngasal · dashed = skipped · dot = flagged.</p><button class="button primary block" onclick="route('review')">REVIEW & SUBMIT</button></div></div>`}
function feedbackBlock(q,r){if(!r.revealed)return'';const a=active();if(q.type==='essay'){return `<div class="essay-review"><h4>Essay self-check</h4><div><strong>Your answer</strong><div class="essay-answer">${esc(r.answer||'—')}</div></div><div style="margin-top:10px"><strong>Reference answer</strong><div class="essay-answer">${esc(q.modelAnswer||'—')}</div></div>${q.rubric.length?`<ul class="essay-rubric">${q.rubric.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="essay-assess"><button class="${r.selfAssessment==='yes'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'yes')">YES</button><button class="${r.selfAssessment==='partly'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'partly')">PARTLY</button><button class="${r.selfAssessment==='no'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'no')">NO</button></div>${r.selfAssessment?`<button class="button primary block" style="margin-top:10px" onclick="nextQuestion()">${a.currentIndex===a.packet.questions.length-1?'REVIEW SESSION':'NEXT QUESTION'} →</button>`:''}</div>`}const correct=r.correct===true;const needsStandaloneNext=!isMCQ(q)&&(r.locked&&a?.setupSnapshot.feedback==='immediate')||r.status==='dontknow'||r.status==='timeout';return `<div class="feedback ${correct?'correct':'wrong'}"><span class="feedback-tag">${r.timedOut?'Timed out':r.status==='dontknow'?"Don't know":correct?'Correct':'Wrong'}</span><p><strong>Correct answer:</strong> ${esc(q.answer)}</p>${q.explanation?`<p class="muted">${esc(q.explanation)}</p>`:''}${!correct&&q.whyWrong&&q.whyWrong[r.answer]?`<p class="muted"><strong>Your trap:</strong> ${esc(q.whyWrong[r.answer])}</p>`:''}${needsStandaloneNext?`<button class="button primary block" style="margin-top:10px" onclick="nextQuestion()">${a.currentIndex===a.packet.questions.length-1?'REVIEW SESSION':'NEXT QUESTION'} →</button>`:''}</div>`}
function drill(){const a=active();if(!a)return `<div class="empty">No active drill.</div>`;const q=currentQuestion(),r=currentResponse(),total=a.packet.questions.length,editable=responseEditable(a,r),showTimer=a.setupSnapshot.timing!=='off'&&a.setupSnapshot.showTimer,canSubmit=(isMCQ(q)?r.answer!==null:String(r.draft||r.answer||'').trim()!=='')&&!r.locked,wrongRevealed=r.revealed&&r.correct===false,done=completedCount(a),left=Math.max(0,total-done),commentOpen=commentIsOpen();let questionInput='';if(isMCQ(q)){questionInput=`<div class="choices">${Object.entries(q.choices).map(([k,v])=>{let c='answer-option-shell';if(r.answer===k)c+=' selected';if(r.revealed&&norm(k)===norm(q.answer))c+=' correct';else if(r.revealed&&r.answer===k&&!r.correct)c+=' wrong';const selected=r.answer===k,actionLabel=a.setupSnapshot.feedback==='immediate'?(r.revealed?'NEXT →':'CHECK →'):'NEXT →',actionFn=a.setupSnapshot.feedback==='immediate'?(r.revealed?'nextQuestion()':'submitAnswer()'):'submitAnswer()';return `<div class="${c}"><button class="answer-main" ${editable?'':'disabled'} onclick="setChoice('${esc(k)}')"><strong>${esc(k)}.</strong> ${esc(v)}</button>${selected?`<button class="answer-inline-action ${r.revealed?'next':''}" onclick="${actionFn}">${a.currentIndex===total-1&&r.revealed?'REVIEW →':actionLabel}</button>`:''}</div>`}).join('')}</div>`}else if(q.type==='essay'){questionInput=`<div class="field essay-field"><label>Your essay answer</label><textarea id="essay-answer" ${editable?'':'disabled'} oninput="setDraft(this.value)" placeholder="Write your response here...">${esc(r.draft||r.answer||'')}</textarea></div>${!r.locked?`<button class="button primary typed-submit" ${canSubmit?'':'disabled'} onclick="submitAnswer()">${a.setupSnapshot.feedback==='end'?'SAVE & NEXT':'SUBMIT ESSAY'}</button>`:''}`}else{questionInput=`<div class="field typed-field"><label>Your final answer</label><input id="typed-answer" value="${esc(r.draft||r.answer||'')}" ${editable?'':'disabled'} oninput="setDraft(this.value)" placeholder="Type the final answer here"></div>${!r.locked?`<button class="button primary typed-submit" ${canSubmit?'':'disabled'} onclick="submitAnswer()">${a.setupSnapshot.feedback==='end'?'SAVE & NEXT':'SUBMIT ANSWER'}</button>`:''}`}
const feedback=feedbackBlock(q,r),feedbackSlot=a.setupSnapshot.feedback==='immediate'?`<div class="feedback-slot ${feedback?'':'empty'}">${feedback||'<div class="feedback"></div>'}</div>`:feedback;const html=`<div class="drill-shell"><div class="drill-progress-row"><button class="progress-shell" onclick="navigatorOpen=true;render()" aria-label="Open question navigator"><div class="progress-track"><div class="progress-fill" style="width:${done/total*100}%"></div></div><div class="progress-meta"><span>Q${a.currentIndex+1} / ${total}</span><span>${left} left</span></div></button><button class="pause-square" onclick="pause()" aria-label="Pause drill">Ⅱ</button></div><section class="panel question-panel"><div class="question-core">${showTimer?`<div class="timer" id="timer">${a.setupSnapshot.timing==='ai'?fmt(Math.max(0,(q.timeLimitSeconds||0)-elapsedCurrent())):fmt(elapsedCurrent())}</div>${a.setupSnapshot.timing==='ai'?`<div class="question-limit">AI-set limit · ${fmt(q.timeLimitSeconds)}</div>`:''}`:''}${stimulusHTML(q.stimulus)}<div class="question-text">${esc(q.prompt)}</div>${questionInput}<div class="confidence-wrap"><div class="confidence-head"><div class="confidence-label">How certain are you?</div><button class="flag-compact ${r.flagged?'active':''}" onclick="toggleFlag()">${r.flagged?'<span class="flag-dot"></span> FLAGGED':'FLAG'}</button></div><div class="confidence-row">${CONFIDENCES.map(([id,l])=>`<button class="confidence-btn ${r.confidence===id?'active':''}" ${r.locked?'disabled':''} onclick="setConfidence('${id}')">${esc(l)}</button>`).join('')}</div></div>${feedbackSlot}${wrongRevealed&&q.type!=='essay'?`<div class="error-classifier"><label>What happened? (optional)</label><div class="error-types">${ERROR_TYPES.filter(x=>!['timeout','unclassified'].includes(x[0])).map(([id,l])=>`<button class="error-type ${r.errorType===id?'active':''}" onclick="setErrorType('${id}')">${esc(l)}</button>`).join('')}</div></div>`:''}${r.revealed&&q.type!=='essay'?`<div class="field compact-note"><label>One-line note (optional)</label><input value="${esc(r.note||'')}" oninput="setNote(this.value)" placeholder="Example: I confused the method."></div>`:''}<div class="answer-tools"><button class="tool-button" ${r.locked?'disabled':''} onclick="dontKnow()">I DON’T KNOW</button><button class="tool-button" ${r.locked?'disabled':''} onclick="skipQuestion()">SKIP</button><button class="tool-button comment-trigger ${r.comment?'has-comment':''}" onclick="toggleCommentBox()">COMMENT ${commentOpen?'−':'＋'}</button></div>${commentOpen?`<div class="comment-pop"><textarea oninput="setComment(this.value)" placeholder="Question wording, something to ask the chat, or anything worth remembering...">${esc(r.comment||'')}</textarea></div>`:''}</div></section></div>`;return html+(a.paused?`<div class="pause-overlay" onclick="if(event.target===this)resume()"><div class="pause-card"><div class="eyebrow">Paused</div><h1 style="font-size:2rem">Timer stopped.</h1><p class="muted">The question is hidden while the drill is paused.</p><button class="button primary block" onclick="resume()">RESUME</button><button class="button block" style="margin-top:8px" onclick="exitDrill()">SAVE & RETURN HOME</button></div></div>`:'')+navigatorOverlay()}
function reviewView(){const a=active();if(!a)return `<div class="empty">No active drill.</div>`;const counts={answered:0,dontknow:0,skipped:0,unseen:0,flagged:0};a.responses.forEach(r=>{if(r.status==='answered'||r.status==='timeout')counts.answered++;else if(r.status==='dontknow')counts.dontknow++;else if(r.status==='skipped')counts.skipped++;else counts.unseen++;if(r.flagged)counts.flagged++});const essays=a.packet.questions.map((q,i)=>({q,r:a.responses[i],i})).filter(x=>x.q.type==='essay'&&x.r.status==='answered'),unassessed=essays.filter(x=>!x.r.selfAssessment);return `<section class="panel"><div class="eyebrow">Final check</div><h1 style="font-size:2rem">Review before submitting.</h1><div class="review-grid"><div class="review-stat"><strong>${counts.answered}</strong><span>answered</span></div><div class="review-stat"><strong>${counts.dontknow}</strong><span>don’t know</span></div><div class="review-stat"><strong>${counts.skipped}</strong><span>skipped</span></div><div class="review-stat"><strong>${counts.unseen}</strong><span>unseen</span></div><div class="review-stat"><strong>${counts.flagged}</strong><span>flagged</span></div></div>${a.setupSnapshot.feedback==='end'&&essays.length?`<div class="essay-review-list"><div class="eyebrow">Essay self-assessment</div>${essays.map(({q,r,i})=>`<div class="essay-review-card"><div class="question-text">${esc(q.prompt)}</div><div><strong>Your answer</strong><div class="essay-answer">${esc(r.answer||'—')}</div></div><div style="margin-top:9px"><strong>Reference answer</strong><div class="essay-answer">${esc(q.modelAnswer||'—')}</div></div>${q.rubric.length?`<ul class="essay-rubric">${q.rubric.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="essay-assess"><button class="${r.selfAssessment==='yes'?'active':''}" onclick="setEssayAssessment(${i},'yes')">YES</button><button class="${r.selfAssessment==='partly'?'active':''}" onclick="setEssayAssessment(${i},'partly')">PARTLY</button><button class="${r.selfAssessment==='no'?'active':''}" onclick="setEssayAssessment(${i},'no')">NO</button></div></div>`).join('')}</div>`:''}${counts.skipped||counts.unseen?`<div class="message info" style="margin-top:15px">You can submit with unanswered items, or return to them first.</div>`:''}${unassessed.length?`<div class="message info" style="margin-top:15px">Self-assess ${unassessed.length} essay answer${unassessed.length===1?'':'s'} before submitting.</div>`:''}<div class="navigator-grid">${a.responses.map((r,i)=>`<button class="${navClass(r,i,a.currentIndex)}" onclick="goToQuestion(${i})">${i+1}</button>`).join('')}</div><div class="actions primary-grid"><button class="button primary" ${unassessed.length?'disabled':''} onclick="finishSession()">SUBMIT SESSION</button><button class="button" onclick="goToQuestion(${a.currentIndex})">RETURN TO QUESTIONS</button></div></section>`}
function attemptFrom(q,r){const correct=['answered','dontknow','timeout'].includes(r.status)?calculateCorrect(q,r):false;return{questionId:q.id,prompt:q.prompt,stimulus:q.stimulus,type:q.type,choices:q.choices,selected:r.answer,answer:q.type==='essay'?q.modelAnswer:q.answer,modelAnswer:q.modelAnswer,rubric:q.rubric,selfAssessment:r.selfAssessment,correct,status:r.status,confidence:r.confidence,secureCorrect:correct&&r.confidence==='sure',flagged:r.flagged,elapsed:r.elapsed,errorType:r.errorType||(!correct&&r.confidence==='guess'?'guess':r.status==='dontknow'?'concept':r.status==='timeout'?'timeout':'unclassified'),note:r.note||'',comment:r.comment||'',tags:q.tags,difficulty:q.difficulty,explanation:q.explanation,whyWrong:q.whyWrong,timeLimitSeconds:q.timeLimitSeconds,paperRequired:q.paperRequired,timedOut:r.timedOut}}
function finishSession(){const a=active();if(!a)return;accrueTime();const attempts=a.packet.questions.map((q,i)=>attemptFrom(q,a.responses[i])),total=attempts.length,answered=attempts.filter(x=>['answered','dontknow','timeout'].includes(x.status)).length,correct=attempts.filter(x=>x.correct).length,secureCorrect=attempts.filter(x=>x.secureCorrect).length,wrong=attempts.filter(x=>['answered','dontknow','timeout'].includes(x.status)&&!x.correct).length,unanswered=total-answered,totalTime=a.setupSnapshot.timing==='off'?null:attempts.reduce((n,x)=>n+(x.elapsed||0),0),session={id:a.id,completedAt:new Date().toISOString(),campaign:a.packet.campaign,subject:a.packet.subject,topic:a.packet.topic,source:a.packet.source,testType:a.setupSnapshot.testType,workingStyle:a.setupSnapshot.workingStyle,answerFormat:a.setupSnapshot.answerFormat,difficulty:a.packet.difficulty||a.setupSnapshot.difficulty,feedback:a.setupSnapshot.feedback,timing:a.setupSnapshot.timing,totalQuestions:total,answered,correct,secureCorrect,wrong,unanswered,accuracy:total?correct/total*100:0,secureAccuracy:total?secureCorrect/total*100:0,totalTime,attempts,retryKind:a.retryKind||null,_packetQuestions:a.packet.questions};DATA.completedSessions.unshift(session);DATA.completedSessions=DATA.completedSessions.slice(0,200);DATA.statistics.answered+=answered;DATA.statistics.correct+=correct;DATA.statistics.wrong+=wrong;DATA.activeSessions=DATA.activeSessions.filter(x=>x.id!==a.id);DATA.currentActiveId=DATA.activeSessions[0]?.id||null;currentSessionId=session.id;save();route('summary')}
function getSession(id){return DATA.completedSessions.find(s=>s.id===id)}
function viewSession(id){currentSessionId=id;route('summary')}
function viewFullQuiz(id){currentSessionId=id;route('quiz')}
function sessionTestType(s){return testType(deriveLegacyTestType(s)).label}
function eligibleAttempts(s){return (s.attempts||[]).filter(a=>!['skipped','unseen'].includes(a.status))}
function tagStats(s){const m={};(s.attempts||[]).forEach(a=>(a.tags?.length?a.tags:['untagged']).forEach(t=>{m[t]??={total:0,correct:0,secure:0};m[t].total++;if(a.correct)m[t].correct++;if(a.secureCorrect)m[t].secure++}));return Object.entries(m).sort((a,b)=>a[1].correct/a[1].total-b[1].correct/b[1].total)}
function errorStats(s){const m={};(s.attempts||[]).filter(a=>!a.correct&&a.status!=='skipped'&&a.status!=='unseen'&&a.errorType&&a.errorType!=='unclassified').forEach(a=>m[a.errorType]=(m[a.errorType]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function confidenceStats(s){const e=eligibleAttempts(s);return{sureCorrect:e.filter(a=>a.correct&&a.confidence==='sure').length,unsureCorrect:e.filter(a=>a.correct&&a.confidence==='unsure').length,guessCorrect:e.filter(a=>a.correct&&a.confidence==='guess').length,incorrect:e.filter(a=>!a.correct).length,dontknow:e.filter(a=>a.status==='dontknow').length,unanswered:(s.attempts||[]).filter(a=>['skipped','unseen'].includes(a.status)).length}}
function confidenceDistribution(s){const all=s.attempts||[],total=Math.max(1,s.totalQuestions||s.answered||all.length||1);const d={sure:0,unsure:0,guess:0,dontknow:0,skipped:0,total};all.forEach(a=>{if(a.status==='dontknow')d.dontknow++;else if(['skipped','unseen'].includes(a.status))d.skipped++;else if(a.confidence==='guess')d.guess++;else if(a.confidence==='unsure')d.unsure++;else d.sure++});return d}
function weakTagStats(s){return tagStats(s).filter(([,v])=>v.correct<v.total||v.secure<v.total).sort((a,b)=>{const as=a[1].secure/a[1].total,bs=b[1].secure/b[1].total;if(as!==bs)return as-bs;const ar=a[1].correct/a[1].total,br=b[1].correct/b[1].total;if(ar!==br)return ar-br;return (b[1].total-b[1].correct)-(a[1].total-a[1].correct)}).slice(0,8)}
function pct(n,total){return total?Math.round(n/total*100):0}
function confidenceVisual(s){const d=confidenceDistribution(s),parts=[['sure','Sure',d.sure,'#f4b400'],['unsure','Not sure',d.unsure,'#70a7ff'],['guess','Ngasal',d.guess,'#f2a65a'],['dontknow',"Don't know",d.dontknow,'#ef5350'],['skipped','Skipped',d.skipped,'#697078']].filter(([,label,n])=>n>0);return `<div class="confidence-stack">${parts.map(([id,label,n,color])=>`<span title="${label}: ${n}" style="width:${n/d.total*100}%;background:${color}"></span>`).join('')}</div><div class="confidence-legend">${parts.map(([id,label,n,color])=>`<div class="confidence-legend-item"><i style="background:${color}"></i><span>${label}</span><strong>${pct(n,d.total)}%</strong><small>${n}</small></div>`).join('')}</div>`}

function sessionReport(s){const tags=tagStats(s),errs=errorStats(s),c=confidenceStats(s),wrong=(s.attempts||[]).filter(a=>!a.correct&&a.status!=='skipped'&&a.status!=='unseen'),comments=(s.attempts||[]).filter(a=>a.comment);return `DBD DIAGNOSTICS

Campaign: ${s.campaign}
Subject: ${s.subject}
Topic: ${s.topic||'—'}
Source: ${s.source||'—'}
Test type: ${sessionTestType(s)}
Working style: ${label(WORKING_STYLES,s.workingStyle)}
Answer format: ${label(ANSWER_FORMATS,s.answerFormat)}
Difficulty: ${s.difficulty||'—'}
Feedback: ${s.feedback==='immediate'?'Immediate':'After session'}
Timing: ${label(TIMINGS,s.timing)}

Performance:
- Total questions: ${s.totalQuestions||s.answered}
- Correct: ${s.correct}
- Secure correct: ${s.secureCorrect??c.sureCorrect}
- Raw accuracy: ${Math.round(s.accuracy||0)}%
- Secure accuracy: ${Math.round(s.secureAccuracy??((s.totalQuestions||s.answered)?c.sureCorrect/(s.totalQuestions||s.answered)*100:0))}%
- Unanswered/skipped: ${s.unanswered??c.unanswered}${s.totalTime===null?'':`
- Total active time: ${fmt(s.totalTime)}`}

Confidence breakdown:
- Confident correct: ${c.sureCorrect}
- Uncertain correct: ${c.unsureCorrect}
- Ngasal but correct: ${c.guessCorrect}
- Incorrect: ${c.incorrect}
- Don’t know: ${c.dontknow}
- Skipped/unanswered: ${c.unanswered}

Accuracy by tag:
${tags.length?tags.map(([t,v])=>`- ${t}: raw ${v.correct}/${v.total}; secure ${v.secure}/${v.total}`).join('\n'):'- none'}

Error causes:
${errs.length?errs.map(([e,n])=>`- ${errorLabel(e)}: ${n}`).join('\n'):'- none'}

Wrong questions:
${wrong.length?wrong.map((a,i)=>`${i+1}. ${a.prompt}
My answer: ${a.selected||'—'}
Correct/reference answer: ${a.answer||'—'}${a.type==='essay'?`
Essay self-assessment: ${a.selfAssessment||'—'}`:''}
Confidence: ${a.confidence}
Error: ${errorLabel(a.errorType)}
My note: ${a.note||'—'}
My comment: ${a.comment||'—'}
Tags: ${a.tags?.join(', ')||'—'}`).join('\n\n'):'None.'}

Question comments:
${comments.length?comments.map(a=>`- ${a.questionId}: ${a.comment}`).join('\n'):'- none'}

Use this evidence with the subject-chat materials. Diagnose whether I need concept teaching, method repair, fresh variants, timed fluency, interpretation repair, or a focus/carelessness intervention. Do not praise question volume by itself.`}
function pureResults(s){const c=confidenceStats(s);return `DBD PURE RESULTS

Campaign: ${s.campaign}
Subject: ${s.subject}
Topic: ${s.topic||'—'}
Source: ${s.source||'—'}
Test type: ${sessionTestType(s)}
Difficulty: ${s.difficulty||'—'}
Total questions: ${s.totalQuestions||s.answered}
Correct: ${s.correct}
Raw accuracy: ${Math.round(s.accuracy||0)}%
Secure correct: ${s.secureCorrect??c.sureCorrect}
Unanswered/skipped: ${s.unanswered??c.unanswered}${s.totalTime===null?'':`
Total active time: ${fmt(s.totalTime)}`}

${(s.attempts||[]).map((a,i)=>`QUESTION ${i+1}
${a.prompt}
Your answer: ${a.selected||'—'}
${a.type==='essay'?'Reference answer':'Correct answer'}: ${a.answer||'—'}
Result: ${a.correct?'Correct':a.status==='dontknow'?"Don't know":['skipped','unseen'].includes(a.status)?'Unanswered':a.timedOut?'Timed out':'Wrong'}${a.type==='essay'?`
Essay self-assessment: ${a.selfAssessment||'—'}`:''}
Confidence: ${a.confidence||'—'}
Time: ${s.timing==='off'?'Not recorded':fmt(a.elapsed)}
Tags: ${a.tags?.join(', ')||'—'}
Comment: ${a.comment||'—'}
Explanation: ${a.explanation||'—'}`).join('\n\n------------------------------\n\n')}`}
function summary(){const s=getSession(currentSessionId)||DATA.completedSessions[0];if(!s)return `<div class="empty">No completed session.</div>`;const tags=weakTagStats(s),errs=errorStats(s),total=s.totalQuestions||s.answered||1;return `<section class="summary-shell"><div class="score-hero"><div class="score-main">${s.correct}<span>/${total}</span></div><div class="score-percent">${Math.round(s.accuracy||0)}%</div><div class="score-caption">${esc(s.subject)}${s.topic?` · ${esc(s.topic)}`:''} · ${esc(sessionTestType(s))}</div></div><div class="summary-surface"><div class="report-tabs"><button class="report-tab active">SUMMARY</button><button class="report-tab" onclick="viewFullQuiz('${s.id}')">FULL QUIZ</button></div><section class="summary-section"><div class="summary-heading">Confidence</div>${confidenceVisual(s)}</section><section class="summary-section"><div class="summary-heading">Weak areas</div>${tags.length?`<div class="weak-list">${tags.map(([t,v],i)=>`<div class="weak-row"><div class="weak-rank">${i+1}</div><div class="weak-name">${esc(t)}<small>secure ${v.secure}/${v.total}</small></div><div class="weak-score">${v.correct}/${v.total}</div></div>`).join('')}</div>`:`<div class="quiet-success">No weak areas detected in this packet.</div>`}</section>${errs.length?`<section class="summary-section"><div class="summary-heading">Error causes</div><div class="error-list">${errs.map(([e,n])=>`<div class="error-row"><span>${esc(errorLabel(e))}</span><strong>${n}</strong></div>`).join('')}</div></section>`:''}<div class="result-actions"><button class="button primary" onclick="copyText(pureResults(getSession('${s.id}')),this,true)">COPY PURE RESULTS</button><button class="button" onclick="copyText(sessionReport(getSession('${s.id}')),this,true)">COPY DIAGNOSTICS</button></div><div class="compact-actions"><button class="button tiny" onclick="downloadJson('${s.id}')">JSON ↓</button><button class="button tiny" ${s.wrong?'':'disabled'} onclick="retrySession('${s.id}')">RETRY WRONG</button></div></div></section>`}
function choiceReview(q,a){if(!q.choices)return'';return `<div>${Object.entries(q.choices).map(([k,v])=>{let c='choice-review';if(norm(k)===norm(q.answer))c+=' correct-choice';if(k===a.selected&&!a.correct)c+=' user-wrong';return `<div class="${c}"><strong>${esc(k)}.</strong> ${esc(v)}${norm(k)===norm(q.answer)?' <span class="muted">— correct</span>':''}${k===a.selected?' <span class="muted">— your answer</span>':''}</div>`}).join('')}</div>`}
function quizReport(){const s=getSession(currentSessionId)||DATA.completedSessions[0];if(!s)return `<div class="empty">No completed session.</div>`;const qmap=new Map((s._packetQuestions||[]).map(q=>[q.id,q]));return `<section class="quiz-page"><div class="page-title-row"><div><div class="eyebrow">Complete evidence</div><h1>Full quiz</h1><p class="muted">${esc(s.subject)}${s.topic?` · ${esc(s.topic)}`:''}</p></div><div class="report-tabs"><button class="report-tab" onclick="viewSession('${s.id}')">SUMMARY</button><button class="report-tab active">FULL QUIZ</button></div></div><div class="quiz-tools"><button class="button tiny" onclick="toggleAllQuiz(true)">EXPAND ALL</button><button class="button tiny" onclick="toggleAllQuiz(false)">COLLAPSE ALL</button><button class="button tiny" onclick="downloadFullQuiz('${s.id}')">QUIZ .TXT ↓</button></div>${(s.attempts||[]).map((a,i)=>{const q=qmap.get(a.questionId)||a,status=['skipped','unseen'].includes(a.status)?'Unanswered':a.correct?'Correct':a.timedOut?'Timed out':a.status==='dontknow'?"Don't know":'Wrong',badge=a.correct?'correct':status==='Unanswered'?'unanswered':'wrong';return `<details class="quiz-card"><summary><span>Q${i+1} · ${esc((a.tags||[])[0]||a.difficulty||'Question')}</span><span class="result-badge ${badge}">${status}</span></summary><div class="quiz-body">${stimulusHTML(q.stimulus||a.stimulus)}<div class="question-text">${esc(q.prompt||a.prompt)}</div>${choiceReview(q,a)}${a.type==='essay'?`<div class="essay-review"><h4>Essay evidence</h4><strong>Your answer</strong><div class="essay-answer">${esc(a.selected||'—')}</div><div style="margin-top:9px"><strong>Reference answer</strong><div class="essay-answer">${esc(a.modelAnswer||a.answer||q.modelAnswer||'—')}</div></div>${(a.rubric||q.rubric||[]).length?`<ul class="essay-rubric">${(a.rubric||q.rubric).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p><strong>Self-assessment:</strong> ${esc(a.selfAssessment||'—')}</p></div>`:`<div class="quiz-answer ${a.correct?'good':'bad'}"><strong>Your answer:</strong> ${esc(a.selected||'—')}<br><strong>Correct answer:</strong> ${esc(a.answer||q.answer||'—')}<br><strong>Result:</strong> ${status}<br><strong>Confidence:</strong> ${esc(a.confidence||'—')}</div>`}<p><strong>Explanation:</strong> ${esc(a.explanation||q.explanation||'—')}</p>${!a.correct&&a.whyWrong&&a.whyWrong[a.selected]?`<p><strong>Your selected trap:</strong> ${esc(a.whyWrong[a.selected])}</p>`:''}<p>${a.errorType&&a.errorType!=='unclassified'?`<strong>Error type:</strong> ${esc(errorLabel(a.errorType))}<br>`:''}<strong>Time:</strong> ${s.timing==='off'?'Not recorded':fmt(a.elapsed)}${a.timeLimitSeconds?` / limit ${fmt(a.timeLimitSeconds)}`:''}<br><strong>Tags:</strong> ${esc(a.tags?.join(', ')||'—')}<br><strong>Your note:</strong> ${esc(a.note||'—')}<br><strong>Your comment:</strong> ${esc(a.comment||'—')}</p></div></details>`}).join('')}</section>`}
function toggleAllQuiz(open){document.querySelectorAll('.quiz-card').forEach(d=>d.open=open)}
function fullQuizText(s){return (s.attempts||[]).map((a,i)=>`QUESTION ${i+1}\n${a.prompt}\n\nYour answer: ${a.selected||'—'}\nCorrect answer: ${a.answer||'—'}\nResult: ${a.correct?'Correct':a.status==='dontknow'?"Don't know":['skipped','unseen'].includes(a.status)?'Unanswered':'Wrong'}\nConfidence: ${a.confidence||'—'}\nExplanation: ${a.explanation||'—'}\nError type: ${errorLabel(a.errorType)}\nTime: ${s.timing==='off'?'Not recorded':fmt(a.elapsed)}\nTags: ${a.tags?.join(', ')||'—'}\nNote: ${a.note||'—'}\nComment: ${a.comment||'—'}\n`).join('\n------------------------------\n\n')}
function historyDateLabel(value){const d=new Date(value),today=localDay(),yesterday=localDay(new Date(Date.now()-86400000)),key=localDay(d);if(key===today)return'TODAY';if(key===yesterday)return'YESTERDAY';return d.toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}).toUpperCase()}
function setHistorySubject(v){historySubjectFilter=v;render()}
function setHistorySort(v){historySort=v;render()}
function history(){const subjects=[...new Set(DATA.completedSessions.map(s=>s.subject).filter(Boolean))].sort(),filtered=DATA.completedSessions.filter(s=>historySubjectFilter==='all'||s.subject===historySubjectFilter).slice().sort((a,b)=>historySort==='oldest'?new Date(a.completedAt)-new Date(b.completedAt):new Date(b.completedAt)-new Date(a.completedAt));let lastGroup=null,body='';filtered.forEach(s=>{const group=historyDateLabel(s.completedAt),total=s.totalQuestions||s.answered||1,secure=s.secureCorrect??confidenceStats(s).sureCorrect,percent=Math.round(s.accuracy||0);if(group!==lastGroup){body+=`<div class="history-date">${esc(group)}</div>`;lastGroup=group}body+=`<article class="history-card" onclick="viewSession('${s.id}')"><div class="history-card-top"><div><div class="history-subject">${esc(s.subject)}</div><div class="history-topic">${esc(s.topic||'Untitled drill')}</div><div class="history-meta">${esc(sessionTestType(s))} · ${new Date(s.completedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div><div class="history-percent">${percent}%</div></div><div class="history-scoreline"><strong>${s.correct}/${total}</strong><span>secure ${secure}/${total}</span><span>${s.totalTime===null?'timing off':fmt(s.totalTime)}</span></div><div class="history-progress"><span style="width:${percent}%"></span></div><div class="history-card-actions"><span>View summary ›</span><button class="text-action" onclick="event.stopPropagation();viewFullQuiz('${s.id}')">Full quiz</button></div></article>`});return `<section class="history-page"><div class="page-title-row"><div><div class="eyebrow">Performance record</div><h1>History</h1></div><div class="history-filters"><select onchange="setHistorySubject(this.value)"><option value="all">All subjects</option>${subjects.map(x=>`<option value="${esc(x)}" ${historySubjectFilter===x?'selected':''}>${esc(x)}</option>`).join('')}</select><select onchange="setHistorySort(this.value)"><option value="newest" ${historySort==='newest'?'selected':''}>Newest</option><option value="oldest" ${historySort==='oldest'?'selected':''}>Oldest</option></select></div></div>${filtered.length?body:`<div class="empty">No completed drills match this filter.</div>`}</section>`}
function retrySession(id){const s=getSession(id),qmap=new Map((s._packetQuestions||[]).map(q=>[q.id,q])),qs=(s.attempts||[]).filter(a=>!a.correct&&a.status!=='skipped'&&a.status!=='unseen').map(a=>qmap.get(a.questionId)).filter(Boolean);if(!qs.length){alert('No retryable wrong questions.');return}const newId=makeUid('retry'),a={id:newId,packet:{campaign:s.campaign,subject:s.subject,topic:s.topic,source:s.source,testType:'repair',workingStyle:s.workingStyle,answerFormat:s.answerFormat,difficulty:s.difficulty,questions:qs},setupSnapshot:{...DATA.setup,testType:'repair',workingStyle:s.workingStyle||'full',answerFormat:s.answerFormat||'mixed',feedback:'immediate',timing:'off'},responses:qs.map(()=>newResponse()),currentIndex:0,startedAt:Date.now(),lastOpenedAt:Date.now(),liveStartedAt:null,paused:false,retryKind:'wrong'};DATA.activeSessions.push(a);DATA.currentActiveId=newId;save();route('drill')}
function download(name,text,type='text/plain'){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function slug(s){return String(s||'dbd').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function downloadTxt(id){const s=getSession(id);download(`dbd-${slug(s.subject)}-summary.txt`,sessionReport(s))}
function downloadJson(id){const s=getSession(id);download(`dbd-${slug(s.subject)}-report.json`,JSON.stringify(s,null,2),'application/json')}
function downloadFullQuiz(id){const s=getSession(id);download(`dbd-${slug(s.subject)}-full-quiz.txt`,fullQuizText(s))}
async function persistent(){if(!navigator.storage?.persist){alert('Persistent storage requests are not supported here.');return}DATA.settings.persistentStorageGranted=await navigator.storage.persist();save();alert(DATA.settings.persistentStorageGranted?'Persistent browser storage granted.':'Normal browser storage remains active.');render()}
function vaultPayload(){save();return{format:'dbd-vault',vaultVersion:1,exportedAt:new Date().toISOString(),sourceDeviceId:DATA.settings.deviceId,data:DATA}}
function exportVault(){DATA.vault.lastExportedAt=new Date().toISOString();save();download(`dbd-gazali-vault-${localDay()}.dbd.json`,JSON.stringify(vaultPayload(),null,2),'application/json')}
function mergeById(current,incoming){const map=new Map();for(const x of current||[])if(x?.id)map.set(x.id,x);for(const x of incoming||[]){if(!x?.id)continue;const prev=map.get(x.id);if(!prev){map.set(x.id,x);continue}const pt=new Date(prev.completedAt||prev.lastOpenedAt||prev.startedAt||0).getTime(),it=new Date(x.completedAt||x.lastOpenedAt||x.startedAt||0).getTime();if(it>=pt)map.set(x.id,x)}return [...map.values()]}
function mergeVaultData(incoming){const d=normalizeFutureData({...emptyData(),...incoming,setup:migrateSetup(incoming.setup),completedSessions:Array.isArray(incoming.completedSessions)?incoming.completedSessions:[],activeSessions:Array.isArray(incoming.activeSessions)?incoming.activeSessions:[],settings:{...emptyData().settings,...(incoming.settings||{})}});DATA.completedSessions=mergeById(DATA.completedSessions,d.completedSessions);DATA.activeSessions=mergeById(DATA.activeSessions,d.activeSessions);const bankMap=new Map((DATA.questionBank||[]).map(q=>[q.uid||q.id,q]));for(const q of d.questionBank||[])bankMap.set(q.uid||q.id,q);DATA.questionBank=[...bankMap.values()];const saMap=new Map((DATA.streamPrototype?.attempts||[]).map(a=>[a.id,a]));for(const a of d.streamPrototype?.attempts||[])if(a?.id)saMap.set(a.id,a);DATA.streamPrototype=DATA.streamPrototype||{attempts:[],seen:{}};DATA.streamPrototype.attempts=[...saMap.values()];DATA.streamPrototype.seen={...(DATA.streamPrototype.seen||{})};for(const [k,v] of Object.entries(d.streamPrototype?.seen||{}))DATA.streamPrototype.seen[k]=Math.max(DATA.streamPrototype.seen[k]||0,Number(v)||0);if(!DATA.pendingPacket&&d.pendingPacket)DATA.pendingPacket=d.pendingPacket;DATA.streams=collectStreams({...DATA,streams:[...(DATA.streams||[]),...(d.streams||[])]});DATA.vault.lastMergedAt=new Date().toISOString();recomputeStatistics(DATA);normalizeFutureData(DATA);save()}
function mergeVault(){const i=document.createElement('input');i.type='file';i.accept='.json,.dbd,application/json';i.onchange=async()=>{try{const raw=JSON.parse(await i.files[0].text()),incoming=raw?.format==='dbd-vault'?raw.data:raw;if(!incoming||!Array.isArray(incoming.completedSessions))throw new Error('This file is not a valid DBD Vault or backup.');const before=DATA.completedSessions.length;mergeVaultData(incoming);alert(`Vault merged. ${Math.max(0,DATA.completedSessions.length-before)} new completed session(s) added. Existing session IDs were deduplicated.`);route('data')}catch(e){alert(e.message||'Vault merge failed.')}};i.click()}
function exportBackup(){exportVault()}
function importBackup(){const i=document.createElement('input');i.type='file';i.accept='.json,.dbd,application/json';i.onchange=async()=>{try{const raw=JSON.parse(await i.files[0].text()),p=raw?.format==='dbd-vault'?raw.data:raw;if(!p||!Array.isArray(p.completedSessions))throw new Error('Invalid DBD backup.');const d=emptyData();DATA=normalizeFutureData({...d,...p,appVersion:APP_VERSION,setup:migrateSetup(p.setup),statistics:{...d.statistics,...(p.statistics||{})},completedSessions:p.completedSessions,activeSessions:Array.isArray(p.activeSessions)?p.activeSessions:(p.activeSession?[migrateLegacyActive(p.activeSession)].filter(Boolean):[]),currentActiveId:p.currentActiveId||null,dailyState:p.dailyState||{},streams:Array.isArray(p.streams)?p.streams:[],questionBank:Array.isArray(p.questionBank)?p.questionBank:[],streamPrototype:p.streamPrototype||{attempts:[],seen:{}},vault:p.vault||{},settings:{...d.settings,...(p.settings||{}),deviceId:DATA.settings.deviceId}});recomputeStatistics(DATA);save();alert('Backup replaced this browser data.');route('home')}catch(e){alert(e.message||'Import failed.')}};i.click()}
function resetData(){if(confirm('Delete all DBD progress from this browser?')){DATA=emptyData();save();route('home')}}
function dataView(){const bytes=new Blob([JSON.stringify(DATA)]).size,size=bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`,persistentState=DATA.settings.persistentStorageGranted?'Granted':'Normal browser storage',conceptCount=Object.keys(DATA.conceptEvidence||{}).length,streamCount=(DATA.streams||[]).length,deviceShort=String(DATA.settings.deviceId||'').split('_').pop()?.slice(0,8)||'local';return `<section class="data-page"><div class="eyebrow">Local-first · v1 preview</div><h1>Data</h1><div class="settings-group"><div class="settings-title">Storage</div><div class="settings-row"><div><strong>Browser-local database</strong><small>dbd_gazali · device ${esc(deviceShort)}</small></div><span class="status-ok">ACTIVE</span></div><div class="settings-row"><div><strong>Persistent storage</strong><small>Helps reduce browser eviction risk</small></div><button class="text-action" onclick="persistent()">${esc(persistentState)}</button></div></div><div class="settings-group"><div class="settings-title">DBD Vault</div><p class="note">v0.9.6+ uses a mergeable local Vault for moving DBD evidence between devices without accounts or a cloud database. Export on one device, then merge on another.</p><div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div><details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><p class="note">Unlike Merge Vault, this replaces the current browser's DBD data with the selected backup.</p><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details></div><div class="settings-group"><div class="settings-title">Version 1 foundation</div><div class="metric-row"><span>Detected Streams</span><strong>${streamCount}</strong></div><div class="metric-row"><span>Concept tags with evidence</span><strong>${conceptCount}</strong></div><div class="metric-row"><span>Future question-bank inventory</span><strong>${(DATA.questionBank||[]).length}</strong></div><div class="metric-row"><span>Prototype Stream answers</span><strong>${(DATA.streamPrototype?.attempts||[]).length}</strong></div><p class="note">v0.9.7 exposes the first visible Stream / Session / Subjects architecture. Stream currently reuses eligible historical MCQs as a safe True/False prototype; the real v1 scheduler and dedicated bank inventory remain reserved for v1.0.</p></div><div class="settings-group"><div class="settings-title">Local storage info</div><div class="metric-row"><span>Completed sessions</span><strong>${DATA.completedSessions.length}</strong></div><div class="metric-row"><span>Ongoing sessions</span><strong>${DATA.activeSessions.length}</strong></div><div class="metric-row"><span>Packet waiting</span><strong>${DATA.pendingPacket?'1':'0'}</strong></div><div class="metric-row"><span>Approx. DBD data</span><strong>${size}</strong></div></div><div class="settings-group danger-zone"><div class="settings-title">Danger zone</div><div class="settings-row"><div><strong>Reset all DBD data</strong><small>Deletes sessions, history, settings, evidence, and pending packets from this browser.</small></div><button class="button danger small" onclick="resetData()">RESET</button></div></div><p class="data-footnote">No accounts, cloud database, Supabase, or direct ChatGPT integration.</p></section>`}

/* ================= DBD v0.9.8 BETA ENGINE ================= */
function subjectBaseKey(name){let s=String(name||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');s=s.replace(/\b(osn|olimpiade|sma|smk|madrasah|kelas\s*(?:xii|xi|x|12|11|10))\b/gi,' ');s=s.replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-');return s||streamIdFromName(name)}
function cleanCanonicalName(name){let s=String(name||'').replace(/\b(OSN|OLIMPIADE|SMA|SMK|MADRASAH|KELAS\s*(?:XII|XI|X|12|11|10))\b/gi,' ').replace(/\s+/g,' ').trim();return s||String(name||'Custom')}
function aliasNorm(v){return norm(v).replace(/[._-]+/g,' ')}
function allSubjectLabels(data){const out=[];const add=v=>{if(v&&String(v).trim())out.push(String(v).trim())};(data.completedSessions||[]).forEach(s=>add(s.subject));(data.activeSessions||[]).forEach(a=>add(a.packet?.subject));if(data.pendingPacket?.packet)add(data.pendingPacket.packet.subject);(data.streams||[]).forEach(s=>add(s.name));(data.questionBank||[]).forEach(q=>add(q.subjectName||q.subject));(data.conceptManifests||[]).forEach(m=>add(m.subjectName));return [...new Set(out)]}
function ensureSubjectRegistry(data){let reg=Array.isArray(data.subjectRegistry)?data.subjectRegistry.map(x=>({...x,aliases:Array.isArray(x.aliases)?x.aliases:[],active:x.active!==false,priority:['low','normal','high'].includes(x.priority)?x.priority:'normal'})):[];const labels=allSubjectLabels(data);for(const labelText of labels){const n=aliasNorm(labelText),base=subjectBaseKey(labelText);let item=reg.find(r=>(r.aliases||[]).some(a=>aliasNorm(a)===n)||aliasNorm(r.name)===n);if(!item)item=reg.find(r=>r.autoKey===base||subjectBaseKey(r.name)===base);if(!item){item={id:`subject_${base}`,name:cleanCanonicalName(labelText),autoKey:base,aliases:[],active:true,priority:'normal',manual:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};reg.push(item)}if(!item.aliases.some(a=>aliasNorm(a)===n))item.aliases.push(labelText);if(!item.manual){const candidates=[item.name,...item.aliases].map(cleanCanonicalName).filter(Boolean).sort((a,b)=>a.length-b.length);if(candidates[0])item.name=candidates[0]}item.updatedAt=item.updatedAt||new Date().toISOString()}
  // Merge obvious auto duplicates by base key while preserving manual entries.
  const grouped=new Map();for(const r of reg){const key=r.manual?`manual:${r.id}`:(r.autoKey||subjectBaseKey(r.name));if(!grouped.has(key)){grouped.set(key,{...r,aliases:[...(r.aliases||[])]});continue}const t=grouped.get(key);t.aliases=[...new Set([...(t.aliases||[]),r.name,...(r.aliases||[])])];t.active=t.active||r.active;t.priority=t.priority==='high'||r.priority==='high'?'high':t.priority==='low'&&r.priority==='low'?'low':'normal'}
  data.subjectRegistry=[...grouped.values()];return data.subjectRegistry}
function resolveSubjectRecord(labelText,data=DATA){if(!data?.subjectRegistry)return null;const n=aliasNorm(labelText),base=subjectBaseKey(labelText);return data.subjectRegistry.find(r=>aliasNorm(r.name)===n||(r.aliases||[]).some(a=>aliasNorm(a)===n))||data.subjectRegistry.find(r=>(r.autoKey||subjectBaseKey(r.name))===base)||null}
function resolveSubjectId(labelText,data=DATA){return resolveSubjectRecord(labelText,data)?.id||`subject_${subjectBaseKey(labelText)}`}
function subject(id=DATA?.setup?.subjectId){const dynamic=DATA?.subjectRegistry?.find(s=>s.id===id);if(dynamic)return{id:dynamic.id,campaign:'Custom',name:dynamic.name};return SUBJECTS.find(x=>x.id===id)||SUBJECTS[0]}
function emptyData(){return{appVersion:APP_VERSION,schemaVersion:DATA_SCHEMA_VERSION,profile:{name:'Gazali Darmawan',grade:'Grade 11',className:'Science 2'},setup:{subjectId:'matlan',testType:'coverage',workingStyle:'concept',answerFormat:'mcq',count:5,difficulty:'Adaptive',feedback:'immediate',timing:'off',showTimer:true,focus:''},statistics:{answered:0,correct:0,wrong:0},completedSessions:[],activeSessions:[],currentActiveId:null,pendingPacket:null,dailyState:{},streams:[],subjectRegistry:[],conceptManifests:[],questionBank:[],conceptEvidence:{},streamPrototype:{attempts:[],seen:{}},streamEngine:{attempts:[],questionSeen:{},recentConceptIds:[],burst:{count:0,correct:0,startedAt:null}},scheduler:{burstSize:5},vault:{lastMergedAt:null,lastExportedAt:null},settings:{persistentStorageGranted:false,deviceId:makeUid('device')}}}
function normalizeManifestList(data){data.conceptManifests=Array.isArray(data.conceptManifests)?data.conceptManifests:[];data.conceptManifests=data.conceptManifests.map(m=>({...m,revision:Number(m.revision)||1,concepts:Array.isArray(m.concepts)?m.concepts:[]}));return data.conceptManifests}
function normalizeFutureData(data){data.schemaVersion=DATA_SCHEMA_VERSION;data.settings={persistentStorageGranted:false,deviceId:makeUid('device'),...(data.settings||{})};if(!data.settings.deviceId)data.settings.deviceId=makeUid('device');data.vault={lastMergedAt:null,lastExportedAt:null,...(data.vault||{})};data.scheduler={burstSize:5,...(data.scheduler||{})};data.completedSessions=(data.completedSessions||[]).map(s=>({...s,id:s.id||makeUid('session'),stream:s.stream||{id:streamIdFromName(s.subject),name:String(s.subject||'Custom')}}));data.activeSessions=(data.activeSessions||[]).map(a=>({...a,id:a.id||makeUid('session'),packet:ensurePacketIdentity(a.packet)}));if(data.pendingPacket?.packet)data.pendingPacket.packet=ensurePacketIdentity(data.pendingPacket.packet);data.questionBank=Array.isArray(data.questionBank)?data.questionBank:[];data.streamPrototype=data.streamPrototype&&typeof data.streamPrototype==='object'?data.streamPrototype:{attempts:[],seen:{}};data.streamPrototype.attempts=Array.isArray(data.streamPrototype.attempts)?data.streamPrototype.attempts:[];data.streamPrototype.seen=data.streamPrototype.seen&&typeof data.streamPrototype.seen==='object'?data.streamPrototype.seen:{};data.streamEngine=data.streamEngine&&typeof data.streamEngine==='object'?data.streamEngine:{attempts:[],questionSeen:{},recentConceptIds:[],burst:{count:0,correct:0,startedAt:null}};data.streamEngine.attempts=Array.isArray(data.streamEngine.attempts)?data.streamEngine.attempts:[];data.streamEngine.questionSeen=data.streamEngine.questionSeen&&typeof data.streamEngine.questionSeen==='object'?data.streamEngine.questionSeen:{};data.streamEngine.recentConceptIds=Array.isArray(data.streamEngine.recentConceptIds)?data.streamEngine.recentConceptIds:[];data.streamEngine.burst={count:0,correct:0,startedAt:null,...(data.streamEngine.burst||{})};normalizeManifestList(data);ensureSubjectRegistry(data);data.streams=data.subjectRegistry.map(r=>({id:r.id,name:r.name,campaign:'Custom',active:r.active!==false,priority:r.priority||'normal'}));data.conceptEvidence=rebuildConceptEvidence(data);return data}
function canonicalSessions(subjectId){return (DATA.completedSessions||[]).filter(s=>resolveSubjectId(s.subject)===subjectId)}
function tagRecords(subjectId){const map=new Map();for(const s of canonicalSessions(subjectId)){const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));for(const a of s.attempts||[]){const q=qmap.get(String(a.questionId))||a,tags=[...new Set([...(q.tags||[]),...(a.tags||[])].map(x=>String(x).trim()).filter(Boolean))];for(const tag of tags){const k=aliasNorm(tag);if(!map.has(k))map.set(k,{key:k,name:tag,count:0,questions:new Set(),lastSeenAt:null});const r=map.get(k);r.count++;r.questions.add(`${s.id}:${a.questionId}`);r.lastSeenAt=s.completedAt||r.lastSeenAt}}}return [...map.values()]}
function manifestForSubject(subjectId){return (DATA.conceptManifests||[]).filter(m=>m.subjectId===subjectId).sort((a,b)=>(Number(b.revision)||0)-(Number(a.revision)||0)||new Date(b.importedAt||0)-new Date(a.importedAt||0))[0]||null}
function conceptAliasMap(subjectId){const m=manifestForSubject(subjectId),map=new Map();if(!m)return map;for(const c of m.concepts||[]){const vals=[c.id,c.name,...(c.aliases||[])];for(const v of vals)if(v)map.set(aliasNorm(v),c.id)}return map}
function stableLegacyConceptId(tag){return `legacy_${streamIdFromName(tag)}_${simpleHash(aliasNorm(tag)).toString(36).slice(0,5)}`}
function inferLegacyConcepts(subjectId){const recs=tagRecords(subjectId),nodes=recs.map(r=>({id:stableLegacyConceptId(r.name),name:r.name,parentId:null,aliases:[r.name],kind:'concept',provisional:true,count:r.count,questionSet:r.questions}));for(const child of nodes){let best=null,bestCount=Infinity;for(const parent of nodes){if(parent.id===child.id||parent.count<=child.count)continue;let overlap=0;for(const q of child.questionSet)if(parent.questionSet.has(q))overlap++;const containment=child.questionSet.size?overlap/child.questionSet.size:0;if(containment>=.78&&parent.count<bestCount){best=parent;bestCount=parent.count}}if(best)child.parentId=best.id}return nodes.map(({questionSet,...x})=>x)}
function subjectConceptModel(subjectId){const m=manifestForSubject(subjectId),tags=tagRecords(subjectId);if(!m)return{concepts:inferLegacyConcepts(subjectId),canonical:false,unresolved:tags.length,revision:0};const aliasMap=conceptAliasMap(subjectId),concepts=(m.concepts||[]).map(c=>({...c,provisional:false})),unresolved=tags.filter(t=>!aliasMap.has(t.key));if(unresolved.length){const rootId=`legacy_unresolved_${subjectId}`;concepts.push({id:rootId,name:'Legacy / unresolved',parentId:null,kind:'container',provisional:true});for(const t of unresolved)concepts.push({id:stableLegacyConceptId(t.name),name:t.name,parentId:rootId,aliases:[t.name],kind:'concept',provisional:true,count:t.count})}return{concepts,canonical:true,unresolved:unresolved.length,revision:m.revision||1}}
function resolveConceptRef(subjectId,ref){if(!ref)return null;const m=manifestForSubject(subjectId),n=aliasNorm(ref);if(m){const c=(m.concepts||[]).find(x=>x.id===ref||aliasNorm(x.name)===n||(x.aliases||[]).some(a=>aliasNorm(a)===n));if(c)return c.id}const legacy=subjectConceptModel(subjectId).concepts.find(c=>c.id===ref||aliasNorm(c.name)===n||(c.aliases||[]).some(a=>aliasNorm(a)===n));return legacy?.id||stableLegacyConceptId(ref)}
function attemptWeight(session,a){const type=deriveLegacyTestType(session),typeW={coverage:.8,focused:1,deep:1.12,repair:1.05,mastery:1.25,exam:1.3}[type]||1,confW=a.status==='dontknow'?1:a.confidence==='sure'?1:a.confidence==='unsure'?.72:a.confidence==='guess'?.48:1,diffW=String(a.difficulty||'').toLowerCase()==='hard'?1.12:String(a.difficulty||'').toLowerCase()==='easy'?.88:1;return typeW*confW*diffW}
function conceptRefsForAttempt(subjectId,session,a,q){const explicit=[q?.primaryConceptId,q?.primary_concept_id,...(q?.conceptIds||q?.concept_ids||[])].filter(Boolean),tags=[...(q?.tags||[]),...(a?.tags||[])].filter(Boolean);const refs=(explicit.length?explicit:tags).map(x=>resolveConceptRef(subjectId,x)).filter(Boolean);return [...new Set(refs)]}
function conceptEvidenceV3(subjectId){const model=subjectConceptModel(subjectId),map=new Map(model.concepts.map(c=>[c.id,{concept:c,seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,weightedPositive:0,weightedTotal:0,questionIds:new Set(),days:new Set(),lastSeenAt:null,sources:{session:0,stream:0}}]));const ensure=id=>{if(!map.has(id))map.set(id,{concept:{id,name:id,parentId:null,provisional:true},seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,weightedPositive:0,weightedTotal:0,questionIds:new Set(),days:new Set(),lastSeenAt:null,sources:{session:0,stream:0}});return map.get(id)};for(const s of canonicalSessions(subjectId)){const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));for(const a of s.attempts||[]){const q=qmap.get(String(a.questionId))||a,refs=conceptRefsForAttempt(subjectId,s,a,q);if(!refs.length)continue;const base=attemptWeight(s,a),primary=resolveConceptRef(subjectId,q?.primaryConceptId||q?.primary_concept_id||null);for(const id of refs){const e=ensure(id),w=base*(primary&&id!==primary?.7:explicitConceptWeight(refs.length));e.seen++;if(a.correct)e.correct++;else if(!['skipped','unseen'].includes(a.status))e.wrong++;if(a.correct&&a.confidence==='sure')e.secureCorrect++;if(a.confidence==='unsure')e.unsure++;if(a.confidence==='guess')e.guess++;if(a.status==='dontknow')e.dontKnow++;if(a.status==='skipped')e.skipped++;if(!['skipped','unseen'].includes(a.status)){e.weightedTotal+=w;e.weightedPositive+=a.correct?w:0}e.questionIds.add(`${s.id}:${a.questionId}`);if(s.completedAt){e.days.add(localDay(new Date(s.completedAt)));if(!e.lastSeenAt||new Date(s.completedAt)>new Date(e.lastSeenAt))e.lastSeenAt=s.completedAt}e.sources.session++}}}
  for(const a of DATA.streamEngine?.attempts||[]){if(a.subjectId!==subjectId)continue;for(const id of a.conceptIds||[]){const e=ensure(id),w=.72;e.seen++;if(a.correct)e.correct++;else e.wrong++;if(a.correct&&a.confidence==='sure')e.secureCorrect++;e.weightedTotal+=w;e.weightedPositive+=a.correct?w:0;e.questionIds.add(a.questionUid);if(a.answeredAt){e.days.add(localDay(new Date(a.answeredAt)));if(!e.lastSeenAt||new Date(a.answeredAt)>new Date(e.lastSeenAt))e.lastSeenAt=a.answeredAt}e.sources.stream++}}
  return [...map.values()].map(e=>({...e,questionVariety:e.questionIds.size,dayVariety:e.days.size,questionIds:undefined,days:undefined,state:conceptState(e)}))}
function explicitConceptWeight(n){return n<=1?1:.82}
function conceptState(e){if(!e.seen)return'new';const ratio=e.weightedTotal?e.weightedPositive/e.weightedTotal:e.correct/Math.max(1,e.seen),wrongRate=e.wrong/Math.max(1,e.seen);if(e.dontKnow>0||wrongRate>=.45)return'weak';if(ratio>=.8&&e.secureCorrect>=2&&e.questionIds?.size>=2&&e.days?.size>=2)return'secure';if(ratio>=.82&&e.secureCorrect>=3&&e.seen>=4)return'secure';return'shaky'}
function dueIntervalDays(state){return state==='secure'?7:state==='shaky'?1:state==='weak'?.25:0}
function daysSince(iso){if(!iso)return 999;return Math.max(0,(Date.now()-new Date(iso).getTime())/86400000)}
function conceptPriority(e,subjectRec){const stateBase={new:95,weak:88,shaky:62,secure:18}[e.state]||50,overdue=Math.max(0,daysSince(e.lastSeenAt)-dueIntervalDays(e.state)),uncert=((e.unsure||0)*2+(e.guess||0)*2.5+(e.dontKnow||0)*4)/Math.max(1,e.seen),recent=(DATA.streamEngine?.recentConceptIds||[]).filter(id=>id===e.concept.id).length*22,weight=subjectRec?.priority==='high'?1.3:subjectRec?.priority==='low'?.72:1;return (stateBase+Math.min(42,overdue*7)+uncert*6-recent)*weight}
function canonicalInventoryForSubject(subjectId){return (DATA.questionBank||[]).filter(q=>q.subjectId===subjectId&&q.streamEligible!==false)}
function historicalCardsForSubject(subjectId){return historicalStreamCandidates().filter(c=>resolveSubjectId(c.subject)===subjectId)}
function cardConceptIds(card,subjectId){return [...new Set((card.tags||[]).map(t=>resolveConceptRef(subjectId,t)).filter(Boolean))]}
function schedulerPick(){const subjects=(DATA.subjectRegistry||[]).filter(s=>s.active!==false);let picks=[];for(const s of subjects){const ev=conceptEvidenceV3(s.id),bank=canonicalInventoryForSubject(s.id),hist=historicalCardsForSubject(s.id);for(const e of ev){const bankCount=bank.filter(q=>(q.conceptIds||[]).includes(e.concept.id)||q.primaryConceptId===e.concept.id).length,histCount=hist.filter(c=>cardConceptIds(c,s.id).includes(e.concept.id)).length;if(bankCount+histCount===0)continue;picks.push({subject:s,e,score:conceptPriority(e,s),bankCount,histCount})}}if(!picks.length)return null;picks.sort((a,b)=>b.score-a.score||a.e.seen-b.e.seen);const pick=picks[0],cid=pick.e.concept.id,bank=canonicalInventoryForSubject(pick.subject.id).filter(q=>(q.conceptIds||[]).includes(cid)||q.primaryConceptId===cid);let item=null;if(bank.length){const seen=DATA.streamEngine?.questionSeen||{};bank.sort((a,b)=>(seen[a.uid]||0)-(seen[b.uid]||0)||simpleHash(a.uid)-simpleHash(b.uid));const q=bank[0];item=bankQuestionToStreamCard(q,pick.subject,pick.e.concept)}else{const hist=historicalCardsForSubject(pick.subject.id).filter(c=>cardConceptIds(c,pick.subject.id).includes(cid));const seen=DATA.streamEngine?.questionSeen||{};hist.sort((a,b)=>(seen[`hist:${a.id}`]||0)-(seen[`hist:${b.id}`]||0)||simpleHash(a.id)-simpleHash(b.id));const c=hist[0];item={...c,uid:`hist:${c.id}`,subjectId:pick.subject.id,subjectName:pick.subject.name,conceptIds:cardConceptIds(c,pick.subject.id),primaryConceptId:cid,conceptName:pick.e.concept.name,sourceType:'history'}}return item?{...item,conceptState:pick.e.state,priorityScore:pick.score}:null}
function bankQuestionToStreamCard(q,subjectRec,concept){if(q.type==='true_false'||q.type==='stream_statement'){const truth=typeof q.answer==='boolean'?q.answer:['true','t','benar','yes','1'].includes(norm(q.answer));return{uid:q.uid,subjectId:q.subjectId,subjectName:subjectRec.name,conceptIds:q.conceptIds||[],primaryConceptId:q.primaryConceptId||concept.id,conceptName:concept.name,prompt:q.statement||q.prompt||'',proposed:null,truth,explanation:q.explanation||'',sourceType:'bank'}}if(q.choices&&typeof q.choices==='object'){const correctKey=String(q.answer),keys=Object.keys(q.choices),wrong=keys.filter(k=>k!==correctKey),n=DATA.streamEngine?.questionSeen?.[q.uid]||0,truth=(simpleHash(q.uid+':'+n)%2)===0||!wrong.length,key=truth?correctKey:wrong[simpleHash(q.uid+':wrong:'+n)%wrong.length];return{uid:q.uid,subjectId:q.subjectId,subjectName:subjectRec.name,conceptIds:q.conceptIds||[],primaryConceptId:q.primaryConceptId||concept.id,conceptName:concept.name,prompt:q.prompt||'',proposed:String(q.choices[key]??key),truth,explanation:q.explanation||'',sourceType:'bank'}}return null}
function answerSmartStream(value){const pick=streamFeedback?.card||schedulerPick();if(!pick||streamFeedback)return;const correct=Boolean(value)===Boolean(pick.truth),now=new Date().toISOString();DATA.streamEngine=DATA.streamEngine||{attempts:[],questionSeen:{},recentConceptIds:[],burst:{count:0,correct:0,startedAt:null}};DATA.streamEngine.questionSeen[pick.uid]=(DATA.streamEngine.questionSeen[pick.uid]||0)+1;DATA.streamEngine.recentConceptIds=[pick.primaryConceptId,...DATA.streamEngine.recentConceptIds].filter(Boolean).slice(0,6);DATA.streamEngine.attempts.push({id:makeUid('stream'),questionUid:pick.uid,subjectId:pick.subjectId,conceptIds:pick.conceptIds?.length?pick.conceptIds:[pick.primaryConceptId],primaryConceptId:pick.primaryConceptId,answeredAt:now,selected:Boolean(value),correct,confidence:'sure',sourceType:pick.sourceType});DATA.streamEngine.attempts=DATA.streamEngine.attempts.slice(-5000);const b=DATA.streamEngine.burst;b.count=(b.count||0)+1;b.correct=(b.correct||0)+(correct?1:0);b.startedAt=b.startedAt||now;streamFeedback={card:pick,correct,selected:Boolean(value)};save();render();setTimeout(()=>{if(streamFeedback?.card?.uid===pick.uid){streamFeedback=null;render()}},720)}
function resetBurst(){DATA.streamEngine.burst={count:0,correct:0,startedAt:new Date().toISOString()};streamDismissed=false;save();render()}
function dismissBurst(){streamDismissed=true;render()}
function streamHome(){const b=DATA.streamEngine?.burst||{count:0,correct:0},size=Math.max(1,Number(DATA.scheduler?.burstSize)||5);if(streamDismissed)return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Concept-first scheduler · beta</span></div><div class="stream-empty stream-ready"><div><strong>Stream ready.</strong><small>Start another ${size}-question Burst whenever you want.</small></div><button class="button tiny" onclick="resetBurst()">START</button></div></section>`;if(b.count>=size&&!streamFeedback)return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Burst complete</span></div><div class="stream-card smart"><div class="burst-done"><strong>${b.correct}/${b.count}</strong><p>${b.count} retrievals completed. DBD has already updated concept evidence.</p><div class="burst-actions"><button class="button" onclick="dismissBurst()">DONE</button><button class="button primary" onclick="resetBurst()">${size} MORE</button></div></div></div></section>`;const pick=streamFeedback?.card||schedulerPick();if(!pick)return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Concept-first scheduler · beta</span></div><div class="stream-empty">No schedulable retrieval is available yet. Historical evidence can build the concept model, but Stream also needs at least one eligible historical MCQ or imported Question Bank item.</div></section>`;if(streamFeedback?.card){const expected=pick.truth?'TRUE':'FALSE';return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${esc(pick.subjectName||pick.subject)}</span></div><div class="stream-card smart"><div class="stream-feedback ${streamFeedback.correct?'good':'bad'}"><div><strong>${streamFeedback.correct?'CORRECT ✓':'NOT QUITE'}</strong><small>${esc(pick.conceptName||'Concept')} · correct response: ${expected}</small></div><div class="stream-next-indicator">Updating evidence…</div></div></div></section>`}return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${b.count+1} / ${size} · scheduler beta</span></div><div class="stream-card smart"><div class="stream-intent"><span class="stream-state ${pick.conceptState}">${esc(pick.conceptState)}</span><span class="stream-concept">${esc(pick.subjectName||pick.subject)} · ${esc(pick.conceptName||'Legacy concept')}</span></div><div class="stream-prompt">${esc(pick.prompt)}</div>${pick.proposed!==null&&pick.proposed!==undefined?`<div class="stream-proposal"><small>Proposed answer</small><strong>${esc(pick.proposed)}</strong></div>`:''}<div class="binary-actions"><button class="binary-button true" onclick="answerSmartStream(true)">TRUE</button><button class="binary-button false" onclick="answerSmartStream(false)">FALSE</button></div></div></section>`}
function toggleCustomDrill(){customizationOpen=!customizationOpen;render()}
function dynamicSubjectOptions(){const reg=(DATA.subjectRegistry||[]).filter(s=>s.active!==false);if(!reg.length)return SUBJECTS;return reg.map(s=>({id:s.id,campaign:'Subject',name:s.name}))}
function customizationPanel(){if(!customizationOpen)return'';const x=DATA.setup,opts=dynamicSubjectOptions(),chosen=opts.find(i=>i.id===x.subjectId)||opts[0]||SUBJECTS[0];return `<div class="custom-drawer"><div class="customization-body"><div class="field"><label>Subject / campaign</label><select onchange="updateSetup('subjectId',this.value)">${opts.map(i=>`<option value="${i.id}" ${i.id===x.subjectId?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div><div class="field"><label>Test type</label><div class="type-grid">${TEST_TYPES.map(t=>`<button class="type-card ${x.testType===t.id?'active':''}" onclick="selectTestType('${t.id}')"><strong>${esc(t.label)}</strong><span>${esc(t.description)}</span></button>`).join('')}</div></div><div class="setup-grid"><div class="field"><label>Working style</label><div class="choice-row">${WORKING_STYLES.map(([id,l])=>`<button class="chip ${x.workingStyle===id?'active':''}" onclick="updateSetup('workingStyle','${id}')">${esc(l)}</button>`).join('')}</div></div><div class="field"><label>Answer format</label><div class="choice-row">${ANSWER_FORMATS.map(([id,l])=>`<button class="chip ${x.answerFormat===id?'active':''}" onclick="updateSetup('answerFormat','${id}')">${esc(l)}</button>`).join('')}</div></div></div><div class="setup-grid"><div class="field"><label>Number of questions</label><div class="count-row">${COUNT_PRESETS.map(n=>`<button class="chip ${Number(x.count)===n?'active':''}" onclick="updateSetup('count',${n})">${n}</button>`).join('')}<input type="number" min="1" max="100" value="${x.count}" onchange="updateSetup('count',this.value)" aria-label="Custom question count"></div></div><div class="field"><label>Difficulty</label><div class="choice-row">${DIFFICULTIES.map(d=>`<button class="chip ${x.difficulty===d?'active':''}" onclick="updateSetup('difficulty','${d}')">${d}</button>`).join('')}</div></div></div><div class="setup-grid"><div class="field"><label>Feedback</label><div class="choice-row">${FEEDBACKS.map(([id,l])=>`<button class="chip ${x.feedback===id?'active':''}" onclick="updateSetup('feedback','${id}')">${esc(l)}</button>`).join('')}</div></div><div class="field"><label>Timing</label><div class="choice-row">${TIMINGS.map(([id,l])=>`<button class="chip ${x.timing===id?'active':''}" onclick="updateSetup('timing','${id}')">${esc(l)}</button>`).join('')}</div></div></div><div class="field"><label>Additional focus (optional)</label><textarea oninput="DATA.setup.focus=this.value;save()">${esc(x.focus)}</textarea></div><button class="button primary custom-generate" onclick="generatePrompt()">GENERATE CHAT REQUEST</button></div></div>`}
function home(){const drills=DATA.completedSessions.length,sessionAnswered=DATA.statistics.answered||DATA.completedSessions.reduce((n,s)=>n+(s.answered||0),0),streamAnswered=(DATA.streamPrototype?.attempts||[]).length+(DATA.streamEngine?.attempts||[]).length,answered=sessionAnswered+streamAnswered;return `${streamHome()}<section class="panel session-zone"><div class="section-kicker"><strong>Session</strong><span>Deliberate drill</span></div><div class="launch-actions v098-primary"><button class="button primary" onclick="route('import')">IMPORT PACKET</button></div><div class="session-secondary"><button class="button" onclick="copyVanilla(this)">COPY INSTRUCTION</button><button class="button" onclick="toggleCustomDrill()">CUSTOM DRILL ${customizationOpen?'−':'＋'}</button></div>${customizationPanel()}${ongoingSessions(true)}</section><div class="home-stats"><div class="home-stat"><strong>${drills}</strong><span>Total drills</span></div><div class="home-stat"><strong>${answered}</strong><span>Questions answered</span></div></div>`}
function flattenConceptInput(list,parentId=null,out=[]){for(const raw of list||[]){if(!raw)continue;const name=String(raw.name||raw.title||raw.id||'Concept'),id=String(raw.id||streamIdFromName(name)),node={id,name,parentId:String(raw.parent_id||raw.parentId||raw.parent||parentId||'')||null,aliases:Array.isArray(raw.aliases)?raw.aliases.map(String):[],kind:String(raw.kind||raw.type||'concept'),prerequisites:Array.isArray(raw.prerequisites)?raw.prerequisites.map(String):[]};out.push(node);if(Array.isArray(raw.children))flattenConceptInput(raw.children,id,out)}return out}
function ensureSubjectFromImport(labelText){ensureSubjectRegistry(DATA);let r=resolveSubjectRecord(labelText);if(r)return r;const base=subjectBaseKey(labelText);r={id:`subject_${base}`,name:cleanCanonicalName(labelText),autoKey:base,aliases:[String(labelText)],active:true,priority:'normal',manual:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};DATA.subjectRegistry.push(r);return r}
function normalizeKnowledgeManifest(raw,subjectRec){const base=raw.manifest&&typeof raw.manifest==='object'?raw.manifest:raw,concepts=flattenConceptInput(base.concepts||raw.concepts||[]);return{id:String(base.id||`manifest_${subjectRec.id}`),subjectId:subjectRec.id,subjectName:subjectRec.name,revision:Number(base.revision||raw.revision||1),title:String(base.title||`${subjectRec.name} Concept Manifest`),concepts,importedAt:new Date().toISOString()}}
function mergeManifest(manifest){const idx=DATA.conceptManifests.findIndex(m=>m.subjectId===manifest.subjectId);if(idx<0){DATA.conceptManifests.push(manifest);return true}const old=DATA.conceptManifests[idx],replace=(Number(manifest.revision)||0)>=(Number(old.revision)||0);if(replace)DATA.conceptManifests[idx]=manifest;return replace}
function resolveImportedConcept(subjectId,ref,manifest){if(!ref)return null;const n=aliasNorm(ref),concepts=manifest?.concepts||manifestForSubject(subjectId)?.concepts||[];const c=concepts.find(x=>x.id===ref||aliasNorm(x.name)===n||(x.aliases||[]).some(a=>aliasNorm(a)===n));return c?.id||stableLegacyConceptId(ref)}
function normalizeBankQuestions(raw,subjectRec,manifest){const packId=String(raw.bank_id||raw.bankId||raw.id||makeUid('bank'));return (raw.questions||raw.bank?.questions||[]).map((q,i)=>{if(!q)return null;const uid=String(q.uid||`${packId}:${q.id||i+1}`),refs=(q.concept_ids||q.conceptIds||q.tags||[]).map(x=>resolveImportedConcept(subjectRec.id,x,manifest)).filter(Boolean),primary=resolveImportedConcept(subjectRec.id,q.primary_concept_id||q.primaryConceptId||refs[0],manifest),type=String(q.type||'mcq').toLowerCase();return{uid,id:String(q.id||`q${i+1}`),subjectId:subjectRec.id,subjectName:subjectRec.name,primaryConceptId:primary,conceptIds:[...new Set([primary,...refs].filter(Boolean))],type,statement:String(q.statement||''),prompt:String(q.prompt||q.question||q.statement||''),choices:q.choices&&typeof q.choices==='object'?q.choices:null,answer:q.answer,explanation:String(q.explanation||''),difficulty:String(q.difficulty||'medium'),streamEligible:q.stream_eligible!==false&&q.streamEligible!==false,source:String(raw.source||''),importedAt:new Date().toISOString()}}).filter(q=>q&&(q.type==='true_false'||q.type==='stream_statement'||q.choices))}
function importKnowledgeObject(raw){const manifestRaw=raw.manifest||((raw.package_type==='dbd_concept_manifest'||raw.type==='dbd_concept_manifest'||raw.concepts)&&raw),subjectVal=raw.subject?.name||raw.subject||manifestRaw?.subject?.name||manifestRaw?.subject||'Custom',subjectRec=ensureSubjectFromImport(subjectVal);let manifest=null,manifestChanged=false;if(manifestRaw?.concepts){manifest=normalizeKnowledgeManifest(manifestRaw,subjectRec);manifestChanged=mergeManifest(manifest)}const qs=normalizeBankQuestions(raw,subjectRec,manifest),bank=new Map((DATA.questionBank||[]).map(q=>[q.uid,q]));let added=0;for(const q of qs){if(!bank.has(q.uid))added++;bank.set(q.uid,q)}DATA.questionBank=[...bank.values()];normalizeFutureData(DATA);save();return{subjectRec,manifestChanged,added,total:qs.length}}
function importKnowledgeFile(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const raw=JSON.parse(await i.files[0].text()),r=importKnowledgeObject(raw);selectedSubjectId=r.subjectRec.id;subjectDetailMode='overview';alert(`Knowledge imported for ${r.subjectRec.name}. ${r.manifestChanged?'Concept Manifest updated. ':' '}${r.added} new bank question(s) added.`);route('subjects')}catch(e){console.error(e);alert(e.message||'Knowledge import failed.')}};i.click()}
function subjectEvidenceSnapshot(subjectId){const ev=conceptEvidenceV3(subjectId),states={secure:0,shaky:0,weak:0,new:0};ev.forEach(e=>states[e.state]=(states[e.state]||0)+1);const due=ev.filter(e=>daysSince(e.lastSeenAt)>=dueIntervalDays(e.state)).length,bank=canonicalInventoryForSubject(subjectId).length,hist=historicalCardsForSubject(subjectId).length;return{ev,states,due,bank,hist,concepts:subjectConceptModel(subjectId).concepts.length}}
function openSubject(id){selectedSubjectId=id;subjectDetailMode='overview';render()}
function closeSubject(){selectedSubjectId=null;subjectDetailMode='overview';render()}
function setSubjectMode(m){subjectDetailMode=m;render()}
function toggleSubjectActive(id){const s=DATA.subjectRegistry.find(x=>x.id===id);if(s){s.active=!s.active;save();render()}}
function setSubjectPriority(id,v){const s=DATA.subjectRegistry.find(x=>x.id===id);if(s&&['low','normal','high'].includes(v)){s.priority=v;save();render()}}
function toggleOrganizer(){organizeSubjectsOpen=!organizeSubjectsOpen;subjectMergeSelection=new Set();render()}
function toggleMergeSubject(id,checked){checked?subjectMergeSelection.add(id):subjectMergeSelection.delete(id)}
function mergeSelectedSubjects(){const ids=[...subjectMergeSelection];if(ids.length<2){alert('Select at least two subjects to merge.');return}const items=ids.map(id=>DATA.subjectRegistry.find(s=>s.id===id)).filter(Boolean),defaultName=items.map(x=>x.name).sort((a,b)=>a.length-b.length)[0]||'Subject',name=prompt('Canonical subject name:',defaultName);if(!name?.trim())return;const target=items[0],oldIds=new Set(ids);target.name=name.trim();target.aliases=[...new Set(items.flatMap(x=>[x.name,...(x.aliases||[])]))];target.manual=true;target.autoKey=`manual-${streamIdFromName(target.name)}-${simpleHash(target.id).toString(36)}`;target.active=items.some(x=>x.active!==false);target.priority=items.some(x=>x.priority==='high')?'high':'normal';DATA.subjectRegistry=DATA.subjectRegistry.filter(s=>!oldIds.has(s.id)||s.id===target.id);for(const m of DATA.conceptManifests||[])if(oldIds.has(m.subjectId))m.subjectId=target.id;for(const q of DATA.questionBank||[])if(oldIds.has(q.subjectId)){q.subjectId=target.id;q.subjectName=target.name}for(const a of DATA.streamEngine?.attempts||[])if(oldIds.has(a.subjectId))a.subjectId=target.id;normalizeFutureData(DATA);selectedSubjectId=target.id;organizeSubjectsOpen=false;subjectMergeSelection=new Set();save();render()}
function conceptStateCounts(subjectId){return subjectEvidenceSnapshot(subjectId).states}
function conceptTreeHtml(subjectId){const model=subjectConceptModel(subjectId),evMap=new Map(conceptEvidenceV3(subjectId).map(e=>[e.concept.id,e])),children=new Map();for(const c of model.concepts){const p=c.parentId&&model.concepts.some(x=>x.id===c.parentId)?c.parentId:null;if(!children.has(p))children.set(p,[]);children.get(p).push(c)}for(const arr of children.values())arr.sort((a,b)=>String(a.name).localeCompare(String(b.name)));const renderNode=c=>{const kids=children.get(c.id)||[],e=evMap.get(c.id),st=e?.state||'unseen',score=e?.seen?`${e.correct}/${e.seen}`:'—';return `<li class="tree-node"><div class="tree-node-line"><span>${kids.length?'▾':'·'}</span><div><span class="tree-dot ${st}"></span><span class="tree-label">${esc(c.name)}</span>${c.provisional?'<span class="tree-sub">legacy</span>':''}</div><span class="tree-score">${score}</span></div>${kids.length?`<ul>${kids.map(renderNode).join('')}</ul>`:''}</li>`};const roots=children.get(null)||[];return `<div class="tree-shell">${!model.canonical?'<div class="provisional-note">Provisional legacy hierarchy inferred from tag frequency and co-occurrence. Import a Concept Manifest to replace it with an authoritative tree without rewriting history.</div>':model.unresolved?`<div class="provisional-note">Canonical manifest revision ${model.revision}. ${model.unresolved} legacy tag(s) remain under Legacy / unresolved.</div>`:''}<ul class="concept-tree">${roots.map(renderNode).join('')||'<li class="subject-empty">No concepts yet.</li>'}</ul></div>`}
function graphDepthMap(concepts){const byId=new Map(concepts.map(c=>[c.id,c])),memo=new Map();const depth=id=>{if(memo.has(id))return memo.get(id);const c=byId.get(id);if(!c?.parentId||!byId.has(c.parentId)){memo.set(id,0);return 0}const d=Math.min(8,depth(c.parentId)+1);memo.set(id,d);return d};for(const c of concepts)depth(c.id);return memo}
function conceptGraphHtml(subjectId){const model=subjectConceptModel(subjectId),evMap=new Map(conceptEvidenceV3(subjectId).map(e=>[e.concept.id,e]));let concepts=model.concepts.slice();concepts.sort((a,b)=>(evMap.get(b.id)?.seen||0)-(evMap.get(a.id)?.seen||0));if(concepts.length>60){const keep=new Set(concepts.slice(0,60).map(c=>c.id));for(const c of concepts.slice(0,60))if(c.parentId)keep.add(c.parentId);concepts=model.concepts.filter(c=>keep.has(c.id)).slice(0,70)}const depth=graphDepthMap(concepts),cols=new Map();for(const c of concepts){const d=depth.get(c.id)||0;if(!cols.has(d))cols.set(d,[]);cols.get(d).push(c)}const pos=new Map(),xGap=190,yGap=46,pad=35;for(const [d,arr] of cols){arr.sort((a,b)=>String(a.name).localeCompare(String(b.name)));arr.forEach((c,i)=>pos.set(c.id,{x:pad+d*xGap,y:pad+i*yGap+18}))}const width=Math.max(720,pad*2+(Math.max(0,...cols.keys())+1)*xGap),height=Math.max(330,pad*2+Math.max(...[...cols.values()].map(a=>a.length),1)*yGap);let edges='';for(const c of concepts){const p=pos.get(c.id);if(c.parentId&&pos.has(c.parentId)){const pp=pos.get(c.parentId);edges+=`<line class="graph-edge" x1="${pp.x+10}" y1="${pp.y}" x2="${p.x-10}" y2="${p.y}"/>`}for(const pre of c.prerequisites||[]){if(pos.has(pre)){const pp=pos.get(pre);edges+=`<line class="graph-edge prereq" x1="${pp.x+10}" y1="${pp.y+4}" x2="${p.x-10}" y2="${p.y+4}"/>`}}}const nodes=concepts.map(c=>{const p=pos.get(c.id),e=evMap.get(c.id),st=e?.state||'unseen',labelText=String(c.name).length>24?String(c.name).slice(0,22)+'…':c.name;return `<g class="graph-node ${st}" transform="translate(${p.x},${p.y})"><circle r="7"></circle><text x="13" y="4">${esc(labelText)}</text><text class="graph-meta" x="13" y="16">${e?.seen?`${e.correct}/${e.seen}`:'unseen'}</text></g>`}).join('');return `<div class="graph-shell"><svg class="concept-graph" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Concept graph">${edges}${nodes}</svg></div><div class="graph-legend"><span class="s">Secure</span><span class="h">Shaky / new</span><span class="w">Weak</span><span>Unseen</span><span>Dashed = prerequisite</span></div>${model.concepts.length>concepts.length?`<p class="note">Graph shows the ${concepts.length} most evidenced/connected concepts for readability. Tree view contains the full structure.</p>`:''}`}
function copyManifestRequest(subjectId,button){const s=DATA.subjectRegistry.find(x=>x.id===subjectId),tags=tagRecords(subjectId).sort((a,b)=>b.count-a.count).slice(0,100).map(x=>x.name),text=`Prepare a DBD v0.9.8 Knowledge Package for ${s?.name||'this subject'}. Use the actual curriculum/materials in this subject chat as the authoritative basis. Return a downloadable JSON file containing a canonical Concept Manifest plus a reusable Stream Question Bank. The Concept Manifest should use stable concept IDs, a clean curriculum hierarchy, aliases for legacy terminology, optional prerequisite links only when academically defensible, and revision 1 or higher. Questions must reference canonical concept IDs, identify one primary concept when possible, and be safe for repeated retrieval. Do not include lesson prose. Existing legacy tags seen in my DBD history include: ${tags.join(', ')||'none supplied'}. Map these as aliases only when genuinely equivalent; do not force ambiguous tags into concepts.`;copyText(text,button)}
function copyRefillRequest(subjectId,button){const s=DATA.subjectRegistry.find(x=>x.id===subjectId),ev=conceptEvidenceV3(subjectId).filter(e=>['weak','shaky','new'].includes(e.state)).sort((a,b)=>conceptPriority(b,s)-conceptPriority(a,s)).slice(0,12),lines=ev.map(e=>`- ${e.concept.name}: ${e.state}; ${e.correct}/${e.seen} correct; ${canonicalInventoryForSubject(subjectId).filter(q=>(q.conceptIds||[]).includes(e.concept.id)).length} bank questions`);copyText(`Create a DBD v0.9.8.4.1 Question Bank refill for ${s?.name||'this subject'} using the actual materials in this subject chat. Prioritize fresh variants for:\n${lines.join('\n')||'- concepts currently lacking fresh inventory'}\nUse the existing canonical concept IDs if available. Do not reteach in the JSON; generate reusable retrieval questions with explanations.`,button)}
function subjectDetailView(subjectId){const s=DATA.subjectRegistry.find(x=>x.id===subjectId);if(!s){selectedSubjectId=null;return subjectsView()}const snap=subjectEvidenceSnapshot(subjectId),attention=snap.ev.filter(e=>e.seen||e.state==='new').sort((a,b)=>conceptPriority(b,s)-conceptPriority(a,s)).slice(0,7),model=subjectConceptModel(subjectId),body=subjectDetailMode==='tree'?conceptTreeHtml(subjectId):subjectDetailMode==='graph'?conceptGraphHtml(subjectId):`<div class="knowledge-hero"><div class="settings-title">Needs attention</div>${attention.length?`<div class="attention-list">${attention.map(e=>`<div class="attention-row"><div><strong>${esc(e.concept.name)}</strong><small>${e.seen?`${e.correct}/${e.seen} correct · ${e.questionVariety} variants`:'No evidence yet'} · ${canonicalInventoryForSubject(subjectId).filter(q=>(q.conceptIds||[]).includes(e.concept.id)).length} bank</small></div><span class="attention-state ${e.state}">${e.state}</span></div>`).join('')}</div>`:'<div class="subject-empty">No concept evidence yet.</div>'}</div><div class="knowledge-hero"><div class="settings-title">Architecture</div><div class="metric-row"><span>Concept structure</span><strong>${model.canonical?`Manifest r${model.revision}`:'Legacy inferred'}</strong></div><div class="metric-row"><span>Unresolved legacy tags</span><strong>${model.unresolved}</strong></div><div class="metric-row"><span>Reusable bank questions</span><strong>${snap.bank}</strong></div><div class="metric-row"><span>Historical Stream fallback</span><strong>${snap.hist}</strong></div></div>`;return `<section class="subjects-page"><div class="subject-detail-head"><div><button class="back-link" onclick="closeSubject()">← Subjects</button><div class="beta-label">v1 beta knowledge model</div><h1>${esc(s.name)}</h1><p class="muted">${(s.aliases||[]).length} recognized name${(s.aliases||[]).length===1?'':'s'} · ${s.active!==false?'active in Stream':'paused from Stream'}</p></div><div class="subject-controls"><button class="button tiny" onclick="toggleSubjectActive('${s.id}')">${s.active!==false?'PAUSE':'ACTIVATE'}</button><select onchange="setSubjectPriority('${s.id}',this.value)" aria-label="Stream priority"><option value="low" ${s.priority==='low'?'selected':''}>Low priority</option><option value="normal" ${s.priority==='normal'?'selected':''}>Normal priority</option><option value="high" ${s.priority==='high'?'selected':''}>High priority</option></select></div></div><div class="knowledge-hero"><div class="knowledge-grid"><div class="knowledge-metric"><strong>${snap.concepts}</strong><span>Concepts</span></div><div class="knowledge-metric"><strong>${snap.due}</strong><span>Due</span></div><div class="knowledge-metric"><strong>${snap.states.weak||0}</strong><span>Weak</span></div><div class="knowledge-metric"><strong>${snap.bank}</strong><span>Bank</span></div></div><div class="knowledge-actions"><button class="button" onclick="importKnowledgeFile()">IMPORT KNOWLEDGE</button><button class="button" onclick="copyRefillRequest('${s.id}',this)">COPY REFILL REQUEST</button></div></div><div class="subject-tabs"><button class="subject-tab ${subjectDetailMode==='overview'?'active':''}" onclick="setSubjectMode('overview')">Overview</button><button class="subject-tab ${subjectDetailMode==='tree'?'active':''}" onclick="setSubjectMode('tree')">Tree</button><button class="subject-tab ${subjectDetailMode==='graph'?'active':''}" onclick="setSubjectMode('graph')">Graph</button></div>${body}<div class="knowledge-actions"><button class="button" onclick="copyManifestRequest('${s.id}',this)">COPY MANIFEST REQUEST</button><button class="button" onclick="importKnowledgeFile()">IMPORT BANK / MANIFEST</button></div></section>`}
function organizerHtml(){if(!organizeSubjectsOpen)return'';return `<div class="organizer"><h3>Organize subjects</h3><p>Automatic normalization has already grouped obvious aliases. Select two or more remaining entries only when they should share one canonical subject. Historical sessions are never rewritten.</p>${(DATA.subjectRegistry||[]).map(s=>`<label class="merge-choice"><input type="checkbox" onchange="toggleMergeSubject('${s.id}',this.checked)"><div><strong>${esc(s.name)}</strong><small>${esc((s.aliases||[]).join(' · ')||s.name)}</small></div></label>`).join('')}<div class="organizer-actions"><button class="button primary" onclick="mergeSelectedSubjects()">MERGE SELECTED</button><button class="button" onclick="toggleOrganizer()">CANCEL</button></div></div>`}
function subjectsView(){if(selectedSubjectId)return subjectDetailView(selectedSubjectId);ensureSubjectRegistry(DATA);const rows=(DATA.subjectRegistry||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)));return `<section class="subjects-page"><div class="eyebrow">Canonical knowledge structure</div><h1>Subjects</h1><p class="subjects-intro">v0.9.8.4.1 automatically normalizes obvious legacy names, keeps the original history untouched, and layers Concept Trees, evidence, Question Banks, and Stream scheduling on top.</p><div class="subjects-toolbar"><button class="button small primary" onclick="importKnowledgeFile()">IMPORT KNOWLEDGE</button><button class="button small" onclick="toggleOrganizer()">ORGANIZE SUBJECTS</button></div>${organizerHtml()}<div class="subject-list-v098">${rows.map(s=>{const x=subjectEvidenceSnapshot(s.id),aliases=(s.aliases||[]).filter(a=>aliasNorm(a)!==aliasNorm(s.name));return `<button class="subject-row-v098" onclick="openSubject('${s.id}')"><div><div class="subject-name">${esc(s.name)}</div><div class="subject-meta">${canonicalSessions(s.id).flatMap(x=>x.attempts||[]).length} historical answers · ${x.concepts} concepts · ${x.bank} bank questions${aliases.length?`<br>${esc(aliases.slice(0,3).join(' · '))}${aliases.length>3?' …':''}`:''}</div><div class="subject-status-strip"><span class="secure">${x.states.secure||0} secure</span><span class="shaky">${x.states.shaky||0} shaky</span><span class="weak">${x.states.weak||0} weak</span>${x.states.new?`<span>${x.states.new} new</span>`:''}</div><span class="canonical-badge">${manifestForSubject(s.id)?'canonical manifest':'legacy inferred'}</span></div><span class="subject-arrow">›</span></button>`}).join('')||'<div class="empty">No subjects detected yet.</div>'}</div></section>`}
function dataHealth(){let unresolved=0,orphans=0;for(const s of DATA.subjectRegistry||[]){const model=subjectConceptModel(s.id);unresolved+=model.canonical?model.unresolved:0;const ids=new Set(model.concepts.map(c=>c.id));orphans+=model.concepts.filter(c=>c.parentId&&!ids.has(c.parentId)).length}const seen=new Set(),dupes=[];for(const q of DATA.questionBank||[]){if(seen.has(q.uid))dupes.push(q.uid);seen.add(q.uid)}return{unresolved,orphans,duplicateBankIds:dupes.length,subjects:(DATA.subjectRegistry||[]).length,manifests:(DATA.conceptManifests||[]).length,bank:(DATA.questionBank||[]).length,streamAttempts:(DATA.streamEngine?.attempts||[]).length}}
function mergeRegistry(current,incoming){const all=[...(current||[]),...(incoming||[])],out=[];for(const r of all){const aliases=[r.name,...(r.aliases||[])],match=out.find(x=>aliases.some(a=>(x.aliases||[]).some(b=>aliasNorm(a)===aliasNorm(b)))||(!r.manual&&!x.manual&&subjectBaseKey(r.name)===subjectBaseKey(x.name)));if(!match){out.push({...r,aliases:[...new Set(r.aliases||[])]});continue}match.aliases=[...new Set([...(match.aliases||[]),r.name,...(r.aliases||[])])];if(r.manual&&!match.manual){match.name=r.name;match.manual=true;match.autoKey=r.autoKey}match.active=match.active||r.active;match.priority=match.priority==='high'||r.priority==='high'?'high':match.priority==='low'&&r.priority==='low'?'low':'normal'}return out}
function mergeVaultData(incoming){const d=normalizeFutureData({...emptyData(),...incoming,setup:migrateSetup(incoming.setup),completedSessions:Array.isArray(incoming.completedSessions)?incoming.completedSessions:[],activeSessions:Array.isArray(incoming.activeSessions)?incoming.activeSessions:[],settings:{...emptyData().settings,...(incoming.settings||{})}});DATA.completedSessions=mergeById(DATA.completedSessions,d.completedSessions);DATA.activeSessions=mergeById(DATA.activeSessions,d.activeSessions);DATA.subjectRegistry=mergeRegistry(DATA.subjectRegistry,d.subjectRegistry);const mm=new Map((DATA.conceptManifests||[]).map(m=>[m.subjectId,m]));for(const m of d.conceptManifests||[]){const old=mm.get(m.subjectId);if(!old||Number(m.revision)>=Number(old.revision))mm.set(m.subjectId,m)}DATA.conceptManifests=[...mm.values()];const bankMap=new Map((DATA.questionBank||[]).map(q=>[q.uid||q.id,q]));for(const q of d.questionBank||[])bankMap.set(q.uid||q.id,q);DATA.questionBank=[...bankMap.values()];const allAttempts=[...(DATA.streamEngine?.attempts||[]),...(d.streamEngine?.attempts||[])],am=new Map();for(const a of allAttempts)if(a?.id)am.set(a.id,a);DATA.streamEngine={...DATA.streamEngine,attempts:[...am.values()],questionSeen:{...(DATA.streamEngine?.questionSeen||{})},recentConceptIds:DATA.streamEngine?.recentConceptIds||[],burst:DATA.streamEngine?.burst||{count:0,correct:0}};for(const [k,v] of Object.entries(d.streamEngine?.questionSeen||{}))DATA.streamEngine.questionSeen[k]=Math.max(DATA.streamEngine.questionSeen[k]||0,Number(v)||0);const saMap=new Map((DATA.streamPrototype?.attempts||[]).map(a=>[a.id,a]));for(const a of d.streamPrototype?.attempts||[])if(a?.id)saMap.set(a.id,a);DATA.streamPrototype=DATA.streamPrototype||{attempts:[],seen:{}};DATA.streamPrototype.attempts=[...saMap.values()];DATA.streamPrototype.seen={...(DATA.streamPrototype.seen||{})};for(const [k,v] of Object.entries(d.streamPrototype?.seen||{}))DATA.streamPrototype.seen[k]=Math.max(DATA.streamPrototype.seen[k]||0,Number(v)||0);if(!DATA.pendingPacket&&d.pendingPacket)DATA.pendingPacket=d.pendingPacket;DATA.vault.lastMergedAt=new Date().toISOString();recomputeStatistics(DATA);normalizeFutureData(DATA);save()}
function importBackup(){const i=document.createElement('input');i.type='file';i.accept='.json,.dbd,application/json';i.onchange=async()=>{try{const raw=JSON.parse(await i.files[0].text()),p=raw?.format==='dbd-vault'?raw.data:raw;if(!p||!Array.isArray(p.completedSessions))throw new Error('Invalid DBD backup.');const d=emptyData(),localDevice=DATA.settings.deviceId;DATA=normalizeFutureData({...d,...p,appVersion:APP_VERSION,setup:migrateSetup(p.setup),completedSessions:p.completedSessions,activeSessions:Array.isArray(p.activeSessions)?p.activeSessions:(p.activeSession?[migrateLegacyActive(p.activeSession)].filter(Boolean):[]),currentActiveId:p.currentActiveId||null,dailyState:p.dailyState||{},subjectRegistry:Array.isArray(p.subjectRegistry)?p.subjectRegistry:[],conceptManifests:Array.isArray(p.conceptManifests)?p.conceptManifests:[],questionBank:Array.isArray(p.questionBank)?p.questionBank:[],streamPrototype:p.streamPrototype||{attempts:[],seen:{}},streamEngine:p.streamEngine||{attempts:[],questionSeen:{},recentConceptIds:[],burst:{}},scheduler:p.scheduler||{burstSize:5},vault:p.vault||{},settings:{...d.settings,...(p.settings||{}),deviceId:localDevice}});recomputeStatistics(DATA);save();alert('Backup replaced this browser data.');route('home')}catch(e){alert(e.message||'Import failed.')}};i.click()}
function dataView(){const bytes=new Blob([JSON.stringify(DATA)]).size,size=bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`,persistentState=DATA.settings.persistentStorageGranted?'Granted':'Normal browser storage',h=dataHealth(),deviceShort=String(DATA.settings.deviceId||'').split('_').pop()?.slice(0,8)||'local',healthBad=h.orphans+h.duplicateBankIds,healthWarn=h.unresolved;return `<section class="data-page"><div class="eyebrow">v1 beta 0.9.8.4.1 · schema ${DATA.schemaVersion}</div><h1>Data</h1><div class="settings-group"><div class="settings-title">Storage</div><div class="settings-row"><div><strong>Browser-local database</strong><small>dbd_gazali · device ${esc(deviceShort)}</small></div><span class="status-ok">ACTIVE</span></div><div class="settings-row"><div><strong>Persistent storage</strong><small>Helps reduce browser eviction risk</small></div><button class="text-action" onclick="persistent()">${esc(persistentState)}</button></div></div><div class="settings-group"><div class="settings-title">DBD Vault</div><p class="note">Vault merge now includes canonical subjects, manifests, Question Banks, Stream attempts, and scheduler evidence. UUID-backed attempts and questions are deduplicated; newer manifest revisions win.</p><div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div><details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details></div><div class="settings-group"><div class="settings-title">v1 beta engine</div><div class="metric-row"><span>Canonical subjects</span><strong>${h.subjects}</strong></div><div class="metric-row"><span>Concept manifests</span><strong>${h.manifests}</strong></div><div class="metric-row"><span>Question Bank inventory</span><strong>${h.bank}</strong></div><div class="metric-row"><span>Smart Stream attempts</span><strong>${h.streamAttempts}</strong></div><div class="metric-row"><span>Data schema</span><strong>${DATA.schemaVersion}</strong></div></div><div class="settings-group"><div class="settings-title">Data health</div><div class="metric-row"><span>Orphan concept links</span><strong class="${h.orphans?'health-bad':'health-good'}">${h.orphans}</strong></div><div class="metric-row"><span>Duplicate bank IDs</span><strong class="${h.duplicateBankIds?'health-bad':'health-good'}">${h.duplicateBankIds}</strong></div><div class="metric-row"><span>Unresolved legacy tags</span><strong class="${h.unresolved?'health-warn':'health-good'}">${h.unresolved}</strong></div><ul class="health-list"><li>Legacy sessions remain immutable; mappings are layered on top.</li><li>${healthBad?'Structural conflicts need attention.':'No structural conflicts detected.'}</li><li>${healthWarn?'Some legacy tags are waiting for a future Concept Manifest mapping.':'All legacy tags under manifested subjects are resolved.'}</li></ul></div><div class="settings-group"><div class="settings-title">Local storage info</div><div class="metric-row"><span>Completed sessions</span><strong>${DATA.completedSessions.length}</strong></div><div class="metric-row"><span>Ongoing sessions</span><strong>${DATA.activeSessions.length}</strong></div><div class="metric-row"><span>Approx. DBD data</span><strong>${size}</strong></div></div><div class="settings-group danger-zone"><div class="settings-title">Danger zone</div><div class="settings-row"><div><strong>Reset all DBD data</strong><small>Deletes local sessions, bank inventory, concept structure, and settings.</small></div><button class="button danger small" onclick="resetData()">RESET</button></div></div><p class="data-footnote">No accounts, Supabase, cloud database, or direct ChatGPT integration.</p></section>`}
/* ================= END v0.9.8 BETA ENGINE ================= */

async function copyText(text,button){try{await navigator.clipboard.writeText(text)}catch(e){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}const old=button.textContent;button.textContent='COPIED ✓';setTimeout(()=>button.textContent=old,1300)}
function render(){document.body.classList.toggle('drill-mode',view==='drill');renderNav();const views={home,prompt:promptView,import:importView,preflight,drill,review:reviewView,summary,quiz:quizReport,subjects:subjectsView,history,data:dataView};document.getElementById('application').innerHTML=(views[view]||home)();if(view==='drill')startTimer()}
/* v0.9.8.4.1 boot is installed below. */

/* ================= v0.9.8.4.1 STABILITY PATCH =================
   Goals:
   - keep legacy localStorage untouched
   - avoid expensive concept inference on the first paint
   - memoize legacy/concept calculations
   - stop normal saves from rebuilding the whole database
   - remove service-worker/cache as a startup variable
   ============================================================ */

var ENGINE_CACHE={
  canonicalSessions:new Map(),
  tagRecords:new Map(),
  manifests:new Map(),
  models:new Map(),
  resolution:new Map(),
  evidence:new Map(),
  inventory:new Map(),
  historicalAll:null,
  historicalBySubject:new Map()
};
var STREAM_PICK_CACHE=null;
var STREAM_PICK_PENDING=false;
var LAST_STRUCTURE_SIGNATURE='';

function clearEngineCache(){
  ENGINE_CACHE.canonicalSessions.clear();
  ENGINE_CACHE.tagRecords.clear();
  ENGINE_CACHE.manifests.clear();
  ENGINE_CACHE.models.clear();
  ENGINE_CACHE.resolution.clear();
  ENGINE_CACHE.evidence.clear();
  ENGINE_CACHE.inventory.clear();
  ENGINE_CACHE.historicalAll=null;
  ENGINE_CACHE.historicalBySubject.clear();
  STREAM_PICK_CACHE=null;
}

function structureSignature(data){
  return [
    data.completedSessions?.length||0,
    data.activeSessions?.length||0,
    data.pendingPacket?.packet?.subject||'',
    data.questionBank?.length||0,
    data.conceptManifests?.length||0,
    data.subjectRegistry?.length||0
  ].join('|');
}

/* Lightweight normalization used at boot/import. It intentionally does not
   rebuild the old flat conceptEvidence table; v0.9.8+ uses the canonical
   evidence engine lazily when a Subject or Stream actually needs it. */
function normalizeFutureData(data){
  data.schemaVersion=DATA_SCHEMA_VERSION;
  data.settings={persistentStorageGranted:false,deviceId:makeUid('device'),...(data.settings||{})};
  if(!data.settings.deviceId)data.settings.deviceId=makeUid('device');
  data.vault={lastMergedAt:null,lastExportedAt:null,...(data.vault||{})};
  data.scheduler={burstSize:5,...(data.scheduler||{})};
  data.completedSessions=Array.isArray(data.completedSessions)?data.completedSessions.map(s=>({...s,id:s.id||makeUid('session'),stream:s.stream||{id:streamIdFromName(s.subject),name:String(s.subject||'Custom')}})):[];
  data.activeSessions=Array.isArray(data.activeSessions)?data.activeSessions.map(a=>({...a,id:a.id||makeUid('session'),packet:ensurePacketIdentity(a.packet)})):[];
  if(data.pendingPacket?.packet)data.pendingPacket.packet=ensurePacketIdentity(data.pendingPacket.packet);
  data.questionBank=Array.isArray(data.questionBank)?data.questionBank:[];
  data.streamPrototype=data.streamPrototype&&typeof data.streamPrototype==='object'?data.streamPrototype:{attempts:[],seen:{}};
  data.streamPrototype.attempts=Array.isArray(data.streamPrototype.attempts)?data.streamPrototype.attempts:[];
  data.streamPrototype.seen=data.streamPrototype.seen&&typeof data.streamPrototype.seen==='object'?data.streamPrototype.seen:{};
  data.streamEngine=data.streamEngine&&typeof data.streamEngine==='object'?data.streamEngine:{attempts:[],questionSeen:{},recentConceptIds:[],burst:{count:0,correct:0,startedAt:null}};
  data.streamEngine.attempts=Array.isArray(data.streamEngine.attempts)?data.streamEngine.attempts:[];
  data.streamEngine.questionSeen=data.streamEngine.questionSeen&&typeof data.streamEngine.questionSeen==='object'?data.streamEngine.questionSeen:{};
  data.streamEngine.recentConceptIds=Array.isArray(data.streamEngine.recentConceptIds)?data.streamEngine.recentConceptIds:[];
  data.streamEngine.burst={count:0,correct:0,startedAt:null,...(data.streamEngine.burst||{})};
  data.conceptEvidence=data.conceptEvidence&&typeof data.conceptEvidence==='object'?data.conceptEvidence:{};
  normalizeManifestList(data);
  ensureSubjectRegistry(data);
  data.streams=(data.subjectRegistry||[]).map(r=>({id:r.id,name:r.name,campaign:'Custom',active:r.active!==false,priority:r.priority||'normal'}));
  return data;
}

/* Normal interaction saves are now O(serialization), not O(all history ×
   inferred concepts). Structural normalization only runs when the shape of
   the database changes. */
function save(){
  DATA.appVersion=APP_VERSION;
  DATA.schemaVersion=DATA_SCHEMA_VERSION;
  const sig=structureSignature(DATA);
  if(sig!==LAST_STRUCTURE_SIGNATURE){
    ensureSubjectRegistry(DATA);
    DATA.streams=(DATA.subjectRegistry||[]).map(r=>({id:r.id,name:r.name,campaign:'Custom',active:r.active!==false,priority:r.priority||'normal'}));
    LAST_STRUCTURE_SIGNATURE=structureSignature(DATA);
  }
  clearEngineCache();
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA));
  }catch(e){
    console.error('DBD save failed',e);
  }
}

function canonicalSessions(subjectId){
  if(ENGINE_CACHE.canonicalSessions.has(subjectId))return ENGINE_CACHE.canonicalSessions.get(subjectId);
  const rows=(DATA.completedSessions||[]).filter(s=>resolveSubjectId(s.subject)===subjectId);
  ENGINE_CACHE.canonicalSessions.set(subjectId,rows);
  return rows;
}

function tagRecords(subjectId){
  if(ENGINE_CACHE.tagRecords.has(subjectId))return ENGINE_CACHE.tagRecords.get(subjectId);
  const map=new Map();
  for(const s of canonicalSessions(subjectId)){
    const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));
    for(const a of s.attempts||[]){
      const q=qmap.get(String(a.questionId))||a;
      const tags=[...new Set([...(q.tags||[]),...(a.tags||[])].map(x=>String(x).trim()).filter(Boolean))];
      for(const tag of tags){
        const k=aliasNorm(tag);
        if(!map.has(k))map.set(k,{key:k,name:tag,count:0,questions:new Set(),lastSeenAt:null});
        const r=map.get(k);
        r.count++;
        r.questions.add(`${s.id}:${a.questionId}`);
        r.lastSeenAt=s.completedAt||r.lastSeenAt;
      }
    }
  }
  const rows=[...map.values()];
  ENGINE_CACHE.tagRecords.set(subjectId,rows);
  return rows;
}

function manifestForSubject(subjectId){
  if(ENGINE_CACHE.manifests.has(subjectId))return ENGINE_CACHE.manifests.get(subjectId);
  const m=(DATA.conceptManifests||[]).filter(x=>x.subjectId===subjectId).sort((a,b)=>(Number(b.revision)||0)-(Number(a.revision)||0)||new Date(b.importedAt||0)-new Date(a.importedAt||0))[0]||null;
  ENGINE_CACHE.manifests.set(subjectId,m);
  return m;
}

function subjectConceptModel(subjectId){
  if(ENGINE_CACHE.models.has(subjectId))return ENGINE_CACHE.models.get(subjectId);
  const m=manifestForSubject(subjectId),tags=tagRecords(subjectId);
  let model;
  if(!m){
    model={concepts:inferLegacyConcepts(subjectId),canonical:false,unresolved:tags.length,revision:0};
  }else{
    const amap=new Map();
    for(const c of m.concepts||[])for(const v of [c.id,c.name,...(c.aliases||[])])if(v)amap.set(aliasNorm(v),c.id);
    const concepts=(m.concepts||[]).map(c=>({...c,provisional:false}));
    const unresolved=tags.filter(t=>!amap.has(t.key));
    if(unresolved.length){
      const rootId=`legacy_unresolved_${subjectId}`;
      concepts.push({id:rootId,name:'Legacy / unresolved',parentId:null,kind:'container',provisional:true});
      for(const t of unresolved)concepts.push({id:stableLegacyConceptId(t.name),name:t.name,parentId:rootId,aliases:[t.name],kind:'concept',provisional:true,count:t.count});
    }
    model={concepts,canonical:true,unresolved:unresolved.length,revision:m.revision||1};
  }
  ENGINE_CACHE.models.set(subjectId,model);
  return model;
}

function resolutionMapForSubject(subjectId){
  if(ENGINE_CACHE.resolution.has(subjectId))return ENGINE_CACHE.resolution.get(subjectId);
  const model=subjectConceptModel(subjectId),map=new Map();
  for(const c of model.concepts||[]){
    for(const v of [c.id,c.name,...(c.aliases||[])])if(v)map.set(aliasNorm(v),c.id);
    map.set(String(c.id),c.id);
  }
  ENGINE_CACHE.resolution.set(subjectId,map);
  return map;
}

function resolveConceptRef(subjectId,ref){
  if(!ref)return null;
  const map=resolutionMapForSubject(subjectId),raw=String(ref);
  return map.get(raw)||map.get(aliasNorm(raw))||stableLegacyConceptId(raw);
}

function historicalStreamCandidates(){
  if(ENGINE_CACHE.historicalAll)return ENGINE_CACHE.historicalAll;
  const out=[];
  for(const s of DATA.completedSessions||[]){
    const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));
    for(const a of s.attempts||[]){
      const q=qmap.get(String(a.questionId))||a,choices=q?.choices||a?.choices,correctKey=String(q?.answer??a?.answer??'');
      if(!choices||typeof choices!=='object'||Array.isArray(choices)||!Object.prototype.hasOwnProperty.call(choices,correctKey))continue;
      const keys=Object.keys(choices).filter(k=>String(choices[k]??'').trim());
      if(keys.length<2)continue;
      const wrongKeys=keys.filter(k=>k!==correctKey),cid=`${s.id}:${a.questionId}`,truth=(simpleHash(cid)%2)===0||!wrongKeys.length,proposedKey=truth?correctKey:wrongKeys[simpleHash(cid+'wrong')%wrongKeys.length];
      out.push({id:cid,sessionId:s.id,questionId:a.questionId,subject:s.subject||'Unknown subject',topic:s.topic||'',prompt:q.prompt||a.prompt||'',proposed:String(choices[proposedKey]??proposedKey),truth,proposedKey,correctKey,explanation:q.explanation||a.explanation||'',tags:q.tags||a.tags||[]});
    }
  }
  ENGINE_CACHE.historicalAll=out;
  return out;
}

function historicalCardsForSubject(subjectId){
  if(ENGINE_CACHE.historicalBySubject.has(subjectId))return ENGINE_CACHE.historicalBySubject.get(subjectId);
  const rows=historicalStreamCandidates().filter(c=>resolveSubjectId(c.subject)===subjectId);
  ENGINE_CACHE.historicalBySubject.set(subjectId,rows);
  return rows;
}

function canonicalInventoryForSubject(subjectId){
  if(ENGINE_CACHE.inventory.has(subjectId))return ENGINE_CACHE.inventory.get(subjectId);
  const rows=(DATA.questionBank||[]).filter(q=>q.subjectId===subjectId&&q.streamEligible!==false);
  ENGINE_CACHE.inventory.set(subjectId,rows);
  return rows;
}

function conceptEvidenceV3(subjectId){
  if(ENGINE_CACHE.evidence.has(subjectId))return ENGINE_CACHE.evidence.get(subjectId);
  const model=subjectConceptModel(subjectId);
  const map=new Map(model.concepts.map(c=>[c.id,{concept:c,seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,weightedPositive:0,weightedTotal:0,questionIds:new Set(),days:new Set(),lastSeenAt:null,sources:{session:0,stream:0}}]));
  const ensure=id=>{
    if(!map.has(id))map.set(id,{concept:{id,name:id,parentId:null,provisional:true},seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,weightedPositive:0,weightedTotal:0,questionIds:new Set(),days:new Set(),lastSeenAt:null,sources:{session:0,stream:0}});
    return map.get(id);
  };
  for(const s of canonicalSessions(subjectId)){
    const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));
    for(const a of s.attempts||[]){
      const q=qmap.get(String(a.questionId))||a;
      const explicit=[q?.primaryConceptId,q?.primary_concept_id,...(q?.conceptIds||q?.concept_ids||[])].filter(Boolean);
      const tags=[...(q?.tags||[]),...(a?.tags||[])].filter(Boolean);
      const refs=[...new Set((explicit.length?explicit:tags).map(x=>resolveConceptRef(subjectId,x)).filter(Boolean))];
      if(!refs.length)continue;
      const base=attemptWeight(s,a),primary=resolveConceptRef(subjectId,q?.primaryConceptId||q?.primary_concept_id||null);
      for(const id of refs){
        const e=ensure(id),w=base*(primary&&id!==primary?.7:explicitConceptWeight(refs.length));
        e.seen++;
        if(a.correct)e.correct++; else if(!['skipped','unseen'].includes(a.status))e.wrong++;
        if(a.correct&&a.confidence==='sure')e.secureCorrect++;
        if(a.confidence==='unsure')e.unsure++;
        if(a.confidence==='guess')e.guess++;
        if(a.status==='dontknow')e.dontKnow++;
        if(a.status==='skipped')e.skipped++;
        if(!['skipped','unseen'].includes(a.status)){e.weightedTotal+=w;e.weightedPositive+=a.correct?w:0}
        e.questionIds.add(`${s.id}:${a.questionId}`);
        if(s.completedAt){e.days.add(localDay(new Date(s.completedAt)));if(!e.lastSeenAt||new Date(s.completedAt)>new Date(e.lastSeenAt))e.lastSeenAt=s.completedAt}
        e.sources.session++;
      }
    }
  }
  for(const a of DATA.streamEngine?.attempts||[]){
    if(a.subjectId!==subjectId)continue;
    for(const id of a.conceptIds||[]){
      const e=ensure(id),w=.72;
      e.seen++;
      if(a.correct)e.correct++;else e.wrong++;
      if(a.correct&&a.confidence==='sure')e.secureCorrect++;
      e.weightedTotal+=w;e.weightedPositive+=a.correct?w:0;
      e.questionIds.add(a.questionUid);
      if(a.answeredAt){e.days.add(localDay(new Date(a.answeredAt)));if(!e.lastSeenAt||new Date(a.answeredAt)>new Date(e.lastSeenAt))e.lastSeenAt=a.answeredAt}
      e.sources.stream++;
    }
  }
  const result=[...map.values()].map(e=>{
    const state=conceptState(e);
    return {...e,questionVariety:e.questionIds.size,dayVariety:e.days.size,questionIds:undefined,days:undefined,state};
  });
  ENGINE_CACHE.evidence.set(subjectId,result);
  return result;
}

function scheduleStreamPick(){
  if(STREAM_PICK_PENDING||STREAM_PICK_CACHE||streamFeedback||view!=='home')return;
  STREAM_PICK_PENDING=true;
  const work=()=>{
    try{STREAM_PICK_CACHE=schedulerPick()}catch(e){console.error('Stream scheduler failed',e);STREAM_PICK_CACHE=null}
    STREAM_PICK_PENDING=false;
    if(view==='home'&&!streamFeedback)render();
  };
  if('requestIdleCallback' in window)requestIdleCallback(work,{timeout:450});
  else setTimeout(work,16);
}

function streamHome(){
  const b=DATA.streamEngine?.burst||{count:0,correct:0},size=Math.max(1,Number(DATA.scheduler?.burstSize)||5);
  if(streamDismissed)return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Paused</span></div><div class="stream-empty">Stream is resting. <button class="text-action" onclick="streamDismissed=false;scheduleStreamPick();render()">Resume</button></div></section>`;
  if(b.count>=size){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Burst complete</span></div><div class="stream-card smart"><div class="burst-complete"><strong>${b.correct||0}/${b.count||0}</strong><span>correct in this burst</span><div class="binary-actions"><button class="binary-button" onclick="streamDismissed=true;render()">DONE</button><button class="binary-button true" onclick="resetBurst()">5 MORE</button></div></div></div></section>`;
  }
  if(streamFeedback?.card){
    const c=streamFeedback.card,expected=c.truth?'TRUE':'FALSE';
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${esc(c.subjectName||c.subject||'')}</span></div><div class="stream-card smart"><div class="stream-feedback ${streamFeedback.correct?'good':'bad'}"><div><strong>${streamFeedback.correct?'CORRECT ✓':'NOT QUITE'}</strong><small>Correct response: ${expected}${c.explanation?` · ${esc(c.explanation)}`:''}</small></div><div class="stream-next-indicator">Next question…</div></div></div></section>`;
  }
  if(!STREAM_PICK_CACHE){
    scheduleStreamPick();
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>scheduler beta</span></div><div class="stream-preparing"><strong>Preparing Stream</strong><span>DBD is indexing your local legacy evidence. The rest of the app is already usable.</span></div></section>`;
  }
  const pick=STREAM_PICK_CACHE;
  if(!pick)return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>No eligible inventory</span></div><div class="stream-empty">No eligible Stream question is available yet. Sessions and Subjects remain available below.</div></section>`;
  return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${b.count+1} / ${size} · scheduler beta</span></div><div class="stream-card smart"><div class="stream-intent"><span class="stream-state ${pick.conceptState}">${esc(pick.conceptState)}</span><span class="stream-concept">${esc(pick.subjectName||pick.subject)} · ${esc(pick.conceptName||'Legacy concept')}</span></div><div class="stream-prompt">${esc(pick.prompt)}</div>${pick.proposed!==null&&pick.proposed!==undefined?`<div class="stream-proposal"><small>Proposed answer</small><strong>${esc(pick.proposed)}</strong></div>`:''}<div class="binary-actions"><button class="binary-button true" onclick="answerSmartStream(true)">TRUE</button><button class="binary-button false" onclick="answerSmartStream(false)">FALSE</button></div></div></section>`;
}

function answerSmartStream(value){
  const pick=streamFeedback?.card||STREAM_PICK_CACHE;
  if(!pick||streamFeedback)return;
  const correct=Boolean(value)===Boolean(pick.truth),now=new Date().toISOString();
  DATA.streamEngine=DATA.streamEngine||{attempts:[],questionSeen:{},recentConceptIds:[],burst:{count:0,correct:0,startedAt:null}};
  DATA.streamEngine.questionSeen[pick.uid]=(DATA.streamEngine.questionSeen[pick.uid]||0)+1;
  DATA.streamEngine.recentConceptIds=[pick.primaryConceptId,...DATA.streamEngine.recentConceptIds].filter(Boolean).slice(0,6);
  DATA.streamEngine.attempts.push({id:makeUid('stream'),questionUid:pick.uid,subjectId:pick.subjectId,conceptIds:pick.conceptIds?.length?pick.conceptIds:[pick.primaryConceptId],primaryConceptId:pick.primaryConceptId,answeredAt:now,selected:Boolean(value),correct,confidence:'sure',sourceType:pick.sourceType});
  DATA.streamEngine.attempts=DATA.streamEngine.attempts.slice(-5000);
  const b=DATA.streamEngine.burst;
  b.count=(b.count||0)+1;b.correct=(b.correct||0)+(correct?1:0);b.startedAt=b.startedAt||now;
  streamFeedback={card:pick,correct,selected:Boolean(value)};
  STREAM_PICK_CACHE=null;
  save();
  render();
  setTimeout(()=>{
    if(streamFeedback?.card?.uid===pick.uid){
      streamFeedback=null;
      render();
      scheduleStreamPick();
    }
  },720);
}

function render(){
  try{
    document.body.classList.toggle('drill-mode',view==='drill');
    renderNav();
    const views={home,prompt:promptView,import:importView,preflight,drill,review:reviewView,summary,quiz:quizReport,subjects:subjectsView,history,data:dataView};
    document.getElementById('application').innerHTML=(views[view]||home)();
    if(view==='drill')startTimer();
  }catch(e){
    console.error('DBD render failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD hit a local rendering error.</h2><p>Your local data has not been deleted. Exported Vaults remain valid. Reload once; if this persists, use another browser to export a fresh Vault.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}

async function retireLegacyServiceWorker(){
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>String(k).startsWith('dbd-')).map(k=>caches.delete(k)));
    }
  }catch(e){console.warn('DBD cache cleanup skipped',e)}
}

function boot0981(){
  try{
    LAST_STRUCTURE_SIGNATURE=structureSignature(DATA);
    render();
    setTimeout(scheduleStreamPick,0);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD could not finish startup.</h2><p>Your browser data is still stored under <strong>dbd_gazali</strong>; this patch does not wipe it.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}

/* ================= v0.9.8.4.1 STREAM BANK PATCH ================= */

function bankRequestPrompt(){
  return `Prepare a DBD v0.9.8.4.1 STREAM KNOWLEDGE PACKAGE for the subject represented by this chat.

This is NOT a one-time Session quiz. It is long-term reusable inventory for DBD Stream: I will answer these questions gradually in short 5-question bursts while commuting, waiting, or otherwise away from pen and paper.

First inspect the actual materials, tutoring history, mistakes, completed work, and current scope available in this subject chat. Build the Concept Manifest only from material I have actually learned or currently need to retain. Preserve the subject's real curriculum hierarchy where one exists.

Create approximately 100 reusable Stream questions. Target 100 unless the available learned scope genuinely cannot support 100 distinct, high-quality retrieval items without repetition.

CRITICAL STREAM RULES:
- These are conceptual / mental retrieval questions.
- paper_required must be false for every Stream question.
- calculator_required must be false for every Stream question.
- Do NOT require scratch paper, long arithmetic, multi-line algebra, long derivations, graph drawing, lengthy balancing, or calculator work.
- Questions should normally be answerable in roughly 15–60 seconds from the mind.
- Prefer concept identification, method selection, error detection, qualitative relationships, interpreting equations or representations, formula meaning, short mental calculation, classification, prediction, and deciding what information matters.
- For Math/Physics/Chemistry, test conceptual command without pretending this proves full procedural mastery.
- If a skill cannot be tested meaningfully without written work, do not force it into Stream. Put it in session_only_recommendations instead.
- Use only objectively gradable quick formats supported by Stream: mcq, true_false, or stream_statement.
- For MCQ, provide exactly one correct answer and plausible distractors.
- Avoid trivial wording-only variations. Questions mapped to the same concept should test it through genuinely different angles.

The downloadable JSON package must contain:
1. package_type: "dbd_knowledge_package"
2. dbd_version: "0.9.8.4.1"
3. subject name
4. a canonical Concept Manifest with stable concept IDs, parent relationships, useful aliases, and prerequisite links only when academically defensible
5. a Question Bank of about 100 reusable questions
6. for every question: stable id/uid, one primary concept ID, optional secondary concept IDs, difficulty, explanation, stream_eligible:true, paper_required:false, calculator_required:false, and estimated_seconds
7. session_only_recommendations for material that needs full written problem solving

Do not paste a 100-question JSON blob into chat. Return it as a downloadable .json file.

DBD itself will schedule weak/new/due concepts. Do not arrange the bank as a fixed 100-question test and do not number it as a required sequence.`;
}

async function copyBankRequest(button){await copyText(bankRequestPrompt(),button)}

function normalizeBankQuestions(raw,subjectRec,manifest){
  const packId=String(raw.bank_id||raw.bankId||raw.id||makeUid('bank'));
  const qs=(raw.questions||raw.bank?.questions||raw.question_bank||raw.questionBank||[]);
  return qs.map((q,i)=>{
    if(!q)return null;
    const uid=String(q.uid||`${packId}:${q.id||i+1}`),refs=(q.concept_ids||q.conceptIds||q.tags||[]).map(x=>resolveImportedConcept(subjectRec.id,x,manifest)).filter(Boolean),primary=resolveImportedConcept(subjectRec.id,q.primary_concept_id||q.primaryConceptId||refs[0],manifest),type=String(q.type||'mcq').toLowerCase();
    const paperRequired=Boolean(q.paper_required??q.paperRequired??false),calculatorRequired=Boolean(q.calculator_required??q.calculatorRequired??false),supported=type==='true_false'||type==='stream_statement'||(q.choices&&typeof q.choices==='object');
    const requestedEligible=q.stream_eligible!==false&&q.streamEligible!==false;
    return{uid,id:String(q.id||`q${i+1}`),bankId:packId,subjectId:subjectRec.id,subjectName:subjectRec.name,primaryConceptId:primary,conceptIds:[...new Set([primary,...refs].filter(Boolean))],type,statement:String(q.statement||''),prompt:String(q.prompt||q.question||q.statement||''),choices:q.choices&&typeof q.choices==='object'?q.choices:null,answer:q.answer,explanation:String(q.explanation||''),difficulty:String(q.difficulty||'medium'),streamEligible:Boolean(requestedEligible&&supported&&!paperRequired&&!calculatorRequired),paperRequired,calculatorRequired,estimatedSeconds:Number(q.estimated_seconds??q.estimatedSeconds??0)||null,source:String(raw.source||''),importedAt:new Date().toISOString()}
  }).filter(Boolean);
}

function canonicalInventoryForSubject(subjectId){
  if(ENGINE_CACHE.inventory.has(subjectId))return ENGINE_CACHE.inventory.get(subjectId);
  const rows=(DATA.questionBank||[]).filter(q=>q.subjectId===subjectId&&q.streamEligible!==false&&!q.paperRequired&&!q.calculatorRequired&&(q.type==='true_false'||q.type==='stream_statement'||(q.choices&&typeof q.choices==='object')));
  ENGINE_CACHE.inventory.set(subjectId,rows);return rows;
}

function importKnowledgeObject(raw){
  const manifestRaw=raw.manifest||raw.concept_manifest||raw.conceptManifest||((raw.package_type==='dbd_concept_manifest'||raw.type==='dbd_concept_manifest'||raw.concepts)&&raw),subjectVal=raw.subject?.name||raw.subject||manifestRaw?.subject?.name||manifestRaw?.subject||'Custom',subjectRec=ensureSubjectFromImport(subjectVal);
  let manifest=null,manifestChanged=false;if(manifestRaw?.concepts){manifest=normalizeKnowledgeManifest(manifestRaw,subjectRec);manifestChanged=mergeManifest(manifest)}
  const qs=normalizeBankQuestions(raw,subjectRec,manifest),bank=new Map((DATA.questionBank||[]).map(q=>[q.uid,q]));let added=0,updated=0;
  for(const q of qs){if(!bank.has(q.uid))added++;else updated++;bank.set(q.uid,q)}
  DATA.questionBank=[...bank.values()];normalizeFutureData(DATA);save();
  const eligible=qs.filter(q=>q.streamEligible).length,blocked=qs.length-eligible;
  return{subjectRec,manifestChanged,added,updated,total:qs.length,eligible,blocked};
}

function importKnowledgeFile(){
  const i=document.createElement('input');i.type='file';i.accept='.json,application/json';
  i.onchange=async()=>{try{if(!i.files?.[0])return;const raw=JSON.parse(await i.files[0].text()),r=importKnowledgeObject(raw);selectedSubjectId=r.subjectRec.id;subjectDetailMode='bank';clearEngineCache();alert(`Stream Bank imported for ${r.subjectRec.name}. ${r.manifestChanged?'Concept Manifest updated. ':''}${r.added} new · ${r.updated} updated · ${r.eligible} Stream-ready${r.blocked?` · ${r.blocked} kept out of Stream`:''}.`);route('subjects')}catch(e){console.error(e);alert(e.message||'Knowledge import failed.')}};i.click();
}

function bankHomeZone(){
  const total=(DATA.questionBank||[]).length,eligible=(DATA.questionBank||[]).filter(q=>q.streamEligible!==false&&!q.paperRequired&&!q.calculatorRequired).length;
  return `<section class="panel bank-zone"><div class="section-kicker"><strong>Stream Bank</strong><span>Reusable conceptual inventory</span></div><div class="bank-zone-actions"><button class="button primary" onclick="importKnowledgeFile()">ADD QUESTIONS</button><button class="button" onclick="copyBankRequest(this)">COPY BANK REQUEST</button></div><div class="bank-summary"><span>Paperless / calculator-free questions available to Stream</span><strong>${eligible} / ${total}</strong></div></section>`;
}

function home(){
  const drills=DATA.completedSessions.length,sessionAnswered=DATA.statistics.answered||DATA.completedSessions.reduce((n,s)=>n+(s.answered||0),0),streamAnswered=(DATA.streamPrototype?.attempts||[]).length+(DATA.streamEngine?.attempts||[]).length,answered=sessionAnswered+streamAnswered;
  return `${streamHome()}<section class="panel session-zone"><div class="section-kicker"><strong>Session</strong><span>Deliberate drill</span></div><div class="launch-actions v098-primary"><button class="button primary" onclick="route('import')">IMPORT PACKET</button></div><div class="session-secondary"><button class="button" onclick="copyVanilla(this)">COPY INSTRUCTION</button><button class="button" onclick="toggleCustomDrill()">CUSTOM DRILL ${customizationOpen?'−':'＋'}</button></div>${customizationPanel()}${ongoingSessions(true)}</section>${bankHomeZone()}<div class="home-stats"><div class="home-stat"><strong>${drills}</strong><span>Total drills</span></div><div class="home-stat"><strong>${answered}</strong><span>Questions answered</span></div></div>`;
}

function subjectBankHtml(subjectId){
  const all=(DATA.questionBank||[]).filter(q=>q.subjectId===subjectId),eligible=all.filter(q=>q.streamEligible!==false&&!q.paperRequired&&!q.calculatorRequired),seen=DATA.streamEngine?.questionSeen||{},seenCount=eligible.filter(q=>(seen[q.uid]||0)>0).length,unseen=Math.max(0,eligible.length-seenCount),conceptMap=new Map();
  for(const q of eligible){for(const id of q.conceptIds||[q.primaryConceptId]){if(!id)continue;conceptMap.set(id,(conceptMap.get(id)||0)+1)}}
  const model=subjectConceptModel(subjectId),names=new Map(model.concepts.map(c=>[c.id,c.name])),rows=[...conceptMap.entries()].sort((a,b)=>b[1]-a[1]);
  return `<div class="bank-view"><div class="bank-overview"><div class="bank-stat"><strong>${all.length}</strong><span>Total bank</span></div><div class="bank-stat"><strong>${eligible.length}</strong><span>Stream safe</span></div><div class="bank-stat"><strong>${unseen}</strong><span>Unseen</span></div><div class="bank-stat"><strong>${seenCount}</strong><span>Seen</span></div></div><div class="stream-safe-note">Stream-safe means the item is supported by the quick-retrieval renderer and is marked as requiring neither paper nor a calculator.</div>${rows.length?`<div class="bank-concept-list">${rows.slice(0,40).map(([id,n])=>`<div class="bank-concept-row"><div><strong>${esc(names.get(id)||id)}</strong><small>${conceptEvidenceV3(subjectId).find(e=>e.concept.id===id)?.state||'new'} concept state</small></div><span>${n}</span></div>`).join('')}</div>`:'<div class="subject-empty">No dedicated Stream Bank questions yet.</div>'}</div>`;
}

function copySubjectDiagnostics(subjectId,button){
  const s=DATA.subjectRegistry.find(x=>x.id===subjectId),ev=conceptEvidenceV3(subjectId).filter(e=>e.seen>0).sort((a,b)=>conceptPriority(b,s)-conceptPriority(a,s)),bank=canonicalInventoryForSubject(subjectId),weak=ev.filter(e=>['weak','shaky','new'].includes(e.state)).slice(0,20),strong=ev.filter(e=>e.state==='secure').slice(0,12);
  const line=e=>`- ${e.concept.name}: ${e.state}; ${e.correct}/${e.seen} correct; ${e.secureCorrect}/${e.seen} secure; ${e.questionVariety} question variants; ${bank.filter(q=>(q.conceptIds||[]).includes(e.concept.id)||q.primaryConceptId===e.concept.id).length} Stream-bank questions; last seen ${e.lastSeenAt||'unknown'}`;
  const text=`DBD SUBJECT DIAGNOSTICS\nSubject: ${s?.name||subjectId}\nGenerated: ${new Date().toISOString()}\n\nNEEDS ATTENTION\n${weak.map(line).join('\n')||'- No evidenced weak/shaky concepts yet.'}\n\nSECURE EVIDENCE (reference)\n${strong.map(line).join('\n')||'- None yet.'}\n\nUse this as evidence from DBD retrieval, not as a substitute for teaching. Diagnose why the weak/shaky concepts are failing based on the actual material and our prior work in this subject chat. Teach or repair the concepts first. When appropriate, generate fresh conceptual Stream variants mapped to the same canonical concept IDs. Do not interpret quick paperless retrieval as proof of full written procedural mastery.`;
  copyText(text,button);
}

function copyManifestRequest(subjectId,button){
  const s=DATA.subjectRegistry.find(x=>x.id===subjectId),tags=tagRecords(subjectId).sort((a,b)=>b.count-a.count).slice(0,100).map(x=>x.name);
  const text=bankRequestPrompt()+`\n\nTARGET SUBJECT: ${s?.name||'this subject'}\nLegacy tags already present in DBD: ${tags.join(', ')||'none supplied'}. Map legacy terms as aliases only when genuinely equivalent; do not force ambiguous tags into concepts.`;
  copyText(text,button);
}

function copyRefillRequest(subjectId,button){
  const s=DATA.subjectRegistry.find(x=>x.id===subjectId),ev=conceptEvidenceV3(subjectId).filter(e=>['weak','shaky','new'].includes(e.state)).sort((a,b)=>conceptPriority(b,s)-conceptPriority(a,s)).slice(0,15),lines=ev.map(e=>`- ${e.concept.name}: ${e.state}; ${e.correct}/${e.seen} correct; ${canonicalInventoryForSubject(subjectId).filter(q=>(q.conceptIds||[]).includes(e.concept.id)||q.primaryConceptId===e.concept.id).length} current Stream questions`);
  copyText(`Create a DBD v0.9.8.4.1 conceptual Stream Question Bank refill for ${s?.name||'this subject'} using the actual materials in this subject chat. Target up to 100 fresh reusable questions, weighted heavily toward the weak/shaky/new concepts below, but do not create fake variety just to hit 100.\n\n${lines.join('\n')||'- concepts currently lacking fresh inventory'}\n\nEvery Stream item must be paper_required:false and calculator_required:false, normally answerable mentally in about 15–60 seconds, and use mcq, true_false, or stream_statement. Prefer conceptual identification, method selection, error detection, interpretation, qualitative relationships, formula meaning, classification, prediction, and short mental calculations. Long procedural questions belong in session_only_recommendations, not the Stream bank. Use the existing canonical concept IDs. Return a downloadable .json file, not a pasted 100-question JSON blob.`,button);
}

function subjectDetailView(subjectId){
  const s=DATA.subjectRegistry.find(x=>x.id===subjectId);if(!s){selectedSubjectId=null;return subjectsView()}
  const snap=subjectEvidenceSnapshot(subjectId),attention=snap.ev.filter(e=>e.seen||e.state==='new').sort((a,b)=>conceptPriority(b,s)-conceptPriority(a,s)).slice(0,7),model=subjectConceptModel(subjectId);
  const overview=`<div class="knowledge-hero"><div class="settings-title">Needs attention</div>${attention.length?`<div class="attention-list">${attention.map(e=>`<div class="attention-row"><div><strong>${esc(e.concept.name)}</strong><small>${e.seen?`${e.correct}/${e.seen} correct · ${e.questionVariety} variants`:'No evidence yet'} · ${canonicalInventoryForSubject(subjectId).filter(q=>(q.conceptIds||[]).includes(e.concept.id)||q.primaryConceptId===e.concept.id).length} bank</small></div><span class="attention-state ${e.state}">${e.state}</span></div>`).join('')}</div>`:'<div class="subject-empty">No concept evidence yet.</div>'}</div><div class="knowledge-hero"><div class="settings-title">Architecture</div><div class="metric-row"><span>Concept structure</span><strong>${model.canonical?`Manifest r${model.revision}`:'Legacy inferred'}</strong></div><div class="metric-row"><span>Unresolved legacy tags</span><strong>${model.unresolved}</strong></div><div class="metric-row"><span>Reusable bank questions</span><strong>${snap.bank}</strong></div><div class="metric-row"><span>Historical Stream fallback</span><strong>${snap.hist}</strong></div><div class="diagnostic-actions"><button class="button" onclick="copySubjectDiagnostics('${s.id}',this)">COPY DIAGNOSTICS</button><button class="button" onclick="copyRefillRequest('${s.id}',this)">COPY REFILL REQUEST</button></div></div>`;
  const body=subjectDetailMode==='tree'?conceptTreeHtml(subjectId):subjectDetailMode==='graph'?conceptGraphHtml(subjectId):subjectDetailMode==='bank'?subjectBankHtml(subjectId):overview;
  return `<section class="subjects-page"><div class="subject-detail-head"><div><button class="back-link" onclick="closeSubject()">← Subjects</button><div class="beta-label">v1 beta knowledge model</div><h1>${esc(s.name)}</h1><p class="muted">${(s.aliases||[]).length} recognized name${(s.aliases||[]).length===1?'':'s'} · ${s.active!==false?'active in Stream':'paused from Stream'}</p></div><div class="subject-controls"><button class="button tiny" onclick="toggleSubjectActive('${s.id}')">${s.active!==false?'PAUSE':'ACTIVATE'}</button><select onchange="setSubjectPriority('${s.id}',this.value)" aria-label="Stream priority"><option value="low" ${s.priority==='low'?'selected':''}>Low priority</option><option value="normal" ${s.priority==='normal'?'selected':''}>Normal priority</option><option value="high" ${s.priority==='high'?'selected':''}>High priority</option></select></div></div><div class="knowledge-hero"><div class="knowledge-grid"><div class="knowledge-metric"><strong>${snap.concepts}</strong><span>Concepts</span></div><div class="knowledge-metric"><strong>${snap.due}</strong><span>Due</span></div><div class="knowledge-metric"><strong>${snap.states.weak||0}</strong><span>Weak</span></div><div class="knowledge-metric"><strong>${snap.bank}</strong><span>Bank</span></div></div><div class="knowledge-actions"><button class="button" onclick="importKnowledgeFile()">ADD TO BANK</button><button class="button" onclick="copyBankRequest(this)">COPY BANK REQUEST</button></div></div><div class="subject-tabs"><button class="subject-tab ${subjectDetailMode==='overview'?'active':''}" onclick="setSubjectMode('overview')">Overview</button><button class="subject-tab ${subjectDetailMode==='tree'?'active':''}" onclick="setSubjectMode('tree')">Tree</button><button class="subject-tab ${subjectDetailMode==='bank'?'active':''}" onclick="setSubjectMode('bank')">Bank</button><button class="subject-tab ${subjectDetailMode==='graph'?'active':''}" onclick="setSubjectMode('graph')">Graph</button></div>${body}<div class="knowledge-actions"><button class="button" onclick="copyManifestRequest('${s.id}',this)">COPY KNOWLEDGE REQUEST</button><button class="button" onclick="importKnowledgeFile()">IMPORT BANK / MANIFEST</button></div></section>`;
}

/* ================= END v0.9.8.4.1 STREAM BANK PATCH ================= */


/* ================= DBD v0.9.8.4.1 STREAM POLICY PATCH ================= */

function normalizeStreamPolicyRecord(r){
  const oldPriority=['low','normal','high'].includes(r?.priority)?r.priority:'normal';
  const defaultWeight=oldPriority==='high'?3:oldPriority==='low'?1:2;
  return {
    ...r,
    aliases:Array.isArray(r?.aliases)?r.aliases:[],
    active:r?.active!==false,
    priority:oldPriority,
    streamWeight:Math.max(1,Math.min(5,Number(r?.streamWeight)||defaultWeight)),
    legacyStreamEnabled:r?.legacyStreamEnabled!==false,
    targetDifficulty:['adaptive','easy','medium','hard'].includes(String(r?.targetDifficulty||'').toLowerCase())
      ? String(r.targetDifficulty).toLowerCase()
      : 'adaptive',
    policyUpdatedAt:r?.policyUpdatedAt||r?.updatedAt||r?.createdAt||'1970-01-01T00:00:00.000Z'
  };
}

function ensureSubjectRegistry(data){
  let reg=Array.isArray(data.subjectRegistry)?data.subjectRegistry.map(normalizeStreamPolicyRecord):[];
  const labels=allSubjectLabels(data);
  for(const labelText of labels){
    const n=aliasNorm(labelText),base=subjectBaseKey(labelText);
    let item=reg.find(r=>(r.aliases||[]).some(a=>aliasNorm(a)===n)||aliasNorm(r.name)===n);
    if(!item)item=reg.find(r=>r.autoKey===base||subjectBaseKey(r.name)===base);
    if(!item){
      item=normalizeStreamPolicyRecord({
        id:`subject_${base}`,
        name:cleanCanonicalName(labelText),
        autoKey:base,
        aliases:[],
        active:true,
        priority:'normal',
        streamWeight:2,
        legacyStreamEnabled:true,
        targetDifficulty:'adaptive',
        manual:false,
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      });
      reg.push(item);
    }
    if(!item.aliases.some(a=>aliasNorm(a)===n))item.aliases.push(labelText);
    if(!item.manual){
      const candidates=[item.name,...item.aliases].map(cleanCanonicalName).filter(Boolean).sort((a,b)=>a.length-b.length);
      if(candidates[0])item.name=candidates[0];
    }
    item.updatedAt=item.updatedAt||new Date().toISOString();
  }

  const grouped=new Map();
  for(const raw of reg){
    const r=normalizeStreamPolicyRecord(raw);
    const key=r.manual?`manual:${r.id}`:(r.autoKey||subjectBaseKey(r.name));
    if(!grouped.has(key)){grouped.set(key,{...r,aliases:[...(r.aliases||[])]});continue}
    const t=grouped.get(key);
    t.aliases=[...new Set([...(t.aliases||[]),r.name,...(r.aliases||[])])];
    const rt=new Date(r.policyUpdatedAt||0).getTime(),tt=new Date(t.policyUpdatedAt||0).getTime();
    if(rt>tt){
      t.active=r.active;
      t.priority=r.priority;
      t.streamWeight=r.streamWeight;
      t.legacyStreamEnabled=r.legacyStreamEnabled;
      t.targetDifficulty=r.targetDifficulty;
      t.policyUpdatedAt=r.policyUpdatedAt;
    }
    if(r.manual&&!t.manual){t.name=r.name;t.manual=true;t.autoKey=r.autoKey}
  }
  data.subjectRegistry=[...grouped.values()].map(normalizeStreamPolicyRecord);
  return data.subjectRegistry;
}

function normalizeFutureData(data){
  data.schemaVersion=DATA_SCHEMA_VERSION;
  data.settings={persistentStorageGranted:false,deviceId:makeUid('device'),...(data.settings||{})};
  if(!data.settings.deviceId)data.settings.deviceId=makeUid('device');
  data.vault={lastMergedAt:null,lastExportedAt:null,...(data.vault||{})};
  data.scheduler={burstSize:5,...(data.scheduler||{})};
  data.completedSessions=Array.isArray(data.completedSessions)?data.completedSessions.map(s=>({...s,id:s.id||makeUid('session'),stream:s.stream||{id:streamIdFromName(s.subject),name:String(s.subject||'Custom')}})):[];
  data.activeSessions=Array.isArray(data.activeSessions)?data.activeSessions.map(a=>({...a,id:a.id||makeUid('session'),packet:ensurePacketIdentity(a.packet)})):[];
  if(data.pendingPacket?.packet)data.pendingPacket.packet=ensurePacketIdentity(data.pendingPacket.packet);
  data.questionBank=Array.isArray(data.questionBank)?data.questionBank:[];
  data.streamPrototype=data.streamPrototype&&typeof data.streamPrototype==='object'?data.streamPrototype:{attempts:[],seen:{}};
  data.streamPrototype.attempts=Array.isArray(data.streamPrototype.attempts)?data.streamPrototype.attempts:[];
  data.streamPrototype.seen=data.streamPrototype.seen&&typeof data.streamPrototype.seen==='object'?data.streamPrototype.seen:{};
  data.streamEngine=data.streamEngine&&typeof data.streamEngine==='object'?data.streamEngine:{attempts:[],questionSeen:{},recentConceptIds:[],recentSubjectIds:[],burst:{count:0,correct:0,startedAt:null}};
  data.streamEngine.attempts=Array.isArray(data.streamEngine.attempts)?data.streamEngine.attempts:[];
  data.streamEngine.questionSeen=data.streamEngine.questionSeen&&typeof data.streamEngine.questionSeen==='object'?data.streamEngine.questionSeen:{};
  data.streamEngine.recentConceptIds=Array.isArray(data.streamEngine.recentConceptIds)?data.streamEngine.recentConceptIds:[];
  data.streamEngine.recentSubjectIds=Array.isArray(data.streamEngine.recentSubjectIds)?data.streamEngine.recentSubjectIds:[];
  data.streamEngine.burst={count:0,correct:0,startedAt:null,...(data.streamEngine.burst||{})};
  data.conceptEvidence=data.conceptEvidence&&typeof data.conceptEvidence==='object'?data.conceptEvidence:{};
  normalizeManifestList(data);
  ensureSubjectRegistry(data);
  data.streams=(data.subjectRegistry||[]).map(r=>({
    id:r.id,name:r.name,campaign:'Custom',active:r.active!==false,priority:r.priority||'normal',
    streamWeight:r.streamWeight,legacyStreamEnabled:r.legacyStreamEnabled,targetDifficulty:r.targetDifficulty
  }));
  return data;
}

function streamPolicyUpdated(s){
  s.policyUpdatedAt=new Date().toISOString();
  STREAM_PICK_CACHE=null;
  clearEngineCache();
  save();
  render();
  setTimeout(scheduleStreamPick,0);
}

function toggleSubjectActive(id){
  const s=DATA.subjectRegistry.find(x=>x.id===id);
  if(!s)return;
  s.active=!s.active;
  streamPolicyUpdated(s);
}

function soloSubject(id){
  const now=new Date().toISOString();
  for(const s of DATA.subjectRegistry||[]){
    s.active=s.id===id;
    s.policyUpdatedAt=now;
  }
  STREAM_PICK_CACHE=null;
  clearEngineCache();
  save();
  render();
  setTimeout(scheduleStreamPick,0);
}

function changeStreamWeight(id,delta){
  const s=DATA.subjectRegistry.find(x=>x.id===id);
  if(!s)return;
  s.streamWeight=Math.max(1,Math.min(5,(Number(s.streamWeight)||2)+Number(delta||0)));
  streamPolicyUpdated(s);
}

function setSubjectDifficulty(id,v){
  const s=DATA.subjectRegistry.find(x=>x.id===id);
  v=String(v||'adaptive').toLowerCase();
  if(!s||!['adaptive','easy','medium','hard'].includes(v))return;
  s.targetDifficulty=v;
  streamPolicyUpdated(s);
}

function toggleLegacyStream(id){
  const s=DATA.subjectRegistry.find(x=>x.id===id);
  if(!s)return;
  s.legacyStreamEnabled=s.legacyStreamEnabled===false;
  streamPolicyUpdated(s);
}

function setSubjectPriority(id,v){
  /* retained for backward compatibility with existing Vaults/UI.
     v0.9.8.4.1 Stream Diet is the macro subject allocator. */
  const s=DATA.subjectRegistry.find(x=>x.id===id);
  if(s&&['low','normal','high'].includes(v)){s.priority=v;streamPolicyUpdated(s)}
}

function streamDietSummary(){
  const active=(DATA.subjectRegistry||[]).filter(s=>s.active!==false);
  if(!active.length)return'All subjects muted';
  return active.slice(0,3).map(s=>`${s.name} ${s.streamWeight}×`).join(' · ')+(active.length>3?` · +${active.length-3}`:'');
}

function streamDietPanel(){
  const rows=(DATA.subjectRegistry||[]).slice().sort((a,b)=>{
    if((a.active!==false)!==(b.active!==false))return a.active===false?1:-1;
    return (Number(b.streamWeight)||0)-(Number(a.streamWeight)||0)||String(a.name).localeCompare(String(b.name));
  });
  return `<details class="stream-diet">
    <summary>
      <div><div class="stream-diet-title">Stream Diet</div><div class="stream-diet-summary">${esc(streamDietSummary())}</div></div>
      <span class="stream-diet-plus">＋</span>
    </summary>
    <div class="diet-body">
      <p class="diet-note">Diet controls the subject mix. DBD still chooses the weakest / newest / due concept inside each subject. Weight is proportional over time, not a promise that every 5-question Burst has the exact same composition.</p>
      <div class="diet-list">${rows.map(s=>`<div class="diet-row ${s.active===false?'muted':''}">
        <div><div class="diet-name">${esc(s.name)}</div><div class="diet-meta"><span>${s.active===false?'muted':`${s.streamWeight} parts`}</span><span>${esc((s.targetDifficulty||'adaptive')==='adaptive'?'adaptive difficulty':`${s.targetDifficulty} focus`)}</span><span>${s.legacyStreamEnabled===false?'bank only':'bank + legacy'}</span></div></div>
        <div class="diet-controls">
          <div class="diet-stepper"><button onclick="changeStreamWeight('${s.id}',-1)" ${s.active===false?'disabled':''}>−</button><strong>${s.streamWeight}</strong><button onclick="changeStreamWeight('${s.id}',1)" ${s.active===false?'disabled':''}>＋</button></div>
          <button class="diet-mini focus" onclick="soloSubject('${s.id}')">SOLO</button>
          <button class="diet-mini mute" onclick="toggleSubjectActive('${s.id}')">${s.active===false?'ON':'MUTE'}</button>
        </div>
      </div>`).join('')||'<div class="diet-empty">No subjects detected yet.</div>'}</div>
    </div>
  </details>`;
}

function normalizedDifficulty(v){
  const n=String(v||'').toLowerCase();
  if(n.includes('hard')||n.includes('difficult'))return'hard';
  if(n.includes('easy'))return'easy';
  if(n.includes('medium')||n.includes('moderate'))return'medium';
  return'unknown';
}

function difficultyPreference(q,target){
  if(!target||target==='adaptive')return 0;
  const d=normalizedDifficulty(q?.difficulty);
  if(d===target)return 3;
  if(d==='unknown')return 0;
  const order={easy:0,medium:1,hard:2};
  return -Math.abs((order[d]??1)-(order[target]??1));
}

function subjectBurstCounts(){
  const b=DATA.streamEngine?.burst||{count:0};
  const n=Math.max(0,Number(b.count)||0);
  const recent=(DATA.streamEngine?.attempts||[]).slice(-n);
  const map=new Map();
  for(const a of recent)map.set(a.subjectId,(map.get(a.subjectId)||0)+1);
  return map;
}

function dietDeficit(subject,activeSubjects){
  const counts=subjectBurstCounts(),b=DATA.streamEngine?.burst||{count:0},nextIndex=(Number(b.count)||0)+1;
  const totalWeight=activeSubjects.reduce((n,s)=>n+(Number(s.streamWeight)||1),0)||1;
  const desired=nextIndex*(Number(subject.streamWeight)||1)/totalWeight;
  const actual=counts.get(subject.id)||0;
  return desired-actual;
}

function bankForConceptPolicy(subject,cid){
  const all=canonicalInventoryForSubject(subject.id).filter(q=>(q.conceptIds||[]).includes(cid)||q.primaryConceptId===cid);
  if(!all.length)return[];
  const target=subject.targetDifficulty||'adaptive';
  const seen=DATA.streamEngine?.questionSeen||{};
  return all.slice().sort((a,b)=>{
    const sa=seen[a.uid]||0,sb=seen[b.uid]||0;
    const scoreA=sa*12-difficultyPreference(a,target)*3;
    const scoreB=sb*12-difficultyPreference(b,target)*3;
    return scoreA-scoreB||simpleHash(a.uid)-simpleHash(b.uid);
  });
}

function historyForConceptPolicy(subject,cid){
  if(subject.legacyStreamEnabled===false)return[];
  const seen=DATA.streamEngine?.questionSeen||{};
  return historicalCardsForSubject(subject.id)
    .filter(c=>cardConceptIds(c,subject.id).includes(cid))
    .slice()
    .sort((a,b)=>(seen[`hist:${a.id}`]||0)-(seen[`hist:${b.id}`]||0)||simpleHash(a.id)-simpleHash(b.id));
}

function subjectHasSchedulableInventory(subject){
  const bank=canonicalInventoryForSubject(subject.id);
  if(bank.length)return true;
  return subject.legacyStreamEnabled!==false&&historicalCardsForSubject(subject.id).length>0;
}

function schedulerPick(){
  const subjects=(DATA.subjectRegistry||[])
    .map(normalizeStreamPolicyRecord)
    .filter(s=>s.active!==false&&Number(s.streamWeight)>0&&subjectHasSchedulableInventory(s));

  if(!subjects.length)return null;

  const subjectCandidates=[];
  for(const s of subjects){
    const ev=conceptEvidenceV3(s.id);
    const conceptCandidates=[];
    for(const e of ev){
      const bank=bankForConceptPolicy(s,e.concept.id);
      const hist=historyForConceptPolicy(s,e.concept.id);
      if(!bank.length&&!hist.length)continue;
      conceptCandidates.push({e,score:conceptPriority(e,s),bank,hist});
    }
    if(!conceptCandidates.length)continue;
    conceptCandidates.sort((a,b)=>b.score-a.score||a.e.seen-b.e.seen);
    subjectCandidates.push({
      subject:s,
      concept:conceptCandidates[0],
      deficit:dietDeficit(s,subjects)
    });
  }

  if(!subjectCandidates.length)return null;

  subjectCandidates.sort((a,b)=>{
    const diet=b.deficit-a.deficit;
    if(Math.abs(diet)>.0001)return diet;
    return b.concept.score-a.concept.score;
  });

  const chosen=subjectCandidates[0],s=chosen.subject,e=chosen.concept.e,cid=e.concept.id;
  let item=null;
  if(chosen.concept.bank.length){
    const q=chosen.concept.bank[0];
    item=bankQuestionToStreamCard(q,s,e.concept);
  }else if(chosen.concept.hist.length){
    const c=chosen.concept.hist[0];
    item={...c,uid:`hist:${c.id}`,subjectId:s.id,subjectName:s.name,conceptIds:cardConceptIds(c,s.id),primaryConceptId:cid,conceptName:e.concept.name,sourceType:'history'};
  }
  return item?{
    ...item,
    conceptState:e.state,
    priorityScore:chosen.concept.score,
    dietWeight:s.streamWeight,
    targetDifficulty:s.targetDifficulty,
    legacyAllowed:s.legacyStreamEnabled!==false
  }:null;
}

function answerSmartStream(value){
  const pick=streamFeedback?.card||STREAM_PICK_CACHE;
  if(!pick||streamFeedback)return;
  const correct=Boolean(value)===Boolean(pick.truth),now=new Date().toISOString();
  DATA.streamEngine=DATA.streamEngine||{attempts:[],questionSeen:{},recentConceptIds:[],recentSubjectIds:[],burst:{count:0,correct:0,startedAt:null}};
  DATA.streamEngine.questionSeen[pick.uid]=(DATA.streamEngine.questionSeen[pick.uid]||0)+1;
  DATA.streamEngine.recentConceptIds=[pick.primaryConceptId,...(DATA.streamEngine.recentConceptIds||[])].filter(Boolean).slice(0,8);
  DATA.streamEngine.recentSubjectIds=[pick.subjectId,...(DATA.streamEngine.recentSubjectIds||[])].filter(Boolean).slice(0,12);
  DATA.streamEngine.attempts.push({
    id:makeUid('stream'),questionUid:pick.uid,subjectId:pick.subjectId,
    conceptIds:pick.conceptIds?.length?pick.conceptIds:[pick.primaryConceptId],
    primaryConceptId:pick.primaryConceptId,answeredAt:now,selected:Boolean(value),correct,
    confidence:'sure',sourceType:pick.sourceType,targetDifficulty:pick.targetDifficulty||'adaptive'
  });
  DATA.streamEngine.attempts=DATA.streamEngine.attempts.slice(-5000);
  const b=DATA.streamEngine.burst;
  b.count=(b.count||0)+1;b.correct=(b.correct||0)+(correct?1:0);b.startedAt=b.startedAt||now;
  streamFeedback={card:pick,correct,selected:Boolean(value)};
  STREAM_PICK_CACHE=null;
  save();
  render();
  setTimeout(()=>{
    if(streamFeedback?.card?.uid===pick.uid){
      streamFeedback=null;
      render();
      scheduleStreamPick();
    }
  },720);
}

function home(){
  const drills=DATA.completedSessions.length,
    sessionAnswered=DATA.statistics.answered||DATA.completedSessions.reduce((n,s)=>n+(s.answered||0),0),
    streamAnswered=(DATA.streamPrototype?.attempts||[]).length+(DATA.streamEngine?.attempts||[]).length,
    answered=sessionAnswered+streamAnswered;
  return `${streamHome()}${streamDietPanel()}<section class="panel session-zone"><div class="section-kicker"><strong>Session</strong><span>Deliberate drill</span></div><div class="launch-actions v098-primary"><button class="button primary" onclick="route('import')">IMPORT PACKET</button></div><div class="session-secondary"><button class="button" onclick="copyVanilla(this)">COPY INSTRUCTION</button><button class="button" onclick="toggleCustomDrill()">CUSTOM DRILL ${customizationOpen?'−':'＋'}</button></div>${customizationPanel()}${ongoingSessions(true)}</section>${bankHomeZone()}<div class="home-stats"><div class="home-stat"><strong>${drills}</strong><span>Total drills</span></div><div class="home-stat"><strong>${answered}</strong><span>Questions answered</span></div></div>`;
}

function subjectPolicyPanel(s){
  return `<div class="policy-panel">
    <div class="settings-title">Stream policy</div>
    <div class="policy-grid">
      <div class="policy-field"><label>Diet weight</label><select onchange="setStreamWeightDirect('${s.id}',this.value)">
        ${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(s.streamWeight)===n?'selected':''}>${n} part${n===1?'':'s'}</option>`).join('')}
      </select></div>
      <div class="policy-field"><label>Difficulty</label><select onchange="setSubjectDifficulty('${s.id}',this.value)">
        <option value="adaptive" ${s.targetDifficulty==='adaptive'?'selected':''}>Adaptive</option>
        <option value="easy" ${s.targetDifficulty==='easy'?'selected':''}>Easy focus</option>
        <option value="medium" ${s.targetDifficulty==='medium'?'selected':''}>Medium focus</option>
        <option value="hard" ${s.targetDifficulty==='hard'?'selected':''}>Hard focus</option>
      </select></div>
    </div>
    <div class="policy-toggle" style="margin-top:8px"><div><strong>Subject in Stream</strong><small>Mute preserves every historical record and concept state.</small></div><button class="policy-pill ${s.active!==false?'on':'off'}" onclick="toggleSubjectActive('${s.id}')">${s.active!==false?'ACTIVE':'MUTED'}</button></div>
    <div class="policy-toggle" style="margin-top:7px"><div><strong>Legacy questions</strong><small>Turn this off when an old syllabus should remain evidence but stop supplying Stream questions.</small></div><button class="policy-pill ${s.legacyStreamEnabled!==false?'on':'off'}" onclick="toggleLegacyStream('${s.id}')">${s.legacyStreamEnabled!==false?'ALLOWED':'BANK ONLY'}</button></div>
    <div class="knowledge-actions" style="margin-top:9px"><button class="button" onclick="soloSubject('${s.id}')">SOLO THIS SUBJECT</button></div>
  </div>`;
}

function setStreamWeightDirect(id,v){
  const s=DATA.subjectRegistry.find(x=>x.id===id);
  if(!s)return;
  s.streamWeight=Math.max(1,Math.min(5,Number(v)||1));
  streamPolicyUpdated(s);
}

function subjectDetailView(subjectId){
  const s=DATA.subjectRegistry.find(x=>x.id===subjectId);if(!s){selectedSubjectId=null;return subjectsView()}
  Object.assign(s,normalizeStreamPolicyRecord(s));
  const snap=subjectEvidenceSnapshot(subjectId),
    attention=snap.ev.filter(e=>e.seen||e.state==='new').sort((a,b)=>conceptPriority(b,s)-conceptPriority(a,s)).slice(0,7),
    model=subjectConceptModel(subjectId);
  const overview=`${subjectPolicyPanel(s)}<div class="knowledge-hero"><div class="settings-title">Needs attention</div>${attention.length?`<div class="attention-list">${attention.map(e=>`<div class="attention-row"><div><strong>${esc(e.concept.name)}</strong><small>${e.seen?`${e.correct}/${e.seen} correct · ${e.questionVariety} variants`:'No evidence yet'} · ${canonicalInventoryForSubject(subjectId).filter(q=>(q.conceptIds||[]).includes(e.concept.id)||q.primaryConceptId===e.concept.id).length} bank</small></div><span class="attention-state ${e.state}">${e.state}</span></div>`).join('')}</div>`:'<div class="subject-empty">No concept evidence yet.</div>'}</div><div class="knowledge-hero"><div class="settings-title">Architecture</div><div class="metric-row"><span>Concept structure</span><strong>${model.canonical?`Manifest r${model.revision}`:'Legacy inferred'}</strong></div><div class="metric-row"><span>Unresolved legacy tags</span><strong>${model.unresolved}</strong></div><div class="metric-row"><span>Reusable bank questions</span><strong>${snap.bank}</strong></div><div class="metric-row"><span>Historical Stream fallback</span><strong>${s.legacyStreamEnabled===false?'OFF':snap.hist}</strong></div><div class="diagnostic-actions"><button class="button" onclick="copySubjectDiagnostics('${s.id}',this)">COPY DIAGNOSTICS</button><button class="button" onclick="copyRefillRequest('${s.id}',this)">COPY REFILL REQUEST</button></div></div>`;
  const body=subjectDetailMode==='tree'?conceptTreeHtml(subjectId):subjectDetailMode==='graph'?conceptGraphHtml(subjectId):subjectDetailMode==='bank'?subjectBankHtml(subjectId):overview;
  return `<section class="subjects-page"><div class="subject-detail-head"><div><button class="back-link" onclick="closeSubject()">← Subjects</button><div class="beta-label">v1 beta knowledge model</div><h1>${esc(s.name)}</h1><p class="muted">${(s.aliases||[]).length} recognized name${(s.aliases||[]).length===1?'':'s'} · ${s.active!==false?'active in Stream':'muted from Stream'}</p></div><div class="subject-controls"><button class="button tiny" onclick="toggleSubjectActive('${s.id}')">${s.active!==false?'MUTE':'ACTIVATE'}</button></div></div><div class="knowledge-hero"><div class="knowledge-grid"><div class="knowledge-metric"><strong>${snap.concepts}</strong><span>Concepts</span></div><div class="knowledge-metric"><strong>${snap.due}</strong><span>Due</span></div><div class="knowledge-metric"><strong>${snap.states.weak||0}</strong><span>Weak</span></div><div class="knowledge-metric"><strong>${snap.bank}</strong><span>Bank</span></div></div><div class="knowledge-actions"><button class="button" onclick="importKnowledgeFile()">ADD TO BANK</button><button class="button" onclick="copySubjectBankRequest('${s.id}',this)">COPY BANK REQUEST</button></div></div><div class="subject-tabs"><button class="subject-tab ${subjectDetailMode==='overview'?'active':''}" onclick="setSubjectMode('overview')">Overview</button><button class="subject-tab ${subjectDetailMode==='tree'?'active':''}" onclick="setSubjectMode('tree')">Tree</button><button class="subject-tab ${subjectDetailMode==='bank'?'active':''}" onclick="setSubjectMode('bank')">Bank</button><button class="subject-tab ${subjectDetailMode==='graph'?'active':''}" onclick="setSubjectMode('graph')">Graph</button></div>${body}<div class="knowledge-actions"><button class="button" onclick="copyManifestRequest('${s.id}',this)">COPY KNOWLEDGE REQUEST</button><button class="button" onclick="importKnowledgeFile()">IMPORT BANK / MANIFEST</button></div></section>`;
}

function subjectsView(){
  if(selectedSubjectId)return subjectDetailView(selectedSubjectId);
  ensureSubjectRegistry(DATA);
  const rows=(DATA.subjectRegistry||[]).slice().sort((a,b)=>{
    if((a.active!==false)!==(b.active!==false))return a.active===false?1:-1;
    return String(a.name).localeCompare(String(b.name));
  });
  return `<section class="subjects-page"><div class="eyebrow">Canonical knowledge structure</div><h1>Subjects</h1><p class="subjects-intro">History is permanent; Stream policy is temporary. Mute, weight, or upgrade a subject without deleting its old evidence.</p><div class="subjects-toolbar"><button class="button small primary" onclick="importKnowledgeFile()">IMPORT KNOWLEDGE</button><button class="button small" onclick="toggleOrganizer()">ORGANIZE SUBJECTS</button></div>${organizerHtml()}<div class="subject-list-v098">${rows.map(raw=>{const s=normalizeStreamPolicyRecord(raw),x=subjectEvidenceSnapshot(s.id),aliases=(s.aliases||[]).filter(a=>aliasNorm(a)!==aliasNorm(s.name));return `<button class="subject-row-v098" onclick="openSubject('${s.id}')"><div><div class="subject-name">${esc(s.name)}</div><div class="subject-meta">${canonicalSessions(s.id).flatMap(x=>x.attempts||[]).length} historical answers · ${x.concepts} concepts · ${x.bank} bank questions${aliases.length?`<br>${esc(aliases.slice(0,3).join(' · '))}${aliases.length>3?' …':''}`:''}</div><div class="subject-status-strip"><span class="secure">${x.states.secure||0} secure</span><span class="shaky">${x.states.shaky||0} shaky</span><span class="weak">${x.states.weak||0} weak</span>${x.states.new?`<span>${x.states.new} new</span>`:''}</div><div class="subject-policy-strip"><span class="${s.active!==false?'active':'muted'}">${s.active!==false?`stream ${s.streamWeight}×`:'muted'}</span><span>${esc(s.targetDifficulty==='adaptive'?'adaptive':s.targetDifficulty)}</span><span>${s.legacyStreamEnabled===false?'bank only':'legacy allowed'}</span></div><span class="canonical-badge">${manifestForSubject(s.id)?'canonical manifest':'legacy inferred'}</span></div><span class="subject-arrow">›</span></button>`}).join('')||'<div class="empty">No subjects detected yet.</div>'}</div></section>`;
}

function copySubjectBankRequest(subjectId,button){
  const s=DATA.subjectRegistry.find(x=>x.id===subjectId);
  const difficulty=s?.targetDifficulty||'adaptive';
  copyText(bankRequestPrompt()+`\n\nTARGET SUBJECT: ${s?.name||subjectId}\nCURRENT DBD STREAM POLICY: ${s?.active===false?'muted':'active'}, diet weight ${s?.streamWeight||1}, difficulty ${difficulty}, legacy questions ${s?.legacyStreamEnabled===false?'disabled (Bank-only)':'allowed'}.\n\nIf the subject has moved to a new syllabus or harder level, build the Concept Manifest around the CURRENT learned/required scope in this chat. Preserve old terms as aliases only when academically equivalent. New bank questions should match the current level rather than recreating obsolete easy material.`,button);
}

function mergeRegistry(current,incoming){
  const all=[...(current||[]),...(incoming||[])].map(normalizeStreamPolicyRecord),out=[];
  for(const r of all){
    const aliases=[r.name,...(r.aliases||[])];
    const match=out.find(x=>aliases.some(a=>(x.aliases||[]).some(b=>aliasNorm(a)===aliasNorm(b)))||(!r.manual&&!x.manual&&subjectBaseKey(r.name)===subjectBaseKey(x.name)));
    if(!match){out.push({...r,aliases:[...new Set(r.aliases||[])]});continue}
    match.aliases=[...new Set([...(match.aliases||[]),r.name,...(r.aliases||[])])];
    if(r.manual&&!match.manual){match.name=r.name;match.manual=true;match.autoKey=r.autoKey}
    const rt=new Date(r.policyUpdatedAt||0).getTime(),mt=new Date(match.policyUpdatedAt||0).getTime();
    if(rt>mt){
      match.active=r.active;
      match.priority=r.priority;
      match.streamWeight=r.streamWeight;
      match.legacyStreamEnabled=r.legacyStreamEnabled;
      match.targetDifficulty=r.targetDifficulty;
      match.policyUpdatedAt=r.policyUpdatedAt;
    }
  }
  return out.map(normalizeStreamPolicyRecord);
}

function mergeSelectedSubjects(){
  const ids=[...subjectMergeSelection];
  if(ids.length<2){alert('Select at least two subjects to merge.');return}
  const items=ids.map(id=>DATA.subjectRegistry.find(s=>s.id===id)).filter(Boolean),defaultName=items.map(x=>x.name).sort((a,b)=>a.length-b.length)[0]||'Subject',name=prompt('Canonical subject name:',defaultName);
  if(!name?.trim())return;
  const target=normalizeStreamPolicyRecord(items[0]),oldIds=new Set(ids);
  const newest=items.map(normalizeStreamPolicyRecord).sort((a,b)=>new Date(b.policyUpdatedAt||0)-new Date(a.policyUpdatedAt||0))[0]||target;
  target.name=name.trim();
  target.aliases=[...new Set(items.flatMap(x=>[x.name,...(x.aliases||[])]))];
  target.manual=true;
  target.autoKey=`manual-${streamIdFromName(target.name)}-${simpleHash(target.id).toString(36)}`;
  target.active=newest.active;
  target.priority=newest.priority;
  target.streamWeight=newest.streamWeight;
  target.legacyStreamEnabled=newest.legacyStreamEnabled;
  target.targetDifficulty=newest.targetDifficulty;
  target.policyUpdatedAt=new Date().toISOString();
  DATA.subjectRegistry=DATA.subjectRegistry.filter(s=>!oldIds.has(s.id)||s.id===target.id).map(s=>s.id===target.id?target:s);
  for(const m of DATA.conceptManifests||[])if(oldIds.has(m.subjectId))m.subjectId=target.id;
  for(const q of DATA.questionBank||[])if(oldIds.has(q.subjectId)){q.subjectId=target.id;q.subjectName=target.name}
  for(const a of DATA.streamEngine?.attempts||[])if(oldIds.has(a.subjectId))a.subjectId=target.id;
  normalizeFutureData(DATA);
  selectedSubjectId=target.id;organizeSubjectsOpen=false;subjectMergeSelection=new Set();
  save();render();
}

function dataView(){
  const bytes=new Blob([JSON.stringify(DATA)]).size,
    size=bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`,
    persistentState=DATA.settings.persistentStorageGranted?'Granted':'Normal browser storage',
    h=dataHealth(),deviceShort=String(DATA.settings.deviceId||'').split('_').pop()?.slice(0,8)||'local',
    healthBad=h.orphans+h.duplicateBankIds,healthWarn=h.unresolved,
    active=(DATA.subjectRegistry||[]).filter(s=>s.active!==false).length,
    muted=(DATA.subjectRegistry||[]).filter(s=>s.active===false).length;
  return `<section class="data-page"><div class="eyebrow">v1 beta 0.9.8.4.1 · schema ${DATA.schemaVersion}</div><h1>Data</h1><div class="settings-group"><div class="settings-title">Storage</div><div class="settings-row"><div><strong>Browser-local database</strong><small>dbd_gazali · device ${esc(deviceShort)}</small></div><span class="status-ok">ACTIVE</span></div><div class="settings-row"><div><strong>Persistent storage</strong><small>Helps reduce browser eviction risk</small></div><button class="text-action" onclick="persistent()">${esc(persistentState)}</button></div></div><div class="settings-group"><div class="settings-title">DBD Vault</div><p class="note">Vault merge includes canonical subjects, Stream policy, manifests, Question Banks, Stream attempts, and scheduler evidence. Newer subject-policy timestamps win without deleting historical evidence.</p><div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div><details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details></div><div class="settings-group"><div class="settings-title">Stream policy</div><div class="metric-row"><span>Active subjects</span><strong>${active}</strong></div><div class="metric-row"><span>Muted subjects</span><strong>${muted}</strong></div><div class="metric-row"><span>Burst size</span><strong>${DATA.scheduler?.burstSize||5}</strong></div><p class="note">History is never muted. Stream policy only controls what the scheduler is allowed to surface now.</p></div><div class="settings-group"><div class="settings-title">v1 beta engine</div><div class="metric-row"><span>Canonical subjects</span><strong>${h.subjects}</strong></div><div class="metric-row"><span>Concept manifests</span><strong>${h.manifests}</strong></div><div class="metric-row"><span>Question Bank inventory</span><strong>${h.bank}</strong></div><div class="metric-row"><span>Smart Stream attempts</span><strong>${h.streamAttempts}</strong></div><div class="metric-row"><span>Data schema</span><strong>${DATA.schemaVersion}</strong></div></div><div class="settings-group"><div class="settings-title">Data health</div><div class="metric-row"><span>Orphan concept links</span><strong class="${h.orphans?'health-bad':'health-good'}">${h.orphans}</strong></div><div class="metric-row"><span>Duplicate bank IDs</span><strong class="${h.duplicateBankIds?'health-bad':'health-good'}">${h.duplicateBankIds}</strong></div><div class="metric-row"><span>Unresolved legacy tags</span><strong class="${h.unresolved?'health-warn':'health-good'}">${h.unresolved}</strong></div><ul class="health-list"><li>Legacy sessions remain immutable; mappings and Stream policies are layered on top.</li><li>${healthBad?'Structural conflicts need attention.':'No structural conflicts detected.'}</li><li>${healthWarn?'Some legacy tags are waiting for a future Concept Manifest mapping.':'All legacy tags under manifested subjects are resolved.'}</li></ul></div><div class="settings-group"><div class="settings-title">Local storage info</div><div class="metric-row"><span>Completed sessions</span><strong>${DATA.completedSessions.length}</strong></div><div class="metric-row"><span>Ongoing sessions</span><strong>${DATA.activeSessions.length}</strong></div><div class="metric-row"><span>Approx. DBD data</span><strong>${size}</strong></div></div><div class="settings-group danger-zone"><div class="settings-title">Danger zone</div><div class="settings-row"><div><strong>Reset all DBD data</strong><small>Deletes local sessions, bank inventory, concept structure, and settings.</small></div><button class="button danger small" onclick="resetData()">RESET</button></div></div><p class="data-footnote">No accounts, Supabase, cloud database, or direct ChatGPT integration.</p></section>`;
}

/* ================= END DBD v0.9.8.4.1 STREAM POLICY PATCH ================= */


/* ================= DBD v0.9.8.4.1 STREAM STARTUP PATCH ================= */

var STREAM_ENGINE_STATE = {
  status:'idle',       // idle | pending | ready | empty | error
  phase:'Waiting',
  done:0,
  total:0,
  error:null,
  token:0
};

function streamEngineReset(){
  STREAM_ENGINE_STATE.token++;
  STREAM_ENGINE_STATE.status='idle';
  STREAM_ENGINE_STATE.phase='Waiting';
  STREAM_ENGINE_STATE.done=0;
  STREAM_ENGINE_STATE.total=0;
  STREAM_ENGINE_STATE.error=null;
  STREAM_PICK_CACHE=null;
  STREAM_PICK_PENDING=false;
}

function clearEngineCache(){
  ENGINE_CACHE.canonicalSessions.clear();
  ENGINE_CACHE.tagRecords.clear();
  ENGINE_CACHE.manifests.clear();
  ENGINE_CACHE.models.clear();
  ENGINE_CACHE.resolution.clear();
  ENGINE_CACHE.evidence.clear();
  ENGINE_CACHE.inventory.clear();
  ENGINE_CACHE.historicalAll=null;
  ENGINE_CACHE.historicalBySubject.clear();
  streamEngineReset();
}

function yieldToBrowser(){
  return new Promise(resolve=>{
    if('requestIdleCallback' in window){
      requestIdleCallback(()=>resolve(),{timeout:60});
    }else{
      setTimeout(resolve,0);
    }
  });
}

function renderStreamProgress(){
  if(view==='home'&&!streamFeedback){
    try{render()}catch(e){console.warn('DBD progress render skipped',e)}
  }
}

async function schedulerPickAsync(token){
  STREAM_ENGINE_STATE.phase='Reading Stream Diet';
  STREAM_ENGINE_STATE.done=0;
  STREAM_ENGINE_STATE.total=0;
  renderStreamProgress();
  await yieldToBrowser();
  if(token!==STREAM_ENGINE_STATE.token)return undefined;

  const subjects=(DATA.subjectRegistry||[])
    .map(normalizeStreamPolicyRecord)
    .filter(s=>s.active!==false&&Number(s.streamWeight)>0);

  if(!subjects.length){
    STREAM_ENGINE_STATE.phase='All subjects are muted';
    return null;
  }

  STREAM_ENGINE_STATE.phase='Checking eligible inventory';
  STREAM_ENGINE_STATE.total=subjects.length;
  renderStreamProgress();

  const eligible=[];
  for(let i=0;i<subjects.length;i++){
    if(token!==STREAM_ENGINE_STATE.token)return undefined;
    const s=subjects[i];
    STREAM_ENGINE_STATE.phase=`Checking ${s.name}`;
    STREAM_ENGINE_STATE.done=i;
    renderStreamProgress();
    await yieldToBrowser();

    let has=false;
    try{
      const bank=canonicalInventoryForSubject(s.id);
      if(bank.length)has=true;
      else if(s.legacyStreamEnabled!==false){
        const hist=historicalCardsForSubject(s.id);
        if(hist.length)has=true;
      }
    }catch(e){
      console.warn('Inventory check failed for',s.name,e);
    }
    if(has)eligible.push(s);
  }

  STREAM_ENGINE_STATE.done=STREAM_ENGINE_STATE.total;
  renderStreamProgress();
  await yieldToBrowser();

  if(token!==STREAM_ENGINE_STATE.token)return undefined;
  if(!eligible.length){
    STREAM_ENGINE_STATE.phase='No eligible Stream inventory';
    return null;
  }

  STREAM_ENGINE_STATE.phase='Building concept evidence';
  STREAM_ENGINE_STATE.done=0;
  STREAM_ENGINE_STATE.total=eligible.length;
  renderStreamProgress();

  const subjectCandidates=[];

  for(let i=0;i<eligible.length;i++){
    if(token!==STREAM_ENGINE_STATE.token)return undefined;
    const s=eligible[i];

    STREAM_ENGINE_STATE.phase=`Indexing ${s.name}`;
    STREAM_ENGINE_STATE.done=i;
    renderStreamProgress();
    await yieldToBrowser();

    try{
      const ev=conceptEvidenceV3(s.id);
      const conceptCandidates=[];

      for(const e of ev){
        const bank=bankForConceptPolicy(s,e.concept.id);
        const hist=historyForConceptPolicy(s,e.concept.id);
        if(!bank.length&&!hist.length)continue;
        conceptCandidates.push({
          e,
          score:conceptPriority(e,s),
          bank,
          hist
        });
      }

      if(conceptCandidates.length){
        conceptCandidates.sort((a,b)=>b.score-a.score||a.e.seen-b.e.seen);
        subjectCandidates.push({
          subject:s,
          concept:conceptCandidates[0],
          deficit:dietDeficit(s,eligible)
        });
      }
    }catch(e){
      console.warn('Concept indexing failed for',s.name,e);
    }

    STREAM_ENGINE_STATE.done=i+1;
    renderStreamProgress();
    await yieldToBrowser();
  }

  if(token!==STREAM_ENGINE_STATE.token)return undefined;
  if(!subjectCandidates.length){
    STREAM_ENGINE_STATE.phase='No drillable concept could be resolved';
    return null;
  }

  STREAM_ENGINE_STATE.phase='Selecting question';
  renderStreamProgress();
  await yieldToBrowser();

  subjectCandidates.sort((a,b)=>{
    const diet=b.deficit-a.deficit;
    if(Math.abs(diet)>.0001)return diet;
    return b.concept.score-a.concept.score;
  });

  const chosen=subjectCandidates[0];
  const s=chosen.subject;
  const e=chosen.concept.e;
  const cid=e.concept.id;
  let item=null;

  if(chosen.concept.bank.length){
    const q=chosen.concept.bank[0];
    item=bankQuestionToStreamCard(q,s,e.concept);
  }else if(chosen.concept.hist.length){
    const c=chosen.concept.hist[0];
    item={
      ...c,
      uid:`hist:${c.id}`,
      subjectId:s.id,
      subjectName:s.name,
      conceptIds:cardConceptIds(c,s.id),
      primaryConceptId:cid,
      conceptName:e.concept.name,
      sourceType:'history'
    };
  }

  if(!item){
    STREAM_ENGINE_STATE.phase='No eligible question found';
    return null;
  }

  return {
    ...item,
    conceptState:e.state,
    priorityScore:chosen.concept.score,
    dietWeight:s.streamWeight,
    targetDifficulty:s.targetDifficulty,
    legacyAllowed:s.legacyStreamEnabled!==false
  };
}

function scheduleStreamPick(force=false){
  if(streamFeedback||view!=='home')return;
  if(!force&&['pending','ready','empty'].includes(STREAM_ENGINE_STATE.status))return;

  const token=++STREAM_ENGINE_STATE.token;
  STREAM_ENGINE_STATE.status='pending';
  STREAM_ENGINE_STATE.phase='Starting Stream engine';
  STREAM_ENGINE_STATE.done=0;
  STREAM_ENGINE_STATE.total=0;
  STREAM_ENGINE_STATE.error=null;
  STREAM_PICK_CACHE=null;
  STREAM_PICK_PENDING=true;

  setTimeout(async()=>{
    try{
      const pick=await schedulerPickAsync(token);
      if(token!==STREAM_ENGINE_STATE.token)return;

      STREAM_PICK_PENDING=false;
      if(pick===undefined)return;

      if(pick){
        STREAM_PICK_CACHE=pick;
        STREAM_ENGINE_STATE.status='ready';
        STREAM_ENGINE_STATE.phase='Ready';
      }else{
        STREAM_PICK_CACHE=null;
        STREAM_ENGINE_STATE.status='empty';
      }
    }catch(e){
      if(token!==STREAM_ENGINE_STATE.token)return;
      console.error('Stream scheduler failed',e);
      STREAM_PICK_PENDING=false;
      STREAM_PICK_CACHE=null;
      STREAM_ENGINE_STATE.status='error';
      STREAM_ENGINE_STATE.error=e?.message||String(e);
      STREAM_ENGINE_STATE.phase='Stream engine error';
    }
    if(view==='home'&&!streamFeedback)render();
  },0);
}

function retryStreamEngine(){
  streamEngineReset();
  render();
  setTimeout(()=>scheduleStreamPick(true),0);
}

function streamProgressPercent(){
  const t=Number(STREAM_ENGINE_STATE.total)||0;
  const d=Number(STREAM_ENGINE_STATE.done)||0;
  if(!t)return STREAM_ENGINE_STATE.status==='pending'?8:0;
  return Math.max(8,Math.min(96,Math.round((d/t)*92+4)));
}

function streamHome(){
  const b=DATA.streamEngine?.burst||{count:0,correct:0};
  const size=Math.max(1,Number(DATA.scheduler?.burstSize)||5);

  if(streamDismissed){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Paused</span></div><div class="stream-empty">Stream is resting. <button class="text-action" onclick="streamDismissed=false;streamEngineReset();render();setTimeout(()=>scheduleStreamPick(true),0)">Resume</button></div></section>`;
  }

  if(b.count>=size){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Burst complete</span></div><div class="stream-card smart"><div class="burst-complete"><strong>${b.correct||0}/${b.count||0}</strong><span>correct in this burst</span><div class="binary-actions"><button class="binary-button" onclick="streamDismissed=true;render()">DONE</button><button class="binary-button true" onclick="resetBurst()">5 MORE</button></div></div></div></section>`;
  }

  if(streamFeedback?.card){
    const c=streamFeedback.card,expected=c.truth?'TRUE':'FALSE';
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${esc(c.subjectName||c.subject||'')}</span></div><div class="stream-card smart"><div class="stream-feedback ${streamFeedback.correct?'good':'bad'}"><div><strong>${streamFeedback.correct?'CORRECT ✓':'NOT QUITE'}</strong><small>Correct response: ${expected}${c.explanation?` · ${esc(c.explanation)}`:''}</small></div><div class="stream-next-indicator">Next question…</div></div></div></section>`;
  }

  if(STREAM_ENGINE_STATE.status==='error'){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Engine error</span></div><div class="stream-error-state"><strong>Stream could not prepare.</strong><p>Your Sessions, History, Subject data, and Vault are still intact. Retry the scheduler; if the error repeats, the message below is useful for diagnosis.</p><button class="button tiny" onclick="retryStreamEngine()">RETRY STREAM</button><code>${esc(STREAM_ENGINE_STATE.error||'Unknown Stream error')}</code></div></section>`;
  }

  if(STREAM_ENGINE_STATE.status==='empty'){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>No eligible inventory</span></div><div class="stream-empty-state"><strong>Nothing is eligible for Stream right now.</strong><p>${esc(STREAM_ENGINE_STATE.phase||'No eligible subjects or questions were found.')} This is a completed state, not a loading state. Adjust Stream Diet, activate a subject, allow legacy questions, or import a Question Bank.</p><div class="stream-loading-actions"><button class="button tiny" onclick="retryStreamEngine()">CHECK AGAIN</button></div></div></section>`;
  }

  if(STREAM_ENGINE_STATE.status==='idle'){
    setTimeout(()=>scheduleStreamPick(),0);
  }

  if(STREAM_ENGINE_STATE.status==='pending'||STREAM_ENGINE_STATE.status==='idle'){
    const pct=streamProgressPercent();
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Preparing</span></div><div class="stream-loading-card"><div class="stream-loading-head"><strong>Preparing Stream</strong><span>${pct}%</span></div><div class="stream-loading-phase">${esc(STREAM_ENGINE_STATE.phase||'Starting')}</div><div class="stream-loading-bar"><div class="stream-loading-fill" style="width:${pct}%"></div></div><div class="stream-index-hint">Stream preparation now yields back to the browser between subjects, so Stream Diet and the rest of Home should remain interactive.</div><div class="stream-loading-actions"><button class="button tiny" onclick="retryStreamEngine()">RESTART ENGINE</button></div></div></section>`;
  }

  const pick=STREAM_PICK_CACHE;
  if(!pick){
    STREAM_ENGINE_STATE.status='empty';
    STREAM_ENGINE_STATE.phase='Scheduler finished without a question';
    return streamHome();
  }

  return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${b.count+1} / ${size} · scheduler beta</span></div><div class="stream-card smart"><div class="stream-intent"><span class="stream-state ${pick.conceptState}">${esc(pick.conceptState)}</span><span class="stream-concept">${esc(pick.subjectName||pick.subject)} · ${esc(pick.conceptName||'Legacy concept')}</span></div><div class="stream-prompt">${esc(pick.prompt)}</div>${pick.proposed!==null&&pick.proposed!==undefined?`<div class="stream-proposal"><small>Proposed answer</small><strong>${esc(pick.proposed)}</strong></div>`:''}<div class="binary-actions"><button class="binary-button true" onclick="answerSmartStream(true)">TRUE</button><button class="binary-button false" onclick="answerSmartStream(false)">FALSE</button></div></div></section>`;
}

function resetBurst(){
  DATA.streamEngine.burst={count:0,correct:0,startedAt:new Date().toISOString()};
  streamDismissed=false;
  save();
  streamEngineReset();
  render();
  setTimeout(()=>scheduleStreamPick(true),0);
}

function streamPolicyUpdated(s){
  s.policyUpdatedAt=new Date().toISOString();
  clearEngineCache();
  save();
  render();
  setTimeout(()=>scheduleStreamPick(true),0);
}

function answerSmartStream(value){
  const pick=streamFeedback?.card||STREAM_PICK_CACHE;
  if(!pick||streamFeedback)return;

  const correct=Boolean(value)===Boolean(pick.truth);
  const now=new Date().toISOString();

  DATA.streamEngine=DATA.streamEngine||{
    attempts:[],questionSeen:{},recentConceptIds:[],recentSubjectIds:[],
    burst:{count:0,correct:0,startedAt:null}
  };

  DATA.streamEngine.questionSeen[pick.uid]=(DATA.streamEngine.questionSeen[pick.uid]||0)+1;
  DATA.streamEngine.recentConceptIds=[pick.primaryConceptId,...(DATA.streamEngine.recentConceptIds||[])].filter(Boolean).slice(0,8);
  DATA.streamEngine.recentSubjectIds=[pick.subjectId,...(DATA.streamEngine.recentSubjectIds||[])].filter(Boolean).slice(0,12);

  DATA.streamEngine.attempts.push({
    id:makeUid('stream'),
    questionUid:pick.uid,
    subjectId:pick.subjectId,
    conceptIds:pick.conceptIds?.length?pick.conceptIds:[pick.primaryConceptId],
    primaryConceptId:pick.primaryConceptId,
    answeredAt:now,
    selected:Boolean(value),
    correct,
    confidence:'sure',
    sourceType:pick.sourceType,
    targetDifficulty:pick.targetDifficulty||'adaptive'
  });

  DATA.streamEngine.attempts=DATA.streamEngine.attempts.slice(-5000);

  const b=DATA.streamEngine.burst;
  b.count=(b.count||0)+1;
  b.correct=(b.correct||0)+(correct?1:0);
  b.startedAt=b.startedAt||now;

  streamFeedback={card:pick,correct,selected:Boolean(value)};
  STREAM_PICK_CACHE=null;
  STREAM_ENGINE_STATE.status='idle';

  save();
  render();

  setTimeout(()=>{
    if(streamFeedback?.card?.uid===pick.uid){
      streamFeedback=null;
      streamEngineReset();
      render();
      setTimeout(()=>scheduleStreamPick(true),0);
    }
  },720);
}

/* During boot, the engine now begins after Home is painted. */
function boot0984(){
  try{
    LAST_STRUCTURE_SIGNATURE=structureSignature(DATA);
    streamEngineReset();
    render();
    setTimeout(()=>scheduleStreamPick(true),25);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD could not finish startup.</h2><p>Your browser data is still stored under <strong>dbd_gazali</strong>; this patch does not wipe it.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}
/* ================= END DBD v0.9.8.4.1 STREAM STARTUP PATCH ================= */


/* ================= DBD v0.9.8.4.1 BANK-CONCEPT BRIDGE =================
   A Question Bank is now sufficient to start Stream.

   Before this patch, the scheduler required a Concept Model first. A subject
   could therefore contain 100 valid Bank questions but 0 concepts, leaving
   Stream with "No drillable concept could be resolved."

   v0.9.8.4.1 makes the Bank itself a valid source of provisional concepts.
   A later Concept Manifest can still supply the canonical hierarchy.
   ====================================================================== */

function fallbackBankConceptId(subjectId){
  return `bank_general_${String(subjectId||'subject')}`;
}

function humanizeConceptToken(value){
  let s=String(value||'').trim();
  const legacy=s.match(/^legacy_(.+)_([a-z0-9]{3,10})$/i);
  if(legacy)s=legacy[1];
  s=s
    .replace(/^bank_general_/i,'General ')
    .replace(/^concept[_-]/i,'')
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!s)return'General';
  return s.split(' ').map(word=>{
    const w=word.toLowerCase();
    if(['sat','osn','tka','utbk','ielts'].includes(w))return w.toUpperCase();
    return w.charAt(0).toUpperCase()+w.slice(1);
  }).join(' ');
}

function questionConceptIdsForBank(q,subjectId){
  const ids=[q?.primaryConceptId,...(q?.conceptIds||[])].filter(Boolean).map(String);
  return [...new Set(ids.length?ids:[fallbackBankConceptId(subjectId)])];
}

function bankConceptNameForQuestion(q,id,subjectId){
  if(q?.conceptNames&&typeof q.conceptNames==='object'&&q.conceptNames[id])return String(q.conceptNames[id]);
  if(q?.primaryConceptId===id&&q?.primaryConceptName)return String(q.primaryConceptName);
  if(id===fallbackBankConceptId(subjectId))return'General Bank';
  return humanizeConceptToken(id);
}

function provisionalBankConcepts(subjectId){
  const questions=(DATA.questionBank||[]).filter(q=>q.subjectId===subjectId&&q.streamEligible!==false&&!q.paperRequired&&!q.calculatorRequired);
  const map=new Map();

  for(const q of questions){
    for(const id of questionConceptIdsForBank(q,subjectId)){
      const name=bankConceptNameForQuestion(q,id,subjectId);
      if(!map.has(id)){
        map.set(id,{
          id,
          name,
          parentId:null,
          aliases:[name],
          kind:'concept',
          provisional:true,
          source:'question_bank',
          bankCount:0
        });
      }
      map.get(id).bankCount++;
    }
  }
  return [...map.values()];
}

function subjectConceptModel(subjectId){
  if(ENGINE_CACHE.models.has(subjectId))return ENGINE_CACHE.models.get(subjectId);

  const manifest=manifestForSubject(subjectId);
  const tags=tagRecords(subjectId);
  const bankConcepts=provisionalBankConcepts(subjectId);
  let concepts=[];
  let canonical=false;
  let unresolved=tags.length;
  let revision=0;

  if(!manifest){
    const legacy=inferLegacyConcepts(subjectId);
    const merged=new Map();

    for(const c of [...legacy,...bankConcepts]){
      if(!merged.has(c.id))merged.set(c.id,{...c});
      else{
        const old=merged.get(c.id);
        old.bankCount=(old.bankCount||0)+(c.bankCount||0);
        old.aliases=[...new Set([...(old.aliases||[]),...(c.aliases||[])])];
        if((old.name||'').startsWith('Legacy ')&&c.name)old.name=c.name;
      }
    }

    concepts=[...merged.values()];
  }else{
    canonical=true;
    revision=manifest.revision||1;

    const manifestConcepts=(manifest.concepts||[]).map(c=>({...c,provisional:false}));
    concepts=[...manifestConcepts];

    const knownIds=new Set(manifestConcepts.map(c=>String(c.id)));
    const aliasToId=new Map();
    for(const c of manifestConcepts){
      for(const v of [c.id,c.name,...(c.aliases||[])])if(v)aliasToId.set(aliasNorm(v),c.id);
    }

    const unresolvedTags=tags.filter(t=>!aliasToId.has(t.key));
    unresolved=unresolvedTags.length;

    if(unresolvedTags.length){
      const rootId=`legacy_unresolved_${subjectId}`;
      concepts.push({id:rootId,name:'Legacy / unresolved',parentId:null,kind:'container',provisional:true});
      for(const t of unresolvedTags){
        const id=stableLegacyConceptId(t.name);
        if(!knownIds.has(String(id))){
          concepts.push({id,name:t.name,parentId:rootId,aliases:[t.name],kind:'concept',provisional:true,count:t.count,source:'legacy'});
          knownIds.add(String(id));
        }
      }
    }

    const unresolvedBank=bankConcepts.filter(c=>{
      if(knownIds.has(String(c.id)))return false;
      const mapped=aliasToId.get(aliasNorm(c.name));
      return !mapped;
    });

    if(unresolvedBank.length){
      const rootId=`bank_provisional_${subjectId}`;
      concepts.push({id:rootId,name:'Bank / provisional',parentId:null,kind:'container',provisional:true,source:'question_bank'});
      for(const c of unresolvedBank){
        concepts.push({...c,parentId:rootId});
        knownIds.add(String(c.id));
      }
    }
  }

  const model={concepts,canonical,unresolved,revision};
  ENGINE_CACHE.models.set(subjectId,model);
  return model;
}

function bankForConceptPolicy(subject,cid){
  const all=canonicalInventoryForSubject(subject.id).filter(q=>questionConceptIdsForBank(q,subject.id).includes(String(cid)));
  if(!all.length)return[];

  const target=subject.targetDifficulty||'adaptive';
  const seen=DATA.streamEngine?.questionSeen||{};

  return all.slice().sort((a,b)=>{
    const sa=seen[a.uid]||0,sb=seen[b.uid]||0;
    const scoreA=sa*12-difficultyPreference(a,target)*3;
    const scoreB=sb*12-difficultyPreference(b,target)*3;
    return scoreA-scoreB||simpleHash(a.uid)-simpleHash(b.uid);
  });
}

function bankQuestionToStreamCard(q,subjectRec,concept){
  const ids=questionConceptIdsForBank(q,q.subjectId||subjectRec.id);
  const primary=q.primaryConceptId||ids[0]||concept?.id||fallbackBankConceptId(subjectRec.id);
  const conceptName=concept?.name||bankConceptNameForQuestion(q,primary,subjectRec.id);

  if(q.type==='true_false'||q.type==='stream_statement'){
    const truth=typeof q.answer==='boolean'?q.answer:['true','t','benar','yes','1'].includes(norm(q.answer));
    return{
      uid:q.uid,subjectId:q.subjectId,subjectName:subjectRec.name,
      conceptIds:ids,primaryConceptId:primary,conceptName,
      prompt:q.statement||q.prompt||'',proposed:null,truth,
      explanation:q.explanation||'',sourceType:'bank'
    };
  }

  if(q.choices&&typeof q.choices==='object'){
    const correctKey=String(q.answer);
    const keys=Object.keys(q.choices);
    const wrong=keys.filter(k=>k!==correctKey);
    const n=DATA.streamEngine?.questionSeen?.[q.uid]||0;
    const truth=(simpleHash(q.uid+':'+n)%2)===0||!wrong.length;
    const key=truth?correctKey:wrong[simpleHash(q.uid+':wrong:'+n)%wrong.length];

    return{
      uid:q.uid,subjectId:q.subjectId,subjectName:subjectRec.name,
      conceptIds:ids,primaryConceptId:primary,conceptName,
      prompt:q.prompt||'',proposed:String(q.choices[key]??key),truth,
      explanation:q.explanation||'',sourceType:'bank'
    };
  }

  return null;
}

function normalizeBankQuestions(raw,subjectRec,manifest){
  const packId=String(raw.bank_id||raw.bankId||raw.id||makeUid('bank'));
  const qs=(raw.questions||raw.bank?.questions||raw.question_bank||raw.questionBank||[]);

  return qs.map((q,i)=>{
    if(!q)return null;

    const uid=String(q.uid||`${packId}:${q.id||i+1}`);
    const rawRefs=(q.concept_ids||q.conceptIds||q.tags||[]).filter(Boolean);
    const rawPrimary=q.primary_concept_id||q.primaryConceptId||rawRefs[0]||null;

    let refs=rawRefs.map(x=>resolveImportedConcept(subjectRec.id,x,manifest)).filter(Boolean);
    let primary=rawPrimary?resolveImportedConcept(subjectRec.id,rawPrimary,manifest):null;

    if(!primary&&!refs.length){
      primary=fallbackBankConceptId(subjectRec.id);
      refs=[primary];
    }else if(!primary){
      primary=refs[0];
    }

    const conceptIds=[...new Set([primary,...refs].filter(Boolean))];
    const concepts=manifest?.concepts||manifestForSubject(subjectRec.id)?.concepts||[];
    const names={};

    for(let j=0;j<conceptIds.length;j++){
      const id=conceptIds[j];
      const rawRef=rawRefs[j]||rawPrimary||id;
      const canonical=concepts.find(c=>String(c.id)===String(id));
      names[id]=canonical?.name||humanizeConceptToken(rawRef);
    }

    const primaryName=
      q.primary_concept_name||
      q.primaryConceptName||
      concepts.find(c=>String(c.id)===String(primary))?.name||
      names[primary]||
      humanizeConceptToken(rawPrimary||primary);

    const type=String(q.type||'mcq').toLowerCase();
    const paperRequired=Boolean(q.paper_required??q.paperRequired??false);
    const calculatorRequired=Boolean(q.calculator_required??q.calculatorRequired??false);
    const supported=type==='true_false'||type==='stream_statement'||(q.choices&&typeof q.choices==='object');
    const requestedEligible=q.stream_eligible!==false&&q.streamEligible!==false;

    return{
      uid,id:String(q.id||`q${i+1}`),bankId:packId,
      subjectId:subjectRec.id,subjectName:subjectRec.name,
      primaryConceptId:primary,primaryConceptName:primaryName,
      conceptIds,conceptNames:names,
      type,statement:String(q.statement||''),
      prompt:String(q.prompt||q.question||q.statement||''),
      choices:q.choices&&typeof q.choices==='object'?q.choices:null,
      answer:q.answer,explanation:String(q.explanation||''),
      difficulty:String(q.difficulty||'medium'),
      streamEligible:Boolean(requestedEligible&&supported&&!paperRequired&&!calculatorRequired),
      paperRequired,calculatorRequired,
      estimatedSeconds:Number(q.estimated_seconds??q.estimatedSeconds??0)||null,
      source:String(raw.source||''),importedAt:new Date().toISOString()
    };
  }).filter(Boolean);
}

function repairExistingBankConceptMetadata(){
  let changed=0;

  for(const q of DATA.questionBank||[]){
    if(!q?.subjectId)continue;

    let ids=[q.primaryConceptId,...(q.conceptIds||[])].filter(Boolean).map(String);
    ids=[...new Set(ids)];

    if(!ids.length){
      const fallback=fallbackBankConceptId(q.subjectId);
      q.primaryConceptId=fallback;
      q.conceptIds=[fallback];
      ids=[fallback];
      changed++;
    }else{
      if(!q.primaryConceptId){
        q.primaryConceptId=ids[0];
        changed++;
      }
      if(!Array.isArray(q.conceptIds)||q.conceptIds.length!==ids.length){
        q.conceptIds=ids;
        changed++;
      }
    }

    if(!q.conceptNames||typeof q.conceptNames!=='object'){
      q.conceptNames={};
      changed++;
    }

    for(const id of ids){
      if(!q.conceptNames[id]){
        q.conceptNames[id]=bankConceptNameForQuestion(q,id,q.subjectId);
        changed++;
      }
    }

    if(!q.primaryConceptName){
      q.primaryConceptName=q.conceptNames[q.primaryConceptId]||humanizeConceptToken(q.primaryConceptId);
      changed++;
    }
  }

  if(changed){
    try{
      DATA.appVersion=APP_VERSION;
      DATA.schemaVersion=DATA_SCHEMA_VERSION;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA));
    }catch(e){
      console.warn('Bank concept repair could not be persisted immediately',e);
    }
  }

  return changed;
}

function subjectBankHtml(subjectId){
  const all=(DATA.questionBank||[]).filter(q=>q.subjectId===subjectId);
  const eligible=all.filter(q=>q.streamEligible!==false&&!q.paperRequired&&!q.calculatorRequired);
  const seen=DATA.streamEngine?.questionSeen||{};
  const seenCount=eligible.filter(q=>(seen[q.uid]||0)>0).length;
  const unseen=Math.max(0,eligible.length-seenCount);
  const conceptMap=new Map();

  for(const q of eligible){
    for(const id of questionConceptIdsForBank(q,subjectId)){
      conceptMap.set(id,(conceptMap.get(id)||0)+1);
    }
  }

  const model=subjectConceptModel(subjectId);
  const names=new Map(model.concepts.map(c=>[String(c.id),c.name]));
  const evidence=conceptEvidenceV3(subjectId);
  const rows=[...conceptMap.entries()].sort((a,b)=>b[1]-a[1]);

  return `<div class="bank-view"><div class="bank-overview"><div class="bank-stat"><strong>${all.length}</strong><span>Total bank</span></div><div class="bank-stat"><strong>${eligible.length}</strong><span>Stream safe</span></div><div class="bank-stat"><strong>${unseen}</strong><span>Unseen</span></div><div class="bank-stat"><strong>${seenCount}</strong><span>Seen</span></div></div><div class="stream-safe-note">Bank questions are immediately usable by Stream. If no Concept Manifest exists yet, DBD creates provisional concepts from the Bank and can canonicalize them later.</div>${rows.length?`<div class="bank-concept-list">${rows.slice(0,40).map(([id,n])=>`<div class="bank-concept-row"><div><strong>${esc(names.get(String(id))||humanizeConceptToken(id))}</strong><small>${evidence.find(e=>String(e.concept.id)===String(id))?.state||'new'} concept state</small></div><span>${n}</span></div>`).join('')}</div>`:'<div class="subject-empty">No dedicated Stream Bank questions yet.</div>'}</div>`;
}

function boot09841(){
  try{
    LAST_STRUCTURE_SIGNATURE=structureSignature(DATA);
    const repaired=repairExistingBankConceptMetadata();
    clearEngineCache();
    render();
    if(repaired)console.info(`DBD repaired ${repaired} Bank concept metadata field(s).`);
    setTimeout(()=>scheduleStreamPick(true),25);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD could not finish startup.</h2><p>Your browser data is still stored under <strong>dbd_gazali</strong>; this patch does not wipe it.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}
/* ================= END DBD v0.9.8.4.1 BANK-CONCEPT BRIDGE ================= */


/* ================= DBD 0.9.8.4.1 REWRITE R2 =================
   Hard guarantee:
   If an ACTIVE subject has at least one Stream-safe Bank question,
   DBD can serve it even when no Concept Manifest or legacy concept exists.

   A Manifest improves/canonicalizes the knowledge map; it is never a gate.
   ============================================================ */

function r2HumanConcept(value){
  let s=String(value||'').trim();
  if(!s)return'General Bank';
  const legacy=s.match(/^legacy_(.+)_([a-z0-9]+)$/i);
  if(legacy)s=legacy[1];
  s=s.replace(/^bank_general_/i,'General ')
     .replace(/^concept[_-]/i,'')
     .replace(/[_-]+/g,' ')
     .replace(/\s+/g,' ')
     .trim();
  if(!s)return'General Bank';
  return s.split(' ').map(w=>{
    const low=w.toLowerCase();
    if(['sat','osn','utbk','tka','ielts'].includes(low))return low.toUpperCase();
    return low.charAt(0).toUpperCase()+low.slice(1);
  }).join(' ');
}

function r2BankConceptIds(q,subjectId){
  const ids=[
    q?.primaryConceptId,
    q?.primary_concept_id,
    ...(Array.isArray(q?.conceptIds)?q.conceptIds:[]),
    ...(Array.isArray(q?.concept_ids)?q.concept_ids:[])
  ].filter(Boolean).map(String);

  if(ids.length)return [...new Set(ids)];

  const tags=Array.isArray(q?.tags)?q.tags.filter(Boolean).map(String):[];
  if(tags.length)return [...new Set(tags.map(t=>stableLegacyConceptId(t)))];

  return [`bank_general_${subjectId}`];
}

function r2ConceptName(q,id,subjectId){
  if(q?.conceptNames&&typeof q.conceptNames==='object'&&q.conceptNames[id])return String(q.conceptNames[id]);
  if(q?.primaryConceptName&&String(q.primaryConceptId)===String(id))return String(q.primaryConceptName);
  if(q?.primary_concept_name&&String(q.primary_concept_id)===String(id))return String(q.primary_concept_name);
  if(String(id)===`bank_general_${subjectId}`)return'General Bank';

  const tags=Array.isArray(q?.tags)?q.tags:[];
  const matchingTag=tags.find(t=>String(stableLegacyConceptId(t))===String(id));
  if(matchingTag)return String(matchingTag);

  return r2HumanConcept(id);
}

function r2SafeBank(subjectId){
  return (DATA.questionBank||[]).filter(q=>{
    if(q.subjectId!==subjectId)return false;
    if(q.streamEligible===false||q.stream_eligible===false)return false;
    if(q.paperRequired===true||q.paper_required===true)return false;
    if(q.calculatorRequired===true||q.calculator_required===true)return false;

    const type=String(q.type||'mcq').toLowerCase();
    const choices=q.choices||q.options||null;
    return type==='true_false'||type==='stream_statement'||(choices&&typeof choices==='object');
  });
}

function canonicalInventoryForSubject(subjectId){
  if(ENGINE_CACHE.inventory.has(subjectId))return ENGINE_CACHE.inventory.get(subjectId);
  const rows=r2SafeBank(subjectId);
  ENGINE_CACHE.inventory.set(subjectId,rows);
  return rows;
}

function subjectConceptModel(subjectId){
  if(ENGINE_CACHE.models.has(subjectId))return ENGINE_CACHE.models.get(subjectId);

  const manifest=manifestForSubject(subjectId);
  const tags=tagRecords(subjectId);
  const bank=r2SafeBank(subjectId);
  const concepts=[];
  const byId=new Map();

  const addConcept=c=>{
    if(!c?.id)return;
    const id=String(c.id);
    if(!byId.has(id)){
      const row={...c,id};
      byId.set(id,row);
      concepts.push(row);
      return;
    }
    const old=byId.get(id);
    old.aliases=[...new Set([...(old.aliases||[]),...(c.aliases||[])])];
    old.bankCount=(old.bankCount||0)+(c.bankCount||0);
    if((!old.name||old.name===old.id)&&c.name)old.name=c.name;
  };

  let canonical=false;
  let revision=0;
  let unresolved=0;

  if(manifest){
    canonical=true;
    revision=manifest.revision||1;
    for(const c of manifest.concepts||[]){
      addConcept({...c,provisional:false});
    }
  }

  // Legacy concepts remain usable, but do not control Bank availability.
  if(!manifest){
    for(const c of inferLegacyConcepts(subjectId)||[]){
      addConcept({...c,provisional:true,source:c.source||'legacy'});
    }
  }else{
    const aliasMap=new Map();
    for(const c of concepts){
      for(const v of [c.id,c.name,...(c.aliases||[])])if(v)aliasMap.set(aliasNorm(v),c.id);
    }
    const unresolvedTags=tags.filter(t=>!aliasMap.has(t.key));
    unresolved=unresolvedTags.length;

    if(unresolvedTags.length){
      const root=`legacy_unresolved_${subjectId}`;
      addConcept({id:root,name:'Legacy / unresolved',parentId:null,kind:'container',provisional:true,source:'legacy'});
      for(const t of unresolvedTags){
        addConcept({
          id:stableLegacyConceptId(t.name),
          name:t.name,
          parentId:root,
          aliases:[t.name],
          kind:'concept',
          provisional:true,
          source:'legacy',
          count:t.count
        });
      }
    }
  }

  // CRITICAL: Bank questions themselves are a concept source.
  if(bank.length){
    const canonicalAlias=new Map();
    for(const c of concepts){
      for(const v of [c.id,c.name,...(c.aliases||[])])if(v)canonicalAlias.set(aliasNorm(v),c.id);
    }

    let provisionalRoot=null;

    for(const q of bank){
      const ids=r2BankConceptIds(q,subjectId);

      // Repair in memory and persist later through ordinary save.
      q.conceptIds=[...new Set(ids)];
      if(!q.primaryConceptId)q.primaryConceptId=ids[0];
      if(!q.conceptNames||typeof q.conceptNames!=='object')q.conceptNames={};

      for(const rawId of ids){
        const name=r2ConceptName(q,rawId,subjectId);
        q.conceptNames[rawId]=q.conceptNames[rawId]||name;

        const canonicalId=
          byId.has(String(rawId)) ? String(rawId) :
          canonicalAlias.get(aliasNorm(name)) ||
          canonicalAlias.get(aliasNorm(rawId)) ||
          null;

        if(canonicalId){
          // Keep question compatible with canonical ID when it can be resolved.
          q.conceptIds=q.conceptIds.map(x=>String(x)===String(rawId)?canonicalId:x);
          if(String(q.primaryConceptId)===String(rawId))q.primaryConceptId=canonicalId;
          continue;
        }

        if(manifest){
          if(!provisionalRoot){
            provisionalRoot=`bank_provisional_${subjectId}`;
            addConcept({
              id:provisionalRoot,
              name:'Bank / provisional',
              parentId:null,
              kind:'container',
              provisional:true,
              source:'question_bank'
            });
          }
        }

        addConcept({
          id:String(rawId),
          name,
          parentId:manifest?provisionalRoot:null,
          aliases:[name],
          kind:'concept',
          provisional:true,
          source:'question_bank',
          bankCount:1
        });
      }
    }
  }

  // Absolute fallback: if Bank exists, there must be at least one drillable concept.
  if(bank.length&&!concepts.some(c=>c.kind!=='container')){
    const id=`bank_general_${subjectId}`;
    addConcept({
      id,
      name:'General Bank',
      parentId:null,
      aliases:['General Bank'],
      kind:'concept',
      provisional:true,
      source:'question_bank',
      bankCount:bank.length
    });
    for(const q of bank){
      q.primaryConceptId=id;
      q.conceptIds=[id];
      q.primaryConceptName='General Bank';
      q.conceptNames={...(q.conceptNames||{}),[id]:'General Bank'};
    }
  }

  const model={concepts,canonical,unresolved,revision};
  ENGINE_CACHE.models.set(subjectId,model);
  return model;
}

function bankForConceptPolicy(subject,cid){
  const bank=r2SafeBank(subject.id);
  const target=subject.targetDifficulty||'adaptive';
  const seen=DATA.streamEngine?.questionSeen||{};

  const all=bank.filter(q=>r2BankConceptIds(q,subject.id).some(id=>String(id)===String(cid)));

  return all.slice().sort((a,b)=>{
    const sa=seen[a.uid]||0;
    const sb=seen[b.uid]||0;
    const scoreA=sa*12-difficultyPreference(a,target)*3;
    const scoreB=sb*12-difficultyPreference(b,target)*3;
    return scoreA-scoreB||simpleHash(a.uid)-simpleHash(b.uid);
  });
}

function r2BankToCard(q,subjectRec,concept){
  const ids=r2BankConceptIds(q,subjectRec.id);
  const primary=q.primaryConceptId||ids[0]||`bank_general_${subjectRec.id}`;
  const conceptName=concept?.name||r2ConceptName(q,primary,subjectRec.id);
  const type=String(q.type||'mcq').toLowerCase();

  if(type==='true_false'||type==='stream_statement'){
    const raw=q.answer;
    const truth=typeof raw==='boolean'?raw:['true','t','yes','1','benar'].includes(norm(raw));
    return{
      uid:q.uid||q.id,
      subjectId:subjectRec.id,
      subjectName:subjectRec.name,
      conceptIds:ids,
      primaryConceptId:primary,
      conceptName,
      prompt:q.statement||q.prompt||q.question||'',
      proposed:null,
      truth,
      explanation:q.explanation||'',
      sourceType:'bank'
    };
  }

  const choices=q.choices||q.options;
  if(!choices||typeof choices!=='object')return null;

  const keys=Object.keys(choices);
  if(!keys.length)return null;

  const correctKey=String(q.answer);
  let correctResolved=correctKey;

  // Support answers stored as the literal choice text.
  if(!Object.prototype.hasOwnProperty.call(choices,correctResolved)){
    const found=keys.find(k=>String(choices[k])===correctKey);
    if(found!==undefined)correctResolved=found;
  }

  // If answer is still not a key, serve the item as a normal MCQ proposition
  // using the raw answer as proposed text instead of making the Bank unusable.
  const wrong=keys.filter(k=>String(k)!==String(correctResolved));
  const seen=DATA.streamEngine?.questionSeen?.[q.uid||q.id]||0;
  const canKey=Object.prototype.hasOwnProperty.call(choices,correctResolved);
  const truth=(simpleHash(String(q.uid||q.id)+':'+seen)%2)===0||!wrong.length;

  let proposed;
  if(truth){
    proposed=canKey?String(choices[correctResolved]):String(q.answer??'');
  }else{
    const wk=wrong[simpleHash(String(q.uid||q.id)+':wrong:'+seen)%wrong.length];
    proposed=String(choices[wk]??wk);
  }

  return{
    uid:q.uid||q.id,
    subjectId:subjectRec.id,
    subjectName:subjectRec.name,
    conceptIds:ids,
    primaryConceptId:primary,
    conceptName,
    prompt:q.prompt||q.question||q.statement||'',
    proposed,
    truth,
    explanation:q.explanation||'',
    sourceType:'bank'
  };
}

function bankQuestionToStreamCard(q,subjectRec,concept){
  return r2BankToCard(q,subjectRec,concept);
}

async function schedulerPickAsync(token){
  STREAM_ENGINE_STATE.phase='Reading Stream Diet';
  STREAM_ENGINE_STATE.done=0;
  STREAM_ENGINE_STATE.total=0;
  renderStreamProgress();
  await yieldToBrowser();
  if(token!==STREAM_ENGINE_STATE.token)return undefined;

  const subjects=(DATA.subjectRegistry||[])
    .map(normalizeStreamPolicyRecord)
    .filter(s=>s.active!==false&&Number(s.streamWeight)>0);

  if(!subjects.length){
    STREAM_ENGINE_STATE.phase='All subjects are muted';
    return null;
  }

  const eligibleSubjects=subjects.filter(s=>{
    const bank=r2SafeBank(s.id);
    if(bank.length)return true;
    return s.legacyStreamEnabled!==false&&historicalCardsForSubject(s.id).length>0;
  });

  if(!eligibleSubjects.length){
    STREAM_ENGINE_STATE.phase='No active subject has Stream-safe inventory';
    return null;
  }

  STREAM_ENGINE_STATE.phase='Building concept evidence';
  STREAM_ENGINE_STATE.total=eligibleSubjects.length;
  STREAM_ENGINE_STATE.done=0;
  renderStreamProgress();

  const subjectCandidates=[];

  for(let i=0;i<eligibleSubjects.length;i++){
    if(token!==STREAM_ENGINE_STATE.token)return undefined;
    const s=eligibleSubjects[i];

    STREAM_ENGINE_STATE.phase=`Indexing ${s.name}`;
    STREAM_ENGINE_STATE.done=i;
    renderStreamProgress();
    await yieldToBrowser();

    let conceptCandidates=[];

    try{
      const model=subjectConceptModel(s.id);
      const evidence=conceptEvidenceV3(s.id);

      for(const c of model.concepts.filter(c=>c.kind!=='container')){
        const e=evidence.find(x=>String(x.concept.id)===String(c.id))||{
          concept:c,
          state:'new',
          seen:0,
          correct:0,
          secureCorrect:0,
          wrong:0,
          unsure:0,
          guess:0,
          dontKnow:0,
          skipped:0,
          weightedPositive:0,
          weightedTotal:0,
          questionVariety:0,
          dayVariety:0,
          lastSeenAt:null,
          sources:{session:0,stream:0}
        };

        const bank=bankForConceptPolicy(s,c.id);
        const hist=historyForConceptPolicy(s,c.id);
        if(bank.length||hist.length){
          conceptCandidates.push({
            e,
            score:conceptPriority(e,s),
            bank,
            hist
          });
        }
      }
    }catch(e){
      console.warn('R2 concept scheduler fallback for',s.name,e);
    }

    // HARD FALLBACK:
    // Any Stream-safe Bank inventory is directly schedulable even if concept
    // construction/evidence has failed for an unforeseen legacy shape.
    if(!conceptCandidates.length){
      const bank=r2SafeBank(s.id);
      if(bank.length){
        const q=bank.slice().sort((a,b)=>{
          const seen=DATA.streamEngine?.questionSeen||{};
          return (seen[a.uid||a.id]||0)-(seen[b.uid||b.id]||0);
        })[0];

        const ids=r2BankConceptIds(q,s.id);
        const cid=ids[0]||`bank_general_${s.id}`;
        const c={
          id:cid,
          name:r2ConceptName(q,cid,s.id),
          parentId:null,
          kind:'concept',
          provisional:true,
          source:'question_bank'
        };

        conceptCandidates.push({
          e:{
            concept:c,state:'new',seen:0,correct:0,secureCorrect:0,wrong:0,
            unsure:0,guess:0,dontKnow:0,skipped:0,weightedPositive:0,
            weightedTotal:0,questionVariety:0,dayVariety:0,lastSeenAt:null,
            sources:{session:0,stream:0}
          },
          score:999,
          bank:[q],
          hist:[]
        });
      }
    }

    if(conceptCandidates.length){
      conceptCandidates.sort((a,b)=>b.score-a.score||a.e.seen-b.e.seen);
      subjectCandidates.push({
        subject:s,
        concept:conceptCandidates[0],
        deficit:dietDeficit(s,eligibleSubjects)
      });
    }

    STREAM_ENGINE_STATE.done=i+1;
    renderStreamProgress();
    await yieldToBrowser();
  }

  if(token!==STREAM_ENGINE_STATE.token)return undefined;

  if(!subjectCandidates.length){
    STREAM_ENGINE_STATE.phase='No Stream-safe question could be rendered';
    return null;
  }

  subjectCandidates.sort((a,b)=>{
    const diet=b.deficit-a.deficit;
    if(Math.abs(diet)>.0001)return diet;
    return b.concept.score-a.concept.score;
  });

  const chosen=subjectCandidates[0];
  const s=chosen.subject;
  const e=chosen.concept.e;
  let item=null;

  if(chosen.concept.bank.length){
    item=r2BankToCard(chosen.concept.bank[0],s,e.concept);
  }

  if(!item&&chosen.concept.hist.length){
    const c=chosen.concept.hist[0];
    item={
      ...c,
      uid:`hist:${c.id}`,
      subjectId:s.id,
      subjectName:s.name,
      conceptIds:cardConceptIds(c,s.id),
      primaryConceptId:e.concept.id,
      conceptName:e.concept.name,
      sourceType:'history'
    };
  }

  if(!item){
    STREAM_ENGINE_STATE.phase='Selected inventory could not be rendered';
    return null;
  }

  return{
    ...item,
    conceptState:e.state||'new',
    priorityScore:chosen.concept.score,
    dietWeight:s.streamWeight,
    targetDifficulty:s.targetDifficulty,
    legacyAllowed:s.legacyStreamEnabled!==false
  };
}

function r2RepairBank(){
  let touched=0;

  for(const q of DATA.questionBank||[]){
    if(!q?.subjectId)continue;

    if(q.paper_required!==undefined&&q.paperRequired===undefined){
      q.paperRequired=Boolean(q.paper_required);
      touched++;
    }
    if(q.calculator_required!==undefined&&q.calculatorRequired===undefined){
      q.calculatorRequired=Boolean(q.calculator_required);
      touched++;
    }
    if(q.stream_eligible!==undefined&&q.streamEligible===undefined){
      q.streamEligible=q.stream_eligible!==false;
      touched++;
    }

    const ids=r2BankConceptIds(q,q.subjectId);
    if(!Array.isArray(q.conceptIds)||!q.conceptIds.length){
      q.conceptIds=ids;
      touched++;
    }
    if(!q.primaryConceptId){
      q.primaryConceptId=ids[0];
      touched++;
    }
    if(!q.conceptNames||typeof q.conceptNames!=='object'){
      q.conceptNames={};
      touched++;
    }
    for(const id of ids){
      if(!q.conceptNames[id]){
        q.conceptNames[id]=r2ConceptName(q,id,q.subjectId);
        touched++;
      }
    }
    if(!q.primaryConceptName){
      q.primaryConceptName=r2ConceptName(q,q.primaryConceptId,q.subjectId);
      touched++;
    }
  }

  if(touched){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA))}
    catch(e){console.warn('R2 Bank repair persistence skipped',e)}
  }
  return touched;
}

function dataView(){
  const bytes=new Blob([JSON.stringify(DATA)]).size;
  const size=bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`;
  const persistentState=DATA.settings.persistentStorageGranted?'Granted':'Normal browser storage';
  const h=dataHealth();
  const deviceShort=String(DATA.settings.deviceId||'').split('_').pop()?.slice(0,8)||'local';
  const healthBad=h.orphans+h.duplicateBankIds;
  const healthWarn=h.unresolved;
  const active=(DATA.subjectRegistry||[]).filter(s=>s.active!==false).length;
  const muted=(DATA.subjectRegistry||[]).filter(s=>s.active===false).length;

  return `<section class="data-page">
    <div class="eyebrow">v1 beta ${APP_VERSION} · build ${BUILD_ID} · schema ${DATA.schemaVersion}</div>
    <h1>Data</h1>
    <div class="settings-group">
      <div class="settings-title">Storage</div>
      <div class="settings-row"><div><strong>Browser-local database</strong><small>dbd_gazali · device ${esc(deviceShort)}</small></div><span class="status-ok">ACTIVE</span></div>
      <div class="settings-row"><div><strong>Persistent storage</strong><small>Helps reduce browser eviction risk</small></div><button class="text-action" onclick="persistent()">${esc(persistentState)}</button></div>
    </div>
    <div class="settings-group">
      <div class="settings-title">Stream engine</div>
      <div class="metric-row"><span>Version</span><strong>${APP_VERSION}</strong></div>
      <div class="metric-row"><span>Build</span><strong>${BUILD_ID}</strong></div>
      <div class="metric-row"><span>Active subjects</span><strong>${active}</strong></div>
      <div class="metric-row"><span>Muted subjects</span><strong>${muted}</strong></div>
      <div class="metric-row"><span>Question Bank inventory</span><strong>${h.bank}</strong></div>
      <div class="metric-row"><span>Smart Stream attempts</span><strong>${h.streamAttempts}</strong></div>
      <p class="note">Question Bank inventory is schedulable even without a Concept Manifest. Missing concepts are provisionalized automatically.</p>
    </div>
    <div class="settings-group">
      <div class="settings-title">DBD Vault</div>
      <p class="note">Vault merge preserves subjects, Stream policy, manifests, Question Banks, Stream attempts, and scheduler evidence.</p>
      <div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div>
      <details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details>
    </div>
    <div class="settings-group">
      <div class="settings-title">Data health</div>
      <div class="metric-row"><span>Canonical subjects</span><strong>${h.subjects}</strong></div>
      <div class="metric-row"><span>Concept manifests</span><strong>${h.manifests}</strong></div>
      <div class="metric-row"><span>Orphan concept links</span><strong class="${h.orphans?'health-bad':'health-good'}">${h.orphans}</strong></div>
      <div class="metric-row"><span>Duplicate bank IDs</span><strong class="${h.duplicateBankIds?'health-bad':'health-good'}">${h.duplicateBankIds}</strong></div>
      <div class="metric-row"><span>Unresolved legacy tags</span><strong class="${h.unresolved?'health-warn':'health-good'}">${h.unresolved}</strong></div>
      <ul class="health-list">
        <li>Historical Sessions remain immutable.</li>
        <li>${healthBad?'Structural conflicts need attention.':'No structural conflicts detected.'}</li>
        <li>${healthWarn?'Some legacy tags remain provisional.':'No unresolved manifested legacy tags detected.'}</li>
      </ul>
    </div>
    <div class="settings-group">
      <div class="settings-title">Local storage info</div>
      <div class="metric-row"><span>Completed sessions</span><strong>${DATA.completedSessions.length}</strong></div>
      <div class="metric-row"><span>Ongoing sessions</span><strong>${DATA.activeSessions.length}</strong></div>
      <div class="metric-row"><span>Approx. DBD data</span><strong>${size}</strong></div>
    </div>
    <div class="settings-group danger-zone">
      <div class="settings-title">Danger zone</div>
      <div class="settings-row"><div><strong>Reset all DBD data</strong><small>Deletes local sessions, bank inventory, concept structure, and settings.</small></div><button class="button danger small" onclick="resetData()">RESET</button></div>
    </div>
    <p class="data-footnote">No accounts, Supabase, cloud database, or direct ChatGPT integration.</p>
  </section>`;
}

function boot09841r2(){
  try{
    LAST_STRUCTURE_SIGNATURE=structureSignature(DATA);
    const repaired=r2RepairBank();
    clearEngineCache();
    render();
    console.info(`DBD ${APP_VERSION} build ${BUILD_ID}; repaired ${repaired} Bank metadata field(s).`);
    setTimeout(()=>scheduleStreamPick(true),25);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD could not finish startup.</h2><p>Your browser data remains stored under <strong>dbd_gazali</strong>.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}
/* ================= END DBD 0.9.8.4.1 REWRITE R2 ================= */


/* ================= DBD v0.9.9 — INTELLIGENCE ARCHITECTURE =================
   Schema 6:
   - raw evidence + policy are persisted
   - scheduler scores are derived
   - score snapshots are stored only as audit/provenance
   - Stream comments and quality feedback become question evidence
   - alerts are derived; dismissal state is persisted
   - Auto Sessions compose existing Bank questions into normal Sessions
   ========================================================================== */

var autoSessionPanelOpen099=false;
var autoSessionSubject099='';
var autoSessionType099='repair';
var autoSessionCount099=15;

var streamCommentOpen099=false;
var streamCommentDraft099='';
var streamQualityFlags099=new Set();
var streamWhyOpen099=false;
var streamDraftQuestionUid099=null;

const QUALITY_FLAGS_099=[
  ['good','Good question'],
  ['too_easy','Too easy'],
  ['too_hard','Too hard'],
  ['ambiguous','Ambiguous'],
  ['not_useful','Not useful'],
  ['bad_concept_match','Bad concept match']
];

function schedulerDefaults099(){
  return{
    algorithmVersion:'0.9.9-weighted-1',
    weights:{
      subjectDiet:18,
      newConcept:22,
      weakness:38,
      recentFailure:9,
      uncertainty:18,
      overduePerDay:1.8,
      overdueCap:20,
      securePenalty:15,
      recentConceptPenalty:6,
      unseenQuestion:20,
      seenQuestionPenalty:8,
      recentQuestionPenalty:14,
      difficultyFit:4,
      goodQuestion:5,
      badQuestionPenalty:16,
      bankPreference:4
    },
    thresholds:{
      dueDays:6,
      recentFailureDays:14,
      secureAccuracy:.82,
      weakAccuracy:.55,
      alertFailureCount:2,
      lowBankUnseen:8,
      neglectedSubjectDays:14
    },
    autoSession:{
      defaultCount:15,
      maxPerConcept:5
    }
  };
}

function normalizeSchedulerConfig099(raw){
  const d=schedulerDefaults099();
  return{
    algorithmVersion:String(raw?.algorithmVersion||d.algorithmVersion),
    weights:{...d.weights,...(raw?.weights||{})},
    thresholds:{...d.thresholds,...(raw?.thresholds||{})},
    autoSession:{...d.autoSession,...(raw?.autoSession||{})}
  };
}

function normalizeFutureData(data){
  data.schemaVersion=6;
  data.appVersion=APP_VERSION;

  data.settings={persistentStorageGranted:false,deviceId:makeUid('device'),...(data.settings||{})};
  if(!data.settings.deviceId)data.settings.deviceId=makeUid('device');

  data.vault={lastMergedAt:null,lastExportedAt:null,...(data.vault||{})};
  data.scheduler={burstSize:5,...(data.scheduler||{})};
  data.schedulerConfig=normalizeSchedulerConfig099(data.schedulerConfig);

  data.questionFeedback=Array.isArray(data.questionFeedback)?data.questionFeedback:[];
  data.alertState=data.alertState&&typeof data.alertState==='object'?data.alertState:{};
  data.alertState.dismissedUntil=data.alertState.dismissedUntil&&typeof data.alertState.dismissedUntil==='object'?data.alertState.dismissedUntil:{};

  data.engineMetadata={
    schedulerVersion:data.schedulerConfig.algorithmVersion,
    schemaMigratedAt:data.engineMetadata?.schemaMigratedAt||new Date().toISOString(),
    lastScoredAt:data.engineMetadata?.lastScoredAt||null,
    ...(data.engineMetadata||{})
  };

  data.autoSessionState={
    lastComposedAt:null,
    lastType:null,
    lastSubjectId:null,
    ...(data.autoSessionState||{})
  };

  data.completedSessions=Array.isArray(data.completedSessions)?data.completedSessions.map(s=>({
    ...s,
    id:s.id||makeUid('session'),
    stream:s.stream||{id:streamIdFromName(s.subject),name:String(s.subject||'Custom')}
  })):[];
  data.activeSessions=Array.isArray(data.activeSessions)?data.activeSessions.map(a=>({
    ...a,
    id:a.id||makeUid('session'),
    packet:ensurePacketIdentity(a.packet)
  })):[];
  if(data.pendingPacket?.packet)data.pendingPacket.packet=ensurePacketIdentity(data.pendingPacket.packet);

  data.questionBank=Array.isArray(data.questionBank)?data.questionBank:[];

  data.streamPrototype=data.streamPrototype&&typeof data.streamPrototype==='object'?data.streamPrototype:{attempts:[],seen:{}};
  data.streamPrototype.attempts=Array.isArray(data.streamPrototype.attempts)?data.streamPrototype.attempts:[];
  data.streamPrototype.seen=data.streamPrototype.seen&&typeof data.streamPrototype.seen==='object'?data.streamPrototype.seen:{};

  data.streamEngine=data.streamEngine&&typeof data.streamEngine==='object'?data.streamEngine:{attempts:[],questionSeen:{},recentConceptIds:[],recentSubjectIds:[],burst:{count:0,correct:0,startedAt:null}};
  data.streamEngine.attempts=Array.isArray(data.streamEngine.attempts)?data.streamEngine.attempts:[];
  data.streamEngine.questionSeen=data.streamEngine.questionSeen&&typeof data.streamEngine.questionSeen==='object'?data.streamEngine.questionSeen:{};
  data.streamEngine.recentConceptIds=Array.isArray(data.streamEngine.recentConceptIds)?data.streamEngine.recentConceptIds:[];
  data.streamEngine.recentSubjectIds=Array.isArray(data.streamEngine.recentSubjectIds)?data.streamEngine.recentSubjectIds:[];
  data.streamEngine.burst={count:0,correct:0,startedAt:null,...(data.streamEngine.burst||{})};

  data.conceptEvidence=data.conceptEvidence&&typeof data.conceptEvidence==='object'?data.conceptEvidence:{};

  normalizeManifestList(data);
  ensureSubjectRegistry(data);
  data.streams=(data.subjectRegistry||[]).map(r=>({
    id:r.id,name:r.name,campaign:'Custom',active:r.active!==false,priority:r.priority||'normal',
    streamWeight:r.streamWeight,legacyStreamEnabled:r.legacyStreamEnabled,targetDifficulty:r.targetDifficulty
  }));

  return data;
}

function save(){
  DATA.appVersion=APP_VERSION;
  DATA.schemaVersion=6;
  DATA.schedulerConfig=normalizeSchedulerConfig099(DATA.schedulerConfig);
  DATA.engineMetadata=DATA.engineMetadata||{};
  DATA.engineMetadata.schedulerVersion=DATA.schedulerConfig.algorithmVersion;

  const sig=structureSignature(DATA);
  if(sig!==LAST_STRUCTURE_SIGNATURE){
    ensureSubjectRegistry(DATA);
    DATA.streams=(DATA.subjectRegistry||[]).map(r=>({
      id:r.id,name:r.name,campaign:'Custom',active:r.active!==false,priority:r.priority||'normal',
      streamWeight:r.streamWeight,legacyStreamEnabled:r.legacyStreamEnabled,targetDifficulty:r.targetDifficulty
    }));
    LAST_STRUCTURE_SIGNATURE=structureSignature(DATA);
  }

  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA))}
  catch(e){console.error('DBD save failed',e)}
}

function daysSince099(value){
  if(!value)return null;
  const t=new Date(value).getTime();
  if(!Number.isFinite(t))return null;
  return Math.max(0,(Date.now()-t)/86400000);
}

function attemptsForConcept099(subjectId,conceptId){
  const stream=(DATA.streamEngine?.attempts||[]).filter(a=>
    a.subjectId===subjectId &&
    (a.primaryConceptId===conceptId||(a.conceptIds||[]).includes(conceptId))
  );

  const sessions=[];
  for(const s of canonicalSessions(subjectId)){
    const qmap=new Map((s._packetQuestions||[]).map(q=>[String(q.id),q]));
    for(const a of s.attempts||[]){
      const q=qmap.get(String(a.questionId))||a;
      const refs=[
        q?.primaryConceptId,q?.primary_concept_id,
        ...(q?.conceptIds||q?.concept_ids||[]),
        ...(q?.tags||a?.tags||[])
      ].filter(Boolean).map(x=>resolveConceptRef(subjectId,x));
      if(refs.includes(conceptId)){
        sessions.push({
          answeredAt:s.completedAt,
          correct:Boolean(a.correct),
          confidence:a.confidence||'sure',
          sourceType:'session',
          questionUid:`${s.id}:${a.questionId}`
        });
      }
    }
  }

  return [...stream,...sessions];
}

function recentFailures099(subjectId,conceptId){
  const days=DATA.schedulerConfig.thresholds.recentFailureDays;
  const cutoff=Date.now()-days*86400000;
  return attemptsForConcept099(subjectId,conceptId).filter(a=>{
    const t=new Date(a.answeredAt||0).getTime();
    return t>=cutoff&&!a.correct;
  }).length;
}

function questionFeedbackStats099(questionUid){
  const rows=(DATA.questionFeedback||[]).filter(f=>f.questionUid===questionUid);
  let good=0,bad=0;
  const flags={};

  for(const f of rows){
    for(const flag of f.qualityFlags||[]){
      flags[flag]=(flags[flag]||0)+1;
      if(flag==='good')good++;
      else bad++;
    }
  }

  return{rows:rows.length,good,bad,flags};
}

function questionQualityAdjustment099(questionUid){
  const w=DATA.schedulerConfig.weights;
  const s=questionFeedbackStats099(questionUid);
  return Math.max(-36,Math.min(12,s.good*w.goodQuestion-s.bad*w.badQuestionPenalty));
}

function recentQuestionDays099(uid){
  const rows=(DATA.streamEngine?.attempts||[]).filter(a=>a.questionUid===uid);
  if(!rows.length)return null;
  const last=rows.map(a=>new Date(a.answeredAt||0).getTime()).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  return last?Math.max(0,(Date.now()-last)/86400000):null;
}

function scoreConcept099(e,subject){
  const cfg=DATA.schedulerConfig,w=cfg.weights,t=cfg.thresholds;
  const parts=[];

  const add=(label,value)=>{
    const n=Math.round(Number(value)||0);
    if(n)parts.push({label,value:n});
    return Number(value)||0;
  };

  let score=0;
  const seen=Number(e.seen)||0;
  const accuracy=e.weightedTotal>0?e.weightedPositive/e.weightedTotal:(seen?e.correct/seen:null);

  if(!seen){
    score+=add('New concept',w.newConcept);
  }else{
    score+=add('Weakness',(1-Math.max(0,Math.min(1,accuracy??0)))*w.weakness);

    const uncertainty=(Number(e.unsure||0)+Number(e.guess||0)+Number(e.dontKnow||0))/Math.max(1,seen);
    score+=add('Uncertainty',uncertainty*w.uncertainty);

    const failures=recentFailures099(subject.id,e.concept.id);
    score+=add('Recent failures',Math.min(3,failures)*w.recentFailure);

    const days=daysSince099(e.lastSeenAt);
    if(days!==null&&days>t.dueDays){
      score+=add('Overdue',Math.min(w.overdueCap,(days-t.dueDays)*w.overduePerDay));
    }

    if(e.state==='secure'||(accuracy!==null&&accuracy>=t.secureAccuracy&&seen>=3)){
      score+=add('Secure penalty',-w.securePenalty);
    }
  }

  const repeats=(DATA.streamEngine?.recentConceptIds||[]).filter(id=>id===e.concept.id).length;
  score+=add('Recent concept penalty',-Math.min(3,repeats)*w.recentConceptPenalty);

  return{score,parts,accuracy};
}

function scoreQuestion099(q,subject,conceptId){
  const cfg=DATA.schedulerConfig,w=cfg.weights;
  const parts=[];
  const add=(label,value)=>{
    const n=Math.round(Number(value)||0);
    if(n)parts.push({label,value:n});
    return Number(value)||0;
  };

  const uid=q.uid||q.id;
  const seen=Number(DATA.streamEngine?.questionSeen?.[uid]||0);
  let score=0;

  if(!seen)score+=add('Unseen question',w.unseenQuestion);
  else score+=add('Seen question penalty',-Math.min(4,seen)*w.seenQuestionPenalty);

  const recentDays=recentQuestionDays099(uid);
  if(recentDays!==null&&recentDays<2){
    score+=add('Very recent question',-w.recentQuestionPenalty*(1-recentDays/2));
  }

  score+=add('Difficulty fit',difficultyPreference(q,subject.targetDifficulty||'adaptive')*w.difficultyFit);
  score+=add('Question quality',questionQualityAdjustment099(uid));

  if((q.sourceType||'bank')==='bank'||DATA.questionBank?.some(x=>(x.uid||x.id)===uid)){
    score+=add('Dedicated Bank',w.bankPreference);
  }

  return{score,parts,seen};
}

function subjectDietPressure099(subject,activeSubjects){
  const cfg=DATA.schedulerConfig,w=cfg.weights;
  const deficit=dietDeficit(subject,activeSubjects);
  return{
    score:deficit*w.subjectDiet,
    parts:[{label:`${subject.name} diet`,value:Math.round(deficit*w.subjectDiet)}]
  };
}

function schedulerBreakdownHtml099(pick){
  const b=pick?.schedulerBreakdown;
  if(!b)return'<div class="why099"><div class="why099-title">Scheduler</div><div class="muted">No score breakdown is available for this legacy pick.</div></div>';

  const rows=[
    ...(b.subjectParts||[]),
    ...(b.conceptParts||[]),
    ...(b.questionParts||[])
  ];

  return `<div class="why099">
    <div class="why099-title">Why this question?</div>
    ${rows.map(r=>`<div class="why099-row"><span>${esc(r.label)}</span><strong>${Number(r.value)>=0?'+':''}${Math.round(Number(r.value)||0)}</strong></div>`).join('')}
    <div class="why099-total"><span>Final priority</span><strong>${Math.round(b.finalScore||0)}</strong></div>
    <div class="stream-index-hint" style="margin-top:7px">Scores are derived from Schema 6 evidence. They are not permanent mastery values.</div>
  </div>`;
}

function syncStreamDraft099(pick){
  const uid=pick?.uid||null;
  if(uid!==streamDraftQuestionUid099){
    streamDraftQuestionUid099=uid;
    streamCommentDraft099='';
    streamQualityFlags099=new Set();
    streamCommentOpen099=false;
    streamWhyOpen099=false;
  }
}

function toggleStreamComment099(){
  streamCommentOpen099=!streamCommentOpen099;
  render();
}

function setStreamComment099(v){streamCommentDraft099=String(v||'')}

function toggleQualityFlag099(flag){
  if(streamQualityFlags099.has(flag))streamQualityFlags099.delete(flag);
  else{
    if(flag==='good'){
      streamQualityFlags099=new Set(['good']);
    }else{
      streamQualityFlags099.delete('good');
      streamQualityFlags099.add(flag);
    }
  }
  render();
}

function toggleWhy099(){
  streamWhyOpen099=!streamWhyOpen099;
  render();
}

function currentAlerts099(){
  const out=[];
  const dismissed=DATA.alertState?.dismissedUntil||{};
  const now=Date.now();
  const threshold=DATA.schedulerConfig.thresholds;

  const add=a=>{
    const until=new Date(dismissed[a.id]||0).getTime();
    if(until>now)return;
    out.push(a);
  };

  for(const s of (DATA.subjectRegistry||[]).filter(x=>x.active!==false)){
    let ev=[];
    try{ev=conceptEvidenceV3(s.id)}catch(e){}

    const weak=ev.filter(e=>e.state==='weak'&&e.seen>=2).sort((a,b)=>recentFailures099(s.id,b.concept.id)-recentFailures099(s.id,a.concept.id));
    if(weak.length){
      const e=weak[0];
      add({
        id:`weak:${s.id}:${e.concept.id}`,
        kind:'weak',
        title:`${s.name}: ${e.concept.name} needs repair`,
        detail:`${e.correct}/${e.seen} correct · ${recentFailures099(s.id,e.concept.id)} recent failure(s).`
      });
    }

    const bank=r2SafeBank(s.id);
    if(bank.length){
      const unseen=bank.filter(q=>!(DATA.streamEngine?.questionSeen?.[q.uid||q.id]>0)).length;
      if(unseen<=threshold.lowBankUnseen){
        add({
          id:`bank-low:${s.id}`,
          kind:'bank',
          title:`${s.name} Bank is running low`,
          detail:`${unseen} unseen Stream-safe question${unseen===1?'':'s'} remain.`
        });
      }
    }

    const seenDates=ev.map(e=>new Date(e.lastSeenAt||0).getTime()).filter(x=>x>0);
    if(seenDates.length){
      const last=Math.max(...seenDates);
      const days=(Date.now()-last)/86400000;
      if(days>=threshold.neglectedSubjectDays){
        add({
          id:`neglected:${s.id}`,
          kind:'neglected',
          title:`${s.name} has been neglected`,
          detail:`No recorded retrieval for about ${Math.floor(days)} days.`
        });
      }
    }
  }

  const badByQuestion=new Map();
  for(const f of DATA.questionFeedback||[]){
    const bad=(f.qualityFlags||[]).filter(x=>x!=='good').length;
    if(bad)badByQuestion.set(f.questionUid,(badByQuestion.get(f.questionUid)||0)+bad);
  }
  for(const [uid,n] of badByQuestion){
    if(n>=2){
      const q=(DATA.questionBank||[]).find(x=>(x.uid||x.id)===uid);
      add({
        id:`quality:${uid}`,
        kind:'quality',
        title:'A Bank question may be poor evidence',
        detail:`${q?.subjectName||'Question Bank'} · ${n} negative quality signal(s).`
      });
    }
  }

  return out.slice(0,8);
}

function dismissAlert099(id){
  DATA.alertState=DATA.alertState||{dismissedUntil:{}};
  DATA.alertState.dismissedUntil=DATA.alertState.dismissedUntil||{};
  DATA.alertState.dismissedUntil[id]=new Date(Date.now()+24*3600000).toISOString();
  save();
  render();
}

function alertsPanel099(){
  const alerts=currentAlerts099();
  if(!alerts.length)return'';
  return `<section class="alerts-panel">
    <div class="alerts-head"><strong>Attention</strong><span class="alerts-count">${alerts.length}</span></div>
    <div class="alert-list">
      ${alerts.slice(0,3).map(a=>`<div class="alert-row"><div><strong>${esc(a.title)}</strong><small>${esc(a.detail)}</small></div><button class="alert-dismiss" onclick="dismissAlert099('${esc(a.id)}')">24H</button></div>`).join('')}
    </div>
  </section>`;
}

function bankQuestionToSessionQuestion099(q,index){
  const choices=q.choices||q.options;
  const ids=r2BankConceptIds(q,q.subjectId);
  const names=ids.map(id=>r2ConceptName(q,id,q.subjectId));

  if(choices&&typeof choices==='object'){
    return normalizeQuestion({
      id:`auto_${index+1}_${String(q.id||q.uid||index).replace(/[^a-zA-Z0-9_-]/g,'')}`,
      uid:q.uid||q.id,
      type:'mcq',
      prompt:q.prompt||q.question||q.statement||'',
      choices,
      answer:q.answer,
      explanation:q.explanation||'',
      tags:names,
      difficulty:q.difficulty||'medium',
      paper_required:Boolean(q.paperRequired||q.paper_required)
    },index);
  }

  const type=String(q.type||'').toLowerCase();
  if(type==='true_false'||type==='stream_statement'){
    const truth=typeof q.answer==='boolean'?q.answer:['true','t','yes','1','benar'].includes(norm(q.answer));
    return normalizeQuestion({
      id:`auto_${index+1}_${String(q.id||q.uid||index).replace(/[^a-zA-Z0-9_-]/g,'')}`,
      uid:q.uid||q.id,
      type:'mcq',
      prompt:q.statement||q.prompt||q.question||'',
      choices:{A:'True',B:'False'},
      answer:truth?'A':'B',
      explanation:q.explanation||'',
      tags:names,
      difficulty:q.difficulty||'medium',
      paper_required:false
    },index);
  }
  return null;
}

function scoreBankForAutoSession099(q,subject,type){
  const ids=r2BankConceptIds(q,subject.id);
  const cid=q.primaryConceptId||ids[0];
  const ev=conceptEvidenceV3(subject.id).find(e=>String(e.concept.id)===String(cid))||{
    concept:{id:cid,name:r2ConceptName(q,cid,subject.id)},
    seen:0,correct:0,wrong:0,unsure:0,guess:0,dontKnow:0,
    weightedPositive:0,weightedTotal:0,lastSeenAt:null,state:'new'
  };

  const cs=scoreConcept099(ev,subject);
  const qs=scoreQuestion099(q,subject,cid);

  let mode=0;
  if(type==='repair'){
    mode=(ev.state==='weak'?28:0)+(recentFailures099(subject.id,cid)*8)+(ev.wrong||0)*2;
  }else if(type==='due'){
    const days=daysSince099(ev.lastSeenAt);
    mode=days===null?10:Math.max(0,days-DATA.schedulerConfig.thresholds.dueDays)*4;
  }else if(type==='mastery'){
    mode=(q.difficulty&&normalizedDifficulty(q.difficulty)==='hard'?8:0)+(ev.state==='shaky'?8:0);
  }else{
    mode=ev.state==='new'?10:0;
  }

  return{score:cs.score+qs.score+mode,conceptId:cid,conceptName:ev.concept.name||r2ConceptName(q,cid,subject.id)};
}

function composeAutoSession099(subjectId,type='repair',count=15){
  const subjectRec=(DATA.subjectRegistry||[]).find(s=>s.id===subjectId);
  if(!subjectRec)throw new Error('Choose an active subject first.');

  const bank=r2SafeBank(subjectId);
  if(!bank.length)throw new Error('This subject has no Stream-safe Question Bank inventory.');

  const scored=bank.map(q=>({q,...scoreBankForAutoSession099(q,subjectRec,type)}))
    .sort((a,b)=>b.score-a.score);

  const maxPer=Math.max(1,Number(DATA.schedulerConfig.autoSession.maxPerConcept)||5);
  const conceptCounts=new Map();
  const selected=[];

  for(const row of scored){
    if(selected.length>=count)break;
    const n=conceptCounts.get(row.conceptId)||0;
    if(n>=maxPer)continue;
    selected.push(row);
    conceptCounts.set(row.conceptId,n+1);
  }

  // Fill if diversity cap prevented requested count.
  if(selected.length<count){
    const chosen=new Set(selected.map(x=>x.q.uid||x.q.id));
    for(const row of scored){
      if(selected.length>=count)break;
      const uid=row.q.uid||row.q.id;
      if(chosen.has(uid))continue;
      selected.push(row);
      chosen.add(uid);
    }
  }

  const questions=selected.map((x,i)=>bankQuestionToSessionQuestion099(x.q,i)).filter(Boolean);
  if(!questions.length)throw new Error('No Bank questions can be rendered as a Session.');

  const testType=type==='repair'?'repair':type==='mastery'?'mastery':'focused';
  const feedback=type==='mastery'?'end':'immediate';
  const topicLabel={
    repair:'Auto Repair',
    due:'Due Review',
    mastery:'Auto Mastery Check',
    mixed:'Smart Mixed'
  }[type]||'Auto Session';

  const packet=ensurePacketIdentity({
    packetUid:makeUid('auto-packet'),
    dbdVersion:APP_VERSION,
    campaign:'Auto Session',
    subject:subjectRec.name,
    topic:`${topicLabel} · ${questions.length} questions`,
    source:'DBD Question Bank · weighted composer',
    testType,
    workingStyle:'concept',
    answerFormat:'mcq',
    difficulty:subjectRec.targetDifficulty||'Adaptive',
    questions
  });

  return{
    packet,
    selection:selected,
    composer:{
      generated:true,
      composerVersion:DATA.schedulerConfig.algorithmVersion,
      composerType:type,
      createdAt:new Date().toISOString(),
      subjectId,
      sourceQuestionUids:selected.map(x=>x.q.uid||x.q.id),
      conceptMix:Object.fromEntries([...conceptCounts.entries()])
    },
    setupSnapshot:{
      ...DATA.setup,
      testType,
      workingStyle:'concept',
      answerFormat:'mcq',
      feedback,
      timing:'off',
      showTimer:false,
      difficulty:subjectRec.targetDifficulty==='adaptive'?'Adaptive':subjectRec.targetDifficulty
    }
  };
}

function startAutoSession099(){
  const active=(DATA.subjectRegistry||[]).filter(s=>s.active!==false&&r2SafeBank(s.id).length);
  const subjectId=autoSessionSubject099||active[0]?.id;
  if(!subjectId){alert('No active subject has a usable Question Bank.');return}

  try{
    const composed=composeAutoSession099(subjectId,autoSessionType099,Math.max(5,Math.min(40,Number(autoSessionCount099)||15)));
    const id=makeUid('auto-session');

    DATA.activeSessions.push({
      id,
      packet:composed.packet,
      setupSnapshot:composed.setupSnapshot,
      responses:composed.packet.questions.map(()=>newResponse()),
      currentIndex:0,
      startedAt:Date.now(),
      lastOpenedAt:Date.now(),
      liveStartedAt:null,
      paused:false,
      retryKind:null,
      autoSession:composed.composer
    });

    DATA.currentActiveId=id;
    DATA.autoSessionState={
      lastComposedAt:new Date().toISOString(),
      lastType:autoSessionType099,
      lastSubjectId:subjectId
    };
    save();
    route('drill');
  }catch(e){
    alert(e.message||'Auto Session could not be composed.');
  }
}

function autoSessionPanel099(){
  const active=(DATA.subjectRegistry||[]).filter(s=>s.active!==false&&r2SafeBank(s.id).length);
  if(!active.length)return'';

  if(!autoSessionSubject099||!active.some(s=>s.id===autoSessionSubject099))autoSessionSubject099=active[0].id;

  return `<div class="auto-session099">
    <div class="auto-session099-head"><strong>Auto Session</strong><small>composed locally from Bank</small></div>
    <div class="auto-session099-grid">
      <select onchange="autoSessionSubject099=this.value">
        ${active.map(s=>`<option value="${s.id}" ${s.id===autoSessionSubject099?'selected':''}>${esc(s.name)}</option>`).join('')}
      </select>
      <select onchange="autoSessionType099=this.value">
        <option value="repair" ${autoSessionType099==='repair'?'selected':''}>Repair</option>
        <option value="due" ${autoSessionType099==='due'?'selected':''}>Due review</option>
        <option value="mastery" ${autoSessionType099==='mastery'?'selected':''}>Mastery check</option>
        <option value="mixed" ${autoSessionType099==='mixed'?'selected':''}>Smart mixed</option>
      </select>
      <select onchange="autoSessionCount099=Number(this.value)">
        ${[10,15,20,25].map(n=>`<option value="${n}" ${Number(autoSessionCount099)===n?'selected':''}>${n} Q</option>`).join('')}
      </select>
    </div>
    <div class="auto-session099-action"><button class="button primary" onclick="startAutoSession099()">BUILD & START</button></div>
    <div class="auto-session099-note">DBD does not generate new questions here. It selects a coherent drill from questions already stored in the Bank.</div>
  </div>`;
}

async function schedulerPickAsync(token){
  STREAM_ENGINE_STATE.phase='Reading Stream Policy';
  STREAM_ENGINE_STATE.done=0;
  STREAM_ENGINE_STATE.total=0;
  renderStreamProgress();
  await yieldToBrowser();
  if(token!==STREAM_ENGINE_STATE.token)return undefined;

  const subjects=(DATA.subjectRegistry||[])
    .map(normalizeStreamPolicyRecord)
    .filter(s=>s.active!==false&&Number(s.streamWeight)>0);

  if(!subjects.length){
    STREAM_ENGINE_STATE.phase='All subjects are muted';
    return null;
  }

  const eligible=subjects.filter(s=>{
    if(r2SafeBank(s.id).length)return true;
    return s.legacyStreamEnabled!==false&&historicalCardsForSubject(s.id).length>0;
  });

  if(!eligible.length){
    STREAM_ENGINE_STATE.phase='No active subject has Stream-safe inventory';
    return null;
  }

  STREAM_ENGINE_STATE.phase='Scoring subjects';
  STREAM_ENGINE_STATE.total=eligible.length;
  renderStreamProgress();

  // Strategic layer: choose subject from Stream Diet deficit.
  const subjectRank=eligible.map(s=>({s,diet:subjectDietPressure099(s,eligible)}))
    .sort((a,b)=>b.diet.score-a.diet.score);

  const chosenSubject=subjectRank[0].s;
  const subjectScore=subjectRank[0].diet;

  STREAM_ENGINE_STATE.phase=`Scoring ${chosenSubject.name}`;
  await yieldToBrowser();
  if(token!==STREAM_ENGINE_STATE.token)return undefined;

  let model;
  let evidence;
  try{
    model=subjectConceptModel(chosenSubject.id);
    evidence=conceptEvidenceV3(chosenSubject.id);
  }catch(e){
    console.warn('Weighted concept model fallback',e);
    model={concepts:[]};
    evidence=[];
  }

  const evidenceMap=new Map(evidence.map(e=>[String(e.concept.id),e]));
  const candidates=[];

  const pushCandidate=(q,concept,sourceType='bank')=>{
    if(!q||!concept)return;
    const cid=String(concept.id);
    const e=evidenceMap.get(cid)||{
      concept,
      seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,
      weightedPositive:0,weightedTotal:0,questionVariety:0,dayVariety:0,lastSeenAt:null,
      state:'new',sources:{session:0,stream:0}
    };
    const cs=scoreConcept099(e,chosenSubject);
    const qs=scoreQuestion099(q,chosenSubject,cid);
    const finalScore=subjectScore.score+cs.score+qs.score;

    candidates.push({
      q,concept,e,sourceType,finalScore,
      breakdown:{
        subjectParts:subjectScore.parts,
        conceptParts:cs.parts,
        questionParts:qs.parts,
        finalScore
      }
    });
  };

  for(const c of (model.concepts||[]).filter(c=>c.kind!=='container')){
    const bank=bankForConceptPolicy(chosenSubject,c.id);
    for(const q of bank.slice(0,5))pushCandidate(q,c,'bank');

    if(chosenSubject.legacyStreamEnabled!==false){
      const hist=historyForConceptPolicy(chosenSubject,c.id);
      for(const q of hist.slice(0,2))pushCandidate(q,c,'history');
    }
  }

  // Absolute direct-Bank fallback.
  if(!candidates.length){
    for(const q of r2SafeBank(chosenSubject.id).slice(0,20)){
      const ids=r2BankConceptIds(q,chosenSubject.id);
      const cid=ids[0]||`bank_general_${chosenSubject.id}`;
      pushCandidate(q,{
        id:cid,
        name:r2ConceptName(q,cid,chosenSubject.id),
        parentId:null,kind:'concept',provisional:true,source:'question_bank'
      },'bank');
    }
  }

  if(!candidates.length){
    STREAM_ENGINE_STATE.phase='No renderable question survived scoring';
    return null;
  }

  candidates.sort((a,b)=>b.finalScore-a.finalScore||simpleHash(a.q.uid||a.q.id)-simpleHash(b.q.uid||b.q.id));
  const winner=candidates[0];

  let item=null;
  if(winner.sourceType==='bank'){
    item=r2BankToCard(winner.q,chosenSubject,winner.concept);
  }else{
    const c=winner.q;
    item={
      ...c,
      uid:`hist:${c.id}`,
      subjectId:chosenSubject.id,
      subjectName:chosenSubject.name,
      conceptIds:cardConceptIds(c,chosenSubject.id),
      primaryConceptId:winner.concept.id,
      conceptName:winner.concept.name,
      sourceType:'history'
    };
  }

  if(!item){
    STREAM_ENGINE_STATE.phase='Winning question could not be rendered';
    return null;
  }

  DATA.engineMetadata.lastScoredAt=new Date().toISOString();

  return{
    ...item,
    conceptState:winner.e.state||'new',
    priorityScore:winner.finalScore,
    schedulerBreakdown:winner.breakdown,
    targetDifficulty:chosenSubject.targetDifficulty||'adaptive',
    difficulty:winner.q.difficulty||'',
    dietWeight:chosenSubject.streamWeight,
    legacyAllowed:chosenSubject.legacyStreamEnabled!==false
  };
}

function streamHome(){
  const b=DATA.streamEngine?.burst||{count:0,correct:0};
  const size=Math.max(1,Number(DATA.scheduler?.burstSize)||5);

  if(streamDismissed){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Paused</span></div><div class="stream-empty">Stream is resting. <button class="text-action" onclick="streamDismissed=false;streamEngineReset();render();setTimeout(()=>scheduleStreamPick(true),0)">Resume</button></div></section>`;
  }

  if(b.count>=size){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Burst complete</span></div><div class="stream-card smart"><div class="burst-complete"><strong>${b.correct||0}/${b.count||0}</strong><span>correct in this burst</span><div class="binary-actions"><button class="binary-button" onclick="streamDismissed=true;render()">DONE</button><button class="binary-button true" onclick="resetBurst()">5 MORE</button></div></div></div></section>`;
  }

  if(streamFeedback?.card){
    const c=streamFeedback.card,expected=c.truth?'TRUE':'FALSE';
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>${esc(c.subjectName||c.subject||'')}</span></div><div class="stream-card smart"><div class="stream-feedback ${streamFeedback.correct?'good':'bad'}"><div><strong>${streamFeedback.correct?'CORRECT ✓':'NOT QUITE'}</strong><small>Correct response: ${expected}${c.explanation?` · ${esc(c.explanation)}`:''}</small></div><div class="stream-next-indicator">Next question…</div></div></div></section>`;
  }

  if(STREAM_ENGINE_STATE.status==='error'){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Engine error</span></div><div class="stream-error-state"><strong>Stream could not prepare.</strong><p>Your local evidence is intact.</p><button class="button tiny" onclick="retryStreamEngine()">RETRY STREAM</button><code>${esc(STREAM_ENGINE_STATE.error||'Unknown Stream error')}</code></div></section>`;
  }

  if(STREAM_ENGINE_STATE.status==='empty'){
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>No eligible inventory</span></div><div class="stream-empty-state"><strong>Nothing is eligible for Stream right now.</strong><p>${esc(STREAM_ENGINE_STATE.phase||'No eligible subjects or questions were found.')}</p><div class="stream-loading-actions"><button class="button tiny" onclick="retryStreamEngine()">CHECK AGAIN</button></div></div></section>`;
  }

  if(STREAM_ENGINE_STATE.status==='idle')setTimeout(()=>scheduleStreamPick(),0);

  if(STREAM_ENGINE_STATE.status==='pending'||STREAM_ENGINE_STATE.status==='idle'){
    const pct=streamProgressPercent();
    return `<section class="stream-section"><div class="section-kicker"><strong>Stream</strong><span>Weighted scheduler</span></div><div class="stream-loading-card"><div class="stream-loading-head"><strong>Preparing Stream</strong><span>${pct}%</span></div><div class="stream-loading-phase">${esc(STREAM_ENGINE_STATE.phase||'Starting')}</div><div class="stream-loading-bar"><div class="stream-loading-fill" style="width:${pct}%"></div></div><div class="stream-index-hint">Schema 6 is deriving current priority from stored evidence. Home controls remain interactive.</div></div></section>`;
  }

  const pick=STREAM_PICK_CACHE;
  if(!pick){
    STREAM_ENGINE_STATE.status='empty';
    STREAM_ENGINE_STATE.phase='Scheduler finished without a question';
    return streamHome();
  }

  syncStreamDraft099(pick);

  return `<section class="stream-section">
    <div class="section-kicker"><strong>Stream</strong><span>${b.count+1} / ${size} · weighted</span></div>
    <div class="stream-card smart">
      <div class="stream-intent">
        <span class="stream-state ${pick.conceptState}">${esc(pick.conceptState)}</span>
        <span class="stream-concept">${esc(pick.subjectName||pick.subject)} · ${esc(pick.conceptName||'Concept')}</span>
        <span class="stream-score-badge">${Math.round(pick.priorityScore||0)}</span>
      </div>

      <div class="stream-prompt">${esc(pick.prompt)}</div>
      ${pick.proposed!==null&&pick.proposed!==undefined?`<div class="stream-proposal"><small>Proposed answer</small><strong>${esc(pick.proposed)}</strong></div>`:''}

      <div class="binary-actions">
        <button class="binary-button true" onclick="answerSmartStream(true)">TRUE</button>
        <button class="binary-button false" onclick="answerSmartStream(false)">FALSE</button>
      </div>

      <div class="stream-tools099">
        <button class="stream-tool099 ${streamCommentOpen099?'active':''}" onclick="toggleStreamComment099()">COMMENT ${streamCommentOpen099?'−':'＋'}</button>
        <button class="stream-tool099 ${streamWhyOpen099?'active':''}" onclick="toggleWhy099()">WHY THIS? ${streamWhyOpen099?'−':'＋'}</button>
      </div>

      ${streamCommentOpen099?`<div class="stream-comment099">
        <textarea oninput="setStreamComment099(this.value)" placeholder="Question quality, wording, SAT usefulness, concept mismatch, or anything worth sending back to the subject chat...">${esc(streamCommentDraft099)}</textarea>
        <div class="quality-flags099">
          ${QUALITY_FLAGS_099.map(([id,label])=>`<button class="quality-flag099 ${streamQualityFlags099.has(id)?'active':''}" onclick="toggleQualityFlag099('${id}')">${esc(label)}</button>`).join('')}
        </div>
      </div>`:''}

      ${streamWhyOpen099?schedulerBreakdownHtml099(pick):''}
    </div>
  </section>`;
}

function answerSmartStream(value){
  const pick=streamFeedback?.card||STREAM_PICK_CACHE;
  if(!pick||streamFeedback)return;

  const correct=Boolean(value)===Boolean(pick.truth);
  const now=new Date().toISOString();
  const attemptId=makeUid('stream');

  DATA.streamEngine=DATA.streamEngine||{
    attempts:[],questionSeen:{},recentConceptIds:[],recentSubjectIds:[],
    burst:{count:0,correct:0,startedAt:null}
  };

  DATA.streamEngine.questionSeen[pick.uid]=(DATA.streamEngine.questionSeen[pick.uid]||0)+1;
  DATA.streamEngine.recentConceptIds=[pick.primaryConceptId,...(DATA.streamEngine.recentConceptIds||[])].filter(Boolean).slice(0,8);
  DATA.streamEngine.recentSubjectIds=[pick.subjectId,...(DATA.streamEngine.recentSubjectIds||[])].filter(Boolean).slice(0,12);

  const qualityFlags=[...streamQualityFlags099];

  DATA.streamEngine.attempts.push({
    id:attemptId,
    questionUid:pick.uid,
    subjectId:pick.subjectId,
    conceptIds:pick.conceptIds?.length?pick.conceptIds:[pick.primaryConceptId],
    primaryConceptId:pick.primaryConceptId,
    answeredAt:now,
    selected:Boolean(value),
    correct,
    confidence:'sure',
    mode:'stream',
    testType:'stream',
    difficulty:pick.difficulty||'',
    sourceType:pick.sourceType,
    targetDifficulty:pick.targetDifficulty||'adaptive',
    comment:streamCommentDraft099.trim(),
    qualityFlags,
    schedulerSnapshot:{
      algorithmVersion:DATA.schedulerConfig.algorithmVersion,
      finalScore:Math.round(pick.schedulerBreakdown?.finalScore||pick.priorityScore||0),
      breakdown:pick.schedulerBreakdown||null
    }
  });

  DATA.streamEngine.attempts=DATA.streamEngine.attempts.slice(-5000);

  if(streamCommentDraft099.trim()||qualityFlags.length){
    DATA.questionFeedback.push({
      id:makeUid('feedback'),
      questionUid:pick.uid,
      attemptId,
      subjectId:pick.subjectId,
      conceptIds:pick.conceptIds?.length?pick.conceptIds:[pick.primaryConceptId],
      createdAt:now,
      comment:streamCommentDraft099.trim(),
      qualityFlags
    });
    DATA.questionFeedback=DATA.questionFeedback.slice(-10000);
  }

  const b=DATA.streamEngine.burst;
  b.count=(b.count||0)+1;
  b.correct=(b.correct||0)+(correct?1:0);
  b.startedAt=b.startedAt||now;

  streamFeedback={card:pick,correct,selected:Boolean(value)};
  STREAM_PICK_CACHE=null;
  STREAM_ENGINE_STATE.status='idle';

  streamCommentDraft099='';
  streamQualityFlags099=new Set();
  streamCommentOpen099=false;
  streamWhyOpen099=false;
  streamDraftQuestionUid099=null;

  save();
  render();

  setTimeout(()=>{
    if(streamFeedback?.card?.uid===pick.uid){
      streamFeedback=null;
      streamEngineReset();
      render();
      setTimeout(()=>scheduleStreamPick(true),0);
    }
  },720);
}

function home(){
  const drills=DATA.completedSessions.length;
  const sessionAnswered=DATA.statistics.answered||DATA.completedSessions.reduce((n,s)=>n+(s.answered||0),0);
  const streamAnswered=(DATA.streamPrototype?.attempts||[]).length+(DATA.streamEngine?.attempts||[]).length;
  const answered=sessionAnswered+streamAnswered;

  return `${streamHome()}
    ${streamDietPanel()}
    ${alertsPanel099()}
    <section class="panel session-zone">
      <div class="section-kicker"><strong>Session</strong><span>Deliberate drill</span></div>
      <div class="launch-actions v098-primary"><button class="button primary" onclick="route('import')">IMPORT PACKET</button></div>
      <div class="session-secondary"><button class="button" onclick="copyVanilla(this)">COPY INSTRUCTION</button><button class="button" onclick="toggleCustomDrill()">CUSTOM DRILL ${customizationOpen?'−':'＋'}</button></div>
      ${autoSessionPanel099()}
      ${customizationPanel()}
      ${ongoingSessions(true)}
    </section>
    ${bankHomeZone()}
    <div class="home-stats"><div class="home-stat"><strong>${drills}</strong><span>Total drills</span></div><div class="home-stat"><strong>${answered}</strong><span>Questions answered</span></div></div>`;
}

function finishSession(){
  const a=active();
  if(!a)return;

  accrueTime();

  const attempts=a.packet.questions.map((q,i)=>attemptFrom(q,a.responses[i]));
  const total=attempts.length;
  const answered=attempts.filter(x=>['answered','dontknow','timeout'].includes(x.status)).length;
  const correct=attempts.filter(x=>x.correct).length;
  const secureCorrect=attempts.filter(x=>x.secureCorrect).length;
  const wrong=attempts.filter(x=>['answered','dontknow','timeout'].includes(x.status)&&!x.correct).length;
  const unanswered=total-answered;
  const totalTime=a.setupSnapshot.timing==='off'?null:attempts.reduce((n,x)=>n+(x.elapsed||0),0);

  const session={
    id:a.id,
    completedAt:new Date().toISOString(),
    campaign:a.packet.campaign,
    subject:a.packet.subject,
    topic:a.packet.topic,
    source:a.packet.source,
    testType:a.setupSnapshot.testType,
    workingStyle:a.setupSnapshot.workingStyle,
    answerFormat:a.setupSnapshot.answerFormat,
    difficulty:a.packet.difficulty||a.setupSnapshot.difficulty,
    feedback:a.setupSnapshot.feedback,
    timing:a.setupSnapshot.timing,
    totalQuestions:total,answered,correct,secureCorrect,wrong,unanswered,
    accuracy:total?correct/total*100:0,
    secureAccuracy:total?secureCorrect/total*100:0,
    totalTime,
    attempts,
    retryKind:a.retryKind||null,
    autoSession:a.autoSession||null,
    _packetQuestions:a.packet.questions
  };

  DATA.completedSessions.unshift(session);
  DATA.completedSessions=DATA.completedSessions.slice(0,300);
  DATA.statistics.answered+=answered;
  DATA.statistics.correct+=correct;
  DATA.statistics.wrong+=wrong;
  DATA.activeSessions=DATA.activeSessions.filter(x=>x.id!==a.id);
  DATA.currentActiveId=DATA.activeSessions[0]?.id||null;
  currentSessionId=session.id;

  save();
  clearEngineCache();
  route('summary');
}

function mergeVaultData(incoming){
  const d=normalizeFutureData({
    ...incoming,
    setup:migrateSetup(incoming.setup),
    completedSessions:Array.isArray(incoming.completedSessions)?incoming.completedSessions:[],
    activeSessions:Array.isArray(incoming.activeSessions)?incoming.activeSessions:[],
    settings:{...DATA.settings,...(incoming.settings||{}),deviceId:DATA.settings.deviceId}
  });

  DATA.completedSessions=mergeById(DATA.completedSessions,d.completedSessions);
  DATA.activeSessions=mergeById(DATA.activeSessions,d.activeSessions);
  DATA.subjectRegistry=mergeRegistry(DATA.subjectRegistry,d.subjectRegistry);

  const mm=new Map((DATA.conceptManifests||[]).map(m=>[m.subjectId,m]));
  for(const m of d.conceptManifests||[]){
    const old=mm.get(m.subjectId);
    if(!old||Number(m.revision)>=Number(old.revision))mm.set(m.subjectId,m);
  }
  DATA.conceptManifests=[...mm.values()];

  const bankMap=new Map((DATA.questionBank||[]).map(q=>[q.uid||q.id,q]));
  for(const q of d.questionBank||[])bankMap.set(q.uid||q.id,q);
  DATA.questionBank=[...bankMap.values()];

  const attempts=[...(DATA.streamEngine?.attempts||[]),...(d.streamEngine?.attempts||[])];
  const am=new Map();
  for(const a of attempts)if(a?.id)am.set(a.id,a);
  DATA.streamEngine={
    ...DATA.streamEngine,
    attempts:[...am.values()],
    questionSeen:{...(DATA.streamEngine?.questionSeen||{})},
    recentConceptIds:DATA.streamEngine?.recentConceptIds||[],
    recentSubjectIds:DATA.streamEngine?.recentSubjectIds||[],
    burst:DATA.streamEngine?.burst||{count:0,correct:0}
  };
  for(const [k,v] of Object.entries(d.streamEngine?.questionSeen||{})){
    DATA.streamEngine.questionSeen[k]=Math.max(DATA.streamEngine.questionSeen[k]||0,Number(v)||0);
  }

  const feedbackMap=new Map((DATA.questionFeedback||[]).map(f=>[f.id,f]));
  for(const f of d.questionFeedback||[])if(f?.id)feedbackMap.set(f.id,f);
  DATA.questionFeedback=[...feedbackMap.values()];

  const dismissed={...(DATA.alertState?.dismissedUntil||{})};
  for(const [k,v] of Object.entries(d.alertState?.dismissedUntil||{})){
    if(new Date(v||0)>new Date(dismissed[k]||0))dismissed[k]=v;
  }
  DATA.alertState={dismissedUntil:dismissed};

  // Keep local scheduler tuning unless incoming explicitly has a newer algorithm name.
  if(d.schedulerConfig?.algorithmVersion&&d.schedulerConfig.algorithmVersion!==DATA.schedulerConfig?.algorithmVersion){
    DATA.schedulerConfig=normalizeSchedulerConfig099(DATA.schedulerConfig);
  }

  if(!DATA.pendingPacket&&d.pendingPacket)DATA.pendingPacket=d.pendingPacket;
  DATA.vault.lastMergedAt=new Date().toISOString();

  recomputeStatistics(DATA);
  normalizeFutureData(DATA);
  clearEngineCache();
  save();
}

function importBackup(){
  const i=document.createElement('input');
  i.type='file';
  i.accept='.json,.dbd,application/json';

  i.onchange=async()=>{
    try{
      const raw=JSON.parse(await i.files[0].text());
      const p=raw?.format==='dbd-vault'?raw.data:raw;
      if(!p||!Array.isArray(p.completedSessions))throw new Error('Invalid DBD backup.');

      const localDevice=DATA.settings.deviceId;
      DATA=normalizeFutureData({
        ...p,
        appVersion:APP_VERSION,
        setup:migrateSetup(p.setup),
        completedSessions:p.completedSessions,
        activeSessions:Array.isArray(p.activeSessions)?p.activeSessions:(p.activeSession?[migrateLegacyActive(p.activeSession)].filter(Boolean):[]),
        currentActiveId:p.currentActiveId||null,
        questionBank:Array.isArray(p.questionBank)?p.questionBank:[],
        questionFeedback:Array.isArray(p.questionFeedback)?p.questionFeedback:[],
        schedulerConfig:p.schedulerConfig||schedulerDefaults099(),
        alertState:p.alertState||{dismissedUntil:{}},
        engineMetadata:p.engineMetadata||{},
        autoSessionState:p.autoSessionState||{},
        streamPrototype:p.streamPrototype||{attempts:[],seen:{}},
        streamEngine:p.streamEngine||{attempts:[],questionSeen:{},recentConceptIds:[],recentSubjectIds:[],burst:{}},
        settings:{...(p.settings||{}),deviceId:localDevice}
      });

      recomputeStatistics(DATA);
      r2RepairBank();
      clearEngineCache();
      save();
      alert('Backup replaced this browser data and migrated it to Schema 6.');
      route('home');
    }catch(e){
      alert(e.message||'Import failed.');
    }
  };
  i.click();
}

function resetSchedulerWeights099(){
  if(!confirm('Reset scheduler coefficients to the v0.9.9 defaults?'))return;
  DATA.schedulerConfig=schedulerDefaults099();
  clearEngineCache();
  save();
  render();
  setTimeout(()=>scheduleStreamPick(true),0);
}

function weightsHtml099(){
  const w=DATA.schedulerConfig.weights;
  const rows=[
    ['Subject diet',w.subjectDiet],
    ['New concept',w.newConcept],
    ['Weakness',w.weakness],
    ['Recent failure',w.recentFailure],
    ['Uncertainty',w.uncertainty],
    ['Overdue / day',w.overduePerDay],
    ['Secure penalty',-w.securePenalty],
    ['Recent concept',-w.recentConceptPenalty],
    ['Unseen question',w.unseenQuestion],
    ['Seen penalty',-w.seenQuestionPenalty],
    ['Recent question',-w.recentQuestionPenalty],
    ['Difficulty fit',w.difficultyFit],
    ['Good question',w.goodQuestion],
    ['Bad-question flag',-w.badQuestionPenalty],
    ['Dedicated Bank',w.bankPreference]
  ];

  return `<details class="engine-card099"><summary><h3 style="display:inline">Scheduler coefficients</h3></summary>
    <div class="weight-grid099">${rows.map(([k,v])=>`<div class="weight-row099"><span>${esc(k)}</span><strong>${Number(v)>=0?'+':''}${v}</strong></div>`).join('')}</div>
    <div style="margin-top:9px"><button class="button tiny" onclick="resetSchedulerWeights099()">RESET DEFAULT WEIGHTS</button></div>
  </details>`;
}

function dataView(){
  const bytes=new Blob([JSON.stringify(DATA)]).size;
  const size=bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`;
  const persistentState=DATA.settings.persistentStorageGranted?'Granted':'Normal browser storage';
  const h=dataHealth();
  const deviceShort=String(DATA.settings.deviceId||'').split('_').pop()?.slice(0,8)||'local';
  const active=(DATA.subjectRegistry||[]).filter(s=>s.active!==false).length;
  const muted=(DATA.subjectRegistry||[]).filter(s=>s.active===false).length;
  const alerts=currentAlerts099();

  return `<section class="data-page">
    <div class="eyebrow">Intelligence Architecture · ${APP_VERSION} · ${BUILD_ID} · Schema ${DATA.schemaVersion}</div>
    <h1>Data</h1>

    <div class="settings-group">
      <div class="settings-title">Storage</div>
      <div class="settings-row"><div><strong>Browser-local database</strong><small>dbd_gazali · device ${esc(deviceShort)}</small></div><span class="status-ok">ACTIVE</span></div>
      <div class="settings-row"><div><strong>Persistent storage</strong><small>Helps reduce browser eviction risk</small></div><button class="text-action" onclick="persistent()">${esc(persistentState)}</button></div>
    </div>

    <div class="settings-group">
      <div class="settings-title">Intelligence engine</div>
      <div class="metric-row"><span>Algorithm</span><strong>${esc(DATA.schedulerConfig.algorithmVersion)}</strong></div>
      <div class="metric-row"><span>Active / muted subjects</span><strong>${active} / ${muted}</strong></div>
      <div class="metric-row"><span>Question Bank</span><strong>${h.bank}</strong></div>
      <div class="metric-row"><span>Stream attempts</span><strong>${h.streamAttempts}</strong></div>
      <div class="metric-row"><span>Question feedback records</span><strong>${DATA.questionFeedback.length}</strong></div>
      <div class="metric-row"><span>Current alerts</span><strong>${alerts.length}</strong></div>
      <div class="metric-row"><span>Schema</span><strong>${DATA.schemaVersion}</strong></div>
      ${weightsHtml099()}
    </div>

    <div class="settings-group">
      <div class="settings-title">DBD Vault</div>
      <p class="note">Schema 6 Vaults include Stream evidence, question-quality feedback, alert dismissal state, scheduler policy, Auto Session provenance, subjects, manifests, and Bank inventory.</p>
      <div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div>
      <details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details>
    </div>

    <div class="settings-group">
      <div class="settings-title">Data health</div>
      <div class="metric-row"><span>Canonical subjects</span><strong>${h.subjects}</strong></div>
      <div class="metric-row"><span>Concept manifests</span><strong>${h.manifests}</strong></div>
      <div class="metric-row"><span>Orphan concept links</span><strong class="${h.orphans?'health-bad':'health-good'}">${h.orphans}</strong></div>
      <div class="metric-row"><span>Duplicate bank IDs</span><strong class="${h.duplicateBankIds?'health-bad':'health-good'}">${h.duplicateBankIds}</strong></div>
      <div class="metric-row"><span>Unresolved legacy tags</span><strong class="${h.unresolved?'health-warn':'health-good'}">${h.unresolved}</strong></div>
    </div>

    <div class="settings-group">
      <div class="settings-title">Local storage info</div>
      <div class="metric-row"><span>Completed sessions</span><strong>${DATA.completedSessions.length}</strong></div>
      <div class="metric-row"><span>Ongoing sessions</span><strong>${DATA.activeSessions.length}</strong></div>
      <div class="metric-row"><span>Approx. DBD data</span><strong>${size}</strong></div>
    </div>

    <div class="settings-group danger-zone">
      <div class="settings-title">Danger zone</div>
      <div class="settings-row"><div><strong>Reset all DBD data</strong><small>Deletes local sessions, Bank inventory, concept structure, evidence, and settings.</small></div><button class="button danger small" onclick="resetData()">RESET</button></div>
    </div>

    <p class="data-footnote">No accounts, cloud database, direct ChatGPT API, or server-side scheduler.</p>
  </section>`;
}

function boot099(){
  try{
    normalizeFutureData(DATA);
    const repaired=r2RepairBank();
    save();
    clearEngineCache();
    render();

    console.info(`DBD ${APP_VERSION} · ${BUILD_ID} · Schema ${DATA.schemaVersion}; repaired ${repaired} Bank metadata field(s).`);

    setTimeout(()=>scheduleStreamPick(true),25);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD v0.9.9 boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD could not finish Schema 6 startup.</h2><p>Your browser data remains under <strong>dbd_gazali</strong>.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}
/* ================= END DBD v0.9.9 — INTELLIGENCE ARCHITECTURE ================= */


/* =====================================================================
   DBD v0.9.9-dev2 — Schema 7 / Generation Protocol v2 / Fast Drill UI
   ===================================================================== */

const DEV2_PROTOCOL_VERSION='2.0';
const DEV2_PROMPT_COPY_LIMIT=18000;
let DEV2_FORCE_SUBJECT=null;
let DEV2_PICK_CACHE=null;
let DEV2_NEXT_PICK=null;
let DEV2_STREAM_MENU=false;
let DEV2_STREAM_WHY=false;
let DEV2_COMMENT_DRAFT='';
let DEV2_QUALITY_FLAGS=new Set();
let DEV2_QUESTION_SHOWN_AT=Date.now();
let DEV2_LAST_PICK_UID=null;

const DEV2_QUALITY_OPTIONS=[
  ['good','Good'],
  ['too_easy','Too easy'],
  ['too_hard','Too hard'],
  ['ambiguous','Ambiguous'],
  ['not_useful','Not useful'],
  ['bad_concept_match','Wrong concept']
];

/* ---------- Schema 7 ---------- */

function dev2Slug(v){
  return String(v||'dbd').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'')||'dbd';
}

function dev2HumanDate(value){
  try{return new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}
  catch(e){return''}
}

function collectionQuestionCountDev2(id){
  return (DATA.questionBank||[]).filter(q=>q.collectionId===id).length;
}

function collectionForQuestionDev2(q){
  if(!q)return null;
  return (DATA.bankCollections||[]).find(c=>c.id===(q.collectionId||q.bankId))||null;
}

function collectionEvidenceWeightDev2(q){
  const c=collectionForQuestionDev2(q);
  return Math.max(0,Math.min(1.5,Number(c?.evidenceWeight ?? 1)));
}

function ensureBankCollectionsDev2(data){
  data.bankCollections=Array.isArray(data.bankCollections)?data.bankCollections:[];
  const byId=new Map(data.bankCollections.map(c=>[String(c.id),c]));
  const groups=new Map();

  for(const q of data.questionBank||[]){
    const key=String(q.collectionId||q.bankId||`legacy_bank_${q.subjectId||'custom'}`);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(q);
  }

  for(const [key,qs] of groups){
    let c=byId.get(key);
    if(!c){
      const s=(data.subjectRegistry||[]).find(x=>x.id===qs[0]?.subjectId);
      const imported=qs.map(q=>q.importedAt).filter(Boolean).sort()[0]||new Date().toISOString();
      c={
        id:key,
        subjectId:qs[0]?.subjectId||s?.id||'subject_custom',
        name:`${s?.name||qs[0]?.subjectName||'Subject'} · Imported Bank`,
        status:'active',
        evidenceWeight:1,
        retirementReason:'',
        sourceBankId:qs[0]?.bankId||key,
        doctrineVersion:'legacy',
        subjectManifestRevision:null,
        createdAt:imported,
        updatedAt:imported,
        migratedFromLegacy:true
      };
      data.bankCollections.push(c);
      byId.set(key,c);
    }
    c.status=['active','paused','retired','quarantined'].includes(c.status)?c.status:'active';
    c.evidenceWeight=Number.isFinite(Number(c.evidenceWeight))?Number(c.evidenceWeight):1;
    for(const q of qs)q.collectionId=c.id;
  }

  return data.bankCollections;
}

function normalizeConceptDev2(c){
  if(!c)return null;
  const id=String(c.id||c.concept_id||'').trim();
  if(!id)return null;
  return{
    id,
    name:String(c.name||c.canonical_name||id),
    parentId:c.parentId??c.parent_id??null,
    aliases:[...new Set((c.aliases||[]).map(String))],
    prerequisites:[...new Set((c.prerequisites||c.prerequisite_ids||[]).map(String))],
    drillable:c.drillable!==false,
    kind:String(c.kind||'concept')
  };
}

function subjectManifestDev2(subjectId){
  return (DATA.subjectManifests||[]).find(m=>m.subjectId===subjectId)||null;
}

function provisionalSubjectManifestDev2(data,s){
  const old=(data.conceptManifests||[]).find(m=>m.subjectId===s.id);
  const concepts=(old?.concepts||[]).map(normalizeConceptDev2).filter(Boolean);
  return{
    id:`subject_manifest_${s.id}`,
    subjectId:s.id,
    canonicalName:s.name,
    namespace:String(s.namespace||dev2Slug(s.name).replace(/-/g,'_').toUpperCase()),
    aliases:[...new Set([s.name,...(s.aliases||[])])],
    revision:Number(old?.revision||0),
    status:old?.concepts?.length?'canonical':'provisional',
    curriculum:'',
    concepts,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    provenance:old?.concepts?.length?'migrated_concept_manifest':'schema7_provisional'
  };
}

function ensureSubjectManifestsDev2(data){
  data.subjectManifests=Array.isArray(data.subjectManifests)?data.subjectManifests:[];
  const map=new Map(data.subjectManifests.map(m=>[m.subjectId,m]));
  for(const s of data.subjectRegistry||[]){
    if(!map.has(s.id)){
      const m=provisionalSubjectManifestDev2(data,s);
      data.subjectManifests.push(m);
      map.set(s.id,m);
    }
  }
  for(const m of data.subjectManifests){
    m.aliases=Array.isArray(m.aliases)?m.aliases:[];
    m.concepts=(m.concepts||[]).map(normalizeConceptDev2).filter(Boolean);
    m.status=m.status==='canonical'?'canonical':'provisional';
    m.revision=Number(m.revision||0);
  }
  return data.subjectManifests;
}

function syncConceptManifestCompatibilityDev2(data){
  data.conceptManifests=Array.isArray(data.conceptManifests)?data.conceptManifests:[];
  const map=new Map(data.conceptManifests.map(m=>[m.subjectId,m]));
  for(const sm of data.subjectManifests||[]){
    if(sm.status!=='canonical'||!sm.concepts.length)continue;
    const compat={
      id:`manifest_${sm.subjectId}`,
      subjectId:sm.subjectId,
      subjectName:sm.canonicalName,
      revision:sm.revision,
      title:`${sm.canonicalName} Concept Manifest`,
      concepts:sm.concepts.map(c=>({
        id:c.id,name:c.name,parentId:c.parentId,aliases:c.aliases||[],
        prerequisites:c.prerequisites||[],kind:c.kind||'concept'
      })),
      importedAt:sm.updatedAt||new Date().toISOString()
    };
    const old=map.get(sm.subjectId);
    if(!old||Number(old.revision||0)<=Number(compat.revision||0)){
      map.set(sm.subjectId,compat);
    }
  }
  data.conceptManifests=[...map.values()];
}

function normalizeSchema7Dev2(data){
  data.schemaVersion=7;
  data.appVersion=APP_VERSION;
  data.bankCollections=Array.isArray(data.bankCollections)?data.bankCollections:[];
  data.subjectManifests=Array.isArray(data.subjectManifests)?data.subjectManifests:[];
  data.streamEngine=data.streamEngine||{};
  data.streamEngine.attempts=Array.isArray(data.streamEngine.attempts)?data.streamEngine.attempts:[];
  data.streamEngine.questionSeen=data.streamEngine.questionSeen||{};
  data.streamEngine.recentConceptIds=Array.isArray(data.streamEngine.recentConceptIds)?data.streamEngine.recentConceptIds:[];
  data.streamEngine.recentSubjectIds=Array.isArray(data.streamEngine.recentSubjectIds)?data.streamEngine.recentSubjectIds:[];
  data.streamEngine.burst={
    id:data.streamEngine.burst?.id||makeUid('burst'),
    count:Number(data.streamEngine.burst?.count||0),
    correct:Number(data.streamEngine.burst?.correct||0),
    startedAt:data.streamEngine.burst?.startedAt||new Date().toISOString()
  };
  ensureBankCollectionsDev2(data);
  ensureSubjectManifestsDev2(data);
  syncConceptManifestCompatibilityDev2(data);
  data.schedulerConfig=normalizeSchedulerConfig099(data.schedulerConfig);
  data.schedulerConfig.algorithmVersion='0.9.9-dev2-weighted-2';
  data.engineMetadata=data.engineMetadata||{};
  data.engineMetadata.schedulerVersion=data.schedulerConfig.algorithmVersion;
  data.engineMetadata.schema7MigratedAt=data.engineMetadata.schema7MigratedAt||new Date().toISOString();
  return data;
}

/* capture dev1 normalizer, then extend it without affecting the initial load */
const DEV2_NORMALIZE_DEV1=normalizeFutureData;
normalizeFutureData=function(data){
  const d=DEV2_NORMALIZE_DEV1(data);
  return normalizeSchema7Dev2(d);
};

save=function(){
  DATA.appVersion=APP_VERSION;
  DATA.schemaVersion=7;
  DATA.schedulerConfig=normalizeSchedulerConfig099(DATA.schedulerConfig);
  DATA.schedulerConfig.algorithmVersion='0.9.9-dev2-weighted-2';
  DATA.engineMetadata=DATA.engineMetadata||{};
  DATA.engineMetadata.schedulerVersion=DATA.schedulerConfig.algorithmVersion;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(DATA))}
  catch(e){console.error('DBD save failed',e)}
};

/* ---------- Bank lifecycle ---------- */

function collectionsForSubjectDev2(subjectId){
  return (DATA.bankCollections||[])
    .filter(c=>c.subjectId===subjectId)
    .sort((a,b)=>{
      const rank={active:0,paused:1,retired:2,quarantined:3};
      return (rank[a.status]??9)-(rank[b.status]??9) ||
        new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0);
    });
}

function activeBankQuestionsDev2(subjectId){
  const active=new Set((DATA.bankCollections||[])
    .filter(c=>c.subjectId===subjectId&&c.status==='active')
    .map(c=>c.id));
  return (DATA.questionBank||[]).filter(q=>
    q.subjectId===subjectId &&
    active.has(q.collectionId||q.bankId) &&
    q.streamEligible!==false &&
    !q.paperRequired && !q.calculatorRequired
  );
}

function allEligibleQuestionsDev2(subjectId){
  const bank=activeBankQuestionsDev2(subjectId);
  if(bank.length)return bank;

  const s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  if(s?.legacyStreamEnabled===false)return[];

  const rows=[];
  const seen=new Set();
  for(const sess of canonicalSessions(subjectId)){
    for(const q of sess._packetQuestions||[]){
      if(!q?.choices||q.paperRequired||q.paper_required)continue;
      const uid=`hist:${sess.id}:${q.uid||q.id}`;
      if(seen.has(uid))continue;
      seen.add(uid);
      rows.push({
        uid,id:q.id||uid,subjectId,subjectName:s?.name||sess.subject,
        primaryConceptId:resolveConceptRef(subjectId,(q.tags||[])[0]||'Legacy'),
        conceptIds:(q.tags||[]).map(x=>resolveConceptRef(subjectId,x)).filter(Boolean),
        type:'mcq',prompt:q.prompt||'',choices:q.choices,answer:q.answer,
        explanation:q.explanation||'',difficulty:q.difficulty||'medium',
        streamEligible:true,paperRequired:false,calculatorRequired:false,
        sourceType:'history-native',collectionId:null
      });
    }
  }
  return rows;
}

/* compatibility functions now respect collection lifecycle */
canonicalInventoryForSubject=function(subjectId){return activeBankQuestionsDev2(subjectId)};
r2SafeBank=function(subjectId){return activeBankQuestionsDev2(subjectId)};

function setCollectionStatusDev2(collectionId,status){
  const c=(DATA.bankCollections||[]).find(x=>x.id===collectionId);
  if(!c)return;
  if(!['active','paused','retired','quarantined'].includes(status))return;
  c.status=status;
  c.updatedAt=new Date().toISOString();
  clearEngineCache();
  DEV2_PICK_CACHE=null;
  save();
  render();
}

function retireCollectionDev2(collectionId){
  const c=(DATA.bankCollections||[]).find(x=>x.id===collectionId);
  if(!c)return;
  const reason=prompt(
    'Retire reason (poor / outdated / redundant / other). History will NOT be deleted.',
    c.retirementReason||'poor'
  );
  if(reason===null)return;

  const r=String(reason||'other').trim().toLowerCase();
  c.status='retired';
  c.retirementReason=r||'other';
  c.retiredAt=new Date().toISOString();
  c.updatedAt=c.retiredAt;

  if(r.startsWith('poor')||r.includes('bad')||r.includes('quality'))c.evidenceWeight=.15;
  else if(r.startsWith('redund'))c.evidenceWeight=.35;
  else if(r.startsWith('outdat'))c.evidenceWeight=.5;
  else c.evidenceWeight=.5;

  clearEngineCache();
  DEV2_PICK_CACHE=null;
  save();
  render();
}

function restoreCollectionDev2(collectionId){
  const c=(DATA.bankCollections||[]).find(x=>x.id===collectionId);
  if(!c)return;
  c.status='active';
  c.updatedAt=new Date().toISOString();
  clearEngineCache();
  DEV2_PICK_CACHE=null;
  save();
  render();
}

/* ---------- Subject Manifest protocol ---------- */

function normalizeSubjectManifestImportDev2(raw,subjectRec){
  const base=raw?.subject_manifest||raw?.subjectManifest||raw;
  const concepts=(base?.concepts||[]).map(normalizeConceptDev2).filter(Boolean);
  return{
    id:String(base?.id||`subject_manifest_${subjectRec.id}`),
    subjectId:subjectRec.id,
    canonicalName:String(base?.canonical_name||base?.canonicalName||base?.name||subjectRec.name),
    namespace:String(base?.namespace||dev2Slug(subjectRec.name).replace(/-/g,'_').toUpperCase()),
    aliases:[...new Set([subjectRec.name,...(base?.aliases||[])].map(String))],
    revision:Number(base?.revision||1),
    status:'canonical',
    curriculum:String(base?.curriculum||''),
    concepts,
    createdAt:base?.created_at||base?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    provenance:String(base?.provenance||'dbd_generation_protocol_v2')
  };
}

function mergeSubjectManifestDev2(manifest){
  const idx=(DATA.subjectManifests||[]).findIndex(m=>m.subjectId===manifest.subjectId);
  if(idx<0){DATA.subjectManifests.push(manifest);syncConceptManifestCompatibilityDev2(DATA);return true}
  const old=DATA.subjectManifests[idx];
  if(Number(manifest.revision||0)>=Number(old.revision||0)){
    DATA.subjectManifests[idx]=manifest;
    syncConceptManifestCompatibilityDev2(DATA);
    return true;
  }
  return false;
}

function applyManifestPatchDev2(subjectId,patch){
  if(!patch)return false;
  const sm=subjectManifestDev2(subjectId);
  if(!sm)throw new Error('Manifest patch cannot be applied because the subject manifest is missing.');
  const base=Number(patch.base_revision??patch.baseRevision??sm.revision);
  if(base!==Number(sm.revision)){
    throw new Error(`Manifest patch expects revision ${base}, but DBD currently has revision ${sm.revision}.`);
  }

  const map=new Map((sm.concepts||[]).map(c=>[c.id,{...c}]));
  for(const c of patch.add_concepts||patch.addConcepts||[]){
    const x=normalizeConceptDev2(c);
    if(x)map.set(x.id,x);
  }

  for(const row of patch.add_aliases||patch.addAliases||[]){
    const id=String(row.id||row.concept_id||'');
    const c=map.get(id); if(!c)continue;
    c.aliases=[...new Set([...(c.aliases||[]),...(row.aliases||[])].map(String))];
  }

  for(const row of patch.renames||[]){
    const id=String(row.id||row.concept_id||'');
    const c=map.get(id); if(!c)continue;
    const old=c.name;
    c.name=String(row.new_name||row.name||c.name);
    c.aliases=[...new Set([...(c.aliases||[]),old].filter(Boolean))];
  }

  sm.concepts=[...map.values()];
  sm.revision=Number(patch.new_revision??patch.newRevision??(sm.revision+1));
  sm.status='canonical';
  sm.updatedAt=new Date().toISOString();
  syncConceptManifestCompatibilityDev2(DATA);
  return true;
}

function resolveManifestConceptExactDev2(subjectId,ref){
  if(!ref)return null;
  const sm=subjectManifestDev2(subjectId);
  const raw=String(ref);
  if(sm?.status==='canonical'){
    const n=aliasNorm(raw);
    const c=(sm.concepts||[]).find(c=>c.id===raw||aliasNorm(c.name)===n||(c.aliases||[]).some(a=>aliasNorm(a)===n));
    return c?.id||null;
  }
  return resolveConceptRef(subjectId,raw)||stableLegacyConceptId(raw);
}

function displayConceptNameDev2(q){
  const sm=subjectManifestDev2(q.subjectId);
  if(sm?.status!=='canonical')return'';
  const id=q.primaryConceptId||(q.conceptIds||[])[0];
  const c=(sm.concepts||[]).find(x=>x.id===id);
  return c?.name||'';
}

function manifestPromptPayloadDev2(subjectId){
  const s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  const sm=subjectManifestDev2(subjectId)||provisionalSubjectManifestDev2(DATA,s||{id:subjectId,name:subjectId,aliases:[]});
  return{
    subject_id:sm.subjectId,
    canonical_name:sm.canonicalName,
    namespace:sm.namespace,
    aliases:sm.aliases,
    revision:sm.revision,
    status:sm.status,
    curriculum:sm.curriculum,
    concepts:sm.concepts.map(c=>({
      id:c.id,name:c.name,parent_id:c.parentId,aliases:c.aliases,
      prerequisite_ids:c.prerequisites,drillable:c.drillable
    }))
  };
}

/* ---------- DBD Generation Protocol v2 ---------- */

function universalDoctrineDev2(){
return `# DBD Generation Protocol v2

## Core purpose

DBD is a retrieval and evidence system. It is NOT a textbook, notes app, generic quiz maker, or miniature exam feed.

ChatGPT/teacher/tutor has semantic authority: understand material, teach, restructure concepts, and generate genuinely new probes.
DBD has empirical authority: record attempts, confidence/quality evidence, schedule retrieval, and compose practice from existing inventory.

## Stream doctrine

A Stream item is a compact retrieval probe. Every item consumes scarce learner attention and MUST justify its existence through retention value, diagnostic value, transfer value, or error-repair value.

"Quick" does not mean trivial.

Difficulty should come from sophistication of the mental representation, misconception, decision rule, or transfer—not decorative wording, bloated context, or tedious arithmetic.

Stream trains the mental machinery used inside full problems. Session tests integration of that machinery.

Normally target one meaningful retrieval operation per item.

Prefer:
- recognition of structure;
- method selection;
- rule/condition retrieval;
- error detection;
- misconception discrimination;
- qualitative relationship;
- formula meaning;
- interpretation of a representation;
- short mental transformation;
- small mental calculation when the calculation itself is the concept.

Avoid:
- mini-exam problems disguised as Stream;
- decorative word problems;
- long arithmetic;
- multi-line algebra;
- graph drawing;
- lengthy derivations;
- fake complexity;
- trivia with little transfer value;
- five numerical skins of the same probe;
- turning a normal MCQ into a proposed-answer TRUE/FALSE wrapper.

If a capability cannot be probed honestly without paper/calculator/multi-step work, put it in session_only_recommendations instead of forcing it into Stream.

## Silent design pass — required BEFORE writing questions

Do this internally. Do NOT reveal chain-of-thought or private reasoning.

1. Identify the real performance target.
2. Decompose it into reusable mental primitives.
3. Separate Stream-suitable primitives from Session-only integration.
4. Identify realistic misconceptions, traps, and failure modes.
5. Allocate question counts by learning value and failure-mode richness—not equal quotas.
6. Design genuinely different probes of the same concept.
7. Generate candidate items.
8. Audit each candidate for relevance, redundancy, artificiality, ambiguity, and diagnostic value.
9. Reject/revise weak candidates.
10. Export only the survivors.

## Stable ontology rule

The supplied Subject Manifest is authoritative.

If a concept already exists, use its exact stable concept ID.
Do not silently rename concepts.
Do not create stylistic synonyms as new concepts.
Aliases may be proposed only when academically equivalent.

If genuinely new learned material is not represented, return a manifest_patch with an explicit base_revision and new_revision before questions reference the new IDs.

IDs are stable. Canonical names are stable. Aliases may grow.

## Native Stream interactions

Supported interaction_type values:
- choice2
- choice4
- true_false
- numeric
- direct_recall

Use the simplest honest interaction.

For choice2/choice4, provide choices as an object with exactly 2 or 4 choices and one correct key.
For true_false, answer must be boolean.
For numeric, provide answer plus optional accepted_answers/tolerance.
For direct_recall, provide answer plus accepted_answers. Keep it short enough for fast entry.

Every Stream item must have:
stream_eligible:true
paper_required:false
calculator_required:false

## Bank Collection rule

A Bank Collection is reusable inventory, not a fixed test.

Questions from one collection may be scheduled across many future bursts/sessions.

Collections have lifecycle:
active = schedulable
paused = temporarily excluded
retired = historical only
quarantined = structurally unsafe until fixed

Never instruct DBD to delete historical attempts.

## Output quality

No equal per-concept quotas unless pedagogically justified.
No raw HTML.
No markdown commentary around the final JSON package.
Do not output your internal design notes.

When the requested package is large, return a downloadable .json package rather than pasting a massive JSON blob.`;
}

function generationContextDev2(subjectId){
  const s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  let ev=[];
  try{ev=conceptEvidenceV3(subjectId)}catch(e){}
  const manifest=manifestPromptPayloadDev2(subjectId);
  const collections=collectionsForSubjectDev2(subjectId);
  const qFeedback=(DATA.questionFeedback||[])
    .filter(f=>f.subjectId===subjectId)
    .slice(-25)
    .map(f=>({question_uid:f.questionUid,quality_flags:f.qualityFlags||[],comment:f.comment||''}));

  const weaknesses=ev
    .filter(e=>e.state==='weak'||e.state==='shaky'||e.state==='new')
    .sort((a,b)=>(b.wrong||0)-(a.wrong||0))
    .slice(0,30)
    .map(e=>({
      concept_id:e.concept.id,
      concept_name:e.concept.name,
      state:e.state,
      seen:e.seen,
      correct:e.correct,
      unsure:e.unsure,
      guess:e.guess,
      dont_know:e.dontKnow,
      last_seen_at:e.lastSeenAt
    }));

  return{
    subject:{id:s?.id||subjectId,name:s?.name||subjectId},
    subject_manifest:manifest,
    stream_policy:{
      active:s?.active!==false,
      weight:s?.streamWeight||1,
      target_difficulty:s?.targetDifficulty||'adaptive'
    },
    bank_collections:collections.map(c=>({
      id:c.id,name:c.name,status:c.status,
      question_count:collectionQuestionCountDev2(c.id),
      doctrine_version:c.doctrineVersion||'legacy',
      subject_manifest_revision:c.subjectManifestRevision,
      retirement_reason:c.retirementReason||''
    })),
    current_evidence:weaknesses,
    recent_question_quality_feedback:qFeedback
  };
}

function generationRequestDev2(subjectId,purpose='refill'){
  const ctx=generationContextDev2(subjectId);
  const sm=ctx.subject_manifest;
  const firstManifest=sm.status!=='canonical';

  return `${universalDoctrineDev2()}

---

# Generation request

TARGET SUBJECT: ${ctx.subject.name}
PURPOSE: ${purpose}

The JSON below is authoritative DBD context. Use the supplied IDs exactly.

${JSON.stringify(ctx,null,2)}

## Subject-manifest instruction

${firstManifest
? `This subject currently has only a PROVISIONAL manifest. Before generating the Bank, create a complete subject_manifest for the learned/current scope supported by this subject chat. Use stable IDs and a coherent hierarchy. The first canonical revision must be 1. Do not expose backend placeholder names to the learner.`
: `The supplied Subject Manifest revision ${sm.revision} is canonical. Reuse it exactly. If genuinely new learned material is missing, include manifest_patch with base_revision:${sm.revision} and a higher new_revision. Do not rebuild or stylistically rename the existing ontology.`}

Before generating, inspect the actual files, lesson history, tutor material, mistakes, and current scope in THIS subject chat. Ground the questions in what the chat supports.

Perform the required silent design pass and audit. Do not show internal reasoning.

Generate a high-quality reusable Bank Collection. Do not target an arbitrary round number. Generate only as many distinct high-value Stream probes as the learned scope genuinely supports. If this is a refill, prioritize weak, new, due, depleted, and under-varied concepts while avoiding semantic duplicates of existing inventory.

## Required package shape

{
  "package_type": "dbd_generation_package_v2",
  "protocol_version": "${DEV2_PROTOCOL_VERSION}",
  "subject_manifest": null,
  "manifest_patch": null,
  "bank_collection": {
    "id": "stable_unique_collection_id",
    "name": "human-readable collection name",
    "subject_id": "${ctx.subject.id}",
    "subject_manifest_revision": ${firstManifest?1:sm.revision},
    "doctrine_version": "${DEV2_PROTOCOL_VERSION}",
    "purpose": "${purpose}",
    "status": "active",
    "source_basis": ["exact files / lessons / chat evidence used"],
    "questions": [
      {
        "id": "stable_unique_question_id",
        "uid": "stable_unique_question_id",
        "primary_concept_id": "EXACT_MANIFEST_ID",
        "secondary_concept_ids": [],
        "interaction_type": "choice2 | choice4 | true_false | numeric | direct_recall",
        "prompt": "compact retrieval probe",
        "choices": {"A":"...","B":"...","C":"...","D":"..."},
        "answer": "A",
        "accepted_answers": [],
        "tolerance": 0,
        "explanation": "brief repair/explanation after answer",
        "difficulty": "easy | medium | hard",
        "stream_eligible": true,
        "paper_required": false,
        "calculator_required": false,
        "estimated_seconds": 20,
        "diagnostic_target": "what capability this probe measures",
        "failure_mode": "specific misconception/trap if relevant",
        "source_basis": "specific material basis"
      }
    ]
  },
  "session_only_recommendations": []
}

If subject_manifest is supplied for a first canonical import, bank_collection.subject_manifest_revision must match it.
If manifest_patch is supplied, bank_collection.subject_manifest_revision must match manifest_patch.new_revision.

Return the package as a downloadable .json file when it is large.`;
}

async function deliverGenerationRequestDev2(subjectId,button,purpose='refill'){
  const text=generationRequestDev2(subjectId,purpose);
  const s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  if(text.length>DEV2_PROMPT_COPY_LIMIT){
    download(
      `dbd-${dev2Slug(s?.name||subjectId)}-generation-request-${localDay()}.md`,
      text,
      'text/markdown'
    );
    if(button){
      const old=button.textContent;
      button.textContent='DOWNLOADED .MD ✓';
      setTimeout(()=>button.textContent=old,1500);
    }
    return;
  }
  await copyText(text,button);
}

function downloadDoctrineDev2(button){
  download('DBD_GENERATION_PROTOCOL_v2.md',universalDoctrineDev2(),'text/markdown');
  if(button){
    const old=button.textContent;
    button.textContent='DOWNLOADED ✓';
    setTimeout(()=>button.textContent=old,1300);
  }
}

/* Replace old vanilla instruction with a doctrine-aware Session request. */
createVanillaPrompt=function(){
  return `${universalDoctrineDev2()}

---

# DBD Session request

This is a deliberate Session, not reusable Stream inventory.

First inspect the files and recent conversation in this subject chat. Ask one compact setup question covering:
- material scope;
- Coverage / Focused / Deep / Repair / Mastery / Exam;
- no-paper conceptual vs full written problem solving;
- MCQ vs Mixed;
- question count;
- difficulty;
- feedback timing.

After I answer, create a normal DBD Session packet using only the supported material.

For a no-paper conceptual Session, apply the Stream doctrine's compact mental-probe rules.
For full problem solving, authentic integrated written work is allowed.

Do not expose private chain-of-thought.`;
};

/* ---------- Protocol-v2 import ---------- */

function ensureSubjectDev2(subjectId,name,aliases=[]){
  ensureSubjectRegistry(DATA);
  let s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  if(!s){
    const byName=(DATA.subjectRegistry||[]).find(x=>aliasNorm(x.name)===aliasNorm(name));
    if(byName)s=byName;
  }
  if(!s){
    s=normalizeStreamPolicyRecord({
      id:subjectId||`subject_${dev2Slug(name)}`,
      name:name||'Custom',
      autoKey:dev2Slug(name),
      aliases,
      active:true,streamWeight:2,targetDifficulty:'adaptive',
      legacyStreamEnabled:true,
      policyUpdatedAt:new Date().toISOString()
    });
    DATA.subjectRegistry.push(s);
  }else{
    s.aliases=[...new Set([...(s.aliases||[]),...(aliases||[]),name].filter(Boolean))];
  }
  return s;
}

function normalizeV2QuestionDev2(q,subjectRec,collection,manifest){
  if(!q)return null;
  const interaction=String(q.interaction_type||q.interactionType||q.type||'choice4').toLowerCase();
  const primaryRaw=q.primary_concept_id||q.primaryConceptId;
  const secondaryRaw=q.secondary_concept_ids||q.secondaryConceptIds||q.concept_ids||q.conceptIds||[];
  const primary=resolveManifestConceptExactDev2(subjectRec.id,primaryRaw);
  const secondary=(secondaryRaw||[]).map(x=>resolveManifestConceptExactDev2(subjectRec.id,x)).filter(Boolean);
  const unknown=Boolean(manifest?.status==='canonical'&&primaryRaw&&!primary);

  const choices=q.choices&&typeof q.choices==='object'?q.choices:null;
  const supported=['choice2','choice4','true_false','numeric','direct_recall','mcq'].includes(interaction);
  const paperRequired=Boolean(q.paper_required??q.paperRequired??false);
  const calculatorRequired=Boolean(q.calculator_required??q.calculatorRequired??false);

  return{
    uid:String(q.uid||q.id||makeUid('q')),
    id:String(q.id||q.uid||makeUid('q')),
    collectionId:collection.id,
    bankId:collection.sourceBankId||collection.id,
    subjectId:subjectRec.id,
    subjectName:subjectRec.name,
    primaryConceptId:primary||stableLegacyConceptId(primaryRaw||'General'),
    conceptIds:[...new Set([primary,...secondary].filter(Boolean))],
    interactionType:interaction==='mcq'?(choices&&Object.keys(choices).length===2?'choice2':'choice4'):interaction,
    type:interaction==='true_false'?'true_false':choices?'mcq':interaction,
    prompt:String(q.prompt||q.question||q.statement||''),
    statement:String(q.statement||''),
    choices,
    answer:q.answer,
    acceptedAnswers:q.accepted_answers||q.acceptedAnswers||[],
    tolerance:Number(q.tolerance||0),
    explanation:String(q.explanation||''),
    difficulty:String(q.difficulty||'medium'),
    streamEligible:Boolean(
      q.stream_eligible!==false&&q.streamEligible!==false&&supported&&!paperRequired&&!calculatorRequired&&!unknown
    ),
    paperRequired,
    calculatorRequired,
    estimatedSeconds:Number(q.estimated_seconds??q.estimatedSeconds??0)||null,
    diagnosticTarget:String(q.diagnostic_target||q.diagnosticTarget||''),
    failureMode:String(q.failure_mode||q.failureMode||''),
    sourceBasis:q.source_basis||q.sourceBasis||'',
    importedAt:new Date().toISOString(),
    importIssue:unknown?'unknown_manifest_concept':''
  };
}

function importGenerationPackageV2Dev2(raw){
  const bcRaw=raw.bank_collection||raw.bankCollection||{};
  const smRaw=raw.subject_manifest||raw.subjectManifest||null;
  const patch=raw.manifest_patch||raw.manifestPatch||null;

  const subjectId=String(
    bcRaw.subject_id||bcRaw.subjectId||
    smRaw?.subject_id||smRaw?.subjectId||
    raw.subject_id||raw.subjectId||
    `subject_${dev2Slug(smRaw?.canonical_name||smRaw?.canonicalName||raw.subject||'custom')}`
  );
  const subjectName=String(
    smRaw?.canonical_name||smRaw?.canonicalName||bcRaw.subject_name||bcRaw.subjectName||
    raw.subject?.name||raw.subject||subjectId.replace(/^subject_/,'').replace(/[-_]/g,' ')
  );

  const subjectRec=ensureSubjectDev2(subjectId,subjectName,smRaw?.aliases||[]);

  let manifestChanged=false;
  if(smRaw){
    const sm=normalizeSubjectManifestImportDev2(smRaw,subjectRec);
    manifestChanged=mergeSubjectManifestDev2(sm);
  }
  if(patch)manifestChanged=applyManifestPatchDev2(subjectRec.id,patch)||manifestChanged;

  const sm=subjectManifestDev2(subjectRec.id);
  const collectionId=String(bcRaw.id||bcRaw.collection_id||bcRaw.collectionId||makeUid('collection'));
  let collection=(DATA.bankCollections||[]).find(c=>c.id===collectionId);
  if(!collection){
    collection={
      id:collectionId,
      subjectId:subjectRec.id,
      name:String(bcRaw.name||`${subjectRec.name} · Generated Bank`),
      status:['active','paused','retired'].includes(bcRaw.status)?bcRaw.status:'active',
      evidenceWeight:1,
      retirementReason:'',
      sourceBankId:collectionId,
      doctrineVersion:String(bcRaw.doctrine_version||bcRaw.doctrineVersion||raw.protocol_version||DEV2_PROTOCOL_VERSION),
      subjectManifestRevision:Number(bcRaw.subject_manifest_revision??bcRaw.subjectManifestRevision??sm?.revision??0),
      purpose:String(bcRaw.purpose||'refill'),
      sourceBasis:bcRaw.source_basis||bcRaw.sourceBasis||[],
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      migratedFromLegacy:false
    };
    DATA.bankCollections.push(collection);
  }

  const rawQuestions=bcRaw.questions||raw.questions||[];
  const normalized=rawQuestions.map(q=>normalizeV2QuestionDev2(q,subjectRec,collection,sm)).filter(Boolean);
  const unknown=normalized.filter(q=>q.importIssue).length;

  if(sm?.status==='canonical'){
    const expected=Number(collection.subjectManifestRevision||0);
    if(expected&&expected!==Number(sm.revision)){
      collection.status='quarantined';
      collection.quarantineReason=`Package expects Subject Manifest revision ${expected}; DBD has ${sm.revision}.`;
    }
  }
  if(unknown){
    collection.status='quarantined';
    collection.quarantineReason=`${unknown} question(s) reference concept IDs not present in the authoritative Subject Manifest.`;
  }

  const bank=new Map((DATA.questionBank||[]).map(q=>[q.uid||q.id,q]));
  let added=0,updated=0;
  for(const q of normalized){
    if(bank.has(q.uid))updated++; else added++;
    bank.set(q.uid,q);
  }
  DATA.questionBank=[...bank.values()];
  normalizeSchema7Dev2(DATA);
  clearEngineCache();
  DEV2_PICK_CACHE=null;
  save();

  return{
    subjectRec,collection,manifestChanged,added,updated,total:normalized.length,
    quarantined:collection.status==='quarantined',
    issue:collection.quarantineReason||''
  };
}

/* Legacy packages remain importable and are wrapped into a generic collection. */
const DEV2_IMPORT_LEGACY=importKnowledgeObject;
importKnowledgeObject=function(raw){
  if(raw?.package_type==='dbd_generation_package_v2'||raw?.protocol_version==='2.0'){
    return importGenerationPackageV2Dev2(raw);
  }

  const beforeIds=new Set((DATA.questionBank||[]).map(q=>q.uid||q.id));
  const result=DEV2_IMPORT_LEGACY(raw);
  normalizeSchema7Dev2(DATA);

  const newly=(DATA.questionBank||[]).filter(q=>!beforeIds.has(q.uid||q.id));
  if(newly.length){
    const key=String(newly[0].bankId||makeUid('collection'));
    let c=(DATA.bankCollections||[]).find(x=>x.id===key);
    if(!c){
      c={
        id:key,subjectId:result.subjectRec.id,
        name:`${result.subjectRec.name} · Legacy Import`,
        status:'active',evidenceWeight:1,retirementReason:'',
        sourceBankId:key,doctrineVersion:'legacy',
        subjectManifestRevision:subjectManifestDev2(result.subjectRec.id)?.revision||null,
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
        migratedFromLegacy:true
      };
      DATA.bankCollections.push(c);
    }
    newly.forEach(q=>q.collectionId=c.id);
  }

  save();
  return{...result,collection:(DATA.bankCollections||[]).find(c=>c.subjectId===result.subjectRec.id)};
};

function importKnowledgeFile(){
  const i=document.createElement('input');
  i.type='file';i.accept='.json,application/json';
  i.onchange=async()=>{
    try{
      if(!i.files?.[0])return;
      const raw=JSON.parse(await i.files[0].text());
      const r=importKnowledgeObject(raw);
      selectedSubjectId=r.subjectRec.id;
      alert(
        `${r.subjectRec.name}: ${r.added||0} new · ${r.updated||0} updated.`+
        (r.quarantined?`\nCollection quarantined: ${r.issue}`:'')
      );
      route('subjects');
    }catch(e){
      console.error(e);
      alert(e.message||'Knowledge import failed.');
    }
  };
  i.click();
}

/* ---------- Fast weighted scheduler ---------- */

function dev2NewEvidence(conceptId,name){
  return{
    concept:{id:conceptId,name:name||'Concept'},
    seen:0,correct:0,secureCorrect:0,wrong:0,unsure:0,guess:0,dontKnow:0,skipped:0,
    weightedPositive:0,weightedTotal:0,questionVariety:0,dayVariety:0,lastSeenAt:null,
    state:'new',sources:{session:0,stream:0}
  };
}

function dev2SubjectCandidates(){
  const subjects=(DATA.subjectRegistry||[])
    .map(normalizeStreamPolicyRecord)
    .filter(s=>s.active!==false&&Number(s.streamWeight)>0);

  return subjects.filter(s=>allEligibleQuestionsDev2(s.id).length>0);
}

function dev2ChooseSubject(subjects){
  if(DEV2_FORCE_SUBJECT){
    const forced=subjects.find(s=>s.id===DEV2_FORCE_SUBJECT);
    if(forced)return forced;
  }
  return subjects
    .map(s=>({s,p:subjectDietPressure099(s,subjects).score}))
    .sort((a,b)=>b.p-a.p)[0]?.s||null;
}

function schedulerPickDev2(){
  const subjects=dev2SubjectCandidates();
  if(!subjects.length)return null;
  const s=dev2ChooseSubject(subjects);
  if(!s)return null;

  let ev=[];
  try{ev=conceptEvidenceV3(s.id)}catch(e){ev=[]}
  const evMap=new Map(ev.map(e=>[String(e.concept.id),e]));
  const subjectScore=subjectDietPressure099(s,subjects);
  const recent=(DATA.streamEngine?.recentConceptIds||[]).slice(0,8);
  const rows=[];

  for(const q of allEligibleQuestionsDev2(s.id)){
    const cid=String(q.primaryConceptId||(q.conceptIds||[])[0]||`general_${s.id}`);
    const display=displayConceptNameDev2(q);
    const e=evMap.get(cid)||dev2NewEvidence(cid,display||'Concept');
    const cs=scoreConcept099(e,s);
    const qs=scoreQuestion099(q,s,cid);
    const trust=(collectionEvidenceWeightDev2(q)-1)*18;
    const sameRecent=recent.filter(x=>x===cid).length;
    const diversityPenalty=-Math.min(2,sameRecent)*4;
    const finalScore=subjectScore.score+cs.score+qs.score+trust+diversityPenalty;

    rows.push({
      ...q,
      subjectName:s.name,
      conceptState:e.state||'new',
      conceptName:display,
      priorityScore:finalScore,
      schedulerBreakdown:{
        subjectParts:subjectScore.parts,
        conceptParts:cs.parts,
        questionParts:[
          ...qs.parts,
          ...(trust?[{label:'Collection trust',value:Math.round(trust)}]:[]),
          ...(diversityPenalty?[{label:'Burst diversity',value:diversityPenalty}]:[])
        ],
        finalScore
      }
    });
  }

  rows.sort((a,b)=>b.priorityScore-a.priorityScore||simpleHash(a.uid)-simpleHash(b.uid));
  return rows[0]||null;
}

function dev2GetPick(){
  if(!DEV2_PICK_CACHE){
    DEV2_PICK_CACHE=schedulerPickDev2();
    if(DEV2_PICK_CACHE){
      DEV2_QUESTION_SHOWN_AT=Date.now();
      DEV2_LAST_PICK_UID=DEV2_PICK_CACHE.uid;
    }
  }
  return DEV2_PICK_CACHE;
}

function dev2CorrectFor(q,selected){
  const interaction=String(q.interactionType||q.type||'').toLowerCase();
  if(interaction==='true_false'){
    const truth=typeof q.answer==='boolean'?q.answer:['true','t','yes','1','benar'].includes(norm(q.answer));
    return Boolean(selected)===truth;
  }
  if(interaction==='numeric'){
    const a=Number(selected),b=Number(q.answer);
    if(Number.isFinite(a)&&Number.isFinite(b)){
      return Math.abs(a-b)<=Math.max(0,Number(q.tolerance||0));
    }
  }
  if(interaction==='direct_recall'){
    const accepted=[q.answer,...(q.acceptedAnswers||[])].map(norm);
    return accepted.includes(norm(selected));
  }
  return norm(selected)===norm(q.answer);
}

function dev2RecordQuestionFeedback(q,attemptId){
  const flags=[...DEV2_QUALITY_FLAGS];
  if(!DEV2_COMMENT_DRAFT.trim()&&!flags.length)return;
  DATA.questionFeedback.push({
    id:makeUid('feedback'),
    questionUid:q.uid,
    attemptId,
    subjectId:q.subjectId,
    conceptIds:q.conceptIds?.length?q.conceptIds:[q.primaryConceptId],
    createdAt:new Date().toISOString(),
    comment:DEV2_COMMENT_DRAFT.trim(),
    qualityFlags:flags
  });
  DATA.questionFeedback=DATA.questionFeedback.slice(-10000);
}

function answerStreamDev2(selected){
  const q=dev2GetPick();
  if(!q||streamFeedback)return;

  const correct=dev2CorrectFor(q,selected);
  const now=new Date().toISOString();
  const attemptId=makeUid('stream');
  const b=DATA.streamEngine.burst||{};
  if(!b.id)b.id=makeUid('burst');
  if(!b.startedAt)b.startedAt=now;

  DATA.streamEngine.questionSeen[q.uid]=(DATA.streamEngine.questionSeen[q.uid]||0)+1;
  DATA.streamEngine.recentConceptIds=[q.primaryConceptId,...(DATA.streamEngine.recentConceptIds||[])].filter(Boolean).slice(0,8);
  DATA.streamEngine.recentSubjectIds=[q.subjectId,...(DATA.streamEngine.recentSubjectIds||[])].filter(Boolean).slice(0,12);

  const attempt={
    id:attemptId,
    burstId:b.id,
    burstStartedAt:b.startedAt,
    questionUid:q.uid,
    collectionId:q.collectionId||null,
    subjectId:q.subjectId,
    conceptIds:q.conceptIds?.length?q.conceptIds:[q.primaryConceptId],
    primaryConceptId:q.primaryConceptId,
    answeredAt:now,
    selected,
    correct,
    confidence:'sure',
    mode:'stream',
    testType:'stream',
    difficulty:q.difficulty||'',
    sourceType:q.sourceType||'bank',
    targetDifficulty:(DATA.subjectRegistry||[]).find(s=>s.id===q.subjectId)?.targetDifficulty||'adaptive',
    comment:DEV2_COMMENT_DRAFT.trim(),
    qualityFlags:[...DEV2_QUALITY_FLAGS],
    elapsed:Math.max(0,(Date.now()-DEV2_QUESTION_SHOWN_AT)/1000),
    schedulerSnapshot:{
      algorithmVersion:DATA.schedulerConfig.algorithmVersion,
      finalScore:Math.round(q.schedulerBreakdown?.finalScore||q.priorityScore||0),
      breakdown:q.schedulerBreakdown||null
    }
  };

  DATA.streamEngine.attempts.push(attempt);
  DATA.streamEngine.attempts=DATA.streamEngine.attempts.slice(-7500);
  dev2RecordQuestionFeedback(q,attemptId);

  b.count=(b.count||0)+1;
  b.correct=(b.correct||0)+(correct?1:0);
  DATA.streamEngine.burst=b;

  streamFeedback={card:q,correct,selected};

  DEV2_COMMENT_DRAFT='';
  DEV2_QUALITY_FLAGS=new Set();
  DEV2_STREAM_MENU=false;
  DEV2_STREAM_WHY=false;
  DEV2_PICK_CACHE=null;
  clearEngineCache();
  save();

  /* compute the next question during the tiny feedback flash */
  DEV2_NEXT_PICK=schedulerPickDev2();
  render();

  const delay=correct?150:900;
  setTimeout(()=>{
    if(!streamFeedback?.card||streamFeedback.card.uid!==q.uid)return;
    streamFeedback=null;
    DEV2_PICK_CACHE=DEV2_NEXT_PICK;
    DEV2_NEXT_PICK=null;
    if(DEV2_PICK_CACHE){
      DEV2_QUESTION_SHOWN_AT=Date.now();
      DEV2_LAST_PICK_UID=DEV2_PICK_CACHE.uid;
    }
    render();
  },delay);
}

function submitStreamInputDev2(){
  const el=document.getElementById('dev2-stream-input');
  if(!el)return;
  answerStreamDev2(el.value);
}

function toggleStreamMenuDev2(){
  DEV2_STREAM_MENU=!DEV2_STREAM_MENU;
  if(!DEV2_STREAM_MENU)DEV2_STREAM_WHY=false;
  render();
}

function toggleStreamWhyDev2(){DEV2_STREAM_WHY=!DEV2_STREAM_WHY;render()}
function setStreamCommentDev2(v){DEV2_COMMENT_DRAFT=String(v||'')}
function toggleQualityDev2(flag){
  if(DEV2_QUALITY_FLAGS.has(flag))DEV2_QUALITY_FLAGS.delete(flag);
  else{
    if(flag==='good')DEV2_QUALITY_FLAGS=new Set(['good']);
    else{DEV2_QUALITY_FLAGS.delete('good');DEV2_QUALITY_FLAGS.add(flag)}
  }
  render();
}

function nextAfterWrongDev2(){
  if(!streamFeedback)return;
  streamFeedback=null;
  DEV2_PICK_CACHE=DEV2_NEXT_PICK||schedulerPickDev2();
  DEV2_NEXT_PICK=null;
  if(DEV2_PICK_CACHE)DEV2_QUESTION_SHOWN_AT=Date.now();
  render();
}

function resetBurst(){
  DATA.streamEngine.burst={
    id:makeUid('burst'),
    count:0,correct:0,
    startedAt:new Date().toISOString()
  };
  streamDismissed=false;
  DEV2_FORCE_SUBJECT=null;
  streamFeedback=null;
  DEV2_PICK_CACHE=null;
  DEV2_NEXT_PICK=null;
  save();
  render();
}

function startSubjectBurstDev2(subjectId){
  DEV2_FORCE_SUBJECT=subjectId;
  DATA.streamEngine.burst={id:makeUid('burst'),count:0,correct:0,startedAt:new Date().toISOString()};
  streamFeedback=null;DEV2_PICK_CACHE=null;DEV2_NEXT_PICK=null;
  save();route('home');
}

/* ---------- Native Stream UI ---------- */

function progressDotsDev2(count,size){
  return `<div class="dev2-progress">${Array.from({length:size},(_,i)=>`<i class="${i<count?'done':''}"></i>`).join('')}</div>`;
}

function streamAnswerControlsDev2(q){
  const interaction=String(q.interactionType||q.type||'').toLowerCase();

  if(interaction==='true_false'){
    return `<div class="dev2-choices dev2-binary">
      <button class="dev2-choice" onclick="answerStreamDev2(true)">TRUE</button>
      <button class="dev2-choice" onclick="answerStreamDev2(false)">FALSE</button>
    </div>`;
  }

  if(q.choices&&typeof q.choices==='object'){
    const entries=Object.entries(q.choices);
    return `<div class="dev2-choices ${entries.length===2?'dev2-binary':''}">
      ${entries.map(([k,v])=>`<button class="dev2-choice ${entries.length===3?'wide':''}" onclick='answerStreamDev2(${JSON.stringify(k)})'><b>${esc(k)}</b>${esc(v)}</button>`).join('')}
    </div>`;
  }

  return `<div class="dev2-input-row">
    <input id="dev2-stream-input" inputmode="${interaction==='numeric'?'decimal':'text'}" autocomplete="off" placeholder="${interaction==='numeric'?'Answer':'Short answer'}" onkeydown="if(event.key==='Enter')submitStreamInputDev2()">
    <button class="button primary" onclick="submitStreamInputDev2()">CHECK</button>
  </div>`;
}

function schedulerBreakdownDev2(q){
  const b=q?.schedulerBreakdown;
  if(!b)return'';
  const rows=[...(b.subjectParts||[]),...(b.conceptParts||[]),...(b.questionParts||[])];
  return `<div class="dev2-why">
    ${rows.map(r=>`<div class="dev2-why-row"><span>${esc(r.label)}</span><strong>${Number(r.value)>=0?'+':''}${Math.round(Number(r.value)||0)}</strong></div>`).join('')}
    <div class="dev2-why-row"><span>Final priority</span><strong>${Math.round(b.finalScore||0)}</strong></div>
  </div>`;
}

function streamMenuDev2(q){
  if(!DEV2_STREAM_MENU)return'';
  return `<div class="dev2-stream-menu">
    <div class="dev2-quick-flags">
      ${DEV2_QUALITY_OPTIONS.map(([id,label])=>`<button class="dev2-quick-flag ${DEV2_QUALITY_FLAGS.has(id)?'active':''}" onclick="toggleQualityDev2('${id}')">${esc(label)}</button>`).join('')}
      <button class="dev2-quick-flag ${DEV2_STREAM_WHY?'active':''}" onclick="toggleStreamWhyDev2()">Why this?</button>
    </div>
    <textarea oninput="setStreamCommentDev2(this.value)" placeholder="Optional note about wording, usefulness, concept match…">${esc(DEV2_COMMENT_DRAFT)}</textarea>
    ${DEV2_STREAM_WHY?schedulerBreakdownDev2(q):''}
  </div>`;
}

function streamHome(){
  const b=DATA.streamEngine?.burst||{count:0,correct:0};
  const size=Math.max(1,Number(DATA.scheduler?.burstSize)||5);

  if((b.count||0)>=size&&!streamFeedback){
    return `<div class="dev2-stream-shell">
      <div class="dev2-stream-top"><strong>Stream</strong><span class="spacer"></span>${progressDotsDev2(size,size)}</div>
      <div class="dev2-burst-done">
        <div>
          <div class="score">${b.correct||0}/${b.count||0}</div>
          <p>Burst complete. Evidence is already saved.</p>
          <div class="dev2-burst-actions">
            <button class="button" onclick="streamDismissed=true;render()">DONE</button>
            <button class="button primary" onclick="resetBurst()">5 MORE</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  if(streamDismissed){
    return `<div class="dev2-stream-shell"><div class="dev2-empty"><div>
      <strong>Stream ready.</strong>
      <p>One tap puts you back into a fresh five-question Burst.</p>
      <button class="button primary" onclick="resetBurst()">START</button>
    </div></div></div>`;
  }

  if(streamFeedback?.card){
    const q=streamFeedback.card;
    const answerText=q.choices?.[q.answer]??(typeof q.answer==='boolean'?(q.answer?'True':'False'):q.answer);
    return `<div class="dev2-stream-shell">
      <div class="dev2-stream-top"><strong>Stream</strong><span class="subject">${esc(q.subjectName||'')}</span><span class="spacer"></span>${progressDotsDev2(b.count||0,size)}</div>
      <div class="dev2-feedback ${streamFeedback.correct?'good':'bad'}">
        <div>
          <strong>${streamFeedback.correct?'✓':'×'}</strong>
          ${streamFeedback.correct?'':`<p>${esc(String(answerText??''))}${q.explanation?` — ${esc(q.explanation)}`:''}</p>`}
          <small>${streamFeedback.correct?'Next…':'Next automatically, or continue now.'}</small>
          ${streamFeedback.correct?'':`<button class="button tiny dev2-next-button" onclick="nextAfterWrongDev2()">NEXT</button>`}
        </div>
      </div>
    </div>`;
  }

  const q=dev2GetPick();
  if(!q){
    return `<div class="dev2-stream-shell"><div class="dev2-empty"><div>
      <strong>No active Stream inventory.</strong>
      <p>History is safe. Activate/import a Bank Collection or enable a subject with eligible historical questions.</p>
      <button class="button primary" onclick="route('subjects')">SUBJECTS</button>
    </div></div></div>`;
  }

  const concept=displayConceptNameDev2(q);
  return `<div class="dev2-stream-shell">
    <div class="dev2-stream-top">
      <strong>Stream</strong>
      <span class="subject">${esc(q.subjectName||q.subject||'')}</span>
      <span class="spacer"></span>
      ${progressDotsDev2(b.count||0,size)}
    </div>
    <div class="dev2-stream-body">
      <div class="dev2-concept">${concept?esc(concept):' '}</div>
      <div class="dev2-question">${esc(q.prompt)}</div>
      ${streamAnswerControlsDev2(q)}
    </div>
    <div class="dev2-stream-foot">
      <button class="dev2-foot-button" onclick="toggleStreamMenuDev2()">•••</button>
      <span class="spacer"></span>
      <button class="dev2-foot-button dev2-session-shortcut" onclick="route('subjects')">SESSION</button>
    </div>
    ${streamMenuDev2(q)}
  </div>`;
}

function home(){
  return `<section class="dev2-home">${streamHome()}</section>`;
}

/* ---------- Auto Session from active collections ---------- */

function bankQuestionToSessionQuestionDev2(q,index){
  if(q.choices&&typeof q.choices==='object'){
    return normalizeQuestion({
      id:`auto_${index+1}_${String(q.id||q.uid||index).replace(/[^a-zA-Z0-9_-]/g,'')}`,
      uid:q.uid||q.id,
      type:'mcq',
      prompt:q.prompt||'',
      choices:q.choices,
      answer:q.answer,
      explanation:q.explanation||'',
      tags:(q.conceptIds||[]).map(id=>displayConceptNameDev2({...q,primaryConceptId:id})||id),
      difficulty:q.difficulty||'medium',
      paper_required:false
    },index);
  }

  if(String(q.interactionType||q.type)==='true_false'){
    const truth=typeof q.answer==='boolean'?q.answer:['true','t','yes','1','benar'].includes(norm(q.answer));
    return normalizeQuestion({
      id:`auto_${index+1}_${String(q.id||q.uid||index).replace(/[^a-zA-Z0-9_-]/g,'')}`,
      uid:q.uid||q.id,type:'mcq',prompt:q.prompt||'',
      choices:{A:'True',B:'False'},answer:truth?'A':'B',
      explanation:q.explanation||'',tags:q.conceptIds||[],difficulty:q.difficulty||'medium',
      paper_required:false
    },index);
  }

  return normalizeQuestion({
    id:`auto_${index+1}_${String(q.id||q.uid||index).replace(/[^a-zA-Z0-9_-]/g,'')}`,
    uid:q.uid||q.id,
    type:String(q.interactionType||q.type)==='numeric'?'numeric':'short',
    prompt:q.prompt||'',answer:q.answer,
    accepted_answers:q.acceptedAnswers||[],
    tolerance:q.tolerance||0,explanation:q.explanation||'',
    tags:q.conceptIds||[],difficulty:q.difficulty||'medium',paper_required:false
  },index);
}

function recommendedAutoTypeDev2(subjectId){
  let ev=[];try{ev=conceptEvidenceV3(subjectId)}catch(e){}
  if(ev.some(e=>e.state==='weak'&&e.seen>=2))return'repair';
  if(ev.some(e=>daysSince099(e.lastSeenAt)!==null&&daysSince099(e.lastSeenAt)>DATA.schedulerConfig.thresholds.dueDays))return'due';
  return'mixed';
}

function composeAutoSessionDev2(subjectId,type='repair',count=15){
  const s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  if(!s)throw new Error('Subject not found.');
  const bank=activeBankQuestionsDev2(subjectId);
  if(!bank.length)throw new Error('No active Bank Collection has usable questions.');

  const scored=bank.map(q=>({q,...scoreBankForAutoSession099(q,s,type)})).sort((a,b)=>b.score-a.score);
  const picked=[];const conceptCounts=new Map();const maxPer=5;
  for(const row of scored){
    if(picked.length>=count)break;
    const n=conceptCounts.get(row.conceptId)||0;
    if(n>=maxPer)continue;
    picked.push(row);conceptCounts.set(row.conceptId,n+1);
  }
  if(picked.length<count){
    const used=new Set(picked.map(x=>x.q.uid));
    for(const row of scored){if(picked.length>=count)break;if(!used.has(row.q.uid)){picked.push(row);used.add(row.q.uid)}}
  }

  const questions=picked.map((x,i)=>bankQuestionToSessionQuestionDev2(x.q,i)).filter(Boolean);
  if(!questions.length)throw new Error('No active Bank question can be rendered as a Session.');

  const labelMap={repair:'Auto Repair',due:'Due Review',mastery:'Mastery Check',mixed:'Smart Mixed'};
  const testType=type==='repair'?'repair':type==='mastery'?'mastery':'focused';
  return{
    packet:ensurePacketIdentity({
      packetUid:makeUid('auto-packet'),
      dbdVersion:APP_VERSION,campaign:'Auto Session',subject:s.name,
      topic:`${labelMap[type]||'Auto Session'} · ${questions.length} questions`,
      source:'DBD active Bank Collections · Schema 7',
      testType,workingStyle:'concept',answerFormat:'mixed',
      difficulty:s.targetDifficulty||'Adaptive',questions
    }),
    composer:{
      generated:true,composerVersion:'0.9.9-dev2',
      composerType:type,createdAt:new Date().toISOString(),subjectId,
      sourceQuestionUids:picked.map(x=>x.q.uid)
    },
    setupSnapshot:{
      ...DATA.setup,testType,workingStyle:'concept',answerFormat:'mixed',
      feedback:type==='mastery'?'end':'immediate',timing:'off',showTimer:false,
      difficulty:s.targetDifficulty||'Adaptive'
    }
  };
}

function startRecommendedAutoSessionDev2(subjectId){
  try{
    const type=recommendedAutoTypeDev2(subjectId);
    const composed=composeAutoSessionDev2(subjectId,type,15);
    const id=makeUid('auto-session');
    DATA.activeSessions.push({
      id,packet:composed.packet,setupSnapshot:composed.setupSnapshot,
      responses:composed.packet.questions.map(()=>newResponse()),
      currentIndex:0,startedAt:Date.now(),lastOpenedAt:Date.now(),
      liveStartedAt:null,paused:false,retryKind:null,autoSession:composed.composer
    });
    DATA.currentActiveId=id;
    save();route('drill');
  }catch(e){alert(e.message||'Auto Session could not start.')}
}

/* ---------- Subjects: action-first ---------- */

function weakConceptsDev2(subjectId){
  let ev=[];try{ev=conceptEvidenceV3(subjectId)}catch(e){}
  return ev.filter(e=>e.state==='weak'||e.state==='shaky')
    .sort((a,b)=>(b.wrong||0)-(a.wrong||0)).slice(0,4);
}

function subjectCountsDev2(subjectId){
  const cols=collectionsForSubjectDev2(subjectId);
  return{
    activeQuestions:activeBankQuestionsDev2(subjectId).length,
    activeCollections:cols.filter(c=>c.status==='active').length,
    retiredQuestions:cols.filter(c=>c.status==='retired').reduce((n,c)=>n+collectionQuestionCountDev2(c.id),0),
    collections:cols.length,
    history:canonicalSessions(subjectId).reduce((n,s)=>n+(s.attempts||[]).length,0)
  };
}

function subjectsView(){
  if(selectedSubjectId)return subjectDetailView(selectedSubjectId);
  ensureSubjectRegistry(DATA);
  ensureSubjectManifestsDev2(DATA);

  const rows=(DATA.subjectRegistry||[]).map(normalizeStreamPolicyRecord).sort((a,b)=>{
    if((a.active!==false)!==(b.active!==false))return a.active===false?1:-1;
    return String(a.name).localeCompare(String(b.name));
  });

  return `<section class="dev2-page">
    <div class="dev2-page-head">
      <div><div class="eyebrow">Action first</div><h1>Subjects</h1><p>History stays. Inventory and priorities can change.</p></div>
      <button class="button tiny" onclick="importKnowledgeFile()">IMPORT</button>
    </div>
    <div class="dev2-subject-list">
      ${rows.map(s=>{
        const counts=subjectCountsDev2(s.id),weak=weakConceptsDev2(s.id),alerts=currentAlerts099().filter(a=>String(a.id).includes(s.id)).length;
        return `<button class="dev2-subject-card" onclick="openSubject('${s.id}')">
          <div><h3>${esc(s.name)}${alerts?'<span class="dev2-attention-dot"></span>':''}</h3>
          <p>${s.active!==false?'Stream active':'Muted'} · ${counts.activeQuestions} active Bank Q · ${counts.history} historical answers${weak.length?` · ${weak.length} weak/shaky`:''}</p></div>
          <div class="right"><strong>${counts.activeQuestions}</strong><small>ACTIVE Q</small></div>
        </button>`;
      }).join('')||'<div class="empty">No subjects yet.</div>'}
    </div>
  </section>`;
}

function bankCollectionsHtmlDev2(subjectId){
  const rows=collectionsForSubjectDev2(subjectId);
  if(!rows.length)return `<div class="dev2-bank-row"><div><strong>No Bank Collections</strong><small>Generate or import one when this subject needs reusable Stream inventory.</small></div></div>`;
  return rows.map(c=>{
    const n=collectionQuestionCountDev2(c.id);
    const status=c.status||'active';
    return `<div class="dev2-bank-row">
      <div>
        <strong>${esc(c.name)}</strong>
        <small>${n} questions · doctrine ${esc(c.doctrineVersion||'legacy')}${c.retirementReason?` · ${esc(c.retirementReason)}`:''}</small>
        <span class="dev2-collection-status ${status}">${esc(status)}</span>
      </div>
      <div class="dev2-bank-actions">
        ${status==='active'?`
          <button class="dev2-mini-button" onclick="event.stopPropagation();setCollectionStatusDev2('${c.id}','paused')">PAUSE</button>
          <button class="dev2-mini-button retire" onclick="event.stopPropagation();retireCollectionDev2('${c.id}')">RETIRE</button>`
        :status==='paused'?`
          <button class="dev2-mini-button activate" onclick="event.stopPropagation();restoreCollectionDev2('${c.id}')">ACTIVATE</button>
          <button class="dev2-mini-button retire" onclick="event.stopPropagation();retireCollectionDev2('${c.id}')">RETIRE</button>`
        :status==='retired'?`
          <button class="dev2-mini-button activate" onclick="event.stopPropagation();restoreCollectionDev2('${c.id}')">RESTORE</button>`
        :`<button class="dev2-mini-button" onclick="event.stopPropagation();alert('${esc(c.quarantineReason||'Fix the package/manifest mismatch, then re-import or activate manually.')}')">WHY?</button>`}
      </div>
    </div>`;
  }).join('');
}

function subjectDetailView(subjectId){
  const s=(DATA.subjectRegistry||[]).find(x=>x.id===subjectId);
  if(!s){selectedSubjectId=null;return subjectsView()}

  const counts=subjectCountsDev2(subjectId);
  const weak=weakConceptsDev2(subjectId);
  const sm=subjectManifestDev2(subjectId);
  const autoType=recommendedAutoTypeDev2(subjectId);

  return `<section class="dev2-page">
    <button class="back-link" onclick="closeSubject()">← Subjects</button>

    <div class="dev2-subject-hero">
      <div class="eyebrow">${s.active!==false?'STREAM ACTIVE':'MUTED'}</div>
      <h1 style="margin:4px 0 0">${esc(s.name)}</h1>
      <div class="dev2-statline">
        <span><strong>${counts.activeQuestions}</strong> active Bank Q</span>
        <span><strong>${counts.retiredQuestions}</strong> retired</span>
        <span><strong>${counts.history}</strong> historical answers</span>
      </div>

      <div class="dev2-actions-primary">
        <button class="button primary" onclick="startSubjectBurstDev2('${s.id}')">QUICK DRILL</button>
        <button class="button" onclick="startRecommendedAutoSessionDev2('${s.id}')">AUTO ${autoType.toUpperCase()}</button>
      </div>
      <div class="dev2-actions-secondary">
        <button class="button tiny" onclick="deliverGenerationRequestDev2('${s.id}',this)">GENERATION REQUEST</button>
        <button class="button tiny" onclick="importKnowledgeFile()">IMPORT PACKAGE</button>
      </div>
      <div class="dev2-prompt-note">Short requests copy to clipboard. Long requests automatically download as .md.</div>
    </div>

    <div class="dev2-section">
      <div class="dev2-section-title"><span>Needs attention</span><span>${weak.length}</span></div>
      ${weak.length?weak.map(e=>`<div class="dev2-attention-row"><div><strong>${esc(e.concept.name)}</strong><small>${e.correct}/${e.seen} correct · ${e.questionVariety||0} variants</small></div><span class="dev2-state ${e.state}">${e.state}</span></div>`).join(''):`<div class="dev2-attention-row"><div><strong>No strong repair signal yet</strong><small>DBD will surface one as evidence accumulates.</small></div></div>`}
    </div>

    <div class="dev2-section">
      <div class="dev2-section-title"><span>Bank Collections</span><span>${counts.collections}</span></div>
      ${bankCollectionsHtmlDev2(subjectId)}
    </div>

    <div class="dev2-section">
      <details class="dev2-advanced">
        <summary>Advanced / ontology / Stream policy</summary>
        <div class="dev2-advanced-body">
          <div class="dev2-policy-line"><span>Subject Manifest</span><strong>${sm?.status==='canonical'?`canonical r${sm.revision}`:'provisional'}</strong></div>
          <div class="dev2-policy-line"><span>Stream status</span><button class="dev2-mini-button" onclick="toggleSubjectActive('${s.id}')">${s.active!==false?'MUTE':'ACTIVATE'}</button></div>
          <div class="dev2-policy-line"><span>Stream weight</span><select onchange="setSubjectStreamWeight('${s.id}',this.value)">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(s.streamWeight)===n?'selected':''}>${n}×</option>`).join('')}</select></div>
          <div class="dev2-policy-line"><span>Difficulty target</span><select onchange="setSubjectDifficulty('${s.id}',this.value)">${['adaptive','easy','medium','hard'].map(x=>`<option value="${x}" ${s.targetDifficulty===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="dev2-actions-secondary">
            <button class="button tiny" onclick="downloadDoctrineDev2(this)">DOWNLOAD DOCTRINE</button>
            <button class="button tiny" onclick="copySubjectDiagnostics('${s.id}',this)">COPY DIAGNOSTICS</button>
          </div>
          ${sm?.status==='canonical'?conceptTreeHtml(subjectId):'<div class="provisional-note" style="margin-top:9px">No authoritative concept ontology yet. The next Generation Protocol package can establish one; provisional backend labels are intentionally hidden from the everyday Stream UI.</div>'}
        </div>
      </details>
    </div>
  </section>`;
}

/* ---------- History = Sessions + Stream Bursts ---------- */

function burstEventsDev2(){
  const attempts=(DATA.streamEngine?.attempts||[]).slice().sort((a,b)=>new Date(a.answeredAt)-new Date(b.answeredAt));
  const groups=[];const byId=new Map();let fallback=null;

  for(const a of attempts){
    let key=a.burstId;
    if(!key){
      const t=new Date(a.answeredAt||0).getTime();
      if(!fallback||fallback.items.length>=5||t-fallback.last>12*60*1000){
        fallback={id:`legacy_burst_${groups.length+1}`,items:[],last:t};
        groups.push(fallback);byId.set(fallback.id,fallback);
      }
      fallback.items.push(a);fallback.last=t;
      continue;
    }
    let g=byId.get(key);
    if(!g){g={id:key,items:[],last:0};groups.push(g);byId.set(key,g)}
    g.items.push(a);g.last=new Date(a.answeredAt||0).getTime();
  }

  return groups.filter(g=>g.items.length).map(g=>{
    const first=g.items[0],last=g.items[g.items.length-1];
    const ids=[...new Set(g.items.map(a=>a.subjectId).filter(Boolean))];
    const names=ids.map(id=>(DATA.subjectRegistry||[]).find(s=>s.id===id)?.name||id);
    return{
      id:g.id,type:'stream',
      completedAt:last.answeredAt||first.answeredAt,
      startedAt:first.burstStartedAt||first.answeredAt,
      subject:names.length===1?names[0]:'Mixed Stream',
      subjectIds:ids,
      count:g.items.length,
      correct:g.items.filter(a=>a.correct).length,
      totalTime:g.items.reduce((n,a)=>n+(Number(a.elapsed)||0),0),
      items:g.items
    };
  });
}

function history(){
  const streamEvents=burstEventsDev2();
  const sessionEvents=(DATA.completedSessions||[]).map(s=>({type:'session',completedAt:s.completedAt,session:s}));
  const events=[...streamEvents,...sessionEvents].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));

  let lastDay='',body='';
  for(const e of events){
    const day=historyDateLabel(e.completedAt);
    if(day!==lastDay){body+=`<div class="dev2-history-date">${esc(day)}</div>`;lastDay=day}

    if(e.type==='stream'){
      body+=`<div class="dev2-section" style="margin-top:6px">
        <div class="dev2-history-row">
          <div><strong>${esc(e.subject)} · Stream Burst</strong><small>${e.count} retrievals · ${fmt(e.totalTime)}</small></div>
          <div class="dev2-history-score"><strong>${e.correct}/${e.count}</strong><small>STREAM</small></div>
        </div>
      </div>`;
    }else{
      const s=e.session,total=s.totalQuestions||s.answered||1;
      body+=`<div class="dev2-section" style="margin-top:6px">
        <div class="dev2-history-row session" onclick="viewSession('${s.id}')">
          <div><strong>${esc(s.subject)} · ${esc(s.topic||'Session')}</strong><small>${esc(sessionTestType(s))} · ${fmt(s.totalTime)}</small></div>
          <div class="dev2-history-score"><strong>${s.correct}/${total}</strong><small>SESSION</small></div>
        </div>
      </div>`;
    }
  }

  return `<section class="dev2-page">
    <div class="dev2-page-head"><div><div class="eyebrow">Learning events</div><h1>History</h1><p>Stream is grouped into Bursts. Individual attempts remain in the Vault.</p></div></div>
    ${body||'<div class="empty">No learning history yet.</div>'}
  </section>`;
}

/* ---------- Cleaner navigation / settings ---------- */

function renderNav(){
  const nav=document.getElementById('navigation');
  if(view==='drill'){nav.innerHTML='';return}
  const items=[['home','Drill'],['subjects','Subjects'],['history','History']];
  nav.innerHTML=items.map(([id,l])=>`<button class="${view===id?'active':''}" onclick="route('${id}')">${l}</button>`).join('')+
    `<button class="nav-gear-dev2 ${view==='data'?'active':''}" onclick="route('data')" aria-label="Settings">⚙</button>`;
}

function dataView(){
  const bytes=new Blob([JSON.stringify(DATA)]).size;
  const size=bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`;
  const activeCols=(DATA.bankCollections||[]).filter(c=>c.status==='active').length;
  const retiredCols=(DATA.bankCollections||[]).filter(c=>c.status==='retired').length;
  const canonical=(DATA.subjectManifests||[]).filter(m=>m.status==='canonical').length;

  return `<section class="dev2-page">
    <div class="dev2-page-head"><div><div class="eyebrow">${APP_VERSION} · ${BUILD_ID}</div><h1>Settings</h1><p>Engineering controls live here, not on the Drill screen.</p></div></div>

    <div class="settings-group">
      <div class="settings-title">Learning engine</div>
      <div class="metric-row"><span>Data schema</span><strong>7</strong></div>
      <div class="metric-row"><span>Scheduler</span><strong>${esc(DATA.schedulerConfig.algorithmVersion)}</strong></div>
      <div class="metric-row"><span>Canonical Subject Manifests</span><strong>${canonical}</strong></div>
      <div class="metric-row"><span>Active / retired Bank Collections</span><strong>${activeCols} / ${retiredCols}</strong></div>
      <div class="metric-row"><span>Question Bank records</span><strong>${(DATA.questionBank||[]).length}</strong></div>
      <div class="metric-row"><span>Stream attempts</span><strong>${(DATA.streamEngine?.attempts||[]).length}</strong></div>
      <button class="button small" onclick="downloadDoctrineDev2(this)">DOWNLOAD GENERATION PROTOCOL .MD</button>
    </div>

    <div class="settings-group">
      <div class="settings-title">Stream mix</div>
      ${streamDietPanel()}
    </div>

    <div class="settings-group">
      <div class="settings-title">DBD Vault</div>
      <p class="note">Schema 7 preserves Sessions and individual Stream attempts while adding Subject Manifests and Bank Collection lifecycle state.</p>
      <div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div>
      <details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details>
    </div>

    <div class="settings-group">
      <div class="settings-title">Storage</div>
      <div class="metric-row"><span>Local key</span><strong>dbd_gazali</strong></div>
      <div class="metric-row"><span>Approx. size</span><strong>${size}</strong></div>
      <div class="metric-row"><span>Completed Sessions</span><strong>${DATA.completedSessions.length}</strong></div>
    </div>

    <div class="settings-group danger-zone">
      <div class="settings-title">Danger zone</div>
      <div class="settings-row"><div><strong>Reset all DBD data</strong><small>Permanent local deletion. Retiring a Bank Collection is the normal non-destructive way to stop using questions.</small></div><button class="button danger small" onclick="resetData()">RESET</button></div>
    </div>
  </section>`;
}

/* ---------- Vault merge / replacement: include Schema-7 entities ---------- */

function mergeByUidDev2(a,b,key='id'){
  const m=new Map();
  for(const x of [...(a||[]),...(b||[])])if(x?.[key])m.set(String(x[key]),x);
  return [...m.values()];
}

function mergeVaultData(incoming){
  const d=normalizeFutureData({
    ...incoming,
    setup:migrateSetup(incoming.setup),
    completedSessions:Array.isArray(incoming.completedSessions)?incoming.completedSessions:[],
    activeSessions:Array.isArray(incoming.activeSessions)?incoming.activeSessions:[],
    settings:{...DATA.settings,...(incoming.settings||{}),deviceId:DATA.settings.deviceId}
  });

  DATA.completedSessions=mergeById(DATA.completedSessions,d.completedSessions);
  DATA.activeSessions=mergeById(DATA.activeSessions,d.activeSessions);
  DATA.subjectRegistry=mergeRegistry(DATA.subjectRegistry,d.subjectRegistry);
  DATA.questionBank=mergeByUidDev2(DATA.questionBank,d.questionBank,'uid');
  DATA.bankCollections=mergeByUidDev2(DATA.bankCollections,d.bankCollections,'id');

  const smMap=new Map((DATA.subjectManifests||[]).map(m=>[m.subjectId,m]));
  for(const sm of d.subjectManifests||[]){
    const old=smMap.get(sm.subjectId);
    if(!old||Number(sm.revision||0)>=Number(old.revision||0))smMap.set(sm.subjectId,sm);
  }
  DATA.subjectManifests=[...smMap.values()];

  const attempts=mergeByUidDev2(DATA.streamEngine?.attempts,d.streamEngine?.attempts,'id');
  DATA.streamEngine={...DATA.streamEngine,attempts,questionSeen:{...(DATA.streamEngine?.questionSeen||{})}};
  for(const [k,v] of Object.entries(d.streamEngine?.questionSeen||{})){
    DATA.streamEngine.questionSeen[k]=Math.max(DATA.streamEngine.questionSeen[k]||0,Number(v)||0);
  }

  DATA.questionFeedback=mergeByUidDev2(DATA.questionFeedback,d.questionFeedback,'id');

  const dismissed={...(DATA.alertState?.dismissedUntil||{})};
  for(const [k,v] of Object.entries(d.alertState?.dismissedUntil||{})){
    if(new Date(v||0)>new Date(dismissed[k]||0))dismissed[k]=v;
  }
  DATA.alertState={dismissedUntil:dismissed};

  DATA.vault.lastMergedAt=new Date().toISOString();
  recomputeStatistics(DATA);
  normalizeSchema7Dev2(DATA);
  clearEngineCache();DEV2_PICK_CACHE=null;
  save();
}

function importBackup(){
  const i=document.createElement('input');i.type='file';i.accept='.json,.dbd,application/json';
  i.onchange=async()=>{
    try{
      const raw=JSON.parse(await i.files[0].text());
      const p=raw?.format==='dbd-vault'?raw.data:raw;
      if(!p||!Array.isArray(p.completedSessions))throw new Error('Invalid DBD backup.');
      const device=DATA.settings.deviceId;
      DATA=normalizeFutureData({
        ...p,
        appVersion:APP_VERSION,
        setup:migrateSetup(p.setup),
        completedSessions:p.completedSessions,
        activeSessions:Array.isArray(p.activeSessions)?p.activeSessions:[],
        subjectRegistry:Array.isArray(p.subjectRegistry)?p.subjectRegistry:[],
        subjectManifests:Array.isArray(p.subjectManifests)?p.subjectManifests:[],
        conceptManifests:Array.isArray(p.conceptManifests)?p.conceptManifests:[],
        bankCollections:Array.isArray(p.bankCollections)?p.bankCollections:[],
        questionBank:Array.isArray(p.questionBank)?p.questionBank:[],
        questionFeedback:Array.isArray(p.questionFeedback)?p.questionFeedback:[],
        streamEngine:p.streamEngine||{},
        settings:{...(p.settings||{}),deviceId:device}
      });
      recomputeStatistics(DATA);save();
      alert('Backup restored and migrated to Schema 7. Historical Sessions/attempts were preserved from the backup.');
      route('home');
    }catch(e){alert(e.message||'Import failed.')}
  };
  i.click();
}

/* ---------- Boot ---------- */

function boot099dev2(){
  try{
    DATA=normalizeFutureData(DATA);
    r2RepairBank();
    save();
    clearEngineCache();
    DEV2_PICK_CACHE=null;
    render();
    console.info(`DBD ${APP_VERSION} · ${BUILD_ID} · Schema ${DATA.schemaVersion}`);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD dev2 boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD could not finish Schema 7 startup.</h2><p>Your browser data remains under <strong>dbd_gazali</strong>.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}
/* ================= END DBD v0.9.9-dev2 ================= */


/* =====================================================================
   DBD Base v1.0 — finished lightweight branch

   Constitutional rule:
   JSON packet in -> drill -> history.

   Schema 7-era Bank/scheduler data remains preserved in the Vault but is
   intentionally dormant and invisible to normal Lite operation.
   ===================================================================== */

const LITE_SCHEMA_LABEL='Schema 7 Base';
const LITE_PROMPT_COPY_LIMIT=18000;

function liteDownload(name,text,type='text/markdown'){
  download(name,text,type);
}

function litePrompt(subjectName=''){
  const subjectLine=subjectName?`TARGET SUBJECT: ${subjectName}`:'TARGET SUBJECT: infer the subject from this chat';
  return `# DBD Base v1.0 — Drill Packet Request

DBD Base is deliberately simple: ChatGPT prepares trustworthy JSON drill material; DBD serves it and records what happened. There is no smart maintenance scheduler deciding what I should learn.

${subjectLine}

Before generating anything, inspect the files, lesson history, prior explanations, current mistakes, and assessment context available in THIS subject chat.

Do not generate JSON immediately. First ask me ONE compact setup question that lets me choose or confirm:
- material scope;
- test type: Coverage Scan, Focused Drill, Deep Practice, Repair Drill, Mastery Check, or Exam Simulation;
- No pen/paper conceptual work or Full problem solving;
- Multiple choice only or Mixed;
- number of questions;
- Easy, Medium, Difficult, or Adaptive;
- Immediate feedback or After session;
- timing: Off, Record only, or AI-set;
- optional extra focus.

Recommend sensible defaults from the evidence in this chat, but wait for my choices.

## Educational doctrine

Think carefully before writing questions. Every question consumes attention. Prefer questions that reveal or reinforce meaningful understanding, procedures, misconceptions, transfer, or exam-relevant decisions. Do not fill a quota with trivial numerical skins or decorative wording. A short question may still be difficult because the idea is difficult.

For no-paper conceptual drills, prefer compact retrieval, structure recognition, method selection, rule/condition recall, error detection, interpretation, or short mental transformations. For full problem solving, authentic multi-step written problems are allowed.

Internally design and audit the set before exporting. Do not reveal private chain-of-thought; just make the resulting questions better.

## Output

After I answer the setup question, return a valid DBD Base JSON packet. For 1–15 questions, you may paste JSON or attach a .json file. For 16+ questions, attach a downloadable .json file and do not paste a giant packet into chat.

Required top-level fields:
{
  "dbd_version": "DBD Base v1.0",
  "campaign": "...",
  "subject": "...",
  "topic": "...",
  "source": "specific material basis",
  "test_type": "coverage|focused|depth|repair|mastery|exam",
  "working_style": "concept|full",
  "answer_format": "mcq|mixed",
  "difficulty": "Easy|Medium|Difficult|Adaptive",
  "questions": []
}

Each question must include:
- id;
- type: mcq, short, numeric, self_check, or essay;
- prompt;
- explanation;
- tags;
- difficulty;
- paper_required;
- choices + answer for MCQ;
- accepted_answers/tolerance when relevant;
- model_answer + concise rubric for essay;
- time_limit_seconds when AI-set timing is selected.

Do not include raw HTML. Do not output a Question Bank, Bank Collection, Subject Diet, scheduler weights, maintenance priority, or any full-DBD architecture. This is a temporary drill packet, not permanent maintenance inventory.`;
}

async function copyLitePrompt(button,subjectName=''){
  const text=litePrompt(subjectName);
  if(text.length>LITE_PROMPT_COPY_LIMIT){
    liteDownload(`dbd-base-prompt-${localDay()}.md`,text,'text/markdown');
    if(button){const old=button.textContent;button.textContent='DOWNLOADED .MD ✓';setTimeout(()=>button.textContent=old,1400)}
    return;
  }
  await copyText(text,button);
}

createVanillaPrompt=function(){return litePrompt('')};
copyVanilla=function(button){return copyLitePrompt(button,'')};

generatePrompt=function(){
  const text=createPrompt();
  const liteHeader=`# DBD Base v1.0 — Custom Drill Request\n\nUse the current subject material and think carefully before generating. This is a temporary JSON drill packet, not a Question Bank or long-term maintenance plan.\n\n`;
  DATA.generatedPrompt=liteHeader+text.replace(/DBD v0\.9\.8(?:\.4\.1)?/g,'DBD Base v1.0');
  save();
  if(DATA.generatedPrompt.length>LITE_PROMPT_COPY_LIMIT){
    liteDownload(`dbd-base-custom-prompt-${localDay()}.md`,DATA.generatedPrompt,'text/markdown');
    route('home');
    return;
  }
  route('prompt');
};

function liteSessionAnswered(){
  return DATA.completedSessions.reduce((n,s)=>n+Number(s.answered||s.totalQuestions||0),0);
}

function liteHome(){
  const drills=DATA.completedSessions.length;
  const answered=liteSessionAnswered();
  const ongoing=DATA.activeSessions.length+(DATA.pendingPacket?1:0);
  return `<section class="lite-home">
    <div class="lite-home-hero">
      <div class="eyebrow">DBD Base v1.0</div>
      <h1>Ready to drill.</h1>
      <p>Get a trustworthy JSON packet from your subject chat, import it, answer it, and leave. DBD Base records the evidence without deciding what deserves your attention.</p>
      <div class="lite-primary-actions">
        <button class="button primary" onclick="copyLitePrompt(this)">COPY PROMPT</button>
        <button class="button" onclick="route('import')">IMPORT PACKAGE</button>
      </div>
      <div class="lite-home-note">Short prompts copy to the clipboard. If a generated prompt ever becomes too long, DBD Base automatically downloads it as a Markdown (.md) file.</div>
    </div>
    ${ongoingSessions(true)}
    <div class="lite-stat-strip">
      <div class="lite-stat"><strong>${drills}</strong><span>Completed drills</span></div>
      <div class="lite-stat"><strong>${answered}</strong><span>Answered</span></div>
      <div class="lite-stat"><strong>${ongoing}</strong><span>Ongoing</span></div>
    </div>
  </section>`;
}

home=function(){return liteHome()};

function liteSubjectSummary(subjectName){
  const sessions=(DATA.completedSessions||[]).filter(s=>aliasNorm(s.subject)===aliasNorm(subjectName));
  const active=(DATA.activeSessions||[]).filter(a=>aliasNorm(a.packet?.subject)===aliasNorm(subjectName));
  const answered=sessions.reduce((n,s)=>n+Number(s.answered||s.totalQuestions||0),0);
  return {sessions,active,answered};
}

function liteSubjectNames(){
  const names=[];
  const add=v=>{if(v&&String(v).trim()&&!names.some(x=>aliasNorm(x)===aliasNorm(v)))names.push(String(v).trim())};
  (DATA.completedSessions||[]).forEach(s=>add(s.subject));
  (DATA.activeSessions||[]).forEach(a=>add(a.packet?.subject));
  if(DATA.pendingPacket?.packet)add(DATA.pendingPacket.packet.subject);
  (DATA.subjectRegistry||[]).forEach(s=>add(s.name));
  return names.sort((a,b)=>a.localeCompare(b));
}

function liteOpenSubjectByName(name){
  selectedSubjectId=`lite:${encodeURIComponent(name)}`;
  render();window.scrollTo({top:0,behavior:'smooth'});
}
function liteCloseSubject(){selectedSubjectId=null;render()}
function liteSelectedSubjectName(){
  if(!selectedSubjectId||!String(selectedSubjectId).startsWith('lite:'))return null;
  try{return decodeURIComponent(String(selectedSubjectId).slice(5))}catch(e){return null}
}

subjectsView=function(){
  const chosen=liteSelectedSubjectName();
  if(chosen){
    const x=liteSubjectSummary(chosen);
    const recent=x.sessions.slice(0,5);
    return `<section class="dev2-page">
      <button class="back-link" onclick="liteCloseSubject()">← Subjects</button>
      <div class="lite-home-hero" style="margin-top:8px">
        <div class="eyebrow">DBD Base</div>
        <h1>${esc(chosen)}</h1>
        <p>${x.sessions.length} completed drills · ${x.answered} historical answers. Lite does not infer a maintenance priority from these records.</p>
        <div class="lite-subject-actions">
          <button class="button primary" onclick='copyLitePrompt(this,${JSON.stringify(chosen)})'>COPY PROMPT</button>
          <button class="button" onclick="route('import')">IMPORT PACKAGE</button>
        </div>
      </div>
      <div class="lite-recent">
        ${recent.length?recent.map(s=>`<div class="lite-recent-row"><div><strong>${esc(s.topic||'Drill')}</strong><small>${esc(sessionTestType(s))} · ${dev2HumanDate(s.completedAt)}</small></div><strong>${s.correct||0}/${s.totalQuestions||s.answered||0}</strong></div>`).join(''):`<div class="lite-recent-row"><div><strong>No completed drills yet</strong><small>Import a packet when this subject is ready.</small></div></div>`}
      </div>
    </section>`;
  }
  const names=liteSubjectNames();
  return `<section class="dev2-page">
    <div class="dev2-page-head"><div><div class="eyebrow">Historical lanes</div><h1>Subjects</h1><p>Subjects organize past and future packets. They do not carry maintenance weights in Lite.</p></div></div>
    <div class="lite-subject-list">
      ${names.map(name=>{const x=liteSubjectSummary(name);return `<button class="lite-subject-card" onclick='liteOpenSubjectByName(${JSON.stringify(name)})'><div><h3>${esc(name)}</h3><p>${x.sessions.length} completed drills · ${x.answered} answers${x.active.length?` · ${x.active.length} ongoing`:''}</p></div><div class="right"><strong>${x.sessions.length}</strong><small>DRILLS</small></div></button>`}).join('')||'<div class="empty">No subjects yet. Import your first packet from Home.</div>'}
    </div>
  </section>`;
};

function liteHistory(){
  const sessions=(DATA.completedSessions||[]).slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  const legacyBursts=burstEventsDev2();
  const events=[...sessions.map(s=>({type:'session',at:s.completedAt,s})),...legacyBursts.map(b=>({type:'legacy',at:b.completedAt,b}))].sort((a,b)=>new Date(b.at)-new Date(a.at));
  let last='',body='';
  for(const e of events){
    const day=historyDateLabel(e.at);if(day!==last){body+=`<div class="dev2-history-date">${esc(day)}</div>`;last=day}
    if(e.type==='session'){
      const s=e.s,total=s.totalQuestions||s.answered||0;
      body+=`<div class="dev2-section" style="margin-top:6px"><div class="dev2-history-row session" onclick="viewSession('${s.id}')"><div><strong>${esc(s.subject)} · ${esc(s.topic||'Drill')}</strong><small>${esc(sessionTestType(s))} · ${fmt(s.totalTime)}</small></div><div class="dev2-history-score"><strong>${s.correct||0}/${total}</strong><small>DRILL</small></div></div></div>`;
    }else{
      const b=e.b;
      body+=`<div class="dev2-section" style="margin-top:6px"><div class="dev2-history-row"><div><strong>${esc(b.subject)} · Legacy Stream</strong><small>${b.count} retrievals · preserved from experimental full DBD</small></div><div class="dev2-history-score"><strong>${b.correct}/${b.count}</strong><small>LEGACY</small></div></div></div>`;
    }
  }
  return `<section class="dev2-page"><div class="dev2-page-head"><div><div class="eyebrow">Recorded work</div><h1>History</h1><p>Completed packet drills stay here. Experimental Stream history is preserved, not reused by Lite.</p></div></div>${body||'<div class="empty">No completed drills yet.</div>'}</section>`;
}
history=liteHistory;

function liteSettings(){
  const bytes=new Blob([JSON.stringify(DATA)]).size;
  const size=bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`;
  const legacyBank=(DATA.questionBank||[]).length;
  const legacyAttempts=(DATA.streamEngine?.attempts||[]).length;
  return `<section class="dev2-page">
    <div class="dev2-page-head"><div><div class="eyebrow">DBD Base v1.0 · ${BUILD_ID}</div><h1>Settings</h1><p>${LITE_SCHEMA_LABEL}. Full DBD v1.0 has not been released.</p></div></div>
    <div class="settings-group">
      <div class="settings-title">Lite model</div>
      <div class="metric-row"><span>Product</span><strong>DBD Base v1.0</strong></div>
      <div class="metric-row"><span>Data schema</span><strong>${LITE_SCHEMA_LABEL}</strong></div>
      <div class="metric-row"><span>Runtime</span><strong>JSON packet → drill → history</strong></div>
      <div class="metric-row"><span>Completed drills</span><strong>${DATA.completedSessions.length}</strong></div>
      <div class="metric-row"><span>Ongoing drills</span><strong>${DATA.activeSessions.length}</strong></div>
    </div>
    <div class="settings-group">
      <div class="settings-title">Preserved full-DBD legacy data</div>
      <div class="lite-legacy-note"><strong>${legacyBank} Question Bank records</strong> and <strong>${legacyAttempts} experimental Stream attempts</strong> remain in your Vault for history/compatibility. DBD Base does not schedule, prioritize, or expose those Bank questions as current drill inventory.</div>
    </div>
    <div class="settings-group">
      <div class="settings-title">DBD Vault</div>
      <p class="note">The browser key remains <strong>dbd_gazali</strong>. Export/merge continues to preserve your old Geography history and later records.</p>
      <div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div>
      <details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details>
    </div>
    <div class="settings-group"><div class="settings-title">Storage</div><div class="metric-row"><span>Approx. local data</span><strong>${size}</strong></div></div>
  </section>`;
}
dataView=liteSettings;

renderNav=function(){
  const nav=document.getElementById('navigation');
  if(view==='drill'){nav.innerHTML='';return}
  const items=[['home','Drill'],['subjects','Subjects'],['history','History']];
  nav.innerHTML=items.map(([id,l])=>`<button class="${view===id?'active':''}" onclick="route('${id}')">${l}</button>`).join('')+`<button class="nav-gear-dev2 ${view==='data'?'active':''}" onclick="route('data')" aria-label="Settings">⚙</button>`;
};

function bootLite10(){
  try{
    DATA=normalizeFutureData(DATA);
    DATA.schemaVersion=7; // numeric compatibility
    DATA.schemaLabel=LITE_SCHEMA_LABEL;
    DATA.product='DBD Base';
    DATA.baseVersion='1.0';
    save();
    clearEngineCache();
    DEV2_PICK_CACHE=null;DEV2_NEXT_PICK=null;
    render();
    console.info(`DBD Base v1.0 · ${BUILD_ID} · ${LITE_SCHEMA_LABEL}`);
    window.addEventListener('load',()=>retireLegacyServiceWorker(),{once:true});
  }catch(e){
    console.error('DBD Base boot failed',e);
    const app=document.getElementById('application');
    if(app)app.innerHTML=`<div class="boot-error"><h2>DBD Base could not finish startup.</h2><p>Your browser data remains under <strong>dbd_gazali</strong>.</p><code>${esc(e?.message||String(e))}</code></div>`;
  }
}
/* ================= END DBD BASE LEGACY COMPAT ================= */


/* DBD Base v1.0 — field-tested drill mechanics */
const LITE_RESULTS_COPY_LIMIT=16000;let LITE_CALC_OPEN=false;let LITE_CALC_EXPR='';
function liteNormalizeAnswer(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[−–—]/g,'-').replace(/[,]/g,'.').replace(/\s+/g,' ').trim()}
function liteNumbers(v){const m=liteNormalizeAnswer(v).match(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g);return(m||[]).map(Number).filter(Number.isFinite)}
function liteMostlyUnitText(v){return liteNormalizeAnswer(v).replace(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g,'').replace(/[°º%π²³^=*\/()+\-]/g,'').replace(/\b(?:derajat(?:nya)?|degree(?:s)?|deg|cm|mm|m|km|kg|g|s|sec|seconds?|menit|minute(?:s)?|jam|hours?|rad|radian(?:s)?|unit(?:s)?|satuan|sekitar|approximately|approx|about|jawabannya|answer(?: is)?|adalah|is|yaitu|maka)\b/g,'').replace(/\s+/g,'').length===0}
function liteSmartNumericEquivalent(expected,given,tolerance=0){const en=liteNumbers(expected),gn=liteNumbers(given);if(en.length!==1||gn.length!==1)return false;if(!liteMostlyUnitText(expected)||!liteMostlyUnitText(given))return false;return Math.abs(en[0]-gn[0])<=Math.max(0,Number(tolerance)||0,1e-9)}
function liteRegexMatch(patterns,value){for(const p of patterns||[]){try{const src=typeof p==='string'?p:String(p?.pattern||''),flags=typeof p==='object'&&p?.flags?String(p.flags).replace(/[^gimsuy]/g,''):'i';if(src&&new RegExp(src,flags).test(String(value??'')))return true}catch(e){console.warn('Ignored invalid answer_regex pattern',p)}}return false}
const LITE_NORMALIZE_STIMULUS_BASE=normalizeStimulus;normalizeStimulus=function(s){if(!s)return null;if(typeof s==='object'&&String(s.type||'').toLowerCase()==='svg')return{type:'svg',title:String(s.title||''),svg:String(s.svg||s.content||''),text:'',source:String(s.source||'')};return LITE_NORMALIZE_STIMULUS_BASE(s)};
const LITE_NORMALIZE_QUESTION_BASE=normalizeQuestion;normalizeQuestion=function(raw,i){const q=LITE_NORMALIZE_QUESTION_BASE(raw,i);if(!q)return q;q.answerRegex=Array.isArray(raw.answer_regex)?raw.answer_regex:Array.isArray(raw.answerRegex)?raw.answerRegex:[];const cr=raw.calculator_allowed??raw.calculatorAllowed??raw.calculator;q.calculatorAllowed=cr===true||['allowed','optional','yes','true'].includes(String(cr||'').toLowerCase());q.calculatorRequired=raw.calculator_required===true||raw.calculatorRequired===true;if(q.calculatorRequired)q.calculatorAllowed=true;return q};
calculateCorrect=function(q,r){if(r.status==='dontknow'||r.status==='timeout'||r.status==='skipped'||r.status==='unseen')return false;if(q.type==='essay')return r.selfAssessment==='yes';if(isMCQ(q))return norm(r.answer)===norm(q.answer);const ans=String(r.answer??''),exp=String(q.answer??'');if(q.type==='numeric'){const gn=liteNumbers(ans),en=liteNumbers(exp);if(gn.length===1&&en.length===1&&Math.abs(gn[0]-en[0])<=Math.max(0,Number(q.tolerance)||0,1e-9))return true}const acc=[exp,...(q.acceptedAnswers||[])];if(acc.some(x=>liteNormalizeAnswer(x)===liteNormalizeAnswer(ans)))return true;if(liteRegexMatch(q.answerRegex,ans))return true;if(acc.some(x=>liteSmartNumericEquivalent(x,ans,q.tolerance)))return true;return false};
function sanitizeSvgLite(svgText){const raw=String(svgText||'').trim();if(!raw||typeof DOMParser==='undefined')return'';try{const parser=new DOMParser(),doc=parser.parseFromString(raw,'image/svg+xml');if(doc.querySelector('parsererror'))return'';const root=doc.documentElement;if(!root||root.nodeName.toLowerCase()!=='svg')return'';const tags=new Set(['svg','g','path','line','polyline','polygon','rect','circle','ellipse','text','tspan','defs','marker','lineargradient','radialgradient','stop']),attrs=new Set(['viewbox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','font-size','font-weight','text-anchor','dominant-baseline','transform','opacity','offset','stop-color','stop-opacity','marker-end','marker-start','preserveaspectratio','id']);[...root.querySelectorAll('*')].forEach(el=>{if(!tags.has(el.nodeName.toLowerCase())){el.remove();return}[...el.attributes].forEach(a=>{const n=a.name.toLowerCase(),v=String(a.value||'');if(!attrs.has(n)){el.removeAttribute(a.name);return}if((n==='marker-end'||n==='marker-start')&&!/^url\(\#[A-Za-z0-9_.:-]+\)$/.test(v))el.removeAttribute(a.name);if(n==='id'&&!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(v))el.removeAttribute(a.name)})});[...root.attributes].forEach(a=>{const n=a.name.toLowerCase();if(!attrs.has(n)&&n!=='xmlns')root.removeAttribute(a.name)});root.setAttribute('xmlns','http://www.w3.org/2000/svg');if(!root.getAttribute('viewBox')&&!root.getAttribute('viewbox')){const w=parseFloat(root.getAttribute('width')||'0'),h=parseFloat(root.getAttribute('height')||'0');if(w>0&&h>0)root.setAttribute('viewBox',`0 0 ${w} ${h}`)}return new XMLSerializer().serializeToString(root)}catch(e){console.warn('SVG stimulus rejected',e);return''}}
stimulusHTML=function(s){if(!s)return'';if(s.type==='svg'){const safe=sanitizeSvgLite(s.svg);if(!safe)return`<div class="stimulus"><div class="stimulus-title">Diagram unavailable</div><div class="muted">This SVG stimulus was rejected by the safety filter.</div></div>`;return`<div class="stimulus svg">${s.title?`<div class="stimulus-title">${esc(s.title)}</div>`:''}<div class="stimulus-svg-wrap">${safe}</div>${s.source?`<div class="stimulus-source">— ${esc(s.source)}</div>`:''}</div>`}if(!s.text)return'';return`<div class="stimulus ${esc(s.type)}">${s.title?`<div class="stimulus-title">${esc(s.title)}</div>`:''}${esc(s.text)}${s.source?`<div class="stimulus-source">— ${esc(s.source)}</div>`:''}</div>`};
const LITE_NEW_RESPONSE_BASE=newResponse;newResponse=function(){return{...LITE_NEW_RESPONSE_BASE(),calculatorUsed:false,calculatorOpenCount:0}};
function openLiteCalculator(){const r=currentResponse();if(r){r.calculatorUsed=true;r.calculatorOpenCount=Number(r.calculatorOpenCount||0)+1;save()}LITE_CALC_OPEN=true;render()}function closeLiteCalculator(){LITE_CALC_OPEN=false;render()}function liteCalcPress(v){if(v==='C'){LITE_CALC_EXPR='';render();return}if(v==='⌫'){LITE_CALC_EXPR=LITE_CALC_EXPR.slice(0,-1);render();return}if(v==='='){try{const e=LITE_CALC_EXPR.replace(/÷/g,'/').replace(/×/g,'*').replace(/\^/g,'**');if(!/^[0-9+\-*/().%\s*]+$/.test(e))throw new Error('unsafe');const x=Function(`"use strict";return (${e})`)();if(Number.isFinite(Number(x)))LITE_CALC_EXPR=String(x)}catch(e){LITE_CALC_EXPR='Error'}render();return}if(LITE_CALC_EXPR==='Error')LITE_CALC_EXPR='';LITE_CALC_EXPR+=String(v);render()}
function calculatorOverlayLite(){if(!LITE_CALC_OPEN)return'';const ks=['C','(',')','⌫','7','8','9','÷','4','5','6','×','1','2','3','-','0','.','%','+'];return`<div class="lite-calc-overlay" onclick="if(event.target===this)closeLiteCalculator()"><div class="lite-calc"><div class="lite-calc-top"><strong>CALCULATOR</strong><button class="lite-control-pill utility" onclick="closeLiteCalculator()">CLOSE</button></div><div class="lite-calc-display">${esc(LITE_CALC_EXPR||'0')}</div><div class="lite-calc-grid">${ks.map(k=>`<button class="lite-calc-key ${['÷','×','-','+'].includes(k)?'op':''}" onclick='liteCalcPress(${JSON.stringify(k)})'>${esc(k)}</button>`).join('')}<button class="lite-calc-key equal" style="grid-column:1/-1" onclick="liteCalcPress('=')">=</button></div></div></div>`}
feedbackBlock=function(q,r){if(!r.revealed)return'';const a=active();if(q.type==='essay')return`<div class="essay-review"><h4>Essay self-check</h4><div><strong>Your answer</strong><div class="essay-answer">${esc(r.answer||'—')}</div></div><div style="margin-top:10px"><strong>Reference answer</strong><div class="essay-answer">${esc(q.modelAnswer||'—')}</div></div>${q.rubric.length?`<ul class="essay-rubric">${q.rubric.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="essay-assess"><button class="${r.selfAssessment==='yes'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'yes')">YES</button><button class="${r.selfAssessment==='partly'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'partly')">PARTLY</button><button class="${r.selfAssessment==='no'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'no')">NO</button></div>${r.selfAssessment?`<button class="button primary block" style="margin-top:10px" onclick="nextQuestion()">${a.currentIndex===a.packet.questions.length-1?'REVIEW SESSION':'NEXT QUESTION'} →</button>`:''}</div>`;const c=r.correct===true,t=r.timedOut?'Timed out':r.status==='dontknow'?"Don't know":c?'Correct':'Wrong';if(!isMCQ(q))return`<div class="feedback typed-feedback-card ${c?'correct':'wrong'}"><div class="typed-feedback-body"><span class="feedback-tag">${esc(t)}</span><div class="typed-feedback-answer"><strong>Correct answer:</strong> ${esc(q.answer||'—')}</div>${q.explanation?`<div class="typed-feedback-explanation">${esc(q.explanation)}</div>`:''}${!c&&q.whyWrong&&q.whyWrong[r.answer]?`<div class="typed-feedback-explanation"><strong>Your trap:</strong> ${esc(q.whyWrong[r.answer])}</div>`:''}</div><button class="typed-feedback-next" onclick="nextQuestion()">${a.currentIndex===a.packet.questions.length-1?'REVIEW SESSION':'NEXT QUESTION'} →</button></div>`;return`<div class="feedback ${c?'correct':'wrong'}"><span class="feedback-tag">${esc(t)}</span><p><strong>Correct answer:</strong> ${esc(q.answer||'—')}</p>${q.explanation?`<p class="muted">${esc(q.explanation)}</p>`:''}${!c&&q.whyWrong&&q.whyWrong[r.answer]?`<p class="muted"><strong>Your trap:</strong> ${esc(q.whyWrong[r.answer])}</p>`:''}</div>`};
function liteControlStrip(q,r,commentOpen){const calc=q.calculatorAllowed?`<button class="lite-calc-button" onclick="openLiteCalculator()">CALC${r.calculatorUsed?' ✓':''}</button>`:'';return`<div class="lite-control-strip">${CONFIDENCES.map(([id,l])=>`<button class="lite-control-pill ${r.confidence===id?'active':''}" ${r.locked?'disabled':''} onclick="setConfidence('${id}')">${esc(l)}</button>`).join('')}<button class="lite-control-pill danger" ${r.locked?'disabled':''} onclick="dontKnow()">I DON'T KNOW</button><button class="lite-control-pill utility" ${r.locked?'disabled':''} onclick="skipQuestion()">SKIP</button><button class="lite-control-pill comment ${r.comment||commentOpen?'active':''}" onclick="toggleCommentBox()">COMMENT ${commentOpen?'−':'＋'}</button>${calc}</div>${commentOpen?`<div class="lite-comment-pop"><textarea oninput="setComment(this.value)" placeholder="Question wording, something to ask the subject chat, or anything worth remembering...">${esc(r.comment||'')}</textarea><div class="lite-comment-meta"><button class="lite-flag-toggle ${r.flagged?'active':''}" onclick="toggleFlag()">${r.flagged?'FLAGGED ✓':'FLAG QUESTION'}</button></div></div>`:''}`}
drill=function(){const a=active();if(!a)return`<div class="empty">No active drill.</div>`;const q=currentQuestion(),r=currentResponse(),total=a.packet.questions.length,editable=responseEditable(a,r),showTimer=a.setupSnapshot.timing!=='off'&&a.setupSnapshot.showTimer,canSubmit=(isMCQ(q)?r.answer!==null:String(r.draft||r.answer||'').trim()!=='')&&!r.locked,wrongRevealed=r.revealed&&r.correct===false,done=completedCount(a),left=Math.max(0,total-done),commentOpen=commentIsOpen();let qi='';if(isMCQ(q)){qi=`<div class="choices">${Object.entries(q.choices).map(([k,v])=>{let c='answer-option-shell';if(r.answer===k)c+=' selected';if(r.revealed&&norm(k)===norm(q.answer))c+=' correct';else if(r.revealed&&r.answer===k&&!r.correct)c+=' wrong';const sel=r.answer===k,lab=a.setupSnapshot.feedback==='immediate'?(r.revealed?'NEXT →':'CHECK →'):'NEXT →',fn=a.setupSnapshot.feedback==='immediate'?(r.revealed?'nextQuestion()':'submitAnswer()'):'submitAnswer()';return`<div class="${c}"><button class="answer-main" ${editable?'':'disabled'} onclick="setChoice('${esc(k)}')"><strong>${esc(k)}.</strong> ${esc(v)}</button>${sel?`<button class="answer-inline-action ${r.revealed?'next':''}" onclick="${fn}">${a.currentIndex===total-1&&r.revealed?'REVIEW →':lab}</button>`:''}</div>`}).join('')}</div>`}else if(q.type==='essay'){qi=`<div class="field essay-field"><label>Your essay answer</label><textarea id="essay-answer" ${editable?'':'disabled'} oninput="setDraft(this.value)" placeholder="Write your response here...">${esc(r.draft||r.answer||'')}</textarea></div>${!r.locked?`<button class="button primary typed-submit" ${canSubmit?'':'disabled'} onclick="submitAnswer()">${a.setupSnapshot.feedback==='end'?'SAVE & NEXT':'SUBMIT ESSAY'}</button>`:''}`}else{qi=`<div class="field typed-field"><label>Your final answer</label><input id="typed-answer" value="${esc(r.draft||r.answer||'')}" ${editable?'':'disabled'} oninput="setDraft(this.value)" placeholder="Type the final answer here"></div>${!r.locked?`<button class="button primary typed-submit" ${canSubmit?'':'disabled'} onclick="submitAnswer()">${a.setupSnapshot.feedback==='end'?'SAVE & NEXT':'SUBMIT ANSWER'}</button>`:''}`}const fb=feedbackBlock(q,r),slot=a.setupSnapshot.feedback==='immediate'?(fb?`<div class="feedback-slot">${fb}</div>`:''):fb;const h=`<div class="drill-shell"><div class="drill-progress-row"><button class="progress-shell" onclick="navigatorOpen=true;render()"><div class="progress-track"><div class="progress-fill" style="width:${done/total*100}%"></div></div><div class="progress-meta"><span>Q${a.currentIndex+1} / ${total}</span><span>${left} left</span></div></button><button class="pause-square" onclick="pause()">Ⅱ</button></div><section class="panel question-panel"><div class="question-core">${showTimer?`<div class="timer" id="timer">${a.setupSnapshot.timing==='ai'?fmt(Math.max(0,(q.timeLimitSeconds||0)-elapsedCurrent())):fmt(elapsedCurrent())}</div>${a.setupSnapshot.timing==='ai'?`<div class="question-limit">AI-set limit · ${fmt(q.timeLimitSeconds)}</div>`:''}`:''}${stimulusHTML(q.stimulus)}<div class="question-text">${esc(q.prompt)}</div>${qi}${liteControlStrip(q,r,commentOpen)}${slot}${wrongRevealed&&q.type!=='essay'?`<div class="error-classifier"><label>What happened? (optional)</label><div class="error-types">${ERROR_TYPES.filter(x=>!['timeout','unclassified'].includes(x[0])).map(([id,l])=>`<button class="error-type ${r.errorType===id?'active':''}" onclick="setErrorType('${id}')">${esc(l)}</button>`).join('')}</div></div>`:''}${r.revealed&&q.type!=='essay'?`<div class="field compact-note"><label>One-line note (optional)</label><input value="${esc(r.note||'')}" oninput="setNote(this.value)" placeholder="Example: I confused the method."></div>`:''}</div></section></div>`;return h+(a.paused?`<div class="pause-overlay" onclick="if(event.target===this)resume()"><div class="pause-card"><div class="eyebrow">Paused</div><h1 style="font-size:2rem">Timer stopped.</h1><p class="muted">The question is hidden while the drill is paused.</p><button class="button primary block" onclick="resume()">RESUME</button><button class="button block" style="margin-top:8px" onclick="exitDrill()">SAVE & RETURN HOME</button></div></div>`:'')+calculatorOverlayLite()+navigatorOverlay()};
const LITE_ATTEMPT_FROM_BASE=attemptFrom;attemptFrom=function(q,r){return{...LITE_ATTEMPT_FROM_BASE(q,r),answerRegex:q.answerRegex||[],calculatorAllowed:Boolean(q.calculatorAllowed),calculatorRequired:Boolean(q.calculatorRequired),calculatorUsed:Boolean(r.calculatorUsed),calculatorOpenCount:Number(r.calculatorOpenCount||0)}};
function liteRecurringTagStats(s){return tagStats(s).filter(([,v])=>v.total>=2).slice(0,8)}
function liteResultsText(s){const c=confidenceStats(s),errs=errorStats(s),total=s.totalQuestions||s.answered||0;return`# DBD Base Results\n\n**Subject:** ${s.subject}\n**Topic:** ${s.topic||'—'}\n**Source:** ${s.source||'—'}\n**Drill type:** ${sessionTestType(s)}\n**Difficulty:** ${s.difficulty||'—'}\n**Questions:** ${total}\n**Correct:** ${s.correct}\n**Accuracy:** ${Math.round(s.accuracy||0)}%\n**Skipped / unanswered:** ${s.unanswered??c.unanswered}${s.totalTime===null?'':`\n**Active time:** ${fmt(s.totalTime)}`}\n\n## Confidence\n- Sure + correct: ${c.sureCorrect}\n- Not sure + correct: ${c.unsureCorrect}\n- Ngasal + correct: ${c.guessCorrect}\n- Incorrect: ${c.incorrect}\n- I don't know: ${c.dontknow}\n- Skipped / unanswered: ${c.unanswered}\n\n## Error causes recorded\n${errs.length?errs.map(([e,n])=>`- ${errorLabel(e)}: ${n}`).join('\n'):'- none'}\n\n## Questions\n\n${(s.attempts||[]).map((a,i)=>`### Q${i+1}\n${a.prompt}\n\n- **Your answer:** ${a.selected||'—'}\n- **Correct / reference answer:** ${a.answer||'—'}\n- **Result:** ${a.correct?'Correct':a.status==='dontknow'?"I don't know":['skipped','unseen'].includes(a.status)?'Skipped / unanswered':a.timedOut?'Timed out':'Wrong'}\n- **Confidence:** ${a.confidence||'—'}\n- **Error cause:** ${a.errorType&&a.errorType!=='unclassified'?errorLabel(a.errorType):'—'}\n- **Calculator used:** ${a.calculatorUsed?'Yes':'No'}\n- **Tags:** ${a.tags?.join(', ')||'—'}\n- **Note:** ${a.note||'—'}\n- **Comment:** ${a.comment||'—'}\n- **Explanation:** ${a.explanation||'—'}`).join('\n\n')}`}
async function copyLiteResults(id,button){const s=getSession(id);if(!s)return;const text=liteResultsText(s);if(text.length>LITE_RESULTS_COPY_LIMIT){download(`dbd-base-results-${slug(s.subject)}-${localDay()}.md`,text,'text/markdown');if(button){const old=button.textContent;button.textContent='DOWNLOADED .MD ✓';setTimeout(()=>button.textContent=old,1500)}return}await copyText(text,button)}
summary=function(){const s=getSession(currentSessionId)||DATA.completedSessions[0];if(!s)return`<div class="empty">No completed session.</div>`;const tags=liteRecurringTagStats(s),errs=errorStats(s),total=s.totalQuestions||s.answered||1;return`<section class="summary-shell"><div class="score-hero"><div class="score-main">${s.correct}<span>/${total}</span></div><div class="score-percent">${Math.round(s.accuracy||0)}%</div><div class="score-caption">${esc(s.subject)}${s.topic?` · ${esc(s.topic)}`:''} · ${esc(sessionTestType(s))}</div></div><div class="summary-surface"><div class="report-tabs"><button class="report-tab active">SUMMARY</button><button class="report-tab" onclick="viewFullQuiz('${s.id}')">FULL QUIZ</button></div><section class="summary-section"><div class="summary-heading">Confidence</div>${confidenceVisual(s)}</section>${tags.length?`<section class="summary-section"><div class="summary-heading">Results by recurring tag</div><div class="weak-list">${tags.map(([t,v],i)=>`<div class="weak-row"><div class="weak-rank">${i+1}</div><div class="weak-name">${esc(t)}<small>${v.correct}/${v.total} correct</small></div><div class="weak-score">${v.correct}/${v.total}</div></div>`).join('')}</div><div class="lite-results-note">These are packet tags with at least two questions. DBD Base is reporting results, not diagnosing why they happened.</div></section>`:''}${errs.length?`<section class="summary-section"><div class="summary-heading">Error causes you recorded</div><div class="error-list">${errs.map(([e,n])=>`<div class="error-row"><span>${esc(errorLabel(e))}</span><strong>${n}</strong></div>`).join('')}</div></section>`:''}<div class="result-actions one"><button class="button primary" onclick="copyLiteResults('${s.id}',this)">COPY RESULTS</button></div><div class="compact-actions"><button class="button tiny" onclick="downloadJson('${s.id}')">JSON ↓</button><button class="button tiny" ${s.wrong?'':'disabled'} onclick="retrySession('${s.id}')">RETRY WRONG</button></div></div></section>`};
litePrompt=function(subjectName=''){const subjectLine=subjectName?`TARGET SUBJECT: ${subjectName}`:'TARGET SUBJECT: infer the subject from this chat';return`# DBD Base v1.0 — Drill Packet Request\n\nDBD Base is deliberately simple: ChatGPT prepares trustworthy JSON drill material; DBD serves it and records what happened.\n\n${subjectLine}\n\nBefore generating anything, inspect the files, lesson history, prior explanations, current mistakes, and assessment context available in THIS subject chat. Do not generate JSON immediately. First ask me ONE compact setup question covering material scope, drill type, working style, answer format, question count, difficulty, feedback, timing, calculator policy, and optional focus. Recommend sensible defaults, then wait.\n\n## Educational doctrine\nThink carefully before writing questions. Every question consumes attention. Prefer meaningful understanding, procedures, misconceptions, transfer, or exam-relevant decisions. Internally design and audit the set before exporting. Do not reveal private chain-of-thought.\n\n## Renderer-aware rules\n- Use type \"numeric\" when the answer is fundamentally numeric.\n- Use clean canonical numeric answers and tolerance where valid.\n- Add accepted_answers for predictable wording variants.\n- Add answer_regex when safe flexible text matching is useful.\n- 74, 74°, and \"74 derajat\" must not become different mathematical truths.\n- SVG diagrams are supported with stimulus.type=\"svg\" and stimulus.svg. Keep SVG simple: no scripts, handlers, external links, embedded HTML, or remote resources.\n- Use calculator_allowed/calculator_required only when pedagogically appropriate; DBD records calculator use.\n- Tags must be human-facing curriculum concepts in the session language; do not use backend labels like retrieval, transfer, or composite routing.\n- Keep answer and explanation separate; explanations should be concise repair, not accidental mini-lessons.\n\nAfter I confirm setup, return a valid DBD Base JSON packet. For 16+ questions, attach a downloadable .json file rather than pasting a giant packet.\n\nTop-level dbd_version must be \"DBD Base v1.0\". Questions may include id,type,prompt,choices,answer,accepted_answers,answer_regex,tolerance,explanation,tags,difficulty,paper_required,calculator_allowed,calculator_required,stimulus,model_answer,rubric,time_limit_seconds.\n\nDo not output Question Banks, scheduler weights, maintenance priorities, or full-DBD architecture.`};
createVanillaPrompt=function(){return litePrompt('')};copyVanilla=function(button){return copyLitePrompt(button,'')};
const LITE_BOOT_BASE=bootLite10;bootLite10=function(){LITE_BOOT_BASE();DATA.product='DBD Base';DATA.baseVersion='1.0';save();console.info(`DBD Base v1.0 · ${BUILD_ID} · ${LITE_SCHEMA_LABEL}`)};


/* =====================================================================
   DBD Base v1.0 — field-tested renderer baseline
   ===================================================================== */

const BASE_SCHEMA_LABEL='Schema 7 Base';
const BASE_RESULTS_COPY_LIMIT=16000;
let BASE_ERROR_MORE_OPEN=false;

/* Make typed submit react immediately without a full re-render. */
const BASE_SET_DRAFT_PREV=setDraft;
setDraft=function(v){
  BASE_SET_DRAFT_PREV(v);
  const btn=document.querySelector('.typed-submit');
  if(btn)btn.disabled=!String(v??'').trim();
};

/* Carry numeric keyboard intent in the packet. */
const BASE_NORMALIZE_QUESTION_PREV=normalizeQuestion;
normalizeQuestion=function(raw,i){
  const q=BASE_NORMALIZE_QUESTION_PREV(raw,i);
  if(!q)return q;
  q.numericMode=String(raw.numeric_mode??raw.numericMode??(q.type==='numeric'?'decimal':'text')).toLowerCase();
  return q;
};

/* Harden SVG sanitation for markers, gradients and viewBox-based technical diagrams. */
sanitizeSvgLite=function(svgText){
  const raw=String(svgText||'').trim();
  if(!raw||typeof DOMParser==='undefined')return'';
  try{
    const parser=new DOMParser();
    const doc=parser.parseFromString(raw,'image/svg+xml');
    if(doc.querySelector('parsererror'))return'';
    const root=doc.documentElement;
    if(!root||root.nodeName.toLowerCase()!=='svg')return'';

    const allowedTags=new Set([
      'svg','g','path','line','polyline','polygon','rect','circle','ellipse',
      'text','tspan','defs','marker','lineargradient','radialgradient','stop',
      'clippath'
    ]);
    const allowedAttrs=new Set([
      'viewbox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry',
      'd','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin',
      'stroke-dasharray','stroke-dashoffset','vector-effect',
      'font-size','font-weight','font-style','text-anchor','dominant-baseline',
      'letter-spacing','textlength','lengthadjust',
      'transform','opacity','offset','stop-color','stop-opacity',
      'marker-end','marker-start','marker-mid',
      'markerwidth','markerheight','refx','refy','orient','markerunits',
      'preserveaspectratio','id','clip-path','fill-rule','clip-rule',
      'gradientunits','gradienttransform','fx','fy','fr','spreadmethod'
    ]);

    const safeUrl=v=>/^url\(\#[A-Za-z_][A-Za-z0-9_.:-]*\)$/.test(String(v||'').trim());

    [...root.querySelectorAll('*')].forEach(el=>{
      if(!allowedTags.has(el.nodeName.toLowerCase())){
        el.remove();return;
      }
      [...el.attributes].forEach(attr=>{
        const name=attr.name.toLowerCase(),val=String(attr.value||'');
        if(!allowedAttrs.has(name)){
          el.removeAttribute(attr.name);return;
        }
        if(['marker-end','marker-start','marker-mid','clip-path'].includes(name)&&!safeUrl(val)){
          el.removeAttribute(attr.name);return;
        }
        if(['fill','stroke'].includes(name)&&/^url\(/i.test(val)&&!safeUrl(val)){
          el.removeAttribute(attr.name);return;
        }
        if(name==='id'&&!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(val)){
          el.removeAttribute(attr.name);return;
        }
      });
    });

    [...root.attributes].forEach(attr=>{
      const name=attr.name.toLowerCase();
      if(!allowedAttrs.has(name)&&name!=='xmlns')root.removeAttribute(attr.name);
    });

    root.setAttribute('xmlns','http://www.w3.org/2000/svg');
    root.setAttribute('preserveAspectRatio','xMidYMid meet');

    if(!root.getAttribute('viewBox')&&!root.getAttribute('viewbox')){
      const w=parseFloat(root.getAttribute('width')||'0');
      const h=parseFloat(root.getAttribute('height')||'0');
      if(w>0&&h>0)root.setAttribute('viewBox',`0 0 ${w} ${h}`);
      else root.setAttribute('viewBox','0 0 420 280');
    }

    root.removeAttribute('width');
    root.removeAttribute('height');
    return new XMLSerializer().serializeToString(root);
  }catch(e){
    console.warn('SVG stimulus rejected',e);
    return'';
  }
};

function baseNumericInputAttrs(q){
  if(q.type!=='numeric')return `inputmode="text"`;
  const m=String(q.numericMode||'decimal').toLowerCase();
  if(m==='integer'||m==='whole'||m==='digits')return `inputmode="numeric" pattern="[0-9]*"`;
  return `inputmode="decimal"`;
}

function baseTypedAnswerShell(q,r,total,index){
  const cls=r.correct===true?'correct':'wrong';
  const shown=String(r.answer??r.draft??'').trim()||'—';
  return `<div class="base-typed-answer-shell ${cls}">
    <div class="base-typed-answer-value">${esc(shown)}</div>
    <button class="base-typed-answer-next" onclick="nextQuestion()">${index===total-1?'REVIEW':'NEXT →'}</button>
  </div>`;
}

function baseControlStrip(q,r,commentOpen){
  const calc=q.calculatorAllowed?`<button class="base-control-pill calc" onclick="openLiteCalculator()">CALC${r.calculatorUsed?' ✓':''}</button>`:'';
  return `<div class="base-control-strip" aria-label="Answer controls">
    ${CONFIDENCES.map(([id,l])=>`<button class="base-control-pill ${r.confidence===id?'active':''}" ${r.locked?'disabled':''} onclick="setConfidence('${id}')">${esc(l)}</button>`).join('')}
    <button class="base-control-pill" ${r.locked?'disabled':''} onclick="skipQuestion()">SKIP</button>
    <button class="base-control-pill comment ${r.comment||commentOpen?'active':''}" onclick="toggleCommentBox()">COMMENT ${commentOpen?'−':'＋'}</button>
    ${calc}
  </div>
  ${commentOpen?`<div class="lite-comment-pop">
    <textarea oninput="setComment(this.value)" placeholder="Something to ask your subject chat, a wording issue, or anything worth preserving...">${esc(r.comment||'')}</textarea>
    <div class="lite-comment-meta"><button class="lite-flag-toggle ${r.flagged?'active':''}" onclick="toggleFlag()">${r.flagged?'FLAGGED ✓':'FLAG QUESTION'}</button></div>
  </div>`:''}`;
}

function toggleBaseErrorMore(){BASE_ERROR_MORE_OPEN=!BASE_ERROR_MORE_OPEN;render()}

function baseErrorClassifier(r){
  const primary=[['formula','Forgot rule/formula'],['method','Wrong method'],['careless','Careless/rushed']];
  const more=ERROR_TYPES.filter(([id])=>!['formula','method','careless','timeout','unclassified'].includes(id));
  return `<div class="error-classifier">
    <label>What happened? (optional)</label>
    <div class="base-error-row">
      ${primary.map(([id,l])=>`<button class="base-error-pill ${r.errorType===id?'active':''}" onclick="setErrorType('${id}')">${esc(l)}</button>`).join('')}
      <button class="base-error-pill base-more-pill ${BASE_ERROR_MORE_OPEN?'active':''}" onclick="toggleBaseErrorMore()">•••</button>
    </div>
    ${BASE_ERROR_MORE_OPEN?`<div class="base-error-more">${more.map(([id,l])=>`<button class="base-error-pill ${r.errorType===id?'active':''}" onclick="setErrorType('${id}')">${esc(l)}</button>`).join('')}</div>`:''}
  </div>`;
}

/* Typed feedback is explanation-only. NEXT lives beside the submitted answer. */
feedbackBlock=function(q,r){
  if(!r.revealed)return'';
  const a=active();

  if(q.type==='essay'){
    return `<div class="essay-review"><h4>Essay self-check</h4><div><strong>Your answer</strong><div class="essay-answer">${esc(r.answer||'—')}</div></div><div style="margin-top:10px"><strong>Reference answer</strong><div class="essay-answer">${esc(q.modelAnswer||'—')}</div></div>${q.rubric.length?`<ul class="essay-rubric">${q.rubric.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="essay-assess"><button class="${r.selfAssessment==='yes'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'yes')">YES</button><button class="${r.selfAssessment==='partly'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'partly')">PARTLY</button><button class="${r.selfAssessment==='no'?'active':''}" onclick="setEssayAssessment(${a.currentIndex},'no')">NO</button></div>${r.selfAssessment?`<button class="button primary block" style="margin-top:10px" onclick="nextQuestion()">${a.currentIndex===a.packet.questions.length-1?'REVIEW SESSION':'NEXT QUESTION'} →</button>`:''}</div>`;
  }

  const correct=r.correct===true;
  const tag=r.timedOut?'Timed out':r.status==='dontknow'?"Don't know":correct?'Correct':'Wrong';

  if(!isMCQ(q)){
    return `<div class="feedback typed-feedback-card ${correct?'correct':'wrong'}">
      <span class="feedback-tag">${esc(tag)}</span>
      <div class="typed-feedback-answer"><strong>Correct answer:</strong> ${esc(q.answer||'—')}</div>
      ${q.explanation?`<div class="typed-feedback-explanation">${esc(q.explanation)}</div>`:''}
      ${!correct&&q.whyWrong&&q.whyWrong[r.answer]?`<div class="typed-feedback-explanation"><strong>Your trap:</strong> ${esc(q.whyWrong[r.answer])}</div>`:''}
    </div>`;
  }

  return `<div class="feedback ${correct?'correct':'wrong'}"><span class="feedback-tag">${esc(tag)}</span><p><strong>Correct answer:</strong> ${esc(q.answer||'—')}</p>${q.explanation?`<p class="muted">${esc(q.explanation)}</p>`:''}${!correct&&q.whyWrong&&q.whyWrong[r.answer]?`<p class="muted"><strong>Your trap:</strong> ${esc(q.whyWrong[r.answer])}</p>`:''}</div>`;
};

/* Field-tested drill composition:
   - MCQ keeps selected-answer NEXT.
   - typed NEXT is beside the submitted answer.
   - feedback comes before certainty/skip/comment after reveal.
   - no I DON'T KNOW button and no duplicate one-line note. */
drill=function(){
  const a=active();
  if(!a)return `<div class="empty">No active drill.</div>`;

  const q=currentQuestion(),r=currentResponse(),total=a.packet.questions.length,
    editable=responseEditable(a,r),
    showTimer=a.setupSnapshot.timing!=='off'&&a.setupSnapshot.showTimer,
    canSubmit=(isMCQ(q)?r.answer!==null:String(r.draft||r.answer||'').trim()!=='')&&!r.locked,
    wrongRevealed=r.revealed&&r.correct===false,
    done=completedCount(a),left=Math.max(0,total-done),
    commentOpen=commentIsOpen();

  let questionInput='';

  if(isMCQ(q)){
    questionInput=`<div class="choices">${Object.entries(q.choices).map(([k,v])=>{
      let c='answer-option-shell';
      if(r.answer===k)c+=' selected';
      if(r.revealed&&norm(k)===norm(q.answer))c+=' correct';
      else if(r.revealed&&r.answer===k&&!r.correct)c+=' wrong';
      const selected=r.answer===k;
      const actionLabel=a.setupSnapshot.feedback==='immediate'?(r.revealed?'NEXT →':'CHECK →'):'NEXT →';
      const actionFn=a.setupSnapshot.feedback==='immediate'?(r.revealed?'nextQuestion()':'submitAnswer()'):'submitAnswer()';
      return `<div class="${c}">
        <button class="answer-main" ${editable?'':'disabled'} onclick="setChoice('${esc(k)}')"><strong>${esc(k)}.</strong> ${esc(v)}</button>
        ${selected?`<button class="answer-inline-action ${r.revealed?'next':''}" onclick="${actionFn}">${a.currentIndex===total-1&&r.revealed?'REVIEW →':actionLabel}</button>`:''}
      </div>`;
    }).join('')}</div>`;
  }else if(q.type==='essay'){
    questionInput=`<div class="field essay-field"><label>Your essay answer</label><textarea id="essay-answer" ${editable?'':'disabled'} oninput="setDraft(this.value)" placeholder="Write your response here...">${esc(r.draft||r.answer||'')}</textarea></div>${!r.locked?`<button class="button primary typed-submit" ${canSubmit?'':'disabled'} onclick="submitAnswer()">${a.setupSnapshot.feedback==='end'?'SAVE & NEXT':'SUBMIT ESSAY'}</button>`:''}`;
  }else{
    questionInput=r.revealed
      ? `<div class="field typed-field"><label>Your final answer</label>${baseTypedAnswerShell(q,r,total,a.currentIndex)}</div>`
      : `<div class="field typed-field"><label>Your final answer</label><input id="typed-answer" ${baseNumericInputAttrs(q)} value="${esc(r.draft||r.answer||'')}" ${editable?'':'disabled'} oninput="setDraft(this.value)" placeholder="${q.type==='numeric'?'Type a number':'Type the final answer here'}"></div><button class="button primary typed-submit" ${canSubmit?'':'disabled'} onclick="submitAnswer()">${a.setupSnapshot.feedback==='end'?'SAVE & NEXT':'SUBMIT ANSWER'}</button>`;
  }

  const feedback=feedbackBlock(q,r);
  const feedbackSlot=a.setupSnapshot.feedback==='immediate'?(feedback?`<div class="feedback-slot">${feedback}</div>`:''):feedback;
  const controls=baseControlStrip(q,r,commentOpen);
  const afterAnswer=r.revealed?`${feedbackSlot}${controls}`:`${controls}${feedbackSlot}`;

  const html=`<div class="drill-shell">
    <div class="drill-progress-row">
      <button class="progress-shell" onclick="navigatorOpen=true;render()" aria-label="Open question navigator">
        <div class="progress-track"><div class="progress-fill" style="width:${done/total*100}%"></div></div>
        <div class="progress-meta"><span>Q${a.currentIndex+1} / ${total}</span><span>${left} left</span></div>
      </button>
      <button class="pause-square" onclick="pause()" aria-label="Pause drill">Ⅱ</button>
    </div>
    <section class="panel question-panel"><div class="question-core">
      ${showTimer?`<div class="timer" id="timer">${a.setupSnapshot.timing==='ai'?fmt(Math.max(0,(q.timeLimitSeconds||0)-elapsedCurrent())):fmt(elapsedCurrent())}</div>${a.setupSnapshot.timing==='ai'?`<div class="question-limit">AI-set limit · ${fmt(q.timeLimitSeconds)}</div>`:''}`:''}
      ${stimulusHTML(q.stimulus)}
      <div class="question-text">${esc(q.prompt)}</div>
      ${questionInput}
      ${afterAnswer}
      ${wrongRevealed&&q.type!=='essay'?baseErrorClassifier(r):''}
    </div></section>
  </div>`;

  return html+
    (a.paused?`<div class="pause-overlay" onclick="if(event.target===this)resume()"><div class="pause-card"><div class="eyebrow">Paused</div><h1 style="font-size:2rem">Timer stopped.</h1><p class="muted">The question is hidden while the drill is paused.</p><button class="button primary block" onclick="resume()">RESUME</button><button class="button block" style="margin-top:8px" onclick="exitDrill()">SAVE & RETURN HOME</button></div></div>`:'')+
    calculatorOverlayLite()+
    navigatorOverlay();
};

/* Reset expanded error taxonomy when advancing. */
const BASE_NEXT_QUESTION_PREV=nextQuestion;
nextQuestion=function(){
  BASE_ERROR_MORE_OPEN=false;
  return BASE_NEXT_QUESTION_PREV();
};

/* Base home/menu: simple packet-first contract. */
function baseHome(){
  const drills=DATA.completedSessions.length;
  const answered=liteSessionAnswered();
  const ongoing=DATA.activeSessions.length+(DATA.pendingPacket?1:0);
  return `<section class="lite-home">
    <div class="lite-home-hero">
      <div class="base-home-kicker">DBD Base v1.0</div>
      <h1>Ready to drill.</h1>
      <p>Prepare a trustworthy JSON packet in your subject chat, import it, and drill. Base renders the questions well and records what happened; it does not decide what you should study.</p>
      <div class="lite-primary-actions">
        <button class="button primary" onclick="copyLitePrompt(this)">COPY PROMPT</button>
        <button class="button" onclick="route('import')">IMPORT PACKAGE</button>
      </div>
      <div class="lite-home-note">Base supports MCQ, numeric/short answers, essays, sanitized SVG diagrams, and an optional in-app calculator.</div>
    </div>
    ${ongoingSessions(true)}
    <div class="lite-stat-strip">
      <div class="lite-stat"><strong>${drills}</strong><span>Completed drills</span></div>
      <div class="lite-stat"><strong>${answered}</strong><span>Answered</span></div>
      <div class="lite-stat"><strong>${ongoing}</strong><span>Ongoing</span></div>
    </div>
  </section>`;
}
home=function(){return baseHome()};

/* Base subject copy: history lane, not scheduler surface. */
subjectsView=function(){
  const chosen=liteSelectedSubjectName();
  if(chosen){
    const x=liteSubjectSummary(chosen),recent=x.sessions.slice(0,5);
    return `<section class="dev2-page">
      <button class="back-link" onclick="liteCloseSubject()">← Subjects</button>
      <div class="lite-home-hero" style="margin-top:8px">
        <div class="eyebrow">DBD Base</div>
        <h1>${esc(chosen)}</h1>
        <p>${x.sessions.length} completed drills · ${x.answered} historical answers.</p>
        <div class="lite-subject-actions">
          <button class="button primary" onclick='copyLitePrompt(this,${JSON.stringify(chosen)})'>COPY PROMPT</button>
          <button class="button" onclick="route('import')">IMPORT PACKAGE</button>
        </div>
      </div>
      <div class="lite-recent">
        ${recent.length?recent.map(s=>`<div class="lite-recent-row"><div><strong>${esc(s.topic||'Drill')}</strong><small>${esc(sessionTestType(s))} · ${dev2HumanDate(s.completedAt)}</small></div><strong>${s.correct||0}/${s.totalQuestions||s.answered||0}</strong></div>`).join(''):`<div class="lite-recent-row"><div><strong>No completed drills yet</strong><small>Import a packet when this subject is ready.</small></div></div>`}
      </div>
    </section>`;
  }
  const names=liteSubjectNames();
  return `<section class="dev2-page">
    <div class="dev2-page-head"><div><div class="eyebrow">Historical lanes</div><h1>Subjects</h1><p>Subjects organize packet history. Base does not assign maintenance weights.</p></div></div>
    <div class="lite-subject-list">
      ${names.map(name=>{const x=liteSubjectSummary(name);return `<button class="lite-subject-card" onclick='liteOpenSubjectByName(${JSON.stringify(name)})'><div><h3>${esc(name)}</h3><p>${x.sessions.length} completed drills · ${x.answered} answers${x.active.length?` · ${x.active.length} ongoing`:''}</p></div><div class="right"><strong>${x.sessions.length}</strong><small>DRILLS</small></div></button>`}).join('')||'<div class="empty">No subjects yet. Import your first packet from Home.</div>'}
    </div>
  </section>`;
};

/* Base history wording. */
history=function(){
  const sessions=(DATA.completedSessions||[]).slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  const legacyBursts=burstEventsDev2();
  const events=[...sessions.map(s=>({type:'session',at:s.completedAt,s})),...legacyBursts.map(b=>({type:'legacy',at:b.completedAt,b}))].sort((a,b)=>new Date(b.at)-new Date(a.at));
  let last='',body='';
  for(const e of events){
    const day=historyDateLabel(e.at);if(day!==last){body+=`<div class="dev2-history-date">${esc(day)}</div>`;last=day}
    if(e.type==='session'){
      const s=e.s,total=s.totalQuestions||s.answered||0;
      body+=`<div class="dev2-section" style="margin-top:6px"><div class="dev2-history-row session" onclick="viewSession('${s.id}')"><div><strong>${esc(s.subject)} · ${esc(s.topic||'Drill')}</strong><small>${esc(sessionTestType(s))} · ${fmt(s.totalTime)}</small></div><div class="dev2-history-score"><strong>${s.correct||0}/${total}</strong><small>DRILL</small></div></div></div>`;
    }else{
      const b=e.b;
      body+=`<div class="dev2-section" style="margin-top:6px"><div class="dev2-history-row"><div><strong>${esc(b.subject)} · Legacy Stream</strong><small>${b.count} retrievals · preserved experimental history</small></div><div class="dev2-history-score"><strong>${b.correct}/${b.count}</strong><small>LEGACY</small></div></div></div>`;
    }
  }
  return `<section class="dev2-page"><div class="dev2-page-head"><div><div class="eyebrow">Recorded work</div><h1>History</h1><p>Completed packet drills stay here. Base records evidence; semantic interpretation belongs upstream.</p></div></div>${body||'<div class="empty">No completed drills yet.</div>'}</section>`;
};

/* Factual Base settings while keeping Schema-7 data compatibility. */
dataView=function(){
  const bytes=new Blob([JSON.stringify(DATA)]).size;
  const size=bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(2)} MB`;
  const legacyBank=(DATA.questionBank||[]).length;
  const legacyAttempts=(DATA.streamEngine?.attempts||[]).length;
  return `<section class="dev2-page">
    <div class="dev2-page-head"><div><div class="eyebrow">DBD Base v1.0 · ${BUILD_ID}</div><h1>Settings</h1><p>${BASE_SCHEMA_LABEL}. Numeric compatibility remains Schema 7.</p></div></div>
    <div class="settings-group">
      <div class="settings-title">Base model</div>
      <div class="metric-row"><span>Product</span><strong>DBD Base v1.0</strong></div>
      <div class="metric-row"><span>Data schema</span><strong>${BASE_SCHEMA_LABEL}</strong></div>
      <div class="metric-row"><span>Runtime</span><strong>JSON packet → render → drill → history</strong></div>
      <div class="metric-row"><span>Completed drills</span><strong>${DATA.completedSessions.length}</strong></div>
      <div class="metric-row"><span>Ongoing drills</span><strong>${DATA.activeSessions.length}</strong></div>
    </div>
    <div class="settings-group">
      <div class="settings-title">Renderer capabilities</div>
      <div class="metric-row"><span>Question surfaces</span><strong>MCQ · numeric · short · essay · SVG</strong></div>
      <div class="metric-row"><span>Optional tools</span><strong>calculator · flexible answer match</strong></div>
    </div>
    <div class="settings-group">
      <div class="settings-title">Preserved experimental data</div>
      <div class="lite-legacy-note"><strong>${legacyBank} old Question Bank records</strong> and <strong>${legacyAttempts} experimental Stream attempts</strong> remain in the Vault for compatibility/history. Base does not schedule them.</div>
    </div>
    <div class="settings-group">
      <div class="settings-title">DBD Vault</div>
      <p class="note">The browser key remains <strong>dbd_gazali</strong>.</p>
      <div class="data-actions"><button class="button primary" onclick="exportVault()">EXPORT VAULT</button><button class="button" onclick="mergeVault()">MERGE VAULT</button></div>
      <details class="validation-details" style="margin-top:10px"><summary>Replacement restore</summary><div><button class="button small" onclick="importBackup()">REPLACE FROM BACKUP</button></div></details>
    </div>
    <div class="settings-group"><div class="settings-title">Storage</div><div class="metric-row"><span>Approx. local data</span><strong>${size}</strong></div></div>
  </section>`;
};

/* Results are one factual handoff. */
liteResultsText=function(s){
  const c=confidenceStats(s),errs=errorStats(s),total=s.totalQuestions||s.answered||0;
  return `# DBD Base Results

**Subject:** ${s.subject}
**Topic:** ${s.topic||'—'}
**Source:** ${s.source||'—'}
**Drill type:** ${sessionTestType(s)}
**Difficulty:** ${s.difficulty||'—'}
**Questions:** ${total}
**Correct:** ${s.correct}
**Accuracy:** ${Math.round(s.accuracy||0)}%
**Skipped / unanswered:** ${s.unanswered??c.unanswered}
${s.totalTime===null?'':`**Active time:** ${fmt(s.totalTime)}`}

## Confidence
- Sure + correct: ${c.sureCorrect}
- Not sure + correct: ${c.unsureCorrect}
- Ngasal + correct: ${c.guessCorrect}
- Incorrect: ${c.incorrect}
- Skipped / unanswered: ${c.unanswered}

## Error causes recorded
${errs.length?errs.map(([e,n])=>`- ${errorLabel(e)}: ${n}`).join('\n'):'- none'}

## Questions

${(s.attempts||[]).map((a,i)=>`### Q${i+1}
${a.prompt}

- **Your answer:** ${a.selected||'—'}
- **Correct / reference answer:** ${a.answer||'—'}
- **Result:** ${a.correct?'Correct':['skipped','unseen'].includes(a.status)?'Skipped / unanswered':a.timedOut?'Timed out':'Wrong'}
- **Confidence:** ${a.confidence||'—'}
- **Error cause:** ${a.errorType&&a.errorType!=='unclassified'?errorLabel(a.errorType):'—'}
- **Calculator used:** ${a.calculatorUsed?'Yes':'No'}
- **Tags:** ${a.tags?.join(', ')||'—'}
- **Comment:** ${a.comment||'—'}
- **Explanation:** ${a.explanation||'—'}`).join('\n\n')}`;
};

copyLiteResults=async function(id,button){
  const s=getSession(id);if(!s)return;
  const text=liteResultsText(s);
  if(text.length>BASE_RESULTS_COPY_LIMIT){
    download(`dbd-base-results-${slug(s.subject)}-${localDay()}.md`,text,'text/markdown');
    if(button){const old=button.textContent;button.textContent='DOWNLOADED .MD ✓';setTimeout(()=>button.textContent=old,1500)}
    return;
  }
  await copyText(text,button);
};

/* Base renderer-aware prompt. */
litePrompt=function(subjectName=''){
  const subjectLine=subjectName?`TARGET SUBJECT: ${subjectName}`:'TARGET SUBJECT: infer the subject from this chat';
  return `# DBD Base v1.0 — Drill Packet Request

DBD Base is the stable execution layer: ChatGPT prepares trustworthy JSON drill material; Base renders it, runs the drill, and records what happened. Base does not decide what I should study.

${subjectLine}

Before generating anything, inspect the files, lesson history, prior explanations, current mistakes, and assessment context available in THIS subject chat.

Do not generate JSON immediately. First ask me ONE compact setup question covering:
- material scope;
- drill type;
- conceptual/no-paper vs full problem solving;
- MCQ vs Mixed;
- question count;
- difficulty;
- feedback;
- timing;
- calculator policy;
- optional focus.

Recommend sensible defaults from the real subject context, then wait for my answer.

## Educational doctrine

Think carefully before writing questions. Every question consumes attention. Prefer questions that reveal or reinforce meaningful understanding, procedures, misconceptions, transfer, or exam-relevant decisions. Internally design and audit the set before export. Do not reveal private chain-of-thought.

## Renderer-aware rules

DBD Base supports:
- MCQ;
- short answer;
- numeric answer;
- self-check;
- essay;
- text/context/quote stimuli;
- sanitized inline SVG diagrams;
- an optional built-in calculator.

### Numeric interaction
When the answer is fundamentally numeric, use type "numeric".
Use:
- numeric_mode: "integer" for whole-number entry;
- numeric_mode: "decimal" when decimals may be needed.
Base will request a number-oriented phone keyboard.

Store the canonical answer cleanly (for example 74 rather than prose).
Use tolerance for valid approximations.
Add accepted_answers for predictable variants.
Add answer_regex only when safe flexible textual matching is useful.

Equivalent forms such as 74, 74°, and "74 derajat" must not become different mathematical truths.

### SVG
Use stimulus.type="svg" and place the SVG markup in stimulus.svg.
Diagrams may include lines, paths, circles, ellipses, rectangles, polygons, polylines, text, groups, markers/arrowheads, gradients and clipping paths.
Use a correct viewBox and keep every important label/shape inside it.
Prefer generous margins so labels are not clipped.
Do not include scripts, event handlers, external links, remote resources, embedded HTML, or clickable SVG objects.
Base sanitizes SVG and makes the diagram non-interactive so it cannot steal answer-button hitboxes.

This is especially appropriate for:
- mathematics: geometry, graphs, matrices, transformations, vectors;
- physics: motion graphs, vectors, free-body diagrams, trajectories, circular motion, energy diagrams;
- chemistry: skeletal formulae, nomenclature, isomers, reaction arrows, bond highlighting, energy profiles.

### Calculator
Use calculator_allowed:true only when calculator access is appropriate.
Use calculator_required:true only when genuinely required.
Base records whether its built-in calculator was opened.

### Tags
Tags must be human-facing taught concepts/skills in the language of the session.
Do not use model-process labels such as "retrieval", "transfer", or "composite routing" unless those are genuinely taught skill names.

### Explanations
Keep the canonical answer and explanation separate.
Explanation should usually be concise repair, not an accidental mini-lesson.

## Output

After I confirm setup, return a valid DBD Base JSON packet.
For 16+ questions, attach a downloadable .json file rather than pasting a giant packet.

Required top-level shape:
{
  "dbd_version": "DBD Base v1.0",
  "campaign": "...",
  "subject": "...",
  "topic": "...",
  "source": "...",
  "test_type": "coverage|focused|depth|repair|mastery|exam",
  "working_style": "concept|full",
  "answer_format": "mcq|mixed",
  "difficulty": "Easy|Medium|Difficult|Adaptive",
  "questions": []
}

Question fields may include:
{
  "id": "q1",
  "type": "mcq|short|numeric|self_check|essay",
  "numeric_mode": "integer|decimal",
  "prompt": "...",
  "choices": {"A":"..."},
  "answer": "...",
  "accepted_answers": [],
  "answer_regex": [],
  "tolerance": 0,
  "explanation": "...",
  "tags": ["human-facing concept"],
  "difficulty": "easy|medium|hard",
  "paper_required": false,
  "calculator_allowed": false,
  "calculator_required": false,
  "stimulus": {
    "type": "context|quote|passage|svg",
    "title": "",
    "text": "",
    "svg": "",
    "source": ""
  },
  "model_answer": "",
  "rubric": [],
  "time_limit_seconds": 90
}

Do not include raw HTML. SVG is allowed only through stimulus.type="svg".
Do not output Question Banks, scheduler weights, maintenance priorities, or full-DBD architecture.`;
};
createVanillaPrompt=function(){return litePrompt('')};
copyVanilla=function(button){return copyLitePrompt(button,'')};

/* Base boot: keep numeric Schema 7 compatibility while relabeling the branch. */
const BASE_BOOT_PREV=bootLite10;
bootLite10=function(){
  BASE_BOOT_PREV();
  DATA.schemaVersion=7;
  DATA.schemaLabel=BASE_SCHEMA_LABEL;
  DATA.product='DBD Base';
  DATA.baseVersion='1.0';
  DATA.appVersion=APP_VERSION;
  save();
  console.info(`DBD Base v1.0 · ${BUILD_ID} · ${BASE_SCHEMA_LABEL}`);
};

/* ================= END DBD BASE v1.0 ================= */

bootLite10();
/* ================= END v0.9.8.4.1 BOOT ================= */
