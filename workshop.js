(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const q = selector => document.querySelector(selector);
  const make = (tag, cls, html='') => { const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e; };
  const main=q('main');
  let stage=0, screen='work', previousTask=null, previousMode=null;
  const names=['Задание','Настройка','Обработка','Контроль'];
  const descriptions=['Изучите размеры и осмотрите целевую деталь.','Выберите инструмент и задайте параметры.','Выполните проходы и осмотрите промежуточный результат.','Измерьте деталь и сравните размеры с допуском.'];

  // Keep the existing controllers and their form nodes: navigation never reloads a task.
  const navigation=make('nav','workshop-nav','<button type="button" id="catalog-open">Задания</button><button type="button" id="history-open">Результаты</button>');
  navigation.setAttribute('aria-label','Разделы мастерской');
  q('.learning-bar').insertBefore(navigation,$('learning-progress'));
  const catalog=make('section','catalog-screen','<div class="screen-heading"><div><h2>Выберите задание</h2><p>Семь упражнений: от первого прохода до наладки по замерам.</p></div><button type="button" class="button secondary" id="catalog-back">Вернуться к детали</button></div>');
  catalog.id='catalog-screen';catalog.append($('difficulty-bar'),q('.lessons'));main.insertBefore(catalog,$('exam-level-bar'));
  const work=make('div','work-screen');work.id='work-screen';catalog.after(work);
  const stepper=make('nav','workshop-steps',names.map((name,i)=>`<button type="button" data-stage="${i}"><span>${String(i+1).padStart(2,'0')}</span>${name}</button>`).join(''));
  stepper.setAttribute('aria-label','Этапы упражнения');stepper.id='workshop-steps';
  const stageIntro=make('div','stage-intro','<p id="stage-description"></p><span id="stage-count"></span>');stageIntro.id='stage-intro';
  work.append(stepper,stageIntro);
  for(const id of ['exam-level-bar','exam-banner','route-exam-results','exam-results','lab-workspace','workspace'])work.append($(id));
  const nextBar=make('div','stage-navigation','<button type="button" id="stage-back" class="button secondary">Назад</button><span>Настройки сохраняются при переходе между этапами</span><button type="button" id="stage-next" class="button primary"></button>');nextBar.id='stage-navigation';work.append(nextBar);
  const history=q('.history-panel');history.id='history-screen';
  const historyBack=make('button','button secondary','Вернуться к детали');historyBack.type='button';q('.history-panel .panel-heading').append(historyBack);
  q('.intro-copy').remove();
  q('.intro h1').textContent='Учебная мастерская';
  const status=make('div','workshop-status');status.append($('storage-note'));q('footer').append(status);

  function section(id,title){const e=make('section','stage-panel panel',`<div class="panel-heading"><h2>${title}</h2></div>`);e.id=id;return e;}
  function disclosure(id,label,nodes){const d=make('details','workshop-disclosure',`<summary>${label}</summary>`);d.id=id;for(const n of nodes)d.append(n);return d;}
  const lab=$('lab-workspace'),detail=q('.lab-detail'),plan=q('.lab-plan');
  const assignment=section('lab-assignment','Чертёж и требования');
  assignment.replaceChildren(q('.lab-detail .panel-heading'),$('lab-brief'),$('lab-stock'),$('lab-dimensions'));
  const labSide=make('div','workshop-side');labSide.id='lab-side';lab.append(labSide);labSide.append(assignment,plan);
  const processing=section('lab-processing','Выполнение маршрута');
  const runBox=make('div','process-primary');runBox.append($('lab-finish'));processing.append(runBox,$('simulation-controls'));labSide.append(processing,$('measurement-panel'));
  const labHelp=disclosure('lab-help','Нужна подсказка?',[q('.lab-hints')]);labSide.append(labHelp);
  const limitations=disclosure('lab-notes','Об учебной модели',[q('.lab-detail > .small-note')]);detail.append(limitations);
  const planNote=q('.plan-note'),planDetails=disclosure('plan-notes','Как составить маршрут',[]);planNote.before(planDetails);planDetails.append(planNote);
  const feedback=$('lab-feedback');labSide.append(feedback);
  const gaugeNote=q('#measurement-panel .small-note'),gaugeDetails=disclosure('gauge-notes','Точность приборов',[]);gaugeNote.before(gaugeDetails);gaugeDetails.append(gaugeNote);
  const gaugeLog=$('gauge-log'),journal=disclosure('gauge-journal','Журнал замеров',[]);gaugeLog.before(journal);journal.append(gaugeLog);
  $('gauge-read').classList.replace('secondary','primary');

  const basic=$('workspace'),setup=q('.setup'),machine=q('.machine');
  const basicSide=make('div','workshop-side');basicSide.id='basic-side';
  const brief=section('basic-assignment','Чертёж и требования');brief.append(q('.task-brief'));
  const basicProcess=section('basic-processing','Пробный проход');
  basicProcess.append($('runbar'),$('phase-list'),$('phase-description'),q('.progress-track'));
  const basicControl=section('basic-control','Измерение детали');basicControl.append($('basic-gauge'),$('readouts'));
  basicSide.append(brief,setup,basicProcess,basicControl,$('check-result'));
  const basicHelp=disclosure('basic-help','Спросить наставника',[$('mentor-panel')]);basicSide.append(basicHelp);
  const code=disclosure('basic-code','Учебная программа · G-код',[q('.code-panel')]);machine.append(code);
  basic.replaceChildren(machine,basicSide);
  $('basic-measure').classList.replace('secondary','primary');

  function pause(){window.CNCDemo.pauseWorkshop();}
  function setScreen(next){pause();screen=next;render();q('.intro h1').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function chooseStage(next){pause();stage=Math.max(0,Math.min(3,next));render();
    const state=window.CNCDemo.readState();if(state.mode==='exam')return;
    if(!$('lab-workspace').hidden)$(stage<2?'lab-target':'lab-result').click();
    else {$(stage===2?'basic-2d':'basic-3d').click();if(stage!==2)$(stage===3?'basic-result':'basic-target').click();}
    window.scrollTo({top:0,behavior:'instant'});
  }
  function render(){
    const state=window.CNCDemo.readState(),exam=state.mode==='exam';
    document.body.dataset.stage=String(stage);document.body.dataset.mode=state.mode;document.body.dataset.screen=screen;
    catalog.hidden=screen!=='catalog';work.hidden=screen!=='work';history.hidden=screen!=='history';
    for(const id of ['workshop-steps','stage-intro','stage-navigation'])$(id).hidden=exam;
    $('catalog-open').setAttribute('aria-current',screen==='catalog'?'page':'false');$('history-open').setAttribute('aria-current',screen==='history'?'page':'false');
    const currentTask=[...window.CNCModel.tasks,...window.CNCLabModel.tasks].find(t=>t.id===state.task);
    q('.intro h1').textContent=screen==='catalog'?'Задания':screen==='history'?'Результаты':exam?'Экзамен':currentTask?.title||'Учебная мастерская';
    stepper.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-current',i===stage?'step':'false');b.classList.toggle('selected',i===stage);});
    $('stage-description').textContent=descriptions[stage];$('stage-count').textContent=`Этап ${stage+1} из 4`;
    $('stage-next').textContent=['Настроить обработку','К обработке','К измерениям','Выбрать задание'][stage];
    $('stage-next').className='button '+(stage<2?'primary':'secondary');$('stage-back').hidden=stage===0;
    assignment.hidden=!exam&&stage!==0;plan.hidden=!exam&&stage!==1;processing.hidden=exam||stage!==2;
    // Parent panels use stage visibility; exam controllers retain authority over their own controls.
    $('measurement-panel').hidden=exam||stage!==3;labHelp.hidden=exam||stage===0;
    feedback.hidden=!exam&&stage===0;
    brief.hidden=!exam&&stage!==0;setup.hidden=!exam&&stage!==1;basicProcess.hidden=exam||stage!==2;basicControl.hidden=exam||stage!==3;
    $('check-result').hidden=!exam&&stage===0;basicHelp.hidden=exam||stage===0;
    code.hidden=stage===0&&!exam;
    if(!exam&&stage===0){$('basic-3d').click();$('basic-target').click();}
  }
  function sync(){
    const state=window.CNCDemo.readState();
    if(previousTask!==state.task||previousMode!==state.mode){stage=0;screen='work';previousTask=state.task;previousMode=state.mode;}
    if(state.mode==='exam')screen='work';
    render();
  }
  q('.intro h1').tabIndex=-1;
  stepper.addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)chooseStage(Number(b.dataset.stage));});
  $('stage-back').addEventListener('click',()=>chooseStage(stage-1));
  $('stage-next').addEventListener('click',()=>stage===3?setScreen('catalog'):chooseStage(stage+1));
  $('catalog-open').addEventListener('click',()=>{$('mode-learn').click();setScreen('catalog');});
  $('history-open').addEventListener('click',()=>setScreen('history'));
  $('catalog-back').addEventListener('click',()=>setScreen('work'));historyBack.addEventListener('click',()=>setScreen('work'));
  q('.lessons').addEventListener('click',e=>{if(e.target.closest('[data-task]')){stage=0;setScreen('work');chooseStage(0);}});
  for(const id of ['mode-learn','mode-exam'])$(id).addEventListener('click',()=>setScreen('work'));
  history.addEventListener('click',e=>{if(e.target.closest('.history-row button'))setScreen('work');});
  // Pause before a view change, retaining completed passes and all form values.
  window.CNCWorkshop={sync};sync();
})();
