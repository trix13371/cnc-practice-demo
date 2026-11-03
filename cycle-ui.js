(function(){
  'use strict';
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const fmt=(v,d=2)=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:d});
  const button=(text,run,primary=false)=>{const b=node('button',text,'button '+(primary?'primary':'secondary'));b.type='button';b.addEventListener('click',run);return b;};
  function field(label,name,value){const l=node('label',label,'field'),i=node('input');i.name=name;i.type='text';i.inputMode='decimal';i.autocomplete='off';i.maxLength=32;i.value=value;l.append(i);return l;}
  function select(label,name,options,value){const l=node('label',label,'field'),s=node('select');s.name=name;for(const [v,text]of options){const o=node('option',text);o.value=v;s.append(o);}s.value=value;l.append(s);return l;}
  function render(root,c){
    const {s,t,g,draft,learning}=c,assisted=!learning.independent,model=window.CNCTraining;
    root.dataset.cycle='true';
    const heading=node('header',undefined,'cycle-heading');heading.append(node('p',assisted?'ПОЛНЫЙ ЦИКЛ · С РАЗБОРОМ':'САМОСТОЯТЕЛЬНО · ДРУГОЕ УСЛОВИЕ','eyebrow'),node('h1',assisted?'От заготовки до подтверждённого размера':t.conditionTitle));
    heading.append(node('p',assisted?'Подготовьте станок, сохраните припуск, выполните чистовой проход и проверьте свою деталь.':t.challenge));root.append(heading);
    const prepared=s.machine.clamped&&s.machine.zeroed&&s.machine.doorClosed;
    const stage=c.tab==='review'?'review':g.passed?'result':c.tab==='control'?'control':!prepared?'prepare':'cut';
    const stages=node('ol',undefined,'cycle-stages');
    for(const [id,title]of [['prepare','Подготовка'],['cut','Обработка'],['control','Контроль'],['result','Результат']]){const item=node('li',title);item.setAttribute('aria-current',stage===id?'step':'false');stages.append(item);}root.append(stages);
    const feedback=node('p',c.notice||s.feedback,'training-feedback cycle-feedback');feedback.setAttribute('role','status');feedback.tabIndex=-1;root.append(feedback);
    const layout=node('div',undefined,'cycle-layout'),overview=node('section',undefined,'panel cycle-overview'),work=node('section',undefined,'panel cycle-work');
    overview.append(node('h3','Карта детали'),node('p',`Заготовка Ø${fmt(t.stock)} × ${t.length} мм → цель Ø${fmt(t.target)} ±${fmt(t.tolerance)} мм.`));
    const fig=node('figure',undefined,'cycle-figure'),height=100*s.diameter/t.stock,targetHeight=100*t.target/t.stock;
    fig.innerHTML=`<svg viewBox="0 0 520 235" role="img" aria-label="Текущий диаметр ${fmt(s.diameter)} мм. Исходный ${fmt(t.stock)} мм, требуемый ${fmt(t.target)} мм."><rect x="24" y="65" width="64" height="118" rx="5" fill="#556b79"/><rect x="88" y="75" width="340" height="100" fill="none" stroke="#8da3b1" stroke-dasharray="6 5"/><rect x="88" y="${125-height/2}" width="340" height="${height}" fill="${g.scrap?'#d39189':'#acc1cf'}"/><path d="M88 ${125-targetHeight/2}H440M88 ${125+targetHeight/2}H440" stroke="#f3c775" stroke-dasharray="6 5" stroke-width="2"/><path d="M77 125H465" stroke="#d2dce3" stroke-dasharray="5 5"/><text x="28" y="34" fill="#e4edf3" font-size="21">Сейчас Ø${fmt(s.diameter)} мм</text><text x="28" y="219" fill="#f3c775" font-size="18">Янтарный пунктир — конечный размер</text></svg>`;
    fig.append(node('figcaption','Новый проход продолжает обработку этой заготовки. Снятый материал не возвращается.'));overview.append(fig);
    const givens=node('dl',undefined,'cycle-givens');
    for(const [term,value]of [['Черновая глубина',`не более ${fmt(t.maxDepth)} мм на радиус`],['Запас перед чистовым',`${fmt(t.allowance)} мм по диаметру`],['Чистовая глубина',`не более ${fmt(t.finishDepth)} мм на радиус`],['Подача: черновая / чистовая',`${t.roughFeed.map(v=>fmt(v)).join('–')} / ${t.finishFeed.map(v=>fmt(v)).join('–')} мм/об`],['Обороты',`${t.rpm.join('–')} об/мин`],['Координаты','X по диаметру, ноль Z на торце. Коррекция X = 0.']])givens.append(node('dt',term),node('dd',value));overview.append(givens);
    overview.append(node('p','Это заданные учебные ограничения. Рабочий участок имеет длину по карте; продольное перемещение в этом упражнении выполняет тренажёр.','course-note'));
    const status=node('p',`${s.machine.clamped?'✓':'○'} Закрепление · ${s.machine.zeroed?'✓':'○'} Ноль · ${s.machine.doorClosed?'✓':'○'} Дверь · Шпиндель ${s.machine.spindle?'вращается':'остановлен'}`,'cycle-machine-state');work.append(status);
    if(g.scrap){
      work.append(node('h3','Размер ниже допуска'),node('p','Увеличение X не вернёт материал. Остановите шпиндель и начните с новой заготовки. История этого условия сохранится.'),button(s.machine.spindle?'Остановить шпиндель':'Новая заготовка',()=>c.action(s.machine.spindle?{type:'spindle',value:false}:{type:'blank'}),true));
      if(learning.independent&&c.canNext)work.append(button('Взять другое условие',c.next));
    }else if(stage==='result'){
      work.append(node('h3',g.independent?'Цикл подтверждён самостоятельно':'Цикл выполнен с разбором или повтором'),node('p',`Свежий контроль: Ø${fmt(s.measurements.at(-1).reading)} мм. Все требования текущей детали выполнены.`));
      if(assisted)work.append(node('p','Теперь выполните цикл по другому чертежу: изменятся припуск и ограничение глубины.'),button('Далее: другой чертёж',c.next,true));
      else if(g.independent||c.achieved.independent){if(!g.independent)work.append(node('p','Это повтор. Прежний самостоятельный результат этого условия сохранён в истории.'));work.append(button('Далее: G-код',c.next,true));}
      else {work.append(node('p','Помощь и исправления учитываются. Повтор этого условия остаётся тренировкой. Для самостоятельного подтверждения нужно другое условие.'));if(c.canNext)work.append(button('Новое условие без помощи',c.next,true));else work.append(node('p','Все три условия уже разбирались с помощью или повтором. Они доступны для тренировки; самостоятельное подтверждение пока не получено.'));}
    }else if(stage==='prepare'){
      work.append(node('h3','Подготовьте станок'));
      if(assisted){
        const next=!s.machine.clamped?['Закрепить заготовку','Заготовка должна удерживаться в патроне.',{type:'clamp',value:true}]:!s.machine.zeroed?['Установить ноль на торце','Подтвердите, откуда отсчитывается длина.',{type:'zero',value:true}]:['Закрыть дверь','После подготовки закройте защитную дверь.',{type:'door',value:true}];
        work.append(node('p',next[1]),button(next[0],()=>c.action(next[2]),true));
      }else{
        const choice=select('Действие подготовки','preparation',[['clamp','Закрепить заготовку'],['zero','Установить ноль на торце'],['door','Закрыть дверь'],['spindle','Запустить шпиндель']],'clamp');work.append(choice,button('Выполнить действие',()=>c.action({type:choice.querySelector('select').value,value:true}),true));
      }
    }else if(stage==='cut'){
      work.append(node('h3','Настройте следующий проход'));
      if(!s.machine.spindle)work.append(button('Запустить шпиндель',()=>c.action({type:'spindle',value:true}),true));
      if(assisted)work.append(node('p',s.passes.length?'Основной съём выполнен? Сравните оставшийся припуск с картой и выберите этап следующего прохода.':'Черновым проходом оставьте запас из карты. Диаметр перед чистовым = цель + припуск по диаметру.','cycle-coach'));
      const form=node('form');form.noValidate=true;const fields=node('div',undefined,'cycle-fields');
      fields.append(select('Этап прохода','stage',[['rough','Черновой'],['finish','Чистовой']],draft.stage||'rough'),select('Инструмент','tool',[['','Выберите инструмент'],['turning','Проходной резец'],['boring','Расточной резец'],['drill','Сверло']],draft.tool||(assisted?'turning':'')),field('Конечный X, мм','x',draft.x??(assisted?String(t.target+t.allowance):'')),field('Подача, мм/об','feed',draft.feed??'0,20'),field('Обороты, об/мин','rpm',draft.rpm??'800'),field('Мой прогноз диаметра, мм','prediction',draft.prediction??''));
      const capture=()=>{const data=Object.fromEntries(new FormData(form));c.setDraft(data);return data;};form.addEventListener('input',capture);form.addEventListener('change',capture);
      const submit=node('button','Выполнить проход','button primary');submit.type='submit';submit.disabled=!s.machine.spindle;form.append(fields,submit);
      form.addEventListener('submit',event=>{event.preventDefault();const data=capture(),action={type:'cut',stage:data.stage,tool:data.tool,offset:0};for(const k of ['x','feed','rpm','prediction']){const v=window.CNCTrainingMath.parseNumber(data[k]);if(v===null){feedback.textContent='Заполните X, подачу, обороты и свой прогноз диаметра.';feedback.focus();return;}action[k]=v;}if(!data.tool){feedback.textContent='Выберите инструмент для наружной обработки.';return;}c.action(action);});work.append(form);
      if(s.passes.length)work.append(button('Остановить и перейти к контролю',()=>{c.action({type:'spindle',value:false});c.setTab('control');}));
    }else if(stage==='control'){
      work.append(node('h3','Измерьте текущую деталь'));
      if(s.machine.spindle)work.append(button('Остановить шпиндель',()=>c.action({type:'spindle',value:false}),true));
      const instrument=select('Прибор','instrument',[['caliper','Штангенциркуль · 0,1 мм'],['micrometer','Микрометр · 0,01 мм']],draft.instrument||s.measurements.at(-1)?.instrument||'caliper');instrument.addEventListener('change',()=>c.setDraft({instrument:instrument.querySelector('select').value}));
      const measure=button('Сделать замер',()=>c.action({type:'measure',instrument:instrument.querySelector('select').value}),true);measure.disabled=s.machine.spindle;work.append(instrument,measure);
      const last=s.measurements.at(-1),fresh=last&&last.pass===s.passes.length;
      if(last)work.append(node('p',`${fmt(last.reading)} мм · ${last.instrument==='micrometer'?'микрометр':'штангенциркуль'}${fresh?'':' · замер до последнего прохода'}`,'training-reading'),node('p',`Интервал показания: ${fmt(last.reading-last.resolution/2,3)}…${fmt(last.reading+last.resolution/2,3)} мм. Допуск: ${fmt(t.target-t.tolerance)}…${fmt(t.target+t.tolerance)} мм.`));
      const verdict=select('Мой вывод','verdict',[['','Выберите вывод'],['ok','В допуске'],['large','Больше допуска'],['small','Меньше допуска'],['uncertain','Нужно уточнить']],draft.verdict||'');verdict.addEventListener('change',()=>c.setDraft({verdict:verdict.querySelector('select').value}));
      const inspect=button('Подтвердить вывод',()=>{const value=verdict.querySelector('select').value;if(value)c.action({type:'inspect',verdict:value,diagnosis:'none'});else feedback.textContent='Сначала выберите свой вывод по замеру.';},true);inspect.disabled=!fresh||s.machine.spindle;work.append(verdict,inspect,button('Вернуться к обработке',()=>c.setTab('cut')));
    }else{
      work.append(node('h3','Журнал текущего условия'));const log=node('ol',undefined,'training-journal');for(const j of s.journal)log.append(node('li',`Заготовка ${j.blank}: ${j.message}`));work.append(log,button('Вернуться к работе',()=>c.setTab('cut')));
    }
    const requirements=node('details',undefined,'cycle-checklist');requirements.append(node('summary','Что нужно для зачёта'));const list=node('ul');for(const item of g.criteria)list.append(node('li',(item.ok?'✓ ':'○ ')+item.title));requirements.append(list);work.append(requirements);
    work.append(node('p',`Это условие: подсказок ${s.hints}, блокировок ${g.blockedActions}, ошибок прогноза ${g.predictionErrors}, ошибок вывода ${g.inspectionErrors}.`,'course-note'));
    if(stage!=='review')work.append(button('Посмотреть журнал действий',()=>c.setTab('review')));
    layout.append(overview,work);root.append(layout,c.tools());
  }
  window.CNCCycleUI={render};
})();
