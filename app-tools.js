/* Справка продукта и переносимый экспорт собственных записей. Без токенов и ключей. */
(function(){
  'use strict';var X=window.__app;if(!X)return;var exporting=false;
  function own(rows){return(rows||[]).filter(function(r){return r.owner===X.ME;});}
  function settings(){return '<div class="rulebox"><b>Мои данные</b><div class="gh">JSON собственных записей: задачи, привычки, питание, тренировки, развитие и заметки. Это чувствительные данные — храни файл безопасно. Вложения представлены ссылками внутри приложения, сами файлы не скачиваются. Экспорт не является полным архивом аккаунта.</div><button type="button" class="btn2" data-a="exportOwnData"'+(exporting?' disabled':'')+'>'+(exporting?'Готовлю…':'Скачать мои записи (JSON)')+'</button><button type="button" class="link" data-a="appGuide">Как пользоваться приложением</button></div>';}
  function guide(){
    var rows=[['1. Выбери направление','В «Развитии» выбери значимый для тебя результат. Сила, навык, спокойствие и забота о себе — разные направления, а не единый рейтинг человека.','growth','Открыть развитие'],['2. Свяжи с действием','Разовая подготовка — задача. Повторяемый небольшой шаг — привычка. Свяжи их с целью, чтобы видеть, ради чего ты это делаешь.','habits','Открыть привычки'],['3. Отмечай факты','Записывай практику навыка, тренировки, питание и самочувствие. План не считается выполнением. Необязательные показатели можно пропускать.','growth','Записать практику','skills'],['4. Пересматривай план','Недельный обзор нужен для выбора следующего шага: что помогло, что мешало, что стоит упростить. Отдых не ошибка и не потеря прогресса.','growth','Перейти к обзору','review'],['5. Используй помощника','Помощник учитывает доступные записи и предлагает связанные действия. До нажатия «Применить» это только предложения. Ошибки ИИ возможны — проверяй расписание и числа.','assistant','Открыть помощника'],['6. Настрой поддержку','Выбирай удобные часы и умеренное количество напоминаний. Свайп означает «увидел», а не «выполнил». Настойчивый режим Android включается отдельно на устройстве.','support','Открыть поддержку']];
    return '<div class="top"><div><div class="date">Система развития</div><h1 class="dh">Как пользоваться</h1></div></div><p class="muted">Приложение помогает организовать действия и замечать изменения. Оно не гарантирует «сверхэффективность», здоровье или определённую внешность и не заменяет специалиста.</p><div class="fields">'+rows.map(function(r){return '<div style="padding:16px"><b>'+r[0]+'</b><p>'+r[1]+'</p><button class="btn2" data-a="'+(r[4]?'appGrowthTab':'go')+'" data-v="'+(r[4]||r[2])+'">'+r[3]+'</button></div>';}).join('')+'</div><div class="rulebox" style="margin-top:16px"><b>Приватность и границы</b><p>При использовании помощника сообщения и доступные ему данные отправляются выбранному сервером ИИ-провайдеру. Выключить помощника можно в настройках. Данные развития и здоровья видны только владельцу; общий доступ к задачам и заметкам настраивается отдельно. Не отправляй пароли, коды входа и API-ключи.</p><p>Поддержка не назначает лечение, не оценивает твою ценность и не требует голодать или «отрабатывать» еду. Если состояние вызывает тревогу, обратись за профессиональной помощью.</p></div>';
  }
  async function data(){
    var D=X.D,H=window.HEALTH&&HEALTH.r&&HEALTH.r.H||{},W=window.WELL&&WELL.exportData?WELL.exportData():{};
    var hs=own(D.habits.concat(window.WELL?WELL.habits():[])),ids=new Set(hs.map(function(h){return h.id;})),marks={};
    Object.keys(D.marks).forEach(function(id){if(ids.has(id))marks[id]=D.marks[id];});
    var profile=D.profiles.find(function(p){return p.id===X.ME;})||{};
    return{format:'zadachi-personal-records',version:1,exported_at:new Date().toISOString(),scope:'loaded_own_records_without_binary_files',coverage:{core:'Загруженные личные записи, с ограничениями журналов приложения; не полный архив аккаунта',binary_files:false},profile:{id:X.ME,name:profile.name||''},tasks:own(D.tasks),lists:own(D.lists),habits:hs,habit_marks:marks,notes:own(D.notes),meals:own(H.meals),workouts:own(H.workouts),body_log:own(H.body),pantry:own(H.pantry),wellbeing:W,growth:window.GROWTH&&GROWTH.exportData?await GROWTH.exportData():null};
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
