/* Личный эксперимент на семь дней. Не изменяет привычки, цели или напоминания. */
(function(){
  'use strict';
  var X=window.__app,A=X.A,E=X.esc,editing=null,issue='',selected=null;
  var labels={full:'Обычный шаг',small:'Облегчённый шаг',rest:'Осознанно не делал'};
  var weekdays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  var validDay=function(s){return typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;};
  function one(s,n){return typeof s==='string'?s.trim().replace(/\s+/g,' ').slice(0,n):'';}
  function own(id){return X.ME&&window.GROWTH&&GROWTH.data().goals.find(function(g){return g.owner===X.ME&&g.status==='active'&&g.id===id;});}
  function key(id){return 'zd-experiment-v1:'+X.ME+':'+id;}
  function asDays(list){return Array.from(new Set(Array.isArray(list)?list.filter(function(d){return Number.isInteger(d)&&d>=0&&d<7;}):[])).sort();}
  function weekday(d){return (X.fromKey(d).getDay()+6)%7;}
  function scheduled(p,d){return !p.days.length||p.days.includes(weekday(d));}
  function end(p){return X.addDays(p.start,6);}
  function last(p){return p.stop||end(p);}
  function finished(p,today){return !!p.stop||end(p)<today;}
  function inRange(p,d){return validDay(d)&&d>=p.start&&d<=end(p);}
  function opportunity(p){return p.days.length||7;}
  function forecasts(p){return p.expected!==null&&p.expected!==undefined;}
  function normal(p){
    if(!p||!validDay(p.start)||!p.id||typeof p.id!=='string'||!one(p.action,130)||!one(p.cue,100))return null;
    var n={id:p.id,start:p.start,cue:one(p.cue,100),action:one(p.action,130),minimum:one(p.minimum,130),reason:one(p.reason,180),days:asDays(p.days),habit:one(p.habit,80),log:{}};
    n.expected=Number.isInteger(p.expected)&&p.expected>=1&&p.expected<=opportunity(n)?p.expected:null;
    if(inRange(n,p.stop))n.stop=p.stop;
    for(var i=0;i<7;i++){
      var d=X.addDays(n.start,i),k=p.log&&p.log[d];if(d<=last(n)&&Object.hasOwn(labels,k)&&(k!=='small'||n.minimum)&&scheduled(n,d))n.log[d]=k;
    }
    return n;
  }
  function all(id,includeInactive){
    if(!own(id)&&!(includeInactive&&X.ME&&window.GROWTH&&GROWTH.data().goals.some(function(g){return g.owner===X.ME&&g.id===id;})))return [];
    try{
      var data=JSON.parse(localStorage.getItem(key(id))||'[]');
      return Array.isArray(data)?data.map(normal).filter(Boolean).slice(0,10):[];
    }catch(e){return [];}
  }
  function write(id,data){
    if(!own(id))throw Error('Цель больше недоступна. Выбери её снова.');
    try{localStorage.setItem(key(id),JSON.stringify(data.slice(0,10)));}catch(e){throw Error('Хранилище браузера недоступно. Изменения не сохранены.');}
  }
  function create(id,value){
    var data=all(id),start=X.T();
    if(data[0]&&!finished(data[0],start))throw Error('Текущая неделя ещё не завершилась.');
    var p=normal(Object.assign({},value,{id:X.uid(),start:start,log:{}}));
    if(!p)throw Error('Укажи узнаваемый сигнал и конкретное действие.');
    if(p.habit&&!habits(own(id)).some(function(h){return h.id===p.habit;}))throw Error('Связанная привычка больше недоступна. Выбери другой вариант.');
    if(value.expected!==null&&value.expected!==undefined&&!forecasts(p))throw Error('Ожидание должно быть от 1 до '+opportunity(p)+' дней либо пустым.');
    write(id,[p].concat(data));return p;
  }
  function habits(g){return (g&&g.link_habit_ids||[]).map(function(id){return X.D.habits.find(function(h){return h.id===id&&h.owner===X.ME&&!h.paused&&!h.finished;});}).filter(Boolean);}
  function draftFor(g,p){
    var hs=habits(g),h=hs[0];
    return p?{cue:p.cue,action:p.action,minimum:p.minimum,expected:p.expected,reason:p.reason,days:p.days.slice(),habit:hs.some(function(h){return h.id===p.habit;})?p.habit:''}:
      {cue:'',action:h?h.name:'',minimum:'',expected:null,reason:'',days:h?asDays(h.days):[],habit:h?h.id:''};
  }
  function field(id,label,max,value,placeholder,required){
    return '<label for="mind-'+id+'"><span>'+E(label)+'</span>'+FORMUI.line('class="fld" id="mind-'+id+'" name="'+id+'" maxlength="'+max+'" placeholder="'+E(placeholder)+'"'+(required?' required':''),value)+'</label>';
  }
  function button(label,a,v,cls){
    return '<button type="button" class="'+(cls||'btn2')+'" data-a="'+a+'"'+(v?' data-v="'+E(v)+'"':'')+'>'+E(label)+'</button>';
  }
  function card(body){
    return '<section class="cycle-starter mind-lab" id="mind-lab" aria-labelledby="mind-title"><div class="cycle-starter-head"><div><div class="cycle-index">ОДНО ИЗМЕНЕНИЕ НА 7 ДНЕЙ</div><h2 id="mind-title" tabindex="-1">Проверка в реальной жизни</h2></div></div>'+body+'</section>';
  }
  function dayButton(p,d,now){
    var mark=p.log[d],ok=scheduled(p,d),status=mark?labels[mark]:d>last(p)?'Пауза':!ok?'Не по плану':d>now?'Впереди':'Нет записи';
    return '<li class="cycle-day '+(mark==='full'?'done':mark==='small'?'part':!ok||d>last(p)?'off':'blank')+'"'+(d===now?' aria-current="date"':'')+'><time datetime="'+E(d)+'">'+E(X.fmtDM(d))+'</time><span>'+E(status)+'</span></li>';
  }
  function view(g){
    if(!g||!own(g.id))return '';
    var now=X.T(),p=all(g.id)[0],closed=p&&finished(p,now),ed=editing&&editing.user===X.ME&&editing.goal===g.id?editing.value:null,hs=habits(g);
    if(ed){
      return card('<p class="muted">Выбирай событие или время, которое реально заметишь, и одно действие. Эта проверка не меняет расписание привычки и не создаёт напоминаний.</p>'+
        '<form id="mind-form" data-goal="'+E(g.id)+'"><div class="cycle-start-fields">'+
        field('cue','Если / когда…',100,ed.cue,'После завтрака',true)+field('action','…то я сделаю',130,ed.action,'Две минуты распевки',true)+
        field('minimum','На трудный день (необязательно)',130,ed.minimum,'Мягко распеться на одной ноте',false)+
        '<label for="mind-expected"><span>Ожидаю дней с любым шагом</span><input type="number" id="mind-expected" class="fld" name="expected" inputmode="numeric" min="1" max="7" placeholder="Необязательно" value="'+(ed.expected||'')+'"></label></div>'+
        '<details class="cycle-advanced"'+(ed.reason||ed.days.length?' open':'')+'><summary>Дни, привычка и предположение</summary><div class="mind-days" aria-label="Дни проверки">'+weekdays.map(function(label,i){return '<label><input type="checkbox" name="day" value="'+i+'"'+(ed.days.includes(i)?' checked':'')+'> '+label+'</label>';}).join('')+'</div><p class="muted">Если ничего не выбрать, проверка идёт ежедневно.</p>'+
        (hs.length?'<label for="mind-habit"><span>Связанная привычка</span><select class="fld" id="mind-habit" name="habit"><option value="">Без привязки</option>'+hs.map(function(h){return '<option value="'+E(h.id)+'"'+(h.id===ed.habit?' selected':'')+'>'+E(h.name)+'</option>';}).join('')+'</select></label>':'')+
        field('reason','Что должно упростить шаг? (необязательно)',180,ed.reason,'Например: подготовленный с вечера микрофон',false)+'</details>'+
        (issue?'<p class="err" role="alert">'+E(issue)+'</p>':'')+
        '<div class="cycle-actions"><button class="btn" type="submit">Запустить проверку</button>'+button('Не сейчас','mindClose',g.id)+'</div></form>');
    }
    if(!p)return card('<p>Запиши правило «если — то» и облегчённый вариант. Через неделю сравни ожидание с записями, а не с идеальным расписанием.</p><div class="cycle-actions">'+button('Составить проверку','mindEdit',g.id,'btn2')+'</div>');
    var date=selected&&selected.user===X.ME&&selected.id===p.id&&inRange(p,selected.day)&&selected.day<=now&&scheduled(p,selected.day)?selected.day:!closed&&scheduled(p,now)?now:'';
    var opts=[],days=[];for(var i=0;i<7;i++){var d=X.addDays(p.start,i);days.push(dayButton(p,d,now));if(d<=now&&scheduled(p,d))opts.push('<option value="'+E(d)+'"'+(d===date?' selected':'')+'>'+E(X.fmtDM(d))+'</option>');}
    var s=counts(p,p.start,end(p),now);
    return card('<p class="mind-rule"><b>Когда:</b> '+E(p.cue)+' <b>Действие:</b> '+E(p.action)+'</p>'+
      (p.minimum?'<p><b>На трудный день:</b> '+E(p.minimum)+'</p>':'')+(p.reason?'<p><b>Проверяю предположение:</b> '+E(p.reason)+'</p>':'')+
      (hs.some(function(h){return h.id===p.habit;})?'<div class="cycle-actions">'+button('Открыть связанную привычку','grOpenHabit',p.habit)+'</div>':'')+
      '<p class="muted">'+E(X.fmtDM(p.start))+' — '+E(X.fmtDM(end(p)))+' · '+(p.stop?'Пауза с '+E(X.fmtDM(p.stop))+'.':closed?'Неделя завершена.':opportunity(p)+' дней в плане.')+(forecasts(p)?' Ожидание: '+p.expected+' дней с любым шагом.':'')+'</p>'+
      '<div class="cycle-week"><ol>'+days.join('')+'</ol></div>'+
      '<p class="muted">Завершённые дни: '+s.full+' обычных, '+s.small+' облегчённых, '+s.rest+' дней без действия, '+s.empty+' без записи. Это наблюдения, не оценка и не мера автоматичности.</p>'+
      (!closed&&opts.length?'<label for="mind-day"><span>Записать факт за</span><select class="fld" id="mind-day" data-goal="'+E(g.id)+'" data-id="'+E(p.id)+'"><option value="">Выбрать день</option>'+opts.join('')+'</select></label>':'')+
      (date&&!closed?'<div class="cycle-actions" aria-label="Записать факт">'+button('Сделал обычный шаг','mindMark',g.id+'|'+date+'|full',p.log[date]==='full'?'btn':'btn2')+
        (p.minimum?button('Сделал минимум','mindMark',g.id+'|'+date+'|small',p.log[date]==='small'?'btn':'btn2'):'')+
        button('Отдых / не делал','mindMark',g.id+'|'+date+'|rest',p.log[date]==='rest'?'btn':'btn2')+(p.log[date]?button('Убрать отметку','mindMark',g.id+'|'+date+'|clear','link'):'')+'</div>':'')+
      (closed?'<div class="cycle-actions">'+button('Подвести итог проверки','mindReview',g.id)+button('Проверить новый вариант','mindEdit',g.id)+'</div>':
        '<details class="cycle-advanced"><summary>Сигнал или распорядок изменились?</summary><p>Можно остановить эту проверку и с новым сигналом начать другую. Записи останутся, привычка не изменится.</p>'+button('Поставить проверку на паузу','mindPause',g.id)+'</details>')+
      (issue?'<p class="err" role="alert">'+E(issue)+'</p>':'')+
      '<p class="muted">План и эти отметки хранятся в этом браузере, отдельно от привычек. Итог можно сохранить в личные заметки.</p>');
  }
  function counts(p,from,to,today){
    var c={full:0,small:0,rest:0,empty:0};
    for(var i=0;i<7;i++){
      var d=X.addDays(p.start,i);if(d<from||d>to||d>last(p)||d>=today||!scheduled(p,d))continue;c[p.log[d]||'empty']++;
    }
    return c;
  }
  function facts(id,from,to){
    var t=X.T();
    return all(id).filter(function(p){return p.start<=to&&last(p)>=from;}).slice(0,3).map(function(p){
      var c=counts(p,from,to,t),total=c.full+c.small+c.rest+c.empty;
      if(!total)return '';
      var complete=!p.stop&&p.start>=from&&end(p)<=to&&end(p)<t,comp='';
      if(complete&&forecasts(p)){
        var n=c.full+c.small;
        comp=' Ожидание: '+p.expected+' дней; '+(n>=p.expected?'подтверждено отметками.':n+c.empty>=p.expected?'недостаточно записей для сравнения.':'по имеющимся записям не достигнуто.');
      }
      return 'Проверка '+X.fmtDM(p.start)+' — '+X.fmtDM(last(p))+': '+c.full+' обычных, '+c.small+' облегчённых, '+c.rest+' осознанно без действия, '+c.empty+' без записи ('+total+' завершённых дней в плане).'+(p.stop?' Проверка остановлена.':'')+comp;
    }).filter(Boolean);
  }
  function focus(){var el=document.getElementById('mind-title');if(el)el.focus();}
  A.mindJump=function(){A.go('cycle');focus();};
  A.mindEdit=function(id){
    var g=own(id),p=all(id)[0];if(!g||p&&!finished(p,X.T()))return;
    editing={user:X.ME,goal:id,value:draftFor(g,p)};issue='';X.render();focus();
  };
  A.mindClose=function(){editing=null;issue='';X.render();focus();};
  A.mindMark=function(v){
    var a=String(v).split('|'),id=a[0],d=a[1],type=a[2],data=all(id),p=data[0];
    if(!p||finished(p,X.T())||!inRange(p,d)||d>X.T()||!scheduled(p,d)||!(type==='clear'||Object.hasOwn(labels,type))||type==='small'&&!p.minimum)return;
    try{
      if(type==='clear')delete p.log[d];else p.log[d]=type;
      write(id,data);issue='';selected={user:X.ME,id:p.id,day:d};X.toast(type==='clear'?'Запись убрана.':'Наблюдение записано в проверку.');
    }catch(e){issue=e.message;}
    X.render();focus();
  };
  A.mindPause=function(id){
    var data=all(id),p=data[0],now=X.T();if(!p||!inRange(p,now)||finished(p,now)||!window.confirm('Поставить проверку на паузу? Отметки останутся.'))return;
    try{p.stop=now;write(id,data);issue='';X.toast('Проверка на паузе. Привычка не изменилась.');}catch(e){issue=e.message;}
    X.render();focus();
  };
  A.mindReview=function(id){var p=all(id)[0],now=X.T();if(p&&finished(p,now))A.cycleReviewOpen(id,last(p)<now?last(p):X.addDays(now,-1));};
  document.addEventListener('change',function(e){
    var el=e.target;
    if(el.id==='mind-day'){selected={user:X.ME,id:el.dataset.id,day:el.value};X.render();var n=document.getElementById('mind-day');if(n)n.focus();}
  });
  function formValues(f){
    var val=new FormData(f),expected=val.get('expected');
    return {cue:val.get('cue'),action:val.get('action'),minimum:val.get('minimum'),reason:val.get('reason'),habit:val.get('habit'),expected:expected===''?null:Number(expected),days:val.getAll('day').map(Number)};
  }
  document.addEventListener('input',function(e){
    var f=e.target.form;
    if(f&&f.id==='mind-form'&&editing&&editing.user===X.ME&&editing.goal===f.dataset.goal) editing.value=formValues(f);
  });
  document.addEventListener('submit',function(e){
    var f=e.target;if(f.id!=='mind-form')return;e.preventDefault();
    var k=f.dataset.goal;
    if(!editing||editing.user!==X.ME||editing.goal!==k||!own(k))return;
    var data=formValues(f);
    try{create(k,data);editing=null;issue='';X.toast('Проверка началась. Записывай только то, что произошло.');}catch(e){editing.value=data;issue=e.message;}
    X.render();focus();
  });
  window.MIND={view:view,facts:facts,exportData:function(){
    var user=X.ME;if(!user||!window.GROWTH)return [];
    return GROWTH.data().goals.filter(function(g){return g.owner===user;}).map(function(g){return {goal_id:g.id,experiments:all(g.id,true)};}).filter(function(g){return g.experiments.length;});
  },seed:function(g,record){
    if(!g||!record.cue||!own(g.id)||all(g.id).length)return false;
    try{create(g.id,record);return true;}catch(e){return false;}
  },home:function(g){
    var p=g&&all(g.id)[0];return p&&inRange(p,X.T())&&!p.stop?{planned:scheduled(p,X.T()),action:p.action}:null;
  }};
})();
