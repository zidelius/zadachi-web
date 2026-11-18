/* Wrapping for labels and titles, with native form and keyboard semantics. */
(function(){
  'use strict';
  var area='textarea[data-grow],textarea.fld';
  function escape(s){return String(s==null?'':s).replace(/[&<>"']/g,function(x){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  function line(attrs,value){
    var text=String(value==null?'':value).replace(/[\r\n]+/g,' ');
    return '<textarea rows="1" data-grow data-line enterkeyhint="done" '+attrs+'>'+escape(text)+'</textarea>';
  }
  function smart(attrs,value){
    return /\b(?:type|inputmode)\s*=/.test(attrs)?'<input '+attrs+' value="'+escape(value)+'">':line(attrs,value);
  }
  function fit(e){
    if(!e||!e.matches||!e.matches(area))return;
    e.style.height='0px';
    var h=e.scrollHeight;
    if(!h){e.style.height='';return;}
    var style=getComputedStyle(e);
    e.style.height=(h+(parseFloat(style.borderTopWidth)||0)+(parseFloat(style.borderBottomWidth)||0))+'px';
  }
  var meter;
  function fitSelect(el){
    if(!el.clientWidth)return;
    var option=el.options[el.selectedIndex],text=option?option.text:'';
    var style=getComputedStyle(el),box=el.nextElementSibling;
    if(!box||!box.classList.contains('field-full-value'))box=null;
    if(!meter){
      meter=document.createElement('span');meter.setAttribute('aria-hidden','true');
      meter.style.cssText='position:fixed;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none';
      document.body.appendChild(meter);
    }
    meter.style.font=style.font;meter.style.letterSpacing=style.letterSpacing;meter.textContent=text;
    var free=el.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)-20;
    var clipped=!!text&&meter.getBoundingClientRect().width>free;
    if(clipped&&!box){
      box=document.createElement('span');box.className='field-full-value';box.setAttribute('aria-hidden','true');
      el.insertAdjacentElement('afterend',box);
    }
    if(box){box.hidden=!clipped;box.textContent=clipped?text:'';}
  }
  function fitAll(root){
    (root||document).querySelectorAll(area).forEach(fit);
    (root||document).querySelectorAll('label select.fld').forEach(fitSelect);
  }
  document.addEventListener('input',function(ev){
    var e=ev.target;if(!e.matches||!e.matches(area))return;
    if(e.hasAttribute('data-line')&&!ev.isComposing&&/[\r\n]/.test(e.value)){
      var v=e.value,p=e.selectionStart;
      e.value=v.replace(/[\r\n]+/g,' ');
      var pos=v.slice(0,p).replace(/[\r\n]+/g,' ').length;
      try{e.setSelectionRange(pos,pos);}catch(x){}
    }
    fit(e);
  },true);
  document.addEventListener('keydown',function(ev){
    var e=ev.target;
    if(ev.key!=='Enter'||ev.isComposing||ev.keyCode===229||!e.matches||!e.matches('textarea[data-line]'))return;
    ev.preventDefault();
    if(!e.form){if(e.id==='nt'){var body=document.getElementById('nb');if(body)body.focus();else e.blur();}else e.blur();return;}
    if(ev.repeat)return;
    var button=e.form.querySelector('[type="submit"]:not([disabled])');
    if(button)button.click();else if(e.form.requestSubmit)e.form.requestSubmit();
    else e.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  },true);
  document.addEventListener('change',function(ev){
    if(ev.target.matches&&ev.target.matches('label select.fld'))fitSelect(ev.target);
  },true);
  var resize=0;
  window.addEventListener('resize',function(){if(resize)cancelAnimationFrame(resize);resize=requestAnimationFrame(function(){resize=0;fitAll();});});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){fitAll();});
  window.FORMUI={line:line,smart:smart,fit:fit,fitAll:fitAll};
})();
