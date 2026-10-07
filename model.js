(function(root) {
  'use strict';
  const tasks = [
    {id:'diameter', title:'Первый проход', tag:'01', goal:'Получите диаметр 28 мм', description:'Заготовка Ø32 мм. Обточите участок длиной 45 мм до Ø28 мм за один учебный проход.', defaults:{x:30, offset:0, feed:0.2, rpm:800, tool:'turning'}},
    {id:'offset', title:'Коррекция инструмента', tag:'02', goal:'Найдите ошибку коррекции X', description:'В программе указан Ø28 мм, но в таблицу коррекций внесена ошибка. Проверьте результат и настройте коррекцию.', defaults:{x:28, offset:-4, feed:0.2, rpm:800, tool:'turning'}},
    {id:'feed', title:'Режим обработки', tag:'03', goal:'Подберите учебный режим', description:'Диаметр настроен правильно. Проверьте подачу и частоту вращения по условиям упражнения.', defaults:{x:28, offset:0, feed:0.45, rpm:800, tool:'turning'}}
  ];
  function evaluate(p) {
    const errors=[]; const warnings=[];
    const vals=['x','offset','feed','rpm'];
    if(vals.some(k=>typeof p[k]!=='number'||!Number.isFinite(p[k]))) return {valid:false,success:false,errors:[{key:'input',title:'Проверьте поля',detail:'Введите числовые значения во все поля настройки.'}],warnings:[],actual:null,depth:null};
    if(p.x<1||p.x>60||p.offset< -10||p.offset>10||p.feed<0.01||p.feed>1||p.rpm<100||p.rpm>2000) return {valid:false,success:false,errors:[{key:'input',title:'Значение вне диапазона',detail:'X: 1–60 мм; коррекция: −10…10 мм; подача: 0,01–1 мм/об; обороты: 100–2000 об/мин.'}],warnings:[],actual:null,depth:null};
    const actual=+(p.x+p.offset).toFixed(3),depth=+((32-actual)/2).toFixed(3);
    if(p.tool!=='turning') errors.push({key:'tool',title:'Не подходит инструмент',detail:'Для наружного продольного точения выберите проходной резец.'});
    if(actual<=0) errors.push({key:'collision',title:'Траектория пересекает ось',detail:'Сумма X и коррекции должна быть положительной. Пробный проход заблокирован.'});
    else if(actual<27.9) errors.push({key:'diameter',title:'Снято слишком много материала',detail:'Результат меньше Ø28 мм. Увеличьте сумму X и коррекции; в этой модели X задаётся по диаметру.'});
    else if(actual>28.1) errors.push({key:'diameter',title:actual>=32?'Инструмент не снимает материал':'Остался припуск',detail:'Результат больше Ø28 мм. Уменьшите сумму X и коррекции до 28 мм.'});
    if(depth>2) errors.push({key:'depth',title:'Слишком глубокий проход',detail:'В этом упражнении разрешено снимать не более 2 мм на радиус за проход.'});
    if(p.feed<0.1||p.feed>0.25) errors.push({key:'feed',title:p.feed>0.25?'Подача выше учебного диапазона':'Подача ниже учебного диапазона',detail:'По условиям задания установите 0,10–0,25 мм/об.'});
    if(p.rpm<600||p.rpm>1000) errors.push({key:'rpm',title:'Обороты вне учебного диапазона',detail:'По условиям задания установите 600–1000 об/мин.'});
    if(p.offset!==0) errors.push({key:'offset',title:'Проверьте коррекцию X',detail:'Фактический диаметр в демке равен X + коррекция. Для этого задания правильная коррекция — 0 мм.'});
    return {valid:true,success:errors.length===0,errors,warnings,actual,depth,minutes:+(45/(p.feed*p.rpm)).toFixed(3),canAnimate:actual>0&&actual<=60&&p.tool==='turning'};
  }
  function mentor(p, question, checked) {
    const q=String(question||'').toLowerCase(); const r=evaluate(p);
    if(!r.valid) return r.errors[0].detail;
    if(/коррек|смещ|нул/.test(q)) return 'В этой упрощённой модели X — диаметр, а коррекция прибавляется к нему. Сейчас '+p.x+' + ('+p.offset+') = '+r.actual+' мм. В упражнении требуется Ø28 мм, а правильная коррекция равна 0 мм. Сначала проверьте коррекцию, затем значение X.';
    if(/подач/.test(q)) return 'Подача показывает перемещение за один оборот шпинделя. Для этого упражнения допустимо 0,10–0,25 мм/об. Сейчас установлено '+p.feed+' мм/об. Учебная оценка времени прохода: длина / (подача × обороты). Реальный режим зависит от материала, инструмента и станка.';
    if(/оборот|скорост|шпиндел/.test(q)) return 'Для этого упражнения установите 600–1000 об/мин. Сейчас: '+p.rpm+' об/мин. Это условие учебного сценария; рабочий режим на реальном станке выбирают по технологической документации.';
    if(/резец|инструмент/.test(q)) return 'Задание — наружное продольное точение. Выберите проходной резец. Сверло предназначено для другого типа операции и не подходит для этого прохода.';
    if(/код|программ|g01|g00/.test(q)) return 'Показанный код — иллюстрация одного учебного прохода: подход, перемещение к диаметру X и движение вдоль Z. В демке код формируется из настроек; полноценного интерпретатора G-кода пока нет.';
    if(/диаметр|размер|припуск|глубин/.test(q)) return 'Цель — Ø28 мм из Ø32 мм. Нужно снять 2 мм на радиус. Сейчас ожидается Ø'+r.actual+' мм: X '+p.x+' мм плюс коррекция '+p.offset+' мм. Допуск упражнения: ±0,1 мм.';
    if(/что|ошиб|помо|подсказ|почему|провер/.test(q)||!q.trim()) {
      if(r.success) return 'Настройки соответствуют заданию. Запустите пробный проход: проверьте движение инструмента и итоговый диаметр. Затем попробуйте следующее упражнение.';
      const first=r.errors[0]; return (checked?'В проверке обнаружено: ':'Начните с проверки: ')+first.title.toLowerCase()+'. '+first.detail;
    }
    return 'В локальной демке я разбираю диаметр, коррекцию, подачу, обороты, инструмент и учебный код. Выберите тему подсказки или спросите, что исправить в текущих настройках.';
  }
  root.CNCModel={tasks,evaluate,mentor};
  if(typeof module!=='undefined'&&module.exports) module.exports=root.CNCModel;
})(typeof window!=='undefined'?window:globalThis);
