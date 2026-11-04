(function(root){
  'use strict';
  const model=root.CNCDrawingSession;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const mm=n=>(n/1000).toFixed(2).replace('.',',');
  const explanations=[
    'У ступенчатой детали есть цилиндрические участки и плоский торец. Выберите каждую из трёх поверхностей: подсветка свяжет название с формой.',
    'Знак Ø означает диаметр: размер поперёк оси. Размер без Ø под деталью показывает длину участка вдоль оси. Выберите оба размера и проследите подсветку.',
    'Другая деталь развёрнута в другую сторону. Выберите размер диаметра, затем область, к которой он относится. Буквы обозначают поверхности, а не числа.',
    'Перед измерением проверяют чистоту и состояние прибора и поверхностей. В этой сцене они подготовлены. Сомкните пустые наружные губки, прочитайте дисплей и установите ноль. Детали между губками нет.',
    'Измерьте диаметр тонкого цилиндрического участка. Выберите поверхность и подходящие губки, сведите их до контакта и запишите показание. Вращение отсутствует; деталь находится на измерительном столе.',
    'Ø28 ±0,20 мм: номинал 28,00; нижнее отклонение −0,20; верхнее +0,20. Получаем 27,80 и 28,20 мм. Введите границы. Затем сравните с ними весь заданный интервал измерения.',
    'Теперь другая деталь, без готового показания. Снова измерьте тонкий цилиндрический участок и запишите результат. Проверенный ноль прибора сохранён.',
    'Требование: Ø30 мм, верхнее отклонение +0,20; нижнее −0,10. Новое показание 30,19 мм. Рассчитайте границы и решите, достаточно ли такого измерения для подтверждения соответствия.',
    'То же требование: Ø30 мм, верхнее отклонение +0,20; нижнее −0,10. Ещё одно показание: 30,26 мм. Сопоставьте весь интервал измерения с границами.'
  ];
  const hints={2:'Найдите знак Ø. Цилиндрическая поверхность проходит вдоль оси, а торец закрывает деталь с конца.',6:'Наружный размер измеряют наружными губками. Число можно записывать только после контакта с нужной поверхностью.',7:'Нижнюю границу получают, прибавляя нижнее отклонение к 30. К показанию отдельно прибавьте и вычтите 0,03: сравните оба конца интервала с допуском.',8:'Сравните меньший конец интервала измерения с верхней границей допуска. Если весь интервал выше, погрешность уже не объясняет превышение.'};
  function partArt(s,check=false){
    const active=s.surface,diameter=s.dimension==='diameter',length=s.dimension==='length';
    const color=part=>active===part?'#2458ee':'#a9becd';
    // Curated geometry only; no saved/user text is inserted into SVG markup.
    const drawing='<path d="M110 95H270V125H505V225H270V255H110Z" fill="#edf3f8" stroke="#43657c" stroke-width="2"/>'+
      '<path d="M110 95H270V255H110Z" fill="'+color('large')+'" fill-opacity=".65"/><path d="M270 125H505V225H270Z" fill="'+(diameter?'#c4d5ff':color('small'))+'" fill-opacity=".8"/>'+
      '<path d="M505 125V225" stroke="'+(active==='face'?'#2458ee':'#43657c')+'" stroke-width="'+(active==='face'?9:3)+'"/><path d="M70 175H550" stroke="#7e95a6" stroke-dasharray="7 5"/>'+
      '<path d="M505 125H568M505 225H568M550 125V225m-5-91 5-9 5 9m-10 82 5 9 5-9" fill="none" stroke="'+(diameter?'#2458ee':'#43657c')+'" stroke-width="2"/>'+
      '<path d="M270 237V298M505 237V298M270 282H505m-226-5-9 5 9 5m217-10 9 5-9 5" fill="none" stroke="'+(length?'#2458ee':'#43657c')+'" stroke-width="2"/>';
    const labels=check?'<text x="106" y="166">A</text><text x="281" y="112">B</text><text x="394" y="86">C</text><path d="M120 170H135M290 117L250 142M395 94L370 124" stroke="#43657c"/>':'<text x="102" y="76">Большой участок</text><text x="304" y="106">Тонкий участок</text>';
    // Mirrored profile: small cylinder is on the left, A is the left face, C the shoulder.
    return '<svg viewBox="0 0 660 340" aria-hidden="true">'+(check?'<g transform="translate(640 0) scale(-1 1)">'+drawing+'</g>':drawing)+labels+
      '<text x="'+(check?42:573)+'" y="182" class="drawing-dimension">Ø'+(check?'24':'28')+'</text><text x="'+(check?245:365)+'" y="322" class="drawing-dimension">'+(check?'18':'30')+' мм</text></svg>';
  }
  function gaugeArt(s){
    const empty=s.step===3,gap=Math.round(s.gap/1000*5),right=165+gap,contact=s.contact;
    return '<svg viewBox="0 0 660 285" aria-hidden="true"><rect x="90" y="82" width="500" height="30" rx="4" fill="#aabfcf"/><path d="M110 82V51H135V82M'+right+' 82V51H'+(right+25)+'V82" fill="#647f94"/>'+
      '<path d="M110 104V240H165V216H140V104Z" fill="#52728a"/><path d="M'+right+' 104V216H'+(right-25)+'V240H'+(right+30)+'V104Z" fill="#52728a"/>'+
      (!empty?'<rect x="165" y="154" width="'+(contact?Math.max(10,gap):150)+'" height="62" rx="3" fill="#d6e2eb" stroke="#8aa3b5"/>':'')+
      '<rect x="'+(right-2)+'" y="72" width="126" height="62" rx="7" fill="#203f57"/><rect x="'+(right+9)+'" y="82" width="104" height="33" rx="3" fill="#e8f1dd"/><text x="'+(right+16)+'" y="106" class="drawing-display">'+(s.reading===null?'— —':mm(s.reading))+'</text>'+
      '<text x="95" y="30">Внутренние губки</text><text x="95" y="273">Наружные губки</text></svg>';
  }
  function create({headingTag='h3',saved,savedDraft,onDraft=()=>{},onChange=()=>{},onDone=()=>{},onNext}={}){
    let state=model.restore(saved)||model.create(),draft=model.validDraft(savedDraft,state)?{...savedDraft.values}:{},notice='';
    const host=el('section',undefined,'start-session drawing-session');
    function persist(){if(onChange(model.snapshot(state))===false)notice='Не удалось сохранить. Не закрывайте страницу: действия пока находятся в памяти.';}
    function run(action,focus){try{state=model.transition(state,action);if(action.type==='next'||state.correct)draft={};notice='';persist();render(action.type==='next'?'title':focus||'status');}catch(error){notice=error.message;render('status');}}
    function button(text,action,selected=false){const b=el('button',text,'button secondary');b.type='button';if(selected)b.setAttribute('aria-pressed','true');b.addEventListener('click',()=>run(action));return b;}
    function field(label,name,form){const wrap=el('label',label,'field'),input=el('input');input.type='text';input.inputMode='decimal';input.maxLength=32;input.autocomplete='off';input.value=draft[name]||'';input.disabled=state.correct;input.setAttribute('aria-label',label);input.addEventListener('input',()=>{draft[name]=input.value;try{if(onDraft({step:state.step,values:{...draft}})===false)throw Error('Не удалось сохранить черновик. Не закрывайте страницу.');}catch(error){notice=error.message;host.querySelector('[role="status"]').textContent=notice;}});wrap.append(input);form.append(wrap);return input;}
    function board(svg,caption){const figure=el('figure',undefined,'start-board drawing-board');figure.innerHTML=svg;figure.append(el('figcaption',caption));host.append(figure);}
    function render(focus){
      host.replaceChildren();const i=state.step,c=model.caseForStep(i),title=el(headingTag,state.complete?'Деталь и измерение — завершено':model.steps[i].title);title.tabIndex=-1;
      host.append(el('p','ДЕТАЛЬ И ИЗМЕРЕНИЕ · '+(state.complete?'ИТОГ':'ДЕЙСТВИЕ '+(i+1)+' ИЗ '+model.steps.length),'eyebrow'),title);
      if(state.complete){
        host.append(el('p','Вы связали размер с поверхностью, проверили ноль, получили показания на двух деталях и сравнили интервал измерения с допуском.'),el('p','Ошибочных действий: '+state.errors.reduce((a,b)=>a+b,0)+'. Подсказки: '+(state.assisted?'открывались':'не открывались')+'.','start-value'),el('p','Это выполненное учебное упражнение. Реальные измерения требуют инструкции прибора, подходящего метода и практики с преподавателем.','start-note'));
        const done=el('button','Продолжить курс','button primary');done.type='button';done.addEventListener('click',onDone);host.append(done);if(onNext){const b=el('button','Далее: координаты и первый процесс','button primary');b.type='button';b.addEventListener('click',onNext);host.append(b);}if(notice)host.append(el('p',notice));if(focus)title.focus();return;
      }
      host.append(el('p',explanations[i]));const controls=el('div',undefined,'start-controls');
      if(i<=2){
        board(partArt(state,i===2),i===2?'Учебная схема другой детали. Буквы отмечают поверхности. Все размеры в миллиметрах.':'Учебная схема детали. Синим выделен выбранный элемент. Схема объясняет размер и не заменяет полный рабочий чертёж.');
        if(i===0){for(const [surface,label]of [['large','Большая цилиндрическая'],['small','Малая цилиндрическая'],['face','Торец']]){const b=button(label,{type:'inspect',surface},state.surface===surface);b.setAttribute('aria-pressed',String(state.surface===surface));controls.append(b);}host.append(el('p','Осмотрено поверхностей: '+state.seen.length+' из 3','start-value'));}
        else{for(const [value,label]of [['diameter','Ø'+(i===2?'24':'28')+' — диаметр'],['length',(i===2?'18':'30')+' мм — длина']]){const b=button(label,{type:'dimension',value},state.dimension===value);b.disabled=state.correct;b.setAttribute('aria-pressed',String(state.dimension===value));controls.append(b);}if(i===2){const row=el('div',undefined,'start-controls');for(const value of ['A','B','C']){const b=button('Область '+value,{type:'answer',value});b.disabled=state.correct;row.append(b);}host.append(controls,el('p','К какой области относится выбранный диаметр?'),row);}}
      }
      if([3,4,6].includes(i)){
        if(i!==3){const row=el('div',undefined,'start-controls');for(const [surface,label]of [['large','Большой участок'],['small','Тонкий участок'],['face','Торец']]){const b=button(label,{type:'inspect',surface},state.surface===surface);b.disabled=state.correct;b.setAttribute('aria-pressed',String(state.surface===surface));row.append(b);}host.append(row);for(const [value,label]of [['outside','Наружные губки'],['inside','Внутренние губки']]){const b=button(label,{type:'mode',value},state.mode===value);b.disabled=state.correct;b.setAttribute('aria-pressed',String(state.mode===value));controls.append(b);}}
        board(gaugeArt(state),i===3?'Пустые губки. Деталь отсутствует. Условная схема цифрового прибора.':'Деталь на столе, без вращения. Выбранная поверхность: '+({large:'большой участок',small:'тонкий участок',face:'торец'}[state.surface]||'пока не выбрана')+'. Схема установки упрощена.');
        const reading=el('output',state.reading===null?'Нет замера':mm(state.reading)+' мм','drawing-reading');reading.setAttribute('aria-label','Показание прибора');host.append(reading,el('p',state.contact?'Контакт установлен':'Губки не установлены на измеряемой поверхности','start-note'));
        for(const [type,text]of [['close','Свести до контакта'],['open','Развести губки']]){const b=button(text,{type});b.disabled=state.correct;controls.append(b);}
        if(i===3){const b=button('Установить ноль',{type:'zero'});b.disabled=state.gap!==0||!state.contact||state.correct;controls.append(b);}else{
          const form=el('form',undefined,'start-answer');field('Запишите показание, мм','reading',form);const b=el('button','Записать замер','button primary');b.type='submit';b.disabled=state.correct||!state.contact;form.append(b);form.addEventListener('submit',e=>{e.preventDefault();run({type:'record',value:draft.reading||''});});host.append(controls,form);}
      }
      if([5,7,8].includes(i)){
        const interval=model.classifyMeasurement(c.reading,model.gauge.error,c.lower,c.upper);
        const info=el('div',undefined,'drawing-measurement');info.append(el('span','Показание: '+mm(c.reading)+' мм'),el('strong','Заданный интервал: '+mm(interval.low)+'…'+mm(interval.high)+' мм'),el('p','Общая граница погрешности ±0,03 мм уже включает округление отсчёта. В этом упражнении соответствие подтверждаем только если весь интервал внутри допуска. Пересечение границы требует более точного измерения.','start-note'));host.append(info);
        const form=el('form',undefined,'start-answer');field('Нижняя граница, мм','lower',form);field('Верхняя граница, мм','upper',form);const b=el('button','Проверить границы','button secondary');b.type='submit';b.disabled=state.correct;form.append(b);form.addEventListener('submit',e=>{e.preventDefault();run({type:'bounds',lower:draft.lower||'',upper:draft.upper||''});});host.append(form);
        for(const [value,label]of [['accept','Соответствие подтверждено'],['uncertain','Нужно уточнить измерение'],['reject','Несоответствие подтверждено']]){const b=button(label,{type:'verdict',value});b.disabled=!state.boundsOk||state.correct;controls.append(b);}
      }
      if(!controls.parentNode)host.append(controls);
      const status=el('div',undefined,'start-feedback');status.setAttribute('role','status');status.tabIndex=-1;if(notice)status.append(el('p',notice));if(state.feedback)status.append(el('p',state.feedback));host.append(status);
      if(hints[i]&&!state.correct){const b=button(state.hints.includes(i)?'Подсказка открыта':'Нужна подсказка',{type:'hint'});b.disabled=state.hints.includes(i);host.append(b);}if(state.hints.includes(i))host.append(el('p',hints[i],'start-hint'));
      const ready=i===0?state.seen.length===3:i===1?state.seen.length===2:state.correct,next=button(i===8?'Завершить занятие':'Далее',{type:'next'});next.className='button primary';next.disabled=!ready;host.append(next);
      const scope=el('details',undefined,'course-reading');scope.append(el('summary','Условия прибора и границы модели'),el('p',model.gauge.note.replace('Все величины модели — в мкм. ','')+' Диапазон 0–150 мм. Схема не моделирует усилие прижатия, температуру, перекос и повреждения. На реальном приборе их учитывают отдельно.'));host.append(scope);root.CNCNormativeUI?.appendLesson(host,i>=5?'tolerance':'control');
      if(focus==='title')title.focus();else if(focus==='status')status.focus({preventScroll:true});
    }
    render();return host;
  }
  root.CNCDrawingSessionUI=Object.freeze({create});
})(window);
