/* Сквозные предложения помощника: обычные привычки, отметки и поддержка.
   Ничего не записывается до явного нажатия пользователя. */
(function () {
  'use strict';
  var X=window.__app;if(!X||!window.HEALTH||!window.WELL)return;
  var q=X.q,sb=X.sb,esc=X.esc,A=X.A,types={habit:1,habit_update:1,habit_mark:1,support:1};
  var adding=new WeakSet(),applying=new WeakSet(),drafts={support:'',habits:''};
  function norm(s){return String(s||'').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');}
  function days(ds){return !ds||!ds.length?'каждый день':ds.map(function(d){return X.WD[d];}).join(', ');}
  function validDays(ds){return Array.isArray(ds)&&ds.every(function(d){return Number.isInteger(d)&&d>=0&&d<=6;});}
  function validTimes(ts){return Array.isArray(ts)&&ts.length<=4&&ts.every(function(t){return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);});}
  function title(e){return e.d.name||e.d.habit_name||e.d.title||'Привычка';}
  function asEntries(a){var out=[];[['new_habits','habit'],['habit_updates','habit_update'],['habit_marks','habit_mark'],['support_plans','support']].forEach(function(p){(a[p[0]]||[]).forEach(function(d){out.push({t:p[1],d:d});});});return out;}
  function entryInfo(e){
    var d=e.d,meta=[];
    if(e.t==='habit_mark')meta=[X.dayWord(d.day).toLowerCase(),'итог за день: '+d.count];
    else{
      if(d.target!=null)meta.push(d.target+' '+X.plural(d.target,'раз','раза','раз')+' в день');
      if(d.days)meta.push(days(d.days));
      if(d.times)meta.push(d.times.length?d.times.join(', '):'без напоминаний');
      if(d.paused!==undefined)meta.push(d.paused?'поставить на паузу':'возобновить');
      if(e.t==='support')meta.push((d.messages||[]).length+' фраз поддержки');
    }
    return {title:title(e),meta:meta,note:[d.reason,e.t==='support'?(d.messages||[]).map(function(s){return '«'+s+'»';}).join(' · '):''].filter(Boolean).join('\n')};
  }
  function entryText(e){var inf=entryInfo(e);return{title:inf.title,body:inf.meta.concat([inf.note]).filter(Boolean).join('\n')};}
  async function records(){
    var r=await Promise.all([q(sb.from('habits').select('*').eq('owner',X.ME).limit(500)),q(sb.from('h_plans').select('*').eq('owner',X.ME).limit(300))]);
    return{habits:r[0],plans:r[1]};
  }
  function ordinary(r,id){var h=r.habits.find(function(h){return h.id===id&&h.owner===X.ME&&!h.finished;});if(!h||r.plans.some(function(p){return p.habit_id===id;}))throw new Error('Привычка недоступна или относится к расписанию. Попроси новый вариант плана.');return h;}
  function cacheHabit(h){var i=X.D.habits.findIndex(function(x){return x.id===h.id;});if(i<0)X.D.habits.push(h);else X.D.habits[i]=h;}
  async function once(table,row,e,slot){
    e._ids=e._ids||{};if(!e._ids[slot]){e._ids[slot]=crypto.randomUUID();X.asSave();}
    var id=e._ids[slot],read=function(){return q(sb.from(table).select('*').eq('id',id).eq('owner',X.ME).maybeSingle());};
    var existing=await read();if(existing)return existing;
    try{return await q(sb.from(table).insert(Object.assign({},row,{id:id,owner:X.ME})).select().single());}
    catch(error){var saved=await read();if(saved)return saved;throw error;}
  }
  async function addFrom(e){
    if(adding.has(e))throw new Error('Эта запись уже сохраняется');adding.add(e);
    try{
      var d=e.d,r=await records(),hf,h;
      if(e.t==='habit'){
        if(!String(d.name||'').trim()||!validDays(d.days)||!validTimes(d.times)||!(d.target>=1&&d.target<=20))throw new Error('Проверь название и расписание привычки');
        h=r.habits.find(function(x){return !x.finished&&!r.plans.some(function(p){return p.habit_id===x.id;})&&norm(x.name)===norm(d.name);});
        if(h){cacheHabit(h);e._existing=true;return;}
        hf={name:d.name.trim().slice(0,120),icon:'leaf',color:X.COLORS[2],target:d.target,days:d.days,remind:d.times[0]||null,remind_at:d.times.slice(1),remind_every:0,started_on:X.T(),paused:false,finished:false};
        cacheHabit(await once('habits',hf,e,'habit'));
      }else if(e.t==='habit_update'){
        h=ordinary(r,d.habit_id);hf={};
        if(d.name!==undefined){if(!String(d.name).trim())throw new Error('Пустое название');if(r.habits.some(function(x){return x.id!==h.id&&!x.finished&&norm(x.name)===norm(d.name);}))throw new Error('Привычка с таким названием уже есть');hf.name=String(d.name).trim().slice(0,120);}
        if(d.target!==undefined){if(!Number.isInteger(d.target)||d.target<1||d.target>20)throw new Error('Некорректная цель');hf.target=d.target;}
        if(d.days!==undefined){if(!validDays(d.days))throw new Error('Некорректные дни');hf.days=d.days;}
        if(d.times!==undefined){if(!validTimes(d.times))throw new Error('Некорректное время');hf.remind=d.times[0]||null;hf.remind_at=d.times.slice(1);if(!d.times.length)hf.remind_every=0;}
        if(typeof d.paused==='boolean')hf.paused=d.paused;
        if(!Object.keys(hf).length)throw new Error('Нет изменений для применения');
        cacheHabit(await q(sb.from('habits').update(hf).eq('id',h.id).eq('owner',X.ME).select().single()));
      }else if(e.t==='habit_mark'){
        h=ordinary(r,d.habit_id);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(d.day)||isNaN(Date.parse(d.day))||new Date(d.day).toISOString().slice(0,10)!==d.day||d.day>X.T()||!Number.isInteger(d.count)||d.count<0||d.count>X.tgt(h))throw new Error('Проверь дату и число выполнений');
        if(d.count)await q(sb.from('habit_marks').upsert({habit_id:h.id,day:d.day,count:d.count}));else await q(sb.from('habit_marks').delete().eq('habit_id',h.id).eq('day',d.day));
        var marks=X.D.marks[h.id]=X.D.marks[h.id]||{};if(d.count)marks[d.day]=d.count;else delete marks[d.day];
      }else if(e.t==='support'){
        if(!String(d.title||'').trim()||!validDays(d.days)||!validTimes(d.times)||!d.times.length||!Array.isArray(d.messages)||!d.messages.length)throw new Error('Для поддержки нужны время, дни и фразы');
        var duplicate=r.plans.find(function(p){return p.kind==='nudge'&&norm(p.title)===norm(d.title)&&(!e._ids||p.id!==e._ids.plan);});if(duplicate){e._existing=true;await WELL.load();return;}
        // До создания связанного плана новая служебная привычка на паузе: при сбое нет лишних уведомлений.
        hf={name:d.title,icon:'star',color:X.COLORS[4],target:d.times.length,days:d.days,remind:d.times[0],remind_at:d.times.slice(1),remind_every:0,started_on:X.T(),paused:true,finished:false};
        h=await once('habits',hf,e,'habit');
        await once('h_plans',{kind:'nudge',title:d.title,units:1,item_id:null,habit_id:h.id,start_day:X.T(),end_day:null,msgs:d.messages.slice(0,7).map(function(s){return String(s).slice(0,140);}),topic:['food','fit','tasks','sleep','other'].indexOf(d.topic)>=0?d.topic:'other'},e,'plan');
        if(h.paused)await q(sb.from('habits').update({paused:false}).eq('id',h.id).eq('owner',X.ME).select().single());
        X.D.habits=X.D.habits.filter(function(x){return x.id!==h.id;});await WELL.load();
      }
    }finally{adding.delete(e);}
  }
  function hasProposals(a){return['new_habits','habit_updates','habit_marks','support_plans'].some(function(k){return Array.isArray(a[k])&&a[k].length;});}
  function check(mi,kind,i,item){if(item._done||item._added)return'';return '<label class="pb-pick"><input type="checkbox" id="pb-select-'+mi+'-'+kind+'-'+i+'" data-pb-select="'+mi+':'+kind+':'+i+'" aria-label="Включить в план: '+esc(item.title||item.d&&title(item)||'задачу')+'"'+(item._excluded?'':' checked')+(applying.has(X.AS.msgs[mi])?' disabled':'')+'></label>';}
  function pending(m){return(m.tasks||[]).filter(function(t){return!t._added&&!t._excluded;}).length+(m.entries||[]).filter(function(e){return!e._done&&!e._excluded;}).length;}
  function planIntro(m){return '<div class="pb-title"><b>'+esc(m.plan_title)+'</b><span>Предложения, не готовые записи. Выбери нужные пункты и примени план.</span></div>';}
  function planFooter(m,mi){var n=pending(m);return '<div class="pb-apply"><button class="btn" data-a="pbApply" data-v="'+mi+'"'+(!n||applying.has(m)?' disabled':'')+'>'+(applying.has(m)?'Сохраняю…':'Применить выбранное ('+n+')')+'</button><span class="muted">Готовые пункты повторно не добавляются. Можно применять по одному.</span></div>';}
  async function apply(mi){
    var m=X.AS.msgs[mi];if(!m||applying.has(m))return;applying.add(m);X.render();var saved=0,failed=0;
    try{
      for(var i=0;i<(m.tasks||[]).length;i++)if(!m.tasks[i]._added&&!m.tasks[i]._excluded){if(await X.asAddTask(mi,i))saved++;else failed++;}
      for(var j=0;j<(m.entries||[]).length;j++)if(!m.entries[j]._done&&!m.entries[j]._excluded){if(await HEALTH.addAssistantEntry(mi,j,''))saved++;else failed++;}
    }finally{applying.delete(m);X.asSave();X.render();X.toast('Применено: '+saved+(failed?'. Не удалось: '+failed+'. Проверь пункты и повтори.':''));}
  }
  function panel(kind){return '<form class="pb-request" data-pb-ask="'+kind+'"><b>'+(kind==='support'?'Комплексный план с помощником':'Помощник по привычкам')+'</b><div class="muted">'+(kind==='support'?'Опиши, что не получается. Помощник свяжет задачи, привычки, питание и поддержку в один небольшой план.':'Можно создать привычку, изменить дни и напоминания, поставить на паузу или отметить сделанное.')+'</div><textarea class="fld" id="pb-request-'+kind+'" rows="2" aria-label="Запрос к помощнику" placeholder="'+(kind==='support'?'Например: часто срываюсь с питания. Нужен посильный план, а не только мотивация.':'Например: помоги закрепить привычку готовить обед с вечера.')+'">'+esc(drafts[kind])+'</textarea><button type="button" class="btn" data-a="pbAsk" data-v="'+kind+'">'+X.I('spark')+'Составить предложения</button></form>';}
  function ask(form,kind){var text=(form.querySelector('textarea').value||'').trim();if(!text){X.toast('Опиши, с чем помочь');return;}if(!X.SET.assistant){A.go('assistant');X.toast('Сначала включи помощника');return;}if(X.AS.busy){X.toast('Дождись текущего ответа');return;}X.askAssistant(kind==='support'?'support':'habits',text);}
  A.pbAsk=function(v,id,el){ask(el.closest('form'),v);};A.pbApply=function(v){return apply(+v);};
  document.addEventListener('submit',function(e){if(e.target.matches('[data-pb-ask]')){e.preventDefault();ask(e.target,e.target.getAttribute('data-pb-ask'));}});
  document.addEventListener('input',function(e){var f=e.target.closest('[data-pb-ask]');if(f&&e.target.tagName==='TEXTAREA')drafts[f.getAttribute('data-pb-ask')]=e.target.value;});
  document.addEventListener('change',function(e){var key=e.target.getAttribute&&e.target.getAttribute('data-pb-select');if(!key)return;var p=key.split(':'),m=X.AS.msgs[+p[0]],item=m&&(p[1]==='task'?(m.tasks||[])[+p[2]]:(m.entries||[])[+p[2]]);if(!item||applying.has(m))return;item._excluded=!e.target.checked;X.asSave();X.render();});
  window.PLANBOT={owns:function(t){return!!types[t];},asEntries:asEntries,entryInfo:entryInfo,entryText:entryText,addFrom:addFrom,hasProposals:hasProposals,
    check:check,planIntro:planIntro,planFooter:planFooter,busy:function(m){return applying.has(m);},habitsPanel:function(){return panel('habits');},supportPanel:function(){return panel('support');}};
})();
