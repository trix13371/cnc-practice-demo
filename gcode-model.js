(function(root){
  'use strict';
  const EPS=1e-7,MAX_SOURCE=12000,MAX_LINES=120;
  const dialect=Object.freeze({
    id:'cnc-practice-lathe-subset-v1',
    gGroups:Object.freeze({0:'motion',1:'motion',18:'plane',21:'units',97:'speed',98:'feed',99:'feed'}),
    mCodes:Object.freeze([3,5,30]),
    bounds:Object.freeze({x:Object.freeze([0,60]),z:Object.freeze([-60,10]),feed:Object.freeze([0,1000]),rpm:Object.freeze([1,5000])}),
    initial:Object.freeze({x:40,z:5,motion:null,feed:null,feedMode:99,rpm:0,spindle:false,units:21,plane:18,speedMode:97,ended:false}),
    defaultStock:Object.freeze({d:32,length:40}),
    maxSource:MAX_SOURCE,maxLines:MAX_LINES,epsilon:EPS
  });
  const near=(a,b)=>Math.abs(a-b)<EPS;
  const point=(x,z)=>({x,z});
  const segment=(x,z,mode=1,feed)=>({x,z,mode,...(feed===undefined?{}:{feed})});
  const sources=[
    {title:'Haas: чтение программы и абсолютные X/Z',url:'https://haascnc.com/service/online-operator-s-manuals/lathe-operator-s-manual/lathe---programming.html'},
    {title:'Haas: G00 — быстрое позиционирование',url:'https://haascnc.com/service/codes-settings.type=gcode.machine=lathe.value=G00.html'},
    {title:'Haas: G01 — линейное движение с подачей',url:'https://haascnc.com/service/codes-settings.type=gcode.machine=lathe.value=G01.html'},
    {title:'Haas: G99 — подача на оборот',url:'https://haascnc.com/service/codes-settings.type=gcode.machine=lathe.value=G99.html'}
  ];
  const commands=[['G00 / G0','Быстрое позиционирование. F не превращает его в рабочую подачу.'],['G01 / G1','Прямолинейное движение с заданной подачей F. Режим сохраняется.'],['X / Z','Конечные абсолютные координаты. X — диаметр в мм; Z — вдоль детали от её торца.'],['F','Подача: при G99 — мм/об, при G98 — мм/мин. Десятичный разделитель в коде — точка.'],['G21 / G18','Миллиметры / рабочая плоскость XZ.'],['G97 / S','Постоянные обороты: S задаёт об/мин.'],['M03 / M05','Включить вращение по часовой стрелке / остановить шпиндель.'],['M30','Конец программы. Последующие команды в этом тренажёре считаются ошибкой.'],['(текст)','Комментарий: пояснение для читающего программу.']];
  const tasks=[
    {id:'coordinates',title:'Буква и число',level:'Первое знакомство',intro:['Программа ЧПУ состоит из строк. В строке есть слова: буква называет величину или действие, число задаёт её значение. В X36 буква X относится к поперечному размеру, число 36 означает диаметр 36 мм.','Здесь X и Z задают конечную точку относительно нуля детали. Начальная точка уже известна. Меняя Z, вы меняете положение вдоль заготовки. Сначала потренируемся в свободном пространстве.'],example:'G00 X38 Z4',walk:'G00 выбирает быстрое позиционирование. X38 задаёт диаметр координаты, Z4 — положение на 4 мм перед торцом. Числа описывают точку, а не расстояние от предыдущего положения.',brief:'Исправьте только конечную точку: из X40 Z5 переместитесь в X36 Z3 быстрым позиционированием. Весь путь находится перед торцом.',initial:point(40,5),starter:'G00 X36 Z0',demo:'G00 X38 Z4',expected:[segment(36,3,0)],hint:'После Z должно стоять положение вдоль оси. Условие просит точку на 3 мм перед торцом.',answer:'G00 X36 Z3',reading:'gcode-start'},
    {id:'motion',title:'Два разных движения',level:'Начальный',intro:['G00 используют для быстрого позиционирования. G01 задаёт прямолинейное движение с подачей. Координата сама по себе не определяет, каким будет движение.','Слово F задаёт подачу. Но F в строке с G00 не превращает быстрое позиционирование в рабочий ход. Сейчас рассматриваем только фрагмент траектории, без расчёта съёма материала.'],example:'G01 Z-8 F0.1',walk:'Известна текущая координата X. Меняется только Z. Команда G01 задаёт линейный ход, F0.1 — подачу 0,1 мм/об при уже выбранном G99.',brief:'Из X30 Z0 выполните один линейный рабочий ход до Z−15 с подачей 0,1 мм/об. Исправьте вид движения, сохранив координаты и подачу.',initial:point(30,0),starter:'G00 Z-15 F0.1',demo:'G01 Z-8 F0.1',expected:[segment(30,-15,1,.1)],hint:'Быстрое позиционирование и рабочий ход — разные команды. F не меняет действие G00.',answer:'G01 Z-15 F0.1',reading:'gcode-start'},
    {id:'modal',title:'Режим запоминается',level:'Начальный',intro:['После G01 следующие координатные строки продолжают линейное движение, пока не встретится другая команда той же группы. Не нужно повторять G01 в каждой строке.','Координата, которую не меняют, остаётся прежней. Если в строке есть только X, координата Z сохраняется. Подача F тоже действует до её изменения.'],example:'G01 Z-6 F0.1\nX28',walk:'Сначала получаем X30 Z−6. Затем меняется X до 28; Z остаётся −6. Во второй строке нет G01 и F, но их значения продолжают действовать.',brief:'Из X30 Z0 идите с подачей 0,1 до X30 Z−10, затем до X28 Z−10. Оба участка — G01. Исправьте случайное переключение режима во второй строке.',initial:point(30,0),starter:'G01 Z-10 F0.1\nG00 X28',demo:'G01 Z-6 F0.1\nX28',expected:[segment(30,-10,1,.1),segment(28,-10,1,.1)],hint:'Во второй строке можно убрать переключение на G00: прежний G01 продолжит действовать.',answer:'G01 Z-10 F0.1\nX28',reading:'program-reading'},
    {id:'feed',title:'У подачи есть единицы',level:'Начальный+',intro:['Одинаковое число F имеет разный смысл в разных режимах. В этом токарном диалекте G99 означает миллиметры за оборот, G98 — миллиметры за минуту.','Чтобы читать F, сначала найдите действующий режим подачи. В этой задаче важен смысл единиц: подходящие для реальной обработки режимы здесь не подбираем.'],example:'G99\nG01 Z-7 F0.08',walk:'G99 выбирает мм/об. Поэтому F0.08 читается как 0,08 мм за оборот. Если заменить G99 на G98, это число будет означать 0,08 мм в минуту.',brief:'Из X30 Z0 выполните линейный ход до Z−12. Требуется подача 0,12 мм за оборот. В начале фрагмента явно выберите её единицы.',initial:point(30,0),starter:'G98\nG01 Z-12 F0.12',demo:'G99\nG01 Z-7 F0.08',expected:[segment(30,-12,1,.12)],requireFeedMode:99,hint:'Проверьте команду перед движением: нужен режим подачи на оборот.',answer:'G99\nG01 Z-12 F0.12',reading:'program-reading'},
    {id:'spindle',title:'Команды вращения и завершения',level:'Начальный+',intro:['Не все команды перемещают инструмент. G97 выбирает постоянные обороты, S задаёт их число. M03 включает вращение, M05 останавливает шпиндель.','M30 завершает программу. В этом задании остановку записываем отдельной командой M05 перед завершением, чтобы явно показать последовательность. Осевых перемещений здесь нет.'],example:'G97 S500 M03\nM05\nM30',walk:'Сначала выбран режим постоянных 500 об/мин и включено вращение. Затем дана отдельная остановка. Последняя строка завершает программу. Эти значения — пример чтения, а не выбор режима обработки.',brief:'Задайте постоянные 600 об/мин, включите вращение M03, затем явно остановите его M05 и завершите M30. Добавьте пропущенное действие; движений X/Z быть не должно.',initial:point(40,5),starter:'G97 S600\nM03\nM30',demo:'G97 S500 M03\nM05\nM30',expected:[],spindleCycle:600,hint:'Между включением вращения и завершением нужна отдельная строка остановки шпинделя.',answer:'G97 S600\nM03\nM05\nM30',reading:'gcode-start'},
    {id:'retract',title:'Порядок отвода',level:'Начальный+',intro:['После рабочего участка инструмент условно находится у поверхности. Перед перемещением вдоль заготовки нужно разобраться, где проходит будущая траектория.','В этой геометрической задаче сначала увеличиваем X до диаметра за пределами исходной заготовки, затем возвращаемся по Z. Одновременный быстрый ход по двум осям нельзя считать гарантированной прямой: реальный G00 зависит от оборудования.'],example:'G00 X36\nZ4',walk:'Если исходная заготовка Ø32, координата X36 расположена снаружи. Вторая строка сохраняет G00 и меняет только Z. Это иллюстрация точечной траектории, без размеров державки и патрона.',brief:'Начало X28 Z−20 у заготовки Ø32. Сначала быстро отведите точку в X34 Z−20, затем в X34 Z5. Исправьте порядок; не возвращайтесь по Z внутри исходного диаметра.',initial:point(28,-20),starter:'G00 Z5\nX34',demo:'G00 X36\nZ4',expected:[segment(34,-20,0),segment(34,5,0)],hint:'Сначала нужно выйти за исходный диаметр по X. Только после этого изменять Z.',answer:'G00 X34\nZ5',reading:'program-reading'},
    {id:'contour',title:'Прямая и наклонный участок',level:'Средний',intro:['Если при G01 меняется только Z, на схеме получаем продольный участок. Если одновременно меняются X и Z, получается наклонная прямая.','Здесь строим траекторию условной точки инструмента. Радиус режущей кромки и компенсация не рассчитываются. Участок с двумя координатами помогает понять смысл линейной интерполяции.'],example:'G01 Z-6 F0.1\nX26 Z-16',walk:'Из начального X30 Z0 первый ход идёт к X30 Z−6. Второй соединяет эту точку с X26 Z−16 прямой. Это не два отдельных перемещения по осям.',brief:'Из X30 Z0 идите до X30 Z−10, затем одной наклонной прямой до X26 Z−20. Оба участка с подачей 0,1 мм/об. Исправьте конечную Z второго участка.',initial:point(30,0),starter:'G01 Z-10 F0.1\nX26 Z-10',demo:'G01 Z-6 F0.1\nX26 Z-16',expected:[segment(30,-10,1,.1),segment(26,-20,1,.1)],hint:'Наклонному участку нужны две конечные координаты: и X, и Z.',answer:'G01 Z-10 F0.1\nX26 Z-20',reading:'program-reading'},
    {id:'program',title:'Соберите учебный маршрут',level:'Итог блока',intro:['Свяжем знакомые действия: объявить единицы и плоскость, включить вращение, подойти, выполнить рабочий ход, отвести точку, остановить вращение и завершить программу.','Проверяется последовательность и смысл движений. Корректная запись допускает разные пробелы, номера строк, комментарии, повторение G01 и деление прямого рабочего участка на части. Нельзя подменить рабочий участок быстрым ходом или добавить лишний заход.'],example:'G21 G18 G99\nG97 S500 M03\nG00 X36 Z3\nX30\nG01 Z-16 F0.08\nG00 X36\nZ5\nM05\nM30',walk:'В этом разборе другой диаметр и длина. Подход находится перед торцом, рабочий участок задаётся G01, возврат по Z выполняется после отвода X. Последние две строки явно показывают остановку и конец.',brief:'Начало X40 Z5. Объявите G21/G18/G99, включите постоянные 600 об/мин. Пройдите точки X34 Z2 → X28 Z2 → X28 Z−20 → X34 Z−20 → X34 Z5. Первые два и последние два участка — G00; продольный рабочий участок — G01 F0.1. Затем отдельные M05 и M30. В черновике две смысловые ошибки.',initial:point(40,5),starter:'G21 G18 G99\nG97 S600 M03\nG00 X34 Z2\nX28\nG00 Z-20 F0.1\nG00 X34\nZ5\nM30',demo:'G21 G18 G99\nG97 S500 M03\nG00 X36 Z3\nX30\nG01 Z-16 F0.08\nG00 X36\nZ5\nM05\nM30',expected:[segment(34,2,0),segment(28,2,0),segment(28,-20,1,.1),segment(34,-20,0),segment(34,5,0)],full:true,hint:'Проверьте вид продольного рабочего движения и отдельную остановку перед завершением.',answer:'G21 G18 G99\nG97 S600 M03\nG00 X34 Z2\nX28\nG01 Z-20 F0.1\nG00 X34\nZ5\nM05\nM30',reading:'program-reading'}
  ];
  const learningContext={
    coordinates:{lesson:'axes',bridge:'В первом проходе вы задавали конечный X. Теперь прочитайте такую же координату в строке программы и определите положение по Z.',selector:'firstMove',fields:['x','z']},
    motion:{lesson:'axes',bridge:'В цикле вы различали подход и рабочий проход. В программе вид движения задаётся отдельно от конечной точки: G00 или G01.',selector:'firstMove',fields:['z','motion']},
    modal:{lesson:'modal',bridge:'При последовательных проходах часть настроек оставалась прежней. Здесь проследите, какие координаты и режим движения сохраняются между строками.',selector:'lastMove',fields:['x','z']},
    feed:{lesson:'feed',bridge:'Вы уже выбирали подачу в мм/об. В программе число F читают вместе с действующим режимом единиц подачи.',selector:'firstMove',fields:['feed','feedMode']},
    spindle:{lesson:'safety',bridge:'В полном цикле запуск и остановка были вашими действиями. Здесь найдите команды этих действий и заданные обороты.',selector:'firstStart',fields:['rpm','spindle']},
    retract:{lesson:'axes',bridge:'После прохода точка находится у обработанной поверхности. Прочитайте, по какой оси начинается отвод, и сравните путь с исходной заготовкой.',selector:'firstMove',fields:['x','z']},
    contour:{lesson:'axes',bridge:'Две координаты в одном G01 задают одну наклонную прямую.',selector:'lastMove',fields:['x','z']},
    program:{lesson:'modal',bridge:'Свяжите знакомые подготовку, рабочий ход, отвод и остановку в последовательность строк.',selector:'workMove',fields:['x','z','motion']}
  };
  for(const t of tasks){const c=learningContext[t.id];t.context={lesson:c.lesson,bridge:c.bridge};t.prediction={selector:c.selector,fields:c.fields};}
  const finalCards=[
    {id:'transfer-a',title:'Программа для детали Ø24 × 35',stock:30,target:24,length:35,rpm:800,feed:.12,clearance:32,start:point(38,5),approach:2,training:'Большой припуск',fault:'motion-stop'},
    {id:'transfer-b',title:'Программа для детали Ø34 × 30',stock:35.2,target:34,length:30,rpm:700,feed:.1,clearance:38,start:point(42,6),approach:3,training:'Небольшой запас',fault:'units-retract'},
    {id:'transfer-c',title:'Программа для детали Ø22 × 50',stock:26,target:22,length:50,rpm:900,feed:.08,clearance:30,start:point(36,5),approach:2,training:'Меньшая глубина прохода',fault:'speed-length'}
  ];
  for(const card of finalCards){
    const {target:x,length,rpm,feed,clearance:q,approach:z,start}=card;
    const answer=`G21 G18 G99\nG97 S${rpm} M03\nG00 X${q} Z${z}\nX${x}\nG01 Z-${length} F${feed}\nG00 X${q}\nZ${start.z}\nM05\nM30`;
    let starter=answer;
    if(card.fault==='motion-stop')starter=starter.replace(`G01 Z-${length}`,`G00 Z-${length}`).replace('M05\n','');
    if(card.fault==='units-retract')starter=starter.replace('G99','G98').replace(`G00 X${q}\nZ${start.z}`,`G00 Z${start.z}\nX${q}`);
    if(card.fault==='speed-length')starter=starter.replace(`G97 S${rpm}`,`S${rpm}`).replace(`Z-${length}`,`Z-${length-5}`);
    tasks.push({id:card.id,title:card.title,level:'Самостоятельный итог',transfer:true,trainingCard:card.training,
      intro:['Диаметр и длина знакомы по карте полного цикла. Теперь исправьте программу движения точки по этому чертежу. Съём материала здесь не рассчитывается.','Прочитайте требования, исправьте черновик и подтвердите свой прогноз. Разбор примера, подсказка или ошибка проверки учитываются как помощь для этого условия.'],
      context:{lesson:'axes',bridge:`Карта «${card.training}»: заготовка Ø${card.stock}, цель Ø${x}, длина ${length} мм. В практикуме вы выполняли обработку; здесь проверяется запись знакомых движений.`},
      initial:start,stock:{d:card.stock,length},rpm,full:true,
      brief:`Исправьте две ошибки в черновике. До движения явно выберите G21/G18/G99/G97 и один раз включите M03 при ${rpm} об/мин. От начала X${start.x} Z${start.z} пройдите X${q} Z${z} → X${x} Z${z} → X${x} Z−${length} → X${q} Z−${length} → X${q} Z${start.z}. Продольный рабочий участок — G01 F${feed}; остальные участки — G00. После отвода: отдельная M05, затем M30.`,
      starter,answer,expected:[segment(q,z,0),segment(x,z,0),segment(x,-length,1,feed),segment(q,-length,0),segment(q,start.z,0)],
      prediction:{selector:'workMove',fields:['x','z','motion']},
      example:tasks[7].example,demo:tasks[7].demo,walk:tasks[7].walk,
      hint:'Сопоставьте строки с картой: единицы подачи, постоянные обороты, конечная Z рабочего участка, вид движения и порядок отвода. Остановка и завершение — разные команды.',reading:'program-reading'});
  }
  function tokenize(raw){
    let text='',comment=false;
    for(const c of raw){if(c==='('){if(comment)throw Error('Вложенные скобки комментария не поддерживаются.');comment=true;}else if(c===')'){if(!comment)throw Error('Закрывающая скобка без начала комментария.');comment=false;}else if(!comment)text+=c;}
    if(comment)throw Error('Закройте комментарий круглой скобкой.');
    text=text.trim().replace(/;\s*$/,'').trim().toUpperCase();
    if(!text||text==='%')return [];
    const words=[],pattern=/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/y;let pos=0;
    while(pos<text.length){if(/\s/.test(text[pos])){pos++;continue;}pattern.lastIndex=pos;const m=pattern.exec(text);if(!m)throw Error('Не удалось прочитать слово. Используйте латинские буквы, минус - и десятичную точку.');words.push({letter:m[1],value:Number(m[2]),raw:m[0]});pos=pattern.lastIndex;}
    return words;
  }
  function rapidRisk(from,to,stock){
    if(near(from.z,to.z)&&to.x>=from.x)return false; // outward point retraction
    return Math.min(from.x,to.x)<stock.d-EPS&&Math.min(from.z,to.z)<=EPS&&Math.max(from.z,to.z)>=-stock.length-EPS;
  }
  function simulate(source,options={}){
    const initial={...dialect.initial,...options.initial};
    const stock=options.stock||{...dialect.defaultStock};
    let state={...initial};const trace=[],moves=[],errors=[],warnings=[];
    const fail=(line,message)=>errors.push({line,message});
    if(typeof source!=='string'||source.length>MAX_SOURCE){fail(0,'Программа должна быть текстом не длиннее 12000 символов.');return {initial,state,stock,trace,moves,errors,warnings};}
    const lines=source.split(/\r?\n/);if(lines.length>MAX_LINES){fail(0,'В учебной программе допускается до 120 строк.');return {initial,state,stock,trace,moves,errors,warnings};}
    for(let i=0;i<lines.length;i++){
      const line=i+1;let words;
      try{words=tokenize(lines[i]);}catch(e){fail(line,e.message);break;}
      if(!words.length)continue;
      try{
        if(state.ended)throw Error('Команды после M30 не выполняются. Уберите лишнюю строку или перенесите завершение.');
        if(words[0].letter==='N'){if(!Number.isInteger(words[0].value)||words[0].value<0||words[0].value>99999)throw Error('Номер N должен быть целым от 0 до 99999.');words=words.slice(1);}
        if(!words.length)continue;
        if(words[0].letter==='O'&&words.length===1){if(trace.length)throw Error('В учебном файле допускается один номер O перед исполняемыми строками.');if(!Number.isInteger(words[0].value)||words[0].value<1||words[0].value>99999)throw Error('Номер O должен быть целым от 1 до 99999.');trace.push({line,raw:lines[i],before:{...state},after:{...state},move:null,codes:['O']});continue;}
        const next={...state},single={},groups=new Set(),codes=[];let m=null;
        for(const w of words){
          if(!Number.isFinite(w.value))throw Error('Число слишком велико.');
          if(w.letter==='G'){
            const group=dialect.gGroups[w.value];
            if(!group)throw Error([90,91].includes(w.value)?'G90/G91 не входят в этот блок. В токарном Haas G90 — цикл точения, а X/Z здесь уже абсолютные.':'G'+w.value+' не поддерживается. Откройте памятку команд учебного блока.');
            if(groups.has(group))throw Error('Две G-команды одной группы в строке. Оставьте один действующий режим.');groups.add(group);codes.push('G'+w.value);
            if(group==='motion')next.motion=w.value;else if(group==='feed')next.feedMode=w.value;else if(group==='speed')next.speedMode=w.value;else if(group==='plane')next.plane=w.value;else next.units=w.value;
          }else if(w.letter==='M'){
            if(m!==null)throw Error('В строке допускается одна M-команда.');
            if(!dialect.mCodes.includes(w.value))throw Error('M'+w.value+' не поддерживается в этом блоке.');m=w.value;codes.push('M'+m);
          }else{
            if(!['X','Z','F','S'].includes(w.letter))throw Error('Адрес '+w.letter+' не входит в учебный набор. Используйте X/Z, F/S и поддерживаемые G/M.');
            if(Object.hasOwn(single,w.letter))throw Error('Адрес '+w.letter+' повторяется в одной строке.');single[w.letter]=w.value;
          }
        }
        if(single.X!==undefined){if(single.X<dialect.bounds.x[0]||single.X>dialect.bounds.x[1])throw Error('Учебная область X: от 0 до 60 мм по диаметру.');next.x=single.X;}
        if(single.Z!==undefined){if(single.Z<dialect.bounds.z[0]||single.Z>dialect.bounds.z[1])throw Error('Учебная область Z: от −60 до 10 мм.');next.z=single.Z;}
        if(single.F!==undefined){if(single.F<=dialect.bounds.feed[0]||single.F>dialect.bounds.feed[1])throw Error('Учебная подача F должна быть больше 0 и не больше 1000.');next.feed=single.F;}
        if(single.S!==undefined){if(single.S<dialect.bounds.rpm[0]||single.S>dialect.bounds.rpm[1])throw Error('Учебные обороты S: от 1 до 5000 об/мин.');next.rpm=single.S;}
        if(m===3){if(next.rpm<=0)throw Error('Перед M03 задайте положительные обороты словом S.');next.spindle=true;}
        if(m===5)next.spindle=false;
        const axes=single.X!==undefined||single.Z!==undefined;
        if(m===30&&axes)throw Error('В учебном блоке запишите перемещение и M30 в разных строках.');
        if(axes&&next.motion===null)throw Error('Перед координатами задайте G00 или G01: вид движения ещё не выбран.');
        if(axes&&next.motion===1&&next.feed===null)throw Error('Для G01 ещё не задана подача F. Укажите её здесь или раньше.');
        let move=null;
        if(axes&&(!near(state.x,next.x)||!near(state.z,next.z))){
          move={line,from:point(state.x,state.z),to:point(next.x,next.z),mode:next.motion,feed:next.feed,feedMode:next.feedMode,spindle:next.spindle,rpm:next.rpm,speedMode:next.speedMode};
          if(move.mode===0&&rapidRisk(move.from,move.to,stock))warnings.push({line,message:'Быстрый ход может пройти внутри исходной заготовки. Проверьте порядок X/Z; одновременный G00 не гарантирует прямую.'});
        }
        if(m===30){next.ended=true;next.spindle=false;}
        trace.push({line,raw:lines[i],before:{...state},after:{...next},move,codes});if(move)moves.push(move);state=next;
      }catch(e){fail(line,e.message);break;}
    }
    return {initial,state,stock,trace,moves,errors,warnings};
  }
  function mergedMoves(moves){
    const out=[];for(const move of moves){const last=out[out.length-1];
      if(last&&last.mode===move.mode&&(move.mode===0||last.feed===move.feed&&last.feedMode===move.feedMode)&&last.spindle===move.spindle&&last.rpm===move.rpm){
        const ax=last.to.x-last.from.x,az=last.to.z-last.from.z,bx=move.to.x-move.from.x,bz=move.to.z-move.from.z;
        if(near(ax*bz-az*bx,0)&&ax*bx+az*bz>0){last.to={...move.to};continue;}
      }out.push({...move,from:{...move.from},to:{...move.to}});
    }return out;
  }
  function grade(id,source){
    const task=tasks.find(t=>t.id===id);if(!task)return {correct:false,criteria:[{ok:false,text:'Неизвестное задание.'}],result:simulate('')};
    const result=simulate(source,{initial:task.initial,stock:task.stock}),criteria=[],rpmWanted=task.spindleCycle||task.rpm||600;
    const add=(ok,text)=>criteria.push({ok:!!ok,text});
    add(!result.errors.length,'Все строки прочитаны без ошибок.');
    if(result.errors.length)return {correct:false,criteria,result};
    add(!result.warnings.length,'Нет отмеченного быстрого хода через исходную заготовку.');
    const moves=mergedMoves(result.moves);
    const pathOk=moves.length===task.expected.length&&moves.every((m,i)=>{const e=task.expected[i];return near(m.to.x,e.x)&&near(m.to.z,e.z)&&m.mode===e.mode&&(e.feed===undefined||near(m.feed,e.feed)&&m.feedMode===99);});
    add(pathOk,'Точки, порядок и вид движений соответствуют заданию.');
    let pathHint='';
    if(!pathOk){
      if(moves.length!==task.expected.length)pathHint=`Получилось участков: ${moves.length}; в заданном маршруте: ${task.expected.length}. Проверьте лишние движения, смену режима или подачи.`;
      else for(let i=0;i<moves.length;i++){const m=moves[i],e=task.expected[i],prefix=`Участок ${i+1}, строка ${m.line}. `;
        if(!near(m.to.x,e.x)||!near(m.to.z,e.z)){pathHint=prefix+`Получена точка X${m.to.x} Z${m.to.z}; по условию нужна X${e.x} Z${e.z}.`;break;}
        if(m.mode!==e.mode){pathHint=prefix+`Действует G0${m.mode}; по условию требуется G0${e.mode}.`;break;}
        if(e.feed!==undefined&&(!near(m.feed,e.feed)||m.feedMode!==99)){pathHint=prefix+`Проверьте F и единицы: требуется ${e.feed} мм/об.`;break;}
      }
    }
    const cuts=result.moves.filter(m=>m.mode===1);
    if(task.requireFeedMode)add(cuts.length>0&&cuts.every(m=>m.feedMode===task.requireFeedMode)&&result.trace.some(t=>t.codes.includes('G99')),'Явно выбран G99, на рабочем ходе подача в мм/об.');
    if(task.spindleCycle||task.full){
      const rpm=rpmWanted,startIndex=result.trace.findIndex(t=>t.codes.includes('M3')&&t.after.rpm===rpm&&t.after.speedMode===97),stopIndex=result.trace.findIndex((t,i)=>i>startIndex&&t.codes.includes('M5'));
      const lastStart=result.trace.reduce((last,t,i)=>t.codes.includes('M3')?i:last,-1);
      add(startIndex>=0&&result.trace.filter(t=>t.codes.includes('M3')).length===1&&result.trace.slice(0,startIndex+1).some(t=>t.codes.includes('G97')),'Явно задан G97 и один запуск с постоянными '+rpm+' об/мин.');
      add(stopIndex>lastStart&&lastStart>=0&&result.state.ended,'После включения дана отдельная M05, затем завершение M30.');
    }
    if(task.full){
      const firstMove=result.trace.findIndex(t=>t.move),header=result.trace.slice(0,firstMove<0?0:firstMove+1).flatMap(t=>t.codes);
      add(['G21','G18','G99','G97'].every(c=>header.includes(c)),'До движения явно выбраны миллиметры, XZ, мм/об и постоянные обороты.');
      add(cuts.length>0&&cuts.every(m=>m.spindle&&near(m.rpm,rpmWanted)),'Есть рабочий G01 при включённом вращении '+rpmWanted+' об/мин.');
      if(task.transfer){const stop=result.trace.findIndex(t=>t.codes.includes('M5')),lastMove=result.trace.reduce((last,t,i)=>t.move?i:last,-1);add(stop>lastMove,'Явная остановка M05 записана после последнего отвода.');}
    }
    return {correct:criteria.every(c=>c.ok),criteria,result,pathHint};
  }
  function restore(value){
    const state={version:1,selected:tasks[0].id,phases:{},drafts:{},passed:{},helped:{}};
    if(!value||value.version!==1)return state;
    if(tasks.some(t=>t.id===value.selected))state.selected=value.selected;
    for(const t of tasks){
      if(value.phases?.[t.id]==='practice')state.phases[t.id]='practice';
      const draft=value.drafts?.[t.id];if(typeof draft==='string'&&draft.length<=MAX_SOURCE)state.drafts[t.id]=draft;
      if(value.helped?.[t.id]===true)state.helped[t.id]=true;
      const pass=value.passed?.[t.id];if(pass&&typeof pass.code==='string'&&pass.code.length<=MAX_SOURCE&&grade(t.id,pass.code).correct)state.passed[t.id]={code:pass.code,assisted:pass.assisted===true};
    }return state;
  }
  const api={tasks,sources,commands,simulate,grade,restore,MAX_SOURCE,MAX_LINES,dialect,mergedMoves};root.CNCGCode=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
