(function(){
  'use strict';
  const model=window.CNCMachine,graphics=window.CNCMachineGraphics,$=id=>document.getElementById(id),key='cnc-machine-path-v1';
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn,cls='button secondary')=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
  const fmt=n=>Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:3}):'—';
  let flow,catalog,work,hero,search,filter,count,empty,context,contextCopy,attempt,boards={},docks={},playMode='step',last='',view='drawing',selected=null,queued=false,path=model.restoreStages(null);
  try{path=model.restoreStages(JSON.parse(localStorage.getItem(key)||'null'));}catch{}
  function saveStage(id,stage){path.stages[id]=stage;try{localStorage.setItem(key,JSON.stringify(path));}catch{}}
  function schedule(event){
    // Native menus emit click/input while a choice is still being made. Rendering
    // then can restore the old value before change, or replace an open select.
    if(event?.target?.closest?.('select')&&event.type!=='change')return;
    if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});
  }
  function snapshot(){const state=window.CNCDemo.readState();return {state,task:model.get(state.task),data:window.CNCDemo.machineSnapshot()};}
  function open(id){document.querySelector(`[data-task="${id}"]`)?.click();}
  function records(){return window.CNCDemo.completionRecords();}
  let firstPass;
  function buildFirstPass(){
    const form=$('settings'),setup=document.querySelector('.setup'),coach=node('aside',undefined,'first-pass-coach');
    coach.append(node('strong','Сейчас меняем только конечный X'),node('p','Найдите нужный диаметр на чертеже и задайте его по X. Здесь X записывается по диаметру. Затем переходите к пробной обработке. Инструмент и режимы уже выбраны; полноценную наладку разберём позже.'));
    setup.querySelector('.panel-heading').after(coach);
    const details=node('details',undefined,'first-pass-presets'),summary=node('summary','Остальные условия уже заданы'),fields=node('div',undefined,'preset-fields');
    details.append(summary,node('p','Для этого вводного упражнения инструмент и режимы подготовлены заранее. Их можно проверить здесь; полноценная наладка появится дальше.'),fields);
    const moved=['tool','offset','feed','rpm'].map(id=>{const label=$(id).closest('label'),anchor=node('span');anchor.hidden=true;label.before(anchor);return {label,anchor};});
    form.querySelector('.conditions').before(details);firstPass={setup,coach,details,summary,fields,moved,active:false,signature:''};
  }
  function renderFirstPass(state,task,stage){
    if(!firstPass)return;const p=firstPass,active=state.mode==='learn'&&task?.id==='diameter';
    if(active!==p.active){for(const {label,anchor} of p.moved)active?p.fields.append(label):anchor.after(label);p.active=active;}
    p.setup.dataset.firstPass=String(active);p.details.hidden=!active;p.coach.hidden=!active||stage!==1;
    if(!active){p.signature='';return;}
    const values=['tool','offset','feed','rpm'].map(id=>$(id).value),signature=JSON.stringify(values),changed=values[0]!=='turning'||Number(values[1])!==0||Number(values[2])!==.2||Number(values[3])!==800;
    p.summary.textContent=changed?'Остальные условия изменены — проверьте их':'Остальные условия уже заданы';
    p.coach.querySelector('strong').textContent=changed?'Проверьте изменённые условия':'Сейчас меняем только конечный X';
    p.coach.querySelector('p').textContent=changed?'Проверьте инструмент и режимы в раскрытом блоке. Затем задайте конечный X по чертежу и переходите к пробной обработке.':'Найдите нужный диаметр на чертеже и задайте его по X. Здесь X записывается по диаметру. Инструмент и режимы уже выбраны; полноценную наладку разберём позже.';
    if(signature!==p.signature&&changed)p.details.open=true;p.signature=signature;
  }
  function buildCatalog(){
    catalog.classList.add('machine-catalog');catalog.querySelector('.screen-heading h2').replaceWith(node('h1','Задания на станке')); catalog.querySelector('.screen-heading p').textContent='Выберите деталь, изучите чертёж, выполните проходы и подтвердите результат измерением.';
    hero=node('div',undefined,'machine-recommendation');catalog.querySelector('.screen-heading').after(hero);
    const controls=node('div',undefined,'machine-catalog-controls'),label=node('label','Найти задание','field');search=node('input');search.type='search';search.placeholder='Название, навык или поверхность';search.setAttribute('aria-label','Найти задание на станке');label.append(search);
    const selectLabel=node('label','Прогресс','field');filter=node('select');filter.setAttribute('aria-label','Прогресс заданий');for(const [value,text] of [['all','Все задания'],['pending','Требуют зачёта'],['passed','Зачтённые']]){const o=node('option',text);o.value=value;filter.append(o);}selectLabel.append(filter);const levelLabel=node('label','Сложность','field'),levelSelect=node('select');levelSelect.setAttribute('aria-label','Сложность заданий');for(const legacy of $('difficulty-bar').querySelectorAll('[data-level]')){const option=node('option',legacy.textContent);option.value=legacy.dataset.level;levelSelect.append(option);}levelSelect.addEventListener('change',()=>{$('difficulty-bar').querySelector('[data-level="'+levelSelect.value+'"]').click();});levelLabel.append(levelSelect);controls.append(label,levelLabel,selectLabel);hero.after(controls);search.addEventListener('input',renderCatalog);filter.addEventListener('change',renderCatalog);$('difficulty-bar').addEventListener('click',renderCatalog);
    count=node('p',undefined,'machine-result-count');count.setAttribute('role','status');$('difficulty-bar').after(count);empty=node('p','По этим условиям заданий нет. Измените поиск или фильтр.','machine-empty');empty.hidden=true;catalog.append(empty);
    for(const card of catalog.querySelectorAll('[data-task]')){const t=model.get(card.dataset.task),guide=window.CNCTaskGuides.get(t.id),label=card.children[1];label.classList.add('machine-card-heading');
      const illustration=node('span',undefined,'machine-card-illustration');illustration.innerHTML=graphics.svg(t.id,{thumbnail:true});illustration.setAttribute('aria-hidden','true');
      const spec=node('span',t.advanced?`Заготовка Ø${t.stock} × ${t.length} мм${t.bore?' · отверстие Ø'+t.bore:''}`:`Ø${t.stock} → Ø${t.target} · участок ${t.length} мм`,'machine-card-spec');
      const meta=node('span',`${model.surfaces(t.id).length} ${model.surfaces(t.id).length===1?'поверхность':'поверхности'} · контрольных точек: ${model.checkpoints(t.id).length}`,'machine-card-meta');
      const action=node('span','Открыть задание ↗','machine-card-action');card.append(illustration,spec,meta,action);card.querySelector('.catalog-task-summary').textContent=guide.learn;
    }
  }
  function renderCatalog(){
    if(!catalog)return;const complete=records(),activeLevel=$('difficulty-bar').querySelector('[aria-pressed=true]')?.dataset.level||'all',list=model.search({query:search.value,filter:filter.value,level:activeLevel},complete),ids=new Set(list.map(t=>t.id));
    for(const card of catalog.querySelectorAll('[data-task]')){card.hidden=!ids.has(card.dataset.task);const done=complete[card.dataset.task]?.controlVersion===1;card.querySelector('.lesson-done').textContent=done?'✓':complete[card.dataset.task]?'↻':'';card.querySelector('.machine-card-action').textContent=done?'Повторить задание ↗':path.stages[card.dataset.task]>0?'Продолжить попытку ↗':'Открыть задание ↗';}
    count.textContent=`Найдено заданий: ${list.length} из ${model.tasks.length}`;empty.hidden=!!list.length;
    const t=model.recommend(complete),done=Object.values(complete).filter(c=>c.controlVersion===1).length;
    hero.replaceChildren();const copy=node('div');copy.append(node('p',done===model.tasks.length?'Весь маршрут зачтён':'Рекомендуемое следующее задание','eyebrow'),node('h3',t.title),node('p',window.CNCTaskGuides.get(t.id).learn));hero.append(copy,button(done===model.tasks.length?'Открыть первый проход':'Открыть «'+t.title+'»',()=>open(t.id),'button primary'));
  }
  function buildBoard(host,id){
    const board=node('section',undefined,'machine-board');board.id=id;
    const tabs=node('div',undefined,'machine-view-tabs'),viewLabel=node('label','Вид детали'),viewSelect=node('select');viewSelect.setAttribute('aria-label','Вид детали');for(const [value,label] of [['drawing','Чертёж 2D'],['compare','Цель и заготовка'],['native','Осмотр 3D']]){const option=node('option',label);option.value=value;viewSelect.append(option);}viewSelect.addEventListener('change',()=>{view=viewSelect.value;activateNative();render();});viewLabel.append(viewSelect);tabs.append(viewLabel);const shapeLabel=node('label','Деталь в 3D'),shapeSelect=node('select');shapeSelect.setAttribute('aria-label','Деталь в 3D');for(const [value,label] of [['target','Целевая'],['result','Текущая заготовка']]){const option=node('option',label);option.value=value;shapeSelect.append(option);}shapeSelect.addEventListener('change',()=>{const advanced=snapshot().task.advanced,id=(advanced?'lab-':'basic-')+shapeSelect.value;if($(id).getAttribute('aria-pressed')!=='true')$(id).click();render();});shapeLabel.append(shapeSelect);tabs.append(shapeLabel);
    const chart=node('div',undefined,'machine-dimensioned'),caption=node('p',undefined,'machine-chart-caption'),surfaces=node('div',undefined,'machine-surface-tabs'),metrics=node('div',undefined,'machine-metrics'),probe=node('div',undefined,'machine-probe'),control=node('section',undefined,'machine-control-plan');surfaces.setAttribute('role','group');surfaces.setAttribute('aria-label','Поверхности детали');
    board.append(tabs,chart,caption,surfaces,metrics,probe,control);host.prepend(board);return {host,board,tabs,viewSelect,shapeLabel,shapeSelect,chart,caption,surfaces,metrics,probe,control,signature:''};
  }
  function activateNative(){const {task}=snapshot();if(!task||view!=='native')return;const stage=flow.stage(),select=id=>{if($(id).getAttribute('aria-pressed')!=='true')$(id).click();};if(task.advanced)select(stage<2?'lab-target':'lab-result');else{select(stage===2?'basic-2d':'basic-3d');select(stage<2?'basic-target':'basic-result');}}
  function selectMeasurement(point){const {task,data}=snapshot();if(!task||!data?.finished)return;selected=point.surface;if(flow.stage()!==3)flow.go(3);
    if(task.advanced){$('gauge-surface').value=point.surface;$('gauge-position').value=String(Math.round(point.fraction*100));$('gauge-surface').dispatchEvent(new Event('input',{bubbles:true}));$('gauge-position').dispatchEvent(new Event('input',{bubbles:true}));$('gauge-read').focus();$('measurement-panel').scrollIntoView({behavior:'smooth',block:'center'});}
    else{$('basic-gauge-surface').value='worked';$('basic-gauge-surface').dispatchEvent(new Event('change',{bubbles:true}));$('basic-measure').focus();$('basic-control').scrollIntoView({behavior:'smooth',block:'center'});}render();
  }
  function primary(){
    const {state,task,data}=snapshot();if(state.mode!=='learn'||!task||!data||document.body.dataset.screen!=='work')return null;
    const p=model.progress(task.id,data),stage=flow.stage();
    if(data.playing)return {text:'Пауза обработки',run:()=>$(task.advanced?'lab-finish':'run').click()};
    const guidedAction=window.CNCLearningUI?.action(stage,data);if(guidedAction)return guidedAction;
    if(stage===0)return {text:'Перейти к настройке',run:()=>flow.go(1)};
    if(stage===1)return {text:'К пробной обработке',run:()=>flow.go(2)};
    if(stage===2){if(data.finished)return {text:'Перейти к контролю',run:()=>flow.go(3)};if(task.advanced&&data.reached===data.total&&data.total&&data.cursor<data.reached)return {text:'Вернуться к последнему проходу',run:()=>window.CNCLabSession.latest()};return playMode==='auto'?{text:data.started?'Продолжить обработку':'Запустить обработку',run:()=>$(task.advanced?'lab-finish':'run').click()}:{text:task.advanced?'Выполнить следующий проход':'Следующий этап прохода',run:()=>$(task.advanced?'sim-step':'step').click()};}
    if(p.controlled){const next=model.recommend(records());return {text:Object.values(records()).filter(c=>c.controlVersion===1).length===7?'К списку заданий':'Открыть «'+next.title+'»',run:()=>Object.values(records()).filter(c=>c.controlVersion===1).length===model.tasks.length||next.id===task.id?flow.catalog():open(next.id)};}
    if(task.advanced&&data.reached===data.total&&data.total&&data.cursor<data.reached)return {text:'Показать готовую деталь',run:()=>window.CNCLabSession.latest()};
    if(!data.finished)return {text:'Сначала завершить обработку',run:()=>flow.go(2)};
    if(!data.result.success)return {text:task.advanced?'Исправить маршрут':'Исправить настройки',run:()=>flow.go(1)};
    if(!task.advanced){
      if(data.inspection&&!data.result.success)return {text:'Исправить настройки',run:()=>flow.go(1)};
      if(data.inspection?.expected==='uncertain')return {text:'Выбрать более точный прибор',run:()=>{$('basic-gauge-tool').focus();$('basic-control').scrollIntoView({behavior:'smooth',block:'center'});}};
      if(!data.measurement||data.measurement.surface!=='worked')return {text:'Измерить обработанный участок',run:()=>{$('basic-gauge-surface').value='worked';$('basic-gauge-surface').dispatchEvent(new Event('change',{bubbles:true}));$('basic-measure').click();}};
      return {text:data.verdict?'Подтвердить мой вывод':'Выберите вывод по замеру',disabled:!data.verdict,run:()=>$('basic-inspect').click()};
    }
    const pending=p.rows.find(row=>!row.done);
    if(pending){
      if(pending.observed?.correct&&['large','small'].includes(pending.observed.verdict))return {text:'Исправить маршрут после замера',run:()=>flow.go(1)};
      if(pending.observed?.correct&&pending.observed.verdict==='uncertain')return {text:'Выбрать более точный прибор',run:()=>{$('gauge-tool').focus();$('measurement-panel').scrollIntoView({behavior:'smooth',block:'center'});}};
      const m=data.measurement,s=model.surfaces(task.id).find(s=>s.id===pending.surface),same=m?.id===pending.surface&&(pending.zone==='middle'||pending.zone==='start'&&m.x<=s.start+s.length*.1+1e-8||pending.zone==='end'&&m.x>=s.start+s.length*.9-1e-8);
      if(same)return {text:$('gauge-verdict').value?'Записать мой вывод':'Выберите вывод по замеру',disabled:!$('gauge-verdict').value||$('gauge-record').disabled,run:()=>$('gauge-record').click()};
      if($('gauge-surface').value===pending.surface&&Math.abs(Number($('gauge-position').value)-pending.fraction*100)<1)return {text:'Измерить: '+pending.title,run:()=>$('gauge-read').click()};
      return {text:'Выбрать замер: '+pending.title,run:()=>selectMeasurement(pending)};
    }
    return {text:'Проверить маршрут',run:()=>{flow.go(1);$('lab-check').click();}};
  }
  function renderBoard(t,data,p,stage){
    const b=boards[t.advanced?'lab':'basic'];b.host.dataset.techActive=String(view!=='native');b.board.dataset.view=view;
    b.control.hidden=stage!==3;
    b.probe.hidden=!t.diagnosis||stage>1;
    if(!t.advanced)$('machine-title').textContent=stage===2&&view==='native'?'Наблюдение за проходом':'Чертёж и состояние детали';
    if(b.viewSelect.value!==view)b.viewSelect.value=view;b.viewSelect.querySelector('[value="native"]').textContent=stage===2?(t.advanced?'3D по проходам':'Наблюдать проход'):'Осмотр 3D';
    b.shapeLabel.hidden=view!=='native'||stage===2&&!t.advanced;b.shapeSelect.disabled=!!data.playing;const shape=$((t.advanced?'lab-':'basic-')+'target').getAttribute('aria-pressed')==='true'?'target':'result';if(b.shapeSelect.value!==shape)b.shapeSelect.value=shape;b.shapeSelect.querySelector('[value="result"]').textContent=!t.advanced&&stage<2?'По настройкам':'Текущая заготовка';
    b.chart.hidden=view==='native';b.caption.hidden=view==='native';
    const signature=JSON.stringify([t.id,data.profile,data.logs,data.measurement,data.inspection,data.finished,data.total,data.cursor,data.plan,selected,view,stage]);
    if(signature===b.signature)return;b.signature=signature;
    const focusKey=document.activeElement?.dataset.measureKey;
    const mx=data.measurement?(t.advanced?data.measurement.x:data.measurement.surface==='stock'?7.5:15+t.length/2):null,at=mx===null?null:model.sample(data.profile,mx),marker=at?{x:mx,diameter:data.measurement.kind==='inside'?at.bore:at.diameter}:null;
    b.chart.innerHTML=graphics.svg(t.id,{profile:data.profile,compare:view==='compare',selected,marker});
    b.caption.textContent=view==='compare'?`Синий пунктир — цель; серо-голубой контур — текущая заготовка. ${t.advanced?'Осмотр после прохода '+(data.cursor||0)+' из '+(data.total||0):data.finished?'После выполненного прохода':'Проход ещё не выполнен'}.`:'Целевая геометрия. Выберите поверхность, чтобы увидеть её размеры. Длины на схеме отсчитываются слева; это не программа координат.';
    const available=model.surfaces(t.id);b.surfaces.hidden=available.length<2||stage===3;
    // Keep the same native control while switching surfaces or updating the drawing.
    if(!b.surfaces.hidden){
      if(b.surfaces.dataset.task!==t.id){
        b.surfaces.replaceChildren();const label=node('label','Размеры поверхности'),select=node('select');select.setAttribute('aria-label','Размеры поверхности');
        for(const surface of available){const option=node('option',surface.title);option.value=surface.id;select.append(option);}
        select.addEventListener('change',()=>{selected=select.value;render();});label.append(select);b.surfaces.append(label);b.surfaceSelect=select;b.surfaces.dataset.task=t.id;
      }
      if(b.surfaceSelect.value!==selected)b.surfaceSelect.value=selected;
    }
    b.probe.replaceChildren();if(t.diagnosis&&stage<=1)b.probe.append(window.CNCTaskGuides.references(t));
    b.metrics.replaceChildren();const values=t.advanced? [['Заготовка','Ø'+t.stock+' × '+t.length],['Выполнено проходов',(data.reached||0)+' / '+(data.total||data.plan?.operations.reduce((n,o)=>n+(Number.isInteger(o.passes)?o.passes:0),0)||0)],['Контроль',p.measured+' / '+p.required]]:[['Заготовка','Ø'+t.stock],['Цель','Ø'+t.target+' ±0,1'],['Контроль',p.measured+' / '+p.required]];for(const [label,value] of values){const item=node('div');item.append(node('span',label),node('strong',value));b.metrics.append(item);}
    b.control.replaceChildren(node('h3','План контроля'),node('p',data.finished?'Зачёт требует свежих замеров и ваших выводов. Выберите точку, затем измерьте её прибором.':'После обработки нужно подтвердить эти точки. Просмотр чертежа и анимация не заменяют замеры.'));
    if(p.rows.length>1){const label=node('label','Точка контроля'),select=node('select'),placeholder=node('option','Выберите точку…');placeholder.value='';select.append(placeholder);select.setAttribute('aria-label','Точка контроля');for(const row of p.rows){const option=node('option',(row.done?'✓ ':'')+row.title);option.value=row.key;select.append(option);}const chosen=p.rows.find(row=>t.advanced&&$('gauge-surface').value===row.surface&&Math.abs(Number($('gauge-position').value)-row.fraction*100)<1);select.value=chosen?.key||'';select.disabled=!data.finished;select.addEventListener('change',()=>{const row=p.rows.find(row=>row.key===select.value);if(row)selectMeasurement(row);});label.append(select);b.control.append(label);}const list=node('ol');for(const row of p.rows){const item=node('li',undefined,row.done?'is-confirmed':''),description=node('div');description.append(node('strong',(row.done?'✓ ':'')+row.title),node('span','Цель Ø'+fmt(row.target)+' ±0,1 мм · '+(row.zone==='start'?'у начала, 5%':row.zone==='end'?'у конца, 95%':Math.round(row.fraction*100)+'% длины поверхности')));
      description.append(node('small',row.done?'Замер и вывод подтверждены':row.observed?(!data.finished?'Замер готовой детали сохранён · сейчас показан другой проход':'Есть замер '+fmt(row.observed.reading)+' мм · подтвердите корректный вывод'):'Замер ещё не подтверждён'));
      item.append(description);list.append(item);}b.control.append(list);
    if(focusKey)b.board.querySelector(`[data-measure-key="${focusKey}"]`)?.focus({preventScroll:true});
  }
  function render(){
    if(!flow)return;const screen=document.body.dataset.screen;if(screen==='catalog')renderCatalog();
    const {state,task,data}=snapshot();renderFirstPass(state,task,flow.stage());if(state.mode!=='learn'){for(const b of Object.values(boards)){b.board.hidden=true;b.host.dataset.techActive='false';}context.hidden=true;$('stage-next').hidden=true;return;}
    context.hidden=screen!=='work';if(screen!=='work'||!task||!data)return;
    const stage=flow.stage(),stamp=task.id+':'+stage;if(last!==stamp){last=stamp;view=stage===2?'native':stage===3?'compare':'drawing';if(!model.surfaces(task.id).some(s=>s.id===selected))selected=model.surfaces(task.id)[0].id;activateNative();}
    for(const b of Object.values(boards))b.board.hidden=false;
    const p=model.progress(task.id,data);contextCopy.textContent=p.status;attempt.textContent=records()[task.id]&&!p.controlled?'Предыдущий зачёт сохранён. Ниже — текущая попытка.':stage===1?'Проверьте инструмент, размеры и режимы. Новый ввод начинает попытку заново.':stage===2?'Следите за изменением заготовки. Для паузы и осмотра доступны шаги прохода.':stage===3?'Сначала прибор, затем показание, затем ваш вывод по допуску.':'От чертежа — к настройке, обработке и подтверждённому размеру.';
    const action=primary(),dock=docks[task.advanced?'lab':'basic'][stage];if($('stage-next').parentElement!==dock)dock.append($('stage-next'));$('stage-next').hidden=stage===3&&!p.controlled&&data.finished&&data.result.success;$('stage-next').className='button primary';if(action){$('stage-next').textContent=action.text;$('stage-next').disabled=!!action.disabled;}
    document.querySelectorAll('#workshop-steps button[data-stage]').forEach((button,i)=>{button.dataset.complete=String(p.stages[i]);const small=button.querySelector('.machine-stage-status');small.textContent=i===0?'Размеры и допуск':p.stages[i]?'Подтверждено':i===1?data.checked?'Проверено':'Настроить':i===2?data.started?'В процессе':'Выполнить':p.measured+' / '+p.required+' точек';});
    renderBoard(task,data,p,stage);
  }
  function mount(c,w,controller){catalog=c;work=w;flow=controller;buildCatalog();boards.basic=buildBoard(document.querySelector('.machine'),'basic-machine-board');boards.lab=buildBoard(document.querySelector('.lab-detail'),'lab-machine-board');
    context=node('div',undefined,'machine-attempt-bar');const text=node('div');contextCopy=node('strong');contextCopy.setAttribute('role','status');attempt=node('p');text.append(contextCopy,attempt);context.append(text);work.prepend(context);$('stage-back').hidden=true;for(const [kind,ids] of Object.entries({basic:['basic-assignment','basic-setup','basic-processing','basic-control'],lab:['lab-assignment','lab-setup','lab-processing','measurement-panel']})){docks[kind]=ids.map(id=>{const host=id==='basic-setup'?document.querySelector('.setup'):id==='lab-setup'?document.querySelector('.lab-plan'):$(id),dock=node('div',undefined,'machine-action-dock');host.append(dock);return dock;});}for(const id of ['basic-processing','lab-processing']){const label=node('label','Способ обработки','machine-play-mode'),select=node('select');select.setAttribute('aria-label','Способ обработки');for(const [value,text] of [['step','По шагам'],['auto','Автоматически']]){const option=node('option',text);option.value=value;select.append(option);}select.addEventListener('change',()=>{window.CNCDemo.pauseWorkshop();playMode=select.value;document.querySelectorAll('.machine-play-mode select').forEach(other=>other.value=playMode);render();});label.append(select);$(id).querySelector('.panel-heading').after(label);}
    for(const button of document.querySelectorAll('#workshop-steps button[data-stage]'))button.append(node('small',undefined,'machine-stage-status'));
    buildFirstPass();for(const name of ['click','input','change'])document.addEventListener(name,schedule);window.addEventListener('cnc-machine-change',schedule);render();
  }
  window.CNCMachineUI={progressSnapshot:()=>path,mount,render,saveStage,resumeStage:id=>path.stages[id]??0,primaryAction(){const action=primary();if(!action)return false;if(!action.disabled)action.run();schedule();return true;}};
})();
