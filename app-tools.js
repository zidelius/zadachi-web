/* Справка продукта и переносимый экспорт собственных записей. Без токенов и ключей. */
(function(){
  'use strict';var X=window.__app;if(!X)return;var exporting=false;
  function own(rows){return(rows||[]).filter(function(r){return r.owner===X.ME;});}
  function settings(){return '<div class="rulebox"><b>Мои данные</b><div class="gh">JSON собственных записей: задачи, привычки, питание, тренировки, цели и заметки. Это чувствительные данные — храни файл безопасно. Вложения представлены ссылками внутри приложения, сами файлы не скачиваются. Экспорт не является полным архивом аккаунта.</div><button type="button" class="btn2" data-a="exportOwnData"'+(exporting?' disabled':'')+'>'+(exporting?'Готовлю…':'Скачать мои записи (JSON)')+'</button><button type="button" class="link" data-a="appGuide">Как пользоваться приложением</button></div>';}
  function guide(){
    var rows=[
      ['Выбери направление','Начни с цели, которую выбрал сам. Запланируй одну проверку на семь дней: узнаваемый сигнал, обычный шаг и при желании облегченную версию.',[['cycle','Мой цикл'],['goals','Мои цели','appGrowthTab']]],
      ['Сделай следующий шаг видимым','Разовую подготовку записывай задачей, повторяемое действие — привычкой. Календарь показывает план, а не гарантию свободного времени.',[['tasks','Задачи'],['inbox','Входящие'],['calendar','Календарь'],['habits','Привычки']]],
      ['Собери факты, а не оценки','Дневник показывает отметки задач и привычек. Практика — это фактически потраченные минуты. В заметках отделяй то, что наблюдал, от своего объяснения.',[['diary','Дневник'],['skills','Практика','appGrowthTab'],['notes','Заметки']]],
      ['Учти условия дня','Отдых и изменение распорядка — не провал. В этих разделах можно уточнить, что уже известно и какой следующий шаг посилен. Не меняй назначения или дозировки на основе подсказки.',[['food','Питание и кухня'],['fit','Тренировки'],['well','Здоровье'],['support','Поддержка']]],
      ['Проверь и измени одно условие','Через неделю сравни ожидание с записями. Нет отметки — не знаем результат. Можно сохранить личный итог, выбрать другой сигнал, взять паузу или поставить следующий шаг в календарь.',[['cycle','Мой цикл'],['review','Обзор целей','appGrowthTab'],['checkin','Моё состояние','appGrowthTab']]],
      ['Используй ИИ как собеседника','Из раздела кнопка «ИИ» откроет редактируемый вопрос. Попроси предложить другое объяснение и одну проверку. Сначала прочитай предложение; записи меняются только после подтверждения.',[['assistant','Помощник'],['','Настройки','settings'],['','Списки','lists']]]
    ];
    var links=function(items){return '<div class="cycle-actions">'+items.map(function(item){return '<button class="btn2" type="button" data-a="'+(item[2]||'go')+'"'+(item[0]?' data-v="'+item[0]+'"':'')+'>'+item[1]+'</button>';}).join('')+'</div>';};
    return '<div class="top"><div><div class="date">Система целей</div><h1 class="dh">Как пользоваться</h1></div></div><p class="muted">Задачник помогает проверить, что работает в твоей жизни. Это не тест силы воли и не обещание изменить личность.</p><div class="cycle-grid">'+rows.map(function(r){return '<section class="cycle-stage"><h2>'+r[0]+'</h2><p>'+r[1]+'</p>'+links(r[2])+'</section>';}).join('')+'</div><div class="rulebox"><b>Кухня и аптечка: план не равен расходу</b><p>Готовка и списание запасов — только после факта. Неизвестное количество не считается нулём. Помощник не ставит диагноз, не назначает лечение и не предлагает компенсировать еду.</p></div><div class="rulebox"><b>Приватность</b><p>Личные отметки внутри проверки остаются в этом браузере. Итог можно отдельно сохранить в заметках. При обращении к помощнику приложения сообщение и доступный контекст отправляются выбранному ИИ-провайдеру. Не отправляй пароли, коды входа и ключи.</p></div>';
  }
  async function data(){
    var user=X.ME;
    var D=X.D,H=window.HEALTH&&HEALTH.r&&HEALTH.r.H||{},W=window.WELL&&WELL.exportData?WELL.exportData():{};
    var hs=own(D.habits.concat(window.WELL?WELL.habits():[])),ids=new Set(hs.map(function(h){return h.id;})),marks={};
    Object.keys(D.marks).forEach(function(id){if(ids.has(id))marks[id]=D.marks[id];});
    var profile=D.profiles.find(function(p){return p.id===X.ME;})||{};
    var out={format:'zadachi-personal-records',version:1,exported_at:new Date().toISOString(),scope:'loaded_own_records_without_binary_files',coverage:{core:'Загруженные личные записи, с ограничениями журналов приложения; не полный архив аккаунта',binary_files:false},profile:{id:user,name:profile.name||''},tasks:own(D.tasks),lists:own(D.lists),habits:hs,habit_marks:marks,notes:own(D.notes),meals:own(H.meals),workouts:own(H.workouts),body_log:own(H.body),pantry:own(H.pantry),wellbeing:W};
    out.growth=window.GROWTH&&GROWTH.exportData?await GROWTH.exportData():null;
    if(X.ME!==user)throw new Error('Аккаунт изменился во время экспорта');
    out.activity=window.ACTIVITY&&ACTIVITY.exportData?await ACTIVITY.exportData():null;
    if(X.ME!==user)throw new Error('Аккаунт изменился во время экспорта');
    out.inventory=window.INVENTORY&&INVENTORY.exportData?await INVENTORY.exportData():null;
    out.browser_experiments=window.MIND?MIND.exportData():[];
    if(X.ME!==user)throw new Error('Аккаунт изменился во время экспорта');return out;
  }
  async function exportOwn(){
    if(exporting||!X.ME)return;exporting=true;X.renderSheet();
    try{
      await X.loadAll();var json=JSON.stringify(await data(),null,2),name=X.T()+'_zadachi-records_v1.json',blob=new Blob([json],{type:'application/json'});
      if(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()){
        var bytes=new Uint8Array(await blob.arrayBuffer()),s='';for(var i=0;i<bytes.length;i+=8192)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
        await Capacitor.nativePromise('WidgetBridge','saveFile',{data:btoa(s),name:name,mime:'application/json'});X.toast('JSON сохранён в Загрузки/Задачи');
      }else{var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},30000);X.toast('JSON подготовлен. Проверь загрузки браузера.');}
    }catch(e){X.err(e);}finally{exporting=false;X.renderSheet();}
  }
  X.A.appGrowthTab=function(v){X.closeSheet();X.A.go('growth');if(X.A.grTab)X.A.grTab(v);};X.A.exportOwnData=exportOwn;X.A.appGuide=function(){X.closeSheet();X.A.go('guide');};
  window.APPTOOLS={guide:guide,settings:settings,exportData:data};
})();
