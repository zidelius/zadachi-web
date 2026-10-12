(function(){
'use strict';
/* =================== Подключение =================== */
var SUPA_URL='https://avegfmaiutxryomjzoch.supabase.co';
var FN_NAME='assistant';
var PUSH_URL='https://avegfmaiutxryomjzoch.supabase.co/functions/v1/push';
var SUPA_KEY='sb_publishable_LQAG5aiqmzc2BOfcgW1YEA_bIeMB9Ut';
var HASH=location.hash||'';
var FROM_INVITE=/type=invite/.test(HASH)||/type=signup/.test(HASH);
var FROM_RECOVERY=/type=recovery/.test(HASH);
var HASH_ERROR=(HASH.match(/error_description=([^&]+)/)||[])[1];
var sb=window.supabase.createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});

/* =================== Даты =================== */
var DAYMS=86400000;
function pad(n){return String(n).padStart(2,'0');}
function keyOf(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function fromKey(k){var p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function addDays(k,n){var d=fromKey(k);d.setDate(d.getDate()+n);return keyOf(d);}
function T(){return keyOf(new Date());}
function diff(a,b){return Math.round((fromKey(a)-fromKey(b))/DAYMS);}
function dow(k){return (fromKey(k).getDay()+6)%7;}
function nowHM(){var d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes());}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function fmt(k,o){return fromKey(k).toLocaleDateString('ru-RU',o);}
function fmtLong(k){return cap(fmt(k,{weekday:'long',day:'numeric',month:'long'}));}
function fmtDM(k){return fmt(k,{day:'numeric',month:'long'});}
function fmtShort(k){return fmt(k,{weekday:'short',day:'numeric',month:'short'});}
function dayWord(k){var d=diff(k,T());if(d===0)return'Сегодня';if(d===1)return'Завтра';if(d===2)return'Послезавтра';if(d===-1)return'Вчера';return cap(fmtShort(k));}
function monthStart(k){var d=fromKey(k);return keyOf(new Date(d.getFullYear(),d.getMonth(),1));}
function addMonths(k,n){var d=fromKey(k);return keyOf(new Date(d.getFullYear(),d.getMonth()+n,1));}
var WD=['пн','вт','ср','чт','пт','сб','вс'];
function plural(n,a,b,c){var m10=n%10,m100=n%100;if(m10===1&&m100!==11)return a;if(m10>=2&&m10<=4&&(m100<10||m100>=20))return b;return c;}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

/* =================== Иконки =================== */
var P={
check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',note:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
tasks:'<path d="M4 6.5l2 2 3.5-3.5M13 7h7M4 13.5l2 2 3.5-3.5M13 14h7M13 20h7"/>',bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
repeat:'<path d="M17 3l3 3-3 3M4 12v-2a4 4 0 0 1 4-4h12M7 21l-3-3 3-3M20 12v2a4 4 0 0 1-4 4H4"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
send:'<path d="M4 12l16-8-6 16-2.5-6.5z"/>',eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 7 9 7a16 16 0 0 1-3 3.6M6.6 6.6C4.3 8.2 3 12 3 12s4 7 9 7a9 9 0 0 0 4.4-1.2"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M19 19v2H6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6a5 5 0 0 1 5.5 5.4"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',msg:'<path d="M4 5h16v11H9l-5 4z"/>',inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',left:'<path d="M15 6l-6 6 6 6"/>',right:'<path d="M9 6l6 6-6 6"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',move:'<path d="M5 12h14M13 6l6 6-6 6"/>',
wave:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',drop:'<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',run:'<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 11l3-3 4 1 3 4h3M11 15l-2-4"/>',
leaf:'<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>',moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',heart:'<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
pill:'<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 7"/>',pen:'<path d="M4 20l1-5L16 4l4 4L9 19z"/>',
music:'<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',dumb:'<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
coffee:'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',bed:'<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="11" r="1.5"/>',
star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',circle:'<circle cx="12" cy="12" r="7"/>',award:'<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',clock2:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'
};
function I(n,cls){return '<svg class="i'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[n]||P.circle)+'</svg>';}
var HICONS=['book','wave','drop','run','dumb','leaf','moon','sun','heart','pill','pen','music','coffee','bed','star','circle'];
var COLORS=['#141414','#6A5FE0','#3F7D5C','#C0663B','#4A6FB0','#B0476E'];
var LCOLORS=['#8C8A84','#5F7FB8','#C98B5B','#7C9C83','#9B86C4','#C46A6A'];

/* =================== Данные и состояние =================== */
var ME=null;
var D={nmembers:[],profiles:[],lists:[],members:[],tasks:[],log:[],habits:[],marks:{},notes:[],templates:[],comments:{}};
var UI={view:'tasks',filter:'all',cal:'day',calDay:T(),sel:null,q:'',noteId:null,sheet:null,quick:''};
var SET_DEF={theme:'light',accent:'#141414',layout:'auto',autoMove:true,quiet:{from:'23:00',to:'08:00'},hours:{from:'09:00',to:'21:00'},rewards:true,assistant:false,showTpl:true,def:{date:'today',time:'none',at:'09:00',every:10,times:0}};
var SET=JSON.parse(JSON.stringify(SET_DEF));
function prof(id){return D.profiles.filter(function(p){return p.id===id;})[0];}
function pname(id){var p=prof(id);return p?(p.name||p.email.split('@')[0]):'?';}
function others(){return D.profiles.filter(function(p){return p.id!==ME;});}
function findTask(id){return D.tasks.filter(function(t){return t.id===id;})[0];}
function findList(id){return D.lists.filter(function(l){return l.id===id;})[0];}
function findHabit(id){return D.habits.filter(function(h){return h.id===id;})[0];}
function findNote(id){return D.notes.filter(function(n){return n.id===id;})[0];}
function listMembers(id){return D.members.filter(function(m){return m.list_id===id;}).map(function(m){return m.user_id;});}
function noteMembers(id){return D.nmembers.filter(function(m){return m.note_id===id;}).map(function(m){return m.user_id;});}
function isShared(l){return l&&(l.owner!==ME||listMembers(l.id).length>0);}

function err(e){console.error(e);toast('Не получилось: '+(e&&e.message?e.message:'ошибка связи'));}
async function q(p){var r=await p;if(r.error)throw r.error;return r.data;}

async function loadAll(){
  var since=addDays(T(),-400);
  var res=await Promise.all([
    q(sb.from('profiles').select('*')),
    q(sb.from('lists').select('*').order('sort').order('created_at')),
    q(sb.from('list_members').select('*')),
    q(sb.from('tasks').select('*').order('created_at')),
    q(sb.from('task_log').select('*').gte('day',since).order('created_at',{ascending:false})),
    q(sb.from('habits').select('*').order('sort').order('created_at')),
    q(sb.from('habit_marks').select('*').gte('day',since)),
    q(sb.from('notes').select('*').order('updated_at',{ascending:false})),
    q(sb.from('templates').select('*').order('created_at')),
    q(sb.from('note_members').select('*')).catch(function(){return [];})
  ]);
  D.profiles=res[0];D.lists=res[1];D.members=res[2];D.tasks=res[3];D.log=res[4];D.habits=res[5];
  D.marks={};res[6].forEach(function(m){(D.marks[m.habit_id]=D.marks[m.habit_id]||{})[m.day]=m.count;});
  D.notes=res[7];D.templates=res[8];D.nmembers=res[9]||[];
  var me=prof(ME);SET=Object.assign(JSON.parse(JSON.stringify(SET_DEF)),(me&&me.settings)||{});SET.def=Object.assign({},SET_DEF.def,SET.def||{});
}
var reloadTimer=null;
function reloadSoon(){clearTimeout(reloadTimer);reloadTimer=setTimeout(function(){loadAll().then(render).catch(function(){});},400);}
var channel=null;
function subscribe(){
  if(channel)sb.removeChannel(channel);
  channel=sb.channel('live')
    .on('postgres_changes',{event:'*',schema:'public',table:'tasks'},function(p){
      if(p.eventType==='DELETE'){D.tasks=D.tasks.filter(function(t){return t.id!==(p.old&&p.old.id);});}
      else{var n=p.new,i=D.tasks.findIndex(function(t){return t.id===n.id;});if(i>=0)D.tasks[i]=n;else D.tasks.push(n);
        if(p.eventType==='INSERT'&&n.assignee===ME&&n.owner!==ME&&n.status==='pending')toast(pname(n.owner)+' прислал(а) задачу: '+n.title);}
      render();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'lists'},reloadSoon)
    .on('postgres_changes',{event:'*',schema:'public',table:'list_members'},reloadSoon)
    .on('postgres_changes',{event:'*',schema:'public',table:'notes'},function(p){
      if(p.eventType==='DELETE'){var gone=p.old&&p.old.id;D.notes=D.notes.filter(function(n){return n.id!==gone;});if(UI.noteId===gone){UI.noteId=null;renderNote();toast('Заметку удалил автор');}render();return;}
      var n=p.new,cur=findNote(n.id);
      if(cur){var typing=UI.noteId===n.id&&document.activeElement&&/^(nt|nb)$/.test(document.activeElement.id);if(!typing){Object.assign(cur,n);if(UI.noteId===n.id)renderNote();}}
      else D.notes.unshift(n);
      if(UI.view==='notes'&&!UI.noteId)render();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'note_members'},function(p){
      if(p.eventType==='INSERT'&&p.new&&p.new.user_id===ME){setTimeout(function(){var n=findNote(p.new.note_id);toast('С тобой поделились заметкой'+(n?': '+(n.title||'без названия'):''));},900);}
      reloadSoon();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'comments'},function(p){
      var c=p.new;if(D.comments[c.task_id]&&!D.comments[c.task_id].some(function(x){return x.id===c.id;})){D.comments[c.task_id].push(c);render();}
    })
    .subscribe();
}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&ME)reloadSoon();});

/* =================== Настройки и тема =================== */
var saveSetTimer=null;
function saveSettings(){applyTheme();clearTimeout(saveSetTimer);saveSetTimer=setTimeout(function(){q(sb.from('profiles').update({settings:SET}).eq('id',ME)).catch(err);},500);}
function lum(hex){var h=hex.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c;}).join('');var r=parseInt(h.substr(0,2),16)/255,g=parseInt(h.substr(2,2),16)/255,b=parseInt(h.substr(4,2),16)/255;function f(c){return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4);}return .2126*f(r)+.7152*f(g)+.0722*f(b);}
function isDark(){return SET.theme==='dark'||(SET.theme==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);}
function applyTheme(){
  var dark=isDark(),root=document.documentElement;root.setAttribute('data-theme',dark?'dark':'light');
  var acc=SET.accent||'#141414';var L;try{L=lum(acc);}catch(e){acc='#141414';L=0;}
  if(dark&&L<0.05){acc='#F2F1EC';L=0.9;}
  if(!dark&&L>0.85){acc='#141414';L=0;}
  root.style.setProperty('--acc',acc);root.style.setProperty('--on-acc',L>0.35?'#141414':'#FFFFFF');
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',dark?'#0D0D0C':'#F6F5F1');
  document.body.classList.toggle('pc',isPC());
}
function isPC(){return SET.layout==='pc'||(SET.layout==='auto'&&window.innerWidth>=960);}
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){if(SET.theme==='auto'){applyTheme();}});
var lastPC=null;window.addEventListener('resize',function(){var p=isPC();if(p!==lastPC){lastPC=p;applyTheme();render();}});

/* =================== Логика задач =================== */
function mineVisible(t){
  if(t.status==='declined')return false;
  if(t.assignee&&t.assignee!==ME)return false;
  if(t.assignee===ME&&t.owner!==ME&&t.status==='pending')return false;
  return true;
}
function inbox(){return D.tasks.filter(function(t){return t.assignee===ME&&t.owner!==ME&&t.status==='pending';});}
function sent(){return D.tasks.filter(function(t){return t.owner===ME&&t.assignee&&t.assignee!==ME;});}
function listOf(t){return t.list_id?findList(t.list_id):null;}
function hiddenTask(t){var l=listOf(t);return !!(l&&l.hidden);}
function groupOf(t){
  if(!t.due_date)return t.done?null:'nodate';
  var d=diff(t.due_date,T());
  if(d<0){if(t.done)return null;return SET.autoMove?'today':'overdue';}
  if(d===0)return'today';if(d===1)return'tomorrow';if(d<7)return'week';return'later';
}
function sorter(a,b){if(a.done!==b.done)return a.done?1:-1;if((b.prio||0)!==(a.prio||0))return (b.prio||0)-(a.prio||0);var x=(a.due_date||'9')+(a.due_time||''),y=(b.due_date||'9')+(b.due_time||'');return x<y?-1:x>y?1:0;}
var WDF=['понедельник','вторник','среду','четверг','пятницу','субботу','воскресенье'];
var ORD={'1':['первый','первую','первое'],'2':['второй','вторую','второе'],'3':['третий','третью','третье'],'4':['четвёртый','четвёртую','четвёртое'],'-1':['последний','последнюю','последнее']};
function addYears(k,n){var b=fromKey(k),y=b.getFullYear()+n,m=b.getMonth(),last=new Date(y,m+1,0).getDate();return keyOf(new Date(y,m,Math.min(b.getDate(),last)));}
function nthWeekday(y,m,wd,n){var k;if(n===-1){k=keyOf(new Date(y,m+1,0));while(dow(k)!==wd)k=addDays(k,-1);return k;}k=keyOf(new Date(y,m,1));while(dow(k)!==wd)k=addDays(k,1);return addDays(k,7*(n-1));}
function nextRule(r,d){r=r||{};var n=Math.max(1,+r.every||1),u=r.unit||'day';
  if(u==='day')return addDays(r.from==='done'?T():d,n);
  if(u==='week'){var days=r.days&&r.days.length?r.days:[dow(d)],anchor=addDays(d,-dow(d)),x=d;for(var i=0;i<800;i++){x=addDays(x,1);var wk=Math.round(diff(addDays(x,-dow(x)),anchor)/7);if(wk%n===0&&days.indexOf(dow(x))>=0)return x;}return addDays(d,7*n);}
  if(u==='month'){var b=fromKey(d),first=new Date(b.getFullYear(),b.getMonth()+n,1),fy=first.getFullYear(),fm=first.getMonth(),last=new Date(fy,fm+1,0).getDate();
    if(r.mode==='last')return keyOf(new Date(fy,fm,last));
    if(r.mode==='nth')return nthWeekday(fy,fm,+r.wd||0,+r.nth||1);
    return keyOf(new Date(fy,fm,Math.min(+r.mday||b.getDate(),last)));}
  if(u==='year')return addYears(d,n);
  return addDays(d,1);}
function ruleText(r,due){r=r||{};var n=Math.max(1,+r.every||1),u=r.unit||'day';
  if(u==='day')return (n===1?'каждый день':'каждые '+n+' '+plural(n,'день','дня','дней'))+(r.from==='done'?' после выполнения':'');
  if(u==='week')return (n===1?'каждую неделю':'каждые '+n+' '+plural(n,'неделю','недели','недель'))+': '+(r.days&&r.days.length?r.days:[due?dow(due):0]).slice().sort().map(function(i){return WD[i];}).join(', ');
  if(u==='month'){var p=n===1?'каждый месяц':'каждые '+n+' '+plural(n,'месяц','месяца','месяцев');
    if(r.mode==='last')return p+', в последний день';
    if(r.mode==='nth'){var wd=+r.wd||0,g=[0,0,1,0,1,1,2][wd],o=(ORD[String(r.nth||1)]||ORD['1'])[g];return p+', '+(String(r.nth)==='2'?'во':'в')+' '+o+' '+WDF[wd];}
    return p+', '+(+r.mday||(due?fromKey(due).getDate():1))+'-го числа';}
  if(u==='year')return (n===1?'каждый год':'раз в '+n+' '+plural(n,'год','года','лет'))+(due?', '+fmtDM(due):'');
  return '';}
function recurText(t){
  if(t.recur==='custom')return ruleText(t.rule,t.due_date);
  if(t.recur==='yearly')return 'каждый год'+(t.due_date?', '+fmtDM(t.due_date):'');
  if(t.recur==='weekly'&&t.due_date)return 'каждую неделю: '+WD[dow(t.due_date)];
  if(t.recur==='monthly'&&t.due_date)return 'каждый месяц, '+fromKey(t.due_date).getDate()+'-го числа';
  switch(t.recur){case'hourly':return'каждый час';case'daily':return'каждый день';case'weekdays':return'по будням';case'weekly':return'раз в неделю';case'monthly':return'раз в месяц';
    case'everyN':return'каждые '+t.recur_n+' '+plural(t.recur_n,'день','дня','дней');case'days':return (t.recur_days||[]).slice().sort().map(function(i){return WD[i];}).join(', ');}
  return'';
}
var RECUR=[['none','Не повторять'],['hourly','Каждый час'],['daily','Каждый день'],['weekdays','По будням'],['days','По дням недели'],['everyN','Каждые N дней'],['weekly','Каждую неделю'],['monthly','Каждый месяц']];
function remindAll(t){var x=(t.remind_at||[]).slice().sort();if(!t.due_date)return x.length?'Каждый день в '+x.join(', ')+', пока не выполню':'Нет';var a=t.due_time?remindText(t.remind_every,t.remind_times):'';if(x.length)a=(a?a+'; ':'')+'ещё в '+x.join(', ');return a||'Нет';}
function remindText(e,n){if(!e)return'Одно напоминание';if(!n)return'Каждые '+e+' мин, пока не выполню';return n+' '+plural(n,'раз','раза','раз')+' с шагом '+e+' мин';}
function nextOcc(t){
  var today=T(),d=t.due_date,tm=t.due_time,r=t.recur,guard=0;
  function step(){
    if(r==='hourly'){var h=parseInt(tm||'09',10)+1;if(h>parseInt(SET.hours.to,10)){d=addDays(d,1);tm=SET.hours.from;}else tm=pad(h)+':'+(tm||'09:00').slice(3);}
    else if(r==='daily')d=addDays(d,1);
    else if(r==='weekdays'){d=addDays(d,1);while(dow(d)>4)d=addDays(d,1);}
    else if(r==='days'){var s=t.recur_days&&t.recur_days.length?t.recur_days:[0,1,2,3,4,5,6];d=addDays(d,1);var g=0;while(s.indexOf(dow(d))<0&&g++<8)d=addDays(d,1);}
    else if(r==='everyN')d=addDays(d,Math.max(1,t.recur_n||2));
    else if(r==='weekly')d=addDays(d,7);
    else if(r==='yearly')d=addYears(d,1);
    else if(r==='custom')d=nextRule(t.rule,d);
    else if(r==='monthly'){var x=fromKey(d),day=x.getDate(),y=new Date(x.getFullYear(),x.getMonth()+1,1),last=new Date(y.getFullYear(),y.getMonth()+1,0).getDate();y.setDate(Math.min(day,last));d=keyOf(y);}
  }
  step();while(r!=='hourly'&&d<today&&guard++<600)step();
  return{due_date:d,due_time:tm};
}
async function patchTask(id,fields){
  var t=findTask(id);if(!t)return;var before=Object.assign({},t);Object.assign(t,fields);render();
  try{var row=await q(sb.from('tasks').update(fields).eq('id',id).select().single());Object.assign(t,row);render();}
  catch(e){Object.assign(t,before);render();err(e);}
  return before;
}
var CHEERS=['Готово','Отлично','Сделано','Так держать','Плюс одно дело'];
async function completeTask(id){
  var t=findTask(id);if(!t)return;var before=Object.assign({},t);var fields;var msg;
  if(t.recur!=='none'&&t.due_date){var n=nextOcc(t);fields={due_date:n.due_date,due_time:n.due_time,subs:(t.subs||[]).map(function(s){return Object.assign({},s,{done:false});})};msg='Следующий раз: '+dayWord(n.due_date).toLowerCase()+(n.due_time?' в '+n.due_time:'');}
  else{fields={done:true,done_at:new Date().toISOString(),done_by:ME};msg=SET.rewards?leftMsg(id):'Выполнено';}
  var logRow=null;
  patchTask(id,fields);
  try{logRow=await q(sb.from('task_log').insert({task_id:t.id,list_id:t.list_id,title:t.title,day:T()}).select().single());D.log.unshift(logRow);render();}catch(e){err(e);}
  toast((SET.rewards?CHEERS[Math.floor(Math.random()*CHEERS.length)]+'. ':'')+msg,function(){
    patchTask(id,{done:before.done,done_at:before.done_at,done_by:before.done_by,due_date:before.due_date,due_time:before.due_time,subs:before.subs});
    if(logRow){D.log=D.log.filter(function(l){return l.id!==logRow.id;});sb.from('task_log').delete().eq('id',logRow.id).then(function(){});}
  });
}
function leftMsg(exceptId){var n=myTasks().filter(function(t){return t.id!==exceptId&&!t.done&&groupOf(t)==='today';}).length;return n?'На сегодня осталось '+n:'На сегодня всё сделано';}
async function reopenTask(id){
  await patchTask(id,{done:false,done_at:null,done_by:null});
  var l=D.log.filter(function(x){return x.task_id===id;})[0];
  if(l){D.log=D.log.filter(function(x){return x!==l;});sb.from('task_log').delete().eq('id',l.id).then(function(){});}
  render();toast('Задача снова в работе');
}
async function createTask(data){
  var row=Object.assign({owner:ME,title:'',status:'active',remind_every:0,remind_times:0,recur:'none',recur_n:2,recur_days:[],prio:0,subs:[]},data);
  try{var r=await q(sb.from('tasks').insert(row).select().single());if(!findTask(r.id))D.tasks.push(r);render();return r;}catch(e){err(e);}
}
async function deleteTask(id){
  var t=findTask(id);if(!t)return;var i=D.tasks.indexOf(t);D.tasks.splice(i,1);if(UI.sel===id)UI.sel=null;closeSheet();render();
  try{await q(sb.from('tasks').delete().eq('id',id));toast('Задача удалена',function(){var c=Object.assign({},t);createTask(c);});}
  catch(e){D.tasks.splice(i,0,t);render();err(e);}
}
function myTasks(){return D.tasks.filter(mineVisible);}

/* быстрый ввод: «завтра в 19:00 купить хлеб» */
function parseQuick(s){
  var t=s.trim(),date=null,time=null,m,rec=null,rule=null;
  var DAYRE=['понедельник','вторник','сред[ау]','четверг','пятниц[ау]','суббот[ау]','воскресенье'];
  DAYRE.forEach(function(w,i){var re=new RegExp('(^|\\s)(каждый|каждую|каждое|по)\\s+'+w.replace('[ау]','[аы]?[уа]?').replace('понедельник','понедельник(ам)?')+'(?=\\s|$)','i');if(!rec&&re.test(t)){rec='custom';rule={unit:'week',every:1,days:[i],mode:'date',nth:1,wd:i,from:'date'};var d=T(),g=0;while(dow(d)!==i&&g++<8)d=addDays(d,1);date=d;t=t.replace(re,' ');}});
  [['каждый день','daily'],['ежедневно','daily'],['по будням','weekdays'],['каждую неделю','weekly'],['каждый месяц','monthly'],['каждый год','yearly'],['каждый час','hourly']].forEach(function(p){var re=new RegExp('(^|\\s)'+p[0]+'(?=\\s|$)','i');if(!rec&&re.test(t)){rec=p[1];t=t.replace(re,' ');}});
  m=t.match(/(^|\s)кажды[ей]\s+(\d+)\s+(дн[яей]*|недел[иья]*|месяц[аев]*)(?=\s|$)/i);
  if(!rec&&m){var nn=+m[2],u=/^дн/i.test(m[3])?'day':/^нед/i.test(m[3])?'week':'month';rec='custom';rule={unit:u,every:nn,days:[],mode:'date',nth:1,wd:0,from:'date'};if(u==='week')rule.days=[dow(T())];t=t.replace(m[0],' ');}
  var words={'сегодня':0,'завтра':1,'послезавтра':2};
  Object.keys(words).sort(function(a,b){return b.length-a.length;}).forEach(function(w){var re=new RegExp('(^|\\s)'+w+'(?=\\s|$)','i');if(re.test(t)){date=addDays(T(),words[w]);t=t.replace(re,' ');}});
  var days=['понедельник','вторник','сред[ау]','четверг','пятниц[ау]','суббот[ау]','воскресенье'];
  days.forEach(function(w,i){var re=new RegExp('(^|\\s)(в|во)?\\s?'+w+'(?=\\s|$)','i');if(!date&&re.test(t)){var d=T(),g=0;do{d=addDays(d,1);}while(dow(d)!==i&&g++<8);date=d;t=t.replace(re,' ');}});
  var NUMW={'час':1,'один':1,'одиннадцать':11,'два':2,'двенадцать':12,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,'десять':10};
  t=t.replace(/(^|\s)(одиннадцать|двенадцать|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)(?=\s+(утра|дня|вечера|ночи|часов|часа)(\s|$))/gi,function(x,p,w){return p+NUMW[w.toLowerCase()];});
  m=t.match(/(^|\s)(в|к|до)?\s?(\d{1,2})(?:[:.](\d{2}))?\s+(утра|дня|вечера|ночи)(?=\s|$)/i);
  if(m){var hh=+m[3],mm=m[4]?+m[4]:0,part=m[5].toLowerCase();if((part==='вечера'||part==='дня')&&hh<12)hh+=12;if(part==='ночи'&&hh===12)hh=0;if(hh<24&&mm<60){time=pad(hh)+':'+pad(mm);t=t.replace(m[0],' ');}}
  if(!time)m=t.match(/(^|\s)(в|к|до)?\s?([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s|$)/i);else m=null;
  if(m){time=pad(+m[3])+':'+m[4];t=t.replace(m[0],' ');}
  else if(!time){m=t.match(/(^|\s)(в|к|до)\s([01]?\d|2[0-3])(?=\s|$)/i);if(m){time=pad(+m[3])+':00';t=t.replace(m[0],' ');}}
  if(time&&!date)date=time>nowHM()?T():addDays(T(),1);
  t=t.replace(/\s+/g,' ').trim();
  return{title:cap(t),due_date:date,due_time:time,remind_every:time?+SET.def.every||0:0,remind_times:time?+SET.def.times||0:0,recur:rec||'none',rule:rule||{}};
}

/* =================== Привычки =================== */
function tgt(h){return Math.max(1,h.target||1);}
function cnt(h,d){return (D.marks[h.id]||{})[d]||0;}
function hDone(h,d){return cnt(h,d)>=tgt(h);}
function sched(h,d){return !h.days||!h.days.length||h.days.indexOf(dow(d))>=0;}
function streak(h){var d=T(),n=0,g=0;if(sched(h,d)&&!hDone(h,d))d=addDays(d,-1);while(d>=h.started_on&&g++<800){if(sched(h,d)){if(hDone(h,d))n++;else break;}d=addDays(d,-1);}return n;}
function pct(h){var d=h.started_on,t=T(),a=0,o=0,g=0;if(diff(t,d)>400)d=addDays(t,-400);while(d<=t&&g++<420){if(sched(h,d)){a++;if(hDone(h,d))o++;}d=addDays(d,1);}return a?Math.round(o*100/a):0;}
function totalDone(h){var m=D.marks[h.id]||{};return Object.keys(m).filter(function(d){return m[d]>=tgt(h);}).length;}
async function setMark(h,day,val){
  if(diff(day,T())>0)return;val=Math.max(0,Math.min(val,tgt(h)));
  var m=D.marks[h.id]=D.marks[h.id]||{};var before=m[day]||0;
  if(val)m[day]=val;else delete m[day];render();
  try{if(val)await q(sb.from('habit_marks').upsert({habit_id:h.id,day:day,count:val}));else await q(sb.from('habit_marks').delete().eq('habit_id',h.id).eq('day',day));}
  catch(e){if(before)m[day]=before;else delete m[day];render();err(e);}
  return before;
}
function daysText(h){if(!h.days||!h.days.length)return'каждый день';if(h.days.length===5&&h.days.indexOf(5)<0&&h.days.indexOf(6)<0)return'по будням';return h.days.slice().sort().map(function(i){return WD[i];}).join(', ');}

/* =================== Уведомления =================== */
var PUSH={state:'?'};
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function isStandalone(){return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;}
function urlB64(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
async function pushCheck(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){PUSH.state=isIOS()&&!isStandalone()?'ios-install':'unsupported';return;}
    if(Notification.permission==='denied'){PUSH.state='denied';return;}
    var reg=await navigator.serviceWorker.getRegistration();var sub=reg&&await reg.pushManager.getSubscription();PUSH.state=sub?'on':'off';
  }catch(e){PUSH.state='unsupported';}
}
function pushBlock(){
  var st=PUSH.state,txt={on:'Включены на этом устройстве.',off:'На этом устройстве выключены.',denied:'Уведомления запрещены в настройках браузера или телефона. Разреши их для этого сайта и обнови страницу.','ios-install':'На iPhone уведомления работают, только если сайт добавлен на экран «Домой»: в Safari «Поделиться» → «На экран „Домой“», потом открой сайт с этой иконки и включи уведомления здесь.',unsupported:'Этот браузер не поддерживает уведомления.','?':'Проверяю…'}[st]||'';
  var h='<div class="rulebox"><div class="gl" style="margin:0;font-size:15px;color:var(--ink)">Уведомления</div><div style="font-size:14px;line-height:1.45">'+txt+'</div>';
  if(st==='off')h+='<button class="btn" data-a="pushOn">'+I('bell')+'Включить на этом устройстве</button>';
  if(st==='on')h+='<div class="row2"><button class="btn2" data-a="pushTest">'+I('bell')+'Проверить</button><button class="btn2 warn" data-a="pushOff">Выключить здесь</button></div>';
  return h+'<div class="gh" style="margin:0">Включи на каждом устройстве отдельно: на телефоне и на компьютере.</div></div>';
}
async function pushEnable(){
  try{
    var perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('Без разрешения уведомления не придут');await pushCheck();renderSheet();return;}
    var reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    var r=await fetch(PUSH_URL+'?action=vapid',{headers:{apikey:SUPA_KEY}});var j=await r.json();if(!j.publicKey)throw new Error(j.error||'функция push не ответила');
    var sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64(j.publicKey)});
    var k=sub.toJSON();
    await q(sb.from('push_subs').upsert({user_id:ME,endpoint:k.endpoint,p256dh:k.keys.p256dh,auth:k.keys.auth,ua:navigator.userAgent.slice(0,200)},{onConflict:'endpoint'}));
    toast('Уведомления включены');
  }catch(e){err(e);}
  await pushCheck();renderSheet();
}
async function pushDisable(){
  try{var reg=await navigator.serviceWorker.getRegistration();var sub=reg&&await reg.pushManager.getSubscription();
    if(sub){await q(sb.from('push_subs').delete().eq('endpoint',sub.endpoint));await sub.unsubscribe();}toast('Уведомления на этом устройстве выключены');}catch(e){err(e);}
  await pushCheck();renderSheet();
}
async function pushTest(){
  try{var r=await sb.functions.invoke('push',{body:{action:'test'}});
    if(r.error){var m=r.error.message;try{var j=await r.error.context.json();if(j&&j.error)m=j.error;}catch(x){}throw new Error(m);}
    toast('Отправлено на устройств: '+(r.data.delivered||0)+' из '+(r.data.devices||0));
  }catch(e){err(e);}
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(function(){});
  navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.open&&ME&&findTask(e.data.open))openTask(e.data.open);});
}

/* =================== Тост =================== */
var undoFn=null,toastT=null;
function toast(text,undo){
  var el=document.getElementById('toast');if(!el)return;
  el.querySelector('span').textContent=text;undoFn=undo||null;el.querySelector('button').style.display=undo?'':'none';
  el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove('show');undoFn=null;},4000);
}

/* =================== Вход =================== */
function authScreen(mode,msg){
  applyTheme();
  var app=document.getElementById('app');
  var logo='<div class="logo"><b>'+I('check')+'</b>задачи</div>';
  if(mode==='setpass'){
    app.innerHTML='<div class="auth"><form id="f-setpass">'+logo+'<h1>'+(FROM_RECOVERY?'Новый пароль':'Добро пожаловать')+'</h1><div class="muted">'+(FROM_RECOVERY?'Придумай новый пароль для входа.':'Тебя пригласили. Придумай имя и пароль, чтобы входить с любого устройства.')+'</div>'+(FROM_RECOVERY?'':'<label>Как тебя зовут<input class="fld" name="uname" autocomplete="name" required></label>')+'<label>Пароль, минимум 8 символов<input class="fld" name="pass" type="password" autocomplete="new-password" minlength="8" required></label><div class="err" id="aerr"></div><button class="btn" type="submit">Сохранить и войти</button></form></div>';
    document.getElementById('f-setpass').addEventListener('submit',async function(e){e.preventDefault();var f=e.target,b=f.querySelector('button');b.disabled=true;
      var un=f.elements.namedItem('uname');
      try{await q(sb.auth.updateUser({password:f.elements.namedItem('pass').value}));
        if(un){await q(sb.from('profiles').update({name:un.value.trim()}).eq('id',ME));}
        FROM_INVITE=false;FROM_RECOVERY=false;history.replaceState(null,'',location.pathname);start();
      }catch(x){document.getElementById('aerr').textContent=x.message||'Ошибка';b.disabled=false;}});
    return;
  }
  if(mode==='reset'){
    app.innerHTML='<div class="auth"><form id="f-reset">'+logo+'<h1>Сброс пароля</h1><div class="muted">Пришлём письмо со ссылкой, по которой можно задать новый пароль.</div><label>Почта<input class="fld" name="email" type="email" autocomplete="email" required></label><div class="err" id="aerr">'+(msg||'')+'</div><button class="btn" type="submit">Отправить письмо</button><button class="link" type="button" data-a="toLogin">Вернуться ко входу</button></form></div>';
    document.getElementById('f-reset').addEventListener('submit',async function(e){e.preventDefault();var f=e.target;
      try{await q(sb.auth.resetPasswordForEmail(f.elements.namedItem('email').value.trim(),{redirectTo:location.origin+location.pathname}));document.getElementById('aerr').textContent='Письмо отправлено, проверь почту.';}
      catch(x){document.getElementById('aerr').textContent=x.message;}});
    return;
  }
  app.innerHTML='<div class="auth"><form id="f-login">'+logo+'<h1>Вход</h1><div class="muted">Сервис работает по приглашениям. Если приглашения нет, попроси его у владельца.</div><label>Почта<input class="fld" name="email" type="email" autocomplete="email" required></label><label>Пароль<input class="fld" name="pass" type="password" autocomplete="current-password" required></label><div class="err" id="aerr">'+esc(msg||'')+'</div><button class="btn" type="submit">Войти</button><button class="link" type="button" data-a="toReset">Забыли пароль?</button></form></div>';
  document.getElementById('f-login').addEventListener('submit',async function(e){e.preventDefault();var f=e.target,b=f.querySelector('.btn');b.disabled=true;
    try{await q(sb.auth.signInWithPassword({email:f.elements.namedItem('email').value.trim(),password:f.elements.namedItem('pass').value}));}
    catch(x){document.getElementById('aerr').textContent=/Invalid login/i.test(x.message)?'Неверная почта или пароль':x.message;b.disabled=false;}});
}

/* =================== Отрисовка: общие куски =================== */
function habitsRow(){
  var hs=D.habits.filter(function(h){return !h.finished;}),t=T();
  var out='<div class="habits" aria-label="Привычки">';
  hs.forEach(function(h){
    var c=cnt(h,t),g=tgt(h),done=c>=g,today=sched(h,t),lab=h.paused?'пауза':!today?'отдых':c+'/'+g;
    var ring='';if(!done){var r=25,C=2*Math.PI*r,fr=c/g;ring='<svg class="bg" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="2.5"/>'+(fr>0?'<circle cx="28" cy="28" r="'+r+'" fill="none" stroke="'+esc(h.color)+'" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="'+(C*fr).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 28 28)"/>':'')+'</svg>';}
    out+='<div class="hab"><button class="ring'+(done?' done':'')+(h.paused||!today?' off':'')+'" style="--hc:'+esc(h.color)+'" data-a="habTap" data-lp="habit" data-id="'+h.id+'" aria-label="'+esc(h.name)+', '+lab+'">'+ring+I(h.icon)+'</button><div class="nm">'+esc(h.name)+'<b>'+lab+'</b></div></div>';
  });
  out+='<div class="hab add"><button class="ring" data-a="habNew" aria-label="Новая привычка">'+I('plus')+'</button><div class="nm">Новая</div></div></div>';
  return out;
}
function taskRow(t,g){
  var today=T(),over=t.due_date&&!t.done&&t.due_date<today,moved=over&&g==='today';
  var m=[];
  if(t.due_time){var tx=(g==='today'||g==='tomorrow')&&!over?t.due_time:(fmtShort(t.due_date)+', '+t.due_time);m.push('<span class="'+(over?'over':'tm')+'">'+tx+'</span>');}
  else if(over)m.push('<span class="over">'+(moved?'с '+fmtDM(t.due_date):fmtShort(t.due_date))+'</span>');
  else if(t.due_date&&g!=='today'&&g!=='tomorrow')m.push('<span>'+fmtShort(t.due_date)+'</span>');
  var l=listOf(t);if(l&&UI.filter==='all')m.push('<span><i class="dot" style="--c:'+esc(l.color)+'"></i>'+esc(l.name)+'</span>');
  if(t.subs&&t.subs.length)m.push('<span>'+I('list')+t.subs.filter(function(s){return s.done;}).length+'/'+t.subs.length+'</span>');
  if(t.recur!=='none')m.push('<span>'+I('repeat')+esc(recurText(t))+'</span>');
  if(((t.remind_every&&t.due_time)||(t.remind_at&&t.remind_at.length))&&!t.done)m.push('<span aria-label="Напоминания">'+I('bell')+'</span>');
  if(t.owner!==ME)m.push('<span>'+I('users')+'от '+esc(pname(t.owner))+'</span>');
  if(t.assignee&&t.assignee!==ME)m.push('<span>'+I('send')+esc(pname(t.assignee))+' · '+(t.status==='pending'?'ждёт':t.status==='declined'?'отклонено':t.done?'сделано':'принято')+'</span>');
  if(t.done&&t.done_by&&t.done_by!==ME)m.push('<span>сделал(а) '+esc(pname(t.done_by))+'</span>');
  var pr=t.prio?'<span class="prio p'+t.prio+'" aria-label="Приоритет '+t.prio+'"></span>':'';
  return '<div class="task'+(UI.sel===t.id?' sel':'')+'" data-swipe="'+t.id+'"><button class="chk'+(t.done?' on':'')+(over&&!moved?' over':'')+'" data-a="chk" data-id="'+t.id+'" aria-label="'+(t.done?'Вернуть в работу: ':'Выполнено: ')+esc(t.title)+'"><span>'+(t.done?I('check'):'')+'</span></button><button class="tb" data-a="open" data-lp="move" data-id="'+t.id+'"><span class="tt'+(t.done?' done':'')+'">'+esc(t.title)+'</span>'+(m.length&&!t.done?'<span class="meta">'+m.join('')+'</span>':'')+'</button>'+pr+'</div>';
}
function sec(title,n,warn){return '<div class="sec'+(warn?' warn':'')+'"><h2>'+title+'</h2>'+(n?'<span class="n">'+n+'</span>':'')+'</div>';}
function filterChips(){
  var out='<div class="chipsrow"><button class="fchip'+(UI.filter==='all'?' on':'')+'" data-a="filter" data-v="all">Все</button>';
  D.lists.forEach(function(l){out+='<button class="fchip'+(UI.filter===l.id?' on':'')+'" data-a="filter" data-v="'+l.id+'"><i class="dot" style="--c:'+esc(l.color)+'"></i>'+esc(l.name)+(l.hidden?' '+I('eyeoff'):'')+(isShared(l)?' '+I('users'):'')+'</button>';});
  return out+'<button class="fchip" data-a="lists">'+I('plus')+'Списки</button></div>';
}
function tasksView(){
  var fl=UI.filter!=='all'?findList(UI.filter):null;if(UI.filter!=='all'&&!fl)UI.filter='all';
  var ts=myTasks().filter(function(t){return UI.filter==='all'?!hiddenTask(t):t.list_id===UI.filter;});
  var groups={};ts.forEach(function(t){var g=groupOf(t);if(g)(groups[g]=groups[g]||[]).push(t);});
  var todays=groups.today||[],openN=todays.filter(function(t){return !t.done;}).length;
  var out='<div class="top"><div><div class="date">'+fmtLong(T())+'</div><h1 class="dh">'+(fl?esc(fl.name):'Задачи')+'</h1></div>'+(isPC()?'':'<button class="iconbtn" data-a="settings" aria-label="Настройки">'+I('gear')+'</button>')+'</div>';
  out+='<form class="quick" id="quick" autocomplete="off"><span class="muted">'+I('plus')+'</span><input id="qin" placeholder="Новая задача, например «завтра в 19:00 купить хлеб»" aria-label="Быстро добавить задачу" value="'+esc(UI.quick)+'">'+micBtn('q')+'<button class="iconbtn" type="button" data-a="add" aria-label="Подробнее">'+I('edit')+'</button></form>';
  if(!fl)out+=habitsRow();
  out+=filterChips();
  var names={overdue:'Просрочено',tomorrow:'Завтра',week:'На неделе',later:'Потом',nodate:fl&&fl.hidden?'В списке':'Без срока'};
  if(!fl||todays.length){out+=sec('Сегодня',todays.length?(todays.length-openN)+' из '+todays.length:'');
    if(!openN&&!fl)out+='<div class="alldone">'+I('award')+'<div>Все задачи на сегодня выполнены.<br>Можно отдыхать.</div></div>';
    todays.sort(sorter).forEach(function(t){out+=taskRow(t,'today');});}
  ['overdue','tomorrow','week','later','nodate'].forEach(function(g){var it=groups[g];if(!it)return;out+=sec(names[g],'',g==='overdue');it.sort(sorter).forEach(function(t){out+=taskRow(t,g);});});
  if(fl&&!ts.length)out+='<div class="empty">В списке пока пусто.</div>';
  if(fl){out+='<div class="hint"><button class="link" data-a="listEdit" data-id="'+fl.id+'">Настроить список</button>'+(fl.hidden?' · скрытый список: его задачи не видны во «Все»':'')+'</div>';}
  return out;
}
function inboxView(){
  var inc=inbox(),out=sent();
  var h='<div class="top"><div><div class="date">'+fmtLong(T())+'</div><h1 class="dh">Входящие</h1></div></div>';
  h+=sec('Прислали тебе',inc.length?String(inc.length):'');
  if(!inc.length)h+='<div class="empty">Новых задач нет.</div>';
  inc.forEach(function(t){h+='<div class="task"><div class="tb" style="padding-left:0"><span class="tt">'+esc(t.title)+'</span><span class="meta"><span>'+I('users')+'от '+esc(pname(t.owner))+'</span>'+(t.due_date?'<span class="tm">'+dayWord(t.due_date)+(t.due_time?' в '+t.due_time:'')+'</span>':'')+'</span><span class="row2" style="margin-top:8px;max-width:360px"><button class="btn" style="height:40px" data-a="accept" data-id="'+t.id+'">Принять</button><button class="btn2" data-a="decline" data-id="'+t.id+'">Отклонить</button><button class="btn2" data-a="open" data-id="'+t.id+'">Открыть</button></span></div></div>';});
  h+=sec('Отправленные','');
  if(!out.length)h+='<div class="empty">Ты пока никому не отправлял задачи. Открой задачу и нажми «Отправить».</div>';
  out.sort(sorter).forEach(function(t){h+=taskRow(t,groupOf(t)||'later');});
  return h;
}

/* календарь */
function tasksOn(k){return myTasks().filter(function(t){return t.due_date===k&&!hiddenTask(t);}).sort(sorter);}
function logOn(k){return D.log.filter(function(l){return l.day===k&&l.user_id===ME;});}
function habitsDoneOn(k){return D.habits.filter(function(h){return hDone(h,k);});}
function calView(){
  var k=UI.calDay,t=T(),mode=UI.cal;
  var modes=[['day','День'],['week','Неделя'],['month','Месяц'],['year','Год']];
  var h='<div class="top"><div><div class="date">'+fmtLong(t)+'</div><h1 class="dh">Календарь</h1></div></div>';
  var label=mode==='day'?fmtLong(k):mode==='week'?fmtDM(addDays(k,-dow(k)))+' – '+fmtDM(addDays(k,6-dow(k))):mode==='month'?fmt(k,{month:'long',year:'numeric'}):String(fromKey(k).getFullYear());
  h+='<div class="calnav"><div class="pills" role="tablist">'+modes.map(function(m){return '<button role="tab" aria-selected="'+(m[0]===mode)+'" class="'+(m[0]===mode?'on':'')+'" data-a="calMode" data-v="'+m[0]+'">'+m[1]+'</button>';}).join('')+'</div><div style="display:flex;align-items:center;gap:4px"><button class="iconbtn" data-a="calNav" data-v="-1" aria-label="Назад">'+I('left')+'</button><button class="btn2" style="height:36px" data-a="calToday">Сегодня</button><button class="iconbtn" data-a="calNav" data-v="1" aria-label="Вперёд">'+I('right')+'</button></div></div>';
  h+='<div class="calnav" style="margin-top:10px"><b>'+esc(label)+'</b></div>';
  if(mode==='day'){
    var mon=addDays(k,-dow(k));h+='<div class="week">';
    for(var i=0;i<7;i++){var d=addDays(mon,i),busy=tasksOn(d).length||logOn(d).length;h+='<button class="wd'+(d===t?' today':'')+(d===k?' sel':'')+'" data-a="calPick" data-v="'+d+'" aria-label="'+fmtLong(d)+'"><small>'+WD[i]+'</small><b>'+fromKey(d).getDate()+'</b><i class="'+(busy?'y':'')+'"></i></button>';}
    h+='</div>';
    var hs=D.habits.filter(function(x){return !x.finished&&x.started_on<=k&&sched(x,k);});
    if(hs.length&&k<=t){h+=sec('Привычки','');hs.forEach(function(x){var on=hDone(x,k);h+='<div class="task"><button class="chk'+(on?' on':'')+'" data-a="habDay" data-id="'+x.id+'" data-v="'+k+'" aria-label="'+esc(x.name)+'"><span style="'+(on?'background:'+esc(x.color)+';border-color:'+esc(x.color):'')+'">'+(on?I('check'):'')+'</span></button><div class="tb"><span class="tt">'+esc(x.name)+'</span>'+(tgt(x)>1?'<span class="meta"><span>'+cnt(x,k)+' из '+tgt(x)+'</span></span>':'')+'</div></div>';});}
    var ts=tasksOn(k),lg=logOn(k);
    if(ts.length){h+=sec('Запланировано','');ts.forEach(function(x){h+=taskRow(x,k<t?'overdue':k===t?'today':'later');});}
    if(lg.length){h+=sec('Сделано','');lg.forEach(function(l){h+='<div class="drow"><span class="b">'+I('check')+'</span>'+esc(l.title)+'<span class="at">'+new Date(l.created_at).toTimeString().slice(0,5)+'</span></div>';});}
    if(!hs.length&&!ts.length&&!lg.length)h+='<div class="empty">На этот день ничего нет.</div>';
  }else if(mode==='week'){
    var m0=addDays(k,-dow(k));h+='<div class="wcols">';
    for(var j=0;j<7;j++){var dd=addDays(m0,j);h+='<div class="wcol"><h4 class="'+(dd===t?'t':'')+'"><button data-a="calPickDay" data-v="'+dd+'">'+WD[j]+', '+fromKey(dd).getDate()+'</button></h4>'+tasksOn(dd).map(function(x){return '<button class="it'+(x.done?' d':'')+'" data-a="open" data-id="'+x.id+'">'+(x.due_time?x.due_time+' ':'')+esc(x.title)+'</button>';}).join('')+logOn(dd).filter(function(l){return !tasksOn(dd).some(function(x){return x.id===l.task_id;});}).map(function(l){return '<div class="it d">'+esc(l.title)+'</div>';}).join('')+'</div>';}
    h+='</div>';
  }else if(mode==='month'){
    var ms=monthStart(k),st=addDays(ms,-dow(ms)),mm=fromKey(ms).getMonth();h+='<div class="month">'+WD.map(function(w){return '<div class="h">'+w+'</div>';}).join('');
    for(var c=0;c<42;c++){var dk=addDays(st,c);if(c>=35&&fromKey(dk).getMonth()!==mm)break;var tl=tasksOn(dk),n=tl.length+logOn(dk).length;
      h+='<button class="'+(fromKey(dk).getMonth()!==mm?'out ':'')+(dk===t?'today':'')+'" data-a="calPickDay" data-v="'+dk+'" aria-label="'+fmtLong(dk)+'"><b>'+fromKey(dk).getDate()+'</b>'+tl.slice(0,2).map(function(x){return '<small>'+esc(x.title)+'</small>';}).join('')+(n>2?'<small>ещё '+(n-2)+'</small>':'')+'</button>';}
    h+='</div>';
  }else{
    var y=fromKey(k).getFullYear();h+='<div class="year">';
    for(var mo=0;mo<12;mo++){var f=keyOf(new Date(y,mo,1)),last=new Date(y,mo+1,0).getDate();h+='<div class="ym"><h4>'+fmt(f,{month:'long'})+'</h4><div class="g">';
      for(var e=0;e<dow(f);e++)h+='<span class="e"></span>';
      for(var dd2=1;dd2<=last;dd2++){var kk=keyOf(new Date(y,mo,dd2)),sc=logOn(kk).length+habitsDoneOn(kk).length,lv=sc===0?'':sc<2?'l1':sc<4?'l2':'l3';h+='<span class="'+lv+(kk===t?' t':'')+'" title="'+fmtDM(kk)+': '+sc+'"></span>';}
      h+='</div></div>';}
    h+='</div><div class="hint">Чем темнее день, тем больше сделано задач и привычек</div>';
  }
  return h;
}
function diaryView(){
  var days={};
  D.log.filter(function(l){return l.user_id===ME;}).forEach(function(l){(days[l.day]=days[l.day]||[]).push({t:l.title,at:new Date(l.created_at).toTimeString().slice(0,5)});});
  D.habits.forEach(function(h){var m=D.marks[h.id]||{};Object.keys(m).forEach(function(d){if(m[d]>=tgt(h))(days[d]=days[d]||[]).push({t:h.name,at:'',c:h.color});});});
  var keys=Object.keys(days).sort().reverse();
  var h='<div class="top"><div><div class="date">'+fmtLong(T())+'</div><h1 class="dh">Дневник</h1></div></div>';
  if(!keys.length)return h+'<div class="empty">Здесь по дням будут выполненные задачи и привычки.</div>';
  keys.slice(0,90).forEach(function(k){var d=diff(k,T());h+='<div class="dday">'+(d===0?'Сегодня':d===-1?'Вчера':fmtDM(k))+'</div>';days[k].forEach(function(x){h+='<div class="drow"><span class="b"'+(x.c?' style="background:'+esc(x.c)+'"':'')+'>'+I('check')+'</span>'+esc(x.t)+'<span class="at">'+x.at+'</span></div>';});});
  return h;
}
function habitsView(){
  var h='<div class="top"><div><div class="date">'+fmtLong(T())+'</div><h1 class="dh">Привычки</h1></div><button class="btn2" data-a="habNew">'+I('plus')+'Новая</button></div>';
  var hs=D.habits.filter(function(x){return !x.finished;});
  if(!hs.length)return h+'<div class="empty">Привычек пока нет. Нажми «Новая».</div>';
  var t=T(),mon=addDays(t,-6);
  hs.forEach(function(x){h+='<div class="task" style="align-items:center"><button class="tb" data-a="habOpen" data-id="'+x.id+'"><span class="tt" style="display:flex;align-items:center;gap:10px"><span style="color:'+esc(x.color)+'">'+I(x.icon)+'</span>'+esc(x.name)+'</span><span class="meta"><span>'+daysText(x)+'</span><span>'+streak(x)+' '+plural(streak(x),'день','дня','дней')+' подряд</span>'+(x.paused?'<span>на паузе</span>':'')+'</span></button><div style="display:flex;gap:4px">';
    for(var i=0;i<7;i++){var d=addDays(mon,i),on=hDone(x,d);h+='<button data-a="habDay" data-id="'+x.id+'" data-v="'+d+'" aria-label="'+fmtLong(d)+'" style="width:26px;height:26px;border-radius:50%;'+(on?'background:'+esc(x.color):'border:1.5px '+(sched(x,d)?'solid':'dashed')+' var(--line)')+'"></button>';}
    h+='</div></div>';});
  return h;
}
function notesView(){
  var t=T(),has=D.notes.some(function(n){return n.daily===t;});
  return '<div class="top"><div><div class="date">'+fmtLong(t)+'</div><h1 class="dh">Заметки</h1></div><button class="btn2" data-a="noteNew">'+I('plus')+'Заметка</button></div><div class="search">'+I('search')+'<input id="nq" type="search" placeholder="Поиск по заметкам" aria-label="Поиск по заметкам" value="'+esc(UI.q)+'"></div><div id="nlist">'+notesList()+'</div>';
}
function notesList(){
  var qq=UI.q.trim().toLowerCase(),t=T(),has=D.notes.some(function(n){return n.daily===t&&n.owner===ME;});
  var ns=D.notes.filter(function(n){return !qq||(n.title+' '+n.body).toLowerCase().indexOf(qq)>=0;}).sort(function(a,b){return a.updated_at<b.updated_at?1:-1;});
  var h=qq?'':'<button class="daily" data-a="daily">'+I('edit')+'<span><b>'+(has?'Открыть заметку дня':'Заметка на сегодня')+'</b><small>'+fmtLong(t)+'</small></span></button>';
  ns.forEach(function(n){var shr=n.owner!==ME?' <span class="badge">от '+esc(pname(n.owner))+'</span>':noteMembers(n.id).length?' <span class="badge">общая</span>':'';h+='<button class="note" data-a="noteOpen" data-id="'+n.id+'"><b>'+esc(n.title||'Без названия')+(n.daily?' <span class="badge">день</span>':'')+shr+'</b><p>'+esc((n.body||'').trim()||'Пусто')+'</p></button>';});
  if(!ns.length)h+='<div class="empty">'+(qq?'Ничего не нашлось.':'Заметок пока нет.')+'</div>';
  return h;
}

/* голосовой ввод */
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
var VOICE={on:false,rec:null,target:null};
function micBtn(target){if(!SR)return '';var on=VOICE.on&&VOICE.target===target;return '<button type="button" class="iconbtn mic'+(on?' rec':'')+'" data-a="mic" data-v="'+target+'" aria-label="'+(on?'Остановить запись':'Сказать голосом')+'" aria-pressed="'+on+'">'+I('mic')+'</button>';}
function startVoice(target){
  if(VOICE.on){try{VOICE.rec.stop();}catch(e){}return;}
  var r;try{r=new SR();}catch(e){toast('Голосовой ввод не поддерживается в этом браузере');return;}
  r.lang='ru-RU';r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
  var text='';
  r.onresult=function(e){var t='';for(var i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;text=t;var el=document.getElementById(target==='as'?'asin':'qin');if(el)el.value=t;if(target==='q')UI.quick=t;};
  r.onerror=function(e){if(e.error==='not-allowed'||e.error==='service-not-allowed')toast('Разреши доступ к микрофону для этого сайта');else if(e.error!=='no-speech'&&e.error!=='aborted')toast('Не получилось распознать речь');};
  r.onend=function(){VOICE.on=false;VOICE.rec=null;var t=text.trim();if(target==='q')UI.quick='';render();if(!t)return;
    if(target==='as'||SET.assistant){askAssistant('chat',target==='q'?'Создай задачу: '+t:t,null,{autoAdd:true});}
    else{var qi=document.getElementById('qin'),f=document.getElementById('quick');if(qi&&f){qi.value=t;UI.quick=t;f.dispatchEvent(new Event('submit',{cancelable:true}));}}};
  VOICE.on=true;VOICE.target=target;VOICE.rec=r;
  try{r.start();}catch(e){VOICE.on=false;toast('Не удалось включить микрофон');}
  render();
}

/* помощник */
var AS={msgs:[],busy:false,loaded:null};
function asKey(){return 'zadachi-assistant-'+ME;}
function asLoad(){if(AS.loaded===ME)return;AS.loaded=ME;try{AS.msgs=JSON.parse(localStorage.getItem(asKey())||'[]');}catch(e){AS.msgs=[];}}
function asSave(){try{localStorage.setItem(asKey(),JSON.stringify(AS.msgs.slice(-40)));}catch(e){}}
function nl(s){return esc(s).replace(/\n/g,'<br>');}
function assistantView(){
  asLoad();
  var h='<div class="top"><div><div class="date">'+fmtLong(T())+'</div><h1 class="dh">Помощник</h1></div>'+(SET.assistant&&AS.msgs.length?'<button class="btn2" data-a="asClear">Очистить</button>':'')+'</div>';
  if(!SET.assistant){
    return h+'<div class="fields" style="margin-top:18px;padding:18px;display:flex;flex-direction:column;gap:12px"><div style="font-size:16px;line-height:1.5">Помощник на основе Claude смотрит твои задачи, привычки и заметки, составляет план на день, находит в заметках дела и предлагает задачи со сроками. Сам он ничего не меняет: каждую задачу и перенос ты подтверждаешь.</div><div class="muted" style="font-size:14px;line-height:1.5">Когда ты пользуешься помощником, эти данные отправляются в Claude (Anthropic) для обработки. Выключить можно в любой момент в настройках.</div><button class="btn" data-a="asOn">'+I('spark')+'Включить помощника</button></div>';
  }
  h+='<div class="chipsrow"><button class="fchip" data-a="asPlan"'+(AS.busy?' disabled':'')+'>'+I('sun')+'План на сегодня</button><button class="fchip" data-a="asNotes"'+(AS.busy?' disabled':'')+'>'+I('note')+'Разобрать заметки</button></div>';
  h+='<div class="chat" id="chat">';
  if(!AS.msgs.length)h+='<div class="empty">Спроси что угодно: «что у меня сегодня?», «разложи эти дела по неделе: …», «что я давно откладываю?». Или нажми «План на сегодня».</div>';
  AS.msgs.forEach(function(m,mi){
    if(m.role==='user'){h+='<div class="m u">'+nl(m.content)+'</div>';return;}
    if(m.error){h+='<div class="m a err">'+nl(m.content)+'</div>';return;}
    h+='<div class="m a">'+nl(m.content);
    (m.questions||[]).forEach(function(q2){h+='<div class="q">'+I('msg')+'<span>'+esc(q2)+'</span></div>';});
    var open=(m.tasks||[]).filter(function(t){return !t._added;}).length;
    (m.tasks||[]).forEach(function(t,ti){
      var when=t.due_date?dayWord(t.due_date)+(t.due_time?' в '+t.due_time:''):'без срока';
      h+='<div class="prop"><div style="flex:1;min-width:0"><b>'+esc(t.title)+'</b><div class="meta"><span>'+esc(when)+'</span>'+(t.list?'<span>'+esc(t.list)+'</span>':'')+(t.recur&&t.recur!=='none'?'<span>'+I('repeat')+esc(recurText({recur:t.recur,recur_n:2,recur_days:[]}))+'</span>':'')+'</div></div>'+(t._added?'<span class="badge">добавлено</span>':'<button class="btn2" data-a="asAdd" data-v="'+mi+':'+ti+'">'+I('plus')+'Добавить</button>')+'</div>';
    });
    (m.moves||[]).forEach(function(mv,vi){var tk=findTask(mv.task_id);if(!tk)return;
      h+='<div class="prop"><div style="flex:1;min-width:0"><b>'+esc(tk.title)+'</b><div class="meta"><span>'+I('move')+(mv.due_date?'на '+dayWord(mv.due_date).toLowerCase():'без срока')+'</span>'+(mv.reason?'<span>'+esc(mv.reason)+'</span>':'')+'</div></div>'+(mv._done?'<span class="badge">перенесено</span>':'<button class="btn2" data-a="asMove" data-v="'+mi+':'+vi+'">Перенести</button>')+'</div>';});
    if(open>1)h+='<button class="btn2" style="margin-top:8px" data-a="asAddAll" data-v="'+mi+'">Добавить все ('+open+')</button>';
    h+='</div>';
  });
  if(AS.busy)h+='<div class="m a muted">Думаю…</div>';
  h+='</div><form class="composer" id="asform" autocomplete="off"><textarea id="asin" rows="1" placeholder="'+(SR?'Напиши или скажи помощнику':'Напиши помощнику')+'" aria-label="Сообщение помощнику"></textarea>'+micBtn('as')+'<button class="btn" aria-label="Отправить"'+(AS.busy?' disabled':'')+'>'+I('send')+'</button></form>';
  return h;
}
async function askAssistant(mode,label,noteId,opts){
  if(AS.busy)return;asLoad();
  var history=AS.msgs.filter(function(m){return !m.error;}).map(function(m){var c=m.content;if(m.role==='assistant'&&m.tasks&&m.tasks.length)c+='\n(предложено: '+m.tasks.map(function(t){return t.title;}).join('; ')+')';return{role:m.role,content:c};});
  AS.msgs.push({role:'user',content:label});
  if(mode==='chat')history.push({role:'user',content:label});
  AS.busy=true;asSave();UI.view='assistant';render();asScroll();
  try{
    var r=await sb.functions.invoke(FN_NAME,{body:{mode:mode,messages:history.slice(-12),today:T(),now:fmtLong(T())+', '+nowHM(),note_id:noteId||null}});
    if(r.error){var msg=r.error.message;try{var j=await r.error.context.json();if(j&&j.error)msg=j.error;}catch(x){}throw new Error(msg);}
    var a=r.data||{};AS.msgs.push({role:'assistant',content:a.reply||'Готово.',tasks:a.tasks||[],moves:a.moves||[],questions:a.questions||[]});
    var auto=opts&&opts.autoAdd&&(a.tasks||[]).length&&!(a.questions||[]).length&&a.tasks.length<=5;
  }catch(e){AS.msgs.push({role:'assistant',error:true,content:'Не получилось: '+(e.message||'ошибка связи')+(/Failed to send|fetch/i.test(e.message||'')?'. Проверь, что функция помощника (assistant) опубликована в Supabase.':'')});}
  AS.busy=false;asSave();render();asScroll();
  if(typeof auto!=='undefined'&&auto){var mi=AS.msgs.length-1,n=0;for(var i=0;i<AS.msgs[mi].tasks.length;i++){if(await asAddTask(mi,i))n++;}if(n)toast(n===1?'Задача добавлена: '+AS.msgs[mi].tasks[0].title:'Добавлено задач: '+n);}
}
function asScroll(){setTimeout(function(){var c=document.getElementById('asform');if(c&&c.scrollIntoView)c.scrollIntoView({block:'end'});},30);}
function listIdByName(n){if(!n)return null;var l=D.lists.filter(function(x){return x.name.toLowerCase()===String(n).toLowerCase();})[0];return l?l.id:null;}
async function asAddTask(mi,ti){var m=AS.msgs[mi],t=m&&m.tasks[ti];if(!t||t._added)return;
  var ok=/^\d{4}-\d{2}-\d{2}$/.test(t.due_date||''),tm=/^\d{2}:\d{2}$/.test(t.due_time||'');
  var r=await createTask({title:String(t.title).slice(0,200),details:t.details||'',due_date:ok?t.due_date:null,due_time:ok&&tm?t.due_time:null,remind_every:ok&&tm?10:0,remind_times:ok&&tm?3:0,list_id:listIdByName(t.list),prio:Math.max(0,Math.min(3,+t.prio||0)),recur:ok&&t.recur&&RECUR.some(function(x){return x[0]===t.recur;})&&t.recur!=='days'?t.recur:'none'});
  if(r){t._added=true;asSave();render();}return r;}

/* каркас */
function sidebar(){
  var nav=function(v,icn,t,n){return '<button class="'+(UI.view===v&&(v!=='tasks'||UI.filter==='all')?'on':'')+'" data-a="go" data-v="'+v+'">'+I(icn)+'<span class="l">'+t+'</span>'+(n?'<span class="n">'+n+'</span>':'')+'</button>';};
  var todayN=myTasks().filter(function(t){return !t.done&&!hiddenTask(t)&&groupOf(t)==='today';}).length;
  var h='<div class="logo" style="padding:0 12px"><b>'+I('check')+'</b>задачи</div><div class="nav">'+nav('tasks','sun','Задачи',todayN||'')+nav('inbox','inbox','Входящие',inbox().length||'')+nav('calendar','cal','Календарь')+nav('habits','drop','Привычки')+nav('diary','book','Дневник')+nav('notes','note','Заметки')+nav('assistant','spark','Помощник')+'</div>';
  var own=D.lists.filter(function(l){return !isShared(l);}),sh=D.lists.filter(isShared);
  var li=function(l){var n=myTasks().filter(function(t){return t.list_id===l.id&&!t.done;}).length;return '<button class="'+(UI.view==='tasks'&&UI.filter===l.id?'on':'')+'" data-a="filter" data-v="'+l.id+'"><i class="dot" style="--c:'+esc(l.color)+'"></i><span class="l">'+esc(l.name)+'</span><span class="n">'+(l.hidden?I('eyeoff'):'')+(n||'')+'</span></button>';};
  h+='<div class="nav"><div class="t">Списки</div>'+own.map(li).join('')+'<button data-a="listNew">'+I('plus')+'<span class="l">Новый список</span></button></div>';
  if(sh.length)h+='<div class="nav"><div class="t">Общие</div>'+sh.map(li).join('')+'</div>';
  h+='<div class="me"><span class="av">'+esc(pname(ME).slice(0,1))+'</span><span class="nm">'+esc(pname(ME))+'</span><button class="iconbtn" data-a="settings" aria-label="Настройки">'+I('gear')+'</button></div>';
  return h;
}
function bottomNav(){
  var b=function(v,icn,t,extra){return '<button class="'+(UI.view===v?'on':'')+'" data-a="go" data-v="'+v+'" aria-current="'+(UI.view===v?'page':'false')+'"><span class="cnt">'+I(icn)+(extra||'')+'</span>'+t+'</button>';};
  var n=inbox().length;
  return '<nav class="bnav"><div class="in">'+b('tasks','tasks','Задачи')+b('calendar','cal','Календарь')+b('assistant','spark','Помощник')+b('notes','note','Заметки')+b('more','menu','Ещё',n?'<em>'+n+'</em>':'')+'</div></nav>';
}
function moreView(){
  var n=inbox().length;
  var r=function(v,icn,t,x){return '<button class="lrow" data-a="go" data-v="'+v+'">'+I(icn)+'<b>'+t+'</b>'+(x||'')+I('right')+'</button>';};
  return '<div class="top"><div><div class="date">'+fmtLong(T())+'</div><h1 class="dh">Ещё</h1></div></div><div class="fields" style="margin-top:18px">'+r('inbox','inbox','Входящие',n?'<span class="badge">'+n+'</span>':'')+r('habits','drop','Привычки')+r('diary','book','Дневник')+'<button class="lrow" data-a="lists">'+I('list')+'<b>Списки</b>'+I('right')+'</button><button class="lrow" data-a="settings">'+I('gear')+'<b>Настройки</b>'+I('right')+'</button></div>';
}
function mainContent(){
  switch(UI.view){case'inbox':return inboxView();case'calendar':return calView();case'diary':return diaryView();case'habits':return habitsView();case'notes':return notesView();case'more':return moreView();case'assistant':return assistantView();default:return tasksView();}
}
function render(){
  if(!ME)return;
  var app=document.getElementById('app');
  var mainEl=app.querySelector('.main'),scroll=mainEl?mainEl.scrollTop:0,pc=isPC();lastPC=pc;
  var ae=document.activeElement,keep=null;
  if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')&&ae.closest('#app')){var fm=ae.form;keep={id:ae.id,cf:fm&&fm.getAttribute('data-cform'),sf:fm&&fm.getAttribute('data-subform'),v:ae.value,pos:ae.selectionStart};}
  var detail='';
  if(pc){var t=UI.sel&&findTask(UI.sel);detail=t?'<aside class="detail" aria-label="Задача">'+detailHead(t)+'<div class="sb">'+taskDetail(t)+'</div><div class="sf">'+taskActions(t)+'</div></aside>':'<aside class="detail empty">Выбери задачу, чтобы увидеть подробности</aside>';}
  app.innerHTML='<div class="shell">'+(pc?'<aside class="side">'+sidebar()+'</aside>':'')+'<main class="main"><div class="wrap">'+mainContent()+'</div></main>'+detail+'</div>'+(pc?'':bottomNav()+(UI.view==='tasks'||UI.view==='calendar'?'<button class="fab" data-a="add" aria-label="Новая задача">'+I('plus')+'</button>':''));
  var m2=app.querySelector('.main');if(m2)m2.scrollTop=scroll;
  bindMain();
  if(keep){var el=keep.id?document.getElementById(keep.id):keep.cf?document.querySelector('form[data-cform="'+keep.cf+'"] input'):keep.sf?document.querySelector('form[data-subform="'+keep.sf+'"] input'):null;
    if(el){el.value=keep.v;el.focus();try{el.setSelectionRange(keep.pos,keep.pos);}catch(x){}}}
  bindDetailForms(document);
  var sa=document.activeElement;if(UI.sheet&&!(sa&&sa.closest&&sa.closest('#sheet')&&(sa.tagName==='INPUT'||sa.tagName==='TEXTAREA')))renderSheet();
}
function bindMain(){
  var f=document.getElementById('quick');
  if(f){var qi=document.getElementById('qin');qi.addEventListener('input',function(){UI.quick=qi.value;});
    f.addEventListener('submit',async function(e){e.preventDefault();var v=qi.value.trim();if(!v)return;var p=parseQuick(v);if(!p.title){toast('Напиши, что нужно сделать');return;}
      if(!p.due_date){var dd={};defaultsInto(dd);p.due_date=dd.due_date;if(!p.due_time){p.due_time=dd.due_time;p.remind_every=dd.due_time?dd.remind_every:0;p.remind_times=dd.remind_times;}}
      if(p.recur!=='none'&&!p.due_date)p.due_date=T();
      if(UI.filter!=='all')p.list_id=UI.filter;UI.quick='';qi.value='';var r=await createTask(p);if(r)toast('Добавлено: '+r.title+(r.due_date?', '+dayWord(r.due_date).toLowerCase()+(r.due_time?' в '+r.due_time:''):''));});}
  var af=document.getElementById('asform');if(af){var ai=document.getElementById('asin');ai.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();af.requestSubmit?af.requestSubmit():af.dispatchEvent(new Event('submit',{cancelable:true}));}});ai.addEventListener('input',function(){ai.style.height='auto';ai.style.height=Math.min(ai.scrollHeight,160)+'px';});
    af.addEventListener('submit',function(e){e.preventDefault();var v=ai.value.trim();if(!v||AS.busy)return;ai.value='';askAssistant('chat',v);});}
  var nq=document.getElementById('nq');if(nq)nq.addEventListener('input',function(){UI.q=nq.value;document.getElementById('nlist').innerHTML=notesList();});
}

/* =================== Карточка задачи =================== */
function detailHead(t){return '<div class="hd"><h3>'+(t.done?'Выполнено':t.status==='pending'&&t.assignee===ME?'Прислали тебе':'Задача')+'</h3><button class="iconbtn" data-a="closeDetail" aria-label="Закрыть">'+I('x')+'</button></div>';}
function taskDetail(t){
  var l=listOf(t),rows=[['clock','Когда',t.due_date?dayWord(t.due_date)+(t.due_time?', '+t.due_time:''):'Без срока'],['bell','Напоминания',remindAll(t)],['repeat','Повтор',t.recur==='none'?'Не повторять':cap(recurText(t))],['list','Список',l?l.name:'Без списка'],['flag','Приоритет',['Обычный','Важно','Очень важно','Срочно'][t.prio||0]]];
  if(t.owner!==ME)rows.push(['users','От кого',pname(t.owner)]);
  if(t.assignee&&t.assignee!==ME)rows.push(['send','Кому',pname(t.assignee)+' · '+(t.status==='pending'?'ждёт ответа':t.status==='declined'?'отклонено':'принято')]);
  var subs=t.subs||[];
  var h='<div style="display:flex;gap:12px;align-items:flex-start"><button class="chk'+(t.done?' on':'')+'" data-a="chk" data-id="'+t.id+'" aria-label="Выполнено"><span>'+(t.done?I('check'):'')+'</span></button><div style="font-size:21px;font-weight:600;line-height:1.3">'+esc(t.title)+'</div></div>';
  h+='<div class="fields">'+rows.map(function(r){return '<div class="fr">'+I(r[0])+'<span>'+r[1]+'</span><b style="font-weight:500;text-align:right">'+esc(r[2])+'</b></div>';}).join('')+'</div>';
  if(t.details)h+='<div style="white-space:pre-line;line-height:1.5">'+esc(t.details)+'</div>';
  h+='<div><div class="gl">Подзадачи'+(subs.length?' · '+subs.filter(function(s){return s.done;}).length+' из '+subs.length:'')+'</div><div class="subs">'+subs.map(function(s){return '<div class="si'+(s.done?' done':'')+'"><button class="sbox'+(s.done?' on':'')+'" data-a="subChk" data-id="'+t.id+'" data-v="'+s.id+'" aria-label="'+esc(s.t)+'">'+(s.done?I('check'):'')+'</button><span>'+esc(s.t)+'</span><button class="x" data-a="subDel" data-id="'+t.id+'" data-v="'+s.id+'" aria-label="Удалить пункт">'+I('x')+'</button></div>';}).join('')+'</div><form class="inrow" data-subform="'+t.id+'" style="margin-top:6px"><input class="fld" name="s" placeholder="Добавить пункт" aria-label="Новый пункт"><button class="btn" aria-label="Добавить пункт">'+I('plus')+'</button></form></div>';
  var cm=D.comments[t.id];
  h+='<div><div class="gl">Комментарии</div>'+(cm?cm.map(function(c){return '<div class="cmt" style="margin-bottom:10px"><span class="av">'+esc(pname(c.user_id).slice(0,1))+'</span><div><small>'+esc(pname(c.user_id))+' · '+new Date(c.created_at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</small><br>'+esc(c.body)+'</div></div>';}).join('')||'<div class="muted" style="font-size:14px;margin-bottom:8px">Пока нет</div>':'<div class="muted" style="font-size:14px">Загружаю…</div>')+'<form class="inrow" data-cform="'+t.id+'"><input class="fld" name="c" placeholder="Написать комментарий" aria-label="Комментарий"><button class="btn" aria-label="Отправить комментарий">'+I('send')+'</button></form></div>';
  if(!cm)loadComments(t.id);
  return h;
}
var loadingC={};
async function loadComments(id){if(loadingC[id])return;loadingC[id]=true;try{D.comments[id]=await q(sb.from('comments').select('*').eq('task_id',id).order('created_at'));render();}catch(e){D.comments[id]=[];}loadingC[id]=false;}
function taskActions(t){
  if(t.assignee===ME&&t.owner!==ME&&t.status==='pending')return '<div class="row2"><button class="btn" data-a="accept" data-id="'+t.id+'">Принять</button><button class="btn2" data-a="decline" data-id="'+t.id+'">Отклонить</button></div>';
  var h='<button class="btn" data-a="chk" data-id="'+t.id+'">'+(t.done?'Вернуть в работу':I('check')+'Выполнено')+'</button><div class="row2">';
  if(!t.done)h+='<button class="btn2" data-a="moveOpen" data-id="'+t.id+'">'+I('move')+'Перенести</button>';
  h+='<button class="btn2" data-a="edit" data-id="'+t.id+'">'+I('edit')+'Изменить</button>';
  if(t.owner===ME&&others().length)h+='<button class="btn2" data-a="sendOpen" data-id="'+t.id+'">'+I('send')+(t.assignee&&t.assignee!==ME?'Кому':'Отправить')+'</button>';
  if(t.owner===ME||(t.list_id&&findList(t.list_id)))h+='<button class="btn2 warn" data-a="del" data-id="'+t.id+'" aria-label="Удалить">'+I('trash')+'</button>';
  return h+'</div>';
}

/* =================== Шторки =================== */
function chips(label,opts,cur,key,hint,extra){
  return '<div><div class="gl">'+label+'</div><div class="chips">'+opts.map(function(o){return '<button class="chip'+(String(o[0])===String(cur)?' on':'')+'" data-a="set" data-k="'+key+'" data-v="'+esc(o[0])+'">'+o[1]+'</button>';}).join('')+(extra||'')+'</div>'+(hint?'<div class="gh">'+hint+'</div>':'')+'</div>';
}
function parseTime(s){s=String(s==null?'':s).trim();if(!s)return null;var h,mi,m=s.match(/^(\d{1,2})\s*[:.,\-\s]\s*(\d{1,2})$/);
  if(m){h=+m[1];mi=+m[2];}else{if(!/^\d{1,4}$/.test(s))return null;if(s.length<=2){h=+s;mi=0;}else if(s.length===3){h=+s[0];mi=+s.slice(1);}else{h=+s.slice(0,2);mi=+s.slice(2);}}
  if(!(h>=0&&h<=23&&mi>=0&&mi<=59))return null;return pad(h)+':'+pad(mi);}
function timeField(key,val,ph){var lab=val||({due_time:'Другое время',remind_add:'Добавить время',h_add:'Другое время',def_at:'Изменить время'}[key]||'Выбрать');return '<button type="button" class="chip tpbtn" data-a="tpOpen" data-v="'+key+'" data-cur="'+esc(val||'')+'">'+I('clock2')+esc(lab)+'</button>';}
function timeChoice(label,key,cur,presets,noneLabel,hint){var list=presets.slice();if(cur&&list.indexOf(cur)<0)list.push(cur);list.sort();return chips(label,(noneLabel?[['',noneLabel]]:[]).concat(list.map(function(x){return[x,x];})),cur||'',key,hint,timeField(key,'','своё: 7:30'));}
function applyTime(k,v){var s=UI.sheet;if(!s)return;
  if(k==='due_time'){s.due_time=v;s.tpl=null;}
  else if(k==='remind_add'){s.remind_at=(s.remind_at||[]).filter(function(x){return x!==v;}).concat([v]).sort();}
  else if(k==='remind'){s.remind=v;}
  else if(k==='h_add'){s.times=(s.times||[]).filter(function(x){return x!==v;}).concat([v]).sort();}
  else if(k==='q_from'||k==='q_to'){SET.quiet[k==='q_from'?'from':'to']=v;saveSettings();}
  else if(k==='h_from'||k==='h_to'){SET.hours[k==='h_from'?'from':'to']=v;saveSettings();}
  else if(k==='def_at'){SET.def.at=v;SET.def.time='fixed';saveSettings();}
  renderSheet();}
/* циферблат: сначала час, сразу потом минуты */
var TP=null;
function tpCurrent(k){var s=UI.sheet||{};if(k==='due_time')return s.due_time;if(k==='q_from')return SET.quiet.from;if(k==='q_to')return SET.quiet.to;if(k==='h_from')return SET.hours.from;if(k==='h_to')return SET.hours.to;if(k==='def_at')return SET.def.at;return null;}
function tpTitle(k){return {due_time:'Время задачи',remind_add:'Напомнить в',h_add:'Напоминание привычки',q_from:'Тихие часы: начало',q_to:'Тихие часы: конец',h_from:'«Каждый час»: с',h_to:'«Каждый час»: до',def_at:'Время по умолчанию'}[k]||'Время';}
function tpOpen(k,cur){var v=cur||tpCurrent(k)||'09:00',p=v.split(':');TP={key:k,h:+p[0]||0,m:+p[1]||0,step:'h',fine:false};tpRender();}
function tpRender(){
  var root=document.getElementById('tp');if(!root){root=document.createElement('div');root.id='tp';document.body.appendChild(root);}
  if(!TP){root.innerHTML='';return;}
  var R0=112,R1=74,cx=130,cy=130,btn='';
  function pos(i,n,r){var a=(i/n)*2*Math.PI-Math.PI/2;return 'left:'+(cx+r*Math.cos(a)-20).toFixed(1)+'px;top:'+(cy+r*Math.sin(a)-20).toFixed(1)+'px';}
  if(TP.step==='h'){
    for(var i=1;i<=12;i++){var h=i%12===0?12:i;btn+='<button class="tpn'+(TP.h===h?' on':'')+'" style="'+pos(i%12,12,R0)+'" data-a="tpH" data-v="'+h+'" aria-label="'+h+' часов">'+h+'</button>';}
    for(var j=0;j<12;j++){var h2=j===0?0:j+12;btn+='<button class="tpn in'+(TP.h===h2?' on':'')+'" style="'+pos(j,12,R1)+'" data-a="tpH" data-v="'+h2+'" aria-label="'+h2+' часов">'+pad(h2)+'</button>';}
  }else{
    for(var k=0;k<12;k++){var mm=k*5;btn+='<button class="tpn'+(TP.m===mm?' on':'')+'" style="'+pos(k,12,R0)+'" data-a="tpM" data-v="'+mm+'" aria-label="'+mm+' минут">'+pad(mm)+'</button>';}
  }
  var hand=TP.step==='h'?((TP.h%12)/12*360):(TP.m/60*360),hr=TP.step==='h'&&(TP.h===0||TP.h>12)?R1:R0;
  root.innerHTML='<div class="tpov" data-a="tpClose"><div class="tpbox" role="dialog" aria-modal="true" aria-label="'+esc(tpTitle(TP.key))+'">'
    +'<div class="tphd">'+esc(tpTitle(TP.key))+'</div>'
    +'<div class="tpshow"><button class="'+(TP.step==='h'?'on':'')+'" data-a="tpStep" data-v="h">'+pad(TP.h)+'</button><span>:</span><button class="'+(TP.step==='m'?'on':'')+'" data-a="tpStep" data-v="m">'+pad(TP.m)+'</button></div>'
    +'<div class="tpdial"><div class="tphand" style="height:'+hr+'px;transform:rotate('+hand+'deg)"></div><div class="tpdot"></div>'+btn+'</div>'
    +'<div class="tphint">'+(TP.step==='h'?'Выбери час: снаружи 1–12, внутри 13–00':'Выбери минуты — время сразу встанет')+'</div>'
    +(TP.step==='m'?'<div class="row2"><button class="btn2" data-a="tpFine" data-v="-1">−1 мин</button><button class="btn2" data-a="tpFine" data-v="1">+1 мин</button><button class="btn2" data-a="tpOk">Готово</button></div>':'')
    +'<div class="row2"><button class="btn2" data-a="tpClose2">Отмена</button></div></div></div>';
}
function tpDone(){var k=TP.key,v=pad(TP.h)+':'+pad(TP.m);TP=null;tpRender();applyTime(k,v);}
function customChip(key,cur,presets,unit){var c=cur!==''&&cur!=null&&presets.map(String).indexOf(String(cur))<0;return '<button class="chip'+(c?' on':'')+'" data-a="custom" data-k="'+key+'" data-v="'+unit+'">'+(c?cur+' '+unit:'Своё…')+'</button>';}
function timeChip(key,cur,presets,label){var c=cur&&presets.indexOf(cur)<0;return '<label class="chip'+(c?' on':'')+'">'+(c?cur:label||'Другое время')+'<input type="time" data-in="'+key+'" value="'+(cur||'09:00')+'" aria-label="'+(label||'Другое время')+'"></label>';}
function colorChips(cur,key,list){var c=list.indexOf(cur)<0;return '<div class="swatches">'+list.map(function(x){return '<button class="sw'+(x===cur?' on':'')+'" style="--c:'+x+'" data-a="set" data-k="'+key+'" data-v="'+x+'" aria-label="Цвет '+x+'"></button>';}).join('')+'<label class="sw any'+(c?' on':'')+'" style="'+(c?'background:'+esc(cur):'')+'" aria-label="Свой цвет"><input type="color" data-in="'+key+'" value="'+(c?esc(cur):'#888888')+'"></label></div>';}
function wdChips(sel,act,label){return '<div><div class="gl">'+label+'</div><div class="chips">'+WD.map(function(w,i){return '<button class="chip'+(sel.indexOf(i)>=0?' on':'')+'" data-a="'+act+'" data-v="'+i+'">'+w+'</button>';}).join('')+'</div></div>';}
var BUILTIN=[['tomorrow','Завтра утром'],['today','Сегодня'],['daily','Каждый день'],['nodate','Без срока']];
function applyTpl(d,key){
  var t=T();d.tpl=key;
  if(key==='tomorrow'){d.due_date=addDays(t,1);d.due_time='09:00';d.remind_every=10;d.remind_times=0;d.recur='none';}
  else if(key==='today'){var h=new Date().getHours()+1;if(h>=23){d.due_date=addDays(t,1);d.due_time='09:00';}else{d.due_date=t;d.due_time=pad(h)+':00';}d.remind_every=10;d.remind_times=3;d.recur='none';}
  else if(key==='daily'){d.due_date=addDays(t,1);d.due_time='09:00';d.remind_every=10;d.remind_times=3;d.recur='daily';}
  else if(key==='nodate'){d.due_date=null;d.due_time=null;d.recur='none';d.remind_every=0;}
  else if(key.indexOf('u:')===0){var u=D.templates.filter(function(x){return 'u:'+x.id===key;})[0];if(u){var x=u.data;d.due_date=x.off==null?null:addDays(t,x.off);['due_time','remind_every','remind_times','recur','recur_n','prio','list_id'].forEach(function(f){if(x[f]!==undefined)d[f]=x[f];});d.recur_days=(x.recur_days||[]).slice();d.remind_at=(x.remind_at||[]).slice();d.rule=JSON.parse(JSON.stringify(x.rule||{}));if(d.list_id&&!findList(d.list_id))d.list_id=null;}}
}
var RPRE=[['none','Не повторять'],['daily','Каждый день'],['weekdays','По будням'],['weekly','Каждую неделю'],['monthly','Каждый месяц'],['yearly','Каждый год'],['hourly','Каждый час'],['custom','Настроить…']];
function nextWd(days){var d=T(),g=0;while(days.indexOf(dow(d))<0&&g++<8)d=addDays(d,1);return d;}
function defRule(d){var w=d.due_date?dow(d.due_date):0;return{unit:'week',every:1,days:[w],mode:'date',nth:1,wd:w,from:'date'};}
function recurBlock(d){
  var hint='';if(d.recur==='weekly')hint='По дню недели даты: '+WDF[dow(d.due_date)].replace('среду','среда').replace('пятницу','пятница').replace('субботу','суббота');
  else if(d.recur==='monthly')hint=fromKey(d.due_date).getDate()+'-го числа каждого месяца';else if(d.recur==='yearly')hint='Каждый год '+fmtDM(d.due_date);else if(d.recur==='hourly')hint='С '+SET.hours.from+' до '+SET.hours.to+'. Меняется в настройках.';
  var h=chips('Повтор',RPRE,d.recur,'recur',d.recur==='weekly'?'':hint);
  if(d.recur==='weekly')h+=chips('По какому дню',WD.map(function(w,i){return[i,w];}),dow(d.due_date),'wkday','Ближайший раз: '+dayWord(d.due_date).toLowerCase().replace(/\.$/,'')+'. После выполнения задача переедет на следующую неделю.');
  if(d.recur!=='custom')return h;
  var r=d.rule;if(!r||!r.unit){r=d.rule=defRule(d);}var n=Math.max(1,+r.every||1);
  h+='<div class="rulebox">';
  h+=chips('Каждые',[1,2,3,4,6].map(function(x){return[x,String(x)];}),n,'r_every','',customChip('r_every',n,[1,2,3,4,6],''));
  h+=chips('Чего',[['day',plural(n,'день','дня','дней')],['week',plural(n,'неделя','недели','недель')],['month',plural(n,'месяц','месяца','месяцев')],['year',plural(n,'год','года','лет')]],r.unit,'r_unit');
  if(r.unit==='week')h+=wdChips(r.days||[],'rwd','По каким дням');
  if(r.unit==='month'){h+=chips('Какой день месяца',[['date',fromKey(d.due_date).getDate()+'-го числа'],['last','Последний день'],['nth','День недели по счёту']],r.mode||'date','r_mode');
    if(r.mode==='nth'){h+=chips('Какой по счёту',[[1,'Первый'],[2,'Второй'],[3,'Третий'],[4,'Четвёртый'],[-1,'Последний']],r.nth||1,'r_nth');h+=chips('День недели',WD.map(function(w,i){return[i,w];}),+r.wd||0,'r_wd');}}
  if(r.unit==='day')h+=chips('Считать',[['date','От даты задачи'],['done','От дня выполнения']],r.from||'date','r_from','«От дня выполнения»: если сделал позже, следующий раз сдвинется. Удобно для стрижки или замены фильтра.');
  h+='<div class="gh" style="margin-top:0"><b>Итого:</b> '+esc(ruleText(r,d.due_date))+'</div></div>';
  return h;
}
function remAtBlock(d,label,hint){return '<div><div class="gl">'+label+'</div><div class="chips">'+(d.remind_at||[]).slice().sort().map(function(x){return '<button class="chip on" data-a="remAtDel" data-v="'+x+'" aria-label="Убрать напоминание в '+x+'">'+x+' '+I('x')+'</button>';}).join('')+timeField('remind_add','','добавить: 7:00')+'</div><div class="gh">'+hint+'</div></div>';}
function taskForm(d){
  var t=T(),h='';
  if(d._draft)h+='<div class="sum" style="border-style:dashed;flex-direction:row;align-items:center;justify-content:space-between;gap:10px"><span>Черновик восстановлен</span><button class="link" data-a="draftClear">Начать заново</button></div>';
  h+='<input class="fld" id="d-title" placeholder="Что нужно сделать" aria-label="Название" value="'+esc(d.title)+'">';
  var rem=remindAll(d);
  h+='<div class="sum"><b>'+(d.due_date?dayWord(d.due_date)+(d.due_time?' в '+d.due_time:''):'Без срока')+'</b>'+(rem&&rem!=='Нет'?'<span>'+esc(rem)+'</span>':'')+(d.recur!=='none'&&d.due_date?'<span>Повтор: '+esc(recurText(d))+'</span>':'')+'</div>';
  if(!d.id&&SET.showTpl!==false)h+=chips('Шаблон',BUILTIN.concat(D.templates.map(function(x){return['u:'+x.id,'★ '+esc(x.name)];})),d.tpl,'tpl');
  h+=chips('Список',[['','Без списка']].concat(D.lists.map(function(l){return[l.id,'<i class="dot" style="--c:'+esc(l.color)+'"></i>'+esc(l.name)];})),d.list_id||'','list_id','','<button class="chip" data-a="listNew">'+I('plus')+'Новый</button>');
  h+=chips('Приоритет',[[0,'Обычный'],[1,'Важно'],[2,'Очень важно'],[3,'Срочно']],d.prio,'prio');
  var dk=!d.due_date?'none':d.due_date===t?'today':d.due_date===addDays(t,1)?'tomorrow':'pick';
  h+=chips('Когда',[['today','Сегодня'],['tomorrow','Завтра']],dk,'datekey','','<label class="chip'+(dk==='pick'?' on':'')+'">'+(dk==='pick'?cap(fmtShort(d.due_date)):'Другая дата')+'<input type="date" data-in="due_date" value="'+(d.due_date||t)+'" aria-label="Другая дата"></label><button class="chip'+(dk==='none'?' on':'')+'" data-a="set" data-k="datekey" data-v="none">Без срока</button>');
  if(d.due_date){
    h+=timeChoice('Время','due_time',d.due_time,['08:00','09:00','12:00','15:00','18:00','21:00'],'Без времени','Можно вписать своё: 7, 730 или 7:30');
    if(d.due_time){
      h+=chips('Повторять напоминание',[0,5,10,15,30,60].map(function(x){return[x,x?x+' мин':'Нет'];}),d.remind_every,'remind_every','',customChip('remind_every',d.remind_every,[0,5,10,15,30,60],'мин'));
      if(d.remind_every)h+=chips('Сколько раз',[2,3,5,10,0].map(function(x){return[x,x?x+' '+plural(x,'раз','раза','раз'):'Пока не выполню'];}),d.remind_times,'remind_times','С '+SET.quiet.from+' до '+SET.quiet.to+' повторы не приходят. Меняется в настройках.',customChip('remind_times',d.remind_times,[2,3,5,10,0],'раз'));
    }
    h+=remAtBlock(d,'Ещё напомнить в','Впиши время и нажми Enter. Например, 7, 8 и 9, чтобы напомнить три раза утром.');
    h+=recurBlock(d);
  }else{
    h+=remAtBlock(d,'Напоминать каждый день в','Без срока, но с напоминаниями: будут приходить каждый день в эти часы, пока не отметишь задачу выполненной.');
    h+=chips('Повтор',RPRE.filter(function(x){return x[0]!=='hourly';}),'none','recur','Выбери повтор, например «Каждую неделю» → пт, и задача будет появляться в эти дни.');
  }
  h+='<label><div class="gl">Описание</div><textarea class="fld" id="d-details" placeholder="Подробности, ссылки, адрес" aria-label="Описание">'+esc(d.details||'')+'</textarea></label>';
  if(!d.id)h+='<button class="btn2" data-a="saveTpl">'+I('star')+'Сохранить настройки как свой шаблон</button>';
  return h;
}
function habitForm(d){
  var h='<input class="fld" id="d-name" placeholder="Например, учить ПДД" aria-label="Название" value="'+esc(d.name)+'">';
  h+='<div><div class="gl">Значок</div><div class="icons">'+HICONS.map(function(n){return '<button class="'+(n===d.icon?'on':'')+'" data-a="set" data-k="icon" data-v="'+n+'" aria-label="Значок '+n+'">'+I(n)+'</button>';}).join('')+'</div></div>';
  h+='<div><div class="gl">Цвет</div>'+colorChips(d.color,'color',COLORS)+'</div>';
  h+=chips('Сколько раз в день',[1,2,3,4,5,8,10].map(function(x){return[x,x+' '+plural(x,'раз','раза','раз')];}),d.target,'target','',customChip('target',d.target,[1,2,3,4,5,8,10],'раз'));
  h+=chips('Дни',[['all','Каждый день'],['wk','По будням'],['pick','Выбрать']],d.dmode,'dmode');
  if(d.dmode==='pick')h+=wdChips(d.days,'hday','Какие дни');
  var ht=(d.times||[]).slice().sort(),pre=['08:00','09:00','12:00','15:00','20:00','21:00'];
  h+='<div><div class="gl">Напоминать в</div><div class="chips">'+pre.concat(ht.filter(function(x){return pre.indexOf(x)<0;})).sort().map(function(x){var on=ht.indexOf(x)>=0;return '<button class="chip'+(on?' on':'')+'" data-a="htime" data-v="'+x+'" aria-pressed="'+on+'">'+x+'</button>';}).join('')+timeField('h_add','','своё: 7:30')+'</div><div class="gh">Можно несколько. Если делать нужно несколько раз в день (например, таблетки 3 раза), поставь «Сколько раз в день» 3 и три времени: к каждому придёт напоминание, только если ты ещё не отметил нужное количество.</div></div>';
  if(ht.length)h+=chips('Повторять, пока не отмечу',[0,15,30,60,120].map(function(x){return[x,x?(x<60?x+' мин':(x/60)+' ч'):'Нет'];}),+d.remind_every||0,'remind_every','После первого напоминания будет напоминать снова через это время, пока не отметишь. В тихие часы не беспокоит.',customChip('remind_every',+d.remind_every||0,[0,15,30,60,120],'мин'));
  return h;
}
function habitDetail(hb,off){
  var t=T(),c=cnt(hb,t),done=hDone(hb,t),base=addDays(t,off),mon=addDays(base,-dow(base));
  var sub=hb.paused?'На паузе':!sched(hb,t)?'Сегодня день отдыха':done?'Сегодня сделано':tgt(hb)>1?'Осталось '+(tgt(hb)-c)+' из '+tgt(hb):'Сделай это сегодня';
  var h='<div class="hdtl" style="--hc:'+esc(hb.color)+'"><div class="ctl"><button class="pm" data-a="habMinus" data-id="'+hb.id+'" aria-label="Минус одно">−</button><button class="big'+(done?' done':'')+'" data-a="habPlus" data-id="'+hb.id+'" aria-label="Плюс одно">'+I(hb.icon)+'<b>'+c+'/'+tgt(hb)+'</b></button><button class="pm" data-a="habPlus" data-id="'+hb.id+'" aria-label="Плюс одно">+</button></div><div style="font-size:21px;font-weight:600">'+esc(hb.name)+'</div><div class="muted">'+sub+'</div></div>';
  h+='<div style="--hc:'+esc(hb.color)+'"><div class="calnav" style="margin:0 0 10px"><button class="iconbtn" data-a="hwk" data-v="-7" aria-label="Прошлая неделя">'+I('left')+'</button><b>'+fmt(addDays(mon,3),{month:'long'})+'</b><button class="iconbtn" data-a="hwk" data-v="7" aria-label="Следующая неделя"'+(off>=0?' disabled style="opacity:.3"':'')+'>'+I('right')+'</button></div><div class="hweek">';
  for(var i=0;i<7;i++){var k=addDays(mon,i);h+='<div><small>'+WD[i]+'</small><button class="'+(hDone(hb,k)?'on ':'')+(k===t?'t ':'')+(sched(hb,k)?'':'skip')+'" data-a="habDay" data-id="'+hb.id+'" data-v="'+k+'"'+(k>t?' disabled':'')+' aria-label="'+fmtLong(k)+'">'+fromKey(k).getDate()+'</button></div>';}
  h+='</div></div><div class="stats"><div><b>'+streak(hb)+'</b><small>подряд</small></div><div><b>'+pct(hb)+'%</b><small>выполнение</small></div><div><b>'+totalDone(hb)+'</b><small>всего</small></div></div>';
  h+='<div class="fields"><div class="fr">'+I('bell')+'<span>Напоминание</span><b style="font-weight:500">'+(hb.remind?[hb.remind].concat(hb.remind_at||[]).join(', ')+(hb.remind_every?', потом каждые '+hb.remind_every+' мин':''):'нет')+'</b></div><div class="fr">'+I('cal')+'<span>Дни</span><b style="font-weight:500">'+daysText(hb)+'</b></div><div class="fr">'+I('star')+'<span>В день</span><b style="font-weight:500">'+tgt(hb)+' '+plural(tgt(hb),'раз','раза','раз')+'</b></div></div>';
  return h;
}
function listForm(d){
  var h='<input class="fld" id="d-lname" placeholder="Например, Покупки" aria-label="Название списка" value="'+esc(d.name)+'">';
  h+='<div><div class="gl">Цвет</div>'+colorChips(d.color,'color',LCOLORS)+'</div>';
  h+=chips('Показывать',[['0','Во «Все»'],['1','Скрытый список']],d.hidden?'1':'0','hidden','Задачи скрытого списка видны, только когда открываешь сам список. Удобно для фильмов, книг, идей.');
  var ow=!d.id||d.owner===ME;
  if(others().length){
    if(ow)h+='<div><div class="gl">Общий доступ</div><div class="chips">'+others().map(function(p){var on=d.members.indexOf(p.id)>=0;return '<button class="chip'+(on?' on':'')+'" data-a="member" data-v="'+p.id+'">'+I('users')+esc(p.name||p.email)+'</button>';}).join('')+'</div><div class="gh">Отмеченные люди увидят этот список и смогут добавлять и отмечать задачи.</div></div>';
    else h+='<div class="gh">Это общий список, его владелец: '+esc(pname(d.owner))+'.</div>';
  }
  return h;
}
function settingsForm(){
  var me=prof(ME)||{};
  var h='<label><div class="gl">Имя</div><input class="fld" id="s-name" value="'+esc(me.name||'')+'" aria-label="Имя"></label>';
  h+=pushBlock();
  h+=chips('Тема',[['light','Светлая «Бумага»'],['dark','Тёмная «Ночь»'],['auto','Как в системе']],SET.theme,'s_theme');
  h+='<div><div class="gl">Акцентный цвет</div>'+colorChips(SET.accent,'s_accent',['#141414','#6A5FE0','#3F7D5C','#C0663B','#4A6FB0','#B0476E','#F2B79E'])+'</div>';
  h+=chips('Вид',[['auto','Авто'],['pc','Для ПК'],['phone','Для телефона']],SET.layout,'s_layout','«Авто» выбирает сам по ширине экрана');
  h+=chips('Незавершённые задачи',[['1','Переносить на сегодня'],['0','Оставлять в «Просрочено»']],SET.autoMove?'1':'0','s_autoMove');
  h+=chips('Помощник Claude',[['1','Включён'],['0','Выключен']],SET.assistant?'1':'0','s_assistant','Когда пользуешься помощником, твои задачи, привычки и заметки отправляются в Claude (Anthropic) для обработки.');
  h+=chips('Поздравления и анимации',[['1','Включены'],['0','Выключены']],SET.rewards?'1':'0','s_rewards');
  var df=SET.def;
  h+='<div class="rulebox"><div class="gl" style="margin:0;font-size:15px;color:var(--ink)">Новая задача по умолчанию</div>';
  h+=chips('Когда',[['today','Сегодня'],['tomorrow','Завтра'],['none','Без срока']],df.date,'sd_date');
  h+=chips('Время',[['none','Без времени'],['next','Через час'],['fixed',df.time==='fixed'?df.at:'Своё']],df.time,'sd_time',df.time==='fixed'?'Впиши время в поле и нажми Enter':'',df.time==='fixed'?timeField('def_at','','изменить: 9:00'):'');
  h+=chips('Повторять напоминание',[0,5,10,15,30,60].map(function(x){return[x,x?x+' мин':'Нет'];}),+df.every,'sd_every','',customChip('def_every',+df.every,[0,5,10,15,30,60],'мин'));
  if(+df.every)h+=chips('Сколько раз',[2,3,5,10,0].map(function(x){return[x,x?x+' '+plural(x,'раз','раза','раз'):'Пока не выполню'];}),+df.times,'sd_times','',customChip('def_times',+df.times,[2,3,5,10,0],'раз'));
  h+=chips('Шаблоны в окне новой задачи',[['1','Показывать'],['0','Скрыть']],SET.showTpl===false?'0':'1','s_showTpl');
  h+='</div>';
  h+='<div><div class="gl">Тихие часы: повторы напоминаний не приходят</div><div class="chips" style="align-items:center">с '+timeField('q_from',SET.quiet.from,'23:00')+' до '+timeField('q_to',SET.quiet.to,'08:00')+'</div></div>';
  h+='<div><div class="gl">Задачи «каждый час» напоминают</div><div class="chips" style="align-items:center">с '+timeField('h_from',SET.hours.from,'09:00')+' до '+timeField('h_to',SET.hours.to,'21:00')+'</div></div>';
  h+='<div><div class="gl">Мои шаблоны</div>'+(D.templates.length?'<div class="chips">'+D.templates.map(function(x){return '<button class="chip" data-a="tplDel" data-id="'+x.id+'">'+esc(x.name)+' '+I('x')+'</button>';}).join('')+'</div>':'<div class="gh" style="margin:0">Создай задачу и нажми «Сохранить настройки как свой шаблон».</div>')+'</div>';
  h+='<div class="row2"><button class="btn2" data-a="lists">'+I('list')+'Управлять списками</button><button class="btn2" data-a="passOpen">'+I('gear')+'Сменить пароль</button></div>';
  h+='<div class="gh">Установить на телефон: в Safari «Поделиться» → «На экран „Домой“», в Chrome меню ⋮ → «Добавить на главный экран».</div>';
  return h;
}
function listsSheet(){
  if(!D.lists.length)return '<div class="empty">Списков пока нет.</div>';
  return '<div class="fields">'+D.lists.map(function(l){var n=myTasks().filter(function(t){return t.list_id===l.id&&!t.done;}).length;return '<button class="lrow" data-a="listEdit" data-id="'+l.id+'"><i class="dot" style="--c:'+esc(l.color)+'"></i><b>'+esc(l.name)+'</b>'+(l.hidden?I('eyeoff'):'')+(isShared(l)?I('users'):'')+'<span class="muted" style="font-size:13px">'+n+'</span>'+I('right')+'</button>';}).join('')+'</div>';
}
function moveSheet(t){
  return '<div style="font-size:17px;font-weight:600">'+esc(t.title)+'</div>'+chips('Перенести на',[['0','Сегодня'],['1','Завтра'],['2','Послезавтра'],['7','Через неделю'],['none','Без срока']],'','move','','<button class="chip" data-a="custom" data-k="moveN" data-v="дн.">Через N дней</button><label class="chip">Выбрать дату<input type="date" data-in="move" value="'+(t.due_date||T())+'" aria-label="Выбрать дату"></label>');
}
function sendSheet(t){
  var h='<div style="font-size:17px;font-weight:600">'+esc(t.title)+'</div><div class="fields">'+others().map(function(p){return '<button class="lrow" data-a="sendTo" data-id="'+t.id+'" data-v="'+p.id+'"><span class="av">'+esc((p.name||p.email).slice(0,1))+'</span><b>'+esc(p.name||p.email)+'</b>'+(t.assignee===p.id?'<span class="badge">'+(t.status==='pending'?'ждёт':'у неё/него')+'</span>':'')+'</button>';}).join('')+'</div>';
  if(t.assignee&&t.assignee!==ME)h+='<button class="btn2" data-a="sendTo" data-id="'+t.id+'" data-v="">Забрать задачу себе</button>';
  return h+'<div class="gh">Человек увидит задачу во «Входящих» и сможет принять или отклонить её. Ты будешь видеть, выполнена ли она.</div>';
}
function renderSheet(first){
  var root=document.getElementById('sheet');var s=UI.sheet;
  if(!s){root.innerHTML='';return;}
  var prev=first?0:((root.querySelector('.sb')||{}).scrollTop||0);
  var title='',body='',foot='';
  if(s.type==='task-edit'){title=s.id?'Изменить задачу':'Новая задача';body=taskForm(s);foot='<button class="btn" data-a="saveTask">'+(s.id?'Сохранить':'Добавить задачу')+'</button>';}
  else if(s.type==='task'){var t=findTask(s.id);if(!t){UI.sheet=null;return renderSheet();}title=detailHeadTitle(t);body=taskDetail(t);foot=taskActions(t);}
  else if(s.type==='move'){var tm=findTask(s.id);if(!tm){UI.sheet=null;return renderSheet();}title='Перенести';body=moveSheet(tm);}
  else if(s.type==='send'){var ts=findTask(s.id);title='Отправить задачу';body=sendSheet(ts);}
  else if(s.type==='habit-edit'){title=s.id?'Изменить привычку':'Новая привычка';body=habitForm(s);foot='<button class="btn" data-a="saveHabit">'+(s.id?'Сохранить':'Создать привычку')+'</button>';}
  else if(s.type==='habit'){var hb=findHabit(s.id);if(!hb){UI.sheet=null;return renderSheet();}title='Привычка';body=habitDetail(hb,s.off||0);foot='<div class="row2"><button class="btn2" data-a="habPause" data-id="'+hb.id+'">'+(hb.paused?'Продолжить':'Пауза')+'</button><button class="btn2" data-a="habFinish" data-id="'+hb.id+'">Завершить</button><button class="btn2" data-a="habEdit" data-id="'+hb.id+'">'+I('edit')+'</button><button class="btn2 warn" data-a="habDel" data-id="'+hb.id+'" aria-label="Удалить">'+I('trash')+'</button></div>';}
  else if(s.type==='lists'){title='Списки';body=listsSheet();foot='<button class="btn" data-a="listNew">'+I('plus')+'Новый список</button>';}
  else if(s.type==='list-edit'){title=s.id?'Список':'Новый список';body=listForm(s);foot='<button class="btn" data-a="saveList">'+(s.id?'Сохранить':'Создать список')+'</button>'+(s.id&&s.owner===ME?'<button class="btn2 warn" data-a="delList">Удалить список</button>':'')+(s.id&&s.owner!==ME?'<button class="btn2 warn" data-a="leaveList">Выйти из общего списка</button>':'');}
  else if(s.type==='note-share'){var nn=findNote(s.id);title='Поделиться заметкой';body='<div style="font-size:17px;font-weight:600">'+esc(nn&&nn.title||'Без названия')+'</div><div class="chips">'+others().map(function(p){var on=s.members.indexOf(p.id)>=0;return '<button class="chip'+(on?' on':'')+'" data-a="nmember" data-v="'+p.id+'">'+I('users')+esc(p.name||p.email)+'</button>';}).join('')+'</div><div class="gh">Отмеченные увидят заметку у себя в «Заметках» и смогут её дописывать. Удалить её сможешь только ты.</div>';foot='<button class="btn" data-a="saveNoteShare">Сохранить</button>';}
  else if(s.type==='pass'){title='Сменить пароль';body='<label><div class="gl">Новый пароль, минимум 8 символов</div><input class="fld" id="p1" type="password" autocomplete="new-password" minlength="8"></label><label><div class="gl">Ещё раз</div><input class="fld" id="p2" type="password" autocomplete="new-password" minlength="8"></label><div class="err" id="perr"></div>';foot='<button class="btn" data-a="passSave">Сохранить пароль</button>';}
  else if(s.type==='settings'){title='Настройки';body=settingsForm();foot='<button class="btn2 warn" data-a="logout">'+I('out')+'Выйти из аккаунта</button>';}
  root.innerHTML='<div class="ov" data-a="ovClose"><div class="sh" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="hd"><h3>'+esc(title)+'</h3><button class="iconbtn" data-a="close" aria-label="Закрыть">'+I('x')+'</button></div><div class="sb">'+body+'</div>'+(foot?'<div class="sf">'+foot+'</div>':'')+'</div></div>';
  root.querySelector('.sb').scrollTop=prev;
  bindSheet();bindDetailForms(root);
  if(first){var f=root.querySelector('#d-title,#d-name,#d-lname');if(f&&!s.id&&!f.value)setTimeout(function(){f.focus();},200);}
}
function detailHeadTitle(t){return t.done?'Выполнено':t.status==='pending'&&t.assignee===ME?'Прислали тебе':'Задача';}
function bindSheet(){
  var root=document.getElementById('sheet'),s=UI.sheet;
  [['d-title','title'],['d-details','details'],['d-name','name'],['d-lname','name']].forEach(function(p){var el=root.querySelector('#'+p[0]);if(el)el.addEventListener('input',function(){s[p[1]]=el.value;});});
  var sn=root.querySelector('#s-name');if(sn)sn.addEventListener('change',function(){var v=sn.value.trim();var me=prof(ME);if(me)me.name=v;q(sb.from('profiles').update({name:v}).eq('id',ME)).then(function(){render();toast('Имя сохранено');}).catch(err);});
  root.querySelectorAll('input[data-tin]').forEach(function(el){if(true)return;
    var done=false;function apply(){if(done)return;var raw=el.value.trim(),k=el.getAttribute('data-tin');if(!raw)return;var v=parseTime(raw);
      if(!v){toast('Не понял время. Напиши, например, 7, 730 или 7:30');return;}done=true;
      if(k==='due_time'){s.due_time=v;s.tpl=null;}
      else if(k==='remind_add'){s.remind_at=(s.remind_at||[]).filter(function(x){return x!==v;}).concat([v]).sort();}
      else if(k==='remind'){s.remind=v;}
      else if(k==='h_add'){s.times=(s.times||[]).filter(function(x){return x!==v;}).concat([v]).sort();}
      else if(k==='q_from'||k==='q_to'){SET.quiet[k==='q_from'?'from':'to']=v;saveSettings();}
      else if(k==='h_from'||k==='h_to'){SET.hours[k==='h_from'?'from':'to']=v;saveSettings();}
      else if(k==='def_at'){SET.def.at=v;SET.def.time='fixed';saveSettings();}
      renderSheet();var nx=document.querySelector('#sheet input[data-tin="'+k+'"]');if(nx&&(k==='remind_add'||k==='h_add'))nx.focus();}
    el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();apply();}});
    el.addEventListener('change',apply);
  });
  root.querySelectorAll('input[data-in]').forEach(function(el){el.addEventListener(el.type==='color'?'input':'change',function(){
    var k=el.getAttribute('data-in'),v=el.value;if(!v)return;
    if(k==='move'){moveTask(s.id,v);return;}
    if(k==='s_accent'){SET.accent=v;saveSettings();return;}
    if(k==='q_from'||k==='q_to'){SET.quiet[k==='q_from'?'from':'to']=v;saveSettings();renderSheet();return;}
    if(k==='h_from'||k==='h_to'){SET.hours[k==='h_from'?'from':'to']=v;saveSettings();renderSheet();return;}
    if(k==='due_date'){s.due_date=v;s.tpl=null;}else if(k==='due_time'){s.due_time=v;s.tpl=null;}else s[k]=v;
    renderSheet();
  });});
}
function bindDetailForms(scope){
  scope.querySelectorAll('form[data-subform]').forEach(function(f){if(f.__b)return;f.__b=1;f.addEventListener('submit',function(e){e.preventDefault();var inp=f.elements.namedItem('s'),t=findTask(f.getAttribute('data-subform')),v=inp.value.trim();inp.value='';if(!t||!v)return;patchTask(t.id,{subs:(t.subs||[]).concat([{id:uid(),t:v,done:false}])}).then(function(){refreshKeep('form[data-subform="'+t.id+'"] input');});});});
  scope.querySelectorAll('form[data-cform]').forEach(function(f){if(f.__b)return;f.__b=1;f.addEventListener('submit',async function(e){e.preventDefault();var inp=f.elements.namedItem('c'),id=f.getAttribute('data-cform'),v=inp.value.trim();if(!v)return;inp.value='';
    try{var c=await q(sb.from('comments').insert({task_id:id,body:v}).select().single());D.comments[id]=D.comments[id]||[];if(!D.comments[id].some(function(x){return x.id===c.id;}))D.comments[id].push(c);render();refreshKeep('form[data-cform="'+id+'"] input');}catch(x){err(x);}});});
}
function refreshKeep(sel){if(UI.sheet){renderSheet();}var n=document.querySelector((UI.sheet?'#sheet ':'#app ')+sel);if(n)n.focus();}
function closeSheet(){UI.sheet=null;renderSheet();}
function draftKey(){return 'zadachi-draft-'+ME;}
function clearDraft(){try{localStorage.removeItem(draftKey());}catch(e){}}
function saveDraft(){var s=UI.sheet;if(s&&s.type==='task-edit'&&!s.id&&((s.title||'').trim()||(s.details||'').trim())){try{var c=JSON.parse(JSON.stringify(s));delete c._draft;localStorage.setItem(draftKey(),JSON.stringify(c));toast('Черновик сохранён, откроется при следующей новой задаче');}catch(e){}}}
function userClose(){var s=UI.sheet;if(s&&s.back){UI.sheet=s.back;renderSheet(true);return;}saveDraft();closeSheet();}
function defaultsInto(d){var df=SET.def||SET_DEF.def,t=T();d.tpl=null;d.recur='none';
  d.due_date=df.date==='today'?t:df.date==='tomorrow'?addDays(t,1):null;
  if(d.due_date&&df.time==='fixed')d.due_time=df.at||'09:00';else if(d.due_date&&df.time==='next'){var hh=new Date().getHours()+1;d.due_time=hh<=23?pad(hh)+':00':null;}else d.due_time=null;
  d.remind_every=+df.every||0;d.remind_times=+df.times||0;}
function openTask(id){if(isPC()){UI.sel=id;UI.sheet=null;renderSheet();render();}else{UI.sheet={type:'task',id:id};renderSheet(true);}}
function openAdd(title,extra){
  if(!title&&!extra){var dr=null;try{dr=JSON.parse(localStorage.getItem(draftKey())||'null');}catch(e){}
    if(dr&&dr.type==='task-edit'){dr._draft=true;dr.remind_at=dr.remind_at||[];dr.rule=dr.rule||{};dr.recur_days=dr.recur_days||[];UI.sheet=dr;renderSheet(true);return;}}
  var d={type:'task-edit',title:title||'',details:'',list_id:UI.view==='tasks'&&UI.filter!=='all'?UI.filter:null,prio:0,recur:'none',recur_n:2,recur_days:[],remind_at:[],rule:{},remind_every:10,remind_times:0};
  defaultsInto(d);if(UI.view==='calendar'){d.due_date=UI.calDay;}
  var fl=d.list_id&&findList(d.list_id);if(fl&&fl.hidden)applyTpl(d,'nodate');
  Object.assign(d,extra||{});UI.sheet=d;renderSheet(true);
}
async function moveTask(id,date){
  var t=findTask(id);if(!t)return;var b={due_date:t.due_date,due_time:t.due_time,recur:t.recur,remind_every:t.remind_every};
  var f={due_date:date,done:false};if(!date){f.due_time=null;f.recur='none';}
  closeSheet();await patchTask(id,f);toast(date?'Перенесено: '+dayWord(date).toLowerCase():'Теперь без срока',function(){patchTask(id,b);});
}

/* =================== Действия =================== */
var A={
  toLogin:function(){authScreen('login');},toReset:function(){authScreen('reset');},
  go:function(v){UI.view=v;if(v==='tasks')UI.filter='all';UI.sel=null;render();try{window.scrollTo(0,0);}catch(e){}},
  filter:function(v){UI.view='tasks';UI.filter=v;UI.sel=null;render();},
  add:function(){var qi=document.getElementById('qin');var v=qi&&qi.value.trim();if(v){var p=parseQuick(v);UI.quick='';openAdd(p.title,p.due_date?{due_date:p.due_date,due_time:p.due_time,tpl:null}:{});}else openAdd('');},
  chk:function(v,id,el){var t=findTask(id);if(!t)return;if(el&&SET.rewards){el.classList.add('pop');}if(t.done)reopenTask(id);else completeTask(id);},
  open:function(v,id){openTask(id);},
  closeDetail:function(){UI.sel=null;render();},
  edit:function(v,id){var t=findTask(id),s=UI.sheet=Object.assign({type:'task-edit',tpl:null},JSON.parse(JSON.stringify(t)));s.recur_days=s.recur_days||[];s.remind_at=s.remind_at||[];s.rule=s.rule||{};
    if(s.recur==='days'){s.recur='custom';s.rule={unit:'week',every:1,days:s.recur_days.slice(),mode:'date',nth:1,wd:0,from:'date'};}
    else if(s.recur==='everyN'){s.recur='custom';s.rule={unit:'day',every:s.recur_n||2,days:[],mode:'date',nth:1,wd:0,from:'date'};}
    renderSheet(true);},
  del:function(v,id){deleteTask(id);},
  moveOpen:function(v,id){UI.sheet={type:'move',id:id};renderSheet(true);},
  sendOpen:function(v,id){UI.sheet={type:'send',id:id};renderSheet(true);},
  sendTo:async function(v,id){closeSheet();if(v){await patchTask(id,{assignee:v,status:'pending'});toast('Отправлено: '+pname(v));}else{await patchTask(id,{assignee:null,status:'active'});toast('Задача снова твоя');}},
  accept:async function(v,id){await patchTask(id,{status:'active'});toast('Задача принята');},
  decline:async function(v,id){await patchTask(id,{status:'declined'});if(UI.sel===id)UI.sel=null;closeSheet();toast('Задача отклонена');},
  subChk:function(v,id){var t=findTask(id);patchTask(id,{subs:(t.subs||[]).map(function(s){return s.id===v?Object.assign({},s,{done:!s.done}):s;})});},
  subDel:function(v,id){var t=findTask(id);patchTask(id,{subs:(t.subs||[]).filter(function(s){return s.id!==v;})});},
  saveTask:async function(){
    var s=UI.sheet;if(!s.title||!s.title.trim()){toast('Напиши, что нужно сделать');return;}
    if(s.due_date&&s.recur==='custom'&&s.rule&&s.rule.unit==='week'&&!(s.rule.days&&s.rule.days.length)){toast('Выбери хотя бы один день недели');return;}
    var rule={};if(s.due_date&&s.recur==='custom'){rule=Object.assign({},s.rule);rule.every=Math.max(1,+rule.every||1);if(rule.unit==='month'&&(rule.mode||'date')==='date')rule.mday=fromKey(s.due_date).getDate();}
    var f={title:s.title.trim(),details:s.details||'',list_id:s.list_id||null,prio:+s.prio||0,due_date:s.due_date||null,due_time:s.due_date?(s.due_time||null):null,remind_every:s.due_date&&s.due_time?+s.remind_every||0:0,remind_times:+s.remind_times||0,remind_at:s.remind_at||[],recur:s.due_date?s.recur:'none',recur_n:+s.recur_n||2,recur_days:s.recur_days||[],rule:rule};
    if(!s.id)clearDraft();
    closeSheet();
    if(s.id){await patchTask(s.id,f);toast('Сохранено');}
    else{var r=await createTask(f);if(r)toast('Добавлено: '+(r.due_date?dayWord(r.due_date).toLowerCase()+(r.due_time?' в '+r.due_time:''):'без срока'));}
  },
  set:function(v,id,el){
    var k=el.getAttribute('data-k'),s=UI.sheet,t=T();
    if(k.indexOf('s_')===0){var sk=k.slice(2);if(sk==='autoMove'||sk==='rewards'||sk==='assistant'||sk==='showTpl')SET[sk]=v==='1';else SET[sk]=v;saveSettings();render();return;}
    if(k.indexOf('sd_')===0){var dk2=k.slice(3);SET.def[dk2]=(dk2==='every'||dk2==='times')?+v:v;if(dk2==='time'&&v==='fixed'&&!SET.def.at)SET.def.at='09:00';saveSettings();renderSheet();return;}
    if(k.indexOf('r_')===0){var rk=k.slice(2);s.rule=s.rule||defRule(s);s.rule[rk]=(rk==='every'||rk==='nth'||rk==='wd')?+v:v;if(rk==='unit'&&v==='week'&&!(s.rule.days&&s.rule.days.length))s.rule.days=[s.due_date?dow(s.due_date):0];renderSheet();return;}
    if(k==='tpl')applyTpl(s,v);
    else if(k==='datekey'){s.tpl=null;s.due_date=v==='today'?t:v==='tomorrow'?addDays(t,1):null;}
    else if(k==='move'){moveTask(s.id,v==='none'?null:addDays(t,+v));return;}
    else if(k==='hidden')s.hidden=v==='1';
    else if(k==='list_id')s.list_id=v||null;
    else if(['remind_every','remind_times','recur_n','prio','target'].indexOf(k)>=0){s[k]=+v;s.tpl=null;}
    else if(k==='due_time'){s.due_time=v||null;s.tpl=null;}
    else if(k==='remind'){s.remind=v||null;}
    else if(k==='wkday'){s.due_date=nextWd([+v]);s.tpl=null;}
    else{if(k==='recur'&&v!=='none'&&!s.due_date){s.due_date=T();s.due_time=null;}s[k]=v;if(k==='recur'){s.tpl=null;if(v==='custom'&&!(s.rule&&s.rule.unit))s.rule=defRule(s);}}
    renderSheet();
  },
  custom:function(v,id,el){
    var k=el.getAttribute('data-k'),s=UI.sheet;
    var cur0=k==='r_every'?(s.rule&&s.rule.every):k.indexOf('def_')===0?SET.def[k.slice(4)]:k!=='moveN'?s[k]:'';var n=prompt('Своё значение'+(v?' ('+v+')':''),cur0!=null?cur0:'');if(n===null)return;n=parseInt(String(n).replace(/[^0-9]/g,''),10);
    var max={remind_every:720,remind_times:100,recur_n:365,target:100,moveN:365,r_every:365,def_every:720,def_times:100}[k]||999;
    if(!(n>=1&&n<=max)){toast('Нужно число от 1 до '+max);return;}
    if(k==='moveN'){moveTask(s.id,addDays(T(),n));return;}
    if(k==='r_every'){s.rule.every=n;renderSheet();return;}
    if(k.indexOf('def_')===0){SET.def[k.slice(4)]=n;saveSettings();renderSheet();return;}
    s[k]=n;s.tpl=null;renderSheet();
  },
  rday:function(v){var a=UI.sheet.recur_days,i=a.indexOf(+v);if(i>=0)a.splice(i,1);else a.push(+v);renderSheet();},
  hday:function(v){var a=UI.sheet.days,i=a.indexOf(+v);if(i>=0)a.splice(i,1);else a.push(+v);renderSheet();},
  saveTpl:async function(){var s=UI.sheet,n=prompt('Название шаблона, например «Стирка»');if(!n||!n.trim())return;
    var data={off:s.due_date?diff(s.due_date,T()):null,due_time:s.due_time,remind_every:s.remind_every,remind_times:s.remind_times,remind_at:s.remind_at||[],recur:s.recur,recur_n:s.recur_n,recur_days:s.recur_days,rule:s.rule||{},prio:s.prio,list_id:s.list_id};
    try{var r=await q(sb.from('templates').insert({name:n.trim().slice(0,40),data:data}).select().single());D.templates.push(r);s.tpl='u:'+r.id;renderSheet();toast('Шаблон сохранён');}catch(e){err(e);}},
  tplDel:async function(v,id){try{await q(sb.from('templates').delete().eq('id',id));D.templates=D.templates.filter(function(x){return x.id!==id;});renderSheet();toast('Шаблон удалён');}catch(e){err(e);}},
  close:function(){userClose();},
  ovClose:function(v,id,el,e){if(e.target===el)userClose();},
  draftClear:function(){clearDraft();UI.sheet=null;openAdd('');},
  remAtDel:function(v){UI.sheet.remind_at=(UI.sheet.remind_at||[]).filter(function(x){return x!==v;});renderSheet();},
  rwd:function(v){var s=UI.sheet,a=s.rule.days=s.rule.days||[],i=a.indexOf(+v);if(i>=0)a.splice(i,1);else a.push(+v);if(a.length&&s.due_date&&a.indexOf(dow(s.due_date))<0&&s.rule.unit==='week')s.due_date=nextWd(a);renderSheet();},
  undo:function(){if(undoFn){var f=undoFn;undoFn=null;document.getElementById('toast').classList.remove('show');f();}},
  /* календарь */
  calMode:function(v){UI.cal=v;render();},
  calNav:function(v){var n=+v,k=UI.calDay;UI.calDay=UI.cal==='day'?addDays(k,n):UI.cal==='week'?addDays(k,7*n):UI.cal==='month'?addMonths(k,n):keyOf(new Date(fromKey(k).getFullYear()+n,0,1));render();},
  calToday:function(){UI.calDay=T();render();},
  calPick:function(v){UI.calDay=v;render();},
  calPickDay:function(v){UI.calDay=v;UI.cal='day';render();},
  /* привычки */
  habNew:function(){UI.sheet={type:'habit-edit',name:'',icon:'book',color:COLORS[D.habits.length%COLORS.length],target:1,dmode:'all',days:[],remind:'09:00',times:['09:00'],remind_every:0};renderSheet(true);},
  habOpen:function(v,id){UI.sheet={type:'habit',id:id,off:0};renderSheet(true);},
  habTap:async function(v,id){var h=findHabit(id),t=T();if(h.paused||!sched(h,t)){A.habOpen(v,id);return;}
    var c=cnt(h,t);if(c>=tgt(h)){await setMark(h,t,0);toast('Отметка снята: '+h.name,function(){setMark(h,t,c);});}
    else{await setMark(h,t,c+1);toast(c+1>=tgt(h)?(SET.rewards?'Отлично! ':'')+h.name+': выполнено'+(SET.rewards&&streak(h)>1?', '+streak(h)+' '+plural(streak(h),'день','дня','дней')+' подряд':''):h.name+': '+(c+1)+' из '+tgt(h),function(){setMark(h,t,c);});}},
  habPlus:function(v,id){var h=findHabit(id);setMark(h,T(),cnt(h,T())+1);},
  habMinus:function(v,id){var h=findHabit(id);setMark(h,T(),cnt(h,T())-1);},
  habDay:function(v,id){var h=findHabit(id);setMark(h,v,hDone(h,v)?0:tgt(h));},
  hwk:function(v){var n=(UI.sheet.off||0)+(+v);if(n>0)return;UI.sheet.off=n;renderSheet();},
  habPause:async function(v,id){var h=findHabit(id);h.paused=!h.paused;renderSheet();render();try{await q(sb.from('habits').update({paused:h.paused}).eq('id',id));}catch(e){err(e);}},
  habFinish:async function(v,id){var h=findHabit(id);if(!confirm('Завершить привычку «'+h.name+'»? Она уйдёт из списка, отметки останутся в дневнике.'))return;h.finished=true;closeSheet();render();try{await q(sb.from('habits').update({finished:true}).eq('id',id));}catch(e){err(e);}},
  habEdit:function(v,id){var h=findHabit(id),ds=h.days||[],wk=ds.length===5&&ds.indexOf(5)<0&&ds.indexOf(6)<0;UI.sheet={type:'habit-edit',id:id,name:h.name,icon:h.icon,color:h.color,target:h.target,dmode:!ds.length?'all':wk?'wk':'pick',days:ds.slice(),remind:h.remind,times:[h.remind].concat(h.remind_at||[]).filter(Boolean),remind_every:h.remind_every||0};renderSheet(true);},
  habDel:async function(v,id){if(!confirm('Удалить привычку вместе со всеми отметками?'))return;D.habits=D.habits.filter(function(h){return h.id!==id;});closeSheet();render();try{await q(sb.from('habits').delete().eq('id',id));toast('Привычка удалена');}catch(e){err(e);}},
  saveHabit:async function(){var s=UI.sheet;if(!s.name||!s.name.trim()){toast('Напиши название');return;}
    var days=s.dmode==='all'?[]:s.dmode==='wk'?[0,1,2,3,4]:s.days.slice().sort();if(s.dmode==='pick'&&!days.length){toast('Выбери хотя бы один день');return;}
    var tms=(s.times||[]).slice().sort();var f={name:s.name.trim(),icon:s.icon,color:s.color,target:+s.target||1,days:days,remind:tms[0]||null,remind_at:tms.slice(1),remind_every:tms.length?(+s.remind_every||0):0};closeSheet();
    try{if(s.id){var r=await q(sb.from('habits').update(f).eq('id',s.id).select().single());Object.assign(findHabit(s.id),r);}else{var n=await q(sb.from('habits').insert(f).select().single());D.habits.push(n);}render();toast(s.id?'Сохранено':'Привычка создана');}catch(e){err(e);}},
  /* списки */
  lists:function(){UI.sheet={type:'lists'};renderSheet(true);},
  listNew:function(){var back=UI.sheet&&UI.sheet.type==='task-edit'?UI.sheet:null;UI.sheet={type:'list-edit',name:'',color:LCOLORS[D.lists.length%LCOLORS.length],hidden:false,members:[],owner:ME,back:back};renderSheet(true);},
  listEdit:function(v,id){var l=findList(id);UI.sheet={type:'list-edit',id:id,name:l.name,color:l.color,hidden:l.hidden,owner:l.owner,members:listMembers(id)};renderSheet(true);},
  member:function(v){var a=UI.sheet.members,i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);renderSheet();},
  saveList:async function(){var s=UI.sheet;if(!s.name||!s.name.trim()){toast('Напиши название списка');return;}
    var f={name:s.name.trim(),color:s.color,hidden:!!s.hidden};
    try{var id=s.id;
      if(id){await q(sb.from('lists').update(f).eq('id',id));}else{var r=await q(sb.from('lists').insert(f).select().single());id=r.id;D.lists.push(r);}
      if(s.owner===ME){var cur=listMembers(id);var add=s.members.filter(function(x){return cur.indexOf(x)<0;}),rem=cur.filter(function(x){return s.members.indexOf(x)<0;});
        if(add.length)await q(sb.from('list_members').insert(add.map(function(u){return{list_id:id,user_id:u};})));
        for(var i=0;i<rem.length;i++)await q(sb.from('list_members').delete().eq('list_id',id).eq('user_id',rem[i]));}
      await loadAll();
      if(s.back){s.back.list_id=id;UI.sheet=s.back;renderSheet(true);}else{UI.sheet={type:'lists'};renderSheet();}
      render();toast(s.id?'Список сохранён':'Список создан');
    }catch(e){err(e);}},
  delList:async function(){var s=UI.sheet;if(!confirm('Удалить список «'+s.name+'»? Задачи останутся, но без списка.'))return;
    try{await q(sb.from('lists').delete().eq('id',s.id));if(UI.filter===s.id)UI.filter='all';await loadAll();UI.sheet={type:'lists'};renderSheet();render();toast('Список удалён');}catch(e){err(e);}},
  leaveList:async function(){var s=UI.sheet;if(!confirm('Выйти из общего списка «'+s.name+'»?'))return;
    try{await q(sb.from('list_members').delete().eq('list_id',s.id).eq('user_id',ME));if(UI.filter===s.id)UI.filter='all';await loadAll();closeSheet();render();}catch(e){err(e);}},
  /* заметки */
  noteNew:async function(){try{var n=await q(sb.from('notes').insert({title:'',body:''}).select().single());D.notes.unshift(n);openNote(n.id);}catch(e){err(e);}},
  daily:async function(){var t=T(),n=D.notes.filter(function(x){return x.daily===t&&x.owner===ME;})[0];
    if(!n){try{n=await q(sb.from('notes').insert({title:fmtLong(t),body:'Главное на сегодня:\n- \n\nМысли:\n',daily:t}).select().single());D.notes.unshift(n);}catch(e){return err(e);}}openNote(n.id);},
  noteOpen:function(v,id){openNote(id);},
  noteBack:function(){closeNote();},
  noteTask:function(){var n=findNote(UI.noteId);openAdd(n?n.title:'',{details:n?n.body:''});},
  noteDel:async function(){var n=findNote(UI.noteId);if(n.owner!==ME){if(!confirm('Убрать эту заметку у себя? У автора она останется.'))return;D.notes=D.notes.filter(function(x){return x!==n;});UI.noteId=null;renderNote();render();try{await q(sb.from('note_members').delete().eq('note_id',n.id).eq('user_id',ME));D.nmembers=D.nmembers.filter(function(m){return !(m.note_id===n.id&&m.user_id===ME);});}catch(e){err(e);}return;}
    if(!confirm(noteMembers(n.id).length?'Удалить заметку? Она пропадёт и у тех, с кем ты ею поделился.':'Удалить заметку?'))return;D.notes=D.notes.filter(function(x){return x!==n;});UI.noteId=null;renderNote();render();try{await q(sb.from('notes').delete().eq('id',n.id));}catch(e){err(e);}},
  noteShare:function(){var n=findNote(UI.noteId);UI.sheet={type:'note-share',id:n.id,members:noteMembers(n.id)};renderSheet(true);},
  nmember:function(v){var a=UI.sheet.members,i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);renderSheet();},
  saveNoteShare:async function(){var s=UI.sheet,n=findNote(s.id);if(!n)return closeSheet();
    var cur=noteMembers(s.id),add=s.members.filter(function(x){return cur.indexOf(x)<0;}),rem=cur.filter(function(x){return s.members.indexOf(x)<0;});
    try{await saveNote(n);
      if(add.length){var rows=await q(sb.from('note_members').insert(add.map(function(u){return{note_id:s.id,user_id:u};})).select());D.nmembers=D.nmembers.concat(rows);}
      for(var i=0;i<rem.length;i++){await q(sb.from('note_members').delete().eq('note_id',s.id).eq('user_id',rem[i]));}
      D.nmembers=D.nmembers.filter(function(m){return !(m.note_id===s.id&&rem.indexOf(m.user_id)>=0);});
      closeSheet();renderNote();toast(add.length?'Отправлено: '+add.map(pname).join(', '):rem.length?'Доступ убран':'Без изменений');}catch(e){err(e);}},
  passOpen:function(){UI.sheet={type:'pass'};renderSheet(true);setTimeout(function(){var p=document.getElementById('p1');if(p)p.focus();},200);},
  passSave:async function(v,id,el){var a=document.getElementById('p1').value,b=document.getElementById('p2').value,e=document.getElementById('perr');
    if(a.length<8){e.textContent='Нужно минимум 8 символов';return;}if(a!==b){e.textContent='Пароли не совпадают';return;}
    el.disabled=true;try{await q(sb.auth.updateUser({password:a}));closeSheet();toast('Пароль изменён');}catch(x){e.textContent=/same/i.test(x.message)?'Новый пароль совпадает со старым':x.message;el.disabled=false;}},
  mic:function(v){startVoice(v);},
  tpOpen:function(v,id,el){tpOpen(v,el.getAttribute('data-cur'));},
  tpH:function(v){TP.h=+v;TP.step='m';tpRender();},
  tpM:function(v){TP.m=+v;tpDone();},
  tpStep:function(v){TP.step=v;tpRender();},
  tpFine:function(v){var t=(TP.h*60+TP.m+(+v)+1440)%1440;TP.h=Math.floor(t/60);TP.m=t%60;tpRender();},
  tpOk:function(){tpDone();},
  tpClose:function(v,id,el,e){if(e.target===el){TP=null;tpRender();}},
  tpClose2:function(){TP=null;tpRender();},
  htime:function(v){var a=UI.sheet.times=UI.sheet.times||[],i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);a.sort();renderSheet();},
  asOn:function(){SET.assistant=true;saveSettings();render();},
  asClear:function(){if(!confirm('Очистить переписку с помощником?'))return;AS.msgs=[];asSave();render();},
  asPlan:function(){askAssistant('plan','План на сегодня');},
  asNotes:function(){askAssistant('notes','Разобрать заметки');},
  asAdd:async function(v){var p=v.split(':');var r=await asAddTask(+p[0],+p[1]);if(r)toast('Добавлено: '+r.title);},
  asAddAll:async function(v){var m=AS.msgs[+v],n=0;for(var i=0;i<m.tasks.length;i++){if(!m.tasks[i]._added&&await asAddTask(+v,i))n++;}toast('Добавлено задач: '+n);},
  asMove:async function(v){var p=v.split(':'),mv=AS.msgs[+p[0]].moves[+p[1]];var f={due_date:/^\d{4}-\d{2}-\d{2}$/.test(mv.due_date||'')?mv.due_date:null};if(!f.due_date){f.due_time=null;f.recur='none';}await patchTask(mv.task_id,f);mv._done=true;asSave();render();toast('Перенесено');},
  noteAsk:function(){var n=findNote(UI.noteId);if(!n)return;if(!SET.assistant){closeNote();UI.view='assistant';render();return;}saveNote(n);closeNote();askAssistant('notes','Разобрать заметку «'+(n.title||'без названия')+'»',n.id);},
  pushOn:function(v,id,el){el.disabled=true;pushEnable();},
  pushOff:function(){pushDisable();},
  pushTest:function(){pushTest();},
  settings:function(){UI.sheet={type:'settings'};renderSheet(true);pushCheck().then(function(){if(UI.sheet&&UI.sheet.type==='settings')renderSheet();});},
  logout:async function(){if(!confirm('Выйти из аккаунта на этом устройстве?'))return;closeSheet();await sb.auth.signOut();location.reload();}
};

/* редактор заметки */
var noteTimer=null;
function openNote(id){UI.noteId=id;renderNote();}
function renderNote(){
  var root=document.getElementById('note'),n=UI.noteId&&findNote(UI.noteId);
  if(!n){root.innerHTML='';return;}
  var mine=n.owner===ME,nm=noteMembers(n.id),info=[];if(n.daily)info.push('Заметка дня');if(!mine)info.push('от '+pname(n.owner)+', общая');else if(nm.length)info.push('общая с '+nm.map(pname).join(', '));
  root.innerHTML='<div class="editor"><div class="bar"><button class="iconbtn" data-a="noteBack" aria-label="Назад">'+I('left')+'</button><span class="sp"></span>'+(mine&&others().length?'<button class="btn2" data-a="noteShare">'+I('users')+'Поделиться</button>':'')+'<button class="btn2" data-a="noteAsk">'+I('spark')+'Разобрать</button><button class="btn2" data-a="noteTask">'+I('tasks')+'Задача</button><button class="iconbtn" data-a="noteDel" aria-label="'+(mine?'Удалить заметку':'Убрать у себя')+'">'+I(mine?'trash':'out')+'</button></div><div class="body">'+(info.length?'<div class="muted" style="font-size:13px">'+esc(info.join(' · '))+'</div>':'')+'<input id="nt" placeholder="Название" aria-label="Название заметки" value="'+esc(n.title)+'"><textarea id="nb" placeholder="Текст заметки" aria-label="Текст заметки">'+esc(n.body)+'</textarea></div></div>';
  var ti=root.querySelector('#nt'),bo=root.querySelector('#nb');
  function upd(){n.title=ti.value;n.body=bo.value;n.updated_at=new Date().toISOString();clearTimeout(noteTimer);noteTimer=setTimeout(function(){saveNote(n);},600);}
  ti.addEventListener('input',upd);bo.addEventListener('input',upd);
  if(!n.title&&!n.body)setTimeout(function(){ti.focus();},150);
}
function saveNote(n){return q(sb.from('notes').update({title:n.title,body:n.body}).eq('id',n.id)).catch(err);}
async function closeNote(){var n=findNote(UI.noteId);clearTimeout(noteTimer);UI.noteId=null;renderNote();
  if(n){if(n.owner===ME&&!n.title.trim()&&!n.body.trim()&&!noteMembers(n.id).length){D.notes=D.notes.filter(function(x){return x!==n;});q(sb.from('notes').delete().eq('id',n.id)).catch(function(){});}else saveNote(n);}
  render();}

/* =================== События =================== */
var lp=null,lpFired=false,sw=null;
document.addEventListener('pointerdown',function(e){
  var row=e.target.closest('[data-swipe]');if(row&&!isPC())sw={id:row.getAttribute('data-swipe'),x:e.clientX,y:e.clientY,el:row};
  var b=e.target.closest('[data-lp]');if(!b)return;lpFired=false;
  lp=setTimeout(function(){lpFired=true;var id=b.getAttribute('data-id');UI.sheet=b.getAttribute('data-lp')==='habit'?{type:'habit',id:id,off:0}:{type:'move',id:id};renderSheet(true);if(navigator.vibrate)try{navigator.vibrate(12);}catch(x){}},480);
});
document.addEventListener('pointermove',function(e){
  if(lp&&(Math.abs(e.movementX||0)+Math.abs(e.movementY||0)>6)){clearTimeout(lp);lp=null;}
  if(sw){var dx=e.clientX-sw.x;if(dx<0&&Math.abs(e.clientY-sw.y)<30)sw.el.style.transform='translateX('+Math.max(dx,-90)+'px)';}
},true);
document.addEventListener('pointerup',function(e){clearTimeout(lp);lp=null;
  if(sw){var dx=e.clientX-sw.x,dy=Math.abs(e.clientY-sw.y);sw.el.style.transform='';if(dx<-60&&dy<30){lpFired=true;UI.sheet={type:'move',id:sw.id};renderSheet(true);}sw=null;}},true);
document.addEventListener('pointercancel',function(){clearTimeout(lp);lp=null;if(sw){sw.el.style.transform='';sw=null;}},true);
document.addEventListener('contextmenu',function(e){if(e.target.closest('.hab,.task'))e.preventDefault();});
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-a]');if(!el)return;var a=el.getAttribute('data-a');
  if(lpFired&&(a==='habTap'||a==='open'||a==='chk')){lpFired=false;return;}
  if(A[a]){if(el.tagName==='BUTTON'&&el.type==='submit')e.preventDefault();A[a](el.getAttribute('data-v'),el.getAttribute('data-id'),el,e);}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(TP){TP=null;tpRender();}else if(UI.sheet)userClose();else if(UI.noteId)closeNote();else if(UI.sel){UI.sel=null;render();}}});

/* =================== Запуск =================== */
var starting=false;
async function start(){
  if(starting)return;starting=true;try{await start2();}finally{starting=false;}
}
async function start2(){
  var s=await sb.auth.getSession();var session=s.data&&s.data.session;
  if(!session){ME=null;authScreen('login',HASH_ERROR?decodeURIComponent(HASH_ERROR.replace(/\+/g,' ')):'');return;}
  ME=session.user.id;
  if(FROM_INVITE||FROM_RECOVERY){authScreen('setpass');return;}
  document.getElementById('app').innerHTML='<div class="loading">Загружаю…</div>';
  try{await loadAll();}catch(e){document.getElementById('app').innerHTML='<div class="loading">Не удалось загрузить данные: '+esc(e.message)+'</div>';return;}
  applyTheme();render();subscribe();
  try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz&&SET.tz!==tz){SET.tz=tz;saveSettings();}}catch(e){}
  var pt=new URLSearchParams(location.search).get('task');if(pt){history.replaceState(null,'',location.pathname);if(findTask(pt))openTask(pt);}
}
sb.auth.onAuthStateChange(function(ev,session){
  if(ev==='PASSWORD_RECOVERY'){FROM_RECOVERY=true;ME=session&&session.user.id;authScreen('setpass');return;}
  if(ev==='SIGNED_IN'&&!ME&&!starting){setTimeout(start,0);}
  if(ev==='SIGNED_OUT'){ME=null;authScreen('login');}
});
applyTheme();
start();
window.__app={A:A,UI:UI,D:D,parseQuick:parseQuick,nextOcc:nextOcc};
})();
