(function(root){
  'use strict';
  const progress=typeof module!=='undefined'&&module.exports?require('./progress-model.js'):root.CNCProgress;
  const FORMAT='cnc-pilot',KEY='cnc-pilot-v1',MAX_BYTES=2*1024*1024,DAY=86400000;
  const practical=['cycle-3','cycle-4','cycle-5'],program=['transfer-a','transfer-b','transfer-c'];
  const checks=[
    ['scope','Границы модели','В каждом разделе понятно, что относится к учебной модели, а что требует документации и обучения на реальном оборудовании.'],
    ['sequence','Понятия до действий','Диаметр, X/Z, допуск, подготовка и режимы объясняются до первого самостоятельного применения.'],
    ['visual','Схемы и формулировки','Чертёж, единицы, направление осей и условия доступны без догадок; пример не раскрывает ответ проверки.'],
    ['control','Обработка и контроль','Сверить с преподавателем условия, подготовку, припуск, необратимость съёма и требование свежего контроля.'],
    ['code','Чтение G-кода','Сверить с преподавателем диалект, единицы, режимы, прогнозы и критерии эквивалентных решений.'],
    ['transfer','Сопоставимость итогов','Новые условия требуют изученных знаний, а помощь и ошибки отражаются в результате.']
  ].map(([id,title,description])=>({id,title,description}));
  const kinds={navigation:'Нашёл начало и следующий шаг сам',navigationHelp:'Потребовалось объяснить навигацию',firstCut:'Первый проход получен',stuck:'Затруднение',interfaceHelp:'Помощь с интерфейсом',solutionHelp:'Подсказка решения',defect:'Ошибка продукта',note:'Наблюдение'};
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const demand=(v,message)=>{if(!v)throw Error(message||'Некорректный файл наблюдений.');};
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  const text=(v,max=2000)=>typeof v==='string'&&v.length<=max;
  const now=()=>new Date().toISOString();
  function empty(){return {format:FORMAT,version:1,selected:'',review:Object.fromEntries(checks.map(c=>[c.id,{status:'pending',note:''}])),participants:[]};}
  function snapshot(input,at=now()){
    demand(date(at));const a=progress.validate(input),s=progress.summary(a),seen={training:new Set(),gcode:new Set()};
    for(const name of ['training','gcode'])for(const b of [a.sections[name].current,...a.sections[name].history]){
      const allowed=name==='training'?practical:program;
      for(const id of allowed){
        if(b.selected===id||Object.hasOwn(b.sessions||{},id)||Object.hasOwn(b.drafts||{},id)||Object.hasOwn(b.archive||{},id)||Object.hasOwn(b.phases||{},id)||Object.hasOwn(b.predictionDrafts||{},id)||Object.hasOwn(b.legacy?.drafts||{},id)||Object.hasOwn(b.legacy?.passed||{},id)||Object.hasOwn(b.legacy?.helped||{},id))seen[name].add(id);
      }
    }
    return {at,sourceAt:a.createdAt,appVersion:text(input.appVersion,32)?input.appVersion:'не указана',done:s.progress.done,rows:s.rows.map(r=>({id:r.id,title:r.title,done:r.done,detail:r.detail})),training:s.training.filter(r=>practical.includes(r.id)).map(r=>({id:r.id,passed:r.passed,independent:r.independent})),gcode:s.gcode.filter(r=>program.includes(r.id)).map(r=>({id:r.id,passed:r.passed,independent:r.independent})),seen:{training:[...seen.training],gcode:[...seen.gcode]}};
  }
  const session=()=>({before:null,after:null,start:null,end:null,events:[]});
  function add(state,id,mode){
    const n=validate(state);demand(/^[a-zA-Z0-9_-]{1,24}$/.test(id),'Код: 1–24 латинских буквы, цифры, _ или -.');demand(['self','novice'].includes(mode));demand(n.participants.length<16,'В одном журнале не более 16 участников.');demand(!n.participants.some(p=>p.id.toLowerCase()===id.toLowerCase()),'Этот код уже используется.');
    n.participants.push({id,mode,main:session(),followup:session(),assignment:null});n.selected=id;return n;
  }
  const find=(s,id)=>{const p=s.participants.find(p=>p.id===id);demand(p,'Выберите участника.');return p;};
  function continuous(before,after){
    demand(Date.parse(after.sourceAt)>=Date.parse(before.sourceAt),'Файл создан раньше исходного снимка.');
    demand(before.rows.every(r=>!r.done||after.rows.find(t=>t.id===r.id)?.done),'Ранее подтверждённые шаги отсутствуют: проверьте участника и профиль.');
    for(const k of ['training','gcode']){demand(before.seen[k].every(id=>after.seen[k].includes(id)),'В файле отсутствует прежняя история условий.');demand(before[k].every(r=>{const t=after[k].find(t=>t.id===r.id);return (!r.passed||t?.passed)&&(!r.independent||t?.independent);}), 'Из файла исчезло прежнее подтверждение самостоятельного условия.');}
  }
  function capture(state,id,phase,slot,archive,at=now()){
    const n=validate(state),p=find(n,id);demand(['main','followup'].includes(phase)&&['before','after'].includes(slot));const s=p[phase],shot=snapshot(archive,at);
    demand(!s.end,'Завершённое наблюдение нельзя переписать. Создайте новый код для другого прогона.');
    if(slot==='before'){
      demand(!s.start,'Исходный снимок фиксируется до начала.');if(s.before)continuous(s.before,shot);
      if(phase==='followup'){
        demand(p.assignment&&p.main.end,'Сначала назначьте повторную проверку.');continuous(p.main.after,shot);
        if(shot.seen.training.includes(p.assignment.training)||shot.seen.gcode.includes(p.assignment.gcode)){
          const training=practical.find(id=>!shot.seen.training.includes(id)),gcode=program.find(id=>!shot.seen.gcode.includes(id));demand(training&&gcode,'Назначенные условия уже открывались, и новой пары не осталось. Нужны новые задания; очищать историю нельзя.');
          const previous=p.assignment.previous||[];demand(previous.length<8,'Лимит замен условий. Сохраните журнал и подготовьте новые задания.');p.assignment={...p.assignment,training,gcode,previous:[...previous,{training:p.assignment.training,gcode:p.assignment.gcode,at}]};
        }
      }
    }else{
      demand(s.start&&s.before,'Сначала начните наблюдение с исходным снимком.');continuous(s.before,shot);if(s.after)continuous(s.after,shot);
      demand(Date.parse(shot.sourceAt)>=Date.parse(s.start),'Скачайте новый JSON после выполнения задания.');
      demand(Date.parse(shot.sourceAt)<=Date.parse(at)+300000,'Дата файла находится в будущем. Проверьте часы.');
    }
    s[slot]=shot;return n;
  }
  function start(state,id,phase,at=now()){
    const n=validate(state),p=find(n,id);demand(['main','followup'].includes(phase));const s=p[phase];demand(date(at)&&s.before&&!s.start,'Добавьте исходный JSON до начала наблюдения.');
    const age=Date.parse(at)-Date.parse(s.before.sourceAt);demand(age>=-300000&&age<=1800000,'Нужен свежий исходный JSON: скачайте его перед началом (до 30 минут).');
    demand(Date.parse(at)>=Date.parse(s.before.at),'Проверьте часы: начало раньше чтения снимка.');
    if(phase==='followup')demand(p.assignment&&Date.parse(at)>Date.parse(p.main.end),'Сначала завершите основное занятие и назначьте условия.');s.start=at;return n;
  }
  function observe(state,id,phase,kind,target,note,at=now()){
    const n=validate(state),p=find(n,id);demand(['main','followup'].includes(phase));const s=p[phase];demand(s.start&&!s.end,'Сначала начните наблюдение.');demand(Object.hasOwn(kinds,kind)&&['all','training','gcode'].includes(target)&&text(note)&&date(at));demand(Date.parse(at)>=Date.parse(s.start),'Время события раньше начала.');demand(s.events.length<200,'Лимит: 200 наблюдений на занятие.');
    demand(!['stuck','defect','solutionHelp','interfaceHelp'].includes(kind)||note.trim().length>0,'Укажите экран и конкретное затруднение или помощь.');s.events.push({at,kind,target,note:note.trim()});return n;
  }
  function finish(state,id,phase,at=now()){
    const n=validate(state),s=find(n,id)[phase];demand(s&&s.start&&s.after&&!s.end&&date(at),'Перед завершением добавьте итоговый JSON.');demand(Date.parse(at)>=Date.parse(s.after.at)&&s.events.every(e=>Date.parse(e.at)<=Date.parse(at)),'Проверьте время окончания.');s.end=at;return n;
  }
  function assign(state,id){
    const n=validate(state),p=find(n,id),s=p.main;demand(s.end&&s.after,'Сначала завершите основное наблюдение.');demand(!p.assignment,'Условия уже назначены.');
    demand(s.after.training.some(r=>r.independent)&&s.after.gcode.some(r=>r.independent),'Сначала подтвердите оба самостоятельных итога основного курса.');
    const training=practical.find(id=>!s.after.seen.training.includes(id)),gcode=program.find(id=>!s.after.seen.gcode.includes(id));
    demand(training&&gcode,'Не осталось пары незнакомых условий. Нужны новые задания следующего выпуска; историю не очищать.');
    p.assignment={training,gcode,from:new Date(Date.parse(s.end)+3*DAY).toISOString(),to:new Date(Date.parse(s.end)+7*DAY).toISOString(),previous:[]};return n;
  }
  function outcome(p,phase){
    const s=p[phase],finished=!!s.end&&!!s.after,help=target=>s.events.some(e=>['solutionHelp','interfaceHelp'].includes(e.kind)&&['all',target].includes(e.target));
    const result=(name,ids)=>finished&&ids.some(id=>s.after[name].find(r=>r.id===id)?.independent&&!s.before[name].find(r=>r.id===id)?.independent)&&!help(name);
    const windowOK=phase==='followup'&&!!p.assignment&&!!s.start&&Date.parse(s.start)>=Date.parse(p.assignment.from)&&Date.parse(s.start)<=Date.parse(p.assignment.to);
    return {finished,navigation:finished&&s.events.some(e=>e.kind==='navigation')&&!s.events.some(e=>['navigationHelp','interfaceHelp'].includes(e.kind)),firstCut:finished&&!s.before.rows.find(r=>r.id==='first-cut').done&&s.after.rows.find(r=>r.id==='first-cut').done,
      training:result('training',phase==='followup'?[p.assignment?.training]:practical),gcode:result('gcode',phase==='followup'?[p.assignment?.gcode]:program),windowOK,delayed:finished&&windowOK&&result('training',[p.assignment?.training])&&result('gcode',[p.assignment?.gcode]),minutes:s.end?(Date.parse(s.end)-Date.parse(s.start))/60000:null};
  }
  function metrics(state){
    const n=validate(state),people=n.participants.filter(p=>p.mode==='novice'),started=people.filter(p=>p.main.start),ended=started.filter(p=>p.main.end),follow=people.filter(p=>p.followup.end),result=ended.map(p=>outcome(p,'main'));
    return {novices:people.length,self:n.participants.length-people.length,started:started.length,ended:ended.length,pending:started.length-ended.length,navigation:result.filter(r=>r.navigation).length,firstCut:result.filter(r=>r.firstCut).length,training:result.filter(r=>r.training).length,gcode:result.filter(r=>r.gcode).length,followup:follow.length,delayed:follow.filter(p=>outcome(p,'followup').delayed).length};
  }
  // Pilot archives contain observations and compact summaries, never executable solutions.
  function validate(raw){
    demand(object(raw)&&raw.format===FORMAT&&raw.version===1&&object(raw.review)&&Array.isArray(raw.participants)&&raw.participants.length<=16);
    const n=empty();for(const c of checks){const r=raw.review[c.id];demand(object(r)&&['pending','approved','changes'].includes(r.status)&&text(r.note));demand(r.status!=='changes'||r.note.trim(),'Для замечания нужна конкретная причина.');n.review[c.id]={status:r.status,note:r.note};}
    function shot(s){
      if(s===null)return null;demand(object(s)&&date(s.at)&&date(s.sourceAt)&&text(s.appVersion,32)&&Number.isInteger(s.done)&&s.done>=0&&Array.isArray(s.rows)&&[22,51,57].includes(s.rows.length)&&s.done<=s.rows.length&&object(s.seen));
      const current=progress.summary(progress.empty()).rows,expected=s.rows.length===22?current.filter(r=>r.kind!=='coursePractice'):s.rows.length===51?current.filter(r=>r.group!=='turningDeep'):current;demand(expected.length===s.rows.length);demand(s.rows.every((r,i)=>object(r)&&r.id===expected[i].id&&text(r.title,200)&&typeof r.done==='boolean'&&text(r.detail,1000))&&s.done===s.rows.filter(r=>r.done).length);
      for(const [name,ids]of [['training',practical],['gcode',program]]){demand(Array.isArray(s[name])&&s[name].length===ids.length&&s[name].every((r,i)=>object(r)&&r.id===ids[i]&&typeof r.passed==='boolean'&&typeof r.independent==='boolean'&&(!r.independent||r.passed)));demand(Array.isArray(s.seen[name])&&s.seen[name].every(id=>ids.includes(id))&&new Set(s.seen[name]).size===s.seen[name].length);demand(s[name].every(r=>!r.passed||s.seen[name].includes(r.id)));}
      return {at:s.at,sourceAt:s.sourceAt,appVersion:s.appVersion,done:s.done,rows:s.rows.map(r=>({id:r.id,title:r.title,done:r.done,detail:r.detail})),training:s.training.map(r=>({id:r.id,passed:r.passed,independent:r.independent})),gcode:s.gcode.map(r=>({id:r.id,passed:r.passed,independent:r.independent})),seen:{training:[...s.seen.training],gcode:[...s.seen.gcode]}};
    }
    for(const p of raw.participants){
      demand(object(p)&&/^[a-zA-Z0-9_-]{1,24}$/.test(p.id)&&!n.participants.some(t=>t.id.toLowerCase()===p.id.toLowerCase())&&['self','novice'].includes(p.mode));const q={id:p.id,mode:p.mode,assignment:null};
      for(const phase of ['main','followup']){const s=p[phase];demand(object(s)&&[s.start,s.end].every(v=>v===null||date(v))&&Array.isArray(s.events)&&s.events.length<=200);q[phase]={before:shot(s.before),after:shot(s.after),start:s.start,end:s.end,events:[]};
        demand(!s.start||s.before);demand(!s.after||s.start);demand(!s.end||s.start&&s.after&&Date.parse(s.end)>=Date.parse(s.start)&&Date.parse(s.end)>=Date.parse(s.after.at));
        if(s.start)demand(Date.parse(s.before.at)<=Date.parse(s.start)&&Date.parse(s.start)-Date.parse(s.before.sourceAt)>=-300000&&Date.parse(s.start)-Date.parse(s.before.sourceAt)<=1800000);
        if(s.after)demand(Date.parse(s.after.at)>=Date.parse(s.start)&&Date.parse(s.after.sourceAt)<=Date.parse(s.after.at)+300000);
        if(s.after){continuous(s.before,s.after);demand(Date.parse(s.after.sourceAt)>=Date.parse(s.start));}
        for(const e of s.events){demand(object(e)&&date(e.at)&&Object.hasOwn(kinds,e.kind)&&['all','training','gcode'].includes(e.target)&&text(e.note)&&s.start&&Date.parse(e.at)>=Date.parse(s.start)&&(!s.end||Date.parse(e.at)<=Date.parse(s.end)));q[phase].events.push({at:e.at,kind:e.kind,target:e.target,note:e.note});}
      }
      if(p.assignment!==null){const a=p.assignment;demand(object(a)&&practical.includes(a.training)&&program.includes(a.gcode)&&q.main.end&&q.main.after.training.some(r=>r.independent)&&q.main.after.gcode.some(r=>r.independent)&&!q.main.after.seen.training.includes(a.training)&&!q.main.after.seen.gcode.includes(a.gcode)&&date(a.from)&&date(a.to)&&Date.parse(a.from)===Date.parse(q.main.end)+3*DAY&&Date.parse(a.to)===Date.parse(q.main.end)+7*DAY);const previous=a.previous||[];demand(Array.isArray(previous)&&previous.length<=8&&previous.every(r=>object(r)&&practical.includes(r.training)&&program.includes(r.gcode)&&date(r.at)));q.assignment={training:a.training,gcode:a.gcode,from:a.from,to:a.to,previous:previous.map(r=>({training:r.training,gcode:r.gcode,at:r.at}))};}
      demand(!q.followup.before||q.assignment);if(q.followup.before){continuous(q.main.after,q.followup.before);demand(!q.followup.before.seen.training.includes(q.assignment.training)&&!q.followup.before.seen.gcode.includes(q.assignment.gcode));}if(q.followup.start)demand(Date.parse(q.followup.start)>Date.parse(q.main.end));n.participants.push(q);
    }
    demand(raw.selected===''||n.participants.some(p=>p.id===raw.selected));n.selected=raw.selected;demand(new TextEncoder().encode(JSON.stringify(n)).length<=MAX_BYTES,'Журнал наблюдений слишком большой. Скачайте его и начните отдельный журнал в другом профиле.');return n;
  }
  function parse(source){demand(typeof source==='string'&&new TextEncoder().encode(source).length<=MAX_BYTES,'Файл наблюдений должен быть до 2 МБ.');demand(!/"(?:__proto__|prototype|constructor)"\s*:/.test(source),'Недопустимые поля.');return validate(JSON.parse(source));}
  function report(state){const n=validate(state),m=metrics(n),lines=['ЧПУ Практика — наблюдения этапа E','Локальные наблюдения и самопроверка. Личность и самостоятельность внешней системой не удостоверены.',`Новички: зарегистрировано ${m.novices}, начали ${m.started}, завершили ${m.ended}, незавершённых ${m.pending}. Самопроверок: ${m.self} (не входят в показатели новичков).`,`Среди ${m.ended} завершённых: навигация ${m.navigation}, первый проход ${m.firstCut}, новый цикл ${m.training}, новый G-код ${m.gcode}.`,`Повторная проверка: завершено ${m.followup}; оба итога без отмеченной помощи в окне 3–7 дней: ${m.delayed}.`,'','Проверка содержания (заполняет проверяющий):'];for(const c of checks)lines.push(`${c.title}: ${n.review[c.id].status}; ${n.review[c.id].note}`);
    for(const p of n.participants){lines.push('',`Участник ${p.id}: ${p.mode==='self'?'самопроверка':'новичок'}`);for(const phase of ['main','followup']){const s=p[phase],o=outcome(p,phase);lines.push(`${phase==='main'?'Основное':'Повторное'}: ${s.start||'не начато'} — ${s.end||'не завершено'}; ${o.minutes===null?'время не измерено':o.minutes.toFixed(1)+' мин'}; цикл ${o.training?'подтверждён':'не подтверждён'}; G-код ${o.gcode?'подтверждён':'не подтверждён'}`);if(phase==='followup'&&s.start)lines.push(o.windowOK?'Срок 3–7 дней соблюдён.':'Вне окна 3–7 дней: результат не входит в отложенное подтверждение.');for(const e of s.events)lines.push(`  ${e.at} · ${kinds[e.kind]} · ${e.target}: ${e.note}`);}if(p.assignment)lines.push(`Назначено ${p.assignment.training} и ${p.assignment.gcode}; окно ${p.assignment.from} — ${p.assignment.to}`);}
    return lines.join('\n');
  }
  const api={FORMAT,KEY,MAX_BYTES,checks,kinds,practical,program,empty,snapshot,add,capture,start,observe,finish,assign,outcome,metrics,validate,parse,report};root.CNCPilot=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
