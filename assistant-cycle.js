/* Сквозные сценарии помощника и недельный цикл. Запросы и записи подтверждаются отдельно. */
(function () {
  'use strict';
  var X=window.__app,A=X.A,E=X.esc,R=null,owner=null,focusId='',busy=false,noFocus=false,drafts=new Map();
  var scenes={
    tasks:['Задачи','Выбрать главное','Помоги расставить приоритеты в задачах. Выбери одно главное дело, предложи его первый шаг и скажи, что можно отложить.','tasks'],
    inbox:['Входящие','Разобрать входящие','Помоги разобрать входящие: что принять в работу, что уточнить и что отложить. Не меняй статус чужих задач.','inbox'],
    calendar:['Календарь','Найти время для привычки','Помоги найти в выбранном дне посильное окно для привычки или задачи. Не считай отсутствие записей гарантией свободного времени.','cal'],
    habits:['Привычки','Настроить привычку','Помоги закрепить или упростить одну привычку. Предложи связку «после уже знакомого действия — маленький шаг», минимум на сложный день и способ вернуться после пропуска.','drop'],
    diary:['Дневник','Разобрать отметки','Используй сводку отметок задач и обычных привычек из контекста. Это не текст заметок. Не додумывай пропуски и причины; задай один вопрос, который поможет проверить объяснение.','book'],
    notes:['Заметки','Разобрать мысль и выбрать действие','Отдели то, что я действительно наблюдал, от моего объяснения. Предложи одно возможное другое объяснение и одну проверку в реальной жизни. Не считай черновые мысли обещаниями; если данных мало, уточни один факт.','note'],
    food:['Питание','Сделать план реальным','Помоги упростить план питания с учётом того, что реально записано, и моего расписания. Не смешивай план и факт. Не предлагай компенсировать еду.','leaf'],
    kitchen:['Кухня','Собрать простой вариант еды','Помоги выбрать простой вариант еды с учётом доступных продуктов и техники. Уточни неизвестное количество. Не предлагай отмечать готовку как сделанную заранее.','coffee'],
    fit:['Тренировки','Подобрать нагрузку','Помоги подобрать посильный следующий тренировочный шаг с учётом фактической нагрузки, восстановления и расписания. Предложи вариант на день с малой энергией.','dumb'],
    well:['Здоровье','Выбрать шаг для восстановления','Помоги увидеть бытовые сигналы восстановления в доступных данных и выбрать посильную привычку. Не ставь диагноз и не меняй лечение или дозировки.','heart'],
    support:['Поддержка','Подготовить план на сложный день','Помоги заметить, что обычно мешает, и составить план «если — то» на сложный день. Предложи короткое поддерживающее напоминание только если оно уместно.','heart'],
    growth:['Цели','Связать цель с действиями','Помоги превратить выбранную цель в недельный эксперимент: одна привычка, одно действие и способ проверить результат. Сначала используй существующие задачи и привычки.','star'],
    skills:['Практика','Спланировать короткую практику','Помоги выбрать короткое упражнение на основе моей цели и предыдущей практики. Не записывай занятие как выполненное, пока я его не сделал.','music'],
    checkin:['Состояние','Адаптировать нагрузку','Учитывая только доступные отметки состояния, помоги выбрать посильное действие и вариант отдыха. Пропуск записи не считай неудачей. Не ставь диагноз.','moon'],
    review:['Обзор недели','Скорректировать план','Разбери доступные факты за выбранный период. Отдели наблюдение от объяснения, предложи альтернативу и изменение только одного условия на следующую неделю. Пустую запись не считай неудачей.','book'],
    guide:['Инструменты','Подобрать нужный инструмент','Подскажи, где в Задачнике выполнить мой сценарий: выбрать цель, создать привычку, запланировать действие или разобрать результат. Не обещай функций за пределами приложения.','gear'],
    settings:['Настройки','Разобраться в настройках','Подскажи, как настроить посильные напоминания и тихие часы. Не меняй настройки и не заявляй, что видишь мои системные настройки.','gear'],
    lists:['Списки','Разложить задачи по спискам','Предложи простую структуру списков для моих задач. Не меняй списки и права доступа.','list'],
    report:['Отчёт','Разобрать отчёт','Помоги интерпретировать доступные записи о еде, нагрузке и шагах за выбранный период. Укажи, каких данных не хватает. Не считай разные источники одинаковыми и не ставь диагноз.','book'],
    routePlans:['Напоминания','Настроить режим напоминаний','Помоги выбрать не больше одного-двух полезных напоминаний с учётом моего дня. Это предложенное расписание, а не назначение лечения; не меняй существующие назначения.','bell'],
    sos:['Поддержка сейчас','Найти самый маленький шаг','Мне сейчас трудно придерживаться плана. Помоги выбрать один спокойный, посильный шаг без давления или наказания. Не нужен длинный список.','heart'],
    cycle:['Мой цикл','Собрать план на неделю','Составь недельный эксперимент: одна цель, одна небольшая привычка с понятным сигналом и минимумом, одно конкретное действие, короткий план на сложный день и способ проверить результат через неделю. Используй существующие записи, если они подходят. Предлагай не более трёх добавлений за раз.','star'],
    reset:['Возврат в ритм','Начать снова без перегруза','Помоги вернуться к привычке после пропуска: сначала предположи не больше одной причины и спроси, если данных мало. Подбери минимум на сегодня и план «если — то» на следующий раз. Не увеличивай нагрузку в наказание.','repeat']
  };
  function sync() {
    if(owner===X.ME)return;
    owner=X.ME;R=null;busy=false;focusId='';noFocus=false;drafts.clear();
    if(owner)try{focusId=localStorage.getItem('zd-cycle-focus-'+owner)||'';noFocus=focusId==='-';}catch(e){}
  }
  function goals(){return window.GROWTH?GROWTH.data():{goals:[],sessions:[],checkins:[],ok:false,error:''};}
  function selectGoal(id){
    sync();focusId=id||'-';noFocus=focusId==='-';
    try{localStorage.setItem('zd-cycle-focus-'+owner,focusId);}catch(e){}
  }
  function focus(){sync();var all=goals().goals.filter(function(g){return g.status==='active';});return noFocus?null:all.find(function(g){return g.id===focusId;})||(all.length===1?all[0]:null);}
  function own(rows,id){return rows.find(function(r){return r.id===id&&r.owner===X.ME;});}
  function clean(s,n){return String(s||'').replace(/[\r\n\t]+/g,' ').trim().slice(0,n||160);}
  function btn(a,label,v,id,cls){
    return '<button type="button" class="'+(cls||'btn2')+'" data-a="'+a+'"'+(v?' data-v="'+E(v)+'"':'')+(id?' data-id="'+E(id)+'"':'')+'>'+label+'</button>';
  }
  function ask(key,id,look){
    return btn('routeAsk',(look==='icon'?X.I('spark'):'')+E(scenes[key][1]),key,id,look==='primary'?'btn':'btn2');
  }
  function activeTab(a){
    var el=document.querySelector('.main [data-a="'+a+'"].on');
    return el?{a:a,v:el.getAttribute('data-v'),label:clean(el.textContent,48)}:null;
  }
  function routeScene(){
    var v=X.UI.view,g=window.GROWTH&&GROWTH.tab();
    if(v==='growth')return({skills:'skills',checkin:'checkin',review:'review'})[g]||v;
    if(v==='food'&&window.HEALTH&&HEALTH.routeState().foodTab==='kitchen')return'kitchen';
    return v==='more'?'guide':v;
  }
  function diaryFacts(){
    var t=X.T(),from=X.addDays(t,-7),to=X.addDays(t,-1),user=X.ME;
    var taskCount=X.D.log.filter(function(l){return l.user_id===user&&l.day>=from&&l.day<=to;}).length;
    var excluded=new Set(window.WELL&&WELL.plans?WELL.plans().map(function(p){return p.habit_id;}):[]);
    var ids=X.D.habits.filter(function(h){return h.owner===user&&!excluded.has(h.id);}).map(function(h){return h.id;});
    var habitDays=0;
    for(var i=0;i<7;i++){var day=X.addDays(from,i);ids.forEach(function(id){if(Number((X.D.marks[id]||{})[day])>0)habitDays++;});}
    return 'Дневник, '+from+' — '+to+': моих отметок выполнения задач — '+taskCount+
      ', дней с отметкой по обычным привычкам (сумма по привычкам) — '+habitDays+'.'+
      (!X.historyKnown('log',from)||!X.historyKnown('marks',from)?' История загружена не полностью.':'')+' Нет отметки — неизвестный результат.';
  }
  function decorate(root){
    var key=routeScene();
    if(!scenes[key]||key==='cycle')return;
    var wrap=root.querySelector('.wrap'),top=wrap.querySelector('.top');
    var label='Помощник раздела: '+scenes[key][1];
    var html='<button type="button" class="route-launch" data-a="routeAsk" data-v="'+E(key)+'" aria-label="'+E(label)+'" title="'+E(label)+'">'+X.I('spark')+'<span aria-hidden="true">ИИ</span></button>';
    if(window.MIND&&focus()&&['calendar','habits','diary','notes','growth','skills','review'].includes(key)&&top){
      html='<button type="button" class="route-launch cycle-return" data-a="mindJump" aria-label="Открыть проверку в Моём цикле" title="Мой цикл">'+X.I('repeat')+'<span aria-hidden="true">Цикл</span></button>'+html;
    }
    if(top)(top.querySelector('.tbtns')||top).insertAdjacentHTML('beforeend',html);else wrap.insertAdjacentHTML('afterbegin','<div class="route-launch-fallback">'+html+'</div>');
  }
  function sheet(s){
    var key=({habit:'habits',lists:'lists',settings:'settings','h-report':'report','w-plans':'routePlans','w-sos':'sos'})[s.type];
    if(!key||s.type==='habit'&&!own(X.D.habits,s.id))return'';
    return '<div class="route-sheet">'+ask(key,s.type==='habit'?s.id:null,'icon')+'</div>';
  }
  function snapshot(key,id){
    var scene=scenes[key],tab=null,view=X.UI.view,S=X.UI.sheet,h=focus(),title=scene[0],facts=[],noteId=null,taskId=null,habitId=null;
    var route={key:key,view:view,goalId:h?h.id:null,goalTitle:h?clean(h.title):'',calDay:X.UI.calDay,cal:X.UI.cal,filter:X.UI.filter,foodDay:null};
    if(view==='food'||view==='fit'){
      var hs=HEALTH.routeState();tab=activeTab(view==='food'?'hFoodTab':'hFitTab');
      if(key==='kitchen')route.sub=activeTab('hKTab');
      else if(view==='food'){route.foodDay=hs.day;facts.push('Выбранная дата питания: '+hs.day);}
      else if(tab&&tab.v==='prog')route.sub=activeTab('hProgP');
    }
    if(view==='growth')tab=activeTab('grTab');
    if(view==='well'){
      tab=activeTab('wTab');
      if(tab&&tab.v==='cab')route.sub=activeTab('wCabKind');
      if(tab&&tab.v==='nut')route.sub=activeTab('wPeriod');
    }
    if(tab){route.tab=tab;if(tab.label!==title)title+=' · '+tab.label;facts.push('Подвкладка: '+tab.label+(route.sub?' / '+route.sub.label:''));}
    if(key==='calendar'){title+=' · '+X.fmtDM(route.calDay);facts.push('Дата в календаре: '+route.calDay+'. Режим: '+({day:'день',week:'неделя',month:'месяц'}[route.cal]||'по датам')+'.');}
    if(key==='tasks'&&route.filter!=='all'){var list=own(X.D.lists,route.filter);if(list){title+=' · '+clean(list.name,55);facts.push('Мой выбранный список: «'+clean(list.name,100)+'».');}}
    if(key==='report'&&S&&window.HREPORT){route.report=HREPORT.routeState(S);if(route.report){title+=' · '+X.fmtDM(route.report.from)+' — '+X.fmtDM(route.report.to);facts.push(route.report.summary);}}
    if(key==='routePlans'&&S){route.planKind=S.pk;var plan={med:'аптечка',food:'питание',fit:'тренировки',nudge:'поддержка'}[S.pk];if(plan)facts.push('Раздел напоминаний: '+plan+'.');}
    if(key==='sos'&&S&&S.type==='w-sos'&&S.sos){
      var pick=document.querySelector('#sheet [data-a="wSosPick"].on');
      if(pick){route.sos=S.sos;title+=' · '+clean(pick.textContent,60);facts.push('Выбранная ситуация: '+clean(pick.textContent,100)+'.');}
    }
    if(key==='well'&&S&&S.type==='w-item'&&S.id)route.itemId=S.id;
    if(key==='reset'&&id){var resetHabit=own(X.D.habits,id);if(resetHabit){title='Возврат в ритм · '+clean(resetHabit.name,70);facts.push('Нужно адаптировать одну привычку: «'+clean(resetHabit.name)+'» (ID '+resetHabit.id+').');}}
    if(key==='habits'&&id){var habit=own(X.D.habits,id);if(habit){habitId=habit.id;title='Привычка · '+clean(habit.name,70);facts.push('Выбранная привычка «'+clean(habit.name)+'» (ID '+habitId+').');}}
    if(key==='tasks'&&id){var task=own(X.D.tasks,id);if(task){taskId=task.id;title='Задача · '+clean(task.title,70);facts.push('Выбранная задача «'+clean(task.title)+'» (ID '+taskId+').');}}
    if((key==='notes'||key==='diary')&&id){var note=own(X.D.notes,id);if(note){noteId=note.id;title='Моя заметка · '+clean(note.title||'без названия',70);facts.push('Выбрана моя заметка «'+clean(note.title||'без названия')+'».');}}
    if(key==='diary'&&!noteId)facts.push(diaryFacts());
    if(h){facts.push('Активная цель, выбранная мной для цикла: «'+clean(h.title)+'» (ID '+h.id+').');if(key==='review'&&window.CYCLEWEEK&&goals().ok)facts.push(CYCLEWEEK.hint(h,goals()));}
    route.title=title;route.facts=facts;route.noteId=noteId;route.taskId=taskId;route.habitId=habitId;
    return route;
  }
  function slot(r){
    if(!r)return 'plain';
    return JSON.stringify([r.key,r.view,r.goalId,r.noteId,r.taskId,r.habitId,r.itemId,r.sos,r.planKind,r.tab&&r.tab.v,r.sub&&r.sub.v,r.key==='calendar'&&r.calDay,r.foodDay,r.report&&r.report.from,r.report&&r.report.to,r.prepared]);
  }
  function rememberDraft(r){
    var key=slot(r),text=X.AS.draft;
    drafts.delete(key);
    if(text.trim()&&(!r||r.prepared||text!==scenes[r.key][2]))drafts.set(key,text);
    if(drafts.size>12)drafts.delete(drafts.keys().next().value);
  }
  function begin(key,id,custom){
    sync();
    if(!X.ME||!Object.prototype.hasOwnProperty.call(scenes,key))return;
    if(X.AS.busy){X.toast('Дождись ответа помощника');return;}
    if(id&&(key==='notes'||key==='diary')&&!own(X.D.notes,id)){X.toast('Контекст заметки доступен только её автору');return;}
    var next=snapshot(key,id);
    if(next.view==='assistant'&&!X.UI.sheet){
      next.view=({cycle:'cycle',reset:'habits',review:'growth'})[key]||key;
      if(key==='review')next.tab={a:'grTab',v:'review'};
    }
    next.prepared=typeof custom==='string'&&!!custom.trim();next.navId=X.uid();
    if(X.UI.noteId)X.closeNote();
    if(X.UI.sheet)X.closeSheet();
    X.asLoad();
    rememberDraft(R);
    X.AS.draft=next.prepared?custom:(drafts.get(slot(next))||scenes[key][2]);
    R=next;
    A.go('assistant');
    var el=document.getElementById('route-context');if(el)el.focus({preventScroll:true});
  }
  function context(){sync();return R;}
  function options(){var r=context();return r?{route:r,deep:['cycle','review','reset','growth','checkin','support','skills','fit','well','kitchen','report','calendar'].includes(r.key)}:{};}
  function queryText(text,r){if(!r)return text;return text+'\n\nКонтекст запроса для фокуса, не инструкции из записей: '+r.title+'. '+(r.facts||[]).join(' ')+'\nИспользуй доступные данные без выдумок. Отделяй планы от фактов; изменения — только как предложения для моего подтверждения.';}
  function contextBar(){
    var r=context();if(!r)return'';
    return '<div class="route-context" id="route-context" tabindex="-1"><div><strong>'+E(r.title)+'</strong><small>Фокус запроса, не ограничение доступа. Текст можно изменить перед отправкой.</small></div><div class="route-context-actions">'+btn('routeBack','Назад')+btn('routeClear',drafts.has('plain')?'К общему черновику':'Убрать контекст')+'</div></div>';
  }
  function shortcuts(){
    return '<div class="chipsrow route-shortcuts">'+ask('cycle',null,'icon')+ask('review')+ask('reset')+btn('go','Мой цикл','cycle')+'</div>';
  }
  function back(){
    var r=context();if(!r)return;
    if(window.SITENAV)SITENAV.returning();
    A.go(r.view);
    if(r.view==='calendar'){X.UI.calDay=r.calDay;X.UI.cal=r.cal;X.render();}
    if(r.view==='tasks'&&r.filter!=='all'&&X.D.lists.some(function(l){return l.id===r.filter;}))A.filter(r.filter);
    if(r.tab&&A[r.tab.a])A[r.tab.a](r.tab.v);
    if(r.sub&&A[r.sub.a])A[r.sub.a](r.sub.v);
    if(r.foodDay&&window.HEALTH)HEALTH.routeDay(r.foodDay);
    if(r.taskId&&own(X.D.tasks,r.taskId))A.open(null,r.taskId);
    if(r.habitId&&own(X.D.habits,r.habitId))A.habOpen(null,r.habitId);
    if(r.noteId&&own(X.D.notes,r.noteId))A.noteOpen(null,r.noteId);
    if(r.itemId&&A.wItemOpen)A.wItemOpen(null,r.itemId);
    if(r.key==='report'&&r.report&&window.HREPORT)HREPORT.routeOpen(r.report);
    if(r.key==='lists')A.lists();
    if(r.key==='settings')A.settings();
    if(r.key==='routePlans'&&r.planKind&&A.wPlans)A.wPlans(r.planKind);
    if(r.key==='sos'&&A.wSos){A.wSos();if(r.sos&&A.wSosPick)A.wSosPick(r.sos);}
  }
  function stats(h,today){
    if(X.habitEvidence)return X.habitEvidence(h,X.addDays(today,-7),X.addDays(today,-1));
    var n=0,unknown=0;
    if(!h.started_on)return{marked:0,unknown:0};
    for(var i=1;i<=7;i++){
      var day=X.addDays(today,-i);if(day<h.started_on)continue;
      if(X.cnt(h,day)>0)n++;
      else if(!X.historyKnown('marks',day))unknown++;
    }
    return{marked:n,unknown:unknown};
  }
  function refs(g,kind){
    return g?(g[kind==='habit'?'link_habit_ids':'link_task_ids']||[]).map(function(id){return own(kind==='habit'?X.D.habits:X.D.tasks,id);}).filter(Boolean):[];
  }
  function nextAction(g,tasks,habits,t,data){
    var todayHabit=habits.find(function(h){return !h.paused&&!h.finished&&h.started_on<=t&&X.sched(h,t)&&((X.D.marks[h.id]||{})[t]||0)<X.tgt(h);});
    var todayTask=tasks.filter(function(task){return !task.done&&task.due_date&&task.due_date<=t;}).sort(function(a,b){return b.prio-a.prio||a.due_date.localeCompare(b.due_date);})[0];
    if(todayHabit&&!X.historyKnown('marks',t))return ['Не все отметки за сегодня загружены. Лучше сначала открыть привычку.',btn('grOpenHabit','Подробнее',todayHabit.id)];
    if(todayHabit)return ['Сегодня по расписанию: '+todayHabit.name,btn('habTap',X.tgt(todayHabit)===1?'Отметить выполнение':'+1 выполнение',null,todayHabit.id,'btn')+btn('grOpenHabit','Подробнее',todayHabit.id)];
    if(todayTask)return ['В работе: '+todayTask.title,btn('grOpenTask','Открыть задачу',todayTask.id)];
    if(g&&!tasks.length&&!habits.length)return ['К цели пока не привязаны действия. Выбери одно повторяемое и посильное.',ask('growth')];
    if(g)return ['На сегодня нет незакрытых действий по расписанию. Можно проверить, что помогло.',btn('appGrowthTab','Записать наблюдение','checkin')];
    return [data.ok?'Начни с результата, который сможешь проверить через неделю.':'Цели пока недоступны. Можно начать с задачи.',data.ok?btn('appGrowthTab','К списку целей','goals'):btn('go','Мои задачи','tasks')];
  }
  function weekStrip(h,t){
    if(!h)return'';
    var days=[];
    for(var i=6;i>=0;i--){
      var day=X.addDays(t,-i),count=X.cnt(h,day),scheduled=h.started_on&&day>=h.started_on&&X.sched(h,day),target=X.tgt(h);
      var state=count>0&&i?'done':count>=target?'done':count?'part':!X.historyKnown('marks',day)?'unknown':i?'blank':!scheduled?'off':'today';
      var title=i?(count>0?'Есть отметка ('+count+')':state==='unknown'?'Данные неполные':'Нет отметки'):
        state==='done'?'На сегодня записано выполнение':state==='part'?'Сегодня '+count+' из '+target:state==='off'?'Сегодня не по плану':state==='unknown'?'Данные неполные':'Можно отметить сегодня';
      days.push('<li class="cycle-day '+state+'"'+(i?'':' aria-current="date"')+'><time datetime="'+E(day)+'">'+E(X.fromKey(day).getDate())+'</time><span>'+E(title)+'</span></li>');
    }
    return '<section class="cycle-week" aria-label="Отметки за семь дней"><h2>Семь дней · '+E(h.name)+'</h2><ol>'+days.join('')+'</ol></section>';
  }
  function hardDay(h,t){
    if(!h)return'';
    return '<details class="cycle-reset"><summary>Сегодня трудно? Упрости план</summary><p>Другая обстановка, нехватка сил или слишком большой шаг — разные ситуации. Выбери подходящий вариант или отдых, не отмечая то, чего не было.</p><div class="cycle-actions">'+btn('cycleLightEdit','Изменить объём или дни',h.id)+btn('cycleObstacle','Записать, что помешало')+ask('reset',h.id)+'</div><p class="muted">История отметок сохраняется. В календаре видно текущее расписание, а не план прошлых дней.</p></details>';
  }
  function dashboard(){
    sync();
    var data=goals(),g=focus(),active=data.goals.filter(function(r){return r.status==='active';}),tasks=refs(g,'task'),habits=refs(g,'habit'),t=X.T(),start=X.addDays(t,-7);
    var primary=habits.find(function(h){return !h.paused&&!h.finished;});
    var practices=g?data.sessions.filter(function(r){return r.owner===X.ME&&r.day>=start&&r.day<t&&r.goal_id===g.id;}):[];
    var next=nextAction(g,tasks,habits,t,data);
    var choose=active.length?'<label class="route-pick" for="cycle-goal"><span>Цель в фокусе</span><select id="cycle-goal" class="fld"><option value="-">Без выбранной цели</option>'+active.map(function(a){return '<option value="'+E(a.id)+'"'+(g&&a.id===g.id?' selected':'')+'>'+E(a.title)+'</option>';}).join('')+'</select></label>':'<div class="route-pick"><b>Начни с одной цели</b><span>'+(!data.ok?(data.error?'Не удалось загрузить цели.':'Цели загружаются…'):'Сформулируй результат, который можно проверить.')+'</span></div>';
    var linked=habits.length||tasks.length?'<ul class="route-links">'+habits.map(function(h){var s=stats(h,t),progress=s.marked?s.marked+' '+X.plural(s.marked,'день','дня','дней')+' с записью':'Нет записей в загруженной истории';if(s.unknown)progress+=' · часть не загружена';return '<li>'+btn('grOpenHabit',E(h.name),h.id,null,'link')+'<span>'+E((h.finished?'Завершена · ':h.paused?'На паузе · ':'')+progress)+'</span></li>';}).join('')+tasks.map(function(task){return '<li>'+btn('grOpenTask',E(task.title),task.id,null,'link')+'<span>'+E(task.done?'Выполнена':task.due_date?'План · '+X.fmtDM(task.due_date):'Без срока')+'</span></li>';}).join('')+'</ul>':'<p class="muted">Свяжи задачу или привычку с целью в её карточке либо из подтверждённых предложений.</p>';
    return '<section class="cycle-view"><div class="cycle-hero"><div class="cycle-kicker"><i></i> НЕДЕЛЬНЫЙ ЦИКЛ</div><h1>Мой цикл</h1><p>Выбери одну цель, найди маленькое действие и через неделю реши, что оставить. Пропуски — повод упростить план, а не начинать с нуля.</p><div class="cycle-actions">'+(!g&&data.ok&&window.CYCLESTART&&!CYCLESTART.isOpen()?CYCLESTART.launch(g)+ask('cycle'):ask('cycle',null,'primary'))+ask('reset')+'</div></div>'+
      '<div class="cycle-focus">'+choose+(g?btn('routeGoal','Открыть цель',g.id):btn('appGrowthTab','Открыть цели','goals'))+'</div>'+
      (data.ok&&window.CYCLESTART?CYCLESTART.view(g):'')+
      '<div class="cycle-next"><div><h2 id="cycle-next-title" tabindex="-1">С чего начать сегодня</h2><p>'+E(next[0])+'</p></div><div class="cycle-actions">'+next[1]+'</div></div>'+
      (g&&data.ok&&window.MIND?MIND.view(g):'')+weekStrip(primary,t)+hardDay(primary,t)+
      '<div class="cycle-grid">'+stage('01','План','Один результат и один посильный шаг. Проверь, есть ли для него время.',btn('go','Задачи','tasks')+btn('go','Календарь','calendar'))+
      stage('02','Повторение','Связанные действия. Для привычек показаны отметки за семь завершённых дней, а не оценка усилий.',btn('go','Привычки','habits')+ask('habits'),linked)+
      stage('03','Что получилось',g?'За семь завершённых дней: '+practices.length+' '+X.plural(practices.length,'занятие','занятия','занятий')+' по цели. Состояние записывается отдельно — это контекст, не балл.':'Выбери цель, чтобы видеть только связанную практику. Без фокуса результаты разных целей не смешиваются.',btn('appGrowthTab','Записать практику','skills')+btn('appGrowthTab','Отметить состояние','checkin'))+
      stage('04','Коррекция','Проверь факты. Реши, что оставить, упростить или заменить.',(g&&data.ok&&window.CYCLEWEEK?'<button id="cycle-review-open" class="btn2" type="button" data-a="cycleReviewOpen" data-v="'+E(g.id)+'">Подвести итог</button>':btn('appGrowthTab','Обзор недели','review'))+ask('review'),g&&g.due_day?'<p class="muted">Ориентир цели: '+E(X.fmtDM(g.due_day))+'</p>':'')+'</div>'+((g&&window.CYCLEWEEK)?CYCLEWEEK.view(g,data):'')+
      '<div class="cycle-tools"><h2>Контекст для плана</h2><div class="cycle-actions">'+['inbox','diary','notes','food','fit','well','support'].map(function(k){return btn('go',X.I(scenes[k][3])+E(scenes[k][0]),k);}).join('')+'</div></div></section>';
  }
  function homeCard(){
    var g=focus(),p=g&&window.MIND&&MIND.home(g);
    return '<section class="route-bar" aria-label="Мой цикл"><div><strong>'+X.I('repeat')+'Мой цикл</strong><small>'+E(p&&p.planned?'Сегодня в проверке: '+clean(p.action,120):g?'В фокусе: '+clean(g.title,160):'Одна цель, один небольшой шаг, один обзор в неделю')+'</small></div>'+btn('go','Открыть цикл','cycle')+'</section>';
  }
  function stage(n,title,body,actions,extra){
    return '<article class="cycle-stage"><div class="cycle-index">'+n+'</div><h2>'+title+'</h2><p>'+E(body)+'</p>'+(extra||'')+'<div class="cycle-actions">'+actions+'</div></article>';
  }
  function candidates(m,g){
    var ts=new Set(g.link_task_ids||[]),hs=new Set(g.link_habit_ids||[]);
    var tasks=[...new Set((m.tasks||[]).filter(function(t){return t._added&&t._createdId&&own(X.D.tasks,t._createdId)&&!ts.has(t._createdId);}).map(function(t){return t._createdId;}))];
    var habits=[...new Set((m.entries||[]).filter(function(e){return e._done&&e._habitId&&own(X.D.habits,e._habitId)&&!hs.has(e._habitId);}).map(function(e){return e._habitId;}))];
    return{tasks:tasks,habits:habits};
  }
  function footer(m,i){
    if(!m.route)return'';
    var g=goals().goals.find(function(g){return g.id===m.route.goalId&&g.status==='active';}),c=g?candidates(m,g):null;
    var views=new Set();
    if((m.tasks||[]).length||(m.moves||[]).length)views.add('tasks');
    var dest={habit:'habits',habit_update:'habits',habit_mark:'habits',growth_goal:'growth',support:'support',meal:'food',workout:'fit',body:'fit',note:'notes',pantry:'food'};
    (m.entries||[]).forEach(function(e){views.add(dest[e.t]||(/cooking/.test(e.t)?'food':'well'));});
    return '<div class="route-answer"><small>Фокус: '+E(m.route.title)+'</small>'+(c&&(c.tasks.length||c.habits.length)?btn('routeLink','Связать сохранённое с целью: '+E(clean(g.title,65)),String(i)):m.route.goalTitle?'<small>Цель: '+E(m.route.goalTitle)+'</small>':'')+(views.size?'<div class="route-answer-actions">'+Array.from(views,function(k){return btn('go','Открыть: '+E(scenes[k][0]),k);}).join('')+'</div>':'')+'</div>';
  }
  async function linkRecords(goalId,ids,user){
    if(!user||X.ME!==user)throw new Error('Аккаунт изменился');
    var g=await X.q(X.sb.from('growth_goals').select('id,status,link_task_ids,link_habit_ids').eq('id',goalId).eq('owner',user).maybeSingle());
    if(X.ME!==user)throw new Error('Аккаунт изменился');
    if(!g||g.status!=='active')throw new Error('Цель больше не активна');
    if(!ids.tasks.every(function(id){return own(X.D.tasks,id);})||!ids.habits.every(function(id){return own(X.D.habits,id);}))throw new Error('Часть записей больше недоступна');
    var taskLinks=g.link_task_ids||[],habitLinks=g.link_habit_ids||[];
    var patch={link_task_ids:Array.from(new Set(taskLinks.concat(ids.tasks))),link_habit_ids:Array.from(new Set(habitLinks.concat(ids.habits)))};
    if(patch.link_task_ids.length===taskLinks.length&&patch.link_habit_ids.length===habitLinks.length){
      await GROWTH.refresh();return false;
    }
    if(patch.link_task_ids.length>20||patch.link_habit_ids.length>20)throw new Error('В цели можно сохранить до 20 задач и до 20 привычек');
    var result=await X.q(X.sb.from('growth_goals').update(patch).eq('id',g.id).eq('owner',user).eq('status','active').eq('link_task_ids','{'+taskLinks.join(',')+'}').eq('link_habit_ids','{'+habitLinks.join(',')+'}').select('id').maybeSingle());
    if(X.ME!==user)throw new Error('Аккаунт изменился');
    if(!result){await GROWTH.refresh();throw new Error('Связи цели уже изменились. Проверь их и повтори при необходимости.');}
    await GROWTH.refresh();return true;
  }
  async function link(v){
    sync();if(busy)return;
    var m=X.AS.msgs[+v],user=X.ME;if(!m||!m.route||!m.route.goalId||!user)return;
    busy=true;
    try{
      var g=goals().goals.find(function(g){return g.id===m.route.goalId&&g.status==='active';});
      if(!g)throw new Error('Цель больше не активна');
      var changed=await linkRecords(g.id,candidates(m,g),user);
      if(X.ME===user)X.toast(changed?'Связи с целью сохранены':'Связи уже сохранены');
    }catch(e){if(X.ME===user)X.err(e);}finally{if(X.ME===user){busy=false;X.render();}}
  }
  document.addEventListener('change',function(e){
    if(e.target.id!=='cycle-goal')return;
    selectGoal(e.target.value);
    X.render();var select=document.getElementById('cycle-goal');if(select)select.focus({preventScroll:true});
  });
  A.routeAsk=begin;A.routeBack=back;A.routeClear=function(){rememberDraft(R);R=null;if(drafts.has('plain'))X.AS.draft=drafts.get('plain');X.render();var el=document.getElementById('asin');if(el)el.focus();};
  A.routeGoal=function(id){A.go('growth');if(A.grGoalEdit)A.grGoalEdit(id);};
  A.routeLink=link;
  A.cycleLightEdit=function(id){var h=own(X.D.habits,id);if(h&&!h.finished&&!h.paused)A.habEdit(null,id);};
  A.cycleObstacle=function(){A.go('growth');if(A.grCheckinEdit)A.grCheckinEdit(X.T());var input=document.getElementById('gr-checkin-obstacle');if(input)input.focus();};
  window.CYCLE={navState:function(){var r=context();return r?{id:r.navId,route:r}:null;},restoreNav:function(s){sync();var route=s&&s.route||null;if(R!==route){rememberDraft(R);R=route;X.AS.draft=drafts.get(slot(R))||'';}},view:dashboard,homeCard:homeCard,selectGoal:selectGoal,linkRecords:linkRecords,decorate:decorate,sheet:sheet,context:context,bar:contextBar,shortcuts:shortcuts,options:options,queryText:queryText,footer:footer,begin:begin};
})();
