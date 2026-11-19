/* Настройка недельного эксперимента на одном экране, без вызова ИИ. */
(function(){
  'use strict';
  var X=window.__app,A=X.A,E=X.esc,owner=null,draft=null,open=false,saving=false,error='';
  var presets={
    effectiveness:['Фокус','Уделить главному делу хотя бы четыре коротких подхода за неделю','5 минут поработать над главным делом','после открытия списка задач'],
    skills:['Навык','За неделю записать один пробный припев','2 минуты распевки','после завтрака'],
    body:['Движение','Проверить, получается ли выйти на прогулку после обеда хотя бы три раза','Короткая прогулка в удобном темпе','после обеда'],
    calm:['Восстановление','Найти спокойное окончание рабочего дня','Одна минута без экрана перед отдыхом','после закрытия рабочих вкладок'],
    care:['Уход','Проверить, получается ли повторить один шаг вечернего ухода хотя бы четыре раза','Выполнить один привычный шаг ухода','после чистки зубов']
  };
  var rhythms={daily:['Каждый день',[]],weekdays:['По будням',[0,1,2,3,4]],three:['Пн, ср и пт',[0,2,4]]};
  function blank(){return{domain:'effectiveness',goal:'',habit:'',cue:'',minimum:'',expected:'',rhythm:'daily',remind:'',pending:null};}
  function key(){return'zd-cycle-start-v1-'+owner;}
  function sync(){
    if(owner===X.ME&&draft)return;
    owner=X.ME;draft=blank();open=false;saving=false;error='';
    if(!owner)return;
    try{
      var d=JSON.parse(localStorage.getItem(key())||'null');
      if(d&&presets[d.domain]&&['goal','habit','cue'].every(function(k){return typeof d[k]==='string';})){
        draft=Object.assign(blank(),d);open=!!draft.pending;
      }
    }catch(e){}
  }
  function persist(){if(owner)try{localStorage.setItem(key(),JSON.stringify(draft));}catch(e){}}
  function focus(id){var el=document.getElementById(id);if(el)el.focus();}
  function oneLine(s){return String(s||'').trim().replace(/\s+/g,' ');}
  function normal(s){return oneLine(s).toLowerCase().replace(/ё/g,'е');}
  function label(id,text,max,value,ph,required,disabled){
    return '<label for="'+id+'"><span>'+text+'</span>'+FORMUI.line('id="'+id+'" class="fld" name="'+id+'" maxlength="'+max+'" placeholder="'+E(ph)+'"'+(required?' required':'')+disabled,value)+'</label>';
  }
  function launch(g){return '<button class="'+(g?'btn2':'btn')+'" id="cycle-start-open" type="button" data-a="cycleStartOpen">'+(g?'Создать новый цикл':'Настроить неделю без ИИ')+'</button>';}
  function starter(g){
    sync();
    if(!open)return g?'<div class="cycle-start-closed">'+launch(g)+'</div>':'';
    var lock=saving||draft.pending,dis=lock?' disabled':'',note=draft.pending?(draft.pending.habitId?'Привычка сохранена. Повтор завершит связь с целью без дубля.':'Сохранение уже началось. Повтор использует тот же черновик.'):'Будут созданы цель на неделю и связанная привычка. Время напоминания можно оставить пустым.';
    return '<form class="cycle-starter" id="cycle-start" aria-labelledby="cycle-start-title"><div class="cycle-starter-head"><div><div class="cycle-index">БЫСТРЫЙ СТАРТ</div><h2 id="cycle-start-title" tabindex="-1">Одна цель на неделю</h2></div><button type="button" class="btn2" data-a="cycleStartClose"'+(saving?' disabled':'')+'>Свернуть</button></div>'+
      '<div class="cycle-presets" aria-label="Примеры">'+Object.keys(presets).map(function(k){return '<button type="button" data-a="cyclePreset" data-v="'+k+'" class="chip"'+dis+'>'+E(presets[k][0])+'</button>';}).join('')+'</div>'+
      '<div class="cycle-start-fields">'+label('cycle-start-goal','Что хочешь заметить или проверить?',160,draft.goal,'Например: начать день без спешки',true,dis)+label('cycle-start-habit','Какой шаг сможешь повторять?',84,draft.habit,'Например: одно главное дело в списке',true,dis)+label('cycle-start-cue','После чего? Необязательно',32,draft.cue,'Например: после завтрака',false,dis)+
      '<label for="cycle-start-domain"><span>Направление</span><select id="cycle-start-domain" name="cycle-start-domain" class="fld"'+dis+'>'+Object.keys(presets).map(function(k){return '<option value="'+k+'"'+(k===draft.domain?' selected':'')+'>'+E(presets[k][0])+'</option>';}).join('')+'</select></label></div>'+
      '<details class="cycle-advanced"'+(draft.remind||draft.rhythm!=='daily'?' open':'')+'><summary>Дни, напоминание и запасной шаг · '+E((rhythms[draft.rhythm]||rhythms.daily)[0])+(draft.remind?' · '+E(draft.remind):'')+'</summary><div class="cycle-start-fields">'+
      '<label for="cycle-start-rhythm"><span>Дни</span><select id="cycle-start-rhythm" name="cycle-start-rhythm" class="fld"'+dis+'>'+Object.keys(rhythms).map(function(k){return '<option value="'+k+'"'+(k===draft.rhythm?' selected':'')+'>'+E(rhythms[k][0])+'</option>';}).join('')+'</select></label>'+
      '<label for="cycle-start-remind"><span>Напоминание (необязательно)</span><input id="cycle-start-remind" name="cycle-start-remind" class="fld" type="time" value="'+E(draft.remind)+'"'+dis+'></label>'+
      label('cycle-start-minimum','На трудный день (необязательно)',130,draft.minimum,'Например: одна пробная нота',false,dis)+
      '<label for="cycle-start-expected"><span>Сколько дней ожидаешь сделать любой шаг?</span><input id="cycle-start-expected" name="cycle-start-expected" class="fld" type="number" min="1" max="7" placeholder="Необязательно" value="'+E(draft.expected)+'"'+dis+'></label></div>'+
      '<p class="muted">Сигнал помогает вспомнить: это не уведомление. Если указать сигнал, в «Моём цикле» появится проверка на семь дней. Факты по ней хранятся в этом браузере.</p></details>'+
      '<p class="muted">'+E(note)+'</p>'+(error?'<p class="err" role="alert">'+E(error)+'</p>':'')+
      '<div class="cycle-actions"><button class="btn" type="submit"'+(saving?' disabled':'')+'>'+E(saving?'Сохраняю…':draft.pending?'Завершить сохранение':'Запустить неделю')+'</button>'+(draft.pending&&!saving?'<button type="button" class="btn2" data-a="cycleStartCancel">Отказаться от черновика</button>':'')+'</div></form>';
  }
  function localOwner(user){if(!user||X.ME!==user)throw new Error('Аккаунт изменился. Открой свой профиль и повтори.');}
  async function save(){
    sync();if(saving||!X.ME)return;
    var user=X.ME,D=draft,P=D.pending,G=window.GROWTH,goal=oneLine(D.goal),habit=oneLine(D.habit),cue=oneLine(D.cue);
    if(!G||!G.data().ok){error='Цели сейчас недоступны. Обнови данные и попробуй снова.';X.render();return;}
    var rhythm=rhythms[D.rhythm],remind=D.remind,min=oneLine(D.minimum),expected=D.expected===''?null:Number(D.expected);
    if(!rhythm||typeof remind!=='string'||(remind&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(remind))){error='Проверь дни и время напоминания.';X.render();return;}
    if(!goal||!habit||goal.length>160||habit.length>84||cue.length>32||!presets[D.domain]){error='Заполни цель и короткую привычку. Сигнал — до 32 знаков.';X.render();return;}
    if(((min||expected!==null)&&!cue)||min.length>130||expected!==null&&(!Number.isInteger(expected)||expected<1||expected>(rhythm[1].length||7))){error='Для запасного шага и ожидания добавь сигнал. Число дней должно помещаться в расписание.';X.render();return;}
    saving=true;error='';X.render();
    try{
      if(!P){
        // В существующую цель мастер не дописывает ничего без явного выбора.
        var match=G.data().goals.find(function(g){return g.status!=='archived'&&g.domain===D.domain&&normal(g.title)===normal(goal);});
        if(match)throw new Error('Такая цель уже есть. Открой её в разделе «Цели» или уточни формулировку.');
        P=D.pending={goalId:crypto.randomUUID(),habitId:null,entryId:crypto.randomUUID(),started:X.T(),format:2};persist();
      }
      if(!P.habitId){
        var item={t:'habit',d:{name:cue&&P.format!==2?habit+' · '+cue:habit,days:rhythm[1].slice(),times:remind?[remind]:[],target:1},_idsOwner:user,_ids:{habit:P.entryId}};
        localOwner(user);
        await PLANBOT.addFrom(item);
        localOwner(user);
        var existing=X.D.habits.find(function(h){return h.owner===user&&h.id===item._habitId;});
        if(!existing)throw new Error('Не удалось проверить сохранённую привычку.');
        if(existing.paused||existing.finished){
          D.pending=null;persist();
          throw new Error('Одноимённая привычка на паузе или завершена. Возобнови её вручную либо уточни формулировку.');
        }
        var actualDays=(existing.days||[]).slice().sort().join(','),actualTimes=[existing.remind].concat(existing.remind_at||[]).filter(Boolean).map(function(t){return t.slice(0,5);});
        if(X.tgt(existing)!==1||actualDays!==rhythm[1].join(',')||actualTimes.join(',')!==remind||+existing.remind_every>0){
          D.pending=null;persist();
          throw new Error('Такая привычка есть, но её расписание отличается. Свяжи её в «Целях» или задай другое название.');
        }
        P.habitId=existing.id;persist();
      }
      var review=X.addDays(P.started,7);
      var description='Проверка через неделю: '+X.fmtDM(review)+'.'+(cue?'\nСигнал: '+cue+'.\nДействие: '+habit+'.':'')+
        (min?'\nНа трудный день: '+min+'.':'')+(expected!==null?'\nОжидание: '+expected+' дней с любым шагом.':'');
      var result=await G.addGoalProposal({_growth_id:P.goalId,title:goal,domain:D.domain,metric:'manual',target_value:1,unit:'итог',
        target_date:review,note:description,link_habit_ids:[P.habitId],link_task_ids:[]},{startedOn:P.started});
      localOwner(user);
      if(!result.row||result.row.status!=='active'||!(result.row.link_habit_ids||[]).includes(P.habitId)){
        throw new Error('Такая цель была создана отдельно. Привычка сохранена: свяжи её в карточке цели.');
      }
      window.CYCLE.selectGoal(result.row.id);
      if(window.MIND&&cue&&P.started===X.T())MIND.seed(result.row,{cue:cue,action:habit,minimum:min,expected:expected,days:rhythm[1].slice(),habit:P.habitId});
      draft=blank();persist();open=false;
      X.toast(G.data().ok?'Цикл начат. Обзор — '+X.fmtDM(review)+'.':'Цикл сохранён. Обнови список целей, чтобы увидеть его.');
    }catch(e){if(X.ME===user)error=e.message||'Не удалось сохранить план.';}
    finally{if(X.ME===user){saving=false;X.render();if(X.UI.view==='cycle')focus(error?'cycle-start-title':'cycle-next-title');}}
  }
  A.cycleStartOpen=function(){sync();open=true;X.render();focus('cycle-start-title');};
  A.cycleStartClose=function(){sync();if(saving)return;open=false;X.render();focus('cycle-start-open');};
  A.cycleStartCancel=function(){
    sync();if(saving||!draft.pending)return;
    if(!confirm('Отказаться от черновика? Уже сохранённые записи останутся.'))return;
    draft.pending=null;error='';persist();X.render();focus('cycle-start-title');
  };
  A.cyclePreset=function(v){
    sync();if(!Object.prototype.hasOwnProperty.call(presets,v)||saving||draft.pending)return;
    var p=presets[v];draft=Object.assign(blank(),{domain:v,goal:p[1],habit:p[2],cue:p[3],rhythm:draft.rhythm,remind:draft.remind});persist();error='';X.render();focus('cycle-start-goal');
  };
  function input(e){
    if(!e.target.form||e.target.form.id!=='cycle-start')return;
    sync();var k=e.target.name.slice('cycle-start-'.length);
    if(saving||draft.pending||!['goal','habit','cue','minimum','expected','domain','rhythm','remind'].includes(k))return;
    draft[k]=e.target.value;persist();
    if(k==='rhythm'||k==='remind'){var summary=e.target.form.querySelector('.cycle-advanced summary');if(summary)summary.textContent='Дни, напоминание и запасной шаг · '+(rhythms[draft.rhythm]||rhythms.daily)[0]+(draft.remind?' · '+draft.remind:'');}
  }
  document.addEventListener('input',input);
  document.addEventListener('change',input);
  document.addEventListener('submit',function(e){if(e.target.id==='cycle-start'){e.preventDefault();save();}});
  window.CYCLESTART={view:starter,launch:launch,isOpen:function(){sync();return open;}};
})();
