(function(){
  'use strict';
  const model=window.CNCGCode,learning=window.CNCGCodeLearning,key='cnc-gcode-v2';
  let state=learning.restoreBook(null),root,available=true,notice='';
  try{const restored=learning.restoreBook(JSON.parse(localStorage.getItem(key)||'null'),JSON.parse(localStorage.getItem('cnc-gcode-v1')||'null'));if(!restored)throw Error('Некорректный журнал');state=restored;}catch{notice='Не удалось восстановить журнал G-кода. Остальные разделы курса сохранены.';}
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn,cls='button secondary')=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
  const number=n=>n===null||n===undefined?'—':String(Number(n.toFixed(4))).replace('.',',');
  function statsText(){const s=session();return `Это условие: ошибок прогноза ${s.predictionErrors}, ошибок проверки ${s.checkErrors}. Помощь: ${s.helped?'использована':'не использована'}. История сохраняется при повторе.`;}
  function save(){session();try{localStorage.setItem(key,JSON.stringify(learning.snapshotBook(state)));available=true;}catch{available=false;}const stats=root?.querySelector('.gcode-attempt-stats');if(stats)stats.textContent=statsText();window.dispatchEvent(new Event('cnc-gcode-change'));}
  function session(){const id=state.selected;if(!state.sessions[id]){state.sessions[id]=learning.create(id);if(state.legacy.helped[id]||state.legacy.passed[id]?.assisted)state.sessions[id]=learning.transition(state.sessions[id],{type:'help',source:'reference'}).state;}return state.sessions[id];}
  function act(action){try{const result=learning.transition(session(),action);state.sessions[state.selected]=result.state;notice='';save();return result;}catch(e){notice=e.message;return {ok:false,message:notice};}}
  function help(source){if(!session().helped)act({type:'help',source});}
  function choose(id,guided=false){if(!model.tasks.some(t=>t.id===id))return;if(!guided)window.CNCLearningUI?.deactivate();state.selected=id;save();render(true);}
  function phase(value,assisted=false){state.phases[state.selected]=value;if(assisted)help('example');save();render(true);}
  function schematic(task,result,count){
    const box=node('figure',undefined,'gcode-drawing'),initial=task.initial,pz=z=>65+(z+60)*7,px=x=>172-x*2;
    const stock=result?.stock||task.stock||{d:32,length:40},current=count>0?result.trace[count-1].after:initial;
    let markup=`<rect x="${pz(-stock.length)}" y="${px(stock.d)}" width="${pz(0)-pz(-stock.length)}" height="${stock.d*4}" fill="#647f8f" opacity=".32"/><path d="M45 172H585M${pz(0)} 35V267" stroke="#8ca5b5" stroke-dasharray="4 5"/><g fill="#4f6478" font-size="13"><text x="${pz(-stock.length)+12}" y="246">Исходная заготовка Ø${stock.d}</text><text x="${pz(0)+7}" y="285">Z0 · торец</text><text x="${pz(-stock.length)-12}" y="285">Z−${stock.length}</text><text x="578" y="165">Z+</text><text x="12" y="44">X · Ø</text></g>`;
    const target=[initial,...task.expected];
    markup+=`<polyline points="${target.map(p=>pz(p.z)+','+px(p.x)).join(' ')}" fill="none" stroke="#19815d" stroke-width="1.5" stroke-dasharray="3 6"/>`;
    for(const p of task.expected)markup+=`<circle cx="${pz(p.z)}" cy="${px(p.x)}" r="4" fill="#ffffff" stroke="#19815d" stroke-width="1.5"/>`;
    if(result)for(const t of result.trace.slice(0,count)){if(!t.move)continue;const m=t.move,risk=result.warnings.some(w=>w.line===m.line);markup+=`<path d="M${pz(m.from.z)} ${px(m.from.x)}L${pz(m.to.z)} ${px(m.to.x)}" fill="none" stroke="${risk?'#c53d39':m.mode===0?'#277ab6':'#b57812'}" stroke-width="3" ${m.mode===0?'stroke-dasharray="8 5"':''}/>`;}
    markup+=`<circle cx="${pz(current.z)}" cy="${px(current.x)}" r="6" fill="#fff" stroke="#17232c" stroke-width="2"/><text x="${pz(current.z)-10}" y="${px(current.x)-15}" fill="#263e56" font-size="13">X${number(current.x)} Z${number(current.z)}</text>`;
    box.innerHTML=`<svg viewBox="0 0 620 305" role="img" aria-label="Схема траектории условной точки инструмента. Начало X${initial.x} Z${initial.z}; текущая точка X${current.x} Z${current.z}.">${markup}</svg>`;
    box.append(node('figcaption','Точки цели — зелёные. G00 — голубой пунктир, G01 — янтарная линия. Быстрый ход соединён условно: на станке его путь может отличаться.'));return box;
  }
  function describe(frame){
    if(!frame)return 'Начальная точка. Ни одна строка ещё не разобрана.';
    const m=frame.move;if(m)return `${m.mode===0?'Быстрое позиционирование':'Линейное движение с подачей'}: X${number(m.from.x)} Z${number(m.from.z)} → X${number(m.to.x)} Z${number(m.to.z)}.${m.mode===1?' F'+number(m.feed)+(m.feedMode===99?' мм/об.':' мм/мин.'):''}`;
    const notes=[];for(const code of frame.codes){const text={G18:'Плоскость XZ.',G21:'Размеры в миллиметрах.',G97:'Постоянные обороты.',G98:'Подача в мм/мин.',G99:'Подача в мм/об.',G0:'Выбран G00.',G1:'Выбран G01.',M3:'Вращение включено.',M5:'Шпиндель остановлен.',M30:'Программа завершена.',O:'Номер программы.'}[code];if(text)notes.push(text);}
    if(frame.after.feed!==frame.before.feed)notes.push('Сохранена подача F'+number(frame.after.feed)+'.');
    if(frame.after.rpm!==frame.before.rpm)notes.push('Задано S'+number(frame.after.rpm)+' об/мин.');
    return notes.join(' ')||'Координаты не изменились; действующие режимы сохранены.';
  }
  function preview(task){
    let onStep=()=>{};
    const wrap=node('section',undefined,'gcode-preview'),visual=node('div'),readouts=node('dl',undefined,'gcode-readouts'),currentLine=node('p',undefined,'gcode-current'),meaning=node('p',undefined,'gcode-meaning'),diagnostics=node('div',undefined,'gcode-diagnostics');diagnostics.setAttribute('role','status');
    const details=node('details',undefined,'gcode-trace'),traceList=node('ol');details.append(node('summary','Строки и сохранённые режимы'),traceList);wrap.append(visual,readouts,currentLine,meaning,diagnostics,details);
    function paint(result,count=0){
      onStep(count);
      const frame=count?result.trace[count-1]:null,s=frame?.after||result?.initial||{...task.initial,motion:null,feed:null,feedMode:99,rpm:0,spindle:false};
      visual.replaceChildren(schematic(task,result,count));readouts.replaceChildren();
      for(const [label,value] of [['X · диаметр',number(s.x)+' мм'],['Z · положение',number(s.z)+' мм'],['Движение',s.motion===null?'ещё не выбрано':s.motion===0?'G00':'G01'],['Подача',s.feed===null?'ещё не задана':number(s.feed)+(s.feedMode===99?' мм/об':' мм/мин')],['Шпиндель',s.spindle?'вращение · '+number(s.rpm)+' об/мин':'остановлен']]){const item=node('div');item.append(node('dt',label),node('dd',value));readouts.append(item);}
      currentLine.textContent=frame?`Строка ${frame.line}: ${frame.raw}`:'До первой строки';meaning.textContent=describe(frame);diagnostics.replaceChildren();
      if(result)for(const error of [...result.errors,...result.warnings])diagnostics.append(node('p',(error.line?`Строка ${error.line}. `:'')+error.message,result.errors.includes(error)?'gcode-error':'gcode-warning'));
      traceList.replaceChildren();if(result)result.trace.forEach((f,i)=>{const item=node('li'),b=button(`${f.line}  ${f.raw}`,()=>paint(result,i+1),'gcode-trace-line');b.setAttribute('aria-current',i===count-1?'step':'false');item.append(b,node('small',`X${number(f.after.x)} · Z${number(f.after.z)} · ${f.after.motion===null?'движение не выбрано':f.after.motion===0?'G00':'G01'} · F${number(f.after.feed)} ${f.after.feedMode===99?'мм/об':'мм/мин'}`));traceList.append(item);});
    }
    paint(null,0);return {element:wrap,paint,onStep(fn){onStep=fn;}};
  }
  function reference(article,countHelp=false){
    const info=node('details',undefined,'gcode-reference');info.append(node('summary',countHelp?'Памятка команд · учитывается как помощь':'Памятка команд и условия учебного блока'));
    const dl=node('dl');for(const [code,meaning] of model.commands)dl.append(node('dt',code),node('dd',meaning));info.append(dl,node('p','Соглашения блока: токарная модель по материалам Haas, X по диаметру; абсолютные X/Z, миллиметры, плоскость XZ. В начале фрагмента уже действуют G21, G18, G99 и G97; вид движения и F ещё не заданы. В итоговом маршруте режимы нужно объявить явно. Область схемы: X 0…60, Z −60…10 мм.'));
    info.append(node('p','Схема показывает движения точки и состояния команд. Она не рассчитывает съём металла, форму державки, патрон, коррекции и реальный путь G00. Учебный текст не является готовой программой станка.'));
    for(const source of model.sources){const a=node('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';info.append(a);}article.append(info);
    if(countHelp){const id=state.selected;info.append(node('p','Открытие памятки учитывается как помощь в этом условии.'));info.addEventListener('toggle',()=>{if(info.open&&info.isConnected&&state.selected===id)help('reference');});}
  }
  const labels={x:'X после строки, мм',z:'Z после строки, мм',motion:'Вид движения',feed:'Значение F',feedMode:'Единицы подачи',rpm:'Обороты после строки, об/мин',spindle:'Состояние шпинделя'};
  const choices={motion:[[0,'G00 · быстрое позиционирование'],[1,'G01 · линейный рабочий ход']],feedMode:[[99,'G99 · мм/об'],[98,'G98 · мм/мин']],spindle:[['true','Вращается'],['false','Остановлен']]};
  function route(){return window.CNCLearningUI?.gcode(state.selected);}
  function proof(id){const current=learning.evidence(state,id),historical=window.CNCProgressUI?.historicalGCode(id);const independent=current.independent||historical?.independent||false;return {passed:current.passed||historical?.passed||false,independent,legacy:!independent&&(current.legacy||historical?.legacy||false)};}
  function nextFinal(){return learning.finalIds().find(id=>proof(id).independent)||learning.finalIds().find(id=>{const local=state.sessions[id],other=window.CNCProgressUI?.historicalGCode(id);return !proof(id).passed&&!other?.helped&&!other?.errors&&(!local||!local.helped&&!local.predictionErrors&&!local.checkErrors);})||null;}
  function diagnosis(task,grade){
    if(grade.result.errors.length)return 'syntax';
    const moves=model.mergedMoves(grade.result.moves),work=moves.filter(m=>m.mode===1);
    if(moves.some((m,i)=>task.expected[i]&&m.mode!==task.expected[i].mode))return task.id==='modal'?'modal':'motion';
    if(grade.result.warnings.length)return 'retract';
    if(work.some(m=>m.feedMode!==99))return 'feed';
    if(task.full){const codes=grade.result.trace.flatMap(f=>f.codes);if(!codes.includes('G97')||!codes.includes('M3')||!codes.includes('M5')||!grade.result.state.ended||work.some(m=>!m.spindle||m.rpm!==(task.rpm||600)))return 'spindle';if(!codes.includes('G99'))return 'feed';if(!codes.includes('G21')||!codes.includes('G18'))return 'syntax';}
    for(let i=0;i<Math.min(moves.length,task.expected.length);i++){const m=moves[i],e=task.expected[i];if(m.mode!==e.mode)return task.id==='modal'?'modal':'motion';if(e.feed!==undefined&&Math.abs(m.feed-e.feed)>1e-7)return 'feed';if(Math.abs(m.to.x-e.x)>1e-7||Math.abs(m.to.z-e.z)>1e-7)return 'coordinates';}
    return task.id==='spindle'?'spindle':'coordinates';
  }
  function render(focus=false){
    if(!root)return;root.replaceChildren();const task=model.tasks.find(t=>t.id===state.selected),position=model.tasks.indexOf(task),practicing=state.phases[task.id]==='practice',context=route(),current=session();
    root.dataset.guided=String(!!context);
    const count=learning.ids().filter(id=>proof(id).passed).length;
    const heading=node('div',undefined,'gcode-heading');heading.append(node('p','ОТ ОБРАБОТКИ К ПРОГРАММЕ','eyebrow'),node('h2','G-код: предсказываем и проверяем'),node('p','Шесть тем связывают знакомые действия с командами. Затем — программа для другой детали. Контур и большой маршрут доступны дополнительно.'));
    const progress=node('p',`Пройдено ${count} из ${model.tasks.length} заданий`,'gcode-progress');heading.append(progress);root.append(heading);
    const menu=node('details',undefined,'course-index gcode-index'),nav=node('nav');nav.setAttribute('aria-label','Задания по G-коду');menu.append(node('summary',`${task.title} · выбрать тему`),nav);
    for(const t of model.tasks){const b=button(`${proof(t.id).passed?'✓ ':''}${t.title}`,()=>choose(t.id),'');b.setAttribute('aria-current',t.id===task.id?'step':'false');nav.append(b);}root.append(menu);
    const article=node('article',undefined,'panel gcode-lesson');article.append(node('p',task.transfer?'САМОСТОЯТЕЛЬНОЕ УСЛОВИЕ':`Задание ${position+1} · ${task.level}`,'eyebrow'),node('h3',task.title),node('p',task.context.bridge,'gcode-bridge'));
    const stages=node('nav',undefined,'course-phases');stages.setAttribute('aria-label','Шаги задания по G-коду');for(const [value,label]of [['read',task.transfer?'Карта и требования':'Разобраться'],['practice','Предсказать и проверить']]){const b=button(label,()=>phase(value,practicing&&value==='read'&&!task.transfer),'');b.setAttribute('aria-current',(practicing?'practice':'read')===value?'step':'false');stages.append(b);}article.append(stages);
    const storage=node('p',available?(window.CNCAccount?'Черновик, прогнозы и зачёты передаются в аккаунт. Статус сохранения — вверху страницы.':'Черновик, прогнозы и зачёты сохраняются в этом браузере.'):'Сохранение недоступно. Работа останется до закрытия страницы.','course-note');
    const storageNote=()=>{if(!available)storage.textContent='Сохранение недоступно. Работа останется до закрытия страницы.';};
    if(notice)article.append(node('p',notice,'gcode-error'));
    if(!practicing){
      for(const p of task.intro)article.append(node('p',p));
      if(task.transfer){article.append(node('p',task.brief,'gcode-brief'),schematic(task,null,0),node('p','Прогноз относится к вашему текущему коду. Подсказка или ошибка прогноза/проверки сохраняется для этого условия; новый самостоятельный результат подтверждают на другом чертеже.','course-note'));}
      else{
        const example=node('div',undefined,'gcode-example');example.append(node('strong','Разбираем вместе: другое условие'),node('pre',task.example),node('p',task.walk));article.append(example);
        const result=model.simulate(task.demo,{initial:task.initial,stock:task.stock}),demo=preview({...task,expected:result.moves.map(m=>m.to)});let step=0;demo.onStep(v=>{step=v;});
        const stepButton=button('Разобрать первую строку',()=>{if(step>=result.trace.length){step=0;demo.paint(result,0);stepButton.textContent='Разобрать первую строку';return;}step++;demo.paint(result,step);stepButton.textContent=step===result.trace.length?'Повторить разбор':'Следующая строка примера';});article.append(stepButton,demo.element);
      }
      article.append(button(task.transfer?'Перейти к программе':'Теперь попробую сам',()=>phase('practice'),'button primary'));
    }else{
      const stock=task.stock||{d:32,length:40};article.append(node('p',task.brief,'gcode-brief'),node('p',`Начало X${task.initial.x} Z${task.initial.z}. Исходная заготовка Ø${number(stock.d)} × ${stock.length} мм. X по диаметру; Z0 на торце. Читаем движение точки, съём металла здесь не рассчитывается.`,'gcode-initial'));
      const columns=node('div',undefined,'gcode-columns'),editing=node('section',undefined,'gcode-editor'),label=node('label','Учебная программа','field'),textarea=node('textarea');textarea.id='gcode-source';textarea.maxLength=model.MAX_SOURCE;textarea.rows=10;textarea.spellcheck=false;textarea.autocapitalize='off';textarea.autocomplete='off';textarea.value=state.drafts[task.id]??task.starter;label.htmlFor=textarea.id;editing.append(label,textarea,node('p','В коде — латинские буквы и десятичная точка: F0.12.','gcode-input-note'));
      const visual=preview(task);let result=null,step=0;visual.onStep(v=>{step=v;});
      const feedback=node('div',undefined,'gcode-feedback');feedback.setAttribute('role','status');
      const remedy=node('aside',undefined,'gcode-remediation');remedy.hidden=true;remedy.tabIndex=-1;
      function explain(topic){
        help('lesson');storageNote();remedy.replaceChildren();remedy.hidden=false;
        const related=model.tasks.find(t=>t.id===topic),lesson=window.CNCCourse.lessons.find(l=>l.id===(related?.context.lesson||task.context.lesson));
        remedy.append(node('h4',topic==='syntax'?'Как записать строку':'Разберём причину: '+related.title));
        if(topic==='syntax')remedy.append(node('p','Команда начинается с латинской буквы. В десятичном числе используется точка. Указанная строка с ошибкой не выполняется; сначала исправьте её запись.'));
        else for(const p of related.intro)remedy.append(node('p',p));
        if(lesson)remedy.append(node('strong','Из курса: '+lesson.title),node('p',lesson.intro));
        remedy.append(button('Вернуться к моему коду',()=>{remedy.hidden=true;textarea.focus();},'button secondary'));remedy.focus();
      }
      const forecastBox=node('section',undefined,'gcode-forecast'),targetLine=node('p',undefined,'gcode-target-line'),form=node('form'),fields=node('div',undefined,'gcode-prediction-fields'),inputs={};
      forecastBox.append(node('h4','Сначала ваш прогноз'),node('p','Предскажите текущий черновик, даже если он пока не соответствует заданию. Затем сравните прогноз с выполнением.'),targetLine);
      for(const name of learning.spec(task.id).fields){
        const wrapper=node('label',labels[name],'field');let input;
        if(choices[name]){input=node('select');const empty=node('option','Выберите значение');empty.value='';input.append(empty);for(const [v,title]of choices[name]){const o=node('option',title);o.value=String(v);input.append(o);}}
        else{input=node('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=32;}
        input.name='prediction-'+name;input.value=state.predictionDrafts[task.id]?.[name]??'';inputs[name]=input;wrapper.append(input);fields.append(wrapper);
        input.addEventListener('input',()=>{state.predictionDrafts[task.id]??={};state.predictionDrafts[task.id][name]=input.value;save();storageNote();});
        input.addEventListener('change',()=>{state.predictionDrafts[task.id]??={};state.predictionDrafts[task.id][name]=input.value;save();storageNote();});
      }
      const predict=node('button','Подтвердить прогноз','button primary');predict.type='submit';const predictionStatus=node('p',undefined,'gcode-prediction-status');predictionStatus.setAttribute('role','status');form.append(fields,predict,predictionStatus);forecastBox.append(form);editing.append(forecastBox);
      const tools=node('div',undefined,'gcode-toolbar'),viewLabel=node('label','Просмотр'),view=node('select');view.setAttribute('aria-label','Способ просмотра программы');for(const [v,title]of [['step','По строкам'],['all','Весь фрагмент']]){const o=node('option',title);o.value=v;view.append(o);}viewLabel.append(view);
      const run=button('Разобрать код',()=>{if(!gate())return;if(!result){result=model.simulate(textarea.value,{initial:task.initial,stock:task.stock});step=0;}if(view.value==='all')step=result.trace.length;else if(step<result.trace.length)step++;else step=0;visual.paint(result,step);run.textContent=step===result.trace.length?'Повторить разбор':'Следующая строка';});tools.append(viewLabel,run);
      const check=button('Проверить задание',()=>{
        remember();const response=act({type:'check',code:textarea.value});storageNote();feedback.replaceChildren(node('strong',response.message));
        if(!response.grade){updateGate();return;}
        const g=response.grade;result=g.result;step=result.trace.length;visual.paint(result,step);
        const list=node('ul');for(const item of g.criteria)list.append(node('li',(item.ok?'✓ ':'○ ')+item.text,item.ok?'gcode-ok':'gcode-missing'));feedback.append(list);if(g.pathHint)feedback.append(node('p',g.pathHint,'gcode-hint'));
        if(!g.correct){const topic=diagnosis(task,g);feedback.append(button('Разобрать причину ошибки',()=>explain(topic),'button secondary'));}
        refreshProgress();updateNext();updateGate();
      },'button primary');editing.append(tools,check);
      function remember(){state.drafts[task.id]=textarea.value;save();storageNote();}
      function gate(){return session().prediction?.code===textarea.value;}
      function updateGate(){
        run.disabled=check.disabled=!gate();const found=learning.target(task.id,textarea.value);targetLine.textContent=found.frame?`Прогноз для строки ${found.frame.line}: ${found.frame.raw}`:found.message;
        if(gate())predictionStatus.textContent='Прогноз подтверждён для текущего кода. Можно разбирать строки и проверять задание.';
      }
      form.addEventListener('submit',event=>{
        event.preventDefault();remember();const values={};
        for(const [name,input]of Object.entries(inputs)){input.removeAttribute('aria-invalid');if(!input.value.trim()){predictionStatus.textContent='Заполните все величины прогноза.';input.focus();return;}if(name==='spindle')values[name]=input.value==='true';else{const v=window.CNCTrainingMath.parseNumber(input.value);if(v===null){predictionStatus.textContent='Для чисел прогноза подходят точка и запятая.';return;}values[name]=v;}}
        const response=act({type:'predict',code:textarea.value,values});storageNote();predictionStatus.textContent=response.message;
        for(const key of response.forecast?.wrong||[])inputs[key].setAttribute('aria-invalid','true');
        if(response.forecast?.valid&&!response.forecast.correct){const wrong=response.forecast.wrong,topic=wrong.some(k=>['feed','feedMode'].includes(k))?'feed':wrong.some(k=>['rpm','spindle'].includes(k))?'spindle':wrong.includes('motion')?'motion':'coordinates';feedback.replaceChildren(node('p','Прогноз требует исправления. Можно перечитать связанное объяснение.'),button('Разобраться в прогнозе',()=>explain(topic),'button secondary'));}
        updateGate();
      });
      const evidence=proof(task.id),historical=node('p',undefined,'course-note');
      if(evidence.passed)historical.textContent=evidence.legacy?'Зачёт прежней версии сохранён. В новой попытке перед разбором нужен прогноз.':'Прежний зачёт сохранён. Текущий черновик проверяется отдельно.';
      editing.append(historical);
      const extra=node('details',undefined,'gcode-help');extra.append(node('summary','Помощь и повтор'));
      const hint=node('p',undefined,'gcode-hint');hint.hidden=true;
      extra.append(node('p','Подсказка и объяснение учитываются как помощь. Сброс черновика сохраняет помощь и ошибки.'),button('Подсказка по условию',()=>{help('hint');hint.hidden=false;hint.textContent=task.hint;storageNote();}),hint,button('Вернуть исходный черновик',()=>{act({type:'reset'});textarea.value=task.starter;state.drafts[task.id]=textarea.value;state.predictionDrafts[task.id]={};for(const input of Object.values(inputs))input.value='';save();result=null;step=0;visual.paint(null,0);feedback.textContent=session().feedback;predictionStatus.textContent='Сделайте прогноз для восстановленного черновика.';updateGate();}));editing.append(extra);
      const next=button('',()=>{const r=window.CNCLearningUI?.codeContinuation(task.id);if(r)r.run();else if(task.transfer){const id=nextFinal();if(id&&id!==task.id)choose(id);else window.CNCWorkshop.results();}else choose(model.tasks[(position+1)%model.tasks.length].id);},'button primary');
      function updateNext(){const r=window.CNCLearningUI?.codeContinuation(task.id);const e=proof(task.id);next.disabled=!e.passed;next.textContent=r?.label||(task.transfer?(e.independent?'К итогам':nextFinal()?'Другое условие без помощи':'Все условия разобраны — к итогам'):'Следующее задание');}
      function refreshProgress(){progress.textContent=`Пройдено ${learning.ids().filter(id=>proof(id).passed).length} из ${model.tasks.length} заданий`;nav.children[position].textContent=(proof(task.id).passed?'✓ ':'')+task.title;}
      updateNext();updateGate();
      textarea.addEventListener('input',()=>{remember();result=null;step=0;visual.paint(null,0);feedback.textContent='Код изменён. Обновите и подтвердите прогноз.';predictionStatus.textContent='Для изменённого кода нужен новый прогноз.';updateGate();});
      columns.append(editing,visual.element);article.append(columns,remedy,feedback,node('p',statsText(),'course-note gcode-attempt-stats'),next,button(task.transfer?'Вернуться к карте':'Вернуться к объяснению',()=>phase('read',!task.transfer),'course-back'));
    }
    reference(article,practicing||task.transfer);root.append(article,storage);
    if(focus){const h=article.querySelector('h3');h.tabIndex=-1;h.focus();}
  }
  function pathEvidence(){return {core:learning.coreIds().filter(id=>proof(id).passed),final:learning.finalIds().some(id=>proof(id).independent)};}
  window.CNCGCodeUI={progressSnapshot:()=>learning.snapshotBook(state),mount(parent){root=node('section',undefined,'gcode-screen');root.id='gcode-screen';root.hidden=true;parent.insertBefore(root,parent.querySelector('footer'));render();return root;},render,
    open(id,guided=false){if(id)choose(id,guided);else render();},completed:()=>learning.ids().filter(id=>proof(id).passed).length,pathEvidence,nextFinal:()=>nextFinal(),currentId:()=>state.selected};
})();
