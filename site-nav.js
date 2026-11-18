/* Same-document history for the phone Back gesture. No record data in URLs or history.state. */
(function(){
  'use strict';
  var token=null,user=null,entries=[],index=0,queued=false,restoring=false,pending=null,returning=false;
  function app(){return window.__app;}
  function main(){return document.querySelector('#app .main');}
  function active(){return token&&app()&&app().ME===user;}
  function tabs(view){
    if((view==='food'||view==='fit')&&window.HEALTH)return HEALTH.navState(view);
    if(view==='well'&&window.WELL)return WELL.navState();
    if(view==='growth'&&window.GROWTH)return GROWTH.tab();
    return null;
  }
  function viewKey(s){return JSON.stringify([s.view,s.filter,s.calendar,s.tabs,s.chat&&s.chat.id]);}
  function key(s){
    var sh=s.sheet,sp=s.clock,nf=s.file;
    return JSON.stringify([viewKey(s),s.sel,s.note,sh&&[sh.type,sh.id||null,sh.pk||sh.kind||null,sh.key||null],sp&&sp.key,nf&&[nf.nid,nf.i]]);
  }
  function depth(s){return Number(!!s.sel)+Number(!!s.note)+Number(!!s.sheet)+Number(!!s.clock)+Number(!!s.file);}
  function take(){
    var X=app(),u=X.UI,v=u.view,m=main();
    return{view:v,filter:v==='tasks'?u.filter:'all',calendar:v==='calendar'?[u.cal,u.calDay]:null,tabs:tabs(v),
      chat:v==='assistant'&&window.CYCLE?CYCLE.navState():null,sel:u.sel||null,note:u.noteId||null,sheet:u.sheet||null,
      clock:X.navClock()||null,file:window.NOTEFILES?NOTEFILES.navState():null,scroll:m?m.scrollTop:0};
  }
  function tag(i){return{zdNav:token,step:i};}
  function start(){
    var X=app();if(!X||!X.ME)return;user=X.ME;token=X.uid();
    entries=[take()];index=0;pending=null;returning=false;
    try{history.replaceState(tag(0),'');}catch(e){stop();}
  }
  function stop(){token=null;user=null;entries=[];pending=null;returning=false;}
  function write(){
    if(!active()||restoring||pending)return;
    var before=entries[index],after=take(),wantBack=returning;returning=false;
    if(key(before)===key(after)){entries[index]=after;return;}
    var close=depth(after)<depth(before)&&viewKey(after)===viewKey(before);
    try{
      if(close||wantBack){
        for(var i=index-1;i>=0;i--){
          if(key(entries[i])!==key(after))continue;
          pending={step:i};entries[i]=after;history.go(i-index);return;
        }
        if(close){entries[index]=after;history.replaceState(tag(index),'');return;}
      }
      history.pushState(tag(index+1),'');
      entries.length=index+1;entries.push(after);index++;
    }catch(e){pending=null;}
  }
  function sync(){
    if(!active()||restoring||queued)return;queued=true;
    queueMicrotask(function(){queued=false;write();});
  }
  // Android's Capacitor listener intercepts system Back before Chromium sees it.
  // true: handled, false: app root, null: use the legacy native fallback.
  function back(){
    if(!active())return null;
    if(pending||restoring)return true;
    if(queued)write();
    if(pending)return true;
    var current=history.state;
    if(!current||current.zdNav!==token||current.step!==index)return null;
    if(index<1)return false;
    try{pending={step:index-1,restore:true};history.back();return true;}
    catch(e){pending=null;return null;}
  }
  function restore(s){
    var X=app(),u=X.UI;
    restoring=true;
    try{
      if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
      if(u.sheet&&u.sheet!==s.sheet&&u.sheet.type==='task-edit')X.saveDraft();
      if(u.noteId&&u.noteId!==s.note)X.closeNote();
      u.view=s.view;
      u.filter=s.filter==='all'||X.D.lists.some(function(l){return l.id===s.filter;})?s.filter:'all';
      if(s.calendar){u.cal=s.calendar[0];u.calDay=s.calendar[1];}
      if((s.view==='food'||s.view==='fit')&&window.HEALTH)HEALTH.restoreNav(s.tabs);
      if(s.view==='well'&&window.WELL)WELL.restoreNav(s.tabs);
      if(s.view==='growth'&&window.GROWTH)GROWTH.restoreNav(s.tabs);
      if(s.view==='assistant'&&window.CYCLE)CYCLE.restoreNav(s.chat);
      u.sel=s.sel&&X.D.tasks.some(function(t){return t.id===s.sel;})?s.sel:null;
      u.noteId=s.note&&X.D.notes.some(function(n){return n.id===s.note;})?s.note:null;
      u.sheet=s.sheet;
      if(u.sheet&&u.sheet.id){
        var sh=u.sheet;
        if(['task','task-edit','move','send'].includes(sh.type)&&!X.D.tasks.some(function(t){return t.id===sh.id;}))u.sheet=null;
        if(['habit','habit-edit'].includes(sh.type)&&!X.D.habits.some(function(h){return h.id===sh.id;}))u.sheet=null;
        if(sh.type==='note-share'&&!u.noteId)u.sheet=null;
      }
      X.renderNote();X.render();X.renderSheet();
      X.restoreClock(u.sheet?s.clock:null);
      if(window.NOTEFILES)NOTEFILES.restoreNav(u.noteId?s.file:null);
      var m=main();if(m)m.scrollTop=s.scroll||0;
    }finally{restoring=false;}
  }
  window.addEventListener('popstate',function(e){
    var t=e.state;if(!active()||!t||t.zdNav!==token||!entries[t.step])return;
    var ownClose=pending&&pending.step===t.step&&!pending.restore;pending=null;index=t.step;
    if(!ownClose){restore(entries[index]);entries[index]=take();}
    else sync();
  });
  document.addEventListener('scroll',function(e){
    if(!active()||restoring||pending||e.target!==main())return;
    var s=entries[index];if(s&&s.view===app().UI.view)s.scroll=e.target.scrollTop;
  },true);
  window.SITENAV={start:start,stop:stop,sync:sync,back:back,returning:function(){if(active()){returning=true;sync();}}};
})();
