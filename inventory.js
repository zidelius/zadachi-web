/* Кухня и остатки. Черновик не расходует продукты; готовность — отдельное
   подтверждённое атомарное действие сервера. Пищевая/медицинская дозировка не угадывается. */
(function () {
  'use strict';
  var X=window.__app;if(!X||!X.sb)return;
  var sb=X.sb,q=X.q,E=X.esc,A=X.A;
  var S={user:null,pantry:[],plans:[],results:[],ok:false,error:'',loading:null,saving:false,busy:{}};
  var U={open:false,draft:null,error:''};
  function str(v){return String(v==null?'':v);}
  function n(v){if(v===''||v==null)return null;var x=Number(str(v).replace(',','.'));return Number.isFinite(x)?x:null;}
  function positive(v){var x=n(v);return x!==null&&x>0&&x<=1000000000;}
  function norm(v){return str(v).trim().toLocaleLowerCase('ru').replace(/\s+/g,' ');}
  function unit(v){var x=norm(v);return({'г':'g','гр':'g','кг':'kg','мл':'ml','л':'l'})[x]||x;}
  function convert(qty,from,to){var a=unit(from),b=unit(to),x=n(qty);if(x===null)return null;if(a&&a===b)return x;if(a==='kg'&&b==='g'||a==='l'&&b==='ml')return x*1000;if(a==='g'&&b==='kg'||a==='ml'&&b==='l')return x/1000;return null;}
  function realDay(v){return /^\d{4}-\d{2}-\d{2}$/.test(str(v))&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function own(rows,user){return(rows||[]).filter(function(r){return r&&r.owner===user;});}
  function empty(){return{id:null,title:'',ingredients:[{pantry_id:'',qty:'',unit:'',hint:''}],output_name:'',output_qty:'',output_unit:'',output_kind:'dish',output_expires:'',note:'',revision:null};}
  function reset(user){S.user=user;S.pantry=[];S.plans=[];S.results=[];S.ok=false;S.error='';S.busy={};U.open=false;U.draft=empty();U.error='';}
  async function load(){
    var user=X.ME;if(!user){if(S.user)reset(null);return;}if(S.user!==user)reset(user);
    if(S.loading)return S.loading;
    var pending=(async function(){try{
      var r=await Promise.all([
        q(sb.from('pantry').select('*').eq('owner',user).order('name').limit(2000)),
        q(sb.from('cooking_plans').select('*').eq('owner',user).order('created_at',{ascending:false}).limit(300)),
        q(sb.from('cooking_results').select('*').eq('owner',user).order('created_at',{ascending:false}).limit(300))
      ]);if(X.ME!==user||S.user!==user)return;
      S.pantry=own(r[0],user);S.plans=own(r[1],user);S.results=own(r[2],user);S.ok=true;S.error='';
      // The fridge renderer belongs to HEALTH; keep its stock view authoritative
      // after a task/intake/cooking write without requiring another full reload.
      if(window.HEALTH&&window.HEALTH.r&&window.HEALTH.r.H)window.HEALTH.r.H.pantry=clone(S.pantry);
    }catch(e){if(X.ME===user){S.ok=false;S.error='Не удалось загрузить учёт готовки. Обнови раздел; для первого запуска требуется миграция inventory.';}}})();
    S.loading=pending;try{await pending;}finally{if(S.loading===pending)S.loading=null;}
  }
  async function refresh(){if(S.loading)await S.loading;await load();if(window.HEALTH&&window.HEALTH.load)await window.HEALTH.load();}
  function ensure(){if(S.user!==X.ME)reset(X.ME);if(X.ME&&!S.ok&&!S.loading&&!S.error)load().then(X.render);}
  function pantry(){ensure();return S.pantry;}
  function item(id){return pantry().find(function(p){return p.id===id;});}
  function planById(id){ensure();return S.plans.find(function(p){return p.id===id;});}
  function stage(p){return p.stage==='prep'?'заготовка':p.stage==='dish'?'блюдо':'ингредиент';}
  function amount(v,u){return str(v)+(u?' '+u:'');}
  function option(value,label,selected){return '<option value="'+E(value)+'"'+(str(selected)===str(value)?' selected':'')+'>'+E(label)+'</option>';}
  function stockOptions(selected){var rows=pantry();return option('','Не связывать с остатками',selected)+rows.map(function(p){return option(p.id,p.name+' · '+stage(p)+' · '+(p.qty==null?'остаток не указан':amount(p.qty,p.unit)),selected);}).join('')+(selected&&!rows.some(function(p){return p.id===selected;})?option(selected,'Связанный продукт недоступен — можно убрать связь',selected):'');}

  function mealPreset(m){return{stock_item_id:m&&m.stock_item_id||'',stock_qty:m&&m.stock_qty!=null?str(m.stock_qty):'',stock_unit:m&&m.stock_unit||''};}
  function mealFields(s){
    ensure();var id=s.stock_item_id||'';
    return '<div class="hsec inventory-meal"><div class="hsec-title">Связать с холодильником</div><label><span class="gl">Продукт, заготовка или блюдо</span><select class="fld" id="inv-meal-item" data-f="stock_item_id">'+stockOptions(id)+'</select></label><div class="row2" style="margin-top:8px"><label><span class="gl">Сколько списать</span><input class="fld" id="inv-meal-qty" data-f="stock_qty" type="number" min="0.000001" step="any" value="'+E(s.stock_qty||'')+'"></label><label><span class="gl">Единица списания</span><input class="fld" id="inv-meal-unit" data-f="stock_unit" maxlength="40" placeholder="Например, г или порция" value="'+E(s.stock_unit||'')+'"></label></div><p class="muted">План ничего не списывает. После отметки «съел(а)» остаток уменьшится; отмена или удаление вернёт реально списанное. Количество отдельно от веса для расчёта питания. Разрешён только г↔кг, мл↔л или та же единица.</p></div>';
  }
  function mealRow(s){
    if(!s.stock_item_id)return{stock_item_id:null,stock_qty:null,stock_unit:''};
    var p=item(s.stock_item_id),qty=n(s.stock_qty),u=str(s.stock_unit).trim();
    if(!p)throw new Error('Связанный продукт недоступен. Обнови холодильник или убери связь.');
    if(!positive(qty)||!u||u.length>40)throw new Error('Нужно точное количество и единица списания из холодильника.');
    if(convert(qty,u,p.unit)===null)throw new Error('Единицы не совпадают. Упаковки в штуки/граммы автоматически не переводятся.');
    return{stock_item_id:p.id,stock_qty:qty,stock_unit:u};
  }
  function mealProposal(d){return mealRow(d);}

  function field(key,label,value,attrs){return '<label><span class="gl">'+E(label)+'</span>'+FORMUI.smart('class="fld" id="inv-'+key+'" data-inv-field="'+key+'" '+(attrs||'')+(S.saving?' disabled':''),value)+'</label>';}
  function button(action,label,value,cls){return '<button type="button" class="'+(cls||'btn2')+'" data-a="'+action+'"'+(value!=null?' data-v="'+E(value)+'"':'')+(S.saving?' disabled':'')+'>'+E(label)+'</button>';}
  function ingredientLabel(g){var p=item(g.pantry_id);return(p?p.name:'Продукт недоступен')+' — '+amount(g.qty,g.unit);}
  function preview(p){return(p.ingredients||[]).map(ingredientLabel).join('; ')+' → '+amount(p.output_qty,p.output_unit)+' «'+p.output_name+'»';}
  function draftForm(){
    var d=U.draft||(U.draft=empty());
    var h='<form class="prop inventory-form" data-inv-form="draft"><h3>'+(d.id?'Изменить план готовки':'Новый план готовки')+'</h3>'+field('title','Название плана',d.title,'required maxlength="200"')+'<div class="gl">Ингредиенты — фактическое количество из холодильника</div>';
    d.ingredients.forEach(function(g,i){
      h+='<div class="inventory-ingredient"><label><span class="gl">Продукт '+(i+1)+'</span><select class="fld" id="inv-ingredient-'+i+'-item" data-inv-ingredient="'+i+':pantry_id"'+(S.saving?' disabled':'')+'>'+stockOptions(g.pantry_id)+'</select></label><div class="row2"><label><span class="gl">Количество</span><input class="fld" id="inv-ingredient-'+i+'-qty" data-inv-ingredient="'+i+':qty" type="number" min="0.000001" step="any" value="'+E(g.qty)+'"'+(S.saving?' disabled':'')+'></label><label><span class="gl">Единица</span><input class="fld" id="inv-ingredient-'+i+'-unit" data-inv-ingredient="'+i+':unit" maxlength="40" value="'+E(g.unit)+'"'+(S.saving?' disabled':'')+'></label></div>'+(g.hint?'<div class="muted">Из рецепта: '+E(g.hint)+'</div>':'')+button('invIngredientDel','Убрать ингредиент',i,'link')+'</div>';
    });
    h+=button('invIngredientAdd','Добавить ингредиент')+'<div class="row2">'+field('output_name','Что получится',d.output_name,'required maxlength="200"')+'<label><span class="gl">Этап</span><select class="fld" id="inv-output-kind" data-inv-field="output_kind"'+(S.saving?' disabled':'')+'>'+option('prep','Заготовка',d.output_kind)+option('dish','Готовое блюдо',d.output_kind)+'</select></label></div><div class="row2">'+field('output_qty','Фактический выход',d.output_qty,'type="number" min="0.000001" step="any" required')+field('output_unit','Единица выхода',d.output_unit,'required maxlength="40" placeholder="г, мл, порция…"')+'</div>'+field('output_expires','Срок годности — если известен',d.output_expires,'type="date"')+'<label><span class="gl">Рецепт / заметка</span><textarea class="fld" id="inv-note" data-inv-field="note" rows="3" maxlength="10000"'+(S.saving?' disabled':'')+'>'+E(d.note)+'</textarea></label><p class="muted">Каждое приготовление создаёт отдельную партию. Выход измерь или укажи свою явную единицу (например, 4 порции). Массу, калории и срок годности приложение не угадывает.</p>'+(U.error?'<div class="herr" role="alert">'+E(U.error)+'</div>':'')+'<div class="growth-actions"><button class="btn" type="submit"'+(S.saving?' disabled':'')+'>'+(S.saving?'Сохраняю…':'Сохранить черновик — без списания')+'</button>'+button('invClose','Свернуть')+'</div></form>';
    return h;
  }
  function kitchenView(){
    ensure();var h='<section class="inventory-kitchen"><h3>Приготовление и остатки</h3><p class="muted">Ингредиенты → заготовка → блюдо → приём пищи. Черновики не резервируют продукты. Только «Приготовлено» списывает ингредиенты и добавляет измеренный выход.</p>';
    if(S.error)h+='<div class="herr" role="alert">'+E(S.error)+'</div>'+button('invReload','Повторить загрузку');
    if(!S.ok&&!S.error)h+='<p class="muted">Загружаю учёт готовки…</p>';
    h+=button('invNew','Новый план готовки');if(U.open)h+=draftForm();
    var drafts=S.plans.filter(function(p){return p.status==='draft';});
    if(drafts.length)h+='<h3>Черновики</h3>'+drafts.map(function(p){return '<article class="prop inventory-card"><b>'+E(p.title)+'</b><p class="muted">'+E(preview(p))+'</p><div class="growth-actions">'+button('invEdit','Изменить',p.id)+button('invCook',S.busy[p.id]?'Учитываю…':'Приготовлено',p.id,'btn')+button('invDelete','Удалить черновик',p.id,'link')+'</div></article>';}).join('');
    var logs=S.results.slice(0,30);if(logs.length)h+='<details class="wdet inventory-log"><summary>Журнал приготовлений ('+logs.length+(S.results.length>30?'+':'')+')</summary>'+logs.map(function(r){var o=r.output||{};return '<article class="prop"><b>'+E(o.name||'Приготовление')+'</b><div class="meta">'+E(str(r.created_at).slice(0,10))+' · '+E(amount(o.qty,o.unit))+'</div><p class="muted">'+E((r.ingredients||[]).map(function(g){return g.name+' — '+amount(g.qty,g.unit);}).join('; '))+'</p></article>';}).join('')+'</details>';
    return h+'</section>';
  }
  function validateDraft(d,rows){
    var stocks=rows||pantry(),title=str(d.title).trim(),name=str(d.output_name).trim(),u=str(d.output_unit).trim();
    if(!title||title.length>200||!name||name.length>200||!positive(d.output_qty)||!u||u.length>40||['prep','dish'].indexOf(d.output_kind)<0)throw new Error('Укажи название и фактический положительный выход с единицей.');
    if(!Array.isArray(d.ingredients)||!d.ingredients.length||d.ingredients.length>30)throw new Error('Нужно от 1 до 30 ингредиентов.');
    var ingredients=d.ingredients.map(function(g){var p=stocks.find(function(p){return p.id===g.pantry_id&&p.owner===X.ME;}),qty=n(g.qty),gu=str(g.unit).trim();if(!p||!positive(qty)||!gu||gu.length>40)throw new Error('Для каждого ингредиента выбери свой продукт, количество и единицу.');if(convert(qty,gu,p.unit)===null)throw new Error('Несовместимые единицы ингредиента «'+p.name+'». Укажи ту же единицу, г↔кг или мл↔л.');return{pantry_id:p.id,qty:qty,unit:gu};});
    if(d.output_expires&&!realDay(d.output_expires))throw new Error('Проверь срок годности.');
    return{owner:X.ME,title:title,ingredients:ingredients,output_name:name,output_qty:n(d.output_qty),output_unit:u,output_kind:d.output_kind,output_expires:d.output_expires||null,note:str(d.note).trim().slice(0,10000)};
  }
  async function freshStocks(){var user=X.ME;if(!user)throw new Error('Сначала войди');var rows=await q(sb.from('pantry').select('*').eq('owner',user).limit(2000));if(X.ME!==user)throw new Error('Аккаунт изменился');return own(rows,user);}
  async function getPlan(id){var user=X.ME,row=await q(sb.from('cooking_plans').select('*').eq('owner',user).eq('id',id).maybeSingle());if(X.ME!==user||!row||row.owner!==user)throw new Error('План приготовления недоступен. Обнови раздел.');return row;}
  function fingerprint(row){return JSON.stringify([norm(row.title),row.ingredients,row.output_name,row.output_qty,unit(row.output_unit),row.output_kind]);}
  async function saveDraft(d,proposal){
    var stocks=await freshStocks(),row=validateDraft(d,stocks),user=X.ME;
    if(d.id){var existing=await q(sb.from('cooking_plans').select('*').eq('owner',user).eq('id',d.id).maybeSingle());if(existing){if(existing.status!=='draft'){if(proposal)return{row:existing,existing:true};throw new Error('Приготовление уже учтено; создайте новый черновик.');}if(proposal)return{row:existing,existing:true};if(d.revision!=null&&existing.revision!==d.revision)throw new Error('Черновик изменён на другом устройстве. Открой его заново.');var updated=await q(sb.from('cooking_plans').update(row).eq('owner',user).eq('id',d.id).eq('revision',existing.revision).select().maybeSingle());if(!updated)throw new Error('Черновик изменился. Обнови раздел.');return{row:updated,existing:false};}}
    if(proposal){var candidates=await q(sb.from('cooking_plans').select('*').eq('owner',user).eq('status','draft').limit(300));var duplicate=own(candidates,user).find(function(p){return fingerprint(p)===fingerprint(row);});if(duplicate)return{row:duplicate,existing:true};}
    if(!d.id){d.id=crypto.randomUUID();if(X.asSave)X.asSave();}
    row.id=d.id;
    try{return{row:await q(sb.from('cooking_plans').insert(row).select().single()),existing:false};}
    catch(e){var retry=await q(sb.from('cooking_plans').select('*').eq('owner',user).eq('id',d.id).maybeSingle());if(retry&&fingerprint(retry)===fingerprint(row))return{row:retry,existing:true};throw e;}
  }
  async function cook(id,requestId){
    ensure();if(S.busy[id])throw new Error('Это приготовление уже обрабатывается');
    S.busy[id]=true;X.render();
    try{var p=await getPlan(id);if(p.status==='cooked'){await refresh();return{already_cooked:true};}
      if(!confirm('Подтвердить, что уже приготовлено?\n\n'+preview(p)+'\n\nИнгредиенты спишутся, выход появится отдельной партией. Для исправления приготовленного журнала автоматическая отмена не предусмотрена.'))throw new Error('Готовность не подтверждена. Ничего не списано.');
      var user=X.ME,result=await q(sb.rpc('inventory_cook',{p_plan_id:p.id,p_request_id:requestId||crypto.randomUUID(),p_expected_revision:p.revision}));
      if(X.ME!==user)throw new Error('Аккаунт изменился');await refresh();return result;
    }finally{delete S.busy[id];X.render();}
  }
  async function fromRecipe(r){
    await load();var d=empty();d.title=str(r.title||r.name||'Приготовление').slice(0,200);d.output_name=d.title;
    d.ingredients=(r.ingredients||[]).slice(0,30).map(function(g){var matches=pantry().filter(function(p){return norm(p.name)===norm(g.name);}),p=matches.length===1?matches[0]:null,raw=str(g.amount),m=raw.match(/^\s*(\d+(?:[.,]\d+)?)\s+([^\d]+?)\s*$/),qty=m&&p&&convert(m[1],m[2],p.unit)!==null?m[1]:'';return{pantry_id:p?p.id:'',qty:qty,unit:qty?m[2]:p?p.unit:'',hint:[g.name,g.amount].filter(Boolean).join(' — ')};});
    if(!d.ingredients.length)d.ingredients=empty().ingredients;
    if(positive(r.output_qty)&&str(r.output_unit).trim()){d.output_qty=str(r.output_qty);d.output_unit=str(r.output_unit).trim();}
    if(r.output_kind==='prep')d.output_kind='prep';
    d.note=(r.steps||[]).map(function(st,i){return(i+1)+'. '+st;}).join('\n');if(r.tip)d.note+='\n'+r.tip;
    U.draft=d;U.open=true;U.error='';X.render();return d;
  }
  function asEntries(a){return(a.cooking_plans||[]).map(function(d){return{t:'cooking_plan',d:d};}).concat((a.cooking_confirm||[]).map(function(d){return{t:'cooking_confirm',d:d};}));}
  function entryInfo(e){var d=e.t==='cooking_confirm'?planById(e.d.plan_id):e.d;if(!d)return{title:'План приготовления недоступен',meta:['Обнови кухню'],note:'Списание невозможно без своего существующего плана.'};return{title:d.title,meta:[e.t==='cooking_confirm'?'Подтверждение готовности':'Черновик — без списания',amount(d.output_qty,d.output_unit),d.output_kind==='prep'?'заготовка':'блюдо'],note:preview(d)};}
  function entryText(e){var inf=entryInfo(e);return{title:'Приготовление: '+inf.title,body:inf.meta.join(' · ')+'\n'+inf.note};}
  async function addFrom(e){
    if(e.t==='cooking_confirm'){if(!e.d._inventory_request_id){e.d._inventory_request_id=crypto.randomUUID();if(X.asSave)X.asSave();}var result=await cook(e.d.plan_id,e.d._inventory_request_id);e._existing=!!result.already_cooked;return result;}
    if(e.t!=='cooking_plan')throw new Error('Неизвестный тип приготовления');
    if(!e.d._inventory_id){e.d._inventory_id=crypto.randomUUID();if(X.asSave)X.asSave();}
    var result=await saveDraft(Object.assign({},e.d,{id:e.d._inventory_id}),true);e._existing=result.existing;await refresh();return result;
  }
  function summaryText(){ensure();return 'Черновики готовки (не списаны):\n'+S.plans.filter(function(p){return p.status==='draft';}).slice(0,20).map(function(p){return p.id+' '+p.title+': '+preview(p);}).join('\n');}
  async function exportData(){var user=X.ME;if(!user)return{cooking_plans:[],cooking_results:[],coverage:{}};var out={coverage:{}};for(var table of ['cooking_plans','cooking_results']){var all=[],offset=0,done=false;while(offset<10000){var rows=own(await q(sb.from(table).select('*').eq('owner',user).order('id').range(offset,offset+499)),user);if(X.ME!==user)throw new Error('Аккаунт изменился');all=all.concat(rows);offset+=500;if(rows.length<500){done=true;break;}}out[table]=all;out.coverage[table]={truncated:!done};}return out;}
  async function saveForm(){if(S.saving)return;S.saving=true;U.error='';X.render();try{var result=await saveDraft(U.draft,false);if(X.ME!==result.row.owner)throw new Error('Аккаунт изменился');U.draft=empty();U.open=false;await refresh();X.toast('Черновик сохранён. Продукты не списаны.');}catch(e){U.error=e.message||str(e);}finally{S.saving=false;X.render();}}
  Object.assign(A,{
    invNew:function(){ensure();U.open=true;U.draft=empty();U.error='';X.render();},invClose:function(){U.open=false;X.render();},
    invIngredientAdd:function(){if(S.saving)return;var d=U.draft||(U.draft=empty());if(d.ingredients.length<30)d.ingredients.push({pantry_id:'',qty:'',unit:'',hint:''});X.render();},
    invIngredientDel:function(v){if(S.saving)return;U.draft.ingredients.splice(+v,1);X.render();},
    invEdit:function(v){var p=planById(v);if(!p||p.status!=='draft')return;U.draft=clone(p);U.open=true;U.error='';X.render();},
    invCook:async function(v){try{await cook(v);X.toast('Приготовление учтено');}catch(e){X.err(e);}},
    invDelete:async function(v){if(S.saving||!confirm('Удалить только черновик? Остатки не изменятся.'))return;try{await q(sb.from('cooking_plans').delete().eq('owner',X.ME).eq('id',v).eq('status','draft'));await load();X.render();}catch(e){X.err(e);}},
    invReload:async function(){S.error='';await load();X.render();}
  });
  function changed(e){var el=e.target;if(!el||!el.getAttribute)return;var key=el.getAttribute('data-inv-field'),ing=el.getAttribute('data-inv-ingredient');if(S.saving)return;if(key&&U.draft)U.draft[key]=el.value;if(ing&&U.draft){var parts=ing.split(':'),g=U.draft.ingredients[+parts[0]];if(!g)return;g[parts[1]]=el.value;if(parts[1]==='pantry_id'){var p=item(el.value);g.unit=p?p.unit:'';X.render();}}}
  document.addEventListener('input',changed);document.addEventListener('change',changed);
  document.addEventListener('submit',function(e){if(e.target&&e.target.getAttribute&&e.target.getAttribute('data-inv-form')==='draft'){e.preventDefault();saveForm();}});
  window.INVENTORY={load:load,kitchenView:kitchenView,mealFields:mealFields,mealPreset:mealPreset,mealRow:mealRow,mealProposal:mealProposal,fromRecipe:fromRecipe,
    owns:function(t){return t==='cooking_plan'||t==='cooking_confirm';},asEntries:asEntries,entryInfo:entryInfo,entryText:entryText,addFrom:addFrom,summaryText:summaryText,exportData:exportData,
    data:function(){ensure();return clone({pantry:S.pantry,plans:S.plans,results:S.results,ok:S.ok});},helpers:{convert:convert,validateDraft:validateDraft,realDay:realDay}};
})();
