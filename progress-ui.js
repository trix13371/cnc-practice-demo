(function(){
  'use strict';
  const model=window.CNCProgress,config=window.CNCProgressConfig,recovery=window.CNCProgressRecovery;
  let root,feedback,preview,pending=null,notice=recovery.message||'',savedHistory=model.empty(),historyError='';
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn,primary=false)=>{const b=node('button',text,'button '+(primary?'primary':'secondary'));b.type='button';b.onclick=fn;return b;};
  const copy=value=>JSON.parse(JSON.stringify(value));
  let focusMilling=false, fileSelection=0;
  function readRaw(){return Object.fromEntries(config.keys.map(k=>[k,localStorage.getItem(k)]));}
  try{const restored=model.fromRaw(readRaw());for(const id of model.ids)savedHistory.sections[id].history=restored.sections[id].history;}catch(error){historyError=error.message;notice='Не удалось прочитать часть сохранений: '+error.message;}
  const historicalSummary=model.summary(savedHistory),historicalPath=model.evidence(savedHistory);
  const historicalEvidence=()=>historicalPath;
  function collect(){
    const a=model.empty(),snapshots={base:window.CNCDemo.progressSnapshot(),course:window.CNCCourseUI.progressSnapshot(),coursePath:window.CNCCourseUI.pathSnapshot(),training:window.CNCTrainingUI.progressSnapshot(),gcode:window.CNCGCodeUI.progressSnapshot(),skills:window.CNCSkillsUI.progressSnapshot(),library:window.CNCLibraryUI.progressSnapshot(),lab:window.CNCLabUI.progressSnapshot(),routeExams:window.CNCRouteExamUI.progressSnapshot(),machinePath:window.CNCMachineUI.progressSnapshot(),learningPath:window.CNCLearningUI.progressSnapshot(),sandbox:window.CNCSandboxUI.progressSnapshot()};
    for(const id of model.ids){try{a.sections[id]={current:model.normalize(id,copy(snapshots[id])),history:savedHistory.sections[id].history};}catch(error){throw Error(`Раздел «${model.labels[id]}»: ${error.message}`);}}return model.validate(a);
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function message(text,error=false){notice=text;if(feedback){feedback.textContent=text;feedback.className='progress-feedback'+(error?' is-error':'');feedback.tabIndex=-1;feedback.focus();}}
  function exportArchive(){try{window.CNCDemo.pauseWorkshop();download('cnc-progress-'+model.empty().appVersion+'.json',model.stringify(collect()),'application/json');message('Скачан общий архив: результаты, текущие черновики и сохранённые истории всех разделов.');}catch(error){message('Не удалось собрать архив: '+error.message,true);}}
  function exportReport(){try{download('cnc-learning-report.txt',model.report(collect()),'text/plain;charset=utf-8');message('Скачана общая сводка. Для восстановления используйте JSON-архив.');}catch(error){message(error.message,true);}}
  function table(headers,rows){const wrap=node('div',undefined,'progress-table-wrap'),t=node('table'),head=node('thead'),tr=node('tr');for(const h of headers){const th=node('th',h);th.scope='col';tr.append(th);}head.append(tr);const body=node('tbody');for(const row of rows){const r=node('tr');for(const cell of row)r.append(node('td',String(cell)));body.append(r);}t.append(head,body);wrap.append(t);return wrap;}
  function details(title,child){const box=node('details',undefined,'progress-details');box.append(node('summary',title),child);return box;}
  function badge(row){return row.independent?'Есть самостоятельное подтверждение':row.passed?'С разбором / сохранён зачёт':'Пока не подтверждено';}
  function transferResult(local,incoming,kind){
    if(kind==='milling'||kind==='milling-current')
      return model.mergeMillingWork(local,incoming,{useImportedCurrent:kind==='milling-current'});
    return model.ensureSyncSize(kind==='merge'?model.merge(local,incoming):model.validate(incoming));
  }
  function describeMillingPreview(incoming,kind,local,merged){
    const {title,profileTitle,profileVersion}=model.millingWorks[incoming.kind];
    const existing=model.getMillingWork(local,incoming.kind),after=model.getMillingWork(merged,incoming.kind);
    const status=(entry)=>entry?model.millingWorkStatus(incoming.kind,entry):'Нет работы';
    const heading=node('h3',title);
    heading.tabIndex=-1;
    preview.append(heading,node('p',profileTitle+' · версия '+profileVersion+'. Будет перенесена только эта фрезерная работа.'));
    preview.append(table(['Состояние','Сейчас','После переноса'],[
      ['Текущая работа',status(existing.current),status(after.current)],
      ['Работ в истории',existing.history.length,after.history.length],
    ]));
    if(incoming.current)preview.append(node('p','В выбранной копии: '+status(incoming.current)+'.'));
    if(kind==='milling-current'){
      preview.append(node('p','Выбранная работа станет текущей. Прежняя текущая работа попадёт в историю.'),
        button('Сделать выбранную работу текущей',apply,true));
    }else{
      preview.append(button('Перенести работу',apply,true));
      if(existing.current&&incoming.current&&model.canonical(existing.current)!==model.canonical(incoming.current)){
        preview.append(node('p','Можно открыть работу из файла как текущую. Ваш черновик сохранится в истории.'),
          button('Посмотреть замену текущей работы',()=>describePreview(incoming,'milling-current')));
      }
    }
    preview.append(button('Отменить просмотр',closePreview));
    heading.focus();
  }
  function closePreview(){fileSelection++;pending=null;preview.hidden=true;message('Просмотр закрыт.');}
  function describePreview(incoming,kind='merge'){
    const local=collect(),merged=transferResult(local,incoming,kind);
    pending={incoming,kind,fingerprint:model.canonical(local.sections),stored:model.canonical(recovery.store.read())};
    preview.replaceChildren();preview.hidden=false;
    if(kind==='milling'||kind==='milling-current'){describeMillingPreview(incoming,kind,local,merged);return;}
    const before=model.summary(local),after=model.summary(merged);
    const title=node('h3',kind==='merge'?'Проверка перед переносом':'Восстановление предыдущей копии');title.tabIndex=-1;
    preview.append(title,node('p',`Обязательный путь: сейчас ${before.progress.done}/${before.progress.total} → после ${after.progress.done}/${after.progress.total}. Сохранённых альтернативных состояний: ${after.histories}.`));
    if(kind==='merge')preview.append(node('p','Текущие черновики с начатой работой останутся на месте. Ответы уроков и отметки чтения объединятся. Помощь и ошибки другой истории учитываются при повторении того же условия. Разные истории решений сохранятся отдельно; самостоятельный результат не складывается из частей разных попыток.'));
    else preview.append(node('p','Все разделы вернутся к этой копии, включая черновики. Состояние перед восстановлением будет сохранено как новая предыдущая копия.'));
    preview.append(table(['Раздел','В файле','После переноса'],after.sections.map(s=>[s.title,model.active(s.id,incoming.sections[s.id].current)?'Есть работа':'Без начатой работы',s.histories?`Текущий черновик + состояний: ${s.histories}`:'Текущий черновик'])));
    preview.append(button(kind==='merge'?'Объединить и восстановить':'Восстановить эту копию',apply,true),button('Отменить просмотр',closePreview));title.focus();
  }
  async function importFile(file){
    const selection=++fileSelection;
    pending=null;preview.hidden=true;
    try{
      demandReady();
      if(!file||file.size>model.MAX_BYTES)throw Error('Выберите JSON-файл до 4 МБ.');
      const text=await file.text();
      if(selection!==fileSelection)return;
      const transfer=model.parseTransfer(text);
      describePreview(transfer.milling||transfer.archive,transfer.milling?'milling':'merge');
      message('Файл проверен. Сравните сводку перед переносом.');
    }catch(error){
      if(selection!==fileSelection)return;
      pending=null;preview.hidden=true;message('Перенос не выполнен: '+error.message,true);
    }
  }
  function demandReady(){if(recovery.blocked)throw Error('Сначала перезагрузите страницу для восстановления.');if(historyError)throw Error('Есть ошибка чтения прежних сохранений. Скачайте доступную копию перед восстановлением.');if(!recovery.store)throw Error('Хранилище недоступно. Экспортировать прогресс можно, импортировать сейчас нельзя.');}
  function apply(){
    try{
      demandReady();
      if(!pending)return;
      const current=collect(),raw=recovery.store.read();
      if(raw[config.revisionKey]!==recovery.revision){
        recovery.block('Сохранения перенесены в другой вкладке. Перезагрузите страницу.');
        return;
      }
      if(model.canonical(current.sections)!==pending.fingerprint || model.canonical(raw)!==pending.stored){
        describePreview(pending.incoming,pending.kind);
        message('После просмотра прогресс изменился. Проверьте обновлённую сводку.');
        return;
      }
      const merged=transferResult(current,pending.incoming,pending.kind);
      if((pending.kind==='milling'||pending.kind==='milling-current') &&
        model.canonical(merged.sections)===model.canonical(current.sections)){
        pending=null;preview.hidden=true;message('Эта работа уже сохранена.');return;
      }
      // Save the live state, including edits that could not be written by individual sections.
      const backup={version:1,at:new Date().toISOString(),archive:current};let next=model.toRaw(merged,raw);next[config.backupKey]=JSON.stringify(backup);next[config.revisionKey]=window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);next['cnc-workspace-screen-v1']='progress';next['cnc-graphite-layout-v1']='seen';
      recovery.applying=true;recovery.store.commit(next,raw);recovery.revision=next[config.revisionKey];pending=null;message('Прогресс сохранён. Открываю восстановленную сводку…');location.reload();
    }catch(error){message('Перенос не выполнен: '+error.message,true);try{if(localStorage.getItem(config.journalKey)!==null)recovery.block('Запись переноса прервалась. Нажмите «Повторить загрузку», чтобы завершить восстановление.');}catch{}}
    finally{recovery.applying=false;}
  }
  function previous(){try{demandReady();const raw=JSON.parse(localStorage.getItem(config.backupKey)||'null');if(!raw||raw.version!==1)throw Error('Предыдущая копия недоступна.');describePreview(model.validate(raw.archive),'restore');message('Открыта копия от '+new Date(raw.at).toLocaleString('ru-RU')+'. Пока ничего не изменено.');}catch(error){message(error.message,true);}}
  function millingTransferPanel(archive){
    const panel=node('details',undefined,'progress-details');
    panel.id='progress-milling-transfer';
    panel.append(node('summary','Перенос фрезерных работ'));
    panel.append(node('p','Скачайте одну работу с её черновиком и историей. Чтобы открыть файл в аккаунте или автономной версии, используйте «Открыть архив или фрезерную работу» выше.'));
    for(const {key,title,profileTitle,profileVersion} of Object.values(model.millingWorks)){
      const work=model.getMillingWork(archive,key),section=node('section',undefined,'progress-milling-work');
      section.append(node('h4',title),node('p',profileTitle+' · версия '+profileVersion));
      if(!work.current&&!work.history.length){
        section.append(node('p','Работа ещё не начата.'));
        panel.append(section);continue;
      }
      const actions=node('div',undefined,'progress-tools');
      actions.append(button('Скачать работу · JSON',()=>{
        try{
          download('cnc-'+(key==='mountingPlate'?'mounting-plate':'plate-two-depths')+'.json',model.stringifyMillingWork(collect(),key),'application/json');
          message('Работа скачана вместе с историей.');
        }catch(error){message(error.message,true);}
      }));
      if(work.history.length){
        const label=node('label','Работа из истории','field'),select=node('select');
        work.history.forEach((entry,index)=>{
          const option=node('option','Копия '+(index+1)+' · '+model.millingWorkStatus(key,entry));
          option.value=String(index);select.append(option);
        });
        label.append(select);
        actions.append(label,button('Открыть копию из истории',()=>{
          try{
            demandReady();
            const current=work.history[Number(select.value)];
            describePreview({...work,current,history:[]},'milling-current');
          }catch(error){message(error.message,true);}
        }));
      }
      section.append(actions);panel.append(section);
    }
    if(focusMilling) panel.open=true;
    return panel;
  }
  function openMilling(){
    focusMilling=true;
    window.CNCWorkshop.results();
  }
  function render(){
    if(!root)return;root.replaceChildren();pending=null;fileSelection++;
    root.append(node('p','РЕЗУЛЬТАТЫ И СОХРАНЕНИЯ','eyebrow'),node('h2','Что уже получилось'),node('p','Обязательный путь показывает результат курса. Дополнительные упражнения и чтение учитываются отдельно. Исторический зачёт сохраняется при новом повторении.'));
    let a,s;try{a=collect();s=model.summary(a);}catch(error){root.append(node('p','Не удалось собрать сводку: '+error.message,'progress-feedback is-error'));return;}
    const headline=node('div',undefined,'progress-overview'),count=node('strong',`${s.progress.done} из ${s.progress.total}`);headline.append(count,node('span',s.progress.complete?'Обязательный путь подтверждён':'шагов обязательного пути'));
    headline.append(button(s.progress.complete?'Повторить курс':'Продолжить курс',()=>s.progress.complete?window.CNCLearningUI.goFurther():window.CNCLearningUI.start(),true));root.append(headline);
    const note=node('p','Полный цикл на другом условии: '+(s.progress.items.find(r=>r.id==='self-cycle').done?'подтверждён':'предстоит')+'. Программа для другого чертежа: '+(s.progress.items.find(r=>r.id==='self-code').done?'подтверждена':'предстоит')+'.','progress-evidence-note');root.append(note);
    const transfer=node('section',undefined,'panel progress-transfer');transfer.append(node('h3','Сохранить или перенести обучение'),node('p','Один JSON-файл переносит все разделы, черновики, деталь с контролем и истории. Сводка TXT подходит для чтения преподавателем. Перед переносом автоматически сохраняется предыдущая копия.'));
    const tools=node('div',undefined,'progress-tools');tools.append(button('Скачать весь прогресс · JSON',exportArchive,true),button('Скачать сводку · TXT',exportReport));const label=node('label','Открыть архив или фрезерную работу','field'),file=node('input');file.type='file';file.accept='.json,application/json';file.id='progress-import';file.addEventListener('change',()=>{const chosen=file.files[0];file.value='';if(chosen)importFile(chosen);});label.append(file);tools.append(label);transfer.append(tools,millingTransferPanel(a));focusMilling=false;
    try{const backup=JSON.parse(localStorage.getItem(config.backupKey)||'null');if(backup?.version===1)transfer.append(details('Предыдущая копия · '+new Date(backup.at).toLocaleString('ru-RU'),button('Посмотреть предыдущую копию',previous)));}catch{}
    preview=node('section',undefined,'progress-import-preview');preview.hidden=true;feedback=node('p',notice,'progress-feedback');feedback.setAttribute('role','status');transfer.append(preview,feedback);root.append(transfer);
    root.append(details('Все этапы и основания зачёта · '+s.rows.length,table(['Шаг','Результат'],s.rows.map(r=>[(r.done?'✓ ':'○ ')+r.title,r.detail]))));
    const extra=node('section',undefined,'progress-extra');extra.append(node('h3','Дополнительная практика и чтение'),node('p',`На станке: ${s.station.filter(r=>r.passed).length}/${s.station.length} · практикум: ${s.training.filter(r=>r.passed).length}/${s.training.length} · G-код: ${s.gcode.filter(r=>r.passed).length}/${s.gcode.length} · прочитано ${s.library.read}/${s.library.total}.`));
    extra.append(details('На станке: текущие и прежние зачёты',table(['Задание','Подтверждение'],s.station.map(r=>[r.title,r.passed?(r.historical?'Сохранён зачёт контроля':'Контроль подтверждён моделью'):r.legacy?'Только зачёт прежней версии':'Предстоит']))));
    extra.append(details('Практикум: помощь и исправления',table(['Условие','Результат','Помощь / ошибки'],s.training.map(r=>[r.title,badge(r),`${r.hints?'Есть помощь':'Помощь не отмечена'}; ошибок в одной истории до ${r.errors}`]))));
    extra.append(details('G-код: прогнозы и самостоятельный итог',table(['Задание','Результат','Помощь / ошибки'],s.gcode.map(r=>[r.title,badge(r),`${r.helped?'Есть помощь':r.legacy?'Прежний журнал':'Помощь не отмечена'}; ошибок в одной истории до ${r.errors}`]))));
    const status={new:'Ещё не проверен',learning:'Тренируется',review:'Нужно повторить',mastered:'Подтверждён в одной из историй'};extra.append(details('Навыки: подтверждения по сохранённым историям',table(['Навык','Лучшее подтверждение'],s.skills.map(r=>[r.title,status[r.status]]))));
    const exam=node('div');exam.append(node('p',`Экзаменов в сохранённых историях: ${s.exams.length}.`));if(s.exams.length)exam.append(table(['Дата','Экзамен','Результат'],s.exams.map(e=>[new Date(e.at).toLocaleString('ru-RU'),e.type==='basic'?'Базовый':'Маршрутный',`${e.score}% · ${e.passed?'зачтено':'нужно повторить'}`])));exam.append(button('Открыть разборы экзаменов',()=>window.CNCWorkshop.examHistory()));extra.append(details('Экзамены и разборы',exam));root.append(extra);
    const history=node('div');history.append(node('p','При объединении начатая местная работа остаётся текущей. Результаты другого устройства сохраняются в альтернативных состояниях и входят в общую сводку. Эти состояния входят в следующий JSON-архив. Поле «лучшее подтверждение» не описывает качество последнего повторения.'),table(['Раздел','Других состояний'],s.sections.map(r=>[r.title,r.histories])));root.append(details('Как учитываются разные истории',history));
    root.append(details('Проверить качество курса · этап E',button('Открыть журнал проверки курса',()=>window.CNCWorkshop.pilot())));
    const limits=node('p',window.CNCAccount?'Результаты и журнал наблюдений автоматически передаются в ваш аккаунт. Статус сохранения виден вверху. На другом устройстве войдите с тем же логином. JSON пригодится для отдельной копии и переноса из автономной версии.':'Самостоятельный итог относится к учебной модели. Результаты хранятся в этом браузере; для другого компьютера или адреса перенесите JSON-файл. Файл содержит ответы и историю занятий.','course-note');root.append(limits);
    // Probe without replacing any learning key. Export still uses live controllers on failure.
    try{localStorage.setItem('cnc-progress-probe-v1','1');localStorage.removeItem('cnc-progress-probe-v1');}catch{message('Хранилище недоступно: новые изменения могут потеряться после закрытия. Скачайте JSON-копию текущего прогресса.',true);}
  }
  function mount(parent){root=node('section',undefined,'progress-screen');root.id='progress-screen';root.hidden=true;parent.insertBefore(root,parent.querySelector('footer'));return root;}
  window.CNCProgressUI={courseStates:()=>JSON.parse(JSON.stringify([savedHistory.sections.coursePath.current,...savedHistory.sections.coursePath.history])),mount,render,collect,historicalEvidence,historicalGCode:id=>historicalSummary.gcode.find(r=>r.id===id),historicalTraining:id=>historicalSummary.training.find(r=>r.id===id),exportArchive,exportReport,openMilling};
})();
