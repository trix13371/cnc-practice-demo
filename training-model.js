(function(root){
  'use strict';
  const math=root.CNCTrainingMath||(typeof require==='function'?require('./training-math.js'):null);
  const families=[
    {id:'cycle',title:'Первый полный цикл',brief:'Оставьте припуск после черновой обработки, выполните чистовой проход и подтвердите размер микрометром.'},
    {id:'passes',title:'Распределение припуска',brief:'Припуск больше допустимой глубины одного прохода. Рассчитайте промежуточные диаметры, оставьте чистовой припуск и доведите размер.'},
    {id:'offset',title:'Диагностика коррекции',brief:'Сравните три контрольных размера пробной детали. Найдите общую причину отклонений и обработайте новую заготовку с правильной коррекцией.'}
  ];
  const round=n=>+n.toFixed(6),finite=n=>typeof n==='number'&&Number.isFinite(n);
  const variants=kind=>kind==='cycle'?[0,1,2,3,4,5]:[0,1,2];
  const transferConditions=[
    {target:24,stock:30,length:35,tolerance:.05,maxDepth:1.5,finishDepth:.3,allowance:.6,conditionTitle:'Большой припуск',challenge:'Основной съём нужно разделить на несколько черновых проходов. Чистовой припуск — 0,6 мм по диаметру.'},
    {target:34,stock:35.2,length:30,tolerance:.05,maxDepth:2,finishDepth:.15,allowance:.2,conditionTitle:'Небольшой запас',challenge:'Исходный диаметр близок к цели. Оставьте 0,2 мм по диаметру; чистовая глубина ограничена 0,15 мм на радиус.'},
    {target:22,stock:26,length:50,tolerance:.1,maxDepth:1,finishDepth:.25,allowance:.4,conditionTitle:'Меньшая глубина прохода',challenge:'За один черновой проход разрешено снять не более 1 мм на радиус. Самостоятельно распределите съём.'}
  ];
  function task(kind,variant){
    const family=families.find(f=>f.id===kind);
    if(!family||!Number.isInteger(variant)||!variants(kind).includes(variant))throw new Error('Неизвестный вариант задания.');
    if(kind==='cycle'&&variant>=3)return {...family,kind,variant,...transferConditions[variant-3],rpm:[600,1000],roughFeed:[.1,.25],finishFeed:[.08,.15],bias:0,references:[],transfer:true};
    const target=[28,30,26][variant],bias=kind==='offset'?[.2,.4,-.2][variant]:0;
    return {...family,kind,variant,target,stock:target+(kind==='passes'?10:4),length:[45,40,50][variant],tolerance:.1,maxDepth:kind==='passes'?1.5:2,finishDepth:.3,allowance:.4,rpm:[600,1000],roughFeed:[.1,.25],finishFeed:[.08,.15],bias,
      references:kind==='offset'?[target+8,target+4,target].map(x=>({program:x,reading:round(x+bias)})):[]};
  }
  function create(kind='cycle',variant=0){
    const t=task(kind,variant);
    return {version:1,kind,variant,actions:[],machine:{clamped:false,zeroed:false,doorClosed:false,spindle:false},diameter:t.stock,passes:[],measurements:[],inspection:null,blank:1,previous:[],hints:0,achievements:{passed:false,independent:false},journal:[],feedback:'Начните с закрепления заготовки и установки нуля. Все режимы в этом задании — учебные.'};
  }
  function normalize(a){
    if(!a||typeof a!=='object'||Array.isArray(a))return null;
    if(['clamp','zero','door','spindle'].includes(a.type)&&typeof a.value==='boolean')return {type:a.type,value:a.value};
    if(a.type==='cut'&&['rough','finish'].includes(a.stage)&&['turning','boring','drill'].includes(a.tool)&&['x','offset','feed','rpm','prediction'].every(k=>finite(a[k]))&&a.x>=1&&a.x<=80&&Math.abs(a.offset)<=5&&a.feed>0&&a.feed<=1&&a.rpm>=100&&a.rpm<=2000&&a.prediction>=0&&a.prediction<=100)
      return {type:'cut',stage:a.stage,tool:a.tool,x:a.x,offset:a.offset===0?0:a.offset,feed:a.feed,rpm:a.rpm,prediction:a.prediction===0?0:a.prediction};
    if(a.type==='measure'&&['caliper','micrometer'].includes(a.instrument))return {type:a.type,instrument:a.instrument};
    if(a.type==='inspect'&&['ok','large','small','uncertain'].includes(a.verdict)&&['none','offset','feed','program'].includes(a.diagnosis))return {type:a.type,verdict:a.verdict,diagnosis:a.diagnosis};
    if(['blank','hint'].includes(a.type))return {type:a.type};
    return null;
  }
  function grade(s){
    const t=task(s.kind,s.variant),latest=s.measurements.at(-1),last=s.passes.at(-1),firstFinish=s.passes.findIndex(p=>p.stage==='finish'),roughEnd=firstFinish<0?last:s.passes[firstFinish-1];
    const criteria=[
      {id:'rough',title:'Есть черновая обработка с чистовым припуском',ok:!!roughEnd&&roughEnd.stage==='rough'&&roughEnd.after>=t.target+t.allowance-1e-8},
      {id:'finish',title:'Последний проход — чистовой',ok:!!last&&last.stage==='finish'},
      {id:'size',title:'Фактический размер в допуске',ok:Math.abs(s.diameter-t.target)<=t.tolerance+1e-8},
      {id:'gauge',title:'Свежий контроль микрометром',ok:!!latest&&latest.instrument==='micrometer'&&latest.pass===s.passes.length&&!!last},
      {id:'verdict',title:'Верный вывод по показанию прибора',ok:!!latest&&!!s.inspection&&s.inspection.pass===s.passes.length&&s.inspection.verdict===latest.verdict&&latest.verdict==='ok'},
      {id:'diagnosis',title:t.kind==='offset'?'Общее смещение правильно диагностировано и компенсировано':'Коррекция соответствует условиям',ok:t.kind==='offset'?s.inspection?.diagnosis==='offset'&&!!last&&Math.abs(last.offset+t.bias)<1e-8:!!last&&Math.abs(last.offset)<1e-8},
      {id:'stopped',title:'Шпиндель остановлен перед контролем',ok:!s.machine.spindle}
    ];
    const passed=criteria.every(c=>c.ok),predictions=s.passes.filter(p=>p.predicted).length,blockedActions=s.journal.filter(j=>!j.ok).length,inspectionErrors=s.journal.filter(j=>j.type==='inspect'&&j.assessmentCorrect===false).length,predictionErrors=s.journal.filter(j=>j.type==='cut'&&j.assessmentCorrect===false).length;
    const repeated=s.previous.some(p=>p.passes>0);
    return {passed,criteria,predictions,inspectionErrors,predictionErrors,repeated,totalPredictions:s.passes.length,blockedActions,independent:passed&&!repeated&&s.hints===0&&predictions===s.passes.length&&predictionErrors===0&&blockedActions===0&&inspectionErrors===0,scrap:s.diameter<t.target-t.tolerance-1e-8,seconds:s.passes.reduce((sum,p)=>sum+p.seconds,0)};
  }
  function transition(s,input){
    const a=normalize(input);if(!a)throw new Error('Некорректное действие или числовые параметры.');
    if(s.actions.length>=500)throw new Error('Достигнут лимит журнала этого варианта. Сохраните отчёт и выберите другой вариант.');
    const n=structuredClone(s),t=task(s.kind,s.variant);let ok=true,message='',assessmentCorrect=null;
    const reject=text=>{ok=false;message=text;};
    if(a.type==='clamp'){
      if(n.machine.spindle||n.machine.doorClosed)reject('Сначала остановите шпиндель и откройте дверь.');
      else {n.machine.clamped=a.value;if(!a.value)n.machine.zeroed=false;message=a.value?'Заготовка закреплена. Установите ноль детали.':'Заготовка освобождена. Ноль детали нужно установить заново.';}
    }else if(a.type==='zero'){
      if(n.machine.spindle||!n.machine.clamped)reject('Для установки нуля нужны закреплённая заготовка и остановленный шпиндель.');
      else{n.machine.zeroed=a.value;message=a.value?'Ноль детали установлен на торце.':'Привязка нуля отменена.';}
    }else if(a.type==='door'){
      if(n.machine.spindle&&!a.value)reject('Дверь нельзя открыть при вращающемся шпинделе. Сначала остановите его.');
      else{n.machine.doorClosed=a.value;message=a.value?'Дверь закрыта. Проверьте готовность перед запуском.':'Дверь открыта при остановленном шпинделе.';}
    }else if(a.type==='spindle'){
      if(a.value&&(!n.machine.clamped||!n.machine.zeroed||!n.machine.doorClosed))reject('Запуск заблокирован: нужны закрепление, ноль детали и закрытая дверь.');
      else{n.machine.spindle=a.value;message=a.value?'Шпиндель включён. Задайте проход и предскажите размер.':'Шпиндель полностью остановлен. Можно измерять деталь.';}
    }else if(a.type==='cut'){
      const desired=round(a.x+a.offset+t.bias),after=Math.min(n.diameter,desired),depth=round((n.diameter-after)/2),feedRange=a.stage==='rough'?t.roughFeed:t.finishFeed,maxDepth=a.stage==='rough'?t.maxDepth:t.finishDepth;
      if(!n.machine.spindle||!n.machine.clamped||!n.machine.zeroed||!n.machine.doorClosed)reject('Для прохода нужны закрепление, ноль, закрытая дверь и включённый шпиндель.');
      else if(grade(n).scrap)reject('Размер уже меньше нижнего допуска. Материал вернуть нельзя: возьмите новую заготовку.');
      else if(a.tool!=='turning')reject('Для наружного точения нужен проходной резец.');
      else if(desired<=0)reject('Траектория пересекает ось. Исправьте X или коррекцию.');
      else if(depth<=1e-8)reject('Материал не снимается: траектория снаружи текущей поверхности. Изменение X не увеличивает диаметр уже обработанной детали.');
      else if(depth>maxDepth+1e-8)reject(`Глубина ${depth} мм на радиус превышает ${maxDepth} мм для выбранного этапа. Разбейте съём на проходы.`);
      else if(a.feed<feedRange[0]||a.feed>feedRange[1]||a.rpm<t.rpm[0]||a.rpm>t.rpm[1])reject(`Учебный режим: подача ${feedRange.join('–')} мм/об, обороты ${t.rpm.join('–')} об/мин. Материал пока не снимался.`);
      else{
        const metrics=math.metrics(after,t.length,a.feed,a.rpm),predicted=Math.abs(a.prediction-after)<=.02000001;
        n.passes.push({...a,before:n.diameter,after,depth,predicted,...metrics});n.diameter=after;n.inspection=null;assessmentCorrect=predicted;
        message=`Проход выполнен. ${predicted?'Прогноз совпал с результатом.':'Прогноз не совпал: после остановки проверьте размер измерением.'} `;
        if(grade(n).scrap)message+='Размер ниже допуска: деталь забракована, требуется новая заготовка.';
        else if(a.stage==='rough'&&after<t.target+t.allowance-1e-8)message+='Чистовой припуск не сохранён. Размер сам по себе не подтверждает правильный маршрут.';
        else message+='Остановите шпиндель, чтобы измерить текущую деталь.';
      }
    }else if(a.type==='measure'){
      if(n.machine.spindle)reject('Ручное измерение при вращении запрещено. Остановите шпиндель.');
      else{
        const resolution=a.instrument==='micrometer'?.01:.1,reading=round(Math.round(n.diameter/resolution)*resolution),verdict=math.classify(reading,resolution,t.target,t.tolerance);
        n.measurements.push({instrument:a.instrument,resolution,reading,verdict,pass:n.passes.length});n.inspection=null;
        message=`Замер ${reading.toFixed(a.instrument==='micrometer'?2:1)} мм записан. Сопоставьте показание и интервал округления с допуском.`;
      }
    }else if(a.type==='inspect'){
      const latest=n.measurements.at(-1);
      if(n.machine.spindle||!latest||latest.pass!==n.passes.length)reject('Сначала остановите шпиндель и сделайте новый замер после последнего прохода.');
      else{
        n.inspection={verdict:a.verdict,diagnosis:a.diagnosis,pass:n.passes.length};assessmentCorrect=a.verdict===latest.verdict&&(t.kind!=='offset'||a.diagnosis==='offset');const result=grade(n);
        if(a.verdict!==latest.verdict)message='Вывод неверный. Учитывайте весь интервал: показание ± половина цены деления.';
        else if(latest.verdict==='uncertain')message='Верно: показание пограничное. Используйте более точный прибор или предусмотрите запас до границы допуска.';
        else if(result.passed)message=result.independent?'Задание выполнено самостоятельно: маршрут, прогнозы и контроль подтверждены.':'Задание выполнено с исправлениями или помощью. Для самостоятельного результата пройдите новый вариант без подсказок, блокировок и ошибок прогноза.';
        else message='Вывод принят. До зачёта осталось: '+result.criteria.filter(c=>!c.ok).map(c=>c.title.toLowerCase()).join('; ')+'.';
      }
    }else if(a.type==='blank'){
      if(n.machine.spindle)reject('Перед заменой заготовки остановите шпиндель.');
      else{n.previous.push({blank:n.blank,diameter:n.diameter,passes:n.passes.length,...grade(n)});n.blank++;n.machine={clamped:false,zeroed:false,doorClosed:false,spindle:false};n.diameter=t.stock;n.passes=[];n.measurements=[];n.inspection=null;message='Установлена новая заготовка. Помощь и ошибки этого условия остаются в истории; самостоятельность подтверждают на другом условии.';}
    }else if(a.type==='hint'){
      n.hints++;
      message=t.kind==='offset'?'Сравните «замер − программа» во всех трёх строках. Одинаковое отклонение указывает на общее смещение. В этой модели: результат = X + коррекция + смещение.':`Съём на радиус = (текущий диаметр − следующий диаметр) / 2. Черновые проходы ограничены ${t.maxDepth} мм. Перед чистовым оставьте ${t.allowance} мм по диаметру, то есть ${t.allowance/2} мм на радиус.`;
    }
    n.actions.push(a);n.feedback=message;n.journal.push({number:n.actions.length,blank:n.blank,type:a.type,ok,message,...(assessmentCorrect===null?{}:{assessmentCorrect})});
    const achieved=grade(n);n.achievements={passed:n.achievements.passed||achieved.passed,independent:n.achievements.independent||achieved.independent};
    return {state:n,ok,message};
  }
  function snapshot(s){return {version:1,kind:s.kind,variant:s.variant,actions:structuredClone(s.actions)};}
  function restore(v){
    try{if(!v||v.version!==1||!families.some(f=>f.id===v.kind)||!Number.isInteger(v.variant)||!Array.isArray(v.actions)||v.actions.length>500)return null;let s=create(v.kind,v.variant);for(const a of v.actions){if(!normalize(a))return null;s=transition(s,a).state;}return s;}catch{return null;}
  }
  function ids(){
    return families.flatMap(f=>variants(f.id).map(v=>`${f.id}-${v}`));
  }
  function canonical(s){
    return JSON.stringify(snapshot(s));
  }
  function evidence(session,history=[]){
    const states=[];
    if(session)states.push(session);
    for(const h of history||[])if(h)states.push(h);
    let passed=false,independent=false;
    for(const s of states){
      const g=grade(s);
      if(g.passed)passed=true;
      if(g.independent)independent=true;
      if(s.achievements?.passed)passed=true;if(s.achievements?.independent)independent=true;
      for(const p of s.previous||[]){if(p.passed)passed=true;if(p.independent)independent=true;}
    }
    return {passed,independent};
  }
  function summary(s){const t=task(s.kind,s.variant),g=grade(s);return {task:t.title,variant:t.variant+1,blank:s.blank,diameter:s.diameter,target:t.target,tolerance:t.tolerance,passed:g.passed,independent:g.independent,predictions:`${g.predictions}/${g.totalPredictions}`,hints:s.hints,blockedActions:g.blockedActions,inspectionErrors:g.inspectionErrors,cuttingSeconds:round(g.seconds),criteria:g.criteria,passes:s.passes,measurements:s.measurements,previous:s.previous,journal:s.journal};}
  function best(s){return grade(s).passed||s.previous.some(p=>p.passed);}
  function restoreBook(value){
    const allIds=ids();
    if(!value||(value.version!==1&&value.version!==2)||!value.sessions||typeof value.sessions!=='object'||Array.isArray(value.sessions)||!allIds.includes(value.selected)||Object.keys(value.sessions).some(id=>!allIds.includes(id)))throw new Error('Формат прогресса не поддерживается.');
    const sessions={};
    for(const [id,v] of Object.entries(value.sessions)){const s=restore(v);if(!s||`${s.kind}-${s.variant}`!==id)throw new Error('Один из журналов повреждён. Текущий прогресс сохранён.');sessions[id]=s;}
    const archive={};
    if(value.version===2&&value.archive!==undefined){
      if(!value.archive||typeof value.archive!=='object'||Array.isArray(value.archive))throw new Error('Архив прогресса повреждён.');
      let total=0;
      for(const [id,list] of Object.entries(value.archive)){
        if(!allIds.includes(id))throw new Error('Архив прогресса повреждён.');
        if(!Array.isArray(list))throw new Error('Архив прогресса повреждён.');
        if(list.length>40)throw new Error('Слишком много сохранённых попыток для одного условия.');
        total+=list.length;
        if(total>400)throw new Error('Слишком много сохранённых попыток.');
        const seen=new Set(),states=[];
        for(const v of list){const s=restore(v);if(!s||`${s.kind}-${s.variant}`!==id)throw new Error('Архив прогресса повреждён.');const key=canonical(s);if(seen.has(key))continue;seen.add(key);states.push(s);}
        archive[id]=states;
      }
    }
    const drafts={};
    for(const id of allIds){const d=value.drafts?.[id];if(d&&typeof d==='object'&&!Array.isArray(d)){drafts[id]={};for(const field of ['stage','tool','x','offset','feed','rpm','prediction','instrument','verdict','diagnosis'])if(typeof d[field]==='string'&&d[field].length<=32)drafts[id][field]=d[field];}}
    return {version:2,sessions,archive,selected:value.selected,drafts,tab:['cut','control','review'].includes(value.tab)?value.tab:'cut'};
  }
  function rank(s){const g=grade(s);return g.independent?3:g.passed?2:1;}
  function nextTransfer(sessions={},archive={}){
    const options=[3,4,5].map(v=>'cycle-'+v);
    const passed=options.find(id=>evidence(sessions[id],archive[id]).independent);if(passed)return passed;
    return options.find(id=>[sessions[id],...(archive[id]||[])].filter(Boolean).every(s=>{const g=grade(s);return !s.hints&&!g.blockedActions&&!g.inspectionErrors&&!g.predictionErrors&&!g.scrap&&!g.repeated&&!g.passed;}))||null;
  }
  function mergeBooks(local,incoming){
    const book=restoreBook(local),next=restoreBook(incoming);
    let total=0;
    for(const id of ids()){
      const a=book.sessions[id],b=next.sessions[id],seen=new Set(),history=[];
      for(const s of [...(book.archive[id]||[]),a,...(next.archive[id]||[]),b]){
        if(!s||s.actions.length===0)continue;const key=canonical(s);if(seen.has(key))continue;seen.add(key);history.push(s);
      }
      if(history.length>40)throw new Error('Слишком много сохранённых попыток для одного условия.');
      total+=history.length;if(total>400)throw new Error('Слишком много сохранённых попыток.');
      if(history.length)book.archive[id]=history;
      const useIncoming=b&&(!a||rank(b)>rank(a)||(rank(a)===1&&rank(b)===1&&b.actions.length>a.actions.length));
      if(useIncoming){book.sessions[id]=b;book.drafts[id]=next.drafts[id]||{};}
    }
    book.selected=next.selected;book.tab=next.tab;
    if(!book.sessions[book.selected]){const split=book.selected.lastIndexOf('-');book.sessions[book.selected]=create(book.selected.slice(0,split),Number(book.selected.slice(split+1)));book.drafts[book.selected]=next.drafts[book.selected]||{};}
    return book;
  }

  const api={families,variants,ids,task,create,normalize,transition,grade,snapshot,restore,summary,best,evidence,nextTransfer,restoreBook,mergeBooks};root.CNCTraining=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
