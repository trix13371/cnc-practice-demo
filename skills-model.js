(function(root){
  'use strict';
  const math=typeof module==='object'&&module.exports?require('./training-math.js'):root.CNCTrainingMath;
  const skills=[
    ['depth','Съём на радиус','diameter','blueprint'],['allowance','Чистовой припуск','rough-finish','passes'],
    ['passes','Число проходов','pass-count','passes'],['feed','Минутная подача','feed','feed-time'],
    ['time','Время прохода','time','feed-time'],['offset','Коррекция по замерам','offset-diagnosis','offsets'],
    ['tolerance','Границы допуска','tolerance','measurement'],['rounding','Неопределённый замер','gauge','measurement'],
    ['coordinates','Координаты X и Z','axes','coordinates'],['modal','Чтение строк программы','modal','program-reading'],
    ['route','Зависимости маршрута','route','route'],['setup','Готовность и контроль','setup','trial-check']
  ].map(([id,title,lesson,article])=>({id,title,lesson,article}));
  const fmt=n=>String(Math.round(n*1e6)/1e6).replace('.',',');
  const round=n=>Math.round(n*1e6)/1e6;
  function question(id,v=0){
    if(!skills.some(s=>s.id===id)||!Number.isInteger(v)||v<0||v>=12)throw Error('Неизвестный вариант');
    const q={id,variant:v,key:id+':'+v,tolerance:1e-6};
    const numeric=(prompt,value,unit,hint,explanation)=>Object.assign(q,{prompt,value:round(value),unit,hint,explanation});
    const choice=(key,prompt,choices,answer,hint,explanation)=>{
      const shift=v%choices.length;q.key=id+':'+key;
      return Object.assign(q,{prompt,choices:choices.map((_,i)=>choices[(i+shift)%choices.length]),answer:(answer-shift+choices.length)%choices.length,hint,explanation});
    };
    if(id==='depth'){const before=40+2*(v%4),after=round(before-2-(v%6)*.8);return numeric(`Было Ø${fmt(before)}, требуется Ø${fmt(after)} мм. Какова глубина съёма на радиус?`,(before-after)/2,'мм','Разницу диаметров разделите пополам.',`(${fmt(before)} − ${fmt(after)}) / 2 = ${fmt((before-after)/2)} мм.`);}
    if(id==='allowance'){const target=24+2*(v%4),a=[.2,.4,.6][Math.floor(v/4)];return numeric(`Цель Ø${target} мм. На чистовой оставляют ${fmt(a)} мм по диаметру. Какой диаметр нужен после черновых?`,target+a,'мм','Припуск здесь задан по диаметру.',`${target} + ${fmt(a)} = ${fmt(target+a)} мм. Радиальный съём чистового вдвое меньше припуска по диаметру.`);}
    if(id==='passes'){const target=24,stock=32+2*(v%4),depth=[1,1.5,2][Math.floor(v/4)],value=Math.ceil((stock-target-.4)/(2*depth));return numeric(`Заготовка Ø${stock}, цель Ø24 мм. Оставить 0,4 мм по диаметру на чистовой. Черновая глубина не более ${fmt(depth)} мм на радиус. Минимум черновых проходов?`,value,'проходов','Сначала вычтите чистовой припуск. Каждый черновой уменьшает диаметр максимум на две глубины.',`Округляем вверх (${stock} − 24 − 0,4) / (2 × ${fmt(depth)}): ${value} прохода. Последний может быть неполной глубины.`);}
    if(id==='feed'){const f=[.1,.12,.2][v%3],n=[600,800,1000,1200][Math.floor(v/3)];return numeric(`Подача ${fmt(f)} мм/об, частота ${n} об/мин. Чему равна минутная подача?`,f*n,'мм/мин','Умножьте мм/об на об/мин.',`${fmt(f)} × ${n} = ${fmt(f*n)} мм/мин.`);}
    if(id==='time'){const l=[24,30,36][v%3],f=v%2?.2:.1,n=v<6?600:900,t=Math.round(60*l/(f*n)*10)/10;return numeric(`Длина прямого рабочего хода ${l} мм, подача ${fmt(f)} мм/об, ${n} об/мин. Время только этого хода в секундах? Округлите до 0,1 с.`,t,'с','t = 60 × длина / (подача × обороты). Разгон, подвод и отвод не учитываются.',`60 × ${l} / (${fmt(f)} × ${n}) ≈ ${fmt(t)} с.`);}
    if(id==='offset'){const bias=[-.4,-.2,.2,.4][v%4],base=24+2*Math.floor(v/4);return numeric(`В модели фактический диаметр = программный X + коррекция + постоянная ошибка. При нулевой коррекции X${base} дал Ø${fmt(base+bias)}, X${base+2} дал Ø${fmt(base+2+bias)}. Какую коррекцию задать для компенсации этой ошибки?`,-bias,'мм','Найдите одинаковое отклонение обоих замеров, затем смените знак.',`Оба отклонения ${fmt(bias)} мм. Коррекция ${fmt(-bias)} мм компенсирует их в этой модели. Уже снятый материал это не возвращает.`);}
    if(id==='tolerance'){const nom=28+2*Math.floor(v/4),tol=[.05,.1,.2][Math.floor(v/4)],delta=[-2,0,1,2][v%4]*tol,actual=round(nom+delta),answer=delta < -tol?0:delta>tol?2:1;return choice(`${nom}:${tol}:${actual}`,`Размер ${nom} ±${fmt(tol)} мм. Точный размер детали ${fmt(actual)} мм. Какой вывод?`,['Меньше нижней границы','В пределах допуска','Больше верхней границы'],answer,'Границы допуска включены в допустимый интервал.',`Допустимо от ${fmt(nom-tol)} до ${fmt(nom+tol)} мм включительно. Здесь дан точный размер, а не округлённое показание прибора.`);}
    if(id==='rounding'){const target=28+2*Math.floor(v/6),resolution=v%2?.01:.1,reading=round(target+[-.3,-.1,0,.1,.3,.06][v%6]),c=math.classify(reading,resolution,target,.1),labels={small:0,ok:1,large:2,uncertain:3};return choice(`${target}:${reading}:${resolution}`,`Цель ${target} ±0,1 мм. Прибор округляет показание до ${fmt(resolution)} мм и показывает ${fmt(reading)} мм. Какой вывод по учебной модели округления?`,['Определённо меньше допуска','Весь интервал в допуске','Определённо больше допуска','Интервал пересекает границу: уточнить замер'],labels[c],'Рассмотрите показание ± половина шага округления. Это не полная оценка погрешности реального прибора.',`Интервал округления: ${fmt(reading-resolution/2)}…${fmt(reading+resolution/2)} мм. Допуск ${fmt(target-.1)}…${fmt(target+.1)} мм. ${c==='uncertain'?'Одного показания недостаточно для однозначного вывода.':'Сравните весь интервал с обеими границами.'}`);}
    if(id==='coordinates'){const d=24+v,l=20+3*v;return v%2?numeric(`В модели ноль Z на торце, обработка идёт в отрицательную сторону. Какой Z соответствует длине ${l} мм от торца?`,-l,'мм','Направление от торца в глубину здесь отрицательное.',`Z = −${l} мм. Это условие данного упражнения.`):numeric(`X задан по диаметру. Для Ø${d} мм с нулевой коррекцией какой программный X нужен?`,d,'мм','Диаметральный X равен диаметру.',`X = ${d} мм; делить на два в диаметральном режиме не нужно.`);}
    if(id==='modal'){
      const cases=[
        ['G01 X28 F0.2 → Z-30','Продолжится линейное движение G01','Будет быстрый ход G00','Движения не будет',0,'Ранее выбранный G01 остаётся действующим.'],
        ['G00 X40 → Z5','Будет рабочая подача G01','Продолжится быстрый ход G00','Станок обязательно остановится',1,'Ранее выбранный G00 остаётся действующим.'],
        ['G01 Z-20 F0.1 → Z-40 F0.2','Подача останется F0.1','Подача станет F0.2','Подача станет нулевой',1,'Новое F заменяет прежнее значение; его единицы требуют знания активного режима подачи.']
      ],c=cases[v%3];return choice(v%3,`Прочитайте условный фрагмент: ${c[0]}. Вторая строка следует сразу за первой, режимы не менялись. Что верно?`,c.slice(1,4),c[4],'Проверьте действующий режим движения и новое значение F.',c[5]+' Фрагмент иллюстративный; это не программа для запуска.');
    }
    if(id==='route'){
      const cases=[
        ['По условию канавку делают на предварительно обточенном пояске. Что раньше?',['Обточить поясок','Выполнить канавку','Порядок произвольный'],0,'Исходная поверхность канавки — уже готовый поясок.'],
        ['В маршруте прямо задано: расточить отверстие, затем обточить наружный диаметр. Что раньше?',['Обточить снаружи','Расточить отверстие','Выполнить обе операции одновременно'],1,'Выполните заданную технологическую зависимость. Это условие маршрута, а не правило для всех втулок.'],
        ['Чистовой проход снимает оставленные 0,4 мм по диаметру. Что раньше?',['Снять весь припуск чистовым без черновых','Снять до размера черновым без остатка','Выполнить черновые, сохранив чистовой припуск'],2,'Черновая обработка подготавливает поверхность и сохраняет предусмотренный запас.']
      ],c=cases[v%3];return choice(v%3,c[0],c[1],c[2],'Найдите явно заданную зависимость между операциями.',c[3]);
    }
    const cases=[
      ['Нужен замер ручным микрометром, шпиндель ещё вращается. Что сначала?',['Дождаться полной остановки и выполнить инструкцию станка','Измерить на малых оборотах','Только отвести резец'],0,'Отвод резца не означает остановку шпинделя.'],
      ['В практикуме заготовку освободили и закрепили заново. Что подтвердить?',['Только прежнюю подачу','Закрепление и ноль детали','Только цвет поверхности'],1,'После переустановки прежнее положение детали нельзя считать подтверждённым.'],
      ['После замера выполнен ещё один проход. Можно ли принять новый размер по старому замеру?',['Да, если подача прежняя','Да, если инструмент тот же','Нет, нужен замер после последнего прохода'],2,'Снятие материала изменило состояние детали: нужен свежий контроль.'],
      ['В учебном станке заготовка не закреплена. Что делать перед запуском?',['Снизить обороты и запустить','Подтвердить закрепление по условиям задания','Увеличить подачу'],1,'Наличие программы не подтверждает готовность станка и крепления.']
    ],c=cases[v%4];return choice(v%4,c[0],c[1],c[2],'Проверьте исходное состояние, а не только заданные числа.',c[3]);
  }
  function evaluate(q,input){
    if(q.choices){const valid=Number.isInteger(input)&&input>=0&&input<q.choices.length;return {valid,correct:valid&&input===q.answer};}
    const n=math.parseNumber(input),valid=Number.isFinite(n);return {valid,correct:valid&&Math.abs(n-q.value)<=q.tolerance};
  }
  function create(){return {version:1,selected:skills[0].id,practice:Object.fromEntries(skills.map(s=>[s.id,{variant:0,tries:0,hinted:false,done:false,last:null}])),records:[],exam:null,exams:[],round:0,events:[]};}
  function reduce(state,a){
    if(!a||typeof a!=='object')throw Error('Нет действия');
    const s=JSON.parse(JSON.stringify(state)),p=s.practice[s.selected];
    if(a.type==='select'&&!s.exam&&skills.some(k=>k.id===a.id))s.selected=a.id;
    else if(a.type==='hint'&&!s.exam&&!p.done)p.hinted=true;
    else if(a.type==='next'&&!s.exam&&p.done){p.variant=(p.variant+1)%12;p.tries=0;p.hinted=false;p.done=false;p.last=null;}
    else if(a.type==='answer'&&!s.exam&&!p.done){const q=question(s.selected,p.variant),r=evaluate(q,a.input);if(!r.valid)throw Error('Введите ответ');s.records.push({id:q.id,key:q.key,correct:r.correct,clean:r.correct&&p.tries===0&&!p.hinted,source:'practice'});p.tries++;p.done=r.correct;p.last={input:a.input,correct:r.correct};}
    else if(a.type==='exam-start'&&!s.exam){s.exam={round:s.round++,answers:[]};}
    else if(a.type==='exam-answer'&&s.exam){const i=s.exam.answers.length,q=examQuestions(s.exam.round)[i],r=evaluate(q,a.input);if(!r.valid)throw Error('Введите ответ');s.exam.answers.push(a.input);if(s.exam.answers.length===skills.length){const questions=examQuestions(s.exam.round),results=questions.map((q,i)=>({id:q.id,key:q.key,correct:evaluate(q,s.exam.answers[i]).correct,clean:evaluate(q,s.exam.answers[i]).correct,source:'checkpoint'}));s.records.push(...results);s.exams.push({round:s.exam.round,answers:s.exam.answers});s.exams=s.exams.slice(-5);s.exam=null;}}
    else if(a.type==='exam-cancel'&&s.exam)s.exam=null;
    else throw Error('Действие сейчас недоступно');
    return s;
  }
  function transition(state,action){if(state.events.length>=10000)throw Error('Достигнут предел журнала (10 000 действий). Экспортируйте результаты.');const next=reduce(state,action);next.events.push(JSON.parse(JSON.stringify(action)));return next;}
  function examQuestions(round){return skills.map((_,i)=>{const skill=skills[(i+round)%skills.length];return question(skill.id,(round*5+i+1)%12);});}
  function snapshot(state){return {version:1,events:state.events};}
  function restore(raw){let state=create();if(raw?.version!==1||!Array.isArray(raw.events))return state;for(const a of raw.events.slice(0,10000)){try{state=transition(state,a);}catch{break;}}return state;}
  function mastery(state,id){let unique=new Set(),ever=false,attempts=0,correct=0;for(const r of state.records.filter(r=>r.id===id)){attempts++;if(r.correct)correct++;if(!r.clean)unique.clear();else unique.add(r.key);if(unique.size>=3)ever=true;}return {status:unique.size>=3?'mastered':ever?'review':attempts?'learning':'new',streak:Math.min(3,unique.size),attempts,correct};}
  function recommend(state){const order={review:0,learning:1,new:2,mastered:3};return skills.slice().sort((a,b)=>order[mastery(state,a.id).status]-order[mastery(state,b.id).status]||mastery(state,a.id).streak-mastery(state,b.id).streak)[0];}
  const api={skills,question,evaluate,create,transition,snapshot,restore,mastery,recommend,examQuestions};if(typeof module==='object'&&module.exports)module.exports=api;root.CNCSkills=api;
})(typeof globalThis==='object'?globalThis:this);
