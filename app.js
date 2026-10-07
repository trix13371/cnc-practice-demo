(function () {
  'use strict';
  const $ = id => document.getElementById(id), model = window.CNCModel;
  const allTasks=[...model.tasks.map(t=>({...t,level:'easy'})),...window.CNCLabModel.tasks.map(t=>({...t,advanced:true}))];
  const basicViewer=new window.PartViewer($('basic-viewer'));let basicView='2d',basicShape='target';
  window.CNCLabUI.init((id,help)=>{const prev=completed[id];completed[id]={at:new Date().toISOString(),assisted:prev?.assisted===false?false:help};updateProgress();save();});
  const fields = ['x','offset','feed','rpm','tool'], storageKey = 'cnc-practice-v2';
  let task = model.tasks[0], mode = 'learn', hintLevel = 0, assisted = false;
  let completed = {}, history = [], exam = null, examDraft = null, report = null, trainingTask = 'diameter';
  let animation = null, playing = false, pass = null, part = 0, lastResult = null, saveAvailable = true;
  const fmt = (v,n=1) => Number.isFinite(v) ? v.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n}) : '—';
  const el = (tag,text,className) => { const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e; };
  function values() { const p={tool:$('tool').value};for(const k of fields.slice(0,4))p[k]=$(k).value.trim()===''?NaN:Number($(k).value);return p; }
  function setValues(p) { for(const k of fields)$(k).value=p[k]; }
  function save() {
    if(mode==='exam'&&exam&&!exam.awaitingNext)examDraft=values();
    try { localStorage.setItem(storageKey,JSON.stringify({version:2,completed,history,exam,examDraft,mode,trainingTask,draft:values(),assisted,hintLevel})); }
    catch { saveAvailable=false; }
    $('storage-note').textContent=saveAvailable?'Прогресс хранится в этом браузере':'Хранилище недоступно: результаты сохраняются только до закрытия страницы';
  }
  function restore() {
    try {
      const s=JSON.parse(localStorage.getItem(storageKey)||'null');if(!s||s.version!==2)return null;
      for(const t of allTasks){const c=s.completed?.[t.id];if(c&&typeof c.assisted==='boolean'&&Number.isFinite(Date.parse(c.at)))completed[t.id]={assisted:c.assisted,at:c.at};}
      history=Array.isArray(s.history)?s.history.map(model.restoreExam).filter(e=>e&&e.answers.length===3).slice(0,10):[];
      exam=model.restoreExam(s.exam);if(exam?.answers.length===3){if(!history.some(h=>h.startedAt===exam.startedAt))history.unshift(exam);exam=null;}
      if(allTasks.some(t=>t.id===s.trainingTask))trainingTask=s.trainingTask;
      mode=s.mode==='exam'?'exam':'learn';
      if(exam&&model.evaluate(s.examDraft||{},model.examTask(exam)).valid)examDraft=s.examDraft;
      return {values:s.draft,assisted:s.assisted===true,hintLevel:Number.isInteger(s.hintLevel)?Math.max(0,Math.min(3,s.hintLevel)):0};
    } catch { return null; }
  }
  function cancel() { if(animation!==null)cancelAnimationFrame(animation);animation=null;playing=false;pass=null;part=0; }
  function lock() {
    const locked=!!pass||(mode==='exam'&&!!exam?.awaitingNext);
    fields.forEach(k=>$(k).disabled=locked);$('check').disabled=!!pass;
    $('run').textContent=playing?'Ⅱ Пауза':pass?'▶ Продолжить':'▶ Пробный проход';
    $('step').disabled=playing;$('submit-answer').disabled=!!exam?.awaitingNext;
  }
  function updateProgress() {
    $('learning-progress').textContent=`Освоено: ${Object.keys(completed).length} из ${allTasks.length}`;
    document.querySelectorAll('[data-task]').forEach(b=>{const active=b.dataset.task===task.id,spec=allTasks.find(t=>t.id===b.dataset.task);b.dataset.difficulty=spec.level;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));const c=completed[b.dataset.task];b.querySelector('.lesson-done').textContent=c?'✓':'';b.querySelector('small').textContent=({easy:'Лёгкий',medium:'Средний',hard:'Сложный'}[spec.level])+' · '+(c?(c.assisted?'с помощью':'самостоятельно'):{diameter:'диаметр',offset:'коррекция',feed:'режим',shoulder:'проходы',sleeve:'расточка',taper:'маршрут',calibration:'диагностика'}[b.dataset.task]);});
  }
  function geometry(r,progress=0) {
    const scale=96/task.stock,actual=r.valid?Math.max(.5,Math.min(60,r.actual)):task.stock;
    const radius=actual*scale/2,cutY=160-radius,targetR=task.target*scale/2,safeY=160-36*scale/2;
    $('target-outline').setAttribute('d',`M260 ${160-targetR}H589M260 ${160+targetR}H589`);
    $('target-label').textContent=`Цель Ø${task.target} мм`;$('length-label').textContent=`${task.length} мм`;$('z-label').textContent=`Z = −${task.length}`;
    $('drawing-desc').textContent=`Заготовка Ø${task.stock} мм. Целевой диаметр ${task.target} мм на участке ${task.length} мм. Резец движется справа налево.`;
    $('trajectory').setAttribute('d',`M680 ${safeY}H630V${cutY}H260V${safeY}`);
    let tx=680,ty=safeY;
    if(progress<=.15)tx=680-50*progress/.15;
    else if(progress<=.30){tx=630;ty=safeY+(cutY-safeY)*(progress-.15)/.15;}
    else if(progress<=.90){tx=630-370*(progress-.30)/.60;ty=cutY;}
    else{tx=260;ty=cutY+(safeY-cutY)*(progress-.90)/.10;}
    $('tool-shape').setAttribute('transform',`translate(${tx} ${ty})`);
    const cutFrom=Math.max(260,Math.min(589,progress>.90?260:tx));
    const cutting=progress>.30&&actual<task.stock;
    $('stock').setAttribute('width',String(cutting?cutFrom-151:438));
    $('cut-profile').setAttribute('d',cutting?`M${cutFrom} ${cutY}H589V${160+radius}H${cutFrom}Z`:'');
    $('progress-value').innerHTML=Math.round(progress*100)+' <small>%</small>';$('progress-fill').style.width=(progress*100)+'%';
    document.querySelector('.progress-track').setAttribute('aria-valuenow',String(Math.round(progress*100)));
    const phase=progress===0?-1:model.phaseAt(Math.max(0,progress-1e-6));
    document.querySelectorAll('.phase-list li').forEach((li,i)=>{li.classList.toggle('current',i===phase);li.classList.toggle('done',progress>=model.phases[i].end);});
    document.querySelectorAll('#gcode .code-line').forEach((line,i)=>line.classList.toggle('active-line',phase>=0&&i===model.phases[phase].code));
  }
  function program(p) {
    const lines=model.evaluate(p,task).valid?[
      '; X — диаметр, подача — мм/об',`T${p.tool==='turning'?'0101':'0202'}`,'G21 G18 G90 G95',`G97 S${p.rpm} M03`,
      'G00 X36 Z5',`G01 X${p.x} F${p.feed}`,`G01 Z-${task.length}`,'G00 X36','M05',`; Коррекция X: ${p.offset} мм`
    ]:['Введите допустимые числовые настройки.'];
    // Approach remains outside the largest stock used in the exercises (Ø34).
    $('gcode').replaceChildren(...lines.map(line=>el('span',line,'code-line')));
  }
  function clearFeedback() { $('check-result').className='check-result';$('check-result').textContent=mode==='exam'?'Ответ будет проверен после завершения экзамена.':'Настройки ещё не проверены'; }
  function settingsChanged(persist=true) {
    if(task.advanced)return;
    const p=values(),r=model.evaluate(p,task);lastResult=r;part=0;
    $('actual').innerHTML=fmt(r.finalDiameter)+' <small>мм</small>';$('depth').innerHTML=fmt(r.depth)+' <small>мм</small>';
    program(p);geometry(mode==='exam'?model.evaluate({...task.defaults,x:task.stock,offset:0},task):r);clearFeedback();
    $('machine-status').textContent=mode==='exam'?'Экзамен':'Ожидание';$('machine-status').className='machine-status';
    $('phase-description').textContent='Нажмите «Следующий шаг», чтобы разобрать движение резца.';
    lock();updateBasicViewer();if(persist)save();
  }
  function updateBasicViewer(){if(task.advanced)return;const r=model.evaluate(values(),task),diameter=basicShape==='target'?task.target:(r.finalDiameter||task.stock);basicViewer.set({segments:[{length:15,diameter:task.stock},{length:task.length,diameter}],bore:0},basicShape==='target'?'Целевая деталь':'Геометрия по настройкам');}
  function renderBasicView(){const visible=mode==='learn'&&basicView==='3d';$('basic-3d-panel').hidden=!visible;document.querySelector('.drawing').hidden=visible;document.querySelector('.view-toolbar').hidden=visible;document.querySelector('.legend').hidden=visible;$('basic-2d').setAttribute('aria-pressed',String(!visible));$('basic-3d').setAttribute('aria-pressed',String(visible));if(visible)updateBasicViewer();}
  function loadTask(nextTask,persist=true) {
    if(nextTask.advanced){cancel();task=nextTask;window.CNCLabUI.open(task);updateProgress();renderMode();if(persist)save();return;}
    cancel();task=nextTask;hintLevel=0;assisted=false;setValues(task.defaults);
    $('goal').textContent=task.goal;$('description').textContent=task.description;
    $('stock-tag').textContent=`Заготовка Ø${task.stock}`;$('target-tag').textContent=`Цель Ø${task.target} ±0,1`;$('length-tag').textContent=`Длина ${task.length} мм`;
    $('hint-count').textContent='0 / 3';$('hint').disabled=false;$('mentor-answer').textContent='Попробуйте настроить проход самостоятельно. Если застрянете, откройте первую подсказку.';
    settingsChanged(false);updateProgress();renderMode();if(persist)save();
  }
  function feedback(r,finished=false) {
    const box=$('check-result');box.className='check-result '+(r.success?'success':'error');box.replaceChildren();
    box.append(el('div',r.success?(finished?'✓ Упражнение выполнено':'✓ Настройки соответствуют заданию'):'Есть ошибки в настройках','result-title'));
    if(r.success)box.append(el('p',finished?`Получен Ø${fmt(r.finalDiameter)} мм. ${assisted?'Пройдено с помощью подсказок.':'Пройдено самостоятельно.'}`:'Выполните проход полностью, чтобы закрепить результат.'));
    for(const issue of r.errors){const block=el('div','','issue');block.append(el('b',issue.title),el('p',issue.detail));box.append(block);}
  }
  function check() {
    if(mode!=='learn')throw new Error('Проверка доступна только в обучении');
    if(task.advanced)return window.CNCLabUI.check();
    if(pass)throw new Error('Сначала завершите или сбросьте проход');
    assisted=true;const r=model.evaluate(values(),task);lastResult=r;feedback(r);$('mentor-answer').textContent=model.mentor(values(),'Что исправить?',true,task);save();return r;
  }
  function preparePass() {
    if(mode!=='learn')return false;
    if(pass)return true;
    const p=values(),r=model.evaluate(p,task);lastResult=r;
    if(!r.valid||!r.canAnimate){assisted=true;feedback(r);$('machine-status').textContent='Проход заблокирован';return false;}
    part=0;pass={p,r};$('run-note').textContent='Анимация ускорена. На паузе можно перейти к следующему этапу.';lock();return true;
  }
  function finishPass() {
    const r=pass.r,p=pass.p;playing=false;pass=null;animation=null;part=1;
    feedback(r,true);$('machine-status').textContent=r.success?'Готово':'Проход с ошибками';
    $('phase-description').textContent='Проход завершён. Каждый новый запуск использует исходную заготовку.';
    if(r.success){const prev=completed[task.id];completed[task.id]={at:new Date().toISOString(),assisted:prev?.assisted===false?false:assisted};updateProgress();}
    $('mentor-answer').textContent=r.success?'Проход завершён. Выберите следующее упражнение или проверьте себя в экзамене.':model.mentor(p,'Что исправить?',true,task);
    if(!r.success)assisted=true;lock();save();
  }
  function pause() { if(animation!==null)cancelAnimationFrame(animation);animation=null;playing=false;$('machine-status').textContent='Пауза';lock(); }
  function run() {
    if(playing){pause();return;}
    if(!preparePass())return;playing=true;lock();$('machine-status').textContent='Выполняется';
    const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?700:6500;
    let prior=null,currentPhase=-1;
    function tick(now){if(!playing||!pass)return;if(prior!==null)part=Math.min(1,part+(now-prior)/duration);prior=now;geometry(pass.r,part);
      const i=model.phaseAt(part);if(i!==currentPhase){currentPhase=i;$('phase-description').textContent=model.phases[i].detail;}
      if(part>=1){finishPass();return;}animation=requestAnimationFrame(tick);}
    animation=requestAnimationFrame(tick);
  }
  function step() {
    if(playing||!preparePass())return;
    const next=model.phases.find(p=>p.end>part+1e-9);if(!next)return;
    part=next.end;geometry(pass.r,part);$('phase-description').textContent=next.detail;$('machine-status').textContent='Пауза';
    if(part>=1)finishPass();else lock();
  }
  function ask(q) { if(mode!=='learn')return;assisted=true;$('mentor-answer').textContent=model.mentor(values(),q,false,task);save(); }
  function renderMode() {
    const isExam=mode==='exam',active=isExam&&!!exam;
    $('mode-learn').setAttribute('aria-pressed',String(!isExam));$('mode-exam').setAttribute('aria-pressed',String(isExam));
    document.querySelector('.lessons').hidden=isExam;$('exam-banner').hidden=!isExam;
    $('difficulty-bar').hidden=isExam;$('lab-workspace').hidden=isExam||!task.advanced;
    $('workspace').hidden=(isExam&&!active)||(!isExam&&!!task.advanced);$('exam-results').hidden=!isExam||!report||!!exam;
    $('exam-start').hidden=active;$('exam-start').textContent=report?'Повторить экзамен':'Начать экзамен';
    $('exam-counter').hidden=!active;$('exam-counter').textContent=active?`Задание ${exam.index+1} из 3`:'';
    $('exam-title').textContent=active?'Базовый экзамен идёт':'Базовый экзамен: 3 лёгких задания';
    $('check').hidden=isExam;$('submit-answer').hidden=!active||exam.awaitingNext;$('next-question').hidden=!active||!exam.awaitingNext;
    for(const id of ['runbar','readouts','phase-list','phase-description','mentor-panel'])$(id).hidden=isExam;
    $('trajectory').style.visibility=isExam?'hidden':'visible';
    document.querySelector('.bottom-grid').classList.toggle('exam-code',isExam);
    $('machine-title').textContent=isExam?'Схема задания':'Пробный проход';
    $('basic-view-switch').hidden=isExam;renderBasicView();lock();
  }
  function showAccepted() {
    $('check-result').className='check-result';$('check-result').textContent='Ответ сохранён. Разбор будет доступен после третьего задания.';lock();
  }
  function changeMode(next) {
    if(next===mode)return;if(mode==='exam'&&exam&&!exam.awaitingNext)examDraft=values();cancel();mode=next;
    if(mode==='learn')loadTask(allTasks.find(t=>t.id===trainingTask),false);
    else if(exam){loadTask(model.examTask(exam),false);if(examDraft&&model.evaluate(examDraft,task).valid){setValues(examDraft);settingsChanged(false);}if(exam.awaitingNext){setValues(exam.answers[exam.index].settings);program(values());showAccepted();}}
    renderMode();save();
  }
  function startExam() {
    cancel();exam=model.createExam(history.length%3);examDraft=null;report=null;loadTask(model.examTask(exam),false);renderMode();renderHistory();save();
  }
  function submit() {
    if(mode!=='exam'||!exam||exam.awaitingNext)return;
    try { exam=model.submitExam(exam,values()); }
    catch(error){$('check-result').className='check-result error';$('check-result').textContent=error.message;return;}
    if(exam.answers.length===3){history.unshift(exam);history=history.slice(0,10);report=exam;exam=null;renderReport();renderHistory();}
    else showAccepted();
    renderMode();save();
  }
  function nextQuestion() { if(!exam)return;exam=model.advanceExam(exam);examDraft=null;loadTask(model.examTask(exam),false);renderMode();save(); }
  function renderReport() {
    if(!report)return;const g=model.gradeExam(report);
    $('exam-summary').replaceChildren(el('strong',`${g.correct} / ${g.total}`),el('p',`${g.percent}% заданий выполнено верно. ${g.correct===3?'Все условия соблюдены.':'Разберите ошибки и повторите соответствующие упражнения.'}`));
    const review=$('exam-review');review.replaceChildren();
    g.answers.forEach((a,i)=>{const row=el('article','','review-row');row.append(el('h3',`${i+1}. ${a.task.title} · ${a.result.success?'верно':'есть ошибки'}`));
      row.append(el('p',`Цель Ø${a.task.target}. Ваш ответ: X ${a.settings.x}, коррекция ${a.settings.offset}, подача ${a.settings.feed}, обороты ${a.settings.rpm}.`));
      if(!a.result.success){for(const issue of a.result.errors)row.append(el('p',issue.title+'. '+issue.detail,'review-error'));
        const b=el('button','Повторить тему','button secondary');b.type='button';b.addEventListener('click',()=>{trainingTask=a.task.id;changeMode('learn');loadTask(model.tasks[i]);});row.append(b);}
      review.append(row);});
  }
  function renderHistory() {
    const list=$('history-list');list.replaceChildren();
    if(!history.length){list.append(el('p','Здесь появятся завершённые экзамены.'));return;}
    history.forEach(h=>{const grade=model.gradeExam(h),row=el('div','','history-row');
      row.append(el('span',new Date(h.startedAt).toLocaleString('ru-RU')),el('strong',`${grade.correct} / 3 · ${grade.percent}%`));
      const b=el('button','Разбор','button secondary');b.type='button';b.disabled=!!exam;b.addEventListener('click',()=>{cancel();mode='exam';report=h;renderReport();renderMode();save();$('exam-results').scrollIntoView({behavior:'auto',block:'start'});});row.append(b);list.append(row);});
  }
  function exportReport() {
    if(!report)return;const g=model.gradeExam(report),lines=['ЧПУ Практика — результат самопроверки',new Date(report.startedAt).toLocaleString('ru-RU'),`Верно: ${g.correct} из 3 (${g.percent}%)`,''];
    g.answers.forEach((a,i)=>{lines.push(`${i+1}. ${a.task.title}`,`Цель: Ø${a.task.target} мм. X: ${a.settings.x}; коррекция: ${a.settings.offset}; подача: ${a.settings.feed}; обороты: ${a.settings.rpm}; инструмент: ${a.settings.tool}.`,a.result.success?'Выполнено верно.':a.result.errors.map(e=>e.title+': '+e.detail).join('\n'),'');});
    const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\n')],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='cnc-exam-report.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>{if(mode!=='learn')return;trainingTask=b.dataset.task;loadTask(allTasks.find(t=>t.id===trainingTask));}));
  document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{const level=b.dataset.level;document.querySelectorAll('[data-level]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));document.querySelectorAll('[data-task]').forEach(n=>n.hidden=level!=='all'&&n.dataset.difficulty!==level);}));
  for(const v of ['2d','3d'])$('basic-'+v).addEventListener('click',()=>{basicView=v;renderBasicView();});
  for(const v of ['target','result'])$('basic-'+v).addEventListener('click',()=>{basicShape=v;$('basic-target').setAttribute('aria-pressed',String(v==='target'));$('basic-result').setAttribute('aria-pressed',String(v==='result'));updateBasicViewer();});
  fields.forEach(k=>$(k).addEventListener('input',()=>{if(!pass)settingsChanged();}));
  $('settings').addEventListener('submit',e=>{e.preventDefault();if(mode==='learn'&&!pass)check();});
  $('run').addEventListener('click',run);$('step').addEventListener('click',step);$('reset').addEventListener('click',()=>loadTask(task));
  $('hint').addEventListener('click',()=>{if(mode!=='learn')return;assisted=true;$('mentor-answer').textContent=task.hints[Math.min(hintLevel,2)];hintLevel=Math.min(3,hintLevel+1);$('hint-count').textContent=hintLevel+' / 3';$('hint').disabled=hintLevel===3;save();});
  document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.question)));
  $('mentor-form').addEventListener('submit',e=>{e.preventDefault();const q=$('question').value.trim();if(q){ask(q);$('question').value='';}});
  $('mode-learn').addEventListener('click',()=>changeMode('learn'));$('mode-exam').addEventListener('click',()=>changeMode('exam'));
  $('exam-start').addEventListener('click',startExam);$('submit-answer').addEventListener('click',submit);$('next-question').addEventListener('click',nextQuestion);$('export-report').addEventListener('click',exportReport);
  const draft=restore();report=history[0]||null;
  loadTask(mode==='exam'&&exam?model.examTask(exam):allTasks.find(t=>t.id===trainingTask),false);
  if(!task.advanced&&draft?.values&&model.evaluate(draft.values,task).valid){setValues(draft.values);settingsChanged(false);}
  if(!task.advanced&&mode==='learn'&&draft){assisted=draft.assisted;hintLevel=draft.hintLevel;$('hint-count').textContent=hintLevel+' / 3';$('hint').disabled=hintLevel===3;if(hintLevel)$('mentor-answer').textContent=task.hints[hintLevel-1];}
  if(mode==='exam'&&exam?.awaitingNext){setValues(exam.answers[exam.index].settings);program(values());showAccepted();}
  renderHistory();renderReport();renderMode();
  function readState(){return {mode,task:task.id,settings:task.advanced?window.CNCLabUI.readState():values(),running:playing,paused:!!pass&&!playing,progress:part,completed:Object.keys(completed),exam:exam?{index:exam.index,submitted:exam.answers.length,awaitingNext:exam.awaitingNext}:null,result:mode==='learn'&&!task.advanced?lastResult:null};}
  window.CNCDemo={readState};
  const context=document.modelContext;
  if(context?.registerTool){const lifecycle=new AbortController();const empty=input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected empty object');};
    const specs=[
      {name:'read_cnc_training_state',description:'Read visible exercise state. Exam feedback is withheld until final submission.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){empty(input);return readState();}},
      {name:'configure_cnc_training',description:'Set training parameters. Available only in learning mode, not during an exam or pass.',inputSchema:{type:'object',properties:{task:{type:'string',enum:['diameter','offset','feed']},x:{type:'number',minimum:1,maximum:60},offset:{type:'number',minimum:-10,maximum:10},feed:{type:'number',minimum:.01,maximum:1},rpm:{type:'number',minimum:100,maximum:2000},tool:{type:'string',enum:['turning','drill']}},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(mode!=='learn'||pass)throw new Error('Only idle learning mode permits configuration');if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['task',...fields].includes(k)))throw new Error('Invalid settings');const selected=input.task?model.tasks.find(t=>t.id===input.task):task;if(!selected||selected.advanced)throw new Error('Use the operation cards for this task');const p={...(input.task?selected.defaults:values()),...input};if(!model.evaluate(p,selected).valid)throw new Error('Invalid values');if(input.task){trainingTask=selected.id;loadTask(selected,false);}setValues(p);settingsChanged();return readState();}},
      {name:'check_cnc_training_settings',description:'Check current learning parameters and reveal hints. Unavailable in exam mode.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){empty(input);return check();}}
    ];for(const spec of specs){try{Promise.resolve(context.registerTool(spec,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
