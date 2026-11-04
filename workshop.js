(function () {
  'use strict';
  if(window.CNCProgressRecovery?.blocked)return;
  const $ = id => document.getElementById(id);
  const q = selector => document.querySelector(selector);
  const make = (tag, cls, html='') => { const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e; };
  const main=q('main');
  let stage=0, screen='work', previousTask=null, previousMode=null;
  const names=['Задание','Настройка','Обработка','Контроль'];
  const descriptions=['Изучите размеры и осмотрите целевую деталь.','Выберите инструмент и задайте параметры.','Выполните проходы и осмотрите промежуточный результат.','Измерьте деталь и сравните размеры с допуском.'];

  // Keep the existing controllers and their form nodes: navigation never reloads a task.
  const navigation=make('nav','workshop-nav','<button type="button" id="home-open">Мой курс</button><button type="button" id="catalog-open">На станке</button><button type="button" id="gcode-open">G-код</button><button type="button" id="sandbox-open">Мастерская</button><details class="practice-menu"><summary>Ещё</summary><div><button type="button" id="reference-open">Справочник</button><button type="button" id="history-open">Результаты</button><button type="button" id="pilot-open">Журнал проверки</button><button type="button" id="course-open">Все уроки</button><button type="button" id="skills-open">Навыки</button><button type="button" id="training-open">Практикум</button><button type="button" id="model-spec-open">Модель тренажёра</button></div></details>');
  navigation.setAttribute('aria-label','Разделы мастерской');
  const modeLabel=make('label','workshop-mode','Режим <select id="workshop-mode" aria-label="Режим тренажёра"><option value="learn">Обучение</option><option value="exam">Экзамен</option></select>');q('.mode-switch').before(modeLabel);q('.mode-switch').hidden=true;modeLabel.querySelector('select').addEventListener('change',e=>$(e.target.value==='exam'?'mode-exam':'mode-learn').click());
  const sidebar=make('aside','app-sidebar');
  sidebar.setAttribute('aria-label','Навигация и аккаунт');
  sidebar.append(q('.brand'),make('p','sidebar-label','УЧЕБНАЯ МАСТЕРСКАЯ'));
  navigation.insertBefore(navigation.querySelector('#reference-open'),navigation.querySelector('details'));
  const icons={
    'home-open':'M3 5h6a4 4 0 0 1 3 1 4 4 0 0 1 3-1h6v15h-6a4 4 0 0 0-3 1 4 4 0 0 0-3-1H3V5Zm9 1v15',
    'catalog-open':'m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v9',
    'gcode-open':'M7 3h8l5 5v13H5V3h2Zm8 0v6h5M9 13l-2 2 2 2m6-4 2 2-2 2',
    'sandbox-open':'M4 7h16v13H4V7Zm4-4v4m8-4v4M8 12h8m-8 4h5',
    'reference-open':'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm9 3a3 3 0 0 1 3-3h5v15h-5a3 3 0 0 0-3 2'
  };
  for(const [id,d] of Object.entries(icons))navigation.querySelector('#'+id).insertAdjacentHTML('afterbegin',`<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`);
  sidebar.append(navigation,make('div','sidebar-caption','От понимания станка<br>к самостоятельной работе.'));
  sidebar.append(make('div','sidebar-account','<span class="sidebar-avatar" aria-hidden="true">ЧП</span><div><strong>Ваша мастерская</strong><small>Локальная практика</small></div>'));
  main.id='main-content';main.tabIndex=-1;
  const skip=document.createElement('a');skip.className='skip-link';skip.href='#main-content';skip.textContent='Перейти к содержимому';
  document.body.prepend(skip,sidebar);
  navigation.addEventListener('keydown',event=>{const menu=navigation.querySelector('details');if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();event.stopPropagation();}});
  const extraMenu=navigation.querySelector('details');extraMenu.addEventListener('focusout',event=>{if(event.relatedTarget&&!extraMenu.contains(event.relatedTarget))extraMenu.open=false;});
  q('.topbar').prepend(make('div','shell-breadcrumb','<span>Учебная мастерская</span><span aria-hidden="true">/</span><strong id="shell-page-label">Мой курс</strong>'));
  const catalog=make('section','catalog-screen','<div class="screen-heading"><div><h2>Выберите задание</h2><p>Семь упражнений: от первого прохода до наладки по замерам.</p></div><button type="button" class="button secondary" id="catalog-back">Вернуться к детали</button></div>');
  catalog.id='catalog-screen';for(const card of document.querySelectorAll('[data-task]')){const guide=window.CNCTaskGuides.get(card.dataset.task);if(guide){const copy=make('span','catalog-task-summary');copy.textContent=guide.learn;card.append(copy);card.title=guide.level+': '+guide.why;}}catalog.append($('difficulty-bar'),q('.lessons'));main.insertBefore(catalog,$('exam-level-bar'));
  const work=make('div','work-screen');work.id='work-screen';catalog.after(work);
  const stepper=make('nav','workshop-steps',names.map((name,i)=>`<button type="button" data-stage="${i}"><span>${String(i+1).padStart(2,'0')}</span>${name}</button>`).join(''));
  stepper.setAttribute('aria-label','Этапы упражнения');stepper.id='workshop-steps';
  const stageIntro=make('div','stage-intro','<p id="stage-description"></p><span id="stage-count"></span>');stageIntro.id='stage-intro';
  work.append(stepper,stageIntro);
  for(const id of ['exam-level-bar','exam-banner','route-exam-results','exam-results','lab-workspace','workspace'])work.append($(id));
  const nextBar=make('div','stage-navigation','<button type="button" id="stage-back" class="button secondary">Назад</button><span>Настройки сохраняются при переходе между этапами</span><button type="button" id="stage-next" class="button primary"></button>');nextBar.id='stage-navigation';work.append(nextBar);
  const history=q('.history-panel');history.id='history-screen';
  const course=window.CNCCourseUI.mount(main,()=>{document.querySelector('[data-task="diameter"]').click();setScreen('work');chooseStage(0);});
  const skills=window.CNCSkillsUI.mount(main);
  const home=window.CNCHomeUI.mount(main,()=>window.CNCLearningUI.start());
  const training=window.CNCTrainingUI.mount(main);
  const reference=window.CNCLibraryUI.mount(main);
  const gcode=window.CNCGCodeUI.mount(main);
  const sandbox=window.CNCSandboxUI.mount(main);
  const progress=window.CNCProgressUI.mount(main);
  const pilot=window.CNCPilotUI.mount(main);
  const modelSpec=window.CNCModelSpecUI.mount(main);
  const historyBack=make('button','button secondary','Вернуться к детали');historyBack.type='button';q('.history-panel .panel-heading').append(historyBack);
  q('.intro-copy').remove();
  q('.intro h1').textContent='Учебная мастерская';
  const status=make('div','workshop-status');status.append($('storage-note'));q('footer').append(status);

  function section(id,title){const e=make('section','stage-panel panel',`<div class="panel-heading"><h2>${title}</h2></div>`);e.id=id;return e;}
  function disclosure(id,label,nodes){const d=make('details','workshop-disclosure',`<summary>${label}</summary>`);d.id=id;for(const n of nodes)d.append(n);return d;}
  const lab=$('lab-workspace'),detail=q('.lab-detail'),plan=q('.lab-plan');
  const assignment=section('lab-assignment','Чертёж и требования');
  assignment.replaceChildren(q('.lab-detail .panel-heading'),$('lab-brief'),$('lab-stock'),$('lab-dimensions'));
  for(const initialGuide of document.querySelectorAll('[data-lab-guide]'))assignment.append(initialGuide);
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
  const checkDetails=disclosure('basic-check-details','Проверка с подсказкой',[$('check')]);$('settings').append(checkDetails);
  const labCheckDetails=disclosure('lab-check-details','Проверка с подсказкой',[$('lab-check')]);plan.append(labCheckDetails);
  const resetBasic=disclosure('basic-restart-details','Начать заново',[$('reset')]);setup.append(resetBasic);
  const resetLab=disclosure('lab-restart-details','Начать заново',[$('lab-reset')]);plan.append(resetLab);
  const inspectSteps=disclosure('lab-passes-details','Осмотр выполненных проходов',[$('simulation-controls')]);processing.append(inspectSteps);


  function pause(){window.CNCDemo.pauseWorkshop();window.CNCSandboxUI?.pause();}
  function setScreen(next){pause();screen=next;try{localStorage.setItem('cnc-workspace-screen-v1',next);}catch{}render();const title=next==='sandbox'?sandbox.querySelector('h1'):next==='course'?course.querySelector('h1'):next==='home'?document.querySelector('.home-screen h1'):next==='catalog'?catalog.querySelector('h1'):next==='training'?(training.querySelector('.cycle-heading h1')||q('.intro h1')):q('.intro h1');title.tabIndex=-1;title.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function chooseStage(next){pause();stage=window.CNCLearningUI.capStage(Math.max(0,Math.min(3,next)));window.CNCMachineUI.saveStage(window.CNCDemo.readState().task,stage);render();
    const state=window.CNCDemo.readState();if(state.mode==='exam')return;
    if(!$('lab-workspace').hidden)$(stage<2?'lab-target':'lab-result').click();
    else {$(stage===2?'basic-2d':'basic-3d').click();if(stage!==2)$(stage===3?'basic-result':'basic-target').click();}
    window.scrollTo({top:0,behavior:'instant'});
  }
  function render(){
    const state=window.CNCDemo.readState(),exam=state.mode==='exam';
    document.body.dataset.stage=String(stage);document.body.dataset.mode=state.mode;document.body.dataset.screen=screen;
    catalog.hidden=screen!=='catalog';work.hidden=screen!=='work';history.hidden=screen!=='history';progress.hidden=screen!=='progress';if(screen==='progress')window.CNCProgressUI.render();
    sandbox.hidden=screen!=='sandbox';$('sandbox-open').setAttribute('aria-current',screen==='sandbox'?'page':'false');if(screen==='sandbox')window.CNCSandboxUI.render();
    modelSpec.hidden=screen!=='model-spec';$('model-spec-open').setAttribute('aria-current',screen==='model-spec'?'page':'false');
    pilot.hidden=screen!=='pilot';if(screen==='pilot')window.CNCPilotUI.render();
    home.hidden=screen!=='home';$('home-open').setAttribute('aria-current',['home','course'].includes(screen)?'page':'false');navigation.querySelector('details').dataset.active=String(['skills','training','reference','history','progress','pilot','model-spec'].includes(screen));if(screen==='home')window.CNCHomeUI.render();
    course.hidden=screen!=='course';$('course-open').setAttribute('aria-current',screen==='course'?'page':'false');
    training.hidden=screen!=='training';$('training-open').setAttribute('aria-current',screen==='training'?'page':'false');
    skills.hidden=screen!=='skills';$('skills-open').setAttribute('aria-current',screen==='skills'?'page':'false');
    reference.hidden=screen!=='reference';$('reference-open').setAttribute('aria-current',screen==='reference'?'page':'false');
    gcode.hidden=screen!=='gcode';$('gcode-open').setAttribute('aria-current',screen==='gcode'?'page':'false');
    for(const id of ['workshop-steps','stage-intro','stage-navigation'])$(id).hidden=exam;
    $('catalog-open').setAttribute('aria-current',['catalog','work'].includes(screen)?'page':'false');$('history-open').setAttribute('aria-current',['history','progress'].includes(screen)?'page':'false');$('pilot-open').setAttribute('aria-current',screen==='pilot'?'page':'false');
    $('workshop-mode').value=state.mode;modeLabel.hidden=screen!=='work';
    const currentTask=[...window.CNCModel.tasks,...window.CNCLabModel.tasks].find(t=>t.id===state.task);
    q('.intro h1').textContent=screen==='home'?'Мой курс':screen==='gcode'?'Учимся программировать ЧПУ':screen==='skills'?'Карта навыков':screen==='reference'?'Справочник':screen==='sandbox'?'Свободная мастерская':screen==='model-spec'?'Модель тренажёра':screen==='training'?(window.CNCLearningUI?.training()?(window.CNCLearningUI.training().independent?'Самостоятельная работа':'Полный цикл'):'Практикум'):screen==='course'?'ЧПУ с полного нуля':screen==='catalog'?'Задания':screen==='pilot'?'Проверка курса':screen==='progress'?'Мои результаты':screen==='history'?'Разборы экзаменов':exam?'Экзамен':currentTask?.title||'Учебная мастерская';
    $('shell-page-label').textContent=q('.intro h1').textContent;
    stepper.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-current',i===stage?'step':'false');b.classList.toggle('selected',i===stage);});
    $('stage-description').textContent=descriptions[stage];$('stage-count').textContent=`Этап ${stage+1} из 4`;
    $('stage-next').textContent=['Настроить обработку','К обработке','К измерениям','Выбрать задание'][stage];
    $('stage-next').className='button '+(stage<2?'primary':'secondary');$('stage-back').hidden=true;
    assignment.hidden=!exam&&stage!==0;plan.hidden=!exam&&stage!==1;processing.hidden=exam||stage!==2;
    // Parent panels use stage visibility; exam controllers retain authority over their own controls.
    $('measurement-panel').hidden=exam||stage!==3;labHelp.hidden=exam||stage===0;
    feedback.hidden=!exam&&stage===0;
    brief.hidden=!exam&&stage!==0;setup.hidden=!exam&&stage!==1;basicProcess.hidden=exam||stage!==2;basicControl.hidden=exam||stage!==3;
    $('check-result').hidden=!exam&&stage===0;basicHelp.hidden=exam||stage===0;
    code.hidden=stage===0&&!exam;
    window.CNCMachineUI.render();
    window.CNCLearningUI.render();
  }
  function sync(){
    const state=window.CNCDemo.readState();
    if(previousTask!==state.task||previousMode!==state.mode){stage=state.mode==='learn'?window.CNCMachineUI.resumeStage(state.task):0;screen='work';previousTask=state.task;previousMode=state.mode;}
    if(state.mode==='exam')screen='work';
    render();
  }
  q('.intro h1').tabIndex=-1;
  stepper.addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)chooseStage(Number(b.dataset.stage));});
  $('stage-back').addEventListener('click',()=>chooseStage(stage-1));
  $('stage-next').addEventListener('click',()=>{if(!window.CNCMachineUI.primaryAction())stage===3?setScreen('catalog'):chooseStage(stage+1);});
  $('catalog-open').addEventListener('click',()=>{$('mode-learn').click();setScreen('catalog');});
  $('home-open').addEventListener('click',()=>{$('mode-learn').click();setScreen('home');});
  q('.brand').addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();$('home-open').click();
  });
  navigation.addEventListener('click',e=>{if(e.target.closest('button'))navigation.querySelector('details').open=false;});
  navigation.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.id!=='home-open')window.CNCLearningUI.deactivate();},true);
  $('course-open').addEventListener('click',()=>{$('mode-learn').click();window.CNCCourseUI.render();setScreen('course');});
  $('skills-open').addEventListener('click',()=>{$('mode-learn').click();window.CNCSkillsUI.render();setScreen('skills');});
  $('training-open').addEventListener('click',()=>{$('mode-learn').click();window.CNCTrainingUI.render();setScreen('training');});
  $('gcode-open').addEventListener('click',()=>{$('mode-learn').click();window.CNCGCodeUI.render();setScreen('gcode');});
  $('reference-open').addEventListener('click',()=>{$('mode-learn').click();window.CNCLibraryUI.render();setScreen('reference');});
  $('history-open').addEventListener('click',()=>setScreen('progress'));
  $('pilot-open').addEventListener('click',()=>setScreen('pilot'));
  $('sandbox-open').addEventListener('click',()=>{$('mode-learn').click();setScreen('sandbox');});
  $('model-spec-open').addEventListener('click',()=>{$('mode-learn').click();window.CNCModelSpecUI.render();setScreen('model-spec');});
  $('catalog-back').addEventListener('click',()=>setScreen('work'));historyBack.addEventListener('click',()=>setScreen('work'));
  q('.lessons').addEventListener('click',e=>{const card=e.target.closest('[data-task]');if(card){stage=window.CNCMachineUI.resumeStage(card.dataset.task);setScreen('work');chooseStage(stage);}});
  for(const id of ['mode-learn','mode-exam'])$(id).addEventListener('click',()=>setScreen('work'));
  history.addEventListener('click',e=>{if(e.target.closest('.history-row button'))setScreen('work');});
  // Pause before a view change, retaining completed passes and all form values.
  window.CNCMachineUI.mount(catalog,work,{stage:()=>stage,go:chooseStage,catalog:()=>setScreen('catalog')});
  window.CNCWorkshop={sync,goStage:chooseStage,results(){setScreen('progress');},pilot(){setScreen('pilot');},examHistory(){setScreen('history');},home(){ $('mode-learn').click();setScreen('home'); },
    openPractice(id,startStage=0,guided=false){if(!guided)window.CNCLearningUI.deactivate();window.CNCDemo.openPractice(id,guided);setScreen('work');
      const s=window.CNCDemo.machineSnapshot();chooseStage(startStage===3&&!s?.finished?2:startStage);
      if(guided&&!s?.measurement){$('basic-gauge-surface').value='worked';$('basic-gauge-tool').value='micrometer';}},
    openGCode(id,guided=false){if(!guided)window.CNCLearningUI.deactivate();$('mode-learn').click();setScreen('gcode');window.CNCGCodeUI.open(id,guided);window.CNCLearningUI.render();},
    openTraining(id,guided=false){if(!guided)window.CNCLearningUI.deactivate();$('mode-learn').click();window.CNCTrainingUI.open(id,guided);setScreen('training');window.CNCLearningUI.render();},
    openReference(id){$('mode-learn').click();setScreen('reference');window.CNCLibraryUI.openArticle(id);},
    openLesson(id,guided=false){if(!guided)window.CNCLearningUI.deactivate();$('mode-learn').click();setScreen('course');window.CNCCourseUI.openLesson(id);window.CNCLearningUI.render();}};
  window.CNCLearningUI.mount(main);window.CNCCourseUI.render();window.CNCTrainingUI.render();window.CNCGCodeUI.render();sync();
  if(window.CNCDemo.readState().mode==='learn'){
    let remembered=null;try{remembered=localStorage.getItem('cnc-workspace-screen-v1');}catch{}
    let introduced=false;try{introduced=localStorage.getItem('cnc-graphite-layout-v1')==='seen';localStorage.setItem('cnc-graphite-layout-v1','seen');}catch{}
    if(introduced&&['home','course','gcode','skills','training','reference','catalog','work','history','progress','pilot','model-spec','sandbox'].includes(remembered))setScreen(remembered);
    else setScreen('home');
    if(screen==='course')window.CNCLearningUI.restoreCourse();
  }
})();
