/* Недельный разбор выбранной цели: факты → решение → личная заметка. */
(function(){
  'use strict';
  var X=window.__app,A=X.A,E=X.esc,owner=null,state=null,saving=false,planning=false,opened=false,error='';
  var choices={keep:'Оставить как есть',reduce:'Упростить шаг или расписание',pause:'Взять паузу',replace:'Попробовать другое действие'};
  function sync(g,r){
    var user=X.ME,key=user+':'+g.id+':'+r.end;
    if(owner===user&&state&&state.key===key)return;
    owner=user;saving=false;planning=false;opened=false;error='';state={key:key,choice:'',step:'',noteId:null,taskId:null,plan:null};
    try{
      var s=JSON.parse(localStorage.getItem('zd-cycle-review-'+user)||'null');
      if(s&&s.key===key)state=Object.assign(state,s);
    }catch(e){}
  }
  function persist(){
    if(owner&&X.ME===owner&&state)try{localStorage.setItem('zd-cycle-review-'+owner,JSON.stringify(state));}catch(e){}
  }
  function period(g,data){
    var t=X.T(),end=X.addDays(t,-1),start=X.addDays(t,-7),user=X.ME;
    function within(d){return typeof d==='string'&&d>=start&&d<=end&&(!g.started_on||d>=g.started_on);}
    var hIds=new Set(g.link_habit_ids||[]),tIds=new Set(g.link_task_ids||[]);
    var habits=X.D.habits.filter(function(h){return h.owner===user&&hIds.has(h.id);}).map(function(h){
      var full=0,partial=0,unlogged=0,unknown=0;
      // Archived or paused habits have no reliable past schedule; preserve their factual marks only.
      for(var i=0;i<7;i++){
        var d=X.addDays(start,i);if(!within(d)||!h.started_on||d<h.started_on)continue;
        var count=X.cnt(h,d),expected=!h.finished&&!h.paused&&X.sched(h,d);
        if(count>=X.tgt(h))full++;else if(count>0)partial++;else if(expected){if(X.historyKnown('marks',d))unlogged++;else unknown++;}
      }
      return{id:h.id,name:h.name,full:full,partial:partial,unlogged:unlogged,unknown:unknown,paused:h.paused,finished:h.finished};
    });
    var tOwn=new Set(X.D.tasks.filter(function(t){return t.owner===user&&tIds.has(t.id);}).map(function(t){return t.id;}));
    var log=X.D.log.filter(function(l){return l.user_id===user&&tOwn.has(l.task_id)&&within(l.day);});
    var first=g.started_on&&g.started_on>start?g.started_on:start,logPartial=tOwn.size&&first<=end&&!X.historyKnown('log',first);
    var practice=data.sessions.filter(function(s){return s.owner===user&&s.goal_id===g.id&&within(s.day);});
    var checkins=data.checkins.filter(function(c){return c.owner===user&&within(c.day);});
    var m=practice.reduce(function(sum,s){return sum+(Number(s.minutes)||0);},0);
    return{start:start,end:end,habits:habits,tasks:tOwn.size,log:log.length,logPartial:logPartial,practice:practice.length,minutes:m,checkins:checkins.length,empty:!(habits.some(function(h){return h.full||h.partial;})||log.length||practice.length||checkins.length)};
  }
  function habitLine(h){
    var parts=[h.full+' '+X.plural(h.full,'день','дня','дней')+' с полной отметкой'];
    if(h.partial)parts.push(h.partial+' частичных');
    if(h.unlogged)parts.push(h.unlogged+' без отметки');
    if(h.unknown)parts.push(h.unknown+' не полностью загружено');
    if(h.finished)parts.push('завершена');else if(h.paused)parts.push('на паузе');
    return h.name+' — '+parts.join(' · ');
  }
  function facts(r){
    return[
      (r.tasks?'Связанные задачи: '+r.log+' '+X.plural(r.log,'отметка','отметки','отметок')+' выполнения за период.'+(r.logPartial?' Часть журнала не загружена.':''):'Нет связанных задач.'),
      (r.practice?'Практика по цели: '+r.minutes+' мин, '+r.practice+' занятий.':'Нет записей практики по этой цели.'),
      'Проверки состояния: '+r.checkins+' за период (по всем направлениям).'
    ];
  }
  function ownNote(id){return id&&X.D.notes.find(function(n){return n.owner===X.ME&&n.id===id;});}
  function ownTask(id){return id&&X.D.tasks.find(function(t){return t.owner===X.ME&&t.id===id;});}
  function plannedTitle(note){
    var m=String(note.body||'').match(/(?:^|\n)Следующее действие:[ \t]*([^\n]+)/);
    return m?m[1].trim().slice(0,200):'';
  }
  function planView(g,note){
    var task=ownTask(state.taskId),link=task&&(g.link_task_ids||[]).includes(task.id),p=state.plan,suggest=plannedTitle(note);
    if(link)return '<div class="cycle-review-planned"><p><b>В календаре:</b> '+E(task.title)+(task.due_date?' · '+E(X.fmtDM(task.due_date)):'')+'</p><button class="btn2" type="button" data-a="grOpenTask" data-v="'+E(task.id)+'">Открыть задачу</button></div>';
    if(!p&&!task&&!suggest)return'';
    if(!p&&!task)return '<button class="btn2" type="button" data-a="cycleReviewPlan" data-v="'+E(note.id)+'">Запланировать следующий шаг</button>';
    var disabled=planning?' disabled':'',notice=task?'Задача уже в календаре. Осталось связать её с целью.':'Задача появится в календаре и будет связана с этой целью. Напоминание можно настроить в карточке задачи.';
    return '<form id="cycle-review-plan" data-goal="'+E(g.id)+'" data-note="'+E(note.id)+'" aria-label="Следующий шаг в календаре">'+
      '<p class="muted">'+E(notice)+'</p>'+
      (task?'<p><b>'+E(task.title)+'</b>'+(task.due_date?' · '+E(X.fmtDM(task.due_date)):'')+'</p>':
      '<div class="cycle-start-fields"><label for="cycle-plan-title"><span>Что сделать</span>'+FORMUI.line('class="fld" id="cycle-plan-title" name="title" maxlength="200" required'+disabled,p.title)+'</label>'+
      '<label for="cycle-plan-day"><span>На какую дату</span><input class="fld" id="cycle-plan-day" name="day" type="date" min="'+E(X.T())+'" required value="'+E(p.day)+'"'+disabled+'></label></div>')+
      (p&&p.message?'<p class="err" role="alert">'+E(p.message)+'</p>':'')+
      '<div class="cycle-actions"><button class="btn2" type="submit"'+disabled+'>'+E(planning?'Сохраняю…':task?'Связать с целью':'Добавить задачу')+'</button>'+
      (!task?'<button class="btn2" type="button" data-a="cycleReviewPlanClose"'+disabled+'>Не сейчас</button>':'')+'</div></form>';
  }
  function view(g,data){
    if(!g||!data.ok)return'';
    var r=period(g,data);sync(g,r);if(!opened)return'';
    var note=ownNote(state.noteId);
    return '<div class="cycle-review"><div class="cycle-review-head"><div><div class="cycle-index">ИТОГ ЦИКЛА</div><h2 tabindex="-1" id="cycle-review-title">Решение на следующую неделю</h2></div><button class="btn2" type="button" data-a="cycleReviewClose">Свернуть</button></div><div class="meta">'+E(X.fmtDM(r.start))+' — '+E(X.fmtDM(r.end))+'</div>'+
      '<p class="muted">Семь завершённых дней. Считаем только с начала цели. Нет отметки — не значит, что действие не было сделано.</p>'+
      (r.empty?'<p class="muted">В загруженной истории пока нет записей. Решение можно принять по своим наблюдениям.</p>':'')+
      '<ul class="cycle-review-facts">'+r.habits.map(function(h){return '<li>'+E(habitLine(h))+'</li>';}).join('')+facts(r).map(function(s){return '<li>'+E(s)+'</li>';}).join('')+'</ul>'+
      '<p class="muted">Дни привычки показаны по текущему расписанию. Сохранение итога не меняет цель, задачи или напоминания.</p>'+
      (note?'<button class="btn2" type="button" data-a="cycleReviewNote" data-v="'+E(note.id)+'">Открыть сохранённый итог</button>'+planView(g,note):
      '<form id="cycle-review-form" data-goal="'+E(g.id)+'" data-end="'+E(r.end)+'"><div class="cycle-start-fields"><label for="cycle-review-choice"><span>Что дальше?</span><select class="fld" id="cycle-review-choice" name="choice" required'+(saving?' disabled':'')+'><option value="">Выбрать решение</option>'+Object.keys(choices).map(function(k){return '<option value="'+k+'"'+(state.choice===k?' selected':'')+'>'+E(choices[k])+'</option>';}).join('')+
      '</select></label><label for="cycle-review-step"><span>Следующее действие (необязательно)</span>'+FORMUI.line('class="fld" id="cycle-review-step" name="step" maxlength="250" placeholder="Например: прогулка после обеда"'+(saving?' disabled':''),state.step)+'</label></div>'+
      (error?'<p class="err" role="alert">'+E(error)+'</p>':'')+'<button class="btn2" type="submit"'+(saving?' disabled':'')+'>'+(saving?'Сохраняю…':'Сохранить итог в заметки')+'</button></form>')+'</div>';
  }
  async function stableId(source){
    // Детерминированный UUID связывает повтор с той же записью и на другом устройстве.
    var input=new TextEncoder().encode(source);
    var bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',input)).slice(0,16);
    bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128;
    var h=Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  function noteId(user,goal,end){return stableId('zadachnik:cycle-review:v1:'+user+':'+goal+':'+end);}
  function taskId(user,note){return stableId('zadachnik:cycle-review-plan:v1:'+user+':'+note);}
  function ensure(user){if(X.ME!==user||!user)throw new Error('Аккаунт изменился. Открой свой профиль.');}
  async function save(form){
    var user=X.ME,data=window.GROWTH&&GROWTH.data(),g=data&&data.goals.find(function(g){return g.id===form.dataset.goal&&g.owner===user&&g.status==='active';});
    if(!g||!data.ok)return;
    var r=period(g,data);sync(g,r);
    if(form.dataset.end!==r.end){X.toast('Начался новый день. Проверь период перед сохранением.');X.render();return;}
    if(saving||!Object.hasOwn(choices,state.choice))return;
    var choice=state.choice,step=String(state.step||'').trim().slice(0,250),key=state.key;
    error='';saving=true;X.render();
    try{
      var id=await noteId(user,g.id,r.end);
      async function read(){
        ensure(user);var note=await X.q(X.sb.from('notes').select('*').eq('id',id).eq('owner',user).maybeSingle());
        ensure(user);return note;
      }
      var note=await read(),reused=!!note;
      if(!note){
        var body=['Цель: '+g.title,'Период: '+r.start+' — '+r.end,
          'Факты (по имеющимся записям и текущему расписанию):',...r.habits.map(habitLine),...facts(r),
          '','Решение: '+choices[choice],step?'Следующее действие: '+step:''].filter(Boolean).join('\n');
        var row={id:id,owner:user,title:'Итог недели · '+String(g.title).slice(0,70)+' · '+X.fmtDM(r.end),body:body};
        try{ensure(user);note=await X.q(X.sb.from('notes').insert(row).select().single());}
        catch(e){note=await read();if(!note)throw e;reused=true;}
      }
      ensure(user);
      if(!note||note.owner!==user)throw new Error('Не удалось проверить запись.');
      if(!ownNote(note.id))X.D.notes.unshift(note);
      if(state.key===key){state.noteId=note.id;state.step='';state.choice='';persist();}
      X.toast(reused?'Итог за этот период уже есть; он не перезаписан.':'Итог сохранён в личных заметках.');
    }catch(e){if(X.ME===user&&state.key===key)error=e.message||'Не удалось сохранить итог.';}
    finally{if(X.ME===user){if(state.key===key)saving=false;X.render();}}
  }
  function field(e){
    var el=e.target;
    if(!state||!el.form||X.ME!==owner)return;
    if(el.form.id==='cycle-review-plan'&&state.plan&&!planning){
      if(el.name==='title'||el.name==='day'){state.plan[el.name]=el.value;persist();}
      return;
    }
    if(el.form.id!=='cycle-review-form'||saving)return;
    if(el.name==='choice'&&Object.hasOwn(choices,el.value))state.choice=el.value;
    else if(el.name==='choice')state.choice='';
    if(el.name==='step')state.step=el.value;
    persist();
  }
  document.addEventListener('change',field);
  document.addEventListener('input',field);
  async function savePlan(form){
    var user=X.ME,data=window.GROWTH&&GROWTH.data(),g=data&&data.goals.find(function(g){return g.id===form.dataset.goal&&g.owner===user&&g.status==='active';});
    if(!g||!data.ok)return;
    var r=period(g,data);sync(g,r);
    var note=ownNote(state.noteId),p=state.plan,k=state.key,existing=ownTask(state.taskId);
    if(planning||!note||note.id!==form.dataset.note||(!p&&!existing))return;
    var title=p?String(p.title||'').trim():'',day=p?p.day:'',task=null;
    planning=true;if(p)p.message='';X.render();
    try{
      var expected=await noteId(user,g.id,r.end);
      if(expected!==note.id)throw new Error('Начался новый день. Открой нужный итог перед планированием.');
      var id=await taskId(user,note.id);
      async function read(){
        ensure(user);var old=await X.q(X.sb.from('tasks').select('*').eq('id',id).eq('owner',user).maybeSingle());
        ensure(user);return old;
      }
      task=await read();
      if(!task){
        if(!title||title.length>200||!GROWTH.helpers.realDay(day)||day<X.T())throw new Error('Укажи действие и дату не раньше сегодня.');
        var row={id:id,owner:user,title:title,due_date:day,due_time:null,details:'',status:'active',remind_every:0,remind_times:0,recur:'none',recur_n:2,recur_days:[],prio:0,subs:[]};
        try{ensure(user);task=await X.q(X.sb.from('tasks').insert(row).select().single());}
        catch(e){task=await read();if(!task)throw e;}
      }
      ensure(user);
      if(!task||task.owner!==user)throw new Error('Не удалось проверить задачу.');
      if(!ownTask(task.id))X.D.tasks.push(task);
      if(state.key===k){state.taskId=task.id;persist();}
      await window.CYCLE.linkRecords(g.id,{tasks:[task.id],habits:[]},user);
      ensure(user);
      if(state.key===k){state.plan=null;persist();}
      X.toast('Следующий шаг в календаре и связан с целью.');
    }catch(e){
      if(X.ME===user&&state.key===k){
        if(!state.plan)state.plan={title:title,day:day};
        state.plan.message=e.message||'Не удалось сохранить задачу.';persist();
      }
    }finally{if(X.ME===user){if(state.key===k)planning=false;X.render();}}
  }
  document.addEventListener('submit',function(e){
    if(e.target.id==='cycle-review-form'){e.preventDefault();save(e.target);}
    if(e.target.id==='cycle-review-plan'){e.preventDefault();savePlan(e.target);}
  });
  A.cycleReviewOpen=async function(id){
    var user=X.ME,data=window.GROWTH&&GROWTH.data(),g=data&&data.goals.find(function(row){return row.id===id&&row.owner===user&&row.status==='active';});
    if(!g||!data.ok)return;
    var r=period(g,data);sync(g,r);opened=true;var k=state.key;X.render();var heading=document.getElementById('cycle-review-title');if(heading)heading.focus();
    try{
      var saved=await noteId(user,g.id,r.end);
      if(X.ME===user&&state.key===k&&opened&&ownNote(saved)){
        var planned=await taskId(user,saved);
        if(X.ME!==user||state.key!==k||!opened)return;
        var changed=state.noteId!==saved||(state.taskId!==planned&&ownTask(planned));
        if(changed){state.noteId=saved;if(ownTask(planned))state.taskId=planned;persist();X.render();heading=document.getElementById('cycle-review-title');if(heading)heading.focus();}
      }
    }catch(e){}
  };
  A.cycleReviewClose=function(){opened=false;X.render();var button=document.getElementById('cycle-review-open');if(button)button.focus();};
  A.cycleReviewNote=function(id){if(ownNote(id))A.noteOpen(null,id);};
  A.cycleReviewPlan=function(id){
    var note=ownNote(id),title=note&&plannedTitle(note);
    if(!state||X.ME!==owner||state.noteId!==id||!title)return;
    state.plan={title:title,day:X.addDays(X.T(),1),message:''};persist();X.render();
    var el=document.getElementById('cycle-plan-title');if(el)el.focus();
  };
  A.cycleReviewPlanClose=function(){if(!state||planning)return;state.plan=null;persist();X.render();};
  window.CYCLEWEEK={view:view,hint:function(g,data){var r=period(g,data);return 'Факты по цели за '+r.start+' — '+r.end+': '+r.habits.map(habitLine).concat(facts(r)).join(' ')+' Пробелы не считай неудачей. Сводка основана на текущем расписании.';}};
})();
