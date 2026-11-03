(function(root){
  'use strict';
  const model=root.CNCStartSession;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,run,cls='button secondary')=>{const b=el('button',text,cls);b.type='button';b.dataset.startControl=text;b.addEventListener('click',run);return b;};
  const decimal=n=>(n/100).toFixed(2).replace('.',','),motionLabel={running:'Вращается',coasting:'Команда остановки подана · вращение ещё продолжается',stopped:'Вращение полностью остановлено'};
  const hints={2:'У резца есть отдельная режущая кромка. Найдите эту форму на новой схеме, не ориентируясь на букву из прошлого рисунка.',4:'Пока вращение продолжается, ручной прибор не подносят. В этой подготовленной сцене осталось дождаться остановки.',6:'Одна десятая — десять сотых. Сначала отложите две десятых, затем ещё четыре сотых.',8:'Вычислите, насколько уменьшился весь диаметр. Толщина слоя с одной стороны вдвое меньше этой разницы.'};
  const copy=[
    ['Начнём с предметов, без формул','Заготовка — исходный материал. Патрон удерживает её и передаёт вращение. Резец снимает слой своей кромкой. Нажмите на каждый узел и прочитайте его роль.'],
    ['Два разных движения','Включите вращение на схеме, переместите резец и остановите вращение. Это иллюстрация: резец движется над заготовкой и здесь ещё не режет металл.'],
    ['Та же конструкция, другой вид','На новой схеме патрон находится справа. Найдите режущий инструмент. Буквы и расположение отличаются от объяснения.'],
    ['Остановка занимает время','Команда остановки и полная остановка — разные состояния. В этой учебной сцене инструмент уже отведён и прочие условия доступа выполнены. Подайте остановку, дождитесь её и выполните ручной контроль.'],
    ['Теперь другая ситуация','Команда остановки уже подана, но вращение продолжается. Инструмент отведён; остальные условия доступа выполнены в рамках этой сцены. Выполните оставшееся действие и ручной контроль.'],
    ['Сначала понимаем число','Один миллиметр содержит 10 десятых или 100 сотых. 0,10 мм — десять сотых, 0,01 мм — одна сотая. Составьте 0,12 мм: одну десятую и две сотых.'],
    ['Составьте размер самостоятельно','На шкале от 0 до 1 мм установите две десятых и четыре сотых миллиметра. Затем запишите полученное число десятичной дробью. Длинные деления — десятые, короткие — сотые.'],
    ['Диаметр соединяет два края','Знак Ø обозначает диаметр. На схеме уменьшите Ø32 до Ø30. Диаметр изменится на 2 мм, а слой с одной стороны — на 1 мм: размер меняется с двух сторон. Это регулируемая схема, а не физическая обработка.'],
    ['Новые размеры без готового расчёта','На другой заготовке диаметр уменьшили с Ø36 до Ø32. Какова толщина снятого слоя с одной стороны? Все размеры в миллиметрах.']
  ];
  function machineArt(state,mirrored){
    const tx=275+state.tool*42,turning=state.motion!=='stopped';
    return '<svg viewBox="0 0 640 310" aria-hidden="true"><g'+(mirrored?' transform="translate(640 0) scale(-1 1)"':'')+'><path d="M55 190H550" stroke="#8b9eae" stroke-dasharray="6 6"/><rect x="75" y="117" width="78" height="146" rx="9" fill="#647c8f"/><path d="M135 135h30v30h-30m0 60h30v25h-30" fill="#a4b8c7"/><path d="M165 145H520V235H165Z" fill="#c9d8e3" stroke="#7c95a9" stroke-width="2"/><ellipse cx="520" cy="190" rx="15" ry="45" fill="#e7eef4" stroke="#7c95a9"/><path d="M'+tx+' 34h36v62l-18 24-18-24z" fill="#345b79"/><path d="M'+tx+' 96h36l-18 24z" fill="#e9b44b"/></g><g transform="translate(582 65)"><circle r="35" fill="#f1f6fb" stroke="#8b9eae"/><g class="'+(turning?'start-spinning':'')+'"><path d="M-23 0H23M0-23V23" stroke="#2458ee" stroke-width="3"/><circle cx="0" cy="-23" r="5" fill="#e9b44b"/></g></g><text x="535" y="120" fill="#426078" font-size="16">Вид с торца</text>'+(!mirrored?'<text x="92" y="286" font-size="20" fill="#345b79">A</text><text x="323" y="270" font-size="20" fill="#345b79">B</text><text x="'+(tx+9)+'" y="25" font-size="20" fill="#345b79">C</text>':'<text x="338" y="25" font-size="20" fill="#345b79">A</text><text x="520" y="286" font-size="20" fill="#345b79">B</text><text x="274" y="270" font-size="20" fill="#345b79">C</text>')+'</svg>';
  }
  function scaleArt(value){
    let ticks='';for(let i=0;i<=100;i++){const x=55+i*5.2;ticks+='<path d="M'+x+' 112v'+(i%10===0?36:16)+'" stroke="#607c92"/>';if(i%10===0)ticks+='<text x="'+x+'" y="183" text-anchor="middle" fill="#345b79" font-size="18">'+String(i/100).replace('.',',')+'</text>';}
    const x=55+value*5.2;
    return '<svg viewBox="0 0 640 235" aria-hidden="true"><text x="55" y="40" fill="#345b79" font-size="20">Шкала в миллиметрах</text><path d="M55 112H575" stroke="#607c92" stroke-width="2"/>'+ticks+'<path d="M'+x+' 65v40m-8-12 8 12 8-12" fill="none" stroke="#2458ee" stroke-width="4" stroke-linejoin="round"/></svg>';
  }
  function diameterArt(before,after){
    return '<svg viewBox="0 0 640 285" aria-hidden="true"><circle cx="185" cy="140" r="108" fill="#f4d49a" stroke="#b18c4c" stroke-width="2"/><circle cx="185" cy="140" r="'+108*after/before+'" fill="#c9d8e3" stroke="#607c92" stroke-width="2"/><path d="M77 140H293" stroke="#345b79" stroke-dasharray="5 6"/><circle cx="185" cy="140" r="4" fill="#345b79"/><text x="345" y="90" fill="#345b79" font-size="24">Было: Ø'+before+' мм</text><text x="345" y="140" fill="#345b79" font-size="24">Стало: Ø'+after+' мм</text><text x="345" y="200" fill="#785723" font-size="19">Жёлтое кольцо —</text><text x="345" y="227" fill="#785723" font-size="19">снятый слой</text></svg>';
  }
  function create({saved,savedDraft,onDraft=()=>true,onChange=()=>true,onDone=()=>{},onNext}={}){
    let state=model.restore(saved)||model.create(),notice='',draft=savedDraft?.step===state.step?String(savedDraft.value):'';
    const host=el('section',undefined,'start-session');
    function run(action){try{const keep=['scale','diameter','move'].includes(action.type)?document.activeElement:null,control=keep?.dataset?.startControl,range=keep?.type==='range';const next=model.transition(state,action);const saved=onChange(model.snapshot(next));state=next;notice=saved===false?'Сохранение недоступно. Не закрывайте страницу: действия пока находятся в памяти.':'';if(action.type==='next')draft='';render(action.type==='next'?'title':'feedback');if(control)[...host.querySelectorAll('button')].find(b=>b.dataset.startControl===control&&!b.disabled)?.focus({preventScroll:true});else if(range)host.querySelector('input[type="range"]')?.focus({preventScroll:true});}catch(error){notice=error.message;render('feedback');}}
    function render(focus){
      host.replaceChildren();host.dataset.startStep=String(state.step);
      if(state.complete){host.append(el('p','Первое знакомство завершено','start-kicker'),el('h3','Теперь можно перейти к первому уроку'),el('p','Вы разобрали узлы, два вида движения, ожидание остановки, десятичные доли и связь диаметра со слоем.'),el('p',state.assisted?'Во время проверки вы открывали помощь. Это нормально: самостоятельное применение проверим на следующих новых условиях.':'Проверочные действия выполнены без открытия подсказок. Это вводное знакомство, а не допуск к реальному станку.'),button('Продолжить курс',onDone,'button primary'));if(onNext)host.append(button('Далее: деталь и измерение',onNext,'button primary'));if(focus){const h=host.querySelector('h3');h.tabIndex=-1;h.focus();}return;}
      const step=state.step,check=[2,4,6,8].includes(step),title=el('h3',model.steps[step].title);title.tabIndex=-1;
      host.append(el('p','ПЕРВОЕ ЗНАКОМСТВО · '+(step+1)+' / '+model.steps.length,'start-kicker'),title);
      const meter=el('progress');meter.max=model.steps.length;meter.value=step;meter.setAttribute('aria-label','Действия вводного занятия');host.append(meter,el('p',copy[step][0],'start-lead'),el('p',copy[step][1]));
      const board=el('figure',undefined,'start-board');board.innerHTML=step<=4?machineArt(state,step===2):step<=6?scaleArt(state.scale):diameterArt(step===8?36:32,step===8?32:state.diameter);
      board.setAttribute('role','img');board.setAttribute('aria-label',step===2?'Другая компоновка: A — верхняя узкая деталь с кромкой; B — массивный узел справа; C — цилиндр посередине.':step<=4?'Патрон слева удерживает цилиндр; отдельный инструмент расположен над ним. Справа показана метка вращения.':step<=6?'Шкала от 0 до 1 мм: десять крупных промежутков, каждый разделён на десять сотых.':'Сечение: исходный наружный круг и оставшийся меньший круг. Размеры подписаны в условии.');board.append(el('figcaption','Учебная схема · не управление оборудованием'));host.append(board);if(step===3||step===4)host.append(el('p','Другие условия доступа заданы только для этой сцены. На реальном станке ручной контроль выполняют по полной инструкции оборудования.','start-note'));
      const controls=el('div',undefined,'start-controls');
      if(step===0){for(const [part,label]of [['chuck','A · Патрон'],['stock','B · Заготовка'],['tool','C · Резец']]){const b=button(label,()=>run({type:'inspect',part}));b.setAttribute('aria-pressed',String(state.seen.includes(part)));controls.append(b);}}
      if([1,3,4].includes(step)){
        host.append(el('p',motionLabel[state.motion],'start-motion'));
        if(step===1){const b=button('Включить вращение на схеме',()=>run({type:'rotate'}));b.disabled=state.motion!=='stopped';controls.append(b);}
        if(state.motion==='running')controls.append(button('Подать команду остановки',()=>run({type:'stop'})));
        if(state.motion==='coasting')controls.append(button('Дождаться полной остановки',()=>run({type:'wait'})));
        if(step===1){for(const [delta,label]of [[-1,'Сместить резец влево'],[1,'Сместить резец вправо']]){const b=button(label,()=>run({type:'move',delta}));b.disabled=state.tool+delta<0||state.tool+delta>3;controls.append(b);}}
        else{const b=button('Выполнить ручной контроль в этой сцене',()=>run({type:'measure'}));b.disabled=state.correct||state.measured;controls.append(b);}
      }
      if(step===2){for(const v of ['A','B','C']){const b=button('Область '+v,()=>run({type:'answer',value:v}));b.disabled=state.correct;controls.append(b);}}
      if(step===5||step===6){
        if(step===5)host.append(el('p','На шкале: '+decimal(state.scale)+' мм · '+state.scale+' сотых','start-value'));
        const label=el('label','Положение на шкале, в сотых миллиметра','field'),range=el('input');range.type='range';range.min='0';range.max='100';range.step='1';range.value=String(state.scale);range.disabled=state.correct&&step===6;range.setAttribute('aria-label','Положение на шкале, в сотых миллиметра');range.addEventListener('change',()=>run({type:'scale',value:Number(range.value)}));label.append(range);host.append(label);
        for(const [delta,text]of [[-10,'−0,10 мм'],[-1,'−0,01 мм'],[1,'+0,01 мм'],[10,'+0,10 мм']]){const b=button(text,()=>run({type:'scale',value:state.scale+delta}));b.disabled=state.scale+delta<0||state.scale+delta>100||step===6&&state.correct;controls.append(b);}
      }
      if(step===7){const label=el('label','Диаметр на схеме, мм','field'),range=el('input');range.type='range';range.min='28';range.max='32';range.step='1';range.value=String(state.diameter);range.setAttribute('aria-label','Диаметр на схеме, мм');range.addEventListener('change',()=>run({type:'diameter',value:Number(range.value)}));label.append(range);host.append(label);for(const d of [-1,1]){const b=button(d<0?'Уменьшить диаметр на 1 мм':'Увеличить диаметр на схеме на 1 мм',()=>run({type:'diameter',value:state.diameter+d}));b.disabled=state.diameter+d<28||state.diameter+d>32;controls.append(b);}host.append(el('p','Разница диаметров: '+(32-state.diameter)+' мм · слой с одной стороны: '+((32-state.diameter)/2).toLocaleString('ru-RU')+' мм','start-value'));}
      host.append(controls);
      if(step===6||step===8){
        const form=el('form',undefined,'start-answer'),label=el('label',step===6?'Число со шкалы, мм':'Толщина слоя с одной стороны, мм','field'),input=el('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=32;input.value=draft;input.disabled=state.correct;input.setAttribute('aria-label',step===6?'Число со шкалы, мм':'Толщина слоя с одной стороны, мм');input.addEventListener('input',()=>{draft=input.value;try{if(onDraft(draft)===false){notice='Сохранение недоступно. Не закрывайте страницу: черновик пока находится в памяти.';feedback.textContent=notice;}}catch(error){notice=error.message;feedback.textContent=notice;}});label.append(input);const submit=el('button','Проверить','button primary');submit.type='submit';submit.disabled=state.correct;form.append(label,submit);form.addEventListener('submit',e=>{e.preventDefault();run({type:'answer',value:draft});});host.append(form,el('p','Можно вводить запятую или точку. Без единиц и выражений.','start-note'));
      }
      const feedback=el('div',undefined,'start-feedback');feedback.setAttribute('role','status');feedback.tabIndex=-1;if(notice)feedback.append(el('p',notice));if(state.feedback)feedback.append(el('p',state.feedback));host.append(feedback);
      if(check&&!state.correct){const help=button(state.hints.includes(step)?'Подсказка открыта':'Нужна подсказка',()=>run({type:'hint'}));help.disabled=state.hints.includes(step);host.append(help);}
      if(state.hints.includes(step))host.append(el('p',hints[step],'start-hint'));
      const ready=step===0?state.seen.length===3:step===1?state.rotated&&state.moved&&state.motion==='stopped':step===3?state.measured&&state.motion==='stopped':state.correct;
      const next=button(step===8?'Завершить знакомство':'Далее',()=>run({type:'next'}),'button primary');next.disabled=!ready;host.append(next);root.CNCNormativeUI?.appendLesson(host,step===3||step===4?'safety':step>=5?'diameter':'machine');
      if(focus==='title')title.focus();else if(focus==='feedback')feedback.focus({preventScroll:true});
    }
    render();return host;
  }
  root.CNCStartSessionUI=Object.freeze({create});
})(window);
