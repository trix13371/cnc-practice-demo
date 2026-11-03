(function(root){
  'use strict';
  const model=root.CNCDiscoveryPractice;
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  function art(scene,q){
    if(scene==='stopping')return '<rect x="70" y="75" width="65" height="160" rx="8" fill="#688297"/><rect x="135" y="115" width="165" height="80" fill="#c2d2df" stroke="#8198ac" stroke-width="2"/><path d="M60 155H310" stroke="#8198ac" stroke-dasharray="6 7"/><circle cx="420" cy="120" r="34" fill="'+(q.stage==='Вращение остановлено'?'#eaf6ef':'#fff4e5')+'" stroke="'+(q.stage==='Вращение остановлено'?'#176b4d':'#a76514')+'" stroke-width="3"/>'+(q.stage==='Вращение остановлено'?'<path d="m405 120 10 10 22-24" fill="none" stroke="#176b4d" stroke-width="4"/>':'<path d="M413 103v34m14-34v34" stroke="#a76514" stroke-width="4"/>')+'<text x="330" y="190">Состояние указано</text><text x="330" y="224">над схемой</text>';
    if(scene==='operations')return '<path d="M100 80H390V122H430V80H510V260H100Z" fill="#c2d2df" stroke="#8198ac" stroke-width="3"/><path d="M100 150H510V205H100" fill="#f7f9fc" stroke="#8198ac" stroke-width="3"/><path d="M75 177H540" stroke="#a6b7c7" stroke-dasharray="6 7"/><path d="M100 80H390v42h40V80h80M100 150H510" fill="none" stroke="#255beb" stroke-width="4"/>';
    if(scene==='diameter')return '<circle cx="200" cy="180" r="100" fill="#d5e2ec" stroke="#8198ac" stroke-width="2"/><path d="M100 180H300M200 180V80" stroke="#255beb" stroke-width="3"/><circle cx="200" cy="180" r="4" fill="#294d6c"/><path d="M100 170v20m200-20v20m-110-110h20" stroke="#255beb" stroke-width="2"/><text x="350" y="120">Два края</text><text x="350" y="151">или центр и край?</text><text x="350" y="214">Ø — диаметр</text>';
    if(scene==='layers')return '<circle cx="180" cy="165" r="110" fill="#f3d4a3" stroke="#ba965a" stroke-width="2"/><circle cx="180" cy="165" r="'+(110*(q.target??(q.stock-2*q.layer))/q.stock)+'" fill="#c2d2df" stroke="#8198ac" stroke-width="2"/><circle cx="180" cy="165" r="4" fill="#294d6c"/><text x="330" y="105">Было Ø'+q.stock+' мм</text><text x="330" y="155">Стало '+(q.target?'Ø'+q.target+' мм':'? мм')+'</text><text x="330" y="205">Слой: '+(q.layer??'?')+' мм</text><text x="330" y="242">на радиус</text>';
    if(scene==='tolerance')return '<path d="M60 145H540" stroke="#8198ac" stroke-width="3"/><path d="M195 145H405" stroke="#88c2a7" stroke-width="14"/><path d="M90 130v30m105-30v30m105-30v30m105-30v30m105-30v30" stroke="#416381" stroke-width="2"/><text x="145" y="80">Разрешено: от 9 до 11 мм</text><text x="193" y="270">Обе границы включены</text>';
    if(scene==='decimal-band')return '<text x="174" y="75">Требование: Ø28 ±0,1 мм</text><path d="M100 150H500" stroke="#88c2a7" stroke-width="12"/><path d="M100 130v40m200-40v40m200-40v40" stroke="#416381" stroke-width="2"/><text x="74" y="210">27,9</text><text x="284" y="210">28</text><text x="490" y="210">?</text><text x="70" y="266">Ниже середины</text><text x="364" y="266">Выше середины</text>';
    if(scene==='feed-count'||scene==='feed-path'){
      const width=480/q.turns,blocks=Array.from({length:q.turns},(_,i)=>'<rect x="'+(60+i*width)+'" y="114" width="'+(width-4)+'" height="60" rx="4" fill="#d8e5fb" stroke="#7c9bc9" stroke-width="2"/>').join('');
      return '<text x="92" y="70">'+q.turns+(q.turns===10?' оборотов · по ':' оборота · по ')+String(q.stepSize).replace('.',',')+' мм за оборот</text>'+blocks+'<text x="162" y="216">Общий путь: ? мм</text>';
    }
    if(scene==='machine')return '<path d="M35 193H470" stroke="#b6c5d3" stroke-dasharray="7 7"/><rect x="55" y="128" width="80" height="125" rx="8" fill="#688297"/><rect x="125" y="143" width="25" height="28" fill="#aabcc9"/><rect x="125" y="214" width="25" height="28" fill="#aabcc9"/><rect x="150" y="160" width="305" height="65" fill="#c2d2df" stroke="#8ca1b3" stroke-width="2"/><path d="M282 35h36v65l-18 26-18-26z" fill="#416381" stroke="#294d6c" stroke-width="2"/>';
    const part='<rect x="45" y="106" width="35" height="136" rx="6" fill="#688297"/><path d="M80 118H220V125H520V223H220V230H80Z" fill="#c2d2df" stroke="#8198ac" stroke-width="2"/><ellipse cx="520" cy="174" rx="14" ry="49" fill="#e3ebf2" stroke="#8198ac" stroke-width="2"/><path d="M70 174H545" stroke="#8aa0b4" stroke-dasharray="6 7"/><text x="110" y="89">Ø32</text><text x="334" y="89">Ø28</text>';
    if(scene==='surfaces')return part;
    if(scene==='measurement')return part+'<g stroke="#255beb" stroke-width="2" stroke-dasharray="5 5"><path d="M250 111V237M370 111V237M490 111V237"/></g>';
    return '<rect x="30" y="166" width="45" height="110" rx="6" fill="#688297"/><rect x="75" y="180" width="165" height="80" fill="#c2d2df" stroke="#8198ac" stroke-width="2"/><path d="M30 220H565" stroke="#8aa0b4" stroke-dasharray="6 7"/><text x="84" y="293">Ось заготовки</text><g fill="none" stroke="#255beb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M400 130V45m-9 10 9-10 9 10M400 130V215m-9-10 9 10 9-10M400 130H280m10-9-10 9 10 9M400 130H520m-10-9 10 9-10 9"/></g><circle cx="400" cy="130" r="6" fill="#255beb"/>';
  }
  function create(id,onReady,{saved,onChange=()=>{}}={}){
    let state=model.restore(saved,id)||model.create(id),notified=false,notice='';
    const host=node('section',undefined,'discovery-practice');
    function save(){onChange(model.snapshot(state));}
    function run(action){try{notice='';state=model.transition(state,action);save();render(action.type==='next'?'title':'feedback');if(state.complete&&!notified){notified=true;onReady();}}catch(e){notice=e.message;render('feedback');}}
    function render(focus){
      const q=model.current(state),scene=model.scenes[q.scene],solved=state.step+(state.last?.correct?1:0),checked=state.last?.choice===state.selection;
      host.replaceChildren();
      const progress=node('p',`Практика на схеме · действие ${state.step+1} из ${model.questions[id].length}`,'scene-progress');
      const title=node('h4',q.title,'scene-title');title.id='scene-question-'+id;title.tabIndex=-1;
      const numeric=q.kind==='number',actions=q.layout==='actions';
      const copy=node('p',q.copy,'scene-copy'),instruction=node('p',numeric?'Рассчитайте величину и введите ответ.':actions?'Выберите следующее действие, затем проверьте его.':'Нажмите на область или стрелку, затем проверьте выбор.','scene-instruction');instruction.append(node('span',' Можно пользоваться Tab и Enter.','scene-keyboard'));
      const board=node('div',undefined,'practice-scene');board.dataset.scene=q.scene;board.setAttribute('role','group');board.setAttribute('aria-label',scene.label);
      board.innerHTML='<svg viewBox="0 0 600 320" aria-hidden="true" focusable="false">'+art(q.scene,q)+'</svg>';
      const choices=node('div',undefined,'scene-options');choices.setAttribute('role','group');choices.setAttribute('aria-label','Следующее действие');
      let selectedButton;
      for(const c of scene.choices){
        const b=node('button',undefined,actions?'scene-option':'scene-hotspot');b.type='button';b.dataset.choice=c.id;b.setAttribute('aria-label',c.name);b.setAttribute('aria-pressed',String(state.selection===c.id));
        if(!actions){b.style.left=c.x/6+'%';b.style.top=c.y/3.2+'%';b.style.width=c.w/6+'%';b.style.height=c.h/3.2+'%';}
        b.append(node('span',c.label,actions?'':'scene-label'));b.disabled=!!state.last?.correct;
        if(checked&&c.id===state.selection)b.dataset.result=state.last.correct?'correct':'incorrect';
        if(c.id===state.selection)selectedButton=b;
        b.addEventListener('click',()=>{state=model.select(state,c.id);notice='';save();render('selection');});(actions?choices:board).append(b);
      }
      const caption=node('p',scene.caption,'scene-caption'),toolbar=node('div',undefined,'scene-actions'),feedback=node('div',undefined,'scene-feedback');feedback.setAttribute('role','status');feedback.tabIndex=-1;
      const check=node('button',numeric?'Проверить расчёт':checked&&!state.last.correct?'Выберите другой вариант':'Проверить выбор','button primary');check.type='button';check.disabled=!model.answerable(state)||checked;check.addEventListener('click',()=>run({type:'answer',choice:state.selection}));
      const hint=node('button',state.hints.includes(state.step)?'Подсказка открыта':'Нужна подсказка','button secondary');hint.type='button';hint.disabled=state.hints.includes(state.step)||!!state.last?.correct;hint.addEventListener('click',()=>run({type:'hint'}));
      if(!state.last?.correct)toolbar.append(check,hint);
      if(notice){feedback.dataset.result='incorrect';feedback.append(node('strong','Не удалось продолжить'),node('p',notice));}
      else if(checked){
        feedback.dataset.result=state.last.correct?'correct':'incorrect';feedback.append(node('strong',state.last.correct?'Верно':numeric?'Пока расчёт не совпал':actions?'Проверьте порядок действий':id==='axes'?'Пока не то направление':'Пока не та область'),node('p',state.last.correct?q.success.replace(/^Верно: /,''):model.wrongFeedback(q,state.selection)));
        if(!state.last.correct)feedback.append(node('p',numeric?'Проверьте, какую величину требуется найти, и попробуйте ещё раз.':'Сопоставьте выбранный вариант с условием и попробуйте ещё раз.'));
      }else feedback.append(node('p',numeric?'Введите число. Запятая и точка равнозначны.':state.selection?'Выбор сделан. Теперь проверьте его.':actions?'Действие пока не выбрано.':'Область пока не выбрана.'));
      host.append(progress,title);
      if(q.learn){const learn=node('aside',undefined,'scene-lesson');learn.append(node('strong','Перед действием'),node('p',q.learn));host.append(learn);}
      host.append(copy,instruction);
      if(q.stage)host.append(node('p',q.stage,'scene-state'));
      host.append(board,caption);if(actions)host.append(choices);
      if(numeric){
        const form=node('form',undefined,'scene-number-form'),label=node('label',`Ваш расчёт, ${q.unit}`,'field'),input=node('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=32;input.value=state.selection??'';input.disabled=!!state.last?.correct;input.id='scene-number-'+id;label.setAttribute('for',input.id);label.append(input);form.append(label,toolbar);
        input.addEventListener('input',()=>{state=model.select(state,input.value);notice='';save();check.disabled=!model.answerable(state)||state.last?.choice===state.selection;feedback.removeAttribute('data-result');feedback.textContent=model.answerable(state)?'Число введено. Проверьте расчёт.':'Введите одно число, например 1,5. Без единиц и выражений.';});
        form.addEventListener('submit',e=>{e.preventDefault();if(!check.disabled)run({type:'answer',choice:state.selection});});host.append(form);
      }else host.append(toolbar);
      host.append(feedback);
      if(state.hints.includes(state.step))host.append(node('p',q.hint,'scene-hint'));
      if(state.last?.correct&&!state.complete){const next=node('button','Следующее действие','button primary');next.type='button';next.addEventListener('click',()=>run({type:'next'}));host.append(next);}
      if(state.complete){
        host.append(node('p',`Выполнено ${solved} из ${model.questions[id].length} действий. Теперь можно перейти к самостоятельной проверке урока.`,'scene-complete'));
      }
      if(state.complete||notice){const again=node('button','Повторить практику','button secondary');again.type='button';again.addEventListener('click',()=>{state=model.create(id);notice='';save();render('title');});host.append(again);}
      if(focus==='title')title.focus();else if(focus==='selection')selectedButton?.focus({preventScroll:true});else if(focus==='feedback')feedback.focus();
    }
    render();if(state.complete){notified=true;onReady();}return host;
  }
  root.CNCDiscoveryPracticeUI={create};
})(typeof window!=='undefined'?window:globalThis);
